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
  listeners: [],
  roomListListener: null
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

  // 방 만들기 모드 설정 읽기
  const roomModes = {
    manner: document.getElementById('room-mode-manner').classList.contains('active'),
    noda: document.getElementById('room-mode-noda').classList.contains('active'),
    injeong: document.getElementById('room-mode-injeong').classList.contains('active')
  };

  const roomData = {
    code: code,
    status: 'waiting',
    createdAt: firebase.database.ServerValue.TIMESTAMP,
    modes: roomModes,
    p1: {
      nickname: p.nickname,
      level: p.level,
      userId: p.userId,
      score: 0,
      online: true,
      ready: true // 호스트는 항상 준비 상태
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
      return createRoom();
    }
    await ref.set(roomData);

    multi.roomId = code;
    multi.roomRef = ref;
    multi.playerId = 'p1';
    multi.isHost = true;

    ref.child('p1/online').onDisconnect().set(false);

    showScreen('screen-multi-waiting');
    document.getElementById('room-code-display').textContent = code;
    displayRoomModes(roomModes);
    listenRoom();
  } catch (e) {
    document.getElementById('multi-lobby-msg').textContent = '방 생성 실패: ' + e.message;
  }
}

async function joinRoomByCode(code) {
  if (!db) {
    document.getElementById('multi-lobby-msg').textContent = 'Firebase가 설정되지 않았습니다.';
    return;
  }

  if (!code || code.length !== 6) {
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
      online: true,
      ready: false
    });

    multi.roomId = code;
    multi.roomRef = ref;
    multi.playerId = 'p2';
    multi.isHost = false;

    ref.child('p2/online').onDisconnect().set(false);

    showScreen('screen-multi-waiting');
    document.getElementById('room-code-display').textContent = code;
    if (room.modes) displayRoomModes(room.modes);
    listenRoom();
  } catch (e) {
    document.getElementById('multi-lobby-msg').textContent = '참가 실패: ' + e.message;
  }
}

async function joinRoom() {
  const code = document.getElementById('join-room-code').value.trim().toUpperCase();
  await joinRoomByCode(code);
}

async function joinRoomFromList(code) {
  await joinRoomByCode(code);
}

function toggleRoomMode(btn) {
  btn.classList.toggle('active');
}

function displayRoomModes(roomModes) {
  const el = document.getElementById('waiting-modes');
  if (!el) return;
  const tags = [];
  if (roomModes.manner) tags.push('매너');
  if (roomModes.noda) tags.push('~다 금지');
  if (roomModes.injeong) tags.push('어인정');
  el.textContent = tags.length > 0 ? '모드: ' + tags.join(', ') : '모드: 없음';
}

function copyRoomCode() {
  const code = document.getElementById('room-code-display').textContent;
  navigator.clipboard.writeText(code).catch(() => {});
}

// ==================== READY SYSTEM ====================

async function toggleReady() {
  if (!multi.roomRef || multi.isHost) return;

  // 사용자 제스처 내에서 오디오 프리로드 + 잠금 해제
  await preloadAudio();
  try {
    const silence = new Audio();
    silence.volume = 0;
    await silence.play();
  } catch(e) {}

  const ref = multi.roomRef.child('p2/ready');
  const snap = await ref.get();
  const current = snap.val();
  await ref.set(!current);
}

// ==================== PUBLIC ROOM LIST ====================

