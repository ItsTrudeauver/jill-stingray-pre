const { db } = require('../utils/db');
const DEFAULT_RULES = require('../utils/default');
const PROTECTED_MODULES = ['dashboard', 'help'];

module.exports = {
    name: 'dashboard',
    description: 'Configure which bot modules are enabled in this server.',
    type: 1, 
    default_member_permissions: "32", // Manage Guild

    // --- 1. Main Slash Command ---
    async execute(interaction) {
        try {
            // Generate the dashboard view
            const payload = await this.getDashboardPayload(interaction);
            // Send it as a new message
            await interaction.createMessage(payload);
        } catch (err) {
            console.error(err);
            await interaction.createMessage({ content: "❌ Error loading dashboard.", flags: 64 });
        }
    },

    // --- 2. Dropdown Interaction Handler ---
    async handleSelect(interaction) {
        const client = await db.connect();
        try {
            const selectedModules = interaction.data.values; // What the user checked
            const guildID = interaction.guildID;

            // A. Fetch current rules
            const res = await client.query("SELECT command_rules FROM guild_settings WHERE guild_id = $1", [guildID]);
            let rules = res.rows[0]?.command_rules || {};

            // B. Determine available commands (to know what was UNCHECKED)
            const botInstance = interaction.channel?.client || interaction.client;
            // Filter commands exactly like we do in the view
            const validCommands = Array.from(botInstance.commands.values()).filter(cmd => 
                !PROTECTED_MODULES.includes(cmd.name)
            );
            
            // Sort to match the menu order (Crucial for the slice logic)
            const sortedCommandNames = validCommands.map(c => c.name).sort();
            
            // Only update the commands that were actually visible in the menu (Top 25)
            const visibleCommandNames = sortedCommandNames.slice(0, 25);

            // C. Update Logic
            visibleCommandNames.forEach(name => {
                // Ensure default exists
                if (!rules[name]) rules[name] = { enabled: true, ...DEFAULT_RULES[name] };

                // If name is in the selection -> ENABLED. If not -> DISABLED.
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
            // We pass 'client' to reuse the DB connection we already have open
            const payload = await this.getDashboardPayload(interaction, client);
            
            // USE editParent: This acknowledges the click AND updates the message instantly.
            await interaction.editParent(payload);

        } catch (err) {
            console.error(err);
            // If something broke, try to tell the user ephemerally
            try {
                await interaction.createMessage({ content: "❌ Failed to update settings.", flags: 64 });
            } catch (e) { }
        } finally {
            client.release();
        }
    },

    // --- 3. View Generator (Reusable) ---
    async getDashboardPayload(interaction, externalDbClient = null) {
        let client;
        let shouldRelease = false;

        // Reuse DB connection if provided, otherwise open a new one
        if (externalDbClient) {
            client = externalDbClient;
        } else {
            client = await db.connect();
            shouldRelease = true;
        }

        try {
            const botInstance = interaction.channel?.client || interaction.client;
            
            // 1. Get Commands
            const validCommands = Array.from(botInstance.commands.values()).filter(cmd => 
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
                    default: isEnabled // This checks the box if enabled
                };
            });

            // Sort & Slice
            options.sort((a, b) => a.label.localeCompare(b.label));
            const safeOptions = options.slice(0, 25);

            // 5. Return JSON Payload
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
                        custom_id: 'dashboard_select',
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