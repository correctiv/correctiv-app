/**
 * @jest-environment jsdom
 */
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { ReactElement } from 'react';

import { useDocumentTitle } from '@/lib/navigation/documentTitle.web';

/**
 * The browser tab, when more than one screen is mounted.
 *
 * The obvious implementation of this — read `document.title` on mount, write it
 * back on unmount — is correct for a push and a pop, which is how it got written
 * and how it was checked in a browser. It is wrong when two screens go in one
 * commit: React runs cleanups in tree order, the screen underneath restores
 * first, and the screen on top then writes the underneath one's title back over
 * it. The app has exactly one path that does it, `formular.tsx`'s
 * `router.dismissTo('/(tabs)/mitmachen')` over `(tabs) > /aufruf/[slug]` >
 * `/formular`, and it cannot be driven from a test that types into the form,
 * because the step button stays `aria-disabled` under synthetic input. So the
 * defect is proved here, at the level it actually lives on (ADR 0030).
 *
 * `.web` explicitly: on a device this module is a no-op with the same signature,
 * and jest resolves the native half. jsdom explicitly for the same reason — the
 * whole subject of this file is a document, and the app's suite runs without one.
 */
function Screen({ title }: { title: string }) {
  useDocumentTitle(title);
  return null;
}

/**
 * What the tab goes back to when nothing is naming it. jsdom serves an empty
 * `<title>`, and so, as it happens, does the app's static export.
 */
const SERVED = '';

/** A render, with the effects flushed, which is where every title is written. */
function mount(node: ReactElement): ReactTestRenderer {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = create(node);
  });
  return tree;
}

function show(tree: ReactTestRenderer, node: ReactElement): void {
  act(() => {
    tree.update(node);
  });
}

describe('the browser tab', () => {
  it('takes the name of the screen on top', () => {
    const tree = mount(<Screen title="Backstage" />);
    expect(document.title).toBe('Backstage');

    show(
      tree,
      <>
        <Screen title="Backstage" />
        <Screen title="Artikel" />
      </>,
    );
    expect(document.title).toBe('Artikel');

    // The pop: the screen underneath is still mounted and gets its name back.
    show(tree, <Screen title="Backstage" />);
    expect(document.title).toBe('Backstage');

    act(() => {
      tree.unmount();
    });
    expect(document.title).toBe(SERVED);
  });

  it('is not left naming a dismissed screen when two go at once', () => {
    const tree = mount(
      <>
        <Screen title="Mitmach-Aufruf" />
        <Screen title="Mitmach-Formular" />
      </>,
    );
    expect(document.title).toBe('Mitmach-Formular');

    // `dismissTo`: both screens leave in one commit and the tab underneath them
    // has no name of its own. Save-and-restore leaves "Mitmach-Aufruf" here.
    show(tree, <></>);
    expect(document.title).toBe(SERVED);

    act(() => {
      tree.unmount();
    });
  });

  it('follows a screen that renames itself', () => {
    const tree = mount(<Screen title="Projekt" />);
    show(tree, <Screen title="Podcast-Serie" />);
    expect(document.title).toBe('Podcast-Serie');

    act(() => {
      tree.unmount();
    });
    expect(document.title).toBe(SERVED);
  });
});
