import { cn } from '../lib/cn';
import {
  ArrowMarker,
  BOLD,
  BOX_CORE,
  CHIP,
  CHIP_PORT,
  DiagramFigure,
  DRAWING,
  HALO,
  MONO,
  MUTED,
  RULE,
  T11,
  T12,
  T13,
  T16,
  WIRE,
} from './shared';

/**
 * The five rungs, in the order `articles/load.ts` tries them.
 *
 * Exported because a label written as `{rung.call}` is a JSX expression, and the
 * reading in `test/drawn.ts` deliberately cannot see one: it reads the file, not
 * the render. So the array is what the check reads, which is the stronger of the
 * two readings — an order is a list here and a guess in extracted text.
 */
export const RUNGS = [
  {
    y: 156,
    call: 'platform().content.article(url)',
    note: 'the snapshot compiled into the app. No network, and no change until a release.',
    aside: null,
    timeout: null,
  },
  {
    y: 214,
    call: "getCached('articles', url, 24 h)",
    note: 'an article extracted earlier today, still inside its window.',
    aside: null,
    timeout: null,
  },
  {
    y: 272,
    call: 'fetchWpArticle(url)',
    note: 'the REST API: one request, everything, the fact-check verdict included.',
    aside: 'correctiv.org',
    timeout: '6 s',
  },
  {
    y: 330,
    call: 'fetchText(url) then extract(html)',
    note: 'the page itself, for a URL the API does not know. Every page that is not a post.',
    aside: 'correctiv.org',
    timeout: '12 s',
  },
  {
    y: 388,
    call: "getStale('articles', url)",
    note: 'expired beats absent. A miss here is the only way this throws.',
    aside: null,
    timeout: null,
  },
];

/**
 * The drawing on its own, with no description attached by default.
 *
 * `alt` is off here and on in the figure: the description it names lives in the
 * figure, so a drawing rendered alone would point at an element that is not on
 * the page.
 */
