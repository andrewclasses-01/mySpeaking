# HƯỚNG DẪN TRIỂN KHAI mySpeaking

## Bước 1 — Nối Google Sheets (làm 1 lần, ~5 phút)
1. Tạo 1 Google Sheet mới, đặt tên ví dụ **SPEAKING CHECK - BÀI NỘP**.
2. Copy **ID** của Sheet (đoạn giữa `/d/` và `/edit` trên thanh địa chỉ).
3. Vào https://script.google.com → **New project** → xóa code mặc định, dán toàn bộ nội dung file `apps-script/Code.gs` vào.
4. Sửa dòng `var SS_ID = '...'` → dán ID Sheet vừa copy.
5. **Deploy → New deployment → Web app**:
   - Execute as: **Me**
   - Who has access: **Anyone**
   → bấm Deploy, cấp quyền, copy **Web app URL** (dạng `https://script.google.com/macros/s/AKfycb…/exec`).
6. Mở `config.js` trong repo, dán URL vào `SCRIPT_URL`, lưu, push lên GitHub.
7. Test nhanh: mở URL `/exec` trên trình duyệt → thấy `{"ok":true,"app":"mySpeaking"}` là được.

> Mỗi bài HS nộp sẽ thành các dòng trong sheet **FORM** (mỗi dòng 1 lỗi, kèm ngày giờ + người check) và sheet **TIMER** (mỗi dòng 1 bạn). Muốn ra đúng file mẫu từng HS thì HS bấm thêm nút **Xuất Excel** trong app.

## Bước 1b (tùy chọn) — Drive API key để phát trực tiếp video Drive lớn
Video Drive **>100MB** bị Google chặn phát trực tiếp trên trình duyệt (trang "Virus scan warning") → app sẽ tự chuyển sang chế độ iframe + đồng hồ bấm giờ (vẫn dùng được, nhưng mốc thời gian phải canh tay). Muốn phát trực tiếp + lấy mốc thời gian chính xác với video Drive lớn:
1. Vào https://console.cloud.google.com → tạo project (hoặc dùng project có sẵn).
2. **APIs & Services → Library** → tìm **Google Drive API** → Enable.
3. **APIs & Services → Credentials → Create credentials → API key** → copy key.
4. (Nên làm) Bấm vào key → **Application restrictions: Websites** → thêm `https://andrewclasses-code.github.io/*` và `http://localhost:8123/*`; **API restrictions** → chỉ chọn Google Drive API.
5. Dán key vào `DRIVE_API_KEY` trong `config.js`, push lên GitHub.

> Nếu dùng YouTube thì KHÔNG cần bước này. Video Drive phải share "Bất kỳ ai có link".

## Bước 2 — Đưa lên GitHub Pages
```
cd "D:\APP AND DATA\mySpeaking"
git add -A && git commit -m "mySpeaking"
gh repo create mySpeaking --public --source . --push
gh api repos/andrewclasses-code/mySpeaking/pages -X POST -f "source[branch]=main" -f "source[path]=/"
```
Sau ~1 phút app chạy tại: `https://andrewclasses-code.github.io/mySpeaking/`

## Bước 3 — Mỗi buổi check
1. Upload video lên **YouTube, chế độ "Không công khai" (Unlisted)** — khuyên dùng. (Video Drive vẫn dùng được: share "Bất kỳ ai có link".)
2. Mở `https://andrewclasses-code.github.io/mySpeaking/teacher.html`.
3. Dán link video, điền chủ đề, đội được check, danh sách thành viên → **Tạo link**.
4. Gửi link vào Zalo lớp hoặc chiếu QR lên màn hình cho HS quét.
5. HS điền tên → soi video → bắt lỗi → **Nộp bài**. Thầy mở Google Sheet là thấy toàn bộ.

## Lưu ý
- Đổi video/đội KHÔNG cần sửa code — chỉ cần tạo link mới bằng teacher.html.
- Nếu chưa điền SCRIPT_URL, app vẫn dùng được: HS bấm **Xuất Excel** và gửi file cho thầy.
- Video Drive: app tự thử phát trực tiếp (lấy mốc thời gian chính xác); nếu Google chặn, app tự chuyển sang chế độ đồng hồ bấm giờ — HS bấm ▶ video và ▶ đồng hồ cùng lúc.
