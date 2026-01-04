const { db } = require('../utils/db');
const Permissions = require("../utils/permissions");
const { PERMISSION_LEVELS } = require("../utils/permissions");
const { DEFAULT_RULES } = require('../utils/default'); 

const PAGE_SIZE = 10;
const BANNER_URL = "https://images.steamusercontent.com/ugc/790863751169443352/AAC9980582D8B930F8B8136B1CDBEAD1B2766C19/?imw=1024&imh=576&ima=fit&impolicy=Letterbox&imcolor=%23000000&letterbox=true";

const PERM_MAP = {
    "8": "Administrator",
    "administrator": "Administrator",
    "32": "Manage Server",
    "manageGuild": "Manage Server",
    "268435456": "Manage Roles",
    "manageRoles": "Manage Roles",
    "manageEmojisAndStickers": "Manage Emojis",
    "8192": "Manage Messages",
    "manageMessages": "Manage Messages",
    "2": "Kick Members",
    "kickMembers": "Kick Members",
    "4": "Ban Members",
    "banMembers": "Ban Members",
    "0": "Everyone",
    "everyone": "Everyone",
    "BOT_OWNER": "Developer Only"
};

const getCommandNames = (bot) => {
    return Array.from(bot.commands.values())
        .map(c => c.name)
        .filter(name => name !== 'config' && name !== 'help');
};

const formatPerm = (perm) => {
    if (!perm || perm === 'null') return "Everyone";
    if (PERM_MAP[perm]) return PERM_MAP[perm];
    return perm.replace(/([A-Z])/g, ' $1').trim().replace(/^./, str => str.toUpperCase());
};

