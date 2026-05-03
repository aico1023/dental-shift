// ============================================================
// validation.js - 自動チェック・バリデーション
// ============================================================

// 時間重複チェック (slot範囲の重複)
function slotsOverlap(s1, e1, s2, e2) {
    return s1 < e2 && e1 > s2;
}

// 同一スタッフが同日に複数シフトと重複しているか
function checkStaffOverlaps(weekKey, dayKey) {
    const overlaps = new Set(); // shiftId
    const dayShifts = getDayShifts(weekKey, dayKey);

    // Gather all shifts with staff info
    const allShifts = [];
    for (let u = 1; u <= TOTAL_UNITS; u++) {
        const arr = getUnitShifts(weekKey, dayKey, u);
        arr.forEach(sh => {
            const staffIds = [sh.doctorId, ...(sh.daIds || []), ...(sh.dhIds || []), ...(sh.tcIds || [])].filter(Boolean);
            staffIds.forEach(sid => {
                allShifts.push({ shiftId: sh.id, staffId: sid, start: sh.startSlot, end: sh.endSlot });
            });
        });
    }

    for (let i = 0; i < allShifts.length; i++) {
        for (let j = i + 1; j < allShifts.length; j++) {
            if (allShifts[i].staffId === allShifts[j].staffId) {
                if (slotsOverlap(allShifts[i].start, allShifts[i].end, allShifts[j].start, allShifts[j].end)) {
                    overlaps.add(allShifts[i].shiftId);
                    overlaps.add(allShifts[j].shiftId);
                }
            }
        }
    }
    return overlaps; // Set of shiftIds that have overlap
}

// アシスト不足チェック: DrがいるのにDA・DH両方が空のシフト
function checkDaWarnings(weekKey, dayKey) {
    const warnings = new Set();
    for (let u = 1; u <= TOTAL_UNITS; u++) {
        const arr = getUnitShifts(weekKey, dayKey, u);
        arr.forEach(sh => {
            const hasAssist = (sh.daIds && sh.daIds.length > 0) || (sh.dhIds && sh.dhIds.length > 0);
            if (sh.doctorId && !hasAssist) {
                warnings.add(sh.id);
            }
        });
    }
    return warnings;
}

// 受付不足チェック
function checkReceptionWarnings(weekKey, dayKey) {
    const rc = getDayReception(weekKey, dayKey);
    return {
        amShort: rc.am.length < 2,
        pmShort: rc.pm.length < 2,
        amCount: rc.am.length,
        pmCount: rc.pm.length,
    };
}

// Drなしユニット稼働チェック: dhのみがいる場合は正常、daのみはあり得ないが
function checkDrlessWarnings(weekKey, dayKey) {
    const warns = new Set(); // shiftIds
    for (let u = 1; u <= TOTAL_UNITS; u++) {
        const arr = getUnitShifts(weekKey, dayKey, u);
        arr.forEach(sh => {
            if (!sh.doctorId && (sh.daIds && sh.daIds.length > 0)) {
                // DAがいるのにDrなし
                warns.add(sh.id);
            }
        });
    }
    return warns;
}

// 休暇との重複チェック: 休み（有給・HM・その他休暇）なのにシフトが入っている
function checkLeaveConflicts(weekKey, dayKey) {
    const conflicts = new Set(); // shiftId
    const dayShifts = getDayShifts(weekKey, dayKey);
    const leaveTypesToFlag = ['paid', 'happy', 'other-vibkyuu', 'normal-leave'];

    for (let u = 1; u <= TOTAL_UNITS; u++) {
        const arr = getUnitShifts(weekKey, dayKey, u);
        arr.forEach(sh => {
            const staffIds = [sh.doctorId, ...(sh.daIds || []), ...(sh.dhIds || []), ...(sh.tcIds || [])].filter(Boolean);
            staffIds.forEach(sid => {
                const leaveType = getLeaveRecord(weekKey, sid, dayKey);
                if (leaveType && leaveTypesToFlag.includes(leaveType)) {
                    conflicts.add(sh.id);
                }
            });
        });
    }

    // 受付シフトもチェック
    const rc = getDayReception(weekKey, dayKey);
    const rcStaff = [...rc.am, ...rc.pm];
    const rcConflicts = new Set(); // staffId
    rcStaff.forEach(sid => {
        const leaveType = getLeaveRecord(weekKey, sid, dayKey);
        if (leaveType && leaveTypesToFlag.includes(leaveType)) {
            rcConflicts.add(sid);
        }
    });

    return { shiftConflicts: conflicts, receptionConflicts: rcConflicts };
}

// 出勤（振出）なのにシフトがないチェック
function checkAttendanceRequirements(weekKey, dayKey) {
    const missingShiftStaff = new Set(); // staffId
    const attendanceTypes = ['working-day', 'comz-vibshutu', 'other-vibshutu'];

    // 振出設定されているスタッフを抽出
    State.staff.forEach(s => {
        const leaveType = getLeaveRecord(weekKey, s.id, dayKey);
        if (leaveType && attendanceTypes.includes(leaveType)) {
            // シフトに入っているか確認
            let hasShift = false;
            // ユニットシフト
            for (let u = 1; u <= TOTAL_UNITS; u++) {
                const arr = getUnitShifts(weekKey, dayKey, u);
                const isScheduled = arr.some(sh => 
                    String(sh.doctorId) === String(s.id) || 
                    (sh.daIds && sh.daIds.map(String).includes(String(s.id))) || 
                    (sh.dhIds && sh.dhIds.map(String).includes(String(s.id))) || 
                    (sh.tcIds && sh.tcIds.map(String).includes(String(s.id)))
                );
                if (isScheduled) { hasShift = true; break; }
            }
            // 受付シフト
            if (!hasShift) {
                const rc = getDayReception(weekKey, dayKey);
                if (rc.am.map(String).includes(String(s.id)) || rc.pm.map(String).includes(String(s.id))) hasShift = true;
            }

            if (!hasShift) {
                missingShiftStaff.add(s.id);
            }
        }
    });

    return missingShiftStaff;
}

