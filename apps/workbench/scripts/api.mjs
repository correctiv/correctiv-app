/**
 * The reference, extracted with TypeDoc and reduced to what the site renders.
 *
 * TypeDoc runs as a DATA EXTRACTOR here, never as a site generator: `--json`
 * only, no HTML, no theme. The workbench renders the model with its own
 * components, which is the whole reason this approach was chosen. A generated
 * documentation site would have arrived with its own navigation and its own
 * design, and the generated pages would have become the front door by accident.
 *
 * The raw model is tens of megabytes and mostly type-resolution bookkeeping, so
 * it is reduced here rather than shipped. What survives is what a reference panel
 * shows: a name, what kind of thing it is, its signature, its prose and the line
 * it lives on.
 *
 * TWO HALVES, NAMED APART. `core` is a library: every module is a subpath a
 * caller imports from `@correctiv/app-core`, and a symbol is a symbol whatever
 * kind it is. `components` is the app's own vocabulary: a folder under
 * `apps/mobile/src/components`, a component, and the props it takes. They are
 * separate keys rather than one flat list because they answer different
 * questions, and a reader who cannot tell which is which will reach for
 * `@correctiv/app-core/ui/Button`, which does not exist.
 *
 * They also need two TypeDoc runs, because a run takes one tsconfig and these two
 * differ in the parts that decide whether the files parse at all: the app's
 * extends Expo's base for JSX, and it carries the `@/*` and `@correctiv/*` path
 * aliases every component's imports are written with.
 *
 * Neither package has a barrel to hand TypeDoc, so both are expanded over their
 * source directory. In `packages/app-core` that is on purpose (ADR: subpath
 * imports, the root entry exposes only the ports) and every module is a subpath;
 * under `src/components` a component file simply IS its import path, except in
 * `ui/`, where `index.ts` is the barrel every call site goes through.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { Marked } from 'marked';
import * as td from 'typedoc';

import { referenceHtml, scriptBearing } from '../plugin/script-bearing.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..');
const CORE = join(ROOT, 'packages/app-core');
const MOBILE = join(ROOT, 'apps/mobile');
const COMPONENTS = join(MOBILE, 'src/components');
/** What `apps/mobile/tsconfig.json` maps `@/*` to, and therefore what a caller types. */
const ALIAS = '@/components';
const OUT = join(HERE, '..', 'content', 'api.generated.json');

/**
 * The comments are Markdown and are written as Markdown.
 *
 * They lean on backticks for every identifier and on bold for the sentence that
 * matters, so shipping them as plain text puts asterisks and backticks on screen
 * and reads as broken. Rendered here rather than in the browser, so the reference
 * ships HTML and no parser.
 */
const md = new Marked({ gfm: true });

/** TypeDoc's numeric kinds, as the words the site prints. */
const KINDS = {
  [td.ReflectionKind.Function]: 'function',
  [td.ReflectionKind.Variable]: 'const',
  [td.ReflectionKind.TypeAlias]: 'type',
  [td.ReflectionKind.Interface]: 'interface',
  [td.ReflectionKind.Class]: 'class',
  [td.ReflectionKind.Enum]: 'enum',
};

/** The comment's prose, with TypeDoc's tag structure flattened back to text. */
function commentText(comment) {
  if (!comment) return '';
  const parts = comment.summary ?? [];
  return (
    parts
      // Every part carries its text; the kinds differ in what they mean, not in
      // where the words are. This was a ternary with the same branch twice.
      .map((part) => part.text)
      .join('')
      .trim()
  );
}

/** The first sentence, for a list row. The rest is for the panel. */
function firstSentence(text) {
  const match = /^(.*?[.!?])(\s|$)/s.exec(text.replace(/\s+/g, ' '));
  return (match ? match[1] : text.replace(/\s+/g, ' ')).slice(0, 220);
}

/** Repository-relative, which is what a link into the repository needs. */
function fileOf(reflection) {
  const source = reflection.sources?.[0];
  return source ? relative(ROOT, source.fullFileName) : '';
}

