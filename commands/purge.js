const fs = require("fs");
const path = require("path");

module.exports = {
    name: "clean",
    description: "Sweep away messages and scold the messy ones.",
    options: [
        {
            name: "amount",
            description: "Number of messages to delete (2-100).",
            type: 4, // Integer
            required: true,
            min_value: 2,
            max_value: 100,
        },
    ],
    async execute(interaction, bot) {
        // 1. PERMISSION CHECK
        if (!interaction.member.permissions.has("manageMessages")) {
            return interaction.createMessage({
                content: "❌ You don't have the authority to clean this bar.",
                flags: 64,
            });
        }

        const amount = interaction.data.options[0].value;

        // Acknowledge (Ephemeral to start)
        await interaction.defer(64);

        try {
            // 2. FETCH MESSAGES
            const messages = await bot.getMessages(interaction.channel.id, {
                limit: amount,
            });

            if (messages.length === 0) {
                return interaction.createMessage({
                    content: "There's nothing here to clean.",
                    flags: 64,
                });
            }

            // 3. ANALYZE (Count per user)
            const userCounts = {};
            const messageIds = [];
            const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;

            for (const msg of messages) {
                if (msg.timestamp < twoWeeksAgo) continue;
                messageIds.push(msg.id);
                const authorName = msg.author.username;
                userCounts[authorName] = (userCounts[authorName] || 0) + 1;
            }

            if (messageIds.length === 0) {
                return interaction.editOriginalMessage({
                    content:
                        "All messages were too old (14+ days). I can't scrub that history.",
                });
            }

            // 4. FIND TOP OFFENDER
            let topOffender = null;
            let maxCount = 0;
            for (const [user, count] of Object.entries(userCounts)) {
                if (count > maxCount) {
                    maxCount = count;
                    topOffender = user;
                }
            }

            // 5. FLAVOR TEXT
            const genericQuotes = [
                "I'm not a janitor, you know.",
                "Do you people ever stop talking?",
                "Cleaning up your mess. Again.",
                "Silence is golden. Expensive, but golden.",
                "I should start charging a cleaning fee.",
                "This conversation was going nowhere anyway.",
                "Finally, some peace and quiet.",
            ];

            const scoldQuotes = [
                `**${topOffender}**, you never shut up, do you?`,
                `Half of this trash belonged to **${topOffender}**. Get a hobby.`,
                `I'm looking at you, **${topOffender}**. You're the problem.`,
                `Congratulations, **${topOffender}**, you win the 'Loudest Patron' award. Now get out.`,
                `**${topOffender}**, do you breathe between messages?`,
                `If I had a dollar for every message **${topOffender}** sent, I'd retire.`,
            ];

            let flavorText = "";
            if (topOffender && maxCount > 3 && Math.random() > 0.5) {
                flavorText =
                    scoldQuotes[Math.floor(Math.random() * scoldQuotes.length)];
            } else {
                flavorText =
                    genericQuotes[
                        Math.floor(Math.random() * genericQuotes.length)
                    ];
            }

            // 6. EXECUTE DELETE
            await bot.deleteMessages(interaction.channel.id, messageIds);

            // 7. PREPARE IMAGE (Local vs Remote)
            // We prioritize the local file for instant loading
            const localPath = path.join(__dirname, "../data/images/clean.png");
            let fileAttachment = null;
            let imageUrl =
                "https://media.discordapp.net/attachments/995879199959162882/1455993198588465223/976892.png?ex=6956bed5&is=69556d55&hm=6891dd875683ed8ee4d6371ac04bf98fa68d39e75a2684088cb79fe67620e4c1&=&format=webp&quality=lossless&width=1515&height=758";

            if (fs.existsSync(localPath)) {
                fileAttachment = {
                    file: fs.readFileSync(localPath),
                    name: "cleanup.png",
                };
                imageUrl = "attachment://cleanup.png";
            }

            // 8. SEND REPORT
            const stats = Object.entries(userCounts)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 5)
                .map(([user, count]) => `**${user}**: ${count}`)
                .join("\n");

            // We use createMessage to ensure it's visible (not ephemeral)
            await interaction.createMessage(
                {
                    embeds: [
                        {
                            title: "🧹 Cleanup Complete",
                            description: `Deleted **${messageIds.length}** messages.\n\n${flavorText}`,
                            color: 0xff0055,
                            image: { url: imageUrl },
                            fields: [
                                {
                                    name: "The Noise Makers",
                                    value: stats || "Unknown",
                                    inline: false,
                                },
                            ],
                            footer: {
                                text: "Augmented Eye | Janitorial Services",
                            },
                        },
                    ],
                },
                fileAttachment,
            ); // Pass the file object here
        } catch (err) {
            console.error(err);
            try {
                await interaction.editOriginalMessage({
                    content: "❌ Failed to sweep the floor.",
                });
            } catch (e) {}
        }
    },
};
