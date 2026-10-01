import { Platform, Switch, View } from 'react-native';

import { Typo } from '@/components/ui';
import { colors, useColors } from '@/lib/theme';

/**
 * react-native-web applies `thumbColor` to the OFF state only; the ON thumb comes
 * from its own `activeThumbColor`, which defaults to Material teal `#009688`
 * (exports/Switch/index.js). So every enabled switch showed a green thumb in the
 * browser — a colour the palette does not contain — while the emulator, where
 * `thumbColor` covers both states, looked correct. Web-only, hence invisible to
 * every screenshot of this screen taken so far.
 *
 * The prop is not in RN's `SwitchProps`; spreading it from a variable keeps that
 * off the native branch instead of casting the type away.
 */
const WEB_THUMB = Platform.OS === 'web' ? { activeThumbColor: colors['always-light'] } : {};

/**
 * A settings row: label, explanation, switch.
 *
 * `Switch` from react-native rather than the one from `@expo/ui`: that one is native
 * (SwiftUI/Compose) and would disappear on web — the same trade-off as the player's
 * progress bar.
 *
 * **The switch is the smallest control in the app and is left that way.** The web
 * export draws it 40 x 20, which #102 measured on all five of them; a `style` is no
 * answer, because react-native's `Switch` renders the platform's own control and
 * sizing the container moves the track without resizing it. The two ways out are
 * both worse than the defect: a wrapper `Pressable` over the whole row puts a second
 * control in the accessibility tree saying the same thing, and hiding the real one
 * behind it takes the switch away from a keyboard. On the phone the platform's
 * control carries the platform's own touch area, so this is a web-target finding and
 * not a layout the app chose. `__tests__/tap-targets.test.ts` says the same thing
 * where it lists what it cannot read.
 */
export function SettingRow({
  label,
  description,
  value,
  onValueChange,
  className,
}: {
  label: string;
  description?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  className?: string;
}) {
  const palette = useColors();
  return (
    <View className={['flex-row items-center py-2xs', className ?? ''].join(' ')}>
      <View className="flex-1 pr-s">
        <Typo variant="text-m">{label}</Typo>
        {description ? (
          <Typo variant="text-s" color="grey-500" className="mt-4xs">
            {description}
          </Typo>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        accessibilityLabel={label}
        // The track is a SURFACE and follows the scheme; the thumb stays white — in
        // both states it sits on a coloured or light track.
        //
        // Deliberately still `grey-300`, one of the three deprecated aliases ADR 0022
        // lists as having no semantic successor. ADR 0022 moved it to `stroke` along
        // with the app's borders, and that was wrong: `stroke` names "linear elements
        // — borders, dividers, line iconography — that provide structure without
        // competing with content", and a switch track is none of those. It is a
        // control's own state surface, which is why its other state is `accent`. The
        // line above already said "surface" and the change contradicted it.
        //
        // `grey-300` as a FILL is exactly the gap ADR 0022's table names, alongside the
        // Thumbnail placeholder and the reader's neutral verdict plaque. Leave it here
        // until upstream grows a token for it, rather than borrowing the nearest one.
        trackColor={{ false: palette['grey-300'], true: palette.accent }}
        thumbColor={colors['always-light']}
        {...WEB_THUMB}
      />
    </View>
  );
}
