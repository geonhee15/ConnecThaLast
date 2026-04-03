// ==================== AUTH SYSTEM ====================

let currentUser = null; // { nickname, userId, level, exp, totalExp, wins, losses }
let authMode = 'login'; // 'login' or 'register'

// SHA-256 해시 (Web Crypto API)
async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + '_connecthalast_salt');
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function switchAuthTab(mode) {
  authMode = mode;
  document.getElementById('tab-login').classList.toggle('active', mode === 'login');
  document.getElementById('tab-register').classList.toggle('active', mode === 'register');
  document.getElementById('auth-submit-btn').textContent = mode === 'login' ? '로그인' : '회원가입';
  document.getElementById('auth-message').textContent = '';
  document.getElementById('auth-message').className = 'auth-message';
}

async function handleAuth() {
  const nickname = document.getElementById('auth-nickname').value.trim();
  const password = document.getElementById('auth-password').value;
  const msgEl = document.getElementById('auth-message');

  if (!nickname || nickname.length < 2) {
    msgEl.textContent = '닉네임은 2글자 이상 입력하세요.';
    msgEl.className = 'auth-message error';
    return;
  }
  if (!password || password.length < 4) {
    msgEl.textContent = '비밀번호는 4자리 이상 입력하세요.';
    msgEl.className = 'auth-message error';
    return;
  }

  if (!db) {
    msgEl.textContent = '서버 연결에 실패했습니다.';
    msgEl.className = 'auth-message error';
    return;
  }

  const hashedPw = await hashPassword(password);
  const userRef = db.ref('users/' + nickname);

  if (authMode === 'register') {
    await handleRegister(nickname, hashedPw, userRef, msgEl);
  } else {
    await handleLogin(nickname, hashedPw, userRef, msgEl);
  }
}

async function handleRegister(nickname, hashedPw, userRef, msgEl) {
  try {
    const snap = await userRef.get();
    if (snap.exists()) {
      msgEl.textContent = '이미 사용 중인 닉네임입니다.';
      msgEl.className = 'auth-message error';
      return;
    }

    const userId = (nickname === '김건') ? 'DEV' : generateUserId();
    const userData = {
      nickname: nickname,
      userId: userId,
      password: hashedPw,
      level: 1,
      exp: 0,
      totalExp: 0,
      wins: 0,
      losses: 0,
      createdAt: firebase.database.ServerValue.TIMESTAMP
    };

    await userRef.set(userData);

    msgEl.textContent = '회원가입 완료! 로그인합니다...';
    msgEl.className = 'auth-message success';

    setTimeout(() => loginSuccess(userData), 500);
  } catch (e) {
    msgEl.textContent = '회원가입 실패: ' + e.message;
    msgEl.className = 'auth-message error';
  }
}

async function handleLogin(nickname, hashedPw, userRef, msgEl) {
  try {
    const snap = await userRef.get();
    if (!snap.exists()) {
      msgEl.textContent = '존재하지 않는 닉네임입니다.';
      msgEl.className = 'auth-message error';
      return;
    }

    const userData = snap.val();
    if (userData.password !== hashedPw) {
      msgEl.textContent = '비밀번호가 틀렸습니다.';
      msgEl.className = 'auth-message error';
      return;
    }

    loginSuccess(userData);
  } catch (e) {
    msgEl.textContent = '로그인 실패: ' + e.message;
    msgEl.className = 'auth-message error';
  }
}

function loginSuccess(userData) {
  currentUser = {
    nickname: userData.nickname,
    userId: userData.userId,
    level: userData.level || 1,
    exp: userData.exp || 0,
    totalExp: userData.totalExp || 0,
    wins: userData.wins || 0,
    losses: userData.losses || 0
  };

  // game.js의 profile과 동기화
  profile.nickname = currentUser.nickname;
  profile.userId = currentUser.userId;
  profile.level = currentUser.level;
  profile.exp = currentUser.exp;
  profile.totalExp = currentUser.totalExp;
  profile.wins = currentUser.wins;
  profile.losses = currentUser.losses;

  // 로컬에도 저장 (자동 로그인용)
  localStorage.setItem('connecthalast_session', JSON.stringify({
    nickname: currentUser.nickname,
    password: document.getElementById('auth-password').value
  }));

  saveProfile();
  updateProfileUI();
  loadReadNotices();
  checkUnreadNotices();
  showScreen('screen-home');
}

// 서버에 프로필 저장 (기존 saveProfile 확장)
const _origSaveProfile = saveProfile;
saveProfile = function() {
  _origSaveProfile(); // localStorage 저장

  // 서버에도 동기화
  if (currentUser && db) {
    const updates = {
      level: profile.level,
      exp: profile.exp,
      totalExp: profile.totalExp,
      wins: profile.wins,
      losses: profile.losses
    };
    db.ref('users/' + currentUser.nickname).update(updates).catch(() => {});
  }
};

// 로그아웃
function logout() {
  currentUser = null;
  localStorage.removeItem('connecthalast_session');
  document.getElementById('auth-nickname').value = '';
  document.getElementById('auth-password').value = '';
  document.getElementById('auth-message').textContent = '';
  showScreen('screen-login');
}

// 자동 로그인 시도
async function tryAutoLogin() {
  try {
    const session = JSON.parse(localStorage.getItem('connecthalast_session'));
    if (!session || !session.nickname || !session.password || !db) return false;

    const hashedPw = await hashPassword(session.password);
    const snap = await db.ref('users/' + session.nickname).get();
    if (!snap.exists()) return false;

    const userData = snap.val();
    if (userData.password !== hashedPw) return false;

    loginSuccess(userData);
    return true;
  } catch (e) {
    return false;
  }
}

// Enter 키로 로그인/회원가입
document.addEventListener('DOMContentLoaded', () => {
  ['auth-nickname', 'auth-password'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          handleAuth();
        }
      });
    }
  });

  // 자동 로그인 시도
  setTimeout(async () => {
    const ok = await tryAutoLogin();
    if (!ok) {
      showScreen('screen-login');
    }
  }, 100);
});
