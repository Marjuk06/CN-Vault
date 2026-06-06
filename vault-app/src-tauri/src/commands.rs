use crate::{crypto, models, AppState};
use serde::Serialize;
use tauri::{Manager, State};

// ─────────────────────────────────────────────────────────
// DTOs
// ─────────────────────────────────────────────────────────

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VaultStatus {
    pub is_initialized: bool,
    pub is_unlocked: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub auto_lock_minutes: u32,
    pub clipboard_clear_seconds: u32,
    pub has_seen_tour: bool,
}

#[derive(Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UserProfile {
    pub name: String,
    pub avatar: String, // Base64 encoded string
}

// ─────────────────────────────────────────────────────────
// VAULT LIFECYCLE
// ─────────────────────────────────────────────────────────

/// Returns the current vault initialization and lock state.
#[tauri::command]
pub fn get_vault_status(state: State<AppState>) -> Result<VaultStatus, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare("SELECT value FROM app_metadata WHERE key = 'auth_salt'")
        .map_err(|e| e.to_string())?;
    let is_initialized = stmt.exists([]).map_err(|e| e.to_string())?;

    let key_guard = state.active_key.lock().map_err(|e| e.to_string())?;
    let is_unlocked = key_guard.is_some();

    Ok(VaultStatus {
        is_initialized,
        is_unlocked,
    })
}

use zeroize::Zeroize;

/// First-time vault setup. Derives key from master password, stores auth material, activates key.
/// Returns Err if vault is already initialized.
#[tauri::command]
pub fn init_vault(mut password: String, state: State<AppState>) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare("SELECT value FROM app_metadata WHERE key = 'auth_salt'")
        .map_err(|e| e.to_string())?;
    if stmt.exists([]).map_err(|e| e.to_string())? {
        return Err("Vault is already initialized".to_string());
    }

    let salt = crypto::generate_salt();
    let key = crypto::derive_key(&password, &salt).map_err(|e| e.to_string())?;
    
    // Zeroize the plaintext password immediately after key derivation
    password.zeroize();

    let nonce = crypto::generate_nonce();
    let verifier = b"vault_auth_verify";
    let encrypted_verifier =
        crypto::encrypt_payload(verifier, &key, &nonce).map_err(|e| e.to_string())?;

    conn.execute(
        "INSERT OR REPLACE INTO app_metadata (key, value) VALUES ('auth_salt', ?1)",
        [&hex::encode(salt)],
    )
    .map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT OR REPLACE INTO app_metadata (key, value) VALUES ('auth_nonce', ?1)",
        [&hex::encode(nonce)],
    )
    .map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT OR REPLACE INTO app_metadata (key, value) VALUES ('auth_verifier', ?1)",
        [&hex::encode(encrypted_verifier)],
    )
    .map_err(|e| e.to_string())?;

    let mut key_guard = state.active_key.lock().map_err(|e| e.to_string())?;
    *key_guard = Some(key);

    Ok(())
}

/// Unlocks the vault by verifying the master password against the stored verifier.
/// Includes exponential backoff on repeated failures (Article IV, V-04).
#[tauri::command]
pub fn unlock_vault(mut password: String, state: State<AppState>) -> Result<(), String> {
    // ── Throttle check ──────────────────────────────────────
    {
        let throttle = state.throttle.lock().map_err(|e| e.to_string())?;
        if let Some(remaining) = throttle.remaining_lockout() {
            let secs = remaining.as_secs();
            return Err(format!("Too many failed attempts. Try again in {}s.", secs));
        }
    }

    let conn = state.db.lock().map_err(|e| e.to_string())?;

    let salt_hex: String = conn
        .query_row(
            "SELECT value FROM app_metadata WHERE key = 'auth_salt'",
            [],
            |r| r.get(0),
        )
        .map_err(|_| "Vault not initialized")?;
    let nonce_hex: String = conn
        .query_row(
            "SELECT value FROM app_metadata WHERE key = 'auth_nonce'",
            [],
            |r| r.get(0),
        )
        .map_err(|_| "Missing auth nonce")?;
    let verifier_hex: String = conn
        .query_row(
            "SELECT value FROM app_metadata WHERE key = 'auth_verifier'",
            [],
            |r| r.get(0),
        )
        .map_err(|_| "Missing auth verifier")?;

    let salt = hex::decode(salt_hex).map_err(|e| e.to_string())?;
    let nonce = hex::decode(nonce_hex).map_err(|e| e.to_string())?;
    let encrypted_verifier = hex::decode(verifier_hex).map_err(|e| e.to_string())?;

    if salt.len() != 16 || nonce.len() != 12 {
        return Err("Invalid cryptographic data".to_string());
    }

    let mut salt_arr = [0u8; 16];
    salt_arr.copy_from_slice(&salt);
    let mut nonce_arr = [0u8; 12];
    nonce_arr.copy_from_slice(&nonce);

    let key = crypto::derive_key(&password, &salt_arr).map_err(|e| e.to_string())?;
    password.zeroize();
    
    // AES-GCM auth tag fails → wrong password
    let result = crypto::decrypt_payload(&encrypted_verifier, &key, &nonce_arr);

    match result {
        Err(_) => {
            // Wrong password — record failure for backoff
            drop(conn); // release db lock before acquiring throttle lock
            let mut throttle = state.throttle.lock().map_err(|e| e.to_string())?;
            throttle.record_failure();
            Err("Invalid password".to_string())
        }
        Ok(_) => {
            drop(conn); // release db lock before acquiring key lock
                        // Success — reset throttle and store active key
            {
                let mut throttle = state.throttle.lock().map_err(|e| e.to_string())?;
                throttle.reset();
            }
            let mut key_guard = state.active_key.lock().map_err(|e| e.to_string())?;
            *key_guard = Some(key);
            Ok(())
        }
    }
}

