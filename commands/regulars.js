const { getPatronStats } = require("../utils/patronSystem.js");
const fs = require("fs");
const path = require("path");

module.exports = {
    name: "regulars",
    description: "View the bar's top patrons.",

    async execute(interaction, bot) {
        // 1. Read Raw Data directly (since patronSystem helper might just get one user)
        const dataPath = path.join(__dirname, "../data/patrons.json");
        let rawData = {};
        try {
            rawData = JSON.parse(fs.readFileSync(dataPath));
        } catch (e) {
            return interaction.createMessage(
                "The patron list is currently empty.",
            );
        }

        // 2. Convert to Array and Sort
        // Structure: [ [id, {totalOrders: 5...}], ... ]
        const sortedPatrons = Object.entries(rawData)
            .sort((a, b) => b[1].totalOrders - a[1].totalOrders)
            .slice(0, 10); // Top 10

        if (sortedPatrons.length === 0) {
            return interaction.createMessage(
                "No drinks served yet. Be the first!",
            );
        }

        // 3. Build the Leaderboard String
        let description = "";
        let rank = 1;

        // We use a predefined medal list for the top 3
        const medals = ["👑", "🥈", "🥉"];

        for (const [id, stats] of sortedPatrons) {
            const medal = medals[rank - 1] || `#${rank}`;

            // Try to resolve username (might be null if user left, handled gracefully)
            // Fetching users can be async, but for a simple list we often use cache or just ID if missing.
            let userTag = `<@${id}>`;

            // Find their favorite drink
            let usual = "Unknown";
            let max = 0;
            for (const [d, count] of Object.entries(stats.history)) {
                if (count > max) {
                    max = count;
                    usual = d;
                }
            }

            description += `**${medal}** ${userTag}\n`;
            description += `> 🧾 **${stats.totalOrders}** drinks • 🍸 The Usual: *${usual}*\n\n`;
            rank++;
        }

        // 4. Send Embed
        await interaction.createMessage({
            embeds: [
                {
                    title: "🏆 VA-11 HALL-A | Employee of the Month? No, Regulars.",
                    description: description,
                    color: 0x00ff9d, // Neon Green
                    footer: {
                        text: "Drink responsibly. Or don't. I'm a robot.",
                    },
                    image: {
                        url: "https://cdna.artstation.com/p/assets/images/images/018/654/420/large/matthew-hellmann-va-11-hall-a-02.jpg?1560207955",
                    }, // Optional decorative banner
                },
            ],
        });
    },
};
