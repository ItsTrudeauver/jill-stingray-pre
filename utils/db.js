const { Pool } = require("pg");

const db = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function init() {
    try {
        
        await db.query(`
            CREATE TABLE IF NOT EXISTS pending_custom_actions (
                user_id TEXT PRIMARY KEY,
                guild_id TEXT,
                new_name TEXT,
                new_color INTEGER,
                old_role_id TEXT
            );
        `);

        await db.query(`
            CREATE TABLE IF NOT EXISTS guild_settings (
                guild_id TEXT PRIMARY KEY,
                admin_role_id TEXT,
                log_channel_id TEXT,
                command_rules JSONB DEFAULT '{}'::jsonb
            );
        `);
        
        await db.query(`
            CREATE TABLE IF NOT EXISTS activity (
                guild_id TEXT,
                user_id TEXT,
                chars INTEGER DEFAULT 0,
                msg_count INTEGER DEFAULT 0,
                PRIMARY KEY (guild_id, user_id)
            );
        `);

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

        await db.query(`
            CREATE TABLE IF NOT EXISTS custom_roles (
                guild_id TEXT,
                user_id TEXT,
                role_id TEXT,
                PRIMARY KEY (guild_id, user_id)
            );
        `);

        await db.query(`
            CREATE TABLE IF NOT EXISTS dangeru_posts (
                id SERIAL PRIMARY KEY,
                tripcode TEXT,
                content TEXT,
                author_id TEXT,
                timestamp BIGINT
            );
        `);

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

        // --- PREVIOUSLY ADDED: TRIGGERS ---
        await db.query(`
            CREATE TABLE IF NOT EXISTS triggers (
                id SERIAL PRIMARY KEY,
                guild_id TEXT,
                keyword TEXT,
                response TEXT,
                is_image BOOLEAN DEFAULT FALSE,
                case_sensitive BOOLEAN DEFAULT FALSE,
                UNIQUE(guild_id, keyword)
            );
        `);


        console.log("[DB] PostgreSQL Connected & Synced.");
    } catch (err) {
        console.error("[DB] Initialization Failed:", err);
    }
}

init();

module.exports = { db };