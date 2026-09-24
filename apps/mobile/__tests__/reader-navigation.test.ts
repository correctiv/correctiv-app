import {
  allowsFrameLoad,
  classifyReaderLink,
  readerClickAction,
  resolveReaderLink,
  shouldStartReaderLoad,
} from '@/lib/articles/readerNavigation';

/**
 * The reader's link routing, which used to be eleven inline lines in `artikel.tsx`
 * with no test at all — the only pure rule in that screen, and the one that decides
 * whether tapping a citation keeps you in the app or throws you out of it.
 *
 * `isInternalArticleUrl` has its own suite in the core, where the rule itself now
 * lives (`packages/app-core/test/article-url.test.ts`); what is pinned here is the
 * dispatch around it, and especially the two branches that are not about articles:
 * the document's own machinery must never be intercepted, and an unrecognised
 * scheme must never be forced through the system browser.
 */
describe('classifyReaderLink', () => {
  it.each(['about:blank', 'data:image/png;base64,iVBORw0KGgo=', 'file:///android_asset/x.html'])(
    'lets the document load %s itself',
    (target) => {
      expect(classifyReaderLink(target)).toBe('allow');
    },
  );

  it.each([
    'https://correctiv.org/faktencheck/2026/08/04/video-zeigt-feiernde-fussballfans/',
    'https://correctiv.org/spotlight-newsletter/helfen-sanktionen/',
  ])('opens %s in another reader', (target) => {
    expect(classifyReaderLink(target)).toBe('internal');
  });

  it.each([
    'https://example.org/eine-quelle/',
    'https://correctiv.org/thema/aktuelles/', // internal host, but a listing page
    'http://correctiv.org/faktencheck/2026/08/04/etwas/', // no TLS
    'https://salon5.correctiv.net/podcast/pausenbrot/',
  ])('sends %s out of the app', (target) => {
    expect(classifyReaderLink(target)).toBe('external');
  });

  it.each(['mailto:redaktion@correctiv.org', 'tel:+493040549680', 'correctiv://join'])(
    'leaves %s to the webview rather than guessing',
    (target) => {
      expect(classifyReaderLink(target)).toBe('allow');
    },
  );
});

/**
 * What a frame inside the article may load without asking, which on iOS is every
 * load an embed makes (ADR 0065 §4). A web scheme, and nothing the operating system
 * would act on: an embed publishes what anybody on its platform wrote, so a nested
 * frame must not be able to hand the phone a call, a store page or the app's own
 * scheme without a tap.
 */
describe('allowsFrameLoad', () => {
  it.each([
    'https://datawrapper.dwcdn.net/YBoom/7/',
    'https://flo.uri.sh/story/3759922/embed',
    'about:blank',
    'about:srcdoc',
    'data:text/html,<p>x</p>',
    'blob:https://flo.uri.sh/5d4c',
    'HTTPS://DATAWRAPPER.DWCDN.NET/x',
  ])('lets a frame load %s', (target) => {
    expect(allowsFrameLoad(target)).toBe(true);
  });

  it.each([
    'tel:+493040549680',
    'mailto:redaktion@correctiv.org',
    'itms-apps://apps.apple.com/app/id1',
    'correctiv://join',
    'intent://x#Intent;end',
    'javascript:alert(1)',
    'http://datawrapper.dwcdn.net/x',
    'file:///etc/hosts',
    ' https://x.example/',
  ])('refuses a frame %s', (target) => {
    expect(allowsFrameLoad(target)).toBe(false);
  });
});

/**
 * What a click inside the web reader does (ADR 0065 §7). The rule is that no tap
 * navigates the reader frame itself: a link is routed through `onNavigate`, or the
 * click is cancelled. The frame shares the app's origin, so a page it navigated to
 * on that origin would have the app's storage, and the re-check of 2026-09-24 did
 * exactly that through an `<area>` and an SVG link the old handler did not see.
 */
