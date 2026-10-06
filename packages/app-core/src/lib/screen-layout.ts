/**
 * Which screens have an arrangement the newsroom edits, and where each one's document is.
 *
 * [ADR 0054](../../../../adr/0054-a-block-declares-where-it-may-appear.md) §5 left the
 * parser half open while one screen existed. A screen's document is now keyed by this id,
 * and `parseHomeLayout` takes the screen it is reading. Moments, conditions and audiences
 * (ADR 0039, ADR 0060) are part of the document's grammar, so they apply to every screen.
 *
 * **Which blocks a screen takes is no longer a question about the screen**: every screen
 * takes every block (ADR 0073 §1), bar the four that print another screen's title. That
 * is `block-category.ts` beside this file.
 *
 * **And the three words beside the sections.**
 * [ADR 0075](../../../../adr/0075-a-document-carries-its-own-words-and-a-screen-says-what-it-is-called.md)
 * §3 gives a screen's document its own `title`, `tabLabel` and `icon`, and §2 makes the
 * title the one word a document may not leave out. They are read here rather than by
 * whoever draws them, because a screen's name is a fact about the screen and belongs to
 * the grammar of every screen alike — the same reason the arrangement is parsed here and
 * not in the workbench.
 */

import entdeckenDocument from '../data/layout/screens/entdecken.json';
import mitmachenDocument from '../data/layout/screens/mitmachen.json';
import homeDocument from '../data/layout/screens/home.json';
import profilDocument from '../data/layout/screens/profil.json';
import mediathekDocument from '../data/layout/screens/mediathek.json';
import { isCustomScreenId, type ConfigurableScreen } from './screen-id';
import { SCREEN_ICONS } from './block-catalogue.generated';
import {
  faultOf,
  inLanguageOrder,
  type LocalisedText,
  type SettingFault,
  type TextSetting,
} from './home-settings';

/** The bundled document of each screen, as written. */
export const SCREEN_DOCUMENTS = {
  home: homeDocument,
  entdecken: entdeckenDocument,
  mediathek: mediathekDocument,
  mitmachen: mitmachenDocument,
  profil: profilDocument,
} satisfies Record<ConfigurableScreen, unknown>;

/** The version of the envelope the deploy joins the screens into. Not a screen's `version`. */
export const SCREEN_LAYOUTS_VERSION = 1;

/**
 * The published document: every screen's file under its screen id, and the navigation
 * beside them, joined and nothing else (ADR 0071 §1, §6). An app that does not know a key
 * beside `screens` ignores it.
 */
export function joinScreenDocuments(
  documents: Record<string, unknown>,
  navigation?: unknown,
): {
  version: number;
  screens: Record<string, unknown>;
  navigation?: unknown;
} {
  return navigation === undefined
    ? { version: SCREEN_LAYOUTS_VERSION, screens: documents }
    : { version: SCREEN_LAYOUTS_VERSION, screens: documents, navigation };
}

/** The navigation out of a fetched joined document, or `undefined` when it carries none. */
export function navigationDocumentOf(body: unknown): unknown {
  if (typeof body !== 'object' || body === null) return undefined;
  return Object.hasOwn(body, 'navigation')
    ? (body as { navigation: unknown }).navigation
    : undefined;
}

/**
 * One screen's document out of a fetched joined one, or `undefined` when the body is not
 * a joined document or does not carry that screen. Only the screens the caller asks for
 * are read, so one this app does not know is ignored without being named.
 *
 * Takes any id and not only the declared ones: a custom screen (ADR 0075 §7) is asked for
 * by the id the route carries, and `Object.hasOwn` keeps `constructor` from being one.
 */
export function screenDocumentOf(body: unknown, screen: string): unknown {
  if (typeof body !== 'object' || body === null) return undefined;
  const screens = (body as { screens?: unknown }).screens;
  if (typeof screens !== 'object' || screens === null || Array.isArray(screens)) return undefined;
  return Object.hasOwn(screens, screen) ? (screens as Record<string, unknown>)[screen] : undefined;
}

// --- screens the newsroom makes -----------------------------------------------------

