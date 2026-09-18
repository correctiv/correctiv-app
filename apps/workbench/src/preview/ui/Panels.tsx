import {
  Check,
  Copy,
  Crosshair,
  Eraser,
  ExternalLink,
  OctagonAlert,
  Play,
  RotateCcw,
  TriangleAlert,
} from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { defineMessages, type MessageDescriptor } from 'react-intl';

import { COMBINATIONS, type Status } from '../api';
import type { Level, LogEntry } from '../frame/console';
import { frameLabel, frameShort, handover } from '../handover';
import type { Located } from '../frame/locate';
import { findingKey, MIN_TAP, type Finding } from '../frame/measure';
import { FIXTURES } from '../frame/seed';
import { asCss, PALETTE, TOKENS, type Overrides, type Scheme } from '../frame/tokens';
import type { PreviewState, ThemeSetting } from '../state';
import { useWorkbenchIntl } from '../../i18n/Localisation';
import { cn } from '../../lib/cn';
import { Badge } from '../../ui/kit/badge';
import { Button } from '../../ui/kit/button';
import { Segmented } from '../../ui/kit/segmented';

/**
 * Everything the six tools say, in ENGLISH; the German that ships is
 * `src/i18n/catalogue/de/tools.ts`.
 *
 * One `COPY` for six panels, because they are one file and one area, and their
 * names are one table away in `shell/views.ts` as `shell.section.*`. Three other
 * files write into `tools.*` for the same reason: `preview/api.ts` names the four
 * appearance combinations, `preview/frame/measure.ts` holds what a finding says,
 * and `preview/handover.ts` holds the four field names of the block the inspector
 * builds. All four are parts of one tool each.
 *
 * **What is deliberately not here is every value the app reports back.**
 * `light`, `dark` and `system` are the literal contents of the app's own setting;
 * `warn` and `error` are the two console levels the frame is patched for; a
 * console row is the app's own output; `--color-canvas` is a custom property and
 * `#ffffff` a colour. Each is printed in its own spelling, and translating one
 * would be renaming something rather than translating a sentence
 * ([ADR 0052](../../../../../adr/0052-the-sites-own-words-follow-the-setting.md) §1).
 * `DevTools`, `expo export` and `npm run web` are the same case one step further
 * out: a product's name and two commands.
 */
