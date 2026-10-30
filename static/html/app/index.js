let sidebarOpen = true;
let videoInfo = null;
let qualities = [];
let rates = [];
let programs = [];
let currentProgramIndex = -1;

let playerOnTop = true;

let controlsTimer = null;
const CONTROLS_TIMEOUT = 3000;
function showControls() {
    const overlay = document.getElementById('controls');
    const placeholder = document.getElementById('placeholder');
    overlay.classList.add('visible');
    placeholder.classList.add('cursor-visible');
    clearTimeout(controlsTimer);
    controlsTimer = setTimeout(() => {
        overlay.classList.remove('visible');
        placeholder.classList.remove('cursor-visible');
    }, CONTROLS_TIMEOUT);
}
function hideControls() {
    clearTimeout(controlsTimer);
    document.getElementById('controls').classList.remove('visible');
    document.getElementById('placeholder').classList.remove('cursor-visible');
}

function toggleZOrder() {
    if (window.native && window.native.togglePlayerZOrder) {
        window.native.togglePlayerZOrder();
        playerOnTop = !playerOnTop;
        document.getElementById('zorderTrack').classList.toggle('on', !playerOnTop);
    }
}

function toggleSidebar() {
    sidebarOpen = !sidebarOpen;
    document.getElementById('sidebar').classList.toggle('open', sidebarOpen);
    document.getElementById('sidebarCollapse').classList.toggle('open', sidebarOpen);
}

function formatTime(seconds) {
    if (!seconds || !isFinite(seconds)) return '00:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return m.toString().padStart(2, '0') + ':' + s.toString().padStart(2, '0');
}

function togglePlay() {
    if (!videoInfo) return;
    nativeCall('webviewExecuteScript', 'player-webview', videoInfo.paused ? 'tvCommand("play")' : 'tvCommand("pause")');
}

function seekTo(e) {
    if (!videoInfo || !videoInfo.duration) return;
    const bar = document.getElementById('progressBar');
    const ratio = e.clientX / bar.clientWidth;
    nativeCall('webviewExecuteScript', 'player-webview', 'tvCommand("seek",' + (ratio * videoInfo.duration) + ')');
}

function skip(delta) {
    if (!videoInfo) return;
    nativeCall('webviewExecuteScript', 'player-webview', 'tvCommand("seek",' + (videoInfo.currentTime + delta) + ')');
}

function setVolume(e) {
    const bar = document.getElementById('volumeSlider');
    const rect = bar.getBoundingClientRect();
    const vol = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    savedVolume = vol;
    nativeCall('webviewExecuteScript', 'player-webview', 'tvCommand("volume",' + vol + ')');
}

function prevChannel() {
    if (programs.length === 0) return;
    let idx = currentProgramIndex - 1;
    if (idx < 0) idx = programs.length - 1;
    selectProgram(idx);
}

function nextChannel() {
    if (programs.length === 0) return;
    let idx = currentProgramIndex + 1;
    if (idx >= programs.length) idx = 0;
    selectProgram(idx);
}

let isFullscreen = false;

function syncFullscreenUI() {
    document.getElementById('titlebar').style.display = isFullscreen ? 'none' : '';
    document.getElementById('sidebar').style.display = isFullscreen ? 'none' : '';
    document.getElementById('sidebarCollapse').style.display = isFullscreen ? 'none' : '';
}

function toggleFullscreen() {
    if (window.native && window.native.toggleFullscreen) {
        window.native.toggleFullscreen().then((state) => {
            isFullscreen = state;
            syncFullscreenUI();
        });
    }
}

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isFullscreen) {
        toggleFullscreen();
    }
});

setInterval(() => {
    if (window.native && window.native.isFullscreen) {
        window.native.isFullscreen().then((actual) => {
            if (actual !== isFullscreen) {
                isFullscreen = actual;
                syncFullscreenUI();
            }
        });
    }
}, 500);

function cycleQuality() {
    if (qualities.length <= 1) return;
    const currentIdx = qualities.findIndex(q => q.active);
    const nextIdx = (currentIdx + 1) % qualities.length;
    const next = qualities[nextIdx];
    if (next && next.id) {
        nativeCall('webviewExecuteScript', 'player-webview', 'tvCommand("clickElement","' + next.id + '")');
    }
}

function cycleRate() {
    if (rates.length <= 1) return;
    const currentIdx = rates.findIndex(r => r.active);
    const nextIdx = (currentIdx + 1) % rates.length;
    const next = rates[nextIdx];
    if (next && next.id) {
        nativeCall('webviewExecuteScript', 'player-webview', 'tvCommand("clickElement","' + next.id + '")');
    }
}

const UA_PC = '';
const UA_MOBILE = 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';

let savedVolume = 0.8;

const M3U8_API_PATH = '/local/api/m3u8.html';

function navigatePlayer(url, ua) {
    if (videoInfo && videoInfo.volume !== undefined) {
        savedVolume = videoInfo.volume;
    }
    volumeApplied = false;
    const userAgent = (ua === 'mobile') ? UA_MOBILE : UA_PC;
    nativeCall('webviewSetUserAgent', 'player-webview', userAgent);
    if (/\.m3u8(?:$|\?)/i.test(url)) {
        const origin = new URL(url).origin;
        nativeCall('webviewNavigate', 'player-webview', origin + M3U8_API_PATH + '?url=' + encodeURIComponent(url));
    } else {
        nativeCall('webviewNavigate', 'player-webview', url);
    }
}

