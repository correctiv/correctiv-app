/**
 * What each view of this site offers the shell, declared before it renders.
 *
 * The shell used to ask the page. `App.tsx` special-cased the preview seven
 * times and decided the right sidebar from two booleans, which meant the panel's
 * existence was known only after the page had rendered something — so the toggle
 * and the default-open state were right one commit late, and the preview was a
 * second site rather than a view. Here the **route declares and the page fills**:
 * the table below says which sections a view has, the page supplies their content
 * through `shell/slots.tsx`, and `test/shell.test.ts` fails when the two disagree.
 *
 * Pure data on purpose, no React and no icon. `test/shell.test.ts` imports this
 * file to check every route in the site against it, and a test that had to pull
 * the page tree in to ask about a string is a test that stops being run. The
 * icons live beside the chrome that draws them, in `ui/ToolRail.tsx`, keyed by
 * the same type, so a section with a title and no icon is a type error.
 *
 * **The titles here are descriptors and not strings**, for that same reason. A
 * section's name is chrome and follows the language setting
 * ([ADR 0050](../../../../adr/0050-the-workbench-gets-a-second-audience.md) §2),
 * but `defineMessages` comes from `react-intl`, which imports React. `wbMessage()`
 * is the identity function that stands in; `src/i18n/messages.ts` says why it takes
 * one descriptor per call. Whoever draws one formats it — `ui/ToolRail.tsx` and
 * `ui/ToolPanel.tsx` are the two.
 */
import { wbMessage, type WorkbenchMessage } from '../i18n/messages';

/** Every place a page can put something the shell draws. */
export type SectionId =
  // Shared: the in-page contents, which every long view has.
  | 'contents'
  // /preview
  | 'appearance'
  | 'state'
  | 'home'
  | 'console'
  | 'tokens'
  | 'measure'
  | 'inspect'
  // /design
  | 'design-links'
  | 'design-clients'
  | 'design-code'
  // /components/<group>/<name>
  | 'rendering'
  | 'device'
  | 'props'
  | 'source';

export type ViewKind =
  | 'landing'
  | 'handbook'
  | 'document'
  | 'diagrams'
  | 'diagram'
  | 'reference'
  | 'strings'
  | 'sources'
  | 'decisions'
  | 'design'
  | 'components'
  | 'component'
  | 'preview'
  | 'not-found';

export interface ViewDeclaration {
  kind: ViewKind;
  /**
   * What the right panel can show, in the order the rail lists them.
   *
   * **One at a time.** These used to be a stack of collapsible sections sharing
   * one column, which on `/preview` meant six of them inside thirty-one per cent
   * of the window: each got a sliver, and each needed a caption saying what the
   * sliver was. The rail on the right edge opens one of them at the panel's full
   * height, and pressing the open one shuts the panel — so there is one switch
   * where there used to be a header button, a close button and six chevrons.
   * ([ADR 0038](../../../../adr/0038-one-tool-at-a-time-in-a-rail.md))
   *
   * Empty: no panel, no rail, no ⌘J.
   */
  sections: readonly SectionId[];
  /** The rail and the panel are named this; `null` exactly when `sections` is empty. */
  panelTitle: WorkbenchMessage | null;
  /** Docked width. A heading list wants a fifth, a console wants a third. */
  panelWidth: '19%' | '24%' | '31%';
  /** Whether the header's context bar is filled by this view. */
  contextBar: boolean;
  /** Whether the status line is this view's rather than the file or the title. */
  statusBar: boolean;
  /** Whether `full=1` means anything here: a view whose main area is a drawing. */
  canGoFull: boolean;
  /**
   * And whether it arrives there already full, rather than offering the button.
   *
   * True for the preview alone, which is what it has always done below 1024:
   * the chrome is most of a 390px screen and the app is what the link was for.
   * The design and component views keep their prose at that size, so there the
   * button is the honest control.
   */
  fullWhenNarrow: boolean;
}

/**
 * What a section is called, wherever it is drawn.
 *
 * Here rather than passed by the page, because the id is in the URL under
 * `tool=`: a page that could rename its own section would be renaming something
 * a link already refers to.
 *
 * Above the table that uses it, and that is not tidiness: `reading()` reads
 * `contents` out of here while `VIEWS` is being built, and a `const` declared
 * further down the file is in its temporal dead zone at that moment.
 */
