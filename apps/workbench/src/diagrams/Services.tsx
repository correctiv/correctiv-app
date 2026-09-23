import { defineMessages } from 'react-intl';

import type { ReactNode } from 'react';

import { useWorkbenchIntl } from '../i18n/Localisation';
import { cn } from '../lib/cn';
import { href } from '../router';
import {
  ARC_INDEX,
  BOLD,
  BOX_CORE,
  CHIP_PORT,
  DiagramFigure,
  DRAWING,
  HALO,
  MARKER,
  MONO,
  MUTED,
  NODE_INTACT,
  NODE_MOOT,
  NODE_STRUCK,
  ON_ALTERNATIVE,
  RULE,
  WIRE,
} from './shared';

/**
 * Everything this drawing says, in ENGLISH; the German that ships is
 * `src/i18n/catalogue/de/services.ts`.
 *
 * Named rather than called `COPY` because `diagrams/index.ts` imports the title
 * and the lede out of it: a drawing's name and the sentence under it belong to the
 * drawing and not to the table that lists them, and the importer has copy of its
 * own to keep out of the way of.
 *
 * **What is a word here and what is a name.** A host, a product and a protocol
 * keep their own spelling — `correctiv.org`, `Castopod`, `PeerTube`, `WordPress
 * REST`, `GraphQL`, `Atom`, `beabee` — because a name is the same word in every
 * language. What this site wrote about them is a message: what a source answers
 * with, whether it is live, and the two legend lines under the drawing
 * ([ADR 0052](../../../../adr/0052-the-sites-own-words-follow-the-setting.md) §1).
 *
 * **A label wrapped across two `<text>` elements is two ids**, because SVG does
 * not wrap and each line is placed by hand. The two carry each other's id in their
 * descriptions, so a translator can move a word from one line to the other rather
 * than being held to the English break.
 */
