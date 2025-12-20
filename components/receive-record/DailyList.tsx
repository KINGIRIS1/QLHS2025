
import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx-js-style';
import { RecordFile } from '../../types';
import { getNormalizedWard, getShortRecordType } from '../../constants';
import { Search, Eye, FileSpreadsheet, Pencil, Printer, Trash2 } from 'lucide-react';

interface DailyListProps {
  records: RecordFile[];
  wards: string[];
  currentUser: any;
  onPreviewExcel: (wb: XLSX.WorkBook, name: string) => void;
  // New Handlers
  onEdit: (record: RecordFile) => void;
  onDelete: (record: RecordFile) => void;
  onPrint: (record: RecordFile) => void;
}

const DailyList: React.FC<DailyListProps> = ({ records, wards, onPreviewExcel, onEdit, onDelete, onPrint }) => {
  const [filterDate, setFilterDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [filterWard, setFilterWard] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const filteredDailyRecords = useMemo(() => {
      if (!records) return [];
      const searchLower = searchTerm.toLowerCase();
      return records.filter(r => {
          if (r.receivedDate !== filterDate) return false;
          if (filterWard !== 'all' && r.ward !== filterWard) return false;
          if (searchTerm) {
              const nameMatch = r.customerName?.toLowerCase().includes(searchLower);
              const codeMatch = r.code?.toLowerCase().includes(searchLower);
              if (!nameMatch && !codeMatch) return false;
          }
          return true;
      }).sort((a, b) => (a.code || '').localeCompare((b.code || ''), undefined, { numeric: true, sensitivity: 'base' }));
  }, [records, filterDate, filterWard, searchTerm]);

  const createDailyListWorkbook = () => {
      if (filteredDailyRecords.length === 0) return null;
      const wardTitle = filterWard !== 'all' ? filterWard.toUpperCase() : "TOÀN BỘ CÁC XÃ/PHƯỜNG";
      const dateParts = filterDate.split('-'); 
      const dateStr = `NGÀY ${dateParts[2]} THÁNG ${dateParts[1]} NĂM ${dateParts[0]}`;
      
      // Update Header: Thêm Tờ, Thửa
      const tableHeader = ["STT", "Mã Hồ Sơ", "Chủ Sử Dụng", "Địa Chỉ", "Tờ", "Thửa", "Loại Hồ Sơ", "Hẹn Trả", "Ghi Chú"];
      
      const dataRows = filteredDailyRecords.map((r, i) => [
          i + 1, r.code, r.customerName, r.address || getNormalizedWard(r.ward), 
          r.mapSheet, r.landPlot, // Thêm dữ liệu Tờ, Thửa
          getShortRecordType(r.recordType), 
          r.deadline ? new Date(r.deadline).toLocaleDateString('vi-VN') : '', r.content
      ]);

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([]);

      // Styles
      const border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
      const center = { alignment: { horizontal: "center", vertical: "center", wrapText: true } };
      const headerStyle = { font: { name: "Times New Roman", sz: 11, bold: true }, border, fill: { fgColor: { rgb: "E0E0E0" } }, ...center };
      const cellStyle = { font: { name: "Times New Roman", sz: 11 }, border, alignment: { vertical: "center", wrapText: true } };
      const centerCellStyle = { font: { name: "Times New Roman", sz: 11 }, border, alignment: { horizontal: "center", vertical: "center", wrapText: true } };

      // Header content
      XLSX.utils.sheet_add_aoa(ws, [
          ["CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM"], ["Độc lập - Tự do - Hạnh phúc"], [""],
          ["DANH SÁCH TIẾP NHẬN HỒ SƠ"], [wardTitle], [dateStr], tableHeader
      ], { origin: "A1" });
      
      // Data content (Bắt đầu từ dòng 8 -> index 7)
      XLSX.utils.sheet_add_aoa(ws, dataRows, { origin: "A8" });

      // --- Footer Signatures (NEW) ---
      const lastDataRowIndex = 7 + dataRows.length; // Dòng cuối cùng của dữ liệu
      const footerRowIndex = lastDataRowIndex + 2; // Cách 1 dòng trống

      XLSX.utils.sheet_add_aoa(ws, [
          ["BÊN GIAO HỒ SƠ", "", "", "", "", "BÊN NHẬN HỒ SƠ", "", "", ""],
          ["(Ký và ghi rõ họ tên)", "", "", "", "", "(Ký và ghi rõ họ tên)", "", "", ""]
      ], { origin: { r: footerRowIndex, c: 0 } });

      // Merges
      if (!ws['!merges']) ws['!merges'] = [];
      ws['!merges'].push(
          // Header Merges
          { s: { r: 0, c: 0 }, e: { r: 0, c: 8 } }, 
          { s: { r: 1, c: 0 }, e: { r: 1, c: 8 } }, 
          { s: { r: 3, c: 0 }, e: { r: 3, c: 8 } }, 
          { s: { r: 4, c: 0 }, e: { r: 4, c: 8 } }, 
          { s: { r: 5, c: 0 }, e: { r: 5, c: 8 } },
          
          // Footer Merges (Left side: Cols 0-3)
          { s: { r: footerRowIndex, c: 0 }, e: { r: footerRowIndex, c: 3 } },
          { s: { r: footerRowIndex + 1, c: 0 }, e: { r: footerRowIndex + 1, c: 3 } },
          
          // Footer Merges (Right side: Cols 5-8)
          { s: { r: footerRowIndex, c: 5 }, e: { r: footerRowIndex, c: 8 } },
          { s: { r: footerRowIndex + 1, c: 5 }, e: { r: footerRowIndex + 1, c: 8 } }
      );

      // Column Widths
      ws['!cols'] = [{ wch: 5 }, { wch: 15 }, { wch: 22 }, { wch: 20 }, { wch: 6 }, { wch: 6 }, { wch: 20 }, { wch: 12 }, { wch: 15 }];

      // Apply basic styles for Table
      for(let c=0; c<=8; c++) { 
          const ref = XLSX.utils.encode_cell({r: 6, c: c}); 
          if(!ws[ref]) ws[ref] = { v: "", t: "s"}; 
          ws[ref].s = headerStyle; 
      }
      for(let r=7; r < lastDataRowIndex; r++) { 
          for(let c=0; c<=8; c++) { 
              const ref = XLSX.utils.encode_cell({r: r, c: c}); 
              if(!ws[ref]) ws[ref] = { v: "", t: "s"}; 
              // Căn giữa cho Tờ (4) và Thửa (5)
              if (c === 4 || c === 5) ws[ref].s = centerCellStyle;
              else ws[ref].s = cellStyle;
          } 
      }

      // Apply styles for Footer
      const sigTitleStyle = { font: { name: "Times New Roman", sz: 12, bold: true }, alignment: { horizontal: "center" } };
      const sigNoteStyle = { font: { name: "Times New Roman", sz: 11, italic: true }, alignment: { horizontal: "center" } };

      const leftTitle = XLSX.utils.encode_cell({r: footerRowIndex, c: 0});
      const leftNote = XLSX.utils.encode_cell({r: footerRowIndex + 1, c: 0});
      const rightTitle = XLSX.utils.encode_cell({r: footerRowIndex, c: 5});
      const rightNote = XLSX.utils.encode_cell({r: footerRowIndex + 1, c: 5});

      if(!ws[leftTitle]) ws[leftTitle] = {v: "BÊN GIAO HỒ SƠ", t:'s'}; ws[leftTitle].s = sigTitleStyle;
      if(!ws[leftNote]) ws[leftNote] = {v: "(Ký và ghi rõ họ tên)", t:'s'}; ws[leftNote].s = sigNoteStyle;
      if(!ws[rightTitle]) ws[rightTitle] = {v: "BÊN NHẬN HỒ SƠ", t:'s'}; ws[rightTitle].s = sigTitleStyle;
      if(!ws[rightNote]) ws[rightNote] = {v: "(Ký và ghi rõ họ tên)", t:'s'}; ws[rightNote].s = sigNoteStyle;

      XLSX.utils.book_append_sheet(wb, ws, "Danh Sach");
      return wb;
  };

  const handleExport = () => {
      const wb = createDailyListWorkbook();
      if (!wb) { alert("Không có hồ sơ."); return; }
      XLSX.writeFile(wb, `DS_Tiep_Nhan_${filterDate.replace(/-/g, '')}.xlsx`);
  };

  const handlePreview = () => {
      const wb = createDailyListWorkbook();
      if (!wb) { alert("Không có hồ sơ."); return; }
      onPreviewExcel(wb, `DS_Tiep_Nhan_${filterDate.replace(/-/g, '')}`);
  };

  return (
    <div className="flex flex-col h-full space-y-4 animate-fade-in">
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-wrap items-center gap-4 shrink-0">
            <div className="flex items-center gap-2"> <label className="text-sm font-medium text-gray-600">Ngày nhận:</label> <input type="date" className="border border-gray-300 rounded px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-blue-500" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} /> </div>
            <div className="flex items-center gap-2"> <label className="text-sm font-medium text-gray-600">Xã / Phường:</label> <select className="border border-gray-300 rounded px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-blue-500" value={filterWard} onChange={(e) => setFilterWard(e.target.value)}> <option value="all">-- Tất cả --</option> {wards.map(w => <option key={w} value={w}>{w}</option>)} </select> </div>
            <div className="relative flex-1 max-w-sm"> <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} /> <input type="text" placeholder="Tìm kiếm..." className="w-full pl-9 pr-4 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /> </div>
            <div className="ml-auto flex gap-2">
                <button onClick={handlePreview} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 shadow-sm text-sm font-medium"> <Eye size={16} /> Xem Excel </button>
                <button onClick={handleExport} className="flex items-center gap-2 bg-white text-green-600 border border-green-200 px-4 py-2 rounded-md hover:bg-green-50 shadow-sm text-sm font-medium"> <FileSpreadsheet size={16} /> Tải Excel </button>
            </div>
        </div>
        <div className="flex-1 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col min-h-0">
            <div className="overflow-auto flex-1">
                <table className="w-full text-left table-fixed min-w-[1300px]">
                    <thead className="bg-gray-50 text-xs text-gray-600 uppercase font-bold sticky top-0 shadow-sm">
                        <tr> 
                            <th className="p-4 w-12 text-center">STT</th> 
                            <th className="p-4 w-[120px]">Mã Hồ Sơ</th> 
                            <th className="p-4 w-[200px]">Chủ Sử Dụng</th> 
                            <th className="p-4 w-[180px]">Địa chỉ / Xã Phường</th> 
                            <th className="p-4 w-[60px] text-center">Tờ</th>
                            <th className="p-4 w-[60px] text-center">Thửa</th>
                            <th className="p-4 w-[130px]">Loại Hồ Sơ</th> 
                            <th className="p-4 text-center w-[120px]">Hẹn Trả</th> 
                            <th className="p-4 w-[150px]">Ghi Chú</th>
                            <th className="p-4 w-[140px] text-center bg-gray-100/50 sticky right-0 shadow-l">Thao Tác</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-sm">
                        {filteredDailyRecords.length > 0 ? (
                            filteredDailyRecords.map((r, index) => (
                                <tr key={r.id} className="hover:bg-blue-50/50 group">
                                    <td className="p-4 text-center text-gray-400 align-middle">{index + 1}</td> 
                                    <td className="p-4 font-medium text-blue-600 truncate align-middle" title={r.code}>{r.code}</td> 
                                    <td className="p-4 font-medium text-gray-800 truncate align-middle" title={r.customerName}>{r.customerName}</td> 
                                    <td className="p-4 text-gray-600 truncate align-middle" title={r.address}>{r.address ? `${r.address}, ${getNormalizedWard(r.ward)}` : getNormalizedWard(r.ward)}</td> 
                                    <td className="p-4 text-center font-mono align-middle">{r.mapSheet || '-'}</td>
                                    <td className="p-4 text-center font-mono align-middle">{r.landPlot || '-'}</td>
                                    <td className="p-4 text-gray-600 truncate align-middle" title={r.recordType}>{getShortRecordType(r.recordType)}</td> 
                                    <td className="p-4 text-center text-blue-700 font-medium align-middle">{r.deadline ? new Date(r.deadline).toLocaleDateString('vi-VN') : '-'}</td> 
                                    <td className="p-4 text-gray-500 italic truncate align-middle" title={r.content}>{r.content}</td>
                                    
                                    {/* Action Column */}
                                    <td className="p-3 align-middle text-center sticky right-0 bg-white group-hover:bg-blue-50/50 shadow-l">
                                        <div className="flex items-center justify-center gap-2">
                                            <button onClick={() => onEdit(r)} className="p-1.5 text-blue-600 hover:bg-blue-100 rounded transition-colors" title="Sửa">
                                                <Pencil size={16} />
                                            </button>
                                            <button onClick={() => onPrint(r)} className="p-1.5 text-purple-600 hover:bg-purple-100 rounded transition-colors" title="In biên nhận">
                                                <Printer size={16} />
                                            </button>
                                            <button onClick={() => onDelete(r)} className="p-1.5 text-red-500 hover:bg-red-100 rounded transition-colors" title="Xóa">
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        ) : ( <tr><td colSpan={10} className="p-8 text-center text-gray-400 italic"> Không có hồ sơ nào trong ngày này. </td></tr> )}
                    </tbody>
                </table>
            </div>
        </div>
    </div>
  );
};

export default DailyList;
