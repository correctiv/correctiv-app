import type { ReactNode } from 'react';

import { cn } from '../../lib/cn';

export interface SegmentedOption {
  value: string;
  label: ReactNode;
  /** One segment that cannot be chosen while the rest can: `an` for a feature with sample data only. */
  disabled?: boolean;
}

interface Props {
  /** Names the group for the browser, so two on one page do not merge. */
  name: string;
  /** What the group is choosing between. Rendered, so keep it short. */
  legend: string;
  value: string;
  options: SegmentedOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  /** Off where the group already stands under a heading that says what it is. */
  showLegend?: boolean;
  /**
   * One row that scrolls sideways instead of breaking into two.
   *
   * **Off here, and it was the one fault a cold review found on the block picker.** The
   * six family names are the app's words (ADR 0074), German, long, and beside „Alle" they
   * are one option more than fits; `flex-wrap` answered that by leaving „Club und Profil"
   * alone on a second line, which reads as an afterthought rather than as a seventh choice.
   * Two answers were available and this is the one that keeps every option on one line: the
   * options keep their own width, the row scrolls, and a tab that does not fit is one wheel
   * away rather than one row down.
   *
   * The alternatives were to shorten the labels — which would put this file's own wording in
   * the way of a table ADR 0074 moved to the app — and to break the row deliberately, which
   * is what happened.
   *
   * The scrollbar is hidden rather than styled, because a bar under a row of chips says
   * "there is more" twice: once as a bar and once as the cut-off chip beside it. Keyboard
   * focus still scrolls the row, because a focused radio the browser scrolled out of sight
   * would leave a sighted keyboard user with no idea which segment they are on.
   */
  scroll?: boolean;
  className?: string;
}

/**
 * One exclusive choice, drawn as a row of segments.
 *
 * Radios in labels, not buttons carrying `aria-pressed`. There were three
 * hand-written copies of this control and two of them were buttons, which is
 * wrong twice over: `aria-pressed` says "this is on" where the question is "which
 * one", and a row of buttons is a row of tab stops where a radio group is one,
 * with the arrow keys moving inside it. The browser does all of that for a
 * fieldset of radios and none of it for buttons.
 *
 * The input is the control and the span is the paint: `peer sr-only` keeps the
 * radio where the keyboard and the screen reader expect it while `peer-checked`
 * and `peer-focus-visible` draw it.
 */
export function Segmented({
  name,
  legend,
  value,
  options,
  onChange,
  disabled,
  showLegend = false,
  scroll = false,
  className,
}: Props) {
  return (
    /*
     * The border belongs to the inner box, not to the fieldset.
     *
     * A `<legend>` inside a bordered fieldset is drawn INTO the border: the
     * browser cuts a notch for it, and the box ends up with a gap along its top
     * edge and the words floating in it. That is a fieldset's oldest behaviour
     * and it read as a rendering fault. The fieldset keeps what a fieldset is
     * for, the grouping and the `disabled` that switches every radio off at
     * once, and the box keeps the shape.
     */
    <fieldset
      disabled={disabled}
      className={cn('min-w-0 disabled:opacity-60', scroll && 'max-w-full', className)}
    >
      <legend className={showLegend ? 'mb-2xs text-s text-on-canvas-muted' : 'sr-only'}>
        {legend}
      </legend>
      <div
        className={cn(
          'inline-flex max-w-full items-center gap-4xs rounded-md border border-stroke bg-canvas p-4xs',
          scroll
            ? // `flex-nowrap` and `overflow-x-auto` together: wrapping is what left an
              // orphan on a second row, and scrolling is what keeps one row of options.
              'flex-nowrap overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
            : 'flex-wrap',
        )}
      >
        {options.map((option) => (
          <label key={option.value} className={cn('min-w-0', scroll && 'shrink-0')}>
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              disabled={option.disabled}
              className="peer sr-only"
            />
            <span
              className={cn(
                'block cursor-pointer whitespace-nowrap rounded-s px-xs py-3xs text-s font-medium transition-colors',
                'peer-focus-visible:ring-2 peer-focus-visible:ring-accent',
                value === option.value
                  ? 'bg-accent text-white'
                  : 'text-on-canvas-muted hover:bg-surface hover:text-on-canvas',
                option.disabled &&
                  'cursor-not-allowed line-through opacity-50 hover:bg-transparent',
              )}
            >
              {option.label}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
