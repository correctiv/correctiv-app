/**
 * The nearest ancestor that actually scrolls.
 *
 * Its own leaf because two callers with nothing else in common need it, and the walk is
 * the part neither of them wants to own. `frame/reveal.ts` brings a marked element into
 * view **inside the framed app's document**, and says at length why it may not use
 * `scrollIntoView` to do it; `preview/home/HomeDocument.tsx` scrolls **this** document's
 * panel while a block is being carried to its edge. One mechanism, and each caller keeps
 * the argument for its own rule, which is the division `packages/prose-and-code`'s README
 * draws for the checks.
 *
 * **A walk and not a known element**, which is the question worth answering here. On the
 * panel's side the box that scrolls is `ui/ToolPanel.tsx`'s, and a tool does not own the
 * shell it is mounted in: reaching for it by class would be the editor asserting the
 * panel's markup, and it would go quietly wrong the day the shell grows a box between
 * them. On the frame's side there is no candidate to name at all, because the document
 * belongs to the app.
 *
 * "Actually" is the `scrollHeight > clientHeight` test, and it is the whole reason this is
 * not a one-liner: both trees are full of boxes with `overflow: auto` that have nothing to
 * scroll, and the first of those would swallow the scroll and move nothing.
 */
export function scroller(node: Element | null): Element | null {
  const view = node?.ownerDocument.defaultView;
  if (!node || !view) return null;

  for (let held = node.parentElement; held !== null; held = held.parentElement) {
    const overflow = view.getComputedStyle(held).overflowY;
    if ((overflow === 'auto' || overflow === 'scroll') && held.scrollHeight > held.clientHeight) {
      return held;
    }
  }

  const root = node.ownerDocument.scrollingElement;
  return root !== null && root.scrollHeight > root.clientHeight ? root : null;
}
