import { describe, expect, it } from 'vitest';

// A build script, plain JS, with no types to hand a test.
import { propsOf } from '../scripts/api.mjs';

/**
 * The props table, for a component whose props type is a union.
 *
 * `ScreenHeaderProps` is the first one in this repository (ADR 0030), and until
 * `propsOf` knew what a union was the reference printed "Props: None." for
 * `ScreenHeader` and followed it with "Plus everything in `…`, which this
 * repository does not own" — about a type declared two files from the component.
 * Every prop and every line of prose on it was dropped, on the one component
 * whose props type exists so that a reader can see which props go together.
 *
 * The fixtures are TypeDoc's model as this script reads it, not TypeDoc itself:
 * the script asks a type for `.type`, `.types`, `.declaration.children` and its
 * string form, and nothing else. A run of the real thing is `npm run api`, takes
 * half a minute and needs the app to typecheck, which is not a unit test.
 */
type Fake = Record<string, unknown>;

const named = (text: string): Fake => ({ type: 'intrinsic', toString: () => text });

const prop = (name: string, type: string, optional: boolean, doc?: string): Fake => ({
  name,
  type: named(type),
  flags: { isOptional: optional },
  comment: doc ? { summary: [{ kind: 'text', text: doc }] } : undefined,
});

const object = (...children: Fake[]): Fake => ({
  type: 'reflection',
  declaration: { children },
});

const union = (...types: Fake[]): Fake => ({ type: 'union', types });
const intersection = (...types: Fake[]): Fake => ({ type: 'intersection', types });

function table(type: Fake) {
  const { props, inherits } = propsOf(type) as {
    props: Map<string, { name: string; type: string; optional: boolean; doc: string }>;
    inherits: string[];
  };
  return { props: [...props.values()], inherits };
}

describe('the props of a union type', () => {
  it('lists what every member of the union accepts', () => {
    const { props, inherits } = table(
      union(
        object(prop('drawnBar', 'false', true), prop('backLabel', 'never', true)),
        object(prop('drawnBar', 'true', false), prop('backLabel', 'string', true)),
      ),
    );

    expect(props.map((p) => p.name)).toEqual(['drawnBar', 'backLabel']);
    expect(inherits).toEqual([]);
  });

  it('joins the types a name has across the members, and drops never', () => {
    // `backLabel?: never` is how one member FORBIDS a prop the other takes. It is
    // a statement about that member, not a type a caller can write, so the table
    // says "string" rather than "never | string".
    const { props } = table(
      union(
        object(prop('drawnBar', 'false', true), prop('backLabel', 'never', true)),
        object(prop('drawnBar', 'true', false), prop('backLabel', 'string', true)),
      ),
    );

    expect(props.find((p) => p.name === 'drawnBar')?.type).toBe('false | true');
    expect(props.find((p) => p.name === 'backLabel')?.type).toBe('string');
  });

  it('calls a prop optional when there is a way to call the component without it', () => {
    // `drawnBar` is required in the second member and absent-or-optional in the
    // first, so a caller may leave it out. Marking it required would make the
    // table say the opposite of what the type says.
    const { props } = table(
      union(object(prop('drawnBar', 'false', true)), object(prop('drawnBar', 'true', false))),
    );

    expect(props.find((p) => p.name === 'drawnBar')?.optional).toBe(true);
  });

  it('keeps the prose a prop carries in only one of the members', () => {
    const { props } = table(
      union(
        object(prop('drawnBar', 'false', true)),
        object(prop('drawnBar', 'true', false, 'Keeps the app’s own drawn bar.')),
      ),
    );

    expect(props.find((p) => p.name === 'drawnBar')?.doc).toContain(
      'Keeps the app’s own drawn bar',
    );
  });

  it('reads the shape ScreenHeaderProps actually has', () => {
    // A name shared by every member, intersected with the union: `title` is
    // required whichever way the component is called, which is why it sits
    // outside the union rather than in both halves of it.
    const { props, inherits } = table(
      intersection(
        object(prop('title', 'string', false, 'The screen’s name, in German.')),
        union(
          object(prop('drawnBar', 'false', true), prop('children', 'never', true)),
          object(prop('drawnBar', 'true', false), prop('children', 'ReactNode', true)),
        ),
      ),
    );

    expect(props.map((p) => `${p.name}${p.optional ? '?' : ''}: ${p.type}`)).toEqual([
      'title: string',
      'drawnBar?: false | true',
      'children?: ReactNode',
    ]);
    expect(inherits).toEqual([]);
  });
});
