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

        // 2. Find the best channel to speak in
        // Priority: System Channel -> #general -> First Writable Text Channel
        let channel = guild.channels.get(guild.systemChannelID);
        if (!channel) {
            channel = guild.channels.find(c => c.type === 0 && c.name.toLowerCase().includes("general") && c.permissionsOf(bot.user.id).has("sendMessages"));
        }
        if (!channel) {
            channel = guild.channels.find(c => c.type === 0 && c.permissionsOf(bot.user.id).has("sendMessages"));
        }

        if (!channel) return; // If we can't speak anywhere, abort.

        // 3. Perform Deep Diagnostic
        const payload = await generateWelcomePayload(guild, bot);

        // 4. Send the Landing Page
        await bot.createMessage(channel.id, payload);
    },
    
    // Exporting this generator so the "Verify" button can reuse it!
    generateWelcomePayload
};

// --- HELPER: Generates the Status Card ---
async function generateWelcomePayload(guild, bot) {
    const botMember = guild.members.get(bot.user.id);
    
    // A. Find Highest Role (The Fix)
    let highestRole = guild.roles.get(guild.id); // Default to @everyone
    if (botMember.roles.length > 0) {
        // Map ID to Role Object -> Sort by Position (Descending) -> Take Top
        const sortedRoles = botMember.roles
            .map(id => guild.roles.get(id))
            .filter(r => r) // Safety filter
            .sort((a, b) => b.position - a.position);
        
        if (sortedRoles.length > 0) highestRole = sortedRoles[0];
    }

    // B. Check Permissions
    const hasManageRoles = botMember.permissions.has("manageRoles");
    const hasManageChannels = botMember.permissions.has("manageChannels");
    
    // C. Check Hierarchy (Are we at the bottom?)
    // If our position is 0 or we only have @everyone, we are powerless.
    const isLowHierarchy = highestRole.position === 0 || botMember.roles.length === 0;

    // Build Status Text
    let statusText = "";
    let color = 0x00ff9d; // Green (Success)

    // PERMISSION CHECK
    if (hasManageRoles) statusText += "🟢 **Permissions:** `Manage Roles` active.\n";
    else {
        statusText += "🔴 **Permissions:** Missing `Manage Roles`. I cannot manage users.\n";
        color = 0xff0055; // Red (Error)
    }

    // HIERARCHY CHECK
    if (isLowHierarchy) {
        statusText += "🔴 **Hierarchy:** I am at the bottom of the role list.\n";
        color = 0xff0055;
    } else {
        statusText += `🟢 **Hierarchy:** Highest role is \`${highestRole.name}\`.\n`;
    }

    // ADVICE GENERATOR
    let advice = "";
    if (!hasManageRoles || isLowHierarchy) {
        advice = "\n⚠️ **Action Required:**\n1. Go to **Server Settings > Roles**.\n2. Drag my role (**Jill Stingray**) above the roles you want me to manage.\n3. Ensure I have `Manage Roles` permission.";
    } else {
        advice = "\n✨ **Systems Normal.** I am ready to serve drinks and mix lives.";
    }

    return {
        embeds: [{
            title: "🍹 System Initialization",
            description: `Protocol loaded for **${guild.name}**.\n\n${statusText}${advice}`,
            color: color,
            thumbnail: { url: bot.user.dynamicAvatarURL("png", 1024) },
            footer: { text: "Run /config to customize modules." }
        }],
        components: [{
            type: 1,
            components: [
                {
                    type: 2,
                    label: "Run Diagnostics (Verify Fix)",
                    style: 1, // Blurple
                    custom_id: "sys_verify_roles", 
                    emoji: { name: "🩺" }
                },
                {
                    type: 2,
                    label: "Open Dashboard",
                    style: 2, // Gray
                    custom_id: "dash_launch_intro", // Assuming this triggers dashboard
                    emoji: { name: "🎛️" }
                }
            ]
        }]
    };
}