import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';

import type { SectionId } from './views';

/**
 * Where a page may put something the shell draws.
 *
 * A section's body is its own id. `<id>:mark` is the one thing that may sit on
 * that section's icon in the rail while the panel is shut, and it is deliberately
 * the narrowest of the three slots: **a number the reader would act on, or
 * nothing.** It was `<id>:tags`, a row of badges beside a section title, and it
 * filled with `untouched`, `inert here`, `combination unknown` and
 * `findings, not run` — four ways of saying that nothing has happened, taking up
 * room on a permanent rail. Two survive the rename, the console's warnings and
 * errors and the measure run's findings, and both draw nothing at zero.
 * ([ADR 0038](../../../../adr/0038-one-tool-at-a-time-in-a-rail.md))
 *
 * The other two are the header's context bar and the status line.
 */
export type SlotId = SectionId | `${SectionId}:mark` | 'context-bar' | 'status';

interface Slots {
  targets: Partial<Record<SlotId, HTMLElement>>;
  register: (id: SlotId, element: HTMLElement | null) => void;
  declared: ReadonlySet<SlotId>;
}

const SlotContext = createContext<Slots | null>(null);

function useSlots(): Slots {
  const slots = useContext(SlotContext);
  if (slots === null) throw new Error('A Slot needs a SlotProvider above it.');
  return slots;
}

/**
 * The shell's side of the contract: it holds the elements, the pages fill them.
 *
 * Why portals rather than a page returning a `{ sections }` object. A page's
 * state has to be in one tree: `/components`' filter is read by the header bar
 * and by the grid, `/design`'s loaded flag by the main area and by the reload
 * button, the detail route's rendering switch by the panel and by the stage. With
 * a portal each of those stays an ordinary `useState` in the page, and React
 * context crosses a portal unchanged. And the shell still knows whether a panel
 * exists before the page's first render, because that comes from `VIEWS` and not
 * from what the page has rendered yet.
 */
export function SlotProvider({
  declared,
  children,
}: {
  declared: ReadonlySet<SlotId>;
  children: ReactNode;
}) {
  const [targets, setTargets] = useState<Partial<Record<SlotId, HTMLElement>>>({});

  const register = useCallback((id: SlotId, element: HTMLElement | null) => {
    setTargets((current) => {
      if (element === null) {
        if (!(id in current)) return current;
        const next = { ...current };
        delete next[id];
        return next;
      }
      if (current[id] === element) return current;
      return { ...current, [id]: element };
    });
  }, []);

  const value = useMemo(() => ({ targets, register, declared }), [targets, register, declared]);
  return <SlotContext.Provider value={value}>{children}</SlotContext.Provider>;
}

/**
 * Rendered by the shell, where the slot's content belongs.
 *
 * `as="span"` for the one target that sits inside a button: a section's mark is
 * on its icon in the rail, and a `div` inside a `button` is content a browser is
 * allowed to reparent.
 *
 * `data-slot` names it in the rendered document. A slot target is empty in the
 * markup — its content arrives from somewhere else in the tree — so without the
 * attribute it is an anonymous div, and both devtools and
 * `test/shell/tool-panel.test.tsx` would have to identify it by its class list.
 */
export function SlotTarget({
  id,
  className,
  as: Element = 'div',
}: {
  id: SlotId;
  className?: string;
  as?: 'div' | 'span';
}) {
  const ref = useRef<HTMLElement>(null);
  const { register } = useSlots();

  useEffect(() => {
    register(id, ref.current);
    return () => register(id, null);
  }, [id, register]);

  return <Element ref={ref as never} data-slot={id} className={className} />;
}

/**
 * Rendered by a page, from wherever in its own tree suits it.
 *
 * A slot the open route did not declare draws nothing and says so once, in
 * development. `test/shell.test.ts` is the half that runs in CI: it reads every
 * page as text, collects its `Slot` ids, and fails on one the table has no place
 * for as well as on a declared section nobody fills.
 */
export function Slot({ id, children }: { id: SlotId; children: ReactNode }) {
  const { targets, declared } = useSlots();

  useEffect(() => {
    if (import.meta.env.DEV && !declared.has(id)) {
      console.warn(`[workbench] slot "${id}" is not declared for this view, so it draws nothing.`);
    }
  }, [declared, id]);

  const target = targets[id];
  return target ? createPortal(children, target) : null;
}

/** Every slot a declaration offers, which is what `SlotProvider` is given. */
export function slotsOf(view: {
  sections: readonly SectionId[];
  contextBar: boolean;
  statusBar: boolean;
}): ReadonlySet<SlotId> {
  const ids: SlotId[] = [];
  for (const section of view.sections) ids.push(section, `${section}:mark`);
  if (view.contextBar) ids.push('context-bar');
  if (view.statusBar) ids.push('status');
  return new Set(ids);
}
