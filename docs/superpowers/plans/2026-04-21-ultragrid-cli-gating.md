# UltraGrid CLI Gating Rules Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `src/main/devices/ultragrid/cliBuilder.ts` produce CLI argv that exactly matches the authoritative Max JavaScript generator (`docs/javascript/tg.ultragrid.js`) for every combination of `audioVideo.connection` × `audioVideo.transmission` in the two currently-supported network modes (1 = send-to-router, 4 = peer-to-peer-automatic).

**Architecture:** The current builder emits audio flags unconditionally and ignores `connection` and `transmission`. The fix introduces two gating booleans per mode (`wantVideo`, `wantAudio`) and, for mode 4, two side gates (`wantSend`, `wantReceive`). Tests drive the change from synthesized expected CLIs — one test per matrix cell — following the rules extracted from `tg.ultragrid.js`. Existing Max-capture fixtures (all `connection=2, transmission=2`) continue to pass unchanged, guarding against regressions in the "both" path.

**Tech Stack:** TypeScript (Node main process), Vitest, fixture-driven comparison against Max-captured CLIs.

---

## Reference: Max JS rules (tg.ultragrid.js)

**Encoding:**
- `ugTransmission_mode`: `"0"` = video, `"1"` = audio, `"2"` = video+audio
- `ugConnection_type`: `"0"` = send (TX), `"1"` = receive (RX), `"2"` = both

**Mode 1 ("send to router") — lines 741–752:**
```javascript
if(ugTransmission_mode != 1){ cliADD_captureFilter(); cliADD_videoCapture(); cliADD_videoCodec(); }
if(ugTransmission_mode != 0){ cliADD_audioCapture(); cliADD_audioCodec(); }
cliADD_port(ugPort);
cliADD_router();
```
No receive branch — connection is effectively ignored.

**Mode 4 ("peer to peer automatic") — lines 790–812:**
```javascript
if(ugConnection_type != 1){                                // send side
    if(ugTransmission_mode != 1){ cliADD_captureFilter(); cliADD_videoCapture(); cliADD_videoCodec(); }
    if(ugTransmission_mode != 0){ cliADD_audioCapture(); cliADD_audioCodec(); }
}
if(ugConnection_type != 0){                                // receive side
    if(ugTransmission_mode != 1){ cliADD_postprocessing(); cliADD_videoReceive(); }
    if(ugTransmission_mode != 0){ cliADD_audioReceive(); cliADD_audioMapping(); }
}
cliADD_holePunching()
```

**`cliADD_port(_port)` — lines 619–628:**
```javascript
if(ugTransmission_mode != 2) ugCLIarg = "-P" + _port;                                       // video-only OR audio-only
else                         ugCLIarg = "-P" + _port + ":" + _port + ":" + (_port+2) + ":" + (_port+2);
```
`_port` is always `ugPort` (the video port). Even for audio-only, Max passes the video port as the single-port form — that is faithfully reproduced here, not corrected.

**`cliADD_holePunching` — lines 709–716:** builds `ugCLIarg` but the `ugCLIcommand += ugCLIarg` push is commented out. Net effect: **mode 4 emits no network flag**. The existing `max-cli-mode4.txt` fixture confirms this.

**`cliADD_audioMapping` — lines 596–601:** emits `--audio-channel-map` only when `ugAudio_channel_mapping` is set. NG's config schema does not currently surface this field (see `UltraGridConfig.audioReceiver.advanced.channels.params` which is distinct). Out of scope for this plan — receive-side audio emits only `-r` (matching what Max does when the mapping is unset, which is the common case).

**`cliADD_captureFilter` and `cliADD_postprocessing`:** both currently gated on the NG `videoCapture.advanced.filter.params` and `videoReciever.advanced.postprocessor.params` fields being `!== '-none-'`. NG's defaults have these as `'-none-'` and no UI exposes them today. Out of scope for this plan — we preserve current NG behavior (never emit these flags) to avoid scope creep. A follow-up plan can wire them once UI surfaces them.

---

## File Structure

**Files to modify:**
- `src/main/devices/ultragrid/cliBuilder.ts` — rewrite `buildMode1Args` / `buildMode4Args` around the gating rules; drop the quote-strip step at line 34; add internal helpers `shouldEmitVideo(transmission)`, `shouldEmitAudio(transmission)`, `shouldEmitSend(connection)`, `shouldEmitReceive(connection)`.
- `tests/main/devices/ultragrid/cliBuilder.test.ts` — add a new `shellTokenize` variant (or rename the old) that preserves single-quoted substrings so fixtures compare byte-accurate now that the builder no longer strips quotes; add synthesized-CLI tests for all new matrix cells.

