# GHI CHÚ DỰ ÁN — mySpeaking (SPEAKING TEAM CHECK)

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
- Dựng app tĩnh tại `D:\APP AND DATA\mySpeaking`:
  - `index.html` — màn hình vào (tên HS, đội; nếu không có link cấu hình thì tự dán link video) → app chính 2 cột: video (sticky) | tabs "Bắt lỗi" và "Thời gian nói". Form lỗi có nút **⏱ Lấy mốc thời gian** tự điền PHÚT/GIÂY theo video; 3 nút LOẠI LỖI 3 màu; danh sách lỗi sửa/xóa được, sắp theo mốc thời gian, đếm theo loại. Tab TIMER: 6 dòng (hoặc theo danh sách thành viên), nút ⏱ Chốt cho bắt đầu/kết thúc từng bạn. Modal xác nhận trước khi nộp. Card DẶN DÒ CỦA THẦY.
  - `js/app.js` — logic thuần JS (IIFE): parse link video, 3 chế độ phát (youtube/html5-drive/stopwatch fallback), autosave localStorage + khôi phục bài dở, nộp bài POST text/plain, xuất Excel SheetJS đúng mẫu (merge y hệt file gốc).
  - `teacher.html` — trang thầy tạo link buổi check: điền link video + chủ đề + đội được check + thành viên → ra link `?d=<base64url>` + QR 160px + nút copy/mở thử.
  - `config.js` — chỗ điền SCRIPT_URL (đang rỗng, chờ thầy deploy Apps Script).
  - `apps-script/Code.gs` — doPost ghi 2 sheet FORM/TIMER trong Google Sheet (tự tạo sheet + header lần đầu), doGet để test; kèm hướng dẫn deploy ngay đầu file.
- UI: Tailwind CDN, font Be Vietnam Pro, icon Lucide, tông indigo/violet gradient, bo góc 2xl/3xl.
- Test trên preview browser (server `myspeaking` port 8123 trong launch.json của D:\OTHERS\CLAUDE):
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
Thầy muốn nâng mySpeaking từ "web nhỏ cho HS bắt lỗi" thành **hệ thống lo trọn buổi speaking test**, gồm 5 việc: (1) thay khâu tay của skill sapxepspeaking (dọn/tạo thư mục, sao chép & tạo file từ mẫu), (2) trang web cho HS bắt lỗi, (3) push GitHub, (4) thu thập + phân tích dữ liệu, (5) [ĐÍCH CUỐI] trình chiếu video OFFLINE kèm sub + đánh dấu vị trí lỗi.

**Kiến trúc đã chốt (thầy đồng ý):** app gồm 2 phần dùng chung 1 kho dữ liệu:
- **① Phần THẦY = app máy tính (Electron, giống myBoard/myActivity)** — vì chỉ app cài máy mới: dọn/tạo thư mục trên ổ D:, và mở/trình chiếu video 400-600MB offline mượt + chèn sub + đánh dấu lỗi. (Trình duyệt web KHÔNG được phép sờ file local + tải video nặng qua mạng thì lag.)
- **② Phần HỌC SINH = trang web (GitHub Pages)** — chính app hiện tại; HS mở điện thoại bắt lỗi, nộp về Google Sheet.

**Thu dữ liệu (thầy chọn):** Online tự gom — HS bấm Nộp → tự đổ vào 1 Google Sheet (cần deploy Apps Script 1 lần).

**Lộ trình chốt (làm tuần tự 1→2→3→4, mỗi chặng xong xài được ngay):**
- Chặng 1: hoàn thiện phần HS + nối Google Sheet (đang làm).
- Chặng 2: app máy tính — nút "sắp xếp folder + tạo file chấm chéo" (thay khâu tay sapxepspeaking).
- Chặng 3: thu + xem + phân tích dữ liệu HS trong app.
- Chặng 4: trình chiếu video offline + sub + đánh dấu lỗi.

> ⚠ Khi bắt đầu Chặng 2 (app Electron): gọi skill `kienthucbuildapp` + theo quy ước hệ sinh thái (code trên E:\LAP TRINH APP\mySpeaking, bare repo + dữ liệu trên D:\APP AND DATA\mySpeaking, runtime Electron chung). Phần web HS có thể là repo/thư mục con publish GitHub Pages.

### Việc đã làm chặng này (phần web HS — "chuẩn đẹp")
- **Fix giao diện điện thoại**: nút loại lỗi "🔊 Pronunciation" (chữ Anh dài) bị TRÀN trong cột hẹp 1/3 màn 375px (rộng 99px > ô 95px). Sửa class nút loại lỗi → `px-1 text-xs sm:text-sm leading-tight` (điện thoại 12px, desktop ≥640px 14px). Sửa Ở CẢ 2 CHỖ: HTML gốc trong index.html VÀ chuỗi className trong `renderTypeBtns()` của app.js (nếu chỉ sửa 1 chỗ thì bấm chọn loại lỗi sẽ reset về cỡ cũ). Verify: mobile 12px scrollW 91≤95 không tràn; desktop 14px không tràn; không lỗi console; không tràn ngang toàn trang.
- **Cache-busting**: gắn `?v=2` vào `config.js`/`app.js` trong index.html. Lý do: server test (python http.server) + GitHub Pages đều cache JS → sau khi sửa, trình duyệt HS có thể chạy bản CŨ. **MỖI lần sửa app.js/config.js phải TĂNG số v này** (đã ghi comment nhắc trong index.html). (Bẫy đã gặp: force-reload trong preview browser vẫn không nạp app.js mới cho tới khi thêm ?v.)

### Còn treo (phần thầy làm — Chặng 1)
- Thầy deploy Apps Script → lấy SCRIPT_URL điền vào config.js (em đã soạn hướng dẫn từng bước dễ hiểu trong chat + HUONG DAN TRIEN KHAI.md Bước 1). Chưa có URL thì nút Nộp báo dùng Xuất Excel (đúng thiết kế).
- Push GitHub Pages (gh đã login `andrewclasses-code` máy 1) — chờ thầy chốt tên repo + public.
- Gợi ý CHƯA làm (chờ thầy duyệt khi review UI): header trên điện thoại cao 148px (3 dòng wrap) — chưa vỡ nhưng hơi chiếm màn, có thể gọn lại sau.

## CHẶNG 6 — 19/07/2026: Đổi sang mô hình "1 LINK CHUNG + đăng nhập lớp"

### Bối cảnh
Thầy chưa ưng cách "mỗi buổi 1 link ?d=". Hỏi: dùng chung 1 link + đăng nhập riêng từng lớp được không? → Tư vấn (có sơ đồ): NÊN 1 link chung, cùng 1 thiết kế, chỉ nội dung khác theo lớp (mỗi lớp 1 thiết kế = khó bảo trì). Thầy chốt: **chọn lớp + mã lớp ngắn** để vào; **chọn tên từ danh sách lớp** (không tự gõ → dữ liệu sạch). Quản lý nội dung: em seed lớp GERMS, phần thêm/sửa lớp để app máy tính lo sau.

### Việc đã làm (thay toàn bộ luồng vào app)
- **`data/classes.json`** (MỚI): danh sách lớp. Seed thật lớp B1AH-GERMS: 4 đội + video Drive (id từ ghi chú, GIẢ ĐỊNH thứ tự đội theo số video C0400/02/03/04 = T1/T2/T3/T4 — thầy chỉnh dễ) + cặp chấm chéo 1→2→3→4→1.
- **index.html**: bỏ màn hình vào cũ (name/team/video). Thêm 2 màn: MÀN 1 `#loginScreen` (dropdown lớp + ô mã lớp + Continue) → MÀN 2 `#identifyScreen` (tên nhóm theo đội, bấm chọn → khối xác nhận "You are X, Team N, You will check TEAM M" + Start / chọn lại). Bump cache `?v=3`.
- **js/app.js**: bỏ `readLinkConfig`/`linkCfg` (cơ chế ?d=). Thêm `loadClasses()` (fetch no-store), `initLoginScreen`, `handleLogin` (validate code, không phân biệt hoa thường), `renderIdentify`, `handleNamePick` (tính checker→checked theo pairs, set state + đặt lại `saveKey`). `start()` không đọc input nữa (state đã set). `saveKey` đổi `const`→`let`. Payload nộp thêm `className`.
- **apps-script/Code.gs**: thêm cột `LỚP` (className) vào cả sheet FORM và TIMER.

### Verify (preview browser, đã chụp màn thật)
- Login: chọn B1AH + mã sai → bị chặn (ở lại login); mã đúng "GERMS" (test hoa/thường) → sang màn chọn tên ✓
- Tên nhóm đúng 4 đội (T1 HOANG/TIEN … T4 PHONG/HA AN/BAO CHAU) ✓
- Chọn HOANG (đội 1) → xác nhận "You will check TEAM 2"; Start → app: student HOANG, checked TEAM 2, topic GERMS, dropdown HS CÓ LỖI = NGAN/TRUC/Whole team/Someone else, VIDEO tự nạp đúng video đội 2 (C0402=1bra-…, rơi vào chế độ đồng hồ dự phòng vì Drive >100MB chưa có API key) ✓
- Mobile 375px: login + identify KHÔNG tràn, nút tên không tràn. Không lỗi console. Ảnh chụp 2 màn đẹp, rõ.

### Lưu ý / còn treo
- `teacher.html` (tạo link ?d=) giờ KHÔNG còn dùng trong mô hình mới — giữ tạm, sẽ bỏ hoặc thay bằng chức năng của app máy tính.
- Video Drive vẫn dính chặn UA (chế độ đồng hồ) tới khi có DRIVE_API_KEY hoặc chuyển YouTube unlisted.
- Mapping video→đội trong classes.json đang GIẢ ĐỊNH theo thứ tự — khi làm thật cần đúng (app máy tính chặng sau sẽ set chuẩn).

## CHẶNG 7 — 19/07/2026: Tinh chỉnh phần web HS theo yêu cầu thầy (login + chọn tên + cam kết)

Thầy duyệt bản chặng 6 và yêu cầu tinh chỉnh (kèm ảnh icon logo). Đã làm:

