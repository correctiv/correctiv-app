// The desktop entry point.
//
// ## The ordering constraint, which is the whole content of this file
//
// Three things have to happen and two of them cannot happen at module scope:
//
//   1. `registerBuiltinWidgets()` — the GTK widget table the reconciler resolves tags
//      against. Pure data, safe at import.
//   2. `configureStyle({ tokens, sheet })` — must run BEFORE the first styled element
//      renders, because the class compiler resolves `bg-grey-100` against the token
//      scale when it MINTS the class. Configure it late and every class already minted
//      resolved against `MINIMAL_TOKENS`.
//   3. `registerRootComponent` — builds the `Adw.ApplicationWindow` and renders into it.
//
// Step 2 cannot go above step 3, and finding that out is the reason this file has a
// comment instead of three lines. `StyleSheet` constructs a `Gtk.CssProvider` and
// installs it on the DEFAULT `Gdk.Display`, and `Adw.StyleManager.get_default()` wants
// the same display — neither exists until `Gtk.init()`, which `AppRegistry` calls
// inside the application's `activate`. Doing it at module scope aborts the process
// before any of it: `Gdk-ERROR **: gdk_display_manager_get() was called before
// gtk_init()`, SIGABRT and a core dump, measured.
//
// So it happens at the top of the root component's first render, which
// `AppRegistry.runApplication` reaches only after the window exists — and still before
// any child of it has rendered a single class.
//
// ## The palette is chosen once, here
//
// `Adw.StyleManager:dark` is what the user is actually looking at, as opposed to
// `color-scheme`, which is what the application asked for. Reading it picks one of the
// two generated token scales, so `bg-grey-100` is a white page surface in light and
// `#1a1a1a` in dark — the same two palettes the phone and the web target use, from the
// same generated file.
//
// It is read ONCE per launch, and that is this host's one real divergence from the
// phone, where the same setting flips both halves live. `configureStyle` installs a
// module-level scale and the sheet mints a class per declaration set, so
// re-configuring mid-session would change what NEW classes resolve to while every
// widget already on screen kept the class it was given — half the window in each
// scheme. Adwaita's own chrome still follows the setting immediately (see
// `shims/uniwind.ts`); the app's token colours need a restart. Named here, in that
// shim, and in README.md.

// Version-pinned, like every other `gi://` import in this tree — and it replaces an
// `imports.gi.Adw` that resolved UNVERSIONED. On GJS that read the one Adw the process
// had; through `@gjsify/node-gi`'s `imports` proxy it became `requireGi('Adw',
// undefined)`, an unversioned namespace resolution, which is the hazard the WebView
// shim's own header spells out in capitals for WebKit. Importing the module here is
// safe; only the display-dependent READ below must stay inside its guard.
import Adw from 'gi://Adw?version=1';
import Gdk from 'gi://Gdk?version=4.0';
import GLib from 'gi://GLib?version=2.0';
import Gtk from 'gi://Gtk?version=4.0';

import { registerBuiltinWidgets } from '@gjsify/gtk-host';
import { initFonts } from '@gjsify/gtk-host/fonts';
import { configureStyle, registerRootComponent } from '@gjsify/react-native';
import { RouterRoot } from '@gjsify/react-native/router';
import { manifest } from 'virtual:gjsify-rn-routes';

import { armScreenshot } from './debug/screenshot.js';
import { tokensFor } from './generated/tokens.generated.js';
import { installMediaControlsOnce } from './media/install.js';
import { persistedAppearance } from './platform/storage.js';
import { alignFamilies } from './style/font-map.js';
import { sheet } from './style/sheet.js';

registerBuiltinWidgets();

let styleConfigured = false;

/**
 * Idempotent, and guarded rather than left to run per render: `configureStyle` would
 * happily re-assign the same scale every time, but re-reading `Adw.StyleManager` on
 * every render of the root is work with no answer that can change (see above).
 */
function configureStyleOnce(): void {
  if (styleConfigured) return;
  styleConfigured = true;
  // The READ stays here, not at module scope: `StyleManager.get_default()` needs a
  // `Gdk.Display`, which does not exist until `Gtk.init()` has run inside `activate`.
  // Hoisting it is the measured `gdk_display_manager_get() was called before
  // gtk_init()` abort, and the import above is deliberately separate so that the guard
  // is the only thing anyone has to preserve.
  const manager = Adw.StyleManager.get_default();

  // APPLY THE USER'S PREFERENCE FIRST, then read what it produced.
  //
  // `StyleManager:dark` answers "what is on screen", and at this point that is still
  // the SYSTEM scheme: the app's own preference lives in a Redux slice that hydrates
  // asynchronously, and `useAppearance()` applies it to `color-scheme` several frames
  // later — by which time this palette has been minted and every class stamped from it.
  // A user whose preference differs from the system therefore got Adwaita's chrome in
  // one scheme and the app's own token colours in the other, from the first frame, with
  // no way back short of changing the system to match. README named only the
  // MID-SESSION switch as a limitation; this was wrong at startup, with nothing
  // switched at all.
  //
  // Reading the preference straight out of the settings file is the narrow fix: it is
  // the same value `useAppearance()` goes on to apply, so that later call becomes a
  // no-op rather than a second opinion, and both halves agree from the first frame.
  const preference = persistedAppearance();
  if (preference === 'light') manager.colorScheme = Adw.ColorScheme.FORCE_LIGHT;
  else if (preference === 'dark') manager.colorScheme = Adw.ColorScheme.FORCE_DARK;

  configureStyle({ tokens: tokensFor(manager.dark), sheet: sheet() });
  installBrandAccent(manager.dark);
}

