import { Download, ExternalLink, Maximize2, RotateCw } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { defineMessages, type MessageDescriptor } from 'react-intl';

import docsModule from 'virtual:docs';
import { useWorkbenchIntl } from '../i18n/Localisation';
import { cn } from '../lib/cn';
import { href } from '../router';
import { Slot } from '../shell/slots';
import type { ShellProps } from '../shell/address';
import { Button } from '../ui/kit/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/kit/tooltip';

/** The file this project is designed in. One place, so nothing here is a copy. */
const FIGMA_FILE = 'https://www.figma.com/design/9n7x4eWzdZXVlRej7jWJHx/CORRECTIV-App--Aufbau';

/**
 * Figma's own embed host. It renders the file for a viewer who may open it, and
 * an access screen for one who may not, which is the honest outcome either way.
 */
const FIGMA_EMBED = `https://embed.figma.com/design/9n7x4eWzdZXVlRej7jWJHx/CORRECTIV-App--Aufbau?embed-host=correctiv-workbench`;

/** What the reader is told will be fetched, in the address bar's own words. */
const FIGMA_EMBED_SHORT = 'embed.figma.com/design/9n7x…/CORRECTIV-App--Aufbau';

/**
 * The file's name, which is the same in every language and is written once.
 *
 * It reads twice on this page, in the sentence above the button and as the
 * frame's accessible name, so it is a value handed to both rather than a word
 * inside either. A translator is not being asked to rename a file.
 */
const FIGMA_NAME = 'CORRECTIV App, Aufbau';

/** The three identifiers the tool panel prints, left in their own spelling. */
const TOKENS_PACKAGE = '@correctiv/design-tokens';
const TOKEN = 'bg-canvas';
const PLUGIN_DIRECTORY = 'tools/figma-plugin';
const PLUGIN_CODE = 'code.js';
const PLUGIN_SPEC = 'spec.json';

const LINK =
  'font-medium text-on-canvas underline decoration-accent underline-offset-2 hover:text-on-canvas-accent';

/** The panel's card, which is the preview's readout card: `canvas` on `canvas`. */
const CARD = 'rounded-md border border-stroke bg-canvas p-xs';
const NOTE = 'text-s leading-relaxed text-on-canvas-muted';

/**
 * Everything this page says, in ENGLISH; the German that ships is
 * `src/i18n/catalogue/de/design.ts`.
 *
 * **Nothing on this page comes out of the repository**, so
 * [ADR 0052](../../../../adr/0052-the-sites-own-words-follow-the-setting.md) §1
 * takes all of it: the heading, the sentence about the file, the two headings in
 * the box that says what a press will fetch, both buttons, and every line in the
 * three tools on the right.
 *
 * **What it does not take is a name or an instruction to click.** `Figma`,
 * `macOS`, `Windows`, `Linux`, `Apple silicon` and `figma-linux-next` are what
 * those things are called wherever you are; `@correctiv/design-tokens`,
 * `bg-canvas`, `tools/figma-plugin`, `code.js` and `spec.json` are identifiers,
 * and each of them is handed in as a value so that a catalogue cannot reword one.
 * The menu path in `design.clients.note` is the sharpest case and is the one
 * exception kept INSIDE a message: a reader has to find those exact words in
 * Figma's own English menu, so translating them would be translating the reader
 * out of the instruction. Its description says so.
 */
