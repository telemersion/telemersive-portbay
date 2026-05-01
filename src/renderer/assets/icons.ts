// Ground truth for all device cell SVG icon paths.
// viewBox is always "0 0 200 200". Each value is the `d` attribute of one <path>.
// DeviceCell.vue and design_reference.html both consume this module.

export const ICON_PATHS = {
  // Ground platform — shared base for all composite icons
  Sink:            'm 10,140 v 50 h 180 v -50 h -20 v 30 H 30 v -30 z',

  // Major arrows (large)
  UpStream:        'm 80.01231,19.999998 1.14206,90.059852 h 19.42897 l -30,39.94015 -30,-39.94015 H 61.15437 L 60.01231,19.999998 Z',
  DownStream:      'M 119.98763,149.94015 118.84557,59.940148 H 99.416606 l 29.999994,-40 30,40 h -20.57103 l 1.14206,90.000002 z',
  DownStreamRight: 'M 119.98763,19.94015 118.84557,109.940148 H 99.416606 l 29.999994,40 30,-40 h -20.57103 l 1.14206,-90.000002 z',

  // UG router arrows — single-direction send/receive (no minor feedback arrow)
  ToServer:        'M 90.571033,150 89.428967,60 H 70 l 30,-40 30,40 h -20.57103 l 1.14206,90 z',
  FromServer:      'M 109.42897,19.940146 110.57103,110 H 130 L 99.999999,149.94015 70,110 h 20.571029 l -1.14206,-90.059854 z',

  // Minor arrows (small — MoCap feedback channel)
  UpStreamMinor:   'm 64.332575,85.396692 0.56301,44.571838 h 9.5779 l -14.7891,19.76692 -14.7891,-19.76692 h 10.1409 l -0.563,-44.571838 z',
  DownStreamMinor: 'm 64.332575,149.735 0.56301,-44.571838 h 9.5779 l -14.7891,-19.76692 -14.7891,19.76692 h 10.1409 l -0.563,44.571838 z',

  // MoCap local (send-to-local): right arrow + left-down arrow
  UpLocal:         'm 110,60 40,0.254882 V 40 l 40,30 -40,30 V 80.254881 L 130,80 v 69.93036 l -20,0.13928 z',
  DownLocal:       'm 69.326146,92.99619 v 31.94097 H 82.098857 L 62.93979,150.4517 43.780725,124.93716 h 12.77271 V 105.77258 H 31.05249 L 30.96354,92.996191 Z',

  // UG capture-to-local loopback
  FromLocal:       'm 144.15955,60.595724 v 49.999996 h 20 l -30,39.94015 -30,-39.94015 h 20 V 80.595724 l -51.997483,0.393303 0.0838,70.085463 -22.350659,0.20395 0.09425,-90.602178 z',

  // UG peer-to-peer arrows — right-and-up (TX) / down-and-right (RX) hybrids
  ToPeerTX:        'M 89.470833,51.467598 149.47083,51.72248 V 31.467598 l 40,30 -40,30 V 71.722479 l -40,-0.254881 v 69.930342 l -19.999997,0.13928 z',
  ToPeerRX:        'm 90.045214,51.309795 0.25488,59.999995 H 70.045216 l 29.999984,40 30,-40 H 110.30008 L 110.0452,71.309795 h 69.93036 l 0.13928,-20 z',
}

// Composite icon definitions: named sets of { path, role } used per device/direction.
// role: 'tx' | 'rx' | 'sink' — determines which reactive fill color is applied.
export const ICON_COMPOSITES = {
  // OSC / StageControl bidirectional (loaded=1|4)
  bidi: [
    { path: ICON_PATHS.Sink,        role: 'sink' },
    { path: ICON_PATHS.DownStream,  role: 'tx'   },
    { path: ICON_PATHS.UpStream,    role: 'rx'   },
  ],
  // UG send-to-router (ugMode=1) — single up arrow into sink
  'ug-tx': [
    { path: ICON_PATHS.Sink,     role: 'sink' },
    { path: ICON_PATHS.ToServer, role: 'tx'   },
  ],
  // UG receive-from-router (ugMode=2) — single down arrow into sink
  'ug-rx': [
    { path: ICON_PATHS.Sink,       role: 'sink' },
    { path: ICON_PATHS.FromServer, role: 'rx'   },
  ],
  // UG peer-to-peer TX only (ugMode=4|5, connection=0)
  'ug-p2p-tx': [
    { path: ICON_PATHS.Sink,     role: 'sink' },
    { path: ICON_PATHS.ToPeerTX, role: 'tx'   },
  ],
  // UG peer-to-peer RX only (ugMode=4|5, connection=1)
  'ug-p2p-rx': [
    { path: ICON_PATHS.Sink,     role: 'sink' },
    { path: ICON_PATHS.ToPeerRX, role: 'rx'   },
  ],
  // UG peer-to-peer bidirectional (ugMode=4|5, connection=2)
  'ug-p2p-bidi': [
    { path: ICON_PATHS.Sink,     role: 'sink' },
    { path: ICON_PATHS.ToPeerTX, role: 'tx'   },
    { path: ICON_PATHS.ToPeerRX, role: 'rx'   },
  ],
  // MoCap TX (direction=1)
  tx: [
    { path: ICON_PATHS.Sink,             role: 'sink' },
    { path: ICON_PATHS.DownStream,       role: 'tx'   },
    { path: ICON_PATHS.UpStreamMinor,    role: 'rx'   },
  ],
  // MoCap RX (direction=2)
  rx: [
    { path: ICON_PATHS.Sink,             role: 'sink' },
    { path: ICON_PATHS.DownStreamMinor,  role: 'tx'   },
    { path: ICON_PATHS.DownStreamRight,  role: 'rx'   },
  ],
  local: [
    { path: ICON_PATHS.Sink,      role: 'sink' },
    { path: ICON_PATHS.UpLocal,   role: 'tx'   },
    { path: ICON_PATHS.DownLocal, role: 'rx'   },
  ],
  loop: [
    { path: ICON_PATHS.Sink,      role: 'sink' },
    { path: ICON_PATHS.FromLocal, role: 'sink' },
  ],
}
