# mySpeaking — SPEAKING TEAM CHECK

> # 🗺 VIỆC CÒN LẠI — ĐỌC KHỐI NÀY KHI TIẾP TỤC (chốt 05/09/2026)
>
> Xếp theo **thứ tự thầy muốn làm**. ✅ Việc ① đã build 05/09 (`?v=55`). ⛔ Việc ②→⑤ chưa được
> "ok build" — phải hỏi thầy trước.
>
> ---
>
> ## ① ✅ TỰ LƯU LIÊN TỤC, KHÔNG CẦN BẤM SUBMIT — **ĐÃ BUILD 05/09/2026 sáng, web HS `?v=55`**
>
> ⭐⭐⭐ Thầy "ok build" + thêm yêu cầu *dòng "Auto saved HH:MM" cỡ nhỏ, xanh lá, giữa thanh đầu trang*.
> **Hồ sơ đầy đủ: `GHI CHU DU AN.md` chặng `?v=55`** (đã làm gì · 8 phép thử với kho thật · bẫy để lại).
> Khảo sát + 3 phương án: `DU LIEU TONG HOP\PHUONG AN TU LUU SP CHECK — 05-09-2026.md` (chọn **B**).
> **Bốn điểm thầy chốt (đã làm đúng vậy):** (1) **BỎ HẲN nút SUBMIT** ở màn chấm mô hình 2, thay
> bằng `#hdLuu` *Saving… / ✓ Auto saved 20:14 / Not saved — retrying…*; gói ghi **không gửi `daNop`**
> · (2) quay lại app (chuyển app / Home iPhone) = **đọc kho lại, GIỮ chữ đang gõ** · (3) **không có
> nút ↻** · (4) nháp cũ localStorage **gom một lần (chỉ thêm) rồi xoá khoá**, không hỏi.
> **Cách chạy (khối `tl` trong `js/app.js`, ngay sau `m2BaoNhanLai`):** 5 sự kiện Add / Save changes /
> Delete / Keep / Accept → `luuNgay()` → hàng đợi một làn `tlChay()` → `tongLoiGhiAnToan()`; mở bài
> là `tlNoiKho()` nghe `onSnapshot` đúng 1 tài liệu `tongLoi/{em}` (kho đổi ⇒ bảng đổi ~1 giây, kể cả
> từ máy khác); ẩn tab ⇒ `tlDayVoi()` PATCH `keepalive`; hiện lại ⇒ `tlDocLai()` GET kho.
> ⛔ **Luật mới khi sửa màn chấm:** mọi thay đổi dữ liệu PHẢI gọi `luuNgay()` (đừng gọi `autosave()`
> rồi tưởng đã lên kho — `autosave()` nay KHÔNG ghi localStorage khi `tl.bat`). Mỗi lỗi có `suaLuc`;
> `gopLoi()` lấy bản mới hơn — sửa lỗi mà quên đóng `suaLuc = Date.now()` là máy kia thắng oan.
> ⛔ `#draftModal` + `moTaBanCham()` đã GỠ HẲN. `submitM2`/`guiNgamKetLuan` còn trong file nhưng không
> còn đường gọi ở màn chấm (phản biện vẫn dùng nút Submit gửi phiếu — không đụng).
> ⛔ Cờ `daNop` **không trang nào đọc** (đã grep 4 nơi) — mọi bảng thầy coi "có tài liệu = đã nộp".
> ⬜ **Thầy cần bấm tay trên iPhone thật**: thêm câu → bấm Home ngay → mở lại → câu còn.
>
> *(Bên dưới là hồ sơ khảo sát TRƯỚC khi build — giữ để hiểu vì sao; "5 điểm phải hỏi" đã được
> 4 quyết định trên thay thế.)*
> Thầy giao 05/09: *"cải tiến quá trình ghi nhận dữ liệu chấm bài mà không cần bấm submit —
> soạn đến đâu, lưu đến đó, tương tự auto save trong Google Docs hoặc Google Sheet."*
>
> ### Hiện đang chạy thế nào
> - `autosave()` (debounce 300ms) **chỉ ghi `localStorage` của MÁY ĐÓ** — không lên kho.
> - Lên kho chỉ khi bấm SUBMIT (`submitM2`) hoặc bấm Keep/Accept (`guiNgamKetLuan` — lưu ngầm).
> - ⇒ Em làm 113 lỗi mà quên bấm SUBMIT, hoặc máy hết pin, là **mất sạch**. Đây đúng là thứ
>   thầy muốn chữa.
>
> ### Nền đã có sẵn, DÙNG LẠI ĐƯỢC — đừng dựng lại từ đầu
> - **`tongLoiGhiAnToan()`** — chốt chống mất bài 04/09: đọc bản trên kho rồi **GỘP theo mã lỗi**,
>   một lượt ghi không bao giờ làm mất lỗi đã có. ⛔ **MỌI đường ghi mới BẮT BUỘC đi qua đây.**
> - **`m2CoSuaChuaGui()`** — so ảnh chụp `state.errors` với bản đã đồng bộ ⇒ biết có gì mới chưa gửi.
>   Dùng nó làm cửa: **không có gì mới thì KHÔNG ghi**, khỏi đốt lượt ghi vô ích.
> - **`KHO_TUOI = 5000ms`** — bản kho đọc trong 5 giây thì dùng lại, khỏi tốn lượt đọc.
> - **`capNhatNutSubmit()`** — 4 trạng thái nút, sẽ phải đổi nghĩa (xem điểm ③ bên dưới).
>
> ### ⛔ NĂM ĐIỂM PHẢI QUYẾT / PHẢI CẨN THẬN — hỏi thầy trước khi build
>
> **① Cờ `daNop` — nguy hiểm nhất.** `submitM2` ghi `daNop: true`. Nếu lượt tự lưu cũng ghi cờ đó
> thì **bài đang làm dở cũng thành "đã nộp"**, và trang `sp-chitiet.html` của thầy đếm sai hết.
> 👉 Đề xuất: lượt tự lưu **giữ nguyên `daNop` cũ** (đừng gửi trường này trong `updateMask`);
> chỉ nút SUBMIT mới đặt `true`.
>
> **② Số lượt ghi Firestore.** Ước tính từ số thật: một em có tới **113 lỗi** (ảnh thầy gửi 05/09),
> buổi A2B cả lớp **464 dòng**. Ghi mỗi lần thêm/sửa một lỗi ⇒ **~1.800 lượt ghi/buổi** thay vì
> ~80 như nay — gấp **20–25 lần**. Cả cụm 3 app xài **chung một hạn mức** (LUẬT 8️⃣).
> 👉 Đề xuất: **gom nhịp** — im 3 giây mới ghi, và **tối đa 1 lượt ghi / 10 giây**; ghép nhiều
> thay đổi vào một lượt. Ước còn ~100–150 lượt/buổi/em.
> ⛔ **ĐỪNG ghi theo từng phím gõ.** Ô SENTENCE/MISTAKE/EXPLANATION gõ liên tục — ghi theo phím là
> hàng nghìn lượt cho MỘT câu.
>
> **③ Nút SUBMIT còn để làm gì?** Nếu mọi thứ tự lưu thì 4 trạng thái SUBMIT/UPDATE mất nghĩa.
> 👉 Đề xuất (thầy chốt): giữ nút nhưng **đổi nghĩa thành "NỘP BÀI" (chốt xong việc)**, còn tình
> trạng lưu hiện dạng chữ nhỏ kiểu Google Docs: *"Đang lưu…" / "Đã lưu lúc 20:14"*.
> Chỗ đặt: cạnh nút SUBMIT ở thanh đầu trang (điện thoại đã rất chật — cân nhắc chỉ hiện icon).
>
> **④ Hai máy cùng lúc.** `tongLoiGhiAnToan()` chống MẤT lỗi, nhưng **không** xử lý ca hai máy
> cùng sửa MỘT câu (cùng `id`): máy ghi sau thắng. Hiếm nhưng có thật (em mở 2 tab).
> 👉 Ít nhất phải: tự lưu xong mà nhặt lại được lỗi từ máy khác thì **báo cho em biết**
> (`m2BaoNhanLai()` đã có sẵn).
>
> **⑤ Mạng chập chờn.** Tự lưu hỏng mà im lặng thì em tưởng đã an toàn — **nguy hơn cả không có
> tự lưu**. ⛔ Giữ đúng luật 04/09: **đọc kho hỏng thì KHÔNG GHI**, và phải hiện trạng thái
> *"Chưa lưu được — đang thử lại"* rõ ràng, đừng nuốt lỗi.
>
> ### Cách đo sau khi build (đừng bỏ)
> Đếm số lượt ghi thật của MỘT buổi trước/sau; xem `daNop` của bài chưa nộp có bị bật nhầm không;
> tắt mạng giữa chừng rồi bật lại xem có mất câu nào không; mở 2 tab cùng một em, mỗi bên thêm
> vài câu, kiểm cả hai bên đều đủ.
>
> ---
>
> ## ② ⭐⭐ `nguoncham.js` — SUY GIỜ NÓI TỪ MỐC CÁC LỖI (app máy tính)
> Nợ từ đợt `?v=50`: đã **bỏ 4 ô giờ nói** khỏi màn chấm ⇒ khối ① của
> `mySpeaking/app/src/main/lib/nguoncham.js` (bảng giờ nói từng em, nuôi phần Chấm đội / Chấm học
> sinh) **mất nguồn**. Thầy chốt: *"trong các bài check của học sinh đã có check bạn nào đúng sai
> đoạn nào rồi… có thể biết được ai nói câu nào ở mức độ gần đúng. Chấp nhận bỏ phần đó đi."*
> 👉 Suy khoảng nói của mỗi em = từ mốc lỗi SỚM NHẤT đến mốc lỗi MUỘN NHẤT ghi tên em đó.
> ⛔ Em nào **không bị bắt lỗi nào** thì không có giờ — phải quyết xử lý sao (bỏ qua? lấy phần
> còn trống giữa hai bạn kề?).
> ⛔ Buổi CŨ trên kho **vẫn còn `timers` thật** — ưu tiên dùng số thật, chỉ suy khi thiếu.
>
> ## ③ ⭐ ĐIỂM THEO CỤM + "CỤM TREO CHỜ THẦY" (`sp-chitiet.html`)
> Nợ từ đợt gộp lỗi trùng (`?v=46`). Cố ý để sau vì cần **cụm chốt thật** để đo, không đoán từ code.
> Nay thầy đã dùng vài buổi ⇒ có dữ liệu thật để làm. Xem `myLesson/app/BAN GIAO.md` mục `0🧩` G.
>
> ## ④ ⚠️ HAI MÀN GỘP LỖI TRÙNG CHƯA ĐƯỢC VÁ BỐ CỤC ĐIỆN THOẠI
> **Phát hiện 05/09 khi rà cuối đợt:** `#trungScreen` (KIỂM TRA TRÙNG / XÁC NHẬN TRÙNG) vẫn dùng
> `min-h-screen` + dải player `sticky top-0` — **ĐÚNG Y cách vừa hỏng ở màn chấm**, chỉ là chưa ai
> mở nó bằng iPhone để phát hiện. Gần như chắc chắn cũng trôi mất dải trên khi cuộn / khi bàn phím bật.
> 👉 Chép nguyên cách chữa của `#appScreen`: khoá khung + một vùng cuộn + `theoKhungNhin()`
> (`position:fixed` + `top = visualViewport.offsetTop`). Xem khối `?v=54` bên dưới.
>
> ## ⑤ Tab **KẾT QUẢ** của app mySpeaking chưa theo luật CHÍNH CHỦ QUYẾT
> Cố ý từ 02/09 (thầy sẽ dựng lại tab đó) — số của nó lệch số học sinh thấy là **biết trước**,
> không phải lỗi. Khi dựng lại thì chép bộ ba `tenBang` / `chinhChuDaNhan` / `tranhChapThat`.
>
> ---

