
import React, { useState, useEffect, useMemo } from 'react';
import XLSX from 'xlsx-js-style'; // Sử dụng thư viện hỗ trợ Style
import { RecordFile } from '../types';
import { X, FileDown, Calendar, Layers, MapPin } from 'lucide-react';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  records: RecordFile[];
  wards: string[]; 
}

const ExportModal: React.FC<ExportModalProps> = ({ isOpen, onClose, records, wards }) => {
  const [selectedBatchKey, setSelectedBatchKey] = useState<string>('');
  const [selectedWard, setSelectedWard] = useState<string>('all');

  // 1. Tổng hợp danh sách các đợt đã xuất từ dữ liệu hồ sơ
  const batchOptions = useMemo(() => {
    const batches: Record<string, { date: string, batch: number, count: number }> = {};

    records.forEach(r => {
      // Chỉ lấy các hồ sơ đã có thông tin đợt xuất
      if (r.exportBatch && r.exportDate) {
        const dateStr = r.exportDate.split('T')[0]; // YYYY-MM-DD
        const key = `${dateStr}_${r.exportBatch}`;

        if (!batches[key]) {
          batches[key] = {
            date: dateStr,
            batch: r.exportBatch,
            count: 0
          };
        }
        batches[key].count++;
      }
    });

    // Chuyển object thành mảng và sắp xếp giảm dần theo ngày & đợt
    return Object.values(batches).sort((a, b) => {
        if (a.date !== b.date) return b.date.localeCompare(a.date);
        return b.batch - a.batch;
    });
  }, [records, isOpen]);

  // Tự động chọn đợt mới nhất khi mở modal
  useEffect(() => {
    if (isOpen && batchOptions.length > 0) {
        const latest = batchOptions[0];
        setSelectedBatchKey(`${latest.date}_${latest.batch}`);
    }
    // Reset ward filter
    if (isOpen) setSelectedWard('all');
  }, [isOpen, batchOptions]);

  const handleExport = () => {
    if (!selectedBatchKey) return;

    const [dateStr, batchStr] = selectedBatchKey.split('_');
    const batchNum = parseInt(batchStr);

    // 2. Lọc danh sách hồ sơ theo đợt đã chọn VÀ theo xã/phường
    const recordsToExport = records.filter(r => {
        const matchBatch = r.exportDate?.startsWith(dateStr) && r.exportBatch === batchNum;
        const matchWard = selectedWard === 'all' || r.ward === selectedWard;
        return matchBatch && matchWard;
    });

    if (recordsToExport.length === 0) {
        alert("Không tìm thấy hồ sơ nào cho đợt và xã này.");
        return;
    }

    const exportDateParts = dateStr.split('-'); // YYYY-MM-DD
    const displayDate = `Ngày ${exportDateParts[2]} tháng ${exportDateParts[1]} năm ${exportDateParts[0]}`;

    // 3. Chuẩn bị dữ liệu cho Excel
    // Header dòng tiêu đề bảng
    const tableHeader = [
        "STT", "Mã Hồ Sơ", "Chủ Sử Dụng", "Địa Chỉ (Xã)", 
        "Thửa", "Tờ", "Loại Hồ Sơ", "Số TĐ", "Số TL", 
        "Hẹn Trả", "Ghi Chú"
    ];

    // Dữ liệu chi tiết
    const dataRows = recordsToExport.map((r, index) => [
        index + 1,
        r.code || '',
        r.customerName || '',
        r.ward || '',
        r.landPlot || '',
        r.mapSheet || '',
        r.recordType || '',
        r.measurementNumber || '',
        r.excerptNumber || '',
        r.deadline ? new Date(r.deadline).toLocaleDateString('vi-VN') : '',
        r.notes || ''
    ]);

    // Tạo Workbook mới
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([]); 

    // --- CẤU TRÚC SHEET ---
    // Dòng 1, 2: Quốc hiệu
    // Dòng 4, 5, 6: Tiêu đề báo cáo
    // Dòng 8: Header bảng (Bắt đầu kẻ bảng từ đây)
    // Dòng 9 -> N: Dữ liệu
    // Footer: Chữ ký

    XLSX.utils.sheet_add_aoa(ws, [
        ["CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM"], // A1
        ["Độc lập - Tự do - Hạnh phúc"],         // A2
        [""],                                    // A3
        ["DANH SÁCH BÀN GIAO HỒ SƠ 1 CỬA"],      // A4
        [displayDate.toUpperCase()],             // A5
        [`ĐỢT: ${batchNum}  -  TỔNG SỐ HỒ SƠ: ${recordsToExport.length}`], // A6
        [""],                                    // A7
        tableHeader                              // A8 (Header bảng)
    ], { origin: "A1" });

    // Thêm dữ liệu bảng từ A9
    XLSX.utils.sheet_add_aoa(ws, dataRows, { origin: "A9" });

    // Tính toán vị trí dòng cuối cùng của bảng
    const lastDataRow = 8 + dataRows.length; // 8 dòng đầu + số dòng dữ liệu (Index bắt đầu từ 0 nên dòng cuối là row index này)
    const footerStartRow = lastDataRow + 3;  // Cách bảng 3 dòng

    // Thêm phần ký tên
    XLSX.utils.sheet_add_aoa(ws, [
        ["BÊN GIAO HỒ SƠ", "", "", "", "", "", "", "BÊN NHẬN HỒ SƠ"],
        ["(Ký và ghi rõ họ tên)", "", "", "", "", "", "", "(Ký và ghi rõ họ tên)"]
    ], { origin: `A${footerStartRow + 1}` }); // +1 vì index chạy từ 0

    // --- ĐỊNH DẠNG CỘT (Độ rộng) ---
    const wscols = [
        { wch: 5 },  // A: STT
        { wch: 15 }, // B: Mã HS
        { wch: 25 }, // C: Tên
        { wch: 20 }, // D: Xã
        { wch: 8 },  // E: Thửa
        { wch: 8 },  // F: Tờ
        { wch: 25 }, // G: Loại
        { wch: 10 }, // H: TĐ
        { wch: 10 }, // I: TL
        { wch: 12 }, // J: Hẹn trả
        { wch: 20 }  // K: Ghi chú
    ];
    ws['!cols'] = wscols;

    // --- MERGE CELLS (Trộn ô) ---
    ws['!merges'] = [
        // Quốc hiệu
        { s: { r: 0, c: 0 }, e: { r: 0, c: 10 } }, // A1:K1
        { s: { r: 1, c: 0 }, e: { r: 1, c: 10 } }, // A2:K2
        // Tiêu đề
        { s: { r: 3, c: 0 }, e: { r: 3, c: 10 } }, // A4:K4
        { s: { r: 4, c: 0 }, e: { r: 4, c: 10 } }, // A5:K5
        { s: { r: 5, c: 0 }, e: { r: 5, c: 10 } }, // A6:K6
        
        // Chữ ký BÊN GIAO (Trái): Cột A,B,C,D (0-3)
        { s: { r: footerStartRow, c: 0 }, e: { r: footerStartRow, c: 3 } },     
        { s: { r: footerStartRow + 1, c: 0 }, e: { r: footerStartRow + 1, c: 3 } }, 

        // Chữ ký BÊN NHẬN (Phải): Cột H,I,J,K (7-10)
        { s: { r: footerStartRow, c: 7 }, e: { r: footerStartRow, c: 10 } },    
        { s: { r: footerStartRow + 1, c: 7 }, e: { r: footerStartRow + 1, c: 10 } },
    ];

    // --- DEFINING STYLES ---
    const borderStyle = {
        top: { style: "thin", color: { rgb: "000000" } },
        bottom: { style: "thin", color: { rgb: "000000" } },
        left: { style: "thin", color: { rgb: "000000" } },
        right: { style: "thin", color: { rgb: "000000" } }
    };

    const styles = {
        // Quốc hiệu tiêu ngữ
        nationalTitle: {
            font: { name: "Times New Roman", sz: 12, bold: true },
            alignment: { horizontal: "center", vertical: "center" }
        },
        nationalSlogan: {
            font: { name: "Times New Roman", sz: 12, bold: true, underline: true },
            alignment: { horizontal: "center", vertical: "center" }
        },
        // Tiêu đề báo cáo
        reportTitle: {
            font: { name: "Times New Roman", sz: 16, bold: true },
            alignment: { horizontal: "center", vertical: "center" }
        },
        reportSubTitle: {
            font: { name: "Times New Roman", sz: 12, italic: true },
            alignment: { horizontal: "center", vertical: "center" }
        },
        // Header bảng
        tableHeader: {
            font: { name: "Times New Roman", sz: 11, bold: true },
            alignment: { horizontal: "center", vertical: "center", wrapText: true },
            border: borderStyle,
            fill: { fgColor: { rgb: "E0E0E0" } } // Xám nhẹ
        },
        // Dữ liệu bảng (Mặc định)
        tableData: {
            font: { name: "Times New Roman", sz: 11 },
            border: borderStyle,
            alignment: { vertical: "center", wrapText: true }
        },
        // Dữ liệu bảng (Căn giữa)
        tableDataCenter: {
            font: { name: "Times New Roman", sz: 11 },
            border: borderStyle,
            alignment: { horizontal: "center", vertical: "center", wrapText: true }
        },
        // Chữ ký tiêu đề
        sigTitle: {
            font: { name: "Times New Roman", sz: 12, bold: true },
            alignment: { horizontal: "center", vertical: "center" }
        },
        // Chữ ký ghi chú
        sigNote: {
            font: { name: "Times New Roman", sz: 11, italic: true },
            alignment: { horizontal: "center", vertical: "center" }
        }
    };

    // --- ÁP DỤNG STYLE CHO TỪNG Ô ---
    // Duyệt qua tất cả các ô có dữ liệu để gán style
    // Range của bảng dữ liệu là từ dòng 8 (A9) đến lastDataRow
    
    // 1. Style Header Quốc hiệu & Tiêu đề
    if(ws['A1']) ws['A1'].s = styles.nationalTitle;
    if(ws['A2']) ws['A2'].s = styles.nationalSlogan;
    if(ws['A4']) ws['A4'].s = styles.reportTitle;
    if(ws['A5']) ws['A5'].s = styles.reportSubTitle;
    if(ws['A6']) ws['A6'].s = styles.reportSubTitle;

    // 2. Style Bảng (Header + Dữ liệu)
    // Duyệt từ cột 0 đến 10 (A->K)
    for (let c = 0; c <= 10; c++) {
        // Header bảng (Dòng 8 -> A9)
        const headerCell = XLSX.utils.encode_cell({ r: 7, c: c });
        if (!ws[headerCell]) ws[headerCell] = { v: "", t: "s" }; // Tạo ô rỗng nếu thiếu để kẻ khung
        ws[headerCell].s = styles.tableHeader;

        // Dữ liệu bảng (Từ dòng 8 đến lastDataRow - 1)
        for (let r = 8; r < lastDataRow; r++) {
            const cellRef = XLSX.utils.encode_cell({ r: r, c: c });
            if (!ws[cellRef]) ws[cellRef] = { v: "", t: "s" }; // Tạo ô rỗng nếu thiếu để kẻ khung
            
            // Các cột cần căn giữa: STT(0), Thửa(4), Tờ(5), TĐ(7), TL(8), Hẹn Trả(9)
            if ([0, 4, 5, 7, 8, 9].includes(c)) {
                ws[cellRef].s = styles.tableDataCenter;
            } else {
                ws[cellRef].s = styles.tableData;
            }
        }
    }

    // 3. Style Chữ ký
    // Bên giao
    const giaoRef = XLSX.utils.encode_cell({ r: footerStartRow, c: 0 });
    const giaoNoteRef = XLSX.utils.encode_cell({ r: footerStartRow + 1, c: 0 });
    if(ws[giaoRef]) ws[giaoRef].s = styles.sigTitle;
    if(ws[giaoNoteRef]) ws[giaoNoteRef].s = styles.sigNote;

    // Bên nhận
    const nhanRef = XLSX.utils.encode_cell({ r: footerStartRow, c: 7 });
    const nhanNoteRef = XLSX.utils.encode_cell({ r: footerStartRow + 1, c: 7 });
    if(ws[nhanRef]) ws[nhanRef].s = styles.sigTitle;
    if(ws[nhanNoteRef]) ws[nhanNoteRef].s = styles.sigNote;

    // Tạo tên sheet và xuất file
    const safeDate = dateStr.replace(/-/g, '');
    const fileName = `Danh_Sach_Giao_1_Cua_Dot_${batchNum}_${safeDate}.xlsx`;
    
    XLSX.utils.book_append_sheet(wb, ws, "Danh Sách");
    XLSX.writeFile(wb, fileName);
    
    onClose();
  };

  const formatDate = (d: string) => {
      const [y, m, dstr] = d.split('-');
      return `${dstr}/${m}/${y}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md animate-fade-in-up">
        <div className="flex justify-between items-center p-5 border-b">
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <FileDown className="text-green-600" />
            Xuất Danh Sách Giao Trả
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-red-600 transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-4">
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">1. Chọn đợt xuất danh sách</label>
                {batchOptions.length > 0 ? (
                    <div className="relative">
                        <select
                            className="w-full appearance-none border border-gray-300 rounded-lg px-4 py-3 pr-10 focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none bg-white text-gray-700 font-medium"
                            value={selectedBatchKey}
                            onChange={(e) => setSelectedBatchKey(e.target.value)}
                        >
                            {batchOptions.map(opt => (
                                <option key={`${opt.date}_${opt.batch}`} value={`${opt.date}_${opt.batch}`}>
                                    Đợt {opt.batch} - Ngày {formatDate(opt.date)} ({opt.count} HS)
                                </option>
                            ))}
                        </select>
                        <Layers className="absolute right-3 top-3.5 text-gray-400 pointer-events-none" size={18} />
                    </div>
                ) : (
                    <div className="text-center p-4 bg-gray-50 rounded-lg text-gray-500 border border-gray-200">
                        Chưa có dữ liệu đợt xuất nào. Hãy thực hiện "Chốt danh sách" trước.
                    </div>
                )}
            </div>

            {batchOptions.length > 0 && (
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">2. Lọc theo Xã / Phường (Tùy chọn)</label>
                    <div className="relative">
                        <select
                            className="w-full appearance-none border border-gray-300 rounded-lg px-4 py-3 pr-10 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white text-gray-700 font-medium"
                            value={selectedWard}
                            onChange={(e) => setSelectedWard(e.target.value)}
                        >
                            <option value="all">-- Tất cả Xã / Phường --</option>
                            {wards.map(w => (
                                <option key={w} value={w}>{w}</option>
                            ))}
                        </select>
                        <MapPin className="absolute right-3 top-3.5 text-gray-400 pointer-events-none" size={18} />
                    </div>
                </div>
            )}

            <div className="text-xs text-gray-500 bg-blue-50 p-3 rounded border border-blue-100 flex gap-2 items-start">
                <Calendar size={14} className="mt-0.5 text-blue-500 shrink-0" />
                <p>File Excel sẽ được định dạng chuẩn: Có kẻ bảng (Borders), Tiêu đề in đậm, canh giữa và bố cục chữ ký chuẩn.</p>
            </div>

            <div className="pt-4 flex justify-end gap-3 border-t">
                <button 
                    onClick={onClose} 
                    className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 font-medium text-sm"
                >
                    Hủy bỏ
                </button>
                <button 
                    onClick={handleExport}
                    disabled={batchOptions.length === 0}
                    className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm font-medium text-sm"
                >
                    <FileDown size={18} />
                    Tải về Excel
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};

export default ExportModal;
