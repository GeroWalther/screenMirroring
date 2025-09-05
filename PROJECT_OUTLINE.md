# Project Blueprint: Electron Sender (Mac/Windows) → **React Native** Receiver (Google TV) via WebRTC

## 0) Goal & Success Criteria

- **Goal:** Low-latency, reliable screen mirroring from desktop (Mac/Windows) to Google TV (Android TV) over LAN, with optional audio.
- **Latency target (glass-to-glass, 1080p30 on Wi-Fi 5/6):** P50 ≤ 150 ms, P95 ≤ 250 ms.
- **Stability:** ≥ 2 hours continuous session; graceful recovery from Wi-Fi hiccups.
- **Compatibility:** macOS 12+, Windows 10/11; Google TV devices on Android 10+.

---

# Phase 1 — Foundations (Signaling + Basic A/V)

## Architecture Overview

- **Sender (Electron app)**

  - **Capture:** `navigator.mediaDevices.getDisplayMedia({ video, audio })`
  - **Transport:** WebRTC (Chromium) with **H.264** preferred; **Opus** for audio
  - **Control:** local preview; bitrate/FPS caps; room code input

- **Receiver (Android TV, React Native)**

  - **react-native-webrtc** (`RTCPeerConnection`, `RTCView`) over native libwebrtc
  - Full-screen video via `<RTCView>`; audio via default WebRTC audio path

- **Signaling Service (Node.js)**

  - WebSocket hub for SDP/ICE exchange; ephemeral “room” per session
  - Optional REST health/metrics

## Deliverables

- Node signaling server
- Electron sender: screen capture → offer → ICE → local preview
- RN receiver: answer → ICE → render on TV

## Exit Criteria

- 1080p30 video renders on TV on same LAN; user can pick display/window; basic audio path works (mic if system audio unavailable)

## Key Implementation Details

### Signaling: Message Schema (WebSocket)

```json
// Client -> Server
{ "type": "join", "role": "offerer|answerer", "room": "abc123" }
{ "type": "signal", "room": "abc123", "to": "offerer|answerer", "data": { "sdp": {...} | "ice": {...} } }
// Server -> Client
{ "type": "signal", "data": { "sdp": {...} | "ice": {...} } }
```

### SDP Tweaks (Sender)

- Prefer **H.264** on the video m-line (Android TV is most predictable on H.264)
- Initial offer constraints:

  - **maxBitrate:** 6–10 Mbps (via `RTCRtpSender.setParameters`)
  - **frameRate:** 30 (allow 60 for 720p profiles)
  - **Keyframe interval:** \~1–2 s (where exposed)

### ICE/TURN

- Start with **STUN** only: `stun:stun.l.google.com:19302`
- Add **TURN (coturn)** for off-LAN; enable UDP+TCP; long-term creds
- **LAN-only mode:** allow mDNS ICE; optionally block relay candidates

### Electron Sender: App Structure

```
/electron
  main.js                  // BrowserWindow, app lifecycle
  /renderer
    index.html
    sender.js              // WebRTC, SDP/ICE, capture, preview, controls
    ui.js                  // picker, bitrate/FPS presets, PIN entry
  /shared
    signaling.js           // WS client
```

- **Capture:** `getDisplayMedia({ video:{ frameRate:30, displaySurface:"monitor" }, audio:true })`
- **System audio:** Windows—often OK; macOS—permission/Chromium dependent. Provide mic fallback or virtual device toggle.
- **Bitrate control:** `RTCRtpSender.setParameters({ encodings:[{ maxBitrate, maxFramerate, scaleResolutionDownBy }] })`
- **H.264 preference:** reorder payloads in SDP offer

### React Native Receiver (Android TV): Project Structure

```
/android-tv-rn
  /android
  /ios                   // unused for TV but present in RN repo
  /src
    Receiver.tsx         // WebRTC recv-only flow + UI
    signaling.ts         // WS client
    store.ts             // minimal state (ICE/SDP/status)
```

**Dependencies**

```bash
yarn add react-native-webrtc
# (If not already) yarn add react-native-safe-area-context
cd android && ./gradlew clean
```

**Android Manifest / TV config**

- Add Leanback launcher + banner so it appears on TV home:

```xml
<intent-filter>
  <action android:name="android.intent.action.MAIN" />
  <category android:name="android.intent.category.LEANBACK_LAUNCHER" />
</intent-filter>
<meta-data android:name="com.google.android.tv.banner" android:resource="@drawable/banner" />
```

- Permissions: `INTERNET`, `WAKE_LOCK`, keep screen on
- **ABI filter:** most Google TV is `arm64-v8a`

  ```gradle
  android {
    defaultConfig { ndk { abiFilters "arm64-v8a" } }
    packagingOptions { pickFirst "**/*.so" }
  }
  ```

- **Hermes** on (release), Proguard/R8 keep rules for WebRTC JNI (usually handled by the package)
- Keep activity in **immersive fullscreen**; lock to landscape