describe('readerClickAction', () => {
  const BASE = 'https://correctiv.org/';

  function run(href: string | null, answer: boolean) {
    const seen: string[] = [];
    const action = readerClickAction(href, BASE, (url) => {
      seen.push(url);
      return answer;
    });
    return { action, seen };
  }

  it('routes a link, and cancels the click the router took', () => {
    expect(run('/faktencheck/2026/08/04/x/', false)).toEqual({
      action: 'prevent',
      seen: ['https://correctiv.org/faktencheck/2026/08/04/x/'],
    });
  });

  it('cancels a link the router hands back unless the system takes it', () => {
    expect(run('mailto:redaktion@correctiv.org', true).action).toBe('let-through');
    expect(run('tel:+493040549680', true).action).toBe('let-through');
    expect(run('data:text/html,x', true).action).toBe('prevent');
    expect(run('about:blank', true).action).toBe('prevent');
    expect(run('javascript:alert(1)', true).action).toBe('prevent');
  });

  it('cancels a link with no address it can read', () => {
    expect(run(null, true)).toEqual({ action: 'prevent', seen: [] });
    expect(run('', true)).toEqual({ action: 'prevent', seen: [] });
  });
});

/**
 * The address `ReaderView.web.tsx` opens from the parent window for a
 * `'let-through'` result (issue #274): the frame's own attempt at a `mailto:` or
 * `tel:` link is silently discarded by its sandbox — Chrome logs "Navigation to
 * external protocol blocked by sandbox" and nothing happens — so the click is
 * cancelled and this address is opened from outside the frame instead, where no
 * sandbox applies.
 */
describe('resolveReaderLink', () => {
  const BASE = 'https://correctiv.org/';

  it('resolves a mailto: address, unchanged', () => {
    expect(resolveReaderLink('mailto:redaktion@correctiv.org', BASE)).toBe(
      'mailto:redaktion@correctiv.org',
    );
  });

  it('resolves a tel: address, unchanged', () => {
    expect(resolveReaderLink('tel:+493040549680', BASE)).toBe('tel:+493040549680');
  });

  it('resolves the same way readerClickAction does internally, base included', () => {
    expect(resolveReaderLink('/faktencheck/2026/08/04/x/', BASE)).toBe(
      'https://correctiv.org/faktencheck/2026/08/04/x/',
    );
  });
});

/**
 * What the native reader does with a top-frame load (issue #271). Android's
 * WebView cannot load a `mailto:` itself and replaced the article with its own
 * error page, so the two schemes the system handles go to it instead, and the
 * WebView is told not to load them.
 */
describe('shouldStartReaderLoad', () => {
  function run(target: string, answer: boolean) {
    const routed: string[] = [];
    const handedOff: string[] = [];
    const load = shouldStartReaderLoad(
      target,
      (url) => {
        routed.push(url);
        return answer;
      },
      (url) => handedOff.push(url),
    );
    return { load, routed, handedOff };
  }

  it('hands mailto: and tel: to the system and keeps the article', () => {
    expect(run('mailto:redaktion@correctiv.org', true)).toEqual({
      load: false,
      routed: ['mailto:redaktion@correctiv.org'],
      handedOff: ['mailto:redaktion@correctiv.org'],
    });
    expect(run('TEL:+493040549680', true)).toMatchObject({
      load: false,
      handedOff: ['TEL:+493040549680'],
    });
  });

  it('lets the document load what the router lets through', () => {
    expect(run('about:blank', true)).toEqual({
      load: true,
      routed: ['about:blank'],
      handedOff: [],
    });
    expect(run('data:image/png;base64,iVBORw0KGgo=', true).load).toBe(true);
  });

  it('loads nothing the router took, and hands nothing off', () => {
    expect(run('https://example.org/', false)).toEqual({
      load: false,
      routed: ['https://example.org/'],
      handedOff: [],
    });
  });

  it('hands off a mailto: link the real router lets through', () => {
    const handedOff: string[] = [];
    const route = (url: string) => classifyReaderLink(url) === 'allow';
    expect(shouldStartReaderLoad('mailto:a@b.de', route, (url) => handedOff.push(url))).toBe(false);
    expect(handedOff).toEqual(['mailto:a@b.de']);
  });
});
