import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { EXAMPLE_LAYOUT, LAYOUTS, layoutBundle, orderLayouts } from '../src/data/layouts/registry';
import { SHIP_SCREENS } from '../src/data/layouts/ship/bundle';
import {
  isLayoutId,
  isScreenId,
  layoutIdFault,
  screenIdFault,
  SHIPPED_LAYOUT,
} from '../src/lib/screen-layout';

const LAYOUTS_DIR = new URL('../src/data/layouts/', import.meta.url).pathname;
const JOIN = new URL('../scripts/join-screen-layouts.ts', import.meta.url).pathname;
const CHECK = new URL('../scripts/check-screen-layouts.ts', import.meta.url).pathname;
const REPO = new URL('../../../', import.meta.url).pathname;

const layouts = readdirSync(LAYOUTS_DIR).filter((name) =>
  statSync(join(LAYOUTS_DIR, name)).isDirectory(),
);
const screensOf = (layout: string) =>
  readdirSync(join(LAYOUTS_DIR, layout, 'screens'))
    .filter((name) => name.endsWith('.json'))
    .map((name) => name.slice(0, -'.json'.length))
    .sort();

const directories: string[] = [];
afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true });
});

function run(script: string, ...args: string[]): { code: number; output: string } {
  try {
    const output = execFileSync('npx', ['tsx', script, ...args], {
      encoding: 'utf8',
      stdio: 'pipe',
    });
    return { code: 0, output };
  } catch (error) {
    const failure = error as { status: number; stdout: string; stderr: string };
    return { code: failure.status, output: `${failure.stdout}${failure.stderr}` };
  }
}

describe('the layout folders (ADR 0078 §1)', () => {
  it('are ship and demo, each with a navigation and a screens folder', () => {
    expect(layouts).toEqual(['demo', 'ship']);
    for (const layout of layouts) {
      expect(isLayoutId(layout)).toBe(true);
      expect(existsSync(join(LAYOUTS_DIR, layout, 'navigation.json'))).toBe(true);
      expect(existsSync(join(LAYOUTS_DIR, layout, 'screens'))).toBe(true);
    }
  });

  it('give every screen file a valid screen id', () => {
    for (const layout of layouts)
      for (const id of screensOf(layout)) expect(isScreenId(id)).toBe(true);
  });
});

