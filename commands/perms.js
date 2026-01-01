module.exports = {
    name: "perms",
    description: "Calculate and generate a custom permission invite link.",

    async execute(interaction, bot) {
        // Default: View Channels (1024) + Send Messages (2048) + Manage Roles (268435456)
        // We include Manage Roles by default because your /role command breaks without it.
        await this.renderWizard(interaction, 268438528n, false);
    },

    async handleInteraction(interaction, bot) {
        if (
            !interaction.data ||
            !interaction.data.custom_id ||
            !interaction.data.custom_id.startsWith("perm_")
        )
            return;

        const parts = interaction.data.custom_id.split("_");
        const action = parts[1];
        const currentBitsStr = parts[2];

        let bits = BigInt(currentBitsStr);

        if (action === "toggle") {
            // Acknowledge to prevent "Interaction Failed"
            await interaction.acknowledge();

            const selectedBit = BigInt(interaction.data.values[0]);
            // XOR Toggle
            bits = bits ^ selectedBit;

            await this.renderWizard(interaction, bits, true);
        }
    },

    async renderWizard(interaction, bits, isEdit = false) {
        const bitsVal = BigInt(bits);

        // Comprehensive List based on common bot needs + your code's requirements
        const permList = [
            // --- CRITICAL FOR YOUR CODE ---
            { name: "Manage Roles", bit: 268435456n, required: true }, // Needed for /role
            { name: "Embed Links", bit: 16384n, required: true }, // Needed for almost all responses

            // --- COMMON MODERATION ---
            { name: "Administrator", bit: 8n },
            { name: "Manage Server", bit: 32n },
            { name: "Manage Channels", bit: 16n },
            { name: "Kick Members", bit: 2n },
            { name: "Ban Members", bit: 4n },
            { name: "Manage Messages", bit: 8192n },

            // --- UTILITY / STANDARD ---
            { name: "View Channels", bit: 1024n },
            { name: "Send Messages", bit: 2048n },
            { name: "Read Msg History", bit: 65536n },
            { name: "Attach Files", bit: 32768n },
            { name: "Add Reactions", bit: 64n },
            { name: "Use Ext. Emojis", bit: 262144n },
        ];

        let checklist = "";
        const options = [];

        for (const p of permList) {
            const has = (bitsVal & p.bit) !== 0n;

            // Visual Indicator
            let icon = has ? "✅" : "⬛";
            if (p.required && !has) icon = "⚠️"; // Warn if a required perm is missing

            checklist += `${icon} \`${p.name}\`\n`;

            options.push({
                label: p.name,
                value: p.bit.toString(),
                emoji: { name: has ? "➖" : "➕" },
                description: p.required
                    ? "Required for /role or embeds"
                    : undefined,
            });
        }

        const clientId = interaction.applicationID || bot.user.id;
        const inviteUrl = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&permissions=${bitsVal}&scope=bot%20applications.commands`;

        // Split checklist into two columns if it gets too long (Optional visual tweak)
        // For now, simple list is fine.

        const msgData = {
            embeds: [
                {
                    title: "Jill Stingray | Clearance Wizard",
                    // Use a code block for the list to keep alignment neat
                    description: `**Calculated Bitfield:** \`${bitsVal}\`\n[**Click to Authorize**](${inviteUrl})\n\n${checklist}`,
                    color: 0x00ff9d,
                    footer: {
                        text: "⚠️ = Permission recommended for current code.",
                    },
                },
            ],
            components: [
                {
                    type: 1,
                    components: [
                        {
                            type: 3, // Select Menu
                            custom_id: `perm_toggle_${bitsVal}`,
                            placeholder: "Toggle Permissions...",
                            min_values: 1,
                            max_values: 1,
                            options: options.slice(0, 25), // Discord limits selects to 25 items
                        },
                    ],
                },
                {
                    type: 1,
                    components: [
                        {
                            type: 2,
                            style: 5, // Link
                            label: "Authorize Bot",
                            url: inviteUrl,
                            emoji: { name: "🔗" },
                        },
                    ],
                },
            ],
        };

        try {
            if (isEdit) {
                await interaction.editOriginalMessage(msgData);
            } else {
                await interaction.createMessage(msgData);
            }
        } catch (err) {
            console.error("Failed to render wizard:", err);
        }
    },
};