export function ArticlePathDrawing({ alt = false }: { alt?: boolean } = {}) {
  return (
    <svg
      viewBox="0 0 1100 856"
      className={cn(DRAWING, 'block h-[856px] w-[1100px] max-w-none')}
      aria-labelledby="d6-title"
      aria-describedby={alt ? 'd6-alt' : undefined}
    >
      <title id="d6-title">
        Where an article comes from: five rungs tried in order, the bundle compiled into the app and
        the bounded cache they read, and the one document a WebView is handed at the end
      </title>
      <defs>
        <ArrowMarker id="d6-arrow" />
      </defs>

      <rect x="60" y="24" width="200" height="36" rx="6" className={CHIP} />
      <text x="76" y="44" className={T13}>
        a tap on a card
      </text>
      <line x1="160" y1="62" x2="160" y2="78" className={WIRE} markerEnd="url(#d6-arrow)" />

      <rect x="40" y="84" width="620" height="436" rx="8" className={BOX_CORE} />
      <text x="60" y="112" className={cn(MONO, BOLD, T16)}>
        loadArticle(url)
      </text>
      <text x="640" y="112" textAnchor="end" className={cn(MONO, MUTED, T12)}>
        articles/load.ts
      </text>
      <text x="60" y="136" className={cn(T11, MUTED)}>
        Five rungs, tried in this order. The first that answers is the answer.
      </text>

      {RUNGS.map((rung, i) => (
        <g key={rung.call}>
          <rect x="60" y={rung.y} width="580" height="46" rx="6" className={CHIP} />
          <text x="84" y={rung.y + 23} textAnchor="middle" className={cn(BOLD, T13)}>
            {i + 1}
          </text>
          <text x="106" y={rung.y + 16} className={cn(MONO, T12)}>
            {rung.call}
          </text>
          <text x="106" y={rung.y + 34} className={cn(T11, MUTED)}>
            {rung.note}
          </text>
          {rung.aside && (
            <text x="624" y={rung.y + 16} textAnchor="end" className={cn(MONO, T11)}>
              {rung.aside}
            </text>
          )}
          {rung.timeout && (
            <text x="624" y={rung.y + 34} textAnchor="end" className={cn(T11, MUTED)}>
              {rung.timeout}
            </text>
          )}
        </g>
      ))}

      <text x="60" y="462" className={T11}>
        Rungs 3 and 4 write what they produced back into the cache, and only the article:
      </text>
      <text x="60" y="482" className={T11}>
        never the page HTML, which is ten times the bytes and a second extraction.
      </text>
      <text x="60" y="504" className={cn(T11, MUTED)}>
        Both network rungs can time out in turn, which is why the first one gets the shorter budget.
      </text>

      {/* The port first, because rung 1 calls the port and the port reads the file. */}
      <line x1="642" y1="179" x2="684" y2="179" className={WIRE} markerEnd="url(#d6-arrow)" />

      <rect x="690" y="84" width="370" height="150" rx="6" className={CHIP_PORT} />
      <text x="706" y="108" className={cn(MONO, BOLD, T13)}>
        ContentBundle
      </text>
      <text x="706" y="130" className={T11}>
        the port rung 1 calls. Four methods:
      </text>
      <text x="706" y="150" className={cn(MONO, T11)}>
        feed, article, image, podcastSeries
      </text>
      <text x="706" y="176" className={cn(T11, MUTED)}>
        <tspan className={MONO}>createEmptyContentBundle()</tspan> answers null
      </text>
      <text x="706" y="194" className={cn(T11, MUTED)}>
        to all four and is what the in-memory platform
      </text>
      <text x="706" y="212" className={cn(T11, MUTED)}>
        takes, so elsewhere rung 1 falls straight through.
      </text>

      <line x1="875" y1="236" x2="875" y2="245" className={WIRE} markerEnd="url(#d6-arrow)" />

      <rect x="690" y="248" width="370" height="204" rx="6" className={CHIP} />
      <text x="706" y="272" className={cn(BOLD, T13)}>
        The bundle: what shipped inside the app
      </text>
      <text x="706" y="294" className={T11}>
        Generated TypeScript modules, committed to the
      </text>
      <text x="706" y="312" className={T11}>
        repository and compiled in. Answered by the one
      </text>
      <text x="706" y="330" className={T11}>
        real implementation, <tspan className={MONO}>lib/platform/expo.ts</tspan>.
      </text>
      <line x1="706" y1="344" x2="1044" y2="344" className={RULE} />
      <text x="706" y="362" className={cn(MONO, T11)}>
        OFFLINE_ARTICLES
      </text>
      <text x="904" y="362" className={T11}>
        15 articles
      </text>
      <text x="706" y="380" className={cn(MONO, T11)}>
        OFFLINE_COVERS
      </text>
      <text x="904" y="380" className={T11}>
        15 cover images
      </text>
      <text x="706" y="398" className={cn(MONO, T11)}>
        OFFLINE_FEEDS
      </text>
      <text x="904" y="398" className={T11}>
        6 feed snapshots
      </text>
      <text x="706" y="416" className={cn(MONO, T11)}>
        OFFLINE_PODCASTS
      </text>
      <text x="904" y="416" className={T11}>
        7 podcast shows
      </text>
      <text x="706" y="436" className={cn(T11, MUTED)}>
        written by <tspan className={MONO}>apps/mobile/scripts/fetch-offline-*.mts</tspan>
      </text>

      {/*
        Rungs 2 and 5 read the cache and rungs 3 and 4 write it, and the only thing
        telling those apart is which end the arrowhead is on. The write was a dashed
        line, borrowed from a role the decisions chain has since taken with it; but
        dashed means absent or inferred everywhere else in this vocabulary, so the
        one arc that is as real as the others was the one drawn as in doubt.
        Direction says it with nothing added, and it is the truer statement anyway:
        a read comes back OUT of the cache.
      */}
      <path d="M684 510 C 664 510, 664 237, 642 237" className={WIRE} markerEnd="url(#d6-arrow)" />
      <path d="M684 566 C 664 566, 664 411, 642 411" className={WIRE} markerEnd="url(#d6-arrow)" />
      <path d="M642 324 C 678 324, 678 620, 684 620" className={WIRE} markerEnd="url(#d6-arrow)" />
      <text x="634" y="550" textAnchor="end" className={cn(MONO, T11, MUTED, HALO)}>
        setCached, from rungs 3 and 4
      </text>

      <rect x="690" y="476" width="370" height="184" rx="6" className={CHIP} />
      <text x="706" y="500" className={cn(BOLD, T13)}>
        The cache: two layers, three bounds
      </text>
      <text x="706" y="522" className={T11}>
        A session map over the <tspan className={MONO}>BlobStore</tspan> port, which
      </text>
      <text x="706" y="540" className={T11}>
        holds nothing else, so an eviction here can
      </text>
      <text x="706" y="558" className={T11}>
        never reach a saved article or a setting.
      </text>
      <line x1="706" y1="572" x2="1044" y2="572" className={RULE} />
      <text x="706" y="590" className={cn(MONO, T11)}>
        768 KiB
      </text>
      <text x="820" y="590" className={T11}>
        per entry, or it is refused
      </text>
      <text x="706" y="608" className={cn(MONO, T11)}>
        2 MiB
      </text>
      <text x="820" y="608" className={T11}>
        in total
      </text>
      <text x="706" y="626" className={cn(MONO, T11)}>
        128 entries
      </text>
      <text x="820" y="626" className={T11}>
        and the oldest read goes first
      </text>
      <text x="706" y="646" className={cn(T11, MUTED)}>
        <tspan className={MONO}>services/cache.service.ts</tspan>
      </text>

      <line x1="350" y1="522" x2="350" y2="576" className={WIRE} markerEnd="url(#d6-arrow)" />

      <rect x="40" y="580" width="620" height="126" rx="8" className={CHIP} />
      <text x="60" y="606" className={cn(MONO, BOLD, T13)}>
        buildReaderHtml(article, copy, options)
      </text>
      <text x="640" y="606" textAnchor="end" className={cn(MONO, MUTED, T12)}>
        articles/reader-html.ts
      </text>
      <text x="60" y="632" className={T11}>
        One string, and the core owns it: the structure, the class names, the byline
      </text>
      <text x="60" y="650" className={T11}>
        and the verdict plaque. It owns neither the words nor the colours: a WebView
      </text>
      <text x="60" y="668" className={T11}>
        reaches no provider, so both arrive as parameters, the copy required and the
      </text>
      <text x="60" y="686" className={T11}>
        CSS through the third.
      </text>

      <line x1="350" y1="708" x2="350" y2="726" className={WIRE} markerEnd="url(#d6-arrow)" />

      <rect x="40" y="730" width="620" height="110" rx="8" className={CHIP} />
      <text x="60" y="756" className={cn(MONO, BOLD, T13)}>
        ReaderView
      </text>
      <text x="640" y="756" textAnchor="end" className={cn(MONO, MUTED, T12)}>
        components/reader/
      </text>
      <text x="60" y="782" className={T11}>
        A WebView on iOS and Android; on the web target an iframe holding the same
      </text>
      <text x="60" y="800" className={T11}>
        string in <tspan className={MONO}>srcDoc</tspan>, because the WebView package has no web
        build and
      </text>
      <text x="60" y="818" className={T11}>
        renders a sentence in red instead of failing.
      </text>

      {/*
        The one arrow that runs right to left, because the box it comes from IS the
        third parameter. Without it the host's CSS sits beside the drawing with
        nothing saying how it reaches the document.
      */}
      <path d="M688 706 C 672 706, 672 668, 662 668" className={WIRE} markerEnd="url(#d6-arrow)" />

      <rect x="690" y="684" width="370" height="146" rx="6" className={CHIP} />
      <text x="706" y="708" className={cn(BOLD, T13)}>
        What the host puts into the document
      </text>
      <text x="706" y="730" className={cn(MONO, T11, MUTED)}>
        apps/mobile/src/lib/articles/reader.ts
      </text>
      {/*
        "two families" and "four faces" each sit whole on one line, which is not a
        typesetting preference: `drawnText` joins the text nodes with a separator,
        so a phrase broken across two of them is invisible to the check that holds
        these two counts to the generated stylesheet. A line break is free and
        weakening the reading is not.
      */}
      <text x="706" y="756" className={T11}>
        The token variables, so every colour in the layout is
      </text>
      <text x="706" y="774" className={T11}>
        one the app already uses; the fonts, two families in
      </text>
      <text x="706" y="792" className={T11}>
        four faces, base64 inline, because this is a browser
      </text>
      <text x="706" y="810" className={T11}>
        context of its own; and in dark mode one more block.
      </text>
    </svg>
  );
}