> ⛔⛔⛔ **05/09/2026 (`?v=54`) — VỆT TRẮNG DƯỚI: TRANG BỊ ĐẨY, KHÔNG PHẢI ĐO SAI.**
> Manh mối nằm ngay trong ảnh thầy gửi: **thanh tím đầu trang KHÔNG có trong ảnh**, mà phía
> dưới lại thừa ra một vệt trắng **đúng bằng chiều cao nó**. Cái mất tích ở MỘT đầu và cái thừa
> ra ở ĐẦU KIA bằng nhau ⇒ dấu hiệu của một phép **DỊCH CHUYỂN**, không phải sai số đo.
> Safari **vẫn đẩy cả trang lên** (visual viewport lệch khỏi layout viewport một đoạn `offsetTop`);
> `#appScreen` cao đúng `vv.height` nhưng vẫn **bắt đầu từ y=0 của layout viewport**.
> **CHỮA:** `position:fixed` (chỉ dưới 1024px) + `ap.style.top = vv.offsetTop`.
> ⛔ `window.scrollTo(0,0)` (dùng ở `?v=52`/`?v=53`) **không kéo lại được** — đây không phải cuộn
> trang thường. ⛔ Giả thuyết "thanh phụ bàn phím làm `vv.height` báo dư" của `?v=53` là **SAI**.
> ⛔ Dùng `fixed` chứ **không** `transform: translateY()`: `transform` tạo khung quy chiếu mới
> ⇒ pop-up `fixed` bên trong neo nhầm vào `#appScreen`. Đã kiểm: modal Submit vẫn `0..812` phủ kín màn.
> **Đo (giả lập `offsetTop=44`):** `top` 0→44px · header `0..44`→`44..88` (trở lại tầm nhìn) ·
> `#khoiNhap` `258..812`→`302..812` (sát đáy, hết vệt trống). Máy tính: `static`, inline rỗng, không đổi.
>
> ⭐ **05/09/2026 (`?v=53`): BÓP HAI VỆT TRẮNG THỪA.** Thầy xác nhận `?v=52` đã giữ được
> các thanh, nhưng còn hai vệt trắng: **dưới thanh player** (đệm CSS chồng nhau — `py-2` của `<main>`
> + `space-y-2.5` + `pt-1 pb-2` của `#khoiVideo`, ≈ 30px; nay còn **7px**. ⛔ đè `space-y-2.5` phải
> dùng selector có **#id**) và **trên bàn phím** (`visualViewport` báo **dư** lúc bàn phím đang
> trượt: **thanh phụ** của nó — hàng icon chìa khoá/thẻ/vị trí — hiện sau một nhịp ⇒ chữa bằng
> `theoKhungNhinTre()`: đo NGAY rồi đo LẠI sau 350ms. ⛔ giữ **cả hai** lượt, chỉ đo trễ thì màn giật).
> **Đo:** 375×420 ⇒ `#khoiNhap` `144..420`, **trống dưới = 0**; máy tính không đổi.
>
> ⛔⛔⛔ **VÁ LẦN 2 — 05/09/2026 (`?v=52`): BÁM THEO `visualViewport`, KHÔNG TIN `100dvh`.**
> Thầy bấm thử lần nữa (ảnh 01:29): **bật bàn phím là ba thanh trên vẫn trôi khỏi màn**, dù
> `?v=51` đã khoá `height:100dvh` + `overflow:hidden`.
> **VÌ SAO:** Safari trên iPhone **không thu nhỏ trang** khi bàn phím hiện — nó giữ nguyên khung
> bố cục (`100dvh` vẫn là chiều cao MÀN, **không** trừ bàn phím) rồi **đẩy cả trang lên** ở tầng
> *visual viewport* cho lộ ô đang gõ. Cú đẩy đó nằm NGOÀI tầm với của CSS: `height:100dvh`,
> `overflow:hidden`, `position:fixed`, `sticky` — **không cái nào cản được**.
> **CÁCH CHỮA (`theoKhungNhin()` trong app.js):** đo `window.visualViewport.height` (phần màn
> CÒN THẤY sau khi trừ bàn phím) rồi ép `#appScreen` cao đúng bấy nhiêu, cộng chốt
> `window.scrollTo(0,0)` khi `vv.offsetTop` khác 0. Nghe `resize` + `scroll` của `visualViewport`,
> `orientationchange`, `resize` của window; gọi thêm một lượt trong `datCheDoDs()` (ba đường vào
> màn đều qua đó). Dưới 1024px mới đặt; máy tính **xoá inline height**, trả về cho CSS.
> ⛔ **ĐỪNG chữa bằng `transform: translateY(...)`** để kéo trang xuống — `transform` tạo khung
> quy chiếu mới, mọi pop-up `position:fixed` bên trong sẽ neo nhầm vào `#appScreen`.
> **Đo thật (giả lập bàn phím bằng cách thu khung nhìn 375×812 → 375×400):** `#appScreen` bám
> đúng `400px` · header `0..44` · `#dsTab` `56..90` · video `0` · `#khoiNhap` `164..392` cuộn
> được · thân trang không cuộn. Máy tính: inline height rỗng, `77..245` / `312..680` / `76..680`.
> ⚠️ **Chưa thử được trên iPhone thật** (bàn phím iOS không mô phỏng được trên máy tính) — cần
> thầy xác nhận một lượt.
>
> ⛔⛔ **VÁ LẦN 1 — 05/09/2026 (`?v=51`): KHOÁ BỐ CỤC Ở MỌI CỠ MÀN.**
> Thầy bấm thử trên **điện thoại thật** rồi chụp ảnh về: cuộn xuống là **thanh đầu trang, hai
> nút CHECK/LIST và cả thanh player đều trôi mất**. Nguyên nhân: điện thoại vẫn để cả thân
> trang cuộn và chỉ ghim khối video bằng `position:sticky` — **sticky KHÔNG giữ được trên máy
> thật**. ⛔ **ĐỪNG quay lại cách sticky.**
> Nay điện thoại dùng ĐÚNG khuôn của máy tính: `#appScreen` = cột cao `100dvh`, `overflow:hidden`;
> `header` + `#khoiVideo` (hai nút CHECK/LIST + video + player) `flex-shrink:0` đứng yên;
> **`#khoiNhap` là PHẦN DUY NHẤT CUỘN**. Hai id `#khoiVideo` / `#khoiNhap` là MỚI — desktop vẫn
> `lg:contents` cho `#khoiNhap` để form + list thành hai ô grid trực tiếp.
> **Đo thật (375×812):** thân trang `scrollHeight` không vượt màn nữa · cuộn danh sách hết cỡ
> (`scrollTop` 0→110) mà `header` vẫn `0..44`, `#khoiVideo` vẫn `52..268` · bàn phím ảo bật thì
> video 114→0 và vùng nhập nới từ `278..804` lên `164..804`, hai thanh trên vẫn đứng yên ·
> máy tính không đổi (`77..245` / `312..680` / `76..680`).
>
> ⭐⭐⭐⭐⭐ **05/09/2026 (`?v=50`): DỰNG LẠI BỐ CỤC TRANG CHẤM BÀI CÁ NHÂN.**
> **BẮT BUỘC đọc trước khi đụng** `#appScreen` · `<main>` · `.video-shell` · `#videoCtrl` ·
> `#errFormCard` / `#errListCard` · `buildStudentField()` · `openSubmitModal()`.
> Thầy duyệt qua bản mẫu 2 vòng (`DU LIEU TONG HOP\MAU-CHAM-CA-NHAN-v2.html`) rồi mới cho build.
>
> **Ba nhóm việc thầy chốt:**
> 1. **Chung cả hai giao diện** — ⛔ **BỎ HẲN 4 ô giờ nói dưới mỗi tên học sinh** · thu nhỏ
>    player + khung video tối đa · ⛔ **bỏ hẳn dòng "LỚP · TEAM · thành viên"** dưới video ·
>    **thêm hai nút lùi/tiến 5 giây** hai bên nút play (cố ý KHÔNG ghi số "5" trong nút).
> 2. **Máy tính** — nửa TRÁI = video (trên) + khối check lỗi (dưới); nửa PHẢI = Mistakes found
>    trải cả hai hàng. **Hai cột cân mép**: mép trên video = mép trên khung Mistakes; mép dưới
>    khối check lỗi = mép dưới khung Mistakes. (ĐẢO NGƯỢC bố cục CHẶNG 30.)
> 3. **Điện thoại** — video co còn ~một nửa (14dvh) · hai nút **CHECK / LIST** trên đầu video,
>    **luôn hiện** · bấm bút chì ở LIST thì lỗi nhảy vào form và tự về CHECK · bấm vào ô gõ chữ
>    (bàn phím ảo hiện) thì **video co về 0, chỉ còn thanh player** · thanh đầu trang co hẹp
>    tối đa và **sticky** (đảo ngược luật cũ "header không sticky").
>
> **⬜ VIỆC CÒN NỢ — ĐỢT RIÊNG, ĐỪNG QUÊN:** bỏ ô giờ nói ⇒ **app máy tính mất nguồn "bảng giờ
> nói từng em"** (`app/src/main/lib/nguoncham.js` khối ①, dùng cho Chấm đội / Chấm học sinh).
> Thầy chốt: **suy giờ nói từ mốc các lỗi đã bắt, chấp nhận gần đúng**. Chưa làm.
> ⛔ Trường `timers` trong bài nộp **VẪN GIỮ NGUYÊN** (nạp sao gửi vậy): buổi cũ còn dữ liệu
> thật trên kho, bỏ trường đi là `fsPatch` ghi đè xoá sạch (LUẬT 9️⃣).
>
> **⛔ BỐN BẪY ĐÃ TRẢ GIÁ NGAY TRONG ĐỢT NÀY:**
> 1. ⛔⛔ **CÓ BA ĐƯỜNG vào màn chấm, không phải một**: `dungManChinh()` (buổi mô hình 2) ·
>    `start()` (buổi CŨ Google Sheets, đi thẳng, KHÔNG gọi hàm kia) · `openReview()` (xem lại
>    bài đã nộp). Đặt chế độ CHECK ở một chỗ là buổi cũ hiện **chồng cả hai khung** và không nút
>    nào sáng — bắt được khi kiểm thật, không phải suy từ code.
> 2. ⛔⛔ **Gỡ ô nhập thì PHẢI gỡ luôn tầng chặn Submit của nó.** Hai tầng cũ
>    (`missingTimerFields` + `validateTimerRanges`) đòi đủ 4 ô giờ; ô đã biến mất thì chúng
>    **không bao giờ qua được** ⇒ khoá cứng nút Submit của cả lớp.
> 3. ⛔ **`autoGrowAll()` đo khi khung form còn ẩn thì ra 0** ⇒ ba ô SENTENCE/MISTAKE/EXPLANATION
>    bị khoá cao 0px, chữ tràn ra ngoài. Phải `datCheDoDs('check')` **TRƯỚC** khi gán chữ + đo.
>    Cùng họ với bẫy "đo layout quá sớm".
> 4. ⛔ **`tenLopNgan()` suýt bị xoá nhầm** cùng `videoInfoHtml()` — nó còn được `avLopSlug()`
>    dùng để dựng slug lớp cho **kho ảnh đại diện**. Xoá là ảnh cả lớp hỏng CÂM LẶNG.
>
> **Đã kiểm gì:** `node --check` xanh · `tsc --checkJs` không còn TS2304/TS2552 nào của mình
> (8 lỗi còn lại đều là thư viện ngoài YT/XLSX/lucide) · chạy thật trên localhost bằng gói
> `?goi=` **mô hình 1** (không có `kho:'fs'` ⇒ app KHÔNG đọc/ghi Firestore một byte nào) —
> đo bằng `getBoundingClientRect`: máy tính video `77..245`, form `312..680`, list `76..680`
> trên màn 700px (hai mép trùng) · điện thoại video 114px→0 khi bàn phím ảo bật · tua ±5s
> chạy đúng (0:00→0:05→0:10) · **modal Submit mở được** (chốt chặn cũ đã gỡ sạch).
> ⚠️ **CHƯA có ai bấm tay bằng chuột/ngón tay thật**: chuột của công cụ bị treo vì iframe
> YouTube nên phải điều khiển bằng lệnh trên trang; riêng phần bàn phím ảo kiểm bằng **bắn sự
> kiện `focusin`/`focusout`** (khung xem không giữ được con trỏ thật). **Thầy nên bấm thử tay
> trên điện thoại thật một lượt.**

