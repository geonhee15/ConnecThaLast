// ==================== BOSS BATTLE SYSTEM ====================

const boss = {
  active: false,
  video: null,
  timerMax: 10,
  timerLeft: 10,
  timerId: null,
  turnCount: 0,
  usedWords: new Set(),
  nextChar: '',
  playerScore: 0,
  bossScore: 0,
  isPlayerTurn: true,
  isAnimating: false,
  gameStartTime: 0,   // 영상 시작 기준
  timeLimit: 6 * 60 + 55, // 6분 55초
  ended: false
};

// 보스전 WAV 파일 매핑
const BOSS_WAV_FILES = {
  2: 'Boss_2-Letters.wav',
  3: 'Boss_3-Letters.wav',
  4: 'Boss_4-Letters.wav',
  5: 'Boss_5-Letters.wav',
  6: 'Boss_6-Letters.wav',
  7: 'Boss_7-Letters.wav',
  kick: 'Boss_Intense.wav',
  lastpart: 'Boss_Lastpart.wav'
};

const bossAudioPool = {};
let bossAudioLoaded = false;

function preloadBossAudio() {
  if (bossAudioLoaded) return Promise.resolve();
  const promises = [];
  for (const [key, filename] of Object.entries(BOSS_WAV_FILES)) {
    if (bossAudioPool[key]) continue;
    promises.push(new Promise((resolve) => {
      const audio = new Audio(filename);
      audio.preload = 'auto';
      audio.addEventListener('canplaythrough', () => { bossAudioPool[key] = audio; resolve(); }, { once: true });
      audio.addEventListener('error', () => resolve(), { once: true });
      setTimeout(resolve, 3000);
      audio.load();
    }));
  }
  return Promise.all(promises).then(() => { bossAudioLoaded = true; });
}

let bossCurrentSound = null;
function playBossSound(key, rate = 1.0) {
  const original = bossAudioPool[key];
  if (!original) return null;
  if (bossCurrentSound) {
    try { bossCurrentSound.pause(); bossCurrentSound.currentTime = 0; } catch(e) {}
  }
  const clone = original.cloneNode();
  clone.volume = 1.0;
  clone.playbackRate = rate;
  clone.play().catch(() => {});
  bossCurrentSound = clone;
  return clone;
}

function playBossKickAt(delayMs) {
  setTimeout(() => {
    const original = bossAudioPool['kick'];
    if (!original) return;
    const clone = original.cloneNode();
    clone.volume = 1.0;
    clone.play().catch(() => {});
  }, delayMs);
}

// ==================== BOSS WORD ANIMATION ====================

function playBossWordAnimation(word, callback) {
  boss.isAnimating = true;
  const wordEl = document.getElementById('boss-current-word');
  const chars = word.split('');
  const n = chars.length;

  wordEl.innerHTML = chars.map((c, i) =>
    `<span class="char" data-idx="${i}">${c}</span>`
  ).join('');

  const speed = 1.0 + (10 - boss.timerMax) * 0.05;
  const sc = 1 / speed;

  if (n >= 2 && n <= 7) {
    playBossSound(String(n), speed);

    const charBeats = WAV_CHAR_BEATS[n];
    charBeats.forEach((beatTime, i) => {
      setTimeout(() => revealChar(wordEl, i), beatTime * 1000 * sc);
    });

    FINALE_BEATS.forEach((beatTime, i) => {
      setTimeout(() => pulseAllChars(wordEl, i), beatTime * 1000 * sc);
    });

    const totalTime = FINALE_BEATS[2] * 1000 * sc + 400;
    setTimeout(() => {
      wordEl.classList.remove('finale-pulse');
      boss.isAnimating = false;
      if (callback) callback();
    }, totalTime);

  } else if (n >= 8) {
    playBossSound('lastpart', speed);
    const totalCharTime = 1282 * sc;
    const charTimings = [];
    for (let i = 0; i < n; i++) {
      charTimings.push(Math.round((i / (n - 1)) * totalCharTime));
    }
    charTimings.forEach((tMs, i) => {
      playBossKickAt(tMs);
      setTimeout(() => revealChar(wordEl, i), tMs);
    });
    FINALE_BEATS.forEach((beatTime, i) => {
      setTimeout(() => pulseAllChars(wordEl, i), beatTime * 1000 * sc);
    });
    const totalTime = FINALE_BEATS[2] * 1000 * sc + 400;
    setTimeout(() => {
      wordEl.classList.remove('finale-pulse');
      boss.isAnimating = false;
      if (callback) callback();
    }, totalTime);
  }
}

// ==================== START BOSS ====================

function tryBossBattle() {
  const p = getActiveProfile();
  if (p.level < 10) {
    document.getElementById('boss-desc').textContent = `레벨이 부족합니다! (현재 Lv.${p.level})`;
    return;
  }
  startBossBattle();
}