export const SERVICES_COPY = defineMessages({
  title: {
    id: 'services.title',
    defaultMessage: 'The app and what it talks to',
    description:
      'The drawing’s name, as the heading of its own page and on the card that opens it.',
  },
  lede: {
    id: 'services.lede',
    defaultMessage:
      'One of these is different. beabee answers who someone is and whether their membership includes the app. Everything else answers what to show them. Most content is live today; the identity part is still simulated.',
    description: 'The paragraph under that heading. beabee is a product name and stays.',
  },

  svgTitle: {
    id: 'services.svg.title',
    defaultMessage:
      'The app, the identity system it asks about membership, and the content sources it reads',
    description:
      'The accessible name of the picture, read aloud in place of it. Never drawn on the page.',
  },

  app: {
    id: 'services.app',
    defaultMessage: 'the app',
    description:
      'The heading on the box standing for the whole app, with the two package paths under it.',
  },
  appRequests: {
    id: 'services.app.requests',
    defaultMessage: 'every request below is the core’s',
    description:
      'The last line inside that box: every wire leaving it is a call the core makes, not the host. It has the width of the box, about 195 units at 12px, and no more.',
  },

  beabeeRole: {
    id: 'services.beabee.role',
    defaultMessage: 'identity and membership',
    description: 'The line under the product name beabee, saying what it answers about.',
  },
  beabeeAnswer1: {
    id: 'services.beabee.answer.1',
    defaultMessage: 'one login for website and app: the tier, whether',
    description:
      'First of two hand-wrapped lines under that; services.beabee.answer.2 is the second. SVG does not wrap, so the break is set by hand and a translation may put it at a different word.',
  },
  beabeeAnswer2: {
    id: 'services.beabee.answer.2',
    defaultMessage: 'the app is included, why, and for how long',
    description:
      'Second of the two lines that begin at services.beabee.answer.1. Together they read as one sentence.',
  },
  ask: {
    id: 'services.ask',
    defaultMessage: 'who is this, and may they be here',
    description:
      'The question on the wire from the app up to beabee, drawn over the line with a halo behind it. It is the one question no content source answers.',
  },
  simulated: {
    id: 'services.simulated',
    defaultMessage: 'simulated today',
    description:
      'A badge on club yellow over the beabee box. It fits a chip 150 units wide at 11px, so a longer wording needs the chip widened with it.',
  },

  content: {
    id: 'services.content',
    defaultMessage: 'CONTENT',
    description:
      'The heading over the band of content sources, drawn in capitals above a rule. German capitalises the same way.',
  },

  wordpress: {
    id: 'services.row.wordpress',
    defaultMessage: 'WordPress REST: posts, newsletters, search',
    description:
      'What correctiv.org answers. WordPress REST is the name of the interface and stays; posts, newsletters and search are what it returns.',
  },
  castopod: {
    id: 'services.row.castopod',
    defaultMessage: 'Castopod, podcast RSS per show',
    description: 'What salon5.correctiv.net answers. Castopod is the product and stays.',
  },
  icecast: {
    id: 'services.row.icecast',
    defaultMessage: 'live radio, three mounts',
    description:
      'What icecast.correctiv.net answers. A mount is Icecast’s own word for one stream on a server.',
  },
  peertube: {
    id: 'services.row.peertube',
    defaultMessage: 'PeerTube, nine channels',
    description: 'What tube.funfacts.de answers. PeerTube is the product and stays.',
  },
  atom: {
    id: 'services.row.atom',
    defaultMessage: 'Atom feeds',
    description: 'What YouTube answers with. Atom is the name of the feed format and stays.',
  },
  faktenforum: {
    id: 'services.row.faktenforum',
    defaultMessage: 'GraphQL, the claims',
    description:
      'What Faktenforum would answer. A claim here is a statement the community fact-checks, which the app itself calls a Behauptung.',
  },
  atlas: {
    id: 'services.row.atlas',
    defaultMessage: 'no public API exists',
    description: 'Why abriss-atlas.de is drawn as a file rather than as a service.',
  },
  crowdnewsroom: {
    id: 'services.row.crowdnewsroom',
    defaultMessage: 'the callouts',
    description:
      'What beabee CrowdNewsroom would answer: the invitations to take part that the app shows on its Mitmachen screen.',
  },

  legendLive: {
    id: 'services.legend.live',
    defaultMessage: 'live today, over the network',
    description:
      'The legend for a solid wire and a filled dot. services.legend.sample is the other half.',
  },
  legendSample: {
    id: 'services.legend.sample',
    defaultMessage: 'a checked-in file, shaped like the API that will replace it',
    description:
      'The legend for a dashed wire and a broken ring. It runs to the right edge of the drawing, so it has about 330 units at 11px and no more.',
  },

  captionLead: {
    id: 'services.caption.lead',
    defaultMessage: 'beabee is the door; the rest is what is behind it.',
    description: 'The bold opening of the caption under the drawing.',
  },
  caption: {
    id: 'services.caption',
    defaultMessage:
      'Its answer decides whether the app shows its routes at all. No content source does that, so it has a line of its own. Today the answer is simulated, in <code>services/auth.service.ts</code>, and its shape is the contract. Five content sources are live; three are files in the shape of the API meant to replace them. The <board>sources board</board> shows which is which, with the figures.',
    description:
      'The rest of that caption. <code> marks a file path, which stays as it is written. <board> is the link to /sources and the words inside it are that page’s own name. The two counts are held to the drawing’s own rows by test/diagrams.test.ts, which reads this sentence, so the words around each number are load-bearing in English.',
  },

  altBeabeeLead: {
    id: 'services.alt.beabee.lead',
    defaultMessage: 'beabee, identity and membership.',
    description: 'The bold opening of the first paragraph of the list under the drawing.',
  },
  altBeabee: {
    id: 'services.alt.beabee',
    defaultMessage:
      'One login for the website and the app. It answers with the tier, whether the app is included, why, and for how long. The app asks it once at the door and renders its routes only on a yes. Simulated today in <code>packages/app-core/src/services/auth.service.ts</code>; nothing reaches a network, and the screen that calls it says so.',
    description:
      'The rest of that paragraph. <code> marks a file path, which stays as it is written.',
  },
  altLiveHeading: {
    id: 'services.alt.live.heading',
    defaultMessage: 'Content the app reads live',
    description: 'The heading over the list of sources the app really reaches over the network.',
  },
  altLiveWordpress: {
    id: 'services.alt.live.wordpress',
    defaultMessage:
      '<code>correctiv.org</code>, WordPress REST: articles by category, the newsletter archive, and search.',
    description: 'One entry in that list. <code> marks a host name, which stays as it is written.',
  },
  altLiveCastopod: {
    id: 'services.alt.live.castopod',
    defaultMessage:
      '<code>salon5.correctiv.net</code>, CORRECTIV’s own Castopod, standard podcast RSS per show.',
    description: 'One entry in that list. <code> marks a host name, which stays as it is written.',
  },
  altLiveIcecast: {
    id: 'services.alt.live.icecast',
    defaultMessage: '<code>icecast.correctiv.net</code>, live radio, three mounts.',
    description: 'One entry in that list. <code> marks a host name, which stays as it is written.',
  },
  altLivePeertube: {
    id: 'services.alt.live.peertube',
    defaultMessage: '<code>tube.funfacts.de</code>, CORRECTIV’s own PeerTube, nine channels.',
    description: 'One entry in that list. <code> marks a host name, which stays as it is written.',
  },
  altLiveYouTube: {
    id: 'services.alt.live.youtube',
    defaultMessage: 'YouTube, Atom feeds.',
    description: 'One entry in that list. Both words are names and stay as they are.',
  },
  altSampleHeading: {
    id: 'services.alt.sample.heading',
    defaultMessage: 'Content that is a file standing in for a service',
    description: 'The heading over the list of sources the app does not reach yet.',
  },
  altSampleFaktenforum: {
    id: 'services.alt.sample.faktenforum',
    defaultMessage: 'Faktenforum, a GraphQL backend, for the claims.',
    description: 'One entry in that list. Faktenforum and GraphQL are names and stay.',
  },
  altSampleAtlas: {
    id: 'services.alt.sample.atlas',
    defaultMessage: 'abriss-atlas.de, which has no public API.',
    description: 'One entry in that list. The host name stays as it is written.',
  },
  altSampleCrowdnewsroom: {
    id: 'services.alt.sample.crowdnewsroom',
    defaultMessage: 'beabee CrowdNewsroom, for the callouts.',
    description: 'One entry in that list. beabee CrowdNewsroom is a product name and stays.',
  },
  altClosing: {
    id: 'services.alt.closing',
    defaultMessage:
      'The counts, the dates each figure was measured on, and the wanted features with no source at all are on the sources board.',
    description: 'The last paragraph of the list under the drawing.',
  },
});