**Receiver core (RN)**

```tsx
// src/Receiver.tsx
import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, StatusBar } from 'react-native';
import {
  RTCPeerConnection,
  RTCIceCandidate,
  RTCSessionDescription,
  RTCView,
} from 'react-native-webrtc';

const ROOM = 'livingroom';
const SIGNAL_URL = 'ws://<SIGNALING_IP>:8080';

export default function Receiver() {
  const [stream, setStream] = useState<any>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });
    pcRef.current = pc;
    pc.ontrack = (e) => setStream(e.streams[0]);

    const ws = new WebSocket(SIGNAL_URL);
    wsRef.current = ws;
    ws.onopen = () =>
      ws.send(JSON.stringify({ type: 'join', role: 'answerer', room: ROOM }));
    ws.onmessage = async (evt) => {
      const { type, data } = JSON.parse(evt.data);
      if (type !== 'signal') return;
      if (data.sdp && data.sdp.type === 'offer') {
        await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        ws.send(
          JSON.stringify({
            type: 'signal',
            room: ROOM,
            to: 'offerer',
            data: { sdp: pc.localDescription },
          })
        );
      }
      if (data.ice)
        try {
          await pc.addIceCandidate(new RTCIceCandidate(data.ice));
        } catch {}
    };
    pc.onicecandidate = (e) => {
      if (e.candidate)
        ws.send(
          JSON.stringify({
            type: 'signal',
            room: ROOM,
            to: 'offerer',
            data: { ice: e.candidate },
          })
        );
    };
    return () => {
      ws.close();
      pc.close();
    };
  }, []);

  return (
    <View style={styles.root}>
      <StatusBar hidden />
      {stream ? (
        <RTCView
          streamURL={stream.toURL()}
          style={styles.video}
          objectFit='contain'
        />
      ) : null}
    </View>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  video: { flex: 1 },
});
```

**TV input & UX**

- D-pad focus only if you add menus (use focusable `Pressable` / key handlers)
- Keep-awake during session (wake lock or RN module)
- Single activity, auto-relaunch last room if desired

---

# Phase 2 — UX, Security & Resilience

## Features

- **Pairing & Access Control**

  - 6-digit **PIN** shown on receiver; sender must enter
  - Server stores salted PIN hash with short **TTL**

- **Discovery**

  - Optional **mDNS/Bonjour**: `_screenshare._tcp.local` advertising signaling URL + device name
  - Manual IP\:port entry fallback

- **Session Management**

  - Reconnect logic (WS + PC) with backoff
  - Heartbeats; auto-cleanup dead rooms

- **Adaptive Profiles (sender UI)**

  - **Cinema:** 1080p30 @ \~8 Mbps
  - **Smooth:** 720p60 @ \~6 Mbps
  - **Battery Saver:** 900p30 @ \~4 Mbps
  - Auto downscale on packet loss (increase `scaleResolutionDownBy`, drop framerate)

- **Cursor overlay**

  - Electron shows OS cursor; add optional highlight overlay (canvas)

- **Window selection**

  - Use `getDisplayMedia` picker; “Share audio” checkbox; remember last choice

## Exit Criteria

- PIN-protected pairing; seamless reconnect after Wi-Fi hiccup; selectable profiles; stable 2-hour run

---

# Phase 3 — Performance & Audio Polish

## Targets & Instrumentation

- **Metrics:** glass-to-glass latency, sender encode time, receiver decode/render time, bitrate, packet loss, PLI/FIR, ICE state durations
- **Collection:**

  - **Sender:** `pc.getStats()` → periodic JSON to server (room-scoped)
  - **Receiver (RN):** `pc.getStats()`; render FPS via a lightweight RN overlay; Android dropped frames via native logs (optional)
  - Local ring buffer + export

## Optimizations

- **Latency**

  - Lower jitter target where available; prioritize UDP; prefer host/srflx over relay in LAN mode
  - Don’t capture full 4K if the TV is 1080p—downscale first

- **Audio**

  - If macOS system audio is unavailable: guide to virtual device or mic loopback with AEC off (video-first sync)

- **RN specifics**

  - Keep `<RTCView>` isolated to avoid re-renders; memoize overlays
  - Use **release builds** (Hermes enabled); avoid dev menu/remote debug in tests

- **Renderer**

  - RN-WebRTC uses hardware decode/EGL; keep TV at 60 Hz; use 60 fps only for 720p

## Exit Criteria

- P50 latency ≤ 150 ms; no frame stalls > 1 s in 2 h; continuous audio without drift

---

# Phase 4 — Hardening, Packaging & CI/CD

## Packaging

- **Electron:** code-sign (macOS notarization, Windows Authenticode), optional auto-update
- **RN Android TV APK/AAB:** proper **applicationId**, **LEANBACK** launcher intent, banner art; internal testing or sideload via `adb`

## Telemetry & Crash Reporting

- Desktop: Sentry/Crashpad
- RN Android: Sentry for RN + Firebase Crashlytics (native crashes)