async function startBossBattle() {
  boss.active = true;
  boss.ended = false;
  boss.usedWords = new Set();
  boss.turnCount = 0;
  boss.timerMax = 10;
  boss.playerScore = 0;
  boss.bossScore = 0;
  boss.isAnimating = false;

  preloadBossAudio();

  showScreen('screen-boss');

  // 풀스크린 비디오 시작
  const video = document.getElementById('boss-video');
  boss.video = video;
  video.src = 'Boss_IntroAndGameplay.mp4';
  video.muted = false;
  video.volume = 1.0;
  video.currentTime = 0;
  video.style.display = 'block';
  video.style.opacity = '1';
  video.load();
  const playPromise = video.play();
  if (playPromise) {
    playPromise.catch(() => {
      // 자동재생 차단 시 muted로 시작 후 클릭으로 unmute
      video.muted = true;
      video.play().catch(() => {});
      const unmute = () => {
        video.muted = false;
        document.removeEventListener('click', unmute);
      };
      document.addEventListener('click', unmute);
    });
  }

  boss.gameStartTime = Date.now();

  // 입력 UI 숨김
  document.getElementById('boss-game-ui').style.display = 'none';
  document.getElementById('boss-current-word').innerHTML = '';
  document.getElementById('boss-next-char').innerHTML = '';
  document.getElementById('boss-word-input').value = '';
  document.getElementById('boss-used-words').innerHTML = '';
  document.getElementById('boss-game-message').textContent = '';

  // 14초 후 게임 UI 표시 + 시작
  setTimeout(() => {
    if (!boss.active) return;
    document.getElementById('boss-game-ui').style.display = 'block';
    document.getElementById('boss-game-ui').style.animation = 'fadeIn 0.5s ease';

    const startWord = getRandomStartWord();
    boss.usedWords.add(startWord);
    boss.nextChar = startWord[startWord.length - 1];

    // 시작 단어 표시
    playBossWordAnimation(startWord, () => {
      showBossNextCharHint(boss.nextChar);
      boss.turnCount = 1;
      boss.timerMax = 10;
      boss.isPlayerTurn = true;
      startBossTimer();
      document.getElementById('boss-word-input').disabled = false;
      document.getElementById('boss-word-input').focus();
    });

    // 6분 55초 타이머
    boss.globalTimer = setTimeout(() => {
      if (boss.active && !boss.ended) {
        endBossBattle(false, '시간 초과!');
      }
    }, boss.timeLimit * 1000);
  }, 14000);
}

// ==================== BOSS TIMER ====================

function startBossTimer() {
  stopBossTimer();
  boss.timerLeft = boss.timerMax;
  updateBossTimerDisplay();

  boss.timerId = setInterval(() => {
    boss.timerLeft -= 0.05;
    if (boss.timerLeft <= 0) {
      boss.timerLeft = 0;
      stopBossTimer();
      if (boss.isPlayerTurn) {
        endBossBattle(false, '시간 초과!');
      } else {
        // 보스가 못 이음 → 승리
        endBossBattle(true, '보스가 단어를 찾지 못했습니다!');
      }
    }
    updateBossTimerDisplay();
  }, 50);
}

function stopBossTimer() {
  if (boss.timerId) {
    clearInterval(boss.timerId);
    boss.timerId = null;
  }
}

function updateBossTimerDisplay() {
  const bar = document.getElementById('boss-timer-bar');
  const text = document.getElementById('boss-timer-text');
  if (!bar || !text) return;
  const pct = Math.max(0, (boss.timerLeft / boss.timerMax) * 100);
  bar.style.width = pct + '%';
  text.textContent = boss.timerLeft.toFixed(2) + 's';
  bar.classList.remove('warning', 'danger');
  text.classList.remove('warning', 'danger');
  if (boss.timerLeft <= 2) { bar.classList.add('danger'); text.classList.add('danger'); }
  else if (boss.timerLeft <= 4) { bar.classList.add('warning'); text.classList.add('warning'); }
}

// ==================== BOSS NEXT CHAR HINT ====================

function showBossNextCharHint(char) {
  const alternatives = getAlternativeChars(char);
  let hint = `<strong>${char}</strong>`;
  if (alternatives.length > 1) {
    hint += ` (${alternatives.slice(1).map(c => `<strong>${c}</strong>`).join(', ')} 가능)`;
  }
  document.getElementById('boss-next-char').innerHTML = hint;
}

// ==================== PLAYER SUBMIT ====================

let bossSubmitLock = false;

