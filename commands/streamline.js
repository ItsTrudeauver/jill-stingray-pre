const wait = require("util").promisify(setTimeout);

// --- JILL'S DIALOGUE DATABASE ---
const dialogue = {
    high: [
        "Finally, someone with actual good taste. A classic.",
        "I'll admit, this one is actually worth the hype.",
        "Oh, this one? Yeah, it's good. Even *I* like it.",
        "Solid choice. I wouldn't mind putting this on the bar TV.",
    ],
    mid: [
        "It's decent. I might have watched this on a slow Tuesday.",
        "Not great, not terrible. Just... existing.",
        "It's okay. Good background noise while you're mixing drinks.",
        "Average. Like a beer that's been sitting out for ten minutes.",
    ],
    low: [
        "Wow. You actually enjoy this trash? I'm judging you.",
        "I can't believe you made me search for this.",
        "Do yourself a favor: go watch something else.",
        "This has '3 AM regret' written all over it.",
    ],
    trash: [
        "I refuse to believe a human being enjoys this.",
        "This is why the Turing Test exists.",
        "Garbage. Absolute garbage.",
    ],
    sus: [
        "P-Pervert! Why are you looking this up at a bar?!",
        "I'm not showing this on the main screen. You're gross.",
        "Keep your weird fetishes to yourself, boss.",
    ],
    mecha: [
        "Big robots? Hell yeah. Reminds me of Model Warrior Julianne.",
        "If it has a transformation sequence, I'm in.",
        "Mecha is the only genre that matters. Don't @ me.",
    ],
};

module.exports = {
    name: "streamline",
    description: "Access the Augmented Eye media database (Anime/Manga).",
    options: [
        {
            name: "anime",
            description: "Search for an anime series.",
            type: 1,
            options: [
                {
                    name: "title",
                    description: "Title of the anime.",
                    type: 3,
                    required: true,
                },
            ],
        },
        {
            name: "manga",
            description: "Search for a manga series.",
            type: 1,
            options: [
                {
                    name: "title",
                    description: "Title of the manga.",
                    type: 3,
                    required: true,
                },
            ],
        },
    ],

    async execute(interaction, bot) {
        const sub = interaction.data.options[0];
        const query = sub.options[0].value;
        const type = sub.name; // 'anime' or 'manga'

        await interaction.createMessage({
            content: `**[Augmented Eye]** Searching database for *"${query}"*...`,
        });

        try {
            const url = `https://api.jikan.moe/v4/${type}?q=${encodeURIComponent(query)}&limit=1&sfw=true`;
            const response = await fetch(url);
            const data = await response.json();

            if (!data.data || data.data.length === 0) {
                return interaction.editOriginalMessage({
                    content: `**[404]** No results found. You sure you spelled that right?`,
                });
            }

            const result = data.data[0];
            const score = result.score || 0;
            const genres = result.genres.map((g) => g.name);
            const isMecha = genres.includes("Mecha");
            const isSus =
                result.rating &&
                (result.rating.includes("Rx") ||
                    result.rating.includes("Hentai"));

            // --- JILL'S COMMENTARY SWITCH ---
            // Using switch(true) allows for cleaner range and logic handling
            let commentary = "";
            let pool = [];

            switch (true) {
                case isSus:
                    pool = dialogue.sus;
                    break;
                case isMecha:
                    pool = dialogue.mecha;
                    break;
                case score >= 8.5:
                    pool = dialogue.high;
                    break;
                case score >= 7.0:
                    pool = dialogue.mid;
                    break;
                case score >= 5.0:
                    pool = dialogue.low;
                    break;
                default:
                    pool = dialogue.trash;
                    break;
            }

            // Select random line from the chosen pool
            commentary = pool[Math.floor(Math.random() * pool.length)];

            // Formatting fields
            const statusEmoji =
                result.status === "Finished Airing" ? "✅" : "📺";
            const episodes = result.episodes || result.chapters || "??";
            const date = result.aired
                ? result.aired.string
                : result.published
                  ? result.published.string
                  : "Unknown Date";

            await interaction.editOriginalMessage({
                content: "",
                embeds: [
                    {
                        title: `${statusEmoji} ${result.title}`,
                        url: result.url,
                        description: `*${result.title_japanese || ""}*\n\n${result.synopsis ? result.synopsis.substring(0, 350) + "..." : "No synopsis available."}`,
                        color: 0x0099ff,
                        image: {
                            url: result.images.jpg.large_image_url,
                        },
                        fields: [
                            {
                                name: "Score",
                                value: `⭐ **${score}** / 10`,
                                inline: true,
                            },
                            {
                                name: "Type",
                                value: `${result.type} (${episodes} eps)`,
                                inline: true,
                            },
                            {
                                name: "Aired",
                                value: `${date}`,
                                inline: true,
                            },
                            {
                                name: "Genres",
                                value: genres.join(", ") || "None",
                                inline: false,
                            },
                        ],
                        footer: {
                            text: `Jill: "${commentary}"`,
                        },
                    },
                ],
            });
        } catch (err) {
            console.error(err);
            return interaction.editOriginalMessage({
                content:
                    "**[System Error]** The Augmented Eye is offline (API Error).",
            });
        }
    },
};
