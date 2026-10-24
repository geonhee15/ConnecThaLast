// 국립국어원 Open API 키 — 코드에 넣지 말고 Vercel 환경변수로만 설정 (.env.example 참고)
const STD_KEY = process.env.STDICT_KEY || '';
const URI_KEY = process.env.URIMAL_KEY || '';

async function fetchStd(word) {
  if (!STD_KEY) return null;
  const url = `https://stdict.korean.go.kr/api/search.do?key=${STD_KEY}&q=${encodeURIComponent(word)}&req_type=json&advanced=y&method=exact`;
  const r = await fetch(url);
  if (!r.ok) return null;
  return r.json();
}

async function fetchUri(word) {
  if (!URI_KEY) return null;
  const url = `https://opendict.korean.go.kr/api/search?key=${URI_KEY}&q=${encodeURIComponent(word)}&req_type=json&advanced=y&method=exact`;
  const r = await fetch(url);
  if (!r.ok) return null;
  return r.json();
}

function parseStd(data) {
  if (!data?.channel?.item) return [];
  const items = Array.isArray(data.channel.item) ? data.channel.item : [data.channel.item];
  return items.map(it => {
    const senses = Array.isArray(it.sense) ? it.sense : [it.sense].filter(Boolean);
    return senses.map(s => ({
      pos: s.pos || it.pos || '명사',
      hanja: it.word ? (it.word.replace(/[ㄱ-ㅎㅏ-ㅣ가-힣\s\-\^]/g, '').trim() || null) : null,
      def: s.definition || ''
    })).filter(x => x.def);
  }).flat();
}

function parseUri(data) {
  if (!data?.channel?.item) return [];
  const items = Array.isArray(data.channel.item) ? data.channel.item : [data.channel.item];
  return items.map(it => {
    const senses = Array.isArray(it.sense) ? it.sense : [it.sense].filter(Boolean);
    return senses.map(s => ({
      pos: s.pos || it.pos || '명사',
      hanja: it.word ? (it.word.replace(/[ㄱ-ㅎㅏ-ㅣ가-힣\s\-\^]/g, '').trim() || null) : null,
      def: s.definition || ''
    })).filter(x => x.def);
  }).flat();
}

// ===== 영어 (v3.3.0+) =====
// 1) Free Dictionary API (dictionaryapi.dev): 평문 정의. 브라우저에서 Origin 헤더를 붙여 호출하면
//    530 으로 거부되므로 반드시 서버에서만 호출한다.
// 2) Wiktionary REST: 1)에 없거나 1)이 죽었을 때 폴백. 정의가 HTML 이라 태그를 제거한다.
const EN_MAX_DEFS = 5;
const EN_UA = 'ConnecThaLast/3.3 (https://connecthalast.vercel.app)';

function stripHTML(s) {
  return String(s || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

// 반환: entries 배열 (없으면 []), 일시 오류면 null
async function fetchEnFreeDict(word) {
  const r = await fetch('https://api.dictionaryapi.dev/api/v2/entries/en/' + encodeURIComponent(word));
  if (r.status === 404) return [];
  if (!r.ok) return null;
  const data = await r.json();
  const out = [];
  for (const item of (Array.isArray(data) ? data : [])) {
    for (const m of (item.meanings || [])) {
      for (const d of (m.definitions || [])) {
        if (!d.definition) continue;
        out.push({ pos: m.partOfSpeech || '', hanja: null, def: d.definition });
        if (out.length >= EN_MAX_DEFS) return out;
      }
    }
  }
  return out;
}

async function fetchEnWiktionary(word) {
  const r = await fetch('https://en.wiktionary.org/api/rest_v1/page/definition/' + encodeURIComponent(word), {
    headers: { 'User-Agent': EN_UA, 'Accept': 'application/json' }
  });
  if (r.status === 404) return [];
  if (!r.ok) return null;
  const data = await r.json();
  const out = [];
  for (const block of (data.en || [])) {
    for (const d of (block.definitions || [])) {
      const def = stripHTML(d.definition);
      if (!def) continue;
      out.push({ pos: String(block.partOfSpeech || '').toLowerCase(), hanja: null, def });
      if (out.length >= EN_MAX_DEFS) return out;
    }
  }
  return out;
}

async function handleEnglish(word, res) {
  const w = word.toLowerCase();
  if (!/^[a-z]+$/.test(w)) {
    res.status(400).json({ error: 'invalid english word' });
    return;
  }
  const safe = (p) => p.catch(() => null);
  const fd = await safe(fetchEnFreeDict(w));
  let entries = (fd && fd.length) ? fd : null;
  let source = entries ? 'freedict' : 'none';
  let wk = null;
  if (!entries) {
    wk = await safe(fetchEnWiktionary(w));
    if (wk && wk.length) { entries = wk; source = 'wiktionary'; }
  }
  if (!entries && fd === null && wk === null) {
    // 두 소스 모두 일시 오류 → 캐시하지 않음 (클라이언트도 캐시하지 않도록 transient 표시)
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ source: 'none', entries: [], transient: true });
    return;
  }
  res.setHeader('Cache-Control', 's-maxage=2592000, stale-while-revalidate');
  res.status(200).json({ source, entries: entries || [] });
}

export default async function handler(req, res) {
  const word = (req.query.word || '').trim();
  const lang = String(req.query.lang || 'ko').toLowerCase();
  if (!word) {
    res.status(400).json({ error: 'missing word' });
    return;
  }

  if (lang === 'en') {
    try { await handleEnglish(word, res); }
    catch (e) { res.status(500).json({ error: e.message }); }
    return;
  }

  if (!STD_KEY && !URI_KEY) {
    // 키가 없으면 캐시하지 않고 바로 실패 → 클라이언트는 customDefs 로 폴백
    res.status(500).json({ error: 'dictionary API keys not configured (STDICT_KEY / URIMAL_KEY)' });
    return;
  }

  res.setHeader('Cache-Control', 's-maxage=2592000, stale-while-revalidate');

  try {
    const std = await fetchStd(word);
    let entries = parseStd(std);
    if (entries.length > 0) {
      res.status(200).json({ source: 'std', entries });
      return;
    }
    const uri = await fetchUri(word);
    entries = parseUri(uri);
    if (entries.length > 0) {
      res.status(200).json({ source: 'uri', entries });
      return;
    }
    res.status(200).json({ source: 'none', entries: [] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
