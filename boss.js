// ==================== BOSS BATTLE - 사전의 재앙 ====================

const boss = {
  active: false,
  ended: false,
  video: null,
  hp: 10,            // 보스 체력 10칸
  hearts: 5,         // 플레이어 하트
  usedWords: new Set(),
  globalTimer: null,
  turnTimer: null,
  turnTimeLeft: 6,
  currentBossWords: [],  // 보스가 낸 3단어
  currentAnswers: [],    // 플레이어 답변
  answerIndex: 0,        // 현재 입력 중인 답변 인덱스
  timeLimit: 6 * 60 + 55
};

const BOSS_SPEED = 1.75;

// 보스전 WAV
const BOSS_WAV_FILES = {
  2: 'Boss_2-Letters.wav', 3: 'Boss_3-Letters.wav', 4: 'Boss_4-Letters.wav',
  5: 'Boss_5-Letters.wav', 6: 'Boss_6-Letters.wav', 7: 'Boss_7-Letters.wav',
  kick: 'Boss_Intense.wav', lastpart: 'Boss_Lastpart.wav'
};

const bossAudioPool = {};
let bossAudioLoaded = false;

function preloadBossAudio() {
  if (bossAudioLoaded) return Promise.resolve();
  const promises = [];
  for (const [key, fn] of Object.entries(BOSS_WAV_FILES)) {
    if (bossAudioPool[key]) continue;
    promises.push(new Promise(r => {
      const a = new Audio(fn);
      a.preload = 'auto';
      a.addEventListener('canplaythrough', () => { bossAudioPool[key] = a; r(); }, { once: true });
      a.addEventListener('error', () => r(), { once: true });
      setTimeout(r, 3000);
      a.load();
    }));
  }
  return Promise.all(promises).then(() => { bossAudioLoaded = true; });
}

let bossCurrentSound = null;
function playBossSound(key, rate) {
  const orig = bossAudioPool[key];
  if (!orig) return;
  if (bossCurrentSound) try { bossCurrentSound.pause(); bossCurrentSound.currentTime = 0; } catch(e) {}
  const c = orig.cloneNode();
  c.volume = 1.0;
  c.playbackRate = rate || BOSS_SPEED;
  c.play().catch(() => {});
  bossCurrentSound = c;
}

function playBossKickAt(ms) {
  setTimeout(() => {
    const orig = bossAudioPool['kick'];
    if (!orig) return;
    const c = orig.cloneNode();
    c.volume = 1.0;
    c.playbackRate = BOSS_SPEED;
    c.play().catch(() => {});
  }, ms);
}

// ==================== BOSS WORD ANIMATION ====================

function playBossWordAnim(word, targetEl, callback) {
  const chars = word.split('');
  const n = chars.length;
  targetEl.innerHTML = chars.map((c, i) => `<span class="char" data-idx="${i}">${c}</span>`).join('');

  const sc = 1 / BOSS_SPEED;

  if (n >= 2 && n <= 7) {
    playBossSound(String(n));
    WAV_CHAR_BEATS[n].forEach((t, i) => {
      setTimeout(() => revealChar(targetEl, i), t * 1000 * sc);
    });
    FINALE_BEATS.forEach((t, i) => {
      setTimeout(() => pulseAllChars(targetEl, i), t * 1000 * sc);
    });
    setTimeout(() => { targetEl.classList.remove('finale-pulse'); if (callback) callback(); }, FINALE_BEATS[2] * 1000 * sc + 300);
  } else if (n >= 8) {
    playBossSound('lastpart');
    const totalT = 1282 * sc;
    for (let i = 0; i < n; i++) {
      const tMs = Math.round((i / (n - 1)) * totalT);
      playBossKickAt(tMs);
      setTimeout(() => revealChar(targetEl, i), tMs);
    }
    FINALE_BEATS.forEach((t, i) => {
      setTimeout(() => pulseAllChars(targetEl, i), t * 1000 * sc);
    });
    setTimeout(() => { targetEl.classList.remove('finale-pulse'); if (callback) callback(); }, FINALE_BEATS[2] * 1000 * sc + 300);
  } else {
    targetEl.innerHTML = `<span class="char visible">${word}</span>`;
    if (callback) setTimeout(callback, 200);
  }
}

// ==================== START ====================

function tryBossBattle() {
  const p = getActiveProfile();
  if (p.level < 10) {
    document.getElementById('boss-desc').textContent = `레벨이 부족합니다! (현재 Lv.${p.level})`;
    return;
  }
  startBossBattle();
}

function closeBossTutorial() {
  const noshow = document.getElementById('boss-tutorial-noshow');
  if (noshow && noshow.checked) {
    localStorage.setItem('connecthalast_boss_noshow', '1');
  }
  document.getElementById('boss-tutorial').classList.add('hidden');
}

