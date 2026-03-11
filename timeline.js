// ============================================================
// timeline.js - タイムライン描画 & シフトブロック
// ============================================================

// TOTAL_UNITS は data.js で定義（= 11）

// ユニット表示名取得（dayKey省略時は現在の曜日をデフォルトに使用）
function getUnitName(u, dayKey) {
    const dk = dayKey || currentDayKey();
    return (State.unitNames[dk] && State.unitNames[dk][u])
        ? State.unitNames[dk][u]
        : `U${u}`;
}

// ユニット名称変更（現在の曜日に保存）
function renameUnit(u) {
    const dk = currentDayKey();
    const current = getUnitName(u, dk);
    const newName = prompt(`U${u} の名称を入力してください（この曜日のみ変更されます）：`, current);
    if (newName === null) return;
    const trimmed = newName.trim();
    if (!trimmed) return;
    if (!State.unitNames[dk]) State.unitNames[dk] = {};
    State.unitNames[dk][u] = trimmed;
    saveAll();
    // ヘッダーのみ更新
    const hdr = document.getElementById(`unit-header-${u}`);
    if (hdr) {
        const dot = hdr.querySelector('.warn-dot');
        const dotHtml = dot ? dot.outerHTML : '<span class="warn-dot"></span>';
        hdr.innerHTML = `<span class="unit-name-label" title="ダブルクリックで名称変更（この曜日のみ）">${trimmed}</span>${dotHtml}`;
    }
}

// Helper function for grid lines
function addGridLine(bodyElement, topPosition, isHourLine) {
    const line = document.createElement('div');
    line.style.position = 'absolute';
    line.style.left = '0';
    line.style.right = '0';
    line.style.top = `${topPosition}px`;
    line.style.height = '0';
    line.style.pointerEvents = 'none';
    if (isHourLine) {
        line.style.borderTop = '1px solid rgba(0,0,0,0.2)';
    } else {
        line.style.borderTop = '1px dashed rgba(0,0,0,0.08)';
    }
    bodyElement.appendChild(line);
}

// Helper function to calculate total timeline height (assuming it's new and needed)
function totalTimelineHeight() {
    const amHours = BREAK_START - TIME_START;
    const pmHours = TIME_END - BREAK_END;
    return (amHours * ROW_H) + BREAK_H + (pmHours * ROW_H) + 1; // +1 for 20:00 end line
}

