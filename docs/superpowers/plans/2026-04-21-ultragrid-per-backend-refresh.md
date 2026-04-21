# UltraGrid Per-Backend Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow any peer (local or remote) to trigger re-enumeration of a specific UltraGrid backend on the owning peer via a per-backend MQTT trigger topic, so newly-plugged device menus update without restarting the app.

**Architecture:** Add non-retained per-backend trigger topics at `/peer/<ownerPeerId>/settings/localProps/ug_refresh_<backend>`. The owning peer is already subscribed to its own `settings/#` and catches the trigger in its MQTT message handler, which dispatches to `enumerate()` with an `only: [backend]` filter. Backend identifiers + topic helpers are lifted to `src/shared/topics.ts` so the renderer can publish trigger topics type-safely. Per-dropdown refresh icons in the UltraGrid panel publish the trigger to the panel's target peer (local or remote).

**Tech Stack:** TypeScript, Electron (main + preload + renderer), Vue 3, vitest, mqtt.js (via `telemersive-bus`).

---

## File Structure

**Files to create:**
- None.

**Files to modify:**
- `src/shared/topics.ts` — absorb `Backend` type + backend topic maps + `applicableBackends()` from `src/main/enumeration/topics.ts`; add `refreshTopic()`, `backendFromRefreshTopic()`.
- `src/main/enumeration/topics.ts` — re-export from `src/shared/topics.ts` (keeps existing import sites working).
- `src/main/enumeration/index.ts` — add `{ only?: Backend[] }` option to `enumerate()`; export `handleRefreshTrigger()`.
- `src/main/index.ts` — dispatch incoming MQTT messages to `handleRefreshTrigger()`; remove now-redundant `enumerate:refresh` IPC handler.
- `src/preload/index.ts` — remove `enumerate:refresh` from the invoke allowlist.
- `src/renderer/components/panels/UltraGridPanel.vue` — add per-dropdown ↻ buttons that publish trigger topics; remove the bottom "Refresh Devices" button.

**Files to create in tests:**
- `tests/main/enumeration/topics.test.ts` — tests for `refreshTopic()` and `backendFromRefreshTopic()`.

**Files to modify in tests:**
- `tests/main/enumeration/orchestrator.test.ts` — add cases for `{ only }` filter and `handleRefreshTrigger()`.

---

## Task 1: Lift Backend types and topic helpers to shared

**Files:**
- Modify: `src/shared/topics.ts`
- Modify: `src/main/enumeration/topics.ts`

### Step 1.1: Extend `src/shared/topics.ts` with Backend type + helpers

- [ ] **Step: Add Backend union, topic-tail maps, applicableBackends(), and the new refreshTopic / backendFromRefreshTopic helpers**

Append to the end of [src/shared/topics.ts](src/shared/topics.ts):

```typescript
export type Backend =
  | 'textureCapture'
  | 'ndi'
  | 'portaudioCapture'
  | 'portaudioReceive'
  | 'coreaudioCapture'
  | 'coreaudioReceive'
  | 'wasapiCapture'
  | 'wasapiReceive'
  | 'jackCapture'
  | 'jackReceive'

const BACKEND_TOPIC_TAIL: Record<Backend, string> = {
  textureCapture: 'localMenus/textureCaptureRange',
  ndi: 'localMenus/ndiRange',
  portaudioCapture: 'localMenus/portaudioCaptureRange',
  portaudioReceive: 'localMenus/portaudioReceiveRange',
  coreaudioCapture: 'localMenus/coreaudioCaptureRange',
  coreaudioReceive: 'localMenus/coreaudioReceiveRange',
  wasapiCapture: 'localMenus/wasapiCaptureRange',
  wasapiReceive: 'localMenus/wasapiReceiveRange',
  jackCapture: 'localMenus/jackCaptureRange',
  jackReceive: 'localMenus/jackReceiveRange'
}

const BACKEND_FALLBACK: Record<Backend, string> = {
  textureCapture: '-default-',
  ndi: '-default-',
  portaudioCapture: '0',
  portaudioReceive: '0',
  coreaudioCapture: '0',
  coreaudioReceive: '0',
  wasapiCapture: '0',
  wasapiReceive: '0',
  jackCapture: '0',
  jackReceive: '0'
}

const UG_REFRESH_TAIL: Record<Backend, string> = {
  textureCapture: 'localProps/ug_refresh_textureCapture',
  ndi: 'localProps/ug_refresh_ndi',
  portaudioCapture: 'localProps/ug_refresh_portaudioCapture',
  portaudioReceive: 'localProps/ug_refresh_portaudioReceive',
  coreaudioCapture: 'localProps/ug_refresh_coreaudioCapture',
  coreaudioReceive: 'localProps/ug_refresh_coreaudioReceive',
  wasapiCapture: 'localProps/ug_refresh_wasapiCapture',
  wasapiReceive: 'localProps/ug_refresh_wasapiReceive',
  jackCapture: 'localProps/ug_refresh_jackCapture',
  jackReceive: 'localProps/ug_refresh_jackReceive'
}

const REFRESH_TAIL_TO_BACKEND: Record<string, Backend> = Object.fromEntries(
  (Object.entries(UG_REFRESH_TAIL) as [Backend, string][]).map(([b, tail]) => [tail, b])
) as Record<string, Backend>

export function backendTopic(peerId: string, backend: Backend): string {
  return topics.settings(peerId, BACKEND_TOPIC_TAIL[backend])
}

export function backendFallback(backend: Backend): string {
  return BACKEND_FALLBACK[backend]
}

export function ugEnableTopic(peerId: string): string {
  return topics.settings(peerId, 'localProps/ug_enable')
}

export function refreshTopic(peerId: string, backend: Backend): string {
  return topics.settings(peerId, UG_REFRESH_TAIL[backend])
}

export function backendFromRefreshTopic(peerId: string, topic: string): Backend | null {
  const parsed = parseTopic(topic)
  if (!parsed || parsed.type !== 'settings') return null
  if (parsed.peerId !== peerId) return null
  return REFRESH_TAIL_TO_BACKEND[parsed.subpath] ?? null
}

export function applicableBackends(): Backend[] {
  const all: Backend[] = [
    'textureCapture',
    'ndi',
    'portaudioCapture',
    'portaudioReceive'
  ]
  if (process.platform === 'darwin') {
    all.push('coreaudioCapture', 'coreaudioReceive')
  }
  if (process.platform === 'linux') {
    all.push('jackCapture', 'jackReceive')
  }
  if (process.platform === 'win32') {
    all.push('wasapiCapture', 'wasapiReceive')
  }
  return all
}
```

