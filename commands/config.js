const { db } = require('../utils/db');
const DEFAULT_RULES = require('../utils/default');

// Helper to get all valid command names
const getCommandNames = (bot) => {
    return Array.from(bot.commands.values())
        .map(c => c.name)
        .filter(name => name !== 'config' && name !== 'help');
};

// Helper to make permission names readable
const formatPerm = (perm) => {
    if (!perm) return "Everyone (None)";
    // Split camelCase (e.g., ManageGuild -> Manage Guild)
    return perm.replace(/([A-Z])/g, ' $1').trim();
};

module.exports = {
    name: 'config',
    description: 'Manage bot settings for this server.',
    type: 1, // Slash Command
    default_member_permissions: "32", // Manage Guild
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
                    type: 5, // Boolean
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
                    type: 7, // Channel
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
        // --- NEW SUBCOMMAND ---
        {
            name: 'overview',
            description: 'View the current settings for a command.',
            type: 1,
            options: [
                {
                    name: 'command',
                    description: 'The command to inspect.',
                    type: 3,
                    required: true,
                    autocomplete: true
                }
            ]
        }
    ],

    async execute(interaction, bot) {
        const sub = interaction.data.options[0];
        const args = sub.options || [];
        const getVal = (n) => args.find(o => o.name === n)?.value;

        const commandName = getVal('command');
        
        if (!bot.commands.has(commandName)) {
            return interaction.createMessage({ content: `❌ Command \`${commandName}\` not found.`, flags: 64 });
        }

        const client = await db.connect();
        try {
            // 1. Fetch current settings
            const res = await client.query("SELECT command_rules FROM guild_settings WHERE guild_id = $1", [interaction.guildID]);
            let rules = res.rows[0]?.command_rules || {};

            // 2. Resolve final rules (DB overrides -> Default)
            const dbRule = rules[commandName] || {};
            const defRule = DEFAULT_RULES[commandName] || {};

            // Effective Enabled Status
            // (If DB has a value, use it. If not, use Default. If no Default, assume true).
            const isEnabled = dbRule.hasOwnProperty('enabled') ? dbRule.enabled : (defRule.enabled ?? true);
            
            // Effective Channels
            const channels = dbRule.allowed_channels || defRule.allowed_channels || [];
            
            // Effective Permission
            // If DB stores 'null', it means Everyone. If undefined, fallback to default.
            let perm = dbRule.hasOwnProperty('required_perm') ? dbRule.required_perm : defRule.required_perm;
            if (perm === 'null' || perm === null) perm = null;


            // --- SUBCOMMAND HANDLERS ---
            
            if (sub.name === 'overview') {
                // Visuals
                const statusIcon = isEnabled ? '🟢' : '🔴';
                const statusText = isEnabled ? 'Enabled' : 'Disabled';
                const color = isEnabled ? 0x43b581 : 0xf04747; // Green or Red

                // Format Channels
                const channelText = channels.length > 0 
                    ? channels.map(id => `<#${id}>`).join(', ') 
                    : "🌐 Global (All Channels)";

                // Format Permission
                const permText = `🔒 ${formatPerm(perm)}`;

                const embed = {
                    title: `${statusIcon} Settings: ${commandName}`,
                    color: color,
                    fields: [
                        { name: 'Status', value: `**${statusText}**`, inline: true },
                        { name: 'Required Permission', value: permText, inline: true },
                        { name: 'Allowed Channels', value: channelText, inline: false }
                    ],
                    footer: { text: isEnabled ? 'Users can currently use this command.' : 'This command is currently turned off.' }
                };

                await interaction.createMessage({ embeds: [embed] });
            }

            // ... (Existing logic for toggle/channel/permission) ...
            else {
                // Prepare object for updates
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
                        delete rules[commandName].required_perm; // Removing it forces fallback to default
                        responseText = `✅ **${commandName}** permission reset to default.`;
                    } else if (level === 'null') {
                        rules[commandName].required_perm = null;
                        responseText = `✅ **${commandName}** is now available to **everyone**.`;
                    } else {
                        rules[commandName].required_perm = level;
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
            }

        } catch (err) {
            console.error(err);
            await interaction.createMessage({ content: "❌ Failed to access settings.", flags: 64 });
        } finally {
            client.release();
        }
    },

    async autocomplete(interaction, bot) {
        const focused = interaction.data.options[0].options.find(o => o.focused);
        const input = focused.value.toLowerCase();
        const allCommands = getCommandNames(bot);
        const filtered = allCommands.filter(name => name.toLowerCase().startsWith(input));
        
        return filtered.slice(0, 25).map(name => ({
            name: name,
            value: name
        }));
    }
};