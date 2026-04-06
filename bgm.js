// ==================== BGM SYSTEM ====================

const BGM_TRACKS = [
  { file: 'Anyone in 2025.mp3', title: 'Anyone in 2025? - しゃろう Sharou' },
  { file: 'superstar.mp3', title: 'superstar - しゃろう Sharou' }
];

let bgmAudio = null;
let bgmIndex = 0;
let bgmStarted = false;

function startBGM() {
  if (bgmStarted) return;
  bgmStarted = true;
  bgmIndex = Math.floor(Math.random() * BGM_TRACKS.length);
  playBGMTrack();
}

function playBGMTrack() {
  const track = BGM_TRACKS[bgmIndex];

  if (bgmAudio) {
    bgmAudio.pause();
    bgmAudio = null;
  }

  bgmAudio = new Audio(track.file);
  bgmAudio.volume = 0.3;
  bgmAudio.play().catch(() => {
    // 자동재생 차단 시 클릭으로 재시도
    const retry = () => {
      bgmAudio.play().catch(() => {});
      document.removeEventListener('click', retry);
    };
    document.addEventListener('click', retry);
  });

  // Now Playing 표시
  const npEl = document.getElementById('now-playing');
  const npText = document.getElementById('now-playing-text');
  if (npEl && npText) {
    npEl.style.display = 'flex';
    npText.textContent = 'Now Playing: ' + track.title;
  }

  // 곡 끝나면 다음 곡
  bgmAudio.onended = () => {
    bgmIndex = (bgmIndex + 1) % BGM_TRACKS.length;
    playBGMTrack();
  };
}

// 보스전 진입 시 BGM 정지
function pauseBGM() {
  if (bgmAudio) {
    bgmAudio.pause();
  }
  const npEl = document.getElementById('now-playing');
  if (npEl) npEl.style.display = 'none';
}

// 보스전 끝나면 BGM 재개
function resumeBGM() {
  if (bgmAudio && bgmStarted) {
    bgmAudio.play().catch(() => {});
    const npEl = document.getElementById('now-playing');
    if (npEl) npEl.style.display = 'flex';
  }
}

// 로그인 성공 후 BGM 시작
document.addEventListener('DOMContentLoaded', () => {
  // 첫 클릭 시 BGM 시작 (자동재생 정책 우회)
  const startOnClick = () => {
    if (!bgmStarted) startBGM();
    document.removeEventListener('click', startOnClick);
  };
  document.addEventListener('click', startOnClick);
});