### Step 1.2: Replace `src/main/enumeration/topics.ts` with re-exports

- [ ] **Step: Replace file contents with re-exports from shared**

Replace the full contents of [src/main/enumeration/topics.ts](src/main/enumeration/topics.ts) with:

```typescript
export type { Backend } from '../../shared/topics'
export {
  backendTopic,
  backendFallback,
  ugEnableTopic,
  applicableBackends,
  refreshTopic,
  backendFromRefreshTopic
} from '../../shared/topics'

export interface EnumerationResult {
  range: string
  count: number
}
```

### Step 1.3: Typecheck

- [ ] **Step: Run typecheck**

Run: `npm run typecheck`
Expected: PASS (existing `../topics` imports in `src/main/enumeration/index.ts` resolve via the re-export).

### Step 1.4: Commit

- [ ] **Step: Commit the topics refactor**

```bash
git add src/shared/topics.ts src/main/enumeration/topics.ts
git commit -m "refactor(topics): lift Backend type + helpers to shared; add refresh topic helpers"
```

---

## Task 2: Tests for refreshTopic and backendFromRefreshTopic

**Files:**
- Create: `tests/main/enumeration/topics.test.ts`

### Step 2.1: Write failing tests

- [ ] **Step: Write the failing test file**

Create [tests/main/enumeration/topics.test.ts](tests/main/enumeration/topics.test.ts):

```typescript
import { describe, it, expect } from 'vitest'
import {
  refreshTopic,
  backendFromRefreshTopic
} from '../../../src/shared/topics'

describe('refreshTopic', () => {
  it('builds the ug_refresh_<backend> topic for a peer', () => {
    expect(refreshTopic('peerA', 'portaudioCapture'))
      .toBe('/peer/peerA/settings/localProps/ug_refresh_portaudioCapture')
    expect(refreshTopic('peerA', 'textureCapture'))
      .toBe('/peer/peerA/settings/localProps/ug_refresh_textureCapture')
    expect(refreshTopic('peerA', 'ndi'))
      .toBe('/peer/peerA/settings/localProps/ug_refresh_ndi')
  })
})

describe('backendFromRefreshTopic', () => {
  it('returns the backend for a matching peer + trigger topic', () => {
    const t = '/peer/peerA/settings/localProps/ug_refresh_portaudioCapture'
    expect(backendFromRefreshTopic('peerA', t)).toBe('portaudioCapture')
  })

  it('returns null when topic belongs to a different peer', () => {
    const t = '/peer/peerB/settings/localProps/ug_refresh_portaudioCapture'
    expect(backendFromRefreshTopic('peerA', t)).toBeNull()
  })

  it('returns null for non-refresh settings topics', () => {
    const t = '/peer/peerA/settings/localMenus/portaudioCaptureRange'
    expect(backendFromRefreshTopic('peerA', t)).toBeNull()
  })

  it('returns null for unrelated topics', () => {
    const t = '/peer/peerA/rack/page_0/channel.0/loaded'
    expect(backendFromRefreshTopic('peerA', t)).toBeNull()
  })

  it('returns null for a malformed topic', () => {
    expect(backendFromRefreshTopic('peerA', '')).toBeNull()
    expect(backendFromRefreshTopic('peerA', 'garbage')).toBeNull()
  })
})
```

### Step 2.2: Run — expect PASS

- [ ] **Step: Run the tests**

Run: `npx vitest run tests/main/enumeration/topics.test.ts`
Expected: all 6 tests PASS (the helpers were written in Task 1).

