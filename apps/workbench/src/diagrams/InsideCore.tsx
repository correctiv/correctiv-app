import { defineMessages } from 'react-intl';

import type { ReactNode } from 'react';

import { useWorkbenchIntl } from '../i18n/Localisation';
import { cn } from '../lib/cn';
import {
  ArrowMarker,
  BOLD,
  BOUNDARY,
  BOX,
  BOX_CORE,
  CALLOUT,
  CHIP,
  CHIP_PORT,
  DiagramFigure,
  DRAWING,
  GHOST,
  LEAD,
  MONO,
  MUTED,
  T11,
  T12,
  T13,
  T16,
  WIRE,
} from './shared';

/**
 * Everything this drawing says, in ENGLISH; the German that ships is
 * `src/i18n/catalogue/de/insideCore.ts`.
 *
 * Named rather than called `COPY` because `diagrams/index.ts` imports the title
 * and the lede out of it: a drawing's name and the sentence under it belong to
 * the drawing and not to the table that lists them.
 *
 * **What is a word here and what is an identifier.** Every chip in the stack is a
 * directory, a file, an interface or a package — `stores`, `articles`, `media`,
 * `services`, `data`, `lib`, `ports`, `types`, the ten service modules, the five
 * port interfaces, `configurePlatform()`, `react-native`, `expo`, `expo-audio`,
 * `react-native-mmkv` — and every one of them stays as it is written.
 * `test/diagrams.test.ts` reads the five interface names straight out of the
 * drawing and holds them to what `CorePlatform` declares. What this site wrote
 * about them is a message
 * ([ADR 0052](../../../../adr/0052-the-sites-own-words-follow-the-setting.md) §1).
 *
 * **Two figures in here are held to the code and so are load-bearing English.**
 * `test/diagrams.test.ts` counts `.ts` and `.tsx` under `packages/app-core/src`
 * and reads "62 TypeScript files" out of this file's text; it counts the members
 * of `CorePlatform` and reads "five ports" out of it. Both figures therefore have
 * to stay, spelled that way, inside the `defaultMessage`. **The German carries a
 * second copy of each and nothing checks that one**, because the check reads the
 * drawings' own sources and the catalogue is not one of them. Whoever moves a
 * figure here moves it in `src/i18n/catalogue/de/insideCore.ts` as well.
 *
 * **A label wrapped across two or three `<text>` elements is that many ids**,
 * because SVG does not wrap and every line is placed by hand. Each line's
 * description names its siblings, so a translation may put the break elsewhere.
 */
