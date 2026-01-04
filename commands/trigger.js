const { db } = require("../utils/db");

module.exports = {
    name: "trigger",
    description: "Manage custom server triggers.",
    options: [
        {
            name: "add",
            description: "Create or overwrite a trigger.",
            type: 1,
            options: [
                {
                    name: "keyword",
                    description: "The phrase to listen for.",
                    type: 3,
                    required: true
                },
                {
                    name: "text",
                    description: "The text response (Optional).",
                    type: 3,
                    required: false
                },
                {
                    name: "image",
                    description: "Upload an image response (Optional).",
                    type: 11, // Attachment type
                    required: false
                },
                {
                    name: "strict",
                    description: "If true, case/capitalization must match exactly.",
                    type: 5, // Boolean
                    required: false
                }
            ]
        },
        {
            name: "delete",
            description: "Remove a trigger.",
            type: 1,
            options: [
                {
                    name: "keyword",
                    description: "The trigger to delete.",
                    type: 3,
                    required: true,
                    autocomplete: true
                }
            ]
        },
        {
            name: "list",
            description: "View all triggers.",
            type: 1
        }
    ],

    async autocomplete(interaction, bot) {
        const focus = interaction.data.options[0].options.find(o => o.focused);
        const query = focus.value.toLowerCase();
        
        // Fetch matching triggers for deletion autocomplete
        const res = await db.query(`
            SELECT keyword FROM triggers 
            WHERE guild_id = $1 AND keyword ILIKE $2
            LIMIT 25
        `, [interaction.guildID, `%${query}%`]);

        return interaction.acknowledge(res.rows.map(r => ({ name: r.keyword, value: r.keyword })));
    },

    async execute(interaction, bot) {
        const sub = interaction.data.options[0].name;

        // --- ADD ---
        if (sub === "add") {
            // Check Permissions (Admin/Manager only)
            if (!interaction.member.permissions.has("manageMessages")) {
                return interaction.createMessage({ content: "❌ You need `Manage Messages` permissions.", flags: 64 });
            }

            const opts = interaction.data.options[0].options || [];
            const keyword = opts.find(o => o.name === "keyword").value;
            const text = opts.find(o => o.name === "text")?.value;
            const image = interaction.data.resolved?.attachments?.[opts.find(o => o.name === "image")?.value];
            const strict = opts.find(o => o.name === "strict")?.value || false;

            if (!text && !image) {
                return interaction.createMessage({ content: "❌ You must provide either `text` OR an `image`.", flags: 64 });
            }

            // Determine content
            const response = image ? image.url : text;
            const isImage = !!image;

            await db.query(`
                INSERT INTO triggers (guild_id, keyword, response, is_image, case_sensitive)
                VALUES ($1, $2, $3, $4, $5)
                ON CONFLICT (guild_id, keyword)
                DO UPDATE SET response = $3, is_image = $4, case_sensitive = $5
            `, [interaction.guildID, keyword, response, isImage, strict]);

            return interaction.createMessage(`✅ Trigger set: **"${keyword}"**`);
        }

        // --- DELETE ---
        if (sub === "delete") {
            if (!interaction.member.permissions.has("manageMessages")) {
                return interaction.createMessage({ content: "❌ Permission denied.", flags: 64 });
            }

            const keyword = interaction.data.options[0].options[0].value;
            const res = await db.query(`DELETE FROM triggers WHERE guild_id = $1 AND keyword = $2`, [interaction.guildID, keyword]);

            if (res.rowCount === 0) return interaction.createMessage({ content: "Trigger not found.", flags: 64 });
            return interaction.createMessage(`🗑️ Deleted trigger: **"${keyword}"**`);
        }

        // --- LIST ---
        if (sub === "list") {
            await this.renderList(interaction, 0);
        }
    },

    // Handle Pagination Buttons
    async handleInteraction(interaction, bot) {
        if (!interaction.data.custom_id.startsWith("trig_page_")) return;
        const page = parseInt(interaction.data.custom_id.split("_")[2]);
        await interaction.defer(64); // Ephemeral refresh
        await this.renderList(interaction, page, true);
    },

    async renderList(interaction, page, isEdit = false) {
        const LIMIT = 10;
        const offset = page * LIMIT;

        // Get total count
        const countRes = await db.query(`SELECT COUNT(*) as c FROM triggers WHERE guild_id = $1`, [interaction.guildID]);
        const total = parseInt(countRes.rows[0].c);
        const totalPages = Math.ceil(total / LIMIT);

        // Get Page
        const res = await db.query(`
            SELECT keyword, is_image, case_sensitive 
            FROM triggers WHERE guild_id = $1 
            ORDER BY keyword ASC 
            LIMIT $2 OFFSET $3
        `, [interaction.guildID, LIMIT, offset]);

        if (res.rows.length === 0) {
            const msg = { content: "No custom triggers set." };
            return isEdit ? interaction.editOriginalMessage(msg) : interaction.createMessage(msg);
        }

        const list = res.rows.map(t => {
            const type = t.is_image ? "🖼️ Image" : "📝 Text";
            const mode = t.case_sensitive ? "Strict" : "Normal";
            return `• **"${t.keyword}"** (${type}, ${mode})`;
        }).join("\n");

        const embed = {
            title: `🗂️ Server Triggers (${total})`,
            description: list,
            color: 0x00ae86,
            footer: { text: `Page ${page + 1}/${totalPages || 1}` }
        };

        const components = [{
            type: 1,
            components: [
                { type: 2, label: "◀", style: 2, custom_id: `trig_page_${page - 1}`, disabled: page === 0 },
                { type: 2, label: "▶", style: 2, custom_id: `trig_page_${page + 1}`, disabled: page >= totalPages - 1 }
            ]
        }];

        const payload = { embeds: [embed], components };
        if (isEdit) await interaction.editOriginalMessage(payload);
        else await interaction.createMessage(payload);
    }
};