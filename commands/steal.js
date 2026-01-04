const Permissions = require("../utils/permissions");

module.exports = {
    name: "steal",
    description: "Seize an emoji from another server and add it to this node.",
    options: [
        {
            name: "emoji",
            description: "Paste the emoji here.",
            type: 3, // String
            required: true,
        },
        {
            name: "rename",
            description: "Give it a new name (optional).",
            type: 3, // String
            required: false,
        },
    ],

    async execute(interaction) {
        if (!await Permissions.check(interaction, 'steal')) return;

        await interaction.defer();

        const rawEmoji = interaction.data.options[0].value;
        const rename = interaction.data.options[1]
            ? interaction.data.options[1].value
            : null;

        // 2. PARSE EMOJI (Regex for <a:name:id> or <:name:id>)
        // Group 1: 'a' (if animated), Group 2: Name, Group 3: ID
        const emojiRegex = /<?(a)?:?(\w{2,32}):(\d{17,19})>?/;
        const match = rawEmoji.match(emojiRegex);

        if (!match) {
            return interaction.editOriginalMessage({
                content:
                    "❌ **Target Invalid.** That doesn't look like a custom emoji I can steal. (Standard unicode emojis cannot be stolen).",
            });
        }

        const isAnimated = match[1] === "a";
        const originalName = match[2];
        const emojiId = match[3];
        const finalName = rename || originalName;

        // 3. FETCH ASSET
        const extension = isAnimated ? "gif" : "png";
        const url = `https://cdn.discordapp.com/emojis/${emojiId}.${extension}`;

        try {
            // Fetch the image data
            const response = await fetch(url);
            if (!response.ok) throw new Error("Failed to download emoji.");

            const arrayBuffer = await response.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);

            // Convert to Base64 Data URI (Required by Discord API)
            const base64Image = `data:image/${extension};base64,${buffer.toString("base64")}`;

            // 4. UPLOAD TO GUILD
            const newEmoji = await bot.createGuildEmoji(interaction.guildID, {
                name: finalName,
                image: base64Image,
            });

            // 5. REPORT SUCCESS
            // We use the NEW emoji in the title if possible, or just text
            const displayEmoji = isAnimated
                ? `<a:${newEmoji.name}:${newEmoji.id}>`
                : `<:${newEmoji.name}:${newEmoji.id}>`;

            await interaction.createMessage({
                embeds: [
                    {
                        title: `📦 Asset Seized: ${newEmoji.name}`,
                        description: `Successfully uploaded **${newEmoji.name}** to the server banks.`,
                        color: 0x00ff9d, // Cyber Green
                        thumbnail: { url: url }, // Show the original source image
                        fields: [
                            {
                                name: "Original ID",
                                value: `\`${emojiId}\``,
                                inline: true,
                            },
                            {
                                name: "New ID",
                                value: `\`${newEmoji.id}\``,
                                inline: true,
                            },
                        ],
                        footer: { text: "Augmented Eye | Asset Recovery" },
                    },
                ],
            });
        } catch (err) {
            console.error(err);
            // Handle common errors (like File too big, or No Emoji Slots left)
            let errorMsg = "❌ **Upload Failed.**";
            if (err.message.includes("256kb"))
                errorMsg += " The emoji file is too large (>256kb).";
            else if (err.code === 30008)
                errorMsg += " Maximum number of emojis reached.";
            else errorMsg += ` ${err.message}`;

            return interaction.editOriginalMessage({ content: errorMsg });
        }
    },
};
