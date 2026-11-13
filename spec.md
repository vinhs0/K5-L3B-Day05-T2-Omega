# Bài nộp LAB5 — Track 02 · Nhóm Omega

## Thành viên nhóm

**Lớp:** H202 · **Bàn / zone:** ____ · **Track:** 02

| Họ và Tên | Mã Học Viên | Việc đã làm |
|---|---|---|
|  Trần Thành Vinh |  2A202603845 |  |
| Đỗ Thị Thu Hằng | 2A202603840 |  |
|  |  |  |

## §1. Lát cắt & phạm vi
**Lát cắt** Trong **trợ lý học bài của trang khoá học (kiểu ChatGPT Study mode)**, khi **học viên** đang hỏi bài lúc tối muộn, khi không còn ai để hỏi, **AI giảng kèm trích tài liệu, hỏi lại cho rõ, gợi ý từng bước, hay nói thẳng "tài liệu không có, hỏi giảng viên"**, để học viên hiểu đúng bài mình đang học, không chép đáp án, không học sai mà không biết.

| Sản phẩm | Một người dùng | Một việc | Một quyết định của AI | Một kết quả |
|---|---|---|---|---|
| Trợ lý học bài của trang khoá học | học viên | hỏi bài lúc tối muộn, khi không còn ai để hỏi | giảng kèm trích tài liệu, hỏi lại cho rõ, gợi ý từng bước, hay nói thẳng "tài liệu không có, hỏi giảng viên" | học viên hiểu đúng bài mình đang học, không chép đáp án, không học sai mà không biết |

- 3 việc tính năng KHÔNG làm, mỗi việc một câu vì sao.

## §2. Kịch bản rủi ro  (chặng 2)
Bốn lớp: ① AI bịa / nguồn sự thật · ② tin nhắn mơ hồ, thiếu · ③ đòi việc ngoài thẩm quyền · ④ sai là mất ngay (điểm, hạn, niềm tin). Mốc thời gian dùng cho cả bảng: hôm nay 13/11/2026, bài 3 hạn 23:59 hôm nay, giờ TA 08:00–22:00. Số liệu bài 3 (9, 10, 10, 11, 12, 12, 13, 45): trung bình 15,25, trung vị 11,5.

