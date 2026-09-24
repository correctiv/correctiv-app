import { OFFLINE_ARTICLES } from '@/lib/articles/offlineBundle.generated';

/**
 * The bundled articles are extracted when the bundle is generated, not when they
 * are read, so a change to the core's cleanup reaches them only through
 * `npm run offline-articles`. The bundle generated before the block rules carried
 * the related-articles placement ("Mehr von CORRECTIV") in 11 of its 15 bodies,
 * and it is the first rung of the reader's cascade, so those were the copies a
 * reader without a network saw.
 *
 * The bodies are the DOM backend's output, classes gone, so a placement is found by
 * what it says. These are the texts of the placements measured on 2026-09-24; one
 * that runs a new text slips past this list, which is why the markup markers are
 * asserted beside them for a bundle made by a backend that keeps classes.
 */
const PLACEMENT_TEXT = [
  'Mehr von CORRECTIV',
  'Bitte nehmen Sie sich einen Moment Zeit',
  'Mutmeter',
  'Europas Brandstifter',
];
const PLACEMENT_MARKUP = ['entity-placement', 'ad-container', 'data-corre-trackid'];

const bodies = Object.entries(OFFLINE_ARTICLES).map(([url, article]) => [url, article.bodyHtml]);

describe('the offline bundle', () => {
  it('has bodies to check', () => {
    expect(bodies.length).toBeGreaterThan(0);
  });

  it.each(bodies)('carries no ad placement in %s', (_url, body) => {
    for (const needle of [...PLACEMENT_TEXT, ...PLACEMENT_MARKUP]) {
      expect(body).not.toContain(needle);
    }
  });

  it.each(bodies)('carries no accordion stripped of its title in %s', (_url, body) => {
    expect(body).not.toMatch(/<h3>\s*<\/h3>/);
  });
});
