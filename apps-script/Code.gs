/**
 * mySpeaking — Google Apps Script nhận bài nộp từ app SPEAKING TEAM CHECK
 *
 * CÁCH TRIỂN KHAI (làm 1 lần, ~5 phút):
 * 1. Tạo 1 Google Sheet mới (VD tên "SPEAKING CHECK - BÀI NỘP"), copy ID của Sheet
 *    (đoạn giữa /d/ và /edit trong URL) dán vào SS_ID bên dưới.
 * 2. Vào https://script.google.com → New project → xóa code mặc định, dán toàn bộ file này.
 * 3. Deploy → New deployment → chọn "Web app":
 *      - Execute as: Me
 *      - Who has access: Anyone
 *    → Deploy → copy "Web app URL" (dạng .../exec).
 * 4. Dán URL đó vào SCRIPT_URL trong file config.js của app rồi push lên GitHub.
 */

var SS_ID = 'DAN_ID_GOOGLE_SHEET_VAO_DAY';

function doGet() {
  return ContentService.createTextOutput(JSON.stringify({ ok: true, app: 'mySpeaking' }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.openById(SS_ID);
    var now = new Date();

    // ── Sheet FORM: mỗi dòng 1 lỗi ──
    var f = getSheet(ss, 'FORM', [
      'NGÀY GIỜ NỘP', 'LỚP', 'NGƯỜI CHECK', 'ĐỘI CỦA NGƯỜI CHECK', 'ĐỘI ĐƯỢC CHECK', 'CHỦ ĐỀ',
      'PHÚT', 'GIÂY', 'ĐOẠN', 'HS CÓ LỖI', 'LOẠI LỖI', 'LỖI CỤ THỂ', 'GIẢI THÍCH LỖI'
    ]);
    var rows = (data.errors || []).map(function (er) {
      return [now, data.className, data.student, data.myTeam, data.checkedTeam, data.topic,
        er.min, er.sec, er.section, er.who, er.type, er.detail, er.explain];
    });
    if (rows.length) {
      f.getRange(f.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
    }

    // ── Sheet TIMER: mỗi dòng 1 bạn ──
    var t = getSheet(ss, 'TIMER', [
      'NGÀY GIỜ NỘP', 'LỚP', 'NGƯỜI CHECK', 'ĐỘI ĐƯỢC CHECK', 'STT', 'BẠN',
      'BĐ PHÚT', 'BĐ GIÂY', 'KT PHÚT', 'KT GIÂY'
    ]);
    var trows = (data.timers || []).map(function (tm, i) {
      return [now, data.className, data.student, data.checkedTeam, i + 1, tm.name,
        tm.sMin, tm.sSec, tm.eMin, tm.eSec];
    });
    if (trows.length) {
      t.getRange(t.getLastRow() + 1, 1, trows.length, trows[0].length).setValues(trows);
    }

    return ContentService.createTextOutput(JSON.stringify({ ok: true, saved: rows.length }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
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
