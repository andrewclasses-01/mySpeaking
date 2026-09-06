// tailwind.config.js — 06/09/2026: Tailwind BIÊN DỊCH MỘT LẦN trên máy thành css/tailwind.css, thay cho
// cdn.tailwindcss.com (bản CDN biên dịch CSS trong trình duyệt MỖI LẦN mở, +120 KB, và là điểm chết đơn).
// Cấu hình `theme.extend` chép NGUYÊN VĂN từ khối <script>tailwind.config = …</script> cũ của index.html.
// Chạy lại khi thêm class Tailwind mới vào index.html / js/app.js / teacher.html:
//   npx tailwindcss@3 -c tailwind.config.js -i tailwind.in.css -o css/tailwind.css --minify
// rồi tăng ?v= của css/tailwind.css trong index.html.
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './teacher.html', './js/app.js', './js/trung.js'],
  theme: {
    extend: {
      fontFamily: { sans: ['"Be Vietnam Pro"', 'sans-serif'] },
      colors: {
        brand: { 50: '#eef2ff', 100: '#e0e7ff', 500: '#6366f1', 600: '#4f46e5', 700: '#4338ca' },
      },
    },
  },
};
