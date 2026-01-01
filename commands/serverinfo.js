module.exports = {
    name: "serverinfo",
    description: "Check the establishment's details.",
    options: [],
    async execute(interaction, bot) {
        try {
            // FIX: Force fetch the guild from Discord API (Bypasses Cache)
            // The 'true' argument asks for member counts
            const guild = await bot.getRESTGuild(interaction.guildID, true);

            // Optional: Fetch channels separately because REST Guild doesn't include them
            const channels = await bot.getRESTGuildChannels(
                interaction.guildID,
            );

            // Formatting creation date
            const created = new Date(guild.createdAt).toLocaleDateString(
                "en-US",
                { year: "numeric", month: "long", day: "numeric" },
            );

            await interaction.createMessage({
                embeds: [
                    {
                        title: `📍 Establishment: ${guild.name}`,
                        description:
                            guild.description ||
                            "No description provided for this location.",
                        color: 0x00ff99, // Cyber Green
                        thumbnail: { url: guild.iconURL || null },
                        image: { url: guild.bannerURL || null },
                        fields: [
                            {
                                name: "Owner",
                                value: `<@${guild.ownerID}>`,
                                inline: true,
                            },
                            // REST Guild uses 'approximateMemberCount' instead of 'memberCount'
                            {
                                name: "Occupancy",
                                value: `**${guild.approximateMemberCount}** Patrons`,
                                inline: true,
                            },
                            {
                                name: "Established",
                                value: created,
                                inline: true,
                            },
                            {
                                name: "Layout",
                                value: `**${channels.length}** Channels\n**${guild.roles.size}** Roles`,
                                inline: true,
                            },
                            {
                                name: "Security Level",
                                value: `Verification: ${guild.verificationLevel}`,
                                inline: true,
                            },
                        ],
                        footer: { text: `ID: ${guild.id}` },
                    },
                ],
            });
        } catch (err) {
            console.error(err);
            await interaction.createMessage({
                content:
                    "I couldn't pull the files for this location. (API Error)",
                flags: 64,
            });
        }
    },
};