> ⛔⛔⛔ **ĐỌC TRƯỚC MỌI THỨ — 04/09/2026 (`?v=48`): CHỐT CHỐNG MẤT BÀI CHẤM.**
>
> Hai em đã mất bài THẬT: **TIẾN (B1AH) 23 câu** (cứu được) · **KHÁNH NGÂN (A2B) 32 câu**
> (mất hẳn). Máy cũ còn **nháp cũ** trong `localStorage` mở lại là `tongLoiGhi` đẩy nguyên
> mảng lỗi trong RAM máy đó lên kho, nuốt sạch mẻ làm ở máy khác.
>
> **LUẬT MỚI — ⛔ đừng gỡ, đừng đi vòng:**
> - **MỌI lượt ghi `tongLoi` phải đi qua `tongLoiGhiAnToan()`** — nó đọc bản trên kho rồi GỘP
>   theo mã lỗi, không bao giờ để một lượt ghi làm mất lỗi đã có trên kho.
> - **Đọc kho hỏng thì KHÔNG GHI.** Thà báo "lưu không được" còn hơn ghi đè mù — ghi đè mù
>   đúng là cái đã làm mất bài hai em.
> - `startM2` **không được nuốt lỗi mạng** nữa: hiện `#khoHongModal` hỏi hẳn.
>
> ⭐⭐ **Mất bài thì CỨU NGAY trong 1 TIẾNG**: Firestore giữ bản cũ `versionRetentionPeriod
> = 3600s`, đọc lại bằng tham số `readTime` (`?readTime=2026-09-04T00:46:40Z`). Quá 1 tiếng
> là mất vĩnh viễn — PITR của project đang TẮT. Cách bắt lỗi mất bài + toàn bộ phép thử:
> `GHI CHU DU AN.md` mục **"CHẶNG — 04/09/2026"**.

