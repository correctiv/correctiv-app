import { Pressable, type PressableProps } from 'react-native';

import { typography, useColors, type ColorToken } from '@/lib/theme';
import { ScaledText } from './ScaledText';

type Variant = 'primary' | 'secondary' | 'outline' | 'club' | 'onEmphasis';

export type ButtonProps = Omit<PressableProps, 'children' | 'style'> & {
  title: string;
  variant?: Variant;
  fullWidth?: boolean;
  className?: string;
};

// Brand logic: red (`accent`) for the journalism CTA, yellow (`accent-alternative`)
// for the club. No shadows — shape comes from surfaces plus radius md (5px).
//
// `onEmphasis` is the CTA on a brand surface: white, not yellow. Yellow is the
// club's colour and carries meaning there; on red it is also loud and low-contrast.
// The design draft uses white here.
const SURFACE: Record<Variant, string> = {
  primary: 'bg-accent',
  secondary: 'bg-surface',
  outline: 'bg-canvas border border-stroke',
  club: 'bg-accent-alternative',
  // White, not the page surface: this button sits on the red mission screen,
  // which is red in both schemes.
  onEmphasis: 'bg-always-light',
};
const LABEL_COLOR: Record<Variant, ColorToken> = {
  primary: 'always-light',
  secondary: 'on-canvas',
  outline: 'on-canvas',
  club: 'always-dark',
  onEmphasis: 'always-dark',
};

export function Button({
  title,
  variant = 'primary',
  fullWidth,
  className,
  disabled,
  ...rest
}: ButtonProps) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      // Explicit, rather than relying on the label being read off the child Text —
      // and it gives tests a stable handle on a button.
      accessibilityLabel={title}
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      className={[
        'rounded-md px-m py-s justify-center active:opacity-80',
        SURFACE[variant],
        fullWidth ? 'self-stretch' : 'self-start',
        disabled ? 'opacity-40' : '',
        className ?? '',
      ].join(' ')}
      {...rest}
    >
      <ScaledText
        style={[typography.button, { color: colors[LABEL_COLOR[variant]], textAlign: 'center' }]}
      >
        {title}
      </ScaledText>
    </Pressable>
  );
}
