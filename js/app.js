/* ═══════════════════════════════════════════════════════════════
   mySTCheck — SPEAKING TEAM CHECK
   App bắt lỗi video thuyết trình cho học sinh (GitHub Pages)
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const CFG = window.MYSTCHECK_CONFIG || {};
  const $ = (id) => document.getElementById(id);

  // ─── Cấu hình buổi check (từ link thầy tạo bằng teacher.html) ───
  function readLinkConfig() {
    try {
      const d = new URLSearchParams(location.search).get('d');
      if (!d) return null;
      const json = decodeURIComponent(escape(atob(d.replace(/-/g, '+').replace(/_/g, '/'))));
      return JSON.parse(json);
    } catch (e) { return null; }
  }
  const linkCfg = readLinkConfig(); // {v: videoUrl, t: topic, team: checkedTeam, members: [], s: scriptUrl}

  // ─── State ───
  const state = {
    student: '', myTeam: '',
    topic: (linkCfg && linkCfg.t) || '',
    checkedTeam: (linkCfg && linkCfg.team) || '',
    members: (linkCfg && linkCfg.members) || [],
    videoUrl: (linkCfg && linkCfg.v) || '',
    errors: [],   // {min, sec, section, who, type, detail, explain}
    timers: [],   // {name, sMin, sSec, eMin, eSec}
    submitted: false,
  };
  let editingIndex = -1;
  let fType = '';

  const SCRIPT_URL = (linkCfg && linkCfg.s) || CFG.SCRIPT_URL || '';
  const saveKey = 'mystcheck_' + (state.videoUrl || 'manual').slice(-60);

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
      box.innerHTML = '<div class="w-full h-full flex items-center justify-center text-slate-400 text-sm bg-slate-900 rounded-2xl">Chưa có video</div>';
      return;
    }
    if (p.type === 'youtube') initYouTube(box, p.id);
    else if (p.type === 'drive') initDriveDirect(box, p.id);
    else if (p.type === 'direct') initHtml5(box, [p.url], null);
    else {
      box.innerHTML = '<div class="w-full h-full flex items-center justify-center text-slate-400 text-sm bg-slate-900 rounded-2xl px-6 text-center">Không nhận diện được link video. Hãy dùng link YouTube hoặc Google Drive.</div>';
    }
  }

  // — YouTube (đọc thời gian chính xác qua IFrame API) —
  function initYouTube(box, id) {
    video.mode = 'youtube';
    box.innerHTML = '<div id="ytPlayer"></div>';
    setVideoStatus('<i data-lucide="loader" class="w-3.5 h-3.5 animate-spin"></i> Đang tải YouTube…');
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
            setVideoStatus('<i data-lucide="badge-check" class="w-3.5 h-3.5 text-emerald-500"></i> YouTube — lấy mốc thời gian chính xác');
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
    setVideoStatus('<i data-lucide="loader" class="w-3.5 h-3.5 animate-spin"></i> Đang thử phát trực tiếp từ Drive…');
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
      setVideoStatus('<i data-lucide="badge-check" class="w-3.5 h-3.5 text-emerald-500"></i> Phát trực tiếp — lấy mốc thời gian chính xác');
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
    setVideoStatus('<i data-lucide="alert-triangle" class="w-3.5 h-3.5 text-amber-500"></i> Chế độ dự phòng: dùng đồng hồ bên dưới để lấy mốc thời gian');
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
      $('swToggle').innerHTML = '<i data-lucide="play" class="w-4 h-4"></i><span>Chạy</span>';
    } else {
      sw.running = true; sw.startedAt = Date.now();
      sw.tick = setInterval(swRender, 250);
      $('swToggle').innerHTML = '<i data-lucide="pause" class="w-4 h-4"></i><span>Dừng</span>';
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
      html += '<option value="">— Chọn bạn có lỗi —</option>';
      state.members.forEach((m) => { html += '<option>' + escapeHtml(m) + '</option>'; });
      html += '<option value="CẢ ĐỘI">CẢ ĐỘI</option><option value="__other">Bạn khác…</option></select>';
      html += '<input id="fWhoOther" type="text" placeholder="Tên bạn có lỗi" class="hidden mt-2 w-full rounded-xl border border-slate-300 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500">';
      wrap.innerHTML = html;
      $('fWho').addEventListener('change', () => {
        $('fWhoOther').classList.toggle('hidden', $('fWho').value !== '__other');
      });
    } else {
      wrap.innerHTML = '<input id="fWho" type="text" placeholder="Tên bạn có lỗi" class="w-full rounded-xl border border-slate-300 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500">';
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
  function renderTypeBtns() {
    document.querySelectorAll('.errType').forEach((b) => {
      const t = b.dataset.type;
      b.className = 'errType rounded-xl border-2 py-2.5 text-sm font-bold transition ' + (fType === t ? TYPE_STYLE[t].on : TYPE_STYLE[t].off);
    });
  }

  function clearErrForm() {
    $('fMin').value = ''; $('fSec').value = ''; $('fSection').value = '';
    $('fDetail').value = ''; $('fExplain').value = '';
    fType = ''; renderTypeBtns();
    editingIndex = -1;
    $('btnAddErrLabel').textContent = 'Thêm lỗi này';
    $('btnCancelEdit').classList.add('hidden');
  }

  function addOrUpdateError() {
    const detail = $('fDetail').value.trim();
    if (!fType) { toast('Em hãy chọn LOẠI LỖI nhé!', 'err'); return; }
    if (!detail) { toast('Em hãy ghi LỖI CỤ THỂ nhé!', 'err'); $('fDetail').focus(); return; }
    const err = {
      min: $('fMin').value === '' ? '' : Math.max(0, parseInt($('fMin').value, 10) || 0),
      sec: $('fSec').value === '' ? '' : Math.max(0, parseInt($('fSec').value, 10) || 0),
      section: $('fSection').value.trim(),
      who: getWho(),
      type: fType,
      detail: detail,
      explain: $('fExplain').value.trim(),
    };
    if (editingIndex >= 0) { state.errors[editingIndex] = err; toast('Đã cập nhật lỗi ✓'); }
    else { state.errors.push(err); toast('Đã thêm lỗi ✓ (' + state.errors.length + ' lỗi)'); }
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
        (e.section ? '<span class="text-xs font-bold text-slate-500">Đoạn ' + escapeHtml(e.section) + '</span>' : '') +
        '<span class="text-xs font-bold rounded-full px-2.5 py-1 ' + st.badge + '">' + e.type + '</span>' +
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
      .map((t) => '<span class="rounded-full px-2.5 py-1 ' + TYPE_STYLE[t].badge + '">' + t + ': ' + counts[t] + '</span>').join('');
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
      '<input data-tname="' + i + '" value="' + escapeHtml(t.name) + '" placeholder="Tên bạn ' + (i + 1) + '" class="flex-1 min-w-0 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-violet-500">' +
      '<button data-tdel="' + i + '" class="p-1.5 rounded-lg hover:bg-rose-100 text-rose-400"><i data-lucide="x" class="w-4 h-4 pointer-events-none"></i></button>' +
      '</div>' +
      '<div class="grid grid-cols-2 gap-2">' +
      timerHalf(i, 'BẮT ĐẦU', 's') + timerHalf(i, 'KẾT THÚC', 'e') +
      '</div></div>'
    ).join('');
    refreshIcons();
  }
  function timerHalf(i, label, p) {
    const t = state.timers[i];
    return '<div class="rounded-xl bg-slate-50 p-2">' +
      '<div class="text-[10px] font-bold text-slate-400 mb-1">' + label + '</div>' +
      '<div class="flex items-center gap-1">' +
      '<input data-tf="' + i + ':' + p + 'Min" type="number" min="0" value="' + t[p + 'Min'] + '" placeholder="ph" class="w-full rounded-lg border border-slate-300 px-1 py-1 text-center font-mono text-sm focus:outline-none focus:ring-2 focus:ring-violet-500">' +
      '<span class="text-slate-400 font-bold">:</span>' +
      '<input data-tf="' + i + ':' + p + 'Sec" type="number" min="0" max="59" value="' + t[p + 'Sec'] + '" placeholder="gi" class="w-full rounded-lg border border-slate-300 px-1 py-1 text-center font-mono text-sm focus:outline-none focus:ring-2 focus:ring-violet-500">' +
      '<button data-tgrab="' + i + ':' + p + '" title="Lấy theo thời gian video" class="shrink-0 bg-violet-600 hover:bg-violet-700 text-white rounded-lg px-2 py-1 text-xs font-bold">⏱ Chốt</button>' +
      '</div></div>';
  }

  // ═══════════════ NỘP BÀI ═══════════════
  function cleanTimers() {
    return state.timers.filter((t) => t.name.trim() || t.sMin !== '' || t.eMin !== '' || t.sSec !== '' || t.eSec !== '');
  }

  function openSubmitModal() {
    if (!state.errors.length) { toast('Chưa có lỗi nào để nộp. Em soi kỹ video nhé!', 'err'); return; }
    const s = $('submitSummary');
    s.innerHTML =
      '<div>👤 Người check: <b>' + escapeHtml(state.student) + '</b>' + (state.myTeam ? ' (' + escapeHtml(state.myTeam) + ')' : '') + '</div>' +
      (state.checkedTeam ? '<div>🎯 Đội được check: <b>' + escapeHtml(state.checkedTeam) + '</b></div>' : '') +
      '<div>🚩 Số lỗi đã bắt: <b>' + state.errors.length + '</b></div>' +
      '<div>⏱ Số bạn có thời gian nói: <b>' + cleanTimers().filter((t) => t.name.trim()).length + '</b></div>' +
      (state.submitted ? '<div class="text-amber-600 font-semibold">⚠ Em đã nộp 1 lần rồi — nộp lại sẽ tạo bản mới.</div>' : '');
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
      toast('App chưa nối Google Sheets — em hãy bấm "Xuất Excel" rồi gửi file cho thầy nhé!', 'err');
      return;
    }
    const btn = $('btnSubmit');
    btn.disabled = true;
    btn.innerHTML = '<i data-lucide="loader" class="w-4 h-4 animate-spin"></i> Đang nộp…';
    refreshIcons();
    try {
      const payload = {
        submittedAt: new Date().toISOString(),
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
      toast('🎉 Nộp bài thành công! Cảm ơn em.');
    } catch (e) {
      toast('Nộp chưa được (' + e.message + '). Em thử lại hoặc bấm Xuất Excel gửi thầy.', 'err');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i data-lucide="send" class="w-4 h-4"></i> Nộp bài';
      refreshIcons();
    }
  }

  // ═══════════════ XUẤT EXCEL (đúng mẫu SPEAKING TEAM CHECK FORM) ═══════════════
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
      ' - ' + (state.student || 'HS') + '.xlsx';
    XLSX.writeFile(wb, name.replace(/[\\/:*?"<>|]/g, ''));
    toast('Đã xuất file Excel ✓');
  }
  function num(v) { return v === '' || v == null ? null : (parseInt(v, 10) || 0); }

  // ═══════════════ TIỆN ÍCH ═══════════════
  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function refreshIcons() { if (window.lucide) lucide.createIcons(); }

  // ═══════════════ KHỞI ĐỘNG ═══════════════
  function initSetupScreen() {
    const info = $('setupInfo');
    const parts = [];
    if (state.topic) parts.push('<div>📚 Chủ đề: <b>' + escapeHtml(state.topic) + '</b></div>');
    if (state.checkedTeam) parts.push('<div>🎯 Đội được check: <b>' + escapeHtml(state.checkedTeam) + '</b></div>');
    if (state.members.length) parts.push('<div>👥 Thành viên: ' + state.members.map(escapeHtml).join(', ') + '</div>');
    if (parts.length) { info.innerHTML = parts.join(''); info.classList.remove('hidden'); }
    if (!state.videoUrl) $('manualVideoWrap').classList.remove('hidden');

    const saved = loadSaved();
    if (saved && saved.student && (saved.errors.length || saved.timers.some((t) => t.name))) {
      $('inpStudent').value = saved.student;
      $('inpMyTeam').value = saved.myTeam || '';
      const hint = $('resumeHint');
      hint.textContent = '💾 Tìm thấy bài đang làm dở của "' + saved.student + '" (' + saved.errors.length + ' lỗi) — sẽ tiếp tục khi bấm Bắt đầu.';
      hint.classList.remove('hidden');
    }
  }

  function start() {
    const name = $('inpStudent').value.trim();
    if (!name) { toast('Em hãy nhập tên của mình nhé!', 'err'); $('inpStudent').focus(); return; }
    if (!state.videoUrl) {
      const u = $('inpVideoUrl').value.trim();
      if (!u) { toast('Em hãy dán link video nhé!', 'err'); $('inpVideoUrl').focus(); return; }
      state.videoUrl = u;
      state.checkedTeam = $('inpCheckedTeam').value.trim() || state.checkedTeam;
    }
    state.student = name;
    state.myTeam = $('inpMyTeam').value.trim();

    // khôi phục bài dở nếu cùng người
    const saved = loadSaved();
    let savedTimers = null;
    if (saved && saved.student === name) {
      state.errors = saved.errors || [];
      savedTimers = saved.timers;
      state.submitted = !!saved.submitted;
      if (state.errors.length) toast('Đã khôi phục ' + state.errors.length + ' lỗi em ghi trước đó ✓', 'info');
    }

    // dựng UI chính
    $('hdStudentName').textContent = state.student;
    $('hdTopic').textContent = state.topic || 'Soi video · bắt lỗi · cùng tiến bộ';
    if (state.checkedTeam) {
      $('hdChecked').textContent = '🎯 ' + state.checkedTeam;
      $('hdChecked').classList.remove('hidden');
    }
    buildStudentField();
    initTimers(savedTimers);
    renderErrors();
    initVideo();

    $('setupScreen').classList.add('hidden');
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
  document.addEventListener('DOMContentLoaded', () => {
    refreshIcons();
    initSetupScreen();
    switchTab('errors');

    $('btnStart').addEventListener('click', start);
    $('inpStudent').addEventListener('keydown', (e) => { if (e.key === 'Enter') start(); });

    document.querySelectorAll('.tabBtn').forEach((b) => b.addEventListener('click', () => switchTab(b.dataset.tab)));

    document.querySelectorAll('.errType').forEach((b) => b.addEventListener('click', () => { fType = b.dataset.type; renderTypeBtns(); }));

    $('btnGrabTime').addEventListener('click', () => {
      const t = getVideoTime();
      if (t == null) { toast('Chưa đọc được thời gian video. Em bấm play video trước nhé!', 'err'); return; }
      const s = Math.floor(t);
      $('fMin').value = Math.floor(s / 60);
      $('fSec').value = s % 60;
      toast('⏱ Đã lấy mốc ' + String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'), 'info');
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
        $('btnAddErrLabel').textContent = 'Lưu thay đổi';
        $('btnCancelEdit').classList.remove('hidden');
        $('fDetail').focus();
      }
      if (del) {
        const i = +del.dataset.del;
        state.errors.splice(i, 1);
        if (editingIndex === i) clearErrForm();
        renderErrors(); autosave();
        toast('Đã xóa lỗi', 'info');
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
        if (t == null) { toast('Chưa đọc được thời gian video. Em bấm play video trước nhé!', 'err'); return; }
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
      const v = prompt('Nhập thời gian hiện tại của video (phút:giây), ví dụ 3:25');
      if (!v) return;
      const m = v.match(/^(\d+)[:.](\d{1,2})$/);
      if (!m) { toast('Định dạng chưa đúng, ví dụ đúng: 3:25', 'err'); return; }
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
