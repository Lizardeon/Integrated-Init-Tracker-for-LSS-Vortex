// ==UserScript==
// @name         Integrated Init Tracker for LSS Vortex
// @namespace    http://tampermonkey.net/
// @version      2.18
// @description  Крупный карточный трекер инициативы для LSS Vortex с таймером ходов, аналитикой времени и чтением временных хитов ПИ
// @author       Lizardeon & Gemini
// @match        https://vortex.longstoryshort.app/room/*
// @downloadURL  https://github.com/Lizardeon/Integrated-Init-Tracker-for-LSS-Vortex/raw/refs/heads/main/Integrated%20Init%20Tracker.user.js
// @updateURL    https://github.com/Lizardeon/Integrated-Init-Tracker-for-LSS-Vortex/raw/refs/heads/main/Integrated%20Init%20Tracker.user.js
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    let state = JSON.parse(localStorage.getItem('vortex_IITStorage_v2')) || {
        participants: [],
        current_index: 0,
        round_counter: 1,
        total_combat_time: 0,
        turn_start_timestamp: null,
        is_combat_active: false
    };

    let activeStatusInputs = {};
    let timerInterval = null;

    function saveState() {
        localStorage.setItem('vortex_IITStorage_v2', JSON.stringify(state));
    }

    const CUSTOM_TAB_ID = 'mantine-custom-tab-dmtracker';
    const CUSTOM_PANEL_ID = 'dm-tracker-integrated-panel';

    function injectGlobalStyles() {
        if (document.getElementById('dm-tracker-styles')) return;
        const styleSheet = document.createElement("style");
        styleSheet.id = 'dm-tracker-styles';
        styleSheet.innerText = `
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

            .dm-interactive-btn-blue {
                background: var(--mantine-color-blue-filled) !important;
            }
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
        `;
        document.head.appendChild(styleSheet);
    }

    function startTimerLogic() {
        if (timerInterval) clearInterval(timerInterval);
        if (!state.is_combat_active) return;

        if (!state.turn_start_timestamp && state.participants.length > 0) {
            state.turn_start_timestamp = Date.now();
            saveState();
        }

        timerInterval = setInterval(() => {
            if (state.participants.length === 0 || !state.is_combat_active) return;

            state.total_combat_time = (state.total_combat_time || 0) + 1;

            const currentActive = state.participants[state.current_index];
            if (currentActive && !currentActive.is_monster) {
                currentActive.total_time_spent = (currentActive.total_time_spent || 0) + 1;
            }

            saveState();

            const timeEl = document.getElementById('dm-turn-timer-display');
            if (timeEl && state.turn_start_timestamp) {
                const secondsPassed = Math.floor((Date.now() - state.turn_start_timestamp) / 1000);
                timeEl.innerText = formatSeconds(secondsPassed);
            }

            updateStatisticsPanel();
        }, 1000);
    }

    function formatSeconds(totalSeconds) {
        const mins = Math.floor(totalSeconds / 60);
        const secs = totalSeconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    function checkAndInject() {
        const tabList = document.querySelector('.mantine-Tabs-list');
        if (!tabList) return;

        injectGlobalStyles();

        let dmTab = document.getElementById(CUSTOM_TAB_ID);
        if (!dmTab) {
            dmTab = document.createElement('button');
            dmTab.id = CUSTOM_TAB_ID;
            dmTab.className = 'mantine-focus-auto m_539e827b m_4ec4dce6 mantine-Tabs-tab m_87cf2631 mantine-UnstyledButton-root';
            dmTab.setAttribute('data-variant', 'default');
            dmTab.setAttribute('data-orientation', 'horizontal');
            dmTab.setAttribute('type', 'button');
            dmTab.setAttribute('role', 'tab');
            dmTab.setAttribute('aria-selected', 'false');
            dmTab.setAttribute('tabindex', '-1');
            dmTab.style.display = 'inline-flex';
            dmTab.style.alignItems = 'center';
            dmTab.style.gap = '6px';

            dmTab.innerHTML = `
                <span style="display: flex; align-items: center; justify-content: center; width:14px; height:14px;">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5"/><line x1="13" x2="19" y1="19" y2="13"/><line x1="16" x2="20" y1="16" y2="20"/><line x1="19" x2="21" y1="21" y2="19"/><polyline points="14.5 6.5 18 3 21 3 21 6 17.5 9.5"/><line x1="5" x2="9" y1="14" y2="18"/><line x1="7" x2="4" y1="17" y2="20"/><line x1="3" x2="5" y1="19" y2="21"/></svg>
                </span>
                <span class="mantine-Tabs-tabLabel" style="font-size:13px;">Бой</span>
            `;

            dmTab.addEventListener('click', switchToDmTab);
            tabList.appendChild(dmTab);
        }

        const nativeTabs = tabList.querySelectorAll('.mantine-Tabs-tab:not(#' + CUSTOM_TAB_ID + ')');
        nativeTabs.forEach(tab => {
            if (!tab.dataset.dmListenerAttached) {
                tab.dataset.dmListenerAttached = 'true';
                tab.addEventListener('click', () => handleNativeTabClick(tab));
            }
        });

        let dmPanel = document.getElementById(CUSTOM_PANEL_ID);
        if (!dmPanel) {
            const originalPanel = document.querySelector('[id*="-panel-"]');
            if (originalPanel && originalPanel.parentNode) {
                dmPanel = document.createElement('div');
                dmPanel.id = CUSTOM_PANEL_ID;
                dmPanel.style.display = 'none';
                dmPanel.style.width = '100%';
                dmPanel.style.marginTop = '12px';
                dmPanel.style.boxSizing = 'border-box';

                buildTrackerLayout(dmPanel);
                originalPanel.parentNode.appendChild(dmPanel);
            }
        }
    }

    function switchToDmTab() {
        const tabList = document.querySelector('.mantine-Tabs-list');
        if (!tabList) return;

        tabList.querySelectorAll('.mantine-Tabs-tab').forEach(t => {
            t.setAttribute('aria-selected', 'false');
            t.removeAttribute('data-active');
            t.setAttribute('tabindex', '-1');
        });

        const dmTab = document.getElementById(CUSTOM_TAB_ID);
        if (dmTab) {
            dmTab.setAttribute('aria-selected', 'true');
            dmTab.setAttribute('data-active', 'true');
            dmTab.setAttribute('tabindex', '0');
        }

        document.querySelectorAll('[id*="-panel-"]:not(#' + CUSTOM_PANEL_ID + ')').forEach(p => p.style.display = 'none');

        const dmPanel = document.getElementById(CUSTOM_PANEL_ID);
        if (dmPanel) {
            dmPanel.style.display = 'block';
            window.renderTracker();
            startTimerLogic();
        }
    }

    function handleNativeTabClick(clickedTab) {
        const dmTab = document.getElementById(CUSTOM_TAB_ID);
        if (dmTab) {
            dmTab.setAttribute('aria-selected', 'false');
            dmTab.removeAttribute('data-active');
            dmTab.setAttribute('tabindex', '-1');
        }

        const dmPanel = document.getElementById(CUSTOM_PANEL_ID);
        if (dmPanel) dmPanel.style.display = 'none';
        if (timerInterval) clearInterval(timerInterval);

        setTimeout(() => {
            const targetPanelId = clickedTab.getAttribute('aria-controls');
            if (targetPanelId) {
                const targetPanel = document.getElementById(targetPanelId);
                if (targetPanel) targetPanel.style.display = 'block';
            }
        }, 10);
    }

    function parsePlayersFromDOM() {
        const cards = document.querySelectorAll('.PartyCardStoryview_card__u4b6T');
        const players = [];

        cards.forEach(card => {
            const nameEl = card.querySelector('p[style*="font-weight: 700"]');
            if (!nameEl) return;
            const name = nameEl.innerText.replace(/[\u00a0\s]+/g, ' ').trim();

            let avatarUrl = '';
            const imgEl = card.querySelector('.PartyCardStoryview_avatar__Ohnpi img');
            if (imgEl) avatarUrl = imgEl.getAttribute('src') || '';

            let playerAc = 10;
            const svgShield = card.querySelector('svg.lucide-shield');
            if (svgShield) {
                const acContainer = svgShield.closest('.m_4081bf90');
                if (acContainer) {
                    const acValEl = acContainer.querySelector('p[data-size="sm"]');
                    if (acValEl) playerAc = parseInt(acValEl.innerText) || 10;
                }
            }

            let playerHpText = '0 / 0';
            const svgHeart = card.querySelector('svg.lucide-heart');
            if (svgHeart) {
                const hpContainer = svgHeart.closest('.CardOverlay_trigger__otFTj');
                if (hpContainer) {
                    const hpValEl = hpContainer.querySelector('p[data-size="sm"]');
                    if (hpValEl) playerHpText = hpValEl.innerText.trim();
                }
            }

            // ЧТЕНИЕ ВРЕМЕННЫХ ХИТОВ ИЗ DOM
            let playerTempHp = 0;
            const svgHeartPlus = card.querySelector('svg.lucide-heart-plus');
            if (svgHeartPlus) {
                const tempHpContainer = svgHeartPlus.closest('.m_4081bf90');
                if (tempHpContainer) {
                    const tempHpValEl = tempHpContainer.querySelector('p[data-size="sm"]');
                    if (tempHpValEl) {
                        playerTempHp = parseInt(tempHpValEl.innerText) || 0;
                    }
                }
            }

            let statuses = [];
            const statusBadges = card.querySelectorAll('.PartyCardStoryview_badgeRemovable__83_z7 .mantine-Badge-label');
            statusBadges.forEach(badgeLabel => {
                const textEl = badgeLabel.querySelector('.mantine-Text-root');
                if (textEl && textEl.innerText) {
                    statuses.push(textEl.innerText.trim());
                }
            });

            players.push({ name, avatar: avatarUrl, ac: playerAc, hp_text: playerHpText, temp_hp: playerTempHp, statuses });
        });

        return players;
    }

    function buildTrackerLayout(container) {
        container.innerHTML = `
            <div style="display: flex; flex-direction: row; gap: 12px; font-family: ui-sans-serif, system-ui, sans-serif; color: var(--mantine-color-text); box-sizing: border-box; width:100%; align-items: start; flex-wrap: wrap;">
                <div style="flex: 1; min-width: 320px; display: flex; flex-direction: column; gap: 8px;">
                    <div style="background-color: var(--mantine-color-body); border: 1px solid var(--mantine-color-default-border); border-radius: var(--mantine-radius-sm); padding: 10px 14px; display: flex; justify-content: space-between; align-items: center; gap: 8px; box-shadow: var(--mantine-shadow-xs);">
                        <div style="display: flex; align-items: center; gap: 20px;">
                            <div style="display: flex; flex-direction: column;">
                                <span style="color: var(--mantine-color-dimmed); text-transform: uppercase; font-size: 9px; letter-spacing: 0.5px; font-weight: 700;">Раунд</span>
                                <span id="dm-round-display" style="color: var(--mantine-color-blue-text); font-family: monospace; font-size: 22px; font-weight: 800; line-height: 1;">1</span>
                            </div>
                            <div style="display: flex; flex-direction: column; border-left: 1px solid var(--mantine-color-default-border); padding-left: 16px;">
                                <span style="color: var(--mantine-color-dimmed); text-transform: uppercase; font-size: 9px; letter-spacing: 0.5px; font-weight: 700;">Время хода</span>
                                <span id="dm-turn-timer-display" style="color: var(--mantine-color-orange-text, #f59e0b); font-family: monospace; font-size: 22px; font-weight: 800; line-height: 1;">00:00</span>
                            </div>
                        </div>
                        <div id="dm-controls-wrapper" style="display: flex; align-items: center; gap: 6px;"></div>
                    </div>
                    <div id="dm-cards-grid" style="display: flex; flex-direction: column; gap: 6px; width: 100%; box-sizing: border-box;"></div>
                </div>

                <div style="width: 240px; display: flex; flex-direction: column; gap: 8px; box-sizing: border-box;">
                    <div style="background-color: var(--mantine-color-body); border: 1px solid var(--mantine-color-default-border); border-radius: var(--mantine-radius-sm); padding: 10px; display: flex; flex-direction: column; gap: 6px; box-shadow: var(--mantine-shadow-xs);">
                        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 4px;">
                            <button id="dm-btn-export" class="dm-interactive-btn" title="Экспорт боя (.json)" style="height: 28px; cursor: pointer; display: flex; align-items: center; justify-content: center;">
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
                            </button>
                            <button id="dm-btn-import" class="dm-interactive-btn" title="Импорт боя (.json)" style="height: 28px; cursor: pointer; display: flex; align-items: center; justify-content: center;">
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>
                            </button>
                            <input type="file" id="dm-import-file-input" accept=".json" style="display: none;">
                        </div>
                        <button id="dm-btn-clear" class="dm-interactive-btn-red" style="border-radius: var(--mantine-radius-sm); height: 28px; cursor: pointer; font-weight: 600; font-size: 11px; display: flex; align-items: center; justify-content: center; gap: 4px;">
                            Новое столкновение
                        </button>
                    </div>

                    <div style="background-color: var(--mantine-color-body); border: 1px solid var(--mantine-color-default-border); border-radius: var(--mantine-radius-sm); padding: 10px; box-shadow: var(--mantine-shadow-xs);">
                        <form id="dm-monster-form" style="display: flex; flex-direction: column; gap: 6px;">
                            <input type="text" id="dm-m-name" placeholder="Имя NPC / Монстра" required style="background-color: var(--mantine-color-dark-light); border: 1px solid var(--mantine-color-default-border); border-radius: var(--mantine-radius-sm); padding: 4px 8px; color: var(--mantine-color-text); font-size: 12px; outline: none; width: 100%; box-sizing: border-box;">
                            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; max-width: 180px; margin: 0 auto; width: 100%;">
                                <div style="display:flex; flex-direction:column; gap:2px;">
                                    <label style="font-size:8px; color:var(--mantine-color-dimmed); font-weight:600; text-align:center;">Инит</label>
                                    <input type="number" id="dm-m-init" min="0" max="99" required style="background-color: var(--mantine-color-dark-light); border: 1px solid var(--mantine-color-default-border); border-radius: var(--mantine-radius-sm); padding: 4px 2px; color: var(--mantine-color-text); font-size: 12px; text-align: center; outline: none; width: 100%; box-sizing: border-box;">
                                </div>
                                <div style="display:flex; flex-direction:column; gap:2px;">
                                    <label style="font-size:8px; color:var(--mantine-color-dimmed); font-weight:600; text-align:center;">HP</label>
                                    <input type="number" id="dm-m-hp" min="1" max="999" required style="background-color: var(--mantine-color-dark-light); border: 1px solid var(--mantine-color-default-border); border-radius: var(--mantine-radius-sm); padding: 4px 2px; color: var(--mantine-color-text); font-size: 12px; text-align: center; outline: none; width: 100%; box-sizing: border-box;">
                                </div>
                                <div style="display:flex; flex-direction:column; gap:2px;">
                                    <label style="font-size:8px; color:var(--mantine-color-dimmed); font-weight:600; text-align:center;">КД</label>
                                    <input type="number" id="dm-m-ac" min="0" max="99" required style="background-color: var(--mantine-color-dark-light); border: 1px solid var(--mantine-color-default-border); border-radius: var(--mantine-radius-sm); padding: 4px 2px; color: var(--mantine-color-text); font-size: 12px; text-align: center; outline: none; width: 100%; box-sizing: border-box;">
                                </div>
                            </div>
                            <button type="submit" class="dm-interactive-btn-blue" style="border-radius: var(--mantine-radius-sm); height: 28px; font-size: 12px; font-weight: 600; cursor: pointer; display:flex; align-items:center; justify-content:center; margin-top: 2px; color:#fff;">
                                Добавить в бой
                            </button>
                        </form>
                    </div>

                    <div id="dm-stats-panel" style="background-color: var(--mantine-color-body); border: 1px solid var(--mantine-color-default-border); border-radius: var(--mantine-radius-sm); padding: 10px; box-shadow: var(--mantine-shadow-xs); display: flex; flex-direction: column; gap: 6px;">
                        <span style="color: var(--mantine-color-blue-text); font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.3px;">Аналитика боя</span>
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
                                    <tr><td colspan="3" style="text-align:center; color:var(--mantine-color-dimmed); padding:4px 0;">Нет данных PC</td></tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        `;

        container.querySelector('#dm-btn-export').addEventListener('click', exportBattle);

        const fileInput = container.querySelector('#dm-import-file-input');
        container.querySelector('#dm-btn-import').addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', importBattle);

        container.querySelector('#dm-btn-clear').addEventListener('click', openClearAndSyncModal);

        container.querySelector('#dm-monster-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const name = container.querySelector('#dm-m-name').value;
            let initiative = parseInt(container.querySelector('#dm-m-init').value, 10) || 0;
            let max_hp = parseInt(container.querySelector('#dm-m-hp').value, 10) || 10;
            let ac = parseInt(container.querySelector('#dm-m-ac').value, 10) || 10;

            if (initiative > 99) initiative = 99;
            if (ac > 99) ac = 99;
            if (max_hp > 999) max_hp = 999;

            state.participants.push({
                name, initiative, ac, description: '',
                hp: max_hp, max_hp, temp_hp: 0,
                is_monster: true, avatar: '', statuses: []
            });

            state.participants.sort((a, b) => b.initiative - a.initiative);
            saveState();

            e.target.reset();
            window.renderTracker();
        });
    }

    function renderControlButtons() {
        const wrapper = document.getElementById('dm-controls-wrapper');
        if (!wrapper) return;

        if (!state.is_combat_active && state.participants.length > 0) {
            wrapper.innerHTML = `
                <button id="dm-btn-start-combat" class="dm-interactive-btn-blue" style="height: 34px; border-radius: var(--mantine-radius-sm); color: #fff; padding: 0 20px; font-size: 13px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;">
                    <svg style="width:14px; height:14px;" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                    Начать бой
                </button>
            `;
            wrapper.querySelector('#dm-btn-start-combat').onclick = () => {
                state.is_combat_active = true;
                state.turn_start_timestamp = Date.now();

                const firstActive = state.participants[state.current_index];
                if (firstActive && !firstActive.is_monster) {
                    firstActive.turns_count = 1;
                }

                saveState();
                window.renderTracker();
                startTimerLogic();
            };
        } else {
            wrapper.innerHTML = `
                <button id="dm-btn-prev" class="dm-interactive-btn" style="height: 34px; border-radius: var(--mantine-radius-sm); padding: 0 12px; font-size: 13px; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;">
                    <svg style="width:14px; height:14px;" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"></path></svg>
                    Пред.
                </button>
                <button id="dm-btn-next" class="dm-interactive-btn-blue" style="height: 34px; border-radius: var(--mantine-radius-sm); color: #fff; padding: 0 14px; font-size: 13px; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;">
                    След.
                    <svg style="width:14px; height:14px;" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"></path></svg>
                </button>
            `;

            wrapper.querySelector('#dm-btn-next').onclick = () => handleTurnChange(1);
            wrapper.querySelector('#dm-btn-prev').onclick = () => handleTurnChange(-1);
        }
    }

    function handleTurnChange(direction) {
        if (state.participants.length === 0) return;

        let attempts = 0;
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

        const activeP = state.participants[state.current_index];
        if (activeP && activeP.statuses) {
            activeP.statuses = activeP.statuses.map(st => {
                const match = st.match(/(.*)\((\d+)\)\s*$/);
                if (match) {
                    const name = match[1].trim();
                    const val = parseInt(match[2], 10) - 1;
                    return val > 0 ? `${name} (${val})` : null;
                }
                return st;
            }).filter(Boolean);
        }

        state.turn_start_timestamp = Date.now();
        const nextActive = state.participants[state.current_index];
        if (nextActive && !nextActive.is_monster) {
            nextActive.turns_count = (nextActive.turns_count || 0) + 1;
        }

        saveState();
        if (typeof window.syncPlayers === 'function') window.syncPlayers(true);
        window.renderTracker();
    }

    function updateStatisticsPanel() {
        const totalCombatEl = document.getElementById('stat-total-combat');
        const avgRoundEl = document.getElementById('stat-avg-round');
        const tbodyEl = document.getElementById('stat-players-tbody');
        if (!totalCombatEl || !tbodyEl) return;

        const totalSecs = state.total_combat_time || 0;
        totalCombatEl.innerText = formatSeconds(totalSecs);

        const rounds = state.round_counter || 1;
        avgRoundEl.innerText = formatSeconds(Math.floor(totalSecs / rounds));

        const pcs = state.participants.filter(p => !p.is_monster);
        if (pcs.length === 0) {
            tbodyEl.innerHTML = `<tr><td colspan="3" style="text-align:center; color:var(--mantine-color-dimmed); padding:4px 0;">Нет данных PC</td></tr>`;
            return;
        }

        let html = '';
        pcs.forEach(p => {
            const pTotal = p.total_time_spent || 0;
            const pTurns = p.turns_count || 1;
            const pAvg = Math.floor(pTotal / pTurns);

            html += `
                <tr style="border-bottom: 1px solid var(--mantine-color-dark-light);">
                    <td style="padding:4px 0; max-width:90px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; font-weight:600;" title="${p.name}">${p.name}</td>
                    <td style="padding:4px 0; text-align:right; font-family:monospace;">${formatSeconds(pTotal)}</td>
                    <td style="padding:4px 0; text-align:right; font-family:monospace; color:var(--mantine-color-blue-text);">${formatSeconds(pAvg)}</td>
                </tr>
            `;
        });
        tbodyEl.innerHTML = html;
    }

    function exportBattle() {
        if (state.participants.length === 0) {
            showTemporaryMessage('Бой пуст');
            return;
        }
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state, null, 2));
        const downloadAnchorHtml = document.createElement('a');
        downloadAnchorHtml.setAttribute("href", dataStr);
        downloadAnchorHtml.setAttribute("download", `vortex_battle_${new Date().toISOString().slice(0,10)}.json`);
        document.body.appendChild(downloadAnchorHtml);
        downloadAnchorHtml.click();
        downloadAnchorHtml.remove();
    }

    function importBattle(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function(event) {
            try {
                const parsedState = JSON.parse(event.target.result);
                if (parsedState && Array.isArray(parsedState.participants)) {
                    state = parsedState;
                    activeStatusInputs = {};
                    saveState();
                    window.renderTracker();
                    startTimerLogic();
                    showTemporaryMessage('Бой импортирован');
                }
            } catch (err) { }
            e.target.value = '';
        };
        reader.readAsText(file);
    }

    window.syncPlayers = function(isSilent = false) {
        const playersFromTable = parsePlayersFromDOM();
        let updated = false;

        state.participants.forEach(p => {
            if (p.is_monster) return;
            const match = playersFromTable.find(tp => tp.name === p.name);
            if (match) {
                p.ac = Math.min(99, match.ac);
                p.hp_text = match.hp_text;
                p.avatar = match.avatar;

                // Синхронизируем считанные временные хиты персонажа
                p.temp_hp = match.temp_hp;

                const currentCustom = (p.statuses || []).filter(st => !match.statuses.includes(st) && (!p.system_statuses || !p.system_statuses.includes(st)));

                p.system_statuses = match.statuses.slice();
                p.statuses = [...match.statuses, ...currentCustom];

                updated = true;
            }
        });

        if (updated) {
            saveState();
            if (!isSilent) {
                window.renderTracker();
                showTemporaryMessage('Данные синхронизированы');
            }
        }
    };

    function showTemporaryMessage(text) {
        const existing = document.getElementById('dm-sync-toast');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.id = 'dm-sync-toast';
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

    function openClearAndSyncModal() {
        const standardPlayers = parsePlayersFromDOM();

        let overlay = document.createElement('div');
        overlay.style = 'position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.6); z-index:99999; display:flex; align-items:center; justify-content:center; font-family:sans-serif; color:var(--mantine-color-text);';

        let modal = document.createElement('div');
        modal.style = 'background:var(--mantine-color-body); border:1px solid var(--mantine-color-default-border); border-radius:var(--mantine-radius-sm); padding:16px; width:340px; box-shadow:var(--mantine-shadow-xl); display:flex; flex-direction:column; gap:12px;';

        modal.innerHTML = `
            <h3 style="margin:0; font-size:15px; font-weight:700; color:var(--mantine-color-blue-text);">Новое столкновение</h3>
            <div id="modal-players-list" style="max-height:160px; overflow-y:auto; display:flex; flex-direction:column; gap:4px; border:1px solid var(--mantine-color-default-border); padding:6px; border-radius:var(--mantine-radius-sm); background:var(--mantine-color-dark-light);"></div>
            <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:4px;">
                <button id="modal-cancel" class="dm-interactive-btn" style="background:transparent; border:1px solid var(--mantine-color-default-border); color:var(--mantine-color-text); padding:6px 12px; border-radius:var(--mantine-radius-sm); cursor:pointer; font-size:12px;">Отмена</button>
                <button id="modal-confirm" class="dm-interactive-btn-blue" style="color:#fff; padding:6px 12px; border-radius:var(--mantine-radius-sm); cursor:pointer; font-size:12px; font-weight:600;">Начать</button>
            </div>
        `;

        let listContainer = modal.querySelector('#modal-players-list');
        if (standardPlayers.length === 0) {
            listContainer.innerHTML = '<div style="font-size:11px; color:var(--mantine-color-dimmed); text-align:center; padding:8px;">Игроки не найдены</div>';
        } else {
            standardPlayers.forEach((p, i) => {
                let row = document.createElement('label');
                row.style = 'display:flex; align-items:center; gap:8px; font-size:12px; cursor:pointer; padding:4px; border-radius:3px;';
                let imgHtml = p.avatar ? `<img src="${p.avatar}" style="width:20px; height:20px; border-radius:3px; object-fit:cover;">` : '<div style="width:20px; height:20px; background:var(--mantine-color-blue-light); border-radius:3px;"></div>';
                row.innerHTML = `
                    <input type="checkbox" checked data-index="${i}" style="width:14px; height:14px; cursor:pointer;">
                    <span style="display:inline-flex; align-items:center; gap:6px; font-weight:600;">${imgHtml} ${p.name}</span>
                `;
                listContainer.appendChild(row);
            });
        }

        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        modal.querySelector('#modal-cancel').onclick = () => overlay.remove();
        modal.querySelector('#modal-confirm').onclick = () => {
            const logEntries = Array.from(document.querySelectorAll('.LogEntry_entry__jVA8H'));
            let selectedParticipants = [];

            let checkboxes = listContainer.querySelectorAll('input[type="checkbox"]');
            checkboxes.forEach(chk => {
                if (chk.checked) {
                    let p = standardPlayers[parseInt(chk.dataset.index, 10)];
                    let initVal = 10;

                    for (let i = logEntries.length - 1; i >= 0; i--) {
                        const entry = logEntries[i];
                        const authorEl = entry.querySelector('.LogEntry_authorName__fTMQR');
                        const titleEl = entry.querySelector('.LogEntry_title__5R6wX');
                        const totalEl = entry.querySelector('.LogEntry_total__7Am39');

                        if (authorEl && titleEl && totalEl) {
                            const logName = authorEl.innerText.replace(/[\u00a0\s]+/g, ' ').trim();
                            if (logName === p.name && titleEl.innerText.toLowerCase().includes('инициатив')) {
                                initVal = parseInt(totalEl.innerText.trim(), 10) || 10;
                                break;
                            }
                        }
                    }

                    selectedParticipants.push({
                        name: p.name, initiative: Math.min(99, initVal), ac: Math.min(99, p.ac), description: '',
                        is_monster: false, avatar: p.avatar, hp_text: p.hp_text, statuses: p.statuses,
                        system_statuses: p.statuses.slice(),
                        temp_hp: p.temp_hp, // Сохраняем временные хиты при инициализации
                        total_time_spent: 0,
                        turns_count: 0
                    });
                }
            });

            state.participants = selectedParticipants;
            state.participants.sort((a, b) => b.initiative - a.initiative);
            state.current_index = 0;
            state.round_counter = 1;
            state.total_combat_time = 0;
            state.turn_start_timestamp = null;
            state.is_combat_active = false;
            activeStatusInputs = {};

            if (timerInterval) clearInterval(timerInterval);

            saveState();
            window.renderTracker();
            overlay.remove();
        };
    }

    window.applyHpMathLocal = function(idx, expr) {
        expr = expr.trim().toLowerCase();
        if (!expr) return;
        const p = state.participants[idx];
        if (!p || !p.is_monster) return;

        try {
            if (expr.startsWith('t')) {
                const tVal = parseInt(expr.substring(1), 10);
                if (!isNaN(tVal)) p.temp_hp = Math.min(999, Math.max(0, tVal));
            }
            else if (expr.startsWith('m')) {
                const mVal = parseInt(expr.substring(1), 10);
                if (!isNaN(mVal) && mVal > 0) {
                    p.max_hp = Math.min(999, mVal);
                    if (p.hp > p.max_hp) p.hp = p.max_hp;
                }
            }
            else {
                const val = parseInt(expr.replace('+', '').replace('-', ''), 10);
                if (isNaN(val)) return;

                if (expr.startsWith('-') || (!expr.startsWith('+') && !expr.startsWith('-'))) {
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
                } else if (expr.startsWith('+')) {
                    p.hp = Math.min(p.max_hp, p.hp + val);
                }
            }

            saveState();
            window.renderTracker();
        } catch (e) { }
    };

    window.toggleStatusInput = function(idx) {
        activeStatusInputs[idx] = !activeStatusInputs[idx];
        window.renderTracker();
        if (activeStatusInputs[idx]) {
            setTimeout(() => {
                const inp = document.getElementById(`dm-input-st-${idx}`);
                if (inp) inp.focus();
            }, 50);
        }
    };

    window.addMonsterStatus = function(idx) {
        const input = document.getElementById(`dm-input-st-${idx}`);
        if (!input) return;

        const newStatus = input.value.trim();
        if (newStatus && state.participants[idx]) {
            if (!state.participants[idx].statuses) state.participants[idx].statuses = [];
            if (!state.participants[idx].statuses.includes(newStatus)) {
                state.participants[idx].statuses.push(newStatus);
            }
        }
        activeStatusInputs[idx] = false;
        saveState();
        window.renderTracker();
    };

    window.removeMonsterStatus = function(idx, statusIdx) {
        if (state.participants[idx] && state.participants[idx].statuses) {
            state.participants[idx].statuses.splice(statusIdx, 1);
            saveState();
            window.renderTracker();
        }
    };

    window.updateFieldLocal = function(idx, field, value) {
        if (state.participants[idx]) {
            if (['initiative', 'ac', 'temp_hp', 'hp', 'max_hp'].includes(field)) {
                let num = parseInt(value, 10) || 0;

                if (field === 'initiative' || field === 'ac') {
                    if (num > 99) num = 99;
                    if (num < 0) num = 0;
                }
                if (field === 'hp' || field === 'max_hp' || field === 'temp_hp') {
                    if (num > 999) num = 999;
                    if (num < 0) num = 0;
                }

                state.participants[idx][field] = num;
            } else {
                state.participants[idx][field] = value;
            }
            if (field === 'initiative') {
                state.participants.sort((a, b) => b.initiative - a.initiative);
            }
            saveState();
        }
    };

    window.renderTracker = function() {
        const roundDisplay = document.getElementById('dm-round-display');
        if (roundDisplay) roundDisplay.innerText = state.round_counter;

        const timeEl = document.getElementById('dm-turn-timer-display');
        if (timeEl) {
            if (state.is_combat_active && state.turn_start_timestamp) {
                const secondsPassed = Math.floor((Date.now() - state.turn_start_timestamp) / 1000);
                timeEl.innerText = formatSeconds(secondsPassed);
            } else {
                timeEl.innerText = '00:00';
            }
        }

        renderControlButtons();

        const gridContainer = document.getElementById('dm-cards-grid');
        if (!gridContainer) return;

        if (state.participants.length === 0) {
            gridContainer.innerHTML = `
                <div style="padding: 24px; text-align: center; color: var(--mantine-color-dimmed); font-size:13px; border: 1px dashed var(--mantine-color-default-border); border-radius: var(--mantine-radius-sm); background: var(--mantine-color-body);">
                    Инициатива пуста. Загрузите бойцов кнопкой справа.
                </div>`;
            return;
        }

        let html = '';

        state.participants.forEach((p, idx) => {
            const isCurrent = (idx === state.current_index && state.is_combat_active);
            const isDeadMonster = p.is_monster && p.hp <= 0;
            let cardOpacity = isDeadMonster ? '0.55' : '1';

            let cardBackground = 'var(--mantine-color-body)';
            let cardBorder = '1px solid var(--mantine-color-default-border)';
            if (isCurrent) {
                cardBackground = 'rgba(34, 139, 230, 0.06)';
                cardBorder = '2px solid var(--mantine-color-blue-filled)';
            }

            let identityHtml = '';
            let noteText = p.description || '';

            if (p.is_monster) {
                identityHtml = `
                    <div style="display:flex; flex-direction:column; width:100%; overflow:hidden;">
                        <input type="text" value="${p.name}" onblur="window.updateFieldLocal(${idx}, 'name', this.value);" style="background:transparent; border:none; color:var(--mantine-color-text); font-weight:700; font-size:15px; outline:none; padding:0; width:100%; text-overflow:ellipsis; ${isDeadMonster ? 'text-decoration: line-through;' : ''}" />
                        <input type="text" value="${noteText}" placeholder="Заметка..." onblur="window.updateFieldLocal(${idx}, 'description', this.value); window.renderTracker();" style="background:transparent; border:none; color:var(--mantine-color-dimmed); font-size:11px; outline:none; padding:0; width:100%; margin-top:2px; text-overflow:ellipsis;" />
                    </div>
                `;
            } else {
                let avatar = p.avatar ? `<img src="${p.avatar}" style="width: 26px; height: 26px; border-radius: 4px; object-fit: cover;" />` : `<div style="width:26px; height:26px; background:var(--mantine-color-blue-light); border-radius:4px; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:10px; color:var(--mantine-color-blue-text)">PC</div>`;
                identityHtml = `
                    <div style="display: flex; align-items: center; gap: 8px; width:100%; overflow:hidden;">
                        ${avatar}
                        <div style="display:flex; flex-direction:column; overflow:hidden; width:100%;">
                            <span style="font-weight:700; font-size:15px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${p.name}">${p.name}</span>
                            <input type="text" value="${noteText}" placeholder="Заметка..." onblur="window.updateFieldLocal(${idx}, 'description', this.value); window.renderTracker();" style="background:transparent; border:none; color:var(--mantine-color-dimmed); font-size:11px; outline:none; padding:0; width:100%; margin-top:1px; text-overflow:ellipsis;" />
                        </div>
                    </div>
                `;
            }

            let currentHp = 0, maxHp = 0, tempHp = p.temp_hp || 0, hpTextStr = '';
            if (p.is_monster) {
                currentHp = p.hp; maxHp = p.max_hp;
                hpTextStr = `${currentHp}/${maxHp}`;
            } else {
                const parts = (p.hp_text || '0 / 0').split('/');
                currentHp = parseInt(parts[0], 10) || 0; maxHp = parseInt(parts[1], 10) || 0; hpTextStr = (p.hp_text || '0/0').replace(/\s+/g,'');
            }

            const maxCapacity = Math.max(maxHp, currentHp);
            const totalWidthDenom = maxCapacity + tempHp;
            const hpPct = totalWidthDenom > 0 ? (currentHp / totalWidthDenom) * 100 : 0;
            const tempPct = totalWidthDenom > 0 ? (tempHp / totalWidthDenom) * 100 : 0;

            let hpBarColor = '#12b886';
            if (maxHp > 0 && (currentHp / maxHp) <= 0.25) hpBarColor = '#fa5252';
            else if (maxHp > 0 && (currentHp / maxHp) <= 0.50) hpBarColor = '#fab005';

            let hpWidgetHtml = '';
            if (p.is_monster) {
                hpWidgetHtml = `
                    <div style="display: flex; align-items: center; gap: 8px; width: 175px; box-sizing: border-box; justify-content: space-between;">
                        <div style="display: flex; flex-direction: column; gap: 3px; width: 105px; flex-shrink: 0;">
							<div style="display: flex; justify-content: flex-start; font-family: monospace; font-size: 12px; font-weight:700; line-height:1.1; gap: 2px;">
                                <span style="${isDeadMonster ? 'color:var(--mantine-color-red-text);' : ''}">${hpTextStr}</span>
                                ${tempHp > 0 ? `<span style="color:#22d3ee; font-weight:800;">+${tempHp}</span>` : ''}
                            </div>
                            <div style="width:100%; background-color: var(--mantine-color-dark-light); border:1px solid var(--mantine-color-default-border); height:6px; border-radius:2px; display:flex; overflow:hidden;">
                                <div style="background-color:${hpBarColor}; width:${hpPct}%; transition: width 0.1s;"></div>
                                <div style="background-color:#22d3ee; width:${tempPct}%; transition: width 0.1s;"></div>
                            </div>
                        </div>
                        <div style="display:flex; gap:3px; flex-shrink: 0;">
                            <input type="text" placeholder="±" onblur="window.applyHpMathLocal(${idx}, this.value)" onkeydown="if(event.key==='Enter') { this.blur(); }" style="width:54px; background-color: var(--mantine-color-dark-light); border:1px solid var(--mantine-color-default-border); border-radius:3px; text-align:center; color:var(--mantine-color-text); font-size:11px; height:24px; padding:0; outline:none; font-weight:700;">
                        </div>
                    </div>
                `;
            } else {
                // ДЛЯ ПИ: Теперь динамически рендерится блок с синим плюсом и значением временных хитов, если они > 0
                hpWidgetHtml = `
                    <div style="display: flex; align-items: center; width: 175px; box-sizing: border-box;">
                        <div style="display: flex; flex-direction: column; gap: 3px; width: 105px;">
                            <div style="font-family: monospace; font-size: 12px; color: var(--mantine-color-green-text); font-weight: 700; line-height:1.1; display:flex; gap:4px;">
                                <span>${hpTextStr}</span>
                                ${tempHp > 0 ? `<span style="color:#22d3ee; font-weight:800;">+${tempHp}</span>` : ''}
                            </div>
                            <div style="width:100%; background-color: var(--mantine-color-dark-light); border:1px solid var(--mantine-color-default-border); height:6px; border-radius:2px; display:flex; overflow:hidden;">
                                <div style="background-color:${hpBarColor}; width:${hpPct}%; height:100%;"></div>
                                <div style="background-color:#22d3ee; width:${tempPct}%; height:100%;"></div>
                            </div>
                        </div>
                        <div style="width: 54px; margin-left: 14px;"></div>
                    </div>
                `;
            }

            let statusesListHtml = '';
            if (p.statuses && p.statuses.length > 0) {
                p.statuses.forEach((st, sIdx) => {
                    const isSystem = !p.is_monster && p.system_statuses && p.system_statuses.includes(st);
                    let bg = 'rgba(34,139,230,0.06)';
                    let borderAndText = 'var(--mantine-color-blue-outline)';

                    if (!p.is_monster && !isSystem) {
                        bg = 'rgba(92,124,250,0.08)';
                        borderAndText = 'var(--mantine-color-indigo-outline)';
                    }

                    const canDelete = p.is_monster || !isSystem;
                    const clickAction = canDelete ? `onclick="window.removeMonsterStatus(${idx}, ${sIdx})"` : '';

                    statusesListHtml += `
                        <span ${clickAction} style="font-size:11px; background: ${bg}; color:${borderAndText}; border:1px solid ${borderAndText}; padding:2px 6px; border-radius:4px; font-weight:600; cursor:${canDelete ? 'pointer' : 'default'}; white-space:nowrap; margin:2px 0;" title="${canDelete ? 'Нажмите для удаления' : 'Системный статус'}">
                            ${st}
                        </span>`;
                });
            }

            if (activeStatusInputs[idx]) {
                statusesListHtml += `
                    <input type="text" id="dm-input-st-${idx}" placeholder="Яд(3).." onblur="window.addMonsterStatus(${idx});" onkeydown="if(event.key==='Enter') { this.blur(); }" style="background-color: var(--mantine-color-dark-light); border:1px solid var(--mantine-color-blue-outline); border-radius:3px; color:var(--mantine-color-text); font-size:11px; padding:0 6px; width:65px; outline:none; height:20px; margin:2px 0;">
                `;
            } else {
                statusesListHtml += `
                    <button onclick="window.toggleStatusInput(${idx})" style="width:20px; height:20px; border-radius:3px; background:transparent; border:1px dashed var(--mantine-color-blue-outline); color:var(--mantine-color-blue-outline); display:inline-flex; align-items:center; justify-content:center; font-size:11px; font-weight:bold; cursor:pointer; padding:0; margin:2px 0;">+</button>
                `;
            }

            html += `
                <div style="background-color: ${cardBackground}; border: ${cardBorder}; opacity: ${cardOpacity}; border-radius: var(--mantine-radius-sm); padding: 6px 12px; display: grid; grid-template-columns: 40px 1.2fr 1fr 175px 40px; align-items: center; gap: 12px; width: 100%; box-sizing: border-box; min-height: 54px; transition: opacity 0.2s ease;">
                    <div style="display: flex; align-items: center; justify-content: start;">
                        <input type="number" min="0" max="99" value="${p.initiative}" onblur="window.updateFieldLocal(${idx}, 'initiative', this.value); window.renderTracker();" style="width:30px; background:var(--mantine-color-dark-light); border:1px solid transparent; border-radius:3px; color:var(--mantine-color-blue-text); font-weight:800; font-size:14px; text-align:center; outline:none; padding:3px 0; font-family:monospace;">
                    </div>
                    <div style="display: flex; align-items: center; overflow:hidden;">
                        ${identityHtml}
                    </div>
                    <div style="display: flex; align-items: center; gap: 5px; flex-wrap: wrap; justify-content: flex-end; padding: 2px 0;">
                        ${statusesListHtml}
                    </div>
                    <div style="display: flex; align-items: center; justify-content: flex-start;">
                        ${hpWidgetHtml}
                    </div>
                    <div style="display: flex; align-items: center; justify-content: flex-end; border-left: 1px solid var(--mantine-color-default-border); padding-left: 10px; height: 30px;">
                        <div style="display: flex; align-items: center; justify-content: center; position: relative; width: 26px; height: 26px;">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="var(--mantine-color-dark-4)" stroke-width="2" style="position: absolute; width:100%; height:100%;"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                            <input type="number" min="0" max="99" value="${p.ac}" onblur="window.updateFieldLocal(${idx}, 'ac', this.value);" style="width:20px; background:transparent; border:none; color: var(--mantine-color-text); font-weight:700; text-align:center; font-size:11px; font-family:monospace; outline:none; z-index:2; padding:0; margin-top:-1px;" ${!p.is_monster ? 'disabled' : ''}>
                        </div>
                    </div>
                </div>
            `;
        });

        gridContainer.innerHTML = html;
        updateStatisticsPanel();
    }

    const observer = new MutationObserver(() => {
        checkAndInject();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    setTimeout(checkAndInject, 1000);
})();
