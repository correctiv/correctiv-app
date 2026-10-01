/**
 * Reads a submission issue back, checks it and, for the home kind, turns it into the one
 * file it changes. The strings kind is `./submission-strings.ts`, and the table of kinds
 * that joins the two is `./submission-kinds.ts`.
 *
 * The workflow half of [ADR 0061](../../../adr/0061-a-submission-is-an-issue-and-ci-makes-the-pull-request.md).
 * `src/preview/submission.ts` is the format both ends share; this is what
 * `.github/workflows/submission.yml` runs over an issue, through
 * `scripts/submission-from-issue.ts`, and what `test/submission.test.ts` runs over made-up
 * ones.
 *
 * **Everything in the issue is untrusted.** The repository is public, so anybody can open
 * an issue with the right prefix, and the workflow only filters on who opened it after
 * the fact. So the body is read as data and nothing else: one fenced block is cut out,
 * parsed as JSON and handed to the kind's own validator, and what is written is what that
 * validator printed rather than what arrived. No part of the issue becomes a path, a
 * branch name or a command. The kind decides the files, and the kind comes from a fixed
 * table.
 *
 * **Why it lives in the workbench.** The home kind prints its file with
 * `formatLayoutDocument`, which is the workbench's printer and the one the dev server's
 * Save already writes with, and it names blocks with the workbench's German. Both are
 * here; a copy of either under `.github/` would be the copy that drifts.
 *
 * **Why its sentences are German literals.** They are what the workflow says on GitHub:
 * a comment on the issue and the pull request's body. A pull request is argued in German
 * (AGENTS.md), and nothing on the site ever prints these, so they are not the site's
 * words and do not go through its catalogue. The block names inside them do, because
 * those are the site's words and a person will have seen them in the editor.
 */
import { createIntl, type IntlShape } from 'react-intl';

import {
  parseHomeLayout,
  stateAt,
  type HomeChange,
  type HomeEdition,
  type HomeLayout,
  type HomeMoment,
  type HomeSection,
  type SettingValue,
} from '@correctiv/app-core/lib/home-layout';
import { READERS } from '@correctiv/app-core/lib/home-audience';
import { settingsFor, type SettingSpec } from '@correctiv/app-core/lib/home-settings';
import { HOME_PINS } from '@correctiv/app-core/data/home-pins';
import { HOME_LAYOUT_MAX_CHARS } from '@correctiv/app-core/stores/homeLayout';

import { de } from '../src/i18n/catalogue/de/index.ts';
import {
  formatLayoutDocument,
  MODULE_LABELS,
  moduleLabel,
  settingLabel,
} from '../src/preview/home/document.ts';
import {
  kindOfTitle,
  SUBMISSION_FENCE,
  SUBMISSION_KINDS,
  type SubmissionKind,
} from '../src/preview/submission.ts';

// --- refusals ---------------------------------------------------------------------

/** Why a submission did not become a pull request. Each code has one German sentence. */
export type RefusalCode =
  | 'no-kind'
  | 'kind-not-built'
  | 'too-large'
  | 'no-block'
  | 'several-blocks'
  | 'hidden-text'
  | 'body-shape'
  | 'duplicate-ids'
  | 'not-json'
  | 'refused'
  | 'unchanged'
  | 'not-wordings'
  | 'texts-too-large'
  | 'texts-refused'
  | 'texts-unchanged';

export class Refusal extends Error {
  constructor(
    readonly code: RefusalCode,
    readonly detail = '',
    /**
     * One line per thing refused, already made harmless with `shown`, for a refusal that
     * has several parts: the strings kind names every id it refused and why.
     */
    readonly items: readonly string[] = [],
  ) {
    super(detail ? `${code}: ${detail}` : code);
  }
}

/** The most items a refusal lists before it says how many it left out. */
export const REFUSAL_ITEMS_MAX = 20;

/**
 * What the issue is told, in plain German, and what to do about it.
 *
 * Written for the person who pressed the button, who has never seen the JSON: say what
 * went wrong in one sentence and what helps in the next. The parser's codes go after
 * that, for whoever has to look deeper.
 */
