import { router } from 'expo-router';

import { isInternalArticleUrl } from '@correctiv/app-core/articles/url';

import { openExternal } from '@/lib/openExternal';

/**
 * Opens a link the data handed us, in the app if it is one of ours and in the
 * system browser if it is not.
 *
 * The one entry point for a URL whose destination is not fixed at the call site: a
 * Spotlight issue, a claim's source, a project's address. Each of those was an
 * `openExternal(url)` until a Spotlight tap on the web opened a new browser tab for
 * a page the reader can show. Asking `isInternalArticleUrl` is the caller's job
 * only as long as nobody forgets it, so the question moved here, and
 * `open-link-callers.test.ts` fails a file that imports `openExternal` without a
 * reason.
 */
export function openLink(url: string): void {
  if (isInternalArticleUrl(url)) {
    router.push({ pathname: '/artikel', params: { url } });
    return;
  }
  openExternal(url);
}
