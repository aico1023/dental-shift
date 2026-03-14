// ============================================================
// ui.js - モーダル・スタッフパネル・トースト・集計・その他UI
// ============================================================

// 休暇種別定義
const LEAVE_TYPES = {
    'paid': { label: '🏖️ 有給休暇', shortLabel: '🏖️ 有給', cls: 'leave-paid', bg: 'rgba(249,115,22,0.12)' },
    'happy': { label: '🎌 ハッピーマンデー', shortLabel: '🎌 HM', cls: 'leave-happy', bg: 'rgba(139,92,246,0.12)' },
    'other-vibkyuu': { label: '😴 その他休暇', shortLabel: '😴 休暇', cls: 'leave-vibkyuu', bg: 'rgba(6,182,212,0.12)' },
    'comz-vibshutu': { label: '🌳 コムズ振出', shortLabel: '🌳 振出', cls: 'leave-comz', bg: 'rgba(16,185,129,0.12)' },
    'other-vibshutu': { label: '🔁 その他出勤', shortLabel: '🔁 出勤', cls: 'leave-vibshutu', bg: 'rgba(20,184,166,0.12)' },
};


// ------ Toast通知 ------
function showToast(type, title, msg, duration = 3500) {
    const icons = { info: 'ℹ️', success: '✅', warning: '⚠️', error: '❌' };
    const container = document.getElementById('toast-container');
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `<span class="toast-icon">${icons[type] || 'ℹ️'}</span>
    <div class="toast-body">
      <div class="toast-title">${title}</div>
      ${msg ? `<div class="toast-msg">${msg}</div>` : ''}
    </div>`;
    container.appendChild(el);
    setTimeout(() => {
        el.classList.add('removing');
        setTimeout(() => el.remove(), 280);
    }, duration);
}

// ------ Modal helpers ------
function openModal(id) {
    document.getElementById(id)?.classList.add('open');
}
function closeModal(id) {
    document.getElementById(id)?.classList.remove('open');
}
function setupModalClose(id) {
    const overlay = document.getElementById(id);
    if (!overlay) return;
    overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(id); });
    overlay.querySelectorAll('.modal-close, [data-close]').forEach(btn => {
        btn.addEventListener('click', () => closeModal(id));
    });
}

// ------ スタッフパネル描画 ------
function renderStaffPanel() {
    const body = document.getElementById('staff-panel-body');
    if (!body) return;
    body.innerHTML = '';

    const wk = currentWeekKey();
    const dk = currentDayKey();
    const roleOrder = ['dr', 'da', 'dh', 'reception'];
    const roleLabels = { dr: 'Dr（歯科医師）', dh: 'DH（衛生士）', da: 'DA（助手）', reception: 'TC' };

    const validation = runValidation(wk, dk);

    roleOrder.forEach(role => {
        const members = State.staff.filter(s => s.role === role);
        if (members.length === 0) return;

        const section = document.createElement('div');
        section.className = 'role-section';

        const label = document.createElement('div');
        label.className = 'role-label';
        label.textContent = roleLabels[role];
        section.appendChild(label);

        members.forEach(s => {
            const card = document.createElement('div');
            card.className = 'staff-card';
            card.id = `staff-card-${s.id}`;

            if (validation.missingAttendance.has(s.id)) {
                card.classList.add('has-error');
                card.title = '振出設定ですがシフトが未入力です';
            }

            // 当日の休暇状態を取得
            const leaveType = getLeaveRecord(wk, s.id, dk);
            const leaveInfo = leaveType ? LEAVE_TYPES[leaveType] : null;
            // 振出系は出勤扱い（アイコンのみ付与・ドラッグ有効）
            const isVibshutu = leaveType === 'comz-vibshutu' || leaveType === 'other-vibshutu';
            const isAbsent = leaveInfo && !isVibshutu;

            const leaveBadgeHtml = leaveInfo
                ? `<span class="staff-leave-badge ${leaveInfo.cls}">${leaveInfo.shortLabel || leaveInfo.label}</span>`
                : '';

            card.innerHTML = `
        <div class="staff-avatar" style="background:${isAbsent ? 'var(--border)' : s.color}">${isAbsent ? '—' : s.name.slice(0, 1)}</div>
        <div class="staff-info">
          <div class="staff-name">${s.name}</div>
          <div class="staff-meta">${s.team ? s.team + 'チーム・' : ''}${s.employment === 'fulltime' ? '常勤' : '非常勤'}</div>
        </div>
        ${leaveBadgeHtml || `<span class="staff-badge ${ROLES[s.role]?.badge || ''}">${ROLES[s.role]?.label || s.role}</span>`}
      `;
            card.title = leaveInfo ? `${s.name}（${leaveInfo.label}）` : s.name;
            if (isAbsent) {
                card.style.opacity = '0.65';
                card.style.cursor = 'default';
            } else {
                card.style.opacity = '';
                card.style.cursor = '';
                card.addEventListener('dblclick', () => openStaffEditModal(s.id));
                attachStaffDrag(card, s.id);

                // --- ここからスタッフの並び替え用ドラッグ＆ドロップ設定 ---
                card.addEventListener('dragenter', e => {
                    e.preventDefault();
                    if (e.dataTransfer.types.includes('text/plain')) { 
                        card.style.borderTop = '2px solid var(--accent)'; 
                    }
                });
                card.addEventListener('dragover', e => {
                    e.preventDefault(); 
                    e.dataTransfer.dropEffect = 'move';
                });
                card.addEventListener('dragleave', e => {
                    card.style.borderTop = '';
                });
                card.addEventListener('drop', e => {
                    e.preventDefault();
                    e.stopPropagation(); 
                    card.style.borderTop = '';

                    const draggedStaffId = e.dataTransfer.getData('staffId');
                    if (!draggedStaffId || draggedStaffId === String(s.id)) return;

                    const draggedStaff = State.staff.find(st => String(st.id) === draggedStaffId);
                    if (!draggedStaff || draggedStaff.role !== s.role) {
                        showToast('warning', '並び替えエラー', '異なる職種のスタッフとは入れ替えられません。', 2000);
                        return;
                    }

                    const fromIndex = State.staff.findIndex(st => String(st.id) === draggedStaffId);
                    const toIndex = State.staff.findIndex(st => String(st.id) === String(s.id));

                    if (fromIndex >= 0 && toIndex >= 0) {
                        const [movedStaff] = State.staff.splice(fromIndex, 1);
                        State.staff.splice(toIndex, 0, movedStaff);
                        saveAll();
                        renderStaffPanel(); 
                    }
                });
            }
            section.appendChild(card);
        });

        body.appendChild(section);
    });
}

