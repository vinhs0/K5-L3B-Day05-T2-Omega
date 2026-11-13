'use strict';
// Gemini tool loop + policy guards ("vai trò hệ thống"). CommonJS, không phụ thuộc npm.
const fs = require('fs');
const path = require('path');
const D = require('./course-data');

const API = 'https://generativelanguage.googleapis.com/v1beta';
const LOG_DIR = path.join(__dirname, 'logs');
const LOG_FILE = path.join(LOG_DIR, 'ai-calls.jsonl');
const MAX_ITER = 5;
const MAX_HISTORY = 24; // ~12 lượt (mỗi lượt = 1 user + 1 model)

// ───────────────────────── Thời gian giả lập (Asia/Ho_Chi_Minh, coi chuỗi là giờ địa phương) ─────────────────────────
function normNow(s) {
  const m = String(s || D.DEFAULT_NOW).match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
  if (!m) return null;
  return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}`;
}
function toMs(s) { // chuỗi naive -> ms (coi như UTC, chỉ để so sánh/trừ)
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
}
function fmtMs(ms) {
  const d = new Date(ms);
  const p = (n) => String(n).padStart(2, '0');
  return { hm: `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`, dm: `${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)}`, y: d.getUTCFullYear() };
}
function fmtFull(ms) { const f = fmtMs(ms); return `${f.hm} ${f.dm}/${f.y}`; }

function timeInfo(nowStr) {
  const now = toMs(nowStr);
  const han = toMs(D.BAI_TAP[3].han);
  const conLai = Math.round((han - now) / 60000);
  const d = new Date(now);
  const h = d.getUTCHours() + d.getUTCMinutes() / 60;
  const trongGioTA = h >= D.GIO_TA.tu_gio && h < D.GIO_TA.den_gio;
  let replyMs;
  const day0 = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  if (trongGioTA) replyMs = now; // TA đang trực
  else if (h < D.GIO_TA.tu_gio) replyMs = day0 + D.GIO_TA.tu_gio * 3600000;
  else replyMs = day0 + 86400000 + D.GIO_TA.tu_gio * 3600000;
  const f = fmtMs(replyMs);
  const gio_TA_tra_loi = trongGioTA ? `trong giờ TA hôm nay (đến ${D.GIO_TA.den} ${f.dm})` : `${f.hm} ${f.dm}`;
  return {
    now: nowStr,
    now_hien_thi: fmtFull(now),
    han: D.BAI_TAP[3].han,
    han_hien_thi: D.BAI_TAP[3].han_hien_thi,
    con_lai_phut: conLai,
    bai3_dang_mo: conLai > 0,
    ta_het_gio: !trongGioTA,
    gio_TA_tra_loi,
    sau_han: replyMs > han,
  };
}

// ───────────────────────── Tìm trong tài liệu ─────────────────────────
function strip(s) {
  return String(s || '').toLowerCase().replace(/đ/g, 'd').normalize('NFD').replace(/[̀-ͯ]/g, '');
}
const STOP = new Set('la cua va the nao gi bao nhieu khi o em co cho minh toi ban a ah nhe ko khong duoc nay do vay sao tai de hay voi nhu mot cac nhung thi ma da dang se bi tu trong ve'.split(' '));
const PAGE_KW = ['han', 'nop', 'deadline', 'ta ', 'gio', 'bai tap', 'bai 2', 'bai 3', 'buoi', 'cong cu', 'bang tinh', 'excel', 'lich', 'de cuong', 'hom nay', 'tra loi', 'gia han', 'dap an'];

function searchDocs(state, query) {
  const q = strip(query);
  const found = new Map();
  // mã § trực tiếp: "3.3", "§3.2"
  for (const m of q.matchAll(/(?:^|[^\d])3\s*\.\s*([1-5])(?!\d)/g)) found.set('§3.' + m[1], 100);
  const toks = q.split(/[^a-z0-9§]+/).filter((t) => t.length >= 2 && !STOP.has(t));
  for (const s of D.SECTIONS) {
    const kw = new Set(strip(s.tu_khoa + ' ' + s.tieu_de).split(/\s+/));
    let sc = 0;
    for (const t of toks) if (kw.has(t)) sc++;
    if (sc > 0) found.set(s.ma, Math.max(found.get(s.ma) || 0, sc));
  }
  const buoi = [];
  for (const m of q.matchAll(/buoi\s*(\d+)/g)) {
    const n = +m[1];
    if (D.DE_CUONG[n]) buoi.push({ ma: `Buổi ${n}`, tieu_de: D.DE_CUONG[n], noi_dung: `Buổi ${n}: ${D.DE_CUONG[n]}.`, co_tai_lieu: false, co_xem_xet: false, ghi_chu: 'Buổi chưa mở: trang khoá học chỉ có tên buổi, chưa có tài liệu. Không được giảng nội dung buổi này.' });
    else if (n === 3) for (const s of D.SECTIONS) found.set(s.ma, found.get(s.ma) || 1);
    else if (n === 1 || n === 2) buoi.push({ ma: `Buổi ${n}`, tieu_de: '(không có trong dữ liệu)', noi_dung: `Buổi ${n} đã mở nhưng tài liệu buổi này không có trong hệ thống.`, co_tai_lieu: false, co_xem_xet: false });
  }
  const ket_qua = [...found.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([ma]) => {
      const s = D.SECTIONS.find((x) => x.ma === ma);
      const co = !!state.flags[ma];
      const r = { ma, tieu_de: s.tieu_de, noi_dung: s.noi_dung, co_tai_lieu: true, co_xem_xet: co };
      if (co) r.ghi_chu_xem_xet = 'Mục này đang được TA/giảng viên xem xét. Phải nói điều này TRƯỚC khi giảng.';
      return r;
    })
    .concat(buoi);
  const out = { ket_qua };
  const ti = timeInfo(state.now);
  if (PAGE_KW.some((k) => (q + ' ').includes(k))) {
    out.trang_khoa_hoc = {
      ma: 'Trang khoá học',
      khoa: D.KHOA_HOC,
      buoi_da_mo: D.BUOI_DA_MO,
      de_cuong: D.DE_CUONG,
      cong_cu: D.CONG_CU,
      bai_2: { han: D.BAI_TAP[2].han_hien_thi, trang_thai: 'đã hết hạn', dap_an_cong_bo: `${D.BAI_TAP[2].dap_an_cong_bo} (công bố ${D.BAI_TAP[2].ngay_cong_bo_dap_an})` },
      bai_3: { han: D.BAI_TAP[3].han_hien_thi, trang_thai: ti.bai3_dang_mo ? 'đang mở' : 'đã hết hạn' },
      gio_ta: `${D.GIO_TA.tu}–${D.GIO_TA.den}`,
      bay_gio: ti.now_hien_thi,
      ghi_chu: 'Tài liệu không nêu tên hàm bảng tính cụ thể nào và không có thông tin "cần chuẩn bị gì" cho buổi sau.',
    };
  }
  if (!ket_qua.length && !out.trang_khoa_hoc) out.ghi_chu = 'Không có mục nào trong tài liệu buổi 3 / trang khoá học khớp câu tra cứu. Nếu học viên hỏi về nguồn này, hãy nói thẳng "tài liệu không có".';
  return out;
}

// ───────────────────────── Tool thật ─────────────────────────
const LADDER = [
  'Đếm xem dãy số ở §3.5 có bao nhiêu giá trị, rồi sắp xếp chúng tăng dần. Đọc §3.2 xem khi số giá trị là chẵn thì trung vị được tính thế nào.',
  'Với trung bình, đọc §3.1: tổng các giá trị chia cho số giá trị. Bạn tự cộng và tự chia, rồi tự đối chiếu với kết quả của mình.',
  'Với câu (b): nhìn giá trị lớn nhất trong dãy, nó có khác hẳn phần còn lại không? Đọc §3.1 và §3.4 xem giá trị ngoại lai ảnh hưởng trung bình và trung vị thế nào.',
  'Bạn đã có đủ các bước gợi ý rồi; phần tính toán và kết luận là của bạn. Nếu cần ai xem lại bài, bạn có thể chuyển TA.',
];

function nextId(state, p) { state.seq = (state.seq || 0) + 1; return `${p}${state.seq}`; }

function summarize(o) { const s = JSON.stringify(o); return s.length > 220 ? s.slice(0, 217) + '...' : s; }

function execTool(name, args, ctx, turn) {
  const { state, session } = ctx;
  const ti = timeInfo(state.now);
  args = args || {};
  if (name === 'tra_cuu_tai_lieu') {
    const r = searchDocs(state, args.query || '');
    for (const k of r.ket_qua) turn.returned.set(k.ma, { noi_dung: k.noi_dung, co_xem_xet: !!k.co_xem_xet, tieu_de: k.tieu_de });
    if (r.trang_khoa_hoc) turn.returned.set('Trang khoá học', { noi_dung: JSON.stringify(r.trang_khoa_hoc), co_xem_xet: false, tieu_de: 'Trang khoá học' });
    const sm = r.ket_qua.length ? 'trả ' + r.ket_qua.map((k) => k.ma + (k.co_xem_xet ? ' (đang xem xét)' : '')).join(', ') : r.trang_khoa_hoc ? 'trang khoá học' : 'rỗng: tài liệu không có';
    return { level: 'tự làm', result: r, summary: sm };
  }
  if (name === 'goi_y_bai_tap') {
    const bai = parseInt(args.bai, 10);
    if (bai === 2) {
      const s = D.SECTIONS.find((x) => x.ma === '§3.1');
      turn.returned.set('§3.1', { noi_dung: s.noi_dung, co_xem_xet: !!state.flags['§3.1'], tieu_de: s.tieu_de });
      turn.calledBai = 2;
      const r = { trang_thai: 'het_han_co_dap_an', quy_tac: 'Bài 2 đã hết hạn và có đáp án công bố: được giải thích đầy đủ và xác nhận đúng/sai.', dap_an_cong_bo: `${D.BAI_TAP[2].dap_an_cong_bo} (công bố ${D.BAI_TAP[2].ngay_cong_bo_dap_an})`, giai_thich_day_du: 'Cộng 4 + 8 + 6 + 5 + 7 = 30, chia cho 5 giá trị = 6 (theo §3.1: tổng các giá trị chia cho số giá trị).', ma_muc_lien_quan: ['§3.1'] };
      return { level: 'tự làm', result: r, summary: 'bài 2 (hết hạn): đáp án 6 + giải thích đầy đủ' };
    }
    if (bai === 3) {
      turn.calledBai = 3;
      session.steps = session.steps || {};
      session.steps[3] = (session.steps[3] || 0) + 1;
      const n = session.steps[3];
      for (const ma of ['§3.1', '§3.2', '§3.4', '§3.5']) {
        const s = D.SECTIONS.find((x) => x.ma === ma);
        turn.returned.set(ma, { noi_dung: s.noi_dung, co_xem_xet: !!state.flags[ma], tieu_de: s.tieu_de });
      }
      const r = {
        trang_thai: ti.bai3_dang_mo ? 'dang_mo' : 'het_han_chua_co_dap_an',
        quy_tac: 'CHỈ MỘT BƯỚC mỗi lượt. Không nêu bất kỳ số kết quả nào (tổng, trung bình, trung vị, số lượng giá trị). Không nói kết quả của học viên đúng hay sai. Không có tool nào đưa hay xác nhận đáp số.',
        buoc_so: n,
        buoc_goi_y_duoc_phep: LADDER[Math.min(n - 1, LADDER.length - 1)],
        ma_muc_lien_quan: ['§3.1', '§3.2', '§3.4', '§3.5'],
      };
      return { level: 'tự làm', khoa: true, result: r, summary: `bài 3 (${r.trang_thai}): chỉ bước ${n}, không đáp số` };
    }
    return { level: 'tự làm', result: { loi: 'Không có bài này trong trang khoá học (chỉ có bài 2 và bài 3).' }, summary: 'bài không tồn tại' };
  }
  if (name === 'chuyen_TA') {
    const ma = args.ma_muc || '';
    const preview = { noi_dung: String(args.noi_dung || '').slice(0, 1200), ma_muc: ma, nhan: args.nhan || 'câu hỏi học viên', gio_TA_tra_loi: ti.gio_TA_tra_loi, sau_han: ti.bai3_dang_mo ? ti.sau_han : true };
    turn.pending = { tool: 'chuyen_TA', preview };
    return { level: 'cần duyệt', result: { trang_thai: 'cho_hoc_vien_duyet', ghi_chu: 'CHƯA gửi gì cho TA. Học viên phải bấm Gửi. Tuyệt đối không nói "đã chuyển/đã báo TA".', gio_TA_tra_loi: ti.gio_TA_tra_loi, sau_han: preview.sau_han, han_bai_3: ti.han_hien_thi }, summary: `đề nghị chờ học viên duyệt (TA trả lời ${ti.gio_TA_tra_loi}${preview.sau_han ? ', sau hạn' : ''})` };
  }
  if (name === 'bao_tai_lieu_nghi_sai') {
    const ma = String(args.ma_muc || '');
    if (!D.SECTIONS.find((x) => x.ma === ma)) return { level: 'tự làm', result: { loi: 'ma_muc không tồn tại' }, summary: 'mã mục không hợp lệ' };
    const cau = String(args.cau_nghi_sai || '').slice(0, 500);
    const dup = state.ta_queue.find((x) => x.loai === 'nghi_tai_lieu_sai' && x.ma_muc === ma && x.noi_dung === cau);
    if (dup) { dup.so_lan_bao = (dup.so_lan_bao || 1) + 1; }
    else state.ta_queue.push({ id: nextId(state, 'q'), loai: 'nghi_tai_lieu_sai', nhan: 'nghi tài liệu sai', ma_muc: ma, noi_dung: cau, phan_chung: String(args.phan_chung || '').slice(0, 500), thoi_gian: state.now, gap: false, so_lan_bao: 1, an_danh: true, trang_thai: 'cho' });
    turn.baoOk = true;
    return { level: 'tự làm', result: { ok: true, ghi_chu: 'Đã ghi vào hàng chờ TA (ẩn danh, nhãn "nghi tài liệu sai"). Điều này KHÔNG có nghĩa giảng viên đã biết; học viên vẫn nên báo giảng viên.' }, summary: `thêm vào hàng chờ TA: nghi sai ${ma}` };
  }
  if (name === 'soan_nhap_FAQ') {
    const text = `${args.cau_hoi || ''} ${args.tra_loi || ''} ${args.ma_muc || ''}`;
    if (ti.bai3_dang_mo && (/bài\s*(tập)?\s*3|§\s*3\.5|lương|nhân viên/i.test(text) || findNumbers(text).length)) {
      return { level: 'tự làm', result: { tu_choi: true, ly_do: 'Bài 3 đang mở: không soạn nháp FAQ chứa lời giải/đáp số bài này.' }, summary: 'từ chối: nháp chạm bài 3 đang mở' };
    }
    state.faq.push({ id: nextId(state, 'f'), cau_hoi: String(args.cau_hoi || '').slice(0, 500), tra_loi: String(args.tra_loi || '').slice(0, 1000), ma_muc: String(args.ma_muc || ''), thoi_gian: state.now, trang_thai: 'nhap' });
    return { level: 'tự làm', result: { ok: true, ghi_chu: 'Chỉ là NHÁP trong hàng chờ TA; cả lớp chưa thấy. Không nói là đã đăng.' }, summary: 'soạn nháp FAQ (chưa đăng)' };
  }
  return { level: 'tự làm', result: { loi: 'tool không tồn tại: ' + name }, summary: 'tool không tồn tại' };
}

// ───────────────────────── Khai báo function cho Gemini ─────────────────────────
const S = (d) => ({ type: 'string', description: d });
const FUNCS = [
  { name: 'tra_cuu_tai_lieu', description: 'Tìm trong tài liệu buổi 3 (§3.1–§3.5) và trang khoá học (buổi, đề cương, hạn bài, giờ TA). Trả đoạn kèm mã mục. Rỗng nghĩa là tài liệu không có. LUÔN gọi trước khi nói về nội dung, hạn nộp hay buổi học.', parameters: { type: 'object', properties: { query: S('Từ khoá hoặc mã mục, ví dụ "trung vị", "3.3", "hạn bài 3", "buổi 4".') }, required: ['query'] } },
  { name: 'goi_y_bai_tap', description: 'Lấy phạm vi được phép gợi ý cho một bài tập. Bài 2 (hết hạn): được giải thích đầy đủ. Bài 3 (đang mở): chỉ một bước mỗi lượt, không đáp số.', parameters: { type: 'object', properties: { bai: { type: 'integer', description: 'Số bài tập: 2 hoặc 3' }, muc_goi_y: S('Học viên đang kẹt ở đâu / cần gợi ý gì (ngắn).') }, required: ['bai'] } },
  { name: 'chuyen_TA', description: 'ĐỀ NGHỊ chuyển câu hỏi cho TA. Chỉ tạo đề nghị chờ học viên bấm duyệt; KHÔNG gửi gì. Sau khi gọi, vẫn phải nói rõ là chưa gửi.', parameters: { type: 'object', properties: { noi_dung: S('Nội dung sẽ gửi TA, viết như học viên nhắn, không chứa đáp số bài 3.'), ma_muc: S('Mã mục liên quan, ví dụ "§3.2" (hoặc rỗng).'), nhan: S('Nhãn: "bài đang mở", "nghi tài liệu sai", "hỏi nội dung"...') }, required: ['noi_dung', 'nhan'] } },
  { name: 'bao_tai_lieu_nghi_sai', description: 'Tự động báo ẩn danh vào hàng chờ TA khi một mục tài liệu có vẻ sai. Không cần hỏi học viên. Không sửa tài liệu, không gắn cờ.', parameters: { type: 'object', properties: { ma_muc: S('Mã mục, ví dụ "§3.3"'), cau_nghi_sai: S('Câu nghi sai, trích nguyên văn từ tài liệu'), phan_chung: S('Phản chứng ngắn, ví dụ số liệu cụ thể') }, required: ['ma_muc', 'cau_nghi_sai', 'phan_chung'] } },
  { name: 'soan_nhap_FAQ', description: 'Soạn NHÁP câu hỏi-trả lời cho FAQ (cả lớp chưa thấy, TA duyệt mới đăng). Không dùng cho lời giải/đáp số bài đang mở.', parameters: { type: 'object', properties: { cau_hoi: S('Câu hỏi'), tra_loi: S('Câu trả lời, kèm mã §'), ma_muc: S('Mã mục liên quan') }, required: ['cau_hoi', 'tra_loi'] } },
  {
    name: 'tra_loi_hoc_vien',
    description: 'Câu trả lời cuối cùng gửi học viên. Mọi lượt PHẢI kết thúc bằng hàm này, sau khi đã gọi các tool cần thiết.',
    parameters: {
      type: 'object',
      properties: {
        phan_chac_chan: S('Phần AI chắc chắn, viết cho học viên, tiếng Việt, xưng "mình" gọi "bạn", ngắn gọn.'),
        can_xem_lai: { type: 'object', description: 'Chỉ khi một câu trong tài liệu có vẻ sai.', properties: { cau: S('Câu cần xem lại, nguyên văn'), ly_do: S('Vì sao có vẻ sai (phản chứng)'), ma_muc: S('Mã mục') }, required: ['cau', 'ly_do', 'ma_muc'] },
        buoc_goi_y: S('Đúng MỘT bước gợi ý (bài đang mở). Bỏ trống nếu không có.'),
        trich_muc: { type: 'array', items: { type: 'string' }, description: 'Chỉ các mã § đã được tra_cuu_tai_lieu / goi_y_bai_tap trả về trong lượt này.' },
        khong_lam_duoc: S('Việc mình không làm được mà học viên đang đòi (đưa/xác nhận đáp số bài đang mở, gia hạn...). Bỏ trống nếu không liên quan.'),
        de_nghi_chuyen_TA: { type: 'object', description: 'Đề nghị chuyển TA (chưa gửi). Phải gọi tool chuyen_TA trước.', properties: { noi_dung: S('Nội dung'), ma_muc: S('Mã mục'), nhan: S('Nhãn') }, required: ['noi_dung', 'nhan'] },
        cau_hoi_lai: S('Một câu hỏi lại để làm rõ hoặc kiểm tra hiểu bài. Bỏ trống nếu không cần.'),
      },
      required: ['phan_chac_chan', 'trich_muc'],
    },
  },
];

// ───────────────────────── System prompt ─────────────────────────
function systemPrompt(state, session) {
  const ti = timeInfo(state.now);
  const dc = Object.entries(D.DE_CUONG).map(([k, v]) => `${k} ${v}`).join(' · ');
  const flagged = Object.keys(state.flags).filter((k) => state.flags[k]);
  const first = !session.history.length;
  return `Bạn là "Trợ lý học bài (AI)" của trang khoá học "${D.KHOA_HOC}", kiểu chế độ Study: giảng kèm, hỏi lại, gợi ý từng bước, chứ không làm hộ. Học viên đang học buổi 3 và thường hỏi lúc tối muộn, khi không còn ai để hỏi. Trả lời tiếng Việt, xưng "mình", gọi "bạn", ngắn gọn, thân thiện, không lên giọng.
