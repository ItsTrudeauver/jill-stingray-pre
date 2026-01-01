const Eris = require("eris");
const fs = require("fs");
const path = require("path");

const DATA_PATH = path.join(__dirname, "../data/activity_stats.json");

module.exports = {
    name: "pulse",
    description: "View server activity analytics (Heatmap & Social Density).",
    options: [],

    async execute(interaction, bot) {
        let data = { heatmap: [], channels: {}, users: {} };
        try {
            if (fs.existsSync(DATA_PATH)) {
                data = JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
            }
        } catch (err) {
            return interaction.createMessage(
                "📉 **Error reading analytics data.**",
            );
        }

        // --- 1. GENERATE HEATMAP VISUAL ---
        // Find the peak hour to scale the graph
        const maxActivity = Math.max(...data.heatmap, 1);
        const graph = data.heatmap.map((count, hour) => {
            if (count === 0) return "⚫";
            const intensity = count / maxActivity;
            if (intensity > 0.8) return "🔴"; // High traffic
            if (intensity > 0.5) return "🟠"; // Moderate
            if (intensity > 0.2) return "🟡"; // Low
            return "🟢"; // Quiet
        });

        // Split into two lines for display (AM/PM)
        const amLine = graph.slice(0, 12).join("");
        const pmLine = graph.slice(12, 24).join("");

        // --- 2. SOCIAL DENSITY (Top Talkers) ---
        const topTalkers = Object.entries(data.users)
            .sort((a, b) => b[1].chars - a[1].chars)
            .slice(0, 3)
            .map((u, i) => {
                const user = bot.users.get(u[0]);
                const name = user ? user.username : "Unknown Patron";
                return `\`${i + 1}.\` **${name}**: ${u[1].msgCount} msgs (${(u[1].chars / 1000).toFixed(1)}k chars)`;
            })
            .join("\n");

        // --- 3. SOCIALITES (Most Mentioned) ---
        const topSocialites = Object.entries(data.users)
            .sort((a, b) => b[1].mentions - a[1].mentions)
            .slice(0, 3)
            .map((u, i) => {
                const user = bot.users.get(u[0]);
                const name = user ? user.username : "Unknown Patron";
                return `\`${i + 1}.\` **${name}**: ${u[1].mentions} mentions`;
            })
            .join("\n");

        // --- 4. HOT CHANNELS ---
        const hotChannels = Object.entries(data.channels)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map((c) => `<#${c[0]}>: ${c[1]} msgs`)
            .join(" | ");

        // Time until reset
        const nextReset = new Date(data.lastReset + 86400000);
        const timeRemaining = Math.round(nextReset.getTime() / 1000);

        await interaction.createMessage({
            embeds: [
                {
                    title: "📊 BTC-74 Activity Pulse",
                    color: 0x00ff99, // Cyber Green
                    description: `**Data Cycle Ends:** <t:${timeRemaining}:R>`,
                    fields: [
                        {
                            name: "🕓 24h Rhythms (GMT Local)",
                            value: `**AM:** ${amLine}\n**PM:** ${pmLine}\n*(⚫ Empty | 🟢 Low | 🟡 Med | 🔴 Busy)*`,
                            inline: false,
                        },
                        {
                            name: "📢 The Loudest Patrons",
                            value: topTalkers || "No data yet.",
                            inline: true,
                        },
                        {
                            name: "🥂 The Socialites",
                            value: topSocialites || "No data yet.",
                            inline: true,
                        },
                        {
                            name: "🔥 Hot Zones",
                            value: hotChannels || "The bar is quiet.",
                            inline: false,
                        },
                    ],
                    footer: { text: "Analytics update in real-time." },
                },
            ],
        });
    },
};