// ------ シフト編集モーダル ------
function openShiftEditModal(shift, unitNum) {
    const modal = document.getElementById('modal-shift-edit');
    if (!modal) return;

    const titleEl = modal.querySelector('.modal-title');
    titleEl.textContent = `U${unitNum} シフト編集`;

    const startInput = document.getElementById('se-start');
    const endInput = document.getElementById('se-end');
    startInput.value = slotToStr(shift.startSlot);
    endInput.value = slotToStr(shift.endSlot);

    const saveBtn = document.getElementById('se-save');
    const newSaveBtn = saveBtn.cloneNode(true);
    saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);

    newSaveBtn.addEventListener('click', () => {
        const [sh, sm] = startInput.value.split(':').map(Number);
        const [eh, em] = endInput.value.split(':').map(Number);
        const newStart = timeToSlot(sh, sm);
        const newEnd = timeToSlot(eh, em);
        if (newStart >= newEnd) { showToast('error', '時刻エラー', '開始より終了を後にしてください。'); return; }
        if (newStart < TIME_START || newEnd > TIME_END) { showToast('error', '時刻エラー', `9:00〜19:00 の範囲で入力してください。`); return; }
        shift.startSlot = newStart;
        shift.endSlot = newEnd;
        saveAll();
        renderAllShifts(currentWeekKey(), currentDayKey());
        refreshValidation(currentWeekKey(), currentDayKey());
        closeModal('modal-shift-edit');
        showToast('success', '更新完了', 'シフト時間を更新しました。');
    });

    openModal('modal-shift-edit');
}

// ------ スタッフ追加・編集モーダル ------
const STAFF_COLORS = COLORS;
let _editingStaffId = null;

function openStaffAddModal() {
    _editingStaffId = null;
    document.getElementById('sm-title').textContent = 'スタッフ追加';
    document.getElementById('sm-name').value = '';
    document.getElementById('sm-team').value = '';
    selectRadio('sm-role', 'dr');
    selectRadio('sm-emp', 'fulltime');
    selectRadio('sm-assist', '1');
    selectColor(STAFF_COLORS[Math.floor(Math.random() * STAFF_COLORS.length)]);
    const assistRow = document.getElementById('sm-assist-row');
    if (assistRow) assistRow.style.display = 'none';
    openModal('modal-staff');
}

