/**
 * The door, in this host's own root layout.
 *
 * ADR 0016 makes admission a RENDER BRANCH rather than a redirect: while the session
 * is not admitted the root layout renders `LoginGate` INSTEAD of the navigator, so no
 * route is mounted and there is nothing to deep-link to, share or press back into. A
 * host that keeps the navigator mounted and redirects instead has not implemented that
 * decision, it has implemented a suggestion.
 *
 * This host is where that goes wrong quietly. It re-exports the phone's screens, so a
 * screen arrives here by existing; the root layout does not, and it went ten commits
 * with the navigator mounted unconditionally while every screen and every test was
 * green. The failure has no symptom on the machine of whoever is already admitted,
 * which is every machine this host currently runs on.
 *
 * WHAT THIS READS, AND WHY IT IS THE SOURCE. There is no GTK in `npm run check` and no
 * React renderer in this workspace: `_layout.tsx` reaches `gi://Gtk` through three
 * different imports before it reaches a component, so rendering it here would mean
 * faking the host and then testing the fake. The other three suites in this directory
 * made the same call for the same reason. So the assertions below are about the file's
 * TEXT, and they are written against the phone's file as well as this one — an oracle
 * that can rot silently is the failure this whole directory exists to avoid, so the
 * last test checks that the phone still has a door in the shape being compared to.
 *
 * WHAT IT DOES NOT PROVE: that the gate RENDERS on GTK. That is `npm run route-sweep`
 * and a capture; the gate's imports are covered by `test/support-gate.test.ts`, which
 * reads the phone's whole source tree against the published support table.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const DESKTOP_LAYOUT = resolve(__dirname, '..', 'src', 'app', '_layout.tsx');
const MOBILE_LAYOUT = resolve(__dirname, '..', '..', 'mobile', 'src', 'app', '_layout.tsx');

/** The two branches of `admitted ? ( … ) : ( … )`, or null when there is no such branch. */
function doorBranches(source: string): { open: string; closed: string } | null {
  const start = source.indexOf('admitted ? (');
  if (start === -1) return null;
  const open = balanced(source, source.indexOf('(', start));
  if (open === null) return null;
  const colon = source.indexOf(':', open.end);
  if (colon === -1) return null;
  const closed = balanced(source, source.indexOf('(', colon));
  if (closed === null) return null;
  return { open: open.text, closed: closed.text };
}

/**
 * The text between `(` at `from` and the `)` that closes it.
 *
 * Counting parentheses rather than matching a regex: both branches are JSX with nested
 * calls and comments in them, and `/\(([^)]*)\)/` would stop at the first `)` inside
 * either. It returns null rather than a partial match, so a malformed file fails the
 * test above instead of passing a truncated branch to it.
 */
function balanced(source: string, from: number): { text: string; end: number } | null {
  if (from === -1) return null;
  let depth = 0;
  for (let index = from; index < source.length; index++) {
    if (source[index] === '(') depth++;
    else if (source[index] === ')') {
      depth--;
      if (depth === 0) return { text: source.slice(from + 1, index), end: index };
    }
  }
  return null;
}

const desktop = readFileSync(DESKTOP_LAYOUT, 'utf8');
const mobile = readFileSync(MOBILE_LAYOUT, 'utf8');

describe('the desktop root layout puts the door at the root', () => {
  it('asks the question, and asks it the way the phone does', () => {
    // The entitlement, not the contribution: `useIsAdmitted` is the selector ADR 0016
    // names, and reading `membership` instead would lock out a trial, which pays 0 €
    // and has the app.
    expect(desktop).toContain('useIsAdmitted()');
    expect(desktop).toContain("from '@/components/gate/LoginGate'");
  });

  it('renders the gate INSTEAD of the navigator, not beside it', () => {
    const door = doorBranches(desktop);
    expect(door).not.toBeNull();
    expect(door!.open).toContain('<Stack>');
    expect(door!.closed).toContain('<LoginGate />');
    // The half that makes it a door: neither branch may contain the other's subject.
    // A layout that mounted the navigator AND showed the gate over it would satisfy
    // every assertion above and would still leave every route reachable.
    expect(door!.open).not.toContain('<LoginGate');
    expect(door!.closed).not.toContain('<Stack');
  });

  it('mounts the navigator nowhere else', () => {
    // The branch is only a door if it is the ONLY way in. Counted rather than located,
    // because a second `<Stack>` anywhere in this file would be a second entrance.
    const door = doorBranches(desktop);
    const occurrences = desktop.split('<Stack>').length - 1;
    expect(occurrences).toBe(1);
    expect(door!.open.split('<Stack>').length - 1).toBe(1);
  });

  it('decides nothing behind the door until the door is open', () => {
    // The onboarding jump and `CORRECTIV_DESKTOP_ROUTE` both replace a route, and
    // there is no navigator to replace one in while the gate is up. ADR 0016: the
    // onboarding is the first thing behind the door, not something in front of it.
    expect(desktop).toContain('if (!storeReady || !admitted || gated.current) return;');
  });

  it('hydrates the slice the door reads', () => {
    // A door reading a slice that hydrates late shows the sign-in form to a returning
    // member for a frame, which is worse than no door for the person holding the
    // phone. The descriptor list is the only thing that prevents it.
    expect(desktop).toContain("persisted<SessionState>('session', SESSION_KEYS");
  });
});

