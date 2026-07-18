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

### VIỆC ĐANG CHỜ
1. **Thầy deploy Apps Script** (theo `HUONG DAN TRIEN KHAI.md` hoặc đầu file `apps-script/Code.gs`): tạo Google Sheet nhận bài → dán ID vào Code.gs → deploy Web App (Execute as Me / Anyone) → dán URL `/exec` vào `SCRIPT_URL` trong `config.js`. Khi chưa có URL này, nút Nộp bài sẽ báo dùng Xuất Excel thay thế.
2. **Push GitHub + bật Pages** (tài khoản `andrewclasses-code` đã đăng nhập gh trên máy này) — đang chờ thầy đồng ý tên repo/công khai.
3. Test thật với 1 video Drive lớn để xem fallback hoạt động ngoài đời (mới test logic, chưa test file Drive thật).
4. Test trên điện thoại (layout đã responsive nhưng chưa soi kỹ màn nhỏ).
