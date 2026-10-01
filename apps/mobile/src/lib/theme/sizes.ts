/**
 * Element sizes in dp, taken from the design draft: the `.dc.html` mockup in the
 * `design-entwurf` sibling checkout.
 *
 * Why not Tailwind utilities: the spacing scale is the design system's own
 * (`--spacing: 0.125rem` in @correctiv/design-tokens/theme.css — 2 px at Uniwind's
 * rem base of 16), so a numeric utility
 * never means what it says — `w-32` is 64px, not Tailwind's 128. Under NativeWind
 * the scale also stopped at 48, so `w-64` did not exist at all: the class was
 * dropped without a word and the element sized to its content. Every numeric size
 * utility in this app was therefore either half its intended size or gone.
 *
 * Spacing keeps the named tokens (`p-s`, `gap-m`, `mt-2xs`); anything that needs
 * a pixel size belongs here, where the number is visible and the draft's value is
 * cited. `__tests__/no-numeric-utilities.test.ts` keeps the trap out.
 */
export const sizes = {
  /**
   * The smallest a control may be, in either direction.
   *
   * WCAG 2.5.5's 44 rather than Android's 48, because it is the one figure that
   * holds on all three targets and the app draws one layout for them. Issue #102
   * asks for 44 and aims at 48; everything here that names a target reaches 44 and
   * three of them (`playButton`, `playOverlay`, `playButtonLarge`) are past 48
   * already, because they were drawn that size rather than sized to a thumb.
   *
   * A FLOOR and not a height. It belongs in `minWidth`/`minHeight`, or as the size
   * of a box whose content is a glyph and cannot grow — never as `height` on a box
   * holding words, which is the defect `__tests__/fixed-heights.test.ts` exists for.
   * `__tests__/tap-targets.test.ts` reads it back out of the source and is what
   * keeps a new control from landing under it.
   */
  tapTarget: 44,
  /** Widest a column of reading runs — draft: `--container-content: 38.75rem`. */
  contentColumn: 620,
  /**
   * Window width at which navigation becomes a left rail.
   *
   * The phone layout is a bottom bar; the tablet layout is a rail on the left edge.
   * This is the one number both layouts read so they cannot disagree.
   */
  railBreakpoint: 768,
  /**
   * Width of the navigation rail on tablet.
   *
   * At 834 px the gutter is 107 px (`columnGutter(834) = 24 + (834 − 48 − 620) / 2`),
   * so 88 px fits with 19 px to spare. The rail sits inside the gutter the centred
   * reading column leaves.
   */
  railWidth: 88,
  /** Card in a horizontal rail — draft: `w-[240px]` (the fact-check rail on Home). */
  railCard: 240,
  /**
   * Card in a media rail. Narrower than `railCard` so two fit on a 402pt screen
   * and the third only peeks: at 240 the second card was cut mid-word and the row
   * read as clipped rather than scrollable. No draft value exists, because the draft
   * lists videos vertically. This number comes from the first implementation that
   * had a media rail.
   */
  railCardMedia: 176,
  /** Square podcast cover in the series rail — draft: `w-[116px]`. */
  railTile: 116,
  /** Round play button on the live/radio card — draft: `h-[48px]`. */
  playButton: 48,
  /** Round play mark over a video thumbnail — draft: `h-[52px]`. */
  playOverlay: 52,
  /** The player's transport button — draft: `h-[68px]`. */
  playButtonLarge: 68,
  /**
   * Tappable icon button: back, bookmark, mini-player transport.
   *
   * **40 until #102 measured it.** A glyph in a box does not grow with the system
   * font, so this number is the whole target and nothing under it can be argued
   * from a line box: the reader's chrome, the player's close and both of the mini
   * player's transport controls were 40 x 40 on every screen and every scale. Four
   * of them carried `hitSlop={8}`, which reads as 48 on the phone and as 40 in the
   * browser, because react-native-web draws no slop rectangle at all.
   */
  iconButton: 44,
  /**
   * The drawn circle behind a glyph inside a list row, where 44 crowds the text.
   *
   * **Not a target.** Its one use is the play mark in `EpisodeRow`, which is a
   * `View` inside a row that is itself the control — the whole row is what a thumb
   * hits. A control that needs its own box takes `tapTarget` above.
   */
  iconButtonSmall: 36,
  /** Progress and scrub bars — draft: `h-[4px]`. */
  progressBar: 4,
} as const;
