/**
 * mySpeaking — "BỘ NÃO" Google Apps Script
 * ───────────────────────────────────────────────────────────────
 * 1 script lo 2 việc:
 *   • doGet(?config=1)  → CẤP BÀI cho web (đọc file CẤU HÌNH: CLASSES + LESSONS)
 *   • doPost            → NHẬN BÀI nộp → bỏ vào ĐÚNG file lớp → sheet tên LESSON + sheet TIME
 *
 * LƯU TRỮ (nằm trong Google Drive của tài khoản chạy script — cũng chính là ổ D: mirror):
 *   My Drive / APP AND DATA / mySpeaking / mySpeaking Data /
 *        ├── mySpeaking Settings /  → file "MYSPEAKING - CẤU HÌNH" (sheet CLASSES + LESSONS)
 *        └── mySpeaking Sheets   /  → mỗi lớp 1 file kết quả (VD "B1AH")
 *
 * BỀN với đổi tên / đổi tài khoản: tìm file theo FOLDER + TÊN (không bám mã file cứng).
 * Đổi tài khoản: mirror y nguyên ổ D: sang tài khoản mới → deploy lại script + đổi SCRIPT_URL.
 *
 * TRIỂN KHAI:
 *   1. Dán file này vào project Apps Script (script.google.com).
 *   2. Chạy hàm setup() 1 lần (tạo folder + file CẤU HÌNH + file lớp B1AH, cấp quyền khi được hỏi).
 *   3. Deploy → Manage deployments → Edit → New version (giữ Execute as Me / Anyone).
 */

// ── Đường dẫn folder (theo TÊN, tính từ gốc My Drive) ──
// MỖI BẬC CÓ THỂ CÓ NHIỀU TÊN — thử lần lượt, thấy tên nào trước thì dùng tên đó.
// Vì sao: 20/07/2026 thầy đổi tên thư mục web "mySpeaking" -> "mySpeaking Web" cho khỏi lẫn với
// thư mục app máy tính. Ổ D: là bản mirror của Drive nên đổi tên ở máy sẽ đổi luôn trên Drive,
// mà Drive đồng bộ có ĐỘ TRỄ -> trong lúc đó bộ não phải chấp nhận CẢ HAI tên, không thì học sinh
// không đăng nhập và không nộp bài được. Giữ luôn về sau: đổi tên lần nữa cũng không hỏng.
var ROOT_NAMES  = ['APP AND DATA'];
var WEB_NAMES   = ['mySpeaking Web', 'mySpeaking'];   // ← tên mới đứng TRƯỚC
var DATA_NAMES  = ['mySpeaking Data'];
var PATH_SETTINGS = [ROOT_NAMES, WEB_NAMES, DATA_NAMES, ['mySpeaking Settings']];
var PATH_SHEETS   = [ROOT_NAMES, WEB_NAMES, DATA_NAMES, ['mySpeaking Sheets']];
var CONFIG_NAME   = 'MYSPEAKING - CẤU HÌNH';

var FORM_HEADERS = ['TIME', 'CHECKER', 'CHECKER TEAM', 'TEAM', 'VIDEO',
  'MIN', 'SEC', 'STUDENT', 'TYPE', 'SENTENCE', 'MISTAKE', 'EXPLANATION', 'SUBMISSION ID'];
var TIME_HEADERS = ['TIME', 'LESSON', 'TEAM', 'CHECKER', 'STUDENT',
  'MIN START', 'SEC START', 'MIN END', 'SEC END', 'SUBMISSION ID'];

// ═══════════════ WEB ENTRY POINTS ═══════════════
function doGet(e) {
  if (e && e.parameter && e.parameter.config) return json(buildConfig());
  if (e && e.parameter && e.parameter.check) return json(kiemTraKho());
  return json({ ok: true, app: 'mySpeaking' });
}

// ?check=1 — KIỂM TRA KHO DỮ LIỆU mà KHÔNG ghi gì. Dùng sau khi đổi tên thư mục / đổi tài khoản
// để biết bộ não còn nhìn thấy đúng chỗ không (thay cho việc phải nộp bài thật rồi đi xoá).
function kiemTraKho() {
  var out = { ok: true, app: 'mySpeaking' };
  try {
    var st = folderByPath(PATH_SETTINGS, false);
    var sh = folderByPath(PATH_SHEETS, false);
    out.settings = st ? st.getName() : null;
    out.sheets = sh ? sh.getName() : null;
    out.duong_dan = st ? duongDan(st) : (sh ? duongDan(sh) : '');
    var ss = openConfigSS(false);
    out.co_file_cau_hinh = !!ss;
    if (ss) {
      var cs = ss.getSheetByName('CLASSES');
      var ls = ss.getSheetByName('LESSONS');
      out.so_lop = cs ? Math.max(0, cs.getLastRow() - 1) : 0;
      out.so_dong_lessons = ls ? Math.max(0, ls.getLastRow() - 1) : 0;
    }
    if (sh) {
      var names = [];
      var it = sh.getFiles();
      while (it.hasNext() && names.length < 20) names.push(it.next().getName());
      out.file_ket_qua = names;
    }
    out.ok = !!(st && sh && out.co_file_cau_hinh);
  } catch (err) {
    out.ok = false;
    out.error = String(err);
  }
  return out;
}

