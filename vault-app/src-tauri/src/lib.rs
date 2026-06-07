pub mod commands;
pub mod crypto;
mod database;
mod models;

use crate::crypto::SecretKey;
use rusqlite::Connection;
use std::sync::Mutex;
use std::time::{Duration, Instant};
use tauri::Manager;

pub struct UnlockThrottle {
    pub fail_count: u32,
    pub last_failure: Option<Instant>,
}

impl UnlockThrottle {
    pub fn new() -> Self {
        Self {
            fail_count: 0,
            last_failure: None,
        }
    }

    pub fn lockout_duration(&self) -> Duration {
        if self.fail_count == 0 {
            return Duration::ZERO;
        }
        let secs = (2u64.pow(self.fail_count.saturating_sub(1))).min(30);
        Duration::from_secs(secs)
    }

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
            commands::get_vault_status,
            commands::init_vault,
            commands::unlock_vault,
            commands::lock_vault,
            commands::get_entries,
            commands::save_entry,
            commands::delete_entry,
            commands::get_settings,
            commands::save_setting,
            commands::change_master_password,
            commands::export_vault,
            commands::import_vault,
            commands::get_user_profile,
            commands::set_user_profile,
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
