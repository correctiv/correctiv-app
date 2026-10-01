import { describe, expect, it } from 'vitest';

import { renderedLiterals } from '../src/index';

/**
 * The walk's self-test, and it carries more weight than the others in this
 * directory.
 *
 * A caller's own guards count files, elements, text nodes and visible slots — never
 * findings — so a branch of this walk that silently stops matching (a node-kind
 * check that no longer matches the TypeScript version in use, a condition inverted
 * by an edit) leaves every floor exactly as satisfied as before and every list of
 * findings empty. The caller's suite stays green throughout, because green is also
 * what "this repository has no offender today" looks like. Fixtures with a KNOWN
 * answer are the only way to tell the two apart: each shape below is asserted to
 * produce exactly the finding it should, so a branch that stops matching turns one
 * of these red rather than turning somebody else's suite quietly optimistic.
 *
 * One file name throughout, `fixture.tsx`, because `file` only ever affects the
 * `file` field of a literal and the choice of `ScriptKind`.
 */
const VISIBLE = ['title', 'description'];
const DESCRIPTORS = ['defineMessages', 'coreMessage'];

const at = (code: string, file = 'fixture.tsx'): { slot: string; text: string }[] =>
  renderedLiterals({ file, code, visible: VISIBLE, descriptors: DESCRIPTORS }).literals.map(
    ({ slot, text }) => ({ slot, text }),
  );

describe('renderedLiterals finds a literal in every shape it claims to', () => {
  it('reads a text child and the brace beside it, which is where the argument starts', () => {
    expect(at('const X = () => <Text>Save</Text>;')).toEqual([{ slot: '<Text>', text: 'Save' }]);
    expect(at("const X = () => <Text>{'Save'}</Text>;")).toEqual([{ slot: 'child', text: 'Save' }]);
  });

  it('reads a template as the words around its holes', () => {
    expect(at('const X = () => <Text>{`Page ${n}`}</Text>;')).toEqual([
      { slot: 'child', text: 'Page' },
    ]);
    expect(at('const X = () => <Button title={`Template prop ${n}`} />;')).toEqual([
      { slot: 'title=', text: 'Template prop' },
    ]);
    expect(at('const ROWS = [{ title: `Row ${n}` }];')).toEqual([{ slot: 'title:', text: 'Row' }]);
  });

  it('follows the four shapes that choose a string rather than computing one', () => {
    expect(at("const X = () => <Text>{ok ? 'Ternary yes' : 'Ternary no'}</Text>;")).toEqual([
      { slot: 'child', text: 'Ternary yes' },
      { slot: 'child', text: 'Ternary no' },
    ]);
    expect(at("const X = () => <Text>{ok && 'Logical and string'}</Text>;")).toEqual([
      { slot: 'child', text: 'Logical and string' },
    ]);
    expect(at("const X = () => <Text>{'Plain ' + 'concatenation'}</Text>;")).toEqual([
      { slot: 'child', text: 'Plain' },
      { slot: 'child', text: 'concatenation' },
    ]);
    expect(at("const X = () => <Text>{['Array one', 'Array two'].join(', ')}</Text>;")).toEqual([
      { slot: 'child', text: 'Array one' },
      { slot: 'child', text: 'Array two' },
    ]);
  });

  it('reads a visible name as an attribute and as a property', () => {
    expect(at("const X = () => <Button title='Plain prop' />;")).toEqual([
      { slot: 'title=', text: 'Plain prop' },
    ]);
    expect(at("const ROWS = [{ title: 'Row title' }];")).toEqual([
      { slot: 'title:', text: 'Row title' },
    ]);
    expect(at("const ROWS = [{ 'title': 'Quoted key' }];")).toEqual([
      { slot: 'title:', text: 'Quoted key' },
    ]);
  });

  it('collapses the whitespace a formatter put in, so a rewrap changes no key', () => {
    expect(at('const X = () => (\n  <Text>\n    Two   lines\n  </Text>\n);')).toEqual([
      { slot: '<Text>', text: 'Two lines' },
    ]);
  });
});

