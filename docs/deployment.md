# Deployment Manual

This document covers how to build and publish release artifacts for Telemersive Gateway.

For the separate procedure of upgrading the vendored UltraGrid binary, see [docs/upgrading-ultragrid.md](upgrading-ultragrid.md). UG upgrades typically end with a release cut per this manual.

## Overview

Releases are built automatically via GitHub Actions when a version tag is pushed. The workflow produces:

- **macOS**: two signed and notarized DMGs — one for Intel (`x64`) and one for Apple Silicon (`arm64`)
- **Windows**: an NSIS installer `.exe` (x64)

Both are attached to a GitHub Release with auto-generated release notes.

---

## Versioning

### Single source of truth

`package.json` `version` is the canonical version number. Everything else derives from it:

- **Git tag** — matches `v{version}` by convention (enforced by the `npm version` workflow below)
- **Built app** — electron-builder embeds the version at build time; accessible at runtime via `app.getVersion()` in the main process
- **README badge** — a shields.io badge pulls the latest GitHub release tag automatically and never needs manual updates
- **Release notes** — generated automatically by GitHub from commit messages (`generate_release_notes: true` in the workflow)

### Semantic versioning guidelines

| Change type | Bump |
|---|---|
| Bug fix, typo, minor UI tweak | `patch` |
| New device type, new feature, new setting | `minor` |
| Protocol break (incompatible with Max gateway or prior NG versions) | `major` |

---

## Releasing a new version

Use `npm version` to bump `package.json`, commit, and tag in one atomic step:

```bash
# patch: 0.1.0 → 0.1.1  (bug fixes)
npm version patch

# minor: 0.1.0 → 0.2.0  (new features, backwards-compatible)
npm version minor

# major: 0.1.0 → 1.0.0  (breaking changes)
npm version major

# Push the commit and the tag together — this triggers the release workflow
git push origin master --tags
```

`npm version` bumps `version` in `package.json`, creates a git commit, and creates a git tag (`v1.2.3`) atomically. Pushing with `--tags` ensures the tag and `package.json` are always in sync and the CI workflow fires.

### Pre-release / beta builds

```bash
npm version prerelease --preid=beta   # 0.2.0 → 0.2.1-beta.0
git push origin master --tags
```

The `v*` tag still matches the workflow and a GitHub Release is created. Mark it as a pre-release manually on GitHub if needed.

---

## CI release workflow

Any tag matching `v*` triggers `.github/workflows/release.yml`, which runs three jobs in sequence:

1. **`build-mac`** (macos-latest) — builds and packages the signed + notarized DMG
2. **`build-win`** (windows-latest) — builds and packages the NSIS installer
3. **`release`** (ubuntu-latest) — downloads both artifacts and publishes them to a GitHub Release

### Artifact names

electron-builder derives names from `productName` and `version` in `package.json`. Example for `v1.0.0`:

- `Telemersive Gateway-1.0.0-x64.dmg` — Intel Macs
- `Telemersive Gateway-1.0.0-arm64.dmg` — Apple Silicon Macs
- `Telemersive Gateway Setup 1.0.0.exe`

The macOS DMG name is set by `mac.artifactName` in [electron-builder.yml](../electron-builder.yml); the Windows name uses electron-builder's default.

---

## One-time setup: Apple code signing and notarization (macOS)

Without signing, the DMG will be quarantined by Gatekeeper ("app is damaged or can't be opened"). This setup is done once per Apple Developer account and then stored as GitHub secrets.

### Prerequisites

- Apple Developer Program membership ($99/year) — [developer.apple.com](https://developer.apple.com)
- A Mac for the certificate export (one-time only)

### 1. Create a Developer ID Application certificate

1. Log in at **developer.apple.com → Certificates, IDs & Profiles**
2. Click **+** and choose **Developer ID Application**
3. Generate a Certificate Signing Request (CSR) from **Keychain Access → Certificate Assistant → Request a Certificate from a Certificate Authority**, save it to disk
4. Upload the CSR and download the resulting `.cer`
5. Double-click the `.cer` to install it in your Mac's Keychain

### 2. Export the certificate as a base64 secret

1. Open **Keychain Access**, find the certificate (named *Developer ID Application: Your Name (TEAMID)*)
2. Right-click → **Export** → save as `certificate.p12`, set a strong password
3. Encode it for GitHub:

```bash
base64 -i certificate.p12 | pbcopy
```

The base64 string is now in your clipboard.

### 3. Generate an app-specific password

1. Go to [appleid.apple.com](https://appleid.apple.com) → **Sign-In and Security → App-Specific Passwords**
2. Click **+**, name it something like *telemersive-gateway-ci*
3. Copy the generated password (shown only once)

### 4. Find your Team ID

Log in at **developer.apple.com → Membership Details** — the Team ID is the 10-character alphanumeric string listed there.

### 5. Add secrets to GitHub

Go to the repository → **Settings → Secrets and variables → Actions → New repository secret** and add:

| Secret name | Value |
|---|---|
| `APPLE_CERTIFICATE` | Base64-encoded `.p12` from step 2 |
| `APPLE_CERTIFICATE_PASSWORD` | Password set when exporting the `.p12` |
| `APPLE_ID` | Your Apple ID email address |
| `APPLE_APP_SPECIFIC_PASSWORD` | App-specific password from step 3 |
| `APPLE_TEAM_ID` | 10-character Team ID from step 4 |

### How signing and notarization work in CI

The macOS build job passes `CSC_LINK` / `CSC_KEY_PASSWORD` to electron-builder, which signs the `.app` bundle with your Developer ID certificate. It then submits the signed app to Apple's notarization service (using `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`). Apple scans for malware, returns a ticket, and electron-builder staples that ticket into the DMG before uploading it. This adds roughly 5–10 minutes to the macOS build.

If the signing secrets are absent (e.g. on a fork or before setup is complete), electron-builder skips signing silently — the DMG is still produced but will trigger a Gatekeeper warning on end-user machines.

---

## One-time setup: Windows code signing (optional)

The Windows build currently produces an unsigned NSIS installer. Windows Defender SmartScreen will show an "Unknown publisher" warning on first run until the executable accumulates sufficient reputation, or until you add an Authenticode certificate.

To add Windows signing:
1. Purchase a code signing certificate from a CA (e.g. DigiCert, Sectigo)
2. Export it as a `.p12` / `.pfx` and base64-encode it
3. Add `WIN_CSC_LINK` and `WIN_CSC_KEY_PASSWORD` secrets to GitHub
4. electron-builder picks them up automatically — no workflow changes needed

---

## Local packaging

To produce artifacts locally without pushing a tag:

```bash
# macOS (run on a Mac)
npm run package -- --mac

# Windows (run on Windows)
npm run package -- --win
```

Output is written to `dist/`. Local builds are unsigned unless `CSC_LINK` / `CSC_KEY_PASSWORD` are set in your environment.
