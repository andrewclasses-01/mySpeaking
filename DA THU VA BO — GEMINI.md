# TẦNG GỢI Ý THỨ HAI (GEMINI) — ĐÃ THỬ ĐẦY ĐỦ RỒI BỎ, 03/09/2026

> ⛔ **ĐỌC FILE NÀY TRƯỚC KHI NGHĨ TỚI CHUYỆN DỰNG LẠI.** Không phải "chưa làm" — đã làm xong,
> chạy được thật, đo trên buổi thật, rồi **thầy chốt bỏ** vì lợi ít hơn hại. Dựng lại mà không
> đọc là đi lại đúng ba bức tường dưới đây.

## Hiện đang chạy gì

`web/js/trung.js` chỉ còn **một tầng: SO CHỮ**, chạy trong trình duyệt, tức thì, miễn phí,
không phụ thuộc tài khoản nào. Đo trên buổi thật A2B · BEAVERS AND DAMS:

| Đội | Số lỗi | So chữ đánh dấu được |
|---|---|---|
| TEAM 1 | 116 | **66 dòng (57%)** |
| TEAM 2 | 137 | **70 dòng (51%)** |

---

## Ba bức tường đã đâm phải

**1. Firebase AI Logic bắt buộc App Check.** Bật AI Logic xong là mọi lời gọi trả
`403 "Firebase AI Logic has been deactivated in this project. To resume using Firebase AI Logic,
you must enforce Firebase App Check."`

**2. Dựng App Check xong vẫn không đi được.** Đã bật reCAPTCHA Enterprise API, tạo site key
`6Ldrp6YtAAAAAPV9oT2yUeuJBWj1zTnz-YqPu4Vo` (khai đúng `speaking.andrewclasses.com`), đăng ký app.
**App Check chạy đúng** — lấy được token thật dài 953 ký tự, hết sạch 403. Nhưng lớp cuối trả
`"Your prepayment credits are depleted"`: đường Firebase tính vào **ví trả trước của
`aword-70dae`** (project CÓ billing), **không** dùng bậc miễn phí.

**3. Gọi thẳng bằng khoá riêng thì chạy, nhưng GitHub chặn.** Tạo khoá ở AI Studio trong project
`myspeaking-502901` (không gắn thanh toán ⇒ bậc miễn phí ~1.000 lượt/ngày, không cần thẻ) —
**Gemini trả lời đúng**, gộp chuẩn hai cặp thật và từ chối cặp thứ ba (hai lỗi khác nhau).
Nhưng khoá dạng mới `AQ.…` **gắn service account**, GitHub Push Protection từ chối nhận:
`GH013 — GCP API Key Bound to a Service Account`.
Đã đo phạm vi khoá đó: **chỉ mở Gemini** (Firestore 401 · Drive 401 · Cloud Resource Manager 401),
nhưng không vượt qua cảnh báo của GitHub — đó là lớp bảo vệ, và khoá gắn service account là loại
Google có thể mở rộng quyền về sau.

---

## Vì sao bỏ, dù đã chạy được

Đo trên buổi thật, Gemini **chỉ thêm được**:

| Đội | So chữ | Có Gemini | Thêm | Tốn |
|---|---|---|---|---|
| TEAM 1 | 66 | 71 | **+5** | 25 giây |
| TEAM 2 | 70 | 74 | **+4** | 20 giây |

Khoảng **+4%**, đổi lấy 20–25 giây chờ, một tài khoản phải trông, một khoá phải giữ. Lý do lợi
ít: luật *"không chắc thì trả lời KHÁC"* rất chặt (thà tách nhầm còn hơn gộp nhầm làm mất một
lỗi thật), mà phần lớn "cặp mờ" đúng là hai lỗi khác nhau thật.

👉 **Thầy chốt: không đáng.**

---

## Nếu sau này vẫn muốn dựng lại

1. **Model phải thử thật trước.** Đo 03/09: `gemini-2.5-flash-lite`, `gemini-2.5-flash`,
   `gemini-2.0-flash` đều đã bị Google khoá với người dùng mới (404 *"no longer available to new
   users"*) — cả ba tên đều "trông đúng". Chạy được: **`gemini-3.5-flash-lite`**.
   (`gemini-3.6-flash` có thật nhưng hay 503 *"high demand"*.)
2. **Khoá không được nằm trong repo** — GitHub sẽ chặn. Đường sạch là giấu khoá trong Apps
   Script của thầy rồi cho trang gọi qua đó.
3. **Tầng ② phải chạy NỀN**: trả kết quả so chữ ra trước cho màn vẽ ngay, tầng ② đổ thêm nhãn
   vào sau. Bắt học sinh nhìn màn hình chờ nửa phút là hỏng.
4. **Mỗi lô cần hạn giờ** (đã dùng 25 giây): đo thật có lô treo quá một phút mà không báo gì.
5. **Luật 21/07 vẫn phải giữ**: cặp cùng một người chấm không bao giờ được đưa cho AI hỏi gộp.

## Những thứ để lại trên Console (vô hại, không cần gỡ)

Site key reCAPTCHA · app đã đăng ký trong App Check · reCAPTCHA Enterprise API đã bật ·
Firebase AI Logic đã bật. **Không thứ nào ảnh hưởng Firestore** — chấm bài, phản biện, gộp lỗi
trùng, chat, quà chạy y như cũ.

⚠️ **Nên xoá khoá Gemini** đã tạo ở [AI Studio](https://aistudio.google.com/apikey) (tên
*"Gemini API Key"*, project mySpeaking) cho sạch — nó không còn được dùng ở đâu nữa.
