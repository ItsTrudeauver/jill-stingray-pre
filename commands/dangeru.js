const { db } = require("../utils/db");
const crypto = require("crypto");
const fs = require("fs"); 
const path = require("path");
const Permissions = require("../utils/permissions");

const configPath = path.join(__dirname, "../data/dangeru_config.json");

// !!! REPLACE WITH YOUR ID !!!
const BOT_OWNER_ID = "541882021434359811"; 

module.exports = {
    name: "dangeru",
    description: "Manage the Dangeru textboard node.",
    options: [
    { name: "setup", description: "Spawn the Terminal.", type: 1 },
    { name: "wipe", description: "[OWNER] Wipe the database.", type: 1 },
    { name: "post", 
      description: "Post anonymously.", 
      type: 1, 
      options: [
          { 
            name: "message", 
            description: "The content of your anonymous post.", // THIS WAS MISSING
            type: 3, 
            required: true 
          }
      ] 
    }
],
    async execute(interaction, bot) {
        const sub = interaction.data.options[0];

        if (sub.name === "setup") {
            const conf = { channelId: interaction.channel.id };
            fs.writeFileSync(configPath, JSON.stringify(conf));
            await this.renderBoard(bot, interaction.channel.id, 0, true);
            return interaction.createMessage({ content: "✅ **Terminal Deployed.**", flags: 64 });
        }

        if (sub.name === "wipe") {
            if (interaction.member.id !== BOT_OWNER_ID) {
                return interaction.createMessage({ content: "❌ **Access Denied.** System Administrator only.", flags: 64 });
            }
            await db.query("DELETE FROM dangeru_posts");
            
            // Refresh board
            let targetCh = interaction.channel.id;
            if (fs.existsSync(configPath)) {
                const c = JSON.parse(fs.readFileSync(configPath));
                if (c.channelId) targetCh = c.channelId;
            }
            await this.renderBoard(bot, targetCh, 0, true);
            return interaction.createMessage({ content: "⚠️ **System Formatted.**", flags: 64 });
        }

        if (sub.name === "post") {
            const msg = sub.options.find(o => o.name === "message").value;
            await this.processPost(interaction, bot, msg);
        }
    },

    async handleInteraction(interaction, bot) {
        if (interaction.data.custom_id.startsWith("dangeru_page_")) {
            const page = parseInt(interaction.data.custom_id.split("_")[2]);
            await interaction.defer(64);
            await this.renderBoard(bot, interaction.channel.id, page, false, interaction.message.id);
        }
    },

    async processPost(interaction, bot, msg) {
        if (!interaction.acknowledged) await interaction.defer(64);

        const today = new Date().toISOString().split("T")[0];
        const raw = `${interaction.member.id}-${today}-SALT`;
        const tripcode = `!${crypto.createHash("sha256").update(raw).digest("hex").substring(0, 6).toUpperCase()}`;

        await db.query(`
            INSERT INTO dangeru_posts (tripcode, content, author_id, timestamp)
            VALUES ($1, $2, $3, $4)
        `, [tripcode, msg, interaction.member.id, Date.now()]);

        let targetCh = interaction.channel.id;
        if (fs.existsSync(configPath)) {
            const c = JSON.parse(fs.readFileSync(configPath));
            if (c.channelId) targetCh = c.channelId;
        }
        await this.renderBoard(bot, targetCh, 0, true);
        
        return interaction.editOriginalMessage({ content: `✅ **Posted.** ID: \`${tripcode}\`` });
    },

    async renderBoard(bot, channelId, page = 0, forceNew = false, msgId = null) {
        const limit = 5;
        const offset = page * limit;
        
        // Postgres pagination
        const postsRes = await db.query(`
            SELECT * FROM dangeru_posts ORDER BY id DESC LIMIT $1 OFFSET $2
        `, [limit, offset]);
        
        const countRes = await db.query(`SELECT COUNT(*) as c FROM dangeru_posts`);
        const totalPosts = parseInt(countRes.rows[0].c);
        const totalPages = Math.ceil(totalPosts / limit);

        const desc = postsRes.rows.map(p => {
            const time = new Date(parseInt(p.timestamp)).toLocaleTimeString("en-US", {hour: '2-digit', minute:'2-digit', hour12: false});
            return `**Anonymous ${p.tripcode}** [${time}]\n${p.content}`;
        }).join("\n\n") || "*[No transmissions]*";

        const embed = {
            title: "🟢 Dangeru Feed",
            description: desc,
            color: 0x00ff00,
            footer: { text: `Page ${page + 1}/${totalPages || 1}` }
        };

        const components = [{
            type: 1,
            components: [
                { type: 2, label: "< Newer", style: 2, custom_id: `dangeru_page_${page - 1}`, disabled: page === 0 },
                { type: 2, label: "Older >", style: 2, custom_id: `dangeru_page_${page + 1}`, disabled: page >= totalPages - 1 }
            ]
        }];

        try {
            if (forceNew) {
                await bot.createMessage(channelId, { embeds: [embed], components });
            } else if (msgId) {
                await bot.editMessage(channelId, msgId, { embeds: [embed], components });
            }
        } catch (e) {}
    }
};