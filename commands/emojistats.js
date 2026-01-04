const { db } = require("../utils/db");

module.exports = {
    name: "emojistats",
    description: "Analyze server emoji usage.",
    options: [
        { name: "top", description: "Most popular emojis.", type: 1 },
        { name: "stale", description: "Rarely used emojis.", type: 1 },
        {
            name: "info",
            description: "Check a specific emoji.",
            type: 1,
            options: [{ name: "emoji", description: "Paste emoji here.", type: 3, required: true }]
        }
    ],

    async execute(interaction, bot) {
        const sub = interaction.data.options[0].name;
        const guild = bot.guilds.get(interaction.guildID);

        // --- TOP ---
        if (sub === "top") {
            const res = await db.query(`
                SELECT * FROM emojis 
                WHERE guild_id = $1 
                ORDER BY count DESC
            `, [interaction.guildID]);

            // Filter: Only show ones that exist in Discord
            const valid = res.rows
                .filter(row => guild.emojis.find(e => e.id === row.emoji_id))
                .slice(0, 10);

            const desc = valid.map((e, i) => {
                const tag = `<${e.is_animated ? "a" : ""}:${e.name}:${e.emoji_id}>`;
                return `**#${i + 1}** ${tag} \`${e.name}\` — **${e.count}** uses`;
            }).join("\n");

            return interaction.createMessage({
                embeds: [{ title: "📊 Emoji Analytics (Top)", description: desc || "No data.", color: 0x00ff9d }]
            });
        }

        // --- STALE ---
        if (sub === "stale") {
            const res = await db.query(`
                SELECT * FROM emojis 
                WHERE guild_id = $1 
                ORDER BY count ASC
            `, [interaction.guildID]);

            const valid = res.rows
                .filter(row => guild.emojis.find(e => e.id === row.emoji_id))
                .slice(0, 15);

            const desc = valid.map(e => {
                const tag = `<${e.is_animated ? "a" : ""}:${e.name}:${e.emoji_id}>`;
                return `${tag} \`${e.name}\`: **${e.count}** uses`;
            }).join("\n");

            return interaction.createMessage({
                embeds: [{ title: "🕸️ Dusty Emojis (Bottom 15)", description: desc || "All emojis used frequently!", color: 0x555555 }]
            });
        }

        // --- INFO ---
        if (sub === "info") {
            const input = interaction.data.options[0].options[0].value;
            const match = /:(\d+)>/.exec(input);
            if (!match) return interaction.createMessage("Invalid emoji format.");

            const res = await db.query(`
                SELECT * FROM emojis WHERE guild_id = $1 AND emoji_id = $2
            `, [interaction.guildID, match[1]]);
            
            const row = res.rows[0];
            if (!row) return interaction.createMessage("No stats found.");

            // Convert BIGINT to Date
            const date = new Date(parseInt(row.last_used)).toLocaleDateString();
            const tag = `<${row.is_animated ? "a" : ""}:${row.name}:${row.emoji_id}>`;

            return interaction.createMessage({
                embeds: [{
                    title: "Emoji Deep Dive",
                    description: `# ${tag}`,
                    fields: [
                        { name: "Name", value: `\`${row.name}\``, inline: true },
                        { name: "Uses", value: row.count.toString(), inline: true },
                        { name: "Last Seen", value: date, inline: true }
                    ],
                    color: 0xff0055
                }]
            });
        }
    }
};