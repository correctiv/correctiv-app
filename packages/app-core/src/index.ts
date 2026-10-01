/**
 * `@correctiv/app-core` — the platform-free half of the app.
 *
 * `apps/mobile` (Expo/React Native, including the web target) is its host. It
 * contains the model, the parsers, the services, the caches and all of the state —
 * and imports neither a UI framework nor a platform SDK, which is what a test in
 * `test/boundary.test.ts` enforces on every PR. That rule is why replacing the view
 * layer once cost no behaviour.
 *
 * The root entry exposes only the platform ports, because that is the one thing
 * every host must touch at startup:
 *
 *   import { configurePlatform } from '@correctiv/app-core';
 *
 * Everything else is imported by subpath, mirroring the source layout, so the
 * boundary stays legible at the call site and there are no barrel collisions
 * (`data/interests` versus `stores/interests`):
 *
 *   import { loadArticle } from '@correctiv/app-core/articles/load';
 *   import { formatRelative } from '@correctiv/app-core/lib/format';
 *   import { signIn } from '@correctiv/app-core/stores/session';
 *   import type { Article } from '@correctiv/app-core/articles/types';
 */
export type {
  AudioBackend,
  ContentBundle,
  CorePlatform,
  BlobStore,
  ErrorDomain,
  ErrorReport,
  ErrorReporter,
  KeyValueStore,
  NowPlaying,
  PlaybackStatus,
} from './ports';
export {
  configurePlatform,
  createEmptyContentBundle,
  createMemoryPlatform,
  createNoOpErrorReporter,
  platform,
  resetPlatform,
} from './ports';
