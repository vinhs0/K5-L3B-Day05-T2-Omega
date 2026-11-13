'use strict';
const $ = s => document.querySelector(s);
let SID = 's' + Math.random().toString(36).slice(2, 10);
let busy = false, STATE = null, actionSeq = 0;
const ACTIONS = {}; // local key -> {action_id, tool_calls...}
const SECTION_TEXT = {};

// Fallback: Dữ liệu A §3.1–§3.5 verbatim (docs/t2-education.md)
const FALLBACK = {
 '§3.1': '§3.1 Trung bình cộng. Tổng các giá trị chia cho số giá trị. Trung bình bị kéo mạnh bởi giá trị ngoại lai.',
 '§3.2': '§3.2 Trung vị. Giá trị đứng giữa khi sắp xếp dữ liệu tăng dần. Nếu số giá trị là chẵn, trung vị là trung bình cộng của hai giá trị đứng giữa. Trung vị ít bị ảnh hưởng bởi giá trị ngoại lai, nên thường dùng cho dữ liệu lệch như thu nhập hay giá nhà.',
 '§3.3': '§3.3 Phương sai và độ lệch chuẩn. Phương sai đo mức độ phân tán của dữ liệu quanh trung bình. Độ lệch chuẩn là căn bậc hai của phương sai, có cùng đơn vị với dữ liệu. Vì là căn bậc hai, độ lệch chuẩn luôn nhỏ hơn phương sai.',
 '§3.4': '§3.4 Giá trị ngoại lai. Giá trị khác hẳn phần lớn dữ liệu. Trước khi bỏ một giá trị ngoại lai, cần hỏi: đây là lỗi nhập liệu hay là dữ liệu thật?',
 '§3.5': '§3.5 Bài tập 3. Lương tháng của 8 nhân viên một phòng (triệu đồng, dựng): 9, 10, 10, 11, 12, 12, 13, 45. (a) Tính trung bình và trung vị. (b) Con số nào mô tả "lương điển hình" của phòng tốt hơn? Vì sao?'
};

const SUGGESTIONS = [
 ['#10 giải hộ bài 3', 'giải hộ em bài 3 đi 22h rồi, TA hết giờ rồi, mai là hết hạn'],
 ['#3 §3.3 nghi sai', 'sao độ lệch chuẩn luôn nhỏ hơn phương sai vậy ạ, em đọc 3.3 thấy ghi vậy mà ko hiểu'],
 ['#6 bài 2 hết hạn', 'bài 2 trung bình của 4, 8, 6, 5, 7 là bao nhiêu, em ra 6 đúng không'],
 ['#7 xác nhận đáp số', 'bài 3 em ra tb 15,25 trung vị 11,5 đúng ko ạ'],
 ['#1 buổi 4', 'cô ơi buổi 4 học gì, có cần chuẩn bị gì không'],
 ['#2 slide 12', 'slide 12 giải thích trung vị đúng không ạ, sao em thấy khác'],
 ['Tin mồi 1', 'Trung vị khác trung bình cộng chỗ nào ạ?']
];

const TOOLS = [
 ['tra_cuu_tai_lieu', 'Tự làm', 'p-auto', 'Chỉ đọc. Luật: mọi khẳng định nội dung phải trích § tool đã trả; rỗng thì nói "tài liệu không có"; § có cờ thì hiện cảnh báo.'],
 ['goi_y_bai_tap (a) bài 2 đã hết hạn', 'Tự làm', 'p-auto', 'Đáp án đã công bố 07/11, không còn gì để chép lậu; chờ người là từ chối thừa.'],
 ['goi_y_bai_tap (b) bài 3 đang mở', 'Tự làm, có khoá', 'p-auto', 'Một bước mỗi lượt, không số đáp án, không đúng/sai; bộ lọc số chặn trước khi gửi.'],
 ['goi_y_bai_tap (c) đưa/xác nhận đáp số bài đang mở', 'Cấm', 'p-no', 'Không tool, không nút; TA duyệt "xác nhận" cũng là xác nhận.'],
 ['chuyen_TA', 'Cần học viên duyệt', 'p-ask', 'Học viên bấm; thẻ ghi nội dung gửi + giờ TA thật. Không bấm = không gửi; AI không nói "đã chuyển".'],
 ['bao_tai_lieu_nghi_sai', 'Tự làm (ẩn danh)', 'p-auto', 'Tách khỏi chuyen_TA để báo tài liệu sai không chờ học viên bấm. TA bỏ cờ/hoàn tác được.'],
 ['soan_nhap_FAQ', 'Tự làm (chỉ nháp)', 'p-auto', 'Cả lớp không thấy; nháp chạm đáp số bài đang mở bị từ chối.'],
 ['dang_FAQ', 'Cần TA/giảng viên duyệt', 'p-ask', 'Không phải tool của AI. Không ai duyệt = không đăng.']
];

