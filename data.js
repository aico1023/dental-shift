// ============================================================
// data.js - State management & LocalStorage
// ============================================================

const COLORS = [
  '#4f7ef8', '#7c5cfc', '#ec4899', '#ef4444',
  '#f59e0b', '#10b981', '#06b6d4', '#84cc16',
  '#f97316', '#6366f1', '#14b8a6', '#8b5cf6',
  '#e11d48', '#0ea5e9', '#22c55e', '#64748b',
];

const ROLES = {
  dr: { label: 'Dr', badge: 'badge-dr' },
  dh: { label: 'DH', badge: 'badge-dh' },
  da: { label: 'DA', badge: 'badge-da' },
  reception: { label: 'TC', badge: 'badge-reception' },
};

// ---- Default sample staff ----
const DEFAULT_STAFF = [
  { id: 's1', name: '田中 一郎', role: 'dr', team: 'A', color: '#4f7ef8', employment: 'fulltime', assistCapacity: 1 },
  { id: 's2', name: '鈴木 花子', role: 'dr', team: 'B', color: '#7c5cfc', employment: 'fulltime', assistCapacity: 1 },
  { id: 's3', name: '佐藤 次郎', role: 'dr', team: 'A', color: '#ec4899', employment: 'parttime', assistCapacity: 1 },
  { id: 's4', name: '山田 さくら', role: 'dh', team: 'A', color: '#10b981', employment: 'fulltime', assistCapacity: 1 },
  { id: 's5', name: '中村 あい', role: 'dh', team: 'B', color: '#06b6d4', employment: 'fulltime', assistCapacity: 1 },
  { id: 's6', name: '伊藤 みく', role: 'dh', team: 'A', color: '#14b8a6', employment: 'parttime', assistCapacity: 1 },
  { id: 's7', name: '渡辺 りな', role: 'da', team: 'A', color: '#f59e0b', employment: 'fulltime', assistCapacity: 2 },
  { id: 's8', name: '小林 かな', role: 'da', team: 'B', color: '#f97316', employment: 'fulltime', assistCapacity: 2 },
  { id: 's9', name: '加藤 ゆい', role: 'da', team: 'A', color: '#84cc16', employment: 'parttime', assistCapacity: 1 },
  { id: 's10', name: '吉田 まお', role: 'da', team: 'B', color: '#22c55e', employment: 'fulltime', assistCapacity: 2 },
  { id: 's11', name: '山口 るり', role: 'reception', team: 'A', color: '#8b5cf6', employment: 'fulltime', assistCapacity: 1 },
  { id: 's12', name: '松本 あや', role: 'reception', team: 'B', color: '#6366f1', employment: 'fulltime', assistCapacity: 1 },
  { id: 's13', name: '井上 ひな', role: 'reception', team: 'A', color: '#e11d48', employment: 'parttime', assistCapacity: 1 },
];

// ---- App State ----
let TOTAL_UNITS = 11;
const State = {
  currentWeekStart: null,    // Date (Monday)
  currentWeekOffset: 0,      // weeks from reference
  currentDayIndex: 0,        // 0=Mon...6=Sun
  staff: [],
  // weekShifts[weekKey][dayKey][unitKey] = [shiftObj, ...]
  weekShifts: {},
  // receptionShifts[weekKey][dayKey] = { am: [staffIds], pm: [staffIds] }
  receptionShifts: {},
  templates: {},             // name -> { shifts, reception }
  clipboard: null,           // copied shift
  // unitNames[dayKey][unitNum] = string  (日ごとにユニット名を管理)
  unitNames: {},
  // leaveRecords[weekKey][staffId][dayKey] = 'paid' | 'substitute' | undefined
  leaveRecords: {},
};

// ---- Week helpers ----
function getMonday(d) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = (day === 0) ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function _localDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function weekKeyFromDate(monday) {
  return _localDateStr(monday);
}

function dayKeyFromDate(d) {
  return _localDateStr(d);
}

function getDayDates(monday) {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(d.getDate() + i);
    return d;
  });
}

