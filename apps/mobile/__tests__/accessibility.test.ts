import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { filesUnder, floorFaults, ratchet, under } from '@correctiv/prose-and-code';
import ts from 'typescript';

/**
 * What a screen reader is handed, read off the JSX.
 *
 * Issue #102 counted the app's accessibility as incremental rather than absent —
 * 46 `accessibilityLabel`, 41 `accessibilityRole`, 5 `accessibilityState` — and
 * asked for the gaps to be closed. A count like that rots the moment somebody adds
 * a screen, and none of the four mistakes below is visible to anything else in
 * `npm run check`: typecheck sees valid props, oxlint sees valid JSX, and a
 * screenshot shows a control that looks perfect and announces nothing. TalkBack and
 * VoiceOver are the real oracle and they are not in CI, so this is the weaker one
 * available on this side: that the props still reach the control.
 *
 * WHY A PARSER AND NOT A REGULAR EXPRESSION. `colour-tiers.test.ts` reads source as
 * text because a colour token is a word on a line, and a line is all the context it
 * needs. Three of the four rules here are about a JSX element's CHILDREN — whether
 * a label is reachable from inside a `<Pressable>` — which means knowing where the
 * element ends. A regular expression cannot, and the hand-rolled scanner that
 * pretends to is the thing that produces false positives on exactly the nested
 * markup this app is made of. `typescript` is already a root devDependency and
 * parses TSX in the version the repo compiles with, so the tree is the real one.
 *
 * WHAT IT DOES NOT PROVE, and it is most of accessibility: that the announced name
 * is the right name ("Button" passes, and names the glyph rather than the action),
 * that focus order is sensible, that a control is reachable by swipe, that the
 * contrast holds, or that anything fits at 200 % system font. Those need a device
 * and a screen reader — `screens/tools/tour-a11y.sh` is the walk, `screens/` is
 * where its pictures go, and the issue's "done when" is written against TalkBack and
 * VoiceOver, not against this file.
 */
const SRC = join(__dirname, '..', 'src');

/**
 * The gallery, excluded for the reason `colour-tiers.test.ts` and
 * `localisation-seam.test.ts` exclude it, and so that the three checks read one app
 * rather than three: it is a developer's catalogue of the components, read by
 * nobody else, and its specimens are deliberately bare.
 */
const DEVELOPER_ONLY = /^gallery\//;

const FILES = filesUnder(SRC, /\.tsx$/).filter((path) => !DEVELOPER_ONLY.test(under(SRC, path)));

/**
 * The elements that take a touch. React Native's four, by the name they are written
 * under — this reads a syntax tree and not a type, so a component that wraps one
 * (`Button`, `NavCard`, `HeaderButton`) is checked where it is DECLARED and not at
 * its 40-odd call sites, which is the right place for a prop that belongs to the
 * control.
 */
const INTERACTIVE = new Set([
  'Pressable',
  'TouchableOpacity',
  'TouchableHighlight',
  'TouchableWithoutFeedback',
]);

/**
 * The components that render no text OF THEIR OWN, so that a control containing
 * only these announces nothing. Both halves of the list are the same statement and
 * are kept in one place because the walk treats them identically: it recurses
 * through them and collects nothing.
 *
 *  - `View`, `Card`, `Bleed` are boxes. Their children decide.
 *  - `Ionicons`, `ActivityIndicator`, `Thumbnail` are a glyph, a spinner and a
 *    picture. A control wrapping one of these and nothing else is the icon-only
 *    button the issue names, and it is silent unless it carries its own label.
 *
 * **Everything not on this list counts as text-bearing**, including a component
 * this file has never heard of. That is the conservative direction on purpose: the
 * check cannot see inside `<ClaimStatusTag/>` from here, so assuming it speaks
 * costs a missed violation, while assuming it is silent would fail a control that
 * is perfectly fine. A miss is a gap; a false alarm is a check people turn off.
 *
 * Measured against the app rather than imagined, and held to it by the stale-entry
 * assertion below — a list of everything would make the labelling rule vacuous and
 * nothing else in the file would notice.
 */
const RENDERS_NO_TEXT = new Set([
  'View',
  'Card',
  'Bleed',
  'Ionicons',
  'ActivityIndicator',
  'Thumbnail',
]);

/** The image elements, which need a name or an explicit silence. */
const IMAGES = new Set(['Image', 'ImageBackground']);

