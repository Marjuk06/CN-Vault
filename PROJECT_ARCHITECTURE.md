# CN Vault - Project Architecture

## 1. Project Overview
**CN Vault** is a secure, cross-platform desktop password manager and digital vault. 
- **Primary Purpose:** Securely store and manage sensitive information including passwords, notes, API keys, and recovery codes offline on the user's device.
- **Main User Workflows:** 
  - **Setup:** Create a master password to initialize the encrypted vault.
  - **Unlock:** Enter the master password to access stored entries.
  - **Manage:** Add, edit, organize (by category), and delete vault entries.
  - **Generate:** Create strong, high-entropy passwords via the built-in password generator.
  - **Settings:** Configure auto-lock timeout, clipboard clearing duration, profile details, and perform database backups.
- **Key Features:** Zero-knowledge encryption architecture, automatic clipboard clearing, inactivity auto-lock, and offline-first storage.

## 2. Architecture
CN Vault is built on the **Tauri** framework, combining a fast web frontend with a secure Rust backend.

- **Frontend Architecture:** Built with React, TypeScript, and Vite. UI styling is handled via Tailwind CSS. Global state is managed by Zustand. 
- **Backend Architecture:** Built with Rust. The backend manages the encrypted SQLite database (`rusqlite`), cryptographic operations (`argon2`, `aes-gcm`), and file system interactions.
- **Tauri Bridge Architecture:** The frontend communicates with the Rust backend via asynchronous Inter-Process Communication (IPC) using Tauri's `invoke` command system.
- **Data Flow:** 
  1. Frontend invokes a command (e.g., `save_entry`).
  2. Backend receives the payload, encrypts the sensitive data using the in-memory Data Encryption Key (DEK).
  3. Backend persists the encrypted blob to SQLite.
  4. Backend returns a success result.
  5. Frontend updates the Zustand store and re-renders the UI.

## 3. File and Folder Map

```text
src/
  assets/        # Static assets like logos and images
  components/    # Reusable UI components (ErrorBoundary, buttons, dialogs)
  features/      # Domain-specific modules (auth, entries, generator, settings)
  hooks/         # Custom React hooks (e.g., useAutoLock.ts)
  lib/           # Utilities, schemas (Zod), and helper functions
  store/         # Zustand global state definitions (vaultStore.ts)
  App.tsx        # Main React application entry point and routing layout

src-tauri/
  src/
    commands.rs  # Tauri IPC command handlers (the bridge API)
    crypto.rs    # Cryptographic primitives (Argon2id, AES-256-GCM)
    database.rs  # SQLite connection initialization, schema, and migrations
    models.rs    # Rust structs for database mapping and serialization
    lib.rs       # Tauri application builder and plugin registration
    main.rs      # Backend entry point
  Cargo.toml     # Rust dependencies and workspace configuration
  tauri.conf.json# Tauri build, security, and bundle configuration
```
- **`src/components/`**: Houses generic, highly reusable UI components that are not tied to specific business logic.
- **`src/features/`**: Groups code by domain (e.g., `entries` for the vault list/modals, `settings` for the preferences panel).
- **`src/store/`**: Centralized client-side state, preventing prop-drilling.
- **`src-tauri/src/crypto.rs`**: Core security logic; handles all key derivation and encryption/decryption.
- **`src-tauri/src/commands.rs`**: The gateway between the JS frontend and the Rust backend.

## 4. State Management
Client-side state is managed using **Zustand** via `useVaultStore` (`src/store/vaultStore.ts`).

- **Global State:** Tracks `status` (`uninitialized`, `locked`, `unlocked`) to determine which root screen to render.
- **Vault State:** Holds the array of decrypted `entries` currently loaded in memory, user `settings` (auto-lock, clipboard timeouts), and `userProfile`.
- **Session State:** Maintains transient UI state like `searchQuery`, `activeCategory`, `selectedEntryId`, and active `toasts`.

**Flow:** The store provides async actions (e.g., `addEntry`, `lockVault`) that internally call Tauri `invoke` commands and then synchronously update the local state upon success.

## 5. Tauri Commands

