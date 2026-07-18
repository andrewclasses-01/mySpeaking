# GHI CHÚ DỰ ÁN — mySTCheck (SPEAKING TEAM CHECK)

## CHẶNG 1 — 18/07/2026: Khởi tạo app từ file mẫu Excel

### Bối cảnh / yêu cầu
Thầy Andrew muốn 1 app chạy trên trình duyệt, nhiều học sinh dùng cùng lúc, lưu trên GitHub (Pages). App show video thuyết trình speaking (thầy định để trên Google Drive public), học sinh điền tên rồi soi video bắt lỗi. Dữ liệu bắt lỗi phải khớp cấu trúc file mẫu `D:\OTHERS\CLAUDE\FORM SITE\SPEAKING TEAM CHECK FORM.xlsx`:
- Sheet **TIMER**: STT, BẠN, TGIAN BẮT ĐẦU (Phút/Giây), TGIAN KẾT THÚC (Phút/Giây), 6 dòng, kèm DẶN DÒ CỦA THẦY ở A10.
- Sheet **FORM**: PHÚT, GIÂY, ĐOẠN, HS CÓ LỖI, LOẠI LỖI (dropdown: NGỮ PHÁP / PHÁT ÂM / THÔNG TIN), LỖI CỤ THỂ, GIẢI THÍCH LỖI.

### Quyết định kỹ thuật (đã chốt với thầy)
1. **Thu dữ liệu**: Google Sheets qua Apps Script Web App (bài nộp tự đổ vào Sheet của thầy) + nút phụ "Xuất Excel" cho HS tải file .xlsx đúng mẫu.
2. **Video**: thầy hỏi "15 HS cùng lúc thì Drive đọc trực tiếp vào thẻ video được không?" → tư vấn: về số lượt thì được, nhưng (a) file >100MB dính trang quét virus phải đi endpoint không chính thức, (b) Drive không adaptive bitrate nên 15 máy cùng kéo file gốc dễ nghẽn Wi-Fi. → Chốt làm **hỗ trợ cả hai loại link**: YouTube (unlisted, khuyên dùng, timestamp chính xác) và Drive (thử phát trực tiếp, tự fallback iframe + đồng hồ bấm giờ nếu bị chặn).

### Việc đã làm
- Đọc file mẫu bằng openpyxl (đã pip install), lấy đủ: cấu trúc 2 sheet, merged cells, dropdown validation, nguyên văn lời dặn dò A10.
- Dựng app tĩnh tại `D:\APP AND DATA\mySTCheck`:
  - `index.html` — màn hình vào (tên HS, đội; nếu không có link cấu hình thì tự dán link video) → app chính 2 cột: video (sticky) | tabs "Bắt lỗi" và "Thời gian nói". Form lỗi có nút **⏱ Lấy mốc thời gian** tự điền PHÚT/GIÂY theo video; 3 nút LOẠI LỖI 3 màu; danh sách lỗi sửa/xóa được, sắp theo mốc thời gian, đếm theo loại. Tab TIMER: 6 dòng (hoặc theo danh sách thành viên), nút ⏱ Chốt cho bắt đầu/kết thúc từng bạn. Modal xác nhận trước khi nộp. Card DẶN DÒ CỦA THẦY.
  - `js/app.js` — logic thuần JS (IIFE): parse link video, 3 chế độ phát (youtube/html5-drive/stopwatch fallback), autosave localStorage + khôi phục bài dở, nộp bài POST text/plain, xuất Excel SheetJS đúng mẫu (merge y hệt file gốc).
  - `teacher.html` — trang thầy tạo link buổi check: điền link video + chủ đề + đội được check + thành viên → ra link `?d=<base64url>` + QR 160px + nút copy/mở thử.
  - `config.js` — chỗ điền SCRIPT_URL (đang rỗng, chờ thầy deploy Apps Script).
  - `apps-script/Code.gs` — doPost ghi 2 sheet FORM/TIMER trong Google Sheet (tự tạo sheet + header lần đầu), doGet để test; kèm hướng dẫn deploy ngay đầu file.
