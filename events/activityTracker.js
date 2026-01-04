const { db } = require("../utils/db");

module.exports = {
    name: "messageCreate",
    async execute(message, bot) {
        if (message.author.bot || !message.guildID) return;

        try {
            // Postgres Upsert
            await db.query(`
                INSERT INTO activity (guild_id, user_id, chars, msg_count)
                VALUES ($1, $2, $3, 1)
                ON CONFLICT (guild_id, user_id) 
                DO UPDATE SET 
                    chars = activity.chars + $3,
                    msg_count = activity.msg_count + 1
            `, [message.guildID, message.author.id, message.content.length]);

        } catch (err) {
            console.error("Activity Tracker Error:", err);
        }
    },
};