export const DEFAULT_BRUSH_COLOR = '#1b2f59';
const STORAGE_KEY = 'chaeyun.brush';
const COLORS = [['남색', '#1b2f59'], ['먹색', '#242424'], ['적갈색', '#a34346'], ['황토색', '#ba8948'], ['녹색', '#38694f'], ['청색', '#386ca5'], ['보라색', '#7655a3'], ['회색', '#707782']];

export function parseBrushSettings(value) {
  try {
    const data = JSON.parse(value);
    return { color: /^#[0-9a-f]{6}$/i.test(data?.color) ? data.color.toLowerCase() : DEFAULT_BRUSH_COLOR, washed: data?.washed === true };
  } catch { return { color: DEFAULT_BRUSH_COLOR, washed: false }; }
}
export function readBrushSettings() {
  try { return parseBrushSettings(localStorage.getItem(STORAGE_KEY)); }
  catch { return parseBrushSettings(null); }
}

export function brushCursor(color, washed) {
  const ink = washed ? '#8b9bb6' : /^#[0-9a-f]{6}$/i.test(color) ? color : DEFAULT_BRUSH_COLOR;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 26 26"><g stroke="#fff" stroke-width=".8" stroke-linejoin="round"><path d="M10.5 14.5 21 2.5Q22.5 .8 24 2.3T23.5 5.5L14 18Z" fill="#1b2f59"/><path d="m11.5 13 4 3.5-2.3 2.5-4-3.5Z" fill="#8b9bb6"/><path d="M9.5 16C5 16 6 21 3 24c5 .5 10-2 10-5.5Z" fill="${ink}"/></g><path d="M10 18c-1.5 1-2 3-4 4" fill="none" stroke="#fff" stroke-opacity=".3" stroke-width=".7" stroke-linecap="round"/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") 3 24`;
}

export function createBrushTools(initial, onChange) {
  let settings = { ...initial };
  const events = new AbortController(), options = { signal: events.signal };
  const tools = document.createElement('div'); tools.className = 'brush-tools';
  tools.setAttribute('role', 'group'); tools.setAttribute('aria-label', '붓 도구');
  // Fixed, local SVG icons; no user content is inserted as markup.
  tools.innerHTML = `
    <div id="brush-palette-panel" class="brush-palette-panel" role="group" aria-label="붓 색상 선택" hidden>
      <p class="brush-palette-title">붓 색상</p>
      <div class="brush-swatches"></div>
      <label class="brush-custom-color">직접 선택 <input type="color" aria-label="붓 색상 직접 선택"></label>
    </div>
    <div class="brush-tool-buttons">
      <button type="button" class="brush-tool-button brush-palette-button" aria-label="팔레트: 붓 색상 선택" aria-controls="brush-palette-panel" aria-expanded="false" title="팔레트 · 색상 선택">
        <svg viewBox="0 0 32 32" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M16 3C8.5 3 3 8.5 3 16s5.5 13 13 13h2a3.5 3.5 0 0 0 2.5-6c-1.3-1.3-.5-3.5 1.5-3.5h3c3 0 4-2 4-4.5C29 8.5 23 3 16 3Z"/><circle cx="10" cy="12" r="2" fill="currentColor" stroke="none"/><circle cx="16" cy="8.5" r="2" fill="currentColor" stroke="none"/><circle cx="23" cy="12" r="2" fill="currentColor" stroke="none"/><circle cx="8.5" cy="19.5" r="2" fill="currentColor" stroke="none"/></svg>
      </button>
      <button type="button" class="brush-tool-button brush-water-button" aria-label="물통: 붓 씻기, 붓자국 끄기" aria-pressed="false" title="물통 · 붓자국 끄기">
        <svg viewBox="0 0 32 36" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6.5 12Q5 2 16 2T25.5 12"/><ellipse cx="16" cy="12" rx="10" ry="2.5"/><path d="M6 13Q.5 15.5 4.5 18Q1 20 4.5 22Q1 24 4.5 26Q1 29 6 30.5V32Q16 36 26 32V30.5Q31 29 27.5 26Q31 24 27.5 22Q31 20 27.5 18Q31.5 15.5 26 13"/><path d="M4.5 18Q16 22 27.5 18M4.5 22Q16 26 27.5 22M4.5 26Q16 30 27.5 26M6 30.5Q16 33.5 26 30.5"/></svg>
      </button>
    </div>
    <span class="visually-hidden brush-tool-status" role="status"></span>`;
  const palette = tools.querySelector('.brush-palette-button'), water = tools.querySelector('.brush-water-button');
  const panel = tools.querySelector('.brush-palette-panel'), custom = tools.querySelector('input');
  const swatches = tools.querySelector('.brush-swatches'), status = tools.querySelector('.brush-tool-status');
  const choices = COLORS.map(([name, color]) => {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'brush-swatch';
    button.style.setProperty('--swatch-color', color); button.setAttribute('aria-label', name); button.title = name;
    button.addEventListener('click', () => choose(color), options); swatches.append(button);
    return { button, color };
  });
  function close() { panel.hidden = true; palette.setAttribute('aria-expanded', 'false'); }
  function render() {
    tools.style.setProperty('--brush-selected-color', settings.color);
    water.setAttribute('aria-pressed', String(settings.washed));
    palette.dataset.washed = String(settings.washed);
    custom.value = settings.color;
    for (const { button, color } of choices) button.setAttribute('aria-pressed', String(!settings.washed && color === settings.color));
  }
  function update(next) {
    settings = next; render(); onChange({ ...settings });
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch { /* Works without storage, too. */ }
  }
  function choose(color) {
    if (!/^#[0-9a-f]{6}$/i.test(color)) return;
    update({ color: color.toLowerCase(), washed: false });
    status.textContent = '선택한 색으로 붓자국을 남깁니다.';
  }
  palette.addEventListener('click', () => { panel.hidden = !panel.hidden; palette.setAttribute('aria-expanded', String(!panel.hidden)); }, options);
  water.addEventListener('click', () => {
    update({ ...settings, washed: true }); close();
    status.textContent = '붓을 씻었습니다. 색상을 다시 고를 때까지 붓자국이 남지 않습니다.';
  }, options);
  custom.addEventListener('input', () => choose(custom.value), options);
  custom.addEventListener('change', () => choose(custom.value), options);
  tools.addEventListener('keydown', event => { if (event.key === 'Escape') { close(); palette.focus(); } }, options);
  document.addEventListener('pointerdown', event => { if (!tools.contains(event.target)) close(); }, options);
  render(); document.body.append(tools);
  return () => { events.abort(); tools.remove(); };
}
