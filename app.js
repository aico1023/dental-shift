// ============================================================
// app.js - メインエントリポイント・イベント設定・週ナビ
// ============================================================

// ------ カレンダーポップアップ ------
let _calYear = new Date().getFullYear();
let _calMonth = new Date().getMonth(); // 0-indexed

function openCalendar() {
    const popup = document.getElementById('calendar-popup');
    if (!popup) return;
    _calYear = State.currentWeekStart.getFullYear();
    _calMonth = State.currentWeekStart.getMonth();
    renderCalendar();
    popup.style.display = 'block';
    document.getElementById('btn-calendar')?.classList.add('active');
}

function closeCalendar() {
    const popup = document.getElementById('calendar-popup');
    if (popup) popup.style.display = 'none';
    document.getElementById('btn-calendar')?.classList.remove('active');
}

function isCalendarOpen() {
    const popup = document.getElementById('calendar-popup');
    return popup && popup.style.display !== 'none';
}

function renderCalendar() {
    const label = document.getElementById('cal-month-label');
    const grid = document.getElementById('cal-days');
    if (!label || !grid) return;

    label.textContent = `${_calYear}年 ${_calMonth + 1}月`;
    grid.innerHTML = '';

    // 月初の曜日（月曜始まりに変換: 0=月, 6=日）
    const firstDay = new Date(_calYear, _calMonth, 1);
    let startDow = firstDay.getDay(); // 0=日, 1=月...
    startDow = startDow === 0 ? 6 : startDow - 1; // 月始まりに変換

    const daysInMonth = new Date(_calYear, _calMonth + 1, 0).getDate();
    const today = new Date(); today.setHours(0, 0, 0, 0);

    // 現在選択中の週の開始〜終了
    const selWeekStart = new Date(State.currentWeekStart);
    const selWeekEnd = new Date(selWeekStart);
    selWeekEnd.setDate(selWeekEnd.getDate() + 6);
    // 現在選択中の日
    const selDate = getDayDates(State.currentWeekStart)[State.currentDayIndex];
    const selDateStr = selDate ? dayKeyFromDate(selDate) : '';

    // 空白セル
    for (let i = 0; i < startDow; i++) {
        const blank = document.createElement('div');
        blank.className = 'cal-day cal-blank';
        grid.appendChild(blank);
    }

    for (let d = 1; d <= daysInMonth; d++) {
        const date = new Date(_calYear, _calMonth, d);
        const dow = date.getDay(); // 0=日
        const dk = dayKeyFromDate(date);
        const isToday = date.getTime() === today.getTime();
        const isSelected = dk === selDateStr;
        const inSelWeek = date >= selWeekStart && date <= selWeekEnd;
        const holidayName = getHolidayName(dk);

        const cell = document.createElement('div');
        let cls = 'cal-day';
        if (dow === 0) cls += ' sun';
        if (dow === 6) cls += ' sat';
        if (isToday) cls += ' today';
        if (isSelected) cls += ' selected';
        else if (inSelWeek) cls += ' in-week';
        if (holidayName) cls += ' holiday';
        cell.className = cls;
        cell.textContent = d;
        if (holidayName) cell.title = holidayName;

        cell.addEventListener('click', () => {
            // その日を含む週の月曜を計算
            const clickedDate = new Date(_calYear, _calMonth, d);
            const monday = getMonday(clickedDate);
            State.currentWeekStart = monday;
            // 曜日インデックス（月=0, 日=6）
            let dayIdx = clickedDate.getDay();
            dayIdx = dayIdx === 0 ? 6 : dayIdx - 1;
            State.currentDayIndex = dayIdx;
            onWeekChange();
            closeCalendar();
        });

        grid.appendChild(cell);
    }
}

