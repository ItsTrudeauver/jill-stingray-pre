const fs = require("fs");
const path = require("path");

module.exports = {
    name: "surprise",
    description: "Can't decide? Let Jill pick a drink for you.",
    options: [],

    async execute(interaction, bot) {
        // 1. LOAD DRINKS
        const drinksPath = path.join(__dirname, "../data/va11_drinks.json");
        let drinksData = {};

        try {
            if (fs.existsSync(drinksPath)) {
                drinksData = JSON.parse(fs.readFileSync(drinksPath));
            } else {
                return interaction.createMessage({
                    content: "❌ The menu is missing. (json not found)",
                    flags: 64,
                });
            }
        } catch (e) {
            return interaction.createMessage({
                content: "❌ Error reading menu.",
                flags: 64,
            });
        }

        // 2. PICK RANDOM (Fix for Object structure)
        const drinkNames = Object.keys(drinksData);
        if (drinkNames.length === 0) {
            return interaction.createMessage({
                content: "❌ The menu is empty.",
                flags: 64,
            });
        }

        const randomName =
            drinkNames[Math.floor(Math.random() * drinkNames.length)];
        const randomDrink = drinksData[randomName];

        // Inject the name into the object so we can use it easily
        randomDrink.name = randomName;

        // 3. FLAVOR TEXT (Jill's Commentary)
        const comments = [
            "You look like you need this.",
            "Feeling adventurous? Try this.",
            "Don't ask, just drink.",
            "House special. Sort of.",
            "This one's on the house. Just kidding, pay up.",
            "I made this by mistake, but it tastes fine.",
            "You look indecisive. Here.",
            "Time to mix drinks and change lives.",
        ];
        const comment = comments[Math.floor(Math.random() * comments.length)];

        // 4. RESOLVE IMAGE
        // The JSON has an "image" field (e.g., "beer.png"), we use that
        const imageName =
            randomDrink.image || `${randomDrink.name.toLowerCase()}.png`;
        const imagePath = path.join(__dirname, `../data/images/${imageName}`);

        let fileAttachment = null;
        if (fs.existsSync(imagePath)) {
            fileAttachment = {
                file: fs.readFileSync(imagePath),
                name: imageName,
            };
        }

        // 5. SEND
        await interaction.createMessage(
            {
                content: `${comment}`,
                embeds: [
                    {
                        title: `🍸 ${randomDrink.name}`,
                        description: `*${randomDrink.description || "A mysterious beverage."}*\n\n**Price:** ${randomDrink.price}\n**Flavor:** ${randomDrink.flavor} | **Type:** ${randomDrink.type}`,
                        color: 0xff0055, // Neon Pink
                        image: fileAttachment
                            ? { url: `attachment://${imageName}` }
                            : null,
                        footer: { text: "Augmented Eye Bar & Grill" },
                    },
                ],
            },
            fileAttachment,
        );
    },
};
