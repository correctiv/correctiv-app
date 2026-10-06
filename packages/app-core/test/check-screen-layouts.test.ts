import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { joinScreenDocuments, SCREEN_DOCUMENTS } from '../src/lib/screen-layout';

const SCRIPT = new URL('../scripts/check-screen-layouts.ts', import.meta.url).pathname;
const NAVIGATION = JSON.parse(
  readFileSync(new URL('../src/data/layout/navigation.json', import.meta.url), 'utf8'),
);

const directories: string[] = [];
afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true });
});

/** The script's exit code and what it printed, for a joined document written to a file. */
function check(screens: Record<string, unknown>): { code: number; output: string } {
  const directory = mkdtempSync(join(tmpdir(), 'screen-layouts-'));
  directories.push(directory);
  const file = join(directory, 'layout.json');
  writeFileSync(file, JSON.stringify(joinScreenDocuments(screens, NAVIGATION)));
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
    const { code, output } = check({ ...SCREEN_DOCUMENTS, kampagne: campaign });
    expect(output).toContain('kampagne');
    expect(code).toBe(0);
  });

  it('refuses a custom screen with no title', () => {
    const { code, output } = check({ ...SCREEN_DOCUMENTS, kampagne: { ...campaign, title: {} } });
    expect(output).toContain('kampagne: refused');
    expect(code).toBe(1);
  });

  it('refuses a file under screens/ whose name no route can reach', () => {
    const { code, output } = check({ ...SCREEN_DOCUMENTS, 'Not Valid': campaign });
    expect(output).toContain('not a valid screen id');
    expect(code).toBe(1);
  });

  it('still wants every declared screen', () => {
    const { home: _home, ...rest } = SCREEN_DOCUMENTS;
    const { code, output } = check(rest);
    expect(output).toContain('home: missing');
    expect(code).toBe(1);
  });
});
