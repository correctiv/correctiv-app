/**
 * What it takes to mount the app's own React tree inside this site's.
 *
 * `DirectPreview.tsx` was the only surface that did it — the component gallery,
 * drawing the app's real components where a screenshot used to be — and so it
 * held these three things as private details of drawing a specimen. ADR 0045 §3
 * makes the home editor the second surface: each block of the home document is
 * drawn as the app's real component rather than named and described. Two
 * surfaces is what turns a private detail into a seam.
 *
 * The measurement below is the reason this is a file rather than a second copy.
 * `NO_INSETS` carries the five components that throw without a
 * `SafeAreaProvider`, measured on 2026-09-11; a fact of that shape has to have
 * one home, because the copy the second host makes is the one nobody re-measures
 * when a sixth component starts reaching for the insets.
 */
import { Component, useEffect, useState, type ErrorInfo, type ReactNode } from 'react';

// THE APP'S OWN ENVIRONMENT, imported rather than reproduced.
//
// `apps/mobile/src/lib/env/AppEnvironment.tsx` is what `app/_layout.tsx` wraps
// the router in, and it is what this file wraps a drawing surface in: the app's
// stylesheet, its five font files, the store, the safe area, the gesture root and
// the appearance handed to Uniwind. One definition, two hosts (ADR 0006).
//
// The workbench used to hold its own list — a `Provider` and a `SafeAreaProvider`
// and an `import '@/global.css'` — and the list was short by exactly the things
// nobody had thought of. Measured on 2026-09-11: no font file was loaded at all,
// so every drawn component read in the browser's standard face, which is a serif,
// and every bold string drew at regular weight. `test/environment.test.ts` fails
// if a second list starts here.
import { AppEnvironment } from '@/lib/env/AppEnvironment';
import type { ThemeSetting } from '@/lib/theme';

import { useWorkbenchIntl } from '../i18n/Localisation';
import { wbMessage } from '../i18n/messages';
import { storedAppearance } from '../theme';

/**
 * Everything this file says, in ENGLISH; the German that ships is
 * `src/i18n/catalogue/de/drawing.ts`.
 *
 * One line, and it is the lead of the fallback below. What follows it is
 * `error.message`, which the app's own code threw and which stays in whatever
 * words it was thrown in
 * ([ADR 0052](../../../../adr/0052-the-sites-own-words-follow-the-setting.md) §1).
 * The console line beside it is a developer's and is not a message at all.
 *
 * **`wbMessage()` and not `defineMessages`, in a file that plainly has React**,
 * which is the one place in this site where the two reasons come apart.
 * `test/environment.test.ts` forbids `react-intl` in THIS file by name, because
 * the fault it is holding off is a second `IntlProvider` here drawing every
 * specimen against a catalogue of the workbench's own. `defineMessages` is not
 * that and touches no context, but the rule is written as the import and is
 * worth more broad than exact, so this takes the other declaration rather than
 * widening it. One descriptor per call, as `src/i18n/messages.ts` says.
 */
const COPY = {
  failed: wbMessage({
    id: 'drawing.failed',
    defaultMessage: 'Did not render: {message}',
    description:
      'Stands where a component of the app should have been drawn, on a surface of this site, after that component threw. {message} is the error’s own message out of the app’s source and is not translated.',
  }),
};

/**
 * A device with no notch, stated rather than measured.
 *
 * `SafeAreaProvider` measures its own box and renders nothing until it has an
 * answer, which inside a card is a component that never appears. Handing it
 * metrics skips the measurement, and zero insets is the truth here: this is a
 * page, not a phone, and `SafeAreaView` on a page has nothing to avoid. Without
 * the provider at all, five components throw — `LoginGate`, `RecoveryScreen`,
 * `Screen`, `ScreenHeader` and `SafeAreaView` all reach `useSafeAreaInsets`,
 * which refuses rather than defaulting. Measured on 2026-09-11: those five, and
 * nothing else in the catalogue.
 */
