'use strict';

const state = {
  channels: [],
  focusIdx: 0,
  cols: 6,
  playerOpen: false,
};

const els = {
  grid: document.getElementById('grid'),
  status: document.getElementById('status'),
  playerWrap: document.getElementById('player-wrap'),
  player: document.getElementById('player'),
  playerInfo: document.getElementById('player-info'),
};

// ─────────────────────────────────────────────
// M3U Parser
// ─────────────────────────────────────────────
function parseM3U(text) {
  const lines = text.split(/\r?\n/);
  const out = [];
  let cur = null;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    if (line.startsWith('#EXTINF')) {
      const logo = (line.match(/tvg-logo="([^"]*)"/)  [])[1]  '';
      const group = (line.match(/group-title="([^"]*)"/)  [])[1]  '';
      const name = (line.match(/tvg-name="([^"]*)"/)  [])[1] 
                   line.split(',').slice(1).join(',').trim() ||
                   'قناة';
      cur = { name, logo, group, url: '' };
    } else if (!line.startsWith('#') && cur) {
      cur.url = line;
      out.push(cur);
      cur = null;
    }
  }
  return out;
}

// ─────────────────────────────────────────────
// Load playlist
// ─────────────────────────────────────────────
async function loadPlaylist(url) {
  els.status.textContent = 'جارٍ التحميل...';
  try {
    const res = await fetch(url, { cache: 'no-cache' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const text = await res.text();
    return parseM3U(text);
  } catch (e) {
    console.error('playlist error:', e);
    return [];
  }
}

// ─────────────────────────────────────────────
// Render
// ─────────────────────────────────────────────
function render() {
  els.grid.innerHTML = '';

  if (state.channels.length === 0) {
    els.status.textContent = 'لا توجد قنوات — تحقق من رابط القائمة';
    return;
  }

  els.status.textContent = ${state.channels.length} قناة;

  state.channels.forEach((ch, i) => {
    const div = document.createElement('div');
    div.className = 'channel' + (i === state.focusIdx ? ' focused' : '');
    div.dataset.idx = i;

    const img = document.createElement('img');
    img.src = ch.logo || '';
    img.alt = '';
    img.onerror = () => { img.style.display = 'none'; };
    if (!ch.logo) img.style.display = 'none';

    const name = document.createElement('div');
    name.className = 'name';
    name.textContent = ch.name;

    const group = document.createElement('div');
    group.className = 'group';
    group.textContent = ch.group;

    div.appendChild(img);
    div.appendChild(name);
    div.appendChild(group);

    div.addEventListener('click', () => {
      state.focusIdx = i;
      updateFocus();
      openPlayer();
    });

    els.grid.appendChild(div);
  });

  updateFocus();
}

function updateFocus() {
  const prev = els.grid.querySelector('.channel.focused');
  if (prev) prev.classList.remove('focused');

  const cur = els.grid.querySelector(.channel[data-idx="${state.focusIdx}"]);
  if (cur) {
    cur.classList.add('focused');
    cur.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
}

// ─────────────────────────────────────────────
// Player
// ─────────────────────────────────────────────
function openPlayer() {
  const ch = state.channels[state.focusIdx];
  if (!ch) return;

  state.playerOpen = true;
  els.playerWrap.classList.remove('hidden');
  els.playerInfo.textContent = ch.name;

  const v = els.player;
  v.pause();
  v.removeAttribute('src');
  v.load();

  const isHls = ch.url.includes('.m3u8');

  if (isHls && window.Hls && Hls.isSupported()) {
    const hls = new Hls({ lowLatencyMode: true });
    hls.loadSource(ch.url);
    hls.attachMedia(v);
    hls.on(Hls.Events.MANIFEST_PARSED, () => v.play().catch(() => {}));
    v._hls = hls;
  } else {
    v.src = ch.url;
    v.play().catch(() => {});
  }
}
function closePlayer() {
  state.playerOpen = false;
  els.playerWrap.classList.add('hidden');
  const v = els.player;
  if (v._hls) { v._hls.destroy(); v._hls = null; }
  v.pause();
  v.removeAttribute('src');
  v.load();
}

// ─────────────────────────────────────────────
// Remote Control
// ─────────────────────────────────────────────
document.addEventListener('keydown', (e) => {
  if (state.playerOpen) {
    if (e.keyCode === 461 || e.keyCode === 27) closePlayer();
    return;
  }

  const total = state.channels.length;
  if (total === 0) return;

  const cols = state.cols;
  let idx = state.focusIdx;

  switch (e.keyCode) {
    case 38: idx = Math.max(0, idx - cols); break;             // up
    case 40: idx = Math.min(total - 1, idx + cols); break;     // down
    case 37: idx = Math.max(0, idx - 1); break;                // left
    case 39: idx = Math.min(total - 1, idx + 1); break;        // right
    case 13:                                                    // OK
    case 415:                                                   // play
      openPlayer();
      return;
    case 461:                                                   // back
    case 27:
      return;
    default:
      return;
  }

  if (idx !== state.focusIdx) {
    state.focusIdx = idx;
    updateFocus();
  }
});

// ─────────────────────────────────────────────
// Boot
// ─────────────────────────────────────────────
(async function boot() {
  const REMOTE = 'https://iptv-org.github.io/iptv/index.m3u';
  const LOCAL  = 'playlist.m3u';

  let channels = await loadPlaylist(REMOTE);

  if (channels.length === 0) {
    channels = await loadPlaylist(LOCAL);
  }

  if (channels.length === 0) {
    els.status.textContent = 'فشل تحميل القائمة — جرّب لاحقًا';
    return;
  }

  state.channels = channels;
  render();
})();