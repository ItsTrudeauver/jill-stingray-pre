const { db } = require("../utils/db");

// Helper function
async function trackEmoji(guildId, emojiId, name, animated) {
    if (!guildId || !emojiId) return;
    try {
        await db.query(`
            INSERT INTO emojis (guild_id, emoji_id, name, is_animated, count, last_used)
            VALUES ($1, $2, $3, $4, 1, $5)
            ON CONFLICT (guild_id, emoji_id)
            DO UPDATE SET 
                count = emojis.count + 1,
                last_used = $5,
                name = $3
        `, [guildId, emojiId, name, animated, Date.now()]);
    } catch (err) {
        console.error("Emoji DB Error:", err);
    }
}

module.exports = {
    name: "ready",
    once: true,
    execute: (bot) => {
        bot.on("messageCreate", (msg) => {
            if (msg.author.bot || !msg.guildID) return;
            const regex = /<(a?):(\w+):(\d+)>/g;
            let match;
            while ((match = regex.exec(msg.content)) !== null) {
                // match[1] is "a" if animated, match[2] is name, match[3] is ID
                trackEmoji(msg.guildID, match[3], match[2], match[1] === "a");
            }
        });

        bot.on("messageReactionAdd", (msg, emoji, reactor) => {
            if (reactor && reactor.bot) return;
            if (!emoji.id) return;
            
            // Handle uncached guilds
            const guildId = msg.guildID || (msg.channel && msg.channel.guild && msg.channel.guild.id);
            if (guildId) {
                trackEmoji(guildId, emoji.id, emoji.name, emoji.animated);
            }
        });

        console.log("[EVT] PostgreSQL Emoji Tracker Online.");
    }
};