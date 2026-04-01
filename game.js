// ==================== PROFILE / LEVEL SYSTEM ====================
const profile = {
  nickname: '플레이어',
  level: 1,
  exp: 0,
  totalExp: 0,
  wins: 0,
  losses: 0
};

// 레벨별 필요 경험치: 1→2 = 100, 이후 레벨당 +5씩 증가
function expForLevel(level) {
  return 100 + (level - 1) * 5;
}

// 경험치 테이블 (봇 레벨별 승/패)
const EXP_TABLE = {
  1: { win: 5,  lose: 0  }, // 초보봇
  2: { win: 10, lose: 5  }, // 중수봇
  3: { win: 15, lose: 10 }, // 고수봇
  4: { win: 20, lose: 10 }, // 초고수봇
  5: { win: 40, lose: 5  }, // 신봇
  6: { win: 5,  lose: 0  }  // 롱봇
};

function loadProfile() {
  try {
    const saved = localStorage.getItem('connecthalast_profile');
    if (saved) {
      const data = JSON.parse(saved);
      Object.assign(profile, data);
    }
  } catch (e) {}
}

function saveProfile() {
  try {
    localStorage.setItem('connecthalast_profile', JSON.stringify(profile));
  } catch (e) {}
}

function addExp(amount) {
  if (amount <= 0) return;
  profile.exp += amount;
  profile.totalExp += amount;

  // 레벨업 체크
  while (profile.exp >= expForLevel(profile.level)) {
    profile.exp -= expForLevel(profile.level);
    profile.level++;
  }

  saveProfile();
  updateProfileUI();
}

function saveNickname() {
  const input = document.getElementById('profile-nickname-input');
  const name = input.value.trim();
  if (name.length > 0) {
    profile.nickname = name;
    saveProfile();
    updateProfileUI();
  }
}

function updateProfileUI() {
  // 홈 화면
  const homeNick = document.getElementById('home-nickname');
  const homeLevel = document.getElementById('home-level');
  const homeExpBar = document.getElementById('home-exp-bar');
  const homeExpText = document.getElementById('home-exp-text');
  if (homeNick) homeNick.textContent = profile.nickname;
  if (homeLevel) homeLevel.textContent = profile.level;
  const needed = expForLevel(profile.level);
  const pct = Math.min(100, (profile.exp / needed) * 100);
  if (homeExpBar) homeExpBar.style.width = pct + '%';
  if (homeExpText) homeExpText.textContent = `${profile.exp} / ${needed}`;

  // 프로필 화면
  const profLevel = document.getElementById('profile-level');
  const profExpBar = document.getElementById('profile-exp-bar');
  const profExpText = document.getElementById('profile-exp-text');
  const profInput = document.getElementById('profile-nickname-input');
  const statWins = document.getElementById('stat-wins');
  const statLosses = document.getElementById('stat-losses');
  const statTotalExp = document.getElementById('stat-total-exp');

  if (profLevel) profLevel.textContent = profile.level;
  if (profExpBar) profExpBar.style.width = pct + '%';
  if (profExpText) profExpText.textContent = `${profile.exp} / ${needed} EXP`;
  if (profInput && !profInput.matches(':focus')) profInput.value = profile.nickname;
  if (statWins) statWins.textContent = profile.wins;
  if (statLosses) statLosses.textContent = profile.losses;
  if (statTotalExp) statTotalExp.textContent = profile.totalExp;

  // 게임 화면 플레이어 이름
  const playerNames = document.querySelectorAll('.player-me .player-name');
  playerNames.forEach(el => el.textContent = profile.nickname);
}

// 새로고침 방지: 게임 중 나가면 경험치 0
let gameFinishedProperly = false;

window.addEventListener('beforeunload', () => {
  if (state.gameActive && !gameFinishedProperly) {
    // 게임 중 새로고침 → 경험치 없음 (아무것도 안 함)
    // 이미 경험치가 endGame에서만 지급되므로 자연히 0
  }
});

// ==================== GAME STATE ====================
const state = {
  botLevel: 1,
  currentWord: '',
  nextChar: '',
  usedWords: new Set(),
  playerScore: 0,
  botScore: 0,
  isPlayerTurn: true,
  timerMax: 10,
  timerLeft: 10,
  turnCount: 0,
  timerId: null,
  isAnimating: false,
  gameActive: false
};

