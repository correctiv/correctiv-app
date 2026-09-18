import { defineMessages } from 'react-intl';

import type { ReactNode } from 'react';

import { useWorkbenchIntl } from '../i18n/Localisation';
import { cn } from '../lib/cn';
import {
  ArrowMarker,
  BAND,
  BOLD,
  BOX,
  BOX_CORE,
  CARD,
  CHIP,
  DASHED,
  DiagramFigure,
  DRAWING,
  HALO,
  MONO,
  MUTED,
  RULE,
  RULE_STRONG,
  T11,
  T12,
  T13,
  T16,
  WIRE,
} from './shared';

/**
 * Everything this drawing says, in ENGLISH; the German that ships is
 * `src/i18n/catalogue/de/coreAndHost.ts`.
 *
 * Named rather than called `COPY` because `diagrams/index.ts` imports the title
 * and the lede out of it: a drawing's name and the sentence under it belong to
 * the drawing and not to the table that lists them.
 *
 * **What is a word here and what is an identifier.** The eight chips across the
 * top are the directories of `packages/app-core/src`; the five card headings are
 * the interfaces `ports/index.ts` declares; the two package names and the two
 * adapter paths are paths. None of those is a word and all of them stay as they
 * are written — `test/diagrams.test.ts` reads the five interface names straight
 * straight out of the drawing and holds them to `CorePlatform`, so a translated one would
 * fail that check as well as being wrong. Everything this site wrote ABOUT them
 * is a message ([ADR 0052](../../../../adr/0052-the-sites-own-words-follow-the-setting.md) §1).
 *
 * **`needs` and `answers` are one id each, used five times.** The five cards say
 * the same two words over their two halves, and five ids reading "the core needs"
 * would be five entries a translator has to keep identical by hand.
 *
 * **A label wrapped across two or four `<text>` elements is that many ids**,
 * because SVG does not wrap and every line is placed by hand. Each line's
 * description names its siblings, so a translation can put the break at another
 * word rather than at the English one.
 *
 * **The port count is load-bearing English.** `test/diagrams.test.ts` counts the
 * members of `CorePlatform` and reads "five ports" and "the five interfaces" out
 * of this file's text, so the number and the noun beside it have to stay in the
 * `defaultMessage`. A second spelling of the same count anywhere in this file,
 * including in a description, makes that check throw rather than fail.
 */
