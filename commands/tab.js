const { getPatronStats } = require("../utils/patronSystem.js");

module.exports = {
    name: "tab",
    description: "View your patron file and drinking history.",
    options: [
        {
            name: "user",
            description: "Check someone else's tab.",
            type: 6, // User type
            required: false,
        },
    ],

    async execute(interaction, bot) {
        // Target is either the mentioned user OR the command runner
        const targetUser =
            interaction.data.options && interaction.data.options[0]
                ? interaction.data.options[0].value
                : interaction.member.id;

        // --- FIX: ROBUST MEMBER FETCHING ---
        // 1. Try to get from the resolved interaction data (if they were mentioned)
        let member = interaction.data.resolved?.users?.[targetUser];

        // 2. If not found there, and it's the person running the command, use them.
        if (!member && targetUser === interaction.member.id) {
            member = interaction.member.user;
        }

        // 3. If still not found, try the bot's global user cache.
        if (!member) {
            member = bot.users.get(targetUser);
        }

        // 4. If they simply don't exist (left server/deleted), use a placeholder to prevent crash.
        if (!member) {
            member = {
                username: "Unknown Patron",
                avatarURL: null, // embed will handle null gracefully or you can set a default URL
            };
        }

        // Fetch Data
        const stats = getPatronStats(targetUser);

        if (!stats) {
            return interaction.createMessage({
                content: `📁 **No Record Found.**\n<@${targetUser}> hasn't ordered anything yet.`,
            });
        }

        // Flavor Text based on Total Orders
        let karmotrineLevel = "Sober";
        if (stats.total > 5) karmotrineLevel = "Buzzed";
        if (stats.total > 20) karmotrineLevel = "Tipsy";
        if (stats.total > 50) karmotrineLevel = "Inebriated";
        if (stats.total > 100) karmotrineLevel = "Glitch City Legend";

        // Format Date
        const dateStr = new Date(stats.lastVisit).toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
        });

        await interaction.createMessage({
            embeds: [
                {
                    title: `📁 PATRON FILE: ${member.username}`,
                    color: 0xff0055, // Cyber Pink
                    thumbnail: { url: member.avatarURL },
                    fields: [
                        {
                            name: "The Usual 🍸",
                            value: stats.usual,
                            inline: true,
                        },
                        {
                            name: "Total Served 🧾",
                            value: stats.total.toString(),
                            inline: true,
                        },
                        {
                            name: "Karmotrine Level ⚠️",
                            value: karmotrineLevel,
                            inline: true,
                        },
                        {
                            name: "Last Sighting 🗓️",
                            value: dateStr,
                            inline: false,
                        },
                    ],
                    footer: { text: "BTC-74 Database | VA-11 HALL-A" },
                },
            ],
        });
    },
};