> ⭐⭐⭐⭐⭐ **CẬP NHẬT 03/09/2026 (`?v=46`) — HAI MÀN MỚI: GỘP LỖI TRÙNG.**
>
> Thầy hỏi: nhiều em cùng bắt một lỗi thì tính sao — *"1 lỗi mà 4 người bắt thì bị oan"*.
> Đo thật: buổi A2B **464 dòng lỗi** → **341** sau khi gộp phần chắc chắn trùng; em THƯ có
> **61 dòng chỉ trong một phút đầu**.
>
> **Hai màn mới, cùng dùng `#trungScreen`, vào bằng cờ trong gói `?goi=`:**
> - `kt:1` **KIỂM TRA TRÙNG** — đội BỊ chấm gộp các dòng cùng một lỗi thành CỤM rồi bấm SAVE.
> - `xn:1` **XÁC NHẬN TRÙNG** — đội CHẤM bỏ phiếu GỘP / KHÔNG GỘP, **độc lập từng cụm**.
>
> **⛔ Bảy luật nghiệp vụ thầy chốt — đừng tự đổi:** thầy Andrew **chỉ gợi ý trên từng dòng
> rời**, không tự gom cụm · cụm đã SAVE vẫn sửa được bằng **nút bút** (xoá dòng ⇒ cụm quay về
> chưa lưu) · **nhiều phiếu hơn thắng**, hoà thì **TREO** · **số thứ tự lỗi là SỐ ĐỊNH DANH**,
> không đánh lại khi gộp · **màn chấm bài + màn phản biện GIỮ NGUYÊN 100%** · học sinh **không
> bao giờ thấy chữ "máy"/"AI"** · **bỏ hết chữ hướng dẫn**, chỉ hiện con số bắt buộc.
>
> ⛔⛔ **LUẬT 21/07 SỐNG CÒN**: một cụm KHÔNG chứa hai dòng của **cùng một người chấm** — đó là
> người nói sai HAI LẦN. Bản gốc ở `app/tools/danhgia.py`, nơi nó từng nuốt 13 dòng thật; nay
> chặn ở cả tầng gợi ý lẫn lúc học sinh tự gộp, xét trên **cả nhóm sau khi gộp**.
>
> ⛔⛔ **BẪY CASCADE**: class `lg:*` đổi `display` **ĐÈ LÊN `.hidden`** ở màn ≥1024px ⇒ khung
> đang ẩn vẫn hiện ra ô trắng trống. Phần tử nào có thể mang `.hidden` thì **tuyệt đối không**
> gắn `lg:*` đổi `display` cho nó.
>
> **Gợi ý lỗi trùng** (`js/trung.js`): chỉ còn **một tầng SO CHỮ**, tức thì và miễn phí — đo
> thật **57%** và **51%** số dòng. ⛔ Tầng Gemini **đã dựng xong, đo rồi thầy chốt BỎ** (chỉ
> thêm ~4% mà tốn 20–25 giây) — **đọc `DA THU VA BO — GEMINI.md` trước nếu định dựng lại**.
>
> Kho mới `cum` + `cumPhieu` (**luật đã dán + kiểm 03/09**, 7 phép thử ghi đúng cả 7).
> Nhật ký đầy đủ: `GHI CHU DU AN.md` **4 mục cuối**. Hồ sơ bàn giao cả cụm:
> `myLesson/app/BAN GIAO.md` mục **`0🧩`**.

