const Eris = require("eris");
const fs = require("fs");
const path = require("path");

const DATA_PATH = path.join(__dirname, "../data/alias_history.json");

module.exports = {
    name: "identity",
    description: "Pull the forensic alias history of a user.",
    options: [
        {
            name: "user",
            description: "The subject to investigate.",
            type: 6, // User type
            required: true,
        },
    ],

    async execute(interaction, bot) {
        const targetId = interaction.data.options[0].value;

        // Resolve the user object (even if they aren't in the cache, try to get basic info)
        let targetUser =
            interaction.data.resolved?.users?.[targetId] ||
            bot.users.get(targetId);

        // If still missing (very rare), just use the ID
        const username = targetUser ? targetUser.username : "Unknown Subject";
        const avatarURL = targetUser ? targetUser.avatarURL : null;

        // Load History
        let history = [];
        try {
            if (fs.existsSync(DATA_PATH)) {
                const data = JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
                history = data[targetId] || [];
            }
        } catch (err) {
            console.error("Read Error:", err);
        }

        // --- RENDER REPORT ---

        if (history.length === 0) {
            return interaction.createMessage({
                embeds: [
                    {
                        title: `📂 Identity Record: ${username}`,
                        description:
                            "No alias changes detected on this frequency.\nSubject has maintained a consistent identity since tracking began.",
                        color: 0x00ff00, // Green / Clean
                        thumbnail: { url: avatarURL },
                    },
                ],
            });
        }

        // Format the Timeline
        // We reverse it to show newest changes first
        const timeline = history
            .slice()
            .reverse()
            .map((entry, index) => {
                const date = new Date(entry.timestamp).toLocaleDateString(
                    "en-US",
                    {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                    },
                );
                return `\`${date}\` : **${entry.name}**`;
            })
            .join("\n");

        await interaction.createMessage({
            embeds: [
                {
                    title: `📂 Forensic Log: ${username}`,
                    description: `**Subject ID:** \`${targetId}\`\n**Known Aliases:** ${history.length}\n\n**Chronological Manifest:**\n${timeline}`,
                    color: 0xff0055, // Cyber Pink
                    thumbnail: { url: avatarURL },
                    footer: {
                        text:
                            "BTC-74 Identity Tracking // " +
                            new Date().toLocaleTimeString(),
                    },
                },
            ],
        });
    },
};
