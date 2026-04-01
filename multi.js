// ==================== MULTIPLAYER SYSTEM ====================

const multi = {
  roomId: null,
  roomRef: null,
  playerId: null,    // 'p1' or 'p2'
  isHost: false,
  isMyTurn: false,
  timerMax: 10,
  timerLeft: 10,
  timerId: null,
  turnCount: 0,
  usedWords: new Set(),
  myScore: 0,
  opScore: 0,
  listeners: []
};

// ==================== ROOM MANAGEMENT ====================

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

async function createRoom() {
  if (!db) {
    document.getElementById('multi-lobby-msg').textContent = 'Firebase가 설정되지 않았습니다.';
    return;
  }

  const p = getActiveProfile();
  const code = generateRoomCode();

  const roomData = {
    code: code,
    status: 'waiting', // waiting → playing → finished
    createdAt: firebase.database.ServerValue.TIMESTAMP,
    p1: {
      nickname: p.nickname,
      level: p.level,
      userId: p.userId,
      score: 0,
      online: true
    },
    p2: null,
    turn: 'p1',
    turnCount: 0,
    timerMax: 10,
    currentWord: null,
    nextChar: null,
    usedWords: '',
    lastAction: null
  };

  try {
    const ref = db.ref('rooms/' + code);
    const snapshot = await ref.get();
    if (snapshot.exists()) {
      // 코드 충돌 시 재시도
      return createRoom();
    }
    await ref.set(roomData);

    multi.roomId = code;
    multi.roomRef = ref;
    multi.playerId = 'p1';
    multi.isHost = true;

    // 연결 해제 시 방 정리
    ref.child('p1/online').onDisconnect().set(false);

    showScreen('screen-multi-waiting');
    document.getElementById('room-code-display').textContent = code;
    updateWaitingRoom();
    listenRoom();
  } catch (e) {
    document.getElementById('multi-lobby-msg').textContent = '방 생성 실패: ' + e.message;
  }
}

async function joinRoom() {
  if (!db) {
    document.getElementById('multi-lobby-msg').textContent = 'Firebase가 설정되지 않았습니다.';
    return;
  }

  const code = document.getElementById('join-room-code').value.trim().toUpperCase();
  if (code.length !== 6) {
    document.getElementById('multi-lobby-msg').textContent = '6자리 방 코드를 입력하세요.';
    return;
  }

  const p = getActiveProfile();

  try {
    const ref = db.ref('rooms/' + code);
    const snapshot = await ref.get();

    if (!snapshot.exists()) {
      document.getElementById('multi-lobby-msg').textContent = '존재하지 않는 방입니다.';
      return;
    }

    const room = snapshot.val();
    if (room.status !== 'waiting') {
      document.getElementById('multi-lobby-msg').textContent = '이미 게임이 시작된 방입니다.';
      return;
    }
    if (room.p2 && room.p2.online) {
      document.getElementById('multi-lobby-msg').textContent = '방이 이미 가득 찼습니다.';
      return;
    }

    await ref.child('p2').set({
      nickname: p.nickname,
      level: p.level,
      userId: p.userId,
      score: 0,
      online: true
    });

    multi.roomId = code;
    multi.roomRef = ref;
    multi.playerId = 'p2';
    multi.isHost = false;

    ref.child('p2/online').onDisconnect().set(false);

    showScreen('screen-multi-waiting');
    document.getElementById('room-code-display').textContent = code;
    listenRoom();
  } catch (e) {
    document.getElementById('multi-lobby-msg').textContent = '참가 실패: ' + e.message;
  }
}

function copyRoomCode() {
  const code = document.getElementById('room-code-display').textContent;
  navigator.clipboard.writeText(code).catch(() => {});
}

async function leaveRoom() {
  if (multi.roomRef) {
    // 리스너 해제
    multi.listeners.forEach(fn => fn());
    multi.listeners = [];

    if (multi.isHost) {
      await multi.roomRef.remove();
    } else {
      await multi.roomRef.child('p2').remove();
    }
  }
  resetMultiState();
  showScreen('screen-multi-lobby');
}

function resetMultiState() {
  multi.roomId = null;
  multi.roomRef = null;
  multi.playerId = null;
  multi.isHost = false;
  multi.isMyTurn = false;
  multi.turnCount = 0;
  multi.usedWords = new Set();
  multi.myScore = 0;
  multi.opScore = 0;
  stopMultiTimer();
}