export const CORE_AND_HOST_COPY = defineMessages({
  title: {
    id: 'coreAndHost.title',
    defaultMessage: 'The core and its host',
    description:
      'The drawing’s name, as the heading of its own page and on the card that opens it.',
  },
  lede: {
    id: 'coreAndHost.lede',
    defaultMessage:
      'All behaviour on one side, all platform on the other. The only crossing is five named ports, and the two small files that answer them are the whole cost of adding a host.',
    description: 'The paragraph under that heading.',
  },

  svgTitle: {
    id: 'coreAndHost.svg.title',
    defaultMessage:
      'The core and its host: packages/app-core above, apps/mobile below, joined only by five ports',
    description:
      'The accessible name of the picture, read aloud in place of it. Never drawn on the page. The two package names are paths and stay as they are.',
  },

  coreSide: {
    id: 'coreAndHost.core.side',
    defaultMessage: 'behaviour, all of it',
    description:
      'The right-hand label on the core’s box, opposite the package path. coreAndHost.host.side is the same label on the host’s box below.',
  },
  coreRule: {
    id: 'coreAndHost.core.rule',
    defaultMessage:
      'Imports no UI framework and no platform SDK. That rule is what gives the package its value.',
    description: 'The sentence inside the core’s box, under the row of directory chips.',
  },
  coreTest: {
    id: 'coreAndHost.core.test',
    defaultMessage:
      '<file>packages/app-core/test/boundary.test.ts</file> fails the build if a platform import ever appears.',
    description:
      'The line under that sentence. <file> marks a repository path drawn in monospace, which stays as it is written.',
  },

  calls: {
    id: 'coreAndHost.calls',
    defaultMessage: 'the core calls',
    description:
      'The verb on the four arrows running down from the core into the ports it needs in order to work. coreAndHost.reports is the verb on the fifth arrow.',
  },
  reports: {
    id: 'coreAndHost.reports',
    defaultMessage: 'the core reports',
    description:
      'The verb on the fifth arrow down, which has one of its own because the port it reaches is not something the core needs in order to work. coreAndHost.calls is the verb on the other four.',
  },
  storage: {
    id: 'coreAndHost.storage',
    defaultMessage: 'storage ports',
    description:
      'The name of the dashed frame around the first two cards, drawn over the frame’s top edge with a halo behind it.',
  },

  needs: {
    id: 'coreAndHost.needs',
    defaultMessage: 'the core needs',
    description:
      'The heading of the upper half of every one of the five port cards, drawn once per card. coreAndHost.answers is the heading of the lower half.',
  },
  answers: {
    id: 'coreAndHost.answers',
    defaultMessage: 'this host answers with',
    description:
      'The heading of the lower half of every one of the five port cards, drawn once per card. coreAndHost.needs is the heading of the upper half.',
  },
  asynchronously: {
    id: 'coreAndHost.asynchronously',
    defaultMessage: 'asynchronously',
    description:
      'The second line of what the core needs, on the first two cards. One id because both cards say the word for the same reason: the interface returns a promise.',
  },

  keyValueNeeds: {
    id: 'coreAndHost.keyValue.needs',
    defaultMessage: 'small settings,',
    description:
      'First line of what the core needs of KeyValueStore; coreAndHost.asynchronously is the second. Each line fits a card 172 units wide at 12px, so about 27 characters.',
  },
  keyValueAnswer1: {
    id: 'coreAndHost.keyValue.answer.1',
    defaultMessage: 'MMKV, one store the',
    description:
      'First of two lines of what this host answers KeyValueStore with; coreAndHost.keyValue.answer.2 is the second. MMKV is the name of the storage library and stays.',
  },
  keyValueAnswer2: {
    id: 'coreAndHost.keyValue.answer.2',
    defaultMessage: 'cache cannot reach',
    description:
      'Second of the two lines that begin at coreAndHost.keyValue.answer.1. Together they read as one phrase.',
  },

  blobNeeds: {
    id: 'coreAndHost.blob.needs',
    defaultMessage: 'the HTTP cache,',
    description:
      'First line of what the core needs of BlobStore; coreAndHost.asynchronously is the second.',
  },
  blobAnswer1: {
    id: 'coreAndHost.blob.answer.1',
    defaultMessage: 'a second MMKV store,',
    description:
      'First of two lines of what this host answers BlobStore with; coreAndHost.blob.answer.2 is the second.',
  },
  blobAnswer2: {
    id: 'coreAndHost.blob.answer.2',
    defaultMessage: 'bounded and evictable',
    description:
      'Second of the two lines that begin at coreAndHost.blob.answer.1: the core’s cache holds this store to a size and drops the oldest entry when it is over.',
  },

  bundleNeeds1: {
    id: 'coreAndHost.bundle.needs.1',
    defaultMessage: 'what shipped inside',
    description:
      'First of two lines of what the core needs of ContentBundle; coreAndHost.bundle.needs.2 is the second.',
  },
  bundleNeeds2: {
    id: 'coreAndHost.bundle.needs.2',
    defaultMessage: 'the app',
    description: 'Second of the two lines that begin at coreAndHost.bundle.needs.1.',
  },
  bundleAnswer: {
    id: 'coreAndHost.bundle.answer',
    defaultMessage: 'generated TS modules',
    description:
      'What this host answers ContentBundle with, on one line. TS is TypeScript, abbreviated because the card is 172 units wide.',
  },

  audioNeeds1: {
    id: 'coreAndHost.audio.needs.1',
    defaultMessage: 'playback, as',
    description:
      'First of two lines of what the core needs of AudioBackend; coreAndHost.audio.needs.2 is the second.',
  },
  audioNeeds2: {
    id: 'coreAndHost.audio.needs.2',
    defaultMessage: 'status ticks',
    description:
      'Second of the two lines that begin at coreAndHost.audio.needs.1: the backend reports by handing the core a status at intervals rather than by firing events it has to subscribe to.',
  },
  audioAnswer1: {
    id: 'coreAndHost.audio.answer.1',
    defaultMessage: 'expo-audio’s',
    description:
      'First of two lines of what this host answers AudioBackend with; coreAndHost.audio.answer.2 is the second. expo-audio is the package name and stays.',
  },
  audioAnswer2: {
    id: 'coreAndHost.audio.answer.2',
    defaultMessage: 'status events',
    description: 'Second of the two lines that begin at coreAndHost.audio.answer.1.',
  },

  errorNeeds1: {
    id: 'coreAndHost.error.needs.1',
    defaultMessage: 'to be heard: a fault',
    description:
      'First of two lines of what the core needs of ErrorReporter; coreAndHost.error.needs.2 is the second. This is the one card whose upper half says what the core needs in order to be heard rather than in order to work.',
  },
  errorNeeds2: {
    id: 'coreAndHost.error.needs.2',
    defaultMessage: 'no screen shows',
    description:
      'Second of the two lines that begin at coreAndHost.error.needs.1: a fault nothing in the interface tells the reader about.',
  },
  errorAnswer1: {
    id: 'coreAndHost.error.answer.1',
    defaultMessage: 'one log line, and no',
    description:
      'First of two lines of what this host answers ErrorReporter with; coreAndHost.error.answer.2 is the second.',
  },
  errorAnswer2: {
    id: 'coreAndHost.error.answer.2',
    defaultMessage: 'provider chosen yet',
    description:
      'Second of the two lines that begin at coreAndHost.error.answer.1: no reporting service has been picked.',
  },

  storageNote1: {
    id: 'coreAndHost.storage.note.1',
    defaultMessage: 'both asynchronous, split only',
    description:
      'First of four hand-wrapped lines under the two storage cards; the others are coreAndHost.storage.note.2, .3 and .4. All four are centred between two arrows 194 units apart, so no line may be wider than that.',
  },
  storageNote2: {
    id: 'coreAndHost.storage.note.2',
    defaultMessage: 'by what they hold, a settings',
    description: 'Second of the four lines that begin at coreAndHost.storage.note.1.',
  },
  storageNote3: {
    id: 'coreAndHost.storage.note.3',
    defaultMessage: 'string against a megabyte',
    description: 'Third of the four lines that begin at coreAndHost.storage.note.1.',
  },
  storageNote4: {
    id: 'coreAndHost.storage.note.4',
    defaultMessage: 'of cached feeds',
    description: 'Last of the four lines that begin at coreAndHost.storage.note.1.',
  },

  implements: {
    id: 'coreAndHost.implements',
    defaultMessage: 'the host implements',
    description:
      'The one verb on all five arrows running back up from the host into the ports, because the host answers the fifth exactly as it answers the other four.',
  },
  adapter: {
    id: 'coreAndHost.adapter',
    defaultMessage:
      '<muted>adapter </muted><file>lib/platform/expo.ts</file><muted> and </muted><file>lib/audio/backend.ts</file><muted>, the whole cost of adding a host</muted>',
    description:
      'The band across the top of the host’s box, centred. <file> marks a repository path in monospace, which stays as it is written; <muted> is the quieter type around the two paths.',
  },
  hostSide: {
    id: 'coreAndHost.host.side',
    defaultMessage: 'the host, all of the platform',
    description:
      'The right-hand label on the host’s box, opposite the package path. coreAndHost.core.side is the same label on the core’s box above.',
  },
  hostTargets: {
    id: 'coreAndHost.host.targets',
    defaultMessage: 'targets iOS, Android and web',
    description:
      'The last line in the host’s box, under the framework names. The three platform names stay as they are written.',
  },

  captionLead: {
    id: 'coreAndHost.caption.lead',
    defaultMessage:
      'Everything that behaves lives above the ports; everything that touches a platform lives below them.',
    description: 'The bold opening of the caption under the drawing.',
  },
  caption: {
    id: 'coreAndHost.caption',
    defaultMessage:
      'The core declares the five interfaces and calls them, and a test keeps the line from moving. Four of them it needs in order to work. <code>ErrorReporter</code> it needs in order to be heard: its default reports nowhere, nothing waits for the call, and an unconfigured core goes quiet rather than breaking. This host answers four of them in <code>apps/mobile/src/lib/platform/expo.ts</code> and the audio one in <code>apps/mobile/src/lib/audio/backend.ts</code>, which <code>apps/mobile/src/app/_layout.tsx</code> composes onto the other four. Adding a second host means writing those two files again.',
    description:
      'The rest of that caption. <code> marks an interface name or a repository path, which stay as they are written. "the five interfaces" is read out of this file by test/diagrams.test.ts and held to what CorePlatform declares, so the number and the noun beside it are load-bearing in English.',
  },

  altCoreTerm: {
    id: 'coreAndHost.alt.core.term',
    defaultMessage: '<code>packages/app-core</code>, the behaviour',
    description:
      'The first term in the list under the drawing. <code> marks the package path, which stays as it is written.',
  },
  altCore: {
    id: 'coreAndHost.alt.core',
    defaultMessage:
      'Holds stores, articles, media, services, data, lib, ports and types. It imports no UI framework and no platform SDK. <code>packages/app-core/test/boundary.test.ts</code> fails the build on an import matching its list.',
    description:
      'What that term says. The eight names are the directories of the package and stay as they are written; <code> marks the path of the test.',
  },
  altPortsTerm: {
    id: 'coreAndHost.alt.ports.term',
    defaultMessage: 'Five ports, the only crossing between the two',
    description:
      'The second term in that list. The count is read out of this file by test/diagrams.test.ts and held to what CorePlatform declares, so it is load-bearing in English.',
  },
  altKeyValue: {
    id: 'coreAndHost.alt.keyValue',
    defaultMessage:
      '<code>KeyValueStore</code>: the core needs small settings, asynchronously. This host answers with MMKV, in the store that holds what the reader chose.',
    description: 'One port in that list. <code> marks the interface name, which stays.',
  },
  altBlob: {
    id: 'coreAndHost.alt.blob',
    defaultMessage:
      '<code>BlobStore</code>: the core needs the HTTP cache, asynchronously. This host answers with a second MMKV store, which the core’s cache bounds and evicts from. Two stores rather than one is what makes eviction unable to reach a bookmark.',
    description: 'One port in that list. <code> marks the interface name, which stays.',
  },
  altBundle: {
    id: 'coreAndHost.alt.bundle',
    defaultMessage:
      '<code>ContentBundle</code>: the core needs what shipped inside the app. This host answers with generated TS modules.',
    description: 'One port in that list. <code> marks the interface name, which stays.',
  },
  altAudio: {
    id: 'coreAndHost.alt.audio',
    defaultMessage:
      '<code>AudioBackend</code>: the core needs playback, as status ticks. This host answers with expo-audio’s status events.',
    description: 'One port in that list. <code> marks the interface name, which stays.',
  },
  altError: {
    id: 'coreAndHost.alt.error',
    defaultMessage:
      '<code>ErrorReporter</code>: the core needs to be heard, for a fault no screen shows. This host answers with one log line, and no provider is chosen yet. It is the one the core does not need in order to work, which is why its default reports nowhere and why the call returns nothing for anyone to wait on. The host’s own error boundary reports through the same implementation, but it reaches it directly rather than across this line.',
    description: 'One port in that list. <code> marks the interface name, which stays.',
  },
  altStorage: {
    id: 'coreAndHost.alt.storage',
    defaultMessage:
      'Both storage ports are asynchronous. What separates them is what they hold, a settings string against a megabyte of cached feeds.',
    description: 'The sentence closing that list of ports.',
  },
  altAdapterTerm: {
    id: 'coreAndHost.alt.adapter.term',
    defaultMessage: 'The adapter',
    description: 'The third term in the list under the drawing.',
  },
  altAdapter: {
    id: 'coreAndHost.alt.adapter',
    defaultMessage:
      '<code>apps/mobile/src/lib/platform/expo.ts</code> answers four of them: the two storage interfaces, the content bundle and the reporter. <code>apps/mobile/src/lib/audio/backend.ts</code> answers the audio one, and <code>apps/mobile/src/app/_layout.tsx</code> composes it onto the other four, so that reasoning about where state is stored does not drag in an audio SDK. Those two files are the whole cost of adding a host.',
    description:
      'What that term says. <code> marks a repository path, which stays as it is written.',
  },
  altHostTerm: {
    id: 'coreAndHost.alt.host.term',
    defaultMessage: '<code>apps/mobile</code>, the host',
    description:
      'The last term in that list. <code> marks the package path, which stays as it is written.',
  },
  altHost: {
    id: 'coreAndHost.alt.host',
    defaultMessage: 'Expo / React Native, targeting iOS, Android and web.',
    description: 'What that term says. The framework and platform names stay as they are written.',
  },
});

