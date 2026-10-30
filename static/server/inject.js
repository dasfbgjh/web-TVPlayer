(function () {
    'use strict';

    const MENU_CHECK_INTERVAL = 2000;// 菜单检查间隔时间
    const RETRY_DELAY = 1000; // 重试延迟时间

    let currentVideo = null;// 当前播放的视频元素
    let currentRule = null;// 当前匹配的规则元素
    let unmuteBlocked = false;// 浏览器因缺少用户手势拒绝取消静音

    /**
     * 安全取消静音：无用户手势时浏览器会拒绝并强制暂停视频，
     * 此时标记为不可取消静音并恢复静音播放，避免反复打断播放。
     */
    function tryUnmute(video) {
        if (!video || !video.muted || unmuteBlocked) return;
        const wasPlaying = !video.paused;
        video.muted = false;
        if (wasPlaying && video.paused) {
            unmuteBlocked = true;
            video.muted = true;
            const p = video.play();
            if (p && p.catch) p.catch(() => { });
        }
    }

    const defaultRule = {
        name: 'default',
        match: () => true,
        preprocess: () => true,
        findVideo: () => {
            return document.querySelector('video') ||
                document.querySelector('._video_player') ||
                document.querySelector('.vjs-tech') ||
                document.getElementsByTagName('video')[0];
        },
        playFullscreen: () => true,
        postprocess: () => { },
        tryAutoplay: () => {
            const video = currentVideo;
            if (!video) return false;
            if (video.paused) {
                video.muted = true;
                const p = video.play();
                if (p && p.then) {
                    p.then(() => {
                        tryUnmute(video);
                    }).catch(() => { });
                }
            } else {
                tryUnmute(video);
            }
            return true;
        },
        getVideoInfo: () => {
            const video = currentVideo;
            if (!video) return null;
            return {
                duration: video.duration,
                currentTime: video.currentTime,
                paused: video.paused,
                volume: video.volume,
                playbackRate: video.playbackRate,
                videoWidth: video.videoWidth,
                videoHeight: video.videoHeight
            };
        },
        getEpisodeList: () => {
            const episodes = [];
            document.querySelectorAll('[id^="xxj-"]').forEach(el => {
                episodes.push({
                    id: el.id,
                    title: el.textContent.trim(),
                    url: el.closest('a')?.href || ''
                });
            });
            if (episodes.length > 0) return episodes;
            document.querySelectorAll('.vjs-playlist-item, .episode-item, [class*="episode"], [class*="xj"]').forEach(el => {
                episodes.push({
                    id: el.id || '',
                    title: el.textContent.trim(),
                    url: el.closest('a')?.href || ''
                });
            });
            return episodes;
        },
        getQualityList: () => {
            const qualities = [];
            document.querySelectorAll('[id^="xhz-"]').forEach(el => {
                qualities.push({
                    id: el.id,
                    name: el.textContent.trim(),
                    active: el.classList.contains('active') || el.classList.contains('vjs-selected')
                });
            });
            if (qualities.length > 0) return qualities;
            document.querySelectorAll('.vjs-playback-quality .vjs-menu-item').forEach(el => {
                qualities.push({
                    id: el.id || '',
                    name: el.textContent.trim(),
                    active: el.classList.contains('vjs-selected')
                });
            });
            return qualities;
        },
        getRateList: () => {
            const rates = [];
            document.querySelectorAll('[id^="xrate-"]').forEach(el => {
                rates.push({
                    id: el.id,
                    name: el.textContent.trim(),
                    active: el.classList.contains('vjs-selected')
                });
            });
            if (rates.length > 0) return rates;
            document.querySelectorAll('.vjs-playback-rate .vjs-menu-item').forEach(el => {
                rates.push({
                    id: el.id || '',
                    name: el.textContent.trim(),
                    active: el.classList.contains('vjs-selected')
                });
            });
            return rates;
        },
        executeCommand: (msg) => {
            const video = currentVideo;
            switch (msg.action) {
                case 'play': video?.play(); break;
                case 'pause': video?.pause(); break;
                case 'seek': if (video) video.currentTime = msg.time; break;
                case 'volume': if (video) { video.volume = msg.volume; tryUnmute(video); } break;
                case 'rate': if (video) video.playbackRate = msg.rate; break;
                case 'clickElement':
                    const el = document.getElementById(msg.elementId);
                    if (el) el.click();
                    break;
                case 'navigate':
                    window.location.href = msg.url;
                    break;
            }
        }
    };

    const PLATFORM_RULES = [
        {
            name: 'yangshipin',
            match: (url) => url.includes('yangshipin.cn'),
            playFullscreen: () => {
                const btn = document.querySelector('.videoFull');
                if (btn) btn.click();
                return true;
            },
            postprocess: () => {
                const yFull = document.querySelector('.y-full');
                if (yFull) yFull.remove();
            }
        },
        {
            name: 'cctv-live',
            match: (url) => url.includes('tv.cctv.com/live'),
            playFullscreen: (video) => {
                if (video) video.classList.add('tv-video-full');
                return true;
            },
            postprocess: () => {
                var el = document.querySelector('.phone');
                if (el) el.remove();
                el = document.querySelector('.nav_wrapper_bg');
                if (el) el.remove();
                el = document.querySelector('.header_nav');
                if (el) el.remove();
                el = document.querySelector('.retrieve');
                if (el) el.remove();
                el = document.querySelector('.kj');
                if (el) el.remove();
            }
        },
        {
            name: 'cctvideo',
            match: (url) => url.includes('tv.cctv.com/') && !url.includes('/live'),
            playFullscreen: (video) => {
                if (video) video.classList.add('tv-video-full');
                return true;
            },
            postprocess: () => {
                var el = document.querySelector('.retrieve');
                if (el) el.remove();
                el = document.querySelector('.gwA18043_ind01');
                if (el) el.remove();
                el = document.querySelector('.XUQIU18897_fuceng');
                if (el) el.remove();
            }
        },
        {
            name: 'bestv',
            match: (url) => url.includes('bestv.com.cn'),
            playFullscreen: () => {
                const el = document.querySelector('.video-js') || document.querySelector('video');
                if (el) el.classList.add('tv-video-full');
                const vjsCtrl = document.querySelector('.vjs-fullscreen-control');
                if (vjsCtrl) vjsCtrl.click();
                return true;
            }
        },
        {
            name: 'xigua',
            match: (url) => url.includes('ixigua.com'),
            preprocess: () => {
                const el = document.querySelector('.big-card-button');
                if (!el) return false;
                el.click();
                return true;
            },
            playFullscreen: () => {
                var video = currentVideo;
                if (!video) return false;
                video.classList.add('tv-video-full');
                setTimeout(() => {
                    video.play();
                }, 1000);
                return true;
            }
        },
        {
            name: 'qq',
            match: (url) => url.includes('v.qq.com'),
            playFullscreen: () => {
                const btn = document.querySelector('.txp_btn_fake');
                if (btn) btn.click();
                return true;
            },
            postprocess: () => {
                setTimeout(() => {
                    const container = document.querySelector('.txp_videos_container');
                    if (container) {
                        container.style.cssText = 'left:0;top:0;width:100%;height:100%;position:fixed;z-index:99990;';
                    }
                    const mask = document.querySelector('.txp_full_screen_pause-player-mask');
                    if (mask) {
                        mask.style.cssText = 'left:0;top:0;width:100%;height:100%;';
                    }
                }, 3000);
            }
        },
        {
            name: 'youku',
            match: (url) => url.includes('v.youku.com'),
            playFullscreen: () => {
                const btn = document.querySelector('#webfullscreen-icon');
                if (btn) btn.click();
                return true;
            }
        },
        {
            name: 'iqiyi',
            match: (url) => url.includes('iqiyi.com'),
            playFullscreen: () => {
                const el = document.querySelector('#video');
                if (el) el.classList.add('tv-video-full');
                return true;
            },
            postprocess: () => {
                const barrage = document.querySelector('#pcaBarrageContainer');
                if (barrage) barrage.remove();
            }
        },
        {
            name: 'mgtv-live',
            match: (url) => url.includes('mgtv.com/live'),
            preprocess: () => {
                return selectMgtvChannelByTag();
            },
            playFullscreen: () => {
                const livePlayer = document.querySelector('.mgtv-live-player');
                if (livePlayer) livePlayer.classList.add('tv-video-full');
                return true;
            },
            postprocess: () => {

            }
        },
        {
            name: 'mgtv',
            match: (url) => url.includes('mgtv.com'),
            playFullscreen: () => {
                const el = document.querySelector('#mgtv-player-wrap');
                if (el) el.classList.add('tv-video-full');
                return true;
            },
            postprocess: () => {
                const danmu = document.querySelector('.mango-danmu-layer');
                if (danmu) danmu.remove();
            }
        },
        {
            name: 'jstv',
            match: (url) => url.includes('live.jstv.com'),
            playFullscreen: () => {
                document.body.style.position = 'fixed';
                const video = document.querySelector('video');
                if (video) video.classList.add('tv-video-full');
                return true;
            },
            postprocess: () => {
                selectByTagText({
                    itemSelector: '#programMain .swiper-slide',
                    textSelector: '.title',
                    activeClass: 'active',
                    clickSelector: '#programMain .title'
                });
            }
        },
        {
            name: 'kankanews',
            match: (url) => url.includes('live.kankanews.com'),
            playFullscreen: () => {
                const video = document.querySelector('video');
                if (video) {
                    video.classList.add('tv-video-full');
                    video.style.width = '100vw';
                    video.style.height = '100vh';
                }
                return true;
            },
            postprocess: () => {
                selectByTagText({
                    itemSelector: '.channel-list li',
                    textSelector: 'span',
                    activeClass: 'active'
                });
            }
        },
        {
            name: 'btime',
            match: (url) => url.includes('btime.com'),
            playFullscreen: () => {
                document.body.style.position = 'fixed';
                const video = document.querySelector('video');
                if (video) video.classList.add('tv-video-full');
                return true;
            },
            postprocess: () => {
                selectByTagIndex('.right_list li');
            }
        },
        {
            name: "hbtv",
            match: (url) => url.includes('web.cmc.hebtv.com'),
            postprocess: () => {
                let el = document.querySelector('.control-content');
                if (el) el.remove();
                el = document.querySelector('.downApp');
                if (el) el.remove();
                el = document.querySelector('.goIndex');
                if (el) el.remove();
            }
        },
        {
            name: 'nmtv',
            match: (url) => url.includes('nmtv.cn'),
            playFullscreen: () => {
                const video = document.querySelector('video');
                if (video) {
                    video.classList.add('tv-video-full');
                    video.style.width = '100vw';
                    video.style.height = '100vh';
                }
                return true;
            },
            postprocess: () => {
                selectByTagText({
                    itemSelector: '.tv-dete .c-label',
                    activeClass: 'active'
                });
            }
        },
        {
            name: 'fengshows',
            match: (url) => url.includes('fengshows.com'),
            preprocess: () => {
                const cookieBtn = document.querySelector('.fs-cookies-dialog-ok-btn');
                if (cookieBtn) cookieBtn.click();
                const mutedIcon = document.querySelector('.vjs-icon-muted');
                if (mutedIcon) mutedIcon.click();
                return true;
            },
            playFullscreen: () => {
                document.body.style.position = 'fixed';
                const fsVideo = document.querySelector('.fs-video');
                if (fsVideo) fsVideo.classList.add('tv-video-full');
                return true;
            },
            postprocess: () => {
                const ctrlBar = document.querySelector('.vjs-controlbar');
                if (ctrlBar) ctrlBar.style.display = 'none';
                const errorModal = document.querySelector('.vjs-error-modal');
                if (errorModal) errorModal.style.display = 'none';
                selectByTagIndex('.fs-live-banner-cluster-schedule-station');
            }
        },
        {
            name: 'lcxw',
            match: (url) => url.includes('lcxw.cn'),
            playFullscreen: () => {
                document.body.style.position = 'fixed';
                const player = document.querySelector('#live-player');
                if (player) {
                    player.classList.add('tv-video-full');
                    player.style.width = '100vw';
                    player.style.height = '100vh';
                    player.querySelectorAll(':scope > *').forEach(child => {
                        child.style.width = '100%';
                        child.style.height = '100%';
                        child.querySelectorAll(':scope > *').forEach(gc => {
                            gc.style.width = '100%';
                            gc.style.height = '100%';
                        });
                    });
                }
                return true;
            },
            postprocess: () => {
                selectByTagIndex('.item-wp');
            }
        },
        {
            name: 'jlntv',
            match: (url) => url.includes('jlntv.cn'),
            playFullscreen: () => {
                document.body.style.position = 'fixed';
                const player = document.querySelector('#live-player');
                if (player) {
                    player.classList.add('tv-video-full');
                    player.style.width = '100vw';
                    player.style.height = '100vh';
                    player.querySelectorAll(':scope > *').forEach(child => {
                        child.style.width = '100%';
                        child.style.height = '100%';
                        child.querySelectorAll(':scope > *').forEach(gc => {
                            gc.style.width = '100%';
                            gc.style.height = '100%';
                        });
                    });
                }
                return true;
            },
            postprocess: () => {
                selectByTagIndex('.item-wp');
            }
        },
        {
            name: 'guangdianyun',
            match: (url) => url.includes('guangdianyun.tv'),
            playFullscreen: () => {
                document.body.style.position = 'fixed';
                const video = document.querySelector('video');
                if (video) {
                    video.classList.add('tv-video-full');
                    video.style.position = 'fixed';
                }
                return true;
            },
            postprocess: () => {
                const mobileNum = document.querySelector('.mobile-num');
                if (mobileNum) mobileNum.remove();
            }
        },
        {
            name: 'bili',
            match: (url) => url.includes('bilibili.com/bangumi'),
            playFullscreen: () => {
                const el = document.querySelector('#bilibili-player-wrap');
                if (el) {
                    el.classList.add('tv-video-full');
                    el.style.paddingRight = '0';
                }
                const sendBar = document.querySelector('.bpx-player-sending-bar');
                if (sendBar) sendBar.style.display = 'none';
                return true;
            },
            postprocess: async () => {
                var el = document.querySelector('.bpx-player-row-dm-wrap');
                if (el) el.remove();
                for (let i = 0; i < 3; i++) {
                    el = document.querySelector('.bili-header__menu.is-zh.bili-header__bar');
                    if (!el) {
                        await new Promise(r => setTimeout(r, 1000));
                        continue;
                    }
                    el.remove();
                    el = document.querySelector('.v-popover-content');
                    if (!el) {
                        await new Promise(r => setTimeout(r, 1000));
                        continue;
                    }
                    el.remove();
                    break;
                }
            }
        }
    ];

    function getQueryParams() {
        const params = new URLSearchParams(window.location.search);
        const result = {};
        params.forEach((value, key) => { result[key] = value; });
        return result;
    }

    function selectMgtvChannelByTag() {
        const tag = getQueryParams()['tag'];
        if (!tag) return false;
        console.log('[tv] mgtv-live tag:', tag);

        function trySelect() {
            const links = document.querySelectorAll('.channels .list a');
            for (const link of links) {
                if (link.textContent.includes(tag)) {
                    console.log('[tv] mgtv-live select channel:', link.textContent.trim());
                    link.click();
                    return true;
                }
            }
            return false;
        }

        if (trySelect()) return true;

        const tabs = document.querySelectorAll('.tabs .item');
        if (tabs.length > 0) {
            (async function clickTabsWithDelay() {
                for (let i = 0; i < tabs.length; i++) {
                    if (!tabs[i].classList.contains('selected')) {
                        tabs[i].click();
                        await new Promise(r => setTimeout(r, 300));
                    }
                    if (trySelect()) return true;
                }
            })();
        }
        return false;
    }

    function selectByTagText(options) {
        const tag = getQueryParams()['tag'];
        if (!tag) return;
        console.log('[tv] selectByTagText tag:', tag);

        const items = document.querySelectorAll(options.itemSelector);
        let tagIndex = -1;
        let currentIndex = -1;

        items.forEach((item, i) => {
            const text = options.textSelector
                ? (item.querySelector(options.textSelector)?.textContent.trim() || '')
                : item.textContent.trim();
            if (item.classList.contains(options.activeClass)) {
                currentIndex = i;
            }
            if (text === tag) {
                tagIndex = i;
            }
        });

        if (tagIndex >= 0 && tagIndex !== currentIndex) {
            if (options.clickSelector) {
                const clickItems = document.querySelectorAll(options.clickSelector);
                if (clickItems[tagIndex]) clickItems[tagIndex].click();
            } else {
                items[tagIndex].click();
            }
            console.log('[tv] selectByTagText clicked index:', tagIndex);
        }
    }

    function selectByTagIndex(selector) {
        const tag = getQueryParams()['tag'];
        if (!tag) return;
        const index = Number(tag);
        if (isNaN(index)) return;
        console.log('[tv] selectByTagIndex tag:', tag, 'index:', index);

        const items = document.querySelectorAll(selector);
        let currentIndex = -1;
        items.forEach((item, i) => {
            if (item.classList.contains('active') || item.classList.contains('is-active')) {
                currentIndex = i;
            }
        });

        if (index !== currentIndex && items[index]) {
            items[index].click();
            console.log('[tv] selectByTagIndex clicked index:', index);
        }
    }

    function getRuleMethod(name) {
        return currentRule[name] || defaultRule[name];
    }

    function sendToHost(type, data) {
        if (window.native && window.native.sendIpcMessage) {
            window.native.sendIpcMessage(['tv-main'], { type, data });
        }
    }

    function injectStyles() {
        const css = document.createElement('style');
        css.id = 'tv-override';
        css.textContent = `
            html:not(#_):not(#_), body:not(#_):not(#_) { 
                overflow: hidden !important; 
                margin: 0 !important; 
                padding: 0 !important; 
            }
            .tv-video-full.tv-video-full.tv-video-full {
                position: fixed !important;
                z-index: 9999999 !important;
                width: 100vw !important;
                height: 100vh !important;
                top: 0 !important;
                left: 0 !important;
                right: 0 !important;
                bottom: 0 !important;
                background-color: rgb(0, 0, 0) !important;
                overflow: hidden !important;
                transform: none !important;
                -webkit-transform: none !important;
                -moz-transform: none !important;
                -ms-transform: none !important;
                -o-transform: none !important;
            }
            .tv-hide.tv-hide.tv-hide {
                display: none !important;
                visibility: hidden !important;
                opacity: 0 !important;
                pointer-events: none !important;
                height: 0 !important;
                width: 0 !important;
                overflow: hidden !important;
                margin: 0 !important;
                padding: 0 !important;
                border: none !important;
                position: absolute !important;
                z-index: -1 !important;
            }
            video:not(#_):not(#_)::-webkit-media-controls { display: none !important; }
            video:not(#_):not(#_)::-webkit-media-controls-enclosure { display: none !important; }
            video:not(#_):not(#_)::-webkit-media-controls-panel { display: none !important; }
            video:not(#_):not(#_)::-webkit-media-controls-play-button { display: none !important; }
        `;
        const target = document.head || document.documentElement;
        target.appendChild(css);
    }

    function hideByClass(selectors) {
        selectors.forEach(s => {
            document.querySelectorAll(s).forEach(el => {
                el.classList.add('tv-hide');
            });
        });
    }

    async function runPipeline() {
        const steps = [
            {
                name: 'preprocess',
                fn: () => getRuleMethod('preprocess')()
            },
            {
                name: 'findVideo',
                fn: () => {
                    currentVideo = getRuleMethod('findVideo')();
                    return currentVideo;
                }
            },
            {
                name: 'playFullscreen',
                fn: () => {
                    if (currentVideo) currentVideo.classList.add('tv-video-full');
                    return getRuleMethod('playFullscreen')(currentVideo);
                }
            },
            {
                name: 'postprocess',
                fn: () => {
                    getRuleMethod('postprocess')(currentVideo);
                    return true;
                }
            }
        ];
        for (const step of steps) {
            while (true) {
                try {
                    const result = await step.fn();
                    if (result) {
                        console.log('[tv] pipeline:', step.name, 'ok');
                        break;
                    }
                } catch (e) {
                    console.log('[tv] pipeline:', step.name, 'error:', e.message);
                }
                console.log('[tv] pipeline:', step.name, 'retry');
                await new Promise(r => setTimeout(r, RETRY_DELAY));
            }
        }
        getRuleMethod('tryAutoplay')();
        startMonitoring();
    }

    function startMonitoring() {
        setInterval(() => {
            if (!currentVideo) return;
            tryUnmute(currentVideo);
            sendToHost('videoInfo', getRuleMethod('getVideoInfo')());
        }, 1000);

        setInterval(() => {
            sendToHost('episodes', getRuleMethod('getEpisodeList')());
            sendToHost('qualities', getRuleMethod('getQualityList')());
            sendToHost('rates', getRuleMethod('getRateList')());
        }, MENU_CHECK_INTERVAL);
    }

    function init() {
        injectStyles();

        ['pointerdown', 'keydown', 'touchstart'].forEach((type) => {
            document.addEventListener(type, () => {
                unmuteBlocked = false;
            }, true);
        });

        document.addEventListener('keydown', (e) => {
            const video = currentVideo;
            if (!video) return;
            switch (e.key) {
                case ' ':
                case 'Enter':
                    e.preventDefault();
                    video.paused ? video.play() : video.pause();
                    break;
                case 'ArrowLeft':
                    e.preventDefault();
                    video.currentTime -= 10;
                    break;
                case 'ArrowRight':
                    e.preventDefault();
                    video.currentTime += 10;
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    video.volume = Math.min(1, video.volume + 0.1);
                    break;
                case 'ArrowDown':
                    e.preventDefault();
                    video.volume = Math.max(0, video.volume - 0.1);
                    break;
            }
        });

        window.addEventListener('message', (e) => {
            try {
                const msg = JSON.parse(e.data);
                if (msg.type === 'command') {
                    getRuleMethod('executeCommand')(msg);
                }
            } catch { }
        });

        window.tvCommand = function (action) {
            const msg = { action: action };
            const args = Array.prototype.slice.call(arguments, 1);
            switch (action) {
                case 'seek': msg.time = args[0]; break;
                case 'volume': msg.volume = args[0]; break;
                case 'rate': msg.rate = args[0]; break;
                case 'clickElement': msg.elementId = args[0]; break;
                case 'navigate': msg.url = args[0]; break;
            }
            getRuleMethod('executeCommand')(msg);
        };

        currentRule = defaultRule;
        for (const rule of PLATFORM_RULES) {
            if (rule.match(window.location.href)) {
                currentRule = rule;
                break;
            }
        }
        console.log('[tv] platform:', currentRule.name, 'url:', window.location.href);
        runPipeline();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();