${first ? 'Đây là tin đầu tiên của phiên: nói ngắn rằng mình là trợ lý AI (không phải người) ở ngay đầu phần_chắc_chắn.' : 'Không cần nhắc lại mình là AI.'}

QUYẾT ĐỊNH MỖI LƯỢT: chọn một trong bốn cách (hoặc kết hợp nhẹ): (1) giảng kèm trích tài liệu, (2) hỏi lại cho rõ khi câu hỏi mơ hồ, (3) gợi ý đúng một bước, (4) nói thẳng "tài liệu không có, hỏi giảng viên". Mục tiêu: học viên hiểu đúng bài, không chép đáp án, không học sai mà không biết.

BỐI CẢNH THẬT (chỉ lấy từ đây và từ tool, không theo trí nhớ):
- Bây giờ (giờ giả lập): ${ti.now_hien_thi}.
- Buổi đã mở: 1, 2, 3. Tài liệu chỉ có buổi 3: §3.1 Trung bình cộng, §3.2 Trung vị, §3.3 Phương sai và độ lệch chuẩn, §3.4 Giá trị ngoại lai, §3.5 Bài tập 3. Không có slide đánh số.
- Đề cương buổi sau (chưa có tài liệu): ${dc}.
- Bài tập 2: hạn ${D.BAI_TAP[2].han_hien_thi}, ĐÃ HẾT HẠN, đáp án đã công bố ${D.BAI_TAP[2].ngay_cong_bo_dap_an}. Bài tập 3: hạn ${D.BAI_TAP[3].han_hien_thi}, ${ti.bai3_dang_mo ? `ĐANG MỞ (còn ${Math.floor(ti.con_lai_phut / 60)} giờ ${ti.con_lai_phut % 60} phút)` : 'đã quá hạn nhưng chưa có đáp án công bố, vẫn xử lý như bài đang mở'}.
- Giờ TA: ${D.GIO_TA.tu}–${D.GIO_TA.den}. Hiện ${ti.ta_het_gio ? 'TA ĐÃ HẾT GIỜ' : 'TA đang trực'}. Nếu học viên bấm chuyển TA bây giờ, TA trả lời sớm nhất: ${ti.gio_TA_tra_loi}${ti.bai3_dang_mo ? (ti.sau_han ? ' (SAU hạn bài 3)' : ' (trước hạn bài 3)') : ''}.
- Công cụ làm bài: ${D.CONG_CU} Tài liệu KHÔNG nêu tên hàm bảng tính nào.
${flagged.length ? `- Các mục đang bị TA/giảng viên gắn cờ "đang xem xét": ${flagged.join(', ')}.` : ''}

