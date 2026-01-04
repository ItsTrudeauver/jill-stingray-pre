const { db } = require("../utils/db");

module.exports = {
    name: "messageCreate",
    async execute(message, bot) {
        if (message.author.bot || !message.guildID) return;

        // Fetch all triggers for this guild
        // Optimization note: For massive scale, you'd cache this in a Map/Redis.
        // For standard use, Postgres is fast enough to query on chat.
        try {
            const res = await db.query(`
                SELECT keyword, response, is_image, case_sensitive 
                FROM triggers 
                WHERE guild_id = $1
            `, [message.guildID]);

            if (res.rows.length === 0) return;

            const content = message.content;

            // Find match
            const match = res.rows.find(t => {
                if (t.case_sensitive) {
                    return content === t.keyword; // Strict match
                } else {
                    return content.toLowerCase() === t.keyword.toLowerCase(); // Normal match
                }
            });

            if (match) {
                if (match.is_image) {
                    // Send as embed
                    await bot.createMessage(message.channel.id, {
                        embeds: [{
                            color: 0x2b2d31,
                            image: { url: match.response }
                        }]
                    });
                } else {
                    // Send as text
                    await bot.createMessage(message.channel.id, {
                        content: match.response
                    });
                }
            }

        } catch (err) {
            console.error("Trigger Error:", err);
        }
    }
};