/* ═══════════════════════════════════════════════════════════════
   mySTCheck — SPEAKING TEAM CHECK
   App bắt lỗi video thuyết trình cho học sinh (GitHub Pages)
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const CFG = window.MYSTCHECK_CONFIG || {};
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
    errors: [],   // {min, sec, section, who, type, detail, explain}
    timers: [],   // {name, sMin, sSec, eMin, eSec}
    submitted: false,
  };
  let editingIndex = -1;
  let fType = '';

  const SCRIPT_URL = CFG.SCRIPT_URL || '';
  let saveKey = 'mystcheck_manual';   // đặt lại khi biết videoUrl (sau bước chọn tên)

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
            setVideoStatus('<i data-lucide="badge-check" class="w-3.5 h-3.5 text-emerald-500"></i> YouTube — precise timestamps');
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
      setVideoStatus('<i data-lucide="badge-check" class="w-3.5 h-3.5 text-emerald-500"></i> Direct playback — precise timestamps');
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
    setVideoStatus('<i data-lucide="alert-triangle" class="w-3.5 h-3.5 text-amber-500"></i> Backup mode: use the timer below for timestamps');
    refreshIcons();
  }

  // — Đồng hồ bấm giờ —
  const sw = { running: false, elapsed: 0, startedAt: 0, tick: null };
  function swNow() { return sw.running ? sw.elapsed + (Date.now() - sw.startedAt) / 1000 : sw.elapsed; }
  function swRender() {
    const s = Math.floor(swNow());
    $('swDisplay').textContent = String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
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
  function buildStudentField() {
    const wrap = $('fStudentWrap');
    if (state.members.length) {
      let html = '<select id="fWho" class="w-full rounded-xl border border-slate-300 px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">';
      html += '<option value="">— Select the student —</option>';
      state.members.forEach((m) => { html += '<option>' + escapeHtml(m) + '</option>'; });
      html += '<option value="Whole team">Whole team</option><option value="__other">Someone else…</option></select>';
      html += '<input id="fWhoOther" type="text" placeholder="Name of the student" class="hidden mt-2 w-full rounded-xl border border-slate-300 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500">';
      wrap.innerHTML = html;
      $('fWho').addEventListener('change', () => {
        $('fWhoOther').classList.toggle('hidden', $('fWho').value !== '__other');
      });
    } else {
      wrap.innerHTML = '<input id="fWho" type="text" placeholder="Name of the student" class="w-full rounded-xl border border-slate-300 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500">';
    }
  }
  function getWho() {
    const el = $('fWho');
    if (!el) return '';
    if (el.tagName === 'SELECT' && el.value === '__other') return $('fWhoOther').value.trim();
    return el.value === '__other' ? '' : el.value.trim();
  }
  function setWho(val) {
    const el = $('fWho');
    if (el.tagName === 'SELECT') {
      const opts = Array.from(el.options).map((o) => o.value);
      if (opts.includes(val)) { el.value = val; $('fWhoOther').classList.add('hidden'); }
      else { el.value = '__other'; $('fWhoOther').classList.remove('hidden'); $('fWhoOther').value = val; }
    } else el.value = val;
  }

  const TYPE_STYLE = {
    'NGỮ PHÁP': { on: 'border-blue-600 bg-blue-600 text-white', off: 'border-blue-200 bg-blue-50 text-blue-700', badge: 'bg-blue-100 text-blue-700' },
    'PHÁT ÂM': { on: 'border-emerald-600 bg-emerald-600 text-white', off: 'border-emerald-200 bg-emerald-50 text-emerald-700', badge: 'bg-emerald-100 text-emerald-700' },
    'THÔNG TIN': { on: 'border-amber-500 bg-amber-500 text-white', off: 'border-amber-200 bg-amber-50 text-amber-700', badge: 'bg-amber-100 text-amber-700' },
  };
  // English display labels for the mistake types (stored values stay Vietnamese to match the Excel template)
  const TYPE_LABEL = { 'NGỮ PHÁP': 'Grammar', 'PHÁT ÂM': 'Pronunciation', 'THÔNG TIN': 'Information' };
  const typeLabel = (t) => TYPE_LABEL[t] || t;
  function renderTypeBtns() {
    document.querySelectorAll('.errType').forEach((b) => {
      const t = b.dataset.type;
      b.className = 'errType rounded-xl border-2 px-1 py-2.5 text-xs sm:text-sm font-bold leading-tight transition ' + (fType === t ? TYPE_STYLE[t].on : TYPE_STYLE[t].off);
    });
  }

  function clearErrForm() {
    $('fMin').value = ''; $('fSec').value = ''; $('fSection').value = '';
    $('fDetail').value = ''; $('fExplain').value = '';
    fType = ''; renderTypeBtns();
    editingIndex = -1;
    $('btnAddErrLabel').textContent = 'Add this mistake';
    $('btnCancelEdit').classList.add('hidden');
  }

  function addOrUpdateError() {
    const detail = $('fDetail').value.trim();
    if (!fType) { toast('Please choose a MISTAKE TYPE!', 'err'); return; }
    if (!detail) { toast('Please describe THE MISTAKE!', 'err'); $('fDetail').focus(); return; }
    const err = {
      min: $('fMin').value === '' ? '' : Math.max(0, parseInt($('fMin').value, 10) || 0),
      sec: $('fSec').value === '' ? '' : Math.max(0, parseInt($('fSec').value, 10) || 0),
      section: $('fSection').value.trim(),
      who: getWho(),
      type: fType,
      detail: detail,
      explain: $('fExplain').value.trim(),
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
        (e.explain ? '<div class="mt-0.5 text-xs text-slate-500">💡 ' + escapeHtml(e.explain) + '</div>' : '') +
        '</div>';
    }).join('');
    $('errEmpty').style.display = state.errors.length ? 'none' : '';

    // đếm
    const n = state.errors.length;
    const badge = $('tabErrCount');
    badge.textContent = n; badge.classList.toggle('hidden', !n);
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

  // ═══════════════ TIMER (thời gian nói) ═══════════════
  function initTimers(saved) {
    if (saved && saved.length) state.timers = saved;
    else if (state.members.length) state.timers = state.members.map((m) => ({ name: m, sMin: '', sSec: '', eMin: '', eSec: '' }));
    else state.timers = Array.from({ length: 6 }, () => ({ name: '', sMin: '', sSec: '', eMin: '', eSec: '' }));
    renderTimers();
  }

  function renderTimers() {
    const wrap = $('timerRows');
    wrap.innerHTML = state.timers.map((t, i) =>
      '<div class="rounded-2xl border border-slate-200 p-3">' +
      '<div class="flex items-center gap-2 mb-2">' +
      '<span class="w-6 h-6 rounded-full bg-violet-100 text-violet-700 text-xs font-bold flex items-center justify-center shrink-0">' + (i + 1) + '</span>' +
      '<input data-tname="' + i + '" value="' + escapeHtml(t.name) + '" placeholder="Student ' + (i + 1) + '" class="flex-1 min-w-0 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-violet-500">' +
      '<button data-tdel="' + i + '" class="p-1.5 rounded-lg hover:bg-rose-100 text-rose-400"><i data-lucide="x" class="w-4 h-4 pointer-events-none"></i></button>' +
      '</div>' +
      '<div class="grid grid-cols-2 gap-2">' +
      timerHalf(i, 'START', 's') + timerHalf(i, 'END', 'e') +
      '</div></div>'
    ).join('');
    refreshIcons();
  }
  function timerHalf(i, label, p) {
    const t = state.timers[i];
    return '<div class="rounded-xl bg-slate-50 p-2">' +
      '<div class="text-[10px] font-bold text-slate-400 mb-1">' + label + '</div>' +
      '<div class="flex items-center gap-1">' +
      '<input data-tf="' + i + ':' + p + 'Min" type="number" min="0" value="' + t[p + 'Min'] + '" placeholder="min" class="w-full rounded-lg border border-slate-300 px-1 py-1 text-center font-mono text-sm focus:outline-none focus:ring-2 focus:ring-violet-500">' +
      '<span class="text-slate-400 font-bold">:</span>' +
      '<input data-tf="' + i + ':' + p + 'Sec" type="number" min="0" max="59" value="' + t[p + 'Sec'] + '" placeholder="sec" class="w-full rounded-lg border border-slate-300 px-1 py-1 text-center font-mono text-sm focus:outline-none focus:ring-2 focus:ring-violet-500">' +
      '<button data-tgrab="' + i + ':' + p + '" title="Grab from video time" class="shrink-0 bg-violet-600 hover:bg-violet-700 text-white rounded-lg px-2 py-1 text-xs font-bold">⏱ Mark</button>' +
      '</div></div>';
  }

  // ═══════════════ NỘP BÀI ═══════════════
  function cleanTimers() {
    return state.timers.filter((t) => t.name.trim() || t.sMin !== '' || t.eMin !== '' || t.sSec !== '' || t.eSec !== '');
  }

  function openSubmitModal() {
    if (!state.errors.length) { toast('No mistakes to submit yet. Watch the video closely!', 'err'); return; }
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
    const formAoa = [['PHÚT', 'GIÂY', 'ĐOẠN', 'HS CÓ LỖI', 'LOẠI LỖI', 'LỖI CỤ THỂ', 'GIẢI THÍCH LỖI']];
    state.errors.slice().sort((a, b) => tSec(a) - tSec(b)).forEach((e) => {
      formAoa.push([num(e.min), num(e.sec), e.section, e.who, e.type, e.detail, e.explain]);
    });
    const wsF = XLSX.utils.aoa_to_sheet(formAoa);
    wsF['!cols'] = [{ wch: 6 }, { wch: 6 }, { wch: 8 }, { wch: 16 }, { wch: 12 }, { wch: 40 }, { wch: 45 }];
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

  // Màn 1 — đăng nhập lớp: đổ danh sách lớp vào dropdown
  function initLoginScreen() {
    const sel = $('inpClass');
    (CLASSES.classes || []).forEach((c) => {
      const o = document.createElement('option');
      o.value = c.id; o.textContent = c.name;
      sel.appendChild(o);
    });
    if (!(CLASSES.classes || []).length) {
      toast('Chưa có lớp nào trong danh sách. Thầy cần thêm lớp vào data/classes.json.', 'err');
    }
  }

  function handleLogin() {
    const cls = (CLASSES.classes || []).find((c) => c.id === $('inpClass').value);
    if (!cls) { toast('Please choose your class!', 'err'); return; }
    const code = $('inpCode').value.trim();
    if (String(cls.code || '').toLowerCase() !== code.toLowerCase()) {
      toast('Wrong class code — please check with your teacher.', 'err'); $('inpCode').focus(); return;
    }
    session.class = cls;
    renderIdentify();
    $('loginScreen').classList.add('hidden');
    $('identifyScreen').classList.remove('hidden');
    refreshIcons();
  }

  // Màn 2 — chọn tên: liệt kê tên theo từng đội
  function renderIdentify() {
    const cls = session.class;
    $('identHeader').innerHTML =
      '<h2 class="text-lg font-extrabold text-slate-900 leading-tight">' + escapeHtml(cls.name) +
      (cls.topic ? ' — ' + escapeHtml(cls.topic) : '') + '</h2>' +
      '<p class="text-sm text-slate-500 mt-0.5">Find and tap your name below.</p>';
    $('identNames').innerHTML = (cls.teams || []).map((t) =>
      '<div><div class="text-xs font-bold text-slate-400 mb-1.5">TEAM ' + t.team + '</div>' +
      '<div class="flex flex-wrap gap-2">' +
      (t.members || []).map((m) =>
        '<button data-team="' + t.team + '" data-name="' + escapeHtml(m) +
        '" class="pickName rounded-xl border border-slate-300 hover:border-indigo-500 hover:bg-indigo-50 active:scale-95 px-3.5 py-2 text-sm font-semibold transition">' +
        escapeHtml(m) + '</button>').join('') +
      '</div></div>'
    ).join('');
    $('identPick').classList.remove('hidden');
    $('identConfirm').classList.add('hidden');
  }

  // Chọn tên → tính đội mình + đội phải chấm (theo cặp chấm chéo) → màn xác nhận
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
    saveKey = 'mystcheck_' + (state.videoUrl || 'manual').slice(-60);

    $('identConfirmBox').innerHTML =
      '<div class="text-slate-500 text-sm">You are</div>' +
      '<div class="text-2xl font-extrabold text-slate-900">' + escapeHtml(name) + '</div>' +
      '<div class="text-sm text-slate-600">Team ' + teamNo + '</div>' +
      '<div class="mt-3 inline-flex items-center gap-2 bg-white rounded-full px-4 py-1.5 text-sm font-bold text-indigo-700 border border-indigo-200">' +
      '<i data-lucide="target" class="w-4 h-4"></i> You will check TEAM ' + pair.checked + '</div>';
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
    buildStudentField();
    initTimers(savedTimers);
    renderErrors();
    initVideo();

    $('loginScreen').classList.add('hidden');
    $('identifyScreen').classList.add('hidden');
    $('appScreen').classList.remove('hidden');
    autosave();
    refreshIcons();
  }

  function switchTab(tab) {
    document.querySelectorAll('.tabBtn').forEach((b) => {
      const on = b.dataset.tab === tab;
      b.className = 'tabBtn flex-1 rounded-xl py-2.5 text-sm font-bold flex items-center justify-center gap-1.5 transition ' +
        (on ? 'bg-indigo-600 text-white shadow' : 'text-slate-500 hover:bg-slate-100');
    });
    $('tab-errors').classList.toggle('hidden', tab !== 'errors');
    $('tab-timer').classList.toggle('hidden', tab !== 'timer');
  }

  // ─── Gắn sự kiện ───
  document.addEventListener('DOMContentLoaded', async () => {
    refreshIcons();
    await loadClasses();
    initLoginScreen();
    switchTab('errors');

    // Màn đăng nhập lớp
    $('btnLogin').addEventListener('click', handleLogin);
    $('inpCode').addEventListener('keydown', (e) => { if (e.key === 'Enter') handleLogin(); });
    // Màn chọn tên
    $('btnBackLogin').addEventListener('click', () => {
      $('identifyScreen').classList.add('hidden');
      $('loginScreen').classList.remove('hidden');
    });
    $('identNames').addEventListener('click', (ev) => {
      const b = ev.target.closest('.pickName');
      if (b) handleNamePick(b.dataset.team, b.dataset.name);
    });
    $('btnStartCheck').addEventListener('click', start);
    $('btnBackNames').addEventListener('click', renderIdentify);

    document.querySelectorAll('.tabBtn').forEach((b) => b.addEventListener('click', () => switchTab(b.dataset.tab)));

    document.querySelectorAll('.errType').forEach((b) => b.addEventListener('click', () => { fType = b.dataset.type; renderTypeBtns(); }));

    $('btnGrabTime').addEventListener('click', () => {
      const t = getVideoTime();
      if (t == null) { toast('Couldn\'t read the video time. Press play first!', 'err'); return; }
      const s = Math.floor(t);
      $('fMin').value = Math.floor(s / 60);
      $('fSec').value = s % 60;
      toast('⏱ Grabbed ' + String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'), 'info');
    });

    $('btnAddErr').addEventListener('click', addOrUpdateError);
    $('btnCancelEdit').addEventListener('click', clearErrForm);

    $('errList').addEventListener('click', (ev) => {
      const edit = ev.target.closest('[data-edit]');
      const del = ev.target.closest('[data-del]');
      if (edit) {
        const i = +edit.dataset.edit;
        const e = state.errors[i];
        $('fMin').value = e.min; $('fSec').value = e.sec; $('fSection').value = e.section;
        setWho(e.who); fType = e.type; renderTypeBtns();
        $('fDetail').value = e.detail; $('fExplain').value = e.explain;
        editingIndex = i;
        $('btnAddErrLabel').textContent = 'Save changes';
        $('btnCancelEdit').classList.remove('hidden');
        $('fDetail').focus();
      }
      if (del) {
        const i = +del.dataset.del;
        state.errors.splice(i, 1);
        if (editingIndex === i) clearErrForm();
        renderErrors(); autosave();
        toast('Mistake deleted', 'info');
      }
    });

    // timer events (delegation)
    $('timerRows').addEventListener('input', (ev) => {
      const nameEl = ev.target.closest('[data-tname]');
      if (nameEl) { state.timers[+nameEl.dataset.tname].name = nameEl.value; autosave(); return; }
      const f = ev.target.closest('[data-tf]');
      if (f) {
        const [i, key] = f.dataset.tf.split(':');
        state.timers[+i][key] = f.value;
        autosave();
      }
    });
    $('timerRows').addEventListener('click', (ev) => {
      const grab = ev.target.closest('[data-tgrab]');
      if (grab) {
        const [i, p] = grab.dataset.tgrab.split(':');
        const t = getVideoTime();
        if (t == null) { toast('Couldn\'t read the video time. Press play first!', 'err'); return; }
        const s = Math.floor(t);
        state.timers[+i][p + 'Min'] = Math.floor(s / 60);
        state.timers[+i][p + 'Sec'] = s % 60;
        renderTimers(); autosave();
      }
      const del = ev.target.closest('[data-tdel]');
      if (del) {
        state.timers.splice(+del.dataset.tdel, 1);
        renderTimers(); autosave();
      }
    });
    $('btnAddTimerRow').addEventListener('click', () => {
      state.timers.push({ name: '', sMin: '', sSec: '', eMin: '', eSec: '' });
      renderTimers(); autosave();
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