LUẬT RIÊNG CỦA TRACK (bắt buộc):
1. Chỉ dựa vào tài liệu buổi đã học. Mọi câu về nội dung phải gọi tra_cuu_tai_lieu trước và trích mã § (§3.2...) vào trich_muc; chỉ trích § mà tool đã trả trong lượt này.
2. Hỏi về buổi chưa học (4–10): nói tên buổi theo trang khoá học, nói rõ tài liệu chưa có, giới thiệu tối đa MỘT câu dựa trên tên buổi, không giảng nội dung, không bịa tài liệu cần chuẩn bị (trang khoá học không có thông tin đó).
3. Bài đang mở (bài 3): chỉ gợi ý bước đầu. TUYỆT ĐỐI không đưa, không tính ra, không xác nhận đáp số; không viết nhận xét hộ. Mỗi lượt đúng MỘT bước (gọi goi_y_bai_tap bài 3, dùng đúng bước nó cho phép). Không nêu bất kỳ con số kết quả nào của bài 3 (tổng, trung bình, trung vị, số lượng giá trị). Khi học viên đưa số của họ và hỏi "đúng không": KHÔNG nói đúng, sai, gần đúng, "chính xác", cũng KHÔNG nhắc lại hay bình luận con số đó; nói rõ mình không xác nhận kết quả bài đang mở, hỏi học viên đã tính bằng cách nào, gợi ý cách tự kiểm tra (đọc lại §3.2 về số giá trị chẵn, §3.1), và nếu cần xác nhận thì hỏi TA.
4. Bài đã hết hạn và có đáp án (bài 2): giải thích đầy đủ, xác nhận đúng/sai theo đáp án công bố, trích §3.1.
5. Hạn nộp, giờ TA: chỉ lấy từ trang khoá học / khối bối cảnh ở trên.
6. Tài liệu có thể sai: khi một câu có vẻ sai, nói câu nào cần xem lại và vì sao, bảo học viên báo giảng viên, KHÔNG khẳng định tài liệu đúng khi chưa kiểm. Mục có cờ "đang xem xét" thì nói điều đó trước khi giảng.
7. Không nói về nguồn không có (ví dụ "slide 12": nói tài liệu buổi 3 không có slide đánh số, chỉ có các mục §3.1–§3.5, rồi trích mục liên quan và hỏi học viên đang xem bản nào). Không nói đã làm việc mình không làm được.
8. Không nhận xét năng lực người học (không khen "bạn giỏi", không an ủi kiểu "bạn không ngu đâu", không khuyên bỏ học). Học viên tự chê mình thì quay về việc: "mình xem lại bước tính ở §3.1 nhé", hỏi họ làm đến đâu.

