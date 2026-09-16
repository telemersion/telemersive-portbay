# Leaving & quitting

## Leaving a room

Go to **Session** and press **leave**.

Leaving stops all of your devices and clears your rack from the broker, so other
peers see your row disappear. It does **not** disconnect you from the router —
you stay connected and can join another room straight away.

Your rack is saved to disk before it is cleared from the broker, so rejoining the
same room brings your devices back.

## Disconnecting

**disconnect** on the Session view leaves the room first if you are in one, then
drops the broker connection. Use it when you want to change router credentials,
which are locked while connected.

## Quitting

Close the window, or quit from the application menu. There is no "save before
quitting?" prompt — there is nothing to decide, because everything has already
been saved.

On quit, Portbay:

1. writes settings and rack to disk
2. stops every running device and its command-line process
3. clears its retained state from the broker, so other peers see you leave
   cleanly rather than as a ghost row
4. disconnects from the router

This takes a moment. Let it finish rather than force-quitting.

!!! warning "Force-quitting leaves a ghost"
    Killing the app skips step 3, so your retained state stays on the broker and
    your row keeps appearing in the room until the broker is cleaned up.
    Rejoining and leaving properly clears it.

## When the broker is unreachable

If the connection drops while devices are running, **the media keeps flowing.**
Streams go peer-to-peer or through the router's proxies over UDP; none of it
passes through the broker. What you lose is *control* — you cannot switch
anything on or off, add devices or see other peers' changes, because every
interaction needs the round trip through the broker.

A performance in progress will survive a broker hiccup. Your ability to change
it will not.

## Crashes in the media tools

If UltraGrid or NatNetFour2OSC exits unexpectedly, Portbay does **not** restart
it. It publishes `enable 0` for that device and writes the tool's error output to
the monitor log, then waits for you.

This is on purpose. A tool that dies because a capture device vanished or a port
is taken will die again immediately, and a silent restart loop hides the real
problem. Open the device's monitor, read what it said, fix that, switch the
device back on.
