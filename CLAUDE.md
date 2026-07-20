# mySpeaking — SPEAKING TEAM CHECK

> ⚠️ **CẬP NHẬT 19/07/2026 — ĐỌC `GHI CHU DU AN.md` mục CHẶNG 17 + ⭐HANDOFF TRƯỚC.** Từ chặng 17, mô hình dữ liệu đã ĐỔI so với phần lớn mô tả cũ bên dưới file này:
> - **Cấu hình bài đọc LIVE** từ Apps Script `?config=1` (file Google Sheet "MYSPEAKING - CẤU HÌNH": CLASSES + LESSONS) — KHÔNG còn dùng `data/classes.json` (chỉ còn là dự phòng).
> - **(CHẶNG 21, 20/07/2026 — Phiên bản 5): MỖI LỚP MỘT SHEET BÀI RIÊNG `LESSONS <LỚP>`** trong file CẤU HÌNH (8 cột giữ nguyên, cột CLASS là lưới an toàn); sheet `LESSONS` gộp cũ đã đổi tên `LESSONS CU (da chuyen)`. Đủ 8 lớp có sheet riêng + file kết quả (`mySpeaking Sheets\<lớp>`). Lệnh quản trị `action:'setup'` chia lớp idempotent. Giao ước `?config=1` / `adminPush` / `adminResults` / bài nộp HS KHÔNG đổi.
> - **Dữ liệu lưu = TIẾNG ANH** (TYPE = Grammar/Pronunciation/Information); bài nộp route về **file mỗi lớp → sheet tên LESSON + sheet TIME chung** (KHÔNG còn 1 Sheet phẳng "SPEAKING CHECK - BÀI NỘP"); Excel export khớp mẫu tiếng Anh mới.
> - **Video phát cho HS = YouTube unlisted** (KHÔNG còn phát Drive trực tiếp — Drive giới hạn tải file lớn; Drive chỉ giữ kho gốc). App tự nhận link youtube/youtu.be trong cột VIDEO của LESSONS.
> - Dữ liệu ở Drive tài khoản **namdaptrai01** (= ổ D: mirror): `D:\APP AND DATA\mySpeaking Web\mySpeaking Data\`.

## Mục đích
App web tĩnh (GitHub Pages) cho học sinh xem video thuyết trình speaking của đội bạn và **bắt lỗi** (Grammar / Pronunciation / Information) + ghi **thời gian nói** của từng bạn. Dữ liệu nộp về Google Sheet của thầy, đồng thời có nút xuất file Excel đúng mẫu `SPEAKING TEAM CHECK FORM.xlsx` (2 sheet TIMER + FORM).

## Ngôn ngữ giao diện (QUAN TRỌNG)
- **Toàn bộ UI là TIẾNG ANH, mặc định chỉ tiếng Anh** (từ chặng 4, 18/07/2026). `<html lang="en">`, mọi nhãn/nút/placeholder/toast/prompt tiếng Anh.
- **Tách biệt HIỂN THỊ vs DỮ LIỆU**: loại lỗi hiển thị tiếng Anh (Grammar / Pronunciation / Information) nhưng **giá trị lưu + xuất Excel giữ tiếng Việt** (`NGỮ PHÁP / PHÁT ÂM / THÔNG TIN`) để khớp 100% file mẫu và dropdown validation cột E. Bản đồ này ở `js/app.js`: `TYPE_LABEL` + hàm `typeLabel()` (button giữ `data-type` tiếng Việt, chỉ đổi text hiển thị).
- **Excel export GIỮ NGUYÊN tiếng Việt**: sheet names (TIMER/FORM), header (STT, BẠN, PHÚT, GIÂY, LOẠI LỖI, LỖI CỤ THỂ...), lời dặn A10 — tất cả tiếng Việt khớp mẫu. Khi sửa UI TUYỆT ĐỐI không đụng các chuỗi này (đã đánh dấu comment trong hàm `exportExcel`).
- Cột "HS CÓ LỖI" trong Excel là free-text (không validation) → không lo lệch mẫu. Từ chặng 12-13: giá trị = đúng TÊN THÀNH VIÊN đội được chấm (chọn bằng nút, đã BỎ "Whole team"/"Someone else…").

## Cách chạy / test (mọi máy)
- Là web tĩnh thuần, không cần build, không cần node. Test local: `python -m http.server 8123 --directory "D:\APP AND DATA\mySpeaking Web"` rồi mở `http://localhost:8123`.
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
  - **MÀN 2 chọn tên (chặng 16)**: **2 ô select cạnh nhau** — Your Team (`#selTeam`) + Your Name (`#selName`, KHÓA đến khi chọn Team). Chọn Team → nạp tên đội đó + mở khóa (`onTeamChange`); chọn Name → sang xác nhận ngay.
  - **MÀN 3 xác nhận**: ảnh HS (tạm: chữ cái đầu; ảnh thật sau qua `cls.photos[name]`) + "You are in Team X · You will check Team Y" + **bảng cam kết** tiêu đề động **"{Tên HS}, Andrew has something for you."** (`#identNoteTitle`) + **ô tích BẮT BUỘC** "I understand and respect our journey, teacher Andrew ❤️" → chưa tích thì nút Start bị khoá.
  - App tự tính đội mình (checker) + đội phải chấm (checked, theo `pairs`) → tự nạp video + members đội bạn.
  - Dữ liệu lớp đọc từ `data/classes.json` (fetch no-store). Cấu trúc: `{classes:[{id,name,classCode,code,topic,teams:[{team,video,members[]}],pairs:[{checker,checked}], photos?:{TÊN:url}}]}`. Chặng sau app máy tính sẽ TỰ SINH file này.