// ==================== ROOM LISTENER ====================

function listenRoom() {
  if (!multi.roomRef) return;

  const unsub = multi.roomRef.on('value', (snapshot) => {
    const room = snapshot.val();
    if (!room) {
      // 방이 삭제됨
      resetMultiState();
      showScreen('screen-multi-lobby');
      document.getElementById('multi-lobby-msg').textContent = '방이 닫혔습니다.';
      return;
    }

    updateWaitingUI(room);

    if (room.status === 'playing') {
      handleGameUpdate(room);
    }

    if (room.status === 'finished') {
      handleMultiGameOver(room);
    }
  });

  multi.listeners.push(() => multi.roomRef.off('value', unsub));
}

function updateWaitingUI(room) {
  const wp1 = document.getElementById('waiting-p1');
  const wp2 = document.getElementById('waiting-p2');

  if (room.p1) {
    wp1.innerHTML = `<div class="waiting-avatar">&#128100;</div><div class="waiting-name">${room.p1.nickname}<br><span style="font-size:0.75rem;color:#888">Lv.${room.p1.level}</span></div>`;
  }

  if (room.p2 && room.p2.online) {
    wp2.innerHTML = `<div class="waiting-avatar">&#128100;</div><div class="waiting-name">${room.p2.nickname}<br><span style="font-size:0.75rem;color:#888">Lv.${room.p2.level}</span></div>`;
    document.getElementById('waiting-status').textContent = '준비 완료!';
    if (multi.isHost) {
      document.getElementById('btn-multi-start').style.display = '';
    }
  } else {
    wp2.innerHTML = `<div class="waiting-avatar" style="opacity:0.3">&#128100;</div><div class="waiting-name" style="color:#ccc">대기중...</div>`;
    document.getElementById('waiting-status').textContent = '상대를 기다리는 중...';
    document.getElementById('btn-multi-start').style.display = 'none';
  }
}

// ==================== GAME START ====================

async function startMultiGame() {
  if (!multi.isHost || !multi.roomRef) return;

  const startWord = getRandomStartWord();
  const lastChar = startWord[startWord.length - 1];

  await multi.roomRef.update({
    status: 'playing',
    turn: Math.random() > 0.5 ? 'p1' : 'p2',
    turnCount: 1,
    timerMax: 10,
    currentWord: startWord,
    nextChar: lastChar,
    usedWords: startWord,
    lastAction: {
      type: 'start',
      word: startWord,
      by: 'system',
      timestamp: firebase.database.ServerValue.TIMESTAMP
    }
  });
}

// ==================== GAME UPDATE HANDLER ====================

let lastActionTimestamp = 0;

function handleGameUpdate(room) {
  const currentScreen = document.querySelector('.screen.active');
  if (currentScreen && currentScreen.id === 'screen-multi-waiting') {
    // 게임 시작 전환
    showScreen('screen-multi-game');
    initMultiGameUI(room);
  }

  // 플레이어 정보
  document.getElementById('multi-p1-name').textContent = room.p1.nickname;
  document.getElementById('multi-p2-name').textContent = room.p2.nickname;
  document.getElementById('multi-p1-score').textContent = (room.p1.score || 0) + '점';
  document.getElementById('multi-p2-score').textContent = (room.p2.score || 0) + '점';

  // 사용된 단어 동기화
  if (room.usedWords) {
    multi.usedWords = new Set(room.usedWords.split(','));
  }

  // 턴 상태
  multi.isMyTurn = (room.turn === multi.playerId);
  multi.timerMax = room.timerMax || 10;
  multi.turnCount = room.turnCount || 1;

  const turnInd = document.getElementById('multi-turn-indicator');
  const input = document.getElementById('multi-word-input');
  const btn = document.getElementById('multi-submit-btn');

  if (multi.isMyTurn) {
    turnInd.textContent = '내 턴';
    turnInd.className = 'turn-indicator my-turn';
    btn.disabled = false;
    input.focus();
  } else {
    const opName = multi.playerId === 'p1' ? room.p2.nickname : room.p1.nickname;
    turnInd.textContent = opName + ' 턴';
    turnInd.className = 'turn-indicator bot-turn';
    btn.disabled = true;
  }

  // 마지막 액션 처리 (새 단어가 들어왔을 때)
  if (room.lastAction && room.lastAction.timestamp > lastActionTimestamp) {
    lastActionTimestamp = room.lastAction.timestamp || Date.now();

    if (room.lastAction.type === 'word' || room.lastAction.type === 'start') {
      const word = room.lastAction.word;
      const wordEl = document.getElementById('multi-current-word');

      // 다음 글자 힌트
      if (room.nextChar) {
        showMultiNextCharHint(room.nextChar);
      }

      // 단어 애니메이션
      playMultiWordAnimation(word);

      // 사용된 단어 태그
      updateMultiUsedWords(room.usedWords);
    }

    // 타이머 리셋
    startMultiTimer();
  }
}

