const fs = require("fs");
const path = require("path");

// Load local specials data once on startup
let specials = {};
try {
    const dataPath = path.join(__dirname, "../data/va11_drinks.json");
    if (fs.existsSync(dataPath)) {
        specials = JSON.parse(fs.readFileSync(dataPath, "utf8"));
    }
} catch (err) {
    console.error("Failed to load VA-11 HALL-A drinks for menu:", err);
}

module.exports = {
    name: "menu",
    description: "Browse the extensive cocktail database.",
    options: [
        {
            name: "category",
            description: "Which section of the menu?",
            type: 3,
            required: false,
            choices: [
                { name: "Cocktails", value: "Cocktail" },
                { name: "Ordinary Drinks", value: "Ordinary_Drink" },
                { name: "Shots", value: "Shot" },
                { name: "Coffee / Tea", value: "Coffee / Tea" },
                { name: "Specials (VA-11 HALL-A)", value: "Specials" },
                { name: "Other / Unknown", value: "Other / Unknown" },
            ],
        },
    ],
    async execute(interaction, bot) {
        const category =
            interaction.data.options && interaction.data.options[0]
                ? interaction.data.options[0].value
                : "Cocktail";

        await interaction.createMessage({
            content: `Fetching the **${category}** list...`,
        });

        try {
            let drinks = [];

            // 1. Fetch Data (API vs Local)
            if (category === "Specials") {
                // Map local JSON object to array format compatible with the renderer
                drinks = Object.keys(specials).map((name) => ({
                    strDrink: name,
                    idDrink: name, // For local drinks, the ID is the name
                    strDrinkThumb: null, // Local images are loaded in renderRecipe
                }));
            } else {
                // Fetch from API
                const url = `https://www.thecocktaildb.com/api/json/v1/1/filter.php?c=${encodeURIComponent(category)}`;
                const response = await fetch(url);
                const data = await response.json();
                drinks = data.drinks || [];
            }

            if (drinks.length === 0) {
                return interaction.editOriginalMessage({
                    content: "The menu is empty.",
                });
            }

            // 2. Sort Alphabetically
            drinks.sort((a, b) => a.strDrink.localeCompare(b.strDrink));

            // 3. Render Page 0
            await this.renderMenu(
                interaction,
                drinks,
                category,
                0,
                interaction.member.id,
            );
        } catch (err) {
            console.error(err);
            await interaction.editOriginalMessage({
                content: "Failed to open the menu.",
            });
        }
    },

    // --- INTERACTION HANDLER ---
    async handleInteraction(interaction, bot, ownerId) {
        const parts = interaction.data.custom_id.split("|");
        const action = parts[0];
        const page = parseInt(parts[2]);
        const category = parts[3];

        if (action === "menu_nav") {
            // Re-fetch Data (Stateless)
            let drinks = [];

            if (category === "Specials") {
                drinks = Object.keys(specials).map((name) => ({
                    strDrink: name,
                    idDrink: name,
                }));
            } else {
                const url = `https://www.thecocktaildb.com/api/json/v1/1/filter.php?c=${encodeURIComponent(category)}`;
                const response = await fetch(url);
                const data = await response.json();
                drinks = data.drinks || [];
            }

            drinks.sort((a, b) => a.strDrink.localeCompare(b.strDrink));

            await this.renderMenu(
                interaction,
                drinks,
                category,
                page,
                ownerId,
                true,
            );
        } else if (action === "menu_select") {
            const drinkId = interaction.data.values[0];
            await this.renderRecipe(
                interaction,
                drinkId,
                ownerId,
                page,
                category,
            );
        }
    },

    // --- RENDER LIST ---
    async renderMenu(
        interaction,
        drinks,
        category,
        page,
        ownerId,
        isEdit = false,
    ) {
        const PAGE_SIZE = 20;
        const totalPages = Math.ceil(drinks.length / PAGE_SIZE);

        if (page < 0) page = 0;
        if (page >= totalPages) page = totalPages - 1;

        const start = page * PAGE_SIZE;
        const currentBatch = drinks.slice(start, start + PAGE_SIZE);

        const description = currentBatch
            .map((d) => `• ${d.strDrink}`)
            .join("\n");

        // Determine Emoji based on Category
        const emoji =
            category === "Specials"
                ? { name: "⭐", id: null }
                : { name: "🍸", id: null };

        const options = currentBatch.map((d) => ({
            label: d.strDrink.substring(0, 100),
            value: d.idDrink,
            emoji: emoji,
        }));

        const embed = {
            title: `📜 Menu: ${category}`,
            description: description,
            color: 0xa45ee5,
            footer: {
                text: `Page ${page + 1}/${totalPages} • Select a drink for the recipe.`,
            },
        };

        const components = [
            {
                type: 1,
                components: [
                    {
                        type: 3,
                        custom_id: `menu_select|${ownerId}|${page}|${category}`,
                        placeholder: "Select a drink to view recipe...",
                        options: options,
                    },
                ],
            },
            {
                type: 1,
                components: [
                    {
                        type: 2,
                        label: "Previous",
                        style: 1,
                        custom_id: `menu_nav|${ownerId}|${page - 1}|${category}`,
                        disabled: page === 0,
                    },
                    {
                        type: 2,
                        label: "Next",
                        style: 1,
                        custom_id: `menu_nav|${ownerId}|${page + 1}|${category}`,
                        disabled: page >= totalPages - 1,
                    },
                ],
            },
        ];

        const payload = {
            content: "",
            embeds: [embed],
            components: components,
            attachments: [], // Clear any previous images when going back to menu
        };

        if (isEdit) await interaction.editParent(payload);
        else await interaction.editOriginalMessage(payload);
    },

    // --- RENDER RECIPE ---
    async renderRecipe(interaction, drinkId, ownerId, returnPage, category) {
        let embed = {};
        let fileAttachment = [];

        // A. SPECIALS (Local Data)
        if (category === "Specials") {
            const drink = specials[drinkId]; // ID is the name

            // Prepare Image
            let imageUrl = "";
            if (drink.image) {
                const imagePath = path.join(
                    __dirname,
                    "../data/images",
                    drink.image,
                );
                if (fs.existsSync(imagePath)) {
                    const fileData = fs.readFileSync(imagePath);
                    fileAttachment = [{ file: fileData, name: drink.image }];
                    imageUrl = `attachment://${drink.image}`;
                }
            }

            embed = {
                title: `⭐ ${drinkId}`,
                description: `***${drink.flavor} | ${drink.type} | ${drink.price}***\n"${drink.description}"`,
                color: 0xff00ff,
                image: { url: imageUrl },
                fields: [
                    {
                        name: "Recipe",
                        value: drink.ingredients.join("\n"),
                        inline: true,
                    },
                ],
            };
        }
        // B. CLASSIC (API Data)
        else {
            const url = `https://www.thecocktaildb.com/api/json/v1/1/lookup.php?i=${drinkId}`;
            const response = await fetch(url);
            const data = await response.json();
            const drink = data.drinks[0];

            let ingredients = "";
            for (let i = 1; i <= 15; i++) {
                if (drink[`strIngredient${i}`]) {
                    const measure = drink[`strMeasure${i}`]
                        ? drink[`strMeasure${i}`].trim()
                        : "";
                    ingredients += `• **${drink[`strIngredient${i}`].trim()}** ${measure}\n`;
                }
            }

            embed = {
                title: `🍸 ${drink.strDrink}`,
                description: `*Category: ${drink.strCategory} | Glass: ${drink.strGlass}*`,
                color: 0x00ff99,
                image: { url: drink.strDrinkThumb },
                fields: [
                    {
                        name: "Ingredients",
                        value: ingredients || "Secret.",
                        inline: true,
                    },
                    {
                        name: "Instructions",
                        value: drink.strInstructions || "Mix it.",
                        inline: false,
                    },
                ],
            };
        }

        // Send Update (Pass fileAttachment as the second argument)
        await interaction.editParent(
            {
                embeds: [embed],
                components: [
                    {
                        type: 1,
                        components: [
                            {
                                type: 2,
                                label: "Back to Menu",
                                style: 2,
                                emoji: { name: "↩️", id: null },
                                custom_id: `menu_nav|${ownerId}|${returnPage}|${category}`,
                            },
                        ],
                    },
                ],
            },
            fileAttachment,
        );
    },
};