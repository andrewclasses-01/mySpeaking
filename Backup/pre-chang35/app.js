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
  };
  let editingIndex = -1;
  let fType = '';
  let pendingDelIndex = -1;   // CHẶNG 33: lỗi đang chờ xác nhận xoá (pop-up delOneModal)

  const SCRIPT_URL = CFG.SCRIPT_URL || '';
  let saveKey = 'myspeaking_manual';   // đặt lại khi biết videoUrl (sau bước chọn tên)

  // ─── Lưu / khôi phục tạm (localStorage) ───
  let saveTimer = null;
  function autosave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      state.savedAt = new Date().toISOString();   // CHẶNG 29: mốc lưu — xếp danh sách "bài đã nộp"
      try { localStorage.setItem(saveKey, JSON.stringify(state)); } catch (e) {}
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
    if (editingIndex >= 0) { state.errors[editingIndex] = err; toast('Mistake updated ✓'); }
    else { state.errors.push(err); toast('Mistake added ✓ (' + state.errors.length + ' total)'); }
    clearErrForm();
    renderErrors();
    autosave();
  }

  function renderErrors() {
    const list = $('errList');
    const sorted = state.errors.map((e, i) => ({ e, i }))
      .sort((a, b) => (tSec(a.e) - tSec(b.e)));
    list.innerHTML = sorted.map(({ e, i }, pos) => {
      const st = TYPE_STYLE[e.type] || { badge: 'bg-slate-100 text-slate-600' };
      return '<div class="slidein rounded-2xl border border-slate-200 p-3.5 hover:border-indigo-300 transition group">' +
        '<div class="flex items-center gap-2 flex-wrap">' +
        // CHẶNG 33: STT đứng TRƯỚC mốc giờ. Đánh theo THỨ TỰ THỜI GIAN (danh sách đã sort)
        // → khớp cách đánh số của file Excel bên app máy tính.
        '<span class="shrink-0 w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 font-extrabold text-xs flex items-center justify-center">' + (pos + 1) + '</span>' +
        '<span class="font-mono font-bold text-sm bg-slate-900 text-white rounded-lg px-2 py-0.5">' + fmtTime(e) + '</span>' +
        (e.section ? '<span class="text-xs font-bold text-slate-500">Section ' + escapeHtml(e.section) + '</span>' : '') +
        '<span class="text-xs font-bold rounded-full px-2.5 py-1 ' + st.badge + '">' + typeLabel(e.type) + '</span>' +
        (e.who ? '<span class="text-xs font-semibold text-slate-600 flex items-center gap-1">👤 ' + escapeHtml(e.who) + '</span>' : '') +
        '<span class="ml-auto flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition">' +
        '<button data-edit="' + i + '" class="p-1.5 rounded-lg hover:bg-indigo-100 text-indigo-600"><i data-lucide="pencil" class="w-4 h-4 pointer-events-none"></i></button>' +
        '<button data-del="' + i + '" class="p-1.5 rounded-lg hover:bg-rose-100 text-rose-500"><i data-lucide="trash-2" class="w-4 h-4 pointer-events-none"></i></button>' +
        '</span></div>' +
        '<div class="mt-1.5 text-sm font-semibold text-slate-800">' + escapeHtml(e.detail) + '</div>' +
        (e.sentence ? '<div class="mt-0.5 text-xs italic text-slate-500">“' + escapeHtml(e.sentence) + '”</div>' : '') +
        (e.explain ? '<div class="mt-0.5 text-xs text-slate-500">💡 ' + escapeHtml(e.explain) + '</div>' : '') +
        '</div>';
    }).join('');
    $('errEmpty').style.display = state.errors.length ? 'none' : '';

    // đếm theo loại (badge tab đã bỏ cùng tab bar ở chặng 12)
    // CHẶNG 33: dùng CHỮ CÁI G/P/I (không phải tên đầy đủ) — tên đầy đủ làm ô cuối lòi ra ngoài
    // khung trên điện thoại nhỏ. Chữ cái in đậm + `whitespace-nowrap` để không bao giờ vỡ dòng.
    const counts = {};
    state.errors.forEach((e) => { counts[e.type] = (counts[e.type] || 0) + 1; });
    $('errStats').innerHTML = Object.keys(TYPE_STYLE)
      .filter((t) => counts[t])
      .map((t) => '<span title="' + typeLabel(t) + '" class="rounded-full px-2 py-1 font-extrabold whitespace-nowrap ' +
        TYPE_STYLE[t].badge + '">' + TYPE_STYLE[t].short + ': ' + counts[t] + '</span>').join('');

    // CHẶNG 33: nút Delete all — chỉ hiện khi có lỗi VÀ không ở chế độ xem lại bài đã nộp
    const da = $('btnDelAll');
    if (da) da.classList.toggle('hidden', !state.errors.length || reviewLocked);
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
    if (!state.errors.length) { toast('No mistakes to submit yet. Watch the video closely!', 'err'); return; }
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
    const s = $('submitSummary');
    s.innerHTML =
      '<div>👤 Checked by: <b>' + escapeHtml(state.student) + '</b>' + (state.myTeam ? ' (' + escapeHtml(state.myTeam) + ')' : '') + '</div>' +
      (state.checkedTeam ? '<div>🎯 Team checked: <b>' + escapeHtml(state.checkedTeam) + '</b></div>' : '') +
      '<div>🚩 Mistakes found: <b>' + state.errors.length + '</b></div>' +
      '<div>⏱ Students timed: <b>' + cleanTimers().filter((t) => t.name.trim()).length + '</b></div>' +
      (state.submitted ? '<div class="text-amber-600 font-semibold">⚠ You\'ve already submitted once — submitting again creates a new copy.</div>' : '');
    $('submitModal').classList.remove('hidden');
    $('submitModal').classList.add('flex');
  }
  function closeSubmitModal() {
    $('submitModal').classList.add('hidden');
    $('submitModal').classList.remove('flex');
  }

  async function submit() {
    closeSubmitModal();
    if (!SCRIPT_URL) {
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
      const res = await fetch(SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
      });
      const out = await res.json();
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
  // ƯU TIÊN đọc LIVE từ "bộ não" (Apps Script ?config=1) — thầy ra bài mới KHÔNG cần đăng lại web.
  // DỰ PHÒNG file tĩnh data/classes.json khi bộ não chưa sẵn / lỗi mạng.
  async function loadClasses() {
    if (SCRIPT_URL) {
      try {
        const r = await fetch(SCRIPT_URL + '?config=1&_=' + Date.now(), { cache: 'no-store' });
        if (r.ok) {
          const j = await r.json();
          if (j && Array.isArray(j.classes) && j.classes.length) { CLASSES = j; fixClassNames(); return; }
        }
      } catch (e) { /* rơi xuống dự phòng */ }
    }
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

  function start() {
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

  // ═══════════════ CHẶNG 32 — KÉO BÀI ĐÃ NỘP VỀ FORM (chặn gốc ca "nộp lần 2 thiếu bài") ═══════════════
  // Vì sao: bài đang làm chỉ nằm trong localStorage TỪNG MÁY. Em nộp ở máy A, hôm sau mở máy B thì
  // form TRỐNG — em thêm 2 lỗi rồi Submit là chỉ gửi PHẦN BỔ SUNG (ca PHONG mất 16 lỗi, B2B GERMS).
  // Nay: máy KHÔNG có dấu vết bài (không lỗi đã lưu, chưa từng nộp) thì hỏi bộ não "?mine=1".
  // Có bài cũ → đổ về form + KHOÁ XEM (dùng lại cơ chế chặng 29 — muốn sửa phải bấm Edit & submit again).
  // LUẬT AN TOÀN: mạng hỏng / chờ quá 8 giây / bộ não chưa deploy → vào làm bài BÌNH THƯỜNG, không chặn.
  async function maybeRestoreFromServer(saved) {
    if (!SCRIPT_URL) return;
    // Máy này đã có dấu vết bài của chính em (lỗi đã lưu hoặc từng nộp) → ưu tiên bản máy, không hỏi mạng
    if (saved && saved.student === state.student && ((saved.errors || []).length || saved.wasSubmitted)) return;
    try {
      const ctl = new AbortController();
      const tm = setTimeout(() => ctl.abort(), 8000);
      const u = SCRIPT_URL + '?mine=1&classCode=' + encodeURIComponent(state.classCode) +
        '&lesson=' + encodeURIComponent(state.lesson) + '&student=' + encodeURIComponent(state.student) +
        '&_=' + Date.now();
      const r = await fetch(u, { cache: 'no-store', signal: ctl.signal });
      clearTimeout(tm);
      if (!r.ok) return;
      const j = await r.json();
      if (!j || !j.ok || !(j.errors || []).length) return;   // chưa nộp gì / bộ não bản cũ → thôi
      if (state.errors.length) return;                        // trong lúc chờ mạng em đã kịp thêm lỗi → đừng đè
      state.errors = j.errors.map((er) => ({
        min: +er.min || 0, sec: +er.sec || 0, section: '',
        who: String(er.who || ''), type: String(er.type || ''),
        sentence: String(er.sentence || ''), detail: String(er.detail || ''), explain: String(er.explain || ''),
      }));
      state.submitted = true;
      state.wasSubmitted = true;
      if ((j.timers || []).length) initTimers(j.timers);
      buildStudentField();
      renderErrors();
      setReviewLock(true);   // khoá xem — sửa tiếp phải bấm "Edit & submit again" (xác nhận như chặng 29)
      autosave();
      toast('Welcome back! Loaded the ' + state.errors.length + ' mistakes you already submitted ✓', 'info');
    } catch (e) { /* mạng hỏng → làm bài bình thường, không làm phiền */ }
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

  // ─── Gắn sự kiện ───
  document.addEventListener('DOMContentLoaded', async () => {
    refreshIcons();
    await loadClasses();
    initLoginScreen();

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

    // Bấm logo → về trang chủ đăng nhập lại; còn dữ liệu chưa submit thì hỏi trước
    $('btnHome').addEventListener('click', () => {
      const unsubmitted = !$('appScreen').classList.contains('hidden') && state.errors.length && !state.submitted;
      if (unsubmitted) { $('leaveModal').classList.remove('hidden'); $('leaveModal').classList.add('flex'); }
      else window.location.href = window.location.pathname;
    });
    $('btnLeaveCancel').addEventListener('click', () => { $('leaveModal').classList.add('hidden'); $('leaveModal').classList.remove('flex'); });
    $('btnLeaveOk').addEventListener('click', () => { window.location.href = window.location.pathname; });

    $('btnAddErr').addEventListener('click', addOrUpdateError);
    $('btnCancelEdit').addEventListener('click', clearErrForm);

    $('errList').addEventListener('click', (ev) => {
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
      state.errors.splice(i, 1);
      if (editingIndex === i) clearErrForm();
      else if (editingIndex > i) editingIndex--;   // các lỗi phía sau tụt 1 bậc
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
      state.errors = [];
      clearErrForm();
      renderErrors(); autosave();
      toast('Deleted all ' + n + ' mistakes', 'info');
    });

    // (CHẶNG 34) xoay ngang/dọc điện thoại hay kéo cỡ cửa sổ → tính lại cỡ chữ dòng dưới video
    let fitTimer = null;
    window.addEventListener('resize', () => { clearTimeout(fitTimer); fitTimer = setTimeout(fitVideoInfo, 120); });

    $('btnExport').addEventListener('click', exportExcel);
    $('btnSubmit').addEventListener('click', openSubmitModal);
    $('btnSubmitCancel').addEventListener('click', closeSubmitModal);
    $('btnSubmitOk').addEventListener('click', submit);
  });
})();
