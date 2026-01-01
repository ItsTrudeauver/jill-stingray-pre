const fs = require("fs");
const path = require("path");

const DB_PATH = path.join(__dirname, "../data/emoji_stats.json");

// Ensure DB exists
if (!fs.existsSync(DB_PATH)) {
    // Make sure the data directory exists first
    const dataDir = path.dirname(DB_PATH);
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);
    fs.writeFileSync(DB_PATH, JSON.stringify({}));
}

function getStats() {
    try {
        return JSON.parse(fs.readFileSync(DB_PATH));
    } catch (e) {
        return {};
    }
}

function saveStats(data) {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

function incrementEmoji(emojiId, emojiName, isAnimated) {
    const stats = getStats();

    if (!stats[emojiId]) {
        stats[emojiId] = {
            name: emojiName,
            count: 0,
            animated: isAnimated,
            lastUsed: 0,
        };
    }

    // Update metadata (name might change)
    stats[emojiId].name = emojiName;
    stats[emojiId].count += 1;
    stats[emojiId].lastUsed = Date.now();

    saveStats(stats);
}

module.exports = {
    name: "ready", // We hook into 'ready' to initialize the tracker
    once: true, // Run setup only once
    execute: (bot) => {
        // 1. TRACK MESSAGES
        bot.on("messageCreate", (msg) => {
            if (msg.author.bot) return;
            if (!msg.guildID) return; // Ignore DMs

            // Resolve Guild to check emoji ownership
            const guild = bot.guilds.get(msg.guildID);
            if (!guild) return;

            // Regex for custom emojis: <(a?):(name):(id)>
            const regex = /<(a?):(\w+):(\d+)>/g;
            let match;

            while ((match = regex.exec(msg.content)) !== null) {
                const isAnimated = match[1] === "a";
                const name = match[2];
                const id = match[3];

                // SECURITY CHECK: Does this emoji belong to this guild?
                // Eris stores guild.emojis as an array of objects
                const isLocal = guild.emojis.find((e) => e.id === id);

                if (isLocal) {
                    incrementEmoji(id, name, isAnimated);
                }
            }
        });

        // 2. TRACK REACTIONS
        bot.on("messageReactionAdd", (msg, emoji, reactor) => {
            if (reactor && reactor.bot) return;
            if (!emoji.id) return; // Ignore standard unicodes (no ID)

            // Resolve Guild (Reaction messages might be partial/uncached)
            let guild = msg.channel.guild;
            if (!guild && msg.guildID) {
                guild = bot.guilds.get(msg.guildID);
            }
            if (!guild) return;

            // SECURITY CHECK: Does this emoji belong to this guild?
            const isLocal = guild.emojis.find((e) => e.id === emoji.id);

            if (isLocal) {
                incrementEmoji(emoji.id, emoji.name, emoji.animated);
            }
        });

        console.log("[EVT] Emoji Tracker Online (Server-Local Only).");
    },
};