| Command | Purpose |
| --- | --- |
| `get_vault_status` | Checks if the vault is initialized and currently unlocked. |
| `init_vault` | Sets up the master password and generates the initial encryption keys. |
| `unlock_vault` | Verifies the master password and loads the Data Encryption Key (DEK) into memory. |
| `lock_vault` | Purges the DEK from backend memory and locks the application. |
| `get_entries` | Retrieves and decrypts all vault entries for the frontend. |
| `save_entry` | Encrypts and persists a single vault entry to the database. |
| `delete_entry` | Removes a specific vault entry from the database by ID. |
| `get_settings` | Retrieves application preferences. |
| `save_setting` | Updates an application preference. |
| `get_user_profile` | Retrieves user profile metadata (name, avatar). |
| `set_user_profile` | Updates user profile metadata. |
| `fetch_domain_icon` | Fetches and caches a base64 favicon for a given URL. |
| `change_password` | Re-encrypts the vault with a new master password. |
| `export_vault` | Creates an encrypted backup of the SQLite database. |
| `import_vault` | Restores the database from an encrypted backup. |

## 6. Database
- **Engine:** SQLite (via the `rusqlite` crate).
- **Schema:**
  - `app_metadata`: Key-value store for application secrets. Stores the `auth_salt`, the encrypted `auth_verify` token, and the `encrypted_db_key`.
  - `settings`: Key-value store for user preferences (e.g., `auto_lock_minutes`, `clipboard_clear_seconds`).
  - `vault_entries`: Stores the core data. Columns include `id`, `created_at`, `updated_at`, and `encrypted_blob` (the AES-GCM encrypted payload containing the entry details).
  - `domain_icons`: Caches base64 favicons to prevent repeated network requests. Columns include `domain`, `file_path`, `icon_source`, and `last_fetched`.
- **Relationships:** The database acts primarily as a document store where the `encrypted_blob` holds the structured JSON of each vault entry.

## 7. Cryptography
- **Key Derivation:** Argon2id is used to derive a Key Encryption Key (KEK) from the user's master password and a randomly generated salt.
- **Encryption Algorithm:** AES-256-GCM (Authenticated Encryption with Associated Data).
- **Storage Format:** 
  - The KEK is never stored.
  - A random Data Encryption Key (DEK) is generated upon initialization. The KEK encrypts the DEK, and the encrypted DEK is stored in `app_metadata`.
  - The DEK is used to encrypt/decrypt the `encrypted_blob` of each vault entry.
- **Vault Lifecycle:** When unlocking, Argon2id derives the KEK, decrypts the DEK, and holds the DEK in memory (`ActiveKey`). When locking, the DEK is zeroized and purged from memory.

## 8. UI Screens
- **Setup Wizard:** Guides the user through initializing their master password, profile, and security settings on first launch.
- **Unlock Screen:** Prompts for the master password to derive the KEK and unlock the vault.
- **Dashboard:** The main workspace. Features a sidebar for category navigation, a search bar, a list of entries, and a detail view pane.
- **Settings:** A modal panel for updating the user profile, auto-lock timeouts, clipboard clearing durations, changing the master password, and managing backups.
- **Password Generator:** A utility modal allowing users to generate high-entropy passwords with configurable length and character sets.
- **Entry Modal:** A dialog for creating or editing vault items, including custom fields and notes.

## 9. Critical Files
The following files contain security-critical logic or data persistence mechanics and should NOT be modified casually:
- `src-tauri/src/crypto.rs` (Cryptographic primitives and key management)
- `src-tauri/src/database.rs` (Raw SQL queries and database migrations)
- `src-tauri/src/commands.rs` (IPC interface; handles sensitive data passing)
- `src/store/vaultStore.ts` (Manages sensitive client-side state and memory clearing)

## 10. Public Interfaces
- **Tauri IPC Contracts:** The commands listed in Section 5 are the definitive API between the frontend and backend.
- **Serialized Structures:** The frontend `VaultEntry` interface must strictly match the Rust backend's expected JSON deserialization format.
- **Persistent Storage:** The SQLite schema and the format of the `encrypted_blob` (which includes the nonce and ciphertext) are permanent storage formats that require careful migration if changed.

## 11. Humanization Safety Report
A full project humanization pass has **already been completed** prior to this report.
- **AI-Style Comments:** Removed across the entire codebase.
- **Verbose Documentation:** Simplified to concise, natural developer language.
- **Obvious Comments:** Stripped from React components and Rust functions.
- **Section Headers:** Removed from `vaultStore.ts`, `App.tsx`, `commands.rs`, `crypto.rs`, `database.rs`, and UI components.
No further humanization sweeps are required at this time.