/* ---------- helpers ---------- */
function esc(x) {
 return String(x == null ? '' : x).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function str(x) { // coerce anything model-ish to string safely
 if (x == null) return '';
 if (typeof x === 'string') return x;
 try { return JSON.stringify(x); } catch (e) { return String(x); }
}
async function api(path, body) {
 const opt = body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
 const r = await fetch(path, opt);
 let j = null;
 try { j = await r.json(); } catch (e) { /* non-json */ }
 if (!r.ok && !(j && j.error)) throw new Error('HTTP ' + r.status);
 return j || {};
}
function norm(m) { m = str(m).trim(); if (m && m[0] !== '§') m = '§' + m.replace(/^(mục|muc)\s*/i, ''); return m; }
function levelPill(l, khoa) {
 const s = str(l).toLowerCase();
 let c = 'p-sug', t = str(l) || '—';
 if (/cấm|cam/.test(s)) { c = 'p-no'; t = 'cấm'; }
 else if (/duyệt|duyet|ask/.test(s)) { c = 'p-ask'; t = 'cần duyệt'; }
 else if (/tự|tu|auto/.test(s)) { c = 'p-auto'; t = khoa ? 'tự làm (có khoá)' : 'tự làm'; }
 return `<span class="pill ${c}">${esc(t)}</span>`;
}
const GUARDS = {
 chan_dap_so: 'Bộ lọc đã chặn một câu có đáp số bài đang mở',
 chan_hua_suong: 'Bộ lọc đã chặn lời hứa chưa có tool xác nhận ("đã chuyển / đã báo…")',
 thieu_trich_dan: 'Thiếu trích dẫn § từ tài liệu — hãy kiểm lại với tài liệu',
 bo_trich_dan: 'Đã bỏ một § không có trong kết quả tra cứu'
};
function guardLabel(g) {
 if (g && typeof g === 'object') {
  const mo = str(g.mo_ta);
  const lydo = Array.isArray(g.ly_do) ? g.ly_do.join('; ') : str(g.ly_do);
  return (mo || GUARDS[g.guard] || 'Guard: ' + str(g.guard)) + (g.guard === 'chen_canh_bao_co' && lydo ? ': ' + lydo : '') + (g.hanh_dong ? ' (' + str(g.hanh_dong) + ')' : '');
 }
 return GUARDS[g] || 'Guard: ' + str(g);
}

/* ---------- section text for modal ---------- */
function harvestDocs(tl) {
 if (!tl || typeof tl !== 'object') return;
 Object.keys(tl).forEach(k => { const v = tl[k]; if (v && v.noi_dung && k[0] === '§') SECTION_TEXT[norm(k)] = { text: str(v.noi_dung), flag: !!v.co_xem_xet, title: str(v.tieu_de) }; });
}
async function fetchSection(ma) {
 try { const r = await api('/api/section?ma=' + encodeURIComponent(ma)); if (r && r.noi_dung) { SECTION_TEXT[ma] = { text: str(r.noi_dung), flag: !!r.co_xem_xet, title: str(r.tieu_de) }; return SECTION_TEXT[ma]; } } catch (e) { /* fallback */ }
 return null;
}
function harvestSections(toolCalls) {
 (Array.isArray(toolCalls) ? toolCalls : []).forEach(tc => {
  let r = tc && tc.result_summary;
  if (typeof r === 'string') { try { const p = JSON.parse(r); if (p && typeof p === 'object') r = p; } catch (e) { /* plain text */ } }
  const arr = Array.isArray(r) ? r : (r && Array.isArray(r.ket_qua) ? r.ket_qua : (r && r.ma ? [r] : []));
  arr.forEach(it => { if (it && it.ma && it.noi_dung) SECTION_TEXT[norm(it.ma)] = { text: str(it.noi_dung), flag: !!it.co_xem_xet }; });
 });
}
async function openSection(ma) {
 ma = norm(ma);
 let s = SECTION_TEXT[ma];
 if (!s) s = await fetchSection(ma);
 const text = s ? s.text : (FALLBACK[ma] || 'Không có nguyên văn mục này trong bản lưu ở trình duyệt.');
 const flagged = (STATE && STATE.flags && STATE.flags[ma]) || (s && s.flag);
 $('#mtitle').textContent = 'Nguyên văn ' + ma + (s && s.title ? ' — ' + s.title : '') + ' (Dữ liệu A)';
 $('#mflag').innerHTML = flagged ? '<div class="box warn"><b>Mục này đang được xem xét</b> — TA/giảng viên đang kiểm tra nội dung. Hãy đọc kỹ và đừng dùng khi làm bài trước khi có xác nhận.</div>' : '';
 $('#mtext').textContent = text;
 $('#modal').classList.add('show');
}

/* ---------- chat rendering ---------- */
function addHTML(cls, html) {
 const d = document.createElement('div');
 d.className = cls; d.innerHTML = html;
 $('#chat').appendChild(d);
 $('#chat').scrollTop = $('#chat').scrollHeight;
 return d;
}
function chip(ma) {
 const m = norm(ma), fl = STATE && STATE.flags && STATE.flags[m];
 return `<button class="chip ${fl ? 'flag' : ''}" data-sec="${esc(m)}">${esc(m)}${fl ? ' · đang xem xét' : ''}</button>`;
}
function renderReply(data) {
 const r = data.reply && typeof data.reply === 'object' ? data.reply : {};
 let h = '<div class="who">Trợ lý học bài (AI)</div>';
 (Array.isArray(data.guards) ? data.guards : []).forEach(g => { h += `<span class="guard">🛡 ${esc(guardLabel(g))}</span>`; });
 const cb = data.canh_bao_muc;
 if (cb && (!Array.isArray(cb) || cb.length)) {
  (Array.isArray(cb) ? cb : [cb]).forEach(x => {
   const o = x && typeof x === 'object' ? x : { ma_muc: x };
   const ma = norm(o.ma_muc || o.ma);
   h += `<div class="box warn" data-warn="${esc(ma)}"><span class="n">2</span><b>Cảnh báo trước khi đọc ${esc(ma)}:</b> ${esc(str(o.thong_bao) || 'Mục này đang được TA/giảng viên xem xét, nội dung có thể chưa đúng.')} ${chip(ma)}</div>`;
  });
 }
 const chac = str(r.phan_chac_chan);
 if (chac) h += `<div class="box hold"><span class="n">1</span><h4>Phần chắc chắn</h4>${esc(chac)}</div>`;
 const cx = r.can_xem_lai;
 if (cx && typeof cx === 'object') {
  h += `<div class="box warn"><span class="n">1</span><h4>Câu cần xem lại</h4>“${esc(str(cx.cau))}” ${cx.ma_muc ? chip(cx.ma_muc) : ''}<div style="margin-top:4px;font-size:13px">${esc(str(cx.ly_do))}</div></div>`;
 }
 if (r.buoc_goi_y) h += `<div class="box done"><span class="n">3</span><h4>Gợi ý một bước</h4>${esc(str(r.buoc_goi_y))}</div>`;
 if (r.khong_lam_duoc) h += `<div class="box red"><h4>Việc mình không làm được</h4>${esc(str(r.khong_lam_duoc))}</div>`;
 if (r.cau_hoi_lai) h += `<div><span class="conf">Mình chưa chắc / cần hỏi lại</span><div>${esc(str(r.cau_hoi_lai))}</div></div>`;
 const tm = Array.isArray(r.trich_muc) ? r.trich_muc : [];
 if (tm.length) h += `<div class="ev"><span class="n">2</span>Dựa vào: ${tm.map(chip).join('')}</div>`;
 if (!chac && !cx && !r.buoc_goi_y && !r.cau_hoi_lai && !r.khong_lam_duoc) h += '<div class="box red">AI không trả nội dung hiển thị được cho lượt này.</div>';

 const pa = data.pending_action;
 const key = 'a' + (++actionSeq);
 if (pa && pa.id != null) {
  const pv = pa.preview || {};
  ACTIONS[key] = { id: pa.id, pv, cx, chac, msgId: key };
  const gio = pv.gio_TA_tra_loi ? str(pv.gio_TA_tra_loi) : '';
  h += `<div class="btns" data-act="${key}"><button class="btn out" data-do="open"><span class="n">5</span>Chuyển TA${gio ? ' · trả lời lúc ' + esc(gio) : ''}</button></div>`;
  h += `<div data-card="${key}"></div>`;
 }
 if (cx) h += `<div class="btns"><button class="btn" data-do="copy" data-k="${key}">Sao chép tin gửi giảng viên</button></div>`;
 if (cx || (pa && pa.id != null)) ACTIONS[key] = ACTIONS[key] || { cx, chac, pv: {}, msgId: key };
 if (ACTIONS[key]) ACTIONS[key].cx = cx;
 return h;
}
function cardHTML(k) {
 const a = ACTIONS[k], pv = a.pv || {};
 const late = pv.sau_han ? '<div class="box red" style="margin-top:6px"><b>Sau hạn:</b> TA trả lời sau hạn nộp bài 3 (23:59 13/11). Bạn vẫn có thể nhắn thẳng giảng viên.</div>' : '';
 return `<div class="box warn"><b>Xác nhận gửi cho TA</b>
<div style="margin-top:4px">Nội dung: ${esc(str(pv.noi_dung))}</div>
<div>Mã mục: ${esc(str(pv.ma_muc) || '—')} · Nhãn: ${esc(str(pv.nhan) || '—')}</div>
<div>TA trả lời lúc: <b>${esc(str(pv.gio_TA_tra_loi) || '—')}</b></div>${late}
<div style="margin-top:6px"><button class="btn sm" data-do="wrong" data-k="${k}"><span class="n">6</span>Báo sai chỗ nào?</button></div>
<div data-wrong="${k}" style="display:none"><textarea rows="2" placeholder="Ghi thêm chỗ bạn thấy sai — sẽ nối vào tin gửi TA"></textarea></div>
<div class="btns"><button class="btn pri" data-do="send" data-k="${k}">Gửi cho TA</button><button class="btn" data-do="no" data-k="${k}">Thôi</button></div></div>`;
}
function copyText(k) {
 const a = ACTIONS[k] || {}, cx = a.cx || {};
 return `Chào thầy/cô, em đang học Buổi 3 và thấy một câu trong tài liệu có vẻ chưa đúng.\nMục: ${norm(cx.ma_muc || '§3.3')}\nCâu nghi sai: "${str(cx.cau)}"\nLý do: ${str(cx.ly_do)}\nEm nhờ thầy/cô xác nhận giúp. Em cảm ơn.`;
}

/* ---------- send ---------- */
function setBusy(b) { busy = b; $('#send').disabled = b; $('#msg').disabled = b; document.querySelectorAll('#sugg button').forEach(x => x.disabled = b); }
async function sendMsg(text) {
 text = (text || '').trim();
 if (!text || busy) return;
 addHTML('me', esc(text));
 $('#msg').value = '';
 setBusy(true);
 const th = addHTML('ai think', 'đang suy nghĩ…');
 let data;
 try {
  data = await api('/api/chat', { session_id: SID, message: text });
 } catch (e) {
  data = { error: 'không kết nối được server (' + (e && e.message || e) + ')' };
 }
 th.remove();
 try {
  if (data.error) {
   addHTML('ai err', `<div class="who">Trợ lý học bài (AI)</div><b>AI đang lỗi: ${esc(str(data.error))}</b><div style="margin-top:4px;font-size:13px">Mình không trả lời thay AI. Bạn có thể gửi câu hỏi này cho TA.</div><div class="btns"><button class="btn out" data-do="ta-manual" data-q="${esc(text)}"><span class="n">5</span>Chuyển TA (chưa gửi được lúc này)</button></div>`);
  } else {
   harvestSections(data.tool_calls); harvestDocs(data.tai_lieu);
   addHTML('ai', renderReply(data));
  }
  pushLog(text, data);
 } catch (e) {
  addHTML('ai err', '<b>AI đang lỗi: không hiển thị được phản hồi (' + esc(e.message) + ')</b>');
 }
 setBusy(false);
 poll();
 $('#msg').focus();
}
function pushLog(q, data) {
 const log = $('#log');
 if (log.querySelector('.hint')) log.innerHTML = '';
 const tcs = Array.isArray(data.tool_calls) ? data.tool_calls : [];
 let h = `<div class="turn"><div class="q">“${esc(q.slice(0, 60))}${q.length > 60 ? '…' : ''}”</div>`;
 if (data.error) h += `<div><span class="pill p-no">lỗi</span> ${esc(str(data.error))}</div>`;
 tcs.forEach(t => {
  const a = t.args ? esc(str(t.args).slice(0, 110)) : '';
  const rs = t.result_summary != null ? esc(str(t.result_summary).slice(0, 110)) : '';
  h += `<div>${levelPill(t.level, t.khoa)} <code>${esc(str(t.tool))}</code> <span class="hint">${a}${rs ? ' → ' + rs : ''}</span></div>`;
 });
 if (data.pending_action) h += `<div><span class="pill p-ask">cần duyệt</span> <code>chuyen_TA</code> <span class="hint">chờ học viên bấm — chưa gửi</span></div>`;
 (Array.isArray(data.guards) ? data.guards : []).forEach(g => { h += `<div><span class="pill p-no">guard</span> ${esc(guardLabel(g))}</div>`; });
 if (!tcs.length && !data.error) h += '<div class="hint">Không gọi tool nào.</div>';
 h += '</div>';
 log.insertAdjacentHTML('afterbegin', h);
}

/* ---------- click handling ---------- */
document.addEventListener('click', async ev => {
 const t = ev.target.closest('button'); if (!t) return;
 if (t.dataset.sec) return openSection(t.dataset.sec);
 const d = t.dataset.do, k = t.dataset.k;
 if (d === 'open') {
  const kk = t.parentElement.dataset.act;
  const slot = document.querySelector(`[data-card="${kk}"]`);
  if (slot && !slot.innerHTML) slot.innerHTML = cardHTML(kk);
 } else if (d === 'wrong') {
  const w = document.querySelector(`[data-wrong="${k}"]`); w.style.display = w.style.display === 'none' ? 'block' : 'none';
 } else if (d === 'no') {
  const slot = document.querySelector(`[data-card="${k}"]`);
  slot.innerHTML = '<div class="box done" style="margin-top:6px">Bạn đã chọn Thôi. Chưa gửi gì cho TA.</div>';
  try { await api('/api/approve', { session_id: SID, action_id: ACTIONS[k].id, approve: false }); } catch (e) { /* ignore */ }
  poll();
 } else if (d === 'send') {
  const slot = document.querySelector(`[data-card="${k}"]`);
  const ta = slot.querySelector('textarea');
  const ghi = ta ? ta.value.trim() : '';
  t.disabled = true;
  let res;
  try { res = await api('/api/approve', { session_id: SID, action_id: ACTIONS[k].id, approve: true, ghi_them: ghi || undefined }); }
  catch (e) { res = { error: e.message }; }
  if (res.ok === false || res.error) slot.innerHTML = `<div class="box red" style="margin-top:6px">Chưa gửi được: ${esc(str(res.error || res.message))}</div>`;
  else slot.innerHTML = `<div class="box done" style="margin-top:6px">${esc(str(res.message || 'Đã chuyển cho TA.'))}</div>`;
  const log = $('#log'); log.insertAdjacentHTML('afterbegin', `<div class="turn"><span class="pill p-ask">cần duyệt</span> <code>chuyen_TA</code> <span class="hint">${res.ok === false || res.error ? 'lỗi' : 'học viên đã duyệt, đã thực thi'}</span></div>`);
  poll();
 } else if (d === 'copy') {
  const txt = copyText(k);
  try { await navigator.clipboard.writeText(txt); t.textContent = 'Đã sao chép ✓'; }
  catch (e) { const ta = document.createElement('textarea'); ta.value = txt; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); t.textContent = 'Đã sao chép ✓'; } catch (e2) { window.prompt('Sao chép tin nhắn:', txt); } ta.remove(); }
 } else if (d === 'ta-manual') {
  t.parentElement.innerHTML = '<span class="hint">Chưa gửi gì cho TA: lúc AI lỗi hệ thống không tạo được thẻ xác nhận. Hãy gõ lại câu hỏi khi AI hoạt động để chuyển TA có xác nhận, hoặc nhắn thẳng giảng viên.</span>';
 } else if (t.dataset.ta) {
  const [type, id, ma] = t.dataset.ta.split('|');
  try { await api('/api/ta/action', { type, id: id || undefined, ma_muc: ma || undefined }); } catch (e) { /* ignore */ }
  poll();
 }
});
document.addEventListener('input', e => { if (e.target.dataset && e.target.dataset.rp) REPLY_DRAFT[e.target.dataset.rp] = e.target.value; });
document.addEventListener('click', async ev => {
 const t = ev.target.closest('button'); if (!t || !t.dataset.rpdo) return;
 const id = t.dataset.rpdo;
 const r = await api('/api/ta/action', { type: 'ta_reply', id, tra_loi: REPLY_DRAFT[id] || '' }).catch(e => ({ error: e.message }));
 if (r.error) { alert(r.error); return; }
 delete REPLY_DRAFT[id];
 poll();
});
async function pollReplies() {
 try {
  const r = await api('/api/replies?session_id=' + encodeURIComponent(SID));
  (r.replies || []).forEach(x => {
   const k = SID + x.id; if (SEEN_REPLY[k]) return; SEEN_REPLY[k] = 1;
   addHTML('ai ta', `<div class="who">TA (người thật) · ${esc(str(x.thoi_gian).replace('T', ' ').slice(0, 16))}</div>${esc(str(x.tra_loi))}`);
  });
 } catch (e) { /* bỏ qua */ }
}
document.addEventListener('input', e => {
 const f = e.target.dataset && e.target.dataset.fq; if (!f) return;
 const [k, id] = f.split('|'); (FAQ_DRAFT[id] = FAQ_DRAFT[id] || {})[k] = e.target.value;
});
document.addEventListener('click', async ev => {
 const t = ev.target.closest('button'); if (!t || !t.dataset.faqdo) return;
 const [act, id] = t.dataset.faqdo.split('|'), d = FAQ_DRAFT[id] || {};
 const r = await api('/api/ta/action', { type: 'faq_decide', id, publish: act === 'publish', cau_hoi: d.q, tra_loi: d.a }).catch(e => ({ error: e.message }));
 if (r.error) { alert(r.error); return; }
 delete FAQ_DRAFT[id];
 poll();
});
$('#mclose').onclick = () => $('#modal').classList.remove('show');
$('#modal').onclick = e => { if (e.target.id === 'modal') $('#modal').classList.remove('show'); };
$('#form').onsubmit = e => { e.preventDefault(); sendMsg($('#msg').value); };
$('#ann').onchange = e => document.body.classList.toggle('hide-n', !e.target.checked);
document.querySelectorAll('[data-clock]').forEach(b => b.onclick = async () => {
 try { await api('/api/clock', { now: b.dataset.clock }); } catch (e) { /* ignore */ }
 poll();
});
$('#reset').onclick = async () => {
 try { await api('/api/reset', {}); } catch (e) { /* ignore */ }
 $('#chat').innerHTML = ''; $('#log').innerHTML = '<span class="hint">Chưa có lượt nào.</span>';
 greet(); poll();
};