/**
 * The recovery screen, and why this host needs a test for having one at all.
 *
 * On the phone the catching is expo-router's: a route that also exports
 * `ErrorBoundary` is wrapped in `Try`, so the phone's export is the whole mechanism.
 * This host's `expo-router` is a shim with no `Try`, so that export is INERT here and
 * the boundary has to be built. Nothing about a missing one is visible: the app looks
 * identical until the first refusal, and then it dies whole — which is exactly what
 * happened when three `<Typo onPress>` rows ended the tree and took
 * `CORRECTIV_DESKTOP_ROUTE` with them.
 *
 * Text assertions, for the reason this file's header gives about all of them: there is
 * no React renderer in this workspace and `_layout.tsx` reaches `gi://Gtk` before it
 * reaches a component.
 */
describe('the recovery screen', () => {
  it('is caught for, because the router here catches nothing', () => {
    expect(desktop).toContain('getDerivedStateFromError');
    expect(desktop).toContain("from '@/components/recovery/RecoveryScreen'");
  });

  it('wraps the environment, not just the screens under it', () => {
    // ABOVE the providers, so a throw from the Redux `Provider`'s own render, from the
    // `IntlProvider` beside it and from everything in `AppShell` — the hydration
    // effect, the appearance, the door — reaches it.
    //
    // NOT the store's construction: `coreStore` is a module-scope `export const`, so
    // that throws during module evaluation and no boundary catches it. This assertion
    // used to carry that wrong reason, which is the kind of thing a reader acts on.
    //
    // `<AppEnvironment>` where this read `<Provider store={coreStore}>` until the merge
    // of main after #301: the phone moved its provider list into one component so its
    // second host could not keep a divergent copy, and this host mounts the same one
    // rather than writing a third. The property being asserted did not change.
    const boundary = desktop.indexOf('<RecoveryBoundary>');
    const environment = desktop.indexOf('<AppEnvironment>');
    expect(boundary).toBeGreaterThan(-1);
    expect(environment).toBeGreaterThan(boundary);
  });

  it("mounts the phone's environment rather than a provider list of its own", () => {
    // The drift this guards against is the one ADR 0028 measured on the phone's second
    // host: the workbench held its own `Provider` and `SafeAreaProvider`, loaded no
    // font at all, and every component drew in the browser's default serif with no
    // check saying so. A third host writing the list out again is the same defect
    // waiting for a different symptom, and the react-intl provider makes it louder —
    // a screen with no `IntlProvider` above it throws on its first German word.
    expect(desktop).toContain("from '@/lib/env/AppEnvironment'");
    expect(desktop).not.toContain('<Provider store={coreStore}>');
    expect(mobile).toContain('<AppEnvironment>');
  });

  it("draws the phone's screen rather than a second copy of its German", () => {
    // The screen lives in `apps/mobile/src/components/recovery/` precisely so both
    // hosts render one copy. A desktop-local recovery screen would be a second place
    // for the same three sentences to drift.
    expect(desktop).toContain('<RecoveryScreen detail={detail} onRetry={this.retry} />');
    expect(desktop).not.toContain('Die App ist stehen geblieben');
  });
});

describe('the comparison this suite rests on', () => {
  it('finds the same door in the phone, so the shape above still describes one', () => {
    // Guards the oracle. If the phone moves the door — to a hook, a wrapper component,
    // a different selector — the assertions above stop describing anything and would
    // otherwise keep passing against a desktop file that had also drifted.
    const door = doorBranches(mobile);
    expect(door).not.toBeNull();
    expect(door!.closed).toContain('<LoginGate />');
    expect(mobile).toContain('useIsAdmitted()');
  });
});