export const SECTION_TITLES: Record<SectionId, WorkbenchMessage> = {
  contents: wbMessage({
    id: 'shell.section.contents',
    defaultMessage: 'On this page',
    description:
      'The in-page contents, which every long view has. Also the name of the panel itself on those views, because the contents are the only thing in it.',
  }),
  appearance: wbMessage({
    id: 'shell.section.appearance',
    defaultMessage: 'Appearance',
    description:
      'The preview tool that pins the framed app to light or dark. Not the site’s own setting, which is settings.appearance in the settings dialog.',
  }),
  state: wbMessage({
    id: 'shell.section.state',
    defaultMessage: 'State',
    description:
      'The preview tool onto the framed app’s own store. sources.column.state is the same word as the first column of the sources board and means something else there: the condition a content source is in.',
  }),
  home: wbMessage({ id: 'shell.section.home', defaultMessage: 'Home layout' }),
  console: wbMessage({ id: 'shell.section.console', defaultMessage: 'Console' }),
  tokens: wbMessage({ id: 'shell.section.tokens', defaultMessage: 'Tokens' }),
  measure: wbMessage({ id: 'shell.section.measure', defaultMessage: 'Measure' }),
  inspect: wbMessage({ id: 'shell.section.inspect', defaultMessage: 'Inspect' }),
  'design-links': wbMessage({
    id: 'shell.section.designLinks',
    defaultMessage: 'Open',
    description:
      'The design view’s tool holding the links that open the Figma file, in the browser and in the desktop app. One word, on a rail icon.',
  }),
  'design-clients': wbMessage({
    id: 'shell.section.designClients',
    defaultMessage: 'Desktop clients',
  }),
  'design-code': wbMessage({
    id: 'shell.section.designCode',
    defaultMessage: 'Where it reaches the code',
  }),
  rendering: wbMessage({ id: 'shell.section.rendering', defaultMessage: 'Rendering' }),
  device: wbMessage({
    id: 'shell.section.device',
    defaultMessage: 'Device',
    description:
      'The component view’s tool for the size a component is drawn at. frame.device is the select on the bar above the app and reads the same in English.',
  }),
  props: wbMessage({ id: 'shell.section.props', defaultMessage: 'Props' }),
  source: wbMessage({
    id: 'shell.section.source',
    defaultMessage: 'Source',
    description:
      'The component view’s tool for where a component is written: the file, and a link into the repository. Two other ids read the same in English and mean something else: tools.inspect.handover.source is the field of the inspector’s handover block that names one line of one file, and sources.column.source is the column of the sources board that names where a row’s content comes from.',
  }),
};

/** No panel: a landing page, an index, a set of doors. */
function plain(kind: ViewKind): ViewDeclaration {
  return {
    kind,
    sections: [],
    panelTitle: null,
    panelWidth: '19%',
    contextBar: false,
    statusBar: false,
    canGoFull: false,
    fullWhenNarrow: false,
  };
}

/**
 * A long read, whose one rail entry is its contents.
 *
 * **A table of contents is not a tool**, and the rail does not dress it up as
 * one: it is a single icon, it is called `On this page`, and it is there because
 * the panel needs a switch and the edge the panel opens from is where that switch
 * belongs. What the reading views get out of the rail is not a tool box, it is
 * that the contents are in the same place on every view of this site.
 */
function reading(kind: ViewKind, contextBar = false): ViewDeclaration {
  return {
    ...plain(kind),
    sections: ['contents'],
    // The same descriptor the rail entry carries, not a second id with the same
    // English in it: the panel and its one tool are called the same thing here on
    // purpose, and two ids would be one string to translate twice.
    panelTitle: SECTION_TITLES.contents,
    contextBar,
  };
}

