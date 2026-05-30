import React, { useState, useMemo, useEffect } from 'react';
import * as XLSX from 'xlsx-js-style';
import { RecordFile, Employee } from '../../types';
import { getNormalizedWard, getShortRecordType } from '../../constants';
import { Search, Eye, FileSpreadsheet, Pencil, Printer, Trash2, MapPin, Archive, X, CheckCircle2, ShieldCheck, MapPinned } from 'lucide-react';

interface DailyListProps {
  records: RecordFile[];
  archiveRecords?: RecordFile[]; // Hồ sơ Sao lục từ bảng lưu trữ archive_records
  wards: string[];
  currentUser: any;
  employees?: Employee[];
  onPreviewExcel: (wb: XLSX.WorkBook, name: string) => void;
  // Các hàm xử lý hành động
  onEdit: (record: RecordFile) => void;
  onDelete: (record: RecordFile) => void;
  onPrint: (record: RecordFile) => void;
}

// Hàm lấy mã viết tắt (Suffix) từ tên Xã/Phường
const getShortCode = (ward: string) => {
    const normalized = ward.toLowerCase().trim();
    const cleanName = normalized
        .replace(/^(xã|phường|thị trấn|tt\.|p\.|x\.)\s+/g, '')
        .replace(/\s+(xã|phường|thị trấn)\s+/g, ' ');

    if (cleanName.includes('minh hưng') || cleanName.includes('minhhung')) return 'MH';
    if (cleanName.includes('chơn thành') || cleanName.includes('the_chon_thanh') || cleanName.includes('chonthanh') || cleanName.includes('hưng long')) return 'CT';
    if (cleanName.includes('nha bích') || cleanName.includes('nhabich')) return 'NB';
    if (cleanName.includes('minh lập') || cleanName.includes('minhlap')) return 'ML';
    if (cleanName.includes('minh thắng') || cleanName.includes('minhthang')) return 'MT';
    if (cleanName.includes('quang minh') || cleanName.includes('quangminh')) return 'QM';
    if (cleanName.includes('thành tâm') || cleanName.includes('thanhtam')) return 'TT';
    if (cleanName.includes('minh long') || cleanName.includes('minhlong')) return 'MLO';
    
    return 'CT'; // Mặc định
};

const normalizeWardName = (w: string) => {
    if (!w) return '';
    return w.toLowerCase()
        .replace(/^(xã|phường|thị trấn|tt\.|p\.|x\.)\s+/g, '')
        .replace(/\s+(xã|phường|thị trấn)\s+/g, ' ')
        .trim();
};

