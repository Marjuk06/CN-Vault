pub mod commands;
pub mod crypto;
mod database;
mod models;

use crate::crypto::SecretKey;
use rusqlite::Connection;
use std::sync::Mutex;
use std::time::{Duration, Instant};
use tauri::Manager;

/// Exponential backoff state for unlock attempt throttling.
/// Implements Constitution Article IV — security hardening (V-04).
pub struct UnlockThrottle {
    /// Number of consecutive failed attempts
    pub fail_count: u32,
    /// Time of the last failed attempt (None = no failures yet)
    pub last_failure: Option<Instant>,
}

impl UnlockThrottle {
    pub fn new() -> Self {
        Self {
            fail_count: 0,
            last_failure: None,
        }
    }

    /// Returns the current lockout duration based on fail_count.
    /// 0 fails → 0s, 1 → 1s, 2 → 2s, 3 → 4s, 4 → 8s, 5+ → 16s (capped at 30s)
    pub fn lockout_duration(&self) -> Duration {
        if self.fail_count == 0 {
            return Duration::ZERO;
        }
        let secs = (2u64.pow(self.fail_count.saturating_sub(1))).min(30);
        Duration::from_secs(secs)
    }

    /// Returns the remaining wait time if still locked out, or None if clear to attempt.
    pub fn remaining_lockout(&self) -> Option<Duration> {
        let last = self.last_failure?;
        let lockout = self.lockout_duration();
        if lockout.is_zero() {
            return None;
        }
        let elapsed = last.elapsed();
        if elapsed < lockout {
            Some(lockout - elapsed)
        } else {
            None
        }
    }

    pub fn record_failure(&mut self) {
        self.fail_count += 1;
        self.last_failure = Some(Instant::now());
    }

    pub fn reset(&mut self) {
        self.fail_count = 0;
        self.last_failure = None;
    }
}

pub struct AppState {
    pub db: Mutex<Connection>,
    pub active_key: Mutex<Option<SecretKey>>,
    pub throttle: Mutex<UnlockThrottle>,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            // Vault lifecycle
            commands::get_vault_status,
            commands::init_vault,
            commands::unlock_vault,
            commands::lock_vault,
            // Entry CRUD
            commands::get_entries,
            commands::save_entry,
            commands::delete_entry,
            // Settings
            commands::get_settings,
            commands::save_setting,
            commands::change_master_password,
            // Backup
            commands::export_vault,
            commands::import_vault,
            // Profile
            commands::get_user_profile,
            commands::set_user_profile,
            // Misc
            commands::fetch_domain_icon,
        ])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            let app_data_dir = app
                .path()
                .app_data_dir()
                .expect("Failed to get app data dir");
            let conn = database::init_db(app_data_dir).expect("Failed to initialize database");

            app.manage(AppState {
                db: Mutex::new(conn),
                active_key: Mutex::new(None),
                throttle: Mutex::new(UnlockThrottle::new()),
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
