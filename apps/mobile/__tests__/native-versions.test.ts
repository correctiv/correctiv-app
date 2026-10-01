import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

/**
 * Guards the one version mismatch that is fatal on device and invisible everywhere
 * else.
 *
 * React Native bakes its renderer in — `Libraries/Renderer/implementations/
 * ReactFabric-prod.js` carries a `version: "x.y.z"` — and refuses to run unless
 * `react` is EXACTLY that version. Its own peerDependency says `^19.2.3`, which
 * happily accepts 19.2.7, so npm resolves a version the renderer then rejects at
 * runtime with:
 *
 *     Incompatible React versions: The "react" and "react-native-renderer"
 *     packages must have the exact same version.
 *
 * That crash cost this project its first Android launch. The web build, jest and
 * tsc were all green, because none of them loads the native renderer. This test is
 * the cheap version of that emulator run.
 */
const require = createRequire(__filename);

/** Resolved the way Metro resolves it: from the app, not from wherever jest sits. */
function installedVersion(pkg: string): string {
  const manifest = require.resolve(`${pkg}/package.json`, {
    paths: [resolve(__dirname, '..')],
  });
  return (JSON.parse(readFileSync(manifest, 'utf8')) as { version: string }).version;
}

function bakedInRendererVersion(): string {
  const rendererPath = require.resolve(
    'react-native/Libraries/Renderer/implementations/ReactFabric-prod.js',
    { paths: [resolve(__dirname, '..')] },
  );
  const source = readFileSync(rendererPath, 'utf8');
  const match = /version:\s*"(\d+\.\d+\.\d+[^"]*)"/.exec(source);
  if (!match) {
    throw new Error(
      `Could not read the renderer version from ${rendererPath}. If React Native changed the marker, update this test — do not delete it.`,
    );
  }
  return match[1];
}

describe('native version pins', () => {
  it('react matches the renderer React Native bakes in', () => {
    // Not toBeGreaterThan, not semver-compatible: the renderer demands equality.
    expect(installedVersion('react')).toBe(bakedInRendererVersion());
  });

  it('react-dom matches react', () => {
    // The web build pairs them, and react-dom's own peer range is what dragged
    // react forward past the renderer in the first place.
    expect(installedVersion('react-dom')).toBe(installedVersion('react'));
  });

  /**
   * The storage pair, which fails the same way: on a device, and nowhere else.
   *
   * `react-native-mmkv` ships C++, Kotlin and Swift that nitrogen generated, and
   * the generated code and the Nitro runtime are one ABI. 4.3.2 was generated
   * against nitrogen 0.35.9 — its own devDependency — and this app runs it against
   * `react-native-nitro-modules` 0.37.1, which is the exact pair ADR 0026 §4
   * measured on a release-mode Android 15 emulator. Its peer range is `*`, so npm
   * will accept any two versions and say nothing.
   *
   * Nothing else in this repository can see that combination. The web build is
   * localStorage and loads no native module at all, and jest gets MMKV's own
   * in-memory mock. So what is pinned here is the pair somebody actually ran, and
   * moving either half becomes a decision rather than an npm update.
   */
  it('keeps the MMKV and Nitro pair that was measured on a device', () => {
    expect(installedVersion('react-native-mmkv')).toBe('4.3.2');
    expect(installedVersion('react-native-nitro-modules')).toBe('0.37.1');
  });
});
