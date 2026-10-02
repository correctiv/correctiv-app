// The pure half of the board-versus-spec loop, tested against fixtures.
//
// The Figma calls that produce a board description cannot be tested outside Figma —
// `code.js` needs the Plugin API and a running file. What is tested here is the part
// that decides whether a person changed something: given two descriptions of the same
// page, the diff. If this is right and the board is described honestly, the warning is
// right (ADR 0069).

import { describe, expect, it } from 'vitest';

import { COMPARED, classify, diff, flattenBoard, flattenSpec, normalize } from '../diff.mjs';

const TOKENS = {
  'color-accent': { light: '#ff5064', dark: '#ff5064' },
  'color-surface': { light: '#ffffff', dark: '#1c1c1e' },
  'color-on-canvas': { light: '#212124', dark: '#f5f5f7' },
  'spacing-m': 24,
  'spacing-2xs': 6,
  'radius-md': 12,
  'radius-sm': 6,
};

/** A minimal spec tree: one frame with two children. */
function specTree() {
  return [
    {
      t: 'frame',
      name: 'Kit',
      dir: 'H',
      gap: 72,
      fill: '@color-canvas',
      children: [
        { t: 'frame', name: 'ui/Button', dir: 'H', radius: '@radius-md', fill: '@color-accent' },
        { t: 'text', name: 'Label', chars: 'Anmelden', size: 16, font: 'sans', weight: 'bold' },
      ],
    },
  ];
}

/** The same tree as a board description, with keys stamped. */
function boardTree() {
  return [
    {
      key: 'screens[0]',
      t: 'frame',
      name: 'Kit',
      dir: 'H',
      gap: 72,
      fill: '@color-canvas',
      children: [
        {
          key: 'screens[0].children[0]',
          t: 'frame',
          name: 'ui/Button',
          dir: 'H',
          radius: '@radius-md',
          fill: '@color-accent',
        },
        {
          key: 'screens[0].children[1]',
          t: 'text',
          name: 'Label',
          chars: 'Anmelden',
          size: 16,
          font: 'sans',
          weight: 'bold',
        },
      ],
    },
  ];
}