export function refusalText(refusal: Refusal): string {
  // In a code span and through `plain`: a JSON parser's message quotes the input, and the
  // input is the issue's.
  const detail = refusal.detail ? `\n\nGenauer: ${shown(refusal.detail, 300)}` : '';
  const shownItems = refusal.items.slice(0, REFUSAL_ITEMS_MAX).map((item) => `- ${item}`);
  const left = refusal.items.length - shownItems.length;
  const items =
    shownItems.length === 0
      ? ''
      : `\n\n${[...shownItems, ...(left > 0 ? [`- … und ${left} weitere.`] : [])].join('\n')}`;
  switch (refusal.code) {
    case 'no-kind':
      return `Der Titel beginnt mit keiner bekannten Kennung wie ${SUBMISSION_KINDS.home.prefix}. Bitte stellen Sie sie wieder an den Anfang des Titels.`;
    case 'kind-not-built':
      return 'Diese Art Einreichung gibt es noch nicht. Ein Maintainer schaut sich das Issue an.';
    case 'too-large':
      return `Die Einreichung ist zu groß. Mehr als ${HOME_LAYOUT_MAX_CHARS / 1024} KiB liest auch die App nicht.${detail}`;
    case 'no-block':
      return 'Im Issue steht keine Änderung. Wenn die Workbench sie in die Zwischenablage gelegt hat: Bearbeiten Sie das Issue, fügen Sie sie über dem Hinweistext ein und speichern Sie.';
    case 'body-shape':
      return 'Das Issue hat nicht die Form, in der die Workbench es schreibt: oben der Hinweistext, darunter genau ein `json`-Block und danach nichts mehr. Im Hinweistext dürfen weder spitze Klammern noch Backticks stehen. Bitte reichen Sie die Änderung noch einmal aus der Workbench ein, ohne das Issue davor zu bearbeiten.';
    case 'duplicate-ids':
      return `Im Block steht dieselbe ID mehr als einmal. Die Workbench schreibt jede ID nur einmal, deshalb ist nicht klar, welcher Wortlaut gemeint ist. Bitte reichen Sie die Änderung noch einmal aus der Workbench ein.${items}`;
    case 'hidden-text':
      return 'Im Issue steht ein HTML-Kommentar. GitHub zeigt seinen Inhalt nicht an, und was dort steht, würde doch mitgelesen. Deshalb nimmt die Automatik kein Issue mit einem an. Bitte entfernen Sie ihn oder reichen Sie die Änderung noch einmal aus der Workbench ein.';
    case 'several-blocks':
      return `Im Issue stehen mehrere \`${SUBMISSION_FENCE}\`-Blöcke. Es darf nur einer sein. Bitte lassen Sie nur den aus der Workbench stehen.`;
    case 'not-json':
      return `Der Block im Issue ist kein gültiges JSON. Vermutlich wurde er beim Einfügen beschädigt. Reichen Sie die Änderung am besten noch einmal aus der Workbench ein.${detail}`;
    case 'refused':
      return `Die App würde dieses Dokument nicht so zeichnen, wie es geschrieben ist. Reichen Sie die Änderung am besten noch einmal aus der Workbench ein.${detail}`;
    case 'unchanged':
      return 'Die eingereichte Startseite ist dieselbe, die schon im Repository steht. Es gibt nichts zu ändern.';
    case 'not-wordings':
      return `Der Block im Issue ist keine Liste von Texten, wie die Workbench sie schreibt: Erwartet ist ein Objekt aus Text-ID und deutschem Wortlaut, mit mindestens einem Eintrag. Reichen Sie die Änderung am besten noch einmal aus der Workbench ein.${detail}`;
    case 'texts-too-large':
      return `Die Einreichung ist zu groß. Bitte teilen Sie die Texte auf mehrere Issues auf.${detail}`;
    case 'texts-refused':
      return `Diese Texte lassen sich so nicht übernehmen. Geändert wurde nichts, auch keiner der übrigen Texte. Bitte korrigieren Sie sie in der Workbench und reichen Sie die Änderungen noch einmal ein.${items}`;
    case 'texts-unchanged':
      return 'Alle eingereichten Texte stehen schon so im Katalog. Es gibt nichts zu ändern.';
  }
}