function duongDan(folder) {
  var ten = [folder.getName()];
  var f = folder;
  for (var i = 0; i < 6; i++) {
    var ps = f.getParents();
    if (!ps.hasNext()) break;
    f = ps.next();
    ten.unshift(f.getName());
  }
  return ten.join(' / ');
}

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var sheetsFolder = folderByPath(PATH_SHEETS, false);
    if (!sheetsFolder) throw new Error('Chưa có folder "mySpeaking Sheets" — chạy setup() trước.');

    // Route: classCode → tên file kết quả (tra trong CLASSES; không có thì dùng chính classCode)
    var fileName = resolveResultFileName(data.classCode);
    if (!fileName) throw new Error('Thiếu classCode trong bài nộp.');
    var f = fileByName(sheetsFolder, fileName);
    if (!f) throw new Error('Không thấy file kết quả "' + fileName + '" trong "mySpeaking Sheets".');
    var ss = SpreadsheetApp.openById(f.getId());

    var now = new Date();
    var sid = makeSid(now);
    var lesson = String(data.lesson || 'LESSON').trim() || 'LESSON';

    // ── Sheet bắt lỗi theo LESSON (mỗi lỗi 1 dòng) ──
    var fsh = getSheet(ss, sanitizeName(lesson), FORM_HEADERS);
    var frows = (data.errors || []).map(function (er) {
      return [now, data.student, data.myTeam, data.checkedTeam, data.videoId || '',
        er.min, er.sec, er.who, er.type, er.sentence, er.detail, er.explain, sid];
    });
    if (frows.length) fsh.getRange(fsh.getLastRow() + 1, 1, frows.length, FORM_HEADERS.length).setValues(frows);

    // ── Sheet TIME chung cả lớp (mỗi bạn 1 dòng) ──
    var tsh = getSheet(ss, 'TIME', TIME_HEADERS);
    var trows = (data.timers || []).map(function (tm) {
      return [now, lesson, data.checkedTeam, data.student, tm.name,
        tm.sMin, tm.sSec, tm.eMin, tm.eSec, sid];
    });
    if (trows.length) tsh.getRange(tsh.getLastRow() + 1, 1, trows.length, TIME_HEADERS.length).setValues(trows);

    return json({ ok: true, saved: frows.length, submissionId: sid });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  }
}

// ═══════════════ CẤP BÀI (đọc CLASSES + LESSONS) ═══════════════
function buildConfig() {
  var out = [];
  var ss = openConfigSS(false);
  if (!ss) return { classes: out };
  var CS = ss.getSheetByName('CLASSES');
  var LS = ss.getSheetByName('LESSONS');
  var C = CS ? CS.getDataRange().getValues() : [];
  var L = LS ? LS.getDataRange().getValues() : [];

  for (var i = 1; i < C.length; i++) {
    var cls = String(C[i][0] || '').trim();               // CLASS
    if (!cls) continue;
    if (String(C[i][4] || '').trim().toLowerCase() === 'archived') continue;   // STATUS
    var code = String(C[i][1] || '').trim();              // CODE
    var name = String(C[i][2] || '').trim() || cls;       // NAME

    var teams = [], pairs = [], lessonName = '';
    for (var j = 1; j < L.length; j++) {
      if (String(L[j][0] || '').trim().toLowerCase() !== cls.toLowerCase()) continue;   // CLASS
      if (String(L[j][3] || '').trim().toLowerCase() !== 'yes') continue;               // ACTIVE
      lessonName = String(L[j][1] || '').trim();          // LESSON
      var teamNo = parseInt(L[j][4], 10);                 // TEAM
      if (!teamNo) continue;
      var video = String(L[j][5] || '').trim();           // VIDEO (id hoặc URL)
      if (video && video.indexOf('http') !== 0) video = 'https://drive.google.com/file/d/' + video + '/view';
      var members = String(L[j][6] || '').split(/[;,]/).map(function (s) { return s.trim(); }).filter(String);  // MEMBERS
      var checks = parseInt(L[j][7], 10);                 // CHECKS
      teams.push({ team: teamNo, video: video, members: members });
      if (checks) pairs.push({ checker: teamNo, checked: checks });
    }
    if (!teams.length) continue;   // lớp chưa ra bài (không có LESSON active) → không hiện
    teams.sort(function (a, b) { return a.team - b.team; });
    out.push({
      id: cls + '-' + lessonName, name: name, classCode: cls, code: code,
      lesson: lessonName, topic: lessonName, teams: teams, pairs: pairs,
    });
  }
  return { classes: out };
}