- UI: Tailwind CDN, font Be Vietnam Pro, icon Lucide, tông indigo/violet gradient, bo góc 2xl/3xl.
- Test trên preview browser (server `mystcheck` port 8123 trong launch.json của D:\OTHERS\CLAUDE):
  - Luồng thủ công: nhập tên + link YouTube → app hiện, player YouTube ready, status "lấy mốc thời gian chính xác" ✓
  - Thêm lỗi → hiện card đúng định dạng, thống kê NGỮ PHÁP: 1, autosave localStorage đủ trường ✓
  - Nút Lấy mốc thời gian → điền 0:00 từ getCurrentTime ✓
  - Xuất Excel (monkeypatch XLSX.writeFile để bắt workbook): 2 sheet TIMER/FORM, 5 merge, header + dữ liệu đúng, tên file "SPEAKING CHECK - TEAM 2 - Minh Anh.xlsx" ✓
  - teacher.html: tạo link + QR, decode lại đúng config có tên tiếng Việt ✓; mở link đó → chủ đề/đội/thành viên hiện ở màn hình vào, HS CÓ LỖI thành dropdown thành viên + CẢ ĐỘI + Bạn khác ✓

### Lỗi đã gặp & cách gỡ
- PowerShell in tiếng Việt từ python bị UnicodeEncodeError (cp1252) → đặt `PYTHONIOENCODING=utf-8` + ghi ra file rồi đọc.
- `computer screenshot` trong preview browser timeout liên tục khi có iframe YouTube → xác minh bằng read_page + javascript_tool thay vì screenshot.
- read_page liệt kê cả phần tử đang `display:none` (khối đồng hồ dự phòng) → tưởng bug hiện nhầm, kiểm tra computed style thì thực ra vẫn ẩn đúng.

## CHẶNG 2 — 18/07/2026: Test video Drive thật (folder lớp B1AH) + thêm Drive API key

### Bối cảnh
Thầy đưa folder Drive thật: 4 video speaking `C0400/02/03/04_CUT.mp4` (~440–580MB/file, MP4 H.264 chuẩn `ftyp isom avc1`), kèm SRT + DS HOC SINH B1AH_18.7.txt. Test app với `C0400_CUT.mp4`.

### Kết quả test & khám phá quan trọng
- App **tự fallback đúng thiết kế**: 2 endpoint download lỗi nhanh (~1-2s) → chuyển iframe preview + đồng hồ; đồng hồ chạy, nút Lấy mốc điền đúng theo đồng hồ. HS vẫn dùng được ngay.
- **Nguyên nhân gốc** (điều tra bằng curl đối chiếu): với file >100MB, Google **nhận diện User-Agent** — cùng URL `drive.usercontent.google.com/download?...&confirm=t`, curl nhận `video/mp4` 206 Range OK, nhưng UA Chrome nhận trang HTML **"Virus scan warning"** → video error code 4 "Format error". Token "Download anyway" theo từng request + CORS chặn đọc HTML → không bypass được thuần client. (Trước giờ tưởng confirm=t là đủ — sai với UA trình duyệt.)
- Preview browser không chặn media cross-origin (test mp4 MDN phát bình thường) — loại trừ nguyên nhân môi trường.

### Việc đã làm
- Thêm `DRIVE_API_KEY` vào config.js; app.js ưu tiên candidate `googleapis.com/drive/v3/files/ID?alt=media&key=…` (đường chính thống, chạy file lớn, hỗ trợ Range) trước 2 endpoint cũ.
- HUONG DAN TRIEN KHAI.md: thêm Bước 1b hướng dẫn tạo Drive API key (enable Drive API, restrict theo referrer github.io + localhost).
- Cập nhật CLAUDE.md phần khám phá kỹ thuật.

## CHẶNG 3 — 18/07/2026: Hoàn thiện hồ sơ bàn giao (đồng bộ 2 máy / session mới)

### Việc đã làm
- Chép file mẫu gốc vào repo: `mau/SPEAKING TEAM CHECK FORM.xlsx` — máy nào cũng có chuẩn đối chiếu khi sửa phần xuất Excel.
- Ghi mục DỮ LIỆU TEST THẬT và mục TIẾP TỤC CÔNG VIỆC (bên dưới) để máy khác/session mới tự đứng dậy làm tiếp không cần hỏi lại.