function signatureOf(reflection) {
  const signatures = reflection.signatures ?? reflection.type?.declaration?.signatures;
  if (!signatures?.length) return reflection.type ? `: ${reflection.type.toString()}` : '';
  const s = signatures[0];
  const params = (s.parameters ?? [])
    .map(
      (p) =>
        `${p.flags?.isRest ? '...' : ''}${p.name}${p.flags?.isOptional ? '?' : ''}: ${p.type ?? 'unknown'}`,
    )
    .join(', ');
  return `(${params}): ${s.type ?? 'void'}`;
}

/**
 * A type as one line, cut where a resolved type runs away with the page.
 *
 * TypeDoc prints the RESOLVED type, and one prop here resolves to something no
 * table can hold. `NavCard`'s `icon` is `keyof typeof Ionicons.glyphMap`, which
 * comes back as 1,357 string literals: 25 KB of type text in one cell, a tenth of
 * the whole model, to say "an Ionicons name". So a long union says how many
 * options it has and shows the first few, and anything else is cut at 200
 * characters. The source link is beside every one of them, and it is the honest
 * place for the full type.
 */
function typeString(type) {
  if (!type) return 'unknown';
  const text =
    type.type === 'union' && type.types.length > 8
      ? `${type.types.slice(0, 6).map(String).join(' | ')} … (${type.types.length} options)`
      : String(type);
  return text.length > 200 ? `${text.slice(0, 199)}…` : text;
}

/**
 * The file-header comment, which is where this core keeps its best prose.
 *
 * TypeDoc reports no module comment for any file here, and it is right to: a
 * module comment has to be the first thing in the file, and the convention in
 * `packages/app-core` is a block after the imports and above the first
 * declaration. In `articles/load.ts` that block explains the whole five-rung
 * cascade and sits above a private constant, so TypeDoc drops it on the floor
 * along with the constant. Losing it would leave the reference showing
 * signatures for the modules whose reasoning is the most worth reading.
 *
 * So the first block comment after the imports is read out of the source
 * directly, unless TypeDoc already attached that text to an exported symbol, in
 * which case it belongs to the symbol and not to the file.
 *
 * This is for the core only, and deliberately not for the components: their
 * convention is a doc comment sitting on the component itself, which TypeDoc
 * attaches correctly, and the one file where prose floats free
 * (`media/VideoFrame.tsx`) has three candidate blocks with no way to tell which
 * of them describes the component. A guess there would print "The origin the
 * embed claims to be on" as what `VideoFrame` is.
 */
function fileHeader(path, symbols) {
  let source;
  try {
    source = readFileSync(path, 'utf8');
  } catch {
    return '';
  }

  const match = /\/\*\*([\s\S]*?)\*\//.exec(source);
  if (!match) return '';

  const text = match[1]
    .split('\n')
    .map((line) => line.replace(/^\s*\* ?/, ''))
    .join('\n')
    .trim();

  if (!text) return '';
  if (symbols.some((s) => s.raw && s.raw.startsWith(text.slice(0, 60)))) return '';
  return text;
}

/** One project, expanded over its source directory. */
async function convert(entryPoint, tsconfig) {
  const app = await td.Application.bootstrap(
    {
      entryPoints: [entryPoint],
      entryPointStrategy: 'expand',
      tsconfig,
      excludeInternal: true,
      excludePrivate: true,
      skipErrorChecking: true,
      logLevel: 'Warn',
    },
    [new td.TypeDocReader(), new td.TSConfigReader()],
  );

  const project = await app.convert();
  if (!project) throw new Error(`TypeDoc converted nothing under ${entryPoint}; it did not parse`);
  return project;
}

/** Every exported symbol in the core, module by module, a module being a subpath. */
function coreModules(project) {
  const modules = [];
  for (const module of project.children ?? []) {
    const file = fileOf(module);
    if (!file) continue;
    // `articles/load`, which is exactly what an importer writes after the
    // package name, so the page can print the import line verbatim.
    const subpath = relative(join(CORE, 'src'), join(ROOT, file)).replace(/\.tsx?$/, '');

    const symbols = [];
    for (const child of module.children ?? []) {
      const kind = KINDS[child.kind];
      if (!kind) continue;
      const doc = commentText(child.comment ?? child.signatures?.[0]?.comment);
      symbols.push({
        name: child.name,
        kind,
        signature: signatureOf(child),
        summary: firstSentence(doc),
        raw: doc,
        doc: doc ? md.parse(doc) : '',
        line: child.sources?.[0]?.line ?? 0,
      });
    }
    if (symbols.length === 0) continue;

    const sorted = symbols.sort((a, b) => a.name.localeCompare(b.name));
    const moduleDoc = commentText(module.comment) || fileHeader(join(ROOT, file), symbols);
    // `raw` exists only for the comparison above; the page renders the HTML.
    for (const symbol of sorted) delete symbol.raw;
    modules.push({ subpath, file, doc: moduleDoc ? md.parse(moduleDoc) : '', symbols: sorted });
  }

  return modules.sort((a, b) => a.subpath.localeCompare(b.subpath));
}

