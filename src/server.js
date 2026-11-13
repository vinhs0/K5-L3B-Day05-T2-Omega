'use strict';
// HTTP server (Node built-ins). Chạy: node src/server.js  ->  http://localhost:3000
const http = require('http');
const fs = require('fs');
const path = require('path');
const A = require('./agent');
const D = require('./course-data');

const ROOT = path.resolve(__dirname, '..');
const PORT = parseInt(process.env.PORT, 10) || 3000;

function loadEnv() {
  const env = {};
  try {
    for (const line of fs.readFileSync(path.join(ROOT, '.env'), 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch (_) { /* không có .env */ }
  return env;
}
const ENV = loadEnv();
const API_KEY = process.env.GEMINI_API_KEY || ENV.GEMINI_API_KEY || '';
const MODEL_OVERRIDE = process.env.GEMINI_MODEL || ENV.GEMINI_MODEL || '';

let state = A.newState();
let modelInfo = { model: '', error: '' };

const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };

function send(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(body);
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let b = '';
    req.on('data', (c) => { b += c; if (b.length > 1e6) { reject(new Error('body quá lớn')); req.destroy(); } });
    req.on('end', () => { try { resolve(b ? JSON.parse(b) : {}); } catch (e) { reject(new Error('JSON không hợp lệ')); } });
    req.on('error', reject);
  });
}

function stateView() {
  const ti = A.timeInfo(state.now);
  return {
    now: state.now,
    deadline: { bai: 3, han: D.BAI_TAP[3].han, han_hien_thi: D.BAI_TAP[3].han_hien_thi, con_lai_phut: ti.con_lai_phut, het_han: !ti.bai3_dang_mo, ta_het_gio: ti.ta_het_gio, gio_TA_tra_loi: ti.gio_TA_tra_loi, sau_han: ti.sau_han, gio_ta: `${D.GIO_TA.tu}–${D.GIO_TA.den}` },
    ta_queue: state.ta_queue,
    flags: state.flags,
    faq: state.faq,
    model: A.getModel() || modelInfo.model || '',
    has_key: !!API_KEY,
    model_error: modelInfo.error || undefined,
  };
}

function getSession(id) {
  if (!state.sessions[id]) state.sessions[id] = { history: [], steps: {}, bai3: false };
  return state.sessions[id];
}

