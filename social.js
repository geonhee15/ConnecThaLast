// ==================== SOCIAL SYSTEM ====================

let socialListeners = [];
let currentChatPartner = null;
let chatListener = null;

// ==================== SIDEBAR TAB ====================

function switchSidebarTab(tab) {
  document.getElementById('sb-tab-notice').classList.toggle('active', tab === 'notice');
  document.getElementById('sb-tab-social').classList.toggle('active', tab === 'social');
  document.getElementById('sb-notice').style.display = tab === 'notice' ? '' : 'none';
  document.getElementById('sb-social').style.display = tab === 'social' ? '' : 'none';
  document.getElementById('sb-chat').style.display = 'none';

  if (tab === 'social') {
    loadOnlinePlayers();
    loadFriendRequests();
    loadFriends();
  }
  if (tab === 'notice') {
    loadNotices();
  }
}

// ==================== ONLINE PRESENCE ====================

function setOnline() {
  if (!db || !currentUser) return;
  const ref = db.ref('online/' + currentUser.nickname);
  ref.set({
    nickname: currentUser.nickname,
    level: profile.level,
    userId: currentUser.userId,
    timestamp: firebase.database.ServerValue.TIMESTAMP
  });
  ref.onDisconnect().remove();
}

function loadOnlinePlayers() {
  if (!db || !currentUser) return;
  const ref = db.ref('online');
  ref.off();
  ref.on('value', (snap) => {
    const list = document.getElementById('online-players-list');
    if (!snap.exists()) { list.innerHTML = '<div class="social-empty">접속 중인 플레이어가 없습니다</div>'; return; }

    let html = '';
    snap.forEach(child => {
      const u = child.val();
      if (u.nickname === currentUser.nickname) return; // 자기 제외
      const isFriend = isFriendWith(u.nickname);
      html += `<div class="social-row">
        <span><span class="social-online-dot"></span><span class="social-name">${u.nickname}</span><span class="social-level">Lv.${u.level || 1}</span></span>
        ${!isFriend ? `<button class="social-btn" onclick="sendFriendRequest('${u.nickname}')">친구추가</button>` : '<span style="font-size:0.7rem;color:#4caf50">친구</span>'}
      </div>`;
    });
    list.innerHTML = html || '<div class="social-empty">접속 중인 플레이어가 없습니다</div>';
  });
}

// ==================== FRIEND REQUESTS ====================

function sendFriendRequest(toNickname) {
  if (!db || !currentUser || toNickname === currentUser.nickname) return;
  db.ref('friendRequests/' + toNickname + '/' + currentUser.nickname).set({
    from: currentUser.nickname,
    level: profile.level,
    timestamp: firebase.database.ServerValue.TIMESTAMP
  });
  alert(toNickname + '님에게 친구 요청을 보냈습니다!');
}

function loadFriendRequests() {
  if (!db || !currentUser) return;
  const ref = db.ref('friendRequests/' + currentUser.nickname);
  ref.off();
  ref.on('value', (snap) => {
    const list = document.getElementById('friend-requests-list');
    const countEl = document.getElementById('friend-req-count');

    if (!snap.exists()) {
      list.innerHTML = '';
      countEl.textContent = '';
      return;
    }

    let html = '';
    let count = 0;
    snap.forEach(child => {
      const req = child.val();
      count++;
      html += `<div class="social-row">
        <span class="social-name">${req.from} <span class="social-level">Lv.${req.level || 1}</span></span>
        <span>
          <button class="social-btn accept" onclick="acceptFriend('${req.from}')">수락</button>
          <button class="social-btn reject" onclick="rejectFriend('${req.from}')">거절</button>
        </span>
      </div>`;
    });
    list.innerHTML = html;
    countEl.textContent = count > 0 ? `(${count})` : '';
    // 소셜 뱃지 업데이트
    const badge = document.getElementById('social-badge');
    if (badge) {
      badge.dataset.reqCount = count;
      const chatCount = parseInt(badge.dataset.chatCount || '0');
      const total = count + chatCount;
      if (total > 0) { badge.textContent = total; badge.style.display = ''; }
      else { badge.style.display = 'none'; }
    }
  });
}

