const fs = require("fs");
const path = require("path");

const DATA_PATH = path.join(__dirname, "../data/patrons.json");

// Ensure file exists
if (!fs.existsSync(DATA_PATH)) {
    fs.writeFileSync(DATA_PATH, JSON.stringify({}));
}

function getPatrons() {
    try {
        const data = fs.readFileSync(DATA_PATH);
        return JSON.parse(data);
    } catch (err) {
        console.error("Failed to read patrons:", err);
        return {};
    }
}

function savePatrons(data) {
    try {
        // null, 2 makes the file readable (pretty print)
        fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
    } catch (err) {
        console.error("Failed to save patrons:", err);
    }
}

module.exports = {
    // Record a drink for a user
    logDrink: (userId, drinkName) => {
        const patrons = getPatrons();

        if (!patrons[userId]) {
            patrons[userId] = {
                totalOrders: 0,
                history: {}, // { "Mojito": 3, "Beer": 1 }
                lastVisit: null,
            };
        }

        const p = patrons[userId];
        p.totalOrders += 1;
        p.lastVisit = Date.now();

        // Track frequency of this specific drink
        if (!p.history[drinkName]) p.history[drinkName] = 0;
        p.history[drinkName] += 1;

        savePatrons(patrons);
    },

    // Get stats for a user
    getPatronStats: (userId) => {
        const patrons = getPatrons();
        const p = patrons[userId];
        if (!p) return null;

        // Find "The Usual" (Highest frequency drink)
        let usual = "None yet";
        let maxCount = 0;
        for (const [drink, count] of Object.entries(p.history)) {
            if (count > maxCount) {
                maxCount = count;
                usual = drink;
            }
        }

        return {
            total: p.totalOrders,
            usual: usual,
            lastVisit: p.lastVisit,
        };
    },
};