function initMultiGameUI(room) {
  document.getElementById('multi-game-message').textContent = '';
  document.getElementById('multi-used-words').innerHTML = '';
  document.getElementById('multi-word-input').value = '';
  lastActionTimestamp = 0;
  multi.myScore = 0;
  multi.opScore = 0;
}

function showMultiNextCharHint(char) {
  const alternatives = getAlternativeChars(char);
  let hint = `다음 글자: <strong>${char}</strong>`;
  if (alternatives.length > 1) {
    hint += ` (${alternatives.slice(1).map(c => `<strong>${c}</strong>`).join(', ')} 가능)`;
  }
  document.getElementById('multi-next-char').innerHTML = hint;
}

function playMultiWordAnimation(word) {
  const wordEl = document.getElementById('multi-current-word');
  const chars = word.split('');
  wordEl.innerHTML = chars.map((c, i) => `<span class="char visible">${c}</span>`).join('');
  wordEl.classList.add('finale-pulse');
  setTimeout(() => wordEl.classList.remove('finale-pulse'), 400);

  // 사운드
  const n = chars.length;
  if (n >= 2 && n <= 7) {
    const speed = 1.0 + (10 - (multi.timerMax || 10)) * 0.05;
    playSound(String(n), speed);
  } else if (n >= 8) {
    playSound('lastpart');
  }
}

function updateMultiUsedWords(wordsStr) {
  const container = document.getElementById('multi-used-words');
  container.innerHTML = '';
  if (!wordsStr) return;
  wordsStr.split(',').forEach(w => {
    const tag = document.createElement('span');
    tag.className = 'used-word-tag';
    tag.textContent = w;
    container.appendChild(tag);
  });
}

// ==================== MULTI TIMER ====================

function startMultiTimer() {
  stopMultiTimer();
  multi.timerLeft = multi.timerMax;
  updateMultiTimerDisplay();

  multi.timerId = setInterval(() => {
    multi.timerLeft -= 0.05;
    if (multi.timerLeft <= 0) {
      multi.timerLeft = 0;
      stopMultiTimer();
      if (multi.isMyTurn) {
        // 내 턴에 시간 초과 → 패배
        handleMultiTimeout();
      }
    }
    updateMultiTimerDisplay();
  }, 50);
}

function stopMultiTimer() {
  if (multi.timerId) {
    clearInterval(multi.timerId);
    multi.timerId = null;
  }
}

function updateMultiTimerDisplay() {
  const pct = Math.max(0, (multi.timerLeft / multi.timerMax) * 100);
  const bar = document.getElementById('multi-timer-bar');
  const text = document.getElementById('multi-timer-text');

  bar.style.width = pct + '%';
  text.textContent = multi.timerLeft.toFixed(2) + 's';

  bar.classList.remove('warning', 'danger');
  text.classList.remove('warning', 'danger');

  if (multi.timerLeft <= 2) {
    bar.classList.add('danger');
    text.classList.add('danger');
  } else if (multi.timerLeft <= 4) {
    bar.classList.add('warning');
    text.classList.add('warning');
  }
}

async function handleMultiTimeout() {
  if (!multi.roomRef) return;

  const winner = multi.playerId === 'p1' ? 'p2' : 'p1';
  await multi.roomRef.update({
    status: 'finished',
    winner: winner,
    reason: '시간 초과!'
  });
}

// ==================== SUBMIT WORD ====================