async function handleApi(req, res, url) {
  const p = url.pathname;
  if (req.method === 'GET' && p === '/api/state') return send(res, 200, stateView());
  if (req.method === 'GET' && p === '/api/section') {
    const ma = url.searchParams.get('ma') || '';
    const s = D.SECTIONS.find((x) => x.ma === ma || x.ma === '§' + ma);
    if (!s) return send(res, 404, { error: 'Không có mục này' });
    return send(res, 200, { ma: s.ma, tieu_de: s.tieu_de, noi_dung: s.noi_dung, co_xem_xet: !!state.flags[s.ma] });
  }
  if (req.method === 'GET' && p === '/api/replies') { // học viên nhận trả lời của TA trong chatbox của mình
    const sid = url.searchParams.get('session_id') || '';
    return send(res, 200, { replies: (state.replies || []).filter((r) => r.session_id === sid) });
  }
  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });
  const body = await readBody(req);

  if (p === '/api/clock') {
    const n = A.normNow(body.now);
    if (!n) return send(res, 400, { error: 'now phải dạng 2026-11-13T22:10' });
    state.now = n;
    return send(res, 200, stateView());
  }
  if (p === '/api/reset') {
    const now = state.now;
    state = A.newState();
    state.now = now;
    return send(res, 200, Object.assign({ ok: true }, stateView()));
  }
  if (p === '/api/chat') {
    const message = String(body.message || '').trim();
    const sid = String(body.session_id || 'default');
    if (!message) return send(res, 400, { error: 'Thiếu message' });
    if (!API_KEY) return send(res, 200, { error: 'Chưa cấu hình GEMINI_API_KEY trong .env nên AI chưa trả lời được. Bạn có thể chuyển TA.', tool_calls: [], guards: [] });
    if (!modelInfo.model) await initModel();
    if (!modelInfo.model) return send(res, 200, { error: 'AI đang lỗi: ' + (modelInfo.error || 'chưa chọn được model'), tool_calls: [], guards: [] });
    const out = await A.runTurn({ state, session: getSession(sid), sessionId: sid }, message);
    return send(res, 200, out);
  }
  if (p === '/api/approve') {
    const act = state.pending[body.action_id];
    if (!act || (body.session_id && act.session_id !== body.session_id)) return send(res, 404, { ok: false, error: 'Không có đề nghị này (đã xử lý hoặc hết hiệu lực).' });
    const sess = getSession(act.session_id);
    delete state.pending[body.action_id];
    if (!body.approve) {
      sess.history.push({ role: 'user', parts: [{ text: '[Hệ thống] Học viên đã bấm Thôi: KHÔNG gửi gì cho TA.' }] });
      return send(res, 200, { ok: true, gui: false, message: 'Đã huỷ, không gửi gì cho TA.' });
    }
    const ti = A.timeInfo(state.now);
    const pv = act.preview;
    const ghi = String(body.ghi_them || '').trim().slice(0, 600);
    const item = {
      id: 'q' + (++state.seq),
      loai: 'chuyen_TA',
      nhan: pv.nhan || 'câu hỏi học viên',
      ma_muc: pv.ma_muc || '',
      noi_dung: pv.noi_dung + (ghi ? `\n[Học viên ghi thêm] ${ghi}` : ''),
      thoi_gian: state.now,
      gio_TA_tra_loi: pv.gio_TA_tra_loi,
      sau_han: !!pv.sau_han,
      gap: ti.bai3_dang_mo, // gửi trước hạn -> "gấp, trước hạn"
      nhan_gap: ti.bai3_dang_mo ? 'gấp, trước hạn' : undefined,
      an_danh: false,
      session_id: act.session_id,
      trang_thai: 'cho',
    };
    state.ta_queue.push(item);
    const msg = `Đã chuyển cho TA, TA trả lời lúc ${pv.gio_TA_tra_loi}` + (pv.sau_han ? ` (sau hạn ${D.BAI_TAP[3].han_hien_thi}). Bạn vẫn nên nhắn thẳng giảng viên nếu cần xin gia hạn.` : '.');
    sess.history.push({ role: 'user', parts: [{ text: `[Hệ thống] Học viên đã bấm Gửi: câu hỏi ĐÃ chuyển cho TA, TA trả lời lúc ${pv.gio_TA_tra_loi}.` }] });
    return send(res, 200, { ok: true, gui: true, message: msg, item });
  }
  if (p === '/api/ta/action') {
    const t = body.type;
    const find = () => state.ta_queue.find((x) => x.id === body.id);
    if (t === 'flag' || t === 'unflag') {
      const ma = body.ma_muc || (find() && find().ma_muc);
      if (!D.SECTIONS.find((s) => s.ma === ma)) return send(res, 400, { error: 'ma_muc không hợp lệ' });
      if (t === 'flag') state.flags[ma] = true; else delete state.flags[ma];
      return send(res, 200, { ok: true, flags: state.flags });
    }
    if (t === 'dismiss') {
      const i = state.ta_queue.findIndex((x) => x.id === body.id);
      if (i < 0) return send(res, 404, { error: 'Không có mục này' });
      state.ta_queue.splice(i, 1);
      return send(res, 200, { ok: true, ta_queue: state.ta_queue });
    }
    if (t === 'ta_reply') { // TA trả lời câu hỏi đã chuyển; tin nhắn hiện trong chatbox của học viên đã hỏi
      const i = state.ta_queue.findIndex((x) => x.id === body.id);
      if (i < 0) return send(res, 404, { error: 'Không có mục này' });
      const it = state.ta_queue[i];
      const tra_loi = String(body.tra_loi || '').trim().slice(0, 2000);
      if (!tra_loi) return send(res, 400, { error: 'Chưa nhập nội dung trả lời' });
      if (!it.session_id) return send(res, 400, { error: 'Mục này không gắn với phiên học viên nào' });
      (state.replies = state.replies || []).push({ id: 'r' + (++state.seq), session_id: it.session_id, tra_loi, thoi_gian: state.now, cho_cau_hoi: it.noi_dung });
      const sess = getSession(it.session_id);
      sess.history.push({ role: 'user', parts: [{ text: `[Hệ thống] TA đã trả lời học viên: "${tra_loi}"` }] });
      state.ta_queue.splice(i, 1);
      return send(res, 200, { ok: true, ta_queue: state.ta_queue });
    }
    if (t === 'faq_decide') { // TA chỉnh nội dung rồi đăng FAQ hoặc không đăng, thay cho nút "Xong"
      const i = state.ta_queue.findIndex((x) => x.id === body.id);
      if (i < 0) return send(res, 404, { error: 'Không có mục này' });
      const it = state.ta_queue[i];
      if (body.publish) {
        const cau_hoi = String(body.cau_hoi || '').trim().slice(0, 500);
        const tra_loi = String(body.tra_loi || '').trim().slice(0, 1000);
        if (!cau_hoi || !tra_loi) return send(res, 400, { error: 'Cần có cả câu hỏi và câu trả lời để đăng FAQ' });
        state.faq.push({ id: 'f' + (++state.seq), cau_hoi, tra_loi, ma_muc: it.ma_muc || '', thoi_gian: state.now, trang_thai: 'da_dang', nguoi_duyet: 'TA', tu_bao_sai: it.id });
      }
      state.ta_queue.splice(i, 1);
      return send(res, 200, { ok: true, ta_queue: state.ta_queue, faq: state.faq });
    }
    if (t === 'faq_publish' || t === 'faq_discard') {
      const i = state.faq.findIndex((x) => x.id === body.id);
      if (i < 0) return send(res, 404, { error: 'Không có nháp này' });
      if (t === 'faq_discard') state.faq.splice(i, 1); else { state.faq[i].trang_thai = 'da_dang'; state.faq[i].nguoi_duyet = 'TA'; }
      return send(res, 200, { ok: true, faq: state.faq });
    }
    return send(res, 400, { error: 'type không hợp lệ' });
  }
  return send(res, 404, { error: 'Không có API này' });
}