describe('diff', () => {
  it('reports nothing when the board matches the spec', () => {
    expect(diff(specTree(), boardTree(), TOKENS)).toEqual([]);
  });

  it('reports a changed fill as expressible when the board names a known token', () => {
    const board = boardTree();
    board[0].children[0].fill = '@color-surface';
    const out = diff(specTree(), board, TOKENS);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      key: 'screens[0].children[0]',
      kind: 'changed',
      property: 'fill',
      expected: '@color-accent',
      actual: '@color-surface',
      class: 'expressible',
    });
  });

  it('reports a radius set off the scale as off-scale', () => {
    const board = boardTree();
    board[0].children[0].radius = 13;
    const out = diff(specTree(), board, TOKENS);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      key: 'screens[0].children[0]',
      property: 'radius',
      expected: 12,
      actual: 13,
      class: 'off-scale',
    });
  });

  it('reports a fill changed to a literal hex as off-scale', () => {
    const board = boardTree();
    board[0].children[0].fill = '#ff0000';
    const out = diff(specTree(), board, TOKENS);
    expect(out[0]).toMatchObject({ property: 'fill', actual: '#ff0000', class: 'off-scale' });
  });

  it('reports a node the person added', () => {
    const board = boardTree();
    board[0].children.push({ key: 'screens[0].children[2]', t: 'frame', name: 'Hand drawn' });
    const out = diff(specTree(), board, TOKENS);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      key: 'screens[0].children[2]',
      kind: 'added',
      name: 'Hand drawn',
      class: 'structural',
    });
  });

  it('reports a hand-drawn node that carries no key at all', () => {
    // Nothing was stamped on it, so there is no spec entry and a redraw deletes it.
    const board = boardTree();
    board[0].children.push({ t: 'frame', name: 'Drawn by hand' });
    const out = diff(specTree(), board, TOKENS);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ kind: 'added', name: 'Drawn by hand' });
  });

  it('reports a node the person deleted', () => {
    const board = boardTree();
    board[0].children.splice(1, 1);
    const out = diff(specTree(), board, TOKENS);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      key: 'screens[0].children[1]',
      kind: 'removed',
      class: 'structural',
    });
  });

  it('reports a rename', () => {
    const board = boardTree();
    board[0].children[0].name = 'ui/Button, primary';
    const out = diff(specTree(), board, TOKENS);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      property: 'name',
      expected: 'ui/Button',
      actual: 'ui/Button, primary',
    });
  });

  it('reports a changed label', () => {
    const board = boardTree();
    board[0].children[1].chars = 'Abbrechen';
    const out = diff(specTree(), board, TOKENS);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ property: 'chars', expected: 'Anmelden', actual: 'Abbrechen' });
  });

  it('reports a padding the person changed', () => {
    const spec = specTree();
    spec[0].pad = [24, 24, 12, 12];
    const board = boardTree();
    board[0].pad = [24, 24, 12, 12];
    expect(diff(spec, board, TOKENS)).toEqual([]);
    board[0].pad = [24, 24, 40, 12];
    const out = diff(spec, board, TOKENS);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ property: 'pad', actual: [24, 24, 40, 12] });
  });

  it('reports a resized frame', () => {
    const spec = specTree();
    spec[0].w = 4400;
    const board = boardTree();
    board[0].w = 4400;
    expect(diff(spec, board, TOKENS)).toEqual([]);
    board[0].w = 4000;
    expect(diff(spec, board, TOKENS)).toMatchObject([{ property: 'w', actual: 4000 }]);
  });

  it('reports a changed instance override', () => {
    const spec = [{ t: 'instance', of: 'ui/Badge', set: { Ton: 'club', Label: 'CLUB' } }];
    const board = [
      {
        key: 'screens[0]',
        t: 'instance',
        of: 'ui/Badge',
        set: { Ton: 'club', Label: 'CLUB' },
      },
    ];
    expect(diff(spec, board, TOKENS)).toEqual([]);
    board[0].set.Ton = 'muted';
    const out = diff(spec, board, TOKENS);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      property: 'set',
      expected: { Ton: 'club' },
      actual: { Ton: 'muted' },
    });
  });

  it('resolves a scale token on both sides before comparing', () => {
    const spec = specTree();
    spec[0].children[0].radius = '@radius-md';
    const board = boardTree();
    board[0].children[0].radius = 12;
    expect(diff(spec, board, TOKENS)).toEqual([]);
  });

  it('does not compare a field the spec does not express', () => {
    // The spec says nothing about `opacity`; Figma's default of 1 must not read as a
    // difference, or every node on the page reports one (ADR 0069 §1).
    const board = boardTree();
    board[0].opacity = 1;
    board[0].clip = false;
    board[0].dash = [];
    expect(diff(specTree(), board, TOKENS)).toEqual([]);
  });

  it('does not compare a position, which is a consequence and not an intent', () => {
    // `x`, `y` and `transform` are in the spec and out of COMPARED on purpose: the kit's
    // own layout produces positions, so comparing them fires on every reflow.
    const spec = specTree();
    spec[0].x = 40;
    spec[0].transform = { rotation: 0, scaleX: 1, scaleY: 1 };
    const board = boardTree();
    board[0].x = 400;
    board[0].transform = { rotation: 3, scaleX: 1, scaleY: 1 };
    expect(diff(spec, board, TOKENS)).toEqual([]);
  });

  it('compares a field the spec expresses even when the board omits it', () => {
    const board = boardTree();
    delete board[0].gap;
    const out = diff(specTree(), board, TOKENS);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ property: 'gap', expected: 72, actual: undefined });
  });

  it('treats a variant set’s options as children keyed by position', () => {
    const spec = [
      {
        t: 'variants',
        name: 'ui/Button',
        prop: 'Variante',
        options: [
          { t: 'frame', name: 'primary', fill: '@color-accent' },
          { t: 'frame', name: 'secondary', fill: '@color-surface' },
        ],
      },
    ];
    const board = [
      {
        key: 'screens[0]',
        t: 'variants',
        name: 'ui/Button',
        options: [
          { key: 'screens[0].options[0]', t: 'frame', name: 'primary', fill: '@color-accent' },
          { key: 'screens[0].options[1]', t: 'frame', name: 'secondary', fill: '@color-surface' },
        ],
      },
    ];
    expect(diff(spec, board, TOKENS)).toEqual([]);
    board[0].options[1].fill = '#123456';
    const out = diff(spec, board, TOKENS);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ key: 'screens[0].options[1]', property: 'fill' });
  });

  it('keys a variant option’s own children under .options, so a nested edit is found', () => {
    // The key a child is stamped with is the one the interpreter built it with. If the
    // two disagreed, the whole subtree would read as added and removed at once.
    const spec = [
      {
        t: 'variants',
        name: 'ui/Button',
        options: [
          {
            t: 'frame',
            name: 'primary',
            children: [{ t: 'text', chars: 'Beitrag festlegen' }],
          },
        ],
      },
    ];
    const board = [
      {
        key: 'screens[0]',
        t: 'variants',
        name: 'ui/Button',
        options: [
          {
            key: 'screens[0].options[0]',
            t: 'frame',
            name: 'primary',
            children: [
              {
                key: 'screens[0].options[0].children[0]',
                t: 'text',
                chars: 'Beitrag veröffentlichen',
              },
            ],
          },
        ],
      },
    ];
    const out = diff(spec, board, TOKENS);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      key: 'screens[0].options[0].children[0]',
      property: 'chars',
      actual: 'Beitrag veröffentlichen',
    });
  });

  it('diffs two board descriptions when generatedIsBoard is set', () => {
    const baseline = boardTree();
    const current = boardTree();
    current[0].children[0].fill = '@color-surface';
    const out = diff(baseline, current, TOKENS, { generatedIsBoard: true });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ key: 'screens[0].children[0]', property: 'fill' });
  });

  it('reports a hand-drawn addition against a board baseline too', () => {
    const baseline = boardTree();
    const current = boardTree();
    current[0].children.push({ key: 'screens[0].children[2]', t: 'frame', name: 'Not mine' });
    const out = diff(baseline, current, TOKENS, { generatedIsBoard: true });
    expect(out).toMatchObject([{ kind: 'added', name: 'Not mine' }]);
  });

  it('reports every difference, not the first', () => {
    const board = boardTree();
    board[0].children[0].fill = '@color-surface';
    board[0].children[1].chars = 'Abbrechen';
    const out = diff(specTree(), board, TOKENS);
    expect(out).toHaveLength(2);
  });

  it('tells a removed node’s name, which is how it is found on a 500-node page', () => {
    const board = boardTree();
    board[0].children.splice(0, 1);
    const out = diff(specTree(), board, TOKENS);
    expect(out[0]).toMatchObject({ kind: 'removed', name: 'ui/Button' });
  });
});

