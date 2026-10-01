/**
 * The desktop route tree may not drift from the phone's.
 *
 * This host re-exports the app's screens rather than forking them, which is what keeps
 * it cheap — but a re-export is a file, and a file is something a new screen on `main`
 * will not create. Without this test the failure mode is the quiet one: a route exists
 * on the phone, is simply absent here, and the desktop build stays green while a screen
 * is missing.
 *
 * That is the same shape as `apps/mobile/__tests__/web-target.test.ts`, which exists
 * because a broken route and a working export look identical from the outside.
 */

import { readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const MOBILE_ROUTES = resolve(__dirname, '..', '..', 'mobile', 'src', 'app');
const DESKTOP_ROUTES = resolve(__dirname, '..', 'src', 'app');

/**
 * Route files on the phone that this host deliberately does NOT mirror.
 *
 * `.web.tsx` is not a route: it is the web target's variant, and `.web` is never in
 * the GTK platform-resolution chain (ADR 0032 section 9 — it "looks like the right
 * choice for a desktop target and carries exactly the DOM assumptions this design
 * rules out").
 *
 * `+html.tsx` is not a route either, and it is the clearer case of the two: it is the
 * `<html>` shell expo-router renders the static web export INTO, so what it holds is a
 * document — the own-document mark, the viewport meta, the `lang` attribute. There is no
 * document on this host at all, and a re-export of it would be a file that can never be
 * reached.
 */
const NOT_A_DESKTOP_ROUTE = ['(tabs)/_layout.web.tsx', '+html.tsx'];

function routeFiles(dir: string, prefix = ''): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return routeFiles(full, `${prefix}${entry}/`);
    return entry.endsWith('.tsx') ? [`${prefix}${entry}`] : [];
  });
}

describe('the desktop route tree', () => {
  const mobile = routeFiles(MOBILE_ROUTES).sort();
  const desktop = routeFiles(DESKTOP_ROUTES).sort();

  it('finds both trees', () => {
    expect(mobile.length).toBeGreaterThan(20);
    expect(desktop.length).toBeGreaterThan(20);
  });

  it('has a file for every route the phone has', () => {
    const expected = mobile.filter((file) => !NOT_A_DESKTOP_ROUTE.includes(file));
    expect(desktop).toEqual(expected);
  });

  it('has no route the phone does not', () => {
    // The other direction. A desktop-only screen is not forbidden in principle, but it
    // would be a product decision rather than a port, so it should not appear by
    // accident — and this is where someone would have to say so.
    const orphans = desktop.filter((file) => !mobile.includes(file));
    expect(orphans).toEqual([]);
  });
});
