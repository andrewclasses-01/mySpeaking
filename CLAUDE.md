# mySpeaking — SPEAKING TEAM CHECK

## Mục đích
App web tĩnh (GitHub Pages) cho học sinh xem video thuyết trình speaking của đội bạn và **bắt lỗi** (Grammar / Pronunciation / Information) + ghi **thời gian nói** của từng bạn. Dữ liệu nộp về Google Sheet của thầy, đồng thời có nút xuất file Excel đúng mẫu `SPEAKING TEAM CHECK FORM.xlsx` (2 sheet TIMER + FORM).

## Ngôn ngữ giao diện (QUAN TRỌNG)
- **Toàn bộ UI là TIẾNG ANH, mặc định chỉ tiếng Anh** (từ chặng 4, 18/07/2026). `<html lang="en">`, mọi nhãn/nút/placeholder/toast/prompt tiếng Anh.
- **Tách biệt HIỂN THỊ vs DỮ LIỆU**: loại lỗi hiển thị tiếng Anh (Grammar / Pronunciation / Information) nhưng **giá trị lưu + xuất Excel giữ tiếng Việt** (`NGỮ PHÁP / PHÁT ÂM / THÔNG TIN`) để khớp 100% file mẫu và dropdown validation cột E. Bản đồ này ở `js/app.js`: `TYPE_LABEL` + hàm `typeLabel()` (button giữ `data-type` tiếng Việt, chỉ đổi text hiển thị).
- **Excel export GIỮ NGUYÊN tiếng Việt**: sheet names (TIMER/FORM), header (STT, BẠN, PHÚT, GIÂY, LOẠI LỖI, LỖI CỤ THỂ...), lời dặn A10 — tất cả tiếng Việt khớp mẫu. Khi sửa UI TUYỆT ĐỐI không đụng các chuỗi này (đã đánh dấu comment trong hàm `exportExcel`).
- Cột "HS CÓ LỖI" trong Excel là free-text (không validation) → không lo lệch mẫu. Từ chặng 12-13: giá trị = đúng TÊN THÀNH VIÊN đội được chấm (chọn bằng nút, đã BỎ "Whole team"/"Someone else…").

