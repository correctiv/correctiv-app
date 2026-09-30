import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { spacingPx, type SpacingToken } from '@correctiv/design-tokens/tokens.generated';
import { filesUnder, floorFaults, ratchet, under } from '@correctiv/prose-and-code';
import ts from 'typescript';

import { sizes } from '../src/lib/theme/sizes';
import { typography } from '../src/lib/theme/typography';
import type { TypoVariant } from '../src/lib/theme/typography';

/**
 * How big a control is, where the source says so.
 *
 * `accessibility.test.ts` declines this deliberately, and the sentence it declines
 * it with is the one to argue with: "a target's height is its label's line box plus
 * padding written as utility classes, times the reader's font scale — three
 * numbers, none of them in the JSX". Two of the three are in this repository. The
 * line box is `typography[variant].lineHeight`, generated from
 * `tokens/typography.css`; the padding is a spacing token and `spacingPx` has its
 * value. Only the font scale is unknown here — and it is only ever ≥ 1, so a
 * control that clears 44 at scale 1 clears it at every scale. The unknown pushes in
 * the safe direction, which is what makes this checkable at all.
 *
 * So this reads two shapes and nothing else, both of them written out in the JSX:
 *
 *  - a control that names its own box (`style={{ width: sizes.iconButton }}`), and
 *  - a control whose content is one line of type in a box made of padding classes.
 *
 * **It does not replace the device.** `screens/tools/tour-a11y.sh` reports every
 * clickable node under 48 dp from `uiautomator`'s own bounds, which is the only
 * measurement that has all three numbers in it, and issue #102's "done when" is
 * written against TalkBack and VoiceOver rather than against any file here.
 *
 * WHAT IT CANNOT SEE, which is most of the app's controls:
 *
 *  - **A control whose height comes from its children.** A row with a thumbnail and
 *    two lines of text is as tall as the tallest of them, and nothing here adds
 *    that up. Those are also the controls that are comfortably over 44 already,
 *    which is why the two shapes above are the ones worth reading.
 *  - **A className that is not a literal.** `Chip` and `Button` compose theirs from
 *    an array, so their padding is invisible from here; `Chip` carries a `minHeight`
 *    instead and is caught by the first shape, and `Button`'s `py-s` around
 *    `text-button` is 46 and has never been the problem.
 *  - **`hitSlop`.** On purpose, and it is the third rule below rather than an
 *    allowance inside the first two: a slop rectangle does not grow with the system
 *    font, does not exist at all in react-native-web, and can lie over the control
 *    beside it. #102 asks for each site to be judged; this holds the judgement.
 *  - **The platform's own controls.** `Switch` is 40 x 20 in the browser and takes
 *    no size — react-native draws whatever the platform draws. `SettingRow` is
 *    where it is used and the note is there.
 *  - **Whether the thing is reachable at all**, which is the other half of a target
 *    and the half a screen reader answers. `accessibility.test.ts` is that side.
 */
const SRC = join(__dirname, '..', 'src');

/**
 * The gallery, excluded as `accessibility.test.ts`, `fixed-heights.test.ts` and
 * `colour-tiers.test.ts` exclude it: a developer's catalogue of the components,
 * read by nobody else, and its specimens are deliberately bare.
 */
const DEVELOPER_ONLY = /^gallery\//;

/** The elements that take a touch — `accessibility.test.ts`'s four, for its reason. */
const INTERACTIVE = new Set([
  'Pressable',
  'TouchableOpacity',
  'TouchableHighlight',
  'TouchableWithoutFeedback',
]);

const FILES = filesUnder(SRC, /\.tsx$/).filter((path) => !DEVELOPER_ONLY.test(under(SRC, path)));

const openingOf = (node: ts.JsxElement | ts.JsxSelfClosingElement) =>
  ts.isJsxSelfClosingElement(node) ? node : node.openingElement;

const tagOf = (node: ts.JsxElement | ts.JsxSelfClosingElement) => openingOf(node).tagName.getText();

const attributeNamed = (node: ts.JsxElement | ts.JsxSelfClosingElement, name: string) =>
  openingOf(node).attributes.properties.find(
    (prop): prop is ts.JsxAttribute =>
      !ts.isJsxSpreadAttribute(prop) && prop.name.getText() === name,
  );

/** The object literals in a `style`, whether it is one or an array of them. */
function styleObjects(
  node: ts.JsxElement | ts.JsxSelfClosingElement,
): ts.ObjectLiteralExpression[] {
  const style = attributeNamed(node, 'style');
  if (!style?.initializer || !ts.isJsxExpression(style.initializer)) return [];
  const value = style.initializer.expression;
  if (!value) return [];
  if (ts.isArrayLiteralExpression(value))
    return value.elements.filter(ts.isObjectLiteralExpression);
  return ts.isObjectLiteralExpression(value) ? [value] : [];
}

