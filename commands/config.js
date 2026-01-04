const { db } = require('../utils/db');
const DEFAULT_RULES = require('../utils/default');

// --- CONSTANTS ---
const PAGE_SIZE = 10; // Commands per page

// --- HELPERS ---
const getCommandNames = (bot) => {
    return Array.from(bot.commands.values())
        .map(c => c.name)
        .filter(name => name !== 'config' && name !== 'help');
};

const formatPerm = (perm) => {
    if (!perm) return "Everyone";
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
                {
                    name: 'command',
                    description: 'The command to configure.',
                    type: 3,
                    required: true,
                    autocomplete: true
                },
                {
                    name: 'status',
                    description: 'New status for the command.',
                    type: 5, 
                    required: true
                }
            ]
        },
        {
            name: 'channel',
            description: 'Restrict a command to a specific channel.',
            type: 1,
            options: [
                {
                    name: 'command',
                    description: 'The command to restrict.',
                    type: 3,
                    required: true,
                    autocomplete: true
                },
                {
                    name: 'channel',
                    description: 'The channel to allow (leave empty to allow everywhere).',
                    type: 7, 
                    required: false
                }
            ]
        },
        {
            name: 'permission',
            description: 'Set the minimum permission required to use a command.',
            type: 1,
            options: [
                {
                    name: 'command',
                    description: 'The command to configure.',
                    type: 3,
                    required: true,
                    autocomplete: true
                },
                {
                    name: 'level',
                    description: 'The permission required.',
                    type: 3,
                    required: true,
                    choices: [
                        { name: 'Reset to Default', value: 'DEFAULT' },
                        { name: 'Administrator', value: 'Administrator' },
                        { name: 'Manage Server', value: 'ManageGuild' },
                        { name: 'Manage Messages', value: 'ManageMessages' },
                        { name: 'Kick Members', value: 'KickMembers' },
                        { name: 'Ban Members', value: 'BanMembers' },
                        { name: 'Everyone (None)', value: 'null' }
                    ]
                }
            ]
        },
        // --- MODIFIED OVERVIEW ---
        {
            name: 'overview',
            description: 'View settings. Leave "command" empty to see ALL commands.',
            type: 1,
            options: [
                {
                    name: 'command',
                    description: 'Specific command to view (Optional).',
                    type: 3,
                    required: false, // NOW OPTIONAL
                    autocomplete: true
                }
            ]
        }
    ],

    // --- MAIN EXECUTION ---
    async execute(interaction, bot) {
        const sub = interaction.data.options[0];
        const args = sub.options || [];
        const getVal = (n) => args.find(o => o.name === n)?.value;
        const commandName = getVal('command');

        // Validation for subcommands that REQUIRE a command name
        if (sub.name !== 'overview' && !commandName) {
             return interaction.createMessage({ content: "❌ You must specify a command.", flags: 64 });
        }

        const client = await db.connect();
        try {
            // 1. Fetch current settings
            const res = await client.query("SELECT command_rules FROM guild_settings WHERE guild_id = $1", [interaction.guildID]);
            let rules = res.rows[0]?.command_rules || {};

            // --- HANDLING OVERVIEW ---
            if (sub.name === 'overview') {
                
                // CASE A: Single Command Overview
                if (commandName) {
                    if (!bot.commands.has(commandName)) {
                        return interaction.createMessage({ content: `❌ Command \`${commandName}\` not found.`, flags: 64 });
                    }
                    const payload = this.generateSingleOverview(commandName, rules);
                    return interaction.createMessage(payload);
                } 
                
                // CASE B: List All Commands (Paginated)
                else {
                    const botCommands = getCommandNames(bot).sort();
                    const payload = this.generateListPage(botCommands, rules, 1); // Start at Page 1
                    return interaction.createMessage(payload);
                }
            }

            // --- HANDLING SETTINGS CHANGES (Toggle/Channel/Perms) ---
            if (!bot.commands.has(commandName)) return interaction.createMessage({ content: "❌ Command not found.", flags: 64 });
            
            // Resolve Defaults
            const defRule = DEFAULT_RULES[commandName] || {};
            if (!rules[commandName]) rules[commandName] = { ...defRule };

            let responseText = "";

            if (sub.name === 'toggle') {
                const status = getVal('status');
                rules[commandName].enabled = status;
                responseText = `✅ **${commandName}** is now **${status ? 'ENABLED' : 'DISABLED'}**.`;
            } 
            else if (sub.name === 'channel') {
                const channelID = getVal('channel');
                if (!rules[commandName].allowed_channels) rules[commandName].allowed_channels = [];

                if (channelID) {
                    if (rules[commandName].allowed_channels.includes(channelID)) {
                        rules[commandName].allowed_channels = rules[commandName].allowed_channels.filter(c => c !== channelID);
                        responseText = `✅ **${commandName}** is no longer restricted to <#${channelID}>.`;
                    } else {
                        rules[commandName].allowed_channels.push(channelID);
                        responseText = `✅ **${commandName}** is now allowed in <#${channelID}>.`;
                    }
                } else {
                    rules[commandName].allowed_channels = [];
                    responseText = `✅ **${commandName}** is now allowed in **ALL** channels.`;
                }
            } 
            else if (sub.name === 'permission') {
                const level = getVal('level');
                if (level === 'DEFAULT') {
                    delete rules[commandName].required_perm;
                    responseText = `✅ **${commandName}** permission reset to default.`;
                } else if (level === 'null') {
                    rules[commandName].required_perm = null;
                    responseText = `✅ **${commandName}** is now available to **everyone**.`;
                } else {
                    rules[commandName].required_perm = level;
                    responseText = `✅ **${commandName}** now requires **${formatPerm(level)}**.`;
                }
            }

            // Save to DB
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

    // --- INTERACTION HANDLER (Buttons) ---
    async handleButton(interaction, bot) {
        const customId = interaction.data.custom_id;
        if (!customId.startsWith('config_page_')) return;

        // "config_page_2" -> page = 2
        const page = parseInt(customId.split('_')[2]);

        const client = await db.connect();
        try {
            // We need to fetch rules again to be accurate
            const res = await client.query("SELECT command_rules FROM guild_settings WHERE guild_id = $1", [interaction.guildID]);
            const rules = res.rows[0]?.command_rules || {};
            const botCommands = getCommandNames(bot).sort();

            const payload = this.generateListPage(botCommands, rules, page);
            
            // Update the message
            await interaction.editParent(payload);

        } catch (err) { 
            console.error(err);
        } finally {
            client.release();
        }
    },

    // --- AUTOCOMPLETE ---
    async autocomplete(interaction, bot) {
        const focused = interaction.data.options[0].options.find(o => o.focused);
        const input = focused.value.toLowerCase();
        const allCommands = getCommandNames(bot);
        const filtered = allCommands.filter(name => name.toLowerCase().startsWith(input));
        return filtered.slice(0, 25).map(name => ({ name: name, value: name }));
    },

    // --- VIEW GENERATORS ---

    generateSingleOverview(commandName, rules) {
        const dbRule = rules[commandName] || {};
        const defRule = DEFAULT_RULES[commandName] || {};
        
        // Resolve effective settings
        const isEnabled = dbRule.hasOwnProperty('enabled') ? dbRule.enabled : (defRule.enabled ?? true);
        const channels = dbRule.allowed_channels || defRule.allowed_channels || [];
        let perm = dbRule.hasOwnProperty('required_perm') ? dbRule.required_perm : defRule.required_perm;
        if (perm === 'null' || perm === null) perm = null;

        const statusIcon = isEnabled ? '🟢' : '🔴';
        const channelText = channels.length > 0 ? channels.map(id => `<#${id}>`).join(', ') : "🌐 Global";

        return {
            embeds: [{
                title: `${statusIcon} Settings: ${commandName}`,
                color: isEnabled ? 0x43b581 : 0xf04747,
                fields: [
                    { name: 'Status', value: `**${isEnabled ? 'Enabled' : 'Disabled'}**`, inline: true },
                    { name: 'Permission', value: `🔒 ${formatPerm(perm)}`, inline: true },
                    { name: 'Channels', value: channelText, inline: false }
                ]
            }]
        };
    },

    generateListPage(allCommands, rules, page) {
        const totalPages = Math.ceil(allCommands.length / PAGE_SIZE);
        if (page < 1) page = 1;
        if (page > totalPages) page = totalPages;

        const start = (page - 1) * PAGE_SIZE;
        const end = start + PAGE_SIZE;
        const currentSlice = allCommands.slice(start, end);

        // Build list description
        const lines = currentSlice.map(cmd => {
            const dbRule = rules[cmd] || {};
            const defRule = DEFAULT_RULES[cmd] || {};
            
            const isEnabled = dbRule.hasOwnProperty('enabled') ? dbRule.enabled : (defRule.enabled ?? true);
            let perm = dbRule.hasOwnProperty('required_perm') ? dbRule.required_perm : defRule.required_perm;
            const channels = dbRule.allowed_channels || defRule.allowed_channels || [];

            const icon = isEnabled ? '🟢' : '🔴';
            const permShort = perm ? (perm === 'Administrator' ? 'Admin' : 'Perms') : 'All';
            const chanShort = channels.length > 0 ? '#Limit' : 'Global';

            // Format: 🟢 **ping**: All | Global
            return `${icon} **${cmd}**: ${permShort} | ${chanShort}`;
        });

        const embed = {
            title: '🎛️ Server Configuration',
            description: lines.join('\n') || "No commands found.",
            color: 0x2b2d31,
            footer: { text: `Page ${page} of ${totalPages} • Total: ${allCommands.length}` }
        };

        // Navigation Buttons
        const components = [];
        if (totalPages > 1) {
            components.push({
                type: 1,
                components: [
                    {
                        type: 2, // Button
                        style: 2, // Secondary (Gray)
                        label: '◀ Prev',
                        custom_id: `config_page_${page - 1}`,
                        disabled: page === 1
                    },
                    {
                        type: 2, // Button
                        style: 2, // Secondary (Gray)
                        label: 'Next ▶',
                        custom_id: `config_page_${page + 1}`,
                        disabled: page === totalPages
                    }
                ]
            });
        }

        return {
            embeds: [embed],
            components: components
        };
    }
};