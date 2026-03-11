// ============================================================
// drag.js - ドラッグ＆ドロップ（スタッフ配置・シフト移動・リサイズ）
// ============================================================

// ------ スタッフカードからユニットへのドラッグ ------
function attachStaffDrag(card, staffId) {
    card.setAttribute('draggable', 'true');
    card.addEventListener('dragstart', e => {
        e.dataTransfer.setData('staffId', staffId);
        e.dataTransfer.effectAllowed = 'copy';
        card.classList.add('dragging-source');
    });
    card.addEventListener('dragend', () => card.classList.remove('dragging-source'));
}

function attachDropZones() {
    const wk = currentWeekKey();
    const dk = currentDayKey();

    document.querySelectorAll('.unit-body').forEach(body => {
        const unitNum = parseInt(body.dataset.unit);

        body.addEventListener('dragover', e => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
            body.classList.add('drag-over');
            showDropGhost(body, e, unitNum);
        });

        body.addEventListener('dragleave', e => {
            if (!body.contains(e.relatedTarget)) {
                body.classList.remove('drag-over');
                removeDropGhost(body);
            }
        });

        body.addEventListener('drop', e => {
            e.preventDefault();
            body.classList.remove('drag-over');
            removeDropGhost(body);

            const staffId = e.dataTransfer.getData('staffId');
            if (!staffId) return;

            const rect = body.getBoundingClientRect();
            const relY = e.clientY - rect.top;
            let startSlot = snapSlot(pixelToSlot(relY, TIME_START, ROW_H));
            startSlot = Math.max(TIME_START, Math.min(startSlot, TIME_END - 0.5));
            let endSlot = Math.min(startSlot + 1, TIME_END);

            dropStaffOnUnit(staffId, unitNum, startSlot, endSlot, wk, dk);
        });
    });
}

function showDropGhost(body, e, unitNum) {
    let ghost = body.querySelector('.time-ghost');
    if (!ghost) {
        ghost = document.createElement('div');
        ghost.className = 'time-ghost';
        body.appendChild(ghost);
    }
    const rect = body.getBoundingClientRect();
    const relY = e.clientY - rect.top;
    const slot = snapSlot(pixelToSlot(relY, TIME_START, ROW_H));
    const clamped = Math.max(TIME_START, Math.min(slot, TIME_END - 1));
    const top = slotToPixel(clamped, TIME_START, ROW_H);
    ghost.style.cssText = `top:${top}px; height:${ROW_H}px;`;
    ghost.textContent = `${slotToStr(clamped)}〜${slotToStr(clamped + 1)}`;
}

function removeDropGhost(body) {
    const ghost = body.querySelector('.time-ghost');
    if (ghost) ghost.remove();
}

function dropStaffOnUnit(staffId, unitNum, startSlot, endSlot, weekKey, dayKey) {
    const staff = getStaff(staffId);
    if (!staff) return;

    const existingArr = getUnitShifts(weekKey, dayKey, unitNum);

    if (staff.role === 'dr') {
        // New Dr shift
        const shift = {
            id: newShiftId(),
            startSlot, endSlot,
            doctorId: staffId,
            daIds: [],
            dhIds: [],
        };
        existingArr.push(shift);
        showToast('success', 'Dr配置完了', `${staff.name} を U${unitNum} に配置しました。DAを配置してください。`);

    } else if (staff.role === 'dh') {
        // Check if there's an overlapping Dr shift → add DH to it
        const drShift = existingArr.find(sh =>
            sh.doctorId && slotsOverlap(sh.startSlot, sh.endSlot, startSlot, endSlot)
        );
        if (drShift) {
            if (!drShift.dhIds) drShift.dhIds = [];
            if (drShift.dhIds.includes(staffId)) {
                showToast('warning', '重複', 'このDHはすでに配置されています。'); return;
            }
            drShift.dhIds.push(staffId);
            showToast('success', 'DH配置完了', `${staff.name} を U${unitNum} のDrシフトに追加しました。`);
        } else {
            // Standalone DH shift
            const shift = {
                id: newShiftId(),
                startSlot, endSlot,
                doctorId: null,
                daIds: [],
                dhIds: [staffId],
            };
            existingArr.push(shift);
            showToast('success', 'DH配置完了', `${staff.name} を U${unitNum} に配置しました。`);
        }

    } else if (staff.role === 'da') {
        // Find a Dr shift or DH shift at same time range in same unit
        const drShift = existingArr.find(sh =>
            sh.doctorId && slotsOverlap(sh.startSlot, sh.endSlot, startSlot, endSlot)
        );
        const dhShift = existingArr.find(sh =>
            sh.dhIds && sh.dhIds.length > 0 && !sh.doctorId && slotsOverlap(sh.startSlot, sh.endSlot, startSlot, endSlot)
        );
        if (drShift) {
            const check = canAddDa(drShift, staffId);
            if (!check.ok) { showToast('error', 'DA配置エラー', check.msg); return; }
            drShift.daIds.push(staffId);
            showToast('success', 'DA配置完了', `${staff.name} を U${unitNum} のDrにアシスト配置しました。`);
        } else if (dhShift) {
            if (!dhShift.daIds) dhShift.daIds = [];
            if (dhShift.daIds.length >= 2) { showToast('error', 'DA配置エラー', 'このDHシフトにはすでに2人のDAが配置されています。'); return; }
            if (dhShift.daIds.includes(staffId)) { showToast('warning', '重複', 'このDAはすでに配置されています。'); return; }
            dhShift.daIds.push(staffId);
            showToast('success', 'DA配置完了', `${staff.name} を U${unitNum} のDHにアシスト配置しました。`);
        } else {
            // Standalone DA shift
            const shift = {
                id: newShiftId(),
                startSlot, endSlot,
                doctorId: null,
                daIds: [staffId],
                dhIds: [],
            };
            existingArr.push(shift);
            showToast('warning', 'DA配置（単独）', `Dr/DHが見つからなかったため単独配置しました。`);
        }

    } else if (staff.role === 'reception') {
        // TC staff -> new shift on unit
        const shift = {
            id: newShiftId(),
            startSlot, endSlot,
            doctorId: null,
            daIds: [],
            dhIds: [],
            tcIds: [staffId],
        };
        existingArr.push(shift);
        showToast('success', 'TC配置完了', `${staff.name} を U${unitNum} に配置しました。`);
    }

    saveAll();
    renderAllShifts(weekKey, dayKey);
    refreshValidation(weekKey, dayKey);
}

