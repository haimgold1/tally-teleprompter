export type Route =
  | { name: 'library' }
  | { name: 'edit'; id: string }
  | { name: 'studio'; id: string }
  | { name: 'review'; id: string }
  | { name: 'takes'; id: string };

/** Hash routes need no server rewrites, which GitHub Pages cannot do. */
export function parseHash(hash: string): Route {
  const [name, id] = hash.replace(/^#\/?/, '').split('/');
  if (id && (name === 'edit' || name === 'studio' || name === 'review' || name === 'takes')) return { name, id };
  return { name: 'library' };
}

export function navigate(path: string, options?: { replace?: boolean }): void {
  const hash = `#/${path}`;
  if (options?.replace) location.replace(hash);
  else location.hash = hash;
}