function buildTimeline(weekKey, dayKey) {
    const container = document.getElementById('timeline-columns');
    if (!container) return;
    container.innerHTML = '';

    // 休診バナーの制御（既存バナーを一旦除去）
    const existingBanner = document.getElementById('holiday-banner');
    if (existingBanner) existingBanner.remove();

    const holidayName = getHolidayName(dayKey);

    const totalH = totalTimelineHeight();

    // ---- 時間ラベル列 ----
    const timeCol = document.createElement('div');
    timeCol.className = 'time-labels-col';

    // ヘッダー（ユニット列のヘッダーと同じ高さのスペーサー）
    const timeHeader = document.createElement('div');
    timeHeader.style.cssText = 'height:36px;flex-shrink:0;';
    timeCol.appendChild(timeHeader);

    // ラベル本体: absolute配置でグリッド線と完全に合わせる
    const timeBody = document.createElement('div');
    timeBody.style.cssText = `position:relative;height:${totalH}px;`;

    // AM: 9:00〜13:00 と PM: 14:00〜20:00 の各整時ラベルをabsoluteで配置
    const hours = [];
    for (let h = TIME_START; h <= BREAK_START; h++) hours.push(h);
    for (let h = BREAK_END; h <= TIME_END; h++) hours.push(h);

    hours.forEach(h => {
        const slot = h; // 整時なのでslotはhと同じ
        const top = slotToPixel(slot);
        const label = document.createElement('div');
        label.style.cssText = `
            position:absolute;
            right:8px;
            top:${top}px;
            transform:translateY(-1px);
            font-size:11px;
            font-weight:500;
            color:var(--text-muted);
            line-height:1;
            white-space:nowrap;
        `;
        label.textContent = `${h}:00`;
        timeBody.appendChild(label);
    });

    timeCol.appendChild(timeBody);
    container.appendChild(timeCol);

    // ---- ユニット列 ----
    for (let u = 1; u <= TOTAL_UNITS; u++) {
        const col = document.createElement('div');
        col.className = 'unit-col';
        col.dataset.unit = u;

        // Header (ダブルクリックで名称変更)
        const hdr = document.createElement('div');
        hdr.className = 'unit-header';
        hdr.id = `unit-header-${u}`;
        hdr.title = 'ダブルクリックで名称変更';
        const unitLabel = getUnitName(u, dayKey);
        hdr.innerHTML = `<span class="unit-name-label">${unitLabel}</span><span class="warn-dot"></span>`;
        hdr.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            renameUnit(u);
        });
        col.appendChild(hdr);

        // Body
        const body = document.createElement('div');
        body.className = 'unit-body';
        body.id = `unit-body-${u}`;
        body.style.height = `${totalH}px`;
        body.style.position = 'relative';
        body.dataset.unit = u;

        // AM グリッド線 (9:00〜13:00)
        for (let h = 0; h < BREAK_START - TIME_START; h++) {
            const top = h * ROW_H;
            addGridLine(body, top, true);
            addGridLine(body, top + ROW_H / 2, false);
        }

        // 昼休み区切りバー
        const breakBar = document.createElement('div');
        const breakTop = (BREAK_START - TIME_START) * ROW_H;
        breakBar.style.cssText = `
      position:absolute; left:0; right:0;
      top:${breakTop}px; height:${BREAK_H}px;
      background: repeating-linear-gradient(
        45deg,
        transparent,
        transparent 4px,
        rgba(0,0,0,0.03) 4px,
        rgba(0,0,0,0.03) 8px
      );
      border-top: 1px solid var(--border);
      border-bottom: 1px solid var(--border);
      display:flex; align-items:center; justify-content:center;
      font-size:9px; color:var(--text-muted); letter-spacing:.05em;
      pointer-events:none; z-index:1;
    `;
        // テキストなし（区切り線のみ）
        body.appendChild(breakBar);

        // PM グリッド線 (14:00〜20:00)
        for (let h = 0; h < TIME_END - BREAK_END; h++) {
            const top = (BREAK_START - TIME_START) * ROW_H + BREAK_H + h * ROW_H;
            addGridLine(body, top, true);
            addGridLine(body, top + ROW_H / 2, false);
        }
        // 20:00 終端線
        const endTop = (BREAK_START - TIME_START) * ROW_H + BREAK_H + (TIME_END - BREAK_END) * ROW_H;
        addGridLine(body, endTop, true);

        // Hint
        const hint = document.createElement('div');
        hint.className = 'empty-drop-hint';
        hint.textContent = 'ここにスタッフを\nドラッグ';
        body.appendChild(hint);

        col.appendChild(body);
        container.appendChild(col);
    }

    // TC (Reception) panel - 非表示（パネル削除）
    // buildReceptionPanel(weekKey, dayKey);

    // Render shifts
    renderAllShifts(weekKey, dayKey);

    // Attach drop zones
    attachDropZones();

    // Validate
    refreshValidation(weekKey, dayKey);

    // 休診バナー（祝日）
    if (holidayName) {
        const workspace = document.getElementById('workspace');
        if (workspace) {
            const banner = document.createElement('div');
            banner.id = 'holiday-banner';
            banner.className = 'holiday-banner';
            banner.innerHTML = `<span class="holiday-banner-icon">🎌</span><span class="holiday-banner-name">${holidayName}</span><span class="holiday-banner-sub">休診日</span>`;
            workspace.appendChild(banner);
        }
    }
}

function renderAllShifts(weekKey, dayKey) {
    // Clear existing blocks
    document.querySelectorAll('.shift-block').forEach(el => el.remove());

    const validation = runValidation(weekKey, dayKey);

    for (let u = 1; u <= TOTAL_UNITS; u++) {
        const arr = getUnitShifts(weekKey, dayKey, u);
        arr.forEach(sh => renderShiftBlock(sh, u, validation));
    }
}

