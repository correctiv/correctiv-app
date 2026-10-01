// `expo-image`'s `Image`, on `Gtk.Picture`.
//
// One consumer in the app — `components/ui/Thumbnail.tsx` — and it is the component
// every cover, every episode tile and every video thumbnail goes through, so this is
// on the critical path for Home looking like anything at all.
//
// ## Why this is not React Native's `Image`
//
// `@gjsify/react-native` implements `Image` on `Gtk.Picture` and refuses anything but
// a local path, a `file:` URI or a `resource:` URI BY NAME. That refusal is correct
// — `Gtk.Picture` takes a `GFile` or a `GdkPaintable`, and neither is a URL — and it
// is exactly the gap ADR 0012 names as unanswered for this host ("remote-URL images:
// `Gtk.Picture` takes local paths, and the app is on `expo-image` rather than RN's
// `Image` in any case").
//
// The app's `uri` is never a local path. It is one of two things:
//
//   1. A `data:` URI, from the offline bundle. `npm run offline-articles` downscales
//      every cover and inlines it as base64, and `ContentBundle.image` hands those
//      back — so this is the path that Home actually renders offline, which is the
//      normal case for a demo with no network.
//   2. A remote `https:` URL from a live feed.
//
// Both are answered here: (1) decodes straight to a `Gdk.Texture`, (2) is fetched and
// then decoded. Nothing is cached beyond the process, so `cachePolicy` is accepted
// and ignored — named below rather than silently dropped.

import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';

export type ContentFit = 'cover' | 'contain' | 'fill' | 'none' | 'scale-down';

export interface ImageSource {
  uri?: string | null;
}

export interface ImageProps {
  source?: ImageSource | string | null;
  style?: Record<string, unknown>;
  contentFit?: ContentFit;
  /** Accepted; GTK cross-fades nothing here. See the header. */
  transition?: number;
  /** Accepted and ignored: this host holds no image cache. */
  cachePolicy?: string;
  recyclingKey?: string | null;
  onError?: () => void;
  className?: string;
  accessibilityLabel?: string;
  /**
   * expo-image's own spelling of the accessible name, and `Thumbnail` passes `alt=""`
   * to say the cover is decorative. Read below as the same thing `accessibilityLabel`
   * is read as — `Gtk.Picture:alternative-text` — because GTK has one property for
   * both and an empty string there is the same "nothing to announce".
   */
  alt?: string;
  /**
   * `accessible={false}`, which keeps the picture off the accessibility tree
   * altogether. Accepted and not acted on: `Gtk.Picture`'s counterpart is
   * `Gtk.Accessible:accessible-role: none`, which the layer does not expose on an
   * element this shim renders directly. The cost is an unnamed image node beside a
   * `Pressable` that already carries the name — a duplicate rather than a wrong label.
   */
  accessible?: boolean;
}

/** expo-image's `contentFit` values are `Gtk.ContentFit`'s nicks, bar one. */
const CONTENT_FIT: Readonly<Record<ContentFit, string>> = {
  cover: 'cover',
  contain: 'contain',
  fill: 'fill',
  none: 'none',
  // GTK has no `scale-down`. `contain` never enlarges past the natural size either,
  // which is the half of the meaning that matters for a thumbnail.
  'scale-down': 'contain',
};

const uriOf = (source: ImageProps['source']): string | null => {
  if (typeof source === 'string') return source;
  if (source && typeof source === 'object') return source.uri ?? null;
  return null;
};

/**
 * `data:` / `https:` -> a `Gdk.Texture`, or `null` with a reason.
 *
 * Split out because the two schemes differ only in where the bytes come from, and
 * the decode is the part that can fail on either.
 */
async function loadTexture(uri: string): Promise<unknown> {
  const [{ default: Gdk }, { default: GLib }] = await Promise.all([
    import('gi://Gdk?version=4.0'),
    import('gi://GLib?version=2.0'),
  ]);

  let raw: Uint8Array;
  if (uri.startsWith('data:')) {
    const comma = uri.indexOf(',');
    if (comma === -1) throw new Error('a data: URI with no comma');
    const meta = uri.slice(5, comma);
    const payload = uri.slice(comma + 1);
    if (!meta.includes('base64')) {
      throw new Error(`only base64 data: URIs are decoded here, got "${meta}"`);
    }
    raw = Uint8Array.from(GLib.base64_decode(payload));
  } else {
    // `fetch` is gjsify's, and the core already depends on it for every feed.
    const response = await fetch(uri);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    raw = new Uint8Array(await response.arrayBuffer());
  }

  return Gdk.Texture.new_from_bytes(new GLib.Bytes(raw));
}

