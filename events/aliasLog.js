const { db } = require("../utils/db");

module.exports = {
    name: "guildMemberUpdate",
    async execute(guild, member, oldMember, bot) {
        if (!oldMember) return;
        const oldName = oldMember.nick || oldMember.username;
        const newName = member.nick || member.user.username;

        if (oldName !== newName) {
            try {
                await db.query(`
                    INSERT INTO aliases (user_id, guild_id, old_name, new_name, timestamp)
                    VALUES ($1, $2, $3, $4, $5)
                `, [member.id, guild.id, oldName, newName, Date.now()]);
            } catch (e) {
                console.error("Alias Log Error:", e);
            }
        }
    }
};