/** An interface name or a repository path inside a sentence, in monospace. */
const code = (chunks: ReactNode[]) => <code>{chunks}</code>;
/** The same inside an SVG label, where a `code` element would not draw. */
const file = (chunks: ReactNode[]) => <tspan className={MONO}>{chunks}</tspan>;
/** The quieter type around a path inside an SVG label. */
const muted = (chunks: ReactNode[]) => <tspan className={MUTED}>{chunks}</tspan>;

/**
 * The drawing on its own, with no description attached by default.
 *
 * Split out because a page may want the picture and nothing else, and because the
 * ids inside it are referenced from outside, so they are part of what it is.
 *
 * `alt` is off here and on in the figure, and that asymmetry is the point: the
 * description it names lives in the figure, so a drawing rendered by itself,
 * as a thumbnail on `/diagrams`, would be pointing at an element that is not on
 * the page.
 */
export function CoreAndHostDrawing({ alt = false }: { alt?: boolean } = {}) {
  const intl = useWorkbenchIntl();

  return (
    <svg
      viewBox="0 0 1100 710"
      className={cn(DRAWING, 'block h-[710px] w-[1100px] max-w-none')}
      aria-labelledby="d1-title"
      aria-describedby={alt ? 'd1-alt' : undefined}
    >
      {/* `intl.formatMessage` and never `<FormattedMessage>`: that component reads
          react-intl's own context, which the app's provider shadows inside an
          `AppHost`. `test/i18n.test.ts` fails on one. */}
      <title id="d1-title">{intl.formatMessage(CORE_AND_HOST_COPY.svgTitle)}</title>
      <defs>
        <ArrowMarker id="d1-arrow" />
      </defs>

      <rect x="40" y="28" width="1020" height="190" rx="8" className={BOX_CORE} />
      <text x="60" y="56" className={cn(MONO, BOLD, T16)}>
        packages/app-core
      </text>
      <text x="1040" y="56" textAnchor="end" className={cn(MUTED, T12)}>
        {intl.formatMessage(CORE_AND_HOST_COPY.coreSide)}
      </text>
      {/*
        The directories of `packages/app-core/src` that the fourth drawing stacks,
        in the same order, so the two agree. `i18n` is the one directory neither
        drawing has a slot for: it is the core's own message descriptors, and what
        it holds is words rather than a layer.
      */}
      <g className={cn(MONO, T12)}>
        <rect x="60" y="84" width="108" height="28" rx="6" className={CHIP} />
        <text x="114" y="98" textAnchor="middle">
          stores
        </text>
        <rect x="184" y="84" width="108" height="28" rx="6" className={CHIP} />
        <text x="238" y="98" textAnchor="middle">
          articles
        </text>
        <rect x="308" y="84" width="108" height="28" rx="6" className={CHIP} />
        <text x="362" y="98" textAnchor="middle">
          media
        </text>
        <rect x="432" y="84" width="108" height="28" rx="6" className={CHIP} />
        <text x="486" y="98" textAnchor="middle">
          services
        </text>
        <rect x="556" y="84" width="108" height="28" rx="6" className={CHIP} />
        <text x="610" y="98" textAnchor="middle">
          data
        </text>
        <rect x="680" y="84" width="108" height="28" rx="6" className={CHIP} />
        <text x="734" y="98" textAnchor="middle">
          lib
        </text>
        <rect x="804" y="84" width="108" height="28" rx="6" className={CHIP} />
        <text x="858" y="98" textAnchor="middle">
          ports
        </text>
        <rect x="928" y="84" width="108" height="28" rx="6" className={CHIP} />
        <text x="982" y="98" textAnchor="middle">
          types
        </text>
      </g>
      <text x="60" y="146" className={cn(T13, BOLD)}>
        {intl.formatMessage(CORE_AND_HOST_COPY.coreRule)}
      </text>
      <text x="60" y="176" className={cn(T12, MUTED)}>
        {intl.formatMessage(CORE_AND_HOST_COPY.coreTest, { file })}
      </text>

      <line x1="141" y1="218" x2="141" y2="254" className={WIRE} markerEnd="url(#d1-arrow)" />
      <line x1="335" y1="218" x2="335" y2="254" className={WIRE} markerEnd="url(#d1-arrow)" />
      <line x1="529" y1="218" x2="529" y2="254" className={WIRE} markerEnd="url(#d1-arrow)" />
      <line x1="723" y1="218" x2="723" y2="254" className={WIRE} markerEnd="url(#d1-arrow)" />
      <line x1="959" y1="218" x2="959" y2="254" className={WIRE} markerEnd="url(#d1-arrow)" />
      <text x="545" y="236" className={cn(T11, MUTED)}>
        {intl.formatMessage(CORE_AND_HOST_COPY.calls)}
      </text>
      {/*
        The fifth arrow gets a verb of its own, because the fifth port is not a
        thing the core needs in order to work. The gap in front of its card and
        this label are the two places the drawing says so; the card itself says
        what it means.
      */}
      <text x="947" y="236" textAnchor="end" className={cn(T11, MUTED)}>
        {intl.formatMessage(CORE_AND_HOST_COPY.reports)}
      </text>

      <rect x="45" y="250" width="386" height="214" rx="10" className={DASHED} />
      <text x="238" y="250" textAnchor="middle" className={cn(T11, MUTED, HALO)}>
        {intl.formatMessage(CORE_AND_HOST_COPY.storage)}
      </text>

      <g className={T12}>
        <rect x="55" y="258" width="172" height="198" rx="8" className={CARD} />
        <text x="141" y="280" textAnchor="middle" className={cn(MONO, BOLD, T13)}>
          KeyValueStore
        </text>
        <line x1="55" y1="298" x2="227" y2="298" className={RULE} />
        <text x="141" y="318" textAnchor="middle" className={cn(T11, MUTED)}>
          {intl.formatMessage(CORE_AND_HOST_COPY.needs)}
        </text>
        <text x="141" y="338" textAnchor="middle">
          {intl.formatMessage(CORE_AND_HOST_COPY.keyValueNeeds)}
        </text>
        <text x="141" y="355" textAnchor="middle">
          {intl.formatMessage(CORE_AND_HOST_COPY.asynchronously)}
        </text>
        <text x="141" y="388" textAnchor="middle" className={cn(T11, MUTED)}>
          {intl.formatMessage(CORE_AND_HOST_COPY.answers)}
        </text>
        <text x="141" y="408" textAnchor="middle">
          {intl.formatMessage(CORE_AND_HOST_COPY.keyValueAnswer1)}
        </text>
        <text x="141" y="425" textAnchor="middle">
          {intl.formatMessage(CORE_AND_HOST_COPY.keyValueAnswer2)}
        </text>

        <rect x="249" y="258" width="172" height="198" rx="8" className={CARD} />
        <text x="335" y="280" textAnchor="middle" className={cn(MONO, BOLD, T13)}>
          BlobStore
        </text>
        <line x1="249" y1="298" x2="421" y2="298" className={RULE} />
        <text x="335" y="318" textAnchor="middle" className={cn(T11, MUTED)}>
          {intl.formatMessage(CORE_AND_HOST_COPY.needs)}
        </text>
        <text x="335" y="338" textAnchor="middle">
          {intl.formatMessage(CORE_AND_HOST_COPY.blobNeeds)}
        </text>
        <text x="335" y="355" textAnchor="middle">
          {intl.formatMessage(CORE_AND_HOST_COPY.asynchronously)}
        </text>
        <text x="335" y="388" textAnchor="middle" className={cn(T11, MUTED)}>
          {intl.formatMessage(CORE_AND_HOST_COPY.answers)}
        </text>
        <text x="335" y="408" textAnchor="middle">
          {intl.formatMessage(CORE_AND_HOST_COPY.blobAnswer1)}
        </text>
        <text x="335" y="425" textAnchor="middle">
          {intl.formatMessage(CORE_AND_HOST_COPY.blobAnswer2)}
        </text>

        <rect x="443" y="258" width="172" height="198" rx="8" className={CARD} />
        <text x="529" y="280" textAnchor="middle" className={cn(MONO, BOLD, T13)}>
          ContentBundle
        </text>
        <line x1="443" y1="298" x2="615" y2="298" className={RULE} />
        <text x="529" y="318" textAnchor="middle" className={cn(T11, MUTED)}>
          {intl.formatMessage(CORE_AND_HOST_COPY.needs)}
        </text>
        <text x="529" y="338" textAnchor="middle">
          {intl.formatMessage(CORE_AND_HOST_COPY.bundleNeeds1)}
        </text>
        <text x="529" y="355" textAnchor="middle">
          {intl.formatMessage(CORE_AND_HOST_COPY.bundleNeeds2)}
        </text>
        <text x="529" y="388" textAnchor="middle" className={cn(T11, MUTED)}>
          {intl.formatMessage(CORE_AND_HOST_COPY.answers)}
        </text>
        <text x="529" y="408" textAnchor="middle">
          {intl.formatMessage(CORE_AND_HOST_COPY.bundleAnswer)}
        </text>

        <rect x="637" y="258" width="172" height="198" rx="8" className={CARD} />
        <text x="723" y="280" textAnchor="middle" className={cn(MONO, BOLD, T13)}>
          AudioBackend
        </text>
        <line x1="637" y1="298" x2="809" y2="298" className={RULE} />
        <text x="723" y="318" textAnchor="middle" className={cn(T11, MUTED)}>
          {intl.formatMessage(CORE_AND_HOST_COPY.needs)}
        </text>
        <text x="723" y="338" textAnchor="middle">
          {intl.formatMessage(CORE_AND_HOST_COPY.audioNeeds1)}
        </text>
        <text x="723" y="355" textAnchor="middle">
          {intl.formatMessage(CORE_AND_HOST_COPY.audioNeeds2)}
        </text>
        <text x="723" y="388" textAnchor="middle" className={cn(T11, MUTED)}>
          {intl.formatMessage(CORE_AND_HOST_COPY.answers)}
        </text>
        <text x="723" y="408" textAnchor="middle">
          {intl.formatMessage(CORE_AND_HOST_COPY.audioAnswer1)}
        </text>
        <text x="723" y="425" textAnchor="middle">
          {intl.formatMessage(CORE_AND_HOST_COPY.audioAnswer2)}
        </text>

        {/*
          The fifth card, and the gap in front of it is the drawing's whole
          argument about it: the four to its left are what the core needs in
          order to WORK, and this one is what it needs in order to be HEARD. It
          keeps the two-half grammar of the others, because it is a port like
          them and the host answers it the same way, and the top half is where
          the difference is said.
        */}
        <rect x="873" y="258" width="172" height="198" rx="8" className={CARD} />
        <text x="959" y="280" textAnchor="middle" className={cn(MONO, BOLD, T13)}>
          ErrorReporter
        </text>
        <line x1="873" y1="298" x2="1045" y2="298" className={RULE} />
        <text x="959" y="318" textAnchor="middle" className={cn(T11, MUTED)}>
          {intl.formatMessage(CORE_AND_HOST_COPY.needs)}
        </text>
        <text x="959" y="338" textAnchor="middle">
          {intl.formatMessage(CORE_AND_HOST_COPY.errorNeeds1)}
        </text>
        <text x="959" y="355" textAnchor="middle">
          {intl.formatMessage(CORE_AND_HOST_COPY.errorNeeds2)}
        </text>
        <text x="959" y="388" textAnchor="middle" className={cn(T11, MUTED)}>
          {intl.formatMessage(CORE_AND_HOST_COPY.answers)}
        </text>
        <text x="959" y="408" textAnchor="middle">
          {intl.formatMessage(CORE_AND_HOST_COPY.errorAnswer1)}
        </text>
        <text x="959" y="425" textAnchor="middle">
          {intl.formatMessage(CORE_AND_HOST_COPY.errorAnswer2)}
        </text>
      </g>

      {/*
        Four lines at twelve rather than three at fourteen. The note has to clear
        the dashed frame above it and the host box below it, and stay inside the
        194 units between the two arrows either side of it; the old third line was
        wide enough to run through both arrows once the cards narrowed.
      */}
      <text x="238" y="476" textAnchor="middle" className={cn(T11, MUTED)}>
        {intl.formatMessage(CORE_AND_HOST_COPY.storageNote1)}
      </text>
      <text x="238" y="488" textAnchor="middle" className={cn(T11, MUTED)}>
        {intl.formatMessage(CORE_AND_HOST_COPY.storageNote2)}
      </text>
      <text x="238" y="500" textAnchor="middle" className={cn(T11, MUTED)}>
        {intl.formatMessage(CORE_AND_HOST_COPY.storageNote3)}
      </text>
      <text x="238" y="512" textAnchor="middle" className={cn(T11, MUTED)}>
        {intl.formatMessage(CORE_AND_HOST_COPY.storageNote4)}
      </text>

      <line x1="141" y1="520" x2="141" y2="460" className={WIRE} markerEnd="url(#d1-arrow)" />
      <line x1="335" y1="520" x2="335" y2="460" className={WIRE} markerEnd="url(#d1-arrow)" />
      <line x1="529" y1="520" x2="529" y2="460" className={WIRE} markerEnd="url(#d1-arrow)" />
      <line x1="723" y1="520" x2="723" y2="460" className={WIRE} markerEnd="url(#d1-arrow)" />
      <line x1="959" y1="520" x2="959" y2="460" className={WIRE} markerEnd="url(#d1-arrow)" />
      {/*
        One label for all five arrows up, and no second verb down here: the host
        implements the fifth port exactly as it implements the other four. The
        difference is in what the CORE does with it, which is why the drawing
        only splits the labels on the way down. That the host's own error
        boundary then calls that implementation is a fact about the host's
        inside and never crosses this line, so it is in the caption, not drawn.
      */}
      <text x="545" y="490" className={cn(T11, MUTED)}>
        {intl.formatMessage(CORE_AND_HOST_COPY.implements)}
      </text>

      <rect x="40" y="520" width="1020" height="170" rx="8" className={BOX} />
      <rect x="41" y="521" width="1018" height="34" rx="7" className={BAND} />
      <line x1="40" y1="556" x2="1060" y2="556" className={RULE_STRONG} />
      {/*
        Two files, not one. `expo.ts` answers four of the ports; the audio one is
        answered in `lib/audio/backend.ts` and composed onto the other four at the
        boot site, so that reasoning about where state is stored does not drag in an
        audio SDK. `expo.ts` says as much in its own closing comment.
      */}
      <text x="550" y="538" textAnchor="middle" className={T12}>
        {intl.formatMessage(CORE_AND_HOST_COPY.adapter, { file, muted })}
      </text>
      <text x="60" y="592" className={cn(MONO, BOLD, T16)}>
        apps/mobile
      </text>
      <text x="1040" y="592" textAnchor="end" className={cn(MUTED, T12)}>
        {intl.formatMessage(CORE_AND_HOST_COPY.hostSide)}
      </text>
      <text x="60" y="622" className={T13}>
        Expo / React Native
      </text>
      <text x="60" y="648" className={cn(T13, MUTED)}>
        {intl.formatMessage(CORE_AND_HOST_COPY.hostTargets)}
      </text>
    </svg>
  );
}

