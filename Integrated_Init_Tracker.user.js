// ==UserScript==
// @name         Integrated Init Tracker for LSS Vortex
// @namespace    http://tampermonkey.net/
// @version      2.22.1
// @description  Трекер инициативы для LSS Vortex
// @author       Lizardeon & Gemini
// @match        https://vortex.longstoryshort.app/room/*
// @downloadURL  https://github.com/Lizardeon/Integrated-Init-Tracker-for-LSS-Vortex/raw/refs/heads/main/Integrated_Init_Tracker.user.js
// @updateURL    https://github.com/Lizardeon/Integrated-Init-Tracker-for-LSS-Vortex/raw/refs/heads/main/Integrated_Init_Tracker.user.js
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    /* ==========================================================================
     * SECTION 1 — CONSTANTS
     * ========================================================================== */

    /** Ключи localStorage. Меняются только при ломающих миграциях. */
    const STORAGE_KEY_STATE = 'vortex_IITStorage_v2';
    const STORAGE_KEY_PLAYERS = 'vortex_IITPlayerData_v1';
    const STORAGE_KEY_ACTIVE_TAB = 'vortex_IITActiveTab_v1';

    /** Стабильные идентификаторы DOM-узлов, вставляемых в Vortex. */
    const TAB_ID = 'mantine-custom-tab-dmtracker';
    const PANEL_ID = 'dm-tracker-integrated-panel';
    const STYLES_ID = 'dm-tracker-styles';
    const TOAST_ID = 'dm-sync-toast';

    /** Числовые ограничения — защита от ввода «999999» и подобного. */
    const LIMITS = Object.freeze({
        INITIATIVE_MAX:     99,
        AC_MAX:             99,
        HP_MAX:             999,
        TEMP_HP_MAX:        999,
        MONSTER_COUNT_MAX:  50,
        LOG_MAX_ENTRIES:    100,
    });

    /** Пороги окрашивания HP-бара. */
    const HP_THRESHOLDS = Object.freeze({
        CRITICAL: 0.25,
        WOUNDED:  0.50,
    });

    const HP_COLORS = Object.freeze({
        HEALTHY:  '#12b886',
        WOUNDED:  '#fab005',
        CRITICAL: '#fa5252',
        TEMP:     '#22d3ee',
    });

    /** Иконки типов лога — держим рядом, чтобы легко расширять. */
    const LOG_ICONS = Object.freeze({
        turn:    `<svg class="lucide lucide-swords" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--mantine-color-blue-text)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5"/><line x1="13" x2="19" y1="19" y2="13"/><line x1="16" x2="20" y1="16" y2="20"/><line x1="19" x2="21" y1="21" y2="19"/><polyline points="14.5 6.5 18 3 21 3 21 6 17.5 9.5"/><line x1="5" x2="9" y1="14" y2="18"/><line x1="7" x2="4" y1="17" y2="20"/><line x1="3" x2="5" y1="19" y2="21"/></svg>`,
        damage:  `<svg class="lucide lucide-flame" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--mantine-color-red-text)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>`,
        heal:    `<svg class="lucide lucide-heart-pulse" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--mantine-color-green-text)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/><path d="M3.22 12H9.5l.5-1 2 4.5 2-7 1.5 3.5h5.27"/></svg>`,
        status:  `<svg class="lucide lucide-sparkles" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#a855f7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>`,
        info:    `<svg class="lucide lucide-info" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--mantine-color-dimmed)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>`,
        system:  `<svg class="lucide lucide-bell" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--mantine-color-orange-text)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>`,
    });

    /* ==========================================================================
     * SECTION 2 — UTILITIES
     * ========================================================================== */

    /** Короткий уникальный id для участника боя. */
    function generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
    }

    /** Классический бросок dN. */
    function rollDice(sides) {
        return Math.floor(Math.random() * sides) + 1;
    }

    /**
     * Разбирает формулы хитов вида "2d8+4", "1d20-2", "8", "d6".
     * Возвращает минимально 1 (хиты не могут быть нулевыми при генерации).
     */
    function parseDiceFormula(expr) {
        if (!expr) return 10;
        const normalized = String(expr).trim().toLowerCase().replace(/\s+/g, '');
        const match = normalized.match(/^(\d*)d(\d+)([+\-]\d+)?$/);

        if (match) {
            const count = match[1] ? parseInt(match[1], 10) : 1;
            const sides = parseInt(match[2], 10);
            const modifier = match[3] ? parseInt(match[3], 10) : 0;
            let total = 0;
            for (let i = 0; i < count; i++) total += rollDice(sides);
            return Math.max(1, total + modifier);
        }

        const direct = parseInt(normalized, 10);
        return Number.isNaN(direct) ? 10 : direct;
    }

    /**
     * Инициатива: если пользователь ввёл «+3» или «-1», катим d20+мод.
     * Иначе — число как есть.
     */
    function parseInitiativeValue(expr) {
        if (!expr) return 0;
        const trimmed = String(expr).trim();

        if (trimmed.startsWith('+') || trimmed.startsWith('-')) {
            const mod = parseInt(trimmed, 10) || 0;
            return rollDice(20) + mod;
        }

        const direct = parseInt(trimmed, 10);
        return Number.isNaN(direct) ? 0 : direct;
    }

    /** 75 → "01:15". */
    function formatSeconds(totalSeconds) {
        const mins = Math.floor(totalSeconds / 60);
        const secs = totalSeconds % 60;
        return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }

    /** Ограничение числа в диапазоне [min, max]. */
    function clamp(n, min, max) {
        return Math.min(max, Math.max(min, n));
    }

    /* ==========================================================================
     * SECTION 3 — STATE
     * ========================================================================== */

    /** Значения по умолчанию. Отдельная фабрика — чтобы не мутировать литерал. */
    function createDefaultState() {
        return {
            participants:         [],
            current_index:        0,
            round_counter:        1,
            total_combat_time:    0,
            turn_start_timestamp: null,
            is_combat_active:     false,
            side_panel_collapsed: false,
            combat_log:           [],
        };
    }

    let state = createDefaultState();

    // Персистентность между перезагрузками страницы
    try {
        const saved = localStorage.getItem(STORAGE_KEY_STATE);
        if (saved) state = Object.assign(state, JSON.parse(saved));
        if (!Array.isArray(state.combat_log)) state.combat_log = [];
    } catch (err) {
        console.error('[IIT] Не удалось загрузить состояние:', err);
    }

    let activeStatusInputs = {}; // { [idx]: boolean } — открыт ли инпут статуса
    let timerInterval = null;
    let activeTabRestored = false;

    function saveState() {
        try {
            localStorage.setItem(STORAGE_KEY_STATE, JSON.stringify(state));
        } catch (err) {
            console.error('[IIT] Не удалось сохранить состояние:', err);
        }
    }

    /* ==========================================================================
     * SECTION 4 — PLAYER PERSISTENT DATA
     * ========================================================================== */

    /** Возвращает всё хранилище PC-данных (по имени персонажа). */
    function loadPlayerDataStore() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY_PLAYERS);
            return raw ? JSON.parse(raw) : {};
        } catch (err) {
            console.error('[IIT] Не удалось прочитать player store:', err);
            return {};
        }
    }

    function savePlayerDataStore(store) {
        try {
            localStorage.setItem(STORAGE_KEY_PLAYERS, JSON.stringify(store));
        } catch (err) {
            console.error('[IIT] Не удалось сохранить player store:', err);
        }
    }

    function getPlayerPersistentData(name) {
        if (!name) return {};
        return loadPlayerDataStore()[name] || {};
    }

    function updatePlayerPersistentData(name, updates) {
        if (!name) return;
        const store = loadPlayerDataStore();
        if (!store[name]) store[name] = {};
        Object.assign(store[name], updates);
        savePlayerDataStore(store);
    }

    /**
     * Сохраняет набор кастомных статусов PC (тех, что не пришли из листа).
     * Вызывается при изменении статусов — сохраняем «между боями».
     */
    function persistPCCustomStatuses(p) {
        if (!p || p.is_monster) return;
        const system = p.system_statuses || [];
        const custom = (p.statuses || []).filter(st => !system.includes(st));
        updatePlayerPersistentData(p.name, { customStatuses: custom });
    }

    /** Синхронизирует кастомные статусы всех PC в хранилище. */
    function persistAllPCCustomStatuses() {
        const store = loadPlayerDataStore();
        state.participants.forEach(p => {
            if (p.is_monster) return;
            const system = p.system_statuses || [];
            const custom = (p.statuses || []).filter(st => !system.includes(st));
            if (!store[p.name]) store[p.name] = {};
            store[p.name].customStatuses = custom;
        });
        savePlayerDataStore(store);
    }

    /* ==========================================================================
     * SECTION 5 — COMBAT LOG
     * ========================================================================== */

    /**
     * Добавляет запись в лог. Новые сверху; хвост старше LOG_MAX_ENTRIES обрезается.
     * @param {'turn'|'damage'|'heal'|'status'|'info'|'system'} type
     * @param {string} text — поддерживает **жирный** markdown-подобный синтаксис
     */
    function addLogEntry(type, text) {
        if (!Array.isArray(state.combat_log)) state.combat_log = [];

        const entry = {
            type,
            roundText: state.is_combat_active ? `Р${state.round_counter}` : 'Вне боя',
            timeStr:   new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            text,
        };

        state.combat_log.unshift(entry);
        if (state.combat_log.length > LIMITS.LOG_MAX_ENTRIES) state.combat_log.pop();

        saveState();
        renderCombatLog();
    }

    function renderCombatLog() {
        const container = document.getElementById('dm-combat-log-list');
        if (!container) return;

        if (!state.combat_log?.length) {
            container.innerHTML = `<div style="color:var(--mantine-color-dimmed); font-size:10px; text-align:center; padding:6px 0;">Событий пока нет</div>`;
            return;
        }

        container.innerHTML = state.combat_log.map(item => {
            const text = item.text.replace(/\*\*(.*?)\*\*/g, '<strong style="color:var(--mantine-color-text); font-weight:700;">$1</strong>');
            const icon = LOG_ICONS[item.type] || LOG_ICONS.info;
            return `
                <div style="display: flex; gap: 6px; align-items: flex-start; padding: 4px 6px; background: var(--mantine-color-dark-light); border-radius: 4px; font-size: 10px; line-height: 1.35; border: 1px solid rgba(255,255,255,0.03);">
                    <span style="display: inline-flex; margin-top: 1px; flex-shrink: 0;">${icon}</span>
                    <div style="display: flex; flex-direction: column; flex: 1; overflow: hidden;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1px;">
                            <span style="font-size: 8px; font-weight: 800; color: var(--mantine-color-blue-text); text-transform: uppercase; letter-spacing: 0.3px;">${item.roundText}</span>
                            <span style="font-size: 8px; color: var(--mantine-color-dimmed); font-family: monospace;">${item.timeStr}</span>
                        </div>
                        <span style="color: var(--mantine-color-dimmed); word-break: break-word;">${text}</span>
                    </div>
                </div>`;
        }).join('');
    }

    /* ==========================================================================
     * SECTION 6 — DOM PARSING (Vortex → наша модель)
     * ========================================================================== */

    function extractAvatar(card) {
        const img = card.querySelector('.PartyCardStoryview_avatar__Ohnpi img');
        return img?.getAttribute('src') || '';
    }

    function extractAc(card) {
        const shield = card.querySelector('svg.lucide-shield');
        if (!shield) return 10;
        const container = shield.closest('.m_4081bf90');
        const valEl = container?.querySelector('p[data-size="sm"]');
        return parseInt(valEl?.innerText) || 10;
    }

    function extractHpText(card) {
        const heart = card.querySelector('svg.lucide-heart');
        if (!heart) return '0 / 0';
        const container = heart.closest('.CardOverlay_trigger__otFTj');
        return container?.querySelector('p[data-size="sm"]')?.innerText.trim() || '0 / 0';
    }

    function extractTempHp(card) {
        const heartPlus = card.querySelector('svg.lucide-heart-plus');
        if (!heartPlus) return 0;
        const container = heartPlus.closest('.m_4081bf90');
        return parseInt(container?.querySelector('p[data-size="sm"]')?.innerText) || 0;
    }

    function extractStatuses(card) {
        const badges = card.querySelectorAll('.PartyCardStoryview_badgeRemovable__83_z7 .mantine-Badge-label');
        const result = [];
        badges.forEach(b => {
            const text = b.querySelector('.mantine-Text-root')?.innerText;
            if (text) result.push(text.trim());
        });
        return result;
    }

    /**
     * Парсит карточки PC из нативного DOM Vortex.
     * Возвращает массив снимков; состояние трекера не трогает.
     */
    function parsePlayersFromDOM() {
        const cards = document.querySelectorAll('.PartyCardStoryview_card__u4b6T');
        const players = [];

        cards.forEach(card => {
            const nameEl = card.querySelector('p[style*="font-weight: 700"]');
            if (!nameEl) return;
            const name = nameEl.innerText.replace(/[\u00a0\s]+/g, ' ').trim();

            players.push({
                name,
                avatar:   extractAvatar(card),
                ac:       extractAc(card),
                hp_text:  extractHpText(card),
                temp_hp:  extractTempHp(card),
                statuses: extractStatuses(card),
            });
        });

        return players;
    }

    /** Ищет последний бросок инициативы игрока в нативном логе. */
    function findLatestInitiativeFromLog(logEntries, playerName) {
        for (let i = logEntries.length - 1; i >= 0; i--) {
            const entry = logEntries[i];
            const authorEl = entry.querySelector('.LogEntry_authorName__fTMQR');
            const titleEl = entry.querySelector('.LogEntry_title__5R6wX');
            const totalEl = entry.querySelector('.LogEntry_total__7Am39');
            if (!authorEl || !titleEl || !totalEl) continue;

            const logName = authorEl.innerText.replace(/[\u00a0\s]+/g, ' ').trim();
            if (logName === playerName && titleEl.innerText.toLowerCase().includes('инициатив')) {
                return parseInt(totalEl.innerText.trim(), 10) || 10;
            }
        }
        return 10;
    }

    /* ==========================================================================
     * SECTION 7 — TAB INJECTION & NAVIGATION
     * ========================================================================== */

    function injectGlobalStyles() {
        if (document.getElementById(STYLES_ID)) return;
        const style = document.createElement('style');
        style.id = STYLES_ID;
        style.innerText = `
            #dm-cards-grid input[type=number]::-webkit-outer-spin-button,
            #dm-cards-grid input[type=number]::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
            #dm-cards-grid input[type=number] { -moz-appearance: textfield; }

            .dm-interactive-btn, .dm-interactive-btn-blue, .dm-interactive-btn-blue-light, .dm-interactive-btn-red {
                transition: background-color 0.15s ease, transform 0.1s ease, box-shadow 0.15s ease, border-color 0.15s ease, color 0.15s ease !important;
                outline: none !important;
                border: none;
            }
            .dm-interactive-btn:active, .dm-interactive-btn-blue:active, .dm-interactive-btn-blue-light:active, .dm-interactive-btn-red:active {
                transform: scale(0.96) translateY(0) !important;
                box-shadow: none !important;
            }
            .dm-interactive-btn {
                background: var(--mantine-color-dark-light) !important;
                color: var(--mantine-color-text) !important;
            }
            .dm-interactive-btn:hover {
                background: var(--mantine-color-dark-hover) !important;
                transform: translateY(-1px);
            }
            .dm-interactive-btn-blue { background: var(--mantine-color-blue-filled) !important; }
            .dm-interactive-btn-blue:hover {
                background: var(--mantine-color-blue-filled-hover, #1c7ed6) !important;
                filter: brightness(1.08);
                transform: translateY(-1px);
                box-shadow: 0 3px 8px rgba(34, 139, 230, 0.3);
            }
            .dm-interactive-btn-blue-light {
                background: var(--mantine-color-blue-light) !important;
                color: var(--mantine-color-blue-text) !important;
            }
            .dm-interactive-btn-blue-light:hover {
                background: var(--mantine-color-blue-outline) !important;
                color: #fff !important;
                transform: translateY(-1px);
            }
            .dm-interactive-btn-red {
                background: transparent !important;
                border: 1px solid var(--mantine-color-red-text) !important;
                color: var(--mantine-color-red-text) !important;
                box-sizing: border-box;
            }
            .dm-interactive-btn-red:hover {
                background: var(--mantine-color-red-filled) !important;
                color: #fff !important;
                border-color: transparent !important;
                transform: translateY(-1px);
                box-shadow: 0 3px 8px rgba(250, 82, 82, 0.25);
            }

            .dm-side-panel.collapsed { display: none !important; }

            .dm-collapsible-card {
                background-color: var(--mantine-color-body);
                border: 1px solid var(--mantine-color-default-border);
                border-radius: var(--mantine-radius-sm);
                padding: 8px 10px;
                box-shadow: var(--mantine-shadow-xs);
            }
            .dm-collapsible-summary {
                font-size: 11px;
                font-weight: 700;
                color: var(--mantine-color-blue-text);
                cursor: pointer;
                user-select: none;
                text-transform: uppercase;
                letter-spacing: 0.3px;
                display: flex;
                align-items: center;
                justify-content: space-between;
                outline: none;
            }
            .dm-collapsible-summary::-webkit-details-marker { display: none; }
            .dm-collapsible-summary::after {
                content: '';
                width: 6px; height: 6px;
                border-right: 2px solid var(--mantine-color-dimmed);
                border-bottom: 2px solid var(--mantine-color-dimmed);
                transform: rotate(45deg);
                transition: transform 0.2s ease;
                margin-right: 2px;
            }
            details[open] .dm-collapsible-summary::after { transform: rotate(-135deg); }

            @media (max-width: 768px) {
                .dm-main-layout { flex-direction: column !important; }
                .dm-main-content { min-width: 100% !important; }
                .dm-side-panel { width: 100% !important; }
                .dm-header-bar { flex-wrap: wrap !important; gap: 12px !important; }
                .dm-header-controls { width: 100%; justify-content: flex-end; }
                .dm-card-row {
                    grid-template-columns: 36px 1fr !important;
                    row-gap: 8px !important;
                    padding: 8px 10px !important;
                }
                .dm-card-hp-ac-group {
                    grid-column: 1 / -1;
                    display: flex !important;
                    justify-content: space-between !important;
                    align-items: center !important;
                    width: 100% !important;
                    border-top: 1px dashed var(--mantine-color-default-border);
                    padding-top: 4px !important;
                    gap: 8px !important;
                }
                .dm-card-hp { flex: 1 !important; justify-content: flex-start !important; }
                .dm-card-ac {
                    border-left: none !important;
                    padding-left: 0 !important;
                    height: auto !important;
                }
                .dm-hp-widget { width: 100% !important; }
                .dm-hp-progress-box { flex: 1 !important; width: auto !important; }
            }

            .dm-card-row .dm-btn-delete-participant {
                opacity: 0;
                pointer-events: none;
                transition: opacity 0.15s ease !important;
            }
            .dm-card-row:hover .dm-btn-delete-participant {
                opacity: 1;
                pointer-events: auto;
            }
        `;
        document.head.appendChild(style);
    }

    function switchToDmTab() {
        try { localStorage.setItem(STORAGE_KEY_ACTIVE_TAB, 'dm'); } catch (e) {}

        const tabList = document.querySelector('.mantine-Tabs-list');
        if (!tabList) return;

        tabList.querySelectorAll('.mantine-Tabs-tab').forEach(t => {
            t.setAttribute('aria-selected', 'false');
            t.removeAttribute('data-active');
            t.setAttribute('tabindex', '-1');
        });

        const dmTab = document.getElementById(TAB_ID);
        if (dmTab) {
            dmTab.setAttribute('aria-selected', 'true');
            dmTab.setAttribute('data-active', 'true');
            dmTab.setAttribute('tabindex', '0');
        }

        document.querySelectorAll(`[id*="-panel-"]:not(#${PANEL_ID})`).forEach(p => p.style.display = 'none');

        const dmPanel = document.getElementById(PANEL_ID);
        if (dmPanel) {
            dmPanel.style.display = 'block';
            window.renderTracker();
            startTimerLogic();
        }
    }

    function handleNativeTabClick(clickedTab) {
        try {
            if (clickedTab?.id) localStorage.setItem(STORAGE_KEY_ACTIVE_TAB, clickedTab.id);
        } catch (e) {}

        const dmTab = document.getElementById(TAB_ID);
        if (dmTab) {
            dmTab.setAttribute('aria-selected', 'false');
            dmTab.removeAttribute('data-active');
            dmTab.setAttribute('tabindex', '-1');
        }

        const dmPanel = document.getElementById(PANEL_ID);
        if (dmPanel) dmPanel.style.display = 'none';
        stopTimerLogic();

        // Даём Mantine время выставить свой display для panel, затем принудительно показываем.
        setTimeout(() => {
            const targetId = clickedTab.getAttribute('aria-controls');
            if (!targetId) return;
            document.getElementById(targetId)?.style && (document.getElementById(targetId).style.display = 'block');
        }, 10);
    }

    /** Гарантирует, что вкладка «Бой» и панель трекера вставлены. Идемпотентно. */
    function checkAndInject() {
        const tabList = document.querySelector('.mantine-Tabs-list');
        if (!tabList) return;

        injectGlobalStyles();
        ensureDmTab(tabList);
        bindNativeTabListeners(tabList);
        ensureDmPanel();

        // Панель уже в DOM — можно восстанавливать вкладку (один раз за загрузку).
        if (document.getElementById(PANEL_ID) && !activeTabRestored) {
            activeTabRestored = true;
            restoreActiveTab();
        }
    }

    function ensureDmTab(tabList) {
        if (document.getElementById(TAB_ID)) return;

        const tab = document.createElement('button');
        tab.id = TAB_ID;
        tab.className = 'mantine-focus-auto m_539e827b m_4ec4dce6 mantine-Tabs-tab m_87cf2631 mantine-UnstyledButton-root';
        tab.setAttribute('data-variant', 'default');
        tab.setAttribute('data-orientation', 'horizontal');
        tab.setAttribute('type', 'button');
        tab.setAttribute('role', 'tab');
        tab.setAttribute('aria-selected', 'false');
        tab.setAttribute('tabindex', '-1');
        tab.style.display = 'inline-flex';
        tab.style.alignItems = 'center';
        tab.style.gap = '6px';

        tab.innerHTML = `
            <span style="display:flex; align-items:center; justify-content:center; width:14px; height:14px;">
                <svg class="lucide lucide-swords" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5"/><line x1="13" x2="19" y1="19" y2="13"/><line x1="16" x2="20" y1="16" y2="20"/><line x1="19" x2="21" y1="21" y2="19"/><polyline points="14.5 6.5 18 3 21 3 21 6 17.5 9.5"/><line x1="5" x2="9" y1="14" y2="18"/><line x1="7" x2="4" y1="17" y2="20"/><line x1="3" x2="5" y1="19" y2="21"/></svg>
            </span>
            <span class="mantine-Tabs-tabLabel" style="font-size:13px;">Бой</span>
        `;
        tab.addEventListener('click', switchToDmTab);
        tabList.appendChild(tab);
    }

    function bindNativeTabListeners(tabList) {
        tabList.querySelectorAll(`.mantine-Tabs-tab:not(#${TAB_ID})`).forEach(tab => {
            if (tab.dataset.dmListenerAttached) return;
            tab.dataset.dmListenerAttached = 'true';
            tab.addEventListener('click', () => handleNativeTabClick(tab));
        });
    }

    function ensureDmPanel() {
        if (document.getElementById(PANEL_ID)) return;

        const originalPanel = document.querySelector('[id*="-panel-"]');
        if (!originalPanel?.parentNode) return;

        const panel = document.createElement('div');
        panel.id = PANEL_ID;
        panel.style.display = 'none';
        panel.style.width = '100%';
        panel.style.marginTop = '12px';
        panel.style.boxSizing = 'border-box';

        buildTrackerLayout(panel);
        originalPanel.parentNode.appendChild(panel);
    }

    /* ==========================================================================
     * SECTION 8 — TIMER
     * ========================================================================== */

    function stopTimerLogic() {
        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
        }
    }

    function startTimerLogic() {
        stopTimerLogic();
        if (!state.is_combat_active) return;

        if (!state.turn_start_timestamp && state.participants.length > 0) {
            state.turn_start_timestamp = Date.now();
            saveState();
        }

        timerInterval = setInterval(() => {
            if (state.participants.length === 0 || !state.is_combat_active) return;

            state.total_combat_time = (state.total_combat_time || 0) + 1;

            // Время PC-шников учитываем только для активного игрока.
            const active = state.participants[state.current_index];
            if (active && !active.is_monster) {
                active.total_time_spent = (active.total_time_spent || 0) + 1;
            }

            saveState();

            const timeEl = document.getElementById('dm-turn-timer-display');
            if (timeEl && state.turn_start_timestamp) {
                timeEl.innerText = formatSeconds(Math.floor((Date.now() - state.turn_start_timestamp) / 1000));
            }

            updateStatisticsPanel();
        }, 1000);
    }

    /* ==========================================================================
     * SECTION 9 — LAYOUT BUILDING
     * ========================================================================== */

    function buildTrackerLayout(container) {
        container.innerHTML = buildLayoutHtml();
        bindLayoutEvents(container);
        renderCombatLog();
    }

    function buildLayoutHtml() {
        return `
            <div class="dm-main-layout" style="display:flex; flex-direction:row; gap:12px; font-family:ui-sans-serif, system-ui, sans-serif; color:var(--mantine-color-text); box-sizing:border-box; width:100%; align-items:start; flex-wrap:wrap;">
                <div class="dm-main-content" style="flex:1; min-width:320px; display:flex; flex-direction:column; gap:8px;">
                    ${buildHeaderBarHtml()}
                    <div id="dm-cards-grid" style="display:flex; flex-direction:column; gap:6px; width:100%; box-sizing:border-box;"></div>
                </div>
                ${buildSidePanelHtml()}
            </div>
        `;
    }

    function buildHeaderBarHtml() {
        return `
            <div class="dm-header-bar" style="background-color: var(--mantine-color-body); border: 1px solid var(--mantine-color-default-border); border-radius: var(--mantine-radius-sm); padding: 10px 14px; display: flex; justify-content: space-between; align-items: center; gap: 8px; box-shadow: var(--mantine-shadow-xs);">
                <div style="display:flex; align-items:center; gap:16px;">
                    <div style="display:flex; flex-direction:column;">
                        <span style="color: var(--mantine-color-dimmed); text-transform: uppercase; font-size: 9px; letter-spacing: 0.5px; font-weight: 700;">Раунд</span>
                        <span id="dm-round-display" style="color: var(--mantine-color-blue-text); font-family: monospace; font-size: 22px; font-weight: 800; line-height: 1;">1</span>
                    </div>
                    <div style="display:flex; flex-direction:column; border-left: 1px solid var(--mantine-color-default-border); padding-left: 14px;">
                        <span style="color: var(--mantine-color-dimmed); text-transform: uppercase; font-size: 9px; letter-spacing: 0.5px; font-weight: 700;">Время хода</span>
                        <span id="dm-turn-timer-display" style="color: var(--mantine-color-orange-text, #f59e0b); font-family: monospace; font-size: 22px; font-weight: 800; line-height: 1;">00:00</span>
                    </div>
                    <button id="dm-btn-toggle-side" class="dm-interactive-btn" style="height: 28px; padding: 0 10px; font-size: 11px; font-weight: 600; border-radius: var(--mantine-radius-sm); cursor: pointer; display: flex; align-items: center; gap: 4px; border-left: 1px solid var(--mantine-color-default-border); margin-left: 4px;" title="Скрыть/Показать боковую панель">
                        <svg class="lucide lucide-panel-right-close" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M15 3v18"/><path d="m10 15 3-3-3-3"/></svg>
                        <span id="dm-toggle-side-text">Панель</span>
                    </button>
                </div>
                <div id="dm-controls-wrapper" class="dm-header-controls" style="display:flex; align-items:center; gap:6px;"></div>
            </div>
        `;
    }

    function buildSidePanelHtml() {
        const collapsedClass = state.side_panel_collapsed ? 'collapsed' : '';
        return `
            <div class="dm-side-panel ${collapsedClass}" style="width: 240px; display: flex; flex-direction: column; gap: 8px; box-sizing: border-box;">
                ${buildControlPanelHtml()}
                ${buildMonsterFormHtml()}
                ${buildAnalyticsPanelHtml()}
                ${buildCombatLogPanelHtml()}
            </div>
        `;
    }

    function buildControlPanelHtml() {
        return `
            <details class="dm-collapsible-card" open>
                <summary class="dm-collapsible-summary">
                    <span style="display:inline-flex; align-items:center; gap:6px;">
                        <svg class="lucide lucide-sliders-horizontal" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="21" x2="14" y1="4" y2="4"/><line x1="10" x2="3" y1="4" y2="4"/><line x1="21" x2="12" y1="12" y2="12"/><line x1="8" x2="3" y1="12" y2="12"/><line x1="21" x2="16" y1="20" y2="20"/><line x1="12" x2="3" y1="20" y2="20"/><line x1="14" x2="14" y1="2" y2="6"/><line x1="8" x2="8" y1="10" y2="14"/><line x1="16" x2="16" y1="18" y2="22"/></svg>
                        Управление
                    </span>
                </summary>
                <div style="display:flex; flex-direction:column; gap:6px; margin-top:8px;">
                    <div style="display:grid; grid-template-columns: repeat(2, 1fr); gap: 4px;">
                        <button id="dm-btn-export" class="dm-interactive-btn" title="Экспорт боя (.json)" style="height:28px; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:4px; font-size:11px;">
                            <svg class="lucide lucide-download" xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg> Экспорт
                        </button>
                        <button id="dm-btn-import" class="dm-interactive-btn" title="Импорт боя (.json)" style="height:28px; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:4px; font-size:11px;">
                            <svg class="lucide lucide-upload" xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg> Импорт
                        </button>
                        <input type="file" id="dm-import-file-input" accept=".json" style="display:none;">
                    </div>
                    <button id="dm-btn-clear" class="dm-interactive-btn-red" style="border-radius: var(--mantine-radius-sm); height:28px; cursor:pointer; font-weight:600; font-size:11px; display:flex; align-items:center; justify-content:center; gap:6px;">
                        <svg class="lucide lucide-rotate-ccw" xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
                        Новое столкновение
                    </button>
                </div>
            </details>
        `;
    }

    function buildMonsterFormHtml() {
        return `
            <details class="dm-collapsible-card" open>
                <summary class="dm-collapsible-summary">
                    <span style="display:inline-flex; align-items:center; gap:6px;">
                        <svg class="lucide lucide-user-plus" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" x2="19" y1="8" y2="14"/><line x1="22" x2="16" y1="11" y2="11"/></svg>
                        Добавить NPC
                    </span>
                </summary>
                <form id="dm-monster-form" style="display:flex; flex-direction:column; gap:6px; margin-top:8px;">
                    <div style="display:grid; grid-template-columns: 1fr 45px; gap: 4px; width:100%;">
                        <input type="text" id="dm-m-name" placeholder="Имя NPC" required style="background-color: var(--mantine-color-dark-light); border: 1px solid var(--mantine-color-default-border); border-radius: var(--mantine-radius-sm); padding: 4px 8px; color: var(--mantine-color-text); font-size: 12px; outline: none; box-sizing: border-box;">
                        <input type="number" id="dm-m-count" min="1" max="50" value="1" title="Количество" required style="background-color: var(--mantine-color-dark-light); border: 1px solid var(--mantine-color-default-border); border-radius: var(--mantine-radius-sm); padding: 4px 2px; color: var(--mantine-color-text); font-size: 12px; text-align: center; outline: none; box-sizing: border-box;">
                    </div>
                    <div style="display:grid; grid-template-columns: 3fr 4fr 2fr; gap: 4px; width:100%;">
                        <div style="display:flex; flex-direction:column; gap:2px;">
                            <label style="font-size:8px; color:var(--mantine-color-dimmed); font-weight:600; text-align:center;">Иниц</label>
                            <input type="text" id="dm-m-init" placeholder="10 или +3" required style="background-color: var(--mantine-color-dark-light); border: 1px solid var(--mantine-color-default-border); border-radius: var(--mantine-radius-sm); padding: 4px 2px; color: var(--mantine-color-text); font-size: 11px; text-align: center; outline: none; width:100%; box-sizing:border-box;">
                        </div>
                        <div style="display:flex; flex-direction:column; gap:2px;">
                            <label style="font-size:8px; color:var(--mantine-color-dimmed); font-weight:600; text-align:center;">Хитов</label>
                            <input type="text" id="dm-m-hp" placeholder="15 или 2d8+2" required style="background-color: var(--mantine-color-dark-light); border: 1px solid var(--mantine-color-default-border); border-radius: var(--mantine-radius-sm); padding: 4px 2px; color: var(--mantine-color-text); font-size: 11px; text-align: center; outline: none; width:100%; box-sizing:border-box;">
                        </div>
                        <div style="display:flex; flex-direction:column; gap:2px;">
                            <label style="font-size:8px; color:var(--mantine-color-dimmed); font-weight:600; text-align:center;">КД</label>
                            <input type="number" id="dm-m-ac" min="0" max="99" placeholder="12" required style="background-color: var(--mantine-color-dark-light); border: 1px solid var(--mantine-color-default-border); border-radius: var(--mantine-radius-sm); padding: 4px 2px; color: var(--mantine-color-text); font-size: 12px; text-align: center; outline: none; width:100%; box-sizing:border-box;">
                        </div>
                    </div>
                    <button type="submit" class="dm-interactive-btn-blue" style="border-radius: var(--mantine-radius-sm); height:28px; font-size:12px; font-weight:600; cursor:pointer; display:flex; align-items:center; justify-content:center; margin-top:2px; color:#fff; gap:4px;">
                        <svg class="lucide lucide-plus" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" x2="12" y1="5" y2="19"/><line x1="5" x2="19" y1="12" y2="12"/></svg> Добавить в бой
                    </button>
                </form>
            </details>
        `;
    }

    function buildAnalyticsPanelHtml() {
        return `
            <details class="dm-collapsible-card" open>
                <summary class="dm-collapsible-summary">
                    <span style="display:inline-flex; align-items:center; gap:6px;">
                        <svg class="lucide lucide-bar-chart-2" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" x2="18" y1="20" y2="10"/><line x1="12" x2="12" y1="20" y2="4"/><line x1="6" x2="6" y1="20" y2="14"/></svg>
                        Аналитика
                    </span>
                </summary>
                <div id="dm-stats-panel" style="display:flex; flex-direction:column; gap:6px; margin-top:8px;">
                    <div style="font-size:11px; display:flex; flex-direction:column; gap:2px; color: var(--mantine-color-text);">
                        <div style="display:flex; justify-content:space-between;"><span style="color:var(--mantine-color-dimmed);">Время боя:</span><span id="stat-total-combat" style="font-family:monospace; font-weight:600;">00:00</span></div>
                        <div style="display:flex; justify-content:space-between;"><span style="color:var(--mantine-color-dimmed);">Ср. на раунд:</span><span id="stat-avg-round" style="font-family:monospace; font-weight:600;">00:00</span></div>
                    </div>
                    <div style="border-top: 1px dashed var(--mantine-color-default-border); margin-top: 4px; padding-top: 4px;">
                        <table style="width:100%; font-size:10px; border-collapse:collapse; color: var(--mantine-color-text);">
                            <thead>
                                <tr style="color:var(--mantine-color-dimmed); text-align:left;">
                                    <th style="font-weight:600; padding-bottom:3px;">Игрок</th>
                                    <th style="font-weight:600; text-align:right; padding-bottom:3px;">Всего</th>
                                    <th style="font-weight:600; text-align:right; padding-bottom:3px;">Ср./ход</th>
                                </tr>
                            </thead>
                            <tbody id="stat-players-tbody">
                                <tr><td colspan="3" style="text-align:center; color:var(--mantine-color-dimmed); padding:4px 0;">Нет данных</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </details>
        `;
    }

    function buildCombatLogPanelHtml() {
        return `
            <details id="dm-combat-log-details" class="dm-collapsible-card" open>
                <summary class="dm-collapsible-summary">
                    <span style="display:inline-flex; align-items:center; gap:6px;">
                        <svg class="lucide lucide-scroll-text" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 21h12a2 2 0 0 0 2-2v-2H10v2a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v3h4"/><path d="M19 17V5a2 2 0 0 0-2-2H4"/><path d="M15 8h-5"/><path d="M15 12h-5"/></svg>
                        Лог
                    </span>
                </summary>
                <div id="dm-combat-log-list" style="max-height:180px; overflow-y:auto; margin-top:8px; display:flex; flex-direction:column; gap:4px; padding-right:2px;"></div>
            </details>
        `;
    }

    /** Навешивает обработчики на только что построенный layout. */
    function bindLayoutEvents(container) {
        container.querySelector('#dm-btn-toggle-side').addEventListener('click', toggleSidePanel);
        container.querySelector('#dm-btn-export').addEventListener('click', exportBattle);

        const fileInput = container.querySelector('#dm-import-file-input');
        container.querySelector('#dm-btn-import').addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', importBattle);

        container.querySelector('#dm-btn-clear').addEventListener('click', openClearAndSyncModal);
        container.querySelector('#dm-monster-form').addEventListener('submit', handleMonsterFormSubmit);
    }

    /* ==========================================================================
     * SECTION 10 — ACTIONS
     * ========================================================================== */

    function toggleSidePanel() {
        state.side_panel_collapsed = !state.side_panel_collapsed;
        saveState();
        document.querySelector('.dm-side-panel')
            ?.classList.toggle('collapsed', state.side_panel_collapsed);
    }

    function handleMonsterFormSubmit(e) {
        e.preventDefault();
        const form = e.target;
        const baseName = form.querySelector('#dm-m-name').value.trim();
        const rawInit = form.querySelector('#dm-m-init').value;
        const rawHp = form.querySelector('#dm-m-hp').value;
        const ac = clamp(parseInt(form.querySelector('#dm-m-ac').value, 10) || 10, 0, LIMITS.AC_MAX);
        const count = clamp(parseInt(form.querySelector('#dm-m-count').value, 10) || 1, 1, LIMITS.MONSTER_COUNT_MAX);

        // Каждый монстр серии получает свою инициативу и свои хиты.
        for (let i = 1; i <= count; i++) {
            const name = count > 1 ? `${baseName} #${i}` : baseName;
            const initiative = clamp(parseInitiativeValue(rawInit), 0, LIMITS.INITIATIVE_MAX);
            const maxHp = clamp(parseDiceFormula(rawHp), 1, LIMITS.HP_MAX);

            state.participants.push({
                id: generateId(), name, initiative, ac,
                description: '',
                hp: maxHp, max_hp: maxHp, temp_hp: 0,
                is_monster: true, avatar: '', statuses: [],
            });

            addLogEntry('info', `Добавлен NPC **${name}** (Иниц: ${initiative}, Хитов: ${maxHp}, КД: ${ac})`);
        }

        state.participants.sort((a, b) => b.initiative - a.initiative);
        saveState();
        form.reset();
        form.querySelector('#dm-m-count').value = 1;
        window.renderTracker();
    }

    /** Сдвиг текущего хода. direction = +1 (вперёд) или -1 (назад). */
    function handleTurnChange(direction) {
        if (state.participants.length === 0) return;

        const oldRound = state.round_counter;
        let attempts = 0;

        // Пропускаем мёртвых NPC по кругу; ограничиваем попытки длиной списка.
        do {
            state.current_index += direction;
            if (state.current_index >= state.participants.length) {
                state.current_index = 0;
                state.round_counter++;
            } else if (state.current_index < 0) {
                state.current_index = state.participants.length - 1;
                state.round_counter = Math.max(1, state.round_counter - 1);
            }
            attempts++;
        } while (
            state.participants[state.current_index].is_monster &&
            state.participants[state.current_index].hp <= 0 &&
            attempts < state.participants.length
        );

        const active = state.participants[state.current_index];

        // Тикаем длительности статусов вида "Яд(3)" на активном участнике.
        if (active?.statuses) {
            active.statuses = active.statuses
                .map(st => tickStatusDuration(st, active.name))
                .filter(Boolean);
        }

        state.turn_start_timestamp = Date.now();
        if (active && !active.is_monster) {
            active.turns_count = (active.turns_count || 0) + 1;
        }

        if (oldRound !== state.round_counter) {
            addLogEntry('system', `**Начался Раунд ${state.round_counter}**`);
        }
        if (active) {
            addLogEntry('turn', `Ход перешел к **${active.name}**`);
        }

        saveState();
        if (typeof window.syncPlayers === 'function') window.syncPlayers(true);
        window.renderTracker();
    }

    /**
     * Уменьшает счётчик в конце строки "Имя(3)" → "Имя(2)".
     * Возвращает null, если статус истёк.
     */
    function tickStatusDuration(statusText, ownerName) {
        const match = statusText.match(/(.*)\((\d+)\)\s*$/);
        if (!match) return statusText;

        const name = match[1].trim();
        const remaining = parseInt(match[2], 10) - 1;
        if (remaining <= 0) {
            addLogEntry('status', `У **${ownerName}** истек статус "${name}"`);
            return null;
        }
        return `${name} (${remaining})`;
    }

    /* ==========================================================================
     * SECTION 11 — RENDERING
     * ========================================================================== */

    window.renderTracker = function () {
        renderHeaderState();
        renderControlButtons();
        renderCardsGrid();
        updateStatisticsPanel();
        renderCombatLog();
    };

    function renderHeaderState() {
        const roundEl = document.getElementById('dm-round-display');
        if (roundEl) roundEl.innerText = state.round_counter;

        const timeEl = document.getElementById('dm-turn-timer-display');
        if (!timeEl) return;

        if (state.is_combat_active && state.turn_start_timestamp) {
            timeEl.innerText = formatSeconds(Math.floor((Date.now() - state.turn_start_timestamp) / 1000));
        } else {
            timeEl.innerText = '00:00';
        }
    }

    function renderControlButtons() {
        const wrapper = document.getElementById('dm-controls-wrapper');
        if (!wrapper) return;

        const combatNotStarted = !state.is_combat_active && state.participants.length > 0;

        if (combatNotStarted) {
            wrapper.innerHTML = `
                <button id="dm-btn-start-combat" class="dm-interactive-btn-blue" style="height:34px; border-radius: var(--mantine-radius-sm); color:#fff; padding:0 20px; font-size:13px; font-weight:700; cursor:pointer; display:inline-flex; align-items:center; gap:6px;">
                    <svg class="lucide lucide-play" style="width:14px; height:14px;" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="6 3 20 12 6 21 6 3"/></svg>
                    Начать бой
                </button>`;
            wrapper.querySelector('#dm-btn-start-combat').onclick = startCombat;
        } else {
            wrapper.innerHTML = `
                <button id="dm-btn-prev" class="dm-interactive-btn" style="height:34px; border-radius: var(--mantine-radius-sm); padding:0 12px; font-size:13px; font-weight:600; cursor:pointer; display:inline-flex; align-items:center; gap:4px;">
                    <svg class="lucide lucide-chevron-left" style="width:14px; height:14px;" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                    Пред.
                </button>
                <button id="dm-btn-next" class="dm-interactive-btn-blue" style="height:34px; border-radius: var(--mantine-radius-sm); color:#fff; padding:0 14px; font-size:13px; font-weight:600; cursor:pointer; display:inline-flex; align-items:center; gap:4px;">
                    След.
                    <svg class="lucide lucide-chevron-right" style="width:14px; height:14px;" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                </button>`;
            wrapper.querySelector('#dm-btn-next').onclick = () => handleTurnChange(1);
            wrapper.querySelector('#dm-btn-prev').onclick = () => handleTurnChange(-1);
        }
    }

    function startCombat() {
        state.is_combat_active = true;
        state.turn_start_timestamp = Date.now();

        const first = state.participants[state.current_index];
        if (first && !first.is_monster) first.turns_count = 1;

        addLogEntry('turn', `**Бой начался!** Первым ходит **${first?.name || 'Никого'}**`);
        saveState();
        window.renderTracker();
        startTimerLogic();
    }

    function renderCardsGrid() {
        const grid = document.getElementById('dm-cards-grid');
        if (!grid) return;

        if (state.participants.length === 0) {
            grid.innerHTML = `
                <div style="padding: 24px; text-align: center; color: var(--mantine-color-dimmed); font-size:13px; border: 1px dashed var(--mantine-color-default-border); border-radius: var(--mantine-radius-sm); background: var(--mantine-color-body);">
                    Инициатива пуста. Загрузите бойцов кнопкой справа.
                </div>`;
            return;
        }

        grid.innerHTML = state.participants
            .map((p, idx) => buildParticipantCard(p, idx))
            .join('');
    }

    function buildParticipantCard(p, idx) {
        const isCurrent = idx === state.current_index && state.is_combat_active;
        const isDead = p.is_monster && p.hp <= 0;

        const cardBackground = isCurrent ? 'rgba(34, 139, 230, 0.06)' : 'var(--mantine-color-body)';
        const cardBorder = isCurrent ? '2px solid var(--mantine-color-blue-filled)' : '1px solid var(--mantine-color-default-border)';
        const cardOpacity = isDead ? '0.55' : '1';

        return `
            <div class="dm-card-row" style="background-color:${cardBackground}; border:${cardBorder}; opacity:${cardOpacity}; border-radius: var(--mantine-radius-sm); padding: 6px 12px; display:grid; grid-template-columns: 40px 1.2fr 1fr auto; align-items:center; gap:12px; width:100%; box-sizing:border-box; min-height:54px; transition: opacity 0.2s ease;">
                <div style="display:flex; align-items:center; justify-content:start;">
                    <input type="number" min="0" max="99" value="${p.initiative}" onblur="window.updateFieldLocal(${idx}, 'initiative', this.value); window.renderTracker();" style="width:30px; background:var(--mantine-color-dark-light); border:1px solid transparent; border-radius:3px; color:var(--mantine-color-blue-text); font-weight:800; font-size:14px; text-align:center; outline:none; padding:3px 0; font-family:monospace;">
                </div>
                <div style="display:flex; align-items:center; overflow:hidden;">
                    ${buildCardIdentity(p, idx, isDead)}
                </div>
                <div class="dm-card-statuses" style="display:flex; align-items:center; gap:5px; flex-wrap:wrap; justify-content:flex-end; padding:2px 0;">
                    ${buildCardStatuses(p, idx)}
                </div>
                <div class="dm-card-hp-ac-group" style="display:flex; align-items:center; gap:12px;">
                    <div class="dm-card-hp-ac-group" style="display:flex; align-items:center; gap:8px;">
                        <div class="dm-card-hp" style="display:flex; align-items:center; justify-content:flex-start;">
                            ${buildCardHpWidget(p, idx, isDead)}
                        </div>
                        <div class="dm-card-ac" style="display:flex; align-items:center; justify-content:flex-end; border-left: 1px solid var(--mantine-color-default-border); padding-left: 10px; height:30px;">
                            ${buildCardAcWidget(p, idx)}
                        </div>
                        ${buildCardDeleteButton(idx)}
                    </div>
                </div>
            </div>
        `;
    }

    function buildCardIdentity(p, idx, isDead) {
        const noteText = p.description || '';
        const noteInput = `
            <input type="text" value="${noteText}" placeholder="Заметка..."
                   onblur="window.updateFieldLocal(${idx}, 'description', this.value); window.renderTracker();"
                   style="background:transparent; border:none; color:var(--mantine-color-dimmed); font-size:11px; outline:none; padding:0; width:100%; margin-top:2px; text-overflow:ellipsis;">`;

        if (p.is_monster) {
            const strikeStyle = isDead ? 'text-decoration: line-through;' : '';
            return `
                <div style="display:flex; flex-direction:column; width:100%; overflow:hidden;">
                    <input type="text" value="${p.name}" onblur="window.updateFieldLocal(${idx}, 'name', this.value);"
                           style="background:transparent; border:none; color:var(--mantine-color-text); font-weight:700; font-size:15px; outline:none; padding:0; width:100%; text-overflow:ellipsis; ${strikeStyle}">
                    ${noteInput}
                </div>`;
        }

        const avatar = p.avatar
            ? `<img src="${p.avatar}" style="width:26px; height:26px; border-radius:4px; object-fit:cover;">`
            : `<div style="width:26px; height:26px; background:var(--mantine-color-blue-light); border-radius:4px; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:10px; color:var(--mantine-color-blue-text)">PC</div>`;

        return `
            <div style="display:flex; align-items:center; gap:8px; width:100%; overflow:hidden;">
                ${avatar}
                <div style="display:flex; flex-direction:column; overflow:hidden; width:100%;">
                    <span style="font-weight:700; font-size:15px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${p.name}">${p.name}</span>
                    ${noteInput}
                </div>
            </div>`;
    }

    function buildCardHpWidget(p, idx, isDead) {
        const isMonster = p.is_monster;
        const tempHp = p.temp_hp || 0;

        let currentHp, maxHp, hpText;
        if (isMonster) {
            currentHp = p.hp;
            maxHp = p.max_hp;
            hpText = `${currentHp}/${maxHp}`;
        } else {
            const parts = (p.hp_text || '0 / 0').split('/');
            currentHp = parseInt(parts[0], 10) || 0;
            maxHp = parseInt(parts[1], 10) || 0;
            hpText = (p.hp_text || '0/0').replace(/\s+/g, '');
        }

        // Ширина HP-бара: HP + temp занимают всю полосу пропорционально.
        const denom = Math.max(maxHp, currentHp) + tempHp;
        const hpPct = denom > 0 ? (currentHp / denom) * 100 : 0;
        const tempPct = denom > 0 ? (tempHp / denom) * 100 : 0;

        let barColor = HP_COLORS.HEALTHY;
        if (maxHp > 0) {
            const ratio = currentHp / maxHp;
            if (ratio <= HP_THRESHOLDS.CRITICAL) barColor = HP_COLORS.CRITICAL;
            else if (ratio <= HP_THRESHOLDS.WOUNDED) barColor = HP_COLORS.WOUNDED;
        }

        const hpTextHtml = isMonster
            ? `<span style="${isDead ? 'color:var(--mantine-color-red-text);' : ''}">${hpText}</span>`
            : `<span>${hpText}</span>`;

        const tempHpHtml = tempHp > 0
            ? `<span style="color:${HP_COLORS.TEMP}; font-weight:800;">+${tempHp}</span>`
            : '';

        const barHtml = `
            <div style="width:100%; background-color: var(--mantine-color-dark-light); border:1px solid var(--mantine-color-default-border); height:6px; border-radius:2px; display:flex; overflow:hidden;">
                <div style="background-color:${barColor}; width:${hpPct}%; height:100%; transition: width 0.1s;"></div>
                <div style="background-color:${HP_COLORS.TEMP}; width:${tempPct}%; height:100%; transition: width 0.1s;"></div>
            </div>`;

        const textColorStyle = isMonster ? '' : 'color: var(--mantine-color-green-text);';

        // У монстров справа — поле быстрой математики HP.
        const mathInput = isMonster
            ? `<div style="display:flex; gap:3px; flex-shrink:0;">
                   <input type="text" placeholder="±" onblur="window.applyHpMathLocal(${idx}, this.value)" onkeydown="if(event.key==='Enter') { this.blur(); }" style="width:54px; background-color: var(--mantine-color-dark-light); border:1px solid var(--mantine-color-default-border); border-radius:3px; text-align:center; color:var(--mantine-color-text); font-size:11px; height:24px; padding:0; outline:none; font-weight:700;">
               </div>`
            : '';

        return `
            <div class="dm-hp-widget" style="display:flex; align-items:center; gap:8px; width:175px; box-sizing:border-box; justify-content:space-between;">
                <div class="dm-hp-progress-box" style="display:flex; flex-direction:column; gap:3px; width:105px; flex-shrink:0;">
                    <div style="display:flex; justify-content:flex-start; font-family:monospace; font-size:12px; font-weight:700; line-height:1.1; gap:4px; ${textColorStyle}">
                        ${hpTextHtml}${tempHpHtml}
                    </div>
                    ${barHtml}
                </div>
                ${mathInput}
            </div>`;
    }

    function buildCardAcWidget(p, idx) {
        const disabled = p.is_monster ? '' : 'disabled';
        return `
            <div style="display:flex; align-items:center; justify-content:center; position:relative; width:26px; height:26px;">
                <svg class="lucide lucide-shield" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--mantine-color-dark-4)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="position:absolute; width:100%; height:100%;"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67 0C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/></svg>
                <input type="number" min="0" max="99" value="${p.ac}" onblur="window.updateFieldLocal(${idx}, 'ac', this.value);" style="width:20px; background:transparent; border:none; color: var(--mantine-color-text); font-weight:700; text-align:center; font-size:11px; font-family:monospace; outline:none; z-index:2; padding:0; margin-top:-1px;" ${disabled}>
            </div>`;
    }

    function buildCardDeleteButton(idx) {
        return `
            <button class="dm-btn-delete-participant dm-interactive-btn" onclick="window.removeParticipant(${idx})" title="Удалить из боя" style="width:16px; height:16px; border-radius:4px; display:flex; align-items:center; justify-content:center; cursor:pointer; padding:0; background:transparent; border:none; color:var(--mantine-color-dimmed); transition: opacity 0.15s, color 0.15s;" onmouseover="this.style.color='var(--mantine-color-red-text)';" onmouseout="this.style.color='var(--mantine-color-dimmed)';">
                <svg class="lucide lucide-trash-2" xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>
            </button>`;
    }

    function buildCardStatuses(p, idx) {
        let html = '';

        if (p.statuses?.length) {
            p.statuses.forEach((st, sIdx) => {
                const isSystem = !p.is_monster && p.system_statuses && p.system_statuses.includes(st);
                const canDelete = p.is_monster || !isSystem;

                let bg, border;
                if (!p.is_monster && !isSystem) {
                    bg = 'rgba(92,124,250,0.08)';
                    border = 'var(--mantine-color-indigo-outline)';
                } else {
                    bg = 'rgba(34,139,230,0.06)';
                    border = 'var(--mantine-color-blue-outline)';
                }

                const click = canDelete ? `onclick="window.removeMonsterStatus(${idx}, ${sIdx})"` : '';
                const title = canDelete ? 'Нажмите для удаления' : 'Системный статус';

                html += `
                    <span ${click} style="font-size:11px; background:${bg}; color:${border}; border:1px solid ${border}; padding:2px 6px; border-radius:4px; font-weight:600; cursor:${canDelete ? 'pointer' : 'default'}; white-space:nowrap; margin:2px 0;" title="${title}">
                        ${st}
                    </span>`;
            });
        }

        if (activeStatusInputs[idx]) {
            html += `
                <input type="text" id="dm-input-st-${idx}" placeholder="Яд(3).." onblur="window.addMonsterStatus(${idx});" onkeydown="if(event.key==='Enter') { this.blur(); }" style="background-color: var(--mantine-color-dark-light); border:1px solid var(--mantine-color-blue-outline); border-radius:3px; color:var(--mantine-color-text); font-size:11px; padding:0 6px; width:65px; outline:none; height:20px; margin:2px 0;">`;
        } else {
            html += `
                <button onclick="window.toggleStatusInput(${idx})" style="width:20px; height:20px; border-radius:3px; background:transparent; border:1px dashed var(--mantine-color-blue-outline); color:var(--mantine-color-blue-outline); display:inline-flex; align-items:center; justify-content:center; font-size:11px; font-weight:bold; cursor:pointer; padding:0; margin:2px 0;">
                    <svg class="lucide lucide-plus" style="width:14px; height:14px;" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--mantine-color-blue-outline)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
                </button>`;
        }

        return html;
    }

    function updateStatisticsPanel() {
        const totalEl = document.getElementById('stat-total-combat');
        const avgEl = document.getElementById('stat-avg-round');
        const tbody = document.getElementById('stat-players-tbody');
        if (!totalEl || !tbody) return;

        const totalSecs = state.total_combat_time || 0;
        totalEl.innerText = formatSeconds(totalSecs);
        avgEl.innerText = formatSeconds(Math.floor(totalSecs / (state.round_counter || 1)));

        const pcs = state.participants.filter(p => !p.is_monster);
        if (pcs.length === 0) {
            tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; color:var(--mantine-color-dimmed); padding:4px 0;">Нет данных PC</td></tr>`;
            return;
        }

        tbody.innerHTML = pcs.map(p => {
            const total = p.total_time_spent || 0;
            const turns = p.turns_count || 1;
            const avg = Math.floor(total / turns);
            return `
                <tr style="border-bottom: 1px solid var(--mantine-color-dark-light);">
                    <td style="padding:4px 0; max-width:90px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; font-weight:600;" title="${p.name}">${p.name}</td>
                    <td style="padding:4px 0; text-align:right; font-family:monospace;">${formatSeconds(total)}</td>
                    <td style="padding:4px 0; text-align:right; font-family:monospace; color:var(--mantine-color-blue-text);">${formatSeconds(avg)}</td>
                </tr>`;
        }).join('');
    }

    /* ==========================================================================
     * SECTION 12 — EXPORT / IMPORT
     * ========================================================================== */

    function exportBattle() {
        if (state.participants.length === 0) {
            showTemporaryMessage('Бой пуст');
            return;
        }
        const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(state, null, 2));
        const a = document.createElement('a');
        a.setAttribute('href', dataStr);
        a.setAttribute('download', `vortex_battle_${new Date().toISOString().slice(0, 10)}.json`);
        document.body.appendChild(a);
        a.click();
        a.remove();
        addLogEntry('info', 'Бой экспортирован в файл');
    }

    function importBattle(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = evt => {
            try {
                const parsed = JSON.parse(evt.target.result);
                if (parsed && Array.isArray(parsed.participants)) {
                    state = parsed;
                    activeStatusInputs = {};
                    addLogEntry('info', 'Бой импортирован из файла');
                    saveState();
                    window.renderTracker();
                    startTimerLogic();
                    showTemporaryMessage('Бой импортирован');
                }
            } catch (err) {
                console.error('[IIT] Ошибка импорта:', err);
            }
            e.target.value = '';
        };
        reader.readAsText(file);
    }

    /* ==========================================================================
     * SECTION 13 — TOAST
     * ========================================================================== */

    function showTemporaryMessage(text) {
        document.getElementById(TOAST_ID)?.remove();

        const toast = document.createElement('div');
        toast.id = TOAST_ID;
        toast.style = `
            position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
            background: var(--mantine-color-dark-filled); border: 1px solid var(--mantine-color-default-border);
            border-radius: var(--mantine-radius-sm); padding: 6px 12px; font-size: 12px; color: #fff;
            box-shadow: var(--mantine-shadow-md); z-index: 99999;
        `;
        toast.innerText = text;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 1500);
    }

    /* ==========================================================================
     * SECTION 14 — SYNC (DOM → state)
     * ========================================================================== */

    /**
     * Подтягивает AC/HP/статусы PC из нативного DOM Vortex.
     * Кастомные статусы сохраняются (не затираются статусами листа).
     * @param {boolean} isSilent — не показывать тост и не перерисовывать.
     */
    window.syncPlayers = function (isSilent = false) {
        const playersFromTable = parsePlayersFromDOM();
        let updated = false;

        state.participants.forEach(p => {
            if (p.is_monster) return;
            if (!p.id) p.id = generateId();

            const match = playersFromTable.find(tp => tp.name === p.name);
            if (!match) return;

            p.ac = Math.min(LIMITS.AC_MAX, match.ac);
            p.hp_text = match.hp_text;
            p.avatar = match.avatar;
            p.temp_hp = match.temp_hp;

            // Сохраняем кастомные статусы, которых нет в листе.
            const custom = (p.statuses || []).filter(
                st => !match.statuses.includes(st) && (!p.system_statuses || !p.system_statuses.includes(st))
            );
            p.system_statuses = match.statuses.slice();
            p.statuses = [...match.statuses, ...custom];

            updated = true;
        });

        if (!updated) return;

        persistAllPCCustomStatuses();
        saveState();

        if (!isSilent) {
            window.renderTracker();
            showTemporaryMessage('Данные синхронизированы');
        }
    };

    /* ==========================================================================
     * SECTION 15 — NEW ENCOUNTER MODAL
     * ========================================================================== */

    function openClearAndSyncModal() {
        const standardPlayers = parsePlayersFromDOM();

        const overlay = document.createElement('div');
        overlay.style = 'position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.6); z-index:99999; display:flex; align-items:center; justify-content:center; font-family:sans-serif; color:var(--mantine-color-text); padding:10px; box-sizing:border-box;';

        const modal = document.createElement('div');
        modal.style = 'background:var(--mantine-color-body); border:1px solid var(--mantine-color-default-border); border-radius:var(--mantine-radius-sm); padding:16px; width:100%; max-width:340px; box-shadow:var(--mantine-shadow-xl); display:flex; flex-direction:column; gap:12px;';

        modal.innerHTML = buildEncounterModalHtml(standardPlayers);
        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        modal.querySelector('#modal-cancel').onclick = () => overlay.remove();
        modal.querySelector('#modal-confirm').onclick = () => {
            const selected = collectSelectedPlayers(modal, standardPlayers);
            resetStateForNewEncounter(selected);
            overlay.remove();
        };
    }

    function buildEncounterModalHtml(players) {
        const listHtml = players.length === 0
            ? '<div style="font-size:11px; color:var(--mantine-color-dimmed); text-align:center; padding:8px;">Игроки не найдены</div>'
            : players.map((p, i) => {
                const imgHtml = p.avatar
                    ? `<img src="${p.avatar}" style="width:20px; height:20px; border-radius:3px; object-fit:cover;">`
                    : `<div style="width:20px; height:20px; background:var(--mantine-color-blue-light); border-radius:3px;"></div>`;
                return `
                    <label style="display:flex; align-items:center; gap:8px; font-size:12px; cursor:pointer; padding:4px; border-radius:3px;">
                        <input type="checkbox" checked data-index="${i}" style="width:14px; height:14px; cursor:pointer;">
                        <span style="display:inline-flex; align-items:center; gap:6px; font-weight:600;">${imgHtml} ${p.name}</span>
                    </label>`;
            }).join('');

        return `
            <h3 style="margin:0; font-size:15px; font-weight:700; color:var(--mantine-color-blue-text);">Новое столкновение</h3>
            <div id="modal-players-list" style="max-height:160px; overflow-y:auto; display:flex; flex-direction:column; gap:4px; border:1px solid var(--mantine-color-default-border); padding:6px; border-radius:var(--mantine-radius-sm); background:var(--mantine-color-dark-light);">
                ${listHtml}
            </div>
            <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:4px;">
                <button id="modal-cancel" class="dm-interactive-btn" style="background:transparent; border:1px solid var(--mantine-color-default-border); color:var(--mantine-color-text); padding:6px 12px; border-radius:var(--mantine-radius-sm); cursor:pointer; font-size:12px;">Отмена</button>
                <button id="modal-confirm" class="dm-interactive-btn-blue" style="color:#fff; padding:6px 12px; border-radius:var(--mantine-radius-sm); cursor:pointer; font-size:12px; font-weight:600;">Начать</button>
            </div>`;
    }

    function collectSelectedPlayers(modal, standardPlayers) {
        const logEntries = Array.from(document.querySelectorAll('.LogEntry_entry__jVA8H'));
        const selected = [];

        modal.querySelectorAll('input[type="checkbox"]').forEach(chk => {
            if (!chk.checked) return;
            const p = standardPlayers[parseInt(chk.dataset.index, 10)];
            if (!p) return;

            const initVal = findLatestInitiativeFromLog(logEntries, p.name);
            const pData = getPlayerPersistentData(p.name);
            const sheetStatuses = p.statuses || [];
            const customFromStore = (pData.customStatuses || []).filter(st => !sheetStatuses.includes(st));

            selected.push({
                id: generateId(),
                name: p.name,
                initiative: clamp(initVal, 0, LIMITS.INITIATIVE_MAX),
                ac: clamp(p.ac, 0, LIMITS.AC_MAX),
                description: pData.description || '',
                is_monster: false,
                avatar: p.avatar,
                hp_text: p.hp_text,
                statuses: [...sheetStatuses, ...customFromStore],
                system_statuses: sheetStatuses.slice(),
                temp_hp: p.temp_hp,
                total_time_spent: 0,
                turns_count: 0,
            });
        });

        return selected;
    }

    function restoreActiveTab() {
        let saved;
        try { saved = localStorage.getItem(STORAGE_KEY_ACTIVE_TAB); } catch (e) { return; }
        if (!saved) return;

        if (saved === 'dm') {
            // Небольшая задержка — даём Mantine завершить первичный рендер,
            // иначе он может перетереть наши data-active / display.
            setTimeout(() => {
                let current;
                try { current = localStorage.getItem(STORAGE_KEY_ACTIVE_TAB); } catch (e) { return; }
                // Если пользователь успел кликнуть вкладку в эти 100 мс — уважаем его выбор.
                if (current === 'dm') switchToDmTab();
            }, 100);
            return;
        }

        // Сохранена нативная вкладка — кликаем по ней.
        const nativeTab = document.getElementById(saved);
        if (!nativeTab) return;
        setTimeout(() => {
            let current;
            try { current = localStorage.getItem(STORAGE_KEY_ACTIVE_TAB); } catch (e) { return; }
            if (current === saved) nativeTab.click();
        }, 100);
    }

    function resetStateForNewEncounter(selectedParticipants) {
        state.participants = selectedParticipants.sort((a, b) => b.initiative - a.initiative);
        state.current_index = 0;
        state.round_counter = 1;
        state.total_combat_time = 0;
        state.turn_start_timestamp = null;
        state.is_combat_active = false;
        state.combat_log = [];
        activeStatusInputs = {};

        persistAllPCCustomStatuses();
        addLogEntry('system', `**Новое столкновение создано.** Загружено игроков: ${selectedParticipants.length}`);

        stopTimerLogic();
        saveState();
        window.renderTracker();
    }

    /* ==========================================================================
     * SECTION 16 — GLOBAL HANDLERS (called from inline onclick)
     * ========================================================================== */

    /**
     * Быстрая математика HP для монстров.
     * Поддерживает: "-5", "+3", "5" (урон), "t10" (temp HP), "m20" (max HP).
     */
    window.applyHpMathLocal = function (idx, expr) {
        expr = expr.trim().toLowerCase();
        if (!expr) return;

        const p = state.participants[idx];
        if (!p || !p.is_monster) return;

        try {
            if (expr.startsWith('t')) {
                const tVal = parseInt(expr.substring(1), 10);
                if (!Number.isNaN(tVal)) {
                    p.temp_hp = clamp(tVal, 0, LIMITS.TEMP_HP_MAX);
                    addLogEntry('heal', `**${p.name}** получил ${p.temp_hp} врем. HP`);
                }
            } else if (expr.startsWith('m')) {
                const mVal = parseInt(expr.substring(1), 10);
                if (!Number.isNaN(mVal) && mVal > 0) {
                    p.max_hp = clamp(mVal, 1, LIMITS.HP_MAX);
                    if (p.hp > p.max_hp) p.hp = p.max_hp;
                    addLogEntry('info', `У **${p.name}** изм. макс. HP: ${p.max_hp}`);
                }
            } else {
                const val = parseInt(expr.replace('+', '').replace('-', ''), 10);
                if (Number.isNaN(val)) return;

                // Явный плюс = лечение, иначе урон (в т.ч. если ввели просто число).
                if (expr.startsWith('+')) {
                    p.hp = Math.min(p.max_hp, p.hp + val);
                    addLogEntry('heal', `**${p.name}** восстановил ${val} хитов (${p.hp}/${p.max_hp})`);
                } else {
                    let damage = val;
                    if (p.temp_hp > 0) {
                        if (p.temp_hp >= damage) {
                            p.temp_hp -= damage;
                            damage = 0;
                        } else {
                            damage -= p.temp_hp;
                            p.temp_hp = 0;
                        }
                    }
                    p.hp = Math.max(0, p.hp - damage);
                    if (p.hp <= 0) {
                        addLogEntry('damage', `**${p.name}** получил ${val} урона и пал!`);
                    } else {
                        addLogEntry('damage', `**${p.name}** получил ${val} урона (${p.hp}/${p.max_hp})`);
                    }
                }
            }

            saveState();
            window.renderTracker();
        } catch (err) {
            console.error('[IIT] applyHpMathLocal:', err);
        }
    };

    window.toggleStatusInput = function (idx) {
        activeStatusInputs[idx] = !activeStatusInputs[idx];
        window.renderTracker();
        if (activeStatusInputs[idx]) {
            setTimeout(() => document.getElementById(`dm-input-st-${idx}`)?.focus(), 50);
        }
    };

    window.addMonsterStatus = function (idx) {
        const input = document.getElementById(`dm-input-st-${idx}`);
        if (!input) return;

        const newStatus = input.value.trim();
        const p = state.participants[idx];
        if (newStatus && p) {
            if (!p.statuses) p.statuses = [];
            if (!p.statuses.includes(newStatus)) {
                p.statuses.push(newStatus);
                addLogEntry('status', `К **${p.name}** добавлен статус "${newStatus}"`);
            }
        }
        activeStatusInputs[idx] = false;
        persistPCCustomStatuses(p);
        saveState();
        window.renderTracker();
    };

    window.removeParticipant = function (idx) {
        const p = state.participants[idx];
        if (!p) return;
        if (!confirm(`Удалить "${p.name}" из боя?`)) return;

        state.participants.splice(idx, 1);

        // Пересчитываем текущий индекс.
        if (state.current_index >= state.participants.length) {
            state.current_index = Math.max(0, state.participants.length - 1);
        } else if (idx < state.current_index) {
            state.current_index = Math.max(0, state.current_index - 1);
        }

        addLogEntry('info', `**${p.name}** был удален из боя`);
        saveState();
        window.renderTracker();
    };

    window.removeMonsterStatus = function (idx, statusIdx) {
        const p = state.participants[idx];
        if (!p?.statuses) return;

        const removed = p.statuses.splice(statusIdx, 1);
        if (removed[0]) {
            addLogEntry('status', `У **${p.name}** удален статус "${removed[0]}"`);
        }
        persistPCCustomStatuses(p);
        saveState();
        window.renderTracker();
    };

    window.updateFieldLocal = function (idx, field, value) {
        const p = state.participants[idx];
        if (!p) return;

        const numericFields = ['initiative', 'ac', 'temp_hp', 'hp', 'max_hp'];
        if (numericFields.includes(field)) {
            let num = parseInt(value, 10) || 0;

            if (field === 'initiative' || field === 'ac') {
                num = clamp(num, 0, LIMITS.INITIATIVE_MAX);
            }
            if (field === 'hp' || field === 'max_hp' || field === 'temp_hp') {
                num = clamp(num, 0, LIMITS.HP_MAX);
            }
            p[field] = num;
        } else {
            p[field] = value;
        }

        if (field === 'initiative') {
            state.participants.sort((a, b) => b.initiative - a.initiative);
        }

        // Заметка PC сохраняется в персистентное хранилище.
        if (field === 'description' && !p.is_monster) {
            updatePlayerPersistentData(p.name, { description: value });
        }

        saveState();
    };

    /* ==========================================================================
     * SECTION 17 — BOOTSTRAP
     * ========================================================================== */

    const observer = new MutationObserver(checkAndInject);
    observer.observe(document.body, { childList: true, subtree: true });

    window.addEventListener('beforeunload', () => {
        stopTimerLogic();
        observer.disconnect();
    });

    setTimeout(checkAndInject, 1000);
})();