module.exports = {
    name: 'config',
    description: 'Manage bot settings for this server.',
    type: 1, 
    default_member_permissions: "32", 
    options: [
        {
            name: 'toggle',
            description: 'Enable or disable a command globally.',
            type: 1, 
            options: [
                { name: 'command', description: 'The command to configure.', type: 3, required: true, autocomplete: true },
                { name: 'status', description: 'New status for the command.', type: 5, required: true }
            ]
        },
        {
            name: 'channel',
            description: 'Restrict a command to a specific channel.',
            type: 1,
            options: [
                { name: 'command', description: 'The command to restrict.', type: 3, required: true, autocomplete: true },
                { name: 'channel', description: 'The channel (leave empty for Global).', type: 7, required: false }
            ]
        },
        {
            name: 'permission',
            description: 'Set the minimum permission required.',
            type: 1,
            options: [
                { name: 'command', description: 'The command to configure.', type: 3, required: true, autocomplete: true },
                { 
                    name: 'level', 
                    description: 'The permission required.', 
                    type: 3, 
                    required: true,
                    choices: [
                        { name: 'Reset to Default', value: 'DEFAULT' },
                        { name: 'Administrator', value: 'administrator' },
                        { name: 'Manage Server', value: 'manageGuild' },
                        { name: 'Manage Roles', value: 'manageRoles' },
                        { name: 'Manage Messages', value: 'manageMessages' },
                        { name: 'Kick Members', value: 'kickMembers' },
                        { name: 'Ban Members', value: 'banMembers' },
                        { name: 'Everyone (None)', value: 'null' }
                    ]
                }
            ]
        },
        {
            name: 'overview',
            description: 'View settings. Leave "command" empty to see ALL.',
            type: 1,
            options: [
                { name: 'command', description: 'Specific command (Optional).', type: 3, required: false, autocomplete: true }
            ]
        }
    ],

    async execute(interaction, bot) {
        if (!await Permissions.check(interaction, 'config')) return;
        
        const sub = interaction.data.options[0];
        const args = sub.options || []; 
        const getVal = (n) => args.find(o => o.name === n)?.value;
        const commandName = getVal('command');

        if (sub.name !== 'overview' && !commandName) {
             return interaction.createMessage({ content: "❌ You must specify a command.", flags: 64 });
        }

        const client = await db.connect();
        try {
            const res = await client.query("SELECT command_rules FROM guild_settings WHERE guild_id = $1", [interaction.guildID]);
            let rules = res.rows[0]?.command_rules || {};

            // --- OVERVIEW ---
            if (sub.name === 'overview') {
                if (commandName) {
                    if (!bot.commands.has(commandName)) {
                        return interaction.createMessage({ content: `❌ Command \`${commandName}\` not found.`, flags: 64 });
                    }
                    const payload = this.generateSingleOverview(commandName, rules, bot);
                    return interaction.createMessage(payload);
                } else {
                    const botCommands = getCommandNames(bot).sort();
                    const payload = this.generateListPage(botCommands, rules, 1, bot);
                    return interaction.createMessage(payload);
                }
            }

            // --- EDITING ---
            if (!bot.commands.has(commandName)) return interaction.createMessage({ content: "❌ Command not found.", flags: 64 });
            
            if (!rules[commandName]) rules[commandName] = {};
            const rule = rules[commandName];

            let responseText = "";

            if (sub.name === 'toggle') {
                const status = getVal('status');
                rule.enabled = status;
                responseText = `✅ **${commandName}** is now **${status ? 'ENABLED' : 'DISABLED'}**.`;
            } 
            else if (sub.name === 'channel') {
                const channelID = getVal('channel');
                // FIX 1: Use 'allow_channels' (matches Gatekeeper)
                if (!rule.allow_channels) rule.allow_channels = [];

                if (channelID) {
                    if (rule.allow_channels.includes(channelID)) {
                        rule.allow_channels = rule.allow_channels.filter(c => c !== channelID);
                        responseText = `✅ **${commandName}** is no longer restricted to <#${channelID}>.`;
                    } else {
                        rule.allow_channels.push(channelID);
                        responseText = `✅ **${commandName}** is now allowed in <#${channelID}>.`;
                    }
                } else {
                    rule.allow_channels = [];
                    responseText = `✅ **${commandName}** is now allowed in **ALL** channels.`;
                }
            } 
            else if (sub.name === 'permission') {
                const level = getVal('level');
                if (level === 'DEFAULT') {
                    // FIX 2: Use 'min_perm' (matches Gatekeeper)
                    delete rule.min_perm;
                    responseText = `✅ **${commandName}** permission reset to default.`;
                } else if (level === 'null') {
                    rule.min_perm = 'null';
                    responseText = `✅ **${commandName}** is now available to **everyone**.`;
                } else {
                    rule.min_perm = level;
                    responseText = `✅ **${commandName}** now requires **${formatPerm(level)}**.`;
                }
            }

            const rulesJson = JSON.stringify(rules);
            if (res.rowCount === 0) {
                await client.query("INSERT INTO guild_settings (guild_id, command_rules) VALUES ($1, $2)", [interaction.guildID, rulesJson]);
            } else {
                await client.query("UPDATE guild_settings SET command_rules = $2 WHERE guild_id = $1", [interaction.guildID, rulesJson]);
            }

            await interaction.createMessage({ content: responseText });

        } catch (err) {
            console.error(err);
            await interaction.createMessage({ content: "❌ Failed to access settings.", flags: 64 });
        } finally {
            client.release();
        }
    },

    async handleButton(interaction, bot) {
        const customId = interaction.data.custom_id;
        if (!customId.startsWith('config_page_')) return;

        const page = parseInt(customId.split('_')[2]);
        const client = await db.connect();
        try {
            const res = await client.query("SELECT command_rules FROM guild_settings WHERE guild_id = $1", [interaction.guildID]);
            const rules = res.rows[0]?.command_rules || {};
            const botCommands = getCommandNames(bot).sort();

            const payload = this.generateListPage(botCommands, rules, page, bot);
            await interaction.editParent(payload);
        } catch (err) { 
            console.error(err);
        } finally {
            client.release();
        }
    },

    async autocomplete(interaction, bot) {
        const sub = interaction.data.options[0];
        const options = sub.options || []; 
        
        const focused = options.find(o => o.focused);
        if (!focused) return []; 

        const input = focused.value.toLowerCase();
        const allCommands = getCommandNames(bot);
        
        const filtered = input 
            ? allCommands.filter(name => name.toLowerCase().startsWith(input))
            : allCommands;
        
        return interaction.result(filtered.slice(0, 25).map(name => ({ name: name, value: name })));
    },

    getEffectiveSettings(cmdName, rules, bot) {
        const cmdObj = bot.commands.get(cmdName);
        const dbRule = rules[cmdName] || {};
        const defRule = DEFAULT_RULES[cmdName] || {}; 

        const enabled = dbRule.hasOwnProperty('enabled') ? dbRule.enabled : (defRule.enabled ?? true);
        
        // FIX 3: Read 'allow_channels' consistently
        const channels = dbRule.allow_channels || defRule.allow_channels || [];

        let perm = null;
        
        // FIX 4: Check for 'min_perm'
        if (dbRule.hasOwnProperty('min_perm')) {
            perm = dbRule.min_perm;
        } 
        else if (PERMISSION_LEVELS[cmdName]) {
            perm = PERMISSION_LEVELS[cmdName];
        }
        else if (defRule.hasOwnProperty('min_perm')) {
            perm = defRule.min_perm;
        }
        else if (cmdObj && cmdObj.default_member_permissions) {
            perm = cmdObj.default_member_permissions;
        }

        return { enabled, channels, perm };
    },

    generateSingleOverview(cmdName, rules, bot) {
        const { enabled, channels, perm } = this.getEffectiveSettings(cmdName, rules, bot);
        const statusIcon = enabled ? '🟢' : '🔴';
        const channelText = channels.length > 0 ? channels.map(id => `<#${id}>`).join(', ') : "🌐 Global";

        return {
            embeds: [{
                title: `${statusIcon} Settings: ${cmdName}`,
                color: enabled ? 0x43b581 : 0xf04747,
                image: { url: BANNER_URL },
                fields: [
                    { name: 'Status', value: `**${enabled ? 'Enabled' : 'Disabled'}**`, inline: true },
                    { name: 'Permission', value: `🔒 ${formatPerm(perm)}`, inline: true },
                    { name: 'Channels', value: channelText, inline: false }
                ]
            }]
        };
    },

    generateListPage(allCommands, rules, page, bot) {
        const totalPages = Math.ceil(allCommands.length / PAGE_SIZE);
        if (page < 1) page = 1;
        if (page > totalPages) page = totalPages;

        const start = (page - 1) * PAGE_SIZE;
        const end = start + PAGE_SIZE;
        const currentSlice = allCommands.slice(start, end);

        const lines = currentSlice.map(cmd => {
            const { enabled, channels, perm } = this.getEffectiveSettings(cmd, rules, bot);
            const icon = enabled ? '🟢' : '🔴';
            const permShort = formatPerm(perm); 
            const chanShort = channels.length > 0 ? '#Limit' : 'Global';
            return `${icon} **${cmd}**: ${permShort} | ${chanShort}`;
        });

        return {
            embeds: [{
                title: '🎛️ Server Configuration',
                description: lines.join('\n') || "No commands found.",
                color: 0x2b2d31,
                image: { url: BANNER_URL },
                footer: { text: `Page ${page} of ${totalPages} • Total: ${allCommands.length}` }
            }],
            components: totalPages > 1 ? [{
                type: 1,
                components: [
                    { type: 2, style: 2, label: '◀ Prev', custom_id: `config_page_${page - 1}`, disabled: page === 1 },
                    { type: 2, style: 2, label: 'Next ▶', custom_id: `config_page_${page + 1}`, disabled: page === totalPages }
                ]
            }] : []
        };
    }
};