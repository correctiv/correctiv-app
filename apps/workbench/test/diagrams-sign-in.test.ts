import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { PERSISTED_KEYS } from '@correctiv/app-core/stores/session';

import { PROBES, SOURCES } from '../content/sources.manifest.ts';
import { ROOT } from '../plugin/collect.ts';
import {
  CORE,
  constantValue,
  drawn,
  drawnText,
  functionBody,
  handWritten,
  interfaceMembers,
  isComment,
  parse,
  parseFragment,
  pathsDrawn,
  says,
  stringArguments,
  stringRecord,
  unionMembers,
} from './drawn.ts';

const DRAWING = 'SignIn.tsx';
const APP = join(ROOT, 'apps/mobile/src');
const AUTH = join(CORE, 'services/auth.service.ts');
const MODELS = join(CORE, 'types/models.ts');
const SESSION = join(CORE, 'stores/session.ts');
const GATE = join(APP, 'components/gate/LoginGate.tsx');

/**
 * The fifth drawing says that this repository has no sign-in, and that is a claim
 * about an absence.
 *
 * Every other drawing here is checked the ordinary way: it names a thing, the
 * thing is read off the code, the two have to agree. This one's load-bearing
 * sentence is the opposite shape — *there is no identity client anywhere* — and an
 * absence has a failure mode the presences do not. Nobody deletes it; somebody
 * adds the thing it denies, in a file three directories away, and the picture goes
 * on saying "simulated, no network" in a meeting. The first test below is
 * therefore the important one, and it fails on the day the drawing stops being
 * true rather than on the day somebody notices.
 *
 * The rest holds the figures the drawing prints against the code that decides
 * them. All of them are measured against THIS repository, which AGENTS.md names as
 * the faster of the two ways a figure goes quiet.
 */

/**
 * What an identity client looks like, whatever shape it arrives in.
 *
 * Names rather than behaviours, because a name is what a sweep can see: a token
 * exchange, a browser flow, a secret store and a bearer header all have one. The
 * list is the union of what the whiteboard proposes and what any of the obvious
 * libraries would bring with it, so an implementation of the plan below the red
 * line trips at least one of them before it can work.
 */
const IDENTITY_MARKERS = [
  'zitadel',
  'oidc',
  'oauth',
  'pkce',
  'auth-session',
  'authorize',
  'secure-store',
  'securestore',
  'keychain',
  'keystore',
  'client_secret',
  'client_id',
  'redirect_uri',
  'code_verifier',
  'refresh_token',
  'access_token',
  'bearer',
];

/** The two addresses the drawing puts BELOW the line, and may only put there. */
const PLANNED_HOSTS = ['community.correctiv.org', 'auth.community.correctiv.org'];

