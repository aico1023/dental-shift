let currentRMonthlyYear = new Date().getFullYear();
let currentRMonthlyMonth = new Date().getMonth() + 1;
let currentRMonthlyRole = 'dr';

function openRoleMonthlyModal(year, month, role) {
    if (!year || !month) {
        const today = new Date();
        year = today.getFullYear();
        month = today.getMonth() + 1;
    }
    currentRMonthlyYear = year;
    currentRMonthlyMonth = month;
    
    if (role) {
        currentRMonthlyRole = role;
    }
    
    const select = document.getElementById('role-monthly-select');
    if (select) {
        select.value = currentRMonthlyRole;
    }
    
    document.getElementById('role-monthly-title').textContent = `${year}年${month}月 職種別月間表`;
    
    const container = document.getElementById('role-monthly-table-container');
    container.innerHTML = '';
    
    // 対象の職種のスタッフを取得
    const staffList = State.staff.filter(s => s.role === currentRMonthlyRole).sort((a, b) => (a.order || 0) - (b.order || 0));
    
    if (staffList.length === 0) {
        container.innerHTML = '<div style="padding:20px; text-align:center; color:#64748b;">この職種のスタッフは登録されていません。</div>';
        openModal('modal-role-monthly');
        return;
    }

    const table = document.createElement('table');
    table.className = 'monthly-table';
    table.style.width = '100%';
    table.style.minWidth = `${100 + staffList.length * 150}px`; // 幅の調整
    table.style.tableLayout = 'fixed';

    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    
    const thDate = document.createElement('th');
    thDate.textContent = '日付';
    thDate.style.width = '100px';
    thDate.style.textAlign = 'center';
    thDate.style.fontSize = '16px';
    thDate.style.background = '#f8fafc';
    thDate.style.color = '#64748b';
    thDate.style.position = 'sticky';
    thDate.style.left = '0';
    thDate.style.zIndex = '10';
    headerRow.appendChild(thDate);
    
    staffList.forEach(s => {
        const th = document.createElement('th');
        th.innerHTML = `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${s.color};margin-right:4px;"></span>${s.name.split(' ').pop()}`;
        th.style.textAlign = 'center';
        th.style.fontSize = '16px';
        th.style.background = '#f8fafc';
        th.style.color = '#334155';
        headerRow.appendChild(th);
    });
    
    thead.appendChild(headerRow);
    table.appendChild(thead);
    
    const tbody = document.createElement('tbody');
    
    const daysInMonth = new Date(year, month, 0).getDate();
    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const dateObj = new Date(year, month - 1, day);
        const dayIdx = dateObj.getDay();
        const hName = getHolidayName(dateStr);
        const targetWk = weekKeyFromDate(getWeekStart(dateObj));
        const dk = dayKeyFromDate(dateObj);
        
        const tr = document.createElement('tr');
        
        const tdDate = document.createElement('td');
        tdDate.style.textAlign = 'center';
        tdDate.style.padding = '8px';
        tdDate.style.borderBottom = '1px solid #e2e8f0';
        tdDate.style.position = 'sticky';
        tdDate.style.left = '0';
        tdDate.style.background = '#fff';
        tdDate.style.zIndex = '5';
        
        let dayColor = 'color: #334155;';
        if (hName || dayIdx === 0) dayColor = 'color: #ef4444;';
        else if (dayIdx === 6) dayColor = 'color: #3b82f6;';

        tdDate.innerHTML = `<div style="${dayColor} font-weight:700; font-size:16px;">${day}日<span style="font-size:12px; font-weight:normal; margin-left:4px;">(${DAY_NAMES[dayIdx]})</span></div>`;
        if (hName) tdDate.innerHTML += `<div style="font-size:10px; color:#ef4444; font-weight:700; margin-top:2px; background:rgba(239,68,68,0.1); padding:2px 4px; border-radius:4px; display:inline-block; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:80px;">${hName}</div>`;
        tr.appendChild(tdDate);
        
        staffList.forEach(staff => {
            const tdInfo = document.createElement('td');
            tdInfo.style.padding = '8px';
            tdInfo.style.borderBottom = '1px solid #e2e8f0';
            tdInfo.style.textAlign = 'center';
            tdInfo.style.verticalAlign = 'middle';
            if (hName) tdInfo.style.background = 'rgba(255, 235, 238, 0.3)';
            else if (dayIdx === 0) tdInfo.style.background = 'rgba(255, 235, 238, 0.15)';
            else if (dayIdx === 6) tdInfo.style.background = 'rgba(235, 245, 255, 0.3)';
            
            const leaveVal = getLeaveRecord(targetWk, staff.id, dk);
            let hasLeave = false;
            
            if (leaveVal && leaveVal !== 'none' && leaveVal !== 'other-vibshutu') {
                hasLeave = true;
                let leaveText = '';
                let leaveBg = '#f1f5f9';
                let leaveColor = '#333';
                if (leaveVal === 'paid') { leaveText = '有給休暇'; leaveBg = '#fef3c7'; leaveColor = '#d97706'; }
                else if (leaveVal === 'happy') { leaveText = 'ハッピーマンデー'; leaveBg = '#e0e7ff'; leaveColor = '#4338ca'; }
                else if (leaveVal === 'other-vibkyuu') { leaveText = '休暇'; leaveBg = '#f3f4f6'; leaveColor = '#4b5563'; }
                else if (leaveVal === 'comz-vibshutu') { leaveText = '振出'; leaveBg = '#dcfce7'; leaveColor = '#15803d'; }
                
                tdInfo.innerHTML = `<div style="display:inline-block; padding:4px 8px; border-radius:6px; background:${leaveBg}; color:${leaveColor}; font-weight:700; font-size:14px; border:1px solid ${leaveColor}40;">${leaveText}</div>`;
            }
            
            if (!hasLeave) {
                let shiftFound = false;
                let startSlot = 999;
                let endSlot = -1;
                
                for (let u = 1; u <= TOTAL_UNITS; u++) {
                    const arr = getUnitShifts(targetWk, dk, u);
                    arr.forEach(sh => {
                        let isAssigned = false;
                        if (staff.role === 'dr' && sh.doctorId === staff.id) isAssigned = true;
                        if (staff.role === 'da' && sh.daIds && sh.daIds.includes(staff.id)) isAssigned = true;
                        if (staff.role === 'dh' && sh.dhIds && sh.dhIds.includes(staff.id)) isAssigned = true;
                        if (staff.role === 'reception' && sh.tcIds && sh.tcIds.includes(staff.id)) isAssigned = true;
                        
                        if (isAssigned) {
                            shiftFound = true;
                            startSlot = Math.min(startSlot, sh.startSlot);
                            endSlot = Math.max(endSlot, sh.endSlot);
                        }
                    });
                }
                
                if (shiftFound) {
                    let timeText = '';
                    if (startSlot === 9 && endSlot === 20) {
                        timeText = '9:00〜20:00';
                    } else if (startSlot === 9) {
                        timeText = `〜${slotToStr(endSlot)}`;
                    } else if (endSlot === 20) {
                        timeText = `${slotToStr(startSlot)}〜`;
                    } else {
                        timeText = `${slotToStr(startSlot)}-${slotToStr(endSlot)}`;
                    }
                    
                    const bg = colorWithAlpha(staff.color, 0.12);
                    const border = colorWithAlpha(staff.color, 0.3);
                    
                    tdInfo.innerHTML = `<div style="display:inline-block; padding:4px 8px; border-radius:6px; background:${bg}; border:1px solid ${border}; font-size:14px; font-weight:700; color:#334155;">
                                           ${timeText}
                                         </div>`;
                } else {
                    if (leaveVal === 'other-vibshutu') {
                        tdInfo.innerHTML = `<span style="color:#64748b; font-size:12px;">(出勤)</span>`;
                    } else if (!hName && dayIdx !== 0 && dayIdx !== 6) {
                        tdInfo.innerHTML = `<span style="color:#cbd5e1; font-size:14px;">-</span>`;
                    }
                }
            }
            tr.appendChild(tdInfo);
        });
        
        tbody.appendChild(tr);
    }
    
    table.appendChild(tbody);
    container.appendChild(table);
    
    openModal('modal-role-monthly');
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('btn-role-monthly-prev')?.addEventListener('click', () => {
        let y = currentRMonthlyYear;
        let m = currentRMonthlyMonth - 1;
        if (m < 1) { m = 12; y--; }
        openRoleMonthlyModal(y, m, currentRMonthlyRole);
    });

    document.getElementById('btn-role-monthly-next')?.addEventListener('click', () => {
        let y = currentRMonthlyYear;
        let m = currentRMonthlyMonth + 1;
        if (m > 12) { m = 1; y++; }
        openRoleMonthlyModal(y, m, currentRMonthlyRole);
    });

    document.getElementById('role-monthly-select')?.addEventListener('change', (e) => {
        openRoleMonthlyModal(currentRMonthlyYear, currentRMonthlyMonth, e.target.value);
    });
});