function acceptFriend(fromNickname) {
  if (!db || !currentUser) return;
  const me = currentUser.nickname;
  // 양쪽 친구 목록에 추가
  db.ref('friends/' + me + '/' + fromNickname).set({ nickname: fromNickname, since: firebase.database.ServerValue.TIMESTAMP });
  db.ref('friends/' + fromNickname + '/' + me).set({ nickname: me, since: firebase.database.ServerValue.TIMESTAMP });
  // 요청 삭제
  db.ref('friendRequests/' + me + '/' + fromNickname).remove();
}

function rejectFriend(fromNickname) {
  if (!db || !currentUser) return;
  db.ref('friendRequests/' + currentUser.nickname + '/' + fromNickname).remove();
}

// ==================== FRIENDS LIST ====================

let friendsSet = new Set();

function isFriendWith(nickname) {
  return friendsSet.has(nickname);
}

function loadFriends() {
  if (!db || !currentUser) return;
  const ref = db.ref('friends/' + currentUser.nickname);
  ref.off();
  ref.on('value', (snap) => {
    const list = document.getElementById('friends-list');
    const countEl = document.getElementById('friend-count');
    friendsSet = new Set();

    if (!snap.exists()) {
      list.innerHTML = '<div class="social-empty">아직 친구가 없습니다</div>';
      countEl.textContent = '0';
      return;
    }

    let html = '';
    let count = 0;
    snap.forEach(child => {
      const f = child.val();
      friendsSet.add(f.nickname);
      count++;
      html += `<div class="social-row">
        <span class="social-name">${f.nickname}</span>
        <span>
          <button class="social-btn chat-btn" onclick="openChat('${f.nickname}')">채팅</button>
        </span>
      </div>`;
    });
    list.innerHTML = html;
    countEl.textContent = count;
  });
}

// ==================== CHAT ====================

function openChat(nickname) {
  currentChatPartner = nickname;
  document.getElementById('sb-social').style.display = 'none';
  document.getElementById('sb-chat').style.display = 'flex';
  document.getElementById('chat-partner-name').textContent = nickname;
  document.getElementById('chat-input').value = '';
  document.getElementById('chat-messages').innerHTML = '';
  document.getElementById('chat-typing-indicator').textContent = '';

  loadChatMessages(nickname);
  listenTypingStatus(nickname);
}

function closeChatPanel() {
  if (currentChatPartner && currentUser) {
    const chatId = getChatId(currentUser.nickname, currentChatPartner);
    db.ref('chats/' + chatId).off();
    db.ref('typing/' + chatId).off();
    // 내 타이핑 정보 제거
    db.ref('typing/' + chatId + '/' + currentUser.nickname).remove();
    chatListener = null;
    typingListener = null;
  }
  currentChatPartner = null;
  document.getElementById('sb-chat').style.display = 'none';
  document.getElementById('sb-social').style.display = '';
}

function getChatId(a, b) {
  return [a, b].sort().join('_');
}

function loadChatMessages(partner) {
  if (!db || !currentUser) return;
  const chatId = getChatId(currentUser.nickname, partner);
  const ref = db.ref('chats/' + chatId);

  if (chatListener) ref.off('child_added', chatListener);

  const container = document.getElementById('chat-messages');
  container.innerHTML = '';

  chatListener = ref.orderByChild('timestamp').on('child_added', (snap) => {
    const msg = snap.val();
    const msgId = snap.key;
    const isMine = msg.from === currentUser.nickname;
    const div = document.createElement('div');
    div.className = 'chat-msg ' + (isMine ? 'mine' : 'theirs');
    div.textContent = msg.text;

    // 읽음 표시 (내 메시지만)
    if (isMine && !msg.read) {
      const unread = document.createElement('span');
      unread.className = 'chat-unread';
      unread.id = 'unread-' + msgId;
      unread.textContent = '1';
      div.appendChild(unread);
    }

    // 상대 메시지면 읽음 처리
    if (!isMine && !msg.read) {
      ref.child(msgId).update({ read: true });
    }

    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
  });

  // 상대가 읽으면 1 제거 (실시간 감지)
  ref.on('child_changed', (snap) => {
    const msg = snap.val();
    if (msg.read && msg.from === currentUser.nickname) {
      const unreadEl = document.getElementById('unread-' + snap.key);
      if (unreadEl) unreadEl.remove();
    }
  });
}

