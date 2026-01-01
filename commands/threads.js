const Eris = require("eris");

module.exports = {
    name: "threads",
    description: "Analyze active threads and identifying stale conversations.",
    options: [],

    async execute(interaction, bot) {
        const guild = bot.guilds.get(interaction.guildID);
        if (!guild) return;

        // 1. Fetch Active Threads
        // Eris caches active threads in guild.threads
        const threads = guild.threads.map((t) => t);
        const total = threads.length;

        if (total === 0) {
            return interaction.createMessage({
                embeds: [
                    {
                        title: "🧵 Thread Lifecycle Report",
                        description:
                            "No active threads detected.\nThe floor is clear.",
                        color: 0x00ff00, // Clean
                        thumbnail: {
                            url:
                                interaction.member.avatarURL ||
                                interaction.member.user.avatarURL,
                        },
                    },
                ],
            });
        }

        // 2. Analyze Staleness
        // We define "Stale" as no activity for > 3 Days (259200000 ms)
        // We define "Blooming" as activity in < 24 Hours
        const now = Date.now();
        const THREE_DAYS = 259200000;
        const ONE_DAY = 86400000;

        let blooming = [];
        let active = [];
        let stale = [];

        threads.forEach((t) => {
            // Calculate time since last message using the Snowflake ID of the last message
            // If no lastMessageID, use the thread ID (creation time)
            const lastId = t.lastMessageID || t.id;
            const timestamp = Number((BigInt(lastId) >> 22n) + 1420070400000n);
            const age = now - timestamp;

            const data = {
                name: t.name,
                id: t.id,
                parentId: t.parentID,
                ageDisplay: `<t:${Math.floor(timestamp / 1000)}:R>`,
            };

            if (age < ONE_DAY) blooming.push(data);
            else if (age > THREE_DAYS) stale.push(data);
            else active.push(data);
        });

        // 3. Construct the Report
        const fields = [];

        // blooming (Hot)
        if (blooming.length > 0) {
            const list = blooming
                .slice(0, 5)
                .map((t) => `🔹 <#${t.id}> (${t.ageDisplay})`)
                .join("\n");
            fields.push({
                name: `🔥 Blooming (${blooming.length})`,
                value: `*High velocity conversations:*\n${list}`,
                inline: false,
            });
        }

        // Stale (Dead?)
        if (stale.length > 0) {
            const list = stale
                .slice(0, 10)
                .map((t) => `🔸 <#${t.id}> (Last active: ${t.ageDisplay})`)
                .join("\n");
            fields.push({
                name: `🕸️ Stale / Abandoned (${stale.length})`,
                value: `*No activity for 3+ days. Consider archiving:*\n${list}`,
                inline: false,
            });
        }

        // Summary Stats
        const summary = `**Total Threads:** ${total}\n**Active:** ${active.length} | **Hot:** ${blooming.length} | **Stale:** ${stale.length}`;

        await interaction.createMessage({
            embeds: [
                {
                    title: "🧵 Thread Lifecycle Forensics",
                    description: summary,
                    color: stale.length > 5 ? 0xffa500 : 0x00ffff, // Orange if cluttered, Cyan if clean
                    fields: fields,
                    thumbnail: {
                        url:
                            interaction.member.avatarURL ||
                            interaction.member.user.avatarURL,
                    },
                    footer: { text: "Stale threads clutter the channel list." },
                },
            ],
        });
    },
};
