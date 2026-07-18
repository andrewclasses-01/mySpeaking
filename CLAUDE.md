# mySTCheck — SPEAKING TEAM CHECK

## Mục đích
App web tĩnh (GitHub Pages) cho học sinh xem video thuyết trình speaking của đội bạn và **bắt lỗi** (Grammar / Pronunciation / Information) + ghi **thời gian nói** của từng bạn. Dữ liệu nộp về Google Sheet của thầy, đồng thời có nút xuất file Excel đúng mẫu `SPEAKING TEAM CHECK FORM.xlsx` (2 sheet TIMER + FORM).

## Ngôn ngữ giao diện (QUAN TRỌNG)
- **Toàn bộ UI là TIẾNG ANH, mặc định chỉ tiếng Anh** (từ chặng 4, 18/07/2026). `<html lang="en">`, mọi nhãn/nút/placeholder/toast/prompt tiếng Anh.
- **Tách biệt HIỂN THỊ vs DỮ LIỆU**: loại lỗi hiển thị tiếng Anh (Grammar / Pronunciation / Information) nhưng **giá trị lưu + xuất Excel giữ tiếng Việt** (`NGỮ PHÁP / PHÁT ÂM / THÔNG TIN`) để khớp 100% file mẫu và dropdown validation cột E. Bản đồ này ở `js/app.js`: `TYPE_LABEL` + hàm `typeLabel()` (button giữ `data-type` tiếng Việt, chỉ đổi text hiển thị).
- **Excel export GIỮ NGUYÊN tiếng Việt**: sheet names (TIMER/FORM), header (STT, BẠN, PHÚT, GIÂY, LOẠI LỖI, LỖI CỤ THỂ...), lời dặn A10 — tất cả tiếng Việt khớp mẫu. Khi sửa UI TUYỆT ĐỐI không đụng các chuỗi này (đã đánh dấu comment trong hàm `exportExcel`).
- Option "HS CÓ LỖI" là free-text (không validation) nên đã đổi sang English: "Whole team" / "Someone else…".

## Cách chạy / test (mọi máy)
- Là web tĩnh thuần, không cần build, không cần node. Test local: `python -m http.server 8123 --directory "D:\APP AND DATA\mySTCheck"` rồi mở `http://localhost:8123`.
- Cấu hình preview tên `mystcheck` nằm trong `D:\OTHERS\CLAUDE\.claude\launch.json` — file này KHÔNG đồng bộ theo app; máy khác thì tự chạy lệnh python ở trên (hoặc thêm config tương tự).
- YouTube IFrame API chỉ chạy trên http/https (localhost hoặc GitHub Pages), KHÔNG chạy qua file://.
- File mẫu gốc của thầy đã chép vào repo: `mau/SPEAKING TEAM CHECK FORM.xlsx` (bản gốc ở `D:\OTHERS\CLAUDE\FORM SITE\` của máy 1) — cấu trúc xuất Excel phải luôn khớp file này.

## Kiến trúc
```
index.html        — app học sinh (màn hình vào → app chính 2 cột: video | nhập liệu)
teacher.html      — trang THẦY tạo link buổi check (link + QR, mã hóa config vào ?d=base64url)
config.js         — SCRIPT_URL của Apps Script (thầy điền 1 lần)
js/app.js         — toàn bộ logic (IIFE, không framework)
apps-script/Code.gs — code Google Apps Script nhận bài nộp, ghi vào Google Sheet
```
- **UI**: Tailwind (CDN), font Be Vietnam Pro, icon Lucide, SheetJS (xuất Excel), qrcodejs (teacher.html).
- **Config buổi check** truyền qua URL `index.html?d=<base64url(JSON)>`: `{v: videoUrl, t: chủ đề, team: đội được check, members: [tên...], s: scriptUrl override (tùy chọn)}`. Không có `?d` → học sinh tự dán link video (chế độ thủ công).
- **Video 3 chế độ** (tự nhận diện từ link):
  1. `youtube` — YouTube IFrame API, `getCurrentTime()` chính xác. KHUYÊN DÙNG (video để "Không công khai").
  2. `html5` — Drive phát trực tiếp: ưu tiên Drive API `googleapis.com/drive/v3/files/ID?alt=media&key=<DRIVE_API_KEY>` (chính thống, chạy được file lớn), rồi mới thử `drive.usercontent.google.com/download?...&confirm=t` và `uc?export=download` (chỉ chạy với file ≤100MB); lấy `video.currentTime`.
  3. `stopwatch` — nếu Drive chặn phát trực tiếp: nhúng iframe `/preview` + đồng hồ bấm giờ song song (có nút Chỉnh giờ). App TỰ fallback theo thứ tự 2→3, có guard timeout 15s.
- **Nộp bài**: POST JSON với `Content-Type: text/plain` (tránh CORS preflight; Apps Script trả CORS `*` cho simple request). Payload: student, myTeam, checkedTeam, topic, videoUrl, errors[], timers[].
- **Autosave**: localStorage theo key `mystcheck_<60 ký tự cuối videoUrl>`, debounce 300ms; vào lại cùng link + cùng tên → khôi phục bài đang làm dở.
- **Xuất Excel**: SheetJS dựng đúng cấu trúc file mẫu — sheet TIMER (merge A1:A2, B1:B2, C1:D1, E1:F1, dòng dặn dò merge 6 cột) + sheet FORM (7 cột như form gốc).

## Khám phá kỹ thuật quan trọng
- Iframe preview của Google Drive KHÔNG cho JS đọc thời gian phát (cross-origin) → mới phải có 3 chế độ video như trên.
- **Drive UA-sniffing (18/07/2026)**: với file >100MB, endpoint `drive.usercontent.google.com/download?...&confirm=t` trả **video/mp4 thật cho curl** nhưng trả trang HTML "Virus scan warning" cho **User-Agent trình duyệt** (kể cả có confirm=t) → thẻ video lỗi code 4 "Format error". Token "Download anyway" sinh theo request, JS không đọc được vì CORS → KHÔNG THỂ bypass thuần client. Đường chính thống duy nhất: Drive API v3 `alt=media` + API key (file phải public "anyone with link").
- `fetch` tới drive.usercontent bị CORS chặn, nhưng thẻ `<video>` không cần CORS nên vẫn phát được nếu server trả đúng video.
- Drive trả file gốc nguyên bitrate, không adaptive → cả lớp (~15 máy) cùng xem dễ nghẽn Wi-Fi; YouTube tự hạ chất lượng nên mượt hơn. Đã tư vấn thầy ưu tiên YouTube unlisted.
- Dropdown LOẠI LỖI trong file mẫu: `NGỮ PHÁP, PHÁT ÂM, THÔNG TIN` (data validation cột E sheet FORM).

## Triển khai
Xem `HUONG DAN TRIEN KHAI.md` (Apps Script + GitHub Pages). GitHub: tài khoản `andrewclasses-code`.

## Roadmap
- [ ] Thầy deploy Apps Script, điền SCRIPT_URL vào config.js
- [ ] Push GitHub + bật Pages
- [ ] (Ý tưởng) Dashboard cho thầy xem tổng hợp lỗi theo đội/loại từ Google Sheet
- [ ] (Ý tưởng) Chấm chéo: đối chiếu lỗi các HS cùng bắt được ở cùng mốc thời gian