/**
 * The props that mark an image as decorative, in every spelling the three platforms
 * accept. React Native's two (`accessibilityElementsHidden` on iOS,
 * `importantForAccessibility` on Android), `accessible={false}`, expo-image's `alt`
 * and the ARIA pair react-native-web maps. Any one of them is a decision; the point
 * of the rule is that SOME decision was made.
 */
const DECORATIVE = new Set([
  'accessible',
  'accessibilityElementsHidden',
  'importantForAccessibility',
  'aria-hidden',
  'alt',
  'aria-label',
  'accessibilityLabel',
]);

const LABEL_PROPS = new Set(['accessibilityLabel', 'aria-label', 'accessibilityLabelledBy']);

interface Control {
  /** Path under `src/`, with `/` on every OS. */
  file: string;
  line: number;
  tag: string;
  role: boolean;
  label: boolean;
  /** Text a screen reader could read off the children, without leaving this file. */
  speaks: boolean;
  /** `{...rest}` present, so a prop may also arrive from the call site. */
  spread: boolean;
}

interface Named {
  file: string;
  line: number;
  tag: string;
  props: string[];
}

const openingOf = (node: ts.JsxElement | ts.JsxSelfClosingElement) =>
  ts.isJsxSelfClosingElement(node) ? node : node.openingElement;

const tagOf = (node: ts.JsxElement | ts.JsxSelfClosingElement) => openingOf(node).tagName.getText();

const attributesOf = (node: ts.JsxElement | ts.JsxSelfClosingElement) =>
  openingOf(node).attributes.properties;

const propNames = (node: ts.JsxElement | ts.JsxSelfClosingElement) =>
  attributesOf(node)
    .filter((prop) => !ts.isJsxSpreadAttribute(prop))
    .map((prop) => prop.name.getText());

/** The string a prop was literally given, or `undefined` when it is an expression. */
function literalOf(prop: ts.JsxAttribute): string | undefined {
  const value = prop.initializer;
  if (!value) return undefined;
  if (ts.isStringLiteral(value)) return value.text;
  if (!ts.isJsxExpression(value) || !value.expression) return undefined;
  const inner = value.expression;
  if (ts.isStringLiteral(inner) || ts.isNoSubstitutionTemplateLiteral(inner)) return inner.text;
  return undefined;
}

/**
 * Whether anything under this control would be spoken.
 *
 * `{item.title}` and a bare `Weiter` both count, and so does any element whose tag
 * is not in `RENDERS_NO_TEXT` — see that list for why an unknown component is
 * assumed to speak. An expression is counted as text unless it is only JSX, because
 * `{count}` is a word on screen and `{open ? <A/> : null}` is not.
 */
function speaks(node: ts.JsxElement): boolean {
  let found = false;
  const visit = (child: ts.Node): void => {
    if (found) return;
    if (ts.isJsxText(child)) {
      if (child.text.trim()) found = true;
      return;
    }
    if (ts.isJsxElement(child) || ts.isJsxSelfClosingElement(child)) {
      if (!RENDERS_NO_TEXT.has(tagOf(child))) {
        found = true;
        return;
      }
      // A box: its children decide. Its own props cannot speak.
      if (ts.isJsxElement(child)) child.children.forEach(visit);
      return;
    }
    if (ts.isJsxExpression(child)) {
      if (!child.expression) return;
      let holdsJsx = false;
      const look = (inner: ts.Node): void => {
        if (
          ts.isJsxElement(inner) ||
          ts.isJsxSelfClosingElement(inner) ||
          ts.isJsxFragment(inner)
        ) {
          holdsJsx = true;
        }
        inner.forEachChild(look);
      };
      look(child.expression);
      if (!holdsJsx) {
        found = true;
        return;
      }
      child.expression.forEachChild(visit);
      return;
    }
    child.forEachChild(visit);
  };
  node.children.forEach(visit);
  return found;
}