function submitBossWord() {
  if (!boss.active || !boss.isPlayerTurn || boss.isAnimating || bossSubmitLock || boss.ended) return;
  bossSubmitLock = true;
  setTimeout(() => { bossSubmitLock = false; }, 500);

  const input = document.getElementById('boss-word-input');
  const word = input.value.trim();
  input.value = '';

  if (!word) return;

  // 유효성 검사
  if (word.length < 2) { document.getElementById('boss-game-message').textContent = '2글자 이상 입력하세요.'; return; }
  if (!isValidWord(word)) { document.getElementById('boss-game-message').textContent = '사전에 없는 단어입니다.'; return; }
  if (boss.usedWords.has(word)) { document.getElementById('boss-game-message').textContent = '이미 사용한 단어입니다.'; return; }
  if (!isValidChain(boss.nextChar, word)) {
    const alts = getAlternativeChars(boss.nextChar);
    document.getElementById('boss-game-message').textContent = `"${alts.join('" 또는 "')}"(으)로 시작하는 단어를 입력하세요.`;
    return;
  }

  stopBossTimer();
  document.getElementById('boss-game-message').textContent = '';

  const score = 10 + Math.max(0, (word.length - 2)) * 5;
  boss.playerScore += score;
  boss.usedWords.add(word);
  addBossUsedWord(word, 'player');

  // 페이드 → 애니메이션
  const overlay = document.getElementById('boss-fade-overlay');
  overlay.style.opacity = '0';

  playBossWordAnimation(word, () => {
    boss.nextChar = word[word.length - 1];
    showBossNextCharHint(boss.nextChar);
    boss.turnCount++;
    boss.timerMax = Math.max(2, 10 - (boss.turnCount - 1) * 0.25);
    // 보스 턴
    boss.isPlayerTurn = false;
    startBossTurn();
  });
}

// ==================== BOSS TURN ====================

function startBossTurn() {
  boss.isPlayerTurn = false;
  startBossTimer();

  // 좀고수봇 AI
  const candidates = findWordsStartingWith(boss.nextChar)
    .filter(entry => !boss.usedWords.has(entry.w) && isModeValidWord(entry.w));
  const safe = candidates.filter(e => !isKillerWord(e.w));
  const pool = safe.length > 0 ? safe : candidates;

  if (pool.length === 0) {
    // 보스 패배
    return; // 타이머가 처리
  }

  const botWord = pool[Math.floor(Math.random() * pool.length)].w;

  // 0.3초 뒤 보스 단어 표시 (빠른 반응)
  setTimeout(() => {
    if (!boss.active || boss.ended) return;
    stopBossTimer();

    const score = 10 + Math.max(0, (botWord.length - 2)) * 5;
    boss.bossScore += score;
    boss.usedWords.add(botWord);
    addBossUsedWord(botWord, 'bot');

    // 페이드 투 블랙 → 단어 애니메이션
    const overlay = document.getElementById('boss-fade-overlay');
    overlay.style.transition = 'opacity 0.3s';
    overlay.style.opacity = '1';

    setTimeout(() => {
      playBossWordAnimation(botWord, () => {
        // 페이드 아웃 해제
        overlay.style.transition = 'opacity 0.3s';
        overlay.style.opacity = '0';

        boss.nextChar = botWord[botWord.length - 1];
        showBossNextCharHint(boss.nextChar);
        boss.turnCount++;
        boss.timerMax = Math.max(2, 10 - (boss.turnCount - 1) * 0.25);
        boss.isPlayerTurn = true;
        startBossTimer();
        document.getElementById('boss-word-input').focus();
      });
    }, 300);
  }, 300);
}

// ==================== USED WORDS ====================

function addBossUsedWord(word, type) {
  const container = document.getElementById('boss-used-words');
  const tag = document.createElement('span');
  tag.className = `used-word-tag ${type}-word`;
  tag.textContent = word;
  container.appendChild(tag);
  container.scrollTop = container.scrollHeight;
}

// ==================== BOSS END ====================

function endBossBattle(playerWins, reason) {
  if (boss.ended) return;
  boss.ended = true;
  boss.active = false;
  stopBossTimer();
  if (boss.globalTimer) { clearTimeout(boss.globalTimer); boss.globalTimer = null; }

  // 현재 영상 페이드 아웃
  const video = document.getElementById('boss-video');
  video.style.transition = 'opacity 1s';
  video.style.opacity = '0';

  setTimeout(() => {
    document.getElementById('boss-game-ui').style.display = 'none';

    const endingSrc = playerWins ? 'Boss_GoodEnding.mp4' : 'Boss_SadEnding.mp4';
    video.src = endingSrc;
    video.muted = false;
    video.style.opacity = '1';
    video.currentTime = 0;
    video.load();
    video.play().catch(() => { video.muted = true; video.play().catch(() => {}); });

    video.onended = () => {
      const p = getActiveProfile();
      if (playerWins) {
        addExp(750);
        p.wins++;
        saveProfile();
        showScreen('screen-select');
        alert('보스에게 승리 하셨습니다! +750 경험치');
      } else {
        p.losses++;
        saveProfile();
        showScreen('screen-home');
        alert('보스에게 패배하셨습니다...');
      }
      video.onended = null;
    };
  }, 1000);
}

// ==================== BOSS INPUT HANDLING ====================

document.addEventListener('DOMContentLoaded', () => {
  const bossInput = document.getElementById('boss-word-input');
  if (!bossInput) return;

  let composing = false;

  bossInput.addEventListener('compositionstart', () => { composing = true; });
  bossInput.addEventListener('compositionend', () => { composing = false; });
  bossInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (composing || e.isComposing) return;
      setTimeout(() => submitBossWord(), 10);
    }
  });
});
