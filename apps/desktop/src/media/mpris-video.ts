// A video pipeline, seen as an MPRIS source.
//
// ## Why this one reads the stream and the audio one reads the store
//
// They are not inconsistent, they are two different architectures underneath. Audio
// playback is OWNED by the core: `@correctiv/app-core/stores/audio` holds the intent,
// the backend reports, and a command that bypassed the store would desync it. Video
// playback is owned by `video/stream.ts` — the screen drives a `Gtk.MediaStream`
// directly and the core's video slice knows only WHICH video is on screen, not whether
// it is running. So the truth about playing/position/duration is the stream, and the
// truth about the title is the store, and this file joins them.
//
// ## Microseconds all the way through, for once
//
// `Gtk.MediaStream:timestamp` and `:duration` are microseconds, which is also MPRIS's
// unit. Nothing here converts, and that is worth a sentence only because every other
// seam in this app has to: the core's audio store is in seconds and GStreamer is in
// nanoseconds.

import { coreStore } from '@/lib/store/core';

import type { VideoStream } from '../video/stream.js';
import type { MprisHandle, MprisSource, MprisStatus, MprisTrack } from './mpris.js';

/**
 * The properties a change in which a shell needs to hear about.
 *
 * `timestamp` is deliberately NOT among them: it moves four times a second and MPRIS
 * keeps `Position` out of `PropertiesChanged` on purpose, so listening to it would be
 * 4 Hz of bus traffic to publish nothing.
 */
const WATCHED = [
  'notify::playing',
  'notify::ended',
  'notify::duration',
  'notify::seekable',
] as const;

function statusOf(stream: VideoStream): MprisStatus {
  if (stream.playing) return 'Playing';
  // ENDED IS STOPPED, not paused: a shell offering Pause for a finished video is
  // wrong, and `stream.ts` reports `ended` from the pipeline's own EOS.
  if (stream.ended) return 'Stopped';
  return stream.prepared ? 'Paused' : 'Stopped';
}

function trackOf(stream: VideoStream): MprisTrack | null {
  const video = coreStore.getState().video.current;
  if (video === null) return null;
  const duration = stream.duration;
  return {
    id: video.id,
    title: video.title,
    // THE SAME ONE-LINER THE SCREEN USES — `app/video.tsx`'s `VideoMeta` derives the
    // channel label this way too. Two call sites is where it stays; a third belongs in
    // a core selector rather than a second copy, because these two words are
    // user-facing text and this file is not a screen.
    artist: video.source === 'peertube' ? 'FunFacts' : 'CORRECTIV',
    artworkUrl: video.thumbnailUrl,
    // The stream's own duration once it is prepared, and the feed's until then: a
    // shell that reads the metadata during the first second would otherwise be told
    // the piece has no length and draw no seek bar for it.
    lengthUs:
      duration > 0 ? duration : Math.max(0, Math.round((video.durationSec ?? 0) * 1_000_000)),
  };
}

/**
 * Bind one video pipeline to `handle`, and answer the teardown.
 *
 * Claims immediately, because a video screen exists only while its video is the one on
 * screen — unlike audio, which outlives the screen that started it. The teardown
 * releases, which hands the name back to the radio if it was playing underneath.
 */
export function installVideoMpris(handle: MprisHandle, stream: VideoStream): () => void {
  const source: MprisSource = {
    get status() {
      return statusOf(stream);
    },
    get track() {
      return trackOf(stream);
    },
    get positionUs() {
      return Math.max(0, stream.timestamp);
    },
    get canSeek() {
      return stream.seekable;
    },
    get canPause() {
      return true;
    },
    play(): void {
      stream.play();
    },
    pause(): void {
      stream.pause();
    },
    stop(): void {
      // MPRIS `Stop` is "stop and go back to the start", which is a pause plus a seek
      // here: a `Gtk.MediaStream` has no third state to enter.
      stream.pause();
      if (stream.seekable) stream.seek(0);
    },
    seekBy(offsetUs: number): void {
      if (!stream.seekable) return;
      const target = stream.timestamp + offsetUs;
      stream.seek(Math.min(Math.max(0, target), stream.duration));
    },
    seekTo(positionUs: number): void {
      if (!stream.seekable) return;
      stream.seek(Math.min(Math.max(0, positionUs), stream.duration));
    },
  };

  handle.claim(source);
  const handlers = WATCHED.map((signal) => stream.connect(signal, () => handle.changed(source)));
  // The store carries the title and the artwork, so a video chosen while this pipeline
  // lives has to reach the bus as well.
  const unsubscribe = coreStore.subscribe(() => handle.changed(source));

  return (): void => {
    for (const id of handlers) stream.disconnect(id);
    unsubscribe();
    handle.release(source);
  };
}