// --- reading the issue ------------------------------------------------------------

export interface Submission {
  kind: SubmissionKind;
  /** The text inside the one fenced block, as it stood. */
  payload: string;
}

/**
 * The largest body read at all. Twice the payload bound, so a body the payload check
 * would refuse still gets that refusal, and a body past it is not searched by a regular
 * expression. GitHub caps an issue body at 65,536 characters, so neither bound can bite
 * today; they are here because the app's own bound is the honest one to refuse with.
 */
const MAX_BODY = HOME_LAYOUT_MAX_CHARS * 2;

/** Where an HTML comment starts, which GitHub hides with everything up to its end. */
const HTML_COMMENT = '<!--';

/** An opening fence for the payload: its own line, the info string, nothing after it. */
const OPENING = new RegExp(`^\`\`\`${SUBMISSION_FENCE}[ \\t]*$`, 'gm');

/**
 * The kind and the payload of an issue, or a `Refusal`.
 *
 * **The body has to be the shape the workbench writes, and nothing else** (ADR 0062 §5):
 * a lead of plain prose, a blank line, one fenced `json` block at the start of its line,
 * and nothing after the closing fence but whitespace. The lead may hold neither `<` nor a
 * backtick. Measured in the cold review of #263 with `gh api markdown`: a fence inside
 * an HTML attribute (`<div title="` and the block and `">`) renders as nothing and was
 * read, while an indented fence renders as a block and was not. A reader that takes any
 * fence it can find and a renderer that shows only some of them disagree about what the
 * issue says, and the maintainer who reads an outsider's issue sees the renderer's
 * answer. So the reader accepts only a body on which both give the same one. Line ends
 * are read as GitHub may store them after a paste, `\r\n` as `\n`.
 *
 * Exactly one fenced `json` block, because two is somebody having pasted the document a
 * second time beside the first, and choosing one of them would be choosing for them.
 */
