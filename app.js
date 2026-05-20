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
    const label = document.getElementById('calendar-month-year');
    const grid = document.getElementById('calendar-days');
    if (!label || !grid) return;

    label.textContent = `${_calYear}年 ${_calMonth + 1}月`;
    grid.innerHTML = '';

    // 月初の曜日（0=日, 1=月...）
    const firstDay = new Date(_calYear, _calMonth, 1);
    const startDow = firstDay.getDay(); 

    const daysInMonth = new Date(_calYear, _calMonth + 1, 0).getDate();
    const today = new Date(); today.setHours(0, 0, 0, 0);

    // 現在選択中の週の開始〜終了
    const selWeekStart = new Date(State.currentWeekStart);
    const selWeekEnd = new Date(selWeekStart);
    selWeekEnd.setDate(selWeekEnd.getDate() + 6);
    // 現在選択中の日
    const selDateStr = currentDayKey();

    // 空白セル (日曜始まりを維持)
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
        
        // 祝慶日またはカスタム休診日の名前を取得
        const displayHolidayName = holidayName || (State.customHolidays && State.customHolidays[dk]);
        if (displayHolidayName) cls += ' holiday';
        
        cell.className = cls;
        cell.textContent = d;
        if (displayHolidayName) cell.title = displayHolidayName;

        cell.addEventListener('click', () => {
            // その日を含む週の開始日（日曜日）を計算
            const clickedDate = new Date(_calYear, _calMonth, d);
            const weekStart = getWeekStart(clickedDate);
            State.currentWeekStart = weekStart;
            // 曜日インデックス（日=0, 月=1 ...）
            const dayIdx = clickedDate.getDay();
            State.currentDayIndex = dayIdx;
            onWeekChange();
            closeCalendar();
        });

        // 右クリックで「休診日」を切り替え
        cell.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            const holidayName = getHolidayName(dk);
            if (State.customHolidays[dk]) {
                delete State.customHolidays[dk];
                showToast('info', '休診日解除', `${dk} の休診設定を解除しました。`);
            } else if (holidayName) {
                showToast('warning', '設定不可', `国民の祝日（${holidayName}）は強制的に休診となります。`);
            } else {
                const name = prompt('休診日の名前を入力してください（例：夏期休暇）', '休診日');
                if (name !== null) {
                    State.customHolidays[dk] = name || '休診日';
                    showToast('success', '休診日設定', `${dk} を「${State.customHolidays[dk]}」として設定しました。`);
                }
            }
            saveAll();
            renderCalendar();
            renderDayTabs(); // 曜日タブの背景色なども更新
        });

        grid.appendChild(cell);
    }
}

function setupCalendar() {
    document.getElementById('btn-calendar')?.addEventListener('click', (e) => {
        e.stopPropagation();
        if (isCalendarOpen()) { closeCalendar(); } else { openCalendar(); }
    });
    document.getElementById('calendar-prev-month')?.addEventListener('click', (e) => {
        e.stopPropagation();
        _calMonth--;
        if (_calMonth < 0) { _calMonth = 11; _calYear--; }
        renderCalendar();
    });
    document.getElementById('calendar-next-month')?.addEventListener('click', (e) => {
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
        State.currentWeekStart = getWeekStart(new Date());
        renderDayTabs();
        renderWeekLabel();
        renderStaffPanel();
        buildTimeline(currentWeekKey(), currentDayKey());
        setupContextMenu();
        setupStaffModal();
        setupBulkShiftEvents();
    });
}

// ------ 週ラベル ------
function renderWeekLabel() {
    document.getElementById('week-label').textContent = formatWeekLabel(State.currentWeekStart);
}

