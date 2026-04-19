# M1 Interop Test — Telemersive Gateway NG ↔ Max

**Goal:** Validate end-to-end interop between the NG Electron app and the Max/Jitter gateway peer against the live telemersive broker. This is the M1 acceptance gate (Task 19 of [2026-04-16-gateway-ng-m0-m1.md](../plans/2026-04-16-gateway-ng-m0-m1.md)).

**Setup:**
- Two hosts (or two user accounts on one host). Host A runs NG; Host B runs Max gateway.
- Both connect to the production broker `telemersion.zhdk.ch:3883`.
- NG version under test: commit `<fill in>`.
- Max version under test: `<fill in>`.
- Test date: `<fill in>`.
- Tester: `<fill in>`.

**Log capture:** Open the Activity log panel (icon bar, third icon). Leave it running for every test case. Paste the relevant log lines into each case using the [Copy to clipboard] button. Use the filter checkboxes to isolate Sub/Pub/Recv when helpful.

**Legend:**
- ✅ pass
- ❌ fail (record what happened)
- ⚠️ partial (record what worked + what didn't)
- ⏭ skipped

---

## Case 1 — Broker connect (NG)

---

## Case 2 — Room join (NG, empty room)

---

## Case 3 — Max peer joins same room

**Steps:**
1. With NG still in the room, launch Max gateway on Host B.
2. Join the same room name.

**Expected on NG side:**
- Log shows `peers:remote:joined` and a subsequent `SUB /peer/<maxPeerId>/#`.
- Log shows `RECV` lines for Max's init sequence (20 × loaded 0, settings, localMenus, localProps).
- Matrix gains a second row for the Max peer with 20 empty cells.

**Expected on Max side:**
- Max's UI shows the NG peer.
- Max may echo RX of NG's init-sequence topics — record any surprises.

**Result:** 

SCRIPT_TX: configure telemersion.zhdk.ch 3883 peer telemersion2021 10.18.152.229
SCRIPT_TX: connect
script: "Apr 19 19:30:53.623 myPeerName: connect: attempting to connect to broker..."
SCRIPT_RX: bus broker connected 1
script: "Apr 19 19:30:53.656 myPeerName: ...successfully connected."
script: "Apr 19 19:30:53.656 myPeerName: ...stopping connection timout thread."
SCRIPT_RX: bus rooms menu clear
SCRIPT_RX: bus rooms menu append interop-test-120426
SCRIPT_RX: bus rooms listing interop-test-120426
SCRIPT_RX: bus rooms done
script: "Apr 19 19:30:53.659 myPeerName: <-- found room 'interop-test-120426'"
SCRIPT_TX: join myPeerName interop-test-120426 1234
script: "Apr 19 19:30:55.061 myPeerName: <-- local peer attempting to join room interop-test-120426..."
script: "Apr 19 19:30:55.063 myPeerName:    <-- reconnect to broker with correct last will..."
script: "Apr 19 19:30:55.086 myPeerName:    <-- ... reconnected."
script: "Apr 19 19:30:55.095 myPeerName:    <-- send request to create / join room..."
script: "Apr 19 19:30:55.154 myPeerName: ...stopping join timout thread."
script: "Apr 19 19:30:55.154 myPeerName: <-- access to room interop-test-120426 accepted."
script: "Apr 19 19:30:55.155 myPeerName:    <-- local peer (d7L5RMzRV8QYD5ASA8YPFS) subscribing..."
SCRIPT_RX: chat "{"19:27:33 GMT+0200":"[me]: > has joined room"}"
SCRIPT_RX: bus peer name myPeerName
SCRIPT_RX: bus peer id d7L5RMzRV8QYD5ASA8YPFS
SCRIPT_RX: bus peer localIP 10.18.152.229
SCRIPT_RX: bus peer publicIP 178.197.206.200
SCRIPT_RX: bus peer room name interop-test-120426
js: ultragrid - channel# 50: ugRoomName: interop-test-120426 
SCRIPT_RX: bus peer room id 11
js: ultragrid - channel# 50: ugLANPort: 11502 
js: ultragrid - channel# 50: ugLANip: 0.0.0.0 
js: ultragrid - channel# 50: ugPort: 11502 
SCRIPT_RX: bus peer room uuid ibWTNBD7KxbrDQzVDtZhex
SCRIPT_RX: bus peer joined 1
SCRIPT_TX: subscribe /peer/d7L5RMzRV8QYD5ASA8YPFS/settings/#
SCRIPT_TX: subscribe /peer/d7L5RMzRV8QYD5ASA8YPFS/rack/+/+/loaded
SCRIPT_RX: chat "{"19:27:33 GMT+0200":"[me]: > has joined room","19:30:55 GMT+0200":"[myPeerName]: > has joined room"}"
script: "Apr 19 19:30:55.199 myPeerName:    <-- remote peer 'me' - 8daALfn1eUNDWTkadizbBY joined room"
SCRIPT_RX: bus peers remote joined me 8daALfn1eUNDWTkadizbBY  213.55.240.254
SCRIPT_RX: bus peers menu clear
SCRIPT_RX: bus peers menu append me 8daALfn1eUNDWTkadizbBY  213.55.240.254
SCRIPT_RX: bus peers done
script: "Apr 19 19:30:55.205 myPeerName:    <-- ... local peer subscriptions complete"
SCRIPT_TX: publish 1 /peer/d7L5RMzRV8QYD5ASA8YPFS/rack/page_0/channel.0/loaded 0
SCRIPT_TX: publish 1 /peer/d7L5RMzRV8QYD5ASA8YPFS/rack/page_0/channel.1/loaded 0
SCRIPT_TX: publish 1 /peer/d7L5RMzRV8QYD5ASA8YPFS/rack/page_0/channel.2/loaded 0
SCRIPT_TX: publish 1 /peer/d7L5RMzRV8QYD5ASA8YPFS/rack/page_0/channel.3/loaded 0
SCRIPT_TX: publish 1 /peer/d7L5RMzRV8QYD5ASA8YPFS/rack/page_0/channel.4/loaded 0
SCRIPT_TX: publish 1 /peer/d7L5RMzRV8QYD5ASA8YPFS/rack/page_0/channel.5/loaded 0
SCRIPT_TX: publish 1 /peer/d7L5RMzRV8QYD5ASA8YPFS/rack/page_0/channel.6/loaded 0
SCRIPT_TX: publish 1 /peer/d7L5RMzRV8QYD5ASA8YPFS/rack/page_0/channel.7/loaded 0
SCRIPT_TX: publish 1 /peer/d7L5RMzRV8QYD5ASA8YPFS/rack/page_0/channel.8/loaded 0
SCRIPT_TX: publish 1 /peer/d7L5RMzRV8QYD5ASA8YPFS/rack/page_0/channel.9/loaded 0
SCRIPT_TX: publish 1 /peer/d7L5RMzRV8QYD5ASA8YPFS/rack/page_0/channel.10/loaded 0
SCRIPT_TX: publish 1 /peer/d7L5RMzRV8QYD5ASA8YPFS/rack/page_0/channel.11/loaded 0
SCRIPT_TX: publish 1 /peer/d7L5RMzRV8QYD5ASA8YPFS/rack/page_0/channel.12/loaded 0
SCRIPT_TX: publish 1 /peer/d7L5RMzRV8QYD5ASA8YPFS/rack/page_0/channel.13/loaded 0
SCRIPT_TX: publish 1 /peer/d7L5RMzRV8QYD5ASA8YPFS/rack/page_0/channel.14/loaded 0
SCRIPT_TX: publish 1 /peer/d7L5RMzRV8QYD5ASA8YPFS/rack/page_0/channel.15/loaded 0
SCRIPT_TX: publish 1 /peer/d7L5RMzRV8QYD5ASA8YPFS/rack/page_0/channel.16/loaded 0
SCRIPT_TX: publish 1 /peer/d7L5RMzRV8QYD5ASA8YPFS/rack/page_0/channel.17/loaded 0
SCRIPT_TX: publish 1 /peer/d7L5RMzRV8QYD5ASA8YPFS/rack/page_0/channel.18/loaded 0
SCRIPT_TX: publish 1 /peer/d7L5RMzRV8QYD5ASA8YPFS/rack/page_0/channel.19/loaded 0
SCRIPT_TX: publish 1 /peer/d7L5RMzRV8QYD5ASA8YPFS/settings/lock/enable 0
SCRIPT_TX: publish 1 /peer/d7L5RMzRV8QYD5ASA8YPFS/settings/background/color 0.712544 0.393754 0.666099 1
SCRIPT_TX: publish 1 /peer/d7L5RMzRV8QYD5ASA8YPFS/settings/localMenus/textureCaptureRange -default-
SCRIPT_TX: publish 1 /peer/d7L5RMzRV8QYD5ASA8YPFS/settings/localMenus/ndiRange -default-
SCRIPT_TX: publish 1 /peer/d7L5RMzRV8QYD5ASA8YPFS/settings/localMenus/portaudioCaptureRange "1 Scarlett 18i8 USB (out: 8 in: 18 Core Audio)|2 NDI Audio (out: 0 in: 2 Core Audio)|3 BlackHole 16ch (out: 16 in: 16 Core Audio)|4 BlackHole 2ch (out: 2 in: 2 Core Audio)|5 MacBook ProMikrofon (out: 0 in: 1 Core Audio)|9 ess (out: 24 in: 34 Core Audio)"
SCRIPT_TX: publish 1 /peer/d7L5RMzRV8QYD5ASA8YPFS/settings/localMenus/coreaudioCaptureRange "62 BlackHole 16ch|78 BlackHole 2ch|94 BlackHole 64ch|161 MacBook Pro-Mikrofon|110 Microsoft Teams Audio|128 ZoomAudioDevice|58 Hauptgeraet"
SCRIPT_TX: publish 1 /peer/d7L5RMzRV8QYD5ASA8YPFS/settings/localMenus/wasapiCaptureRange 0
SCRIPT_TX: publish 1 /peer/d7L5RMzRV8QYD5ASA8YPFS/settings/localMenus/jackCaptureRange 0
SCRIPT_TX: publish 1 /peer/d7L5RMzRV8QYD5ASA8YPFS/settings/localMenus/portaudioReceiveRange "0 Acer H6517ST (out: 2 in: 0 Core Audio)|3 Audiofuse Studio (out: 18 in: 20 Core Audio)|4 BlackHole 16ch (out: 16 in: 16 Core Audio)|5 BlackHole 2ch (out: 2 in: 2 Core Audio)|7 MacBook ProLautsprecher (out: 2 in: 0 Core Audio)|10 ESS (out: 34 in: 36 Core Audio)"
SCRIPT_TX: publish 1 /peer/d7L5RMzRV8QYD5ASA8YPFS/settings/localMenus/coreaudioReceiveRange "62 BlackHole 16ch|78 BlackHole 2ch|94 BlackHole 64ch|154 MacBook Pro-Lautsprecher|110 Microsoft Teams Audio|128 ZoomAudioDevice|58 Hauptgeraet"
SCRIPT_TX: publish 1 /peer/d7L5RMzRV8QYD5ASA8YPFS/settings/localMenus/wasapiReceiveRange 0
SCRIPT_TX: publish 1 /peer/d7L5RMzRV8QYD5ASA8YPFS/settings/localMenus/jackReceiveRange 0
SCRIPT_TX: publish 1 /peer/d7L5RMzRV8QYD5ASA8YPFS/settings/localProps/ug_enable 1
SCRIPT_TX: publish 1 /peer/d7L5RMzRV8QYD5ASA8YPFS/settings/localProps/natnet_enable 0
SCRIPT_RX: mqtt /peer/d7L5RMzRV8QYD5ASA8YPFS/rack/page_0/channel.0/loaded 0
SCRIPT_RX: mqtt /peer/d7L5RMzRV8QYD5ASA8YPFS/rack/page_0/channel.1/loaded 0
SCRIPT_RX: mqtt /peer/d7L5RMzRV8QYD5ASA8YPFS/rack/page_0/channel.2/loaded 0
SCRIPT_RX: mqtt /peer/d7L5RMzRV8QYD5ASA8YPFS/rack/page_0/channel.3/loaded 0
SCRIPT_RX: mqtt /peer/d7L5RMzRV8QYD5ASA8YPFS/rack/page_0/channel.4/loaded 0
SCRIPT_RX: mqtt /peer/d7L5RMzRV8QYD5ASA8YPFS/rack/page_0/channel.5/loaded 0
SCRIPT_RX: mqtt /peer/d7L5RMzRV8QYD5ASA8YPFS/rack/page_0/channel.6/loaded 0
SCRIPT_RX: mqtt /peer/d7L5RMzRV8QYD5ASA8YPFS/rack/page_0/channel.7/loaded 0
SCRIPT_RX: mqtt /peer/d7L5RMzRV8QYD5ASA8YPFS/rack/page_0/channel.8/loaded 0
SCRIPT_RX: mqtt /peer/d7L5RMzRV8QYD5ASA8YPFS/rack/page_0/channel.9/loaded 0
SCRIPT_RX: mqtt /peer/d7L5RMzRV8QYD5ASA8YPFS/rack/page_0/channel.10/loaded 0
SCRIPT_RX: mqtt /peer/d7L5RMzRV8QYD5ASA8YPFS/rack/page_0/channel.11/loaded 0
SCRIPT_RX: mqtt /peer/d7L5RMzRV8QYD5ASA8YPFS/rack/page_0/channel.12/loaded 0
SCRIPT_RX: mqtt /peer/d7L5RMzRV8QYD5ASA8YPFS/rack/page_0/channel.13/loaded 0
SCRIPT_RX: mqtt /peer/d7L5RMzRV8QYD5ASA8YPFS/rack/page_0/channel.14/loaded 0
SCRIPT_RX: mqtt /peer/d7L5RMzRV8QYD5ASA8YPFS/rack/page_0/channel.15/loaded 0
SCRIPT_RX: mqtt /peer/d7L5RMzRV8QYD5ASA8YPFS/rack/page_0/channel.16/loaded 0
SCRIPT_RX: mqtt /peer/d7L5RMzRV8QYD5ASA8YPFS/rack/page_0/channel.17/loaded 0
SCRIPT_RX: mqtt /peer/d7L5RMzRV8QYD5ASA8YPFS/rack/page_0/channel.18/loaded 0
SCRIPT_RX: mqtt /peer/d7L5RMzRV8QYD5ASA8YPFS/rack/page_0/channel.19/loaded 0
SCRIPT_RX: mqtt /peer/d7L5RMzRV8QYD5ASA8YPFS/settings/lock/enable 0
SCRIPT_RX: mqtt /peer/d7L5RMzRV8QYD5ASA8YPFS/settings/background/color 0.712544 0.393754 0.666099 1
SCRIPT_RX: mqtt /peer/d7L5RMzRV8QYD5ASA8YPFS/settings/localMenus/textureCaptureRange -default-
SCRIPT_RX: mqtt /peer/d7L5RMzRV8QYD5ASA8YPFS/settings/localMenus/ndiRange -default-
SCRIPT_RX: mqtt /peer/d7L5RMzRV8QYD5ASA8YPFS/settings/localMenus/portaudioCaptureRange "1 Scarlett 18i8 USB (out: 8 in: 18 Core Audio)|2 NDI Audio (out: 0 in: 2 Core Audio)|3 BlackHole 16ch (out: 16 in: 16 Core Audio)|4 BlackHole 2ch (out: 2 in: 2 Core Audio)|5 MacBook ProMikrofon (out: 0 in: 1 Core Audio)|9 ess (out: 24 in: 34 Core Audio)"
SCRIPT_RX: mqtt /peer/d7L5RMzRV8QYD5ASA8YPFS/settings/localMenus/coreaudioCaptureRange "62 BlackHole 16ch|78 BlackHole 2ch|94 BlackHole 64ch|161 MacBook Pro-Mikrofon|110 Microsoft Teams Audio|128 ZoomAudioDevice|58 Hauptgeraet"
SCRIPT_RX: mqtt /peer/d7L5RMzRV8QYD5ASA8YPFS/settings/localMenus/wasapiCaptureRange 0
SCRIPT_RX: mqtt /peer/d7L5RMzRV8QYD5ASA8YPFS/settings/localMenus/jackCaptureRange 0
SCRIPT_RX: mqtt /peer/d7L5RMzRV8QYD5ASA8YPFS/settings/localMenus/portaudioReceiveRange "0 Acer H6517ST (out: 2 in: 0 Core Audio)|3 Audiofuse Studio (out: 18 in: 20 Core Audio)|4 BlackHole 16ch (out: 16 in: 16 Core Audio)|5 BlackHole 2ch (out: 2 in: 2 Core Audio)|7 MacBook ProLautsprecher (out: 2 in: 0 Core Audio)|10 ESS (out: 34 in: 36 Core Audio)"
SCRIPT_RX: mqtt /peer/d7L5RMzRV8QYD5ASA8YPFS/settings/localMenus/coreaudioReceiveRange "62 BlackHole 16ch|78 BlackHole 2ch|94 BlackHole 64ch|154 MacBook Pro-Lautsprecher|110 Microsoft Teams Audio|128 ZoomAudioDevice|58 Hauptgeraet"
SCRIPT_RX: mqtt /peer/d7L5RMzRV8QYD5ASA8YPFS/settings/localMenus/wasapiReceiveRange 0
SCRIPT_RX: mqtt /peer/d7L5RMzRV8QYD5ASA8YPFS/settings/localMenus/jackReceiveRange 0
SCRIPT_RX: mqtt /peer/d7L5RMzRV8QYD5ASA8YPFS/settings/localProps/ug_enable 1
SCRIPT_RX: mqtt /peer/d7L5RMzRV8QYD5ASA8YPFS/settings/localProps/natnet_enable 0
SCRIPT_TX: subscribe /peer/8daALfn1eUNDWTkadizbBY/settings/#
SCRIPT_TX: subscribe /peer/8daALfn1eUNDWTkadizbBY/rack/+/+/loaded
SCRIPT_RX: mqtt /peer/8daALfn1eUNDWTkadizbBY/settings/lock/enable 0
SCRIPT_RX: mqtt /peer/8daALfn1eUNDWTkadizbBY/settings/background/color "0.4510 0.8200 0.2800 1"
SCRIPT_RX: mqtt /peer/8daALfn1eUNDWTkadizbBY/settings/localMenus/textureCaptureRange -default-
SCRIPT_RX: mqtt /peer/8daALfn1eUNDWTkadizbBY/settings/localMenus/ndiRange -default-
SCRIPT_RX: mqtt /peer/8daALfn1eUNDWTkadizbBY/settings/localMenus/portaudioCaptureRange 0
SCRIPT_RX: mqtt /peer/8daALfn1eUNDWTkadizbBY/settings/localMenus/coreaudioCaptureRange 0
SCRIPT_RX: mqtt /peer/8daALfn1eUNDWTkadizbBY/settings/localMenus/wasapiCaptureRange 0
SCRIPT_RX: mqtt /peer/8daALfn1eUNDWTkadizbBY/settings/localMenus/jackCaptureRange 0
SCRIPT_RX: mqtt /peer/8daALfn1eUNDWTkadizbBY/settings/localMenus/portaudioReceiveRange 0
SCRIPT_RX: mqtt /peer/8daALfn1eUNDWTkadizbBY/settings/localMenus/coreaudioReceiveRange 0
SCRIPT_RX: mqtt /peer/8daALfn1eUNDWTkadizbBY/settings/localMenus/wasapiReceiveRange 0
SCRIPT_RX: mqtt /peer/8daALfn1eUNDWTkadizbBY/settings/localMenus/jackReceiveRange 0
SCRIPT_RX: mqtt /peer/8daALfn1eUNDWTkadizbBY/settings/localProps/ug_enable 0
SCRIPT_RX: mqtt /peer/8daALfn1eUNDWTkadizbBY/settings/localProps/natnet_enable 0
SCRIPT_RX: mqtt /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.0/loaded 1
SCRIPT_RX: mqtt /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.1/loaded 0
SCRIPT_RX: mqtt /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.2/loaded 0
SCRIPT_RX: mqtt /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.3/loaded 0
SCRIPT_RX: mqtt /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.4/loaded 0
SCRIPT_RX: mqtt /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.5/loaded 1
SCRIPT_RX: mqtt /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.6/loaded 0
SCRIPT_RX: mqtt /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.7/loaded 0
SCRIPT_RX: mqtt /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.8/loaded 0
SCRIPT_RX: mqtt /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.9/loaded 0
SCRIPT_RX: mqtt /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.10/loaded 0
SCRIPT_RX: mqtt /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.11/loaded 0
SCRIPT_RX: mqtt /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.12/loaded 1
SCRIPT_RX: mqtt /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.13/loaded 0
SCRIPT_RX: mqtt /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.14/loaded 0
SCRIPT_RX: mqtt /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.15/loaded 0
SCRIPT_RX: mqtt /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.16/loaded 0
SCRIPT_RX: mqtt /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.17/loaded 0
SCRIPT_RX: mqtt /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.18/loaded 0
SCRIPT_RX: mqtt /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.19/loaded 0
SCRIPT_TX: subscribe /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.0/device/#
SCRIPT_TX: subscribe /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.5/device/#
SCRIPT_TX: subscribe /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.12/device/#
SCRIPT_RX: mqtt /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.0/device/gui/localudp/peerLocalIP 192.168.1.101
SCRIPT_RX: mqtt /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.0/device/gui/localudp/enableTwo 0
SCRIPT_RX: mqtt /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.0/device/gui/localudp/inputPort 10009
SCRIPT_RX: mqtt /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.0/device/gui/localudp/outputIPOne 192.168.1.101
SCRIPT_RX: mqtt /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.0/device/gui/localudp/outputIPTwo 192.168.1.101
SCRIPT_RX: mqtt /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.0/device/gui/localudp/outputPortOne 10008
SCRIPT_RX: mqtt /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.0/device/gui/localudp/outputPortTwo 10007
SCRIPT_RX: mqtt /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.0/device/gui/localudp/reset 0
SCRIPT_RX: mqtt /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.0/device/gui/monitor/log 0
SCRIPT_RX: mqtt /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.0/device/gui/monitor/monitorGate 0
SCRIPT_RX: mqtt /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.0/device/gui/description OSC
SCRIPT_RX: mqtt /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.0/device/gui/enable 0
SCRIPT_RX: mqtt /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.0/device/gui/inputIndicator 0
SCRIPT_RX: mqtt /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.0/device/gui/outputIndicator 0
SCRIPT_RX: mqtt /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.5/device/gui/localudp/peerLocalIP 192.168.1.101
SCRIPT_RX: mqtt /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.5/device/gui/localudp/enableTwo 0
SCRIPT_RX: mqtt /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.5/device/gui/localudp/inputPort 10059
SCRIPT_RX: mqtt /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.5/device/gui/localudp/outputIPOne 192.168.1.101
SCRIPT_RX: mqtt /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.5/device/gui/localudp/outputIPTwo 192.168.1.101
SCRIPT_RX: mqtt /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.5/device/gui/localudp/outputPortOne 10058
SCRIPT_RX: mqtt /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.5/device/gui/localudp/outputPortTwo 10057
SCRIPT_RX: mqtt /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.5/device/gui/localudp/reset 0
SCRIPT_RX: mqtt /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.5/device/gui/monitor/log 0
SCRIPT_RX: mqtt /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.5/device/gui/monitor/monitorGate 0
SCRIPT_RX: mqtt /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.5/device/gui/description OSC
SCRIPT_RX: mqtt /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.5/device/gui/enable 0
SCRIPT_RX: mqtt /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.5/device/gui/inputIndicator 0
SCRIPT_RX: mqtt /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.5/device/gui/outputIndicator 0
SCRIPT_RX: mqtt /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.12/device/gui/localudp/peerLocalIP 192.168.1.101
SCRIPT_RX: mqtt /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.12/device/gui/localudp/enableTwo 0
SCRIPT_RX: mqtt /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.12/device/gui/localudp/inputPort 10129
SCRIPT_RX: mqtt /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.12/device/gui/localudp/outputIPOne 192.168.1.101
SCRIPT_RX: mqtt /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.12/device/gui/localudp/outputIPTwo 192.168.1.101
SCRIPT_RX: mqtt /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.12/device/gui/localudp/outputPortOne 10128
SCRIPT_RX: mqtt /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.12/device/gui/localudp/outputPortTwo 10127
SCRIPT_RX: mqtt /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.12/device/gui/localudp/reset 0
SCRIPT_RX: mqtt /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.12/device/gui/monitor/log 0
SCRIPT_RX: mqtt /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.12/device/gui/monitor/monitorGate 0
SCRIPT_RX: mqtt /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.12/device/gui/description OSC
SCRIPT_RX: mqtt /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.12/device/gui/enable 0
SCRIPT_RX: mqtt /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.12/device/gui/inputIndicator 0
SCRIPT_RX: mqtt /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.12/device/gui/outputIndicator 0


**NG log excerpt (peer:remote:joined + subsequent RECVs):**
```
[18:48:20.832] SUB   /peer/d7L5RMzRV8QYD5ASA8YPFS/#
[18:48:21.859] RECV  /peer/d7L5RMzRV8QYD5ASA8YPFS/rack/page_0/channel.0/loaded 0
[18:48:21.861] RECV  /peer/d7L5RMzRV8QYD5ASA8YPFS/rack/page_0/channel.1/loaded 0
[18:48:21.861] RECV  /peer/d7L5RMzRV8QYD5ASA8YPFS/rack/page_0/channel.2/loaded 0
[18:48:21.861] RECV  /peer/d7L5RMzRV8QYD5ASA8YPFS/rack/page_0/channel.3/loaded 0
[18:48:21.861] RECV  /peer/d7L5RMzRV8QYD5ASA8YPFS/rack/page_0/channel.4/loaded 0
[18:48:21.861] RECV  /peer/d7L5RMzRV8QYD5ASA8YPFS/rack/page_0/channel.5/loaded 0
[18:48:21.861] RECV  /peer/d7L5RMzRV8QYD5ASA8YPFS/rack/page_0/channel.6/loaded 0
[18:48:21.861] RECV  /peer/d7L5RMzRV8QYD5ASA8YPFS/rack/page_0/channel.7/loaded 0
[18:48:21.861] RECV  /peer/d7L5RMzRV8QYD5ASA8YPFS/rack/page_0/channel.8/loaded 0
[18:48:21.862] RECV  /peer/d7L5RMzRV8QYD5ASA8YPFS/rack/page_0/channel.9/loaded 0
[18:48:21.862] RECV  /peer/d7L5RMzRV8QYD5ASA8YPFS/rack/page_0/channel.10/loaded 0
[18:48:21.862] RECV  /peer/d7L5RMzRV8QYD5ASA8YPFS/rack/page_0/channel.11/loaded 0
[18:48:21.862] RECV  /peer/d7L5RMzRV8QYD5ASA8YPFS/rack/page_0/channel.12/loaded 0
[18:48:21.862] RECV  /peer/d7L5RMzRV8QYD5ASA8YPFS/rack/page_0/channel.13/loaded 0
[18:48:21.862] RECV  /peer/d7L5RMzRV8QYD5ASA8YPFS/rack/page_0/channel.14/loaded 0
[18:48:21.862] RECV  /peer/d7L5RMzRV8QYD5ASA8YPFS/rack/page_0/channel.15/loaded 0
[18:48:21.862] RECV  /peer/d7L5RMzRV8QYD5ASA8YPFS/rack/page_0/channel.16/loaded 0
[18:48:21.862] RECV  /peer/d7L5RMzRV8QYD5ASA8YPFS/rack/page_0/channel.17/loaded 0
[18:48:21.862] RECV  /peer/d7L5RMzRV8QYD5ASA8YPFS/rack/page_0/channel.18/loaded 0
[18:48:21.862] RECV  /peer/d7L5RMzRV8QYD5ASA8YPFS/rack/page_0/channel.19/loaded 0
[18:48:21.862] RECV  /peer/d7L5RMzRV8QYD5ASA8YPFS/settings/lock/enable 0
[18:48:21.862] RECV  /peer/d7L5RMzRV8QYD5ASA8YPFS/settings/background/color 0.712544202804565 0.393754065036774 0.666099011898041 1
[18:48:21.862] RECV  /peer/d7L5RMzRV8QYD5ASA8YPFS/settings/localMenus/textureCaptureRange -default-
[18:48:21.862] RECV  /peer/d7L5RMzRV8QYD5ASA8YPFS/settings/localMenus/ndiRange -default-
[18:48:21.862] RECV  /peer/d7L5RMzRV8QYD5ASA8YPFS/settings/localMenus/portaudioCaptureRange 1 Scarlett 18i8 USB (out: 8 in: 18 Core Audio)|2 NDI Audio (out: 0 in: 2 Core Audio)|3 BlackHole 16ch (out: 16 in: 16 Core Audio)|4 BlackHole 2ch (out: 2 in: 2 Core Audio)|5 MacBook ProMikrofon (out: 0 in: 1 Core Audio)|9 ess (out: 24 in: 34 Core Audio)
[18:48:21.863] RECV  /peer/d7L5RMzRV8QYD5ASA8YPFS/settings/localMenus/coreaudioCaptureRange 62 BlackHole 16ch|78 BlackHole 2ch|94 BlackHole 64ch|161 MacBook Pro-Mikrofon|110 Microsoft Teams Audio|128 ZoomAudioDevice|58 Hauptgeraet
[18:48:21.863] RECV  /peer/d7L5RMzRV8QYD5ASA8YPFS/settings/localMenus/wasapiCaptureRange 0
[18:48:21.863] RECV  /peer/d7L5RMzRV8QYD5ASA8YPFS/settings/localMenus/jackCaptureRange 0
[18:48:21.863] RECV  /peer/d7L5RMzRV8QYD5ASA8YPFS/settings/localMenus/portaudioReceiveRange 0 Acer H6517ST (out: 2 in: 0 Core Audio)|3 Audiofuse Studio (out: 18 in: 20 Core Audio)|4 BlackHole 16ch (out: 16 in: 16 Core Audio)|5 BlackHole 2ch (out: 2 in: 2 Core Audio)|7 MacBook ProLautsprecher (out: 2 in: 0 Core Audio)|10 ESS (out: 34 in: 36 Core Audio)
[18:48:21.863] RECV  /peer/d7L5RMzRV8QYD5ASA8YPFS/settings/localMenus/coreaudioReceiveRange 62 BlackHole 16ch|78 BlackHole 2ch|94 BlackHole 64ch|154 MacBook Pro-Lautsprecher|110 Microsoft Teams Audio|128 ZoomAudioDevice|58 Hauptgeraet
[18:48:21.863] RECV  /peer/d7L5RMzRV8QYD5ASA8YPFS/settings/localMenus/wasapiReceiveRange 0
[18:48:21.863] RECV  /peer/d7L5RMzRV8QYD5ASA8YPFS/settings/localMenus/jackReceiveRange 0
[18:48:21.863] RECV  /peer/d7L5RMzRV8QYD5ASA8YPFS/settings/localProps/ug_enable 1
[18:48:21.863] RECV  /peer/d7L5RMzRV8QYD5ASA8YPFS/settings/localProps/natnet_enable 0
```

---

## Case 4 — Create OSC device on NG (channel 0, type 1)

**Steps:**
1. On NG matrix, click `+` on the local peer's channel 0 cell.
2. The cell should show an OSC device icon after a moment.

**Expected on NG:**
- Log shows `PUB r /peer/<localId>/rack/channel.0/loaded 1`.
- Log shows the echo RECV.
- `DeviceRouter` publishes defaults: 14 topics under `.../channel.0/device/{localudp,monitor,gui}/...`.
- Log shows `SUB /peer/<localId>/rack/channel.0/device/#` (redundant with wide pattern, but should appear).
- Cell renders with OSC device-type color (`#36ABFF`) and data-flow icon.

**Expected on Max:**
- Max's matrix row for NG shows channel 0 occupied (OSC).
- Max receives and displays the device defaults.

**Result:** `<fill in>`

**NG log excerpt (loaded publish + defaults):**
```
[18:49:02.235] PUB r /peer/85h1csrEkfdCVQmdYom2ZM/rack/page_0/channel.0/loaded 1
[18:49:02.244] RECV  /peer/85h1csrEkfdCVQmdYom2ZM/rack/page_0/channel.0/loaded 1
[18:49:02.245] PUB r /peer/85h1csrEkfdCVQmdYom2ZM/rack/page_0/channel.0/device/gui/localudp/peerLocalIP 192.168.1.101
[18:49:02.245] PUB r /peer/85h1csrEkfdCVQmdYom2ZM/rack/page_0/channel.0/device/gui/localudp/enableTwo 0
[18:49:02.245] PUB r /peer/85h1csrEkfdCVQmdYom2ZM/rack/page_0/channel.0/device/gui/localudp/inputPort 10009
[18:49:02.245] PUB r /peer/85h1csrEkfdCVQmdYom2ZM/rack/page_0/channel.0/device/gui/localudp/outputIPOne 192.168.1.101
[18:49:02.245] PUB r /peer/85h1csrEkfdCVQmdYom2ZM/rack/page_0/channel.0/device/gui/localudp/outputIPTwo 192.168.1.101
[18:49:02.245] PUB r /peer/85h1csrEkfdCVQmdYom2ZM/rack/page_0/channel.0/device/gui/localudp/outputPortOne 10008
[18:49:02.245] PUB r /peer/85h1csrEkfdCVQmdYom2ZM/rack/page_0/channel.0/device/gui/localudp/outputPortTwo 10007
[18:49:02.245] PUB r /peer/85h1csrEkfdCVQmdYom2ZM/rack/page_0/channel.0/device/gui/localudp/reset 0
[18:49:02.245] PUB r /peer/85h1csrEkfdCVQmdYom2ZM/rack/page_0/channel.0/device/gui/monitor/log 0
[18:49:02.245] PUB r /peer/85h1csrEkfdCVQmdYom2ZM/rack/page_0/channel.0/device/gui/monitor/monitorGate 0
[18:49:02.245] PUB r /peer/85h1csrEkfdCVQmdYom2ZM/rack/page_0/channel.0/device/gui/description OSC
[18:49:02.245] PUB r /peer/85h1csrEkfdCVQmdYom2ZM/rack/page_0/channel.0/device/gui/enable 0
[18:49:02.245] PUB r /peer/85h1csrEkfdCVQmdYom2ZM/rack/page_0/channel.0/device/gui/inputIndicator 0
[18:49:02.245] PUB r /peer/85h1csrEkfdCVQmdYom2ZM/rack/page_0/channel.0/device/gui/outputIndicator 0
[18:49:02.245] SUB   /peer/85h1csrEkfdCVQmdYom2ZM/rack/page_0/channel.0/device/#
[18:49:02.249] RECV  /peer/85h1csrEkfdCVQmdYom2ZM/rack/page_0/channel.0/device/gui/localudp/peerLocalIP 192.168.1.101
[18:49:02.249] RECV  /peer/85h1csrEkfdCVQmdYom2ZM/rack/page_0/channel.0/device/gui/localudp/enableTwo 0
[18:49:02.250] RECV  /peer/85h1csrEkfdCVQmdYom2ZM/rack/page_0/channel.0/device/gui/localudp/inputPort 10009
[18:49:02.250] RECV  /peer/85h1csrEkfdCVQmdYom2ZM/rack/page_0/channel.0/device/gui/localudp/outputIPOne 192.168.1.101
[18:49:02.250] RECV  /peer/85h1csrEkfdCVQmdYom2ZM/rack/page_0/channel.0/device/gui/localudp/outputIPTwo 192.168.1.101
[18:49:02.250] RECV  /peer/85h1csrEkfdCVQmdYom2ZM/rack/page_0/channel.0/device/gui/localudp/outputPortOne 10008
[18:49:02.250] RECV  /peer/85h1csrEkfdCVQmdYom2ZM/rack/page_0/channel.0/device/gui/localudp/outputPortTwo 10007
[18:49:02.250] RECV  /peer/85h1csrEkfdCVQmdYom2ZM/rack/page_0/channel.0/device/gui/localudp/reset 0
[18:49:02.250] RECV  /peer/85h1csrEkfdCVQmdYom2ZM/rack/page_0/channel.0/device/gui/monitor/log 0
[18:49:02.250] RECV  /peer/85h1csrEkfdCVQmdYom2ZM/rack/page_0/channel.0/device/gui/monitor/monitorGate 0
[18:49:02.250] RECV  /peer/85h1csrEkfdCVQmdYom2ZM/rack/page_0/channel.0/device/gui/description OSC
[18:49:02.250] RECV  /peer/85h1csrEkfdCVQmdYom2ZM/rack/page_0/channel.0/device/gui/enable 0
[18:49:02.250] RECV  /peer/85h1csrEkfdCVQmdYom2ZM/rack/page_0/channel.0/device/gui/inputIndicator 0
[18:49:02.250] RECV  /peer/85h1csrEkfdCVQmdYom2ZM/rack/page_0/channel.0/device/gui/outputIndicator 0
[18:49:02.250] RECV  /peer/85h1csrEkfdCVQmdYom2ZM/rack/page_0/channel.0/device/gui/localudp/peerLocalIP 192.168.1.101
[18:49:02.250] RECV  /peer/85h1csrEkfdCVQmdYom2ZM/rack/page_0/channel.0/device/gui/localudp/reset 0
[18:49:02.250] RECV  /peer/85h1csrEkfdCVQmdYom2ZM/rack/page_0/channel.0/device/gui/localudp/enableTwo 0
[18:49:02.250] RECV  /peer/85h1csrEkfdCVQmdYom2ZM/rack/page_0/channel.0/device/gui/localudp/inputPort 10009
[18:49:02.250] RECV  /peer/85h1csrEkfdCVQmdYom2ZM/rack/page_0/channel.0/device/gui/localudp/outputIPOne 192.168.1.101
[18:49:02.250] RECV  /peer/85h1csrEkfdCVQmdYom2ZM/rack/page_0/channel.0/device/gui/localudp/outputIPTwo 192.168.1.101
[18:49:02.250] RECV  /peer/85h1csrEkfdCVQmdYom2ZM/rack/page_0/channel.0/device/gui/localudp/outputPortOne 10008
[18:49:02.250] RECV  /peer/85h1csrEkfdCVQmdYom2ZM/rack/page_0/channel.0/device/gui/localudp/outputPortTwo 10007
[18:49:02.250] RECV  /peer/85h1csrEkfdCVQmdYom2ZM/rack/page_0/channel.0/device/gui/monitor/log 0
[18:49:02.253] RECV  /peer/85h1csrEkfdCVQmdYom2ZM/rack/page_0/channel.0/device/gui/monitor/monitorGate 0
[18:49:02.253] RECV  /peer/85h1csrEkfdCVQmdYom2ZM/rack/page_0/channel.0/device/gui/description OSC
[18:49:02.253] RECV  /peer/85h1csrEkfdCVQmdYom2ZM/rack/page_0/channel.0/device/gui/enable 0
[18:49:02.253] RECV  /peer/85h1csrEkfdCVQmdYom2ZM/rack/page_0/channel.0/device/gui/inputIndicator 0
[18:49:02.253] RECV  /peer/85h1csrEkfdCVQmdYom2ZM/rack/page_0/channel.0/device/gui/outputIndicator 0
[18:49:02.292] RECV  /peer/85h1csrEkfdCVQmdYom2ZM/rack/page_0/channel.0/device/gui/localudp/enableTwo 0
[18:49:02.293] RECV  /peer/85h1csrEkfdCVQmdYom2ZM/rack/page_0/channel.0/device/gui/localudp/inputPort 10009
[18:49:02.293] RECV  /peer/85h1csrEkfdCVQmdYom2ZM/rack/page_0/channel.0/device/gui/localudp/outputIPOne 0
[18:49:02.293] RECV  /peer/85h1csrEkfdCVQmdYom2ZM/rack/page_0/channel.0/device/gui/localudp/outputIPTwo 0
[18:49:02.293] RECV  /peer/85h1csrEkfdCVQmdYom2ZM/rack/page_0/channel.0/device/gui/localudp/outputPortOne 10008
[18:49:02.293] RECV  /peer/85h1csrEkfdCVQmdYom2ZM/rack/page_0/channel.0/device/gui/localudp/outputPortTwo 10007
[18:49:02.293] RECV  /peer/85h1csrEkfdCVQmdYom2ZM/rack/page_0/channel.0/device/gui/localudp/reset 0
[18:49:02.293] RECV  /peer/85h1csrEkfdCVQmdYom2ZM/rack/page_0/channel.0/device/gui/localudp/reset 1
[18:49:02.293] RECV  /peer/85h1csrEkfdCVQmdYom2ZM/rack/page_0/channel.0/device/gui/localudp/outputPortTwo 10027
[18:49:02.293] RECV  /peer/85h1csrEkfdCVQmdYom2ZM/rack/page_0/channel.0/device/gui/localudp/outputPortOne 10028
[18:49:02.293] RECV  /peer/85h1csrEkfdCVQmdYom2ZM/rack/page_0/channel.0/device/gui/localudp/inputPort 10029
[18:49:02.293] RECV  /peer/85h1csrEkfdCVQmdYom2ZM/rack/page_0/channel.0/device/gui/localudp/peerLocalIP 0
[18:49:02.295] RECV  /peer/85h1csrEkfdCVQmdYom2ZM/rack/page_0/channel.0/device/gui/localudp/peerLocalIP 0
[18:49:02.295] RECV  /peer/85h1csrEkfdCVQmdYom2ZM/rack/page_0/channel.0/device/gui/localudp/outputPortTwo 10007
[18:49:02.295] RECV  /peer/85h1csrEkfdCVQmdYom2ZM/rack/page_0/channel.0/device/gui/localudp/outputPortOne 10008
[18:49:02.295] RECV  /peer/85h1csrEkfdCVQmdYom2ZM/rack/page_0/channel.0/device/gui/localudp/inputPort 10009
[18:49:02.295] RECV  /peer/85h1csrEkfdCVQmdYom2ZM/rack/page_0/channel.0/device/gui/monitor/log 0
[18:49:02.295] RECV  /peer/85h1csrEkfdCVQmdYom2ZM/rack/page_0/channel.0/device/gui/monitor/log 0
[18:49:02.342] RECV  /peer/85h1csrEkfdCVQmdYom2ZM/rack/page_0/channel.0/device/gui/monitor/monitorGate 0
[18:49:02.346] RECV  /peer/85h1csrEkfdCVQmdYom2ZM/rack/page_0/channel.0/device/gui/description OSC
[18:49:02.346] RECV  /peer/85h1csrEkfdCVQmdYom2ZM/rack/page_0/channel.0/device/gui/enable 0
[18:49:02.346] RECV  /peer/85h1csrEkfdCVQmdYom2ZM/rack/page_0/channel.0/device/gui/inputIndicator 0
[18:49:02.346] RECV  /peer/85h1csrEkfdCVQmdYom2ZM/rack/page_0/channel.0/device/gui/outputIndicator 0
```

---

## Case 5 — Configure OSC device on NG

**Steps:**
1. On NG, click channel 0 of the local peer. The OscPanel drawer opens.
2. Set Description to `NG-test`. Set Forward-to IP to `127.0.0.1`, port 9000. Set Input port as shown.
3. Toggle enable ON.

**Expected on NG:**
- Log shows `PUB r` lines for each field edit (description, outputIPOne, outputPortOne, inputPort, enable).
- Echo RECVs for each.
- `enable=1` locks the panel controls (per spec §5.3).

**Expected on Max:**
- Max's view of NG's channel 0 updates to match.

**Result:** `<fill in>`

**NG log excerpt (field edits + enable):**
```
[19:03:00.572] PUB r /peer/d7L5RMzRV8QYD5ASA8YPFS/rack/page_0/channel.0/loaded 0
[19:03:00.577] RECV  /peer/d7L5RMzRV8QYD5ASA8YPFS/rack/page_0/channel.0/loaded 0
[19:03:01.365] PUB r /peer/d7L5RMzRV8QYD5ASA8YPFS/rack/page_0/channel.0/loaded 1
[19:03:01.372] RECV  /peer/d7L5RMzRV8QYD5ASA8YPFS/rack/page_0/channel.0/loaded 1
[19:03:01.441] RECV  /peer/d7L5RMzRV8QYD5ASA8YPFS/rack/page_0/channel.0/device/gui/localudp/peerLocalIP 0
[19:03:01.442] RECV  /peer/d7L5RMzRV8QYD5ASA8YPFS/rack/page_0/channel.0/device/gui/localudp/peerLocalIP 0
[19:03:01.442] RECV  /peer/d7L5RMzRV8QYD5ASA8YPFS/rack/page_0/channel.0/device/gui/localudp/enableTwo 0
[19:03:01.442] RECV  /peer/d7L5RMzRV8QYD5ASA8YPFS/rack/page_0/channel.0/device/gui/localudp/inputPort 10009
[19:03:01.442] RECV  /peer/d7L5RMzRV8QYD5ASA8YPFS/rack/page_0/channel.0/device/gui/localudp/outputIPOne 0
[19:03:01.442] RECV  /peer/d7L5RMzRV8QYD5ASA8YPFS/rack/page_0/channel.0/device/gui/localudp/outputIPTwo 0
[19:03:01.442] RECV  /peer/d7L5RMzRV8QYD5ASA8YPFS/rack/page_0/channel.0/device/gui/localudp/outputPortOne 10008
[19:03:01.442] RECV  /peer/d7L5RMzRV8QYD5ASA8YPFS/rack/page_0/channel.0/device/gui/localudp/outputPortTwo 10007
[19:03:01.442] RECV  /peer/d7L5RMzRV8QYD5ASA8YPFS/rack/page_0/channel.0/device/gui/localudp/reset 0
[19:03:01.442] RECV  /peer/d7L5RMzRV8QYD5ASA8YPFS/rack/page_0/channel.0/device/gui/localudp/reset 1
[19:03:01.442] RECV  /peer/d7L5RMzRV8QYD5ASA8YPFS/rack/page_0/channel.0/device/gui/localudp/outputPortTwo 10027
[19:03:01.442] RECV  /peer/d7L5RMzRV8QYD5ASA8YPFS/rack/page_0/channel.0/device/gui/localudp/outputPortOne 10028
[19:03:01.445] RECV  /peer/d7L5RMzRV8QYD5ASA8YPFS/rack/page_0/channel.0/device/gui/localudp/inputPort 10029
[19:03:01.445] RECV  /peer/d7L5RMzRV8QYD5ASA8YPFS/rack/page_0/channel.0/device/gui/localudp/outputPortTwo 10007
[19:03:01.445] RECV  /peer/d7L5RMzRV8QYD5ASA8YPFS/rack/page_0/channel.0/device/gui/localudp/outputPortOne 10008
[19:03:01.445] RECV  /peer/d7L5RMzRV8QYD5ASA8YPFS/rack/page_0/channel.0/device/gui/localudp/inputPort 10009
[19:03:01.487] RECV  /peer/d7L5RMzRV8QYD5ASA8YPFS/rack/page_0/channel.0/device/gui/monitor/monitorGate 0
[19:03:01.491] RECV  /peer/d7L5RMzRV8QYD5ASA8YPFS/rack/page_0/channel.0/device/gui/monitor/log 0
[19:03:01.491] RECV  /peer/d7L5RMzRV8QYD5ASA8YPFS/rack/page_0/channel.0/device/gui/monitor/log 0
[19:03:01.491] RECV  /peer/d7L5RMzRV8QYD5ASA8YPFS/rack/page_0/channel.0/device/gui/description OSC
[19:03:01.491] RECV  /peer/d7L5RMzRV8QYD5ASA8YPFS/rack/page_0/channel.0/device/gui/enable 0
[19:03:01.491] RECV  /peer/d7L5RMzRV8QYD5ASA8YPFS/rack/page_0/channel.0/device/gui/inputIndicator 0
[19:03:01.491] RECV  /peer/d7L5RMzRV8QYD5ASA8YPFS/rack/page_0/channel.0/device/gui/outputIndicator 0
[19:03:01.491] RECV  /peer/d7L5RMzRV8QYD5ASA8YPFS/rack/page_0/channel.0/device/gui/localudp/peerLocalIP 10.18.152.229
[19:03:01.491] RECV  /peer/d7L5RMzRV8QYD5ASA8YPFS/rack/page_0/channel.0/device/gui/localudp/outputIPTwo 10.18.152.229
[19:03:01.491] RECV  /peer/d7L5RMzRV8QYD5ASA8YPFS/rack/page_0/channel.0/device/gui/localudp/outputIPOne 10.18.152.229
[19:03:15.471] PUB r /peer/d7L5RMzRV8QYD5ASA8YPFS/rack/page_0/channel.0/device/gui/localudp/outputIPOne 127.0.0.1
[19:03:15.475] RECV  /peer/d7L5RMzRV8QYD5ASA8YPFS/rack/page_0/channel.0/device/gui/localudp/outputIPOne 127.0.0.1
[19:03:26.455] PUB r /peer/d7L5RMzRV8QYD5ASA8YPFS/rack/page_0/channel.0/device/gui/localudp/outputPortOne 9000
[19:03:26.462] RECV  /peer/d7L5RMzRV8QYD5ASA8YPFS/rack/page_0/channel.0/device/gui/localudp/outputPortOne 9000
[19:04:07.073] PUB r /peer/d7L5RMzRV8QYD5ASA8YPFS/rack/page_0/channel.0/device/gui/enable 1
[19:04:07.083] RECV  /peer/d7L5RMzRV8QYD5ASA8YPFS/rack/page_0/channel.0/device/gui/enable 1
```

---

## Case 6 — Disable then remove OSC device on NG

**Steps:**
1. With NG's channel 0 enabled, toggle enable OFF in the panel.
2. Click `-` (or whatever the remove affordance is) on the matrix cell.

**Expected on NG:**
- Log shows `PUB r .../device/udp/enable 0` then, on remove, `PUB r .../loaded 0`.
- DeviceRouter unloads: publishes empty-string retained messages for every tracked topic of that channel.
- Log shows multiple `PUB r .../device/... (empty)` lines.
- Cell returns to empty.

**Expected on Max:**
- Max's view of NG's channel 0 clears.

**Result:** `<fill in>`

**NG log excerpt (unload cascade):**
```
[19:04:47.617] PUB r /peer/d7L5RMzRV8QYD5ASA8YPFS/rack/page_0/channel.0/device/gui/enable 0
[19:04:47.621] RECV  /peer/d7L5RMzRV8QYD5ASA8YPFS/rack/page_0/channel.0/device/gui/enable 0
[19:04:48.835] PUB r /peer/d7L5RMzRV8QYD5ASA8YPFS/rack/page_0/channel.0/loaded 0
[19:04:48.842] RECV  /peer/d7L5RMzRV8QYD5ASA8YPFS/rack/page_0/channel.0/loaded 0
```

---

## Case 7 — Max creates a device on NG's row (remote-origin)

**Steps:**
1. On Max, use its UI to create an OSC device on channel 3 of the *NG* peer row.

**Expected on NG:**
- Log shows `RECV /peer/<localId>/rack/channel.3/loaded 1` (note: originated externally, but arrives on a topic under our own peer id).
- DeviceRouter sees `parsed.peerId !== this.ownPeerId` is FALSE (same peer id), so this is treated as a local load.
  - **NOTE:** this is the "foreign publish into my own peer subtree" edge case. Behavior to verify:
    - Does NG's DeviceRouter instantiate a handler for this load?
    - Does the UDP relay start listening/forwarding?
    - Does the matrix cell render it?

**Result:** `<fill in>`

**NG log excerpt:**
```
[19:05:57.868] RECV  /peer/eAbeD2kacgQtQihdoa4H4u/rack/page_0/channel.3/device/gui/localudp/enableTwo 0
[19:05:57.872] RECV  /peer/eAbeD2kacgQtQihdoa4H4u/rack/page_0/channel.3/device/gui/localudp/inputPort 10039
[19:05:57.873] RECV  /peer/eAbeD2kacgQtQihdoa4H4u/rack/page_0/channel.3/device/gui/localudp/outputIPOne 0
[19:05:57.873] RECV  /peer/eAbeD2kacgQtQihdoa4H4u/rack/page_0/channel.3/device/gui/localudp/outputIPTwo 0
[19:05:57.873] RECV  /peer/eAbeD2kacgQtQihdoa4H4u/rack/page_0/channel.3/device/gui/localudp/outputPortOne 10038
[19:05:57.874] RECV  /peer/eAbeD2kacgQtQihdoa4H4u/rack/page_0/channel.3/device/gui/localudp/outputPortTwo 10037
[19:05:57.874] RECV  /peer/eAbeD2kacgQtQihdoa4H4u/rack/page_0/channel.3/device/gui/localudp/reset 0
[19:05:57.874] RECV  /peer/eAbeD2kacgQtQihdoa4H4u/rack/page_0/channel.3/device/gui/localudp/reset 1
[19:05:57.874] RECV  /peer/eAbeD2kacgQtQihdoa4H4u/rack/page_0/channel.3/device/gui/localudp/outputPortTwo 10027
[19:05:57.874] RECV  /peer/eAbeD2kacgQtQihdoa4H4u/rack/page_0/channel.3/device/gui/localudp/outputPortOne 10028
[19:05:57.874] RECV  /peer/eAbeD2kacgQtQihdoa4H4u/rack/page_0/channel.3/device/gui/localudp/inputPort 10029
[19:05:57.874] RECV  /peer/eAbeD2kacgQtQihdoa4H4u/rack/page_0/channel.3/device/gui/localudp/peerLocalIP 0
[19:05:57.874] RECV  /peer/eAbeD2kacgQtQihdoa4H4u/rack/page_0/channel.3/device/gui/localudp/peerLocalIP 0
[19:05:57.915] RECV  /peer/eAbeD2kacgQtQihdoa4H4u/rack/page_0/channel.3/device/gui/localudp/outputPortTwo 10037
[19:05:57.920] RECV  /peer/eAbeD2kacgQtQihdoa4H4u/rack/page_0/channel.3/device/gui/localudp/outputPortOne 10038
[19:05:57.920] RECV  /peer/eAbeD2kacgQtQihdoa4H4u/rack/page_0/channel.3/device/gui/localudp/inputPort 10039
[19:05:57.920] RECV  /peer/eAbeD2kacgQtQihdoa4H4u/rack/page_0/channel.3/device/gui/monitor/log 0
[19:05:57.920] RECV  /peer/eAbeD2kacgQtQihdoa4H4u/rack/page_0/channel.3/device/gui/monitor/log 0
[19:05:57.920] RECV  /peer/eAbeD2kacgQtQihdoa4H4u/rack/page_0/channel.3/device/gui/monitor/monitorGate 0
[19:05:57.920] RECV  /peer/eAbeD2kacgQtQihdoa4H4u/rack/page_0/channel.3/device/gui/description OSC
[19:05:57.920] RECV  /peer/eAbeD2kacgQtQihdoa4H4u/rack/page_0/channel.3/device/gui/enable 0
[19:05:57.920] RECV  /peer/eAbeD2kacgQtQihdoa4H4u/rack/page_0/channel.3/device/gui/inputIndicator 0
[19:05:57.920] RECV  /peer/eAbeD2kacgQtQihdoa4H4u/rack/page_0/channel.3/device/gui/outputIndicator 0
[19:05:57.920] RECV  /peer/eAbeD2kacgQtQihdoa4H4u/rack/page_0/channel.3/loaded 1
[19:05:57.920] PUB r /peer/eAbeD2kacgQtQihdoa4H4u/rack/page_0/channel.3/device/gui/localudp/peerLocalIP 192.168.1.101
[19:05:57.920] PUB r /peer/eAbeD2kacgQtQihdoa4H4u/rack/page_0/channel.3/device/gui/localudp/enableTwo 0
[19:05:57.920] PUB r /peer/eAbeD2kacgQtQihdoa4H4u/rack/page_0/channel.3/device/gui/localudp/inputPort 10039
[19:05:57.920] PUB r /peer/eAbeD2kacgQtQihdoa4H4u/rack/page_0/channel.3/device/gui/localudp/outputIPOne 192.168.1.101
[19:05:57.920] PUB r /peer/eAbeD2kacgQtQihdoa4H4u/rack/page_0/channel.3/device/gui/localudp/outputIPTwo 192.168.1.101
[19:05:57.920] PUB r /peer/eAbeD2kacgQtQihdoa4H4u/rack/page_0/channel.3/device/gui/localudp/outputPortOne 10038
[19:05:57.920] PUB r /peer/eAbeD2kacgQtQihdoa4H4u/rack/page_0/channel.3/device/gui/localudp/outputPortTwo 10037
[19:05:57.920] PUB r /peer/eAbeD2kacgQtQihdoa4H4u/rack/page_0/channel.3/device/gui/localudp/reset 0
[19:05:57.920] PUB r /peer/eAbeD2kacgQtQihdoa4H4u/rack/page_0/channel.3/device/gui/monitor/log 0
[19:05:57.920] PUB r /peer/eAbeD2kacgQtQihdoa4H4u/rack/page_0/channel.3/device/gui/monitor/monitorGate 0
[19:05:57.920] PUB r /peer/eAbeD2kacgQtQihdoa4H4u/rack/page_0/channel.3/device/gui/description OSC
[19:05:57.920] PUB r /peer/eAbeD2kacgQtQihdoa4H4u/rack/page_0/channel.3/device/gui/enable 0
[19:05:57.920] PUB r /peer/eAbeD2kacgQtQihdoa4H4u/rack/page_0/channel.3/device/gui/inputIndicator 0
[19:05:57.920] PUB r /peer/eAbeD2kacgQtQihdoa4H4u/rack/page_0/channel.3/device/gui/outputIndicator 0
[19:05:57.920] SUB   /peer/eAbeD2kacgQtQihdoa4H4u/rack/page_0/channel.3/device/#
[19:05:57.925] RECV  /peer/eAbeD2kacgQtQihdoa4H4u/rack/page_0/channel.3/device/gui/localudp/peerLocalIP 192.168.1.101
[19:05:57.925] RECV  /peer/eAbeD2kacgQtQihdoa4H4u/rack/page_0/channel.3/device/gui/localudp/enableTwo 0
[19:05:57.925] RECV  /peer/eAbeD2kacgQtQihdoa4H4u/rack/page_0/channel.3/device/gui/localudp/inputPort 10039
[19:05:57.925] RECV  /peer/eAbeD2kacgQtQihdoa4H4u/rack/page_0/channel.3/device/gui/localudp/outputIPOne 192.168.1.101
[19:05:57.925] RECV  /peer/eAbeD2kacgQtQihdoa4H4u/rack/page_0/channel.3/device/gui/localudp/outputIPTwo 192.168.1.101
[19:05:57.925] RECV  /peer/eAbeD2kacgQtQihdoa4H4u/rack/page_0/channel.3/device/gui/localudp/outputPortOne 10038
[19:05:57.925] RECV  /peer/eAbeD2kacgQtQihdoa4H4u/rack/page_0/channel.3/device/gui/localudp/outputPortTwo 10037
[19:05:57.925] RECV  /peer/eAbeD2kacgQtQihdoa4H4u/rack/page_0/channel.3/device/gui/localudp/reset 0
[19:05:57.925] RECV  /peer/eAbeD2kacgQtQihdoa4H4u/rack/page_0/channel.3/device/gui/monitor/log 0
[19:05:57.925] RECV  /peer/eAbeD2kacgQtQihdoa4H4u/rack/page_0/channel.3/device/gui/monitor/monitorGate 0
[19:05:57.925] RECV  /peer/eAbeD2kacgQtQihdoa4H4u/rack/page_0/channel.3/device/gui/description OSC
[19:05:57.926] RECV  /peer/eAbeD2kacgQtQihdoa4H4u/rack/page_0/channel.3/device/gui/enable 0
[19:05:57.926] RECV  /peer/eAbeD2kacgQtQihdoa4H4u/rack/page_0/channel.3/device/gui/inputIndicator 0
[19:05:57.926] RECV  /peer/eAbeD2kacgQtQihdoa4H4u/rack/page_0/channel.3/device/gui/outputIndicator 0
[19:05:57.926] RECV  /peer/eAbeD2kacgQtQihdoa4H4u/rack/page_0/channel.3/device/gui/localudp/peerLocalIP 192.168.1.101
[19:05:57.926] RECV  /peer/eAbeD2kacgQtQihdoa4H4u/rack/page_0/channel.3/device/gui/localudp/enableTwo 0
[19:05:57.926] RECV  /peer/eAbeD2kacgQtQihdoa4H4u/rack/page_0/channel.3/device/gui/localudp/inputPort 10039
[19:05:57.926] RECV  /peer/eAbeD2kacgQtQihdoa4H4u/rack/page_0/channel.3/device/gui/localudp/outputIPOne 192.168.1.101
[19:05:57.926] RECV  /peer/eAbeD2kacgQtQihdoa4H4u/rack/page_0/channel.3/device/gui/localudp/outputIPTwo 192.168.1.101
[19:05:57.926] RECV  /peer/eAbeD2kacgQtQihdoa4H4u/rack/page_0/channel.3/device/gui/localudp/outputPortOne 10038
[19:05:57.926] RECV  /peer/eAbeD2kacgQtQihdoa4H4u/rack/page_0/channel.3/device/gui/localudp/outputPortTwo 10037
[19:05:57.926] RECV  /peer/eAbeD2kacgQtQihdoa4H4u/rack/page_0/channel.3/device/gui/localudp/reset 0
[19:05:57.926] RECV  /peer/eAbeD2kacgQtQihdoa4H4u/rack/page_0/channel.3/device/gui/monitor/log 0
[19:05:57.928] RECV  /peer/eAbeD2kacgQtQihdoa4H4u/rack/page_0/channel.3/device/gui/monitor/monitorGate 0
[19:05:57.928] RECV  /peer/eAbeD2kacgQtQihdoa4H4u/rack/page_0/channel.3/device/gui/description OSC
[19:05:57.928] RECV  /peer/eAbeD2kacgQtQihdoa4H4u/rack/page_0/channel.3/device/gui/enable 0
[19:05:57.928] RECV  /peer/eAbeD2kacgQtQihdoa4H4u/rack/page_0/channel.3/device/gui/inputIndicator 0
[19:05:57.928] RECV  /peer/eAbeD2kacgQtQihdoa4H4u/rack/page_0/channel.3/device/gui/outputIndicator 0
```

---

## Case 8 — NG creates a device, then Max creates one — verify isolation

**Steps:**
1. On NG, create OSC device on channel 5.
2. On Max, create OSC device on Max's own channel 5.

**Expected on NG:**
- Log shows NG's own publishes for its channel 5.
- Log shows RECVs for Max's channel 5 on the `/peer/<maxPeerId>/...` topic tree.
- Matrix shows both peers with channel 5 occupied independently.

**Result:** `<fill in>`

[19:06:34.918] PUB r /peer/eAbeD2kacgQtQihdoa4H4u/rack/page_0/channel.5/loaded 1
[19:06:34.924] RECV  /peer/eAbeD2kacgQtQihdoa4H4u/rack/page_0/channel.5/loaded 1
[19:06:34.924] PUB r /peer/eAbeD2kacgQtQihdoa4H4u/rack/page_0/channel.5/device/gui/localudp/peerLocalIP 192.168.1.101
[19:06:34.924] PUB r /peer/eAbeD2kacgQtQihdoa4H4u/rack/page_0/channel.5/device/gui/localudp/enableTwo 0
[19:06:34.924] PUB r /peer/eAbeD2kacgQtQihdoa4H4u/rack/page_0/channel.5/device/gui/localudp/inputPort 10059
[19:06:34.924] PUB r /peer/eAbeD2kacgQtQihdoa4H4u/rack/page_0/channel.5/device/gui/localudp/outputIPOne 192.168.1.101
[19:06:34.924] PUB r /peer/eAbeD2kacgQtQihdoa4H4u/rack/page_0/channel.5/device/gui/localudp/outputIPTwo 192.168.1.101
[19:06:34.924] PUB r /peer/eAbeD2kacgQtQihdoa4H4u/rack/page_0/channel.5/device/gui/localudp/outputPortOne 10058
[19:06:34.924] PUB r /peer/eAbeD2kacgQtQihdoa4H4u/rack/page_0/channel.5/device/gui/localudp/outputPortTwo 10057
[19:06:34.924] PUB r /peer/eAbeD2kacgQtQihdoa4H4u/rack/page_0/channel.5/device/gui/localudp/reset 0
[19:06:34.924] PUB r /peer/eAbeD2kacgQtQihdoa4H4u/rack/page_0/channel.5/device/gui/monitor/log 0
[19:06:34.924] PUB r /peer/eAbeD2kacgQtQihdoa4H4u/rack/page_0/channel.5/device/gui/monitor/monitorGate 0
[19:06:34.924] PUB r /peer/eAbeD2kacgQtQihdoa4H4u/rack/page_0/channel.5/device/gui/description OSC
[19:06:34.924] PUB r /peer/eAbeD2kacgQtQihdoa4H4u/rack/page_0/channel.5/device/gui/enable 0
[19:06:34.924] PUB r /peer/eAbeD2kacgQtQihdoa4H4u/rack/page_0/channel.5/device/gui/inputIndicator 0
[19:06:34.924] PUB r /peer/eAbeD2kacgQtQihdoa4H4u/rack/page_0/channel.5/device/gui/outputIndicator 0
[19:06:34.924] SUB   /peer/eAbeD2kacgQtQihdoa4H4u/rack/page_0/channel.5/device/#
[19:06:34.931] RECV  /peer/eAbeD2kacgQtQihdoa4H4u/rack/page_0/channel.5/device/gui/localudp/peerLocalIP 192.168.1.101
[19:06:34.932] RECV  /peer/eAbeD2kacgQtQihdoa4H4u/rack/page_0/channel.5/device/gui/localudp/enableTwo 0
[19:06:34.932] RECV  /peer/eAbeD2kacgQtQihdoa4H4u/rack/page_0/channel.5/device/gui/localudp/inputPort 10059
[19:06:34.932] RECV  /peer/eAbeD2kacgQtQihdoa4H4u/rack/page_0/channel.5/device/gui/localudp/outputIPOne 192.168.1.101
[19:06:34.932] RECV  /peer/eAbeD2kacgQtQihdoa4H4u/rack/page_0/channel.5/device/gui/localudp/outputIPTwo 192.168.1.101
[19:06:34.932] RECV  /peer/eAbeD2kacgQtQihdoa4H4u/rack/page_0/channel.5/device/gui/localudp/outputPortOne 10058
[19:06:34.932] RECV  /peer/eAbeD2kacgQtQihdoa4H4u/rack/page_0/channel.5/device/gui/localudp/outputPortTwo 10057
[19:06:34.932] RECV  /peer/eAbeD2kacgQtQihdoa4H4u/rack/page_0/channel.5/device/gui/localudp/reset 0
[19:06:34.932] RECV  /peer/eAbeD2kacgQtQihdoa4H4u/rack/page_0/channel.5/device/gui/monitor/log 0
[19:06:34.932] RECV  /peer/eAbeD2kacgQtQihdoa4H4u/rack/page_0/channel.5/device/gui/monitor/monitorGate 0
[19:06:34.932] RECV  /peer/eAbeD2kacgQtQihdoa4H4u/rack/page_0/channel.5/device/gui/description OSC
[19:06:34.932] RECV  /peer/eAbeD2kacgQtQihdoa4H4u/rack/page_0/channel.5/device/gui/enable 0
[19:06:34.932] RECV  /peer/eAbeD2kacgQtQihdoa4H4u/rack/page_0/channel.5/device/gui/inputIndicator 0
[19:06:34.932] RECV  /peer/eAbeD2kacgQtQihdoa4H4u/rack/page_0/channel.5/device/gui/outputIndicator 0
[19:06:34.932] RECV  /peer/eAbeD2kacgQtQihdoa4H4u/rack/page_0/channel.5/device/gui/localudp/peerLocalIP 192.168.1.101
[19:06:34.932] RECV  /peer/eAbeD2kacgQtQihdoa4H4u/rack/page_0/channel.5/device/gui/localudp/enableTwo 0
[19:06:34.932] RECV  /peer/eAbeD2kacgQtQihdoa4H4u/rack/page_0/channel.5/device/gui/localudp/inputPort 10059
[19:06:34.932] RECV  /peer/eAbeD2kacgQtQihdoa4H4u/rack/page_0/channel.5/device/gui/localudp/outputIPOne 192.168.1.101
[19:06:34.932] RECV  /peer/eAbeD2kacgQtQihdoa4H4u/rack/page_0/channel.5/device/gui/localudp/outputIPTwo 192.168.1.101
[19:06:34.932] RECV  /peer/eAbeD2kacgQtQihdoa4H4u/rack/page_0/channel.5/device/gui/localudp/outputPortOne 10058
[19:06:34.932] RECV  /peer/eAbeD2kacgQtQihdoa4H4u/rack/page_0/channel.5/device/gui/localudp/outputPortTwo 10057
[19:06:34.932] RECV  /peer/eAbeD2kacgQtQihdoa4H4u/rack/page_0/channel.5/device/gui/localudp/reset 0
[19:06:34.932] RECV  /peer/eAbeD2kacgQtQihdoa4H4u/rack/page_0/channel.5/device/gui/monitor/log 0
[19:06:34.935] RECV  /peer/eAbeD2kacgQtQihdoa4H4u/rack/page_0/channel.5/device/gui/monitor/monitorGate 0
[19:06:34.935] RECV  /peer/eAbeD2kacgQtQihdoa4H4u/rack/page_0/channel.5/device/gui/description OSC
[19:06:34.935] RECV  /peer/eAbeD2kacgQtQihdoa4H4u/rack/page_0/channel.5/device/gui/enable 0
[19:06:34.935] RECV  /peer/eAbeD2kacgQtQihdoa4H4u/rack/page_0/channel.5/device/gui/inputIndicator 0
[19:06:34.935] RECV  /peer/eAbeD2kacgQtQihdoa4H4u/rack/page_0/channel.5/device/gui/outputIndicator 0
[19:06:42.437] RECV  /peer/d7L5RMzRV8QYD5ASA8YPFS/rack/page_0/channel.5/device/gui/localudp/peerLocalIP 0
[19:06:42.441] RECV  /peer/d7L5RMzRV8QYD5ASA8YPFS/rack/page_0/channel.5/device/gui/localudp/peerLocalIP 0
[19:06:42.441] RECV  /peer/d7L5RMzRV8QYD5ASA8YPFS/rack/page_0/channel.5/device/gui/localudp/enableTwo 0
[19:06:42.441] RECV  /peer/d7L5RMzRV8QYD5ASA8YPFS/rack/page_0/channel.5/device/gui/localudp/inputPort 10059
[19:06:42.441] RECV  /peer/d7L5RMzRV8QYD5ASA8YPFS/rack/page_0/channel.5/device/gui/localudp/outputIPOne 0
[19:06:42.441] RECV  /peer/d7L5RMzRV8QYD5ASA8YPFS/rack/page_0/channel.5/device/gui/localudp/outputIPTwo 0
[19:06:42.441] RECV  /peer/d7L5RMzRV8QYD5ASA8YPFS/rack/page_0/channel.5/device/gui/localudp/outputPortOne 10058
[19:06:42.442] RECV  /peer/d7L5RMzRV8QYD5ASA8YPFS/rack/page_0/channel.5/device/gui/localudp/outputPortTwo 10057
[19:06:42.442] RECV  /peer/d7L5RMzRV8QYD5ASA8YPFS/rack/page_0/channel.5/device/gui/localudp/reset 0
[19:06:42.442] RECV  /peer/d7L5RMzRV8QYD5ASA8YPFS/rack/page_0/channel.5/device/gui/localudp/reset 1
[19:06:42.442] RECV  /peer/d7L5RMzRV8QYD5ASA8YPFS/rack/page_0/channel.5/device/gui/localudp/outputPortTwo 10027
[19:06:42.442] RECV  /peer/d7L5RMzRV8QYD5ASA8YPFS/rack/page_0/channel.5/device/gui/localudp/outputPortOne 10028
[19:06:42.442] RECV  /peer/d7L5RMzRV8QYD5ASA8YPFS/rack/page_0/channel.5/device/gui/localudp/inputPort 10029
[19:06:42.442] RECV  /peer/d7L5RMzRV8QYD5ASA8YPFS/rack/page_0/channel.5/device/gui/localudp/outputPortTwo 10057
[19:06:42.442] RECV  /peer/d7L5RMzRV8QYD5ASA8YPFS/rack/page_0/channel.5/device/gui/localudp/outputPortOne 10058
[19:06:42.442] RECV  /peer/d7L5RMzRV8QYD5ASA8YPFS/rack/page_0/channel.5/device/gui/localudp/inputPort 10059
[19:06:42.483] RECV  /peer/d7L5RMzRV8QYD5ASA8YPFS/rack/page_0/channel.5/device/gui/monitor/monitorGate 0
[19:06:42.486] RECV  /peer/d7L5RMzRV8QYD5ASA8YPFS/rack/page_0/channel.5/device/gui/monitor/log 0
[19:06:42.486] RECV  /peer/d7L5RMzRV8QYD5ASA8YPFS/rack/page_0/channel.5/device/gui/monitor/log 0
[19:06:42.486] RECV  /peer/d7L5RMzRV8QYD5ASA8YPFS/rack/page_0/channel.5/device/gui/description OSC
[19:06:42.486] RECV  /peer/d7L5RMzRV8QYD5ASA8YPFS/rack/page_0/channel.5/device/gui/enable 0
[19:06:42.486] RECV  /peer/d7L5RMzRV8QYD5ASA8YPFS/rack/page_0/channel.5/device/gui/inputIndicator 0
[19:06:42.486] RECV  /peer/d7L5RMzRV8QYD5ASA8YPFS/rack/page_0/channel.5/device/gui/outputIndicator 0
[19:06:42.486] RECV  /peer/d7L5RMzRV8QYD5ASA8YPFS/rack/page_0/channel.5/device/gui/localudp/peerLocalIP 10.18.152.229
[19:06:42.486] RECV  /peer/d7L5RMzRV8QYD5ASA8YPFS/rack/page_0/channel.5/device/gui/localudp/outputIPTwo 10.18.152.229
[19:06:42.487] RECV  /peer/d7L5RMzRV8QYD5ASA8YPFS/rack/page_0/channel.5/device/gui/localudp/outputIPOne 10.18.152.229
[19:06:42.487] RECV  /peer/d7L5RMzRV8QYD5ASA8YPFS/rack/page_0/channel.5/loaded 1
---

## Case 9 — Rack persistence round-trip

**Steps:**
1. On NG, have 2–3 devices configured across different channels of the local peer (e.g. channels 0, 5, 12).
2. Quit NG (Cmd+Q on macOS, or close with quit on Windows/Linux).
3. Wait ~2 seconds.
4. Relaunch NG, connect to the broker, and join the same room.

**Expected:**
- Log shows the init sequence PUBs.
- After `peer:joined`, log shows additional PUBs for the rack restore (the 2–3 previously-configured devices).
- Matrix shows the restored devices in the same channels with the same config.

**Verification on disk:**
```
cat "$HOME/Library/Application Support/telemersive-portbay/rack.json"   # macOS
```
Should be a JSON object with the peer-subtree-relative paths as keys.

**Result:** 

[19:09:27.955] SUB   /peer/8daALfn1eUNDWTkadizbBY/#
[19:09:27.956] PUB r /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.0/loaded 0
[19:09:27.956] PUB r /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.1/loaded 0
[19:09:27.956] PUB r /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.2/loaded 0
[19:09:27.956] PUB r /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.3/loaded 0
[19:09:27.956] PUB r /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.4/loaded 0
[19:09:27.956] PUB r /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.5/loaded 0
[19:09:27.956] PUB r /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.6/loaded 0
[19:09:27.956] PUB r /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.7/loaded 0
[19:09:27.956] PUB r /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.8/loaded 0
[19:09:27.956] PUB r /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.9/loaded 0
[19:09:27.956] PUB r /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.10/loaded 0
[19:09:27.956] PUB r /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.11/loaded 0
[19:09:27.956] PUB r /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.12/loaded 0
[19:09:27.956] PUB r /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.13/loaded 0
[19:09:27.956] PUB r /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.14/loaded 0
[19:09:27.956] PUB r /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.15/loaded 0
[19:09:27.956] PUB r /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.16/loaded 0
[19:09:27.956] PUB r /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.17/loaded 0
[19:09:27.956] PUB r /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.18/loaded 0
[19:09:27.956] PUB r /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.19/loaded 0
[19:09:27.956] PUB r /peer/8daALfn1eUNDWTkadizbBY/settings/lock/enable 0
[19:09:27.958] PUB r /peer/8daALfn1eUNDWTkadizbBY/settings/background/color 0.8200 0.4420 0.2800 1
[19:09:27.958] PUB r /peer/8daALfn1eUNDWTkadizbBY/settings/localMenus/textureCaptureRange -default-
[19:09:27.958] PUB r /peer/8daALfn1eUNDWTkadizbBY/settings/localMenus/ndiRange -default-
[19:09:27.958] PUB r /peer/8daALfn1eUNDWTkadizbBY/settings/localMenus/portaudioCaptureRange 0
[19:09:27.958] PUB r /peer/8daALfn1eUNDWTkadizbBY/settings/localMenus/coreaudioCaptureRange 0
[19:09:27.958] PUB r /peer/8daALfn1eUNDWTkadizbBY/settings/localMenus/wasapiCaptureRange 0
[19:09:27.958] PUB r /peer/8daALfn1eUNDWTkadizbBY/settings/localMenus/jackCaptureRange 0
[19:09:27.958] PUB r /peer/8daALfn1eUNDWTkadizbBY/settings/localMenus/portaudioReceiveRange 0
[19:09:27.958] PUB r /peer/8daALfn1eUNDWTkadizbBY/settings/localMenus/coreaudioReceiveRange 0
[19:09:27.958] PUB r /peer/8daALfn1eUNDWTkadizbBY/settings/localMenus/wasapiReceiveRange 0
[19:09:27.958] PUB r /peer/8daALfn1eUNDWTkadizbBY/settings/localMenus/jackReceiveRange 0
[19:09:27.958] PUB r /peer/8daALfn1eUNDWTkadizbBY/settings/localProps/ug_enable 0
[19:09:27.958] PUB r /peer/8daALfn1eUNDWTkadizbBY/settings/localProps/natnet_enable 0
[19:09:27.959] PUB r /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.0/loaded 1
[19:09:27.959] PUB r /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.1/loaded 0
[19:09:27.959] PUB r /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.2/loaded 0
[19:09:27.959] PUB r /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.3/loaded 0
[19:09:27.959] PUB r /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.4/loaded 0
[19:09:27.959] PUB r /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.5/loaded 1
[19:09:27.959] PUB r /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.6/loaded 0
[19:09:27.959] PUB r /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.7/loaded 0
[19:09:27.959] PUB r /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.8/loaded 0
[19:09:27.959] PUB r /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.9/loaded 0
[19:09:27.960] PUB r /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.10/loaded 0
[19:09:27.960] PUB r /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.11/loaded 0
[19:09:27.960] PUB r /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.12/loaded 1
[19:09:27.960] PUB r /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.13/loaded 0
[19:09:27.960] PUB r /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.14/loaded 0
[19:09:27.960] PUB r /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.15/loaded 0
[19:09:27.960] PUB r /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.16/loaded 0
[19:09:27.960] PUB r /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.17/loaded 0
[19:09:27.960] PUB r /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.18/loaded 0
[19:09:27.960] PUB r /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.19/loaded 0
[19:09:27.960] PUB r /peer/8daALfn1eUNDWTkadizbBY/settings/lock/enable 0
[19:09:27.960] PUB r /peer/8daALfn1eUNDWTkadizbBY/settings/background/color 0.4510 0.8200 0.2800 1
[19:09:27.960] PUB r /peer/8daALfn1eUNDWTkadizbBY/settings/localMenus/textureCaptureRange -default-
[19:09:27.960] PUB r /peer/8daALfn1eUNDWTkadizbBY/settings/localMenus/ndiRange -default-
[19:09:27.960] PUB r /peer/8daALfn1eUNDWTkadizbBY/settings/localMenus/portaudioCaptureRange 0
[19:09:27.960] PUB r /peer/8daALfn1eUNDWTkadizbBY/settings/localMenus/coreaudioCaptureRange 0
[19:09:27.960] PUB r /peer/8daALfn1eUNDWTkadizbBY/settings/localMenus/wasapiCaptureRange 0
[19:09:27.960] PUB r /peer/8daALfn1eUNDWTkadizbBY/settings/localMenus/jackCaptureRange 0
[19:09:27.960] PUB r /peer/8daALfn1eUNDWTkadizbBY/settings/localMenus/portaudioReceiveRange 0
[19:09:27.960] PUB r /peer/8daALfn1eUNDWTkadizbBY/settings/localMenus/coreaudioReceiveRange 0
[19:09:27.960] PUB r /peer/8daALfn1eUNDWTkadizbBY/settings/localMenus/wasapiReceiveRange 0
[19:09:27.960] PUB r /peer/8daALfn1eUNDWTkadizbBY/settings/localMenus/jackReceiveRange 0
[19:09:27.960] PUB r /peer/8daALfn1eUNDWTkadizbBY/settings/localProps/ug_enable 0
[19:09:27.960] PUB r /peer/8daALfn1eUNDWTkadizbBY/settings/localProps/natnet_enable 0
[19:09:27.960] PUB r /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.0/device/gui/localudp/peerLocalIP 192.168.1.101
[19:09:27.960] PUB r /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.0/device/gui/localudp/enableTwo 0
[19:09:27.960] PUB r /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.0/device/gui/localudp/inputPort 10009
[19:09:27.960] PUB r /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.0/device/gui/localudp/outputIPOne 192.168.1.101
[19:09:27.960] PUB r /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.0/device/gui/localudp/outputIPTwo 192.168.1.101
[19:09:27.960] PUB r /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.0/device/gui/localudp/outputPortOne 10008
[19:09:27.960] PUB r /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.0/device/gui/localudp/outputPortTwo 10007
[19:09:27.960] PUB r /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.0/device/gui/localudp/reset 0
[19:09:27.960] PUB r /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.0/device/gui/monitor/log 0
[19:09:27.960] PUB r /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.0/device/gui/monitor/monitorGate 0
[19:09:27.960] PUB r /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.0/device/gui/description OSC
[19:09:27.960] PUB r /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.0/device/gui/enable 0
[19:09:27.960] PUB r /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.0/device/gui/inputIndicator 0
[19:09:27.960] PUB r /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.0/device/gui/outputIndicator 0
[19:09:27.960] PUB r /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.3/device/gui/localudp/peerLocalIP 192.168.1.101
[19:09:27.960] PUB r /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.3/device/gui/localudp/enableTwo 0
[19:09:27.960] PUB r /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.3/device/gui/localudp/inputPort 10039
[19:09:27.960] PUB r /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.3/device/gui/localudp/outputIPOne 192.168.1.101
[19:09:27.960] PUB r /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.3/device/gui/localudp/outputIPTwo 192.168.1.101
[19:09:27.960] PUB r /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.3/device/gui/localudp/outputPortOne 10038
[19:09:27.960] PUB r /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.3/device/gui/localudp/outputPortTwo 10037
[19:09:27.960] PUB r /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.3/device/gui/localudp/reset 0
[19:09:27.960] PUB r /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.3/device/gui/monitor/log 0
[19:09:27.960] PUB r /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.3/device/gui/monitor/monitorGate 0
[19:09:27.960] PUB r /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.3/device/gui/description OSC
[19:09:27.960] PUB r /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.3/device/gui/enable 0
[19:09:27.960] PUB r /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.3/device/gui/inputIndicator 0
[19:09:27.960] PUB r /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.3/device/gui/outputIndicator 0
[19:09:27.960] PUB r /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.5/device/gui/localudp/peerLocalIP 192.168.1.101
[19:09:27.960] PUB r /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.5/device/gui/localudp/enableTwo 0
[19:09:27.960] PUB r /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.5/device/gui/localudp/inputPort 10059
[19:09:27.960] PUB r /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.5/device/gui/localudp/outputIPOne 192.168.1.101
[19:09:27.960] PUB r /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.5/device/gui/localudp/outputIPTwo 192.168.1.101
[19:09:27.960] PUB r /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.5/device/gui/localudp/outputPortOne 10058
[19:09:27.960] PUB r /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.5/device/gui/localudp/outputPortTwo 10057
[19:09:27.960] PUB r /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.5/device/gui/localudp/reset 0
[19:09:27.960] PUB r /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.5/device/gui/monitor/log 0
[19:09:27.960] PUB r /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.5/device/gui/monitor/monitorGate 0
[19:09:27.960] PUB r /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.5/device/gui/description OSC
[19:09:27.960] PUB r /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.5/device/gui/enable 0
[19:09:27.961] PUB r /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.5/device/gui/inputIndicator 0
[19:09:27.961] PUB r /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.5/device/gui/outputIndicator 0
[19:09:27.961] PUB r /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.12/device/gui/localudp/peerLocalIP 192.168.1.101
[19:09:27.961] PUB r /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.12/device/gui/localudp/enableTwo 0
[19:09:27.961] PUB r /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.12/device/gui/localudp/inputPort 10129
[19:09:27.961] PUB r /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.12/device/gui/localudp/outputIPOne 192.168.1.101
[19:09:27.961] PUB r /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.12/device/gui/localudp/outputIPTwo 192.168.1.101
[19:09:27.961] PUB r /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.12/device/gui/localudp/outputPortOne 10128
[19:09:27.961] PUB r /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.12/device/gui/localudp/outputPortTwo 10127
[19:09:27.961] PUB r /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.12/device/gui/localudp/reset 0
[19:09:27.961] PUB r /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.12/device/gui/monitor/log 0
[19:09:27.961] PUB r /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.12/device/gui/monitor/monitorGate 0
[19:09:27.961] PUB r /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.12/device/gui/description OSC
[19:09:27.961] PUB r /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.12/device/gui/enable 0
[19:09:27.961] PUB r /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.12/device/gui/inputIndicator 0
[19:09:27.961] PUB r /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.12/device/gui/outputIndicator 0
[19:09:27.968] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.0/loaded 0
[19:09:27.968] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.1/loaded 0
[19:09:27.969] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.2/loaded 0
[19:09:27.969] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.3/loaded 0
[19:09:27.969] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.4/loaded 0
[19:09:27.969] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.5/loaded 0
[19:09:27.969] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.6/loaded 0
[19:09:27.969] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.7/loaded 0
[19:09:27.969] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.8/loaded 0
[19:09:27.969] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.9/loaded 0
[19:09:27.969] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.10/loaded 0
[19:09:27.969] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.11/loaded 0
[19:09:27.969] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.12/loaded 0
[19:09:27.969] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.13/loaded 0
[19:09:27.969] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.14/loaded 0
[19:09:27.969] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.15/loaded 0
[19:09:27.969] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.16/loaded 0
[19:09:27.969] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.17/loaded 0
[19:09:27.969] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.18/loaded 0
[19:09:27.969] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.19/loaded 0
[19:09:27.969] RECV  /peer/8daALfn1eUNDWTkadizbBY/settings/lock/enable 0
[19:09:27.969] RECV  /peer/8daALfn1eUNDWTkadizbBY/settings/background/color 0.8200 0.4420 0.2800 1
[19:09:27.969] RECV  /peer/8daALfn1eUNDWTkadizbBY/settings/localMenus/textureCaptureRange -default-
[19:09:27.969] RECV  /peer/8daALfn1eUNDWTkadizbBY/settings/localMenus/ndiRange -default-
[19:09:27.969] RECV  /peer/8daALfn1eUNDWTkadizbBY/settings/localMenus/portaudioCaptureRange 0
[19:09:27.969] RECV  /peer/8daALfn1eUNDWTkadizbBY/settings/localMenus/coreaudioCaptureRange 0
[19:09:27.969] RECV  /peer/8daALfn1eUNDWTkadizbBY/settings/localMenus/wasapiCaptureRange 0
[19:09:27.969] RECV  /peer/8daALfn1eUNDWTkadizbBY/settings/localMenus/jackCaptureRange 0
[19:09:27.969] RECV  /peer/8daALfn1eUNDWTkadizbBY/settings/localMenus/portaudioReceiveRange 0
[19:09:27.969] RECV  /peer/8daALfn1eUNDWTkadizbBY/settings/localMenus/coreaudioReceiveRange 0
[19:09:27.969] RECV  /peer/8daALfn1eUNDWTkadizbBY/settings/localMenus/wasapiReceiveRange 0
[19:09:27.969] RECV  /peer/8daALfn1eUNDWTkadizbBY/settings/localMenus/jackReceiveRange 0
[19:09:27.969] RECV  /peer/8daALfn1eUNDWTkadizbBY/settings/localProps/ug_enable 0
[19:09:27.969] RECV  /peer/8daALfn1eUNDWTkadizbBY/settings/localProps/natnet_enable 0
[19:09:27.969] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.0/loaded 1
[19:09:27.969] PUB r /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.0/device/gui/localudp/peerLocalIP 192.168.1.101
[19:09:27.969] PUB r /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.0/device/gui/localudp/enableTwo 0
[19:09:27.969] PUB r /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.0/device/gui/localudp/inputPort 10009
[19:09:27.969] PUB r /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.0/device/gui/localudp/outputIPOne 192.168.1.101
[19:09:27.969] PUB r /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.0/device/gui/localudp/outputIPTwo 192.168.1.101
[19:09:27.969] PUB r /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.0/device/gui/localudp/outputPortOne 10008
[19:09:27.969] PUB r /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.0/device/gui/localudp/outputPortTwo 10007
[19:09:27.970] PUB r /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.0/device/gui/localudp/reset 0
[19:09:27.970] PUB r /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.0/device/gui/monitor/log 0
[19:09:27.970] PUB r /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.0/device/gui/monitor/monitorGate 0
[19:09:27.970] PUB r /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.0/device/gui/description OSC
[19:09:27.970] PUB r /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.0/device/gui/enable 0
[19:09:27.970] PUB r /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.0/device/gui/inputIndicator 0
[19:09:27.970] PUB r /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.0/device/gui/outputIndicator 0
[19:09:27.970] SUB   /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.0/device/#
[19:09:27.970] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.1/loaded 0
[19:09:27.970] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.2/loaded 0
[19:09:27.970] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.3/loaded 0
[19:09:27.970] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.4/loaded 0
[19:09:27.970] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.5/loaded 1
[19:09:27.970] PUB r /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.5/device/gui/localudp/peerLocalIP 192.168.1.101
[19:09:27.970] PUB r /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.5/device/gui/localudp/enableTwo 0
[19:09:27.970] PUB r /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.5/device/gui/localudp/inputPort 10059
[19:09:27.970] PUB r /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.5/device/gui/localudp/outputIPOne 192.168.1.101
[19:09:27.970] PUB r /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.5/device/gui/localudp/outputIPTwo 192.168.1.101
[19:09:27.970] PUB r /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.5/device/gui/localudp/outputPortOne 10058
[19:09:27.970] PUB r /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.5/device/gui/localudp/outputPortTwo 10057
[19:09:27.970] PUB r /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.5/device/gui/localudp/reset 0
[19:09:27.970] PUB r /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.5/device/gui/monitor/log 0
[19:09:27.970] PUB r /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.5/device/gui/monitor/monitorGate 0
[19:09:27.970] PUB r /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.5/device/gui/description OSC
[19:09:27.970] PUB r /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.5/device/gui/enable 0
[19:09:27.970] PUB r /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.5/device/gui/inputIndicator 0
[19:09:27.970] PUB r /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.5/device/gui/outputIndicator 0
[19:09:27.970] SUB   /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.5/device/#
[19:09:27.970] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.6/loaded 0
[19:09:27.970] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.7/loaded 0
[19:09:27.970] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.8/loaded 0
[19:09:27.970] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.9/loaded 0
[19:09:27.970] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.10/loaded 0
[19:09:27.970] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.11/loaded 0
[19:09:27.970] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.12/loaded 1
[19:09:27.970] PUB r /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.12/device/gui/localudp/peerLocalIP 192.168.1.101
[19:09:27.970] PUB r /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.12/device/gui/localudp/enableTwo 0
[19:09:27.970] PUB r /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.12/device/gui/localudp/inputPort 10129
[19:09:27.970] PUB r /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.12/device/gui/localudp/outputIPOne 192.168.1.101
[19:09:27.970] PUB r /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.12/device/gui/localudp/outputIPTwo 192.168.1.101
[19:09:27.970] PUB r /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.12/device/gui/localudp/outputPortOne 10128
[19:09:27.970] PUB r /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.12/device/gui/localudp/outputPortTwo 10127
[19:09:27.970] PUB r /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.12/device/gui/localudp/reset 0
[19:09:27.970] PUB r /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.12/device/gui/monitor/log 0
[19:09:27.970] PUB r /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.12/device/gui/monitor/monitorGate 0
[19:09:27.970] PUB r /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.12/device/gui/description OSC
[19:09:27.970] PUB r /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.12/device/gui/enable 0
[19:09:27.970] PUB r /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.12/device/gui/inputIndicator 0
[19:09:27.970] PUB r /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.12/device/gui/outputIndicator 0
[19:09:27.971] SUB   /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.12/device/#
[19:09:27.971] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.13/loaded 0
[19:09:27.971] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.14/loaded 0
[19:09:27.971] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.15/loaded 0
[19:09:27.971] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.16/loaded 0
[19:09:27.971] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.17/loaded 0
[19:09:27.971] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.18/loaded 0
[19:09:27.971] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.19/loaded 0
[19:09:27.971] RECV  /peer/8daALfn1eUNDWTkadizbBY/settings/lock/enable 0
[19:09:27.971] RECV  /peer/8daALfn1eUNDWTkadizbBY/settings/background/color 0.4510 0.8200 0.2800 1
[19:09:27.971] RECV  /peer/8daALfn1eUNDWTkadizbBY/settings/localMenus/textureCaptureRange -default-
[19:09:27.971] RECV  /peer/8daALfn1eUNDWTkadizbBY/settings/localMenus/ndiRange -default-
[19:09:27.971] RECV  /peer/8daALfn1eUNDWTkadizbBY/settings/localMenus/portaudioCaptureRange 0
[19:09:27.971] RECV  /peer/8daALfn1eUNDWTkadizbBY/settings/localMenus/coreaudioCaptureRange 0
[19:09:27.971] RECV  /peer/8daALfn1eUNDWTkadizbBY/settings/localMenus/wasapiCaptureRange 0
[19:09:27.971] RECV  /peer/8daALfn1eUNDWTkadizbBY/settings/localMenus/jackCaptureRange 0
[19:09:27.971] RECV  /peer/8daALfn1eUNDWTkadizbBY/settings/localMenus/portaudioReceiveRange 0
[19:09:27.971] RECV  /peer/8daALfn1eUNDWTkadizbBY/settings/localMenus/coreaudioReceiveRange 0
[19:09:27.971] RECV  /peer/8daALfn1eUNDWTkadizbBY/settings/localMenus/wasapiReceiveRange 0
[19:09:27.971] RECV  /peer/8daALfn1eUNDWTkadizbBY/settings/localMenus/jackReceiveRange 0
[19:09:27.971] RECV  /peer/8daALfn1eUNDWTkadizbBY/settings/localProps/ug_enable 0
[19:09:27.971] RECV  /peer/8daALfn1eUNDWTkadizbBY/settings/localProps/natnet_enable 0
[19:09:27.971] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.0/device/gui/localudp/peerLocalIP 192.168.1.101
[19:09:27.971] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.0/device/gui/localudp/enableTwo 0
[19:09:27.971] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.0/device/gui/localudp/inputPort 10009
[19:09:27.971] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.0/device/gui/localudp/outputIPOne 192.168.1.101
[19:09:27.971] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.0/device/gui/localudp/outputIPTwo 192.168.1.101
[19:09:27.971] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.0/device/gui/localudp/outputPortOne 10008
[19:09:27.971] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.0/device/gui/localudp/outputPortTwo 10007
[19:09:27.971] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.0/device/gui/localudp/reset 0
[19:09:27.971] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.0/device/gui/monitor/log 0
[19:09:27.971] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.0/device/gui/monitor/monitorGate 0
[19:09:27.971] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.0/device/gui/description OSC
[19:09:27.971] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.0/device/gui/enable 0
[19:09:27.971] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.0/device/gui/inputIndicator 0
[19:09:27.971] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.0/device/gui/outputIndicator 0
[19:09:27.971] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.3/device/gui/localudp/peerLocalIP 192.168.1.101
[19:09:27.971] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.3/device/gui/localudp/enableTwo 0
[19:09:27.971] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.3/device/gui/localudp/inputPort 10039
[19:09:27.971] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.3/device/gui/localudp/outputIPOne 192.168.1.101
[19:09:27.971] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.3/device/gui/localudp/outputIPTwo 192.168.1.101
[19:09:27.971] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.3/device/gui/localudp/outputPortOne 10038
[19:09:27.971] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.3/device/gui/localudp/outputPortTwo 10037
[19:09:27.971] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.3/device/gui/localudp/reset 0
[19:09:27.971] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.3/device/gui/monitor/log 0
[19:09:27.971] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.3/device/gui/monitor/monitorGate 0
[19:09:27.971] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.3/device/gui/description OSC
[19:09:27.971] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.3/device/gui/enable 0
[19:09:27.972] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.3/device/gui/inputIndicator 0
[19:09:27.972] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.3/device/gui/outputIndicator 0
[19:09:27.972] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.5/device/gui/localudp/peerLocalIP 192.168.1.101
[19:09:27.972] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.5/device/gui/localudp/enableTwo 0
[19:09:27.972] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.5/device/gui/localudp/inputPort 10059
[19:09:27.972] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.5/device/gui/localudp/outputIPOne 192.168.1.101
[19:09:27.972] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.5/device/gui/localudp/outputIPTwo 192.168.1.101
[19:09:27.972] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.5/device/gui/localudp/outputPortOne 10058
[19:09:27.972] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.5/device/gui/localudp/outputPortTwo 10057
[19:09:27.972] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.5/device/gui/localudp/reset 0
[19:09:27.972] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.5/device/gui/monitor/log 0
[19:09:27.972] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.5/device/gui/monitor/monitorGate 0
[19:09:27.972] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.5/device/gui/description OSC
[19:09:27.972] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.5/device/gui/enable 0
[19:09:27.972] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.5/device/gui/inputIndicator 0
[19:09:27.972] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.5/device/gui/outputIndicator 0
[19:09:27.972] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.12/device/gui/localudp/peerLocalIP 192.168.1.101
[19:09:27.972] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.12/device/gui/localudp/enableTwo 0
[19:09:27.972] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.12/device/gui/localudp/inputPort 10129
[19:09:27.972] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.12/device/gui/localudp/outputIPOne 192.168.1.101
[19:09:27.972] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.12/device/gui/localudp/outputIPTwo 192.168.1.101
[19:09:27.972] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.12/device/gui/localudp/outputPortOne 10128
[19:09:27.972] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.12/device/gui/localudp/outputPortTwo 10127
[19:09:27.972] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.12/device/gui/localudp/reset 0
[19:09:27.972] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.12/device/gui/monitor/log 0
[19:09:27.972] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.12/device/gui/monitor/monitorGate 0
[19:09:27.972] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.12/device/gui/description OSC
[19:09:27.972] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.12/device/gui/enable 0
[19:09:27.972] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.12/device/gui/inputIndicator 0
[19:09:27.972] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.12/device/gui/outputIndicator 0
[19:09:27.973] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.0/device/gui/localudp/peerLocalIP 192.168.1.101
[19:09:27.973] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.0/device/gui/localudp/enableTwo 0
[19:09:27.973] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.0/device/gui/localudp/inputPort 10009
[19:09:27.973] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.0/device/gui/localudp/outputIPOne 192.168.1.101
[19:09:27.973] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.0/device/gui/localudp/outputIPTwo 192.168.1.101
[19:09:27.973] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.0/device/gui/localudp/outputPortOne 10008
[19:09:27.973] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.0/device/gui/localudp/outputPortTwo 10007
[19:09:27.973] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.0/device/gui/localudp/reset 0
[19:09:27.973] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.0/device/gui/monitor/log 0
[19:09:27.973] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.0/device/gui/monitor/monitorGate 0
[19:09:27.973] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.0/device/gui/description OSC
[19:09:27.973] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.0/device/gui/enable 0
[19:09:27.973] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.0/device/gui/inputIndicator 0
[19:09:27.973] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.0/device/gui/outputIndicator 0
[19:09:27.973] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.0/device/gui/localudp/peerLocalIP 192.168.1.101
[19:09:27.973] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.0/device/gui/localudp/enableTwo 0
[19:09:27.973] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.0/device/gui/localudp/inputPort 10009
[19:09:27.973] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.0/device/gui/localudp/outputIPOne 192.168.1.101
[19:09:27.973] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.0/device/gui/localudp/outputIPTwo 192.168.1.101
[19:09:27.973] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.0/device/gui/localudp/outputPortOne 10008
[19:09:27.973] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.0/device/gui/localudp/outputPortTwo 10007
[19:09:27.973] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.0/device/gui/localudp/reset 0
[19:09:27.976] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.0/device/gui/monitor/log 0
[19:09:27.976] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.0/device/gui/monitor/monitorGate 0
[19:09:27.976] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.0/device/gui/description OSC
[19:09:27.976] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.0/device/gui/enable 0
[19:09:27.976] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.0/device/gui/inputIndicator 0
[19:09:27.976] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.0/device/gui/outputIndicator 0
[19:09:27.978] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.5/device/gui/localudp/peerLocalIP 192.168.1.101
[19:09:27.978] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.5/device/gui/localudp/enableTwo 0
[19:09:27.978] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.5/device/gui/localudp/inputPort 10059
[19:09:27.978] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.5/device/gui/localudp/outputIPOne 192.168.1.101
[19:09:27.978] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.5/device/gui/localudp/outputIPTwo 192.168.1.101
[19:09:27.978] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.5/device/gui/localudp/outputPortOne 10058
[19:09:27.978] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.5/device/gui/localudp/outputPortTwo 10057
[19:09:27.978] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.5/device/gui/localudp/reset 0
[19:09:27.978] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.5/device/gui/monitor/log 0
[19:09:27.978] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.5/device/gui/monitor/monitorGate 0
[19:09:27.978] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.5/device/gui/description OSC
[19:09:27.978] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.5/device/gui/enable 0
[19:09:27.978] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.5/device/gui/inputIndicator 0
[19:09:27.978] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.5/device/gui/outputIndicator 0
[19:09:27.978] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.5/device/gui/localudp/peerLocalIP 192.168.1.101
[19:09:27.978] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.5/device/gui/localudp/enableTwo 0
[19:09:27.978] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.5/device/gui/localudp/inputPort 10059
[19:09:27.978] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.5/device/gui/localudp/outputIPOne 192.168.1.101
[19:09:27.978] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.5/device/gui/localudp/outputIPTwo 192.168.1.101
[19:09:27.978] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.5/device/gui/localudp/outputPortOne 10058
[19:09:27.978] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.5/device/gui/localudp/outputPortTwo 10057
[19:09:27.978] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.5/device/gui/localudp/reset 0
[19:09:27.978] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.5/device/gui/monitor/log 0
[19:09:27.978] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.5/device/gui/monitor/monitorGate 0
[19:09:27.978] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.5/device/gui/description OSC
[19:09:27.978] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.5/device/gui/enable 0
[19:09:27.978] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.5/device/gui/inputIndicator 0
[19:09:27.978] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.5/device/gui/outputIndicator 0
[19:09:27.978] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.12/device/gui/localudp/peerLocalIP 192.168.1.101
[19:09:27.978] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.12/device/gui/localudp/enableTwo 0
[19:09:27.978] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.12/device/gui/localudp/inputPort 10129
[19:09:27.978] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.12/device/gui/localudp/outputIPOne 192.168.1.101
[19:09:27.978] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.12/device/gui/localudp/outputIPTwo 192.168.1.101
[19:09:27.978] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.12/device/gui/localudp/outputPortOne 10128
[19:09:27.978] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.12/device/gui/localudp/outputPortTwo 10127
[19:09:27.978] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.12/device/gui/localudp/reset 0
[19:09:27.978] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.12/device/gui/monitor/log 0
[19:09:27.978] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.12/device/gui/monitor/monitorGate 0
[19:09:27.979] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.12/device/gui/description OSC
[19:09:27.979] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.12/device/gui/enable 0
[19:09:27.979] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.12/device/gui/inputIndicator 0
[19:09:27.979] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.12/device/gui/outputIndicator 0
[19:09:27.979] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.12/device/gui/localudp/peerLocalIP 192.168.1.101
[19:09:27.979] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.12/device/gui/localudp/enableTwo 0
[19:09:27.979] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.12/device/gui/localudp/inputPort 10129
[19:09:27.979] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.12/device/gui/localudp/outputIPOne 192.168.1.101
[19:09:27.979] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.12/device/gui/localudp/outputIPTwo 192.168.1.101
[19:09:27.979] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.12/device/gui/localudp/outputPortOne 10128
[19:09:27.979] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.12/device/gui/localudp/outputPortTwo 10127
[19:09:27.979] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.12/device/gui/localudp/reset 0
[19:09:27.979] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.12/device/gui/monitor/log 0
[19:09:27.979] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.12/device/gui/monitor/monitorGate 0
[19:09:27.979] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.12/device/gui/description OSC
[19:09:27.979] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.12/device/gui/enable 0
[19:09:27.979] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.12/device/gui/inputIndicator 0
[19:09:27.979] RECV  /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.12/device/gui/outputIndicator 0

**rack.json contents (paste):**
```
{
  "rack/page_0/channel.0/loaded": "1",
  "rack/page_0/channel.1/loaded": "0",
  "rack/page_0/channel.2/loaded": "0",
  "rack/page_0/channel.3/loaded": "0",
  "rack/page_0/channel.4/loaded": "0",
  "rack/page_0/channel.5/loaded": "1",
  "rack/page_0/channel.6/loaded": "0",
  "rack/page_0/channel.7/loaded": "0",
  "rack/page_0/channel.8/loaded": "0",
  "rack/page_0/channel.9/loaded": "0",
  "rack/page_0/channel.10/loaded": "0",
  "rack/page_0/channel.11/loaded": "0",
  "rack/page_0/channel.12/loaded": "1",
  "rack/page_0/channel.13/loaded": "0",
  "rack/page_0/channel.14/loaded": "0",
  "rack/page_0/channel.15/loaded": "0",
  "rack/page_0/channel.16/loaded": "0",
  "rack/page_0/channel.17/loaded": "0",
  "rack/page_0/channel.18/loaded": "0",
  "rack/page_0/channel.19/loaded": "0",
  "settings/lock/enable": "0",
  "settings/background/color": "0.4510 0.8200 0.2800 1",
  "settings/localMenus/textureCaptureRange": "-default-",
  "settings/localMenus/ndiRange": "-default-",
  "settings/localMenus/portaudioCaptureRange": "0",
  "settings/localMenus/coreaudioCaptureRange": "0",
  "settings/localMenus/wasapiCaptureRange": "0",
  "settings/localMenus/jackCaptureRange": "0",
  "settings/localMenus/portaudioReceiveRange": "0",
  "settings/localMenus/coreaudioReceiveRange": "0",
  "settings/localMenus/wasapiReceiveRange": "0",
  "settings/localMenus/jackReceiveRange": "0",
  "settings/localProps/ug_enable": "0",
  "settings/localProps/natnet_enable": "0",
  "rack/page_0/channel.0/device/gui/localudp/peerLocalIP": "192.168.1.101",
  "rack/page_0/channel.0/device/gui/localudp/enableTwo": "0",
  "rack/page_0/channel.0/device/gui/localudp/inputPort": "10009",
  "rack/page_0/channel.0/device/gui/localudp/outputIPOne": "192.168.1.101",
  "rack/page_0/channel.0/device/gui/localudp/outputIPTwo": "192.168.1.101",
  "rack/page_0/channel.0/device/gui/localudp/outputPortOne": "10008",
  "rack/page_0/channel.0/device/gui/localudp/outputPortTwo": "10007",
  "rack/page_0/channel.0/device/gui/localudp/reset": "0",
  "rack/page_0/channel.0/device/gui/monitor/log": "0",
  "rack/page_0/channel.0/device/gui/monitor/monitorGate": "0",
  "rack/page_0/channel.0/device/gui/description": "OSC",
  "rack/page_0/channel.0/device/gui/enable": "0",
  "rack/page_0/channel.0/device/gui/inputIndicator": "0",
  "rack/page_0/channel.0/device/gui/outputIndicator": "0",
  "rack/page_0/channel.3/device/gui/localudp/peerLocalIP": "192.168.1.101",
  "rack/page_0/channel.3/device/gui/localudp/enableTwo": "0",
  "rack/page_0/channel.3/device/gui/localudp/inputPort": "10039",
  "rack/page_0/channel.3/device/gui/localudp/outputIPOne": "192.168.1.101",
  "rack/page_0/channel.3/device/gui/localudp/outputIPTwo": "192.168.1.101",
  "rack/page_0/channel.3/device/gui/localudp/outputPortOne": "10038",
  "rack/page_0/channel.3/device/gui/localudp/outputPortTwo": "10037",
  "rack/page_0/channel.3/device/gui/localudp/reset": "0",
  "rack/page_0/channel.3/device/gui/monitor/log": "0",
  "rack/page_0/channel.3/device/gui/monitor/monitorGate": "0",
  "rack/page_0/channel.3/device/gui/description": "OSC",
  "rack/page_0/channel.3/device/gui/enable": "0",
  "rack/page_0/channel.3/device/gui/inputIndicator": "0",
  "rack/page_0/channel.3/device/gui/outputIndicator": "0",
  "rack/page_0/channel.5/device/gui/localudp/peerLocalIP": "192.168.1.101",
  "rack/page_0/channel.5/device/gui/localudp/enableTwo": "0",
  "rack/page_0/channel.5/device/gui/localudp/inputPort": "10059",
  "rack/page_0/channel.5/device/gui/localudp/outputIPOne": "192.168.1.101",
  "rack/page_0/channel.5/device/gui/localudp/outputIPTwo": "192.168.1.101",
  "rack/page_0/channel.5/device/gui/localudp/outputPortOne": "10058",
  "rack/page_0/channel.5/device/gui/localudp/outputPortTwo": "10057",
  "rack/page_0/channel.5/device/gui/localudp/reset": "0",
  "rack/page_0/channel.5/device/gui/monitor/log": "0",
  "rack/page_0/channel.5/device/gui/monitor/monitorGate": "0",
  "rack/page_0/channel.5/device/gui/description": "OSC",
  "rack/page_0/channel.5/device/gui/enable": "0",
  "rack/page_0/channel.5/device/gui/inputIndicator": "0",
  "rack/page_0/channel.5/device/gui/outputIndicator": "0",
  "rack/page_0/channel.12/device/gui/localudp/peerLocalIP": "192.168.1.101",
  "rack/page_0/channel.12/device/gui/localudp/enableTwo": "0",
  "rack/page_0/channel.12/device/gui/localudp/inputPort": "10129",
  "rack/page_0/channel.12/device/gui/localudp/outputIPOne": "192.168.1.101",
  "rack/page_0/channel.12/device/gui/localudp/outputIPTwo": "192.168.1.101",
  "rack/page_0/channel.12/device/gui/localudp/outputPortOne": "10128",
  "rack/page_0/channel.12/device/gui/localudp/outputPortTwo": "10127",
  "rack/page_0/channel.12/device/gui/localudp/reset": "0",
  "rack/page_0/channel.12/device/gui/monitor/log": "0",
  "rack/page_0/channel.12/device/gui/monitor/monitorGate": "0",
  "rack/page_0/channel.12/device/gui/description": "OSC",
  "rack/page_0/channel.12/device/gui/enable": "0",
  "rack/page_0/channel.12/device/gui/inputIndicator": "0",
  "rack/page_0/channel.12/device/gui/outputIndicator": "0"
}
```

**NG log excerpt (post-join rack restore):**
```
<paste>
```

---

## Case 10 — Graceful shutdown clears retained topics

**Steps:**
1. With NG's own peer subtree populated (multiple devices), quit NG.
2. On Max (or another NG instance), observe NG's peer row.

**Expected:**
- NG's row disappears on `peers:remote:left` (after `bus.leave()`).
- Retained topics under `/peer/<ngPeerId>/#` are cleared (NG publishes empty-string retains on shutdown per §3.6 step 3).
- Rejoining from a third peer does not show stale retained data for NG.

**Result:** 

log from max:

script: "Apr 19 19:13:53.268 myPeerName:    <-- received room ping"
script: "Apr 19 19:13:53.326 myPeerName: ...stopping join timout thread."
script: "Apr 19 19:13:53.326 myPeerName: <-- access to room interop-test-120426 confirmed."
SCRIPT_RX: chat "{"19:09:27 GMT+0200":"[me]: > has joined room","19:12:53 GMT+0200":"[myPeerName]: > has joined room","19:13:23 GMT+0200":"[me]: < has left room","19:13:46 GMT+0200":"[me]: > has joined room","19:13:57 GMT+0200":"[me]: < has left room"}"
script: "Apr 19 19:14:00.026 myPeerName:    <-- received room ping"
script: "Apr 19 19:14:00.044 myPeerName: ...stopping join timout thread."
script: "Apr 19 19:14:00.044 myPeerName: <-- access to room interop-test-120426 confirmed."
SCRIPT_RX: bus peers remote left me 8daALfn1eUNDWTkadizbBY
script: "Apr 19 19:14:01.570 myPeerName:    --> remote peer 'me' - 8daALfn1eUNDWTkadizbBY  left room"
SCRIPT_RX: bus peers menu clear
SCRIPT_RX: bus peers done
SCRIPT_TX: unsubscribe /peer/8daALfn1eUNDWTkadizbBY/settings/#
SCRIPT_TX: unsubscribe /peer/8daALfn1eUNDWTkadizbBY/rack/+/+/loaded
SCRIPT_TX: unsubscribe /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.19/device/#
SCRIPT_TX: unsubscribe /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.18/device/#
SCRIPT_TX: unsubscribe /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.17/device/#
SCRIPT_TX: unsubscribe /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.16/device/#
SCRIPT_TX: unsubscribe /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.15/device/#
SCRIPT_TX: unsubscribe /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.14/device/#
SCRIPT_TX: unsubscribe /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.13/device/#
SCRIPT_TX: unsubscribe /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.12/device/#
SCRIPT_TX: unsubscribe /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.11/device/#
SCRIPT_TX: unsubscribe /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.10/device/#
SCRIPT_TX: unsubscribe /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.9/device/#
SCRIPT_TX: unsubscribe /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.8/device/#
SCRIPT_TX: unsubscribe /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.7/device/#
SCRIPT_TX: publish 1 /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.7/device/gui/localudp/enableTwo
SCRIPT_TX: publish 1 /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.7/device/gui/localudp/inputIP
SCRIPT_TX: publish 1 /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.7/device/gui/localudp/inputPort
SCRIPT_TX: publish 1 /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.7/device/gui/localudp/outputIPOne
SCRIPT_TX: publish 1 /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.7/device/gui/localudp/outputIPTwo
SCRIPT_TX: publish 1 /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.7/device/gui/localudp/outputPortOne
SCRIPT_TX: publish 1 /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.7/device/gui/localudp/outputPortTwo
SCRIPT_TX: publish 1 /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.7/device/gui/description
SCRIPT_TX: publish 1 /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.7/device/gui/enable
SCRIPT_TX: publish 1 /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.7/device/gui/inputIndicator
SCRIPT_TX: publish 1 /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.7/device/gui/outputIndicator
SCRIPT_TX: publish 1 /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.7/device/gui/reset
SCRIPT_TX: publish 1 /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.7/device/gui/localudp/listeningIP
SCRIPT_TX: publish 1 /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.7/device/gui/localudp/defaultLocalIP
SCRIPT_TX: publish 1 /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.7/device/gui/direction/select
SCRIPT_TX: publish 1 /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.7/device/gui/direction/enableNatNet
SCRIPT_TX: publish 1 /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.7/device/gui/natnet/defaultLocalIP
SCRIPT_TX: publish 1 /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.7/device/gui/natnet/autoReconnect
SCRIPT_TX: publish 1 /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.7/device/gui/natnet/cmdPort
SCRIPT_TX: publish 1 /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.7/device/gui/natnet/codec
SCRIPT_TX: publish 1 /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.7/device/gui/natnet/dataPort
SCRIPT_TX: publish 1 /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.7/device/gui/natnet/frameModulo
SCRIPT_TX: publish 1 /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.7/device/gui/natnet/invmatrix
SCRIPT_TX: publish 1 /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.7/device/gui/natnet/leftHanded
SCRIPT_TX: publish 1 /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.7/device/gui/natnet/matrix
SCRIPT_TX: publish 1 /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.7/device/gui/natnet/motiveIP
SCRIPT_TX: publish 1 /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.7/device/gui/natnet/multicastIP
SCRIPT_TX: publish 1 /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.7/device/gui/natnet/sendMarkerInfos
SCRIPT_TX: publish 1 /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.7/device/gui/natnet/sendSkeletons
SCRIPT_TX: publish 1 /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.7/device/gui/natnet/verbose
SCRIPT_TX: publish 1 /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.7/device/gui/natnet/yUp
SCRIPT_TX: publish 1 /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.7/device/gui/monitor/monitorGate
SCRIPT_TX: publish 1 /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.7/device/gui/monitor/log
SCRIPT_TX: publish 1 /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.7/device/gui/indicators
SCRIPT_TX: publish 1 /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.7/device/gui/enableTwo
SCRIPT_TX: unsubscribe /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.6/device/#
SCRIPT_TX: unsubscribe /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.5/device/#
SCRIPT_TX: unsubscribe /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.4/device/#
SCRIPT_TX: unsubscribe /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.3/device/#
SCRIPT_TX: unsubscribe /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.2/device/#
SCRIPT_TX: unsubscribe /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.1/device/#
SCRIPT_TX: unsubscribe /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.0/device/#
SCRIPT_TX: publish 1 /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.0/device/gui/localudp/enableTwo
SCRIPT_TX: publish 1 /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.0/device/gui/localudp/inputIP
SCRIPT_TX: publish 1 /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.0/device/gui/localudp/inputPort
SCRIPT_TX: publish 1 /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.0/device/gui/localudp/outputIPOne
SCRIPT_TX: publish 1 /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.0/device/gui/localudp/outputIPTwo
SCRIPT_TX: publish 1 /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.0/device/gui/localudp/outputPortOne
SCRIPT_TX: publish 1 /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.0/device/gui/localudp/outputPortTwo
SCRIPT_TX: publish 1 /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.0/device/gui/description
SCRIPT_TX: publish 1 /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.0/device/gui/enable
SCRIPT_TX: publish 1 /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.0/device/gui/inputIndicator
SCRIPT_TX: publish 1 /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.0/device/gui/outputIndicator
SCRIPT_TX: publish 1 /peer/8daALfn1eUNDWTkadizbBY/rack/page_0/channel.0/device/gui/reset


---

## Case 11 — Peer leaves (Max quits while NG watches)

**Steps:**
1. With both in the room, quit Max.

**Expected on NG:**
- Log shows `peers:remote:left` for the Max peer id.
- Log shows `UNSUB /peer/<maxPeerId>/#`.
- Matrix drops the Max peer row.

**Result:** 

[19:15:13.774] UNSUB /peer/d7L5RMzRV8QYD5ASA8YPFS/#

---

## Summary (first run)

| Case | Result | Notes                                                                                              |
| ---- | ------ | -------------------------------------------------------------------------------------------------- |
| 1    | pass   | Broker connect works                                                                               |
| 2    | pass   | Init sequence: SUB + 20× loaded 0 + settings + DeviceRouter loads channel.0                        |
| 3    | pass   | Max join received on NG (SUB + all 20 loaded 0 + settings RECVs)                                   |
| 4    | warn   | NG defaults correct, then Max echoes `outputIPOne/IPTwo/peerLocalIP` as `0` → NG accepted → UI 0   |
| 5    | warn   | Same zero-overwrite pattern on remote panel edits                                                  |
| 6    | pass   | Disable → remove cascade publishes `enable 0` then `loaded 0`                                      |
| 7    | pass   | Max-creates-on-NG: `loaded 1` arrives last, `publishDefaults()` overrides zeros                    |
| 8    | warn   | Same zero-overwrite on channel.5 after NG defaults                                                 |
| 9    | pass   | `rack.json` round-trips `192.168.1.101` at channels 0/5/12                                         |
| 10   | pass   | Peer-left cascade: UNSUB of all Max device subtrees                                                |
| 11   | pass   | Single UNSUB `/peer/<maxPeerId>/#` on quit                                                         |

**Root cause (Cases 4/5/8):** Max publishes placeholder `0` values for `outputIPOne`, `outputIPTwo`, `peerLocalIP` into NG's own subtree ~50ms after NG's `publishDefaults()`. `OscDevice.onTopicChanged` blindly overwrote the stored IPs.

**Fix applied:** [src/main/devices/OscDevice.ts:94-99](../../src/main/devices/OscDevice.ts#L94-L99) — ignore `""` and `"0"` writes on `outputIPOne`/`outputIPTwo`.

---

## Post-fix verification

**Preconditions:**

- The OscDevice IP-guard patch at [src/main/devices/OscDevice.ts:94-99](../../src/main/devices/OscDevice.ts#L94-L99) is applied.
- NG has been rebuilt and relaunched (`npm run dev` — the fix is in main-process code, a renderer HMR reload is not enough).
- Any stale broker-retained state from the first run has been cleared: either use a fresh room name, or quit NG cleanly so its teardown publishes empty-string retained messages for all of its topics.
- `rack.json` from the first run has been deleted (or inspected and confirmed free of `"0"` IP values) so a stale persisted rack doesn't mask the fix.
- Max gateway is running on Host B, on the same broker, ready to join the same room.
- The Activity log panel is open and cleared before each case.

Re-run these after the above is in place. Each should pass with the local peer's real IP (`192.168.1.101`) visible in the UI throughout the flow.

### Case 4b — Create OSC device on NG (re-test)

**Check:**

- [ ] After creating channel 0, the OSC panel shows `outputIPOne = 192.168.1.101` (not `0`).
- [ ] `outputIPTwo = 192.168.1.101`.
- [ ] `peerLocalIP = 192.168.1.101` (UI field in "Receiving at" section).
- [ ] No UI flicker to `0` during Max's echoes.

**Result:** confimed that all three IP fields show the correct IP without flickering to `0` at any point.

### Case 5b — Configure OSC device on NG (re-test)

**Check:**

- [ ] Toggle enable ON still works.
- [ ] Setting `outputIPOne` to `127.0.0.1` persists (user value not reverted by Max echo).
- [ ] `enable=1` locks the panel per §5.3.

**Result:** confirmed that user-set `outputIPOne` is not overwritten by Max echoes, and that enabling the device still locks the panel as expected.

### Case 8b — NG creates channel.5 with Max echoes (re-test)

**Check:**

- [ ] Channel 5 shows `192.168.1.101` for both `outputIPOne` and `outputIPTwo`.
- [ ] No zero-overwrite in the log flow for channel.5 IP fields.

**Result:** confirmed that channel.5 also shows the correct IPs without any zero-overwrite logs.

### Case 9b — Rack persistence after re-test
**Check:**

- [ ] `rack.json` still has `"outputIPOne": "192.168.1.101"` for any loaded channel.
- [ ] No `"0"` values leaked into the persisted rack.

**Result:** `confirmed that the persisted `rack.json` contains the correct IP values for all channels, with no `0` entries.

---

## Gate decision

- All ✅ → M1 closed; proceed to M2 planning.
- Any ❌ → fix before M2.
- Any ⚠️ → evaluate per-case whether it blocks M2.

**First-run verdict:** ⚠️ — three cases blocked by the IP zero-overwrite bug. Fix applied; awaiting re-verification of 4b/5b/8b/9b.

**Notes / surprises:**

- Max publishes `peerLocalIP`/`outputIPOne`/`outputIPTwo` as `0` into the *remote* peer's subtree — an undocumented Max-side behavior that looks like a reset-path artifact. NG now defensively ignores these values on its own subtree.
- Case 5 shows Max also publishing its *own* local IP (`10.18.152.229`) into NG's subtree — confirmed harmless because NG's subsequent user edits take precedence, but worth documenting for M2 cross-peer edit semantics.
- Subscription narrowing (spec deviation) deferred per Q5=C, tracked for M2.