const COPY = defineMessages({
  needsDev: {
    id: 'tools.needsDev',
    defaultMessage: 'Needs a development build',
    description:
      'A badge over the reason a control in this panel is disabled. Two of the six tools carry one, the appearance tool and the inspector, and each writes its own reason under it: tools.appearance.needsDev and tools.inspect.needsDev.',
  },

  appSetting: {
    id: 'tools.appearance.setting',
    defaultMessage: 'App setting says',
    description:
      'Over the value of the framed app’s own appearance setting, read back out of its store. The value beside it is “light”, “dark” or “system” and is not translated.',
  },
  appLegend: {
    id: 'tools.appearance.legend',
    defaultMessage: 'App setting',
    description:
      'The legend of the three-way control that writes that setting, drawn above it. tools.appearance.setting is the readout of the same thing two rows up and reads “App setting says”.',
  },
  deviceReports: {
    id: 'tools.appearance.device',
    defaultMessage: 'Device reports',
    description:
      'Over what the device says it prefers, beside a swatch of it. The value beside it is “light” or “dark” and is not translated. preview.status.setting says the same thing in the status line, inside a sentence.',
  },
  unknown: {
    id: 'tools.appearance.unknown',
    defaultMessage: 'unknown',
    description:
      'Stands in either of the two readouts above where the value could not be read: the published export leaves no dev handle, so the app’s own setting is unreadable there by design. preview.status.unknown is the same word in the status line and covers the combination as well.',
  },
  appearanceNeedsDev: {
    id: 'tools.appearance.needsDev',
    defaultMessage:
      '<code>expo export</code> sets <code>__DEV__</code> false, so the published build leaves no dev handle and this setting cannot be written from here. Run the workbench against <code>npm run web</code>.',
    description:
      'Why the control above it is disabled. The three runs in <code> are a command, a build-time constant and a command, and none of them is translated.',
  },
  default: {
    id: 'tools.appearance.default',
    defaultMessage: 'default',
    description:
      'A badge on the one of the four combinations that is the app’s own: the setting on system, against a device reporting dark.',
  },
  onScreen: {
    id: 'tools.appearance.onScreen',
    defaultMessage: 'on screen',
    description: 'A badge on whichever of the four combinations the frame is actually in.',
  },
  here: {
    id: 'tools.appearance.here',
    defaultMessage: 'here',
    description:
      'A badge saying that this combination can be reached from this panel. The other two rows carry “DevTools” instead, which is a product’s name and is not translated.',
  },
  appearanceNote: {
    id: 'tools.appearance.note',
    defaultMessage:
      'An iframe cannot be given a scheme of its own, so the two marked DevTools are reached by emulating <code>prefers-color-scheme</code> under Rendering.',
    description:
      'Under the list of four combinations. DevTools and Rendering are the browser’s own name and the name of one of its panels; the run in <code> is a CSS media feature. None of the three is translated.',
  },

  fixtures: {
    id: 'tools.state.legend',
    defaultMessage: 'Fixture · choosing one reloads the frame',
    description:
      'The legend over the list of storage fixtures. A fixture is written into storage before the app boots, which is why choosing one costs a load. The fixtures themselves are fixtures.* and live with the data they write.',
  },
  leaveAlone: {
    id: 'tools.state.none',
    defaultMessage: 'Leave alone',
    description:
      'The first row of the fixture list and the default: seed nothing, so whatever is already in storage stays. It is not a fixture, which is why it is here and not in fixtures.*.',
  },
  leaveAloneHint: {
    id: 'tools.state.none.hint',
    defaultMessage: 'Whatever the last visit left in storage.',
    description: 'The line under “Leave alone”.',
  },

  levels: {
    id: 'tools.console.levels',
    defaultMessage: 'Levels shown',
    description:
      'Read aloud as the group name of the two level toggles, and never drawn. The toggles themselves say “warn” and “error”, which are the console’s own level names and are not translated.',
  },
  consoleFilter: {
    id: 'tools.console.filter',
    defaultMessage: 'Filter console lines',
    description: 'The accessible name of the field that narrows the list of console rows.',
  },
  consoleFilterPlaceholder: {
    id: 'tools.console.filter.placeholder',
    defaultMessage: 'filter',
    description:
      'The placeholder inside that field, lower case because the field is one line tall.',
  },
  clear: {
    id: 'tools.console.clear',
    defaultMessage: 'Clear',
    description: 'Throws away every console row collected so far. The frame is not reloaded.',
  },
  consoleLog: {
    id: 'tools.console.log',
    defaultMessage: 'App console',
    description:
      'The accessible name of the live region holding the rows. What is in it is the app’s own output and is never translated.',
  },
  consoleEmpty: {
    id: 'tools.console.empty',
    defaultMessage: 'Nothing since the last navigation.',
    description:
      'Where the rows would be, when the app has said nothing at all. tools.console.noMatch is the other empty state, where it has said something and the filter hides all of it.',
  },
  consoleNoMatch: {
    id: 'tools.console.noMatch',
    defaultMessage: 'Nothing matches the filter.',
    description:
      'Where the rows would be, when the field above hides every row there is. tools.console.empty is the other empty state, where there are none.',
  },
  consoleSummary: {
    id: 'tools.console.summary',
    defaultMessage:
      '{shown} of {total} lines shown, {warnings, plural, one {# warning} other {# warnings}}, {errors, plural, one {# error} other {# errors}}.',
    description:
      'Under the console rows. {shown} is how many rows the two toggles and the filter leave, {total} how many there are, and {warnings} and {errors} the split of the whole by level. The last two inflect: a run with one warning is an ordinary reading of this line, and the first version of this string said “1 warnings”.',
  },
  markErrors: {
    id: 'tools.console.mark.errors',
    defaultMessage: '{count, plural, one {error} other {errors}}',
    description:
      'The word beside the number on the console tool’s icon in the rail, read aloud and also its tooltip. {count} is the number itself, which is drawn separately, so this is the noun alone. An error outranks a warning, so the icon carries this whenever there is one.',
  },
  markWarnings: {
    id: 'tools.console.mark.warnings',
    defaultMessage: '{count, plural, one {warning} other {warnings}}',
    description:
      'The same as tools.console.mark.errors for the lesser of the two levels, which the icon carries when there is no error. {count} is the number, drawn separately.',
  },

  tokensLede: {
    id: 'tools.tokens.lede',
    defaultMessage:
      'Overriding the <b>{scheme}</b> scheme, which is the one the app is painting with.',
    description:
      'The first line of the tokens tool. {scheme} is “light” or “dark”, the name of the palette, drawn in bold and not translated.',
  },
  changed: {
    id: 'tools.tokens.changed',
    defaultMessage: 'changed',
    description:
      'A badge on a colour row whose value has been overridden. tools.tokens.changedCount counts the same rows at the foot of the tool; home.document.changed and home.row.changed are the same word in the home tool and read the same in English.',
  },
  resetOverrides: {
    id: 'tools.tokens.reset',
    defaultMessage: 'Reset overrides',
    description: 'Puts every colour back to the palette’s own value, in this scheme.',
  },
  copyCss: {
    id: 'tools.tokens.copy',
    defaultMessage: 'Copy CSS',
    description:
      'Copies the overridden colours as a block of custom properties, ready to paste into a stylesheet.',
  },
  changedCount: {
    id: 'tools.tokens.changedCount',
    defaultMessage: '{count} changed',
    description:
      'The number of overridden colours, beside the two buttons. {count} may be zero, in which case both buttons are disabled.',
  },
  textToo: {
    id: 'tools.tokens.text',
    defaultMessage: 'Text too',
    description:
      'A checkbox: also chase text and icon colours, which cannot follow a custom property because react-native-web resolves them in JavaScript and writes them inline.',
  },
  textNote: {
    id: 'tools.tokens.textNote',
    defaultMessage: 'Text is chased by value, so it is a best effort rather than a rule.',
    description: 'The caveat under that checkbox.',
  },

  checkOverflow: {
    id: 'tools.measure.check.overflow',
    defaultMessage: 'Horizontal overflow',
    description:
      'The first of the three checks, as a name and a count. tools.measure.kind.overflow is the same check named on a finding, where it is a badge and reads shorter.',
  },
  checkTapTarget: {
    id: 'tools.measure.check.tapTarget',
    defaultMessage: 'Tap targets under {minimum} px',
    description:
      'The second of the three checks. {minimum} is the smallest side this check accepts, in CSS pixels, taken from the check itself so the two cannot part.',
  },
  checkOffPalette: {
    id: 'tools.measure.check.offPalette',
    defaultMessage: 'Colours off the palette',
    description:
      'The third of the three checks. tools.measure.kind.offPalette is the same check named on a finding, where it is a badge and reads shorter.',
  },
  kindOverflow: {
    id: 'tools.measure.kind.overflow',
    defaultMessage: 'overflow',
    description:
      'A badge on a finding, saying which of the three checks found it. tools.measure.check.overflow is the same check in the list above, where it has room for a full name.',
  },
  kindTapTarget: {
    id: 'tools.measure.kind.tapTarget',
    defaultMessage: 'tap target',
    description:
      'A badge on a finding, saying which of the three checks found it. tools.measure.check.tapTarget is the same check in the list above.',
  },
  kindOffPalette: {
    id: 'tools.measure.kind.offPalette',
    defaultMessage: 'colour',
    description:
      'A badge on a finding, saying which of the three checks found it. tools.measure.check.offPalette is the same check in the list above.',
  },
  runChecks: {
    id: 'tools.measure.run',
    defaultMessage: 'Run checks',
    description: 'Runs all three checks over the framed app as it stands now.',
  },
  outlineBoxes: {
    id: 'tools.measure.outline',
    defaultMessage: 'Outline boxes',
    description:
      'A toggle that draws a one-pixel outline around every element in the frame, so a box can be seen rather than measured.',
  },
  scanned: {
    id: 'tools.measure.scanned',
    defaultMessage: 'Ran across {count} elements.',
    description:
      'Beside the run button after a run. {count} is how many elements the checks looked at. tools.measure.none says the same number where nothing at all was found.',
  },
  nothingFound: {
    id: 'tools.measure.none',
    defaultMessage: 'Nothing found across {count} elements.',
    description:
      'Where the findings would be, after a run that produced none. {count} is how many elements were looked at.',
  },
  lightNote: {
    id: 'tools.measure.lightNote',
    defaultMessage:
      'Colours are ambiguous in light: several tokens share #ffffff, several share #333333, and a value match cannot say which was meant. Re-run in dark, where the palette spreads over more distinct values.',
    description:
      'Shown after a run against the light palette, because a colour check can only match values and the light palette puts many tokens on one value. The two hex colours and the two palette names stay as they are written.',
  },
  markFindings: {
    id: 'tools.measure.mark',
    defaultMessage: '{count, plural, one {finding} other {findings}}',
    description:
      'The word beside the number on the measure tool’s icon in the rail, read aloud and also its tooltip. {count} is the number itself, which is drawn separately, so this is the noun alone.',
  },

  inspectNeedsDev: {
    id: 'tools.inspect.needsDev',
    defaultMessage:
      'The source line comes from the owner stack React keeps beside each node, and a production bundle keeps none. The picker stays disarmed here.',
    description: 'Why the picker below it is disabled in the published export.',
  },
  pick: {
    id: 'tools.inspect.arm',
    defaultMessage: 'Pick element',
    description:
      'Arms the picker. tools.inspect.armed is what the same button says once it is armed.',
  },
  picking: {
    id: 'tools.inspect.armed',
    defaultMessage: 'Picker armed, click in the frame',
    description:
      'What the button says while the picker is waiting for a click inside the framed app. tools.inspect.arm is what it says before that.',
  },
  noLabel: {
    id: 'tools.inspect.noLabel',
    defaultMessage: 'Element with no label',
    description:
      'Where the picked element’s own text would be, for a node that has none and no accessibility label either. tools.inspect.handover.noLabel says the same thing inside the plain-text block, where it is parenthesised.',
  },
  nothingChosen: {
    id: 'tools.inspect.nothing',
    defaultMessage: 'Nothing chosen.',
    description: 'Where the picked element’s own text would be, before anything has been picked.',
  },
  noSource: {
    id: 'tools.inspect.noSource',
    defaultMessage:
      'No source: either nothing in this node’s owner chain is app code, or the bundle keeps no owner stacks at all, which is every production build.',
    description: 'Shown where the owner chain would be, for a pick that resolved to no app code.',
  },
  stack: {
    id: 'tools.inspect.stack',
    defaultMessage: 'Source stack, innermost first',
    description:
      'The legend over the owner chain, whose rows are a radio group: only the person looking knows which level they meant.',
  },
  block: {
    id: 'tools.inspect.block',
    defaultMessage: 'Handover block',
    description:
      'The accessible name of the read-only field holding the plain text that gets pasted into a chat. What is in it is tools.inspect.handover.*, with paths and an address.',
  },
  copyForAgent: {
    id: 'tools.inspect.copy',
    defaultMessage: 'Copy for agent',
    description: 'Copies that block to the clipboard.',
  },
  openInEditor: {
    id: 'tools.inspect.open',
    defaultMessage: 'Open in editor',
    description:
      'Opens the chosen file at the chosen line, through the dev server’s own open-in-editor endpoint.',
  },
  blockNote: {
    id: 'tools.inspect.note',
    defaultMessage: 'The block carries this view’s address.',
    description:
      'Under the block, saying the one thing about it that is not obvious from reading it: whoever picks the note up can put the same thing back on screen.',
  },
});

