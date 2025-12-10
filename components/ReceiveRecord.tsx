
import React, { useState, useEffect, useMemo } from 'react';
import { RecordFile, RecordStatus, Employee, User, Holiday } from '../types';
import { RECORD_TYPES, getShortRecordType, getNormalizedWard } from '../constants';
import { fetchHolidays } from '../services/api';
import { Save, User as UserIcon, MapPin, FileText, Calendar, RotateCcw, Settings, Eye, LayoutList, PlusCircle, FileSpreadsheet, Search, FileCheck, Loader2 } from 'lucide-react';
import { generateDocxBlobAsync, hasTemplate, STORAGE_KEYS } from '../services/docxService';
import TemplateConfigModal from './TemplateConfigModal';
import DocxPreviewModal from './DocxPreviewModal';
import ExcelPreviewModal from './ExcelPreviewModal';
import * as XLSX from 'xlsx-js-style';

interface ReceiveRecordProps {
  onSave: (record: RecordFile) => Promise<boolean>;
  wards: string[];
  employees: Employee[];
  currentUser: User;
  records?: RecordFile[];
}

const getSolarDateFromLunar = (lunarDay: number, lunarMonth: number, year: number): Date => {
    const lunarMapping: Record<number, Record<string, string>> = {
        2024: { "1/1": "2024-02-10", "2/1": "2024-02-11", "3/1": "2024-02-12", "10/3": "2024-04-18" },
        2025: { "1/1": "2025-01-29", "2/1": "2025-01-30", "3/1": "2025-01-31", "10/3": "2025-04-07" },
        2026: { "1/1": "2026-02-17", "2/1": "2026-02-18", "3/1": "2026-02-19", "10/3": "2026-04-26" }
    };
    const key = `${lunarDay}/${lunarMonth}`;
    if (lunarMapping[year] && lunarMapping[year][key]) return new Date(lunarMapping[year][key]);
    return new Date(1970, 0, 1);
};

