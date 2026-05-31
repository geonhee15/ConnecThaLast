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
let selectedGameLang = 'ko'; // 'ko' or 'en' — multiplayer 게임 언어
let selectedMaxPlayers = 2;  // v3.2.0+ 인원수 (2~30)

function selectRound(n, btn) {
  selectedRounds = n;
  document.querySelectorAll('.round-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

function setMaxPlayers(n) {
  selectedMaxPlayers = Math.max(2, Math.min(30, parseInt(n, 10) || 2));
  const input = document.getElementById('room-max-players');
  if (input) input.value = selectedMaxPlayers;
}
function adjustMaxPlayers(delta) {
  setMaxPlayers(selectedMaxPlayers + delta);
}

function setRoomGameLang(lang) {
  selectedGameLang = lang;
  const koBtn = document.getElementById('room-lang-ko');
  const enBtn = document.getElementById('room-lang-en');
  if (koBtn && enBtn) {
    koBtn.classList.toggle('active', lang === 'ko');
    enBtn.classList.toggle('active', lang === 'en');
  }
  // 영어 모드는 한국어 전용 옵션(어인정/매너/~다/자유두음) 숨김
  const koModesRow = document.getElementById('room-ko-modes-row');
  if (koModesRow) koModesRow.style.display = (lang === 'en') ? 'none' : '';
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
  const gameMode = (selectedGameLang === 'en') ? 'en' : 'ko';

  // 방 만들기 모드 설정 읽기 (영어 모드에서는 한국어 전용 옵션 무시)
  const roomModes = (gameMode === 'en') ? {
    manner: false, noda: false, freedueum: false, injeong: false
  } : {
    manner: document.getElementById('room-mode-manner').classList.contains('active'),
    noda: document.getElementById('room-mode-noda').classList.contains('active'),
    freedueum: document.getElementById('room-mode-freedueum').classList.contains('active'),
    injeong: document.getElementById('room-mode-injeong').classList.contains('active')
  };

  const roomTitle = (document.getElementById('room-title-input').value || '').trim() || null;

  const roomData = {
    code: code,
    title: roomTitle,
    status: 'waiting',
    createdAt: firebase.database.ServerValue.TIMESTAMP,
    gameMode: gameMode,
    modes: roomModes,
    totalRounds: selectedRounds,
    currentRound: 1,
    maxPlayers: selectedMaxPlayers,
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
    displayRoomModes(roomModes, selectedRounds, gameMode, selectedMaxPlayers);
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
    // v3.2.0+: 첫 빈 슬롯 찾기 (p2..pN)
    const maxP = room.maxPlayers || 2;
    let mySlot = null;
    for (let i = 2; i <= maxP; i++) {
      const k = 'p' + i;
      const sd = room[k];
      if (!sd || !sd.online) { mySlot = k; break; }
    }
    if (!mySlot) {
      document.getElementById('multi-lobby-msg').textContent = '방이 이미 가득 찼습니다.';
      return;
    }

    await ref.child(mySlot).set({
      nickname: p.nickname,
      level: p.level,
      userId: p.userId,
      score: 0,
      online: true,
      ready: false
    });

    multi.roomId = code;
    multi.roomRef = ref;
    multi.playerId = mySlot;
    multi.isHost = false;

    ref.child(mySlot + '/online').onDisconnect().set(false);

    showScreen('screen-multi-waiting');
    document.getElementById('room-code-display').textContent = code;
    showWaitingRoomTitle(room.title);
    displayRoomModes(room.modes, room.totalRounds, room.gameMode, room.maxPlayers);
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

function displayRoomModes(roomModes, totalRounds, gameMode, maxPlayers) {
  const el = document.getElementById('waiting-modes');
  if (!el) return;
  const tags = [];
  const langTag = (gameMode === 'en') ? t('select.enGame') : t('select.koGame');
  tags.push(langTag);
  if (gameMode !== 'en' && roomModes) {
    if (roomModes.manner) tags.push(t('select.modeManner'));
    if (roomModes.noda) tags.push(t('select.modeNoda'));
    if (roomModes.freedueum) tags.push(t('select.modeFreedueum'));
    if (roomModes.injeong) tags.push(t('select.modeInjeong'));
  }
  let text = t('multi.modesPrefix') + ' ' + tags.join(', ');
  if (totalRounds > 1) text += ` | ${totalRounds}` + (userSettings.lang === 'en' ? ' rounds' : '라운드');
  if (maxPlayers && maxPlayers > 2) text += ` | ${maxPlayers}` + (userSettings.lang === 'en' ? 'P' : '인');
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

  // v3.2.0+: 본인 슬롯의 ready 토글
  const ref = multi.roomRef.child(multi.playerId + '/ready');
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
      list.innerHTML = `<div class="room-list-empty">${t('multi.noRooms')}</div>`;
      return;
    }

    let count = 0;
    for (const [code, room] of Object.entries(rooms)) {
      if (!room.p1 || !room.p1.online) continue;
      // v3.2.0+: 빈 자리가 있는 방만 표시
      const maxP = room.maxPlayers || 2;
      let joined = 0;
      for (let i = 1; i <= maxP; i++) {
        if (room['p' + i] && room['p' + i].online) joined++;
      }
      if (joined >= maxP) continue;
      count++;

      const modeTags = [];
      const roomLang = room.gameMode === 'en' ? 'en' : 'ko';
      modeTags.push(roomLang === 'en' ? 'EN' : 'KO');
      if (roomLang === 'ko' && room.modes) {
        if (room.modes.manner) modeTags.push(t('select.modeManner'));
        if (room.modes.noda) modeTags.push(t('select.modeNoda'));
        if (room.modes.freedueum) modeTags.push(t('select.modeFreedueum'));
        if (room.modes.injeong) modeTags.push(t('select.modeInjeong'));
      }
      if (room.totalRounds > 1) modeTags.push(room.totalRounds + (userSettings.lang === 'en' ? 'R' : '라운드'));
      modeTags.push(`${joined}/${maxP}` + (userSettings.lang === 'en' ? 'P' : '명'));

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
      list.innerHTML = `<div class="room-list-empty">${t('multi.noRooms')}</div>`;
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
      // v3.2.0+: 본인 슬롯만 비우기 (p2 하드코딩 X)
      await multi.roomRef.child(multi.playerId).remove();
    }
  }
  resetMultiState();
  showScreen('screen-multi-lobby');
}

function resetMultiState() {
  stopMultiTypingListener();
  state.roomFreeDueum = false;
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

// v3.2.0+: N인 대기실 — 슬롯을 maxPlayers만큼 동적 생성
function updateWaitingUI(room) {
  const maxP = room.maxPlayers || 2;
  const container = document.querySelector('#screen-multi-waiting .waiting-players');
  const statusEl = document.getElementById('waiting-status');
  const startBtn = document.getElementById('btn-multi-start');
  const readyBtn = document.getElementById('btn-multi-ready');

  if (container) {
    container.classList.toggle('waiting-many', maxP > 2);

    // 슬롯 카드 (필요 시 한 번에 다시 그림)
    const slotsNeeded = maxP;
    let html = '';
    for (let i = 1; i <= maxP; i++) {
      const pkey = 'p' + i;
      const pd = room[pkey];
      const isHostSlot = (i === 1);
      let badge, name, avatarStyle = '';
      if (pd && pd.online) {
        const isReady = pd.ready;
        badge = isHostSlot
          ? `<div class="ready-badge ready">${t('multi.host')}</div>`
          : `<div class="ready-badge ${isReady ? 'ready' : 'not-ready'}">${isReady ? t('multi.ready') : t('multi.notReady')}</div>`;
        name = `<div class="waiting-name">${pd.nickname}<br><span style="font-size:0.75rem;color:#888">Lv.${pd.level}</span></div>`;
      } else {
        badge = '';
        name = `<div class="waiting-name" style="color:#ccc">${t('multi.waiting')}</div>`;
        avatarStyle = ' style="opacity:0.3"';
      }
      html += `<div class="waiting-player" id="waiting-${pkey}">
        <div class="waiting-avatar"${avatarStyle}>&#128100;</div>
        ${name}
        ${badge}
      </div>`;
      // 2명 모드일 때만 VS
      if (maxP === 2 && i === 1) {
        html += `<div class="waiting-vs" data-i18n="game.vs">VS</div>`;
      }
    }
    container.innerHTML = html;
  }

  // 준비 상태 집계
  let onlineGuests = 0, readyGuests = 0;
  for (let i = 2; i <= maxP; i++) {
    const pd = room['p' + i];
    if (pd && pd.online) {
      onlineGuests++;
      if (pd.ready) readyGuests++;
    }
  }
  const allFilledAndReady = onlineGuests === (maxP - 1) && readyGuests === onlineGuests;

  if (multi.isHost) {
    if (onlineGuests === 0) {
      statusEl.textContent = t('multi.waitingOpponent');
      startBtn.style.display = 'none';
    } else if (!allFilledAndReady) {
      // 빈 자리 있거나 미준비 게스트 있음
      statusEl.textContent = (onlineGuests < maxP - 1)
        ? t('multi.waitingOpponent')
        : t('multi.opponentNotReady');
      startBtn.style.display = 'none';
    } else {
      statusEl.textContent = t('multi.allReady');
      startBtn.style.display = '';
    }
    if (readyBtn) readyBtn.style.display = 'none';
  } else {
    // 게스트
    startBtn.style.display = 'none';
    const myData = room[multi.playerId];
    const isReady = myData && myData.ready;
    if (readyBtn) {
      readyBtn.style.display = '';
      readyBtn.textContent = isReady ? t('multi.cancelReady') : t('multi.readyBtn');
      readyBtn.setAttribute('class', isReady ? 'btn btn-secondary btn-large' : 'btn btn-primary btn-large');
      readyBtn.onclick = toggleReady;
    }
    statusEl.textContent = isReady ? t('multi.waitingHost') : t('multi.pressReady');
  }
}

// ==================== GAME START ====================

async function startMultiGame() {
  if (!multi.isHost || !multi.roomRef) return;

  preloadAudio();

  // 방에 저장된 gameMode + maxPlayers 읽기
  const snap = await multi.roomRef.get();
  const room = snap.val() || {};
  const gameMode = room.gameMode || 'ko';
  const maxP = room.maxPlayers || 2;
  state.gameLang = gameMode;

  const startWord = getRandomStartWord();
  const lastChar = startWord[startWord.length - 1];
  // v3.2.0+: 첫 턴 무작위 (p1 ~ pN 중 온라인 슬롯)
  const onlinePlayers = [];
  for (let i = 1; i <= maxP; i++) {
    if (room['p' + i] && room['p' + i].online) onlinePlayers.push('p' + i);
  }
  const firstTurn = onlinePlayers[Math.floor(Math.random() * onlinePlayers.length)] || 'p1';

  multi.roomRef.update({
    status: 'playing',
    turn: firstTurn,
    turnCount: 1,
    timerMax: 10,
    currentWord: startWord,
    nextChar: lastChar,
    usedWords: startWord,
    lastAction: {
      type: 'start',
      word: startWord,
      by: 'system',
      timestamp: Date.now()
    }
  });
}

// ==================== GAME UPDATE HANDLER ====================

let lastActionTimestamp = 0;

function handleGameUpdate(room) {
  // 룸의 게임 언어를 클라이언트 상태에 반영 (검증/사전 helper가 자동 분기)
  state.gameLang = room.gameMode === 'en' ? 'en' : 'ko';
  multi.gameMode = state.gameLang;
  // 룸 모드 적용 (자유두음 등) — 영어 모드에서는 의미 없음
  state.roomFreeDueum = (state.gameLang === 'ko') && !!(room.modes && room.modes.freedueum);

  const currentScreen = document.querySelector('.screen.active');
  if (currentScreen && currentScreen.id === 'screen-multi-waiting') {
    showScreen('screen-multi-game');
    initMultiGameUI(room);
  }

  const maxP = room.maxPlayers || 2;
  // v3.2.0+: 모든 슬롯의 이름/점수 갱신
  for (let i = 1; i <= maxP; i++) {
    const pkey = 'p' + i;
    const pd = room[pkey];
    const nameEl = document.getElementById('multi-' + pkey + '-name');
    const scoreEl = document.getElementById('multi-' + pkey + '-score');
    if (nameEl && pd) {
      nameEl.innerHTML = pd.nickname + ' ' + roleBadgeHTML(pd.nickname, 32);
    } else if (nameEl) {
      nameEl.innerHTML = `<span style="opacity:0.5">${t('multi.waiting')}</span>`;
    }
    if (scoreEl) animateScoreUpdate('multi-' + pkey + '-score', (pd && pd.score) || 0);
  }
  // 현재 턴 플레이어 강조 (N>2일 때만 outline 표시)
  document.querySelectorAll('#screen-multi-game .player-panel').forEach(el => {
    el.classList.toggle('turn-active', el.dataset.pkey === room.turn);
  });
  const totalRounds = room.totalRounds || 1;
  const currentRound = room.currentRound || 1;

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
  refreshMultiPlaceholder();

  const turnInd = document.getElementById('multi-turn-indicator');
  const input = document.getElementById('multi-word-input');
  const btn = document.getElementById('multi-submit-btn');

  if (multi.isMyTurn) {
    turnInd.textContent = t('game.myTurn');
    turnInd.className = 'turn-indicator my-turn';
    btn.disabled = false;
    input.focus();
  } else {
    // v3.2.0+: 현재 턴 플레이어의 닉네임 조회
    const turnData = room[room.turn] || {};
    const opName = turnData.nickname || '?';
    turnInd.textContent = t('multi.opponentTurn', opName);
    turnInd.className = 'turn-indicator bot-turn';
    btn.disabled = true;
  }

  if (room.lastAction && room.lastAction.timestamp > lastActionTimestamp) {
    lastActionTimestamp = room.lastAction.timestamp || Date.now();

    // 게스트가 타임아웃 → 호스트가 다음 라운드 시작
    if (room.lastAction.type === 'roundFail') {
      handleMultiRoundFailIfHost(room);
    }

    // 애니메이션 중 타이머 정지
    stopMultiTimer();

    // 새 라운드 시작 시 입력칸 정리 (이전 라운드의 누적 타이핑 제거)
    if (room.lastAction.type === 'start') {
      const input = document.getElementById('multi-word-input');
      if (input) input.value = '';
      updateMultiTyping('');
      const overlay = document.getElementById('multi-typing-overlay');
      if (overlay) { overlay.style.display = 'none'; overlay.textContent = ''; }
    }

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

  // v3.2.0+: maxPlayers에 맞춰 게임 화면 플레이어 영역 동적 구성
  buildMultiPlayersArea(room);

  // 타이핑 리스너 시작
  listenMultiTyping();
  // WAV 파일 프리로드 (백그라운드)
  preloadAudio();
}

// v3.2.0+: 게임 화면 플레이어 패널을 maxPlayers만큼 생성
function buildMultiPlayersArea(room) {
  const maxP = room.maxPlayers || 2;
  const container = document.querySelector('#screen-multi-game .players-area');
  if (!container) return;
  container.classList.toggle('players-area-many', maxP > 2);

  let html = '';
  for (let i = 1; i <= maxP; i++) {
    const pkey = 'p' + i;
    const pd = room[pkey];
    const isMe = pkey === multi.playerId;
    const cls = isMe ? 'player-me' : (maxP === 2 ? 'player-bot' : '');
    html += `<div class="player-panel ${cls}" data-pkey="${pkey}">
      <div class="player-avatar">&#128100;</div>
      <div class="player-name" id="multi-${pkey}-name">${(pd && pd.nickname) || t('multi.waiting')}</div>
      <div class="player-score" id="multi-${pkey}-score">0${t('game.scoreSuffix')}</div>
    </div>`;
    if (maxP === 2 && i === 1) {
      html += `<div class="vs-text">VS</div>`;
    }
  }
  container.innerHTML = html;
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
  // v3.1.1+: 타임아웃 = 실패한 쪽 페널티 -25점, 다음 라운드 진행 (마지막 라운드면 최종 종료)
  const failedField = multi.playerId; // 내가 타임아웃 → 내 점수 깎임
  const input = document.getElementById('multi-word-input');
  if (input) input.value = '';
  updateMultiTyping('');

  const snap = await multi.roomRef.get();
  const room = snap.val();
  if (!room) return;
  const curScore = (room[failedField] && room[failedField].score) || 0;
  const newScore = Math.max(0, curScore - (typeof FAIL_PENALTY !== 'undefined' ? FAIL_PENALTY : 25));

  const totalRounds = room.totalRounds || 1;
  const currentRound = room.currentRound || 1;

  if (totalRounds > 1 && currentRound < totalRounds) {
    // 호스트만 다음 라운드 트리거 (양쪽이 동시에 update하지 않도록)
    if (!multi.isHost) {
      // 호스트가 처리하도록 점수만 갱신
      await multi.roomRef.update({
        [`${failedField}/score`]: newScore,
        lastAction: {
          type: 'roundFail',
          by: failedField,
          timestamp: Date.now()
        }
      });
      return;
    }
    // 점수 감점 + 다음 라운드 시작 (v3.2.0+: N인 무작위 첫 턴)
    state.gameLang = room.gameMode === 'en' ? 'en' : 'ko';
    const startWord = getRandomStartWord();
    const lastChar = startWord[startWord.length - 1];
    const maxP = room.maxPlayers || 2;
    const onlinePlayers = [];
    for (let i = 1; i <= maxP; i++) {
      if (room['p' + i] && room['p' + i].online) onlinePlayers.push('p' + i);
    }
    const firstTurn = onlinePlayers[Math.floor(Math.random() * onlinePlayers.length)] || 'p1';
    const midUpdates = {
      [`${failedField}/score`]: newScore,
      currentRound: currentRound + 1,
      turn: firstTurn,
      turnCount: 1,
      timerMax: 10,
      currentWord: startWord,
      nextChar: lastChar,
      usedWords: startWord,
      lastAction: {
        type: 'start',
        word: startWord,
        by: 'system',
        timestamp: Date.now()
      }
    };
    // v3.2.1+: 1대1 라운드 패배 → 상대방 보너스 +25
    if (maxP === 2) {
      const oppKey = failedField === 'p1' ? 'p2' : 'p1';
      const oppCur = (room[oppKey] && room[oppKey].score) || 0;
      midUpdates[`${oppKey}/score`] = oppCur + (typeof DUEL_WIN_BONUS !== 'undefined' ? DUEL_WIN_BONUS : 25);
    }
    await multi.roomRef.update(midUpdates);
  } else {
    // 마지막 라운드: 페널티 적용 후 (1대1이면 상대 보너스) 모든 슬롯 중 최고 점수가 승자
    const maxP = room.maxPlayers || 2;
    const finalUpdates = {
      [`${failedField}/score`]: newScore,
      status: 'finished',
      reason: t('game.timeoutShort')
    };
    // v3.2.1+: 1대1이면 상대방 보너스
    if (maxP === 2) {
      const oppKey = failedField === 'p1' ? 'p2' : 'p1';
      const oppCur = (room[oppKey] && room[oppKey].score) || 0;
      finalUpdates[`${oppKey}/score`] = oppCur + (typeof DUEL_WIN_BONUS !== 'undefined' ? DUEL_WIN_BONUS : 25);
    }
    // 최고 점수 슬롯 찾기 (보너스 반영 후)
    let topKey = failedField, topScore = newScore;
    for (let i = 1; i <= maxP; i++) {
      const pk = 'p' + i;
      if (pk === failedField) continue;
      const s = (finalUpdates[`${pk}/score`] != null)
        ? finalUpdates[`${pk}/score`]
        : ((room[pk] && room[pk].score) || 0);
      if (s > topScore) { topScore = s; topKey = pk; }
    }
    finalUpdates.winner = topKey;
    await multi.roomRef.update(finalUpdates);
  }
}

// 게스트(호스트 아님)도 점수 감점을 호스트가 다음 라운드와 함께 처리하도록 보조
async function handleMultiRoundFailIfHost(room) {
  if (!multi.isHost || !multi.roomRef) return;
  const last = room.lastAction;
  if (!last || last.type !== 'roundFail') return;
  // 호스트가 다음 라운드 시작
  const totalRounds = room.totalRounds || 1;
  const currentRound = room.currentRound || 1;
  if (currentRound >= totalRounds) return;
  state.gameLang = room.gameMode === 'en' ? 'en' : 'ko';
  const startWord = getRandomStartWord();
  const lastChar = startWord[startWord.length - 1];
  // v3.2.0+: N인 무작위 첫 턴
  const maxP = room.maxPlayers || 2;
  const onlinePlayers = [];
  for (let i = 1; i <= maxP; i++) {
    if (room['p' + i] && room['p' + i].online) onlinePlayers.push('p' + i);
  }
  const firstTurn = onlinePlayers[Math.floor(Math.random() * onlinePlayers.length)] || 'p1';
  await multi.roomRef.update({
    currentRound: currentRound + 1,
    turn: firstTurn,
    turnCount: 1,
    timerMax: 10,
    currentWord: startWord,
    nextChar: lastChar,
    usedWords: startWord,
    lastAction: {
      type: 'start',
      word: startWord,
      by: 'system',
      timestamp: Date.now()
    }
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

  // v3.1.1+: 새 점수 체계 — calculateScore(game.js) 공유 사용
  const score = calculateScore(word);
  const lastChar = word[word.length - 1];
  // v3.2.0+: N인 턴 사이클 — 다음 슬롯이 온라인이 아닐 경우 계속 다음으로
  const roomSnap = await multi.roomRef.get();
  const roomNow = roomSnap.val() || {};
  const maxP = roomNow.maxPlayers || 2;
  const myIdx = parseInt(multi.playerId.slice(1), 10);
  let nextTurn = null;
  for (let step = 1; step <= maxP; step++) {
    const candIdx = ((myIdx - 1 + step) % maxP) + 1;
    const candKey = 'p' + candIdx;
    if (roomNow[candKey] && roomNow[candKey].online) { nextTurn = candKey; break; }
  }
  if (!nextTurn) nextTurn = multi.playerId; // fallback (혼자 남음)
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
      timestamp: Date.now()
    }
  });
}

function validateMultiWord(word) {
  if (word.length < 2) return t('msg.minLength');

  if (multi.usedWords.size > 0) {
    const nextCharEl = document.getElementById('multi-next-char');
    const match = nextCharEl.innerHTML.match(/<strong>(.)<\/strong>/);
    if (match) {
      const nc = match[1];
      if (!isValidChain(nc, word)) {
        const alts = getAlternativeChars(nc);
        return t('msg.startsWith', alts.join(', '));
      }
    }
  }

  if (multi.usedWords.has(word)) return t('msg.alreadyUsed');
  if (!isValidWord(word)) return t('msg.notInDict');
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
  const maxP = room.maxPlayers || 2;

  // v3.2.0+: 모든 슬롯 점수 수집
  const allPlayers = [];
  for (let i = 1; i <= maxP; i++) {
    const pd = room['p' + i];
    if (!pd) continue;
    const s = pd.score || 0;
    allPlayers.push({
      pkey: 'p' + i,
      score: s,
      nickname: pd.nickname,
      isMe: ('p' + i) === multi.playerId
    });
  }
  // 점수 내림차순 정렬 + 등수 매기기 (동점 처리: 같은 등수)
  allPlayers.sort((a, b) => b.score - a.score);
  if (allPlayers.length > 0) {
    allPlayers[0].rank = 1;
    for (let i = 1; i < allPlayers.length; i++) {
      allPlayers[i].rank = (allPlayers[i].score === allPlayers[i - 1].score)
        ? allPlayers[i - 1].rank
        : (i + 1);
    }
  }
  const topKey = allPlayers[0] ? allPlayers[0].pkey : null;
  const myData = room[multi.playerId] || { score: 0, nickname: '' };
  const myScore = myData.score || 0;
  const myEntry = allPlayers.find(p => p.isMe);
  const myRank = myEntry ? myEntry.rank : allPlayers.length;
  const finalWin = (topKey === multi.playerId);

  // 비교 화면용 (2P): 가장 점수 높은 다른 슬롯
  const opData = allPlayers.find(p => !p.isMe) || { score: 0, nickname: '?' };
  const opScore = opData.score || 0;

  // v3.2.1+: 등수 기반 EXP — 1등이 가장 많이, 등수 내려갈수록 적게
  function _expByRank(rank) {
    if (rank === 1) return 15;
    if (rank === 2) return 10;
    if (rank === 3) return 7;
    if (rank === 4) return 5;
    return 3;
  }
  let earnedExp;
  if (maxP === 2) {
    // 2P: 기존 공식 유지
    earnedExp = finalWin ? 15 : Math.max(2, Math.floor(myScore * 0.03));
  } else {
    earnedExp = _expByRank(myRank);
  }
  earnedExp += Math.floor(myScore * 0.05);
  if (multi.turnCount >= 2 || totalRounds > 1) {
    addExp(earnedExp);
    const p = getActiveProfile();
    if (maxP === 2) {
      // 2P: 기존 승/패 카운트 유지
      if (finalWin) p.wins++; else p.losses++;
    } else {
      // v3.2.1+: 3+ 게임은 1등만 wins++, 나머지는 카운트 안 함
      if (myRank === 1) p.wins++;
    }
    saveProfile();
  }

  lastGameWasMulti = true;
  lastMultiGame = {
    roomCode: multi.roomId,
    wasHost: multi.isHost,
    roomRef: multi.roomRef,
    modes: room.modes || {},
    gameMode: room.gameMode || 'ko',
    maxPlayers: maxP,
    totalRounds: totalRounds,
    p1: room.p1,
    p2: room.p2
  };

  setTimeout(() => {
    const title = document.getElementById('gameover-title');
    const resultContainer = document.querySelector('#screen-gameover .gameover-result');

    if (maxP === 2) {
      // 2P: 기존 승/패 UI 유지
      title.textContent = finalWin ? t('game.win') : t('game.lose');
      title.className = 'gameover-title ' + (finalWin ? 'win' : 'lose');
      // 결과 패널 복구 (3+ 게임 후 리매치로 돌아왔을 수도 있음)
      resultContainer.innerHTML = `
        <div class="result-panel">
          <div class="result-label" data-i18n="game.player">${t('game.player')}</div>
          <div class="result-score" id="final-player-score">0${t('game.scoreSuffix')}</div>
        </div>
        <div class="result-vs" data-i18n="game.vs">${t('game.vs')}</div>
        <div class="result-panel">
          <div class="result-label" id="final-bot-name">${opData.nickname}</div>
          <div class="result-score" id="final-bot-score">0${t('game.scoreSuffix')}</div>
        </div>
      `;
      animateScoreUpdate('final-player-score', myScore);
      animateScoreUpdate('final-bot-score', opScore);
    } else {
      // v3.2.1+: 3+인 게임 — 등수 랭킹 표시
      const _ordinalLabel = (r) => {
        if (userSettings.lang === 'en') {
          const s = ['th', 'st', 'nd', 'rd'];
          const v = r % 100;
          return r + (s[(v - 20) % 10] || s[v] || s[0]);
        }
        return r + '등';
      };
      title.textContent = _ordinalLabel(myRank);
      title.className = 'gameover-title ' + (myRank === 1 ? 'win' : (myRank === allPlayers.length ? 'lose' : ''));
      let html = '<div class="gameover-rankings">';
      const medals = { 1: '🥇', 2: '🥈', 3: '🥉' };
      for (const p of allPlayers) {
        const meCls = p.isMe ? ' me' : '';
        const medal = medals[p.rank] || '';
        html += `<div class="rank-row${meCls}">
          <span class="rank-num">${medal} ${_ordinalLabel(p.rank)}</span>
          <span class="rank-name">${p.nickname}</span>
          <span class="rank-score">${p.score}${t('game.scoreSuffix')}</span>
        </div>`;
      }
      html += '</div>';
      resultContainer.innerHTML = html;
    }

    let reasonText = room.reason || '';
    if (maxP === 2 && totalRounds > 1) {
      reasonText = t('game.multiFinalScore', totalRounds, myScore, opScore) + ' ' + reasonText;
    } else if (maxP > 2) {
      reasonText = (totalRounds > 1 ? `${totalRounds}` + (userSettings.lang === 'en' ? 'R ' : '라운드 ') : '') +
                   `${maxP}` + (userSettings.lang === 'en' ? `P · ${myRank}` + (myRank === 1 ? 'st' : myRank === 2 ? 'nd' : myRank === 3 ? 'rd' : 'th') : `명 · ${myRank}등`) +
                   (reasonText ? ' · ' + reasonText : '');
    }
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
    gameMode: lastMultiGame.gameMode || 'ko',
    modes: lastMultiGame.modes,
    totalRounds: lastMultiGame.totalRounds,
    maxPlayers: lastMultiGame.maxPlayers || 2,
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
  displayRoomModes(lastMultiGame.modes, lastMultiGame.totalRounds, lastMultiGame.gameMode, lastMultiGame.maxPlayers);
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
  db.ref('rooms/' + multi.roomId).update({ [field]: val });
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
    overlay.style.display = 'block';
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