export interface ToolBindings {
  scheme: Scheme;
  tokens: {
    overrides: Overrides;
    set: (next: Overrides) => void;
    textPass: boolean;
    setTextPass: (on: boolean) => void;
  };
  measure: {
    outline: boolean;
    setOutline: (on: boolean) => void;
    report: { findings: Finding[]; scheme: Scheme; scanned: number } | null;
    run: () => void;
  };
  inspect: {
    picking: boolean;
    setPicking: (on: boolean) => void;
    hit: { label: string; frames: Located[] } | null;
    /** Which frame of the owner chain the person meant. */
    selected: number;
    setSelected: (index: number) => void;
    open: (frame: Located) => void;
  };
}

/**
 * What each of the preview's six tools is handed.
 *
 * These used to be one `Props` and a `Panel` wrapper each, and this file owned
 * which of them were open — a comment here said so: "which panels are open is
 * local to this component". It is in the address on every route now
 * (`shell/address.ts`), the chrome is `ui/ToolRail.tsx` and `ui/ToolPanel.tsx`,
 * and what is left here is six bodies and the two numbers that go on the rail.
 * ADR 0028 records the first move and ADR 0038 the second.
 */
interface Props {
  state: PreviewState;
  status: Status;
  logs: LogEntry[];
  tools: ToolBindings;
  onChange: (patch: Partial<PreviewState>) => void;
  onClearLogs: () => void;
}

/**
 * A readout inside the panel: the panel's own `canvas` behind a `stroke` border,
 * rather than a second shade. Two roles and no shades at all is what keeps the
 * whole panel legible when the scheme flips.
 */
