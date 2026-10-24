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

// v3.3.0+: 영어 단어 뜻 — 서버(/api/dict?lang=en)가 Free Dictionary API → Wiktionary 순으로 조회
// (dictionaryapi.dev 는 브라우저 직접 호출을 거부하므로 서버 경유 필수)
const DICT_EN_CACHE_KEY = 'dictCacheEn_v1';
let _dictCacheEn = null;

function isEnglishWord(word) {
  return /^[a-z]+$/i.test(String(word || ''));
}

function getCacheEn() {
  if (!_dictCacheEn) {
    try { _dictCacheEn = JSON.parse(localStorage.getItem(DICT_EN_CACHE_KEY) || '{}'); }
    catch { _dictCacheEn = {}; }
  }
  return _dictCacheEn;
}

async function fetchDefEn(word) {
  const w = String(word).toLowerCase();
  const cache = getCacheEn();
  const now = Date.now();
  const hit = cache[w];
  if (hit && (now - hit.t) < DICT_CACHE_TTL) return hit.entries;

  let entries = [];
  try {
    const r = await fetch('/api/dict?lang=en&word=' + encodeURIComponent(w));
    if (!r.ok) return []; // 서버 오류는 캐시하지 않음
    const data = await r.json();
    if (data.transient) return []; // 상위 사전 일시 오류 → 다음에 다시 시도
    entries = data.entries || [];
  } catch { return []; } // 오프라인 등

  cache[w] = { t: now, entries };
  try { localStorage.setItem(DICT_EN_CACHE_KEY, JSON.stringify(cache)); } catch { /* quota exceeded - 무시 */ }
  return entries;
}

async function fetchDef(word) {
  if (isEnglishWord(word)) return fetchDefEn(word); // v3.3.0+: 영어는 별도 경로
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
  // v3.3.0+: 영어 품사 (includes 매칭이라 pronoun→noun, adverb→verb 보다 먼저 와야 함)
  'pronoun': '#06b6d4',
  'adverb': '#ec4899',
  'adjective': '#f59e0b',
  'noun': '#3b82f6',
  'verb': '#ef4444',
  'preposition': '#6b7280',
  'conjunction': '#6b7280',
  'interjection': '#f97316',
  'numeral': '#10b981',
  'determiner': '#a855f7',
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