// ==================== MODE SYSTEM ====================
const modes = {
  manner: false,   // 매너: 한방단어 금지
  noda: false,     // ~다 금지
  injeong: false   // 어인정: 비표준 단어 허용
};

const MODE_DESCS = {
  manner: '매너: 한방단어 금지 (이을 수 없는 글자로 끝나는 단어 사용 불가)',
  noda: '~다 금지: "다"로 끝나는 단어 사용 불가',
  injeong: '어인정: 게임/애니/노래 제목 등 비표준 단어 허용'
};

function toggleMode(mode) {
  modes[mode] = !modes[mode];
  const btn = document.getElementById('mode-' + mode);
  btn.classList.toggle('active', modes[mode]);

  // 설명 업데이트
  const active = Object.entries(modes).filter(([k, v]) => v).map(([k]) => MODE_DESCS[k]);
  document.getElementById('mode-desc-text').textContent =
    active.length > 0 ? active.join(' / ') : '모드를 선택하세요 (복수 선택 가능)';
}

// 한방단어 체크: 마지막 글자로 시작하는 단어가 2개 미만이면 한방
function isKillerWord(word) {
  const lastChar = word[word.length - 1];
  const nextWords = findWordsStartingWith(lastChar)
    .filter(e => !state.usedWords.has(e.w) && isModeValidWord(e.w));
  return nextWords.length < 2;
}

// 모드 기반 단어 유효성 체크
function isModeValidWord(word) {
  // 기본: DB에 존재하는지
  if (!modes.injeong) {
    // 어인정 OFF: 표준 단어만
    if (!isStandardWord(word)) return false;
  } else {
    // 어인정 ON: 모든 단어
    if (!isValidWord(word)) return false;
  }
  // ~다 금지
  if (modes.noda && word.endsWith('다')) return false;
  return true;
}

const BOT_NAMES = ['', '초보봇', '중수봇', '고수봇', '초고수봇', '신봇', '롱봇'];
const BOT_AVATARS = ['', '🤖', '🤖', '🤖', '🤖', '👹', '🐉'];

const BOT_CONFIG = {
  1: { maxDiff: 2, thinkMin: 3000, thinkMax: 5000, failChance: 0.15 },
  2: { maxDiff: 3, thinkMin: 2000, thinkMax: 3500, failChance: 0.08 },
  3: { maxDiff: 4, thinkMin: 1200, thinkMax: 2200, failChance: 0.03 },
  4: { maxDiff: 5, thinkMin: 600,  thinkMax: 1200, failChance: 0.01 },
  5: { maxDiff: 5, thinkMin: 200,  thinkMax: 500,  failChance: 0,   playerFirst: true },
  6: { maxDiff: 5, thinkMin: 400,  thinkMax: 800,  failChance: 0.02 }
};

// ==================== WAV AUDIO ENGINE ====================
// HTMLAudioElement 기반 (file:// 프로토콜 호환)

const WAV_CHAR_BEATS = {
  2: [0.01, 0.853],
  3: [0.01, 0.639, 1.282],
  4: [0.01, 0.639, 0.853, 1.282],
  5: [0.01, 0.21, 0.639, 0.853, 1.282],
  6: [0.01, 0.21, 0.424, 0.639, 0.853, 1.282],
  7: [0.01, 0.21, 0.424, 0.639, 0.853, 1.068, 1.282]
};
const FINALE_BEATS = [1.711, 2.14, 2.569]; // 땅땅땅!

const WAV_FILES = {
  2: '2-Letters.wav',
  3: '3-letters.wav',
  4: '4-letters.wav',
  5: '5-letters.wav',
  6: '6-letters.wav',
  7: '7-letters.wav',
  kick: 'KICK.wav',
  lastpart: 'Only-Lastpart.wav'
};

// 프리로드된 Audio 객체 저장
const audioPool = {};

// 모든 WAV 파일 프리로드 (HTMLAudioElement)
async function preloadAudio() {
  const promises = [];

  for (const [key, filename] of Object.entries(WAV_FILES)) {
    promises.push(new Promise((resolve) => {
      const audio = new Audio(filename);
      audio.preload = 'auto';
      audio.addEventListener('canplaythrough', () => {
        audioPool[key] = audio;
        resolve();
      }, { once: true });
      audio.addEventListener('error', (e) => {
        console.warn(`Failed to load ${filename}:`, e);
        resolve();
      }, { once: true });
      audio.load();
    }));
  }

  await Promise.all(promises);
  console.log('All audio loaded:', Object.keys(audioPool));
}

