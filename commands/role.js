const Eris = require("eris");

module.exports = {
    name: "role",
    description:
        "Complete role management suite: Create, Assign, Edit, and Reorder.",
    defaultMemberPermissions: 0x0000000010000000, // Requires 'Manage Roles' at minimum
    options: [
        // --- 1. CREATE ---
        {
            name: "create",
            description: "Design a new role with a custom color.",
            type: 1, // SUB_COMMAND
            options: [
                {
                    name: "name",
                    description: "Name of the role.",
                    type: 3,
                    required: true,
                },
                {
                    name: "hex",
                    description: "Hex color (e.g. FF0055).",
                    type: 3,
                    required: true,
                },
            ],
        },
        // --- 2. ASSIGN ---
        {
            name: "assign",
            description: "Grant a role to multiple patrons at once.",
            type: 1, // SUB_COMMAND
            options: [
                {
                    name: "role",
                    description: "The role to give.",
                    type: 8,
                    required: true,
                },
                {
                    name: "user1",
                    description: "Patron 1",
                    type: 6,
                    required: true,
                },
                {
                    name: "user2",
                    description: "Patron 2",
                    type: 6,
                    required: false,
                },
                {
                    name: "user3",
                    description: "Patron 3",
                    type: 6,
                    required: false,
                },
                {
                    name: "user4",
                    description: "Patron 4",
                    type: 6,
                    required: false,
                },
                {
                    name: "user5",
                    description: "Patron 5",
                    type: 6,
                    required: false,
                },
            ],
        },
        // --- 3. EDIT ---
        {
            name: "edit",
            description: "Modify a role's details or hoist status.",
            type: 1, // SUB_COMMAND
            options: [
                {
                    name: "target",
                    description: "The role to edit.",
                    type: 8,
                    required: true,
                },
                {
                    name: "name",
                    description: "New name.",
                    type: 3,
                    required: false,
                },
                {
                    name: "color",
                    description: "New Hex Color.",
                    type: 3,
                    required: false,
                },
                {
                    name: "hoist_color",
                    description: "Set 'True' to hoist this role below the bot.",
                    type: 5,
                    required: false,
                },
            ],
        },
        // --- 4. MOVE ---
        {
            name: "move",
            description: "Reposition a role in the hierarchy.",
            type: 1, // SUB_COMMAND
            options: [
                {
                    name: "target",
                    description: "The role to move.",
                    type: 8,
                    required: true,
                },
                {
                    name: "position",
                    description: "New absolute position number.",
                    type: 4,
                    required: true,
                },
            ],
        },
    ],

    async execute(interaction, bot, pendingActions) {
        const subCommand = interaction.data.options[0];
        const guild = bot.guilds.get(interaction.guildID);

        // Security: While defaultMemberPermissions handles the basics,
        // complex edits need stricter checks (handled in logic below).

        try {
            switch (subCommand.name) {
                case "create":
                    await this.handleCreate(
                        interaction,
                        subCommand.options,
                        pendingActions,
                    );
                    break;
                case "assign":
                    await this.handleAssign(
                        interaction,
                        bot,
                        subCommand.options,
                        pendingActions,
                    );
                    break;
                case "edit":
                    await interaction.defer(); // Edit might take a moment
                    await this.handleEdit(
                        interaction,
                        guild,
                        bot,
                        subCommand.options,
                    );
                    break;
                case "move":
                    await interaction.defer(); // Move is API heavy
                    await this.handleMove(
                        interaction,
                        guild,
                        subCommand.options,
                    );
                    break;
            }
        } catch (err) {
            console.error(err);
            if (!interaction.acknowledged) {
                await interaction.createMessage({
                    content: `❌ Error: ${err.message}`,
                    flags: 64,
                });
            } else {
                await interaction.editOriginalMessage({
                    content: `❌ Error: ${err.message}`,
                });
            }
        }
    },

    // =========================================
    // 1. HANDLER: CREATE
    // =========================================
    async handleCreate(interaction, options, pendingActions) {
        const name = options.find((o) => o.name === "name").value;
        let hex = options.find((o) => o.name === "hex").value.replace("#", "");

        if (!/^[0-9A-F]{6}$/i.test(hex)) {
            return interaction.createMessage({
                content: "❌ Invalid Hex Code. Use format like `FF0055`.",
                flags: 64,
            });
        }

        const colorInt = parseInt(hex, 16);
        const previewUrl = `https://singlecolorimage.com/get/${hex}/400x100`;

        // Store Session
        pendingActions.set(interaction.member.id, {
            type: "create",
            name: name,
            color: colorInt,
        });

        await interaction.createMessage({
            content: "Please confirm this design.",
            flags: 64,
            embeds: [
                {
                    title: "✨ Role Preview",
                    description: `**Name:** ${name}\n**Color:** #${hex}`,
                    color: colorInt,
                    image: { url: previewUrl },
                    footer: { text: "Role will be hoisted (Prioritized)" },
                },
            ],
            components: [
                {
                    type: 1,
                    components: [
                        {
                            type: 2,
                            label: "Create Role",
                            style: 3,
                            custom_id: `confirm_role_create|${interaction.member.id}`,
                        },
                        {
                            type: 2,
                            label: "Cancel",
                            style: 4,
                            custom_id: `cancel|${interaction.member.id}`,
                        },
                    ],
                },
            ],
        });
    },

    // =========================================
    // 2. HANDLER: ASSIGN
    // =========================================
    async handleAssign(interaction, bot, options, pendingActions) {
        const roleId = options.find((o) => o.name === "role").value;
        const userIds = options
            .filter((o) => o.name !== "role")
            .map((o) => o.value);

        // Fetch user objects for the preview
        const targets = [];
        for (const uid of userIds) {
            try {
                const u = await bot.getRESTUser(uid);
                targets.push(u);
            } catch (e) {}
        }

        pendingActions.set(interaction.member.id, {
            type: "assign",
            roleId: roleId,
            userIds: userIds,
        });

        // Stacked Embeds for Visual Feedback
        const embedStack = [
            {
                title: "📋 Assignment Manifest",
                description: `Preparing to assign role: <@&${roleId}>`,
                color: 0xa45ee5,
                footer: { text: "Review the recipients below." },
            },
        ];

        targets.forEach((user) => {
            embedStack.push({
                author: {
                    name: `${user.username}#${user.discriminator}`,
                    icon_url: user.dynamicAvatarURL("png"),
                },
                thumbnail: { url: user.dynamicAvatarURL("png") },
                color: 0x2b2d31,
            });
        });

        await interaction.createMessage({
            content: "Please confirm the following targets:",
            flags: 64,
            embeds: embedStack,
            components: [
                {
                    type: 1,
                    components: [
                        {
                            type: 2,
                            label: "Confirm Assignment",
                            style: 3,
                            custom_id: `confirm_assign_role|${interaction.member.id}`,
                        },
                        {
                            type: 2,
                            label: "Cancel",
                            style: 4,
                            custom_id: `cancel|${interaction.member.id}`,
                        },
                    ],
                },
            ],
        });
    },

    // =========================================
    // 3. HANDLER: EDIT
    // =========================================
    async handleEdit(interaction, guild, bot, options) {
        const roleId = options.find((o) => o.name === "target").value;
        const newName = options.find((o) => o.name === "name")?.value;
        const newColorStr = options.find((o) => o.name === "color")?.value;
        const shouldHoist = options.find(
            (o) => o.name === "hoist_color",
        )?.value;

        const role = guild.roles.get(roleId);
        if (!role) return interaction.editOriginalMessage("❌ Role not found.");

        if (!this.canManage(interaction.member, role, guild)) {
            return interaction.editOriginalMessage(
                "❌ **Hierarchy Error.** Target is above your clearance.",
            );
        }

        let updateData = {};
        let statusLog = [];

        if (newName) {
            updateData.name = newName;
            statusLog.push(`Label: **${newName}**`);
        }

        if (newColorStr) {
            const colorInt = this.parseColor(newColorStr);
            if (colorInt === null)
                return interaction.editOriginalMessage("❌ Invalid Hex.");
            updateData.color = colorInt;
            statusLog.push(`Tint: **${newColorStr}**`);
        }

        if (Object.keys(updateData).length > 0) {
            await role.edit(updateData);
        }

        if (shouldHoist) {
            const botMember = await guild.getRESTMember(bot.user.id);
            const botMaxPos = this.getHighestRolePos(botMember, guild);
            const targetPos = botMaxPos > 1 ? botMaxPos - 1 : 1;

            if (role.position !== targetPos) {
                await role.editPosition(targetPos);
                statusLog.push(
                    `🚀 **Hoisted to Max Clearance:** Position ${targetPos}`,
                );
            } else {
                statusLog.push(
                    "ℹ️ Role is already at the maximum manageable height.",
                );
            }
        }

        await interaction.editOriginalMessage({
            embeds: [
                {
                    title: "🛠 Role Calibration Complete",
                    description:
                        statusLog.length > 0
                            ? statusLog.join("\n")
                            : "No changes requested.",
                    color: role.color || 0xffffff,
                    footer: {
                        text: "Augmented Eye | Automatic Hierarchy Leveling",
                    },
                },
            ],
        });
    },

    // =========================================
    // 4. HANDLER: MOVE
    // =========================================
    async handleMove(interaction, guild, options) {
        const roleId = options.find((o) => o.name === "target").value;
        const newPos = options.find((o) => o.name === "position").value;

        const role = guild.roles.get(roleId);
        if (!role || !this.canManage(interaction.member, role, guild)) {
            return interaction.editOriginalMessage(
                "❌ Access Denied or Role missing.",
            );
        }

        await role.editPosition(newPos);
        await interaction.editOriginalMessage({
            content: `✅ **${role.name}** shifted to index **${newPos}**.`,
        });
    },

    // =========================================
    // BUTTON CONFIRMATION CALLBACKS
    // =========================================
    // (Called by events/interactionCreate.js)

    async onConfirmCreate(interaction, bot, data) {
        const newRole = await bot.createRole(interaction.guildID, {
            name: data.name,
            color: data.color,
            hoist: true,
            permissions: 0,
            mentionable: false,
        });

        await interaction.editParent({
            content: `✅ Role **${newRole.name}** created successfully!`,
            embeds: [],
            components: [],
        });
    },

    async onConfirmAssign(interaction, bot, data) {
        await interaction.editParent({
            content: "Processing...",
            embeds: [],
            components: [],
        });

        let successCount = 0;
        let failCount = 0;

        for (const userId of data.userIds) {
            try {
                await bot.addGuildMemberRole(
                    interaction.guildID,
                    userId,
                    data.roleId,
                    "Bulk Assignment",
                );
                successCount++;
            } catch (err) {
                failCount++;
            }
        }

        await interaction.editParent({
            content: "",
            embeds: [
                {
                    title: "✅ Manifest Processed",
                    description: `**Role:** <@&${data.roleId}>\n**Applied:** ${successCount}\n**Failed:** ${failCount}`,
                    color: 0x00ff00,
                },
            ],
        });
    },

    // =========================================
    // UTILS
    // =========================================

    canManage(member, targetRole, guild) {
        if (member.id === guild.ownerID) return true;
        return this.getHighestRolePos(member, guild) > targetRole.position;
    },

    getHighestRolePos(member, guild) {
        if (!member.roles || member.roles.length === 0) return 0;
        return Math.max(
            ...member.roles.map((rId) => guild.roles.get(rId)?.position || 0),
        );
    },

    parseColor(input) {
        const clean = input.replace("#", "").trim();
        return /^[0-9A-F]{6}$/i.test(clean) ? parseInt(clean, 16) : null;
    },
};
