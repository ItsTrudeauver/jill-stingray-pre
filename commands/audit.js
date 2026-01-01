const Eris = require("eris");

module.exports = {
    name: "audit",
    description: "Access server diagnostics and forensic tools.",
    options: [],

    async execute(interaction, bot, pendingActions) {
        // --- 1. SECURITY CHECK ---
        if (!interaction.member.permissions.has("manageRoles")) {
            return interaction.createMessage({
                embeds: [
                    {
                        title: "Access Denied",
                        description:
                            "You lack the necessary clearance (Manage Roles) to view these records.",
                        color: 0xff0000,
                    },
                ],
                flags: 64,
            });
        }

        await interaction.acknowledge();

        // Session State
        pendingActions.set(interaction.member.id, {
            type: "audit_session",
            guildId: interaction.guildID,
            step: "menu",
        });

        await sendAuditMenu(interaction);
    },

    // --- INTERACTION HANDLER ---
    async handleInteraction(interaction, bot, data) {
        const customId = interaction.data.custom_id;
        const guild = bot.guilds.get(interaction.guildID);
        if (!guild) return;

        // --- A. MAIN MENU ---
        if (customId === "audit_home") {
            data.step = "menu";
            await sendAuditMenu(interaction);
        }

        // --- B. EMPTY ROLE SCAN ---
        else if (customId === "audit_scan_empty") {
            const emptyRoles = guild.roles
                .filter((r) => {
                    // Ignore managed roles and @everyone
                    if (r.managed || r.id === guild.id) return false;

                    // Improved Filter: Count members using the guild cache
                    // Note: Ensure 'guildMembers' intent is enabled in index.js
                    const memberCount = guild.members.filter((m) =>
                        m.roles.includes(r.id),
                    ).length;

                    return memberCount === 0;
                })
                .sort((a, b) => b.position - a.position);

            if (emptyRoles.length === 0) {
                return interaction.editParent({
                    embeds: [
                        {
                            title: "Diagnostic: Empty Roles",
                            description:
                                "Scan complete. No obsolete roles detected.\nThe database is clean.",
                            color: 0x00ff00,
                            thumbnail: {
                                url:
                                    interaction.member.avatarURL ||
                                    interaction.member.user.avatarURL,
                            },
                        },
                    ],
                    components: [
                        {
                            type: 1,
                            components: [
                                {
                                    type: 2,
                                    style: 2,
                                    label: "Return",
                                    custom_id: "audit_home",
                                },
                            ],
                        },
                    ],
                });
            }

            // Prep Checklist
            const batch = emptyRoles.slice(0, 25);
            const candidates = {};
            batch.forEach((r) => (candidates[r.id] = true)); // Default: Delete

            data.step = "empty_check";
            data.candidates = candidates;
            data.rolesMap = batch.reduce(
                (map, r) => ((map[r.id] = r.name), map),
                {},
            );

            await sendChecklist(
                interaction,
                batch,
                candidates,
                emptyRoles.length,
            );
        }

        // --- C. TOGGLE CHECKLIST ---
        else if (customId === "audit_toggle_empty") {
            const selectedIds = interaction.data.values;
            Object.keys(data.candidates).forEach(
                (k) => (data.candidates[k] = false),
            );
            selectedIds.forEach((id) => (data.candidates[id] = true));

            const batchIds = Object.keys(data.candidates);
            const batch = batchIds
                .map((id) => guild.roles.get(id))
                .filter((r) => r);

            await sendChecklist(
                interaction,
                batch,
                data.candidates,
                batch.length,
            );
        }

        // --- D. EXECUTE DELETE ---
        else if (customId === "audit_confirm_delete") {
            const toDelete = Object.keys(data.candidates).filter(
                (id) => data.candidates[id],
            );

            if (toDelete.length === 0) {
                return interaction.createMessage({
                    content: "Selection void. No action taken.",
                    flags: 64,
                });
            }

            // Processing State
            await interaction.editParent({
                embeds: [
                    {
                        title: "Processing Deletion...",
                        description: `Purging ${toDelete.length} entries from the registry.\nPlease hold...`,
                        color: 0xffff00,
                    },
                ],
                components: [],
            });

            let deletedCount = 0;
            const errors = [];
            for (const roleId of toDelete) {
                try {
                    await bot.deleteRole(
                        data.guildId,
                        roleId,
                        "Jill Stingray: Audit Protocol",
                    );
                    deletedCount++;
                    await new Promise((res) => setTimeout(res, 250));
                } catch (err) {
                    errors.push(data.rolesMap[roleId] || roleId);
                }
            }

            const color = errors.length > 0 ? 0xffa500 : 0x00ff00;
            const description =
                errors.length > 0
                    ? `Purge complete with errors.\n**Removed:** ${deletedCount}\n**Failed:** ${errors.join(", ")}`
                    : `Purge successful.\nRemoved ${deletedCount} empty roles.`;

            await interaction.editParent({
                embeds: [
                    {
                        title: "Audit Log: Deletion",
                        description: description,
                        color: color,
                        thumbnail: {
                            url:
                                interaction.member.avatarURL ||
                                interaction.member.user.avatarURL,
                        },
                        footer: { text: "Database integrity restored." },
                    },
                ],
                components: [
                    {
                        type: 1,
                        components: [
                            {
                                type: 2,
                                style: 2,
                                label: "Return",
                                custom_id: "audit_home",
                            },
                        ],
                    },
                ],
            });
        }

        // --- E. LONE WOLF SCAN ---
        else if (customId === "audit_scan_lone") {
            const loneWolves = guild.roles
                .filter((r) => {
                    // Ignore managed roles
                    if (r.managed || r.id === guild.id) return false;

                    // Improved Filter: Count members using the guild cache
                    const memberCount = guild.members.filter((m) =>
                        m.roles.includes(r.id),
                    ).length;

                    return memberCount === 1;
                })
                .sort((a, b) => b.position - a.position)
                .slice(0, 20);

            const desc =
                loneWolves.length > 0
                    ? loneWolves
                          .map((r) => {
                              const owner = guild.members.find((m) =>
                                  m.roles.includes(r.id),
                              );
                              return `\`${r.name}\` — <@${owner ? owner.id : "Unknown"}>`;
                          })
                          .join("\n")
                    : "No single-user roles detected.";

            await interaction.editParent({
                embeds: [
                    {
                        title: "Forensics: Identity Isolation",
                        description: `**Found ${loneWolves.length} roles with single occupancy:**\n\n${desc}`,
                        color: 0x00ffff,
                        thumbnail: {
                            url:
                                interaction.member.avatarURL ||
                                interaction.member.user.avatarURL,
                        },
                    },
                ],
                components: [
                    {
                        type: 1,
                        components: [
                            {
                                type: 2,
                                style: 2,
                                label: "Return",
                                custom_id: "audit_home",
                            },
                        ],
                    },
                ],
            });
        }

        // --- F. HIERARCHY MAP ---
        else if (customId === "audit_scan_map") {
            const roles = guild.roles
                .filter((r) => !r.managed && r.id !== guild.id)
                .sort((a, b) => b.position - a.position);

            // Find "Visual Clones"
            const colorGroups = {};
            roles.forEach((r) => {
                const hex = r.color.toString(16).toUpperCase().padStart(6, "0");
                if (hex === "000000") return;
                if (!colorGroups[hex]) colorGroups[hex] = [];
                colorGroups[hex].push(r.name);
            });

            const clones = Object.entries(colorGroups)
                .filter(([hex, names]) => names.length > 1)
                .map(([hex, names]) => `\`#${hex}\`: ${names.join(", ")}`)
                .slice(0, 10);

            const ladder = roles
                .slice(0, 15)
                .map((r) => {
                    const hex =
                        r.color === 0
                            ? "Default"
                            : `#${r.color.toString(16).toUpperCase().padStart(6, "0")}`;
                    return `\`${String(r.position).padStart(2, "0")}\` **${r.name}** (${hex})`;
                })
                .join("\n");

            const fields = [];
            fields.push({
                name: "Hierarchy Ladder (Top 15)",
                value: ladder || "No data available.",
                inline: false,
            });

            if (clones.length > 0) {
                fields.push({
                    name: "Visual Duplication Alert",
                    value: `*Detected shared color values:*\n${clones.join("\n")}`,
                    inline: false,
                });
            } else {
                fields.push({
                    name: "Visual Analysis",
                    value: "No color conflicts detected.",
                    inline: false,
                });
            }

            await interaction.editParent({
                embeds: [
                    {
                        title: "Forensics: Structure & Color",
                        description: `**Registry Size:** ${roles.length} roles\n**Sidebar Visibility:** ${roles.filter((r) => r.hoist).length}`,
                        color: 0xff00ff,
                        fields: fields,
                        thumbnail: {
                            url:
                                interaction.member.avatarURL ||
                                interaction.member.user.avatarURL,
                        },
                    },
                ],
                components: [
                    {
                        type: 1,
                        components: [
                            {
                                type: 2,
                                style: 2,
                                label: "Return",
                                custom_id: "audit_home",
                            },
                        ],
                    },
                ],
            });
        }
    },
};

