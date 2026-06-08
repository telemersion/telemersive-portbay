# UltraGrid vendor directory

This directory holds per-version UltraGrid installs. UltraGrid's CLI output
format changes between versions, so the parsers in
[src/main/enumeration/parsers/](../../src/main/enumeration/parsers/) are
tested against golden fixtures captured from a specific version. Keeping
versions side-by-side makes parser-regression testing on upgrades trivial.

## Layout

```text
vendor/ultragrid/
├── README.md              (tracked)
├── active -> 1.9.3        (gitignored symlink/junction — points at the version in use)
├── 1.9.3/
│   ├── uv-qt.app/         (gitignored — macOS app bundle)
│   └── uv.exe             (gitignored — Windows executable)
└── 1.10.0/
    ├── uv-qt.app/
    └── uv.exe
```

Fixtures captured from each version live under `tests/fixtures/ultragrid/<ver>/`
and *are* tracked in git.

## Install a version — macOS

1. Download the UltraGrid macOS build from <https://www.ultragrid.cz/>.
2. Move the app bundle into a version-named directory here:

   ```sh
   mkdir -p vendor/ultragrid/1.9.3
   mv ~/Downloads/uv-qt.app vendor/ultragrid/1.9.3/
   ```

3. Point `active` at it:

   ```sh
   cd vendor/ultragrid
   ln -sfn 1.9.3 active
   ```

4. Verify:

   ```sh
   vendor/ultragrid/active/uv-qt.app/Contents/MacOS/uv --version
   ```

## Install a version — Windows

On Windows, UltraGrid ships as a versioned folder containing `uv.exe` and all
its DLL dependencies. The installer places it under
`C:\Program Files\Ultragrid\<version>\`.

The app auto-discovers the latest installed version from that path — no manual
configuration needed after a standard install.

To also use a repo-local copy (e.g. for testing a different version without
installing it system-wide):

1. Copy the entire versioned folder here:

   ```powershell
   Copy-Item -Recurse "C:\Program Files\Ultragrid\1.10.3" vendor\ultragrid\1.10.3
   ```

2. Point `active` at it using a directory junction (no admin required):

   ```powershell
   cmd /c mklink /J vendor\ultragrid\active vendor\ultragrid\1.10.3
   ```

3. Verify:

   ```powershell
   vendor\ultragrid\active\uv.exe --version
   ```

## Capture golden fixtures for a new version

```sh
scripts/capture-uv-fixtures.sh
```

Fixtures land in `tests/fixtures/ultragrid/<detected-version>/`. Commit
the new fixture directory, then run the parser tests to see if anything
broke:

```sh
npx vitest run tests/main/enumeration/parsers
```

## Runtime resolution

[src/main/enumeration/spawnCli.ts](../../src/main/enumeration/spawnCli.ts)
looks for UltraGrid in this order:

1. `ugPath` from `settings.json` (user-configured override)
2. `$UG_PATH` env var (explicit override)
3. **macOS**: `vendor/ultragrid/active/uv-qt.app/Contents/MacOS/uv` (repo-local), then `/Applications/uv-qt.app/Contents/MacOS/uv`
4. **Windows**: `vendor\ultragrid\active\uv.exe` (repo-local), then latest version found under `C:\Program Files\Ultragrid\<version>\uv.exe`
5. **Linux**: `/usr/local/bin/uv`
