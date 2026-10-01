import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { HOME_PINS } from '@correctiv/app-core/data/home-pins';
import { readerOf } from '@correctiv/app-core/lib/home-audience';
import { berlinInstant, parseBerlinDateTime } from '@correctiv/app-core/lib/berlin-time';
import {
  HOME_LAYOUT_VERSION,
  parseHomeLayout,
  sectionsAtInstant,
  type HomeLayout,
  type ModuleSettings,
} from '@correctiv/app-core/lib/home-layout';
import { MODULE_SETTINGS } from '@correctiv/app-core/lib/home-settings.generated';

import { ROOT } from '../../plugin/collect.ts';
import { parseAddress, writeAddress } from '../../src/shell/address';
import { VIEWS } from '../../src/shell/views';
import { entitlementIn, FIXTURES, sessionSnapshot } from '../../src/preview/frame/seed';
import {
  formatLayoutDocument,
  MODULE_LABELS,
  SHIPPED,
  withHidden,
} from '../../src/preview/home/document';
import {
  arriving,
  entering,
  exiting,
  guarded,
  heldOf,
  leaving,
  loading,
  scenarioIn,
} from '../../src/preview/home/scenario';
import { layoutOf, SCENARIOS, scenarioNamed } from '../../src/preview/scenarios';
import { fromAddress, INITIAL, toAddress, type PreviewState } from '../../src/preview/state';

/**
 * ADR 0036 §11 to §13: named scenarios, in the repository, the same file as a real
 * configuration, each saying whether it is live or sample.
 */
const DIR = join(ROOT, 'apps/workbench/content/scenarios');
const FILES = readdirSync(DIR).filter((name) => name.endsWith('.json'));
/** What the submission workflow hands the parser, so a misspelt module fails here too. */
const RENDERABLE: ReadonlySet<string> = new Set(Object.keys(MODULE_LABELS));

const VIEW = VIEWS.preview;
const read = (hash: string): PreviewState => fromAddress(parseAddress(hash, VIEW));
const write = (state: PreviewState): string => {
  const { head, rest } = toAddress(state);
  return writeAddress({ head, rest, tool: null, full: false }, VIEW);
};

const instant = (value: string) => {
  const clock = parseBerlinDateTime(value);
  if (!clock) throw new Error(`not a Berlin date and time: ${value}`);
  return berlinInstant(clock.date, clock.minute)!;
};

/** The reader a fixture puts in the frame, as the editor works it out from storage. */
function readerIn(fixture: string) {
  const held = new Map<string, string>();
  const store = {
    getItem: (key: string) => held.get(key) ?? null,
    setItem: (key: string, value: string) => void held.set(key, value),
    removeItem: (key: string) => void held.delete(key),
  } as unknown as Storage;
  FIXTURES.find((f) => f.id === fixture)!.write(store);
  return readerOf(entitlementIn(sessionSnapshot(store)));
}

/** Every article a document pins, wherever in it the pin is written. */
function pins(layout: HomeLayout): string[] {
  const modules = new Map(layout.sections.map((section) => [section.id, section.module]));
  const found: string[] = [];
  const take = (id: string, settings: ModuleSettings | undefined) => {
    for (const spec of MODULE_SETTINGS[modules.get(id) ?? ''] ?? []) {
      const value = settings?.[spec.key];
      if (spec.kind === 'article' && typeof value === 'string') found.push(value);
    }
  };
  for (const section of layout.sections) take(section.id, section.settings);
  const changes = [
    ...layout.moments.flatMap((moment) => moment.changes),
    ...layout.editions.flatMap((edition) => [
      ...edition.changes,
      ...edition.moments.flatMap((moment) => moment.changes),
    ]),
  ];
  for (const change of changes) take(change.id, change.settings);
  return found;
}