interface Reading {
  controls: Control[];
  images: Named[];
  /** Every `accessibilityLabel=""` and `accessibilityLabel={' '}`, anywhere. */
  blankLabels: Named[];
  /**
   * Every `allowFontScaling` and `maxFontSizeMultiplier` that can switch the system's
   * font scale off, anywhere: the literal `false` and a cap of 1 or below, and any
   * value the parser cannot read as neither — `allowFontScaling={followsSystem}`
   * is an opt-out on every render where the expression is false.
   *
   * Read in two places: as a JSX prop, and as a key of any object literal, which is
   * what catches `const OFF = { allowFontScaling: false }; <Text {...OFF} />` —
   * the spread itself names nothing, the object it spreads does. An object literal
   * is `tag: '{…}'` here. **Blind** to a value that arrives from outside the file
   * or out of a call: `<Text {...props} />` where a caller wrote the key, or a
   * spread of what a function returned. The caller's own literal is still read
   * where it is written, so what escapes is a key assembled at runtime.
   *
   * Why a cap above 1 does not count: `maxFontSizeMultiplier={1.3}` still lets the
   * text grow with the reader's setting, to a ceiling somebody chose and a reviewer
   * can argue about. At 1 or below the text can never grow at all, which is the
   * setting switched off under another name.
   */
  optOuts: Named[];
  /** Tag names seen inside a control, so `RENDERS_NO_TEXT` can be held to the app. */
  childTags: Set<string>;
}

const SCALING_PROPS = new Set(['allowFontScaling', 'maxFontSizeMultiplier']);

/**
 * Whether a written value leaves the system's scaling on: the literal `true`, or a
 * cap above 1 (the reason is on `Reading.optOuts`). Everything else, an expression
 * included, may turn the reader's setting off. `undefined` is a value the parser
 * could not see, and counts as an opt-out.
 */
function keepsScaling(name: string, expression: ts.Expression | undefined): boolean {
  if (expression === undefined) return false;
  if (expression.kind === ts.SyntaxKind.TrueKeyword) return true;
  return (
    name === 'maxFontSizeMultiplier' &&
    ts.isNumericLiteral(expression) &&
    Number(expression.text) > 1
  );
}

function read(): Reading {
  const out: Reading = {
    controls: [],
    images: [],
    blankLabels: [],
    optOuts: [],
    childTags: new Set(),
  };

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
        const tag = tagOf(node);
        const names = propNames(node);
        const spread = attributesOf(node).some(ts.isJsxSpreadAttribute);
        const line = lineOf(node);

        if (INTERACTIVE.has(tag)) {
          out.controls.push({
            file,
            line,
            tag,
            role: names.includes('accessibilityRole'),
            label: names.some((name) => LABEL_PROPS.has(name)),
            speaks: ts.isJsxElement(node) ? speaks(node) : false,
            spread,
          });
          const collect = (child: ts.Node): void => {
            if (ts.isJsxElement(child) || ts.isJsxSelfClosingElement(child)) {
              out.childTags.add(tagOf(child));
            }
            child.forEachChild(collect);
          };
          if (ts.isJsxElement(node)) node.children.forEach(collect);
        }

        if (IMAGES.has(tag)) out.images.push({ file, line, tag, props: names });

        for (const prop of attributesOf(node)) {
          if (ts.isJsxSpreadAttribute(prop)) continue;
          const name = prop.name.getText();
          if (LABEL_PROPS.has(name)) {
            const literal = literalOf(prop);
            if (literal !== undefined && literal.trim() === '') {
              out.blankLabels.push({ file, line: lineOf(prop), tag, props: [name] });
            }
          }
          if (SCALING_PROPS.has(name)) {
            const value = prop.initializer;
            // A bare `allowFontScaling` is `true`.
            const bare = value === undefined;
            const expression =
              value !== undefined && ts.isJsxExpression(value) ? value.expression : undefined;
            if (!bare && !keepsScaling(name, expression)) {
              out.optOuts.push({ file, line: lineOf(prop), tag, props: [name] });
            }
          }
        }
      }

      // The same two keys in an object literal, which is where a spread gets them.
      if (
        (ts.isPropertyAssignment(node) || ts.isShorthandPropertyAssignment(node)) &&
        ts.isObjectLiteralExpression(node.parent)
      ) {
        const name =
          ts.isIdentifier(node.name) || ts.isStringLiteral(node.name) ? node.name.text : '';
        const expression = ts.isPropertyAssignment(node) ? node.initializer : undefined;
        if (SCALING_PROPS.has(name) && !keepsScaling(name, expression)) {
          out.optOuts.push({ file, line: lineOf(node), tag: '{…}', props: [name] });
        }
      }
      node.forEachChild(visit);
    };
    visit(source);
  }

  return out;
}