// WAV 재생 (매번 새 Audio 클론으로 중복 재생 가능)
function playSound(key) {
  const original = audioPool[key];
  if (!original) return null;
  const clone = original.cloneNode();
  clone.volume = 1.0;
  clone.play().catch(() => {});
  return clone;
}

// KICK.wav를 지정 시간(ms) 후에 재생
function playKickAt(delayMs) {
  setTimeout(() => {
    playSound('kick');
  }, delayMs);
}

// ==================== RHYTHM SYSTEM ====================

function playWordAnimation(word, callback) {
  state.isAnimating = true;
  const wordEl = document.getElementById('current-word');
  const chars = word.split('');
  const n = chars.length;

  // 글자별 span 생성 (숨겨진 상태)
  wordEl.innerHTML = chars.map((c, i) =>
    `<span class="char" data-idx="${i}">${c}</span>`
  ).join('');

  if (n >= 2 && n <= 7) {
    // ===== 2~7글자: 해당 WAV 파일 재생 + 파형 비트에 맞춰 글자 등장 =====
    playSound(String(n));

    const charBeats = WAV_CHAR_BEATS[n];

    charBeats.forEach((beatTime, i) => {
      setTimeout(() => {
        revealChar(wordEl, i);
      }, beatTime * 1000);
    });

    FINALE_BEATS.forEach((beatTime, i) => {
      setTimeout(() => {
        pulseAllChars(wordEl, i);
      }, beatTime * 1000);
    });

    const totalTime = FINALE_BEATS[2] * 1000 + 400;
    setTimeout(() => {
      wordEl.classList.remove('finale-pulse');
      state.isAnimating = false;
      if (callback) callback();
    }, totalTime);

  } else if (n >= 8) {
    // ===== 8글자 이상: KICK 4박자 + Only-Lastpart 동시 재생 =====

    // Only-Lastpart.wav 동시 재생 (피날레 땅땅땅! 포함)
    playSound('lastpart');

    // N개 글자를 4박자(0~1.282초)에 분배
    const totalCharTime = 1282; // ms
    const charTimings = [];
    for (let i = 0; i < n; i++) {
      charTimings.push(Math.round((i / (n - 1)) * totalCharTime));
    }

    // 각 글자마다 KICK 재생 + 글자 등장
    charTimings.forEach((tMs, i) => {
      playKickAt(tMs);
      setTimeout(() => {
        revealChar(wordEl, i);
      }, tMs);
    });

    // 피날레 애니메이션 동기화
    FINALE_BEATS.forEach((beatTime, i) => {
      setTimeout(() => {
        pulseAllChars(wordEl, i);
      }, beatTime * 1000);
    });

    const totalTime = FINALE_BEATS[2] * 1000 + 400;
    setTimeout(() => {
      wordEl.classList.remove('finale-pulse');
      state.isAnimating = false;
      if (callback) callback();
    }, totalTime);

  } else {
    // 1글자 (이론상 없지만 안전장치)
    revealChar(wordEl, 0);
    setTimeout(() => {
      state.isAnimating = false;
      if (callback) callback();
    }, 300);
  }
}

function revealChar(wordEl, idx) {
  const charEl = wordEl.querySelector(`[data-idx="${idx}"]`);
  if (charEl) {
    charEl.classList.add('visible');
    charEl.classList.add('pulse');
    setTimeout(() => charEl.classList.remove('pulse'), 150);
  }
}

function pulseAllChars(wordEl, finaleIdx) {
  const allChars = wordEl.querySelectorAll('.char');
  allChars.forEach(el => {
    el.classList.add('pulse');
    setTimeout(() => el.classList.remove('pulse'), 100);
  });

  // 마지막 피날레 비트에서 전체 확대 효과
  if (finaleIdx === 2) {
    wordEl.classList.add('finale-pulse');
  }
}

// ==================== SCREEN MANAGEMENT ====================
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  if (id === 'screen-profile' || id === 'screen-home') {
    updateProfileUI();
  }
}