describe('the scenarios in the repository', () => {
  it('finds scenario files at all (guards against an empty folder)', () => {
    expect(FILES.length).toBeGreaterThan(0);
  });

  it('has one table entry per file, and one file per table entry', () => {
    expect(SCENARIOS.map((scenario) => `${scenario.name}.json`).sort()).toEqual([...FILES].sort());
    for (const scenario of SCENARIOS) {
      const file = JSON.parse(readFileSync(join(DIR, `${scenario.name}.json`), 'utf8'));
      expect(scenario.document).toEqual(file);
    }
  });

  it.each(SCENARIOS.map((scenario) => [scenario.name, scenario] as const))(
    '%s is a document the core reads without a single problem, at the current version',
    (_, scenario) => {
      const { layout, problems } = parseHomeLayout(scenario.document, RENDERABLE);
      expect(problems).toEqual([]);
      expect(layout?.version).toBe(HOME_LAYOUT_VERSION);
      expect(layoutOf(scenario)).not.toBeNull();
    },
  );

  /*
   * The same file as a real configuration (§12): printed as the editor's printer prints the
   * shipped one, so promoting it is copying it and the diff is the change and nothing else.
   */
  it.each(SCENARIOS.map((scenario) => [scenario.name, scenario] as const))(
    '%s is printed exactly as the printer prints it',
    (_, scenario) => {
      const text = readFileSync(join(DIR, `${scenario.name}.json`), 'utf8');
      expect(text).toBe(formatLayoutDocument(layoutOf(scenario)!));
    },
  );

  it.each(SCENARIOS.map((scenario) => [scenario.name, scenario] as const))(
    '%s opens at a real instant, as a fixture that exists, inside one of its own editions',
    (_, scenario) => {
      expect(FIXTURES.map((fixture) => fixture.id)).toContain(scenario.session);
      const at = instant(scenario.opensAt);
      const running = layoutOf(scenario)!.editions.filter(
        (edition) => edition.start <= at && at < edition.end,
      );
      expect(running.length).toBeGreaterThan(0);
    },
  );

  /*
   * `scenarioIn` recognises a scenario by an edition id, which keeps an edited scenario from
   * being submitted. An id the shipped file or another scenario also has would guard the
   * wrong document, or none.
   */
  it('gives every scenario an edition id no other document carries', () => {
    const shipped = new Set(SHIPPED.editions.map((edition) => edition.id));
    const seen = new Set<string>();
    for (const scenario of SCENARIOS) {
      const ids = layoutOf(scenario)!.editions.map((edition) => edition.id);
      expect(ids.length).toBeGreaterThan(0);
      for (const id of ids) {
        expect(shipped.has(id)).toBe(false);
        expect(seen.has(id)).toBe(false);
        seen.add(id);
      }
      expect(scenarioIn(layoutOf(scenario)!)).toBe(scenario);
    }
    expect(scenarioIn(SHIPPED)).toBeNull();
  });

  /* §13: "sample" is a promise that what the scenario leads with cannot move. */
  it('pins only fixed sample articles in a scenario that says it uses sample data', () => {
    const sample = new Set(HOME_PINS.map((item) => item.url));
    for (const scenario of SCENARIOS.filter((s) => s.content === 'sample')) {
      const pinned = pins(layoutOf(scenario)!);
      expect(pinned.length).toBeGreaterThan(0);
      for (const url of pinned) expect(sample.has(url)).toBe(true);
    }
  });
});

