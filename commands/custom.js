const { db } = require("../utils/db");

module.exports = {
    name: "custom",
    description: "Manage your personal custom role.",
    options: [
        {
            name: "role",
            description: "Create/Edit Role",
            type: 1,
            options: [
                { name: "name", type: 3, required: true, description: "Role Name" },
                { name: "hex", type: 3, required: true, description: "Hex Color (e.g. FF0000)" }
            ]
        }
    ],

    async execute(interaction, bot) {
        const name = interaction.data.options[0].options[0].value;
        const hex = interaction.data.options[0].options[1].value.replace("#", "");
        const colorInt = parseInt(hex, 16);

        if (isNaN(colorInt)) return interaction.createMessage("Invalid Hex.");

        await interaction.createMessage("Processing...");

        // Check Existing
        const res = await db.query(`
            SELECT role_id FROM custom_roles WHERE guild_id = $1 AND user_id = $2
        `, [interaction.guildID, interaction.member.id]);
        
        const existing = res.rows[0];

        if (existing) {
            try { await bot.deleteRole(interaction.guildID, existing.role_id); } catch (e) {}
        }

        // Create New
        try {
            const newRole = await bot.createRole(interaction.guildID, {
                name: name,
                color: colorInt,
                permissions: 0
            });

            await bot.addGuildMemberRole(interaction.guildID, interaction.member.id, newRole.id);
            
            // Save to DB (Upsert)
            await db.query(`
                INSERT INTO custom_roles (guild_id, user_id, role_id) 
                VALUES ($1, $2, $3)
                ON CONFLICT (guild_id, user_id) 
                DO UPDATE SET role_id = $3
            `, [interaction.guildID, interaction.member.id, newRole.id]);

            interaction.editOriginalMessage(`Role <@&${newRole.id}> created.`);
        } catch (e) {
            interaction.editOriginalMessage("Failed to create role. Check permissions (I need 'Manage Roles').");
        }
    }
};