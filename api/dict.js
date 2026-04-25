const STD_KEY = process.env.STDICT_KEY || '8FF1A0F93521C863F6A383EBEB89316B';
const URI_KEY = process.env.URIMAL_KEY || '895FC83D707BF94E8F89F400627B8395';

async function fetchStd(word) {
  const url = `https://stdict.korean.go.kr/api/search.do?key=${STD_KEY}&q=${encodeURIComponent(word)}&req_type=json&advanced=y&method=exact`;
  const r = await fetch(url);
  if (!r.ok) return null;
  return r.json();
}

async function fetchUri(word) {
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

export default async function handler(req, res) {
  const word = (req.query.word || '').trim();
  if (!word) {
    res.status(400).json({ error: 'missing word' });
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