/** A path or a host name inside a sentence, which this site prints in monospace. */
const code = (chunks: ReactNode[]) => <code>{chunks}</code>;
/** The link out of the caption to `/sources`. */
const board = (chunks: ReactNode[]) => (
  <a href={href('/sources')} className="underline decoration-accent underline-offset-2">
    {chunks}
  </a>
);

/**
 * The content band's rows, which the drawing maps over.
 *
 * `name` and `state` stay string literals on purpose: `test/diagrams.test.ts`
 * parses this file and reads those two off the object, so that a source drawn as a
 * file can be held to what `content/sources.manifest.ts` still stands in for. A
 * host name is not a word in any case. `detail` is what this site says about the
 * row and is a message.
 */
const ROWS = [
  { y: 214, name: 'correctiv.org', detail: SERVICES_COPY.wordpress, state: 'live' },
  { y: 254, name: 'salon5.correctiv.net', detail: SERVICES_COPY.castopod, state: 'live' },
  { y: 294, name: 'icecast.correctiv.net', detail: SERVICES_COPY.icecast, state: 'live' },
  { y: 334, name: 'tube.funfacts.de', detail: SERVICES_COPY.peertube, state: 'live' },
  { y: 374, name: 'YouTube', detail: SERVICES_COPY.atom, state: 'live' },
  { y: 414, name: 'Faktenforum', detail: SERVICES_COPY.faktenforum, state: 'sample' },
  { y: 454, name: 'abriss-atlas.de', detail: SERVICES_COPY.atlas, state: 'sample' },
  { y: 494, name: 'beabee CrowdNewsroom', detail: SERVICES_COPY.crowdnewsroom, state: 'sample' },
];