function startRoomListListener() {
  if (!db) return;
  if (multi.roomListListener) return;

  const roomsRef = db.ref('rooms');
  multi.roomListListener = roomsRef.orderByChild('status').equalTo('waiting').on('value', (snapshot) => {
    const list = document.getElementById('public-room-list');
    if (!list) return;
    list.innerHTML = '';

    const rooms = snapshot.val();
    if (!rooms) {
      list.innerHTML = '<div class="room-list-empty">대기 중인 방이 없습니다</div>';
      return;
    }

    let count = 0;
    for (const [code, room] of Object.entries(rooms)) {
      // p2가 없거나 오프라인인 방만 표시
      if (room.p2 && room.p2.online) continue;
      if (!room.p1 || !room.p1.online) continue;
      count++;

      const modeTags = [];
      if (room.modes) {
        if (room.modes.manner) modeTags.push('매너');
        if (room.modes.noda) modeTags.push('~다금지');
        if (room.modes.injeong) modeTags.push('어인정');
      }

      const card = document.createElement('div');
      card.className = 'room-list-card';
      card.onclick = () => joinRoomFromList(code);
      card.innerHTML = `
        <div class="room-list-info">
          <span class="room-list-host">${room.p1.nickname} <span class="room-list-level">Lv.${room.p1.level}</span></span>
          <span class="room-list-modes">${modeTags.join(' ')}</span>
        </div>
        <span class="room-list-code">${code}</span>
      `;
      list.appendChild(card);
    }

    if (count === 0) {
      list.innerHTML = '<div class="room-list-empty">대기 중인 방이 없습니다</div>';
    }
  });
}

function stopRoomListListener() {
  if (multi.roomListListener && db) {
    db.ref('rooms').off('value', multi.roomListListener);
    multi.roomListListener = null;
  }
}

// ==================== LEAVE ROOM ====================

async function leaveRoom() {
  if (multi.roomRef) {
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
  const statusEl = document.getElementById('waiting-status');
  const startBtn = document.getElementById('btn-multi-start');
  const readyBtn = document.getElementById('btn-multi-ready');

  if (room.p1) {
    wp1.innerHTML = `<div class="waiting-avatar">&#128100;</div>
      <div class="waiting-name">${room.p1.nickname}<br><span style="font-size:0.75rem;color:#888">Lv.${room.p1.level}</span></div>
      <div class="ready-badge ready">방장</div>`;
  }

  if (room.p2 && room.p2.online) {
    const isReady = room.p2.ready;
    wp2.innerHTML = `<div class="waiting-avatar">&#128100;</div>
      <div class="waiting-name">${room.p2.nickname}<br><span style="font-size:0.75rem;color:#888">Lv.${room.p2.level}</span></div>
      <div class="ready-badge ${isReady ? 'ready' : 'not-ready'}">${isReady ? '준비 완료' : '대기중'}</div>`;

    if (multi.isHost) {
      // 호스트: p2가 준비되면 시작 가능
      if (isReady) {
        statusEl.textContent = '모두 준비 완료!';
        startBtn.style.display = '';
      } else {
        statusEl.textContent = '상대가 준비하지 않았습니다...';
        startBtn.style.display = 'none';
      }
      readyBtn.style.display = 'none';
    } else {
      // 게스트: 준비 버튼 표시
      startBtn.style.display = 'none';
      readyBtn.style.display = '';
      readyBtn.textContent = isReady ? '준비 취소' : '준비';
      readyBtn.setAttribute('class', isReady ? 'btn btn-secondary btn-large' : 'btn btn-primary btn-large');
      readyBtn.onclick = toggleReady;
      statusEl.textContent = isReady ? '호스트가 시작하기를 기다리는 중...' : '준비 버튼을 눌러주세요';
    }
  } else {
    wp2.innerHTML = `<div class="waiting-avatar" style="opacity:0.3">&#128100;</div>
      <div class="waiting-name" style="color:#ccc">대기중...</div>`;
    statusEl.textContent = '상대를 기다리는 중...';
    startBtn.style.display = 'none';
    if (readyBtn) readyBtn.style.display = 'none';
  }
}

// ==================== GAME START ====================

async function startMultiGame() {
  if (!multi.isHost || !multi.roomRef) return;

  // 사용자 제스처 내에서 오디오 프리로드 + 잠금 해제
  await preloadAudio();
  // 무음 재생으로 브라우저 오디오 정책 해제
  try {
    const silence = new Audio();
    silence.volume = 0;
    await silence.play();
  } catch(e) {}

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
    showScreen('screen-multi-game');
    initMultiGameUI(room);
  }

  document.getElementById('multi-p1-name').textContent = room.p1.nickname;
  document.getElementById('multi-p2-name').textContent = room.p2.nickname;
  document.getElementById('multi-p1-score').textContent = (room.p1.score || 0) + '점';
  document.getElementById('multi-p2-score').textContent = (room.p2.score || 0) + '점';

  if (room.usedWords) {
    multi.usedWords = new Set(room.usedWords.split(','));
  }

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

  if (room.lastAction && room.lastAction.timestamp > lastActionTimestamp) {
    lastActionTimestamp = room.lastAction.timestamp || Date.now();

    if (room.lastAction.type === 'word' || room.lastAction.type === 'start') {
      if (room.nextChar) showMultiNextCharHint(room.nextChar);
      playMultiWordAnimation(room.lastAction.word);
      updateMultiUsedWords(room.usedWords);
    }

    startMultiTimer();
  }
}

