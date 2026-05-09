// ==================== ENGLISH WORD CHAIN ====================
// 사전 파싱: ENG_RAW_BY_FIRST → ENG_WORD_DB ({first: [{w,d}, ...]}), ENG_ALL_WORDS (Set)

const ENG_WORD_DB = {};
const ENG_ALL_WORDS = new Set();

(function _engParse() {
  if (typeof ENG_RAW_BY_FIRST === 'undefined') return;
  for (const [letter, str] of Object.entries(ENG_RAW_BY_FIRST)) {
    const words = str.split('|');
    if (!ENG_WORD_DB[letter]) ENG_WORD_DB[letter] = [];
    for (const w of words) {
      if (!w) continue;
      const len = w.length;
      // 한글의 d(난이도)와 호환: 짧을수록 쉬움
      const d = len <= 3 ? 1 : len <= 4 ? 2 : len <= 5 ? 3 : len <= 7 ? 4 : 5;
      ENG_WORD_DB[letter].push({ w, d });
      ENG_ALL_WORDS.add(w);
    }
  }
})();

// ===== 게임 도우미 =====
function engFindWordsStartingWith(letter) {
  const c = String(letter || '').toLowerCase();
  return ENG_WORD_DB[c] || [];
}

function engIsValidWord(word) {
  return ENG_ALL_WORDS.has(String(word || '').toLowerCase());
}

function engIsStandardWord(word) {
  // 영어는 표준/어인정 구분 없음 — 모두 표준 처리
  return engIsValidWord(word);
}

function engIsValidChain(lastChar, word) {
  if (!lastChar || !word) return false;
  return String(word).toLowerCase()[0] === String(lastChar).toLowerCase();
}

// 시작 단어: 이어쓰기 가능한 흔한 짧은 단어 (한 번 계산해서 캐시)
let _engEasyStarts = null;
function engGetRandomStartWord() {
  if (!_engEasyStarts) {
    // 글자별 단어 수 미리 계산
    const counts = {};
    for (const letter in ENG_WORD_DB) counts[letter] = ENG_WORD_DB[letter].length;
    const easy = [];
    for (const letter in ENG_WORD_DB) {
      for (const entry of ENG_WORD_DB[letter]) {
        if (entry.d <= 2 && (counts[entry.w[entry.w.length - 1]] || 0) >= 50) {
          easy.push(entry.w);
        }
      }
    }
    if (easy.length === 0) {
      for (const letter in ENG_WORD_DB) {
        for (const entry of ENG_WORD_DB[letter]) {
          if (entry.w.length >= 3 && entry.w.length <= 5) easy.push(entry.w);
        }
      }
    }
    _engEasyStarts = easy;
  }
  return _engEasyStarts[Math.floor(Math.random() * _engEasyStarts.length)];
}
