module.exports = {
    name: "userinfo",
    description: "Pull up a patron's file (Live Database).",
    options: [
        {
            name: "user",
            description: "The patron to look up (defaults to you).",
            type: 6, // USER
            required: false,
        },
    ],
    async execute(interaction, bot) {
        // 1. Determine Target ID
        const targetID =
            interaction.data.options && interaction.data.options[0]
                ? interaction.data.options[0].value
                : interaction.member.user.id;

        try {
            // 2. REST FETCH: Get Member and User directly from Discord
            const member = await bot.getRESTGuildMember(
                interaction.guildID,
                targetID,
            );
            const user = await bot.getRESTUser(targetID);

            // 3. Format Dates
            const registered = new Date(user.createdAt).toLocaleDateString(
                "en-US",
                { year: "numeric", month: "long", day: "numeric" },
            );
            const joined = new Date(member.joinedAt).toLocaleDateString(
                "en-US",
                { year: "numeric", month: "long", day: "numeric" },
            );

            // 4. PROCESS ROLES
            // We map IDs to mentions (<@&ID>). The client (Discord App) resolves these to names/colors.
            let roleList = member.roles.map((r) => `<@&${r}>`).join(", ");

            // Fallback for no roles
            if (roleList.length === 0) roleList = "No specific affiliations.";

            // SAFETY: Truncate if list exceeds Embed Field limit (1024 chars)
            if (roleList.length > 1000) {
                const hiddenCount =
                    member.roles.length -
                    roleList.substring(0, 1000).split(",").length;
                roleList =
                    roleList.substring(0, 1000) +
                    `... (and ${hiddenCount} more)`;
            }

            await interaction.createMessage({
                embeds: [
                    {
                        title: `📂 Patron File: ${user.username}`,
                        color: 0xa45ee5, // Neon Purple
                        thumbnail: { url: user.dynamicAvatarURL("png", 1024) },
                        fields: [
                            {
                                name: "Identity",
                                value: `**ID:** \`${user.id}\`\n**Tag:** ${user.username}#${user.discriminator}`,
                                inline: true,
                            },
                            {
                                name: "Timestamps",
                                value: `**Registered:** ${registered}\n**Tab Opened:** ${joined}`,
                                inline: true,
                            },
                            {
                                name: "Affiliations",
                                value: roleList,
                                inline: false,
                            }, // Listed here
                        ],
                        footer: { text: "Glitch City • Citizen Database" },
                        timestamp: new Date().toISOString(),
                    },
                ],
            });
        } catch (err) {
            console.error(err);
            await interaction.createMessage({
                content:
                    "Unable to retrieve this file. They may have left the establishment.",
                flags: 64,
            });
        }
    },
};