- **Video 3 chế độ** (tự nhận diện từ link):
  1. `youtube` — YouTube IFrame API, `getCurrentTime()` chính xác. KHUYÊN DÙNG (video để "Không công khai").
  2. `html5` — Drive phát trực tiếp: ưu tiên Drive API `googleapis.com/drive/v3/files/ID?alt=media&key=<DRIVE_API_KEY>` (chính thống, chạy được file lớn), rồi mới thử `drive.usercontent.google.com/download?...&confirm=t` và `uc?export=download` (chỉ chạy với file ≤100MB); lấy `video.currentTime`.
  3. `stopwatch` (chế độ dự phòng, chặng 16 nâng cấp) — nếu Drive chặn phát trực tiếp: nhúng iframe `/preview` + **thanh kéo tay** (xanh dương, nút to, nút SET TIME đưa giờ vào MIN/SEC). App TỰ fallback theo thứ tự 2→3, guard timeout **25s**.
- **Nộp bài**: POST JSON `Content-Type: text/plain` (tránh CORS preflight). Payload: className, student, myTeam, checkedTeam, topic, videoUrl, **errors[]** = `{min,sec,section:'',who,type,sentence,detail,explain}`, **timers[]** = `{name,sMin,sSec,eMin,eSec}`. Code.gs ghi Sheet FORM + TIMER (⚠️ FORM CHƯA có cột `sentence` — xem ⭐ KHUNG DỮ LIỆU trong GHI CHU DU AN.md).
- **Autosave**: localStorage key `myspeaking_<60 ký tự cuối videoUrl>`, debounce 300ms; vào lại cùng video + cùng tên → khôi phục bài dở (gồm cả sentence).
- **Xuất Excel** (`exportExcel`): SheetJS — sheet TIMER khớp mẫu gốc (merge + dòng dặn dò) + sheet FORM **8 cột** `PHÚT, GIÂY, ĐOẠN, HS CÓ LỖI, LOẠI LỖI, CÂU CHỨA LỖI, LỖI CỤ THỂ, GIẢI THÍCH LỖI` (đã thêm CÂU CHỨA LỖI → LỆCH so file mẫu gốc, cần cập nhật mẫu khi thống nhất dữ liệu).

