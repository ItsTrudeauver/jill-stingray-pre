const Eris = require("eris");
const fs = require("fs");
const path = require("path");

const DATA_PATH = path.join(__dirname, "../data/custom_roles.json");

// Ensure database exists
if (!fs.existsSync(DATA_PATH)) {
    fs.writeFileSync(DATA_PATH, JSON.stringify({}));
}

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

    async execute(interaction, bot, pendingActions) {
        const sub = interaction.data.options[0];
        if (sub.name !== "role") return;

        const name = sub.options.find((o) => o.name === "name").value;
        let hex = sub.options
            .find((o) => o.name === "hex")
            .value.replace("#", "");

        // Validate Hex
        if (!/^[0-9A-F]{6}$/i.test(hex)) {
            return interaction.createMessage({
                content:
                    "❌ **Invalid Color.** Please use a valid 6-digit Hex code (e.g., `00FF00`).",
                flags: 64,
            });
        }
        const colorInt = parseInt(hex, 16);

        // Load DB
        let db = {};
        try {
            db = JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
        } catch (e) {}

        const userId = interaction.member.id;
        const existingRoleId = db[userId];

        // 1. CHECK FOR EXISTING ROLE
        if (existingRoleId) {
            // Verify if role actually exists in guild (might have been manually deleted)
            const guild = bot.guilds.get(interaction.guildID);
            if (guild && guild.roles.has(existingRoleId)) {
                // Store state for the button interaction
                pendingActions.set(userId, {
                    type: "custom_overwrite",
                    newName: name,
                    newColor: colorInt,
                    oldRoleId: existingRoleId,
                });

                return interaction.createMessage({
                    embeds: [
                        {
                            title: "Identity Conflict",
                            description:
                                "You already have a registered custom role.\nDo you want to **delete** the old one and create this new one?",
                            color: 0xffa500, // Warning Orange
                            thumbnail: {
                                url:
                                    interaction.member.avatarURL ||
                                    interaction.member.user.avatarURL,
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
                                    custom_id: `custom_confirm_overwrite`,
                                },
                                {
                                    type: 2,
                                    label: "Cancel",
                                    style: 2,
                                    custom_id: `custom_cancel`,
                                },
                            ],
                        },
                    ],
                });
            } else {
                // Role was deleted manually, clean up DB and proceed
                delete db[userId];
                fs.writeFileSync(DATA_PATH, JSON.stringify(db, null, 2));
            }
        }

        // 2. CREATE NEW ROLE (If no conflict)
        await this.createCustomRole(interaction, bot, name, colorInt, db);
    },

    // --- BUTTON HANDLER ---
    async handleInteraction(interaction, bot, data) {
        const customId = interaction.data.custom_id;

        if (customId === "custom_cancel") {
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

        if (customId === "custom_confirm_overwrite") {
            // 1. Delete Old Role
            try {
                await bot.deleteRole(
                    interaction.guildID,
                    data.oldRoleId,
                    "Custom Role Overwrite",
                );
            } catch (err) {
                // Ignore if already deleted
            }

            // 2. Load DB again to ensure sync
            let db = JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));

            // 3. Create New
            await this.createCustomRole(
                interaction,
                bot,
                data.newName,
                data.newColor,
                db,
                true,
            );
        }
    },

    // --- HELPER: ROLE CREATION LOGIC ---
    async createCustomRole(interaction, bot, name, color, db, isEdit = false) {
        const guild = bot.guilds.get(interaction.guildID);
        const userId = interaction.member.id;

        // Feedback during processing
        if (isEdit) {
            await interaction.editParent({
                content: "⏳ **Fabricating new identity...**",
                components: [],
            });
        } else {
            await interaction.createMessage({
                content: "⏳ **Fabricating identity...**",
            });
        }

        try {
            // A. Create
            const newRole = await bot.createRole(
                interaction.guildID,
                {
                    name: name,
                    color: color,
                    hoist: false, // Make it separate
                    mentionable: false,
                    permissions: 0, // No extra perms
                },
                `Custom Role for ${interaction.member.username}`,
            );

            // B. Assign
            await bot.addGuildMemberRole(
                interaction.guildID,
                userId,
                newRole.id,
                "Custom Role Assignment",
            );

            // C. Auto-Hoist (Try to move it as high as possible)
            // We find the bot's highest role, and try to put this role right below it.
            const botMember = await guild.getRESTMember(bot.user.id);
            const botRoles = botMember.roles
                .map((rId) => guild.roles.get(rId))
                .filter((r) => r);
            const botHighRole = botRoles.sort(
                (a, b) => b.position - a.position,
            )[0];

            if (botHighRole) {
                try {
                    // Position is 0-based. We try to set it to botPosition - 1
                    // Note: Eris/Discord API might require recalculating the whole list,
                    // but editPosition usually handles absolute values.
                    const targetPos =
                        botHighRole.position > 1 ? botHighRole.position - 1 : 1;
                    await newRole.editPosition(targetPos);
                } catch (e) {
                    console.error("Failed to hoist custom role:", e);
                }
            }

            // D. Save to DB
            db[userId] = newRole.id;
            fs.writeFileSync(DATA_PATH, JSON.stringify(db, null, 2));

            // E. Success Message
            const payload = {
                content: "",
                embeds: [
                    {
                        title: "Identity Fabricated",
                        description: `**Role:** <@&${newRole.id}>\n**Hex:** #${color.toString(16).toUpperCase().padStart(6, "0")}\n\nThis role has been assigned to you and hoisted to maximum available visibility.`,
                        color: color,
                        thumbnail: {
                            url:
                                interaction.member.avatarURL ||
                                interaction.member.user.avatarURL,
                        },
                        footer: {
                            text: "Use /custom role again to change it.",
                        },
                    },
                ],
                components: [],
            };

            if (isEdit) return interaction.editParent(payload);
            return interaction.editOriginalMessage(payload);
        } catch (err) {
            console.error(err);
            const errMsg = {
                content:
                    "❌ **Error:** Could not create role. I might lack permissions (Manage Roles) or the role list is full.",
            };
            if (isEdit) return interaction.editParent(errMsg);
            return interaction.editOriginalMessage(errMsg);
        }
    },
};