function openStaffEditModal(staffId) {
    const s = getStaff(staffId);
    if (!s) return;
    _editingStaffId = staffId;
    document.getElementById('sm-title').textContent = 'スタッフ編集';
    document.getElementById('sm-name').value = s.name;
    document.getElementById('sm-team').value = s.team || '';
    selectRadio('sm-role', s.role);
    selectRadio('sm-emp', s.employment || 'fulltime');
    selectRadio('sm-assist', String(s.assistCapacity || 1));
    selectColor(s.color || STAFF_COLORS[0]);
    const assistRow = document.getElementById('sm-assist-row');
    if (assistRow) assistRow.style.display = (s.role === 'da' || s.role === 'dh') ? '' : 'none';
    openModal('modal-staff');
}

function selectRadio(groupName, value) {
    document.querySelectorAll(`[data-radio="${groupName}"]`).forEach(btn => {
        btn.classList.toggle('selected', btn.dataset.value === value);
    });
}

function getRadioValue(groupName) {
    const sel = document.querySelector(`[data-radio="${groupName}"].selected`);
    return sel ? sel.dataset.value : null;
}

let _selectedColor = STAFF_COLORS[0];
function selectColor(hex) {
    _selectedColor = hex;
    document.querySelectorAll('.color-swatch').forEach(sw => {
        sw.classList.toggle('selected', sw.dataset.color === hex);
    });
}

function buildColorPicker() {
    const container = document.getElementById('sm-color-picker');
    if (!container) return;
    container.innerHTML = '';
    STAFF_COLORS.forEach(hex => {
        const sw = document.createElement('div');
        sw.className = 'color-swatch' + (hex === _selectedColor ? ' selected' : '');
        sw.style.background = hex;
        sw.dataset.color = hex;
        sw.title = hex;
        sw.addEventListener('click', () => selectColor(hex));
        container.appendChild(sw);
    });
}

function setupStaffModal() {
    buildColorPicker();
    document.querySelectorAll('[data-radio]').forEach(btn => {
        btn.addEventListener('click', () => {
            const group = btn.dataset.radio;
            document.querySelectorAll(`[data-radio="${group}"]`).forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            if (group === 'sm-role') {
                const assistRow = document.getElementById('sm-assist-row');
                if (assistRow) assistRow.style.display = (btn.dataset.value === 'da' || btn.dataset.value === 'dh') ? '' : 'none';
            }
        });
    });

    document.getElementById('sm-save')?.addEventListener('click', () => {
        const name = document.getElementById('sm-name')?.value.trim();
        if (!name) { showToast('error', '入力エラー', '名前を入力してください。'); return; }
        const role = getRadioValue('sm-role') || 'dr';
        const emp = getRadioValue('sm-emp') || 'fulltime';
        const assist = parseInt(getRadioValue('sm-assist') || '1');
        const team = document.getElementById('sm-team')?.value.trim() || '';

        if (_editingStaffId) {
            const s = getStaff(_editingStaffId);
            if (s) { s.name = name; s.role = role; s.employment = emp; s.assistCapacity = assist; s.team = team; s.color = _selectedColor; }
        } else {
            State.staff.push({ id: newStaffId(), name, role, team, color: _selectedColor, employment: emp, assistCapacity: assist });
        }
        saveAll();
        renderStaffPanel();
        closeModal('modal-staff');
        showToast('success', _editingStaffId ? '更新完了' : '追加完了', `${name} を${_editingStaffId ? '更新' : '追加'}しました。`);
    });

    document.getElementById('sm-delete')?.addEventListener('click', () => {
        if (!_editingStaffId) return;
        const s = getStaff(_editingStaffId);
        if (!s) return;
        if (!confirm(`${s.name} を削除しますか？（既存シフトへの影響はありません）`)) return;
        State.staff = State.staff.filter(x => x.id !== _editingStaffId);
        saveAll();
        renderStaffPanel();
        closeModal('modal-staff');
        showToast('success', '削除完了', `${s.name} を削除しました。`);
    });
}