describe('what the app bundles (ADR 0078 §3)', () => {
  it('is the ship layout, and its bundle names the files its folder holds', () => {
    expect(SHIPPED_LAYOUT).toBe('ship');
    expect(Object.keys(SHIP_SCREENS).sort()).toEqual(screensOf(SHIPPED_LAYOUT));
  });

  it('never imports the demo layout, or any layout but ship', () => {
    const offenders: string[] = [];
    const walk = (directory: string) => {
      for (const name of readdirSync(directory)) {
        if (name === 'node_modules' || name === 'dist' || name === '.expo') continue;
        const path = join(directory, name);
        if (statSync(path).isDirectory()) {
          if (path === join(LAYOUTS_DIR, 'demo')) continue;
          walk(path);
        } else if (/\.(tsx?|jsx?|json)$/.test(name) && !/\.generated\./.test(name)) {
          const text = readFileSync(path, 'utf8');
          if (/(?:from|import|require)\s*\(?\s*['"][^'"]*data\/layouts\/(?!ship\b)/.test(text))
            offenders.push(relative(REPO, path));
        }
      }
    };
    walk(join(REPO, 'packages/app-core/src'));
    walk(join(REPO, 'apps/mobile/src'));
    expect(offenders).toEqual([]);
  });
});

describe('the layout registry', () => {
  it('lists exactly the folders, ship first, and holds each folder’s files', () => {
    expect(LAYOUTS.map((entry) => entry.id).sort()).toEqual(layouts);
    expect(LAYOUTS[0]!.id).toBe(SHIPPED_LAYOUT);
    for (const { id, bundle } of LAYOUTS) {
      expect(isLayoutId(id)).toBe(true);
      expect(Object.keys(bundle.screens).sort()).toEqual(screensOf(id));
      expect(bundle.navigation).toEqual(
        JSON.parse(readFileSync(join(LAYOUTS_DIR, id, 'navigation.json'), 'utf8')),
      );
    }
  });

  it('names the example layout among them, and finds a bundle by id', () => {
    expect(layoutBundle(EXAMPLE_LAYOUT)).toBe(LAYOUTS.find((e) => e.id === EXAMPLE_LAYOUT)!.bundle);
    expect(layoutBundle('nowhere')).toBeUndefined();
  });

  it('orders ship, then demo, then every other id by name, a third layout included', () => {
    expect(orderLayouts(['zeta', 'demo', 'alpha', 'ship'])).toEqual([
      'ship',
      'demo',
      'alpha',
      'zeta',
    ]);
    expect(orderLayouts(['newsroom', 'ship'])).toEqual(['ship', 'newsroom']);
  });

  it('is imported by no file of the app or the core, which would bundle every layout', () => {
    const offenders: string[] = [];
    const walk = (directory: string) => {
      for (const name of readdirSync(directory)) {
        if (name === 'node_modules' || name === 'dist' || name === '.expo') continue;
        const path = join(directory, name);
        if (statSync(path).isDirectory()) walk(path);
        else if (/\.(tsx?|jsx?)$/.test(name) && path !== join(LAYOUTS_DIR, 'registry.ts')) {
          if (
            /(?:from|import|require)\s*\(?\s*['"][^'"]*layouts\/registry/.test(
              readFileSync(path, 'utf8'),
            )
          )
            offenders.push(relative(REPO, path));
        }
      }
    };
    walk(join(REPO, 'packages/app-core/src'));
    walk(join(REPO, 'apps/mobile/src'));
    expect(offenders).toEqual([]);
  });
});

describe('a layout id', () => {
  it.each(['ship', 'demo', 'newsroom-2026', 'a'])('accepts %s', (id) => {
    expect(layoutIdFault(id)).toBeNull();
  });

  it.each([
    [undefined, 'not-a-string'],
    [3, 'not-a-string'],
    ['', 'empty'],
    ['a'.repeat(41), 'too-long'],
    ['Ship', 'malformed'],
    ['a/b', 'malformed'],
    ['..', 'malformed'],
    ['a.b', 'malformed'],
    ['-a', 'malformed'],
    ['a--b', 'malformed'],
  ])('refuses %j as %s', (id, fault) => {
    expect(layoutIdFault(id)).toBe(fault);
    expect(isLayoutId(id)).toBe(false);
  });
});

describe('a screen id', () => {
  it('is the same grammar for a built-in name as for any other', () => {
    for (const id of ['home', 'entdecken', 'mediathek', 'mitmachen', 'profil', 'kampagne'])
      expect(screenIdFault(id)).toBeNull();
  });

  it('keeps `navigation` reserved and refuses what the layout id refuses', () => {
    expect(screenIdFault('navigation')).toBe('reserved');
    expect(screenIdFault('../x')).toBe('malformed');
    expect(isScreenId('Home')).toBe(false);
  });
});

describe('join and check, per layout', () => {
  it.each(['ship', 'demo'])('join then check accepts %s', (layout) => {
    const directory = mkdtempSync(join(tmpdir(), 'layouts-'));
    directories.push(directory);
    const file = join(directory, 'layout.json');
    const joined = run(JOIN, layout, file);
    expect(joined.code).toBe(0);
    expect(JSON.parse(readFileSync(file, 'utf8')).screens).toBeTypeOf('object');
    expect(Object.keys(JSON.parse(readFileSync(file, 'utf8')).screens).sort()).toEqual(
      screensOf(layout),
    );
    const checked = run(CHECK, file);
    expect(checked.output).toContain('navigation');
    expect(checked.code).toBe(0);
  });

  it('joins ship, which holds no screen, to a document with none', () => {
    const directory = mkdtempSync(join(tmpdir(), 'layouts-'));
    directories.push(directory);
    const file = join(directory, 'layout.json');
    expect(run(JOIN, 'ship', file).code).toBe(0);
    expect(JSON.parse(readFileSync(file, 'utf8')).screens).toEqual({});
  });

  it.each(['../demo', 'Demo', 'a/b', ''])('refuses the layout id %j', (layout) => {
    const result = run(JOIN, layout, join(tmpdir(), 'never-written.json'));
    expect(result.code).not.toBe(0);
  });
});