const COPY = defineMessages({
  title: {
    id: 'design.title',
    defaultMessage: 'Design',
    description:
      'The heading over the page that frames the Figma file. shell.activity.design is the same word on the rail, landing.door.design.title on the front page’s card, and nav.design is the longer name the browser tab carries.',
  },
  lede: {
    id: 'design.lede',
    defaultMessage:
      'The app is designed in one Figma file, <b>{file}</b>. It is the source for the screens, and this workbench is the source for everything written down about them.',
    description:
      'The paragraph under the heading. {file} is the Figma file’s own name and is not translated; <b> draws it in bold.',
  },
  frameTitle: {
    id: 'design.frameTitle',
    defaultMessage: '{file}, in Figma',
    description:
      'The accessible name of the frame that holds the design file, read aloud and never drawn. {file} is the Figma file’s own name and is not translated.',
  },

  loads: {
    id: 'design.loads',
    defaultMessage: 'What loads',
    description:
      'The first heading in the box above the button, over the address a press will fetch. The address itself is printed in monospace and is not a message.',
  },
  loadsNote: {
    id: 'design.loads.note',
    defaultMessage: 'One request to figma.com, and none before the button is pressed.',
  },
  see: {
    id: 'design.see',
    defaultMessage: 'What you will see',
    description: 'The second heading in that box, over what the frame will show once it loads.',
  },
  seeNote: {
    id: 'design.see.note',
    defaultMessage:
      'The file, if you are signed in to Figma with access to it. Figma’s own sign-in screen if not. That screen is a permission and not a fault: this file is not shared publicly.',
  },

  full: {
    id: 'design.full',
    defaultMessage: 'Open full screen',
    description:
      'The button on the narrow layout, where the frame does not fit beside the page. It opens the view full screen and loads nothing; design.load is the button that fetches the file. components.detail.full is the same words on a component’s page, where what opens full screen is the app.',
  },
  fullNote: {
    id: 'design.full.note',
    defaultMessage:
      'The frame needs the width of the screen, so it opens on its own. The file itself still loads on a press.',
    description:
      'The line under the full-screen button. design.load.note is the line under the other button, which does fetch the file.',
  },
  load: {
    id: 'design.load',
    defaultMessage: 'Load the Figma file',
    description:
      'The button that makes the one request to figma.com. Nothing is fetched until it is pressed, which is why the box above it says what will be.',
  },
  loadNote: {
    id: 'design.load.note',
    defaultMessage: 'from figma.com',
    description:
      'The line under the load button, naming the third party the request goes to. design.full.note is the line under the other button, which fetches nothing.',
  },

  restSide: {
    id: 'design.rest.side',
    defaultMessage:
      'Everything else about the design, the clients, the plugin and where the colours reach the code, is on the right.',
    description:
      'Where the three tools are, on a layout wide enough to put them in the right-hand panel. design.rest.below is the same sentence for the layout that stacks them under the page.',
  },
  restBelow: {
    id: 'design.rest.below',
    defaultMessage:
      'Everything else about the design, the clients, the plugin and where the colours reach the code, is below.',
    description:
      'Where the three tools are, on a layout too narrow for the right-hand panel. design.rest.side is the same sentence for the wide layout.',
  },

  open: {
    id: 'design.open',
    defaultMessage: 'Open in Figma',
    description:
      'The button in the bar above the page that leaves this site for the file in Figma itself. design.links.file is the same door in the tool panel, worded as a place rather than as an action.',
  },
  reload: {
    id: 'design.reload',
    defaultMessage: 'Reload the frame',
    description:
      'Both the reload button’s accessible name and its tooltip, on this page, where the frame holds the Figma file. frame.reload is the same words on the preview’s bar, where the frame holds a whole route of the app, and components.detail.reload on a component’s page, where it holds the gallery.',
  },

  linksFile: {
    id: 'design.links.file',
    defaultMessage: 'The file in Figma',
    description:
      'The first card in the Open tool, which leaves for the design file itself. design.open is the same door as a button in the bar above the page.',
  },
  linksApp: {
    id: 'design.links.app',
    defaultMessage: 'The app, at device size',
    description: 'The second card in the Open tool, which goes to /preview.',
  },
  linksNote: {
    id: 'design.links.note',
    defaultMessage:
      'The preview frames the running app at the size the file draws it, which is the comparison the file is for.',
  },

  clientsNote: {
    id: 'design.clients.note',
    defaultMessage:
      'The plugin is loaded through Plugins, Development, Import plugin from manifest, and that menu exists only in the desktop app. Figma builds one for macOS and Windows; on Linux this project uses a fork.',
    description:
      'The line above the four downloads. “Plugins, Development, Import plugin from manifest” is Figma’s own menu and stays in English in every catalogue: it is not a description of a menu, it is the words a reader has to find in one. macOS, Windows and Linux are the platforms’ own names.',
  },
  official: {
    id: 'design.clients.official',
    defaultMessage: 'Official',
    description:
      'Under each of the three downloads Figma itself builds, as against the Linux fork under design.clients.fork.',
  },
  fork: {
    id: 'design.clients.fork',
    defaultMessage: 'figma-linux-next, a fork',
    description:
      'Under the Linux download. figma-linux-next is the project’s own name and is not translated; the rest says what it is, because Figma builds no client for Linux.',
  },

  colours: {
    id: 'design.colours',
    defaultMessage: 'The colours',
    description:
      'The first of the three cards saying where the design reaches the code. This one is about the shared palette.',
  },
  coloursNote: {
    id: 'design.colours.note',
    defaultMessage:
      'Not redrawn from the file. <code>{pkg}</code> is generated and both the app and this site import the same stylesheet, so <code>{token}</code> means one thing in three places.',
    description:
      'The line in the colours card. {pkg} is the design-tokens package and {token} one of its classes; both are identifiers and are not translated. <code> draws each in monospace.',
  },
  board: {
    id: 'design.board',
    defaultMessage: 'The board',
    description:
      'The second of the three cards. The board is the inventory of screens the plugin draws into the Figma file.',
  },
  boardNote: {
    id: 'design.board.note',
    defaultMessage:
      '<code>{path}</code> draws the screen inventory into the file from data in this repository, rather than anybody keeping a board in step by hand.',
    description:
      'The line in the board card. {path} is the plugin’s directory in this repository and is not translated; <code> draws it in monospace.',
  },
  plugin: {
    id: 'design.plugin',
    defaultMessage: 'The plugin',
    description: 'The third of the three cards, about the program that draws the board.',
  },
  pluginNote: {
    id: 'design.plugin.note',
    defaultMessage:
      'An interpreter rather than a builder: <code>{codeFile}</code> knows nothing about the app and draws whatever <code>{specFile}</code> describes. Its own documentation is a page of this site, with the three traps of the Linux client in it.',
    description:
      'The line in the plugin card. {codeFile} and {specFile} are two file names in the plugin’s directory and are not translated; <code> draws each in monospace.',
  },
  pluginDoc: {
    id: 'design.plugin.doc',
    defaultMessage: 'The Figma plugin',
    description:
      'The link to the plugin’s own documentation, which is that README rendered as a page of this site. It reads the same as the document’s name in the repository’s registry, which is not a message.',
  },
  pluginRepo: {
    id: 'design.plugin.repo',
    defaultMessage: 'In the repository',
    description:
      'The link beside it, which leaves this site for the plugin’s directory on GitHub at the commit this page was built from.',
  },
});

