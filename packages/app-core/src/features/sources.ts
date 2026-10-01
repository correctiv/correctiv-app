/**
 * Where each thing the core reads comes from, and whether that is real.
 *
 * [ADR 0072](../../../../adr/0072-features-are-released-by-a-commit-and-never-by-a-fetch.md) §4:
 * every data source declares `live` or `sample`, and a feature whose sources are all
 * `sample` is `vorschau` at most (`dataCeiling` in `features.ts`). The fact used to live
 * only in the workbench's source manifest, which the app may not read
 * ([ADR 0040](../../../../adr/0040-the-app-does-not-depend-on-the-workbench.md)), so it is
 * declared here and `apps/workbench/test/sources.test.ts` holds the manifest to it.
 *
 * A source is keyed by the id the manifest gives it, and `module` is the file that holds or
 * reads it. A source turning `live` is a one-word change here, and every feature that reads
 * it is lifted with it.
 */

/** `live` is read from the outside world; `sample` is a checked-in stand-in for an API that does not exist yet. */
export type Provenance = 'live' | 'sample';

export interface DataSource {
  readonly provenance: Provenance;
  /** Repository-relative path of the module that holds or reads it, where one module does. */
  readonly module?: string;
}

export const DATA_SOURCES = {
  articles: { provenance: 'live', module: 'packages/app-core/src/data/feeds.config.ts' },
  newsletter: { provenance: 'live' },
  search: { provenance: 'live', module: 'packages/app-core/src/services/search.service.ts' },
  podcasts: { provenance: 'live', module: 'packages/app-core/src/services/podcast.service.ts' },
  radio: { provenance: 'live', module: 'packages/app-core/src/services/radio.service.ts' },
  youtube: { provenance: 'live' },
  peertube: { provenance: 'live', module: 'packages/app-core/src/services/peertube.service.ts' },
  callouts: { provenance: 'sample', module: 'packages/app-core/src/data/callouts.ts' },
  claims: { provenance: 'sample', module: 'packages/app-core/src/data/claims.ts' },
  backstage: { provenance: 'sample', module: 'packages/app-core/src/data/backstage.ts' },
  'abriss-atlas': { provenance: 'sample', module: 'packages/app-core/src/data/abriss-atlas.ts' },
  quartalsbericht: {
    provenance: 'sample',
    module: 'packages/app-core/src/data/quartalsbericht.ts',
  },
  'search-samples': {
    provenance: 'sample',
    module: 'packages/app-core/src/data/search-samples.ts',
  },
  'podcast-seed': { provenance: 'sample', module: 'packages/app-core/src/data/podcasts.ts' },
  'spotlight-seed': { provenance: 'sample', module: 'packages/app-core/src/data/spotlight.ts' },
  projects: { provenance: 'sample', module: 'packages/app-core/src/data/projects.ts' },
  'home-pins': { provenance: 'sample', module: 'packages/app-core/src/data/home-pins.ts' },
} as const satisfies Record<string, DataSource>;

export type DataSourceId = keyof typeof DATA_SOURCES;

export function isDataSourceId(value: unknown): value is DataSourceId {
  return typeof value === 'string' && Object.hasOwn(DATA_SOURCES, value);
}