export const INSIDE_CORE_COPY = defineMessages({
  title: {
    id: 'insideCore.title',
    defaultMessage: 'Inside the core',
    description:
      'The drawing’s name, as the heading of its own page and on the card that opens it.',
  },
  lede: {
    id: 'insideCore.lede',
    defaultMessage:
      '62 TypeScript files in seven layers. Imports point down the stack, the contracts sit at the bottom, and below them is a line nothing in the package crosses.',
    description:
      'The paragraph under that heading. The file count is read out of this file by test/diagrams.test.ts and held to what packages/app-core/src actually holds, so the numeral and the two words after it are load-bearing in English.',
  },

  svgTitle: {
    id: 'insideCore.svg.title',
    defaultMessage:
      'Inside packages/app-core: stores over articles and media, over services and data, over lib, over the ports and types, with a hard boundary below and the platform SDKs on the far side of it',
    description:
      'The accessible name of the picture, read aloud in place of it. Never drawn on the page. Every lower-case name in it is a directory of the package and stays as it is written.',
  },

  imports: {
    id: 'insideCore.imports',
    defaultMessage: 'imports point down the stack',
    description:
      'The label on the long arrow down the left edge, set on its side. It is as long as the stack is tall, about 500 units, so length is not the constraint here.',
  },
  files: {
    id: 'insideCore.files',
    defaultMessage: '62 TypeScript files',
    description:
      'The right-hand label on the core’s box, opposite the package path. The numeral is read out of this file by test/diagrams.test.ts and held to what packages/app-core/src holds, so it and the two words after it are load-bearing in English.',
  },

  stores: {
    id: 'insideCore.stores',
    defaultMessage: 'one Redux Toolkit store, 12 slices',
    description:
      'What the stores layer holds. Redux Toolkit is the library’s name and a slice is its own word for one part of a store; both stay.',
  },
  storesOwns: {
    id: 'insideCore.stores.owns',
    defaultMessage: 'The core owns the slices and exports <file>createAppStore()</file>.',
    description:
      'The first of two sentences inside the stores layer; insideCore.stores.host is the second. <file> marks a function name in monospace, which stays as it is written.',
  },
  storesHost: {
    id: 'insideCore.stores.host',
    defaultMessage: 'The host constructs the instance.',
    description: 'The second of the two sentences that begin at insideCore.stores.owns.',
  },

  articles: {
    id: 'insideCore.articles',
    defaultMessage: 'the Article model and its load cascade',
    description:
      'What the articles layer holds. Article is the name of the type and stays; the cascade is the order the five rungs of the sixth drawing are tried in.',
  },
  extractors: {
    id: 'insideCore.extractors',
    defaultMessage: 'two backends behind one <file>ArticleExtractor</file>',
    description:
      'The line beside the two small chips reading string and DOM. <file> marks a type name in monospace, which stays as it is written.',
  },

  mediaRule: {
    id: 'insideCore.media.rule',
    defaultMessage: 'one rule:',
    description:
      'First of three hand-wrapped lines in the media layer; insideCore.media.rule.2 and .3 are the others. The chip is 192 units wide and the lines start 16 units in, so none may run past about 175.',
  },
  mediaRule2: {
    id: 'insideCore.media.rule.2',
    defaultMessage: 'only one medium',
    description: 'Second of the three lines that begin at insideCore.media.rule.',
  },
  mediaRule3: {
    id: 'insideCore.media.rule.3',
    defaultMessage: 'plays at a time',
    description: 'Last of the three lines that begin at insideCore.media.rule.',
  },

  servicesFiles: {
    id: 'insideCore.services.files',
    defaultMessage: '10 files',
    description:
      'How many files the services layer holds, beside its name. insideCore.data.files and insideCore.types.files are the same label on the two layers beside it; insideCore.ports.file is the one on the ports layer.',
  },
  dataFiles: {
    id: 'insideCore.data.files',
    defaultMessage: '11 files',
    description:
      'How many files the data layer holds, beside its name. insideCore.services.files is the same label on the layer beside it.',
  },
  dataContent1: {
    id: 'insideCore.data.content.1',
    defaultMessage: 'typed content,',
    description:
      'First of two hand-wrapped lines in the data layer; insideCore.data.content.2 is the second.',
  },
  dataContent2: {
    id: 'insideCore.data.content.2',
    defaultMessage: 'checked by the compiler',
    description: 'Second of the two lines that begin at insideCore.data.content.1.',
  },

  lib: {
    id: 'insideCore.lib',
    defaultMessage: 'dependency-free string and date helpers',
    description: 'What the lib layer holds, on one line beside its name.',
  },

  portsFile: {
    id: 'insideCore.ports.file',
    defaultMessage: '<file>ports/index.ts</file>, 1 file',
    description:
      'What the ports layer is, beside its name. <file> marks a repository path in monospace, which stays as it is written.',
  },
  portsSplit: {
    id: 'insideCore.ports.split',
    defaultMessage: 'four to work, one to be heard',
    description:
      'Why the port chips are drawn on two rows: the four on the first are what the core needs in order to work, and ErrorReporter on the second is what it needs in order to be heard. Right-aligned at 480 and the label to its left ends near 245, so it has about 230 units at 11px.',
  },

  typesFiles: {
    id: 'insideCore.types.files',
    defaultMessage: '1 file',
    description:
      'How many files the types layer holds, beside its name. insideCore.ports.file says the same of the layer beside it and names the file as well.',
  },
  types: {
    id: 'insideCore.types',
    defaultMessage: 'the shared contracts',
    description: 'What the types layer holds, on one line under its name.',
  },

  boundary: {
    id: 'insideCore.boundary',
    defaultMessage: 'hard boundary, nothing crosses it',
    description: 'The label under the red line across the drawing.',
  },
  boundaryTest: {
    id: 'insideCore.boundary.test',
    defaultMessage:
      '<file>packages/app-core/test/boundary.test.ts</file> fails the build on an import matching its list: react-native, expo, node built-ins',
    description:
      'The line under that label. <file> marks a repository path in monospace, which stays as it is written, and so do the three names at the end: two are packages and the third is Node’s own modules.',
  },
  sdks: {
    id: 'insideCore.sdks',
    defaultMessage: 'platform SDKs, reached by the host only',
    description: 'The label beside the four greyed-out package chips below the red line.',
  },

  convention: {
    id: 'insideCore.convention',
    defaultMessage: 'convention',
    description:
      'The heading of both callout boxes on the right, drawn once in each. One id because the two say the same word for the same reason.',
  },
  selectors1: {
    id: 'insideCore.selectors.1',
    defaultMessage: 'Derived values are exported selectors',
    description:
      'First of two hand-wrapped lines in the upper callout; insideCore.selectors.2 is the second. The box is 280 units wide and the text starts 14 units in, so no line may run past about 265.',
  },
  selectors2: {
    id: 'insideCore.selectors.2',
    defaultMessage: 'taking state, never store methods.',
    description: 'Second of the two lines that begin at insideCore.selectors.1.',
  },
  subpaths: {
    id: 'insideCore.subpaths',
    defaultMessage: 'Subpath imports, no barrel:',
    description:
      'The first line of the lower callout. The import line under it is an example and is drawn as written; insideCore.rootEntry is the line after it. A barrel is a module that re-exports a folder, and this package has none.',
  },
  rootEntry: {
    id: 'insideCore.rootEntry',
    defaultMessage: 'The root entry exposes only the ports.',
    description: 'The last line of the lower callout, under the example import.',
  },

  captionLead: {
    id: 'insideCore.caption.lead',
    defaultMessage: 'Every layer imports downward, and the lowest one is a set of interfaces.',
    description: 'The bold opening of the caption under the drawing.',
  },
  caption: {
    id: 'insideCore.caption',
    defaultMessage:
      'The ports are declared here and implemented outside; the SDKs under the red line are the host’s business, and a test keeps them out. The root entry exports only the ports, so a host reaches anything else by its path.',
    description: 'The rest of that caption.',
  },

  altLede: {
    id: 'insideCore.alt.lede',
    defaultMessage:
      '<code>packages/app-core</code>, 62 TypeScript files. Imports point down the stack. Layers from the top:',
    description:
      'The paragraph opening the list under the drawing. <code> marks the package path, which stays as it is written. The file count is held to what packages/app-core/src holds by test/diagrams.test.ts, which reads this file, so the numeral and the two words after it are load-bearing in English.',
  },
  altStores: {
    id: 'insideCore.alt.stores',
    defaultMessage:
      '<term>stores</term>: one Redux Toolkit store with 12 slices. The core owns the slices and exports <code>createAppStore()</code>; the host constructs the instance.',
    description:
      'One layer in that list. <term> marks the directory’s name, which stays as it is written, and <code> a function name.',
  },
  altArticles: {
    id: 'insideCore.alt.articles',
    defaultMessage:
      '<term>articles</term>: the Article model and its load cascade. <code>articles/extract</code> holds two backends, a string one and a DOM one, behind one <code>ArticleExtractor</code> type. Beside it, <term>media</term>, with one rule: only one medium plays at a time.',
    description:
      'One layer in that list. <term> marks a directory’s name and <code> a path or a type name; all of them stay as they are written.',
  },
  altServices: {
    id: 'insideCore.alt.services',
    defaultMessage:
      '<term>services</term>, 10 files: auth, cache, http, peertube, podcast, radio, rss, search, spotlight, wp. Beside it, <term>data</term>, 11 files of typed content.',
    description:
      'One layer in that list. <term> marks a directory’s name; the ten names after the colon are the files in it and stay as they are written.',
  },
  altLib: {
    id: 'insideCore.alt.lib',
    defaultMessage: '<term>lib</term>: dependency-free string and date helpers.',
    description: 'One layer in that list. <term> marks the directory’s name.',
  },
  altPorts: {
    id: 'insideCore.alt.ports',
    defaultMessage:
      '<term>ports</term> and <term>types</term>, the contracts: <code>ports/index.ts</code>, one file, declares <code>KeyValueStore</code>, <code>BlobStore</code>, <code>ContentBundle</code>, <code>AudioBackend</code>, <code>ErrorReporter</code> and <code>configurePlatform()</code>. The drawing puts the first four on one row and <code>ErrorReporter</code> on the next, because the first four are what the core needs in order to work and this one is what it needs in order to be heard: the app runs without it, which is why its default reports nowhere. Beside them, <term>types</term>, one file of shared contracts.',
    description:
      'The last layer in that list. <term> marks a directory’s name and <code> a path, an interface or a function; all of them stay as they are written.',
  },
  altBoundary: {
    id: 'insideCore.alt.boundary',
    defaultMessage:
      'Below the contracts is a hard boundary. The platform SDKs (react-native, expo, expo-audio, react-native-mmkv) sit on the far side and nothing in the package imports them. <code>packages/app-core/test/boundary.test.ts</code> holds that line by refusing a list of names: react-native, expo, node built-ins, the NativeScript scopes, and the view layers the core used to be tied to. It matches the start of the import, so the storage SDK is caught by the <code>react-native</code> entry rather than needing one of its own. The same file also checks that <code>ports/index.ts</code> still declares all five ports, so a capability cannot reach the host without being named there.',
    description:
      'The paragraph after that list. <code> marks a path or a package name, which stay as they are written, and so do the four package names in the brackets. The port count is read out of this file by test/diagrams.test.ts and held to what CorePlatform declares, so it is load-bearing in English.',
  },
  altConventions: {
    id: 'insideCore.alt.conventions',
    defaultMessage:
      'Two conventions: derived values are exported selectors taking state, never store methods. Imports use subpaths and no barrel, for example <code>@correctiv/app-core/stores/session</code>, because the root entry exposes only the ports.',
    description:
      'The last paragraph under the drawing. <code> marks an import path, which stays as it is written.',
  },
});

