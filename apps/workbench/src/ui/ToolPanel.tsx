import { useWorkbenchIntl } from '../i18n/Localisation';
import { SlotTarget } from '../shell/slots';
import { SECTION_TITLES, type SectionId, type ViewDeclaration } from '../shell/views';

/**
 * The id `ToolRail`'s `aria-controls` points at, so the pair is one fact.
 *
 * The disclosure relationship the rail argues for is two literals agreeing, and a
 * rename of either would break it with nothing failing: the attribute would name an
 * element that is not there, and a screen reader would announce a button that
 * expands nothing.
 */
export const TOOL_PANEL_ID = 'tool-panel';

/**
 * The right panel: one tool, the whole height, and no way to shut it from inside.
 *
 * One component for a document's contents, the design tools, a component's props
 * and the preview's inspector, because they are the same furniture: a name, and
 * a surface belonging to the open view. Which tools there are is the route's
 * declaration; what is inside each is the page's, through the slots.
 *
 * It used to be a scrolling column of collapsible sections, all of them sharing
 * the panel's height. `/preview` declares six, so each got a sliver of a
 * thirty-one per cent column and each needed a sentence explaining what the
 * sliver was. One at a time is the answer, and it is the rail's answer: the
 * switch is `ui/ToolRail.tsx`, this draws whatever the switch chose.
 * ([ADR 0038](../../../../adr/0038-one-tool-at-a-time-in-a-rail.md))
 *
 * **Every tool's body stays mounted and the shut ones are `hidden`**, which is the
 * one piece of knowledge carried over from the accordion this replaces. Unmount a
 * tool and its slot target goes with it; with the target gone the page's `Slot`
 * renders nothing, so the console's level filter and the component route's device
 * choice would both reset every time somebody looked at another tool and came
 * back. The accordion learnt this as Radix's `forceMount`, which then needed an
 * explicit `hidden` beside it because `forceMount` is what takes Radix's own
 * `hidden` away. Here there is no Radix in the way and `hidden` is written once,
 * on a wrapper that carries no `display` of its own — a `flex` class on the same
 * element beats the user agent's `[hidden]` rule and puts every tool back on
 * screen at once, which is how the accordion failed before. `hidden` is
 * `display: none`, so a shut tool is out of the accessibility tree either way.
 */
export function ToolPanel({
  view,
  tool,
}: {
  view: ViewDeclaration;
  /** The one tool showing, or `null` while the panel is shut. */
  tool: SectionId | null;
}) {
  // Before the early return, because it is a hook and a panel-less view takes that
  // branch on its very first render.
  const intl = useWorkbenchIntl();
  if (view.panelTitle === null) return null;

  return (
    <aside
      id={TOOL_PANEL_ID}
      aria-label={intl.formatMessage(view.panelTitle)}
      className="flex h-full min-h-0 flex-col bg-canvas"
    >
      <div className="flex h-[2.25rem] shrink-0 items-center border-b border-stroke px-s">
        <h2 className="truncate text-s font-semibold uppercase tracking-wider text-on-canvas-muted">
          {intl.formatMessage(tool === null ? view.panelTitle : SECTION_TITLES[tool])}
        </h2>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {view.sections.map((id) => (
          // `data-tool` names the wrapper in the rendered document, the way
          // `data-slot` names a target: it carries no class, so without it both
          // devtools and `test/shell/tool-panel.test.tsx` would be identifying the
          // one element in here that matters by its position among its siblings.
          <div key={id} data-tool={id} hidden={id !== tool}>
            <SlotTarget id={id} className="flex flex-col gap-s p-s" />
          </div>
        ))}
      </div>
    </aside>
  );
}