/** One prop: what a caller writes, what it takes, and why it exists. */
function propOf(child) {
  const doc = commentText(child.comment ?? child.signatures?.[0]?.comment);
  return {
    name: child.name,
    type: child.type ? typeString(child.type) : signatureOf(child),
    optional: Boolean(child.flags?.isOptional),
    doc: doc ? md.parse(doc) : '',
  };
}

/**
 * The props a component takes, dug out of whatever shape its props type has.
 *
 * Four shapes are in use and all four have to work: an object literal on the
 * destructured parameter (`{ item }: { item: FeedItem }`), an exported alias in
 * the same file (`ButtonProps`), an interface imported from a sibling module
 * (`ReaderViewProps`, which exists so the two `ReaderView` implementations cannot
 * drift), and an intersection of a platform type with the component's own
 * additions (`ViewProps & { tone?: … }`).
 *
 * The intersection is why this expands rather than printing the type. Resolving
 * `PressableProps` would list every React Native pressable prop on a component
 * whose own contract is four, and bury them. So a part this project owns is
 * expanded and a part it does not is NAMED, in `inherits`, verbatim as written.
 *
 * A fifth shape arrived with `ScreenHeaderProps`: a union, one member per way the
 * component may be called. Before it was handled, a union fell through to the
 * bottom of this function and the page printed "Props: None." followed by "Plus
 * everything in `…`, which this repository does not own" — about a type declared
 * two files from the component, on the one component whose props type exists
 * precisely so that a reader can see which props go together.
 */
export function propsOf(type, found = { props: new Map(), inherits: [] }, depth = 0) {
  if (!type || depth > 4) return found;

  if (type.type === 'intersection') {
    for (const part of type.types) propsOf(part, found, depth + 1);
    return found;
  }

  if (type.type === 'union') {
    /*
     * A call site picks one member, so the vocabulary a caller may write is every
     * member's. Each is walked on its own and the results merged: a name several
     * members carry gets their types joined, and one that is absent or optional
     * in any member is optional, because there is a way to call this component
     * without it.
     *
     * `never` drops out of a joined type. It is how one member forbids a prop
     * another one takes — `backLabel?: never` beside `backLabel?: string` — and
     * "never | string" says less to a reader than "string" does, while the prop's
     * own prose says which member it belongs to.
     */
    const members = type.types.map((part) => propsOf(part, undefined, depth + 1));
    for (const member of members) found.inherits.push(...member.inherits);

    for (const name of new Set(members.flatMap((m) => [...m.props.keys()]))) {
      if (found.props.has(name)) continue;
      const seen = members.map((m) => m.props.get(name));
      const present = seen.filter(Boolean);
      const types = [...new Set(present.map((p) => p.type))].filter((t) => t !== 'never');
      found.props.set(name, {
        name,
        type: types.join(' | ') || 'never',
        optional: seen.some((p) => !p || p.optional),
        doc: present.find((p) => p.doc)?.doc ?? '',
      });
    }
    return found;
  }

  if (type.type === 'reflection') {
    for (const child of type.declaration?.children ?? []) {
      if (!found.props.has(child.name)) found.props.set(child.name, propOf(child));
    }
    return found;
  }

  if (type.type === 'reference') {
    const target = type.reflection;
    // Not ours: `ViewProps` from react-native, `Omit<…>` from TypeScript itself.
    // There is no reflection to walk, and the name is the useful thing anyway.
    if (!target) {
      found.inherits.push(typeString(type));
      return found;
    }
    for (const child of target.children ?? []) {
      if (!found.props.has(child.name)) found.props.set(child.name, propOf(child));
    }
    // An interface's bases, then an alias's target: one of the two is always empty.
    for (const base of target.extendedTypes ?? []) propsOf(base, found, depth + 1);
    if (target.type) propsOf(target.type, found, depth + 1);
    return found;
  }

  found.inherits.push(typeString(type));
  return found;
}

