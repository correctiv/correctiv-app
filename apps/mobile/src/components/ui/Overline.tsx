import { Typo } from './Typo';
import type { ColorToken } from '@/lib/theme';

export type OverlineProps = {
  label: string;
  color?: ColorToken;
  className?: string;
};

/**
 * A small letter-spaced heading with no fill — the group label in the directory,
 * the kicker above a card. Matches `text-[12px] font-bold tracking-[1.2px]` in the
 * design draft, which uses this mark for section headings throughout.
 *
 * Not the same as `Badge`: that is the same typography ON a fill. The component
 * uppercases the label itself, because the capitals are part of the design and the
 * data arrives in title case ("Junge Formate").
 *
 * **One line, and it does not shrink.** Both are declared rather than left to a
 * default, and both are answers to the same property of a layout engine that
 * derives a label's minimum width from its own text: a letter-spaced mark is
 * allocated its natural width, which the text engine finds about the letter-spacing
 * short of what it needs, and it spends the shortfall on a second line the parent
 * has committed no height for. Padding cannot fix it, because padding raises the
 * natural width and the text's budget by the same pixel.
 *
 * **AND ONE LINE DOES NOT FIX IT EITHER; IT MOVES IT.** With no second line to
 * spend the shortfall on, the engine spends it on the last glyph instead. Seen on
 * the GTK host after this declaration landed there: the two-word `Backstage · Früher
 * lesen` stopped wrapping, and the SINGLE-WORD `Spotlight` in `home/SpotlightBriefing`
 * started reading `SPOTLIG…` where it had been whole. An earlier version of this
 * docblock said a single-word mark "has no break opportunity and was never
 * affected" — true of the wrapping, and wrong about the remedy, because it was
 * written from a measurement that only looked at the two-word case.
 *
 * `flexShrink: 0` does not save it: that `Spotlight` sits in a two-sided row beside a
 * link and is still the label that gives. (That row is a `SplitRow` since
 * [#158](https://github.com/correctiv/correctiv-app/issues/158), so on this host the
 * link now takes a second line rather than squeezing the mark — which removes the
 * squeeze and not the shortfall, because the shortfall is what the mark measures at
 * its own natural width.) The real remedy is the pixel the
 * natural width is short by, which is the layout engine's and not this component's.
 * What is kept here is the trade, chosen deliberately: on the phone and in the
 * browser one line is what this mark already was, and on a host that clips, a
 * truncated word is a smaller lie than a half-visible second line.
 *
 * The engine is GTK4/Adwaita, through `@gjsify/react-native`, on the host
 * [ADR 0012](../../../../../adr/0012-a-list-virtualizer-for-the-unbounded-lists.md)
 * names as a reason for `FlatList`. **The pixels are recorded there and only
 * there**, in that host's README on the `desktop` branch, for the reason
 * `app/gallery.tsx` gives about its own figure: a measurement typed twice is a
 * measurement that goes wrong in one of them, and nothing in `npm run check`
 * could catch the copy going stale.
 *
 * WHAT THIS COSTS ON THE PHONE, because it is not nothing. **One call site is
 * unbounded**: `article.kicker` in `gespeichert.tsx`, which is WordPress's
 * `post::topline` and is written by an editor, so a topline long enough to have
 * wrapped now ellipsizes instead. Every other label reaching this component comes
 * from this repository and is short enough for one line at a phone's width. That
 * ellipsis is the intended answer rather than a side effect: this mark is
 * uppercase and letter-spaced, and a wrapped one reads as a fault on any host.
 * The `a kicker longer than the line` specimen in `gallery/catalogue.tsx` is what
 * it looks like.
 *
 * **`flexShrink` is in `style`, and layout belongs in a class in this app** — a
 * deviation, so here is the reason. `__tests__/one-line-labels.test.tsx` asserts
 * this declaration by flattening the style, which is what a platform receives.
 * Uniwind's classes do not flatten in jest, so through `className="shrink-0"` the
 * only available assertion is that the string appears in a `className` — a weaker
 * oracle for a prop whose whole risk is being tidied away as noise.
 */
export function Overline({ label, color = 'on-canvas-muted', className }: OverlineProps) {
  return (
    <Typo
      variant="text-s"
      weight="bold"
      color={color}
      className={className}
      numberOfLines={1}
      style={{ fontSize: 12, letterSpacing: 1.2, flexShrink: 0 }}
    >
      {label.toUpperCase()}
    </Typo>
  );
}