// --- HELPERS ---

function sendAuditMenu(interaction) {
    const payload = {
        embeds: [
            {
                title: "Jill Stingray // Forensics Suite",
                description: "Select a diagnostic module.",
                color: 0x9900ff,
                fields: [
                    {
                        name: "Empty Node Scan",
                        value: "Identifies and purges roles with zero utilization.",
                        inline: true,
                    },
                    {
                        name: "Identity Isolation",
                        value: "Tracks single-user roles for identity verification.",
                        inline: true,
                    },
                    {
                        name: "Structure Analysis",
                        value: "Visualizes permission hierarchy and color redundancy.",
                        inline: true,
                    },
                ],
                thumbnail: {
                    url:
                        interaction.member.avatarURL ||
                        interaction.member.user.avatarURL,
                },
                footer: { text: "BTC-74 Certified" },
            },
        ],
        components: [
            {
                type: 1,
                components: [
                    {
                        type: 2,
                        style: 1,
                        label: "Scan Empty Nodes",
                        custom_id: "audit_scan_empty",
                    },
                    {
                        type: 2,
                        style: 2,
                        label: "Check Isolations",
                        custom_id: "audit_scan_lone",
                    },
                    {
                        type: 2,
                        style: 2,
                        label: "Analyze Structure",
                        custom_id: "audit_scan_map",
                    },
                ],
            },
        ],
    };

    if (interaction.editParent) return interaction.editParent(payload);
    return interaction.createMessage(payload);
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
        embeds: [
            {
                title: "Verification Required",
                description: `Found **${totalFound}** empty nodes.\n\nSelect the roles you wish to **DELETE**.\nUnchecked roles will be preserved (e.g., Achievement Roles).`,
                color: 0xff0055,
                fields: [
                    {
                        name: "Pending Deletion",
                        value: `${checkedCount} roles selected.`,
                    },
                ],
                thumbnail: {
                    url:
                        interaction.member.avatarURL ||
                        interaction.member.user.avatarURL,
                },
            },
        ],
        components: [
            {
                type: 1,
                components: [
                    {
                        type: 3,
                        custom_id: "audit_toggle_empty",
                        placeholder: "Select nodes to purge...",
                        min_values: 0,
                        max_values: options.length,
                        options: options,
                    },
                ],
            },
            {
                type: 1,
                components: [
                    {
                        type: 2,
                        style: 4,
                        label: `DELETE SELECTED (${checkedCount})`,
                        custom_id: "audit_confirm_delete",
                        disabled: checkedCount === 0,
                    },
                    {
                        type: 2,
                        style: 2,
                        label: "Cancel",
                        custom_id: "audit_home",
                    },
                ],
            },
        ],
    };

    if (interaction.editParent) return interaction.editParent(payload);
    return interaction.createMessage(payload);
}