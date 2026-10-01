// This host's half of `@correctiv/app-core`'s platform ports, assembled.
//
// `ARCHITECTURE.md` puts the whole cost of adding a host at one file implementing
// four interfaces, and ADR 0007 says that estimate stopped being theoretical when the
// NativeScript host was removed. This is the third host, and the estimate held: the
// files under this directory plus `../audio/backend.ts` are the entire platform
// surface, and none of the core moved to make room for them.
//
// Split the same way the Expo host splits it: storage and bundled content here, the
// audio backend added at the boot site, so that reasoning about where state is stored
// does not drag in a media framework and these three stay testable without one.

import type { CorePlatform, ErrorReporter } from '@correctiv/app-core';

import { content } from './content.js';
import { blobs, keyValue } from './storage.js';

/**
 * Where a fault goes on this host, which is the same place the phone sends it: one
 * line in the log ([ADR 0032](../../../../adr/0032-a-port-for-the-error-report-before-a-provider-for-it.md)).
 *
 * Deliberately not an Adwaita dialog. The port's contract is that a report must not
 * change what the caller does next, and a window appearing over the app is the
 * loudest possible breach of that. What this host could add that the phone cannot is
 * the journal, and `console.error` already reaches it: a GJS process started from a
 * `.desktop` file has its stderr captured by the session, so `journalctl --user` is
 * where a packaged run's reports actually land. That is a property of the host rather
 * than of this function, so there is nothing to write here to get it.
 */
const errors: ErrorReporter = {
  report({ domain, code, context, cause }) {
    console.error(`[${domain}] ${code}`, context ?? {}, cause);
  },
};

export const gtkPlatform: CorePlatform = { keyValue, blobs, content, errors };
