const { db } = require('../utils/db');
const DEFAULT_RULES = require('../utils/default');
const PROTECTED_MODULES = ['dashboard', 'help'];

module.exports = {
    name: 'dashboard',
    description: 'Configure which bot modules are enabled in this server.',
    type: 1, 
    default_member_permissions: "32", // Manage Guild

    // --- 1. Main Slash Command ---
    async execute(interaction, bot) { // Added 'bot' param
        try {
            const payload = await this.getDashboardPayload(interaction, bot);
            await interaction.createMessage(payload);
        } catch (err) {
            console.error(err);
            await interaction.createMessage({ content: "❌ Error loading dashboard.", flags: 64 });
        }
    },

    // --- 2. Interaction Handler (Renamed from handleSelect) ---
    async handleInteraction(interaction, bot) {
        // Double check it's the right interaction
        if (interaction.data.custom_id !== 'dashboard_select') return;

        const client = await db.connect();
        try {
            const selectedModules = interaction.data.values; 
            const guildID = interaction.guildID;

            // A. Fetch current rules
            const res = await client.query("SELECT command_rules FROM guild_settings WHERE guild_id = $1", [guildID]);
            let rules = res.rows[0]?.command_rules || {};

            // B. Determine available commands
            // Filter commands exactly like we do in the view
            const validCommands = Array.from(bot.commands.values()).filter(cmd => 
                !PROTECTED_MODULES.includes(cmd.name)
            );
            
            // Sort to match the menu order
            const sortedCommandNames = validCommands.map(c => c.name).sort();
            
            // Only update the commands that were actually visible in the menu (Top 25)
            const visibleCommandNames = sortedCommandNames.slice(0, 25);

            // C. Update Logic
            visibleCommandNames.forEach(name => {
                if (!rules[name]) rules[name] = { enabled: true, ...DEFAULT_RULES[name] };

                if (selectedModules.includes(name)) {
                    rules[name].enabled = true;
                } else {
                    rules[name].enabled = false;
                }
            });

            // D. Save to DB
            const rulesJson = JSON.stringify(rules);
            if (res.rowCount === 0) {
                await client.query("INSERT INTO guild_settings (guild_id, command_rules) VALUES ($1, $2)", [guildID, rulesJson]);
            } else {
                await client.query("UPDATE guild_settings SET command_rules = $2 WHERE guild_id = $1", [guildID, rulesJson]);
            }

            // E. Refresh the Dashboard View
            const payload = await this.getDashboardPayload(interaction, bot, client);
            
            // Acknowledge + Update in one go
            await interaction.editParent(payload);

        } catch (err) {
            console.error(err);
            try {
                await interaction.createMessage({ content: "❌ Failed to update settings.", flags: 64 });
            } catch (e) { }
        } finally {
            client.release();
        }
    },

    // --- 3. View Generator ---
    async getDashboardPayload(interaction, bot, externalDbClient = null) {
        let client;
        let shouldRelease = false;

        if (externalDbClient) {
            client = externalDbClient;
        } else {
            client = await db.connect();
            shouldRelease = true;
        }

        try {
            // 1. Get Commands
            const validCommands = Array.from(bot.commands.values()).filter(cmd => 
                !PROTECTED_MODULES.includes(cmd.name)
            );

            // 2. Get Rules
            const res = await client.query("SELECT command_rules FROM guild_settings WHERE guild_id = $1", [interaction.guildID]);
            let dbRules = res.rows[0]?.command_rules || {};

            // 3. Merge Defaults
            const currentRules = { ...DEFAULT_RULES };
            Object.keys(dbRules).forEach(key => {
                if (currentRules[key]) {
                    currentRules[key].enabled = dbRules[key].enabled;
                }
            });

            // 4. Build Options
            const options = validCommands.map(cmd => {
                const name = cmd.name;
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

            // Sort & Slice
            options.sort((a, b) => a.label.localeCompare(b.label));
            const safeOptions = options.slice(0, 25);

            return {
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
                        custom_id: 'dashboard_select', // Starts with 'dash_'
                        placeholder: 'Select active modules...',
                        min_values: 0,
                        max_values: safeOptions.length,
                        options: safeOptions
                    }]
                }]
            };

        } finally {
            if (shouldRelease) client.release();
        }
    }
};