import { defineMessages } from 'react-intl';
import type { ReactNode } from 'react';

import { cn } from '../../lib/cn';
import { COMBINATIONS, type Status } from '../api';
import { useWorkbenchIntl } from '../../i18n/Localisation';

/**
 * Everything this line says, in ENGLISH; the German that ships is
 * `src/i18n/catalogue/de/preview.ts`.
 *
 * `preview.status.*`, one namespace with `preview/AppFrame.tsx`, because both are
 * the preview view's own furniture rather than one of the six tools in the rail —
 * those are `tools.*`.
 *
 * **What the app reports is not translated and what this site says about it is.**
 * `light`, `dark` and `system` arrive here as the literal values of the app's own
 * appearance setting and of what the device reports, and they are printed in bold
 * in their own spelling; `preview.status.unknown` is what stands in where one of
 * them could not be read, and that IS a word
 * ([ADR 0052](../../../../../adr/0052-the-sites-own-words-follow-the-setting.md) §1).
 */
const COPY = defineMessages({
  app: {
    id: 'preview.status.app',
    defaultMessage: 'App is <b>{scheme}</b>',
    description:
      'The first thing the status line says, beside a swatch of that colour: which palette the framed app is actually painting with. {scheme} is “light” or “dark”, or the word for an unreadable value, and is drawn in bold.',
  },
  setting: {
    id: 'preview.status.setting',
    defaultMessage: 'setting <b>{setting}</b>, device reports <b>{scheme}</b>',
    description:
      'The two halves the line above resolves from, shown from 768px up. {setting} is the app’s own appearance setting, “light”, “dark” or “system”; {scheme} is what the device says it prefers, “light” or “dark”. Either can be the word for an unreadable value. Both are drawn in bold.',
  },
  combination: {
    id: 'preview.status.combination',
    defaultMessage: 'combination <b>{which}</b>',
    description:
      'Which of the four appearance combinations TROUBLESHOOTING.md numbers is on screen, shown from 1024px up. {which} is preview.status.combination.n, or the word for an unreadable value, and is drawn in bold. preview.status.combination.default is the same line for the fourth one.',
  },
  combinationDefault: {
    id: 'preview.status.combination.default',
    defaultMessage: 'combination <b>{which}</b>, the default',
    description:
      'The same line as preview.status.combination, for the one combination that is the app’s own default — the setting on system against a device reporting dark, which is the combination that has already shipped broken. {which} is preview.status.combination.n and is drawn in bold.',
  },
  which: {
    id: 'preview.status.combination.n',
    defaultMessage: '{n} of {total}',
    description:
      'What goes in the bold of the two lines above. {n} is which combination is on screen and {total} how many there are: the two explicit settings, then “system” against each of the two device schemes. {total} is handed in from COMBINATIONS.length rather than written as a four, because a four typed in a catalogue is a second copy of a number the code already has.',
  },
  unknown: {
    id: 'preview.status.unknown',
    defaultMessage: 'unknown',
    description:
      'Stands in this line wherever a reading could not be taken: the app’s setting, what the device reports, or which combination the two make. The published export leaves no dev handle, so the setting is unreadable there by design.',
  },
  size: {
    id: 'preview.status.size',
    defaultMessage: '{width} × {height} at {percent}%',
    description:
      'The frame’s own size, always shown. {width} and {height} are CSS pixels and {percent} is how far the frame is scaled down to fit the page, 100 when it is not.',
  },
  published: {
    id: 'preview.status.published',
    defaultMessage: 'Published build, no dev handle',
    description:
      'Shown from 1024px up when the frame holds the exported app rather than the dev server. The dev handle is what the appearance tool and the inspector write through, so both are inert without it; each of those two says so itself in its own panel.',
  },
});

/**
 * The bold run drawn inside these lines, in its two faces, at module scope.
 *
 * Beside the descriptors rather than inside the render, which is the shape
 * `ui/Settings.tsx` and `pages/Components.tsx` already use: a component built
 * during a render is remounted on every one of them, and
 * `react/no-unstable-nested-components` says so.
 *
 * The combination's is the monospaced one, because what is inside it is a count
 * and a total rather than a word, and a proportional face would move the line
 * every time the number changed.
 */
const b = (chunks: ReactNode[]) => <b className="text-on-canvas">{chunks}</b>;

const counted = (chunks: ReactNode[]) => (
  <b className="font-mono tabular-nums text-on-canvas">{chunks}</b>
);

/**
 * Which appearance combination is actually on screen, plus size and zoom.
 *
 * The first part is the point. `TROUBLESHOOTING.md` records a shipped bug that a
 * browser walk missed precisely because the walk set the app to `dark` and
 * emulated `prefers-color-scheme: light`, "exercising both paths that work and
 * neither that breaks". You cannot avoid a combination you cannot see you are
 * in, so the shell states it rather than leaving it to be inferred.
 *
 * It goes in the status line because that is where a fact about the current view
 * belongs, and because the line is there on every view anyway.
 */
export function Readout({
  status,
  size,
  scale,
}: {
  status: Status;
  size: { w: number; h: number };
  scale: number;
}) {
  const intl = useWorkbenchIntl();
  const combo = COMBINATIONS.find((c) => c.n === status.combination);
  const unknown = intl.formatMessage(COPY.unknown);
  return (
    <>
      <span className="flex shrink-0 items-center gap-2xs">
        {/*
          A swatch of what the APP is painting, which must not follow this page's
          own scheme. `bg-white` and `bg-neutral-700` are primitives for exactly
          that reason: they are the two grounds a device scheme means, and a role
          would move with the wrong thing.
        */}
        <span
          aria-hidden="true"
          className={cn(
            'size-[0.625rem] rounded-full border border-stroke-strong',
            status.active === 'dark' ? 'bg-neutral-700' : 'bg-white',
          )}
        />
        {intl.formatMessage(COPY.app, { scheme: status.active, b })}
      </span>

      <span className="hidden shrink-0 md:inline">
        {intl.formatMessage(COPY.setting, {
          setting: status.appTheme ?? unknown,
          scheme: status.scheme ?? unknown,
          b,
        })}
      </span>

      <span className="hidden shrink-0 lg:inline">
        {intl.formatMessage(combo?.isDefault ? COPY.combinationDefault : COPY.combination, {
          which: combo
            ? intl.formatMessage(COPY.which, { n: combo.n, total: COMBINATIONS.length })
            : unknown,
          b: counted,
        })}
      </span>

      <span className="shrink-0 tabular-nums">
        {intl.formatMessage(COPY.size, {
          width: size.w,
          height: size.h,
          percent: Math.round(scale * 100),
        })}
      </span>

      {/*
        Said in words, not by greying something out. Two of the six tools cannot
        work in the static export, and a reader who never opens them still
        deserves to know which build they are looking at.

        This is the whole of that fact on screen now, beside the two tools that
        say it for themselves. The tools panel used to open with a `Build` badge
        and a paragraph under it, above six tools of which it concerned two
        (ADR 0038). `lg` rather than `xl` because of that: with the paragraph
        gone, a laptop is not a screen this should be missing from.
      */}
      {!status.handle && (
        <span className="hidden shrink-0 text-on-canvas-accent lg:inline">
          {intl.formatMessage(COPY.published)}
        </span>
      )}
    </>
  );
}