/**
 * A number an author chose: `44`, or a `sizes.*` token read back out of the token
 * file rather than transcribed. Anything else — a variable, a sum, a measured
 * value — is not a declaration and is left alone.
 */
function numberOf(expression: ts.Expression): number | undefined {
  if (ts.isNumericLiteral(expression)) return Number(expression.text);
  if (
    ts.isPropertyAccessExpression(expression) &&
    expression.expression.getText() === 'sizes' &&
    expression.name.getText() in sizes
  ) {
    return sizes[expression.name.getText() as keyof typeof sizes];
  }
  return undefined;
}

type Axis = 'width' | 'height' | 'minWidth' | 'minHeight';
const AXES: Axis[] = ['width', 'height', 'minWidth', 'minHeight'];

/** What a control's own `style` commits its box to, per axis. */
function declaredBox(
  node: ts.JsxElement | ts.JsxSelfClosingElement,
): Partial<Record<Axis, number>> {
  const box: Partial<Record<Axis, number>> = {};
  for (const object of styleObjects(node)) {
    for (const prop of object.properties) {
      if (!ts.isPropertyAssignment(prop)) continue;
      const name = prop.name.getText();
      if (!(AXES as string[]).includes(name)) continue;
      const value = numberOf(prop.initializer);
      if (value !== undefined) box[name as Axis] = value;
    }
  }
  return box;
}

/** A `className` written as one string, or `undefined` when it is composed. */
function literalClassName(node: ts.JsxElement | ts.JsxSelfClosingElement): string | undefined {
  const attribute = attributeNamed(node, 'className');
  const value = attribute?.initializer;
  if (!value) return undefined;
  if (ts.isStringLiteral(value)) return value.text;
  if (!ts.isJsxExpression(value) || !value.expression) return undefined;
  const inner = value.expression;
  if (ts.isStringLiteral(inner) || ts.isNoSubstitutionTemplateLiteral(inner)) return inner.text;
  return undefined;
}

const isSpacing = (token: string): token is SpacingToken => token in spacingPx;

/**
 * The vertical padding those classes add, in px.
 *
 * The four spellings the app writes, most specific last so `pt-s` beats `py-2xs`
 * the way the stylesheet does. A token this does not recognise is ignored rather
 * than guessed at, which can only make the computed box SMALLER and therefore
 * cannot excuse a control.
 */
function verticalPadding(className: string): { top: number; bottom: number } {
  let top = 0;
  let bottom = 0;
  for (const word of className.split(/\s+/)) {
    const match = /^(p|py|pt|pb)-(.+)$/.exec(word);
    if (!match) continue;
    const [, axis, token] = match;
    if (!isSpacing(token)) continue;
    const value = spacingPx[token];
    if (axis === 'p' || axis === 'py') {
      top = value;
      bottom = value;
    }
    if (axis === 'pt') top = value;
    if (axis === 'pb') bottom = value;
  }
  return { top, bottom };
}

/**
 * The one line of type inside this control, when that is all there is.
 *
 * `undefined` when the control holds anything else — a second element, a glyph, a
 * view, a conditional — because then its height is not this line's and nothing here
 * can say what it is. `Typo` without a `variant` is `text-m`, which is `Typo`'s own
 * default and the reason that default is read here rather than assumed away.
 *
 * `numberOfLines` is not consulted, and that is not an oversight: a line count is a
 * ceiling on how tall the text may become, never a floor under it, so the smallest
 * this control can be is still one line either way.
 */
function soleLine(node: ts.JsxElement): TypoVariant | undefined {
  const drawn = node.children.filter((child) => !(ts.isJsxText(child) && child.text.trim() === ''));
  if (drawn.length !== 1) return undefined;
  const only = drawn[0];
  if (!ts.isJsxElement(only) && !ts.isJsxSelfClosingElement(only)) return undefined;
  if (tagOf(only) !== 'Typo') return undefined;
  const variant = attributeNamed(only, 'variant');
  if (!variant) return 'text-m';
  const value = variant.initializer;
  if (!value || !ts.isStringLiteral(value)) return undefined;
  return value.text in typography ? (value.text as TypoVariant) : undefined;
}

interface Control {
  /** `file:line`, which is how a ledger below addresses one. */
  where: string;
  tag: string;
  /** What the source commits this control's height to, in px. */
  height: number;
  /** And its width, where the source names one. */
  width?: number;
  /**
   * The height as a FIXED edge rather than a floor, when the source wrote `height`.
   *
   * Carried beside `height` because the two are different promises and only one of
   * them survives a reader who enlarges the type. A number here is the defect the
   * `fixedEdges` ledger below names; the value itself is irrelevant, since a fixed
   * 44 and a fixed 68 are equally unable to grow.
   */
  fixedHeight?: number;
  /** The same for the width. */
  fixedWidth?: number;
  /** How the height was arrived at, for the failure message. */
  from: string;
}