function startBossBattle() {
  // 설명 팝업
  const noshow = localStorage.getItem('connecthalast_boss_noshow');
  const tutorial = document.getElementById('boss-tutorial');
  if (noshow === '1') {
    tutorial.classList.add('hidden');
  } else {
    tutorial.classList.remove('hidden');
  }
  boss.active = true;
  boss.ended = false;
  boss.hp = 10;
  boss.hearts = 5;
  boss.usedWords = new Set();
  boss.answerIndex = 0;

  preloadBossAudio();
  showScreen('screen-boss');

  // 비디오
  const video = document.getElementById('boss-video');
  boss.video = video;
  video.src = 'Boss_IntroAndGameplay.mp4';
  video.muted = false;
  video.volume = 1.0;
  video.currentTime = 0;
  video.style.display = 'block';
  video.style.opacity = '1';
  video.load();
  video.play().catch(() => {
    video.muted = true;
    video.play().catch(() => {});
    const unmute = () => { video.muted = false; document.removeEventListener('click', unmute); };
    document.addEventListener('click', unmute);
  });

  // UI 초기화
  document.getElementById('boss-game-ui').style.display = 'none';
  document.getElementById('boss-hp-bar').style.width = '100%';
  updateBossHearts();
  document.getElementById('boss-words-area').innerHTML = '';
  document.getElementById('boss-game-message').textContent = '';

  // 18초 후 게임 시작 (16초 영상 + 2초 딜레이)
  setTimeout(() => {
    if (!boss.active) return;
    document.getElementById('boss-game-ui').style.display = 'flex';
    document.getElementById('boss-game-ui').style.animation = 'fadeIn 0.5s ease';
    bossTurn();

    // 6분 55초 글로벌 타이머
    boss.globalTimer = setTimeout(() => {
      if (boss.active && !boss.ended) endBossBattle(false);
    }, boss.timeLimit * 1000);
  }, 18000);
}

// ==================== UI HELPERS ====================

function updateBossHP() {
  document.getElementById('boss-hp-bar').style.width = (boss.hp * 10) + '%';
}

function updateBossHearts() {
  const hearts = document.querySelectorAll('#boss-hearts .boss-heart');
  hearts.forEach((h, i) => {
    h.classList.toggle('lost', i >= boss.hearts);
  });
}

// ==================== BOSS TURN ====================

let bossTurnLock = false;

function bossTurn() {
  if (!boss.active || boss.ended || bossTurnLock) return;
  bossTurnLock = true;

  // 보스가 3단어 선택 (같은 첫글자)
  const words = chooseBoss3Words();
  if (!words || words.length === 0) {
    bossTurnLock = false;
    endBossBattle(true);
    return;
  }

  boss.currentBossWords = words;
  boss.currentAnswers = [null, null, null];
  boss.answerIndex = 0;

  // 3단어 UI 생성 (영상 위에 바로 표시, 페이드 없음)
  const area = document.getElementById('boss-words-area');
  area.innerHTML = '';

  words.forEach((w, i) => {
    boss.usedWords.add(w);
    const row = document.createElement('div');
    row.className = 'boss-word-row';
    row.innerHTML = `
      <div class="boss-word-display" id="boss-wd-${i}"></div>
      <span class="boss-word-arrow">→</span>
      <input class="boss-word-answer" id="boss-ans-${i}" placeholder="?" disabled autocomplete="off">
    `;
    area.appendChild(row);
  });

  // 애니메이션 순차 재생
  let idx = 0;
  function animNext() {
    if (idx >= words.length) {
      bossTurnLock = false;
      activateBossAnswers();
      startBossTurnTimer();
      return;
    }
    const el = document.getElementById('boss-wd-' + idx);
    const i = idx;
    idx++;
    playBossWordAnim(words[i], el, () => {
      setTimeout(animNext, 100);
    });
  }
  animNext();
}

function chooseBoss3Words() {
  // 랜덤 첫글자 → 3단어 선택
  const allChars = Object.keys(WORD_DB);
  const shuffled = allChars.sort(() => Math.random() - 0.5);

  for (const startChar of shuffled) {
    const candidates = findWordsStartingWith(startChar)
      .filter(e => !boss.usedWords.has(e.w) && e.w.length >= 2);
    if (candidates.length >= 3) {
      // 랜덤 3개
      const picked = [];
      const pool = [...candidates].sort(() => Math.random() - 0.5);
      for (const c of pool) {
        if (picked.length >= 3) break;
        // 끝글자로 이을 수 있는 단어가 있는지 확인
        const nextWords = findWordsStartingWith(c.w[c.w.length - 1])
          .filter(e => !boss.usedWords.has(e.w));
        if (nextWords.length >= 1) {
          picked.push(c.w);
        }
      }
      if (picked.length === 3) return picked;
    }
  }
  return null;
}

// ==================== PLAYER ANSWER ====================

function activateBossAnswers() {
  boss.answerIndex = 0;
  const first = document.getElementById('boss-ans-0');
  if (first) {
    first.disabled = false;
    first.focus();
  }
}

let bossAnswerLock = false;

