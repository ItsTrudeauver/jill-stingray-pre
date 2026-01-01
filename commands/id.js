const { createCanvas, loadImage, GlobalFonts } = require("@napi-rs/canvas");
const path = require("path");
const fs = require("fs");

// --- CONFIGURATION ---
const ASSET_DIR = path.join(__dirname, "../data/id");
const FONT_PATH = path.join(ASSET_DIR, "font.ttf");
const BG_PATH = path.join(ASSET_DIR, "bg.webp");

// Register Font
try {
    if (fs.existsSync(FONT_PATH))
        GlobalFonts.registerFromPath(FONT_PATH, "VA11");
} catch (e) {
    console.error("[ID] Font Error:", e);
}

module.exports = {
    name: "id",
    description: "Generate your official Glitch City Citizen ID.",
    options: [
        {
            name: "user",
            description: "Check another citizen's ID (optional).",
            type: 6,
            required: false,
        },
    ],
    async execute(interaction, bot) {
        await interaction.defer();

        // 1. RESOLVE MEMBER (We need the Member object for Roles/Join Date, not just User)
        let member = interaction.member;
        let user = member.user;

        // If a target is selected, fetch their Guild Member profile
        if (interaction.data.options && interaction.data.options[0]) {
            try {
                const targetId = interaction.data.options[0].value;
                member = await bot.getRESTGuildMember(
                    interaction.guildID,
                    targetId,
                );
                user = member.user;
            } catch (e) {
                // Fallback: If they aren't in the server, we can't get roles.
                // We'll proceed with basic user data.
                try {
                    user = await bot.getRESTUser(
                        interaction.data.options[0].value,
                    );
                    member = null; // Flag that we have no guild data
                } catch (err) {
                    member = interaction.member;
                    user = member.user;
                }
            }
        }

        // 2. GATHER DATA
        // Occupation (Highest Role)
        let occupation = "FREELANCER";
        let roleColor = "#ffffff";
        let clearance = "1";

        if (member && member.roles && member.roles.length > 0) {
            // Eris doesn't sort roles by default, we need to find the highest position
            const guildRoles = interaction.channel.guild.roles; // Cache access

            // Filter user's roles and sort by position
            const userRoles = member.roles
                .map((rId) => guildRoles.get(rId))
                .filter((r) => r);
            userRoles.sort((a, b) => b.position - a.position);

            if (userRoles.length > 0) {
                occupation = userRoles[0].name.toUpperCase();
                // We simplify role colors to avoid unreadable dark colors
                if (userRoles[0].color !== 0)
                    roleColor = `#${userRoles[0].color.toString(16).padStart(6, "0")}`;
            }

            // Calculate Clearance
            if (member.permissions.has("administrator")) clearance = "5 (OMNI)";
            else if (member.permissions.has("manageGuild"))
                clearance = "4 (EXEC)";
            else if (member.permissions.has("manageMessages"))
                clearance = "3 (SEC)";
            else clearance = "1 (CIV)";
        }

        // 3. SETUP CANVAS
        const canvas = createCanvas(600, 350);
        const ctx = canvas.getContext("2d");
        const fontStack = '"VA11", sans-serif';

        // --- LAYER A: BACKGROUND ---
        try {
            if (fs.existsSync(BG_PATH)) {
                const bg = await loadImage(BG_PATH);
                ctx.drawImage(bg, 0, 0, 600, 350);

                // Matte Overlay (No blur, just dark tint for flat look)
                ctx.fillStyle = "rgba(15, 15, 20, 0.85)";
                ctx.fillRect(0, 0, 600, 350);
            } else {
                ctx.fillStyle = "#180c1e";
                ctx.fillRect(0, 0, 600, 350);
            }
        } catch (e) {
            ctx.fillStyle = "#180c1e";
            ctx.fillRect(0, 0, 600, 350);
        }

        // --- LAYER B: FLAT UI ELEMENTS ---
        // Top Header Bar
        ctx.fillStyle = roleColor;
        ctx.fillRect(0, 0, 600, 10);

        // Avatar Box (Clean lines, NO GLOW)
        ctx.strokeStyle = roleColor;
        ctx.lineWidth = 2;
        ctx.strokeRect(30, 40, 140, 140);

        // Data Box Backgrounds
        ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
        ctx.fillRect(190, 40, 380, 280); // Main Data Container

        // --- LAYER C: AVATAR ---
        try {
            const avatarUrl = user.dynamicAvatarURL("png", 256);
            const avatar = await loadImage(avatarUrl);
            ctx.drawImage(avatar, 35, 45, 130, 130);

            // Hard Tech Overlay (Scan lines on avatar only)
            ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
            for (let i = 45; i < 175; i += 4) ctx.fillRect(35, i, 130, 1);
        } catch (e) {}

        // --- LAYER D: TEXT DATA ---
        ctx.textBaseline = "top";

        // 1. NAME
        ctx.fillStyle = "#ffffff";
        ctx.font = `32px ${fontStack}`;
        ctx.fillText(user.username.toUpperCase().substring(0, 16), 210, 55);

        // 2. ID
        ctx.font = `18px ${fontStack}`;
        ctx.fillStyle = "#888888";
        ctx.fillText(`UUID: ${user.id}`, 210, 95);

        // -- DATA GRID --
        ctx.font = `16px ${fontStack}`;
        const col1 = 210;
        const col2 = 400;
        const rowStart = 140;
        const rowGap = 50;

        // Row 1: OCCUPATION (Role)
        ctx.fillStyle = roleColor;
        ctx.fillText("OCCUPATION", col1, rowStart);
        ctx.fillStyle = "#ffffff";
        ctx.fillText(occupation.substring(0, 14), col1, rowStart + 20);

        // Row 1: CLEARANCE (Perms)
        ctx.fillStyle = roleColor;
        ctx.fillText("CLEARANCE", col2, rowStart);
        ctx.fillStyle = "#ffffff";
        ctx.fillText(clearance, col2, rowStart + 20);

        // Row 2: ORIGIN (Account Age)
        const created = new Date(user.createdAt).toLocaleDateString("en-US", {
            year: "2-digit",
            month: "2-digit",
            day: "2-digit",
        });
        ctx.fillStyle = roleColor;
        ctx.fillText("ORIGIN DATE", col1, rowStart + rowGap);
        ctx.fillStyle = "#cccccc";
        ctx.fillText(created, col1, rowStart + rowGap + 20);

        // Row 2: JOINED (Server Join)
        let joined = "N/A";
        if (member)
            joined = new Date(member.joinedAt).toLocaleDateString("en-US", {
                year: "2-digit",
                month: "2-digit",
                day: "2-digit",
            });

        ctx.fillStyle = roleColor;
        ctx.fillText("CITIZEN SINCE", col2, rowStart + rowGap);
        ctx.fillStyle = "#cccccc";
        ctx.fillText(joined, col2, rowStart + rowGap + 20);

        // Row 3: STATUS (Tier calculation)
        const lastDigit = parseInt(user.id.slice(-1));
        let status = "ACTIVE";
        if (member && !member.pending) status = "VERIFIED";
        if (lastDigit === 0) status = "WATCHLIST";

        ctx.fillStyle = roleColor;
        ctx.fillText("STATUS", col1, rowStart + rowGap * 2);
        ctx.fillStyle = status === "WATCHLIST" ? "#ff0055" : "#00ff9d";
        ctx.fillText(status, col1, rowStart + rowGap * 2 + 20);

        // --- LAYER E: DECORATIONS ---
        // Barcode (Fake)
        ctx.fillStyle = "#ffffff";
        let x = 30;
        while (x < 170) {
            let w = Math.random() * 3 + 1;
            ctx.fillRect(x, 280, w, 30);
            x += w + Math.random() * 4;
        }
        ctx.font = "10px monospace";
        ctx.fillText(user.id.slice(0, 12), 30, 315);

        // 4. SEND
        const buffer = await canvas.encode("png");
        await interaction.createMessage(
            {
                content: `🪪 **Identification Card: ${user.username}**`,
            },
            {
                file: buffer,
                name: "id_card.png",
            },
        );
    },
};