/** A path, a type or a package name inside a sentence, which this site prints in monospace. */
const code = (chunks: ReactNode[]) => <code>{chunks}</code>;
/** A directory's name where the list under the figure gives it the weight of a term. */
const term = (chunks: ReactNode[]) => <strong>{chunks}</strong>;
/** The same as `code`, inside an SVG label, where a `code` element would not draw. */
const file = (chunks: ReactNode[]) => <tspan className={MONO}>{chunks}</tspan>;

/**
 * The drawing on its own, with no description attached by default.
 *
 * `alt` is off here and on in the figure, and that asymmetry is the point: the
 * description it names lives in the figure, so a drawing rendered by itself,
 * as a thumbnail on `/diagrams`, would be pointing at an element that is not on
 * the page.
 */
export function InsideCoreDrawing({ alt = false }: { alt?: boolean } = {}) {
  const intl = useWorkbenchIntl();

  return (
    <svg
      viewBox="0 0 1040 746"
      className={cn(DRAWING, 'block h-[746px] w-[1040px] max-w-none')}
      aria-labelledby="d3-title"
      aria-describedby={alt ? 'd3-alt' : undefined}
    >
      {/* `intl.formatMessage` and never `<FormattedMessage>`: that component reads
          react-intl's own context, which the app's provider shadows inside an
          `AppHost`. `test/i18n.test.ts` fails on one. */}
      <title id="d3-title">{intl.formatMessage(INSIDE_CORE_COPY.svgTitle)}</title>
      <defs>
        <ArrowMarker id="d3-arrow" />
      </defs>

      <line x1="22" y1="84" x2="22" y2="592" className={WIRE} markerEnd="url(#d3-arrow)" />
      <text
        transform="rotate(-90 10 338)"
        x="10"
        y="338"
        textAnchor="middle"
        className={cn(T11, MUTED)}
      >
        {intl.formatMessage(INSIDE_CORE_COPY.imports)}
      </text>

      <rect x="40" y="28" width="680" height="584" rx="8" className={BOX_CORE} />
      <text x="60" y="56" className={cn(MONO, BOLD, T16)}>
        packages/app-core
      </text>
      <text x="700" y="56" textAnchor="end" className={cn(MUTED, T12)}>
        {intl.formatMessage(INSIDE_CORE_COPY.files)}
      </text>

      <rect x="56" y="80" width="648" height="84" rx="6" className={CHIP} />
      <text x="72" y="100" className={cn(MONO, BOLD, T13)}>
        stores
      </text>
      <text x="140" y="100" className={cn(T12, MUTED)}>
        {intl.formatMessage(INSIDE_CORE_COPY.stores)}
      </text>
      <text x="72" y="126" className={T12}>
        {intl.formatMessage(INSIDE_CORE_COPY.storesOwns, { file })}
      </text>
      <text x="72" y="146" className={T12}>
        {intl.formatMessage(INSIDE_CORE_COPY.storesHost)}
      </text>

      <rect x="56" y="180" width="440" height="110" rx="6" className={CHIP} />
      <text x="72" y="200" className={cn(MONO, BOLD, T13)}>
        articles
      </text>
      <text x="150" y="200" className={cn(T12, MUTED)}>
        {intl.formatMessage(INSIDE_CORE_COPY.articles)}
      </text>
      <text x="72" y="236" className={cn(MONO, T11, MUTED)}>
        articles/extract
      </text>
      <rect x="72" y="250" width="56" height="24" rx="5" className={BOX} />
      <text x="100" y="262" textAnchor="middle" className={cn(MONO, T12)}>
        string
      </text>
      <rect x="136" y="250" width="46" height="24" rx="5" className={BOX} />
      <text x="159" y="262" textAnchor="middle" className={cn(MONO, T12)}>
        DOM
      </text>
      <text x="194" y="262" className={T12}>
        {intl.formatMessage(INSIDE_CORE_COPY.extractors, { file })}
      </text>

      <rect x="512" y="180" width="192" height="110" rx="6" className={CHIP} />
      <text x="528" y="200" className={cn(MONO, BOLD, T13)}>
        media
      </text>
      <text x="528" y="230" className={T12}>
        {intl.formatMessage(INSIDE_CORE_COPY.mediaRule)}
      </text>
      <text x="528" y="248" className={T12}>
        {intl.formatMessage(INSIDE_CORE_COPY.mediaRule2)}
      </text>
      <text x="528" y="266" className={T12}>
        {intl.formatMessage(INSIDE_CORE_COPY.mediaRule3)}
      </text>

      <rect x="56" y="306" width="440" height="110" rx="6" className={CHIP} />
      <text x="72" y="326" className={cn(MONO, BOLD, T13)}>
        services
      </text>
      <text x="150" y="326" className={cn(T12, MUTED)}>
        {intl.formatMessage(INSIDE_CORE_COPY.servicesFiles)}
      </text>
      <g className={cn(MONO, T12)}>
        <rect x="72" y="344" width="44" height="24" rx="5" className={BOX} />
        <text x="94" y="356" textAnchor="middle">
          auth
        </text>
        <rect x="122" y="344" width="52" height="24" rx="5" className={BOX} />
        <text x="148" y="356" textAnchor="middle">
          cache
        </text>
        <rect x="180" y="344" width="44" height="24" rx="5" className={BOX} />
        <text x="202" y="356" textAnchor="middle">
          http
        </text>
        <rect x="230" y="344" width="74" height="24" rx="5" className={BOX} />
        <text x="267" y="356" textAnchor="middle">
          peertube
        </text>
        <rect x="310" y="344" width="66" height="24" rx="5" className={BOX} />
        <text x="343" y="356" textAnchor="middle">
          podcast
        </text>
        <rect x="72" y="380" width="52" height="24" rx="5" className={BOX} />
        <text x="98" y="392" textAnchor="middle">
          radio
        </text>
        <rect x="130" y="380" width="36" height="24" rx="5" className={BOX} />
        <text x="148" y="392" textAnchor="middle">
          rss
        </text>
        <rect x="172" y="380" width="58" height="24" rx="5" className={BOX} />
        <text x="201" y="392" textAnchor="middle">
          search
        </text>
        <rect x="236" y="380" width="80" height="24" rx="5" className={BOX} />
        <text x="276" y="392" textAnchor="middle">
          spotlight
        </text>
        <rect x="322" y="380" width="30" height="24" rx="5" className={BOX} />
        <text x="337" y="392" textAnchor="middle">
          wp
        </text>
      </g>

      <rect x="512" y="306" width="192" height="110" rx="6" className={CHIP} />
      <text x="528" y="326" className={cn(MONO, BOLD, T13)}>
        data
      </text>
      <text x="580" y="326" className={cn(T12, MUTED)}>
        {intl.formatMessage(INSIDE_CORE_COPY.dataFiles)}
      </text>
      <text x="528" y="356" className={T12}>
        {intl.formatMessage(INSIDE_CORE_COPY.dataContent1)}
      </text>
      <text x="528" y="374" className={T12}>
        {intl.formatMessage(INSIDE_CORE_COPY.dataContent2)}
      </text>

      <rect x="56" y="432" width="648" height="44" rx="6" className={CHIP} />
      <text x="72" y="454" className={cn(MONO, BOLD, T13)}>
        lib
      </text>
      <text x="120" y="454" className={T12}>
        {intl.formatMessage(INSIDE_CORE_COPY.lib)}
      </text>

      {/*
        The bottom layer is two directories, so it is drawn the way the two rows
        above it are: a wide chip and a narrow one. `types` used to be a pair of
        right-aligned labels floating inside the ports chip, which put "the shared
        contracts" straight through `configurePlatform()` at every width.

        Two rows of chips inside `ports`, and the break between them is the point.
        The four on the first row are what the core needs in order to WORK.
        `ErrorReporter` is on its own because it is what the core needs in order
        to be HEARD: the app runs without it, which is exactly why its default
        can report nowhere. `configurePlatform()` keeps it company because it is
        the one thing in this file that is not an interface.
      */}
      <rect x="56" y="492" width="440" height="104" rx="6" className={CHIP} />
      <text x="72" y="512" className={cn(MONO, BOLD, T13)}>
        ports
      </text>
      <text x="128" y="512" className={cn(MONO, T11, MUTED)}>
        {intl.formatMessage(INSIDE_CORE_COPY.portsFile, { file })}
      </text>
      <text x="480" y="512" textAnchor="end" className={cn(T11, MUTED)}>
        {intl.formatMessage(INSIDE_CORE_COPY.portsSplit)}
      </text>
      <g className={cn(MONO, T12)}>
        <rect x="72" y="528" width="106" height="24" rx="5" className={CHIP_PORT} />
        <text x="125" y="540" textAnchor="middle">
          KeyValueStore
        </text>
        <rect x="184" y="528" width="78" height="24" rx="5" className={CHIP_PORT} />
        <text x="223" y="540" textAnchor="middle">
          BlobStore
        </text>
        <rect x="268" y="528" width="106" height="24" rx="5" className={CHIP_PORT} />
        <text x="321" y="540" textAnchor="middle">
          ContentBundle
        </text>
        <rect x="380" y="528" width="98" height="24" rx="5" className={CHIP_PORT} />
        <text x="429" y="540" textAnchor="middle">
          AudioBackend
        </text>
        <rect x="72" y="560" width="106" height="24" rx="5" className={CHIP_PORT} />
        <text x="125" y="572" textAnchor="middle">
          ErrorReporter
        </text>
        <rect x="184" y="560" width="148" height="24" rx="5" className={BOX} />
        <text x="258" y="572" textAnchor="middle">
          configurePlatform()
        </text>
      </g>

      <rect x="512" y="492" width="192" height="104" rx="6" className={CHIP} />
      <text x="528" y="512" className={cn(MONO, BOLD, T13)}>
        types
      </text>
      <text x="580" y="512" className={cn(T12, MUTED)}>
        {intl.formatMessage(INSIDE_CORE_COPY.typesFiles)}
      </text>
      <text x="528" y="542" className={T12}>
        {intl.formatMessage(INSIDE_CORE_COPY.types)}
      </text>

      <line x1="40" y1="636" x2="720" y2="636" className={BOUNDARY} />
      <text x="40" y="658" className={cn(T12, BOLD)}>
        {intl.formatMessage(INSIDE_CORE_COPY.boundary)}
      </text>
      {/*
        The test matches a list of names, not the region of this drawing. Its
        patterns are anchored at the start of the import, so `react-native`,
        `react-native-mmkv` and `expo-audio` are all caught. Saying "anything
        below" made the drawing promise more than the test.
      */}
      <text x="40" y="676" className={cn(T12, MUTED)}>
        {intl.formatMessage(INSIDE_CORE_COPY.boundaryTest, { file })}
      </text>
      <g className={cn(MONO, T12, MUTED)}>
        <rect x="40" y="696" width="100" height="30" rx="6" className={GHOST} />
        <text x="90" y="711" textAnchor="middle">
          react-native
        </text>
        <rect x="150" y="696" width="50" height="30" rx="6" className={GHOST} />
        <text x="175" y="711" textAnchor="middle">
          expo
        </text>
        <rect x="210" y="696" width="90" height="30" rx="6" className={GHOST} />
        <text x="255" y="711" textAnchor="middle">
          expo-audio
        </text>
        <rect x="310" y="696" width="150" height="30" rx="6" className={GHOST} />
        <text x="385" y="711" textAnchor="middle">
          react-native-mmkv
        </text>
      </g>
      <text x="476" y="711" className={cn(T11, MUTED)}>
        {intl.formatMessage(INSIDE_CORE_COPY.sdks)}
      </text>

      <rect x="740" y="80" width="280" height="84" rx="6" className={CALLOUT} />
      <line x1="740" y1="122" x2="704" y2="122" className={LEAD} />
      <text x="754" y="102" className={cn(T11, MUTED)}>
        {intl.formatMessage(INSIDE_CORE_COPY.convention)}
      </text>
      <text x="754" y="122" className={T12}>
        {intl.formatMessage(INSIDE_CORE_COPY.selectors1)}
      </text>
      <text x="754" y="140" className={T12}>
        {intl.formatMessage(INSIDE_CORE_COPY.selectors2)}
      </text>

      <rect x="740" y="492" width="280" height="104" rx="6" className={CALLOUT} />
      <line x1="740" y1="544" x2="704" y2="544" className={LEAD} />
      <text x="754" y="514" className={cn(T11, MUTED)}>
        {intl.formatMessage(INSIDE_CORE_COPY.convention)}
      </text>
      <text x="754" y="534" className={T12}>
        {intl.formatMessage(INSIDE_CORE_COPY.subpaths)}
      </text>
      <text x="754" y="554" className={cn(MONO, T11)}>
        @correctiv/app-core/stores/session
      </text>
      <text x="754" y="574" className={T12}>
        {intl.formatMessage(INSIDE_CORE_COPY.rootEntry)}
      </text>
    </svg>
  );
}