**Files to create:**
- None.

**Files that MUST NOT be modified:**
- `docs/javascript/tg.ultragrid.js` — reference source of truth.
- `tests/fixtures/ultragrid/max-cli-mode1.txt`, `max-cli-mode1-ch5.txt`, `max-cli-mode4.txt` — Max-captured, immutable. New tests synthesize expected CLIs programmatically rather than adding fixtures for uncaptured combinations.

---

## Upfront decision: quote handling

`cliBuilder.ts:34` currently strips all single quotes from every argv element:
```typescript
return args.map((a) => a.replace(/'/g, ''))
```

This was originally justified by: "`child_process.spawn` does no shell parsing, so quotes reach `uv` as literal characters." True for execution, but it breaks two things:
1. The log line (`UltraGridDevice.ts:171` does `args.join(' ')`) becomes unpastable — `-t syphon:app=Simple Server` looks like two separate argv tokens when it is actually one.
2. Max's captured CLIs preserve the quotes (`spout:name='Spout Sender'`). Our tests currently compensate by running the fixture through a `shellTokenize` that strips quotes; that hides the divergence.

**Decision:** drop the strip. Spawn still works (verified by `tests/main/devices/ultragrid/uvArgvParsing.integration.test.ts` which explicitly covers both quoted and unquoted forms against the live `uv` binary). The fixture comparison is fixed by using a whitespace-splitting tokenizer that **preserves quotes** inside tokens — simpler than the current quote-stripping tokenizer and a more accurate model of what `spawn` actually receives from the argv array.

---

## Task 1: Add CLI mode + gating helpers; drop the quote strip

**Files:**
- Modify: `src/main/devices/ultragrid/cliBuilder.ts`

The refactor is purely internal (helpers + gates); behavior changes come in Tasks 3 and 4. This task only adds inactive helpers and drops the quote strip so the existing tests can be updated in Task 2 to tolerate the new output shape.

### Step 1.1: Drop the quote-strip in `buildUvArgs`

- [ ] **Step: Remove the `args.map(...)` line and its comment**

