const fs = require("fs");
const path = require("path");
const https = require("https");

// --- CONFIGURATION ---
const imgDir = path.join(__dirname, "images");
const dataDir = path.join(__dirname, "data");
const jsonPath = path.join(dataDir, "va11_drinks.json");

// --- SOURCE: mfushimi09's GitHub (No Anti-Bot Protection) ---
const BASE_URL = "https://mfushimi09.github.io/vallhalla-recipes/images/";

const drinksData = {
    "Sugar Rush": {
        flavor: "Sweet",
        type: "Girly",
        price: "$150",
        ingredients: ["2 Adelhyde", "1 Powdered Delta", "Karmotrine (Opt)"],
        description:
            "Sweet, girly and happy. The perfect drink for a sugar high.",
    },
    "Sparkle Star": {
        flavor: "Sweet",
        type: "Girly",
        price: "$150",
        ingredients: [
            "2 Adelhyde",
            "1 Powdered Delta",
            "Aged",
            "Karmotrine (Opt)",
        ],
        description: "Sweet, girly and happy. A sparkle in every sip.",
    },
    "Blue Fairy": {
        flavor: "Sweet",
        type: "Girly",
        price: "$170",
        ingredients: ["4 Adelhyde", "1 Flanergide", "Aged", "Karmotrine (Opt)"],
        description:
            "Sweet, girly and soft. One of these will turn your teeth blue.",
    },
    "Sunshine Cloud": {
        flavor: "Bitter",
        type: "Girly",
        price: "$150",
        ingredients: [
            "2 Adelhyde",
            "2 Bronson Extract",
            "Ice",
            "Karmotrine (Opt)",
        ],
        description: "Bitter, girly and soft. Tastes like chocolate milk.",
    },
    Moonblast: {
        flavor: "Sweet",
        type: "Girly",
        price: "$180",
        ingredients: [
            "6 Adelhyde",
            "1 Powdered Delta",
            "2 Flanergide",
            "2 Karmotrine",
            "Ice",
        ],
        description: "Sweet, girly and happy. One of the most popular drinks.",
    },
    "Bad Touch": {
        flavor: "Sour",
        type: "Classy",
        price: "$250",
        ingredients: [
            "2 Bronson Extract",
            "2 Powdered Delta",
            "2 Flanergide",
            "2 Karmotrine",
            "Ice",
        ],
        description: "Sour, classy and vintage. We're nothing but mammals.",
    },
    Brandtini: {
        flavor: "Sweet",
        type: "Classy",
        price: "$250",
        ingredients: ["6 Adelhyde", "3 Powdered Delta", "1 Karmotrine", "Aged"],
        description:
            "Sweet, classy and happy. 8 out of 10 movie stars recommend it.",
    },
    "Cobalt Velvet": {
        flavor: "Bubbly",
        type: "Classy",
        price: "$280",
        ingredients: ["2 Adelhyde", "3 Flanergide", "5 Karmotrine", "Ice"],
        description:
            "Bubbly, classy and burning. It hits you like a velvet glove.",
    },
    "Fringe Weaver": {
        flavor: "Bubbly",
        type: "Classy",
        price: "$260",
        ingredients: ["1 Adelhyde", "9 Karmotrine", "Aged"],
        description: "Bubbly, classy and strong. Drunk by the wealthy.",
    },
    Mercuryblast: {
        flavor: "Sour",
        type: "Classy",
        price: "$250",
        ingredients: [
            "1 Adelhyde",
            "1 Bronson Extract",
            "3 Powdered Delta",
            "3 Flanergide",
            "2 Karmotrine",
            "Ice",
        ],
        description: "Sour, classy and burning. A kick straight to the face.",
    },
    Beer: {
        flavor: "Bubbly",
        type: "Classic",
        price: "$200",
        ingredients: [
            "1 Adelhyde",
            "2 Bronson Extract",
            "1 Powdered Delta",
            "2 Flanergide",
            "4 Karmotrine",
        ],
        description: "Bubbly, classic and vintage. Traditional draft beer.",
    },
    "Bleeding Jane": {
        flavor: "Spicy",
        type: "Classic",
        price: "$200",
        ingredients: ["1 Bronson Extract", "3 Powdered Delta", "3 Flanergide"],
        description:
            "Spicy, classic and sobering. The best cure for a hangover.",
    },
    "Flaming Moai": {
        flavor: "Sour",
        type: "Classic",
        price: "$150",
        ingredients: [
            "1 Adelhyde",
            "1 Bronson Extract",
            "2 Powdered Delta",
            "3 Flanergide",
            "5 Karmotrine",
        ],
        description: "Sour, classic and classy. Ancient knowledge in a glass.",
    },
    "Frothy Water": {
        flavor: "Bubbly",
        type: "Classic",
        price: "$150",
        ingredients: [
            "1 Adelhyde",
            "1 Bronson Extract",
            "1 Powdered Delta",
            "1 Flanergide",
            "Aged",
        ],
        description: "Bubbly, classic and bland. It's basically water.",
    },
    "Crevice Spike": {
        flavor: "Sour",
        type: "Manly",
        price: "$140",
        ingredients: ["2 Powdered Delta", "4 Flanergide", "Karmotrine (Opt)"],
        description: "Sour, manly and sobering. It wakes you right up.",
    },
    "Gut Punch": {
        flavor: "Bitter",
        type: "Manly",
        price: "$80",
        ingredients: [
            "5 Bronson Extract",
            "1 Flanergide",
            "Aged",
            "Karmotrine (Opt)",
        ],
        description:
            "Bitter, manly and strong. It feels like a punch to the gut.",
    },
    Marsblast: {
        flavor: "Spicy",
        type: "Manly",
        price: "$170",
        ingredients: [
            "6 Bronson Extract",
            "1 Powdered Delta",
            "4 Flanergide",
            "2 Karmotrine",
        ],
        description: "Spicy, manly and strong. Not for the faint of heart.",
    },
    "Pile Driver": {
        flavor: "Bitter",
        type: "Manly",
        price: "$160",
        ingredients: ["3 Bronson Extract", "3 Flanergide", "4 Karmotrine"],
        description: "Bitter, manly and burning. It burns on the way down.",
    },
    Suplex: {
        flavor: "Bitter",
        type: "Manly",
        price: "$160",
        ingredients: [
            "4 Bronson Extract",
            "3 Flanergide",
            "3 Karmotrine",
            "Ice",
        ],
        description:
            "Bitter, manly and burning. A wrestling move in liquid form.",
    },
    "Bloom Light": {
        flavor: "Spicy",
        type: "Promo",
        price: "$230",
        ingredients: [
            "4 Adelhyde",
            "1 Powdered Delta",
            "2 Flanergide",
            "3 Karmotrine",
            "Aged",
            "Ice",
        ],
        description: "Spicy, promo and bland. It's so unnecessarily brown.",
    },
    "Grizzly Temple": {
        flavor: "Bitter",
        type: "Promo",
        price: "$220",
        ingredients: [
            "3 Adelhyde",
            "3 Bronson Extract",
            "3 Powdered Delta",
            "1 Karmotrine",
        ],
        description: "Bitter, promo and bland. Mild and forgettable.",
    },
    "Piano Man": {
        flavor: "Sour",
        type: "Promo",
        price: "$320",
        ingredients: [
            "2 Adelhyde",
            "3 Bronson Extract",
            "5 Powdered Delta",
            "5 Flanergide",
            "3 Karmotrine",
            "Ice",
        ],
        description: "Sour, promo and strong. Named after the song.",
    },
    "Piano Woman": {
        flavor: "Sweet",
        type: "Promo",
        price: "$320",
        ingredients: [
            "5 Adelhyde",
            "5 Bronson Extract",
            "2 Powdered Delta",
            "3 Karmotrine",
            "3 Flanergide",
            "Aged",
        ],
        description:
            "Sweet, promo and happy. Named after a song that doesn't exist.",
    },
    "Zen Star": {
        flavor: "Sour",
        type: "Promo",
        price: "$210",
        ingredients: [
            "4 Adelhyde",
            "4 Bronson Extract",
            "4 Powdered Delta",
            "4 Flanergide",
            "4 Karmotrine",
            "Ice",
        ],
        description: "Sour, promo and bland. Perfectly balanced.",
    },
    "Mulan Tea": {
        flavor: "Bitter",
        type: "Classic",
        price: "$170",
        ingredients: ["Bottle"],
        description: "Bitter, classic and vintage. It has a calming aroma.",
    },
    Absinthe: {
        flavor: "Bitter",
        type: "Classy",
        price: "$500",
        ingredients: ["Bottle"],
        description:
            "Pure, unadulterated alcohol. Served straight from the bottle.",
    },
    Rum: {
        flavor: "Sweet",
        type: "Classic",
        price: "$500",
        ingredients: ["Bottle"],
        description: "A pirate's favorite. Served straight from the bottle.",
    },
};