const CARD = 'rounded-md border border-stroke bg-canvas';
const NOTE = 'text-s leading-relaxed text-on-canvas-muted';
/** An identifier in a sentence. A border rather than a fill, so it reads on both grounds. */
const CODE = 'rounded-s border border-stroke px-3xs font-mono text-[0.8125rem]';
const SEG = 'inline-flex flex-wrap gap-4xs rounded-md border border-stroke bg-canvas p-4xs';

/**
 * The two runs drawn inside the rich messages above, at module scope.
 *
 * Beside the descriptors rather than inside a render, which is the shape
 * `ui/Settings.tsx` already uses for its three: a component built during a render
 * is remounted on every one of them, and `react/no-unstable-nested-components`
 * says so. Here rather than beside `COPY` only because both reach for a class
 * declared on the lines above.
 */
const code = (chunks: ReactNode[]) => <code className={CODE}>{chunks}</code>;

const b = (chunks: ReactNode[]) => <b className="font-semibold text-on-canvas">{chunks}</b>;

/**
 * One toggle in the console's level filter, which is the only place left that
 * wants this shape and buttons at once.
 *
 * `aria-pressed` is right here and was wrong on the two exclusive choices that
 * used to share this helper: the levels are a set, several can be on, and
 * "warnings are showing" is exactly what pressed means. Those two are
 * `ui/kit/segmented.tsx` now.
 */
function segment(on: boolean): string {
  return cn(
    'rounded-s px-xs py-3xs text-s font-medium transition-colors',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
    on ? 'bg-accent text-white' : 'text-on-canvas-muted hover:bg-surface hover:text-on-canvas',
  );
}

/**
 * A count, always with its number and the word it counts written out, never a
 * colour on its own.
 *
 * Three things separate a warning from an error at once: the shape of the icon,
 * the word beside the number, and the fill. The fill alone would fail for a
 * reader who cannot see it and for anyone reading a greyscale screenshot, which
 * is how most of this tool's output travels.
 *
 * **The word is the row this stands in, and so is not here at all.** This took a
 * `label` for it once and the one caller left in the file never passed one, so
 * the parameter and the space in front of it were dead: every badge this draws
 * sits at the right-hand end of a row whose left-hand end is the name of the
 * check being counted. The number alone is the whole of what the badge adds.
 */
function Count({ n, tone }: { n: number; tone: 'warn' | 'err' }) {
  if (n === 0) {
    return (
      <Badge variant="outline" className="tabular-nums">
        <Check aria-hidden="true" className="size-[0.75rem]" />
        {n}
      </Badge>
    );
  }
  const Icon = tone === 'err' ? OctagonAlert : TriangleAlert;
  return (
    <Badge
      className={cn(
        'border-transparent tabular-nums',
        // Neither of these follows the scheme, and that is the point: a hazard
        // mark that changed colour with the page would stop being a hazard mark.
        // The ink on each is the one the palette fixes for it.
        tone === 'err' ? 'bg-red-500 text-white' : 'bg-yellow-400 text-neutral-700',
      )}
    >
      <Icon aria-hidden="true" className="size-[0.75rem]" />
      {n}
    </Badge>
  );
}

/**
 * A number on a tool's icon in the rail, and nothing at all when there is none.
 *
 * The rail is always on screen, so what sits on it is always on screen, and the
 * badges this replaces were mostly announcements that nothing had happened:
 * `untouched`, `inert here`, `combination unknown`, `findings, not run`. Two
 * survive, warnings-or-errors and findings, and both of those draw nothing at
 * zero — a clean run is the ordinary case and a permanent chip saying so is a
 * permanent chip. The exact split is in the tool, which is one press away.
 *
 * `title` rather than a tooltip: the rail button already owns one, and a second
 * trigger inside the first is two popups on one hover.
 *
 * `label` arrives formatted, and it is the NOUN rather than the whole phrase: the
 * number is drawn on its own and read again beside the word, so a caller hands in
 * "findings" and this puts the count in front of it. Which also means the plural
 * is the caller's to choose, which is why each of the three is a message with a
 * `{count}` in it.
 */
function Mark({ n, tone, label }: { n: number; tone: 'warn' | 'err'; label: string }) {
  if (n === 0) return null;
  return (
    <span
      title={`${n} ${label}`}
      className={cn(
        'min-w-[1rem] rounded-full px-4xs text-center font-mono text-[0.625rem] font-semibold leading-[1rem] tabular-nums',
        tone === 'err' ? 'bg-red-500 text-white' : 'bg-yellow-400 text-neutral-700',
      )}
    >
      {n > 99 ? '99+' : n}
      <span className="sr-only"> {label}</span>
    </span>
  );
}

/**
 * Why a control above it is disabled, said in words next to the control.
 *
 * Rendered only where the dev handle is absent, which is the same condition that
 * disables the control, so the reason and the disabled state cannot drift apart.
 * This is also where the whole of that fact lives now. The panel used to open
 * with a build line and a paragraph under it — "Store handle absent, the
 * appearance setting and the inspector are inert" — which is true, and was
 * printed above six tools of which it concerns two. The status line says which
 * build is in the frame; the two tools it disables say so themselves, here.
 * ([ADR 0038](../../../../../adr/0038-one-tool-at-a-time-in-a-rail.md))
 */
function NeedsDev({ children }: { children: ReactNode }) {
  const intl = useWorkbenchIntl();
  return (
    <div className={cn(CARD, 'flex flex-col gap-2xs p-xs')}>
      <Badge className="self-start border-transparent bg-yellow-400 text-neutral-700">
        <TriangleAlert aria-hidden="true" className="size-[0.75rem]" />
        {intl.formatMessage(COPY.needsDev)}
      </Badge>
      <p className={NOTE}>{children}</p>
    </div>
  );
}

const SETTINGS: ThemeSetting[] = ['light', 'dark', 'system'];

