import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { ROOT } from '../plugin/collect.ts';
import { code } from './source.ts';

const WORKBENCH = join(ROOT, 'apps/workbench');
const APP = join(ROOT, 'apps/mobile');

/*
 * The site's app-drawing surface, as one text.
 *
 * It was one file — `DirectPreview.tsx` — until ADR 0045 §3 made the home editor the
 * second surface that draws the app's own components, and what the two share moved into
 * `AppHost.tsx`. Read together rather than separately, because every assertion below is
 * about the surface and not about which of its two files a line ended up in: a check
 * pointed at one of them would pass while the thing it guards had moved to the other,
 * and the `not.toMatch` guards would stop covering half of what they were written for.
 *
 * **With the prose taken out**, because a file explaining why it no longer calls
 * something has to be able to name the thing it no longer calls — and because a check
 * that reads what a file DOES must not be answered by a file that only says so. Measured
 * in a cold review: `expect(PREVIEW).toMatch(/storedAppearance\(/)` was satisfied by the
 * doc comment above the call, and replacing the call itself with a literal left it green.
 */
const PREVIEW = code(
  [
    readFileSync(join(WORKBENCH, 'src/components/AppHost.tsx'), 'utf8'),
    readFileSync(join(WORKBENCH, 'src/components/DirectPreview.tsx'), 'utf8'),
  ].join('\n'),
);

const ENVIRONMENT = readFileSync(join(APP, 'src/lib/env/AppEnvironment.tsx'), 'utf8');
const ENV_FONTS = readFileSync(join(APP, 'src/lib/env/fonts.ts'), 'utf8');
const LAYOUT = readFileSync(join(APP, 'src/app/_layout.tsx'), 'utf8');
const APP_CSS = readFileSync(join(APP, 'src/global.css'), 'utf8');

/**
 * One environment, two hosts, and the checks that keep it from becoming two.
 *
 * The workbench draws the app's components in its own React DOM tree, so it has
 * to put around them whatever the app puts around them. It did that with a list
 * of its own for one change, and the list was short by exactly the things nobody
 * had thought of: no font file was loaded, so all 45 components drew in the
 * browser's standard face — a serif — and every bold string drew at regular
 * weight, because this app names one loaded family per cut. A drifting copy is
 * the failure mode, so what is asserted here is that there is no copy.
 *
 * Read as text rather than rendered, which is the same choice `direct.test.ts`
 * and `shell.test.ts` make and for the same reason: rendering a specimen to ask
 * which providers are above it would need `react-native-web`, a DOM and the
 * app's whole toolchain to answer a question about imports.
 */