/**
 * Give libadwaita the BRAND accent, so its own widgets are CORRECTIV red.
 *
 * Without this the mini player's play button is Adwaita's `.suggested-action` blue two
 * rows under a brand-red LIVE banner. `Adw.AccentColor` is an enum of nine named
 * colours and cannot carry a brand — but it is only how an app READS the system's
 * choice. The accent reaches widgets as CSS, so an app can define it.
 *
 * ## Only the BACKGROUND accent, and that is the whole design
 *
 * libadwaita keeps two: `--accent-bg-color`, which a `.suggested-action` button is
 * painted with, and the standalone `--accent-color`, which accent-coloured TEXT uses
 * and which has to stay legible on the window. Setting both is the obvious move and is
 * WRONG — it would have shipped an accessibility regression. MEASURED with
 * `debug/accent-probe.ts`, giving it only `--accent-bg-color: #ff5c5c` and reading a
 * resolved standalone accent:
 *
 *     dark scheme    1.231 0.570 0.551   lightened, for a dark window
 *     light scheme   0.730 0.033 0.138   darkened, for a light one
 *
 * Adwaita derives it per scheme and does the contrast work in both directions. Setting
 * `--accent-color` to the app's own token instead pins one value — the same red the
 * app draws accent TEXT in — and in light mode that is a pale red on white.
 *
 * `--accent-fg-color` is left alone too, but for a weaker reason, said plainly: the
 * on-accent foreground read white both before and after in every measurement, so it
 * did not need setting for THIS colour. Whether Adwaita would flip it to black for a
 * pale accent is not measured here.
 *
 * ## A second provider, which the sheet's own docblock argues against
 *
 * `style/sheet.ts` keeps one provider so that a minted class cannot be shadowed by a
 * rule at another priority. That argument is about CLASSES, and `StyleSheet` exposes
 * only `classFor(declarations)` — there is no API for a rule with a `:root` selector.
 * The two providers therefore touch disjoint selectors and cannot shadow each other;
 * what it costs is a second entry in the GTK inspector.
 *
 * ## Per scheme, from the app's own scale
 *
 * The accent token differs between the two — `rgb(255 80 100)` light, `rgb(255 97 115)`
 * dark — so this reads the same scale every class in the app resolves against rather
 * than hard-coding a hex. It runs after the preference has been applied and `dark`
 * read, so it agrees with the palette by construction; like that read, it is once per
 * launch and needs the restart the header describes.
 */
function installBrandAccent(dark: boolean): void {
  const accent = tokensFor(dark).colors?.accent;
  if (typeof accent !== 'string' || accent === '') {
    console.warn(
      '[desktop] accent: the token scale has no `accent`, so Adwaita keeps the system colour.',
    );
    return;
  }
  const display = Gdk.Display.get_default();
  if (display === null) {
    // Unreachable from here — the caller has already used `Adw.StyleManager` — and
    // reported rather than thrown, because losing the accent is not worth a launch.
    console.warn('[desktop] accent: no Gdk.Display, so Adwaita keeps the system colour.');
    return;
  }
  const provider = new Gtk.CssProvider();
  provider.load_from_string(`:root { --accent-bg-color: ${accent}; }`);
  // NO GC ROOT KEPT, and the linter is what settled that. A module-level variable
  // holding the provider is written and never read, which `no-unused-vars` calls out
  // as exactly what it is — and it was insurance against a hazard that does not exist:
  // `add_provider_for_display` takes a reference on the C side, so the provider
  // outlives its JS wrapper whatever GJS does with it.
  Gtk.StyleContext.add_provider_for_display(
    display,
    provider,
    Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION,
  );
}

let fontsRegistered = false;