Edit [src/main/devices/ultragrid/cliBuilder.ts:22-35](src/main/devices/ultragrid/cliBuilder.ts#L22-L35). Replace:

```typescript
export function buildUvArgs(input: BuildUvArgsInput): string[] {
  const { config } = input
  const mode = config.network.mode
  const args = mode === '1' ? buildMode1Args(input)
    : mode === '4' ? buildMode4Args(input)
    : null
  if (!args) throw new Error(`UltraGrid mode ${mode} not yet supported (M2c)`)
  // Retained topic values carry texture/NDI names wrapped in `'...'` as a
  // schema artifact inherited from Max. `child_process.spawn` does no shell
  // parsing, so the quotes would reach `uv` as literal characters. Strip
  // them once here at the boundary — downstream builders can emit the raw
  // values without worrying about quoting.
  return args.map((a) => a.replace(/'/g, ''))
}
```

with:

```typescript
export function buildUvArgs(input: BuildUvArgsInput): string[] {
  const { config } = input
  const mode = config.network.mode
  const args = mode === '1' ? buildMode1Args(input)
    : mode === '4' ? buildMode4Args(input)
    : null
  if (!args) throw new Error(`UltraGrid mode ${mode} not yet supported (M2c)`)
  return args
}
```

### Step 1.2: Add gating helpers at the top of the file

- [ ] **Step: Insert four `shouldEmit*` helpers just above `buildMode1Args`**

Edit [src/main/devices/ultragrid/cliBuilder.ts](src/main/devices/ultragrid/cliBuilder.ts) — insert these helper functions between `buildUvArgs` and `buildMode1Args`:

```typescript
// Gating rules derived from tg.ultragrid.js:
//   transmission_mode: 0=video, 1=audio, 2=both
//   connection_type:   0=send,  1=receive, 2=both
// Mode 1 is always send-only; connection is ignored.
// Mode 4 gates each side on connection and each block-within-side on transmission.

function shouldEmitVideo(transmission: string): boolean {
  return transmission !== '1'
}

function shouldEmitAudio(transmission: string): boolean {
  return transmission !== '0'
}

function shouldEmitSend(connection: string): boolean {
  return connection !== '1'
}

function shouldEmitReceive(connection: string): boolean {
  return connection !== '0'
}
```

### Step 1.3: Typecheck

- [ ] **Step: Run typecheck**

Run: `npm run typecheck`
Expected: PASS. The helpers are unused (reserved for Tasks 3 and 4). TypeScript's `noUnusedLocals` is off for this project (`tsconfig.node.json` does not enable it), so the unused functions compile cleanly.

### Step 1.4: Run tests — expect transient failures

- [ ] **Step: Run the cliBuilder test file**

Run: `npx vitest run tests/main/devices/ultragrid/cliBuilder.test.ts`
Expected: **the three Max-fixture tests FAIL** with diffs showing that the builder now emits `spout:name='Spout Sender'` and `gl:spout='room_channel_0'` (quotes intact) while the tokenized fixture shows `spout:name=Spout Sender` (quotes stripped). The OS-dependent and unsupported-mode tests still pass (they don't rely on quote handling). These failures are expected and fixed in Task 2.

### Step 1.5: Commit

- [ ] **Step: Commit just the helpers + strip removal**

```bash
git add src/main/devices/ultragrid/cliBuilder.ts
git commit -m "refactor(ultragrid/cli): drop quote strip and add gating helpers"
```

Note: this commit leaves the cliBuilder test suite red. That's intentional — the next task fixes the fixture loader to match the new output shape, and Tasks 3 and 4 exercise the helpers. Keeping the commits sequential makes each diff small and its rationale clear.

---

## Task 2: Fix the fixture tokenizer to preserve single-quoted substrings

**Files:**
- Modify: `tests/main/devices/ultragrid/cliBuilder.test.ts`

### Step 2.1: Replace the `shellTokenize` helper

- [ ] **Step: Rewrite `shellTokenize` to preserve quotes inside tokens**

Edit [tests/main/devices/ultragrid/cliBuilder.test.ts:12-31](tests/main/devices/ultragrid/cliBuilder.test.ts#L12-L31). Replace the existing `shellTokenize` function with:

```typescript
function shellTokenize(line: string): string[] {
  // Split on whitespace at the top level, keeping single-quoted substrings
  // intact (including the quotes themselves). Max emits selections like
  // `spout:name='Spout Sender'` where the quotes are part of the argv element
  // that UV receives. `child_process.spawn` passes argv verbatim, so our
  // builder must also emit the quotes; this tokenizer matches that shape.
  const tokens: string[] = []
  let acc = ''
  let inSingle = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === "'") {
      inSingle = !inSingle
      acc += ch
      continue
    }
    if (!inSingle && /\s/.test(ch)) {
      if (acc) { tokens.push(acc); acc = '' }
      continue
    }
    acc += ch
  }
  if (acc) tokens.push(acc)
  return tokens
}
```

### Step 2.2: Run the fixture-driven tests — expect PASS

- [ ] **Step: Run the cliBuilder test file**

Run: `npx vitest run tests/main/devices/ultragrid/cliBuilder.test.ts`
Expected: all tests PASS, including the three Max-fixture comparisons. The builder now emits quotes; the tokenizer now preserves them; the two align.

### Step 2.3: Spot-check the OS-dependent assertions still hold

- [ ] **Step: Read the OS-dependent test block**

Look at [tests/main/devices/ultragrid/cliBuilder.test.ts:169-207](tests/main/devices/ultragrid/cliBuilder.test.ts#L169-L207). The assertions use `toContain(...)` with literals like `"syphon:name=Simple Server"` (no quotes) and `"gl:syphon=room_channel_0"` (no quotes).

Because the builder now emits `"syphon:name='Simple Server'"` (quotes preserved from the `textureCapture` index `"name='Simple Server'"` fed in by the test), those assertions now FAIL.

- [ ] **Step: Update the OS-dependent assertions to match quoted output**

Edit [tests/main/devices/ultragrid/cliBuilder.test.ts:190-191](tests/main/devices/ultragrid/cliBuilder.test.ts#L190-L191). Replace:

```typescript
    expect(actual).toContain("syphon:name=Simple Server")
    expect(actual).not.toContain("spout:name=Simple Server")
```

with:

```typescript
    expect(actual).toContain("syphon:name='Simple Server'")
    expect(actual).not.toContain("spout:name='Simple Server'")
```

And edit [tests/main/devices/ultragrid/cliBuilder.test.ts:204-205](tests/main/devices/ultragrid/cliBuilder.test.ts#L204-L205). Replace:

```typescript
    expect(actual).toContain("gl:syphon=room_channel_0")
    expect(actual).not.toContain("gl:spout=room_channel_0")
```

with:

```typescript
    expect(actual).toContain("gl:syphon='room_channel_0'")
    expect(actual).not.toContain("gl:spout='room_channel_0'")
```

### Step 2.4: Run tests — expect PASS

- [ ] **Step: Run the cliBuilder test file**

Run: `npx vitest run tests/main/devices/ultragrid/cliBuilder.test.ts`
Expected: all tests PASS.

### Step 2.5: Run the full suite

- [ ] **Step: Confirm no other file broke**

Run: `npx vitest run`
Expected: all tests PASS. The live-binary integration test at [tests/main/devices/ultragrid/uvArgvParsing.integration.test.ts](tests/main/devices/ultragrid/uvArgvParsing.integration.test.ts) specifically covers both quoted and unquoted `-t` values and should still pass.

### Step 2.6: Commit

- [ ] **Step: Commit the test-side fix**

```bash
git add tests/main/devices/ultragrid/cliBuilder.test.ts
git commit -m "test(ultragrid/cli): tokenizer preserves single-quoted substrings"
```

---

## Task 3: Gate Mode 1 on transmission

**Files:**
- Modify: `src/main/devices/ultragrid/cliBuilder.ts`
- Modify: `tests/main/devices/ultragrid/cliBuilder.test.ts`

Mode 1 has no receive branch, so connection is ignored. Gating is only on transmission: video-only omits audio flags, audio-only omits video flags, both (default) emits everything.

Additional Mode-1 subtlety: `cliADD_port` uses `-P<port>` (single form) for transmission !== '2', and `-P{p}:{p}:{p+2}:{p+2}` for transmission === '2'. The single-port form always uses the video port (even for audio-only — Max does this faithfully).

### Step 3.1: Write failing tests for the new Mode 1 matrix

- [ ] **Step: Append three new `describe` blocks with synthesized expected CLIs**

Append to [tests/main/devices/ultragrid/cliBuilder.test.ts](tests/main/devices/ultragrid/cliBuilder.test.ts) (place after the existing `describe('buildUvArgs — mode 1 (send-to-router)')` block, before the mode-4 block):

```typescript
describe('buildUvArgs — mode 1 transmission gating', () => {
  it('emits video-only when transmission=0 (no audio flags, -P uses single port)', () => {
    let config = applyTopicChange(defaultUltraGridConfig(), 'network/mode', '1')
    config = applyTopicChange(config, 'audioVideo/transmission', '0')
    config = applyTopicChange(
      config,
      'audioVideo/videoCapture/texture/menu/selection',
      "name='Spout Sender'"
    )
    const ports = allocateUgPorts(11, 0)
    const actual = buildUvArgs({
      config,
      ports,
      indexes: {
        textureCapture: "name='Spout Sender'",
        ndiCapture: null,
        audioCapture: 44,  // would be included under the old bug
        audioReceive: null
      },
      host: 'telemersion.zhdk.ch',
      textureReceiverName: 'room_channel_0',
      localOs: 'win'
    })

    expect(actual).toEqual([
      '--param', 'log-color=no',
      '-t', "spout:name='Spout Sender'",
      '-c', 'libavcodec:codec=H.264:bitrate=10M',
      `-P${ports.videoPort}`,
      'telemersion.zhdk.ch'
    ])
    expect(actual).not.toContain('-s')
    expect(actual).not.toContain('--audio-codec')
    expect(actual).not.toContain('--audio-capture-format')
  })

  it('emits audio-only when transmission=1 (no video flags, -P uses single video port)', () => {
    let config = applyTopicChange(defaultUltraGridConfig(), 'network/mode', '1')
    config = applyTopicChange(config, 'audioVideo/transmission', '1')
    const ports = allocateUgPorts(11, 0)
    const actual = buildUvArgs({
      config,
      ports,
      indexes: {
        textureCapture: "name='Spout Sender'",  // would be included under the old bug
        ndiCapture: null,
        audioCapture: 44,
        audioReceive: null
      },
      host: 'telemersion.zhdk.ch',
      textureReceiverName: 'room_channel_0',
      localOs: 'win'
    })

    expect(actual).toEqual([
      '--param', 'log-color=no',
      '-s', 'portaudio:44',
      '--audio-codec', 'OPUS:bitrate=64000',
      '--audio-capture-format', 'channels=1',
      `-P${ports.videoPort}`,
      'telemersion.zhdk.ch'
    ])
    expect(actual).not.toContain('-t')
    expect(actual).not.toContain('-c')
  })

  it('emits both + dual-port -P when transmission=2 (unchanged behavior, regression guard)', () => {
    // The existing Max-fixture test already covers this exact case; this is a
    // shorter reassertion that makes the matrix explicit in one place.
    let config = applyTopicChange(defaultUltraGridConfig(), 'network/mode', '1')
    config = applyTopicChange(config, 'audioVideo/transmission', '2')
    config = applyTopicChange(
      config,
      'audioVideo/videoCapture/texture/menu/selection',
      "name='Spout Sender'"
    )
    const ports = allocateUgPorts(11, 0)
    const actual = buildUvArgs({
      config,
      ports,
      indexes: {
        textureCapture: "name='Spout Sender'",
        ndiCapture: null,
        audioCapture: 44,
        audioReceive: null
      },
      host: 'telemersion.zhdk.ch',
      textureReceiverName: 'room_channel_0',
      localOs: 'win'
    })

    expect(actual).toContain('-t')
    expect(actual).toContain('-s')
    expect(actual).toContain(
      `-P${ports.videoPort}:${ports.videoPort}:${ports.audioPort}:${ports.audioPort}`
    )
  })
})
```

### Step 3.2: Run — expect the first two to FAIL

- [ ] **Step: Run the cliBuilder tests**

Run: `npx vitest run tests/main/devices/ultragrid/cliBuilder.test.ts`
Expected:
- `emits video-only when transmission=0` FAILS — `actual` contains `-s`/`--audio-codec`/`--audio-capture-format` and uses the 4-port `-P` form.
- `emits audio-only when transmission=1` FAILS — `actual` contains `-t`/`-c` and uses the 4-port form.
- `emits both + dual-port -P when transmission=2` PASSES — current behavior already matches.

### Step 3.3: Implement Mode 1 gating

- [ ] **Step: Rewrite `buildMode1Args` with gates**

Edit [src/main/devices/ultragrid/cliBuilder.ts](src/main/devices/ultragrid/cliBuilder.ts) — replace the existing `buildMode1Args` function:

```typescript
function buildMode1Args(input: BuildUvArgsInput): string[] {
  const { config, ports, indexes, host, localOs } = input
  const transmission = config.audioVideo.transmission
  const args: string[] = ['--param', 'log-color=no']

  if (shouldEmitVideo(transmission)) pushVideoCapture(args, config, indexes, localOs)
  if (shouldEmitAudio(transmission)) pushAudioCapture(args, config, indexes)

  if (transmission === '2') {
    args.push(`-P${ports.videoPort}:${ports.videoPort}:${ports.audioPort}:${ports.audioPort}`)
  } else {
    args.push(`-P${ports.videoPort}`)
  }
  args.push(host)
  return args
}
```

### Step 3.4: Run — expect PASS

- [ ] **Step: Run the cliBuilder tests**

Run: `npx vitest run tests/main/devices/ultragrid/cliBuilder.test.ts`
Expected: all tests PASS — the two new gating tests now pass, the transmission=2 regression test still passes, and the original Max-fixture tests (which are all transmission=2) still pass.

### Step 3.5: Commit

- [ ] **Step: Commit Mode 1 gating**

```bash
git add src/main/devices/ultragrid/cliBuilder.ts tests/main/devices/ultragrid/cliBuilder.test.ts
git commit -m "feat(ultragrid/cli): gate mode 1 audio/video on transmission"
```

---

## Task 4: Gate Mode 4 on connection × transmission

**Files:**
- Modify: `src/main/devices/ultragrid/cliBuilder.ts`
- Modify: `tests/main/devices/ultragrid/cliBuilder.test.ts`

Mode 4 has both send and receive branches; gating is two-dimensional. The matrix has nine cells (connection ∈ {0,1,2} × transmission ∈ {0,1,2}); we cover each.

**Also in this task:** when `config.audioVideo.videoCapture.type === '0'` (texture) but `connection === '1'` (receive-only), the builder should not push any `-t` regardless — that's an implied consequence of `shouldEmitSend(connection) === false`.

### Step 4.1: Write failing tests for the new Mode 4 matrix

- [ ] **Step: Append a matrix of tests for mode 4**

Append to [tests/main/devices/ultragrid/cliBuilder.test.ts](tests/main/devices/ultragrid/cliBuilder.test.ts), AFTER the existing `describe('buildUvArgs — mode 4 (peer-to-peer-automatic)')` block:

```typescript
describe('buildUvArgs — mode 4 connection × transmission gating', () => {
  function mode4Config(connection: string, transmission: string) {
    let c = applyTopicChange(defaultUltraGridConfig(), 'network/mode', '4')
    c = applyTopicChange(c, 'audioVideo/connection', connection)
    c = applyTopicChange(c, 'audioVideo/transmission', transmission)
    c = applyTopicChange(
      c,
      'audioVideo/videoCapture/texture/menu/selection',
      "name='Spout Sender'"
    )
    return c
  }

  const defaultIndexes: ResolvedMenuIndexes = {
    textureCapture: "name='Spout Sender'",
    ndiCapture: null,
    audioCapture: 12,
    audioReceive: 11
  }

  const commonInputs = {
    ports: allocateUgPorts(11, 0),
    indexes: defaultIndexes,
    host: 'telemersion.zhdk.ch',
    textureReceiverName: 'room_channel_0',
    localOs: 'win' as const
  }

  it('connection=0, transmission=0: send-only, video-only (no -s, no -d, no -r)', () => {
    const actual = buildUvArgs({ config: mode4Config('0', '0'), ...commonInputs })
    expect(actual).toEqual([
      '--param', 'log-color=no',
      '-t', "spout:name='Spout Sender'",
      '-c', 'libavcodec:codec=H.264:bitrate=10M'
    ])
  })

  it('connection=0, transmission=1: send-only, audio-only (no -t/-c, no -d, no -r)', () => {
    const actual = buildUvArgs({ config: mode4Config('0', '1'), ...commonInputs })
    expect(actual).toEqual([
      '--param', 'log-color=no',
      '-s', 'portaudio:12',
      '--audio-codec', 'OPUS:bitrate=64000',
      '--audio-capture-format', 'channels=1'
    ])
  })

  it('connection=0, transmission=2: send-only, both (no -d, no -r)', () => {
    const actual = buildUvArgs({ config: mode4Config('0', '2'), ...commonInputs })
    expect(actual).toEqual([
      '--param', 'log-color=no',
      '-t', "spout:name='Spout Sender'",
      '-c', 'libavcodec:codec=H.264:bitrate=10M',
      '-s', 'portaudio:12',
      '--audio-codec', 'OPUS:bitrate=64000',
      '--audio-capture-format', 'channels=1'
    ])
  })

  it('connection=1, transmission=0: receive-only, video-only (only -d)', () => {
    const actual = buildUvArgs({ config: mode4Config('1', '0'), ...commonInputs })
    expect(actual).toEqual([
      '--param', 'log-color=no',
      '-d', "gl:spout='room_channel_0'"
    ])
  })

  it('connection=1, transmission=1: receive-only, audio-only (only -r)', () => {
    const actual = buildUvArgs({ config: mode4Config('1', '1'), ...commonInputs })
    expect(actual).toEqual([
      '--param', 'log-color=no',
      '-r', 'portaudio:11'
    ])
  })

  it('connection=1, transmission=2: receive-only, both', () => {
    const actual = buildUvArgs({ config: mode4Config('1', '2'), ...commonInputs })
    expect(actual).toEqual([
      '--param', 'log-color=no',
      '-d', "gl:spout='room_channel_0'",
      '-r', 'portaudio:11'
    ])
  })

  it('connection=2, transmission=0: both sides, video-only', () => {
    const actual = buildUvArgs({ config: mode4Config('2', '0'), ...commonInputs })
    expect(actual).toEqual([
      '--param', 'log-color=no',
      '-t', "spout:name='Spout Sender'",
      '-c', 'libavcodec:codec=H.264:bitrate=10M',
      '-d', "gl:spout='room_channel_0'"
    ])
  })

  it('connection=2, transmission=1: both sides, audio-only', () => {
    const actual = buildUvArgs({ config: mode4Config('2', '1'), ...commonInputs })
    expect(actual).toEqual([
      '--param', 'log-color=no',
      '-s', 'portaudio:12',
      '--audio-codec', 'OPUS:bitrate=64000',
      '--audio-capture-format', 'channels=1',
      '-r', 'portaudio:11'
    ])
  })

  it('connection=2, transmission=2: both sides, both kinds (regression for existing fixture)', () => {
    // The existing max-cli-mode4.txt test covers this byte-for-byte; here we
    // assert the gating shape without the port/index specifics.
    const actual = buildUvArgs({ config: mode4Config('2', '2'), ...commonInputs })
    expect(actual).toContain('-t')
    expect(actual).toContain('-s')
    expect(actual).toContain('-d')
    expect(actual).toContain('-r')
  })
})
```

### Step 4.2: Run — expect multiple FAILs

- [ ] **Step: Run the cliBuilder tests**

Run: `npx vitest run tests/main/devices/ultragrid/cliBuilder.test.ts`
Expected: most of the new mode-4 gating tests FAIL — the current `buildMode4Args` emits `-t`, `-s`, `-d`, and `-r` independent of connection and (for capture) independent of transmission. Specifically:
- `connection=0, transmission=0` fails: extra `-s`/`--audio-codec`/`--audio-capture-format` and extra `-d`/`-r`.
- `connection=1, transmission=*` fails: extra `-t`/`-c` and (for transmission !== '1') extra `-s`.
- `connection=2, transmission=0` fails: extra `-s`/`--audio-codec`/`--audio-capture-format` and extra `-r`.
- etc.

The `connection=2, transmission=2` regression test still passes.

### Step 4.3: Implement Mode 4 gating

- [ ] **Step: Rewrite `buildMode4Args` with gates**

Edit [src/main/devices/ultragrid/cliBuilder.ts](src/main/devices/ultragrid/cliBuilder.ts) — replace the existing `buildMode4Args` function:

```typescript
function buildMode4Args(input: BuildUvArgsInput): string[] {
  const { config, indexes, textureReceiverName, localOs } = input
  const transmission = config.audioVideo.transmission
  const connection = config.audioVideo.connection
  const args: string[] = ['--param', 'log-color=no']

  if (shouldEmitSend(connection)) {
    if (shouldEmitVideo(transmission)) pushVideoCapture(args, config, indexes, localOs)
    if (shouldEmitAudio(transmission)) pushAudioCapture(args, config, indexes)
  }
  if (shouldEmitReceive(connection)) {
    if (shouldEmitVideo(transmission)) {
      args.push('-d', `${textureDisplayPrefix(localOs)}'${textureReceiverName}'`)
    }
    if (shouldEmitAudio(transmission) && indexes.audioReceive !== null) {
      args.push('-r', `portaudio:${indexes.audioReceive}`)
    }
  }
  return args
}
```

### Step 4.4: Run — expect PASS

- [ ] **Step: Run the cliBuilder tests**

Run: `npx vitest run tests/main/devices/ultragrid/cliBuilder.test.ts`
Expected: all tests PASS, including the new nine matrix cells and the existing Max-fixture `max-cli-mode4.txt` comparison.

### Step 4.5: Run the full suite

- [ ] **Step: Full vitest run**

Run: `npx vitest run`
Expected: all tests PASS. The live-binary integration test remains unaffected.

### Step 4.6: Commit

- [ ] **Step: Commit Mode 4 gating**

```bash
git add src/main/devices/ultragrid/cliBuilder.ts tests/main/devices/ultragrid/cliBuilder.test.ts
git commit -m "feat(ultragrid/cli): gate mode 4 on connection × transmission"
```

---

## Task 5: Update UltraGridDevice test assertions for quoted argv

**Files:**
- Modify: `tests/main/devices/ultragrid/UltraGridDevice.test.ts`

`UltraGridDevice.test.ts:84` currently asserts `toContain("gl:spout=room_channel_0")`. After Task 1 drops the quote strip, the builder emits `"gl:spout='room_channel_0'"` (quotes preserved from Max's format), so this assertion breaks. Line 176's `portaudio:12` assertion is unaffected (no quotes involved).

### Step 5.1: Run the file first to confirm the breakage

- [ ] **Step: Run `UltraGridDevice.test.ts`**

Run: `npx vitest run tests/main/devices/ultragrid/UltraGridDevice.test.ts`
Expected: 15 pass, 1 fail — the `starts process on enable 0→1` test (or whichever test owns line 84) fails with the args containing `"gl:spout='room_channel_0'"` instead of `"gl:spout=room_channel_0"`.

### Step 5.2: Update the assertion

- [ ] **Step: Fix the assertion to match quoted output**

Edit [tests/main/devices/ultragrid/UltraGridDevice.test.ts:84](tests/main/devices/ultragrid/UltraGridDevice.test.ts#L84). Replace:

```typescript
    expect(spawned[0].opts.args).toContain("gl:spout=room_channel_0")
```

with:

```typescript
    expect(spawned[0].opts.args).toContain("gl:spout='room_channel_0'")
```

### Step 5.3: Run the file again — expect PASS

- [ ] **Step: Confirm all 16 tests pass**

Run: `npx vitest run tests/main/devices/ultragrid/UltraGridDevice.test.ts`
Expected: 16/16 PASS.

### Step 5.4: Commit

- [ ] **Step: Commit the assertion update**

```bash
git add tests/main/devices/ultragrid/UltraGridDevice.test.ts
git commit -m "test(ultragrid/device): align argv assertion with quote-preserving builder"
```

---

## Task 6: Final verification

**Files:**
- None.

### Step 6.1: Run full test suite

- [ ] **Step: Full vitest run**

Run: `npx vitest run`
Expected: all tests PASS. Count should be 149 existing + 3 new mode-1 + 9 new mode-4 = 161 tests across 19 files.

### Step 6.2: Typecheck

- [ ] **Step: Run typecheck**

Run: `npm run typecheck`
Expected: PASS.

### Step 6.3: Smoke-log inspection (optional manual)

- [ ] **Step: Read a freshly built CLI line by spawning UG with a non-default selection**

This step is optional. If the dev environment has a UG binary and Syphon/Spout sender available:
1. Start the app with `npm run dev`.
2. Join a room, add an UltraGrid device, select a texture source with spaces in the name (e.g. `Simple Server`).
3. Set `direction` to `send`, `transmission` to `video`.
4. Enable the device.
5. Observe the `[UG ch.0] spawn:` line in the main-process stdout. It should be pastable into a shell and execute — specifically `-t syphon:name='Simple Server' -c libavcodec:...` with no audio flags and no `-d`/`-r`.
6. Set `direction` to `both`, `transmission` to `video+audio`, enable again. The line should now include `-s portaudio:N`, `--audio-codec`, `--audio-capture-format`, `-d gl:syphon='<name>'`, and `-r portaudio:M`.

If this cannot be verified, say so in the report rather than claiming success.

### Step 6.4: Report

- [ ] **Step: Summarize to the user**

Report:
- Fixtures unchanged; three existing Max-fixture comparisons still pass.
- New tests: 3 mode-1 transmission cases + 9 mode-4 matrix cells.
- Quote strip removed; log lines are now pastable; live-binary integration test still passes.
- `cliADD_holePunching` is faithfully reproduced as a no-op (Max's own push is commented out).
- `cliADD_audioMapping` / `cliADD_captureFilter` / `cliADD_postprocessing` explicitly out of scope (no config surface yet); follow-up plan if/when UI exposes them.

---

## Spec coverage check (self-review)

| Spec item | Task |
|---|---|
| Drop `args.map(a => a.replace(/'/g, ''))` | Task 1 Step 1.1 |
| Update fixture tokenizer to preserve quotes | Task 2 Step 2.1 |
| Update OS-dependent test assertions | Task 2 Step 2.3 |
| Gate Mode 1 on transmission (video/audio/both) | Task 3 |
| Mode 1 `-P` single-port form when transmission !== '2' | Task 3 Step 3.3 |
| Gate Mode 4 on connection (send/receive/both) | Task 4 |
| Gate Mode 4 on transmission within each side | Task 4 |
| Mode 4 emits no network flag (cliADD_holePunching no-op) | Task 4 Step 4.3 (implicit — `buildMode4Args` doesn't push one) |
| Preserve Max-fixture (connection=2, transmission=2) behavior | Tasks 3 & 4 (regression tests + fixtures) |
| `cliADD_audioMapping` out of scope | Documented in header |
| Mode 1 `connection` ignored (Max has no receive branch) | Task 3 Step 3.3 — `buildMode1Args` doesn't read `connection` |

No gaps.