/**
 * The one exception ADR 0033 names, with its reason, and the only one.
 *
 * `ui/ScaledText` is where the app's own text size is applied. Following the
 * system, which is the default, it scales like every other text; with a size
 * chosen in the settings, that size REPLACES the system's, and the platform's own
 * scaling has to stop for the replacement to be exact rather than a product. The
 * rule above is about who chooses: an opt-out that takes the choice away from a
 * reader is the defect, and this one hands the same reader a different dial with
 * the system's value as the default. Two entries because React Native has two
 * elements that draw text, and both take the prop; the record's condition was one
 * place, and this is one hook, `lib/theme/textScaling`, deciding for both.
 *
 * ADR 0033 is explicit about the alternative: if the scale had to be applied at
 * every call site, the decision should come back to the record instead of this
 * list growing. So an arrival here is the thing to argue about, not a line to add.
 */
const SCALING_OPT_OUTS: Record<string, string> = {
  'components/ui/ScaledText.tsx <Text> allowFontScaling':
    "ADR 0033: the app's text size replaces the system's when a reader chooses one",
  'components/ui/ScaledTextInput.tsx <TextInput> allowFontScaling':
    'ADR 0033: the same replacement, for the text a reader types into a field',
};

/**
 * Every place a raw `Text` or `TextInput` is taken from React Native: a value import
 * (`import { Text } from 'react-native'`, renamed or not), and a property read of
 * one off `Animated` or off a namespace import of the module (`Animated.Text`,
 * `RN.TextInput`). A type-only import is not one, because it draws nothing.
 *
 * Over `.ts` as well as `.tsx`, because a component can be created without JSX.
 * Blind to `require('react-native')` and to a primitive handed in from outside the
 * app, neither of which the app writes.
 */
const RAW_TEXT = new Set(['Text', 'TextInput']);
const SOURCES = filesUnder(SRC, /\.tsx?$/).filter((path) => !DEVELOPER_ONLY.test(under(SRC, path)));

function rawTextUses(): string[] {
  const found: string[] = [];
  for (const path of SOURCES) {
    const file = under(SRC, path);
    const source = ts.createSourceFile(
      path,
      readFileSync(path, 'utf8'),
      ts.ScriptTarget.Latest,
      /* setParentNodes */ true,
      path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );
    // `Animated` always, and whatever name a namespace import of the module took.
    const owners = new Set(['Animated']);
    const visit = (node: ts.Node): void => {
      if (
        ts.isImportDeclaration(node) &&
        ts.isStringLiteral(node.moduleSpecifier) &&
        node.moduleSpecifier.text === 'react-native' &&
        node.importClause &&
        !node.importClause.isTypeOnly
      ) {
        const bindings = node.importClause.namedBindings;
        if (bindings && ts.isNamespaceImport(bindings)) owners.add(bindings.name.text);
        if (bindings && ts.isNamedImports(bindings)) {
          for (const element of bindings.elements) {
            const imported = (element.propertyName ?? element.name).text;
            if (!element.isTypeOnly && RAW_TEXT.has(imported)) found.push(`${file}: ${imported}`);
          }
        }
      }
      if (
        ts.isPropertyAccessExpression(node) &&
        ts.isIdentifier(node.expression) &&
        owners.has(node.expression.text) &&
        RAW_TEXT.has(node.name.text)
      ) {
        found.push(`${file}: ${node.expression.text}.${node.name.text}`);
      }
      node.forEachChild(visit);
    };
    visit(source);
  }
  return found;
}

/**
 * The two files that may draw raw text, because they are where the app's text size
 * is applied. Anything else that imports `Text` draws a line the reader's chosen size
 * never reaches, which looks right at the default and wrong only after somebody has
 * used the setting.
 */
const RAW_TEXT_ALLOWED: Record<string, string> = {
  'components/ui/ScaledText.tsx: Text': 'ADR 0033: the one Text, which applies the app text size',
  'components/ui/ScaledTextInput.tsx: TextInput':
    'ADR 0033: the one TextInput, for the same reason',
};

const app = read();

const at = ({ file, line }: { file: string; line: number }) => `${file}:${line}`;