/**
 * Put the two brand faces on the font map, and say what happened.
 *
 * The faces are staged into `data/fonts/` by `scripts/stage-fonts.mjs` and declared
 * to `gjsify ship` as `gjsify.ship.fonts`; the launcher exports `GJSIFY_FONT_DIR` at
 * wherever that directory ended up, because only the launcher knows whether the
 * payload became `/usr`, a `Contents/Resources` or `C:\Program Files`. `initFonts()`
 * reads that variable itself. `scripts/start.mjs` sets it for a dev run so the two
 * paths do not diverge.
 *
 * ## Why this LOGS instead of asserting
 *
 * The outcome is legitimately different on each platform, and only one of the three
 * shapes is a defect:
 *
 *   * **registered** — a fontconfig-backed Pango took the faces. Linux, and Windows.
 *   * **declined** — `pango_font_map_add_font_file()` is a vfunc and the CoreText map
 *     implements none, so macOS answers `G_IO_ERROR_NOT_SUPPORTED`. That is not a
 *     failure: a `.app` carries `ATSApplicationFontsPath`, so the OS activated the
 *     staged directory before this process started and the faces are already there.
 *     The corollary is worth knowing while developing: running the bundle directly on
 *     macOS, outside a `.app`, has no brand typeface and cannot have one.
 *   * **failed** — a face the map refused for any other reason. This one is ours.
 *
 * An assertion would have to encode all three, and would then be wrong on the next
 * platform. Pango's own failure mode is the reason there is any output at all: it does
 * not report a missing family, so `set_family('Merriweather')` against a map that
 * never got the file resolves to the default sans and nothing anywhere says a word.
 */
function registerFontsOnce(): void {
  if (fontsRegistered) return;
  fontsRegistered = true;
  const result = initFonts();
  if (result.dir === undefined) {
    console.warn(
      '[desktop] fonts: GJSIFY_FONT_DIR is not set, so no brand face was registered. ' +
        'Pango will substitute the system UI font in the chrome.',
    );
    return;
  }
  const parts = [`${result.registered.length} registered`];
  if (result.declined.length > 0) {
    parts.push(`${result.declined.length} declined by the font map (expected on macOS)`);
  }
  if (result.failed.length > 0) parts.push(`${result.failed.length} FAILED`);
  console.log(`[desktop] fonts: ${result.dir} — ${parts.join(', ')}.`);
  for (const failure of result.failed) {
    console.warn(`[desktop] fonts: ${failure.path}: ${failure.message}`);
  }

  // And then ask the MAP, because the registration count is not the thing that matters.
  // Measured on Windows: five faces reported registered, and `Merriweather` was not on
  // the map under that name — it is `Merriweather 18pt` there and `Merriweather` on
  // Linux, from the same bytes. `alignFamilies()` reconciles the two and `missing` is
  // what Pango will substitute silently, so it is a warning rather than a count.
  const families = alignFamilies();
  const found = [
    ...families.exact,
    ...families.aliased.map(([declared, actual]) => `${declared} as "${actual}"`),
  ];
  console.log(
    `[desktop] fonts: ${families.onMap} families on the map; this app has ${found.join(', ') || 'none of its own'}.`,
  );
  for (const family of families.missing) {
    console.warn(
      `[desktop] fonts: "${family}" is on no font map under any name this recognises. ` +
        'Pango will substitute it without saying so.',
    );
  }
}

function App() {
  // Before the style, and before anything renders: a family Pango does not know is
  // substituted at DRAW time with no diagnostic.
  registerFontsOnce();
  configureStyleOnce();
  // Opt-in and env-gated; a no-op unless CORRECTIV_DESKTOP_SCREENSHOT names a path.
  armScreenshot();
  // MPRIS, so the shell's media controls see what is playing. Here rather than in a
  // screen because audio outlives the screen that started it, and a no-op where there
  // is no session bus — which is macOS and Windows.
  installMediaControlsOnce();
  return <RouterRoot manifest={manifest} />;
}

/**
 * `CORRECTIV_DESKTOP_SIZE=420x800` opens the window at that size instead of the default,
 * so a capture can show a narrow and a wide layout from the same bundle. A development
 * aid beside the screenshot variables: anything that does not parse is the default.
 */
function requestedSize(): { width: number; height: number } {
  const match = /^(\d+)x(\d+)$/.exec(GLib.getenv('CORRECTIV_DESKTOP_SIZE') ?? '');
  return match === null
    ? { width: 1100, height: 820 }
    : { width: Number(match[1]), height: Number(match[2]) };
}
const size = requestedSize();

await registerRootComponent(App, {
  // Experimental by name. This build is a feasibility demonstration and must not be
  // mistaken for a shipped CORRECTIV application by a desktop that indexes it —
  // `.desktop` files, the shell's app grid and D-Bus activation all key off this.
  applicationId: 'org.correctiv.AppDesktopExperimental',
  title: 'CORRECTIV (Desktop, experimentell)',
  // `defaultWidth`/`defaultHeight`, not `width`/`height`. The wrong names were
  // accepted by JavaScript and ignored, and the window stayed at the documented
  // 900x700 default — which is exactly the kind of silently-dropped option that a
  // typecheck catches and a screenshot does not.
  defaultWidth: size.width,
  defaultHeight: size.height,
});
