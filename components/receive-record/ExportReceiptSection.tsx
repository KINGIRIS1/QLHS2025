import React, { useState, useMemo, useEffect } from 'react';
import * as XLSX from 'xlsx-js-style';
import saveAs from 'file-saver';
import JSZip from 'jszip';
import { RecordFile, UserRole, Employee } from '../../types';
import { Search, Printer, FileSpreadsheet, FileText, CheckSquare, Square, Eye, Calendar, MapPin, Filter, ShieldCheck, Download, AlertCircle, Loader2 } from 'lucide-react';
import { getNormalizedWard, getShortRecordType, getFullWard } from '../../constants';
import { showToast, getReceivingWard } from '../../utils/appHelpers';
import SystemReceiptTemplate from '../SystemReceiptTemplate';
import DocxPreviewModal from '../DocxPreviewModal';
import { generateDocxBlobAsync, STORAGE_KEYS, hasTemplate } from '../../services/docxService';
import { fetchContactSettingsCached, getContactInfo, ContactSettings, DEFAULT_CONTACT_SETTINGS } from '../../services/apiSystem';

interface ExportReceiptSectionProps {
  records: RecordFile[];
  wards: string[];
  currentUser: any;
  employees?: Employee[];
  onPrint?: (record: RecordFile) => void;
}

