const { db } = require("../utils/db");
const { DEFAULT_RULES } = require("../utils/default");

module.exports = {
    name: "guildCreate",
    async execute(guild, bot) {
        console.log(`[Lifecycle] Joined new guild: ${guild.name} (${guild.id})`);

        // 1. Initialize DB with Boilerplate Defaults
        try {
            await db.query(`
                INSERT INTO guild_settings (guild_id, command_rules)
                VALUES ($1, $2)
                ON CONFLICT (guild_id) DO NOTHING
            `, [guild.id, JSON.stringify(DEFAULT_RULES)]);
        } catch (e) {
            console.error("Failed to init guild settings:", e);
        }

        // 2. Find a channel to say hello
        // Try System Channel -> First "general" channel -> First writable channel
        let channel = guild.channels.get(guild.systemChannelID);
        if (!channel) {
            channel = guild.channels.find(c => c.type === 0 && c.name.includes("general"));
        }
        if (!channel) {
            channel = guild.channels.find(c => c.type === 0 && c.permissionsOf(bot.user.id).has("sendMessages"));
        }

        if (!channel) return; // Silent join if we can't talk

        // 3. Hierarchy Check (Immediate Diagnostic)
        const botMember = guild.members.get(bot.user.id);
        const botRole = guild.roles.get(botMember.roles[0]); // Approximation
        let warning = "";
        
        if (!botMember.permissions.has("manageRoles")) {
            warning = "\n⚠️ **Critical Issue:** I am missing `Manage Roles` permission.";
        } else {
            // Check if we are at the bottom
            // (A real check requires iterating all roles, but this is a good 'nudge')
            warning = "\n💡 **Tip:** Please drag the **Jill Stingray** role above your Users/Patrons in Server Settings so I can manage them.";
        }

        // 4. Send the Embed
        await bot.createMessage(channel.id, {
            embeds: [{
                title: "🍹 System Online.",
                description: `Jill Stingray, at your service.\nI have applied the **Default Security Protocol** to this server.\n${warning}`,
                color: 0x00ff9d,
                thumbnail: { url: bot.user.dynamicAvatarURL("png", 1024) },
                footer: { text: "Use the Dashboard to customize access." }
            }],
            components: [{
                type: 1,
                components: [{
                    type: 2,
                    label: "Launch Dashboard",
                    style: 1, // Blurple
                    custom_id: "dash_launch_intro",
                    emoji: { name: "🎛️" }
                }]
            }]
        });
    },
};