
import React, { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx-js-style';
import { RecordFile, RecordStatus } from '../types';
import { X, FileDown, Calendar, Layers, MapPin, Printer, Eye } from 'lucide-react';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  records: RecordFile[];
  wards: string[];
  type: 'handover' | 'check_list'; // Phân loại danh sách
  onPreview: (workbook: XLSX.WorkBook, fileName: string) => void; // Callback để mở Preview
}

const ExportModal: React.FC<ExportModalProps> = ({ isOpen, onClose, records, wards, type, onPreview }) => {
  const [selectedBatchKey, setSelectedBatchKey] = useState<string>('');
  const [selectedWard, setSelectedWard] = useState<string>('all');

  // 1. Tổng hợp danh sách các đợt (Batch Options)
  const batchOptions = useMemo(() => {
    const batches: Record<string, { date: string, batch: number | string, count: number }> = {};

    records.forEach(r => {
      if (type === 'handover') {
          // Logic cho Giao 1 cửa: Dựa vào exportBatch
          if ((r.status === RecordStatus.HANDOVER || r.status === RecordStatus.SIGNED) && r.exportBatch && r.exportDate) {
            const dateStr = r.exportDate.split('T')[0];
            const key = `${dateStr}_${r.exportBatch}`;
            if (!batches[key]) {
              batches[key] = { date: dateStr, batch: r.exportBatch, count: 0 };
            }
            batches[key].count++;
          }
      } else if (type === 'check_list') {
          // Logic cho Trình Ký: Dựa vào ngày tiếp nhận (receivedDate) để gom nhóm
          // Lấy các hồ sơ đang Chờ ký hoặc Đã ký (nhưng chưa giao)
          if (r.status === RecordStatus.PENDING_SIGN || r.status === RecordStatus.SIGNED) {
             const dateStr = r.receivedDate;
             if (!dateStr) return;
             const key = `date_${dateStr}`;
             if (!batches[key]) {
                 batches[key] = { date: dateStr, batch: 'Theo ngày', count: 0 };
             }
             batches[key].count++;
          }
      }
    });

    // Sắp xếp giảm dần theo ngày
    return Object.entries(batches)
        .map(([key, value]) => ({ key, ...value }))
        .sort((a, b) => b.date.localeCompare(a.date));
  }, [records, isOpen, type]);

  // Tự động chọn đợt mới nhất khi mở modal
  useEffect(() => {
    if (isOpen && batchOptions.length > 0) {
        setSelectedBatchKey(batchOptions[0].key);
    } else {
        setSelectedBatchKey('');
    }
    if (isOpen) setSelectedWard('all');
  }, [isOpen, batchOptions]);

  const formatDate = (d: string) => {
      const date = new Date(d);
      if (isNaN(date.getTime())) return d;
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${day}/${month}/${year}`;
  };

  const removeVietnameseTones = (str: string): string => {
    if (!str) return '';
    str = str.toLowerCase();
    str = str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    str = str.replace(/đ/g, "d");
    str = str.replace(/\s+/g, "_");
    return str.toUpperCase();
  };

  // Hàm tạo Workbook chung (cho cả Preview và Download)
  const generateWorkbook = (): { wb: XLSX.WorkBook, fileName: string } | null => {
    if (!selectedBatchKey) return null;

    let recordsToExport: RecordFile[] = [];
    let title = "";
    let subTitle = "";
    let fileName = "";

    if (type === 'handover') {
        const [dateStr, batchStr] = selectedBatchKey.split('_');
        const batchNum = parseInt(batchStr);
        
        recordsToExport = records.filter(r => {
            const matchBatch = r.exportDate?.startsWith(dateStr) && r.exportBatch === batchNum;
            const matchWard = selectedWard === 'all' || r.ward === selectedWard;
            return matchBatch && matchWard;
        });

        title = "DANH SÁCH BÀN GIAO HỒ SƠ 1 CỬA";
        subTitle = `ĐỢT: ${batchNum}  -  TỔNG SỐ HỒ SƠ: ${recordsToExport.length}`;
        const safeDate = dateStr.replace(/-/g, '');
        fileName = `Giao_1_Cua_Dot_${batchNum}_${safeDate}`;

    } else {
        // Check List
        const dateStr = selectedBatchKey.replace('date_', '');
        
        recordsToExport = records.filter(r => {
            const matchDate = r.receivedDate === dateStr;
            const matchStatus = r.status === RecordStatus.PENDING_SIGN || r.status === RecordStatus.SIGNED;
            const matchWard = selectedWard === 'all' || r.ward === selectedWard;
            return matchDate && matchStatus && matchWard;
        });

        title = "DANH SÁCH HỒ SƠ TRÌNH KÝ";
        subTitle = `NGÀY TIẾP NHẬN: ${formatDate(dateStr)}  -  SỐ LƯỢNG: ${recordsToExport.length}`;
        const safeDate = dateStr.replace(/-/g, '');
        fileName = `Trinh_Ky_Ngay_${safeDate}`;
    }

    if (recordsToExport.length === 0) {
        alert("Không tìm thấy hồ sơ nào cho lựa chọn này.");
        return null;
    }

    if (selectedWard !== 'all') {
        fileName += `_${removeVietnameseTones(selectedWard)}`;
    }

    // --- TẠO EXCEL ---
    // Tiêu đề ngày tháng (dùng ngày hiện tại hoặc ngày của đợt)
    const exportDateParts = type === 'handover' 
        ? selectedBatchKey.split('_')[0].split('-') 
        : selectedBatchKey.replace('date_', '').split('-');
        
    const displayDate = `Ngày ${exportDateParts[2]} tháng ${exportDateParts[1]} năm ${exportDateParts[0]}`;

    const tableHeader = [
        "STT", "Mã Hồ Sơ", "Chủ Sử Dụng", "Địa Chỉ (Xã)", 
        "Thửa", "Tờ", "Loại Hồ Sơ", "Số TĐ", "Số TL", 
        "Hẹn Trả", "Ghi Chú"
    ];

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
        r.deadline ? formatDate(r.deadline) : '',
        r.notes || ''
    ]);

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([]); 

    XLSX.utils.sheet_add_aoa(ws, [
        ["CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM"],
        ["Độc lập - Tự do - Hạnh phúc"],
        [""],
        [title],
        [displayDate.toUpperCase()],
        [subTitle],
        [""],
        tableHeader
    ], { origin: "A1" });

    XLSX.utils.sheet_add_aoa(ws, dataRows, { origin: "A9" });

    const lastDataRow = 8 + dataRows.length;
    const footerStartRow = lastDataRow + 3;

    XLSX.utils.sheet_add_aoa(ws, [
        ["BÊN GIAO HỒ SƠ", "", "", "", "", "", "", "BÊN NHẬN HỒ SƠ"],
        ["(Ký và ghi rõ họ tên)", "", "", "", "", "", "", "(Ký và ghi rõ họ tên)"]
    ], { origin: `A${footerStartRow + 1}` });

    const wscols = [{ wch: 5 }, { wch: 15 }, { wch: 25 }, { wch: 20 }, { wch: 8 }, { wch: 8 }, { wch: 25 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 20 }];
    ws['!cols'] = wscols;

    ws['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 10 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: 10 } },
        { s: { r: 3, c: 0 }, e: { r: 3, c: 10 } },
        { s: { r: 4, c: 0 }, e: { r: 4, c: 10 } },
        { s: { r: 5, c: 0 }, e: { r: 5, c: 10 } },
        { s: { r: footerStartRow, c: 0 }, e: { r: footerStartRow, c: 3 } },     
        { s: { r: footerStartRow + 1, c: 0 }, e: { r: footerStartRow + 1, c: 3 } }, 
        { s: { r: footerStartRow, c: 7 }, e: { r: footerStartRow, c: 10 } },    
        { s: { r: footerStartRow + 1, c: 7 }, e: { r: footerStartRow + 1, c: 10 } },
    ];

    // Styles
    const borderStyle = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
    const styles = {
        nationalTitle: { font: { name: "Times New Roman", sz: 12, bold: true }, alignment: { horizontal: "center", vertical: "center" } },
        nationalSlogan: { font: { name: "Times New Roman", sz: 12, bold: true, underline: true }, alignment: { horizontal: "center", vertical: "center" } },
        reportTitle: { font: { name: "Times New Roman", sz: 16, bold: true }, alignment: { horizontal: "center", vertical: "center" } },
        reportSubTitle: { font: { name: "Times New Roman", sz: 12, italic: true }, alignment: { horizontal: "center", vertical: "center" } },
        tableHeader: { font: { name: "Times New Roman", sz: 11, bold: true }, alignment: { horizontal: "center", vertical: "center", wrapText: true }, border: borderStyle, fill: { fgColor: { rgb: "E0E0E0" } } },
        tableData: { font: { name: "Times New Roman", sz: 11 }, border: borderStyle, alignment: { vertical: "center", wrapText: true } },
        tableDataCenter: { font: { name: "Times New Roman", sz: 11 }, border: borderStyle, alignment: { horizontal: "center", vertical: "center", wrapText: true } },
        sigTitle: { font: { name: "Times New Roman", sz: 12, bold: true }, alignment: { horizontal: "center", vertical: "center" } },
        sigNote: { font: { name: "Times New Roman", sz: 11, italic: true }, alignment: { horizontal: "center", vertical: "center" } }
    };

    if(ws['A1']) ws['A1'].s = styles.nationalTitle;
    if(ws['A2']) ws['A2'].s = styles.nationalSlogan;
    if(ws['A4']) ws['A4'].s = styles.reportTitle;
    if(ws['A5']) ws['A5'].s = styles.reportSubTitle;
    if(ws['A6']) ws['A6'].s = styles.reportSubTitle;

    for (let c = 0; c <= 10; c++) {
        const headerCell = XLSX.utils.encode_cell({ r: 7, c: c });
        if (!ws[headerCell]) ws[headerCell] = { v: "", t: "s" };
        ws[headerCell].s = styles.tableHeader;

        for (let r = 8; r < lastDataRow; r++) {
            const cellRef = XLSX.utils.encode_cell({ r: r, c: c });
            if (!ws[cellRef]) ws[cellRef] = { v: "", t: "s" };
            if ([0, 4, 5, 7, 8, 9].includes(c)) ws[cellRef].s = styles.tableDataCenter;
            else ws[cellRef].s = styles.tableData;
        }
    }

    const giaoRef = XLSX.utils.encode_cell({ r: footerStartRow, c: 0 });
    const giaoNoteRef = XLSX.utils.encode_cell({ r: footerStartRow + 1, c: 0 });
    const nhanRef = XLSX.utils.encode_cell({ r: footerStartRow, c: 7 });
    const nhanNoteRef = XLSX.utils.encode_cell({ r: footerStartRow + 1, c: 7 });

    if(ws[giaoRef]) ws[giaoRef].s = styles.sigTitle;
    if(ws[giaoNoteRef]) ws[giaoNoteRef].s = styles.sigNote;
    if(ws[nhanRef]) ws[nhanRef].s = styles.sigTitle;
    if(ws[nhanNoteRef]) ws[nhanNoteRef].s = styles.sigNote;

    XLSX.utils.book_append_sheet(wb, ws, "Danh Sách");
    return { wb, fileName };
  };

  const handleDownload = () => {
      const result = generateWorkbook();
      if (result) {
          XLSX.writeFile(result.wb, result.fileName + '.xlsx');
          onClose(); // Đóng sau khi tải
      }
  };

  const handlePreview = () => {
      const result = generateWorkbook();
      if (result) {
          onPreview(result.wb, result.fileName);
          onClose(); // Đóng modal chọn đợt để hiện modal Preview
      }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md animate-fade-in-up">
        <div className="flex justify-between items-center p-5 border-b">
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <Printer className="text-blue-600" />
            {type === 'handover' ? 'Xuất DS Giao 1 Cửa' : 'Xuất DS Trình Ký'}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-red-600 transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-4">
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">1. Chọn đợt / ngày xuất</label>
                {batchOptions.length > 0 ? (
                    <div className="relative">
                        <select
                            className="w-full appearance-none border border-gray-300 rounded-lg px-4 py-3 pr-10 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white text-gray-700 font-medium"
                            value={selectedBatchKey}
                            onChange={(e) => setSelectedBatchKey(e.target.value)}
                        >
                            {batchOptions.map(opt => (
                                <option key={opt.key} value={opt.key}>
                                    {type === 'handover' 
                                      ? `Đợt ${opt.batch} - Ngày ${formatDate(opt.date)} (${opt.count} HS)`
                                      : `Ngày tiếp nhận: ${formatDate(opt.date)} (${opt.count} HS)`
                                    }
                                </option>
                            ))}
                        </select>
                        <Layers className="absolute right-3 top-3.5 text-gray-400 pointer-events-none" size={18} />
                    </div>
                ) : (
                    <div className="text-center p-4 bg-gray-50 rounded-lg text-gray-500 border border-gray-200 text-sm">
                        {type === 'handover' 
                            ? 'Chưa có đợt giao nào. Hãy thực hiện "Chốt danh sách" trước.'
                            : 'Không có hồ sơ nào đang chờ ký.'}
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
                <p>Hệ thống sẽ tạo file Excel định dạng chuẩn để in ấn hoặc lưu trữ.</p>
            </div>

            <div className="pt-4 flex justify-between gap-3 border-t">
                <button 
                    onClick={onClose} 
                    className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 font-medium text-sm"
                >
                    Hủy bỏ
                </button>
                
                <div className="flex gap-2">
                    <button 
                        onClick={handlePreview}
                        disabled={batchOptions.length === 0}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 border border-blue-200 rounded-md hover:bg-blue-200 disabled:opacity-50 font-medium text-sm transition-colors"
                    >
                        <Eye size={18} />
                        Xem trước & In
                    </button>
                    <button 
                        onClick={handleDownload}
                        disabled={batchOptions.length === 0}
                        className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 font-medium text-sm shadow-sm transition-colors"
                    >
                        <FileDown size={18} />
                        Tải Excel
                    </button>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default ExportModal;