function handleBossAnswer(index) {
  if (bossAnswerLock) return;
  const input = document.getElementById('boss-ans-' + index);
  if (!input || input.disabled) return;
  const word = input.value.trim();

  if (!word) return;
  bossAnswerLock = true;
  setTimeout(() => { bossAnswerLock = false; }, 300);

  const bossWord = boss.currentBossWords[index];
  const lastChar = bossWord[bossWord.length - 1];

  // 검증
  if (word.length < 2 || !isValidWord(word) || boss.usedWords.has(word) || !isValidChain(lastChar, word)) {
    input.classList.add('wrong');
    input.disabled = true;
    boss.currentAnswers[index] = null;
    moveToNextAnswer(index);
    return;
  }

  // 정답
  input.classList.add('correct');
  input.disabled = true;
  boss.currentAnswers[index] = word;
  boss.usedWords.add(word);
  moveToNextAnswer(index);
}

function moveToNextAnswer(currentIndex) {
  const next = currentIndex + 1;
  if (next < 3) {
    boss.answerIndex = next;
    const nextInput = document.getElementById('boss-ans-' + next);
    if (nextInput) {
      nextInput.disabled = false;
      nextInput.focus();
    }
  } else {
    // 3개 다 처리됨 → 결과 판정
    finishBossTurn();
  }
}

let finishTurnLock = false;

function finishBossTurn() {
  if (finishTurnLock) return;
  finishTurnLock = true;
  setTimeout(() => { finishTurnLock = false; }, 2500);

  stopBossTurnTimer();

  const successCount = boss.currentAnswers.filter(a => a !== null).length;

  if (successCount <= 1) {
    // 0~1개: 하트 -1
    boss.hearts--;
    updateBossHearts();
    flashMessage(successCount === 0 ? '반격 실패! ♥ -1' : '1개만 성공... ♥ -1');
  } else if (successCount === 2) {
    // 2개: 무사 통과
    flashMessage('2개 성공! 다음 턴...');
  } else if (successCount === 3) {
    // 3개: 보스 체력 -1
    boss.hp--;
    updateBossHP();
    flashMessage('완벽 반격! 보스 체력 -1');
  }

  // 승패 체크
  if (boss.hearts <= 0) {
    setTimeout(() => endBossBattle(false), 1500);
    return;
  }
  if (boss.hp <= 0) {
    setTimeout(() => endBossBattle(true), 1500);
    return;
  }

  // 다음 보스 턴
  setTimeout(() => {
    if (!boss.active || boss.ended) return;
    const validAnswers = boss.currentAnswers.filter(a => a !== null);
    if (validAnswers.length > 0) {
      const picked = validAnswers[Math.floor(Math.random() * validAnswers.length)];
      boss.nextStartChar = picked[picked.length - 1];
    }
    bossTurnLock = false;
    bossTurn();
  }, 2000);
}

function flashMessage(msg) {
  const el = document.getElementById('boss-game-message');
  el.textContent = msg;
  setTimeout(() => { el.textContent = ''; }, 1500);
}

// ==================== BOSS TURN TIMER ====================

function startBossTurnTimer() {
  stopBossTurnTimer();
  boss.turnTimeLeft = 6;
  updateBossTurnTimerDisplay();

  boss.turnTimer = setInterval(() => {
    boss.turnTimeLeft -= 0.05;
    if (boss.turnTimeLeft <= 0) {
      boss.turnTimeLeft = 0;
      stopBossTurnTimer();
      // 시간 초과 → 남은 답변은 null로 처리
      // 모든 입력 비활성화
      for (let i = 0; i < 3; i++) {
        const inp = document.getElementById('boss-ans-' + i);
        if (inp) inp.disabled = true;
      }
      finishBossTurn();
    }
    updateBossTurnTimerDisplay();
  }, 50);
}

function stopBossTurnTimer() {
  if (boss.turnTimer) {
    clearInterval(boss.turnTimer);
    boss.turnTimer = null;
  }
}

function updateBossTurnTimerDisplay() {
  const text = document.getElementById('boss-timer-text');
  if (!text) return;
  text.textContent = boss.turnTimeLeft.toFixed(2) + 's';
  text.classList.remove('warning', 'danger');
  if (boss.turnTimeLeft <= 2) text.classList.add('danger');
  else if (boss.turnTimeLeft <= 3) text.classList.add('warning');
}

// ==================== END BOSS ====================

function endBossBattle(playerWins) {
  if (boss.ended) return;
  boss.ended = true;
  boss.active = false;
  stopBossTurnTimer();
  if (boss.globalTimer) { clearTimeout(boss.globalTimer); boss.globalTimer = null; }

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

// ==================== INPUT HANDLING ====================

document.addEventListener('DOMContentLoaded', () => {
  document.addEventListener('keydown', (e) => {
    if (!boss.active || boss.ended) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      if (e.isComposing) return;
      const idx = boss.answerIndex;
      if (idx >= 3) return;
      const input = document.getElementById('boss-ans-' + idx);
      if (!input || input.disabled) return;
      setTimeout(() => handleBossAnswer(idx), 10);
    }
  });
});
