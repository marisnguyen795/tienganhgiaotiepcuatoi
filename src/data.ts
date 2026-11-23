export type Domain =
  | 'Hàng ngày'
  | 'Công việc'
  | 'Du lịch'
  | 'Vệ sinh công cộng'
  | 'Báo cáo sếp'
  | 'Hỗ trợ du khách'
  | (string & {});

export type Turn = {
  role: 'A' | 'B';
  speaker: string;
  en: string;
  vn: string;
  intent: string;
};

export type Situation = {
  id: number;
  domain: Domain;
  title: string;
  where: string;
  withWho: string;
  goal: string;
  dialogue: Turn[];
  followUp: string;
  targetWords: { en: string; vn: string }[];
};

const T = (
  role: 'A' | 'B',
  speaker: string,
  en: string,
  vn: string,
  intent: string
): Turn => ({ role, speaker, en, vn, intent });

export const DOMAINS: { name: Domain; icon: string }[] = [
  { name: 'Hàng ngày', icon: '☀️' },
  { name: 'Công việc', icon: '💼' },
  { name: 'Du lịch', icon: '✈️' },
  { name: 'Vệ sinh công cộng', icon: '🧹' },
  { name: 'Báo cáo sếp', icon: '📋' },
  { name: 'Hỗ trợ du khách', icon: '🧭' },
];

