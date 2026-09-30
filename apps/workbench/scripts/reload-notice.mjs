/**
 * Vite's "your dependencies moved, load again": `504` with `Outdated Optimize Dep`,
 * answered to a request in flight when the dev server re-optimises. The browser
 * reloads and gets a good bundle, so it is not a fault.
 *
 * Both halves, because the status alone would also swallow a proxy timeout.
 *
 * @param {string} text
 */
export function isReloadNotice(text) {
  return /Outdated Optimize Dep/i.test(text) && /\b504\b/.test(text);
}