function serveStatic(req, res, url) {
  let rel = decodeURIComponent(url.pathname);
  if (rel === '/') rel = '/chatbot.html';
  const file = path.resolve(__dirname, '.' + rel);
  if (!file.startsWith(__dirname + path.sep) || file.startsWith(path.join(__dirname, 'logs')) || ['server.js', 'agent.js', 'course-data.js'].includes(path.basename(file))) { res.writeHead(403); return res.end('Forbidden'); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('Không tìm thấy'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (url.pathname.startsWith('/api/')) await handleApi(req, res, url);
    else serveStatic(req, res, url);
  } catch (e) {
    const msg = String(e.message || e).split(API_KEY || '\u0000').join('<redacted>');
    if (!res.headersSent) send(res, 500, { error: 'Lỗi server: ' + msg });
  }
});

async function initModel() {
  if (!API_KEY) { modelInfo = { model: '', error: 'Thiếu GEMINI_API_KEY' }; return; }
  try {
    const r = await A.discoverModel(API_KEY, MODEL_OVERRIDE);
    modelInfo = { model: r.model, error: '' };
    console.log(`Model: ${r.model} (${r.source})`);
  } catch (e) {
    modelInfo = { model: '', error: String(e.message).split(API_KEY).join('<redacted>') };
    console.log('Không chọn được model: ' + modelInfo.error);
  }
}

server.listen(PORT, async () => {
  console.log(`Server: http://localhost:${PORT}  (key: ${API_KEY ? 'có' : 'THIẾU'})`);
  await initModel();
});