export const SITUATIONS: Situation[] = [
  {
    id: 1,
    domain: 'Hàng ngày',
    title: 'Chào hỏi buổi sáng',
    where: 'Cổng công ty',
    withWho: 'Đồng nghiệp',
    goal: 'Chào hỏi tự nhiên và bắt đầu ngày làm việc',
    dialogue: [
      T(
        'A',
        'Bạn',
        'Good morning. How are you today?',
        'Chào buổi sáng. Hôm nay bạn thế nào?',
        'Chào buổi sáng và hỏi thăm ngắn gọn'
      ),
      T(
        'B',
        'Đồng nghiệp',
        'Good morning! I am good, thank you. Ready for the shift?',
        'Chào buổi sáng! Tôi khỏe, cảm ơn bạn. Sẵn sàng vào ca chưa?',
        'Đáp lại lời chào và hỏi về ca làm'
      ),
      T(
        'A',
        'Bạn',
        'Yes, I just grabbed a coffee. Let us get started.',
        'Rồi, tôi vừa mua ly cà phê. Bắt đầu làm việc thôi.',
        'Xác nhận sẵn sàng và rủ vào việc'
      ),
      T(
        'B',
        'Đồng nghiệp',
        'Sounds good. See you at the briefing.',
        'Nghe hợp lý đấy. Hẹn gặp bạn ở buổi họp đầu giờ.',
        'Chốt lịch hẹn ngắn'
      ),
    ],
    followUp: 'What will you do first this morning?',
    targetWords: [
      { en: 'morning', vn: 'buổi sáng' },
      { en: 'shift', vn: 'ca làm việc' },
      { en: 'grabbed', vn: 'vừa lấy / vừa mua nhanh' },
      { en: 'briefing', vn: 'cuộc họp ngắn đầu ca' },
    ],
  },
  {
    id: 2,
    domain: 'Hàng ngày',
    title: 'Gọi món ở quán cà phê',
    where: 'Quầy pha chế',
    withWho: 'Nhân viên thu ngân',
    goal: 'Đặt đồ uống đúng yêu cầu ít đường, mang đi',
    dialogue: [
      T(
        'B',
        'Thu ngân',
        'Hi there, what can I get for you today?',
        'Xin chào, hôm nay bạn muốn dùng món gì ạ?',
        'Chào khách và hỏi món'
      ),
      T(
        'A',
        'Bạn',
        'Can I have an iced milk coffee, less sugar, to go please?',
        'Cho tôi một ly cà phê sữa đá, ít đường, mang đi nhé.',
        'Gọi món cụ thể kèm tùy chọn ít đường và mang đi'
      ),
      T(
        'B',
        'Thu ngân',
        'Sure. Would you like a medium or large size?',
        'Vâng ạ. Bạn muốn ly cỡ vừa hay cỡ lớn?',
        'Hỏi kích cỡ ly'
      ),
      T(
        'A',
        'Bạn',
        'Medium is fine. How much is it?',
        'Cỡ vừa là được rồi. Bao nhiêu tiền vậy bạn?',
        'Chọn cỡ và hỏi giá tiền'
      ),
    ],
    followUp: 'Would you like to pay by card or cash?',
    targetWords: [
      { en: 'less sugar', vn: 'ít đường' },
      { en: 'to go', vn: 'mang đi' },
      { en: 'medium', vn: 'cỡ vừa' },
      { en: 'cash', vn: 'tiền mặt' },
    ],
  },
  {
    id: 3,
    domain: 'Hàng ngày',
    title: 'Hỏi giờ và xin phép đi trước',
    where: 'Trạm xe buýt',
    withWho: 'Người đứng chờ cùng',
    goal: 'Hỏi giờ xe chạy và cảm ơn lịch sự',
    dialogue: [
      T(
        'A',
        'Bạn',
        'Excuse me, do you know what time the next bus arrives?',
        'Xin lỗi, bạn có biết chuyến xe buýt tiếp theo mấy giờ tới không?',
        'Mở lời lịch sự để hỏi giờ xe'
      ),
      T(
        'B',
        'Người lạ',
        'It should be here in about five minutes.',
        'Chắc khoảng năm phút nữa là xe tới đấy.',
        'Ước lượng thời gian chờ'
      ),
      T(
        'A',
        'Bạn',
        'Thank you so much. My phone battery just died.',
        'Cảm ơn bạn rất nhiều. Điện thoại tôi vừa hết pin.',
        'Cảm ơn và giải thích ngắn lý do hỏi'
      ),
      T(
        'B',
        'Người lạ',
        'No problem at all. Oh, here comes the bus now.',
        'Không có gì đâu. Ồ, xe tới rồi kìa.',
        'Đáp lại thân thiện và báo hiệu xe đến'
      ),
    ],
    followUp: 'Which stop are you getting off at?',
    targetWords: [
      { en: 'next bus', vn: 'chuyến xe buýt tiếp theo' },
      { en: 'arrive', vn: 'đến nơi' },
      { en: 'battery died', vn: 'hết pin' },
      { en: 'stop', vn: 'trạm dừng' },
    ],
  },
  {
    id: 4,
    domain: 'Công việc',
    title: 'Nhờ đồng nghiệp hỗ trợ ca trực',
    where: 'Khu vực quầy trực',
    withWho: 'Đồng nghiệp cùng ca',
    goal: 'Nhờ hỗ trợ xử lý nhanh khi khách đông',
    dialogue: [
      T(
        'A',
        'Bạn',
        'Hey Minh, could you give me a hand over here for a minute?',
        'Minh ơi, bạn qua đây phụ tôi một tay một lát được không?',
        'Nhờ đồng nghiệp giúp nhanh'
      ),
      T(
        'B',
        'Minh',
        'Sure, what do you need help with?',
        'Được chứ, bạn cần giúp việc gì thế?',
        'Đồng ý hỗ trợ và hỏi chi tiết'
      ),
      T(
        'A',
        'Bạn',
        'Please check the supply cart while I greet the new group.',
        'Bạn kiểm tra xe đẩy vật tư giúp tôi trong lúc tôi đón nhóm khách mới nhé.',
        'Phân công rõ hai đầu việc song song'
      ),
      T(
        'B',
        'Minh',
        'Got it. I will restock the towels right away.',
        'Rõ rồi. Tôi sẽ bổ sung khăn ngay.',
        'Xác nhận đã hiểu và hành động ngay'
      ),
    ],
    followUp: 'Do we have enough supplies for the afternoon?',
    targetWords: [
      { en: 'give me a hand', vn: 'giúp tôi một tay' },
      { en: 'supply cart', vn: 'xe đẩy vật tư' },
      { en: 'restock', vn: 'bổ sung hàng / vật tư' },
      { en: 'right away', vn: 'ngay lập tức' },
    ],
  },
  {
    id: 5,
    domain: 'Công việc',
    title: 'Xác nhận lịch họp và nhắc việc',
    where: 'Hành lang văn phòng',
    withWho: 'Trưởng nhóm',
    goal: 'Hỏi lại giờ họp và xác nhận tài liệu cần mang',
    dialogue: [
      T(
        'A',
        'Bạn',
        'Hi Sarah, is our team check-in still at two PM today?',
        'Chào Sarah, buổi họp nhanh của nhóm hôm nay vẫn lúc 2 giờ chiều chứ?',
        'Xác nhận lại thời gian họp'
      ),
      T(
        'B',
        'Sarah',
        'We moved it to two thirty in Room B.',
        'Chúng ta dời sang 2 giờ 30 tại phòng B rồi.',
        'Thông báo giờ mới và địa điểm'
      ),
      T(
        'A',
        'Bạn',
        'Thanks for the update. Should I bring the weekly checklist?',
        'Cảm ơn chị đã báo. Em có cần mang bảng kiểm tra tuần không?',
        'Cảm ơn và hỏi tài liệu cần chuẩn bị'
      ),
      T(
        'B',
        'Sarah',
        'Yes, please bring the latest numbers as well.',
        'Có nhé, nhớ mang theo cả số liệu mới nhất.',
        'Dặn mang thêm số liệu'
      ),
    ],
    followUp: 'Have you finished updating your section?',
    targetWords: [
      { en: 'team check-in', vn: 'họp nhanh đầu/giữa ngày' },
      { en: 'moved it to', vn: 'dời lịch sang' },
      { en: 'checklist', vn: 'bảng kiểm tra công việc' },
      { en: 'latest numbers', vn: 'số liệu mới nhất' },
    ],
  },
  {
    id: 6,
    domain: 'Công việc',
    title: 'Xin đổi ca làm cuối tuần',
    where: 'Phòng nhân sự',
    withWho: 'Quản lý ca',
    goal: 'Trình bày lý do rõ ràng và đề xuất người thay ca',
    dialogue: [
      T(
        'A',
        'Bạn',
        'Excuse me, may I swap my Saturday morning shift with Lan?',
        'Xin lỗi anh, em có thể đổi ca sáng thứ Bảy với Lan được không?',
        'Xin phép đổi ca và nêu rõ người đổi'
      ),
      T(
        'B',
        'Quản lý',
        'Has Lan agreed to cover your shift?',
        'Lan đã đồng ý làm thay ca cho em chưa?',
        'Kiểm tra sự đồng thuận của người thay'
      ),
      T(
        'A',
        'Bạn',
        'Yes, she confirmed yesterday. I will take her Sunday afternoon shift.',
        'Dạ rồi, bạn ấy xác nhận hôm qua. Em sẽ làm bù ca chiều Chủ Nhật của bạn ấy.',
        'Xác nhận đã thỏa thuận đổi hai chiều'
      ),
      T(
        'B',
        'Quản lý',
        'Okay, I will update the schedule right now.',
        'Được rồi, anh sẽ cập nhật lại lịch trực ngay.',
        'Phê duyệt đổi ca'
      ),
    ],
    followUp: 'What time does your Sunday shift start?',
    targetWords: [
      { en: 'swap', vn: 'trao đổi / đổi ca' },
      { en: 'cover your shift', vn: 'làm thay ca của bạn' },
      { en: 'confirmed', vn: 'đã xác nhận' },
      { en: 'schedule', vn: 'lịch làm việc' },
    ],
  },
  {
    id: 7,
    domain: 'Du lịch',
    title: 'Làm thủ tục nhận phòng khách sạn',
    where: 'Quầy lễ tân khách sạn',
    withWho: 'Nhân viên lễ tân',
    goal: 'Đưa mã đặt phòng và hỏi giờ ăn sáng',
    dialogue: [
      T(
        'A',
        'Bạn',
        'Hello, I have a reservation under Nguyen Minh.',
        'Xin chào, tôi có đặt phòng dưới tên Nguyen Minh.',
        'Báo tên đặt phòng khi check-in'
      ),
      T(
        'B',
        'Lễ tân',
        'Welcome! May I see your passport, please?',
        'Chào mừng quý khách! Cho tôi xem hộ chiếu của bạn được không?',
        'Yêu cầu giấy tờ tùy thân'
      ),
      T(
        'A',
        'Bạn',
        'Here you go. Is breakfast included in our booking?',
        'Đây ạ. Bữa sáng có bao gồm trong gói đặt phòng không?',
        'Đưa giấy tờ và hỏi quyền lợi bữa sáng'
      ),
      T(
        'B',
        'Lễ tân',
        'Yes, breakfast is served from six thirty to nine thirty on the second floor.',
        'Có ạ, bữa sáng phục vụ từ 6 giờ 30 đến 9 giờ 30 ở tầng hai.',
        'Cung cấp khung giờ và vị trí ăn sáng'
      ),
    ],
    followUp: 'What floor is your room on?',
    targetWords: [
      { en: 'reservation', vn: 'đặt chỗ / đặt phòng' },
      { en: 'passport', vn: 'hộ chiếu' },
      { en: 'included', vn: 'được bao gồm' },
      { en: 'served', vn: 'được phục vụ' },
    ],
  },
  {
    id: 8,
    domain: 'Du lịch',
    title: 'Hỏi đường ra ga tàu điện ngầm',
    where: 'Ngã tư khu trung tâm',
    withWho: 'Người dân địa phương',
    goal: 'Hỏi hướng đi bộ và xác nhận trạm gần nhất',
    dialogue: [
      T(
        'A',
        'Bạn',
        'Excuse me, how do I get to the nearest subway station?',
        'Xin lỗi, đi đến ga tàu điện ngầm gần nhất bằng đường nào ạ?',
        'Hỏi đường đến ga gần nhất'
      ),
      T(
        'B',
        'Người địa phương',
        'Walk straight for two blocks, then turn left at the traffic light.',
        'Bạn đi thẳng hai dãy nhà, rồi rẽ trái ở chỗ đèn giao thông.',
        'Chỉ đường theo mốc cụ thể'
      ),
      T(
        'A',
        'Bạn',
        'Is it far from here on foot?',
        'Đi bộ từ đây có xa không ạ?',
        'Kiểm tra khoảng cách đi bộ'
      ),
      T(
        'B',
        'Người địa phương',
        'Not at all. It only takes about five minutes.',
        'Không xa đâu. Chỉ mất khoảng năm phút đi bộ thôi.',
        'Trấn an thời gian di chuyển'
      ),
    ],
    followUp: 'Which train line do you need to take?',
    targetWords: [
      { en: 'nearest', vn: 'gần nhất' },
      { en: 'two blocks', vn: 'hai dãy nhà' },
      { en: 'traffic light', vn: 'đèn giao thông' },
      { en: 'on foot', vn: 'đi bộ' },
    ],
  },
  {
    id: 9,
    domain: 'Du lịch',
    title: 'Qua cửa kiểm tra an ninh sân bay',
    where: 'Cổng an ninh sân bay',
    withWho: 'Nhân viên an ninh',
    goal: 'Nghe hiểu yêu cầu lấy laptop, chất lỏng và qua cổng',
    dialogue: [
      T(
        'B',
        'An ninh',
        'Please place your laptop and liquids in a separate tray.',
        'Vui lòng đặt máy tính xách tay và chất lỏng vào khay riêng.',
        'Hướng dẫn tách đồ điện tử và chất lỏng'
      ),
      T(
        'A',
        'Bạn',
        'Should I take off my jacket and belt as well?',
        'Tôi có cần cởi áo khoác và thắt lưng luôn không?',
        'Hỏi xác nhận quy định soi chiếu'
      ),
      T(
        'B',
        'An ninh',
        'Yes, please. Then step through the scanner when the light turns green.',
        'Có ạ. Sau đó bước qua cổng quét khi đèn chuyển sang màu xanh.',
        'Xác nhận và hướng dẫn bước qua cổng'
      ),
      T(
        'A',
        'Bạn',
        'Okay, thank you. Where is Gate 14?',
        'Vâng, cảm ơn. Cổng 14 ở hướng nào ạ?',
        'Hỏi đường tới cổng lên máy bay'
      ),
    ],
    followUp: 'What time does your flight start boarding?',
    targetWords: [
      { en: 'separate tray', vn: 'khay riêng' },
      { en: 'liquids', vn: 'chất lỏng' },
      { en: 'take off', vn: 'cởi bỏ (áo, giày, thắt lưng)' },
      { en: 'boarding', vn: 'lên máy bay' },
    ],
  },
  {
    id: 10,
    domain: 'Vệ sinh công cộng',
    title: 'Đặt biển báo sàn ướt và hướng dẫn lối đi',
    where: 'Sảnh chính tòa nhà',
    withWho: 'Khách đi ngang qua',
    goal: 'Nhắc khách cẩn thận trơn trượt và chỉ lối đi khô ráo',
    dialogue: [
      T(
        'A',
        'Bạn',
        'Excuse me, please watch your step. The floor is wet.',
        'Xin lỗi quý khách, vui lòng chú ý bước chân. Sàn đang ướt ạ.',
        'Cảnh báo an toàn lịch sự'
      ),
      T(
        'B',
        'Khách',
        'Oh, thank you! Which way should I walk?',
        'Ồ, cảm ơn bạn! Tôi nên đi lối nào cho an toàn?',
        'Hỏi lối đi thay thế'
      ),
      T(
        'A',
        'Bạn',
        'Please use the dry path on the right side by the wall.',
        'Mời quý khách đi theo lối khô bên tay phải sát tường ạ.',
        'Chỉ dẫn lối đi an toàn rõ ràng'
      ),
      T(
        'B',
        'Khách',
        'Got it, thanks for letting me know.',
        'Tôi hiểu rồi, cảm ơn bạn đã nhắc.',
        'Cảm ơn và làm theo hướng dẫn'
      ),
    ],
    followUp: 'How long will it take for the floor to dry?',
    targetWords: [
      { en: 'watch your step', vn: 'chú ý bước chân' },
      { en: 'wet floor', vn: 'sàn ướt' },
      { en: 'dry path', vn: 'lối đi khô ráo' },
      { en: 'slippery', vn: 'trơn trượt' },
    ],
  },
  {
    id: 11,
    domain: 'Vệ sinh công cộng',
    title: 'Thông báo đóng tạm thời nhà vệ sinh để dọn',
    where: 'Cửa khu vệ sinh tầng 1',
    withWho: 'Khách tham quan',
    goal: 'Báo đang vệ sinh và chỉ sang khu vực gần nhất',
    dialogue: [
      T(
        'A',
        'Bạn',
        'Sorry, this restroom is closed for cleaning right now.',
        'Xin lỗi quý khách, nhà vệ sinh này hiện đang tạm đóng để làm vệ sinh.',
        'Thông báo đóng cửa tạm thời'
      ),
      T(
        'B',
        'Khách',
        'No worries. How long will it take, or is there another one nearby?',
        'Không sao đâu. Mất bao lâu nhỉ, hay gần đây có chỗ nào khác không?',
        'Hỏi thời gian chờ hoặc vị trí khác'
      ),
      T(
        'A',
        'Bạn',
        'It will reopen in ten minutes. There is another restroom near the elevator.',
        'Khoảng 10 phút nữa sẽ mở lại ạ. Có một khu vệ sinh khác ở gần thang máy.',
        'Báo thời gian mở lại và chỉ chỗ thay thế'
      ),
      T(
        'B',
        'Khách',
        'Great, I will go to the one near the elevator.',
        'Tuyệt, tôi sẽ ra chỗ gần thang máy.',
        'Xác nhận hướng đi mới'
      ),
    ],
    followUp: 'Have you put out the cleaning sign yet?',
    targetWords: [
      { en: 'closed for cleaning', vn: 'đóng cửa để làm vệ sinh' },
      { en: 'reopen', vn: 'mở cửa lại' },
      { en: 'nearby', vn: 'gần đây' },
      { en: 'elevator', vn: 'thang máy' },
    ],
  },
  {
    id: 12,
    domain: 'Vệ sinh công cộng',
    title: 'Hướng dẫn phân loại rác tại điểm công cộng',
    where: 'Khu ẩm thực / Công viên',
    withWho: 'Du khách',
    goal: 'Giải thích thùng rác tái chế và rác hữu cơ bằng câu ngắn',
    dialogue: [
      T(
        'B',
        'Du khách',
        'Excuse me, which bin should I put this plastic cup in?',
        'Xin lỗi, tôi nên bỏ chiếc ly nhựa này vào thùng nào ạ?',
        'Hỏi đúng thùng rác'
      ),
      T(
        'A',
        'Bạn',
        'Please empty the leftover drink first, then put the cup in the blue bin.',
        'Vui lòng đổ phần nước thừa trước, rồi bỏ ly vào thùng màu xanh dương ạ.',
        'Hướng dẫn đổ nước thừa và bỏ vào thùng tái chế'
      ),
      T(
        'B',
        'Du khách',
        'And what about food waste and napkins?',
        'Còn thức ăn thừa và khăn giấy thì sao?',
        'Hỏi thêm về rác thực phẩm và giấy'
      ),
      T(
        'A',
        'Bạn',
        'Those go into the green bin on the left. Thank you for sorting.',
        'Những thứ đó bỏ vào thùng xanh lá bên trái. Cảm ơn quý khách đã phân loại rác.',
        'Chỉ thùng rác hữu cơ và cảm ơn'
      ),
    ],
    followUp: 'Where is the nearest handwashing station?',
    targetWords: [
      { en: 'plastic cup', vn: 'ly nhựa' },
      { en: 'leftover', vn: 'đồ thừa còn lại' },
      { en: 'recycling bin', vn: 'thùng rác tái chế' },
      { en: 'sorting', vn: 'phân loại' },
    ],
  },
  {
    id: 13,
    domain: 'Báo cáo sếp',
    title: 'Báo cáo nhanh tiến độ công việc cuối ca',
    where: 'Phòng điều hành',
    withWho: 'Quản lý trực tiếp',
    goal: 'Báo cáo những việc đã xong và phần cần bàn giao',
    dialogue: [
      T(
        'A',
        'Bạn',
        'Excuse me, here is my quick update before I clock out.',
        'Thưa anh, đây là báo cáo nhanh của em trước khi tan ca ạ.',
        'Mở đầu báo cáo ngắn gọn cuối ca'
      ),
      T(
        'B',
        'Quản lý',
        'Go ahead. Did we finish all tasks on the main floor?',
        'Nói đi em. Nhóm đã làm xong hết đầu việc ở sảnh chính chưa?',
        'Hỏi tiến độ khu vực chính'
      ),
      T(
        'A',
        'Bạn',
        'Yes, the main floor is spotless and restocked. Only the east hallway needs mopping.',
        'Dạ rồi, sảnh chính đã sạch sẽ và châm đủ đồ. Chỉ còn hành lang phía đông cần lau lại.',
        'Báo rõ phần đã hoàn thành và phần còn tồn đọng'
      ),
      T(
        'B',
        'Quản lý',
        'Good job. I will assign the evening team to handle the east hallway.',
        'Làm tốt lắm. Anh sẽ giao ca tối xử lý nốt hành lang phía đông.',
        'Ghi nhận và phân công ca tiếp theo'
      ),
    ],
    followUp: 'Did anything break or need maintenance today?',
    targetWords: [
      { en: 'quick update', vn: 'báo cáo cập nhật nhanh' },
      { en: 'clock out', vn: 'chấm công ra về / tan ca' },
      { en: 'spotless', vn: 'sạch không tì vết' },
      { en: 'assign', vn: 'phân công' },
    ],
  },
  {
    id: 14,
    domain: 'Báo cáo sếp',
    title: 'Báo cáo sự cố thiết bị hỏng đột xuất',
    where: 'Khu vực kỹ thuật / Hành lang',
    withWho: 'Giám sát viên',
    goal: 'Báo chính xác vị trí, tình trạng hỏng và đã rào chắn an toàn',
    dialogue: [
      T(
        'A',
        'Bạn',
        'Sir, I need to report a broken soap dispenser in Restroom B.',
        'Thưa anh, em cần báo hộp đựng xà phòng ở nhà vệ sinh B bị hỏng.',
        'Báo sự cố cụ thể kèm vị trí'
      ),
      T(
        'B',
        'Giám sát',
        'Is it leaking on the floor?',
        'Nó có bị rò rỉ ra sàn không?',
        'Kiểm tra mức độ ảnh hưởng an toàn'
      ),
      T(
        'A',
        'Bạn',
        'Yes, a little bit. I wiped the floor and placed a warning cone.',
        'Dạ có rò nhẹ. Em đã lau khô sàn và đặt chóp cảnh báo rồi ạ.',
        'Báo đã xử lý an toàn tạm thời'
      ),
      T(
        'B',
        'Giám sát',
        'Thank you for acting fast. I will call maintenance right now.',
        'Cảm ơn em đã xử lý nhanh. Anh sẽ gọi bộ phận kỹ thuật ngay.',
        'Khen ngợi phản ứng nhanh và gọi bảo trì'
      ),
    ],
    followUp: 'When did you first notice the leak?',
    targetWords: [
      { en: 'report', vn: 'báo cáo' },
      { en: 'leaking', vn: 'bị rò rỉ' },
      { en: 'warning cone', vn: 'chóp cảnh báo' },
      { en: 'maintenance', vn: 'bộ phận bảo trì / kỹ thuật' },
    ],
  },
  {
    id: 15,
    domain: 'Báo cáo sếp',
    title: 'Báo cáo thiếu vật tư và đề xuất nhập thêm',
    where: 'Kho vật tư',
    withWho: 'Quản lý kho / Sếp',
    goal: 'Báo số lượng còn lại và đề nghị bổ sung kịp cho cuối tuần',
    dialogue: [
      T(
        'A',
        'Bạn',
        'Hi boss, we are running low on paper towels and sanitizer.',
        'Chào sếp, bên mình sắp hết khăn giấy và nước rửa tay rồi ạ.',
        'Báo tình trạng sắp hết vật tư'
      ),
      T(
        'B',
        'Sếp',
        'How many boxes do we have left in storage?',
        'Trong kho mình còn lại bao nhiêu thùng?',
        'Hỏi số lượng tồn kho chính xác'
      ),
      T(
        'A',
        'Bạn',
        'Only two boxes left. That is just enough until Friday afternoon.',
        'Chỉ còn hai thùng thôi ạ. Số đó chỉ đủ dùng tới chiều thứ Sáu.',
        'Báo số liệu cụ thể và ước lượng thời gian cạn'
      ),
      T(
        'B',
        'Sếp',
        'Thanks for flagging it early. I will place an urgent order today.',
        'Cảm ơn đã báo sớm. Hôm nay tôi sẽ đặt đơn hàng gấp.',
        'Đánh giá cao và đặt hàng bổ sung'
      ),
    ],
    followUp: 'Do we need anything else for the weekend?',
    targetWords: [
      { en: 'running low on', vn: 'đang sắp hết' },
      { en: 'storage', vn: 'kho lưu trữ' },
      { en: 'enough until', vn: 'đủ dùng cho đến khi' },
      { en: 'urgent order', vn: 'đơn hàng gấp' },
    ],
  },
  {
    id: 16,
    domain: 'Hỗ trợ du khách',
    title: 'Chỉ đường tới quầy thông tin và khu đổi tiền',
    where: 'Sảnh ga / Trung tâm thương mại',
    withWho: 'Du khách nước ngoài',
    goal: 'Chỉ hướng rõ bằng tay kết hợp khoảng cách dễ hiểu',
    dialogue: [
      T(
        'B',
        'Du khách',
        'Excuse me, where can I exchange money around here?',
        'Xin lỗi, quanh đây tôi có thể đổi tiền ở đâu ạ?',
        'Du khách hỏi chỗ đổi ngoại tệ'
      ),
      T(
        'A',
        'Bạn',
        'There is a currency exchange counter near Gate Two.',
        'Có một quầy đổi ngoại tệ ở gần Cổng số Hai ạ.',
        'Chỉ vị trí mốc dễ nhận biết'
      ),
      T(
        'B',
        'Du khách',
        'How do I walk there from here?',
        'Từ đây tôi đi bộ qua đó thế nào?',
        'Hỏi hướng đi chi tiết'
      ),
      T(
        'A',
        'Bạn',
        'Go straight past the coffee shop and turn right. You will see the green sign.',
        'Bạn đi thẳng qua quán cà phê rồi rẽ phải. Bạn sẽ thấy bảng hiệu màu xanh lá.',
        'Hướng dẫn từng bước kèm dấu hiệu nhận biết'
      ),
    ],
    followUp: 'Do you also need a map of the area?',
    targetWords: [
      { en: 'currency exchange', vn: 'đổi ngoại tệ' },
      { en: 'counter', vn: 'quầy giao dịch' },
      { en: 'go straight past', vn: 'đi thẳng qua khỏi' },
      { en: 'sign', vn: 'biển hiệu' },
    ],
  },
  {
    id: 17,
    domain: 'Hỗ trợ du khách',
    title: 'Hỗ trợ du khách tìm đồ thất lạc',
    where: 'Quầy dịch vụ khách hàng',
    withWho: 'Du khách bị mất đồ',
    goal: 'Trấn an khách, hỏi đặc điểm đồ vật và hướng dẫn nhận lại',
    dialogue: [
      T(
        'B',
        'Du khách',
        'Excuse me, I think I left my small black backpack in the lobby.',
        'Xin lỗi, tôi nghĩ mình để quên chiếc ba lô đen nhỏ ở sảnh.',
        'Báo mất đồ kèm mô tả sơ bộ'
      ),
      T(
        'A',
        'Bạn',
        'Do not worry, let me check our lost and found desk for you.',
        'Đừng lo lắng, để tôi kiểm tra quầy đồ thất lạc giúp bạn nhé.',
        'Trấn an và nhận kiểm tra ngay'
      ),
      T(
        'B',
        'Du khách',
        'Thank you. It has a blue keychain on the zipper.',
        'Cảm ơn bạn. Trên khóa kéo có gắn một móc chìa khóa màu xanh dương.',
        'Cung cấp đặc điểm nhận dạng thêm'
      ),
      T(
        'A',
        'Bạn',
        'Good news, someone turned it in! Please show your ID to sign for it.',
        'Tin vui đây, có người nhặt được và giao lại rồi! Vui lòng đưa giấy tờ tùy thân để ký nhận nhé.',
        'Báo tin tìm thấy và làm thủ tục bàn giao'
      ),
    ],
    followUp: 'Could you check if everything inside is still there?',
    targetWords: [
      { en: 'lost and found', vn: 'quầy đồ thất lạc' },
      { en: 'keychain', vn: 'móc chìa khóa' },
      { en: 'turned it in', vn: 'đã nhặt được và nộp lại' },
      { en: 'sign for it', vn: 'ký tên xác nhận nhận đồ' },
    ],
  },
  {
    id: 18,
    domain: 'Hỗ trợ du khách',
    title: 'Chụp ảnh giúp du khách và gợi ý góc đẹp',
    where: 'Khu vực tham quan ngoài trời',
    withWho: 'Gia đình du khách',
    goal: 'Nhận lời giúp nhiệt tình, đếm nhịp chụp và gợi ý góc chụp',
    dialogue: [
      T(
        'B',
        'Du khách',
        'Hi, sorry to bother you. Could you take a photo of us?',
        'Chào bạn, xin lỗi làm phiền. Bạn chụp giúp chúng tôi một tấm ảnh được không?',
        'Nhờ chụp ảnh hộ'
      ),
      T(
        'A',
        'Bạn',
        'Of course! Would you like the fountain in the background?',
        'Tất nhiên rồi! Bạn có muốn lấy cảnh đài phun nước phía sau không?',
        'Vui vẻ đồng ý và hỏi bố cục ảnh'
      ),
      T(
        'B',
        'Du khách',
        'Yes, please! That would be lovely.',
        'Có chứ! Thế thì tuyệt quá.',
        'Đồng ý với gợi ý góc chụp'
      ),
      T(
        'A',
        'Bạn',
        'Alright, stand a little closer together. Ready? One, two, three, smile!',
        'Được rồi, mọi người đứng sát nhau hơn chút nhé. Sẵn sàng chưa? Một, hai, ba, cười nào!',
        'Điều chỉnh vị trí và đếm nhịp chụp'
      ),
    ],
    followUp: 'Would you like me to take one more in vertical mode?',
    targetWords: [
      { en: 'background', vn: 'phông nền phía sau' },
      { en: 'fountain', vn: 'đài phun nước' },
      { en: 'closer together', vn: 'sát lại gần nhau hơn' },
      { en: 'vertical mode', vn: 'chụp khung dọc' },
    ],
  },
];