// ------ スタッフ一覧モーダル ------
function openStaffListModal() {
    const tbody = document.getElementById('staff-list-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    State.staff.forEach(s => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
      <td><span class="staff-color-dot" style="background:${s.color}"></span></td>
      <td>${s.name}</td>
      <td><span class="staff-badge ${ROLES[s.role]?.badge || ''}">${ROLES[s.role]?.label || s.role}</span></td>
      <td>${s.team || '—'}</td>
      <td>${s.employment === 'fulltime' ? '常勤' : '非常勤'}</td>
      <td>${(s.role === 'da' || s.role === 'dh') ? s.assistCapacity + '人' : '—'}</td>
      <td><button class="btn btn-ghost btn-sm" onclick="openStaffEditModal('${s.id}'); closeModal('modal-staff-list')">編集</button></td>
    `;
        tbody.appendChild(tr);
    });
    openModal('modal-staff-list');
}

// ------ 集計モーダル ------
function openAggregateModal() {
    const wk = currentWeekKey();
    const result = aggregateWeek(wk);
    const body = document.getElementById('agg-body');
    if (!body) return;
    body.innerHTML = '';

    const ph = document.createElement('div');
    ph.className = 'agg-section';
    const maxH = Math.max(...State.staff.map(s => result.personalHours[s.id]?.total || 0), 1);
    ph.innerHTML = `<div class="agg-section-title">👤 個人別週合計勤務時間</div>
    <table class="agg-table">
      <thead><tr><th>スタッフ</th><th>職種</th><th>週合計</th></tr></thead>
      <tbody>${State.staff.map(s => {
        const h = result.personalHours[s.id]?.total || 0;
        const pct = Math.round(h / maxH * 100);
        return `<tr>
          <td><span class="staff-color-dot" style="background:${s.color}"></span> ${s.name}</td>
          <td><span class="staff-badge ${ROLES[s.role]?.badge || ''}">${ROLES[s.role]?.label || s.role}</span></td>
          <td>${h.toFixed(1)}h<div class="agg-bar"><div class="agg-bar-fill" style="width:${pct}%;background:${s.color}"></div></div></td>
        </tr>`;
    }).join('')}</tbody>
    </table>`;
    body.appendChild(ph);

    const dt = document.createElement('div');
    dt.className = 'agg-section';
    const days = result.days;
    dt.innerHTML = `<div class="agg-section-title">📅 日別合計勤務時間</div>
    <table class="agg-table">
      <thead><tr><th>曜日</th><th>日付</th><th>合計時間</th></tr></thead>
      <tbody>${days.map((d, i) => {
        const dk = dayKeyFromDate(d);
        const h = result.dayTotals[dk] || 0;
        const dayIdx = d.getDay();
        return `<tr><td>${DAY_NAMES[dayIdx]}</td><td>${formatDate(d)}</td><td>${h.toFixed(1)}h</td></tr>`;
    }).join('')}</tbody>
    </table>`;
    body.appendChild(dt);

    const rc = document.createElement('div');
    rc.className = 'agg-section';
    rc.innerHTML = `<div class="agg-section-title">🏥 職種別人数（日別）</div>
    <table class="agg-table">
      <thead><tr><th style="text-align:left;">曜日</th><th style="text-align:center;">Dr</th><th style="text-align:center;">DH</th><th style="text-align:center;">DA</th><th style="text-align:center;">TC</th></tr></thead>
      <tbody>${days.map((d, i) => {
        const dk = dayKeyFromDate(d);
        const rc2 = result.roleCounts[dk] || {};
        const dayIdx = d.getDay();
        return `<tr><td style="text-align:left;">${DAY_NAMES[dayIdx]} ${formatDate(d)}</td><td style="text-align:center;">${rc2.dr || 0}</td><td style="text-align:center;">${rc2.dh || 0}</td><td style="text-align:center;">${rc2.da || 0}</td><td style="text-align:center;font-weight:normal;">${rc2.reception || 0}</td></tr>`;
    }).join('')}</tbody>
    </table>`;
    body.appendChild(rc);

    const uh = document.createElement('div');
    uh.className = 'agg-section';
    const maxUH = Math.max(...Array.from({ length: TOTAL_UNITS }, (_, i) => result.unitHours[`u${i + 1}`] || 0), 1);
    uh.innerHTML = `<div class="agg-section-title">🦷 ユニット別稼働時間（週合計）</div>
    <table class="agg-table">
      <thead><tr><th>ユニット</th><th>稼働時間</th></tr></thead>
      <tbody>${Array.from({ length: TOTAL_UNITS }, (_, i) => {
        const h = result.unitHours[`u${i + 1}`] || 0;
        const pct = Math.round(h / maxUH * 100);
        const uName = getUnitName(i + 1);
        return `<tr><td>${uName}</td><td>${h.toFixed(1)}h<div class="agg-bar"><div class="agg-bar-fill" style="width:${pct}%"></div></div></td></tr>`;
    }).join('')}</tbody>
    </table>`;
    body.appendChild(uh);

    openModal('modal-aggregate');
}

// ------ 環境設定 ------
function setupAppSettings() {
    document.getElementById('btn-app-settings')?.addEventListener('click', () => {
        const modal = document.getElementById('modal-app-settings');
        if (!modal) return;
        document.getElementById('input-total-units').value = TOTAL_UNITS;
        updateDataSizeDisplay();
        openModal('modal-app-settings');
    });

    function updateDataSizeDisplay() {
        const info = getDataSizeInfo();
        const display = document.getElementById('data-size-display');
        if (display) {
            display.textContent = `${info.kb} KB`;
            display.style.color = info.bytes > 9000 ? 'var(--danger)' : (info.bytes > 7000 ? 'var(--warning)' : 'var(--success)');
        }
    }

    document.getElementById('btn-cleanup-start')?.addEventListener('click', () => {
        const months = parseInt(document.getElementById('cleanup-months').value, 10);
        if (confirm(`${months}ヶ月以上前のシフト・休暇データを削除しますか？`)) {
            const removed = cleanupOldData(months);
            updateDataSizeDisplay();
            showToast('success', 'クリーンアップ完了', `${removed}週分のデータを削除しました。`);
        }
    });

    document.getElementById('btn-app-settings-save')?.addEventListener('click', () => {
        const val = parseInt(document.getElementById('input-total-units').value, 10);
        if (isNaN(val) || val < 1 || val > 50) { showToast('error', '設定エラー', '1〜50の間で指定してください。'); return; }
        TOTAL_UNITS = val;
        localStorage.setItem(LS_KEYS.totalUnits, TOTAL_UNITS.toString());
        closeModal('modal-app-settings');
        showToast('success', '設定保存', '環境設定を保存しました。');
        if (typeof buildTimeline === 'function') buildTimeline(currentWeekKey(), currentDayKey());
    });
}

// ------ テンプレ保存/適用 ------
function openTemplateSaveModal() {
    const name = prompt('テンプレート名を入力してください：');
    if (!name) return;
    const wk = currentWeekKey();
    const currentDays = getDayDates(State.currentWeekStart).map(dayKeyFromDate);
    const shiftTpl = {};
    const recTpl = {};
    const sourceShifts = State.weekShifts[wk] || {};
    const sourceRec = State.receptionShifts[wk] || {};
    currentDays.forEach((dk, index) => {
        if (sourceShifts[dk]) shiftTpl[index] = JSON.parse(JSON.stringify(sourceShifts[dk]));
        if (sourceRec[dk]) recTpl[index] = JSON.parse(JSON.stringify(sourceRec[dk]));
    });
    State.templates[name] = { shifts: shiftTpl, reception: recTpl };
    saveAll();
    showToast('success', 'テンプレ保存', `「${name}」として保存しました。`);
}

function openTemplateApplyModal() {
    const names = Object.keys(State.templates);
    if (names.length === 0) { showToast('info', 'テンプレなし', '保存されたテンプレートがありません。'); return; }
    const name = names.length === 1 ? names[0] : prompt(`テンプレートを選択：\n${names.map((n, i) => `${i + 1}. ${n}`).join('\n')}`);
    if (!name) return;
    const tpl = State.templates[name] || State.templates[names[parseInt(name) - 1]];
    if (!tpl) { showToast('error', 'エラー', '見つかりません。'); return; }
    if (!confirm(`「${name}」を今週に適用しますか？`)) return;

    const wk = currentWeekKey();
    const currentDays = getDayDates(State.currentWeekStart).map(dayKeyFromDate);
    State.weekShifts[wk] = {};
    State.receptionShifts[wk] = {};

    currentDays.forEach((dk, index) => {
        const holidayName = getHolidayName(dk);
        if (holidayName) {
            State.weekShifts[wk][dk] = {};
            State.receptionShifts[wk][dk] = { am: [], pm: [] };
        } else {
            if (tpl.shifts && tpl.shifts[index]) {
                State.weekShifts[wk][dk] = JSON.parse(JSON.stringify(tpl.shifts[index]));
                Object.values(State.weekShifts[wk][dk]).forEach(arr => { if (Array.isArray(arr)) arr.forEach(sh => sh.id = newShiftId()); });
            } else {
                State.weekShifts[wk][dk] = {};
            }
            if (tpl.reception && tpl.reception[index]) State.receptionShifts[wk][dk] = JSON.parse(JSON.stringify(tpl.reception[index]));
            else State.receptionShifts[wk][dk] = { am: [], pm: [] };
        }
    });

    saveAll();
    buildTimeline(wk, currentDayKey());
    showToast('success', 'テンプレ適用', `「${name}」を適用しました。`);
}

// ------ 週間シフトサマリー ------
let _weeklySummaryVisible = false;
function toggleWeeklySummary() {
    _weeklySummaryVisible = !_weeklySummaryVisible;
    const panel = document.getElementById('weekly-summary');
    const btn = document.getElementById('btn-weekly-summary');
    if (!panel) return;
    if (_weeklySummaryVisible) {
        panel.style.display = 'flex';
        btn?.classList.add('active');
        renderWeeklySummary();
    } else {
        panel.style.display = 'none';
        btn?.classList.remove('active');
    }
}

function renderWeeklySummary() {
    const container = document.getElementById('weekly-summary-body');
    if (!container) return;
    container.innerHTML = '';

    // 週間表のみ「月曜始まり」にする (日曜始まりの currentWeekStart に +1日)
    const mon = new Date(State.currentWeekStart);
    mon.setDate(mon.getDate() + 1); 
    const days = getDayDates(mon); 
    const dayKeys = days.map(d => dayKeyFromDate(d));

    const roleOrder = ['dr', 'da', 'dh', 'reception'];
    const roleLabels = { dr: 'Dr（歯科医師）', dh: 'DH（衛生士）', da: 'DA（助手・受付）', reception: 'TC' };

    roleOrder.forEach(role => {
        const members = State.staff.filter(s => s.role === role);
        if (members.length === 0) return;

        // 職種タイトル
        const h3 = document.createElement('h3');
        h3.style.cssText = 'margin:12px 4px 6px; font-size:11px; color:var(--text-secondary); border-left:3px solid var(--accent); padding-left:8px;';
        h3.textContent = roleLabels[role];
        container.appendChild(h3);

        const table = document.createElement('table');
        table.className = 'weekly-table';
        table.style.marginBottom = '20px';
        
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        const thStaff = document.createElement('th');
        thStaff.className = 'staff-col';
        thStaff.textContent = 'スタッフ';
        headerRow.appendChild(thStaff);

        days.forEach(d => {
            const th = document.createElement('th');
            const dk = dayKeyFromDate(d);
            const dayIdx = d.getDay(); 
            let cls = dayIdx === 0 ? 'sun' : (dayIdx === 6 ? 'sat' : '');
            const hName = getHolidayName(dk);
            if (hName) cls = 'holiday-col';
            if (cls) th.className = cls;
            th.innerHTML = `${DAY_NAMES[dayIdx]}<br><span style="font-weight:400;font-size:9px">${formatDate(d)}</span>`;
            headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);
        table.appendChild(thead);

        const tbody = document.createElement('tbody');
        members.forEach(staff => {
            const tr = document.createElement('tr');
            const nameTd = document.createElement('td');
            nameTd.className = 'staff-name-cell';
            nameTd.innerHTML = `<span style="display:inline-flex;align-items:center;gap:3px"><span style="width:7px;height:7px;border-radius:50%;background:${staff.color};flex-shrink:0;display:inline-block"></span>${staff.name.split(' ').pop()}</span>`;
            tr.appendChild(nameTd);

            dayKeys.forEach((dk, i) => {
                const td = document.createElement('td');
                const d = days[i];
                const targetWk = weekKeyFromDate(getWeekStart(d));
                const dayIdx = d.getDay();
                const hName = getHolidayName(dk);
                let cls = dayIdx === 6 ? 'sat' : dayIdx === 0 ? 'sun' : '';
                if (hName) cls = 'holiday-col';
                if (cls) td.className = cls;

                if (hName) {
                    td.style.background = 'rgba(220,38,38,0.06)';
                    td.style.textAlign = 'center';
                    td.innerHTML = `<span style="font-size:9px;color:#dc2626;font-weight:600">🎌 休診</span>`;
                } else {
                    let isWorking = false;
                    for (let u = 1; u <= TOTAL_UNITS; u++) {
                        const arr = getUnitShifts(targetWk, dk, u);
                        for (const sh of arr) {
                            if ([sh.doctorId, ...(sh.dhIds || []), ...(sh.daIds || []), ...(sh.tcIds || [])].includes(staff.id)) { isWorking = true; break; }
                        }
                        if (isWorking) break;
                    }

                    const leaveType = getLeaveRecord(targetWk, staff.id, dk);
                    td.style.textAlign = 'center';
                    if (leaveType) {
                        const l = LEAVE_TYPES[leaveType] || { label: '休暇', bg: 'var(--bg)' };
                        td.style.background = l.bg;
                        td.innerHTML = `<span class="leave-badge ${l.cls}">${l.shortLabel || l.label}</span>`;
                    } else if (isWorking) {
                        td.style.background = colorWithAlpha(staff.color, 0.15);
                        td.innerHTML = `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${staff.color};margin:auto"></span>`;
                    } else {
                        td.style.color = '#ccc';
                        td.textContent = '—';
                    }
                }
                tr.appendChild(td);
            });
            tbody.appendChild(tr);
        });
        table.appendChild(tbody);
        container.appendChild(table);
    });
}

