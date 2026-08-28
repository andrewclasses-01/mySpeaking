/* ═══════════════════════════════════════════════════════════════
   mySpeaking — SPEAKING TEAM CHECK
   App bắt lỗi video thuyết trình cho học sinh (GitHub Pages)
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const CFG = window.MYSPEAKING_CONFIG || {};
  const $ = (id) => document.getElementById(id);

  // ─── Danh sách lớp — mô hình 1 LINK CHUNG + đăng nhập theo lớp ───
  // Nguồn: đọc LIVE từ "bộ não" (Apps Script ?config=1); dự phòng data/classes.json.
  // Cấu trúc: { classes: [ { id, name, classCode, code, lesson, topic, teams:[{team, video, members[]}], pairs:[{checker, checked}] } ] }
  let CLASSES = { classes: [] };
  const session = { class: null };   // lớp đang chọn sau khi đăng nhập

  // ─── State ───
  const state = {
    student: '', myTeam: '',
    className: '', classCode: '',
    lesson: '', topic: '',
    checkedTeam: '',
    members: [],
    videoUrl: '', videoId: '',
    errors: [],   // {min, sec, section, who, type, sentence, detail, explain}  (type = Grammar/Pronunciation/Information)
    timers: [],   // {name, sMin, sSec, eMin, eSec}
    submitted: false,
    wasSubmitted: false,   // CHẶNG 29: đã từng nộp ít nhất 1 lần (giữ bài trong "My submitted checks" kể cả khi đang mở khoá sửa)
    khoFs: false,          // (Đợt Firebase) buổi này nằm ở KHO NÀO: true = Firestore, false = bộ não cũ
    buoiId: '',            // mã buổi LOP_BAI trong Firestore (chỉ có nghĩa khi khoFs)
    clips: [],             // (Đợt 3) video MỌI đội [{t: số đội, v: link}] — pop-up "All team videos"
    // (Đợt B 27/08/2026) MÔ HÌNH 2 — bản tổng lỗi thống nhất + màn phản biện:
    moHinh: 1,             // 1 = nhiều-lần-nộp (baiNop, buổi cũ) · 2 = bản tổng sống (tongLoi)
    cheDo: 'cham',         // 'cham' = chấm đội được phân công · 'phanbien' = xem lỗi đội mình + tích
  };
  let editingIndex = -1;
  let fType = '';
  let pendingDelIndex = -1;   // CHẶNG 33: lỗi đang chờ xác nhận xoá (pop-up delOneModal)
  const IT_LOI = 15;          // CHẶNG 35: từ NGƯỠNG này trở xuống = "ít lỗi" → tô đỏ + hỏi lại lần nữa

  const SCRIPT_URL = CFG.SCRIPT_URL || '';
  let saveKey = 'myspeaking_manual';   // đặt lại khi biết videoUrl (sau bước chọn tên)

  // ═══════════════ KHO FIRESTORE (Đợt Firebase 26/08/2026 — thầy chốt "chuyển trọn") ═══════════════
  // Kho MỚI cho cấu hình buổi + bài nộp: Firestore project aword-70dae (chung AWord/myLesson).
  //   spBuoi/{LOP_BAI}              — cấu hình một buổi (teams/pairs/video/mã)
  //   spBuoi/{LOP_BAI}/baiNop/{sid} — MỖI LƯỢT NỘP = 1 tài liệu
  // Đi bằng REST thuần (fetch + API key công khai) — không nạp SDK, không thêm thư viện.
  // Bộ não Apps Script cũ GIỮ NGUYÊN làm đường lùi cho buổi CŨ trong Google Sheets:
  // đăng nhập ưu tiên buổi Firestore (nhanh <1s), buổi cũ vẫn hiện sau khi bộ não trả lời.
  // ⛔ CHƯA DÁN LUẬT FIRESTORE (khối spBuoi/baiNop) thì mọi lượt gọi ở đây bị từ chối —
  //    web tự rơi về đường cũ, không vỡ gì. Luật ở: myLesson-data\tai-lieu\LUAT FIRESTORE CAN DAN.md
  const FS_CFG = CFG.FIREBASE || null;
  const FS_GOC = FS_CFG
    ? 'https://firestore.googleapis.com/v1/projects/' + FS_CFG.projectId + '/databases/(default)/documents'
    : '';
  const fsKey = () => '?key=' + (FS_CFG ? FS_CFG.apiKey : '');

  // Mã buổi LOP_BAI — ⛔ PHẢI Y HỆT maBuoi() trong kho-fs.js (app máy tính) + lop.html (myLesson).
  function maBuoi(classCode, lesson) {
    const lop = String(classCode || '').replace(/\s+/g, '').trim().toUpperCase();
    const bai = String(lesson || '').replace(/\s+/g, ' ').trim().toUpperCase().replace(/\//g, '-');
    return lop + '_' + bai;
  }

  // Đổi qua lại giữa JS và định dạng giá trị của Firestore REST
  function fsMa(v) {
    if (v === null || v === undefined) return { nullValue: null };
    if (typeof v === 'boolean') return { booleanValue: v };
    if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
    if (typeof v === 'string') return { stringValue: v };
    if (Array.isArray(v)) return { arrayValue: { values: v.map(fsMa) } };
    if (typeof v === 'object') {
      const fields = {};
      Object.keys(v).forEach((k) => { fields[k] = fsMa(v[k]); });
      return { mapValue: { fields } };
    }
    return { stringValue: String(v) };
  }
  function fsGiai(f) {
    if (!f || typeof f !== 'object') return null;
    if ('stringValue' in f) return f.stringValue;
    if ('integerValue' in f) return parseInt(f.integerValue, 10);
    if ('doubleValue' in f) return f.doubleValue;
    if ('booleanValue' in f) return f.booleanValue;
    if ('nullValue' in f) return null;
    if ('arrayValue' in f) return ((f.arrayValue && f.arrayValue.values) || []).map(fsGiai);
    if ('mapValue' in f) {
      const o = {};
      const fields = (f.mapValue && f.mapValue.fields) || {};
      Object.keys(fields).forEach((k) => { o[k] = fsGiai(fields[k]); });
      return o;
    }
    return null;
  }
  function fsGiaiDoc(doc) {
    const o = {};
    const fields = (doc && doc.fields) || {};
    Object.keys(fields).forEach((k) => { o[k] = fsGiai(fields[k]); });
    if (doc && doc.name) o._id = String(doc.name).split('/').pop();
    return o;
  }

  // Mọi buổi đang mở (mọi lớp) → hình dạng Y HỆT phần tử CLASSES.classes của bộ não cũ,
  // kèm cờ `_kho:'fs'` để các bước sau biết bài này nộp vào đâu.
  async function buoiDangMoFs() {
    if (!FS_GOC) return [];
    const body = {
      structuredQuery: {
        from: [{ collectionId: 'spBuoi' }],
        where: { fieldFilter: { field: { fieldPath: 'active' }, op: 'EQUAL', value: { booleanValue: true } } },
        limit: 50,
      },
    };
    const r = await fetch(FS_GOC + ':runQuery' + fsKey(), {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error('FS_' + r.status);
    const ds = await r.json();
    return (Array.isArray(ds) ? ds : []).filter((x) => x.document).map((x) => {
      const b = fsGiaiDoc(x.document);
      return {
        id: (b.classCode || '') + '-' + (b.lesson || ''),
        name: b.className || ('CLASS ' + (b.classCode || '')),
        classCode: b.classCode || '', code: b.code || '',
        lesson: b.lesson || '', topic: b.topic || b.lesson || '',
        teams: (b.teams || []).map((t) => ({ team: t.team, video: t.video || '', members: t.members || [] })),
        pairs: b.pairs || [],
        _kho: 'fs',
        _moHinh: b.moHinh === 2 ? 2 : 1,   // (Đợt B) buổi bản-tổng-lỗi hay buổi nhiều-lần-nộp
      };
    });
  }

  // Các lượt nộp CỦA CHÍNH EM trong một buổi (khôi phục bài + đếm "nộp thiếu")
  async function baiCuaEmFs(buoiId, student) {
    const body = {
      structuredQuery: {
        from: [{ collectionId: 'baiNop' }],
        where: { fieldFilter: { field: { fieldPath: 'student' }, op: 'EQUAL', value: { stringValue: String(student || '') } } },
        limit: 100,
      },
    };
    const r = await fetch(FS_GOC + '/spBuoi/' + encodeURIComponent(buoiId) + ':runQuery' + fsKey(), {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error('FS_' + r.status);
    const ds = await r.json();
    return (Array.isArray(ds) ? ds : []).filter((x) => x.document).map((x) => fsGiaiDoc(x.document))
      .sort((a, b) => String(a.sid || '') < String(b.sid || '') ? 1 : -1);   // mới nhất trước
  }

  // Ghi MỘT lượt nộp. `documentId` = sid ⇒ tạo mới rõ ràng (luật chỉ cho create, cấm sửa/xoá).
  async function nopFs(buoiId, sid, duLieu) {
    const fields = {};
    Object.keys(duLieu).forEach((k) => { fields[k] = fsMa(duLieu[k]); });
    const r = await fetch(FS_GOC + '/spBuoi/' + encodeURIComponent(buoiId) + '/baiNop' + fsKey() +
      '&documentId=' + encodeURIComponent(sid), {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fields }),
    });
    if (!r.ok) {
      let msg = 'FS_' + r.status;
      try { const j = await r.json(); msg = (j.error && j.error.message) || msg; } catch (e) {}
      throw new Error(msg);
    }
    return true;
  }

  // ═══════════════ (Đợt B 27/08/2026) MÔ HÌNH 2 — BẢN TỔNG LỖI + PHẢN BIỆN ═══════════════
  // Thầy chốt 26/08 khuya: từ buổi mô hình 2 (spBuoi có `moHinh: 2`, app đẩy từ v1.7.0):
  //   spBuoi/{id}/tongLoi/{slug-em-chấm}  — MỖI EM CHẤM = MỘT bản tổng SỐNG (create+update),
  //     errors[] mang {id, trangThai: 'song'|'an'|'go', ketLuan: ''|'keep'|'agree', ...6 mục cũ}
  //     'an' = em tự xoá (ẨN nhưng GIỮ VẾT) · 'go' = được Agree (gỡ bắt lỗi, giữ vết, mờ+gạch)
  //   spBuoi/{id}/phanHoi/{errId__slug-em-tích} — MỖI PHIẾU = 1 tài liệu {y:'dongY'|'phanDoi',
  //     lyDo (bắt buộc khi phản đối — LUẬT kho chặn, không chỉ giao diện), voter, chuLoi, ...}
  // Buổi CŨ (mô hình 1 / Sheets) giữ NGUYÊN đường baiNop nhiều-lần-nộp phía trên — đừng gỡ.
  // ⛔ Luật khối 4 (tongLoi + phanHoi) phải dán TRƯỚC khi buổi mô hình 2 chạy thật:
  //    myLesson-data\tai-lieu\LUAT FIRESTORE CAN DAN (27-08 THEM PHAN BIEN).md

  // Trạng thái riêng của mô hình 2 (không nằm trong `state` để autosave localStorage nhẹ)
  const m2 = {
    serverBan: '',   // JSON {errors,timers} ĐÃ đồng bộ lần cuối — so để biết "có sửa chưa gửi"
    serverIds: {},   // map id lỗi -> JSON lỗi đã đồng bộ (vẽ icon uploaded từng ô)
    phanHoi: [],     // mọi phiếu phản hồi của buổi liên quan tới màn đang mở
    disOn: false,    // nút DISAGREEMENT đang bật (dồn câu tranh chấp lên đầu)
    dsCham: [],      // (phản biện) [{chuLoi, err}] — lỗi đội mình bị chấm, gom từ mọi em bên đội chấm
    votes: {},       // (phản biện) phiếu CỦA CHÍNH EM đang sửa: {errId: {y, lyDo}}
    votesServer: '', // JSON votes đã đồng bộ lần cuối
    daNopLanNao: false,
  };

  // Bỏ dấu tiếng Việt + về chữ-số-thường — dùng cho tên file avatar + khớp tên
  function khongDauTen(s) {
    return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
  }
  // Mã tài liệu tongLoi/phanHoi trên kho — PHẢI bỏ dấu kiểu slugAvatar, ⛔ đừng dùng slugKey
  // (slugKey chỉ gọt [^A-Z0-9] nên CẮT MẤT chữ có dấu: 'HÀ'->'H', 'THẢO'->'THO' — đã cắn khi test).
  const slugHs = (s) => slugAvatar(s);
  function slugAvatar(s) {
    return khongDauTen(s).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'hs';
  }
  // Ảnh avatar dùng CHUNG kho web andrewclasses.com (xuất từ myStudent — Đợt B).
  // Hỏng/thiếu ảnh -> onerror tự thay bằng vòng tròn chữ tắt (initialsOf có sẵn).
  // ⛔ Thư mục LỚP: bỏ HẾT ký tự không phải chữ-số — "B2B" (speaking) và "B2-B" (myStudent)
  //    phải ra CÙNG một thư mục `b2b`. Script xuất ảnh (myLesson app tools/xuat-avatar.py)
  //    dùng Y HỆT luật này — đổi một bên là đổi CẢ HAI.
  const AVATAR_GOC = 'https://andrewclasses.com/assets/avatar/';
  function avatarUrl(ten) {
    const lop = khongDauTen(tenLopNgan(state.className) || state.classCode).replace(/[^a-z0-9]/g, '');
    return AVATAR_GOC + lop + '/' + slugAvatar(ten) + '.jpg';
  }

  // Mã lỗi ổn định — phiếu phản biện bám theo mã này kể cả khi em chấm sửa chữ trong câu
  function taoErrId() {
    return Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36).padStart(2, '0');
  }

  async function fsGet(duong) {
    const r = await fetch(FS_GOC + duong + fsKey(), { cache: 'no-store' });
    if (r.status === 404) return null;
    if (!r.ok) throw new Error('FS_' + r.status);
    return fsGiaiDoc(await r.json());
  }
  async function fsPatch(duong, duLieu) {
    const fields = {};
    Object.keys(duLieu).forEach((k) => { fields[k] = fsMa(duLieu[k]); });
    const r = await fetch(FS_GOC + duong + fsKey(), {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fields }),
    });
    if (!r.ok) {
      let msg = 'FS_' + r.status;
      try { const j = await r.json(); msg = (j.error && j.error.message) || msg; } catch (e) {}
      throw new Error(msg);
    }
    return true;
  }
  async function fsQuery(buoiId, collectionId, filterField, filterVal, limit) {
    const q = { from: [{ collectionId }], limit: limit || 1000 };
    if (filterField) {
      q.where = { fieldFilter: { field: { fieldPath: filterField }, op: 'EQUAL', value: { stringValue: String(filterVal) } } };
    }
    const r = await fetch(FS_GOC + '/spBuoi/' + encodeURIComponent(buoiId) + ':runQuery' + fsKey(), {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ structuredQuery: q }),
    });
    if (!r.ok) throw new Error('FS_' + r.status);
    const ds = await r.json();
    return (Array.isArray(ds) ? ds : []).filter((x) => x.document).map((x) => fsGiaiDoc(x.document));
  }

  const tongLoiLay = (buoiId, slug) => fsGet('/spBuoi/' + encodeURIComponent(buoiId) + '/tongLoi/' + encodeURIComponent(slug));
  const tongLoiGhi = (buoiId, slug, d) => fsPatch('/spBuoi/' + encodeURIComponent(buoiId) + '/tongLoi/' + encodeURIComponent(slug), d);
  const phanHoiGhi = (buoiId, phId, d) => fsPatch('/spBuoi/' + encodeURIComponent(buoiId) + '/phanHoi/' + encodeURIComponent(phId), d);

  // Chuẩn hoá một lỗi mô hình 2 (bản cũ trong kho có thể thiếu trường mới)
  function chuanLoi(er) {
    return {
      id: String(er.id || taoErrId()),
      trangThai: er.trangThai === 'an' || er.trangThai === 'go' ? er.trangThai : 'song',
      ketLuan: er.ketLuan === 'keep' || er.ketLuan === 'agree' ? er.ketLuan : '',
      min: +er.min || 0, sec: +er.sec || 0, section: '',
      who: String(er.who || ''), type: String(er.type || ''),
      sentence: String(er.sentence || ''), detail: String(er.detail || ''), explain: String(er.explain || ''),
    };
  }
  // Ảnh chụp phần SẼ GHI LÊN KHO — so sánh chuỗi = biết có gì chưa gửi
  function m2ChupCham() {
    return JSON.stringify({ e: state.errors, t: cleanTimers() });
  }
  function m2GhiNhanDongBo() {
    m2.serverBan = m2ChupCham();
    m2.serverIds = {};
    state.errors.forEach((e) => { if (e.id) m2.serverIds[e.id] = JSON.stringify(e); });
  }
  function m2LoiDaDongBo(e) {
    return !!(e.id && m2.serverIds[e.id] === JSON.stringify(e));
  }
  function m2CoSuaChuaGui() {
    if (state.moHinh !== 2) return false;
    if (state.cheDo === 'phanbien') return JSON.stringify(m2.votes) !== m2.votesServer;
    return m2ChupCham() !== m2.serverBan;
  }

  // Nút SUBMIT 3 màu (thầy chốt): TRẮNG chưa gửi lần nào · XANH LÁ đã gửi ·
  // VÀNG nhấp nháy to-nhỏ khi có sửa chưa gửi. Chỉ áp cho mô hình 2.
  function capNhatNutSubmit() {
    if (state.moHinh !== 2) return;
    const b = $('btnSubmit');
    b.classList.remove('bg-emerald-500', 'hover:bg-emerald-400', 'bg-white', 'text-emerald-700',
      'hover:bg-emerald-50', 'nut-vang-nhay', 'bg-amber-400', 'hover:bg-amber-300', 'text-slate-900');
    const daCo = state.cheDo === 'phanbien' ? (m2.votesServer !== '' && m2.votesServer !== '{}') : m2.daNopLanNao;
    if (m2CoSuaChuaGui()) b.classList.add('bg-amber-400', 'hover:bg-amber-300', 'text-slate-900', 'nut-vang-nhay');
    else if (daCo) b.classList.add('bg-emerald-500', 'hover:bg-emerald-400');
    else b.classList.add('bg-white', 'text-emerald-700', 'hover:bg-emerald-50');
  }

  // Pop-up loading chặn thao tác (vào bài + SUBMIT — thầy chốt phải có)
  function loadingHien(chu) {
    $('m2LoadText').textContent = chu || 'Loading…';
    $('m2LoadModal').classList.remove('hidden');
    $('m2LoadModal').classList.add('flex');
    refreshIcons();
  }
  function loadingAn() {
    $('m2LoadModal').classList.add('hidden');
    $('m2LoadModal').classList.remove('flex');
  }

  // Mã lượt nộp yyMMdd-HHmmss-<3 số>, giờ VN — ⛔ CÙNG ĐỊNH DẠNG makeSid trong Code.gs
  // (sid là "khoá thời gian" của cả hệ: so chuỗi = so thời gian, python khử trùng theo nó).
  function taoSid() {
    const t = new Date(Date.now() + 7 * 3600 * 1000);
    const p = (n) => String(n).padStart(2, '0');
    return String(t.getUTCFullYear()).slice(2) + p(t.getUTCMonth() + 1) + p(t.getUTCDate()) +
      '-' + p(t.getUTCHours()) + p(t.getUTCMinutes()) + p(t.getUTCSeconds()) +
      '-' + Math.floor(Math.random() * 900 + 100);
  }
  // 'dd/MM/yyyy HH:mm' từ chuỗi ISO — cùng dạng chữ `luc` mà bộ não cũ trả về cho pop-up lịch sử
  function gioDep(iso) {
    const d = new Date(iso);
    if (isNaN(d)) return '';
    const p = (n) => String(n).padStart(2, '0');
    return p(d.getDate()) + '/' + p(d.getMonth() + 1) + '/' + d.getFullYear() + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }

  // ─── Lưu / khôi phục tạm (localStorage) ───
  let saveTimer = null;
  function autosave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      state.savedAt = new Date().toISOString();   // CHẶNG 29: mốc lưu — xếp danh sách "bài đã nộp"
      try { localStorage.setItem(saveKey, JSON.stringify(state)); } catch (e) {}
      // (Đợt B) mọi thay đổi đều đi qua autosave → cập nhật màu nút SUBMIT tại đây một thể
      if (state.moHinh === 2) capNhatNutSubmit();
    }, 300);
  }
  function loadSaved() {
    try { return JSON.parse(localStorage.getItem(saveKey)); } catch (e) { return null; }
  }

  // ═══════════════ CHẶNG 33 — MỖI HỌC SINH MỘT Ô NHỚ RIÊNG ═══════════════
  // ⛔ LỖI CŨ ĐÃ TRẢ GIÁ: khoá lưu chỉ theo LINK VIDEO (`myspeaking_<video>`). Hai em CÙNG ĐỘI thì
  // chấm CÙNG một video ⇒ dùng CHUNG một ô nhớ. Em B đăng nhập trên cùng máy: app không nạp bài của
  // em A (có so tên) NHƯNG autosave của em B GHI ĐÈ lên ô đó ⇒ bài + lịch sử của em A MẤT SẠCH.
  // Nay khoá = tên em + link video ⇒ ai lưu bài nấy, và lịch sử lọc theo tên (xem submittedSaves).
  // Bài lưu bằng khoá CŨ vẫn đọc lại được: submittedSaves đọc mọi khoá `myspeaking_` rồi lọc theo
  // trường `student` nằm TRONG dữ liệu, không dựa vào hình dạng khoá.
  function slugKey(s) {
    return String(s || '').trim().toUpperCase().replace(/\s+/g, '-').replace(/[^A-Z0-9\-]/g, '') || 'HS';
  }
  function makeSaveKey(student, videoUrl) {
    return 'myspeaking_' + slugKey(student) + '_' + String(videoUrl || 'manual').slice(-60);
  }

  // ─── Toast ───
  function toast(msg, kind) {
    const t = $('toast'), inner = $('toastInner');
    inner.className = 'rounded-2xl px-5 py-3 shadow-2xl text-white font-bold text-sm flex items-center gap-2 slidein ' +
      (kind === 'err' ? 'bg-rose-600' : kind === 'info' ? 'bg-indigo-600' : 'bg-emerald-600');
    inner.textContent = msg;
    t.classList.remove('hidden');
    clearTimeout(toast._h);
    toast._h = setTimeout(() => t.classList.add('hidden'), 2600);
  }

  // ═══════════════ VIDEO ═══════════════
  const video = { mode: 'none', yt: null, el: null, ready: false };

  function parseVideoUrl(url) {
    if (!url) return null;
    url = url.trim();
    let m = url.match(/(?:youtube\.com\/(?:watch\?.*v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{6,})/);
    if (m) return { type: 'youtube', id: m[1] };
    m = url.match(/drive\.google\.com\/file\/d\/([\w-]+)/) || url.match(/drive\.google\.com\/(?:open|uc).*[?&]id=([\w-]+)/);
    if (m) return { type: 'drive', id: m[1] };
    if (/^https?:\/\/.+\.(mp4|webm|m4v|mov)(\?|$)/i.test(url)) return { type: 'direct', url: url };
    return { type: 'unknown', url: url };
  }

  function setVideoStatus(html) {
    $('videoStatus').innerHTML = html;
    fitVideoInfo();
    // Đo LẦN NỮA sau khi bố cục ổn định: lúc vừa gán chữ, khung video (desktop giãn theo lưới,
    // mobile chờ video vào) có thể chưa đúng bề ngang cuối cùng ⇒ đo sớm sẽ hạ cỡ chữ oan.
    clearTimeout(setVideoStatus._t);
    setVideoStatus._t = setTimeout(fitVideoInfo, 350);
  }

  // ═══════════════ CHẶNG 34 — DÒNG DƯỚI VIDEO LUÔN GỌN 1 DÒNG ═══════════════
  // Thầy chốt: chữ "CLASS" chỉ dùng ở màn đăng nhập; vào bài rồi thì chỉ cần TÊN LỚP.
  // Và dòng này KHÔNG BAO GIỜ được tràn xuống dòng 2 — đội 3 người (VD "DIEM MY · CUONG · KHOI")
  // trên máy 320px là chắc chắn tràn nếu để cỡ chữ cố định. Cách làm: khoá 1 dòng bằng CSS
  // (flex-nowrap + whitespace-nowrap) rồi TỰ HẠ CỠ CHỮ cho tới khi vừa khung (14px → 9px).
  function tenLopNgan(s) {
    return String(s || '').replace(/^\s*(CLASS|L[ớơo]p)\s+/i, '').trim();   // "CLASS B1AH" → "B1AH"
  }
  function fitVideoInfo() {
    const el = $('videoStatus');
    if (!el || !el.firstChild) return;
    const MAX = window.innerWidth >= 1024 ? 14 : 13, MIN = 9;
    let px = MAX;
    el.style.fontSize = px + 'px';
    // + 1px dung sai: scrollWidth/clientWidth hay lệch 1px do bo tròn phân số
    while (px > MIN && el.scrollWidth > el.clientWidth + 1) {
      px -= 0.5;
      el.style.fontSize = px + 'px';
    }
  }

  // Dòng thông tin dưới video: LỚP · ĐỘI ĐƯỢC CHẤM · các thành viên (thay cho chữ trạng thái kỹ thuật)
  // CHẶNG 34: chỉ TÊN LỚP (bỏ chữ "CLASS" — chữ đó chỉ dùng ở màn đăng nhập, thầy chốt).
  function videoInfoHtml() {
    const mem = (state.members || []).join(' · ');
    return '<i data-lucide="users" class="w-3.5 h-3.5 text-indigo-500 shrink-0"></i> ' +
      '<b>' + escapeHtml(tenLopNgan(state.className)) + '</b><span class="text-slate-300">|</span>' +
      '<b class="text-indigo-600">' + escapeHtml(state.checkedTeam) + '</b>' +
      (mem ? '<span class="text-slate-300">|</span><span class="font-semibold">' + escapeHtml(mem) + '</span>' : '');
  }

  // ─── Khung điều khiển video LUÔN HIỆN (nút gốc của trình duyệt tự ẩn — không cấm được,
  //     nên tự vẽ khung rời: play/pause + thời gian + thanh tua, không bao giờ ẩn) ───
  const vc = { dragging: false, playing: null, poll: null };
  function fmtClock(s) { s = Math.max(0, Math.floor(s || 0)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
  function vcShow() { const el = $('videoCtrl'); el.classList.remove('hidden'); el.classList.add('flex'); }
  function vcSetPlaying(p) {
    if (vc.playing === p) return;
    vc.playing = p;
    $('vcPlay').innerHTML = '<i data-lucide="' + (p ? 'pause' : 'play') + '" class="w-5 h-5 pointer-events-none"></i>';
    refreshIcons();
  }
  // Tô phần ĐÃ CHẠY màu đỏ trên thanh tua (custom range không có accent-fill sẵn)
  function vcFill(pct) {
    pct = Math.max(0, Math.min(100, pct || 0));
    $('vcSeek').style.background = 'linear-gradient(to right, #e11d48 ' + pct + '%, #e2e8f0 ' + pct + '%)';
  }
  function vcUpdate(cur, dur) {
    if (!vc.dragging && dur) { $('vcSeek').value = Math.round((cur / dur) * 1000); }
    if (!vc.dragging) vcFill(dur ? (cur / dur) * 100 : 0);
    $('vcCur').textContent = fmtClock(cur);
    $('vcDur').textContent = fmtClock(dur);
  }
  function vcDuration() {
    if (video.mode === 'html5' && video.el) return video.el.duration || 0;
    if (video.mode === 'youtube' && video.yt && video.ready) { try { return video.yt.getDuration() || 0; } catch (e) { return 0; } }
    return 0;
  }
  // Video ĐANG PHÁT tới đâu → ô MIN/SEC chạy theo tới đó; PAUSE thì dừng để HS chỉnh tay
  function syncTimeFields(cur) {
    const s = Math.max(0, Math.floor(cur || 0));
    $('fMin').value = Math.floor(s / 60);
    $('fSec').value = s % 60;
    autoPickStudent(s);
  }

  // Khoảng thời gian nói của 1 HS (null nếu chưa nhập đủ 4 ô)
  function timerRangeOf(t) {
    if (['sMin', 'sSec', 'eMin', 'eSec'].some((k) => String(t[k]).trim() === '')) return null;
    return { s: (parseInt(t.sMin, 10) || 0) * 60 + (parseInt(t.sSec, 10) || 0), e: (parseInt(t.eMin, 10) || 0) * 60 + (parseInt(t.eSec, 10) || 0) };
  }
  // Video đang ở trong khoảng nói của HS nào → tự sáng tên HS đó
  function autoPickStudent(cur) {
    if (!state.members.length) return;
    for (let i = 0; i < state.timers.length; i++) {
      const r = timerRangeOf(state.timers[i]);
      if (r && cur >= r.s && cur <= r.e) {
        if (fWhoSel !== state.timers[i].name) { fWhoSel = state.timers[i].name; renderWhoBtns(); }
        return;
      }
    }
  }

  // Chỉnh tay MIN/SEC (Enter hoặc click ra ngoài) → video nhảy theo
  function seekVideoTo(t) {
    t = Math.max(0, t || 0);
    const d = vcDuration();
    if (d) t = Math.min(t, Math.max(0, d - 0.2));
    if (video.mode === 'html5' && video.el) video.el.currentTime = t;
    else if (video.mode === 'youtube' && video.yt && video.ready) { try { video.yt.seekTo(t, true); } catch (e) {} }
    // chế độ dự phòng (iframe): không seek được video Drive — HS dùng thanh kéo + SET TIME
    vcUpdate(t, d);
    autoPickStudent(Math.floor(t));
  }
  function manualTimeSeek() {
    seekVideoTo((parseInt($('fMin').value, 10) || 0) * 60 + (parseInt($('fSec').value, 10) || 0));
  }
  function vcAttachHtml5(v) {
    vcShow();
    v.addEventListener('timeupdate', () => {
      vcUpdate(v.currentTime, v.duration);
      if (!v.paused) syncTimeFields(v.currentTime);
    });
    // Click thẳng vào thanh gốc của video (kể cả khi ĐANG DỪNG) → MIN/SEC nhảy theo ngay
    v.addEventListener('seeked', () => {
      vcUpdate(v.currentTime, v.duration);
      if (v.paused) syncTimeFields(v.currentTime);
    });
    v.addEventListener('durationchange', () => vcUpdate(v.currentTime, v.duration));
    v.addEventListener('play', () => vcSetPlaying(true));
    v.addEventListener('pause', () => vcSetPlaying(false));
    vcUpdate(v.currentTime, v.duration);
    vcSetPlaying(!v.paused);
  }
  function vcAttachYouTube() {
    vcShow();
    clearInterval(vc.poll);
    vc.poll = setInterval(() => {
      try {
        const playing = video.yt.getPlayerState() === 1;
        vcUpdate(video.yt.getCurrentTime() || 0, video.yt.getDuration() || 0);
        vcSetPlaying(playing);
        if (playing) syncTimeFields(video.yt.getCurrentTime() || 0);
      } catch (e) {}
    }, 300);
  }

  function initVideo() {
    const box = $('videoContainer');
    const p = parseVideoUrl(state.videoUrl);
    if (!p) {
      box.innerHTML = '<div class="w-full h-full flex items-center justify-center text-slate-400 text-sm bg-slate-900 rounded-2xl">No video yet</div>';
      return;
    }
    if (p.type === 'youtube') initYouTube(box, p.id);
    else if (p.type === 'drive') initDriveDirect(box, p.id);
    else if (p.type === 'direct') initHtml5(box, [p.url], null);
    else {
      box.innerHTML = '<div class="w-full h-full flex items-center justify-center text-slate-400 text-sm bg-slate-900 rounded-2xl px-6 text-center">Couldn\'t recognise the video link. Please use a YouTube or Google Drive link.</div>';
    }
  }

  // — YouTube (đọc thời gian chính xác qua IFrame API) —
  function initYouTube(box, id) {
    video.mode = 'youtube';
    box.innerHTML = '<div id="ytPlayer"></div>';
    setVideoStatus('<i data-lucide="loader" class="w-3.5 h-3.5 animate-spin"></i> Loading YouTube…');
    refreshIcons();
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(tag);
    window.onYouTubeIframeAPIReady = function () {
      video.yt = new YT.Player('ytPlayer', {
        videoId: id,
        playerVars: { rel: 0, modestbranding: 1, playsinline: 1 },
        events: {
          onReady: () => {
            video.ready = true;
            setVideoStatus(videoInfoHtml());
            vcAttachYouTube();
            refreshIcons();
          },
        },
      });
    };
  }

  // — Drive phát trực tiếp, tự fallback sang iframe + đồng hồ —
  // Lưu ý: file >100MB bị Google chặn bằng trang "Virus scan warning" (chỉ chặn
  // trình duyệt — Google nhận diện qua User-Agent), nên 2 endpoint download chỉ
  // chạy được với file nhỏ. Drive API + key là đường chính thống cho file lớn.
  function initDriveDirect(box, id) {
    const candidates = [];
    if (CFG.DRIVE_API_KEY) {
      candidates.push('https://www.googleapis.com/drive/v3/files/' + id + '?alt=media&key=' + CFG.DRIVE_API_KEY);
    }
    candidates.push(
      'https://drive.usercontent.google.com/download?id=' + id + '&export=download&confirm=t',
      'https://drive.google.com/uc?export=download&id=' + id
    );
    setVideoStatus('<i data-lucide="loader" class="w-3.5 h-3.5 animate-spin"></i> Trying to play directly from Drive…');
    refreshIcons();
    initHtml5(box, candidates, () => initDriveIframe(box, id));
  }

  function initHtml5(box, candidates, onAllFail) {
    video.mode = 'html5';
    let i = 0;
    box.innerHTML = '';
    const v = document.createElement('video');
    v.controls = true; v.playsInline = true; v.preload = 'metadata';
    box.appendChild(v);
    video.el = v;
    let settled = false;
    let guard = null;

    function tryNext() {
      if (settled) return;
      if (i >= candidates.length) {
        settled = true;
        clearTimeout(guard);
        if (onAllFail) onAllFail();
        return;
      }
      v.src = candidates[i++];
      clearTimeout(guard);
      // Chờ lâu hơn (25s): lỗi thật (403/format) đã bắn 'error' NGAY nên fallback vẫn nhanh khi hỏng;
      // timeout chỉ cứu trường hợp mạng CHẬM tải metadata file lớn — thà chờ còn hơn rơi dự phòng nhầm.
      guard = setTimeout(() => { if (!video.ready) tryNext(); }, 25000);
      v.load();
    }
    v.addEventListener('error', tryNext);
    v.addEventListener('loadedmetadata', () => {
      if (settled) return;
      settled = true;
      clearTimeout(guard);
      video.ready = true;
      setVideoStatus(videoInfoHtml());
      vcAttachHtml5(v);
      refreshIcons();
    });
    tryNext();
  }

  // — Fallback: iframe Drive + THANH KÉO tay (iframe Drive không cho JS đọc giờ phát) —
  // HS xem giờ trên trình phát Drive, kéo thanh cho khớp, bấm SET TIME để đưa vào MIN/SEC.
  function initDriveIframe(box, id) {
    video.mode = 'stopwatch';   // giữ tên mode = chế độ dự phòng (iframe + thanh kéo tay)
    video.el = null;
    box.innerHTML = '<iframe src="https://drive.google.com/file/d/' + id + '/preview" allow="autoplay; fullscreen" allowfullscreen></iframe>';
    const wrap = $('stopwatchWrap');
    wrap.classList.remove('hidden'); wrap.classList.add('flex');
    swFill();
    setVideoStatus(videoInfoHtml());
    refreshIcons();
  }
  // Tô phần đã qua XANH DƯƠNG trên thanh kéo dự phòng
  function swFill() {
    const el = $('swSeek'); if (!el) return;
    const pct = (el.value - el.min) / (el.max - el.min) * 100;
    el.style.background = 'linear-gradient(to right, #2563eb ' + pct + '%, #dbeafe ' + pct + '%)';
  }
  // Đốm sáng bay từ điểm (x0,y0) tới ô đích rồi tan
  function flyLight(x0, y0, toEl) {
    const b = toEl.getBoundingClientRect();
    const x1 = b.left + b.width / 2, y1 = b.top + b.height / 2;
    const dot = document.createElement('div');
    dot.style.cssText = 'position:fixed;left:0;top:0;width:16px;height:16px;margin:-8px 0 0 -8px;border-radius:9999px;background:radial-gradient(circle,#93c5fd,#2563eb);box-shadow:0 0 14px 5px rgba(37,99,235,.8);z-index:9999;pointer-events:none';
    document.body.appendChild(dot);
    const anim = dot.animate([
      { transform: 'translate(' + x0 + 'px,' + y0 + 'px) scale(1)', opacity: 1 },
      { transform: 'translate(' + ((x0 + x1) / 2) + 'px,' + (Math.min(y0, y1) - 46) + 'px) scale(1.5)', opacity: 1, offset: .55 },
      { transform: 'translate(' + x1 + 'px,' + y1 + 'px) scale(.25)', opacity: 0 }
    ], { duration: 650, easing: 'cubic-bezier(.35,0,.2,1)' });
    anim.onfinish = () => dot.remove();
  }
  function flashEl(el) { el.classList.remove('time-flash'); void el.offsetWidth; el.classList.add('time-flash'); }
  // Bấm SET TIME: đưa giờ thanh kéo → MIN/SEC kèm ánh sáng bay
  function swSetTime() {
    const secs = parseInt($('swSeek').value, 10) || 0;
    const el = $('swSeek'), r = el.getBoundingClientRect();
    const frac = (el.value - el.min) / (el.max - el.min);
    flyLight(r.left + frac * r.width, r.top + r.height / 2, $('fMin'));
    setTimeout(() => {
      $('fMin').value = Math.floor(secs / 60); $('fSec').value = secs % 60;
      flashEl($('fMin')); flashEl($('fSec'));
      autoPickStudent(secs);
    }, 430);
  }

  // ═══════════════ FORM BẮT LỖI ═══════════════
  // Chọn HS có lỗi = DÃY NÚT TÊN — CHỈ các thành viên đã xác định (không Whole team / Someone else).
  // Luôn xếp vừa 1 HÀNG: flex + flex-1 chia đều, chữ nhỏ, truncate chống tràn.
  // Bấm ai người đó sáng, 1 thời điểm chỉ 1 tên (1 người nói tại 1 thời điểm).
  let fWhoSel = '';
  // Ô nhập thời gian nói nhỏ dưới tên (min:sec → min:sec) — type=text + inputmode để không có nút spin chiếm chỗ
  const T_IN = 'tIn w-full min-w-0 rounded-md border border-slate-300 bg-white px-0.5 py-1 text-center font-mono text-[11px] focus:outline-none focus:ring-1 focus:ring-indigo-500';
  function timerCellHtml(i) {
    const t = state.timers[i] || { sMin: '', sSec: '', eMin: '', eSec: '' };
    const inp = (k, ph) => '<input data-tt="' + i + ':' + k + '" type="text" inputmode="numeric" value="' + escapeHtml(t[k]) + '" placeholder="' + ph + '" class="' + T_IN + '">';
    // Mobile: 2 tầng (bắt đầu ↓ kết thúc) cho ô đủ to để gõ; ≥640px: 1 hàng có mũi tên →
    return '<div class="mt-1 rounded-lg bg-slate-50 border border-slate-200 px-1 py-1 flex flex-col sm:flex-row items-stretch sm:items-center gap-0.5">' +
      '<div class="flex items-center gap-0.5 flex-1 min-w-0">' + inp('sMin', '0') + '<span class="text-slate-400 font-bold text-[11px]">:</span>' + inp('sSec', '00') + '</div>' +
      '<span class="hidden sm:inline text-slate-400 text-[11px] px-0.5">→</span>' +
      '<span class="sm:hidden text-slate-300 text-[10px] leading-none text-center">↓</span>' +
      '<div class="flex items-center gap-0.5 flex-1 min-w-0">' + inp('eMin', '0') + '<span class="text-slate-400 font-bold text-[11px]">:</span>' + inp('eSec', '00') + '</div>' +
      '</div>';
  }
  function buildStudentField() {
    const wrap = $('fStudentWrap');
    if (state.members.length) {
      // mỗi thành viên = 1 CỘT: nút tên trên + khung thời gian nói dưới (from → to, BẮT BUỘC trước khi Submit)
      const cols = state.members.map((n, i) =>
        '<div class="flex-1 min-w-0">' +
        '<button type="button" data-who="' + escapeHtml(n) + '" class="whoBtn">' + escapeHtml(n) + '</button>' +
        timerCellHtml(i) +
        '</div>'
      ).join('');
      wrap.innerHTML = '<div class="flex gap-1.5">' + cols + '</div>';
      renderWhoBtns();
    } else {
      wrap.innerHTML = '<input id="fWho" type="text" placeholder="Name of the student" class="w-full rounded-xl border border-slate-300 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500">';
    }
  }
  function renderWhoBtns() {
    document.querySelectorAll('.whoBtn').forEach((b) => {
      const on = b.dataset.who === fWhoSel;
      b.className = 'whoBtn w-full min-w-0 rounded-lg border-2 px-1 py-2 text-[11px] sm:text-xs font-bold leading-tight transition truncate text-center ' +
        (on ? TYPE_ON : TYPE_OFF);   // chọn tên = KHUNG VÀNG y hệt phần TYPE
    });
  }
  // Nháy viền đỏ ô/khu vực còn thiếu (giống lối báo "thiếu ô giờ" lúc Submit).
  // Chỉ báo bằng toast thì HS đang nhìn chỗ khác không biết thiếu mục nào.
  function flashBox(el) {
    if (!el) return;
    el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    el.classList.add('ring-2', 'ring-red-400', 'rounded-xl');
    setTimeout(() => el.classList.remove('ring-2', 'ring-red-400', 'rounded-xl'), 1600);
  }
  function flashStudentField() { flashBox($('fStudentWrap')); }
  function flashTypeField() { document.querySelectorAll('.errType').forEach(flashBox); }
  function getWho() {
    if (!state.members.length) { const el = $('fWho'); return el ? el.value.trim() : ''; }
    return fWhoSel;
  }
  function setWho(val) {
    if (!state.members.length) { const el = $('fWho'); if (el) el.value = val; return; }
    fWhoSel = state.members.includes(val) ? val : '';
    renderWhoBtns();
  }

  // Nút loại lỗi: mặc định cả 3 NỀN TRẮNG, chọn thì KHUNG VÀNG (badge trong danh sách vẫn giữ màu riêng)
  const TYPE_ON = 'border-amber-400 bg-amber-50 text-slate-900 shadow shadow-amber-200';
  const TYPE_OFF = 'border-slate-200 bg-white text-slate-700 hover:border-slate-300';
  // TYPE lưu bằng TIẾNG ANH (khớp mẫu mới của thầy: Grammar / Pronunciation / Information)
  const TYPE_STYLE = {
    // CHẶNG 33: `short` = chữ cái dùng cho ô ĐẾM ở đầu khung Mistakes found (G/P/I).
    // Lý do: trên điện thoại nhỏ, "Pronunciation: 5" + "Information: 2" đẩy ô cuối LÒI RA NGOÀI khung.
    'Grammar': { badge: 'bg-blue-100 text-blue-700', short: 'G' },
    'Pronunciation': { badge: 'bg-emerald-100 text-emerald-700', short: 'P' },
    'Information': { badge: 'bg-amber-100 text-amber-700', short: 'I' },
  };
  const typeLabel = (t) => t;   // giá trị lưu đã là tiếng Anh → hiển thị nguyên
  function renderTypeBtns() {
    document.querySelectorAll('.errType').forEach((b) => {
      b.className = 'errType rounded-lg border-2 px-0.5 sm:px-1 py-2 text-[10px] sm:text-xs font-bold leading-tight transition flex flex-row items-center justify-center gap-1.5 ' +
        (fType === b.dataset.type ? TYPE_ON : TYPE_OFF);
    });
  }

  // Ô textarea (SENTENCE / MISTAKE / EXPLANATION) tự giãn cao theo nội dung để xem HẾT chữ
  function autoGrow(el) { if (!el) return; el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; }
  function autoGrowAll() { ['fSentence', 'fDetail', 'fExplain'].forEach((id) => autoGrow($(id))); }

  function clearErrForm() {
    // XOÁ MIN/SEC sau khi thêm/sửa: tránh HS thêm 2 lỗi mà chưa chọn lại thời gian.
    // (Video đang PHÁT sẽ tự điền lại MIN/SEC theo giờ hiện tại ngay — không sao.)
    $('fMin').value = ''; $('fSec').value = '';
    $('fSentence').value = ''; $('fDetail').value = ''; $('fExplain').value = '';
    autoGrowAll();
    fType = ''; renderTypeBtns();
    editingIndex = -1;
    $('btnAddErrLabel').textContent = 'Add this mistake';
    $('btnCancelEdit').classList.add('hidden');
  }

  // Khi THÊM lỗi mới: LUÔN lùi 3 giây (HS nghe thấy lỗi rồi mới gõ nên mốc thật sớm hơn ~3s).
  // KHÔNG lùi khi SỬA lỗi cũ (mốc đã được lùi từ lần thêm rồi).
  const REWIND_SEC = 3;
  function addOrUpdateError() {
    if (reviewLocked) return;   // CHẶNG 29: đang XEM bài đã nộp — muốn sửa phải bấm "Edit & submit again"
    const sentence = $('fSentence').value.trim();
    const detail = $('fDetail').value.trim();
    const explain = $('fExplain').value.trim();
    // BẮT BUỘC ĐỦ 6 MỤC (chặng 24-25) — kiểm theo ĐÚNG THỨ TỰ TRÊN FORM để HS sửa từ trên xuống:
    // STUDENT → TIME → TYPE → SENTENCE → MISTAKE → EXPLANATION.
    // Trước đây bỏ trống được → 39/97 dòng thật thiếu tên, có dòng thiếu giờ ⇒ app máy tính không
    // ghép được lỗi với người/với mốc video.
    const minRaw = $('fMin').value.trim();
    const secRaw = $('fSec').value.trim();
    if (!getWho()) { toast('Please choose WHO made the mistake!', 'err'); flashStudentField(); return; }
    if (minRaw === '' || secRaw === '') {
      toast('Please fill in the TIME (MIN and SEC) of the mistake!', 'err');
      flashBox($('fMin')); flashBox($('fSec'));
      (minRaw === '' ? $('fMin') : $('fSec')).focus();
      return;
    }
    if (!fType) { toast('Please choose a TYPE!', 'err'); flashTypeField(); return; }
    if (!sentence) { toast('Please write the SENTENCE that has the mistake!', 'err'); flashBox($('fSentence')); $('fSentence').focus(); return; }
    if (!detail) { toast('Please describe the MISTAKE!', 'err'); flashBox($('fDetail')); $('fDetail').focus(); return; }
    if (!explain) { toast('Please write the EXPLANATION!', 'err'); flashBox($('fExplain')); $('fExplain').focus(); return; }

    let mn = Math.max(0, parseInt(minRaw, 10) || 0);
    let sc = Math.max(0, parseInt(secRaw, 10) || 0);
    if (editingIndex < 0) {
      const tot = Math.max(0, mn * 60 + sc - REWIND_SEC);   // LUÔN lùi 3s khi thêm mới
      mn = Math.floor(tot / 60); sc = tot % 60;
    }
    const err = {
      min: mn, sec: sc,
      section: '',   // ô SECTION đã bỏ (chặng 11) — giữ field rỗng để cấu trúc Excel/Sheet không đổi
      who: getWho(),
      type: fType,
      sentence: sentence,   // MỚI (chặng 15): câu chứa lỗi
      detail: detail,
      explain: explain,
    };
    // (Đợt B) mã lỗi ỔN ĐỊNH + trạng thái: SỬA giữ nguyên mã cũ (phiếu phản biện bám theo mã),
    // THÊM MỚI sinh mã mới. Trường thừa vô hại với mô hình 1 (sheet/Excel chỉ đọc đúng cột của nó).
    if (editingIndex >= 0) {
      const cu = state.errors[editingIndex] || {};
      err.id = cu.id || taoErrId();
      err.trangThai = cu.trangThai === 'go' ? 'go' : 'song';
      err.ketLuan = cu.ketLuan || '';
    } else {
      err.id = taoErrId();
      err.trangThai = 'song';
      err.ketLuan = '';
    }
    if (editingIndex >= 0) { state.errors[editingIndex] = err; toast('Mistake updated ✓'); }
    else { state.errors.push(err); toast('Mistake added ✓ (' + state.errors.length + ' total)'); }
    clearErrForm();
    renderErrors();
    autosave();
  }

  function renderErrors() {
    if (state.cheDo === 'phanbien') { renderErrorsPb(); return; }
    const list = $('errList');
    const m2Mode = state.moHinh === 2;
    // (Đợt B) mô hình 2: 'an' (em tự xoá) KHÔNG hiện; 'go' (được Agree) mờ+gạch, chìm xuống cuối;
    // bật nút DISAGREEMENT thì câu tranh chấp CHƯA xử lý dồn lên đầu (thầy chốt).
    let ds = state.errors.map((e, i) => ({ e, i }));
    if (m2Mode) ds = ds.filter((x) => x.e.trangThai !== 'an');
    ds.sort((a, b) => (tSec(a.e) - tSec(b.e)));
    if (m2Mode) {
      const hang = (x) => {
        if (x.e.trangThai === 'go') return 2;
        if (m2.disOn && !x.e.ketLuan && phieuCuaLoi(x.e.id).some((p) => p.y === 'phanDoi')) return 0;
        return 1;
      };
      ds.sort((a, b) => hang(a) - hang(b) || (tSec(a.e) - tSec(b.e)));
    }
    list.innerHTML = ds.map(({ e, i }, pos) => {
      const st = TYPE_STYLE[e.type] || { badge: 'bg-slate-100 text-slate-600' };
      const daGo = m2Mode && e.trangThai === 'go';
      const phieu = m2Mode ? phieuCuaLoi(e.id) : [];
      // Icon uploaded (chấm xanh trái ô): câu này ĐÃ nằm trên kho đúng y bản đang thấy
      const daLuu = m2Mode && m2LoiDaDongBo(e);
      return '<div class="slidein rounded-2xl border p-3.5 transition group ' +
        (daGo ? 'err-go border-slate-200' : 'border-slate-200 hover:border-indigo-300') + '">' +
        '<div class="flex items-center gap-2 flex-wrap">' +
        (m2Mode ? '<span class="shrink-0 w-4 h-4 rounded-full flex items-center justify-center ' +
          (daLuu ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-400') + '" title="' +
          (daLuu ? 'Saved to server' : 'Not submitted yet') + '"><i data-lucide="' + (daLuu ? 'check' : 'arrow-up') + '" class="w-2.5 h-2.5 pointer-events-none"></i></span>' : '') +
        // CHẶNG 33: STT đứng TRƯỚC mốc giờ. Đánh theo THỨ TỰ THỜI GIAN (danh sách đã sort)
        // → khớp cách đánh số của file Excel bên app máy tính.
        '<span class="shrink-0 w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 font-extrabold text-xs flex items-center justify-center">' + (pos + 1) + '</span>' +
        '<span class="font-mono font-bold text-sm bg-slate-900 text-white rounded-lg px-2 py-0.5">' + fmtTime(e) + '</span>' +
        (e.section ? '<span class="text-xs font-bold text-slate-500">Section ' + escapeHtml(e.section) + '</span>' : '') +
        '<span class="text-xs font-bold rounded-full px-2.5 py-1 ' + st.badge + '">' + typeLabel(e.type) + '</span>' +
        (e.who ? '<span class="text-xs font-semibold text-slate-600 flex items-center gap-1">👤 ' + escapeHtml(e.who) + '</span>' : '') +
        (daGo ? '<span class="text-[10px] font-extrabold text-slate-400 border border-slate-300 rounded-full px-2 py-0.5">RELEASED</span>' : '') +
        (m2Mode && e.ketLuan === 'keep' ? '<span class="text-[10px] font-extrabold text-rose-500 border border-rose-300 rounded-full px-2 py-0.5">KEPT</span>' : '') +
        '<span class="ml-auto flex items-center gap-1">' +
        // (Đợt B) avatar người chấp nhận (nền xanh) / phản đối (nền đỏ) — bấm mở pop-up nội dung
        (phieu.length ? '<span class="flex items-center mr-1">' + phieu.map((p) => avatarVong(p.voter, p.y, e.id)).join('') + '</span>' : '') +
        (daGo ? '' :
          '<span class="flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition">' +
          '<button data-edit="' + i + '" class="p-1.5 rounded-lg hover:bg-indigo-100 text-indigo-600"><i data-lucide="pencil" class="w-4 h-4 pointer-events-none"></i></button>' +
          '<button data-del="' + i + '" class="p-1.5 rounded-lg hover:bg-rose-100 text-rose-500"><i data-lucide="trash-2" class="w-4 h-4 pointer-events-none"></i></button>' +
          '</span>') +
        '</span></div>' +
        // CHẶNG 35 (thầy chốt): thứ tự SENTENCE → MISTAKE → EXPLANATION, mỗi dòng một kiểu chữ:
        // câu chứa lỗi = ĐEN đậm NGHIÊNG · lỗi = ĐỎ đậm thường · giải thích = XANH LÁ đậm thường.
        (e.sentence ? '<div class="mt-1.5 text-sm font-bold italic text-slate-900">“' + escapeHtml(e.sentence) + '”</div>' : '') +
        '<div class="mt-0.5 text-sm font-bold text-rose-600">' + escapeHtml(e.detail) + '</div>' +
        (e.explain ? '<div class="mt-0.5 text-sm font-bold text-emerald-600">' + escapeHtml(e.explain) + '</div>' : '') +
        '</div>';
    }).join('');
    $('errEmpty').style.display = ds.length ? 'none' : '';

    // đếm theo loại (badge tab đã bỏ cùng tab bar ở chặng 12)
    // CHẶNG 33: dùng CHỮ CÁI G/P/I (không phải tên đầy đủ) — tên đầy đủ làm ô cuối lòi ra ngoài
    // khung trên điện thoại nhỏ. Chữ cái in đậm + `whitespace-nowrap` để không bao giờ vỡ dòng.
    // (Đợt B) mô hình 2: chỉ đếm câu CÒN SỐNG — câu 'go'/'an' không tính (thầy chốt).
    const counts = {};
    (m2Mode ? state.errors.filter((e) => e.trangThai === 'song') : state.errors)
      .forEach((e) => { counts[e.type] = (counts[e.type] || 0) + 1; });
    $('errStats').innerHTML = Object.keys(TYPE_STYLE)
      .filter((t) => counts[t])
      .map((t) => '<span title="' + typeLabel(t) + '" class="rounded-full px-2 py-1 font-extrabold whitespace-nowrap ' +
        TYPE_STYLE[t].badge + '">' + TYPE_STYLE[t].short + ': ' + counts[t] + '</span>').join('');
    if (m2Mode) { capNhatNutDis(); capNhatNutSubmit(); }

    // CHẶNG 33: nút Delete all — chỉ hiện khi có lỗi VÀ không ở chế độ xem lại bài đã nộp
    const da = $('btnDelAll');
    if (da) da.classList.toggle('hidden', !ds.length || reviewLocked);
    refreshIcons();
  }
  function tSec(e) { return (parseInt(e.min, 10) || 0) * 60 + (parseInt(e.sec, 10) || 0); }
  // CHẶNG 33: STT hiện trên màn = vị trí trong danh sách ĐÃ SẮP THEO GIỜ, còn state.errors giữ
  // thứ tự thêm vào → phải quy đổi khi muốn nói "đang xoá lỗi số mấy".
  function sortedPositionOf(idx) {
    const order = state.errors.map((e, i) => ({ e, i })).sort((a, b) => tSec(a.e) - tSec(b.e));
    return order.findIndex((x) => x.i === idx) + 1;
  }
  function fmtTime(e) {
    if (e.min === '' && e.sec === '') return '--:--';
    return String(e.min || 0).padStart(2, '0') + ':' + String(e.sec || 0).padStart(2, '0');
  }

  // ═══════════════ TIMER (thời gian nói — nhập ngay dưới nút tên HS, xem timerCellHtml) ═══════════════
  // timers LUÔN = đúng danh sách thành viên đội được chấm (không thêm/bớt/đổi tên).
  // Khôi phục bài dở: khớp theo TÊN (0 là giá trị hợp lệ nên không dùng || '').
  function initTimers(saved) {
    const val = (v) => (v === undefined || v === null) ? '' : v;
    state.timers = state.members.map((m) => {
      const old = (saved || []).find((t) => t.name === m) || {};
      return { name: m, sMin: val(old.sMin), sSec: val(old.sSec), eMin: val(old.eMin), eSec: val(old.eSec) };
    });
  }

  // BẮT BUỘC đủ 4 ô thời gian nói của MỌI thành viên mới cho Submit
  function missingTimerFields() {
    const miss = [];
    state.timers.forEach((t, i) => {
      ['sMin', 'sSec', 'eMin', 'eSec'].forEach((k) => {
        if (String(t[k]).trim() === '') miss.push(i + ':' + k);
      });
    });
    return miss;
  }
  function markMissingTimers(miss) {
    document.querySelectorAll('[data-tt]').forEach((el) => {
      el.classList.toggle('border-rose-400', miss.includes(el.dataset.tt));
      el.classList.toggle('ring-1', miss.includes(el.dataset.tt));
      el.classList.toggle('ring-rose-300', miss.includes(el.dataset.tt));
    });
  }
  // Đánh dấu đỏ cả 4 ô của những HS có thời gian sai
  function markBadTimerRows(idxList) {
    const keys = [];
    idxList.forEach((i) => ['sMin', 'sSec', 'eMin', 'eSec'].forEach((k) => keys.push(i + ':' + k)));
    markMissingTimers(keys);
  }
  // Thời gian nói phải CHUẨN mới cho Submit: end > start từng HS, các khoảng không đan xen nhau
  function validateTimerRanges() {
    const rows = state.timers.map((t, i) => ({ name: t.name, i, r: timerRangeOf(t) }));
    for (const x of rows) {
      if (x.r && x.r.e <= x.r.s) {
        return { msg: x.name + ': the END time must be AFTER the START time!', bad: [x.i] };
      }
    }
    const sorted = rows.filter((x) => x.r).sort((a, b) => a.r.s - b.r.s);
    for (let k = 0; k + 1 < sorted.length; k++) {
      if (sorted[k + 1].r.s < sorted[k].r.e) {
        return { msg: 'Speaking times of ' + sorted[k].name + ' and ' + sorted[k + 1].name + ' overlap — please check!', bad: [sorted[k].i, sorted[k + 1].i] };
      }
    }
    return null;
  }

  // ═══════════════ NỘP BÀI ═══════════════
  function cleanTimers() {
    return state.timers.filter((t) => t.name.trim() || t.sMin !== '' || t.eMin !== '' || t.sSec !== '' || t.eSec !== '');
  }

  function openSubmitModal() {
    // (Đợt B) màn PHẢN BIỆN: Submit = gửi các phiếu đồng ý/phản đối, không có tóm tắt/timers
    if (state.cheDo === 'phanbien') { submitPb(); return; }
    // (Đợt B) mô hình 2 ĐÃ nộp lần nào thì cho gửi cập nhật kể cả khi đã xoá hết câu (đồng bộ vết xoá)
    const chuaCoGi = state.moHinh === 2
      ? (!state.errors.length && !m2.daNopLanNao)
      : !state.errors.length;
    if (chuaCoGi) { toast('No mistakes to submit yet. Watch the video closely!', 'err'); return; }
    // BẮT BUỘC: đủ thời gian nói (from → to) của từng thành viên dưới mỗi nút tên
    const miss = missingTimerFields();
    markMissingTimers(miss);
    if (miss.length) {
      toast('Please fill each student\'s speaking time (min:sec → min:sec) under their name!', 'err');
      return;
    }
    // Thời gian phải CHUẨN: end > start từng HS + các khoảng không đan xen
    const bad = validateTimerRanges();
    if (bad) {
      markBadTimerRows(bad.bad);
      toast(bad.msg, 'err');
      return;
    }
    // CHẶNG 35 (thầy chốt): icon ĐƠN SẮC (bỏ emoji nhiều màu) · BỎ dòng "Students timed" ·
    // số lỗi ≤ ÍT_LỖI thì tô ĐỎ và khi bấm Submit sẽ hỏi thêm một lần nữa.
    const it = (name) => '<i data-lucide="' + name + '" class="w-4 h-4 text-slate-400 shrink-0"></i>';
    // (Đợt B) mô hình 2: đếm câu CÒN SỐNG; nộp lại = CẬP NHẬT bản tổng (không đẻ bản mới)
    const soLoi = state.moHinh === 2
      ? state.errors.filter((e) => e.trangThai === 'song').length
      : state.errors.length;
    const few = soLoi <= IT_LOI;
    const s = $('submitSummary');
    s.innerHTML =
      '<div class="flex items-center gap-2">' + it('user') + '<span>Checked by: <b>' + escapeHtml(state.student) + '</b>' + (state.myTeam ? ' (' + escapeHtml(state.myTeam) + ')' : '') + '</span></div>' +
      (state.checkedTeam ? '<div class="flex items-center gap-2">' + it('users') + '<span>Team checked: <b>' + escapeHtml(state.checkedTeam) + '</b></span></div>' : '') +
      '<div class="flex items-center gap-2">' + it('flag') + '<span>Mistakes found: <b class="' + (few ? 'text-rose-600' : '') + '">' + soLoi + '</b></span></div>' +
      (state.submitted ? '<div class="flex items-center gap-2 text-slate-500">' + it('info') + '<span>' +
        (state.moHinh === 2 ? 'You\'ve already submitted — this will update your saved check.'
                            : 'You\'ve already submitted once — submitting again creates a new copy.') + '</span></div>' : '');
    $('submitModal').classList.remove('hidden');
    $('submitModal').classList.add('flex');
    refreshIcons();
  }
  function closeSubmitModal() {
    $('submitModal').classList.add('hidden');
    $('submitModal').classList.remove('flex');
  }

  // (Đợt Firebase) NỘP VÀO FIRESTORE — 1 lượt nộp = 1 tài liệu, mã sid làm tên tài liệu.
  // Lưới "nộp thiếu" (CHẶNG 32) tự đếm ở đây: xem lượt gần nhất của chính em trước khi ghi —
  // lượt mới ÍT LỖI HƠN thì VẪN ghi (không bao giờ chặn bài), chỉ trả cờ để nhắc.
  async function submitFs(payload) {
    let canhBao = null;
    try {
      const cu = await baiCuaEmFs(state.buoiId, state.student);
      if (cu.length) {
        const truoc = (cu[0].errors || []).length;
        if (payload.errors.length < truoc) canhBao = { truoc, nay: payload.errors.length };
      }
    } catch (e) { /* lưới phụ — hỏng thì thôi, không được cản bài nộp */ }
    const sid = taoSid();
    await nopFs(state.buoiId, sid, {
      sid,
      submittedAt: payload.submittedAt,
      classCode: payload.classCode, lesson: payload.lesson,
      student: payload.student, myTeam: payload.myTeam,
      checkedTeam: payload.checkedTeam,
      videoUrl: payload.videoUrl, videoId: payload.videoId,
      errors: payload.errors, timers: payload.timers,
      createdAt: Date.now(),
    });
    return { ok: true, saved: payload.errors.length, submissionId: sid, canhBaoNopThieu: canhBao };
  }

  async function submit() {
    // (Đợt B) mô hình 2: MỘT phát ghi cả bản tổng (create hay update như nhau) + pop-up loading
    if (state.moHinh === 2) { submitM2(); return; }
    closeSubmitModal();
    if (!state.khoFs && !SCRIPT_URL) {
      toast('The app isn\'t connected to Google Sheets yet — please tap "Export Excel" and send the file to your teacher!', 'err');
      return;
    }
    const btn = $('btnSubmit');
    btn.disabled = true;
    btn.innerHTML = '<i data-lucide="loader" class="w-4 h-4 animate-spin"></i> Submitting…';
    refreshIcons();
    try {
      const payload = {
        submittedAt: new Date().toISOString(),
        classCode: state.classCode, className: state.className,
        lesson: state.lesson, topic: state.topic,
        student: state.student, myTeam: state.myTeam,
        checkedTeam: state.checkedTeam,
        videoUrl: state.videoUrl, videoId: state.videoId,
        errors: state.errors, timers: cleanTimers(),
      };
      let out;
      if (state.khoFs) {
        // Kho mới: buổi do app đẩy lên Firestore thì bài nộp cũng vào Firestore —
        // KHÔNG rơi về Sheets kẻo dữ liệu một buổi nằm hai kho.
        out = await submitFs(payload);
      } else {
        const res = await fetch(SCRIPT_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(payload),
        });
        out = await res.json();
      }
      if (!out.ok) throw new Error(out.error || 'unknown');
      state.submitted = true;
      state.wasSubmitted = true;   // CHẶNG 29: cờ ĐÃ TỪNG NỘP — giữ bài trong "My submitted checks" kể cả khi mở khoá sửa
      autosave();
      // (CHẶNG 32) bộ não báo lượt này ÍT LỖI HƠN lượt gần nhất → nhắc (bài VẪN đã ghi, không chặn)
      if (out.canhBaoNopThieu && typeof out.canhBaoNopThieu.truoc === 'number') {
        $('fewerNow').textContent = out.canhBaoNopThieu.nay;
        $('fewerBefore').textContent = out.canhBaoNopThieu.truoc;
        $('fewerModal').classList.remove('hidden');
        $('fewerModal').classList.add('flex');
        refreshIcons();
      } else {
        toast('🎉 Submitted successfully! Thank you.');
      }
    } catch (e) {
      toast('Submission failed (' + e.message + '). Try again or tap Export Excel to send to your teacher.', 'err');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i data-lucide="send" class="w-4 h-4"></i> Submit';
      refreshIcons();
    }
  }

  // ═══════════════ EXPORT EXCEL (khớp mẫu SPEAKING TEAM CHECK FORM mới — TIẾNG ANH) ═══════════════
  // 2 sheet khớp mẫu mới của thầy:
  //   TIMER: STUDENT | MIN START | SEC START | MIN END | SEC END
  //   FORM : NO | MIN | SEC | STUDENT | TYPE | SENTENCE | MISTAKE | EXPLANATION | CHECKER
  function exportExcel() {
    const wb = XLSX.utils.book_new();

    // Sheet TIMER (thời gian nói)
    const timerAoa = [['STUDENT', 'MIN START', 'SEC START', 'MIN END', 'SEC END']];
    cleanTimers().forEach((t) => timerAoa.push([t.name, num(t.sMin), num(t.sSec), num(t.eMin), num(t.eSec)]));
    const wsT = XLSX.utils.aoa_to_sheet(timerAoa);
    wsT['!cols'] = [{ wch: 22 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }];
    XLSX.utils.book_append_sheet(wb, wsT, 'TIMER');

    // Sheet FORM (bảng bắt lỗi)
    const formAoa = [['NO', 'MIN', 'SEC', 'STUDENT', 'TYPE', 'SENTENCE', 'MISTAKE', 'EXPLANATION', 'CHECKER']];
    state.errors.slice().sort((a, b) => tSec(a) - tSec(b)).forEach((e, idx) => {
      formAoa.push([idx + 1, num(e.min), num(e.sec), e.who, e.type, e.sentence, e.detail, e.explain, state.student]);
    });
    const wsF = XLSX.utils.aoa_to_sheet(formAoa);
    wsF['!cols'] = [{ wch: 5 }, { wch: 6 }, { wch: 6 }, { wch: 16 }, { wch: 14 }, { wch: 42 }, { wch: 40 }, { wch: 45 }, { wch: 16 }];
    XLSX.utils.book_append_sheet(wb, wsF, 'FORM');

    const name = 'SPEAKING CHECK' +
      (state.checkedTeam ? ' - ' + state.checkedTeam : '') +
      ' - ' + (state.student || 'Student') + '.xlsx';
    XLSX.writeFile(wb, name.replace(/[\\/:*?"<>|]/g, ''));
    toast('Excel file exported ✓');
  }
  function num(v) { return v === '' || v == null ? null : (parseInt(v, 10) || 0); }

  // ═══════════════ TIỆN ÍCH ═══════════════
  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function refreshIcons() { if (window.lucide) lucide.createIcons(); }

  // ═══════════════ KHỞI ĐỘNG — luồng 1 LINK CHUNG + đăng nhập lớp ═══════════════

  // Tải danh sách lớp + bài đang chạy.
  // (Đợt Firebase) ƯU TIÊN kho FIRESTORE — trả lời dưới 1 giây, thầy ra bài mới là thấy ngay.
  // Bộ não Apps Script cũ vẫn được hỏi NGẦM PHÍA SAU (8-40 giây) rồi GHÉP THÊM những lớp chưa
  // có buổi Firestore — buổi cũ trong Google Sheets vẫn đăng nhập được, chỉ hiện muộn hơn.
  // Lớp ĐÃ có buổi Firestore thì buổi Sheets cùng lớp bị che (kho mới thắng, tránh nộp lệch kho).
  // DỰ PHÒNG CUỐI: file tĩnh data/classes.json khi cả hai kho đều hỏng.
  async function loadClasses() {
    let coFs = false;
    try {
      const ds = await buoiDangMoFs();
      if (ds.length) { CLASSES = { classes: ds }; fixClassNames(); coFs = true; }
    } catch (e) { /* chưa dán luật / mạng — coi như kho mới trống */ }

    // Bộ não cũ: có buổi Firestore rồi thì hỏi NGẦM (không chờ); chưa có gì thì đành chờ như xưa
    const hoiGas = async () => {
      if (!SCRIPT_URL) return false;
      try {
        const r = await fetch(SCRIPT_URL + '?config=1&_=' + Date.now(), { cache: 'no-store' });
        if (!r.ok) return false;
        const j = await r.json();
        if (!(j && Array.isArray(j.classes) && j.classes.length)) return false;
        const daCo = {};
        (CLASSES.classes || []).forEach((c) => { daCo[String(c.classCode || '').toUpperCase()] = 1; });
        const them = j.classes.filter((c) => !daCo[String(c.classCode || '').toUpperCase()]);
        if (them.length) { CLASSES.classes = (CLASSES.classes || []).concat(them); fixClassNames(); }
        return true;
      } catch (e) { return false; }
    };

    if (coFs) { hoiGas(); return; }     // kho mới có bài → vào ngay, kho cũ ghép thêm sau
    if (await hoiGas()) return;
    try {
      const r = await fetch('data/classes.json?_=' + Date.now(), { cache: 'no-store' });
      if (r.ok) CLASSES = await r.json();
    } catch (e) { CLASSES = { classes: [] }; }
    fixClassNames();
  }
  // (CHẶNG 32) UI là 100% tiếng Anh nhưng cột NAME trong sheet CẤU HÌNH đang là "Lớp B2B"…
  // → chuẩn hoá NGAY KHI NẠP: "Lớp X" thành "CLASS X" (sheet giữ nguyên, chỉ đổi hiển thị).
  function fixClassNames() {
    (CLASSES.classes || []).forEach((c) => {
      if (c && c.name) c.name = String(c.name).replace(/^L[ớơo]?p\s+/i, 'CLASS ');
    });
  }

  // Màn 1 — đăng nhập lớp: HS TỰ GÕ mã lớp (classCode) + mã (code)
  function initLoginScreen() {
    if (!(CLASSES.classes || []).length) {
      toast('Chưa có lớp nào trong danh sách. Thầy cần thêm lớp vào data/classes.json.', 'err');
    }
  }

  function showLoginErr() { $('loginErrModal').classList.remove('hidden'); $('loginErrModal').classList.add('flex'); }
  function hideLoginErr() { $('loginErrModal').classList.add('hidden'); $('loginErrModal').classList.remove('flex'); }

  function handleLogin() {
    const cv = $('inpClass').value.trim().toLowerCase();
    const code = $('inpCode').value.trim().toLowerCase();
    // phải khớp CẢ classCode LẪN code mới vào được
    const cls = (CLASSES.classes || []).find((c) =>
      String(c.classCode || '').toLowerCase() === cv && String(c.code || '').toLowerCase() === code);
    if (!cls) { showLoginErr(); return; }
    session.class = cls;
    renderIdentify();
    $('loginScreen').classList.add('hidden');
    $('identifyScreen').classList.remove('hidden');
    refreshIcons();
  }

  // Màn 2 — chọn tên: 2 ô CẠNH NHAU — Your Team (nạp đội) + Your Name (KHÓA đến khi chọn team)
  function renderIdentify() {
    const cls = session.class;
    $('identHeader').innerHTML =
      '<h2 class="text-lg font-extrabold text-slate-900 leading-tight">' + escapeHtml(cls.name) +
      (cls.topic ? ' — ' + escapeHtml(cls.topic) : '') + '</h2>' +
      '<p class="text-sm text-slate-500 mt-0.5">Pick your team, then choose your name.</p>';
    $('selTeam').innerHTML = '<option value="">— Team —</option>' +
      (cls.teams || []).map((t) => '<option value="' + t.team + '">TEAM ' + t.team + '</option>').join('');
    resetNameSelect();
    $('identPick').classList.remove('hidden');
    $('identConfirm').classList.add('hidden');
  }
  // Ô Your Name về rỗng + KHÓA (mờ) — dùng khi chưa chọn team
  function resetNameSelect() {
    const sn = $('selName');
    sn.innerHTML = '<option value="">— Name —</option>';
    sn.value = '';
    sn.disabled = true;
    sn.classList.add('bg-slate-100', 'text-slate-400');
    sn.classList.remove('bg-white', 'text-slate-800');
    $('selTeam').value = '';
  }
  // Chọn Team → nạp tên đội đó vào Your Name + MỞ KHÓA
  function onTeamChange() {
    const teamNo = $('selTeam').value;
    const sn = $('selName');
    if (!teamNo) { resetNameSelect(); return; }
    const team = (session.class.teams || []).find((t) => String(t.team) === String(teamNo));
    sn.innerHTML = '<option value="">— Name —</option>' +
      ((team && team.members) || []).map((m) => '<option value="' + escapeHtml(m) + '">' + escapeHtml(m) + '</option>').join('');
    sn.value = '';
    sn.disabled = false;
    sn.classList.remove('bg-slate-100', 'text-slate-400');
    sn.classList.add('bg-white', 'text-slate-800');
  }

  function initialsOf(name) {
    const p = String(name).trim().split(/\s+/).filter(Boolean);
    return ((p[0] || '')[0] + (p.length > 1 ? (p[p.length - 1] || '')[0] : '')).toUpperCase();
  }
  // Ảnh HS (dữ liệu chuẩn sau): lớp có thể có "photos": {"TÊN": "url"}; chưa có thì hiện chữ cái đầu
  function photoFor(cls, name) { return (cls.photos && cls.photos[name]) || ''; }
  function setStartEnabled(on) {
    const b = $('btnStartCheck');
    b.disabled = !on;
    b.classList.toggle('opacity-50', !on);
    b.classList.toggle('cursor-not-allowed', !on);
  }

  // Chọn tên → tính đội mình + đội phải chấm → màn xác nhận (ảnh + cam kết)
  function handleNamePick(teamNo, name) {
    const cls = session.class;
    const pair = (cls.pairs || []).find((p) => Number(p.checker) === Number(teamNo));
    if (!pair) { toast('This team has no video to check yet.', 'err'); return; }
    const checked = (cls.teams || []).find((t) => Number(t.team) === Number(pair.checked));
    if (!checked) { toast('Missing the team to check.', 'err'); return; }

    state.student = name;
    state.myTeam = 'TEAM ' + teamNo;
    state.checkedTeam = 'TEAM ' + pair.checked;
    state.members = checked.members || [];
    state.videoUrl = checked.video || '';
    const vp = parseVideoUrl(state.videoUrl);
    state.videoId = (vp && vp.id) ? vp.id : '';   // mã video (để bộ não/app máy tính ghép đúng video)
    state.lesson = cls.lesson || cls.topic || '';
    state.topic = cls.topic || cls.lesson || '';
    state.className = cls.name || cls.id;
    state.classCode = cls.classCode || cls.id;    // khóa route tới đúng file lớp
    state.khoFs = cls._kho === 'fs';              // (Đợt Firebase) buổi này nộp vào kho nào
    state.buoiId = state.khoFs ? maBuoi(state.classCode, state.lesson) : '';
    state.moHinh = state.khoFs && cls._moHinh === 2 ? 2 : 1;   // (Đợt B) bản tổng lỗi hay nhiều-lần-nộp
    state.cheDo = 'cham';                         // đường đăng nhập cũ chỉ có màn chấm
    // (Đợt 3) video mọi đội — cho pop-up "All team videos" khi bấm logo
    state.clips = (cls.teams || []).map((t) => ({ t: t.team, v: t.video || '' }));
    saveKey = makeSaveKey(state.student, state.videoUrl);

    // ảnh HS: dùng ảnh thật nếu có, tạm thời hiện chữ cái đầu
    const photo = photoFor(cls, name);
    const ph = $('identPhoto');
    if (photo) { ph.style.backgroundImage = 'url("' + photo + '")'; ph.textContent = ''; }
    else { ph.style.backgroundImage = ''; ph.textContent = initialsOf(name); }

    $('identName').textContent = name;
    $('identTeams').innerHTML = 'You are in <b>Team ' + teamNo + '</b> · You will check <b>Team ' + pair.checked + '</b>';
    $('identNoteTitle').textContent = name + ', Andrew has something for you.';

    $('chkAgree').checked = false;
    setStartEnabled(false);

    $('identPick').classList.add('hidden');
    $('identConfirm').classList.remove('hidden');
    renderReviewSection();   // (CHẶNG 32) lịch sử bài đã nộp hiện Ở TRANG NÀY (thầy chốt chuyển từ màn đăng nhập sang)
    refreshIcons();
  }

  // ═══════════════ VÀO THẲNG TỪ myLesson (20/08/2026) ═══════════════
  // Trang lớp bên myLesson (lesson.andrewclasses.com) có thẻ SPEAKING CHECK. Bấm thẻ, bên đó hỏi
  // bộ não xem em thuộc đội nào / chấm đội nào, rồi mở tab sang đây kèm GÓI dữ liệu trên link:
  //     index.html?goi=<base64url của JSON>
  // Có gói thì BỎ CẢ BA MÀN (mã lớp · chọn team+tên · xác nhận) và vào thẳng bài — thầy chốt.
  //
  // ⛔ VÀO BẰNG GÓI THÌ KHÔNG GỌI loadClasses(): bộ não đo được 8-40 giây, mà mọi thứ cần biết đã
  //    nằm trong gói rồi. Gọi lại là mất trắng cái nhanh vừa đổi được.
  // ⛔ `goi.ten` là TÊN TRONG BUỔI (lấy từ `teams[].members`, vd "PHONG"), KHÔNG phải tên đầy đủ
  //    bên myStudent ("CHẤN PHONG"). Bài nộp + ô nhớ localStorage PHẢI dùng tên này, đúng như khi
  //    em tự chọn tên ở màn 2 — đổi sang tên đầy đủ là lệch hết với sheet cũ.
  // ⛔ Đường vào cũ (gõ mã lớp) GIỮ NGUYÊN 100%: lớp nào chưa nối vẫn dùng bình thường.
  // ⛔ Gói hỏng / thiếu trường thì im lặng rơi về màn đăng nhập, đừng chặn học sinh.
  function docGoi() {
    try {
      const raw = new URLSearchParams(location.search).get('goi');
      if (!raw) return null;
      const b64 = raw.replace(/-/g, '+').replace(/_/g, '/');
      const g = JSON.parse(decodeURIComponent(escape(atob(b64))));
      if (!g || g.v !== 1) return null;
      if (!g.ten || !g.team || !g.cham || !g.video) return null;
      return g;
    } catch (e) {
      if (window.console) console.warn('goi hong:', e);
      return null;
    }
  }

  function vaoThangTuGoi(g) {
    state.student = g.ten;                       // tên TRONG BUỔI — xem cảnh báo ở trên
    state.myTeam = 'TEAM ' + g.team;
    state.checkedTeam = 'TEAM ' + g.cham;
    state.members = Array.isArray(g.members) ? g.members : [];
    state.videoUrl = g.video || '';
    const vp = parseVideoUrl(state.videoUrl);
    state.videoId = (vp && vp.id) ? vp.id : '';
    state.lesson = g.lesson || '';
    state.topic = g.topic || g.lesson || '';
    state.className = g.tenLop || g.classCode || '';
    state.classCode = g.classCode || '';
    state.khoFs = g.kho === 'fs';                 // (Đợt Firebase) myLesson báo buổi nằm kho nào
    state.buoiId = state.khoFs ? maBuoi(state.classCode, state.lesson) : '';
    // (Đợt B) gói mang cờ mô hình + chế độ: mh=2 là buổi bản-tổng-lỗi; pb=1 là màn PHẢN BIỆN
    // (myLesson khi đó gửi video/members của CHÍNH ĐỘI EM, không phải đội bị chấm).
    state.moHinh = state.khoFs && g.mh === 2 ? 2 : 1;
    state.cheDo = (g.pb === 1 && state.moHinh === 2) ? 'phanbien' : 'cham';
    // (Đợt 3) gói mang video mọi đội; gói cũ không có thì pop-up tự hỏi kho Firestore
    state.clips = Array.isArray(g.clips) ? g.clips : [];
    saveKey = makeSaveKey(state.student, state.videoUrl) + (state.cheDo === 'phanbien' ? '_pb' : '');
    if (state.cheDo === 'phanbien') { startPb(); return; }
    start();
  }

  function start() {
    // (Đợt B) Buổi MÔ HÌNH 2: bản trên KHO là gốc — bắt buộc loading kéo bản tổng về trước,
    // localStorage chỉ còn là lưới đỡ (nháp chưa gửi thì hỏi, không âm thầm đè).
    if (state.moHinh === 2) { startM2(); return; }
    // state.student / myTeam / checkedTeam / members / videoUrl / topic đã set ở handleNamePick
    // khôi phục bài dở nếu cùng người
    const saved = loadSaved();
    let savedTimers = null;
    if (saved && saved.student === state.student) {
      state.errors = saved.errors || [];
      savedTimers = saved.timers;
      state.submitted = !!saved.submitted;
      state.wasSubmitted = !!(saved.wasSubmitted || saved.submitted);   // CHẶNG 29: giữ bài trong "My submitted checks"
      if (state.errors.length) toast('Restored ' + state.errors.length + ' mistakes you logged earlier ✓', 'info');
    }
    setReviewLock(false);   // vào theo đường đăng nhập = chế độ làm bài bình thường

    // dựng UI chính
    // Nút người chấm: "HOANG · T1" (tên · đội của người chấm) — bỏ icon, cỡ = nút Export
    const myTeamNo = String(state.myTeam || '').replace(/[^0-9]/g, '');
    $('hdStudent').textContent = state.student + (myTeamNo ? ' · T' + myTeamNo : '');
    $('hdTopic').textContent = state.topic || 'Watch · spot mistakes · improve together';
    initTimers(savedTimers);      // timers TRƯỚC — buildStudentField vẽ ô thời gian từ timers
    buildStudentField();
    renderErrors();
    initVideo();

    $('loginScreen').classList.add('hidden');
    $('identifyScreen').classList.add('hidden');
    $('appScreen').classList.remove('hidden');
    autosave();
    refreshIcons();
    maybeRestoreFromServer(saved);   // (CHẶNG 32) máy này trống mà em ĐÃ nộp ở máy khác → kéo bài về
  }

  // ═══════════════ (Đợt B) MÀN CHẤM BÀI — MÔ HÌNH 2: VÀO BÀI LÀ KÉO BẢN TỔNG VỀ ═══════════════
  // Thầy chốt: "khi đăng nhập làm bài bắt buộc có bước loading và show hết các câu đã check
  // được lần trước ra" — bản trên KHO là gốc; máy có NHÁP chưa gửi thì HỎI, không âm thầm đè.
  function dungManChinh() {
    const myTeamNo = String(state.myTeam || '').replace(/[^0-9]/g, '');
    $('hdStudent').textContent = state.student + (myTeamNo ? ' · T' + myTeamNo : '');
    $('hdTopic').textContent = (state.cheDo === 'phanbien' ? 'REBUTTAL · ' : '') +
      (state.topic || 'Watch · spot mistakes · improve together');
    $('appScreen').classList.toggle('pb-mode', state.cheDo === 'phanbien');
    $('loginScreen').classList.add('hidden');
    $('identifyScreen').classList.add('hidden');
    $('appScreen').classList.remove('hidden');
    refreshIcons();
  }

  async function startM2() {
    setReviewLock(false);
    dungManChinh();
    loadingHien('Loading your saved check…');
    let serverDoc = null;
    try {
      serverDoc = await tongLoiLay(state.buoiId, slugHs(state.student));
    } catch (e) { /* mạng/luật hỏng → coi như chưa có bản trên kho, vẫn cho làm bài */ }
    try {
      m2.phanHoi = await fsQuery(state.buoiId, 'phanHoi', 'chuLoi', state.student, 2000);
    } catch (e) { m2.phanHoi = []; }

    const svErrors = ((serverDoc && serverDoc.errors) || []).map(chuanLoi);
    const svTimers = (serverDoc && serverDoc.timers) || [];
    m2.daNopLanNao = !!serverDoc;

    // Nháp trên máy (chưa gửi) so với bản kho: khác nhau + cả hai có nội dung → HỎI EM
    const saved = loadSaved();
    const nhap = (saved && saved.student === state.student && (saved.errors || []).length)
      ? { errors: (saved.errors || []).map(chuanLoi), timers: saved.timers || [] } : null;
    const khac = nhap && JSON.stringify(nhap.errors) !== JSON.stringify(svErrors);

    const apDung = (errors, timers) => {
      const dungBanKho = errors === svErrors;
      state.errors = errors;
      state.submitted = m2.daNopLanNao;
      state.wasSubmitted = m2.daNopLanNao;
      initTimers(timers);
      // serverBan = ảnh chụp BẢN KHO. Dùng đúng bản kho thì chụp SAU khi dựng state (so chuỗi
      // trùng tuyệt đối → nút xanh lá); dùng NHÁP thì chụp bản kho thô → nút tự VÀNG (còn thứ chưa gửi).
      m2.serverBan = dungBanKho ? m2ChupCham() : JSON.stringify({ e: svErrors, t: svTimers.filter((t) => t.name) });
      m2.serverIds = {};
      svErrors.forEach((e) => { m2.serverIds[e.id] = JSON.stringify(e); });
      buildStudentField();
      renderErrors();
      initVideo();
      autosave();
      capNhatNutSubmit();
      capNhatNutDis();
      refreshIcons();
      const soSong = state.errors.filter((e) => e.trangThai === 'song').length;
      if (soSong) toast('Loaded your check: ' + soSong + ' mistake' + (soSong > 1 ? 's' : '') + ' ✓', 'info');
    };

    loadingAn();
    if (khac && serverDoc) {
      // Hai bản lệch nhau → em chọn (pop-up #draftModal). Chọn xong mới dựng bảng.
      $('draftModal').classList.remove('hidden');
      $('draftModal').classList.add('flex');
      refreshIcons();
      $('btnDraftServer').onclick = () => {
        $('draftModal').classList.add('hidden'); $('draftModal').classList.remove('flex');
        apDung(svErrors, svTimers);
      };
      $('btnDraftLocal').onclick = () => {
        $('draftModal').classList.add('hidden'); $('draftModal').classList.remove('flex');
        apDung(nhap.errors, nhap.timers);
      };
      return;
    }
    if (nhap && !serverDoc) { apDung(nhap.errors, nhap.timers); return; }
    apDung(svErrors, svTimers);
  }

  // ═══════════════ (Đợt B) MÀN PHẢN BIỆN — xem lỗi ĐỘI MÌNH bị chấm + tích từng câu ═══════════════
  // Gói ?goi= mang pb:1 (myLesson gửi video/members của CHÍNH đội em). Mỗi câu: cặp tích
  // Đồng ý / Phản đối LOẠI TRỪ NHAU, phản đối BẮT BUỘC lý do; phiếu ĐỘC LẬP theo từng em.
  async function startPb() {
    setReviewLock(false);
    dungManChinh();
    loadingHien('Loading the mistakes on your team…');
    try {
      const docs = await fsQuery(state.buoiId, 'tongLoi', 'checkedTeam', state.myTeam, 200);
      m2.dsCham = [];
      docs.forEach((d) => {
        ((d.errors || []).map(chuanLoi)).forEach((er) => {
          if (er.trangThai !== 'an') m2.dsCham.push({ chuLoi: String(d.student || d._id), err: er });
        });
      });
      m2.dsCham.sort((a, b) => tSec(a.err) - tSec(b.err));
    } catch (e) { m2.dsCham = []; }
    try {
      m2.phanHoi = await fsQuery(state.buoiId, 'phanHoi', '', '', 3000);
    } catch (e) { m2.phanHoi = []; }

    // Phiếu CỦA CHÍNH EM đổ vào bảng đang sửa
    m2.votes = {};
    m2.phanHoi.filter((p) => p.voter === state.student).forEach((p) => {
      m2.votes[p.errId] = { y: p.y, lyDo: p.lyDo || '' };
    });
    m2.votesServer = JSON.stringify(m2.votes);

    loadingAn();
    initVideo();
    renderErrorsPb();
    capNhatNutSubmit();
    refreshIcons();
    if (!m2.dsCham.length) toast('No mistakes on your team yet — the other team may not have submitted.', 'info');
  }

  // Vòng tròn avatar (ảnh thật từ kho web; hỏng ảnh → chữ tắt). kind: 'dongY' xanh · 'phanDoi' đỏ
  function avatarVong(ten, kind, errId) {
    const nen = kind === 'phanDoi' ? 'bg-rose-500 ring-rose-300' : 'bg-emerald-500 ring-emerald-300';
    return '<button data-pv="' + escapeHtml(errId) + '__' + escapeHtml(ten) + '" title="' + escapeHtml(ten) + '"' +
      ' class="pv-av relative w-7 h-7 rounded-full ring-2 ' + nen + ' text-white text-[9px] font-extrabold' +
      ' flex items-center justify-center overflow-hidden shrink-0 -ml-1.5 first:ml-0">' +
      '<img src="' + escapeHtml(avatarUrl(ten)) + '" alt="" class="absolute inset-0 w-full h-full object-cover"' +
      ' onerror="this.remove()">' +
      '<span class="pointer-events-none">' + escapeHtml(initialsOf(ten)) + '</span></button>';
  }
  function phieuCuaLoi(errId) { return m2.phanHoi.filter((p) => p.errId === errId); }

  // ─── (Đợt B) BẢNG PHẢN BIỆN ───
  function renderErrorsPb() {
    const list = $('errList');
    const song = m2.dsCham.filter((x) => x.err.trangThai === 'song');
    const go = m2.dsCham.filter((x) => x.err.trangThai === 'go');
    const thuTu = song.concat(go);   // câu đã gỡ chìm xuống cuối (thầy chốt)
    list.innerHTML = thuTu.map((x, pos) => {
      const e = x.err;
      const st = TYPE_STYLE[e.type] || { badge: 'bg-slate-100 text-slate-600' };
      const daGo = e.trangThai === 'go';
      const v = m2.votes[e.id] || null;
      const phieuKhac = phieuCuaLoi(e.id).filter((p) => p.voter !== state.student);
      const chonY = v && v.y === 'dongY', chonN = v && v.y === 'phanDoi';
      // (Đợt yêu cầu mới) Lỗi CỦA CHÍNH EM (e.who === tên em) BẮT BUỘC phải AGREE/DISAGREE mới
      // nộp được — lỗi của đồng đội vẫn TUỲ Ý (xem chặn ở submitPb()). So chuỗi y hệt cách app
      // đã so `p.voter === state.student` ở startPb() — cùng một mảng tên thành viên, không lệch.
      const laCuaMinh = !!(e.who && state.student && e.who === state.student);
      const canVoteBatBuoc = laCuaMinh && !daGo && !v;
      return '<div class="slidein rounded-2xl border p-3.5 transition ' +
        (daGo ? 'err-go border-slate-200' : (canVoteBatBuoc ? 'border-amber-400 bg-amber-50/50 ring-2 ring-amber-300' : 'border-slate-200 hover:border-indigo-300')) + '" data-pbrow="' + escapeHtml(e.id) + '">' +
        '<div class="flex items-center gap-2 flex-wrap">' +
        '<span class="shrink-0 w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 font-extrabold text-xs flex items-center justify-center">' + (pos + 1) + '</span>' +
        '<button data-pbseek="' + tSec(e) + '" class="font-mono font-bold text-sm bg-slate-900 text-white rounded-lg px-2 py-0.5 hover:bg-indigo-700 transition">' + fmtTime(e) + '</button>' +
        '<span class="text-xs font-bold rounded-full px-2.5 py-1 ' + st.badge + '">' + typeLabel(e.type) + '</span>' +
        (laCuaMinh
      ? '<span class="text-xs font-extrabold text-amber-700 bg-amber-100 rounded-full px-2.5 py-1 flex items-center gap-1">⭐ YOUR MISTAKE' + (canVoteBatBuoc ? ' — vote required' : '') + '</span>'
      : (e.who ? '<span class="text-xs font-semibold text-slate-600 flex items-center gap-1">👤 ' + escapeHtml(e.who) + '</span>' : '')) +
        (daGo ? '<span class="text-[10px] font-extrabold text-slate-400 border border-slate-300 rounded-full px-2 py-0.5">REMOVED</span>' : '') +
        '<span class="ml-auto flex items-center">' + phieuKhac.map((p) => avatarVong(p.voter, p.y, e.id)).join('') + '</span>' +
        '</div>' +
        (e.sentence ? '<div class="mt-1.5 text-sm font-bold italic text-slate-900">“' + escapeHtml(e.sentence) + '”</div>' : '') +
        '<div class="mt-0.5 text-sm font-bold text-rose-600">' + escapeHtml(e.detail) + '</div>' +
        (e.explain ? '<div class="mt-0.5 text-sm font-bold text-emerald-600">' + escapeHtml(e.explain) + '</div>' : '') +
        '<div class="mt-2 pt-2 border-t border-slate-100 flex items-center gap-2 flex-wrap">' +
        '<span class="text-[11px] font-bold text-slate-400">Checked by ' + escapeHtml(x.chuLoi) + '</span>' +
        (daGo ? '' :
          '<span class="ml-auto flex items-center gap-1.5">' +
          '<button data-pbvote="dongY" data-err="' + escapeHtml(e.id) + '" class="rounded-xl border-2 px-3 py-1.5 text-xs font-extrabold transition ' +
          (chonY ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-emerald-300 text-emerald-600 hover:bg-emerald-50') + '">✓ AGREE</button>' +
          '<button data-pbvote="phanDoi" data-err="' + escapeHtml(e.id) + '" class="rounded-xl border-2 px-3 py-1.5 text-xs font-extrabold transition ' +
          (chonN ? 'border-rose-500 bg-rose-500 text-white' : 'border-rose-300 text-rose-600 hover:bg-rose-50') + '">✗ DISAGREE</button>' +
          '</span>') +
        '</div>' +
        (chonN && !daGo ?
          '<textarea data-pblydo="' + escapeHtml(e.id) + '" rows="2" maxlength="300" placeholder="Why do you disagree? (required)"' +
          ' class="autogrow mt-2 w-full rounded-xl border border-rose-300 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-rose-400">' +
          escapeHtml(v.lyDo || '') + '</textarea>' : '') +
        '</div>';
    }).join('');
    $('errEmpty').style.display = thuTu.length ? 'none' : '';
    // G/P/I đếm các câu CÒN SỐNG của đội mình
    const counts = {};
    song.forEach((x) => { counts[x.err.type] = (counts[x.err.type] || 0) + 1; });
    $('errStats').innerHTML = Object.keys(TYPE_STYLE).filter((t) => counts[t])
      .map((t) => '<span title="' + typeLabel(t) + '" class="rounded-full px-2 py-1 font-extrabold whitespace-nowrap ' +
        TYPE_STYLE[t].badge + '">' + TYPE_STYLE[t].short + ': ' + counts[t] + '</span>').join('');
    $('btnDelAll').classList.add('hidden');
    refreshIcons();
  }

  // Nộp phiếu phản biện: chỉ ghi các phiếu ĐỔI so với lần đồng bộ trước; phản đối thiếu lý do = chặn
  async function submitPb() {
    // (Đợt yêu cầu mới) BẮT BUỘC vote (Agree HOẶC Disagree) cho MỌI lỗi của CHÍNH EM trước khi
    // nộp — lỗi của đồng đội vẫn tuỳ ý, KHÔNG chặn. Câu đã 'go' (đồng đội khác đã Agree/gỡ) thì
    // không còn nút vote nữa nên bỏ qua, đừng bắt vote câu không vote được.
    const thieuBatBuoc = m2.dsCham.filter((x) => x.err.trangThai !== 'go' &&
      x.err.who && state.student && x.err.who === state.student && !m2.votes[x.err.id]);
    if (thieuBatBuoc.length) {
      toast('You must AGREE or DISAGREE on every mistake about YOU before submitting (' + thieuBatBuoc.length + ' left).', 'err');
      flashBox(document.querySelector('[data-pbrow="' + thieuBatBuoc[0].err.id + '"]'));
      return;
    }
    const thieu = Object.keys(m2.votes).filter((id) => m2.votes[id].y === 'phanDoi' && !String(m2.votes[id].lyDo || '').trim());
    if (thieu.length) {
      toast('Please write WHY you disagree — every disagree needs a reason!', 'err');
      const o = document.querySelector('[data-pblydo="' + thieu[0] + '"]');
      if (o) { o.focus(); o.classList.add('ring-2', 'ring-rose-400'); }
      return;
    }
    const cu = JSON.parse(m2.votesServer || '{}');
    const doi = Object.keys(m2.votes).filter((id) => JSON.stringify(m2.votes[id]) !== JSON.stringify(cu[id]));
    if (!doi.length) { toast('Nothing new to submit.', 'info'); return; }
    loadingHien('Saving your feedback…');
    try {
      for (const id of doi) {
        const it = m2.dsCham.find((x) => x.err.id === id);
        await phanHoiGhi(state.buoiId, id + '__' + slugHs(state.student), {
          errId: id,
          chuLoi: it ? it.chuLoi : '',
          voter: state.student,
          voterTeam: state.myTeam,
          y: m2.votes[id].y,
          lyDo: String(m2.votes[id].lyDo || '').trim(),
          luc: Date.now(),
        });
      }
      m2.votesServer = JSON.stringify(m2.votes);
      // vẽ lại để avatar/phiếu vừa gửi hiện chắc chắn + nút về xanh lá
      m2.phanHoi = m2.phanHoi.filter((p) => p.voter !== state.student);
      Object.keys(m2.votes).forEach((id) => {
        const it = m2.dsCham.find((x) => x.err.id === id);
        m2.phanHoi.push({ errId: id, chuLoi: it ? it.chuLoi : '', voter: state.student, voterTeam: state.myTeam, y: m2.votes[id].y, lyDo: m2.votes[id].lyDo || '' });
      });
      loadingAn();
      renderErrorsPb();
      capNhatNutSubmit();
      toast('🎉 Feedback submitted — thank you!');
    } catch (e) {
      loadingAn();
      toast('Could not save (' + e.message + '). Please try again.', 'err');
    }
  }

  // ─── (Đợt B) NỘP BẢN TỔNG (màn chấm, mô hình 2) — MỘT phát ghi cả bản, pop-up loading ───
  async function submitM2() {
    closeSubmitModal();
    loadingHien('Saving your check…');
    try {
      await tongLoiGhi(state.buoiId, slugHs(state.student), {
        student: state.student, myTeam: state.myTeam, checkedTeam: state.checkedTeam,
        videoUrl: state.videoUrl, videoId: state.videoId,
        classCode: state.classCode, lesson: state.lesson,
        errors: state.errors, timers: cleanTimers(),
        daNop: true, capNhatLuc: Date.now(),
      });
      m2.daNopLanNao = true;
      m2GhiNhanDongBo();
      state.submitted = true;
      state.wasSubmitted = true;
      autosave();
      loadingAn();
      renderErrors();          // icon uploaded xanh hiện đủ ở từng ô
      capNhatNutSubmit();
      toast('🎉 Submitted successfully! Thank you.');
    } catch (e) {
      loadingAn();
      toast('Submission failed (' + e.message + '). Try again or tap Export Excel to send to your teacher.', 'err');
    }
  }

  // Gửi NGẦM các kết luận Keep/Agree (thầy chốt: bấm lại nút DISAGREEMENT cũng gửi dữ liệu lên)
  async function guiNgamKetLuan() {
    if (!m2CoSuaChuaGui()) return;
    try {
      await tongLoiGhi(state.buoiId, slugHs(state.student), {
        student: state.student, myTeam: state.myTeam, checkedTeam: state.checkedTeam,
        videoUrl: state.videoUrl, videoId: state.videoId,
        classCode: state.classCode, lesson: state.lesson,
        errors: state.errors, timers: cleanTimers(),
        daNop: true, capNhatLuc: Date.now(),
      });
      m2.daNopLanNao = true;
      m2GhiNhanDongBo();
      renderErrors();
      capNhatNutSubmit();
      toast('Saved ✓', 'info');
    } catch (e) { toast('Could not save (' + e.message + ') — press Submit to retry.', 'err'); }
  }

  // ─── (Đợt B) NÚT DISAGREEMENT — đếm câu có phản đối CHƯA xử lý (thầy chốt) ───
  function demTranhChap() {
    return state.errors.filter((e) => e.trangThai === 'song' && !e.ketLuan &&
      phieuCuaLoi(e.id).some((p) => p.y === 'phanDoi')).length;
  }
  function capNhatNutDis() {
    const b = $('btnDisagree');
    if (!b) return;
    const hien = state.moHinh === 2 && state.cheDo === 'cham' &&
      state.errors.some((e) => phieuCuaLoi(e.id).some((p) => p.y === 'phanDoi'));
    b.classList.toggle('hidden', !hien);
    if (!hien) { m2.disOn = false; return; }
    const n = demTranhChap();
    b.textContent = 'DISAGREEMENT: ' + n;
    b.className = 'mx-2 rounded-full px-3 py-1 text-xs font-extrabold text-white transition ' +
      (n > 0 ? 'bg-rose-600 hover:bg-rose-500' : 'bg-slate-400 hover:bg-slate-300') +
      (m2.disOn ? ' dis-halo' : '');
  }

  // ─── (Đợt B) POP-UP NHỎ CẠNH AVATAR — nội dung phản biện + Keep/Agree ───
  let kaDangXu = null;   // { errId, hanhDong: 'keep'|'agree' } đang chờ xác nhận
  function moPopPhanHoi(nut, errId, voter) {
    const p = phieuCuaLoi(errId).find((x) => x.voter === voter);
    if (!p) return;
    const e = state.errors.find((x) => x.id === errId);
    const pop = $('pbPop');
    const laPhanDoi = p.y === 'phanDoi';
    pop.innerHTML =
      '<div class="flex items-center gap-2 mb-1.5">' +
      '<span class="w-6 h-6 rounded-full ' + (laPhanDoi ? 'bg-rose-500' : 'bg-emerald-500') + ' text-white text-[9px] font-extrabold flex items-center justify-center overflow-hidden relative">' +
      '<img src="' + escapeHtml(avatarUrl(voter)) + '" alt="" class="absolute inset-0 w-full h-full object-cover" onerror="this.remove()">' +
      '<span>' + escapeHtml(initialsOf(voter)) + '</span></span>' +
      '<b class="text-xs">' + escapeHtml(voter) + '</b>' +
      '<span class="text-[10px] font-extrabold ' + (laPhanDoi ? 'text-rose-600' : 'text-emerald-600') + '">' +
      (laPhanDoi ? 'DISAGREES' : 'AGREES') + '</span>' +
      '<button id="pbPopX" class="ml-auto text-slate-400 hover:text-slate-600 font-bold px-1">✕</button></div>' +
      (laPhanDoi ? '<div class="text-xs text-slate-700 whitespace-pre-wrap">' + escapeHtml(p.lyDo || '') + '</div>' : '') +
      (laPhanDoi && e && e.trangThai === 'song' ?
        '<div class="flex gap-2 mt-2.5">' +
        '<button id="pbPopKeep" class="flex-1 bg-rose-600 hover:bg-rose-500 text-white rounded-xl py-1.5 text-xs font-extrabold' + (e.ketLuan === 'keep' ? ' ring-2 ring-rose-300' : '') + '">KEEP' + (e.ketLuan === 'keep' ? ' ✓' : '') + '</button>' +
        '<button id="pbPopAgree" class="flex-1 bg-blue-600 hover:bg-blue-500 text-white rounded-xl py-1.5 text-xs font-extrabold">AGREE</button>' +
        '</div>' : '');
    pop.classList.remove('hidden');
    const r = nut.getBoundingClientRect();
    const w = 290;
    pop.style.left = Math.max(8, Math.min(r.left - w + r.width + 8, window.innerWidth - w - 8)) + 'px';
    pop.style.top = Math.min(r.bottom + 8, window.innerHeight - 180) + 'px';
    $('pbPopX').onclick = dongPopPhanHoi;
    const keep = $('pbPopKeep'), agree = $('pbPopAgree');
    if (keep) keep.onclick = () => hoiKetLuan(errId, 'keep');
    if (agree) agree.onclick = () => hoiKetLuan(errId, 'agree');
  }
  function dongPopPhanHoi() { $('pbPop').classList.add('hidden'); }

  // Mỗi thao tác Keep/Agree đều HỎI CHỐT (thầy chốt)
  function hoiKetLuan(errId, hanhDong) {
    dongPopPhanHoi();
    kaDangXu = { errId, hanhDong };
    const e = state.errors.find((x) => x.id === errId);
    $('kaTitle').textContent = hanhDong === 'agree' ? 'Accept the rebuttal?' : 'Keep this mistake?';
    $('kaText').innerHTML = hanhDong === 'agree'
      ? 'The mistake <b>“' + escapeHtml((e && (e.detail || e.sentence)) || '') + '”</b> will be <b>released</b> — it stays visible (crossed out) but no longer counts. Your teacher still sees the full history.'
      : 'You will <b>keep</b> the mistake <b>“' + escapeHtml((e && (e.detail || e.sentence)) || '') + '”</b>. It stays disputed — your teacher will decide in class.';
    $('btnKaOk').textContent = hanhDong === 'agree' ? 'Agree ✓' : 'Keep it';
    $('btnKaOk').className = 'flex-1 text-white rounded-xl py-2.5 font-bold text-sm ' +
      (hanhDong === 'agree' ? 'bg-blue-600 hover:bg-blue-500' : 'bg-rose-600 hover:bg-rose-500');
    $('kaModal').classList.remove('hidden');
    $('kaModal').classList.add('flex');
    refreshIcons();
  }
  function dongKaModal() { $('kaModal').classList.add('hidden'); $('kaModal').classList.remove('flex'); kaDangXu = null; }
  function chotKetLuan() {
    if (!kaDangXu) return;
    const e = state.errors.find((x) => x.id === kaDangXu.errId);
    if (e) {
      e.ketLuan = kaDangXu.hanhDong;
      if (kaDangXu.hanhDong === 'agree') e.trangThai = 'go';
    }
    dongKaModal();
    renderErrors();
    capNhatNutDis();
    capNhatNutSubmit();
    autosave();
    toast(e && e.ketLuan === 'agree' ? 'Mistake released — remember to Submit!' : 'Kept — your teacher will decide. Remember to Submit!', 'info');
  }

  // ═══════════════ CHẶNG 32→35 — BÀI ĐÃ NỘP: HỎI TRƯỚC, KHÔNG TỰ MỞ ═══════════════
  // Vì sao có cửa này: bài đang làm chỉ nằm trong localStorage TỪNG MÁY. Em nộp ở máy A, hôm sau mở
  // máy B thì form TRỐNG — em thêm 2 lỗi rồi Submit là chỉ gửi PHẦN BỔ SUNG (ca PHONG mất 16 lỗi).
  // CHẶNG 35 (thầy chốt sau khi dùng thử): bản cũ TỰ NHẢY RA + tự khoá xem làm HS giật mình.
  // Nay: hỏi bằng pop-up "tìm thấy N bản nộp lúc … — muốn xem bản nào?"; chọn bản → mở CHẾ ĐỘ XEM;
  // bấm "start a new check" → làm bài MỚI TINH. Nộp thêm lần nữa thì lần sau danh sách có N+1 bản.
  // LUẬT AN TOÀN: mạng hỏng / quá 8 giây / bộ não bản cũ → vào làm bài BÌNH THƯỜNG, không chặn HS.
  let serverSubs = [];   // các lượt nộp lấy về từ kho (mới nhất trước)
  async function maybeRestoreFromServer(saved) {
    if (!state.khoFs && !SCRIPT_URL) return;
    // Máy này đã có dấu vết bài của chính em (lỗi đã lưu hoặc từng nộp) → ưu tiên bản máy, không hỏi mạng
    if (saved && saved.student === state.student && ((saved.errors || []).length || saved.wasSubmitted)) return;
    try {
      let subs = [];
      if (state.khoFs) {
        // (Đợt Firebase) kho mới trả lời dưới 1 giây — mỗi tài liệu là một lượt nộp sẵn hình dạng
        subs = (await baiCuaEmFs(state.buoiId, state.student)).map((d) => ({
          sid: d.sid || d._id, luc: gioDep(d.submittedAt), errors: d.errors || [], timers: d.timers || [],
        }));
      } else {
        const ctl = new AbortController();
        const tm = setTimeout(() => ctl.abort(), 8000);
        const u = SCRIPT_URL + '?mine=1&classCode=' + encodeURIComponent(state.classCode) +
          '&lesson=' + encodeURIComponent(state.lesson) + '&student=' + encodeURIComponent(state.student) +
          '&_=' + Date.now();
        const r = await fetch(u, { cache: 'no-store', signal: ctl.signal });
        clearTimeout(tm);
        if (!r.ok) return;
        const j = await r.json();
        if (!j || !j.ok) return;
        // Bộ não bản CŨ chỉ trả `errors` gộp → dựng thành 1 lượt để vẫn hỏi được (đường lùi)
        subs = Array.isArray(j.lansNop) ? j.lansNop : [];
        if (!subs.length && (j.errors || []).length) subs = [{ luc: '', errors: j.errors, timers: j.timers || [] }];
      }
      subs = subs.filter((s) => s && (s.errors || []).length);
      if (!subs.length) return;                 // em chưa nộp gì → làm bài mới, không làm phiền
      if (state.errors.length) return;          // trong lúc chờ mạng em đã kịp thêm lỗi → đừng chen ngang
      serverSubs = subs;
      showHistoryModal();
    } catch (e) { /* mạng/kho hỏng → làm bài bình thường, không làm phiền */ }
  }

  function showHistoryModal() {
    const n = serverSubs.length;
    $('histTitle').innerHTML = 'We found <b>' + n + '</b> submitted check' + (n > 1 ? 's' : '') +
      ' from <b>' + escapeHtml(state.student) + '</b>.';
    $('histList').innerHTML = serverSubs.map((s, i) => {
      const cnt = (s.errors || []).length;
      return '<button data-sub="' + i + '" class="w-full text-left rounded-xl border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50 transition px-3.5 py-2.5">' +
        '<div class="font-bold text-sm text-slate-800">' + (s.luc ? escapeHtml(s.luc) : 'Earlier submission') + '</div>' +
        '<div class="text-xs text-slate-500 mt-0.5">' + cnt + ' mistake' + (cnt > 1 ? 's' : '') + '</div>' +
        '</button>';
    }).join('');
    $('historyModal').classList.remove('hidden');
    $('historyModal').classList.add('flex');
    refreshIcons();
  }
  function hideHistoryModal() { $('historyModal').classList.add('hidden'); $('historyModal').classList.remove('flex'); }

  // Mở MỘT lượt nộp đã chọn → chế độ XEM (muốn sửa thì bấm "Edit & submit again" như chặng 29)
  function openServerSub(i) {
    const s = serverSubs[i];
    hideHistoryModal();
    if (!s) return;
    state.errors = (s.errors || []).map((er) => ({
      min: +er.min || 0, sec: +er.sec || 0, section: '',
      who: String(er.who || ''), type: String(er.type || ''),
      sentence: String(er.sentence || ''), detail: String(er.detail || ''), explain: String(er.explain || ''),
    }));
    state.submitted = true;
    state.wasSubmitted = true;
    if ((s.timers || []).length) initTimers(s.timers);
    buildStudentField();
    renderErrors();
    setReviewLock(true);
    autosave();
    toast('Opened your check with ' + state.errors.length + ' mistakes ✓', 'info');
  }

  // (switchTab đã bỏ chặng 12 — chỉ còn một khối Mistakes, thời gian nói nằm trong form)

  // ═══════════════ CHẶNG 29 — XEM LẠI BÀI ĐÃ NỘP (không cần đăng nhập, cùng thiết bị) ═══════════════
  // Bài đã Submit vẫn nằm nguyên trong localStorage (cờ submitted/wasSubmitted). Màn đăng nhập liệt kê
  // các bài đó → bấm mở CHẾ ĐỘ XEM (khoá form, ẩn sửa/xoá, ẩn Submit). Muốn sửa phải bấm
  // "Edit & submit again" và XÁC NHẬN qua modal (thầy chốt) — mở khoá xong nhớ Submit lại.
  let reviewLocked = false;

  // CHẶNG 33: CHỈ trả bài CỦA CHÍNH EM ĐANG ĐĂNG NHẬP (thầy chốt: "lịch sử của ai làm thì đúng
  // tên người đó mới xem được"). Lọc theo trường `student` bên TRONG dữ liệu → bài lưu bằng khoá
  // cũ (chỉ có link video) vẫn nhận đúng chủ.
  function submittedSaves(onlyStudent) {
    const want = String(onlyStudent || '').trim().toUpperCase();
    const out = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || k.indexOf('myspeaking_') !== 0) continue;
      try {
        const s = JSON.parse(localStorage.getItem(k));
        if (!s || !(s.submitted || s.wasSubmitted) || !s.student) continue;
        if (want && String(s.student).trim().toUpperCase() !== want) continue;
        out.push({ key: k, s: s });
      } catch (e) {}
    }
    out.sort((a, b) => String(b.s.savedAt || '').localeCompare(String(a.s.savedAt || '')));
    return out;
  }

  function renderReviewSection() {
    const list = submittedSaves(state.student);   // CHẶNG 33: chỉ bài của chính em đang chọn tên
    const sec = $('reviewSection');
    if (!list.length) { sec.classList.add('hidden'); return; }
    $('reviewList').innerHTML = list.slice(0, 6).map(({ key, s }) => {
      const d = s.savedAt ? new Date(s.savedAt) : null;
      const when = d ? String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') : '';
      return '<button data-review="' + escapeHtml(key) + '" class="w-full text-left rounded-xl border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50 transition px-3.5 py-2.5">' +
        '<div class="flex items-center gap-2">' +
        '<span class="font-bold text-sm text-slate-800 truncate">' + escapeHtml(s.topic || s.lesson || 'Speaking check') + '</span>' +
        '<span class="ml-auto text-[11px] font-bold text-slate-400 shrink-0">' + when + '</span></div>' +
        '<div class="text-xs text-slate-500 mt-0.5">' + escapeHtml(s.student) + ' · ' + escapeHtml(s.myTeam || '') +
        ' checked ' + escapeHtml(s.checkedTeam || '') + ' · ' + (s.errors || []).length + ' mistakes</div>' +
        '</button>';
    }).join('');
    sec.classList.remove('hidden');
    refreshIcons();
  }

  function openReview(key) {
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(key)); } catch (e) {}
    if (!saved || !saved.student) { toast('Cannot open this saved check.', 'err'); return; }
    saveKey = key;
    state.student = saved.student || ''; state.myTeam = saved.myTeam || '';
    state.className = saved.className || ''; state.classCode = saved.classCode || '';
    state.lesson = saved.lesson || ''; state.topic = saved.topic || '';
    state.checkedTeam = saved.checkedTeam || '';
    state.members = saved.members || [];
    state.videoUrl = saved.videoUrl || ''; state.videoId = saved.videoId || '';
    state.errors = saved.errors || [];
    state.submitted = !!saved.submitted;
    state.wasSubmitted = !!(saved.wasSubmitted || saved.submitted);
    state.khoFs = !!saved.khoFs;
    state.buoiId = saved.buoiId || '';
    state.moHinh = saved.moHinh === 2 ? 2 : 1;   // (Đợt B) xem lại bài mô hình 2 vẫn lọc đúng câu ẩn/gỡ
    state.cheDo = 'cham';
    state.clips = Array.isArray(saved.clips) ? saved.clips : [];   // (Đợt 3) pop-up video

    // dựng UI y hệt start() nhưng từ dữ liệu đã lưu — video YouTube phát bình thường, không cần server
    const myTeamNo = String(state.myTeam || '').replace(/[^0-9]/g, '');
    $('hdStudent').textContent = state.student + (myTeamNo ? ' · T' + myTeamNo : '');
    $('hdTopic').textContent = state.topic || '';
    initTimers(saved.timers);
    buildStudentField();
    renderErrors();
    initVideo();
    setReviewLock(true);

    $('loginScreen').classList.add('hidden');
    $('identifyScreen').classList.add('hidden');   // (CHẶNG 32) lịch sử nay nằm ở trang xác nhận → phải ẩn cả màn này
    $('appScreen').classList.remove('hidden');
    refreshIcons();
  }

  function setReviewLock(on) {
    reviewLocked = on;
    $('appScreen').classList.toggle('review-locked', on);
    $('reviewBanner').classList.toggle('hidden', !on);
    $('btnSubmit').classList.toggle('hidden', on);
    // CHẶNG 33: Delete all cũng phải theo khoá. ⚠️ setReviewLock hay được gọi SAU renderErrors
    // (openReview, maybeRestoreFromServer) nên phải tự cập nhật ở đây, không ỷ vào renderErrors.
    $('btnDelAll').classList.toggle('hidden', on || !state.errors.length);
  }
  function hideEditAgainModal() { $('editAgainModal').classList.add('hidden'); $('editAgainModal').classList.remove('flex'); }

  // ═══════════════ (Đợt 3 Firebase) POP-UP VIDEO CẢ LỚP — bấm logo là mở ═══════════════
  // Thầy chốt 26/08/2026: học sinh xem được bài của CÁC ĐỘI KHÁC để học hỏi tham khảo.
  // Nguồn video (theo thứ tự): state.clips (đường đăng nhập lấy từ teams; gói ?goi=
  // mang sẵn từ myLesson) → hỏi kho Firestore spBuoi (link cũ chưa có clips) → báo hiền.
  // Đường "về trang đăng nhập" cũ của logo DỜI vào nút nhỏ trong pop-up (vẫn hỏi
  // trước nếu còn dữ liệu chưa submit — không đổi lưới an toàn cũ).
  let vidChon = 0;   // đội đang xem trong pop-up

  async function layClips() {
    if (Array.isArray(state.clips) && state.clips.length) return state.clips;
    if (state.khoFs && state.buoiId && FS_GOC) {
      try {
        const r = await fetch(FS_GOC + '/spBuoi/' + encodeURIComponent(state.buoiId) + fsKey());
        if (r.ok) {
          const b = fsGiaiDoc(await r.json());
          state.clips = (b.teams || []).map((t) => ({ t: t.team, v: t.video || '' }));
          autosave();
          return state.clips;
        }
      } catch (e) { /* mạng hỏng — báo hiền bên dưới */ }
    }
    return state.clips || [];
  }

  // Khung phát cho một link: YouTube -> iframe nocookie; Drive -> iframe preview;
  // còn lại -> nút mở tab mới (không đoán bừa cách nhúng).
  function vidKhung(url) {
    const p = parseVideoUrl(url);
    if (p && p.type === 'youtube') {
      return '<iframe class="w-full h-full" src="https://www.youtube-nocookie.com/embed/' + p.id +
        '?rel=0" title="Team video" allow="autoplay; fullscreen" allowfullscreen></iframe>';
    }
    if (p && p.type === 'drive') {
      return '<iframe class="w-full h-full" src="https://drive.google.com/file/d/' + p.id +
        '/preview" allow="autoplay; fullscreen" allowfullscreen></iframe>';
    }
    return '<div class="w-full h-full flex items-center justify-center">' +
      '<a href="' + escapeHtml(url) + '" target="_blank" rel="noopener" ' +
      'class="bg-white/10 hover:bg-white/20 text-white font-bold text-sm rounded-xl px-4 py-2">Open video ↗</a></div>';
  }

  function veVidTabs(clips) {
    $('vidTabs').innerHTML = clips.map((c) => {
      const co = !!c.v;
      const minh = 'TEAM ' + c.t === state.myTeam;
      const cham = 'TEAM ' + c.t === state.checkedTeam;
      const on = Number(c.t) === Number(vidChon);
      return '<button data-vid="' + escapeHtml(String(c.t)) + '"' + (co ? '' : ' disabled') +
        ' class="rounded-xl border-2 px-3 py-1.5 text-xs font-bold transition ' +
        (on ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
            : co ? 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                 : 'border-slate-100 bg-slate-50 text-slate-300') + '">' +
        'TEAM ' + escapeHtml(String(c.t)) +
        (minh ? ' · mine' : (cham ? ' · checking' : '')) + '</button>';
    }).join('');
  }

  async function moVideosModal() {
    const clips = (await layClips()).filter((c) => c && c.t);
    const co = clips.filter((c) => c.v);
    if (!co.length) {
      toast('No team videos to watch here yet.', 'info');
      return;
    }
    // Mặc định mở video của đội MÌNH (xem lại bài mình trước) — không có thì đội đầu tiên
    const minh = co.find((c) => 'TEAM ' + c.t === state.myTeam);
    vidChon = (minh || co[0]).t;
    veVidTabs(clips);
    $('vidBox').innerHTML = vidKhung((clips.find((c) => Number(c.t) === Number(vidChon)) || co[0]).v);
    $('videosModal').classList.remove('hidden');
    $('videosModal').classList.add('flex');
    refreshIcons();
  }
  function dongVideosModal() {
    $('videosModal').classList.add('hidden');
    $('videosModal').classList.remove('flex');
    $('vidBox').innerHTML = '';        // gỡ iframe = dừng hẳn tiếng video trong pop-up
  }

  // ─── Gắn sự kiện ───
  document.addEventListener('DOMContentLoaded', async () => {
    refreshIcons();
    // Vào bằng gói từ myLesson: dựng bài ngay, khỏi hỏi bộ não (xem khối "VÀO THẲNG TỪ myLesson").
    const goi = docGoi();
    if (goi) {
      noiSuKien();
      vaoThangTuGoi(goi);
      return;
    }
    await loadClasses();
    initLoginScreen();

    noiSuKien();
  });

  // Mọi tay nghe sự kiện của trang. Tách ra thành hàm vì nay có HAI đường vào:
  // đường cũ (đăng nhập lớp) và đường mới (gói từ myLesson) — cả hai đều phải nối.
  function noiSuKien() {
    // CHẶNG 29 (CHẶNG 32 chuyển chỗ): danh sách bài đã nộp — nay dựng lúc VÀO TRANG XÁC NHẬN
    // (handleNamePick gọi renderReviewSection), không dựng ở màn đăng nhập nữa.
    $('reviewList').addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-review]');
      if (b) openReview(b.dataset.review);
    });
    $('btnEditAgain').addEventListener('click', () => { $('editAgainModal').classList.remove('hidden'); $('editAgainModal').classList.add('flex'); });
    $('btnEditAgainCancel').addEventListener('click', hideEditAgainModal);
    $('btnEditAgainOk').addEventListener('click', () => {
      hideEditAgainModal();
      setReviewLock(false);
      state.submitted = false;   // để cảnh báo rời trang + tóm tắt Submit hoạt động đúng; wasSubmitted vẫn giữ bài trong danh sách
      autosave();
      toast('You can edit now — press Submit again when you finish!', 'info');
    });

    // Màn đăng nhập lớp
    $('btnLogin').addEventListener('click', handleLogin);
    $('inpClass').addEventListener('keydown', (e) => { if (e.key === 'Enter') handleLogin(); });
    $('inpCode').addEventListener('keydown', (e) => { if (e.key === 'Enter') handleLogin(); });
    $('btnLoginErrOk').addEventListener('click', hideLoginErr);
    // Màn chọn tên: chọn Your Team → mở khóa Your Name; chọn Your Name → sang xác nhận ngay
    $('btnBackLogin').addEventListener('click', () => {
      $('identifyScreen').classList.add('hidden');
      $('loginScreen').classList.remove('hidden');
    });
    $('selTeam').addEventListener('change', onTeamChange);
    $('selName').addEventListener('change', () => {
      const teamNo = $('selTeam').value, name = $('selName').value;
      if (teamNo && name) handleNamePick(teamNo, name);
    });
    // Cam kết: phải tích mới bấm Start được
    $('chkAgree').addEventListener('change', (e) => setStartEnabled(e.target.checked));
    $('btnStartCheck').addEventListener('click', start);
    $('btnBackNames').addEventListener('click', renderIdentify);

    document.querySelectorAll('.errType').forEach((b) => b.addEventListener('click', () => { fType = b.dataset.type; renderTypeBtns(); }));

    // Ô SENTENCE / MISTAKE / EXPLANATION tự giãn cao khi gõ để xem hết chữ
    ['fSentence', 'fDetail', 'fExplain'].forEach((id) => $(id).addEventListener('input', (e) => autoGrow(e.target)));

    // Nút chọn HS có lỗi (delegation — wrap tồn tại sẵn, nút dựng lại sau mỗi buildStudentField)
    $('fStudentWrap').addEventListener('click', (ev) => {
      const b = ev.target.closest('.whoBtn');
      if (!b) return;
      fWhoSel = (fWhoSel === b.dataset.who) ? '' : b.dataset.who;  // bấm lại tên đang sáng = bỏ chọn
      renderWhoBtns();
    });

    // Khung điều khiển video luôn hiện
    $('vcPlay').addEventListener('click', () => {
      if (video.mode === 'html5' && video.el) { video.el.paused ? video.el.play() : video.el.pause(); }
      else if (video.mode === 'youtube' && video.yt && video.ready) {
        try { video.yt.getPlayerState() === 1 ? video.yt.pauseVideo() : video.yt.playVideo(); } catch (e) {}
      }
    });
    $('vcSeek').addEventListener('input', (e) => {
      vc.dragging = true;
      vcFill(e.target.value / 10);   // 0..1000 → 0..100% — phần đã chạy đỏ theo tay kéo
      $('vcCur').textContent = fmtClock((e.target.value / 1000) * vcDuration());  // xem trước mốc khi kéo
    });
    $('vcSeek').addEventListener('change', (e) => {
      vc.dragging = false;
      const t = (e.target.value / 1000) * vcDuration();
      if (video.mode === 'html5' && video.el) video.el.currentTime = t;
      else if (video.mode === 'youtube' && video.yt && video.ready) { try { video.yt.seekTo(t, true); } catch (e2) {} }
      syncTimeFields(t);   // kéo thanh tua (KỂ CẢ khi video đang DỪNG) → MIN/SEC nhảy theo ngay
    });

    // Chỉnh tay MIN/SEC: Enter hoặc click ra ngoài → video nhảy theo (2 chiều với syncTimeFields)
    ['fMin', 'fSec'].forEach((id) => {
      $(id).addEventListener('change', manualTimeSeek);
      $(id).addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); manualTimeSeek(); e.target.blur(); } });
    });

    // (Đợt 3) Bấm logo → POP-UP VIDEO CẢ LỚP (thầy chốt 26/08). Đang ở màn đăng
    // nhập/chọn tên (chưa vào bài) thì giữ nếp cũ: về trang chủ.
    $('btnHome').addEventListener('click', () => {
      if ($('appScreen').classList.contains('hidden')) {
        window.location.href = window.location.pathname;
        return;
      }
      moVideosModal();
    });
    // Đường "về trang đăng nhập" dời vào nút nhỏ trong pop-up — lưới cũ giữ nguyên:
    // còn dữ liệu chưa submit thì hỏi trước rồi mới cho đi.
    $('btnVidExit').addEventListener('click', () => {
      dongVideosModal();
      // (Đợt B) mô hình 2: "chưa gửi" = có SỬA chưa đồng bộ (kể cả phiếu phản biện)
      const unsubmitted = state.moHinh === 2
        ? m2CoSuaChuaGui()
        : (state.errors.length && !state.submitted);
      if (unsubmitted) { $('leaveModal').classList.remove('hidden'); $('leaveModal').classList.add('flex'); }
      else window.location.href = window.location.pathname;
    });
    $('btnVidClose').addEventListener('click', dongVideosModal);
    $('videosModal').addEventListener('click', (ev) => { if (ev.target.id === 'videosModal') dongVideosModal(); });
    $('vidTabs').addEventListener('click', async (ev) => {
      const b = ev.target.closest('[data-vid]');
      if (!b || b.disabled) return;
      vidChon = b.dataset.vid;
      const clips = await layClips();
      veVidTabs(clips);
      const c = clips.find((x) => String(x.t) === String(vidChon));
      if (c && c.v) $('vidBox').innerHTML = vidKhung(c.v);
    });
    $('btnLeaveCancel').addEventListener('click', () => { $('leaveModal').classList.add('hidden'); $('leaveModal').classList.remove('flex'); });
    $('btnLeaveOk').addEventListener('click', () => { window.location.href = window.location.pathname; });

    $('btnAddErr').addEventListener('click', addOrUpdateError);
    $('btnCancelEdit').addEventListener('click', clearErrForm);

    // ── (Đợt B) sự kiện của mô hình 2 + màn phản biện ──
    // Avatar phản hồi (màn chấm): bấm mở pop-up nhỏ nội dung phản biện + Keep/Agree
    $('errList').addEventListener('click', (ev) => {
      const av = ev.target.closest('[data-pv]');
      if (av) {
        const phan = av.dataset.pv.split('__');
        moPopPhanHoi(av, phan[0], phan.slice(1).join('__'));
        ev.stopPropagation();
        return;
      }
      // (phản biện) bấm mốc giờ → video nhảy đúng đoạn bị chấm
      const seek = ev.target.closest('[data-pbseek]');
      if (seek) { seekVideoTo(+seek.dataset.pbseek || 0); return; }
      // (phản biện) cặp tích Đồng ý / Phản đối — loại trừ nhau, phiếu của CHÍNH EM
      const vote = ev.target.closest('[data-pbvote]');
      if (vote) {
        const id = vote.dataset.err;
        const cu = m2.votes[id] || { y: '', lyDo: '' };
        m2.votes[id] = { y: vote.dataset.pbvote, lyDo: cu.lyDo || '' };
        renderErrorsPb();
        capNhatNutSubmit();
        if (vote.dataset.pbvote === 'phanDoi') {
          const o = document.querySelector('[data-pblydo="' + id + '"]');
          if (o && !o.value.trim()) o.focus();
        }
        return;
      }
      const edit = ev.target.closest('[data-edit]');
      const del = ev.target.closest('[data-del]');
      if (edit) {
        const i = +edit.dataset.edit;
        const e = state.errors[i];
        $('fMin').value = e.min; $('fSec').value = e.sec;
        setWho(e.who); fType = e.type; renderTypeBtns();
        $('fSentence').value = e.sentence || ''; $('fDetail').value = e.detail; $('fExplain').value = e.explain;
        autoGrowAll();
        editingIndex = i;
        $('btnAddErrLabel').textContent = 'Save changes';
        $('btnCancelEdit').classList.remove('hidden');
        $('fSentence').focus();
      }
      // CHẶNG 33: XOÁ PHẢI HỎI TRƯỚC (thầy chốt) — nút xoá chỉ mở pop-up, xoá thật ở btnDelOneOk
      if (del) {
        pendingDelIndex = +del.dataset.del;
        const e = state.errors[pendingDelIndex];
        const pos = sortedPositionOf(pendingDelIndex);
        $('delOneNo').textContent = '#' + pos;
        $('delOneWhat').textContent = e ? (fmtTime(e) + ' · ' + (e.type || '') + (e.detail ? ' — ' + e.detail : '')) : '';
        $('delOneModal').classList.remove('hidden');
        $('delOneModal').classList.add('flex');
        refreshIcons();
      }
    });

    // Ô thời gian nói dưới nút tên (delegation cùng chỗ với whoBtn)
    $('fStudentWrap').addEventListener('input', (ev) => {
      const f = ev.target.closest('[data-tt]');
      if (!f) return;
      const parts = f.dataset.tt.split(':');
      state.timers[+parts[0]][parts[1]] = f.value.replace(/[^0-9]/g, '');   // chỉ nhận số
      if (f.value !== state.timers[+parts[0]][parts[1]]) f.value = state.timers[+parts[0]][parts[1]];
      f.classList.remove('border-rose-400', 'ring-1', 'ring-rose-300');    // gỡ đánh dấu thiếu khi đã nhập
      autosave();
    });

    // Thanh kéo DỰ PHÒNG: kéo → giờ hiển thị chạy theo; SET TIME → đưa vào MIN/SEC kèm ánh sáng bay
    $('swSeek').addEventListener('input', () => { $('swCur').textContent = fmtClock(parseInt($('swSeek').value, 10) || 0); swFill(); });
    $('swSet').addEventListener('click', swSetTime);

    // (CHẶNG 32) đóng pop-up "nộp ít hơn lần trước"
    $('btnFewerOk').addEventListener('click', () => { $('fewerModal').classList.add('hidden'); $('fewerModal').classList.remove('flex'); });

    // (CHẶNG 33) XÁC NHẬN XOÁ — xoá 1 lỗi
    const closeDelOne = () => {
      $('delOneModal').classList.add('hidden'); $('delOneModal').classList.remove('flex');
      pendingDelIndex = -1;
    };
    $('btnDelOneCancel').addEventListener('click', closeDelOne);
    $('btnDelOneOk').addEventListener('click', () => {
      const i = pendingDelIndex;
      closeDelOne();
      if (i < 0 || i >= state.errors.length) return;
      if (state.moHinh === 2) {
        // (Đợt B) XOÁ MỀM: ẩn khỏi danh sách nhưng kho GIỮ VẾT (thầy phân tích trên lớp thấy đủ)
        state.errors[i].trangThai = 'an';
        if (editingIndex === i) clearErrForm();
      } else {
        state.errors.splice(i, 1);
        if (editingIndex === i) clearErrForm();
        else if (editingIndex > i) editingIndex--;   // các lỗi phía sau tụt 1 bậc
      }
      renderErrors(); autosave();
      toast('Mistake deleted', 'info');
    });

    // (CHẶNG 33) XÁC NHẬN XOÁ — xoá HẾT
    const closeDelAll = () => { $('delAllModal').classList.add('hidden'); $('delAllModal').classList.remove('flex'); };
    $('btnDelAll').addEventListener('click', () => {
      if (!state.errors.length || reviewLocked) return;
      $('delAllCount').textContent = state.errors.length;
      $('delAllModal').classList.remove('hidden'); $('delAllModal').classList.add('flex');
      refreshIcons();
    });
    $('btnDelAllCancel').addEventListener('click', closeDelAll);
    $('btnDelAllOk').addEventListener('click', () => {
      closeDelAll();
      const n = state.errors.length;
      if (state.moHinh === 2) {
        state.errors.forEach((e) => { e.trangThai = 'an'; });   // (Đợt B) xoá mềm cả loạt — giữ vết
      } else {
        state.errors = [];
      }
      clearErrForm();
      renderErrors(); autosave();
      toast('Deleted all ' + n + ' mistakes', 'info');
    });

    // (CHẶNG 35) pop-up hỏi bài đã nộp: chọn 1 bản để XEM, hoặc bỏ qua để làm bài mới tinh
    $('histList').addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-sub]');
      if (b) openServerSub(+b.dataset.sub);
    });
    $('btnHistNew').addEventListener('click', () => {
      hideHistoryModal();
      toast('Starting a brand-new check — good luck! 🔍', 'info');
    });

    // (CHẶNG 34) xoay ngang/dọc điện thoại hay kéo cỡ cửa sổ → tính lại cỡ chữ dòng dưới video
    let fitTimer = null;
    window.addEventListener('resize', () => { clearTimeout(fitTimer); fitTimer = setTimeout(fitVideoInfo, 120); });

    $('btnExport').addEventListener('click', exportExcel);
    $('btnSubmit').addEventListener('click', openSubmitModal);
    $('btnSubmitCancel').addEventListener('click', closeSubmitModal);
    // (CHẶNG 35) ít lỗi quá thì HỎI THÊM một lần nữa trước khi gửi thật
    $('btnSubmitOk').addEventListener('click', () => {
      // (Đợt B) mô hình 2 đếm câu CÒN SỐNG; đã nộp rồi thì cập nhật không cần hỏi thêm vụ ít lỗi
      const soLoi = state.moHinh === 2
        ? state.errors.filter((e) => e.trangThai === 'song').length
        : state.errors.length;
      if (soLoi <= IT_LOI && !(state.moHinh === 2 && m2.daNopLanNao)) {
        closeSubmitModal();
        $('fewMistakesN').textContent = soLoi;
        $('fewMistakesS').textContent = soLoi === 1 ? '' : 's';   // "1 mistake" chứ không "1 mistakes"
        $('fewMistakesModal').classList.remove('hidden');
        $('fewMistakesModal').classList.add('flex');
        refreshIcons();
        return;
      }
      submit();
    });
    const closeFew = () => { $('fewMistakesModal').classList.add('hidden'); $('fewMistakesModal').classList.remove('flex'); };
    $('btnFewReturn').addEventListener('click', closeFew);   // quay lại soi tiếp, KHÔNG gửi
    $('btnFewSubmit').addEventListener('click', () => { closeFew(); submit(); });

    // ── (Đợt B) các sự kiện còn lại của mô hình 2 ──
    // Ô lý do phản đối (màn phản biện) — gõ tới đâu nhớ tới đó, đổi là nút Submit VÀNG
    $('errList').addEventListener('input', (ev) => {
      const o = ev.target.closest('[data-pblydo]');
      if (!o) return;
      const id = o.dataset.pblydo;
      if (!m2.votes[id]) m2.votes[id] = { y: 'phanDoi', lyDo: '' };
      m2.votes[id].lyDo = o.value;
      o.classList.remove('ring-2', 'ring-rose-400');
      autoGrow(o);
      capNhatNutSubmit();
    });

    // Nút DISAGREEMENT: bật = sáng + nhấp nháy hào quang + dồn câu tranh chấp lên đầu;
    // bấm LẦN NỮA (tắt) = gửi ngầm các kết luận Keep/Agree lên kho (thầy chốt).
    $('btnDisagree').addEventListener('click', () => {
      m2.disOn = !m2.disOn;
      renderErrors();
      if (!m2.disOn) guiNgamKetLuan();
    });

    // Pop-up xác nhận Keep/Agree
    $('btnKaCancel').addEventListener('click', dongKaModal);
    $('btnKaOk').addEventListener('click', chotKetLuan);

    // Pop-up nhỏ nội dung phản biện: bấm ra ngoài là đóng
    document.addEventListener('click', (ev) => {
      const pop = $('pbPop');
      if (pop.classList.contains('hidden')) return;
      if (!pop.contains(ev.target) && !ev.target.closest('[data-pv]')) dongPopPhanHoi();
    });

    // Rời trang (đóng tab / F5 / bấm link ngoài) khi còn thứ chưa gửi → trình duyệt hỏi lại
    window.addEventListener('beforeunload', (ev) => {
      if (state.moHinh === 2 && m2CoSuaChuaGui()) { ev.preventDefault(); ev.returnValue = ''; }
    });
  }
})();