interface Slop {
  where: string;
  tag: string;
}

function read(): { controls: Control[]; slops: Slop[]; elements: number } {
  const controls: Control[] = [];
  const slops: Slop[] = [];
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
    const lineOf = (node: ts.Node) =>
      source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;

    const visit = (node: ts.Node): void => {
      if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
        elements += 1;
        const tag = tagOf(node);
        if (INTERACTIVE.has(tag)) {
          const where = `${file}:${lineOf(node)}`;
          if (attributeNamed(node, 'hitSlop')) slops.push({ where, tag });

          const box = declaredBox(node);
          const floor = Math.max(box.height ?? 0, box.minHeight ?? 0);
          const width = box.width ?? box.minWidth;

          const line = ts.isJsxElement(node) ? soleLine(node) : undefined;
          const className = literalClassName(node);
          let height = floor;
          let from = floor > 0 ? 'its own style' : '';
          if (line && className !== undefined) {
            const padding = verticalPadding(className);
            const text = (typography[line].lineHeight ?? 0) + padding.top + padding.bottom;
            if (text > height) {
              height = text;
              from = `${line} (${typography[line].lineHeight}) + ${padding.top} + ${padding.bottom} of padding`;
            }
          }
          if (height > 0) {
            controls.push({
              where,
              tag,
              height,
              width,
              from,
              fixedHeight: box.height,
              fixedWidth: box.width,
            });
          }
        }
      }
      node.forEachChild(visit);
    };
    visit(source);
  }

  return { controls, slops, elements };
}

const app = read();

/**
 * Under the floor in either direction.
 *
 * A width the source does not name is not a small width: it is a box the content
 * decides, which this file has already said it cannot measure. Only a declared one
 * counts against a control.
 */
const underTheFloor = (controls: Control[]) =>
  controls.filter(
    (control) =>
      control.height < sizes.tapTarget ||
      (control.width !== undefined && control.width < sizes.tapTarget),
  );

/**
 * The controls whose declared box is under the floor, and why each is left.
 *
 * Empty, which is the state #102 left the app in and the state to keep it in. An
 * entry here is a promise that somebody measured the control on a device and found
 * the missing dp somewhere this file cannot see — not a note that the fix is due.
 */
const MEASURED_AND_LEFT: Record<string, string> = {};

/**
 * A control that names its own box with a FIXED edge rather than a floor.
 *
 * **`underTheFloor` above cannot see this, and that is why it is here.** It asks
 * whether the declared size reaches 44, and `sizes.iconButton` is 44, so the answer
 * is yes and the control passes — while the number is a promise the box cannot keep
 * once the reader enlarges the type. Measured on `Medium_Phone_API_36` on
 * 2026-09-30: `player.tsx`'s close button read 43.8 x 43.8 dp at 100 % *and* at
 * 200 % system font, because it committed `width`/`height` where the back button
 * beside it in `ScreenHeaderBar` commits `minWidth`/`minHeight`. Nothing else in
 * the repository noticed: a screenshot at 100 % shows a correct-looking circle, and
 * the two shapes are the same four characters apart.
 *
 * So the rule is about the WORD, not the value. `sizes.tapTarget` in `minHeight` is
 * the answer this app already gives everywhere else, and the comment on
 * `sizes.ts` says so; what was missing was a check that a glyph-only control says
 * it the same way. A box whose content is a line of type is
 * `fixed-heights.test.ts`'s business, and it reads the same source for the other
 * half of the same fault.
 */
const fixedEdges = app.controls.filter(
  (control) => control.fixedHeight !== undefined || control.fixedWidth !== undefined,
);

/**
 * Those of which each is left, and why.
 *
 * **`sizes.playButtonLarge` is here for a reason that is about the eye and not the
 * thumb.** A transport button drawn at 68 dp is a circle the reader can see at arm's
 * length on a phone held one-handed, and it is past 48 for the reason the comment on
 * `sizes.ts` gives for the three tokens of that group: it was drawn that size rather
 * than sized to a thumb. A fixed edge on it costs nothing a reader can feel, because
 * nothing in it is type and the glyph is centred either way.
 *
 * `MiniPlayer`'s two controls are NOT here. They hold a glyph, they commit
 * `width`/`height` where the player beside them commits `minWidth`/`minHeight`, and
 * they are the same defect the ledger exists to catch — the mini player is the one
 * place a reader touches the app with a thumb that is already reaching for something
 * else.
 */