function renderDayTabs() {
    const container = document.getElementById('day-tabs');
    if (!container) return;
    container.innerHTML = '';
    const days = getDayDates(State.currentWeekStart);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const wk = currentWeekKey();

    days.forEach((d, i) => {
        const tab = document.createElement('div');
        tab.className = 'day-tab';
        const dayIdx = d.getDay();
        if (dayIdx === 0) tab.classList.add('sunday');
        else if (dayIdx === 6) tab.classList.add('saturday');
        if (i === State.currentDayIndex) tab.classList.add('active');

        const dk = dayKeyFromDate(d);
        const holidayName = getHolidayName(dk);
        if (holidayName) tab.classList.add('holiday');

        let errorIndicator = '';
        if (typeof runValidation === 'function') {
            const v = runValidation(wk, dk);
            // 人員不足などの黄色い警告は除外し、画面上に赤色で表示される重大なエラーのみを対象とする
            // （重複、休暇出勤、および出勤スタッフのシフト未入力）
            const hasError = (v.overlaps && v.overlaps.size > 0) || 
                             (v.leaveConflicts && v.leaveConflicts.size > 0) || 
                             (v.receptionLeaveConflicts && v.receptionLeaveConflicts.size > 0) ||
                             (v.missingAttendance && v.missingAttendance.size > 0);
            if (hasError) {
                errorIndicator = `<span class="tab-error" title="シフトの重複、未入力、休暇中の配置などのエラーがあります">⚠️ エラー</span>`;
                tab.classList.add('has-error');
            }
        }

        tab.innerHTML = `<span class="tab-day">${DAY_NAMES[dayIdx]}</span><span class="tab-date">${formatDate(d)}</span>${holidayName ? `<span class="tab-holiday">${holidayName}</span>` : ''}${errorIndicator}`;
        tab.addEventListener('click', () => switchDay(i));
        container.appendChild(tab);
    });
}