/// Locks the vault. ZeroizeOnDrop on SecretKey wipes key bytes from RAM.
#[tauri::command]
pub fn lock_vault(state: State<AppState>) -> Result<(), String> {
    let mut key_guard = state.active_key.lock().map_err(|e| e.to_string())?;
    *key_guard = None;
    Ok(())
}

// ─────────────────────────────────────────────────────────
// ENTRY CRUD
// ─────────────────────────────────────────────────────────

/// Decrypts and returns all vault entries, ordered by most recently updated.
#[tauri::command]
pub fn get_entries(state: State<AppState>) -> Result<Vec<models::VaultEntry>, String> {
    let key_guard = state.active_key.lock().map_err(|e| e.to_string())?;
    let key = key_guard.as_ref().ok_or("Vault is locked")?;

    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, encrypted_blob FROM vault_entries ORDER BY updated_at DESC")
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            let id: String = row.get(0)?;
            let blob_hex: String = row.get(1)?;
            Ok((id, blob_hex))
        })
        .map_err(|e| e.to_string())?;

    let mut entries = Vec::new();
    for row in rows {
        let (_, blob_hex) = row.map_err(|e| e.to_string())?;
        let blob = hex::decode(&blob_hex).map_err(|e| e.to_string())?;
        if blob.len() <= 12 {
            continue; // Malformed blob — skip silently
        }
        let mut nonce_arr = [0u8; 12];
        nonce_arr.copy_from_slice(&blob[..12]);
        let ciphertext = &blob[12..];

        match crypto::decrypt_payload(ciphertext, key, &nonce_arr) {
            Ok(plaintext) => {
                if let Ok(entry) = serde_json::from_slice::<models::VaultEntry>(&plaintext) {
                    entries.push(entry);
                }
            }
            Err(_) => continue, // Corrupted entry — skip, do not crash
        }
    }

    Ok(entries)
}

