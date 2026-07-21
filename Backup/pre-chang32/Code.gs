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
 *
 * (20/07/2026 — Phiên bản 5) MỖI LỚP MỘT SHEET LESSONS RIÊNG (thầy chốt):
 *   • Bài của lớp X nằm ở sheet "LESSONS X" trong file CẤU HÌNH (VD "LESSONS B1AH").
 *   • CỘT GIỮ NGUYÊN 8 cột như cũ (CLASS, LESSON, DATE, ACTIVE, TEAM, VIDEO, MEMBERS, CHECKS) —
 *     cột CLASS trong sheet riêng nghe thừa nhưng là LƯỚI AN TOÀN: dòng dán nhầm sheet vẫn tự
 *     khai nó thuộc lớp nào, và code cũ/mới đọc chung một khuôn.
 *   • Sheet "LESSONS" cũ (gộp mọi lớp) sau khi chia xong được ĐỔI TÊN thành
 *     "LESSONS CU (da chuyen)" — GIỮ NGUYÊN dữ liệu, không xoá gì.
 *   • Đường lùi: lớp nào CHƯA có sheet riêng thì bộ não tự đọc sheet "LESSONS" cũ như trước.
 *   • Lệnh quản trị mới `action:'setup'` (app/HTTP gọi có mật khẩu): chia sheet theo lớp + tạo
 *     file kết quả cho MỌI lớp trong CLASSES — chạy lại bao nhiêu lần cũng an toàn (idempotent).
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

var LESSONS_HEADERS = ['CLASS', 'LESSON', 'DATE', 'ACTIVE', 'TEAM', 'VIDEO', 'MEMBERS', 'CHECKS'];
var CLASSES_HEADERS = ['CLASS', 'CODE', 'NAME', 'RESULT FILE', 'STATUS'];
// (Phiên bản 6) Nhật ký mọi lần SỬA TAY vào kho dữ liệu — xem giải thích ở mục BẢO VỆ KHO
var AUDIT_HEADERS = ['LUC', 'NGUOI SUA', 'SHEET', 'O', 'GIA TRI CU', 'GIA TRI MOI'];
var AUDIT_NAME = 'AUDIT (nhat ky sua tay)';

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
      out.so_lop = cs ? Math.max(0, cs.getLastRow() - 1) : 0;
      // Đếm bài trên MỌI sheet "LESSONS *" (mỗi lớp 1 sheet) + sheet "LESSONS" cũ nếu còn
      var tong = 0, dsSheet = [];
      ss.getSheets().forEach(function (sh) {
        var n = sh.getName();
        if (n === 'LESSONS' || /^LESSONS [A-Z0-9]/.test(n)) {
          tong += Math.max(0, sh.getLastRow() - 1);
          dsSheet.push(n);
        }
      });
      out.so_dong_lessons = tong;
      out.sheet_lessons = dsSheet;
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
    // Cửa QUẢN TRỊ (app máy tính mySpeaking gọi vào — có mật khẩu). Bài nộp của học sinh KHÔNG
    // bao giờ có cờ này nên luồng cũ chạy y nguyên.
    if (data.admin) return json(adminRouter(data));
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

// ═══════════════ CẤP BÀI (đọc CLASSES + sheet LESSONS của từng lớp) ═══════════════
// Tên sheet bài của 1 lớp: "LESSONS B1AH", "LESSONS A2B"…
function tenSheetLessons(cls) {
  return 'LESSONS ' + String(cls || '').trim().toUpperCase();
}

// Lấy các dòng bài của 1 lớp: ưu tiên sheet riêng "LESSONS <LỚP>"; lớp chưa chia thì
// đọc sheet "LESSONS" cũ (đường lùi — mọi dòng đều có cột CLASS nên lọc được).
function layLessonRows(ss, cls) {
  var sh = ss.getSheetByName(tenSheetLessons(cls));
  if (!sh) sh = ss.getSheetByName('LESSONS');
  return sh ? sh.getDataRange().getValues() : [];
}

