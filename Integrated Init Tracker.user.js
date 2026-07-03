// ==UserScript==
// @name         Integrated Init Tracker for LSS Vortex
// @namespace    http://tampermonkey.net/
// @version      1.9
// @description  Трекер Инициативы
// @author       Lizardeon & Gemini
// @match        https://vortex.longstoryshort.app/*
// @match        http://vortex.longstoryshort.app/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    let state = JSON.parse(localStorage.getItem('vortex_dm_state_v10')) || {
        participants: [],
        current_index: 0,
        round_counter: 1
    };

    let activeStatusInputs = {};

    function saveState() {
        localStorage.setItem('vortex_dm_state_v10', JSON.stringify(state));
    }

    const CUSTOM_TAB_ID = 'mantine-custom-tab-dmtracker';
    const CUSTOM_PANEL_ID = 'dm-tracker-integrated-panel';

    function checkAndInject() {
        const tabList = document.querySelector('.mantine-Tabs-list');
        if (!tabList) return;

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
            dmTab.style.gap = '8px';

            dmTab.innerHTML = `
                <span style="display: flex; align-items: center; justify-content: center; width: 16px; height: 16px;">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-swords-icon lucide-swords"><polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5"/><line x1="13" x2="19" y1="19" y2="13"/><line x1="16" x2="20" y1="16" y2="20"/><line x1="19" x2="21" y1="21" y2="19"/><polyline points="14.5 6.5 18 3 21 3 21 6 17.5 9.5"/><line x1="5" x2="9" y1="14" y2="18"/><line x1="7" x2="4" y1="17" y2="20"/><line x1="3" x2="5" y1="19" y2="21"/></svg>
                </span>
                <span class="mantine-Tabs-tabLabel">Трекер Инициативы</span>
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
                dmPanel.style.marginTop = '16px';

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

        setTimeout(() => {
            const targetPanelId = clickedTab.getAttribute('aria-controls');
            if (targetPanelId) {
                const targetPanel = document.getElementById(targetPanelId);
                if (targetPanel) targetPanel.style.display = 'block';
            }
        }, 10);
    }

    function buildTrackerLayout(container) {
        container.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 16px; font-family: ui-sans-serif, system-ui, sans-serif; color: var(--mantine-color-text); box-sizing: border-box; width:100%;">

                <div style="background-color: var(--mantine-color-body); border: calc(0.0625rem * var(--mantine-scale)) solid var(--mantine-color-default-border); border-radius: var(--mantine-radius-md); padding: 20px; display: flex; flex-direction: column; gap: 20px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--mantine-color-default-border); padding-bottom: 16px; flex-wrap: wrap; gap: 12px;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <button id="dm-btn-prev" class="mantine-focus-auto mantine-active m_77c9d27d mantine-Button-root m_87cf2631 mantine-UnstyledButton-root" style="--button-height: var(--button-height-sm); --button-padding-x: var(--button-padding-x-sm); --button-fz: var(--mantine-font-size-sm); --button-radius: var(--mantine-radius-md); --button-bg: var(--mantine-color-dark-light); --button-hover: var(--mantine-color-dark-light-hover); --button-color: var(--mantine-color-text); border: none; display: inline-flex; align-items: center; justify-content: center;" type="button">
                                <span class="m_80f1301b mantine-Button-inner" style="display: flex; align-items: center; justify-content: center; gap: 4px;">
                                    <span style="display: flex; align-items: center; justify-content: center; width: 14px; height: 14px; flex-shrink:0;">
                                        <svg style="width:14px; height:14px;" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
                                    </span>
                                    <span class="m_811560b9 mantine-Button-label">Назад</span>
                                </span>
                            </button>

                            <button id="dm-btn-next" class="mantine-focus-auto mantine-active m_77c9d27d mantine-Button-root m_87cf2631 mantine-UnstyledButton-root" style="--button-height: var(--button-height-sm); --button-padding-x: var(--button-padding-x-sm); --button-fz: var(--mantine-font-size-sm); --button-radius: var(--mantine-radius-md); --button-bg: var(--mantine-color-blue-filled); --button-hover: var(--mantine-color-blue-filled-hover); --button-color: #fff; border: none; display: inline-flex; align-items: center; justify-content: center;" type="button">
                                <span class="m_80f1301b mantine-Button-inner" style="display: flex; align-items: center; justify-content: center; gap: 4px;">
                                    <span class="m_811560b9 mantine-Button-label">След. ход</span>
                                    <span style="display: flex; align-items: center; justify-content: center; width: 14px; height: 14px; flex-shrink:0;">
                                        <svg style="width:14px; height:14px;" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
                                    </span>
                                </span>
                            </button>
                        </div>

                        <div style="display: flex; align-items: center; gap: 16px;">
                            <div style="display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 600;">
                                <span style="color: var(--mantine-color-dimmed); text-transform: uppercase; font-size: 10px; letter-spacing: 0.5px;">Раунд:</span>
                                <span id="dm-round-display" style="color: var(--mantine-color-orange-text); font-family: monospace; font-size: 15px; font-weight: 700;">1</span>
                            </div>

                            <button id="dm-btn-clear" class="mantine-focus-auto mantine-active m_77c9d27d mantine-Button-root m_87cf2631 mantine-UnstyledButton-root" style="--button-height: var(--button-height-sm); --button-padding-x: var(--button-padding-x-sm); --button-fz: var(--mantine-font-size-sm); --button-radius: var(--mantine-radius-md); --button-bg: transparent; --button-hover: rgba(250, 82, 82, 0.1); --button-color: var(--mantine-color-red-text); border: calc(0.0625rem * var(--mantine-scale)) solid var(--mantine-color-red-text); display: inline-flex; align-items: center; justify-content: center;" type="button">
                                <span class="m_80f1301b mantine-Button-inner" style="display: flex; align-items: center; justify-content: center; gap: 4px;">
                                    <span style="display: flex; align-items: center; justify-content: center; width: 13px; height: 13px; flex-shrink:0;">
                                        <svg style="width:13px; height:13px;" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-4v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                    </span>
                                    <span class="m_811560b9 mantine-Button-label">Новый бой</span>
                                </span>
                            </button>
                        </div>
                    </div>

                    <div id="dm-table-wrapper" style="overflow-x: auto; width: 100%;"></div>
                </div>

                <div style="background-color: var(--mantine-color-body); border: calc(0.0625rem * var(--mantine-scale)) solid var(--mantine-color-default-border); border-radius: var(--mantine-radius-md); padding: 16px;">
                    <div style="font-size: 13px; font-weight: 700; color: var(--mantine-color-orange-text); margin-bottom: 12px; display: flex; align-items: center; gap: 6px;">
                        <svg style="width:16px; height:16px;" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                        Добавить NPC в текущий бой
                    </div>
                    <form id="dm-monster-form" style="display: flex; flex-direction: column; gap: 10px;">
                        <div style="display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; gap: 10px; flex-wrap: wrap;">
                            <input type="text" id="dm-m-name" placeholder="Имя существа" required style="background-color: var(--mantine-color-body); border: 1px solid var(--mantine-color-default-border); border-radius: var(--mantine-radius-sm); padding: 8px 12px; color: var(--mantine-color-text); font-size: 13px; outline: none;">
                            <input type="number" id="dm-m-init" placeholder="Инициатива" required style="background-color: var(--mantine-color-body); border: 1px solid var(--mantine-color-default-border); border-radius: var(--mantine-radius-sm); padding: 8px 6px; color: var(--mantine-color-text); font-size: 13px; text-align: center; outline: none;">
                            <input type="number" id="dm-m-hp" placeholder="Максимальные хиты" required style="background-color: var(--mantine-color-body); border: 1px solid var(--mantine-color-default-border); border-radius: var(--mantine-radius-sm); padding: 8px 6px; color: var(--mantine-color-text); font-size: 13px; text-align: center; outline: none;">
                            <input type="number" id="dm-m-ac" placeholder="Класс доспеха" required style="background-color: var(--mantine-color-body); border: 1px solid var(--mantine-color-default-border); border-radius: var(--mantine-radius-sm); padding: 8px 6px; color: var(--mantine-color-text); font-size: 13px; text-align: center; outline: none;">
                        </div>
                        <div style="display: flex; gap: 10px;">
                            <input type="text" id="dm-m-desc" placeholder="Заметки..." style="flex: 1; background-color: var(--mantine-color-body); border: 1px solid var(--mantine-color-default-border); border-radius: var(--mantine-radius-sm); padding: 8px 12px; color: var(--mantine-color-text); font-size: 13px; outline: none;">
                            <button type="submit" class="mantine-focus-auto mantine-active m_77c9d27d mantine-Button-root m_87cf2631 mantine-UnstyledButton-root" style="--button-height: var(--button-height-sm); --button-padding-x: var(--button-padding-x-md); --button-fz: var(--mantine-font-size-sm); --button-radius: var(--mantine-radius-sm); --button-bg: var(--mantine-color-orange-filled); --button-hover: var(--mantine-color-orange-filled-hover); --button-color: #fff; border: none; cursor: pointer;">
                                <span class="m_80f1301b mantine-Button-inner"><span class="m_811560b9 mantine-Button-label">Добавить</span></span>
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        // Безопасное назначение слушателей с проверкой существования элементов
        const btnNext = container.querySelector('#dm-btn-next');
        if (btnNext) {
            btnNext.addEventListener('click', () => {
                if (state.participants.length > 0) {
                    state.current_index++;
                    if (state.current_index >= state.participants.length) {
                        state.current_index = 0;
                        state.round_counter++;
                    }
                    saveState();
                    window.renderTracker();
                }
            });
        }

        const btnPrev = container.querySelector('#dm-btn-prev');
        if (btnPrev) {
            btnPrev.addEventListener('click', () => {
                if (state.participants.length > 0) {
                    state.current_index--;
                    if (state.current_index < 0) {
                        state.current_index = state.participants.length - 1;
                        state.round_counter = Math.max(1, state.round_counter - 1);
                    }
                    saveState();
                    window.renderTracker();
                }
            });
        }

        const btnClear = container.querySelector('#dm-btn-clear');
        if (btnClear) {
            btnClear.addEventListener('click', openClearAndSyncModal);
        }

        const monsterForm = container.querySelector('#dm-monster-form');
        if (monsterForm) {
            monsterForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const name = container.querySelector('#dm-m-name').value;
                const initiative = parseInt(container.querySelector('#dm-m-init').value) || 0;
                const max_hp = parseInt(container.querySelector('#dm-m-hp').value) || 10;
                const ac = parseInt(container.querySelector('#dm-m-ac').value) || 10;
                const description = container.querySelector('#dm-m-desc').value;

                state.participants.push({
                    name, initiative, ac, description,
                    hp: max_hp, max_hp, temp_hp: 0,
                    is_monster: true, avatar: '', statuses: []
                });

                state.participants.sort((a, b) => b.initiative - a.initiative);
                saveState();

                monsterForm.reset();
                window.renderTracker();
            });
        }
    }

    function openClearAndSyncModal() {
        const cards = document.querySelectorAll('.PartyCardStoryview_card__u4b6T');
        let standardPlayers = [];

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

            // Ищем все баджи состояний внутри карточки
            let statuses = [];

            // Используем селектор, который находит элементы с классом баджа
            // и берет текст из их метки
            const statusBadges = card.querySelectorAll('.PartyCardStoryview_badgeRemovable__83_z7 .mantine-Badge-label');

            statusBadges.forEach(badgeLabel => {
                // Внутри label находится Text-root с текстом состояния
                const textEl = badgeLabel.querySelector('.mantine-Text-root');
                if (textEl && textEl.innerText) {
                    statuses.push(textEl.innerText.trim());
                }
            });

            standardPlayers.push({ name, avatar: avatarUrl, ac: playerAc, hp_text: playerHpText, statuses });
        });

        let overlay = document.createElement('div');
        overlay.id = 'dm-modal-overlay';
        overlay.style = 'position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.6); z-index:99999; display:flex; align-items:center; justify-content:center; font-family:sans-serif; color:var(--mantine-color-text);';

        let modal = document.createElement('div');
        modal.style = 'background:var(--mantine-color-body); border:1px solid var(--mantine-color-default-border); border-radius:var(--mantine-radius-md); padding:24px; width:400px; box-shadow:var(--mantine-shadow-md); display:flex; flex-direction:column; gap:16px;';

        let title = document.createElement('h3');
        title.innerText = 'Начало нового боя';
        title.style = 'margin:0; font-size:16px; color:var(--mantine-color-orange-text);';
        modal.appendChild(title);

        let desc = document.createElement('p');
        desc.innerText = 'Выберите персонажей со стола, которые будут участвовать в этом столкновении:';
        desc.style = 'margin:0; font-size:13px; color:var(--mantine-color-dimmed);';
        modal.appendChild(desc);

        let listContainer = document.createElement('div');
        listContainer.style = 'max-height:200px; overflow-y:auto; display:flex; flex-direction:column; gap:8px; border:1px solid var(--mantine-color-default-border); padding:8px; border-radius:var(--mantine-radius-sm);';

        if (standardPlayers.length === 0) {
            listContainer.innerHTML = '<div style="font-size:12px; color:var(--mantine-color-dimmed); font-style:italic; padding:8px; text-align:center;">Персонажи на «Столе» не обнаружены</div>';
        } else {
            standardPlayers.forEach((p, i) => {
                let row = document.createElement('label');
                row.style = 'display:flex; align-items:center; gap:10px; font-size:13px; cursor:pointer; padding:4px; border-radius:4px;';
                row.onmouseover = () => row.style.backgroundColor = 'var(--mantine-color-dark-light)';
                row.onmouseout = () => row.style.backgroundColor = 'transparent';

                let chk = document.createElement('input');
                chk.type = 'checkbox';
                chk.checked = true;
                chk.dataset.index = i;
                chk.style = 'cursor:pointer;';

                let imgHtml = p.avatar ? `<img src="${p.avatar}" style="width:20px; height:20px; border-radius:4px; object-fit:cover;">` : '';
                let nameSpan = document.createElement('span');
                nameSpan.innerHTML = `${imgHtml} <span style="font-weight:600;">${p.name}</span>`;
                nameSpan.style = 'display:inline-flex; align-items:center; gap:6px;';

                row.appendChild(chk);
                row.appendChild(nameSpan);
                listContainer.appendChild(row);
            });
        }
        modal.appendChild(listContainer);

        let btnRow = document.createElement('div');
        btnRow.style = 'display:flex; justify-content:flex-end; gap:10px;';

        let cancelBtn = document.createElement('button');
        cancelBtn.innerText = 'Отмена';
        cancelBtn.style = 'background:transparent; border:1px solid var(--mantine-color-default-border); color:var(--mantine-color-text); padding:6px 12px; border-radius:var(--mantine-radius-sm); cursor:pointer; font-size:13px;';
        cancelBtn.onclick = () => overlay.remove();

        let confirmBtn = document.createElement('button');
        confirmBtn.innerText = 'Сбросить и начать';
        confirmBtn.style = 'background:var(--mantine-color-orange-filled); border:none; color:#fff; padding:6px 12px; border-radius:var(--mantine-radius-sm); cursor:pointer; font-size:13px; font-weight:600;';

        confirmBtn.onclick = () => {
            const logEntries = Array.from(document.querySelectorAll('.LogEntry_entry__jVA8H'));
            let selectedParticipants = [];

            let checkboxes = listContainer.querySelectorAll('input[type="checkbox"]');
            checkboxes.forEach(chk => {
                if (chk.checked) {
                    let p = standardPlayers[parseInt(chk.dataset.index)];

                    let initVal = 10;
                    for (let i = logEntries.length - 1; i >= 0; i--) {
                        const entry = logEntries[i];
                        const authorEl = entry.querySelector('.LogEntry_authorName__fTMQR');
                        const titleEl = entry.querySelector('.LogEntry_title__5R6wX');
                        const totalEl = entry.querySelector('.LogEntry_total__7Am39');

                        if (authorEl && titleEl && totalEl) {
                            const logName = authorEl.innerText.replace(/[\u00a0\s]+/g, ' ').trim();
                            if ((logName.includes(p.name) || p.name.includes(logName)) && titleEl.innerText.toLowerCase().includes('инициатив')) {
                                initVal = parseInt(totalEl.innerText.trim()) || 10;
                                break;
                            }
                        }
                    }

                    selectedParticipants.push({
                        name: p.name, initiative: initVal, ac: p.ac, description: '',
                        is_monster: false, avatar: p.avatar, hp_text: p.hp_text, statuses: p.statuses
                    });
                }
            });

            state.participants = selectedParticipants;
            state.participants.sort((a, b) => b.initiative - a.initiative);
            state.current_index = 0;
            state.round_counter = 1;
            activeStatusInputs = {};

            saveState();
            window.renderTracker();
            overlay.remove();
        };

        btnRow.appendChild(cancelBtn);
        btnRow.appendChild(confirmBtn);
        modal.appendChild(btnRow);
        overlay.appendChild(modal);
        document.body.appendChild(overlay);
    }

    window.applyHpMathLocal = function(idx, expr) {
        if (!expr.trim()) return;
        const p = state.participants[idx];
        if (!p || !p.is_monster) return;

        try {
            const val = window.parseInt(expr.replace('+', '').replace('-', ''));
            if (window.isNaN(val)) return;

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
                p.hp = window.Math.max(0, p.hp - damage);
            } else if (expr.startsWith('+')) {
                p.hp = window.Math.min(p.max_hp, p.hp + val);
            }
            saveState();
            window.renderTracker();
        } catch (e) { console.error(e); }
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
        if (!input || !input.value.trim()) {
            activeStatusInputs[idx] = false;
            window.renderTracker();
            return;
        }

        const newStatus = input.value.trim();
        if (state.participants[idx]) {
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
            if (field === 'initiative' || field === 'ac' || field === 'temp_hp' || field === 'hp' || field === 'max_hp') {
                state.participants[idx][field] = window.parseInt(value) || 0;
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

        const wrapper = document.getElementById('dm-table-wrapper');
        if (!wrapper) return;

        if (state.participants.length === 0) {
            wrapper.innerHTML = `
                <div style="padding: 48px; text-align: center; color: var(--mantine-color-dimmed); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; border: 1px dashed var(--mantine-color-default-border); border-radius: var(--mantine-radius-md);">
                    <svg style="width:40px; height:40px; color: var(--mantine-color-dark-3);" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
                    <p style="font-size:13px; font-weight:500; margin:0;">Боевой порядок пуст. Нажмите «Новый бой», чтобы импортировать участников со «Стола».</p>
                </div>`;
            return;
        }

        let html = `
            <table style="width:100%; text-align:left; border-collapse:collapse; font-size:13px; background-color: var(--mantine-color-body); border-radius: var(--mantine-radius-sm); overflow:hidden;">
                <thead>
                    <tr style="color: var(--mantine-color-dimmed); background-color: var(--mantine-color-dark-light); text-transform:uppercase; border-bottom:1px solid var(--mantine-color-default-border); user-select:none; font-size:11px; font-weight:700; letter-spacing:0.5px;">
                        <th style="padding:10px; width:65px; text-align:center;">Инит</th>
                        <th style="padding:10px; width:210px;">Существо</th>
                        <th style="padding:10px; width:220px; text-align:center;">Хиты (HP)</th>
                        <th style="padding:10px; width:65px; text-align:center;">КД</th>
                        <th style="padding:10px; width:280px;">Состояния / Дебаффы</th>
                        <th style="padding:10px;">Заметки</th>
                        <th style="padding:10px; width:65px; text-align:center;">Тип</th>
                    </tr>
                </thead>
                <tbody>
        `;

        state.participants.forEach((p, idx) => {
            const isCurrent = (idx === state.current_index);

            let rowStyle = isCurrent
                ? "background-color: rgba(34, 139, 230, 0.12); border-left: 4px solid var(--mantine-color-blue-filled); color: var(--mantine-color-text); font-weight: 500;"
                : "border-bottom: 1px solid var(--mantine-color-default-border); color: var(--mantine-color-text);";

            let entityIdentityHtml = '';
            if (!p.is_monster && p.avatar) {
                entityIdentityHtml = `
                    <div style="display: flex; align-items: center; gap: 8px; max-width: 200px;">
                        <img src="${p.avatar}" style="width: 26px; height: 26px; border-radius: 6px; object-fit: cover; border: 1px solid var(--mantine-color-blue-filled); flex-shrink: 0;" alt="" />
                        <span style="font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${p.name}">${p.name}</span>
                    </div>
                `;
            } else {
                entityIdentityHtml = `
                    <div style="display: flex; align-items: center; max-width: 200px;">
                        <span style="font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${p.name}">${p.name}</span>
                    </div>
                `;
            }

            let hpSection = '';
            let currentHp = 0, maxHp = 0, tempHp = p.temp_hp || 0, hpTextStr = '';

            if (p.is_monster) {
                currentHp = p.hp;
                maxHp = p.max_hp;
                hpTextStr = `${currentHp} / ${maxHp}`;
            } else {
                const parts = (p.hp_text || '0 / 0').split('/');
                currentHp = parseInt(parts[0]) || 0;
                maxHp = parseInt(parts[1]) || 0;
                hpTextStr = p.hp_text || '0 / 0';
            }

            const totalActiveHp = currentHp + tempHp;
            const maxCapacity = Math.max(maxHp, totalActiveHp);
            const hpPct = maxCapacity > 0 ? (currentHp / maxCapacity) * 100 : 0;
            const tempPct = maxCapacity > 0 ? (tempHp / maxCapacity) * 100 : 0;

            let hpBarColor = '#12b886';
            if (hpPct <= 25) hpBarColor = '#fa5252';
            else if (hpPct <= 50) hpBarColor = '#fab005';

            if (p.is_monster) {
                hpSection = `
                    <div style="width:100%; display:flex; flex-direction:column; padding:4px; box-sizing:border-box; gap:4px;">
                        <div style="width:100%; background-color: var(--mantine-color-dark-light); border:1px solid var(--mantine-color-default-border); height:6px; border-radius:3px; display:flex; overflow:hidden;">
                            <div style="background-color:${hpBarColor}; width:${hpPct}%; transition:all 0.2s;"></div>
                            <div style="background-color:#22d3ee; width:${tempPct}%; transition:all 0.2s;"></div>
                        </div>
                        <div style="display:flex; justify-content:space-between; align-items:center; font-family:monospace; font-size:11px;">
                            <div style="display:flex; align-items:center; gap:2px;">
                                <input type="number" value="${currentHp}" onblur="window.updateFieldLocal(${idx}, 'hp', this.value); window.renderTracker();" style="width:28px; background:transparent; border:none; color:var(--mantine-color-text); font-weight:bold; text-align:right; font-family:monospace; font-size:11px; padding:0; outline:none;">
                                ${tempHp > 0 ? `<span style="color:#22d3ee; font-size:10px;">+${tempHp}</span>` : ''}
                                <span style="color:var(--mantine-color-dimmed);">/</span>
                                <input type="number" value="${maxHp}" onblur="window.updateFieldLocal(${idx}, 'max_hp', this.value); window.renderTracker();" style="width:28px; background:transparent; border:none; color:var(--mantine-color-text); text-align:left; font-family:monospace; font-size:11px; padding:0; outline:none;">
                            </div>
                            <div style="display:flex; gap:3px;">
                                <input type="text" placeholder="±HP" onblur="window.applyHpMathLocal(${idx}, this.value)" onkeydown="if(event.key==='Enter') { this.blur(); }" style="width:42px; background-color: var(--mantine-color-body); border:1px solid var(--mantine-color-default-border); border-radius:3px; text-align:center; color:var(--mantine-color-text); font-size:10px; padding:1px; outline:none;">
                                <input type="number" placeholder="+THP" value="${p.temp_hp || ''}" onblur="window.updateFieldLocal(${idx}, 'temp_hp', this.value); window.renderTracker();" onkeydown="if(event.key==='Enter') { this.blur(); }" style="width:34px; background-color: var(--mantine-color-body); border:1px solid rgba(34,211,238,0.4); border-radius:3px; text-align:center; color:#22d3ee; font-size:10px; padding:1px; outline:none;">
                            </div>
                        </div>
                    </div>
                `;
            } else {
                hpSection = `
                    <div style="width:100%; display:flex; flex-direction:column; padding:4px; box-sizing:border-box; gap:4px;">
                        <div style="width:100%; background-color: var(--mantine-color-dark-light); border:1px solid var(--mantine-color-default-border); height:6px; border-radius:3px; display:flex; overflow:hidden;">
                            <div style="background-color:${hpBarColor}; width:${hpPct}%; transition:all 0.2s;"></div>
                        </div>
                        <div style="font-family:monospace; font-size:11px; color: var(--mantine-color-green-text); font-weight:bold; text-align:left; padding-left: 2px;">
                            ${hpTextStr}
                        </div>
                    </div>
                `;
            }

            let statusHtml = '<div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap; min-height: 28px;">';
            if (p.statuses && p.statuses.length > 0) {
                p.statuses.forEach((st, sIdx) => {
                    statusHtml += `
                        <span
                            ${p.is_monster ? `onclick="window.removeMonsterStatus(${idx}, ${sIdx})" title="Удалить кликом"` : ''}
                            style="font-size:11px; background:transparent; color:var(--mantine-color-blue-outline); border:1px solid var(--mantine-color-blue-outline); padding:2px 8px; border-radius:12px; font-weight:500; cursor:${p.is_monster ? 'pointer' : 'default'}; white-space:nowrap; user-select:none; transition: all 0.1s;"
                            onmouseover="${p.is_monster ? "this.style.background='rgba(250,82,82,0.15)'; this.style.borderColor='var(--mantine-color-red-text)'; this.style.color='var(--mantine-color-red-text)';" : ""}"
                            onmouseout="${p.is_monster ? "this.style.background='transparent'; this.style.borderColor='var(--mantine-color-blue-outline)'; this.style.color='var(--mantine-color-blue-outline)';" : ""}"
                        >
                            ${st}
                        </span>`;
                });
            } else if (!p.is_monster) {
                statusHtml += `<span style="color:var(--mantine-color-dark-4); font-style:italic; font-size:11px;">Нет</span>`;
            }

            if (p.is_monster) {
                if (activeStatusInputs[idx]) {
                    statusHtml += `
                        <div style="display:inline-flex; align-items:center; gap:4px;">
                            <input type="text" id="dm-input-st-${idx}" placeholder="Новый статус..." onblur="setTimeout(() => { window.addMonsterStatus(${idx}); }, 150);" onkeydown="if(event.key==='Enter') { this.blur(); }" style="background-color: var(--mantine-color-body); border:1px solid var(--mantine-color-blue-outline); border-radius:10px; color:var(--mantine-color-text); font-size:11px; padding:2px 8px; width:100px; outline:none; height:20px; box-sizing:border-box;">
                        </div>
                    `;
                } else {
                    statusHtml += `
                        <button
                            onclick="window.toggleStatusInput(${idx})"
                            title="Добавить состояние"
                            style="width:20px; height:20px; border-radius:50%; background:transparent; border:1px dashed var(--mantine-color-blue-outline); color:var(--mantine-color-blue-outline); display:inline-flex; align-items:center; justify-content:center; font-size:12px; font-weight:bold; cursor:pointer; outline:none; padding:0; transition: all 0.1s;"
                            onmouseover="this.style.background='rgba(34,139,230,0.1)'; this.style.borderStyle='solid';"
                            onmouseout="this.style.background='transparent'; this.style.borderStyle='dashed';"
                        >+</button>
                    `;
                }
            }
            statusHtml += '</div>';

            const badge = p.is_monster
                ? `<span style="font-size:9px; background: rgba(245,158,11,0.1); color: var(--mantine-color-orange-text); border:1px solid rgba(245,158,11,0.2); padding:2px 5px; border-radius:3px; font-weight:700;">NPC</span>`
                : `<span style="font-size:9px; background: rgba(34,139,230,0.1); color: var(--mantine-color-blue-text); border:1px solid rgba(34,139,230,0.2); padding:2px 5px; border-radius:3px; font-weight:700;">PC</span>`;

            html += `
                <tr style="${rowStyle}">
                    <td style="padding:8px; text-align:center; font-family:monospace;">
                        <input type="number" value="${p.initiative}" onblur="window.updateFieldLocal(${idx}, 'initiative', this.value); window.renderTracker();" onkeydown="if(event.key==='Enter') { this.blur(); }" style="width:42px; background:transparent; border:none; color:var(--mantine-color-text); font-weight:bold; text-align:center; outline:none;">
                    </td>
                    <td style="padding:8px;">${entityIdentityHtml}</td>
                    <td style="padding:8px;">${hpSection}</td>
                    <td style="padding:8px; text-align:center; font-family:monospace;">
                        <input type="number" value="${p.ac}" onblur="window.updateFieldLocal(${idx}, 'ac', this.value);" onkeydown="if(event.key==='Enter') { this.blur(); }" style="width:42px; background:transparent; border:none; color: var(--mantine-color-dimmed); text-align:center; outline:none;" ${!p.is_monster ? 'disabled' : ''}>
                    </td>
                    <td style="padding:8px;">${statusHtml}</td>
                    <td style="padding:8px;">
                        <input type="text" value="${p.description || ''}" placeholder="Заметки..." onblur="window.updateFieldLocal(${idx}, 'description', this.value);" onkeydown="if(event.key==='Enter') { this.blur(); }" style="width:100%; background:transparent; border:none; color: var(--mantine-color-text); font-size:12px; outline:none; padding:4px 0;">
                    </td>
                    <td style="padding:8px; text-align:center; user-select:none;">
                        ${badge}
                    </td>
                </tr>
            `;
        });

        html += `</tbody></table>`;
        wrapper.innerHTML = html;

        const styleSheet = document.createElement("style");
        styleSheet.innerText = `
            #dm-table-wrapper input[type=number]::-webkit-outer-spin-button,
            #dm-table-wrapper input[type=number]::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
            #dm-table-wrapper input[type=number] { -moz-appearance: textfield; }
        `;
        wrapper.appendChild(styleSheet);
    }

    const observer = new MutationObserver(() => {
        checkAndInject();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    setTimeout(checkAndInject, 1500);
})();