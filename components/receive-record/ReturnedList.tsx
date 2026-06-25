import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx-js-style';
import { RecordFile, Employee } from '../../types';
import { getNormalizedWard, getShortRecordType } from '../../constants';
import { Search, Eye, FileSpreadsheet, MapPin, Calendar, ClipboardCheck, ArrowUpDown } from 'lucide-react';

interface ReturnedListProps {
  records: RecordFile[];
  archiveSaoLucRecords?: RecordFile[];
  archiveVaoSoRecords?: RecordFile[];
  archiveDangKyRecords?: RecordFile[];
  archiveCongVanRecords?: RecordFile[];
  wards: string[];
  currentUser: any;
  employees?: Employee[];
  onPreviewExcel: (wb: XLSX.WorkBook, name: string) => void;
  onPrint: (record: RecordFile) => void;
}

// Hàm lấy mã viết tắt (Suffix) từ tên Xã/Phường
const getShortCode = (ward: string) => {
    const normalized = ward.toLowerCase().trim();
    const cleanName = normalized
        .replace(/^(xã|phường|thị trấn|tt\.|p\.|x\.)\s+/g, '')
        .replace(/\s+(xã|phường|thị trấn)\s+/g, ' ');

    if (cleanName.includes('minh hưng') || cleanName.includes('minhhung')) return 'MH';
    if (cleanName.includes('chơn thành') || cleanName.includes('chonthanh') || cleanName.includes('hưng long')) return 'CT';
    if (cleanName.includes('nha bích') || cleanName.includes('nhabich')) return 'NB';
    if (cleanName.includes('minh lập') || cleanName.includes('minhlap')) return 'ML';
    if (cleanName.includes('minh thắng') || cleanName.includes('minhthang')) return 'MT';
    if (cleanName.includes('quang minh') || cleanName.includes('quangminh')) return 'QM';
    if (cleanName.includes('thành tâm') || cleanName.includes('thanhtam')) return 'TT';
    if (cleanName.includes('minh long') || cleanName.includes('minhlong')) return 'MLO';
    
    return 'CT';
};

const getRecordSuffix = (code: string) => {
    if (!code) return '';
    const clean = code.trim().toUpperCase();
    const parts = clean.split('-');
    if (parts.length > 0) {
        return parts[parts.length - 1];
    }
    return '';
};

const normalizeWardName = (w: string) => {
    if (!w) return '';
    return w.toLowerCase()
        .replace(/^(xã|phường|thị trấn|tt\.|p\.|x\.)\s+/g, '')
        .replace(/\s+(xã|phường|thị trấn)\s+/g, ' ')
        .trim();
};

