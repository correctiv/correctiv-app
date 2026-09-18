import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { filesUnder, floorFaults, ratchet, under } from '@correctiv/prose-and-code';
import ts from 'typescript';

/**
 * A box drawn around text does not get a fixed height.
 *
 * This is the third form of the fault
 * [#158](https://github.com/correctiv/correctiv-app/issues/158) photographed, and
 * the one [ADR 0034](../../../adr/0034-one-component-for-the-two-sided-row.md)
 * describes in its context and leaves without a check. The search entry point on
 * Entdecken carried `style={{ height: 44 }}`; at 200 % system font its placeholder
 * needs two lines, a box told it is 44 dp tall gives it one, and the second line was
 * drawn below the field's own border and across the chip rail underneath.
 *
 * It is the same omission as `justify-between` without `flex-wrap`, one axis over:
 * a number that is right exactly while the text is small enough, and nothing that
 * says what to do when it is not. `minHeight` is the answer in both of the places
 * this app wanted a fixed one — it keeps the touch target the empty box has to have
 * and lets the type decide the rest.
 *
 * **Why a check rather than a note.** The defect passed `npm run check`, passed
 * review and was invisible at 100 %, exactly as the four rows `split-rows.test.ts`
 * covers were. This is that check's counterpart on the vertical axis, and it is
 * [ADR 0031](../../../adr/0031-four-mechanisms-for-this-must-not-be-forgotten.md)'s
 * mechanism 4 because nothing above it applies: `height` is a valid `ViewStyle` key,
 * there is no set to make exhaustive and no primitive to take away.
 *
 * **Why a parser and not a regular expression**, which is the choice
 * `accessibility.test.ts` makes and for the same reason: the rule is about an
 * element's CHILDREN, and knowing where an element ends is what a regular expression
 * cannot do.
 *
 * WHAT IT CANNOT SEE, which is more than it can:
 *
 *  - **A height that is not written here.** `height: barHeight` in
 *    `(tabs)/_layout.web.tsx` is a sum of a constant and a safe-area inset, and it
 *    is invisible to this file. So is any height a component measures. Only a number
 *    and a `sizes.*` token count, because those are the ones an author chose.
 *  - **A height that is not on a JSX `style`.** The same file's `tabBarStyle` is a
 *    navigator option and not an element's style; its own comment carries the reason
 *    it is safe, which is that the web has no system font scale at all.
 *  - **A height written as a class.** `no-numeric-utilities.test.ts` bans `h-11` and
 *    says why; neither it nor this file reads `h-[44px]`.
 *  - **A text component this file has never heard of.** `TEXT_BEARING` is a positive
 *    list, which is the opposite of `accessibility.test.ts`'s and weaker for it: an
 *    unknown component there is assumed to speak, and here it is assumed not to. The
 *    list is held to the app below so it cannot go stale, and nothing holds it to be
 *    complete.
 *  - **Whether the box actually clips.** Nothing here renders anything. A fixed
 *    height with room to spare at 200 % passes as a defect and is not one — which is
 *    the `atlas.tsx` entry below — and the only way to tell the two apart is
 *    `screens/tools/tour-a11y.sh` and a photograph.
 */
const SRC = join(__dirname, '..', 'src');

/**
 * The gallery, excluded as `accessibility.test.ts`, `colour-tiers.test.ts` and
 * `split-rows.test.ts` exclude it: a developer's catalogue of the components, read
 * by nobody else, and its specimens are deliberately bare.
 */
const DEVELOPER_ONLY = /^gallery\//;

/**
 * What puts words inside a box.
 *
 * `Typo` and `Text` are the app's two, and `Button`, `Badge` and `Chip` are here
 * because each renders a `Text` of its own — the same three `Typo`'s docblock names
 * for the same reason. Without them a fixed-height box holding only a `<Button>`
 * would read as empty from here.
 */
const TEXT_BEARING = new Set(['Typo', 'Text', 'Button', 'Badge', 'Chip']);

const FILES = filesUnder(SRC, /\.tsx$/).filter((path) => !DEVELOPER_ONLY.test(under(SRC, path)));

const openingOf = (node: ts.JsxElement | ts.JsxSelfClosingElement) =>
  ts.isJsxSelfClosingElement(node) ? node : node.openingElement;

const tagOf = (node: ts.JsxElement | ts.JsxSelfClosingElement) => openingOf(node).tagName.getText();

/**
 * The height this element commits to, as it is written, or `undefined`.
 *
 * A number (`44`) or a token (`sizes.railTile`), in a `style` object or in any
 * object inside a `style` array — the array form is how this app composes a
 * typography style with a colour, and a height can be in either half of it.
 * `minHeight` and `maxHeight` are not this: one is a floor the text can rise off
 * and the other is a ceiling somebody chose on purpose.
 */