// classCode → tên file kết quả (cột RESULT FILE trong CLASSES); mặc định = classCode
function resolveResultFileName(classCode) {
  classCode = String(classCode || '').trim();
  if (!classCode) return null;
  var ss = openConfigSS(false);
  if (!ss) return classCode;
  var CS = ss.getSheetByName('CLASSES');
  if (!CS) return classCode;
  var V = CS.getDataRange().getValues();
  for (var i = 1; i < V.length; i++) {
    if (String(V[i][0] || '').trim().toLowerCase() === classCode.toLowerCase())
      return String(V[i][3] || '').trim() || classCode;
  }
  return classCode;
}

// ═══════════════ SETUP (chạy 1 lần) ═══════════════
function setup() {
  var settings = folderByPath(PATH_SETTINGS, true);
  var sheets = folderByPath(PATH_SHEETS, true);

  // File CẤU HÌNH
  var cf = fileByName(settings, CONFIG_NAME);
  var ss;
  if (cf) ss = SpreadsheetApp.openById(cf.getId());
  else { ss = SpreadsheetApp.create(CONFIG_NAME); DriveApp.getFileById(ss.getId()).moveTo(settings); }

  // Sheet CLASSES (seed 8 lớp; chỉ B1AH có CODE + RESULT FILE — các lớp khác thầy điền sau)
  var cls = getSheet(ss, 'CLASSES', ['CLASS', 'CODE', 'NAME', 'RESULT FILE', 'STATUS']);
  if (cls.getLastRow() < 2) {
    cls.getRange(2, 1, 8, 5).setValues([
      ['B1AH', 'germs', 'Lớp B1AH', 'B1AH', 'active'],
      ['A1A', '', 'Lớp A1A', 'A1A', 'active'],
      ['A1B', '', 'Lớp A1B', 'A1B', 'active'],
      ['A1C', '', 'Lớp A1C', 'A1C', 'active'],
      ['A2A', '', 'Lớp A2A', 'A2A', 'active'],
      ['A2B', '', 'Lớp A2B', 'A2B', 'active'],
      ['B2A', '', 'Lớp B2A', 'B2A', 'active'],
      ['B2B', '', 'Lớp B2B', 'B2B', 'active'],
    ]);
  }

  // Sheet LESSONS (seed bài GERMS của B1AH — mỗi dòng 1 đội)
  var les = getSheet(ss, 'LESSONS', ['CLASS', 'LESSON', 'DATE', 'ACTIVE', 'TEAM', 'VIDEO', 'MEMBERS', 'CHECKS']);
  if (les.getLastRow() < 2) {
    les.getRange(2, 1, 4, 8).setValues([
      ['B1AH', 'GERMS', '18/7', 'yes', 1, '1esxEggI2nZ10EsRBexCsSilBV9PphR9N', 'HOANG; TIEN', 2],
      ['B1AH', 'GERMS', '18/7', 'yes', 2, '1bra-fN4fwmHAxGrqWLRq6BFYGxWAfhSQ', 'NGAN; TRUC', 3],
      ['B1AH', 'GERMS', '18/7', 'yes', 3, '1JrAw8sj3sdkApazLSO_-4eoGgaNBCW25', 'DIEM MY; CUONG; KHOI', 4],
      ['B1AH', 'GERMS', '18/7', 'yes', 4, '1FZCpyGrK0R3D213kqNj1dQAeLRKGa9-X', 'PHONG; HA AN; BAO CHAU', 1],
    ]);
  }
  removeDefaultSheet(ss);

  // File kết quả lớp B1AH (rỗng — sheet lesson + TIME sẽ tự tạo khi có bài nộp)
  if (!fileByName(sheets, 'B1AH')) {
    var rss = SpreadsheetApp.create('B1AH');
    DriveApp.getFileById(rss.getId()).moveTo(sheets);
  }
  return 'setup xong. config id = ' + ss.getId();
}

