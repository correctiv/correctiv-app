import {
  Braces,
  Crosshair,
  Database,
  Download,
  ExternalLink,
  FileCode,
  GitBranch,
  Layers,
  LayoutList,
  ListTree,
  Palette,
  Ruler,
  Smartphone,
  SunMoon,
  Terminal,
  type LucideIcon,
} from 'lucide-react';
import { defineMessages } from 'react-intl';

import { useWorkbenchIntl } from '../i18n/Localisation';
import { cn } from '../lib/cn';
import { SlotTarget } from '../shell/slots';
import { SECTION_TITLES, type SectionId, type ViewDeclaration } from '../shell/views';
import { Tooltip, TooltipContent, TooltipTrigger } from './kit/tooltip';
import { TOOL_PANEL_ID } from './ToolPanel';

/**
 * The one sentence this file writes itself, in ENGLISH; the German that ships is
 * `src/i18n/catalogue/de/shell.ts`.
 *
 * Every other word on the rail is a section's own name out of `shell/views.ts`,
 * which is where those descriptors live because the ids are in the URL. This is
 * the half the rail adds on top: the tooltip on the tool that is already open says
 * what a second press does, which is the whole of the toggle ADR 0038 argues for.
 */
const COPY = defineMessages({
  closeTip: {
    id: 'shell.rail.closeTip',
    defaultMessage: '{tool} · press to close',
    description:
      'The tooltip on the rail button of the tool that is open, where pressing shuts the panel. {tool} is that tool’s own name, already translated — shell.section.console and its neighbours.',
  },
});

/**
 * The mark beside each tool's name.
 *
 * Beside the chrome that draws it rather than in `shell/views.ts`, which is pure
 * data so a test can read the table without pulling React in. Keyed by the same
 * type as `SECTION_TITLES`, so a section with a title and no icon does not
 * compile.
 */
const SECTION_ICONS: Record<SectionId, LucideIcon> = {
  contents: ListTree,
  appearance: SunMoon,
  state: Database,
  home: LayoutList,
  console: Terminal,
  tokens: Palette,
  measure: Ruler,
  inspect: Crosshair,
  'design-links': ExternalLink,
  'design-clients': Download,
  'design-code': GitBranch,
  rendering: Layers,
  device: Smartphone,
  props: Braces,
  source: FileCode,
};

/**
 * The rail that opens one tool, and the only switch the right panel has.
 *
 * The mirror image of `ActivityBar` on the other edge, and the same idea one
 * level down: the left rail reaches any view from any view, this one reaches any
 * tool of the open view from any other. It is always there, whether or not the
 * panel is, which is what lets the panel start shut without the tools becoming
 * invisible — the six that used to be stacked accordions are six icons a reader
 * can see and count before pressing anything.
 *
 * **Pressing the open tool shuts the panel.** That is the whole of the toggle.
 * The header used to carry a `PanelRight` button and the panel a
 * `PanelRightClose` button, both of which shut the same panel and showed nearly
 * the same icon, and neither of them said which of the six things inside was
 * about to appear. ([ADR 0038](../../../../adr/0038-one-tool-at-a-time-in-a-rail.md))
 *
 * `aria-expanded` and `aria-controls` rather than `aria-pressed`: this is a
 * disclosure, the panel is what it discloses, and the panel carries the matching
 * id. A screen reader then says "Console, collapsed" on the same control that a
 * sighted reader sees lit, which is the pair `<details>` cannot be given and a
 * rail that lives outside the thing it opens needs.
 *
 * 2.75rem, which is 44 CSS px. The preview's own Measure check fails a control
 * under that, and a rail that could not pass the check it ships would be the
 * easiest finding in the building.
 */
export function ToolRail({
  view,
  tool,
  onTool,
  orientation,
}: {
  view: ViewDeclaration;
  tool: SectionId | null;
  onTool: (next: SectionId | null) => void;
  /** `column` on the right edge, `row` along the bottom below the wide breakpoint. */
  orientation: 'column' | 'row';
}) {
  // Before the early return, because it is a hook and the panel-less views take
  // that branch on their very first render.
  const intl = useWorkbenchIntl();
  if (view.panelTitle === null) return null;
  const column = orientation === 'column';

  return (
    <nav
      aria-label={intl.formatMessage(view.panelTitle)}
      className={cn(
        'flex shrink-0 items-center gap-3xs border-stroke bg-surface',
        column ? 'w-[3rem] flex-col border-l py-xs' : 'h-[3rem] justify-center border-t px-xs',
      )}
    >
      {view.sections.map((id) => {
        const Icon = SECTION_ICONS[id];
        const open = tool === id;
        const title = intl.formatMessage(SECTION_TITLES[id]);
        return (
          <Tooltip key={id}>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-expanded={open}
                aria-controls={TOOL_PANEL_ID}
                onClick={() => onTool(open ? null : id)}
                className={cn(
                  'relative flex size-[2.75rem] items-center justify-center rounded-md transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                  open
                    ? 'bg-canvas text-on-canvas'
                    : 'text-on-canvas-muted hover:bg-canvas hover:text-on-canvas',
                )}
              >
                {/* The open mark is a bar rather than a fill alone, so which tool
                    is showing is legible without relying on colour. On the inner
                    edge in both orientations, which is the edge the panel is on,
                    and INSIDE the button: the rail is 3rem around a 2.75rem
                    target, so an inner edge two pixels further out is two pixels
                    outside the rail, and it was drawn over the panel. */}
                {open && (
                  <span
                    aria-hidden="true"
                    className={cn(
                      'absolute rounded-full bg-accent',
                      column ? 'inset-y-2xs left-0 w-[2px]' : 'inset-x-2xs top-0 h-[2px]',
                    )}
                  />
                )}
                <Icon aria-hidden="true" className="size-[1.125rem]" />
                <span className="sr-only">{title}</span>
                {/* A number the reader would act on, or nothing at all: the slot
                    is empty on every tool that has none, and `empty:hidden`
                    means an empty one takes no room and paints no dot.

                    Inset rather than hung off the corner, for the same reason as
                    the bar: hung off, a two-digit count was cut in half by the
                    edge of the window. */}
                <SlotTarget
                  id={`${id}:mark`}
                  as="span"
                  className="absolute right-4xs top-4xs empty:hidden"
                />
              </button>
            </TooltipTrigger>
            <TooltipContent side={column ? 'left' : 'top'}>
              {open ? intl.formatMessage(COPY.closeTip, { tool: title }) : title}
            </TooltipContent>
          </Tooltip>
        );
      })}
    </nav>
  );
}