function switchDay(dayIndex) {
    State.currentDayIndex = dayIndex;
    renderDayTabs();
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
    document.getElementById('btn-role-monthly')?.addEventListener('click', () => openRoleMonthlyModal());
    document.getElementById('btn-bulk-shift-open')?.addEventListener('click', () => {
        openBulkShiftModal();
        const savedStart = localStorage.getItem('dsa_bulk_start_date');
        const savedEnd = localStorage.getItem('dsa_bulk_end_date');
        if (!savedStart || !savedEnd) {
            updateBulkPeriodFromMonth(true); // isInit = true
        }
    });
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


    document.getElementById('btn-pdf')?.addEventListener('click', () => {
        showToast('info', 'PDF出力', '印刷ダイアログを表示します。');
        setTimeout(() => window.print(), 500);
    });
    document.getElementById('btn-weekly-summary')?.addEventListener('click', toggleWeeklySummary);
    document.getElementById('btn-weekly-close')?.addEventListener('click', toggleWeeklySummary);
    document.getElementById('btn-add-staff')?.addEventListener('click', openStaffAddModal);
    document.getElementById('btn-staff-list')?.addEventListener('click', openStaffListModal);
    document.getElementById('btn-leave')?.addEventListener('click', () => openLeaveModal());
    document.getElementById('today-btn')?.addEventListener('click', () => {
        State.currentWeekStart = getWeekStart(new Date());
        State.currentDayIndex = new Date().getDay(); // 今日を選択
        onWeekChange();
    });

    document.getElementById('btn-leave-prev')?.addEventListener('click', () => {
        let y = currentLeaveYear;
        let m = currentLeaveMonth - 1;
        if (m < 1) { m = 12; y--; }
        openLeaveModal(y, m);
    });
    document.getElementById('btn-leave-next')?.addEventListener('click', () => {
        let y = currentLeaveYear;
        let m = currentLeaveMonth + 1;
        if (m > 12) { m = 1; y++; }
        openLeaveModal(y, m);
    });

    // ユニット別シフト全削除
    document.getElementById('btn-clear-unit-shifts')?.addEventListener('click', () => {
        if (!confirm('【警告】すべてのユニット別シフトを削除しますか？\n（スタッフ一覧や有給、受付シフト、休診日は削除されません）')) return;
        if (!confirm('本当によろしいですか？この操作は取り消せません。')) return;
        
        clearUnitShifts();
        onWeekChange();
        showToast('success', '全削除完了', 'ユニット別シフトをすべて消去しました。');
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



// ------ モーダルclose設定 ------
function setupModalClosers() {
    ['modal-staff', 'modal-staff-list', 'modal-aggregate', 'modal-monthly', 'modal-role-monthly', 'modal-shift-edit', 'modal-leave', 'modal-sync', 'modal-app-settings', 'modal-bulk-shift'].forEach(setupModalClose);
}

// ------ キーボードショートカット ------
document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
        ['modal-staff', 'modal-staff-list', 'modal-aggregate', 'modal-monthly', 'modal-role-monthly', 'modal-shift-edit'].forEach(closeModal);
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

// ------ モーダル印刷 (別ウィンドウ方式) ------
window.printModal = function (containerId = 'monthly-table-container', titleId = 'monthly-title', orientation = 'landscape') {
    const container = document.getElementById(containerId);
    const title = document.getElementById(titleId)?.textContent || '月間シフト表';
    if (!container) return;

    // 印刷用の新しいウィンドウを開く
    const printWin = window.open('', '_blank');
    if (!printWin) {
        alert('ポップアップがブロックされました。許可してから再度お試しください。');
        return;
    }

    // メインのCSSを取得
    const styles = Array.from(document.styleSheets)
        .map(sheet => {
            try {
                return Array.from(sheet.cssRules).map(rule => rule.cssText).join('');
            } catch (e) { return ''; }
        }).join('');

    printWin.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>${title}</title>
            <style>
                ${styles}
                @media print {
                    @page { size: ${orientation}; margin: 10mm; }
                    body { 
                        padding: 0; 
                        margin: 0; 
                        background: white; 
                        -webkit-print-color-adjust: exact; 
                        print-color-adjust: exact;
                        overflow: visible !important;
                    }
                    .print-only-header { display: block !important; text-align: center; margin-bottom: 20px; }
                    table { width: 100% !important; border-collapse: collapse; page-break-inside: auto; table-layout: fixed !important; }
                    tr { page-break-inside: avoid; page-break-after: auto; }
                    thead { display: table-header-group; }
                    th, td { 
                        border: 1px solid #ccc !important; 
                        position: static !important; /* stickyを解除 */
                        background: white !important;
                        color: black !important;
                    }
                    /* 不要な要素を非表示 */
                    .btn, button, .modal-close, .modal-header { display: none !important; }
                    .modal-body { overflow: visible !important; padding: 0 !important; }
                }
                body { font-family: sans-serif; padding: 20px; }
                .print-only-header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 10px; }
                .print-only-header h1 { font-size: 24px; margin: 0; color: #000; }
                table { border-collapse: collapse; width: 100%; font-size: 11px; }
                th, td { border: 1px solid #ccc; padding: 3px; text-align: left; }
                th { background: #f5f5f5; }
            </style>
        </head>
        <body>
            <div class="print-only-header">
                <h1>${title}</h1>
            </div>
            ${container.innerHTML}
            <script>
                window.onload = () => {
                    setTimeout(() => {
                        window.print();
                        // 印刷ダイアログを閉じたらウィンドウも閉じる（ブラウザによる）
                        window.onafterprint = () => window.close();
                    }, 500);
                };
            </script>
        </body>
        </html>
    `);
    printWin.document.close();
};

// ------ 起動 ------
document.addEventListener('DOMContentLoaded', initApp);

// ------ 一括休暇・スケジュール設定イベント ＆ アジャスト処理 ------
function setupBulkShiftEvents() {
    const startInput = document.getElementById('bulk-start-date');
    const endInput = document.getElementById('bulk-end-date');

    // Flatpickr の初期化 (日本語、月曜始まりを確実に適用)
    const jaLocale = (typeof flatpickr !== 'undefined' && flatpickr.l10ns && flatpickr.l10ns.ja)
        ? { ...flatpickr.l10ns.ja, firstDayOfWeek: 1 }
        : { firstDayOfWeek: 1 };

    if (startInput) {
        flatpickr(startInput, {
            locale: jaLocale,
            dateFormat: "Y-m-d",
            allowInput: true,  // キーボードからの手動入力も許可
            onChange: function() {
                // DOMへの値反映完了を確実に待ってから処理を実行する
                setTimeout(() => {
                    handleBulkPeriodChange();
                }, 0);
            }
        });
    }
    if (endInput) {
        flatpickr(endInput, {
            locale: jaLocale,
            dateFormat: "Y-m-d",
            allowInput: true,  // キーボードからの手動入力も許可
            onChange: function() {
                // DOMへの値反映完了を確実に待ってから処理を実行する
                setTimeout(() => {
                    handleBulkPeriodChange();
                }, 0);
            }
        });
    }

    // クイック月選択変更
    document.getElementById('bulk-month-select')?.addEventListener('change', () => {
        updateBulkPeriodFromMonth(false); // isInit = false
    });

    // 開始日・終了日の手動変更イベント
    startInput?.addEventListener('change', () => {
        handleBulkPeriodChange();
    });
    endInput?.addEventListener('change', () => {
        handleBulkPeriodChange();
    });

    // 曜日チェックボックスのリアルタイム自動保存（Event Delegation）
    document.getElementById('bulk-shift-tbody')?.addEventListener('change', (e) => {
        if (!e.target.classList.contains('bulk-day-checkbox')) return;

        const checkbox = e.target;
        const staffId = checkbox.dataset.staffId;
        const dayOfWeek = parseInt(checkbox.dataset.dayOfWeek, 10);
        const isChecked = checkbox.checked;

        const startDateStr = document.getElementById('bulk-start-date')?.value;
        const endDateStr = document.getElementById('bulk-end-date')?.value;

        if (!startDateStr || !endDateStr) {
            showToast('error', '日付エラー', '日付範囲を設定してください。');
            return;
        }

        // selectedDays 配列を構築 (0=日, 1=月... 6=土)
        const selectedDays = Array(7).fill(false);
        selectedDays[dayOfWeek] = true;

        // チェックON = 出勤（shift-offを解除＝null）、チェックOFF = お休み（shift-offを設定）
        const leaveType = isChecked ? null : 'shift-off';

        const res = setBulkLeaves(staffId, startDateStr, endDateStr, selectedDays, leaveType, true);

        if (res.success) {
            const staff = getStaff(staffId);
            const staffName = staff ? staff.name : 'スタッフ';
            const dayName = DAY_NAMES[dayOfWeek];

            if (isChecked) {
                showToast('success', '設定保存', `【${staffName}】の ${dayName}曜日を出勤に設定しました。`);
            } else {
                showToast('info', '設定保存', `【${staffName}】の ${dayName}曜日をお休みに設定しました。`);
            }

            // メイン画面の再描画
            onWeekChange();
        } else {
            showToast('error', '設定失敗', res.message || '一括設定に失敗しました。');
        }
    });
}

function updateBulkPeriodFromMonth(isInit = false) {
    const monthSelect = document.getElementById('bulk-month-select');
    const startInput = document.getElementById('bulk-start-date');
    const endInput = document.getElementById('bulk-end-date');

    if (!monthSelect || !startInput || !endInput) return;

    const val = monthSelect.value;
    if (!val) return;

    // 1. まずその月専用の保存された個別期間があるか確認
    const monthlyPeriodJson = localStorage.getItem(`dsa_bulk_period_${val}`);
    let newStartStr = '';
    let newEndStr = '';

    if (monthlyPeriodJson) {
        try {
            const period = JSON.parse(monthlyPeriodJson);
            if (period && period.start && period.end) {
                newStartStr = period.start;
                newEndStr = period.end;
            }
        } catch (e) {
            console.error("Failed to parse monthly period", e);
        }
    }

    // 2. 個別期間がない場合はデフォルトの月初〜月末を計算
    if (!newStartStr || !newEndStr) {
        const [year, month] = val.split('-').map(Number);
        let startD = new Date(year, month - 1, 1);
        let endD = new Date(year, month, 0);
        newStartStr = _localDateStr(startD);
        newEndStr = _localDateStr(endD);
    }

    startInput.value = newStartStr;
    endInput.value = newEndStr;

    // Flatpickr の表示値も同期
    startInput._flatpickr?.setDate(newStartStr, false);
    endInput._flatpickr?.setDate(newEndStr, false);

    // 全体の最新期間として保存
    localStorage.setItem('dsa_bulk_start_date', newStartStr);
    localStorage.setItem('dsa_bulk_end_date', newEndStr);

    if (isInit) {
        startInput.dataset.prevVal = newStartStr;
        endInput.dataset.prevVal = newEndStr;
        renderBulkShiftTable();
    } else {
        handleBulkPeriodChange();
    }
}

function handleBulkPeriodChange() {
    const startInput = document.getElementById('bulk-start-date');
    const endInput = document.getElementById('bulk-end-date');
    const monthSelect = document.getElementById('bulk-month-select');
    if (!startInput || !endInput) return;

    const newStart = startInput.value;
    const newEnd = endInput.value;
    const prevStart = startInput.dataset.prevVal;
    const prevEnd = endInput.dataset.prevVal;

    if (newStart === prevStart && newEnd === prevEnd) return;

    // 日付の妥当性チェック
    if (!newStart || !newEnd || new Date(newStart) > new Date(newEnd)) {
        return;
    }

    // 全体の最新期間として保存
    localStorage.setItem('dsa_bulk_start_date', newStart);
    localStorage.setItem('dsa_bulk_end_date', newEnd);

    // 現在選択されている月専用の個別期間としても保存
    const currentYM = monthSelect ? monthSelect.value : null;
    if (currentYM) {
        localStorage.setItem(`dsa_bulk_period_${currentYM}`, JSON.stringify({ start: newStart, end: newEnd }));
    }

    if (prevStart && prevEnd) {
        showToast('info', '期間変更アジャスト', '変更された期間に合わせて、お休み設定を自動的に追従・適用しています...', 2000);

        // 自身の月のアジャスト処理を実行
        applyBulkAdjustmentForMonth(currentYM, prevStart, prevEnd, newStart, newEnd);

        // 前後の月の重複防止スライド調整を実行
        if (currentYM) {
            adjustAdjacentMonths(currentYM, newStart, newEnd);
        }

        saveAll();
        onWeekChange();
    }

    // prevValの更新とテーブルの再描画
    startInput.dataset.prevVal = newStart;
    endInput.dataset.prevVal = newEnd;
    renderBulkShiftTable();
}

// ------ 前後の月の重複防止・自動スライド調整ヘルパー ------

// 年月文字列(YYYY-MM)からoffset月移動した年月文字列(YYYY-MM)を取得する
function getOffsetMonth(ymStr, offset) {
    if (!ymStr) return "";
    const [year, month] = ymStr.split('-').map(Number);
    const date = new Date(year, month - 1 + offset, 1);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
}

// 任意の月のお休み（通常休暇）設定を、古い期間から新しい期間へアジャスト（スライド追従）適用する
function applyBulkAdjustmentForMonth(targetYM, oldStart, oldEnd, newStart, newEnd) {
    if (!oldStart || !oldEnd || !newStart || !newEnd) return;
    if (oldStart === newStart && oldEnd === newEnd) return;

    State.staff.forEach(s => {
        // 1. 古い期間で「お休み(false)」だった曜日を取得
        const prevStates = getBulkDayCheckboxesState(s.id, oldStart, oldEnd);

        // 2. お休み曜日について、古い期間をクリア、新しい期間に適用
        for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
            const isWorking = prevStates[dayOfWeek];
            if (!isWorking) {
                const selectedDays = Array(7).fill(false);
                selectedDays[dayOfWeek] = true;

                // 古い期間の休みをクリア
                setBulkLeaves(s.id, oldStart, oldEnd, selectedDays, null, false);

                // 新しい期間に休みを設定
                setBulkLeaves(s.id, newStart, newEnd, selectedDays, 'shift-off', false);
            }
        }
    });
}

// 今月の新しい期間 [startStr, endStr] に基づき、前月および翌月の期間重複を検知しスライド調整する
function adjustAdjacentMonths(currentYM, startStr, endStr) {
    if (!currentYM || !startStr || !endStr) return;

    const currentStart = new Date(startStr);
    const currentEnd = new Date(endStr);

    // --- 1. 前月（前の月）の調整 ---
    const prevYM = getOffsetMonth(currentYM, -1);
    if (prevYM) {
        let prevStartStr = '';
        let prevEndStr = '';
        const prevPeriodJson = localStorage.getItem(`dsa_bulk_period_${prevYM}`);
        if (prevPeriodJson) {
            try {
                const period = JSON.parse(prevPeriodJson);
                if (period && period.start && period.end) {
                    prevStartStr = period.start;
                    prevEndStr = period.end;
                }
            } catch (e) {
                console.error("Failed to parse prev period", e);
            }
        }

        // 保存データがない場合はデフォルトの月初〜月末
        if (!prevStartStr || !prevEndStr) {
            const [year, month] = prevYM.split('-').map(Number);
            const startD = new Date(year, month - 1, 1);
            const endD = new Date(year, month, 0);
            prevStartStr = _localDateStr(startD);
            prevEndStr = _localDateStr(endD);
        }

        // 前月の終了日のターゲット：今月の開始日の前日
        const prevEndLimit = new Date(currentStart);
        prevEndLimit.setDate(prevEndLimit.getDate() - 1);
        const targetPrevEndStr = _localDateStr(prevEndLimit);

        // 前月の現在の終了日とターゲットが異なる場合、強制的にスライド
        if (prevEndStr !== targetPrevEndStr) {
            const oldPrevStart = prevStartStr;
            const oldPrevEnd = prevEndStr;

            let newPrevStartStr = prevStartStr;
            let newPrevStart = new Date(prevStartStr);

            // 前月の開始日もターゲット終了日を超えてしまう場合は、開始日も終了日と同じにする
            if (newPrevStart > prevEndLimit) {
                newPrevStartStr = targetPrevEndStr;
            }

            // localStorageに保存
            localStorage.setItem(`dsa_bulk_period_${prevYM}`, JSON.stringify({ start: newPrevStartStr, end: targetPrevEndStr }));

            // お休みアジャスト処理をバックグラウンドで走らせる
            applyBulkAdjustmentForMonth(prevYM, oldPrevStart, oldPrevEnd, newPrevStartStr, targetPrevEndStr);
        }
    }

    // --- 2. 翌月（次の月）の調整 ---
    const nextYM = getOffsetMonth(currentYM, 1);
    if (nextYM) {
        let nextStartStr = '';
        let nextEndStr = '';
        const nextPeriodJson = localStorage.getItem(`dsa_bulk_period_${nextYM}`);
        if (nextPeriodJson) {
            try {
                const period = JSON.parse(nextPeriodJson);
                if (period && period.start && period.end) {
                    nextStartStr = period.start;
                    nextEndStr = period.end;
                }
            } catch (e) {
                console.error("Failed to parse next period", e);
            }
        }

        // 保存データがない場合はデフォルト of 月初〜月末
        if (!nextStartStr || !nextEndStr) {
            const [year, month] = nextYM.split('-').map(Number);
            const startD = new Date(year, month - 1, 1);
            const endD = new Date(year, month, 0);
            nextStartStr = _localDateStr(startD);
            nextEndStr = _localDateStr(endD);
        }

        // 翌月の開始日のターゲット：今月の終了日の翌日
        const nextStartLimit = new Date(currentEnd);
        nextStartLimit.setDate(nextStartLimit.getDate() + 1);
        const targetNextStartStr = _localDateStr(nextStartLimit);

        // 翌月の現在の開始日とターゲットが異なる場合、強制的にスライド
        if (nextStartStr !== targetNextStartStr) {
            const oldNextStart = nextStartStr;
            const oldNextEnd = nextEndStr;

            let newNextEndStr = nextEndStr;
            let newNextEnd = new Date(nextEndStr);

            // 翌月の終了日もターゲット開始日未満になってしまう場合は、終了日も開始日と同じにする
            if (newNextEnd < nextStartLimit) {
                newNextEndStr = targetNextStartStr;
            }

            // localStorageに保存
            localStorage.setItem(`dsa_bulk_period_${nextYM}`, JSON.stringify({ start: targetNextStartStr, end: newNextEndStr }));

            // お休みアジャスト処理をバックグラウンドで走らせる
            applyBulkAdjustmentForMonth(nextYM, oldNextStart, oldNextEnd, targetNextStartStr, newNextEndStr);
        }
    }
}