function setupCalendar() {
    document.getElementById('btn-calendar')?.addEventListener('click', (e) => {
        e.stopPropagation();
        if (isCalendarOpen()) { closeCalendar(); } else { openCalendar(); }
    });
    document.getElementById('cal-prev-month')?.addEventListener('click', (e) => {
        e.stopPropagation();
        _calMonth--;
        if (_calMonth < 0) { _calMonth = 11; _calYear--; }
        renderCalendar();
    });
    document.getElementById('cal-next-month')?.addEventListener('click', (e) => {
        e.stopPropagation();
        _calMonth++;
        if (_calMonth > 11) { _calMonth = 0; _calYear++; }
        renderCalendar();
    });
    // 外側クリックで閉じる
    document.addEventListener('click', (e) => {
        const popup = document.getElementById('calendar-popup');
        const btn = document.getElementById('btn-calendar');
        if (popup && !popup.contains(e.target) && e.target !== btn) {
            closeCalendar();
        }
    });
}

function initApp() {
    setupModalClosers();
    setupHeaderButtons();
    setupCalendar();
    buildColorPicker();
    setupSyncUI();
    setupAppSettings();

    // 初期ロード（クラウド設定があればクラウドから読み込む）
    loadAll(true).then(() => {
        State.currentWeekStart = getMonday(new Date());
        renderDayTabs();
        renderWeekLabel();
        renderStaffPanel();
        buildTimeline(currentWeekKey(), currentDayKey());
        setupContextMenu();
        setupStaffModal();
    });
}

// ------ 週ラベル ------
function renderWeekLabel() {
    document.getElementById('week-label').textContent = formatWeekLabel(State.currentWeekStart);
}

// ------ 曜日タブ ------
function renderDayTabs() {
    const container = document.getElementById('day-tabs');
    if (!container) return;
    container.innerHTML = '';
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const days = getDayDates(State.currentWeekStart);

    days.forEach((d, i) => {
        const tab = document.createElement('div');
        tab.className = 'day-tab';
        if (i === 6) tab.classList.add('sunday');
        else if (i === 5) tab.classList.add('saturday');
        if (i === State.currentDayIndex) tab.classList.add('active');

        const dk = dayKeyFromDate(d);
        const holidayName = getHolidayName(dk);
        if (holidayName) tab.classList.add('holiday');

        tab.innerHTML = `<span class="tab-day">${DAY_NAMES[i]}</span><span class="tab-date">${formatDate(d)}</span>${holidayName ? `<span class="tab-holiday">${holidayName}</span>` : ''}`;
        tab.addEventListener('click', () => switchDay(i));
        container.appendChild(tab);
    });
}

function switchDay(dayIndex) {
    State.currentDayIndex = dayIndex;
    document.querySelectorAll('.day-tab').forEach((t, i) => t.classList.toggle('active', i === dayIndex));
    buildTimeline(currentWeekKey(), currentDayKey());
    renderStaffPanel();
}

// ------ 週移動 ------
function prevWeek() {
    State.currentWeekStart.setDate(State.currentWeekStart.getDate() - 7);
    onWeekChange();
}
function nextWeek() {
    State.currentWeekStart.setDate(State.currentWeekStart.getDate() + 7);
    onWeekChange();
}
function onWeekChange() {
    renderWeekLabel();
    renderDayTabs();
    buildTimeline(currentWeekKey(), currentDayKey());
    renderStaffPanel();
    if (_weeklySummaryVisible) renderWeeklySummary();
}