describe('a control reaches a screen reader', () => {
  it('reads the app it is checking (guards against a silently empty walk)', () => {
    // A walk that parsed nothing writes no offenders, and every assertion below
    // passes over it. Three numbers rather than one, because each rule reads a
    // different part of the tree and a parser that returned only opening tags
    // would still satisfy the first.
    expect(
      floorFaults({
        'files under src/': { found: FILES.length, atLeast: 50 },
        'controls found': { found: app.controls.length, atLeast: 30 },
        'kinds of child element': { found: app.childTags.size, atLeast: 5 },
      }),
    ).toEqual([]);
  });

  it('names every control, from a label or from its own text', () => {
    // The icon-only button, which is the issue's third bullet. A control whose
    // children are all in `RENDERS_NO_TEXT` and which carries no label of its own
    // is announced by TalkBack as its role and nothing else — "Schaltfläche",
    // twelve times down a screen.
    //
    // No exception list, and nothing to excuse: the fix is one prop, and the
    // argument about what it should SAY (the action, not the glyph) is the part a
    // reviewer has to make, which is why a missing one is a failure rather than a
    // line to add here.
    const silent = app.controls
      .filter((control) => !control.label && !control.speaks && !control.spread)
      .map((control) => `${at(control)} → <${control.tag}> has no label and no text child`);

    expect(silent).toEqual([]);
  });

  it('writes no empty accessibilityLabel', () => {
    // `accessibilityLabel=""` is worse than none: an empty name does not fall back
    // to the children, it replaces them, so a control that read fine before goes
    // silent. It is also what a half-finished label looks like, and it typechecks.
    const blank = app.blankLabels.map((use) => `${at(use)} → <${use.tag}> ${use.props[0]}=""`);

    expect(blank).toEqual([]);
  });

  describe('draws text only through the component that applies the app text size', () => {
    // ADR 0033. A raw `Text` is the other way to get a line past the setting, and
    // the one nothing above sees: it opts out of nothing, it simply never asks.
    // `ui/ScaledText` and `ui/ScaledTextInput` are where the size is applied, and
    // `Typo`, `Button`, `Badge` and `Chip` render the first of them.
    const uses = rawTextUses();
    const { arrivals, stale } = ratchet(uses, RAW_TEXT_ALLOWED);

    it('reads the app (guards against a walk that matched no import)', () => {
      expect(
        floorFaults({
          'files read': { found: SOURCES.length, atLeast: FILES.length },
          'raw text found': { found: uses.length, atLeast: 2 },
        }),
      ).toEqual([]);
    });

    it('takes a raw Text or TextInput nowhere else', () => {
      expect(arrivals).toEqual([]);
    });

    it('excuses nothing that is no longer there', () => {
      expect(stale).toEqual([]);
    });
  });

  describe('turns the system font size off nowhere but in the one place', () => {
    // Issue #102: "keep content reachable rather than switching scaling off".
    // `allowFontScaling={false}` and `maxFontSizeMultiplier={1}` are the two ways
    // to make a label ignore the reader's own setting, and both look like a fix for
    // the clipping that `tour-a11y.sh` photographs. The clipping is the bug.
    //
    // Keyed by file, element and prop rather than by line, so an excuse cannot be
    // inherited by whatever lands on its line next, and a second opt-out in the same
    // file is an arrival rather than a free rider.
    const { arrivals, stale } = ratchet(
      app.optOuts.map((use) => `${use.file} <${use.tag}> ${use.props[0]}`),
      SCALING_OPT_OUTS,
    );

    it('acquires no opt-out anywhere else', () => {
      expect(arrivals).toEqual([]);
    });

    it('excuses nothing that is no longer there', () => {
      // The other direction: if the app's scale moves out of `ScaledText`, the
      // excuse has to go with it rather than wait for the next opt-out to land.
      expect(stale).toEqual([]);
    });
  });
});

/**
 * The controls that do not declare a role, with what that costs each one.
 *
 * A `Pressable` with a text child announces its text, so it is not silent — it is
 * announced as TEXT. TalkBack then offers no "Doppeltippen zum Aktivieren", skips
 * it in controls-only navigation, and VoiceOver's rotor does not list it. That is
 * an invisible difference in a screenshot and a whole screen's difference to
 * somebody swiping through it.
 *
 * **Empty, and that is the finished state rather than a missing list.** It held
 * two entries when this file was written — the compact row under "Neueste
 * Recherchen" and Home's early-access card — and #102 gave both an
 * `accessibilityRole="link"`. The pair of assertions below is what makes an empty
 * ledger mean something: the first one now says every control in the app declares
 * a role, and the second one is what stops somebody writing an entry back in for a
 * control they did not want to finish.
 */
const WITHOUT_A_ROLE: Record<string, string> = {};