export {
  CONFIGURABLE_SCREENS,
  CUSTOM_SCREEN_ID_MAX_LENGTH,
  customScreenIdFault,
  isCustomScreenId,
  isDeclaredScreen,
  type ConfigurableScreen,
  type CustomScreenIdFault,
  type ScreenId,
} from './screen-id';

/**
 * The custom screens a fetched joined document carries, in the order it writes them.
 *
 * A key that is not a valid id is skipped without being named, which is what the host does
 * with a screen it was not asked for: the id would be a route nobody can reach (§7), so
 * there is nothing smaller to lose. A body that is not a joined document has none.
 */
export function customScreenIdsOf(body: unknown): string[] {
  if (typeof body !== 'object' || body === null) return [];
  const screens = (body as { screens?: unknown }).screens;
  if (typeof screens !== 'object' || screens === null || Array.isArray(screens)) return [];
  return Object.keys(screens).filter(isCustomScreenId);
}

// --- the words a screen is called by ----------------------------------------------

/**
 * One icon in the three vocabularies the app draws it in.
 *
 * Plain strings, where the app's own declaration holds the platforms' types: the core
 * knows no platform ([ADR 0006](../../../../adr/0006-one-core-two-hosts.md)),
 * so the names cannot be its type either, and a name that does not exist on one platform
 * is a compile error beside the block that draws it rather than a blank tab on a phone
 * (`apps/mobile/src/lib/screenIcons.ts`).
 */
export interface ScreenIcon {
  readonly sf: { readonly default: string; readonly selected: string };
  readonly md: { readonly default: string; readonly selected: string };
  readonly ionicon: { readonly active: string; readonly inactive: string };
}

/**
 * The icons a screen may be given, carried here by the generator the settings travel by.
 *
 * ADR 0075 §4: the app declares the set, the document names a key out of it, and the core
 * has to know which keys exist to tell a newsroom that the one they wrote is not one —
 * an icon is the one place where a wrong answer reaches a reader as a blank rather than as
 * a problem. Re-exported from the artefact beside the block catalogue, because one
 * generator writes both and one drift check (`__tests__/home-settings.test.ts`) fails when
 * it is not run.
 */
export { SCREEN_ICONS };

/**
 * How a screen document names an icon. `string` and not a union of the declared keys,
 * because the keys arrive as data: a document is somebody else's file, so the one thing
 * this may not do is refuse a value it cannot have heard of at compile time.
 */
export type ScreenIconKey = string;

/**
 * The icon a screen draws when its document names none, or names one this build does not
 * know.
 *
 * ADR 0075 §4 makes an unknown key the smallest possible loss rather than a refusal, and
 * this is what the loss is drawn with. It is a key like any other — the app declares it
 * beside the others — and `apps/mobile/__tests__/home-settings.test.ts` holds the two
 * together, because a fallback that is not in the set is an icon nothing can draw.
 */
export const SCREEN_ICON_FALLBACK: ScreenIconKey = 'default';

/**
 * What a screen is called, and what its bar shows.
 *
 * ADR 0075 §3: three properties of the screen itself rather than settings of a block,
 * because a screen with two headers would then have two names and the "Mehr" list has no
 * header to read at all.
 */
export interface ScreenWords {
  /** The one word a document may not leave out (§2). Never absent here. */
  readonly title: LocalisedText;
  /**
   * What the tab is called, when that is not the title.
   *
   * Absent rather than null, and absent in every bundled document: ADR 0075 §3 has it
   * default to the title so that nobody types the word twice, which is the same lesson
   * ADR 0054 §5 drew for the list of screens.
   */
  readonly tabLabel?: LocalisedText;
  /**
   * The icon, as a key out of {@link SCREEN_ICONS}. Absent when the document names none
   * and when it names one this build does not know — the second is reported (§4) and the
   * screen draws {@link SCREEN_ICON_FALLBACK} rather than nothing.
   */
  readonly icon?: ScreenIconKey;
}

/**
 * What could not be read out of a screen's words, one entry per fault.
 *
 * The shape `parseHomeLayout` has always reported in (`LayoutProblem`), and its own
 * vocabulary rather than that one's: the codes here name the three properties of ADR 0075
 * §3, and a caller reading a screen's words asks about a word rather than about a
 * section. `home-layout.ts` adds them to its own list.
 */
