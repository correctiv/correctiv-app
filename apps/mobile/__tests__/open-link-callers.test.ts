import { readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

import { filesUnder, withoutComments } from '@correctiv/prose-and-code';

const SRC = resolve(__dirname, '../src');

/**
 * Who may call `openExternal` directly, and why that is safe for each.
 *
 * A URL that can be a correctiv.org article belongs in `openLink`, which asks the
 * core's `isInternalArticleUrl` and keeps the app's own pages in the app. A Spotlight
 * issue, a claim's source and a project's address all went to the browser because
 * the call site forgot to ask. What may still import `openExternal` is a file whose
 * every target is fixed and outside the app by design: a handoff to another app, a
 * host that is not correctiv.org, or a one-segment page of it (`/impressum/`,
 * `/unterstuetzen/`), which `isInternalArticleUrl` also sends out.
 *
 * Adding a file here is the review point: say why none of its targets can be an
 * article.
 */
const ALLOWED: Record<string, string> = {
  'lib/openLink.ts': 'the dispatch itself',
  'app/artikel.tsx':
    'the reader has classified the target already, and "im Browser öffnen" is explicit',
  'components/reader/ReaderView.tsx': 'hands mailto: and tel: to the system',
  'components/gate/LoginGate.tsx': 'correctiv.org/unterstuetzen/, one segment',
  'lib/home/modules.tsx':
    'wa.me, a handoff to WhatsApp, and correctiv.org/unterstuetzen/, one segment',
  'app/projekt/[id].tsx': 'wa.me and correctiv.org/lokal/, which is a landing page',
  'app/backstage.tsx': 'shop.correctiv.org, another host',
  'app/atlas.tsx': 'abriss-atlas.de, another host',
  'app/video.tsx': 'the video platform, another host',
  'app/einstellungen.tsx': 'correctiv.org/ueber-uns/ and /impressum/, one segment each',
  'app/behauptung/[id].tsx': 'faktenforum.org, another host',
};

const IMPORT = /from\s+['"]@\/lib\/openExternal['"]/;

describe('who imports openExternal', () => {
  const importers = filesUnder(SRC, /\.tsx?$/)
    .filter((file) => IMPORT.test(withoutComments(readFileSync(file, 'utf8'))))
    .map((file) => relative(SRC, file).split('\\').join('/'));

  it('is limited to files whose targets are fixed', () => {
    expect(importers.filter((file) => !(file in ALLOWED))).toEqual([]);
  });

  it('lists nobody who stopped importing it', () => {
    expect(Object.keys(ALLOWED).filter((file) => !importers.includes(file))).toEqual([]);
  });

  it('is not given the files that route through openLink', () => {
    for (const file of ['app/spotlight.tsx', 'components/home/SpotlightBriefing.tsx']) {
      expect(importers).not.toContain(file);
      expect(withoutComments(readFileSync(join(SRC, file), 'utf8'))).toMatch(/\bopenLink\(/);
    }
  });
});
