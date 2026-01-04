const Eris = require("eris");
const { db } = require("../utils/db");
const { DEFAULT_RULES } = require("../utils/defaults");

// Cache for stateful commands (Role Creation/Assignment wizards)
const pendingActions = new Map();

module.exports = {
    name: "interactionCreate",
    async execute(interaction, bot) {
        
        // ====================================================
        // 1. SLASH COMMANDS (With Security Gatekeeper)
        // ====================================================
        if (interaction instanceof Eris.CommandInteraction) {
            const cmdName = interaction.data.name;
            const command = bot.commands.get(cmdName);
            if (!command) return;

            // --- GATEKEEPER: START ---
            // Checks DB rules before letting the command run
            try {
                // 1. Fetch Guild Rules & Admin Role
                const res = await db.query(
                    "SELECT command_rules, admin_role_id FROM guild_settings WHERE guild_id = $1", 
                    [interaction.guildID]
                );
                
                // 2. Merge DB rules with Defaults
                const dbRules = res.rows[0]?.command_rules || {};
                const rules = { ...DEFAULT_RULES, ...dbRules };
                const rule = rules[cmdName];
                const adminRole = res.rows[0]?.admin_role_id;

                if (rule) {
                    // A. Wholesale Disable (except Dashboard, to prevent lockout)
                    if (rule.enabled === false && cmdName !== "dashboard") {
                        return interaction.createMessage({ 
                            content: "🚫 **Disabled:** This command is globally disabled on this server.", 
                            flags: 64 
                        });
                    }

                    // B. Channel Whitelist (Only allow in specific channels)
                    if (rule.allow_channels && rule.allow_channels.length > 0) {
                        if (!rule.allow_channels.includes(interaction.channel.id)) {
                            return interaction.createMessage({ 
                                content: `🚫 **Restricted:** This command can only be used in <#${rule.allow_channels[0]}>.`, 
                                flags: 64 
                            });
                        }
                    }

                    // C. Channel Blacklist (Block in specific channels)
                    if (rule.block_channels && rule.block_channels.includes(interaction.channel.id)) {
                        return interaction.createMessage({ 
                            content: "🚫 **Restricted:** This command is blocked in this channel.", 
                            flags: 64 
                        });
                    }

                    // D. Permission Check
                    // Admins and "Bot Managers" bypass this check
                    const isManager = adminRole && interaction.member.roles.includes(adminRole);
                    const isAdmin = interaction.member.permissions.has("administrator");

                    if (!isAdmin && !isManager && rule.min_perm) {
                        if (!interaction.member.permissions.has(rule.min_perm)) {
                            return interaction.createMessage({ 
                                content: `🚫 **Access Denied:** You need the \`${rule.min_perm}\` permission.`, 
                                flags: 64 
                            });
                        }
                    }
                }
            } catch (err) {
                console.error("Gatekeeper Error:", err);
                // We don't return here; if DB fails, we default to allowing execution 
                // (or you could block it if you prefer strict security fail-safes)
            }
            // --- GATEKEEPER: END ---

            // Execute the Command
            try {
                await command.execute(interaction, bot, pendingActions);
            } catch (err) {
                console.error(`Error in /${cmdName}:`, err);
                if (!interaction.acknowledged) {
                    await interaction.createMessage({ content: "❌ Command execution error.", flags: 64 });
                }
            }
        }

        // ====================================================
        // 2. AUTOCOMPLETE SUGGESTIONS
        // ====================================================
        else if (interaction instanceof Eris.AutocompleteInteraction) {
            const command = bot.commands.get(interaction.data.name);
            if (!command || !command.autocomplete) return;
            try {
                await command.autocomplete(interaction, bot);
            } catch (err) {
                console.error(`Autocomplete Error:`, err);
            }
        }

        // ====================================================
        // 3. BUTTONS, MENUS & MODALS
        // ====================================================
        else if (interaction.data && interaction.data.custom_id) {
            const id = interaction.data.custom_id;

            // --- A. NEW ROUTERS (Dashboard / Dangeru / Triggers) ---
            
            // Dashboard Handler (e.g., dash_home, dash_toggle_mix)
            if (id.startsWith("dash_") || id === "dash_launch_intro") {
                const cmd = bot.commands.get("dashboard");
                if (cmd) await cmd.handleInteraction(interaction, bot);
                return;
            }

            // Dangeru Handler (e.g., dangeru_page_1)
            if (id.startsWith("dangeru_")) {
                const cmd = bot.commands.get("dangeru");
                if (cmd) await cmd.handleInteraction(interaction, bot);
                return;
            }

            // Trigger Handler (e.g., trig_page_2)
            if (id.startsWith("trig_")) {
                const cmd = bot.commands.get("trigger");
                if (cmd) await cmd.handleInteraction(interaction, bot);
                return;
            }

            // --- B. EXISTING STATEFUL ACTIONS (Role Wizard) ---
            
            // Check if this is a "Cancel" action or involves "pendingActions" logic
            // Note: Your snippet implies 'actionType' was derived from splitting logic, 
            // but standardizing on custom_id prefixes is safer.
            // Assuming your role buttons look like "confirm_role_create" or "cancel"
            
            if (id === "cancel") {
                pendingActions.delete(interaction.member.id);
                return interaction.editParent({
                    content: "Action cancelled.",
                    embeds: [],
                    components: []
                });
            }

            // If we have a pending session for this user
            const data = pendingActions.get(interaction.member.id);
            
            // Logic for Role Wizard confirmations
            if (id === "confirm_role_create" || id === "confirm_assign_role") {
                if (!data) {
                    return interaction.editParent({
                        content: "❌ Session expired. Please run the command again.",
                        embeds: [],
                        components: []
                    });
                }

                try {
                    // We load the 'role' command dynamically as per your original code
                    const roleCommand = require("../commands/role.js"); 
                    
                    if (id === "confirm_role_create") {
                        await roleCommand.onConfirmCreate(interaction, bot, data);
                    } else if (id === "confirm_assign_role") {
                        await roleCommand.onConfirmAssign(interaction, bot, data);
                    }
                    
                    // Cleanup after success
                    pendingActions.delete(interaction.member.id);
                } catch (err) {
                    console.error("Button Error:", err);
                    await interaction.createMessage({ content: "Action failed.", flags: 64 });
                }
                return;
            }

            // --- C. CUSTOM ROLE HANDLER (If separate from Role Wizard) ---
            if (id.startsWith("custom_")) {
                const cmd = bot.commands.get("custom");
                if (cmd && cmd.handleInteraction) {
                    await cmd.handleInteraction(interaction, bot, pendingActions);
                }
            }
        }
    },
};