## CHẶNG 4 — 18/07/2026: Chuyển toàn bộ giao diện sang TIẾNG ANH (English-only)

### Yêu cầu của thầy
"Chuyển toàn bộ giao diện sang tiếng Anh và mặc định chỉ tiếng Anh. Sau đó hiển thị lên để tôi xem và điều chỉnh tiếp." → đây là bước 1, thầy sẽ review rồi chỉnh tiếp.

### Quyết định (hỏi thầy bằng AskUserQuestion, thầy chọn "UI Anh, dữ liệu giữ mẫu cũ")
- Mọi chữ HIỂN THỊ → tiếng Anh (index.html, teacher.html, mọi toast/placeholder/prompt trong app.js).
- **GIỮ tiếng Việt** cho phần DỮ LIỆU khớp mẫu Excel/Google Sheet: giá trị loại lỗi lưu (`NGỮ PHÁP/PHÁT ÂM/THÔNG TIN`), sheet names TIMER/FORM, header (STT, BẠN, PHÚT, GIÂY, LOẠI LỖI...), lời dặn A10.

### Việc đã làm
- `index.html`: `lang="vi"→en`, toàn bộ nhãn/nút/placeholder/màn hình vào/header/tabs/form/modal → tiếng Anh. Loại lỗi hiển thị "✏️ Grammar / 🔊 Pronunciation / 📋 Information" nhưng `data-type` GIỮ tiếng Việt. Xóa CSS class chết `.err-badge-NGỮPHÁP`.
- `js/app.js`: thêm `TYPE_LABEL` + `typeLabel()` để badge/thống kê hiển thị tiếng Anh trong khi `state.errors[].type` vẫn lưu tiếng Việt. Dịch mọi chuỗi UI (status video, toast, prompt đồng hồ, "Section", nút timer "⏱ Mark", START/END, "Whole team"/"Someone else…"). Hàm `exportExcel` thêm comment CẢNH BÁO giữ nguyên tiếng Việt; đổi fallback tên file `HS→Student`.
- `teacher.html`: `lang=en`, toàn bộ tiếng Anh (tiêu đề, nhãn, placeholder, alert, nút Copy/Open, mô tả QR).
- Backup bản trước khi dịch: `Backup/pre-english/` (index.html, teacher.html, app.js).

### Verify (preview browser port 8123 — screenshot vẫn timeout do iframe, dùng read_page + javascript_tool)
- Màn hình vào + app chính: 100% tiếng Anh (read_page liệt kê đủ nhãn Anh).
- Thêm 1 lỗi loại Grammar → badge hiển thị "Grammar", thống kê "Grammar: 1".
- **Monkeypatch XLSX.writeFile bắt workbook**: header TIMER = STT/BẠN/TGIAN BẮT ĐẦU/Phút/Giây; header FORM = PHÚT/GIÂY/ĐOẠN/HS CÓ LỖI/LOẠI LỖI/LỖI CỤ THỂ/GIẢI THÍCH LỖI; dòng lỗi cột LOẠI LỖI = "NGỮ PHÁP" → khớp mẫu 100% dù UI tiếng Anh ✓. Console không lỗi.
- teacher.html: read_page xác nhận toàn tiếng Anh.

### CHỜ THẦY REVIEW & CHỈNH TIẾP (thầy nói "điều chỉnh tiếp")
- Font hiện vẫn Be Vietnam Pro (render tiếng Anh tốt) — chưa đổi, chờ ý thầy nếu muốn font Anh chuẩn (vd Inter).
- Chờ thầy xem tổng thể rồi báo phần cần chỉnh (thầy nói "cần xử lý giao diện và tính năng khá nhiều").

## CHẶNG 5 — 19/07/2026: CHỐT TẦM NHÌN LỚN + fix giao diện điện thoại

### Tầm nhìn thầy chốt (QUAN TRỌNG — định hướng cả dự án)
Thầy muốn nâng mySTCheck từ "web nhỏ cho HS bắt lỗi" thành **hệ thống lo trọn buổi speaking test**, gồm 5 việc: (1) thay khâu tay của skill sapxepspeaking (dọn/tạo thư mục, sao chép & tạo file từ mẫu), (2) trang web cho HS bắt lỗi, (3) push GitHub, (4) thu thập + phân tích dữ liệu, (5) [ĐÍCH CUỐI] trình chiếu video OFFLINE kèm sub + đánh dấu vị trí lỗi.

