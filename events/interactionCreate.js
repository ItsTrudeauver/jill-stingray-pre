const Eris = require("eris");
const { db } = require("../utils/db");
const { DEFAULT_RULES } = require("../utils/default");

// Cache for stateful commands (Role Creation/Assignment/Wizards)
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
            try {
                // 1. Fetch Guild Rules & Admin Role from Postgres
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
                    // A. Wholesale Disable 
                    // CRITICAL: Bypass check for 'config' and 'dashboard' to prevent lockout
                    if (rule.enabled === false && cmdName !== "dashboard" && cmdName !== "config") {
                        return interaction.createMessage({ 
                            content: "🚫 **Disabled:** This command is globally disabled on this server.", 
                            flags: 64 
                        });
                    }

                    // B. Channel Whitelist
                    if (rule.allow_channels?.length > 0) {
                        if (!rule.allow_channels.includes(interaction.channel.id)) {
                            return interaction.createMessage({ 
                                content: `🚫 **Restricted:** This command can only be used in <#${rule.allow_channels[0]}>.`, 
                                flags: 64 
                            });
                        }
                    }

                    // C. Channel Blacklist
                    if (rule.block_channels?.includes(interaction.channel.id)) {
                        return interaction.createMessage({ 
                            content: "🚫 **Restricted:** This command is blocked in this channel.", 
                            flags: 64 
                        });
                    }

                    // D. Permission Check (Bypass for Server Admins and Designated Bot Managers)
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
                // If DB fails, we proceed with execution as a safety fail-open
            }
            // --- GATEKEEPER: END ---

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
                // 1. Get the choices from the command
                const choices = await command.autocomplete(interaction, bot);
                // 2. Send them back to Discord (CRITICAL STEP)
                return interaction.result(choices);
            } catch (err) {
                console.error(`Autocomplete Error:`, err);
            }
        }

        // ====================================================
        // 3. BUTTONS, MENUS & MODALS
        // ====================================================
        else if (interaction.data && interaction.data.custom_id) {

            const customId = interaction.data.custom_id;

            // --- ROUTE A: SYSTEM ROUTERS ---
            // System Diagnostics (From Guild Join)
            if (customId === "sys_verify_roles") {
                // Determine if we need to edit or reply
                // We re-import the generator logic to re-check specific to this guild
                const guildCreate = require("./guildCreate");
                const payload = await guildCreate.generateWelcomePayload(interaction.channel.guild, bot);
                
                // Update the message with new status
                return interaction.editParent(payload);
            }
            // Config Overview Pagination (NEW)
            if (customId.startsWith("config_page_")) {
                const cmd = bot.commands.get("config");
                if (cmd) await cmd.handleButton(interaction, bot);
                return;
            }

            // Dangeru System (Anonymous Posting)
            if (customId.startsWith("dangeru_")) {
                const cmd = bot.commands.get("dangeru");
                if (cmd) await cmd.handleInteraction(interaction, bot);
                return;
            }

            // Dashboard (Legacy) & Trigger Management
            if (customId.startsWith("dash_") || customId.startsWith("trig_") || customId === "dashboard_select") {
                const cmdName = customId.startsWith("trig_") ? "trigger" : "dashboard";
                const cmd = bot.commands.get(cmdName);
                if (cmd) await cmd.handleInteraction(interaction, bot);
                return;
            }

            // Permission/Setup Wizards
            if (customId.startsWith("perm_")) {
                const cmd = bot.commands.get("perms");
                if (cmd) await cmd.handleInteraction(interaction, bot);
                return;
            }

            // --- ROUTE B: SESSION-BASED ACTIONS ---

            // Custom Role Overwrite
            if (customId.startsWith("custom_")) {
                const data = pendingActions.get(interaction.member.id);
                if (!data || data.type !== "custom_overwrite") {
                    return interaction.createMessage({ content: "❌ Session expired. Run `/custom role` again.", flags: 64 });
                }
                const cmd = bot.commands.get("custom");
                if (cmd) await cmd.handleInteraction(interaction, bot, data);
                return;
            }

            // Auditor System
            if (customId.startsWith("audit_")) {
                if (!interaction.member.permissions.has("manageRoles")) {
                    return interaction.createMessage({ content: "🚫 Permission denied.", flags: 64 });
                }
                const data = pendingActions.get(interaction.member.id);
                if (!data && customId !== "audit_home") {
                    return interaction.createMessage({ content: "❌ Session expired. Run `/audit` again.", flags: 64 });
                }
                const cmd = bot.commands.get("audit");
                if (cmd) await cmd.handleInteraction(interaction, bot, data || {});
                return;
            }

            // Ghost Command
            if (customId.startsWith("ghost_")) {
                if (!interaction.member.permissions.has("manageGuild")) {
                    return interaction.createMessage({ content: "🚫 Permission denied.", flags: 64 });
                }
                const data = pendingActions.get(interaction.member.id);
                if (!data && customId !== "ghost_home") {
                    return interaction.createMessage({ content: "❌ Session expired. Run `/ghost` again.", flags: 64 });
                }
                const cmd = bot.commands.get("ghost");
                if (cmd) await cmd.handleInteraction(interaction, bot, data || {});
                return;
            }

            // --- ROUTE C: GENERIC COMPONENTS (Owner-Locked) ---
            
            const parts = customId.split("|");
            const actionType = parts[0];
            const ownerId = parts[1];

            // Security: Prevents users from clicking buttons on someone else's /help or /menu
            if (ownerId && interaction.member.id !== ownerId) {
                return interaction.createMessage({ content: "🍸 This isn't your drink to stir. Run the command yourself!", flags: 64 });
            }

            // 1. Stateless Menus (Help/Menu)
            if (["help_nav", "help_select", "help_jump", "menu_nav", "menu_select"].includes(actionType)) {
                try {
                    const filePath = actionType.startsWith("help") ? "../commands/help.js" : "../commands/menu.js";
                    await require(filePath).handleInteraction(interaction, bot, ownerId);
                } catch (err) {
                    console.error("Menu Interaction Error:", err);
                }
                return;
            }

            // 2. Stateful Role Wizards (Confirm/Cancel)
            if (actionType === "cancel") {
                pendingActions.delete(interaction.member.id);
                return interaction.editParent({ content: "Action cancelled.", embeds: [], components: [] });
            }

            if (actionType === "confirm_role_create" || actionType === "confirm_assign_role") {
                const data = pendingActions.get(interaction.member.id);
                if (!data) return interaction.editParent({ content: "❌ Session expired.", embeds: [], components: [] });

                try {
                    const roleCommand = require("../commands/role.js");
                    if (actionType === "confirm_role_create") await roleCommand.onConfirmCreate(interaction, bot, data);
                    else await roleCommand.onConfirmAssign(interaction, bot, data);
                    pendingActions.delete(interaction.member.id);
                } catch (err) {
                    console.error("Role Wizard Error:", err);
                }
                return;
            }
        }
    },
};