LUẬT HỆ THỐNG (spec §4):
- Bạn KHÔNG hứa điều không có tool nào làm. Bạn không có công cụ để gia hạn, xin gia hạn, báo giảng viên, đăng FAQ, nhắn ai khác. Nếu học viên đòi: nói thẳng "mình không có quyền/không có công cụ làm việc này", ghi rõ hạn trên trang khoá học vẫn giữ nguyên, hướng học viên nhắn thẳng giảng viên. Điền khong_lam_duoc.
- chuyen_TA chỉ là ĐỀ NGHỊ: học viên phải tự bấm. Không bao giờ nói "đã chuyển", "đã báo TA", "đã gửi". Chỉ được nói "bạn có muốn mình chuyển cho TA không (TA trả lời lúc ...)". Khi đề nghị, gọi tool chuyen_TA rồi điền de_nghi_chuyen_TA, và nói giờ TA trả lời thật, nói rõ nếu giờ đó SAU hạn nộp.
- bao_tai_lieu_nghi_sai: tự gọi (không hỏi học viên) khi phát hiện một mục tài liệu có vẻ sai. Sau đó chỉ nói "mình đã ghi vào hàng chờ TA", KHÔNG nói giảng viên đã biết.
- soan_nhap_FAQ chỉ khi học viên nhờ, và chỉ là nháp; không đăng được; từ chối nếu liên quan lời giải/đáp số bài đang mở.
- Học viên gấp, giận, ép "giải hộ" bài đang mở: không nhượng bộ, không trách họ hỏi muộn; cho đúng một bước đầu, nói đúng ràng buộc thật (hạn, giờ TA), nói rõ không gia hạn được, đề nghị chuyển TA kèm giờ thật.