describe('flattenSpec', () => {
  it('keys a root screen, its children and a variant set’s options', () => {
    const map = flattenSpec(
      {
        t: 'frame',
        name: 'Kit',
        children: [{ t: 'frame', name: 'a', children: [] }],
      },
      'screens[0]',
    );
    expect([...map.keys()]).toEqual(['screens[0]', 'screens[0].children[0]']);
  });

  it('keys a variant set’s options under .options', () => {
    const map = flattenSpec(
      { t: 'variants', name: 'ui/Button', options: [{ t: 'frame', name: 'p' }] },
      'screens[0]',
    );
    expect([...map.keys()]).toEqual(['screens[0]', 'screens[0].options[0]']);
  });

  it('keys a variant option’s children under the option, not under children', () => {
    const map = flattenSpec(
      {
        t: 'variants',
        name: 'ui/Button',
        options: [{ t: 'frame', name: 'p', children: [{ t: 'text', chars: 'x' }] }],
      },
      'screens[0]',
    );
    expect([...map.keys()]).toEqual([
      'screens[0]',
      'screens[0].options[0]',
      'screens[0].options[0].children[0]',
    ]);
  });
});

describe('flattenBoard', () => {
  it('collects the stamped keys', () => {
    const map = flattenBoard({
      key: 'screens[0]',
      children: [{ key: 'screens[0].children[0]' }],
    });
    expect([...map.keys()]).toEqual(['screens[0]', 'screens[0].children[0]']);
  });

  it('gives an unstamped node a key the spec cannot produce', () => {
    const map = flattenBoard({
      key: 'screens[0]',
      children: [{ key: 'screens[0].children[0]' }, { t: 'frame', name: 'hand' }],
    });
    expect([...map.keys()]).toEqual(['screens[0]', 'screens[0].children[0]', 'screens[0]+hand[1]']);
  });

  it('keeps a hand-drawn subtree under its root, so none of it is lost', () => {
    const map = flattenBoard({
      key: 'screens[0]',
      children: [
        {
          t: 'frame',
          name: 'hand',
          children: [{ t: 'text', name: 'in it', chars: 'x' }],
        },
      ],
    });
    expect([...map.keys()]).toEqual([
      'screens[0]',
      'screens[0]+hand[0]',
      'screens[0]+hand[0]+hand[0]',
    ]);
  });
});

