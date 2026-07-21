# HƯỚNG DẪN TRIỂN KHAI mySpeaking

> ✅ **TẤT CẢ CÁC BƯỚC DƯỚI ĐÂY ĐÃ LÀM XONG ngày 19/07/2026 (chặng 14).**
> Web đang chạy tại: **https://andrewclasses-01.github.io/mySpeaking/**
> File này giữ lại để tra cứu khi cần làm lại (đổi tài khoản, key hỏng, deploy lại...).

## Hiện trạng (chặng 14)
| Hạng mục | Giá trị |
|---|---|
| Web học sinh (GitHub Pages) | https://andrewclasses-01.github.io/mySpeaking/ |
| GitHub | tài khoản `andrewclasses-01`, repo public `mySpeaking`, Pages nhánh `master` path `/` |
| Google Sheet nhận bài | "SPEAKING CHECK - BÀI NỘP" — id `1XkrbGHkiMHHTVSWLP6OZ0O-CIEORDj4dqYrXHynuA5E` (tài khoản namdaptrai01@gmail.com) |
| Apps Script | project "mySpeaking", Web App v1, Execute as Me / Anyone — URL /exec đã điền vào `SCRIPT_URL` trong config.js |
| Drive API key | project Cloud `myspeaking-502901`, giới hạn Websites: `https://andrewclasses-01.github.io/*` + `http://localhost:8123/*`, chỉ Drive API |

---

## ⭐ SỬA `Code.gs` XONG THÌ PHẢI **DEPLOY PHIÊN BẢN MỚI** (làm bằng tay, ~3 phút)

> Đây là chỗ **rất dễ quên**: sửa file `apps-script/Code.gs` trong kho rồi push GitHub **KHÔNG làm
> gì cả** — Google vẫn chạy bản cũ. Phải dán code lên script.google.com **và** bấm deploy phiên bản
> mới thì học sinh mới được dùng bản mới.
> (Ghi ngày 21/07/2026 — lúc này `Code.gs` đang có bản sửa của CHẶNG 31 **chưa deploy**.)

**Chuẩn bị:** đăng nhập Google bằng tài khoản **namdaptrai01@gmail.com** (đúng tài khoản, không thì
không thấy project).

1. Mở https://script.google.com → mở project tên **mySpeaking**.
2. Bên trái chọn file **Code.gs** → bấm vào vùng code → `Ctrl+A` (chọn hết) → `Delete`.
3. Mở file `D:\APP AND DATA\mySpeaking Web\apps-script\Code.gs` bằng Notepad → `Ctrl+A` → `Ctrl+C` →
   quay lại trang Google → `Ctrl+V` → **`Ctrl+S`** (lưu). *(Dán từ bản trong kho, đừng gõ tay sửa
   trên web — trước đây làm vậy nên bản trên Google bị mất dấu tiếng Việt.)*
4. Góc phải trên bấm **Deploy → Manage deployments**.
5. Bản triển khai đang chạy (hình bút chì **Edit** ở góc phải) → mục **Version** đổi từ số cũ sang
   **New version** → ô Description ghi ví dụ `Chang 31 - tra sheet bai chiu duoc lech ten` →
   **Deploy**.
   ⛔ **ĐỪNG bấm "New deployment"** — cái đó đẻ ra **URL mới**, mà link học sinh + app máy tính đang
   trỏ vào URL cũ ⇒ cả lớp mất đường nộp bài. Luôn **Edit bản cũ + New version**.
6. Có hộp xin quyền thì bấm cho phép (Advanced → Go to mySpeaking).
7. **Kiểm lại ngay:** mở đường dẫn `SCRIPT_URL` (lấy trong `config.js`) rồi thêm `?check=1` vào cuối,
   dán lên trình duyệt. Phải thấy JSON kể đúng: folder `… / mySpeaking Web / …`, **8 lớp**, các dòng
   LESSONS, danh sách file kết quả. Thấy đủ = deploy đạt.
8. Mở tiếp `SCRIPT_URL?config=1` — phải thấy bài đang mở (ACTIVE) kèm 4 đội + link video.

