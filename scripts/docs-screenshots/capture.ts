/**
 * Captures the documentation screenshots from the real app.
 *
 * Run with:  npm run docs:screenshots
 * Requires:  npm run build   (the harness drives out/main/index.js)
 *
 * No broker, no router, no second machine and no video signal are involved.
 * The app is launched against a throwaway Electron profile and then handed the
 * fictional room from fixture.ts over the same IPC channels the bus normally
 * uses, so every pixel is produced by the real components.
 */

import { _electron as electron, type ElectronApplication, type Page } from 'playwright'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import {
  ROOM,
  PEERS,
  buildRoom,
  COMPAT_OK,
  COMPAT_MISSING,
  switchboardState,
  logEntries,
  UPDATE_AVAILABLE,
  PROFILE_SETTINGS,
  type TopicMap
} from './fixture'

const ROOT = resolve(__dirname, '../..')
const OUT_DIR = join(ROOT, 'docs/assets/screenshots')
const MAIN = join(ROOT, 'out/main/index.js')

let shotCount = 0

// ── IPC injection ────────────────────────────────────────────────

type Event = { channel: string; args: unknown[] }

async function send(app: ElectronApplication, events: Event[]): Promise<void> {
  await app.evaluate(({ BrowserWindow }, payload) => {
    const win = BrowserWindow.getAllWindows()[0]
    if (!win) throw new Error('no BrowserWindow to send to')
    for (const ev of payload as Event[]) {
      win.webContents.send(ev.channel, ...(ev.args as unknown[]))
    }
  }, events)
}

/**
 * Replace the main-process handlers whose answers would otherwise be whatever
 * this particular machine happens to report: the author's real NIC and LAN
 * address, and the throwaway profile's temp path. Screenshots must not leak
 * either, and `ipcMain.handle` values cannot be injected the way events can.
 */
async function overrideHandlers(app: ElectronApplication): Promise<void> {
  await app.evaluate(({ ipcMain }, fake) => {
    const f = fake as Record<string, unknown>
    for (const [channel, value] of Object.entries(f)) {
      ipcMain.removeHandler(channel)
      ipcMain.handle(channel, () => value)
    }
  }, {
    'net:interfaces': [
      { name: 'en0', address: PEERS.local.localIP, family: 'IPv4' },
      { name: 'en1', address: '10.0.8.4', family: 'IPv4' }
    ],
    'settings:get-path':
      '/Users/you/Library/Application Support/telemersive-gateway/settings.json',
    'compat:get-status': COMPAT_OK,
    // The peer detail panel geolocates the public IP and draws a Leaflet map.
    // Returning null omits that whole block: the fixture's documentation IP has
    // no meaningful location, and the map tiles need internet the capture may
    // not have, which would ship a blank grey rectangle into the docs.
    'geo:lookup': null
  })
}

function topicEvents(map: TopicMap): Event[] {
  return Object.entries(map).map(([topic, payload]) => ({
    channel: 'mqtt:message',
    args: [{ topic, payload }]
  }))
}

// ── Screenshot helpers ───────────────────────────────────────────

async function shot(page: Page, name: string, selector?: string): Promise<void> {
  await page.waitForTimeout(140) // let Vue flush and transitions settle
  const path = join(OUT_DIR, `${name}.png`)
  if (selector) {
    const el = page.locator(selector).first()
    await el.waitFor({ state: 'visible', timeout: 5000 })
    await el.screenshot({ path })
  } else {
    await page.screenshot({ path })
  }
  shotCount++
  console.log(`  ✓ ${name}.png`)
}

/**
 * Screenshot the union of several elements' boxes.
 * Needed for `.peer-row`, which is `display: contents` and therefore has no box
 * of its own — its two children are direct grid items of the matrix.
 */
