const Eris = require("eris");
const fs = require("fs");
const path = require("path");

// Storage for analytics
const DATA_PATH = path.join(__dirname, "../data/activity_stats.json");

// Initialize structure if missing
if (!fs.existsSync(DATA_PATH)) {
    fs.writeFileSync(
        DATA_PATH,
        JSON.stringify({
            heatmap: new Array(24).fill(0), // 0-23 Hour buckets
            channels: {}, // ID: count
            users: {}, // ID: { chars: 0, mentions: 0 }
            lastReset: Date.now(),
        }),
    );
}

module.exports = {
    name: "messageCreate",
    async execute(message, bot) {
        if (message.author.bot || !message.guildID) return;

        try {
            let data = JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
            const now = new Date();

            // --- 1. HEATMAP (Hour of Day) ---
            const currentHour = now.getHours();
            // Simple increment for the current hour
            // Note: A true "rolling" heatmap requires complex logic,
            // but for a "Daily Rhythm" chart, simple hourly buckets work best.
            data.heatmap[currentHour]++;

            // --- 2. CHANNEL TRENDS ---
            if (!data.channels[message.channel.id])
                data.channels[message.channel.id] = 0;
            data.channels[message.channel.id]++;

            // --- 3. SOCIAL DENSITY (User Stats) ---
            if (!data.users[message.author.id]) {
                data.users[message.author.id] = {
                    chars: 0,
                    mentions: 0,
                    msgCount: 0,
                };
            }
            const user = data.users[message.author.id];
            user.msgCount++;
            user.chars += message.content.length;

            // Track Mentions (Socialites)
            if (message.mentions.length > 0) {
                message.mentions.forEach((mentioned) => {
                    if (mentioned.bot) return;
                    if (!data.users[mentioned.id]) {
                        data.users[mentioned.id] = {
                            chars: 0,
                            mentions: 0,
                            msgCount: 0,
                        };
                    }
                    data.users[mentioned.id].mentions++;
                });
            }

            // --- 4. DAILY RESET (Maintenance) ---
            // If it's been more than 24h since last reset, we clear the detailed stats
            // but maybe keep the heatmap average? For simplicity, we wipe to keep it "Fresh".
            if (Date.now() - data.lastReset > 86400000) {
                // Reset stats but keep a decay on heatmap?
                // Let's just reset user/channel volume to start the new "Day"
                data.channels = {};
                data.users = {};
                data.heatmap.fill(0);
                data.lastReset = Date.now();
                console.log("[Analytics] 24h Cycle Reset.");
            }

            // Save (Debounced in a real app, but direct for now)
            fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
        } catch (err) {
            console.error("Activity Tracker Error:", err);
        }
    },
};
