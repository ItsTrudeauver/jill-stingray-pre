const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, PermissionFlagsBits } = require('discord.js');
const { pool } = require('../utils/db');
const DEFAULT_RULES = require('../utils/default');

// Modules that cannot be disabled to prevent lockout
const PROTECTED_MODULES = ['dashboard', 'help'];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('dashboard')
        .setDescription('Configure which bot modules are enabled in this server.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    async execute(interaction) {
        await this.renderDashboard(interaction);
    },

    async renderDashboard(interaction, update = false) {
        const client = await pool.connect();
        try {
            // 1. Fetch real-time commands from the bot's internal collection
            // We filter out commands that shouldn't be toggled (protected ones)
            const botCommands = interaction.client.commands.filter(cmd => 
                !PROTECTED_MODULES.includes(cmd.data.name)
            );

            // 2. Fetch current settings from DB
            const res = await client.query("SELECT command_rules FROM guild_settings WHERE guild_id = $1", [interaction.guildId]);
            let dbRules = res.rows[0]?.command_rules || {};

            // 3. Prepare the rules object
            // If a command is in the bot but not in DB (newly added), we treat it as enabled by default (or check DEFAULT_RULES)
            // If a command is in DB but removed from bot, we ignore it.
            const currentRules = { ...DEFAULT_RULES };
            
            // Sync DB rules
            Object.keys(dbRules).forEach(key => {
                if (currentRules[key]) {
                    currentRules[key].enabled = dbRules[key].enabled;
                }
            });

            // 4. Build Options Dynamically
            // We map over the ACTUAL loaded commands, not a hardcoded list.
            const options = botCommands.map(cmd => {
                const name = cmd.data.name;
                
                // Check if enabled (Default to true if not found in rules)
                const isEnabled = currentRules[name] ? currentRules[name].enabled : true;
                
                // Get description directly from the command file
                let desc = cmd.data.description || 'No description provided.';
                
                // Discord limits descriptions to 100 chars
                if (desc.length > 100) desc = desc.substring(0, 97) + '...';

                return new StringSelectMenuOptionBuilder()
                    .setLabel(name.charAt(0).toUpperCase() + name.slice(1))
                    .setDescription(desc)
                    .setValue(name)
                    .setEmoji(isEnabled ? '🟢' : '🔴')
                    .setDefault(isEnabled);
            });

            // Sort options alphabetically for easier finding
            options.sort((a, b) => a.data.label.localeCompare(b.data.label));

            // Handle Discord's 25-option limit for a single menu
            // (If you have >25 commands, we might need a second page, but this slices the top 25)
            const safeOptions = options.slice(0, 25);

            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('dashboard_select')
                .setPlaceholder('Select active modules...')
                .setMinValues(0)
                .setMaxValues(safeOptions.length)
                .addOptions(safeOptions);

            const row = new ActionRowBuilder().addComponents(selectMenu);

            const embed = new EmbedBuilder()
                .setColor('#2b2d31')
                .setTitle('🎛️ Dynamic Server Dashboard')
                .setDescription('Select modules to enable/disable.\nDescriptions are pulled automatically from command files.')
                .setFooter({ text: `Total Modules: ${botCommands.size} | Showing: ${safeOptions.length}` });

            const payload = { embeds: [embed], components: [row] };

            if (update) await interaction.update(payload);
            else await interaction.reply(payload);

        } catch (err) {
            console.error(err);
            const errPayload = { content: '❌ Error loading dashboard.', ephemeral: true };
            if (update) await interaction.followUp(errPayload);
            else await interaction.reply(errPayload);
        } finally {
            client.release();
        }
    },

    async handleSelect(interaction) {
        if (interaction.customId !== 'dashboard_select') return;

        const selectedModules = interaction.values; 
        const client = await pool.connect();

        try {
            // Get current DB state
            const res = await client.query("SELECT command_rules FROM guild_settings WHERE guild_id = $1", [interaction.guildId]);
            let rules = res.rows[0]?.command_rules || {};

            // We need to look at ALL commands available in the menu to decide what was unchecked.
            // (Only commands visible in the menu can be toggled here)
            const botCommands = interaction.client.commands.filter(cmd => 
                !PROTECTED_MODULES.includes(cmd.data.name)
            );
            
            // Sort them exactly as we did in render to ensure we are matching the slice (if >25)
            // Note: If you have >25 commands, this simple slice logic might miss saving hidden ones. 
            // For <25 commands, this is perfectly safe.
            const sortedCommands = [...botCommands.values()].sort((a, b) => 
                a.data.name.localeCompare(b.data.name)
            );
            const visibleCommands = sortedCommands.slice(0, 25);

            // Update rules
            visibleCommands.forEach(cmd => {
                const name = cmd.data.name;
                
                // Init rule if missing
                if (!rules[name]) rules[name] = { enabled: true, ...DEFAULT_RULES[name] };

                // If it's in the selection, it's ENABLED. If not, it's DISABLED.
                if (selectedModules.includes(name)) {
                    rules[name].enabled = true;
                } else {
                    rules[name].enabled = false;
                }
            });

            // Save to DB
            const rulesJson = JSON.stringify(rules);
            if (res.rowCount === 0) {
                await client.query("INSERT INTO guild_settings (guild_id, command_rules) VALUES ($1, $2)", [interaction.guildId, rulesJson]);
            } else {
                await client.query("UPDATE guild_settings SET command_rules = $2 WHERE guild_id = $1", [interaction.guildId, rulesJson]);
            }

            await this.renderDashboard(interaction, true);

        } catch (err) {
            console.error(err);
            await interaction.reply({ content: 'Failed to save settings.', ephemeral: true });
        } finally {
            client.release();
        }
    }
};