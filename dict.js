// ==================== DICTIONARY LOOKUP ====================
// 3-tier: 표준국어대사전 → 우리말샘 → customDefs (서버는 1·2 처리, 클라는 3 처리)

const DICT_CACHE_KEY = 'dictCache_v1';
const DICT_CACHE_TTL = 1000 * 60 * 60 * 24 * 30; // 30일

function loadDictCache() {
  try { return JSON.parse(localStorage.getItem(DICT_CACHE_KEY) || '{}'); }
  catch { return {}; }
}

function saveDictCache(cache) {
  try { localStorage.setItem(DICT_CACHE_KEY, JSON.stringify(cache)); }
  catch { /* quota exceeded - 무시 */ }
}

let _dictCache = null;
function getCache() {
  if (!_dictCache) _dictCache = loadDictCache();
  return _dictCache;
}

async function fetchDef(word) {
  const cache = getCache();
  const now = Date.now();
  const hit = cache[word];
  if (hit && (now - hit.t) < DICT_CACHE_TTL) {
    return hit.entries;
  }

  // 1·2단: 서버 API
  let entries = [];
  try {
    const r = await fetch('/api/dict?word=' + encodeURIComponent(word));
    if (r.ok) {
      const data = await r.json();
      entries = data.entries || [];
    }
  } catch { /* offline 등 */ }

  // 3단: customDefs
  if (entries.length === 0 && typeof CUSTOM_DEFS !== 'undefined' && CUSTOM_DEFS[word]) {
    entries = CUSTOM_DEFS[word];
  }

  cache[word] = { t: now, entries };
  saveDictCache(cache);
  return entries;
}

const POS_COLORS = {
  '명사': '#3b82f6',
  '대명사': '#06b6d4',
  '수사': '#10b981',
  '동사': '#ef4444',
  '형용사': '#f59e0b',
  '관형사': '#a855f7',
  '부사': '#ec4899',
  '조사': '#6b7280',
  '감탄사': '#f97316',
};

function posColor(pos) {
  if (!pos) return '#6b7280';
  for (const k of Object.keys(POS_COLORS)) {
    if (pos.includes(k)) return POS_COLORS[k];
  }
  return '#6b7280';
}

function escapeHTML(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function renderDefHTML(word, entries) {
  if (!entries || entries.length === 0) return '';
  const parts = entries.slice(0, 5).map((e, i) => {
    const num = entries.length > 1 ? `<span class="def-num">${i+1}</span>` : '';
    const pos = e.pos ? `<span class="def-pos" style="background:${posColor(e.pos)}">[${escapeHTML(e.pos)}]</span>` : '';
    const hanja = e.hanja ? `<span class="def-hanja">(${escapeHTML(e.hanja)})</span>` : '';
    return `${num}${pos} <span class="def-word">${escapeHTML(word)}</span>${hanja}: <span class="def-text">${escapeHTML(e.def)}</span>`;
  });
  return parts.join('<br>');
}

async function showWordDefinition(targetEl, word) {
  if (!targetEl) return;
  targetEl.innerHTML = '';
  targetEl.style.display = 'none';
  if (!word) return;
  try {
    const entries = await fetchDef(word);
    if (!entries || entries.length === 0) return;
    targetEl.innerHTML = renderDefHTML(word, entries);
    targetEl.style.display = 'block';
  } catch { /* 무시 */ }
}