// ------ ヘッダーボタン ------
function setupHeaderButtons() {
    document.getElementById('btn-prev-week')?.addEventListener('click', prevWeek);
    document.getElementById('btn-next-week')?.addEventListener('click', nextWeek);
    document.getElementById('btn-save')?.addEventListener('click', () => {
        saveAll();
        showToast('success', '保存完了', '週シフトを保存しました。');
    });
    document.getElementById('btn-copy-prev')?.addEventListener('click', () => {
        if (!confirm('前週のシフトをコピーしますか？（現在のシフトは上書きされます）')) return;
        copyPrevWeek();
        buildTimeline(currentWeekKey(), currentDayKey());
        showToast('success', '前週コピー', '前週のシフトをコピーしました。');
    });
    document.getElementById('btn-template-save')?.addEventListener('click', openTemplateSaveModal);
    document.getElementById('btn-template-apply')?.addEventListener('click', openTemplateApplyModal);
    document.getElementById('btn-aggregate')?.addEventListener('click', openAggregateModal);
    document.getElementById('btn-monthly')?.addEventListener('click', () => openMonthlyModal());
    // メニュー関連
    const menuBtn = document.getElementById('btn-menu');
    const menuDropdown = document.getElementById('header-menu');

    if (menuBtn && menuDropdown) {
        menuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (menuDropdown.style.display === 'none') {
                menuDropdown.style.display = 'flex';
                menuBtn.classList.add('active');
            } else {
                menuDropdown.style.display = 'none';
                menuBtn.classList.remove('active');
            }
        });

        // メニュー外クリックで閉じる
        document.addEventListener('click', (e) => {
            if (!menuBtn.contains(e.target) && !menuDropdown.contains(e.target)) {
                menuDropdown.style.display = 'none';
                menuBtn.classList.remove('active');
            }
        });

        // メニュー内のアイテムをクリックした時も閉じる
        menuDropdown.querySelectorAll('.dropdown-item').forEach(item => {
            item.addEventListener('click', () => {
                menuDropdown.style.display = 'none';
                menuBtn.classList.remove('active');
            });
        });
    }

    document.getElementById('btn-app-settings')?.addEventListener('click', () => {
        const modal = document.getElementById('modal-app-settings');
        if (!modal) return;
        document.getElementById('input-total-units').value = TOTAL_UNITS;
        openModal('modal-app-settings');
    });

    document.getElementById('btn-pdf')?.addEventListener('click', () => {
        showToast('info', 'PDF出力', '印刷ダイアログを表示します。');
        setTimeout(() => window.print(), 500);
    });
    document.getElementById('btn-weekly-summary')?.addEventListener('click', toggleWeeklySummary);
    document.getElementById('btn-weekly-close')?.addEventListener('click', toggleWeeklySummary);
    document.getElementById('btn-add-staff')?.addEventListener('click', openStaffAddModal);
    document.getElementById('btn-staff-list')?.addEventListener('click', openStaffListModal);
    document.getElementById('btn-leave')?.addEventListener('click', openLeaveModal);
    document.getElementById('today-btn')?.addEventListener('click', () => {
        State.currentWeekStart = getMonday(new Date());
        State.currentDayIndex = 0;
        onWeekChange();
    });

    document.getElementById('btn-sync-settings')?.addEventListener('click', () => {
        const modal = document.getElementById('modal-sync');
        if (!modal) return;

        // 現在の設定をフォームに反映
        const mode = SyncSettings.mode;
        document.querySelectorAll('input[name="syncMode"]').forEach(radio => {
            radio.checked = (radio.value === mode);
            const parent = radio.closest('.radio-btn');
            if (parent) {
                if (radio.checked) parent.classList.add('selected');
                else parent.classList.remove('selected');
            }
        });
        document.getElementById('sync-url').value = SyncSettings.url;

        // 状態メッセージの表示
        updateSyncStatusMsg();

        openModal('modal-sync');
    });

    document.getElementById('btn-sync-now')?.addEventListener('click', () => {
        loadAll(true);
    });
}

// ------ 同期UIヘルパー ------
function setupSyncUI() {
    // 同期モードのRadioボタン切り替え
    document.querySelectorAll('.radio-btn[data-radio="sync-mode"]').forEach(btn => {
        btn.addEventListener('click', function (e) {
            e.preventDefault();
            document.querySelectorAll('.radio-btn[data-radio="sync-mode"]').forEach(b => {
                b.classList.remove('selected');
                const radio = b.querySelector('input');
                if (radio) radio.checked = false;
            });
            this.classList.add('selected');
            const radio = this.querySelector('input');
            if (radio) radio.checked = true;
        });
    });

    // 保存ボタン
    document.getElementById('btn-sync-save')?.addEventListener('click', () => {
        const modeRadio = document.querySelector('input[name="syncMode"]:checked');
        const mode = modeRadio ? modeRadio.value : 'local';
        const url = document.getElementById('sync-url').value.trim();

        if (mode === 'cloud' && !url) {
            showToast('error', '設定エラー', 'クラウドモードを利用するにはGASのURLを入力してください。');
            return;
        }

        // LS_KEYS は data.js で定義されている前提
        SyncSettings.mode = mode;
        SyncSettings.url = url;
        localStorage.setItem(LS_KEYS.syncMode, mode);
        localStorage.setItem(LS_KEYS.syncUrl, url);

        updateSyncStatusMsg();
        updateSyncHeaderIcon();
        closeModal('modal-sync');

        showToast('success', '設定保存', '同期設定を保存しました。');

        if (mode === 'cloud') {
            // クラウドに切り替えた直後は、クラウドから最新を取得して画面を更新する
            loadAll(true);
        }
    });

    updateSyncHeaderIcon();
}