// 総合バリデーション結果
function runValidation(weekKey, dayKey) {
    const leaveRes = checkLeaveConflicts(weekKey, dayKey);
    return {
        overlaps: checkStaffOverlaps(weekKey, dayKey),
        daWarnings: checkDaWarnings(weekKey, dayKey),
        drlessWarnings: checkDrlessWarnings(weekKey, dayKey),
        reception: checkReceptionWarnings(weekKey, dayKey),
        leaveConflicts: leaveRes.shiftConflicts,
        receptionLeaveConflicts: leaveRes.receptionConflicts,
        missingAttendance: checkAttendanceRequirements(weekKey, dayKey),
    };
}

// ---- DA追加チェック ----
// Drのいるシフトに対してDAを追加できるか
function canAddDa(shift, staffId) {
    if (!shift.doctorId) {
        return { ok: false, msg: 'Drが配置されていません。DA配置にはDrが必要です。' };
    }
    if (shift.daIds && shift.daIds.length >= 2) {
        return { ok: false, msg: 'DAはユニット1シフトに最大2人まで配置できます。' };
    }
    if (shift.daIds && shift.daIds.includes(staffId)) {
        return { ok: false, msg: 'このスタッフはすでに配置されています。' };
    }
    return { ok: true };
}

// ---- 集計 ----
function aggregateWeek(weekKey) {
    const days = getDayDates(State.currentWeekStart);

    // Personal hours
    const personalHours = {}; // staffId -> { total, days: {dayKey: hours} }
    State.staff.forEach(s => { personalHours[s.id] = { total: 0, days: {} }; });

    // Unit hours per unit
    const unitHours = {}; // u1...u9 -> hours

    // Role counts per day
    const roleCounts = {}; // dayKey -> { dr:0, dh:0, da:0, reception:0 }

    days.forEach(d => {
        const dk = dayKeyFromDate(d);

        // 職種別人数（日別）はユニークなスタッフ数としてカウント
        const roleSets = { dr: new Set(), dh: new Set(), da: new Set(), reception: new Set() };

        for (let u = 1; u <= TOTAL_UNITS; u++) {
            const arr = getUnitShifts(weekKey, dk, u);
            const uk = 'u' + u;
            if (!unitHours[uk]) unitHours[uk] = 0;
            arr.forEach(sh => {
                let dur = sh.endSlot - sh.startSlot;

                // 13:00〜14:00の休憩時間を除外
                if (typeof BREAK_START !== 'undefined' && typeof BREAK_END !== 'undefined') {
                    const overlapStart = Math.max(sh.startSlot, BREAK_START);
                    const overlapEnd = Math.min(sh.endSlot, BREAK_END);
                    if (overlapEnd > overlapStart) {
                        dur -= (overlapEnd - overlapStart);
                    }
                }

                unitHours[uk] += dur;

                const addHours = (sid) => {
                    if (!sid) return;
                    if (!personalHours[sid]) personalHours[sid] = { total: 0, days: {} };
                    personalHours[sid].total += dur;
                    if (!personalHours[sid].days[dk]) personalHours[sid].days[dk] = 0;
                    personalHours[sid].days[dk] += dur;
                };

                if (sh.doctorId) { addHours(sh.doctorId); roleSets.dr.add(sh.doctorId); }
                (sh.daIds || []).forEach(id => { addHours(id); roleSets.da.add(id); });
                (sh.dhIds || []).forEach(id => { addHours(id); roleSets.dh.add(id); });
                (sh.tcIds || []).forEach(id => { addHours(id); roleSets.reception.add(id); });
            });
        }

        // Reception
        const rc = getDayReception(weekKey, dk);
        const rcSet = new Set([...rc.am, ...rc.pm]);
        rcSet.forEach(id => roleSets.reception.add(id));

        rcSet.forEach(sid => {
            if (!personalHours[sid]) personalHours[sid] = { total: 0, days: {} };
            // Reception: count as 4h AM + 4h PM (simplified)
            const amH = rc.am.includes(sid) ? 4 : 0;
            const pmH = rc.pm.includes(sid) ? 4 : 0;
            const h = amH + pmH;
            personalHours[sid].total += h;
            if (!personalHours[sid].days[dk]) personalHours[sid].days[dk] = 0;
            personalHours[sid].days[dk] += h;
        });

        // Set `.size` values into roleCounts
        const dayIdx = d.getDay();
        roleCounts[dk] = {
            dr: roleSets.dr.size,
            dh: roleSets.dh.size,
            da: roleSets.da.size,
            reception: roleSets.reception.size
        };
    });

    // Day totals
    const dayTotals = {};
    days.forEach(d => {
        const dk = dayKeyFromDate(d);
        let tot = 0;
        State.staff.forEach(s => {
            if (personalHours[s.id] && personalHours[s.id].days[dk]) {
                tot += personalHours[s.id].days[dk];
            }
        });
        dayTotals[dk] = tot;
    });

    return { personalHours, unitHours, roleCounts, dayTotals, days };
}
