// ==================== SETTINGS SYSTEM ====================
const SETTINGS_KEY = 'ctl_settings_v1';

const DEFAULT_SETTINGS = {
  bgmVolume: 30,
  sfxVolume: 100,
  lang: 'ko'
};

let userSettings = { ...DEFAULT_SETTINGS };
let sfxUserVolume = 1.0;

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      userSettings = { ...DEFAULT_SETTINGS, ...parsed };
    }
  } catch (e) {}
  sfxUserVolume = (userSettings.sfxVolume || 0) / 100;
}

function saveSettings() {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(userSettings)); } catch(e) {}
}

function getSetting(key) { return userSettings[key]; }
function setSetting(key, val) { userSettings[key] = val; saveSettings(); }

function setSFXVolume(val) {
  const v = Math.max(0, Math.min(100, +val || 0));
  userSettings.sfxVolume = v;
  sfxUserVolume = v / 100;
  saveSettings();
  const t = document.getElementById('sfx-vol-text');
  if (t) t.textContent = Math.round(v) + '%';
}

// ==================== I18N ====================
const I18N = {
  ko: {
    // Common
    'common.back': '← 뒤로',
    'common.loading': '불러오는 중...',
    'common.cancel': '취소',
    'common.confirm': '확인',
    'common.copy': '복사',
    'common.send': '전송',
    'common.submit': '입력',
    'common.delete': '삭제',
    // Maintenance
    'maintenance.title': '업데이트 점검 중',
    'maintenance.desc': '더 나은 서비스를 위해 업데이트 점검을 진행하고 있습니다.<br>잠시만 기다려주세요!',
    'maintenance.next': '다음 업데이트:',
    'maintenance.features': '멀티플레이 최대 30명까지 지원 + 사전 단어 추가',
    'maintenance.adminPw': '관리자 비밀번호',
    'maintenance.enter': '접속',
    // Login
    'login.subtitle': '한글 끝말잇기',
    'login.tabLogin': '로그인',
    'login.tabRegister': '회원가입',
    'login.nicknamePh': '닉네임',
    'login.passwordPh': '비밀번호',
    'login.btnLogin': '로그인',
    'login.btnRegister': '회원가입',
    // Home
    'home.subtitle': '한글 끝말잇기',
    'home.soundRecommend': '🔊 소리를 키고 플레이하시는걸 권장드립니다',
    'home.serverNormal': '서버: 일반',
    'home.serverTest': '서버: 테스트',
    'home.player': '플레이어',
    'home.botBattle': '봇 대전',
    'home.multiplayer': '멀티플레이',
    'home.ranking': '랭킹',
    'home.dictionary': '단어 사전',
    'home.testServer': '테스트 서버',
    'home.bugReport': '💬 문의 / 버그제보',
    'home.settings': '설정',
    // Sidebar
    'sidebar.notice': '공지사항',
    'sidebar.social': '소셜',
    'sidebar.noticeTitle': '제목',
    'sidebar.noticeContent': '내용 작성...',
    'sidebar.noticeSubmit': '등록',
    'sidebar.onlinePlayers': '온라인 플레이어',
    'sidebar.friendRequests': '친구 요청',
    'sidebar.friends': '친구',
    'sidebar.messageInput': '메시지 입력...',
    // Profile
    'profile.title': '프로필',
    'profile.stats': '전적',
    'profile.wins': '승리',
    'profile.losses': '패배',
    'profile.totalExp': '총 경험치',
    'profile.winrate': '승률',
    'profile.bugReport': '문의 / 버그제보',
    'profile.logout': '로그아웃',
    // Select (bot game setup)
    'select.gameType': '게임 종류',
    'select.koGame': '한국어 끝말잇기',
    'select.enGame': '영어 끝말잇기 (English Word Chain)',
    'select.modes': '모드',
    'select.modeManner': '매너',
    'select.modeNoda': '~다 금지',
    'select.modeFreedueum': '자유두음',
    'select.modeInjeong': '어인정',
    'select.modeDescDefault': '모드를 선택하세요 (복수 선택 가능)',
    'select.rounds': '라운드',
    'select.players': '인원수',
    'select.playersHint': '(2~30명)',
    'select.botLevel': '봇 레벨 선택',
    'select.boss': '보스전',
    'select.bossLocked': 'Lv.10 이상부터 입장 가능',
    'mode.mannerDesc': '매너: 한방단어 금지 (이을 수 없는 글자로 끝나는 단어 사용 불가)',
    'mode.nodaDesc': '~다 금지: "다"로 끝나는 단어 사용 불가',
    'mode.freedueumDesc': '자유두음: ㄴ/ㄹ/ㅇ 초성 자유 호환 (예: 륨 → 륨/늄/윰 다 가능)',
    'mode.injeongDesc': '어인정: 게임/애니/노래 제목 등 비표준 단어 허용',
    // Bot names + descriptions
    'bot.1.name': '초보봇',
    'bot.2.name': '중수봇',
    'bot.3.name': '고수봇',
    'bot.4.name': '좀고수봇',
    'bot.5.name': '초고수봇',
    'bot.6.name': '신봇',
    'bot.7.name': '롱봇',
    'bot.1.desc': '쉬운 단어 위주 사용<br>반응속도 느림 / 타이핑 느림',
    'bot.2.desc': '보통 단어 사용<br>반응속도 보통 / 타이핑 보통',
    'bot.3.desc': '어려운 단어도 사용<br>반응속도 빠름 / 타이핑 준수',
    'bot.4.desc': '단어 탐색 능력 우수 / 타이핑 빠름<br>한방단어를 잘 못 씀',
    'bot.5.desc': '희귀 단어까지 사용<br>반응속도 매우 빠름 / 타이핑 빠름',
    'bot.6.desc': '긴단어 60% + 한방단어 40%<br>초인적 반응 / 항상 플레이어 선공',
    'bot.7.desc': '6글자 이상 긴 단어 전문<br>반응속도 빠름 / 길이로 승부',
    // Game
    'game.leave': '나가기',
    'game.confirmLeave': '나가면 패배로 처리됩니다. 정말 나가시겠습니까?',
    'game.myTurn': '내 턴',
    'game.startWord': '제시어',
    'game.nextLetter': '다음 글자:',
    'game.nextLetterAlts': '({0} 가능)',
    'game.inputPh': '단어를 입력하세요...',
    'game.usedWordsLabel': '사용된 단어',
    'game.timeout': '시간 초과! 제한 시간 안에 단어를 입력하지 못했습니다.',
    'game.botTimeout': '봇이 시간 초과! 단어를 찾지 못했습니다.',
    'game.timeoutShort': '시간 초과!',
    'game.win': '승리!',
    'game.lose': '패배...',
    'game.player': '나',
    'game.bot': '봇',
    'game.vs': 'VS',
    'game.scoreSuffix': '점',
    'game.scoreWithWins': '{0}점 ({1}승)',
    'game.roundDisplay': '라운드 {0} / {1}',
    'game.roundOver': '라운드 {0} 종료 - {1}',
    'game.multiRoundOver': '{0}라운드 종료! ({1}승 {2}패)',
    'game.youFailed': '나 실패 -25점',
    'game.botFailed': '상대 실패 -25점',
    'game.multiFinalScore': '{0}라운드 종료! (나 {1}점 / 상대 {2}점)',
    'game.bossChallenge': '최강의 보스에 도전하라',
    'game.bossLocked': 'Lv.10 이상부터 입장 가능 (현재 Lv.{0})',
    'game.turnSuffix': ' 턴',
    // Validation messages
    'msg.minLength': '2글자 이상 입력하세요.',
    'msg.englishOnly': '영문자만 입력하세요.',
    'msg.startsWith': '"{0}"(으)로 시작하는 단어를 입력하세요.',
    'msg.alreadyUsed': '이미 사용한 단어입니다.',
    'msg.notInDict': '사전에 없는 단어입니다.',
    'msg.notStandard': '사전에 없는 단어입니다. (어인정 모드를 켜보세요)',
    'msg.daBanned': '"다"로 끝나는 단어는 사용할 수 없습니다.',
    'msg.killerBanned': '매너 모드: 한방단어는 사용할 수 없습니다.',
    // Game over screen
    'gameover.title': '게임 종료',
    'gameover.retry': '다시 하기',
    'gameover.home': '홈으로',
    // Settings
    'settings.title': '설정',
    'settings.audio': '오디오',
    'settings.bgmVolume': '배경음악 볼륨',
    'settings.sfxVolume': '효과음 볼륨',
    'settings.language': '언어 설정',
    'settings.lang.ko': '한국어',
    'settings.lang.en': 'English',
    // Dictionary
    'dict.title': '단어 사전',
    'dict.totalCount': '총 {0}개',
    'dict.searchPh': '단어 검색...',
    'dict.startChar': '시작 글자',
    'dict.endChar': '끝 글자',
    'dict.length': '글자수',
    'dict.lengthAll': '전체',
    'dict.lengthN': '{0}글자',
    'dict.lengthNPlus': '{0}글자 이상',
    'dict.killerRoute': '한방루트',
    'dict.killerOnly': '한방 단어만 보기',
    'dict.resultCount': '검색 결과: {0}개{1}',
    'dict.killerSuffix': ' (한방 단어)',
    // Multi (lobby + game basics)
    'multi.title': '멀티플레이',
    'multi.createRoom': '방 만들기',
    'multi.roomTitlePh': '방 제목 (선택)',
    'multi.gameType': '게임 종류',
    'multi.createBtn': '방 만들기',
    'multi.joinByCode': '방 코드로 참가',
    'multi.codePh': '방 코드 입력',
    'multi.joinBtn': '참가',
    'multi.publicRooms': '공개 방 목록',
    'multi.leave': '← 나가기',
    'multi.waitingRoom': '대기실',
    'multi.roomCode': '방 코드',
    'multi.modesPrefix': '모드:',
    'multi.modesNone': '모드: 없음',
    'multi.waiting': '대기중...',
    'multi.waitingOpponent': '상대를 기다리는 중...',
    'multi.startBtn': '게임 시작',
    'multi.readyBtn': '준비',
    'multi.opponentTurn': '{0} 턴',
    'multi.host': '방장',
    'multi.ready': '준비 완료',
    'multi.notReady': '대기중',
    'multi.allReady': '모두 준비 완료!',
    'multi.opponentNotReady': '상대가 준비하지 않았습니다...',
    'multi.cancelReady': '준비 취소',
    'multi.waitingHost': '호스트가 시작하기를 기다리는 중...',
    'multi.pressReady': '준비 버튼을 눌러주세요',
    'multi.noRooms': '대기 중인 방이 없습니다',
    'route.noWords': '"{0}"(으)로 시작하는 단어가 없습니다.',
    'route.noWin': '"{0}"(으)로 시작하는 한방 루트가 없습니다 (이기는 수가 존재하지 않음).',
    'route.notFound': '한방 루트를 찾지 못했습니다.',
    'route.oppLoss': '상대 대응 불가 (한방)',
    'route.noResponse': '대응 없음',
    'route.moreOpp': '상대 옵션 외 {0}개 (모두 동일하게 처리)',
    'auth.nicknameMin': '닉네임은 2글자 이상 입력하세요.',
    'auth.passwordMin': '비밀번호는 4자리 이상 입력하세요.',
    'auth.connFail': '서버 연결에 실패했습니다.',
    'auth.nicknameTaken': '이미 사용 중인 닉네임입니다.',
    'auth.registerOk': '회원가입 완료! 로그인합니다...',
    'auth.registerFail': '회원가입 실패: {0}',
    'auth.notFound': '존재하지 않는 닉네임입니다.',
    'auth.wrongPw': '비밀번호가 틀렸습니다.',
    'auth.loginFail': '로그인 실패: {0}',
    // Maintenance footer
    'common.copyright': '© 2026. Geonhee. All rights reserved.'
  },
  en: {
    'common.back': '← Back',
    'common.loading': 'Loading...',
    'common.cancel': 'Cancel',
    'common.confirm': 'OK',
    'common.copy': 'Copy',
    'common.send': 'Send',
    'common.submit': 'Submit',
    'common.delete': 'Delete',
    'maintenance.title': 'Server Under Maintenance',
    'maintenance.desc': "We're updating the server to bring you a better experience.<br>Please wait a moment!",
    'maintenance.next': 'Next update:',
    'maintenance.features': 'Multiplayer up to 30 players + dictionary additions',
    'maintenance.adminPw': 'Admin password',
    'maintenance.enter': 'Enter',
    'login.subtitle': 'Korean Word Chain',
    'login.tabLogin': 'Login',
    'login.tabRegister': 'Register',
    'login.nicknamePh': 'Nickname',
    'login.passwordPh': 'Password',
    'login.btnLogin': 'Log In',
    'login.btnRegister': 'Register',
    'home.subtitle': 'Korean Word Chain',
    'home.soundRecommend': '🔊 We recommend playing with sound on',
    'home.serverNormal': 'Server: Main',
    'home.serverTest': 'Server: Test',
    'home.player': 'Player',
    'home.botBattle': 'Bot Battle',
    'home.multiplayer': 'Multiplayer',
    'home.ranking': 'Ranking',
    'home.dictionary': 'Dictionary',
    'home.testServer': 'Test Server',
    'home.bugReport': '💬 Feedback / Bug Report',
    'home.settings': 'Settings',
    'sidebar.notice': 'Notices',
    'sidebar.social': 'Social',
    'sidebar.noticeTitle': 'Title',
    'sidebar.noticeContent': 'Write content...',
    'sidebar.noticeSubmit': 'Post',
    'sidebar.onlinePlayers': 'Online Players',
    'sidebar.friendRequests': 'Friend Requests',
    'sidebar.friends': 'Friends',
    'sidebar.messageInput': 'Type a message...',
    'profile.title': 'Profile',
    'profile.stats': 'Stats',
    'profile.wins': 'Wins',
    'profile.losses': 'Losses',
    'profile.totalExp': 'Total EXP',
    'profile.winrate': 'Win Rate',
    'profile.bugReport': 'Feedback / Bug Report',
    'profile.logout': 'Log out',
    'select.gameType': 'Game Type',
    'select.koGame': 'Korean Word Chain',
    'select.enGame': 'English Word Chain',
    'select.modes': 'Modes',
    'select.modeManner': 'Manner',
    'select.modeNoda': 'No -다',
    'select.modeFreedueum': 'Free 두음',
    'select.modeInjeong': 'Permissive',
    'select.modeDescDefault': 'Pick modes (multiple OK)',
    'select.rounds': 'Rounds',
    'select.players': 'Players',
    'select.playersHint': '(2~30 players)',
    'select.botLevel': 'Pick Bot Level',
    'select.boss': 'Boss Battle',
    'select.bossLocked': 'Unlocks at Lv.10',
    'mode.mannerDesc': 'Manner: No killer words (words ending in unconnectable letters)',
    'mode.nodaDesc': 'No -다: Words ending in "다" not allowed',
    'mode.freedueumDesc': 'Free 두음: ㄴ/ㄹ/ㅇ initials are interchangeable',
    'mode.injeongDesc': 'Permissive: Allow non-standard words (game/anime/song titles)',
    'bot.1.name': 'Beginner Bot',
    'bot.2.name': 'Mid Bot',
    'bot.3.name': 'Skilled Bot',
    'bot.4.name': 'Pro Bot',
    'bot.5.name': 'Master Bot',
    'bot.6.name': 'God Bot',
    'bot.7.name': 'Long Bot',
    'bot.1.desc': 'Easy words<br>Slow reaction / slow typing',
    'bot.2.desc': 'Average words<br>Average reaction / average typing',
    'bot.3.desc': 'Hard words too<br>Fast reaction / decent typing',
    'bot.4.desc': 'Strong word search / fast typing<br>Avoids killer words',
    'bot.5.desc': 'Uses rare words<br>Very fast reaction / fast typing',
    'bot.6.desc': '60% long words + 40% killer words<br>Superhuman reaction / player goes first',
    'bot.7.desc': 'Specializes in 6+ letter words<br>Fast reaction / wins on length',
    'game.leave': 'Leave',
    'game.confirmLeave': 'Leaving counts as a loss. Continue?',
    'game.myTurn': 'My turn',
    'game.startWord': 'Start word',
    'game.nextLetter': 'Next letter:',
    'game.nextLetterAlts': '({0} also allowed)',
    'game.inputPh': 'Type a word...',
    'game.usedWordsLabel': 'Used words',
    'game.timeout': 'Time out! You did not enter a word in time.',
    'game.botTimeout': 'Bot timed out! Could not find a word.',
    'game.timeoutShort': 'Time out!',
    'game.win': 'Victory!',
    'game.lose': 'Defeat...',
    'game.player': 'Me',
    'game.bot': 'Bot',
    'game.vs': 'VS',
    'game.scoreSuffix': 'pts',
    'game.scoreWithWins': '{0} pts ({1}W)',
    'game.roundDisplay': 'Round {0} / {1}',
    'game.roundOver': 'Round {0} ended - {1}',
    'game.multiRoundOver': '{0} rounds done! ({1}W {2}L)',
    'game.youFailed': 'You failed −25 pts',
    'game.botFailed': 'Opponent failed −25 pts',
    'game.multiFinalScore': '{0} rounds done! (You {1} / Opp {2})',
    'game.bossChallenge': 'Challenge the strongest boss',
    'game.bossLocked': 'Unlocks at Lv.10 (you are Lv.{0})',
    'game.turnSuffix': "'s turn",
    'msg.minLength': 'Enter at least 2 characters.',
    'msg.englishOnly': 'English letters only.',
    'msg.startsWith': 'Word must start with "{0}".',
    'msg.alreadyUsed': 'Word already used.',
    'msg.notInDict': 'Not in dictionary.',
    'msg.notStandard': 'Not a standard word. Try enabling 어인정 mode.',
    'msg.daBanned': 'Words ending in "다" are not allowed.',
    'msg.killerBanned': 'Manner mode: killer words are not allowed.',
    'gameover.title': 'Game Over',
    'gameover.retry': 'Retry',
    'gameover.home': 'Home',
    'settings.title': 'Settings',
    'settings.audio': 'Audio',
    'settings.bgmVolume': 'BGM Volume',
    'settings.sfxVolume': 'SFX Volume',
    'settings.language': 'Language',
    'settings.lang.ko': '한국어',
    'settings.lang.en': 'English',
    'dict.title': 'Dictionary',
    'dict.totalCount': '{0} words total',
    'dict.searchPh': 'Search words...',
    'dict.startChar': 'Start letter',
    'dict.endChar': 'End letter',
    'dict.length': 'Length',
    'dict.lengthAll': 'All',
    'dict.lengthN': '{0} letters',
    'dict.lengthNPlus': '{0}+ letters',
    'dict.killerRoute': 'Killer routes',
    'dict.killerOnly': 'Killer words only',
    'dict.resultCount': 'Results: {0}{1}',
    'dict.killerSuffix': ' (killer words)',
    'multi.title': 'Multiplayer',
    'multi.createRoom': 'Create Room',
    'multi.roomTitlePh': 'Room title (optional)',
    'multi.gameType': 'Game Type',
    'multi.createBtn': 'Create',
    'multi.joinByCode': 'Join by code',
    'multi.codePh': 'Enter room code',
    'multi.joinBtn': 'Join',
    'multi.publicRooms': 'Public Rooms',
    'multi.leave': '← Leave',
    'multi.waitingRoom': 'Waiting Room',
    'multi.roomCode': 'Room Code',
    'multi.modesPrefix': 'Modes:',
    'multi.modesNone': 'Modes: None',
    'multi.waiting': 'Waiting...',
    'multi.waitingOpponent': 'Waiting for opponent...',
    'multi.startBtn': 'Start Game',
    'multi.readyBtn': 'Ready',
    'multi.opponentTurn': "{0}'s turn",
    'multi.host': 'Host',
    'multi.ready': 'Ready',
    'multi.notReady': 'Waiting',
    'multi.allReady': 'All ready!',
    'multi.opponentNotReady': 'Opponent is not ready...',
    'multi.cancelReady': 'Cancel Ready',
    'multi.waitingHost': 'Waiting for host to start...',
    'multi.pressReady': 'Press the Ready button',
    'multi.noRooms': 'No rooms available',
    'route.noWords': 'No words start with "{0}".',
    'route.noWin': 'No killer route exists starting with "{0}" (no winning move).',
    'route.notFound': 'Could not find a killer route.',
    'route.oppLoss': 'Opponent cannot respond (killer)',
    'route.noResponse': 'No response',
    'route.moreOpp': '{0} more opponent options (all handled the same)',
    'auth.nicknameMin': 'Nickname must be at least 2 characters.',
    'auth.passwordMin': 'Password must be at least 4 characters.',
    'auth.connFail': 'Failed to connect to server.',
    'auth.nicknameTaken': 'This nickname is already taken.',
    'auth.registerOk': 'Registered! Logging in...',
    'auth.registerFail': 'Register failed: {0}',
    'auth.notFound': 'Nickname does not exist.',
    'auth.wrongPw': 'Wrong password.',
    'auth.loginFail': 'Login failed: {0}',
    'common.copyright': '© 2026. Geonhee. All rights reserved.'
  }
};