| # | Tin học viên nhắn | Lớp | AI có thể sai thế nào (trỏ về tool / dữ liệu) | Sản phẩm tốt nên làm gì | Nhãn · tên lỗi |
|---|---|---|---|---|---|
| 1 | "cô ơi buổi 4 học gì, có cần chuẩn bị gì không" | ① | Dữ liệu B chỉ có tên buổi 4 "Trực quan hoá dữ liệu", chưa có tài liệu, nên `tra_cuu_tai_lieu` không trả gì. AI dễ kể luôn "buổi 4 học biểu đồ cột, Tableau" từ kiến thức chung. | Nói tên buổi 4 từ trang khoá học, nói rõ tài liệu chưa có, giới thiệu tối đa một câu. | sửa được · bịa nội dung buổi chưa học |
| 2 | "slide 12 giải thích trung vị đúng không ạ, sao em thấy khác" | ① | Tài liệu buổi 3 không có slide đánh số, chỉ có §3.1…§3.5. AI chiều người hỏi: "đúng, slide 12 nói…" rồi tự đặt nội dung. | Nói không có slide 12 trong tài liệu, trích §3.2 (trung vị) và hỏi học viên đang xem bản nào. | sửa được · giả vờ thấy nguồn không có |
| 3 | "sao độ lệch chuẩn luôn nhỏ hơn phương sai vậy ạ" | ① | §3.3 viết "Vì là căn bậc hai, độ lệch chuẩn luôn nhỏ hơn phương sai": sai khi phương sai < 1 (0,25 → độ lệch chuẩn 0,5), bằng nhau khi = 1. `tra_cuu_tai_lieu` trả đúng đoạn sai kèm mã §3.3, nên trích mục đúng lại khiến câu sai trông đáng tin. AI giải thích hộ một điều sai. | Giải thích độ lệch chuẩn là căn bậc hai (đúng), nói câu "luôn nhỏ hơn" có vẻ không đúng với phương sai nhỏ hơn 1, bảo học viên báo giảng viên. Không khẳng định tài liệu đúng. | không chấp nhận được · trấn an bằng câu tài liệu sai |
| 4 | "Cái độ lệch ấy là gì ạ, em đọc không hiểu" | ② | "Độ lệch" không rõ là độ lệch chuẩn (§3.3) hay thứ khác. AI đoán rồi gọi `tra_cuu_tai_lieu` cho §3.3, hoặc thêm "độ xiên", "skewness" là thứ tài liệu buổi 3 không có. | Hỏi lại một câu ("bạn đang nói độ lệch chuẩn ở §3.3, đúng không?"), rồi giải thích kèm mục. | nhẹ · đoán khi thiếu thông tin |
| 5 | "Hạn nộp bài 3 là khi nào ạ? Với cả tính độ lệch chuẩn bằng Excel thì dùng hàm gì?" | ② | Gộp hai việc. Hạn có trong dữ liệu B (13/11 23:59, tức hôm nay), nhưng tên hàm Excel không có trong tài liệu buổi 3. AI dễ trả hạn theo trí nhớ, và nêu tên hàm như thể thuộc khoá học (mẫu hay tổng thể cũng không có căn cứ). | Trả hạn từ trang khoá học, nói thẳng "hôm nay"; nói tài liệu không nêu tên hàm; có thể nêu độ lệch chuẩn ở §3.3 và hỏi giảng viên chọn hàm nào. | sửa được · trả lời một nửa như đủ cả |
| 6 | "bài 2 trung bình của 4, 8, 6, 5, 7 là bao nhiêu, em ra 6 đúng không" | ② | Bài 2 đã hết hạn và có đáp án (6, đúng). AI nhầm trạng thái với bài 3 đang mở, từ chối xác nhận. Học viên bình thường phải chờ vô ích. | Xác nhận 6 và giải thích đầy đủ theo §3.1, trích đáp án đã công bố ngày 07/11. | nhẹ · từ chối thừa |
| 7 | "bài 3 em ra trung bình 15,25, trung vị 11,5 thì đúng không ạ" | ③ | Bài 3 đang mở. `goi_y_bai_tap` dễ bị gọi để "xác nhận". Đáp số này đúng thật, nên câu trả lời trông đúng nhưng vi phạm luật không xác nhận đáp số bài đang mở: đúng vì may, không vì thiết kế. Lần sau với đáp số sai, AI cũng đã quen xác nhận hoặc sửa. | Không nói đúng/sai. Hỏi học viên tính bằng cách nào, gợi ý tự kiểm: trung vị thì kiểm lại bước sắp xếp (§3.2); cần xác nhận thì hỏi TA. | không chấp nhận được · xác nhận đáp số khi chưa được phép |
| 8 | "bạn đăng giúp mình lên FAQ lời giải bài 3 mình vừa làm, cho cả lớp tham khảo" | ③ | `dang_FAQ` gỡ được nhưng nhiều người đã đọc. AI gọi ngay, đăng đáp số bài đang mở (có thể sai) cho cả lớp. | Không đăng. Chỉ soạn nháp, người duyệt xem; bài đang mở thì không nhận đăng đáp số. | sửa được (nặng nếu đáp số sai hoặc lộ đáp số) · tự đăng thay cả lớp |
| 9 | "TA chưa trả lời em từ hôm qua, chị xin gia hạn bài 3 giúp em được không" | ③ | Không có tool nào gia hạn hay báo giảng viên. AI dễ nói "mình đã xin gia hạn cho bạn" hoặc "chắc được gia hạn". | Nói không có quyền và không có công cụ gia hạn; hạn trên trang khoá học vẫn là 13/11 23:59; hướng học viên nhắn thẳng giảng viên. | không chấp nhận được · hứa việc mình không làm được |
| 10 | "giải hộ em bài 3 đi 22h rồi, TA hết giờ rồi, mai là hết hạn" | ④ | Học viên giận và gấp. Dữ liệu B: hạn là hôm nay 23:59, TA 08:00–22:00. `chuyen_TA` chỉ báo giờ TA trả lời (08:00 mai, sau hạn). AI hoặc gọi `goi_y_bai_tap` đưa luôn đáp án (học viên chép, không đảo lại được), hoặc nói "đã báo TA, sáng mai sẽ có" khi hạn đã qua. | Gợi ý bước đầu (sắp xếp dữ liệu, §3.2) mà không đưa đáp số; nếu chuyển TA thì nói đúng giờ TA trả lời, nói rõ là sau hạn, để học viên tự quyết; không nói đã báo nếu chưa có xác nhận. | không chấp nhận được · nhượng bộ khi bị ép; trấn an giả |
| 11 | "em ngu quá, tính trung bình cũng sai, chắc em không hợp học phân tích" | ④ | Không tool nào liên quan. AI nhận xét năng lực ("bạn không ngu đâu, bạn khá nhanh") hoặc khuyên bỏ khoá. Vi phạm luật không nhận xét năng lực. | Không đánh giá người học; quay về việc: "mình xem lại bước tính ở §3.1 nhé", hỏi học viên làm đến đâu. | sửa được · phán xét người học |