function renderShiftBlock(sh, unitNum, validation) {
    const body = document.getElementById(`unit-body-${unitNum}`);
    if (!body) return;

    const staff = sh.doctorId ? getStaff(sh.doctorId) :
        (sh.dhIds && sh.dhIds[0]) ? getStaff(sh.dhIds[0]) :
            (sh.daIds && sh.daIds[0]) ? getStaff(sh.daIds[0]) : null;

    // Determine primary staff
    let primaryId = sh.doctorId || (sh.dhIds && sh.dhIds[0]) || (sh.daIds && sh.daIds[0]) || (sh.tcIds && sh.tcIds[0]);
    const primaryStaff = primaryId ? getStaff(primaryId) : null;
    const color = primaryStaff ? primaryStaff.color : '#888';

    const top = slotToPixel(sh.startSlot, TIME_START, ROW_H);
    const height = (sh.endSlot - sh.startSlot) * ROW_H;

    const el = document.createElement('div');
    el.className = 'shift-block';
    el.id = `shift-${sh.id}`;
    el.dataset.shiftId = sh.id;
    el.dataset.unit = unitNum;

    // Role class
    if (sh.doctorId) el.classList.add('role-dr');

    // Warning check
    let hasWarn = false;
    let warnMsg = '';
    if (validation) {
        if (validation.overlaps.has(sh.id)) { hasWarn = true; warnMsg = '勤務時間が重複しています'; }
        else if (validation.daWarnings.has(sh.id)) { hasWarn = true; warnMsg = 'DAが未配置です'; }
        else if (validation.drlessWarnings.has(sh.id)) { hasWarn = true; warnMsg = 'DrなしでDAが単独配置されています'; }
    }

    // 問題なし = スタッフカラー背景, 問題あり = 薄グレー背景
    if (hasWarn) {
        el.style.cssText = `
        top: ${top}px;
        height: ${Math.max(height, 20)}px;
        background: #e8e8ea;
        border-left: 3px solid #aaa;
        border-color: #ccc;
        color: #777;
      `;
    } else {
        const bg = colorWithAlpha(color, 0.18);
        el.style.cssText = `
        top: ${top}px;
        height: ${Math.max(height, 20)}px;
        background: ${bg};
        border-left: 3px solid ${color};
        border-color: ${color};
        color: ${color};
      `;
    }

    // Content
    let html = '';
    // ヘルパー：個別削除ボタン付きの名前生成
    const renderNames = (ids, roleType) => {
        if (!ids || ids.length === 0) return '';
        return ids.map(id => {
            const s = getStaff(id);
            const n = s ? s.name.split(' ')[0] : '?';
            return `<span class="assist-name-tag">${n}<span class="remove-assist" data-role="${roleType}" data-id="${id}" title="除外">×</span></span>`;
        }).join(' ');
    };

    if (sh.doctorId) {
        const dr = getStaff(sh.doctorId);
        html += `<div class="block-name">👨‍⚕️ ${dr ? dr.name : '?'}</div>`;
        html += `<div class="block-time">${slotToStr(sh.startSlot)}〜${slotToStr(sh.endSlot)}</div>`;
        if (sh.dhIds && sh.dhIds.length > 0) {
            html += `<div class="block-role">🦷 DH: ${renderNames(sh.dhIds, 'dh')}</div>`;
        }
        if (sh.daIds && sh.daIds.length > 0) {
            html += `<div class="block-role">DA: ${renderNames(sh.daIds, 'da')}</div>`;
        }
        // DA dots
        html += '<div class="da-dots">';
        for (let i = 0; i < 2; i++) {
            const filled = (sh.daIds && sh.daIds[i]) ? ' filled' : '';
            html += `<div class="da-dot${filled}" title="${sh.daIds && sh.daIds[i] ? (getStaff(sh.daIds[i]) || { name: '?' }).name : 'DA未配置'}"></div>`;
        }
        html += '</div>';
    } else if (sh.dhIds && sh.dhIds.length > 0) {
        const dh = getStaff(sh.dhIds[0]);
        html += `<div class="block-name">🦷 ${dh ? dh.name : '?'}</div>`;
        html += `<div class="block-time">${slotToStr(sh.startSlot)}〜${slotToStr(sh.endSlot)}</div>`;
        html += `<div class="block-role">DH</div>`;
        if (sh.dhIds.length > 1) { // 2人目以降のDHがいれば
            html += `<div class="block-role">追加DH: ${renderNames(sh.dhIds.slice(1), 'dh')}</div>`;
        }
        if (sh.daIds && sh.daIds.length > 0) {
            html += `<div class="block-role">DA: ${renderNames(sh.daIds, 'da')}</div>`;
        }
        html += '<div class="da-dots">';
        for (let i = 0; i < 2; i++) {
            const filled = (sh.daIds && sh.daIds[i]) ? ' filled' : '';
            html += `<div class="da-dot${filled}" title="${sh.daIds && sh.daIds[i] ? (getStaff(sh.daIds[i]) || { name: '?' }).name : 'DA未配置'}"></div>`;
        }
        html += '</div>';
    } else if (sh.daIds && sh.daIds.length > 0) {
        const da = getStaff(sh.daIds[0]);
        html += `<div class="block-name">🩺 ${da ? da.name : '?'}</div>`;
        html += `<div class="block-time">${slotToStr(sh.startSlot)}〜${slotToStr(sh.endSlot)}</div>`;
        html += `<div class="block-role">DA</div>`;
        if (sh.daIds.length > 1) {
            html += `<div class="block-role">追加DA: ${renderNames(sh.daIds.slice(1), 'da')}</div>`;
        }
        html += '<div class="da-dots">';
        for (let i = 0; i < 2; i++) {
            const filled = (sh.daIds && sh.daIds[i]) ? ' filled' : '';
            html += `<div class="da-dot${filled}" title="${sh.daIds && sh.daIds[i] ? (getStaff(sh.daIds[i]) || { name: '?' }).name : 'DA未配置'}"></div>`;
        }
        html += '</div>';
    } else if (sh.tcIds && sh.tcIds.length > 0) {
        const tc = getStaff(sh.tcIds[0]);
        html += `<div class="block-name">💁 ${tc ? tc.name : '?'}</div>`;
        html += `<div class="block-time">${slotToStr(sh.startSlot)}〜${slotToStr(sh.endSlot)}</div>`;
        html += `<div class="block-role">TC</div>`;
    }

    // 問題ありの場合、❗バッジを追加 (This is now handled by refreshValidation)

    // Resize handle
    html += '<div class="resize-handle" data-action="resize"></div>';

    el.innerHTML = html;

    // 個別削除イベントのバインド
    el.querySelectorAll('.remove-assist').forEach(btn => {
        btn.addEventListener('mousedown', (e) => {
            e.stopPropagation(); // シフト自体のクリック・ドラッグイベントを発火させない
            e.preventDefault();
            const role = btn.dataset.role;
            const staffIdToRemove = btn.dataset.id;

            if (role === 'dh' && sh.dhIds) {
                sh.dhIds = sh.dhIds.filter(id => id !== staffIdToRemove);
            } else if (role === 'da' && sh.daIds) {
                sh.daIds = sh.daIds.filter(id => id !== staffIdToRemove);
            }

            // 保存して再描画
            saveAll();
            const wk = currentWeekKey();
            const dk = currentDayKey();
            renderAllShifts(wk, dk);
            refreshValidation(wk, dk);
            // showToast('info', '削除', 'アシストを削除しました。', 2000);
        });
    });

    el.addEventListener('contextmenu', onShiftContextMenu);
    el.addEventListener('mousedown', onShiftMouseDown);

    body.appendChild(el);
}

