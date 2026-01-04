const { db } = require('../utils/db');
const DEFAULT_RULES = require('../utils/default');

// Helper to get all valid command names
const getCommandNames = (bot) => {
    return Array.from(bot.commands.values())
        .map(c => c.name)
        .filter(name => name !== 'config' && name !== 'help'); // Hide system commands
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
            type: 1, // Subcommand
            options: [
                {
                    name: 'command',
                    description: 'The command to configure.',
                    type: 3, // String
                    required: true,
                    autocomplete: true // ENABLES AUTOCOMPLETE
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
            type: 1, // Subcommand
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
        }
    ],

    // --- EXECUTE: Handles the settings change ---
    async execute(interaction, bot) {
        const sub = interaction.data.options[0];
        const args = sub.options || [];
        
        // Helper to get option value safely
        const getVal = (n) => args.find(o => o.name === n)?.value;

        const commandName = getVal('command');
        
        // Validation: Ensure command exists
        if (!bot.commands.has(commandName)) {
            return interaction.createMessage({ content: `❌ Command \`${commandName}\` not found.`, flags: 64 });
        }

        const client = await db.connect();
        try {
            // 1. Fetch current settings
            const res = await client.query("SELECT command_rules FROM guild_settings WHERE guild_id = $1", [interaction.guildID]);
            let rules = res.rows[0]?.command_rules || {};

            // 2. Ensure rule object exists
            if (!rules[commandName]) {
                rules[commandName] = { ...DEFAULT_RULES[commandName] } || { enabled: true, allowed_channels: [], required_perm: null };
            }

            let responseText = "";

            // 3. Handle Subcommands
            if (sub.name === 'toggle') {
                const status = getVal('status');
                rules[commandName].enabled = status;
                responseText = `✅ **${commandName}** is now **${status ? 'ENABLED' : 'DISABLED'}**.`;
            } 
            else if (sub.name === 'channel') {
                const channelID = getVal('channel');
                if (!rules[commandName].allowed_channels) rules[commandName].allowed_channels = [];

                if (channelID) {
                    // Toggle channel in list
                    if (rules[commandName].allowed_channels.includes(channelID)) {
                        rules[commandName].allowed_channels = rules[commandName].allowed_channels.filter(c => c !== channelID);
                        responseText = `✅ **${commandName}** is no longer restricted to <#${channelID}>.`;
                    } else {
                        rules[commandName].allowed_channels.push(channelID);
                        responseText = `✅ **${commandName}** is now allowed in <#${channelID}>.`;
                    }
                } else {
                    // Clear all channels
                    rules[commandName].allowed_channels = [];
                    responseText = `✅ **${commandName}** is now allowed in **ALL** channels.`;
                }
            } 
            else if (sub.name === 'permission') {
                const level = getVal('level');
                if (level === 'DEFAULT') {
                    rules[commandName].required_perm = DEFAULT_RULES[commandName]?.required_perm || null;
                    responseText = `✅ **${commandName}** permission reset to default.`;
                } else if (level === 'null') {
                    rules[commandName].required_perm = null;
                    responseText = `✅ **${commandName}** is now available to **everyone**.`;
                } else {
                    rules[commandName].required_perm = level;
                    responseText = `✅ **${commandName}** now requires **${level}** permission.`;
                }
            }

            // 4. Save to DB
            const rulesJson = JSON.stringify(rules);
            if (res.rowCount === 0) {
                await client.query("INSERT INTO guild_settings (guild_id, command_rules) VALUES ($1, $2)", [interaction.guildID, rulesJson]);
            } else {
                await client.query("UPDATE guild_settings SET command_rules = $2 WHERE guild_id = $1", [interaction.guildID, rulesJson]);
            }

            await interaction.createMessage({ content: responseText });

        } catch (err) {
            console.error(err);
            await interaction.createMessage({ content: "❌ Failed to save settings.", flags: 64 });
        } finally {
            client.release();
        }
    },

    // --- AUTOCOMPLETE: Handles the suggestions ---
    async autocomplete(interaction, bot) {
        const focused = interaction.data.options[0].options.find(o => o.focused);
        const input = focused.value.toLowerCase();
        
        // Get list of commands
        const allCommands = getCommandNames(bot);
        
        // Filter based on what user typed
        const filtered = allCommands.filter(name => name.toLowerCase().startsWith(input));
        
        // Return top 25 results
        return filtered.slice(0, 25).map(name => ({
            name: name,
            value: name
        }));
    }
};