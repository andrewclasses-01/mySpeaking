# BẬT GEMINI CHO PHẦN GỢI Ý LỖI TRÙNG (Firebase AI Logic) — 03/09/2026

> ⬜ **CHƯA BẬT.** Chưa bật thì phần gợi ý vẫn chạy, chỉ ít hơn: trang dùng **tầng so chữ**
> (đo thật trên buổi A2B: đánh dấu được **219/464 dòng = 47%**), còn **547 cặp mờ** thì bỏ qua.
> Bật rồi thì những cặp mờ đó được hỏi thêm, gợi ý đầy đủ hơn.
>
> ⛔ Không bật cũng KHÔNG hỏng gì: trang tự im lặng bỏ qua tầng này.

---

## Cặp "mờ" là gì

Hai em cùng nói về một chỗ sai nhưng viết khác hẳn nhau, máy so chữ không dám quyết:

| Em A ghi | Em B ghi | Thật ra |
|---|---|---|
| `phát âm sai` | `said "seed" instead of "see"` | **CÙNG** một lỗi |
| `said 'microscoph'` | `/igzembl/` | **HAI** lỗi khác nhau |

Phân biệt hai ca đó là hiểu nghĩa, máy so chữ không làm được. Đây đúng là việc app máy tính đã
hỏi Claude suốt một năm nay (bước 2 tab Đánh giá) — nay chuyển vào trình duyệt để thầy không
phải mở app.

---

## Vì sao đi đường Firebase chứ không gọi thẳng Gemini

Gọi thẳng thì **khoá API phải nằm trong trang web**, ai xem mã nguồn cũng lấy được và xài chùa
hạn mức của thầy. Đi qua Firebase AI Logic thì khoá nằm bên máy chủ Google, **trang web không
cầm khoá nào**.

---

## Các bước (khoảng 5 phút, làm một lần)

1. Vào [Firebase Console](https://console.firebase.google.com) → chọn project **aword-70dae**.
2. Cột trái, mục **Build** → **AI Logic** (có nơi ghi là *Firebase AI Logic*).
3. Bấm **Get started**. Nó hỏi chọn nhà cung cấp — chọn **Gemini Developer API**
   (⛔ đừng chọn Vertex AI: đường đó tính tiền theo Google Cloud, phức tạp hơn mà không cần).
4. Console sẽ tự bật hai API cần thiết và tạo khoá phía máy chủ. Bấm đồng ý.
5. **Bật App Check** khi nó gợi ý (hoặc vào **Build → App Check** làm sau):
   - Chọn ứng dụng web `aword-70dae` → **reCAPTCHA Enterprise** hoặc **reCAPTCHA v3**.
   - Console cho một **site key**; báo lại cho Claude để gắn vào trang.
   - ⚠️ **Từ 02/11/2026 Google BẮT BUỘC App Check** với đường này, nên làm sớm không thừa.
6. Báo "đã bật Gemini" — Claude gắn site key, chạy thử trên một buổi thật rồi báo lại số đo.

---

## Tiền

- **Firebase AI Logic tự nó miễn phí.**
- **Gemini có bậc miễn phí**; model đang dùng là `gemini-2.5-flash-lite` — bản rẻ nhất, và mỗi
  câu hỏi chỉ gửi 25 cặp chữ ngắn.
- Ước lượng thật: một buổi 4 đội khoảng **550 cặp mờ = 22 lượt hỏi**. Cả tháng vài chục buổi
  vẫn nằm trong bậc miễn phí. Nếu vượt thì rơi vào gói Blaze đang dùng, tiền không đáng kể.

---

## Nếu sau này muốn TẮT

Xoá phần `import(SDK + '/firebase-ai.js')` trong `web/js/trung.js`, hoặc gọi
`SPTrung.goiY(ds, { dungAI: false })`. Tầng so chữ vẫn chạy nguyên.
