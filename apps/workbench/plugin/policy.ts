import type { Plugin } from 'vite';

/**
 * The Content-Security-Policy the published site carries, one directive per line.
 *
 * **Why the site needs one although nobody can type into it.** Every document is
 * this repository's own Markdown, rendered at build time and put into the page as
 * HTML. A change to a document is reviewed by people reading prose, and an
 * `onerror` in a `.md` file is exactly what a prose review reads past. The address
 * makes it worth closing: `correctiv.github.io` is one origin shared with every
 * other Pages site of the organisation, so a script that ran here would run on a
 * CORRECTIV address, next to the storage of all of them. The site holds no
 * credential, so this is about defacement and phishing, not about a secret.
 *
 * **`script-src 'self'` is the directive that carries the protection**, and the
 * only one this file would refuse to widen. It admits the bundle Vite writes
 * under `assets/` and nothing else: no inline `<script>`, no `on…=` attribute,
 * no `javascript:` URL, no `eval`, whatever a document manages to contain. A
 * `srcdoc` frame inherits the policy, so the reader document the app draws here
 * cannot run script either. `test/rendered-html.test.ts` is the second half: it
 * fails on script-bearing HTML in what the site renders, before it is built.
 *
 * **The broad ones, and why each is acceptable.**
 *
 *  - `style-src 'unsafe-inline'`. The site draws the app's own components in the
 *    page (`src/components/AppHost.tsx`), and react-native-web writes their
 *    styles as `<style>` elements at runtime. A style cannot run script; the most
 *    an injected one can do is make the page look wrong, which the review of a
 *    rendered page does catch.
 *  - `img-src https:`, `media-src https:` and `connect-src https:`. The drawn
 *    components show and fetch what the app does: covers from correctiv.org and
 *    its CDNs, PeerTube, the podcast and radio hosts. The list of content hosts
 *    is the content's, not this file's, and a host missing from it would be a
 *    blank card nobody traces back here. None of the three can execute anything.
 *  - `frame-src 'self' https:`. `'self'` is the device frame at `/app/`, which
 *    has to be this origin for the inspector to reach into it (AGENTS.md). The
 *    rest is the video embed the app's `VideoFrame` draws, which lives on
 *    whichever host the content names. A cross-origin frame cannot touch this
 *    page, and the one frame that would share it, `srcdoc`, inherits this policy.
 *
 * **What a `<meta>` cannot do.** GitHub Pages sends no header this repository
 * controls, so the policy is in the document, and three directives are ignored
 * there by specification: `frame-ancestors`, `report-uri` and `sandbox`. So this
 * site can still be framed by another page, and a violation is reported only to
 * the console of whoever sees it. Neither is written below, because a directive
 * the browser ignores reads as protection it is not.
 */
export const CONTENT_SECURITY_POLICY: readonly string[] = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "media-src 'self' blob: https:",
  "connect-src 'self' https:",
  "frame-src 'self' https:",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
];

/** The policy as one attribute value. */
export function policyText(): string {
  return CONTENT_SECURITY_POLICY.join('; ');
}

/** Where the policy goes: directly after the charset, before anything it governs. */
const CHARSET = /<meta charset="utf-8"\s*\/?>/i;

/**
 * Writes the policy into `index.html` for the production build, and only there.
 *
 * Not in development, and that is not a relaxation that matters: Vite's dev server
 * injects an inline module preamble for React Refresh and `script-src 'self'`
 * refuses it, so the page would not mount. The dev server is a person's own
 * machine; the policy is for the address other people are sent.
 *
 * `404.html` is `index.html` copied after the build (`package.json`), which is
 * what Pages serves for every deep route, so both carry it. Placed as a string
 * rather than as a Vite tag with `head-prepend`, because a policy only governs
 * what comes after it and the charset has to stay in the first bytes of the file.
 * An `index.html` without the charset line fails the build rather than shipping
 * without a policy.
 */
export function contentSecurityPolicy(): Plugin {
  return {
    name: 'workbench-content-security-policy',
    apply: 'build',
    transformIndexHtml(html) {
      if (!CHARSET.test(html)) {
        throw new Error(
          'apps/workbench/index.html has no <meta charset="utf-8" />, which is where the Content-Security-Policy is placed.',
        );
      }
      const meta = `<meta http-equiv="Content-Security-Policy" content="${policyText()}" />`;
      return html.replace(CHARSET, (charset) => `${charset}\n    ${meta}`);
    },
  };
}