describe('renderedLiterals stays quiet on what is not one of those shapes', () => {
  it('stops at a variable and at a call that is not `.join` on an array', () => {
    expect(at('const X = () => <Text>{label}</Text>;')).toEqual([]);
    expect(at('const X = () => <Text>{helper()}</Text>;')).toEqual([]);
    expect(at("const X = () => <Text>{rows.map((r) => r.label).join(', ')}</Text>;")).toEqual([]);
  });

  it('reads no state code off a comparison, which is the twelve-finding bug', () => {
    // `&&` and `===` are one node kind apart, and reading both sides of every
    // binary expression put twelve comparisons into a real report as if they were
    // rendered fallbacks.
    expect(at("const X = () => <Text>{status === 'offline' && label}</Text>;")).toEqual([]);
  });

  it('skips a descriptor’s whole subtree, `description` included', () => {
    expect(
      at(
        "const COPY = defineMessages({ save: { id: 'x.save', defaultMessage: 'Save', description: 'A button' } });",
      ),
    ).toEqual([]);
  });

  it('matches a descriptor by the callee’s exact text, not by a name inside it', () => {
    // `intl.defineMessages(…)` is not `defineMessages(…)`, and a caller that wants
    // it excused says so by naming it.
    expect(at("const COPY = intl.defineMessages({ save: { title: 'Save' } });")).toEqual([
      { slot: 'title:', text: 'Save' },
    ]);
  });

  it('reads no name the caller did not list', () => {
    expect(at('const X = () => <Text testID="save-button">{count}</Text>;')).toEqual([]);
  });

  it('follows none of the four shapes on a prop, which is the known gap', () => {
    // The docblock names this: a text child gets the ternary, the fallback, the
    // `+` and the `.join`, a prop and a property get a bare literal and a bare
    // template and nothing else. It is asserted here rather than left implicit so
    // that widening it turns these red and is somebody's decision.
    expect(at("const X = () => <Button title={ok ? 'Save' : 'Cancel'} />;")).toEqual([]);
    expect(at("const X = () => <Button title={label || 'Fallback'} />;")).toEqual([]);
    expect(at("const X = () => <Button title={'Braced ' + 'prop'} />;")).toEqual([]);
    expect(at("const X = () => <Button title={['A one', 'B two'].join(' ')} />;")).toEqual([]);
    expect(at("const X = () => <Button title={('Parenthesised')} />;")).toEqual([]);
    expect(at("const ROWS = [{ title: ok ? 'Row yes' : 'Row no' }];")).toEqual([]);

    // The same string one brace out, to show the two halves apart.
    expect(at("const X = () => <Text>{ok ? 'Save' : 'Cancel'}</Text>;")).toEqual([
      { slot: 'child', text: 'Save' },
      { slot: 'child', text: 'Cancel' },
    ]);
  });

  it('reads no text without two letters in a row', () => {
    expect(at('const X = () => <Text> · </Text>;')).toEqual([]);
    expect(at('const X = () => <Text> A+ </Text>;')).toEqual([]);
    expect(at("const X = () => <Button title='42' />;")).toEqual([]);
  });
});

describe('renderedLiterals says the reading happened', () => {
  it('counts the stages a floor is put under', () => {
    const reading = renderedLiterals({
      file: 'fixture.tsx',
      code: "const X = () => <View><Text title='A title'>Save</Text><Image /></View>;",
      visible: VISIBLE,
      descriptors: DESCRIPTORS,
    });

    expect(reading.elements).toBe(3);
    expect(reading.texts).toBe(1);
    expect(reading.slots).toBe(1);
    expect([...reading.names]).toEqual(['title']);
    expect(reading.unreadable).toEqual([]);
  });

  it('counts a visible name that carries no literal, because the name is what is met', () => {
    const reading = renderedLiterals({
      file: 'fixture.tsx',
      code: 'const X = () => <Text title={COPY.save} />;',
      visible: VISIBLE,
      descriptors: DESCRIPTORS,
    });

    expect(reading.literals).toEqual([]);
    expect(reading.slots).toBe(1);
    expect([...reading.names]).toEqual(['title']);
  });

  it('names the file the parser gave up on rather than reporting it clean', () => {
    const reading = renderedLiterals({
      file: 'fixture.tsx',
      code: 'const X = () => <Text>Save</Text',
      visible: VISIBLE,
      descriptors: DESCRIPTORS,
    });

    expect(reading.unreadable.length).toBe(1);
    expect(reading.unreadable[0]).toContain('fixture.tsx');
  });

  it('parses a .ts file as TypeScript, so a type parameter is not an unclosed tag', () => {
    // Under TSX, `<T>(x: T) => x` opens an element and takes the rest of the file
    // with it — which is a silently empty reading of everything below it.
    const reading = renderedLiterals({
      file: 'fixture.ts',
      code: "const identity = <T,>(x: T) => x;\nconst ROWS = [{ title: 'Row title' }];",
      visible: VISIBLE,
      descriptors: DESCRIPTORS,
    });

    expect(reading.unreadable).toEqual([]);
    expect(reading.literals.map(({ text }) => text)).toEqual(['Row title']);
  });
});
