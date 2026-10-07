import { TriangleAlert } from 'lucide-react';

import type { SettingValue } from '@correctiv/app-core/lib/home-layout';
import {
  TEXT_FALLBACK_LANGUAGE,
  TEXT_LANGUAGES,
  textBoundOf,
  type TextSetting as TextSpec,
} from '@correctiv/app-core/lib/home-settings';
import type { Locale } from '@correctiv/app-core/stores/settings';

import {
  charsLeft,
  languageName,
  languagesMissing,
  TEXT_ABOUT_LANGUAGE,
  TEXT_BOUND,
  TEXT_BOUND_MULTILINE,
  TEXT_CHARS_LEFT,
  TEXT_LANGUAGE_MISSING,
  wordsOf,
  withWord,
} from './document';
import { useWorkbenchIntl } from '../../i18n/Localisation';
import { cn } from '../../lib/cn';
import { Badge } from '../../ui/kit/badge';
import { InfoTip } from '../../ui/kit/info-tip';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../ui/kit/tooltip';

/**
 * One field for a `text` setting, in the language this workbench is in, with what is left
 * of the bound and a mark on every language the word does not carry.
 *
 * ## Why this is a file of its own
 *
 * `HomeDocument.tsx` cannot be rendered by a test: it draws the app's own blocks through
 * `AppHost`, which mounts `expo-router` and `react-native`, and importing it raises a
 * `SyntaxError` before the first assertion runs. `test/preview/editor-controls.test.tsx`
 * says that at length for the editor's controls, and this is the same answer for the same
 * reason — a check that reads the source for a `data-testid` is the shape of check this
 * repository has been bitten by three times in a week.
 *
 * ## What it does not do
 *
 * **No field per language.** [ADR 0075](../../../../../adr/0075-a-document-carries-its-own-words-and-a-screen-says-what-it-is-called.md)
 * §2: a required field somebody has to get past gets filled with the German, and then
 * nothing distinguishes a translation from a placeholder. So the field writes the language
 * the interface is in and the rest of `TEXT_LANGUAGES` is a mark — on this card, and in the
 * check before a submission once the plan's step 7 is built.
 *
 * **No paragraph.** The panel says three things and each of them is a mark or a count. The
 * sentences wait behind the two ⓘ, because a reader wants them once and then never again,
 * and somebody who has to act on something is looking at a mark.
 *
 * **No bound of its own.** `textBoundOf` in the core is where the numbers live, and this
 * asks the same function the parser asks, so a declaration that changes one cannot leave
 * this tool refusing what the app accepts.
 */

/** The field, whether it is one line or several, and neither of them narrower than its card. */
const FIELD =
  'w-full rounded-md border border-stroke bg-canvas px-2xs py-3xs text-s text-on-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent';

const NOTE = 'text-s text-on-canvas-muted';

/** A compact field shows its count only this close to the bound; the tooltip has it always. */
const COUNT_SHOWN_AT = 10;

export function TextSetting({
  spec,
  value,
  disabled,
  label,
  marked = true,
  compact = false,
  onSet,
}: {
  /** The declaration: the bound, the line rule and the words the block draws itself. */
  spec: TextSpec;
  /** What the document holds for this key, which is nothing where it says nothing. */
  value: unknown;
  disabled: boolean;
  /** The setting's own name, for the field's accessible name. */
  label: string;
  /** Whether a missing language is marked beside the field, or said once somewhere else. */
  marked?: boolean;
  /**
   * One line and nothing under it: the count is a tooltip, and a number beside the text only
   * from `COUNT_SHOWN_AT` characters before the bound. For a field in a bar.
   */
  compact?: boolean;
  onSet: (value: SettingValue | undefined) => void;
}) {
  const intl = useWorkbenchIntl();
  /*
   * The language this site's interface is in, which is the one the editor writes. Asked of
   * `TEXT_LANGUAGES` rather than cast, because the two sets being the same is a fact about
   * today and not about the types: a locale this build has no word for has nothing to
   * write, and German is the language a document has to carry.
   */
  const language: Locale =
    TEXT_LANGUAGES.find((one) => one === intl.locale) ?? TEXT_FALLBACK_LANGUAGE;
  const words = wordsOf(spec, value);
  const bound = textBoundOf(spec);
  const left = charsLeft(words?.[language] ?? '', spec);
  const count = intl.formatMessage(TEXT_CHARS_LEFT, { count: Math.max(0, left) });

  /**
   * Where the bound is applied, which is the parser's own answer rather than one here.
   *
   * `maxLength` on the one-line field is the browser's and covers a person typing at the
   * end; the `slice` covers a paste and anything else that arrives whole, and asks
   * `textBoundOf` — the function `faultOf` asks — so what a field stops at is what a
   * document refuses.
   *
   * **The line rule is the element's, not this handler's.** A single-line input drops a
   * line break from its own value before any `change` event sees it (the HTML value
   * sanitisation algorithm, which jsdom implements as the browsers do), so stripping one
   * here would be a line that cannot be reached. `multiline` therefore chooses between a
   * `textarea` and an `input` and writes the same value either way.
   */
  const typed = (raw: string) => {
    onSet(withWord(words, language, raw.slice(0, bound.maxChars)));
  };

  if (compact && !bound.multiline) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="relative min-w-0 flex-1">
            <input
              type="text"
              disabled={disabled}
              value={words?.[language] ?? ''}
              maxLength={bound.maxChars}
              onChange={(event) => typed(event.target.value)}
              aria-label={label}
              className={cn(FIELD, 'h-[1.75rem] py-0', left <= COUNT_SHOWN_AT && 'pr-[2.25rem]')}
            />
            {left <= COUNT_SHOWN_AT && (
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 right-2xs flex items-center text-s tabular-nums text-on-canvas-muted"
              >
                {Math.max(0, left)}
              </span>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          {count}. {intl.formatMessage(TEXT_BOUND, { count: bound.maxChars })}
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <div className="flex flex-col gap-3xs">
      {bound.multiline ? (
        <textarea
          rows={3}
          disabled={disabled}
          value={words?.[language] ?? ''}
          onChange={(event) => typed(event.target.value)}
          aria-label={label}
          className={cn(FIELD, 'resize-y')}
        />
      ) : (
        <input
          type="text"
          disabled={disabled}
          value={words?.[language] ?? ''}
          maxLength={bound.maxChars}
          onChange={(event) => typed(event.target.value)}
          aria-label={label}
          className={FIELD}
        />
      )}

      <div className="flex flex-wrap items-center gap-2xs">
        {(marked ? languagesMissing(words, language) : []).map((one) => {
          const mark = intl.formatMessage(TEXT_LANGUAGE_MISSING, {
            language: languageName(intl, one),
          });
          return (
            <span key={one} className="inline-flex items-center gap-3xs">
              <Badge variant="outline">
                <TriangleAlert aria-hidden="true" className="size-[0.75rem] shrink-0" />
                {mark}
              </Badge>
              <InfoTip about={mark}>
                <p>{intl.formatMessage(TEXT_ABOUT_LANGUAGE)}</p>
              </InfoTip>
            </span>
          );
        })}

        <span className={cn(NOTE, 'ml-auto inline-flex items-center gap-3xs tabular-nums')}>
          {count}
          <InfoTip about={count} side="left" align="end">
            <p>
              {intl.formatMessage(bound.multiline ? TEXT_BOUND_MULTILINE : TEXT_BOUND, {
                count: bound.maxChars,
              })}
            </p>
          </InfoTip>
        </span>
      </div>
    </div>
  );
}