async function shotUnion(
  page: Page,
  name: string,
  selectors: string[],
  pad = 4
): Promise<void> {
  await page.waitForTimeout(140)
  const clip = await page.evaluate(
    ({ sels, pad }: { sels: string[]; pad: number }) => {
      let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity
      for (const sel of sels) {
        const el = document.querySelector(sel)
        if (!el) continue
        const r = el.getBoundingClientRect()
        left = Math.min(left, r.left); top = Math.min(top, r.top)
        right = Math.max(right, r.right); bottom = Math.max(bottom, r.bottom)
      }
      if (left === Infinity) return null
      return {
        x: Math.max(0, left - pad),
        y: Math.max(0, top - pad),
        width: right - left + pad * 2,
        height: bottom - top + pad * 2
      }
    },
    { sels: selectors, pad }
  )
  if (!clip) {
    console.log(`  – ${name}.png skipped (no element matched)`)
    return
  }
  await page.screenshot({ path: join(OUT_DIR, `${name}.png`), clip })
  shotCount++
  console.log(`  ✓ ${name}.png`)
}

/**
 * Matrix shots clipped to the rows that actually exist. A 20-channel rack in an
 * 800px window is mostly empty space, which reads as "something failed to load"
 * on a documentation page.
 */
async function shotMatrix(page: Page, name: string, pad = 20): Promise<void> {
  await page.waitForTimeout(140)
  const box = await page.evaluate((pad: number) => {
    const rows = document.querySelectorAll('.peer-row .peer-cells')
    const last = rows[rows.length - 1] as HTMLElement | undefined
    return {
      width: window.innerWidth,
      height: last
        ? Math.ceil(last.getBoundingClientRect().bottom + pad)
        : Math.min(320, window.innerHeight)
    }
  }, pad)
  await page.screenshot({
    path: join(OUT_DIR, `${name}.png`),
    clip: { x: 0, y: 0, width: box.width, height: box.height }
  })
  shotCount++
  console.log(`  ✓ ${name}.png`)
}

/** Kill animations and the text caret so repeat runs are byte-comparable. */
const FREEZE_CSS = `
  *, *::before, *::after {
    transition: none !important;
    animation: none !important;
    caret-color: transparent !important;
  }
  ::-webkit-scrollbar { width: 8px; height: 8px; }
`