/**
 * The two grounds a device scheme means.
 *
 * Written out rather than taken from the palette, and that is the point: these
 * stand for the scheme the *device* reports, so they must not follow the one this
 * page is painted in. The token package has no name for "the dark canvas as a
 * fixed value", which is the boundary AGENTS.md describes, where the app says
 * `always-dark` and the package says nothing. palette-exempt.
 */
const SWATCH = { light: '#ffffff', dark: '#1a1a1a' }; // palette-exempt

/**
 * All four combinations of appearance setting and device scheme, named.
 *
 * `TROUBLESHOOTING.md`: "Check a colour change in all three settings, and check
 * `'system'` against both device schemes. That is four combinations, and only the
 * fourth was broken." The fourth is also the app's default, which is why it is
 * marked here rather than left to be counted.
 *
 * The shell can only set the inner half. `prefers-color-scheme` cannot be forced
 * per iframe, so 3 and 4 need the browser's own emulation, and this panel says
 * which one is on screen rather than pretending to have got you there. The four
 * are a readout for that reason; the setting, which is the half this page can
 * write, is the segmented control above them. Each row carries where it is
 * reached — `here` or `DevTools` — as a chip rather than as the sentence it used
 * to carry, which said the same thing four times.
 */
export function Appearance({ status, onChange }: Props) {
  const intl = useWorkbenchIntl();
  const unknown = intl.formatMessage(COPY.unknown);
  return (
    <>
      <dl className="grid grid-cols-2 gap-xs">
        <div className={cn(CARD, 'min-w-0 px-xs py-2xs')}>
          <dt className="text-s text-on-canvas-muted">{intl.formatMessage(COPY.appSetting)}</dt>
          {/* The VALUE of the app's own setting, in the app's own spelling and in
              a monospaced face to say so. `light`, `dark` and `system` are what
              is in the store, not words this site chose. */}
          <dd className="mt-4xs truncate font-mono text-m text-on-canvas">
            {status.appTheme ?? unknown}
          </dd>
        </div>
        <div className={cn(CARD, 'min-w-0 px-xs py-2xs')}>
          <dt className="text-s text-on-canvas-muted">{intl.formatMessage(COPY.deviceReports)}</dt>
          <dd className="mt-4xs flex min-w-0 items-center gap-2xs font-mono text-m text-on-canvas">
            <span
              className="size-[0.625rem] shrink-0 rounded-full border border-stroke-strong"
              style={{ background: SWATCH[status.scheme ?? 'light'] }}
              aria-hidden="true"
            />
            <span className="truncate">{status.scheme ?? unknown}</span>
          </dd>
        </div>
      </dl>

      {/* The three options are the three values the setting can hold, so each
          segment is labelled with the value it writes. The legend above them is
          this site's own words and is a message. */}
      <Segmented
        name="app-theme"
        legend={intl.formatMessage(COPY.appLegend)}
        showLegend
        disabled={!status.handle}
        value={status.appTheme ?? ''}
        options={SETTINGS.map((setting) => ({ value: setting, label: setting }))}
        onChange={(value) => onChange({ theme: value as ThemeSetting })}
      />

      {!status.handle && (
        <NeedsDev>{intl.formatMessage(COPY.appearanceNeedsDev, { code })}</NeedsDev>
      )}

      <ol className="flex flex-col gap-3xs">
        {COMBINATIONS.map((c) => {
          const active = status.combination === c.n;
          return (
            <li
              key={c.n}
              aria-current={active}
              className={cn(
                CARD,
                'flex min-w-0 flex-wrap items-center gap-2xs px-xs py-2xs',
                active && 'border-accent',
              )}
            >
              <span className="shrink-0 font-mono text-m tabular-nums text-on-canvas-muted">
                {c.n}
              </span>
              <span className="min-w-0 flex-1 text-m text-on-canvas">
                {intl.formatMessage(c.label)}
              </span>
              {c.isDefault && <Badge variant="alt">{intl.formatMessage(COPY.default)}</Badge>}
              {active && <Badge variant="accent">{intl.formatMessage(COPY.onScreen)}</Badge>}
              {/* `DevTools` is the browser's own name for the thing that has to
                  be opened, so it is a mark and not a message; `here` is this
                  site pointing at itself and is one. */}
              <Badge variant="outline">
                {c.scheme === undefined ? intl.formatMessage(COPY.here) : 'DevTools'}
              </Badge>
            </li>
          );
        })}
      </ol>

      <p className={NOTE}>{intl.formatMessage(COPY.appearanceNote, { code })}</p>
    </>
  );
}

/**
 * Storage fixtures. Each is a whole state rather than a patch, and each costs a
 * reload: `onboardingDone` and the feed cache are both read before the first
 * render, so neither can be dispatched after the fact.
 *
 * The design marks this panel as needing a development build, and it does not:
 * a fixture is written to `window.localStorage`, which same-origin makes the
 * app's own, before the frame is pointed at a route. That works in the static
 * export, so nothing here warns about the build.
 */
export function State({ state, onChange }: Props) {
  const intl = useWorkbenchIntl();
  return (
    <>
      <fieldset className="min-w-0">
        <legend className={cn(NOTE, 'mb-2xs')}>{intl.formatMessage(COPY.fixtures)}</legend>
        <div className="flex flex-col gap-3xs">
          {/*
            First, and the default, because the plain demo link carries no
            fixture: `preview` with no `s` must not wipe what the last visit left
            in storage on its way in.

            Its two words are here rather than in `fixtures.*` because it is not
            a fixture: there is no entry in `frame/seed.ts` for doing nothing.
          */}
          <Fixture
            label={intl.formatMessage(COPY.leaveAlone)}
            hint={intl.formatMessage(COPY.leaveAloneHint)}
            value=""
            checked={state.seed === null}
            onSelect={() => onChange({ seed: null })}
          />
          {FIXTURES.map((f) => (
            <Fixture
              key={f.id}
              label={intl.formatMessage(f.label)}
              hint={intl.formatMessage(f.hint)}
              value={f.id}
              checked={state.seed === f.id}
              onSelect={() => onChange({ seed: f.id })}
            />
          ))}
        </div>
      </fieldset>
    </>
  );
}

