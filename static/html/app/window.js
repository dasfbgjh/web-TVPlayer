(function () {
    'use strict';

    function nativeCall(name) {
        var args = Array.prototype.slice.call(arguments, 1);
        if (window.native && window.native[name]) return window.native[name].apply(null, args);
    }

    function onLayoutChange(source) {
        var el = document.querySelector('.placeholder');
        if (!el) return;
        var rect = el.getBoundingClientRect();
        var info = {
            source: source,
            x: Math.round(rect.x),
            y: Math.round(rect.y),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
            pageWidth: window.innerWidth,
            pageHeight: window.innerHeight
        };
        console.log('[layout]', JSON.stringify(info));
        if (typeof window.onLayoutUpdate === 'function') {
            window.onLayoutUpdate(info);
        }
    }

    function setupLayoutWatcher() {
        var content = document.querySelector('.placeholder');
        if (!content) return;

        var resizeObserver = new ResizeObserver(function () {
            onLayoutChange('resize');
        });
        resizeObserver.observe(content);

        var lastRect = content.getBoundingClientRect();
        var positionTimer = null;

        function checkPosition() {
            var rect = content.getBoundingClientRect();
            if (Math.round(rect.x) !== Math.round(lastRect.x) ||
                Math.round(rect.y) !== Math.round(lastRect.y)) {
                lastRect = rect;
                onLayoutChange('position');
            } else {
                lastRect = rect;
            }
        }

        var mutationObserver = new MutationObserver(function () {
            if (positionTimer) clearTimeout(positionTimer);
            positionTimer = setTimeout(checkPosition, 16);
        });
        mutationObserver.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['style', 'class']
        });

        window.addEventListener('resize', function () {
            onLayoutChange('window');
        });

        onLayoutChange('init');
    }

    function setupWindowControls() {
        var EDGE = 6;
        var cursorMap = {
            n: 'n-resize', s: 's-resize', w: 'w-resize', e: 'e-resize',
            nw: 'nw-resize', ne: 'ne-resize', sw: 'sw-resize', se: 'se-resize'
        };

        function getResizeDir(x, y, w, h) {
            var top = y < EDGE, bottom = y > h - EDGE, left = x < EDGE, right = x > w - EDGE;
            if (top && left) return 'nw'; if (top && right) return 'ne';
            if (bottom && left) return 'sw'; if (bottom && right) return 'se';
            if (top) return 'n'; if (bottom) return 's'; if (left) return 'w'; if (right) return 'e';
            return null;
        }

        document.addEventListener('mousemove', function (e) {
            if (e.buttons !== 0) return;
            var dir = getResizeDir(e.clientX, e.clientY, window.innerWidth, window.innerHeight);
            document.body.style.cursor = dir ? cursorMap[dir] : '';
            var inner = document.querySelector('.placeholder-inner');
            if (inner) inner.style.cursor = dir ? cursorMap[dir] : '';
        });

        document.addEventListener('mousedown', function (e) {
            if (e.button !== 0) return;
            var dir = getResizeDir(e.clientX, e.clientY, window.innerWidth, window.innerHeight);
            if (dir) { e.preventDefault(); e.stopPropagation(); nativeCall('windowResize', dir); }
        }, true);

        var titlebar = document.querySelector('.titlebar');
        if (titlebar) {
            titlebar.addEventListener('mousedown', function (e) {
                if (e.target.closest('.titlebar-buttons') || e.target.closest('.theme-toggle')) return;
                if (e.button !== 0) return;
                if (getResizeDir(e.clientX, e.clientY, window.innerWidth, window.innerHeight)) return;
                nativeCall('windowDrag');
            });
        }

        var minBtn = document.querySelector('.titlebar-btn.minimize') || document.querySelector('.traffic-light.minimize');
        var maxBtn = document.querySelector('.titlebar-btn.maximize') || document.querySelector('.traffic-light.zoom');
        var closeBtn = document.querySelector('.titlebar-btn.close') || document.querySelector('.traffic-light.close');

        if (minBtn) minBtn.addEventListener('click', function () { nativeCall('windowMinimize'); });
        if (maxBtn) maxBtn.addEventListener('click', function () { nativeCall('windowMaximize'); });
        if (closeBtn) closeBtn.addEventListener('click', function () { nativeCall('windowClose'); });
    }

    function setupThemeToggle() {
        var btn = document.querySelector('.theme-toggle');
        if (!btn) return;

        var savedTheme = localStorage.getItem('window-color-theme');
        if (savedTheme) {
            document.documentElement.setAttribute('data-theme', savedTheme);
            btn.textContent = savedTheme === 'light' ? '☀️' : '🌙';
        }

        btn.addEventListener('click', function () {
            var html = document.documentElement;
            var isLight = html.getAttribute('data-theme') === 'light';
            var newTheme = isLight ? '' : 'light';
            html.setAttribute('data-theme', newTheme);
            btn.textContent = isLight ? '🌙' : '☀️';
            localStorage.setItem('window-color-theme', newTheme);
        });
    }

    function setupStyleToggle() {
        var btn = document.querySelector('.style-toggle');
        if (!btn) return;

        var styles = [
            { key: 'macos', label: 'macOS' },
            { key: 'win11', label: 'Win11' },
            { key: 'glass', label: 'Glass' },
            { key: 'minimal', label: 'Minimal' }
        ];

        var current = '';
        var pageName = location.pathname.replace(/.*\//, '').replace('.html', '');
        for (var i = 0; i < styles.length; i++) {
            if (styles[i].key === pageName) { current = styles[i].key; break; }
        }

        btn.addEventListener('click', function (e) {
            e.stopPropagation();
            var existing = document.querySelector('.style-menu');
            if (existing) { existing.remove(); return; }

            var menu = document.createElement('div');
            menu.className = 'style-menu';
            for (var j = 0; j < styles.length; j++) {
                (function (s) {
                    var item = document.createElement('div');
                    item.className = 'style-menu-item' + (s.key === current ? ' active' : '');
                    item.textContent = s.label;
                    item.addEventListener('click', function (ev) {
                        ev.stopPropagation();
                        if (s.key !== current) {
                            localStorage.setItem('window-style-theme', s.key);
                            location.href = s.key + '.html' + location.search;
                        }
                        menu.remove();
                    });
                    menu.appendChild(item);
                })(styles[j]);
            }

            btn.parentElement.style.position = btn.parentElement.style.position || 'relative';
            btn.parentElement.appendChild(menu);

            var rect = btn.getBoundingClientRect();
            var parentRect = btn.parentElement.getBoundingClientRect();
            menu.style.position = 'absolute';
            menu.style.top = (rect.bottom - parentRect.top + 4) + 'px';
            menu.style.right = (parentRect.right - rect.right) + 'px';

            setTimeout(function () {
                document.addEventListener('click', function closeMenu() {
                    menu.remove();
                    document.removeEventListener('click', closeMenu);
                }, { once: true });
            }, 0);
        });
    }

    window.nativeCall = nativeCall;
    window.WindowKit = {
        nativeCall: nativeCall,
        onLayoutChange: onLayoutChange,
        setup: function () {
            setupWindowControls();
            setupThemeToggle();
            setupStyleToggle();
            setupLayoutWatcher();
        }
    };

    WindowKit.setup();
})();

(function () {
    window.onLayoutUpdate = function (info) {
        var dpr = window.devicePixelRatio || 1;
        var px = Math.round(info.x * dpr);
        var py = Math.round(info.y * dpr);
        var pw = Math.round(info.width * dpr);
        var ph = Math.round(info.height * dpr);

        if (window.native && window.native.webviewSetRect) {
            window.native.webviewSetRect('player-webview', px + 2, py, pw - 6, ph - 4);
        }
    };

    function initPlayerWebview() {
        if (!window.native || !window.native.webviewAdd) return;
        window.native.webviewAdd('player-webview', {
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            url: window.location.origin + '/player-default.html'
        });
        WindowKit.onLayoutChange('init');
    }

    initPlayerWebview();
})();