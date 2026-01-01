// events/ready.js
module.exports = {
    name: "ready",
    once: true,
    async execute(bot) {
        console.log(`Jill Stingray is online. (User: ${bot.user.username})`);
        console.log("Mixing drinks and changing lives.");

        // --- RICH PRESENCE SETTINGS ---
        const activities = [
            { name: "VA-11 HALL-A OST", type: 2 }, // Listening to...
            { name: "Time to mix drinks and change lives.", type: 0 }, // Playing...
            { name: "customers at the bar", type: 3 }, // Watching...
            { name: "Fore", type: 5 }, // Competing in...
        ];

        let i = 0;
        // Set initial status
        bot.editStatus("online", activities[0]);

        // Rotate status every 30 seconds
        setInterval(() => {
            i = (i + 1) % activities.length;
            bot.editStatus("online", activities[i]);
        }, 30000);

        // --- COMMAND SYNC ---
        const TEST_GUILD_ID = "995879199229362227"; // Your Server ID

        try {
            const commandData = Array.from(bot.commands.values()).map(
                (cmd) => ({
                    name: cmd.name,
                    description: cmd.description,
                    options: cmd.options || [],
                    type: 1,
                }),
            );

            // 1. GLOBAL SYNC (For all servers)
            // This propagates to all servers the bot is in.
            // NOTE: Global updates can take up to 1 hour to appear in Discord.
            await bot.bulkEditCommands(commandData);
            console.log(`✅ Synced ${commandData.length} Global Commands.`);

            // 2. TEST GUILD SYNC (For immediate testing)
            // This updates instantly, so you don't have to wait 1 hour to test changes.
            // (You may see duplicate commands in this specific server—this is normal).
            await bot.bulkEditGuildCommands(TEST_GUILD_ID, commandData);
            console.log(
                `✅ Synced ${commandData.length} commands to Test Guild: ${TEST_GUILD_ID}`,
            );
        } catch (err) {
            console.error("❌ Failed to sync commands:", err);
        }
    },
};
