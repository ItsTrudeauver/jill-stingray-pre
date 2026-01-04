module.exports = {
    // The "Factory Settings" for every server
    DEFAULT_RULES: {

        "8ball": { enabled: true, min_perm: null, allow_channels: [], block_channels: [] },
        avatar: { enabled: true, min_perm: null, allow_channels: [], block_channels: [] },
        ghost: { enabled: true, min_perm: "manageGuild", allow_channels: [], block_channels: [] },
        id: { enabled: true, min_perm: null, allow_channels: [], block_channels: [] },
        menu: { enabled: true, min_perm: null, allow_channels: [], block_channels: [] },
        perms: { enabled: true, min_perm: "administrator", allow_channels: [], block_channels: [] },
        ping: { enabled: true, min_perm: null, allow_channels: [], block_channels: [] },
        pulse: { enabled: true, min_perm: null, allow_channels: [], block_channels: [] },
        role: { enabled: true, min_perm: "manageRoles", allow_channels: [], block_channels: [] },
        serverinfo: { enabled: true, min_perm: null, allow_channels: [], block_channels: [] },
        streamline: { enabled: true, min_perm: "manageMessages", allow_channels: [], block_channels: [] },
        surprise: { enabled: true, min_perm: null, allow_channels: [], block_channels: [] },
        tab: { enabled: true, min_perm: null, allow_channels: [], block_channels: [] },
        threads: { enabled: true, min_perm: null, allow_channels: [], block_channels: [] },
        userinfo: { enabled: true, min_perm: null, allow_channels: [], block_channels: [] },
        
        // Public Commands
        mix: { enabled: true, min_perm: null, allow_channels: [], block_channels: [] },
        custom: { enabled: true, min_perm: null, allow_channels: [], block_channels: [] },
        emojistats: { enabled: true, min_perm: null, allow_channels: [], block_channels: [] },
        regulars: { enabled: true, min_perm: null, allow_channels: [], block_channels: [] },
        help: { enabled: true, min_perm: null, allow_channels: [], block_channels: [] },
        
        // Moderator Commands (Restricted by default)
        trigger: { enabled: true, min_perm: "manageMessages", allow_channels: [], block_channels: [] },
        identity: { enabled: true, min_perm: "manageMessages", allow_channels: [], block_channels: [] },
        purge: { enabled: true, min_perm: "manageMessages", allow_channels: [], block_channels: [] },
        steal: { enabled: true, min_perm: "manageMessages", allow_channels: [], block_channels: [] },
        
        // Admin / Dangerous Commands
        dangeru: { enabled: false, min_perm: "administrator", allow_channels: [], block_channels: [] }, // Safety first
        audit: { enabled: true, min_perm: "administrator", allow_channels: [], block_channels: [] },
        dashboard: { enabled: true, min_perm: "administrator", allow_channels: [], block_channels: [] } // Dashboard is always protected
    }
};