/**
 * Whether an export is a component, by the convention the folder already keeps.
 *
 * A capitalised callable. That is what every component here is, and nothing else
 * under `src/components` is both: `sampleTarget` is callable and lower case,
 * `READER_BASE_URL` is capitalised and a string, `ReaderViewProps` is a type.
 * Testing the return type instead would have to guess at `Element`,
 * `ReactElement`, `ReactNode` and `Element | null`, and `SafeAreaView`, which is
 * a wrapped upstream component rather than a function written here, answers none
 * of them.
 */
function componentSignature(child) {
  if (!/^[A-Z]/.test(child.name)) return null;
  return child.signatures?.[0] ?? child.type?.declaration?.signatures?.[0] ?? null;
}

/** `VideoFrame.web.tsx` is `VideoFrame` on the web, and the same import path. */
function platformOf(file) {
  return /\.(web|ios|android|native)\.tsx?$/.exec(basename(file))?.[1] ?? null;
}

/**
 * The app's components, grouped by the folder they live in.
 *
 * A group is a folder because that is what the app's own imports are: 52 of them
 * write `@/components/ui`, and every other one writes the file's own path. So the
 * import line printed on a component is the barrel where the folder has one and
 * the file otherwise, which is the line a caller actually writes.
 *
 * A platform split stays two entries, one per file, each with its own source
 * link. `VideoFrame` is a WebView on the device and an `<iframe>` on the web, and
 * the reason the native half builds a whole HTML document around the embed is
 * written in that file; one merged row would have to pick a file to link to.
 */
function componentGroups(project) {
  const groups = new Map();
  const barrels = new Set();
  /*
   * Every type that turned out to BE a component's props, by the file it is
   * declared in. Collected across the whole run rather than per file, because
   * `reader/types.ts` and `media/videoFrameTypes.ts` exist precisely so that the
   * props type lives beside neither implementation. Listing them again as
   * exports of their own would print `ReaderViewProps` twice, once expanded into
   * the component and once as a type with nothing readable in it.
   */
  const propsTypes = new Set();

  const group = (name) => {
    if (!groups.has(name)) groups.set(name, { name, components: [], helpers: [] });
    return groups.get(name);
  };

  for (const module of project.children ?? []) {
    const file = fileOf(module);
    if (!file) continue;
    const inside = relative(COMPONENTS, join(ROOT, file));
    // A file directly under `src/components` has no folder over it, so it falls
    // into a group named after the directory itself. There is none today, and one
    // added tomorrow lands there rather than needing a case of its own.
    const folder = dirname(inside) === '.' ? 'components' : dirname(inside);
    const stem = basename(inside).replace(/\.tsx?$/, '');

    // The barrel re-exports and declares nothing: TypeDoc reports its children as
    // references to the files below, which are extracted in their own right. What
    // it does say is that this folder is imported as a folder.
    if (stem === 'index') {
      barrels.add(folder);
      group(folder);
      continue;
    }

    // The export's own name is already the component's: `VideoFrame.web.tsx`
    // exports `VideoFrame`, because the suffix is Metro's and not the caller's.
    const platform = platformOf(inside);
    const bucket = group(folder);

    for (const child of module.children ?? []) {
      const doc = commentText(child.comment ?? child.signatures?.[0]?.comment);
      const signature = componentSignature(child);

      // Not a component: whatever else the file exports beside one, which is
      // filtered below, once every props type is known.
      if (!signature) {
        const kind = KINDS[child.kind];
        if (!kind) continue;
        bucket.helpers.push({
          name: child.name,
          kind,
          signature: signatureOf(child),
          summary: firstSentence(doc),
          doc: doc ? md.parse(doc) : '',
          file,
          line: child.sources?.[0]?.line ?? 0,
        });
        continue;
      }

      const parameter = signature.parameters?.[0]?.type;
      if (parameter?.type === 'reference' && parameter.reflection) {
        propsTypes.add(`${fileOf(parameter.reflection)}#${parameter.name}`);
      }
      const { props, inherits } = propsOf(parameter);
      const propsDoc = commentText(parameter?.reflection?.comment);

      bucket.components.push({
        name: child.name,
        // `null` unless the filename says otherwise, and filled in below for the
        // half of a split that carries no suffix.
        platform,
        file,
        line: child.sources?.[0]?.line ?? 0,
        doc: doc ? md.parse(doc) : '',
        summary: firstSentence(doc),
        propsType: parameter?.type === 'reference' ? parameter.name : null,
        propsDoc: propsDoc ? md.parse(propsDoc) : '',
        // Required first, then alphabetical: a props table is read to find out
        // what a component needs before what it will accept.
        props: [...props.values()].sort(
          (a, b) => Number(a.optional) - Number(b.optional) || a.name.localeCompare(b.name),
        ),
        inherits,
      });
    }
  }

  const groupList = [];
  for (const bucket of groups.values()) {
    bucket.helpers = bucket.helpers.filter((h) => !propsTypes.has(`${h.file}#${h.name}`));
    if (bucket.components.length === 0 && bucket.helpers.length === 0) continue;

    const barrel = barrels.has(bucket.name) ? `${ALIAS}/${bucket.name}` : null;
    const split = new Map();
    for (const component of bucket.components) {
      split.set(component.name, (split.get(component.name) ?? 0) + 1);
    }

    for (const component of bucket.components) {
      // A file with no platform suffix is every platform, unless a suffixed twin
      // sits beside it, in which case it is the one Metro keeps for the device.
      if (!component.platform && split.get(component.name) > 1) component.platform = 'native';
      const folder = bucket.name === 'components' ? '' : `${bucket.name}/`;
      component.import = barrel ?? `${ALIAS}/${folder}${component.name}`;
    }

    bucket.components.sort(
      (a, b) => a.name.localeCompare(b.name) || (a.platform ?? '').localeCompare(b.platform ?? ''),
    );
    bucket.helpers.sort((a, b) => a.name.localeCompare(b.name));
    groupList.push({ ...bucket, barrel });
  }

  return groupList.sort((a, b) => a.name.localeCompare(b.name));
}

