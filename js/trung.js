/* ══════════════════════════════════════════════════════════════════════════════════════
   trung.js — GỢI Ý LỖI TRÙNG ("THẦY ANDREW GỢI Ý")   ·  mySpeaking web, 03/09/2026
   ══════════════════════════════════════════════════════════════════════════════════════
   VIỆC CỦA FILE NÀY: nhận danh sách lỗi mà các đội khác bắt cho MỘT đội, trả về những
   dòng NGHI LÀ TRÙNG nhau. Chỉ GỢI Ý — quyền gộp và quyền chốt hoàn toàn của học sinh
   (thầy chốt 03/09: "không trực tiếp gom cụm bằng quyết định của AI").

   HAI TẦNG, chạy HẾT trong trình duyệt học sinh (thầy chốt: không đụng app/máy tính):
     ① SO CHỮ (luôn chạy, tức thì, miễn phí) — bắt được phần chắc chắn.
        Đo thật 03/09 trên 2 buổi: A2B 464 dòng → 341 · B2A 626 → 421 (bớt 27–33%).
     ② HỎI GEMINI (nếu thầy đã bật Firebase AI Logic) — chỉ hỏi những CẶP MỜ mà tầng ①
        không dám quyết, ví dụ một em ghi "phát âm sai" còn em kia ghi cả câu.
        ⛔ Chưa bật thì im lặng bỏ qua, chỉ dùng tầng ① — KHÔNG được làm vỡ màn hình.

   ⛔⛔ LUẬT NGHIỆP VỤ BẤT DI BẤT DỊCH (thầy chốt 21/07/2026, đã trả giá 13 dòng bị nuốt):
   HAI DÒNG CỦA CÙNG MỘT NGƯỜI CHẤM KHÔNG BAO GIỜ LÀ MỘT LỖI. Một em không ghi lại cùng
   một lỗi hai lần; em ấy ghi hai dòng giống chữ ở hai mốc giờ nghĩa là NGƯỜI NÓI SAI HAI
   LẦN, phải đếm 2. Luật này áp cho CẢ tầng ① lẫn tầng ② (cặp cùng người chấm không được
   đưa cho Gemini hỏi). Bản gốc của luật: mySpeaking/app/tools/danhgia.py `cung_mot_loi_duoc`.

   ⛔ HỌC SINH KHÔNG BAO GIỜ THẤY CHỮ "MÁY" HAY "AI" (thầy chốt 03/09) — mọi nhãn trên màn
   đều là "THẦY ANDREW GỢI Ý". File này chỉ lo phần tính, chữ nằm ở app.js.
   ══════════════════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ── Tham số đã ĐO THẬT, đừng chỉnh mò ─────────────────────────────────────────────
     LECH_GIAY 10: hai em bấm mốc lệch nhau vài giây là bình thường (người bấm lúc nghe
     thấy, người bấm lúc chép xong câu). Nới quá 10 là bắt đầu gom nhầm hai câu liền kề.
     ⛔ Đo trên A2B/B2A: 8 giây bỏ sót vài cặp thật, 15 giây bắt đầu dính cặp giả. */
  var LECH_GIAY = 10;

  /* Từ vô nghĩa khi so "hai em có nói về cùng một chỗ sai không". Gồm cả chữ Việt các em
     hay viết ("sai ở từ", "phát âm sai", "thiếu s") lẫn chữ Anh khung câu ("said",
     "instead of"). ⛔ Thiếu bảng này là mọi dòng đều "chung từ said/instead" ⇒ gộp bừa. */
  var BO_QUA = (
    'said say says instead of the a an to in on at is are was were be been am ' +
    'it he she they we you i and or but not no did do does done have has had ' +
    'that this these those with for from about into than then there here as ' +
    'sai o tu tu phat am phat-am wrong pronunciation pronounce word words ' +
    'thieu thua them bo doc ban phai so nhieu it chua xac dinh dac biet la ' +
    'cau cai nay kia do khong co bi duoc lai roi nua van con hoac va cua ' +
    'letter dont doesnt cant wasnt werent isnt arent nothing none thanh cach ' +
    'loi mistake error grammar information sentence explain explanation'
  ).split(/\s+/);
  var BO_QUA_SET = {};
  BO_QUA.forEach(function (w) { BO_QUA_SET[w] = 1; });

  /* Bỏ dấu tiếng Việt — CÙNG luật với `khongDauTen` bên app.js (chép lại để file này
     đứng độc lập, nạp trước hay sau app.js đều chạy). */
  function khongDau(s) {
    return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
  }

  /* Về GỐC TỪ thô sơ: bỏ đuôi s/es/ed/ing để "grow" ~ "grows" ~ "growing",
     "spot" ~ "spots". ⛔ Chỉ cắt khi phần còn lại còn ít nhất 3 chữ, không thì
     "is" → "" và "does" → "do" làm nhiễu. */
  function gocTu(w) {
    var m = w.match(/^(.*?)(ies|es|ed|ing|s)$/);
    if (!m) return w;
    var goc = m[1];
    if (m[2] === 'ies') goc += 'y';
    return goc.length >= 3 ? goc : w;
  }

  function tachTu(s) {
    return khongDau(s).replace(/[^a-z0-9' ]+/g, ' ').split(/\s+/)
      .filter(function (w) { return w.length > 1 && !BO_QUA_SET[w]; })
      .map(gocTu);
  }

  /* TỪ ĐÍCH của một dòng = "em này đang nói về chỗ nào trong câu".
     Ba nguồn, ưu tiên giảm dần — bắt được cả kiểu ghi rất khác nhau của các em:
       ① chữ trong NGOẶC KÉP ở phần mô tả lỗi:  said "spot" instead of "spots"  → spot
       ② từ trong phần mô tả lỗi MÀ CÓ MẶT trong câu trích: "phát âm sai other" → other
       ③ hết cách thì lấy mọi từ có nghĩa của phần mô tả (em chỉ ghi mỗi "unappetizing")
     ⛔ Đừng bỏ tầng ③: rất nhiều em chỉ gõ đúng một từ bị sai, không viết câu nào. */
  function tuDich(x) {
    var trongNgoac = [];
    String(x.loi || '').replace(/["'“”‘’]([^"'“”‘’]{2,40})["'“”‘’]/g,
      function (_, g) { trongNgoac.push(g); return ''; });
    var ds = trongNgoac.length ? [].concat.apply([], trongNgoac.map(tachTu)) : [];
    if (!ds.length) {
      var cau = {};
      tachTu(x.cau).forEach(function (w) { cau[w] = 1; });
      ds = tachTu(x.loi).filter(function (w) { return cau[w]; });
    }
    if (!ds.length) ds = tachTu(x.loi);
    var set = {};
    ds.forEach(function (w) { set[w] = 1; });
    return set;
  }

  function chungTu(a, b) {
    for (var w in a) if (b[w]) return true;
    return false;
  }

  /* Hai dòng CÓ ĐƯỢC PHÉP xét là một lỗi không (chưa xét nội dung).
     ⛔ Điều kiện `a.cham !== b.cham` là LUẬT 21/07 nói ở đầu file — đừng gỡ. */
  function xetDuoc(a, b) {
    if (!a.cham || !b.cham || a.cham === b.cham) return false;
    if (a.type !== b.type) return false;
    if (a.who && b.who && a.who !== b.who) return false;   // hai người nói khác nhau
    return Math.abs(a.t - b.t) <= LECH_GIAY;
  }

  /* ── TẦNG ①: SO CHỮ ─────────────────────────────────────────────────────────────────
     Trả về { chac: [[i,j]…], mo: [[i,j]…] }. Danh sách xếp theo thời gian nên vòng
     trong `break` được ngay khi vượt cửa sổ — buổi 600 dòng vẫn chạy trong vài ms. */
  function soChu(ds) {
    var chac = [], mo = [];
    for (var i = 0; i < ds.length; i++) {
      for (var j = i + 1; j < ds.length; j++) {
        if (ds[j].t - ds[i].t > LECH_GIAY) break;
        if (!xetDuoc(ds[i], ds[j])) continue;
        (chungTu(ds[i]._dich, ds[j]._dich) ? chac : mo).push([i, j]);
      }
    }
    return { chac: chac, mo: mo };
  }

  /* ── TẦNG ②: HỎI GEMINI (Firebase AI Logic) ─────────────────────────────────────────
     Vì sao đi đường Firebase chứ không gọi thẳng Gemini API: khoá nằm ở phía Google,
     trang web KHÔNG cầm khoá nào. Thầy bật một lần trên Console (xem file hướng dẫn
     `HUONG DAN BAT GEMINI.md` trong mySpeaking/web).
     ⛔ Mọi lỗi ở tầng này đều NUỐT: chưa bật, hết hạn mức, mất mạng… đều lặng lẽ quay
        về chỉ dùng tầng ①. Màn hình vẫn có gợi ý, chỉ ít hơn. */
  var SDK = 'https://www.gstatic.com/firebasejs/12.9.0';
  var CAU_HINH = {
    apiKey: 'AIzaSyAV_yoyAQM2fKKdOsJyuAxxf4AN7MsF7XY',
    authDomain: 'aword-70dae.firebaseapp.com',
    projectId: 'aword-70dae',
    storageBucket: 'aword-70dae.firebasestorage.app',
    messagingSenderId: '399279049436',
    appId: '1:399279049436:web:b9b34dcfb34732aa744219'
  };
  var CAP_MOI_LO = 25;      // ⛔ cùng con số với app máy tính (tools/danhgia.py CAP_MOI_LO)
  var _mo = null;           // Promise của model, dựng một lần cho cả phiên

  function layModel() {
    if (_mo) return _mo;
    _mo = (async function () {
      var appMod = await import(SDK + '/firebase-app.js');
      var app;
      try { app = appMod.getApp(); } catch (e) { app = appMod.initializeApp(CAU_HINH); }
      var ai = await import(SDK + '/firebase-ai.js');
      var dv = ai.getAI(app, { backend: new ai.GoogleAIBackend() });
      return ai.getGenerativeModel(dv, {
        model: 'gemini-2.5-flash-lite',
        generationConfig: { temperature: 0, responseMimeType: 'application/json' }
      });
    })();
    return _mo;
  }

  /* Câu hỏi giữ NGUYÊN TINH THẦN bản đã chạy cả năm trên app máy tính (danhgia.py
     `nhac_hoi`), kể cả luật cuối — cái luật quan trọng nhất:
        KHÔNG CHẮC THÌ TRẢ LỜI KHÁC. Thà tách nhầm (em tự gộp lấy) còn hơn gộp nhầm
        (mất một lỗi thật mà không ai biết). */
  function dungCauHoi(lo, ds) {
    var mo = lo.map(function (c, k) {
      var a = ds[c[0]], b = ds[c[1]];
      return '### Cặp ' + (k + 1) + ' (mã ' + c[0] + '-' + c[1] + ')\n' +
        'A. giây ' + a.t + ' · câu: ' + a.cau + ' · lỗi: ' + a.loi + ' · giải thích: ' + (a.gt || '') + '\n' +
        'B. giây ' + b.t + ' · câu: ' + b.cau + ' · lỗi: ' + b.loi + ' · giải thích: ' + (b.gt || '');
    }).join('\n\n');
    return [
      'Bạn đang giúp một giáo viên tiếng Anh gộp dữ liệu học sinh chấm chéo bài thuyết trình.',
      'Nhiều học sinh cùng xem một video và cùng ghi lỗi, nên MỘT lỗi có thể được nhiều em ghi',
      'lại bằng lời văn khác nhau, mốc giây lệch vài giây.',
      '',
      'Với mỗi cặp dưới đây, hãy quyết định: A và B có phải là CÙNG MỘT LỖI của cùng một người nói không?',
      '',
      'Luật:',
      '- CÙNG nếu hai em đang nói về cùng một chỗ sai (cùng từ/cụm/hiện tượng), dù chữ khác nhau.',
      '- KHÁC nếu là hai chỗ sai khác nhau, kể cả khi rất gần nhau về thời gian.',
      '- Không chắc thì trả lời KHÁC (thà tách nhầm còn hơn gộp nhầm — gộp nhầm là mất một lỗi thật).',
      '',
      mo,
      '',
      'CHỈ trả lời bằng JSON, không giải thích gì thêm, đúng dạng:',
      '{"gop": ["<mã của những cặp CÙNG MỘT LỖI>"]}',
      'Ví dụ: {"gop": ["3-7", "10-12"]}. Không cặp nào cùng lỗi thì {"gop": []}.'
    ].join('\n');
  }

  async function hoiGemini(capMo, ds, baoTien) {
    if (!capMo.length) return [];
    var model;
    try { model = await layModel(); } catch (e) { return []; }   // chưa bật → im lặng
    var lo = [], i;
    for (i = 0; i < capMo.length; i += CAP_MOI_LO) lo.push(capMo.slice(i, i + CAP_MOI_LO));
    var xong = 0, ra = [];
    /* Hỏi SONG SONG cả loạt: một buổi đông có thể 300 cặp mờ = 12 lô; hỏi nối đuôi
       nhau là em ngồi chờ cả phút (bài học từ app máy tính, đã phải sửa sang song song). */
    await Promise.all(lo.map(async function (mangCap) {
      try {
        var kq = await model.generateContent(dungCauHoi(mangCap, ds));
        var chu = kq.response.text();
        var o = JSON.parse(chu);
        (o && o.gop || []).forEach(function (ma) {
          var p = String(ma).split('-');
          var a = +p[0], b = +p[1];
          if (ds[a] && ds[b]) ra.push([a, b]);
        });
      } catch (e) { /* lô nào hỏng thì bỏ lô đó, các lô khác vẫn tính */ }
      xong++;
      if (baoTien) baoTien(xong / lo.length);
    }));
    return ra;
  }

  /* ── CỬA CHÍNH ──────────────────────────────────────────────────────────────────────
     dsLoi: [{ id, cham, who, type, t, cau, loi, gt }]  (t = giây trong video)
     Trả:   { danhDau: {errId:true}, cap: [[idA,idB]], soCapMo, coAI }
     `danhDau` chính là thứ màn hình dùng để gắn nhãn "THẦY ANDREW GỢI Ý" lên từng dòng. */
  async function goiY(dsLoi, tuyChon) {
    tuyChon = tuyChon || {};
    var ds = (dsLoi || []).slice().sort(function (a, b) { return a.t - b.t; });
    ds.forEach(function (x) { x._dich = tuDich(x); });

    var b1 = soChu(ds);
    var cap = b1.chac.slice();
    var coAI = false;
    if (tuyChon.dungAI !== false && b1.mo.length) {
      var themCap = await hoiGemini(b1.mo, ds, tuyChon.baoTien);
      coAI = themCap.length > 0;
      cap = cap.concat(themCap);
    }

    var danhDau = {};
    var capId = cap.map(function (c) {
      danhDau[ds[c[0]].id] = true;
      danhDau[ds[c[1]].id] = true;
      return [ds[c[0]].id, ds[c[1]].id];
    });
    return { danhDau: danhDau, cap: capId, soCapMo: b1.mo.length, coAI: coAI };
  }

  window.SPTrung = { goiY: goiY, LECH_GIAY: LECH_GIAY };
})();
