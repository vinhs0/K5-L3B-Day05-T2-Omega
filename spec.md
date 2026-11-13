# Bài nộp LAB5 — T2 Giáo dục · Nhóm Omega
[Danh sách thành viên và việc mỗi người làm — copy bảng từ README]

## §1. Lát cắt & phạm vi

**Lát cắt.** Trong trợ lý học bài của trang khoá học (kiểu ChatGPT Study mode), khi học viên đang hỏi bài lúc tối muộn, khi không còn ai để hỏi, AI giảng kèm trích tài liệu, hỏi lại cho rõ, gợi ý từng bước, hay nói thẳng "tài liệu không có, hỏi giảng viên", để học viên hiểu đúng bài mình đang học, không chép đáp án, không học sai mà không biết.

### Câu hỏi 1 — Ai, việc gì, AI quyết định gì?
- **Ai:** học viên khoá "Nhập môn phân tích dữ liệu" (đang học buổi 3), hỏi bài lúc ~22:00 trở đi. Người đọc thứ hai: giảng viên/TA, cần biết trợ lý dựa vào mục nào và khi nào phải có người vào.
- **Việc:** hiểu một khái niệm trong tài liệu hoặc làm bài tập khi TA đã hết giờ (TA làm 08:00–22:00).
- **Quyết định của AI, mỗi lượt:** chọn một trong bốn: (1) giảng kèm trích mục (§3.2…), (2) hỏi lại cho rõ, (3) gợi ý từng bước, (4) nói thẳng "tài liệu không có, hỏi giảng viên" (kèm chuyển TA khi cần).

### Câu hỏi 2 — Hôm nay thế nào, và AI được thêm quyền gì?
- **Hôm nay:** Study mode của ChatGPT hỏi ngược, gợi ý từng bước, kiểm tra hiểu bài. Nhưng nó không biết tài liệu của khoá, không biết hạn bài, không phân biệt bài đang mở với bài đã có đáp án, và không có TA/giảng viên đứng sau nên không có ai để "chuyển". Học viên tự kiểm chứng mọi thứ.
- **Quyền AI được thêm** (so với việc học viên tự làm: tự tìm trong tài liệu, tự xem lịch, tự nhắn TA, tự đăng FAQ):
  - Tự chọn đoạn tài liệu và diễn giải nó (`tra_cuu_tai_lieu`, chỉ đọc).
  - Quyết định gợi ý bao nhiêu cho một bài đang mở (`goi_y_bai_tap`): quá tay là học viên đã chép.
  - Quyết định khi nào đẩy câu hỏi sang TA và hứa giờ trả lời (`chuyen_TA`).
  - Quyết định đăng câu hỏi/trả lời lên FAQ cả lớp (`dang_FAQ`): từ một người đọc thành cả lớp đọc.

### Câu hỏi 3 — AI sai thì ai chịu, chịu gì, hướng nào đắt hơn?
- **Học viên chịu chính:** học sai mà không biết (đáp số sai, khái niệm sai), hoặc mất bài vì kẹt một chữ lúc 22:00 và hỏi muộn thì quá hạn. Lỗi rẻ nhưng **âm thầm**: không ai báo.
- **Giảng viên/TA chịu:** phải gỡ hiểu sai sau khi nó đã lan; mất tin cậy nếu trợ lý trích "slide 12" không tồn tại.
- **Cả lớp chịu** nếu lỗi đi qua `dang_FAQ`.
- **Hướng đắt hơn:** *tự tin mà sai* đắt hơn *thận trọng mà chậm*. Cụ thể:
  - Đưa/xác nhận đáp số bài 3 đang mở (hạn 13/11): học viên chép, mất mục đích học, và không đảo lại được.
  - Khẳng định tài liệu đúng khi nó sai (§3.3 nói "độ lệch chuẩn luôn nhỏ hơn phương sai", sai khi phương sai < 1): lỗi lan đến mọi học viên hỏi.
  - Nói "đã báo TA" khi chưa làm: học viên yên tâm rồi lỡ hạn.
  - Hỏi lại/từ chối thừa chỉ tốn một lượt, đảo lại được. Nên thiên về hỏi/giữ lại hơn là tự làm.

### Câu hỏi 4 — Ba thứ tính năng này sẽ không làm
1. **Không đưa hay xác nhận đáp số bài đang mở** (bài 3, hạn 13/11), cũng không viết nhận xét hộ: học viên chép thì không đảo lại được, và mất đúng cái trợ lý sinh ra để giữ (học viên tự hiểu).
2. **Không tự đăng FAQ cho cả lớp:** một câu trả lời sai sẽ đến nhiều người cùng lúc; gỡ được nhưng nhiều người đã đọc. Trợ lý chỉ soạn nháp, người duyệt mới đăng.
3. **Không trả lời ngoài tài liệu đã mở / không nhận xét năng lực người học:** không giảng nội dung buổi 4+ (chỉ nói buổi nào sẽ học, tối đa một câu), không bàn về nguồn không có ("slide 12"), không tự lấy hạn nộp ngoài trang khoá học, không nói "em học yếu/giỏi". Không có căn cứ thì nói là không có.

### Ghi chú đọc lướt bảng tool (nháp cho chặng 3–4, chưa đặt mức)
- **Chỉ đọc:** `tra_cuu_tai_lieu`.
- **Thay đổi thứ gì đó:** `goi_y_bai_tap` (gửi nội dung cho học viên), `chuyen_TA` (tạo việc trong hàng chờ TA và hứa giờ trả lời), `dang_FAQ` (đăng tin cho cả lớp).
- **Không đảo lại được:** `goi_y_bai_tap`: gợi ý quá tay thì học viên đã chép. Gần nó: `dang_FAQ`, gỡ được nhưng nhiều người đã đọc. Hai tool này cần cẩn thận nhất ở chặng 3–4.
- **Việc học viên sẽ đòi mà không tool nào làm được:**
  - Chấm hoặc xác nhận đáp số bài đang mở.
  - Gia hạn bài, hỏi điểm.
  - Sửa tài liệu khi nó sai (không có tool báo giảng viên).
  - Giảng nội dung buổi chưa mở.
  - Tra "slide 12" hoặc nguồn không có.
  - Gọi TA ngay lúc 23:00 (`chuyen_TA` chỉ báo giờ TA trả lời, không làm TA có mặt).
  - Khi đó AI nói thẳng việc đó nó không làm được và nói ai làm được. Không nói "đã báo", "đã gia hạn" khi chưa có tool nào làm.
