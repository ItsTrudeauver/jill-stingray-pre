const { Pool } = require("pg");

// Connect using the environment variable provided by Koyeb/Render
const db = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false // Required for most cloud databases (Koyeb/Heroku/Render)
    }
});

async function init() {
    try {
        // 1. Activity Tracker
        await db.query(`
            CREATE TABLE IF NOT EXISTS activity (
                guild_id TEXT,
                user_id TEXT,
                chars INTEGER DEFAULT 0,
                msg_count INTEGER DEFAULT 0,
                PRIMARY KEY (guild_id, user_id)
            );
        `);

        // 2. Patron System (Note: last_ordered is BIGINT for Date.now())
        await db.query(`
            CREATE TABLE IF NOT EXISTS drinks (
                user_id TEXT,
                guild_id TEXT,
                drink_name TEXT,
                count INTEGER DEFAULT 0,
                last_ordered BIGINT,
                PRIMARY KEY (user_id, guild_id, drink_name)
            );
        `);

        // 3. Emoji Tracker
        await db.query(`
            CREATE TABLE IF NOT EXISTS emojis (
                guild_id TEXT,
                emoji_id TEXT,
                name TEXT,
                is_animated BOOLEAN,
                count INTEGER DEFAULT 0,
                last_used BIGINT,
                PRIMARY KEY (guild_id, emoji_id)
            );
        `);

        // 4. Custom Roles
        await db.query(`
            CREATE TABLE IF NOT EXISTS custom_roles (
                guild_id TEXT,
                user_id TEXT,
                role_id TEXT,
                PRIMARY KEY (guild_id, user_id)
            );
        `);

        // 5. Dangeru Posts (SERIAL makes it auto-increment)
        await db.query(`
            CREATE TABLE IF NOT EXISTS dangeru_posts (
                id SERIAL PRIMARY KEY,
                tripcode TEXT,
                content TEXT,
                author_id TEXT,
                timestamp BIGINT
            );
        `);

        // 6. Alias History
        await db.query(`
            CREATE TABLE IF NOT EXISTS aliases (
                id SERIAL PRIMARY KEY,
                user_id TEXT,
                guild_id TEXT,
                old_name TEXT,
                new_name TEXT,
                timestamp BIGINT
            );
        `);

        console.log("[DB] PostgreSQL Connected & Synced.");
    } catch (err) {
        console.error("[DB] Initialization Failed:", err);
    }
}

init();

module.exports = { db };