async function main() {
  const core = {
    package: '@correctiv/app-core',
    modules: coreModules(await convert(join(CORE, 'src'), join(CORE, 'tsconfig.json'))),
  };

  const components = {
    root: relative(ROOT, COMPONENTS),
    alias: ALIAS,
    groups: componentGroups(await convert(COMPONENTS, join(MOBILE, 'tsconfig.json'))),
  };

  /*
   * Refused here, and not only in a test, because this file is not committed: the
   * `check` job never has one to read, and the build that does have one runs this
   * script first. A doc comment is rendered with `marked`, which passes raw HTML
   * through, and the site puts the result in with `dangerouslySetInnerHTML`.
   * `plugin/script-bearing.ts` says what counts.
   */
  const refused = referenceHtml({ core, components }).flatMap(({ where, html }) =>
    scriptBearing(html).map((fault) => `  ${where}: ${fault}`),
  );
  if (refused.length > 0) {
    throw new Error(
      `a doc comment renders to script-bearing HTML, which the reference would put into the page:\n${refused.join('\n')}\n` +
        'Put the HTML in backticks if it is meant as a name, or take it out.',
    );
  }

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify({ core, components }, null, 2)}\n`);

  const symbols = core.modules.reduce((n, m) => n + m.symbols.length, 0);
  const documented = core.modules.reduce((n, m) => n + m.symbols.filter((s) => s.doc).length, 0);
  const count = (pick) => components.groups.reduce((n, g) => n + pick(g).length, 0);
  const size = Math.round(readFileSync(OUT).length / 1024);
  console.log(
    `api.generated.json: core ${core.modules.length} modules, ${symbols} symbols, ${documented} with prose; ` +
      `components ${components.groups.length} folders, ${count((g) => g.components)} components, ` +
      `${count((g) => g.helpers)} other exports; ${size} KB`,
  );
}

// Only when this file is the command. Running two TypeDoc conversions is what
// `npm run api` is for; a test that wants `propsOf` imports the module instead,
// and `test/api.test.ts` does exactly that.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