const formatDateDisplay = (dateStr?: string | null) => {
    if (!dateStr) return '-';
    try {
        const onlyDate = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr.split(' ')[0];
        const parts = onlyDate.split('-');
        if (parts.length === 3) {
            return `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
        return dateStr;
    } catch {
        return dateStr;
    }
};

export const ReturnedList: React.FC<ReturnedListProps> = ({
  records,
  archiveSaoLucRecords = [],
  archiveVaoSoRecords = [],
  archiveDangKyRecords = [],
  archiveCongVanRecords = [],
  wards,
  currentUser,
  employees = [],
  onPreviewExcel,
  onPrint
}) => {
  // Lấy ngày đầu tháng và ngày hôm nay
  const todayStr = new Date().toISOString().split('T')[0];
  const firstDayOfMonthStr = (() => {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  })();

  const [fromDate, setFromDate] = useState<string>(firstDayOfMonthStr);
  const [toDate, setToDate] = useState<string>(todayStr);
  const [filterWard, setFilterWard] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortByDate, setSortByDate] = useState<'desc' | 'asc'>('desc');

  // Gom tất cả các nguồn hồ sơ đã trả kết quả
  const allReturnedRecords = useMemo(() => {
    const combined = [
        ...records,
        ...archiveSaoLucRecords,
        ...archiveVaoSoRecords,
        ...archiveDangKyRecords,
        ...archiveCongVanRecords
    ];

    return combined.filter(r => {
        // Hồ sơ được coi là đã trả kết quả nếu có trạng thái RETURNED hoặc có ngày trả kết quả cho dân
        const isReturnedStatus = r.status === 'RETURNED' || (r.status as any) === 'returned';
        const hasReturnDate = !!r.resultReturnedDate;
        return isReturnedStatus || hasReturnDate;
    });
  }, [records, archiveSaoLucRecords, archiveVaoSoRecords, archiveDangKyRecords, archiveCongVanRecords]);

  // Lọc và sắp xếp danh sách hiển thị
  const filteredRecords = useMemo(() => {
    let result = allReturnedRecords.filter(r => {
        // 1. Lọc theo khoảng ngày (Ưu tiên resultReturnedDate, sau đó là exportDate hoặc completedDate làm fallback)
        const retDate = r.resultReturnedDate || r.exportDate || r.completedDate || '';
        if (!retDate) return false;

        const onlyDate = retDate.includes('T') ? retDate.split('T')[0] : retDate.split(' ')[0];
        if (fromDate && onlyDate < fromDate) return false;
        if (toDate && onlyDate > toDate) return false;

        // 2. Lọc theo Xã/Phường
        if (filterWard !== 'all') {
            const rWardNorm = normalizeWardName(r.ward || '');
            const filterWardNorm = normalizeWardName(filterWard);
            const rSuffix = getShortCode(r.ward || '');
            const filterSuffix = getShortCode(filterWard);
            
            // So khớp theo tên hoặc ký hiệu viết tắt
            if (rWardNorm !== filterWardNorm && rSuffix !== filterSuffix) {
                // Kiểm tra thêm theo mã hồ sơ
                const recordSuffix = getRecordSuffix(r.code || '');
                if (recordSuffix !== filterSuffix) return false;
            }
        }

        // 3. Tìm kiếm từ khóa (Tên khách hàng, mã hồ sơ, số điện thoại, CCCD, tờ thửa)
        if (searchTerm) {
            const searchLower = searchTerm.toLowerCase().trim();
            const nameMatch = (r.customerName || '').toLowerCase().includes(searchLower);
            const codeMatch = (r.code || '').toLowerCase().includes(searchLower);
            const phoneMatch = (r.phoneNumber || '').toLowerCase().includes(searchLower);
            const cccdMatch = (r.cccd || '').toLowerCase().includes(searchLower);
            const plotMatch = (r.landPlot || '').toLowerCase().includes(searchLower);
            const sheetMatch = (r.mapSheet || '').toLowerCase().includes(searchLower);

            if (!nameMatch && !codeMatch && !phoneMatch && !cccdMatch && !plotMatch && !sheetMatch) return false;
        }

        return true;
    });

    // Sắp xếp theo ngày trả kết quả
    return result.sort((a, b) => {
        const dateA = a.resultReturnedDate || a.exportDate || a.completedDate || '';
        const dateB = b.resultReturnedDate || b.exportDate || b.completedDate || '';
        if (sortByDate === 'desc') {
            return dateB.localeCompare(dateA);
        } else {
            return dateA.localeCompare(dateB);
        }
    });
  }, [allReturnedRecords, fromDate, toDate, filterWard, searchTerm, sortByDate]);

  // Tạo tệp Excel danh sách trả kết quả chuyên nghiệp
  const buildExcelWorkbook = (exportList: RecordFile[], forPreviewOnly: boolean = false) => {
    if (exportList.length === 0) return null;

    const wb = XLSX.utils.book_new();
    const border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
    const center = { alignment: { horizontal: "center", vertical: "center", wrapText: true } };
    const right = { alignment: { horizontal: "right", vertical: "center" } };
    const headerStyle = { font: { name: "Times New Roman", sz: 11, bold: true }, border, fill: { fgColor: { rgb: "D1E7DD" } }, ...center }; // Emerald light accent
    const cellStyle = { font: { name: "Times New Roman", sz: 11 }, border, alignment: { vertical: "center", wrapText: true } };
    const centerCellStyle = { font: { name: "Times New Roman", sz: 11 }, border, alignment: { horizontal: "center", vertical: "center", wrapText: true } };

    // Hàm tạo 1 Sheet từ danh sách hồ sơ
    const appendSheet = (sheetName: string, list: RecordFile[], wardTitle: string) => {
        const tableHeader = ["STT", "Mã Hồ Sơ", "Chủ Sử Dụng", "Xã / Phường", "Số Tờ", "Số Thửa", "Loại Hồ Sơ", "Ngày Nhận", "Ngày Trả Dân", "Người Nhận Kết Quả", "Số Biên Lai"];
        const dataRows = list.map((r, i) => [
            i + 1,
            r.code || '',
            r.customerName || '',
            getNormalizedWard(r.ward),
            r.mapSheet || '-',
            r.landPlot || '-',
            getShortRecordType(r.recordType),
            formatDateDisplay(r.receivedDate),
            formatDateDisplay(r.resultReturnedDate || r.exportDate || r.completedDate),
            r.receiverName || '',
            r.receiptNumber || '-'
        ]);

        const ws = XLSX.utils.aoa_to_sheet([]);
        const rangeStr = `TỪ NGÀY ${formatDateDisplay(fromDate)} ĐẾN NGÀY ${formatDateDisplay(toDate)}`;

        // Tiêu đề đầu sheet
        XLSX.utils.sheet_add_aoa(ws, [
            ["CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM"],
            ["Độc lập - Tự do - Hạnh phúc"],
            [""],
            ["DANH SÁCH HỒ SƠ ĐÃ TRẢ KẾT QUẢ CHO DÂN"],
            [`ĐỊA BÀN: ${wardTitle.toUpperCase()}`],
            [rangeStr],
            [""],
            tableHeader
        ], { origin: "A1" });

        XLSX.utils.sheet_add_aoa(ws, dataRows, { origin: "A9" });

        // Tạo phần chữ ký
        const lastDataRowIndex = 8 + dataRows.length;
        const footerRowIndex = lastDataRowIndex + 2;

        XLSX.utils.sheet_add_aoa(ws, [
            ["BÊN TRẢ KẾT QUẢ", "", "", "", "", "BÊN NHẬN / THỦ TRƯỞNG ĐƠN VỊ", "", "", ""],
            ["(Ký và ghi rõ họ tên)", "", "", "", "", "(Ký và ghi rõ họ tên)", "", "", ""]
        ], { origin: { r: footerRowIndex, c: 0 } });

        // Merge cells cho tiêu đề
        if (!ws['!merges']) ws['!merges'] = [];
        ws['!merges'].push(
            { s: { r: 0, c: 0 }, e: { r: 0, c: 10 } },
            { s: { r: 1, c: 0 }, e: { r: 1, c: 10 } },
            { s: { r: 3, c: 0 }, e: { r: 3, c: 10 } },
            { s: { r: 4, c: 0 }, e: { r: 4, c: 10 } },
            { s: { r: 5, c: 0 }, e: { r: 5, c: 10 } }
        );

        // Styling cho toàn bộ các ô
        const maxCols = 11;
        const maxRows = lastDataRowIndex + 5;

        for (let rIdx = 0; rIdx < maxRows; rIdx++) {
            for (let cIdx = 0; cIdx < maxCols; cIdx++) {
                const cellRef = XLSX.utils.encode_cell({ r: rIdx, c: cIdx });
                if (!ws[cellRef]) continue;

                if (rIdx === 0 || rIdx === 1) {
                    ws[cellRef].s = { font: { name: "Times New Roman", sz: 12, bold: rIdx === 0 }, alignment: { horizontal: "center" } };
                } else if (rIdx === 3) {
                    ws[cellRef].s = { font: { name: "Times New Roman", sz: 14, bold: true }, alignment: { horizontal: "center" } };
                } else if (rIdx === 4 || rIdx === 5) {
                    ws[cellRef].s = { font: { name: "Times New Roman", sz: 11, italic: rIdx === 5, bold: rIdx === 4 }, alignment: { horizontal: "center" } };
                } else if (rIdx === 8) {
                    ws[cellRef].s = headerStyle;
                } else if (rIdx > 8 && rIdx < lastDataRowIndex) {
                    const isCenterCol = [0, 1, 3, 4, 5, 6, 7, 8, 10].includes(cIdx);
                    ws[cellRef].s = isCenterCol ? centerCellStyle : cellStyle;
                } else if (rIdx >= footerRowIndex) {
                    ws[cellRef].s = { font: { name: "Times New Roman", sz: 11, bold: rIdx === footerRowIndex }, alignment: { horizontal: "center" } };
                }
            }
        }

        // Thiết lập độ rộng cột hợp lý
        ws['!cols'] = [
            { wch: 6 },  // STT
            { wch: 18 }, // Mã HS
            { wch: 25 }, // Chủ sử dụng
            { wch: 20 }, // Xã/Phường
            { wch: 8 },  // Số tờ
            { wch: 8 },  // Số thửa
            { wch: 15 }, // Loại hồ sơ
            { wch: 13 }, // Ngày nhận
            { wch: 13 }, // Ngày trả
            { wch: 22 }, // Người nhận kq
            { wch: 15 }  // Số biên lai
        ];

        XLSX.utils.book_append_sheet(wb, ws, sheetName);
    };

    if (filterWard === 'all') {
        // Gom theo xã phường: Tạo các Sheet riêng biệt cho từng xã phường có dữ liệu
        const wardsWithData = Array.from(new Set(exportList.map(r => getNormalizedWard(r.ward).trim()))).filter(Boolean);
        
        if (wardsWithData.length === 0) {
            appendSheet("Chung", exportList, "Tất cả xã phường");
        } else {
            // Sheet tổng hợp đầu tiên
            appendSheet("Tổng Hợp Chung", exportList, "Tất cả xã phường");
            
            // Sheet cho từng xã phường
            wardsWithData.forEach(ward => {
                const subList = exportList.filter(r => getNormalizedWard(r.ward).trim() === ward);
                if (subList.length > 0) {
                    // Tên sheet giới hạn dưới 30 ký tự
                    const safeSheetName = ward.replace(/^(Phường|Xã)\s+/i, '').substring(0, 30);
                    appendSheet(safeSheetName, subList, ward);
                }
            });
        }
    } else {
        // Chỉ xuất 1 xã phường được chọn
        const wardLabel = getNormalizedWard(filterWard);
        appendSheet(wardLabel.substring(0, 30), exportList, wardLabel);
    }

    return wb;
  };

  const handlePreviewExcel = () => {
      if (filteredRecords.length === 0) {
          alert("Không có dữ liệu trong khoảng thời gian và bộ lọc hiện tại để xem trước.");
          return;
      }
      const wb = buildExcelWorkbook(filteredRecords, true);
      if (wb) {
          const wardSuffix = filterWard !== 'all' ? `_${getShortCode(filterWard)}` : '_TongHop';
          onPreviewExcel(wb, `DanhSachDaTraKetQua${wardSuffix}_${fromDate}_to_${toDate}.xlsx`);
      }
  };

  const handleExportExcel = () => {
      if (filteredRecords.length === 0) {
          alert("Không có dữ liệu để xuất.");
          return;
      }
      const wb = buildExcelWorkbook(filteredRecords, false);
      if (wb) {
          const wardSuffix = filterWard !== 'all' ? `_${getShortCode(filterWard)}` : '_TongHop';
          const filename = `DanhSachDaTraKetQua${wardSuffix}_${fromDate}_to_${toDate}.xlsx`;
          XLSX.writeFile(wb, filename);
      }
  };

  return (
    <div className="flex flex-col gap-5 h-full animate-fade-in">
        {/* Bộ lọc và thanh công cụ tìm kiếm */}
        <div className="bg-slate-50 border border-slate-200/60 rounded-2xl p-5 flex flex-col md:flex-row md:items-end gap-4 shadow-sm shrink-0">
            {/* Từ ngày */}
            <div className="flex-1 min-w-[140px]">
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                    <Calendar size={13} className="text-emerald-600" />
                    Từ ngày trả
                </label>
                <input
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                />
            </div>

            {/* Đến ngày */}
            <div className="flex-1 min-w-[140px]">
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                    <Calendar size={13} className="text-emerald-600" />
                    Đến ngày trả
                </label>
                <input
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                />
            </div>

            {/* Xã phường */}
            <div className="flex-1 min-w-[180px]">
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                    <MapPin size={13} className="text-emerald-600" />
                    Xã / Phường (Đất)
                </label>
                <select
                    value={filterWard}
                    onChange={(e) => setFilterWard(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                >
                    <option value="all">Tất cả địa bàn</option>
                    {wards.map(w => (
                        <option key={w} value={w}>{getNormalizedWard(w)}</option>
                    ))}
                </select>
            </div>

            {/* Ô tìm kiếm */}
            <div className="flex-[1.5] min-w-[220px]">
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Tìm kiếm thông tin
                </label>
                <div className="relative">
                    <input
                        type="text"
                        placeholder="Nhập tên khách hàng, mã HS, SĐT, CCCD, tờ, thửa..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-xl pl-9 pr-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-medium"
                    />
                    <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
                </div>
            </div>

            {/* Nút hành động */}
            <div className="flex gap-2">
                <button
                    onClick={handlePreviewExcel}
                    className="flex items-center justify-center gap-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 px-4 py-2.5 rounded-xl hover:bg-emerald-100/70 text-sm font-bold transition-all shrink-0 shadow-sm"
                >
                    <Eye size={16} />
                    <span>Xem Excel</span>
                </button>
                <button
                    onClick={handleExportExcel}
                    className="flex items-center justify-center gap-1.5 bg-emerald-600 text-white px-4 py-2.5 rounded-xl hover:bg-emerald-700 text-sm font-bold transition-all shrink-0 shadow-md hover:shadow-emerald-600/10"
                >
                    <FileSpreadsheet size={16} />
                    <span>Xuất Excel</span>
                </button>
            </div>
        </div>

        {/* Thống kê nhanh */}
        <div className="flex justify-between items-center bg-emerald-50/40 border border-emerald-100 rounded-2xl px-5 py-3 shadow-sm shrink-0">
            <div className="flex items-center gap-2">
                <div className="p-1.5 bg-emerald-100 rounded-lg text-emerald-700">
                    <ClipboardCheck size={18} />
                </div>
                <div>
                    <span className="text-xs text-slate-500 font-medium block">Số lượng kết quả đã trả</span>
                    <span className="text-lg font-extrabold text-emerald-800">{filteredRecords.length} hồ sơ</span>
                </div>
            </div>
            
            <button
                onClick={() => setSortByDate(prev => prev === 'desc' ? 'asc' : 'desc')}
                className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-emerald-700 hover:bg-white border border-transparent hover:border-slate-200 px-3 py-1.5 rounded-lg transition-all"
            >
                <ArrowUpDown size={13} />
                <span>Ngày trả: {sortByDate === 'desc' ? 'Mới nhất' : 'Cũ nhất'}</span>
            </button>
        </div>

        {/* Khung chứa bảng dữ liệu */}
        <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-0">
            <div className="overflow-auto flex-1">
                <table className="w-full text-left table-fixed min-w-[1400px]">
                    <thead className="bg-slate-50 text-xs text-slate-600 uppercase font-bold sticky top-0 shadow-sm z-10 border-b border-slate-100">
                        <tr>
                            <th className="p-4 w-12 text-center">STT</th>
                            <th className="p-4 w-[140px]">Mã Hồ Sơ</th>
                            <th className="p-4 w-[200px]">Chủ Sử Dụng</th>
                            <th className="p-4 w-[160px]">Xã / Phường (Đất)</th>
                            <th className="p-4 w-[60px] text-center">Tờ</th>
                            <th className="p-4 w-[60px] text-center">Thửa</th>
                            <th className="p-4 w-[150px]">Loại Hồ Sơ</th>
                            <th className="p-4 text-center w-[110px]">Ngày Nhận</th>
                            <th className="p-4 text-center w-[110px] bg-emerald-50/50 text-emerald-900 border-x border-emerald-100">Ngày Trả Dân</th>
                            <th className="p-4 w-[180px]">Người Nhận KQ</th>
                            <th className="p-4 w-[130px]">Số Biên Lai</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                        {filteredRecords.length > 0 ? (
                            filteredRecords.map((r, index) => (
                                <tr key={r.id} className="hover:bg-emerald-50/10 group transition-colors">
                                    <td className="p-4 text-center text-slate-400 align-middle font-medium">{index + 1}</td>
                                    <td className="p-4 font-bold text-slate-800 truncate align-middle tracking-tight">{r.code || '-'}</td>
                                    <td className="p-4 font-bold text-slate-800 truncate align-middle" title={r.customerName}>{r.customerName || '-'}</td>
                                    <td className="p-4 text-slate-700 truncate align-middle font-semibold">{getNormalizedWard(r.ward)}</td>
                                    <td className="p-4 text-center font-mono align-middle font-semibold text-slate-600">{r.mapSheet || '-'}</td>
                                    <td className="p-4 text-center font-mono align-middle font-semibold text-slate-600">{r.landPlot || '-'}</td>
                                    <td className="p-4 text-slate-600 truncate align-middle font-medium">
                                        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                                            (r.recordType || '').toLowerCase().includes('sao lục') 
                                            ? 'bg-purple-100 text-purple-700' 
                                            : (r.recordType || '').toLowerCase().includes('thuế')
                                            ? 'bg-emerald-100 text-emerald-700'
                                            : 'bg-blue-100 text-blue-700'
                                        }`}>
                                            {r.recordType || 'Sao lục hồ sơ'}
                                        </span>
                                    </td>
                                    <td className="p-4 text-center text-slate-600 align-middle font-medium">{formatDateDisplay(r.receivedDate)}</td>
                                    <td className="p-4 text-center text-emerald-700 font-bold align-middle bg-emerald-50/30 border-x border-emerald-100">
                                        {formatDateDisplay(r.resultReturnedDate || r.exportDate || r.completedDate)}
                                    </td>
                                    <td className="p-4 text-slate-700 font-semibold align-middle truncate" title={r.receiverName || ''}>
                                        {r.receiverName || <span className="text-slate-400 font-normal italic">Chưa ghi nhận</span>}
                                    </td>
                                    <td className="p-4 text-slate-500 font-mono align-middle font-medium">{r.receiptNumber || '-'}</td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan={11} className="p-12 text-center text-slate-400 italic">
                                    Không tìm thấy hồ sơ đã trả kết quả nào khớp với điều kiện lọc hiện tại.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    </div>
  );
};