## Security

- **WSS** for signaling
- **PIN + room TTL + single active pairing**
- Hide TURN creds in server; LAN-only mode disables relay usage
- Regular dependency audits (npm/Gradle)

## CI/CD (GitHub Actions example)

- Lint + unit tests
- **Electron:** build for macOS/Windows
- **RN Android:** `./gradlew assembleRelease` (arm64-v8a)
- Docker image for signaling server

---

# Non-Functional Requirements

| Area       | Requirement                            |
| ---------- | -------------------------------------- |
| Latency    | P50 ≤ 150 ms (1080p30), P95 ≤ 250 ms   |
| Throughput | 4–12 Mbps sustained                    |
| Start Time | First frame ≤ 5 s after pairing        |
| Recovery   | Network blip < 10 s → auto-resume      |
| Power      | Laptop CPU < 30% at 1080p30            |
| Privacy    | No media persisted; metrics anonymized |

---

# Testing Plan

## Matrix

- **OS:** macOS 12–14; Windows 10/11
- **Displays:** single 1080p; dual 1440p/4K
- **TVs:** Chromecast with Google TV (HD/4K), Sony/Philips/Hisense Android TV
- **Network:** Wi-Fi 5 vs Wi-Fi 6; 2.4 GHz worst-case; Ethernet on TV

## Scenarios

- Start/stop; window vs full desktop; audio on/off
- Weak signal (attenuate AP), room change; router reboot (auto-resume)
- Long session soak (2–4 h)
- PIN brute-force protection (lockout/backoff)

---

# Example Skeletons (brief)

## Electron (Sender) — core flow

```js
// createPeerConnection.js
export function createPC(onIce, onState) {
  const pc = new RTCPeerConnection({
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
  });
  pc.onicecandidate = (e) => e.candidate && onIce(e.candidate);
  pc.onconnectionstatechange = () => onState(pc.connectionState);
  return pc;
}

// sender.js
const pc = createPC(sendIceToAnswerer, setState);
const stream = await navigator.mediaDevices.getDisplayMedia({
  video: { frameRate: 30 },
  audio: true,
});
stream.getTracks().forEach((t) => pc.addTrack(t, stream));
let offer = await pc.createOffer();
offer.sdp = preferH264(offer.sdp);
await pc.setLocalDescription(offer);
sendSdpToAnswerer(pc.localDescription);
```

## React Native (Receiver) — core flow

```tsx
const pc = new RTCPeerConnection({
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
});
pc.ontrack = (e) => setStream(e.streams[0]);

ws.send(JSON.stringify({ type: 'join', role: 'answerer', room: ROOM }));

// When offer arrives:
await pc.setRemoteDescription(new RTCSessionDescription(offer));
const answer = await pc.createAnswer();
await pc.setLocalDescription(answer);
ws.send(
  JSON.stringify({
    type: 'signal',
    room: ROOM,
    to: 'offerer',
    data: { sdp: pc.localDescription },
  })
);

// Render:
<RTCView streamURL={stream.toURL()} style={styles.video} objectFit='contain' />;
```

**Android Manifest bits**

```xml
<uses-permission android:name="android.permission.INTERNET"/>
<uses-permission android:name="android.permission.WAKE_LOCK"/>

<intent-filter>
  <action android:name="android.intent.action.MAIN"/>
  <category android:name="android.intent.category.LEANBACK_LAUNCHER"/>
</intent-filter>
<meta-data android:name="com.google.android.tv.banner" android:resource="@drawable/banner"/>
```

**Gradle (ABI)**

```gradle
android { defaultConfig { ndk { abiFilters "arm64-v8a" } } }
```

---

# Risks & Mitigations

- **macOS system audio capture** inconsistent → ship mic fallback + doc virtual device option
- **Codec quirks** on some TVs → force H.264 Baseline/Main; avoid High until tested
- **Wi-Fi congestion** → expose bitrate/FPS controls; recommend 5 GHz/Ethernet; adaptive downscale
- **RN on TV specifics** (focus, banners, ABI) → add Leanback config, D-pad testing, arm64 build; keep `<RTCView>` stable to avoid re-mounts

---

# Backlog (prioritized)

1. H.264 preference & bitrate/FPS presets
2. PIN pairing, room TTL, WSS
3. Adaptive downscale on packet loss
4. Reconnect & resume (WS + PC)
5. mDNS discovery + friendly device names
6. Stats overlay (fps, kbps, RTT, dropped frames)
7. Settings persistence; auto-launch last room
8. TURN for off-LAN (optional)

---

# Acceptance Checklist (per release)

- [ ] 1080p30 stable for 2 h on Wi-Fi 5
- [ ] Latency P50 ≤ 150 ms; P95 ≤ 250 ms (camera sync/LED test)
- [ ] PIN pairing enforced; rooms auto-expire
- [ ] Clean teardown (no stuck tracks/sockets)
- [ ] Crash-free sessions across matrix

---
