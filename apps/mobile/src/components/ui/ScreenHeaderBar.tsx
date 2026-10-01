import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { Pressable, View } from 'react-native';

import { Hairline } from './Hairline';
import { SafeAreaView } from './SafeAreaView';
import { Typo } from './Typo';
import { goBack } from '@/lib/navigation/goBack';
import { sizes, useColors } from '@/lib/theme';

/**
 * The back control's word, in ENGLISH; the German ships in
 * `packages/catalogue/src/de/ui.ts` (ADR 0026 §6).
 *
 * **Exported, and this is the only declaration of `ui.back` in the app.** Three
 * places say it: this bar, `ScreenHeader.tsx` — which hands the same word to the
 * PLATFORM's header as `headerBackTitle`, where there is no JSX to put a message
 * in — and the article reader's floating chrome, which draws a chevron of its
 * own. They import it from here rather than declaring it three times, so the
 * drawn bar and the native header cannot come to say different words.
 */
export const HEADER_COPY = defineMessages({
  back: {
    id: 'ui.back',
    defaultMessage: 'Back',
    description:
      'The way back out of a screen, in the header. form.back is the same word inside the participation form, where it steps back one page rather than leaving.',
  },
});

export type ScreenHeaderBarProps = {
  /**
   * What back means. Left out: one step back, and home when there is no step back
   * — a deep link or a shared web address. Every screen used to pass its own
   * `router.back()`, and not one of them knew about that case; see
   * `lib/navigation/goBack.ts`.
   */
  onBack?: () => void;
  /** Label of the back control, and its accessibility name. */
  backLabel?: string;
  /**
   * Sits right of the back control. When something is set, back shrinks to the
   * chevron alone — otherwise the row does not fit.
   */
  children?: ReactNode;
};

/**
 * Back bar with a hairline, as in the design draft: chevron plus the back label,
 * no title row.
 *
 * Not a screen's header on its own. `ScreenHeader` decides where this is drawn —
 * always on web, and on the two screens that keep it everywhere — and this file
 * is what all of those render, so there is one bar rather than three copies of
 * one. The gallery shows it under `ScreenHeader`, because on web that is exactly
 * what `ScreenHeader` draws.
 */
export function ScreenHeaderBar({ onBack, backLabel, children }: ScreenHeaderBarProps) {
  const intl = useIntl();
  const colors = useColors();
  // The default used to sit on the parameter; a default cannot call a hook, so
  // the fallback is chosen here instead. Same word, same two call sites.
  const label = backLabel ?? intl.formatMessage(HEADER_COPY.back);
  return (
    <SafeAreaView edges={['top']} className="bg-canvas">
      <View className="flex-row items-center px-s py-2xs">
        <Pressable
          onPress={onBack ?? goBack}
          accessibilityRole="button"
          accessibilityLabel={label}
          className="flex-row items-center justify-center py-2xs active:opacity-60"
          /*
           * The box, not a slop rectangle. It used to be `hitSlop={8}`, and the two
           * things that costs are both in #102: a slop rectangle is invisible to
           * react-native-web, so the web export's back control measured 35 dp tall
           * and — with `children` set, where the label goes and only the chevron is
           * left — 20 dp WIDE, which is the smallest target in the app; and slop
           * does not grow with the system font while padding does.
           *
           * `minWidth`/`minHeight`, so the label still decides the width when there
           * is one and the type still decides the height when it is larger than
           * this. The bar around it is 44 + `py-2xs` either side = 56, which is
           * Android's own app-bar height.
           */
          style={{ minWidth: sizes.tapTarget, minHeight: sizes.tapTarget }}
        >
          <Ionicons name="chevron-back" size={20} color={colors['on-canvas']} />
          {!children && (
            <Typo variant="text-m" weight="semibold" className="ml-4xs">
              {label}
            </Typo>
          )}
        </Pressable>
        {children ? <View className="ml-2xs flex-1">{children}</View> : null}
      </View>
      <Hairline />
    </SafeAreaView>
  );
}
