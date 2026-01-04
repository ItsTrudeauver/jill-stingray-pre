const { db } = require('../utils/db');
const DEFAULT_RULES = require('../utils/default');
const PROTECTED_MODULES = ['dashboard', 'help'];

module.exports = {
    // 1. Properties at the ROOT level (No 'data' wrapper)
    name: 'dashboard',
    description: 'Configure which bot modules are enabled in this server.',
    type: 1, // Slash Command
    default_member_permissions: "32", // 'Manage Guild' permission bit

    // 2. The execution entry point (Check if your other commands use 'execute' or 'run')
    async execute(interaction) {
        await this.renderDashboard(interaction);
    },

    async renderDashboard(interaction, update = false) {
        const client = await db.connect();
        try {
            // Fetch bot commands (Adjust path if 'interaction.client' is different in your handler)
            const botInstance = interaction.channel?.client || interaction.client; 
            const botCommands = botInstance.commands;

            // Filter out protected modules
            const validCommands = Array.from(botCommands.values()).filter(cmd => 
                !PROTECTED_MODULES.includes(cmd.name) // Changed cmd.data.name to cmd.name
            );

            // Fetch DB settings
            const res = await client.query("SELECT command_rules FROM guild_settings WHERE guild_id = $1", [interaction.guildID]);
            let dbRules = res.rows[0]?.command_rules || {};

            // Merge defaults
            const currentRules = { ...DEFAULT_RULES };
            Object.keys(dbRules).forEach(key => {
                if (currentRules[key]) {
                    currentRules[key].enabled = dbRules[key].enabled;
                }
            });

            // Build Options
            const options = validCommands.map(cmd => {
                const name = cmd.name; // Changed cmd.data.name to cmd.name
                const isEnabled = currentRules[name] ? currentRules[name].enabled : true;
                
                let desc = cmd.description || 'No description provided.';
                if (desc.length > 100) desc = desc.substring(0, 97) + '...';

                return {
                    label: name.charAt(0).toUpperCase() + name.slice(1),
                    value: name,
                    description: desc,
                    emoji: { name: isEnabled ? '🟢' : '🔴' },
                    default: isEnabled
                };
            });

            options.sort((a, b) => a.label.localeCompare(b.label));
            const safeOptions = options.slice(0, 25);

            const payload = {
                embeds: [{
                    title: '🎛️ Dynamic Server Dashboard',
                    description: 'Select modules to enable/disable.\nDescriptions are pulled automatically from command files.',
                    color: 0x2b2d31,
                    footer: { text: `Total Modules: ${validCommands.length} | Showing: ${safeOptions.length}` }
                }],
                components: [{
                    type: 1, 
                    components: [{
                        type: 3, // String Select Menu
                        custom_id: 'dashboard_select',
                        placeholder: 'Select active modules...',
                        min_values: 0,
                        max_values: safeOptions.length,
                        options: safeOptions
                    }]
                }]
            };

            if (update) {
                await interaction.editOriginalMessage(payload);
            } else {
                await interaction.createMessage(payload);
            }

        } catch (err) {
            console.error(err);
            const errPayload = { content: '❌ A database error occurred.', flags: 64 };
            if (update) await interaction.createFollowup(errPayload);
            else await interaction.createMessage(errPayload);
        } finally {
            client.release();
        }
    },

    async handleSelect(interaction) {
        const selectedModules = interaction.data.values; 
        const client = await db.connect();

        try {
            const res = await client.query("SELECT command_rules FROM guild_settings WHERE guild_id = $1", [interaction.guildID]);
            let rules = res.rows[0]?.command_rules || {};

            const botInstance = interaction.channel?.client || interaction.client;
            const botCommands = botInstance.commands;
            
            const validCommands = Array.from(botCommands.values()).filter(cmd => 
                !PROTECTED_MODULES.includes(cmd.name)
            );

            // Re-slice to ensure we toggle only what was visible
            const options = validCommands.map(c => c.name).sort(); 
            const visibleCommandNames = options.slice(0, 25);

            visibleCommandNames.forEach(name => {
                if (!rules[name]) rules[name] = { enabled: true, ...DEFAULT_RULES[name] };

                // If selected -> Enabled. If NOT selected -> Disabled.
                if (selectedModules.includes(name)) {
                    rules[name].enabled = true;
                } else {
                    rules[name].enabled = false;
                }
            });

            const rulesJson = JSON.stringify(rules);
            
            if (res.rowCount === 0) {
                await client.query("INSERT INTO guild_settings (guild_id, command_rules) VALUES ($1, $2)", [interaction.guildID, rulesJson]);
            } else {
                await client.query("UPDATE guild_settings SET command_rules = $2 WHERE guild_id = $1", [interaction.guildID, rulesJson]);
            }

            await interaction.deferUpdate();
            await this.renderDashboard(interaction, true);

        } catch (err) {
            console.error(err);
            await interaction.createMessage({ content: 'Failed to save settings.', flags: 64 });
        } finally {
            client.release();
        }
    }
};