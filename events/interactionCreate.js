const Eris = require("eris");

// Cache for stateful commands (Role Creation/Assignment)
const pendingActions = new Map();

module.exports = {
    name: "interactionCreate",
    async execute(interaction, bot) {
        // --- 1. SLASH COMMANDS ---
        if (interaction instanceof Eris.CommandInteraction) {
            const command = bot.commands.get(interaction.data.name);
            if (!command) return;

            try {
                await command.execute(interaction, bot, pendingActions);
            } catch (err) {
                console.error(`Error in /${interaction.data.name}:`, err);
                if (!interaction.acknowledged) {
                    await interaction.createMessage({
                        content: "Command execution error.",
                        flags: 64,
                    });
                }
            }
        }

        // --- 2. AUTOCOMPLETE SUGGESTIONS ---
        else if (interaction instanceof Eris.AutocompleteInteraction) {
            const command = bot.commands.get(interaction.data.name);
            if (!command || !command.autocomplete) return;
            try {
                await command.autocomplete(interaction, bot);
            } catch (err) {
                console.error(`Autocomplete Error:`, err);
            }
        }

        // --- 3. BUTTONS, MENUS & MODALS ---
        // Fix: Check for 'custom_id' instead of using instanceof to avoid crashes
        else if (interaction.data && interaction.data.custom_id) {
            const customId = interaction.data.custom_id;

            // ====================================================
            // ROUTE A: DANGERU SYSTEM (Public Access)
            // ====================================================
            // We check this FIRST so it bypasses the "owner" security check.
            // This allows ANYONE to click the "Write Post" button or submit the modal.
            if (customId.startsWith("dangeru_")) {
                const command = bot.commands.get("dangeru");
                if (command) {
                    try {
                        await command.handleInteraction(interaction, bot);
                    } catch (err) {
                        console.error("Dangeru Error:", err);
                    }
                }
                return;
            }
            if (customId.startsWith("custom_")) {
                const data = pendingActions.get(interaction.member.id);

                // Verify session
                if (!data || data.type !== "custom_overwrite") {
                    return interaction.createMessage({
                        content:
                            "❌ Session expired. Please run `/custom role` again.",
                        flags: 64,
                    });
                }

                const command = bot.commands.get("custom");
                try {
                    await command.handleInteraction(interaction, bot, data);
                } catch (err) {
                    console.error("Custom Role Error:", err);
                }
                return;
            }

            // ====================================================
            // ROUTE B: PERMISSION WIZARD
            // ====================================================
            if (customId.startsWith("perm_")) {
                const command = bot.commands.get("perms");
                if (!command) return;
                try {
                    await command.handleInteraction(interaction, bot);
                } catch (err) {
                    console.error("Perms Logic Error:", err);
                }
                return;
            }
            if (customId.startsWith("audit_")) {
                // 1. Permission Gate (Double check)
                if (!interaction.member.permissions.has("manageRoles")) {
                    return interaction.createMessage({
                        content:
                            "🚫 You do not have permission to use the auditor.",
                        flags: 64,
                    });
                }

                // 2. Load Session
                const data = pendingActions.get(interaction.member.id);

                // If no session exists but they are trying to go Home/Start, allow it.
                // Otherwise, expire.
                if (
                    !data &&
                    customId !== "audit_home" &&
                    !customId.startsWith("audit_")
                ) {
                    return interaction.createMessage({
                        content:
                            "❌ Session expired. Please run `/audit` again.",
                        flags: 64,
                    });
                }

                const command = bot.commands.get("audit");
                try {
                    await command.handleInteraction(
                        interaction,
                        bot,
                        data || {},
                    );
                } catch (err) {
                    console.error("Audit Error:", err);
                }
                return;
            }
            if (customId.startsWith("ghost_")) {
                if (!interaction.member.permissions.has("manageGuild")) {
                    return interaction.createMessage({
                        content: "🚫 You need Manage Server permissions.",
                        flags: 64,
                    });
                }

                const data = pendingActions.get(interaction.member.id);
                // Allow "home" to restart a session if it's generic, or check existence
                if (!data && customId !== "ghost_home") {
                    return interaction.createMessage({
                        content: "❌ Session expired. Run `/ghost` again.",
                        flags: 64,
                    });
                }

                const command = bot.commands.get("ghost");
                try {
                    await command.handleInteraction(
                        interaction,
                        bot,
                        data || {},
                    );
                } catch (err) {
                    console.error("Ghost Error:", err);
                }
                return;
            }

            // ====================================================
            // ROUTE C: GENERIC COMPONENTS (Restricted)
            // ====================================================
            const parts = customId.split("|");
            const actionType = parts[0];
            const ownerId = parts[1];

            // Security: Only the command runner can click these specific buttons
            // (e.g., Help menu, Role setup). Dangeru is already handled above.
            if (interaction.member.id !== ownerId) {
                return interaction.createMessage({
                    content: "This isn't your interaction.",
                    flags: 64,
                });
            }

            // --- ROUTER C1: STATELESS ACTIONS ---
            if (
                [
                    "help_nav",
                    "help_select",
                    "help_jump",
                    "menu_nav",
                    "menu_select",
                ].includes(actionType)
            ) {
                try {
                    if (actionType.startsWith("help")) {
                        await require("../commands/help.js").handleInteraction(
                            interaction,
                            bot,
                            ownerId,
                        );
                    } else {
                        await require("../commands/menu.js").handleInteraction(
                            interaction,
                            bot,
                            ownerId,
                        );
                    }
                    return;
                } catch (err) {
                    console.error("Interaction Error:", err);
                    return interaction.createMessage({
                        content: "Menu error.",
                        flags: 64,
                    });
                }
            }

            // --- ROUTER C2: STATEFUL ACTIONS ---
            if (actionType === "cancel") {
                pendingActions.delete(interaction.member.id);
                return interaction.editParent({
                    content: "Action cancelled.",
                    embeds: [],
                    components: [],
                });
            }

            const data = pendingActions.get(interaction.member.id);
            if (!data) {
                return interaction.editParent({
                    content:
                        "❌ Session expired. Please run the command again.",
                    embeds: [],
                    components: [],
                });
            }

            try {
                const roleCommand = require("../commands/role.js");
                if (actionType === "confirm_role_create") {
                    await roleCommand.onConfirmCreate(interaction, bot, data);
                } else if (actionType === "confirm_assign_role") {
                    await roleCommand.onConfirmAssign(interaction, bot, data);
                }
                pendingActions.delete(interaction.member.id);
            } catch (err) {
                console.error("Button Error:", err);
                await interaction.createMessage({
                    content: "Action failed.",
                    flags: 64,
                });
            }
        }
    },
};
