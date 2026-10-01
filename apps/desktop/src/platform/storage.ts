// `KeyValueStore` and `BlobStore` for the GTK host — the only place in this app that
// decides where persisted state physically lives.
//
// BOTH PORTS ARE ASYNCHRONOUS, and that is worth stating because the older
// literature here says otherwise. `ARCHITECTURE.md`'s table still calls
// `KeyValueStore` synchronous, and ADR 0006 strikes that claim through: the premise
// expired with the move to Redux, where `createAppStore()` builds the store at module
// load and `persist()` is a separate, later call the host already awaits (see the
// note on `KeyValueStore` in `packages/app-core/src/ports/index.ts`, which is the
// authority). So there is nothing left to be earlier than, and this file needs no
// in-memory mirror, no hydration step, and none of the data-loss trap that came with
// them.
//
// Two stores because they answer different questions, and the split follows the XDG
// layout rather than inventing one:
//
//   settings -> $XDG_CONFIG_HOME/correctiv-desktop/settings.ini
//   blobs    -> $XDG_CACHE_HOME/correctiv-desktop/<namespace>/<name>
//
// A settings file belongs in config: it is small, it is the user's, and losing it
// loses their bookmarks and membership. The blob cache belongs in cache: it is a
// megabyte of feed snapshots that the store's cascade can re-fetch, and a user or a
// cleaner is entitled to delete it. Putting both in one directory would make the
// second true of the first.

import GLib from 'gi://GLib?version=2.0';
import Gio from 'gi://Gio?version=2.0';

import type { BlobStore, KeyValueStore } from '@correctiv/app-core';

const APP_DIR = 'correctiv-desktop';

/** One flat group. The keys are the core's own `store.<id>` names. */
const GROUP = 'store';

const configPath = (): string =>
  GLib.build_filenamev([GLib.get_user_config_dir(), APP_DIR, 'settings.ini']);

const cacheDir = (): string => GLib.build_filenamev([GLib.get_user_cache_dir(), APP_DIR]);

/**
 * The settings file, read once per process and written through.
 *
 * A `GLib.KeyFile` rather than JSON, for one reason that pays off the first time
 * something goes wrong: the file is a plain `.ini` a human can open, read and edit
 * while debugging why a setting did not stick. The values are JSON strings the core
 * chose; the container does not need to be.
 */
let keyFile: GLib.KeyFile | null = null;

function settings(): GLib.KeyFile {
  if (keyFile !== null) return keyFile;
  keyFile = new GLib.KeyFile();
  try {
    keyFile.load_from_file(configPath(), GLib.KeyFileFlags.NONE);
  } catch {
    // No file yet is the ordinary first run, not an error. Any other failure lands
    // here too and is treated the same way the Expo host treats it: an unreadable
    // store and an absent key are the same thing to `persist()`, which then starts
    // each slice from its initial state.
  }
  return keyFile;
}

function flush(): void {
  const path = configPath();
  const dir = GLib.path_get_dirname(path);
  try {
    Gio.File.new_for_path(dir).make_directory_with_parents(null);
  } catch {
    // Already there.
  }
  try {
    settings().save_to_file(path);
  } catch (error) {
    console.warn('[platform] writing settings failed:', error);
  }
}

/**
 * The persisted appearance preference, read SYNCHRONOUSLY.
 *
 * The port below is promise-shaped because `KeyValueStore` is, but the read underneath
 * has always been a synchronous `GLib.KeyFile` lookup. One caller needs it that way and
 * only one: the host must know which token palette to mint BEFORE the first styled
 * element renders, and the store that would otherwise answer this hydrates
 * asynchronously, several frames later. Reading it late is what produced a window with
 * Adwaita's chrome in one scheme and the app's own colours in the other.
 *
 * `null` means "nothing usable recorded" — a first run, an unreadable file, or a value
 * outside the three. All of them mean "follow the system", which is also the app's own
 * default, so they collapse into one answer instead of three branches.
 */
export function persistedAppearance(): 'system' | 'light' | 'dark' | null {
  try {
    const theme: unknown = (
      JSON.parse(settings().get_string(GROUP, 'store.settings')) as { theme?: unknown }
    ).theme;
    return theme === 'light' || theme === 'dark' || theme === 'system' ? theme : null;
  } catch {
    return null;
  }
}

export const keyValue: KeyValueStore = {
  getString(key) {
    try {
      return Promise.resolve(settings().get_string(GROUP, key));
    } catch {
      // GLib raises for a missing key rather than returning null.
      return Promise.resolve(null);
    }
  },
  setString(key, value) {
    settings().set_string(GROUP, key, value);
    flush();
    return Promise.resolve();
  },
  remove(key) {
    try {
      settings().remove_key(GROUP, key);
      flush();
    } catch {
      // Removing what is not there is the outcome the caller wanted.
    }
    return Promise.resolve();
  },
};

/**
 * One file per blob, under a directory per namespace.
 *
 * `name` is documented as "an opaque file-safe key", so it is used verbatim. Asserted
 * rather than trusted: a name carrying a separator would write outside the namespace,
 * and that is worth a loud refusal rather than a surprising path.
 */
function blobPath(namespace: string, name: string): string {
  if (name.includes('/') || name.includes('..')) {
    throw new Error(
      `[platform] BlobStore: "${name}" is not a file-safe key. The port documents it as ` +
        'opaque, and a separator here would write outside the namespace.',
    );
  }
  return GLib.build_filenamev([cacheDir(), namespace, name]);
}

export const blobs: BlobStore = {
  read(namespace, name) {
    return new Promise((resolve) => {
      const file = Gio.File.new_for_path(blobPath(namespace, name));
      file.load_contents_async(null, (source, result) => {
        try {
          const [ok, contents] = (source ?? file).load_contents_finish(result);
          resolve(ok ? new TextDecoder().decode(contents) : null);
        } catch {
          // A cache miss and a broken cache are the same thing to a caller.
          resolve(null);
        }
      });
    });
  },
  write(namespace, name, contents) {
    return new Promise((resolve) => {
      const path = blobPath(namespace, name);
      try {
        Gio.File.new_for_path(GLib.path_get_dirname(path)).make_directory_with_parents(null);
      } catch {
        // Already there.
      }
      const file = Gio.File.new_for_path(path);
      file.replace_contents_bytes_async(
        new GLib.Bytes(new TextEncoder().encode(contents)),
        null,
        false,
        Gio.FileCreateFlags.REPLACE_DESTINATION,
        null,
        (source, result) => {
          try {
            (source ?? file).replace_contents_finish(result);
          } catch (error) {
            console.warn('[platform] caching a blob failed:', error);
          }
          resolve();
        },
      );
    });
  },
  delete(namespace, name) {
    return new Promise((resolve) => {
      const file = Gio.File.new_for_path(blobPath(namespace, name));
      file.delete_async(GLib.PRIORITY_DEFAULT, null, (source, result) => {
        try {
          (source ?? file).delete_finish(result);
        } catch {
          // "Deleting what is not there is not an error", says the port, and a
          // cache this cannot evict is still a cache.
        }
        resolve();
      });
    });
  },
};
