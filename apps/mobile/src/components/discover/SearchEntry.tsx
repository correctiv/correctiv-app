import { Ionicons } from '@expo/vector-icons';
import { defineMessages, useIntl } from 'react-intl';
import { Pressable } from 'react-native';

import { Typo } from '@/components/ui';
import { useColors } from '@/lib/theme';

/**
 * What the entry point says, in ENGLISH; the German that ships is
 * `packages/catalogue/src/de/discover.ts`. The label is what a screen reader
 * announces, which is as user-facing as the line beside it.
 */
const COPY = defineMessages({
  openSearch: { id: 'discover.openSearch', defaultMessage: 'Open search' },
  placeholder: {
    id: 'discover.searchPlaceholder',
    defaultMessage: 'Investigations, fact checks, projects …',
  },
});

/**
 * The search entry point on Entdecken — a dummy that pushes /suche, not an input.
 * Exactly as in the design draft: the keyboard should only come up on the search
 * screen, so that the directory stays visible when the tab is opened.
 */
export function SearchEntry({ onPress }: { onPress: () => void }) {
  const intl = useIntl();
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={intl.formatMessage(COPY.openSearch)}
      className="flex-row items-center rounded-md bg-surface px-s py-xs active:opacity-80"
      /*
       * A MINIMUM height, and it was a fixed one. 44 dp is the target size the
       * empty field has to keep; it is not the size the line inside it is
       * allowed to be. At 200 % system font the placeholder needs two lines, a
       * box told it is 44 dp tall gives it one, and the second line was drawn
       * below the field's own border across the chip rail under it (#158). The
       * padding is what the fixed height used to stand in for.
       */
      style={{ minHeight: 44 }}
    >
      <Ionicons name="search" size={18} color={colors['on-canvas-muted']} />
      {/* `flex-1`, so the line wraps inside what is left of the row rather than
          measuring itself against the whole of it and running past the edge. */}
      <Typo variant="text-m" color="grey-500" className="ml-xs flex-1">
        {intl.formatMessage(COPY.placeholder)}
      </Typo>
    </Pressable>
  );
}