describe('the controls that still announce as text only', () => {
  const missing = app.controls.filter((control) => !control.role && !control.spread).map(at);
  const { arrivals, stale } = ratchet(missing, WITHOUT_A_ROLE);

  it('acquires no new control without a role', () => {
    expect(arrivals).toEqual([]);
  });

  it('excuses nothing that has since been given one', () => {
    // The direction a one-sided list cannot do, and the one that makes this
    // finishable: the last `accessibilityRole` to arrive takes the last entry above
    // with it, and then the app has no remainder rather than a tolerated one.
    //
    // It also fails when a listed control MOVES, because the excuse is addressed by
    // line. That is deliberate. A line number in an excuse is the thing that goes
    // quietly wrong — the entry stays, the control it named has gone, and the next
    // control to land on that line inherits the permission.
    expect(stale).toEqual([]);
  });
});

/**
 * The images that declare neither a name nor a silence.
 *
 * An `<Image>` with no `accessibilityLabel` is read by iOS as its file name or not
 * at all, and by Android as nothing — so a decorative image and a load-bearing one
 * are indistinguishable from outside, which is the whole point of marking one.
 *
 * **Empty since #102.** The app has exactly one `<Image>`, inside `Thumbnail`, and
 * this file held it open on the grounds that the same component draws a cover
 * beside a headline and the whole of a rail tile. The answer was not in the
 * component: every call site wraps it in a control that already names what the
 * picture is of, so it is decorative in all of them, and it says so with `alt=""`
 * and `accessible={false}`. The reasoning is at that element.
 */
const IMAGES_WITHOUT_A_DECISION: Record<string, string> = {};

describe('every image is named or marked decorative', () => {
  const undeclared = app.images
    .filter((image) => !image.props.some((name) => DECORATIVE.has(name)))
    .map(at);
  const { arrivals, stale } = ratchet(undeclared, IMAGES_WITHOUT_A_DECISION);

  it('finds images at all (guards against a walk that matched no <Image>)', () => {
    expect(floorFaults({ '<Image> elements': { found: app.images.length, atLeast: 1 } })).toEqual(
      [],
    );
  });

  it('acquires no new undeclared image', () => {
    expect(arrivals).toEqual([]);
  });

  it('excuses nothing that has since been declared', () => {
    expect(stale).toEqual([]);
  });
});

/**
 * **What a green run here does NOT mean**, in assertions where it can be held and in
 * prose where it cannot, and at the end rather than buried — the rules above are
 * four mistakes, not a definition of accessible.
 *
 * Invisible to this file, every one of them a real defect:
 *
 *  - **A label that is wrong.** "Bild", "Schaltfläche", the glyph's name instead of
 *    the action. The rule is that one exists, and no parser judges the words.
 *  - **A label that is not a string.** `accessibilityLabel={item.title}` passes, and
 *    the title can be empty — the blank-label rule reads literals only.
 *  - **A prop arriving through `{...rest}`.** `Button` spreads after its own
 *    accessibility props, so a caller can blank one, and the three rules above skip
 *    a control with a spread rather than guess. One control in the app has one.
 *  - **Focus order, and reachability by swipe.** A tree order is not a reading
 *    order, and nothing here reads either.
 *  - **Touch target size**, deliberately. It is 44×44 in the issue and 48×48 dp on
 *    Android, and it is not computable here: a target's height is its text's line
 *    box plus padding written as utility classes, times whatever the reader's font
 *    scale is — three numbers, none of them in the JSX. A rule over the classes
 *    alone would pass the buttons that grow with their text and fail the icons that
 *    `hitSlop` already covers, which is a check that fires on the wrong twelve
 *    sites. It is measured on the device instead, from `uiautomator`'s own bounds:
 *    `screens/tools/tour-a11y.sh`, which reports every clickable node under 48 dp.
 *  - **Anything at 200 % font.** Clipping, overlap, a control pushed off screen.
 *    Same tour, and the pictures are the evidence.
 */
describe('the list the walk is held to', () => {
  it('excuses only components the app actually puts inside a control', () => {
    // `RENDERS_NO_TEXT` is the one list that can make the labelling rule vacuous:
    // every name on it is a component the walk collects nothing from, so a stale
    // entry is a standing permission for a component that no longer exists and a
    // generous one is an excuse for a component that speaks. Held to the app, it
    // can only be as long as the app makes it.
    const stale = [...RENDERS_NO_TEXT].filter((tag) => !app.childTags.has(tag));

    expect(stale.sort()).toEqual([]);
  });
});