describe('the election night', () => {
  const scenario = scenarioNamed('wahlabend')!;
  const layout = layoutOf(scenario)!;
  const member = readerIn(scenario.session);
  const drawn = (at: string) => sectionsAtInstant(layout, instant(at), member);
  const ids = (at: string) => drawn(at).map((section) => section.id);

  it('is seen as a paying member', () => {
    expect(member.has('paying-members')).toBe(true);
  });

  it('says in its own words that it is an example', () => {
    expect(layout.editions[0]?.title).toContain('Beispiel');
  });

  it('runs from 18:00 on the election day until 02:00 the next day', () => {
    expect(layout.editions.map(({ from, until }) => ({ from, until }))).toEqual([
      { from: '2030-09-29T18:00', until: '2030-09-30T02:00' },
    ]);
    // Sunday, so it reads as an election day.
    expect(new Date(Date.UTC(2030, 8, 29)).getUTCDay()).toBe(0);
  });

  it('is the ordinary day before it starts', () => {
    expect(ids('2030-09-29T17:59')).not.toContain('fact-checks-lifted');
    expect(ids('2030-09-29T17:59')).toContain('fact-checks');
  });

  it('opens at 18:30 with a pinned hero, the fact checks lifted above it and the Mediathek on', () => {
    expect(scenario.opensAt).toBe('2030-09-29T18:30');
    const at = ids(scenario.opensAt);
    expect(at).toContain('fact-checks-lifted');
    expect(at).not.toContain('fact-checks');
    expect(at.indexOf('fact-checks-lifted')).toBeLessThan(at.indexOf('hero'));
    expect(at).toContain('mediathek');
    const hero = drawn(scenario.opensAt).find((section) => section.id === 'hero');
    expect(hero?.settings?.pin).toBe(HOME_PINS[0]?.url);
  });

  it('hides the Mediathek at 23:00, and is over at 02:00', () => {
    expect(ids('2030-09-29T22:59')).toContain('mediathek');
    expect(ids('2030-09-29T23:00')).not.toContain('mediathek');
    expect(ids('2030-09-30T01:59')).not.toContain('mediathek');
    expect(ids('2030-09-30T02:00')).toContain('mediathek');
    expect(ids('2030-09-30T02:00')).not.toContain('fact-checks-lifted');
  });

  it('keeps the day a whole home screen on its own (ADR 0059 §5)', () => {
    const day = { ...layout, editions: [] };
    expect(sectionsAtInstant(day, instant(scenario.opensAt), member).map((s) => s.id)).toEqual(
      sectionsAtInstant(SHIPPED, instant(scenario.opensAt), member).map((s) => s.id),
    );
  });
});

describe('a scenario in the address', () => {
  const scenario = scenarioNamed('wahlabend')!;

  it('opens at the scenario’s instant, as its session, from the name alone', () => {
    const state = read('#/?sc=wahlabend');
    expect(state.scenario).toBe('wahlabend');
    expect(state.time).toBe(scenario.opensAt);
    expect(state.seed).toBe(scenario.session);
  });

  it('lets a time and a session written beside it win', () => {
    const state = read('#/?sc=wahlabend&tm=2030-09-29T23:30&s=free-member');
    expect(state.time).toBe('2030-09-29T23:30');
    expect(state.seed).toBe('free-member');
    expect(read('#/?sc=wahlabend&s=').seed).toBeNull();
  });

  it('writes the name and nothing the name already implies', () => {
    const opened = { ...INITIAL, ...entering(scenario, INITIAL, 'load') };
    expect(write(opened)).toBe('#/?d=iphone-15-pro&sc=wahlabend');
    expect(read(write(opened))).toEqual(opened);

    const moved = { ...opened, time: '2030-09-29T23:30' };
    expect(write(moved)).toContain('tm=2030-09-29T23%3A30');
    expect(read(write(moved))).toEqual(moved);

    // Switching the scenario's session off has to survive the link as well.
    const unseeded = { ...opened, seed: null };
    expect(read(write(unseeded))).toEqual(unseeded);
  });

  it('reads a name nothing answers to as no scenario, and the link still opens', () => {
    const state = read('#/?sc=nothing&tm=18:30');
    expect(state.scenario).toBeNull();
    expect(state.time).toBe('18:30');
    expect(state.seed).toBeNull();
  });

  it('takes its time and its own session with it when it is left from a cold link', () => {
    const opened = { ...read('#/?sc=wahlabend'), time: '2030-09-29T23:30' };
    expect(exiting(opened, null)).toEqual({ scenario: null, time: null, seed: null });
    expect(exiting({ ...opened, seed: 'free-member' }, null).seed).toBe('free-member');
  });
});