function refreshValidation(weekKey, dayKey) {
    const v = runValidation(weekKey, dayKey);

    // Update unit headers
    for (let u = 1; u <= TOTAL_UNITS; u++) {
        const hdr = document.getElementById(`unit-header-${u}`);
        if (!hdr) continue;
        const arr = getUnitShifts(weekKey, dayKey, u);
        let hasWarn = false, hasError = false;
        arr.forEach(sh => {
            if (v.daWarnings.has(sh.id)) hasWarn = true;
            if (v.overlaps.has(sh.id)) hasError = true;
        });
        hdr.className = 'unit-header' + (hasError ? ' has-error' : hasWarn ? ' has-warning' : '');
        const unitLabel = getUnitName(u, dayKey);
        hdr.innerHTML = `<span class="unit-name-label" title="ダブルクリックで名称変更">${unitLabel}</span><span class="warn-dot"></span>`;
        hdr.addEventListener('dblclick', (e) => { e.stopPropagation(); renameUnit(u); });
    }

    // Update shift block styles & badges
    document.querySelectorAll('.shift-block').forEach(el => {
        const sid = el.dataset.shiftId;
        // Remove existing badges
        el.querySelectorAll('.shift-warn-badge').forEach(b => b.remove());

        let hasWarn = false, warnMsg = '';
        if (v.overlaps.has(sid)) { hasWarn = true; warnMsg = '勤務時間が重複しています'; }
        else if (v.daWarnings.has(sid)) { hasWarn = true; warnMsg = 'DAが未配置です'; }
        else if (v.drlessWarnings && v.drlessWarnings.has(sid)) { hasWarn = true; warnMsg = 'DrなしDA単独配置'; }

        if (hasWarn) {
            el.style.background = '#e8e8ea';
            el.style.borderLeftColor = '#aaa';
            el.style.borderColor = '#ccc';
            el.style.color = '#777';
            const badge = document.createElement('div');
            badge.className = 'shift-warn-badge';
            badge.title = warnMsg;
            badge.textContent = '❗';
            el.appendChild(badge);
        }
    });

    // Update reception warnings
    const rcWarn = v.reception;
    updateReceptionWarnings(rcWarn);
}

function buildReceptionPanel(weekKey, dayKey) {
    // 右側受付パネルは非表示のため何もしない
    return;
}

function buildReceptionChip(sid, period, weekKey, dayKey) {
    const s = getStaff(sid);
    const chip = document.createElement('div');
    chip.className = 'reception-staff-chip';
    chip.title = '右クリックで削除';
    chip.innerHTML = `<div class="chip-dot" style="background:${s ? s.color : '#888'}"></div><span>${s ? s.name.split(' ')[0] : '?'}</span>`;
    chip.addEventListener('contextmenu', e => {
        e.preventDefault();
        const rc = getDayReception(weekKey, dayKey);
        rc[period] = rc[period].filter(x => x !== sid);
        saveAll();
        buildReceptionPanel(weekKey, dayKey);
        refreshValidation(weekKey, dayKey);
    });
    return chip;
}

function updateReceptionWarnings(rcWarn) {
    // 受付パネルは非表示のため更新処理なし
}