function formatWeekLabel(monday) {
  const end = new Date(monday);
  end.setDate(end.getDate() + 6);
  const fmt = d => `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
  return `${fmt(monday)} 〜 ${fmt(end)}`;
}

function formatDate(d) {
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

const DAY_NAMES = ['月', '火', '水', '木', '金', '土', '日'];

// ---- Shift ID generator ----
let _shiftIdCounter = Date.now();
function newShiftId() { return 'sh_' + (++_shiftIdCounter); }
function newStaffId() { return 'st_' + (++_shiftIdCounter); }

// ---- Time constants (must be declared before helper functions) ----
const TIME_START = 9;
const TIME_END = 20;
const BREAK_START = 13;   // 昼休み開始
const BREAK_END = 14;   // 昼休み終了
const BREAK_H = 60;   // 昼休み視覚的高さ(px) ※13:00〜14:00の1時間分 = ROW_H と同じ値にすること（28に戻すとバグ再発）
const ROW_H = 60;   // px per hour

// ---- Time helpers ----
// timeSlot: number like 9.0, 9.5, 10.0...
function timeToSlot(h, m) { return h + m / 60; }
function slotToStr(slot) {
  const h = Math.floor(slot);
  const m = Math.round((slot - h) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// 分割タイムライン: 昼休み(BREAK_START〜BREAK_END)をスキップして座標変換
function slotToPixel(slot) {
  if (slot <= BREAK_START) {
    return (slot - TIME_START) * ROW_H;
  } else if (slot >= BREAK_END) {
    return (BREAK_START - TIME_START) * ROW_H + BREAK_H + (slot - BREAK_END) * ROW_H;
  } else {
    return (BREAK_START - TIME_START) * ROW_H;
  }
}
function pixelToSlot(px) {
  const amH = (BREAK_START - TIME_START) * ROW_H;
  if (px <= amH) {
    return TIME_START + px / ROW_H;
  } else if (px <= amH + BREAK_H) {
    return BREAK_START;
  } else {
    return BREAK_END + (px - amH - BREAK_H) / ROW_H;
  }
}
function totalTimelineHeight() {
  return (BREAK_START - TIME_START) * ROW_H + BREAK_H + (TIME_END - BREAK_END) * ROW_H;
}
function snapSlot(slot, step = 0.5) {
  const snapped = Math.round(slot / step) * step;
  if (snapped > BREAK_START && snapped < BREAK_END) {
    return slot < (BREAK_START + BREAK_END) / 2 ? BREAK_START : BREAK_END;
  }
  return snapped;
}

// ---- LocalStorage & Cloud Sync ----
const LS_KEYS = {
  staff: 'dsa_staff',
  shifts: 'dsa_shifts',
  reception: 'dsa_reception',
  templates: 'dsa_templates',
  unitNames: 'dsa_unit_names',
  leave: 'dsa_leave',
  totalUnits: 'dsa_total_units', // 追加: ユニット数
  syncMode: 'dsa_sync_mode',    // 'local' or 'cloud'
  syncUrl: 'dsa_sync_url',      // GAS Web App URL
};

// Sync State
const SyncSettings = {
  mode: localStorage.getItem(LS_KEYS.syncMode) || 'local',
  url: localStorage.getItem(LS_KEYS.syncUrl) || ''
};

function isCloudSyncEnabled() {
  return SyncSettings.mode === 'cloud' && !!SyncSettings.url;
}

function saveAll() {
  const currentState = {
    staff: State.staff,
    weekShifts: State.weekShifts,
    receptionShifts: State.receptionShifts,
    templates: State.templates,
    unitNames: State.unitNames,
    leaveRecords: State.leaveRecords
  };

  try {
    // 常にローカルには最新を保存する（バックアップ目的）
    localStorage.setItem(LS_KEYS.staff, JSON.stringify(State.staff));
    localStorage.setItem(LS_KEYS.shifts, JSON.stringify(State.weekShifts));
    localStorage.setItem(LS_KEYS.reception, JSON.stringify(State.receptionShifts));
    localStorage.setItem(LS_KEYS.templates, JSON.stringify(State.templates));
    localStorage.setItem(LS_KEYS.unitNames, JSON.stringify(State.unitNames));
    localStorage.setItem(LS_KEYS.leave, JSON.stringify(State.leaveRecords));
    localStorage.setItem(LS_KEYS.totalUnits, TOTAL_UNITS.toString());

    // クラウドモードの場合、GASにPOST送信
    if (isCloudSyncEnabled()) {
      showToast('info', '同期中...', '設定されたクラウドへデータを保存しています', 2000);
      fetch(SyncSettings.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain', // GAS側で受け取るためにtext/plainが安全
        },
        body: JSON.stringify(currentState),
      })
        .then(res => res.json())
        .then(data => {
          if (data.status === 'success') {
            showToast('success', 'クラウド保存完了', 'データがクラウドに保存されました');
          } else {
            throw new Error(data.message || 'Unknown error');
          }
        })
        .catch(err => {
          console.error('Cloud Sync Save Error:', err);
          showToast('error', 'クラウド保存失敗', 'エラーが発生しました: ' + err.message);
        });
    }

  } catch (e) { console.error('Save failed', e); }
}

function loadAll(forceCloud = false) {
  // ① クラウド読み込みの実行
  if (isCloudSyncEnabled() && window.fetch && (forceCloud || true)) {
    showToast('info', '同期確認', 'クラウドからデータを取得しています...', 2000);

    // GASのキャッシュ回避用のタイムスタンプ
    const fetchUrl = `${SyncSettings.url}?t=${new Date().getTime()}`;

    return fetch(fetchUrl)
      .then(res => res.json())
      .then(cloudData => {
        if (cloudData && Object.keys(cloudData).length > 0 && Array.isArray(cloudData.staff)) {
          // クラウドデータを正しく取得できた場合
          State.staff = cloudData.staff;
          State.weekShifts = cloudData.weekShifts || {};
          State.receptionShifts = cloudData.receptionShifts || {};
          State.templates = cloudData.templates || {};
          State.unitNames = cloudData.unitNames || {};
          State.leaveRecords = cloudData.leaveRecords || {};
          showToast('success', '同期完了', 'クラウドの最新データを反映しました');
          return true;
        } else {
          // クラウド側が空の場合はローカルから読み込む
          throw new Error("No valid data in cloud");
        }
      })
      .catch(err => {
        console.warn("Could not load from cloud, falling back to local:", err);
        _loadFromLocal();
        if (forceCloud) {
          showToast('warning', '同期失敗', 'クラウドのデータが読み込めず、ローカルデータをロードしました');
        }
        return false;
      })
      .finally(() => {
        // UIの再描画などをトリガーするためのカスタムイベント（app.jsやui.jsで検知できる）
        if (typeof buildTimeline === 'function') {
          try {
            // UI再描画 (app.jsのonWeekChange等に相当)
            const ew = document.getElementById('week-label');
            if (ew) {
              renderDayTabs();
              buildTimeline(currentWeekKey(), currentDayKey());
              renderStaffPanel();
            }
          } catch (e) { }
        }
      });
  } else {
    // ローカル読み込み
    _loadFromLocal();
    return Promise.resolve(true); // Always resolve for non-async usage compatibility
  }
}

// 従来のローカルストレージからの読み込みを変数化したもの
function _loadFromLocal() {
  try {
    const s = localStorage.getItem(LS_KEYS.staff);
    State.staff = s ? JSON.parse(s) : [...DEFAULT_STAFF];
    const sh = localStorage.getItem(LS_KEYS.shifts);
    State.weekShifts = sh ? JSON.parse(sh) : {};
    const rc = localStorage.getItem(LS_KEYS.reception);
    State.receptionShifts = rc ? JSON.parse(rc) : {};
    const tp = localStorage.getItem(LS_KEYS.templates);
    State.templates = tp ? JSON.parse(tp) : {};
    const un = localStorage.getItem(LS_KEYS.unitNames);
    State.unitNames = un ? JSON.parse(un) : {};
    const lv = localStorage.getItem(LS_KEYS.leave);
    State.leaveRecords = lv ? JSON.parse(lv) : {};
    const tu = localStorage.getItem(LS_KEYS.totalUnits);
    TOTAL_UNITS = tu ? parseInt(tu, 10) : 11;
  } catch (e) {
    State.staff = [...DEFAULT_STAFF];
    State.weekShifts = {};
    State.receptionShifts = {};
    State.templates = {};
    State.unitNames = {};
    State.leaveRecords = {};
    TOTAL_UNITS = 11;
  }
}

// ---- 有給・振替出勤 ヘルパー ----
function getLeaveRecord(weekKey, staffId, dayKey) {
  return (State.leaveRecords[weekKey] &&
    State.leaveRecords[weekKey][staffId] &&
    State.leaveRecords[weekKey][staffId][dayKey]) || null;
}
function setLeaveRecord(weekKey, staffId, dayKey, type) {
  if (!State.leaveRecords[weekKey]) State.leaveRecords[weekKey] = {};
  if (!State.leaveRecords[weekKey][staffId]) State.leaveRecords[weekKey][staffId] = {};
  if (type) {
    State.leaveRecords[weekKey][staffId][dayKey] = type;
  } else {
    delete State.leaveRecords[weekKey][staffId][dayKey];
  }
}

// ---- Current week/day shortcut ----
function currentWeekKey() { return weekKeyFromDate(State.currentWeekStart); }
function currentDayKey() {
  const d = new Date(State.currentWeekStart);
  d.setDate(d.getDate() + State.currentDayIndex);
  return dayKeyFromDate(d);
}

// ---- Shift CRUD for a day ----
function getDayShifts(weekKey, dayKey) {
  if (!State.weekShifts[weekKey]) State.weekShifts[weekKey] = {};
  if (!State.weekShifts[weekKey][dayKey]) State.weekShifts[weekKey][dayKey] = {};
  return State.weekShifts[weekKey][dayKey];
}

function getUnitShifts(weekKey, dayKey, unitNum) {
  const day = getDayShifts(weekKey, dayKey);
  const key = 'u' + unitNum;
  if (!day[key]) day[key] = [];
  return day[key];
}

function addShift(weekKey, dayKey, unitNum, shift) {
  const arr = getUnitShifts(weekKey, dayKey, unitNum);
  arr.push(shift);
}

function removeShift(weekKey, dayKey, unitNum, shiftId) {
  const arr = getUnitShifts(weekKey, dayKey, unitNum);
  const idx = arr.findIndex(s => s.id === shiftId);
  if (idx >= 0) arr.splice(idx, 1);
}

function findShiftById(shiftId) {
  for (const wk of Object.keys(State.weekShifts)) {
    for (const dk of Object.keys(State.weekShifts[wk])) {
      for (const uk of Object.keys(State.weekShifts[wk][dk])) {
        const arr = State.weekShifts[wk][dk][uk];
        const s = arr.find(x => x.id === shiftId);
        if (s) return { shift: s, weekKey: wk, dayKey: dk, unitKey: uk, unitNum: parseInt(uk.slice(1)) };
      }
    }
  }
  return null;
}

// ---- Reception CRUD ----
function getDayReception(weekKey, dayKey) {
  if (!State.receptionShifts[weekKey]) State.receptionShifts[weekKey] = {};
  if (!State.receptionShifts[weekKey][dayKey]) {
    State.receptionShifts[weekKey][dayKey] = { am: [], pm: [] };
  }
  return State.receptionShifts[weekKey][dayKey];
}

// ---- Staff lookup ----
function getStaff(id) { return State.staff.find(s => s.id === id); }
function getStaffColor(id) { const s = getStaff(id); return s ? s.color : '#888'; }
function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return { r, g, b };
}
function colorWithAlpha(hex, a) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}
function textColorFor(hex) {
  const { r, g, b } = hexToRgb(hex);
  return (r * 0.299 + g * 0.587 + b * 0.114) > 150 ? '#1a1d2e' : '#ffffff';
}

// ---- Prev-week copy ----
function copyPrevWeek() {
  const prevMonday = new Date(State.currentWeekStart);
  prevMonday.setDate(prevMonday.getDate() - 7);
  const prevWK = weekKeyFromDate(prevMonday);
  const curWK = currentWeekKey();

  // Copy shifts
  if (State.weekShifts[prevWK]) {
    const prevDays = getDayDates(prevMonday);
    const curDays = getDayDates(State.currentWeekStart);
    State.weekShifts[curWK] = {};
    prevDays.forEach((pd, i) => {
      const pdk = dayKeyFromDate(pd);
      const cdk = dayKeyFromDate(curDays[i]);
      if (State.weekShifts[prevWK][pdk]) {
        State.weekShifts[curWK][cdk] = JSON.parse(JSON.stringify(State.weekShifts[prevWK][pdk]));
        // Regenerate IDs
        Object.values(State.weekShifts[curWK][cdk]).forEach(arr => {
          arr.forEach(sh => { sh.id = newShiftId(); });
        });
      }
    });
  }

  // Copy reception
  if (State.receptionShifts[prevWK]) {
    const prevDays = getDayDates(prevMonday);
    const curDays = getDayDates(State.currentWeekStart);
    State.receptionShifts[curWK] = {};
    prevDays.forEach((pd, i) => {
      const pdk = dayKeyFromDate(pd);
      const cdk = dayKeyFromDate(curDays[i]);
      if (State.receptionShifts[prevWK][pdk]) {
        State.receptionShifts[curWK][cdk] = JSON.parse(JSON.stringify(State.receptionShifts[prevWK][pdk]));
      }
    });
  }
  saveAll();
}
