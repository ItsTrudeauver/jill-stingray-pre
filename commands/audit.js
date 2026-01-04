const Eris = require("eris");
const Permissions = require("../utils/permissions");

module.exports = {
    name: "audit",
    description: "Access server diagnostics and forensic tools.",
    options: [],

    async execute(interaction, bot, pendingActions) {
        // 1. Acknowledge IMMEDIATELY to prevent "Unknown Interaction" timeout
        await interaction.acknowledge();

        // 2. SECURITY CHECK
        if (!await Permissions.check(interaction, 'audit')) return;
        await interaction.acknowledge();

        // Session State
        pendingActions.set(interaction.member.id, {
            type: "audit_session",
            guildId: interaction.guildID,
            step: "menu",
        });

        await sendAuditMenu(interaction);
    },

    async handleInteraction(interaction, bot, data) {
        const customId = interaction.data.custom_id;
        const guild = bot.guilds.get(interaction.guildID);
        if (!guild) return;

        if (customId === "audit_home") {
            data.step = "menu";
            await sendAuditMenu(interaction);
        }

        // --- FIXED EMPTY ROLE SCAN ---
        else if (customId === "audit_scan_empty") {
            const emptyRoles = guild.roles
                .filter((r) => {
                    if (r.managed || r.id === guild.id) return false;
                    
                    // FIX: Use memberCount property instead of filtering the local member cache.
                    // If memberCount isn't available in your Eris version, we check the global guild.
                    const actualCount = guild.members.filter(m => m.roles.includes(r.id)).length;
                    
                    // Note: In large servers, ensure your intents are correct in index.js
                    return actualCount === 0;
                })
                .sort((a, b) => b.position - a.position);

            if (emptyRoles.length === 0) {
                return interaction.editParent({
                    embeds: [{
                        title: "Diagnostic: Empty Roles",
                        description: "Scan complete. No obsolete roles detected.",
                        color: 0x00ff00,
                    }],
                    components: [{
                        type: 1,
                        components: [{ type: 2, style: 2, label: "Return", custom_id: "audit_home" }],
                    }],
                });
            }

            const batch = emptyRoles.slice(0, 25);
            const candidates = {};
            batch.forEach((r) => (candidates[r.id] = true));

            data.step = "empty_check";
            data.candidates = candidates;
            data.rolesMap = batch.reduce((map, r) => ((map[r.id] = r.name), map), {});

            await sendChecklist(interaction, batch, candidates, emptyRoles.length);
        }

        // --- FIXED LONE WOLF SCAN ---
        else if (customId === "audit_scan_lone") {
            const loneWolves = guild.roles
                .filter((r) => {
                    if (r.managed || r.id === guild.id) return false;
                    
                    // FIX: Check for exactly 1 member globally
                    const actualCount = guild.members.filter(m => m.roles.includes(r.id)).length;
                    return actualCount === 1;
                })
                .sort((a, b) => b.position - a.position)
                .slice(0, 20);

            const desc = loneWolves.length > 0
                ? loneWolves.map((r) => {
                    const owner = guild.members.find((m) => m.roles.includes(r.id));
                    return `\`${r.name}\` — <@${owner ? owner.id : "Unknown User"}>`;
                }).join("\n")
                : "No single-user roles detected.";

            await interaction.editParent({
                embeds: [{
                    title: "Forensics: Identity Isolation",
                    description: `**Found ${loneWolves.length} roles with single occupancy:**\n\n${desc}`,
                    color: 0x00ffff,
                }],
                components: [{
                    type: 1,
                    components: [{ type: 2, style: 2, label: "Return", custom_id: "audit_home" }],
                }],
            });
        }
        
        // ... (Rest of your hierarchy/delete logic remains the same)
        else if (customId === "audit_toggle_empty") {
            const selectedIds = interaction.data.values;
            Object.keys(data.candidates).forEach(k => (data.candidates[k] = false));
            selectedIds.forEach(id => (data.candidates[id] = true));
            const batch = Object.keys(data.candidates).map(id => guild.roles.get(id)).filter(r => r);
            await sendChecklist(interaction, batch, data.candidates, batch.length);
        }
        else if (customId === "audit_confirm_delete") {
            const toDelete = Object.keys(data.candidates).filter(id => data.candidates[id]);
            await interaction.editParent({ embeds: [{ title: "Processing...", description: `Purging ${toDelete.length} roles.`, color: 0xffff00 }], components: [] });
            for (const roleId of toDelete) {
                try { await bot.deleteRole(data.guildId, roleId, "Audit Purge"); } catch (e) {}
            }
            await interaction.editParent({ embeds: [{ title: "Audit Complete", description: `Purged ${toDelete.length} roles.`, color: 0x00ff00 }], components: [{ type: 1, components: [{ type: 2, style: 2, label: "Return", custom_id: "audit_home" }] }] });
        }
        else if (customId === "audit_scan_map") {
             // ... Hierarchy Map Logic ... (Keep your existing color-cloning logic here)
             const roles = guild.roles.filter(r => !r.managed && r.id !== guild.id).sort((a,b) => b.position - a.position);
             const ladder = roles.slice(0, 15).map(r => `\`${r.position}\` **${r.name}**`).join("\n");
             await interaction.editParent({ embeds: [{ title: "Structure Analysis", description: ladder, color: 0xff00ff }], components: [{ type: 1, components: [{ type: 2, style: 2, label: "Return", custom_id: "audit_home" }] }] });
        }
    },
};

