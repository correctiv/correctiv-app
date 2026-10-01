import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { View } from 'react-native';

import { useColors } from '@/lib/theme';

/** The frame sizes the image; the image never sizes the frame. Module scope, so
 *  the object is one reference rather than a new one on every render. */
const FILL = { width: '100%', height: '100%' } as const;

export type ThumbnailProps = {
  uri?: string | null;
  /** 16/9 for video, 1 for podcast covers. */
  aspectRatio: number;
  /** Centred over the image — the play mark, usually. */
  overlay?: ReactNode;
  /** Shown instead of the image when there is none. */
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  className?: string;
};

/**
 * A preview image that fails quietly.
 *
 * expo-image paints its own broken-image glyph on a black field when a thumbnail
 * cannot be loaded, and on this project that is the normal case rather than the
 * exception: three CORRECTIV hosts serve a Let's Encrypt chain that older Android
 * trust stores reject, and PeerTube thumbnails come and go. A missing image should
 * read as an empty frame, so it stays a gap in the content and not a defect in the
 * app.
 */
export function Thumbnail({
  uri,
  aspectRatio,
  overlay,
  icon = 'image-outline',
  className,
}: ThumbnailProps) {
  const colors = useColors();
  /**
   * WHICH image failed, not THAT one did.
   *
   * A boolean outlives the address it was set for: the same Thumbnail is reused
   * across a feed refresh and along a rail, so one unreachable host used to leave
   * the frame empty for every later image in that slot, with no way back. Keyed on
   * the URI, the state answers a question about the image currently being shown,
   * and a new address is simply not the failed one.
   */
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const failed = uri != null && failedUri === uri;

  return (
    <View
      className={['overflow-hidden bg-grey-300', className ?? ''].join(' ')}
      style={{ aspectRatio }}
    >
      {uri && !failed ? (
        <Image
          source={{ uri }}
          style={FILL}
          /*
           * DECORATIVE, which is the decision #102 left open here: the frame is a
           * cover beside a headline on a feed card and the only content of a rail
           * tile, and the same component renders both — so the question looked
           * unanswerable from inside it.
           *
           * It is answerable from outside. Every call site wraps this in a control
           * that carries `accessibilityRole` and an `accessibilityLabel` naming
           * the thing the picture is OF (`ArticleHero`, `MediaCard`, `SeriesTile`,
           * `MediathekReihe`), so a name here would be that name said twice. And
           * the picture is a cover: when it fails to load the frame draws a glyph
           * and nothing is lost, which is the test for decorative.
           *
           * `alt=""` is expo-image's own spelling and the one the browser reads;
           * `accessible={false}` is what keeps it off the native accessibility
           * tree, where an empty name would otherwise leave a focusable "image".
           */
          alt=""
          accessible={false}
          contentFit="cover"
          transition={200}
          // Thumbnails come back into view constantly — the rails scroll sideways
          // past the same covers, and Home re-renders them on every feed poll. The
          // default 'disk' re-decodes each time; the memory tier hands back the
          // decoded bitmap. `recyclingKey` is the other half: without it a reused
          // view keeps painting the previous cover until the new one has loaded.
          cachePolicy="memory-disk"
          recyclingKey={uri}
          onError={() => setFailedUri(uri)}
        />
      ) : (
        <View className="flex-1 items-center justify-center">
          <Ionicons name={icon} size={26} color={colors['stroke']} />
        </View>
      )}
      {overlay ? (
        <View className="absolute inset-0 items-center justify-center">{overlay}</View>
      ) : null}
    </View>
  );
}
