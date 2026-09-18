declare module 'virtual:strings' {
  // The shape lives in `strings-model.ts`, not here, so that module — and a test
  // of it — can import the type without this virtual module in scope at all.
  import type { StringEntry } from './pages/strings-model.ts';

  export type { StringEntry };

  const model: { locales: string[]; strings: StringEntry[] };
  export default model;
}