export function readSubmission(title: string, body: string): Submission {
  const kind = kindOfTitle(title);
  if (kind === null) throw new Refusal('no-kind');
  if (!SUBMISSION_KINDS[kind].built) throw new Refusal('kind-not-built');
  if (body.length > MAX_BODY) throw new Refusal('too-large', `${body.length} Zeichen`);
  // GitHub renders nothing of a comment, so a block inside one is a change the page shows
  // nobody, the maintainer who reads an outsider's issue before starting the run
  // included. The workbench never writes one. ADR 0062 §5.
  if (body.includes(HTML_COMMENT)) throw new Refusal('hidden-text');

  const text = body.replace(/\r\n?/g, '\n');
  const openings = [...text.matchAll(OPENING)];
  if (openings.length === 0) throw new Refusal(text.includes('`') ? 'body-shape' : 'no-block');
  if (openings.length > 1) throw new Refusal('several-blocks');

  const lead = text.slice(0, openings[0].index);
  if (/[<`]/.test(lead) || (lead !== '' && !lead.endsWith('\n\n'))) throw new Refusal('body-shape');

  const rest = text.slice(openings[0].index + openings[0][0].length).replace(/^\n/, '');
  const close = /^```[ \t]*$/m.exec(rest);
  if (!close) throw new Refusal('no-block');
  if (rest.slice(close.index + close[0].length).trim() !== '') throw new Refusal('body-shape');

  const payload = rest.slice(0, close.index);
  if (payload.length > HOME_LAYOUT_MAX_CHARS)
    throw new Refusal('too-large', `${payload.length} Zeichen`);
  return { kind, payload };
}

// --- the kinds --------------------------------------------------------------------

/** What the home kind writes: its one file, printed, and the summary for the pull request. */
export interface AppliedHome {
  /** The repository path written, which is the kind's own and never the issue's. */
  file: string;
  /** The file's new content, already formatted as the repository's formatter prints it. */
  content: string;
  /** What changed, as Markdown in German, for the pull request's body. */
  summary: string;
}

/**
 * The home document: the core's parser judges, the workbench's printer writes.
 *
 * As strict as `packages/app-core/scripts/check-home-layout.ts`, which the deploy runs
 * over the same file, and for its reason: the app draws past a problem, but a document
 * with one is a document nobody meant to write. Stricter in one way the deploy cannot be:
 * it passes the modules the app can draw, `MODULE_LABELS`' keys, which
 * `test/preview/home-document.test.ts` holds to the app's `HOME_MODULES` in both
 * directions. The core itself does not know that set (ADR 0036 §14), so the deploy's check
 * cannot ask. What is written is the parser's reading printed again, so an unknown key in
 * the issue does not reach the repository.
 */
export function applyHome(payload: string, current: string): AppliedHome {
  let document: unknown;
  try {
    document = JSON.parse(payload);
  } catch (error) {
    throw new Refusal('not-json', error instanceof Error ? error.message : String(error));
  }

  const { layout, problems } = parseHomeLayout(document, RENDERABLE);
  if (!layout || layout.sections.length === 0 || problems.length > 0) {
    const codes = [...new Set(problems.map((problem) => problem.code))].join(', ');
    throw new Refusal('refused', codes || 'kein Dokument mit Blöcken');
  }

  const content = formatLayoutDocument(layout);
  if (content === current) throw new Refusal('unchanged');

  const before = readLayout(current);
  return {
    file: SUBMISSION_KINDS.home.file,
    content,
    summary: summariseHome(before, layout),
  };
}

/** Every module the app can draw, as the editor names them. */
const RENDERABLE: ReadonlySet<string> = new Set(Object.keys(MODULE_LABELS));

/** What the repository holds now, or an empty day if it holds nothing readable. */
function readLayout(text: string): HomeLayout {
  try {
    const { layout } = parseHomeLayout(JSON.parse(text));
    if (layout) return layout;
  } catch {
    // Fall through: the summary then reads as a document written from nothing.
  }
  return { version: 0, sections: [], moments: [], editions: [] };
}

// --- printing text out of the document ---------------------------------------------

/**
 * The longest a single value from the document may be when it is printed. An id or a
 * title longer than this is not something a reviewer needs whole in a summary line.
 */
const VALUE_MAX = 80;

/**
 * A string out of the document, made harmless for a GitHub comment or pull request body.
 *
 * **The document is as untrusted as the issue it came in.** The parser takes any string
 * for an edition's title, a pin and, apart from control characters, an id, and GitHub
 * reads a body for instructions: `Closes #1` anywhere in it closes that issue on merge,
 * `@team` notifies a team, and `<!--` hides everything after it, the real `Closes` line
 * included. Measured by the security review of #252, which got all three through. So
 * every such string passes here, and here does four things: collapses every run of
 * whitespace, line breaks among them, into one space; drops what is left of control
 * characters; caps the length; and swaps the four characters GitHub acts on for
 * look-alikes that it does not: `#`, `@`, `<`, and the backtick, which would otherwise
 * close the code span the caller puts the result in.
 */
export function plain(text: string, max = VALUE_MAX): string {
  const collapsed = text
    .replace(/\s+/g, ' ')
    // oxlint-disable-next-line no-control-regex -- removing control characters is the point
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, '')
    .trim();
  const capped = collapsed.length > max ? `${collapsed.slice(0, max - 1)}…` : collapsed;
  return capped
    .replace(/#/g, '＃')
    .replace(/@/g, '＠')
    .replace(/</g, '‹')
    .replace(/>/g, '›')
    .replace(/`/g, 'ˋ');
}

/** The same, inside a code span, which GitHub neither links nor reads for keywords. */
export function shown(text: string, max = VALUE_MAX): string {
  return `\`${plain(text, max) || ' '}\``;
}

// --- the summary ------------------------------------------------------------------

/** The site's German, for the block names. The sentence frames below are not the site's. */
const INTL: IntlShape = createIntl({ locale: 'de', defaultLocale: 'en', messages: de });

/**
 * The most the list of changes may take in a pull request's body. GitHub refuses a body
 * over 65,536 characters with a 422, which the issue would then have been told was the
 * automation failing; the review of #252 made a 7,057-character issue into a
 * 106,483-character summary. A fifth of the limit leaves the rest of the body room, and
 * a reviewer reads the diff past that point anyway.
 */
export const SUMMARY_MAX = 20_000;

/** Modules that are furniture rather than content: a day of only these shows nothing. */
const FURNITURE: ReadonlySet<string> = new Set(['home-header', 'feed-status']);

/**
 * What changed between two home documents, as a list a person can read.
 *
 * Derived from the two parsed documents rather than from the issue's prose, because the
 * prose is whatever somebody left in it and the diff is what will be merged. That makes
 * it truthful, not harmless: every string it prints from the document goes through
 * `plain`. Blocks are named as the editor names them, the module's German name and the
 * id, so a reviewer can find each one in the workbench. Returns Markdown: warnings first,
 * then a heading and one bullet per change, capped at `SUMMARY_MAX`.
 */
export function summariseHome(before: HomeLayout, after: HomeLayout): string {
  const lines = [
    ...orderLines(before, after),
    ...dayStartLines(before, after),
    ...momentLines(before.moments, after.moments, after),
    ...editionLines(before, after),
  ];
  if (after.version !== before.version && before.version !== 0)
    lines.push(`Das Dokument hat jetzt die Version ${after.version} statt ${before.version}.`);
  if (lines.length === 0)
    lines.push('Nur die Schreibweise der Datei ändert sich, nicht die Startseite.');

  return [
    ...warnings(before, after),
    '### Was sich an der Startseite ändert',
    '',
    ...bulleted(lines),
  ].join('\n');
}

/**
 * Lines as Markdown bullets, stopping before `SUMMARY_MAX` and saying how many were left
 * out. Every kind's summary goes through this, for the 422 `SUMMARY_MAX` is there for.
 */
export function bulleted(lines: readonly string[]): string[] {
  const bullets: string[] = [];
  let used = 0;
  for (const [index, line] of lines.entries()) {
    const bullet = `- ${line}`;
    if (used + bullet.length > SUMMARY_MAX) {
      bullets.push(`- … und ${lines.length - index} weitere Änderungen, siehe den Diff.`);
      break;
    }
    bullets.push(bullet);
    used += bullet.length + 1;
  }
  return bullets;
}

/**
 * What a reviewer must not miss, in bold above the list: a day on which the home screen
 * shows nothing, and a document that has lost most of its blocks. Both parse, and both
 * would reach every reader on the next deploy.
 */
export function warnings(before: HomeLayout, after: HomeLayout): string[] {
  const found: string[] = [];
  const shows = (sections: readonly HomeSection[]) =>
    sections.some((section) => !section.hidden && !FURNITURE.has(section.module));
  const empty = [
    ...(shows(after.sections) ? [] : ['zu Tagesbeginn']),
    ...after.moments
      // Empty for any reader is empty: an audience can hide a block from one of them only
      // (ADR 0060), and that reader's screen is the one a reviewer would otherwise miss.
      .filter((moment) => READERS.some((reader) => !shows(stateAt(after, moment.minute, reader))))
      .map((moment) => `ab ${moment.at}`),
  ];
  if (empty.length > 0)
    found.push(
      `> **Achtung: Die Startseite zeigt ${empty.join(', ')} keinen Inhalt.** Außer Kopfzeile und Ladehinweis ist dann alles ausgeblendet. Bitte prüfen Sie, ob das gewollt ist.`,
    );
  const kept = after.sections.filter((section) =>
    before.sections.some((was) => was.id === section.id),
  ).length;
  if (before.sections.length > 0 && kept < before.sections.length / 2)
    found.push(
      `> **Achtung: Von ${before.sections.length} Blöcken sind nur ${kept} übrig.** Bitte prüfen Sie, ob das gewollt ist.`,
    );
  return found.length > 0 ? [...found, ''] : [];
}

/** A block as the editor names it: its module's German name, and its id. */
function quoted(section: HomeSection): string {
  const name = moduleLabel(section.module).label;
  const words = typeof name === 'string' ? shown(name) : `„${INTL.formatMessage(name)}“`;
  return `${words} (${shown(section.id)})`;
}

function byId(layout: HomeLayout): Map<string, HomeSection> {
  return new Map(layout.sections.map((section) => [section.id, section]));
}

/**
 * Added, removed, and moved blocks.
 *
 * "Moved" is the blocks outside the longest run both orders share. Moving one block
 * shifts every block between its old and new place by one, and a list naming all of
 * those would name the wrong thing; the blocks that are not part of the common order are
 * the ones somebody actually picked up.
 */
function orderLines(before: HomeLayout, after: HomeLayout): string[] {
  const lines: string[] = [];
  const old = byId(before);
  const now = byId(after);
  const total = after.sections.length;

  after.sections.forEach((section, index) => {
    const was = old.get(section.id);
    if (!was) lines.push(`${quoted(section)} ist neu, an Stelle ${index + 1} von ${total}.`);
    else if (was.module !== section.module)
      lines.push(`${quoted(was)} ist jetzt ${quoted(section)}.`);
  });
  for (const section of before.sections)
    if (!now.has(section.id)) lines.push(`${quoted(section)} ist entfernt.`);

  const kept = new Set(longestCommonRun(sharedIds(before, now), sharedIds(after, old)));
  after.sections.forEach((section, index) => {
    if (old.has(section.id) && !kept.has(section.id))
      lines.push(`${quoted(section)} ist verschoben, jetzt an Stelle ${index + 1} von ${total}.`);
  });
  return lines;
}

/** A layout's ids in its order, keeping only those the other layout also has. */
function sharedIds(layout: HomeLayout, other: Map<string, HomeSection>): string[] {
  return layout.sections.map((section) => section.id).filter((id) => other.has(id));
}

/** The longest common subsequence of two id lists. Both are a dozen long, so the table is tiny. */
export function longestCommonRun(a: readonly string[], b: readonly string[]): string[] {
  const table = Array.from({ length: a.length + 1 }, () =>
    Array.from({ length: b.length + 1 }, () => 0),
  );
  for (let i = a.length - 1; i >= 0; i--)
    for (let j = b.length - 1; j >= 0; j--)
      table[i][j] =
        a[i] === b[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
  const run: string[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      run.push(a[i]);
      i++;
      j++;
    } else if (table[i + 1][j] >= table[i][j + 1]) i++;
    else j++;
  }
  return run;
}

/** Switched on or off, and settings changed, where the day starts. */
function dayStartLines(before: HomeLayout, after: HomeLayout): string[] {
  const lines: string[] = [];
  const old = byId(before);
  for (const section of after.sections) {
    const was = old.get(section.id);
    if (!was || was.module !== section.module) {
      if (section.hidden) lines.push(`${quoted(section)} ist zu Tagesbeginn ausgeblendet.`);
      continue;
    }
    if (Boolean(was.hidden) !== Boolean(section.hidden))
      lines.push(
        `${quoted(section)} ist zu Tagesbeginn ${section.hidden ? 'ausgeblendet' : 'wieder sichtbar'}.`,
      );
    for (const spec of settingsFor(section.module)) {
      const from = valueOf(was.settings, spec);
      const to = valueOf(section.settings, spec);
      if (from !== to)
        lines.push(
          `${quoted(section)}: ${settingName(section, spec)} ist jetzt ${printed(to)}, vorher ${printed(from)}.`,
        );
    }
  }
  return lines;
}

function valueOf(
  settings: Readonly<Record<string, SettingValue>> | undefined,
  spec: SettingSpec,
): SettingValue {
  return settings?.[spec.key] ?? spec.fallback;
}

function settingName(section: HomeSection, spec: SettingSpec): string {
  const label = settingLabel(section.module, spec).label;
  return typeof label === 'string' ? shown(label) : `„${INTL.formatMessage(label)}“`;
}

/**
 * A setting's value in words: `null` as "none", a count as its number, and a pin by the
 * title of the article when it is one of `HOME_PINS`, which is this repository's data.
 * Any other pin is a string out of the document and is shown as one.
 */
function printed(value: SettingValue | undefined): string {
  if (value === null || value === undefined) return 'nichts angepinnt';
  if (typeof value === 'string') {
    const pin = HOME_PINS.find((item) => item.url === value);
    return pin ? `„${pin.title}“` : shown(value);
  }
  return String(value);
}

/** What one change does, in a few words, such as that a block is switched off. */
function changeWords(change: HomeChange, sections: Map<string, HomeSection>): string {
  const section = sections.get(change.id);
  const name = section ? quoted(section) : shown(change.id);
  const parts: string[] = [];
  if (change.hidden !== undefined)
    parts.push(`${name} ${change.hidden ? 'ausgeblendet' : 'eingeblendet'}`);
  for (const [key, value] of Object.entries(change.settings ?? {})) {
    const spec = section ? settingsFor(section.module).find((each) => each.key === key) : undefined;
    const label = section && spec ? settingName(section, spec) : shown(key);
    parts.push(`${name}: ${label} ${printed(value)}`);
  }
  return parts.join(', ');
}

function changesWords(changes: readonly HomeChange[], sections: Map<string, HomeSection>): string {
  return changes.length === 0
    ? 'keine Änderung'
    : changes.map((change) => changeWords(change, sections)).join('; ');
}

/** Moments added, dropped and rewritten. "Moment" is the editor's own word for one. */
function momentLines(
  before: readonly HomeMoment[],
  after: readonly HomeMoment[],
  layout: HomeLayout,
): string[] {
  const lines: string[] = [];
  const sections = byId(layout);
  const old = new Map(before.map((moment) => [moment.at, moment]));
  const now = new Set(after.map((moment) => moment.at));
  for (const moment of after) {
    const was = old.get(moment.at);
    const words = changesWords(moment.changes, sections);
    if (!was) lines.push(`Neuer Moment um ${moment.at}: ${words}.`);
    else if (JSON.stringify(was.changes) !== JSON.stringify(moment.changes))
      lines.push(`Der Moment um ${moment.at} ist geändert, jetzt: ${words}.`);
  }
  for (const moment of before)
    if (!now.has(moment.at)) lines.push(`Der Moment um ${moment.at} entfällt.`);
  return lines;
}

/** `2026-09-24T06:00` as a German reader writes it. The parser has checked the shape. */
function when(stamp: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}:\d{2})$/.exec(stamp);
  return match ? `${match[3]}.${match[2]}.${match[1]}, ${match[4]}` : shown(stamp);
}

function editionName(edition: HomeEdition): string {
  return edition.title ? `${shown(edition.title)} (${shown(edition.id)})` : shown(edition.id);
}

/** Editions added, dropped and changed, and what changed inside one. */
function editionLines(before: HomeLayout, after: HomeLayout): string[] {
  const lines: string[] = [];
  const sections = byId(after);
  const old = new Map(before.editions.map((edition) => [edition.id, edition]));
  const now = new Set(after.editions.map((edition) => edition.id));
  for (const edition of after.editions) {
    const was = old.get(edition.id);
    const span = `vom ${when(edition.from)} bis ${when(edition.until)} Uhr`;
    if (!was) {
      lines.push(
        `Neue Ausgabe ${editionName(edition)}, ${span}: ${changesWords(edition.changes, sections)}.`,
      );
      for (const moment of edition.moments)
        lines.push(
          `In der Ausgabe ${editionName(edition)} um ${moment.at}: ${changesWords(moment.changes, sections)}.`,
        );
      continue;
    }
    if (was.from !== edition.from || was.until !== edition.until)
      lines.push(`Die Ausgabe ${editionName(edition)} gilt jetzt ${span}.`);
    if ((was.title ?? '') !== (edition.title ?? ''))
      lines.push(`Die Ausgabe ${shown(edition.id)} heißt jetzt ${editionName(edition)}.`);
    if (JSON.stringify(was.changes) !== JSON.stringify(edition.changes))
      lines.push(
        `Die Ausgabe ${editionName(edition)} beginnt jetzt mit: ${changesWords(edition.changes, sections)}.`,
      );
    lines.push(
      ...momentLines(was.moments, edition.moments, after).map(
        (line) => `In der Ausgabe ${editionName(edition)}: ${line}`,
      ),
    );
  }
  for (const edition of before.editions)
    if (!now.has(edition.id)) lines.push(`Die Ausgabe ${editionName(edition)} entfällt.`);
  return lines;
}