### Step 2.3: Commit

- [ ] **Step: Commit the tests**

```bash
git add tests/main/enumeration/topics.test.ts
git commit -m "test(topics): cover refreshTopic + backendFromRefreshTopic"
```

---

## Task 3: `enumerate()` gains an `only` filter

**Files:**
- Modify: `src/main/enumeration/index.ts`
- Modify: `tests/main/enumeration/orchestrator.test.ts`

### Step 3.1: Write failing test for `only` filter

- [ ] **Step: Append a test to orchestrator.test.ts**

Append to [tests/main/enumeration/orchestrator.test.ts](tests/main/enumeration/orchestrator.test.ts):

```typescript
describe('enumerate — only filter', () => {
  beforeEach(() => {
    process.env.UG_PATH = '/definitely/not/a/real/binary/uv'
    resetRegistry()
  })

  it('publishes only the requested backend when `only` is passed, plus ug_enable=0', async () => {
    const published = new Map<string, string>()
    await enumerate('peerA', (_r, t, v) => { published.set(t, v) }, {
      only: ['portaudioCapture']
    })

    expect(published.get('/peer/peerA/settings/localProps/ug_enable')).toBe('0')
    expect(published.get(backendTopic('peerA', 'portaudioCapture')))
      .toBe(backendFallback('portaudioCapture'))

    for (const backend of applicableBackends()) {
      if (backend === 'portaudioCapture') continue
      expect(published.has(backendTopic('peerA', backend))).toBe(false)
    }
  })

  it('ignores entries in `only` that are not in applicableBackends()', async () => {
    const published = new Map<string, string>()
    await enumerate('peerA', (_r, t, v) => { published.set(t, v) }, {
      only: ['wasapiCapture'] // not applicable on darwin/linux CI hosts
    })

    expect(published.get('/peer/peerA/settings/localProps/ug_enable')).toBe('0')
    if (process.platform === 'win32') {
      expect(published.get(backendTopic('peerA', 'wasapiCapture')))
        .toBe(backendFallback('wasapiCapture'))
    } else {
      expect(published.has(backendTopic('peerA', 'wasapiCapture'))).toBe(false)
    }
  })
})
```

### Step 3.2: Run — expect FAIL

- [ ] **Step: Run the tests and observe the failure**

Run: `npx vitest run tests/main/enumeration/orchestrator.test.ts`
Expected: the two new tests FAIL — the `options` arg is rejected by current `enumerate()` signature (TS error or runtime: "only" entries ignored because the arg is unused).

### Step 3.3: Implement `only` filter

- [ ] **Step: Modify enumerate() to accept and apply `only`**

Edit [src/main/enumeration/index.ts](src/main/enumeration/index.ts) — replace the existing `enumerate` function with:

```typescript
export interface EnumerateOptions {
  only?: Backend[]
}

export async function enumerate(
  peerId: string,
  publish: EnumeratePublish,
  options: EnumerateOptions = {}
): Promise<void> {
  if (!peerId) return

  const uvPath = resolveUgPath()
  const applicable = applicableBackends()
  const selected = options.only
    ? applicable.filter((b) => options.only!.includes(b))
    : applicable

  if (!uvPath) {
    publish(1, ugEnableTopic(peerId), '0')
    for (const backend of selected) {
      publish(1, backendTopic(peerId, backend), backendFallback(backend))
    }
    console.warn('[enumerate] UltraGrid binary not found; publishing fallback enumeration')
    return
  }

  publish(1, ugEnableTopic(peerId), '1')

  await Promise.allSettled(selected.map((b) => runBackend(b, uvPath, peerId, publish)))
}
```

Also import `applicableBackends` where the file already imports backend helpers — update the existing import at the top of the file:

```typescript
import {
  applicableBackends,
  backendFallback,
  backendTopic,
  ugEnableTopic,
  type Backend
} from './topics'
```

(This matches the current imports — no change if already present.)

### Step 3.4: Run — expect PASS

- [ ] **Step: Run the tests**

Run: `npx vitest run tests/main/enumeration/orchestrator.test.ts`
Expected: all tests PASS, including the new `only`-filter cases. Pre-existing "no UV binary" tests still pass because `options` defaults to `{}` and behavior is unchanged when `only` is omitted.

### Step 3.5: Commit

- [ ] **Step: Commit the only-filter change**

```bash
git add src/main/enumeration/index.ts tests/main/enumeration/orchestrator.test.ts
git commit -m "feat(enumerate): add { only?: Backend[] } filter for per-backend refresh"
```

---

## Task 4: `handleRefreshTrigger()` dispatcher

**Files:**
- Modify: `src/main/enumeration/index.ts`
- Modify: `tests/main/enumeration/orchestrator.test.ts`

### Step 4.1: Write failing test

- [ ] **Step: Append a test for handleRefreshTrigger**

Append to [tests/main/enumeration/orchestrator.test.ts](tests/main/enumeration/orchestrator.test.ts):

