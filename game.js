// ==================== PROFILE / LEVEL SYSTEM ====================
const profile = {
  nickname: '플레이어',
  userId: '',
  level: 1,
  exp: 0,
  totalExp: 0,
  wins: 0,
  losses: 0
};

function generateUserId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let id = '';
  for (let i = 0; i < 8; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

// 레벨별 필요 경험치: 1→2 = 100, 이후 레벨당 +5씩 증가
function expForLevel(level) {
  return 100 + (level - 1) * 5;
}

// 경험치 테이블 (봇 레벨별 승/패)
const EXP_TABLE = {
  1: { win: 5,  lose: 0  }, // 초보봇
  2: { win: 10, lose: 5  }, // 중수봇
  3: { win: 15, lose: 10 }, // 고수봇
  4: { win: 18, lose: 10 }, // 좀고수봇
  5: { win: 20, lose: 10 }, // 초고수봇
  6: { win: 40, lose: 5  }, // 신봇
  7: { win: 5,  lose: 0  }  // 롱봇
};

function loadProfile() {
  try {
    const saved = localStorage.getItem('connecthalast_profile');
    if (saved) {
      const data = JSON.parse(saved);
      Object.assign(profile, data);
    }
  } catch (e) {}
  // userId가 없으면 랜덤 생성
  if (!profile.userId) {
    profile.userId = generateUserId();
    saveProfile();
  }
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

function getRoleBadge(nickname) {
  if (nickname === '김건') return 'Owner.png';
  if (nickname === '억만장자') return 'Admin.png';
  return 'User.png';
}

function roleBadgeHTML(nickname, size) {
  const s = size || 16;
  return `<img src="${getRoleBadge(nickname)}" class="role-badge" style="height:${s}px">`;
}

function getLevelIcon(level) {
  if (level >= 100) return '100-.png';
  if (level >= 50) return '50-99.png';
  if (level >= 25) return '25-49.png';
  if (level >= 10) return '10-24.png';
  return '1-9.png';
}

function renderLevelBadge(containerId, level) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const noShadow = level >= 25 ? ' no-shadow' : '';
  const smallText = level >= 100 ? ' small-text' : '';
  el.innerHTML = `<img src="${getLevelIcon(level)}" class="level-icon-img"><span class="level-icon-num${noShadow}${smallText}">${level}</span>`;
}

function updateProfileUI() {
  const p = getActiveProfile();
  const needed = expForLevel(p.level);
  const pct = Math.min(100, (p.exp / needed) * 100);

  // DEV만 테스트 서버 버튼 표시 (일반 서버일 때만)
  const testBtn = document.getElementById('btn-test-server');
  if (testBtn) testBtn.style.display = (profile.userId === 'DEV' && serverMode === 'normal') ? '' : 'none';

  // 홈 화면 (활성 프로필 기준)
  const homeNick = document.getElementById('home-nickname');
  const homeUid = document.getElementById('home-userid');
  const homeExpBar = document.getElementById('home-exp-bar');
  const homeExpText = document.getElementById('home-exp-text');
  if (homeNick) homeNick.innerHTML = p.nickname + ' ' + roleBadgeHTML(p.nickname, 28);
  if (homeUid) homeUid.textContent = '#' + p.userId;
  if (homeExpBar) homeExpBar.style.width = pct + '%';
  if (homeExpText) homeExpText.textContent = `${p.exp} / ${needed}`;
  renderLevelBadge('home-level-badge', p.level);

  // 프로필 화면 (활성 프로필 기준)
  const profExpBar = document.getElementById('profile-exp-bar');
  const profExpText = document.getElementById('profile-exp-text');
  const profNickDisplay = document.getElementById('profile-nickname-display');
  const profUid = document.getElementById('profile-userid');
  const statWins = document.getElementById('stat-wins');
  const statLosses = document.getElementById('stat-losses');
  const statTotalExp = document.getElementById('stat-total-exp');

  renderLevelBadge('profile-level-badge', p.level);
  if (profExpBar) profExpBar.style.width = pct + '%';
  if (profExpText) profExpText.textContent = `${p.exp} / ${needed} EXP`;
  if (profNickDisplay) profNickDisplay.innerHTML = p.nickname + ' ' + roleBadgeHTML(p.nickname, 40);
  if (profUid) profUid.textContent = '#' + p.userId;
  if (statWins) statWins.textContent = p.wins;
  if (statLosses) statLosses.textContent = p.losses;
  if (statTotalExp) statTotalExp.textContent = p.totalExp;
  const statWinrate = document.getElementById('stat-winrate');
  if (statWinrate) {
    const total = p.wins + p.losses;
    statWinrate.textContent = total > 0 ? Math.round((p.wins / total) * 100) + '%' : '0%';
  }

  // 게임 화면 플레이어 이름
  const playerNames = document.querySelectorAll('.player-me .player-name');
  playerNames.forEach(el => el.innerHTML = p.nickname + ' ' + roleBadgeHTML(p.nickname, 24));
}

// 서버 모드: 'normal' or 'test'
let serverMode = 'normal';
let testProfile = null;

function enterTestServer() {
  serverMode = 'test';
  testProfile = {
    nickname: '테스트유저',
    userId: 'T-' + generateUserId(),
    level: 1,
    exp: 0,
    totalExp: 0,
    wins: 0,
    losses: 0
  };

  // UI 업데이트
  document.getElementById('home-server-badge').textContent = '서버: 테스트';
  document.getElementById('home-server-badge').className = 'server-badge test';
  document.getElementById('test-back-btn').style.display = '';
  document.getElementById('test-panel').style.display = 'block';
  document.getElementById('test-uid').value = testProfile.userId;
  document.getElementById('test-level').value = testProfile.level;
  document.getElementById('btn-test-server').style.display = 'none';

  updateProfileUI();
}

function exitTestServer() {
  serverMode = 'normal';
  testProfile = null;

  document.getElementById('home-server-badge').textContent = '서버: 일반';
  document.getElementById('home-server-badge').className = 'server-badge';
  document.getElementById('test-back-btn').style.display = 'none';
  document.getElementById('test-panel').style.display = 'none';

  updateProfileUI();
}

function applyTestLevel() {
  if (!testProfile) return;
  const input = document.getElementById('test-level');
  let lv = parseInt(input.value) || 1;
  if (lv < 1) lv = 1;
  testProfile.level = lv;
  testProfile.exp = 0;
  input.value = lv;
  updateProfileUI();
}

function getActiveProfile() {
  return serverMode === 'test' && testProfile ? testProfile : profile;
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
  gameActive: false,
  bonusExp: 0,
  killerFinish: false,
  // 라운드 시스템
  totalRounds: 1,
  currentRound: 1,
  playerRoundWins: 0,
  botRoundWins: 0
};

let selectedBotRounds = 1;

function selectBotRound(n, btn) {
  selectedBotRounds = n;
  document.querySelectorAll('#bot-round-btns .round-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

// ==================== MODE SYSTEM ====================
const modes = {
  manner: false,   // 매너: 한방단어 금지
  noda: false,     // ~다 금지
  injeong: true    // 어인정: 비표준 단어 허용 (기본 ON)
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

const BOT_NAMES = ['', '초보봇', '중수봇', '고수봇', '좀고수봇', '초고수봇', '신봇', '롱봇'];
const BOT_AVATARS = ['', '🤖', '🤖', '🤖', '🤖', '🤖', '👹', '🐉'];

const BOT_CONFIG = {
  1: { maxDiff: 2, thinkMin: 3000, thinkMax: 5000, failChance: 0.15 },
  2: { maxDiff: 3, thinkMin: 2000, thinkMax: 3500, failChance: 0.08 },
  3: { maxDiff: 4, thinkMin: 1200, thinkMax: 2200, failChance: 0.03 },
  4: { maxDiff: 5, thinkMin: 800,  thinkMax: 1500, failChance: 0.01 },  // 좀고수봇
  5: { maxDiff: 5, thinkMin: 600,  thinkMax: 1200, failChance: 0.01 },
  6: { maxDiff: 5, thinkMin: 200,  thinkMax: 500,  failChance: 0,   playerFirst: true },
  7: { maxDiff: 5, thinkMin: 400,  thinkMax: 800,  failChance: 0.02 }
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
let audioLoaded = false;
function preloadAudio() {
  if (audioLoaded) return Promise.resolve();

  const promises = [];
  for (const [key, filename] of Object.entries(WAV_FILES)) {
    if (audioPool[key]) continue; // 이미 로드됨
    promises.push(new Promise((resolve) => {
      const audio = new Audio(filename);
      audio.preload = 'auto';
      audio.addEventListener('canplaythrough', () => {
        audioPool[key] = audio;
        resolve();
      }, { once: true });
      audio.addEventListener('error', () => resolve(), { once: true });
      // 3초 타임아웃 - 절대 멈추지 않게
      setTimeout(resolve, 3000);
      audio.load();
    }));
  }

  return Promise.all(promises).then(() => {
    audioLoaded = true;
    console.log('Audio loaded:', Object.keys(audioPool));
  });
}

// 현재 재생 중인 메인 사운드 (겹침 방지)
let currentSound = null;

function playSound(key, rate = 1.0) {
  const original = audioPool[key];
  if (!original) return null;
  // 이전 사운드 정지
  if (currentSound) {
    try { currentSound.pause(); currentSound.currentTime = 0; } catch(e) {}
  }
  const clone = original.cloneNode();
  clone.volume = 1.0;
  clone.playbackRate = rate;
  clone.play().catch(() => {});
  currentSound = clone;
  return clone;
}

// 턴 수에 따른 배속 계산 (10초=1.0x, 줄어들수록 빨라짐)
function getRhythmSpeed() {
  // timerMax: 10 → 1.0x, 8 → 1.05x, 6 → 1.1x, 4 → 1.2x, 2 → 1.4x
  return 1.0 + (10 - state.timerMax) * 0.05;
}

// KICK.wav를 지정 시간(ms) 후에 재생
function playKickAt(delayMs) {
  setTimeout(() => {
    playSound('kick');
  }, delayMs);
}

// ==================== RHYTHM SYSTEM ====================

function playWordAnimation(word, callback, targetElId) {
  state.isAnimating = true;
  const wordEl = document.getElementById(targetElId || 'current-word');
  const chars = word.split('');
  const n = chars.length;

  // 글자별 span 생성 (숨겨진 상태)
  wordEl.innerHTML = chars.map((c, i) =>
    `<span class="char" data-idx="${i}">${c}</span>`
  ).join('');

  const speed = getRhythmSpeed();
  const sc = 1 / speed; // 시간 스케일 (빠를수록 짧아짐)

  if (n >= 2 && n <= 7) {
    // ===== 2~7글자: 해당 WAV 파일 재생 + 파형 비트에 맞춰 글자 등장 =====
    playSound(String(n), speed);

    const charBeats = WAV_CHAR_BEATS[n];

    charBeats.forEach((beatTime, i) => {
      setTimeout(() => {
        revealChar(wordEl, i);
      }, beatTime * 1000 * sc);
    });

    FINALE_BEATS.forEach((beatTime, i) => {
      setTimeout(() => {
        pulseAllChars(wordEl, i);
      }, beatTime * 1000 * sc);
    });

    const totalTime = FINALE_BEATS[2] * 1000 * sc + 400;
    setTimeout(() => {
      wordEl.classList.remove('finale-pulse');
      state.isAnimating = false;
      if (callback) callback();
    }, totalTime);

  } else if (n >= 8) {
    // ===== 8글자 이상: KICK 4박자 + Only-Lastpart 동시 재생 =====

    playSound('lastpart', speed);

    // N개 글자를 4박자(0~1.282초)에 분배 (배속 적용)
    const totalCharTime = 1282 * sc;
    const charTimings = [];
    for (let i = 0; i < n; i++) {
      charTimings.push(Math.round((i / (n - 1)) * totalCharTime));
    }

    charTimings.forEach((tMs, i) => {
      playKickAt(tMs);
      setTimeout(() => {
        revealChar(wordEl, i);
      }, tMs);
    });

    FINALE_BEATS.forEach((beatTime, i) => {
      setTimeout(() => {
        pulseAllChars(wordEl, i);
      }, beatTime * 1000 * sc);
    });

    const totalTime = FINALE_BEATS[2] * 1000 * sc + 400;
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
  state.bonusExp = 0;
  state.killerFinish = false;
  state.totalRounds = selectedBotRounds;
  state.currentRound = 1;
  state.playerRoundWins = 0;
  state.botRoundWins = 0;

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
  updateBotRoundDisplay();

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
    // 봇이 못 이으면 한방단어로 끝낸 것
    state.killerFinish = true;
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

let submitLock = false;
function submitWord() {
  if (!state.gameActive || !state.isPlayerTurn || state.isAnimating || submitLock) return;
  submitLock = true;
  setTimeout(() => { submitLock = false; }, 500);

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
  updateBotRoundDisplay();

  // 긴단어 보너스 경험치: 5글자+1, 6글자+2, 7글자+3...
  if (word.length >= 5) {
    state.bonusExp += (word.length - 4);
  }

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
    updateBotRoundDisplay();

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

  // 첫 턴에는 모든 봇 한방단어 금지
  if (state.turnCount <= 1) {
    const safe = candidates.filter(e => !isKillerWord(e.w));
    if (safe.length > 0) candidates = safe;
  }

  // 매너 모드: 봇도 한방단어 금지
  if (modes.manner) {
    const safe = candidates.filter(e => !isKillerWord(e.w));
    if (safe.length > 0) candidates = safe;
  }

  let filtered = candidates.filter(e => e.d <= config.maxDiff);
  if (filtered.length === 0) filtered = candidates;
  if (filtered.length === 0) return null;

  // === 롱봇 (레벨 7): 항상 가장 긴 단어 사용 ===
  if (state.botLevel === 7) {
    filtered.sort((a, b) => b.w.length - a.w.length);
    return filtered[0].w;
  }

  // === 신봇 (레벨 6): 긴단어 60% + 한방단어 40% ===
  if (state.botLevel === 6) {
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

  // === 초고수봇 (레벨 5): 한방단어 전략 ===
  if (state.botLevel === 5) {
    filtered.sort((a, b) => {
      const aNext = findWordsStartingWith(a.w[a.w.length - 1])
        .filter(e => !state.usedWords.has(e.w)).length;
      const bNext = findWordsStartingWith(b.w[b.w.length - 1])
        .filter(e => !state.usedWords.has(e.w)).length;
      return aNext - bNext;
    });
    return filtered[Math.floor(Math.random() * Math.min(3, filtered.length))].w;
  }

  // === 좀고수봇 (레벨 4): 단어 잘 찾지만 한방단어 회피 ===
  if (state.botLevel === 4) {
    // 한방단어 제외
    const safe = filtered.filter(e => !isKillerWord(e.w));
    const pool = safe.length > 0 ? safe : filtered;
    // 안전한 단어 중 랜덤 선택 (편향 방지)
    return pool[Math.floor(Math.random() * pool.length)].w;
  }

  // === 초보~고수: 랜덤 ===
  return filtered[Math.floor(Math.random() * filtered.length)].w;
}

// ==================== ROUND DISPLAY ====================
function updateBotRoundDisplay() {
  const el = document.getElementById('bot-round-display');
  if (!el) return;
  if (state.totalRounds > 1) {
    el.style.display = '';
    el.textContent = `라운드 ${state.currentRound} / ${state.totalRounds}`;
  } else {
    el.style.display = 'none';
  }
  // 점수 옆에 라운드 승수
  if (state.totalRounds > 1) {
    document.getElementById('score-player').textContent = `${state.playerScore}점 (${state.playerRoundWins}승)`;
    document.getElementById('score-bot').textContent = `${state.botScore}점 (${state.botRoundWins}승)`;
  } else {
    document.getElementById('score-player').textContent = state.playerScore + '점';
    document.getElementById('score-bot').textContent = state.botScore + '점';
  }
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

// ==================== GAMEOVER ACTIONS ====================
// 마지막 게임이 멀티였는지 추적
let lastGameWasMulti = false;

function gameoverRetry() {
  if (lastGameWasMulti && typeof multiRematch === 'function') {
    multiRematch();
  } else {
    showScreen('screen-select');
  }
}

function gameoverHome() {
  lastGameWasMulti = false;
  showScreen('screen-home');
}

// ==================== GAME END ====================
function endGame(playerWins, reason) {
  stopTimer();
  disableInput();

  // 라운드 승패 기록
  if (playerWins) state.playerRoundWins++;
  else state.botRoundWins++;

  // 다중 라운드: 아직 라운드 남았으면 다음 라운드
  if (state.totalRounds > 1 && state.currentRound < state.totalRounds) {
    const roundEl = document.getElementById('bot-round-display');
    if (roundEl) roundEl.textContent = `라운드 ${state.currentRound} 종료 - ${playerWins ? '승리!' : '패배'}`;
    updateBotRoundDisplay();

    setTimeout(() => {
      // 다음 라운드 시작
      state.currentRound++;
      state.usedWords = new Set();
      state.turnCount = 0;
      state.timerMax = 10;
      state.killerFinish = false;
      state.isAnimating = false;
      document.getElementById('used-words').innerHTML = '';
      document.getElementById('game-message').textContent = '';
      document.getElementById('word-input').value = '';
      document.getElementById('current-word').innerHTML = '';
      document.getElementById('next-char').innerHTML = '';

      const startWord = getRandomStartWord();
      showStartWord(startWord);
      updateBotRoundDisplay();
    }, 2000);
    return;
  }

  // 최종 게임 종료
  state.gameActive = false;
  gameFinishedProperly = true;
  lastGameWasMulti = false;

  let finalWin;
  if (state.totalRounds === 1) {
    finalWin = playerWins;
  } else {
    finalWin = state.playerRoundWins > state.botRoundWins;
  }

  // 경험치 계산
  const expEntry = EXP_TABLE[state.botLevel] || { win: 0, lose: 0 };
  let earnedExp = 0;
  if (state.turnCount >= 2 || state.totalRounds > 1) {
    // 기본 승/패 경험치
    earnedExp = finalWin ? expEntry.win : expEntry.lose;
    // 긴단어 보너스
    earnedExp += state.bonusExp;
    // 한방단어 보너스
    if (finalWin && state.killerFinish) earnedExp += 10;
    // 점수 비례 보너스: 총점의 5%를 경험치로
    earnedExp += Math.floor(state.playerScore * 0.05);
    // 다중 라운드 보너스: 라운드 승리 1회당 +3 EXP
    if (state.totalRounds > 1) {
      earnedExp += state.playerRoundWins * 3;
    }
  }

  const p = getActiveProfile();
  if (finalWin) p.wins++;
  else p.losses++;

  if (serverMode === 'test') {
    if (earnedExp > 0) {
      p.exp += earnedExp;
      p.totalExp += earnedExp;
      while (p.exp >= expForLevel(p.level)) {
        p.exp -= expForLevel(p.level);
        p.level++;
      }
    }
  } else {
    addExp(earnedExp);
  }

  setTimeout(() => {
    const title = document.getElementById('gameover-title');
    title.textContent = finalWin ? '승리!' : '패배...';
    title.className = 'gameover-title ' + (finalWin ? 'win' : 'lose');

    document.getElementById('final-player-score').textContent = state.playerScore + '점';
    document.getElementById('final-bot-score').textContent = state.botScore + '점';
    document.getElementById('final-bot-name').textContent = BOT_NAMES[state.botLevel];

    let reasonText = reason;
    if (state.totalRounds > 1) {
      reasonText = `${state.totalRounds}라운드 종료! (${state.playerRoundWins}승 ${state.botRoundWins}패) ` + reasonText;
    }
    document.getElementById('gameover-reason').textContent =
      reasonText + (earnedExp > 0 ? ` (+${earnedExp} EXP)` : ' (+0 EXP)');

    showScreen('screen-gameover');
  }, 800);
}

// ==================== RANKING ====================
async function openRanking() {
  showScreen('screen-ranking');
  const list = document.getElementById('ranking-list');
  list.innerHTML = '<div class="ranking-loading">불러오는 중...</div>';

  if (!db) {
    list.innerHTML = '<div class="ranking-loading">서버에 연결할 수 없습니다.</div>';
    return;
  }

  try {
    const snap = await db.ref('users').get();
    if (!snap.exists()) {
      list.innerHTML = '<div class="ranking-loading">등록된 유저가 없습니다.</div>';
      return;
    }

    const users = [];
    snap.forEach(child => {
      const u = child.val();
      users.push({
        nickname: u.nickname || child.key,
        level: u.level || 1,
        exp: u.exp || 0,
        totalExp: u.totalExp || 0,
        userId: u.userId || ''
      });
    });

    // 레벨 내림차순 → 같으면 경험치 내림차순
    users.sort((a, b) => b.level - a.level || b.totalExp - a.totalExp);

    const p = getActiveProfile();
    let html = `<div class="ranking-header"><span>순위</span><span>닉네임</span><span>레벨</span><span>경험치</span></div>`;

    users.forEach((u, i) => {
      const rank = i + 1;
      const isMe = u.userId === p.userId;
      const rankClass = rank === 1 ? 'gold' : rank === 2 ? 'silver' : rank === 3 ? 'bronze' : '';
      html += `<div class="ranking-row${isMe ? ' me' : ''}">
        <span class="rank-num ${rankClass}">${rank}</span>
        <span class="rank-name">${u.nickname} ${roleBadgeHTML(u.nickname, 28)}</span>
        <span class="rank-level">Lv.${u.level}</span>
        <span class="rank-exp">${u.totalExp.toLocaleString()}</span>
      </div>`;
    });

    list.innerHTML = html;
  } catch (e) {
    list.innerHTML = '<div class="ranking-loading">랭킹을 불러올 수 없습니다.</div>';
  }
}

// ==================== DICTIONARY ====================
let dictCache = null; // 정렬된 전체 단어 캐시
const DICT_PAGE_SIZE = 200;
let dictDisplayed = 0;
let dictFiltered = [];

function openDictionary() {
  // 첫 호출 시 캐시 생성
  if (!dictCache) {
    dictCache = Array.from(ALL_WORDS).sort();
  }
  // 필터 초기화
  document.getElementById('dict-search').value = '';
  document.getElementById('dict-start-char').value = '';
  document.getElementById('dict-length').value = '0';
  document.getElementById('dict-total').textContent = `총 ${dictCache.length.toLocaleString()}개`;

  showScreen('screen-dict');
  filterDictionary();
}

function filterDictionary() {
  const search = document.getElementById('dict-search').value.trim();
  const startChar = document.getElementById('dict-start-char').value.trim();
  const lengthVal = parseInt(document.getElementById('dict-length').value) || 0;

  dictFiltered = dictCache.filter(w => {
    if (search && !w.includes(search)) return false;
    if (startChar && w[0] !== startChar) return false;
    if (lengthVal > 0) {
      if (lengthVal === 7) { if (w.length < 7) return false; }
      else { if (w.length !== lengthVal) return false; }
    }
    return true;
  });

  document.getElementById('dict-result-count').textContent =
    `검색 결과: ${dictFiltered.length.toLocaleString()}개`;

  dictDisplayed = 0;
  document.getElementById('dict-list').innerHTML = '';
  loadMoreDict();
}

function loadMoreDict() {
  const list = document.getElementById('dict-list');
  const end = Math.min(dictDisplayed + DICT_PAGE_SIZE, dictFiltered.length);

  let html = '';
  for (let i = dictDisplayed; i < end; i++) {
    const w = dictFiltered[i];
    const cls = STD_WORDS.has(w) ? 'std' : 'inj';
    html += `<span class="dict-word ${cls}">${w}</span>`;
  }
  list.insertAdjacentHTML('beforeend', html);
  dictDisplayed = end;
}

// 스크롤 시 추가 로드
document.addEventListener('DOMContentLoaded', () => {
  const listEl = document.getElementById('dict-list');
  if (listEl) {
    listEl.addEventListener('scroll', () => {
      if (listEl.scrollTop + listEl.clientHeight >= listEl.scrollHeight - 50) {
        if (dictDisplayed < dictFiltered.length) {
          loadMoreDict();
        }
      }
    });
  }
});

// ==================== INPUT HANDLING ====================
document.addEventListener('DOMContentLoaded', () => {
  loadProfile();
  updateProfileUI();

  const input = document.getElementById('word-input');
  let composing = false;

  input.addEventListener('compositionstart', () => {
    composing = true;
  });

  input.addEventListener('compositionend', () => {
    composing = false;
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (composing || e.isComposing) return;
      // 약간의 딜레이로 compositionend 후 실행 보장
      setTimeout(() => submitWord(), 10);
    }
  });
});
