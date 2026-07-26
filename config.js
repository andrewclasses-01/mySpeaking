// ═══════════════════════════════════════════════════════════════
// CẤU HÌNH mySpeaking — Thầy chỉnh file này 1 lần rồi push lên GitHub
// ═══════════════════════════════════════════════════════════════
window.MYSPEAKING_CONFIG = {
  // URL Web App của Google Apps Script (xem apps-script/Code.gs và HUONG DAN TRIEN KHAI.md)
  // Dạng: https://script.google.com/macros/s/AKfycb.../exec
  // 27/07/2026 — bộ não CŨ bị xoá mất trong sự cố Google Drive (dự án Apps Script biến mất
  // khỏi Drive, /exec trả "tệp không tồn tại"). Đã dựng lại dự án mới + deploy lại => ĐỊA CHỈ ĐỔI.
  SCRIPT_URL: "https://script.google.com/macros/s/AKfycbw3etxthOSUHRPA0F4Wvnd2NAoaaISYdfcoY27DyWqlUNOULCHOPC07Nx6KdgEbKOuhRw/exec",

  // (Tùy chọn) Google Drive API key — để phát TRỰC TIẾP video Drive >100MB
  // (lấy mốc thời gian chính xác thay vì dùng đồng hồ dự phòng).
  // Không có key: video Drive lớn tự chuyển sang chế độ iframe + đồng hồ.
  // Cách tạo key: xem HUONG DAN TRIEN KHAI.md. Nên giới hạn key theo referrer github.io.
  DRIVE_API_KEY: "AIzaSyD7LSc95xVC98ALO0bvX7LRTWIEdcRP2Hk",

  // Tên hiển thị trên app
  APP_TITLE: "SPEAKING TEAM CHECK",
};
