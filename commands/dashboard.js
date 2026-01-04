const { db } = require("../utils/db");
const { DEFAULT_RULES } = require("../utils/default");

module.exports = {
    name: "dashboard",
    description: "Open the server configuration console.",
    options: [],

    async execute(interaction, bot) {
        // Auth Check
        if (!await this.checkAuth(interaction)) return;
        await this.renderHome(interaction, bot);
    },

    async handleInteraction(interaction, bot) {
        if (!await this.checkAuth(interaction)) return;

        const id = interaction.data.custom_id;

        // Navigation
        if (id === "dash_home" || id === "dash_launch_intro") return this.renderHome(interaction, bot, true);
        if (id === "dash_modules") return this.renderModules(interaction, true);
        
        // Toggles
        if (id.startsWith("dash_toggle_")) {
            const cmd = id.replace("dash_toggle_", "");
            await this.toggleCommand(interaction, cmd);
        }
    },

    // --- PAGE 1: HOME (Hierarchy & Health) ---
    async renderHome(interaction, bot, isUpdate = false) {
        const guild = bot.guilds.get(interaction.guildID);
        const botMember = guild.members.get(bot.user.id);
        
        // Hierarchy Check
        let status = "✅ **Optimal**";
        let color = 0x00ff9d;
        let tips = [];

        if (!botMember.permissions.has("manageRoles")) {
            status = "⚠️ **Restricted**";
            color = 0xffaa00;
            tips.push("• I am missing the `Manage Roles` permission.");
        }
        
        // Check if bot role is too low for Custom Roles (simple check)
        // Ideally we compare vs the 'highest' user role, but simplified:
        const botRolePos = this.getBotRolePosition(guild, bot.user.id);
        if (botRolePos < 2) { 
            tips.push("• My role is very low in the list. Move 'Jill Stingray' higher in Server Settings > Roles.");
        }

        const embed = {
            title: "🎛️ Dashboard | System Status",
            description: `**Service Status:** ${status}\n${tips.join("\n")}`,
            color: color,
            fields: [
                { name: "Current Mode", value: "Standard Protection", inline: true },
                { name: "Gatekeeper", value: "Active", inline: true }
            ],
            thumbnail: { url: bot.user.dynamicAvatarURL("png") }
        };

        const components = [{
            type: 1,
            components: [
                { type: 2, label: "Overview", style: 1, custom_id: "dash_home", disabled: true },
                { type: 2, label: "Modules (Switchboard)", style: 1, custom_id: "dash_modules" },
                // Granular config would go here in V2
            ]
        }];

        const payload = { embeds: [embed], components };
        if (isUpdate) await interaction.editMessage(interaction.message.id, payload);
        else await interaction.createMessage(payload);
    },

    // --- PAGE 2: MODULES (Grid) ---
    async renderModules(interaction, isUpdate = false) {
        // Fetch current rules
        const res = await db.query("SELECT command_rules FROM guild_settings WHERE guild_id = $1", [interaction.guildID]);
        const rules = { ...DEFAULT_RULES, ...(res.rows[0]?.command_rules || {}) };

        // Build Grid
        const rows = [];
        let currentRow = { type: 1, components: [] };
        const commands = Object.keys(rules).filter(k => k !== "dashboard"); // Don't allow disabling dashboard

        commands.forEach((cmd) => {
            const isEnabled = rules[cmd].enabled;
            
            currentRow.components.push({
                type: 2,
                style: isEnabled ? 3 : 4, // Green/Red
                label: cmd.toUpperCase(),
                custom_id: `dash_toggle_${cmd}`,
                emoji: isEnabled ? { name: "✔️" } : { name: "✖️" }
            });

            if (currentRow.components.length >= 4) {
                rows.push(currentRow);
                currentRow = { type: 1, components: [] };
            }
        });
        if (currentRow.components.length > 0) rows.push(currentRow);

        // Add Navigation Row at the bottom
        rows.push({
            type: 1, 
            components: [
                { type: 2, label: "« Back to Overview", style: 2, custom_id: "dash_home" }
            ]
        });

        const embed = {
            title: "🎛️ Dashboard | Modules",
            description: "Click to Toggle commands ON (Green) or OFF (Red).\n*Changes apply immediately.*",
            color: 0x2b2d31
        };

        await interaction.editMessage(interaction.message.id, { embeds: [embed], components: rows });
    },

    // --- LOGIC: TOGGLE ---
    async toggleCommand(interaction, cmd) {
        // Fetch -> Toggle -> Save
        const res = await db.query("SELECT command_rules FROM guild_settings WHERE guild_id = $1", [interaction.guildID]);
        let rules = res.rows[0]?.command_rules || {};
        
        // Ensure rule object exists (if merging from default)
        if (!rules[cmd]) rules[cmd] = { ...DEFAULT_RULES[cmd] };

        // Toggle
        rules[cmd].enabled = !rules[cmd].enabled;

        // Save
        await db.query(`
            UPDATE guild_settings SET command_rules = $2 WHERE guild_id = $1
        `, [interaction.guildID, JSON.stringify(rules)]);

        // Refresh UI
        await this.renderModules(interaction, true);
    },

    // --- HELPER: AUTH CHECK ---
    async checkAuth(interaction) {
        // Check Admin
        if (interaction.member.permissions.has("administrator")) return true;

        // Check Manager Role
        const res = await db.query("SELECT admin_role_id FROM guild_settings WHERE guild_id = $1", [interaction.guildID]);
        const roleId = res.rows[0]?.admin_role_id;
        
        if (roleId && interaction.member.roles.includes(roleId)) return true;

        await interaction.createMessage({ content: "🔒 Access Denied.", flags: 64 });
        return false;
    },

    getBotRolePosition(guild, botId) {
        const member = guild.members.get(botId);
        if (!member || member.roles.length === 0) return 0;
        
        let max = 0;
        for (const rId of member.roles) {
            const r = guild.roles.get(rId);
            if (r && r.position > max) max = r.position;
        }
        return max;
    }
};