/// Encrypts and persists (insert or replace) a single vault entry.
/// A fresh nonce is generated on every call — nonce reuse is impossible.
#[tauri::command]
pub fn save_entry(entry: models::VaultEntry, state: State<AppState>) -> Result<(), String> {
    let key_guard = state.active_key.lock().map_err(|e| e.to_string())?;
    let key = key_guard.as_ref().ok_or("Vault is locked")?;

    let plaintext = serde_json::to_vec(&entry).map_err(|e| e.to_string())?;
    let nonce = crypto::generate_nonce();
    let ciphertext = crypto::encrypt_payload(&plaintext, key, &nonce).map_err(|e| e.to_string())?;

    // Blob layout: nonce[0..12] || ciphertext[12..]
    let mut blob = Vec::with_capacity(12 + ciphertext.len());
    blob.extend_from_slice(&nonce);
    blob.extend_from_slice(&ciphertext);
    let blob_hex = hex::encode(blob);

    let conn = state.db.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT OR REPLACE INTO vault_entries (id, created_at, updated_at, encrypted_blob)
         VALUES (?1, ?2, ?3, ?4)",
        rusqlite::params![&entry.id, entry.created_at, entry.updated_at, &blob_hex],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

/// Deletes a vault entry by ID. Requires the vault to be unlocked.
#[tauri::command]
pub fn delete_entry(id: String, state: State<AppState>) -> Result<(), String> {
    let key_guard = state.active_key.lock().map_err(|e| e.to_string())?;
    if key_guard.is_none() {
        return Err("Vault is locked".to_string());
    }
    drop(key_guard); // Release lock before acquiring db lock

    let conn = state.db.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM vault_entries WHERE id = ?1", [&id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

// ─────────────────────────────────────────────────────────
// SETTINGS
// ─────────────────────────────────────────────────────────

/// Returns all user-configurable settings.
#[tauri::command]
pub fn get_settings(state: State<AppState>) -> Result<AppSettings, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;

    let auto_lock: u32 = conn
        .query_row(
            "SELECT value FROM settings WHERE key = 'auto_lock_minutes'",
            [],
            |r| r.get::<_, String>(0),
        )
        .map(|v| v.parse().unwrap_or(5))
        .unwrap_or(5);

    let clipboard: u32 = conn
        .query_row(
            "SELECT value FROM settings WHERE key = 'clipboard_clear_seconds'",
            [],
            |r| r.get::<_, String>(0),
        )
        .map(|v| v.parse().unwrap_or(30))
        .unwrap_or(30);

    let has_seen_tour: bool = conn
        .query_row(
            "SELECT value FROM settings WHERE key = 'has_seen_tour'",
            [],
            |r| r.get::<_, String>(0),
        )
        .map(|v| v == "true")
        .unwrap_or(false);

    Ok(AppSettings {
        auto_lock_minutes: auto_lock,
        clipboard_clear_seconds: clipboard,
        has_seen_tour,
    })
}

/// Persists a single setting key/value pair.
#[tauri::command]
pub fn save_setting(key: String, value: String, state: State<AppState>) -> Result<(), String> {
    // Whitelist allowed keys — never allow arbitrary key injection
    let allowed_keys = ["auto_lock_minutes", "clipboard_clear_seconds", "has_seen_tour"];
    if !allowed_keys.contains(&key.as_str()) {
        return Err(format!("Unknown setting key: {}", key));
    }

    let conn = state.db.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT OR REPLACE INTO settings (key, value) VALUES (?1, ?2)",
        [&key, &value],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

// ─────────────────────────────────────────────────────────
// BACKUP SYSTEM
// ─────────────────────────────────────────────────────────

#[tauri::command]
pub fn export_vault(destination: String, app: tauri::AppHandle) -> Result<(), String> {
    let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let db_path = app_data_dir.join("vault.db");
    std::fs::copy(&db_path, &destination).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn import_vault(
    source_path: String,
    app: tauri::AppHandle,
    state: State<AppState>,
) -> Result<(), String> {
    let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let db_path = app_data_dir.join("vault.db");

    // Validate the source database first
    let source_conn = rusqlite::Connection::open(&source_path)
        .map_err(|_| "Failed to open imported file. It may not be a valid database.")?;

    let check_app_metadata: Result<i32, _> = source_conn.query_row(
        "SELECT count(*) FROM sqlite_master WHERE type='table' AND name='app_metadata'",
        [],
        |r| r.get(0),
    );
    let check_vault_entries: Result<i32, _> = source_conn.query_row(
        "SELECT count(*) FROM sqlite_master WHERE type='table' AND name='vault_entries'",
        [],
        |r| r.get(0),
    );

    let integrity_check: Result<String, _> = source_conn.query_row(
        "PRAGMA integrity_check",
        [],
        |r| r.get(0),
    );

    if integrity_check.unwrap_or_else(|_| "failed".to_string()) != "ok" {
        return Err("The imported file is corrupted or not a valid SQLite database.".to_string());
    }

    if check_app_metadata.unwrap_or(0) == 0 || check_vault_entries.unwrap_or(0) == 0 {
        return Err("The file is not a valid CN Vault database.".to_string());
    }
    drop(source_conn);

    // Acquire both locks — prevent any concurrent reads/writes
    let mut conn_guard = state.db.lock().map_err(|e| e.to_string())?;
    let mut key_guard = state.active_key.lock().map_err(|e| e.to_string())?;

    // Flush all WAL pages to the main database file and close the connection
    // This ensures no leftover WAL data overwrites the imported file
    conn_guard
        .execute_batch("PRAGMA wal_checkpoint(TRUNCATE);")
        .ok();

    // Drop the connection so SQLite releases file locks
    // We do this by temporarily replacing with the source DB's connection
    // Then we close it before copying
    let _ = std::mem::replace(
        &mut *conn_guard,
        rusqlite::Connection::open_in_memory().map_err(|e| e.to_string())?,
    );

    // Remove WAL and SHM sidecar files so they don't corrupt the imported data
    let wal_path = db_path.with_extension("db-wal");
    let shm_path = db_path.with_extension("db-shm");
    let _ = std::fs::remove_file(&wal_path);
    let _ = std::fs::remove_file(&shm_path);

    // Copy the backup file over the current vault
    std::fs::copy(&source_path, &db_path).map_err(|e| format!("Copy failed: {}", e))?;

    // Remove any WAL/SHM from the source backup that got carried over
    let _ = std::fs::remove_file(&wal_path);
    let _ = std::fs::remove_file(&shm_path);

    // Open a fresh connection to the imported database
    let new_conn = crate::database::init_db(app_data_dir).map_err(|e| e.to_string())?;
    *conn_guard = new_conn;

    // Lock the vault — user must re-authenticate with the backup's password
    *key_guard = None;

    Ok(())
}

#[tauri::command]
pub fn change_master_password(
    mut current_password: String,
    mut new_password: String,
    state: State<AppState>,
) -> Result<(), String> {
    let mut conn = state.db.lock().map_err(|e| e.to_string())?;

    // 1. Verify old password
    let salt_hex: String = conn
        .query_row(
            "SELECT value FROM app_metadata WHERE key = 'auth_salt'",
            [],
            |r| r.get(0),
        )
        .map_err(|_| "Vault not initialized")?;
    let nonce_hex: String = conn
        .query_row(
            "SELECT value FROM app_metadata WHERE key = 'auth_nonce'",
            [],
            |r| r.get(0),
        )
        .map_err(|_| "Missing auth nonce")?;
    let verifier_hex: String = conn
        .query_row(
            "SELECT value FROM app_metadata WHERE key = 'auth_verifier'",
            [],
            |r| r.get(0),
        )
        .map_err(|_| "Missing auth verifier")?;

    let old_salt = hex::decode(salt_hex).map_err(|e| e.to_string())?;
    let old_nonce = hex::decode(nonce_hex).map_err(|e| e.to_string())?;
    let encrypted_verifier = hex::decode(verifier_hex).map_err(|e| e.to_string())?;

    let mut old_salt_arr = [0u8; 16];
    old_salt_arr.copy_from_slice(&old_salt);
    let mut old_nonce_arr = [0u8; 12];
    old_nonce_arr.copy_from_slice(&old_nonce);

    let old_key =
        crypto::derive_key(&current_password, &old_salt_arr).map_err(|e| e.to_string())?;
    current_password.zeroize();
    
    crypto::decrypt_payload(&encrypted_verifier, &old_key, &old_nonce_arr)
        .map_err(|_| "Invalid current password")?;

    // 2. Derive new key
    let new_salt = crypto::generate_salt();
    let new_key = crypto::derive_key(&new_password, &new_salt).map_err(|e| e.to_string())?;
    new_password.zeroize();
    let new_nonce = crypto::generate_nonce();
    let verifier = b"vault_auth_verify";
    let new_encrypted_verifier =
        crypto::encrypt_payload(verifier, &new_key, &new_nonce).map_err(|e| e.to_string())?;

    // 3. Start Transaction
    let tx = conn.transaction().map_err(|e| e.to_string())?;

    tx.execute(
        "INSERT OR REPLACE INTO app_metadata (key, value) VALUES ('auth_salt', ?1)",
        [&hex::encode(new_salt)],
    )
    .map_err(|e| e.to_string())?;
    tx.execute(
        "INSERT OR REPLACE INTO app_metadata (key, value) VALUES ('auth_nonce', ?1)",
        [&hex::encode(new_nonce)],
    )
    .map_err(|e| e.to_string())?;
    tx.execute(
        "INSERT OR REPLACE INTO app_metadata (key, value) VALUES ('auth_verifier', ?1)",
        [&hex::encode(new_encrypted_verifier)],
    )
    .map_err(|e| e.to_string())?;

    // 4. Re-encrypt entries
    let mut stmt = tx
        .prepare("SELECT id, encrypted_blob FROM vault_entries")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            let id: String = row.get(0)?;
            let blob_hex: String = row.get(1)?;
            Ok((id, blob_hex))
        })
        .map_err(|e| e.to_string())?;

    let mut re_encrypted_entries = Vec::new();
    for row in rows {
        let (id, blob_hex) = row.map_err(|e| e.to_string())?;
        let blob = hex::decode(&blob_hex).map_err(|e| e.to_string())?;
        if blob.len() > 12 {
            let mut entry_nonce_arr = [0u8; 12];
            entry_nonce_arr.copy_from_slice(&blob[..12]);
            let ciphertext = &blob[12..];
            if let Ok(plaintext) = crypto::decrypt_payload(ciphertext, &old_key, &entry_nonce_arr) {
                let new_entry_nonce = crypto::generate_nonce();
                if let Ok(new_ciphertext) =
                    crypto::encrypt_payload(&plaintext, &new_key, &new_entry_nonce)
                {
                    let mut new_blob = Vec::with_capacity(12 + new_ciphertext.len());
                    new_blob.extend_from_slice(&new_entry_nonce);
                    new_blob.extend_from_slice(&new_ciphertext);
                    re_encrypted_entries.push((id, hex::encode(new_blob)));
                }
            }
        }
    }
    drop(stmt);

    for (id, new_blob_hex) in re_encrypted_entries {
        tx.execute(
            "UPDATE vault_entries SET encrypted_blob = ?1 WHERE id = ?2",
            rusqlite::params![new_blob_hex, id],
        )
        .map_err(|e| e.to_string())?;
    }

    tx.commit().map_err(|e| e.to_string())?;

    // 5. Update active key
    let mut key_guard = state.active_key.lock().map_err(|e| e.to_string())?;
    *key_guard = Some(new_key);

    Ok(())
}

#[tauri::command]
pub async fn fetch_domain_icon(url: String) -> Result<String, String> {
    // Extract domain cleanly
    let domain = url.replace("https://", "").replace("http://", "");
    let domain = domain.split('/').next().unwrap_or("").trim().to_string();
    if domain.is_empty() {
        return Err("Invalid URL".to_string());
    }

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        .user_agent("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36")
        .build()
        .map_err(|e| e.to_string())?;

    // Try Clearbit logo API first (high quality)
    let clearbit_url = format!("https://logo.clearbit.com/{}", domain);
    if let Ok(response) = client.get(&clearbit_url).send().await {
        if response.status().is_success() {
            if let Ok(bytes) = response.bytes().await {
                if !bytes.is_empty() {
                    use base64::Engine;
                    let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
                    // Clearbit returns PNG
                    return Ok(format!("data:image/png;base64,{}", b64));
                }
            }
        }
    }

    // Fallback: direct favicon.ico from the domain
    let favicon_url = format!("https://{}/favicon.ico", domain);
    if let Ok(response) = client.get(&favicon_url).send().await {
        if response.status().is_success() {
            let content_type = response
                .headers()
                .get("content-type")
                .and_then(|v| v.to_str().ok())
                .unwrap_or("image/x-icon")
                .to_string();
            if let Ok(bytes) = response.bytes().await {
                if !bytes.is_empty() {
                    use base64::Engine;
                    let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
                    let mime = if content_type.contains("png") {
                        "image/png"
                    } else if content_type.contains("svg") {
                        "image/svg+xml"
                    } else {
                        "image/x-icon"
                    };
                    return Ok(format!("data:{};base64,{}", mime, b64));
                }
            }
        }
    }

    // Last resort: Google's favicon service (fast, reliable)
    let google_url = format!("https://www.google.com/s2/favicons?domain={}&sz=64", domain);
    let response = client
        .get(&google_url)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if response.status().is_success() {
        let bytes = response.bytes().await.map_err(|e| e.to_string())?;
        if !bytes.is_empty() {
            use base64::Engine;
            let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
            return Ok(format!("data:image/png;base64,{}", b64));
        }
    }

    Err("Could not fetch icon from any source".to_string())
}

#[tauri::command]
pub fn get_user_profile(state: State<AppState>) -> Result<UserProfile, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;

    let name = conn
        .query_row(
            "SELECT value FROM app_metadata WHERE key = 'profile_name'",
            [],
            |r| r.get::<_, String>(0),
        )
        .unwrap_or_else(|_| "Vault User".to_string());

    let avatar = conn
        .query_row(
            "SELECT value FROM app_metadata WHERE key = 'profile_avatar'",
            [],
            |r| r.get::<_, String>(0),
        )
        .unwrap_or_else(|_| "".to_string());

    Ok(UserProfile { name, avatar })
}

#[tauri::command]
pub fn set_user_profile(profile: UserProfile, state: State<AppState>) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;

    conn.execute(
        "INSERT OR REPLACE INTO app_metadata (key, value) VALUES ('profile_name', ?1)",
        [&profile.name],
    )
    .map_err(|e| e.to_string())?;

    conn.execute(
        "INSERT OR REPLACE INTO app_metadata (key, value) VALUES ('profile_avatar', ?1)",
        [&profile.avatar],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}