// ==================== GAME FLOW ====================
async function startGame(level) {
  gameFinishedProperly = false;
  state.botLevel = level;
  state.playerScore = 0;
  state.botScore = 0;
  state.usedWords = new Set();
  state.turnCount = 0;
  state.timerMax = 10;
  state.gameActive = true;
  state.isAnimating = false;

  // UI 초기화
  document.getElementById('bot-name').textContent = BOT_NAMES[level];
  document.getElementById('bot-avatar').textContent = BOT_AVATARS[level];
  document.getElementById('score-player').textContent = '0점';
  document.getElementById('score-bot').textContent = '0점';
  document.getElementById('used-words').innerHTML = '';
  document.getElementById('game-message').textContent = '';
  document.getElementById('word-input').value = '';
  document.getElementById('current-word').innerHTML = '';
  document.getElementById('next-char').innerHTML = '';

  showScreen('screen-game');

  // WAV 파일 프리로드
  await preloadAudio();

  // 시작 단어 표시
  setTimeout(() => {
    const startWord = getRandomStartWord();
    showStartWord(startWord);
  }, 300);
}

function showStartWord(word) {
  state.currentWord = word;
  state.usedWords.add(word);
  addUsedWordTag(word, 'start');

  playWordAnimation(word, () => {
    const lastChar = word[word.length - 1];
    state.nextChar = lastChar;
    showNextCharHint(lastChar);

    // 선공 결정 (신봇은 항상 플레이어 선공)
    const config = BOT_CONFIG[state.botLevel];
    state.isPlayerTurn = config.playerFirst ? true : Math.random() > 0.5;
    state.turnCount = 1;
    state.timerMax = 10;

    if (state.isPlayerTurn) {
      startPlayerTurn();
    } else {
      startBotTurn();
    }
  });
}

function showNextCharHint(char) {
  const alternatives = getAlternativeChars(char);
  let hint = `다음 글자: <strong>${char}</strong>`;
  if (alternatives.length > 1) {
    hint += ` (${alternatives.slice(1).map(c => `<strong>${c}</strong>`).join(', ')} 가능)`;
  }
  document.getElementById('next-char').innerHTML = hint;
}

// ==================== TIMER ====================
function startTimer() {
  stopTimer();
  state.timerLeft = state.timerMax;
  updateTimerDisplay();

  const interval = 50;
  state.timerId = setInterval(() => {
    state.timerLeft -= interval / 1000;
    if (state.timerLeft <= 0) {
      state.timerLeft = 0;
      stopTimer();
      handleTimeout();
    }
    updateTimerDisplay();
  }, interval);
}

function stopTimer() {
  if (state.timerId) {
    clearInterval(state.timerId);
    state.timerId = null;
  }
}

function updateTimerDisplay() {
  const pct = Math.max(0, (state.timerLeft / state.timerMax) * 100);
  const bar = document.getElementById('timer-bar');
  const text = document.getElementById('timer-text');

  bar.style.width = pct + '%';
  text.textContent = state.timerLeft.toFixed(2) + 's';

  bar.classList.remove('warning', 'danger');
  text.classList.remove('warning', 'danger');

  if (state.timerLeft <= 2) {
    bar.classList.add('danger');
    text.classList.add('danger');
  } else if (state.timerLeft <= 4) {
    bar.classList.add('warning');
    text.classList.add('warning');
  }
}

function handleTimeout() {
  if (state.isPlayerTurn) {
    endGame(false, '시간 초과! 제한 시간 안에 단어를 입력하지 못했습니다.');
  } else {
    endGame(true, '봇이 시간 초과! 단어를 찾지 못했습니다.');
  }
}

// ==================== PLAYER TURN ====================
function startPlayerTurn() {
  state.isPlayerTurn = true;
  const turnInd = document.getElementById('turn-indicator');
  turnInd.textContent = '내 턴';
  turnInd.className = 'turn-indicator my-turn';

  const input = document.getElementById('word-input');
  const btn = document.getElementById('submit-btn');
  input.disabled = false;
  btn.disabled = false;
  input.focus();
  document.getElementById('game-message').textContent = '';

  startTimer();
}

