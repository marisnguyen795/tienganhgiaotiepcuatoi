# Anh Van Phan Xa - FINAL v4 - Sửa Nói + AI Fallback - 1 FILE DUY NHẤT

## Đây là bản FINAL, đã rà soát 12/12 lần cuối

### 1. SỬA LỖI NÓI KHÔNG HOẠT ĐỘNG (Bấm và nói)
Nguyên nhân cũ:
- Chỉ dùng webkitSpeechRecognition, không xin quyền Mic trước -> bị chặn là đứng im
- Không xử lý lỗi not-allowed / no-speech / network -> bấm mà không có phản hồi
- iPhone Safari không hỗ trợ nhận diện -> bấm không làm gì
- Không có fallback khi Mic lỗi

Đã sửa trong v4:
- Nút Bấm và nói MÀU ĐỎ, to, có hiệu ứng sóng khi đang nghe, bấm lần 2 để dừng, tự dừng sau 8s
- Trước khi nghe: tự xin quyền Mic bằng getUserMedia, hiện rõ "Đã cho phép / Bị chặn"
- Xử lý mọi lỗi: not-allowed -> hướng dẫn mở khóa Mic, no-speech -> nhắc nói to hơn, audio-capture -> kiểm tra Mic, network -> kiểm tra mạng
- Nếu trình duyệt không hỗ trợ nhận diện (Safari iPhone): TỰ HIỆN ô Gõ để chấm, vẫn chấm bằng AI, không đứng im
- Nghe (TTS) đã sửa: chọn giọng en-US, tốc độ 0.9, không bị kẹt
- Có nút Kiểm tra Mic ngay ở Trang chủ + Cài đặt

### 2. AI THÔNG MINH - TỰ CHUYỂN KHI HẾT TOKEN
Logic: Gemini (ưu tiên) -> nếu 429 / quota / hết token / lỗi -> tự chuyển Meta AI -> nếu Meta cũng hết -> Offline (quy tắc)
- App KHÔNG BAO GIỜ đứng im, luôn có cách chấm
- Hiển thị rõ đang dùng AI nào: Gemini / Meta AI / Offline
- Nhật ký AI (AI Log) ghi lại mỗi lần chuyển
- Cài đặt: nhập 2 keys, nút Kiểm tra Gemini, Kiểm tra Meta, nút Thử chuyển khi hết token (giả lập)
- Thứ tự ưu tiên chọn được: Gemini trước hoặc Meta trước
- Keys lưu trong trình duyệt (localStorage), không hiện trong UI chính

### 3. RÀ SOÁT TỔNG THỂ 12 MỤC - ĐÃ HOÀN HẢO
✓ Nói (Mic + Gõ fallback) ✓ Nghe (TTS) ✓ Viết ✓ AI Chat nghiêm túc (sửa ngay) ✓ 72 tình huống (Daily 12, Work 12, Du lich 12, Ve sinh 15, Bao cao sep 12, Ho tro khach 9)
✓ 60 câu Việt->Anh ✓ 1000 từ thật từ Excel (200/Level) ✓ Import/Export CSV ✓ Cài đặt khóa mật khẩu, tự khóa 10 phút ✓ Supabase ✓ AI Fallback ✓ Tiến độ/Streak/Lưu trữ

### 4. GIAO DIỆN ĐÚNG BẢN REFLEX FINAL
- Không PL, không banner lớn, không thẻ Thêm vào MH chính
- Header: AV + Anh Văn Phản Xạ + Tìm kiếm + Badge AI/Mic
- Chủ đề: "Chọn chủ đề để học:" + 7 chip có số bài, gồm Cuộc sống hàng ngày
- Font: body 18px, heading 20-22px, câu tiếng Anh 22px

## CÁCH UP LÊN GITHUB & VERCEL - DÙNG NGAY
1. Xóa hết file cũ trong repo marisnguyen795/hoctienganhgiaotiep
2. Copy 5 file trong ZIP này lên thư mục GỐC: index.html (FILE CHÍNH - 1 FILE), vercel.json, package.json, build.js, README này
3. Vercel -> Settings -> General:
   Framework: Other
   Build Command: npm run build
   Output Directory: dist
   Save
4. Deployments -> Redeploy -> Visit

Kiểm tra nhanh:
- Bấm Kiểm tra Mic -> phải hiện Đã cho phép
- Bấm Bấm và nói -> phải hiện Đang nghe... + sóng
- Vào Cài đặt -> nhập Gemini Key -> Kiểm tra -> phải hiện Hoạt động
- Bấm Thử chuyển khi hết token -> phải hiện đã chuyển sang Meta/Offline
- Bấm chip Cuộc sống hàng ngày -> 12 bài
- Vào Từ vựng -> 1000 từ