function committedHeight(node: ts.JsxElement | ts.JsxSelfClosingElement): string | undefined {
  const style = openingOf(node).attributes.properties.find(
    (prop): prop is ts.JsxAttribute =>
      !ts.isJsxSpreadAttribute(prop) && prop.name.getText() === 'style',
  );
  if (!style?.initializer || !ts.isJsxExpression(style.initializer)) return undefined;
  const value = style.initializer.expression;
  if (!value) return undefined;

  const objects = ts.isArrayLiteralExpression(value)
    ? value.elements.filter(ts.isObjectLiteralExpression)
    : ts.isObjectLiteralExpression(value)
      ? [value]
      : [];

  for (const object of objects) {
    for (const prop of object.properties) {
      if (!ts.isPropertyAssignment(prop) || prop.name.getText() !== 'height') continue;
      const height = prop.initializer;
      if (ts.isNumericLiteral(height)) return height.text;
      if (ts.isPropertyAccessExpression(height) && height.expression.getText() === 'sizes') {
        return height.getText();
      }
    }
  }
  return undefined;
}

/** Whether anything under this element would draw words. */
function holdsText(node: ts.JsxElement): boolean {
  let found = false;
  const visit = (child: ts.Node): void => {
    if (found) return;
    if (
      (ts.isJsxElement(child) || ts.isJsxSelfClosingElement(child)) &&
      TEXT_BEARING.has(tagOf(child))
    ) {
      found = true;
      return;
    }
    child.forEachChild(visit);
  };
  node.children.forEach(visit);
  return found;
}

interface Box {
  /** `file:line`, which is how an exception below addresses one. */
  where: string;
  tag: string;
  height: string;
}

function read(): { boxes: Box[]; tags: Set<string>; elements: number } {
  const boxes: Box[] = [];
  const tags = new Set<string>();
  let elements = 0;

  for (const path of FILES) {
    const file = under(SRC, path);
    const source = ts.createSourceFile(
      path,
      readFileSync(path, 'utf8'),
      ts.ScriptTarget.Latest,
      /* setParentNodes */ true,
      ts.ScriptKind.TSX,
    );

    const visit = (node: ts.Node): void => {
      if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
        elements += 1;
        tags.add(tagOf(node));
        const height = ts.isJsxElement(node) ? committedHeight(node) : undefined;
        if (height !== undefined && holdsText(node as ts.JsxElement)) {
          const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
          boxes.push({ where: `${file}:${line}`, tag: tagOf(node), height });
        }
      }
      node.forEachChild(visit);
    };
    visit(source);
  }

  return { boxes, tags, elements };
}

const app = read();

/**
 * The boxes that still commit to a height with words inside them, and what each one
 * was measured to do at 200 % system font.
 *
 * Addressed by line, as `accessibility.test.ts` addresses its two and unlike
 * `split-rows.test.ts`, which addresses files and says why it settled for less. A
 * line is right here: the entry is one element, and an entry that outlived the
 * element it named would hand its permission to whatever landed on that line.
 *
 * Written to shrink. It is one entry, and the honest end of it is the day the atlas
 * has a map.
 */
const MEASURED_AND_LEFT: Record<string, string> = {
  'app/atlas.tsx:55':
    "The stand-in for a map the app does not have: a 130 dp box holding a pin glyph and one short label. Photographed at 200 % in both appearance settings on 2026-09-16 — the label still sets on one line and clears the box's bottom edge, so this is the construction and not the defect. Its height is the drawn size of a picture that is missing, not a guess at how tall a line of type is, which is the difference from the search field.",
};

describe('a box drawn around text does not fix its height', () => {
  const { arrivals, stale } = ratchet(
    app.boxes.map((box) => ({
      key: box.where,
      as: `<${box.tag} style={{ height: ${box.height} }}> holds text`,
    })),
    MEASURED_AND_LEFT,
  );

  it('reads the app it is checking (guards against a silently empty walk)', () => {
    // A moved directory or a parser that returned nothing writes no offenders, and
    // every assertion below passes over it. Two numbers, because a walk that found
    // files but no JSX would still satisfy the first.
    expect(
      floorFaults({
        'files under src/': { found: FILES.length, atLeast: 50 },
        'JSX elements parsed': { found: app.elements, atLeast: 300 },
      }),
    ).toEqual([]);
  });

  it('knows the components that put words in a box', () => {
    // `TEXT_BEARING` is what decides whether a fixed height matters, so a rename
    // that emptied it would turn this whole file green and silent. Held to the app:
    // every name on it is a tag the app actually writes.
    const missing = [...TEXT_BEARING].filter((tag) => !app.tags.has(tag));

    expect(missing.sort()).toEqual([]);
  });

  it('acquires no new one', () => {
    expect(arrivals).toEqual([]);
  });

  it('excuses nothing that has since been let go', () => {
    // The direction a one-sided list cannot do, and the one that makes this
    // finishable: the last `height` to become a `minHeight` takes the last entry
    // above with it.
    expect(stale).toEqual([]);
  });
});