/**
 * The first drawing: where the behaviour ends and the platform begins.
 *
 * It sits in its own file because more than one page shows it, and the ids it
 * carries are referenced from outside, so they are part of what it is.
 *
 * `alt` is off where the page around the drawing already says the same thing in
 * prose. On `/diagrams` the list is not a caption, it is the page for anyone who
 * cannot use the drawing, and it stays. Inside `ARCHITECTURE.md` the ports are
 * named in a paragraph and again in a table, so the drawing there is described by
 * the document and the list comes off. The `<title>` inside the SVG names it
 * either way.
 */
export function CoreAndHost({ alt = true }: { alt?: boolean }) {
  const intl = useWorkbenchIntl();

  return (
    <DiagramFigure
      number={1}
      altId="d1-alt"
      alt={alt}
      drawing={<CoreAndHostDrawing alt={alt} />}
      caption={
        <>
          <strong>{intl.formatMessage(CORE_AND_HOST_COPY.captionLead)}</strong>{' '}
          {intl.formatMessage(CORE_AND_HOST_COPY.caption, { code })}
        </>
      }
    >
      <dl>
        <dt>{intl.formatMessage(CORE_AND_HOST_COPY.altCoreTerm, { code })}</dt>
        <dd>{intl.formatMessage(CORE_AND_HOST_COPY.altCore, { code })}</dd>
        <dt>{intl.formatMessage(CORE_AND_HOST_COPY.altPortsTerm)}</dt>
        <dd>
          <ul>
            <li>{intl.formatMessage(CORE_AND_HOST_COPY.altKeyValue, { code })}</li>
            <li>{intl.formatMessage(CORE_AND_HOST_COPY.altBlob, { code })}</li>
            <li>{intl.formatMessage(CORE_AND_HOST_COPY.altBundle, { code })}</li>
            <li>{intl.formatMessage(CORE_AND_HOST_COPY.altAudio, { code })}</li>
            <li>{intl.formatMessage(CORE_AND_HOST_COPY.altError, { code })}</li>
          </ul>
          {intl.formatMessage(CORE_AND_HOST_COPY.altStorage)}
        </dd>
        <dt>{intl.formatMessage(CORE_AND_HOST_COPY.altAdapterTerm)}</dt>
        <dd>{intl.formatMessage(CORE_AND_HOST_COPY.altAdapter, { code })}</dd>
        <dt>{intl.formatMessage(CORE_AND_HOST_COPY.altHostTerm, { code })}</dt>
        <dd>{intl.formatMessage(CORE_AND_HOST_COPY.altHost)}</dd>
      </dl>
    </DiagramFigure>
  );
}
