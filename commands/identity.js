const { db } = require("../utils/db");

module.exports = {
    name: "identity",
    description: "Pull forensic alias history.",
    options: [{ name: "user", type: 6, required: true, description: "Target" }],

    async execute(interaction, bot) {
        const targetId = interaction.data.options[0].value;

        const res = await db.query(`
            SELECT * FROM aliases 
            WHERE user_id = $1 AND guild_id = $2 
            ORDER BY timestamp DESC LIMIT 20
        `, [targetId, interaction.guildID]);

        if (res.rows.length === 0) return interaction.createMessage("No alias changes recorded.");

        const timeline = res.rows.map(row => {
            const date = new Date(parseInt(row.timestamp)).toLocaleDateString();
            return `\`${date}\` : **${row.new_name}**`;
        }).join("\n");

        interaction.createMessage({
            embeds: [{
                title: `📂 Identity Record: ${targetId}`,
                description: timeline,
                color: 0xff0055
            }]
        });
    }
};