# Trợ lý học bài (AI thật, Gemini) — Track T2 Giáo dục, nhóm Omega

Chatbot chạy thật: backend Node (không cần npm) gọi Gemini bằng function calling, giao diện JS thuần. Dữ liệu khoá học là dữ liệu dựng của track (Dữ liệu A §3.1–§3.5, Dữ liệu B trang khoá học).

## Chạy

```
node src/server.js
```

Mở http://localhost:3000.

- `?demo=10` tự gửi tình huống #10 ("giải hộ em bài 3 đi, 22h rồi, TA hết giờ"); `?demo=3` tự gửi tình huống #3 (§3.3 nghi sai).
- Biến tuỳ chọn: `PORT` (mặc định 3000), `GEMINI_MODEL` (ép dùng một model).
- Khoá API đặt trong `.env` ở thư mục gốc repo: `GEMINI_API_KEY=...`. File này nằm trong `.gitignore`, không commit. Khoá chỉ ở server, không gửi xuống trình duyệt, không ghi log.
- Chọn model tự động: lúc khởi động server gọi ListModels, ưu tiên flash ổn định mới nhất, rồi flash preview, rồi flash-lite. Khi một model trả 429 (hết hạn mức) hoặc 404, server tự thử model kế tiếp (tối đa 9 model) và nhớ model đang chạy được. Tên model hiện trên thanh đầu trang. Không có khoá hoặc Gemini lỗi thì giao diện báo "AI đang lỗi", không giả câu trả lời.

## Vai trò trong hệ thống

| Vai | Tool | Mức tự chủ | Thực thi ở đâu |
|---|---|---|---|
| Học viên | gõ câu hỏi, bấm [Gửi cho TA]/[Thôi], viết "Báo sai chỗ nào?" | người quyết định | UI (duyệt) |
| Trợ lý AI (Gemini) | `tra_cuu_tai_lieu` | tự làm (chỉ đọc) | prompt + guard trích dẫn (server) |
| | `goi_y_bai_tap` bài 2 (hết hạn) | tự làm, giải thích đầy đủ | server (trả đáp án đã công bố) |
| | `goi_y_bai_tap` bài 3 (đang mở) | tự làm, có khoá: một bước mỗi lượt | server (bậc thang gợi ý) + guard đáp số |
| | đưa/xác nhận đáp số bài 3 | cấm, không có tool | guard `chan_dap_so` (server) |
| | `chuyen_TA` | cần học viên duyệt | server không thực thi trong vòng lặp, chỉ trả `pending_action`; chỉ `/api/approve` mới gửi (UI duyệt) |
| | `bao_tai_lieu_nghi_sai` | tự làm (ẩn danh) | server (thêm vào hàng chờ TA) |
| | `soan_nhap_FAQ` | tự làm, chỉ nháp | server (từ chối nháp chạm bài 3 đang mở) |
| TA | Gắn cờ / Bỏ cờ "đang xem xét", Xong, Duyệt đăng / Bỏ FAQ | người duyệt | UI màn hình TA + `/api/ta/action`; `dang_FAQ` không phải tool của AI |

## Các guard (server, áp dụng sau model)

1. `chan_dap_so`: bài 3 đang mở mà câu trả lời có đáp số (15,25 / 11,5 / 122...) hoặc phán đúng/sai kết quả học viên: hỏi lại model một lần, vẫn sai thì thay bằng mẫu an toàn.
2. `chan_hua_suong`: xoá câu hứa "đã chuyển / đã báo TA / đã gia hạn" khi không có tool nào làm việc đó.
3. `bo_trich_dan` / `thieu_trich_dan`: bỏ § mà tool không trả trong lượt; thiếu § hợp lệ thì gắn cảnh báo.
4. `chen_canh_bao_co`: § đang bị TA gắn cờ thì chèn cảnh báo phía trên phần giảng.
5. Tool `chuyen_TA` chỉ là đề nghị: cần học viên bấm duyệt (cổng duyệt, không phải guard văn bản).

## API

- `GET /api/state`: giờ giả lập, hạn bài 3, hàng chờ TA, cờ, FAQ, model, `model_error`.
- `GET /api/section?ma=§3.3`: nguyên văn một mục.
- `POST /api/clock {now}`: đổi giờ giả lập (nút 15:00 / 22:10 / 14/11 08:00).
- `POST /api/chat {session_id, message}`: một lượt chat, trả `reply`, `tool_calls`, `guards`, `tai_lieu`, `canh_bao_muc?`, `pending_action?`, `error?`.
- `POST /api/approve {session_id, action_id, approve, ghi_them?}`: học viên duyệt hoặc huỷ chuyển TA; duyệt lặp lại trả 404.
- `POST /api/ta/action {type: flag|unflag|dismiss|faq_publish|faq_discard, id?, ma_muc?}`.
- `POST /api/reset`: xoá phiên, hàng chờ, cờ, FAQ.

## Các file

- `server.js`: HTTP server, nạp `.env`, API, phục vụ file tĩnh.
- `agent.js`: vòng lặp Gemini, tool, guard, log.
- `course-data.js`: Dữ liệu A và B.
- `chatbot.html`, `chatbot.css`, `chatbot.js`: giao diện (chat, nhật ký tool, màn hình TA, bảng mức tự chủ).
- `index.html`: mẫu của giảng viên (không sửa).
- `logs/ai-calls.jsonl`: mỗi vòng gọi Gemini và mỗi lượt (model, tool, guard, câu trả lời). Không chứa khoá.
- `screenshots/chatbot-ca10.png`, `screenshots/chatbot-ca3.png`: ảnh chụp chạy thật.

## Kịch bản demo 4 phút

1. (0:00) Mở trang, chỉ ra tên model, hạn bài 3 và dòng "Việc mình không làm được".
2. (0:30) Bấm "#10 giải hộ bài 3" (giờ 22:10): AI chỉ cho một bước, nói thật TA trả lời 08:00 sau hạn. Bấm chip § mở nguyên văn.
3. (1:15) Bấm [Chuyển TA]: thẻ xác nhận ghi nội dung và giờ thật; [Gửi cho TA]. Mục "gấp, trước hạn" hiện ở màn hình TA. Nhắc: chưa bấm thì chưa gửi.
4. (2:00) Bấm "#7 xác nhận đáp số": AI không xác nhận; nếu model vi phạm, badge guard hiện ra. Nhật ký tool hiện mức "tự làm (có khoá)".
5. (2:45) Bấm "#3 §3.3 nghi sai": khối cam "Câu cần xem lại", mục "nghi tài liệu sai" tự vào hàng chờ TA. TA bấm [Gắn cờ]. Tải lại trang (phiên mới), hỏi lại: cảnh báo hiện trước phần giảng.
6. (3:30) Đổi giờ 15:00 và hỏi #6 (bài 2 đã hết hạn): AI xác nhận 6 theo đáp án đã công bố. Kết: bảng mức tự chủ.

## Bằng chứng

- `src/logs/ai-calls.jsonl`: lời gọi AI thật (model, tool, guard).
- `src/screenshots/`: ca #10 sau khi gửi cho TA, ca #3 sau khi gắn cờ và hỏi lại.