// ------ シフトブロックの移動（mousedown/move/up） ------
let _drag = null;

function onShiftMouseDown(e) {
    if (e.button !== 0) return;
    const el = e.currentTarget;
    const action = e.target.dataset.action;

    if (action === 'resize') {
        startResize(e, el);
        return;
    }

    e.preventDefault();
    const shiftId = el.dataset.shiftId;
    const unitNum = parseInt(el.dataset.unit);
    const body = document.getElementById(`unit-body-${unitNum}`);
    const bodyRect = body.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    const offsetY = e.clientY - elRect.top;

    const found = findShiftById(shiftId);
    if (!found) return;

    _drag = {
        type: 'move',
        shiftId, unitNum,
        shift: found.shift,
        weekKey: found.weekKey,
        dayKey: found.dayKey,
        offsetY,
        el,
        originalUnit: unitNum,
    };

    el.classList.add('dragging');
    document.addEventListener('mousemove', onDragMouseMove);
    document.addEventListener('mouseup', onDragMouseUp);
}

function onDragMouseMove(e) {
    if (!_drag) return;
    if (_drag.type === 'move') {
        _drag.el.style.opacity = '0.5';
        // Show hover target
    } else if (_drag.type === 'resize') {
        const body = document.getElementById(`unit-body-${_drag.unitNum}`);
        if (!body) return;
        const bodyRect = body.getBoundingClientRect();
        const relY = e.clientY - bodyRect.top;
        let endSlot = snapSlot(pixelToSlot(relY, TIME_START, ROW_H));
        endSlot = Math.max(_drag.shift.startSlot + 0.5, Math.min(endSlot, TIME_END));
        _drag.shift.endSlot = endSlot;
        // Reposition element
        const el = _drag.el;
        const h = (endSlot - _drag.shift.startSlot) * ROW_H;
        el.style.height = `${Math.max(h, 20)}px`;
        el.querySelector('.block-time') && (el.querySelector('.block-time').textContent =
            `${slotToStr(_drag.shift.startSlot)}〜${slotToStr(endSlot)}`);
    }
}

