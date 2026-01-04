const { db } = require("../utils/db");

// Local state cache to handle button confirmations
const pendingActions = new Map();

module.exports = {
    name: "custom",
    description: "Manage your personal custom role.",
    options: [
        {
            name: "role",
            description: "Create or replace your personal custom role.",
            type: 1, // SUB_COMMAND
            options: [
                {
                    name: "name",
                    description: "The name of your role.",
                    type: 3, // String
                    required: true,
                },
                {
                    name: "hex",
                    description: "The color hex code (e.g. FF0055).",
                    type: 3, // String
                    required: true,
                },
            ],
        },
    ],

    async execute(interaction, bot) {
        const sub = interaction.data.options[0];
        if (sub.name !== "role") return;

        const name = sub.options.find((o) => o.name === "name").value;
        let hex = sub.options.find((o) => o.name === "hex").value.replace("#", "");

        // Validate Hex
        if (!/^[0-9A-F]{6}$/i.test(hex)) {
            return interaction.createMessage({
                content: "❌ **Invalid Color.** Please use a valid 6-digit Hex code (e.g., `00FF00`).",
                flags: 64,
            });
        }
        const colorInt = parseInt(hex, 16);
        const userId = interaction.member.id;
        const guildId = interaction.guildID;

        // 1. Check DB for existing role
        const res = await db.query(
            "SELECT role_id FROM custom_roles WHERE guild_id = $1 AND user_id = $2",
            [guildId, userId]
        );
        const existingRoleEntry = res.rows[0];

        if (existingRoleEntry) {
            // Verify if role actually exists in guild (might have been manually deleted)
            const guild = bot.guilds.get(guildId);
            const roleExistsInGuild = guild && guild.roles.has(existingRoleEntry.role_id);

            if (roleExistsInGuild) {
                // Store state for the button interaction
                pendingActions.set(userId, {
                    type: "custom_overwrite",
                    newName: name,
                    newColor: colorInt,
                    oldRoleId: existingRoleEntry.role_id
                });

                return interaction.createMessage({
                    embeds: [
                        {
                            title: "Identity Conflict",
                            description: "You already have a registered custom role.\nDo you want to **delete** the old one and create this new one?",
                            color: 0xffa500, // Warning Orange
                            thumbnail: {
                                url: interaction.member.avatarURL || interaction.member.user.avatarURL,
                            },
                        },
                    ],
                    components: [
                        {
                            type: 1,
                            components: [
                                {
                                    type: 2,
                                    label: "Overwrite Identity",
                                    style: 4, // Red
                                    custom_id: "custom_confirm_overwrite",
                                },
                                {
                                    type: 2,
                                    label: "Cancel",
                                    style: 2,
                                    custom_id: "custom_cancel",
                                },
                            ],
                        },
                    ],
                });
            } else {
                // Role was deleted manually, clean up DB and proceed
                await db.query("DELETE FROM custom_roles WHERE guild_id = $1 AND user_id = $2", [guildId, userId]);
            }
        }

        // 2. Create New Role (If no conflict)
        await this.createCustomRole(interaction, bot, name, colorInt, false);
    },

    // --- BUTTON HANDLER ---
    // This must be called by your interactionCreate event handler
    async handleInteraction(interaction, bot) {
        const userId = interaction.member.id;
        const data = pendingActions.get(userId);
        
        // If no state found, session expired
        if (!data) return interaction.createMessage({ content: "❌ Session expired or invalid.", flags: 64 });

        if (interaction.data.custom_id === "custom_cancel") {
            pendingActions.delete(userId);
            return interaction.editParent({
                embeds: [
                    {
                        title: "Operation Cancelled",
                        description: "Your existing role remains unchanged.",
                        color: 0x2b2d31,
                    },
                ],
                components: [],
            });
        }

        if (interaction.data.custom_id === "custom_confirm_overwrite") {
            // 1. Delete Old Role
            try {
                await bot.deleteRole(interaction.guildID, data.oldRoleId, "Custom Role Overwrite");
            } catch (err) {
                // Ignore if already deleted
            }

            // 2. Create New Role
            await this.createCustomRole(interaction, bot, data.newName, data.newColor, true);
            
            // 3. Clear state
            pendingActions.delete(userId);
        }
    },

    // --- HELPER: ROLE CREATION LOGIC ---
    async createCustomRole(interaction, bot, name, color, isEdit = false) {
        const guild = bot.guilds.get(interaction.guildID);
        const userId = interaction.member.id;

        try {
            // A. Calculate Position (Hoisting)
            const botMember = guild.members.get(bot.user.id);
            // Find the highest role the bot has
            const botHighRole = botMember.roles
                .map((id) => guild.roles.get(id))
                .sort((a, b) => b.position - a.position)[0];
            
            // Target position is just below the bot's highest role
            let targetPos = botHighRole ? botHighRole.position - 1 : 1;
            if (targetPos < 0) targetPos = 1;

            // B. Create Role
            const newRole = await guild.createRole({
                name: name,
                color: color,
                permissions: 0,
                hoist: false,
                mentionable: false,
            }, "Custom Role Creation");

            // C. Move Role (Hoist) & Assign
            try {
                await newRole.editPosition(targetPos);
            } catch (err) {
                console.warn("Could not hoist role. Check Bot Hierarchy.", err);
            }
            await guild.addMemberRole(userId, newRole.id, "Custom Role Assignment");

            // D. Update Database
            if (isEdit) {
                await db.query(
                    "UPDATE custom_roles SET role_id = $1 WHERE guild_id = $2 AND user_id = $3",
                    [newRole.id, guild.id, userId]
                );
            } else {
                await db.query(
                    "INSERT INTO custom_roles (guild_id, user_id, role_id) VALUES ($1, $2, $3)",
                    [guild.id, userId, newRole.id]
                );
            }

            // E. Success Message
            const payload = {
                content: "",
                embeds: [
                    {
                        title: "Identity Fabricated",
                        description: `**Role:** <@&${newRole.id}>\n**Hex:** #${color.toString(16).toUpperCase().padStart(6, "0")}\n\nThis role has been assigned to you and hoisted to maximum available visibility.`,
                        color: color,
                        thumbnail: {
                            url: interaction.member.avatarURL || interaction.member.user.avatarURL,
                        },
                        footer: {
                            text: "Use /custom role again to change it.",
                        },
                    },
                ],
                components: [],
            };

            // If we are editing (from button), we edit the parent message.
            // If we are creating fresh, we send a new message.
            if (isEdit) return interaction.editParent(payload);
            return interaction.createMessage(payload);

        } catch (err) {
            console.error(err);
            const errMsg = {
                content: "❌ **Error:** Could not create role. I might lack permissions (Manage Roles) or the role list is full.",
            };
            if (isEdit) return interaction.editParent(errMsg);
            return interaction.createMessage(errMsg);
        }
    },
};