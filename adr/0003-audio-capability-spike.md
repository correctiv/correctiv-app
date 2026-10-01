# ADR 0003 — Audio spike: NativeScript can do what the scope demands (Android)

**Status:** gate passed · **Date:** 2026-08-01 · **Affects:** stack decision, audio architecture

## Why this spike

`APP-STRATEGIE.md` §8 makes the recommendation "stay on NativeScript" conditional on
exactly one check — the last open point of failure:

> Can the audio stack play a stream with an **Authorization header** — in the
> background, with lock-screen controls, and downloaded for offline use?

What prompted it: the plugin in use, `@nativescript-community/audio`, offers **no**
header option. `AudioPlayerOptions` knows `audioFile`, `loop`, `autoPlay`, `metering`,
`pitch`, the callbacks, `audioMixing`, `seek`, the iOS session options, `audioStreamType`
and `dataSource` — nothing for HTTP headers. The scope, however, calls for a "separate
Castopod behind secret auth that only the app can talk to". No headers, no exclusive
podcasts.

## Setup

`scripts/spike-audio-server.mjs` serves the bundled sample episode and **requires
`Authorization: Bearer spike-token`; 401 without the header**. That makes a passing test
proof rather than coincidence. Range requests are supported, because Android's
MediaPlayer issues them.

`apps/mobile/src/spike/audio-spike.ts` runs the tests against the **platform API
directly**, bypassing the plugin, and logs with the prefix `SPIKE:`. To enable:
`RUN_AUDIO_SPIKE = true` in `src/app.ts` (default `false`), start the server, deploy,
`adb logcat | grep SPIKE:`.

## Results — all passed, on Android

| Test | Result | Evidence |
|---|---|---|
| T1 server enforces auth | **PASS** | refused without the header; server log shows `ua=stagefright/1.2` → 401 |
| T2 authenticated stream plays | **PASS** | `isPlaying=true pos=1454ms duration=97475ms` |
| T3 MediaSession (lock screen) | **PASS** | system: `Media button session is org.correctiv.app.prototype/CorrectivSpikeSession`, `state=PLAYING(3)`, `metadata: CORRECTIV Spike-Episode, Salon5` |
| T4 authenticated download | **PASS** | `ua=AndroidDownloadManager/16` with the header → 200; file complete (779,800 bytes) |
| T5 background playback | **PASS** | after HOME the position kept advancing: 11.5 s → 31.5 s, session active |

Confirmed server-side, i.e. independently of the client:

```
[16] GET /audio.mp3 | authorization=Bearer spike-token | range=bytes=517528- | ua=stagefright/1.2  -> 206
[18] GET /audio.mp3 | authorization=Bearer spike-token | ua=AndroidDownloadManager/16              -> 200
```

**No native module is needed.** Everything runs in TypeScript over the Android API
NativeScript exposes.

## Two NativeScript traps found along the way

**1. Overload resolution with two arguments.** `setDataSource(String, Map<String,String>)`
exists and is typed — but the call **kills the process**:

```
JNI DETECTED ERROR IN APPLICATION: bad arguments passed to
void android.media.MediaPlayer.setDataSource(android.content.Context, android.net.Uri)
```

NativeScript's runtime resolution cannot tell `(String, Map)` from `(Context, Uri)` and
picks the wrong one — the same mistake `tsc` makes. The **three-argument** form
`setDataSource(Context, Uri, Map)` is unambiguous, needs no cast and works.

**2. Abstract Java classes need `.extend()`.** `new MediaSession.Callback({ onPlay })`
fails with `Cannot marshal JavaScript argument [object Object] at index 0 to Java type.`
The correct form is `MediaSession.Callback.extend({ onPlay, onPause })`, then
`new Impl()`.

Both are commented in `audio-spike.ts`, so the later production implementation does not
lose the same two days.

## What this does NOT prove

- **Android only.** iOS is unchecked. The route there is a different one: `AVURLAsset`
  with `AVURLAssetHTTPHeaderFieldsKey` for the headers, `MPNowPlayingInfoCenter` +
  `MPRemoteCommandCenter` instead of MediaSession, and the `audio` background mode in
  Info.plist. The code comment in the repo also says `AVAudioPlayer` cannot do live
  streams. **That is the next spike** — the effort is therefore not proven, only
  plausible.
- **T5 without a foreground service.** Playback survived the switch to the background
  for over 30 s, but without a foreground service Android will eventually kill the
  process. Production needs a `MediaSessionService`; the permissions
  (`FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_MEDIA_PLAYBACK`, `WAKE_LOCK`) are already
  in the manifest.
- **The plugin is bypassed.** The production route is: drop
  `@nativescript-community/audio` and rewrite `stores/audio.ts` against the platform
  API — the ~600 LOC rewrite from the effort estimate, now with feasibility
  demonstrated.

## 1. Consequence for the stack decision

The gate set in `APP-STRATEGIE.md` §8 is **passed on Android**. The strongest remaining reason to switch to
Expo — "authenticated background audio only works with hand-written native modules" — is
refuted. The recommendation "stay on NativeScript" stands.

The iOS side stays open. It does not change the recommendation, because it would be work
under Expo too, but it belongs before beta planning.

## Artefacts

- `apps/mobile/src/spike/audio-spike.ts` — the tests, commented
- `scripts/spike-audio-server.mjs` — the 401 server
- `apps/mobile/App_Resources/Android/src/main/res/xml/network_security_config.xml` —
  cleartext for `10.0.2.2`/`localhost` only, so the emulator can reach the local test
  server. Irrelevant for production, but useful for any further on-device spike.
