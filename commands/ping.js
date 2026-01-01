module.exports = {
    name: "ping",
    description: "Check if Jill is awake behind the counter.",
    options: [], // No arguments needed for a simple ping
    async execute(interaction, bot) {
        // Calculate the heartbeat latency
        const latency = bot.shards.get(0).latency;

        // Using Jill's characteristic dry tone
        await interaction.createMessage({
            content: `I'm here. Don't worry. (Latency: **${latency}ms**)`,
            flags: 64, // Ephemeral: only you see this, keeps the bar clean
        });
    },
};