/** One fixture, as a real radio, so the group behaves like a group under the arrow keys. */
function Fixture({
  label,
  hint,
  value,
  checked,
  onSelect,
}: {
  label: string;
  hint: string;
  value: string;
  checked: boolean;
  onSelect: () => void;
}) {
  return (
    <label
      aria-label={label}
      className={cn(
        CARD,
        'flex cursor-pointer items-start gap-xs p-xs',
        'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent',
        checked && 'border-accent',
      )}
    >
      <input
        type="radio"
        name="wb-fixture"
        value={value}
        checked={checked}
        onChange={onSelect}
        className="mt-4xs size-[0.875rem] shrink-0 accent-accent"
      />
      <div className="min-w-0">
        <div className="text-m font-semibold text-on-canvas">{label}</div>
        <div className={NOTE}>{hint}</div>
      </div>
    </label>
  );
}

const LEVELS: Level[] = ['warn', 'error'];

/**
 * What the app said. A screenshot cannot show this, which is why it is here.
 *
 * The frame's console is patched for two levels only, so the design's third
 * filter has nothing to filter: an `error` and a `warn` are what
 * `frame/console.ts` collects, and a button for `log` would switch a category
 * that can never arrive.
 */
/**
 * One number on the icon, and it is the worse of the two.
 *
 * An error outranks a warning, so a run with both shows the errors: the rail has
 * room for one mark, and the one worth interrupting somebody for is the one that
 * goes on it. The split is the first thing the tool prints.
 */
export function ConsoleMark({ status }: Props) {
  const intl = useWorkbenchIntl();
  return status.errors > 0 ? (
    <Mark
      n={status.errors}
      tone="err"
      label={intl.formatMessage(COPY.markErrors, { count: status.errors })}
    />
  ) : (
    <Mark
      n={status.warnings}
      tone="warn"
      label={intl.formatMessage(COPY.markWarnings, { count: status.warnings })}
    />
  );
}

export function Console({ status, logs, onClearLogs }: Props) {
  const intl = useWorkbenchIntl();
  const [levels, setLevels] = useState<ReadonlySet<Level>>(() => new Set(LEVELS));
  const [filter, setFilter] = useState('');

  const needle = filter.trim().toLowerCase();
  const shown = logs.filter(
    (entry) =>
      levels.has(entry.level) && (needle === '' || entry.text.toLowerCase().includes(needle)),
  );

  return (
    <>
      <div className="flex flex-wrap items-center gap-xs">
        {/* A fieldset rather than a div carrying `role="group"`: `prefer-tag-over-role`
            asks for the element, and the legend is the group's name either way. */}
        <fieldset className={SEG}>
          <legend className="sr-only">{intl.formatMessage(COPY.levels)}</legend>
          {/* The two buttons say `warn` and `error`, which are the console's own
              level names and the same two words the chip on each row carries. */}
          {LEVELS.map((level) => (
            <button
              key={level}
              type="button"
              aria-pressed={levels.has(level)}
              onClick={() =>
                setLevels((current) => {
                  const next = new Set(current);
                  if (!next.delete(level)) next.add(level);
                  return next;
                })
              }
              className={segment(levels.has(level))}
            >
              {level}
            </button>
          ))}
        </fieldset>
        <input
          type="search"
          placeholder={intl.formatMessage(COPY.consoleFilterPlaceholder)}
          aria-label={intl.formatMessage(COPY.consoleFilter)}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className={cn(
            CARD,
            'min-w-[5rem] flex-1 px-xs py-3xs font-mono text-s text-on-canvas',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
          )}
        />
        <Button variant="outline" size="sm" onClick={onClearLogs} disabled={logs.length === 0}>
          <Eraser aria-hidden="true" />
          {intl.formatMessage(COPY.clear)}
        </Button>
      </div>

      {/*
        A plain scroller, not Radix's `ScrollArea`: that wraps its content in a
        box which sizes to the content, and a line that can be as wide as it likes
        never truncates. These lines are single-line on purpose, with the whole
        text on the row's title for the one that matters.
      */}
      <div
        role="log"
        aria-live="polite"
        aria-label={intl.formatMessage(COPY.consoleLog)}
        className={cn(CARD, 'max-h-[16rem] overflow-y-auto overflow-x-hidden p-4xs')}
      >
        {shown.length === 0 ? (
          <p className={cn(NOTE, 'px-xs py-2xs')}>
            {intl.formatMessage(logs.length === 0 ? COPY.consoleEmpty : COPY.consoleNoMatch)}
          </p>
        ) : (
          shown.map((entry) => (
            <div key={entry.id} className="flex min-w-0 items-baseline gap-xs px-3xs py-4xs">
              <span
                className={cn(
                  'shrink-0 rounded-s px-3xs font-mono text-[0.75rem] font-semibold uppercase',
                  entry.level === 'error'
                    ? 'bg-red-500 text-white'
                    : 'bg-yellow-400 text-neutral-700',
                )}
              >
                {entry.level}
              </span>
              {/* The app's own output, in whatever words it was written in.
                  `frame/console.ts` says why none of it is a message. */}
              <span className="min-w-0 flex-1 truncate font-mono text-s" title={entry.text}>
                {entry.text}
              </span>
            </div>
          ))
        )}
      </div>

      <p className={NOTE}>
        {intl.formatMessage(COPY.consoleSummary, {
          shown: shown.length,
          total: logs.length,
          warnings: status.warnings,
          errors: status.errors,
        })}
      </p>
    </>
  );
}

/**
 * The palette, live. Changing a value here recolours the running app; nothing is
 * written to `tokens/theme.css`, which is vendored from `wp-design-tokens` and
 * stays the source of truth. Copy takes the result there.
 *
 * Nothing here warns about the build, unlike the design: the override is a
 * stylesheet appended to the frame's own document, which same-origin allows in
 * any build.
 */