> ⭐⭐⭐⭐⭐ **CẬP NHẬT 02/09/2026 (`?v=41`) — MÀN CHẤM: KEEP/ACCEPT VÀO TRONG Ô LỖI + LUẬT
> "CHÍNH CHỦ QUYẾT".** Tám việc thầy giao trong một phiên. Gọn nhất:
>
> - **Hai nút "Keep Issue" / "Accept Appeal"** nay ở hàng cuối của chính ô lỗi (trước nằm trong
>   pop-up cạnh avatar). Keep bấm ăn ngay · Accept hỏi lại một nhịp · **đổi ý thoải mái kể cả sau
>   khi đã gửi** (đổi xong nhớ bấm UPDATE). Chỉ hiện ở ô còn tranh chấp THẬT.
> - ⭐ **LUẬT CHÍNH CHỦ QUYẾT**: lỗi ghi tên bạn A mà chính A đã AGREE thì CHỐT là lỗi thật —
>   phiếu DISAGREE của đồng đội chỉ còn là tham khảo (vẫn hiện, chỉ hạ màu). Ô đó sang **viền
>   xanh lá**, hết hai nút, không tính vào REQUIREMENT. Màn phản biện thêm ô lọc thứ ba
>   **"TEAM CONFLICT"** cho đúng nhóm này. ⛔ Luật này **chép sang `myLesson/web/sp-chitiet.html`
>   (web v1.40.0)** — sửa một bên phải sửa bên kia; tab "Kết quả" app mySpeaking **cố ý chưa
>   theo** (thầy sẽ dựng lại tab đó), số của nó lệch là biết trước, không phải lỗi.
> - **"DISAGREEMENT: n" → "REQUIREMENT: n"**, hết việc thì "NO REQUIREMENT" xanh lá nhạt.
> - **Bỏ hẳn nút thùng rác + nút "Delete all"**: xoá nay phải bấm bút chì rồi **xoá trắng cả 3 ô**
>   SENTENCE/MISTAKE/EXPLANATION, nút đỏ tự đổi thành "Delete this mistake". ⛔ Đừng dựng lại.
> - **Số thứ tự câu đứng yên** khi bật nút dồn (trước nhảy loạn); câu đã Accept **không chìm
>   xuống cuối** nữa. **Avatar đầu trang = ảnh chính em**, không còn ảnh thầy. Nút UPDATE vàng
>   **thôi nảy to-nhỏ**, đổi sang hào quang vàng.
>
> Nhật ký đầy đủ + cách kiểm: `GHI CHU DU AN.md` mục cuối **CHẶNG 02/09/2026**. ⚠️ Đợt này kiểm
> trên **dữ liệu Firestore THẬT** (lớp A2B, buổi BEAVERS AND DAMS) chứ không phải dữ liệu giả,
> nhưng **chưa ai bấm tay bằng chuột/ngón tay** và **cố ý chưa bấm UPDATE gửi thật**.
>
> 🔑 **CÁCH VÀO APP THẬT ĐỂ THỬ** (rất hay phải dùng lại): đăng nhập bằng **mã lớp thật**, còn ô
> **"Class code" ĐỂ TRỐNG** — `spBuoi.code` trong kho đang là chuỗi rỗng. Muốn vào thẳng **màn
> PHẢN BIỆN** thì tự dựng link `?goi=<base64url>` với `{v:1, ten, team, cham, members, video,
> lesson, classCode, tenLop, kho:'fs', mh:2, pb:1}`. Ca hiếm không có trong dữ liệu thật thì chép
> `index.html` ra `ZTEST-*.html` + chèn **shim `window.fetch` TRƯỚC thẻ `<script>` của app** để
> bơm bản ghi giả **chỉ trong RAM tab** (không ghi một byte nào lên kho), xong xoá file.
>
> 🔗 **Bàn giao phía myLesson của cùng đợt này**: `myLesson/app/BAN GIAO.md` mục **`0👤`** — ở đó
> có trang chi tiết SP CHECK dựng lại, avatar trên thanh, và 7 cái bẫy chung.
>
> ⭐⭐⭐⭐ **CẬP NHẬT 29/08/2026 (`?v=40`, LIVE, đã so mã băm khớp) — LÀM LẠI TOÀN BỘ MÀN PHẢN
> BIỆN theo 6 đợt phản hồi liên tiếp của thầy trong cùng một phiên.** Đọc mục **"Màn PHẢN BIỆN —
> trạng thái hiện tại"** bên dưới để biết NGUYÊN VĂN hành vi đang chạy (nút SUBMIT/UPDATE 4 trạng
> thái, ô gửi riêng cho từng câu phản đối + lưu nháp cục bộ, khung vàng chỉ-viền/có-nền phân biệt
> đã-vote hay chưa, nút ALL/MINE hiện số + tự cuộn tới câu chưa xác nhận). Nhật ký đầy đủ 10 đợt
> (từ `?v=31` tới `?v=40`, mỗi đợt 1 commit riêng): `GHI CHU DU AN.md` mục cuối cùng — **CHẶNG
> 29/08/2026: LÀM LẠI MÀN PHẢN BIỆN**. ⚠️ Toàn bộ đợt này build xong **kiểm bằng trang thử độc
> lập** (chép logic thật ra ngoài + Tailwind/Lucide thật, KHÔNG đoán mò — có bắt được ít nhất 2
> lỗi thật qua cách này, xem mục "Bẫy đã tránh"), **CHƯA có ai bấm tay trên buổi Firestore thật**.
>
> ⭐⭐⭐ **CẬP NHẬT 28/08/2026 khuya (?v=30) — MÀN PHẢN BIỆN: BẮT BUỘC VOTE LỖI CỦA CHÍNH MÌNH.**
> Thầy chốt: em đang phản biện (đội bị chấm) **buộc phải AGREE hoặc DISAGREE** cho MỌI lỗi mà
> `who` ghi đúng TÊN MÌNH — lỗi ghi tên đồng đội khác thì vẫn **tuỳ ý**, không bắt buộc. Đã sửa
> `submitPb()` (chặn nộp + toast + cuộn tới đúng câu còn thiếu, dùng lại `flashBox` có sẵn) và
> `renderErrorsPb()` (câu "YOUR MISTAKE" tô viền vàng khi chưa vote). Xem chi tiết ở
> `GHI CHU DU AN.md` mục cuối cùng.
>
> ⭐⭐ **CẬP NHẬT 26/08/2026 — ĐỢT FIREBASE (đọc chặng cuối `GHI CHU DU AN.md` trước):** kho bài
> nộp cho buổi MỚI đã chuyển sang **Firestore `aword-70dae`** (`spBuoi/{LOP_BAI}/baiNop/{sid}`,
> khối "KHO FIRESTORE" đầu `js/app.js`). Bộ não Apps Script + toàn bộ mô tả Sheets bên dưới CHỈ
> còn đúng cho buổi CŨ (đường lùi — vẫn phải giữ sống, ĐỪNG gỡ). Chưa dán luật Firestore thì web
> tự rơi về đường cũ, không vỡ gì.
>
> ⚠️ **CẬP NHẬT 19/07/2026 — ĐỌC `GHI CHU DU AN.md` mục CHẶNG 17 + ⭐HANDOFF TRƯỚC.** Từ chặng 17, mô hình dữ liệu đã ĐỔI so với phần lớn mô tả cũ bên dưới file này:
> - **Cấu hình bài đọc LIVE** từ Apps Script `?config=1` (file Google Sheet "MYSPEAKING - CẤU HÌNH": CLASSES + LESSONS) — KHÔNG còn dùng `data/classes.json` (chỉ còn là dự phòng).
> - **(CHẶNG 21, 20/07/2026 — Phiên bản 5): MỖI LỚP MỘT SHEET BÀI RIÊNG `LESSONS <LỚP>`** trong file CẤU HÌNH (8 cột giữ nguyên, cột CLASS là lưới an toàn); sheet `LESSONS` gộp cũ đã đổi tên `LESSONS CU (da chuyen)`. Đủ 8 lớp có sheet riêng + file kết quả (`mySpeaking Sheets\<lớp>`). Lệnh quản trị `action:'setup'` chia lớp idempotent. Giao ước `?config=1` / `adminPush` / `adminResults` / bài nộp HS KHÔNG đổi.
> - **Dữ liệu lưu = TIẾNG ANH** (TYPE = Grammar/Pronunciation/Information); bài nộp route về **file mỗi lớp → sheet tên LESSON + sheet TIME chung** (KHÔNG còn 1 Sheet phẳng "SPEAKING CHECK - BÀI NỘP"); Excel export khớp mẫu tiếng Anh mới.
> - **Video phát cho HS = YouTube unlisted** (KHÔNG còn phát Drive trực tiếp — Drive giới hạn tải file lớn; Drive chỉ giữ kho gốc). App tự nhận link youtube/youtu.be trong cột VIDEO của LESSONS.
> - Dữ liệu ở Drive tài khoản **namdaptrai01** (= ổ D: mirror): `D:\APP AND DATA\mySpeaking Web\mySpeaking Data\`.

## Mục đích
App web tĩnh (GitHub Pages) cho học sinh xem video thuyết trình speaking của đội bạn và **bắt lỗi** (Grammar / Pronunciation / Information) + ghi **thời gian nói** của từng bạn. Dữ liệu nộp về Google Sheet của thầy, đồng thời có nút xuất file Excel đúng mẫu `SPEAKING TEAM CHECK FORM.xlsx` (2 sheet TIMER + FORM).

**Tên site (chặng 28, 21/07/2026): "Speaking in Andrew Classes"** — title tab + thẻ đăng nhập ("Speaking" gradient tím-hồng + dòng nhỏ "in Andrew Classes") + header app. **Logo = `img/logo-site.png`** (ảnh chibi thầy chọn, 256px thu từ `D:\OTHERS\OTHERS\AVATAR\OK CHIBI - TRON.png`, kiêm favicon). Đổi tên/logo KHÔNG đụng chuỗi dữ liệu (tên file Excel export, sheet names — vẫn SPEAKING CHECK/TIMER/FORM).

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
data/classes.json — ⛔ ĐÃ BỎ 02/09/2026 (bảo mật A5: kho PUBLIC, file lộ mã lớp + tên HS). Lớp nay đọc từ Firestore `spBuoi` rồi Apps Script ?config=1
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
  - Dữ liệu lớp đọc từ Firestore `spBuoi` → Apps Script `?config=1` (file tĩnh `data/classes.json` đã bỏ 02/09/2026). Cấu trúc: `{classes:[{id,name,classCode,code,topic,teams:[{team,video,members[]}],pairs:[{checker,checked}], photos?:{TÊN:url}}]}`. Chặng sau app máy tính sẽ TỰ SINH file này.
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

## CHẶNG 35 (22/07/2026) — MỚI NHẤT, `?v=25` · Apps Script **Phiên bản 8**
- ⛔ **KHÔNG tự mở bài đã nộp.** `?mine=1` nay trả **`lansNop[]`** (gom theo SUBMISSION ID: `sid`,
  `luc`, `errors[]`, `timers[]` — timers ghép theo đúng sid; mới nhất trước). Web mở
  **`#historyModal`** hỏi "We found N submitted checks…" → chọn 1 bản mới nạp (`openServerSub`) +
  khoá xem; "start a new check" = làm bài mới. `errors`/`timers` gộp vẫn trả để web bản cũ không gãy.
