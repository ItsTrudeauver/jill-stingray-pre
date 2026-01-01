const Eris = require("eris");
const fs = require("fs");
const path = require("path");

const DATA_PATH = path.join(__dirname, "../data/alias_history.json");

// Ensure data file exists
if (!fs.existsSync(DATA_PATH)) {
    try {
        fs.writeFileSync(DATA_PATH, JSON.stringify({}));
    } catch (err) {
        console.error("Failed to initialize alias_history.json:", err);
    }
}

module.exports = {
    name: "guildMemberUpdate",
    async execute(guild, member, oldMember, bot) {
        // If we don't have the old data, we can't compare.
        if (!oldMember) return;

        // Check if nickname actually changed
        // .nick is the server nickname, .user.username is the global name
        const oldName = oldMember.nick || oldMember.username; // Fallback to username if no nick
        const newName = member.nick || member.user.username;

        if (oldName === newName) return;

        // Log the change
        try {
            const data = JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));

            if (!data[member.id]) {
                data[member.id] = [];
            }

            // Avoid duplicate consecutive entries (if event fires twice)
            const history = data[member.id];
            const lastEntry = history[history.length - 1];
            if (lastEntry && lastEntry.name === newName) return;

            // Add new entry
            history.push({
                name: newName,
                timestamp: Date.now(),
            });

            // Optional: Limit history to last 20 names to save space
            if (history.length > 20) {
                data[member.id] = history.slice(-20);
            }

            fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
            console.log(
                `[Forensics] Logged identity change for ${member.user.username}: ${oldName} -> ${newName}`,
            );
        } catch (err) {
            console.error("Failed to log alias change:", err);
        }
    },
};