## Khám phá kỹ thuật quan trọng
- Iframe preview của Google Drive KHÔNG cho JS đọc thời gian phát (cross-origin) → mới phải có 3 chế độ video như trên.
- **Drive UA-sniffing (18/07/2026)**: với file >100MB, endpoint `drive.usercontent.google.com/download?...&confirm=t` trả **video/mp4 thật cho curl** nhưng trả trang HTML "Virus scan warning" cho **User-Agent trình duyệt** (kể cả có confirm=t) → thẻ video lỗi code 4 "Format error". Token "Download anyway" sinh theo request, JS không đọc được vì CORS → KHÔNG THỂ bypass thuần client. Đường chính thống duy nhất: Drive API v3 `alt=media` + API key (file phải public "anyone with link").
- `fetch` tới drive.usercontent bị CORS chặn, nhưng thẻ `<video>` không cần CORS nên vẫn phát được nếu server trả đúng video.
- Drive trả file gốc nguyên bitrate, không adaptive → cả lớp (~15 máy) cùng xem dễ nghẽn Wi-Fi; YouTube tự hạ chất lượng nên mượt hơn. Đã tư vấn thầy ưu tiên YouTube unlisted.
- Dropdown LOẠI LỖI trong file mẫu: `NGỮ PHÁP, PHÁT ÂM, THÔNG TIN` (data validation cột E sheet FORM).

## Màn bắt lỗi — trạng thái hiện tại (sau chặng 10-16b, thầy nói "ok rồi")
- **Đăng nhập/chọn tên (chặng 16)**: MÀN 1 gõ classCode+code (sai→pop-up). MÀN 2 = **2 ô cạnh nhau Your Team + Your Name** (`#selTeam`/`#selName`; Name KHÓA đến khi chọn Team → `onTeamChange` mở khóa; chọn Name → xác nhận ngay). MÀN 3 xác nhận: ảnh HS (tạm chữ đầu) + tiêu đề động **"{Tên HS}, Andrew has something for you."** (`#identNoteTitle`) + ô tích BẮT BUỘC "I understand and respect our journey, teacher Andrew ❤️".
- **Bố cục GHIM**: desktop ≥1024px khoá `100dvh` — video + form đứng yên, CHỈ "Mistakes found" cuộn (CSS riêng `#appScreen:not(.hidden)`; KHÔNG dùng `lg:flex` cho phần tử toggle `.hidden` — bẫy cascade). Mobile: header cuộn qua, CỤM VIDEO sticky top-0. 2 cột desktop BẰNG chiều ngang (`grid-cols-2`), video cân cao form (~522/521).
  - ⚠️ **BẪY chặng 27 (21/07/2026):** `<main>` PHẢI là **`lg:items-stretch`** — chặng 15 lỡ đổi sang `items-start` làm cột nhập liệu cao theo NỘI DUNG (không bị khoá theo màn) → danh sách lỗi dài bị `overflow-hidden` cắt cụt, HS không cuộn/không sửa lỗi được trước khi Submit (test 1-2 lỗi thì KHÔNG lộ — phải test nhiều lỗi). Kèm 2 gia cố: cột nhập liệu có `lg:overflow-y-auto` (van an toàn màn thấp), khung Mistakes found sàn `lg:min-h-[10rem]` (arbitrary value cho chắc với Tailwind CDN).
