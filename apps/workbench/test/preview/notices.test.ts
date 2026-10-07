import { describe, expect, it } from 'vitest';

import { SHIPPED_LAYOUT } from '@correctiv/app-core/lib/screen-layout';

import {
  countByLevel,
  highestLevel,
  noticesOf,
  NOTICE_COPY,
  sortNotices,
  type Notice,
} from '../../src/preview/home/notices';
import { readSize } from '../../src/preview/home/size';

/**
 * What the layout tool tells the person, as data (`notices.ts`): which state makes which
 * notice at which level, the order they are listed in, and the level that colours the bell.
 * No DOM here, because the list is derived from plain objects; `custom-screens.test.tsx`
 * and `size.test.tsx` press the bell.
 */

const note = (id: string, level: Notice['level']): Notice => ({
  id,
  level,
  message: NOTICE_COPY.shipped,
});

const levels = (notices: readonly Notice[]) =>
  notices.map((notice) => `${notice.id}:${notice.level}`);

describe('noticesOf', () => {
  it('has nothing to say for the demo with nothing wrong', () => {
    expect(noticesOf({ layout: 'demo' })).toEqual([]);
  });

  it('warns that the shipped layout reaches readers, and only for that layout', () => {
    expect(levels(noticesOf({ layout: SHIPPED_LAYOUT }))).toEqual(['shipped:warning']);
    expect(noticesOf({ layout: 'demo' })).toEqual([]);
  });

  it('warns about a missing language once per language, with the count', () => {
    const notices = noticesOf({
      layout: 'demo',
      gaps: [{ language: 'en', texts: 2 }],
      languageName: () => 'English',
    });
    expect(levels(notices)).toEqual(['gap-en:warning']);
    expect(notices[0]?.values).toEqual({ language: 'English', count: 2 });
  });

  it('turns the size into a warning near the limit and an error over it, never both', () => {
    const near = readSize(readSize(0).limit * 0.9);
    const over = readSize(readSize(0).limit + 1);
    expect(levels(noticesOf({ layout: 'demo', size: near }))).toEqual(['size:warning']);
    expect(levels(noticesOf({ layout: 'demo', size: over }))).toEqual(['size:error']);
    expect(noticesOf({ layout: 'demo', size: readSize(10) })).toEqual([]);
  });

  it('says a scenario locks the screen, as information', () => {
    expect(levels(noticesOf({ layout: 'demo', guarded: true }))).toEqual(['locked:info']);
  });

  it('tells a deletion, with the screen that opens instead or the empty layout', () => {
    const next = noticesOf({ layout: 'demo', removal: { title: 'A', next: 'B' } })[0];
    expect(next?.message).toBe(NOTICE_COPY.removed);
    expect(next?.values).toEqual({ title: 'A', next: 'B' });
    const last = noticesOf({ layout: 'demo', removal: { title: 'A', next: null } })[0];
    expect(last?.message).toBe(NOTICE_COPY.removedLast);
  });

  it('gives a deleted screen a Restore and a link that submits the deletion', () => {
    let restored = 0;
    const [one] = noticesOf({
      layout: 'demo',
      deleted: [
        {
          id: 'entdecken',
          title: 'Entdecken',
          href: 'https://x/issues/new',
          onRestore: () => (restored += 1),
        },
      ],
    });
    expect(one?.id).toBe('deleted-entdecken');
    expect(one?.level).toBe('info');
    const [restore, submit] = one?.actions ?? [];
    restore?.onSelect?.();
    expect(restored).toBe(1);
    expect(restore?.name).toBe(NOTICE_COPY.restoreNamed);
    expect(submit?.href).toBe('https://x/issues/new');
  });

  it('lists errors before warnings before information, whatever order they arose in', () => {
    const notices = noticesOf({
      layout: SHIPPED_LAYOUT,
      guarded: true,
      gaps: [{ language: 'en', texts: 1 }],
      size: readSize(readSize(0).limit + 1),
    });
    expect(notices.map((notice) => notice.level)).toEqual(['error', 'warning', 'warning', 'info']);
  });

  it('gives every notice an id of its own', () => {
    const notices = noticesOf({
      layout: SHIPPED_LAYOUT,
      guarded: true,
      gaps: [
        { language: 'en', texts: 1 },
        { language: 'de', texts: 1 },
      ],
      removal: { title: 'A', next: null },
    });
    expect(new Set(notices.map((notice) => notice.id)).size).toBe(notices.length);
  });
});

describe('sortNotices', () => {
  it('keeps the order inside a level', () => {
    const sorted = sortNotices([
      note('a', 'info'),
      note('b', 'warning'),
      note('c', 'info'),
      note('d', 'error'),
      note('e', 'warning'),
    ]);
    expect(levels(sorted)).toEqual(['d:error', 'b:warning', 'e:warning', 'a:info', 'c:info']);
  });

  it('does not touch what it was given', () => {
    const given = [note('a', 'info'), note('b', 'error')];
    sortNotices(given);
    expect(given.map((one) => one.id)).toEqual(['a', 'b']);
  });
});

describe('highestLevel', () => {
  it('is null for an empty list', () => {
    expect(highestLevel([])).toBeNull();
  });

  it('is the most urgent level present, which colours the badge', () => {
    expect(highestLevel([note('a', 'info')])).toBe('info');
    expect(highestLevel([note('a', 'info'), note('b', 'warning')])).toBe('warning');
    expect(highestLevel([note('a', 'warning'), note('b', 'info'), note('c', 'error')])).toBe(
      'error',
    );
  });
});

describe('countByLevel', () => {
  it('counts each level and zero for the rest', () => {
    expect(countByLevel([note('a', 'info'), note('b', 'info'), note('c', 'error')])).toEqual({
      error: 1,
      warning: 0,
      info: 2,
    });
  });
});
