const nlp = require("compromise");
const fs = require("fs");
const path = require("path");
const wait = require("util").promisify(setTimeout);
const { logDrink } = require("../utils/patronSystem.js");

let specials = {};
try {
    const dataPath = path.join(__dirname, "../data/va11_drinks.json");
    if (fs.existsSync(dataPath)) {
        specials = JSON.parse(fs.readFileSync(dataPath, "utf8"));
        console.log(
            `[Loader] Successfully loaded ${Object.keys(specials).length} VA-11 HALL-A drinks.`,
        );
    } else {
        console.error("[Loader] ERROR: data/va11_drinks.json not found!");
    }
} catch (err) {
    console.error("Failed to load VA-11 HALL-A drinks:", err);
}

module.exports = {
    name: "mix",
    description: "Prepare a beverage.",
    options: [
        {
            name: "classic",
            description: "Order a real-world cocktail (TheCocktailDB).",
            type: 1,
            options: [
                {
                    name: "name",
                    description: "Name of the drink.",
                    type: 3,
                    required: true,
                    autocomplete: true,
                },
            ],
        },
        {
            name: "special",
            description: "Order a Glitch City special (VA-11 HALL-A).",
            type: 1,
            options: [
                {
                    name: "name",
                    description: "Name of the drink.",
                    type: 3,
                    required: true,
                    autocomplete: true,
                },
            ],
        },
    ],

    async autocomplete(interaction, bot) {
        const sub = interaction.data.options[0];
        const rawOptions = sub.options || [];
        const focusOption = rawOptions.find((o) => o.focused);
        const query = (focusOption?.value || "").toLowerCase();

        if (sub.name === "classic") {
            try {
                // If query is empty, fetch ALL alcoholic drinks to include numbers (e.g. 155 Belmont)
                const url = query
                    ? `https://www.thecocktaildb.com/api/json/v1/1/search.php?s=${encodeURIComponent(query)}`
                    : `https://www.thecocktaildb.com/api/json/v1/1/filter.php?a=Alcoholic`;

                const response = await fetch(url);
                const data = await response.json();

                if (!data.drinks) return interaction.acknowledge([]);

                const suggestions = data.drinks
                    .sort((a, b) =>
                        a.strDrink.localeCompare(b.strDrink, undefined, {
                            numeric: true,
                        }),
                    )
                    .slice(0, 25)
                    .map((d) => ({
                        name: d.strDrink,
                        value: d.strDrink,
                    }));
                return interaction.acknowledge(suggestions);
            } catch (e) {
                return interaction.acknowledge([]);
            }
        }

        if (sub.name === "special") {
            let allDrinks = Object.keys(specials);

            if (query) {
                allDrinks = allDrinks.filter((name) =>
                    name.toLowerCase().includes(query),
                );
            }

            const suggestions = allDrinks
                .sort()
                .slice(0, 25)
                .map((name) => ({
                    name: `⭐ ${name}`,
                    value: name,
                }));

            return interaction.acknowledge(suggestions);
        }
    },

    async execute(interaction, bot) {
        const sub = interaction.data.options[0];
        const drinkName = sub.options[0].value;
        logDrink(interaction.member.id, interaction.guildID, drinkName);

        await interaction.createMessage({
            content: `**[Order Received]** One ${drinkName}, coming up...`,
        });

        // --- SPECIAL MODE (Local Files) ---
        if (sub.name === "special") {
            const drink = specials[drinkName];

            if (!drink) {
                return interaction.editOriginalMessage({
                    content: "That drink isn't on the special menu.",
                });
            }

            await interaction.editOriginalMessage({
                content: `**[Preparing ${drinkName}...]**\n*Adding ${drink.ingredients[0]}...*`,
            });
            await wait(2000);
            await interaction.editOriginalMessage({
                content: `**[Preparing ${drinkName}...]**\n*Mixing ingredients...*`,
            });
            await wait(2000);

            // Local Image Logic (Updated Path)
            let fileAttachment = [];
            let imageUrl = "";

            if (drink.image) {
                // Looks in Jill-Stingray/data/images/
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

            return interaction.editOriginalMessage(
                {
                    content: "",
                    embeds: [
                        {
                            title: `🍸 ${drinkName}`,
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
                            footer: { text: "Va-11 Hall-A Special" },
                        },
                    ],
                },
                fileAttachment,
            );
        }

        // --- CLASSIC MODE (API) ---
        if (sub.name === "classic") {
            try {
                const url = `https://www.thecocktaildb.com/api/json/v1/1/search.php?s=${encodeURIComponent(drinkName)}`;
                const response = await fetch(url);
                const data = await response.json();

                if (!data.drinks) {
                    return interaction.editOriginalMessage({
                        content: "I couldn't find that recipe in the archives.",
                    });
                }

                const drink = data.drinks[0];

                let rawInstructions = drink.strInstructions.replace(
                    /^Step \d+$/gm,
                    "",
                );
                let rawSteps = rawInstructions
                    .split(".")
                    .filter((s) => s.trim().length > 2);
                if (rawSteps.length > 4) {
                    const first = rawSteps[0];
                    const last = rawSteps[rawSteps.length - 1];
                    rawSteps = [first, "Mixing the rest...", last];
                }

                for (let i = 0; i < rawSteps.length; i++) {
                    const step = rawSteps[i].trim();
                    const continuousStep = processGrammar(step);
                    await interaction.editOriginalMessage({
                        content: `**[Mixing ${drink.strDrink}...]**\n*${continuousStep}...*`,
                    });
                    await wait(2500);
                }

                let ingredientsList = "";
                for (let i = 1; i <= 15; i++) {
                    if (drink[`strIngredient${i}`]) {
                        const measure = drink[`strMeasure${i}`]
                            ? drink[`strMeasure${i}`].trim()
                            : "";
                        ingredientsList += `• **${drink[`strIngredient${i}`].trim()}** ${measure}\n`;
                    }
                }

                const quotes = [
                    "Enjoy.",
                    "Here you go.",
                    "Don't spill it.",
                    "Made with... love?",
                    "On the house.",
                ];
                const randomQuote =
                    quotes[Math.floor(Math.random() * quotes.length)];

                await interaction.editOriginalMessage({
                    content: "",
                    embeds: [
                        {
                            title: `🥃 ${drink.strDrink}`,
                            description: `*${drink.strCategory} | ${drink.strGlass}*`,
                            color: 0x00ff99,
                            image: { url: drink.strDrinkThumb },
                            fields: [
                                {
                                    name: "Ingredients",
                                    value: ingredientsList || "Secret.",
                                    inline: true,
                                },
                                {
                                    name: "Instructions",
                                    value: drink.strInstructions || "Mix it.",
                                    inline: false,
                                },
                            ],
                            footer: { text: `Jill: "${randomQuote}"` },
                        },
                    ],
                });
            } catch (err) {
                console.error(err);
                await interaction.editOriginalMessage({
                    content: "I dropped the shaker. (API Error)",
                });
            }
        }
    },
};

function processGrammar(text) {
    const parts = text.split(/ and /i);
    const processed = parts.map((part) => {
        const words = part.trim().split(" ");
        if (words.length === 0) return "";
        let conjugated = nlp(words[0]).verbs().toGerund().text();
        if (conjugated) conjugated = conjugated.replace(/^is\s+/i, "");
        else conjugated = words[0];
        words[0] = conjugated;
        return words.join(" ");
    });
    return processed.join(" and ");
}