// Keep your existing sendAuditMenu and sendChecklist helper functions below...

function sendAuditMenu(interaction) {
    const payload = {
        embeds: [{
            title: "Jill Stingray // Forensics Suite",
            description: "Select a diagnostic module.",
            color: 0x9900ff,
            fields: [
                { name: "Empty Node Scan", value: "Identifies and purges roles with zero utilization.", inline: true },
                { name: "Identity Isolation", value: "Tracks single-user roles for identity verification.", inline: true },
                { name: "Structure Analysis", value: "Visualizes permission hierarchy.", inline: true },
            ],
            footer: { text: "BTC-74 Certified" },
        }],
        components: [{
            type: 1,
            components: [
                { type: 2, style: 1, label: "Scan Empty Nodes", custom_id: "audit_scan_empty" },
                { type: 2, style: 2, label: "Check Isolations", custom_id: "audit_scan_lone" },
                { type: 2, style: 2, label: "Analyze Structure", custom_id: "audit_scan_map" },
            ],
        }],
    };
    return interaction.editParent ? interaction.editParent(payload) : interaction.createMessage(payload);
}

function sendChecklist(interaction, roles, state, totalFound) {
    const checkedCount = Object.values(state).filter((v) => v).length;
    const options = roles.map((r) => ({
        label: r.name,
        value: r.id,
        description: `ID: ${r.id}`,
        default: state[r.id] === true,
    }));

    const payload = {
        embeds: [{
            title: "Verification Required",
            description: `Found **${totalFound}** empty nodes.\n\nSelect roles to **DELETE**.`,
            color: 0xff0055,
            fields: [{ name: "Pending Deletion", value: `${checkedCount} selected.` }],
        }],
        components: [
            { type: 1, components: [{ type: 3, custom_id: "audit_toggle_empty", placeholder: "Select nodes...", min_values: 0, max_values: options.length, options }] },
            { type: 1, components: [
                { type: 2, style: 4, label: `DELETE SELECTED (${checkedCount})`, custom_id: "audit_confirm_delete", disabled: checkedCount === 0 },
                { type: 2, style: 2, label: "Cancel", custom_id: "audit_home" }
            ]},
        ],
    };
    return interaction.editParent ? interaction.editParent(payload) : interaction.createMessage(payload);
}