- **Khung điều khiển video luôn hiện** `#videoCtrl`: nút play/pause **TRÒN**, thời gian, thanh tua nút TO + phần đã chạy **ĐỎ fill %** (JS `vcFill`); html5 (event, có `seeked`) + YouTube (poll 300ms); ẩn ở chế độ dự phòng.
- **Form** thứ tự: STUDENT (nút tên 1 hàng, chọn = khung VÀNG; dưới mỗi tên 4 ô giờ nói min:sec→min:sec, mobile 2 tầng) → **TIME** (nhãn CÙNG HÀNG với MIN/SEC ở desktop, mobile xếp tầng) → **TYPE** (nhãn cùng hàng 3 nút; icon TRÁI chữ; chọn = khung vàng) → **SENTENCE*** (câu chứa lỗi, MỚI chặng 15) → **MISTAKE*** → **EXPLANATION*** (SENTENCE/MISTAKE/EXPLANATION = textarea TỰ GIÃN cao, chữ nhỏ = placeholder; đều bắt buộc).
- **TIME ↔ video 2 chiều**: video phát → MIN/SEC chạy theo (`syncTimeFields`); pause gõ tay/kéo tua (kể cả lúc DỪNG) → video + MIN/SEC nhảy (`manualTimeSeek`/`seekVideoTo`/`seeked`). Tự sáng tên HS theo khoảng giờ (`autoPickStudent`). **LUÔN LÙI 3 GIÂY** khi THÊM lỗi mới (`REWIND_SEC`, không lùi khi sửa). **XOÁ MIN/SEC sau khi Add** (`clearErrForm`) — tránh add 2 lỗi chung giờ.
- **Video dự phòng (fallback)**: Drive phát html5 trực tiếp (Drive API key, chờ metadata 25s). Nếu hỏng → iframe Drive + **thanh kéo tay `#swSeek`** (XANH DƯƠNG, nút to gấp đôi, KHÔNG play/pause) + nút **SET TIME** (`swSetTime`) đưa giờ vào MIN/SEC kèm đốm sáng bay (`flyLight`), max 900s. Không còn đồng hồ chạy + không chữ hướng dẫn.
- **Submit chặn 3 tầng**: (1) thiếu ô giờ → viền đỏ + toast; (2) giờ sai — end≤start hoặc 2 HS đan xen (`validateTimerRanges`); (3) modal xác nhận.
- **Header**: logo chibi + ANDREW CLASSES (BẤM = về trang chủ, còn lỗi chưa submit → pop-up `#leaveModal`) + **nút người chấm "HOANG · T1"** (`#hdStudent`, tên·đội, cỡ = Export, không icon; đã BỎ badge TEAM X) + Export + Submit.
- **CẤU TRÚC DỮ LIỆU (payload/Sheet/Excel) + việc THỐNG NHẤT sắp tới**: xem mục **⭐ KHUNG DỮ LIỆU** trong `GHI CHU DU AN.md`. Lưu ý ô SENTENCE hiện CHƯA ghi vào Google Sheet (Code.gs chưa map) — Excel + autosave đã có.

## Triển khai — ĐÃ LIVE (chặng 14, 19/07/2026)
- **Web HS**: https://andrewclasses-01.github.io/mySpeaking/ — GitHub tài khoản **`andrewclasses-01`** (KHÔNG phải andrewclasses-code như dự kiến cũ — thầy chốt lại chặng 14), repo public `mySpeaking`, Pages nhánh `master` path `/`. Push bằng git thường (`git push origin master`); `gh repo create` bị classifier chặn → tạo repo qua web, teacher bấm.
  - ⚠ **Bẫy đã mất 4 chặng mới gỡ (chặng 26):** `gh` CLI trên máy đăng nhập tài khoản **khác** (`andrewclasses-code`) nên `gh api repos/andrewclasses-01/... .permissions` luôn báo `push:false`, **nhưng git vẫn đẩy được** vì `git push` lấy credential từ Git Credential Manager (`git credential fill` → `username=andrewclasses-01`). Muốn kiểm quyền đẩy: dùng **`git push --dry-run`**, không dùng `gh`.
- **Apps Script**: project "mySpeaking" (tài khoản Google `namdaptrai01@gmail.com`), Web App v1 Execute as Me / Anyone. SCRIPT_URL đã điền config.js. Sheet nhận bài: "SPEAKING CHECK - BÀI NỘP" id `1XkrbGHkiMHHTVSWLP6OZ0O-CIEORDj4dqYrXHynuA5E` (script tự tạo sheet FORM/TIMER + header).
- **Drive API key**: đã giới hạn Websites = `https://andrewclasses-01.github.io/*` + `http://localhost:8123/*`, API = chỉ Drive API. Đã test key hoạt động cả live lẫn localhost SAU giới hạn.
- Chi tiết từng bước: `HUONG DAN TRIEN KHAI.md`.

## Roadmap
- [x] Drive API key (chặng 9): `DRIVE_API_KEY` đã điền config.js, test OK video 441MB
- [x] Giới hạn API key theo website (chặng 14)
- [x] Deploy Apps Script + điền SCRIPT_URL (chặng 14 — test end-to-end: submit từ app → Sheet OK)
- [x] Push GitHub + bật Pages (chặng 14 — live, video Drive phát trực tiếp trên trang live)
- [ ] (Ý tưởng) Dashboard cho thầy xem tổng hợp lỗi theo đội/loại từ Google Sheet
- [ ] (Ý tưởng) Chấm chéo: đối chiếu lỗi các HS cùng bắt được ở cùng mốc thời gian