**Kiến trúc đã chốt (thầy đồng ý):** app gồm 2 phần dùng chung 1 kho dữ liệu:
- **① Phần THẦY = app máy tính (Electron, giống myBoard/myActivity)** — vì chỉ app cài máy mới: dọn/tạo thư mục trên ổ D:, và mở/trình chiếu video 400-600MB offline mượt + chèn sub + đánh dấu lỗi. (Trình duyệt web KHÔNG được phép sờ file local + tải video nặng qua mạng thì lag.)
- **② Phần HỌC SINH = trang web (GitHub Pages)** — chính app hiện tại; HS mở điện thoại bắt lỗi, nộp về Google Sheet.

**Thu dữ liệu (thầy chọn):** Online tự gom — HS bấm Nộp → tự đổ vào 1 Google Sheet (cần deploy Apps Script 1 lần).

**Lộ trình chốt (làm tuần tự 1→2→3→4, mỗi chặng xong xài được ngay):**
- Chặng 1: hoàn thiện phần HS + nối Google Sheet (đang làm).
- Chặng 2: app máy tính — nút "sắp xếp folder + tạo file chấm chéo" (thay khâu tay sapxepspeaking).
- Chặng 3: thu + xem + phân tích dữ liệu HS trong app.
- Chặng 4: trình chiếu video offline + sub + đánh dấu lỗi.

> ⚠ Khi bắt đầu Chặng 2 (app Electron): gọi skill `kienthucbuildapp` + theo quy ước hệ sinh thái (code trên E:\LAP TRINH APP\mySTCheck, bare repo + dữ liệu trên D:\APP AND DATA\mySTCheck, runtime Electron chung). Phần web HS có thể là repo/thư mục con publish GitHub Pages.

### Việc đã làm chặng này (phần web HS — "chuẩn đẹp")
- **Fix giao diện điện thoại**: nút loại lỗi "🔊 Pronunciation" (chữ Anh dài) bị TRÀN trong cột hẹp 1/3 màn 375px (rộng 99px > ô 95px). Sửa class nút loại lỗi → `px-1 text-xs sm:text-sm leading-tight` (điện thoại 12px, desktop ≥640px 14px). Sửa Ở CẢ 2 CHỖ: HTML gốc trong index.html VÀ chuỗi className trong `renderTypeBtns()` của app.js (nếu chỉ sửa 1 chỗ thì bấm chọn loại lỗi sẽ reset về cỡ cũ). Verify: mobile 12px scrollW 91≤95 không tràn; desktop 14px không tràn; không lỗi console; không tràn ngang toàn trang.
- **Cache-busting**: gắn `?v=2` vào `config.js`/`app.js` trong index.html. Lý do: server test (python http.server) + GitHub Pages đều cache JS → sau khi sửa, trình duyệt HS có thể chạy bản CŨ. **MỖI lần sửa app.js/config.js phải TĂNG số v này** (đã ghi comment nhắc trong index.html). (Bẫy đã gặp: force-reload trong preview browser vẫn không nạp app.js mới cho tới khi thêm ?v.)

### Còn treo (phần thầy làm — Chặng 1)
- Thầy deploy Apps Script → lấy SCRIPT_URL điền vào config.js (em đã soạn hướng dẫn từng bước dễ hiểu trong chat + HUONG DAN TRIEN KHAI.md Bước 1). Chưa có URL thì nút Nộp báo dùng Xuất Excel (đúng thiết kế).
- Push GitHub Pages (gh đã login `andrewclasses-code` máy 1) — chờ thầy chốt tên repo + public.
- Gợi ý CHƯA làm (chờ thầy duyệt khi review UI): header trên điện thoại cao 148px (3 dòng wrap) — chưa vỡ nhưng hơi chiếm màn, có thể gọn lại sau.

