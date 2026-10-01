import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/services/http', () => ({ fetchJson: vi.fn() }));

import { fetchJson } from '../src/services/http';
import { fetchWpArticle } from '../src/services/wp.service';

const fetchMock = vi.mocked(fetchJson);

const ISSUE = 'https://correctiv.org/spotlight-newsletter/hass-verkleidet-als-wissenschaft/';
const POST = 'https://correctiv.org/faktencheck/2026/08/31/historisches-niedrigwasser-der-elbe/';

function answer(link: string) {
  return [
    {
      id: 1,
      link,
      date_gmt: '2026-09-30T14:43:43',
      title: { rendered: 'Hass – verkleidet als Wissenschaft' },
      excerpt: { rendered: '<p>Ein Auszug.</p>' },
      content: {
        rendered:
          '<figure class="wp-block-image img-intro-header header_image"><img src="https://correctiv.org/m.gif" alt="Teaser"/></figure>\n<p>Der erste Absatz.</p>',
      },
    },
  ];
}

/**
 * A Spotlight issue is a `newspack_nl_cpt`, not a `post`: asked of `wp/v2/posts`
 * its slug finds nothing, and on the web the page itself cannot be read (no CORS
 * header on correctiv.org's HTML), so the reader showed its error state for every
 * issue.
 */
describe('fetchWpArticle on a Spotlight issue', () => {
  beforeEach(() => fetchMock.mockReset());

  it('asks the newsletter endpoint and returns the issue as an article', async () => {
    fetchMock.mockResolvedValue(answer(ISSUE));
    const article = await fetchWpArticle(ISSUE);
    expect(fetchMock.mock.calls[0][0]).toMatch(
      /^https:\/\/correctiv\.org\/wp-json\/wp\/v2\/newspack_nl_cpt\?.*slug=hass-verkleidet-als-wissenschaft/,
    );
    expect(article?.title).toBe('Hass – verkleidet als Wissenschaft');
    expect(article?.bodyHtml).toContain('Der erste Absatz.');
  });

  it('makes the masthead the hero and takes it out of the body', async () => {
    fetchMock.mockResolvedValue(answer(ISSUE));
    const article = await fetchWpArticle(ISSUE);
    expect(article?.heroImageUrl).toBe('https://correctiv.org/m.gif');
    expect(article?.bodyHtml).not.toContain('m.gif');
  });

  it('keeps asking wp/v2/posts for everything else', async () => {
    fetchMock.mockResolvedValue(answer(POST));
    const article = await fetchWpArticle(POST);
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/wp\/v2\/posts\?/);
    expect(article?.heroImageUrl).toBeUndefined();
  });
});
