import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react';
import { defineMessages } from 'react-intl';

import api from 'virtual:api';
import docsModule from 'virtual:docs';
import { DIAGRAMS } from './diagrams';
import { ComponentDetail } from './pages/ComponentDetail';
import { Components } from './pages/Components';
import { Design } from './pages/Design';
import { DiagramIndex } from './pages/DiagramIndex';
import { DiagramView } from './pages/DiagramView';
import { Handbook } from './pages/Handbook';
import { Document } from './pages/Document';
import { Landing } from './pages/Landing';
import { Reference } from './pages/Reference';
import { Strings } from './pages/Strings';
import { Decisions } from './pages/Decisions';
import { Sources } from './pages/Sources';
import { Preview } from './pages/Preview';
import { ActivityBar } from './ui/ActivityBar';
import { Boundary } from './ui/Boundary';
import { Header } from './ui/Header';
import { Search } from './ui/Search';
import { Settings } from './ui/Settings';
import { ShowChrome } from './ui/ShowChrome';
import { StatusBar } from './ui/StatusBar';
import { ToolPanel } from './ui/ToolPanel';
import { ToolRail } from './ui/ToolRail';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
  useDragging,
  usePanelState,
  type PanelHandle,
} from './ui/kit/resizable';
import { TooltipProvider } from './ui/kit/tooltip';
import { SlotProvider, SlotTarget, slotsOf } from './shell/slots';
import { useAddress, type ShellProps } from './shell/address';
import { resolveView, type SectionId, type ViewKind } from './shell/views';
import { cn } from './lib/cn';
import { useMedia, WIDE } from './lib/useMedia';
import { PAGE_TITLES, pageTitleText, TITLE_COPY } from './nav';
import { Localisation, useWorkbenchIntl } from './i18n/Localisation';
import { useLanguage } from './i18n/language';
import { useAppearance } from './theme';
import { href, useLinkInterception, useRoute } from './router';

/**
 * Every `group/name` the app has, built once, for `resolveView`.
 *
 * One `Set` rather than a search through the groups on every render, and at
 * module scope because the reference is generated at build time and cannot move
 * while the page is open.
 */
const COMPONENT_IDS = new Set(
  api.components.groups.flatMap((group) => group.components.map((c) => `${group.name}/${c.name}`)),
);

const hasComponent = (group: string, name: string) => COMPONENT_IDS.has(`${group}/${name}`);

/**
 * The few words the shell itself draws, in ENGLISH; the German that ships is
 * `src/i18n/catalogue/de/shell.ts`.
 *
 * Everything else on any page comes from a view, and most views are the body of
 * something this site publishes, which ADR 0050 §2 leaves in English. What is here
 * is the frame: the link a keyboard lands on first, the clause under the file path,
 * and the 404 — which is the shell's own body rather than a page's, because there
 * is no document behind it to be the body of.
 *
 * `CORRECTIV app workbench` and the `— Workbench` suffix on every other tab are
 * NOT here. They are the name of this site, and `nav.ts` leaves the `/` entry out
 * for the same reason.
 */
const COPY = defineMessages({
  skip: {
    id: 'shell.skip',
    defaultMessage: 'Skip to content',
    description:
      'The first thing a keyboard reaches on every page, hidden until it has focus, jumping past the header and both rails.',
  },
  builtFrom: {
    id: 'shell.build',
    defaultMessage: ' · built from {commit}',
    description:
      'Appended to the status line on /design alone, where which commit the page was built from is a fact about the view. {commit} is the seven-character hash. The separator is inside the string because it follows a path that is already there.',
  },
  notFoundHeading: {
    id: 'shell.notFound.heading',
    defaultMessage: 'No page at {route}',
    description: 'The heading of this site’s own 404. {route} is the address that was asked for.',
  },
  notFoundLead: {
    id: 'shell.notFound.lead',
    defaultMessage:
      'The workbench publishes the repository’s own documents. This address matches none of them. Press <kbd>⌘K</kbd> to search.',
    description: 'Under the 404 heading. The tag wraps the key combination, drawn as a keycap.',
  },
  notFoundComponent: {
    id: 'shell.notFound.component',
    defaultMessage:
      'The app has no such component. <back>Every component it does have</back> is one page back.',
    description:
      'A second paragraph, only under /components/…, which is the one family that lands on the 404 by being renamed rather than typed wrong. The tag wraps the words that link to the component index.',
  },
});

/** The keycap inside `shell.notFound.lead`, at module scope so it is one component. */
const kbd = (chunks: ReactNode[]) => <kbd className="font-mono">{chunks}</kbd>;

