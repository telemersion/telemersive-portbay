# Upgrading UltraGrid

UltraGrid's CLI output, accepted codec names, and supported audio/video backends drift between versions. The app's parsers, codec maps, and even the renderer dropdowns are coupled to a specific UV version, so an upgrade is a deliberate multi-step procedure rather than a `brew upgrade`.

This document is the runbook. Follow it end to end whenever the bundled UV version changes — including patch bumps, since UltraGrid sometimes changes wording even in patch releases.

For background on the version-coupling itself, see [CLAUDE.md](../CLAUDE.md) ("UltraGrid parsers are version-coupled") and [docs/spec.md](spec.md).

---

## When to upgrade

- Upstream security or stability fix you need.
- New codec or backend the app should expose.
- Compatibility with a peer running a newer UV.

A bump that doesn't fit one of these is rarely worth the work — every UV upgrade is a small audit of the whole UV-touching surface.

---

## Prerequisites

- A macOS machine with the new UV build downloaded from <https://www.ultragrid.cz/>.
- A clean working tree (`git status` shows nothing).
- An older vendored version still in `vendor/ultragrid/<old-version>/` so you can compare probe outputs. **Don't delete it yet.**

---

## Step 1 — Vendor the new build

Drop the new app bundle into a versioned directory and switch the `active` symlink. See [vendor/ultragrid/README.md](../vendor/ultragrid/README.md) for the full layout.

```sh
mkdir -p vendor/ultragrid/<new-version>
mv ~/Downloads/uv-qt.app vendor/ultragrid/<new-version>/
cd vendor/ultragrid && ln -sfn <new-version> active && cd -
vendor/ultragrid/active/uv-qt.app/Contents/MacOS/uv --version
```

The last command should print the new version. If it doesn't, the symlink is wrong.

---

## Step 2 — Capture parser fixtures

The parsers under [src/main/enumeration/parsers/](../src/main/enumeration/parsers/) are tested against captured `uv ... :help` output stored under `tests/fixtures/ultragrid/<version>/`. Capture a fresh set:

```sh
scripts/capture-uv-fixtures.sh
```

This auto-detects the version from `uv --version` and writes to `tests/fixtures/ultragrid/<new-version>/`. Review the new files (`git status`), then run the parser tests against them:

```sh
npx vitest run tests/main/enumeration/parsers
```

If a parser fails, the test will tell you which fixture line broke. Fix the parser regex/logic in [src/main/enumeration/parsers/](../src/main/enumeration/parsers/), not the fixture — the fixture is ground truth.

---

## Step 3 — Probe codec acceptance

Codec names sometimes change between UV releases (a renamed alias, a removed encoder, a newly added codec). Probe what the new build accepts:

```sh
scripts/probe-uv-codecs.sh
```

This produces `docs/ug-codecs-<new-version>.txt`. **Diff it against the previous version's report:**

```sh
diff docs/ug-codecs-<old-version>.txt docs/ug-codecs-<new-version>.txt
```

If any codec changed from `accepted` to `REJECTED` or vice-versa, you have to reconcile in **three** places:

| File | What to change |
|---|---|
| [src/main/devices/ultragrid/cliBuilder.ts](../src/main/devices/ultragrid/cliBuilder.ts) | `VIDEO_CODEC_NAMES` and `AUDIO_CODEC_NAMES` maps. Index = position in the Max umenu. Don't reorder; gaps are how Max-compat is preserved. |
| [src/renderer/components/panels/UltraGridPanel.vue](../src/renderer/components/panels/UltraGridPanel.vue) | Video codec `<option>` list and audio codec `<option>` list. Indices must match `cliBuilder.ts` exactly. Disabled options (e.g. speex) need the matching `disabled` attribute. |
| [tests/main/devices/ultragrid/codecAcceptance.integration.test.ts](../tests/main/devices/ultragrid/codecAcceptance.integration.test.ts) | `VIDEO_CODEC_NAMES` / `AUDIO_CODEC_NAMES` arrays, and any explicit "rejected" codec assertions. |

Out-of-sync indices are a silent footgun: the UI will show the user one codec name while passing a different one to `uv`. There's no compile-time check; the only safety net is the integration test in step 5.

---

## Step 4 — Update the version pin

[src/shared/toolRequirements.ts](../src/shared/toolRequirements.ts) holds `REQUIRED_UG_VERSION`. The renderer's Tools & Compatibility check reads this at boot. Bump it to the new version.

Also grep for the old version string in code comments (the parsers and `cliBuilder.ts` reference the verified version inline) and update each match:

```sh
grep -rn "<old-version>" src/ tests/ docs/ CLAUDE.md
```

---

## Step 5 — Run the live integration test

The integration test in [tests/main/devices/ultragrid/codecAcceptance.integration.test.ts](../tests/main/devices/ultragrid/codecAcceptance.integration.test.ts) actually spawns `uv` and verifies every codec the cliBuilder claims to support is accepted by the binary. It's excluded from the default test run (it's slow, and only matters at upgrade time). Run it explicitly:

```sh
npm run test:integration
```

If a codec the cliBuilder accepts gets rejected by the live binary — the codec maps are out of sync. Go back to step 3 and reconcile.

---

## Step 6 — Smoke test the app

Tests don't catch every UV-coupled behavior. Run the dev server and exercise UV channels by hand:

```sh
npm run dev
```

In the app:

1. **Tools & Compatibility** in Settings should show UV at the new version, marked compatible.
2. Create an UltraGrid channel, toggle `enable` on, and verify the FPS/volume indicators in the UI populate (they're driven by stdout parsing — if they stay zero, a parser is broken).
3. Toggle `enable` off and on again. Confirm no zombie processes (`ps aux | grep uv`).
4. Try a couple of codecs from the dropdown — at minimum JPEG video + OPUS audio (the defaults) and one less common one.

---

## Step 7 — Documentation

Update version references in:

- [CLAUDE.md](../CLAUDE.md) — the "UltraGrid parsers are version-coupled" section if any wording shifts.
- [docs/spec.md](spec.md) — search for the previous version string.
- [docs/deployment.md](deployment.md) — only if the upgrade affects how the build is packaged (rare).

---

## Step 8 — Commit and ship

Group the upgrade into logical commits. Recommended split:

1. `chore(ug): vendor UltraGrid <new-version>` — fixtures, codec report, version pin.
2. `chore(ug): update codec maps for <new-version>` — only if step 3 found differences.
3. `chore(ug): update version references in comments and docs` — comment hygiene from step 4.

Then cut a release per [docs/deployment.md](deployment.md). UG upgrades are usually `minor` bumps (new feature surface) unless behavior changes break wire compatibility with Max gateways still on the old UV — that would be `major`.

---

## Cleanup (optional)

Once the new version has shipped and you've used it for a couple of weeks without regressions, you can delete the previous vendored version:

```sh
rm -rf vendor/ultragrid/<old-version>
rm tests/fixtures/ultragrid/<old-version>   # only if no fixtures depend on it
rm docs/ug-codecs-<old-version>.txt
```

Don't rush this — having the previous version on disk lets you bisect parser regressions by flipping the `active` symlink back.