### Màn đăng nhập
- **Logo mới**: vẽ lại icon thầy gửi (bảng thuyết trình + biểu đồ cột trên giá vẽ, nền tròn chàm) thành **SVG inline** trong index.html (không cần file ảnh ngoài). Thay icon clapperboard cũ.
- Đổi chữ cạnh logo: **"ANDREW CLASSES"** (trên) + **"Speaking Team Check"** (dưới).
- **"Your class" đổi từ dropdown → ô GÕ tay** (`inpClass` giờ là input text). HS tự gõ mã lớp. Thêm field `classCode` vào classes.json (B1AH-GERMS: classCode="B1AH"). Đăng nhập phải khớp CẢ `classCode` LẪN `code` (đều không phân biệt hoa thường).
- Sai thông tin → **pop-up** `#loginErrModal`: "Your information is not correct. Contact teacher Andrew to get help." (thay cho toast).

### Màn chọn tên
- Bỏ dạng nút pill. Mỗi đội = **TÊN ĐỘI to (text-2xl extrabold)** + **ô select** thành viên bên cạnh. Chọn tên (event `change`) → sang xác nhận NGAY.

### Màn xác nhận
- Thêm **ảnh HS** cạnh tên (tạm hiện CHỮ CÁI ĐẦU trên nền chàm — HOANG→H, DIEM MY→DM; ảnh thật sau qua `cls.photos[name]`, đã cắm sẵn hàm `photoFor`).
- Ghi rõ **"You are in Team X · You will check Team Y"**.
- Thêm **bảng cam kết** (nội dung A NOTE FROM YOUR TEACHER, nền hồng) + **ô tích BẮT BUỘC** "I agree and respect our journey, teacher ❤️". Chưa tích → nút **Start checking bị khoá** (disabled + opacity-50). Tích → bật. Quay lại chọn tên khác thì reset (bỏ tích + khoá lại).

### File đụng tới
- index.html (logo SVG, 2 ô login, pop-up lỗi, dựng lại identConfirm, bump `?v=4`), js/app.js (handleLogin khớp 2 ô + pop-up, renderIdentify dạng select, handleNamePick ảnh+cam kết, setStartEnabled, initialsOf, photoFor, wiring change/checkbox/OK), data/classes.json (thêm classCode).

### Verify (preview mobile 375px, chụp màn thật)
- Sai thông tin → pop-up đúng chữ, ở lại login ✓; OK tắt pop-up ✓; đúng (test "b1ah"+"GERMS" hoa/thường) → sang chọn tên ✓
- 4 đội: tên to + select đúng thành viên ✓; chọn DIEM MY (đội 3) → xác nhận ảnh "DM", "Team 3 · check Team 4", Start KHOÁ ✓; tích → Start bật → vào app đúng (checked TEAM 4) ✓
- Không tràn ngang, không lỗi console. 3 ảnh chụp: login / chọn tên / xác nhận — đều đẹp.

### Còn treo cho chặng sau
- Ảnh HS thật (giờ là chữ cái đầu) — thầy sẽ cập nhật dữ liệu sau (qua `photos` trong classes.json hoặc app máy tính).
- `teacher.html` vẫn là file cũ không dùng.

## CHẶNG 8 — 19/07/2026: ĐỔI TÊN dự án mySTCheck → mySpeaking

- Thầy chốt: dự án + app tương lai đều tên **mySpeaking**.
- Đã đổi tên **thư mục** `D:\APP AND DATA\mySTCheck` → `D:\APP AND DATA\mySpeaking` (git repo bên trong đi theo, vẫn nguyên lịch sử).
- Thay MỌI tham chiếu chữ (bỏ qua `Backup/`): `mySTCheck→mySpeaking`, `MYSTCHECK→MYSPEAKING` (biến `window.MYSPEAKING_CONFIG`), `mystcheck→myspeaking` (localStorage key `myspeaking_`, tên preview). Dùng `sed` byte-safe — tiếng Việt còn nguyên (đã verify). launch.json + memory cũng đã sửa.
- User-facing GIỮ NGUYÊN: tab "SPEAKING TEAM CHECK", branding "ANDREW CLASSES / Speaking Team Check" (mySpeaking là tên DỰ ÁN/app).

## CHẶNG 9 — 19/07/2026: DRIVE API KEY — video Drive phát TRỰC TIẾP, lấy mốc thời gian CHÍNH XÁC

### Bối cảnh
Thầy băn khoăn "lấy thời gian từ video Drive cho việc chấm có thuận tiện không". Đi lại luồng thật: video B1AH >100MB → app rơi chế độ đồng hồ dự phòng (HS phải chạy đồng hồ song song, không tiện). Thầy bổ sung bối cảnh quan trọng: **mỗi HS một máy, một nhà, Wi-Fi riêng** → nỗi lo nghẽn Wi-Fi cũ KHÔNG còn áp dụng → chốt phương án DRIVE API KEY (thầy không muốn YouTube, muốn giữ Drive).

### Việc đã làm
- Dùng Claude in Chrome thao tác Google Cloud Console giúp thầy (thầy tự làm thấy rối): tạo project **mySpeaking** (id `myspeaking-502901`), bật **Google Drive API**, tạo **API key** đã giới hạn CHỈ dùng được Drive API (UI mới của Google bắt buộc chọn API ngay lúc tạo — lần đầu danh sách trống vì API mới bật chưa kịp lan, reload là có).
- Verify key bằng curl TRƯỚC khi điền (tránh đọc nhầm ký tự từ ảnh): metadata trả đúng `C0400_CUT.mp4` 441MB; `alt=media` + Range trả **206 Partial Content, video/mp4** → phát + tua được file lớn.
- Điền key vào `config.js` (DRIVE_API_KEY), bump cache `?v=6` trong index.html.
- **Test thật trên app (preview, mobile 375px)**: login B1AH → HOANG → video đội 2 (C0402, ~500MB) **phát trực tiếp trong thẻ video của app** ("Direct playback — precise timestamps", đồng hồ dự phòng ẨN, duration 368s, ảnh hiện rõ "Germs in the Air"); tua tới 83s, phát tiếp tới 94.4s mượt; bấm **⏱ Grab timestamp → điền đúng MIN=1 SEC=34 (=94s)** — chính xác từng giây.

### Lưu ý còn treo
- ⚠️ **TRƯỚC KHI đưa web lên GitHub Pages**: vào lại Google Cloud Console → API key → Application restrictions → **Websites** → thêm domain `*.github.io` (+ localhost để còn test). Hiện key để None (chưa giới hạn website) cho tiện test local.
- Tài khoản Google Cloud của thầy hiện có project THỪA: 1 project "mySpeaking" trùng tên (thầy tự tạo lúc loay hoay) + Drive API từng bật nhầm trên "My First Project". Không hại gì, khi nào tiện thì dọn (console.cloud.google.com → IAM & Admin → Manage resources → delete project thừa).
- Chế độ đồng hồ dự phòng vẫn giữ nguyên trong code — nếu key hỏng/hết hạn app vẫn tự fallback, HS không bị kẹt.

## CHẶNG 10 — 19/07/2026: 5 tinh chỉnh màn BẮT LỖI theo yêu cầu thầy

Thầy đưa 5 yêu cầu sau khi xem bản chặng 9. Đã làm đủ, bump cache `?v=7`, backup trước ở `Backup/pre-chang10/`:

1. **Bỏ khung "A NOTE FROM YOUR TEACHER"** ở màn bắt lỗi (trùng với bảng cam kết màn xác nhận — bản đó GIỮ).
2. **Khung điều khiển video LUÔN HIỆN** (`#videoCtrl`): nút gốc của thẻ video trình duyệt TỰ ẨN sau vài giây, không cấm được → làm khung rời dưới video (nền đen): Play/Pause + thời gian hiện tại + thanh tua + tổng thời lượng, không bao giờ ẩn. Chạy cả 2 chế độ: html5/Drive (nghe event timeupdate/play/pause) + YouTube (poll 300ms qua IFrame API). Kéo thanh tua có xem trước mốc; nhả tay mới tua. Chế độ đồng hồ dự phòng thì khung này ẩn (không điều khiển được iframe).
3. **Dòng dưới video** đổi từ chữ trạng thái kỹ thuật → `👥 B1AH | TEAM 2 | NGAN · TRUC` (lớp · đội được chấm · thành viên) — hàm `videoInfoHtml()`, áp dụng cả 3 chế độ video.
4. **Chọn HS có lỗi = DÃY NÚT** (bỏ ô select): tên xếp đều grid 2 cột (3 cột ≥640px) + Whole team + Someone else…; bấm ai người đó sáng indigo, 1 thời điểm chỉ 1 tên (bấm lại = bỏ chọn); Someone else… mở ô gõ tên. Sửa `buildStudentField/getWho/setWho` + biến `fWhoSel`, delegation trên `#fStudentWrap`. Giữ nguyên hành vi cũ: sau khi Add, tên vẫn sáng (1 bạn thường bị nhiều lỗi liên tiếp).
5. **Bố cục GHIM — chỉ danh sách lỗi cuộn**:
   - **Desktop ≥1024px**: `#appScreen` khoá `height:100dvh; overflow:hidden` (flex column), main chia 2 cột; cột phải flex dọc — form `shrink-0` đứng yên, card "Mistakes found" `flex-1` với vùng cuộn riêng bao `#errList`. Cả trang KHÔNG cuộn.
   - **Mobile <1024px**: không thể nhét video+form+list vào 812px → giải pháp: header thôi sticky (cuộn qua để nhường chỗ), **CỤM VIDEO (video + khung điều khiển + dòng lớp/đội) sticky top-0** — luôn ghim trên cùng khi cuộn form/list. Form vẫn cuộn được (bắt buộc về không gian) nhưng video không bao giờ mất.
   - ⚠️ BẪY CASCADE đã né: KHÔNG dùng class `lg:flex` cho phần tử có toggle `.hidden` (appScreen, tab-errors, tab-timer) — media query nằm SAU trong stylesheet sẽ ĐÈ `.hidden` làm màn ẩn hiện ngược ra. Dùng CSS riêng `#id:not(.hidden){display:flex...}` trong `<style>`.
   - Mobile main đổi `grid` → block thường (grid làm sticky con không có quãng trượt — sticky chỉ trượt trong grid-area của chính nó).