export const NO_INSETS = {
  frame: { x: 0, y: 0, width: 393, height: 852 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

/**
 * One environment around a surface that draws the app's components.
 *
 * There are two such surfaces: the component gallery (`DirectPreview` beside
 * this file) and the home editor's list of blocks
 * (`preview/home/HomeBlock.tsx`). Each mounts one of these around the whole of
 * what it draws, and nothing inside mounts a second.
 *
 * **One per surface and not one per drawing**, which is a rule rather than a
 * preference. `AppEnvironment` mounts a redux `Provider`, an `IntlProvider`, a
 * `SafeAreaProvider` and a `GestureHandlerRootView`, and one of those per row
 * over the home document's sections is that many of each, nested that deep, for
 * one store, one catalogue and one set of insets that answer identically in
 * every copy. The gallery's own case is the same argument with more rows.
 *
 * What is inside is the app's business and what is outside is this site's, which
 * is the split `DirectPreview` already made: a stage is a page's idea and an
 * environment is an app's.
 */
export function AppHost({ children }: { children: ReactNode }) {
  return (
    <AppEnvironment appearance={useSiteAppearance()} insets={NO_INSETS}>
      {children}
    </AppEnvironment>
  );
}

/**
 * The site's appearance setting, handed to the app to apply.
 *
 * **Taken from the stored setting, not from the class on `<html>`, and that is
 * measured rather than stylistic.** Uniwind writes that class itself:
 * `setTheme('system')` resolves the device scheme once and stamps the answer back
 * on the root as an explicit `light` or `dark`. A reader of the class therefore
 * reads Uniwind's own output, mistakes it for the reader's choice, and pins the
 * site to whichever scheme the device had when the page loaded. Measured on the
 * built site on 2026-09-11, setting on System, device light, then the device
 * switched to dark while the page was open: `/components` stayed white while `/`
 * and `/architecture` went dark. The class says what is on screen; the setting
 * says what was asked for, and `'system'` is the one value where those differ.
 *
 * So `storedAppearance()` is the value and the class change is only the signal
 * that it moved — `theme.ts` writes the value in the click and the class one
 * commit later, in that order, and nothing else writes the stored one. Taken from
 * there rather than as a prop because `useAppearance`
 * is `useState` held in `App.tsx`, and a second call to it would be a second,
 * independent setting.
 *
 * Applying it is the app's business, not this file's: `AppEnvironment` hands it to
 * `useGivenAppearance`, which is the one line in the repository that calls
 * `Uniwind.setTheme`. That hook also re-resolves `'system'` when the device scheme
 * moves, which is the fourth combination in TROUBLESHOOTING.md and the one that
 * has shipped broken before.
 */
export function useSiteAppearance(): ThemeSetting {
  const [appearance, setAppearance] = useState<ThemeSetting>(storedAppearance);

  useEffect(() => {
    const observer = new MutationObserver(() => setAppearance(storedAppearance()));
    observer.observe(document.documentElement, { attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  return appearance;
}

/**
 * One drawing's failure is one drawing's failure.
 *
 * `ui/Boundary.tsx` is keyed by route and replaces the whole view; a component
 * that throws while being drawn must not take the page it is being drawn on with
 * it. Two surfaces lean on that, and each leans differently. `DirectPreview`
 * measures `NOT_DRAWN` with it: a component that lands here is one this site
 * cannot draw, and the message says why. The home editor draws every block of
 * the document inside one, so a module that throws — for a setting it cannot
 * read, or a feed that answered with something it did not expect — costs its own
 * row and leaves the rest of the day arrangeable.
 *
 * `label` is whatever the drawing is addressed by where it stands: the
 * catalogue's label in the gallery, the section's id in the editor. It is what
 * the console line carries, so it has to be the name the reader would search
 * for.
 */
export class DrawnBoundary extends Component<
  { children: ReactNode; label: string },
  { message: string | null }
> {
  state = { message: null as string | null };

  static getDerivedStateFromError(error: Error) {
    return { message: error.message };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[workbench] drawing failed', this.props.label, error, info.componentStack);
  }

  render() {
    if (this.state.message === null) return this.props.children;
    return <Failed message={this.state.message} />;
  }
}

/**
 * The fallback's one line, as a function so that it can reach a hook.
 *
 * `DrawnBoundary` is a class, because `getDerivedStateFromError` has no hook, and
 * a class cannot call `useWorkbenchIntl()`. The app's own `RecoveryScreen` has the
 * harder version of this problem and is exempted from its seam check for it: there
 * the provider is INSIDE the subtree being caught, so there is nothing to format
 * against. Here the provider is `App.tsx`'s, well above every boundary, so the
 * fallback only has to be a component to reach it.
 */
function Failed({ message }: { message: string }) {
  const intl = useWorkbenchIntl();
  return (
    <p className="text-s text-on-canvas-muted">{intl.formatMessage(COPY.failed, { message })}</p>
  );
}