```typescript
import { handleRefreshTrigger } from '../../../src/main/enumeration'

describe('handleRefreshTrigger', () => {
  beforeEach(() => {
    process.env.UG_PATH = '/definitely/not/a/real/binary/uv'
    resetRegistry()
  })

  it('returns false for topics that do not match a refresh trigger', async () => {
    const calls: string[] = []
    const handled = await handleRefreshTrigger(
      'peerA',
      '/peer/peerA/settings/localMenus/portaudioCaptureRange',
      (_r, t) => { calls.push(t) }
    )
    expect(handled).toBe(false)
    expect(calls).toEqual([])
  })

  it('returns false for refresh triggers aimed at a different peer', async () => {
    const calls: string[] = []
    const handled = await handleRefreshTrigger(
      'peerA',
      '/peer/peerB/settings/localProps/ug_refresh_portaudioCapture',
      (_r, t) => { calls.push(t) }
    )
    expect(handled).toBe(false)
    expect(calls).toEqual([])
  })

  it('runs single-backend enumeration when the trigger matches', async () => {
    const published = new Map<string, string>()
    const handled = await handleRefreshTrigger(
      'peerA',
      '/peer/peerA/settings/localProps/ug_refresh_portaudioCapture',
      (_r, t, v) => { published.set(t, v) }
    )
    expect(handled).toBe(true)
    expect(published.get('/peer/peerA/settings/localProps/ug_enable')).toBe('0')
    expect(published.get(backendTopic('peerA', 'portaudioCapture')))
      .toBe(backendFallback('portaudioCapture'))
    // Other backends not republished
    for (const backend of applicableBackends()) {
      if (backend === 'portaudioCapture') continue
      expect(published.has(backendTopic('peerA', backend))).toBe(false)
    }
  })
})
```

### Step 4.2: Run — expect FAIL

- [ ] **Step: Run the tests**

Run: `npx vitest run tests/main/enumeration/orchestrator.test.ts`
Expected: the three `handleRefreshTrigger` tests FAIL with "handleRefreshTrigger is not exported".

### Step 4.3: Implement `handleRefreshTrigger`

- [ ] **Step: Add handleRefreshTrigger to enumeration/index.ts**

Edit [src/main/enumeration/index.ts](src/main/enumeration/index.ts) — update the imports to include `backendFromRefreshTopic`:

```typescript
import {
  applicableBackends,
  backendFallback,
  backendFromRefreshTopic,
  backendTopic,
  ugEnableTopic,
  type Backend
} from './topics'
```

Then append below the existing `enumerate` function:

```typescript
export async function handleRefreshTrigger(
  peerId: string,
  topic: string,
  publish: EnumeratePublish
): Promise<boolean> {
  const backend = backendFromRefreshTopic(peerId, topic)
  if (!backend) return false
  await enumerate(peerId, publish, { only: [backend] })
  return true
}
```

### Step 4.4: Run — expect PASS

- [ ] **Step: Run the tests**

Run: `npx vitest run tests/main/enumeration/orchestrator.test.ts`
Expected: all orchestrator tests PASS.

### Step 4.5: Commit

- [ ] **Step: Commit the dispatcher**

```bash
git add src/main/enumeration/index.ts tests/main/enumeration/orchestrator.test.ts
git commit -m "feat(enumerate): add handleRefreshTrigger for ug_refresh_<backend> topics"
```

---

## Task 5: Wire the dispatcher into main's MQTT message handler

**Files:**
- Modify: `src/main/index.ts`

### Step 5.1: Update imports

- [ ] **Step: Add handleRefreshTrigger to imports**

