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
├── active -> 1.9.3        (gitignored symlink — points at the version in use)
├── 1.9.3/
│   └── uv-qt.app/         (gitignored — the macOS app bundle)
└── 1.10.0/
    └── uv-qt.app/
```

Fixtures captured from each version live under `tests/fixtures/ultragrid/<ver>/`
and *are* tracked in git.

## Install a version

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

1. `$UG_PATH` (explicit override)
2. `vendor/ultragrid/active/uv-qt.app/Contents/MacOS/uv` (repo-local)
3. `/Applications/uv-qt.app/Contents/MacOS/uv` (system install — fallback)
