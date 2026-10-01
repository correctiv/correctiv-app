// The reading column's gutter, without the rail this host does not have.
//
// `components/ui/ContentColumn.tsx` is main's #296: every screen wears the column, and
// `Rail` offsets its first card by the gap between the window edge and the column's.
// `useColumnGutter` computes that gap from the width of the space the screens are
// given, and from 768 px up it takes `sizes.railWidth` off the window first, because
// on the phone's tablet layout a left rail sits BESIDE the screens (ADR 0070).
//
// There is no rail here. Navigation is the `Adw.ViewSwitcher` in the header bar, or the
// `Adw.ViewSwitcherBar` at the foot when the window is narrow, and neither takes any
// width from the content. Kept as it is, the subtraction puts a Rail's first card 44 px
// left of the column on every window of 768 px or more.
//
// So this keeps the column and the arithmetic and answers `useColumnGutter` with the
// whole window. A module-level redirect (`gjsify.config.mjs`, `FILE_OVERRIDES`) rather
// than an edit to the shared file, because the shared file is right for the phone, and
// by file rather than by specifier because `Rail` and `Screen` import it as
// `./ContentColumn`.
//
// The relative path below is how this file reaches the original: the redirect skips an
// importer that is itself an override, so it is not sent back here.

import { useWindowDimensions } from 'react-native';

import { columnGutter } from '../../../mobile/src/components/ui/ContentColumn';

export { ContentColumn, columnGutter } from '../../../mobile/src/components/ui/ContentColumn';

export function useColumnGutter(): number {
  const { width } = useWindowDimensions();
  return columnGutter(width);
}