// ------ 休暇管理モーダル ------
function openLeaveModal() {
    const container = document.getElementById('leave-grid-container');
    if (!container) return;
    container.innerHTML = '';
    const wk = currentWeekKey();
    const days = getDayDates(State.currentWeekStart); 
    const dayKeys = days.map(d => dayKeyFromDate(d));
    const roleOrder = ['dr', 'da', 'dh', 'reception'];
    const roleLabels = { dr: 'Dr', dh: 'DH', da: 'DA', reception: 'TC' };

    const table = document.createElement('table');
    table.className = 'leave-table';
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    const thStaff = document.createElement('th');
    thStaff.style.cssText = 'min-width:100px;text-align:left;padding:6px 8px;position:sticky;top:0;background:var(--bg);z-index:10;border-bottom:1px solid var(--border);';
    thStaff.textContent = 'スタッフ';
    headerRow.appendChild(thStaff);

    days.forEach((d, i) => {
        const th = document.createElement('th');
        th.style.cssText = 'text-align:center;padding:6px 4px;min-width:80px;position:sticky;top:0;background:var(--bg);z-index:10;border-bottom:1px solid var(--border);';
        const dayIdx = d.getDay();
        const cls = dayIdx === 6 ? 'color:#3b82f6' : (dayIdx === 0 ? 'color:#ef4444' : '');
        th.innerHTML = `<span style="${cls}">${DAY_NAMES[dayIdx]}<br><span style="font-size:10px;font-weight:400">${formatDate(d)}</span></span>`;
        headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    roleOrder.forEach(role => {
        const members = State.staff.filter(s => s.role === role);
        if (members.length === 0) return;
        const roleRow = document.createElement('tr');
        const roleCell = document.createElement('td');
        roleCell.colSpan = days.length + 1;
        roleCell.style.cssText = 'background:var(--bg-secondary);font-size:10px;font-weight:600;padding:4px 8px;color:var(--text-muted);';
        roleCell.textContent = roleLabels[role];
        roleRow.appendChild(roleCell);
        tbody.appendChild(roleRow);

        members.forEach(staff => {
            const tr = document.createElement('tr');
            const nameTd = document.createElement('td');
            nameTd.style.cssText = 'padding:4px 8px;font-size:12px;white-space:nowrap;';
            nameTd.innerHTML = `<span style="display:inline-flex;align-items:center;gap:4px"><span style="width:8px;height:8px;border-radius:50%;background:${staff.color}"></span>${staff.name}</span>`;
            tr.appendChild(nameTd);

            dayKeys.forEach(dk => {
                const td = document.createElement('td');
                td.style.cssText = 'padding:3px 4px;text-align:center;';
                const sel = document.createElement('select');
                sel.className = 'leave-select';
                sel.innerHTML = `<option value="">&#x2014; 通常出勤</option>` + Object.keys(LEAVE_TYPES).map(t => `<option value="${t}">${LEAVE_TYPES[t].label}</option>`).join('');
                const current = getLeaveRecord(wk, staff.id, dk);
                if (current) sel.value = current;
                sel.addEventListener('change', () => { setLeaveRecord(wk, staff.id, dk, sel.value); saveAll(); renderStaffPanel(); });
                td.appendChild(sel);
                tr.appendChild(td);
            });
            tbody.appendChild(tr);
        });
    });
    table.appendChild(tbody);
    container.appendChild(table);
    openModal('modal-leave');
}

// ------ 月間表（ユニット別）モーダル ------
let _currentMonthlyYear = null;
let _currentMonthlyMonth = null;

function openMonthlyModal(year, month) {
    if (year === undefined || month === undefined) {
        const today = new Date(State.currentWeekStart);
        today.setDate(today.getDate() + State.currentDayIndex);
        _currentMonthlyYear = today.getFullYear();
        _currentMonthlyMonth = today.getMonth();
    } else {
        _currentMonthlyYear = year;
        _currentMonthlyMonth = month;
    }

    const titleEl = document.getElementById('monthly-title');
    if (titleEl) titleEl.textContent = `${_currentMonthlyYear}年${_currentMonthlyMonth + 1}月 月間ユニット表`;

    const container = document.getElementById('monthly-table-container');
    if (!container) return;
    container.innerHTML = '';

    const numDays = new Date(_currentMonthlyYear, _currentMonthlyMonth + 1, 0).getDate();
    const roleOrder = ['dr', 'da', 'dh', 'reception'];

    const table = document.createElement('table');
    table.className = 'weekly-table'; 
    table.style.minWidth = '1200px';

    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');

    const thDate = document.createElement('th');
    thDate.className = 'staff-col';
    thDate.textContent = '日付';
    thDate.style.width = '70px';
    thDate.style.minWidth = '70px';
    headerRow.appendChild(thDate);

    for (let u = 1; u <= TOTAL_UNITS; u++) {
        const th = document.createElement('th');
        th.textContent = `U${u}`;
        th.style.minWidth = '90px';
        headerRow.appendChild(th);
    }
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    for (let day = 1; day <= numDays; day++) {
        const d = new Date(_currentMonthlyYear, _currentMonthlyMonth, day);
        const dk = dayKeyFromDate(d);
        const wk = weekKeyFromDate(getWeekStart(d));
        const tr = document.createElement('tr');

        const tdDate = document.createElement('td');
        tdDate.className = 'staff-name-cell';
        const dayIdx = d.getDay();
        const hName = getHolidayName(dk);
        let dayColor = '';
        if (hName || dayIdx === 0) dayColor = 'color: #dc2626;';
        else if (dayIdx === 6) dayColor = 'color: #3b82f6;';

        tdDate.innerHTML = `<div style="${dayColor} font-weight:700;">${day}日 (${DAY_NAMES[dayIdx]})</div>`;
        if (hName) tdDate.innerHTML += `<div style="font-size:9px; color:#dc2626; font-weight:700;">${hName}</div>`;
        tr.appendChild(tdDate);

        for (let u = 1; u <= TOTAL_UNITS; u++) {
            const td = document.createElement('td');
            if (hName) td.style.background = 'rgba(220,38,38,0.03)';
            else if (dayIdx === 0) td.style.background = 'rgba(239,68,68,0.03)';
            else if (dayIdx === 6) td.style.background = 'rgba(99,102,241,0.03)';

            const shifts = getUnitShifts(wk, dk, u);
            const staffList = { dr: {}, da: {}, dh: {}, reception: {} };

            const updateStaffTime = (role, id, start, end) => {
                if (!staffList[role][id]) {
                    staffList[role][id] = { start: start, end: end };
                } else {
                    staffList[role][id].start = Math.min(staffList[role][id].start, start);
                    staffList[role][id].end = Math.max(staffList[role][id].end, end);
                }
            };

            shifts.forEach(sh => {
                if (sh.doctorId) updateStaffTime('dr', sh.doctorId, sh.startSlot, sh.endSlot);
                (sh.daIds || []).forEach(id => updateStaffTime('da', id, sh.startSlot, sh.endSlot));
                (sh.dhIds || []).forEach(id => updateStaffTime('dh', id, sh.startSlot, sh.endSlot));
                (sh.tcIds || []).forEach(id => updateStaffTime('reception', id, sh.startSlot, sh.endSlot));
            });

            let html = '';
            roleOrder.forEach(role => {
                const sids = Object.keys(staffList[role]);
                sids.forEach(sid => {
                    const s = getStaff(sid);
                    if (s) {
                        const shiftData = staffList[role][sid];
                        let timeStr = '';
                        if (shiftData.start !== 9 || shiftData.end !== 20) {
                            timeStr = `<span style="margin-left:2px; font-size:8px; color:#666; font-weight:normal;">(${slotToStr(shiftData.start)}-${slotToStr(shiftData.end)})</span>`;
                        }
                        html += `<div style="display:flex; align-items:center; gap:2px; margin-bottom:1px; line-height:1.1; font-size:9px;">
                                   <span style="width:4px;height:4px;border-radius:50%;background:${s.color};display:inline-block;flex-shrink:0;"></span>
                                   <span style="font-weight:700;color:#555;font-size:8px;margin-right:2px;">${ROLES[role].label}</span>
                                   <span style="white-space:nowrap;">${s.name.split(' ').pop()}${timeStr}</span>
                                 </div>`;
                    }
                });
            });
            td.innerHTML = html;
            tr.appendChild(td);
        }
        tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    container.appendChild(table);
    openModal('modal-monthly');
}

// ------ 月間モーダル用イベントリスナー設定 ------
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('btn-monthly-prev')?.addEventListener('click', () => {
        let y = _currentMonthlyYear;
        let m = _currentMonthlyMonth - 1;
        if (m < 0) { m = 11; y--; }
        openMonthlyModal(y, m);
    });
    document.getElementById('btn-monthly-next')?.addEventListener('click', () => {
        let y = _currentMonthlyYear;
        let m = _currentMonthlyMonth + 1;
        if (m > 11) { m = 0; y++; }
        openMonthlyModal(y, m);
    });
});
