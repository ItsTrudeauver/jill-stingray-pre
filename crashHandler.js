module.exports = () => {
    // 1. Unhandled Promise Rejections (e.g. API failures we forgot to catch)
    process.on("unhandledRejection", (reason, p) => {
        console.log(" [Anti-Crash] :: Unhandled Rejection/Catch");
        console.log(reason, p);
        // By default, this kills the bot. We catch it here so it stays alive.
    });

    // 2. Uncaught Exceptions (e.g. "x is undefined")
    process.on("uncaughtException", (err, origin) => {
        console.log(" [Anti-Crash] :: Uncaught Exception/Catch");
        console.log(err, origin);
        // Keeps the bot alive despite the crash
    });

    // 3. Monitor (Optional logging)
    process.on("uncaughtExceptionMonitor", (err, origin) => {
        console.log(" [Anti-Crash] :: Uncaught Exception (Monitor)");
        console.log(err, origin);
    });
};
