// ============================================================
// holidays.js - 日本の国民の祝日計算
// ============================================================

// n番目の曜日を返す（weekday: 0=日〜6=土）
function getNthWeekday(year, month, n, weekday) {
    const d = new Date(year, month - 1, 1);
    let count = 0;
    while (d.getMonth() === month - 1) {
        if (d.getDay() === weekday) {
            count++;
            if (count === n) return new Date(d);
        }
        d.setDate(d.getDate() + 1);
    }
    return null;
}

// 春分の日（近似式: 2000〜2099年対応）
function getVernalEquinox(year) {
    const day = Math.floor(20.8431 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
    return new Date(year, 2, day);
}

// 秋分の日（近似式: 2000〜2099年対応）
function getAutumnalEquinox(year) {
    const day = Math.floor(23.2488 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
    return new Date(year, 8, day);
}

// 日付 → "YYYY-MM-DD"
function dateToKey(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// "YYYY-MM-DD" → ローカル時刻の Date（UTC解釈によるずれを防ぐ）
function parseLocalDate(key) {
    const [y, m, d] = key.split('-').map(Number);
    return new Date(y, m - 1, d);
}

// 指定年の祝日マップを計算 { "YYYY-MM-DD": "祝日名" }
function calcHolidays(year) {
    const holidays = {};

    const add = (d, name) => {
        if (d) holidays[dateToKey(d)] = name;
    };

    // 固定祝日
    add(new Date(year, 0, 1), '元日');
    add(new Date(year, 1, 11), '建国記念の日');
    add(new Date(year, 1, 23), '天皇誕生日');
    add(getVernalEquinox(year), '春分の日');
    add(new Date(year, 3, 29), '昭和の日');
    add(new Date(year, 4, 3), '憲法記念日');
    add(new Date(year, 4, 4), 'みどりの日');
    add(new Date(year, 4, 5), 'こどもの日');
    add(new Date(year, 7, 11), '山の日');
    add(getAutumnalEquinox(year), '秋分の日');
    add(new Date(year, 10, 3), '文化の日');
    add(new Date(year, 10, 23), '勤労感謝の日');

    // ハッピーマンデー
    add(getNthWeekday(year, 1, 2, 1), '成人の日');       // 1月第2月曜
    add(getNthWeekday(year, 7, 3, 1), '海の日');         // 7月第3月曜
    add(getNthWeekday(year, 9, 3, 1), '敬老の日');       // 9月第3月曜
    add(getNthWeekday(year, 10, 2, 1), 'スポーツの日');   // 10月第2月曜

    // 振替休日: 祝日が日曜なら翌月曜（または翌々日が祝日でなければ翌月曜）
    const keys = Object.keys(holidays).sort();
    const substitutes = {};
    keys.forEach(key => {
        const d = parseLocalDate(key);
        if (d.getDay() === 0) { // 日曜
            // 翌日以降で祝日でもなく月〜土の最初の日
            const next = new Date(d);
            next.setDate(next.getDate() + 1);
            while (next.getDay() === 0 || holidays[dateToKey(next)] || substitutes[dateToKey(next)]) {
                next.setDate(next.getDate() + 1);
            }
            substitutes[dateToKey(next)] = '振替休日';
        }
    });
    Object.assign(holidays, substitutes);

    // 国民の休日: 祝日と祝日に挟まれた平日（日曜でない）
    // 主にゴールデンウィークの5/4→みどりの日で制度化済みだが念のため
    const allKeys = Object.keys(holidays).sort();
    const sandwiched = {};
    allKeys.forEach(key => {
        const d = parseLocalDate(key);
        const prev = new Date(d); prev.setDate(prev.getDate() - 1);
        const next = new Date(d); next.setDate(next.getDate() + 1);
        const prevKey = dateToKey(prev);
        const nextKey = dateToKey(next);
        if (!holidays[prevKey] && !sandwiched[prevKey] && prev.getDay() !== 0) {
            const prevprev = new Date(prev); prevprev.setDate(prevprev.getDate() - 1);
            if (holidays[dateToKey(prevprev)] || sandwiched[dateToKey(prevprev)]) {
                // prevprev=祝日, prev=平日, key=祝日 → prev が国民の休日
                sandwiched[prevKey] = '国民の休日';
            }
        }
    });
    Object.assign(holidays, sandwiched);

    return holidays;
}

// キャッシュ
const _holidayCache = {};
function getHolidaysForYear(year) {
    if (!_holidayCache[year]) _holidayCache[year] = calcHolidays(year);
    return _holidayCache[year];
}

// 主要公開API: 日付文字列 "YYYY-MM-DD" → 祝日名 or null
function getHolidayName(dateStr) {
    const year = parseInt(dateStr.slice(0, 4));
    return getHolidaysForYear(year)[dateStr] || null;
}

// Date オブジェクト版
function getHolidayNameFromDate(d) {
    return getHolidayName(dateToKey(d));
}