## DỮ LIỆU TEST THẬT (buổi speaking lớp B1AH, 18/07/2026)
- Folder Drive (public): https://drive.google.com/drive/folders/1eLoEVKvqNGWMAsYkk1U2NtfUfQ_Rmiqe
- 4 video (~440–580MB, MP4 H.264, đều >100MB nên dính chặn UA — xem chặng 2), kèm file SRT cùng tên:
  - `C0400_CUT.mp4` — id `1esxEggI2nZ10EsRBexCsSilBV9PphR9N` (đã dùng test chặng 2)
  - `C0402_CUT.mp4` — id `1bra-fN4fwmHAxGrqWLRq6BFYGxWAfhSQ`
  - `C0403_CUT.mp4` — id `1JrAw8sj3sdkApazLSO_-4eoGgaNBCW25`
  - `C0404_CUT.mp4` — id `1FZCpyGrK0R3D213kqNj1dQAeLRKGa9-X`
- Danh sách đội (file `DS HOC SINH B1AH_18.7.txt` trong folder):
  - T1: HOANG; TIEN
  - T2: NGAN; TRUC
  - T3: DIEM MY; CUONG; KHOI
  - T4: PHONG; HA AN; BAO CHAU
- Link video dán vào app/teacher.html dạng: `https://drive.google.com/file/d/<id>/view`

## TIẾP TỤC CÔNG VIỆC Ở MÁY KHÁC / SESSION MỚI
1. **Thư mục app tự chứa đủ mọi thứ** (D:\ đồng bộ Drive giữa 2 máy): code + hồ sơ + file mẫu (`mau/`) + Apps Script (`apps-script/Code.gs`) + hướng dẫn (`HUONG DAN TRIEN KHAI.md`). Đọc CLAUDE.md + file này trước khi sửa.
2. **Git**: repo thường (không bare) ngay trong thư mục app, nhánh `master`, đã commit đến chặng 3. CHƯA có remote GitHub — thầy chưa xác nhận push (tài khoản `andrewclasses-code`, gh đã đăng nhập trên máy 1; máy 2 muốn push phải `gh auth login`). Lệnh push nằm trong HUONG DAN TRIEN KHAI.md Bước 2.
   ⚠ Vì thư mục đồng bộ qua Drive, KHÔNG làm việc git đồng thời trên 2 máy — chờ Drive đồng bộ xong mới sửa tiếp.
3. **Chạy test**: `python -m http.server 8123 --directory "D:\APP AND DATA\mySTCheck"` → mở http://localhost:8123 (app HS) và /teacher.html (trang thầy). Không cần node/build.
4. **Trạng thái cấu hình**: `config.js` còn 2 chỗ TRỐNG chờ thầy — `SCRIPT_URL` (Apps Script, Bước 1) và `DRIVE_API_KEY` (tùy chọn, Bước 1b). Chưa có SCRIPT_URL thì nút Nộp bài báo hướng dẫn dùng Xuất Excel (đúng thiết kế, không phải bug).
5. **Đã verify**: luồng HS đầy đủ (YouTube + Drive fallback), teacher.html tạo link/QR, xuất Excel đúng mẫu, autosave/khôi phục. **Chưa verify**: nộp bài end-to-end vào Google Sheet (chờ SCRIPT_URL), Drive API key với file lớn (chờ key), giao diện điện thoại.

### VIỆC ĐANG CHỜ
1. **Thầy deploy Apps Script** (theo `HUONG DAN TRIEN KHAI.md` hoặc đầu file `apps-script/Code.gs`): tạo Google Sheet nhận bài → dán ID vào Code.gs → deploy Web App (Execute as Me / Anyone) → dán URL `/exec` vào `SCRIPT_URL` trong `config.js`. Khi chưa có URL này, nút Nộp bài sẽ báo dùng Xuất Excel thay thế.
2. **Push GitHub + bật Pages** (tài khoản `andrewclasses-code` đã đăng nhập gh trên máy này) — đang chờ thầy đồng ý tên repo/công khai.
3. ~~Test thật với 1 video Drive lớn~~ → ĐÃ TEST chặng 2 (fallback OK). Còn chờ: thầy tạo DRIVE_API_KEY (Bước 1b) rồi test lại đường phát trực tiếp qua Drive API với video >100MB.
4. Test trên điện thoại (layout đã responsive nhưng chưa soi kỹ màn nhỏ).
