const { pool } = require('../utils/db');
const DEFAULT_RULES = require('../utils/default');
const PROTECTED_MODULES = ['dashboard', 'help'];

module.exports = {
    // Eris uses raw JSON for command data
    data: {
        name: 'dashboard',
        description: 'Configure which bot modules are enabled in this server.',
        default_member_permissions: "32" // 'Manage Guild' permission bit
    },

    async execute(interaction) {
        await this.renderDashboard(interaction);
    },

    async renderDashboard(interaction, update = false) {
        const client = await pool.connect();
        try {
            // 1. Get commands from the client
            // In Eris, client is usually accessible via the interaction
            const botInstance = interaction.channel.client || interaction.client; 
            const botCommands = botInstance.commands; // Assuming you attached commands here in index.js

            // 2. Filter out protected modules
            const validCommands = Array.from(botCommands.values()).filter(cmd => 
                !PROTECTED_MODULES.includes(cmd.data.name)
            );

            // 3. Fetch DB settings
            const res = await client.query("SELECT command_rules FROM guild_settings WHERE guild_id = $1", [interaction.guildID]);
            let dbRules = res.rows[0]?.command_rules || {};

            // 4. Merge defaults
            const currentRules = { ...DEFAULT_RULES };
            Object.keys(dbRules).forEach(key => {
                if (currentRules[key]) {
                    currentRules[key].enabled = dbRules[key].enabled;
                }
            });

            // 5. Build Options (Raw JSON for Eris)
            const options = validCommands.map(cmd => {
                const name = cmd.data.name;
                const isEnabled = currentRules[name] ? currentRules[name].enabled : true;
                
                // Get description (truncate to 100 chars)
                let desc = cmd.data.description || 'No description provided.';
                if (desc.length > 100) desc = desc.substring(0, 97) + '...';

                return {
                    label: name.charAt(0).toUpperCase() + name.slice(1),
                    value: name,
                    description: desc,
                    emoji: { name: isEnabled ? '🟢' : '🔴' },
                    default: isEnabled
                };
            });

            // Sort alphabetical
            options.sort((a, b) => a.label.localeCompare(b.label));

            // Slice to 25 limit
            const safeOptions = options.slice(0, 25);

            // 6. Construct Response Payload
            const payload = {
                embeds: [{
                    title: '🎛️ Dynamic Server Dashboard',
                    description: 'Select modules to enable/disable.\nDescriptions are pulled automatically from command files.',
                    color: 0x2b2d31, // Hex integer
                    footer: { text: `Total Modules: ${validCommands.length} | Showing: ${safeOptions.length}` }
                }],
                components: [{
                    type: 1, // Action Row
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

    // Handle the Interaction
    async handleSelect(interaction) {
        // Eris Select Menu interactions usually have 'data.values'
        const selectedModules = interaction.data.values; 
        const client = await pool.connect();

        try {
            const res = await client.query("SELECT command_rules FROM guild_settings WHERE guild_id = $1", [interaction.guildID]);
            let rules = res.rows[0]?.command_rules || {};

            // Get available commands to check against
            const botInstance = interaction.channel.client || interaction.client;
            const botCommands = botInstance.commands;

            const validCommands = Array.from(botCommands.values()).filter(cmd => 
                !PROTECTED_MODULES.includes(cmd.data.name)
            );

            // Sort and slice exactly like render to match the menu visibility
            const options = validCommands.map(c => c.data.name).sort(); 
            const visibleCommandNames = options.slice(0, 25); // Only update visible ones

            visibleCommandNames.forEach(name => {
                // Init rule if missing
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

            // Acknowledge interaction (required in Eris to prevent "Interaction Failed")
            await interaction.deferUpdate();
            
            // Re-render
            await this.renderDashboard(interaction, true);

        } catch (err) {
            console.error(err);
            await interaction.createMessage({ content: 'Failed to save settings.', flags: 64 });
        } finally {
            client.release();
        }
    }
};