function submitWord() {
  if (!state.gameActive || !state.isPlayerTurn || state.isAnimating) return;

  const input = document.getElementById('word-input');
  const word = input.value.trim();
  input.value = '';

  if (!word) return;

  const msg = validateWord(word);
  if (msg) {
    document.getElementById('game-message').textContent = msg;
    input.focus();
    return;
  }

  stopTimer();
  disableInput();

  const score = calculateScore(word);
  state.playerScore += score;
  document.getElementById('score-player').textContent = state.playerScore + '점';

  state.usedWords.add(word);
  addUsedWordTag(word, 'player');

  playWordAnimation(word, () => {
    const lastChar = word[word.length - 1];
    state.nextChar = lastChar;
    showNextCharHint(lastChar);
    nextTurn();
    startBotTurn();
  });
}

function validateWord(word) {
  if (word.length < 2) return '2글자 이상 입력하세요.';
  if (!isValidChain(state.nextChar, word)) {
    const alts = getAlternativeChars(state.nextChar);
    return `"${alts.join('" 또는 "')}"(으)로 시작하는 단어를 입력하세요.`;
  }
  if (state.usedWords.has(word)) return '이미 사용한 단어입니다.';
  // 어인정 모드 체크
  if (!modes.injeong) {
    if (!isStandardWord(word)) return '사전에 없는 단어입니다. (어인정 모드를 켜보세요)';
  } else {
    if (!isValidWord(word)) return '사전에 없는 단어입니다.';
  }
  // ~다 금지
  if (modes.noda && word.endsWith('다')) return '"다"로 끝나는 단어는 사용할 수 없습니다.';
  // 매너 모드: 한방단어 금지
  if (modes.manner && isKillerWord(word)) return '매너 모드: 한방단어는 사용할 수 없습니다.';
  return null;
}

function disableInput() {
  // 입력 필드는 항상 타이핑 가능 (상대 턴에 미리 준비 가능)
  // 제출 버튼만 비활성화
  document.getElementById('submit-btn').disabled = true;
}

// ==================== BOT TURN ====================
function startBotTurn() {
  state.isPlayerTurn = false;
  const turnInd = document.getElementById('turn-indicator');
  turnInd.textContent = BOT_NAMES[state.botLevel] + ' 턴';
  turnInd.className = 'turn-indicator bot-turn';

  // 입력 필드는 타이핑 가능 유지, 제출만 불가
  document.getElementById('word-input').disabled = false;
  disableInput();
  document.getElementById('game-message').textContent = '';

  startTimer();

  const config = BOT_CONFIG[state.botLevel];
  const botWord = chooseBotWord();

  if (!botWord || Math.random() < config.failChance) {
    return; // 타이머가 자동 처리
  }

  const thinkTime = config.thinkMin + Math.random() * (config.thinkMax - config.thinkMin);

  setTimeout(() => {
    if (!state.gameActive) return;
    stopTimer();

    const score = calculateScore(botWord);
    state.botScore += score;
    document.getElementById('score-bot').textContent = state.botScore + '점';

    state.usedWords.add(botWord);
    addUsedWordTag(botWord, 'bot');

    playWordAnimation(botWord, () => {
      const lastChar = botWord[botWord.length - 1];
      state.nextChar = lastChar;
      showNextCharHint(lastChar);
      nextTurn();
      startPlayerTurn();
    });
  }, Math.min(thinkTime, (state.timerMax - 0.5) * 1000));
}