function updateSyncStatusMsg() {
    const msgEl = document.getElementById('sync-status-msg');
    if (!msgEl) return;
    if (SyncSettings.mode === 'cloud') {
        msgEl.textContent = 'クラウド同期: ON';
        msgEl.style.color = 'var(--success)';
    } else {
        msgEl.textContent = 'クラウド同期: OFF (ローカル)';
        msgEl.style.color = 'var(--text-muted)';
    }
}

function updateSyncHeaderIcon() {
    const syncNowBtn = document.getElementById('btn-sync-now');
    const syncSetBtn = document.getElementById('btn-sync-settings');
    if (!syncNowBtn || !syncSetBtn) return;

    if (SyncSettings.mode === 'cloud') {
        syncNowBtn.style.display = 'inline-flex';
        syncSetBtn.innerHTML = '☁️ クラウド同期 (ON)';
        syncSetBtn.style.color = 'var(--success)';
    } else {
        syncNowBtn.style.display = 'none';
        syncSetBtn.innerHTML = '☁️ クラウド同期';
        syncSetBtn.style.color = '';
    }
}

// ------ 環境設定 (アプリ全般) ------
function setupAppSettings() {
    document.getElementById('btn-app-settings-save')?.addEventListener('click', () => {
        const val = parseInt(document.getElementById('input-total-units').value, 10);
        if (isNaN(val) || val < 1 || val > 50) {
            showToast('error', '設定エラー', 'ユニット数は1〜50の間で指定してください。');
            return;
        }

        TOTAL_UNITS = val;

        // localStorageに保存（data.js の saveAll を経由するか直接）
        localStorage.setItem(LS_KEYS.totalUnits, TOTAL_UNITS.toString());

        closeModal('modal-app-settings');
        showToast('success', '設定保存', '環境設定を保存しました。画面を再構築します。');

        // 画面の再描画が必要
        if (typeof buildTimeline === 'function') {
            buildTimeline(currentWeekKey(), currentDayKey());
        }
    });

    // モーダルクローズ設定追加
    const closeBtn = document.getElementById('close-app-settings');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => closeModal('modal-app-settings'));
    }
}

// ------ モーダルclose設定 ------
function setupModalClosers() {
    ['modal-staff', 'modal-staff-list', 'modal-aggregate', 'modal-monthly', 'modal-shift-edit', 'modal-leave', 'modal-sync', 'modal-app-settings'].forEach(setupModalClose);
}

// ------ キーボードショートカット ------
document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
        ['modal-staff', 'modal-staff-list', 'modal-aggregate', 'modal-monthly', 'modal-shift-edit'].forEach(closeModal);
        closeContextMenu();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        saveAll();
        showToast('success', '保存完了', 'Ctrl+S で保存しました。');
    }
    // Arrow keys for day navigation
    if (e.altKey && e.key === 'ArrowRight') {
        switchDay(Math.min(State.currentDayIndex + 1, 6));
    }
    if (e.altKey && e.key === 'ArrowLeft') {
        switchDay(Math.max(State.currentDayIndex - 1, 0));
    }
});

// ------ モーダル印刷 ------
window.printModal = function () {
    document.body.classList.add('print-modal-mode');

    const afterPrint = () => {
        document.body.classList.remove('print-modal-mode');
        window.removeEventListener('afterprint', afterPrint);
    };
    window.addEventListener('afterprint', afterPrint);

    // Fallback for browsers that don't fire afterprint
    setTimeout(() => {
        document.body.classList.remove('print-modal-mode');
    }, 2000);

    window.print();
};

// ------ 起動 ------
document.addEventListener('DOMContentLoaded', initApp);