Edit [src/main/index.ts:13](src/main/index.ts#L13) — change:

```typescript
import { enumerate } from './enumeration'
```

to:

```typescript
import { enumerate, handleRefreshTrigger } from './enumeration'
```

### Step 5.2: Dispatch refresh triggers in the MQTT message handler

- [ ] **Step: Add handler call inside bus.on('mqtt:message', ...)**

Edit [src/main/index.ts:232-237](src/main/index.ts#L232-L237) — replace:

```typescript
  bus.on('mqtt:message', (msg: { topic: string; payload: string }) => {
    mainWindow?.webContents.send('mqtt:message', msg)
    if (deviceRouter) {
      deviceRouter.onMqttMessage(msg.topic, msg.payload)
    }
  })
```

with:

```typescript
  bus.on('mqtt:message', (msg: { topic: string; payload: string }) => {
    mainWindow?.webContents.send('mqtt:message', msg)
    if (deviceRouter) {
      deviceRouter.onMqttMessage(msg.topic, msg.payload)
    }
    if (localPeerId) {
      handleRefreshTrigger(localPeerId, msg.topic, (retained, topic, value) =>
        trackedPublish(retained, topic, value)
      ).catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err)
        console.warn(`[enumerate] refresh trigger failed: ${message}`)
      })
    }
  })
```

### Step 5.3: Typecheck

- [ ] **Step: Run typecheck**

Run: `npm run typecheck`
Expected: PASS.

### Step 5.4: Commit

- [ ] **Step: Commit the dispatcher wiring**

```bash
git add src/main/index.ts
git commit -m "feat(main): dispatch incoming ug_refresh_<backend> topics to enumerate"
```

---

## Task 6: Remove the now-redundant `enumerate:refresh` IPC handler

The bottom panel refresh button is being replaced with per-dropdown triggers in Task 7. The IPC handler has only one caller (that button), so it goes with the button.

**Files:**
- Modify: `src/main/index.ts`
- Modify: `src/preload/index.ts`

### Step 6.1: Remove the IPC handler

- [ ] **Step: Delete the enumerate:refresh handler**

Edit [src/main/index.ts:324-329](src/main/index.ts#L324-L329) — delete these lines:

```typescript
  ipcMain.handle('enumerate:refresh', async () => {
    if (!localPeerId) return
    await enumerate(localPeerId, (retained, topic, value) =>
      trackedPublish(retained, topic, value)
    )
  })
```

### Step 6.2: Remove it from the preload allowlist

- [ ] **Step: Remove from preload invoke allowlist**

Edit [src/preload/index.ts](src/preload/index.ts) — find and remove the `'enumerate:refresh'` entry (line 9 per current grep). If the allowlist becomes a single-item array or the array is otherwise affected, fix the surrounding syntax (trailing commas etc.) so it remains valid.

### Step 6.3: Typecheck

- [ ] **Step: Run typecheck**

Run: `npm run typecheck`
Expected: PASS. If the renderer still references `window.api.invoke('enumerate:refresh')` at this point, typecheck may warn — that call is removed in Task 7, and we accept a transient typecheck warning between commits. If your typecheck is strict enough to fail, combine Task 6 and Task 7 into one commit.

### Step 6.4: Commit

- [ ] **Step: Commit the IPC removal**

```bash
git add src/main/index.ts src/preload/index.ts
git commit -m "refactor: remove enumerate:refresh IPC (replaced by trigger topics)"
```

---

## Task 7: Per-dropdown refresh buttons in UltraGridPanel.vue

Goal: every dropdown that reads a `localMenus/*Range` value gets a small ↻ button next to it that publishes the corresponding `ug_refresh_<backend>` trigger to the panel's target peer. The bottom "Refresh Devices" button is removed.

**Mapping of dropdown → backend:**
- texture source select → `textureCapture`
- ndi source select → `ndi`
- audioType `'0'` device (capture) → `portaudioCapture`
- audioType `'1'` device (capture) → `coreaudioCapture`
- audioType `'2'` device (capture) → `wasapiCapture`
- audioType `'3'` device (capture) → `jackCapture`
- audioRxType `'0'` device (receive) → `portaudioReceive`
- audioRxType `'1'` device (receive) → `coreaudioReceive`
- audioRxType `'2'` device (receive) → `wasapiReceive`
- audioRxType `'3'` device (receive) → `jackReceive`

**Files:**
- Modify: `src/renderer/components/panels/UltraGridPanel.vue`

### Step 7.1: Add imports + helper

- [ ] **Step: Import Backend + refreshTopic; add triggerRefresh helper**

Edit the `<script setup>` section of [src/renderer/components/panels/UltraGridPanel.vue](src/renderer/components/panels/UltraGridPanel.vue).

Add to the imports near the top (after the existing `useMqttBinding` / `computed` imports):

```typescript
import { type Backend, refreshTopic } from '../../../shared/topics'
```

Replace the existing `refreshEnumeration` function (line 216-218) with:

```typescript
async function triggerRefresh(backend: Backend) {
  if (isEnabled.value || isLocked.value) return
  await window.api.invoke('mqtt:publish', {
    topic: refreshTopic(props.peerId, backend),
    value: '1',
    retain: false
  })
}
```

Rationale: `props.peerId` is the panel's target peer (local or remote) — exactly what we want. `isEnabled` + `isLocked` already encode "device contention" and "remote + targetLocked" per the panel's existing conventions. `mqtt:publish` is the existing renderer→main publish IPC ([src/main/index.ts:282](src/main/index.ts#L282)).

### Step 7.2: Add the ↻ button template snippet in the `<template>` — texture + ndi dropdowns

- [ ] **Step: Wrap the texture select's `<div class="field-row">` to include a ↻ button**

Edit the texture select block at [src/renderer/components/panels/UltraGridPanel.vue:306-316](src/renderer/components/panels/UltraGridPanel.vue#L306-L316). Replace:

```html
        <div v-if="videoType === '0'" class="field-row">
          <label>texture</label>
          <select
            :value="textureSel.value.value"
            :disabled="isLocked"
            @change="textureSel.set(($event.target as HTMLSelectElement).value)"
          >
            <option value="-default-">— select —</option>
            <option v-for="name in textureOptions" :key="name" :value="name">{{ name }}</option>
          </select>
        </div>
```

with:

```html
        <div v-if="videoType === '0'" class="field-row">
          <label>texture</label>
          <select
            :value="textureSel.value.value"
            :disabled="isLocked"
            @change="textureSel.set(($event.target as HTMLSelectElement).value)"
          >
            <option value="-default-">— select —</option>
            <option v-for="name in textureOptions" :key="name" :value="name">{{ name }}</option>
          </select>
          <button class="refresh-icon" :disabled="isLocked" @click="triggerRefresh('textureCapture')" title="Refresh">↻</button>
        </div>
```

- [ ] **Step: Same treatment for ndi select at UltraGridPanel.vue:318-328**

Replace:

```html
        <div v-if="videoType === '1'" class="field-row">
          <label>ndi source</label>
          <select
            :value="ndiSel.value.value"
            :disabled="isLocked"
            @change="ndiSel.set(($event.target as HTMLSelectElement).value)"
          >
            <option value="-default-">— select —</option>
            <option v-for="name in ndiOptions" :key="name" :value="name">{{ name }}</option>
          </select>
        </div>
```

with:

```html
        <div v-if="videoType === '1'" class="field-row">
          <label>ndi source</label>
          <select
            :value="ndiSel.value.value"
            :disabled="isLocked"
            @change="ndiSel.set(($event.target as HTMLSelectElement).value)"
          >
            <option value="-default-">— select —</option>
            <option v-for="name in ndiOptions" :key="name" :value="name">{{ name }}</option>
          </select>
          <button class="refresh-icon" :disabled="isLocked" @click="triggerRefresh('ndi')" title="Refresh">↻</button>
        </div>
```

### Step 7.3: Add ↻ buttons to the four audio-capture device selects

- [ ] **Step: portaudio capture (UltraGridPanel.vue:387-399)**

Replace:

```html
        <div v-if="audioType === '0'" class="field-row">
          <label>device</label>
          <select
            :value="portaudioSel.value.value"
            :disabled="isLocked"
            @change="portaudioSel.set(($event.target as HTMLSelectElement).value)"
          >
            <option value="-default-">— select —</option>
            <option v-for="d in portaudioCaptureOptions" :key="d.index" :value="d.label">
              {{ d.label }}
            </option>
          </select>
        </div>
```

with:

```html
        <div v-if="audioType === '0'" class="field-row">
          <label>device</label>
          <select
            :value="portaudioSel.value.value"
            :disabled="isLocked"
            @change="portaudioSel.set(($event.target as HTMLSelectElement).value)"
          >
            <option value="-default-">— select —</option>
            <option v-for="d in portaudioCaptureOptions" :key="d.index" :value="d.label">
              {{ d.label }}
            </option>
          </select>
          <button class="refresh-icon" :disabled="isLocked" @click="triggerRefresh('portaudioCapture')" title="Refresh">↻</button>
        </div>
```

- [ ] **Step: coreaudio capture (UltraGridPanel.vue:400-412)**

Replace:

```html
        <div v-if="audioType === '1'" class="field-row">
          <label>device</label>
          <select
            :value="coreaudioSel.value.value"
            :disabled="isLocked"
            @change="coreaudioSel.set(($event.target as HTMLSelectElement).value)"
          >
            <option value="-default-">— select —</option>
            <option v-for="d in coreaudioCaptureOptions" :key="d.index" :value="d.label">
              {{ d.label }}
            </option>
          </select>
        </div>
```

with:

```html
        <div v-if="audioType === '1'" class="field-row">
          <label>device</label>
          <select
            :value="coreaudioSel.value.value"
            :disabled="isLocked"
            @change="coreaudioSel.set(($event.target as HTMLSelectElement).value)"
          >
            <option value="-default-">— select —</option>
            <option v-for="d in coreaudioCaptureOptions" :key="d.index" :value="d.label">
              {{ d.label }}
            </option>
          </select>
          <button class="refresh-icon" :disabled="isLocked" @click="triggerRefresh('coreaudioCapture')" title="Refresh">↻</button>
        </div>
```

- [ ] **Step: wasapi capture (UltraGridPanel.vue:413-425)**

Replace:

```html
        <div v-if="audioType === '2'" class="field-row">
          <label>device</label>
          <select
            :value="wasapiSel.value.value"
            :disabled="isLocked"
            @change="wasapiSel.set(($event.target as HTMLSelectElement).value)"
          >
            <option value="-default-">— select —</option>
            <option v-for="d in wasapiCaptureOptions" :key="d.index" :value="d.label">
              {{ d.label }}
            </option>
          </select>
        </div>
```

with:

```html
        <div v-if="audioType === '2'" class="field-row">
          <label>device</label>
          <select
            :value="wasapiSel.value.value"
            :disabled="isLocked"
            @change="wasapiSel.set(($event.target as HTMLSelectElement).value)"
          >
            <option value="-default-">— select —</option>
            <option v-for="d in wasapiCaptureOptions" :key="d.index" :value="d.label">
              {{ d.label }}
            </option>
          </select>
          <button class="refresh-icon" :disabled="isLocked" @click="triggerRefresh('wasapiCapture')" title="Refresh">↻</button>
        </div>
```

- [ ] **Step: jack capture (UltraGridPanel.vue:426-438)**

Replace:

```html
        <div v-if="audioType === '3'" class="field-row">
          <label>device</label>
          <select
            :value="jackSel.value.value"
            :disabled="isLocked"
            @change="jackSel.set(($event.target as HTMLSelectElement).value)"
          >
            <option value="-default-">— select —</option>
            <option v-for="d in jackCaptureOptions" :key="d.index" :value="d.label">
              {{ d.label }}
            </option>
          </select>
        </div>
```

with:

```html
        <div v-if="audioType === '3'" class="field-row">
          <label>device</label>
          <select
            :value="jackSel.value.value"
            :disabled="isLocked"
            @change="jackSel.set(($event.target as HTMLSelectElement).value)"
          >
            <option value="-default-">— select —</option>
            <option v-for="d in jackCaptureOptions" :key="d.index" :value="d.label">
              {{ d.label }}
            </option>
          </select>
          <button class="refresh-icon" :disabled="isLocked" @click="triggerRefresh('jackCapture')" title="Refresh">↻</button>
        </div>
```

### Step 7.4: Add ↻ buttons to the four audio-receive device selects

- [ ] **Step: portaudio receive (UltraGridPanel.vue:484-496)**

Replace:

```html
        <div v-if="audioRxType === '0'" class="field-row">
          <label>device</label>
          <select
            :value="portaudioRxSel.value.value"
            :disabled="isLocked"
            @change="portaudioRxSel.set(($event.target as HTMLSelectElement).value)"
          >
            <option value="-default-">— select —</option>
            <option v-for="d in portaudioReceiveOptions" :key="d.index" :value="d.label">
              {{ d.label }}
            </option>
          </select>
        </div>
```

with:

```html
        <div v-if="audioRxType === '0'" class="field-row">
          <label>device</label>
          <select
            :value="portaudioRxSel.value.value"
            :disabled="isLocked"
            @change="portaudioRxSel.set(($event.target as HTMLSelectElement).value)"
          >
            <option value="-default-">— select —</option>
            <option v-for="d in portaudioReceiveOptions" :key="d.index" :value="d.label">
              {{ d.label }}
            </option>
          </select>
          <button class="refresh-icon" :disabled="isLocked" @click="triggerRefresh('portaudioReceive')" title="Refresh">↻</button>
        </div>
```

- [ ] **Step: coreaudio receive (UltraGridPanel.vue:497-509)**

Replace:

```html
        <div v-if="audioRxType === '1'" class="field-row">
          <label>device</label>
          <select
            :value="coreaudioRxSel.value.value"
            :disabled="isLocked"
            @change="coreaudioRxSel.set(($event.target as HTMLSelectElement).value)"
          >
            <option value="-default-">— select —</option>
            <option v-for="d in coreaudioReceiveOptions" :key="d.index" :value="d.label">
              {{ d.label }}
            </option>
          </select>
        </div>
```

with:

```html
        <div v-if="audioRxType === '1'" class="field-row">
          <label>device</label>
          <select
            :value="coreaudioRxSel.value.value"
            :disabled="isLocked"
            @change="coreaudioRxSel.set(($event.target as HTMLSelectElement).value)"
          >
            <option value="-default-">— select —</option>
            <option v-for="d in coreaudioReceiveOptions" :key="d.index" :value="d.label">
              {{ d.label }}
            </option>
          </select>
          <button class="refresh-icon" :disabled="isLocked" @click="triggerRefresh('coreaudioReceive')" title="Refresh">↻</button>
        </div>
```

- [ ] **Step: wasapi receive (UltraGridPanel.vue:510-522)**

Replace:

```html
        <div v-if="audioRxType === '2'" class="field-row">
          <label>device</label>
          <select
            :value="wasapiRxSel.value.value"
            :disabled="isLocked"
            @change="wasapiRxSel.set(($event.target as HTMLSelectElement).value)"
          >
            <option value="-default-">— select —</option>
            <option v-for="d in wasapiReceiveOptions" :key="d.index" :value="d.label">
              {{ d.label }}
            </option>
          </select>
        </div>
```

with:

```html
        <div v-if="audioRxType === '2'" class="field-row">
          <label>device</label>
          <select
            :value="wasapiRxSel.value.value"
            :disabled="isLocked"
            @change="wasapiRxSel.set(($event.target as HTMLSelectElement).value)"
          >
            <option value="-default-">— select —</option>
            <option v-for="d in wasapiReceiveOptions" :key="d.index" :value="d.label">
              {{ d.label }}
            </option>
          </select>
          <button class="refresh-icon" :disabled="isLocked" @click="triggerRefresh('wasapiReceive')" title="Refresh">↻</button>
        </div>
```

- [ ] **Step: jack receive (UltraGridPanel.vue:523-535)**

Replace:

```html
        <div v-if="audioRxType === '3'" class="field-row">
          <label>device</label>
          <select
            :value="jackRxSel.value.value"
            :disabled="isLocked"
            @change="jackRxSel.set(($event.target as HTMLSelectElement).value)"
          >
            <option value="-default-">— select —</option>
            <option v-for="d in jackReceiveOptions" :key="d.index" :value="d.label">
              {{ d.label }}
            </option>
          </select>
        </div>
```

with:

```html
        <div v-if="audioRxType === '3'" class="field-row">
          <label>device</label>
          <select
            :value="jackRxSel.value.value"
            :disabled="isLocked"
            @change="jackRxSel.set(($event.target as HTMLSelectElement).value)"
          >
            <option value="-default-">— select —</option>
            <option v-for="d in jackReceiveOptions" :key="d.index" :value="d.label">
              {{ d.label }}
            </option>
          </select>
          <button class="refresh-icon" :disabled="isLocked" @click="triggerRefresh('jackReceive')" title="Refresh">↻</button>
        </div>
```

### Step 7.5: Remove the bottom "Refresh Devices" button

- [ ] **Step: Remove the bottom refresh button**

Edit [src/renderer/components/panels/UltraGridPanel.vue:554-557](src/renderer/components/panels/UltraGridPanel.vue#L554-L557). Replace:

```html
    <div class="panel-actions">
      <button class="refresh-btn" @click="refreshEnumeration" :disabled="isEnabled">
        Refresh Devices
      </button>
      <button class="remove-btn" @click="removeDevice" :disabled="isEnabled || (!isLocal && targetLocked)">
        Remove Device
      </button>
    </div>
```

with:

```html
    <div class="panel-actions">
      <button class="remove-btn" @click="removeDevice" :disabled="isEnabled || (!isLocal && targetLocked)">
        Remove Device
      </button>
    </div>
```

### Step 7.6: Add CSS for the new refresh-icon button

- [ ] **Step: Add style for .refresh-icon**

Edit the `<style scoped>` block of [src/renderer/components/panels/UltraGridPanel.vue](src/renderer/components/panels/UltraGridPanel.vue#L565) — append this rule near the other button styles (after `.field-row` rules around line 573):

```css
.refresh-icon {
  padding: 2px 8px;
  border-radius: 4px;
  border: 1px solid #555;
  background: #333;
  color: #ccc;
  cursor: pointer;
  font-size: 12px;
  line-height: 1;
}
.refresh-icon:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
```

### Step 7.7: Typecheck

- [ ] **Step: Run typecheck**

Run: `npm run typecheck`
Expected: PASS. Confirms `refreshEnumeration` is no longer referenced (would be an "unused" warning/error under strict settings if we'd missed removing it — we replaced it with `triggerRefresh`, and removed the one `<button>` that called the old function).

### Step 7.8: Run the full test suite

- [ ] **Step: Run all tests**

Run: `npm test`
Expected: PASS. No existing renderer tests should have been relying on the removed IPC.

### Step 7.9: Manual smoke test — local refresh

- [ ] **Step: Start the dev server and exercise the UI**

Run: `npm run dev`

Once the app is up:
1. Join a room.
2. Add an UltraGrid device to a channel.
3. Without enabling the device, click each ↻ button and observe the MQTT log (main's log buffer): for each click, exactly one non-retained publish to `/peer/<localPeerId>/settings/localProps/ug_refresh_<backend>` (value `1`), followed by retained publishes to `localProps/ug_enable` and `localMenus/<backend>Range`.
4. Enable the device (ON). Verify all ↻ buttons are now disabled.
5. Disable. Verify ↻ buttons re-enable.
6. Plug in a new audio device (or otherwise change system state). Click the relevant ↻ and verify the dropdown now shows the new device.

If you can't verify step 6 (no spare device), say so in the report instead of claiming success.

### Step 7.10: Manual smoke test — remote refresh

- [ ] **Step: Verify remote refresh path (if a second peer is available)**

With a second peer joined to the same room:
1. On peer A, observe peer B's UltraGrid panel. It should render menus and ↻ buttons.
2. Click a ↻ button on peer B's panel from peer A.
3. On peer B's logs, verify the `ug_refresh_<backend>` trigger arrives and a fresh `localMenus/<backend>Range` is published.
4. On peer A, verify the panel's dropdown updates with peer B's current devices.

If no second peer is available, skip this step and note it in the report.

### Step 7.11: Commit

- [ ] **Step: Commit the UI changes**

```bash
git add src/renderer/components/panels/UltraGridPanel.vue
git commit -m "feat(ui): per-dropdown ↻ triggers for UltraGrid backend refresh (local + remote)"
```

---

## Task 8: Final verification

**Files:**
- None.

### Step 8.1: Run full test suite

- [ ] **Step: Run all tests one more time**

Run: `npm test`
Expected: all tests PASS.

### Step 8.2: Typecheck

- [ ] **Step: Run typecheck**

Run: `npm run typecheck`
Expected: PASS.

### Step 8.3: Summary

- [ ] **Step: Report results to the user**

Report:
- Pre-existing tests still pass (count unchanged).
- New tests added: topics.test.ts (6 cases) + orchestrator.test.ts (5 new cases).
- Local + remote refresh paths manually verified (or note what couldn't be verified).
- No changes to startup enumeration behavior.
- `enumerate:refresh` IPC removed; preload allowlist updated.
