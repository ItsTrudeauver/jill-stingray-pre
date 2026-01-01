const fs = require("fs");
const path = require("path");

module.exports = {
    name: "8ball",
    description: "Ask Jill for guidance.",
    options: [
        {
            name: "question",
            description: "What is on your mind?",
            type: 3,
            required: true,
        },
    ],
    async execute(interaction, bot) {
        const question = interaction.data.options[0].value;
        const lowerQ = question.toLowerCase();

        // 1. Load Data
        const dataPath = path.join(__dirname, "../data/8ball_responses.json");
        let responses;
        try {
            responses = JSON.parse(fs.readFileSync(dataPath, "utf8"));
        } catch (err) {
            return interaction.createMessage({
                content: "I lost my notes. (JSON Error)",
                flags: 64,
            });
        }

        // 2. Dynamic Category Detection
        // We iterate over every key in the JSON. If the question matches a keyword, we switch.
        // We skip 'general' initially to check specific topics first.
        let selectedCategory = "general";

        for (const [category, data] of Object.entries(responses)) {
            if (category === "general") continue; // Skip generic for now

            // If this category has keywords and one matches...
            if (
                data.keywords &&
                data.keywords.some((k) => lowerQ.includes(k))
            ) {
                selectedCategory = category;
                break; // Stop looking, we found a specific match
            }
        }

        // 3. Selection Logic
        const categoryData = responses[selectedCategory];
        const intro =
            categoryData.intros[
                Math.floor(Math.random() * categoryData.intros.length)
            ];
        const answer =
            categoryData.answers[
                Math.floor(Math.random() * categoryData.answers.length)
            ];
        const outro =
            categoryData.outros[
                Math.floor(Math.random() * categoryData.outros.length)
            ];

        // 4. Dynamic Color & Aesthetic
        // We default to Purple, but use the category's specific color if defined in JSON
        const colorInt = categoryData.color
            ? parseInt(categoryData.color.replace("#", ""), 16)
            : 0xa45ee5;

        await interaction.createMessage({
            embeds: [
                {
                    title: "🎱 The Shaker Prediction",
                    description: `**Q:** ${question}\n\n"${intro} **${answer}** ${outro}"`,
                    color: colorInt,
                    footer: {
                        text: `Context: ${selectedCategory.toUpperCase()}`,
                    },
                    thumbnail: { url: bot.user.dynamicAvatarURL("png") },
                },
            ],
        });
    },
};