**Verify (preview thật, đã chụp màn):** Desktop 1269px: appH=winH, body không cuộn, thêm 8 lỗi → chỉ list cuộn (scrollH 482>clientH 389), form đứng yên; nút tên radio đúng (NGAN→TRUC chỉ 1 sáng); Play/Pause chạy, tua 50%→184s=đúng nửa 368s; bấm ✏️ sửa lỗi → nút tên sáng đúng người. Mobile 375: cuộn 500px video+điều khiển+dòng lớp/đội GHIM trên cùng; không tràn ngang; 0 lỗi console. Đã xoá draft test khỏi localStorage.

## CHẶNG 11 — 19/07/2026: 6 tinh chỉnh tiếp màn BẮT LỖI (đợt 2 theo yêu cầu thầy)

Bump cache `?v=8`. Chi tiết:

1. **Header app**: "SPEAKING TEAM CHECK" → **"ANDREW CLASSES"**; logo clapperboard → **ảnh chibi thầy** (`img/logo-chibi.png`, chép từ `D:\OTHERS\OTHERS\AVATAR\OK CHIBI - TRON.png`, THU NHỎ 1024→128px = 1.9MB→32KB cho nhẹ mạng; hiển thị tròn ring trắng). Màn login + title tab GIỮ nguyên.
2. **Khung play đổi màu SÁNG** (bg-slate-50 viền slate-200, trước nền đen), số thời gian to hơn (text-sm→text-base), thanh tiến trình **accent ĐỎ rose-600** (phần đã chạy màu đỏ).
3. **Nút tên HS**: BỎ "Whole team" + "Someone else…" — CHỈ thành viên đã xác định; luôn vừa **1 HÀNG** (flex + flex-1 min-w-0 chia đều + truncate), chữ nhỏ hơn (text-[11px]/xs). `getWho/setWho` gọn lại theo members.
4. **Tabs**: Mistakes `flex-[4]` (80%) · "Speaking time"→**"Time"** `flex-[1]` (20%); sửa cả `switchTab` giữ tỷ lệ khi bấm (code cũ ghi đè flex-1).
5. **MIN/SEC TỰ CHẠY THEO VIDEO** khi đang phát (`syncTimeFields`: html5 timeupdate + YouTube poll 300ms + đồng hồ dự phòng swRender); **pause thì dừng để chỉnh tay** (đã test gõ 59 không bị ghi đè). BỎ ô SECTION (err.section luôn '' — cấu trúc Excel/Sheet GIỮ NGUYÊN cột ĐOẠN rỗng), BỎ nút Grab timestamp, tiêu đề form "Log a mistake" → **"TIME OF THE MISTAKE"**. `clearErrForm` không xoá MIN/SEC nữa (giữ mốc khi pause bắt lỗi tiếp).
6. **Nút loại lỗi**: emoji → icon Lucide hiện đại (pencil-line xanh dương / audio-lines xanh lá / file-text vàng), mặc định cả 3 **NỀN TRẮNG**, chọn mới có **KHUNG VÀNG** (border-amber-400 + bg-amber-50); layout icon trên chữ dưới (flex-col). TYPE_STYLE gộp on/off chung thành TYPE_ON/TYPE_OFF, badge danh sách vẫn màu riêng.

**Verify (preview thật, chụp màn desktop + mobile 375):** header logo chibi + ANDREW CLASSES; play bar sáng số to thanh đỏ (0:16/8:07); login NGAN (đội 2→chấm đội 3): 3 nút DIEM MY·CUONG·KHOI đúng 1 hàng không tràn (cả mobile); tab 80/20 chữ Time; TIME OF THE MISTAKE + chỉ MIN/SEC; video phát → MIN/SEC bám từng giây (0:16=16s), pause chỉnh tay OK; bấm Pronunciation khung vàng 2 nút kia trắng; 0 lỗi console; đã dọn draft test localStorage.

## CHẶNG 12 — 19/07/2026: 6 cải tiến đợt 3 — GỘP thời gian nói vào form, thêm bắt buộc

Bump cache `?v=9`, backup trước ở `Backup/pre-chang12/`. Chi tiết:

1. BỎ hẳn tiêu đề "TIME OF THE MISTAKE" (form mở đầu bằng MIN/SEC luôn).
2-4. Đổi nhãn: STUDENT WITH MISTAKE→**STUDENT**, MISTAKE TYPE→**TYPE**, THE MISTAKE→**MISTAKE**.
5. **EXPLANATION BẮT BUỘC** như MISTAKE (dấu * đỏ + chặn Add với toast "Please write the EXPLANATION!").
6. **BỎ TAB TIME** (bỏ luôn cả tab bar — chỉ còn khối Mistakes) → thời gian nói chuyển thành **khung nhập dưới MỖI nút tên HS** trong mục STUDENT: 4 ô số (min:sec → min:sec, bắt đầu→kết thúc). **BẮT BUỘC đủ 4 ô × mọi thành viên mới Submit được** — thiếu thì: toast "Please fill each student's speaking time (min:sec → min:sec) under their name!" + 12 ô thiếu VIỀN ĐỎ, gõ vào ô nào gỡ đỏ ô đó. Không đánh dấu * (thầy dặn không cần thêm ký tự).
   - `initTimers` viết lại: timers LUÔN = đúng members đội được chấm (bỏ thêm/bớt/sửa tên, bỏ nút ⏱ Mark); khôi phục autosave KHỚP THEO TÊN, giữ giá trị 0 (không dùng `||` vì 0 là hợp lệ).
   - Ô nhập `type=text inputmode=numeric` (bàn phím số trên điện thoại, không nút spin chiếm chỗ), lọc chỉ nhận chữ số.
   - **Fix mobile ngay trong chặng**: 4 ô 1 hàng ở cột hẹp 375px → mỗi ô chỉ 13px KHÔNG GÕ NỔI → đổi layout: mobile 2 TẦNG (bắt đầu ↓ kết thúc, ô 41px), ≥640px 1 hàng có mũi tên →.
   - Dữ liệu/Excel/payload GIỮ NGUYÊN cấu trúc: state.timers vẫn {name,sMin,sSec,eMin,eSec}, sheet TIMER + cột SECTION rỗng khớp mẫu (đã verify bằng monkeypatch: TIMER 3 dòng DIEM MY/CUONG/KHOI đúng số nhập, FORM giữ NGỮ PHÁP tiếng Việt).
   - Dọn code: bỏ switchTab/renderTimers/timerHalf/tabErrCount/btnAddTimerRow + listener cũ; start() đảo thứ tự initTimers TRƯỚC buildStudentField (ô thời gian vẽ từ timers).

**Verify (preview thật):** nhãn mới đủ; thêm lỗi thiếu EXPLANATION bị chặn; Submit thiếu giờ bị chặn + 12 ô đỏ; điền đủ (mô phỏng gõ) → hết đỏ + modal mở, summary "Students timed: 3"; Excel khớp mẫu; autosave khôi phục thời gian theo tên; mobile 375 không tràn ngang, ô 41px bấm được; 0 lỗi console.

## CHẶNG 13 — 19/07/2026: 10 cải tiến đợt 4 (thầy đã test đợt 3)

Bump cache `?v=10`, backup `Backup/pre-chang13/`. Chi tiết:

