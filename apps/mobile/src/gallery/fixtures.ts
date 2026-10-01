/**
 * Specimen data for the component gallery.
 *
 * **Where the data is, and why this file is still here.** The awkward cases — an
 * article with no image, a title over three lines, one claim per status, one
 * field per form type — now live in `packages/app-core/src/data/samples/`, beside
 * the sample data they are variants of, and this file asks for them by name. That
 * move is what lets the workbench's component page and a screen reach the same
 * specimen: while the edge cases were written out here, ADR 0040's one-way
 * dependency said the other two could not have them at all.
 *
 * Two models still have no offline constant that a component may import
 * (`__tests__/web-target.test.ts` keeps the bundled snapshots behind the platform
 * adapter, and this file is not it) — the articles and the video, which are
 * therefore variants in the core's `articles` and `videos` domains rather than
 * constants here.
 *
 * What is left here is what is not a domain's data: a document for the reader to
 * frame, a foreign embed address, and a minified stack trace. A component's own
 * props, drawn once, are not sample data — naming them here would put three
 * strings in the core that no source will ever answer.
 *
 * The specimens deliberately include the awkward cases. A gallery of
 * well-behaved data hides exactly the layout faults it exists to show.
 */
import { articleSamples } from '@correctiv/app-core/data/samples/articles';
import { calloutFieldSamples } from '@correctiv/app-core/data/samples/callout-fields';
import { calloutSamples } from '@correctiv/app-core/data/samples/callouts';
import { claimSamples } from '@correctiv/app-core/data/samples/claims';
import { podcastSamples } from '@correctiv/app-core/data/samples/podcasts';
import { videoSamples } from '@correctiv/app-core/data/samples/videos';
import { projectGroups } from '@correctiv/app-core/data/projects';
import { searchSamples } from '@correctiv/app-core/data/search-samples';

/** A lead article, with everything a hero can show. */
export const ARTICLE = articleSamples.of('lead');

/** The same model with the two optional fields missing, which is the common case. */
export const ARTICLE_BARE = articleSamples.of('no-image');

/**
 * Three fact checks for the rail, one per verdict the design shows, and the long
 * title that runs over the lines a card gives it.
 *
 * Assembled from names rather than held as one array, which is the change the
 * move into the core was for: the rail is a screen's choice about which
 * specimens it shows, and it is now written in the gallery where a reader can see
 * it rather than implied by the order of an array in here.
 */
export const FACTCHECKS = (['factcheck-verdict', 'factcheck-number', 'long-title'] as const).map(
  (name) => articleSamples.of(name),
);

/** A PeerTube video, which is what the media library draws. */
export const VIDEO = videoSamples.of('peertube');

export const PROJECT = projectGroups[0].projects[0];
export const SERIES = podcastSamples.of('default');
export const CROWDNEWSROOM = calloutSamples.of('open');
export const SURVEY = calloutSamples.of('survey');

/** One hit per `SearchSample['kind']`, so every icon in the row is exercised. */
export const SAMPLE_HITS = (['podcast', 'callout', 'backstage', 'verlag', 'projekt'] as const)
  .map((kind) => searchSamples.find((s) => s.kind === kind))
  .filter((s): s is (typeof searchSamples)[number] => s !== undefined);

/** One claim per status, which is the row the Faktenforum shows for each. */
export const CLAIMS = (['submitted', 'checking', 'checked'] as const).map((name) =>
  claimSamples.of(name),
);

/** One field per component type the form schema allows. */
export const FORM_FIELDS = calloutFieldSamples.variants.map((variant) => variant.data);

/**
 * A self-contained article document for `ReaderView`.
 *
 * The real one carries the token CSS and the embedded fonts and runs to hundreds
 * of kilobytes; this is short on purpose, because what the gallery shows about
 * this component is the frame around the document, not the document.
 */
export const READER_HTML = [
  '<!doctype html><html lang="de"><head><meta charset="utf-8">',
  '<meta name="viewport" content="width=device-width, initial-scale=1">',
  '<style>body{margin:0;padding:16px;font:16px/1.5 -apple-system,sans-serif;',
  'background:var(--var-color-canvas,#fff);color:var(--var-color-on-canvas,#333)}',
  'h1{font-size:22px;line-height:1.2}a{color:var(--var-color-accent,#ff5064)}</style>',
  '</head><body><h1>Ein kurzes Dokument</h1>',
  '<p>Der Reader rendert ein vollständiges HTML-Dokument. Hier steht ein kurzer,',
  ' damit die Galerie den Rahmen zeigt und nicht den Text.</p>',
  '<p><a href="https://correctiv.org/">Ein Link</a>, den <code>onNavigate</code> abfängt.</p>',
  '</body></html>',
].join('');

/** A YouTube embed for `VideoFrame`, in the shape `app/video.tsx` builds. */
export const EMBED_URI = 'https://www.youtube-nocookie.com/embed/aqz-KE-bpKQ?playsinline=1&rel=0';

/**
 * A technical message with no line breaks and no short words, which is what a
 * minified stack actually looks like. The recovery screen caps it at four lines so
 * the retry control cannot be pushed off the top, and this is the specimen that
 * shows the cap doing something.
 */
export const LONG_ERROR =
  "TypeError: Cannot read properties of undefined (reading 'entitlement') at useIsAdmitted (session.ts:118:24) at AppShell (_layout.tsx:241:19) at renderWithHooks (react-dom.production.min.js:4312:16)";