/**
 * The fourth drawing: how the core is layered inside, and the line below it that
 * nothing in the package crosses.
 *
 * The list under it is not a caption, it is the page for anyone who cannot use
 * the drawing, and `aria-describedby` points at it, which is why the ids here
 * have to stay as they are.
 */
export function InsideCore({ alt = true }: { alt?: boolean }) {
  const intl = useWorkbenchIntl();

  return (
    // Fourth in the rail, and `d3-` inside the drawing: those ids are older than the
    // order, are only ever read by the `aria-labelledby` beside them, and are left
    // alone rather than renumbered for tidiness.
    <DiagramFigure
      number={4}
      altId="d3-alt"
      alt={alt}
      drawing={<InsideCoreDrawing alt={alt} />}
      caption={
        <>
          <strong>{intl.formatMessage(INSIDE_CORE_COPY.captionLead)}</strong>{' '}
          {intl.formatMessage(INSIDE_CORE_COPY.caption)}
        </>
      }
    >
      <p>{intl.formatMessage(INSIDE_CORE_COPY.altLede, { code })}</p>
      <ol>
        <li>{intl.formatMessage(INSIDE_CORE_COPY.altStores, { code, term })}</li>
        <li>{intl.formatMessage(INSIDE_CORE_COPY.altArticles, { code, term })}</li>
        <li>{intl.formatMessage(INSIDE_CORE_COPY.altServices, { code, term })}</li>
        <li>{intl.formatMessage(INSIDE_CORE_COPY.altLib, { code, term })}</li>
        <li>{intl.formatMessage(INSIDE_CORE_COPY.altPorts, { code, term })}</li>
      </ol>
      <p>{intl.formatMessage(INSIDE_CORE_COPY.altBoundary, { code })}</p>
      <p>{intl.formatMessage(INSIDE_CORE_COPY.altConventions, { code })}</p>
    </DiagramFigure>
  );
}
