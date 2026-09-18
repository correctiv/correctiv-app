import { Languages, Moon, Sun, SunMoon } from 'lucide-react';
import type { ReactNode } from 'react';
import { defineMessages, type IntlShape, type MessageDescriptor } from 'react-intl';

import docsModule from 'virtual:docs';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from './kit/dialog';
import { cn } from '../lib/cn';
import { MEASURED_ON } from '../../content/sources.manifest';
import { ageInWords } from '../lib/measured';
import { useWorkbenchIntl } from '../i18n/Localisation';
import { tagOf, type LanguageChoice } from '../i18n/language';
import type { Appearance } from '../theme';

/**
 * Everything this dialog says, in ENGLISH; the German that ships is
 * `src/i18n/catalogue/de/settings.ts`.
 *
 * Chrome through and through, which is what ADR 0050 §2 puts on this side of the
 * line: the appearance, the shortcuts and the sentence about the build are the
 * site talking about itself. The two exceptions are below, in `TONGUES`, and they
 * are exceptions for a reason a translation would defeat.
 */
const COPY = defineMessages({
  title: {
    id: 'settings.title',
    defaultMessage: 'Settings',
    description:
      'The heading of this dialog. shell.header.settings is the button in the header that opens it and reads the same in English.',
  },
  lede: {
    id: 'settings.lede',
    defaultMessage:
      'For this browser. Nothing here is sent anywhere or shared with the app in the frame, which keeps its own setting.',
  },

  appearance: {
    id: 'settings.appearance',
    defaultMessage: 'Appearance',
    description:
      'The heading of the light/dark group, and the same words again as that group’s legend, which is read aloud and not drawn. shell.section.appearance is the preview tool that pins the framed app and reads the same in English.',
  },
  light: { id: 'settings.mode.light', defaultMessage: 'Light' },
  lightHint: { id: 'settings.mode.light.hint', defaultMessage: 'Always light' },
  dark: { id: 'settings.mode.dark', defaultMessage: 'Dark' },
  darkHint: { id: 'settings.mode.dark.hint', defaultMessage: 'Always dark' },
  system: {
    id: 'settings.mode.system',
    defaultMessage: 'System',
    description:
      'The third APPEARANCE choice, and the default: whatever the device is set to. settings.mode.system.hint is the line under it, and settings.language.system is the same word one group further down for the language.',
  },
  systemHint: { id: 'settings.mode.system.hint', defaultMessage: 'Follow the device' },

  language: {
    id: 'settings.language',
    defaultMessage: 'Language · Sprache',
    description:
      'The heading of the language group, and the same words again as its legend. Every translation of it carries BOTH language names, because this is the one control a reader has to find in a language they may not be reading yet; what a translation changes is which of the two comes first.',
  },
  systemLanguage: {
    id: 'settings.language.system',
    defaultMessage: 'System',
    description:
      'The third LANGUAGE choice, and the default: whichever of this site\u2019s languages the browser asks for. settings.mode.system is the same word one group up for the appearance, and settings.language.system.hint is the line under this one. The two rows beside it name themselves \u2014 English and Deutsch \u2014 and are not translated at all; this is the only row in the group that has no language of its own, which is why it is a message.',
  },
  systemLanguageHint: {
    id: 'settings.language.system.hint',
    defaultMessage: 'Follow the browser',
    description:
      'The line under the System language choice. settings.mode.system.hint says \u201cFollow the device\u201d one group up and means the appearance; this one means the language list the browser sends, which is a setting of the browser rather than of the machine.',
  },

  keyboard: { id: 'settings.keyboard', defaultMessage: 'Keyboard' },
  search: {
    id: 'settings.shortcut.search',
    defaultMessage: 'Search documents, sections and the API',
  },
  panel: {
    id: 'settings.shortcut.panel',
    defaultMessage: 'The tool panel, whatever the open view puts there',
  },
  leaveFull: {
    id: 'settings.shortcut.leaveFull',
    defaultMessage: 'Leave full screen on the app view',
  },

  build: { id: 'settings.build', defaultMessage: 'This build' },
  buildNote: {
    id: 'settings.build.note',
    defaultMessage:
      'Rendered from commit <commitLink>{commit}</commitLink>, and every link into the source points at that commit rather than at <code>main</code>. The source figures were measured by hand on <day>{measured}</day>, {age}.',
    description:
      'The paragraph under the build heading. {commit} is the seven-character hash and is drawn as the link into the repository; {measured} is the ISO day the source figures were taken; {age} is how long ago that was and arrives as English prose out of lib/measured.ts, so the sentence has to read around an English fragment.',
  },
});