function renderPrograms() {
    const panel = document.getElementById('programsPanel');
    if (programs.length === 0) {
        panel.innerHTML = '<div class="no-content">暂无节目数据</div>';
        return;
    }
    panel.innerHTML = programs.map((p, i) => `
                <div class="program-item ${i === currentProgramIndex ? 'active' : ''}" onclick="selectProgram(${i})">
                    ${p.pic ? '<img src="' + p.pic + '" />' : ''}
                    <div class="info">
                        <div class="name">${p.title}</div>
                        <div class="remark">${p.remark || ''}</div>
                    </div>
                </div>
            `).join('');
}

function selectProgram(index) {
    currentProgramIndex = index;
    const program = programs[index];
    if (program && program.url) {
        navigatePlayer(program.url, program.ua);
    }
    renderPrograms();
}

function updateControls() {
    if (!videoInfo) return;
    const playBtn = document.getElementById('playBtn');
    playBtn.innerHTML = videoInfo.paused
        ? '<svg viewBox="0 0 18 18"><polygon points="5,2 16,9 5,16" /></svg>'
        : '<svg viewBox="0 0 18 18"><rect x="3" y="2" width="4" height="14" rx="1" /><rect x="11" y="2" width="4" height="14" rx="1" /></svg>';

    const timeDisplay = document.getElementById('timeDisplay');
    timeDisplay.textContent = formatTime(videoInfo.currentTime) + ' / ' + formatTime(videoInfo.duration);

    const progressFill = document.getElementById('progressFill');
    if (videoInfo.duration && isFinite(videoInfo.duration)) {
        const pct = (videoInfo.currentTime / videoInfo.duration) * 100;
        progressFill.style.width = pct + '%';
    }

    const volumeFill = document.getElementById('volumeFill');
    volumeFill.style.width = (videoInfo.volume * 100) + '%';

    const volumeValue = document.getElementById('volumeValue');
    volumeValue.textContent = Math.round(videoInfo.volume * 100);

    const qualityBadge = document.getElementById('qualityBadge');
    const activeQ = qualities.find(q => q.active);
    qualityBadge.textContent = activeQ ? activeQ.name : '--';

    const rateBadge = document.getElementById('rateBadge');
    const activeR = rates.find(r => r.active);
    rateBadge.textContent = activeR ? activeR.name : '1x';
}

let volumeApplied = false;

window.addEventListener('ipc-message', (e) => {
    const { from, data } = e.detail;
    if (from === 'player-webview') {
        if (data.type === 'videoInfo') {
            videoInfo = data.data;
            if (!volumeApplied && videoInfo.volume !== undefined) {
                nativeCall('webviewExecuteScript', 'player-webview', 'tvCommand("volume",' + savedVolume + ')');
                volumeApplied = true;
            }
            updateControls();
        } else if (data.type === 'qualities') {
            qualities = data.data;
            updateControls();
        } else if (data.type === 'rates') {
            rates = data.data;
            updateControls();
        }
    }
});

let channelCategories = [];
let currentCategoryIndex = 0;

function loadChannels() {
    fetch('channels.json')
        .then(r => r.json())
        .then(json => {
            if (json.categories) {
                channelCategories = json.categories;
                if (channelCategories.length > 0) {
                    programs = channelCategories[0].channels.map(ch => ({
                        title: ch.name,
                        url: ch.url,
                        remark: ''
                    }));
                }
            }
            renderPrograms();
            renderCategoryTabs();
        })
        .catch(() => {
            programs = [
                { title: 'CCTV-1 综合', url: 'https://tv.cctv.com/live/cctv1/', remark: '' },
                { title: 'CCTV-13 新闻', url: 'https://tv.cctv.com/live/cctv13/', remark: '' },
                { title: '湖南卫视', url: 'https://www.yangshipin.cn/tv/home?pid=600002475', remark: '' },
            ];
            renderPrograms();
        });
}

function renderCategoryTabs() {
    if (channelCategories.length === 0) return;

    const categoryTabsHtml = channelCategories.map((cat, i) =>
        `<div class="category-tab ${i === currentCategoryIndex ? 'active' : ''}" data-category="${i}" onclick="switchCategory(${i})">${cat.name}</div>`
    ).join('');

    const catSection = document.getElementById('categoryTabs');
    if (catSection) catSection.innerHTML = categoryTabsHtml;
}

function switchCategory(index) {
    currentCategoryIndex = index;
    const category = channelCategories[index];
    if (category) {
        programs = category.channels.map(ch => ({
            title: ch.name,
            url: ch.url,
            remark: ''
        }));
        currentProgramIndex = -1;
        renderPrograms();
    }
    document.querySelectorAll('.category-tab').forEach((t, i) => {
        t.classList.toggle('active', i === index);
    });
}

loadChannels();

if (typeof onLayoutUpdate === 'undefined') {
    window.onLayoutUpdate = function (info) { };
}