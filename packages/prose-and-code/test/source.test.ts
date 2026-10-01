import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  eatenByStripping,
  filesUnder,
  under,
  withEscapesDecoded,
  withoutCommentLines,
  withoutComments,
} from '../src/index';

/** A small tree on disk, because a walk is not a thing to test with a double. */
function tree(): string {
  const root = mkdtempSync(join(tmpdir(), 'prose-and-code-'));
  mkdirSync(join(root, 'nested'));
  for (const name of ['a.ts', 'b.ts', 'c.ts', 'd.ts', 'e.ts', 'notes.md']) {
    writeFileSync(join(root, name), '');
  }
  writeFileSync(join(root, 'nested', 'f.ts'), '');
  return root;
}

describe('filesUnder', () => {
  it('reads every file under the directory, not the ones at the top', () => {
    const root = tree();
    expect(filesUnder(root, /\.ts$/).map((path) => under(root, path))).toEqual([
      'a.ts',
      'b.ts',
      'c.ts',
      'd.ts',
      'e.ts',
      'nested/f.ts',
    ]);
  });

  it('reads all of them when the pattern carries a g flag', () => {
    // The bug this function exists to have exactly once. `test` on a global regular
    // expression advances `lastIndex`, so the second call starts from where the
    // first one stopped and roughly every second file is skipped — a check that
    // halves its own scope and reports nothing about the half it dropped.
    const root = tree();
    const all = filesUnder(root, /\.ts$/).length;

    expect(filesUnder(root, /\.ts$/g).length).toBe(all);
  });

  it('spells a path the way an excuse list has to spell it', () => {
    expect(under('/repo', join('/repo', 'app', 'atlas.tsx'))).toBe('app/atlas.tsx');
  });
});

describe('withoutComments', () => {
  it('leaves the line numbering alone, so an offender is reported where it is', () => {
    const source = ['/**', ' * bg-white', ' */', 'const tone = "bg-white";'].join('\n');
    const lines = withoutComments(source).split('\n');

    expect(lines.length).toBe(4);
    expect(lines[3]).toContain('bg-white');
    expect(lines.slice(0, 3).join('')).toBe('');
  });

  it('takes a trailing comment and leaves a URL alone', () => {
    expect(withoutComments('const a = 1; // bg-white')).toBe('const a = 1; ');
    expect(withoutComments("const u = 'https://example.org/x';")).toBe(
      "const u = 'https://example.org/x';",
    );
  });

  it('does not open a block comment on a path alias and close it on a glob', () => {
    // The measured failure, and the reason the opener is narrowed: `"@/*"` and a
    // `"**/*"` two dozen lines below it are a slash-star and a star-slash, so a
    // stripper that opens anywhere ate every line between them — and the check
    // reading that file went green over the blank.
    const tsconfig = [
      '{',
      '  "compilerOptions": {',
      '    "paths": {',
      '      "@/*": ["./src/*"],',
      '      "@correctiv/app-core/*": ["../../packages/app-core/src/*"]',
      '    }',
      '  },',
      '  "include": ["**/*.ts", "**/*.tsx"]',
      '}',
    ].join('\n');

    const stripped = withoutComments(tsconfig);
    expect(stripped).toContain('@correctiv/app-core/*');
    expect(JSON.parse(stripped)).toEqual(JSON.parse(tsconfig));
  });

  it('cannot tell a // inside a string from one that opens a comment', () => {
    // Asserted rather than noted, so the blind spot is a claim somebody can act on:
    // a check built on this reads the truncated line and never sees what follows.
    expect(withoutComments("const s = 'a // b';")).toBe("const s = 'a ");
  });
});