/**
 * The three runs drawn inside `settings.build.note`, at module scope.
 *
 * Beside the descriptor rather than inside the render, which is the shape
 * `preview/home/HomeBlock.tsx` already uses for its one tag: a component built
 * during a render is remounted on every one of them, and `react/
 * no-unstable-nested-components` says so.
 */
const MONO = 'font-mono text-[0.875em]';

const commitLink = (chunks: ReactNode[]) => (
  <a
    href={`${docsModule.repo}/commit/${docsModule.commit}`}
    target="_blank"
    rel="noreferrer noopener"
    className={cn(
      MONO,
      'text-on-canvas underline decoration-accent underline-offset-2 hover:text-on-canvas-accent',
    )}
  >
    {chunks}
  </a>
);

const code = (chunks: ReactNode[]) => <code className={MONO}>{chunks}</code>;
const day = (chunks: ReactNode[]) => <span className={MONO}>{chunks}</span>;

const MODES: {
  value: Appearance;
  label: MessageDescriptor;
  hint: MessageDescriptor;
  Icon: typeof Sun;
}[] = [
  { value: 'light', label: COPY.light, hint: COPY.lightHint, Icon: Sun },
  { value: 'dark', label: COPY.dark, hint: COPY.darkHint, Icon: Moon },
  { value: 'system', label: COPY.system, hint: COPY.systemHint, Icon: SunMoon },
];

/**
 * The three choices, and only one of them is a message.
 *
 * **A language names itself.** A person looking for German does not read "German",
 * they read "Deutsch", and that is the one convention a language picker has that no
 * other picker does. So those two labels are NOT descriptors: translating them would
 * mean a German reader sees "Englisch", which is the wrong answer to the only
 * question this control asks. Their hints are written in the language of the row
 * they belong to for the same reason, so that a reader who cannot read the other one
 * still gets a full sentence in theirs.
 *
 * **"System" has no language of its own**, so it is the one row that follows the
 * setting like everything else in this dialog. It is also the default and therefore
 * the row most readers will find selected: since 2026-09-18 an untouched browser
 * gets the language it asks for rather than English (`i18n/language.ts`), which is
 * what puts a newsroom machine on German without anybody finding this dialog first.
 *
 * Its position is first and that is deliberate: it is what is selected until
 * somebody decides otherwise, and the appearance group above puts its own default
 * last only because "light, dark, follow" is the order those three are thought in.
 * Here the three are "follow, or one of these two".
 */
type Tongue = {
  value: LanguageChoice;
  /** A descriptor for the row with no language of its own, a literal for the two that have one. */
  label: string | MessageDescriptor;
  hint: string | MessageDescriptor;
};

export const TONGUES: Tongue[] = [
  { value: 'system', label: COPY.systemLanguage, hint: COPY.systemLanguageHint },
  { value: 'en', label: 'English', hint: 'The language every string is written in' },
  { value: 'de', label: 'Deutsch', hint: 'Die Werkzeuge, nicht die Dokumente' },
];