const DRAWN_THAT_WAY: Record<string, string> = {
  'app/player.tsx:152':
    'The large transport button, drawn at 68 dp to be seen rather than hit. Past 48 already and holds a glyph, so a fixed edge costs a reader nothing a minHeight would fix.',
};

describe('a control is big enough for a thumb', () => {
  it('reads the app it is checking (guards against a silently empty walk)', () => {
    // A moved directory, or a parser that returned nothing, writes no offenders and
    // every assertion below passes over it. Three numbers, because a walk that found
    // files but no JSX would satisfy the first, and one that found JSX but computed
    // no heights would satisfy the second.
    expect(
      floorFaults({
        'files under src/': { found: FILES.length, atLeast: 50 },
        'JSX elements parsed': { found: app.elements, atLeast: 300 },
        'controls with a box this could measure': {
          found: app.controls.length,
          atLeast: 10,
        },
      }),
    ).toEqual([]);
  });

  it('keeps the floor at the figure the guideline names', () => {
    // The token is what every rule here compares against, so a number typed over it
    // would turn the whole file green without changing a control. WCAG 2.5.5 is 44
    // CSS px; Android asks 48 and `screens/tools/small-targets.py` measures against
    // that on the device, which is the stricter of the two and the one a phone is
    // judged by.
    expect(sizes.tapTarget).toBe(44);
  });

  const small = ratchet(
    underTheFloor(app.controls).map((control) => {
      const width = control.width === undefined ? '' : `${control.width} wide and `;
      return {
        key: control.where,
        as: `<${control.tag}> is ${width}${control.height} tall, from ${control.from}`,
      };
    }),
    MEASURED_AND_LEFT,
  );

  it('acquires no control under the floor', () => {
    expect(small.arrivals).toEqual([]);
  });

  it('excuses nothing that has since been given the room', () => {
    // The direction a one-sided list cannot do. An excuse addressed by line also
    // fails when the control it named moves, which is deliberate: the next control
    // to land on that line would otherwise inherit the permission.
    expect(small.stale).toEqual([]);
  });

  const pinned = ratchet(
    fixedEdges.map((control) => ({
      key: control.where,
      as:
        `<${control.tag}> commits ${control.fixedWidth ?? '-'} wide and ` +
        `${control.fixedHeight ?? '-'} tall with width/height; a control that ` +
        'holds a glyph needs minWidth/minHeight so the reader’s text scale can ' +
        'raise it',
    })),
    DRAWN_THAT_WAY,
  );

  it('commits no control to an edge that cannot grow', () => {
    // Not a size rule and not a minimum: `sizes.iconButton` is 44 and this file's
    // other assertion already calls that big enough. What is wrong is the WORD. A
    // fixed edge is a number the box promises and cannot keep, and on a phone it
    // breaks the one way that matters — a reader who has asked for larger type and
    // gets a control that stayed the size it was.
    expect(pinned.arrivals).toEqual([]);
  });

  it('excuses no drawn circle that has since been given a floor', () => {
    expect(pinned.stale).toEqual([]);
  });
});

/**
 * Every `hitSlop` in the app, with the argument for it.
 *
 * #102 asks for the twelve sites that existed to be judged one at a time, and names
 * the two things a slop rectangle does not do: it can lie over the control beside
 * it, and it does not grow with the system font while padding does. There is a
 * third, which the web export measured: react-native-web draws no slop rectangle at
 * all, so every one of the twelve was worth exactly nothing in the browser.
 *
 * Eleven became a box. The one left is the one where a box is not available: a
 * 4 dp bar cannot be 44 dp tall and still be a 4 dp bar.
 *
 * A ledger rather than a ban, because `hitSlop` is the right answer to that case
 * and a rule that forbade it would be a rule people route around. What it costs to
 * add one is writing down which neighbour it does not reach.
 */
const SLOP_WITH_A_REASON: Record<string, string> = {
  'components/player/ProgressBar.tsx:39':
    'the scrub bar: 4 dp of drawn track inside a 28 dp box, and it is the full width of the player with no control beside it. Growing the box would grow the bar, which is the thing being pointed at.',
};

describe('every hitSlop is argued for', () => {
  const { arrivals, stale } = ratchet(
    app.slops.map((slop) => ({
      key: slop.where,
      as: `<${slop.tag}> hitSlop, with no entry saying what it is for`,
    })),
    SLOP_WITH_A_REASON,
  );

  it('acquires no new one', () => {
    expect(arrivals).toEqual([]);
  });

  it('excuses nothing that no longer has one', () => {
    expect(stale).toEqual([]);
  });
});
