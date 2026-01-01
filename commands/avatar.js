module.exports = {
    name: "avatar",
    description: "Get a clear shot of a patron's face.",
    options: [
        {
            name: "user",
            description: "The user to view (defaults to you).",
            type: 6, // USER
            required: false,
        },
    ],
    async execute(interaction, bot) {
        const targetID =
            interaction.data.options && interaction.data.options[0]
                ? interaction.data.options[0].value
                : interaction.member.user.id;

        try {
            // DYNAMIC FETCH: Ensure we have the full User object
            const user = await bot.getRESTUser(targetID);
            const avatarUrl = user.dynamicAvatarURL("png", 4096);

            await interaction.createMessage({
                embeds: [
                    {
                        title: `📷 ID Photo: ${user.username}`,
                        color: 0xa45ee5,
                        image: { url: avatarUrl },
                        description: `[Open in Browser](${avatarUrl})`,
                        footer: { text: "Looking sharp." },
                    },
                ],
            });
        } catch (err) {
            await interaction.createMessage({
                content: "Could not retrieve photo data.",
                flags: 64,
            });
        }
    },
};
