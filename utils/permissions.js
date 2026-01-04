// Define the requirements for each command here
const PERMISSION_LEVELS = {
    // Command Name  :  Required Permission (String or Special Flag)
    'audit':        'manageRoles',
    'ghost':        'manageGuild',
    'purge':        'manageMessages',
    'role':         'manageRoles',
    'steal':        'manageEmojisAndStickers',
    'trigger':      'manageMessages',
    'dashboard':    'manageGuild',
    'config':       'manageGuild', // Since you just added this
    
    // Special Cases
    'dangeru':      'everyone', // The command itself is public, specific subcommands might be locked
    'owner_only':   'BOT_OWNER'
};

const BOT_OWNER_ID = "541882021434359811"; // Your ID from dangeru.js

module.exports = {
    /**
     * Checks if the user has permission to run the command.
     * Returns TRUE if allowed, or sends a rejection message and returns FALSE.
     */
    async check(interaction, commandName, subCommand = null) {
        const requiredPerm = PERMISSION_LEVELS[commandName];

        // 1. No requirement = Public
        if (!requiredPerm || requiredPerm === 'everyone') return true;

        // 2. Bot Owner Bypass (Always allow owner to do anything)
        if (interaction.member.id === BOT_OWNER_ID) return true;

        // 3. Special Case: Dangeru Wipe (Subcommand check)
        if (commandName === 'dangeru' && subCommand === 'wipe') {
             if (interaction.member.id !== BOT_OWNER_ID) {
                await interaction.createMessage({
                    content: "❌ **Access Denied.** This protocol is for the System Administrator only.",
                    flags: 64
                });
                return false;
             }
             return true;
        }

        // 4. Discord Permission Check
        if (requiredPerm !== 'BOT_OWNER' && !interaction.member.permissions.has(requiredPerm)) {
            // Make the permission name readable (e.g., manageGuild -> Manage Server)
            const readable = requiredPerm
                .replace(/([A-Z])/g, ' $1') // Add space before caps
                .replace(/^./, str => str.toUpperCase()) // Capitalize first letter
                .replace("Guild", "Server") // Discord calls it "Server" in UI
                .trim();

            await interaction.createMessage({
                content: `🚫 **Access Denied.** You need the \`${readable}\` permission to use this command.`,
                flags: 64
            });
            return false;
        }

        // 5. Bot Owner Only Check
        if (requiredPerm === 'BOT_OWNER') {
             await interaction.createMessage({
                content: "🔒 **Restricted.** This command is for the developer only.",
                flags: 64
            });
            return false;
        }

        return true;
    }
};