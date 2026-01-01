// index.js
require("dotenv").config();
const Eris = require("eris");
const fs = require("fs");
const path = require("path");
require("./crashHandler")();

const TOKEN = process.env.DISCORD_TOKEN;

// Initialize Client with REQUIRED INTENTS for Emoji Tracking
const bot = new Eris(TOKEN, {
    intents: [
        "guilds",
        "guildMessages", // Needed to receive messages
        "messageContent", // Needed to read the emoji text inside messages
        "guildMessageReactions", // Needed to track reactions
        "guildMebers",
    ],
    restMode: true,
});

bot.commands = new Map();

// --- LOADER FUNCTIONS ---

const loadCommands = () => {
    const commandsPath = path.join(__dirname, "commands");
    if (!fs.existsSync(commandsPath)) fs.mkdirSync(commandsPath);

    const commandFiles = fs
        .readdirSync(commandsPath)
        .filter((file) => file.endsWith(".js"));

    for (const file of commandFiles) {
        const command = require(`./commands/${file}`);
        if (command.name && command.execute) {
            bot.commands.set(command.name, command);
            console.log(`[CMD] Loaded /${command.name}`);
        }
    }
};

const loadEvents = () => {
    const eventsPath = path.join(__dirname, "events");
    if (!fs.existsSync(eventsPath)) fs.mkdirSync(eventsPath);

    const eventFiles = fs
        .readdirSync(eventsPath)
        .filter((file) => file.endsWith(".js"));

    for (const file of eventFiles) {
        const event = require(`./events/${file}`);
        if (event.name && event.execute) {
            if (event.once) {
                bot.once(event.name, (...args) => event.execute(...args, bot));
            } else {
                bot.on(event.name, (...args) => event.execute(...args, bot));
            }
            console.log(`[EVT] Loaded event: ${event.name}`);
        }
    }
};

// --- INITIALIZATION ---

console.log("--- Jill Stingray Boot Sequence ---");
loadCommands();
loadEvents();
bot.connect();

// --- KEEP ALIVE ---


const http = require('http');

// Create a basic server so Koyeb has a "Web Service" to monitor
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Jill Stingray is mixing drinks...\n');
}).listen(process.env.PORT || 8080);

bot.connect();