/**
 * A picture.
 *
 * `Gtk.Picture` renders a `GdkPaintable`, which has to be built before there is
 * anything to show, so this holds the texture in state and renders an empty `View`
 * until it arrives. That empty box is the same shape the loaded picture will be,
 * because the SIZE comes from the caller's `style`/`className` rather than from the
 * image — `Thumbnail` always frames it with an `aspectRatio` — so nothing reflows
 * when the bytes land.
 *
 * `onError` is reported for real. `Thumbnail` uses it to swap in its Ionicons
 * fallback glyph, and that is the difference between a broken cover looking like a
 * deliberate placeholder and looking like a bug.
 */
export function Image({
  source,
  contentFit = 'cover',
  onError,
  className,
  style,
  accessibilityLabel,
}: ImageProps) {
  const uri = uriOf(source);
  const [paintable, setPaintable] = useState<unknown>(null);

  // `onError` is deliberately NOT a dependency of the effect below: `Thumbnail` passes
  // a fresh arrow every render, so including it would restart the image load on each
  // one — a fetch per render for every cover on the screen. It is read through a ref so
  // the effect always calls the latest one.
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  useEffect(() => {
    if (uri === null || uri === '') {
      setPaintable(null);
      return undefined;
    }
    let live = true;
    setPaintable(null);
    void loadTexture(uri)
      .then((texture) => {
        if (live) setPaintable(texture);
      })
      .catch((error: unknown) => {
        if (!live) return;
        // Loud: a cover that silently does not appear is indistinguishable from one
        // the feed never carried.
        console.error(`[desktop] expo-image: could not load "${uri.slice(0, 96)}":`, error);
        onErrorRef.current?.();
      });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- see below
  }, [uri]);

  // The caller's pixel `style` (Thumbnail passes `{ width: '100%', height: '100%' }`)
  // has no widget property here; expanding on both axes is what it means inside a
  // frame that already has a size.
  const fillClass = style === undefined ? undefined : 'flex-1';
  const classes = [className, fillClass].filter(Boolean).join(' ') || undefined;

  if (paintable === null) {
    return <View className={classes} />;
  }
  /**
   * THE PICTURE MUST NOT SIZE ITS PARENT, and that is the whole reason for the
   * scroller around it.
   *
   * `Gtk.Picture` takes its natural size from the paintable: MEASURED, a 1400x1400
   * cover reports a natural width of 1400, and `can-shrink` only moves the MINIMUM to
   * zero. A `Gtk.Box`, a `Gtk.Viewport` and a `Gtk.AspectFrame` all pass that straight
   * up, so one 116px tile asked for 1437px and a rail of seven asked for 10 060 — a
   * number that then decides how tall the rail thinks it is.
   *
   * React Native does not work that way: `<Image style={{ width: '100%' }}>` is a
   * request to fill, and contributes no intrinsic size at all. `Gtk.ScrolledWindow`
   * with `propagate-natural-width/height: false` is the one container measured to
   * report 0/0 for exactly this child, and it is not a scroller here in any other
   * sense: its child is allocated `MAX(viewport, child minimum)`, which with a
   * shrinkable picture is the viewport exactly, so nothing overflows.
   *
   * BOTH POLICIES ARE `never`, and the first version wrote `external`. The two differ
   * in exactly one thing that matters here: `external` DECLARES the widget scrollable
   * and leaves the bar to someone else, `never` declares it is not scrollable at all.
   * A wrapper whose child always fits is the second, and saying so is what keeps a
   * scroll over a cover from being claimed by a widget that has nothing to scroll —
   * the rails stopped scrolling under the pointer wherever an image was.
   *
   * The cap is unaffected by the choice: measured, both policies report 0/0, and the
   * frame around them still answers 116 at a width of 116.
   *
   * The frame around it — `Thumbnail`'s `aspectRatio`, a `Gtk.AspectFrame` — is what
   * gives the picture a size to fill. See `shims/react-native.tsx`.
   */
  return (
    <gtk-scrolled-window
      propagateNaturalWidth={false}
      propagateNaturalHeight={false}
      hscrollbarPolicy={'never' as never}
      vscrollbarPolicy={'never' as never}
      hexpand
      vexpand
    >
      <gtk-picture
        paintable={paintable as never}
        contentFit={CONTENT_FIT[contentFit] as never}
        canShrink
        hexpand
        vexpand
        {...(accessibilityLabel === undefined ? {} : { alternativeText: accessibilityLabel })}
      />
    </gtk-scrolled-window>
  );
}

/** expo-image's other exports, none of which the app imports. */
export const ImageBackground = Image;
export function useImage(): null {
  throw new Error(
    '[desktop] expo-image: `useImage` is not implemented on the GTK host. The app does ' +
      'not use it; add it to apps/desktop/src/shims/expo-image.tsx if that changes.',
  );
}
