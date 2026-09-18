import { Languages, Moon, Sun, SunMoon } from 'lucide-react';

import docsModule from 'virtual:docs';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from './kit/dialog';
import { cn } from '../lib/cn';
import { MEASURED_ON } from '../../content/sources.manifest';
import { ageInWords } from '../lib/measured';
import type { Language } from '../i18n/language';
import type { Appearance } from '../theme';

const MODES: { value: Appearance; label: string; hint: string; Icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', hint: 'Always light', Icon: Sun },
  { value: 'dark', label: 'Dark', hint: 'Always dark', Icon: Moon },
  { value: 'system', label: 'System', hint: 'Follow the device', Icon: SunMoon },
];

/**
 * The two languages, named in themselves rather than in the reader's.
 *
 * A person looking for German does not read "German", they read "Deutsch". That is
 * the one convention a language picker has that no other picker does, and it is why
 * these labels are NOT message descriptors: translating them would mean a German
 * reader sees "Englisch", which is the wrong answer to the only question this
 * control asks.
 *
 * The hint beside each one is this site's prose and follows the language setting
 * like everything else.
 */
const TONGUES: { value: Language; label: string; hint: string }[] = [
  { value: 'en', label: 'English', hint: 'The language every string is written in' },
  { value: 'de', label: 'Deutsch', hint: 'Die Werkzeuge, nicht die Dokumente' },
];

const SHORTCUTS: [string, string][] = [
  ['⌘K', 'Search documents, sections and the API'],
  ['⌘J', 'The tool panel, whatever the open view puts there'],
  ['Esc', 'Leave full screen on the app view'],
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
  language: Language;
  onLanguage: (next: Language) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby="settings-lede">
        <DialogTitle className="text-headline-s font-semibold">Settings</DialogTitle>
        <DialogDescription id="settings-lede" className="mt-3xs text-m text-on-canvas-muted">
          For this browser. Nothing here is sent anywhere or shared with the app in the frame, which
          keeps its own setting.
        </DialogDescription>

        <section className="mt-m" aria-labelledby="s-appearance">
          <h3 id="s-appearance" className={SECTION}>
            Appearance
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
            <legend className="sr-only">Appearance</legend>
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
                <span className="col-start-2 row-start-1 text-m font-medium">{mode.label}</span>
                <span className="col-start-2 row-start-2 text-s text-on-canvas-muted">
                  {mode.hint}
                </span>
              </label>
            ))}
          </fieldset>
        </section>

        <section className="mt-l" aria-labelledby="s-language">
          <h3 id="s-language" className={SECTION}>
            Language · Sprache
          </h3>
          {/*
            The tools, not the documents. The records, the reference and the
            repository's own Markdown stay English, because the audience that reads
            them reads English by AGENTS.md's rule. What follows this setting is what
            somebody outside development uses, which today is the home configurator
            and the controls around the frame (ADR 0050 §2).

            The heading carries both languages because it is the one control a reader
            has to find in a language they may not be reading yet.
          */}
          <fieldset className="mt-xs grid gap-2xs sm:grid-cols-2">
            <legend className="sr-only">Language · Sprache</legend>
            {TONGUES.map((tongue) => (
              <label
                key={tongue.value}
                lang={tongue.value}
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
                <span className="col-start-2 row-start-1 text-m font-medium">{tongue.label}</span>
                <span className="col-start-2 row-start-2 text-s text-on-canvas-muted">
                  {tongue.hint}
                </span>
              </label>
            ))}
          </fieldset>
        </section>

        <section className="mt-l" aria-labelledby="s-keys">
          <h3 id="s-keys" className={SECTION}>
            Keyboard
          </h3>
          <dl className="mt-xs space-y-3xs text-m">
            {SHORTCUTS.map(([key, what]) => (
              <div key={key} className="flex items-baseline gap-s">
                <dt className="w-[3rem] shrink-0">
                  <kbd className="rounded-s border border-stroke bg-surface px-3xs font-mono text-s">
                    {key}
                  </kbd>
                </dt>
                <dd className="min-w-0 text-on-canvas-muted">{what}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="mt-l" aria-labelledby="s-build">
          <h3 id="s-build" className={SECTION}>
            This build
          </h3>
          <p className="mt-xs text-m leading-relaxed text-on-canvas-muted">
            Rendered from commit{' '}
            <a
              href={`${docsModule.repo}/commit/${docsModule.commit}`}
              target="_blank"
              rel="noreferrer noopener"
              className="font-mono text-[0.875em] text-on-canvas underline decoration-accent underline-offset-2 hover:text-on-canvas-accent"
            >
              {docsModule.commit.slice(0, 7)}
            </a>
            , and every link into the source points at that commit rather than at{' '}
            <code className="font-mono text-[0.875em]">main</code>. The source figures were measured
            by hand on <span className="font-mono text-[0.875em]">{MEASURED_ON}</span>,{' '}
            {ageInWords(MEASURED_ON)}.
          </p>
        </section>
      </DialogContent>
    </Dialog>
  );
}