function sendChat() {
  if (!db || !currentUser || !currentChatPartner) return;
  const input = document.getElementById('chat-input');
  const text = input.value.trim();
  if (!text) return;

  const chatId = getChatId(currentUser.nickname, currentChatPartner);
  db.ref('chats/' + chatId).push({
    from: currentUser.nickname,
    text: text,
    read: false,
    timestamp: firebase.database.ServerValue.TIMESTAMP
  });
  input.value = '';
  // 타이핑 정보 제거
  updateMyTyping('');
}

// ==================== UNREAD CHAT BADGE ====================

function listenUnreadChats() {
  if (!db || !currentUser) return;
  // 모든 친구와의 채팅에서 읽지 않은 메시지 수 체크
  db.ref('friends/' + currentUser.nickname).on('value', (snap) => {
    if (!snap.exists()) { updateSocialBadgeChat(0); return; }
    let totalUnread = 0;
    let pending = 0;
    const friends = [];
    snap.forEach(child => { friends.push(child.val().nickname); });
    if (friends.length === 0) { updateSocialBadgeChat(0); return; }

    friends.forEach(fn => {
      const chatId = getChatId(currentUser.nickname, fn);
      db.ref('chats/' + chatId).orderByChild('read').equalTo(false).once('value', (chatSnap) => {
        chatSnap.forEach(msgSnap => {
          const msg = msgSnap.val();
          if (msg.from !== currentUser.nickname) totalUnread++;
        });
        pending++;
        if (pending >= friends.length) {
          updateSocialBadgeChat(totalUnread);
        }
      });
    });
  });
}

function updateSocialBadgeChat(count) {
  const badge = document.getElementById('social-badge');
  if (!badge) return;
  // 친구 요청 수 + 읽지 않은 채팅 수
  const reqCount = parseInt(badge.dataset.reqCount || '0');
  const total = reqCount + count;
  if (total > 0) { badge.textContent = total; badge.style.display = ''; }
  else { badge.style.display = 'none'; }
  badge.dataset.chatCount = count;
}

// ==================== TYPING INDICATOR ====================

let typingListener = null;
let typingDebounce = null;

function updateMyTyping(text) {
  if (!db || !currentUser || !currentChatPartner) return;
  const chatId = getChatId(currentUser.nickname, currentChatPartner);
  const ref = db.ref('typing/' + chatId + '/' + currentUser.nickname);
  if (text && text.length > 0) {
    ref.set(text.substring(0, 100)); // 최대 100자
    ref.onDisconnect().remove();
  } else {
    ref.remove();
  }
}

function listenTypingStatus(partner) {
  if (!db || !currentUser) return;
  const chatId = getChatId(currentUser.nickname, partner);
  const ref = db.ref('typing/' + chatId + '/' + partner);

  typingListener = ref.on('value', (snap) => {
    const indicator = document.getElementById('chat-typing-indicator');
    if (!indicator) return;
    const text = snap.val();
    if (text) {
      indicator.textContent = partner + ': ' + text;
    } else {
      indicator.textContent = '';
    }
  });
}

// Chat Enter key (한글 IME 호환)
document.addEventListener('DOMContentLoaded', () => {
  const chatInput = document.getElementById('chat-input');
  if (!chatInput) return;
  let chatComposing = false;

  chatInput.addEventListener('compositionstart', () => { chatComposing = true; });
  chatInput.addEventListener('compositionend', () => {
    chatComposing = false;
    updateMyTyping(chatInput.value);
  });

  chatInput.addEventListener('input', () => {
    // 디바운싱 (50ms) - 너무 자주 쓰지 않게
    if (typingDebounce) clearTimeout(typingDebounce);
    typingDebounce = setTimeout(() => updateMyTyping(chatInput.value), 50);
  });
  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (chatComposing || e.isComposing) return;
      sendChat();
    }
  });
});