export type ScreenProblemCode =
  | 'screen-not-an-object'
  | 'title-invalid'
  | 'title-language-unknown'
  | 'title-german-missing'
  | 'title-too-long'
  | 'title-control-character'
  | 'title-line-break'
  | 'tab-label-invalid'
  | 'tab-label-language-unknown'
  | 'tab-label-german-missing'
  | 'tab-label-too-long'
  | 'tab-label-control-character'
  | 'tab-label-line-break'
  | 'icon-invalid'
  | 'icon-unknown';

export interface ScreenProblem {
  readonly code: ScreenProblemCode;
  readonly context: Record<string, string | number | boolean | null>;
}

export interface ScreenWordsParse {
  /** Null when the title was refused — the one fault that costs the screen its name. */
  readonly words: ScreenWords | null;
  readonly problems: readonly ScreenProblem[];
}

/**
 * The two bounds, declared here rather than in the app, and for the reason ADR 0075 §1
 * gives the settings': a default that lives with the thing it bounds is one thing to keep
 * true, and the declaration file the generator imports may name no value of its own.
 *
 * **A title is a line, a tab label is a word.** ADR 0075 §3 says exactly that — a tab has
 * room for one short word and a heading may want more — and it is why the two numbers
 * differ at all. 80 characters is a heading line in German or English; 24 is a tab bar
 * with the longest compound word the three platforms put on one.
 */
export const SCREEN_TITLE_SPEC: TextSetting = {
  key: 'title',
  kind: 'text',
  maxChars: 80,
  fallback: null,
};

const TAB_LABEL_SPEC: TextSetting = {
  key: 'tabLabel',
  kind: 'text',
  maxChars: 24,
  fallback: null,
};

/**
 * The code each fault of a word is reported under, one table per word.
 *
 * Same split as `home-layout.ts`'s own: `faultOf` in `home-settings.ts` owns what may be
 * in a word, this file owns which of the three properties of ADR 0075 §3 it was found in.
 * Both tables are total over `SettingFault`, so a sixth rule in ADR 0075 §1 is a compile
 * error here rather than a word refused under a code nobody has a message for.
 */
const TITLE_FAULT_CODES: Readonly<Record<SettingFault, ScreenProblemCode>> = {
  invalid: 'title-invalid',
  'text-language-unknown': 'title-language-unknown',
  'text-german-missing': 'title-german-missing',
  'text-too-long': 'title-too-long',
  'text-control-character': 'title-control-character',
  'text-line-break': 'title-line-break',
};

const TAB_LABEL_FAULT_CODES: Readonly<Record<SettingFault, ScreenProblemCode>> = {
  invalid: 'tab-label-invalid',
  'text-language-unknown': 'tab-label-language-unknown',
  'text-german-missing': 'tab-label-german-missing',
  'text-too-long': 'tab-label-too-long',
  'text-control-character': 'tab-label-control-character',
  'text-line-break': 'tab-label-line-break',
};

/**
 * A key holding a control character, a line break among them.
 *
 * `home-layout.ts` has the same class for the same reason: a report carries where, never
 * the value, because the value is the payload. An icon key is the newsroom's own word, and
 * one with a line break in it is somebody smuggling text into a log line.
 */