function buildConfig() {
  var out = [];
  var ss = openConfigSS(false);
  if (!ss) return { classes: out };
  var CS = ss.getSheetByName('CLASSES');
  var C = CS ? CS.getDataRange().getValues() : [];

  for (var i = 1; i < C.length; i++) {
    var cls = String(C[i][0] || '').trim();               // CLASS
    if (!cls) continue;
    if (String(C[i][4] || '').trim().toLowerCase() === 'archived') continue;   // STATUS
    var code = String(C[i][1] || '').trim();              // CODE
    var name = String(C[i][2] || '').trim() || cls;       // NAME

    var L = layLessonRows(ss, cls);
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
  var cls = getSheet(ss, 'CLASSES', CLASSES_HEADERS);
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
  removeDefaultSheet(ss);

  // (Phiên bản 5) Chia sheet bài theo lớp + tạo file kết quả cho MỌI lớp — dùng chung một hàm
  var bc = chiaLessonsTheoLop();
  return 'setup xong. config id = ' + ss.getId() + ' | ' + JSON.stringify(bc);
}

// ═══════════════ CHIA SHEET LESSONS THEO LỚP + TẠO FILE KẾT QUẢ (idempotent) ═══════════════
// Chạy lại bao nhiêu lần cũng an toàn:
//   • sheet "LESSONS <LỚP>" đã có DỮ LIỆU thì KHÔNG chép lại (tránh nhân đôi dòng);
//   • file kết quả đã có thì không đụng;
//   • sheet "LESSONS" cũ chỉ ĐỔI TÊN sau khi chia xong — không xoá dòng nào.
function chiaLessonsTheoLop() {
  var ss = openConfigSS(true);
  var sheetsFolder = folderByPath(PATH_SHEETS, true);
  var bc = { lop: [], sheet_moi: [], file_moi: [], dong_chuyen: 0, ghi_chu: [] };

  var CS = getSheet(ss, 'CLASSES', CLASSES_HEADERS);
  var C = CS.getDataRange().getValues();
  var old = ss.getSheetByName('LESSONS');
  var O = old ? old.getDataRange().getValues() : [];

  // Lớp có bài trong sheet cũ mà CHƯA có trong CLASSES -> thêm dòng CLASSES cho đủ
  var daCo = {};
  for (var i = 1; i < C.length; i++) daCo[String(C[i][0] || '').trim().toUpperCase()] = true;
  var thieu = {};
  for (var r = 1; r < O.length; r++) {
    var lopCu = String(O[r][0] || '').trim().toUpperCase();
    if (lopCu && !daCo[lopCu]) thieu[lopCu] = true;
  }
  Object.keys(thieu).forEach(function (lop) {
    CS.appendRow([lop, '', 'Lớp ' + lop, lop, 'active']);
    bc.ghi_chu.push('CLASSES thêm lớp ' + lop + ' (có bài trong LESSONS cũ mà chưa khai)');
  });
  C = CS.getDataRange().getValues();   // đọc lại sau khi thêm

  for (var k = 1; k < C.length; k++) {
    var cls = String(C[k][0] || '').trim();
    if (!cls) continue;
    bc.lop.push(cls);

    // 1) Sheet bài riêng của lớp
    var tenSh = tenSheetLessons(cls);
    var daCoSheet = !!ss.getSheetByName(tenSh);
    var sh = getSheet(ss, tenSh, LESSONS_HEADERS);
    if (!daCoSheet) bc.sheet_moi.push(tenSh);
    if (sh.getLastRow() < 2 && O.length > 1) {          // sheet còn trống mới chép (idempotent)
      var rows = [];
      for (var m = 1; m < O.length; m++) {
        if (String(O[m][0] || '').trim().toLowerCase() === cls.toLowerCase()) rows.push(O[m].slice(0, 8));
      }
      if (rows.length) {
        sh.getRange(2, 1, rows.length, 8).setValues(rows);
        bc.dong_chuyen += rows.length;
      }
    }

    // 2) File kết quả của lớp (sheet lesson + TIME tự sinh khi có bài nộp đầu tiên)
    var resultName = String(C[k][3] || '').trim() || cls;
    if (!CS.getRange(k + 1, 4).getValue()) CS.getRange(k + 1, 4).setValue(resultName);
    if (!fileByName(sheetsFolder, resultName)) {
      var rss = SpreadsheetApp.create(resultName);
      DriveApp.getFileById(rss.getId()).moveTo(sheetsFolder);
      bc.file_moi.push(resultName);
    }
  }

  // 3) Sheet cũ: đổi tên cho khỏi ai ghi nhầm vào — dữ liệu giữ nguyên vẹn
  if (old) {
    old.setName('LESSONS CU (da chuyen)');
    bc.ghi_chu.push('Đã đổi tên sheet LESSONS cũ thành "LESSONS CU (da chuyen)" — dữ liệu còn nguyên');
  }
  return bc;
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
  // (Phiên bản 5) bài B1AH giờ nằm ở sheet riêng "LESSONS B1AH"
  var les = getSheet(ss, tenSheetLessons('B1AH'), LESSONS_HEADERS);
  var data = les.getDataRange().getValues();
  for (var r = data.length - 1; r >= 1; r--) {
    if (String(data[r][0]).trim().toUpperCase() === 'B1AH' && String(data[r][1]).trim().toUpperCase() === 'GERMS') les.deleteRow(r + 1);
  }
  if (rows.length) les.getRange(les.getLastRow() + 1, 1, rows.length, 8).setValues(rows);
  return report.join(' || ');
}

// ═══════════════ CỬA QUẢN TRỊ cho APP MÁY TÍNH mySpeaking (v0.3.0) ═══════════════
// App máy tính gọi vào đây để RA BÀI (ghi sheet LESSONS) thay cho việc thầy gõ tay Google Sheet,
// và (để dành) KÉO BÀI HỌC SINH NỘP về cho khâu đánh giá.
//
// ⛔ MẬT KHẨU KHÔNG NẰM TRONG FILE NÀY — file này ở repo GitHub CÔNG KHAI.
//    Mật khẩu do hàm taoMatKhau() tự sinh, cất trong Script Properties (chỉ tài khoản chạy script
//    đọc được) và chép ra sheet ADMIN của file CẤU HÌNH để thầy dán 1 lần vào app.
var WEB_LINK = 'https://andrewclasses-01.github.io/mySpeaking/';

// CHẠY TAY 1 LẦN trong trình soạn Apps Script -> mở file CẤU HÌNH, sheet ADMIN, chép mật khẩu.
function taoMatKhau() {
  var props = PropertiesService.getScriptProperties();
  var k = props.getProperty('ADMIN_KEY');
  if (!k) {
    k = Utilities.getUuid().replace(/-/g, '').slice(0, 24);
    props.setProperty('ADMIN_KEY', k);
  }
  var ss = openConfigSS(true);
  var sh = getSheet(ss, 'ADMIN', ['MẬT KHẨU APP', 'GHI CHÚ']);
  sh.getRange(2, 1, 1, 2).setValues([[k,
    'Dán mật khẩu này vào app mySpeaking (Cài đặt -> Đẩy bài). KHÔNG gửi cho ai, KHÔNG đưa lên GitHub.']]);
  return k;
}

function adminRouter(data) {
  var key = PropertiesService.getScriptProperties().getProperty('ADMIN_KEY');
  if (!key) return { ok: false, error: 'CHUA_TAO_MATKHAU' };
  if (String(data.key || '') !== key) return { ok: false, error: 'SAI_MATKHAU' };
  if (data.action === 'push') return adminPush(data);
  if (data.action === 'results') return adminResults(data);
  if (data.action === 'setup') return adminSetup(data);
  if (data.action === 'baove') return adminBaoVe(data);
  return { ok: false, error: 'LENH_LA: ' + data.action };
}

// ── SETUP QUA CỬA QUẢN TRỊ (v Phiên bản 5) ─────────────────────────────────
// App/HTTP gọi { admin:1, key, action:'setup' } -> chia sheet LESSONS theo lớp + tạo file kết quả
// cho mọi lớp trong CLASSES. Idempotent — gọi lại không nhân đôi gì.
function adminSetup(data) {
  try {
    var bc = chiaLessonsTheoLop();
    bc.ok = true;
    return bc;
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

// ── BẢO VỆ KHO qua cửa quản trị (Phiên bản 6) ──────────────────────────────
// App gọi { admin:1, key, action:'baove' } -> khoá cảnh báo + đặt trigger nhật ký cho MỌI file.
// Idempotent: chạy lại không đẻ thêm trigger, không đổi gì đã đúng.
function adminBaoVe(data) {
  try {
    var bc = baoVeKho();
    bc.ok = bc.loi.length === 0;
    return bc;
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

// ── RA BÀI ──────────────────────────────────────────────────────────────────
// data = { classCode, lesson, date, code, rows:[{team, video, members, checks}], tatBaiCu }
// tatBaiCu = false mà lớp đang có bài khác mở -> KHÔNG GHI GÌ, trả về để app hỏi thầy trước.
function adminPush(data) {
  var cls = String(data.classCode || '').trim();
  var lesson = String(data.lesson || '').trim();
  if (!cls || !lesson) return { ok: false, error: 'THIEU_LOP_HOAC_BAI' };
  var rows = data.rows || [];
  if (!rows.length) return { ok: false, error: 'THIEU_DOI' };

  var ss = openConfigSS(true);
  if (!ss) return { ok: false, error: 'CHUA_CO_FILE_CAU_HINH' };

  // 1) CLASSES — lớp mới thì thêm dòng luôn (khỏi phải làm tay "Bước 5" cho từng lớp)
  var CS = getSheet(ss, 'CLASSES', CLASSES_HEADERS);
  var C = CS.getDataRange().getValues();
  var dong = 0;
  for (var i = 1; i < C.length; i++) {
    if (String(C[i][0] || '').trim().toLowerCase() === cls.toLowerCase()) { dong = i + 1; break; }
  }
  if (!dong) {
    dong = CS.getLastRow() + 1;
    CS.getRange(dong, 1, 1, 5).setValues([[cls, String(data.code || '').trim(), 'Lớp ' + cls, cls, 'active']]);
  } else if (String(data.code || '').trim()) {
    CS.getRange(dong, 2).setValue(String(data.code).trim());          // thầy đổi mã đăng nhập
  }
  var code = String(CS.getRange(dong, 2).getValue() || '').trim();
  var resultName = String(CS.getRange(dong, 4).getValue() || '').trim() || cls;
  if (!CS.getRange(dong, 4).getValue()) CS.getRange(dong, 4).setValue(resultName);
  if (!CS.getRange(dong, 5).getValue()) CS.getRange(dong, 5).setValue('active');

  // 2) File kết quả của lớp — chưa có thì tạo (KHÔNG bao giờ đụng file đã có)
  var sheetsFolder = folderByPath(PATH_SHEETS, true);
  if (!fileByName(sheetsFolder, resultName)) {
    var rss = SpreadsheetApp.create(resultName);
    DriveApp.getFileById(rss.getId()).moveTo(sheetsFolder);
  }

  // 3) LESSONS — (Phiên bản 5) ghi vào SHEET RIÊNG CỦA LỚP "LESSONS <LỚP>".
  // Lớp chưa có sheet thì getSheet tự tạo kèm header -> lớp MỚI hoàn toàn cũng chạy trơn.
  var LS = getSheet(ss, tenSheetLessons(cls), LESSONS_HEADERS);
  var L = LS.getDataRange().getValues();
  var baiKhacDangMo = {};
  for (var r = 1; r < L.length; r++) {
    if (String(L[r][0] || '').trim().toLowerCase() !== cls.toLowerCase()) continue;
    if (String(L[r][3] || '').trim().toLowerCase() !== 'yes') continue;
    var ten = String(L[r][1] || '').trim();
    if (ten.toLowerCase() !== lesson.toLowerCase()) baiKhacDangMo[ten] = (baiKhacDangMo[ten] || 0) + 1;
  }
  var dsBaiKhac = Object.keys(baiKhacDangMo);
  if (dsBaiKhac.length && !data.tatBaiCu) {
    return { ok: false, need: 'confirm', dangMo: dsBaiKhac, classCode: cls, lesson: lesson };
  }

  // Xoá dòng CŨ CỦA CHÍNH BÀI NÀY (ra lại bài = ghi đè, không sinh dòng trùng) — đi từ dưới lên.
  // Bài KHÁC thì chỉ TẮT (ACTIVE=no), KHÔNG xoá: giữ lịch sử + dữ liệu HS đã nộp vẫn nguyên.
  for (var d = L.length - 1; d >= 1; d--) {
    if (String(L[d][0] || '').trim().toLowerCase() !== cls.toLowerCase()) continue;
    if (String(L[d][1] || '').trim().toLowerCase() === lesson.toLowerCase()) LS.deleteRow(d + 1);
    else if (String(L[d][3] || '').trim().toLowerCase() === 'yes') LS.getRange(d + 1, 4).setValue('no');
  }

  var them = [];
  for (var t = 0; t < rows.length; t++) {
    var x = rows[t];
    them.push([cls, lesson, String(data.date || ''), 'yes', x.team,
      String(x.video || ''), String(x.members || ''), x.checks || '']);
  }
  LS.getRange(LS.getLastRow() + 1, 1, them.length, 8).setValues(them);

  return {
    ok: true, classCode: cls, lesson: lesson, code: code, link: WEB_LINK,
    soDoi: them.length, daTatBaiCu: dsBaiKhac,
  };
}

// ═══════════════ BẢO VỆ KHO DỮ LIỆU (Phiên bản 6 — thầy chốt 20/07/2026) ═══════════════
// Kho `mySpeaking Data` là dữ liệu SỐNG: chỉ được GHI THÊM từ (a) web học sinh nộp bài và
// (b) app mySpeaking ra bài. Sửa tay trên máy/Drive là hỏng số liệu đánh giá về sau.
//
// ⚠️ SỰ THẬT KỸ THUẬT: thầy là CHỦ SỞ HỮU file nên Google KHÔNG cho khoá cứng chính chủ.
// Vì vậy bảo vệ = 3 lớp THỰC TẾ (không hứa hão):
//   (1) KHOÁ CẢNH BÁO — protect warning-only mọi sheet: mở ra gõ là Google hiện cảnh báo đỏ
//       "bạn đang sửa vùng được bảo vệ". KHÔNG chặn cứng (chặn cứng sẽ chặn luôn cả bài nộp
//       của học sinh vì script chạy dưới danh nghĩa thầy) — nhưng đủ để không sửa NHẦM.
//   (2) NHẬT KÝ SỬA TAY — trigger onEdit ghi lại mọi lần sửa tay vào sheet AUDIT của chính
//       file đó (lúc nào · ai · sheet · ô · giá trị cũ → mới). Trigger KHÔNG nổ khi script ghi
//       -> bài nộp của học sinh không làm bẩn nhật ký; hễ có dòng AUDIT = CÓ người sửa tay.
//   (3) MÃ KIỂM TRA — mỗi lần trích dữ liệu, bộ não trả kèm checksum + số dòng + danh sách
//       SUBMISSION ID; app ghi vào file trích. Về sau đối chiếu là biết kho có bị đổi không.
function baoVeKho() {
  var bc = { file: [], trigger: [], loi: [] };
  var ss = openConfigSS(true);
  var ds = [{ ten: CONFIG_NAME, ss: ss }];

  var sheetsFolder = folderByPath(PATH_SHEETS, true);
  var it = sheetsFolder.getFiles();
  while (it.hasNext()) {
    var f = it.next();
    if (f.getMimeType() !== MimeType.GOOGLE_SHEETS) continue;   // bỏ qua .xlsx sao lưu
    try { ds.push({ ten: f.getName(), ss: SpreadsheetApp.openById(f.getId()) }); }
    catch (err) { bc.loi.push(f.getName() + ': ' + err); }
  }

  for (var i = 0; i < ds.length; i++) {
    try {
      khoaCanhBao(ds[i].ss);
      datTriggerSua(ds[i].ss, bc);
      bc.file.push(ds[i].ten);
    } catch (err) { bc.loi.push(ds[i].ten + ': ' + String(err)); }
  }
  return bc;
}

// Khoá CẢNH BÁO mọi sheet (trừ sheet AUDIT — để trigger còn ghi vào được cho êm)
function khoaCanhBao(ss) {
  var shs = ss.getSheets();
  for (var i = 0; i < shs.length; i++) {
    if (shs[i].getName() === AUDIT_NAME) continue;
    var cu = shs[i].getProtections(SpreadsheetApp.ProtectionType.SHEET);
    var p = cu.length ? cu[0] : shs[i].protect();
    p.setDescription('mySpeaking — kho du lieu, chi ghi them tu app/web. KHONG sua tay.');
    p.setWarningOnly(true);   // cảnh báo, KHÔNG chặn (chặn cứng sẽ chặn cả bài nộp HS)
  }
}

// Mỗi file 1 trigger onEdit; đã có rồi thì thôi (chạy lại an toàn)
function datTriggerSua(ss, bc) {
  var id = ss.getId();
  var all = ScriptApp.getProjectTriggers();
  for (var i = 0; i < all.length; i++) {
    if (all[i].getHandlerFunction() === 'ghiNhatKySua' && all[i].getTriggerSourceId() === id) return;
  }
  ScriptApp.newTrigger('ghiNhatKySua').forSpreadsheet(ss).onEdit().create();
  bc.trigger.push(ss.getName());
}

// Trigger CÀI ĐẶT (installable) — CHỈ nổ khi CON NGƯỜI sửa, không nổ khi script ghi.
function ghiNhatKySua(e) {
  try {
    if (!e || !e.range) return;
    var sh = e.range.getSheet();
    if (sh.getName() === AUDIT_NAME) return;              // đừng ghi lại chính nhật ký
    var ss = sh.getParent();
    var au = getSheet(ss, AUDIT_NAME, AUDIT_HEADERS);
    var ai = '';
    try { ai = (e.user && e.user.getEmail && e.user.getEmail()) || Session.getActiveUser().getEmail() || ''; } catch (_) {}
    au.appendRow([
      Utilities.formatDate(new Date(), 'GMT+7', 'yyyy-MM-dd HH:mm:ss'),
      ai || '(khong ro)',
      sh.getName(),
      e.range.getA1Notation(),
      (e.oldValue === undefined || e.oldValue === null) ? '' : String(e.oldValue),
      String(e.range.getValue()),
    ]);
  } catch (_) { /* nhật ký hỏng thì thôi, tuyệt đối không làm hỏng thao tác của thầy */ }
}

// Mã kiểm tra cho một mảng dòng: SHA-256 rút gọn 16 ký tự (đủ để phát hiện đổi 1 ô)
function maKiemTra(rows) {
  var s = JSON.stringify(rows || []);
  var b = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s, Utilities.Charset.UTF_8);
  var h = '';
  for (var i = 0; i < b.length && h.length < 16; i++) {
    var v = (b[i] < 0 ? b[i] + 256 : b[i]).toString(16);
    h += (v.length === 1 ? '0' : '') + v;
  }
  return h.slice(0, 16);
}

// So tên "hiền": bỏ dấu cách thừa + không phân biệt hoa thường. Dùng cho MỌI chỗ so tên bài,
// vì tên bài đi từ hai nguồn khác nhau (tên thư mục buổi test ↔ cột LESSON) nên đừng tin nó
// khớp từng ký tự.
function khopTen(a, b) {
  return String(a || '').replace(/\s+/g, ' ').trim().toUpperCase() ===
         String(b || '').replace(/\s+/g, ' ').trim().toUpperCase();
}

// Tìm sheet chứa bài: khớp đúng trước, không có thì khớp "hiền" trên toàn bộ tab.
// Trả null nếu thật sự không có — KHÔNG đoán bừa sang tab khác (đoán sai còn tệ hơn báo thiếu).
function timSheetBai(ss, lesson) {
  var ten = sanitizeName(lesson);
  var sh = ss.getSheetByName(ten);
  if (sh) return sh;
  var all = ss.getSheets();
  for (var i = 0; i < all.length; i++) {
    var n = all[i].getName();
    if (n === 'TIME' || n === AUDIT_NAME) continue;
    if (khopTen(n, ten) || khopTen(n, lesson)) return all[i];
  }
  return null;
}

// ── KÉO BÀI HỌC SINH NỘP (để dành cho v0.5 ĐÁNH GIÁ) ────────────────────────
function adminResults(data) {
  var cls = String(data.classCode || '').trim();
  var lesson = String(data.lesson || '').trim();
  if (!cls) return { ok: false, error: 'THIEU_LOP' };
  var sheetsFolder = folderByPath(PATH_SHEETS, false);
  if (!sheetsFolder) return { ok: false, error: 'CHUA_CO_FOLDER_SHEETS' };
  var f = fileByName(sheetsFolder, resolveResultFileName(cls));
  if (!f) return { ok: false, error: 'KHONG_THAY_FILE_KET_QUA' };
  var ss = SpreadsheetApp.openById(f.getId());

  var out = { ok: true, classCode: cls, lesson: lesson, errors: [], timers: [] };
  // ⛔ TRA SHEET BÀI PHẢI CHỊU ĐƯỢC LỆCH TÊN. Trước đây chỉ `getSheetByName(sanitizeName(lesson))`
  // — khớp tuyệt đối. App gửi tên bài lấy từ TÊN THƯ MỤC buổi test, còn sheet mang tên lấy từ
  // cột LESSON; hai nguồn khác nhau nên chỉ cần thừa một dấu cách / khác hoa-thường là trả về
  // **0 dòng lỗi** mà vẫn `ok:true` -> app báo "chưa có bài nộp" trong khi kho đầy bài.
  var fsh = lesson ? timSheetBai(ss, lesson) : null;
  if (fsh && fsh.getLastRow() > 1) out.errors = fsh.getDataRange().getValues().slice(1);
  out.sheetBai = fsh ? fsh.getName() : '';
  if (lesson && !fsh) {
    out.canhBao = 'KHONG_THAY_SHEET_BAI';
    out.sheetCoTrongFile = ss.getSheets().map(function (s) { return s.getName(); });
  }
  var tsh = ss.getSheetByName('TIME');
  if (tsh && tsh.getLastRow() > 1) {
    var T = tsh.getDataRange().getValues();
    for (var i = 1; i < T.length; i++) {
      if (!lesson || khopTen(T[i][1], lesson)) out.timers.push(T[i]);
    }
  }
  out.headersErrors = FORM_HEADERS;
  out.headersTimers = TIME_HEADERS;

  // (Phiên bản 6) Lớp bảo vệ số 3 — ĐÓNG BĂNG bản trích: app ghi mấy số này vào file trích,
  // về sau trích lại mà checksum khác là biết kho đã bị đổi (dù do nộp thêm hay sửa tay).
  out.luc = Utilities.formatDate(new Date(), 'GMT+7', 'yyyy-MM-dd HH:mm:ss');
  out.soDongLoi = out.errors.length;
  out.soDongTime = out.timers.length;
  out.checksum = maKiemTra([out.errors, out.timers]);
  var sid = {}, ds = [];
  out.errors.forEach(function (r) { var k = String(r[12] || ''); if (k && !sid[k]) { sid[k] = 1; ds.push(k); } });
  out.timers.forEach(function (r) { var k = String(r[9] || ''); if (k && !sid[k]) { sid[k] = 1; ds.push(k); } });
  out.dsSubmission = ds;
  // Có ai sửa tay file kết quả này chưa?
  var au = ss.getSheetByName(AUDIT_NAME);
  out.suaTay = au ? Math.max(0, au.getLastRow() - 1) : 0;
  return out;
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