function t(key, ...args) {
  const lang = userSettings.lang || 'ko';
  let s = (I18N[lang] && I18N[lang][key]) || (I18N.ko[key]) || key;
  args.forEach((v, i) => { s = s.replace('{' + i + '}', v); });
  return s;
}

function applyLanguage() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const k = el.getAttribute('data-i18n');
    el.innerHTML = t(k);
  });
  // placeholders
  document.querySelectorAll('[data-i18n-ph]').forEach(el => {
    const k = el.getAttribute('data-i18n-ph');
    el.placeholder = t(k);
  });
  document.documentElement.lang = userSettings.lang || 'ko';
}

function setLanguage(lang) {
  if (!I18N[lang]) return;
  userSettings.lang = lang;
  saveSettings();
  applyLanguage();
  document.querySelectorAll('input[name="settings-lang"]').forEach(r => {
    r.checked = (r.value === lang);
  });
}

function openSettings() {
  const bgmEl = document.getElementById('settings-bgm-vol');
  const sfxEl = document.getElementById('settings-sfx-vol');
  const bgmText = document.getElementById('settings-bgm-vol-text');
  const sfxText = document.getElementById('settings-sfx-vol-text');
  if (bgmEl) bgmEl.value = userSettings.bgmVolume;
  if (sfxEl) sfxEl.value = userSettings.sfxVolume;
  if (bgmText) bgmText.textContent = Math.round(userSettings.bgmVolume) + '%';
  if (sfxText) sfxText.textContent = Math.round(userSettings.sfxVolume) + '%';
  document.querySelectorAll('input[name="settings-lang"]').forEach(r => {
    r.checked = (r.value === userSettings.lang);
  });
  showScreen('screen-settings');
}

function onSettingsBGMSlider(val) {
  userSettings.bgmVolume = +val;
  saveSettings();
  if (typeof setBGMVolume === 'function') setBGMVolume(val);
  const t = document.getElementById('settings-bgm-vol-text');
  if (t) t.textContent = Math.round(+val) + '%';
}

function onSettingsSFXSlider(val) {
  setSFXVolume(val);
  const t = document.getElementById('settings-sfx-vol-text');
  if (t) t.textContent = Math.round(+val) + '%';
}

loadSettings();

document.addEventListener('DOMContentLoaded', () => {
  applyLanguage();
  const top = document.getElementById('bgm-volume');
  if (top) {
    top.value = userSettings.bgmVolume;
    const t = document.getElementById('bgm-vol-text');
    if (t) t.textContent = Math.round(userSettings.bgmVolume) + '%';
  }
});