/**
 * The two runs drawn inside the messages above, at module scope.
 *
 * Beside the descriptors rather than inside the render, which is the shape
 * `ui/Settings.tsx` and `pages/Components.tsx` already use: a component built
 * during a render is remounted on every one of them, and
 * `react/no-unstable-nested-components` says so.
 */
const b = (chunks: ReactNode[]) => <b className="font-semibold">{chunks}</b>;

const code = (chunks: ReactNode[]) => <code className="font-mono">{chunks}</code>;

/**
 * The desktop client, per platform.
 *
 * Figma ships one for macOS and one for Windows and none for Linux, which is why
 * the third is somebody else's build. All four addresses were checked on
 * 2026-09-05 and answered.
 *
 * The labels are the platforms' own names and stay as they are; the note beside
 * each is a word about it and is a message.
 */
const CLIENTS: { label: string; note: MessageDescriptor; href: string }[] = [
  {
    label: 'macOS, Apple silicon',
    note: COPY.official,
    href: 'https://desktop.figma.com/mac-arm/Figma.zip',
  },
  { label: 'macOS, Intel', note: COPY.official, href: 'https://desktop.figma.com/mac/Figma.zip' },
  { label: 'Windows', note: COPY.official, href: 'https://desktop.figma.com/win/FigmaSetup.exe' },
  {
    label: 'Linux',
    note: COPY.fork,
    href: 'https://github.com/arximus88/figma-linux-next/releases/latest',
  },
];

/**
 * The design file, framed full-bleed, and the pointers beside it.
 *
 * Framed rather than only linked, because the question this view answers is "what
 * is the screen supposed to look like", and an answer behind a click in another
 * tab is one nobody checks against the running app. The app itself is one view
 * away, at the same size, which is the comparison worth making.
 *
 * **The frame is loaded on a button press, and the surface it will fill carries
 * the explanation until then.** Not a placeholder and nothing dashed: a reader
 * who never presses the button has read what the button does, why a Figma
 * sign-in screen may follow, and where the rest of this page is. The press is
 * what makes the one request to figma.com, so no reader of a documentation site
 * fetches a third-party design file they did not ask for, and there is nothing
 * to ask consent for.
 */
