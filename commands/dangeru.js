const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const configPath = path.join(__dirname, "../data/dangeru_config.json");
const postsPath = path.join(__dirname, "../data/dangeru_posts.json");

// Placeholder banner image
const BANNER_URL = "https://media.discordapp.net/attachments/995879199959162882/1455989943112437910/logo.png?ex=6956bbcd&is=69556a4d&hm=35c39ba4fb9679cf18a7b651d28ac5a6c984f63c42e401f077ca13cd34d9c831&=&format=webp&quality=lossless&width=1860&height=609";

if (!fs.existsSync(postsPath)) fs.writeFileSync(postsPath, "[]");

module.exports = {
    name: "dangeru",
    description: "Manage the Dangeru textboard node.",
    options: [
        {
            name: "setup",
            description: "[Manager] Spawn the Dangeru Terminal Button here.",
            type: 1,
        },
        {
            name: "wipe",
            description: "[Manager] Wipe all Dangeru archives.",
            type: 1,
        },
        {
            name: "logs",
            description: "[Admin] Reveal the identity behind a tripcode.",
            type: 1,
            options: [
                {
                    name: "tripcode",
                    description: "The tripcode to investigate (e.g. !A1B2C3).",
                    type: 3,
                    required: true,
                },
            ],
        },
        {
            name: "post",
            description: "Manually post a message to the feed.",
            type: 1,
            options: [
                {
                    name: "message",
                    description: "Your anonymous message.",
                    type: 3,
                    required: true,
                    min_length: 2,
                    max_length: 500,
                },
            ],
        },
    ],

    // --- 1. COMMAND EXECUTION ---
    async execute(interaction, bot) {
        const sub = interaction.data.options[0];

        // --- A. SETUP ---
        if (sub.name === "setup") {
            if (!interaction.member.permissions.has("manageMessages")) {
                return interaction.createMessage({
                    content:
                        "❌ **[System Error]** 'Manage Messages' permission required.",
                    flags: 64,
                });
            }

            if (fs.existsSync(configPath)) {
                try {
                    const oldConf = JSON.parse(fs.readFileSync(configPath));
                    if (oldConf.channelId && oldConf.lastMessageId) {
                        await bot
                            .deleteMessage(
                                oldConf.channelId,
                                oldConf.lastMessageId,
                            )
                            .catch(() => {});
                    }
                } catch (e) {}
            }

            const configData = {
                channelId: interaction.channel.id,
                ownerId: interaction.member.id,
            };
            fs.writeFileSync(configPath, JSON.stringify(configData));

            await this.renderBoard(bot, interaction.channel.id, 0, true);
            return interaction.createMessage({
                content: "✅ **Terminal Deployed.**",
                flags: 64,
            });
        }

        // --- B. WIPE ---
        if (sub.name === "wipe") {
            let conf = {};
            try {
                if (fs.existsSync(configPath))
                    conf = JSON.parse(fs.readFileSync(configPath));
            } catch (e) {}

            const isOwner =
                conf.ownerId && conf.ownerId === interaction.member.id;
            const hasPerm =
                interaction.member.permissions.has("manageMessages");

            if (!isOwner && !hasPerm) {
                return interaction.createMessage({
                    content:
                        "❌ **Access Denied.** You must have `Manage Messages` permissions.",
                    flags: 64,
                });
            }

            fs.writeFileSync(postsPath, "[]");
            const targetChannel = conf.channelId || interaction.channel.id;
            await this.renderBoard(bot, targetChannel, 0, true);

            return interaction.createMessage({
                content: "✅ **Database Purged.** System Reset.",
                flags: 64,
            });
        }

        // --- C. LOGS ---
        if (sub.name === "logs") {
            if (!interaction.member.permissions.has("administrator")) {
                return interaction.createMessage({
                    content:
                        "❌ **[Restricted Access]** Administrator privileges required for de-anonymization.",
                    flags: 64,
                });
            }

            const targetTrip = sub.options[0].value.trim().toUpperCase();

            let posts = [];
            try {
                posts = JSON.parse(fs.readFileSync(postsPath));
            } catch (e) {}

            const matches = posts.filter(
                (p) => p.trip === targetTrip || p.trip === "!" + targetTrip,
            );

            if (matches.length === 0) {
                return interaction.createMessage({
                    content: `🔍 No records found for tripcode \`${targetTrip}\`.`,
                    flags: 64,
                });
            }

            const logLines = matches
                .map((p) => {
                    const userTag = p.authorName
                        ? `**${p.authorName}**`
                        : "Unknown User";
                    const userId = p.authorId ? `(\`${p.authorId}\`)` : "";
                    const date = p.date
                        ? new Date(p.date).toLocaleString()
                        : "Unknown Date";
                    return `• ${date} | ${userTag} ${userId}\n  > "${p.content}"`;
                })
                .join("\n\n");

            return interaction.createMessage({
                embeds: [
                    {
                        title: "📂 Security Log: " + targetTrip,
                        description: logLines.substring(0, 4000),
                        color: 0xff0000,
                        footer: { text: "Confidential Administration Log" },
                    },
                ],
                flags: 64,
            });
        }

        // --- D. POST ---
        if (sub.name === "post") {
            const msg = sub.options.find((o) => o.name === "message").value;
            await this.processPost(interaction, bot, msg);
        }
    },

    // --- 2. INTERACTION HANDLER ---
    async handleInteraction(interaction, bot) {
        const id = interaction.data.custom_id;

        // A. OPEN MODAL
        if (id === "dangeru_open") {
            const modalData = {
                custom_id: "dangeru_submit",
                title: "Compose Dangeru Post",
                components: [
                    {
                        type: 1,
                        components: [
                            {
                                type: 4,
                                custom_id: "dangeru_msg",
                                label: "Message",
                                style: 2,
                                min_length: 2,
                                max_length: 500,
                                placeholder: "Type your message...",
                                required: true,
                            },
                        ],
                    },
                ],
            };

            if (typeof interaction.createModal !== "function") {
                return bot.createInteractionResponse(
                    interaction.id,
                    interaction.token,
                    { type: 9, data: modalData },
                );
            } else {
                return interaction.createModal(modalData);
            }
        }

        // B. SUBMIT POST
        if (id === "dangeru_submit") {
            const getValue = (targetId) => {
                if (!interaction.data.components) return null;
                for (const row of interaction.data.components) {
                    for (const component of row.components) {
                        if (component.custom_id === targetId)
                            return component.value;
                    }
                }
                return null;
            };

            const msg = getValue("dangeru_msg");
            if (msg) await this.processPost(interaction, bot, msg);
        }

        // C. PAGINATION
        if (id.startsWith("dangeru_page_")) {
            const page = parseInt(id.split("_")[2]);
            await interaction.defer(64);
            await this.renderBoard(
                bot,
                interaction.channel.id,
                page,
                false,
                interaction.message.id,
            );
        }
    },

    // --- 3. CORE LOGIC ---

    async processPost(interaction, bot, msg) {
        try {
            if (!interaction.acknowledged) await interaction.defer(64);

            const today = new Date().toISOString().split("T")[0];
            const raw = `${interaction.member.id}-${today}-SALT`;
            const hash = crypto.createHash("sha256").update(raw).digest("hex");
            const tripcode = `!${hash.substring(0, 6).toUpperCase()}`;

            const time = new Date().toLocaleTimeString("en-US", {
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
            });

            let posts = [];
            try {
                posts = JSON.parse(fs.readFileSync(postsPath));
            } catch (e) {}

            // CHECK: Did this user already post today?
            // We check this BEFORE adding the new post to the array
            const isReturningUser = posts.some((p) => p.trip === tripcode);

            // Save Post
            posts.unshift({
                trip: tripcode,
                time: time,
                content: msg,
                date: new Date().toISOString(),
                authorId: interaction.member.id,
                authorName: interaction.member.user.username,
            });

            if (posts.length > 100) posts = posts.slice(0, 100);

            fs.writeFileSync(postsPath, JSON.stringify(posts, null, 2));

            let targetChannelId = interaction.channel.id;
            if (fs.existsSync(configPath)) {
                try {
                    const conf = JSON.parse(fs.readFileSync(configPath));
                    if (conf.channelId) targetChannelId = conf.channelId;
                } catch (e) {}
            }

            await this.renderBoard(bot, targetChannelId, 0, true);

            // FINAL RESPONSE LOGIC
            // If they are returning (already have an active tripcode today), stay silent.
            if (isReturningUser) {
                // deleteOriginalMessage removes the "Thinking..." state without sending a message
                return interaction.deleteOriginalMessage();
            } else {
                // First post of the day: Send the ID confirmation
                return interaction.editOriginalMessage({
                    content: `✅ **Posted.** ID: \`${tripcode}\``,
                });
            }
        } catch (err) {
            console.error("Post Error:", err);
            try {
                await interaction.editOriginalMessage({
                    content: "❌ Failed.",
                });
            } catch (e) {}
        }
    },

    async renderBoard(
        bot,
        channelId,
        page = 0,
        forceNew = false,
        messageIdToEdit = null,
    ) {
        const POSTS_PER_PAGE = 5;

        let posts = [];
        try {
            posts = JSON.parse(fs.readFileSync(postsPath));
        } catch (e) {}

        const totalPages = Math.ceil(posts.length / POSTS_PER_PAGE);
        if (page < 0) page = 0;
        if (page >= totalPages && totalPages > 0) page = totalPages - 1;

        const start = page * POSTS_PER_PAGE;
        const end = start + POSTS_PER_PAGE;
        const pagePostsSlice = posts.slice(start, end);

        let description = "";
        if (pagePostsSlice.length === 0) {
            description = "*[No transmissions found]*";
        } else {
            // Reverse for display (Oldest -> Newest on the page)
            description = pagePostsSlice
                .reverse()
                .map((p) => {
                    return `**Anonymous ${p.trip}** [${p.time}]\n${p.content}`;
                })
                .join("\n\n");
        }

        const embed = {
            title: "🟢 Dangeru Feed",
            description: description,
            color: 0x00ff00,
            image: { url: BANNER_URL },
            footer: {
                text: `Page ${page + 1}/${totalPages || 1} • Augmented Eye Network`,
            },
            timestamp: new Date().toISOString(),
        };

        const buttons = [];
        if (page > 0) {
            buttons.push({
                type: 2,
                label: "< Newer",
                style: 2,
                custom_id: `dangeru_page_${page - 1}`,
            });
        } else {
            buttons.push({
                type: 2,
                label: "< Newer",
                style: 2,
                custom_id: "disabled_prev",
                disabled: true,
            });
        }

        buttons.push({
            type: 2,
            label: "WRITE POST",
            style: 3,
            custom_id: "dangeru_open",
            emoji: { name: "📝" },
        });

        if (end < posts.length) {
            buttons.push({
                type: 2,
                label: "Older >",
                style: 2,
                custom_id: `dangeru_page_${page + 1}`,
            });
        } else {
            buttons.push({
                type: 2,
                label: "Older >",
                style: 2,
                custom_id: "disabled_next",
                disabled: true,
            });
        }

        const components = [{ type: 1, components: buttons }];

        if (forceNew) {
            try {
                const conf = JSON.parse(fs.readFileSync(configPath));
                if (conf.lastMessageId && conf.channelId === channelId) {
                    await bot
                        .deleteMessage(channelId, conf.lastMessageId)
                        .catch(() => {});
                }
            } catch (e) {}

            const newMsg = await bot.createMessage(channelId, {
                embeds: [embed],
                components,
            });

            try {
                let conf = {};
                if (fs.existsSync(configPath))
                    conf = JSON.parse(fs.readFileSync(configPath));
                conf.channelId = channelId;
                conf.lastMessageId = newMsg.id;
                if (!conf.ownerId && fs.existsSync(configPath)) {
                    const old = JSON.parse(fs.readFileSync(configPath));
                    if (old.ownerId) conf.ownerId = old.ownerId;
                }
                fs.writeFileSync(configPath, JSON.stringify(conf));
            } catch (e) {}
        } else if (messageIdToEdit) {
            await bot.editMessage(channelId, messageIdToEdit, {
                embeds: [embed],
                components,
            });
        }
    },
};