/**
 * The drawing alone, without the box that scrolls it or the list beside it.
 *
 * It names itself through the `<title>` inside it rather than an id outside, so
 * unlike the others it needs nothing from the page around it.
 */
export function ServicesDrawing() {
  const intl = useWorkbenchIntl();

  return (
    <svg viewBox="0 0 980 580" className={cn(DRAWING, 'h-auto w-[980px]')}>
      {/* `intl.formatMessage` and never `<FormattedMessage>`: that component reads
          react-intl's own context, which the app's provider shadows inside an
          `AppHost`. `test/i18n.test.ts` fails on one. */}
      <title>{intl.formatMessage(SERVICES_COPY.svgTitle)}</title>

      <defs>
        <marker
          id="d4-arrow"
          viewBox="0 0 8 8"
          refX="7"
          refY="4"
          markerWidth="7"
          markerHeight="7"
          orient="auto-start-reverse"
        >
          <path d="M0 0 L8 4 L0 8 z" className={MARKER} />
        </marker>
      </defs>

      {/* The app, drawn once, because both halves ask the same questions. */}
      <rect x="24" y="196" width="216" height="128" rx="8" className={BOX_CORE} />
      <text x="44" y="226" className={cn(MONO, BOLD)} fontSize="14">
        {intl.formatMessage(SERVICES_COPY.app)}
      </text>
      <text x="44" y="252" className={MONO} fontSize="12">
        packages/app-core
      </text>
      <text x="44" y="272" className={MONO} fontSize="12">
        apps/mobile
      </text>
      <text x="44" y="300" className={MUTED} fontSize="12">
        {intl.formatMessage(SERVICES_COPY.appRequests)}
      </text>

      {/* The door. Above the rest and on its own wire, because it is the
          only one whose answer decides whether the app renders at all. */}
      <rect x="612" y="28" width="344" height="112" rx="8" className={CHIP_PORT} />
      <text x="632" y="58" className={BOLD} fontSize="14">
        beabee
      </text>
      <text x="632" y="80" fontSize="12">
        {intl.formatMessage(SERVICES_COPY.beabeeRole)}
      </text>
      <text x="632" y="102" className={MUTED} fontSize="12">
        {intl.formatMessage(SERVICES_COPY.beabeeAnswer1)}
      </text>
      <text x="632" y="120" className={MUTED} fontSize="12">
        {intl.formatMessage(SERVICES_COPY.beabeeAnswer2)}
      </text>

      <path d="M240 232 C 420 232, 440 84, 612 84" className={WIRE} markerEnd="url(#d4-arrow)" />
      <text x="404" y="140" className={cn(MUTED, HALO)} fontSize="12">
        {intl.formatMessage(SERVICES_COPY.ask)}
      </text>
      <rect x="612" y="150" width="150" height="22" rx="11" className={NODE_STRUCK} />
      {/* Club yellow is the same colour in both schemes, so the label over it
          cannot inherit `fill-on-canvas`: in dark that is near-white on yellow.
          See `ON_ALTERNATIVE` in `shared.tsx` for the whole of it. */}
      <text x="628" y="162" className={ON_ALTERNATIVE} fontSize="11">
        {intl.formatMessage(SERVICES_COPY.simulated)}
      </text>
      <text x="774" y="162" className={MUTED} fontSize="11">
        services/auth.service.ts
      </text>

      {/* Content, in one band, because the app treats it all the same way. */}
      <line x1="300" y1="200" x2="956" y2="200" className={RULE} />
      <text x="300" y="188" className={cn(MUTED, BOLD)} fontSize="11">
        {intl.formatMessage(SERVICES_COPY.content)}
      </text>

      {ROWS.map((row) => (
        <g key={row.name}>
          <path
            d={`M240 260 C 300 260, 300 ${row.y}, 360 ${row.y}`}
            className={row.state === 'live' ? WIRE : ARC_INDEX}
            markerEnd="url(#d4-arrow)"
          />
          <circle
            cx="372"
            cy={row.y}
            r="4"
            className={row.state === 'live' ? NODE_INTACT : NODE_MOOT}
          />
          <text x="390" y={row.y} className={cn(MONO, BOLD)} fontSize="12">
            {row.name}
          </text>
          <text x="612" y={row.y} className={MUTED} fontSize="12">
            {intl.formatMessage(row.detail)}
          </text>
        </g>
      ))}

      {/* The legend, because two line weights and two node fills are two
          distinctions and neither is obvious from the drawing alone. */}
      <line x1="360" y1="524" x2="956" y2="524" className={RULE} />
      <circle cx="372" cy="548" r="4" className={NODE_INTACT} />
      <text x="390" y="548" fontSize="11">
        {intl.formatMessage(SERVICES_COPY.legendLive)}
      </text>
      <circle cx="612" cy="548" r="4" className={NODE_MOOT} />
      <text x="630" y="548" fontSize="11">
        {intl.formatMessage(SERVICES_COPY.legendSample)}
      </text>
    </svg>
  );
}

