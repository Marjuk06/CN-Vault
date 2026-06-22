# GitHub Actions Workflows Documentation

This repository employs several streamlined, production-grade GitHub Actions to maintain code quality, build releases securely, check dependencies, and perform security audits. The architecture is designed to be stable, fast, and low-noise, making it ideal for a single-maintainer open-source project.

## Workflows Overview

### 1. **CI (`.github/workflows/ci.yml`)**
**Triggers**: `push` to `main`, `pull_request` to `main`, `workflow_dispatch`.
**Purpose**: Provides fast validation of the application on every push/PR without the overhead of full cross-platform builds.
- **actionlint**: Validates the YAML syntax of GitHub Actions workflows. Runs isolated with `continue-on-error`.
- **markdownlint**: Ensures Markdown files adhere to styling standards. Runs isolated with `continue-on-error`.
- **validate**: A unified, high-speed validation pipeline running on `ubuntu-latest`. It verifies the frontend (`npm run lint`, `npm run build`) and the backend (`cargo fmt`, `cargo clippy`, `cargo check`, `cargo test`) sequentially to minimize setup overhead.
**Features**:
- Avoids redundant full-binary builds.
- Uses `concurrency` cancellation for redundant PR runs.
- Includes `timeout-minutes` to prevent hanging processes.
**Permissions**: `contents: read`

### 2. **Release (`.github/workflows/release.yml`)**
**Triggers**: `release` (published), `workflow_dispatch`.
**Purpose**: Securely builds and signs the application when a GitHub Release is created, and attaches the resulting binaries natively via Tauri.
**Features**:
- Matrix build for Windows, macOS, and Linux.
- Conditionally uses Apple developer secrets if present to sign macOS builds.
- Leverages the official `tauri-apps/tauri-action` to compile and directly upload the generated release assets (`.msi`, `.deb`, `.dmg`, etc.) automatically to the published release.
**Permissions**: `contents: write` (to publish assets to the GitHub Release).

### 3. **Security Scans (`.github/workflows/security.yml`)**
**Triggers**: Scheduled weekly (`cron: '0 0 * * 0'`), `workflow_dispatch`.
**Purpose**: Audits dependencies for known security vulnerabilities.
- Runs `npm audit --audit-level=high` on the frontend (`vault-app/`).
- Runs `cargo audit` via `rustsec/audit-check` on the backend (`vault-app/src-tauri/`) which uses an optimized database cache to prevent costly compilation steps.
**Permissions**: `contents: read`

### 4. **CodeQL (`.github/workflows/codeql.yml`)**
**Triggers**: `push` to `main`, `pull_request` to `main`, weekly schedule, `workflow_dispatch`.
**Purpose**: Advanced static analysis tool to find security vulnerabilities. Configured for `javascript-typescript`. (Note: Rust is not natively supported by the standard CodeQL action).
**Permissions**: `security-events: write`, `contents: read`, `actions: read`.

### 5. **Dependency Review (`.github/workflows/dependency-review.yml`)**
**Triggers**: `pull_request` to `main`.
**Purpose**: Checks incoming PRs for vulnerable dependencies before they are merged into `main` using `actions/dependency-review-action`. Blocks PRs introducing critical CVEs.
**Permissions**: `contents: read`

### 6. **Sync Labels (`.github/workflows/labels.yml`)**
**Triggers**: `push` modifying `.github/labels.yml`, `workflow_dispatch`.
**Purpose**: Keeps the repository's labels synced dynamically with the `.github/labels.yml` definition.
**Permissions**: `issues: write`, `pull-requests: write`.

---

## Secrets & Variables

### Required Secrets
- `GITHUB_TOKEN` is automatically provisioned by GitHub Actions. Ensure repository settings allow `GITHUB_TOKEN` to read/write as specified by the workflow permissions.

### Optional Secrets
- **macOS Code Signing**: If you wish to code-sign macOS apps, add `APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`, `APPLE_SIGNING_IDENTITY`, and `APPLE_TEAM_ID` as repository secrets. The release workflow will automatically read these and pass them to Tauri during compilation.

## How to Debug Failures

1. Open the **Actions** tab in the repository.
2. Select the specific workflow and the failed run.
3. **Caching**: Sometimes `swatinem/rust-cache` might cache bad state. Trigger a "Re-run all jobs" or commit a whitespace change to refresh.
4. **Linting**: Validate changes locally. Run `npm run lint`, `cargo fmt`, and `cargo clippy`.

## Caching Strategy

The infrastructure leverages extensive caching to ensure fast feedback loops:
- **Node**: `actions/setup-node` caches `~/.npm` based on `vault-app/package-lock.json`.
- **Rust**: `swatinem/rust-cache` securely hashes `Cargo.lock` and caches the Cargo registry, `~/.cargo/git`, and the `target/` directory per OS matrix.
- **Cargo Audit**: We employ the `rustsec/audit-check` action instead of manually installing the CLI binary, utilizing native vulnerability database caching.

## Extension & Disable

To temporarily disable a workflow, go to the Actions tab, select the workflow, click the `...` menu, and select **Disable workflow**.
To add additional checks or platforms, extend the respective matrix strategy arrays.
