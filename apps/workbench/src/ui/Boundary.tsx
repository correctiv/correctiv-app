import { Component, type ErrorInfo, type ReactNode } from 'react';
import { defineMessages } from 'react-intl';

import { useWorkbenchIntl } from '../i18n/Localisation';
import { Button } from './kit/button';

/**
 * What the failed view says, in ENGLISH; the German that ships is
 * `src/i18n/catalogue/de/shell.ts`.
 *
 * **This one CAN be a message, and the app's recovery screen cannot** — worth
 * saying, because AGENTS.md names that exemption and it does not apply here. The
 * app's recovery screen is rendered by an error boundary that sits ABOVE the app's
 * provider, so the provider is inside the subtree being caught and is gone by the
 * time the screen draws. This boundary wraps the main area only: `Localisation` is
 * mounted in `App.tsx` outside it, so a view that throws leaves the provider
 * standing, along with the header and the rails.
 *
 * `data-view-failed` on the element is NOT prose and stays an attribute.
 * `scripts/renders.mjs` reads it rather than the heading below for exactly this
 * reason — a heading is something somebody rewords, and now also something
 * somebody translates, and a check looking for the words would go quietly green in
 * German.
 */
const COPY = defineMessages({
  heading: { id: 'shell.boundary.heading', defaultMessage: 'This view did not render' },
  lead: {
    id: 'shell.boundary.lead',
    defaultMessage:
      'The rest of the workbench still works: pick another section on the left, or press <kbd>⌘K</kbd> to search. The error is below and in the browser console.',
    description:
      'Under the heading of a view that threw. The tag wraps the key combination, drawn as a keycap.',
  },
  retry: {
    id: 'shell.boundary.retry',
    defaultMessage: 'Try this view again',
    description:
      'Clears the error and renders the same route once more, for a failure that was a one-off rather than a bug in the view.',
  },
});

/** The keycap inside `shell.boundary.lead`, at module scope so it is one component. */
const kbd = (chunks: ReactNode[]) => (
  <kbd className="rounded-s border border-stroke px-3xs font-mono text-s">{chunks}</kbd>
);

/**
 * The difference between "something broke" and a black rectangle.
 *
 * A React tree with no boundary in it unmounts on any throw, and what the reader
 * gets is an empty page with nothing in it to read, report or recover from. This
 * site had exactly that: a panel library threw on the fourth navigation and the
 * whole workbench went dark.
 *
 * It wraps the main area only. The rail, the header and the status line stay, so
 * the way out is still on screen, which is the point: the reader is one click
 * from a view that works rather than one reload from starting over.
 *
 * That is also why the failed state carries `data-view-failed`. Wrapping only the
 * main area means a route that throws still leaves a header, a rail and a status
 * line in `#root` — a page with plenty of elements and plenty of words, every one
 * of them this component's apology — and `scripts/renders.mjs` asking only whether
 * something mounted would call that a rendered workbench. It reads this attribute
 * instead of the heading below it, because a heading is prose somebody will reword
 * and the check would go quietly green. `test/renders.test.ts` holds the two ends
 * together.
 */
interface Props {
  children: ReactNode;
  route: string;
}

interface State {
  error: Error | null;
  /** The route the error belongs to, so leaving it clears it. */
  route: string;
}

export class Boundary extends Component<Props, State> {
  state: State = { error: null, route: this.props.route };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  /**
   * A different view is a fresh attempt.
   *
   * Derived from the props rather than set in `componentDidUpdate`, which the
   * linter refuses and is right to: that would render the failure once more
   * before clearing it. Without this the reader stays on the error after
   * navigating away from it, until they reload.
   */
  static getDerivedStateFromProps(props: Props, state: State): State | null {
    return props.route === state.route ? null : { error: null, route: props.route };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Kept, because the browser's own console is where this lands. The
    // preview's console panel is patched onto the frame's window and never
    // this one, so nothing on the site would carry the message otherwise.
    console.error('[workbench] view failed', error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <Failed
        route={this.props.route}
        message={error.message}
        onRetry={() => {
          this.setState({ error: null, route: this.props.route });
        }}
      />
    );
  }
}

/**
 * The apology, as a function component, because a class cannot call a hook.
 *
 * Split out for that one reason and no other. Everything the boundary is for — the
 * catching, the clearing on a route change, the console line — stays in the class
 * above; this is what it draws once it has caught something.
 */
function Failed({
  route,
  message,
  onRetry,
}: {
  route: string;
  message: string;
  onRetry: () => void;
}) {
  const intl = useWorkbenchIntl();

  return (
    <div data-view-failed={route} className="px-m py-2xl lg:px-ml">
      <h1 className="text-headline-l font-semibold">{intl.formatMessage(COPY.heading)}</h1>
      <p className="mt-s max-w-content text-m leading-relaxed text-on-canvas-muted">
        {intl.formatMessage(COPY.lead, { kbd })}
      </p>
      {/* The error itself is the browser's or a library's, and is never translated. */}
      <pre className="mt-m max-w-content overflow-x-auto rounded-md border border-stroke bg-surface p-sm text-s">
        {message}
      </pre>
      <Button variant="outline" className="mt-m" onClick={onRetry}>
        {intl.formatMessage(COPY.retry)}
      </Button>
    </div>
  );
}
