# 🎬 WatchRoom - Private 2-Person Synchronized Cinema

**WatchRoom** is a production-style, mobile-first web application designed specifically for two people to privately watch videos together remotely in real-time synchronization.

---

## ✨ Key Features & Capabilities

### 1. 🔒 Private 2-Person Watch Room
- **5-Character Room Codes**: Clean, unambiguous alphanumeric room codes (e.g. `AB7K9`).
- **Strict 2-Person Limit**: Enforces exactly 2 participants per room.
- **1-Click Share & Invite**: Direct link copying, QR Code generation for phone-to-phone scanning, and native mobile Web Share API integration (WhatsApp, Messages, Telegram).
- **Two-Person Presence**: Real-time status cards displaying **You** (🟢 Connected, latency) and **Friend** (🟢 Connected / 🔄 Buffering / ⚡ Seeking).
- **Privacy First**: Zero temporary room listing; rooms are automatically destroyed when inactive.

### 2. ⚡ Real-Time Playback Synchronization
- **Ultra-Lightweight Timestamp Sync**: Playback sync consumes `< 0.1 KB` per event, never re-streaming redundant video payloads.
- **Sync Events**: `play`, `pause`, `seek`, `buffering`, `rate`, and heartbeat drift alignment.
- **Loop Prevention**: Sender identification tags ensure actions executed locally are never re-echoed in a feedback loop.
- **Micro Sync Indicator**: Real-time floating status badge showing `🟢 Synced (Δ 0.04s)`, `⚡ Seeking...`, and `🔄 Friend Buffering...`.

### 3. 📱 Mobile-First Cinema Experience
- **Touch-Friendly Controls**: Oversized Play/Pause button, ↶ 10s rewind, ↷ 10s forward, scrub bar with preview time.
- **Gesture Controls**: Double-tap left/right video areas to skip 10 seconds with visual ripple feedback.
- **True Fullscreen & Landscape Orientation Lock**: Built-in support for standard and Webkit Fullscreen APIs.
- **Floating Emoji Reactions**: Live synced emoji bursts (❤️, 😂, 🍿, 😱, 🔥, 👏) floating over the video.
- **Collapsible Bottom Chat**: Real-time messaging with unread notification badges.

### 4. 📂 Multi-Source Video Engine
- **Local Movie Playback**:
  - Load movies (`.mp4`, `.webm`, `.mov`, `.mkv`) stored on your phone.
  - Played locally in browser memory with **zero server upload**.
  - **Secure WebRTC P2P Transfer**: Direct phone-to-phone encrypted chunk transfer with explicit user permission prompt, transfer speed meter (Mbps), progress bar, and ETA countdown.
- **YouTube Integration**: Official YouTube IFrame Player API integration for synchronized movie trailers and permitted videos.
- **Direct Web Streams**: Support for custom `.mp4` / `.webm` video URLs and built-in sample cinema shorts (Sintel, Big Buck Bunny, Tears of Steel).
- **DRM-Compliant Streaming Hub**:
  - Official deep-link launchers for **JioHotstar, ZEE5, Netflix, and Amazon Prime Video**.
  - Synchronized **3-2-1 Countdown Cue** so both friends press play in their respective apps at the exact same moment.
  - Fully compliant with platform DRM (Widevine/FairPlay) and copyright regulations.

### 5. 🌐 Low-Speed Internet & Data Saver Mode
- **Adaptive Data Saver**: Automatically engages when latency exceeds 200ms or on weak 2G/3G connections.
- **Quality Selector**: 144p, 240p, 360p, 480p, 720p, 1080p, and Auto resolution capping.
- **Network Health Indicator**: Live ping round-trip display with status (`Excellent`, `Good`, `Weak`, `Reconnecting`).
- **Resilient Reconnection**: Exponential backoff reconnects seamlessly after temporary network dropouts without losing room spot.

---

## 🚀 Getting Started

### Development Mode (with Hot Reloading)
```bash
npm run dev
```
- Client runs on `http://localhost:5173`
- Backend runs on `http://localhost:3001` (proxied automatically)

### Production Mode
```bash
npm run build
npm start
```
Server runs the unified production app on `http://localhost:3001`.