describe('withoutCommentLines', () => {
  it('keeps a trailing comment, which is the whole difference', () => {
    expect(withoutCommentLines('const a = 1; // #ff5064')).toBe('const a = 1; // #ff5064');
    expect(withoutCommentLines('// #ff5064\nconst a = 1;')).toBe('const a = 1;');
  });

  it('closes the block up rather than emptying it', () => {
    // The cost of the narrower rule, asserted so that a caller reporting line
    // numbers picks the other one on purpose rather than by accident.
    expect(withoutCommentLines('/**\n * x\n */\nconst a = 1;').split('\n').length).toBeLessThan(4);
  });

  it('does not open a block comment on a path alias either', () => {
    // This one shipped with the un-narrowed opener while the function beside it was
    // fixed, and its docblock sent exactly this shape of file here — a check reading
    // for a literal in configuration. The two rules differ over a trailing `//` and
    // over line numbering, and over nothing else.
    const tsconfig = [
      '{',
      '  "paths": { "@/*": ["./src/*"] },',
      '  "keep": 1,',
      '  "include": ["src/**/*.ts"]',
      '}',
    ].join('\n');

    expect(JSON.parse(withoutCommentLines(tsconfig))).toEqual(JSON.parse(tsconfig));
  });

  it('still takes a block comment where one may open', () => {
    expect(withoutCommentLines('const a = /* two */ 1;')).toBe('const a =  1;');
    expect(withoutCommentLines('/* leading */const a = 1;')).toBe('const a = 1;');
  });
});

describe('eatenByStripping', () => {
  const documents = [
    { name: 'tsconfig.json', text: '{\n  // the app\n  "paths": { "@/*": ["./src/*"] }\n}' },
  ];

  it('says nothing while the file still reads', () => {
    expect(eatenByStripping({ documents })).toEqual([]);
  });

  it('names the file a stripper ate, and what its reader said', () => {
    // The guard is only worth having if it fires on the failure it is for, so the
    // stripper here is the one that was fixed: it opens a block comment on any
    // slash-star, which `"@/*"` is.
    const opensAnywhere = (source: string) =>
      source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/[^\n]*/g, '$1');

    const faults = eatenByStripping({
      documents: [
        {
          name: 'tsconfig.json',
          text: '{\n  "paths": { "@/*": ["./src/*"] },\n  "include": ["**/*.ts"]\n}',
        },
      ],
      strip: opensAnywhere,
    });

    expect(faults.length).toBe(1);
    expect(faults[0]).toContain('tsconfig.json');
    expect(faults[0]).toContain('cannot read');
  });

  it('takes a reader of its own, for a file that is not JSON', () => {
    const faults = eatenByStripping({
      documents: [{ name: 'a.ts', text: 'const a = 1;' }],
      reads: (stripped) => {
        if (!stripped.includes('const')) throw new Error('the declaration is gone');
      },
    });

    expect(faults).toEqual([]);
  });

  it('reports a document that is not JSON, loudly, under the default reader', () => {
    // The false positive named in the docblock, asserted so that nobody has to run
    // it to find out. It is the safe direction — a mixed walk fails on its first
    // run rather than never — and it is a claim about the DOCUMENTS, not about the
    // stripper: nothing was eaten here.
    const faults = eatenByStripping({ documents: [{ name: 'a.ts', text: 'const a = 1;' }] });

    expect(faults.length).toBe(1);
    expect(faults[0]).toContain('a.ts');
  });

  it('cannot see damage that stays on one line, nor a stripped scalar', () => {
    // The two gaps in the oracle. Asserted rather than noted, so a caller reading a
    // green run of this knows what it did not ask. Both are damage; both parse.
    const oneLine = '{"a": "x /* y */ z", "b": 2}';
    expect(withoutComments(oneLine)).toBe('{"a": "x  z", "b": 2}');
    expect(eatenByStripping({ documents: [{ name: 'one.json', text: oneLine }] })).toEqual([]);

    const eatenToAScalar = '/* the whole file */ 5';
    expect(withoutComments(eatenToAScalar).trim()).toBe('5');
    expect(eatenByStripping({ documents: [{ name: 'n.json', text: eatenToAScalar }] })).toEqual([]);
  });
});

describe('withEscapesDecoded', () => {
  it('writes an escaped letter back, so an escape is not a way through', () => {
    expect(withEscapesDecoded("'Pr\\u00fcfen'")).toBe("'Prüfen'");
    expect(withEscapesDecoded("'Pr\\u{fc}fen'")).toBe("'Prüfen'");
    expect(withEscapesDecoded("'caf\\xe9'")).toBe("'café'");
  });
});