function chooseBotWord() {
  const config = BOT_CONFIG[state.botLevel];
  let candidates = findWordsStartingWith(state.nextChar)
    .filter(entry => !state.usedWords.has(entry.w) && isModeValidWord(entry.w));

  // 매너 모드: 봇도 한방단어 금지
  if (modes.manner) {
    const safe = candidates.filter(e => !isKillerWord(e.w));
    if (safe.length > 0) candidates = safe;
  }

  let filtered = candidates.filter(e => e.d <= config.maxDiff);
  if (filtered.length === 0) filtered = candidates;
  if (filtered.length === 0) return null;

  // === 롱봇 (레벨 6): 항상 가장 긴 단어 사용 ===
  if (state.botLevel === 6) {
    filtered.sort((a, b) => b.w.length - a.w.length);
    return filtered[0].w;
  }

  // === 신봇 (레벨 5): 긴단어 60% + 한방단어 40% ===
  if (state.botLevel === 5) {
    const roll = Math.random();

    if (roll < 0.4) {
      // 40%: 한방단어 (상대가 이을 단어가 가장 적은 것)
      filtered.sort((a, b) => {
        const aNext = findWordsStartingWith(a.w[a.w.length - 1])
          .filter(e => !state.usedWords.has(e.w)).length;
        const bNext = findWordsStartingWith(b.w[b.w.length - 1])
          .filter(e => !state.usedWords.has(e.w)).length;
        return aNext - bNext;
      });
      return filtered[0].w;
    } else {
      // 60%: 긴 단어 우선 (점수 극대화)
      filtered.sort((a, b) => b.w.length - a.w.length);
      // 상위 10개 중 랜덤
      return filtered[Math.floor(Math.random() * Math.min(10, filtered.length))].w;
    }
  }

  // === 초고수봇 (레벨 4): 한방단어 전략 ===
  if (state.botLevel === 4) {
    filtered.sort((a, b) => {
      const aNext = findWordsStartingWith(a.w[a.w.length - 1])
        .filter(e => !state.usedWords.has(e.w)).length;
      const bNext = findWordsStartingWith(b.w[b.w.length - 1])
        .filter(e => !state.usedWords.has(e.w)).length;
      return aNext - bNext;
    });
    return filtered[Math.floor(Math.random() * Math.min(3, filtered.length))].w;
  }

  // === 초보~고수: 랜덤 ===
  return filtered[Math.floor(Math.random() * filtered.length)].w;
}

// ==================== SCORING ====================
function calculateScore(word) {
  const len = word.length;
  return 10 + Math.max(0, (len - 2)) * 5;
}

// ==================== TURN MANAGEMENT ====================
function nextTurn() {
  state.turnCount++;
  state.timerMax = Math.max(2, 10 - (state.turnCount - 1) * 0.25);
}

// ==================== USED WORDS UI ====================
function addUsedWordTag(word, type) {
  const container = document.getElementById('used-words');
  const tag = document.createElement('span');
  tag.className = `used-word-tag ${type}-word`;
  tag.textContent = word;
  container.appendChild(tag);
  container.scrollTop = container.scrollHeight;
}

// ==================== GAME END ====================
function endGame(playerWins, reason) {
  state.gameActive = false;
  gameFinishedProperly = true;
  stopTimer();
  disableInput();

  // 경험치 계산 (최소 1턴은 플레이해야 패배 경험치 지급)
  const expEntry = EXP_TABLE[state.botLevel] || { win: 0, lose: 0 };
  let earnedExp = 0;
  if (state.turnCount >= 2) {
    // 정상적으로 게임을 진행한 경우만 경험치 지급
    earnedExp = playerWins ? expEntry.win : expEntry.lose;
  }

  if (playerWins) profile.wins++;
  else profile.losses++;

  addExp(earnedExp);

  setTimeout(() => {
    const title = document.getElementById('gameover-title');
    title.textContent = playerWins ? '승리!' : '패배...';
    title.className = 'gameover-title ' + (playerWins ? 'win' : 'lose');

    document.getElementById('final-player-score').textContent = state.playerScore + '점';
    document.getElementById('final-bot-score').textContent = state.botScore + '점';
    document.getElementById('final-bot-name').textContent = BOT_NAMES[state.botLevel];
    document.getElementById('gameover-reason').textContent =
      reason + (earnedExp > 0 ? ` (+${earnedExp} EXP)` : ' (+0 EXP)');

    showScreen('screen-gameover');
  }, 800);
}

// ==================== INPUT HANDLING ====================
document.addEventListener('DOMContentLoaded', () => {
  loadProfile();
  updateProfileUI();

  const input = document.getElementById('word-input');
  let composing = false;
  let submitPending = false;

  input.addEventListener('compositionstart', () => {
    composing = true;
  });

  input.addEventListener('compositionend', () => {
    composing = false;
    // 조합 끝난 직후 대기 중인 제출이 있으면 실행
    if (submitPending) {
      submitPending = false;
      submitWord();
    }
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (composing || e.isComposing) {
        // 한글 조합 중이면 조합 끝난 후 제출 예약
        submitPending = true;
        return;
      }
      submitWord();
    }
  });
});
