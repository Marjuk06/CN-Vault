use rusqlite::{Connection, Result};
use std::fs;
use std::path::PathBuf;

pub fn init_db(app_data_dir: PathBuf) -> Result<Connection> {
    if !app_data_dir.exists() {
        fs::create_dir_all(&app_data_dir).expect("Failed to create app data directory");
    }

    let db_path = app_data_dir.join("vault.db");
    let conn = Connection::open(db_path)?;

    // Performance and safety PRAGMAs
    conn.execute_batch(
        "PRAGMA journal_mode = WAL;
         PRAGMA synchronous   = NORMAL;
         PRAGMA foreign_keys  = ON;
         PRAGMA cache_size    = -32000;
         PRAGMA mmap_size     = 268435456;",
    )?;

    // Schema migrations — CREATE TABLE IF NOT EXISTS is safe to run on every launch
    conn.execute_batch(
        "
        -- Vault-level auth material and app metadata
        CREATE TABLE IF NOT EXISTS app_metadata (
            key   TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );

        -- User-configurable settings (auto_lock_minutes, clipboard_clear_seconds, etc.)
        CREATE TABLE IF NOT EXISTS settings (
            key   TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );

        -- Core vault entries — all sensitive data is inside encrypted_blob
        -- encrypted_blob = hex( nonce[12 bytes] || aes_gcm_ciphertext )
        CREATE TABLE IF NOT EXISTS vault_entries (
            id             TEXT PRIMARY KEY,
            created_at     INTEGER NOT NULL,
            updated_at     INTEGER NOT NULL,
            encrypted_blob TEXT NOT NULL
        );

        -- Icon cache registry — maps domain to local filesystem path
        CREATE TABLE IF NOT EXISTS domain_icons (
            domain       TEXT PRIMARY KEY,
            file_path    TEXT NOT NULL,
            icon_source  TEXT NOT NULL,
            last_fetched INTEGER NOT NULL
        );

        -- Performance indexes for 100k+ entry support
        CREATE INDEX IF NOT EXISTS idx_entries_updated ON vault_entries(updated_at DESC);
        CREATE INDEX IF NOT EXISTS idx_entries_created ON vault_entries(created_at DESC);
        ",
    )?;

    // Seed default settings if not present
    conn.execute_batch(
        "INSERT OR IGNORE INTO settings (key, value) VALUES ('auto_lock_minutes', '5');
         INSERT OR IGNORE INTO settings (key, value) VALUES ('clipboard_clear_seconds', '30');",
    )?;

    Ok(conn)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;
    use tempfile::tempdir;

    #[test]
    fn test_initialize_database() {
        let dir = tempdir().unwrap();
        let conn = init_db(dir.path().to_path_buf()).unwrap();

        // Check if tables exist
        let mut stmt = conn
            .prepare("SELECT name FROM sqlite_master WHERE type='table'")
            .unwrap();
        let tables: Vec<String> = stmt
            .query_map([], |row| row.get(0))
            .unwrap()
            .map(|r| r.unwrap())
            .collect();

        assert!(tables.contains(&"app_metadata".to_string()));
        assert!(tables.contains(&"settings".to_string()));
        assert!(tables.contains(&"vault_entries".to_string()));
        assert!(tables.contains(&"domain_icons".to_string()));

        // Check default settings were seeded
        let auto_lock: String = conn
            .query_row(
                "SELECT value FROM settings WHERE key = 'auto_lock_minutes'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(auto_lock, "5");
    }
}