## Cách chạy / test (mọi máy)
- Là web tĩnh thuần, không cần build, không cần node. Test local: `python -m http.server 8123 --directory "D:\APP AND DATA\mySpeaking"` rồi mở `http://localhost:8123`.
- Cấu hình preview tên `myspeaking` nằm trong `D:\OTHERS\CLAUDE\.claude\launch.json` — file này KHÔNG đồng bộ theo app; máy khác thì tự chạy lệnh python ở trên (hoặc thêm config tương tự).
- YouTube IFrame API chỉ chạy trên http/https (localhost hoặc GitHub Pages), KHÔNG chạy qua file://.
- File mẫu gốc của thầy đã chép vào repo: `mau/SPEAKING TEAM CHECK FORM.xlsx` (bản gốc ở `D:\OTHERS\CLAUDE\FORM SITE\` của máy 1) — cấu trúc xuất Excel phải luôn khớp file này.

## Kiến trúc
```
index.html        — app học sinh: MÀN 1 đăng nhập lớp → MÀN 2 chọn tên → app chính 2 cột: video | nhập liệu
data/classes.json — DANH SÁCH LỚP (nội dung mỗi lớp) — nguồn cho luồng đăng nhập
config.js         — SCRIPT_URL của Apps Script (thầy điền 1 lần)
js/app.js         — toàn bộ logic (IIFE, không framework)
apps-script/Code.gs — code Google Apps Script nhận bài nộp, ghi vào Google Sheet
teacher.html      — [CŨ, không còn dùng trong mô hình mới] trang tạo link ?d= — giữ tạm, sẽ bỏ/thay bằng app máy tính
```
- **UI**: Tailwind (CDN), font Be Vietnam Pro, icon Lucide, SheetJS (xuất Excel).
- **Mô hình MỚI (chặng 6-7, 19/07/2026): 1 LINK CHUNG + đăng nhập theo lớp.** Không còn link `?d=` mỗi buổi. `index.html` (không tham số):
  - **MÀN 1 đăng nhập** (logo SVG bảng-biểu-đồ + "ANDREW CLASSES / Speaking Team Check"): HS **TỰ GÕ 2 ô** — "Your class" (khớp `classCode`) + "Class code" (khớp `code`), cả 2 so sánh **không phân biệt hoa thường**. Sai (không khớp lớp nào) → **pop-up** "Your information is not correct. Contact teacher Andrew to get help." (không dùng toast).
  - **MÀN 2 chọn tên**: mỗi đội = TÊN ĐỘI to + **ô select** thành viên; chọn xong (event change) → sang xác nhận ngay.
  - **MÀN 3 xác nhận**: ảnh HS (tạm: chữ cái đầu; ảnh thật sau qua `cls.photos[name]`) + "You are in Team X · You will check Team Y" + **bảng cam kết** (nội dung A NOTE FROM YOUR TEACHER) + **ô tích BẮT BUỘC** "I agree and respect our journey, teacher ❤️" → chưa tích thì nút Start bị khoá (disabled + mờ).
  - App tự tính đội mình (checker) + đội phải chấm (checked, theo `pairs`) → tự nạp video + members đội bạn.
  - Dữ liệu lớp đọc từ `data/classes.json` (fetch no-store). Cấu trúc: `{classes:[{id,name,classCode,code,topic,teams:[{team,video,members[]}],pairs:[{checker,checked}], photos?:{TÊN:url}}]}`. Chặng sau app máy tính sẽ TỰ SINH file này.
- **Video 3 chế độ** (tự nhận diện từ link):
  1. `youtube` — YouTube IFrame API, `getCurrentTime()` chính xác. KHUYÊN DÙNG (video để "Không công khai").
  2. `html5` — Drive phát trực tiếp: ưu tiên Drive API `googleapis.com/drive/v3/files/ID?alt=media&key=<DRIVE_API_KEY>` (chính thống, chạy được file lớn), rồi mới thử `drive.usercontent.google.com/download?...&confirm=t` và `uc?export=download` (chỉ chạy với file ≤100MB); lấy `video.currentTime`.
  3. `stopwatch` — nếu Drive chặn phát trực tiếp: nhúng iframe `/preview` + đồng hồ bấm giờ song song (có nút Chỉnh giờ). App TỰ fallback theo thứ tự 2→3, có guard timeout 15s.
- **Nộp bài**: POST JSON với `Content-Type: text/plain` (tránh CORS preflight; Apps Script trả CORS `*` cho simple request). Payload: className, student, myTeam, checkedTeam, topic, videoUrl, errors[], timers[]. Code.gs ghi thêm cột LỚP vào FORM + TIMER.
- **Autosave**: localStorage theo key `myspeaking_<60 ký tự cuối videoUrl>`, debounce 300ms; vào lại cùng video + cùng tên → khôi phục bài đang làm dở. (`saveKey` là `let`, đặt lại ở bước chọn tên khi biết videoUrl.)
- **Xuất Excel**: SheetJS dựng đúng cấu trúc file mẫu — sheet TIMER (merge A1:A2, B1:B2, C1:D1, E1:F1, dòng dặn dò merge 6 cột) + sheet FORM (7 cột như form gốc).

## Khám phá kỹ thuật quan trọng
- Iframe preview của Google Drive KHÔNG cho JS đọc thời gian phát (cross-origin) → mới phải có 3 chế độ video như trên.
- **Drive UA-sniffing (18/07/2026)**: với file >100MB, endpoint `drive.usercontent.google.com/download?...&confirm=t` trả **video/mp4 thật cho curl** nhưng trả trang HTML "Virus scan warning" cho **User-Agent trình duyệt** (kể cả có confirm=t) → thẻ video lỗi code 4 "Format error". Token "Download anyway" sinh theo request, JS không đọc được vì CORS → KHÔNG THỂ bypass thuần client. Đường chính thống duy nhất: Drive API v3 `alt=media` + API key (file phải public "anyone with link").
- `fetch` tới drive.usercontent bị CORS chặn, nhưng thẻ `<video>` không cần CORS nên vẫn phát được nếu server trả đúng video.
- Drive trả file gốc nguyên bitrate, không adaptive → cả lớp (~15 máy) cùng xem dễ nghẽn Wi-Fi; YouTube tự hạ chất lượng nên mượt hơn. Đã tư vấn thầy ưu tiên YouTube unlisted.
- Dropdown LOẠI LỖI trong file mẫu: `NGỮ PHÁP, PHÁT ÂM, THÔNG TIN` (data validation cột E sheet FORM).

## Màn bắt lỗi — trạng thái hiện tại (sau chặng 10-13, thầy đã test "tạm được")
- **Bố cục GHIM**: desktop ≥1024px khoá `100dvh` — video + form đứng yên, CHỈ danh sách "Mistakes found" cuộn (CSS riêng `#appScreen:not(.hidden)` trong `<style>` — KHÔNG dùng class `lg:flex` cho phần tử toggle `.hidden`, media query sẽ đè `.hidden` — bẫy cascade). Mobile: header cuộn qua, CỤM VIDEO sticky top-0.
- **Khung điều khiển video luôn hiện** `#videoCtrl` (nút gốc trình duyệt TỰ ẨN, không cấm được): play/pause + thời gian + thanh tua accent ĐỎ, nền sáng; chạy html5 (event) + YouTube (poll 300ms); ẩn ở chế độ đồng hồ.
- **Form**: STUDENT (nút tên thành viên 1 hàng, chọn = khung VÀNG như TYPE; dưới mỗi tên = 4 ô giờ nói min:sec→min:sec, mobile xếp 2 tầng) → TIME (MIN/SEC nhãn TRONG ô) → TYPE (icon Lucide, nền trắng, chọn khung vàng) → MISTAKE* → EXPLANATION* (đều bắt buộc).
- **TIME ↔ video 2 chiều**: video phát → MIN/SEC chạy theo (`syncTimeFields`); pause gõ tay + Enter/blur → video nhảy (`manualTimeSeek`/`seekVideoTo`). **Tự chọn HS**: video ở trong khoảng giờ nói của ai → tên đó tự sáng (`autoPickStudent`).
- **Submit chặn 3 tầng**: (1) thiếu ô giờ → viền đỏ + toast; (2) giờ sai — end≤start hoặc 2 HS đan xen → toast nêu đúng tên (`validateTimerRanges`); (3) modal xác nhận. Excel/payload KHÔNG đổi cấu trúc (SECTION rỗng, timers {name,sMin..}).
- **Header**: logo chibi (`img/logo-chibi.png` 128px) + ANDREW CLASSES; BẤM logo = về trang chủ, còn lỗi chưa submit → pop-up `#leaveModal`. Nút Export (Excel) + Submit.

## Triển khai
Xem `HUONG DAN TRIEN KHAI.md` (Apps Script + GitHub Pages). GitHub: tài khoản `andrewclasses-code`.

## Roadmap
- [x] Drive API key (chặng 9): `DRIVE_API_KEY` đã điền config.js, test OK video 441MB — ⚠️ TRƯỚC khi push GitHub Pages phải giới hạn key theo website `*.github.io` (Cloud Console → Credentials, project `myspeaking-502901`)
- [ ] Thầy deploy Apps Script, điền SCRIPT_URL vào config.js
- [ ] Push GitHub + bật Pages
- [ ] (Ý tưởng) Dashboard cho thầy xem tổng hợp lỗi theo đội/loại từ Google Sheet
- [ ] (Ý tưởng) Chấm chéo: đối chiếu lỗi các HS cùng bắt được ở cùng mốc thời gian
