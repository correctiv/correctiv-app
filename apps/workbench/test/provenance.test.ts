import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { collectDocs, GENERATED_DOCUMENTS, ROOT } from '../plugin/collect.ts';
import {
  buildProvenance,
  NAMED_CHECKS,
  provenanceMarkdown,
  PROVENANCE_SOURCE,
} from '../plugin/provenance.ts';

const provenance = buildProvenance(ROOT);
const page = provenanceMarkdown(provenance);

/**
 * The net under the one page that has no file.
 *
 * `/provenance` is generated from the tree, so nothing about it can go stale in
 * the ordinary way — and that moves the failure rather than removing it. What can
 * go wrong here is the SCAN: a marker reworded, a generator moved, a check
 * renamed. Every one of those makes a sentence or a table quietly smaller, and a
 * page that lists nothing looks exactly like a repository that generates nothing.
 *
 * So the assertions below are about the machinery. Floors where the answer is a
 * set, presence where a sentence is built on one reading, and the two invariants
 * the page's argument rests on.
 */
describe('the provenance scan', () => {
  it('finds the generated files, and does not quietly find none', () => {
    // A floor rather than a count: adding a generator should not fail a test, and
    // a scan that has stopped matching the marker should.
    expect(provenance.generated.length).toBeGreaterThan(8);
    for (const entry of provenance.generated) {
      expect(entry.marker).not.toBe('');
      expect(entry.claims).not.toBe('');
      expect(existsSync(join(ROOT, entry.file))).toBe(true);
    }
  });

  /**
   * The invariant the first tier rests on: a file that says a program wrote it
   * has to have that program.
   *
   * This is the assertion that answers "if a generated file stops being
   * generated, does anything notice". Deleting the generator and leaving the
   * header behind is the quiet version of that, and it fails here.
   */
  it('finds a generator for every file that claims one', () => {
    const orphaned = provenance.orphaned.map((entry) => `${entry.file} claims ${entry.claims}`);
    expect(orphaned).toEqual([]);
  });

  it('names the script that writes each generated file, and a way to re-take it', () => {
    // The uniwind shims are the exception the page draws: their marker names a
    // dependency rather than a script here, so there is nothing in this tree to
    // find and nothing to run.
    const ours = provenance.generated.filter((entry) => entry.claims.includes('/'));
    expect(ours.length).toBeGreaterThan(8);
    expect(ours.filter((entry) => entry.writtenBy === null).map((e) => e.file)).toEqual([]);
    expect(ours.filter((entry) => entry.command === null).map((e) => e.file)).toEqual([]);
  });

  it('finds the checks that open a file, and does not quietly find none', () => {
    expect(provenance.pinned.length).toBeGreaterThan(20);
    expect(provenance.tests.cases).toBeGreaterThan(500);
  });

  /**
   * Every check the page's prose names, still a check.
   *
   * These are the only paths typed into `plugin/provenance.ts`, because which
   * check is worth a paragraph is a judgement rather than a measurement. A
   * renamed test would otherwise take its paragraph off the page with nothing
   * anywhere going red — the exact failure the page is about.
   */
  it('still finds every check the page names by hand', () => {
    const missing = Object.entries(NAMED_CHECKS)
      .filter(([, file]) => !provenance.pinned.some((entry) => entry.file === file))
      .map(([name, file]) => `${name}: ${file}`);
    expect(missing).toEqual([]);
  });

  /**
   * The readings each of which is one sentence on the page.
   *
   * A regex that has stopped matching returns null, the sentence built on it
   * drops out, and the page reads as though the repository had never had that
   * arrangement. Named individually so the failure says which reading went.
   */
  it('still reads the four facts its paragraphs are built on', () => {
    const gone = Object.entries({
      'the check duration in ARCHITECTURE.md': provenance.checkDuration,
      'the sources schedule in .github/workflows/sources.yml': provenance.sourcesCron,
      'the ledger comparison in scripts/adr-ledger.mjs': provenance.ledgerGuard,
      'the port declaration the diagrams test parses': provenance.portsRead,
    })
      .filter(([, value]) => value === null)
      .map(([what]) => what);
    expect(gone).toEqual([]);
  });

  it('reads the ledger as the append-only record it is', () => {
    /*
     * A record that has been written and not yet staged fails this with two bare
     * numbers and nothing saying why: the scan counts TRACKED files and the ledger
     * counts entries, so `npm run adr:lock` has seen the new record and `git` has
     * not. `git add` it. Found twice on 2026-09-18, in two sessions, and neither
     * the assertion nor the page it writes said a word about it.
     */
    expect(provenance.ledger.records).toBe(provenance.records);
    expect(provenance.ledger.decisions).toBeGreaterThanOrEqual(provenance.ledger.records);
    // Every number keeps every heading it has carried, so the texts can only
    // outgrow the decisions, never fall behind them.
    expect(provenance.ledger.texts).toBeGreaterThanOrEqual(provenance.ledger.decisions);
  });
});

describe('the page it writes', () => {
  it('leaves no template hole and no missing reading in the prose', () => {
    expect(page).not.toContain('${');
    expect(page).not.toContain('undefined');
    expect(page).not.toContain('null');
    // A `when(...)` that dropped its sentence leaves the space around it behind.
    expect(page).not.toMatch(/ {2}[.,]/);
  });

  it('opens every tier and every exception it promises', () => {
    for (const heading of [
      '# Provenance',
      '## 1. Generated, and committed',
      '## 2. Read, not copied',
      '## 3. Pinned by a check',
      '## Deliberately weaker, and worth knowing why',
      '## Where it fails',
    ]) {
      expect(page).toContain(heading);
    }
  });

  /**
   * The page is a document, and `test/docs.test.ts` counts every `~~` in every
   * document's file against the struck claims it collects from the rendered HTML.
   * A strike written into this generator would be counted in its source and never
   * rendered, and the failure would land two files away.
   */
  it('strikes nothing through, because the document accounting is by file', () => {
    expect(page).not.toContain('~~');
  });

  /**
   * The wiring, end to end: the shell answers a document route with
   * `pages/Document.tsx`, which asks `generated` which footer to draw. A page
   * that arrived without the flag would offer its own generator as the file to
   * edit, which is the one sentence on it that would be a lie.
   */
  it('is published as a document of this site, from the program that writes it', () => {
    const doc = collectDocs().module.docs.find((d) => d.route === PROVENANCE_SOURCE.route);
    expect(doc?.generated).toBe(true);
    expect(doc?.file).toBe(PROVENANCE_SOURCE.file);
    expect(doc?.title).toBe('Provenance');
    expect(existsSync(join(ROOT, PROVENANCE_SOURCE.file))).toBe(true);
    expect(GENERATED_DOCUMENTS.map((source) => source.route)).toContain(PROVENANCE_SOURCE.route);
  });
});