/**
 * A row's words, whichever of the two kinds it holds.
 *
 * Takes `intl` rather than calling the hook, because it is reached from a `.map`
 * inside one component and a hook in a helper would be a rule violated for no gain.
 *
 * Exported with `TONGUES` for `test/i18n.test.ts`. Nothing in this package renders
 * this dialog — it is a Radix dialog and the tests here use `renderToStaticMarkup`,
 * which mounts no portal — so a cold review rewrote this to skip `formatMessage`
 * entirely, leaving every translated row reading "[object Object]", and 484 tests
 * stayed green.
 */
export function say(intl: IntlShape, words: string | MessageDescriptor): string {
  return typeof words === 'string' ? words : intl.formatMessage(words);
}

const SHORTCUTS: [string, MessageDescriptor][] = [
  ['⌘K', COPY.search],
  ['⌘J', COPY.panel],
  ['Esc', COPY.leaveFull],
];

const SECTION = 'text-s font-semibold uppercase tracking-wider text-on-canvas-muted';

/**
 * Settings, and the two things that are not settings but belong beside them.
 *
 * There is one setting: the appearance. It used to be three buttons in the
 * header, which put a preference next to the controls for the open view and
 * spent a tenth of a narrow header on something nobody changes twice.
 *
 * The shortcuts and the build are here rather than nowhere. A preferences dialog
 * is where people look for both, and this one would otherwise be a dialog holding
 * a single radio group.
 */
