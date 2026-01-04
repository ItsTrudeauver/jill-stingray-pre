const Eris = require("eris");
const fs = require("fs");
const path = require("path");
const Permissions = require("../utils/permissions");

// Paths to your data files
const EMOJI_PATH = path.join(__dirname, "../data/emoji_stats.json");
const PATRON_PATH = path.join(__dirname, "../data/patrons.json");

module.exports = {
    name: "ghost",
    description: "Data Integrity & Forensics (The Ghost Hunter).",
    options: [],

    async execute(interaction, bot) {
        if (!await Permissions.check(interaction, 'ghost')) return;

        await interaction.acknowledge();

        // Initialize Session
        pendingActions.set(interaction.member.id, {
            type: "ghost_session",
            guildId: interaction.guildID,
            step: "menu",
        });

        await sendGhostMenu(interaction);
    },

    async handleInteraction(interaction, bot, data) {
        const customId = interaction.data.custom_id;
        const guild = bot.guilds.get(interaction.guildID);
        if (!guild) return;

        // --- A. MAIN MENU ---
        if (customId === "ghost_home") {
            await sendGhostMenu(interaction);
        }

        // --- B. EMOTE PURGE SCAN ---
        else if (customId === "ghost_scan_emotes") {
            let stats = {};
            try {
                if (fs.existsSync(EMOJI_PATH)) {
                    stats = JSON.parse(fs.readFileSync(EMOJI_PATH, "utf8"));
                }
            } catch (err) {
                console.error(err);
            }

            const storedIds = Object.keys(stats);
            // Identify IDs in JSON that are NOT in the Guild anymore
            const ghosts = storedIds.filter(
                (id) => !guild.emojis.find((e) => e.id === id),
            );

            if (ghosts.length === 0) {
                return interaction.editParent({
                    embeds: [
                        {
                            title: "👻 Emote Integrity Scan",
                            description:
                                "✅ **Clean.**\nAll tracked emotes exist in the server. No ghost data found.",
                            color: 0x00ff00,
                            thumbnail: { url: interaction.member.avatarURL },
                        },
                    ],
                    components: [
                        {
                            type: 1,
                            components: [
                                {
                                    type: 2,
                                    style: 2,
                                    label: "Return",
                                    custom_id: "ghost_home",
                                },
                            ],
                        },
                    ],
                });
            }

            // Save state for deletion
            data.targetType = "emotes";
            data.targets = ghosts;
            data.stats = stats; // Cache the file content

            await interaction.editParent({
                embeds: [
                    {
                        title: "👻 Emote Ghosts Detected",
                        description: `**Found ${ghosts.length} broken entries.**\n\nThese are emotes that were deleted from the server, but still take up space in your analytics file.`,
                        fields: [
                            {
                                name: "Ghost IDs (Sample)",
                                value:
                                    ghosts.slice(0, 5).join("\n") +
                                    (ghosts.length > 5
                                        ? `\n...and ${ghosts.length - 5} more`
                                        : ""),
                            },
                        ],
                        color: 0xffa500,
                    },
                ],
                components: [
                    {
                        type: 1,
                        components: [
                            {
                                type: 2,
                                style: 4,
                                label: `Exorcise ${ghosts.length} Ghosts`,
                                custom_id: "ghost_confirm_purge",
                                emoji: { name: "🔥" },
                            },
                            {
                                type: 2,
                                style: 2,
                                label: "Cancel",
                                custom_id: "ghost_home",
                            },
                        ],
                    },
                ],
            });
        }

        // --- C. PATRON SYNC SCAN ---
        else if (customId === "ghost_scan_patrons") {
            let patrons = {};
            try {
                if (fs.existsSync(PATRON_PATH)) {
                    patrons = JSON.parse(fs.readFileSync(PATRON_PATH, "utf8"));
                }
            } catch (err) {
                console.error(err);
            }

            const patronIds = Object.keys(patrons);
            // Find IDs in the database that are NOT in the member list
            // Note: If the server is huge, ensure Members are cached.
            // For typical bots, guild.members is populated.
            const missing = patronIds.filter((id) => !guild.members.has(id));

            if (missing.length === 0) {
                return interaction.editParent({
                    embeds: [
                        {
                            title: "🍸 Patron Integrity Scan",
                            description:
                                "✅ **Synced.**\nAll registered patrons are currently present in the server.",
                            color: 0x00ff00,
                            thumbnail: { url: interaction.member.avatarURL },
                        },
                    ],
                    components: [
                        {
                            type: 1,
                            components: [
                                {
                                    type: 2,
                                    style: 2,
                                    label: "Return",
                                    custom_id: "ghost_home",
                                },
                            ],
                        },
                    ],
                });
            }

            data.targetType = "patrons";
            data.targets = missing;
            data.patrons = patrons;

            await interaction.editParent({
                embeds: [
                    {
                        title: "🍸 Missing Patrons Detected",
                        description: `**Found ${missing.length} Missing Persons.**\n\nThese users have data in your tab system but have left the server.`,
                        fields: [
                            {
                                name: "Missing IDs (Sample)",
                                value:
                                    missing.slice(0, 5).join("\n") +
                                    (missing.length > 5
                                        ? `\n...and ${missing.length - 5} more`
                                        : ""),
                            },
                        ],
                        color: 0xffa500,
                    },
                ],
                components: [
                    {
                        type: 1,
                        components: [
                            {
                                type: 2,
                                style: 4,
                                label: `Archive ${missing.length} Records`,
                                custom_id: "ghost_confirm_purge",
                                emoji: { name: "🗄️" },
                            },
                            {
                                type: 2,
                                style: 2,
                                label: "Cancel",
                                custom_id: "ghost_home",
                            },
                        ],
                    },
                ],
            });
        }

        // --- D. EXECUTE PURGE ---
        else if (customId === "ghost_confirm_purge") {
            const count = data.targets.length;

            if (data.targetType === "emotes") {
                // Delete keys from data.stats
                data.targets.forEach((id) => delete data.stats[id]);
                fs.writeFileSync(
                    EMOJI_PATH,
                    JSON.stringify(data.stats, null, 2),
                );

                await interaction.editParent({
                    embeds: [
                        {
                            title: "🔥 Exorcism Complete",
                            description: `Successfully removed **${count}** broken emote entries from the database.\nYour analytics are now clean.`,
                            color: 0xff0055,
                            thumbnail: { url: interaction.member.avatarURL },
                        },
                    ],
                    components: [
                        {
                            type: 1,
                            components: [
                                {
                                    type: 2,
                                    style: 2,
                                    label: "Return",
                                    custom_id: "ghost_home",
                                },
                            ],
                        },
                    ],
                });
            } else if (data.targetType === "patrons") {
                // For patrons, we might not want to DELETE (history is valuable),
                // but for this specific request "Purge/Sync", we will add a flag or remove them.
                // Let's add a "leftServer: true" flag instead of deleting, to preserve history (Jill's vibe).

                data.targets.forEach((id) => {
                    if (data.patrons[id]) {
                        data.patrons[id].leftServer = true;
                        data.patrons[id].archivedAt = Date.now();
                    }
                });
                fs.writeFileSync(
                    PATRON_PATH,
                    JSON.stringify(data.patrons, null, 2),
                );

                await interaction.editParent({
                    embeds: [
                        {
                            title: "🗄️ Archive Complete",
                            description: `Marked **${count}** patrons as 'Left Server'.\nTheir drink history is preserved but flagged as inactive.`,
                            color: 0xff0055,
                            thumbnail: { url: interaction.member.avatarURL },
                        },
                    ],
                    components: [
                        {
                            type: 1,
                            components: [
                                {
                                    type: 2,
                                    style: 2,
                                    label: "Return",
                                    custom_id: "ghost_home",
                                },
                            ],
                        },
                    ],
                });
            }
        }
    },
};

function sendGhostMenu(interaction) {
    const payload = {
        embeds: [
            {
                title: "👻 The Ghost Hunter // Data Integrity",
                description:
                    "Scans local databases against server reality to prevent data rot.",
                color: 0x9900ff,
                fields: [
                    {
                        name: "🔥 Emote Purge",
                        value: "Scans `emoji_stats.json`. Removes data for emotes that no longer exist.",
                        inline: false,
                    },
                    {
                        name: "🍸 Patron Sync",
                        value: "Scans `patrons.json`. Flags users who have left the server.",
                        inline: false,
                    },
                ],
                footer: { text: "Database Maintenance Protocol" },
            },
        ],
        components: [
            {
                type: 1,
                components: [
                    {
                        type: 2,
                        style: 1,
                        label: "Scan Emotes",
                        custom_id: "ghost_scan_emotes",
                        emoji: { name: "🔥" },
                    },
                    {
                        type: 2,
                        style: 1,
                        label: "Scan Patrons",
                        custom_id: "ghost_scan_patrons",
                        emoji: { name: "🍸" },
                    },
                ],
            },
        ],
    };

    if (interaction.editParent) return interaction.editParent(payload);
    return interaction.createMessage(payload);
}
