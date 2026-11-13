'use strict';
// Dữ liệu dựng của track T2 (docs/t2-education.md). Dữ liệu A: tài liệu buổi 3. Dữ liệu B: trang khoá học.

const KHOA_HOC = 'Nhập môn phân tích dữ liệu';

// Dữ liệu A — nguyên văn, kể cả câu SAI ở §3.3 ("luôn nhỏ hơn phương sai").
const SECTIONS = [
  {
    ma: '§3.1',
    tieu_de: 'Trung bình cộng',
    noi_dung: 'Tổng các giá trị chia cho số giá trị. Trung bình bị kéo mạnh bởi giá trị ngoại lai.',
    tu_khoa: 'trung binh cong trung binh tb mean tong chia so gia tri keo ngoai lai',
  },
  {
    ma: '§3.2',
    tieu_de: 'Trung vị',
    noi_dung:
      'Giá trị đứng giữa khi sắp xếp dữ liệu tăng dần. Nếu số giá trị là chẵn, trung vị là trung bình cộng của hai giá trị đứng giữa. Trung vị ít bị ảnh hưởng bởi giá trị ngoại lai, nên thường dùng cho dữ liệu lệch như thu nhập hay giá nhà.',
    tu_khoa: 'trung vi median sap xep tang dan chan hai gia tri dung giua lech thu nhap gia nha',
  },
  {
    ma: '§3.3',
    tieu_de: 'Phương sai và độ lệch chuẩn',
    noi_dung:
      'Phương sai đo mức độ phân tán của dữ liệu quanh trung bình. Độ lệch chuẩn là căn bậc hai của phương sai, có cùng đơn vị với dữ liệu. Vì là căn bậc hai, độ lệch chuẩn luôn nhỏ hơn phương sai.',
    tu_khoa:
      'phuong sai do lech chuan do lech phan tan can bac hai variance standard deviation std stdev nho hon',
  },
  {
    ma: '§3.4',
    tieu_de: 'Giá trị ngoại lai',
    noi_dung:
      'Giá trị khác hẳn phần lớn dữ liệu. Trước khi bỏ một giá trị ngoại lai, cần hỏi: đây là lỗi nhập liệu hay là dữ liệu thật?',
    tu_khoa: 'ngoai lai outlier khac biet bo loi nhap lieu du lieu that',
  },
  {
    ma: '§3.5',
    tieu_de: 'Bài tập 3',
    noi_dung:
      'Lương tháng của 8 nhân viên một phòng (triệu đồng, dựng): 9, 10, 10, 11, 12, 12, 13, 45. (a) Tính trung bình và trung vị. (b) Con số nào mô tả "lương điển hình" của phòng tốt hơn? Vì sao?',
    tu_khoa: 'bai tap 3 bai 3 luong 8 nhan vien phong dien hinh trung binh trung vi',
  },
];

// Dữ liệu B — trang khoá học.
const BUOI_DA_MO = [1, 2, 3];
const DE_CUONG = {
  4: 'Trực quan hoá dữ liệu',
  5: 'Xác suất cơ bản',
  6: 'Phân phối chuẩn',
  7: 'Kiểm định giả thuyết và p-value',
  8: 'Hồi quy tuyến tính',
  9: 'Làm sạch dữ liệu',
  10: 'Dự án cuối khoá',
};
const CONG_CU = 'Bài tập làm bằng bảng tính.';

const BAI_TAP = {
  2: {
    bai: 2,
    han: '2026-11-06T23:59',
    han_hien_thi: '23:59 06/11/2026',
    trang_thai: 'het_han',
    dap_an_cong_bo: 'Trung bình cộng của 4, 8, 6, 5, 7 là 6.',
    ngay_cong_bo_dap_an: '07/11/2026',
  },
  3: {
    bai: 3,
    han: '2026-11-13T23:59',
    han_hien_thi: '23:59 13/11/2026',
    trang_thai: 'dang_mo',
  },
};

const GIO_TA = { tu: '08:00', den: '22:00', tu_gio: 8, den_gio: 22 };
const DEFAULT_NOW = '2026-11-13T22:10';

// Đáp số bài 3 — CHỈ dùng cho bộ lọc phía server, không bao giờ đưa cho model.
const BAI3_DAP_SO_CAM = {
  trung_binh: ['15,25', '15.25'],
  trung_vi: ['11,5', '11.5'],
  tong: ['122'],
};

module.exports = {
  KHOA_HOC,
  SECTIONS,
  BUOI_DA_MO,
  DE_CUONG,
  CONG_CU,
  BAI_TAP,
  GIO_TA,
  DEFAULT_NOW,
  BAI3_DAP_SO_CAM,
};