**Nếu lỡ bấm nhầm "New deployment":** đừng hoảng, dữ liệu không mất gì. Chỉ cần vào Manage
deployments xoá bản thừa, và **giữ nguyên** bản cũ đang được `config.js` trỏ tới.

**Sau khi deploy xong nhớ báo lại** để cập nhật dòng "CHƯA DEPLOY" trong `GHI CHU DU AN.md`
(CHẶNG 31) và mục BÀN GIAO bên app máy tính.

---

## Bước 1 — Nối Google Sheets (ĐÃ XONG — cách làm)
1. Tạo 1 Google Sheet mới (VD **SPEAKING CHECK - BÀI NỘP**), copy **ID** (đoạn giữa `/d/` và `/edit`).
2. Vào https://script.google.com → **New project** → dán toàn bộ `apps-script/Code.gs`.
3. Sửa dòng `var SS_ID = '...'` → dán ID Sheet.
4. **Deploy → New deployment → Web app**: Execute as **Me**, Who has access **Anyone** → Deploy, cấp quyền, copy **Web app URL** (`.../exec`).
5. Dán URL vào `SCRIPT_URL` trong `config.js`, TĂNG số `?v=` trong index.html, commit + push.
6. Test: mở URL `/exec` → thấy `{"ok":true,"app":"mySpeaking"}` là được.

> Mỗi bài HS nộp = các dòng trong sheet **FORM** (mỗi dòng 1 lỗi) + **TIMER** (mỗi dòng 1 bạn), script tự tạo sheet + header lần đầu. Muốn file đúng mẫu từng HS thì HS bấm thêm nút **Export** trong app.

## Bước 1b — Drive API key (ĐÃ XONG — cách làm)
Video Drive >100MB bị chặn phát trực tiếp (trang virus scan) nếu không có key. Cách tạo:
1. https://console.cloud.google.com → tạo project → **APIs & Services → Library** → bật **Google Drive API**.
2. **Credentials → Create credentials → API key**.
3. Bấm vào key → **Application restrictions: Websites** → thêm `https://andrewclasses-01.github.io/*` và `http://localhost:8123/*`; **API restrictions** → chỉ Google Drive API.
4. Dán key vào `DRIVE_API_KEY` trong `config.js`.

> Video Drive phải share "Bất kỳ ai có link". Nếu key hỏng app tự rơi về chế độ iframe + đồng hồ (HS vẫn dùng được).

## Bước 2 — GitHub Pages (ĐÃ XONG — cách làm)
```
cd "D:\APP AND DATA\mySpeaking Web"
git add -A ; git commit -m "..."
# repo đã có remote origin = https://github.com/andrewclasses-01/mySpeaking.git
git push
```
Pages đã bật (nhánh **master**, path `/`) — chỉ cần push là web tự cập nhật sau ~1 phút.
Lần đầu làm lại từ đầu: tạo repo public trên github.com/new rồi
`gh api repos/andrewclasses-01/mySpeaking/pages -X POST -f "source[branch]=master" -f "source[path]=/"`

## Mỗi buổi check (mô hình 1 LINK CHUNG từ chặng 6)
1. Cập nhật `data/classes.json` (lớp, mã, đội, thành viên, link video Drive/YouTube, cặp chấm chéo) → commit + push.
2. Gửi HS đúng 1 link: **https://andrewclasses-01.github.io/mySpeaking/** — HS gõ tên lớp + mã lớp, chọn tên, tích cam kết, bắt lỗi, **Submit**.
3. Thầy mở Google Sheet "SPEAKING CHECK - BÀI NỘP" xem toàn bộ bài nộp.

## Lưu ý
- MỖI lần sửa `app.js`/`config.js` phải TĂNG số `?v=` trong index.html (chống cache) rồi mới push.
- Nếu chưa/mất SCRIPT_URL, app vẫn dùng được: HS bấm **Export** gửi file Excel cho thầy.
- `teacher.html` là file cũ (mô hình link ?d= đã bỏ) — không dùng.