function onDragMouseUp(e) {
    if (!_drag) return;
    document.removeEventListener('mousemove', onDragMouseMove);
    document.removeEventListener('mouseup', onDragMouseUp);

    if (_drag.type === 'move') {
        _drag.el.classList.remove('dragging');
        _drag.el.style.opacity = '';

        // Find target unit under mouse
        let targetUnit = _drag.originalUnit;
        document.querySelectorAll('.unit-body').forEach(body => {
            const rect = body.getBoundingClientRect();
            if (e.clientX >= rect.left && e.clientX <= rect.right &&
                e.clientY >= rect.top && e.clientY <= rect.bottom) {
                targetUnit = parseInt(body.dataset.unit);
            }
        });

        // Find unit body for target
        const targetBody = document.getElementById(`unit-body-${targetUnit}`);
        if (targetBody) {
            const rect = targetBody.getBoundingClientRect();
            const relY = e.clientY - rect.top - _drag.offsetY;
            let startSlot = snapSlot(pixelToSlot(relY, TIME_START, ROW_H));
            startSlot = Math.max(TIME_START, Math.min(startSlot, TIME_END - 0.5));
            const dur = _drag.shift.endSlot - _drag.shift.startSlot;
            const endSlot = Math.min(startSlot + dur, TIME_END);

            // Move shift between units
            if (targetUnit !== _drag.originalUnit) {
                const origArr = getUnitShifts(_drag.weekKey, _drag.dayKey, _drag.originalUnit);
                const idx = origArr.findIndex(s => s.id === _drag.shiftId);
                if (idx >= 0) origArr.splice(idx, 1);
                const targetArr = getUnitShifts(_drag.weekKey, _drag.dayKey, targetUnit);
                _drag.shift.startSlot = startSlot;
                _drag.shift.endSlot = endSlot;
                targetArr.push(_drag.shift);
            } else {
                _drag.shift.startSlot = startSlot;
                _drag.shift.endSlot = endSlot;
            }
        }

        saveAll();
        renderAllShifts(_drag.weekKey, _drag.dayKey);
        refreshValidation(_drag.weekKey, _drag.dayKey);

    } else if (_drag.type === 'resize') {
        saveAll();
        renderAllShifts(_drag.weekKey, _drag.dayKey);
        refreshValidation(_drag.weekKey, _drag.dayKey);
    }

    _drag = null;
}

function startResize(e, el) {
    e.preventDefault();
    const shiftId = el.dataset.shiftId;
    const unitNum = parseInt(el.dataset.unit);
    const found = findShiftById(shiftId);
    if (!found) return;

    _drag = {
        type: 'resize',
        shiftId, unitNum,
        shift: found.shift,
        weekKey: found.weekKey,
        dayKey: found.dayKey,
        el,
    };

    document.addEventListener('mousemove', onDragMouseMove);
    document.addEventListener('mouseup', onDragMouseUp);
}

// ------ コンテキストメニュー ------
let _ctxShift = null;

function onShiftContextMenu(e) {
    e.preventDefault();
    const shiftId = e.currentTarget.dataset.shiftId;
    const unitNum = parseInt(e.currentTarget.dataset.unit);
    const found = findShiftById(shiftId);
    if (!found) return;

    _ctxShift = { shiftId, unitNum, found };
    const menu = document.getElementById('context-menu');
    menu.style.left = e.clientX + 'px';
    menu.style.top = e.clientY + 'px';
    menu.classList.add('open');
}

function closeContextMenu() {
    const menu = document.getElementById('context-menu');
    if (menu) menu.classList.remove('open');
}

function setupContextMenu() {
    document.addEventListener('click', closeContextMenu);

    document.getElementById('ctx-copy')?.addEventListener('click', () => {
        if (!_ctxShift) return;
        State.clipboard = JSON.parse(JSON.stringify(_ctxShift.found.shift));
        showToast('info', 'コピー', 'シフトをクリップボードに保存しました。');
        closeContextMenu();
    });

    document.getElementById('ctx-delete')?.addEventListener('click', () => {
        if (!_ctxShift) return;
        const { weekKey, dayKey, unitNum } = _ctxShift.found;
        removeShift(weekKey, dayKey, unitNum, _ctxShift.shiftId);
        saveAll();
        renderAllShifts(weekKey, dayKey);
        refreshValidation(weekKey, dayKey);
        showToast('success', '削除', 'シフトを削除しました。');
        closeContextMenu();
    });

    document.getElementById('ctx-edit')?.addEventListener('click', () => {
        if (!_ctxShift) return;
        openShiftEditModal(_ctxShift.found.shift, _ctxShift.unitNum);
        closeContextMenu();
    });

    document.getElementById('ctx-paste')?.addEventListener('click', () => {
        if (!State.clipboard) { showToast('warning', 'ペースト', 'クリップボードにデータがありません。'); return; }
        const wk = currentWeekKey();
        const dk = currentDayKey();
        const newShift = JSON.parse(JSON.stringify(State.clipboard));
        newShift.id = newShiftId();
        if (_ctxShift) {
            getUnitShifts(wk, dk, _ctxShift.unitNum).push(newShift);
        }
        saveAll();
        renderAllShifts(wk, dk);
        refreshValidation(wk, dk);
        showToast('success', 'ペースト', 'シフトを貼り付けました。');
        closeContextMenu();
    });
}
