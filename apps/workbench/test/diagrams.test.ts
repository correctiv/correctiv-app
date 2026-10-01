import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import ts from 'typescript';
import { describe, expect, it } from 'vitest';

import { numberInProse } from '@correctiv/prose-and-code';

import { collectDocs, ROOT } from '../plugin/collect.ts';
import { strikeEdges, type DecisionRecord, type Strike } from '../plugin/decisions.ts';
import { DIAGRAMS as META } from '../src/diagrams';
import { ADVANCE, chainLayout } from '../src/diagrams/layout';

import { CORE, DIAGRAMS, diagramSources, drawn, drawnText, NUMBER_WORDS } from './drawn.ts';
import { code } from './source.ts';

const PORTS_FILE = join(CORE, 'ports/index.ts');
const MANIFEST_FILE = join(ROOT, 'apps/workbench/content/sources.manifest.ts');

/** The two drawings that draw the ports. The others draw something else. */
const PORT_DRAWINGS = ['CoreAndHost.tsx', 'InsideCore.tsx'];

/**
 * The drawings say things about the core, and nothing about them looks wrong when
 * they stop being true.
 *
 * The facts here are measured against `packages/app-core` rather than against the
 * outside world, which is the faster of the two ways a figure goes quiet
 * (AGENTS.md → "Facts that expire"). Both of them had already drifted when this
 * file was written: a fifth port was declared and the drawings still drew four,
 * and the core had grown a directory while the file count under it still said 54.
 * Neither broke a build, and neither would have.
 *
 * Every figure is stated in more than one place on purpose — a drawing has a
 * label, a caption and a list that replaces it for anyone who cannot see it, and
 * all three have to say the same thing. So the rule is not "write it once"; it is
 * "write it wherever it belongs, and let this file fail when two of them part".
 */

/** Every `.ts`/`.tsx` under a directory, counted the way the drawings count them. */
function countSources(dir: string): number {
  let total = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) total += countSources(join(dir, entry.name));
    else if (/\.tsx?$/.test(entry.name)) total += 1;
  }
  return total;
}