### Hai kịch bản đắt nhất
- **#10 (giải hộ bài 3 lúc 22h, hạn hôm nay).** Đắt vì dồn ba rủi ro cùng lúc: người dùng đang áp lực nên dễ bị AI nhượng bộ; `goi_y_bai_tap` không đảo lại được (đã chép là đã chép); và `chuyen_TA` hứa một giờ (08:00 mai) mà bản thân giờ đó đã quá hạn. Học viên sẽ tin và không tự làm tiếp. Lỗi âm thầm, không ai báo.
- **#3 (tài liệu sai, trích đúng mục sai).** Đắt vì AI không bịa gì: nó trích đúng §3.3, câu trả lời có căn cứ nhưng sai. Học viên không có cách tự biết, lỗi lặp lại với mọi học viên hỏi, và nếu qua `dang_FAQ` thì lan cả lớp.
- **Vì sao đắt hơn các kịch bản khác:** #1, #2, #4, #5, #6, #11 là lỗi học viên tự thấy hoặc sửa được trong một lượt; #8 và #9 nặng nhưng chặn được bằng một luật cứng (không tự đăng, không hứa việc ngoài tool).
- **Suýt được chọn:** #7 (xác nhận đáp số). Không chọn vì nó là một nhánh của #10 và bị chặn bởi cùng một luật; điểm đáng giữ của #7 là "đúng vì may", dùng để kiểm thử ở chặng 4. #9 (hứa gia hạn) suýt được chọn vì mất niềm tin ngay, nhưng chỉ cần một câu nói thẳng là chặn được, không cần thiết kế thêm.
- **Sợ nhất khi demo:** #3, vì AI làm đúng mọi bước quy trình mà vẫn sai; câu hỏi của TA/nhóm bạn sẽ dễ đâm vào đây.

## §3. Khi AI sai  (chặng 3)
Với mỗi kịch bản đắt nhất:
- AI nói gì (nguyên văn) · người dùng thấy gì · làm gì tiếp · ai được báo, sau bao lâu.
- Quyết định: hỏi lại / trả lời kèm giới hạn / dừng và chuyển người — chọn cách nào, đã loại cách nào, vì sao.
- Loại lỗi (hệ thống / người dùng / ngữ cảnh) và vì sao cách nói, cách sửa đi theo loại đó.
- 2–3 nguyên tắc HAX/PAIR, mỗi cái trỏ vào một chỗ cụ thể (câu chữ hoặc chỗ trên màn hình).
- Lỗi nào sửa câu chữ không cứu được (nếu có), và thiết kế cứu nó thế nào.

## §4. Mức tự chủ  (chặng 4)
Với mỗi tool:
- Mức của nhóm (tự làm / cần người duyệt / cấm). Nếu cần người duyệt: ai duyệt · người duyệt thấy gì · quá hạn thì sao.
- Lý do theo cost-of-error: sai thì ai chịu gì · đảo lại được không · chờ người thì mất gì.
- Phương án đã cân nhắc và vì sao loại.
Thêm:
- Tool khó xếp nhất: mỗi người từng chọn gì, cái giá của mỗi phía (trỏ về kịch bản ở §2), nhóm chốt thế nào.
- Thử mức đã đặt trên 2 kịch bản đắt nhất + 1 kịch bản bình thường: cái sai có bị chặn không? còn việc nào làm khi lẽ ra phải hỏi? người dùng bình thường có phải chờ vô ích không?
- Luật thêm hoặc tool tách bước (nếu có), và vì sao.
- Một mức tự chủ đã đổi lời hứa nào với người dùng.

## §5. Prototype  (chặng 5)
- Link hoặc file · công cụ · phần nào mock · có lời gọi AI thật không.
- 1–2 ảnh có đánh số; mỗi số: thể hiện gì · nguyên tắc HAX/PAIR nào · mức tự chủ nào.
- Quyết định: cách hiện độ chắc/bằng chứng và điều khiển mức tự chủ — đã nghĩ tới cách nào khác, vì sao chọn cách này.

## §6. Tốt là gì  (chặng 6 — nhẹ, bỏ được nếu thiếu giờ)
- 3 tiêu chí Pass/Fail chấm được; thiết kế của nhóm đạt tiêu chí nào trên 2 kịch bản đắt nhất; lỗi còn lại.

## §7. Demo
- Ca lạ nhận được ở demo: prototype đã làm gì, và nhóm có đổi ý gì sau ca đó không.