async function submitMultiWord() {
  if (!multi.isMyTurn || !multi.roomRef) return;

  const input = document.getElementById('multi-word-input');
  const word = input.value.trim();
  input.value = '';

  if (!word) return;

  // 유효성 검사
  const msg = validateMultiWord(word);
  if (msg) {
    document.getElementById('multi-game-message').textContent = msg;
    input.focus();
    return;
  }

  stopMultiTimer();
  document.getElementById('multi-submit-btn').disabled = true;
  document.getElementById('multi-game-message').textContent = '';

  // 점수
  const score = 10 + Math.max(0, (word.length - 2)) * 5;
  const lastChar = word[word.length - 1];
  const nextTurn = multi.playerId === 'p1' ? 'p2' : 'p1';
  const newTurnCount = multi.turnCount + 1;
  const newTimerMax = Math.max(2, 10 - (newTurnCount - 1) * 0.25);

  // 사용된 단어 목록 업데이트
  const newUsedWords = multi.usedWords.size > 0
    ? Array.from(multi.usedWords).join(',') + ',' + word
    : word;

  const updates = {
    turn: nextTurn,
    turnCount: newTurnCount,
    timerMax: newTimerMax,
    currentWord: word,
    nextChar: lastChar,
    usedWords: newUsedWords,
    lastAction: {
      type: 'word',
      word: word,
      by: multi.playerId,
      timestamp: firebase.database.ServerValue.TIMESTAMP
    }
  };
  updates[`${multi.playerId}/score`] = (multi.playerId === 'p1' ? (await multi.roomRef.child('p1/score').get()).val() : (await multi.roomRef.child('p2/score').get()).val()) + score;

  await multi.roomRef.update(updates);
}

function validateMultiWord(word) {
  if (word.length < 2) return '2글자 이상 입력하세요.';

  // 현재 방의 nextChar 확인
  const roomNextChar = document.getElementById('multi-next-char').textContent;

  if (multi.usedWords.size > 0) {
    // nextChar 기반 체인 체크
    const nextCharEl = document.getElementById('multi-next-char');
    const match = nextCharEl.innerHTML.match(/<strong>(.)<\/strong>/);
    if (match) {
      const nc = match[1];
      if (!isValidChain(nc, word)) {
        const alts = getAlternativeChars(nc);
        return `"${alts.join('" 또는 "')}"(으)로 시작하는 단어를 입력하세요.`;
      }
    }
  }

  if (multi.usedWords.has(word)) return '이미 사용한 단어입니다.';
  if (!isValidWord(word)) return '사전에 없는 단어입니다.';
  return null;
}

// ==================== GAME OVER ====================

function handleMultiGameOver(room) {
  stopMultiTimer();

  const iWin = room.winner === multi.playerId;
  const myData = room[multi.playerId];
  const opId = multi.playerId === 'p1' ? 'p2' : 'p1';
  const opData = room[opId];

  // 경험치 (멀티는 고정 15/5)
  const earnedExp = iWin ? 15 : 5;
  if (multi.turnCount >= 2) {
    addExp(earnedExp);
    const p = getActiveProfile();
    if (iWin) p.wins++; else p.losses++;
    saveProfile();
  }

  setTimeout(() => {
    const title = document.getElementById('gameover-title');
    title.textContent = iWin ? '승리!' : '패배...';
    title.className = 'gameover-title ' + (iWin ? 'win' : 'lose');

    document.getElementById('final-player-score').textContent = (myData.score || 0) + '점';
    document.getElementById('final-bot-score').textContent = (opData.score || 0) + '점';
    document.getElementById('final-bot-name').textContent = opData.nickname;
    document.getElementById('gameover-reason').textContent =
      (room.reason || '') + (multi.turnCount >= 2 ? ` (+${earnedExp} EXP)` : ' (+0 EXP)');

    // 방 정리
    if (multi.isHost && multi.roomRef) {
      setTimeout(() => multi.roomRef.remove(), 10000); // 10초 후 삭제
    }
    multi.listeners.forEach(fn => fn());
    multi.listeners = [];

    showScreen('screen-gameover');
    resetMultiState();
  }, 500);
}

// ==================== MULTI INPUT HANDLING ====================

document.addEventListener('DOMContentLoaded', () => {
  const multiInput = document.getElementById('multi-word-input');
  if (!multiInput) return;

  let composing = false;
  let submitPending = false;

  multiInput.addEventListener('compositionstart', () => { composing = true; });
  multiInput.addEventListener('compositionend', () => {
    composing = false;
    if (submitPending) { submitPending = false; submitMultiWord(); }
  });
  multiInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (composing || e.isComposing) { submitPending = true; return; }
      submitMultiWord();
    }
  });
});