describe('the sign-in drawing, against the absence it draws', () => {
  /**
   * The one that matters.
   *
   * Comments are skipped on purpose: a line of prose saying the word OIDC is a
   * note about a decision, and ADR 0020 has one. What this is looking for is code
   * — an import, an identifier, a URL — and a marker that survives the comment
   * filter is a marker in something that runs.
   *
   * Generated modules are skipped for the reason `handWritten` gives: the cover
   * bundle is 642 KB of base64 and contains the letters `pKCE` inside a picture.
   */
  it('finds no identity client in the core or the app, which is the drawing', () => {
    const offenders: string[] = [];
    for (const file of [...handWritten(CORE), ...handWritten(APP)]) {
      const text = readFileSync(file, 'utf8');
      for (const [index, line] of text.split('\n').entries()) {
        if (isComment(line)) continue;
        const lower = line.toLowerCase();
        for (const marker of IDENTITY_MARKERS) {
          if (lower.includes(marker)) {
            // The sentence lives in the offender rather than in a message
            // argument, which oxlint's jest rules do not allow: whoever this
            // fails on has to be told what it is about and what to do.
            offenders.push(
              `redraw SignIn.tsx, a real sign-in has arrived: ` +
                `${file.slice(ROOT.length + 1)}:${index + 1} says ${marker}`,
            );
          }
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  /**
   * And the two hostnames, which the drawing is allowed to print only because
   * nothing here reaches them.
   *
   * Asked of the source inventory as well as of the code. `SOURCES.md` and the
   * manifest beside it are the record of every source the app reads; an identity
   * host that had become one would have a row there, and the drawing putting it
   * below a line labelled "nothing below this exists" would be wrong in the
   * loudest possible way.
   */
  it('reaches neither planned host, in the code or in the source inventory', () => {
    const offenders: string[] = [];
    for (const file of [...handWritten(CORE), ...handWritten(APP)]) {
      const text = readFileSync(file, 'utf8');
      for (const host of PLANNED_HOSTS) {
        if (text.includes(host)) offenders.push(`${file.slice(ROOT.length + 1)}: ${host}`);
      }
    }
    for (const entry of SOURCES) {
      const written = [entry.endpoint, entry.standsIn, entry.note].join(' ');
      for (const host of PLANNED_HOSTS) {
        if (written.includes(host)) offenders.push(`sources.manifest.ts ${entry.id}: ${host}`);
      }
    }
    for (const probe of PROBES.values()) {
      for (const host of PLANNED_HOSTS) {
        if (probe.url.includes(host)) offenders.push(`the measured run, ${probe.id}: ${host}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('draws both of them, since the whole point is that they are not here', () => {
    const text = drawnText(DRAWING);
    for (const host of PLANNED_HOSTS) expect(text).toContain(host);
  });
});

describe('the sign-in drawing, against the simulation it draws', () => {
  it('prints the delay, the password floor and the trial the seam actually uses', () => {
    const source = parse(AUTH);
    const text = drawnText(DRAWING);

    expect(says(text, `${constantValue(source, 'SIGN_IN_DELAY_MS')} ms`)).toBe(true);
    expect(says(text, `under ${constantValue(source, 'MIN_PASSWORD_LENGTH')} characters`)).toBe(
      true,
    );
    expect(says(text, `${constantValue(source, 'TRIAL_DAYS')} days`)).toBe(true);
  });

  /**
   * The failure condition has two halves, and the drawing shipped with one.
   *
   * `simulatedSignIn` refuses a password under the floor OR an address with no
   * `@` in it, and the picture said only the first. That is not a wrong statement,
   * which is precisely why it survived a fact-check of every other line: a drawing
   * printing one of two disjuncts is right about the disjunct it prints, and a
   * reader takes it as the whole condition.
   *
   * Both halves are read out of the function rather than typed here. The floor
   * comes back as its constant; the `@` comes back as the argument to the
   * `includes` call that guards the credential check, which is the same reading the
   * rules test above does inside `simulatedEntitlement` and deliberately does not
   * do here. So a third condition added to that `if` leaves this green, and either
   * of the two being dropped from the picture does not.
   */
  it('names both halves of what makes a sign-in fail, not the password alone', () => {
    const source = parse(AUTH);
    const guards = stringArguments(
      parseFragment(functionBody(source, 'simulatedSignIn')),
      'address',
      'includes',
    );
    expect(guards).toEqual(['@']);

    const text = drawnText(DRAWING);
    expect(says(text, `under ${constantValue(source, 'MIN_PASSWORD_LENGTH')} characters`)).toBe(
      true,
    );
    expect(text).toContain('@');
  });

  /**
   * Both directions, because the drawing is a summary of a table and a summary is
   * the kind of thing that goes one row short.
   *
   * The rules are read off the calls that branch on them inside
   * `simulatedEntitlement`, and inside that function only: `simulatedSignIn` asks
   * the same question of the same local for a different reason, the `@` that makes
   * an address an address, and that one is a credential check rather than a tier.
   * A renamed local would make this find nothing, which is why the count is
   * asserted before the comparison.
   */
  it('names every address the simulation branches on, and no other', () => {
    const source = parse(AUTH);
    const rules = stringArguments(
      parseFragment(functionBody(source, 'simulatedEntitlement')),
      'address',
      'includes',
    );
    expect(rules.length).toBeGreaterThan(2);

    const text = drawnText(DRAWING);
    expect(rules.filter((rule) => !drawn(text, rule))).toEqual([]);

    // The other direction is asked of the drawing's own mono labels, which is
    // where a rule is written: a lowercase word inside a sentence is not a claim
    // about the directory, and this reads the markup rather than the prose. If the
    // formatter ever breaks that pattern this finds nothing and says so, rather
    // than passing on an empty list.
    const drawingSource = readFileSync(join(ROOT, 'apps/workbench/src/diagrams', DRAWING), 'utf8');
    const svg = /<svg[\s\S]*<\/svg>/.exec(drawingSource)?.[0] ?? '';
    const labelled = [...svg.matchAll(/<tspan className=\{MONO\}>\s*([a-z]+)\s*<\/tspan>/g)].map(
      (match) => match[1],
    );
    expect(labelled.length).toBe(rules.length);
    expect(labelled.filter((label) => !rules.includes(label))).toEqual([]);
  });

  it('names the four states the door has, and no fifth', () => {
    const states = unionMembers(parse(SESSION), 'SessionStatus');
    const text = drawnText(DRAWING);

    expect(states.filter((state) => !drawn(text, state))).toEqual([]);
    // A state that has left the type must leave the picture with it. The
    // candidates are the four spellings this vocabulary has ever used; a status
    // named something else entirely is the case the positive half above catches.
    const retired = ['guest', 'anonymous', 'expired', 'locked'].filter(
      (word) => !states.includes(word),
    );
    expect(retired.filter((word) => drawn(text, word))).toEqual([]);
  });
});

describe('the sign-in drawing, against the answer it draws', () => {
  it('lists every field of the entitlement the door reads', () => {
    const fields = interfaceMembers(parse(MODELS), 'Entitlement');
    const text = drawnText(DRAWING);
    expect(fields.filter((field) => !drawn(text, field))).toEqual([]);
  });

  it('lists every field of the account', () => {
    const fields = interfaceMembers(parse(MODELS), 'Account');
    const text = drawnText(DRAWING);
    expect(fields.filter((field) => !drawn(text, field))).toEqual([]);
  });

  /**
   * The drawing says "No amount anywhere", which is ADR 0016's decision and the
   * reason the door reads an entitlement at all: a trial pays 0 € and has the app.
   * The sentence is true exactly as long as no amount is on the type.
   */
  it('is right that there is no amount on the entitlement', () => {
    const fields = interfaceMembers(parse(MODELS), 'Entitlement');
    expect(fields.filter((field) => /amount|eur|price|contribution/i.test(field))).toEqual([]);
  });

  it('names what the session persists, and nothing it does not', () => {
    const text = drawnText(DRAWING);
    expect(PERSISTED_KEYS.filter((key) => !drawn(text, key))).toEqual([]);
    // Two keys, and the drawing spells them as a pair. A third would make the
    // sentence "account and entitlement" a wrong list rather than a short one.
    expect(PERSISTED_KEYS).toHaveLength(2);
  });

  /**
   * The one address in the drawing, which is also the only address the door has.
   *
   * Three links to one page is a fact worth drawing and an easy one to leave
   * behind: the moment the membership system names a reset address, one of these
   * three changes and the sentence under it stops being true.
   */
  it('prints the address the door opens, and is right that all three are one', () => {
    const links = Object.values(stringRecord(parse(GATE), 'LINKS'));
    expect(links.length).toBeGreaterThan(1);
    expect(new Set(links).size).toBe(1);
    expect(drawnText(DRAWING)).toContain(links[0]);
  });

  it('names no file that is not there', () => {
    const { named, missing } = pathsDrawn(drawnText(DRAWING));
    expect(named.length).toBeGreaterThan(1);
    expect(missing).toEqual([]);
  });
});