- **3 dòng mỗi lỗi**: SENTENCE (đen/đậm/nghiêng) → MISTAKE (`text-rose-600` đậm) → EXPLANATION
  (`text-emerald-600` đậm).
- **Pop-up nộp**: icon đơn sắc `text-slate-400`, bỏ dòng "Students timed"; **≤ `IT_LOI` (15)** lỗi →
  số tô đỏ + hiện **`#fewMistakesModal`** hỏi lại (Return to check / Submit).

## CHẶNG 34 (22/07/2026) — `?v=24`
- **Chữ "CLASS" CHỈ ở màn đăng nhập/xác nhận.** Dòng dưới video dùng `tenLopNgan()` bỏ tiền tố
  `CLASS `/`Lớp ` — **chỉ đổi HIỂN THỊ**, `state.className` và dữ liệu nộp lên giữ nguyên.
- **Dòng dưới video LUÔN 1 DÒNG**: `#videoStatus` = `flex-nowrap whitespace-nowrap min-w-0
  overflow-hidden` (không còn class cỡ chữ) + **`fitVideoInfo()` tự hạ cỡ 14/13px → sàn 9px**.
  Chạy ở `setVideoStatus`, lặp lại sau **350ms** (khung video desktop giãn xong mới đo đúng) và khi
  `resize` (debounce 120ms). Đội 3 người ở màn 320px → tự về 10px, không tràn.

## CHẶNG 33 (22/07/2026) — `?v=23`
- ⛔ **MỖI HỌC SINH MỘT Ô NHỚ RIÊNG**: `makeSaveKey(student, videoUrl)` = `myspeaking_<TÊN>_<video>`.
  Khoá cũ chỉ theo video ⇒ **2 em cùng đội dùng chung ô nhớ, em sau ĐÈ MẤT bài em trước**. Lịch sử
  lọc bằng `submittedSaves(state.student)` (so trường `student` bên trong, nên bài khoá cũ vẫn nhận
  đúng chủ). **Đừng bao giờ đặt khoá lưu chỉ theo video.**
- Ô đếm dùng chữ cái `TYPE_STYLE[t].short` = G/P/I (tên đầy đủ làm lòi khung máy nhỏ) · mỗi lỗi có
  **STT theo thứ tự thời gian** (`sortedPositionOf` quy đổi vì `state.errors` giữ thứ tự thêm vào).
- **Xoá phải hỏi**: `#delOneModal` (1 lỗi) · `#delAllModal` (nút `#btnDelAll` đáy khung, ngoài vùng
  cuộn, tự ẩn khi trống/đang xem lại). Xoá lỗi đứng trước lỗi đang sửa thì `editingIndex--`.
- **Header luôn 1 hàng** (không `flex-wrap`): <640px = "SP in Andrew Classes" + Submit icon + ẩn
  Export; ≥640px = đủ chữ + Export **icon bên phải Submit**.
- Bỏ hết dấu sao đỏ trong khung check lỗi (luật bắt buộc giữ nguyên) · sàn khung lỗi 12rem ·
  placeholder mobile 13px (16px chỉ cần cho Ô NHẬP để chặn iOS tự zoom).

## CHẶNG 32 (21/07/2026 đêm) — luồng vào app + kéo bài đã nộp (`?v=22`)
- **Luồng vào**: đăng nhập (class + code) → chọn Team + Name → **trang tích cam kết** — trang này có:
  tiêu đề "**CLASS** B1AH — GERMS" (chữ CLASS do `fixClassNames()` chuẩn hoá lúc nạp config, sheet
  NAME vẫn ghi "Lớp ..."), nút Start, **nút back CHỈ ICON** (`#btnBackNames`), và **lịch sử MY
  SUBMITTED CHECKS** (`#reviewSection` — đã CHUYỂN từ màn đăng nhập sang đây; `renderReviewSection()`
  gọi trong `handleNamePick`; `openReview` ẩn cả `identifyScreen`).