export const VIEWS: Record<ViewKind, ViewDeclaration> = {
  landing: plain('landing'),
  handbook: plain('handbook'),
  diagrams: plain('diagrams'),
  'not-found': plain('not-found'),
  // A drawing and its caption. Its headings carry no ids, so a contents list
  // here would be an empty box behind a rail icon, which is decision 4's case.
  diagram: plain('diagram'),

  document: reading('document'),
  sources: reading('sources'),
  decisions: reading('decisions'),
  // The filter moves out of the page body and into the header's context bar, so
  // a lookup surface keeps its filter on screen without a second sticky thing
  // inside a scroller that is already sticky.
  reference: reading('reference', true),
  components: reading('components', true),
  // The third lookup surface, and the same shape for the same reason: a long
  // list cut into sections, with the thing that narrows it in the header.
  strings: reading('strings', true),

  design: {
    kind: 'design',
    sections: ['design-links', 'design-clients', 'design-code'],
    panelTitle: wbMessage({ id: 'shell.panel.design', defaultMessage: 'Design tools' }),
    // Four download cards and three pointer cards need more than a heading list
    // and less than a console, and a third would leave the Figma frame half the
    // window at 1280.
    panelWidth: '24%',
    contextBar: true,
    statusBar: false,
    canGoFull: true,
    fullWhenNarrow: false,
  },

  component: {
    kind: 'component',
    sections: ['rendering', 'device', 'props', 'source'],
    panelTitle: wbMessage({
      id: 'shell.panel.component',
      defaultMessage: 'Component',
      description:
        'The name of the right panel on a component’s own page, whose tools are its rendering, its device, its props and its source.',
    }),
    panelWidth: '31%',
    contextBar: true,
    statusBar: true,
    canGoFull: true,
    fullWhenNarrow: false,
  },

  preview: {
    kind: 'preview',
    sections: ['appearance', 'state', 'home', 'console', 'tokens', 'measure', 'inspect'],
    panelTitle: wbMessage({
      id: 'shell.panel.tools',
      defaultMessage: 'Tools',
      description:
        'The name of the right panel on /preview, which holds the seven tools for inspecting the framed app.',
    }),
    panelWidth: '31%',
    contextBar: true,
    statusBar: true,
    canGoFull: true,
    fullWhenNarrow: true,
  },
};

export interface ResolvedView {
  view: ViewDeclaration;
  /** `/components/ui/Card` gives `{ group: 'ui', name: 'Card' }`. */
  params: Record<string, string>;
}

/** The views answered with a component of this site rather than with a document. */
const EXACT: Record<string, ViewKind> = {
  '/': 'landing',
  '/handbook': 'handbook',
  '/diagrams': 'diagrams',
  '/reference': 'reference',
  '/strings': 'strings',
  '/sources': 'sources',
  '/decisions': 'decisions',
  '/design': 'design',
  '/components': 'components',
  '/preview': 'preview',
};

/** Every route this site answers with a page of its own, for the tests and the palette. */
export const PAGE_ROUTES: readonly string[] = Object.keys(EXACT);

/**
 * Which view a route is, and what it was given.
 *
 * `isDocument` and `hasComponent` are passed in rather than read, so this file
 * imports no virtual module and a test can call it with lists it built itself.
 *
 * Exact matches first, then the two families with a segment under them, then the
 * documents. The order is what lets `/design` be a page and `/design/plugin` a
 * document without either shadowing the other; `test/shell.test.ts` holds that
 * pair specifically, because the last time a page and a document wanted one
 * address the document simply left the site with no error anywhere.
 *
 * **A component the app has not got is not the component view.** The declaration
 * is what the shell believes before the page renders, so an address like
 * `/components/ui/NotAThing` used to open a rail with `Rendering`, `Device`,
 * `Props` and `Source` on it and nothing behind any of them, plus a blank status
 * line — four icons that answer nothing, which is what a declaration costs when
 * nothing can fill it. `test/shell.test.ts` reads the page files as text and
 * cannot see that, because the slots are in the file and the render returned
 * before them. Asking here is where the question can be answered once.
 */
export function resolveView(
  route: string,
  isDocument: boolean,
  hasComponent: (group: string, name: string) => boolean = () => true,
): ResolvedView {
  const exact = EXACT[route];
  if (exact) return { view: VIEWS[exact], params: {} };

  if (route.startsWith('/diagrams/')) {
    return { view: VIEWS.diagram, params: { id: route.slice('/diagrams/'.length) } };
  }

  if (route.startsWith('/components/')) {
    const [group, name, ...rest] = route.slice('/components/'.length).split('/');
    if (group && name && rest.length === 0 && hasComponent(group, name)) {
      return { view: VIEWS.component, params: { group, name } };
    }
  }

  if (isDocument) return { view: VIEWS.document, params: {} };

  return { view: VIEWS['not-found'], params: {} };
}
