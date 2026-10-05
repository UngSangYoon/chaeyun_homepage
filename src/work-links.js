export function workUrl(id, base) {
  const url = new URL('work.html', base);
  url.searchParams.set('id', id);
  return url.href;
}

export function workWindow(total, start) {
  if (!total) return [];
  // One extra card enters from outside the viewport during each step.
  return Array.from({ length: Math.min(total, 2) }, (_, offset) => ((start + offset) % total + total) % total);
}