- **Kéo bài đã nộp về form (`maybeRestoreFromServer`)**: máy không có dấu vết bài → GET `?mine=1`
  (cửa `baiDaNop` trong Code.gs, gộp hợp mọi lần nộp) → đổ lỗi + bảng giờ về form + khoá xem
  chặng 29. Mạng hỏng/8s/bộ não cũ → vào bài bình thường. **Cần deploy Code.gs mới có tác dụng.**
- **Cảnh báo nộp thiếu**: `doPost` so lượt mới với lượt nộp gần nhất (nhóm theo SUBMISSION ID) →
  `canhBaoNopThieu:{truoc,nay}` → web hiện `#fewerModal`. Không bao giờ chặn bài.

## Màn bắt lỗi — trạng thái hiện tại (sau chặng 10-16b, thầy nói "ok rồi")
- **Đăng nhập/chọn tên (chặng 16)**: MÀN 1 gõ classCode+code (sai→pop-up). MÀN 2 = **2 ô cạnh nhau Your Team + Your Name** (`#selTeam`/`#selName`; Name KHÓA đến khi chọn Team → `onTeamChange` mở khóa; chọn Name → xác nhận ngay). MÀN 3 xác nhận: ảnh HS (tạm chữ đầu) + tiêu đề động **"{Tên HS}, Andrew has something for you."** (`#identNoteTitle`) + ô tích BẮT BUỘC "I understand and respect our journey, teacher Andrew ❤️".
- **Bố cục GHIM**: desktop ≥1024px khoá `100dvh` — video + form đứng yên, CHỈ "Mistakes found" cuộn (CSS riêng `#appScreen:not(.hidden)`; KHÔNG dùng `lg:flex` cho phần tử toggle `.hidden` — bẫy cascade). Mobile: header cuộn qua, CỤM VIDEO sticky top-0. 2 cột desktop BẰNG chiều ngang (`grid-cols-2`), video cân cao form (~522/521).
  - ⚠️ **BẪY chặng 27 (21/07/2026):** `<main>` PHẢI là **`lg:items-stretch`** — chặng 15 lỡ đổi sang `items-start` làm cột nhập liệu cao theo NỘI DUNG (không bị khoá theo màn) → danh sách lỗi dài bị `overflow-hidden` cắt cụt, HS không cuộn/không sửa lỗi được trước khi Submit (test 1-2 lỗi thì KHÔNG lộ — phải test nhiều lỗi). Kèm 2 gia cố: cột nhập liệu có `lg:overflow-y-auto` (van an toàn màn thấp), khung Mistakes found sàn `lg:min-h-[10rem]` (arbitrary value cho chắc với Tailwind CDN).
  - **Chặng 29→30 (21/07/2026): VIDEO CAO BẰNG CHỈ KHUNG FORM** (không tính Mistakes found — thầy chốt qua mockup): `<main>` desktop = **grid 2 cột × 2 hàng** `lg:grid-rows-[auto_minmax(0,1fr)]` — hàng 1 VIDEO|FORM (items-stretch, form giãn autogrow video bám theo), hàng 2 = Mistakes found `lg:col-start-2 lg:row-start-2` (dưới video ĐỂ TRỐNG). Wrapper cột nhập liệu + `#tab-errors` "tan ra" bằng **`lg:contents`** (media CSS kèm `#tab-errors > *{margin-top:0}`); **van an toàn màn thấp = `<main>` `lg:overflow-y-auto`** (không còn ở wrapper cột). `.video-shell` ≥1024px bỏ aspect-ratio 16:9 cứng (`flex:1`, viền đen như YouTube); videoCtrl/stopwatchWrap/videoStatus `lg:shrink-0`. **Mobile giữ 16:9 + sticky, BÓP ĐỆM khung video** (p-2.5, mt-2.5, py-2, main py-2 space-y-2.5 — tiết kiệm ~65px dọc).
- **XEM LẠI BÀI ĐÃ NỘP (chặng 29)**: không cần đăng nhập, CÙNG THIẾT BỊ — màn đăng nhập có mục **MY SUBMITTED CHECKS** (quét localStorage cờ `submitted`/`wasSubmitted`, tối đa 6 bài mới nhất) → `openReview()` dựng app từ state đã lưu + **khoá xem** (`.review-locked`: form mờ, sửa/xoá/Submit ẩn, banner xanh); nút **Edit & submit again** phải qua modal xác nhận `#editAgainModal` mới mở khoá (`submitted=false`, `wasSubmitted` giữ bài trong danh sách; Submit lại = Sheet có 2 lượt nộp, thầy lọc lượt mới nhất theo SUBMISSION ID/thời gian).
- **Khung điều khiển video luôn hiện** `#videoCtrl`: nút play/pause **TRÒN**, thời gian, thanh tua nút TO + phần đã chạy **ĐỎ fill %** (JS `vcFill`); html5 (event, có `seeked`) + YouTube (poll 300ms); ẩn ở chế độ dự phòng.
- **Form** thứ tự: STUDENT (nút tên 1 hàng, chọn = khung VÀNG; dưới mỗi tên 4 ô giờ nói min:sec→min:sec, mobile 2 tầng) → **TIME** (nhãn CÙNG HÀNG với MIN/SEC ở desktop, mobile xếp tầng) → **TYPE** (nhãn cùng hàng 3 nút; icon TRÁI chữ; chọn = khung vàng) → **SENTENCE*** (câu chứa lỗi, MỚI chặng 15) → **MISTAKE*** → **EXPLANATION*** (SENTENCE/MISTAKE/EXPLANATION = textarea TỰ GIÃN cao, chữ nhỏ = placeholder; đều bắt buộc).
- **TIME ↔ video 2 chiều**: video phát → MIN/SEC chạy theo (`syncTimeFields`); pause gõ tay/kéo tua (kể cả lúc DỪNG) → video + MIN/SEC nhảy (`manualTimeSeek`/`seekVideoTo`/`seeked`). Tự sáng tên HS theo khoảng giờ (`autoPickStudent`). **LUÔN LÙI 3 GIÂY** khi THÊM lỗi mới (`REWIND_SEC`, không lùi khi sửa). **XOÁ MIN/SEC sau khi Add** (`clearErrForm`) — tránh add 2 lỗi chung giờ.
- **Video dự phòng (fallback)**: Drive phát html5 trực tiếp (Drive API key, chờ metadata 25s). Nếu hỏng → iframe Drive + **thanh kéo tay `#swSeek`** (XANH DƯƠNG, nút to gấp đôi, KHÔNG play/pause) + nút **SET TIME** (`swSetTime`) đưa giờ vào MIN/SEC kèm đốm sáng bay (`flyLight`), max 900s. Không còn đồng hồ chạy + không chữ hướng dẫn.
- **Submit chặn 3 tầng**: (1) thiếu ô giờ → viền đỏ + toast; (2) giờ sai — end≤start hoặc 2 HS đan xen (`validateTimerRanges`); (3) modal xác nhận.
- **Header**: logo chibi + ANDREW CLASSES (BẤM = về trang chủ, còn lỗi chưa submit → pop-up `#leaveModal`) + **nút người chấm "HOANG · T1"** (`#hdStudent`, tên·đội, cỡ = Export, không icon; đã BỎ badge TEAM X) + Export + Submit.
- **CẤU TRÚC DỮ LIỆU (payload/Sheet/Excel) + việc THỐNG NHẤT sắp tới**: xem mục **⭐ KHUNG DỮ LIỆU** trong `GHI CHU DU AN.md`. ✅ **Ô SENTENCE ĐÃ ghi vào Google Sheet từ CHẶNG 17** (`Code.gs`: header dòng 53 có `SENTENCE`, hàng ghi dòng 141 có `er.sentence`) — ghi chú cũ nói "chưa map" là **đã lạc hậu**, đừng đi sửa lại.

