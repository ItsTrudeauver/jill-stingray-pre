const { db } = require('../utils/db');
const Permissions = require("../utils/permissions");
const { DEFAULT_RULES } = require('../utils/default');

// --- CONSTANTS ---
const PAGE_SIZE = 10;
const BANNER_URL = "https://images.steamusercontent.com/ugc/790863751169443352/AAC9980582D8B930F8B8136B1CDBEAD1B2766C19/?imw=1024&imh=576&ima=fit&impolicy=Letterbox&imcolor=%23000000&letterbox=true";

// Map Discord Bitfield Strings to Human Readable Names
const PERM_MAP = {
    "8": "Administrator",
    "32": "Manage Guild",
    "268435456": "Manage Roles",
    "8192": "Manage Messages",
    "2": "Kick Members",
    "4": "Ban Members",
    "0": "Everyone"
};

// --- HELPERS ---
const getCommandNames = (bot) => {
    return Array.from(bot.commands.values())
        .map(c => c.name)
        .filter(name => name !== 'config' && name !== 'help');
};

const formatPerm = (perm) => {
    if (!perm || perm === 'null') return "Everyone";
    // If it's a known bitfield (e.g., "8"), return the name
    if (PERM_MAP[perm]) return PERM_MAP[perm];
    // Otherwise, clean up camelCase (e.g. ManageGuild)
    return perm.replace(/([A-Z])/g, ' $1').trim();
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
                        { name: 'Administrator', value: 'Administrator' },
                        { name: 'Manage Server', value: 'ManageGuild' },
                        { name: 'Manage Roles', value: 'ManageRoles' },
                        { name: 'Manage Messages', value: 'ManageMessages' },
                        { name: 'Kick Members', value: 'KickMembers' },
                        { name: 'Ban Members', value: 'BanMembers' },
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

            // --- EDITING SETTINGS ---
            if (!bot.commands.has(commandName)) return interaction.createMessage({ content: "❌ Command not found.", flags: 64 });
            
            // Initialize if missing
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
                if (!rule.allowed_channels) rule.allowed_channels = [];

                if (channelID) {
                    if (rule.allowed_channels.includes(channelID)) {
                        rule.allowed_channels = rule.allowed_channels.filter(c => c !== channelID);
                        responseText = `✅ **${commandName}** is no longer restricted to <#${channelID}>.`;
                    } else {
                        rule.allowed_channels.push(channelID);
                        responseText = `✅ **${commandName}** is now allowed in <#${channelID}>.`;
                    }
                } else {
                    rule.allowed_channels = [];
                    responseText = `✅ **${commandName}** is now allowed in **ALL** channels.`;
                }
            } 
            else if (sub.name === 'permission') {
                const level = getVal('level');
                if (level === 'DEFAULT') {
                    delete rule.required_perm;
                    responseText = `✅ **${commandName}** permission reset to default.`;
                } else if (level === 'null') {
                    rule.required_perm = 'null';
                    responseText = `✅ **${commandName}** is now available to **everyone**.`;
                } else {
                    rule.required_perm = level;
                    responseText = `✅ **${commandName}** now requires **${formatPerm(level)}**.`;
                }
            }

            // Save
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
        const focused = interaction.data.options[0].options.find(o => o.focused);
        const input = focused.value.toLowerCase();
        const allCommands = getCommandNames(bot);
        const filtered = allCommands.filter(name => name.toLowerCase().startsWith(input));
        return filtered.slice(0, 25).map(name => ({ name: name, value: name }));
    },

    // --- SMART VIEW GENERATORS ---

    getEffectiveSettings(cmdName, rules, bot) {
        const cmdObj = bot.commands.get(cmdName);
        const dbRule = rules[cmdName] || {};
        const defRule = DEFAULT_RULES[cmdName] || {};

        // 1. ENABLED
        const enabled = dbRule.hasOwnProperty('enabled') ? dbRule.enabled : (defRule.enabled ?? true);
        
        // 2. CHANNELS
        const channels = dbRule.allowed_channels || defRule.allowed_channels || [];

        // 3. PERMISSIONS (The Fix)
        let perm = null;

        if (dbRule.hasOwnProperty('required_perm')) {
            // DB Override
            perm = dbRule.required_perm;
        } else if (defRule.hasOwnProperty('required_perm')) {
            // Defaults File
            perm = defRule.required_perm;
        } else if (cmdObj && cmdObj.default_member_permissions) {
            // Native Command File (e.g. "32" for Manage Guild)
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
            const permShort = formatPerm(perm); // Now correctly returns "Manage Roles" etc.
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