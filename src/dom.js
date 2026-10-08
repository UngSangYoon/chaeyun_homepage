import { isAssetPath } from './media.js';

export const $ = (selector, root = document) => root.querySelector(selector);
export function node(tag, className = '', text = '') {
  const element = document.createElement(tag);
  element.className = className;
  element.textContent = text;
  return element;
}
export const base = new URL('../', import.meta.url);
let assetBase = base;
export function setAssetBase(url) { assetBase = new URL(url); }
export function asset(path) {
  if (!isAssetPath(path) && !isAssetPath(path, true)) return '';
  return new URL(path, assetBase).href;
}
export function picture(path, alt, className = '') {
  const img = node('img', className);
  img.src = asset(path);
  img.alt = alt;
  img.loading = 'lazy';
  img.decoding = 'async';
  return img;
}
export function paragraphs(container, text) {
  container.replaceChildren(...text.split(/\n\s*\n/).filter(Boolean).map(text => node('p', '', text)));
}