/* A reviewer of #253: opening one from the list threw away the person's own `tm=` and `s=`. */
describe('the person’s own time and session', () => {
  const scenario = scenarioNamed('wahlabend')!;
  const before: PreviewState = { ...INITIAL, time: '12:00', seed: 'free-member' };

  it('stay as they are while the scenario is only asking', () => {
    expect(entering(scenario, before, 'ask')).toEqual({
      scenario: 'wahlabend',
      time: '12:00',
      seed: 'free-member',
    });
  });

  it('give way to the scenario’s once it loads', () => {
    expect(entering(scenario, before, 'load')).toEqual({
      scenario: 'wahlabend',
      time: scenario.opensAt,
      seed: scenario.session,
    });
    expect(loading(scenario)).toEqual({ time: scenario.opensAt, seed: scenario.session });
  });

  it('come back when the scenario is left, however far the playhead moved inside it', () => {
    const held = heldOf(before);
    const opened = { ...before, ...entering(scenario, before, 'load'), time: '2030-09-29T23:30' };
    expect(exiting(opened, held)).toEqual({ scenario: null, time: '12:00', seed: 'free-member' });
    const none = heldOf(INITIAL);
    expect(exiting({ ...INITIAL, ...entering(scenario, INITIAL, 'load') }, none)).toEqual({
      scenario: null,
      time: null,
      seed: null,
    });
  });
});

describe('opening a scenario never takes a person’s work without asking', () => {
  const scenario = layoutOf(scenarioNamed('wahlabend')!)!;
  const work = withHidden(SHIPPED, null, 'briefing', true);

  it('loads over the shipped file, and does nothing over itself', () => {
    expect(arriving(SHIPPED, scenario)).toBe('load');
    expect(arriving(scenario, scenario)).toBe('there');
  });

  it('asks before replacing somebody’s own changes, the scenario’s own edited included', () => {
    expect(arriving(work, scenario)).toBe('ask');
    expect(arriving(withHidden(scenario, null, 'briefing', true), scenario)).toBe('ask');
  });

  it('goes back to the file on leaving an untouched scenario, and keeps an edited one', () => {
    expect(leaving(scenario, scenario)).toBe(SHIPPED);
    expect(leaving(withHidden(scenario, null, 'briefing', true), scenario)).toBeNull();
    expect(leaving(work, scenario)).toBeNull();
  });
});

/*
 * The wiring, which the rule above cannot see: a review of #253 asked what would fail if the
 * button lost `!guarded`, and the answer was nothing. Read out of the source, sliced to the
 * two expressions that decide, because a whole-file `toContain` passes on a comment.
 */
describe('the editor’s two ways out, as HomeDocument.tsx wires them', () => {
  const file = readFileSync(join(ROOT, 'apps/workbench/src/preview/home/HomeDocument.tsx'), 'utf8');
  const between = (start: string, end: string) => {
    const from = file.indexOf(start);
    expect(from).toBeGreaterThan(-1);
    const to = file.indexOf(end, from + start.length);
    expect(to).toBeGreaterThan(from);
    return file.slice(from, to);
  };

  it('offers Submit changes only for a document that is not guarded', () => {
    const offer = between('const offer =', ';');
    expect(offer.replace(/\s+/g, ' ')).toContain('dirty && !guarded ?');
  });

  it('switches Save off for a guarded document, and says why under it', () => {
    const save = between('{canSave && (', '</Button>');
    expect(/disabled=\{!dirty \|\| guarded\}/.test(save)).toBe(true);
    const block = between('{canSave && (', 'A refusal is a red fill');
    expect(block).toContain('{guarded && (');
    expect(block).toContain('COPY.scenarioGuard');
  });
});

describe('Submit changes, while a scenario is open or still in the document', () => {
  const scenario = layoutOf(scenarioNamed('wahlabend')!)!;

  it('is switched off while the address has a scenario open, whatever the document is', () => {
    expect(guarded('wahlabend', scenario)).toBe(true);
    expect(guarded('wahlabend', withHidden(SHIPPED, null, 'briefing', true))).toBe(true);
  });

  it('stays off for an edited scenario after the address has let go of it', () => {
    expect(guarded(null, withHidden(scenario, null, 'briefing', true))).toBe(true);
  });

  it('is on for an ordinary document, and for the scenario once its edition is gone', () => {
    expect(guarded(null, withHidden(SHIPPED, null, 'briefing', true))).toBe(false);
    expect(guarded(null, { ...scenario, editions: [] })).toBe(false);
    expect(guarded('nothing', SHIPPED)).toBe(false);
  });
});
