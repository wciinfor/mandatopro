const SupabaseService = {
    getClient() {
        return window.SupabaseClient || null;
    },
    getAdminClient() {
        return window.AdminClient || null;
    },
    getTempClient() {
        return window.TempClient || null;
    }
};

window.SupabaseService = SupabaseService;
