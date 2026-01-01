// CONFIGURATION
const BANNER_IMAGE =
    "https://static.wikia.nocookie.net/va11halla/images/7/73/Jill%27s_upgraded_room.png/revision/latest?cb=20170112221922";
const PAGE_SIZE = 9; // 9 items fits a nice 3x3 grid

module.exports = {
    name: "help",
    description: "Browse the cocktail menu (Command List).",
    options: [],

    // --- MAIN EXECUTION ---
    async execute(interaction, bot) {
        const commands = Array.from(bot.commands.values()).sort((a, b) =>
            a.name.localeCompare(b.name),
        );
        await this.renderPage(interaction, commands, 0, interaction.member.id);
    },

    // --- INTERACTION HANDLER ---
    async handleInteraction(interaction, bot, ownerId) {
        const commands = Array.from(bot.commands.values()).sort((a, b) =>
            a.name.localeCompare(b.name),
        );

        // Custom ID format: action|owner|page
        const parts = interaction.data.custom_id.split("|");
        const action = parts[0];
        let page = parseInt(parts[2]);

        if (action === "help_nav") {
            // Next/Prev Buttons
            await this.renderPage(interaction, commands, page, ownerId, true);
        } else if (action === "help_jump") {
            // Jump to Page Dropdown
            const selectedPage = parseInt(interaction.data.values[0]);
            await this.renderPage(
                interaction,
                commands,
                selectedPage,
                ownerId,
                true,
            );
        } else if (action === "help_select") {
            // Command Detail View
            const selectedCmdName = interaction.data.values[0];
            const cmd = commands.find((c) => c.name === selectedCmdName);
            await this.renderDetail(interaction, cmd, page, ownerId);
        }
    },

    // --- RENDER FUNCTIONS ---

    // 1. Render the Main List (Grid Layout)
    async renderPage(interaction, commands, page, ownerId, isEdit = false) {
        const totalPages = Math.ceil(commands.length / PAGE_SIZE);
        if (page < 0) page = 0;
        if (page >= totalPages) page = totalPages - 1;

        const start = page * PAGE_SIZE;
        const currentBatch = commands.slice(start, start + PAGE_SIZE);

        // GRID LAYOUT: Use fields with inline: true
        const fields = currentBatch.map((c) => ({
            name: `/${c.name}`,
            value: c.description,
            inline: true, // This makes them stack horizontally
        }));

        const selectOptions = currentBatch.map((c) => ({
            label: `/${c.name}`,
            description: c.description.substring(0, 50),
            value: c.name,
        }));

        const embed = {
            title: "🍸 Jill Stingray | Command Menu",
            description: "Select a command below for full details.",
            color: 0xa45ee5, // Neon Purple
            image: { url: BANNER_IMAGE },
            fields: fields, // Now using grid fields
            footer: {
                text: `Augmented Eye Network | BTC-74`,
            },
        };

        const components = [];

        // Row 1: Command Select Menu
        components.push({
            type: 1,
            components: [
                {
                    type: 3, // String Select
                    custom_id: `help_select|${ownerId}|${page}`,
                    placeholder: "Select a command to view details...",
                    options: selectOptions,
                },
            ],
        });

        // Row 2: Page Jump Selector (Only show if we have multiple pages)
        if (totalPages > 1) {
            const pageOptions = [];
            for (let i = 0; i < totalPages; i++) {
                pageOptions.push({
                    label: `Page ${i + 1}`,
                    value: i.toString(),
                    description: `View commands ${i * PAGE_SIZE + 1}-${Math.min((i + 1) * PAGE_SIZE, commands.length)}`,
                    default: i === page,
                });
            }

            // Discord limits select options to 25
            if (pageOptions.length <= 25) {
                components.push({
                    type: 1,
                    components: [
                        {
                            type: 3,
                            custom_id: `help_jump|${ownerId}|${page}`,
                            placeholder: `Jump to page... (Current: ${page + 1})`,
                            options: pageOptions,
                        },
                    ],
                });
            }
        }

        // Row 3: Pagination Buttons
        components.push({
            type: 1,
            components: [
                {
                    type: 2, // Button
                    label: "Previous",
                    style: 1, // Blurple
                    custom_id: `help_nav|${ownerId}|${page - 1}`,
                    disabled: page === 0,
                },
                {
                    type: 2,
                    label: `Page ${page + 1} of ${totalPages}`, // Visual Indicator
                    style: 2, // Grey
                    custom_id: "noop", // No operation
                    disabled: true,
                },
                {
                    type: 2,
                    label: "Next",
                    style: 1, // Blurple
                    custom_id: `help_nav|${ownerId}|${page + 1}`,
                    disabled: page >= totalPages - 1,
                },
            ],
        });

        const payload = {
            embeds: [embed],
            components: components,
            content: "",
        };

        if (isEdit) {
            await interaction.editParent(payload);
        } else {
            await interaction.createMessage(payload);
        }
    },

    // 2. Render the Detail View (Single Command)
    async renderDetail(interaction, cmd, returnPage, ownerId) {
        let optionsText = "None";
        if (cmd.options && cmd.options.length > 0) {
            optionsText = cmd.options
                .map((o) => {
                    const typeMap = {
                        3: "String",
                        4: "Integer",
                        5: "Boolean",
                        6: "User",
                        8: "Role",
                        1: "Subcommand",
                    };
                    const req = o.required ? "(Required)" : "(Optional)";
                    return `\`${o.name}\` - ${o.description} *${typeMap[o.type] || "Unknown"} ${req}*`;
                })
                .join("\n");
        }

        let permText = "None (Public)";
        if (cmd.defaultMemberPermissions) {
            permText = "⚠️ Restricted (Moderators/Admins)";
        }

        const embed = {
            title: `Start-up / ${cmd.name}`,
            color: 0x00ff99, // Cyber Green
            fields: [
                { name: "Description", value: cmd.description },
                { name: "Usage / Arguments", value: optionsText },
                { name: "Permissions", value: permText },
            ],
            footer: { text: "Press Back to return to the menu." },
        };

        await interaction.editParent({
            embeds: [embed],
            components: [
                {
                    type: 1,
                    components: [
                        {
                            type: 2, // Button
                            label: "Back to Menu",
                            style: 2, // Grey
                            emoji: { name: "↩️", id: null },
                            custom_id: `help_nav|${ownerId}|${returnPage}`,
                        },
                    ],
                },
            ],
        });
    },
};
