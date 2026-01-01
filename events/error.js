module.exports = {
    name: "error",
    execute(err, bot) {
        console.error(" [Jill-Stingray] :: Client Connection Error");
        console.error(err);
        // Eris will usually try to reconnect automatically if we log this.
    },
};