/** `ports/index.ts` parsed, which is the only reading of it this file does. */
function portsFile(): ts.SourceFile {
  return ts.createSourceFile(
    'ports/index.ts',
    readFileSync(PORTS_FILE, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
  );
}

/**
 * The ports, read off the DECLARATION of `CorePlatform` rather than off the text
 * of the file it stands in.
 *
 * `ports/index.ts` declares more interfaces than it has ports — `PlaybackStatus`,
 * `NowPlaying` and `ErrorReport` are shapes a port passes, not ports — so there is
 * no telling one from the other by its declaration. `CorePlatform` is the list of
 * what a host must supply, which is exactly what the drawings draw.
 *
 * It was a regex over the file's text, `/^\s*\w+\??:\s*(\w+);/gm` inside whatever
 * stood between the first `{` and the first `}` after `interface CorePlatform`,
 * and it was wrong in four ways at once, each of them silent. It captured the
 * TYPE and not the property. It stopped at the first `}`, so one member written as
 * an inline object would have truncated the list and dropped every port after it.
 * A member whose type is a union, or `Array<…>`, or that ends in a comma rather
 * than a semicolon, matched nothing and simply was not a port as far as the
 * drawings were concerned. And `readonly errors: ErrorReporter;` — the one word a
 * reviewer might add without thinking twice — matched nothing either.
 *
 * The parser has none of those edges, because it is the same one that compiles the
 * file. It reads syntax only, with no program and no checker: a member is a member
 * whatever its type is written as, and a file that no longer declares the
 * interface throws rather than yielding an empty list.
 */
function ports(): { property: string; type: string }[] {
  const source = portsFile();
  const declaration = source.statements.find(
    (statement): statement is ts.InterfaceDeclaration =>
      ts.isInterfaceDeclaration(statement) && statement.name.text === 'CorePlatform',
  );
  if (!declaration) {
    throw new Error('ports/index.ts no longer declares an interface named CorePlatform');
  }
  return declaration.members.map((member) => {
    const property = member.name?.getText(source) ?? '';
    const type = ts.isPropertySignature(member) ? (member.type?.getText(source) ?? '') : '';
    if (property === '' || type === '') {
      throw new Error(`CorePlatform has a member this cannot read: ${member.getText(source)}`);
    }
    return { property, type };
  });
}

/** Every interface `ports/index.ts` declares, ports and passed shapes alike. */
function declaredInterfaces(): string[] {
  const source = portsFile();
  return source.statements
    .filter((statement): statement is ts.InterfaceDeclaration =>
      ts.isInterfaceDeclaration(statement),
    )
    .map((statement) => statement.name.text);
}

/** Every "five ports" / "four interfaces" in the drawings, as written. */
const PORT_COUNT_CLAIMS =
  /\b(no|one|two|three|four|five|six|seven|eight|nine|\d+)\s+(?:named\s+)?(?:ports|interfaces)\b/gi;

/**
 * The number the drawings spell out, which is the count read from the other side.
 *
 * Used as the floor for the derivation above, because the floor that stood there
 * was `toBeGreaterThan(1)` against a set of five: a derivation that had found two
 * of the five passed it, and then found both of those two drawn, and the suite was
 * green about a drawing missing three ports. There is no honest constant to put
 * here — five is not a property of anything — so what it is held to is the number
 * the drawings themselves claim, which comes from a different reading of different
 * files.
 */
function spelledPortCount(): number {
  const spelled = new Set<number>();
  for (const { text } of diagramSources()) {
    for (const match of text.matchAll(PORT_COUNT_CLAIMS)) {
      const word = match[1].toLowerCase();
      const index = NUMBER_WORDS.indexOf(word);
      spelled.add(index >= 0 ? index : Number(word));
    }
  }
  if (spelled.size !== 1) {
    throw new Error(
      `the drawings spell the number of ports ${spelled.size} different ways: ${[...spelled].join(', ')}`,
    );
  }
  return [...spelled][0];
}

describe('the drawings, against what they draw', () => {
  it('names every port the core declares, in every drawing that draws the ports', () => {
    const declared = ports();
    expect(declared.length).toBe(spelledPortCount());

    const wrong: string[] = [];
    for (const name of PORT_DRAWINGS) {
      const text = drawnText(name);
      for (const port of declared) {
        if (!drawn(text, port.type)) {
          wrong.push(`${name} draws the ports and never names ${port.type} (${port.property})`);
        }
      }
    }
    expect(wrong).toEqual([]);
  });

  /**
   * The other direction, which was unasserted: a port taken OFF `CorePlatform`
   * and left in the picture.
   *
   * A drawing that names a port the core no longer has is the same fault as one
   * missing a port it does have, and it is the likelier of the two — deleting a
   * member is a one-line change and the drawings are somewhere else entirely.
   *
   * WHAT THIS CANNOT SEE: a name that has left `ports/index.ts` altogether. The
   * candidates are the interfaces that file declares, so a port whose member AND
   * whose interface were both deleted leaves a word in the drawing that nothing
   * here can recognise as having once been a port. The common case — the member
   * goes, the interface stays because something still passes that shape — is
   * caught.
   */
  it('names no port in the drawings that CorePlatform has stopped requiring', () => {
    const declared = new Set(ports().map((port) => port.type));
    // `CorePlatform` is the list, not a member of it, and a drawing is entitled to
    // label the box with it.
    const passedShapes = declaredInterfaces().filter(
      (name) => name !== 'CorePlatform' && !declared.has(name),
    );

    const stale: string[] = [];
    for (const name of PORT_DRAWINGS) {
      const text = drawnText(name);
      for (const shape of passedShapes) {
        if (drawn(text, shape)) {
          stale.push(`${name} draws ${shape}, which CorePlatform does not require`);
        }
      }
    }
    expect(stale).toEqual([]);
  });

  /**
   * A count in front of the word is read as a claim about the total.
   *
   * That makes one phrasing off limits, and it is worth knowing which: a SUBSET
   * cannot be spelled with a numeral either ("the two storage ports"), because
   * nothing here can tell that apart from a total that has gone stale. Say it
   * another way — "both storage ports", "the two storage interfaces", "four of
   * them" — and the sentence is as clear while this check still means something.
   */
  it('says how many ports there are, and the number is the number', () => {
    // `spelling: 'word'` is the drawings' rule rather than a general one: a picture
    // writes "five ports", so a numeral of the right value fails here and says to
    // spell it. The other half — a caption pattern that has stopped matching
    // anything — is a fault the helper returns rather than a second assertion this
    // file has to remember, which is what it was.
    expect(
      numberInProse({
        documents: diagramSources(),
        pattern: PORT_COUNT_CLAIMS,
        value: ports().length,
        what: 'the core declares',
        spelling: 'word',
      }),
    ).toEqual([]);
  });

  it("counts the core's files the way the fourth drawing says it does", () => {
    expect(
      numberInProse({
        documents: diagramSources(),
        pattern: /(\d+)\s+TypeScript files/,
        value: countSources(CORE),
        what: 'packages/app-core/src holds',
      }),
    ).toEqual([]);
  });
});

/**
 * The same figures, on the other side of the seam.
 *
 * **A figure that moved into a `defaultMessage` gained a second copy nothing was
 * reading.** The two checks above walk `src/diagrams/`, which is where a drawing's
 * English lives; the German for the same label lives in
 * `src/i18n/catalogue/de/`, which they do not walk. So from the moment three of
 * the drawings were translated, „alle fünf Ports" and „58 TypeScript-Dateien"
 * were figures about this repository with nothing holding them to it, and the
 * English going red would have left the German quietly wrong. Found by the pass
 * that made them, and named here rather than left in a comment: AGENTS.md's rule
 * is that the check goes in with the fact.
 *
 * **Two assertions and not one**, because the two kinds of figure fail
 * differently. A spelled-out number is a different word in each language and needs
 * the German words below. A numeral is the same characters in both, so what holds
 * it is that the German carries the numeral the English carries — which also
 * covers a figure no pattern here has been written for yet.
 */
describe('a figure a drawing spells out is the same figure in German', () => {
  const CATALOGUE = join(ROOT, 'apps/workbench/src/i18n/catalogue/de');

  /** The namespaces the six drawings and their frame write into. */
  const DRAWING_NAMESPACES = [
    'coreAndHost',
    'insideCore',
    'services',
    'articlePath',
    'signIn',
    'decisionsChain',
    'diagrams',
  ];

  const german = () =>
    DRAWING_NAMESPACES.map((name) => ({
      name: `de/${name}.ts`,
      text: readFileSync(join(CATALOGUE, `${name}.ts`), 'utf8'),
    }));

  /**
   * Nought to ten in German, which is as far as any drawing counts in words.
   *
   * `numberInProse` takes the English list out of `@correctiv/prose-and-code`,
   * and this one stays here: a mechanism does not know which languages a caller
   * ships, and this site ships two.
   */
  const GERMAN_WORDS = [
    'kein',
    'ein',
    'zwei',
    'drei',
    'vier',
    'fünf',
    'sechs',
    'sieben',
    'acht',
    'neun',
    'zehn',
  ];

  it('spells the port count the way the core declares it', () => {
    const claims =
      /\b(kein|eine?|zwei|drei|vier|fünf|sechs|sieben|acht|neun|zehn|\d+)\s+(?:Ports|Schnittstellen)\b/gi;
    const expected = ports().length;
    const faults: string[] = [];
    let found = 0;

    for (const { name, text } of german()) {
      for (const [whole, word] of text.matchAll(claims)) {
        found += 1;
        const said = GERMAN_WORDS.indexOf(word.toLowerCase().replace(/^eine$/, 'ein'));
        const value = said >= 0 ? said : Number(word);
        if (value !== expected)
          faults.push(`${name}: “${whole.trim()}” where the core declares ${expected}`);
      }
    }

    // A pattern that has stopped matching agrees with everything, and this one
    // matches German that somebody may rephrase.
    expect(found).toBeGreaterThan(0);
    expect(faults).toEqual([]);
  });

  /**
   * One id's German, out of the file its namespace names.
   *
   * A hand-rolled read rather than an import of the catalogue, because this is a
   * question about what is WRITTEN: the merged object would let an id from
   * another namespace stand in for a missing one.
   */
  const germanFor = (id: string, text: string): string | undefined => {
    const at = text.indexOf(`'${id}':`);
    if (at === -1) return undefined;
    const rest = text.slice(at + id.length + 3);
    const opens = rest.indexOf("'");
    if (opens === -1) return undefined;
    let out = '';
    for (let i = opens + 1; i < rest.length; i += 1) {
      if (rest[i] === '\\') {
        out += rest[i + 1];
        i += 1;
        continue;
      }
      if (rest[i] === "'") break;
      out += rest[i];
    }
    return out;
  };

  it('carries every numeral the English carries', () => {
    // Two digits and up. A single digit is „ein"/„eine" as often as „1" and would
    // report a rephrasing as a fault; a year or a count is what this is for.
    const NUMERALS = /\b\d{2,}\b/g;
    const english = JSON.parse(readFileSync(join(CATALOGUE, '..', 'en.json'), 'utf8')) as Record<
      string,
      { defaultMessage: string }
    >;
    const catalogue = Object.fromEntries(german().map(({ name, text }) => [name, text]));

    const faults: string[] = [];
    let checked = 0;

    for (const [id, { defaultMessage }] of Object.entries(english)) {
      const namespace = id.split('.')[0]!;
      if (!DRAWING_NAMESPACES.includes(namespace)) continue;
      const numerals = [...new Set([...defaultMessage.matchAll(NUMERALS)].map((m) => m[0]))];
      if (numerals.length === 0) continue;
      checked += 1;
      // The ID's own German and not the whole file. Reading the file was the
      // first version and it could not fail: a figure deleted from one entry was
      // still somewhere else in the same file, and the check agreed. Measured.
      const text = germanFor(id, catalogue[`de/${namespace}.ts`] ?? '');
      if (text === undefined) {
        faults.push(`de/${namespace}.ts has no entry for ${id}`);
        continue;
      }
      for (const numeral of numerals) {
        if (!text.includes(numeral)) faults.push(`${id}: the German is missing ${numeral}`);
      }
    }

    expect(checked).toBeGreaterThan(0);
    expect(faults).toEqual([]);
  });
});

const { module: DOCS } = collectDocs();
const RECORDS = DOCS.decisions;
const CHAIN = chainLayout(RECORDS, DOCS.strikes);

/**
 * The decisions drawing, which is now a layout function over `adr/` rather than a
 * picture.
 *
 * IT WAS A PICTURE, and that is what these checks are for. Every node, arc and
 * label was typed; it drew 0001 through 0023; the lede above it read the count off
 * `virtual:docs` and said thirty-six. Thirteen records were missing from the
 * diagram about how this repository keeps its decisions straight, the file carried
 * a comment admitting that its own list and its own drawing disagreed about 0014,
 * and every check in this repository was green.
 *
 * So the interesting failure has MOVED, and none of what follows asserts "0034 is
 * in the picture" — that is true by construction now, and a check for it would be
 * a check on `Array.prototype.map`. What a generator can still do is drop a record
 * on the way through, put two of them on one rung, draw an arc to a rung that is
 * not there, run a label under the column beside it, or reach off its own canvas.
 * Those are what these are.
 *
 * WHAT THEY CANNOT SEE. They assert the LAYOUT, which is the data the drawing maps
 * over, and not the SVG a browser receives; nothing here renders React. A
 * component that mapped half of `nodes` would pass, which is why the last check in
 * this block reads the component's source for the two `map` calls and for the
 * absence of any typed record number. And nothing here knows how wide a glyph
 * actually is — see `ADVANCE` in `src/diagrams/layout.ts` for what that leaves to
 * the screenshot.
 */
describe('the decisions drawing, against `adr/`', () => {
  it('puts one rung on the axis for every record, in number order', () => {
    expect(CHAIN.nodes.map((node) => node.number)).toEqual(RECORDS.map((record) => record.number));
  });

  it('gives no two records the same rung', () => {
    const ys = CHAIN.nodes.map((node) => node.y);
    expect(new Set(ys).size).toBe(ys.length);
    // And they descend, because the axis IS the record sequence: a generator that
    // sorted or grouped without saying so would still hand out distinct rungs.
    expect(ys).toEqual(ys.toSorted((a, b) => a - b));
  });

  /**
   * The count is typed nowhere, so it is held to `adr/` from both ends.
   *
   * `plugin/decisions.ts` already throws when a record file does not become a
   * record. This is the other half: a record that became a record and then did not
   * become a rung.
   */
  it('draws as many rungs as `adr/` holds records', () => {
    expect(CHAIN.nodes.length).toBe(RECORDS.length);
    expect(CHAIN.summary.records).toBe(RECORDS.length);
  });

  it('draws every strike the records state, and no arc the records do not', () => {
    const stated = strikeEdges(RECORDS)
      .map((edge) => `${edge.by}->${edge.of} x${edge.claims}`)
      .toSorted();
    const onTheAxis = CHAIN.arcs.map((arc) => `${arc.by}->${arc.of} x${arc.claims}`).toSorted();
    expect(onTheAxis).toEqual(stated);
    expect(CHAIN.summary.arcs).toBe(stated.length);
  });

  /**
   * An arc with an end that is not on the axis has nowhere to point, and
   * `M288 undefined C …` renders as nothing at all rather than as an error.
   *
   * `chainLayout` drops such an edge rather than drawing it, which is why the
   * check above compares against the unfiltered list: between the two, an edge can
   * be neither invented nor quietly thrown away.
   */
  it('points every arc at two rungs that exist', () => {
    const rungs = new Map(CHAIN.nodes.map((node) => [node.number, node.y]));
    const wrong: string[] = [];
    for (const arc of CHAIN.arcs) {
      if (!rungs.has(arc.by) || !rungs.has(arc.of)) {
        wrong.push(`${arc.by} -> ${arc.of} ends on a record that is not drawn`);
        continue;
      }
      // A record can only be made false by a later one, which is the rule the
      // records' half of the graph is derived with. An arc the other way round
      // would mean that rule had been lost between the records and the picture.
      if (arc.by <= arc.of) wrong.push(`${arc.by} -> ${arc.of} does not run backwards in time`);
      if (arc.claims < 1) wrong.push(`${arc.by} -> ${arc.of} draws an arc for no claim`);
      if (!/^M[\d.]+ [\d.]+ C /.test(arc.path)) {
        wrong.push(`${arc.by} -> ${arc.of} has no path: ${arc.path}`);
      }
    }
    expect(wrong).toEqual([]);
  });

  /**
   * The width is the claim the layout makes: height grows with the record count
   * and width does not, because arcs are packed into lanes by overlap rather than
   * given one each. A lane step that stopped dividing the gutter would put the
   * outermost arcs off the left edge, where they are invisible and not missing.
   */
  it('keeps every arc inside the canvas however deep the nesting goes', () => {
    const outside: string[] = [];
    for (const arc of CHAIN.arcs) {
      for (const point of arc.path.matchAll(/(-?[\d.]+) (-?[\d.]+)/g)) {
        const x = Number(point[1]);
        const y = Number(point[2]);
        if (x < 0 || x > CHAIN.width || y < 0 || y > CHAIN.height) {
          outside.push(`${arc.by} -> ${arc.of} reaches ${x},${y}, outside the canvas`);
        }
      }
    }
    expect(outside).toEqual([]);
  });

  /**
   * A generated layout that overlaps its own labels passes every other check
   * there is.
   *
   * Per row, because the title column is cut to what each row has free rather than
   * to one budget for the set: the longest title in `adr/` sits beside one of the
   * shortest voider lists and the busiest voider list beside one of the shortest
   * titles, and a single budget would cut both or neither.
   */
  it('leaves every title clear of the column beside it', () => {
    const overlapping: string[] = [];
    expect(CHAIN.numberX + 4 * ADVANCE.mono).toBeLessThan(CHAIN.titleX);
    for (const node of CHAIN.nodes) {
      if (node.label === '') continue;
      const titleEnd = CHAIN.titleX + node.label.length * ADVANCE.title;
      const columnStart = CHAIN.rightX - node.struckByText.length * ADVANCE.mono;
      if (titleEnd > columnStart) {
        overlapping.push(
          `${node.number}: title ends at ${Math.round(titleEnd)}, column starts at ${Math.round(columnStart)}`,
        );
      }
    }
    expect(overlapping).toEqual([]);
  });

  /** A title cut short says so, and one that fits is printed whole. */
  it('prints the record title, cut only where the row has no room', () => {
    const byNumber = new Map(RECORDS.map((record) => [record.number, record]));
    const wrong: string[] = [];
    for (const node of CHAIN.nodes) {
      if (node.title !== byNumber.get(node.number)?.title) {
        wrong.push(`${node.number} carries a title the record does not`);
      }
      if (node.quiet) {
        if (node.label !== '')
          wrong.push(`${node.number} is drawn quiet and still carries a title`);
        continue;
      }
      if (node.label === '') wrong.push(`${node.number} is drawn with no title at all`);
      else if (node.label !== node.title && !node.label.endsWith('…')) {
        wrong.push(`${node.number}'s title was cut without saying so`);
      }
    }
    expect(wrong).toEqual([]);
  });

  /**
   * `quiet` is the drawing's own word and not a standing: a record that stands,
   * struck nothing and was struck by nothing, drawn as a dot with no title.
   *
   * It is the one piece of hierarchy in the picture, so a bug that made every
   * record quiet — or none — would empty the drawing or crowd it, and fail nothing
   * else here.
   */
  it('marks a record quiet exactly when nothing is recorded either way', () => {
    const wrong: string[] = [];
    for (const record of RECORDS) {
      const node = CHAIN.nodes.find((candidate) => candidate.number === record.number);
      const nothing =
        record.standing === 'stands' && record.voids.length === 0 && record.voidedBy.length === 0;
      if (node?.quiet !== nothing) {
        wrong.push(
          `${record.number} is drawn ${node?.quiet ? 'quiet' : 'loud'} against its record`,
        );
      }
    }
    expect(wrong).toEqual([]);
    expect(CHAIN.summary.quiet).toBe(CHAIN.nodes.filter((node) => node.quiet).length);
  });

  /** The standings the caption counts are the standings the records carry. */
  it('counts the three standings the way the records do', () => {
    const count = (standing: string) => RECORDS.filter((r) => r.standing === standing).length;
    expect(CHAIN.summary.stands).toBe(count('stands'));
    expect(CHAIN.summary.partlyStruck).toBe(count('partly-struck'));
    expect(CHAIN.summary.withdrawn).toBe(count('withdrawn'));
    expect(CHAIN.summary.stands + CHAIN.summary.partlyStruck + CHAIN.summary.withdrawn).toBe(
      RECORDS.length,
    );
  });

  /**
   * The size the index publishes is the size the drawing actually is.
   *
   * `DiagramMeta` carries a width and a height so a page can place a drawing
   * without rendering it, and the two fixed drawings have theirs typed. This one's
   * height is a function of the record count, so a number typed there would be the
   * old defect moved one file across.
   *
   * THE COUNT IS NOW A PLACEHOLDER, which is the same claim in two halves. The
   * lede is a message descriptor since ADR 0052 §1 took the drawings' own words,
   * so the sentence cannot carry the number as text in either language: what it
   * carries is `{records}`, and `ledeValues` carries what goes in the hole. Both
   * halves are asserted, because a lede that lost its placeholder and a
   * `ledeValues` that lost its count are two different ways to print the wrong
   * number, and each one passes the other's check.
   */
  it('publishes the size it computed, and the count in its lede', () => {
    const meta = META.find((diagram) => diagram.id === 'decisions');
    expect(meta).toBeDefined();
    expect(meta?.height).toBe(CHAIN.height);
    expect(meta?.width).toBe(CHAIN.width);
    expect(meta?.lede.defaultMessage).toMatch(/^\{records\} records\b/);
    expect(meta?.ledeValues?.records).toBe(RECORDS.length);
  });

  /**
   * And the property everything above rests on: nothing in the drawing is typed.
   *
   * Source-level, because it is a claim about how the file is written rather than
   * about what it computes. A single `0014` back in the markup is the old defect
   * returning, and it would pass every check above by sitting beside the generated
   * rungs rather than instead of them.
   *
   * The two `map` calls are the other half. The checks above assert the layout,
   * and the layout is only the drawing if the drawing draws all of it.
   */
  it('types no record number, and draws every rung and arc the layout gives it', () => {
    const drawing = code(readFileSync(join(DIAGRAMS, 'DecisionsChain.tsx'), 'utf8'));
    const layout = code(readFileSync(join(DIAGRAMS, 'layout.ts'), 'utf8'));

    expect([...drawing.matchAll(/\b0\d{3}\b/g)].map((hit) => hit[0])).toEqual([]);
    expect([...layout.matchAll(/\b0\d{3}\b/g)].map((hit) => hit[0])).toEqual([]);
    expect(drawing).toMatch(/LAYOUT\.nodes\.map\(/);
    expect(drawing).toMatch(/LAYOUT\.arcs\.map\(/);
  });
});

/**
 * The third drawing, which nothing checked at all until now, and which is not
 * redrawn here.
 *
 * Its caption spells two figures — how many content sources are live, and how many
 * are files standing in for one — and both are typed beside a row array that is
 * also typed. That is a weaker arrangement than the drawing above and it stays
 * that way today; what follows is the cheap half.
 *
 * WHAT CANNOT BE HELD TO THE MANIFEST, and it is the first thing a reader will
 * ask. `content/sources.manifest.ts` counts CAPABILITIES — articles, the
 * newsletter archive, search, podcasts, live radio, YouTube, PeerTube — and this
 * drawing draws HOSTS, with the first three of those all answering at
 * correctiv.org. So the manifest's live count is seven and the caption's is five,
 * and both are right. Holding one to the other would mean teaching this file which
 * endpoint belongs to which host, and that mapping is stated nowhere in the
 * repository: it would be a third place to keep in step, which is the arrangement
 * `AGENTS.md` says to reach for last.
 *
 * WHAT CAN. Two things, and neither needs that mapping:
 *
 *   The caption against the drawing's OWN rows, which is the failure that actually
 *   happened to the decisions drawing: a row added and the sentence left alone.
 *
 *   Each row's STATE against the manifest. `standsIn` is the manifest's word for a
 *   file standing in for a service, which is exactly what this drawing's dashed
 *   wire means, so a source that goes live — beabee and Faktenforum are the two
 *   waiting to — loses its `standsIn` and gains an `endpoint`, and this fails while
 *   the drawing still draws it as a file.
 */
describe('the services drawing, against the sources manifest', () => {
  const MANIFEST = readFileSync(MANIFEST_FILE, 'utf8');
  const valuesOf = (key: string): string =>
    [...MANIFEST.matchAll(new RegExp(`${key}:\\s*'([^']*)'`, 'g'))]
      .map((hit) => hit[1])
      .join(' | ');
  const STANDS_IN = valuesOf('standsIn');
  const ENDPOINTS = valuesOf('endpoint');

  /**
   * The rows the drawing draws, off the AST rather than off the file's text.
   *
   * The same reason `ports()` above is: a row written across four lines, a
   * `detail` holding a brace, a trailing comma where a semicolon was expected — a
   * regex is wrong about each of those silently, and the parser is wrong about
   * none of them. A row is an object literal carrying both a `name` and a `state`,
   * which is what the content band is built from and what nothing else in that
   * file is.
   */
  function rows(): { name: string; state: string }[] {
    const file = join(DIAGRAMS, 'Services.tsx');
    const source = ts.createSourceFile(
      'Services.tsx',
      readFileSync(file, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
    const found: { name: string; state: string }[] = [];
    const visit = (node: ts.Node): void => {
      if (ts.isObjectLiteralExpression(node)) {
        const read = (key: string): string | null => {
          const property = node.properties.find(
            (candidate): candidate is ts.PropertyAssignment =>
              ts.isPropertyAssignment(candidate) && candidate.name.getText(source) === key,
          );
          return property && ts.isStringLiteralLike(property.initializer)
            ? property.initializer.text
            : null;
        };
        const name = read('name');
        const state = read('state');
        if (name !== null && state !== null) found.push({ name, state });
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
    return found;
  }

  const ROWS = rows();

  it('finds the content rows it is about to check', () => {
    expect(ROWS.length).toBeGreaterThan(4);
    expect([...new Set(ROWS.map((row) => row.state))].toSorted()).toEqual(['live', 'sample']);
  });

  /**
   * The caption's two spelled figures, against the rows underneath them.
   *
   * The phrasing is load-bearing and deliberately so: a pattern that stops matching
   * is a fault rather than a silence, so rewording the sentence out from under the
   * check turns the suite red. That half is `numberInProse`'s, along with the word
   * and the numeral counting as the same number and the report that quotes the
   * sentence. What stays here is the two patterns and the two counts, because the
   * sentence is this drawing's and nothing general can guess it.
   *
   * It had been written out by hand here — the same word map, the same throw, and
   * a paragraph arguing for the throw that the package now carries. Converting it
   * also widened it: `exec` read the first match in the file and stopped, so a
   * second statement of the figure in the alt list would not have been compared
   * with anything, and the sweep reads every one of them.
   *
   * Whitespace is collapsed first, because the wrapping is the formatter's and not
   * the sentence's. A newline inside a JSX text node renders as one space, so
   * "three are files" broken across two lines says the same thing on the page —
   * and this threw on exactly that, after a reflow that changed no word of it.
   * The phrasing stays load-bearing; only the line breaks stop counting.
   */
  it('says how many sources are live and how many are files, and both are the number', () => {
    // A drawing spells its figures, so a numeral of the right value is a fault here
    // and says to spell it — the rule the port count above is held to as well.
    const text = readFileSync(join(DIAGRAMS, 'Services.tsx'), 'utf8').replace(/\s+/g, ' ');
    const caption = [{ name: 'Services.tsx', text }];

    expect(
      numberInProse({
        documents: caption,
        pattern: /\b(\w+) content sources are live\b/i,
        value: ROWS.filter((row) => row.state === 'live').length,
        what: 'the drawing draws live',
        spelling: 'word',
      }),
    ).toEqual([]);

    expect(
      numberInProse({
        documents: caption,
        pattern: /\b(\w+) are files\b/i,
        value: ROWS.filter((row) => row.state === 'sample').length,
        what: 'the drawing draws as files',
        spelling: 'word',
      }),
    ).toEqual([]);
  });

  it('draws as a file exactly what the manifest still stands in for', () => {
    const wrong: string[] = [];
    for (const row of ROWS) {
      const standsIn = STANDS_IN.includes(row.name);
      const endpoint = ENDPOINTS.includes(row.name);
      if (row.state === 'sample' && !standsIn) {
        wrong.push(`${row.name} is drawn as a file and no manifest entry stands in for it`);
      }
      if (row.state === 'sample' && endpoint) {
        wrong.push(`${row.name} is drawn as a file and the manifest gives it an endpoint`);
      }
      if (row.state === 'live' && standsIn) {
        wrong.push(`${row.name} is drawn live and the manifest still stands in for it`);
      }
    }
    expect(wrong).toEqual([]);
  });
});

/**
 * The drawing at fifty records, which is the size it was asked to still work at
 * and which `adr/` will not reach for a year.
 *
 * THE CHECKS ABOVE HAVE A HOLE and this is it. Two of them — the one that keeps an
 * arc inside the canvas, and the one that keeps a title clear of the column beside
 * it — cannot fail against `adr/` as it stands: the deepest nesting today still
 * divides the gutter comfortably, and the longest title in the set sits beside one
 * of the shortest voider lists, so no row is anywhere near its budget. Both were
 * verified against a deliberately broken layout and neither moved. A check with no
 * coverage is a check that will be wrong in the direction nobody looks, so the
 * input is made rather than read here.
 *
 * `chainLayout` takes records as an argument for exactly this reason. What is
 * synthetic is only the input: the function, the geometry and the invariants are
 * the ones the site renders.
 *
 * THE SHAPE OF THE SET is chosen to stress the two claims the layout makes, not to
 * look like `adr/`. Titles run to a hundred and ten characters, past anything in
 * the repository, so the truncation branch is actually taken. The strikes mix
 * neighbours with long reaches, because lane depth comes from arcs that overlap and
 * a set of short ones would nest no deeper than a set of two.
 */
const padded = (n: number): string => String(n).padStart(4, '0');

describe('the decisions drawing, at a size `adr/` has not reached', () => {
  /*
   * Past the real count by construction. It was 60, which was more than `adr/` held when
   * it was typed, and ADR 0060 made it the count exactly: the drawing of the real set
   * and of this one were then the same height and the growth assertion had nothing to
   * compare. A size the directory has not reached is a size read off the directory.
   */
  const LONG = RECORDS.length + 30;

  function synthetic(): { records: DecisionRecord[]; strikes: Strike[] } {
    const number = padded;
    const titles = [
      'One core, two hosts',
      'The handbook draws the app’s components, and the rendering that counts',
      'A decision whose heading runs on well past anything in this repository today, to take the branch that cuts a title short and marks the cut',
    ];

    const struckIn = new Map<number, number[]>();
    const strikes: Strike[] = [];
    for (let n = 2; n <= LONG; n += 1) {
      for (const [step, every] of [
        [1, 3],
        [5, 7],
        [23, 2],
        [40, 3],
      ]) {
        const target = n - step;
        if (n % every !== 0 || target < 1) continue;
        strikes.push({ by: number(n), of: number(target), claims: (n % 6) + 1 });
        struckIn.set(target, [...(struckIn.get(target) ?? []), n]);
      }
    }

    const records: DecisionRecord[] = [];
    for (let n = 1; n <= LONG; n += 1) {
      const voidedBy = (struckIn.get(n) ?? []).map(number).toSorted();
      const voids = strikes
        .filter((s) => s.by === number(n))
        .map((s) => s.of)
        .toSorted();
      records.push({
        number: number(n),
        route: `/decisions/${number(n)}`,
        title: titles[n % titles.length],
        date: '2026-09-16',
        status: 'accepted',
        standing: voidedBy.length > 0 ? 'partly-struck' : 'stands',
        note: 'accepted',
        caveats: [],
        struck: voidedBy.flatMap((by) =>
          Array.from({
            length: strikes.find((s) => s.by === by && s.of === number(n))?.claims ?? 1,
          }).map(() => ({ claim: 'a claim', clause: 'struck', by: [by] })),
        ),
        voidedBy,
        voids,
      });
    }
    return { records, strikes };
  }

  const { records, strikes } = synthetic();
  const BIG = chainLayout(records, strikes);

  it('grows downwards and not sideways', () => {
    expect(BIG.nodes.length).toBe(LONG);
    // The claim the file makes: height follows the count, width does not.
    expect(BIG.height).toBeGreaterThan(CHAIN.height);
    expect(BIG.width).toBe(CHAIN.width);
  });

  it('still gives every record a rung of its own, in order', () => {
    const ys = BIG.nodes.map((node) => node.y);
    expect(new Set(ys).size).toBe(ys.length);
    expect(ys).toEqual(ys.toSorted((a, b) => a - b));
  });

  it('still keeps every arc on the canvas, at a lane depth `adr/` has not reached', () => {
    // The point of the set: it nests deeper than the repository does, so the lane
    // packing is doing something here rather than handing out one lane each.
    expect(BIG.lanes).toBeGreaterThan(CHAIN.lanes);
    expect(BIG.arcs.length).toBe(strikes.length);
    const outside = BIG.arcs.filter((arc) =>
      [...arc.path.matchAll(/(-?[\d.]+) (-?[\d.]+)/g)].some(
        (point) => Number(point[1]) < 0 || Number(point[1]) > BIG.width,
      ),
    );
    expect(outside.map((arc) => `${arc.by} -> ${arc.of}`)).toEqual([]);
  });

  /**
   * The branch `adr/` does not take: a title too long for the room its row has.
   *
   * Both halves matter. A title that is cut has to say so, and a layout that cut
   * every title to be safe would pass an overlap check while throwing away the
   * words — so the short titles in the set have to come through whole.
   */
  it('cuts a title that does not fit, marks the cut, and leaves the rest whole', () => {
    const cut = BIG.nodes.filter((node) => node.label.endsWith('…'));
    const whole = BIG.nodes.filter((node) => node.label !== '' && node.label === node.title);
    expect(cut.length).toBeGreaterThan(0);
    expect(whole.length).toBeGreaterThan(0);

    const overlapping = BIG.nodes.filter(
      (node) =>
        node.label !== '' &&
        BIG.titleX + node.label.length * ADVANCE.title >
          BIG.rightX - node.struckByText.length * ADVANCE.mono,
    );
    expect(overlapping.map((node) => node.number)).toEqual([]);
  });
});
