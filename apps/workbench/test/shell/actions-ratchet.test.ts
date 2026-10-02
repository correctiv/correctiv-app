import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { ROOT } from '../../plugin/collect.ts';

describe('every tool with changes uses the registry (ratchet)', () => {
  const src = join(ROOT, 'apps/workbench/src');
  const read = (f: string) => readFileSync(join(src, f), 'utf8');

  const TOOLS: Record<string, string> = {
    'preview/home/HomeDocument.tsx': 'home',
    'preview/navigation/NavigationEditor.tsx': 'navigation',
    'preview/features/FeaturesEditor.tsx': 'features',
    'preview/strings/StringsTool.tsx': 'strings',
    'preview/ui/Panels.tsx': 'tokens',
  };

  for (const [file, tool] of Object.entries(TOOLS)) {
    it(`${file} registers its actions as ${tool}`, () => {
      expect(read(file)).toContain(`useToolActions('${tool}'`);
    });
  }

  it('no other file renders its own save, submit or discard button', () => {
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const full = join(dir, name);
        if (statSync(full).isDirectory()) walk(full);
        else if (full.endsWith('.tsx')) files.push(full);
      }
    };
    walk(src);
    const offenders = files
      .filter((f) => !f.endsWith('ui/ToolActions.tsx'))
      .filter((f) =>
        /\b(Save|GitPullRequest)\b[^'\n]*from 'lucide-react'|^\s+(Save|GitPullRequest),$/m.test(
          readFileSync(f, 'utf8'),
        ),
      );
    expect(offenders).toEqual([]);
  });
});