const ReceiveRecord: React.FC<ReceiveRecordProps> = ({ onSave, wards, employees, currentUser, records = [] }) => {
  const [loading, setLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [templateType, setTemplateType] = useState<'receipt' | 'contract'>('receipt'); 
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  
  const [viewMode, setViewMode] = useState<'create' | 'list'>('create');
  
  const [filterDate, setFilterDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [filterWard, setFilterWard] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [previewFileName, setPreviewFileName] = useState('');

  const [isExcelPreviewOpen, setIsExcelPreviewOpen] = useState(false);
  const [previewWorkbook, setPreviewWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [previewExcelName, setPreviewExcelName] = useState('');

  const [formData, setFormData] = useState<Partial<RecordFile>>({
    code: '', customerName: '', phoneNumber: '', cccd: '', authorizedBy: '', authDocType: '', otherDocs: '', content: '',
    receivedDate: new Date().toISOString().split('T')[0], deadline: '', ward: '', landPlot: '', mapSheet: '', area: 0,
    address: '', recordType: '', status: RecordStatus.RECEIVED // recordType mặc định rỗng
  });

  useEffect(() => {
      const load = async () => { const data = await fetchHolidays(); setHolidays(data); };
      load();
  }, []);

  useEffect(() => {
    if (formData.ward) generateCode(formData.ward, formData.receivedDate);
  }, [formData.ward, formData.receivedDate, records]);

  const getShortCode = (ward: string) => {
      const normalized = ward.toLowerCase().trim();
      if (normalized.includes('minh hưng') || normalized.includes('minhhung')) return 'MH';
      if (normalized.includes('chơn thành') || normalized.includes('chonthanh')) return 'CT';
      if (normalized.includes('nha bích') || normalized.includes('nhabich')) return 'NB';
      return 'KH';
  };

  const generateCode = (wardName: string, dateStr: string = new Date().toISOString().split('T')[0]) => {
    const d = new Date(dateStr);
    const yy = d.getFullYear().toString().slice(-2);
    const mm = ('0' + (d.getMonth() + 1)).slice(-2);
    const dd = ('0' + d.getDate()).slice(-2);
    const datePrefix = `${yy}${mm}${dd}`;
    const suffix = getShortCode(wardName);
    
    let maxSeq = 0;
    records.forEach(r => {
        if (!r.code) return;
        const parts = r.code.split('-');
        if (parts.length === 3) {
            const [rPrefix, rSeq, rSuffix] = parts;
            if (rPrefix === datePrefix && rSuffix === suffix) {
                const seqNum = parseInt(rSeq, 10);
                if (!isNaN(seqNum) && seqNum > maxSeq) maxSeq = seqNum;
            }
        }
    });
    const nextSeq = (maxSeq + 1).toString().padStart(3, '0');
    const newCode = `${datePrefix}-${nextSeq}-${suffix}`;
    setFormData(prev => { if (prev.code !== newCode) return { ...prev, code: newCode }; return prev; });
  };

  const calculateDeadline = (type: string, receivedDateStr: string) => {
      let daysToAdd = 30; 
      
      const lowerType = type.toLowerCase();

      if (lowerType.includes('trích lục')) {
          daysToAdd = 10; 
      } else if (lowerType.includes('trích đo chỉnh lý')) {
          daysToAdd = 15; 
      } else if (lowerType.includes('trích đo')) {
          daysToAdd = 30; 
      } else if (lowerType.includes('đo đạc') || lowerType.includes('cắm mốc')) {
          daysToAdd = 30; 
      }
      
      const startDate = new Date(receivedDateStr);
      let count = 0;
      let currentDate = new Date(startDate);
      const currentYear = startDate.getFullYear();
      const relevantYears = [currentYear, currentYear + 1];
      const solarHolidays: string[] = [];
      
      holidays.forEach(h => {
          relevantYears.forEach(year => {
              let dateStr = '';
              if (h.isLunar) {
                  const solarDate = getSolarDateFromLunar(h.day, h.month, year);
                  dateStr = solarDate.toISOString().split('T')[0];
              } else {
                  const m = h.month.toString().padStart(2, '0');
                  const d = h.day.toString().padStart(2, '0');
                  dateStr = `${year}-${m}-${d}`;
              }
              if (dateStr && !dateStr.startsWith('1970')) solarHolidays.push(dateStr);
          });
      });

      while (count < daysToAdd) {
          currentDate.setDate(currentDate.getDate() + 1);
          const dayOfWeek = currentDate.getDay(); 
          const dateString = currentDate.toISOString().split('T')[0];
          const isSunday = dayOfWeek === 0;
          const isHoliday = solarHolidays.includes(dateString);
          if (!isSunday && !isHoliday) count++;
      }
      return currentDate.toISOString().split('T')[0];
  };

  const handleChange = (field: keyof RecordFile, value: any) => {
    setFormData(prev => {
        const newData = { ...prev, [field]: value };
        if (field === 'recordType' || field === 'receivedDate') {
            const rType = field === 'recordType' ? value : prev.recordType;
            const rDate = field === 'receivedDate' ? value : prev.receivedDate;
            if (rType && rDate) newData.deadline = calculateDeadline(rType, rDate);
        }
        return newData;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.code || !formData.customerName || !formData.deadline || !formData.recordType) { 
        alert("Vui lòng điền các trường bắt buộc (*) và chọn Loại hồ sơ"); 
        return; 
    }
    setLoading(true);
    const newRecord: RecordFile = { ...formData, id: Math.random().toString(36).substr(2, 9), status: RecordStatus.RECEIVED } as RecordFile;
    const success = await onSave(newRecord);
    setLoading(false);
    if (success) alert(`Đã tiếp nhận hồ sơ: ${newRecord.code}`);
    else alert("Lỗi khi lưu hồ sơ.");
  };

  const handleResetForm = () => {
      const today = new Date().toISOString().split('T')[0];
      setFormData({ code: '', customerName: '', phoneNumber: '', cccd: '', authorizedBy: '', authDocType: '', otherDocs: '', content: '', receivedDate: today, deadline: '', ward: '', landPlot: '', mapSheet: '', area: 0, address: '', recordType: '', status: RecordStatus.RECEIVED });
  };

  const handlePreviewDocx = async () => {
    if (!formData.code || !formData.customerName) { alert("Vui lòng nhập ít nhất Mã hồ sơ và Tên khách hàng để in."); return; }
    if (!hasTemplate(STORAGE_KEYS.RECEIPT_TEMPLATE)) {
        if(confirm('Bạn chưa tải lên mẫu Biên Nhận (.docx). Bạn có muốn cấu hình ngay không?')) {
            setTemplateType('receipt');
            setIsTemplateModalOpen(true);
        }
        return;
    }

    setIsProcessing(true); // Loading...

    const rDate = formData.receivedDate ? new Date(formData.receivedDate) : new Date();
    const dDate = formData.deadline ? new Date(formData.deadline) : new Date();
    
    // --- TÍNH TOÁN SỐ LIỆU ĐỂ IN ---
    let standardDays = "30"; 
    const rType = (formData.recordType || '').toLowerCase();
    
    if (rType.includes('trích lục')) standardDays = "10";
    else if (rType.includes('trích đo chỉnh lý')) standardDays = "15";
    else if (rType.includes('trích đo') || rType.includes('đo đạc') || rType.includes('cắm mốc')) standardDays = "30";

    let tp1Value = 'Phiếu yêu cầu';
    if (rType.includes('chỉnh lý') || rType.includes('trích đo') || rType.includes('trích lục')) {
        tp1Value = 'Phiếu yêu cầu trích lục, trích đo';
    } 
    else if (rType.includes('đo đạc') || rType.includes('cắm mốc')) {
        tp1Value = 'Phiếu yêu cầu Đo đạc, cắm mốc';
    }

    if (formData.ward) {
        tp1Value += ` tại ${getNormalizedWard(formData.ward || '')}`;
    }

    // --- LOGIC TỰ ĐỘNG SDTLH (SỐ ĐIỆN THOẠI LIÊN HỆ) ---
    let sdtLienHe = "";
    const wRaw = (formData.ward || "").toLowerCase();
    if (wRaw.includes("minh hưng") || wRaw.includes("minh hung")) {
        sdtLienHe = "Nhân viên phụ trách Nguyễn Thìn Trung: 0886 385 757";
    } else if (wRaw.includes("nha bích") || wRaw.includes("nha bich")) {
        sdtLienHe = "Nhân viên phụ trách Lê Văn Hạnh: 0919 334 344";
    } else if (wRaw.includes("chơn thành") || wRaw.includes("chon thanh")) {
        sdtLienHe = "Nhân viên phụ trách Phạm Hoài Sơn: 0972 219 691";
    }

    const dayRec = rDate.getDate().toString().padStart(2, '0');
    const monthRec = (rDate.getMonth() + 1).toString().padStart(2, '0');
    const yearRec = rDate.getFullYear();
    const dateFullString = `ngày ${dayRec} tháng ${monthRec} năm ${yearRec}`;

    const dayDead = dDate.getDate().toString().padStart(2, '0');
    const monthDead = (dDate.getMonth() + 1).toString().padStart(2, '0');
    const yearDead = dDate.getFullYear();
    const deadlineFullString = `ngày ${dayDead} tháng ${monthDead} năm ${yearDead}`;

    const val = (v: any) => (v === undefined || v === null) ? "" : String(v);

    const printData = {
        code: val(formData.code), 
        customerName: val(formData.customerName), 
        receivedDate: rDate.toLocaleDateString('vi-VN'), 
        deadline: dDate.toLocaleDateString('vi-VN'), 
        currentUser: val(currentUser.name), 
        phoneNumber: val(formData.phoneNumber), 
        cccd: val(formData.cccd), 
        content: val(formData.content), 
        address: val(formData.address || getNormalizedWard(formData.ward)), 
        ward: val(getNormalizedWard(formData.ward)), 
        landPlot: val(formData.landPlot), 
        mapSheet: val(formData.mapSheet), 
        area: val(formData.area), 
        recordType: val(formData.recordType), 
        otherDocs: val(formData.otherDocs), 
        authorizedBy: val(formData.authorizedBy), 
        authDocType: val(formData.authDocType),

        MA: val(formData.code), 
        SO_HS: val(formData.code), 
        MA_HO_SO: val(formData.code),
        
        // TỰ ĐỘNG VIẾT HOA TÊN NGƯỜI
        TEN: val(formData.customerName).toUpperCase(), 
        HO_TEN: val(formData.customerName).toUpperCase(), 
        KHACH_HANG: val(formData.customerName).toUpperCase(), 
        CHU_SU_DUNG: val(formData.customerName).toUpperCase(),
        TEN_CHU_SU_DUNG: val(formData.customerName).toUpperCase(),
        
        NGAY_NHAN: rDate.toLocaleDateString('vi-VN'), 
        NGAY_NHAN_FULL: dateFullString,
        NGAY: dayRec,
        THANG: monthRec,
        NAM: yearRec,
        NGAYNHAN: dateFullString, 
        NGAY_THANG_NAM: dateFullString, 

        HEN_TRA: dDate.toLocaleDateString('vi-VN'), 
        NGAY_HEN: dDate.toLocaleDateString('vi-VN'), 
        HEN_TRA_FULL: deadlineFullString,
        NGAY_HEN_FULL: deadlineFullString,
        
        NGUOI_NHAN: val(currentUser.name), 
        CAN_BO: val(currentUser.name), 
        CAN_BO_TIEP_NHAN: val(currentUser.name),
        
        SDT: val(formData.phoneNumber), 
        DIEN_THOAI: val(formData.phoneNumber), 
        SO_DIEN_THOAI: val(formData.phoneNumber),
        CCCD: val(formData.cccd), 
        CMND: val(formData.cccd), 
        SO_GIAY_TO: val(formData.cccd),
        
        NOI_DUNG: val(formData.content), 
        TRICH_YEU: val(formData.content),
        DIA_CHI: val(formData.address || getNormalizedWard(formData.ward)), 
        DC: val(formData.address || getNormalizedWard(formData.ward)), 
        DIA_CHI_CHI_TIET: val(formData.address), 
        DC_CT: val(formData.address), 
        DIA_CHI_THUA_DAT: val(formData.address),
        XA: val(getNormalizedWard(formData.ward)), 
        PHUONG: val(getNormalizedWard(formData.ward)), 
        XAPHUONG: val(getNormalizedWard(formData.ward)), 
        TO: val(formData.mapSheet), 
        SO_TO: val(formData.mapSheet),
        THUA: val(formData.landPlot), 
        SO_THUA: val(formData.landPlot),
        DT: val(formData.area), 
        DIEN_TICH: val(formData.area), 
        LOAI_HS: val(formData.recordType), 
        LOAI_HO_SO: val(formData.recordType),
        GIAY_TO_KHAC: val(formData.otherDocs), 
        TAI_LIEU_KEM_THEO: val(formData.otherDocs),
        
        NGUOI_UY_QUYEN: val(formData.authorizedBy).toUpperCase(), 
        UY_QUYEN: val(formData.authorizedBy).toUpperCase(), 
        NGUOI_DUOC_UY_QUYEN: val(formData.authorizedBy).toUpperCase(), 
        LOAI_UY_QUYEN: val(formData.authDocType), 
        LOAI_GIAY_TO_UY_QUYEN: val(formData.authDocType), 
        GIAY_UY_QUYEN: val(formData.authDocType), 
        
        TGTRA: standardDays,
        SO_NGAY: standardDays,
        THOI_GIAN_GIAI_QUYET: standardDays,
        TP1: tp1Value,
        TIEU_DE: tp1Value,

        // SỐ ĐIỆN THOẠI LIÊN HỆ THEO XÃ (MỚI)
        SDTLH: sdtLienHe,

        // ĐỊA DANH HÀNH CHÍNH
        TINH: "Bình Phước",
        HUYEN: "thị xã Chơn Thành"
    };
    
    // Dùng Async function để hỗ trợ tải từ URL
    const blob = await generateDocxBlobAsync(STORAGE_KEYS.RECEIPT_TEMPLATE, printData);
    
    setIsProcessing(false);

    if (blob) { setPreviewBlob(blob); setPreviewFileName(`BienNhan_${formData.code}`); setIsPreviewOpen(true); }
  };

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
      });
  }, [records, filterDate, filterWard, searchTerm]);

  const createDailyListWorkbook = () => {
      if (filteredDailyRecords.length === 0) return null;

      const wardTitle = filterWard !== 'all' ? filterWard.toUpperCase() : "TOÀN BỘ CÁC XÃ/PHƯỜNG";
      const dateParts = filterDate.split('-'); 
      const dateStr = `NGÀY ${dateParts[2]} THÁNG ${dateParts[1]} NĂM ${dateParts[0]}`;

      const tableHeader = ["STT", "Mã Hồ Sơ", "Chủ Sử Dụng", "Địa Chỉ", "Loại Hồ Sơ", "Hẹn Trả", "Ghi Chú"];
      
      const dataRows = filteredDailyRecords.map((r, i) => [
          i + 1,
          r.code,
          r.customerName,
          r.address || getNormalizedWard(r.ward),
          getShortRecordType(r.recordType), 
          r.deadline ? new Date(r.deadline).toLocaleDateString('vi-VN') : '',
          r.content
      ]);

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([]);

      const styles = {
          nationalTitle: { font: { name: "Times New Roman", sz: 12, bold: true }, alignment: { horizontal: "center" } },
          nationalSlogan: { font: { name: "Times New Roman", sz: 12, bold: true, underline: true }, alignment: { horizontal: "center" } },
          reportTitle: { font: { name: "Times New Roman", sz: 14, bold: true }, alignment: { horizontal: "center" } },
          reportSubTitle: { font: { name: "Times New Roman", sz: 12, italic: true }, alignment: { horizontal: "center" } },
          header: { 
              font: { name: "Times New Roman", sz: 11, bold: true }, 
              border: { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } }, 
              fill: { fgColor: { rgb: "E0E0E0" } }, 
              alignment: { horizontal: "center", vertical: "center", wrapText: true } 
          },
          cell: { 
              font: { name: "Times New Roman", sz: 11 }, 
              border: { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } },
              alignment: { vertical: "center", wrapText: true }
          },
          cellCenter: {
              font: { name: "Times New Roman", sz: 11 }, 
              border: { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } },
              alignment: { horizontal: "center", vertical: "center", wrapText: true }
          },
          footerTitle: { font: { name: "Times New Roman", sz: 11, bold: true }, alignment: { horizontal: "center" } },
          footerNote: { font: { name: "Times New Roman", sz: 11, italic: true }, alignment: { horizontal: "center" } }
      };

      XLSX.utils.sheet_add_aoa(ws, [
          ["CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM"], 
          ["Độc lập - Tự do - Hạnh phúc"],         
          [""],                                    
          ["DANH SÁCH TIẾP NHẬN HỒ SƠ"],           
          [wardTitle],                             
          [dateStr],                               
          tableHeader                              
      ], { origin: "A1" });

      XLSX.utils.sheet_add_aoa(ws, dataRows, { origin: "A8" });

      const lastRow = 7 + dataRows.length; 
      const footerStart = lastRow + 2;

      XLSX.utils.sheet_add_aoa(ws, [
          ["BÊN GIAO", "", "", "", "BÊN NHẬN"],
          ["(Ký ghi rõ họ tên)", "", "", "", "(Ký ghi rõ họ tên)"]
      ], { origin: `A${footerStart + 1}` });

      ws['!merges'] = [
          { s: { r: 0, c: 0 }, e: { r: 0, c: 6 } }, 
          { s: { r: 1, c: 0 }, e: { r: 1, c: 6 } }, 
          { s: { r: 3, c: 0 }, e: { r: 3, c: 6 } }, 
          { s: { r: 4, c: 0 }, e: { r: 4, c: 6 } }, 
          { s: { r: 5, c: 0 }, e: { r: 5, c: 6 } }, 
          { s: { r: footerStart, c: 0 }, e: { r: footerStart, c: 2 } },     
          { s: { r: footerStart + 1, c: 0 }, e: { r: footerStart + 1, c: 2 } },
          { s: { r: footerStart, c: 4 }, e: { r: footerStart, c: 6 } },     
          { s: { r: footerStart + 1, c: 4 }, e: { r: footerStart + 1, c: 6 } },
      ];

      ws['!cols'] = [
          { wch: 5 }, { wch: 15 }, { wch: 22 }, { wch: 25 }, { wch: 20 }, { wch: 12 }, { wch: 15 }
      ];

      if(ws['A1']) ws['A1'].s = styles.nationalTitle;
      if(ws['A2']) ws['A2'].s = styles.nationalSlogan;
      if(ws['A4']) ws['A4'].s = styles.reportTitle;
      if(ws['A5']) ws['A5'].s = styles.reportSubTitle;
      if(ws['A6']) ws['A6'].s = styles.reportSubTitle;

      for(let c=0; c<=6; c++) { 
          const ref = XLSX.utils.encode_cell({r: 6, c: c}); 
          if(!ws[ref]) ws[ref] = { v: "", t: "s"}; 
          ws[ref].s = styles.header; 
      }
      for(let r=7; r < 7 + dataRows.length; r++) { 
          for(let c=0; c<=6; c++) { 
              const ref = XLSX.utils.encode_cell({r: r, c: c}); 
              if(!ws[ref]) ws[ref] = { v: "", t: "s"}; 
              
              if(c === 0 || c === 5) ws[ref].s = styles.cellCenter; 
              else ws[ref].s = styles.cell; 
          } 
      }

      const leftTitle = XLSX.utils.encode_cell({r: footerStart, c: 0});
      const leftNote = XLSX.utils.encode_cell({r: footerStart + 1, c: 0});
      const rightTitle = XLSX.utils.encode_cell({r: footerStart, c: 4});
      const rightNote = XLSX.utils.encode_cell({r: footerStart + 1, c: 4});

      if(ws[leftTitle]) ws[leftTitle].s = styles.footerTitle;
      if(ws[leftNote]) ws[leftNote].s = styles.footerNote;
      if(ws[rightTitle]) ws[rightTitle].s = styles.footerTitle;
      if(ws[rightNote]) ws[rightNote].s = styles.footerNote;

      XLSX.utils.book_append_sheet(wb, ws, "Danh Sach");
      return wb;
  };

  const handleExportDailyList = () => {
      const wb = createDailyListWorkbook();
      if (!wb) { alert("Không có hồ sơ nào trong ngày này để xuất."); return; }
      
      const fileName = `DS_Tiep_Nhan_${filterDate.replace(/-/g, '')}.xlsx`;
      XLSX.writeFile(wb, fileName);
  };

  const handlePreviewDailyList = () => {
      const wb = createDailyListWorkbook();
      if (!wb) { alert("Không có hồ sơ nào trong ngày này để xem."); return; }
      
      setPreviewWorkbook(wb);
      setPreviewExcelName(`DS_Tiep_Nhan_${filterDate.replace(/-/g, '')}`);
      setIsExcelPreviewOpen(true);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col h-full animate-fade-in-up overflow-hidden">
      {/* HEADER WITH TABS - FIXED */}
      <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-blue-50/50 shrink-0 z-10 relative">
        <div className="flex items-center gap-4">
            <div className="flex bg-white p-1 rounded-lg border border-gray-200">
                <button onClick={() => setViewMode('create')} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${viewMode === 'create' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'}`}>
                    <PlusCircle size={16} /> Nhập mới
                </button>
                <button onClick={() => setViewMode('list')} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${viewMode === 'list' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'}`}>
                    <LayoutList size={16} /> Danh sách hôm nay
                </button>
            </div>
        </div>
        
        {viewMode === 'create' && (
            <div className="flex gap-2">
                <button onClick={() => { setTemplateType('receipt'); setIsTemplateModalOpen(true); }} className="text-sm text-gray-600 bg-white px-3 py-1.5 rounded-lg border border-gray-300 shadow-sm hover:bg-gray-50 flex items-center gap-1">
                    <Settings size={14} /> Mẫu In
                </button>
                <button onClick={handleResetForm} className="text-sm text-gray-600 hover:text-blue-800 flex items-center gap-1 bg-white px-3 py-1.5 rounded-lg border border-gray-300 shadow-sm">
                    <RotateCcw size={14} /> Làm mới
                </button>
                <button onClick={handlePreviewDocx} disabled={isProcessing} className="text-sm text-blue-700 bg-blue-100 px-3 py-1.5 rounded-lg border border-blue-200 shadow-sm hover:bg-blue-200 flex items-center gap-1 font-semibold disabled:opacity-50">
                    {isProcessing ? <Loader2 size={14} className="animate-spin" /> : <Eye size={14} />} 
                    {isProcessing ? 'Đang tải...' : 'Xem & In'}
                </button>
            </div>
        )}
      </div>

      {/* CONTENT - SCROLLABLE with min-h-0 */}
      <div className="flex-1 overflow-y-auto p-6 min-h-0">
        {viewMode === 'create' ? (
            /* --- FORM NHẬP LIỆU --- */
            <form onSubmit={handleSubmit} className="max-w-6xl mx-auto space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* CỘT 1 */}
                    <div className="space-y-6">
                        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                            <h3 className="text-sm font-bold text-blue-800 uppercase mb-4 flex items-center gap-2 border-b pb-2"><UserIcon size={16} /> Người nộp hồ sơ</h3>
                            <div className="space-y-4">
                                <div> <label className="block text-sm font-semibold text-gray-700 mb-1">Họ tên chủ sử dụng <span className="text-red-500">*</span></label> <input type="text" required className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none" value={formData.customerName} onChange={(e) => handleChange('customerName', e.target.value)} /> </div>
                                <div> <label className="block text-sm font-medium text-gray-700 mb-1">Số điện thoại</label> <input type="text" className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none" value={formData.phoneNumber} onChange={(e) => handleChange('phoneNumber', e.target.value)} /> </div>
                                <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Ủy quyền (Nếu có)</label>
                                    <div className="space-y-3">
                                        <select className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" value={formData.authDocType} onChange={(e) => handleChange('authDocType', e.target.value)}> <option value="">-- Loại giấy tờ --</option> <option value="Hợp đồng ủy quyền">Hợp đồng ủy quyền</option> <option value="Giấy ủy quyền">Giấy ủy quyền</option> </select>
                                        <input type="text" placeholder="Người được ủy quyền..." className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" value={formData.authorizedBy} onChange={(e) => handleChange('authorizedBy', e.target.value)} />
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                            <h3 className="text-sm font-bold text-purple-800 uppercase mb-4 flex items-center gap-2 border-b pb-2"><Calendar size={16} /> Thời gian xử lý</h3>
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div> <label className="block text-sm font-medium text-gray-700 mb-1">Ngày nhận</label> <input type="date" required className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none" value={formData.receivedDate} onChange={(e) => handleChange('receivedDate', e.target.value)} /> </div>
                                    <div> <label className="block text-sm font-medium text-gray-700 mb-1">Hẹn trả <span className="text-red-500">*</span></label> <input type="date" required className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none font-semibold text-blue-700 bg-blue-50" value={formData.deadline} onChange={(e) => handleChange('deadline', e.target.value)} /> </div>
                                </div>
                                <p className="text-[10px] text-gray-500 italic mt-1 bg-gray-50 p-2 rounded"> * Hạn trả được tính theo số ngày làm việc (trừ Chủ Nhật và Ngày Lễ). </p>
                                <div> <label className="block text-sm font-medium text-gray-700 mb-1">Mã hồ sơ (Tự động)</label> <input type="text" readOnly className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-gray-100 text-gray-500 font-mono" value={formData.code} /> </div>
                            </div>
                        </div>
                    </div>
                    {/* CỘT 2 */}
                    <div className="space-y-6">
                        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm h-full">
                            <h3 className="text-sm font-bold text-green-700 uppercase mb-4 flex items-center gap-2 border-b pb-2"><MapPin size={16} /> Vị trí & Thửa đất</h3>
                            <div className="space-y-4">
                                <div> <label className="block text-sm font-medium text-gray-700 mb-1">Xã / Phường <span className="text-red-500">*</span></label> <input list="wards-list-receive" className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 outline-none" value={formData.ward} onChange={(e) => handleChange('ward', e.target.value)} placeholder="Chọn xã..." /> <datalist id="wards-list-receive"> {wards.map(w => <option key={w} value={w} />)} </datalist> </div>
                                <div> <label className="block text-sm font-medium text-gray-700 mb-1">Địa chỉ đất chi tiết</label> <input type="text" className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none" value={formData.address} onChange={(e) => handleChange('address', e.target.value)} /> </div>
                                <div className="grid grid-cols-3 gap-3">
                                    <div> <label className="block text-xs font-medium text-gray-500 mb-1">Tờ bản đồ</label> <input type="text" className="w-full border border-gray-300 rounded-lg px-2 py-2 text-center font-semibold" value={formData.mapSheet} onChange={(e) => handleChange('mapSheet', e.target.value)} /> </div>
                                    <div> <label className="block text-xs font-medium text-gray-500 mb-1">Thửa đất</label> <input type="text" className="w-full border border-gray-300 rounded-lg px-2 py-2 text-center font-semibold" value={formData.landPlot} onChange={(e) => handleChange('landPlot', e.target.value)} /> </div>
                                    <div> <label className="block text-xs font-medium text-gray-500 mb-1">Diện tích (m2)</label> <input type="number" className="w-full border border-gray-300 rounded-lg px-2 py-2 text-center" value={formData.area} onChange={(e) => handleChange('area', e.target.value)} /> </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    {/* CỘT 3 */}
                    <div className="space-y-6">
                        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                            <h3 className="text-sm font-bold text-gray-700 uppercase mb-4 flex items-center gap-2 border-b pb-2"><FileCheck size={16} /> Nội dung yêu cầu</h3>
                            <div className="space-y-4">
                                <div> 
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Loại hồ sơ <span className="text-red-500">*</span></label> 
                                    <select className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none" value={formData.recordType} onChange={(e) => handleChange('recordType', e.target.value)}> 
                                        <option value="">-- Chọn loại hồ sơ --</option>
                                        {RECORD_TYPES.map(t => <option key={t} value={t}>{t}</option>)} 
                                    </select> 
                                </div>
                                <div> <label className="block text-sm font-medium text-gray-700 mb-1">Nội dung chi tiết</label> <textarea rows={4} className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none resize-none" value={formData.content} onChange={(e) => handleChange('content', e.target.value)} placeholder="Nhập nội dung..." /> </div>
                                <div> <label className="block text-sm font-medium text-gray-700 mb-1">Giấy tờ kèm theo</label> <input type="text" className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none" value={formData.otherDocs} onChange={(e) => handleChange('otherDocs', e.target.value)} placeholder="Sổ đỏ, CMND..." /> </div>
                            </div>
                        </div>
                        <button type="submit" disabled={loading} className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-blue-600 text-white rounded-xl hover:bg-blue-700 shadow-lg font-bold text-lg transition-all active:scale-95 disabled:opacity-70"> <Save size={20} /> {loading ? 'Đang lưu...' : 'Lưu Hồ Sơ'} </button>
                    </div>
                </div>
            </form>
        ) : (
            /* --- DANH SÁCH MỚI TIẾP NHẬN --- */
            <div className="flex flex-col h-full space-y-4">
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-wrap items-center gap-4 shrink-0">
                    <div className="flex items-center gap-2"> <label className="text-sm font-medium text-gray-600">Ngày nhận:</label> <input type="date" className="border border-gray-300 rounded px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-blue-500" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} /> </div>
                    <div className="flex items-center gap-2"> <label className="text-sm font-medium text-gray-600">Xã / Phường:</label> <select className="border border-gray-300 rounded px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-blue-500" value={filterWard} onChange={(e) => setFilterWard(e.target.value)}> <option value="all">-- Tất cả --</option> {wards.map(w => <option key={w} value={w}>{w}</option>)} </select> </div>
                    <div className="relative flex-1 max-w-sm"> <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} /> <input type="text" placeholder="Tìm kiếm..." className="w-full pl-9 pr-4 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /> </div>
                    <div className="ml-auto flex gap-2">
                        <button onClick={handlePreviewDailyList} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 shadow-sm text-sm font-medium"> <Eye size={16} /> Xem & In </button>
                        <button onClick={handleExportDailyList} className="flex items-center gap-2 bg-white text-green-600 border border-green-200 px-4 py-2 rounded-md hover:bg-green-50 shadow-sm text-sm font-medium"> <FileSpreadsheet size={16} /> Tải Excel </button>
                    </div>
                </div>
                <div className="flex-1 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col min-h-0">
                    <div className="overflow-auto flex-1">
                        <table className="w-full text-left table-fixed min-w-[1000px]">
                            <thead className="bg-gray-50 text-xs text-gray-600 uppercase font-bold sticky top-0 shadow-sm">
                                <tr> 
                                    <th className="p-4 w-12 text-center">STT</th> 
                                    <th className="p-4 w-[120px]">Mã Hồ Sơ</th> 
                                    <th className="p-4 w-[200px]">Chủ Sử Dụng</th> 
                                    <th className="p-4 w-[200px]">Địa chỉ / Xã Phường</th> 
                                    {/* THU HẸP CỘT LOẠI HỒ SƠ */}
                                    <th className="p-4 w-[130px]">Loại Hồ Sơ</th> 
                                    <th className="p-4 text-center w-[120px]">Hẹn Trả</th> 
                                    <th className="p-4 w-[200px]">Ghi Chú</th> 
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 text-sm">
                                {filteredDailyRecords.length > 0 ? (
                                    filteredDailyRecords.map((r, index) => (
                                        <tr key={r.id} className="hover:bg-blue-50/50">
                                            <td className="p-4 text-center text-gray-400 align-middle">{index + 1}</td> 
                                            <td className="p-4 font-medium text-blue-600 truncate align-middle" title={r.code}>{r.code}</td> 
                                            <td className="p-4 font-medium text-gray-800 truncate align-middle" title={r.customerName}>{r.customerName}</td> 
                                            <td className="p-4 text-gray-600 truncate align-middle" title={r.address ? `${r.address}, ${getNormalizedWard(r.ward)}` : getNormalizedWard(r.ward)}>{r.address ? `${r.address}, ${getNormalizedWard(r.ward)}` : getNormalizedWard(r.ward)}</td> 
                                            <td className="p-4 text-gray-600 truncate align-middle" title={r.recordType}>{getShortRecordType(r.recordType)}</td> 
                                            <td className="p-4 text-center text-blue-700 font-medium align-middle">{r.deadline ? new Date(r.deadline).toLocaleDateString('vi-VN') : '-'}</td> 
                                            <td className="p-4 text-gray-500 italic truncate align-middle" title={r.content}>{r.content}</td>
                                        </tr>
                                    ))
                                ) : ( <tr><td colSpan={7} className="p-8 text-center text-gray-400 italic"> Không có hồ sơ nào trong ngày này. </td></tr> )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        )}
      </div>

      <TemplateConfigModal isOpen={isTemplateModalOpen} onClose={() => setIsTemplateModalOpen(false)} type={templateType as any} />
      <DocxPreviewModal isOpen={isPreviewOpen} onClose={() => setIsPreviewOpen(false)} docxBlob={previewBlob} fileName={previewFileName} />
      <ExcelPreviewModal isOpen={isExcelPreviewOpen} onClose={() => setIsExcelPreviewOpen(false)} workbook={previewWorkbook} fileName={previewExcelName} />
    </div>
  );
};

export default ReceiveRecord;
