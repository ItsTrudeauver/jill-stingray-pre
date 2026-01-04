module.exports = {
    // The "Factory Settings" for every server
    DEFAULT_RULES: {
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