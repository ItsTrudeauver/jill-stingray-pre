const { db } = require("./db");

module.exports = {
    // Record a drink
    logDrink: async (userId, guildId, drinkName) => {
        try {
            await db.query(`
                INSERT INTO drinks (user_id, guild_id, drink_name, count, last_ordered)
                VALUES ($1, $2, $3, 1, $4)
                ON CONFLICT (user_id, guild_id, drink_name)
                DO UPDATE SET 
                    count = drinks.count + 1,
                    last_ordered = $4
            `, [userId, guildId, drinkName, Date.now()]);
        } catch (err) {
            console.error("Failed to log drink:", err);
        }
    },

    // Get stats
    getPatronStats: async (userId, guildId) => {
        try {
            const res = await db.query(`
                SELECT drink_name, count 
                FROM drinks 
                WHERE user_id = $1 AND guild_id = $2
                ORDER BY count DESC
            `, [userId, guildId]);

            if (res.rows.length === 0) return null;

            const total = res.rows.reduce((acc, row) => acc + row.count, 0);
            const usual = res.rows[0].drink_name;

            return {
                total,
                usual,
                lastVisit: Date.now(),
            };
        } catch (err) {
            console.error(err);
            return null;
        }
    },
};