export function Tokens({ tools }: Props) {
  const intl = useWorkbenchIntl();
  const { scheme, tokens } = tools;
  const changed = TOKENS.filter((t) => tokens.overrides[t]?.[scheme]);

  const setToken = (token: (typeof TOKENS)[number], value: string | null) => {
    const next: Overrides = { ...tokens.overrides, [token]: { ...tokens.overrides[token] } };
    if (value) next[token]![scheme] = value;
    else delete next[token]![scheme];
    tokens.set(next);
  };

  return (
    <>
      <p className={NOTE}>{intl.formatMessage(COPY.tokensLede, { scheme, b })}</p>

      <div className="flex flex-col gap-3xs">
        {TOKENS.map((token) => {
          const override = tokens.overrides[token]?.[scheme];
          const value = override ?? PALETTE[scheme][token];
          return (
            <label
              key={token}
              className={cn(
                CARD,
                'flex min-w-0 cursor-pointer items-center gap-xs px-xs py-3xs',
                'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent',
                override && 'border-accent',
              )}
            >
              <input
                type="color"
                value={value}
                onChange={(e) => setToken(token, e.target.value)}
                className="size-[1.25rem] shrink-0 cursor-pointer rounded-s border border-stroke bg-canvas p-0"
              />
              <code className="min-w-0 flex-1 truncate font-mono text-s text-on-canvas">
                --color-{token}
              </code>
              {override && <Badge variant="outline">{intl.formatMessage(COPY.changed)}</Badge>}
              <span className="shrink-0 font-mono text-s tabular-nums text-on-canvas-muted">
                {value}
              </span>
            </label>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-xs">
        <Button
          variant="outline"
          size="sm"
          disabled={!changed.length}
          onClick={() => tokens.set({})}
        >
          <RotateCcw aria-hidden="true" />
          {intl.formatMessage(COPY.resetOverrides)}
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={!changed.length}
          onClick={() => void navigator.clipboard.writeText(asCss(tokens.overrides))}
        >
          <Copy aria-hidden="true" />
          {intl.formatMessage(COPY.copyCss)}
        </Button>
        <span className={NOTE}>
          {intl.formatMessage(COPY.changedCount, { count: changed.length })}
        </span>
      </div>

      <label className="flex items-center gap-xs text-m text-on-canvas">
        <input
          type="checkbox"
          checked={tokens.textPass}
          onChange={(e) => tokens.setTextPass(e.target.checked)}
          className="size-[0.875rem] shrink-0 accent-accent"
        />
        {intl.formatMessage(COPY.textToo)}
      </label>
      {/* The caveat, and it is one clause because it is one fact: text and icons
          are resolved in JavaScript and land in inline styles, so nothing can
          follow the variable for them and this chases the old value instead. */}
      <p className={NOTE}>{intl.formatMessage(COPY.textNote)}</p>
    </>
  );
}

/**
 * The three checks, as a name and a count each.
 *
 * Each of these carried a second line saying what it meant — "Anything wider than
 * the frame it is drawn in", and two more like it — which is three sentences
 * above a list of the findings themselves, each of which names what it found. The
 * titles say enough; the findings say the rest.
 */
const CHECKS: { kind: Finding['kind']; title: MessageDescriptor }[] = [
  { kind: 'overflow', title: COPY.checkOverflow },
  { kind: 'tap-target', title: COPY.checkTapTarget },
  { kind: 'off-palette', title: COPY.checkOffPalette },
];

/**
 * The same three checks again, as a badge on a finding.
 *
 * Named for the domain rather than folded into `COPY`, which is what the
 * repository does with a `Record` of labels for a domain's values.
 */
const KIND_LABELS: Record<Finding['kind'], MessageDescriptor> = {
  overflow: COPY.kindOverflow,
  'tap-target': COPY.kindTapTarget,
  'off-palette': COPY.kindOffPalette,
};

/** The mechanical half of looking: overflow, tap targets, colours off the palette. */
export function MeasureMark({ tools }: Props) {
  const intl = useWorkbenchIntl();
  const count = tools.measure.report?.findings.length ?? 0;
  return <Mark n={count} tone="warn" label={intl.formatMessage(COPY.markFindings, { count })} />;
}

export function Measure({ tools }: Props) {
  const intl = useWorkbenchIntl();
  const { measure } = tools;
  const report = measure.report;
  const count = (kind: Finding['kind']) =>
    report ? report.findings.filter((f) => f.kind === kind).length : null;

  return (
    <>
      <div className="flex flex-wrap items-center gap-xs">
        <Button size="sm" onClick={measure.run}>
          <Play aria-hidden="true" />
          {intl.formatMessage(COPY.runChecks)}
        </Button>
        {/* The variant carries the pressed state as well as `aria-pressed`,
            because an outline button tinted with `surface` would be tinted the
            dock's own ground and so would look exactly like the off state. */}
        <Button
          variant={measure.outline ? 'default' : 'outline'}
          size="sm"
          aria-pressed={measure.outline}
          onClick={() => measure.setOutline(!measure.outline)}
        >
          {intl.formatMessage(COPY.outlineBoxes)}
        </Button>
        {report && (
          <span className={NOTE}>
            {intl.formatMessage(COPY.scanned, { count: report.scanned })}
          </span>
        )}
      </div>

      {/* Counted only after a run. A column of "not run" beside three check names
          is a column saying nothing, three times, above the button that would
          change it. */}
      <ul className="flex flex-col gap-3xs">
        {CHECKS.map((check) => {
          const n = count(check.kind);
          return (
            <li
              key={check.kind}
              className={cn(CARD, 'flex items-center gap-xs px-xs py-2xs text-m text-on-canvas')}
            >
              <span className="min-w-0 flex-1">
                {intl.formatMessage(check.title, { minimum: MIN_TAP })}
              </span>
              {n !== null && <Count n={n} tone="warn" />}
            </li>
          );
        })}
      </ul>

      <div className="flex flex-col gap-3xs">
        {report !== null && report.findings.length === 0 && (
          <p className={NOTE}>{intl.formatMessage(COPY.nothingFound, { count: report.scanned })}</p>
        )}
        {report?.findings.map((f) => (
          <div
            key={`${findingKey(f)}:${f.where}`}
            className={cn(CARD, 'flex min-w-0 flex-col gap-4xs px-xs py-2xs')}
          >
            <div className="flex min-w-0 items-center gap-xs">
              <Badge variant="outline">{intl.formatMessage(KIND_LABELS[f.kind])}</Badge>
              <span className="min-w-0 flex-1 text-s text-on-canvas">
                {intl.formatMessage(f.says, f.values)}
              </span>
            </div>
            {f.where && (
              <code
                title={f.where}
                className="block truncate font-mono text-[0.8125rem] text-on-canvas-muted"
              >
                {f.where}
              </code>
            )}
          </div>
        ))}
      </div>

      {report?.scheme === 'light' && <p className={NOTE}>{intl.formatMessage(COPY.lightNote)}</p>}
    </>
  );
}

/**
 * Click a thing, get the line that drew it, and hand both to someone else.
 *
 * The owner chain is offered rather than resolved, because only the person
 * looking knows which level they mean: "this chip" and "the row of chips" are two
 * entries of the same chain. The selected one becomes `Source:` in the block
 * below, the rest become `Context:`.
 */
export function Inspect({ status, tools }: Props) {
  const intl = useWorkbenchIntl();
  const { inspect } = tools;
  const section = useRef<HTMLDivElement>(null);

  // The panel scrolls, and this tool is the one that grows: on a laptop the
  // result of a pick lands below the fold, which would hide the only part of the
  // interaction that matters.
  useEffect(() => {
    if (inspect.hit) section.current?.scrollIntoView({ block: 'nearest' });
  }, [inspect.hit]);

  const frames = inspect.hit?.frames ?? [];
  const chosen = frames[inspect.selected] ?? frames[0];
  const block =
    inspect.hit && frames.length > 0
      ? handover(
          {
            label: inspect.hit.label,
            frames,
            selected: inspect.selected,
            view: location.href,
          },
          intl,
        )
      : '';

  return (
    <div ref={section} className="flex flex-col gap-s">
      {!status.handle && <NeedsDev>{intl.formatMessage(COPY.inspectNeedsDev)}</NeedsDev>}

      <fieldset disabled={!status.handle} className="flex flex-col gap-s disabled:opacity-60">
        <div>
          <Button
            variant={inspect.picking ? 'default' : 'outline'}
            size="sm"
            aria-pressed={inspect.picking}
            onClick={() => inspect.setPicking(!inspect.picking)}
          >
            <Crosshair aria-hidden="true" />
            {intl.formatMessage(inspect.picking ? COPY.picking : COPY.pick)}
          </Button>
        </div>

        <p className={cn(CARD, 'min-w-0 truncate px-xs py-2xs font-mono text-s text-on-canvas')}>
          {/* The element's OWN text, quoted, and this site's words only where
              there is none of it to quote. */}
          {inspect.hit
            ? inspect.hit.label
              ? `"${inspect.hit.label}"`
              : intl.formatMessage(COPY.noLabel)
            : intl.formatMessage(COPY.nothingChosen)}
        </p>

        {inspect.hit && frames.length === 0 && (
          <p className={NOTE}>{intl.formatMessage(COPY.noSource)}</p>
        )}

        {frames.length > 0 && (
          <>
            <fieldset className="min-w-0">
              <legend className={cn(NOTE, 'mb-2xs')}>{intl.formatMessage(COPY.stack)}</legend>
              <div className="flex flex-col gap-3xs">
                {frames.map((f, index) => (
                  <label
                    key={`${f.file}:${f.lineNumber}:${f.column}`}
                    aria-label={frameLabel(f)}
                    className={cn(
                      CARD,
                      'flex min-w-0 cursor-pointer items-start gap-xs px-xs py-2xs',
                      'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent',
                      index === inspect.selected && 'border-accent',
                    )}
                  >
                    <input
                      type="radio"
                      name="wb-frame"
                      checked={index === inspect.selected}
                      onChange={() => inspect.setSelected(index)}
                      className="mt-4xs size-[0.875rem] shrink-0 accent-accent"
                    />
                    <span className="min-w-0 flex-1">
                      <code className="block truncate font-mono text-s text-on-canvas">
                        {frameShort(f)}
                        {f.methodName ? ` · ${f.methodName}` : ''}
                      </code>
                      <span className={cn(NOTE, 'block truncate')} title={frameLabel(f)}>
                        {frameLabel(f)}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            {/* A textarea rather than a `pre`, so the text can be selected and
                  scrolled by someone who would rather not press the button. */}
            <textarea
              readOnly
              rows={5}
              value={block}
              aria-label={intl.formatMessage(COPY.block)}
              className={cn(
                CARD,
                'w-full resize-y p-xs font-mono text-s text-on-canvas',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
              )}
            />
            <div className="flex flex-wrap items-center gap-xs">
              <Button size="sm" onClick={() => void navigator.clipboard.writeText(block)}>
                <Copy aria-hidden="true" />
                {intl.formatMessage(COPY.copyForAgent)}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!chosen}
                onClick={() => chosen && inspect.open(chosen)}
              >
                <ExternalLink aria-hidden="true" />
                {intl.formatMessage(COPY.openInEditor)}
              </Button>
            </div>
            {/* What the block is for, in the one clause that is not obvious from
                reading it: the view's own address is in there, so whoever picks
                this up can put the same thing back on screen. */}
            <p className={NOTE}>{intl.formatMessage(COPY.blockNote)}</p>
          </>
        )}
      </fieldset>
    </div>
  );
}