if (!fs.existsSync(imgDir)) fs.mkdirSync(imgDir);
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);

const downloadImage = (name, filename) => {
    // This repo uses "%20" for spaces, e.g. "Bad%20Touch.png"
    const safeName = name.replace(/ /g, "%20");
    const url = `${BASE_URL}${safeName}.png`;
    const dest = path.join(imgDir, filename);

    const request = https.get(url, (response) => {
        if (response.statusCode === 200) {
            const file = fs.createWriteStream(dest);
            response.pipe(file);
            file.on("finish", () => {
                file.close();
                console.log(`✅ Downloaded: ${name}`);
            });
        } else {
            console.error(
                `❌ Failed (${response.statusCode}): ${name} (URL: ${url})`,
            );
        }
    });

    request.on("error", (err) =>
        console.error(`❌ Network Error (${name}): ${err.message}`),
    );
};

// --- EXECUTE ---
console.log("--- STARTING FINAL SETUP (GitHub Source) ---");

fs.writeFileSync(jsonPath, JSON.stringify(drinksData, null, 2));
console.log(`✅ JSON updated.`);

for (const [name, data] of Object.entries(drinksData)) {
    const filename = name.replace(/ /g, "_") + ".png";
    data.image = filename;
    downloadImage(name, filename);
}