/**
 * The way back inside `shell.notFound.component`, at module scope for the same
 * reason. Named `backLink` rather than `back`, which the ⌘J handler already has.
 */
const backLink = (chunks: ReactNode[]) => (
  <a
    className="text-on-canvas underline decoration-accent underline-offset-2"
    href={href('/components')}
  >
    {chunks}
  </a>
);

/**
 * One application, not a site with a tool bolted to the side of it.
 *
 * Everything is a view of the same shell: a record, the sources board, the
 * drawings, the core's reference, one of the app's components drawn, and the app
 * itself in its frame. The rail on the far left reaches any of them from any of
 * them; the rail on the far right reaches any tool of the open view from any
 * other, and the panel between them shows the one that was asked for.
 *
 * **The route declares and the page fills.** `shell/views.ts` says which tools a
 * view offers, whether it has a context bar, whether it owns the status line and
 * whether `full=1` means anything on it; the page puts its content into those
 * places through `shell/slots.tsx`. This file therefore branches on width and on
 * nothing else — the seven `isApp` branches it used to carry are what made the
 * preview a second site, and `ADR 0028` records why they are gone.
 *
 * The panel's own state — which one tool is open — is in the hash on every route
 * (`shell/address.ts`), which is what the preview alone used to do.
 */
export function App() {
  const [route] = useRoute();
  const [appearance, setAppearance] = useAppearance();
  /* Three, because the dialog and the provider ask different things of the
     setting: the radio group has to know that "system" is what is selected, and
     the provider only ever wants the language that resolves to. */
  const [languageChoice, language, setLanguage] = useLanguage();
  const [searchOpen, setSearchOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const doc = docsModule.docs.find((d) => d.route === route);
  const { view, params } = resolveView(route, doc !== undefined, hasComponent);
  const [address, setAddress] = useAddress(view);
  useLinkInterception();

  /*
   * Two layouts, not one layout with different numbers. Wide, the rail is a
   * column on the right edge and the panel a pane in a resizable group beside it.
   * Narrow, there is no width to divide: the rail lies along the bottom of the
   * window and the panel rises from it over roughly the lower half, with the page
   * above still on screen and still reachable — which the preview needs, because
   * the element picker and the outline both want a frame that can be tapped while
   * the tool that armed them is open.
   */
  const wide = useMedia(WIDE);
  const full = view.canGoFull && address.full;
  const hasPanel = view.sections.length > 0;
  const tool = address.tool;
  const panelOpen = tool !== null;

  const shell: ShellProps = { address, onAddress: setAddress, wide, full };
  const setTool = (next: SectionId | null) => setAddress({ tool: next });

  /*
   * Which tool ⌘J comes back to.
   *
   * The shortcut opens the last one this session, and the view's first where
   * there has been none — a keystroke that opened nothing, or asked which of six,
   * would not be a shortcut. Held in a ref rather than in the address, because it
   * is a memory of what was asked for and not a statement about what is on
   * screen: writing it to the hash would put a tool in every link that had merely
   * been looked at once and shut again.
   */
  const lastTool = useRef<SectionId | null>(null);
  useEffect(() => {
    if (address.tool !== null) lastTool.current = address.tool;
  }, [address.tool]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const meta = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();
      if (meta && key === 'k') {
        event.preventDefault();
        setSearchOpen((open) => !open);
      }
      if (meta && key === 'j' && hasPanel) {
        event.preventDefault();
        const remembered = lastTool.current;
        const back =
          remembered !== null && view.sections.includes(remembered)
            ? remembered
            : (view.sections[0] ?? null);
        setAddress({ tool: address.tool === null ? back : null });
      }
      // The way out of a view whose only control is one floating button. The
      // palette owns Escape while it is open, and it is a dialog, so it gets it.
      if (event.key === 'Escape' && full && !searchOpen) {
        event.preventDefault();
        setAddress({ full: false });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [address.tool, full, hasPanel, searchOpen, setAddress, view.sections]);

  /*
   * The heading the hash names, scrolled to by this site rather than by the
   * browser.
   *
   * `#the-four-ports?tool=contents` is not an anchor: the fragment is no longer an
   * element id, so the browser does nothing with it. `router.tsx` already scrolls
   * for a click on an in-site link, because the target does not exist until the
   * route has rendered; this is the other half, for a load and for a step through
   * history. Keyed on route and head together, so opening a tool — which
   * rewrites the hash — does not throw the reader back up the page.
   */
  const scrolledTo = useRef<string | null>(null);
  useEffect(() => {
    const key = `${route}#${address.head}`;
    if (scrolledTo.current === key) return;
    scrolledTo.current = key;
    if (address.head === '' || address.head.startsWith('/')) return;
    const id = decodeURIComponent(address.head);
    requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView());
  }, [address.head, route]);

  /*
   * Docked, the panel collapses to nothing rather than being unmounted, so its
   * width has a value to animate from — and so that a tool keeps the state inside
   * it while it is away, which is the same reason `ToolPanel` hides rather than
   * unmounts. `useDragging` turns the transition off while a handle is held, or
   * every frame of the drag chases a 200ms animation.
   *
   * Both the panel and its handle stay mounted for as long as this layout does,
   * whatever the open view puts in them. They used to come and go with the route,
   * and `react-resizable-panels` re-registers its children when the list changes:
   * an imperative `resize()` landing in that gap threw "Panel constraints not
   * found" and took the whole page with it.
   */
  const panelRef = useRef<PanelHandle>(null);
  const dragging = useDragging();
  /*
   * The width to come back to. `expand()` restores "its most recent size", and
   * for a panel that has only ever been collapsed that is the minimum: the
   * inspector opened at fourteen per cent, a third of what it asks for. So the
   * size is stated on the way in, and a width somebody dragged to is what gets
   * stated next time.
   */
  const dragged = useRef<string | null>(null);
  usePanelState(panelRef, panelOpen, () => dragged.current ?? view.panelWidth, wide && !full);

  const page = pageFor();

  function pageFor(): ReactNode {
    switch (view.kind) {
      case 'landing':
        return <Landing />;
      case 'handbook':
        return <Handbook />;
      case 'diagrams':
        return <DiagramIndex />;
      case 'reference':
        return <Reference />;
      case 'strings':
        return <Strings />;
      case 'sources':
        return <Sources />;
      case 'decisions':
        return <Decisions />;
      case 'design':
        return <Design {...shell} />;
      case 'components':
        return <Components />;
      case 'component':
        return <ComponentDetail group={params.group} name={params.name} {...shell} />;
      case 'preview':
        return <Preview {...shell} />;
      case 'diagram': {
        const meta = DIAGRAMS.find((d) => d.id === params.id);
        return meta ? <DiagramView meta={meta} /> : <NotFound route={route} />;
      }
      case 'document':
        return doc ? <Document doc={doc} /> : <NotFound route={route} />;
      default:
        return <NotFound route={route} />;
    }
  }

  return (
    /*
      Two providers can be in the tree at once and only one of them is this site's.

      `AppEnvironment`, which the preview and the component pages draw the app's own
      components through, mounts the APP's `IntlProvider` with the app's catalogue
      inside this one. That nesting is right: a component borrowed from the app keeps
      the app's words, and the chrome around it keeps this site's. Two catalogues,
      one per audience, and neither reaches into the other
      ([ADR 0050](../../../adr/0050-the-workbench-gets-a-second-audience.md) §3).
    */
    <Localisation language={language}>
      {/* Inside the provider, because the tab is chrome and a page's name follows
          the language setting. It draws nothing, and it is a component rather than
          an effect up here for the one reason that `useWorkbenchIntl()` needs to be
          below `Localisation` and `App` is what mounts it. */}
      <DocumentTitle route={route} kind={view.kind} name={params.name} document={doc?.title} />
      <TooltipProvider delayDuration={300}>
        <SlotProvider declared={slotsOf(view)}>
          <div className="flex h-dvh flex-col bg-canvas text-on-canvas">
            <SkipLink />

            {!full && (
              <Header
                onSearch={() => setSearchOpen(true)}
                onSettings={() => setSettingsOpen(true)}
                onFull={view.canGoFull ? () => setAddress({ full: true }) : undefined}
              >
                {/* The context bar, in the header at every width. Device,
                  orientation, zoom and route belong above the frame and not on
                  the rail, so this is the one thing the two-level arrangement
                  keeps: the bar wraps at 390px rather than moving. */}
                {view.contextBar && <SlotTarget id="context-bar" />}
              </Header>
            )}

            <div
              className={cn(
                'relative flex flex-1',
                // A floor rather than a share: the frame's row asks for every pixel
                // the column has left and gives none of it up to `flex-shrink` on
                // its own, because `min-h-0` alone lets a sibling's `max-height`
                // decide how much this row gets. Below `wide`, the panel beneath it
                // is capped and content-sized (see the panel wrapper below), not
                // fixed, so without a floor a short window could still squeeze the
                // frame to a sliver while the panel sat at its cap. 16rem keeps the
                // frame the majority partner even then; the panel gives way first,
                // because it alone carries `min-h-0` down to zero.
                !wide && !full && hasPanel ? 'min-h-[16rem]' : 'min-h-0',
              )}
            >
              {!full && <ActivityBar route={route} />}

              <ResizablePanelGroup className={cn('min-w-0 flex-1', !dragging && 'panels-animate')}>
                {/*
                Keyed, both of them, because the right-hand one comes and goes.
                Without keys React matches these children by position, so a panel
                appearing changed places with a fragment and React answered by
                throwing the panel away and building a new one. That took the
                iframe with it, and the app came back blank.
              */}
                <ResizablePanel key="main" minSize="30%">
                  {/*
                  The one scroller. Every view is a block inside it, which is why
                  none of them carries a `main` or a height of its own.
                */}
                  <main id="content" className="h-full min-h-0 overflow-auto">
                    <Boundary route={route}>{page}</Boundary>
                  </main>
                </ResizablePanel>

                {wide && !full && (
                  <Fragment key="tools">
                    <ResizableHandle className={cn(!panelOpen && 'hidden')} />
                    <ResizablePanel
                      panelRef={panelRef}
                      collapsible
                      collapsedSize="0%"
                      defaultSize={view.panelWidth}
                      minSize="14%"
                      maxSize="55%"
                      /* Only while a handle is held. Otherwise this fires on the layout
                       the collapse itself causes and writes the old state straight
                       back, which is a toggle that does nothing. */
                      onResize={(size) => {
                        if (!dragging) return;
                        if (size.asPercentage > 0) {
                          dragged.current = `${size.asPercentage}%`;
                        } else if (tool !== null) {
                          // Dragged shut, which is the one way to close the panel
                          // that is not the rail. The rail's mark follows, because
                          // both read the same parameter.
                          setTool(null);
                        }
                      }}
                    >
                      <div className="h-full w-full overflow-hidden [contain:paint]">
                        <div className="h-full w-full min-w-[15rem]" inert={!panelOpen}>
                          <ToolPanel view={view} tool={tool} />
                        </div>
                      </div>
                    </ResizablePanel>
                  </Fragment>
                )}
              </ResizablePanelGroup>

              {wide && !full && (
                <ToolRail view={view} tool={tool} onTool={setTool} orientation="column" />
              )}
            </div>

            {/*
            Narrow, the rail lies along the bottom and the panel stands on it.
            There is no width to divide at 390px — a fourteen per cent panel is
            fifty-five pixels, and the page it left behind is not a page — and
            there is height, so the two halves of the window are stacked instead
            of side by side.

            In the flow rather than in a dialog over the page, which is what this
            was until ADR 0038. A drawer traps focus and dims what is behind it,
            and what is behind it here is the thing the tools are about: Measure's
            outline and Inspect's picker are both instructions to look at the
            frame. So the page keeps half the window, keeps its scroll and stays
            tappable, and the rail never moves under the reader's thumb.
          */}
            {!wide && !full && hasPanel && (
              <>
                {/* Hidden rather than unmounted while it is shut, for the two
                  reasons the docked panel collapses instead of unmounting: the
                  tools keep what is inside them, and the rail's `aria-controls`
                  keeps something to point at. The class is `hidden` and nothing
                  else on that branch, because a `display` beside it would win.

                  Capped and content-sized, not a fixed half of the window. An
                  empty Console used to claim the same `50dvh` as a Console full
                  of lines, because the height was the window's rather than the
                  tool's. `flex flex-col` here is what lets `ToolPanel`'s own
                  `h-full` resolve against this box rather than against `auto`:
                  a percentage height on a child of an `auto`-height box computes
                  to `auto` and the child would simply be its own content size,
                  but a percentage height on a child of a FLEX box clamped by
                  `max-height` resolves against that clamped, now-definite size —
                  which is what turns "grown past the cap" into "capped, with the
                  tool's own internal scrollbar taking the rest" instead of the
                  box merely being clipped with no way to reach what overflowed.
                  `min-h-0` lets it give way entirely to the frame's floor above
                  in a short window, rather than holding out for its cap. */}
                <div
                  className={cn(
                    'flex shrink-0 flex-col border-t border-stroke',
                    panelOpen ? 'min-h-0 max-h-[min(34dvh,20rem)]' : 'hidden',
                  )}
                >
                  <ToolPanel view={view} tool={tool} />
                </div>
                <ToolRail view={view} tool={tool} onTool={setTool} orientation="row" />
              </>
            )}

            {!full && (
              <StatusBar>
                {view.statusBar ? (
                  // Clipped, not wrapped. The line is one row tall by definition,
                  // and a readout that ran past the end used to widen the page
                  // itself: 120px of sideways scroll on a 1440px window.
                  <SlotTarget id="status" className="flex min-w-0 flex-1 items-center gap-s" />
                ) : (
                  <FileOrTitle route={route} file={doc?.file} design={view.kind === 'design'} />
                )}
              </StatusBar>
            )}
          </div>

          {full && <ShowChrome onShow={() => setAddress({ full: false })} />}

          <Search open={searchOpen} onClose={() => setSearchOpen(false)} />

          <Settings
            open={settingsOpen}
            onOpenChange={setSettingsOpen}
            appearance={appearance}
            onAppearance={setAppearance}
            language={languageChoice}
            onLanguage={setLanguage}
          />
        </SlotProvider>
      </TooltipProvider>
    </Localisation>
  );
}

/**
 * The first thing a keyboard reaches, and a component of its own for one reason.
 *
 * `useWorkbenchIntl()` has to be called below `Localisation`, and `App` is what
 * mounts it — its own hooks run above its own provider. `DocumentTitle` is here
 * for the same reason and says so at greater length.
 */
function SkipLink() {
  const intl = useWorkbenchIntl();

  return (
    <a
      href="#content"
      className="sr-only focus:not-sr-only focus:absolute focus:left-s focus:top-s focus:z-50 focus:rounded-md focus:bg-accent focus:px-s focus:py-xs focus:text-white"
    >
      {intl.formatMessage(COPY.skip)}
    </a>
  );
}

/**
 * The browser tab, which is the one piece of chrome that is not on the page.
 *
 * `— Workbench` and the site's own name are left as they are: both are the name
 * of this site rather than a sentence about it, and `nav.ts` says the same of the
 * `/` entry it does not translate.
 */
function DocumentTitle({
  route,
  kind,
  name,
  document: documentTitle,
}: {
  route: string;
  kind: ViewKind;
  name?: string;
  /** A Markdown document's own h1, which is the repository's and stays as written. */
  document?: string;
}) {
  const intl = useWorkbenchIntl();

  useEffect(() => {
    const page = PAGE_TITLES[route];
    const title =
      kind === 'component'
        ? intl.formatMessage(TITLE_COPY.component, { name })
        : page !== undefined
          ? pageTitleText(page, (message) => intl.formatMessage(message))
          : (documentTitle ?? intl.formatMessage(TITLE_COPY.notFound));

    window.document.title = route === '/' ? 'CORRECTIV app workbench' : `${title} — Workbench`;
  }, [documentTitle, intl, kind, name, route]);

  return null;
}

/**
 * Where you are, for a view that has nothing more particular to say.
 *
 * The path of the file being rendered, in the typeface a path is written in. A
 * page that is not a document has no file, so it says what it is instead — and
 * `/design` adds the commit, because "which commit is this built from" is a fact
 * about the current view and this line is where those go on every other view.
 */
function FileOrTitle({ route, file, design }: { route: string; file?: string; design: boolean }) {
  const intl = useWorkbenchIntl();
  const page = PAGE_TITLES[route];

  return (
    <span className={cn('truncate', file && 'font-mono')}>
      {file ??
        (page === undefined
          ? route
          : pageTitleText(page, (message) => intl.formatMessage(message)))}
      {design && intl.formatMessage(COPY.builtFrom, { commit: docsModule.commit.slice(0, 7) })}
    </span>
  );
}

function NotFound({ route }: { route: string }) {
  const intl = useWorkbenchIntl();

  return (
    <div className="mx-auto max-w-content px-m py-2xl">
      <h1 className="text-headline-l font-semibold">
        {intl.formatMessage(COPY.notFoundHeading, { route })}
      </h1>
      <p className="mt-s text-on-canvas-muted">{intl.formatMessage(COPY.notFoundLead, { kbd })}</p>
      {/* The one family that lands here by being renamed rather than by being
          typed wrong, so it gets the way back that a bare 404 cannot give. */}
      {route.startsWith('/components/') && (
        <p className="mt-s text-on-canvas-muted">
          {intl.formatMessage(COPY.notFoundComponent, { back: backLink })}
        </p>
      )}
    </div>
  );
}