/**
 * The sixth drawing: where an article comes from.
 *
 * `ARCHITECTURE.md` has the same cascade as ASCII and keeps it, because in an
 * editor and on GitHub that is the only picture there is. This one adds the two
 * things the ASCII cannot hold: where the bundle comes from and what bounds the
 * cache.
 */
export function ArticlePath({ alt = true }: { alt?: boolean }) {
  return (
    <DiagramFigure
      number={6}
      altId="d6-alt"
      alt={alt}
      drawing={<ArticlePathDrawing alt={alt} />}
      caption={
        <>
          <strong>Five rungs, and the first that answers is the answer.</strong> The bundle comes
          first because that is the promise the demo makes: the reader opens with no Wi-Fi. It is
          generated TypeScript committed to the repository, reached through the{' '}
          <code>ContentBundle</code> port, and on any host without one{' '}
          <code>createEmptyContentBundle()</code> answers null to every method, so rung 1 falls
          straight through. The cache behind rungs 2 and 5 is bounded three ways, and it writes only
          through the <code>BlobStore</code> port, which is what makes an eviction unable to reach a
          saved article. A byte here is a UTF-16 code unit, which is what the code measures and
          about half a percent under the same text in UTF-8.
        </>
      }
    >
      <dl>
        <dt>
          The cascade, <code>packages/app-core/src/articles/load.ts</code>
        </dt>
        <dd>
          <ol>
            <li>
              <code>platform().content.article(url)</code> — the snapshot compiled into the app. No
              network, and no change until the next release.
            </li>
            <li>
              <code>getCached(&apos;articles&apos;, url, 24 h)</code> — an article extracted earlier
              today, still inside its window.
            </li>
            <li>
              <code>fetchWpArticle(url)</code> — correctiv.org&apos;s WordPress REST API, with a 6 s
              budget. One request, everything, the fact-check verdict included.
            </li>
            <li>
              <code>fetchText(url)</code> then <code>extract(html)</code> — the page itself, 12 s,
              for a URL the API does not know. That is every page in the app which is not a post.
            </li>
            <li>
              <code>getStale(&apos;articles&apos;, url)</code> — expired beats absent. A miss here
              is the only way this throws.
            </li>
          </ol>
          Rungs 3 and 4 write what they produced back, and only the extracted article, never the
          page HTML. The network rungs can time out one after the other, so the first gets the
          shorter budget.
        </dd>
        <dt>The bundle, and the port in front of it</dt>
        <dd>
          <code>ContentBundle</code> has four methods: <code>feed</code>, <code>article</code>,{' '}
          <code>image</code> and <code>podcastSeries</code>.{' '}
          <code>apps/mobile/src/lib/platform/expo.ts</code> is the only real implementation, and it
          is four record lookups into generated TypeScript modules that are committed to the
          repository and compiled into the app: 15 pre-extracted articles, 15 cover images as data
          URIs, 6 feed snapshots and 7 podcast shows. They are written by{' '}
          <code>apps/mobile/scripts/fetch-offline-articles.mts</code> and{' '}
          <code>apps/mobile/scripts/fetch-offline-podcasts.mts</code>.{' '}
          <code>createEmptyContentBundle()</code> answers null to all four and is what the in-memory
          platform uses, so on any other host the first rung falls straight through.
        </dd>
        <dt>
          The cache, <code>packages/app-core/src/services/cache.service.ts</code>
        </dt>
        <dd>
          Two layers: a session map over the host&apos;s <code>BlobStore</code> port. Three bounds,
          and a least-recently-used order between them: 768 KiB per entry, above which an entry is
          refused rather than evicted; 2 MiB in total; 128 entries. An eviction drops the session
          entry and asks the host to delete the blob, because dropping one of the two leaves the
          other growing unwatched. It writes through the blob port and never the key-value one,
          which is what keeps a saved article and a setting out of reach of the bound. The unit is a
          UTF-16 code unit, not a byte.
        </dd>
        <dt>The document</dt>
        <dd>
          <code>buildReaderHtml(article, copy, options)</code> builds one string and the core owns
          it: the structure, the class names, the byline and the verdict plaque. It owns neither the
          words nor the colours — a document built for a WebView can reach no provider and inherits
          no stylesheet — so the copy is a required second parameter the host formats and the
          host&apos;s CSS arrives through the third, whose `css` is optional and whose `locale` is
          not.
        </dd>
        <dt>What the host adds</dt>
        <dd>
          <code>apps/mobile/src/lib/articles/reader.ts</code> supplies the CSS: the token variables,
          so every colour in the layout is one the app already uses; two font families in four
          faces, base64 inline, because the WebView is a browser context of its own and cannot use
          the fonts React Native loaded; and in dark mode one more block of variables, which is the
          whole cost of the dark reader.
        </dd>
        <dt>The view</dt>
        <dd>
          <code>ReaderView</code> is a WebView on iOS and Android and an iframe with{' '}
          <code>srcDoc</code> on the web target, because the WebView package has no web build and
          renders a sentence in red rather than failing.
        </dd>
      </dl>
    </DiagramFigure>
  );
}