async function main(): Promise<void> {
  mkdirSync(OUT_DIR, { recursive: true })

  const profile = mkdtempSync(join(tmpdir(), 'telemersive-gateway-docs-'))
  writeFileSync(join(profile, 'settings.json'), JSON.stringify(PROFILE_SETTINGS, null, 2))

  console.log(`profile: ${profile}`)
  console.log(`output:  ${OUT_DIR}\n`)

  // ELECTRON_RUN_AS_NODE is set in some shells (and by some agent harnesses);
  // leaving it set makes Electron start as plain Node, with no `app` and no
  // window, which surfaces only as an opaque "Process failed to launch!".
  const env: Record<string, string> = {}
  for (const [k, v] of Object.entries(process.env)) {
    if (k === 'ELECTRON_RUN_AS_NODE' || v === undefined) continue
    env[k] = v
  }

  const app: ElectronApplication = await electron.launch({
    args: [MAIN, `--user-data-dir=${profile}`],
    cwd: ROOT,
    env
  })

  const page = await app.firstWindow()
  await page.waitForLoadState('domcontentloaded')
  await overrideHandlers(app)
  await page.addStyleTag({ content: FREEZE_CSS })
  // Let the app's own startup invokes (settings, compat, bus state) resolve
  // before driving it, otherwise a late real result lands on top of a fixture.
  await page.waitForTimeout(2500)

  const room = buildRoom()

  // A green compat status releases the route gate; the app lands on Session.
  // Views are captured after that bounce so each one remounts and re-invokes
  // its handlers, which is what makes the overrides above take effect.
  await send(app, [{ channel: 'compat:status', args: [COMPAT_OK] }])
  await page.waitForSelector('.session-view', { timeout: 8000 })

  // ── Session view ──
  console.log('session')
  await shot(page, 'session-disconnected')
  await shot(page, 'app-icon-bar', '.icon-bar')

  await send(app, [
    { channel: 'broker:connected', args: [true] },
    { channel: 'rooms:clear', args: [] },
    { channel: 'rooms:append', args: [ROOM.name] },
    { channel: 'rooms:append', args: ['rehearsal'] },
    { channel: 'rooms:append', args: ['workshop-2026'] }
  ])
  await shot(page, 'session-connected')

  await send(app, [{ channel: 'update:status', args: [UPDATE_AVAILABLE] }])
  await shot(page, 'update-banner')
  await send(app, [{ channel: 'update:status', args: [{ state: 'idle' }] }])

  // ── Settings ──
  console.log('settings')
  await page.locator('.icon-bar button[title="Settings"]').click()
  await page.waitForSelector('.settings-view')
  await shot(page, 'settings-tools-ok')
  await shot(page, 'settings-config-file', '.settings-view .card')

  // The blocking state: a missing tool pulls every other route's gate shut.
  await send(app, [{ channel: 'compat:status', args: [COMPAT_MISSING] }])
  await page.waitForTimeout(400)
  await shot(page, 'settings-tools-missing')
  await shot(page, 'app-icon-bar-gated', '.icon-bar')

  await send(app, [{ channel: 'compat:status', args: [COMPAT_OK] }])
  await page.waitForTimeout(400)
  await page.locator('.icon-bar button[title="Session"]').click()
  await page.waitForSelector('.session-view')

  // ── Join: identity first, then the room, then everyone's retained state ──
  console.log('matrix')
  await send(app, [
    { channel: 'peer:id', args: [PEERS.local.peerId] },
    { channel: 'peer:name', args: [PEERS.local.peerName] },
    { channel: 'peer:localIP', args: [PEERS.local.localIP] },
    { channel: 'peer:publicIP', args: [ROOM.publicIP] },
    { channel: 'peer:room:name', args: [ROOM.name] },
    { channel: 'peer:room:id', args: [ROOM.id] }
  ])
  await send(app, [{ channel: 'peer:joined', args: [true] }])
  await page.waitForTimeout(250)
  await shot(page, 'session-joined')

  // peer:joined routes SessionView to /matrix on its own.
  await page.waitForSelector('.matrix-view', { timeout: 5000 })

  // Own peer only, no devices — the "just joined" state.
  await send(app, topicEvents({
    ...Object.fromEntries(
      Object.entries(room.local).filter(([t]) => t.endsWith('/loaded'))
        .map(([t]) => [t, '0'])
    ),
    ...Object.fromEntries(
      Object.entries(room.local).filter(([t]) => t.includes('/settings/'))
    )
  }))
  await page.waitForTimeout(300)
  await shotMatrix(page, 'matrix-empty')
  await shot(page, 'matrix-room-header', '.room-header')

  // Now the full room.
  await send(app, topicEvents(room.local))
  await send(app, topicEvents(room.remoteB))
  await send(app, topicEvents(room.remoteC))
  await send(app, [
    { channel: 'peers:remote:joined', args: [{
      peerId: PEERS.remoteB.peerId,
      peerName: PEERS.remoteB.peerName,
      localIP: PEERS.remoteB.localIP,
      publicIP: ROOM.publicIP
    }] },
    { channel: 'peers:remote:joined', args: [{
      peerId: PEERS.remoteC.peerId,
      peerName: PEERS.remoteC.peerName,
      localIP: PEERS.remoteC.localIP,
      publicIP: '203.0.113.77'
    }] },
    { channel: 'switchboard:state', args: [switchboardState()] }
  ])
  await page.waitForTimeout(500)
  await shotMatrix(page, 'matrix-three-peers')
  await shot(page, 'matrix-channel-proxies', '.header-cells')
  await shotUnion(page, 'matrix-peer-row', ['.peer-row .peer-info', '.peer-row .peer-cells'])

  // ── Channel proxy modal ──
  await page.locator('.header-cells .ch-button').first().click()
  await page.waitForSelector('.proxy-window')
  await shot(page, 'matrix-proxy-modal')
  await page.locator('.proxy-window .close-btn').click()
  await page.waitForTimeout(200)

  // ── Add device popup ──
  console.log('devices')
  const emptyCell = page.locator('.peer-row').first().locator('.device-cell').nth(7)
  await emptyCell.click()
  await page.waitForTimeout(150)
  const plus = emptyCell.locator('.cell-plus, .empty-plus').first()
  if (await plus.count()) {
    await plus.click({ force: true })
    if (await page.locator('.add-device-popup').count()) {
      await page.waitForSelector('.add-device-popup')
      await shot(page, 'matrix-add-device-popup')
      await page.keyboard.press('Escape')
      await page.waitForTimeout(200)
    }
  }

  // ── Peer detail panel ──
  await page.locator('.peer-row').first().locator('.peer-info').click()
  await page.waitForSelector('.peer-detail')
  await shot(page, 'matrix-peer-detail')
  await page.keyboard.press('Escape')
  await page.locator('.matrix-scroll').click({ position: { x: 5, y: 5 } })
  await page.waitForTimeout(250)

  // ── Device panels ──
  console.log('panels')
  await openChannel(page, 0, 0)
  await shot(page, 'panel-ultragrid', '.panel-slot')
  await captureUltraGridTail(page)

  await openChannel(page, 0, 1)
  await shot(page, 'panel-osc-enabled', '.panel-slot')

  await openChannel(page, 0, 2)
  await shot(page, 'panel-stage-control', '.panel-slot')

  // Remote peers own the remaining device types.
  await openChannel(page, 1, 3)
  await shot(page, 'panel-ultragrid-audio-only', '.panel-slot')
  await openChannel(page, 1, 4)
  await shot(page, 'panel-natnet', '.panel-slot')

  // Removal confirmation, driven from the panel that is already open. The
  // device is switched off, so Remove is enabled; Cancel leaves the room intact.
  const remove = page.locator('.panel-slot .remove-btn, .panel-slot button:has-text("Remove Device")').first()
  if (await remove.count()) {
    await remove.click()
    await page.waitForSelector('.confirm-dialog', { timeout: 3000 })
    await shot(page, 'matrix-remove-confirm')
    await page.locator('.confirm-dialog .btn').first().click()
    await page.waitForTimeout(250)
  }

  await openChannel(page, 2, 5)
  await shot(page, 'panel-motive', '.panel-slot')

  // Pin a few panels to show the tab strip.
  for (const [row, ch] of [[0, 0], [0, 1], [1, 4]] as const) {
    await openChannel(page, row, ch)
    const pin = page.locator('.panel-slot button[title="Pin panel"]').first()
    if (await pin.count()) await pin.click()
    await page.waitForTimeout(150)
  }
  await shot(page, 'panel-row-pinned', '.panel-row-area')

  // ── Activity log ──
  console.log('shell')
  await send(app, logEntries().map(e => ({ channel: 'log:entry', args: [e] })))
  await page.locator('.icon-bar button[title="Activity log"]').click()
  await page.waitForSelector('.log-panel')
  await shot(page, 'log-panel')
  await page.locator('.icon-bar button[title="Activity log"]').click()
  await page.waitForTimeout(200)

  // ── About ──
  await page.locator('.icon-bar button[title="About"]').click()
  await page.waitForSelector('.about-window')
  await shot(page, 'about-modal')
  await page.locator('.about-window .close-btn').click()
  await page.waitForTimeout(200)

  await app.close()
  rmSync(profile, { recursive: true, force: true })
  console.log(`\n${shotCount} screenshots written to docs/assets/screenshots/`)
}

/** Click the device cell at (peer row index, channel index) to open its panel. */
async function openChannel(page: Page, row: number, channel: number): Promise<void> {
  const cell = page.locator('.peer-row').nth(row).locator('.device-cell').nth(channel)
  await cell.click()
  await page.waitForSelector('.panel-row-area', { timeout: 5000 })
  await page.waitForTimeout(250)
}

/**
 * The UltraGrid panel is taller than the panel row even at a generous height,
 * so the tail — Advanced, Monitor, Remove — needs its own shot.
 */
async function captureUltraGridTail(page: Page): Promise<void> {
  const scrolled = await page.evaluate(() => {
    const panel = document.querySelector('.panel-slot')
    if (!panel) return false
    let el = panel.querySelector('*') as HTMLElement | null
    // Find the scroll container inside the slot.
    const all = Array.from(panel.querySelectorAll<HTMLElement>('*'))
    el = all.find(n => n.scrollHeight > n.clientHeight + 20) ?? null
    if (!el) return false
    el.scrollTop = el.scrollHeight
    return true
  })
  if (!scrolled) {
    console.log('  – panel-ultragrid-tail.png skipped (no scroll container)')
    return
  }
  await shot(page, 'panel-ultragrid-tail', '.panel-slot')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
