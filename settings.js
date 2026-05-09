// ==================== SETTINGS SYSTEM ====================
// localStorage 키
const SETTINGS_KEY = 'ctl_settings_v1';

// 기본값
const DEFAULT_SETTINGS = {
  bgmVolume: 30,    // 0-100
  sfxVolume: 100,   // 0-100
  lang: 'ko'        // 'ko' | 'en'
};

let userSettings = { ...DEFAULT_SETTINGS };

// 효과음 볼륨 (0.0-1.0) — playSound/playKickAt에서 사용
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

function getSetting(key) {
  return userSettings[key];
}

function setSetting(key, val) {
  userSettings[key] = val;
  saveSettings();
}

// ===== 효과음 볼륨 =====
function setSFXVolume(val) {
  const v = Math.max(0, Math.min(100, +val || 0));
  userSettings.sfxVolume = v;
  sfxUserVolume = v / 100;
  saveSettings();
  const t = document.getElementById('sfx-vol-text');
  if (t) t.textContent = Math.round(v) + '%';
}

// ===== 언어 =====
const I18N = {
  ko: {
    'settings.title': '설정',
    'settings.audio': '오디오',
    'settings.bgmVolume': '배경음악 볼륨',
    'settings.sfxVolume': '효과음 볼륨',
    'settings.language': '언어 설정',
    'settings.lang.ko': '한국어',
    'settings.lang.en': 'English',
    'common.back': '← 뒤로',
    'home.settings': '설정'
  },
  en: {
    'settings.title': 'Settings',
    'settings.audio': 'Audio',
    'settings.bgmVolume': 'BGM Volume',
    'settings.sfxVolume': 'SFX Volume',
    'settings.language': 'Language',
    'settings.lang.ko': '한국어',
    'settings.lang.en': 'English',
    'common.back': '← Back',
    'home.settings': 'Settings'
  }
};

function t(key) {
  const lang = userSettings.lang || 'ko';
  return (I18N[lang] && I18N[lang][key]) || (I18N.ko[key]) || key;
}

function applyLanguage() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const k = el.getAttribute('data-i18n');
    el.textContent = t(k);
  });
  document.documentElement.lang = userSettings.lang || 'ko';
}

function setLanguage(lang) {
  if (!I18N[lang]) return;
  userSettings.lang = lang;
  saveSettings();
  applyLanguage();
  // 라디오 UI 동기화
  document.querySelectorAll('input[name="settings-lang"]').forEach(r => {
    r.checked = (r.value === lang);
  });
}

// ===== 설정 화면 진입 시 슬라이더/라디오 동기화 =====
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

// 초기 로드
loadSettings();

document.addEventListener('DOMContentLoaded', () => {
  applyLanguage();
  // 상단 BGM 슬라이더 초기값 동기화
  const top = document.getElementById('bgm-volume');
  if (top) {
    top.value = userSettings.bgmVolume;
    const t = document.getElementById('bgm-vol-text');
    if (t) t.textContent = Math.round(userSettings.bgmVolume) + '%';
  }
});
