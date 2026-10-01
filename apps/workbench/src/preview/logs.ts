/**
 * The frame's warnings and errors since the last navigation.
 *
 * Bounded, because the interesting entry is almost always the newest and a page
 * that logs in a render loop must not be able to grow this without limit.
 */
import type { LogEntry } from './frame/console';

type Listener = () => void;

const LIMIT = 200;

let entries: LogEntry[] = [];
const listeners = new Set<Listener>();

export function getLogs(): LogEntry[] {
  return entries;
}

export function subscribeLogs(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emit(): void {
  for (const listener of listeners) listener();
}

export function addLog(entry: LogEntry): void {
  entries = [...entries, entry].slice(-LIMIT);
  emit();
}

export function clearLogs(): void {
  entries = [];
  emit();
}