// ═══════════════ ONE-OFF: chuẩn bị bài GERMS THẬT cho B1AH ═══════════════
// Quét folder SPEAKING GOC, đặt 4 video "ai có link đều xem", map đội theo TÊN THÀNH VIÊN
// (KHÔNG theo số "TEAM N" trong tên file — có file ghi nhầm), ghi đè dòng B1AH GERMS trong LESSONS.
function setupGermsB1AH() {
  var goc = folderByPath(['6. SPEAKING', 'SPEAKING TEST', 'B1AH', '2026.7.17 GERMS', 'SPEAKING', 'SPEAKING GOC'], false);
  if (!goc) throw new Error('Khong thay folder SPEAKING GOC');
  var map = [
    { team: 1, key: 'HOANG TIEN', members: 'HOANG; TIEN', checks: 2 },
    { team: 2, key: 'NGAN TRUC', members: 'NGAN; TRUC', checks: 3 },
    { team: 3, key: 'MY CUONG KHOI', members: 'DIEM MY; CUONG; KHOI', checks: 4 },
    { team: 4, key: 'PHONG AN CHAU', members: 'PHONG; HA AN; BAO CHAU', checks: 1 },
  ];
  var byName = {};
  var it = goc.getFiles();
  while (it.hasNext()) { var f = it.next(); if (/\.mp4$/i.test(f.getName())) byName[f.getName()] = f; }
  var rows = [], report = [];
  map.forEach(function (m) {
    var found = null;
    Object.keys(byName).forEach(function (nm) { if (nm.toUpperCase().indexOf(m.key) >= 0) found = byName[nm]; });
    if (!found) { report.push('MISSING T' + m.team + ' (' + m.key + ')'); return; }
    found.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    rows.push(['B1AH', 'GERMS', '17/7', 'yes', m.team, found.getId(), m.members, m.checks]);
    report.push('T' + m.team + ' <- ' + found.getName() + ' | ' + found.getId());
  });
  var ss = openConfigSS(false);
  var les = ss.getSheetByName('LESSONS');
  var data = les.getDataRange().getValues();
  for (var r = data.length - 1; r >= 1; r--) {
    if (String(data[r][0]).trim().toUpperCase() === 'B1AH' && String(data[r][1]).trim().toUpperCase() === 'GERMS') les.deleteRow(r + 1);
  }
  if (rows.length) les.getRange(les.getLastRow() + 1, 1, rows.length, 8).setValues(rows);
  return report.join(' || ');
}

// ═══════════════ TIỆN ÍCH ═══════════════
function openConfigSS(create) {
  var folder = folderByPath(PATH_SETTINGS, !!create);
  if (!folder) return null;
  var cf = fileByName(folder, CONFIG_NAME);
  return cf ? SpreadsheetApp.openById(cf.getId()) : null;
}

// parts = mảng các BẬC; mỗi bậc là 1 tên (chuỗi) hoặc NHIỀU tên chấp nhận được (mảng).
// Tạo mới thì luôn dùng tên ĐẦU TIÊN của bậc đó.
function folderByPath(parts, create) {
  var f = DriveApp.getRootFolder();
  for (var i = 0; i < parts.length; i++) {
    var names = (parts[i] instanceof Array) ? parts[i] : [parts[i]];
    var found = null;
    for (var j = 0; j < names.length && !found; j++) {
      var it = f.getFoldersByName(names[j]);
      if (it.hasNext()) found = it.next();
    }
    if (found) f = found;
    else if (create) f = f.createFolder(names[0]);
    else return null;
  }
  return f;
}

function fileByName(folder, name) {
  var it = folder.getFilesByName(name);
  return it.hasNext() ? it.next() : null;
}

function getSheet(ss, name, headers) {
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

function removeDefaultSheet(ss) {
  var s1 = ss.getSheetByName('Sheet1') || ss.getSheetByName('Trang tính1');
  if (s1 && ss.getSheets().length > 1) ss.deleteSheet(s1);
}

// Tên sheet hợp lệ (bỏ ký tự cấm, tối đa 90 ký tự)
function sanitizeName(n) {
  return String(n || 'LESSON').replace(/[\[\]\*\/\\?:]/g, ' ').trim().slice(0, 90) || 'LESSON';
}

// Mã bài nộp: yyMMdd-HHmmss-<3 số> (giờ VN)
function makeSid(now) {
  return Utilities.formatDate(now, 'GMT+7', 'yyMMdd-HHmmss') + '-' + Math.floor(Math.random() * 900 + 100);
}

function json(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