## Màn PHẢN BIỆN — trạng thái hiện tại (sau đợt 29/08/2026, `?v=40`, CHỈ mô hình 2/Firestore)
> `state.cheDo === 'phanbien'` → `renderErrorsPb()`. Toàn bộ mục này chỉ áp dụng buổi mô hình 2
> (Firestore, từ 26/08/2026) — buổi mô hình cũ (Sheets) không có màn này.
- **Nút SUBMIT/UPDATE 4 trạng thái** (`capNhatNutSubmit()`, dùng chung với màn CHẤM): TRẮNG
  "SUBMIT" (chưa nộp lần nào, chưa sửa gì) → VÀNG nhấp nháy "SUBMIT" (chưa nộp, có sửa chờ gửi)
  → XANH "SUBMITTED" (vừa nộp lần ĐẦU) → VÀNG nhấp nháy "UPDATE" (đã nộp, có sửa mới) → XANH
  "UPDATED" (vừa nộp lại). "SUBMIT" chỉ hiện TRƯỚC lần nộp đầu tiên, sau đó mãi mãi là "UPDATE"
  (đọc cờ `m2.daNopLanNao`/`m2.votesServer`, không reset).
- **Mỗi câu tranh chấp có Ô GỬI RIÊNG** (không còn 1 nút Submit gộp mọi lý do phản đối như bản
  cũ): chọn DISAGREE → hiện `<textarea data-pblydo>` hẹp + icon `send-horizontal` màu đỏ ĐÈ
  TUYỆT ĐỐI góc phải (position:absolute + top-1/2/-translate-y-1/2 + **`block`** trên textarea —
  ⛔ THIẾU `block` là `<textarea>` mặc định `inline-block` làm khung cha phình ~6px theo line-box,
  icon nhìn lệch dù CSS căn giữa tính đúng, xem CHẶNG 29/08 mục "Bẫy"). Gõ xong bấm icon (hoặc
  Enter không giữ Shift) mới CHỐT — nội dung KHÔNG hiện thường trực trong ô, chỉ hiện sau khi gửi
  thật trong "danh sách phản biện" ngay phía trên (chính chủ luôn đứng đầu, tên tô vàng `amber-600`,
  có icon bút sửa lại — sửa+gửi lại THAY nguyên dòng cũ, không đẻ dòng mới). Gửi xong có hoạt cảnh
  chữ "bay" từ ô lên đầu danh sách (`flyPhanBien()`, cùng khuôn Web Animations API với `flyLight()`
  có sẵn).
- **Lưu nháp cục bộ** (`m2.draftPb`, khoá `myspeaking_draftpb_<buoiId>_<student>`): gõ dở CHƯA
  gửi vẫn còn khi thoát/tải lại trang — nạp lại trong `startPb()`. ⚠️ Câu nào có nháp mà CHƯA
  từng bấm DISAGREE thật thì phải **TỰ CHỌN LẠI DISAGREE** hộ (gán `m2.votes[id]={y:'phanDoi',
  lyDo:''}`) — không thì nút mất trạng thái chọn sau khi tải lại, ô đang giữ nháp không hiện ra.
- **Khung "YOUR MISTAKE" (`laCuaMinh`)**: viền vàng dày `border-4` LUÔN có (dù đã vote hay chưa)
  để còn phân biệt với câu của bạn khác giữa danh sách; **nền vàng đặc `bg-amber-100/70` CHỈ còn
  khi CHƯA vote** (`canVoteBatBuoc`) — đã AGREE/DISAGREE thì bỏ nền, chỉ còn viền, mới phân biệt
  được câu xong với câu chưa (thầy chốt sau khi thấy bản đầu tô nền cả 2 loại, không phân biệt được).
- **Chỉ chính chủ mới AGREE được** — lỗi `who` không phải mình thì nút AGREE bị ẨN hẳn, chỉ còn
  DISAGREE (`who` luôn có sẵn vì màn CHẤM bắt buộc chọn, không có ca rỗng).
- **STT đổi màu theo đồng bộ** (`daDongBoPhieu()`, so `m2.votes[errId]` cục bộ với bản đã đồng
  bộ `m2.votesServer`): xanh lá ĐẬM `bg-emerald-500` = đã đồng bộ (hoặc chưa đụng tới) · xám nhạt
  = có sửa cục bộ chưa gửi. Vừa Submit xong: các câu vừa gửi đứng icon ✓ đúng 1 giây (`m2.vuaGuiPb`
  + `setTimeout` 1000ms) rồi mới về số.
- **Nút ALL/MINE** (`#btnPbLoc`, dạng chia đôi thật — 2 `<button data-loc="all"/"mine">` trong 1
  khung bo tròn, bên đang chọn sáng indigo, bên kia xám mờ) THAY HẲN tiêu đề "Mistakes found" (ẩn/
  hiện qua CSS `.pb-mode`, không cần JS mỗi lần đổi màn). Hiện thêm SỐ CÂU sẽ thấy khi bấm sang
  bên đó, luôn đỏ: `"ALL • 120"` / `"MINE • 65"`. ALL lọc `m2.dsCham` đủ cả đội; MINE lọc
  `who === state.student`.
- **Badge UNCONFIRMED** (`#btnPbThieu`, luôn hiện, không cần bấm Submit mới thấy) đếm theo ĐÚNG
  chế độ đang xem: ALL đếm CẢ ĐỘI (mỗi câu tính theo chủ nhân thật `e.who`, tra trên `m2.phanHoi`
  đã đồng bộ của MỌI người) · MINE chỉ đếm của chính em (`m2.votes` cục bộ, dùng chung với chốt
  Submit). Bấm badge, mở màn phản biện, hoặc đổi ALL/MINE đều tự **cuộn tới câu ĐẦU TIÊN chưa xác
  nhận** (`cuonToiCauChuaXacNhan()`, tìm `[data-pbunconfirmed="1"]` đầu tiên theo DOM — đúng thứ
  tự thời gian video) — bấm badge cuộn NGAY, hai trường hợp kia hiện bình thường 1 giây rồi mới
  cuộn (`setTimeout` 1000ms), không cuộn gì nếu đã "ALL CONFIRMED".
- **Submit không còn chặn cứng** khi còn câu của chính mình chưa AGREE/DISAGREE — chỉ hỏi lại qua
  `#pbThieuModal` ("Go back and check" / "Submit anyway"), bấm "Submit anyway" gọi thẳng
  `submitPbThatSu()` bỏ qua chốt bắt buộc. Lý do phản đối bị BỎ TRỐNG vẫn CHẶN CỨNG (dữ liệu
  không hợp lệ, khác với "chưa vote" — chỉ là thiếu lý do thì không có gì để hỏi lại).

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
- [x] Dashboard cho thầy xem tổng hợp lỗi theo đội/loại — LÀM XONG 28/08/2026 tối, nhưng đọc
  THẲNG Firestore (không qua Google Sheet như ý tưởng gốc): tab "Kết quả" trong `mySpeaking/app`
  (v1.12.0) + trang `sp-chitiet.html` bên `myLesson/web` (mở từ dashboard.html) — xem
  `mySpeaking/app/GHI CHU DU AN.md` mục 28/08/2026 tối.
- [ ] (Ý tưởng) Chấm chéo: đối chiếu lỗi các HS cùng bắt được ở cùng mốc thời gian
