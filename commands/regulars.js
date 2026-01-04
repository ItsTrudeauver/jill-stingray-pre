const { db } = require("../utils/db");

module.exports = {
    name: "regulars",
    description: "View the bar's top patrons.",

    async execute(interaction, bot) {
        // 1. Get Top 10 Patrons (Sum of all drinks)
        const topRes = await db.query(`
            SELECT user_id, SUM(count) as total_orders
            FROM drinks
            WHERE guild_id = $1
            GROUP BY user_id
            ORDER BY total_orders DESC
            LIMIT 10
        `, [interaction.guildID]);

        if (topRes.rows.length === 0) {
            return interaction.createMessage("No drinks served yet. Be the first!");
        }

        // 2. Helper to find favorites
        // We have to loop, but for 10 users it's instant.
        let description = "";
        let rank = 1;
        const medals = ["🥇", "🥈", "🥉"];

        for (const p of topRes.rows) {
            const medal = medals[rank - 1] || `#${rank}`;
            const userTag = `<@${p.user_id}>`;

            // Get favorite
            const favRes = await db.query(`
                SELECT drink_name FROM drinks 
                WHERE user_id = $1 AND guild_id = $2 
                ORDER BY count DESC LIMIT 1
            `, [p.user_id, interaction.guildID]);
            
            const usual = favRes.rows[0] ? favRes.rows[0].drink_name : "Unknown";

            description += `**${medal}** ${userTag}\n`;
            description += `> 🍸 **${p.total_orders}** drinks • 🥃 The Usual: *${usual}*\n\n`;
            rank++;
        }

        await interaction.createMessage({
            embeds: [
                {
                    title: "🏆 VA-11 HALL-A | Regulars",
                    description: description,
                    color: 0x00ff9d,
                    footer: { text: "Drink responsibly. Or don't. I'm a robot." },
                    image: { url: "https://static.wikia.nocookie.net/va11halla/images/7/73/Jill%27s_upgraded_room.png" }
                },
            ],
        });
    },
};