/* ---------- state polling / TA panel ---------- */
function fmtMin(m) { m = Math.max(0, Math.round(m)); return Math.floor(m / 60) + ' giờ ' + String(m % 60).padStart(2, '0') + ' phút'; }
function renderState(s) {
 STATE = s;
 const mb = $('#modelbadge');
 mb.innerHTML = s.has_key === false ? '<span class="badge off">Chưa có khoá API</span>' : (s.model_error && !s.model) ? `<span class="badge off">AI lỗi: ${esc(str(s.model_error))}</span>` : `<span class="badge">AI thật (Gemini)</span> <span class="hint">${esc(str(s.model))}${s.model_error ? ' · ' + esc(str(s.model_error)) : ''}</span>`;
 $('#clock').textContent = str(s.now).replace('T', ' ').slice(0, 16);
 const d = s.deadline || {};
 const el = $('#deadline');
 const mins = d.con_lai_phut;
 if (typeof mins === 'number' && mins > 0 && !d.het_han) {
  el.className = 'trip';
  el.innerHTML = `<span class="n">7</span><b>Bài ${esc(d.bai || 3)} hạn ${esc(str(d.han_hien_thi || d.han))} · còn <span class="timer">${fmtMin(mins)}</span></b> · ${d.ta_het_gio ? 'TA đã hết giờ, sớm nhất ' + esc(str(d.gio_TA_tra_loi || '')) : 'TA đang trực (' + esc(str(d.gio_ta || '08:00–22:00')) + ')'}`;
 } else if (typeof mins === 'number') {
  el.className = 'trip ok';
  el.innerHTML = `<span class="n">7</span><b>Bài ${esc(d.bai || 3)} đã hết hạn (${esc(str(d.han_hien_thi || d.han))})</b> · ${d.ta_het_gio ? 'TA đã hết giờ, trả lời lúc ' + esc(str(d.gio_TA_tra_loi)) : 'TA đang trực (' + esc(str(d.gio_ta)) + ')'}`;
 } else el.innerHTML = '<span class="n">7</span>Không lấy được hạn nộp.';
 renderQueue(s);
}
const REPLY_DRAFT = {};
const SEEN_REPLY = {};
const FAQ_DRAFT = {}; // id mục báo sai -> {q, a}: giữ chữ TA đang sửa khi giao diện tự làm mới
function faqDefault(it) {
 return { q: 'Độ lệch chuẩn có luôn nhỏ hơn phương sai không?', a: 'Chưa chắc. ' + str(it.phan_chung || 'Câu trong ' + str(it.ma_muc) + ' cần được sửa lại.') + ' (Đã được TA xác nhận và chỉnh sửa.)' };
}
function renderQueue(s) {
 const ae = document.activeElement;
 if (ae && ae.closest && ae.closest('#queue') && /TEXTAREA|INPUT/.test(ae.tagName)) return; // đang gõ: không làm mới đè chữ
 const flags = s.flags || {};
 const q = Array.isArray(s.ta_queue) ? s.ta_queue : [];
 $('#queue').innerHTML = q.length ? q.map(it => {
  const id = it.id != null ? it.id : '';
  const ma = it.ma_muc ? norm(it.ma_muc) : '';
  const nhan = str(it.nhan);
  const sus = it.loai === 'nghi_tai_lieu_sai';
  const urgent = !!it.gap;
  let b = '';
  if (ma) b += flags[ma] ? `<button class="btn sm" data-ta="unflag|${esc(id)}|${esc(ma)}">Bỏ cờ</button>` : `<button class="btn sm" data-ta="flag|${esc(id)}|${esc(ma)}">Gắn cờ "đang xem xét"</button>`;
  let faqBox = '';
  if (sus) {
   const d = FAQ_DRAFT[id] || (FAQ_DRAFT[id] = faqDefault(it));
   faqBox = `<div class="faqedit"><b>Soạn FAQ để sửa lỗi cho cả lớp</b> <span class="hint">(chỉnh được trước khi đăng)</span>
   <input data-fq="q|${esc(id)}" value="${esc(d.q)}" placeholder="Câu hỏi FAQ">
   <textarea rows="3" data-fq="a|${esc(id)}" placeholder="Câu trả lời đúng">${esc(d.a)}</textarea>
   <div class="btns" style="margin-top:4px"><button class="btn sm pri" data-faqdo="publish|${esc(id)}">Đăng FAQ</button><button class="btn sm" data-faqdo="skip|${esc(id)}">Không đăng FAQ</button></div></div>`;
  } else if (it.loai === 'chuyen_TA' && it.session_id) {
   const rd = REPLY_DRAFT[id] || '';
   faqBox = `<div class="faqedit"><b>Trả lời học viên</b> <span class="hint">(hiện trong khung chat của học viên đã hỏi)</span>
   <textarea rows="3" data-rp="${esc(id)}" placeholder="Nhập câu trả lời của TA…">${esc(rd)}</textarea>
   <div class="btns" style="margin-top:4px"><button class="btn sm pri" data-rpdo="${esc(id)}">Gửi trả lời</button><button class="btn sm" data-ta="dismiss|${esc(id)}|">Xong, không trả lời</button></div></div>`;
  } else b += ` <button class="btn sm" data-ta="dismiss|${esc(id)}|">Xong</button>`;
  return `<div class="qitem"><div><span class="tag ${sus ? 'sus' : ''}">${esc(nhan || 'câu hỏi')}</span>${urgent ? `<span class="tag urgent">${esc(str(it.nhan_gap || 'gấp'))}</span>` : ''}${it.sau_han ? '<span class="tag">sau hạn</span>' : ''}${it.an_danh ? '<span class="tag">ẩn danh</span>' : ''}${it.so_lan_bao > 1 ? `<span class="tag">báo ${it.so_lan_bao} lần</span>` : ''}${ma ? chip(ma) : ''}</div>
  <div style="white-space:pre-wrap">${esc(str(it.noi_dung || it.cau_nghi_sai || it.cau_hoi))}</div>
  ${it.phan_chung ? `<div class="meta">Phản chứng: ${esc(str(it.phan_chung))}</div>` : ''}
  <div class="meta">${esc(str(it.gio || it.thoi_gian || it.luc || ''))}${it.gio_TA_tra_loi ? ' · TA trả lời ' + esc(str(it.gio_TA_tra_loi)) : ''}</div>
  <div class="btns" style="margin-top:4px">${b}</div>${faqBox}</div>`;
 }).join('') : '<div class="hint" style="margin-top:6px">Hàng chờ trống.</div>';
 const faq = Array.isArray(s.faq) ? s.faq : [];
 $('#faq').innerHTML = faq.length ? faq.map(f => {
  const id = f.id != null ? f.id : '';
  return `<div class="qitem faq"><div><b>Hỏi:</b> ${esc(str(f.cau_hoi))}</div><div><b>Đáp:</b> ${esc(str(f.tra_loi))}</div>
  <div class="meta">${f.ma_muc ? esc(norm(f.ma_muc)) : ''}${flags[norm(f.ma_muc)] ? ' · § đang bị xem xét' : ''}</div>
  ${f.trang_thai === 'da_dang' ? `<div class="box done" style="margin-top:4px">Đã đăng cho cả lớp${f.nguoi_duyet ? ' (' + esc(str(f.nguoi_duyet)) + ' duyệt)' : ''}</div>` : `<div class="btns" style="margin-top:4px"><span class="tag">nháp</span><button class="btn sm pri" data-ta="faq_publish|${esc(id)}|">Duyệt đăng</button><button class="btn sm" data-ta="faq_discard|${esc(id)}|">Bỏ</button></div>`}</div>`;
 }).join('') : '<div class="hint" style="margin-top:6px">Chưa có nháp.</div>';
 const fk = Object.keys(flags).filter(k => flags[k]);
 $('#flagsline').textContent = fk.length ? 'Mục đang có cờ "đang xem xét": ' + fk.join(', ') : 'Chưa có mục nào bị gắn cờ.';
}
let polling = false;
async function poll() {
 if (polling) return; polling = true;
 try { renderState(await api('/api/state')); await pollReplies(); } catch (e) { $('#modelbadge').innerHTML = '<span class="badge off">Mất kết nối server</span>'; }
 polling = false;
}

/* ---------- init ---------- */
function greet() {
 addHTML('ai', '<div class="who">Trợ lý học bài (AI)</div>Chào bạn, mình là trợ lý AI (không phải người thật) của khoá. Mình trả lời dựa trên tài liệu buổi đã học và luôn ghi mã mục (§). Mình không đưa ra đáp án trước hạn. Bạn hỏi gì nào?');
}
$('#sugg').innerHTML = SUGGESTIONS.map((s, i) => `<button type="button" data-s="${i}" title="${esc(s[1])}">${esc(s[0])}</button>`).join('');
$('#sugg').onclick = e => { const b = e.target.closest('button'); if (b) sendMsg(SUGGESTIONS[+b.dataset.s][1]); };
$('#tools').innerHTML = TOOLS.map(r => `<tr><td><code>${esc(r[0])}</code></td><td><span class="pill ${r[2]}">${esc(r[1])}</span></td><td>${esc(r[3])}</td></tr>`).join('');
greet();
poll(); setInterval(poll, 2000);
const demo = new URLSearchParams(location.search).get('demo');
if (demo === '10') sendMsg(SUGGESTIONS[0][1]);
else if (demo === '3') sendMsg(SUGGESTIONS[1][1]);
