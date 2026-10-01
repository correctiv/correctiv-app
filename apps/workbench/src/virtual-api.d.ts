declare module 'virtual:api' {
  export interface ApiSymbol {
    name: string;
    kind: 'function' | 'const' | 'type' | 'interface' | 'class' | 'enum';
    signature: string;
    summary: string;
    doc: string;
    line: number;
  }
  export interface ApiModule {
    subpath: string;
    file: string;
    /** The file header, rendered from Markdown at build time. */
    doc: string;
    symbols: ApiSymbol[];
  }

  /** One prop, as a caller writes it. `type` is TypeDoc's, long ones cut short. */
  export interface ApiProp {
    name: string;
    type: string;
    optional: boolean;
    doc: string;
  }

  export interface ApiComponent {
    name: string;
    /** Set only where the folder holds a platform split: `web` beside `native`. */
    platform: string | null;
    /** The line a caller writes: the folder's barrel, or the file's own path. */
    import: string;
    file: string;
    line: number;
    doc: string;
    summary: string;
    /** The named props type, where there is one, rather than a literal. */
    propsType: string | null;
    /** That type's own prose, which is where a shared contract explains itself. */
    propsDoc: string;
    props: ApiProp[];
    /** Props types this project does not own, named rather than expanded. */
    inherits: string[];
  }

  /**
   * A non-component export of a component file: `sampleTarget`,
   * `READER_BASE_URL`. It carries its own file, unlike a core symbol, which
   * takes the file from the module it is listed under.
   */
  export interface ApiComponentExport extends ApiSymbol {
    file: string;
  }

  export interface ApiComponentGroup {
    /** The folder, which is the section a reader looks under. */
    name: string;
    /** The barrel's import path, where the folder has one. `ui` does. */
    barrel: string | null;
    components: ApiComponent[];
    /** What else those files export, props types excepted. */
    helpers: ApiComponentExport[];
  }

  /**
   * Two halves, and the difference between them matters to a caller.
   *
   * `core` is a library reached by subpath from `@correctiv/app-core`.
   * `components` is the app's own vocabulary, reached by the `@/components`
   * alias and existing nowhere else.
   */
  const model: {
    core: { package: string; modules: ApiModule[] };
    components: { root: string; alias: string; groups: ApiComponentGroup[] };
  };
  export default model;
}