export const ExportReceiptSection: React.FC<ExportReceiptSectionProps> = ({
  records,
  wards,
  currentUser,
  employees = [],
  onPrint
}) => {
  const isAdmin = currentUser?.role === UserRole.ADMIN;

  // Contact settings for receipt phone contact
  const [contactSettings, setContactSettings] = useState<ContactSettings>(DEFAULT_CONTACT_SETTINGS);

  useEffect(() => {
    fetchContactSettingsCached()
      .then(setContactSettings)
      .catch(err => console.error("Lỗi tải contact settings:", err));
  }, []);

  // Filter States
  const [dateMode, setDateMode] = useState<'single' | 'range' | 'all'>('all');
  const [singleDate, setSingleDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [filterWard, setFilterWard] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Receipt Preview Modal State
  const [activeReceiptRecord, setActiveReceiptRecord] = useState<RecordFile | null>(null);

  // DOCX Preview Modal State
  const [docxPreviewOpen, setDocxPreviewOpen] = useState(false);
  const [docxPreviewBlob, setDocxPreviewBlob] = useState<Blob | null>(null);
  const [docxPreviewFileName, setDocxPreviewFileName] = useState('');

  // Processing State for Docx Export
  const [isExportingDocx, setIsExportingDocx] = useState(false);

  // Pagination State
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(20);

  // Distinct Record Types for Filter
  const availableRecordTypes = useMemo(() => {
    const types = new Set<string>();
    records.forEach(r => {
      if (r.recordType) types.add(r.recordType);
    });
    return Array.from(types).sort();
  }, [records]);

  // Filtered records
  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      // Date filter
      if (dateMode === 'single') {
        if (r.receivedDate !== singleDate) return false;
      } else if (dateMode === 'range') {
        if (fromDate && r.receivedDate && r.receivedDate < fromDate) return false;
        if (toDate && r.receivedDate && r.receivedDate > toDate) return false;
      }

      // Ward filter
      if (filterWard !== 'all') {
        if (getNormalizedWard(r.ward) !== getNormalizedWard(filterWard)) return false;
      }

      // Type filter
      if (filterType !== 'all') {
        if (r.recordType !== filterType) return false;
      }

      // Search keyword
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase().trim();
        const matchCode = (r.code || '').toLowerCase().includes(term);
        const matchName = (r.customerName || '').toLowerCase().includes(term);
        const matchPhone = (r.phoneNumber || '').toLowerCase().includes(term);
        const matchCccd = (r.cccd || '').toLowerCase().includes(term);
        const matchAddress = (r.address || '').toLowerCase().includes(term);
        const matchLand = (r.landPlot || '').toLowerCase().includes(term) || (r.mapSheet || '').toLowerCase().includes(term);
        if (!matchCode && !matchName && !matchPhone && !matchCccd && !matchAddress && !matchLand) {
          return false;
        }
      }

      return true;
    });
  }, [records, dateMode, singleDate, fromDate, toDate, filterWard, filterType, searchTerm]);

  // Select All / Deselect All
  const isAllSelected = useMemo(() => {
    if (filteredRecords.length === 0) return false;
    return filteredRecords.every(r => selectedIds.has(r.id));
  }, [filteredRecords, selectedIds]);

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds(new Set());
    } else {
      const nextSet = new Set<string>();
      filteredRecords.forEach(r => nextSet.add(r.id));
      setSelectedIds(nextSet);
    }
  };

  const handleToggleSelectRow = (id: string) => {
    const nextSet = new Set(selectedIds);
    if (nextSet.has(id)) {
      nextSet.delete(id);
    } else {
      nextSet.add(id);
    }
    setSelectedIds(nextSet);
  };

  // Paginated Data
  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredRecords.slice(start, start + itemsPerPage);
  }, [filteredRecords, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredRecords.length / itemsPerPage) || 1;

  // Selected Records array
  const selectedRecordsList = useMemo(() => {
    return filteredRecords.filter(r => selectedIds.has(r.id));
  }, [filteredRecords, selectedIds]);

  // Helper mapping function to build full printData for receipt docx
  const buildReceiptPrintData = (record: Partial<RecordFile>) => {
    const rDate = record.receivedDate ? new Date(record.receivedDate) : new Date();
    const dDate = record.deadline ? new Date(record.deadline) : new Date();

    let standardDays = "30"; 
    const rType = (record.recordType || '').toLowerCase();
    const isHienDat = rType.includes('hiến đất') || rType.includes('hien dat');
    const isThamDinh = rType.includes('thẩm định') || rType.includes('tham dinh');
    if (isHienDat) standardDays = "8";
    else if (isThamDinh) standardDays = "30";
    else if (rType.includes('thuế chính quy')) standardDays = "15";
    else if (rType.includes('cung cấp thông tin') || rType.includes('sao lục') || rType.includes('trích lục')) standardDays = "10";
    else if (rType.includes('trích đo chỉnh lý')) standardDays = "15";
    else if (rType.includes('trích đo') || rType.includes('đo đạc') || rType.includes('cắm mốc')) standardDays = "30";

    let tp1Value = 'Phiếu yêu cầu';
    if (rType.includes('thuế chính quy')) {
        tp1Value = 'Tờ khai thuế';
    } else if (rType.includes('cung cấp thông tin') || rType.includes('sao lục')) {
        tp1Value = 'Phiếu yêu cầu cung cấp thông tin';
    } else if (rType.includes('chỉnh lý') || rType.includes('trích đo') || rType.includes('trích lục')) {
        tp1Value = 'Phiếu yêu cầu trích lục, trích đo';
    } else if (rType.includes('đo đạc') || rType.includes('cắm mốc')) {
        tp1Value = 'Phiếu yêu cầu Đo đạc, cắm mốc';
    }

    const sdtLienHe = getContactInfo(contactSettings, record.ward || "", rType);

    const dayRec = rDate.getDate().toString().padStart(2, '0');
    const monthRec = (rDate.getMonth() + 1).toString().padStart(2, '0');
    const yearRec = rDate.getFullYear();
    const dateFullString = `ngày ${dayRec} tháng ${monthRec} năm ${yearRec}`;
    const dateShortString = `${dayRec}/${monthRec}/${yearRec}`;
    
    const dayDead = dDate.getDate().toString().padStart(2, '0');
    const monthDead = (dDate.getMonth() + 1).toString().padStart(2, '0');
    const yearDead = dDate.getFullYear();
    const deadlineFullString = `ngày ${dayDead} tháng ${monthDead} năm ${yearDead}`;
    const deadlineShortString = `${dayDead}/${monthDead}/${yearDead}`;

    const val = (v: any) => (v === undefined || v === null) ? "" : String(v);

    const donViWard = employees.find(e => e.id === currentUser?.employeeId)?.managedWards?.[0] || 'chơn thành';

    return {
        code: val(record.code),
        customerName: val(record.customerName),
        landPlot: val(record.landPlot),
        mapSheet: val(record.mapSheet),
        DON_VI_TIEP_NHAN: val(getFullWard(donViWard)).toUpperCase(),
        
        XAPHUONG: val(getNormalizedWard(record.ward)),
        NGAYNHAN: dateFullString,
        NGAY_NHAN: dateShortString, 
        LOAI_GIAY_TO_UY_QUYEN: val(record.authDocType),
        DIA_CHI_CHI_TIET: val(record.address),

        MA: val(record.code), 
        SO_HS: val(record.code), 
        MA_HO_SO: val(record.code),
        CODE: val(record.code),

        TEN: val(record.customerName).toUpperCase(), 
        HO_TEN: val(record.customerName).toUpperCase(),
        CHU_SU_DUNG: val(record.customerName).toUpperCase(),
        KHACH_HANG: val(record.customerName).toUpperCase(),
        ONG_BA: val(record.customerName).toUpperCase(), 

        SDT: val(record.phoneNumber), 
        DIEN_THOAI: val(record.phoneNumber),
        PHONE: val(record.phoneNumber),

        CCCD: val(record.cccd), 
        CMND: val(record.cccd),

        DIA_CHI: val(record.address || getFullWard(record.ward)),
        DC: val(record.address || getFullWard(record.ward)),
        ADDRESS: val(record.address || getFullWard(record.ward)),
        XA: val(getFullWard(record.ward)).toUpperCase(), 
        PHUONG: val(getFullWard(record.ward)).toUpperCase(),
        WARD: val(getFullWard(record.ward)).toUpperCase(),
        
        TO: val(record.mapSheet), 
        SO_TO: val(record.mapSheet),
        THUA: val(record.landPlot), 
        SO_THUA: val(record.landPlot),
        DT: val(record.area), 
        DIEN_TICH: val(record.area),
        
        NGAY_NHAN_FULL: dateFullString,
        NGAY: dayRec, 
        THANG: monthRec, 
        NAM: yearRec,
        RECEIVED_DATE: dateShortString,
        
        HEN_TRA: deadlineShortString, 
        NGAY_HEN: deadlineShortString,
        DEADLINE: deadlineShortString,
        HEN_TRA_FULL: deadlineFullString,
        NGAY_HEN_FULL: deadlineFullString,
        
        NGUOI_NHAN: val(currentUser?.name), 
        CAN_BO: val(currentUser?.name),
        USER: val(currentUser?.name),
        
        NOI_DUNG: val(record.content),
        CONTENT: val(record.content),
        LOAI_HS: isHienDat ? 'Hiến đất - Đối với trường hợp tặng cho đất cho Nhà nước hoặc cộng đồng dân cư hoặc mở rộng đường giao thông.' : isThamDinh ? 'Kiểm tra, thẩm định bản trích đo địa chính.' : val(record.recordType), 
        RECORD_TYPE: isHienDat ? 'Hiến đất - Đối với trường hợp tặng cho đất cho Nhà nước hoặc cộng đồng dân cư hoặc mở rộng đường giao thông.' : isThamDinh ? 'Kiểm tra, thẩm định bản trích đo địa chính.' : val(record.recordType),
        GIAY_TO_KHAC: val(record.otherDocs),
        
        NGUOI_UY_QUYEN: val(record.authorizedBy).toUpperCase(),
        UY_QUYEN: val(record.authorizedBy).toUpperCase(),
        LOAI_UY_QUYEN: val(record.authDocType),
        
        TGTRA: standardDays, 
        SO_NGAY: standardDays,
        TP1: tp1Value, 
        TIEU_DE: tp1Value,
        SDTLH: sdtLienHe, 
        TINH: "Bình Phước", 
        HUYEN: "thị xã Chơn Thành",
        NHAN_KET_QUA_TAI: `Trung tâm Phục vụ Hành chính công ${getFullWard(donViWard).replace(/^Phường /i, 'phường ').replace(/^Xã /i, 'xã ')}`
    };
  };

  // Single Record DOCX Download
  const handleDownloadSingleDocx = async (record: RecordFile) => {
    try {
      const printData = buildReceiptPrintData(record);
      const blob = await generateDocxBlobAsync(STORAGE_KEYS.RECEIPT_TEMPLATE, printData);
      if (blob) {
        saveAs(blob, `BienNhan_${record.code || record.id}.docx`);
        showToast(`Đã xuất file Word biên nhận ${record.code} thành công!`, "success");
      }
    } catch (error: any) {
      console.error("Lỗi xuất DOCX:", error);
      showToast(`Không thể tạo file DOCX: ${error.message}`, "error");
    }
  };

  // Preview DOCX in Modal
  const handlePreviewSingleDocx = async (record: RecordFile) => {
    try {
      const printData = buildReceiptPrintData(record);
      const blob = await generateDocxBlobAsync(STORAGE_KEYS.RECEIPT_TEMPLATE, printData);
      if (blob) {
        setDocxPreviewBlob(blob);
        setDocxPreviewFileName(`BienNhan_${record.code || record.id}.docx`);
        setDocxPreviewOpen(true);
      }
    } catch (error: any) {
      console.error("Lỗi xem trước DOCX:", error);
      showToast(`Không thể xem trước DOCX: ${error.message}`, "error");
    }
  };

  // Batch DOCX Export
  const handleBatchExportDocx = async () => {
    const listToExport = selectedRecordsList.length > 0 ? selectedRecordsList : filteredRecords;
    if (listToExport.length === 0) {
      showToast("Không có hồ sơ nào được chọn để xuất DOCX!", "error");
      return;
    }

    setIsExportingDocx(true);
    try {
      if (listToExport.length === 1) {
        // Just export single docx
        await handleDownloadSingleDocx(listToExport[0]);
      } else {
        // Zip multiple docx files
        const zip = new JSZip();
        let successCount = 0;

        for (let i = 0; i < listToExport.length; i++) {
          const r = listToExport[i];
          const printData = buildReceiptPrintData(r);
          const blob = await generateDocxBlobAsync(STORAGE_KEYS.RECEIPT_TEMPLATE, printData);
          if (blob) {
            const fileName = `BienNhan_${r.code ? r.code.replace(/[\/\\?%*:|"<>]/g, '_') : i + 1}.docx`;
            zip.file(fileName, blob);
            successCount++;
          }
        }

        if (successCount > 0) {
          const content = await zip.generateAsync({ type: 'blob' });
          saveAs(content, `Danh_Sach_Bien_Nhan_Docx_${new Date().toISOString().split('T')[0]}.zip`);
          showToast(`Đã nén và xuất ${successCount} file Word biên nhận (.zip) thành công!`, "success");
        } else {
          showToast("Không thể xuất file Word nào!", "error");
        }
      }
    } catch (error: any) {
      console.error("Lỗi xuất hàng loạt DOCX:", error);
      showToast(`Lỗi khi xuất danh sách DOCX: ${error.message}`, "error");
    } finally {
      setIsExportingDocx(false);
    }
  };

  // Handle Export Excel for Receipts
  const handleExportReceiptExcel = () => {
    const listToExport = selectedRecordsList.length > 0 ? selectedRecordsList : filteredRecords;
    if (listToExport.length === 0) {
      showToast("Không có hồ sơ nào để xuất biên nhận Excel!", "error");
      return;
    }

    const wb = XLSX.utils.book_new();
    const headers = ["STT", "Mã Hồ Sơ", "Chủ Sử Dụng", "SĐT", "CCCD/CMND", "Ngày Nhận", "Hẹn Trả", "Địa Bàn (Xã/Phường)", "Tờ BD", "Thửa Đất", "Diện Tích", "Loại Hồ Sơ", "Ủy Quyền", "Địa Chỉ Chi Tiết", "Nội Dung Ghi Chú"];

    const wsData: any[][] = [
      ["CHI NHÁNH VĂN PHÒNG ĐĂNG KÝ ĐẤT ĐAI THỊ XÃ CHƠN THÀNH"],
      ["BẢNG KÊ DANH SÁCH BIÊN NHẬN HỒ SƠ"],
      [`Ngày xuất báo cáo: ${new Date().toLocaleDateString('vi-VN')} | Tổng số hồ sơ: ${listToExport.length}`],
      [],
      headers
    ];

    listToExport.forEach((r, idx) => {
      wsData.push([
        idx + 1,
        r.code || '',
        r.customerName || '',
        r.phoneNumber || '',
        r.cccd || '',
        r.receivedDate ? new Date(r.receivedDate).toLocaleDateString('vi-VN') : '',
        r.deadline ? new Date(r.deadline).toLocaleDateString('vi-VN') : '',
        r.ward || '',
        r.mapSheet || '',
        r.landPlot || '',
        r.area || 0,
        r.recordType || '',
        r.authorizedBy ? `${r.authorizedBy} (${r.authDocType || 'Ủy quyền'})` : 'Không',
        r.address || '',
        r.content || ''
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Styling
    const titleStyle = { font: { name: "Times New Roman", sz: 14, bold: true }, alignment: { horizontal: "center" } };
    const subTitleStyle = { font: { name: "Times New Roman", sz: 11, italic: true }, alignment: { horizontal: "center" } };
    const headerStyle = { font: { name: "Times New Roman", sz: 11, bold: true, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "1E40AF" } }, alignment: { horizontal: "center", vertical: "center" }, border: { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } } };
    const cellStyle = { font: { name: "Times New Roman", sz: 11 }, border: { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } } };

    ws['!cols'] = [
      { wch: 6 },   // STT
      { wch: 18 },  // Mã HS
      { wch: 25 },  // Chủ sử dụng
      { wch: 14 },  // SĐT
      { wch: 16 },  // CCCD
      { wch: 14 },  // Ngày nhận
      { wch: 14 },  // Hẹn trả
      { wch: 18 },  // Xã phường
      { wch: 10 },  // Tờ
      { wch: 10 },  // Thửa
      { wch: 12 },  // Diện tích
      { wch: 28 },  // Loại HS
      { wch: 25 },  // Ủy quyền
      { wch: 30 },  // Địa chỉ
      { wch: 30 }   // Ghi chú
    ];

    ws['A1'].s = titleStyle;
    ws['A2'].s = titleStyle;
    ws['A3'].s = subTitleStyle;

    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 14 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 14 } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: 14 } }
    ];

    // Format headers
    for (let col = 0; col < headers.length; col++) {
      const cellRef = XLSX.utils.encode_cell({ r: 4, c: col });
      if (ws[cellRef]) ws[cellRef].s = headerStyle;
    }

    // Format data rows
    for (let row = 5; row < wsData.length; row++) {
      for (let col = 0; col < headers.length; col++) {
        const cellRef = XLSX.utils.encode_cell({ r: row, c: col });
        if (ws[cellRef]) ws[cellRef].s = cellStyle;
      }
    }

    XLSX.utils.book_append_sheet(wb, ws, "Danh_Sach_Bien_Nhan");
    XLSX.writeFile(wb, `DS_Bien_Nhan_Admin_${new Date().toISOString().split('T')[0]}.xlsx`);
    showToast(`Đã xuất danh sách biên nhận ${listToExport.length} hồ sơ thành công!`, "success");
  };

  // Print selected receipts (using System Receipt Template or Callback)
  const handlePrintSelectedReceipts = () => {
    const listToPrint = selectedRecordsList.length > 0 ? selectedRecordsList : filteredRecords;
    if (listToPrint.length === 0) {
      showToast("Vui lòng chọn ít nhất 1 hồ sơ để in biên nhận!", "error");
      return;
    }
    if (onPrint) {
      listToPrint.forEach(r => onPrint(r));
    } else {
      setActiveReceiptRecord(listToPrint[0]);
    }
  };

  if (!isAdmin) {
    return (
      <div className="p-8 text-center bg-red-50 rounded-2xl border border-red-200 text-red-700 space-y-3 max-w-lg mx-auto my-12 shadow-sm">
        <AlertCircle size={48} className="mx-auto text-red-500 animate-bounce" />
        <h3 className="text-lg font-bold">TRUY CẬP BỊ TỪ CHỐI</h3>
        <p className="text-sm font-medium">
          Chức năng Xuất biên nhận hàng loạt dành riêng cho Quản trị viên (ADMIN).
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full space-y-4 text-gray-800 animate-fade-in">
      {/* HEADER BAR */}
      <div className="bg-gradient-to-r from-amber-600 to-amber-700 text-white p-4 rounded-2xl shadow-md flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-white/10 backdrop-blur-sm rounded-xl">
            <Printer size={24} className="text-amber-100" />
          </div>
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2">
              QUẢN LÝ VÀ XUẤT BIÊN NHẬN HỒ SƠ (WORD DOCX & EXCEL)
              <span className="text-xs bg-amber-900/50 text-amber-200 border border-amber-400/30 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                Dành cho Admin
              </span>
            </h2>
            <p className="text-xs text-amber-100">
              Tra cứu, xuất file Word (.docx), bảng kê Excel và in biên nhận hàng loạt
            </p>
          </div>
        </div>

        {/* BATCH ACTION BUTTONS */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Export Docx Button */}
          <button
            onClick={handleBatchExportDocx}
            disabled={isExportingDocx}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold px-4 py-2 rounded-xl text-sm transition-all shadow border border-blue-400/30 active:scale-95"
            title="Tải về file Word (.docx) biên nhận của các hồ sơ đã chọn (tự động nén .zip nếu chọn nhiều)"
          >
            {isExportingDocx ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <FileText size={16} />
            )}
            <span>Xuất Word (.docx) {selectedIds.size > 0 ? `(${selectedIds.size})` : `(${filteredRecords.length})`}</span>
          </button>

          {/* Export Excel Button */}
          <button
            onClick={handleExportReceiptExcel}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded-xl text-sm transition-all shadow border border-emerald-500/30 active:scale-95"
            title="Xuất bảng kê Excel các biên nhận đã chọn"
          >
            <FileSpreadsheet size={16} />
            <span>Xuất Excel ({selectedIds.size > 0 ? selectedIds.size : filteredRecords.length})</span>
          </button>

          {/* Print / Preview Button */}
          <button
            onClick={handlePrintSelectedReceipts}
            className="flex items-center gap-2 bg-white text-amber-800 hover:bg-amber-50 font-bold px-4 py-2 rounded-xl text-sm transition-all shadow border border-amber-200 active:scale-95"
            title="In / Xem Biên nhận"
          >
            <Printer size={16} className="text-amber-600" />
            <span>In / Xem ({selectedIds.size > 0 ? selectedIds.size : 'Tất cả'})</span>
          </button>
        </div>
      </div>

      {/* FILTERS */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Date Filter */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1">
              <Calendar size={13} className="text-amber-600" /> Chế độ lọc ngày
            </label>
            <select
              className="w-full border border-slate-300 rounded-xl px-3 py-1.5 text-sm font-semibold bg-slate-50/50 outline-none focus:ring-2 focus:ring-amber-500"
              value={dateMode}
              onChange={(e) => setDateMode(e.target.value as any)}
            >
              <option value="all">Tất cả ngày nhận</option>
              <option value="single">Một ngày cụ thể</option>
              <option value="range">Khoảng ngày (Từ - Đến)</option>
            </select>
          </div>

          {/* Date Picker Input */}
          {dateMode === 'single' && (
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase">Chọn Ngày Nhận</label>
              <input
                type="date"
                className="w-full border border-slate-300 rounded-xl px-3 py-1.5 text-sm font-semibold bg-white outline-none focus:ring-2 focus:ring-amber-500"
                value={singleDate}
                onChange={(e) => setSingleDate(e.target.value)}
              />
            </div>
          )}

          {dateMode === 'range' && (
            <>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Từ Ngày</label>
                <input
                  type="date"
                  className="w-full border border-slate-300 rounded-xl px-3 py-1.5 text-sm font-semibold bg-white outline-none focus:ring-2 focus:ring-amber-500"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Đến Ngày</label>
                <input
                  type="date"
                  className="w-full border border-slate-300 rounded-xl px-3 py-1.5 text-sm font-semibold bg-white outline-none focus:ring-2 focus:ring-amber-500"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                />
              </div>
            </>
          )}

          {/* Ward Filter */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1">
              <MapPin size={13} className="text-amber-600" /> Đơn vị (Xã/Phường)
            </label>
            <select
              className="w-full border border-slate-300 rounded-xl px-3 py-1.5 text-sm font-semibold bg-slate-50/50 outline-none focus:ring-2 focus:ring-amber-500"
              value={filterWard}
              onChange={(e) => setFilterWard(e.target.value)}
            >
              <option value="all">-- Tất cả xã/phường --</option>
              {wards.map(w => (
                <option key={w} value={w}>{w}</option>
              ))}
            </select>
          </div>

          {/* Record Type Filter */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1">
              <Filter size={13} className="text-amber-600" /> Loại Hồ Sơ
            </label>
            <select
              className="w-full border border-slate-300 rounded-xl px-3 py-1.5 text-sm font-semibold bg-slate-50/50 outline-none focus:ring-2 focus:ring-amber-500"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
            >
              <option value="all">-- Tất cả loại hồ sơ --</option>
              {availableRecordTypes.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Search Term Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Tìm theo mã hồ sơ, tên chủ sử dụng, SĐT, CCCD, tờ/thửa, địa chỉ..."
            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-amber-500 bg-slate-50/30 hover:bg-white transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* SELECTION BAR & STATS */}
      <div className="bg-amber-50/60 border border-amber-200/80 px-4 py-3 rounded-xl flex items-center justify-between text-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={handleToggleSelectAll}
            className="flex items-center gap-1.5 font-bold text-amber-800 hover:text-amber-900 transition-colors"
          >
            {isAllSelected ? <CheckSquare size={18} className="text-amber-600" /> : <Square size={18} className="text-slate-400" />}
            <span>{isAllSelected ? 'Bỏ chọn tất cả' : 'Chọn tất cả màn hình'}</span>
          </button>

          <span className="text-slate-400">|</span>

          <span className="font-semibold text-slate-700">
            Tổng cộng: <strong className="text-amber-700">{filteredRecords.length}</strong> hồ sơ
          </span>

          {selectedIds.size > 0 && (
            <span className="bg-amber-600 text-white font-bold px-2.5 py-0.5 rounded-full text-xs shadow-sm">
              Đã chọn: {selectedIds.size}
            </span>
          )}
        </div>

        {selectedIds.size > 0 && (
          <button
            onClick={() => setSelectedIds(new Set())}
            className="text-xs font-bold text-slate-500 hover:text-amber-700 underline"
          >
            Bỏ chọn ({selectedIds.size})
          </button>
        )}
      </div>

      {/* DATA TABLE */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex-1 flex flex-col">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left border-collapse min-w-[1100px]">
            <thead>
              <tr className="bg-slate-100/80 text-slate-700 text-xs font-bold uppercase tracking-wider border-b border-slate-200">
                <th className="p-3 w-10 text-center">
                  <button onClick={handleToggleSelectAll}>
                    {isAllSelected ? <CheckSquare size={16} className="text-amber-600" /> : <Square size={16} className="text-slate-400" />}
                  </button>
                </th>
                <th className="p-3 w-12 text-center">STT</th>
                <th className="p-3 w-36">Mã Hồ Sơ</th>
                <th className="p-3">Chủ Sử Dụng / SĐT</th>
                <th className="p-3 w-28 text-center">Tờ / Thửa</th>
                <th className="p-3 w-36">Xã / Phường</th>
                <th className="p-3 w-40">Loại Hồ Sơ</th>
                <th className="p-3 w-28 text-center">Ngày Nhận</th>
                <th className="p-3 w-28 text-center">Hẹn Trả</th>
                <th className="p-3 w-40 text-center">Xuất Biên Nhận</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {paginatedRecords.length > 0 ? (
                paginatedRecords.map((r, idx) => {
                  const isSelected = selectedIds.has(r.id);
                  return (
                    <tr
                      key={r.id}
                      className={`hover:bg-amber-50/40 transition-colors group ${isSelected ? 'bg-amber-50/70' : ''}`}
                    >
                      <td className="p-3 text-center align-middle">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelectRow(r.id)}
                          className="w-4 h-4 text-amber-600 rounded cursor-pointer accent-amber-600"
                        />
                      </td>
                      <td className="p-3 text-center text-slate-400 font-mono text-xs align-middle font-medium">
                        {(currentPage - 1) * itemsPerPage + idx + 1}
                      </td>
                      <td className="p-3 font-bold text-amber-700 font-mono text-xs align-middle">
                        {r.code}
                      </td>
                      <td className="p-3 align-middle">
                        <div className="font-bold text-slate-800">{r.customerName}</div>
                        {r.phoneNumber && (
                          <div className="text-xs text-slate-500 font-mono">SĐT: {r.phoneNumber}</div>
                        )}
                        {r.cccd && (
                          <div className="text-[11px] text-slate-400 font-mono">CCCD: {r.cccd}</div>
                        )}
                      </td>
                      <td className="p-3 text-center font-mono text-xs font-semibold text-slate-700 align-middle">
                        {r.mapSheet || '-'}/{r.landPlot || '-'}
                      </td>
                      <td className="p-3 font-medium text-slate-700 align-middle text-xs">
                        {getNormalizedWard(r.ward)}
                      </td>
                      <td className="p-3 align-middle">
                        <span className="inline-block px-2 py-0.5 rounded text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
                          {getShortRecordType(r.recordType)}
                        </span>
                      </td>
                      <td className="p-3 text-center font-medium text-slate-600 text-xs align-middle">
                        {r.receivedDate ? new Date(r.receivedDate).toLocaleDateString('vi-VN') : '-'}
                      </td>
                      <td className="p-3 text-center font-bold text-amber-700 text-xs align-middle">
                        {r.deadline ? new Date(r.deadline).toLocaleDateString('vi-VN') : '-'}
                      </td>
                      <td className="p-3 text-center align-middle">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Single DOCX Download */}
                          <button
                            onClick={() => handleDownloadSingleDocx(r)}
                            className="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg border border-blue-200 font-bold text-xs flex items-center justify-center gap-1 transition-all shadow-sm"
                            title="Tải file Word (.docx) biên nhận"
                          >
                            <Download size={14} /> Docx
                          </button>

                          {/* Single DOCX Preview / Print */}
                          <button
                            onClick={() => handlePreviewSingleDocx(r)}
                            className="p-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg border border-amber-200 font-bold text-xs flex items-center justify-center gap-1 transition-all shadow-sm"
                            title="Xem trước và in biên nhận"
                          >
                            <Printer size={14} /> In
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-slate-400 italic">
                    Không tìm thấy hồ sơ nào khớp với bộ lọc biên nhận.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* PAGINATION */}
        {totalPages > 1 && (
          <div className="p-3 border-t border-slate-200 flex items-center justify-between bg-slate-50/80 shrink-0 text-xs">
            <span className="text-slate-500 font-medium">
              Hiển thị {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, filteredRecords.length)} / {filteredRecords.length} hồ sơ
            </span>
            <div className="flex gap-1">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 rounded-lg border border-slate-300 bg-white font-medium disabled:opacity-50 hover:bg-slate-100"
              >
                Trước
              </button>
              <span className="px-3 py-1 font-bold text-slate-700 flex items-center">
                Trang {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1 rounded-lg border border-slate-300 bg-white font-medium disabled:opacity-50 hover:bg-slate-100"
              >
                Sau
              </button>
            </div>
          </div>
        )}
      </div>

      {/* SYSTEM RECEIPT MODAL */}
      {activeReceiptRecord && (
        <SystemReceiptTemplate
          data={activeReceiptRecord}
          receivingWard={getReceivingWard(activeReceiptRecord)}
          onClose={() => setActiveReceiptRecord(null)}
        />
      )}

      {/* DOCX PREVIEW MODAL */}
      {docxPreviewOpen && (
        <DocxPreviewModal
          isOpen={docxPreviewOpen}
          onClose={() => setDocxPreviewOpen(false)}
          docxBlob={docxPreviewBlob}
          fileName={docxPreviewFileName}
        />
      )}
    </div>
  );
};

export default ExportReceiptSection;