describe('normalize', () => {
  it('resolves a scale token to its number', () => {
    expect(normalize('@spacing-m', TOKENS)).toBe(24);
  });

  it('leaves a colour token as a name', () => {
    expect(normalize('@color-accent', TOKENS)).toBe('@color-accent');
  });

  it('does not resolve a colour, so two names for one value stay different', () => {
    // The case that makes the rule worth having: `accent` and `red-500` share a light
    // value often enough that resolving them would make the difference a design system
    // exists to keep compare equal.
    const tokens = { a: { light: '#ff5064' }, b: { light: '#ff5064' } };
    expect(normalize('@a', tokens)).not.toBe(normalize('@b', tokens));
  });

  it('keeps the alpha on a colour token', () => {
    expect(normalize('@color-accent/70', TOKENS)).toBe('@color-accent/70');
  });

  it('resolves every element of a padding array', () => {
    expect(normalize(['@spacing-m', '@spacing-2xs'], TOKENS)).toEqual([24, 6]);
  });

  it('leaves a literal hex alone', () => {
    expect(normalize('#ff0000', TOKENS)).toBe('#ff0000');
  });

  it('leaves a number alone', () => {
    expect(normalize(280, TOKENS)).toBe(280);
  });

  it('leaves an unknown token as it is, so it reads as a difference', () => {
    expect(normalize('@spacing-nope', TOKENS)).toBe('@spacing-nope');
  });
});

describe('classify', () => {
  it('calls a known token expressible', () => {
    expect(classify('@color-accent', TOKENS)).toBe('expressible');
  });

  it('calls a known scale token expressible', () => {
    expect(classify('@radius-md', TOKENS)).toBe('expressible');
  });

  it('calls an off-scale number off-scale', () => {
    expect(classify(13, TOKENS)).toBe('off-scale');
  });

  it('calls a literal hex off-scale', () => {
    expect(classify('#ff0000', TOKENS)).toBe('off-scale');
  });

  it('calls an unknown token off-scale', () => {
    expect(classify('@color-unknown', TOKENS)).toBe('off-scale');
  });
});

describe('COMPARED', () => {
  it('covers the fields a person can change', () => {
    for (const field of ['name', 'fill', 'radius', 'chars', 'w', 'h', 'dir', 'pad']) {
      expect(COMPARED).toContain(field);
    }
  });

  it('carries no position, because a position is a consequence and not an intent', () => {
    for (const field of ['x', 'y', 'transform']) expect(COMPARED).not.toContain(field);
  });
});
