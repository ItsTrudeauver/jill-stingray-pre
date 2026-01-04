const { db } = require("../utils/db");
const { DEFAULT_RULES } = require("../utils/default");

module.exports = {
    name: "dashboard",
    description: "Open the server configuration console.",
    options: [],

    async execute(interaction, bot) {
        await interaction.acknowledge(); // Prevents "Unknown Interaction" timeout
        if (!await this.checkAuth(interaction)) return;
        await this.renderHome(interaction, bot, true);
    },

    async handleInteraction(interaction, bot) {
        // Defer immediately to give Postgres/Discord time to talk
        await interaction.deferUpdate(); 
        if (!await this.checkAuth(interaction)) return;

        const id = interaction.data.custom_id;

        if (id === "dash_home") return this.renderHome(interaction, bot, true);
        
        // Handle paginated modules: "dash_modules_PAGE"
        if (id.startsWith("dash_modules_")) {
            const page = parseInt(id.split("_")[2]) || 0;
            return this.renderModules(interaction, page);
        }
        
        // Handle toggles: "dash_toggle_PAGE_COMMAND"
        if (id.startsWith("dash_toggle_")) {
            const parts = id.split("_");
            const page = parseInt(parts[2]);
            const cmd = parts[3];
            await this.toggleCommand(interaction, cmd, page);
        }
    },

    async renderHome(interaction, bot, isUpdate = false) {
        const guild = bot.guilds.get(interaction.guildID);
        const botMember = guild.members.get(bot.user.id);
        
        let status = "✅ **Optimal**";
        let color = 0x00ff9d;
        let tips = [];

        if (!botMember.permissions.has("manageRoles")) {
            status = "⚠️ **Restricted**";
            color = 0xffaa00;
            tips.push("• I am missing the `Manage Roles` permission.");
        }
        
        const botRolePos = this.getBotRolePosition(guild, bot.user.id);
        if (botRolePos < 2) { 
            tips.push("• My role is very low. Move 'Jill Stingray' higher in Server Settings.");
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
                { type: 2, label: "Modules (Switchboard)", style: 1, custom_id: "dash_modules_0" },
            ]
        }];

        if (isUpdate) await interaction.editOriginalMessage({ embeds: [embed], components });
        else await interaction.createMessage({ embeds: [embed], components });
    },

    async renderModules(interaction, page = 0) {
        const res = await db.query("SELECT command_rules FROM guild_settings WHERE guild_id = $1", [interaction.guildID]);
        const rules = { ...DEFAULT_RULES, ...(res.rows[0]?.command_rules || {}) };

        const commands = Object.keys(rules).filter(k => k !== "dashboard");
        const pageSize = 12; // 3 rows of 4 buttons
        const totalPages = Math.ceil(commands.length / pageSize);
        const start = page * pageSize;
        const pageCommands = commands.slice(start, start + pageSize);

        const rows = [];
        let currentRow = { type: 1, components: [] };

        pageCommands.forEach((cmd) => {
            const isEnabled = rules[cmd].enabled;
            currentRow.components.push({
                type: 2,
                style: isEnabled ? 3 : 4,
                label: cmd.toUpperCase(),
                custom_id: `dash_toggle_${page}_${cmd}`, // Include page so we return to it after toggle
                emoji: isEnabled ? { name: "✔️" } : { name: "✖️" }
            });

            if (currentRow.components.length >= 4) {
                rows.push(currentRow);
                currentRow = { type: 1, components: [] };
            }
        });
        if (currentRow.components.length > 0) rows.push(currentRow);

        // Navigation Row
        rows.push({
            type: 1, 
            components: [
                { type: 2, label: "« Previous", style: 2, custom_id: `dash_modules_${page - 1}`, disabled: page === 0 },
                { type: 2, label: "Next »", style: 2, custom_id: `dash_modules_${page + 1}`, disabled: page >= totalPages - 1 },
                { type: 2, label: "Home", style: 2, custom_id: "dash_home" }
            ]
        });

        const embed = {
            title: "🎛️ Dashboard | Modules",
            description: `Page ${page + 1} of ${totalPages}\nClick to toggle commands ON/OFF.`,
            color: 0x2b2d31
        };

        await interaction.editOriginalMessage({ embeds: [embed], components: rows });
    },

    async toggleCommand(interaction, cmd, page) {
        const res = await db.query("SELECT command_rules FROM guild_settings WHERE guild_id = $1", [interaction.guildID]);
        let rules = res.rows[0]?.command_rules || {};
        if (!rules[cmd]) rules[cmd] = { ...DEFAULT_RULES[cmd] };

        rules[cmd].enabled = !rules[cmd].enabled;

        await db.query(`UPDATE guild_settings SET command_rules = $2 WHERE guild_id = $1`, 
            [interaction.guildID, JSON.stringify(rules)]);

        await this.renderModules(interaction, page);
    },

    async checkAuth(interaction) {
        if (interaction.member.permissions.has("administrator")) return true;
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
        member.roles.forEach(rId => {
            const r = guild.roles.get(rId);
            if (r && r.position > max) max = r.position;
        });
        return max;
    }
};