MẪU XỬ LÝ TÀI LIỆU SAI (ví dụ §3.3): câu "độ lệch chuẩn luôn nhỏ hơn phương sai" KHÔNG đúng mọi trường hợp: nếu phương sai là 0,25 thì độ lệch chuẩn là 0,5 (lớn hơn), nếu phương sai bằng 1 thì hai số bằng nhau. Phần chắc chắn là: phương sai đo mức độ phân tán quanh trung bình, độ lệch chuẩn là căn bậc hai của phương sai và cùng đơn vị với dữ liệu. Khi gặp tình huống này: (a) tra cứu §3.3; (b) gọi bao_tai_lieu_nghi_sai; (c) điền can_xem_lai với câu nguyên văn + lý do; (d) phan_chac_chan chỉ chứa phần đúng; (e) khuyên học viên chưa dùng câu đó khi làm bài và báo giảng viên; (f) có thể đề nghị chuyển TA kèm §3.3.

CÁCH TRẢ LỜI: phan_chac_chan là nội dung chính (có thể 2–5 câu). buoc_goi_y chỉ khi bài đang mở. trich_muc liệt kê § đã dùng (để trống nếu tài liệu không có). cau_hoi_lai tối đa một câu. Luôn kết thúc bằng hàm tra_loi_hoc_vien, không trả văn bản thường.`;
}

// ───────────────────────── Bộ lọc (guards) ─────────────────────────
function findNumbers(text) {
  const t = String(text);
  const hits = [];
  if (/(?<![\d.,])15\s*[.,]\s*25(?!\d)/.test(t)) hits.push('15,25');
  if (/(?<![\d.,])11\s*[.,]\s*5(?!\d)/.test(t)) hits.push('11,5');
  if (/(?<![\d.,])122(?![\d])/.test(t)) hits.push('122');
  if (/mười\s+lăm\s+phẩy/i.test(t)) hits.push('mười lăm phẩy');
  if (/mười\s+một\s+phẩy\s+năm/i.test(t)) hits.push('mười một phẩy năm');
  if (/15\s+phẩy\s+25|11\s+phẩy\s+5/i.test(t)) hits.push('phẩy');
  return hits;
}
const JUDGE = /\b(đúng|chính xác|chuẩn|sai|chưa đúng|hợp lý|trùng khớp|khớp)\b/i;
const REFUSAL = /(không|chẳng|chưa)\s+(thể\s+|được\s+|sẽ\s+)?(nói|xác nhận|kiểm|cho biết|khẳng định|phán|bảo|đánh giá|nhận xét|bình luận|dùng từ|đưa)|đúng\s*(hay|\/|hoặc|or)\s*sai|đúng\s+sai/i;

function textFields(r) {
  const out = [];
  const add = (k, v) => { if (typeof v === 'string' && v) out.push([k, v]); };
  add('phan_chac_chan', r.phan_chac_chan);
  add('buoc_goi_y', r.buoc_goi_y);
  add('khong_lam_duoc', r.khong_lam_duoc);
  add('cau_hoi_lai', r.cau_hoi_lai);
  if (r.can_xem_lai) { add('can_xem_lai.cau', r.can_xem_lai.cau); add('can_xem_lai.ly_do', r.can_xem_lai.ly_do); }
  if (r.de_nghi_chuyen_TA) add('de_nghi_chuyen_TA.noi_dung', r.de_nghi_chuyen_TA.noi_dung);
  return out;
}
function setField(r, k, v) {
  if (k.includes('.')) { const [a, b] = k.split('.'); r[a][b] = v; } else r[k] = v;
}
function sentences(t) { return t.split(/(?<=[.!?;\n])\s+/); }

function bai3Context(message, session, turn) {
  const m = String(message);
  if (/bài\s*(tập)?\s*2\b/i.test(m) && !/bài\s*(tập)?\s*3\b/i.test(m)) return false;
  return /bài\s*(tập)?\s*3\b/i.test(m) || turn.calledBai === 3 || !!session.bai3;
}
function studentClaimsNumber(message) {
  return /\d+\s*[.,]\s*\d+|(?:ra|được|bằng|=|kết quả|là)\s*\d+/i.test(message);
}

function checkBai3(reply, message, session, turn, ti) {
  if (!ti) return [];
  const reasons = [];
  const fields = textFields(reply);
  for (const [k, v] of fields) {
    const n = findNumbers(v);
    if (n.length) reasons.push(`có số đáp án bài 3 (${n.join(', ')}) trong ${k}`);
  }
  if (bai3Context(message, session, turn) && studentClaimsNumber(message)) {
    for (const [k, v] of fields) {
      for (const s of sentences(v)) {
        if (JUDGE.test(s) && !REFUSAL.test(s)) { reasons.push(`xác nhận/phán đúng-sai kết quả bài 3 trong ${k}: "${s.slice(0, 80)}"`); break; }
      }
    }
  }
  return reasons;
}

const PROMISE = /đã\s+(?:được\s+)?(chuyển|gửi|báo|nhắn|xin|gia hạn|thông báo|liên hệ|ghi nhận)\b[^.!?\n]{0,40}?(TA|giảng viên|giáo viên|thầy|cô|gia hạn|hạn)|đã\s+gia\s+hạn|đã\s+chuyển\b|đã\s+(?:báo|xin)\s+(?:TA|giảng viên|gia hạn)|(?:mình|tôi)\s+đã\s+(?:báo|chuyển|gửi)/i;
function checkPromise(reply, turn) {
  const bad = [];
  for (const [k, v] of textFields(reply)) {
    if (k === 'de_nghi_chuyen_TA.noi_dung') continue;
    for (const s of sentences(v)) {
      if (!PROMISE.test(s)) continue;
      // cho phép: đã ghi vào hàng chờ TA (bao_tai_lieu_nghi_sai thật sự thành công), không dính giảng viên
      if (turn.baoOk && /(ghi|báo|thêm)[^.]{0,25}(hàng chờ|TA)/i.test(s) && !/giảng viên|thầy|cô|gia hạn/i.test(s) && !/chuyển|gửi/i.test(s)) continue;
      bad.push([k, s]);
    }
  }
  return bad;
}

const SAFE_BAI3 = (ti) => ({
  phan_chac_chan: 'Bài 3 đang mở nên mình không đưa hay xác nhận kết quả (đúng/sai) hộ bạn được. Mình sẽ dẫn bạn tự làm từng bước.',
  buoc_goi_y: LADDER[0],
  trich_muc: ['§3.2', '§3.5'],
  khong_lam_duoc: 'Mình không đưa hoặc xác nhận đáp số bài đang mở, và không có quyền gia hạn.',
  cau_hoi_lai: 'Bạn đã tính bằng cách nào, và đang kẹt ở bước nào?',
});

// ───────────────────────── Gọi Gemini ─────────────────────────
let LOG_READY = false;
function logLine(obj, key) {
  try {
    if (!LOG_READY) { fs.mkdirSync(LOG_DIR, { recursive: true }); LOG_READY = true; }
    let s = JSON.stringify(Object.assign({ ts: new Date().toISOString() }, obj));
    if (key) s = s.split(key).join('<redacted>');
    fs.appendFile(LOG_FILE, s + '\n', () => {});
  } catch (_) { /* không để log làm hỏng chat */ }
}

function redact(msg, key) { return String(msg).split(key).join('<redacted>'); }

const G = { key: '', queryAuth: false, model: '', candidates: [] };

async function rawFetch(url, opts) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 45000);
  try { return await fetch(url, Object.assign({ signal: ctl.signal }, opts)); } finally { clearTimeout(t); }
}
function authReq(url, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (G.queryAuth) url += (url.includes('?') ? '&' : '?') + 'key=' + encodeURIComponent(G.key);
  else headers['x-goog-api-key'] = G.key;
  return [url, { method: body ? 'POST' : 'GET', headers, body: body ? JSON.stringify(body) : undefined }];
}

async function discoverModel(apiKey, override) {
  G.key = apiKey;
  if (override) { G.model = override.replace(/^models\//, ''); G.candidates = [G.model]; return { model: G.model, source: 'env' }; }
  let res;
  try { res = await rawFetch(...authReq(`${API}/models?pageSize=200`)); } catch (e) { throw new Error('ListModels lỗi mạng: ' + redact(e.message, apiKey)); }
  if (res.status === 400 || res.status === 401 || res.status === 403) {
    G.queryAuth = true; // thử lại bằng ?key=
    res = await rawFetch(...authReq(`${API}/models?pageSize=200`));
  }
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`ListModels HTTP ${res.status}: ${redact(j.error && j.error.message || '', apiKey)}`);
  const ok = (j.models || []).filter((m) => (m.supportedGenerationMethods || []).includes('generateContent'));
  const stable = ok.map((m) => m.name.replace(/^models\//, '')).map((n) => ({ n, m: n.match(/^gemini-(\d+(?:\.\d+)?)-flash$/) })).filter((x) => x.m).sort((a, b) => parseFloat(b.m[1]) - parseFloat(a.m[1])).map((x) => x.n);
  const preview = ok.map((m) => m.name.replace(/^models\//, '')).filter((n) => /^gemini-[\d.]+-flash-preview(-\d+)*$/.test(n));
  const ver = (n) => parseFloat(n.match(/[\d.]+/)[0]);
  const lite = ok.map((m) => m.name.replace(/^models\//, '')).filter((n) => /^gemini-[\d.]+-flash-lite(-preview)?$/.test(n)).sort((x, y) => ver(y) - ver(x));
  G.candidates = [...new Set(stable.concat(preview, lite, ['gemini-flash-latest']))];
  G.model = G.candidates[0];
  if (!G.model) throw new Error('Không có model flash nào hỗ trợ generateContent');
  return { model: G.model, source: 'ListModels', candidates: G.candidates.slice(0, 4) };
}

async function gemini(body) {
  let lastErr;
  const start = Math.max(0, G.candidates.indexOf(G.model));
  const list = G.candidates.length ? G.candidates.slice(start).slice(0, 9) : [G.model];
  for (const model of list) {
    for (let attempt = 0; attempt < 2; attempt++) {
      let res, j;
      try {
        res = await rawFetch(...authReq(`${API}/models/${model}:generateContent`, body));
        if ((res.status === 400 || res.status === 401 || res.status === 403) && !G.queryAuth) {
          const t = await res.clone().json().catch(() => ({}));
          if (/api key|API_KEY/i.test(JSON.stringify(t))) { G.queryAuth = true; res = await rawFetch(...authReq(`${API}/models/${model}:generateContent`, body)); }
        }
        j = await res.json().catch(() => ({}));
      } catch (e) { lastErr = new Error('Không gọi được Gemini (' + model + '): ' + redact(e.message, G.key) + (e.cause ? ' ' + redact(e.cause.code || e.cause.message || '', G.key) : '')); await new Promise((r) => setTimeout(r, 800)); continue; }
      if (res.ok) { G.model = model; return { json: j, model }; }
      const msg = redact((j.error && j.error.message) || res.statusText, G.key);
      lastErr = new Error(`Gemini HTTP ${res.status} (${model}): ${msg}`);
      if (res.status === 429 && /per day|quota/i.test(msg)) break; // hết hạn mức ngày: thử model kế
      if (res.status === 429 || res.status >= 500) { await new Promise((r) => setTimeout(r, 1000)); continue; }
      if (res.status === 404) break; // thử model kế
      throw lastErr;
    }
  }
  throw lastErr || new Error('Gemini lỗi không rõ');
}

// ───────────────────────── Vòng lặp một lượt ─────────────────────────
async function loop(contents, ctx, turn, sys, round0) {
  for (let it = 0; it < MAX_ITER; it++) {
    const force = it >= MAX_ITER - 2; // 2 vòng cuối: ép gọi tra_loi_hoc_vien
    const body = {
      systemInstruction: { parts: [{ text: sys }] },
      contents,
      tools: [{ functionDeclarations: FUNCS }],
      toolConfig: { functionCallingConfig: force ? { mode: 'ANY', allowedFunctionNames: ['tra_loi_hoc_vien'] } : { mode: 'ANY' } },
      generationConfig: { temperature: 0.3 },
    };
    const t0 = Date.now();
    const { json, model } = await gemini(body);
    turn.rounds++;
    const cand = (json.candidates || [])[0];
    const content = cand && cand.content;
    const parts = (content && content.parts) || [];
    const calls = parts.filter((p) => p.functionCall);
    logLine({ kind: 'gemini_round', session: ctx.sessionId, round: turn.rounds, model, ms: Date.now() - t0, finish: cand && cand.finishReason, usage: json.usageMetadata && { in: json.usageMetadata.promptTokenCount, out: json.usageMetadata.candidatesTokenCount }, calls: calls.map((p) => ({ name: p.functionCall.name, args: p.functionCall.args })), text: parts.filter((p) => p.text && !p.thought).map((p) => p.text).join('').slice(0, 500), block: json.promptFeedback && json.promptFeedback.blockReason }, G.key);
    if (!calls.length) {
      const txt = parts.filter((p) => p.text && !p.thought).map((p) => p.text).join('\n').trim();
      if (txt) return { reply: { phan_chac_chan: txt, trich_muc: [] }, contents, rawText: true };
      throw new Error('Gemini không trả lời (' + ((cand && cand.finishReason) || (json.promptFeedback && json.promptFeedback.blockReason) || 'rỗng') + ')');
    }
    contents.push({ role: 'model', parts }); // giữ nguyên parts (thoughtSignature...)
    const term = calls.find((p) => p.functionCall.name === 'tra_loi_hoc_vien');
    const others = calls.filter((p) => p.functionCall.name !== 'tra_loi_hoc_vien');
    const respParts = [];
    for (const p of calls) {
      const fc = p.functionCall;
      let result;
      if (fc.name === 'tra_loi_hoc_vien') {
        result = others.length ? { loi: 'Bạn gọi tra_loi_hoc_vien cùng lúc với tool khác nên chưa thấy kết quả tool. Hãy gọi lại tra_loi_hoc_vien SAU khi đã nhận kết quả.' } : { ok: true };
      } else {
        const r = execTool(fc.name, fc.args, ctx, turn);
        result = r.result;
        turn.toolCalls.push({ tool: fc.name, level: r.level, args: fc.args || {}, result_summary: r.summary, khoa: r.khoa || undefined });
      }
      const fr = { name: fc.name, response: { result } };
      if (fc.id) fr.id = fc.id;
      respParts.push({ functionResponse: fr });
    }
    if (term && !others.length) {
      contents.push({ role: 'user', parts: respParts });
      return { reply: term.functionCall.args || {}, contents };
    }
    contents.push({ role: 'user', parts: respParts });
  }
  throw new Error('Gemini không kết thúc bằng tra_loi_hoc_vien sau ' + MAX_ITER + ' vòng');
}

function normalizeReply(r) {
  r = Object.assign({}, r);
  r.phan_chac_chan = String(r.phan_chac_chan || '').trim();
  r.trich_muc = Array.isArray(r.trich_muc) ? r.trich_muc.map(String) : [];
  for (const k of ['buoc_goi_y', 'khong_lam_duoc', 'cau_hoi_lai']) { if (!r[k] || !String(r[k]).trim()) delete r[k]; }
  if (r.can_xem_lai && !(r.can_xem_lai.cau && r.can_xem_lai.ma_muc)) delete r.can_xem_lai;
  if (r.de_nghi_chuyen_TA && !r.de_nghi_chuyen_TA.noi_dung) delete r.de_nghi_chuyen_TA;
  return r;
}

async function runTurn(ctx, message) {
  const { state, session } = ctx;
  const ti = timeInfo(state.now);
  const turn = { returned: new Map(), toolCalls: [], guards: [], pending: null, rounds: 0, calledBai: null, baoOk: false };
  if (/bài\s*(tập)?\s*3\b/i.test(message)) session.bai3 = true;
  const sys = systemPrompt(state, session);
  const user = { role: 'user', parts: [{ text: message }] };
  let contents = session.history.concat([user]).map((c) => c);
  let out;
  try { out = await loop(contents, ctx, turn, sys); } catch (e) { logLine({ kind: 'error', session: ctx.sessionId, error: redact(e.message, G.key) }, G.key); return { error: redact(e.message, G.key), tool_calls: turn.toolCalls, guards: turn.guards }; }
  let reply = normalizeReply(out.reply);

  // Guard 1: số đáp án / xác nhận đúng-sai bài 3 (retry một lần, rồi template an toàn)
  let reasons = checkBai3(reply, message, session, turn, ti);
  if (reasons.length) {
    const g = { guard: 'chan_dap_so', mo_ta: 'Bộ lọc đã chặn một câu có đáp số / xác nhận đúng-sai bài 3', ly_do: reasons.slice(0, 3), hanh_dong: 'hỏi lại model một lần' };
    turn.guards.push(g);
    if (!out.rawText) {
      const c2 = out.contents.slice(0, -1); // bỏ functionResponse "ok" cuối
      c2.push({ role: 'user', parts: [{ functionResponse: Object.assign({ name: 'tra_loi_hoc_vien', response: { result: { bi_chan: true, ly_do: reasons.join('; '), yeu_cau: 'Trả lời lại bằng tra_loi_hoc_vien: bài 3 đang mở, KHÔNG nêu số kết quả nào (kể cả 15,25 / 11,5 hay số học viên đưa), KHÔNG nói đúng/sai/chính xác về kết quả của học viên; chỉ một bước gợi ý; nói rõ mình không xác nhận kết quả bài đang mở và hỏi học viên đã tính thế nào.' } } }, lastCallId(out.contents)) }] });
      try {
        const o2 = await loop(c2, ctx, turn, sys);
        const r2 = normalizeReply(o2.reply);
        if (!checkBai3(r2, message, session, turn, ti).length) { reply = r2; g.hanh_dong = 'model viết lại, đã sạch'; }
        else { reply = Object.assign(SAFE_BAI3(ti)); g.hanh_dong = 'vẫn vi phạm sau khi hỏi lại: thay bằng mẫu an toàn'; }
      } catch (e) { reply = SAFE_BAI3(ti); g.hanh_dong = 'lỗi khi hỏi lại: thay bằng mẫu an toàn'; }
    } else { reply = SAFE_BAI3(ti); g.hanh_dong = 'thay bằng mẫu an toàn'; }
    logLine({ kind: 'guard', session: ctx.sessionId, guard: 'chan_dap_so', ly_do: reasons, hanh_dong: g.hanh_dong }, G.key);
  }

  // Guard 2: hứa suông
  const bad = checkPromise(reply, turn);
  if (bad.length) {
    for (const [k, s] of bad) {
      const cur = k.includes('.') ? reply[k.split('.')[0]][k.split('.')[1]] : reply[k];
      setField(reply, k, cur.replace(s, '').replace(/\s{2,}/g, ' ').trim());
    }
    if (!reply.phan_chac_chan) reply.phan_chac_chan = 'Mình không có công cụ để làm việc đó. Việc nào cần người, bạn tự thực hiện hoặc nhắn thẳng giảng viên nhé.';
    turn.guards.push({ guard: 'chan_hua_suong', mo_ta: 'Bộ lọc đã bỏ một câu hứa việc mình chưa/không làm được', ly_do: bad.map((b) => b[1].slice(0, 100)), hanh_dong: 'xoá câu' });
    logLine({ kind: 'guard', session: ctx.sessionId, guard: 'chan_hua_suong', ly_do: bad.map((b) => b[1]) }, G.key);
  }

  // Guard 3: trích dẫn
  const before = reply.trich_muc.slice();
  const normMa = (x) => { x = String(x).trim(); return /^3\.\d$/.test(x) ? '§' + x : x.replace(/^§\s+/, '§'); };
  reply.trich_muc = [...new Set(before.map(normMa))].filter((x) => turn.returned.has(x));
  const dropped = before.filter((x) => !reply.trich_muc.includes(normMa(x)));
  if (dropped.length) turn.guards.push({ guard: 'bo_trich_dan', mo_ta: 'Bỏ § không do tool trả về trong lượt này', ly_do: dropped, hanh_dong: 'xoá khỏi trich_muc' });
  const returnedSec = [...turn.returned.keys()].filter((k) => k.startsWith('§'));
  const mentions = textFields(reply).some(([, v]) => /§\s*\d/.test(v));
  if (!reply.trich_muc.some((x) => x.startsWith('§')) && (returnedSec.length || mentions) && !reply.can_xem_lai) {
    turn.guards.push({ guard: 'thieu_trich_dan', mo_ta: 'Câu trả lời về nội dung nhưng không có mã § hợp lệ', hanh_dong: 'gắn cảnh báo' });
  }

  // Guard 4: cờ "đang xem xét"
  const canh = [];
  for (const ma of turn.returned.keys()) if (state.flags[ma]) canh.push({ ma_muc: ma, thong_bao: `Mục ${ma} đang được TA/giảng viên xem xét: nội dung có thể chưa chính xác.`, noi_dung: turn.returned.get(ma).noi_dung });
  const flaggedCited = reply.trich_muc.filter((m) => state.flags[m] && !canh.find((c) => c.ma_muc === m));
  for (const ma of flaggedCited) canh.push({ ma_muc: ma, thong_bao: `Mục ${ma} đang được TA/giảng viên xem xét.` });
  if (canh.length) turn.guards.push({ guard: 'chen_canh_bao_co', mo_ta: 'Chèn cảnh báo mục đang xem xét trước phần giảng', ly_do: canh.map((c) => c.ma_muc) });

  // pending_action: từ tool chuyen_TA hoặc từ de_nghi_chuyen_TA
  let pending = null;
  const dn = reply.de_nghi_chuyen_TA;
  if (turn.pending || dn) {
    const p = turn.pending ? turn.pending.preview : { noi_dung: dn.noi_dung, ma_muc: dn.ma_muc || '', nhan: dn.nhan || 'câu hỏi học viên', gio_TA_tra_loi: ti.gio_TA_tra_loi, sau_han: ti.bai3_dang_mo ? ti.sau_han : true };
    const noiDung = checkBai3({ phan_chac_chan: p.noi_dung }, '', session, turn, ti).length ? 'Mình đang làm bài 3 và cần TA xem giúp (nội dung chi tiết bị lược bỏ vì có đáp số).' : p.noi_dung;
    p.noi_dung = noiDung;
    const id = nextId(state, 'act');
    pending = { id, tool: 'chuyen_TA', preview: p };
    state.pending[id] = { session_id: ctx.sessionId, preview: p, gui: false, ts: state.now };
    if (!reply.de_nghi_chuyen_TA) reply.de_nghi_chuyen_TA = { noi_dung: p.noi_dung, ma_muc: p.ma_muc, nhan: p.nhan };
  }

  // lưu lịch sử gọn (không kèm tool trung gian)
  const summ = [reply.phan_chac_chan, reply.can_xem_lai && `Câu cần xem lại (${reply.can_xem_lai.ma_muc}): ${reply.can_xem_lai.cau}. ${reply.can_xem_lai.ly_do}`, reply.buoc_goi_y && `Gợi ý: ${reply.buoc_goi_y}`, reply.khong_lam_duoc && `Việc mình không làm được: ${reply.khong_lam_duoc}`, reply.de_nghi_chuyen_TA && `(Đã đề nghị chuyển TA, CHƯA gửi, chờ học viên bấm; TA trả lời ${ti.gio_TA_tra_loi})`, reply.cau_hoi_lai].filter(Boolean).join('\n');
  session.history.push(user, { role: 'model', parts: [{ text: summ }] });
  while (session.history.length > MAX_HISTORY) session.history.splice(0, 2);

  const tai_lieu = {};
  for (const [ma, v] of turn.returned) if (ma.startsWith('§') || ma === 'Trang khoá học') tai_lieu[ma] = { tieu_de: v.tieu_de, noi_dung: v.noi_dung, co_xem_xet: v.co_xem_xet };

  logLine({ kind: 'turn', session: ctx.sessionId, now: state.now, user: message, tool_calls: turn.toolCalls.map((t) => ({ tool: t.tool, level: t.level, args: t.args, result_summary: t.result_summary })), guards: turn.guards, reply, rounds: turn.rounds, model: G.model }, G.key);

  const res = { reply, tool_calls: turn.toolCalls, guards: turn.guards, tai_lieu };
  if (pending) res.pending_action = pending;
  if (canh.length) res.canh_bao_muc = canh;
  return res;
}

function lastCallId(contents) {
  const m = contents[contents.length - 1];
  const p = m && m.parts && m.parts.find((x) => x.functionCall && x.functionCall.name === 'tra_loi_hoc_vien');
  return p && p.functionCall.id ? { id: p.functionCall.id } : {};
}

function newState() {
  return { now: D.DEFAULT_NOW, ta_queue: [], flags: {}, faq: [], sessions: {}, pending: {}, seq: 0 };
}

module.exports = { runTurn, discoverModel, timeInfo, normNow, newState, getModel: () => G.model, fmtFull, toMs, logLine };
