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
  roomListListener: null,
  totalRounds: 1,
  currentRound: 1
};

let selectedRounds = 1;

function selectRound(n, btn) {
  selectedRounds = n;
  document.querySelectorAll('.round-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

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

  const roomTitle = (document.getElementById('room-title-input').value || '').trim() || null;

  const roomData = {
    code: code,
    title: roomTitle,
    status: 'waiting',
    createdAt: firebase.database.ServerValue.TIMESTAMP,
    modes: roomModes,
    totalRounds: selectedRounds,
    currentRound: 1,
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
    showWaitingRoomTitle(roomTitle);
    displayRoomModes(roomModes, selectedRounds);
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
    showWaitingRoomTitle(room.title);
    if (room.modes) displayRoomModes(room.modes, room.totalRounds);
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

function showWaitingRoomTitle(title) {
  const el = document.getElementById('waiting-room-title');
  if (!el) return;
  if (title) { el.textContent = title; el.style.display = ''; }
  else { el.style.display = 'none'; }
}

function displayRoomModes(roomModes, totalRounds) {
  const el = document.getElementById('waiting-modes');
  if (!el) return;
  const tags = [];
  if (roomModes.manner) tags.push('매너');
  if (roomModes.noda) tags.push('~다 금지');
  if (roomModes.injeong) tags.push('어인정');
  let text = tags.length > 0 ? '모드: ' + tags.join(', ') : '모드: 없음';
  if (totalRounds > 1) text += ` | ${totalRounds}라운드`;
  el.textContent = text;
}

function copyRoomCode() {
  const code = document.getElementById('room-code-display').textContent;
  navigator.clipboard.writeText(code).catch(() => {});
}

// ==================== READY SYSTEM ====================

function toggleReady() {
  if (!multi.roomRef || multi.isHost) return;

  // 오디오 프리로드 (비동기, 기다리지 않음)
  preloadAudio();

  const ref = multi.roomRef.child('p2/ready');
  ref.get().then(snap => {
    const current = snap.val();
    ref.set(!current);
  });
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
      if (room.totalRounds > 1) modeTags.push(room.totalRounds + '라운드');

      const card = document.createElement('div');
      card.className = 'room-list-card';
      card.onclick = () => joinRoomFromList(code);
      const titleText = room.title ? `<div class="room-list-title">${room.title}</div>` : '';
      card.innerHTML = `
        <div class="room-list-info">
          ${titleText}
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
  stopMultiTypingListener();
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

function startMultiGame() {
  if (!multi.isHost || !multi.roomRef) return;

  preloadAudio();

  const startWord = getRandomStartWord();
  const lastChar = startWord[startWord.length - 1];

  multi.roomRef.update({
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

  document.getElementById('multi-p1-name').innerHTML = room.p1.nickname + ' ' + roleBadgeHTML(room.p1.nickname, 40);
  document.getElementById('multi-p2-name').innerHTML = room.p2.nickname + ' ' + roleBadgeHTML(room.p2.nickname, 40);
  const p1Wins = room.p1Wins || 0;
  const p2Wins = room.p2Wins || 0;
  const totalRounds = room.totalRounds || 1;
  const currentRound = room.currentRound || 1;

  if (totalRounds > 1) {
    document.getElementById('multi-p1-score').textContent = `${room.p1.score || 0}점 (${p1Wins}승)`;
    document.getElementById('multi-p2-score').textContent = `${room.p2.score || 0}점 (${p2Wins}승)`;
  } else {
    document.getElementById('multi-p1-score').textContent = (room.p1.score || 0) + '점';
    document.getElementById('multi-p2-score').textContent = (room.p2.score || 0) + '점';
  }

  // 라운드 표시
  const roundEl = document.getElementById('multi-round-display');
  if (roundEl) {
    if (totalRounds > 1) {
      roundEl.style.display = '';
      roundEl.textContent = `라운드 ${currentRound} / ${totalRounds}`;
    } else {
      roundEl.style.display = 'none';
    }
  }
  multi.totalRounds = totalRounds;
  multi.currentRound = currentRound;

  if (room.usedWords) {
    multi.usedWords = new Set(room.usedWords.split(','));
  }

  multi.isMyTurn = (room.turn === multi.playerId);
  multi.timerMax = room.timerMax || 10;
  multi.turnCount = room.turnCount || 1;
  const opField = multi.playerId === 'p1' ? 'p2Typing' : 'p1Typing';
  multi.opponentTyping = room[opField] || '';
  console.log('[TYPING] handleGameUpdate:', {opField, raw: room[opField], set: multi.opponentTyping, p1T: room.p1Typing, p2T: room.p2Typing});
  refreshMultiPlaceholder();

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

    // 애니메이션 중 타이머 정지
    stopMultiTimer();

    if (room.lastAction.type === 'word' || room.lastAction.type === 'start') {
      if (room.nextChar) showMultiNextCharHint(room.nextChar);
      updateMultiUsedWords(room.usedWords);

      // 애니메이션 끝난 후 타이머 시작
      const origTimerMax = state.timerMax;
      state.timerMax = multi.timerMax || 10;
      playWordAnimation(room.lastAction.word, () => {
        state.isAnimating = false;
        state.timerMax = origTimerMax;
        startMultiTimer();
      }, 'multi-current-word');
    } else {
      startMultiTimer();
    }
  }
}

async function initMultiGameUI(room) {
  document.getElementById('multi-game-message').textContent = '';
  document.getElementById('multi-used-words').innerHTML = '';
  document.getElementById('multi-word-input').value = '';
  const typingInd = document.getElementById('multi-typing-indicator');
  if (typingInd) typingInd.textContent = '';
  lastActionTimestamp = 0;
  multi.myScore = 0;
  multi.opScore = 0;
  // 타이핑 리스너 시작
  listenMultiTyping();
  // WAV 파일 프리로드 (백그라운드)
  preloadAudio();
}

function showMultiNextCharHint(char) {
  const alternatives = getAlternativeChars(char);
  let hint = `다음 글자: <strong>${char}</strong>`;
  if (alternatives.length > 1) {
    hint += ` (${alternatives.slice(1).map(c => `<strong>${c}</strong>`).join(', ')} 가능)`;
  }
  document.getElementById('multi-next-char').innerHTML = hint;
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

let multiSubmitLock = false;
async function submitMultiWord() {
  if (!multi.isMyTurn || !multi.roomRef || state.isAnimating || multiSubmitLock) return;
  multiSubmitLock = true;
  setTimeout(() => { multiSubmitLock = false; }, 500);

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
  updateMultiTyping(''); // 타이핑 정보 제거

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

// 리게임용 마지막 게임 정보 저장
let lastMultiGame = null;

function handleMultiGameOver(room) {
  stopMultiTimer();

  if (room._handled) return;
  room._handled = true;

  const totalRounds = room.totalRounds || 1;
  const currentRound = room.currentRound || 1;
  const iWin = room.winner === multi.playerId;

  // 라운드 승패 기록
  const winnerKey = room.winner; // 'p1' or 'p2'
  const p1Wins = (room.p1Wins || 0) + (winnerKey === 'p1' ? 1 : 0);
  const p2Wins = (room.p2Wins || 0) + (winnerKey === 'p2' ? 1 : 0);

  // 다중 라운드: 아직 라운드가 남아있으면 다음 라운드
  if (totalRounds > 1 && currentRound < totalRounds) {
    const roundEl = document.getElementById('multi-round-display');
    if (roundEl) roundEl.textContent = `라운드 ${currentRound} 종료 - ${iWin ? '승리!' : '패배'}`;

    setTimeout(() => {
      if (!multi.isHost) return;
      const startWord = getRandomStartWord();
      const lastChar = startWord[startWord.length - 1];

      multi.roomRef.update({
        status: 'playing',
        currentRound: currentRound + 1,
        p1Wins: p1Wins,
        p2Wins: p2Wins,
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
    }, 2000);
    return;
  }

  // 최종 게임 종료 (1라운드 or 마지막 라운드)
  const myData = room[multi.playerId];
  const opId = multi.playerId === 'p1' ? 'p2' : 'p1';
  const opData = room[opId];

  const myWins = multi.playerId === 'p1' ? p1Wins : p2Wins;
  const opWins = multi.playerId === 'p1' ? p2Wins : p1Wins;

  let finalWin;
  if (totalRounds === 1) {
    finalWin = iWin;
  } else {
    finalWin = myWins > opWins; // 다중 라운드: 라운드 승수 비교
  }

  const myScore = myData.score || 0;
  let earnedExp = finalWin ? 15 : Math.max(2, Math.floor(myScore * 0.03));
  // 점수 비례 보너스: 총점의 5%
  earnedExp += Math.floor(myScore * 0.05);
  // 다중 라운드 보너스: 라운드 승리 1회당 +3
  if (totalRounds > 1) earnedExp += myWins * 3;
  if (multi.turnCount >= 2 || totalRounds > 1) {
    addExp(earnedExp);
    const p = getActiveProfile();
    if (finalWin) p.wins++; else p.losses++;
    saveProfile();
  }

  lastGameWasMulti = true;
  lastMultiGame = {
    roomCode: multi.roomId,
    wasHost: multi.isHost,
    roomRef: multi.roomRef,
    modes: room.modes || {},
    totalRounds: totalRounds,
    p1: room.p1,
    p2: room.p2
  };

  setTimeout(() => {
    const title = document.getElementById('gameover-title');
    title.textContent = finalWin ? '승리!' : '패배...';
    title.className = 'gameover-title ' + (finalWin ? 'win' : 'lose');

    document.getElementById('final-player-score').textContent = (myData.score || 0) + '점';
    document.getElementById('final-bot-score').textContent = (opData.score || 0) + '점';
    document.getElementById('final-bot-name').textContent = opData.nickname;

    let reasonText = room.reason || '';
    if (totalRounds > 1) reasonText = `${totalRounds}라운드 종료! (${myWins}승 ${opWins}패) ` + reasonText;
    reasonText += (earnedExp > 0 ? ` (+${earnedExp} EXP)` : ' (+0 EXP)');
    document.getElementById('gameover-reason').textContent = reasonText;

    multi.listeners.forEach(fn => fn());
    multi.listeners = [];

    showScreen('screen-gameover');
    resetMultiState();
  }, 500);
}

// 멀티 리게임 - 같은 멤버, 같은 세팅으로 새 방 생성
async function multiRematch() {
  if (!lastMultiGame || !db) return;

  const p = getActiveProfile();
  const code = generateRoomCode();
  const ref = db.ref('rooms/' + code);

  const roomData = {
    code: code,
    status: 'waiting',
    createdAt: firebase.database.ServerValue.TIMESTAMP,
    modes: lastMultiGame.modes,
    totalRounds: lastMultiGame.totalRounds,
    currentRound: 1,
    rematchFrom: lastMultiGame.roomCode,
    p1: {
      nickname: p.nickname,
      level: p.level,
      userId: p.userId,
      score: 0,
      online: true,
      ready: true
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

  // 이전 방 삭제
  if (lastMultiGame.roomRef) {
    try { await lastMultiGame.roomRef.remove(); } catch(e) {}
  }

  await ref.set(roomData);

  multi.roomId = code;
  multi.roomRef = ref;
  multi.playerId = 'p1';
  multi.isHost = true;
  ref.child('p1/online').onDisconnect().set(false);

  showScreen('screen-multi-waiting');
  document.getElementById('room-code-display').textContent = code;
  displayRoomModes(lastMultiGame.modes, lastMultiGame.totalRounds);
  listenRoom();

  lastMultiGame = null;
}

// ==================== SCREEN HOOKS ====================

// showScreen 확장: 로비 진입 시 방 목록 리스닝
(function() {
  const _base = showScreen;
  showScreen = function(id) {
    _base(id);
    if (id === 'screen-multi-lobby') {
      startRoomListListener();
    } else {
      stopRoomListListener();
    }
  };
})();

// ==================== MULTI TYPING INDICATOR ====================

let multiTypingDebounce = null;
let multiTypingListener = null;

function updateMultiTyping(text) {
  if (!db || !multi.roomId || !multi.playerId) return;
  const field = multi.playerId + 'Typing';
  const val = text && text.length > 0 ? text.substring(0, 50) : null;
  console.log('[TYPING] updateMultiTyping writing:', {field, val, text});
  db.ref('rooms/' + multi.roomId).update({ [field]: val })
    .then(() => console.log('[TYPING] write OK:', val))
    .catch(e => console.log('[TYPING] write ERR:', e));
}

function listenMultiTyping() {
  // 룸 객체를 통해 들어오므로 별도 리스너 불필요
}

function refreshMultiPlaceholder() {
  const input = document.getElementById('multi-word-input');
  const overlay = document.getElementById('multi-typing-overlay');
  if (!input || !overlay) return;
  // 내가 입력중이 아니고, 상대가 타이핑 중이면 오버레이 표시 (placeholder 대신)
  const showOverlay = input.value.length === 0 && !multi.isMyTurn && multi.opponentTyping;
  if (showOverlay) {
    overlay.textContent = multi.opponentTyping;
    overlay.style.display = '';
    input.placeholder = '';
  } else {
    overlay.style.display = 'none';
    overlay.textContent = '';
    input.placeholder = '단어를 입력하세요...';
  }
}

function stopMultiTypingListener() {
  if (!db || !multi.roomId || !multi.playerId) return;
  const field = multi.playerId + 'Typing';
  db.ref('rooms/' + multi.roomId).update({ [field]: null });
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
    updateMultiTyping(multiInput.value);
    if (submitPending) { submitPending = false; submitMultiWord(); }
  });
  multiInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (composing || e.isComposing) { submitPending = true; return; }
      submitMultiWord();
    }
  });
  multiInput.addEventListener('input', () => {
    refreshMultiPlaceholder();
    if (multiTypingDebounce) clearTimeout(multiTypingDebounce);
    multiTypingDebounce = setTimeout(() => updateMultiTyping(multiInput.value), 50);
  });
});