export function Settings({
  open,
  onOpenChange,
  appearance,
  onAppearance,
  language,
  onLanguage,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appearance: Appearance;
  onAppearance: (next: Appearance) => void;
  language: LanguageChoice;
  onLanguage: (next: LanguageChoice) => void;
}) {
  const intl = useWorkbenchIntl();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby="settings-lede">
        <DialogTitle className="text-headline-s font-semibold">
          {intl.formatMessage(COPY.title)}
        </DialogTitle>
        <DialogDescription id="settings-lede" className="mt-3xs text-m text-on-canvas-muted">
          {intl.formatMessage(COPY.lede)}
        </DialogDescription>

        <section className="mt-m" aria-labelledby="s-appearance">
          <h3 id="s-appearance" className={SECTION}>
            {intl.formatMessage(COPY.appearance)}
          </h3>
          {/*
            Real radios, not buttons carrying `role="radio"`. `jsx-a11y` refuses
            the second and it is right to: this is a preference, not a toolbar,
            and a native group brings arrow keys, roving focus and the label
            association with it rather than needing a keydown handler that
            re-implements all three.

            Three states rather than two, because `TROUBLESHOOTING.md` numbers
            four combinations of setting and device, and the fourth, "system"
            against a dark device, is the app's default and the one that has
            already shipped broken.
          */}
          <fieldset className="mt-xs grid gap-2xs sm:grid-cols-3">
            <legend className="sr-only">{intl.formatMessage(COPY.appearance)}</legend>
            {MODES.map((mode) => (
              <label
                key={mode.value}
                className={cn(
                  'grid cursor-pointer grid-cols-[auto_minmax(0,1fr)] items-center gap-x-xs',
                  'rounded-md border p-xs transition-colors',
                  'border-stroke text-on-canvas-muted hover:bg-surface hover:text-on-canvas',
                  'has-[:checked]:border-accent has-[:checked]:bg-surface has-[:checked]:text-on-canvas',
                  'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent',
                )}
              >
                <input
                  type="radio"
                  name="appearance"
                  value={mode.value}
                  checked={appearance === mode.value}
                  onChange={() => onAppearance(mode.value)}
                  className="sr-only"
                />
                <mode.Icon
                  aria-hidden="true"
                  className="col-start-1 row-start-1 row-span-2 size-[1rem] shrink-0 self-center"
                />
                <span className="col-start-2 row-start-1 text-m font-medium">
                  {intl.formatMessage(mode.label)}
                </span>
                <span className="col-start-2 row-start-2 text-s text-on-canvas-muted">
                  {intl.formatMessage(mode.hint)}
                </span>
              </label>
            ))}
          </fieldset>
        </section>

        <section className="mt-l" aria-labelledby="s-language">
          <h3 id="s-language" className={SECTION}>
            {intl.formatMessage(COPY.language)}
          </h3>
          {/*
            The tools, not the documents. The records, the reference and the
            repository's own Markdown stay English, because the audience that reads
            them reads English by AGENTS.md's rule. What follows this setting is what
            somebody outside development uses, which today is the home configurator
            and the controls around the frame (ADR 0050 §2).

            The heading carries both languages because it is the one control a reader
            has to find in a language they may not be reading yet. Which is a smaller
            problem than it was: the first row is "System" and it is the default, so
            a reader whose browser asks for German arrives at a German dialog and
            reaches this control to leave it rather than to arrive at it.
          */}
          <fieldset className="mt-xs grid gap-2xs sm:grid-cols-2">
            <legend className="sr-only">{intl.formatMessage(COPY.language)}</legend>
            {TONGUES.map((tongue) => (
              <label
                key={tongue.value}
                /* The row's own language, where it has one. `i18n/language.ts`'s
                   `tagOf` carries the rule and the reason. */
                lang={tagOf(tongue.value)}
                /* The default takes the whole row and the two languages share the
                   one below it. Three equal columns fit, and what they do to these
                   hints is the reason not to: they are sentences where the
                   appearance's are two words, and at a third of this dialog each
                   one wraps to three lines. */
                className={cn(
                  'grid cursor-pointer grid-cols-[auto_minmax(0,1fr)] items-center gap-x-xs',
                  tongue.value === 'system' && 'sm:col-span-2',
                  'rounded-md border p-xs transition-colors',
                  'border-stroke text-on-canvas-muted hover:bg-surface hover:text-on-canvas',
                  'has-[:checked]:border-accent has-[:checked]:bg-surface has-[:checked]:text-on-canvas',
                  'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent',
                )}
              >
                <input
                  type="radio"
                  name="language"
                  value={tongue.value}
                  checked={language === tongue.value}
                  onChange={() => onLanguage(tongue.value)}
                  className="sr-only"
                />
                <Languages
                  aria-hidden="true"
                  className="col-start-1 row-start-1 row-span-2 size-[1rem] shrink-0 self-center"
                />
                <span className="col-start-2 row-start-1 text-m font-medium">
                  {say(intl, tongue.label)}
                </span>
                <span className="col-start-2 row-start-2 text-s text-on-canvas-muted">
                  {say(intl, tongue.hint)}
                </span>
              </label>
            ))}
          </fieldset>
        </section>

        <section className="mt-l" aria-labelledby="s-keys">
          <h3 id="s-keys" className={SECTION}>
            {intl.formatMessage(COPY.keyboard)}
          </h3>
          <dl className="mt-xs space-y-3xs text-m">
            {SHORTCUTS.map(([key, what]) => (
              <div key={key} className="flex items-baseline gap-s">
                <dt className="w-[3rem] shrink-0">
                  <kbd className="rounded-s border border-stroke bg-surface px-3xs font-mono text-s">
                    {key}
                  </kbd>
                </dt>
                <dd className="min-w-0 text-on-canvas-muted">{intl.formatMessage(what)}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="mt-l" aria-labelledby="s-build">
          <h3 id="s-build" className={SECTION}>
            {intl.formatMessage(COPY.build)}
          </h3>
          {/*
            One sentence with three things drawn inside it, rather than four
            fragments concatenated around two elements. The tags are what lets a
            translator move the link and the date within the sentence: German puts
            the day somewhere else, and a sentence assembled here could not.
          */}
          <p className="mt-xs text-m leading-relaxed text-on-canvas-muted">
            {intl.formatMessage(COPY.buildNote, {
              commit: docsModule.commit.slice(0, 7),
              measured: MEASURED_ON,
              age: ageInWords(MEASURED_ON),
              commitLink,
              code,
              day,
            })}
          </p>
        </section>
      </DialogContent>
    </Dialog>
  );
}