export function Design({ onAddress, wide, full }: ShellProps) {
  const intl = useWorkbenchIntl();

  /*
   * Page state and deliberately not in the address. `full=1` is shareable
   * because chrome is a preference; "the Figma file is loaded" must not be,
   * because a link that fetched a third-party frame on arrival is exactly what
   * the button exists to prevent.
   */
  const [framed, setFramed] = useState(false);
  const [reloads, setReloads] = useState(0);

  /** Narrow and not full: the sections are the page, so the frame gets a door. */
  const asPage = !wide && !full;

  return (
    <>
      <div
        className={cn(
          'stage-grid flex flex-col bg-surface',
          full ? 'h-dvh' : asPage ? 'min-h-[60dvh]' : 'h-full',
        )}
      >
        {framed ? (
          /*
            `allow-same-origin` beside `allow-scripts`, which oxlint warns about
            and which is right here. Its rule is about a SAME-origin frame, where
            the pair lets the document reach out and remove its own sandbox, so
            the attribute only looks like a precaution. This frame is figma.com:
            `allow-same-origin` grants it its own origin, not ours, and Figma
            needs it to reach its own storage. What the sandbox still withholds is
            what it is for here, top-level navigation above all: a third-party
            frame cannot move the page out from under the reader.
          */
          <iframe
            key={reloads}
            title={intl.formatMessage(COPY.frameTitle, { file: FIGMA_NAME })}
            src={FIGMA_EMBED}
            allowFullScreen
            /*
              `allow-storage-access-by-user-activation` is the one that makes the
              difference for a reader who IS signed in. `allow-same-origin` gives
              the frame its own origin, but a browser that partitions third-party
              state gives it a partitioned jar anyway, so Figma's session cookie is
              not in it and the frame draws the sign-in screen to somebody who is
              signed in one tab over. Figma's answer is the Storage Access API, and
              without this token the browser refuses the call before Figma can even
              ask: "document.requestStorageAccess() may not be called in a sandboxed
              iframe without allow-storage-access-by-user-activation". Reported from
              a reader's console on 2026-09-11, under Firefox with dynamic state
              partitioning on.

              It grants nothing by itself. It lets the frame ASK, and the reader
              answers. A reader with no Figma access still sees the sign-in screen,
              which is a permission and not a fault.
            */
            sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-storage-access-by-user-activation"
            /* `bg-surface` while it loads, which is a role and so is the right
               colour in both schemes. A white flash under a dark page is the
               half second this covers. */
            className="block h-full min-h-0 w-full flex-1 border-0 bg-surface"
          />
        ) : (
          /*
            `flex` with a child that is `w-full max-w-content`, not
            `grid place-content-center`. `place-content-center` sizes the item to
            its content and centres that, so at 390px a column whose cap is wider
            than the screen overflowed on BOTH sides: the h1 read "esign" and every
            line ran off the right. Measured on 2026-09-11.
          */
          <div className="flex min-h-full flex-1 items-center justify-center px-m py-xl">
            <div className="w-full max-w-content">
              <h1 className="text-headline-xl font-bold leading-tight tracking-tight">
                {/* `intl.formatMessage` and never `<FormattedMessage>`: that
                    component reads react-intl's own context, which the app's
                    provider shadows inside an `AppHost`. `test/i18n.test.ts`
                    fails on one, and `i18n/Localisation.tsx` carries the
                    measurement. */}
                {intl.formatMessage(COPY.title)}
              </h1>
              <p className="mt-xs text-m leading-relaxed text-on-canvas">
                {intl.formatMessage(COPY.lede, { file: FIGMA_NAME, b })}
              </p>

              <dl className="mt-m rounded-md border border-stroke bg-canvas p-sm text-s">
                <dt className="font-semibold text-on-canvas">{intl.formatMessage(COPY.loads)}</dt>
                <dd className="mt-4xs break-words font-mono text-on-canvas-muted">
                  {FIGMA_EMBED_SHORT}
                </dd>
                <dd className="mt-3xs leading-relaxed text-on-canvas-muted">
                  {intl.formatMessage(COPY.loadsNote)}
                </dd>

                <dt className="mt-s font-semibold text-on-canvas">
                  {intl.formatMessage(COPY.see)}
                </dt>
                <dd className="mt-4xs leading-relaxed text-on-canvas-muted">
                  {intl.formatMessage(COPY.seeNote)}
                </dd>
              </dl>

              <div className="mt-m">
                {asPage ? (
                  <Button size="lg" onClick={() => onAddress({ full: true })}>
                    <Maximize2 aria-hidden="true" />
                    {intl.formatMessage(COPY.full)}
                  </Button>
                ) : (
                  <Button size="lg" onClick={() => setFramed(true)}>
                    <ExternalLink aria-hidden="true" />
                    {intl.formatMessage(COPY.load)}
                  </Button>
                )}
                <p className={cn(NOTE, 'mt-2xs')}>
                  {intl.formatMessage(asPage ? COPY.fullNote : COPY.loadNote)}
                </p>
              </div>

              <p className={cn(NOTE, 'mt-m')}>
                {intl.formatMessage(wide ? COPY.restSide : COPY.restBelow)}
              </p>
            </div>
          </div>
        )}
      </div>

      <Slot id="context-bar">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2xs">
          <Button variant="outline" size="sm" asChild>
            <a href={FIGMA_FILE} target="_blank" rel="noreferrer noopener">
              <ExternalLink aria-hidden="true" />
              {intl.formatMessage(COPY.open)}
            </a>
          </Button>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label={intl.formatMessage(COPY.reload)}
                disabled={!framed}
                onClick={() => setReloads((n) => n + 1)}
              >
                <RotateCw aria-hidden="true" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">{intl.formatMessage(COPY.reload)}</TooltipContent>
          </Tooltip>
        </div>
      </Slot>

      <Slot id="design-links">
        <a
          className={cn(
            CARD,
            'block transition-colors hover:border-stroke-strong hover:bg-surface',
          )}
          href={FIGMA_FILE}
          target="_blank"
          rel="noreferrer noopener"
        >
          <span className="flex items-center gap-2xs text-m font-medium text-on-canvas">
            <ExternalLink aria-hidden="true" className="size-[0.875rem] shrink-0" />
            {intl.formatMessage(COPY.linksFile)}
          </span>
        </a>
        <a
          className={cn(
            CARD,
            'block transition-colors hover:border-stroke-strong hover:bg-surface',
          )}
          href={href('/preview')}
        >
          <span className="text-m font-medium text-on-canvas">
            {intl.formatMessage(COPY.linksApp)}
          </span>
        </a>
        <p className={NOTE}>{intl.formatMessage(COPY.linksNote)}</p>
      </Slot>

      <Slot id="design-clients">
        <p className={NOTE}>{intl.formatMessage(COPY.clientsNote)}</p>
        <ul className="flex flex-col gap-3xs">
          {CLIENTS.map((client) => (
            <li key={client.href}>
              <a
                href={client.href}
                target="_blank"
                rel="noreferrer noopener"
                className={cn(
                  CARD,
                  'flex flex-col transition-colors hover:border-stroke-strong hover:bg-surface',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                )}
              >
                <span className="flex items-center gap-2xs text-m font-medium text-on-canvas">
                  <Download aria-hidden="true" className="size-[0.875rem] shrink-0" />
                  {client.label}
                </span>
                <span className={cn(NOTE, 'mt-4xs')}>{intl.formatMessage(client.note)}</span>
              </a>
            </li>
          ))}
        </ul>
      </Slot>

      <Slot id="design-code">
        <div className={CARD}>
          <h4 className="text-m font-semibold text-on-canvas">
            {intl.formatMessage(COPY.colours)}
          </h4>
          <p className={cn(NOTE, 'mt-3xs')}>
            {intl.formatMessage(COPY.coloursNote, { pkg: TOKENS_PACKAGE, token: TOKEN, code })}
          </p>
          <p className="mt-2xs text-s">
            <a className={LINK} href={href('/decisions/0010')}>
              ADR 0010
            </a>
            {' · '}
            <a className={LINK} href={href('/decisions/0022')}>
              ADR 0022
            </a>
          </p>
        </div>

        <div className={CARD}>
          <h4 className="text-m font-semibold text-on-canvas">{intl.formatMessage(COPY.board)}</h4>
          <p className={cn(NOTE, 'mt-3xs')}>
            {intl.formatMessage(COPY.boardNote, { path: PLUGIN_DIRECTORY, code })}
          </p>
          <p className="mt-2xs text-s">
            <a className={LINK} href={href('/decisions/0021')}>
              ADR 0021
            </a>
          </p>
        </div>

        <div className={CARD}>
          <h4 className="text-m font-semibold text-on-canvas">{intl.formatMessage(COPY.plugin)}</h4>
          <p className={cn(NOTE, 'mt-3xs')}>
            {intl.formatMessage(COPY.pluginNote, {
              codeFile: PLUGIN_CODE,
              specFile: PLUGIN_SPEC,
              code,
            })}
          </p>
          <p className="mt-2xs text-s">
            <a className={LINK} href={href('/design/plugin')}>
              {intl.formatMessage(COPY.pluginDoc)}
            </a>
            {' · '}
            <a
              className={LINK}
              href={`${docsModule.repo}/tree/${docsModule.commit}/tools/figma-plugin`}
              target="_blank"
              rel="noreferrer noopener"
            >
              {intl.formatMessage(COPY.pluginRepo)}
            </a>
          </p>
        </div>
      </Slot>
    </>
  );
}