async function initMultiGameUI(room) {
  document.getElementById('multi-game-message').textContent = '';
  document.getElementById('multi-used-words').innerHTML = '';
  document.getElementById('multi-word-input').value = '';
  lastActionTimestamp = 0;
  multi.myScore = 0;
  multi.opScore = 0;
  // WAV 파일 프리로드 (봇전과 동일한 사운드)
  await preloadAudio();
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
  // game.js의 playWordAnimation 재사용 (WAV 리듬 + 피날레 동일)
  // timerMax를 state에 임시 반영해서 배속도 적용
  const origTimerMax = state.timerMax;
  state.timerMax = multi.timerMax || 10;
  playWordAnimation(word, () => {
    state.isAnimating = false;
    state.timerMax = origTimerMax;
  }, 'multi-current-word');
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

  const msg = validateMultiWord(word);
  if (msg) {
    document.getElementById('multi-game-message').textContent = msg;
    input.focus();
    return;
  }

  stopMultiTimer();
  document.getElementById('multi-submit-btn').disabled = true;
  document.getElementById('multi-game-message').textContent = '';

  const score = 10 + Math.max(0, (word.length - 2)) * 5;
  const lastChar = word[word.length - 1];
  const nextTurn = multi.playerId === 'p1' ? 'p2' : 'p1';
  const newTurnCount = multi.turnCount + 1;
  const newTimerMax = Math.max(2, 10 - (newTurnCount - 1) * 0.25);

  const newUsedWords = multi.usedWords.size > 0
    ? Array.from(multi.usedWords).join(',') + ',' + word
    : word;

  const currentScore = (await multi.roomRef.child(`${multi.playerId}/score`).get()).val() || 0;

  await multi.roomRef.update({
    turn: nextTurn,
    turnCount: newTurnCount,
    timerMax: newTimerMax,
    currentWord: word,
    nextChar: lastChar,
    usedWords: newUsedWords,
    [`${multi.playerId}/score`]: currentScore + score,
    lastAction: {
      type: 'word',
      word: word,
      by: multi.playerId,
      timestamp: firebase.database.ServerValue.TIMESTAMP
    }
  });
}

function validateMultiWord(word) {
  if (word.length < 2) return '2글자 이상 입력하세요.';

  if (multi.usedWords.size > 0) {
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

  // 방 모드 적용 (Firebase에서 가져온 모드)
  // TODO: room.modes 체크 - 현재는 어인정 기본 ON
  return null;
}

// ==================== GAME OVER ====================

function handleMultiGameOver(room) {
  stopMultiTimer();

  const iWin = room.winner === multi.playerId;
  const myData = room[multi.playerId];
  const opId = multi.playerId === 'p1' ? 'p2' : 'p1';
  const opData = room[opId];

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

    if (multi.isHost && multi.roomRef) {
      setTimeout(() => multi.roomRef.remove(), 10000);
    }
    multi.listeners.forEach(fn => fn());
    multi.listeners = [];

    showScreen('screen-gameover');
    resetMultiState();
  }, 500);
}

// ==================== SCREEN HOOKS ====================

// 로비 화면 진입 시 방 목록 리스닝 시작
const _origShowScreen = showScreen;
showScreen = function(id) {
  _origShowScreen(id);
  if (id === 'screen-multi-lobby') {
    startRoomListListener();
  } else {
    stopRoomListListener();
  }
};

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
