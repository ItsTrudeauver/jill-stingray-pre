const fs = require("fs");
const path = require("path");

const DB_PATH = path.join(__dirname, "../data/emoji_stats.json");

module.exports = {
    name: "emojistats",
    description: "Analyze server emoji usage.",
    options: [
        {
            name: "top",
            description: "Show the most popular emojis.",
            type: 1, // Subcommand
        },
        {
            name: "stale",
            description: "Show emojis that are rarely used.",
            type: 1, // Subcommand
        },
        {
            name: "info",
            description: "Check stats for a specific emoji.",
            type: 1, // Subcommand
            options: [
                {
                    name: "emoji",
                    description: "The custom emoji to check (paste it here).",
                    type: 3, // String
                    required: true,
                },
            ],
        },
    ],

    async execute(interaction, bot) {
        let stats = {};
        try {
            stats = JSON.parse(fs.readFileSync(DB_PATH));
        } catch (e) {}

        const sub = interaction.data.options[0].name;
        const guild = bot.guilds.get(interaction.guildID);

        // --- SUBCOMMAND: TOP ---
        if (sub === "top") {
            // Filter: Only show emojis that CURRENTLY exist in the server
            const sorted = Object.entries(stats)
                .filter(([id]) => guild.emojis.find((e) => e.id === id))
                .sort((a, b) => b[1].count - a[1].count)
                .slice(0, 10);

            if (sorted.length === 0)
                return interaction.createMessage("No data yet.");

            let desc = sorted
                .map((entry, i) => {
                    const [id, data] = entry;
                    const emojiStr = `<${data.animated ? "a" : ""}:${data.name}:${id}>`;
                    return `**#${i + 1}** ${emojiStr} \`${data.name}\` — **${data.count}** uses`;
                })
                .join("\n");

            await interaction.createMessage({
                embeds: [
                    {
                        title: "📊 Augmented Eye | Emoji Analytics",
                        description: desc,
                        color: 0x00ff9d,
                        image: {url: "https://images.rpgsite.net/articles/cover/da49c9a1/6513/cover/valhallaheader.png"}
                    },
                ],
            });
        }

        // --- SUBCOMMAND: STALE (Bottom 15) ---
        else if (sub === "stale") {
            // Filter for existing emojis only
            const sorted = Object.entries(stats)
                .filter(([id]) => guild.emojis.find((e) => e.id === id))
                .sort((a, b) => a[1].count - b[1].count)
                .slice(0, 15);

            let desc = sorted
                .map((entry) => {
                    const [id, data] = entry;
                    const emojiStr = `<${data.animated ? "a" : ""}:${data.name}:${id}>`;
                    return `${emojiStr} \`${data.name}\`: **${data.count}** uses`;
                })
                .join("\n");

            await interaction.createMessage({
                embeds: [
                    {
                        title: "🕸️ Dusty Emojis (Least Used)",
                        description: desc || "All emojis are being used!",
                        color: 0x555555,
                        footer: { text: "Candidates for deletion?" },
                        image: {
                            url: "https://images.rpgsite.net/articles/cover/da49c9a1/6513/cover/valhallaheader.png",
                        },
                    },
                ],
            });
        }

        // --- SUBCOMMAND: INFO ---
        else if (sub === "info") {
            const input = interaction.data.options[0].options[0].value;
            const match = /:(\d+)>/.exec(input);

            if (!match) {
                return interaction.createMessage({
                    content: "❌ That doesn't look like a custom emoji.",
                    flags: 64,
                });
            }

            const id = match[1];
            const data = stats[id];

            if (!data) {
                return interaction.createMessage(
                    "No stats found for this emoji yet.",
                );
            }

            const emojiStr = `<${data.animated ? "a" : ""}:${data.name}:${id}>`;
            const date = new Date(data.lastUsed).toLocaleDateString();

            await interaction.createMessage({
                embeds: [
                    {
                        title: "Emoji Deep Dive",
                        image: {
                            url: "https://images.rpgsite.net/articles/cover/da49c9a1/6513/cover/valhallaheader.png",
                        },
                        description: `# ${emojiStr}`,
                        fields: [
                            {
                                name: "Name",
                                value: `\`${data.name}\``,
                                inline: true,
                            },
                            {
                                name: "Uses",
                                value: data.count.toString(),
                                inline: true,
                            },
                            { name: "ID", value: id, inline: true },
                            { name: "Last Seen", value: date, inline: false },
                        ],
                        color: 0xff0055,
                    },
                ],
            });
        }
    },
};
