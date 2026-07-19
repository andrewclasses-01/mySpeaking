/* ═══════════════════════════════════════════════════════════════
   mySpeaking — SPEAKING TEAM CHECK
   App bắt lỗi video thuyết trình cho học sinh (GitHub Pages)
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const CFG = window.MYSPEAKING_CONFIG || {};
  const $ = (id) => document.getElementById(id);

  // ─── Danh sách lớp (data/classes.json) — mô hình 1 LINK CHUNG + đăng nhập theo lớp ───
  // Cấu trúc: { classes: [ { id, name, code, topic, teams:[{team, video, members[]}], pairs:[{checker, checked}] } ] }
  let CLASSES = { classes: [] };
  const session = { class: null };   // lớp đang chọn sau khi đăng nhập

  // ─── State ───
  const state = {
    student: '', myTeam: '',
    className: '',
    topic: '',
    checkedTeam: '',
    members: [],
    videoUrl: '',
    errors: [],   // {min, sec, section, who, type, sentence, detail, explain}
    timers: [],   // {name, sMin, sSec, eMin, eSec}
    submitted: false,
  };
  let editingIndex = -1;
  let fType = '';

  const SCRIPT_URL = CFG.SCRIPT_URL || '';
  let saveKey = 'myspeaking_manual';   // đặt lại khi biết videoUrl (sau bước chọn tên)

  // ─── Lưu / khôi phục tạm (localStorage) ───
  let saveTimer = null;
  function autosave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try { localStorage.setItem(saveKey, JSON.stringify(state)); } catch (e) {}
    }, 300);
  }
  function loadSaved() {
    try { return JSON.parse(localStorage.getItem(saveKey)); } catch (e) { return null; }
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

  function setVideoStatus(html) { $('videoStatus').innerHTML = html; }

  // Dòng thông tin dưới video: LỚP · ĐỘI ĐƯỢC CHẤM · các thành viên (thay cho chữ trạng thái kỹ thuật)
  function videoInfoHtml() {
    const mem = (state.members || []).join(' · ');
    return '<i data-lucide="users" class="w-3.5 h-3.5 text-indigo-500 shrink-0"></i> ' +
      '<b>' + escapeHtml(state.className) + '</b><span class="text-slate-300">|</span>' +
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
    else if (video.mode === 'stopwatch') { sw.elapsed = t; sw.startedAt = Date.now(); swRender(); }
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
      guard = setTimeout(() => { if (!video.ready) tryNext(); }, 15000);
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

  // — Fallback: iframe Drive + đồng hồ bấm giờ —
  function initDriveIframe(box, id) {
    video.mode = 'stopwatch';
    video.el = null;
    box.innerHTML = '<iframe src="https://drive.google.com/file/d/' + id + '/preview" allow="autoplay; fullscreen" allowfullscreen></iframe>';
    $('stopwatchWrap').classList.remove('hidden');
    setVideoStatus(videoInfoHtml());  // khung vàng phía trên đã giải thích chế độ đồng hồ
    refreshIcons();
  }

  // — Đồng hồ bấm giờ —
  const sw = { running: false, elapsed: 0, startedAt: 0, tick: null };
  function swNow() { return sw.running ? sw.elapsed + (Date.now() - sw.startedAt) / 1000 : sw.elapsed; }
  function swRender() {
    const s = Math.floor(swNow());
    $('swDisplay').textContent = String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
    if (sw.running) syncTimeFields(s);   // chế độ đồng hồ dự phòng: MIN/SEC cũng chạy theo
  }
  function swToggle() {
    if (sw.running) {
      sw.elapsed = swNow(); sw.running = false;
      clearInterval(sw.tick);
      $('swToggle').innerHTML = '<i data-lucide="play" class="w-4 h-4"></i><span>Start</span>';
    } else {
      sw.running = true; sw.startedAt = Date.now();
      sw.tick = setInterval(swRender, 250);
      $('swToggle').innerHTML = '<i data-lucide="pause" class="w-4 h-4"></i><span>Pause</span>';
    }
    refreshIcons();
  }

  function getVideoTime() {
    if (video.mode === 'youtube' && video.yt && video.ready) {
      try { return video.yt.getCurrentTime(); } catch (e) { return null; }
    }
    if (video.mode === 'html5' && video.el) return video.el.currentTime;
    if (video.mode === 'stopwatch') return swNow();
    return null;
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
  const TYPE_STYLE = {
    'NGỮ PHÁP': { badge: 'bg-blue-100 text-blue-700' },
    'PHÁT ÂM': { badge: 'bg-emerald-100 text-emerald-700' },
    'THÔNG TIN': { badge: 'bg-amber-100 text-amber-700' },
  };
  // English display labels for the mistake types (stored values stay Vietnamese to match the Excel template)
  const TYPE_LABEL = { 'NGỮ PHÁP': 'Grammar', 'PHÁT ÂM': 'Pronunciation', 'THÔNG TIN': 'Information' };
  const typeLabel = (t) => TYPE_LABEL[t] || t;
  function renderTypeBtns() {
    document.querySelectorAll('.errType').forEach((b) => {
      b.className = 'errType rounded-lg border-2 px-1 py-2 text-[11px] sm:text-xs font-bold leading-tight transition flex flex-row items-center justify-center gap-1.5 ' +
        (fType === b.dataset.type ? TYPE_ON : TYPE_OFF);
    });
  }

  // Ô textarea (SENTENCE / MISTAKE / EXPLANATION) tự giãn cao theo nội dung để xem HẾT chữ
  function autoGrow(el) { if (!el) return; el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; }
  function autoGrowAll() { ['fSentence', 'fDetail', 'fExplain'].forEach((id) => autoGrow($(id))); }

  function clearErrForm() {
    // KHÔNG xoá MIN/SEC: chúng chạy theo video (và giữ mốc hiện tại khi pause để bắt lỗi tiếp)
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
    const sentence = $('fSentence').value.trim();
    const detail = $('fDetail').value.trim();
    const explain = $('fExplain').value.trim();
    if (!fType) { toast('Please choose a TYPE!', 'err'); return; }
    if (!sentence) { toast('Please write the SENTENCE that has the mistake!', 'err'); $('fSentence').focus(); return; }
    if (!detail) { toast('Please describe the MISTAKE!', 'err'); $('fDetail').focus(); return; }
    if (!explain) { toast('Please write the EXPLANATION!', 'err'); $('fExplain').focus(); return; }

    let mn = $('fMin').value === '' ? '' : Math.max(0, parseInt($('fMin').value, 10) || 0);
    let sc = $('fSec').value === '' ? '' : Math.max(0, parseInt($('fSec').value, 10) || 0);
    if (editingIndex < 0 && mn !== '' && sc !== '') {
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
    list.innerHTML = sorted.map(({ e, i }) => {
      const st = TYPE_STYLE[e.type] || { badge: 'bg-slate-100 text-slate-600' };
      return '<div class="slidein rounded-2xl border border-slate-200 p-3.5 hover:border-indigo-300 transition group">' +
        '<div class="flex items-center gap-2 flex-wrap">' +
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
    const counts = {};
    state.errors.forEach((e) => { counts[e.type] = (counts[e.type] || 0) + 1; });
    $('errStats').innerHTML = Object.keys(TYPE_STYLE)
      .filter((t) => counts[t])
      .map((t) => '<span class="rounded-full px-2.5 py-1 ' + TYPE_STYLE[t].badge + '">' + typeLabel(t) + ': ' + counts[t] + '</span>').join('');
    refreshIcons();
  }
  function tSec(e) { return (parseInt(e.min, 10) || 0) * 60 + (parseInt(e.sec, 10) || 0); }
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
        className: state.className,
        student: state.student, myTeam: state.myTeam,
        checkedTeam: state.checkedTeam, topic: state.topic, videoUrl: state.videoUrl,
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
      autosave();
      toast('🎉 Submitted successfully! Thank you.');
    } catch (e) {
      toast('Submission failed (' + e.message + '). Try again or tap Export Excel to send to your teacher.', 'err');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i data-lucide="send" class="w-4 h-4"></i> Submit';
      refreshIcons();
    }
  }

  // ═══════════════ EXPORT EXCEL (matches the SPEAKING TEAM CHECK FORM template) ═══════════════
  // NOTE: sheet names, column headers and the reminder note stay in Vietnamese on purpose,
  // so the exported file lines up 1:1 with the teacher's template and Google Sheet.
  function exportExcel() {
    const wb = XLSX.utils.book_new();

    // Sheet TIMER
    const note = 'DẶN DÒ CỦA THẦY:  Việc luyện tập là trách nhiệm, nhưng cũng là quyền lợi của các em. Hãy luôn nhớ rằng, việc mình luyện tập hôm nay chính là sự chuẩn bị năng lực cho chính mình vào ngày mai. Không bao giờ vi phạm đạo đức và vô trách nhiệm với bản thân bằng việc sao chép phần luyện tập của các bạn khác nhé!';
    const timerAoa = [
      ['STT', 'BẠN', 'TGIAN BẮT ĐẦU', null, 'TGIAN KẾT THÚC', null],
      [null, null, 'Phút', 'Giây', 'Phút', 'Giây'],
    ];
    const rows = cleanTimers();
    for (let i = 0; i < Math.max(6, rows.length); i++) {
      const t = rows[i];
      timerAoa.push(t ? [i + 1, t.name, num(t.sMin), num(t.sSec), num(t.eMin), num(t.eSec)] : [i + 1, null, null, null, null, null]);
    }
    timerAoa.push([]);
    timerAoa.push([note]);
    const wsT = XLSX.utils.aoa_to_sheet(timerAoa);
    const noteRow = timerAoa.length - 1;
    wsT['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 1, c: 0 } }, { s: { r: 0, c: 1 }, e: { r: 1, c: 1 } },
      { s: { r: 0, c: 2 }, e: { r: 0, c: 3 } }, { s: { r: 0, c: 4 }, e: { r: 0, c: 5 } },
      { s: { r: noteRow, c: 0 }, e: { r: noteRow, c: 5 } },
    ];
    wsT['!cols'] = [{ wch: 5 }, { wch: 22 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 }];
    XLSX.utils.book_append_sheet(wb, wsT, 'TIMER');

    // Sheet FORM
    const formAoa = [['PHÚT', 'GIÂY', 'ĐOẠN', 'HS CÓ LỖI', 'LOẠI LỖI', 'CÂU CHỨA LỖI', 'LỖI CỤ THỂ', 'GIẢI THÍCH LỖI']];
    state.errors.slice().sort((a, b) => tSec(a) - tSec(b)).forEach((e) => {
      formAoa.push([num(e.min), num(e.sec), e.section, e.who, e.type, e.sentence, e.detail, e.explain]);
    });
    const wsF = XLSX.utils.aoa_to_sheet(formAoa);
    wsF['!cols'] = [{ wch: 6 }, { wch: 6 }, { wch: 8 }, { wch: 16 }, { wch: 12 }, { wch: 42 }, { wch: 40 }, { wch: 45 }];
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

  // Tải danh sách lớp (không cache để luôn lấy nội dung mới nhất khi thầy cập nhật)
  async function loadClasses() {
    try {
      const r = await fetch('data/classes.json?_=' + Date.now(), { cache: 'no-store' });
      if (r.ok) CLASSES = await r.json();
    } catch (e) { CLASSES = { classes: [] }; }
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

  // Màn 2 — chọn tên: mỗi đội = TÊN ĐỘI (to, nổi bật) + ô select chọn tên
  function renderIdentify() {
    const cls = session.class;
    $('identHeader').innerHTML =
      '<h2 class="text-lg font-extrabold text-slate-900 leading-tight">' + escapeHtml(cls.name) +
      (cls.topic ? ' — ' + escapeHtml(cls.topic) : '') + '</h2>' +
      '<p class="text-sm text-slate-500 mt-0.5">Pick your team, then choose your name.</p>';
    $('identNames').innerHTML = (cls.teams || []).map((t) =>
      '<div class="flex items-center gap-3">' +
      '<span class="text-2xl font-extrabold text-slate-900 shrink-0">TEAM ' + t.team + '</span>' +
      '<select data-team="' + t.team + '" class="pickSelect flex-1 min-w-0 rounded-xl border border-slate-300 px-3 py-2.5 bg-white text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500">' +
      '<option value="">— Your name —</option>' +
      (t.members || []).map((m) => '<option value="' + escapeHtml(m) + '">' + escapeHtml(m) + '</option>').join('') +
      '</select></div>'
    ).join('');
    $('identPick').classList.remove('hidden');
    $('identConfirm').classList.add('hidden');
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
    state.topic = cls.topic || '';
    state.className = cls.name || cls.id;
    saveKey = 'myspeaking_' + (state.videoUrl || 'manual').slice(-60);

    // ảnh HS: dùng ảnh thật nếu có, tạm thời hiện chữ cái đầu
    const photo = photoFor(cls, name);
    const ph = $('identPhoto');
    if (photo) { ph.style.backgroundImage = 'url("' + photo + '")'; ph.textContent = ''; }
    else { ph.style.backgroundImage = ''; ph.textContent = initialsOf(name); }

    $('identName').textContent = name;
    $('identTeams').innerHTML = 'You are in <b>Team ' + teamNo + '</b> · You will check <b>Team ' + pair.checked + '</b>';

    $('chkAgree').checked = false;
    setStartEnabled(false);

    $('identPick').classList.add('hidden');
    $('identConfirm').classList.remove('hidden');
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
      if (state.errors.length) toast('Restored ' + state.errors.length + ' mistakes you logged earlier ✓', 'info');
    }

    // dựng UI chính
    $('hdStudentName').textContent = state.student;
    $('hdTopic').textContent = state.topic || 'Watch · spot mistakes · improve together';
    if (state.checkedTeam) {
      $('hdChecked').textContent = '🎯 ' + state.checkedTeam;
      $('hdChecked').classList.remove('hidden');
    }
    initTimers(savedTimers);      // timers TRƯỚC — buildStudentField vẽ ô thời gian từ timers
    buildStudentField();
    renderErrors();
    initVideo();

    $('loginScreen').classList.add('hidden');
    $('identifyScreen').classList.add('hidden');
    $('appScreen').classList.remove('hidden');
    autosave();
    refreshIcons();
  }

  // (switchTab đã bỏ chặng 12 — chỉ còn một khối Mistakes, thời gian nói nằm trong form)

  // ─── Gắn sự kiện ───
  document.addEventListener('DOMContentLoaded', async () => {
    refreshIcons();
    await loadClasses();
    initLoginScreen();

    // Màn đăng nhập lớp
    $('btnLogin').addEventListener('click', handleLogin);
    $('inpClass').addEventListener('keydown', (e) => { if (e.key === 'Enter') handleLogin(); });
    $('inpCode').addEventListener('keydown', (e) => { if (e.key === 'Enter') handleLogin(); });
    $('btnLoginErrOk').addEventListener('click', hideLoginErr);
    // Màn chọn tên (ô select — chọn xong là sang xác nhận ngay)
    $('btnBackLogin').addEventListener('click', () => {
      $('identifyScreen').classList.add('hidden');
      $('loginScreen').classList.remove('hidden');
    });
    $('identNames').addEventListener('change', (ev) => {
      const s = ev.target.closest('.pickSelect');
      if (s && s.value) handleNamePick(s.dataset.team, s.value);
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
      if (del) {
        const i = +del.dataset.del;
        state.errors.splice(i, 1);
        if (editingIndex === i) clearErrForm();
        renderErrors(); autosave();
        toast('Mistake deleted', 'info');
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

    $('swToggle').addEventListener('click', swToggle);
    $('swReset').addEventListener('click', () => { sw.elapsed = 0; sw.startedAt = Date.now(); swRender(); });
    $('swSet').addEventListener('click', () => {
      const v = prompt('Enter the video\'s current time (min:sec), e.g. 3:25');
      if (!v) return;
      const m = v.match(/^(\d+)[:.](\d{1,2})$/);
      if (!m) { toast('Wrong format, correct example: 3:25', 'err'); return; }
      sw.elapsed = (+m[1]) * 60 + (+m[2]);
      sw.startedAt = Date.now();
      swRender();
    });

    $('btnExport').addEventListener('click', exportExcel);
    $('btnSubmit').addEventListener('click', openSubmitModal);
    $('btnSubmitCancel').addEventListener('click', closeSubmitModal);
    $('btnSubmitOk').addEventListener('click', submit);
  });
})();
