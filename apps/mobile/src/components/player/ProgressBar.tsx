import { useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { Pressable, View, type LayoutChangeEvent } from 'react-native';

/**
 * The bar's spoken name, in ENGLISH; the German ships in
 * `packages/catalogue/src/de/player.ts` (ADR 0026 §6). The bar has no text, so this
 * is all a screen reader has.
 */
const COPY = defineMessages({
  position: { id: 'player.position', defaultMessage: 'Playback position' },
});

/**
 * Playback progress, with tap-to-seek.
 *
 * Deliberately not a slider: React Native no longer ships one,
 * `@react-native-community/slider` would be a new dependency with no web build, and
 * the slider from `@expo/ui` is native (SwiftUI/Compose) and disappears on web.
 * Tapping a position works on all three targets and is enough for a demo player —
 * dragging is missing, and that is the price paid knowingly.
 */
export function ProgressBar({
  positionSec,
  durationSec,
  onSeek,
}: {
  positionSec: number;
  durationSec: number;
  onSeek: (seconds: number) => void;
}) {
  const intl = useIntl();
  const [width, setWidth] = useState(0);
  const ratio = durationSec > 0 ? Math.min(1, Math.max(0, positionSec / durationSec)) : 0;

  const onLayout = (event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width);

  return (
    <Pressable
      accessibilityRole="adjustable"
      accessibilityLabel={intl.formatMessage(COPY.position)}
      accessibilityValue={{ min: 0, max: Math.round(durationSec), now: Math.round(positionSec) }}
      onLayout={onLayout}
      onPress={(event) => {
        if (width <= 0 || durationSec <= 0) return;
        const x = event.nativeEvent.locationX;
        onSeek((Math.min(width, Math.max(0, x)) / width) * durationSec);
      }}
      // A large hit area around a thin bar.
      hitSlop={12}
      className="justify-center py-2xs"
    >
      {/* The fill is full width and scaled down, not sized to a percentage. Width is
          a layout property: setting it re-runs layout for the bar and everything
          under it, and the position ticks twice a second for as long as audio plays,
          so that is a layout pass per tick for a purely visual change. `scaleX` is a
          transform, which the compositor applies without measuring anything. The
          origin has to be named, or the bar would grow from its centre outwards. */}
      <View className="overflow-hidden rounded-s bg-stroke" style={{ height: 4 }}>
        <View
          className="h-full w-full bg-accent"
          style={{ transform: [{ scaleX: ratio }], transformOrigin: 'left' }}
        />
      </View>
    </Pressable>
  );
}