/**
 * The third drawing: the app, the identity system it asks about membership, and
 * the content sources it reads.
 */
export function Services({ alt = true }: { alt?: boolean }) {
  const intl = useWorkbenchIntl();

  return (
    <DiagramFigure
      number={3}
      alt={alt}
      drawing={<ServicesDrawing />}
      caption={
        <>
          <strong>{intl.formatMessage(SERVICES_COPY.captionLead)}</strong>{' '}
          {intl.formatMessage(SERVICES_COPY.caption, { code, board })}
        </>
      }
    >
      <p className="mt-xs">
        <strong>{intl.formatMessage(SERVICES_COPY.altBeabeeLead)}</strong>{' '}
        {intl.formatMessage(SERVICES_COPY.altBeabee, { code })}
      </p>
      <p className="mt-xs font-semibold">{intl.formatMessage(SERVICES_COPY.altLiveHeading)}</p>
      <ul className="mt-3xs list-disc pl-m">
        <li>{intl.formatMessage(SERVICES_COPY.altLiveWordpress, { code })}</li>
        <li>{intl.formatMessage(SERVICES_COPY.altLiveCastopod, { code })}</li>
        <li>{intl.formatMessage(SERVICES_COPY.altLiveIcecast, { code })}</li>
        <li>{intl.formatMessage(SERVICES_COPY.altLivePeertube, { code })}</li>
        <li>{intl.formatMessage(SERVICES_COPY.altLiveYouTube)}</li>
      </ul>
      <p className="mt-xs font-semibold">{intl.formatMessage(SERVICES_COPY.altSampleHeading)}</p>
      <ul className="mt-3xs list-disc pl-m">
        <li>{intl.formatMessage(SERVICES_COPY.altSampleFaktenforum)}</li>
        <li>{intl.formatMessage(SERVICES_COPY.altSampleAtlas)}</li>
        <li>{intl.formatMessage(SERVICES_COPY.altSampleCrowdnewsroom)}</li>
      </ul>
      <p className="mt-xs">{intl.formatMessage(SERVICES_COPY.altClosing)}</p>
    </DiagramFigure>
  );
}