describe('the app’s environment, borrowed rather than reproduced', () => {
  it('wraps every specimen in the app’s own environment', () => {
    expect(PREVIEW).toMatch(/from '@\/lib\/env\/AppEnvironment'/);
    expect(PREVIEW).toMatch(/<AppEnvironment /);
  });

  it('keeps no list of providers of its own', () => {
    // Each of these was in this file, and each is now the app's answer rather
    // than a second one. A host that needs something new from the environment
    // adds it to the environment, where the app gets it too.
    expect(code(PREVIEW)).not.toMatch(/from 'react-redux'/);
    expect(code(PREVIEW)).not.toMatch(/from 'react-native-safe-area-context'/);
    expect(code(PREVIEW)).not.toMatch(/Uniwind\.setTheme/);
    expect(code(PREVIEW)).not.toMatch(/import '@\/global\.css'/);
    // Never this one either: a second `IntlProvider` here would draw specimens
    // against a catalogue of the workbench's own, and the first missing German
    // string would look like the app's bug rather than this file's.
    expect(code(PREVIEW)).not.toMatch(/from 'react-intl'/);
  });

  it('is the same environment the app itself starts in', () => {
    // Without this the component could quietly become the workbench's own shell
    // that merely lives in `apps/mobile`, which is the copy one directory over.
    expect(LAYOUT).toMatch(/from '@\/lib\/env\/AppEnvironment'/);
    expect(LAYOUT).toMatch(/<AppEnvironment>/);
  });

  it('supplies the whole environment from one place', () => {
    // The six things a component of this app needs before it draws correctly.
    // Written out because each one was found by a component failing without it —
    // the language last, where a component calling `formatMessage` throws outright
    // (ADR 0026 §6).
    expect(ENVIRONMENT).toMatch(/import '@\/global\.css'/);
    expect(ENVIRONMENT).toMatch(/useAppFonts\(\)/);
    expect(ENVIRONMENT).toMatch(/<Provider store=\{coreStore\}>/);
    expect(ENVIRONMENT).toMatch(/<SafeAreaProvider initialMetrics=\{insets\}>/);
    expect(ENVIRONMENT).toMatch(/<GestureHandlerRootView/);
    expect(ENVIRONMENT).toMatch(/<Localisation>/);
    // And the workbench has to ask for the safe area, because it is the host with
    // no router to measure one. Zero, because a page has no notch.
    expect(PREVIEW).toMatch(/insets=\{NO_INSETS\}/);
  });

  it('hands an appearance to Uniwind from exactly one place in the repository', () => {
    // The trap ADR 0027 records and ADR 0008 records the NativeWind version of. A
    // `.dark` class on `<html>` moves the CSS variables and leaves
    // `useUniwind().theme` at light, so every colour a component reads in
    // TypeScript — `useColors()`, and therefore every `<Typo>` — stays on the
    // light value over a dark ground. Measured: `canvas` at `#1a1a1a` under text
    // at `#333`. Nothing about the page looks broken to a build.
    //
    // The workbench READS its own setting off `<html>` and the app APPLIES it, so
    // the site's control and the app's setting reach Uniwind through one line.
    const appearance = readFileSync(join(APP, 'src/lib/theme/appearance.ts'), 'utf8');
    expect(appearance).toMatch(/export function useGivenAppearance\(setting: ThemeSetting\)/);
    expect(PREVIEW).toMatch(/appearance=\{useSiteAppearance\(\)\}/);
  });

  it('loads the font files the app loads, and names no family of its own', () => {
    // "Load the same files from the same source, do not transcribe a second list
    // of font names." `lib/theme/font-assets.ts` is that source and this is its
    // only importer besides nothing; a family name spelled in the workbench would
    // be a list that goes stale the day a cut is added.
    expect(ENV_FONTS).toMatch(/from '@\/lib\/theme\/font-assets'/);
    expect(ENV_FONTS).toMatch(/useFonts\(fontAssets\)/);
    for (const source of [PREVIEW, readFileSync(join(WORKBENCH, 'src/styles/app.css'), 'utf8')]) {
      expect(source).not.toMatch(/Merriweather|SourceSans3/);
    }
  });
});

/**
 * Where the app's class names are written, said in the app's own stylesheet.
 *
 * Tailwind generates a utility only where it has seen the name, and what it
 * scans by default is the BUNDLER's project rather than the stylesheet's. Metro's
 * project is `apps/mobile`, so the app was always right; the workbench's Vite root
 * is `apps/workbench`, so it compiled this same stylesheet against the wrong tree
 * and emitted only the utilities it happened to write itself.
 *
 * Measured on 2026-09-11 against the assembled site: dozens of the app's classes
 * were missing. `flex-row` was one, so every row in every drawn component stood on
 * end as a column; `bg-always-dark` was another, so `home/CalloutTeaser` and
 * `media/LiveBanner` were white text on no ground at all. Both builds were green
 * and the page rendered.
 *
 * The count is not asserted and the two names above no longer reproduce it, which
 * is the same fact twice: Tailwind scans this file as source, so naming a class in
 * a comment generates it. `apps/mobile/src/global.css` carries the long version.
 * What is asserted is the line, which is the thing that can go missing.
 */
describe('the app’s stylesheet', () => {
  it('declares the tree its own class names are written in', () => {
    expect(APP_CSS).toMatch(/@source '\.\/'/);
  });
});