const DailyList: React.FC<DailyListProps> = ({ records, archiveRecords = [], wards, currentUser, employees = [], onPreviewExcel, onEdit, onDelete, onPrint }) => {
  // Bộ lọc bên ngoài
  const [filterDate, setFilterDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [filterWard, setFilterWard] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  
  // 3 Tabs chính hoàn hảo theo đúng yêu cầu người dùng:
  // - 'inside': Hồ sơ đo đạc trong địa giới
  // - 'outside': Hồ sơ đo đạc phi địa giới
  // - 'archive': Hồ sơ lưu trữ (Sao lục)
  const [subTab, setSubTab] = useState<'inside' | 'outside' | 'archive'>('inside');

  // Trạng thái Popup in tổng hợp mới
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [printDate, setPrintDate] = useState(filterDate);
  const [printWard, setPrintWard] = useState(filterWard);

  // Cập nhật bộ lọc in đồng bộ khi người dùng đổi bộ lọc ở bên ngoài
  useEffect(() => {
    setPrintDate(filterDate);
  }, [filterDate]);

  useEffect(() => {
    setPrintWard(filterWard);
  }, [filterWard]);

  // Lấy địa bàn quản lý của cán bộ hiện tại
  const normalizedMyWards = useMemo(() => {
      const linkedEmp = employees.find(e => e.id === currentUser?.employeeId);
      const myManagedWards = linkedEmp?.managedWards || [];
      return myManagedWards.map(w => normalizeWardName(w));
  }, [employees, currentUser]);

  const mySuffixes = useMemo(() => {
      const linkedEmp = employees.find(e => e.id === currentUser?.employeeId);
      const myManagedWards = linkedEmp?.managedWards || [];
      return myManagedWards.map(w => getShortCode(w));
  }, [employees, currentUser]);

  // Lọc tất cả các hồ sơ đo đạc thô của ngày nhận hiện tại (bỏ qua Sao lục và các loại CMD, tòa án...)
  const dailyMeasureRecords = useMemo(() => {
      if (!records) return [];
      return records.filter(r => {
          const isSaoLuc = (r.recordType || '').toLowerCase().includes('sao lục');
          if (isSaoLuc) return false;
          if (['CMD', 'Tòa án', 'Thi hành án'].includes(r.recordType || '')) return false;
          return r.receivedDate === filterDate;
      });
  }, [records, filterDate]);

  // Chia tách đo đạc thô thành trong địa giới và phi địa giới dựa vào địa bàn phụ trách thực tế
  const [allInsideRecords, allOutsideRecords] = useMemo(() => {
      const inside: RecordFile[] = [];
      const outside: RecordFile[] = [];

      dailyMeasureRecords.forEach(r => {
          const rWardNorm = normalizeWardName(r.ward || '');
          const rSuffix = getShortCode(r.ward || '');
          const isMyWard = rWardNorm && normalizedMyWards.includes(rWardNorm);
          const isMyWardBySuffix = mySuffixes.includes(rSuffix);

          if (isMyWard || isMyWardBySuffix) {
              inside.push(r);
          } else {
              outside.push(r);
          }
      });
      return [inside, outside];
  }, [dailyMeasureRecords, normalizedMyWards, mySuffixes]);

  // Áp dụng thêm filterWard và searchTerm cho Tab Đo đạc trong địa giới
  const filteredInsideRecords = useMemo(() => {
      const searchLower = searchTerm.toLowerCase();
      return allInsideRecords.filter(r => {
          // Lọc theo đơn vị ở ngoài (nếu có chọn)
          if (filterWard !== 'all') {
              const targetSuffix = getShortCode(filterWard);
              const recordCode = (r.code || '').trim().toUpperCase();
              const parts = recordCode.split('-');
              const recordSuffix = parts.length > 0 ? parts[parts.length - 1] : '';

              if (parts.length >= 3) {
                  if (recordSuffix !== targetSuffix) return false;
              } else {
                  if (r.ward !== filterWard) return false;
              }
          }

          // Tìm kiếm từ khóa
          if (searchTerm) {
              const nameMatch = r.customerName?.toLowerCase().includes(searchLower);
              const codeMatch = r.code?.toLowerCase().includes(searchLower);
              if (!nameMatch && !codeMatch) return false;
          }
          return true;
      }).sort((a, b) => {
          const codeA = (a.code || '').toUpperCase();
          const codeB = (b.code || '').toUpperCase();
          return codeA.localeCompare(codeB, undefined, { numeric: true });
      });
  }, [allInsideRecords, filterWard, searchTerm]);

  // Áp dụng thêm filterWard và searchTerm cho Tab Đo đạc phi địa giới
  const filteredOutsideRecords = useMemo(() => {
      const searchLower = searchTerm.toLowerCase();
      return allOutsideRecords.filter(r => {
          // Lọc theo đơn vị ở ngoài (nếu có chọn)
          if (filterWard !== 'all') {
              const targetSuffix = getShortCode(filterWard);
              const recordCode = (r.code || '').trim().toUpperCase();
              const parts = recordCode.split('-');
              const recordSuffix = parts.length > 0 ? parts[parts.length - 1] : '';

              if (parts.length >= 3) {
                  if (recordSuffix !== targetSuffix) return false;
              } else {
                  if (r.ward !== filterWard) return false;
              }
          }

          // Tìm kiếm từ khóa
          if (searchTerm) {
              const nameMatch = r.customerName?.toLowerCase().includes(searchLower);
              const codeMatch = r.code?.toLowerCase().includes(searchLower);
              if (!nameMatch && !codeMatch) return false;
          }
          return true;
      }).sort((a, b) => {
          const codeA = (a.code || '').toUpperCase();
          const codeB = (b.code || '').toUpperCase();
          return codeA.localeCompare(codeB, undefined, { numeric: true });
      });
  }, [allOutsideRecords, filterWard, searchTerm]);

  // Bộ lọc hồ sơ Lưu trữ (Sao lục) lấy từ bảng archive_records
  const filteredArchiveRecords = useMemo(() => {
      const searchLower = searchTerm.toLowerCase();
      const list = archiveRecords.filter(r => {
          // 1. Lọc theo ngày nhận
          if (r.receivedDate !== filterDate) return false;
          
          // 2. Lọc theo Đơn vị (đối với sao lục sẽ gom theo mã hồ sơ để không bị tách phi địa giới)
          if (filterWard !== 'all') {
              const targetSuffix = getShortCode(filterWard);
              const recordCode = (r.code || '').trim().toUpperCase();
              
              const hasSuffix = recordCode.endsWith(targetSuffix) || recordCode.includes(`-${targetSuffix}`) || recordCode.includes(`${targetSuffix}-`);
              const hasWard = normalizeWardName(r.ward || '') === normalizeWardName(filterWard);

              if (!hasSuffix && !hasWard) {
                  return false;
              }
          }

          // 3. Tìm kiếm từ khóa
          if (searchTerm) {
              const nameMatch = r.customerName?.toLowerCase().includes(searchLower);
              const codeMatch = r.code?.toLowerCase().includes(searchLower);
              if (!nameMatch && !codeMatch) return false;
          }
          return true;
      });

      return list.sort((a, b) => {
          const codeA = (a.code || '').toUpperCase();
          const codeB = (b.code || '').toUpperCase();
          return codeA.localeCompare(codeB, undefined, { numeric: true });
      });
  }, [archiveRecords, filterDate, filterWard, searchTerm]);

  // Danh sách hiển thị theo Tab hiện tại ở ngoài giao diện
  const currentTabRecords = useMemo(() => {
      if (subTab === 'inside') return filteredInsideRecords;
      if (subTab === 'outside') return filteredOutsideRecords;
      return filteredArchiveRecords;
  }, [subTab, filteredInsideRecords, filteredOutsideRecords, filteredArchiveRecords]);

  // Hàm hỗ trợ in Excel: Trả về tiêu đề hiển thị tương ứng với Tab hiện tại
  const getTabTitleInVietnamese = (tab: 'inside' | 'outside' | 'archive') => {
      if (tab === 'inside') return 'Hồ sơ đo đạc trong địa giới';
      if (tab === 'outside') return 'Hồ sơ đo đạc phi địa giới';
      return 'Hồ sơ lưu trữ (Sao lục)';
  };

  // Hàm tạo Biên bản in Excel tổng hợp chung
  const createDailyListWorkbook = (recordsToExport: RecordFile[], targetWard: string, targetDate: string, titleSuffix: string = '') => {
      if (recordsToExport.length === 0) return null;
      
      const wardTitle = targetWard !== 'all' ? targetWard.toUpperCase() : "CÁC ĐƠN VỊ";
      const dateParts = targetDate.split('-'); 
      const dateStr = `NGÀY ${dateParts[2]} THÁNG ${dateParts[1]} NĂM ${dateParts[0]}`;
      
      const tableHeader = ["STT", "Mã Hồ Sơ", "Chủ Sử Dụng", "Xã / Phường", "Tờ", "Thửa", "Loại Hồ Sơ", "Hẹn Trả", "Ghi Chú"];
      
      const dataRows = recordsToExport.map((r, i) => [
          i + 1, r.code, r.customerName, 
          getNormalizedWard(r.ward), 
          r.mapSheet || '-', r.landPlot || '-', 
          getShortRecordType(r.recordType), 
          r.deadline ? new Date(r.deadline).toLocaleDateString('vi-VN') : '', r.content || ''
      ]);

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([]);

      // Thiết lập style
      const border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
      const center = { alignment: { horizontal: "center", vertical: "center", wrapText: true } };
      const headerStyle = { font: { name: "Times New Roman", sz: 11, bold: true }, border, fill: { fgColor: { rgb: "E0E0E0" } }, ...center };
      const cellStyle = { font: { name: "Times New Roman", sz: 11 }, border, alignment: { vertical: "center", wrapText: true } };
      const centerCellStyle = { font: { name: "Times New Roman", sz: 11 }, border, alignment: { horizontal: "center", vertical: "center", wrapText: true } };

      const displayTitle = "DANH SÁCH TIẾP NHẬN HỒ SƠ" + (titleSuffix ? ` (${titleSuffix.toUpperCase()})` : '');

      // Ghi tiêu đề vào sheet
      XLSX.utils.sheet_add_aoa(ws, [
          ["CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM"], ["Độc lập - Tự do - Hạnh phúc"], [""],
          [displayTitle], [wardTitle], [dateStr], tableHeader
      ], { origin: "A1" });
      
      // Ghi dữ liệu records
      XLSX.utils.sheet_add_aoa(ws, dataRows, { origin: "A8" });

      // Phần ký xác nhận
      const lastDataRowIndex = 7 + dataRows.length;
      const footerRowIndex = lastDataRowIndex + 2;

      XLSX.utils.sheet_add_aoa(ws, [
          ["BÊN GIAO HỒ SƠ", "", "", "", "", "BÊN NHẬN HỒ SƠ", "", "", ""],
          ["(Ký và ghi rõ họ tên)", "", "", "", "", "(Ký và ghi rõ họ tên)", "", "", ""]
      ], { origin: { r: footerRowIndex, c: 0 } });

      // Gộp các ô tiêu đề và chữ ký
      if (!ws['!merges']) ws['!merges'] = [];
      ws['!merges'].push(
          { s: { r: 0, c: 0 }, e: { r: 0, c: 8 } }, 
          { s: { r: 1, c: 0 }, e: { r: 1, c: 8 } }, 
          { s: { r: 3, c: 0 }, e: { r: 3, c: 8 } }, 
          { s: { r: 4, c: 0 }, e: { r: 4, c: 8 } }, 
          { s: { r: 5, c: 0 }, e: { r: 5, c: 8 } },
          { s: { r: footerRowIndex, c: 0 }, e: { r: footerRowIndex, c: 3 } },
          { s: { r: footerRowIndex + 1, c: 0 }, e: { r: footerRowIndex + 1, c: 3 } },
          { s: { r: footerRowIndex, c: 5 }, e: { r: footerRowIndex, c: 8 } },
          { s: { r: footerRowIndex + 1, c: 5 }, e: { r: footerRowIndex + 1, c: 8 } }
      );

      // Độ rộng cột
      ws['!cols'] = [{ wch: 5 }, { wch: 15 }, { wch: 22 }, { wch: 15 }, { wch: 6 }, { wch: 6 }, { wch: 20 }, { wch: 12 }, { wch: 15 }];

      // Định dạng borders và fonts cho header
      for(let c=0; c<=8; c++) { 
          const ref = XLSX.utils.encode_cell({r: 6, c: c}); 
          if(!ws[ref]) ws[ref] = { v: "", t: "s"}; 
          ws[ref].s = headerStyle; 
      }
      // Định dạng borders và fonts cho bảng dữ liệu
      for(let r=7; r < lastDataRowIndex; r++) { 
          for(let c=0; c<=8; c++) { 
              const ref = XLSX.utils.encode_cell({r: r, c: c}); 
              if(!ws[ref]) ws[ref] = { v: "", t: "s"}; 
              if (c === 4 || c === 5) ws[ref].s = centerCellStyle;
              else ws[ref].s = cellStyle;
          } 
      }

      // Định dạng phần chữ ký
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

  // Logic tổng hợp & lọc dữ liệu đặc biệt cho popup in (TỰ ĐỘNG THEO TAB ĐANG CHỌN)
  const compiledPrintRecords = useMemo(() => {
      if (subTab === 'archive') {
          // 1. Hồ sơ lưu trữ (Sao lục) từ archiveRecords theo ngày and đơn vị
          const list = archiveRecords.filter(r => {
              if (r.receivedDate !== printDate) return false;
              if (printWard !== 'all') {
                  const targetSuffix = getShortCode(printWard);
                  const recordCode = (r.code || '').trim().toUpperCase();
                  
                  // ĐỐI VỚI HỒ SƠ SAO LỤC, TỔNG HỢP THEO MÃ HỒ SƠ
                  const hasSuffix = recordCode.endsWith(targetSuffix) || recordCode.includes(`-${targetSuffix}`) || recordCode.includes(`${targetSuffix}-`);
                  const hasWard = normalizeWardName(r.ward || '') === normalizeWardName(printWard);
                  if (!hasSuffix && !hasWard) return false;
              }
              return true;
          });
          return list.sort((a, b) => {
              const codeA = (a.code || '').toUpperCase();
              const codeB = (b.code || '').toUpperCase();
              return codeA.localeCompare(codeB, undefined, { numeric: true });
          });
      } else {
          // 2. Hồ sơ đo đạc (trong hay phi địa giới)
          const dailyMeasure = records.filter(r => {
              const isSaoLuc = (r.recordType || '').toLowerCase().includes('sao lục');
              if (isSaoLuc) return false;
              if (['CMD', 'Tòa án', 'Thi hành án'].includes(r.recordType || '')) return false;
              return r.receivedDate === printDate;
          });

          const isInsideTab = (subTab === 'inside');
          const matchedList = dailyMeasure.filter(r => {
              const rWardNorm = normalizeWardName(r.ward || '');
              const rSuffix = getShortCode(r.ward || '');
              const isMyWard = rWardNorm && normalizedMyWards.includes(rWardNorm);
              const isMyWardBySuffix = mySuffixes.includes(rSuffix);

              const isInside = (isMyWard || isMyWardBySuffix);

              // Tự động phân chia dựa trên Tab hiện tại của người dùng
              if (isInsideTab && !isInside) return false;
              if (!isInsideTab && isInside) return false;

              // Lọc theo Xã phụ trách được chọn trong Popup
              if (printWard !== 'all') {
                  const targetSuffix = getShortCode(printWard);
                  const recordCode = (r.code || '').trim().toUpperCase();
                  const parts = recordCode.split('-');
                  const recordSuffix = parts.length > 0 ? parts[parts.length - 1] : '';

                  if (parts.length >= 3) {
                      if (recordSuffix !== targetSuffix) return false;
                  } else {
                      if (r.ward !== printWard) return false;
                  }
              }
              return true;
          });

          return matchedList.sort((a, b) => {
              const codeA = (a.code || '').toUpperCase();
              const codeB = (b.code || '').toUpperCase();
              return codeA.localeCompare(codeB, undefined, { numeric: true });
          });
      }
  }, [records, archiveRecords, printDate, printWard, subTab, normalizedMyWards, mySuffixes]);

  // Hành động Xem trước từ Modal
  const handlePrintModalPreview = () => {
      const typeStr = getTabTitleInVietnamese(subTab);
      const wb = createDailyListWorkbook(compiledPrintRecords, printWard, printDate, typeStr);
      if (!wb) { alert(`Không tìm thấy hồ sơ thuộc danh mục [${typeStr}] ngày đã chọn!`); return; }
      onPreviewExcel(wb, `DS_${subTab}_${printDate.replace(/-/g, '')}`);
      setIsPrintModalOpen(false);
  };

  // Hành động Tải báo cáo Excel từ Modal
  const handlePrintModalDownload = () => {
      const typeStr = getTabTitleInVietnamese(subTab);
      const wb = createDailyListWorkbook(compiledPrintRecords, printWard, printDate, typeStr);
      if (!wb) { alert(`Không tìm thấy hồ sơ thuộc danh mục [${typeStr}] ngày đã chọn!`); return; }
      XLSX.writeFile(wb, `DS_${subTab}_${printWard}_${printDate.replace(/-/g, '')}.xlsx`);
      setIsPrintModalOpen(false);
  };

  // Tải Excel nhanh cho tab hiện tại ngoài màn hình
  const handleExportQuick = () => {
      const typeStr = getTabTitleInVietnamese(subTab);
      const wb = createDailyListWorkbook(currentTabRecords, filterWard, filterDate, typeStr);
      if (!wb) { alert("Không có hồ sơ trong danh mục hiện tại để xuất!"); return; }
      XLSX.writeFile(wb, `DS_Nhanh_${subTab}_${filterDate.replace(/-/g, '')}.xlsx`);
  };

  // Xem Excel nhanh cho tab hiện tại ngoài màn hình
  const handlePreviewQuick = () => {
      const typeStr = getTabTitleInVietnamese(subTab);
      const wb = createDailyListWorkbook(currentTabRecords, filterWard, filterDate, typeStr);
      if (!wb) { alert("Không có hồ sơ trong danh mục hiện tại để xem trước!"); return; }
      onPreviewExcel(wb, `DS_Nhanh_${subTab}_${filterDate.replace(/-/g, '')}`);
  };

  return (
    <div className="flex flex-col h-full space-y-4 animate-fade-in relative text-gray-800">
        {/* Bộ lọc Header */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-wrap items-center gap-4 shrink-0 transition-all">
            <div className="flex items-center gap-2"> 
                <label className="text-sm font-semibold text-gray-600">Ngày nhận:</label> 
                <input type="date" className="border border-gray-300 rounded px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50/50 hover:bg-white transition-all font-semibold text-gray-700" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} /> 
            </div>
            <div className="flex items-center gap-2"> 
                <label className="text-sm font-semibold text-gray-600">Đơn vị (Đất):</label> 
                <select className="border border-gray-300 rounded px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50/50 hover:bg-white transition-all font-semibold text-gray-700" value={filterWard} onChange={(e) => setFilterWard(e.target.value)}> 
                    <option value="all">-- Tất cả địa bàn --</option> 
                    {wards.map(w => <option key={w} value={w}>{w}</option>)} 
                </select> 
            </div>
            <div className="relative flex-1 max-w-sm"> 
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} /> 
                <input type="text" placeholder="Tìm kiếm nhanh tên, mã hồ sơ..." className="w-full pl-9 pr-4 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50/50 hover:bg-white transition-all font-medium" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /> 
            </div>
            
            <div className="ml-auto flex gap-2">
                <button onClick={() => setIsPrintModalOpen(true)} className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-4.5 py-2 rounded-xl shadow-md text-sm font-bold transition-all transform active:scale-95"> 
                    <Printer size={16} /> 
                    <span>In Tab Hiện Tại</span> 
                </button>
                <div className="h-8 w-px bg-gray-200 self-center"></div>
                <button onClick={handlePreviewQuick} className="flex items-center gap-1.5 bg-blue-50 text-blue-700 border border-blue-100 px-3.5 py-2 rounded-lg hover:bg-blue-100 text-sm font-semibold transition-all"> 
                    <Eye size={15} /> 
                    <span>Xem Excel nhanh</span> 
                </button>
                <button onClick={handleExportQuick} className="flex items-center gap-1.5 bg-green-50 text-green-700 border border-green-100 px-3.5 py-2 rounded-lg hover:bg-green-100 text-sm font-semibold transition-all"> 
                    <FileSpreadsheet size={15} /> 
                    <span>Tải Excel nhanh</span> 
                </button>
            </div>
        </div>

        {/* 3 Tabs mới tuyệt đẹp theo đúng yêu cầu phân tách */}
        <div className="flex border-b border-gray-200 bg-white rounded-t-xl shrink-0">
            <button
                onClick={() => setSubTab('inside')}
                className={`flex items-center gap-2.5 px-6 py-4 border-b-2 font-bold text-sm transition-all outline-none ${
                    subTab === 'inside'
                        ? 'border-blue-600 text-blue-700 bg-blue-50/30 rounded-tl-xl'
                        : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-200'
                }`}
            >
                <ShieldCheck size={16} className={subTab === 'inside' ? 'text-blue-600' : 'text-gray-400'} />
                <span>Hồ sơ đo đạc trong địa giới</span>
                <span className={`ml-1.5 px-2.5 py-0.5 text-xs font-bold rounded-full ${
                    subTab === 'inside' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600'
                }`}>
                    {filteredInsideRecords.length}
                </span>
            </button>

            <button
                onClick={() => setSubTab('outside')}
                className={`flex items-center gap-2.5 px-6 py-4 border-b-2 font-bold text-sm transition-all outline-none ${
                    subTab === 'outside'
                        ? 'border-orange-500 text-orange-700 bg-orange-50/20'
                        : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-200'
                }`}
            >
                <MapPinned size={16} className={subTab === 'outside' ? 'text-orange-600' : 'text-gray-400'} />
                <span>Hồ sơ đo đạc phi địa giới</span>
                <span className={`ml-1.5 px-2.5 py-0.5 text-xs font-bold rounded-full ${
                    subTab === 'outside' ? 'bg-orange-100 text-orange-800' : 'bg-gray-100 text-gray-600'
                }`}>
                    {filteredOutsideRecords.length}
                </span>
            </button>
            
            <button
                onClick={() => setSubTab('archive')}
                className={`flex items-center gap-2.5 px-6 py-4 border-b-2 font-bold text-sm transition-all outline-none ${
                    subTab === 'archive'
                        ? 'border-purple-600 text-purple-700 bg-purple-50/30 rounded-tr-xl'
                        : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-200'
                }`}
            >
                <Archive size={16} className={subTab === 'archive' ? 'text-purple-600' : 'text-gray-400'} />
                <span>Hồ sơ lưu trữ (Sao lục)</span>
                <span className={`ml-1.5 px-2.5 py-0.5 text-xs font-bold rounded-full ${
                    subTab === 'archive' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-600'
                }`}>
                    {filteredArchiveRecords.length}
                </span>
            </button>
        </div>

        {/* Khung chứa bảng dữ liệu */}
        <div className="flex-1 bg-white rounded-b-xl border-x border-b border-gray-200 shadow-sm overflow-hidden flex flex-col min-h-0">
            <div className="overflow-auto flex-1">
                <table className="w-full text-left table-fixed min-w-[1300px]">
                    <thead className="bg-gray-50 text-xs text-gray-600 uppercase font-bold sticky top-0 shadow-sm z-10 border-b border-gray-100">
                        <tr> 
                            <th className="p-4 w-12 text-center">STT</th> 
                            <th className="p-4 w-[130px]">Mã Hồ Sơ</th> 
                            <th className="p-4 w-[210px]">Chủ Sử Dụng</th> 
                            <th className="p-4 w-[160px]">Xã / Phường (Đất)</th> 
                            <th className="p-4 w-[200px]">Địa chỉ chi tiết</th> 
                            <th className="p-4 w-[60px] text-center">Tờ</th>
                            <th className="p-4 w-[60px] text-center">Thửa</th>
                            <th className="p-4 w-[130px]">Loại Hồ Sơ</th> 
                            <th className="p-4 text-center w-[120px]">Hẹn Trả</th> 
                            <th className="p-4 w-[150px]">Ghi Chú</th>
                            <th className="p-4 w-[140px] text-center bg-gray-100/50 sticky right-0 shadow-l">Thao Tác</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-sm">
                        {currentTabRecords.length > 0 ? (
                            currentTabRecords.map((r, index) => (
                                <tr key={r.id} className="hover:bg-blue-50/20 group transition-colors">
                                    <td className="p-4 text-center text-gray-400 align-middle font-medium">{index + 1}</td> 
                                    <td className="p-4 font-bold text-blue-600 truncate align-middle tracking-tight" title={r.code}>{r.code}</td> 
                                    <td className="p-4 font-bold text-gray-800 truncate align-middle" title={r.customerName}>{r.customerName}</td> 
                                    <td className="p-4 text-gray-700 truncate align-middle font-semibold" title={getNormalizedWard(r.ward)}>
                                        {getNormalizedWard(r.ward)}
                                    </td>
                                    <td className="p-4 text-gray-600 truncate align-middle text-xs" title={r.address || ''}>
                                        {r.address || '-'}
                                    </td> 
                                    <td className="p-4 text-center font-mono align-middle font-semibold text-gray-600">{r.mapSheet || '-'}</td>
                                    <td className="p-4 text-center font-mono align-middle font-semibold text-gray-600">{r.landPlot || '-'}</td>
                                    <td className="p-4 text-gray-600 truncate align-middle font-medium" title={r.recordType || ''}>
                                        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                                            (r.recordType || '').toLowerCase().includes('sao lục') 
                                            ? 'bg-purple-100 text-purple-700' 
                                            : 'bg-blue-100 text-blue-700'
                                        }`}>
                                            {getShortRecordType(r.recordType)}
                                        </span>
                                    </td> 
                                    <td className="p-4 text-center text-blue-700 font-bold align-middle bg-blue-50/10">{r.deadline ? new Date(r.deadline).toLocaleDateString('vi-VN') : '-'}</td> 
                                    <td className="p-4 text-gray-500 italic truncate align-middle text-xs" title={r.content || ''}>{r.content}</td>
                                    <td className="p-3 align-middle text-center sticky right-0 bg-white group-hover:bg-blue-50/20 shadow-l transition-colors">
                                        <div className="flex items-center justify-center gap-1.5">
                                            <button onClick={() => onEdit(r)} className="p-1.5 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors" title="Sửa">
                                                <Pencil size={15} />
                                            </button>
                                            <button onClick={() => onPrint(r)} className="p-1.5 text-purple-600 hover:bg-purple-100 rounded-lg transition-colors" title="In biên nhận">
                                                <Printer size={15} />
                                            </button>
                                            <button onClick={() => onDelete(r)} className="p-1.5 text-red-500 hover:bg-red-100 rounded-lg transition-colors" title="Xóa">
                                                <Trash2 size={15} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        ) : ( <tr><td colSpan={11} className="p-8 text-center text-gray-400 italic"> Không có hồ sơ nào trong ngày hôm nay khớp với bộ lọc xã hoặc từ khóa. </td></tr> )}
                    </tbody>
                </table>
            </div>
        </div>

        {/* ==================== POPUP IN HỒ SƠ TỔNG HỢP THEO TAB ĐANG CHỌN ==================== */}
        {isPrintModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in text-gray-800">
                <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-full max-w-lg overflow-hidden shrink-0 flex flex-col transform transition-all animate-scale-up">
                    {/* Header Popup */}
                    <div className="p-5 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-indigo-50 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="bg-blue-100 p-2 rounded-xl text-blue-700">
                                <Printer size={18} />
                            </div>
                            <div>
                                <h3 className="font-bold text-gray-900 text-lg">In Danh Sách Chi Tiết</h3>
                                <p className="text-xs text-gray-500 font-medium">Bản in tự động thiết lập theo Tab đang hoạt động</p>
                            </div>
                        </div>
                        <button onClick={() => setIsPrintModalOpen(false)} className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-1.5 rounded-lg transition-all">
                            <X size={18} />
                        </button>
                    </div>

                    {/* Nội Dung Popup */}
                    <div className="p-6 space-y-5">
                        {/* Huy hiệu chỉ báo danh mục in hiện tại của tab */}
                        <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl flex items-center gap-2">
                            <CheckCircle2 size={18} className="text-blue-600 shrink-0" />
                            <div className="text-xs text-blue-800 font-semibold">
                                Danh mục in: <span className="underline font-bold">{getTabTitleInVietnamese(subTab)}</span>
                            </div>
                        </div>

                        {/* 1. Chọn ngày nhận */}
                        <div className="space-y-1.5">
                            <label className="text-sm font-bold text-gray-700 flex items-center gap-1">Ngày nhận hồ sơ:</label>
                            <input type="date" className="w-full border border-gray-300 rounded-lg px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold" value={printDate} onChange={(e) => setPrintDate(e.target.value)} />
                        </div>

                        {/* 2. Chọn Địa bàn tổng hợp */}
                        <div className="space-y-1.5">
                            <label className="text-sm font-bold text-gray-700 flex items-center gap-1 flex-wrap">Địa bàn cần in:</label>
                            <select className="w-full border border-gray-300 rounded-lg px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold" value={printWard} onChange={(e) => setPrintWard(e.target.value)}>
                                <option value="all">-- Tất cả địa bàn --</option>
                                {wards.map(w => <option key={w} value={w}>{w}</option>)}
                            </select>
                        </div>

                        {/* Thống kê nhanh số phiếu sấp sỉ thỏa mãn */}
                        <div className="flex items-center justify-between px-4 py-2.5 bg-indigo-50 border border-indigo-100 rounded-xl text-indigo-900 text-xs font-bold">
                            <span>Số hồ sơ tìm thấy:</span>
                            <span className="bg-indigo-600 text-white rounded px-2.5 py-0.5 text-sm font-black">{compiledPrintRecords.length} hồ sơ</span>
                        </div>

                        {/* Hướng dẫn nghiệp vụ */}
                        {subTab === 'archive' && (
                            <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg text-[11px] text-amber-800 leading-relaxed font-semibold">
                                💡 Lưu ý Sao lục: Hồ sơ sao lục được tổng hợp trực tiếp theo mã xã viết tắt. Ví dụ mã là MH sẽ tự động lọc vào xã Minh Hưng mà không tách phi địa giới.
                            </div>
                        )}
                    </div>

                    {/* Footer Actions */}
                    <div className="p-4 border-t border-gray-100 bg-gray-50 flex gap-2 justify-end">
                        <button onClick={() => setIsPrintModalOpen(false)} className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-200/60 rounded-lg transition-all">Quay lại</button>
                        <button onClick={handlePrintModalPreview} disabled={compiledPrintRecords.length === 0} className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-bold transition-all transform active:scale-95">
                            <Eye size={15} />
                            <span>Xem trước</span>
                        </button>
                        <button onClick={handlePrintModalDownload} disabled={compiledPrintRecords.length === 0} className="flex items-center gap-1.5 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-bold transition-all transform active:scale-95">
                            <Printer size={15} />
                            <span>In Excel</span>
                        </button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

export default DailyList;
