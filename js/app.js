/* ═══════════════════════════════════════════════════════════════
   mySpeaking — SPEAKING TEAM CHECK
   App bắt lỗi video thuyết trình cho học sinh (GitHub Pages)
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const CFG = window.MYSPEAKING_CONFIG || {};
  const $ = (id) => document.getElementById(id);

  // ─── Danh sách lớp — mô hình 1 LINK CHUNG + đăng nhập theo lớp ───
  // Nguồn: kho Firestore `spBuoi` (ưu tiên) rồi "bộ não" Apps Script ?config=1.
  // (02/09/2026 — bảo mật A5) File tĩnh data/classes.json ĐÃ BỎ khỏi kho PUBLIC: nó chứa mã
  // lớp + tên học sinh + link video, ai cũng tải được. Đừng thêm lại.
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
    nhanXanh: 'UPDATED',   // (Đợt SUBMIT/UPDATE) chữ hiện khi nút XANH LÁ — 'SUBMITTED' chỉ đúng
                            // MỘT LẦN ngay sau lượt gửi ĐẦU TIÊN, các lượt sau luôn 'UPDATED'.
    // (Đợt ALL/MINE, màn phản biện) 'all' = mọi lỗi cả đội · 'mine' = chỉ lỗi ghi tên em ·
    // 'conflict' = (02/09/2026) chỉ những câu CHÍNH CHỦ ĐÃ NHẬN mà đồng đội vẫn cãi hộ.
    // ⛔ Trước đây là cờ `locMine` hai trạng thái — đổi sang chuỗi 3 trạng thái, đừng để sót
    // chỗ nào còn so `m2.locMine` (đã rà: nguồn danh sách · dấu chưa-xác-nhận · badge · nút).
    loc: 'all',
    vuaGuiPb: [],   // (Đợt STT xanh/xám) errId vừa gửi xong trong 1 giây gần nhất — hiện icon thay số
    draftPb: {},   // (Đợt lưu nháp) errId -> nội dung đang gõ dở CHƯA gửi, nạp/lưu vào localStorage
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
  function avLopSlug() {
    return khongDauTen(tenLopNgan(state.className) || state.classCode).replace(/[^a-z0-9]/g, '');
  }
  function avatarUrl(ten) {
    return AVATAR_GOC + avLopSlug() + '/' + slugAvatar(ten) + '.jpg';
  }

  /* ══ ⭐ 03/09/2026 — ẢNH ĐẠI DIỆN LẤY TỪ KHO, KHÔNG CÒN NEO VÀO TÊN ══════════════
     Sự cố 02/09: myStudent đổi tên 64 em từ tên gọi ngắn sang tên đầy đủ
     ("THƯ" → "MINH THƯ"); ảnh trên web đặt tên FILE THEO TÊN nên 48 em mất ảnh,
     câm lặng. Màn này còn dễ dính hơn myLesson: buổi speaking giữ TÊN TẠI LÚC TẠO
     BUỔI, nên buổi cũ mãi mang tên ngắn kể cả sau khi danh sách đã đổi tên.

     Cách chữa — hai lớp, giống hệt myLesson (`myLesson/web/js/chung.js`):
       ① LỚP NỀN: ảnh file `andrewclasses.com/assets/avatar/<lop>/<ten>.jpg` như cũ.
       ② ĐÈ LÊN: kho `lessonAvatar/{lop-slug}` — MỘT tài liệu cho cả lớp, ảnh xếp
          theo MÃ SỐ em (myLesson app đẩy lên sau mỗi lượt đồng bộ danh sách).
     Ở đây KHÔNG có mã số em (gói `?goi=` chỉ mang tên), nên dò bằng `avTenKhop`:
     bằng nhau HOẶC là ĐUÔI của nhau — chính luật đuôi này khớp được "THƯ" của buổi
     cũ với "MINH THƯ" trên kho.
     💸 1 lượt đọc cho CẢ LỚP + đệm 10 phút (LUẬT 8). ⛔ Đừng tách mỗi em một tài liệu.
     ⛔ Luật này CHÉP Ở HAI NƠI với `myLesson/web/js/chung.js` — sửa một bên sửa cả hai. */
  const AV_CACHE_GIAY = 600;
  let AV_KHO = null;          // { "<id>": {t, a} } đã nạp cho lớp của buổi này
  // ⛔⛔ CHỐT CHỐNG HỎI LẠI LIÊN TỤC (bắt được lúc chạy thử 03/09 bên myLesson).
  // `batAvatarKho()` được gọi ở CẢ BA màn (`datAvatarDauTrang` gọi mỗi lần đổi màn).
  // Kho 403 (luật chưa dán) hay mất mạng thì không có gì để đệm ⇒ mỗi lần đổi màn lại
  // bắn thêm một lượt hỏi kho. Nhớ RIÊNG mốc hỏng và im 60 giây — vẫn không đệm nội
  // dung rỗng, chỉ đệm cái sự "vừa hỏi hụt".
  const AV_HONG = {};
  const AV_HONG_GIAY = 60;

  function avTenKhop(a, b) {
    const x = khongDauTen(a).replace(/\s+/g, ' ').trim();
    const y = khongDauTen(b).replace(/\s+/g, ' ').trim();
    if (!x || !y) return false;
    if (x === y) return true;
    return x.length > y.length ? x.slice(-(y.length + 1)) === (' ' + y)
                               : y.slice(-(x.length + 1)) === (' ' + x);
  }

  async function napAvatarKho() {
    const slug = avLopSlug();
    if (!FS_GOC || !slug) return {};
    const khoa = 'sp_av1:' + slug;
    try {
      const o = JSON.parse(sessionStorage.getItem(khoa) || 'null');
      if (o && (Date.now() - o.luc) < AV_CACHE_GIAY * 1000) return o.em;
    } catch (e) {}
    if (AV_HONG[slug] && (Date.now() - AV_HONG[slug]) < AV_HONG_GIAY * 1000) return {};
    try {
      const r = await fetch(FS_GOC + '/lessonAvatar/' + encodeURIComponent(slug) + fsKey(),
        { cache: 'no-store' });
      // 404 = lớp chưa từng được đẩy ảnh lên kho. KHÔNG phải lỗi — lớp nền lo tiếp.
      if (!r.ok && r.status !== 404) { AV_HONG[slug] = Date.now(); return {}; }
      delete AV_HONG[slug];
      const j = r.status === 404 ? { fields: {} } : await r.json();
      const f = (j.fields && j.fields.em && j.fields.em.mapValue
                 && j.fields.em.mapValue.fields) || {};
      const em = {};
      Object.keys(f).forEach((id) => {
        const g = (f[id].mapValue && f[id].mapValue.fields) || {};
        const a = g.a && g.a.stringValue;
        if (a) em[id] = { t: (g.t && g.t.stringValue) || '', a };
      });
      // ⛔ CHỈ đệm khi đọc được thật — đệm cả lượt hỏng là đóng băng bảng rỗng 10 phút.
      try { sessionStorage.setItem(khoa, JSON.stringify({ luc: Date.now(), em })); } catch (e) {}
      return em;
    } catch (e) { AV_HONG[slug] = Date.now(); return {}; }
  }

  // Đè ảnh kho lên mọi ô đã vẽ. Ô nào cũng mang `data-av-em`.
  // ⛔ Dấu đặt trên Ô, KHÔNG trên <img>: `onerror="this.remove()"` gỡ hẳn thẻ ảnh khi
  //    thiếu, đánh dấu lên đó là mất manh mối của đúng những em đang cần cứu nhất.
  function deAvatarKho() {
    if (!AV_KHO) return 0;
    const ids = Object.keys(AV_KHO);
    if (!ids.length) return 0;
    const o = document.querySelectorAll('[data-av-em]');
    let de = 0;
    for (let i = 0; i < o.length; i++) {
      const el = o[i], ten = el.getAttribute('data-av-em');
      let id = null;
      for (let k = 0; k < ids.length; k++) {
        if (avTenKhop(AV_KHO[ids[k]].t, ten)) { id = ids[k]; break; }
      }
      if (!id) continue;
      let img = el.tagName === 'IMG' ? el : el.querySelector('img');
      if (!img) {
        img = document.createElement('img');
        img.alt = '';
        img.className = 'absolute inset-0 w-full h-full object-cover';
        el.insertBefore(img, el.firstChild);
      }
      const moi = 'data:image/jpeg;base64,' + AV_KHO[id].a;
      if (img.getAttribute('src') !== moi) { img.setAttribute('src', moi); de++; }
    }
    return de;
  }

  // Bật một lần cho cả trang: nạp kho rồi đè, và đè lại mỗi khi màn vẽ thêm ô mới.
  // ⛔ CHỈ theo dõi `childList`, TUYỆT ĐỐI KHÔNG theo dõi `attributes`: chính hàm đè
  //    đổi `src`, theo dõi attributes là nó tự gọi lại mình vô tận.
  let avTai = null, avHen = null;
  async function batAvatarKho() {
    AV_KHO = await napAvatarKho();
    deAvatarKho();
    if (avTai) return;
    try {
      avTai = new MutationObserver(() => {
        if (avHen) return;
        avHen = setTimeout(() => { avHen = null; deAvatarKho(); }, 250);
      });
      avTai.observe(document.body, { childList: true, subtree: true });
    } catch (e) { /* trình duyệt cổ: vẫn có lượt đè đầu tiên ở trên */ }
  }

  // ⭐ (02/09/2026 — thầy chốt) Ảnh tròn góc trái thanh tím = AVATAR CỦA CHÍNH EM đang đăng
  // nhập (trước là ảnh thầy `img/avatar-tron.jpg`). Dùng đúng kho ảnh + đúng hàm `avatarUrl()`
  // của avatar phiếu phản biện nên không đẻ thêm đường ảnh mới.
  // ⛔ Thiếu ảnh thì `onerror` GỠ hẳn thẻ <img> để lộ vòng tròn chữ tắt phía sau — đừng đổi
  // sang `display:none`, ảnh hỏng vẫn chiếm chỗ và che mất chữ.
  // ⛔ Gọi hàm này SAU khi `state.student`/`state.className` đã có; gọi sớm thì `avatarUrl()`
  // ghép ra đường lớp rỗng, ảnh 404 và em nào cũng ra chữ tắt.
  function datAvatarDauTrang() {
    const img = $('hdAvatar'), chu = $('hdAvatarChu');
    if (!img || !state.student) return;
    if (chu) chu.textContent = initialsOf(state.student);
    img.onerror = function () { img.remove(); };
    img.src = avatarUrl(state.student);
    img.alt = state.student;
    // ⭐ 03/09/2026 — dấu để `deAvatarKho()` đè ảnh mới nhất từ kho. Đặt trên Ô BAO
    // (thẻ cha), không trên <img>: `onerror` ngay trên kia gỡ hẳn thẻ ảnh khi thiếu.
    if (img.parentNode && img.parentNode.setAttribute) {
      img.parentNode.setAttribute('data-av-em', state.student);
    }
    batAvatarKho();
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

  // Nút SUBMIT/UPDATE 3 màu + CHỮ (thầy chốt, đợt 2): TRẮNG "SUBMIT" chưa gửi lần nào, chưa sửa
  // gì · XANH LÁ "SUBMITTED"/"UPDATED" đã gửi, không có gì chờ · VÀNG nhấp nháy to-nhỏ "SUBMIT"/
  // "UPDATE" có sửa chưa gửi. "SUBMIT" chỉ hiện TRƯỚC lần nộp đầu tiên — sau đó mãi mãi là
  // "UPDATE" (đọc theo `daCo`/`m2.daNopLanNao`, cờ này set 1 lần rồi giữ mãi). Chỉ áp mô hình 2.
  function capNhatNutSubmit() {
    if (state.moHinh !== 2) return;
    const b = $('btnSubmit');
    b.classList.remove('bg-emerald-500', 'hover:bg-emerald-400', 'bg-white', 'text-emerald-700',
      'hover:bg-emerald-50', 'nut-vang-nhay', 'bg-amber-400', 'hover:bg-amber-300', 'text-slate-900');
    const daCo = state.cheDo === 'phanbien' ? (m2.votesServer !== '' && m2.votesServer !== '{}') : m2.daNopLanNao;
    let chu;
    if (m2CoSuaChuaGui()) {
      b.classList.add('bg-amber-400', 'hover:bg-amber-300', 'text-slate-900', 'nut-vang-nhay');
      chu = daCo ? 'UPDATE' : 'SUBMIT';
    } else if (daCo) {
      b.classList.add('bg-emerald-500', 'hover:bg-emerald-400');
      chu = m2.nhanXanh || 'UPDATED';
    } else {
      b.classList.add('bg-white', 'text-emerald-700', 'hover:bg-emerald-50');
      chu = 'SUBMIT';
    }
    const nhanChu = b.querySelector('span');
    if (nhanChu) nhanChu.textContent = chu; else b.textContent = chu;
    b.title = chu;
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
    $('btnCancelEdit').classList.add('hidden');
    capNhatNhanNutThem();
    xoaNhapTamCham();   // (Đợt lưu nháp) form trống lại thì dọn luôn ô nhớ nháp, khỏi vương lại
  }

  // ⭐ (02/09/2026 — thầy chốt) CHỮ TRÊN NÚT ĐỎ nói đúng việc nó sắp làm:
  //   không sửa gì            → "Add this mistake"  (đỏ, thêm mới)
  //   đang sửa, còn chữ       → "Save changes"      (đỏ, lưu lại)
  //   đang sửa, TRỐNG cả 3 ô  → "Delete this mistake" (đỏ sẫm — đường xoá DUY NHẤT còn lại)
  // Xoá trắng 3 ô chính là lời xác nhận, nên không hỏi thêm pop-up nào nữa; muốn huỷ thì bấm
  // Cancel ngay bên cạnh, lỗi còn nguyên như cũ.
  function dangDinhXoa() {
    return editingIndex >= 0 && !$('fSentence').value.trim() &&
      !$('fDetail').value.trim() && !$('fExplain').value.trim();
  }
  function capNhatNhanNutThem() {
    const nhan = $('btnAddErrLabel');
    const nut = $('btnAddErr');
    if (!nhan || !nut) return;
    const xoa = dangDinhXoa();
    nhan.textContent = xoa ? 'Delete this mistake' : (editingIndex >= 0 ? 'Save changes' : 'Add this mistake');
    nut.classList.toggle('bg-rose-700', xoa);
    nut.classList.toggle('hover:bg-rose-800', xoa);
    nut.classList.toggle('bg-rose-500', !xoa);
    nut.classList.toggle('hover:bg-rose-600', !xoa);
    const ic = nut.querySelector('[data-lucide]');
    if (ic && ic.dataset.lucide !== (xoa ? 'trash-2' : 'plus-circle')) {
      ic.dataset.lucide = xoa ? 'trash-2' : 'plus-circle';
      refreshIcons();
    }
  }

  // Xoá MỀM một lỗi (mô hình 2 giữ vết `an` cho thầy phân tích; buổi cũ thì cắt hẳn khỏi mảng)
  function xoaLoiDangSua() {
    const i = editingIndex;
    if (i < 0 || i >= state.errors.length) return;
    if (state.moHinh === 2) state.errors[i].trangThai = 'an';
    else state.errors.splice(i, 1);
    clearErrForm();
    renderErrors();
    if (state.moHinh === 2) capNhatNutSubmit();
    autosave();
    toast('Mistake deleted', 'info');
  }

  // (Đợt lưu nháp form CHẤM) đừng để HS gõ dở SENTENCE/MISTAKE/EXPLANATION mà lỡ thoát/tải lại
  // trang là mất sạch — lưu tạm dưới khoá RIÊNG theo saveKey (mỗi HS/mỗi video một ô nhớ, giống
  // luật CHẶNG 33), KHÔNG trộn vào state.errors thật nên không ảnh hưởng logic Submit sẵn có.
  function khoaNhapTamCham() { return saveKey + '_nhaptam'; }
  function luuNhapTamCham() {
    try {
      localStorage.setItem(khoaNhapTamCham(), JSON.stringify({
        min: $('fMin').value, sec: $('fSec').value, who: fWhoSel, type: fType,
        sentence: $('fSentence').value, detail: $('fDetail').value, explain: $('fExplain').value,
      }));
    } catch (e) {}
  }
  function xoaNhapTamCham() { try { localStorage.removeItem(khoaNhapTamCham()); } catch (e) {} }
  function khoiPhucNhapTamCham() {
    let nhap;
    try { nhap = JSON.parse(localStorage.getItem(khoaNhapTamCham()) || 'null'); } catch (e) { nhap = null; }
    if (!nhap) return;
    const coGi = nhap.sentence || nhap.detail || nhap.explain || nhap.who || nhap.type || nhap.min !== '' || nhap.sec !== '';
    if (!coGi || editingIndex >= 0) return;   // đang sửa lỗi có sẵn thì đừng đè nháp lên
    $('fMin').value = nhap.min || ''; $('fSec').value = nhap.sec || '';
    setWho(nhap.who || ''); fType = nhap.type || ''; renderTypeBtns();
    $('fSentence').value = nhap.sentence || ''; $('fDetail').value = nhap.detail || ''; $('fExplain').value = nhap.explain || '';
    autoGrowAll();
  }

  // Khi THÊM lỗi mới: LUÔN lùi 3 giây (HS nghe thấy lỗi rồi mới gõ nên mốc thật sớm hơn ~3s).
  // KHÔNG lùi khi SỬA lỗi cũ (mốc đã được lùi từ lần thêm rồi).
  const REWIND_SEC = 3;
  function addOrUpdateError() {
    if (reviewLocked) return;   // CHẶNG 29: đang XEM bài đã nộp — muốn sửa phải bấm "Edit & submit again"
    // ⭐ (02/09/2026) ĐANG SỬA mà xoá trắng cả 3 ô chữ = em muốn XOÁ câu này. Phải chặn TRƯỚC
    // mọi cửa kiểm tra bên dưới, nếu không 3 ô rỗng sẽ bị báo "please write the SENTENCE…"
    // và em không tài nào xoá được. Xoá thiếu ô (còn 1-2 ô có chữ) thì rơi xuống nhánh kiểm
    // tra như cũ — đó là sửa hỏng, không phải ý muốn xoá.
    if (dangDinhXoa()) { xoaLoiDangSua(); return; }
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
    // (Đợt B) mô hình 2: 'an' (em tự xoá) KHÔNG hiện.
    let ds = state.errors.map((e, i) => ({ e, i }));
    if (m2Mode) ds = ds.filter((x) => x.e.trangThai !== 'an');
    ds.sort((a, b) => (tSec(a.e) - tSec(b.e)));
    // ⭐ (Đợt Keep/Accept 02/09/2026 — thầy chốt) SỐ THỨ TỰ CHUẨN: chốt SỐ ngay tại đây, trên
    // danh sách xếp thuần theo mốc giờ, TRƯỚC khi dồn câu. Bản cũ in `pos + 1` = vị trí SAU KHI
    // dồn ⇒ bật nút REQUIREMENT một cái là cả bảng nhảy số, thầy và học sinh không còn đối
    // chiếu "câu số mấy" với nhau được. Nay số bám theo CÂU, dồn kiểu gì cũng đứng yên.
    const sttChuan = {};
    ds.forEach((x, k) => { sttChuan[x.e.id || ('#' + x.i)] = k + 1; });
    // Bật nút REQUIREMENT thì câu còn tranh chấp THẬT + chưa xử lý dồn lên đầu (thầy chốt).
    // ⛔ Câu đã Accept ('go') KHÔNG còn bị đẩy xuống cuối như bản cũ — thầy chốt cho em đổi ý
    // thoải mái, mà chìm xuống đáy danh sách thì em không tìm lại nổi để bấm lại.
    if (m2Mode && m2.disOn) {
      const hang = (x) => (!x.e.ketLuan && tranhChapThat(x.e) ? 0 : 1);
      ds.sort((a, b) => hang(a) - hang(b) || (tSec(a.e) - tSec(b.e)));
    }
    list.innerHTML = ds.map(({ e, i }) => {
      const st = TYPE_STYLE[e.type] || { badge: 'bg-slate-100 text-slate-600' };
      const daGo = m2Mode && e.trangThai === 'go';
      const phieu = m2Mode ? phieuCuaLoi(e.id) : [];
      // (Đợt khung vàng) MỌI lỗi có ≥1 phiếu phản đối → viền vàng — KHÔNG tự tắt dù đã KEEP/AGREE
      // (thầy chốt: giữ như dấu vết lịch sử, badge KEPT/RELEASED đã đánh dấu riêng phần đã quyết).
      const phieuPhanDoi = phieu.filter((p) => p.y === 'phanDoi');
      // ⭐ (Đợt CHÍNH CHỦ QUYẾT) tranh chấp THẬT mới được viền vàng + 2 nút. Chính chủ đã tự
      // nhận thì câu coi như chốt: lý do cãi hộ của đồng đội VẪN HIỆN bình thường (thầy chốt)
      // nhưng chỉ còn là tham khảo, ô sang viền xanh lá như mọi câu đã ngã ngũ.
      const conTranhChap = m2Mode && tranhChapThat(e);
      // ⭐ (Đợt viền xanh lá — thầy chốt) câu đã có người AGREE mà không còn tranh chấp ⇒ viền
      // XANH LÁ DÀY BẰNG viền vàng, nền để trắng (chỉ ô tranh chấp mới có nền vàng).
      const daNgaNgu = m2Mode && !conTranhChap && phieu.some((p) => p.y === 'dongY');
      // Icon uploaded (chấm xanh trái ô): câu này ĐÃ nằm trên kho đúng y bản đang thấy
      const daLuu = m2Mode && m2LoiDaDongBo(e);
      // (Đợt viền dày hơn) đổi hẳn ĐỘ DÀY viền cho câu tranh chấp (border-4) thay vì chỉ đổi màu
      // trên viền 1px cũ — viền mỏng amber-400 quá mờ, khó nhận ra giữa các ô khác.
      return '<div class="slidein rounded-2xl p-3.5 transition group ' +
        (daGo ? 'err-go ' : '') +
        (conTranhChap ? 'border-4 border-amber-400 bg-amber-100/60' :
          daNgaNgu ? 'border-4 border-emerald-400' :
            'border border-slate-200' + (daGo ? '' : ' hover:border-indigo-300')) + '">' +
        '<div class="flex items-center gap-2 flex-wrap">' +
        (m2Mode ? '<span class="shrink-0 w-4 h-4 rounded-full flex items-center justify-center ' +
          (daLuu ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-400') + '" title="' +
          (daLuu ? 'Saved to server' : 'Not submitted yet') + '"><i data-lucide="' + (daLuu ? 'check' : 'arrow-up') + '" class="w-2.5 h-2.5 pointer-events-none"></i></span>' : '') +
        // CHẶNG 33: STT đứng TRƯỚC mốc giờ. Đánh theo THỨ TỰ THỜI GIAN → khớp cách đánh số của
        // file Excel bên app máy tính. (02/09/2026) lấy từ bảng `sttChuan` chốt sẵn ở trên,
        // KHÔNG dùng vị trí sau khi dồn — xem chú thích chỗ dựng bảng đó.
        '<span class="shrink-0 w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 font-extrabold text-xs flex items-center justify-center">' + (sttChuan[e.id || ('#' + i)] || '') + '</span>' +
        '<span class="font-mono font-bold text-sm bg-slate-900 text-white rounded-lg px-2 py-0.5">' + fmtTime(e) + '</span>' +
        (e.section ? '<span class="text-xs font-bold text-slate-500">Section ' + escapeHtml(e.section) + '</span>' : '') +
        '<span class="text-xs font-bold rounded-full px-2.5 py-1 ' + st.badge + '">' + typeLabel(e.type) + '</span>' +
        (e.who ? '<span class="text-xs font-semibold text-slate-600 flex items-center gap-1">👤 ' + escapeHtml(e.who) + '</span>' : '') +
        (daGo ? '<span class="text-[10px] font-extrabold text-slate-400 border border-slate-300 rounded-full px-2 py-0.5">RELEASED</span>' : '') +
        (m2Mode && e.ketLuan === 'keep' ? '<span class="text-[10px] font-extrabold text-rose-500 border border-rose-300 rounded-full px-2 py-0.5">KEPT</span>' : '') +
        '<span class="ml-auto flex items-center gap-1">' +
        // (Đợt B) avatar người chấp nhận (nền xanh) / phản đối (nền đỏ) — bấm mở pop-up nội dung
        (phieu.length ? '<span class="flex items-center mr-1">' + phieu.map((p) => avatarVong(p.voter, p.y, e.id)).join('') + '</span>' : '') +
        // ⛔ (02/09/2026 — thầy chốt) NÚT THÙNG RÁC ĐÃ BỎ, đừng dựng lại. Xoá nay đi qua nút bút
        // chì: xoá trắng cả 3 ô SENTENCE/MISTAKE/EXPLANATION thì nút đỏ tự thành "Delete this
        // mistake" (xem `capNhatNhanNutThem()`), vừa chậm lại một nhịp vừa bắt em nhìn kỹ câu
        // mình sắp bỏ. Nút bút chì vẫn LUÔN hiện kể cả câu đã Accept — em còn sửa chữ được.
        '<span class="flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition">' +
        '<button data-edit="' + i + '" class="p-1.5 rounded-lg hover:bg-indigo-100 text-indigo-600"><i data-lucide="pencil" class="w-4 h-4 pointer-events-none"></i></button>' +
        '</span>' +
        '</span></div>' +
        // CHẶNG 35 (thầy chốt): thứ tự SENTENCE → MISTAKE → EXPLANATION, mỗi dòng một kiểu chữ:
        // câu chứa lỗi = ĐEN đậm NGHIÊNG · lỗi = ĐỎ đậm thường · giải thích = XANH LÁ đậm thường.
        (e.sentence ? '<div class="mt-1.5 text-sm font-bold italic text-slate-900">“' + escapeHtml(e.sentence) + '”</div>' : '') +
        '<div class="mt-0.5 text-sm font-bold text-rose-600">' + escapeHtml(e.detail) + '</div>' +
        (e.explain ? '<div class="mt-0.5 text-sm font-bold text-emerald-600">' + escapeHtml(e.explain) + '</div>' : '') +
        // (Đợt khung vàng) hiện đủ TỪNG DÒNG "TÊN: lý do" của mọi người đã phản đối, không chỉ avatar
        (phieuPhanDoi.length ? '<div class="mt-2 pt-2 border-t ' +
          (conTranhChap ? 'border-amber-200' : 'border-slate-200') + ' space-y-1">' +
          phieuPhanDoi.map((p) => '<div class="text-xs font-bold ' +
            (conTranhChap ? 'text-amber-700' : 'text-slate-400') + '"><b>' +
            escapeHtml(p.voter) + '</b>: ' + escapeHtml(p.lyDo || '(no reason given)') + '</div>').join('') +
          // Chính chủ đã tự nhận ⇒ mấy dòng cãi hộ này chỉ còn là tham khảo (thầy chốt: VẪN
          // HIỆN bình thường, chỉ hạ màu cho khỏi tưởng là còn việc phải xử).
          (conTranhChap ? '' :
            '<div class="text-[10px] font-bold text-slate-400 italic">' +
            escapeHtml(e.who || '') + ' agreed — the notes above are for reference only.</div>') +
          '</div>' : '') +
        // ⭐ (02/09/2026 — thầy chốt) HAI NÚT quyết định, hàng CUỐI CÙNG trong ô, mỗi nút gần nửa
        // chiều ngang. CHỈ hiện ở ô còn tranh chấp THẬT — ô không ai cãi thì chẳng có gì để giữ
        // hay nhường. Bấm được cả sau khi đã gửi: đổi ý xong nút góc phải tự sang vàng UPDATE.
        (conTranhChap ? '<div class="mt-2.5 flex gap-2">' +
          '<button data-ka="keep" data-err="' + escapeHtml(e.id) + '"' +
          ' class="flex-1 rounded-xl border-2 py-1.5 text-xs font-extrabold transition ' +
          (e.ketLuan === 'keep' ? 'border-amber-500 bg-amber-500 text-white'
            : 'border-amber-300 text-amber-700 hover:bg-amber-50' + (e.ketLuan === 'agree' ? ' ka-mo' : '')) +
          '">Keep Issue</button>' +
          '<button data-ka="agree" data-err="' + escapeHtml(e.id) + '"' +
          ' class="flex-1 rounded-xl border-2 py-1.5 text-xs font-extrabold transition ' +
          (e.ketLuan === 'agree' ? 'border-blue-600 bg-blue-600 text-white'
            : 'border-blue-300 text-blue-700 hover:bg-blue-50' + (e.ketLuan === 'keep' ? ' ka-mo' : '')) +
          '">Accept Appeal</button>' +
          '</div>' : '') +
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

    // ⛔ (02/09/2026) nút "Delete all" đã bỏ hẳn — xem chú thích trong index.html chỗ khung này.
    refreshIcons();
  }
  function tSec(e) { return (parseInt(e.min, 10) || 0) * 60 + (parseInt(e.sec, 10) || 0); }
  // ⛔ (02/09/2026) `sortedPositionOf()` ĐÃ GỠ cùng pop-up hỏi xoá — nó là chỗ DUY NHẤT gọi.
  // Nhân tiện nó vốn ĐẾM SAI: xếp trên `state.errors` NGUYÊN VẸN, tính cả câu đã ẩn ('an'),
  // nên số "#mấy" trong pop-up lệch với số hiện trên màn. Số thứ tự nay chốt một chỗ duy nhất
  // là bảng `sttChuan` trong `renderErrors()` — đừng dựng lại hàm đếm thứ hai.
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
  // Cả hai kho hỏng thì CLASSES giữ nguyên `{classes: []}` — màn đăng nhập báo chưa có lớp.
  // (02/09/2026) Không còn dự phòng file tĩnh data/classes.json (đã bỏ khỏi kho PUBLIC).
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
    CLASSES = { classes: [] };
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
      toast('Chưa có buổi speaking nào đang mở. Thầy cần mở buổi trong app mySpeaking.', 'err');
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
    // ⭐ 03/09/2026 — hai chế độ MỚI, cùng đi qua `?goi=` như hai cái cũ:
    //   kt:1 = KIỂM TRA TRÙNG (đội BỊ CHẤM gộp lỗi trùng) — myLesson gửi video ĐỘI EM
    //   xn:1 = XÁC NHẬN TRÙNG (đội CHẤM bỏ phiếu)         — myLesson gửi video ĐỘI BỊ CHẤM
    // ⛔ Chỉ nhận khi mô hình 2 + có buổi Firestore: buổi cũ (Google Sheets) không có kho
    //    `cum` nào để đọc, vào là màn trắng trơn.
    state.cheDo = state.moHinh !== 2 ? 'cham'
      : g.kt === 1 ? 'kiemtratrung'
        : g.xn === 1 ? 'xacnhantrung'
          : g.pb === 1 ? 'phanbien' : 'cham';
    // (Đợt 3) gói mang video mọi đội; gói cũ không có thì pop-up tự hỏi kho Firestore
    state.clips = Array.isArray(g.clips) ? g.clips : [];
    // ⭐ 03/09 — `cb` = đội ĐANG CHẤM đội em (khác `cham` = đội EM đi chấm). Chỉ màn
    // KIỂM TRA TRÙNG cần, để ghi "cụm này TEAM mấy sẽ bỏ phiếu"; thiếu thì bỏ dòng đó.
    state.chamBoi = g.cb ? 'TEAM ' + g.cb : '';
    saveKey = makeSaveKey(state.student, state.videoUrl) + (state.cheDo === 'phanbien' ? '_pb' : '');
    if (state.cheDo === 'kiemtratrung' || state.cheDo === 'xacnhantrung') { startTrung(); return; }
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
    datAvatarDauTrang();   // (02/09/2026) ảnh tròn góc trái = avatar CHÍNH EM, không phải ảnh thầy
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
    datAvatarDauTrang();   // (02/09/2026) ảnh tròn góc trái = avatar CHÍNH EM, không phải ảnh thầy
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
      khoiPhucNhapTamCham();   // (Đợt lưu nháp) form chưa Add có sẵn nội dung cũ thì nạp lại
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
    // (Đợt lưu nháp) nạp lại chữ đang gõ dở CHƯA gửi của MÁY này, buổi này, em này. Câu nào có
    // nháp mà CHƯA từng bấm DISAGREE (m2.votes chưa có, vì chưa gửi thật lần nào) thì tự chọn
    // DISAGREE hộ — không thì ô nhập (đang giữ nháp) không hiện ra vì nút chưa ở trạng thái chọn.
    try { m2.draftPb = JSON.parse(localStorage.getItem(khoaNhapTamPb()) || '{}'); } catch (e) { m2.draftPb = {}; }
    Object.keys(m2.draftPb).forEach((id) => { if (m2.draftPb[id] && !m2.votes[id]) m2.votes[id] = { y: 'phanDoi', lyDo: '' }; });

    loadingAn();
    initVideo();
    renderErrorsPb();
    capNhatNutSubmit();
    refreshIcons();
    if (!m2.dsCham.length) toast('No mistakes on your team yet — the other team may not have submitted.', 'info');
    // (Đợt cuộn tới câu chưa xác nhận) mở màn phản biện: hiện bình thường 1 giây cho em định
    // hình đã, rồi mới tự cuộn tới câu đầu tiên chưa xác nhận (không có thì im lặng, không cuộn).
    setTimeout(cuonToiCauChuaXacNhan, 1000);
  }

  // Vòng tròn avatar (ảnh thật từ kho web; hỏng ảnh → chữ tắt). kind: 'dongY' xanh · 'phanDoi' đỏ
  function avatarVong(ten, kind, errId) {
    const nen = kind === 'phanDoi' ? 'bg-rose-500 ring-rose-300' : 'bg-emerald-500 ring-emerald-300';
    return '<button data-pv="' + escapeHtml(errId) + '__' + escapeHtml(ten) + '"' +
      ' data-av-em="' + escapeHtml(ten) + '" title="' + escapeHtml(ten) + '"' +
      ' class="pv-av relative w-7 h-7 rounded-full ring-2 ' + nen + ' text-white text-[9px] font-extrabold' +
      ' flex items-center justify-center overflow-hidden shrink-0 -ml-1.5 first:ml-0">' +
      '<img src="' + escapeHtml(avatarUrl(ten)) + '" alt="" class="absolute inset-0 w-full h-full object-cover"' +
      ' onerror="this.remove()">' +
      '<span class="pointer-events-none">' + escapeHtml(initialsOf(ten)) + '</span></button>';
  }
  function phieuCuaLoi(errId) { return m2.phanHoi.filter((p) => p.errId === errId); }

  // ═══ (Đợt CHÍNH CHỦ QUYẾT — 02/09/2026, thầy chốt) ═══════════════════════════════════════
  // LUẬT: lỗi ghi tên bạn A mà CHÍNH BẠN A đã bấm AGREE ⇒ coi như CHỐT là lỗi thật. Phiếu
  // DISAGREE của đồng đội lúc đó chỉ còn giá trị THAM KHẢO, KHÔNG làm câu đó thành tranh chấp
  // nữa: không đòi người chấm bấm Keep/Accept, không tính vào REQUIREMENT, bên trang thầy
  // (myLesson `sp-chitiet.html`) cũng không xếp vào "Cần thầy quyết".
  //
  // ⛔ Vì sao chỉ có MỘT dạng bất đồng trong đội: `renderErrorsPb()` chỉ vẽ nút AGREE cho CHÍNH
  // CHỦ (`laCuaMinh`), đồng đội chỉ có nút DISAGREE. Nên không bao giờ có ca ngược lại
  // (chính chủ cãi mà đồng đội nhận hộ) — đừng phí công xử lý ca đó.
  //
  // ⛔ ĐỔI LUẬT Ở ĐÂY LÀ PHẢI ĐỔI CẢ `myLesson/web/sp-chitiet.html` (hàm `chinhChuDaNhan`/
  // `tranhChap` bên đó là bản sao của bộ này). Tab "Kết quả" app mySpeaking CỐ Ý chưa theo —
  // thầy sẽ dựng lại tab đó sau, số của nó lệch là BIẾT TRƯỚC, không phải lỗi.
  function tenBang(a, b) {
    return !!a && !!b && String(a).trim().toUpperCase() === String(b).trim().toUpperCase();
  }
  // Chính chủ (người bị ghi tên trong e.who) đã tự nhận lỗi?
  function chinhChuDaNhan(e) {
    return !!e.who && phieuCuaLoi(e.id).some((p) => p.y === 'dongY' && tenBang(p.voter, e.who));
  }
  // Còn tranh chấp THẬT: có người phản đối VÀ chính chủ chưa tự nhận.
  function tranhChapThat(e) {
    return phieuCuaLoi(e.id).some((p) => p.y === 'phanDoi') && !chinhChuDaNhan(e);
  }
  // Bất đồng TRONG ĐỘI: chính chủ đã nhận nhưng đồng đội vẫn cãi hộ (rất hiếm).
  function batDongTrongDoi(e) {
    return chinhChuDaNhan(e) &&
      phieuCuaLoi(e.id).some((p) => p.y === 'phanDoi' && !tenBang(p.voter, e.who));
  }

  // Hoạt cảnh chữ "bay" từ ô nhập lên đầu danh sách phản biện (cùng khuôn Web Animations API
  // với flyLight() — bong bóng rời rạc, tự xoá sau khi chạy, không đụng DOM thật của danh sách).
  function flyPhanBien(fromEl, toEl, text) {
    const r0 = fromEl.getBoundingClientRect(), r1 = toEl.getBoundingClientRect();
    const ghost = document.createElement('div');
    ghost.textContent = text;
    ghost.style.cssText = 'position:fixed;z-index:9999;pointer-events:none;font:700 11px/1.4 inherit;' +
      'color:#B45309;background:#FEF3C7;border:1px solid #FCD34D;border-radius:10px;padding:6px 10px;' +
      'left:' + r0.left + 'px;top:' + r0.top + 'px;width:' + Math.min(r0.width, 260) + 'px;box-shadow:0 6px 16px rgba(0,0,0,.18)';
    document.body.appendChild(ghost);
    const dx = r1.left - r0.left, dy = r1.top - r0.top;
    const anim = ghost.animate([
      { transform: 'translate(0,0) scale(1)', opacity: 1 },
      { transform: 'translate(' + (dx * .6) + 'px,' + (dy * .6 - 30) + 'px) scale(.95)', opacity: 1, offset: .6 },
      { transform: 'translate(' + dx + 'px,' + dy + 'px) scale(.85)', opacity: 0 }
    ], { duration: 550, easing: 'cubic-bezier(.3,0,.2,1)' });
    anim.onfinish = () => ghost.remove();
  }
  // Bấm icon gửi cạnh ô nhập lý do phản đối: chốt lại m2.votes[errId].lyDo, bay lên danh sách,
  // rồi vẽ lại (danh sách + ô nhập rỗng lại) — thầy chốt: nội dung KHÔNG hiện thường trực trong ô,
  // chỉ hiện trong danh sách phía trên sau khi đã bấm gửi. Sửa lại = bấm bút → gõ lại → gửi lại,
  // dòng cũ trong danh sách tự bị THAY (cùng 1 khoá errId, không đẻ dòng thứ hai).
  function guiPhanBienMotCau(errId) {
    const el = document.querySelector('[data-pblydo="' + errId + '"]');
    if (!el) return;
    const text = el.value.trim();
    if (!text) {
      toast('Please write WHY you disagree — every disagree needs a reason!', 'err');
      el.classList.add('ring-2', 'ring-rose-400'); el.focus();
      return;
    }
    m2.votes[errId] = { y: 'phanDoi', lyDo: text };
    suaNhapTamPb(errId, '');   // đã gửi thật rồi thì xoá nháp cục bộ (nội dung giờ nằm ở m2.votes)
    const dich = document.querySelector('[data-pbrebut="' + errId + '"]') || el.closest('[data-pbrow]');
    if (dich) flyPhanBien(el, dich, text);
    capNhatNutSubmit();
    renderErrorsPb();
  }
  // (Đợt lưu nháp) mỗi câu 1 ô nhớ riêng trong cùng khoá localStorage (map errId->chữ đang gõ
  // dở CHƯA gửi) — khoá theo buổi+em nên đổi máy/tải lại trang không mất, tách bạch hẳn với
  // m2.votes (giá trị ĐÃ gửi thật). Đợt cũ cố tình KHÔNG cho m2 vào autosave() vì nặng — bảng
  // nháp nhỏ này để lưu riêng, không đụng luật đó.
  function khoaNhapTamPb() { return 'myspeaking_draftpb_' + state.buoiId + '_' + state.student; }
  function luuNhapTamPbMap() { try { localStorage.setItem(khoaNhapTamPb(), JSON.stringify(m2.draftPb || {})); } catch (e) {} }
  function suaNhapTamPb(errId, text) {
    if (!m2.draftPb) m2.draftPb = {};
    if (text) m2.draftPb[errId] = text; else delete m2.draftPb[errId];
    luuNhapTamPbMap();
  }
  // (Đợt STT xanh/xám) so phiếu CỤC BỘ của đúng 1 câu với bản đã đồng bộ lần cuối (cùng cách
  // diff `doi` trong submitPbThatSu, chỉ khác là soi TỪNG errId thay vì cả cục JSON) — true = câu
  // này KHÔNG có gì chờ gửi (đã cập nhật hoặc chưa hề đụng tới, cả hai đều coi là "đã update").
  function daDongBoPhieu(errId) {
    const cu = JSON.parse(m2.votesServer || '{}');
    return JSON.stringify(m2.votes[errId] || null) === JSON.stringify(cu[errId] || null);
  }

  // ─── (Đợt B) BẢNG PHẢN BIỆN ───
  function renderErrorsPb() {
    const list = $('errList');
    // (Đợt lọc ALL/MINE) 'mine' → chỉ lỗi CỦA CHÍNH EM (who === tên em)
    // (02/09/2026) 'conflict' → chỉ câu chính chủ đã nhận mà đồng đội vẫn cãi hộ
    const nguon = m2.loc === 'mine' ? m2.dsCham.filter((x) => x.err.who === state.student)
      : m2.loc === 'conflict' ? m2.dsCham.filter((x) => batDongTrongDoi(x.err))
        : m2.dsCham;
    const song = nguon.filter((x) => x.err.trangThai === 'song');
    const go = nguon.filter((x) => x.err.trangThai === 'go');
    const thuTu = song.concat(go);   // câu đã gỡ chìm xuống cuối (thầy chốt)
    list.innerHTML = thuTu.map((x, pos) => {
      const e = x.err;
      const st = TYPE_STYLE[e.type] || { badge: 'bg-slate-100 text-slate-600' };
      const daGo = e.trangThai === 'go';
      const v = m2.votes[e.id] || null;
      const phieuKhac = phieuCuaLoi(e.id).filter((p) => p.voter !== state.student);
      const phieuKhacPhanDoi = phieuKhac.filter((p) => p.y === 'phanDoi');
      const chonY = v && v.y === 'dongY', chonN = v && v.y === 'phanDoi';
      // (Đợt yêu cầu mới) Lỗi CỦA CHÍNH EM (e.who === tên em) BẮT BUỘC phải AGREE/DISAGREE mới
      // nộp được — lỗi của đồng đội vẫn TUỲ Ý (xem chặn ở submitPb()). So chuỗi y hệt cách app
      // đã so `p.voter === state.student` ở startPb() — cùng một mảng tên thành viên, không lệch.
      const laCuaMinh = !!(e.who && state.student && e.who === state.student);
      const canVoteBatBuoc = laCuaMinh && !daGo && !v;
      // (Đợt cuộn tới câu chưa xác nhận) đánh dấu ĐÚNG nghĩa "chưa chốt" theo ALL/MINE đang xem:
      // MINE = chưa vote (canVoteBatBuoc, luôn = lỗi của chính mình vì danh sách đã lọc sẵn) ·
      // ALL = chủ nhân lỗi (e.who, có thể là bạn khác) CHƯA có phiếu nào trên kho.
      const chuaXacNhan = !daGo && e.who &&
        (m2.loc === 'mine' ? canVoteBatBuoc : !m2.phanHoi.some((p) => p.errId === e.id && p.voter === e.who));
      // (Đợt viền dày hơn) "border" 1px cũ + "ring-2" chỉ 2px NGOÀI viền — nhìn mờ, khó nhận ra.
      // Đổi hẳn ĐỘ DÀY viền theo từng trường hợp (không cộng "border" nền + "border-4" chồng lên,
      // 2 lớp cùng đặt border-width dễ ăn nhau lung tung tuỳ thứ tự nạp CSS của Tailwind CDN).
      // (Đợt bỏ nền vàng khi đã vote) viền VÀNG dày áp cho MỌI lỗi của chính em — dù đã
      // AGREE/DISAGREE hay chưa — để luôn nổi bật giữa danh sách; NHƯNG nền vàng đặc chỉ còn
      // dành riêng cho câu CHƯA vote (canVoteBatBuoc — "cần chú ý"), đã vote rồi thì bỏ nền,
      // chỉ còn viền, mới phân biệt được câu đã xong với câu chưa (thầy chốt, đợt polish 4).
      return '<div class="slidein rounded-2xl p-3.5 transition ' +
        (daGo ? 'border border-slate-200 err-go' :
          laCuaMinh ? 'border-4 border-amber-400' + (canVoteBatBuoc ? ' bg-amber-100/70' : '') :
          'border border-slate-200 hover:border-indigo-300') +
        '" data-pbrow="' + escapeHtml(e.id) + '"' + (chuaXacNhan ? ' data-pbunconfirmed="1"' : '') + '>' +
        '<div class="flex items-center gap-2 flex-wrap">' +
        // (Đợt STT xanh đậm nổi bật hơn) xanh lá ĐẬM (nền + chữ trắng) = câu này đã đồng bộ (hoặc
        // chưa hề đụng tới) · xám nhạt = có sửa cục bộ chưa gửi · vừa Submit xong thì đứng icon ✓
        // đúng 1 giây (cùng nền xanh đậm, chỉ khác nội dung) rồi mới về số.
        (function(){
          const vuaGui = m2.vuaGuiPb.indexOf(e.id) >= 0;
          const dongBo = daDongBoPhieu(e.id);
          return '<span class="shrink-0 w-6 h-6 rounded-full font-extrabold text-xs flex items-center justify-center ' +
            (vuaGui || dongBo ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-400') + '">' +
            (vuaGui ? '<i data-lucide="check" class="w-3.5 h-3.5 pointer-events-none"></i>' : (pos + 1)) + '</span>';
        })() +
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
        // (Đợt danh sách phản biện) CHÍNH CHỦ (phiếu của chính em, đã GỬI thật) luôn đứng đầu,
        // tên tô vàng; người khác xếp sau, tên trung tính. Chỉ hiện khi đã có lý do THẬT (không
        // hiện phiếu 'phanDoi' rỗng — nghĩa là mới bấm DISAGREE nhưng chưa gõ/gửi gì).
        (function(){
          const minh = (v && v.y === 'phanDoi' && String(v.lyDo || '').trim())
            ? [{ voter: state.student, lyDo: v.lyDo, minh: true }] : [];
          const ds = minh.concat(phieuKhacPhanDoi.map((p) => ({ voter: p.voter, lyDo: p.lyDo, minh: false })));
          if (!ds.length) return '';
          return '<div class="mt-2 space-y-1" data-pbrebut="' + escapeHtml(e.id) + '">' +
            ds.map((d) => '<div class="flex items-start gap-1.5 text-xs">' +
              '<b class="font-extrabold shrink-0 ' + (d.minh ? 'text-amber-600' : 'text-slate-700') + '">' + escapeHtml(d.voter) + '</b>' +
              '<span class="font-bold text-amber-700 flex-1">: ' + escapeHtml(d.lyDo) + '</span>' +
              (d.minh ? '<button data-pbedit="' + escapeHtml(e.id) + '" title="Edit" class="shrink-0 text-slate-400 hover:text-indigo-600 p-0.5"><i data-lucide="pencil" class="w-3 h-3 pointer-events-none"></i></button>' : '') +
              '</div>').join('') +
            '</div>';
        })() +
        '<div class="mt-2 pt-2 border-t border-slate-100 flex items-center gap-2 flex-wrap">' +
        '<span class="text-[11px] font-bold text-slate-400">Checked by ' + escapeHtml(x.chuLoi) + '</span>' +
        (daGo ? '' :
          '<span class="ml-auto flex items-center gap-1.5">' +
          // (Đợt "chỉ chính chủ AGREE") lỗi KHÔNG phải của mình → không được AGREE, chỉ DISAGREE
          (laCuaMinh ? '<button data-pbvote="dongY" data-err="' + escapeHtml(e.id) + '" class="rounded-xl border-2 px-3 py-1.5 text-xs font-extrabold transition ' +
          (chonY ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-emerald-300 text-emerald-600 hover:bg-emerald-50') + '">✓ AGREE</button>' : '') +
          '<button data-pbvote="phanDoi" data-err="' + escapeHtml(e.id) + '" class="rounded-xl border-2 px-3 py-1.5 text-xs font-extrabold transition ' +
          (chonN ? 'border-rose-500 bg-rose-500 text-white' : 'border-rose-300 text-rose-600 hover:bg-rose-50') + '">✗ DISAGREE</button>' +
          '</span>') +
        '</div>' +
        // (Đợt ô gửi riêng) ô nhập KHÔNG bao giờ tự điền lại nội dung đã gửi (chỉ trống hoặc đang
        // sửa qua nút bút) — gõ xong bấm icon gửi mới đẩy lên danh sách phía trên (xem guiPhanBienMotCau).
        (chonN && !daGo ?
          // (Đợt icon gửi trần) bỏ hẳn khung nút màu — chỉ còn icon, ĐÈ TUYỆT ĐỐI lên góc phải ô
          // nhập (position:absolute + top-1/2 -translate-y-1/2) nên LUÔN đứng giữa theo chiều cao
          // thật của ô bất kể ô cao thêm bao nhiêu do autogrow, cỡ icon không đổi theo. Ô nhập
          // chừa chỗ bên phải (pr-9) để chữ không đè lên icon.
          '<div class="mt-2 relative">' +
          '<textarea data-pblydo="' + escapeHtml(e.id) + '" rows="1" maxlength="300" placeholder="Why do you disagree? (required)"' +
          // (Đợt cỡ chữ tối thiểu) text-xs (12px) như mọi ô nhập khác trong app — luật CSS chung
          // `input, select, textarea{font-size:16px!important}` dưới 1024px đã TỰ ép lên 16px
          // đúng ngưỡng iOS cần để không tự zoom (CLAUDE.md CHẶNG 18), khỏi cần ép cứng ở đây và
          // làm to hơn mức cần trên desktop — cùng cách fSentence/fDetail/fExplain đang dùng.
          // (Đợt sửa lệch icon — NGUYÊN NHÂN THẬT) <textarea> mặc định display:inline-block, nằm
          // trong dòng chữ có line-height kế thừa (24px) nên khung cha .relative bị PHÌNH thêm
          // ~6px "khoảng trống dưới đáy" (đúng họ lỗi <img> lọt hình kinh điển) — icon canh giữa
          // đúng theo khung cha (đã phình) nên NHÌN lệch xuống so với ô nhập thật. Thêm "block"
          // là ép ô nhập ra khỏi dòng chữ, khung cha hết phình, đo lại lệch tâm = 0px chính xác.
          ' class="autogrow block w-full rounded-xl border border-rose-300 pl-3 pr-9 py-2 text-xs leading-snug focus:outline-none focus:ring-2 focus:ring-rose-400">' +
          // (Đợt lưu nháp) chữ đang gõ dở CHƯA gửi nạp lại từ m2.draftPb — KHÔNG phải nội dung
          // đã gửi thật (v.lyDo), hai nguồn tách bạch hẳn nhau.
          escapeHtml((m2.draftPb && m2.draftPb[e.id]) || '') + '</textarea>' +
          // (Đợt sửa lệch icon) THIẾU flex items-center justify-center là thủ phạm: SVG trong
          // <button> mặc định canh theo baseline CHỮ (như <img> giữa dòng text) — luôn để hở một
          // khoảng dưới đáy do "descender", nên NHÌN thấy icon thấp hơn tâm dù bản thân <button>
          // đã đúng giữa qua top-1/2/-translate-y-1/2. Thêm flex ép SVG căn giữa theo HỘP, hết lệch.
          '<button data-pbsend="' + escapeHtml(e.id) + '" title="Send" class="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center justify-center leading-none text-red-500 hover:text-red-600 transition">' +
          '<i data-lucide="send-horizontal" class="w-4 h-4 pointer-events-none"></i></button>' +
          '</div>' : '') +
        '</div>';
    }).join('');
    $('errEmpty').style.display = thuTu.length ? 'none' : '';
    // G/P/I đếm các câu CÒN SỐNG của đội mình
    const counts = {};
    song.forEach((x) => { counts[x.err.type] = (counts[x.err.type] || 0) + 1; });
    $('errStats').innerHTML = Object.keys(TYPE_STYLE).filter((t) => counts[t])
      .map((t) => '<span title="' + typeLabel(t) + '" class="rounded-full px-2 py-1 font-extrabold whitespace-nowrap ' +
        TYPE_STYLE[t].badge + '">' + TYPE_STYLE[t].short + ': ' + counts[t] + '</span>').join('');
    capNhatBadgeThieuPb();
    veNutLocPb();
    // (Đợt lưu nháp) ô nào vừa nạp lại nháp nhiều dòng thì giãn cao luôn, khỏi cụt còn 1 dòng
    document.querySelectorAll('[data-pblydo]').forEach(autoGrow);
    refreshIcons();
  }

  // (Đợt lọc ALL/MINE) nút thay hẳn tiêu đề "Mistakes found" ở màn phản biện — bấm đổi
  // ALL ↔ MINE, chữ trên nút LUÔN là trạng thái ĐANG hiện (không phải trạng thái sẽ đổi tới).
  // (Đợt hiện số câu) "ALL • 120" / "MINE • 65" — số luôn đỏ dù nút đang sáng hay xám, đếm ĐÚNG
  // số dòng sẽ hiện ra khi bấm sang bên đó (m2.dsCham đủ cả — không phải lọc theo trạng thái vote).
  function veNutLocPb() {
    const wrap = $('btnPbLoc');
    if (!wrap) return;
    const btAll = wrap.querySelector('[data-loc="all"]');
    const btMine = wrap.querySelector('[data-loc="mine"]');
    const btCf = wrap.querySelector('[data-loc="conflict"]');
    const sang = 'bg-indigo-600 text-white';
    const mo = 'bg-white text-slate-300';
    const nAll = m2.dsCham.length;
    const nMine = m2.dsCham.filter((x) => x.err.who === state.student).length;
    btAll.className = 'px-3.5 py-1.5 transition ' + (m2.loc === 'all' ? sang : mo);
    btMine.className = 'px-3.5 py-1.5 transition ' + (m2.loc === 'mine' ? sang : mo);
    btAll.innerHTML = 'ALL <span class="text-red-500">• ' + nAll + '</span>';
    btMine.innerHTML = 'MINE <span class="text-red-500">• ' + nMine + '</span>';
    // ⭐ (02/09/2026 — thầy chốt) ô GIỮA chỉ hiện khi thật sự có bất đồng trong đội (rất hiếm).
    // Số 0 thì ẩn hẳn — và nếu đang đứng ở chế độ đó mà bất đồng vừa hết (bạn kia rút phiếu
    // phản đối) thì phải TỰ ĐƯA VỀ 'all', không thì em kẹt trên một danh sách rỗng không lối ra.
    if (btCf) {
      const nCf = m2.dsCham.filter((x) => batDongTrongDoi(x.err)).length;
      btCf.classList.toggle('hidden', !nCf);
      if (!nCf && m2.loc === 'conflict') { m2.loc = 'all'; renderErrorsPb(); return; }
      btCf.className = 'px-3.5 py-1.5 transition border-x-2 border-slate-300 ' +
        (m2.loc === 'conflict' ? 'bg-amber-500 text-white' : 'bg-white text-slate-300') +
        (nCf ? '' : ' hidden');
      btCf.innerHTML = 'TEAM CONFLICT <span class="text-red-500">• ' + nCf + '</span>';
    }
  }

  // Danh sách lỗi CỦA CHÍNH EM (who === tên em) chưa AGREE/DISAGREE — dùng chung cho badge cố định
  // (capNhatBadgeThieuPb) và hộp hỏi lại lúc Submit (submitPb). Câu đã 'go' (đồng đội đã Agree/gỡ)
  // thì bỏ qua, không còn vote được nữa.
  function layThieuBatBuocPb() {
    return m2.dsCham.filter((x) => x.err.trangThai !== 'go' &&
      x.err.who && state.student && x.err.who === state.student && !m2.votes[x.err.id]);
  }
  // (Đợt badge theo ALL/MINE) danh sách lỗi CHƯA CHỐT của CẢ ĐỘI — mỗi lỗi tính theo đúng chủ
  // nhân (e.who), tra trên KHO đã đồng bộ (m2.phanHoi, có phiếu của MỌI thành viên chứ không
  // riêng em) vì em không biết bạn khác đang gõ dở gì trên máy họ — chỉ tính được cái đã GỬI THẬT.
  function layChuaChotCaDoi() {
    return m2.dsCham.filter((x) => x.err.trangThai !== 'go' && x.err.who &&
      !m2.phanHoi.some((p) => p.errId === x.err.id && p.voter === x.err.who));
  }
  function demChuaChotCaDoi() { return layChuaChotCaDoi().length; }
  // (Đợt cuộn tới câu chưa xác nhận) bấm badge UNCONFIRMED, mở màn phản biện, hoặc đổi ALL/MINE
  // đều gọi hàm này — cuộn tới câu ĐẦU TIÊN đang đánh dấu data-pbunconfirmed="1" (render đã tự
  // gắn đúng nghĩa "chưa chốt" theo ĐÚNG chế độ ALL/MINE đang xem, xem renderErrorsPb()).
  function cuonToiCauChuaXacNhan() {
    const el = document.querySelector('[data-pbunconfirmed="1"]');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  // Badge cố định luôn hiện trên đầu khung "Mistakes found" ở màn phản biện — bấm ALL thì đếm
  // CẢ ĐỘI, bấm MINE thì chỉ đếm của chính em (thầy chốt: KHÔNG chặn Submit, chỉ nhắc thường trực).
  function capNhatBadgeThieuPb() {
    const b = $('btnPbThieu');
    if (!b) return;
    const hien = state.moHinh === 2 && state.cheDo === 'phanbien';
    b.classList.toggle('hidden', !hien);
    if (!hien) return;
    // 'mine' đếm phần bắt buộc của chính em; 'all' và 'conflict' đều đếm cả đội (ô TEAM
    // CONFLICT chỉ là một lát cắt để nhìn, không đổi nghĩa "còn ai chưa xác nhận").
    const n = m2.loc === 'mine' ? layThieuBatBuocPb().length : demChuaChotCaDoi();
    b.textContent = n ? ('UNCONFIRMED: ' + n) : 'ALL CONFIRMED ✓';
    b.className = 'mx-2 rounded-full px-3 py-1 text-xs font-extrabold transition ' +
      (n ? 'bg-amber-500 text-white hover:bg-amber-600 cursor-pointer' : 'bg-emerald-100 text-emerald-700');
  }

  // Nộp phiếu phản biện — cửa kiểm tra: lý do phản đối thiếu vẫn CHẶN cứng (dữ liệu không hợp lệ);
  // còn lỗi của CHÍNH EM chưa AGREE/DISAGREE hết thì KHÔNG chặn nữa (thầy chốt, đợt 2) — chỉ hỏi
  // lại qua #pbThieuModal, bấm "Submit anyway" mới gọi submitPbThatSu() gửi thật.
  async function submitPb() {
    const thieuLyDo = Object.keys(m2.votes).filter((id) => m2.votes[id].y === 'phanDoi' && !String(m2.votes[id].lyDo || '').trim());
    if (thieuLyDo.length) {
      toast('Please write WHY you disagree — every disagree needs a reason!', 'err');
      const o = document.querySelector('[data-pblydo="' + thieuLyDo[0] + '"]');
      if (o) { o.focus(); o.classList.add('ring-2', 'ring-rose-400'); }
      return;
    }
    const thieuBatBuoc = layThieuBatBuocPb();
    if (thieuBatBuoc.length) {
      $('pbThieuN').textContent = thieuBatBuoc.length;
      $('pbThieuS').textContent = thieuBatBuoc.length > 1 ? 's' : '';
      $('pbThieuModal').classList.remove('hidden');
      $('pbThieuModal').classList.add('flex');
      refreshIcons();
      return;
    }
    await submitPbThatSu();
  }
  // Phần GỬI THẬT — tách riêng khỏi các cửa kiểm tra ở trên để nút "Submit anyway" của
  // #pbThieuModal gọi thẳng, bỏ qua chốt bắt buộc vote hết.
  async function submitPbThatSu() {
    const cu = JSON.parse(m2.votesServer || '{}');
    const doi = Object.keys(m2.votes).filter((id) => JSON.stringify(m2.votes[id]) !== JSON.stringify(cu[id]));
    if (!doi.length) { toast('Nothing new to submit.', 'info'); return; }
    const laLanDauTien = !(m2.votesServer && m2.votesServer !== '{}');
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
      m2.nhanXanh = laLanDauTien ? 'SUBMITTED' : 'UPDATED';
      // vẽ lại để avatar/phiếu vừa gửi hiện chắc chắn + nút về xanh lá
      m2.phanHoi = m2.phanHoi.filter((p) => p.voter !== state.student);
      Object.keys(m2.votes).forEach((id) => {
        const it = m2.dsCham.find((x) => x.err.id === id);
        m2.phanHoi.push({ errId: id, chuLoi: it ? it.chuLoi : '', voter: state.student, voterTeam: state.myTeam, y: m2.votes[id].y, lyDo: m2.votes[id].lyDo || '' });
      });
      // (Đợt STT xanh/xám) mọi câu VỪA GỬI đứng icon ✓ đúng 1 giây rồi mới về số xanh lá
      m2.vuaGuiPb = doi.slice();
      loadingAn();
      renderErrorsPb();
      capNhatNutSubmit();
      toast('🎉 Feedback submitted — thank you!');
      setTimeout(() => { m2.vuaGuiPb = []; renderErrorsPb(); }, 1000);
    } catch (e) {
      loadingAn();
      toast('Could not save (' + e.message + '). Please try again.', 'err');
    }
  }

  // ─── (Đợt B) NỘP BẢN TỔNG (màn chấm, mô hình 2) — MỘT phát ghi cả bản, pop-up loading ───
  async function submitM2() {
    closeSubmitModal();
    loadingHien('Saving your check…');
    const laLanDauTien = !m2.daNopLanNao;   // (Đợt SUBMIT/UPDATE) chốt SUBMITTED/UPDATED TRƯỚC khi cờ đổi true
    try {
      await tongLoiGhi(state.buoiId, slugHs(state.student), {
        student: state.student, myTeam: state.myTeam, checkedTeam: state.checkedTeam,
        videoUrl: state.videoUrl, videoId: state.videoId,
        classCode: state.classCode, lesson: state.lesson,
        errors: state.errors, timers: cleanTimers(),
        daNop: true, capNhatLuc: Date.now(),
      });
      m2.daNopLanNao = true;
      m2.nhanXanh = laLanDauTien ? 'SUBMITTED' : 'UPDATED';
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
    const laLanDauTien = !m2.daNopLanNao;
    try {
      await tongLoiGhi(state.buoiId, slugHs(state.student), {
        student: state.student, myTeam: state.myTeam, checkedTeam: state.checkedTeam,
        videoUrl: state.videoUrl, videoId: state.videoId,
        classCode: state.classCode, lesson: state.lesson,
        errors: state.errors, timers: cleanTimers(),
        daNop: true, capNhatLuc: Date.now(),
      });
      m2.daNopLanNao = true;
      m2.nhanXanh = laLanDauTien ? 'SUBMITTED' : 'UPDATED';
      m2GhiNhanDongBo();
      renderErrors();
      capNhatNutSubmit();
      toast('Saved ✓', 'info');
    } catch (e) { toast('Could not save (' + e.message + ') — press Submit to retry.', 'err'); }
  }

  // ─── (Đợt B) NÚT REQUIREMENT — đếm câu CÒN VIỆC PHẢI XỬ (thầy chốt) ───
  // (02/09/2026) Đổi tên hiển thị DISAGREEMENT → REQUIREMENT: chữ cũ tả CÁI ĐÃ XẢY RA (bị cãi),
  // chữ mới tả VIỆC EM PHẢI LÀM — đúng bản chất nút này hơn. Bấm Keep/Accept một câu là số tụt
  // một; hết việc thì đổi hẳn sang "NO REQUIREMENT" xanh lá nhạt, cố ý mờ cho khỏi hút mắt.
  // ⭐ Đếm theo `tranhChapThat` — chính chủ đã tự nhận thì KHÔNG còn là việc của người chấm.
  function demTranhChap() {
    return state.errors.filter((e) => e.trangThai === 'song' && !e.ketLuan && tranhChapThat(e)).length;
  }
  function capNhatNutDis() {
    const b = $('btnDisagree');
    if (!b) return;
    // Buổi chưa từng có ai phản đối câu nào thì ẩn hẳn nút (không hiện "NO REQUIREMENT" cho
    // mọi em) — chỉ ai từng bị cãi mới thấy dòng báo đã xử xong.
    const hien = state.moHinh === 2 && state.cheDo === 'cham' &&
      state.errors.some((e) => phieuCuaLoi(e.id).some((p) => p.y === 'phanDoi'));
    b.classList.toggle('hidden', !hien);
    if (!hien) { m2.disOn = false; return; }
    const n = demTranhChap();
    b.textContent = n > 0 ? ('REQUIREMENT: ' + n) : 'NO REQUIREMENT';
    // Hào quang đỏ chỉ đi cùng lúc CÒN VIỆC. Hết việc mà vẫn nhấp nháy đỏ quanh chữ
    // "NO REQUIREMENT" thì đúng là tự mâu thuẫn — bắt được lúc chụp màn hình kiểm thử.
    b.className = 'mx-2 rounded-full px-3 py-1 text-xs font-extrabold transition ' +
      (n > 0 ? 'text-white bg-rose-600 hover:bg-rose-500' : 'bg-emerald-50 text-emerald-300 hover:text-emerald-500') +
      (m2.disOn && n > 0 ? ' dis-halo' : '');
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
      '<span data-av-em="' + escapeHtml(voter) + '" class="w-6 h-6 rounded-full ' + (laPhanDoi ? 'bg-rose-500' : 'bg-emerald-500') + ' text-white text-[9px] font-extrabold flex items-center justify-center overflow-hidden relative">' +
      '<img src="' + escapeHtml(avatarUrl(voter)) + '" alt="" class="absolute inset-0 w-full h-full object-cover" onerror="this.remove()">' +
      '<span>' + escapeHtml(initialsOf(voter)) + '</span></span>' +
      '<b class="text-xs">' + escapeHtml(voter) + '</b>' +
      '<span class="text-[10px] font-extrabold ' + (laPhanDoi ? 'text-rose-600' : 'text-emerald-600') + '">' +
      (laPhanDoi ? 'DISAGREES' : 'AGREES') + '</span>' +
      '<button id="pbPopX" class="ml-auto text-slate-400 hover:text-slate-600 font-bold px-1">✕</button></div>' +
      // ⛔ (02/09/2026 — thầy chốt) HAI NÚT KEEP/AGREE ĐÃ DỜI RA HÀNG CUỐI CỦA CHÍNH Ô LỖI
      // ("Keep Issue" / "Accept Appeal", xem renderErrors). Pop-up này nay CHỈ để đọc lý do —
      // đừng dựng lại nút ở đây, hai chỗ cùng làm một việc là sớm muộn lệch nhau.
      (laPhanDoi ? '<div class="text-xs text-slate-700 whitespace-pre-wrap">' + escapeHtml(p.lyDo || '') + '</div>' : '');
    pop.classList.remove('hidden');
    const r = nut.getBoundingClientRect();
    const w = 290;
    pop.style.left = Math.max(8, Math.min(r.left - w + r.width + 8, window.innerWidth - w - 8)) + 'px';
    pop.style.top = Math.min(r.bottom + 8, window.innerHeight - 180) + 'px';
    $('pbPopX').onclick = dongPopPhanHoi;
  }
  function dongPopPhanHoi() { $('pbPop').classList.add('hidden'); }

  // ⭐ (02/09/2026 — thầy chốt) GHI KẾT LUẬN. Tách hẳn khỏi phần hỏi-chốt vì nay hai nút xử
  // khác nhau: "Keep Issue" bấm là ăn ngay (giữ nguyên hiện trạng, không mất gì), "Accept
  // Appeal" vẫn hỏi lại một nhịp (em đang tự bỏ một lỗi mình bắt được = tự trừ điểm đội mình).
  //
  // ĐỔI Ý: bấm nút kia lúc nào cũng được, kể cả sau khi đã gửi. Đổi từ 'agree' về 'keep' thì
  // phải trả `trangThai` từ 'go' về 'song' — quên chỗ này là câu sống lại mà vẫn gạch ngang mờ.
  // Bấm lại đúng nút đang chọn = không làm gì (tránh nhấp nháy vô nghĩa).
  function datKetLuan(errId, hanhDong) {
    const e = state.errors.find((x) => x.id === errId);
    if (!e || e.ketLuan === hanhDong) return;
    e.ketLuan = hanhDong;
    e.trangThai = hanhDong === 'agree' ? 'go' : 'song';
    renderErrors();
    capNhatNutDis();
    capNhatNutSubmit();
    autosave();
    toast(hanhDong === 'agree'
      ? 'Mistake released — remember to press UPDATE!'
      : 'Kept — your teacher will decide. Remember to press UPDATE!', 'info');
  }

  // Chỉ còn "Accept Appeal" đi qua cửa hỏi-chốt này (thầy chốt 02/09/2026)
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
    const xu = kaDangXu;
    dongKaModal();
    datKetLuan(xu.errId, xu.hanhDong);
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
    datAvatarDauTrang();   // (02/09/2026) ảnh tròn góc trái = avatar CHÍNH EM, không phải ảnh thầy
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
    // ⛔ (02/09/2026) dòng khoá nút "Delete all" đã gỡ cùng lúc với nút đó. Hai nút Keep Issue /
    // Accept Appeal trong ô lỗi bị khoá bằng CSS `#appScreen.review-locked #errList [data-ka]`
    // (index.html), không cần đụng JS ở đây.
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

    document.querySelectorAll('.errType').forEach((b) => b.addEventListener('click', () => { fType = b.dataset.type; renderTypeBtns(); luuNhapTamCham(); }));

    // Ô SENTENCE / MISTAKE / EXPLANATION tự giãn cao khi gõ để xem hết chữ + lưu nháp cục bộ
    ['fSentence', 'fDetail', 'fExplain'].forEach((id) => $(id).addEventListener('input', (e) => { autoGrow(e.target); luuNhapTamCham(); }));

    // Nút chọn HS có lỗi (delegation — wrap tồn tại sẵn, nút dựng lại sau mỗi buildStudentField)
    $('fStudentWrap').addEventListener('click', (ev) => {
      const b = ev.target.closest('.whoBtn');
      if (!b) return;
      fWhoSel = (fWhoSel === b.dataset.who) ? '' : b.dataset.who;  // bấm lại tên đang sáng = bỏ chọn
      renderWhoBtns();
      luuNhapTamCham();
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
      // ⭐ (02/09/2026) Hai nút Keep Issue / Accept Appeal ngay trong ô lỗi (màn NGƯỜI CHẤM).
      // Keep ăn ngay; Accept qua một nhịp hỏi lại. Bấm được cả sau khi đã gửi — đổi ý thoải mái.
      const ka = ev.target.closest('[data-ka]');
      if (ka) {
        if (ka.dataset.ka === 'agree') hoiKetLuan(ka.dataset.err, 'agree');
        else datKetLuan(ka.dataset.err, 'keep');
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
      // (Đợt ô gửi riêng) icon gửi cạnh ô lý do phản đối — chốt lại + bay lên danh sách
      const pbSend = ev.target.closest('[data-pbsend]');
      if (pbSend) { guiPhanBienMotCau(pbSend.dataset.pbsend); return; }
      // (Đợt ô gửi riêng) icon bút trên dòng phản biện CỦA CHÍNH EM — nạp lại vào ô nhập để sửa
      const pbEdit = ev.target.closest('[data-pbedit]');
      if (pbEdit) {
        const id = pbEdit.dataset.pbedit;
        const cur = m2.votes[id];
        const o = document.querySelector('[data-pblydo="' + id + '"]');
        if (o) {
          o.value = cur ? cur.lyDo : ''; autoGrow(o); o.focus();
          suaNhapTamPb(id, o.value);   // (Đợt lưu nháp) set .value bằng JS không tự bắn 'input'
        }
        return;
      }
      const edit = ev.target.closest('[data-edit]');
      if (edit) {
        const i = +edit.dataset.edit;
        const e = state.errors[i];
        $('fMin').value = e.min; $('fSec').value = e.sec;
        setWho(e.who); fType = e.type; renderTypeBtns();
        $('fSentence').value = e.sentence || ''; $('fDetail').value = e.detail; $('fExplain').value = e.explain;
        autoGrowAll();
        editingIndex = i;
        $('btnCancelEdit').classList.remove('hidden');
        capNhatNhanNutThem();   // (02/09/2026) tự chọn chữ "Save changes" / "Delete this mistake"
        $('fSentence').focus();
      }
      // ⛔ (02/09/2026) tay bắt [data-del] đã gỡ cùng nút thùng rác — xoá nay nằm trong
      // addOrUpdateError() (xoá trắng cả 3 ô khi đang sửa). Đừng dựng lại đường xoá thứ hai.
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

    // ⛔ (02/09/2026 — thầy chốt) HAI CỤM TAY BẮT XOÁ CŨ ĐÃ GỠ HẲN cùng với #delOneModal,
    // #delAllModal và nút "Delete all". Xoá một lỗi nay nằm gọn trong `addOrUpdateError()`:
    // đang sửa + xoá trắng cả 3 ô SENTENCE/MISTAKE/EXPLANATION → nút đỏ thành "Delete this
    // mistake". Luật XOÁ MỀM (mô hình 2 đánh dấu `an`, kho giữ vết) chép nguyên sang bên đó.

    // ⭐ (02/09/2026) 3 ô chữ đổi là phải soi lại chữ trên nút đỏ — xoá trắng đủ 3 ô thì nút
    // chuyển sang "Delete this mistake", gõ lại một chữ là quay về "Save changes" ngay.
    ['fSentence', 'fDetail', 'fExplain'].forEach((id) => {
      $(id).addEventListener('input', capNhatNhanNutThem);
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

    // (Đợt phản biện 2) hộp hỏi lại khi Submit mà còn lỗi của chính em chưa AGREE/DISAGREE
    const closePbThieu = () => { $('pbThieuModal').classList.add('hidden'); $('pbThieuModal').classList.remove('flex'); };
    $('btnPbThieuCancel').addEventListener('click', closePbThieu);
    $('btnPbThieuOk').addEventListener('click', () => { closePbThieu(); submitPbThatSu(); });

    // ── (Đợt B) các sự kiện còn lại của mô hình 2 ──
    // (Đợt ô gửi riêng) Ô lý do phản đối (màn phản biện) — CHỈ tự giãn cao + bỏ viền đỏ báo lỗi
    // lúc gõ; KHÔNG còn ghi thẳng vào m2.votes mỗi phím gõ nữa — phải bấm icon gửi mới chốt
    // (guiPhanBienMotCau), nội dung không hiện thường trực trong ô (thầy chốt).
    $('errList').addEventListener('input', (ev) => {
      const o = ev.target.closest('[data-pblydo]');
      if (!o) return;
      o.classList.remove('ring-2', 'ring-rose-400');
      autoGrow(o);
      suaNhapTamPb(o.dataset.pblydo, o.value);   // (Đợt lưu nháp) gõ tới đâu lưu tạm tới đó
    });
    // Enter (không giữ Shift) trong ô lý do = gửi luôn, khỏi phải với chuột sang icon gửi
    $('errList').addEventListener('keydown', (ev) => {
      const o = ev.target.closest('[data-pblydo]');
      if (!o || ev.key !== 'Enter' || ev.shiftKey) return;
      ev.preventDefault();
      guiPhanBienMotCau(o.dataset.pblydo);
    });

    // Nút DISAGREEMENT: bật = sáng + nhấp nháy hào quang + dồn câu tranh chấp lên đầu;
    // bấm LẦN NỮA (tắt) = gửi ngầm các kết luận Keep/Agree lên kho (thầy chốt).
    $('btnDisagree').addEventListener('click', () => {
      m2.disOn = !m2.disOn;
      renderErrors();
      if (!m2.disOn) guiNgamKetLuan();
    });

    // (Đợt lọc ALL/MINE, màn phản biện) nút dài chia ba — bấm ô nào thì chuyển sang ô đó
    $('btnPbLoc').addEventListener('click', (ev) => {
      const nut = ev.target.closest('[data-loc]');
      if (!nut) return;
      m2.loc = nut.dataset.loc;
      renderErrorsPb();
      // (Đợt cuộn tới câu chưa xác nhận) đổi ALL/MINE: hiện bình thường 1 giây rồi mới tự cuộn
      setTimeout(cuonToiCauChuaXacNhan, 1000);
    });
    // (Đợt cuộn tới câu chưa xác nhận) bấm thẳng badge UNCONFIRMED = cuộn NGAY, khỏi chờ 1 giây
    $('btnPbThieu').addEventListener('click', cuonToiCauChuaXacNhan);

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

  /* ══════════════════════════════════════════════════════════════════════════════════════
     ⭐⭐⭐ 03/09/2026 — GỘP LỖI TRÙNG: hai màn KIỂM TRA TRÙNG + XÁC NHẬN TRÙNG
     ══════════════════════════════════════════════════════════════════════════════════════
     VÌ SAO CÓ: 4 em cùng soi một video nên MỘT lỗi hay bị 3-4 em cùng bắt. Đo thật 03/09:
     A2B 464 dòng → 341 · B2A 626 → 421 sau khi gộp phần chắc chắn trùng. Hệ quả cũ: đội bị
     chấm phải Agree/Disagree từng dòng trùng, còn điểm đội chấm phồng theo số người soi kỹ.

     LUẬT THẦY CHỐT (03/09, sau 6 vòng duyệt bản mẫu):
       · Thầy Andrew chỉ GỢI Ý trên TỪNG DÒNG RỜI — không bao giờ tự gom sẵn thành cụm.
       · Đội bị chấm tự gộp, tự bấm GỬI ĐỀ NGHỊ; gửi rồi thì cụm khoá lại (đội kia đang vote).
       · Đội chấm bỏ phiếu ĐỘC LẬP TỪNG CỤM; bên nhiều phiếu hơn thắng, KHÔNG cần đủ đội.
       · HOÀ thì TREO — máy không phá hoà, hai bên tự bàn rồi ai đó đổi phiếu.
       · Số thứ tự lỗi là SỐ ĐỊNH DANH, đặt một lần theo thời gian, không đánh lại khi gộp.
       · Màn chấm bài cá nhân + phản biện cá nhân GIỮ NGUYÊN 100%, không đụng một dòng nào.

     ⛔ HỌC SINH KHÔNG BAO GIỜ THẤY CHỮ "MÁY"/"AI" — mọi nhãn là "THẦY ANDREW GỢI Ý".
     ⛔ Hai kho `cum` + `cumPhieu` phải DÁN LUẬT trước (myLesson-data\tai-lieu\LUAT FIRESTORE
        CAN DAN (03-09 THEM CUM LOI TRUNG).md). Chưa dán thì màn báo lỗi tử tế, không vỡ.
     ══════════════════════════════════════════════════════════════════════════════════════ */

  const tr = {
    ds: [],          // mọi lỗi liên quan, ĐÃ đánh số định danh `stt`, xếp theo thời gian
    cum: [],         // [{_id, doiBiCham, ids[], ten, ai[], daGui, luc}]
    phieu: [],       // [{_id, cumId, voter, voterTeam, y, luc}]
    tich: {},        // {errId:1} — các ô đang tích ở cột trái (chỉ trong máy em)
    goiY: {},        // {errId:true} — thầy Andrew gợi ý là trùng
    doi: '',         // 'TEAM n' — đội đang xét (bị chấm)
    cot: 'trai',     // màn hẹp đang xem cột nào
    xoa: null,       // [cumId, errId] đang chờ xác nhận bỏ khỏi cụm
    nghe: [],        // các hàm huỷ onSnapshot
    videoSan: false,
  };

  const cumGhi = (buoiId, id, d) => fsPatch('/spBuoi/' + encodeURIComponent(buoiId) + '/cum/' + encodeURIComponent(id), d);
  const cumPhieuGhi = (buoiId, id, d) => fsPatch('/spBuoi/' + encodeURIComponent(buoiId) + '/cumPhieu/' + encodeURIComponent(id), d);
  function taoCumId() {
    return 'c' + Date.now().toString(36) + '-' + Math.floor(Math.random() * 1296).toString(36);
  }

  /* Vào màn. Hai chế độ khác nhau ở CHỖ ĐỨNG NHÌN, còn dữ liệu là một:
       kiemtratrung → đội em BỊ chấm ⇒ tr.doi = đội em
       xacnhantrung → em đi chấm     ⇒ tr.doi = đội em chấm */
  async function startTrung() {
    const kt = state.cheDo === 'kiemtratrung';
    tr.doi = kt ? state.myTeam : state.checkedTeam;
    $('loginScreen').classList.add('hidden');
    $('identifyScreen').classList.add('hidden');
    $('appScreen').classList.add('hidden');
    $('trungScreen').classList.remove('hidden');
    $('trTitle').textContent = kt ? 'KIỂM TRA TRÙNG · lỗi của ' + tr.doi
      : 'XÁC NHẬN TRÙNG · ' + tr.doi + ' đề nghị';
    $('trSub').textContent = (state.topic || state.lesson || '') + (kt
      ? ' · gộp những lỗi các đội khác bắt trùng nhau' : ' · ' + state.myTeam + ' bỏ phiếu');
    const soDoi = String(state.myTeam || '').replace(/[^0-9]/g, '');
    $('trWho').textContent = state.student + (soDoi ? ' · T' + soDoi : '');
    $('trMembers').textContent = (state.members || []).join(' · ');
    datAvatarTrung();
    $('ktWrap').classList.toggle('hidden', !kt);
    $('xnWrap').classList.toggle('hidden', kt);
    $('trTab').classList.toggle('hidden', !kt);
    $('btnTrGui').classList.toggle('hidden', !kt);
    if (kt) $('btnTrGui').classList.add('flex');
    $('trSong').innerHTML = new Array(14).fill('<i></i>').join('');
    trVideo();
    batAvatarKho();
    refreshIcons();

    loadingHien(kt ? 'Loading the mistakes on your team…' : 'Loading the groups to vote on…');
    try {
      await trNapLoi();
      await trNoiKho();
    } catch (e) {
      loadingAn();
      trBaoLoi(e);
      return;
    }
    loadingAn();
    trVe();
    /* Gợi ý chạy SAU khi đã vẽ xong (thầy chốt nếp "đẩy sẵn + đổ sau"): em thấy danh sách
       ngay, nhãn gợi ý nhảy vào sau vài giây. Chỉ màn KIỂM TRA TRÙNG mới cần gợi ý. */
    if (kt) trChayGoiY();
  }

  function trBaoLoi(e) {
    const chu = String((e && e.message) || e || '');
    const khoaChua = /_40[13]/.test(chu);   // 401/403 = luật chưa dán
    $('xnWrap').classList.remove('hidden');
    $('ktWrap').classList.add('hidden');
    $('xnWrap').innerHTML = '<div class="bg-white rounded-3xl border border-slate-200 p-6 text-center">' +
      '<div class="font-extrabold text-slate-900 mb-1">' +
      (khoaChua ? 'Phần này chưa mở' : 'Chưa đọc được dữ liệu') + '</div>' +
      '<div class="text-sm text-slate-600">' + (khoaChua
        ? 'Em báo thầy Andrew mở khoá phần gộp lỗi trùng giúp nhé.'
        : 'Em thử tải lại trang; nếu vẫn vậy thì báo thầy Andrew (' + escapeHtml(chu) + ').') +
      '</div></div>';
  }

  /* ── Đọc lỗi ────────────────────────────────────────────────────────────────────────
     Mọi bản chấm SOI VÀO đội `tr.doi` (`tongLoi.checkedTeam == tr.doi`) — cùng câu hỏi
     mà màn phản biện đang dùng, nên kho đã có sẵn chỉ mục, không phải tạo thêm.
     Câu 'an' (em chấm tự xoá) bỏ hẳn; câu 'go' (đã được Accept) GIỮ nhưng không cho gộp
     — nó không còn tính điểm nữa, gộp vào chỉ làm rối. */
  async function trNapLoi() {
    const docs = await fsQuery(state.buoiId, 'tongLoi', 'checkedTeam', tr.doi, 200);
    const ds = [];
    docs.forEach((d) => {
      (d.errors || []).map(chuanLoi).forEach((er) => {
        if (er.trangThai === 'an' || er.trangThai === 'go') return;
        ds.push({
          id: er.id, cham: String(d.student || d._id || ''), who: er.who, type: er.type,
          t: tSec(er), cau: er.sentence, loi: er.detail, gt: er.explain,
        });
      });
    });
    ds.sort((a, b) => a.t - b.t || String(a.id).localeCompare(String(b.id)));
    ds.forEach((x, i) => { x.stt = i + 1; });   // SỐ ĐỊNH DANH — xem luật ở đầu khối
    tr.ds = ds;
  }

  /* ── Nghe kho, đổi là thấy ngay ─────────────────────────────────────────────────────
     Cả đội làm cùng lúc: A kéo câu sang cụm thì B phải thấy câu đó biến khỏi danh sách
     NGAY, không phải tải lại trang (thầy chốt). Dùng onSnapshot của SDK; ghi thì vẫn đi
     REST `fsPatch` như mọi chỗ khác — ghi xong onSnapshot tự bắn về, một chiều dữ liệu.
     ⛔ HAI phép nghe này CHỈ chạy trong hai màn này, tuyệt đối không đưa vào đường mở
        trang (LUẬT 8: Firestore tính tiền theo SỐ TÀI LIỆU, cả cụm 3 app xài chung hạn mức). */
  async function trNoiKho() {
    const SDK = 'https://www.gstatic.com/firebasejs/12.9.0';
    const appMod = await import(SDK + '/firebase-app.js');
    const fsMod = await import(SDK + '/firebase-firestore.js');
    let app;
    try { app = appMod.getApp(); } catch (e) {
      app = appMod.initializeApp({
        apiKey: (CFG.FIREBASE || {}).apiKey, projectId: (CFG.FIREBASE || {}).projectId,
        authDomain: ((CFG.FIREBASE || {}).projectId || '') + '.firebaseapp.com',
      });
    }
    const db = fsMod.getFirestore(app);
    const goc = fsMod.collection(db, 'spBuoi', state.buoiId, 'cum');
    const q = fsMod.query(goc, fsMod.where('doiBiCham', '==', tr.doi));
    await new Promise((ok, hong) => {
      let lanDau = true;
      tr.nghe.push(fsMod.onSnapshot(q, (snap) => {
        tr.cum = [];
        snap.forEach((d) => { const o = d.data() || {}; o._id = d.id; tr.cum.push(o); });
        /* Cụm giải tán = `ids` rỗng (luật kho cấm xoá tài liệu) — lọc ở đây một lần cho
           mọi chỗ vẽ khỏi phải nhớ. */
        tr.cum = tr.cum.filter((c) => (c.ids || []).length > 1)
          .sort((a, b) => (a.luc || 0) - (b.luc || 0));
        if (lanDau) { lanDau = false; ok(); } else trVe();
      }, (e) => { if (lanDau) { lanDau = false; hong(e); } }));
    });
    const qp = fsMod.query(fsMod.collection(db, 'spBuoi', state.buoiId, 'cumPhieu'));
    tr.nghe.push(fsMod.onSnapshot(qp, (snap) => {
      tr.phieu = [];
      snap.forEach((d) => { const o = d.data() || {}; o._id = d.id; tr.phieu.push(o); });
      trVe();
    }, () => { /* phiếu đọc hỏng thì coi như chưa ai bỏ — không chặn cả màn */ }));
  }

  /* ── Gợi ý của thầy Andrew ──────────────────────────────────────────────────────────
     Chỉ chạy trên những lỗi CHƯA vào cụm nào (gộp rồi thì gợi ý là thừa). */
  async function trChayGoiY() {
    if (!window.SPTrung) return;
    const daVao = {};
    tr.cum.forEach((c) => (c.ids || []).forEach((i) => { daVao[i] = 1; }));
    const conLai = tr.ds.filter((x) => !daVao[x.id]);
    if (conLai.length < 2) return;
    $('ktLoad').classList.remove('hidden'); $('ktLoad').classList.add('flex');
    try {
      const kq = await window.SPTrung.goiY(conLai, {});
      tr.goiY = kq.danhDau || {};
    } catch (e) { tr.goiY = {}; }
    $('ktLoad').classList.add('hidden'); $('ktLoad').classList.remove('flex');
    trVe();
  }

  /* ── Vẽ ─────────────────────────────────────────────────────────────────────────── */
  function trLoi(id) { return tr.ds.filter((x) => x.id === id)[0]; }
  function trCumCua(id) { return tr.cum.filter((c) => (c.ids || []).indexOf(id) >= 0)[0] || null; }
  function trAv(ten) {
    return '<span class="tr-av ' + trMauAv(ten) + '" data-av-em="' + escapeHtml(ten) + '" title="' + escapeHtml(ten) + '">' +
      '<img src="' + escapeHtml(avatarUrl(ten)) + '" alt="" onerror="this.remove()">' +
      '<span class="pointer-events-none">' + escapeHtml(initialsOf(ten)) + '</span></span>';
  }
  const TR_MAU = ['bg-emerald-500', 'bg-blue-500', 'bg-orange-500', 'bg-rose-500'];
  function trMauAv(ten) {
    let h = 0; const s = String(ten || '');
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return TR_MAU[h % TR_MAU.length];
  }
  /* Ba mục một dòng, phân biệt bằng MÀU. `gon` = bỏ phần giải thích (pop-up chọn cụm). */
  function trChi(x, gon) {
    return '<div class="tr-chi">' +
      (x.cau ? '<i>“' + escapeHtml(x.cau) + '”</i>' : '') +
      '<b>' + escapeHtml(x.loi) + '</b>' +
      (!gon && x.gt ? '<u>' + escapeHtml(x.gt) + '</u>' : '') + '</div>';
  }
  function trNhanLoai(t) {
    const st = TYPE_STYLE[t] || { badge: 'bg-slate-100 text-slate-600' };
    return '<span class="text-[10.5px] font-bold rounded-full px-2 py-0.5 ' + st.badge + '">' + typeLabel(t) + '</span>';
  }
  const TR_IC_UP = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4"><circle cx="12" cy="12" r="9.3"/><path d="M12 16.5V8"/><path d="M8.4 11.4L12 7.8l3.6 3.6"/></svg>';
  const TR_IC_TICK = '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';

  function trVe() {
    if (state.cheDo === 'kiemtratrung') { trVeKt(); } else { trVeXn(); }
    refreshIcons();
    /* Ảnh đại diện mới nhất từ kho `lessonAvatar` — `batAvatarKho` dựng MutationObserver
       nên mọi ô `[data-av-em]` vẽ thêm sau đều tự được đè, không phải gọi lại mỗi lần vẽ. */
  }

  function trVeKt() {
    const daVao = {};
    tr.cum.forEach((c) => (c.ids || []).forEach((i) => { daVao[i] = 1; }));
    const conLai = tr.ds.filter((x) => !daVao[x.id]);
    /* ⭐ Lỗi ĐÃ VÀO CỤM thì BIẾN MẤT khỏi danh sách (thầy chốt): mỗi lỗi chỉ nằm MỘT nơi,
       không thì nhìn tưởng hai lỗi khác nhau. */
    $('ktDs').innerHTML = conLai.map((x) => {
      const goiy = tr.goiY[x.id], tich = !!tr.tich[x.id];
      return '<div class="tr-o ' + (goiy ? 'goiy' : 'mo') + (tich ? ' tich' : '') + '" data-trloi="' + escapeHtml(x.id) + '">' +
        '<div class="flex items-center gap-2 flex-wrap">' +
          '<span class="tr-tick">' + TR_IC_TICK + '</span>' +
          '<span class="tr-stt">' + x.stt + '</span>' +
          '<button data-trseek="' + x.t + '" class="font-mono text-xs font-bold bg-slate-900 hover:bg-indigo-700 transition text-white rounded-md px-1.5 py-0.5">' + fmtClock(x.t) + '</button>' +
          trNhanLoai(x.type) +
          (goiy ? '<span class="text-[10px] font-extrabold text-blue-700 bg-blue-100 rounded-full px-2 py-0.5">THẦY ANDREW GỢI Ý</span>' : '') +
          '<span class="ml-auto text-[10.5px] font-bold text-slate-400">' + escapeHtml(x.cham) + '</span>' +
        '</div>' + trChi(x) + '</div>';
    }).join('') || '<div class="text-sm text-slate-400 px-2 py-6 text-center">Mọi lỗi đều đã được xếp vào cụm.</div>';

    $('ktCum').innerHTML = tr.cum.map((c) => trKhungCum(c, false)).join('') ||
      '<div class="text-sm text-slate-400 px-2">Chưa có cụm nào. Tích 2 lỗi trở lên ở cột bên rồi bấm NEW GROUP.</div>';
    $('ktPhaiNhan').textContent = 'Cụm đã gộp' + (state.chamBoi ? ' · ' + state.chamBoi + ' sẽ bỏ phiếu' : '');

    const nTich = Object.keys(tr.tich).length;
    $('ktViec').classList.toggle('hidden', nTich === 0);
    $('ktViec').classList.toggle('flex', nTich > 0);
    $('ktTao').style.display = nTich >= 2 ? '' : 'none';
    $('ktThem').style.display = tr.cum.some((c) => !c.daGui) ? '' : 'none';
    $('ktSoTich').textContent = nTich;
    const chuaGui = tr.cum.filter((c) => !c.daGui).length;
    $('btnTrGui').classList.toggle('opacity-40', chuaGui === 0);
    $('trDai').innerHTML =
      '<span class="text-[11px] font-extrabold tracking-wider text-slate-500 uppercase">' + escapeHtml(tr.doi) + ' bị bắt</span>' +
      '<span class="bg-slate-900 text-white text-xs font-extrabold rounded-full px-2.5 py-1">' + tr.ds.length + ' dòng</span>' +
      '<span class="bg-blue-600 text-white text-xs font-extrabold rounded-full px-2.5 py-1">' + tr.cum.length + ' cụm gộp</span>' +
      '<span class="text-slate-400 text-xs font-bold">' + conLai.length + ' lỗi chưa gộp</span>';
  }

  /* Một khung cụm. `voteMode` = màn XÁC NHẬN TRÙNG (có hai nút phiếu, không có nút bỏ dòng). */
  function trKhungCum(c, voteMode) {
    const ids = (c.ids || []).slice().sort((a, b) => {
      const A = trLoi(a), B = trLoi(b);
      return ((A && A.stt) || 0) - ((B && B.stt) || 0);
    });
    let vo = c.daGui ? 'daGui' : '', dau = '';
    if (voteMode) {
      const ok = trPhieuCua(c._id, 'gop'), no = trPhieuCua(c._id, 'khong');
      vo = ok.length > no.length ? 'chot' : no.length > ok.length ? 'khong' : (ok.length ? 'hoa' : '');
      dau = vo === 'chot' ? 'SỐ ĐÔNG GỘP' : vo === 'khong' ? 'SỐ ĐÔNG KHÔNG GỘP'
        : vo === 'hoa' ? 'HOÀ PHIẾU · ĐANG TREO' : escapeHtml(tr.doi) + ' xin gộp · ' + ids.length + ' dòng';
    } else {
      dau = '<span class="tr-up' + (c.daGui ? ' xanh' : '') + '" title="' +
        (c.daGui ? 'Đã gửi đề nghị sang đội chấm' : 'Chưa gửi') + '">' + TR_IC_UP + '</span>' +
        ids.length + ' dòng = 1 lỗi';
    }
    return '<div class="tr-cum ' + vo + '">' +
      '<div class="tr-cum-dau"><span class="trai">' + dau + '</span>' +
        '<span class="giua">' + (c.ai || []).map(trAv).join('') + '</span>' +
        '<span class="phai">' + escapeHtml(c.ten || '') + '</span></div>' +
      ids.map((id) => {
        const x = trLoi(id);
        if (!x) return '';
        return '<div class="tr-cum-o">' +
          '<span class="tr-stt mt-0.5">' + x.stt + '</span>' +
          '<button data-trseek="' + x.t + '" class="font-mono text-[11px] font-bold bg-slate-900 hover:bg-indigo-700 transition text-white rounded-md px-1.5 py-0.5 mt-0.5 flex-none">' + fmtClock(x.t) + '</button>' +
          '<div class="min-w-0"><div class="text-[10.5px] text-slate-500 leading-none">' + trNhanLoai(x.type) +
            ' <span class="font-bold">' + escapeHtml(x.cham) + '</span> chấm' +
            (x.cham === state.student ? ' <span class="text-amber-600 font-extrabold">· của em</span>' : '') + '</div>' +
            trChi(x) + '</div>' +
          (voteMode || c.daGui ? '' : '<button class="bo" data-trbo="' + escapeHtml(c._id) + '|' + escapeHtml(id) + '" title="Bỏ khỏi cụm">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" class="w-3 h-3"><path d="M6 6l12 12M18 6L6 18"/></svg></button>') +
        '</div>';
      }).join('') +
      (voteMode ? trHaiNutPhieu(c) : '') +
    '</div>';
  }

  function trPhieuCua(cumId, y) {
    return tr.phieu.filter((p) => p.cumId === cumId && p.y === y).map((p) => p.voter);
  }
  function trPhieuToi(cumId) {
    const p = tr.phieu.filter((x) => x.cumId === cumId && x.voter === state.student)[0];
    return (p && p.y) || '';
  }
  /* Hai nút phiếu: SỐ TO trong nút + avatar người đã bỏ ở dưới.
     ⛔ Không kèm dòng hướng dẫn nào (thầy chốt: các em tự bấm, tự thấy số đổi, tự hiểu). */
  function trHaiNutPhieu(c) {
    const ok = trPhieuCua(c._id, 'gop'), no = trPhieuCua(c._id, 'khong'), toi = trPhieuToi(c._id);
    return '<div class="tr-phieu">' +
      '<button class="ok' + (toi === 'gop' ? ' minh' : '') + '" data-trvote="gop" data-trcum="' + escapeHtml(c._id) + '">' +
        '<span class="so">' + ok.length + '</span>ĐỒNG Ý GỘP<span class="avs">' + ok.map(trAv).join('') + '</span></button>' +
      '<button class="no' + (toi === 'khong' ? ' minh' : '') + '" data-trvote="khong" data-trcum="' + escapeHtml(c._id) + '">' +
        '<span class="so">' + no.length + '</span>KHÔNG GỘP<span class="avs">' + no.map(trAv).join('') + '</span></button>' +
    '</div>';
  }

  function trVeXn() {
    /* Đội chấm CHỈ thấy cụm đã GỬI — cụm đang soạn là việc riêng của đội kia. */
    const ds = tr.cum.filter((c) => c.daGui);
    $('xnWrap').innerHTML = ds.map((c) => trKhungCum(c, true)).join('') ||
      '<div class="bg-white rounded-3xl border border-slate-200 p-6 text-center text-sm text-slate-500">' +
      escapeHtml(tr.doi) + ' chưa gửi cụm nào để em xét.</div>';
    const daBo = ds.filter((c) => trPhieuToi(c._id)).length;
    $('trDai').innerHTML =
      '<span class="bg-slate-900 text-white text-xs font-extrabold rounded-full px-2.5 py-1">' + ds.length + ' cụm ' + escapeHtml(tr.doi) + ' gửi</span>' +
      '<span class="bg-emerald-100 text-emerald-700 text-xs font-extrabold rounded-full px-2.5 py-1">' + daBo + '/' + ds.length + ' cụm em đã bỏ phiếu</span>';
  }

  /* ── Thao tác ───────────────────────────────────────────────────────────────────── */
  function trGhiCum(c) {
    /* ⛔ LUẬT 9️⃣ — ghi ĐỦ MỌI TRƯỜNG. `fsPatch` không có updateMask nên nó ghi đè cả tài
       liệu; thiếu một trường là trường đó bay mất, mà chẳng có gì báo. */
    return cumGhi(state.buoiId, c._id, {
      doiBiCham: tr.doi, ids: c.ids || [], ten: c.ten || '',
      ai: c.ai || [], daGui: !!c.daGui, luc: c.luc || Date.now(),
    });
  }
  function trThemToi(c) {
    c.ai = c.ai || [];
    if (c.ai.indexOf(state.student) < 0) c.ai.push(state.student);
  }
  /* Tên cụm = chỗ sai ngắn nhất trong cụm — đủ để nhận ra cụm nào là cụm nào. */
  function trDatTen(ids) {
    const chu = ids.map((i) => (trLoi(i) || {}).loi || '').filter(Boolean)
      .sort((a, b) => a.length - b.length)[0] || '';
    return chu.length > 60 ? chu.slice(0, 57) + '…' : chu;
  }

  /* ⛔⛔ LUẬT NGHIỆP VỤ 21/07/2026 — MỘT CỤM KHÔNG ĐƯỢC CHỨA HAI DÒNG CỦA CÙNG MỘT NGƯỜI
     CHẤM. Một em không ghi lại cùng một lỗi hai lần; em ấy ghi hai dòng giống nhau ở hai
     mốc giờ nghĩa là NGƯỜI NÓI SAI HAI LẦN, phải đếm 2. Bản gốc của luật nằm ở app máy
     tính (`tools/danhgia.py cung_mot_loi_duoc`), nơi nó từng nuốt mất 13 dòng thật.
     ⇒ Chặn NGAY LÚC GỘP, và nói rõ vì sao — chứ không im lặng bỏ qua. */
  function trTrungNguoiCham(ids) {
    const gap = {};
    for (let i = 0; i < ids.length; i++) {
      const x = trLoi(ids[i]);
      if (!x) continue;
      if (gap[x.cham]) return x.cham;
      gap[x.cham] = 1;
    }
    return '';
  }

  async function trTaoCum() {
    const ids = Object.keys(tr.tich);
    if (ids.length < 2) return;
    const trung = trTrungNguoiCham(ids);
    if (trung) {
      toast('Hai dòng này đều do ' + trung + ' ghi ⇒ là HAI lần nói sai, không gộp được.', 'err');
      return;
    }
    const c = { _id: taoCumId(), ids, ten: trDatTen(ids), ai: [state.student], daGui: false, luc: Date.now() };
    tr.tich = {};
    try { await trGhiCum(c); } catch (e) { toast(trChuLoi(e), 'err'); return; }
    toast('Đã gộp ' + ids.length + ' lỗi thành 1 cụm ✓', 'ok');
  }

  async function trThemVaoCum(cumId) {
    const c = tr.cum.filter((x) => x._id === cumId)[0];
    if (!c || c.daGui) return;
    const ids = Object.keys(tr.tich);
    /* Luật 21/07 xét trên CẢ NHÓM SAU KHI GỘP, không chỉ trên mấy dòng vừa tích —
       union-find bên app máy tính từng gộp bắc cầu MAI ↔ DUNG ↔ MAI và mất một lỗi. */
    const trung = trTrungNguoiCham((c.ids || []).concat(ids));
    if (trung) {
      toast('Cụm này đã có dòng của ' + trung + ' rồi ⇒ là HAI lần nói sai, không gộp chung được.', 'err');
      return;
    }
    ids.forEach((i) => { if ((c.ids || []).indexOf(i) < 0) c.ids.push(i); });
    trThemToi(c);
    c.ten = c.ten || trDatTen(c.ids);
    tr.tich = {};
    $('trPopCum').classList.add('hidden'); $('trPopCum').classList.remove('flex');
    try { await trGhiCum(c); } catch (e) { toast(trChuLoi(e), 'err'); }
  }

  async function trBoKhoiCum(cumId, errId) {
    const c = tr.cum.filter((x) => x._id === cumId)[0];
    if (!c || c.daGui) return;
    c.ids = (c.ids || []).filter((i) => i !== errId);
    trThemToi(c);
    /* Còn dưới 2 dòng thì cụm tự giải tán — ghi `ids` RỖNG chứ KHÔNG xoá tài liệu
       (luật kho cấm xoá; cùng nếp `lessonNghi` bên myLesson). */
    if (c.ids.length < 2) c.ids = [];
    try { await trGhiCum(c); } catch (e) { toast(trChuLoi(e), 'err'); }
  }

  async function trGuiDeNghi() {
    const ds = tr.cum.filter((c) => !c.daGui);
    if (!ds.length) { toast('Không có cụm nào đang chờ gửi.', 'info'); return; }
    loadingHien('Sending…');
    try {
      for (let i = 0; i < ds.length; i++) { ds[i].daGui = true; trThemToi(ds[i]); await trGhiCum(ds[i]); }
      toast('Đã gửi ' + ds.length + ' cụm cho đội chấm ✓', 'ok');
    } catch (e) { toast(trChuLoi(e), 'err'); }
    loadingAn();
  }

  async function trBoPhieu(cumId, y) {
    const cu = trPhieuToi(cumId);
    const moi = cu === y ? '' : y;      // bấm lại đúng nút đang chọn = rút phiếu
    try {
      await cumPhieuGhi(state.buoiId, cumId + '__' + slugHs(state.student), {
        cumId, voter: state.student, voterTeam: state.myTeam, y: moi, luc: Date.now(),
      });
    } catch (e) { toast(trChuLoi(e), 'err'); }
  }

  function trChuLoi(e) {
    const s = String((e && e.message) || e || '');
    return /40[13]/.test(s) ? 'Phần này chưa được mở khoá — em báo thầy Andrew nhé.'
      : 'Chưa gửi được, em thử lại (' + s + ')';
  }

  /* Pop-up chọn cụm — chỉ liệt kê cụm CHƯA GỬI (cụm đã gửi thì đội chấm đang bỏ phiếu
     trên đúng nội dung đó, thêm dòng vào là họ vote hụt). */
  function trMoPopCum() {
    const ds = tr.cum.filter((c) => !c.daGui);
    $('tpcSo').textContent = Object.keys(tr.tich).length;
    $('tpcDs').innerHTML = ds.length ? ds.map((c) => {
      const ids = (c.ids || []).slice().sort((a, b) => ((trLoi(a) || {}).stt || 0) - ((trLoi(b) || {}).stt || 0));
      return '<div class="tpc-o"><div class="tpc-dau"><span>' + ids.length + ' dòng</span>' +
        '<button class="tpc-them" data-trthem="' + escapeHtml(c._id) + '">THÊM VÀO ĐÂY</button>' +
        '<span class="ten">' + escapeHtml(c.ten || '') + '</span></div>' +
        ids.map((id) => {
          const x = trLoi(id);
          if (!x) return '';
          return '<div class="tpc-dong"><span class="tr-stt">' + x.stt + '</span>' +
            '<span class="font-mono text-[11px] font-bold bg-slate-900 text-white rounded-md px-1.5 py-0.5 mt-0.5 flex-none">' + fmtClock(x.t) + '</span>' +
            '<div class="min-w-0">' + trChi(x, true) + '</div></div>';
        }).join('') + '</div>';
    }).join('') : '<div class="text-sm text-slate-400 text-center py-6">Chưa có cụm nào đang soạn. Tích 2 lỗi rồi bấm NEW GROUP.</div>';
    $('trPopCum').classList.remove('hidden'); $('trPopCum').classList.add('flex');
  }

  /* ── Thanh tiếng (KHÔNG có hình) ─────────────────────────────────────────────────
     Vẫn là chính video YouTube của buổi, chỉ giấu khung hình 1px. Link không phải
     YouTube (buổi cũ dùng Drive) thì ẩn luôn thanh này — không có gì để nghe. */
  function trVideo() {
    const p = parseVideoUrl(state.videoUrl);
    if (!p || p.type !== 'youtube') { $('trPlay').closest('div').classList.add('hidden'); return; }
    $('trungVideo').innerHTML = '<div id="trYt"></div>';
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(tag);
    const dung = () => {
      tr.yt = new YT.Player('trYt', {
        videoId: p.id, playerVars: { rel: 0, playsinline: 1 },
        events: { onReady: () => { tr.videoSan = true; trNhipVideo(); } },
      });
    };
    if (window.YT && window.YT.Player) dung(); else window.onYouTubeIframeAPIReady = dung;
  }
  function trNhipVideo() {
    setInterval(() => {
      if (!tr.videoSan || !tr.yt) return;
      try {
        const cur = tr.yt.getCurrentTime() || 0, dur = tr.yt.getDuration() || 0;
        const phat = tr.yt.getPlayerState() === 1;
        $('trungScreen').classList.toggle('dang-phat', phat);
        $('trPlay').innerHTML = '<i data-lucide="' + (phat ? 'pause' : 'play') + '" class="w-4 h-4 pointer-events-none"></i>';
        if (!tr.keo && dur) $('trSeek').value = Math.round((cur / dur) * 1000);
        $('trCur').textContent = fmtClock(cur);
        $('trDur').textContent = fmtClock(dur);
      } catch (e) {}
    }, 400);
  }
  function trToiGiay(s) {
    if (!tr.videoSan || !tr.yt) return;
    try { tr.yt.seekTo(Math.max(0, s - 1), true); tr.yt.playVideo(); } catch (e) {}
  }

  function datAvatarTrung() {
    $('trAvatarChu').textContent = initialsOf(state.student);
    const img = $('trAvatar');
    img.src = avatarUrl(state.student);
    img.dataset.avEm = state.student;
    img.onerror = () => { img.remove(); };
  }

  /* ── Bắt tay bấm ───────────────────────────────────────────────────────────────── */
  function noiTayTrung() {
    $('ktDs').addEventListener('click', (ev) => {
      const nutGio = ev.target.closest('[data-trseek]');
      if (nutGio) { ev.stopPropagation(); trToiGiay(+nutGio.dataset.trseek); return; }
      const o = ev.target.closest('[data-trloi]');
      if (!o) return;
      const id = o.dataset.trloi;
      if (tr.tich[id]) delete tr.tich[id]; else tr.tich[id] = 1;
      trVeKt();
    });
    $('ktCum').addEventListener('click', (ev) => {
      const nutGio = ev.target.closest('[data-trseek]');
      if (nutGio) { trToiGiay(+nutGio.dataset.trseek); return; }
      const bo = ev.target.closest('[data-trbo]');
      if (!bo) return;
      tr.xoa = bo.dataset.trbo.split('|');
      $('trPopXoa').classList.remove('hidden'); $('trPopXoa').classList.add('flex');
    });
    $('xnWrap').addEventListener('click', (ev) => {
      const nutGio = ev.target.closest('[data-trseek]');
      if (nutGio) { trToiGiay(+nutGio.dataset.trseek); return; }
      const v = ev.target.closest('[data-trvote]');
      if (v) trBoPhieu(v.dataset.trcum, v.dataset.trvote);
    });
    $('ktTao').addEventListener('click', trTaoCum);
    $('ktThem').addEventListener('click', trMoPopCum);
    $('btnTrGui').addEventListener('click', trGuiDeNghi);
    $('tpcDong').addEventListener('click', () => {
      $('trPopCum').classList.add('hidden'); $('trPopCum').classList.remove('flex');
    });
    $('trPopCum').addEventListener('click', (ev) => {
      if (ev.target === $('trPopCum')) {
        $('trPopCum').classList.add('hidden'); $('trPopCum').classList.remove('flex'); return;
      }
      const b = ev.target.closest('[data-trthem]');
      if (b) trThemVaoCum(b.dataset.trthem);
    });
    $('tpxKhong').addEventListener('click', () => {
      $('trPopXoa').classList.add('hidden'); $('trPopXoa').classList.remove('flex');
    });
    $('tpxCo').addEventListener('click', () => {
      $('trPopXoa').classList.add('hidden'); $('trPopXoa').classList.remove('flex');
      if (tr.xoa) trBoKhoiCum(tr.xoa[0], tr.xoa[1]);
      tr.xoa = null;
    });
    $('trPlay').addEventListener('click', () => {
      if (!tr.videoSan || !tr.yt) return;
      try { if (tr.yt.getPlayerState() === 1) tr.yt.pauseVideo(); else tr.yt.playVideo(); } catch (e) {}
    });
    $('trSeek').addEventListener('input', () => { tr.keo = true; });
    $('trSeek').addEventListener('change', () => {
      tr.keo = false;
      if (!tr.videoSan || !tr.yt) return;
      try { tr.yt.seekTo((+$('trSeek').value / 1000) * (tr.yt.getDuration() || 0), true); } catch (e) {}
    });
    $('trTab').addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-trcot]');
      if (!b) return;
      const trai = b.dataset.trcot === 'trai';
      $('ktTrai').classList.toggle('hidden', !trai);
      $('ktPhai').classList.toggle('hidden', trai);
      Array.prototype.forEach.call($('trTab').children, (x) => {
        const on = x === b;
        x.className = 'px-3 py-1.5 ' + (on ? 'bg-slate-900 text-white' : 'bg-white text-slate-500');
      });
    });
  }
  noiTayTrung();
})();
