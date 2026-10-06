import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { joinScreenDocuments } from '../src/lib/screen-layout';
import { DEMO_SCREENS } from './__fixtures__/demo-layout';

const SCRIPT = new URL('../scripts/check-screen-layouts.ts', import.meta.url).pathname;
const NAVIGATION = JSON.parse(
  readFileSync(new URL('../src/data/layouts/demo/navigation.json', import.meta.url), 'utf8'),
);

const directories: string[] = [];
afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true });
});

/** The script's exit code and what it printed, for a joined document written to a file. */
function check(
  screens: Record<string, unknown>,
  navigation: unknown = NAVIGATION,
): { code: number; output: string } {
  const directory = mkdtempSync(join(tmpdir(), 'screen-layouts-'));
  directories.push(directory);
  const file = join(directory, 'layout.json');
  writeFileSync(file, JSON.stringify(joinScreenDocuments(screens, navigation)));
  try {
    const output = execFileSync('npx', ['tsx', SCRIPT, file], { encoding: 'utf8', stdio: 'pipe' });
    return { code: 0, output };
  } catch (error) {
    const failure = error as { status: number; stdout: string; stderr: string };
    return { code: failure.status, output: `${failure.stdout}${failure.stderr}` };
  }
}

const campaign = {
  version: 4,
  title: { de: 'Kampagne' },
  sections: [],
};

describe('check-screen-layouts and a screen the newsroom made (ADR 0075 §7)', () => {
  it('accepts a custom screen that is only a heading', () => {
    const { code, output } = check({ ...DEMO_SCREENS, kampagne: campaign });
    expect(output).toContain('kampagne');
    expect(code).toBe(0);
  });

  it('refuses a custom screen with no title', () => {
    const { code, output } = check({ ...DEMO_SCREENS, kampagne: { ...campaign, title: {} } });
    expect(output).toContain('kampagne: refused');
    expect(code).toBe(1);
  });

  it('refuses a file under screens/ whose name no route can reach', () => {
    const { code, output } = check({ ...DEMO_SCREENS, 'Not Valid': campaign });
    expect(output).toContain('not a valid screen id');
    expect(code).toBe(1);
  });

  it('does not want any screen in particular: a layout with none is valid', () => {
    const { code, output } = check({}, { version: 1, tabs: [] });
    expect(output).toContain('navigation: 0 tabs');
    expect(code).toBe(0);
  });

  it('judges a built-in id like any other, so a layout without Home is valid', () => {
    const { home: _home, ...rest } = DEMO_SCREENS;
    expect(check(rest).code).toBe(0);
  });

  it('accepts a built-in screen that is only a heading', () => {
    const { code } = check({ entdecken: campaign }, { version: 1, tabs: ['entdecken'] });
    expect(code).toBe(0);
  });

  it('refuses a tab that names no screen of the layout', () => {
    const { code, output } = check({}, { version: 1, tabs: ['entdecken'] });
    expect(output).toContain('names no screen of this layout');
    expect(code).toBe(1);
  });
});
