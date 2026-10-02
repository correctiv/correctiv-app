import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from 'react';

import type { SectionId } from './views';

/**
 * What a tool offers to do with its own work, as the header draws it.
 *
 * Every tool that holds changes registers one of these, and `ui/ToolActions.tsx` is the
 * only place that renders buttons for it, always at the right end of the header. The
 * tools keep their state and their wording of results; they hand over only what the
 * header needs to draw and to call.
 */
export interface ToolActions {
  /**
   * Whether the tool holds changes. Submit, save, share and discard are switched off
   * without it, and are still drawn: a button that appears only when there is something to
   * do moves every other control in the bar each time somebody types.
   */
  dirty: boolean;
  /** How many things changed, where the tool counts; the header says "changed" otherwise. */
  count?: number;
  /**
   * Why submit and save are off although the tool holds changes, **in the reader's
   * language**, because the submit button's tooltip says it while they are off
   * (`ui/ToolActions.tsx`). A boolean left a disabled button whose only reason
   * lived in the panel, which is the half a reader cannot reach from the header.
   *
   * A formatted string rather than a descriptor, for `String(Problem)`: the tools
   * already hand this registry their wording of results, and a reason with a code
   * list in it has to be formatted by the tool that knows the codes. Undefined
   * while nothing blocks the tool, and the tooltip then says what a clean tool has
   * instead.
   */
  blocked?: string;
  /**
   * Submit is a link, because the click leaves for GitHub in a new tab and only a link
   * opens one without a popup blocker in the way (ADR 0061 §1). `null` while there is
   * nothing it may send; the button is then drawn disabled.
   */
  submit?: { href: string; onClick?: () => void } | null;
  /**
   * Hands the tool's draft over as a link (ADR 0076). `run` builds it and puts it on the
   * clipboard; what came of that is the tool's own news, in its own panel, because a
   * sentence about a link does not belong in a header that is 32 pixels tall.
   */
  share?: { run: () => void };
  /** The dev server's save. Absent on the published site, on every tool alike. */
  save?: { run: () => void; busy?: boolean };
  /** Puts the tool's changes back to what ships. */
  discard?: () => void;
}

type Entry = ToolActions;

/**
 * A small external store rather than state in a provider: a tool calls `useToolActions`
 * on every render, because its callbacks close over its state, and a provider holding
 * that in `useState` would re-render the whole shell for each of those calls. Only the
 * fields the header draws are compared before it is told.
 */
class ActionStore {
  private readonly entries = new Map<SectionId, Entry>();
  private readonly listeners = new Set<() => void>();
  private version = 0;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getVersion = () => this.version;

  get(tool: SectionId): Entry | undefined {
    return this.entries.get(tool);
  }

  set(tool: SectionId, next: Entry | null): void {
    const before = this.entries.get(tool);
    if (next === null) this.entries.delete(tool);
    else this.entries.set(tool, next);
    if (!drawsTheSame(before, next ?? undefined)) {
      this.version += 1;
      for (const listener of this.listeners) listener();
    }
  }
}

function drawsTheSame(a: Entry | undefined, b: Entry | undefined): boolean {
  if (a === undefined || b === undefined) return a === b;
  return (
    a.dirty === b.dirty &&
    a.count === b.count &&
    a.blocked === b.blocked &&
    (a.submit?.href ?? null) === (b.submit?.href ?? null) &&
    (a.share === undefined) === (b.share === undefined) &&
    (a.save === undefined) === (b.save === undefined) &&
    a.save?.busy === b.save?.busy &&
    (a.discard === undefined) === (b.discard === undefined)
  );
}

interface Registry {
  store: ActionStore;
  /** The tool whose panel is open, which is the one whose actions the header draws. */
  active: SectionId | null;
}

const ActionsContext = createContext<Registry | null>(null);

export function ActionsProvider({
  active,
  children,
}: {
  active: SectionId | null;
  children: ReactNode;
}) {
  const store = useRef<ActionStore>(null);
  store.current ??= new ActionStore();
  const value = useMemo(() => ({ store: store.current as ActionStore, active }), [active]);
  return <ActionsContext.Provider value={value}>{children}</ActionsContext.Provider>;
}

function useRegistry(): Registry {
  const registry = useContext(ActionsContext);
  if (registry === null)
    throw new Error('A tool\u2019s actions need an ActionsProvider above them.');
  return registry;
}

/**
 * Called by a tool, on every render, with what it can do now.
 *
 * The entry is replaced rather than merged, so a tool that stops offering something
 * stops drawing it. It is removed when the tool unmounts.
 */
export function useToolActions(tool: SectionId, actions: ToolActions): void {
  const { store } = useRegistry();
  // After every render, so the callbacks the header calls are never a commit behind, and
  // in an effect because telling the header during another component's render is an error.
  useEffect(() => {
    store.set(tool, actions);
  });
  useEffect(() => () => store.set(tool, null), [store, tool]);
}

/** The header's side: what the open tool registered, or nothing. */
export function useActiveActions(): ToolActions | null {
  const { store, active } = useRegistry();
  useSyncExternalStore(store.subscribe, store.getVersion, store.getVersion);
  return active === null ? null : (store.get(active) ?? null);
}
