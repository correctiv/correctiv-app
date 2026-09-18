import { defineMessages, useIntl } from 'react-intl';

import type { VideoFrameProps } from './videoFrameTypes';

/**
 * The frame's name, in ENGLISH; the German ships in
 * `src/i18n/catalogue/de/video.ts` (ADR 0026 §6). An iframe's `title` is what a
 * screen reader reads for the whole embed, which makes it user-facing even
 * though the word was already English.
 */
const COPY = defineMessages({
  frameTitle: {
    id: 'video.frameTitle',
    defaultMessage: 'Video',
    description:
      "The accessible name of the frame the video is embedded in, read aloud and never seen. `video.screenTitle` is the same word as the route's name and `video.kicker` the one above the title.",
  },
});

/**
 * The web branch: the same embed as a real `<iframe>`. react-native-webview has no
 * web implementation and would render "React Native WebView does not support this
 * platform." here — on a green build.
 *
 * `react-native-web` does not pass unknown elements through, so this file uses DOM
 * JSX on purpose. Metro resolves it on web only.
 */
export function VideoFrame({ uri, className }: VideoFrameProps) {
  const intl = useIntl();
  return (
    <iframe
      src={uri}
      className={className}
      title={intl.formatMessage(COPY.frameTitle)}
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
      allowFullScreen
      // The player needs scripts, its own origin (cross-origin, so that stays
      // youtube-nocookie.com — not ours) and presentation for full screen. Without
      // a sandbox the embed could also navigate the top-level page; that is the
      // capability being withheld here.
      sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
      style={{ width: '100%', height: '100%', border: 0 }}
    />
  );
}