// oxlint-disable-next-line no-control-regex -- matching control characters is the point
const UNSAFE_KEY = /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** What a value IS, for a report, without pasting the value itself into one. */
function typeOf(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

/**
 * One word, against the bound declared for it, or null with a problem pushed.
 *
 * A word that is absent is a fault here rather than a `undefined` out: ADR 0075 §2 makes
 * the title the one word a document may not leave out, and `tabLabel` is only read when
 * the document wrote one. So the same function judges both, and the difference between
 * "absent" and "refused" is made by the caller asking at all.
 */
function readWord(
  raw: unknown,
  spec: TextSetting,
  codes: Readonly<Record<SettingFault, ScreenProblemCode>>,
  problems: ScreenProblem[],
): LocalisedText | null {
  const fault = faultOf(spec, raw);
  if (fault) {
    problems.push({ code: codes[fault], context: { type: typeOf(raw) } });
    return null;
  }
  return inLanguageOrder(raw as Readonly<Record<string, string>>);
}

/**
 * The icon a document names, or undefined with a problem pushed.
 *
 * `Object.hasOwn` rather than a lookup, so a document naming `constructor` is the unknown
 * key it is instead of a prototype's member typed as an icon. The context carries the key
 * — that is the whole of what a newsroom needs to fix it — unless the key is one whose
 * value is the payload, which is what `UNSAFE_KEY` decides and what `home-layout.ts` does
 * with an id.
 */
function readIcon(raw: unknown, problems: ScreenProblem[]): ScreenIconKey | undefined {
  if (raw === undefined) return undefined;
  if (typeof raw !== 'string') {
    problems.push({ code: 'icon-invalid', context: { type: typeOf(raw) } });
    return undefined;
  }
  if (!Object.hasOwn(SCREEN_ICONS, raw)) {
    problems.push({
      code: 'icon-unknown',
      context: { icon: UNSAFE_KEY.test(raw) ? null : raw },
    });
    return undefined;
  }
  return raw;
}

/**
 * Read the three words out of one screen's document, and say what could not be read.
 *
 * **The title is the one fault that costs the whole screen its name** (ADR 0075 §2, and
 * the one exception to "an error costs the smallest possible thing", ADR 0039 §6): a
 * screen with no name is a bar with no word on it, and there is nothing smaller to lose.
 * That is why `words` is `null` rather than a `ScreenWords` with a hole in it, and it is
 * why every OTHER fault here — a `tabLabel` that is not a word, an icon this build does
 * not know — costs only itself and is reported beside the arrangement being read.
 *
 * All three are read before anything is refused, so a document with three faults produces
 * three reports and one pass over a newsroom's file rather than three.
 *
 * `parseHomeLayout` is deliberately not as strict (it keeps a document whose title was
 * refused and reports it), because it reads a layout somebody else fetched and ADR 0036
 * §7 wants what it can make sense of drawn; the strictness is here and in the two scripts
 * that judge a document before it is published.
 */
export function parseScreenDocument(input: unknown): ScreenWordsParse {
  const problems: ScreenProblem[] = [];

  if (!isRecord(input)) {
    problems.push({
      code: 'screen-not-an-object',
      context: { type: typeOf(input) },
    });
    return { words: null, problems };
  }

  const title = readWord(input.title, SCREEN_TITLE_SPEC, TITLE_FAULT_CODES, problems);
  const tabLabel =
    input.tabLabel === undefined
      ? undefined
      : (readWord(input.tabLabel, TAB_LABEL_SPEC, TAB_LABEL_FAULT_CODES, problems) ?? undefined);
  const icon = readIcon(input.icon, problems);

  if (title === null) return { words: null, problems };

  return {
    words: {
      title,
      ...(tabLabel === undefined ? {} : { tabLabel }),
      ...(icon === undefined ? {} : { icon }),
    },
    problems,
  };
}

/** What the screen is called, or null when its document's title was refused. */
export function screenTitleOf(words: ScreenWords | null): LocalisedText | null {
  return words?.title ?? null;
}

/**
 * What its tab is called: the tab label the document writes, or the title.
 *
 * ADR 0075 §3's default, as a function rather than as a value written into the parsed
 * document, so that a document naming no label and one naming its title are the same
 * thing to every reader — which is the whole reason the field exists.
 */
export function screenTabLabelOf(words: ScreenWords | null): LocalisedText | null {
  return words === null ? null : (words.tabLabel ?? words.title);
}

/**
 * The icon a screen draws: the one its document names, or the fallback.
 *
 * Null rather than a throw when the app declares no fallback at all, which is a build this
 * repository refuses (`__tests__/home-settings.test.ts`) and a host that would rather draw
 * nothing than stop. The hasOwn is `readIcon`'s reason again: this is public and takes a
 * `ScreenWords` somebody may have built by hand.
 */
export function screenIconOf(words: ScreenWords | null): ScreenIcon | null {
  const named = words?.icon;
  if (named !== undefined && Object.hasOwn(SCREEN_ICONS, named)) return SCREEN_ICONS[named];
  return SCREEN_ICONS[SCREEN_ICON_FALLBACK] ?? null;
}