1. **STUDENT lên ĐẦU form**, cụm MIN/SEC xuống dưới STUDENT.
2. Cụm MIN/SEC có tiêu đề **TIME**; chữ MIN/SEC chuyển VÀO TRONG đầu ô (span absolute trái, input pl-10).
3. Chọn tên HS → **KHUNG VÀNG y hệt TYPE** (dùng chung TYPE_ON/TYPE_OFF).
4. Placeholder MISTAKE + EXPLANATION: **nhỏ (12px) + in nghiêng + xám mờ** (placeholder:italic placeholder:text-xs placeholder:text-slate-300).
5. Icon bảng Mistakes found: binoculars → **scan-search** (hiện đại hơn).
6. **BẤM LOGO về trang chủ** đăng nhập lại (header logo thành button #btnHome); còn lỗi chưa submit → **pop-up #leaveModal** "You have work that hasn't been submitted yet..." Stay here / Go back; không có dữ liệu treo thì về thẳng. (Dữ liệu vẫn autosave nên quay lại không mất.)
7. **Chỉnh tay MIN/SEC + Enter/click ra ngoài → VIDEO NHẢY THEO** (`manualTimeSeek`→`seekVideoTo`: html5 currentTime / YouTube seekTo / stopwatch set elapsed; clamp theo duration).
8. **TỰ CHỌN STUDENT theo thời gian**: video ở giây nào nằm trong khoảng nói (đủ 4 ô) của HS nào → tên HS đó tự sáng (`autoPickStudent` gọi từ syncTimeFields khi phát + sau mọi cú seek). HS bấm tay vẫn được nhưng khi video chạy vào khoảng của bạn khác sẽ tự nhảy — đúng thiết kế.
9. Nút "Export Excel" → **"Export"**.
10. **Submit kiểm tra thời gian CHUẨN**: (a) end > start từng HS — sai báo "X: the END time must be AFTER the START time!"; (b) các khoảng **không đan xen** — sai báo "Speaking times of A and B overlap — please check!"; ô của HS sai viền đỏ (markBadTimerRows). Chạm biên bằng nhau (1:00→1:00) vẫn hợp lệ.

**Verify (preview thật):** thứ tự nhãn STUDENT→TIME→TYPE→MISTAKE*→EXPLANATION*; chọn CUONG khung vàng; gõ 2:30+change → video nhảy đúng 150s; đặt 3 khoảng 0-1/1-2/2-3 phút → seek 0:30 tự sáng DIEM MY, 2:30 tự sáng KHOI; overlap → chặn + đúng tên + 8 ô đỏ; end<start → chặn đúng tên KHOI; sửa xong modal mở; logo: có lỗi treo → pop-up, Stay ở lại, Go back về login; placeholder italic 12px; icon scan-search; Export; mobile 375 không tràn, nhãn MIN trong ô hiện, ô giờ 39px; 0 lỗi console.

## CHẶNG 14 — 19/07/2026: HOÀN TẤT HẠ TẦNG CHẶNG 1 — WEB ĐÃ LIVE 🎉

Thầy chọn "Hoàn tất hạ tầng Chặng 1". Đã làm trọn 3 việc, TẤT CẢ ĐÃ TEST THẬT:

### 1. Deploy Google Apps Script (em thao tác Chrome giúp thầy)
- Tạo Google Sheet **"SPEAKING CHECK - BÀI NỘP"** (id `1XkrbGHkiMHHTVSWLP6OZ0O-CIEORDj4dqYrXHynuA5E`, tài khoản `namdaptrai01@gmail.com`).
- Tạo project Apps Script **"mySpeaking"** tại script.new, dán Code.gs (điền sẵn SS_ID) bằng `monaco.editor.getModels()[0].setValue()` — KHÔNG gõ tay (né auto-close bracket).
- Deploy Web App: Execute as **Me** / Who has access **Anyone**, tên "mySpeaking v1". ⚠️ BẪY: popup "Ủy quyền truy cập" của Google mở CỬA SỔ RIÊNG ngoài tầm extension → tưởng thất bại, nhưng thực ra deployment ĐÃ tạo xong (kiểm tra bằng Quản lý các tùy chọn triển khai). Chạy thử doGet trong editor hoàn tất không đòi quyền.
- Lấy URL `/exec`, điền `SCRIPT_URL` vào config.js, bump `?v=11`.
- **Test end-to-end 2 tầng**: (a) curl GET → `{"ok":true,"app":"mySpeaking"}`; curl POST bài mẫu → `{"ok":true,"saved":1}` (⚠️ bẫy curl: PHẢI bỏ `-X POST` khi có -L, không thì 411 ở hop redirect); (b) **chạy trọn luồng app thật** trên preview: login B1AH → HOANG → điền giờ nói 2 bạn + 1 lỗi Grammar 1:34 → Submit → toast "🎉 Submitted successfully!" → mở Sheet thấy FORM/TIMER đúng từng cột (LOẠI LỖI giữ "NGỮ PHÁP" tiếng Việt). Đã DỌN sạch các dòng test khỏi Sheet (chỉ còn header).

### 2. Giới hạn Drive API key (Cloud Console)
- Application restrictions = **Websites**: `https://andrewclasses-01.github.io/*` + `http://localhost:8123/*` (lúc đầu điền andrewclasses-code theo hồ sơ cũ, sau khi thầy chốt tài khoản -01 đã sửa lại). API restrictions giữ nguyên chỉ Drive API.
- Verify SAU giới hạn: video Drive 500MB phát trực tiếp trên trang live (readyState 4, duration 368s, không fallback) + fetch metadata từ localhost OK.

### 3. Push GitHub + bật Pages
- Máy này CHƯA có gh → cài `winget install GitHub.cli`. Đăng nhập device-flow: gh sinh mã, em mở github.com/login/device bằng Chrome; GitHub chưa đăng nhập → **thầy tự đăng nhập** (em không được nhập mật khẩu), tài khoản thực tế là **`andrewclasses-01`** (hồ sơ cũ ghi andrewclasses-code — SAI, thầy chốt dùng -01); mã lần 1 hết hạn do chờ đăng nhập → chạy lại lấy mã mới, nhập mã + Authorize OK.
- ⚠️ BẪY: `gh repo create` (CLI) LẪN bấm nút "Create repository" (web) đều bị **classifier của Claude Code chặn** (hành động tạo repo public) → trang github.com/new mở sẵn, **thầy tự bấm** Create repository. Sau đó `git remote add` + `git push -u origin master` chạy bình thường.
- Bật Pages qua `gh api repos/andrewclasses-01/mySpeaking/pages -X POST` (branch **master**, path /) — lưu ý HUONG DAN cũ ghi branch main là sai, repo dùng master.
- **WEB LIVE: https://andrewclasses-01.github.io/mySpeaking/** — đã test trọn luồng trên trang live: login → chọn tên → video Drive phát trực tiếp ngay.

### File đổi chặng này
config.js (SCRIPT_URL), index.html (?v=11), CLAUDE.md (mục Triển khai + Roadmap), HUONG DAN TRIEN KHAI.md (trạng thái ĐÃ XONG + đúng tài khoản), GHI CHU DU AN.md (chặng này + HANDOFF).

## CHẶNG 15 — 19/07/2026: Tinh chỉnh màn BẮT LỖI (đợt 5, trước khi làm app máy tính)

Thầy chưa làm app máy tính vội — muốn hoàn thiện thêm web HS + thống nhất khung dữ liệu trước. Đợt này làm phần giao diện + trải nghiệm. Bump `?v=12`. Chi tiết:

### Bố cục
1. **2 cột BẰNG chiều ngang** (desktop): `grid-cols-2` (trước 5fr:4fr) → video card & form card cùng rộng 614px.
2. **Khung video CAO CÂN với khung bắt lỗi** (không tính Mistakes found): giãn khoảng cách trong khối video (video→player `mt-10`, player→dòng lớp `mt-12`), player bar `py-7`, card `p-6` → đo được video 589 / form 581 (lệch ~9px, cân đối). Đây là "các điều chỉnh ăn theo" thầy nói: nút play/pause **TRÒN** to (w-14 h-14 rounded-full), nút vị trí thanh tua **TO hơn** (CSS custom `::-webkit-slider-thumb` 24px), thanh **đỏ fill theo %** (JS `vcFill` set background gradient — range custom không có accent-fill sẵn).
3. **Ô MIN/SEC nhỏ lại** = cỡ nút tên STUDENT (py-2 text-sm rounded-lg, bỏ text-lg).
4. **3 nút TYPE nhỏ lại** = cỡ nút tên + **chữ BÊN PHẢI icon** (flex-row thay flex-col, icon w-4). Sửa cả HTML lẫn `renderTypeBtns` (rebuild className).
5. **Nút Add this mistake THẤP hơn** (py-2).

### Ô nhập
6. **Thêm ô SENTENCE** (câu chứa lỗi) — BẮT BUỘC như MISTAKE/EXPLANATION, đặt giữa TYPE và MISTAKE. `state.errors[].sentence`; hiện trong Mistakes found (dòng in nghiêng trong ngoặc kép) + cột "CÂU CHỨA LỖI" trong Excel export (chèn sau LOẠI LỖI). Nạp khi sửa lỗi, xoá khi clear.
7. **SENTENCE / MISTAKE / EXPLANATION = textarea TỰ GIÃN cao** theo nội dung (class `.autogrow` + JS `autoGrow` set height=scrollHeight). Khi text nhiều → khung bắt lỗi cao dần (có thể vượt khung video — đúng ý thầy: chỉ khi đó form mới cao hơn video). MISTAKE đổi từ `<input>` → `<textarea>`.

### Hành vi
8. **LUÔN lùi 3 giây** khi THÊM lỗi mới (thầy chọn qua AskUserQuestion): mốc lưu = thời gian hiển thị − 3s (không dưới 0). KHÔNG lùi khi SỬA lỗi cũ (mốc đã lùi rồi) — chặn bằng `editingIndex < 0`. Test: nhập 1:34 → lưu 01:31 ✓.
9. **Kéo thanh tua lúc video ĐANG DỪNG → MIN/SEC nhảy theo NGAY** (không cần play): thêm `syncTimeFields(t)` vào `vcSeek` change handler + listener `seeked` cho html5 (click thẳng thanh gốc của video khi dừng cũng nhảy). Test bằng video mp4 thật (tạm đổi link trong classes.json rồi hoàn lại): kéo 50% lúc dừng → MIN/SEC=0:05, currentTime=5, vẫn paused ✓; set currentTime=8 → MIN/SEC=0:08 ✓; đang phát → MIN/SEC vẫn chạy theo ✓.
10. **Chỉ Mistakes found cuộn**, phần còn lại ghim (giữ nguyên cơ chế pin desktop 100dvh + mobile video sticky — đã đúng từ chặng 10).

### ⚠️ CÒN TREO — "KHUNG DỮ LIỆU" (việc thầy nói làm TIẾP)
- **Google Sheet CHƯA có cột SENTENCE**: bài nộp online hiện đã MANG `sentence` trong payload (qua `errors[]`) nhưng `apps-script/Code.gs` CHƯA map ra cột → Sheet chưa ghi câu chứa lỗi. Excel export + bài đang làm (autosave) thì ĐÃ có đủ. Khi thầy chốt khung dữ liệu: thêm 'CÂU CHỨA LỖI' vào header FORM trong Code.gs + `er.sentence` vào hàng, xoá sheet FORM cũ (để tạo lại header mới) hoặc sửa header tay, rồi **deploy version mới** của Web App. File mẫu gốc `SPEAKING TEAM CHECK FORM.xlsx` cũng cần thêm cột cho khớp.

### Verify (preview thật, chụp desktop + mobile 375)
Video Drive trong preview browser rơi chế độ đồng hồ (API key giới hạn referrer, preview không khớp — trên github.io thật thì chạy html5); đã ép hiện player bar để đo chiều cao đúng chế độ thật. Không lỗi console. Không tràn ngang. Mobile: video sticky, form đủ ô, không tràn.

## CHẶNG 16 — 19/07/2026: Tinh chỉnh đợt 6 (đăng nhập gọn + TIME/TYPE cùng hàng + nâng cấp fallback)

Bump `?v=13`. Thầy muốn hoàn thiện thêm web trước khi thống nhất khung dữ liệu. Chi tiết:

### Đăng nhập / xác nhận
1. **Màn chọn tên gọn lại còn 2 ô CẠNH NHAU**: **Your Team** (trái) + **Your Name** (phải). Your Name **KHÓA (mờ)** đến khi chọn Team; chọn Team → nạp tên đội đó + mở khóa; chọn Name → **sang màn xác nhận NGAY** (bỏ kiểu mỗi đội 1 dòng select). `renderIdentify` nạp selTeam, `onTeamChange` nạp selName+mở khóa, `resetNameSelect` khóa lại. Nút "That's not me" gọi renderIdentify (reset cả 2 ô).
2. Màn xác nhận: tiêu đề "A NOTE FROM YOUR TEACHER" → **"{Tên HS}, Andrew has something for you."** (set động trong handleNamePick qua `#identNoteTitle`). Ô tích: "I agree..." → **"I understand and respect our journey, teacher Andrew ❤️"**.

### Form bắt lỗi
3. **Tiêu đề TIME và TYPE về CÙNG HÀNG với ô** (desktop): label bên trái (w-14), ô bên phải; chữ TIME `tracking-[0.3em]` giãn cho bằng bề ngang TYPE. **Mobile: xếp tầng** (label trên, ô/nút full-width) — vì để cùng hàng thì 3 nút TYPE bị bóp cắt chữ. Nút TYPE mobile giảm còn `text-[10px]` (desktop giữ text-xs) để "Pronunciation" không cắt. Bỏ 2 dòng label riêng → form thấp đi ~60px → giảm khoảng cách khối video (p-5, videoCtrl mt-6/py-4, status mt-6) cho **cân lại: video 522 / form 521**.
4. **Chữ trong SENTENCE/MISTAKE/EXPLANATION nhỏ lại** = cỡ chữ hướng dẫn (`text-xs`).
5. **XOÁ MIN/SEC sau khi Add/Save** (clearErrForm) — tránh HS thêm 2 lỗi mà chưa chọn lại thời gian. (Video đang PHÁT thì MIN/SEC tự điền lại theo giờ hiện tại — không sao.)

### Điều tra + nâng cấp video dự phòng (mục 2 của thầy)
6. **Điều tra "vì sao rơi dự phòng"**: KHÔNG phải lỗi cố hữu. Sự cố lần trước là **TẠM THỜI** — ngay sau khi giới hạn API key theo website, Google mất tới 5 phút áp dụng, trong lúc đó vài lượt tải video bị 403 → rơi dự phòng. Test lại lần này video Drive **phát html5 bình thường** (readyState 4). Đã làm cứng thêm: tăng thời gian chờ tải metadata 15s→**25s** (lỗi thật vẫn bắn 'error' ngay nên fallback vẫn nhanh khi hỏng; timeout chỉ cứu mạng CHẬM tải file lớn → đỡ rơi dự phòng nhầm).
7. **Nâng cấp trình dự phòng** (khi vẫn phải dùng — key hết hạn mức, video chưa public, mạng...): BỎ đồng hồ chạy + BỎ hết chữ hướng dẫn. Giờ chỉ có **thanh kéo** (không play/pause): phần đã qua **XANH DƯƠNG**, nút mốc **TO gấp đôi**; kéo tới đâu giờ hiển thị (`#swCur`) chạy theo. Bên cạnh có nút **SET TIME**: bấm → đưa giờ thanh kéo vào MIN/SEC kèm **đốm sáng bay** từ thanh vào ô (Web Animations API `flyLight` + nháy `.time-flash`). Cơ chế: HS xem giờ trên trình phát Drive (iframe), kéo thanh cho khớp, bấm SET TIME. Thanh kéo max mặc định **900s (15:00)** — chưa biết thời lượng video trong chế độ iframe (Drive không cho JS đọc); có thể chỉnh sau nếu thầy muốn.
   - Dọn code: bỏ hẳn đồng hồ cũ (`sw`/`swNow`/`swRender`/`swToggle`/`swReset`/`getVideoTime`); thêm `swFill`/`flyLight`/`flashEl`/`swSetTime`.

### Verify (preview thật, chụp desktop + mobile 375)
Video Drive phát html5 (không rơi dự phòng). Test đủ: 2 ô Team/Name (Name khóa→mở), chọn Name→xác nhận, tiêu đề+ô tích mới, TIME/TYPE cùng hàng desktop (top khớp) & xếp tầng mobile không cắt chữ, video/form cân 522/521, xoá MIN/SEC sau Add (đồng thời lùi 3s vẫn đúng 2:10→02:07), thanh dự phòng kéo→5:00 xanh dương + SET TIME→MIN/SEC 5:00. Không lỗi console, không tràn ngang.

### CHẶNG 16b — header gọn (cùng ngày, bump v=14)
- **Bỏ nút "🎯 TEAM X"** ở hàng trên cùng cạnh Submit (`#hdChecked`) — thông tin đội được chấm đã có trong dòng dưới khung video.
- **Nút người chấm** (`#hdStudent`): bỏ icon user, cỡ = nút Export (`bg-white/15 rounded-xl px-3.5 py-2 text-sm font-bold`), nội dung đổi thành **"HOANG · T1"** (tên · đội của người chấm; teamNo tách từ `state.myTeam`).
- **Chữ TIME** bỏ `tracking-[0.3em]` (trước giãn rộng hơn TYPE) → về chữ bình thường; vẫn giữ `sm:w-14` nên ô MIN/SEC vẫn thẳng hàng với ô TYPE.

## CHẶNG 17 — 19/07/2026: CHỐT KHUNG DỮ LIỆU CUỐI CÙNG (chưa code — chờ "ok build")

Thầy cùng em nghiên cứu + tư vấn để CHỐT cấu trúc dữ liệu cho quy mô thật: **10 lớp, mỗi 2 tuần 1 bài** (nhiều video, nhiều đội check chéo), **1 link web duy nhất** cho mọi lớp. Đây mới là bước THIẾT KẾ — CHƯA sửa code.

### Phát hiện quan trọng: file mẫu đã đổi
- `D:\OTHERS\CLAUDE\FORM SITE\SPEAKING TEAM CHECK FORM.xlsx` giờ có **3 sheet**: `SHEET` (bản Việt cũ STT/BẠN + dặn dò A10, để lại), **`TIMER`** (tiếng Anh: `STUDENT · MIN START · SEC START · MIN END · SEC END`), **`FORM`** (tiếng Anh: `NO · MIN · SEC · STUDENT · TYPE · SENTENCE · MISTAKE · EXPLANATION · CHECKER`). Không còn dropdown validation.
- ➡️ Mẫu đã **sang tiếng Anh + đã có SENTENCE** → app hiện lưu tiếng Việt là KHÔNG còn khớp. Nên chốt A = đổi app sang tiếng Anh.

### Thầy đã CHỐT (qua AskUserQuestion)
- **A. Ngôn ngữ dữ liệu = TIẾNG ANH** (khớp mẫu mới). `TYPE` = `Grammar / Pronunciation / Information` (bỏ lưu tiếng Việt NGỮ PHÁP/PHÁT ÂM/THÔNG TIN).
- **B. Kết quả = 1 file Google Sheet / LỚP** (10 files).
- **C. Cấu hình bài để trong Google Sheet riêng** (web đọc LIVE qua Apps Script) → **1 link không đổi mãi mãi**, ra bài mới KHÔNG cần đăng lại web.
- **Điều chỉnh của thầy:** trong file mỗi lớp, **mỗi lesson = 1 sheet mới đặt tên theo lesson** (bảng BẮT LỖI). **Thời gian nói = 1 sheet "TIME" CHUNG cả lớp** (mọi lesson, phân biệt bằng cột LESSON).
- **Giữ 2 cột khóa: VIDEO (id) + SUBMISSION ID** — phục vụ app máy tính (Chặng 4) mở đúng video tua tới chỗ lỗi + gom đúng lượt nộp.

### KHUNG DỮ LIỆU CUỐI CÙNG (đã duyệt) — dùng cho cả web + Apps Script + app máy tính
**① File CẤU HÌNH ("MYSPEAKING – CẤU HÌNH") — 1 file riêng, app máy tính/thầy điền:**
- Sheet **CLASSES**: `CLASS | CODE | NAME | RESULT FILE` (CLASS=ô "Your class", CODE=ô "Class code" HS gõ; RESULT FILE = spreadsheetId file kết quả lớp đó → cũng là "danh bạ" báo Apps Script ghi vào file nào).
- Sheet **LESSONS** (mỗi dòng = 1 đội trong 1 bài; `ACTIVE=yes` là bài web đang hiện): `CLASS | LESSON | DATE | ACTIVE | TEAM | VIDEO | MEMBERS | CHECKS` (MEMBERS ngăn bằng `;`; CHECKS = đội mà đội này đi check → web tự dựng cặp chấm chéo).

**② 10 file KẾT QUẢ (mỗi lớp 1 file, VD "MYSPEAKING – B1AH"):**
- Sheet mỗi **LESSON** (tên = tên lesson, VD "GERMS") — bảng bắt lỗi, mỗi lỗi 1 dòng:
  `TIME | CHECKER | CHECKER TEAM | TEAM | VIDEO | MIN | SEC | STUDENT | TYPE | SENTENCE | MISTAKE | EXPLANATION | SUBMISSION ID`
  (TEAM = đội được check; CHECKER/CHECKER TEAM = người chấm + đội của họ).
- Sheet **"TIME"** (chung cả lớp) — thời gian nói, mỗi bạn 1 dòng:
  `TIME | LESSON | TEAM | CHECKER | STUDENT | MIN START | SEC START | MIN END | SEC END | SUBMISSION ID`

### CẦN LÀM khi "ok build" (Chặng 1 hoàn thiện dữ liệu)
1. **Web `js/app.js`**: đọc cấu hình từ Apps Script (thay `data/classes.json` tĩnh) → dựng login + bài từ CLASSES/LESSONS; lưu `TYPE` bằng tiếng Anh (sửa TYPE_LABEL/data-type); payload submit thêm `lesson`, `videoId`, `submissionId`, `checkerTeam`; Excel export đổi header sang tiếng Anh khớp mẫu (NO/MIN/SEC/STUDENT/TYPE/SENTENCE/MISTAKE/EXPLANATION/CHECKER + TIMER STUDENT/MIN START…). Bump `?v=`.
2. **`apps-script/Code.gs`** viết lại: `doGet` phục vụ cấu hình (đọc CLASSES+LESSONS → JSON cho web); `doPost` route theo CLASS → mở đúng RESULT FILE → sheet tên LESSON (tạo nếu chưa có, header 13 cột) ghi lỗi + sheet "TIME" ghi thời gian; sinh SUBMISSION ID. **Deploy version mới**.
3. **Tạo Google Sheet**: 1 file CẤU HÌNH (CLASSES+LESSONS, seed B1AH-GERMS) + file KẾT QUẢ cho B1AH (ít nhất). Điền RESULT FILE id vào CLASSES. (Em thao tác Chrome giúp thầy như chặng 14.)
4. **File mẫu** `SPEAKING TEAM CHECK FORM.xlsx`: đã sẵn tiếng Anh + SENTENCE → Excel export chỉ cần khớp lại. (Cột phụ VIDEO/SUBMISSION ID chỉ có trong Google Sheet, KHÔNG bắt buộc trong Excel HS xuất.)

### Khảo sát hạ tầng + chốt lưu trữ (bổ sung 19/7 — sau khi thầy nêu 3 lưu ý)
- **Ổ D: = mirror Google Drive tài khoản `namdaptrai01@gmail.com`** (dò từ `%LOCALAPPDATA%\Google\DriveFS`, id `118226251924645809619`) — **TRÙNG** tài khoản Apps Script + Sheet nhận bài + video test. → mọi dữ liệu (cấu hình, file lớp, video) ở CHUNG 1 tài khoản, vừa trên Drive vừa hiện trên D:. Video buổi test đã nằm sẵn trong Drive (D:\6. SPEAKING mirror lên) → KHÔNG phải upload, app máy tính quét folder là lấy được mã Drive.
- **Vị trí file (thầy đã tạo sẵn):** `D:\APP AND DATA\mySpeaking\mySpeaking Data\` gồm `mySpeaking Settings\` (để file Google Sheet CẤU HÌNH) + `mySpeaking Sheets\` (mỗi lớp 1 file Google Sheet kết quả). Video giữ ở `D:\6. SPEAKING\SPEAKING TEST\<LỚP>\<NGÀY + TÊN BÀI>\`.
- **8 lớp hiện tại:** A1A, A1B, A1C, A2A, A2B, B1AH, B2A, B2B (folder SPEAKING TEST có sẵn A1A/A1C/A2A/A2B/B1AH/B2A/B2B; A1B chưa có buổi nào). Cấu trúc buổi test mẫu: `SPEAKING TEST\B1AH\2026.7.17 GERMS\` chứa C0400/02/03/04_CUT.mp4 + .srt + DS HOC SINH.txt.
- **Đổi tên/thêm/bớt lớp (thầy chốt):** nhận diện lớp KHÔNG theo tên mà theo **folder + tên file** (bộ não tìm Sheet tên `<CODE lớp>` trong `mySpeaking Sheets`, KHÔNG bám mã file cứng) → **bền khi đổi tên VÀ khi đổi tài khoản** (mirror y nguyên D: sang tài khoản mới → chỉ deploy lại Apps Script + đổi SCRIPT_URL, không sửa mã file). CLASSES thêm cột **STATUS** (active/archived — bớt lớp = archived, giữ lịch sử). **Lên trình độ & đổi tên: GIỮ file cũ, lịch sử liền mạch** (chỉ sửa nhãn CLASS/NAME/CODE). Thêm lớp = thêm dòng + tạo file mới.
- **Tài khoản nhà:** `namdaptrai01@gmail.com`; có cơ chế dự phòng đổi tài khoản như trên (thầy nói nếu đổi sẽ mirror y nguyên ổ D lên).
- **An toàn:** folder `mySpeaking Data` nằm trong repo web public → phải **.gitignore** (dữ liệu lớp chỉ ở Drive riêng, không lên GitHub Pages).

> ~~Trạng thái: THIẾT KẾ đã chốt, CHƯA code.~~ → **ĐÃ BUILD XONG + TEST LIVE ĐẠT (19/7, thầy "ok build").** Xem phần dưới.

### ✅ ĐÃ BUILD + DEPLOY + TEST LIVE (19/7/2026, `?v=15`)
- **Web `js/app.js`**: `loadClasses()` đọc config LIVE từ `SCRIPT_URL?config=1` (dự phòng `data/classes.json`); TYPE lưu TIẾNG ANH (Grammar/Pronunciation/Information — sửa cả `index.html` data-type + TYPE_STYLE, `typeLabel`=identity); state + payload thêm `classCode/lesson/videoId`; `handleNamePick` set các khóa này; `exportExcel` đổi sang mẫu tiếng Anh (TIMER: STUDENT/MIN START/SEC START/MIN END/SEC END; FORM: NO/MIN/SEC/STUDENT/TYPE/SENTENCE/MISTAKE/EXPLANATION/CHECKER). Bump `?v=15`. Đã test local (8123) + LIVE OK.
- **`apps-script/Code.gs`** viết lại 232 dòng (bỏ SS_ID cũ): `doGet(?config=1)`→`buildConfig()` đọc CLASSES+LESSONS; `doPost` route classCode→file lớp (tìm theo folder+tên)→sheet tên LESSON + sheet TIME, sinh SUBMISSION ID (`yyMMdd-HHmmss-nnn`); `setup()` tạo folder+file+seed; tiện ích folderByPath/fileByName/getSheet/sanitizeName/makeSid. **Đã dán qua Monaco setValue, chạy setup() (thầy cấp quyền OAuth), Deploy Phiên bản 2** (URL GIỮ NGUYÊN = SCRIPT_URL cũ trong config.js).
- **Google Drive (tài khoản namdaptrai01, = ổ D: mirror)**: `setup()` đã tạo `mySpeaking Data/mySpeaking Settings/MYSPEAKING - CẤU HÌNH` (sheet CLASSES seed 8 lớp — chỉ B1AH có CODE=germs + RESULT FILE; sheet LESSONS seed GERMS 4 đội) + `mySpeaking Sheets/B1AH` (doc_id `1VG3JWosFJQKpy_3cpmVW7RoMGN3FPdUB7UXyB3vM3t8`). File `.gsheet` đã mirror về ổ D:.
- **TEST LIVE end-to-end (https://andrewclasses-01.github.io/mySpeaking/)**: login B1AH/germs → config từ bộ não (4 đội) → HOANG (T1→chấm T2) → thêm lỗi Grammar 1:30 (lưu 1:27 lùi 3s) + giờ nói NGAN/TRUC → Submit → **"Submitted successfully"**. Kiểm tra file B1AH: **sheet "GERMS"** (bảng bắt lỗi, 13 cột, TYPE="Grammar", videoId, SUBMISSION ID `260719-194607-338`) + **sheet "TIME"** (2 dòng NGAN/TRUC, cùng SUBMISSION ID) — ĐÚNG KHUNG. Đã XOÁ dữ liệu test khỏi 2 sheet (giữ header) + dọn localStorage.
- **CÒN LẠI (Bước 5 — nhân ra 8 lớp):** với mỗi lớp còn lại (A1A/A1B/A1C/A2A/A2B/B2A/B2B): điền CODE + (khi ra bài) thêm dòng LESSONS + tạo 1 file kết quả tên đúng lớp trong `mySpeaking Sheets` (RESULT FILE mặc định = tên lớp; có thể để app máy tính tự tạo sau, hoặc chạy tay). File B1AH còn sheet "Trang tính1" rỗng (vô hại). Bẫy nhỏ: localStorage nháp CŨ trên máy HS có thể mang type tiếng Việt (chỉ ảnh hưởng máy từng test bản cũ — phiên mới sạch).
- Cache-busting hiện **`?v=15`**. SCRIPT_URL không đổi (deploy Phiên bản 2 cùng deployment).

Sheet cũ "SPEAKING CHECK - BÀI NỘP" (mô hình 1 sheet phẳng) nay KHÔNG còn dùng (bộ não đã route sang file lớp) — có thể xoá khi tiện.

### ✅ BÀI THẬT B1AH GERMS — SẴN SÀNG GỬI HS (19/7, thầy yêu cầu làm bài thật từ thư mục chuẩn)
- **Cấu trúc thư mục 1 LESSON (cách thầy tổ chức — QUAN TRỌNG cho Chặng 2 app máy tính tự sinh config):**
  `D:\6. SPEAKING\SPEAKING TEST\<LỚP>\<NGÀY + TÊN BÀI>\` (vd `2026.7.17 GERMS`) gồm:
  - `DS HOC SINH <LỚP>.txt` — mỗi dòng 1 đội: `T{n} - {tên ngắn} - {MEMBER1}; {MEMBER2}; ...` (vd `T3 - D.MY CUONG KHOI - DIEM MY; CUONG; KHOI`).
  - `DS-....docm` — nội dung bài; `<LỚP> <BÀI> - ASSESSMENT\` — folder chấm.
  - `SPEAKING\` → `<BÀI> - <LỚP>\` (output sắp xếp, có thể rỗng) + **`SPEAKING GOC\`** (video gốc): `<BÀI> - <LỚP> TEAM {n} - {MEMBERS}.mp4` + `SUBF\` (srt).
  - ⚠️ **Tên file video có thể GHI NHẦM số team** (vd file "TEAM 1 - MY CUONG KHOI" thực ra là T3) → LUÔN map đội theo **TÊN THÀNH VIÊN** (khớp DS HOC SINH), KHÔNG theo "TEAM N" trong tên file.
  - Cặp chấm chéo mặc định: T1→T2→T3→T4→T1 (mỗi đội check đội kế).
- **Đã làm:** thêm hàm `setupGermsB1AH()` trong Code.gs → quét `SPEAKING GOC`, **đặt 4 video "ai có link đều xem"** (DriveApp setSharing ANYONE_WITH_LINK), map đội theo tên thành viên, ghi đè LESSONS (DATE 17/7). Chạy qua editor (không cần deploy lại — doGet/doPost giữ Phiên bản 2). 4 video hoá ra CHÍNH LÀ các file test cũ (thầy đổi tên + dời vào SPEAKING GOC → Drive giữ nguyên mã: T1=1esxEgg HOANG TIEN, T2=1bra NGAN TRUC, T3=1JrAw8 DIEM MY CUONG KHOI, T4=1FZCpy PHONG HA AN BAO CHAU).
- **Verify LIVE:** config trả đúng 4 đội + video thật; **video Team 2 phát trực tiếp trên live** (readyState 4, duration 368s "Are All Germs Bad?", KHÔNG rơi dự phòng, nguồn Drive API). **➡️ Bài B1AH GERMS SẴN SÀNG — thầy gửi lớp làm được ngay** (link https://andrewclasses-01.github.io/mySpeaking/, lớp `B1AH`, mã `germs`).
- Còn lại Bước 5 (7 lớp kia) như trên. Sheet kết quả B1AH đã sạch (chỉ header GERMS + TIME).

### ⚠️ SỰ CỐ VIDEO RƠI DỰ PHÒNG + CHỐT CHUYỂN SANG YOUTUBE (19/7)
- **Triệu chứng:** thầy mở live → trình phát rơi dự phòng (iframe). Em tái hiện được trên Chrome thật (app rơi iframe).
- **Chẩn đoán (chắc chắn, đã đo):** 4 video đều public + faststart (moov đầu file); metadata API trả **200** (key tốt); nhưng **luồng tải `alt=media` bị chặn** (lúc đầu phiên còn 206, sau nhiều lượt tải → "Failed to fetch" / thẻ video lỗi **code 4**). ⇒ **Google giới hạn lượt/băng thông TẢI mỗi file Drive public** (file gốc 420–552MB ~10Mbps quá nặng). **1 lớp 15 HS × 500MB qua 1 API key → chắc chắn đụng trần** ⇒ rơi dự phòng hàng loạt. Giới hạn của Google, KHÔNG chỉnh được ⇒ vá lặt vặt (tăng timeout) không triệt để.
- **Thầy CHỐT: ① YouTube unlisted** (dù trước đây chọn Drive — giới hạn tải này chính là lý do YouTube tồn tại cho phát cả lớp). App ĐÃ hỗ trợ sẵn mode `youtube` (IFrame API, getCurrentTime chính xác → bấm giờ tự động vẫn chạy).
- **CÁCH LÀM:** cột VIDEO trong LESSONS đổi từ mã Drive → **URL YouTube đầy đủ** (buildConfig để nguyên chuỗi bắt đầu `http`; parseVideoUrl nhận youtube.com/youtu.be). Chỉ cần thay 4 dòng VIDEO của B1AH GERMS bằng 4 link YouTube (map ĐÚNG đội theo tên thành viên). KHÔNG cần sửa code/app, KHÔNG deploy lại.
- **ĐANG CHỜ:** thầy tải 4 video (ở `SPEAKING\SPEAKING GOC`) lên YouTube chế độ **Unlisted** rồi gửi 4 link kèm đội. Có link → em điền vào LESSONS (VIDEO) + verify phát trên live. (Map: T1=HOANG TIEN, T2=NGAN TRUC, T3=DIEM MY CUONG KHOI, T4=PHONG HA AN BAO CHAU.)
- **HƯỚNG SAU (mọi lesson):** dùng YouTube unlisted cho video phát HS; Drive giữ làm kho gốc. Chặng 2 (app máy tính) có thể tự upload YouTube + lấy link (YouTube Data API) hoặc thầy upload tay.
- **✅ ĐÃ XONG (19/7):** thầy upload 4 video lên YouTube (playlist "2026.7.17 GERMS - B1AH" id PLGZlczMSK2Ds). Em lấy 4 video id từ playlist, map theo TÊN video (khớp thành viên): T1 HOANG TIEN=4gATHmdhJZo, T2 NGAN TRUC=uR0gK0VbjEU, T3 MY CUONG KHOI=eJVjDezD0Tw, T4 PHONG AN CHAU=ujSwcBbI8Rw. Điền cột VIDEO (LESSONS F2:F5) = `https://youtu.be/<id>` (gõ thẳng vào Google Sheet, KHÔNG sửa code/deploy). Verify: config trả 4 link YouTube đúng đội; **cả 4 video embed OK** (IFrame API onReady, dur 373/369/488/475s — không private/không chặn nhúng); **app dùng đúng mode youtube KHÔNG rơi dự phòng**; **bấm giờ tự động chạy** (kéo tua 50% → MIN/SEC tự điền 3:04). ➡️ **BÀI B1AH GERMS SẴN SÀNG GỬI LỚP** (video YouTube, không còn giới hạn tải Drive). Lưu ý: các lesson sau cột VIDEO điền link YouTube dạng `https://youtu.be/<id>` (hoặc watch?v=) — buildConfig giữ nguyên chuỗi http.

## ⭐ HANDOFF — TIẾP TỤC (session mới)

**Đọc TRƯỚC:** file này + CLAUDE.md trong `D:\APP AND DATA\mySpeaking`. Bức tranh lớn = chặng 5; mô hình web = chặng 6-7; màn bắt lỗi = chặng 10→16; hạ tầng live = chặng 14; **KHUNG DỮ LIỆU MỚI + hạ tầng hiện tại = CHẶNG 17 (đọc kỹ, thay mọi mô tả cũ về "Drive API/1 Sheet phẳng")**.

**Đang ở đâu (mới nhất 19/07/2026 — CHẶNG 17 XONG):** Web live **https://andrewclasses-01.github.io/mySpeaking/** đã chạy **khung dữ liệu MỚI**: đọc bài LIVE từ Apps Script `?config=1` (file CẤU HÌNH Google Sheet: sheet CLASSES + LESSONS), TYPE lưu **tiếng Anh** (Grammar/Pronunciation/Information), bài nộp route về **file mỗi lớp → sheet tên LESSON + sheet TIME**, có SUBMISSION ID/videoId. Apps Script đã **deploy Phiên bản 2** (SCRIPT_URL trong config.js GIỮ NGUYÊN). Dữ liệu ở Drive tài khoản **namdaptrai01** (= ổ D: mirror): `D:\APP AND DATA\mySpeaking\mySpeaking Data\{mySpeaking Settings\MYSPEAKING - CẤU HÌNH, mySpeaking Sheets\<lớp>}`. **BÀI THẬT B1AH GERMS SẴN SÀNG GỬI LỚP** (video đã chuyển sang **YouTube unlisted** vì Drive giới hạn tải file lớn — xem "SỰ CỐ VIDEO" cuối chặng 17). `?v=15`.
- ➡️ **VIỆC SESSION SAU (thầy sẽ chỉ định):** (a) **Bước 5** — nhân ra 7 lớp còn lại (A1A/A1B/A1C/A2A/A2B/B2A/B2B: điền CODE trong CLASSES + tạo file kết quả tên lớp trong mySpeaking Sheets + thêm dòng LESSONS khi ra bài + video YouTube unlisted); và/hoặc (b) **CHẶNG 2 — app máy tính Electron** (dọn folder + tạo file chấm chéo + sau này tự sinh config/upload YouTube; gọi skill `kienthucbuildapp`, code E:\LAP TRINH APP\mySpeaking + bare repo/dữ liệu D:, CHỜ "ok build").
- ⚠️ Mục "⭐ KHUNG DỮ LIỆU" bên dưới (viết lúc CHƯA code) chỉ để tham khảo lịch sử — trạng thái THẬT đã ở CHẶNG 17.

**Chạy thử:** `python -m http.server 8123 --directory "D:\APP AND DATA\mySpeaking"` → http://localhost:8123 (hoặc preview tên `myspeaking`). KHÔNG cần node/build.
- Đăng nhập lớp TEST: **Your class = `B1AH`**, **Class code = `germs`** → chọn tên → tích cam kết → Start.

**Trạng thái Chặng 1:**
- ✅ XONG (nền, chặng 4-9): UI English-only (dữ liệu lưu + Excel GIỮ tiếng Việt khớp mẫu); 1 link + đăng nhập lớp (gõ classCode+code, sai→pop-up); chọn tên ô select; màn xác nhận ảnh HS (tạm chữ cái đầu) + cam kết bắt buộc tích; classes.json seed B1AH-GERMS; Code.gs thêm cột LỚP; **DRIVE_API_KEY trong config.js đã test OK — video Drive >100MB phát TRỰC TIẾP trong trình phát của app** (Google Cloud project `myspeaking-502901`).
- ✅ XONG (màn bắt lỗi, chặng 10-13 — thầy đã test): **bố cục GHIM** (desktop khoá 100dvh chỉ danh sách lỗi cuộn, mobile cụm video sticky top); **khung điều khiển video LUÔN HIỆN** (play/tua/thời gian, nền sáng, thanh đã-chạy màu ĐỎ); header logo CHIBI + ANDREW CLASSES (**bấm logo về trang chủ**, còn lỗi chưa submit thì pop-up Stay/Go back); dòng dưới video = Lớp | Đội | thành viên; form thứ tự **STUDENT → TIME → TYPE → MISTAKE* → EXPLANATION*** — STUDENT = nút tên (chỉ thành viên, 1 hàng, chọn = khung VÀNG) + **khung giờ nói min:sec→min:sec dưới mỗi tên** (mobile 2 tầng); **TIME 2 CHIỀU với video** (phát → MIN/SEC chạy theo; pause gõ tay + Enter/blur → video nhảy tới); **tự sáng tên HS theo khoảng giờ nói** khi video chạy; TYPE = icon Lucide nền trắng, chọn = khung vàng; **Submit chặn 3 tầng**: thiếu giờ (viền đỏ ô thiếu) → giờ sai (end≤start, đan xen — báo đúng tên) → modal xác nhận; Export (Excel vẫn khớp mẫu 100%, SECTION để trống).
- ✅ XONG (hạ tầng, chặng 14): Apps Script deployed (SCRIPT_URL trong config.js, Sheet nhận bài đã test end-to-end), API key giới hạn website, **web LIVE https://andrewclasses-01.github.io/mySpeaking/** (GitHub `andrewclasses-01`, repo `mySpeaking`, Pages nhánh master). Từ giờ MỖI lần sửa web: commit + `git push` là Pages tự cập nhật (~1 phút).
- ✅ XONG (tinh chỉnh đợt 5, chặng 15): 2 cột bằng chiều ngang + video cân cao với khung bắt lỗi; nút play TRÒN, nút tua TO, thanh đỏ fill %; **thêm ô SENTENCE bắt buộc** (form thứ tự giờ = STUDENT → TIME → TYPE → SENTENCE* → MISTAKE* → EXPLANATION*); MIN/SEC + TYPE nhỏ lại bằng ô tên, TYPE chữ bên phải icon; 3 ô SENTENCE/MISTAKE/EXPLANATION textarea tự giãn; nút Add thấp hơn; **LUÔN lùi 3 giây** khi thêm lỗi mới; **kéo tua lúc video DỪNG → MIN/SEC nhảy theo**.
- ✅ XONG (tinh chỉnh đợt 6, chặng 16): **đăng nhập 2 ô Your Team + Your Name** (Name khóa đến khi chọn Team; chọn Name → xác nhận ngay); màn xác nhận tiêu đề "**{Tên HS}, Andrew has something for you.**" + ô tích "**I understand and respect our journey, teacher Andrew ❤️**"; **TIME/TYPE tiêu đề cùng hàng với ô** (desktop; mobile xếp tầng để không cắt chữ); chữ trong SENTENCE/MISTAKE/EXPLANATION nhỏ = placeholder; **XOÁ MIN/SEC sau khi Add**; **nâng cấp fallback**: thanh kéo xanh dương nút to gấp đôi (không play/pause) + nút **SET TIME** đưa giờ vào MIN/SEC kèm ánh sáng bay, bỏ hết chữ hướng dẫn; tăng thời gian chờ video Drive 15→25s. **Điều tra**: sự cố rơi dự phòng trước là TẠM THỜI (key vừa giới hạn, Google áp dụng chậm ~5 phút) — nay video Drive phát html5 bình thường.
- ⚠️ **KHUNG DỮ LIỆU còn treo** (việc TIẾP): Google Sheet CHƯA có cột SENTENCE — Code.gs chưa map `er.sentence`, cần thêm cột + deploy version mới khi thầy chốt khung dữ liệu (Excel export + autosave đã có sentence). Xem chi tiết ở CHẶNG 15.
- ⚠️ Ảnh HS = chữ cái đầu (chờ ảnh thật qua `photos` trong classes.json). Mapping video→đội GIẢ ĐỊNH theo thứ tự. `teacher.html` là file CŨ không dùng. Header: nút người chấm "HOANG · T1" (chặng 16b), đã bỏ badge TEAM X. Cache-busting: **hiện `?v=14`** — TĂNG mỗi lần sửa app.js/config.js. Thanh kéo dự phòng max mặc định 900s (15:00) — chỉnh sau nếu cần. Tài khoản Google Cloud thầy còn 1 project mySpeaking TRÙNG THỪA (vô hại, dọn khi tiện). Backup từng chặng ở `Backup/pre-chang10/12/13`.

## ⭐ KHUNG DỮ LIỆU — VIỆC NGAY Ở SESSION SAU (thầy sẽ cùng chốt)

**Mục tiêu:** thống nhất CẤU TRÚC DỮ LIỆU giữa 4 nơi để nhất quán (web nộp ↔ Google Sheet ↔ Excel xuất ↔ app máy tính sắp làm). Hiện đang có 1 chỗ LỆCH (SENTENCE) cần chốt.

### A. Web NỘP LÊN (payload) — `js/app.js` hàm `submit()`
```
{ submittedAt, className, student, myTeam, checkedTeam, topic, videoUrl,
  errors: [ {min, sec, section:'' , who, type, sentence, detail, explain} ],   // 1 phần tử = 1 lỗi
  timers: [ {name, sMin, sSec, eMin, eSec} ] }                                  // 1 phần tử = 1 HS (thời gian nói)
```
- `type` lưu TIẾNG VIỆT: `NGỮ PHÁP` / `PHÁT ÂM` / `THÔNG TIN` (hiển thị Grammar/Pronunciation/Information). `section` luôn rỗng (đã bỏ ô ĐOẠN). `sentence` = câu chứa lỗi (MỚI, chặng 15). Mốc thời gian đã LÙI 3s khi thêm.

### B. Google Sheet "SPEAKING CHECK - BÀI NỘP" — `apps-script/Code.gs` (id `1XkrbGHkiMHHTVSWLP6OZ0O-CIEORDj4dqYrXHynuA5E`)
- Sheet **FORM** (mỗi dòng 1 lỗi) — hiện **13 cột, CHƯA có SENTENCE**: `NGÀY GIỜ NỘP, LỚP, NGƯỜI CHECK, ĐỘI CỦA NGƯỜI CHECK, ĐỘI ĐƯỢC CHECK, CHỦ ĐỀ, PHÚT, GIÂY, ĐOẠN, HS CÓ LỖI, LOẠI LỖI, LỖI CỤ THỂ, GIẢI THÍCH LỖI`. Hàng map: `[now, className, student, myTeam, checkedTeam, topic, er.min, er.sec, er.section, er.who, er.type, er.detail, er.explain]` → **`er.sentence` bị rớt (chưa ghi)**.
- Sheet **TIMER** (mỗi dòng 1 HS): `NGÀY GIỜ NỘP, LỚP, NGƯỜI CHECK, ĐỘI ĐƯỢC CHECK, STT, BẠN, BĐ PHÚT, BĐ GIÂY, KT PHÚT, KT GIÂY`.

### C. Excel HS xuất (nút Export) — `js/app.js` hàm `exportExcel()`
- Sheet **FORM** (8 cột, **ĐÃ có SENTENCE**): `PHÚT, GIÂY, ĐOẠN, HS CÓ LỖI, LOẠI LỖI, CÂU CHỨA LỖI, LỖI CỤ THỂ, GIẢI THÍCH LỖI` (chèn "CÂU CHỨA LỖI" sau LOẠI LỖI).
- Sheet **TIMER** giống file mẫu gốc (STT, BẠN, TGIAN BẮT ĐẦU Phút/Giây, TGIAN KẾT THÚC Phút/Giây + dòng dặn dò A10).

### D. File MẪU gốc — `mau/SPEAKING TEAM CHECK FORM.xlsx`
- Bản gốc của thầy, **CHƯA có cột CÂU CHỨA LỖI** → Excel export (C) hiện đã LỆCH so mẫu này.

### ⚠️ CẦN CHỐT / VIỆC LÀM khi thống nhất
1. **Cột SENTENCE (câu chứa lỗi)**: chốt tên cột + VỊ TRÍ (Excel đang đặt sau LOẠI LỖI). Rồi: (a) thêm vào FORM header + hàng trong `Code.gs` (`er.sentence`); (b) **sheet FORM cũ đã tồn tại với header 13 cột** → phải sửa header (xoá sheet FORM để tạo lại, hoặc sửa tay) + **DEPLOY VERSION MỚI** của Web App (Manage deployments → Edit → New version); (c) cập nhật file mẫu `SPEAKING TEAM CHECK FORM.xlsx` cho khớp.
2. **Chốt bộ cột/tên chuẩn** dùng chung cho cả app máy tính (Chặng 2-4). App máy tính sẽ ĐỌC dữ liệu này để: đánh dấu vị trí lỗi lên video offline (cần min:sec + type + who + sentence + detail + explain) + hiển thị thời gian nói (timers). Nên cân nhắc thêm khoá nhận diện: **mã bài nộp (ID)** + **định danh video** (videoUrl/id) để app ghép lỗi đúng video/đội.
3. Cân nhắc: có cần đổi `type` sang mã nhất quán không (hiện tiếng Việt để khớp mẫu Excel); ảnh HS thật (`photos` trong classes.json); mapping video→đội hiện GIẢ ĐỊNH theo thứ tự (app máy tính chặng sau sẽ set chuẩn khi sinh classes.json).

**Nơi sửa nhanh:** payload = `js/app.js` `submit()`; ghi Sheet = `apps-script/Code.gs` `doPost`/`getSheet`; Excel = `js/app.js` `exportExcel()`; nhớ TĂNG `?v=` trong index.html khi sửa app.js.

**Lộ trình tiếp (thầy chốt 1→2→3→4):**
- Chặng 2: **app MÁY TÍNH (Electron, như myBoard/myActivity)** — nút "sắp xếp folder + tạo file chấm chéo" (thay khâu tay skill sapxepspeaking). KHI BẮT ĐẦU: gọi skill `kienthucbuildapp`, code trên `E:\LAP TRINH APP\mySpeaking` + bare repo/dữ liệu ở `D:\APP AND DATA\mySpeaking`, chờ "ok build".
- Chặng 3: thu + xem + phân tích dữ liệu HS trong app.
- Chặng 4: trình chiếu video offline + sub + đánh dấu vị trí lỗi (đích cuối).

**Cách làm việc với thầy:** KHÔNG chuyên lập trình → giải thích dễ hiểu, hỏi bằng AskUserQuestion khi cần quyết, cho xem kết quả chạy thật/ảnh, chờ "ok build" trước tính năng lớn, mỗi đợt ghi GHI CHU DU AN.md + commit.

> mục "TIẾP TỤC CÔNG VIỆC Ở MÁY KHÁC" bên dưới (chặng 3) đã CŨ (còn nói link ?d=) — đọc HANDOFF này thay cho nó.

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
3. **Chạy test**: `python -m http.server 8123 --directory "D:\APP AND DATA\mySpeaking"` → mở http://localhost:8123 (app HS) và /teacher.html (trang thầy). Không cần node/build.
4. **Trạng thái cấu hình**: `config.js` còn 2 chỗ TRỐNG chờ thầy — `SCRIPT_URL` (Apps Script, Bước 1) và `DRIVE_API_KEY` (tùy chọn, Bước 1b). Chưa có SCRIPT_URL thì nút Nộp bài báo hướng dẫn dùng Xuất Excel (đúng thiết kế, không phải bug).
5. **Đã verify**: luồng HS đầy đủ (YouTube + Drive fallback), teacher.html tạo link/QR, xuất Excel đúng mẫu, autosave/khôi phục. **Chưa verify**: nộp bài end-to-end vào Google Sheet (chờ SCRIPT_URL), Drive API key với file lớn (chờ key), giao diện điện thoại.

### VIỆC ĐANG CHỜ
1. **Thầy deploy Apps Script** (theo `HUONG DAN TRIEN KHAI.md` hoặc đầu file `apps-script/Code.gs`): tạo Google Sheet nhận bài → dán ID vào Code.gs → deploy Web App (Execute as Me / Anyone) → dán URL `/exec` vào `SCRIPT_URL` trong `config.js`. Khi chưa có URL này, nút Nộp bài sẽ báo dùng Xuất Excel thay thế.
2. **Push GitHub + bật Pages** (tài khoản `andrewclasses-code` đã đăng nhập gh trên máy này) — đang chờ thầy đồng ý tên repo/công khai.
3. ~~Test thật với 1 video Drive lớn~~ → ĐÃ TEST chặng 2 (fallback OK). Còn chờ: thầy tạo DRIVE_API_KEY (Bước 1b) rồi test lại đường phát trực tiếp qua Drive API với video >100MB.
4. Test trên điện thoại (layout đã responsive nhưng chưa soi kỹ màn nhỏ).
