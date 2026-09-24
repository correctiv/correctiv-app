import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';
import { Provider } from 'react-redux';

import { Localisation } from '@/i18n/Localisation';
import { coreStore } from '@/lib/store/core';
import { TextSizeProvider } from '@/lib/theme/textScaling';

/**
 * Shared screen-rendering helpers.
 *
 * Not a `.test.tsx`, so jest's testMatch ignores it (`**\/__tests__/**\/*.test.*`).
 *
 * Every helper here that reads a tree goes through `walkHostNodes`, because the
 * copies that did their own walking disagreed with each other about what a
 * component had rendered. Each function below says what it asks of the tree.
 */

/**
 * The screens use SafeAreaView, which needs metrics — there is no native view to
 * measure in a test. Deliberately NOT react-native-safe-area-context/jest/mock:
 * that mock reports zero insets, and several assertions here are about what a real
 * device's insets push out of view. Explicit metrics keep the numbers honest and
 * the same for every test.
 */
export const METRICS: Metrics = {
  frame: { x: 0, y: 0, width: 402, height: 760 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const mounted: ReactTestRenderer[] = [];

/**
 * Every tree is unmounted after its test. Leaking them is not cosmetic: a mounted
 * screen stays subscribed to the store, so a reset in the next `beforeEach`
 * re-renders it and its effects run into the following test.
 */
afterEach(() => {
  act(() => {
    for (const tree of mounted) tree.unmount();
  });
  mounted.length = 0;
});

export function render(element: React.ReactElement): ReactTestRenderer {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = create(
      <Provider store={coreStore}>
        {/* The same provider `lib/env/AppEnvironment.tsx` mounts, and for the same
            reason: a component that formats a message finds none otherwise. This
            list is short of that environment on purpose — fonts and the gesture
            root are what a device has and a test tree does not. */}
        <Localisation>
          <TextSizeProvider>
            <SafeAreaProvider initialMetrics={METRICS}>{element}</SafeAreaProvider>
          </TextSizeProvider>
        </Localisation>
      </Provider>,
    );
  });
  mounted.push(tree);
  return tree;
}

/** One rendered host node: what the platform receives, not what a component was given. */
export interface HostNode {
  type: string;
  props: Record<string, unknown>;
  /**
   * Everything under it, joined without breaks, so a split label reads whole.
   *
   * A getter, because `renderedText` below never reads it and would otherwise pay
   * for a full subtree join at every node of the tree it is already walking.
   */
  readonly text: string;
}

/**
 * One walk of `tree.toJSON()`, for the two questions the suites here ask of a tree.
 *
 * `toJSON()` and not `root.findAll`, and the difference is the point: `findAll`
 * matches component instances, where a prop is whatever the caller wrote, and this
 * answers for the nodes a PLATFORM receives, where a default has been applied and a
 * style array has not yet been flattened.
 *
 * Three callbacks rather than one, because `renderedText` needs to know where an
 * element ENDS and not only that it began: its line breaks go around an element and
 * between two of them, which a flat visitor cannot express. `onString` fires for
 * text wherever it sits, including inside a nested `Text`.
 */
export function walkHostNodes(
  tree: ReactTestRenderer,
  visit: {
    onEnter?: (node: HostNode) => void;
    onExit?: (node: HostNode) => void;
    onString?: (text: string) => void;
  },
): void {
  const step = (node: unknown): void => {
    if (typeof node === 'string') {
      visit.onString?.(node);
      return;
    }
    if (Array.isArray(node)) {
      for (const child of node) step(child);
      return;
    }
    if (!node || typeof node !== 'object' || !('children' in node)) return;
    const raw = node as { type?: string; props?: Record<string, unknown>; children: unknown };
    const host: HostNode = {
      type: raw.type ?? '',
      props: raw.props ?? {},
      get text() {
        return flatText(raw.children);
      },
    };
    visit.onEnter?.(host);
    step(raw.children);
    visit.onExit?.(host);
  };
  step(tree.toJSON());
}

/** Every string under a node, joined with nothing. */
function flatText(node: unknown): string {
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) return node.map(flatText).join('');
  if (node && typeof node === 'object' && 'children' in node) {
    return flatText((node as { children: unknown }).children);
  }
  return '';
}

/** A `Text` holds its own children on one line; every other element gets a break. */
const isText = (node: HostNode): boolean => node.type === 'Text' || node.type === 'RCTText';

/**
 * Everything the tree renders as text; one line per element, no split words.
 *
 * This started as a copy in every screen test, and the copies disagreed: joining
 * every string with a newline turns `Schritt {n} von {total}` — one Text with four
 * children — into four lines, so the obvious assertion fails on markup that is
 * perfectly correct. This joins within a Text and breaks only between elements.
 */
export function renderedText(tree: ReactTestRenderer): string {
  const parts: string[] = [];
  walkHostNodes(tree, {
    onString: (text) => parts.push(text),
    onEnter: (node) => {
      if (!isText(node)) parts.push('\n');
    },
    onExit: (node) => {
      if (!isText(node)) parts.push('\n');
    },
  });
  return parts.join('');
}

/** Pressables carrying this accessibility label — several is normal (a list). */
export function findAllPressable(tree: ReactTestRenderer, label: string): ReactTestInstance[] {
  return tree.root.findAll(
    (node) => node.props?.accessibilityLabel === label && typeof node.props?.onPress === 'function',
  );
}

export function findPressable(tree: ReactTestRenderer, label: string): ReactTestInstance {
  const [first] = findAllPressable(tree, label);
  if (!first) throw new Error(`No pressable labelled "${label}"`);
  return first;
}

/** Presses the first pressable with that label. */
export function press(tree: ReactTestRenderer, label: string): void {
  const node = findPressable(tree, label);
  act(() => {
    node.props.onPress();
  });
}

export function isDisabled(tree: ReactTestRenderer, label: string): boolean {
  return Boolean(findPressable(tree, label).props.accessibilityState?.disabled);
}

/** Types into the input with that accessibility label. */
export function typeInto(tree: ReactTestRenderer, label: string, value: string): void {
  const field = tree.root.find(
    (node) => node.props?.accessibilityLabel === label && !!node.props?.onChangeText,
  );
  act(() => {
    field.props.onChangeText(value);
  });
}
