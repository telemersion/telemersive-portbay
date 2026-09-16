# Max compatibility

Telemersive Gateway exists in two implementations: this standalone application,
and the original **Max/MSP patch** it replaces. They carry the same name because
they are the same thing to the rest of the room — and this page is about the one
place where the distinction matters.

Throughout the documentation, "the Gateway" means this application and "the Max
gateway" means the Max/MSP version.

## They work in the same room

The standalone app speaks the Max gateway's protocol exactly — the same MQTT
topics, the same values, the same retain flags, the same application version
string on the wire. A Max gateway cannot tell that its neighbour is not another
Max gateway.

So you can:

- run the standalone app at one location and the Max gateway at another
- migrate a group one machine at a time
- drive a Max gateway's devices from the standalone app, and the reverse

Everything works because nothing about the shared data changed.

## What did change

The interface, and only the interface.

| Max gateway | Standalone app |
| --- | --- |
| Runs inside Max, installed as a package | Standalone application |
| Needs the Zero and Spout/Syphon Max packages | Needs nothing beyond UltraGrid (and NatNetFour2OSC on Windows) |
| `config` window with login / externals / debug / chat / ping tabs | [Session](../getting-started/first-session.md), [Settings](../guide/settings.md) and the [Activity log](../guide/activity-log.md) |
| Paths to external tools configured by hand | [Tools & compatibility](../getting-started/tools.md) check with Locate and Download |
| Devices expand in place in the matrix | Dockable, pinnable [panel row](../guide/devices.md#the-panel-row) |
| Peer info in the matrix | [Peer detail panel](../guide/peer-detail.md) |
| — | [Channel proxy indicators](../guide/channel-proxies.md) |
| — | Automatic updates |
| — | Saveable and loadable rack files |
| NatNetThree2OSC | NatNetFour2OSC, plus the new [Motive bridge](../devices/mocap.md#motive-bridge) |

## Consequences of freezing the protocol

Matching the Max gateway bit-for-bit was a deliberate choice, and it has costs
worth knowing about.

**No permission model.** The protocol has no concept of authorisation, so the
[lock](../guide/peer-detail.md#locking-your-row) is an interface convention that
any peer can ignore. The room password is the only real boundary.

**Everything goes through the broker.** Every interaction is published and acted
on only when it echoes back, which adds a broker round trip to every click. The
app could have shortcut its own actions locally, but then local and remote
changes would take different paths, and mixed rooms would drift apart.

**Twenty channels.** The room port range allows no more.

## Which should you run?

The standalone app, unless you need something only the Max version has. It
installs without Max, checks its own dependencies, updates itself, and the device
configuration is considerably less painful.

The Max gateway remains the right choice if your patch drives the gateway from
inside Max itself.

!!! note "This documentation covers the standalone application"
    For the Max/MSP version, see the
    [telemersive-gateway repository](https://github.com/telemersion/telemersive-gateway).

## A note on names

The repository and the published documentation URL still say
`telemersive-portbay`. Portbay was this application's working name during
development; the application itself is Telemersive Gateway. The repository name
is left alone so that existing links, release downloads and the auto-updater keep
working.
