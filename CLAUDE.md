# mySTCheck — SPEAKING TEAM CHECK

## Mục đích
App web tĩnh (GitHub Pages) cho học sinh xem video thuyết trình speaking của đội bạn và **bắt lỗi** (NGỮ PHÁP / PHÁT ÂM / THÔNG TIN) + ghi **thời gian nói** của từng bạn. Dữ liệu nộp về Google Sheet của thầy, đồng thời có nút xuất file Excel đúng mẫu `SPEAKING TEAM CHECK FORM.xlsx` (2 sheet TIMER + FORM).

## Cách chạy / test
- Là web tĩnh thuần, không cần build, không cần node. Test local: `python -m http.server 8123 --directory "D:\APP AND DATA\mySTCheck"` rồi mở `http://localhost:8123`.
- Máy này đã có cấu hình preview tên `mystcheck` trong `D:\OTHERS\CLAUDE\.claude\launch.json`.
- YouTube IFrame API chỉ chạy trên http/https (localhost hoặc GitHub Pages), KHÔNG chạy qua file://.

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
  2. `html5` — Drive phát trực tiếp qua `drive.usercontent.google.com/download?id=X&export=download&confirm=t` (fallback `uc?export=download`); lấy `video.currentTime`. Endpoint không chính thức, có thể bị Google đổi.
  3. `stopwatch` — nếu Drive chặn phát trực tiếp: nhúng iframe `/preview` + đồng hồ bấm giờ song song (có nút Chỉnh giờ). App TỰ fallback theo thứ tự 2→3, có guard timeout 15s.
- **Nộp bài**: POST JSON với `Content-Type: text/plain` (tránh CORS preflight; Apps Script trả CORS `*` cho simple request). Payload: student, myTeam, checkedTeam, topic, videoUrl, errors[], timers[].
- **Autosave**: localStorage theo key `mystcheck_<60 ký tự cuối videoUrl>`, debounce 300ms; vào lại cùng link + cùng tên → khôi phục bài đang làm dở.
- **Xuất Excel**: SheetJS dựng đúng cấu trúc file mẫu — sheet TIMER (merge A1:A2, B1:B2, C1:D1, E1:F1, dòng dặn dò merge 6 cột) + sheet FORM (7 cột như form gốc).

## Khám phá kỹ thuật quan trọng
- Iframe preview của Google Drive KHÔNG cho JS đọc thời gian phát (cross-origin) → mới phải có 3 chế độ video như trên.
- Drive trả file gốc nguyên bitrate, không adaptive → cả lớp (~15 máy) cùng xem dễ nghẽn Wi-Fi; YouTube tự hạ chất lượng nên mượt hơn. Đã tư vấn thầy ưu tiên YouTube unlisted.
- Dropdown LOẠI LỖI trong file mẫu: `NGỮ PHÁP, PHÁT ÂM, THÔNG TIN` (data validation cột E sheet FORM).

## Triển khai
Xem `HUONG DAN TRIEN KHAI.md` (Apps Script + GitHub Pages). GitHub: tài khoản `andrewclasses-code`.

## Roadmap
- [ ] Thầy deploy Apps Script, điền SCRIPT_URL vào config.js
- [ ] Push GitHub + bật Pages
- [ ] (Ý tưởng) Dashboard cho thầy xem tổng hợp lỗi theo đội/loại từ Google Sheet
- [ ] (Ý tưởng) Chấm chéo: đối chiếu lỗi các HS cùng bắt được ở cùng mốc thời gian
