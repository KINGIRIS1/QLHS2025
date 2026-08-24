import React, { useState, useEffect, useMemo, useRef } from 'react';
import { User, UserRole } from '../../types';
import { ArchiveRecord, fetchWarehouseRecordsPaginated, saveArchiveRecord, deleteArchiveRecord, importArchiveRecords, initRealtimeArchive, importSingleWarehouseRecord, mapFromWarehouseRecord } from '../../services/apiArchive';
import { supabase } from '../../services/supabaseClient';
import { Search, Plus, Trash2, Edit, Save, X, Eye, Calendar, FileSpreadsheet, Loader2, Download, AlertCircle, RefreshCw, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, SlidersHorizontal, BookOpen, Layers, Archive, HardDrive, CheckCircle2, User as UserIcon, FileText, Upload, Camera, Check } from 'lucide-react';
import { confirmAction } from '../../utils/appHelpers';
import * as XLSX from 'xlsx-js-style';

const WARD_MAPPING: Record<string, string> = {
    '25432': 'Hưng Long',
    '25433': 'Thành Tâm',
    '25435': 'Minh Lập',
    '25439': 'Quang Minh',
    '25441': 'Minh Hưng',
    '25444': 'Minh Long',
    '25447': 'Minh Thành',
    '25450': 'Nha Bích',
    '25453': 'Minh Thắng'
};

const getWardName = (maxa: any): string => {
    if (!maxa) return '-';
    const code = String(maxa).trim();
    return WARD_MAPPING[code] || code;
};

interface WarehouseViewProps {
    currentUser: User;
}

const WarehouseView: React.FC<WarehouseViewProps> = ({ currentUser }) => {
    const [records, setRecords] = useState<ArchiveRecord[]>([]);
    const [totalRecords, setTotalRecords] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const searchTerm = ''; // Loại bỏ tìm kiếm nhanh, dùng hằng số rỗng để tương thích ngược
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 15;

    // Bộ lọc tìm kiếm nâng cao (Advanced Search) - Trạng thái thực tế dùng truy vấn API
    const [advMaBienNhan, setAdvMaBienNhan] = useState('');
    const [advLoaiHoSo, setAdvLoaiHoSo] = useState('');
    const [advChuSuDung, setAdvChuSuDung] = useState('');
    const [advCccd, setAdvCccd] = useState('');
    const [advToBando, setAdvToBando] = useState('');
    const [advSoThua, setAdvSoThua] = useState('');
    const [advSoPhatHanh, setAdvSoPhatHanh] = useState('');
    const [advSoVaoSo, setAdvSoVaoSo] = useState('');
    const [advXaPhuong, setAdvXaPhuong] = useState('');

    // Trạng thái tạm thời (Temporary States) để lưu trữ khi gõ phím
    const [tempAdvMaBienNhan, setTempAdvMaBienNhan] = useState('');
    const [tempAdvLoaiHoSo, setTempAdvLoaiHoSo] = useState('');
    const [tempAdvChuSuDung, setTempAdvChuSuDung] = useState('');
    const [tempAdvCccd, setTempAdvCccd] = useState('');
    const [tempAdvToBando, setTempAdvToBando] = useState('');
    const [tempAdvSoThua, setTempAdvSoThua] = useState('');
    const [tempAdvSoPhatHanh, setTempAdvSoPhatHanh] = useState('');
    const [tempAdvSoVaoSo, setTempAdvSoVaoSo] = useState('');
    const [tempAdvXaPhuong, setTempAdvXaPhuong] = useState('');

    // Hàm thực thi tìm kiếm nâng cao (Copy giá trị từ temp sang chính thức để gọi API)
    const handleExecuteAdvancedSearch = () => {
        setAdvMaBienNhan(tempAdvMaBienNhan);
        setAdvLoaiHoSo(tempAdvLoaiHoSo);
        setAdvChuSuDung(tempAdvChuSuDung);
        setAdvCccd(tempAdvCccd);
        setAdvToBando(tempAdvToBando);
        setAdvSoThua(tempAdvSoThua);
        setAdvSoPhatHanh(tempAdvSoPhatHanh);
        setAdvSoVaoSo(tempAdvSoVaoSo);
        setAdvXaPhuong(tempAdvXaPhuong);
        setCurrentPage(1);
    };

    // Hàm lắng nghe phím Enter trên các trường tìm kiếm nâng cao
    const handleKeyDownAdvanced = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleExecuteAdvancedSearch();
        }
    };

    // State chi tiết & Chỉnh sửa hồ sơ
    const [selectedRecord, setSelectedRecord] = useState<ArchiveRecord | null>(null);
    const [isDetailOpen, setIsDetailOpen] = useState(false);
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [editFormData, setEditFormData] = useState<Partial<ArchiveRecord>>({});

    // Chụp hình nhanh chi tiết hồ sơ
    const [isCapturing, setIsCapturing] = useState(false);
    const [captureSuccess, setCaptureSuccess] = useState(false);
    const detailModalRef = useRef<HTMLDivElement>(null);

    const handleCaptureScreenshot = async () => {
        if (!detailModalRef.current) return;
        setIsCapturing(true);
        try {
            const html2canvas = (await import('html2canvas')).default;
            const canvas = await html2canvas(detailModalRef.current, {
                scale: 2,
                useCORS: true,
                allowTaint: true,
                backgroundColor: '#ffffff'
            });
            
            const fileName = `Ho_So_Kho_${selectedRecord?.data?.sophathanhgcnmoi || selectedRecord?.so_hieu || 'Chi_Tiet'}.png`;

            // Tải ảnh xuống thiết bị
            const dataUrl = canvas.toDataURL('image/png');
            const link = document.createElement('a');
            link.download = fileName;
            link.href = dataUrl;
            link.click();

            // Thử sao chép ảnh vào Clipboard nếu trình duyệt hỗ trợ
            canvas.toBlob(async (blob) => {
                if (blob && navigator.clipboard && window.ClipboardItem) {
                    try {
                        await navigator.clipboard.write([
                            new ClipboardItem({ 'image/png': blob })
                        ]);
                    } catch {
                        // Bỏ qua nếu môi trường iframe hạn chế quyền clipboard
                    }
                }
            });

            setCaptureSuccess(true);
            setTimeout(() => setCaptureSuccess(false), 3000);
        } catch (err) {
            console.error('Lỗi khi chụp hình:', err);
            alert('Có lỗi khi chụp hình chi tiết hồ sơ.');
        } finally {
            setIsCapturing(false);
        }
    };

    // State cho quá trình import Excel nâng cao theo lô (batching) chống đơ RAM và API Timeout
    const [isImporting, setIsImporting] = useState(false);
    const [importProgress, setImportProgress] = useState(0);
    const [importTotal, setImportTotal] = useState(0);
    const [importSuccess, setImportSuccess] = useState(0);
    const [importErrors, setImportErrors] = useState(0);
    const [importCurrentBatch, setImportCurrentBatch] = useState(0);
    const [importTotalBatches, setImportTotalBatches] = useState(0);
    const [importStatusText, setImportStatusText] = useState('');
    const [showImportSummary, setShowImportSummary] = useState(false);
    const [failedImports, setFailedImports] = useState<{ rowNumber: number; data: any; errorReason: string }[]>([]);
    const importCancelRef = useRef(false);

    const fileInputRef = useRef<HTMLInputElement>(null);

    // State cho tính năng Tìm kiếm theo File Excel
    const [isExcelSearchOpen, setIsExcelSearchOpen] = useState(false);
    const [excelSearchFile, setExcelSearchFile] = useState<File | null>(null);
    const [excelHeaders, setExcelHeaders] = useState<string[]>([]);
    const [excelRows, setExcelRows] = useState<any[]>([]);
    const [columnMappings, setColumnMappings] = useState<Record<string, string>>({
        hoten1: '',
        socccd: '',
        tobando: '',
        sothua: '',
        sophathanhgcnmoi: '',
        so_hieu: '',
        loaihoso: '',
        sovaosomoi: '',
        maxa: ''
    });
    const [matchingMode, setMatchingMode] = useState<'AND' | 'OR'>('AND');
    const [isSearching, setIsSearching] = useState(false);
    const [searchProgress, setSearchProgress] = useState(0);
    const [searchFoundCount, setSearchFoundCount] = useState(0);
    const [searchCurrentRow, setSearchCurrentRow] = useState(0);
    const [searchResults, setSearchResults] = useState<{ excelRowIndex: number; originalRow: any; matchedRecord: ArchiveRecord }[]>([]);
    const [showSearchSummary, setShowSearchSummary] = useState(false);
    const [searchResultPage, setSearchResultPage] = useState(1);
    const searchResultItemsPerPage = 10;
    const searchCancelRef = useRef(false);
    const searchFileInputRef = useRef<HTMLInputElement>(null);

    // Hàm lấy danh sách tiêu đề từ Worksheet
    const getExcelHeaders = (sheet: XLSX.WorkSheet): string[] => {
        const headers: string[] = [];
        const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
        const R = range.s.r; // Dòng đầu tiên làm tiêu đề
        for (let C = range.s.c; C <= range.e.c; ++C) {
            const cell_ref = XLSX.utils.encode_cell({ r: R, c: C });
            const cell = sheet[cell_ref];
            if (cell && cell.t) {
                headers.push(String(cell.v).trim());
            } else {
                headers.push(`Cột ${C + 1}`);
            }
        }
        return headers;
    };

    // Hàm xử lý upload file Excel để tìm kiếm
    const handleExcelSearchUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setExcelSearchFile(file);
        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                
                // Đọc ra dạng mảng các dòng
                const rows = XLSX.utils.sheet_to_json<any>(ws);
                if (rows.length === 0) {
                    alert("Tệp Excel trống hoặc không có bản ghi nào!");
                    return;
                }

                const headers = getExcelHeaders(ws);
                setExcelHeaders(headers);
                setExcelRows(rows);

                // Ánh xạ cột thông minh tự động dựa trên từ khóa tiếng Việt
                const autoMappings: Record<string, string> = {
                    hoten1: '',
                    socccd: '',
                    tobando: '',
                    sothua: '',
                    sophathanhgcnmoi: '',
                    so_hieu: '',
                    loaihoso: '',
                    sovaosomoi: '',
                    maxa: ''
                };

                const lowercaseHeaders = headers.map(h => String(h).toLowerCase().trim());
                
                // Họ tên chủ sử dụng
                const nameIdx = lowercaseHeaders.findIndex(h => 
                    h.includes('họ tên') || h.includes('chủ sử dụng') || h.includes('hoten1') || 
                    h.includes('tên chủ') || h.includes('họ và tên') || h.includes('người sử dụng') || h.includes('ten_chu')
                );
                if (nameIdx !== -1) autoMappings['hoten1'] = headers[nameIdx];

                // Số CCCD
                const cccdIdx = lowercaseHeaders.findIndex(h => 
                    h.includes('cccd') || h.includes('cmnd') || h.includes('socccd') || 
                    h.includes('số cccd') || h.includes('số cmnd') || h.includes('căn cước')
                );
                if (cccdIdx !== -1) autoMappings['socccd'] = headers[cccdIdx];

                // Tờ bản đồ
                const toBandoIdx = lowercaseHeaders.findIndex(h => 
                    h.includes('tobando') || h.includes('tờ bản đồ') || h.includes('số tờ') || 
                    h.includes('tờ') || h.includes('bản đồ') || h.includes('to_bando')
                );
                if (toBandoIdx !== -1) autoMappings['tobando'] = headers[toBandoIdx];

                // Số thửa
                const soThuaIdx = lowercaseHeaders.findIndex(h => 
                    h.includes('sothua') || h.includes('số thửa') || h.includes('thửa') || 
                    h.includes('thửa đất') || h.includes('so_thua')
                );
                if (soThuaIdx !== -1) autoMappings['sothua'] = headers[soThuaIdx];

                // Số phát hành GCN
                const gcnIdx = lowercaseHeaders.findIndex(h => 
                    h.includes('sophathanh') || h.includes('gcn') || h.includes('số phát hành') || 
                    h.includes('số gcn') || h.includes('phát hành')
                );
                if (gcnIdx !== -1) autoMappings['sophathanhgcnmoi'] = headers[gcnIdx];

                // Mã biên nhận (Số hiệu)
                const soHieuIdx = lowercaseHeaders.findIndex(h => 
                    h.includes('biên nhận') || h.includes('số hiệu') || h.includes('mã hồ sơ') || 
                    h.includes('so_hieu') || h.includes('sohieu') || h.includes('mã bn') || h.includes('ma_bn')
                );
                if (soHieuIdx !== -1) autoMappings['so_hieu'] = headers[soHieuIdx];

                // Loại hồ sơ
                const loaiHsIdx = lowercaseHeaders.findIndex(h => 
                    h.includes('loại hồ sơ') || h.includes('loaihoso') || h.includes('loai_ho_so') || h.includes('loại hs')
                );
                if (loaiHsIdx !== -1) autoMappings['loaihoso'] = headers[loaiHsIdx];

                // Số vào sổ mới
                const soVaoSoIdx = lowercaseHeaders.findIndex(h => 
                    h.includes('vào sổ') || h.includes('sovaosomoi') || h.includes('so_vao_so') || h.includes('sovaoso')
                );
                if (soVaoSoIdx !== -1) autoMappings['sovaosomoi'] = headers[soVaoSoIdx];

                // Xã phường
                const maxaIdx = lowercaseHeaders.findIndex(h => 
                    h.includes('xã') || h.includes('phường') || h.includes('maxa') || h.includes('mã xã') || h.includes('ma_xa') || h.includes('địa bàn')
                );
                if (maxaIdx !== -1) autoMappings['maxa'] = headers[maxaIdx];

                setColumnMappings(autoMappings);
                setSearchResultPage(1);
            } catch (err) {
                console.error("Lỗi đọc Excel tìm kiếm:", err);
                alert("Không thể phân tích tệp Excel này!");
            }
        };
        reader.readAsBinaryString(file);
    };

    // Hàm thực thi Tìm kiếm theo lô song song trên Supabase
    const handleExcelSearch = async () => {
        if (!excelRows || excelRows.length === 0) {
            alert("Vui lòng tải tệp Excel lên trước!");
            return;
        }

        const activeMappings = Object.values(columnMappings).filter(Boolean);
        if (activeMappings.length === 0) {
            alert("Vui lòng ánh xạ ít nhất một trường thông tin để tìm kiếm!");
            return;
        }

        setIsSearching(true);
        setSearchProgress(0);
        setSearchFoundCount(0);
        setSearchCurrentRow(0);
        setShowSearchSummary(false);
        setSearchResultPage(1);
        searchCancelRef.current = false;

        const results: { excelRowIndex: number; originalRow: any; matchedRecord: ArchiveRecord }[] = [];
        const CONCURRENCY_LIMIT = 15; // Đẩy song song tối đa 15 truy vấn cùng lúc
        
        const nameCol = columnMappings['hoten1'];
        const cccdCol = columnMappings['socccd'];
        const toBandoCol = columnMappings['tobando'];
        const soThuaCol = columnMappings['sothua'];
        const gcnCol = columnMappings['sophathanhgcnmoi'];
        const soHieuCol = columnMappings['so_hieu'];
        const loaiHsCol = columnMappings['loaihoso'];
        const soVaoSoCol = columnMappings['sovaosomoi'];
        const maxaCol = columnMappings['maxa'];

        for (let i = 0; i < excelRows.length; i += CONCURRENCY_LIMIT) {
            if (searchCancelRef.current) break;

            const batch = excelRows.slice(i, i + CONCURRENCY_LIMIT);
            const promises = batch.map(async (row, idx) => {
                const excelRowIndex = i + idx + 2; // Dòng thực tế trong file Excel (Header là dòng 1, dòng dữ liệu đầu là dòng 2)
                
                const nameVal = nameCol && row[nameCol] !== undefined ? String(row[nameCol]).trim() : '';
                const cccdVal = cccdCol && row[cccdCol] !== undefined ? String(row[cccdCol]).trim() : '';
                const toBandoVal = toBandoCol && row[toBandoCol] !== undefined ? String(row[toBandoCol]).trim() : '';
                const soThuaVal = soThuaCol && row[soThuaCol] !== undefined ? String(row[soThuaCol]).trim() : '';
                const gcnVal = gcnCol && row[gcnCol] !== undefined ? String(row[gcnCol]).trim() : '';
                const soHieuVal = soHieuCol && row[soHieuCol] !== undefined ? String(row[soHieuCol]).trim() : '';
                const loaiHsVal = loaiHsCol && row[loaiHsCol] !== undefined ? String(row[loaiHsCol]).trim() : '';
                const soVaoSoVal = soVaoSoCol && row[soVaoSoCol] !== undefined ? String(row[soVaoSoCol]).trim() : '';
                const maxaVal = maxaCol && row[maxaCol] !== undefined ? String(row[maxaCol]).trim() : '';

                // Nếu tất cả các trường được ánh xạ của dòng này đều rỗng thì bỏ qua
                if (!nameVal && !cccdVal && !toBandoVal && !soThuaVal && !gcnVal && !soHieuVal && !loaiHsVal && !soVaoSoVal && !maxaVal) return;

                try {
                    let query = supabase.from('warehouse_records').select('*');
                    
                    if (matchingMode === 'AND') {
                        // Tìm trùng khớp tất cả các trường được điền
                        if (nameVal) query = query.ilike('hoten1', `%${nameVal}%`);
                        if (cccdVal) query = query.eq('socccd', cccdVal);
                        if (toBandoVal) query = query.eq('tobando', toBandoVal);
                        if (soThuaVal) query = query.eq('sothua', soThuaVal);
                        if (gcnVal) query = query.eq('sophathanhgcnmoi', gcnVal);
                        if (soHieuVal) query = query.ilike('so_hieu', `%${soHieuVal}%`);
                        if (loaiHsVal) query = query.ilike('loaihoso', `%${loaiHsVal}%`);
                        if (soVaoSoVal) query = query.eq('sovaosomoi', soVaoSoVal);
                        
                        if (maxaVal) {
                            let matchedCode = maxaVal;
                            const foundEntry = Object.entries(WARD_MAPPING).find(([code, name]) => 
                                name.toLowerCase().includes(maxaVal.toLowerCase()) || 
                                maxaVal.toLowerCase().includes(name.toLowerCase())
                            );
                            if (foundEntry) {
                                matchedCode = foundEntry[0];
                            }
                            query = query.eq('maxa', matchedCode);
                        }
                    } else {
                        // Tìm trùng khớp bất kỳ trường nào được điền (OR)
                        const orParts: string[] = [];
                        if (nameVal) orParts.push(`hoten1.ilike.%${nameVal}%`);
                        if (cccdVal) orParts.push(`socccd.eq.${cccdVal}`);
                        
                        // Ghép cặp tờ thửa trong OR để tìm kiếm chính xác mảnh đất hơn
                        if (toBandoVal && soThuaVal) {
                            orParts.push(`and(tobando.eq.${toBandoVal},sothua.eq.${soThuaVal})`);
                        } else {
                            if (toBandoVal) orParts.push(`tobando.eq.${toBandoVal}`);
                            if (soThuaVal) orParts.push(`sothua.eq.${soThuaVal}`);
                        }
                        
                        if (gcnVal) orParts.push(`sophathanhgcnmoi.eq.${gcnVal}`);
                        if (soHieuVal) orParts.push(`so_hieu.ilike.%${soHieuVal}%`);
                        if (loaiHsCol) orParts.push(`loaihoso.ilike.%${loaiHsVal}%`);
                        if (soVaoSoVal) orParts.push(`sovaosomoi.eq.${soVaoSoVal}`);
                        
                        if (maxaVal) {
                            let matchedCode = maxaVal;
                            const foundEntry = Object.entries(WARD_MAPPING).find(([code, name]) => 
                                name.toLowerCase().includes(maxaVal.toLowerCase()) || 
                                maxaVal.toLowerCase().includes(name.toLowerCase())
                            );
                            if (foundEntry) {
                                matchedCode = foundEntry[0];
                            }
                            orParts.push(`maxa.eq.${matchedCode}`);
                        }

                        if (orParts.length > 0) {
                            query = query.or(orParts.join(','));
                        } else {
                            return;
                        }
                    }

                    // Thực thi query tối ưu, giới hạn tối đa 50 kết quả cho 1 cụm tìm kiếm tránh nghẽn RAM
                    const { data, error } = await query.limit(50);
                    if (error) {
                        console.error(`Lỗi truy vấn dòng ${excelRowIndex}:`, error);
                    } else if (data && data.length > 0) {
                        data.forEach((wRecord: any) => {
                            const compatRecord = mapFromWarehouseRecord(wRecord);
                            results.push({
                                excelRowIndex,
                                originalRow: row,
                                matchedRecord: compatRecord
                            });
                        });
                    }
                } catch (err) {
                    console.error(`Ngoại lệ truy vấn dòng ${excelRowIndex}:`, err);
                }
            });

            await Promise.all(promises);

            const processedCount = Math.min(excelRows.length, i + batch.length);
            setSearchCurrentRow(processedCount);
            setSearchFoundCount(results.length);
            setSearchProgress(Math.min(100, Math.round((processedCount / excelRows.length) * 100)));
        }

        setSearchResults(results);
        setIsSearching(false);
        setShowSearchSummary(true);
    };

    // Hàm xuất báo cáo so sánh kết quả Tìm kiếm ra Excel
    const exportSearchResultsToExcel = () => {
        if (searchResults.length === 0) {
            alert("Không có kết quả tìm kiếm trùng khớp nào để xuất!");
            return;
        }

        const headers = [
            'Dòng Excel Gốc',
            ...excelHeaders,
            'Mã Biên Nhận (KHO)',
            'Xã Phường (KHO)',
            'Họ Tên Chủ 1 (KHO)',
            'CCCD Chủ 1 (KHO)',
            'Họ Tên Chủ 2 (KHO)',
            'CCCD Chủ 2 (KHO)',
            'Tờ Bản Đồ (KHO)',
            'Số Thửa (KHO)',
            'Diện Tích (KHO)',
            'Ngày Cấp GCN (KHO)',
            'Loại Hồ Sơ (KHO)',
            'Kệ/Tầng Lưu (KHO)',
            'Số Ô Lưu (KHO)',
            'Hộp/Tệp Lưu (KHO)',
            'STT Trong Hộp (KHO)',
            'Ghi Chú (KHO)'
        ];

        const dataRows = searchResults.map(item => {
            const origRow = item.originalRow || {};
            // Xuất tất cả các cột ban đầu trong file excel của người dùng
            const origValues = excelHeaders.map(h => origRow[h] !== undefined ? origRow[h] : '');
            
            const rec = item.matchedRecord || {};
            const d = rec.data || {};
            
            return [
                item.excelRowIndex,
                ...origValues,
                rec.so_hieu || '',
                getWardName(d.maxa),
                d.hoten1 || '',
                d.socccd || '',
                d.hoten2 || '',
                d.socccd2 || '',
                d.tobando || '',
                d.sothua || '',
                d.dientich || '',
                d.ngaycapgcnmoi || '',
                d.loaihoso || '',
                d.soke_tang || '',
                d.so_o || '',
                d.So_tep || d.so_tep || '',
                d.sott_tep || '',
                d.ghichu || ''
            ];
        });

        const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Ket_Qua_Tra_Cuu_Kho');

        // Điều chỉnh chiều rộng các cột một chút cho dễ đọc
        ws['!cols'] = [
            { wch: 15 }, // Dòng Excel Gốc
            ...excelHeaders.map(() => ({ wch: 15 })), // columns của file excel gốc
            { wch: 20 }, // Mã Biên Nhận
            { wch: 18 }, // Xã Phường
            { wch: 22 }, // Họ Tên Chủ 1
            { wch: 15 }, // CCCD Chủ 1
            { wch: 22 }, // Họ Tên Chủ 2
            { wch: 15 }, // CCCD Chủ 2
            { wch: 12 }, // Tờ Bản Đồ
            { wch: 12 }, // Số Thửa
            { wch: 12 }, // Diện Tích
            { wch: 18 }, // Ngày Cấp GCN
            { wch: 22 }, // Loại Hồ Sơ
            { wch: 15 }, // Kệ/Tầng Lưu
            { wch: 10 }, // Số Ô Lưu
            { wch: 12 }, // Hộp/Tệp Lưu
            { wch: 15 }, // STT Trong Hộp
            { wch: 20 }  // Ghi Chú
        ];

        XLSX.writeFile(wb, `Ket_Qua_Doi_Chieu_Kho_${Date.now().toString().slice(-6)}.xlsx`);
    };

    // Reset lại trạng thái Tìm kiếm
    const resetExcelSearch = () => {
        setExcelSearchFile(null);
        setExcelHeaders([]);
        setExcelRows([]);
        setColumnMappings({
            hoten1: '',
            socccd: '',
            tobando: '',
            sothua: '',
            sophathanhgcnmoi: '',
            so_hieu: '',
            loaihoso: '',
            sovaosomoi: '',
            maxa: ''
        });
        setMatchingMode('AND');
        setSearchProgress(0);
        setSearchFoundCount(0);
        setSearchCurrentRow(0);
        setSearchResults([]);
        setShowSearchSummary(false);
        setSearchResultPage(1);
        if (searchFileInputRef.current) {
            searchFileInputRef.current.value = '';
        }
    };

    // Dynamic load với cơ chế debounce 500ms tránh spam API (chỉ lắng nghe các biến chính thức)
    useEffect(() => {
        const timer = setTimeout(() => {
            loadData(currentPage);
        }, 500);

        return () => clearTimeout(timer);
    }, [currentPage, searchTerm, advMaBienNhan, advLoaiHoSo, advChuSuDung, advCccd, advToBando, advSoThua, advSoPhatHanh, advSoVaoSo, advXaPhuong]);

    useEffect(() => {
        initRealtimeArchive();

        const handleRealtimeUpdate = (e: any) => {
            if (e.detail?.type === 'kho') {
                loadData(currentPage);
            }
        };

        window.addEventListener('archive_realtime_update', handleRealtimeUpdate);
        return () => window.removeEventListener('archive_realtime_update', handleRealtimeUpdate);
    }, [currentPage]);

    const hasActiveFilter = useMemo(() => {
        return !!(
            searchTerm ||
            advMaBienNhan ||
            advLoaiHoSo ||
            advChuSuDung ||
            advCccd ||
            advToBando ||
            advSoThua ||
            advSoPhatHanh ||
            advSoVaoSo ||
            advXaPhuong
        );
    }, [searchTerm, advMaBienNhan, advLoaiHoSo, advChuSuDung, advCccd, advToBando, advSoThua, advSoPhatHanh, advSoVaoSo, advXaPhuong]);

    const loadData = async (pageToLoad: number = currentPage) => {
        if (!hasActiveFilter) {
            setRecords([]);
            setTotalRecords(0);
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        try {
            const data = await fetchWarehouseRecordsPaginated(pageToLoad, itemsPerPage, {
                searchTerm,
                advMaBienNhan,
                advLoaiHoSo,
                advChuSuDung,
                advCccd,
                advToBando,
                advSoThua,
                advSoPhatHanh,
                advSoVaoSo,
                advXaPhuong
            });
            setRecords(data.records);
            setTotalRecords(data.totalCount);
        } catch (error) {
            console.error("Lỗi khi tải dữ liệu kho:", error);
        } finally {
            setIsLoading(false);
        }
    };

    // Hàm xử lý khi Reset bộ lọc
    const handleResetFilters = () => {
        setAdvMaBienNhan('');
        setAdvLoaiHoSo('');
        setAdvChuSuDung('');
        setAdvCccd('');
        setAdvToBando('');
        setAdvSoThua('');
        setAdvSoPhatHanh('');
        setAdvSoVaoSo('');
        setAdvXaPhuong('');

        setTempAdvMaBienNhan('');
        setTempAdvLoaiHoSo('');
        setTempAdvChuSuDung('');
        setTempAdvCccd('');
        setTempAdvToBando('');
        setTempAdvSoThua('');
        setTempAdvSoPhatHanh('');
        setTempAdvSoVaoSo('');
        setTempAdvXaPhuong('');
        
        setCurrentPage(1);
    };

    const totalPages = Math.ceil(totalRecords / itemsPerPage) || 1;

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, advMaBienNhan, advLoaiHoSo, advChuSuDung, advCccd, advToBando, advSoThua, advSoPhatHanh, advSoVaoSo, advXaPhuong]);

    // Xóa hồ sơ
    const handleDelete = async (id: string, code: string) => {
        const confirmed = await confirmAction(`Xác nhận xóa hồ sơ có mã biên nhận: ${code}? Thao tác này không thể hoàn tác!`);
        if (!confirmed) return;

        setIsSubmitting(true);
        try {
            const success = await deleteArchiveRecord(id);
            if (success) {
                // Tải lại dữ liệu trang hiện tại
                loadData(currentPage);
                if (selectedRecord?.id === id) {
                    setSelectedRecord(null);
                    setIsDetailOpen(false);
                }
            } else {
                alert("Không thể xóa hồ sơ. Vui lòng thử lại!");
            }
        } catch (error) {
            console.error("Lỗi khi xóa hồ sơ:", error);
            alert("Đã xảy ra lỗi hệ thống khi xóa!");
        } finally {
            setIsSubmitting(false);
        }
    };

    // Lưu chỉnh sửa hồ sơ
    const handleSaveEdit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editFormData.id) return;

        setIsSubmitting(true);
        try {
            const updated = await saveArchiveRecord(editFormData);
            if (updated) {
                // Tải lại dữ liệu trang hiện tại để có phản ánh mới nhất
                loadData(currentPage);
                setSelectedRecord(updated);
                setIsEditOpen(false);
                alert("Cập nhật thông tin hồ sơ kho thành công!");
            } else {
                alert("Xảy ra lỗi khi cập nhật hồ sơ!");
            }
        } catch (error: any) {
            console.error("Lỗi cập nhật hồ sơ kho:", error);
            alert(error.message || "Đã xảy ra lỗi trong quá trình lưu trữ.");
        } finally {
            setIsSubmitting(false);
        }
    };

    // Mở modal Sửa
    const openEditModal = (record: ArchiveRecord) => {
        setEditFormData({
            ...record,
            data: { ...record.data }
        });
        setIsDetailOpen(false);
        setIsEditOpen(true);
    };

    // Nhập dữ liệu Excel thông minh hỗ trợ 300k dòng theo lô (batching) cực lớn
    const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        setImportStatusText("Đang mở tệp tin...");
        setIsImporting(true);
        setImportProgress(0);
        setImportSuccess(0);
        setImportErrors(0);
        setShowImportSummary(false);
        setFailedImports([]);
        importCancelRef.current = false;

        reader.onload = async (evt) => {
            try {
                setImportStatusText("Đang phân tích cấu trúc tệp Excel, vui lòng đợi...");
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                
                // Đọc tệp thành mảng JSON
                const rows = XLSX.utils.sheet_to_json<any>(ws);
                if (rows.length === 0) {
                    alert("Tệp Excel trống hoặc không đúng định dạng!");
                    setIsImporting(false);
                    return;
                }

                setImportTotal(rows.length);
                setImportStatusText(`Đang ánh xạ dữ liệu (${rows.length} dòng)...`);

                // Chuyển đổi dữ liệu và chuẩn hóa các cột
                const parsedRecords: Partial<ArchiveRecord>[] = rows.map((row: any, rIdx: number) => {
                    const uniqueSuffix = Math.floor(1000 + Math.random() * 9000);
                    const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
                    // Để bảo vệ an toàn 100% chống lỗi trùng mã 'so_hieu' UNIQUE trên DB (khi import tới 250k dòng sẽ có nhiều bản ghi trùng Số GCN),
                    // chúng ta sinh mã biên nhận duy nhất tuyệt đối bằng cách ghép hậu tố ngẫu nhiên và index dòng.
                    // Điều này giữ an toàn dữ liệu, cho phép lưu trữ toàn bộ các bản ghi trùng lặp và tăng tốc độ Bulk Insert lên mức tối đa!
                    const maBienNhan = row.sophathanhgcnmoi 
                        ? `${String(row.sophathanhgcnmoi).trim()}-${randomSuffix}-${rIdx}` 
                        : `KB-${Date.now().toString().slice(-6)}-${rIdx}-${uniqueSuffix}`;
                    const trichYeuValue = `Hồ sơ kho: ${row.hoten1 || ''} - Sổ thửa: ${row.sothua || ''} / Tờ bđ: ${row.tobando || ''}`;

                    const rowData: any = {};
                    const excelFields = [
                        'sott', 'loaihoso', 'hoten1', 'namsinh1', 'socccd', 'diachitt1',
                        'hoten2', 'namsinh2', 'socccd2', 'diachitt2', 'tobando',
                        'sothua', 'dientich', 'hinhthucsd', 'loaidato', 'dientichdato', 'maxa',
                        'manam', 'sophathanhgcnmoi', 'sovaosomoi', 'ngaycapgcnmoi', 'diachiap', 'soke_tang',
                        'so_o', 'So_tep', 'sott_tep', 'nguoinhap', 'ngaynhap', 'ghichu'
                    ];

                    excelFields.forEach(field => {
                        if (row[field] !== undefined) {
                            rowData[field] = row[field];
                        } else if (field === 'So_tep' && row['so_tep'] !== undefined) {
                            rowData['So_tep'] = row['so_tep'];
                        } else if (field === 'So_tep' && row['SO_TEP'] !== undefined) {
                            rowData['So_tep'] = row['SO_TEP'];
                        } else {
                            rowData[field] = null;
                        }
                    });

                    // Các trường đã loại khỏi excel nhưng được khởi tạo null để giữ cấu trúc không lỗi
                    rowData['loaicccd1'] = null;
                    rowData['loaicccd2'] = null;
                    rowData['matd'] = null;
                    rowData['mavach'] = null;

                    // Định dạng lại ngày nhập
                    let rawNgayNhap = rowData.ngaynhap;
                    let formattedNgayNhap = new Date().toISOString().split('T')[0];
                    if (rawNgayNhap) {
                        try {
                            if (typeof rawNgayNhap === 'number') {
                                const parsedDate = new Date((rawNgayNhap - 25569) * 86400 * 1000);
                                if (!isNaN(parsedDate.getTime())) {
                                    formattedNgayNhap = parsedDate.toISOString().split('T')[0];
                                }
                            } else {
                                const parsed = new Date(rawNgayNhap);
                                if (!isNaN(parsed.getTime())) {
                                    formattedNgayNhap = parsed.toISOString().split('T')[0];
                                }
                            }
                        } catch (err) {
                            console.warn("Lỗi định dạng ngày nhập Excel:", err);
                        }
                    }

                    return {
                        type: 'kho',
                        status: 'completed',
                        so_hieu: maBienNhan,
                        trich_yeu: trichYeuValue,
                        ngay_thang: formattedNgayNhap,
                        noi_nhan_gui: rowData.hoten1 || '',
                        created_by: currentUser.username || 'Hệ thống',
                        data: rowData
                    };
                });

                // PHƯƠNG ÁN CHIA LÔ SIÊU TỐC: Mỗi lô tối ưu 8000 hồ sơ đất, giúp tăng tốc vượt bậc
                const BATCH_SIZE = 8000;
                const totalBatches = Math.ceil(parsedRecords.length / BATCH_SIZE);
                setImportTotalBatches(totalBatches);

                let successCount = 0;
                let errorCount = 0;
                const errorsList: { rowNumber: number; data: any; errorReason: string }[] = [];

                for (let i = 0; i < totalBatches; i++) {
                    // Kiểm tra xem người dùng có bấm dừng hay không
                    if (importCancelRef.current) {
                        setImportStatusText("Đã hủy bỏ quá trình nhập Excel.");
                        break;
                    }

                    const start = i * BATCH_SIZE;
                    const end = Math.min(start + BATCH_SIZE, parsedRecords.length);
                    const batch = parsedRecords.slice(start, end);
                    
                    setImportCurrentBatch(i + 1);
                    setImportStatusText(`Đang truyền tải lô ${i + 1}/${totalBatches} (Dòng ${start + 1} - ${end})...`);

                    try {
                        const success = await importArchiveRecords(batch);
                        if (success) {
                            successCount += batch.length;
                            setImportSuccess(successCount);
                        } else {
                            // Lô này bị lỗi (có thể do trùng lặp dữ liệu)
                            // Ta sẽ cố gắng cứu bằng cách chèn từng dòng một trong lô đó (giải pháp phục hồi thông minh)
                            setImportStatusText(`Phát hiện lỗi ở lô ${i + 1}. Đang tự động cứu chữa dữ liệu từng dòng...`);
                            for (let j = 0; j < batch.length; j++) {
                                if (importCancelRef.current) break;
                                const singleRec = batch[j];
                                const excelRowIdx = start + j;
                                const originalExcelRow = rows[excelRowIdx];
                                const rowNumInExcel = excelRowIdx + 2; // Dòng 1 là header

                                try {
                                    const result = await importSingleWarehouseRecord(singleRec);
                                    if (result.success) {
                                        successCount++;
                                    } else {
                                        errorCount++;
                                        errorsList.push({
                                            rowNumber: rowNumInExcel,
                                            data: originalExcelRow || singleRec.data,
                                            errorReason: result.errorMsg || "Lỗi trùng Số phát hành GCN hoặc dữ liệu không hợp lệ"
                                        });
                                    }
                                } catch (singleErr: any) {
                                    errorCount++;
                                    errorsList.push({
                                        rowNumber: rowNumInExcel,
                                        data: originalExcelRow || singleRec.data,
                                        errorReason: singleErr.message || "Lỗi hệ thống khi cứu hộ"
                                    });
                                }
                                setImportSuccess(successCount);
                                setImportErrors(errorCount);
                            }
                        }
                    } catch (batchErr: any) {
                        console.error(`Lỗi nghiêm trọng tại lô ${i+1}:`, batchErr);
                        // Cứu chữa từng dòng của lô lỗi
                        for (let j = 0; j < batch.length; j++) {
                            if (importCancelRef.current) break;
                            const singleRec = batch[j];
                            const excelRowIdx = start + j;
                            const originalExcelRow = rows[excelRowIdx];
                            const rowNumInExcel = excelRowIdx + 2;

                            try {
                                const result = await importSingleWarehouseRecord(singleRec);
                                if (result.success) {
                                    successCount++;
                                } else {
                                    errorCount++;
                                    errorsList.push({
                                        rowNumber: rowNumInExcel,
                                        data: originalExcelRow || singleRec.data,
                                        errorReason: result.errorMsg || String(batchErr?.message || batchErr)
                                    });
                                }
                            } catch (singleErr: any) {
                                errorCount++;
                                errorsList.push({
                                    rowNumber: rowNumInExcel,
                                    data: originalExcelRow || singleRec.data,
                                    errorReason: singleErr.message || "Lỗi ngoại lệ khi đẩy"
                                });
                            }
                            setImportSuccess(successCount);
                            setImportErrors(errorCount);
                        }
                    }

                    // Cập nhật % tiến trình thực tế
                    const progressVal = Math.round(((i + 1) / totalBatches) * 105); // một chút buffer cảm quan
                    setImportProgress(progressVal > 100 ? 100 : progressVal);
                }

                setFailedImports(errorsList);
                setImportProgress(100);
                setImportStatusText(importCancelRef.current ? "Đã dừng import!" : "Hoàn thành!");
                setShowImportSummary(true);
                loadData(1); // Tải lại trang đầu tiên của kho dữ liệu mới
            } catch (err: any) {
                console.error("Lỗi phân tích Excel:", err);
                alert("Đã xảy ra lỗi khi phân tích hoặc truyền tải dữ liệu Excel!");
                setIsImporting(false);
            } finally {
                if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                }
            }
        };
        reader.readAsBinaryString(file);
    };

    // Hàm tải tệp Excel mẫu cho người dùng
    const downloadTemplate = () => {
        const headers = [
            ['sott', 'loaihoso', 'hoten1', 'namsinh1', 'socccd', 'diachitt1', 'hoten2', 'namsinh2', 'socccd2', 'diachitt2', 'tobando', 'sothua', 'dientich', 'hinhthucsd', 'loaidato', 'dientichdato', 'maxa', 'manam', 'sophathanhgcnmoi', 'sovaosomoi', 'ngaycapgcnmoi', 'diachiap', 'soke_tang', 'so_o', 'So_tep', 'sott_tep', 'nguoinhap', 'ngaynhap', 'ghichu']
        ];
        const sampleData = [
            [
                1, 'Đo đạc theo yêu cầu', 'Nguyễn Văn A', 1985, '012345678912', 'Hà Nội', 
                'Trần Thị B', 1988, '098765432109', 'Hà Nội', '05', '124', 150.5, 
                'Sử dụng riêng', 'Đất ở', 100, '25432', '2026', 'GCN-123456', 'VS-555666', 
                '2026-05-12', 'Ấp 1', 'Kệ 01A', 'Tầng 3', 'Hộp 12', 'STT 124', 'Trần Văn C', '2026-06-16', 'Hồ sơ đã lưu kho hoàn thiện'
            ]
        ];

        const worksheet = XLSX.utils.aoa_to_sheet([...headers, ...sampleData]);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Mau_Nhap_Kho');
        XLSX.writeFile(workbook, 'Mau_Nhap_Lieu_Kho.xlsx');
    };

    // Hàm xuất danh sách lỗi ra Excel đầy đủ định dạng cột gốc kèm Lý do lỗi
    const exportFailedToExcel = () => {
        if (failedImports.length === 0) {
            alert("Không có dữ liệu lỗi để xuất!");
            return;
        }

        const excelFields = [
            'sott', 'loaihoso', 'hoten1', 'namsinh1', 'socccd', 'diachitt1',
            'hoten2', 'namsinh2', 'socccd2', 'diachitt2', 'tobando',
            'sothua', 'dientich', 'hinhthucsd', 'loaidato', 'dientichdato', 'maxa',
            'manam', 'sophathanhgcnmoi', 'sovaosomoi', 'ngaycapgcnmoi', 'diachiap', 'soke_tang',
            'so_o', 'So_tep', 'sott_tep', 'nguoinhap', 'ngaynhap', 'ghichu'
        ];

        // Tạo mảng dạng AOA (Array of Arrays) cho XLSX
        const headers = ['Dòng Excel Gốc', ...excelFields, 'Lý do lỗi'];
        
        const rowsData = failedImports.map(errorItem => {
            const originalRow = errorItem.data || {};
            const rowValueList = excelFields.map(field => {
                if (originalRow[field] !== undefined) return originalRow[field];
                
                // Trường hợp đặc biệt chữ hoa/thường trong tên cột ban đầu
                const fieldLower = field.toLowerCase();
                const matchedKey = Object.keys(originalRow).find(k => k.toLowerCase() === fieldLower);
                if (matchedKey) return originalRow[matchedKey];

                return '';
            });
            return [errorItem.rowNumber, ...rowValueList, errorItem.errorReason];
        });

        const ws = XLSX.utils.aoa_to_sheet([headers, ...rowsData]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'DanhSanhLoi_Khonhap');

        // Định dạng cột một chút
        ws['!cols'] = [
            { wch: 15 }, // Dòng Excel Gốc
            ...excelFields.map(() => ({ wch: 15 })),
            { wch: 60 } // Lý do lỗi rộng hơn
        ];

        const timeStamp = new Date().toISOString().replace(/T/, '_').replace(/\..+/, '').replace(/:/g, '-');
        XLSX.writeFile(wb, `Danh_Sach_Ho_So_Loi_Kho_${timeStamp}.xlsx`);
    };

    const handleFormChange = (field: string, value: any) => {
        setEditFormData(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const handleDataFieldChange = (field: string, value: any) => {
        setEditFormData(prev => ({
            ...prev,
            data: {
                ...(prev.data || {}),
                [field]: value
            }
        }));
    };

    return (
        <div className="flex flex-col flex-1 overflow-hidden h-full bg-slate-50 relative p-4">
            
            {/* TIÊU ĐỀ & ACTIONS */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 shrink-0">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-indigo-600 rounded-xl text-white shadow-md shadow-indigo-600/20">
                        <HardDrive size={22} />
                    </div>
                    <div>
                        <h2 className="text-xl font-extrabold text-slate-800 tracking-tight">Quản Lý Kho Lưu Trữ</h2>
                        <p className="text-xs text-slate-500">Quản lý hồ sơ kho đất, kệ tầng ngăn nắp, hỗ trợ tra cứu thông tin nhanh chóng</p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <button
                        onClick={downloadTemplate}
                        className="px-4 py-2 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
                    >
                        <Download size={14} /> Tải Excel Mẫu
                    </button>

                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleImportExcel}
                        accept=".xlsx, .xls"
                        className="hidden"
                    />

                    <button
                        disabled={isLoading}
                        onClick={() => fileInputRef.current?.click()}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md shadow-emerald-600/10 active:scale-95"
                    >
                        {isLoading ? <Loader2 size={14} className="animate-spin" /> : <FileSpreadsheet size={14} />}
                        Nhập dữ liệu Excel
                    </button>

                    <button
                        onClick={() => setIsExcelSearchOpen(true)}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md shadow-indigo-600/10 active:scale-95"
                    >
                        <Search size={14} />
                        Tìm kiếm bằng Excel
                    </button>

                    <button
                        onClick={() => loadData(currentPage)}
                        title="Tải lại dữ liệu"
                        className="p-2 bg-white border border-slate-200 hover:border-slate-300 text-slate-600 rounded-xl transition-all shadow-sm active:rotate-180"
                    >
                        <RefreshCw size={14} />
                    </button>
                </div>
            </div>

            {/* BỘ LỌC TÌM KIẾM NÂNG CAO CỐ ĐỊNH */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 mb-4 shrink-0 transition-all space-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    {/* 1. Nhóm Chủ Sử Dụng */}
                    <div className="p-4 bg-slate-50/40 rounded-xl border border-slate-150/70 space-y-3">
                        <div className="flex items-center gap-2 border-b border-slate-200 pb-1.5">
                            <div className="p-1 bg-indigo-50 rounded-lg text-indigo-600">
                                <UserIcon size={14} />
                            </div>
                            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Chủ sử dụng</span>
                        </div>
                        <div className="space-y-3">
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Chủ sử dụng</label>
                                <input
                                    type="text"
                                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                    placeholder="Họ tên chủ sử dụng..."
                                    value={tempAdvChuSuDung}
                                    onChange={(e) => setTempAdvChuSuDung(e.target.value)}
                                    onKeyDown={handleKeyDownAdvanced}
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">CCCD / CMND</label>
                                <input
                                    type="text"
                                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                    placeholder="Mã số CCCD..."
                                    value={tempAdvCccd}
                                    onChange={(e) => setTempAdvCccd(e.target.value)}
                                    onKeyDown={handleKeyDownAdvanced}
                                />
                            </div>
                        </div>
                    </div>

                    {/* 2. Nhóm Thửa Đất */}
                    <div className="p-4 bg-slate-50/40 rounded-xl border border-slate-150/70 space-y-3">
                        <div className="flex items-center gap-2 border-b border-slate-200 pb-1.5">
                            <div className="p-1 bg-emerald-50 rounded-lg text-emerald-600">
                                <Layers size={14} />
                            </div>
                            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Thửa đất</span>
                        </div>
                        <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-2">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Tờ bản đồ</label>
                                    <input
                                        type="text"
                                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                        placeholder="Số tờ..."
                                        value={tempAdvToBando}
                                        onChange={(e) => setTempAdvToBando(e.target.value)}
                                        onKeyDown={handleKeyDownAdvanced}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Số thửa</label>
                                    <input
                                        type="text"
                                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                        placeholder="Số thửa..."
                                        value={tempAdvSoThua}
                                        onChange={(e) => setTempAdvSoThua(e.target.value)}
                                        onKeyDown={handleKeyDownAdvanced}
                                    />
                                </div>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Xã phường</label>
                                <select
                                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                    value={tempAdvXaPhuong}
                                    onChange={(e) => setTempAdvXaPhuong(e.target.value)}
                                >
                                    <option value="">Tất cả Xã/Phường</option>
                                    {Object.entries(WARD_MAPPING).map(([code, name]) => (
                                        <option key={code} value={code}>{name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* 3. Nhóm Giấy Chứng Nhận */}
                    <div className="p-4 bg-slate-50/40 rounded-xl border border-slate-150/70 space-y-3">
                        <div className="flex items-center gap-2 border-b border-slate-200 pb-1.5">
                            <div className="p-1 bg-blue-50 rounded-lg text-blue-600">
                                <BookOpen size={14} />
                            </div>
                            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Giấy chứng nhận</span>
                        </div>
                        <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-2">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Số vào sổ</label>
                                    <input
                                        type="text"
                                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                        placeholder="Số vào sổ..."
                                        value={tempAdvSoVaoSo}
                                        onChange={(e) => setTempAdvSoVaoSo(e.target.value)}
                                        onKeyDown={handleKeyDownAdvanced}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Số phát hành GCN</label>
                                    <input
                                        type="text"
                                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                        placeholder="Số phát hành..."
                                        value={tempAdvSoPhatHanh}
                                        onChange={(e) => setTempAdvSoPhatHanh(e.target.value)}
                                        onKeyDown={handleKeyDownAdvanced}
                                    />
                                </div>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Loại hồ sơ</label>
                                <select
                                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                    value={tempAdvLoaiHoSo}
                                    onChange={(e) => setTempAdvLoaiHoSo(e.target.value)}
                                >
                                    <option value="">Tất cả loại hồ sơ</option>
                                    <option value="Chuyển nhượng QSDĐ">Chuyển nhượng QSDĐ</option>
                                    <option value="Tặng cho QSDĐ">Tặng cho QSDĐ</option>
                                    <option value="Thừa kế QSDĐ">Thừa kế QSDĐ</option>
                                    <option value="Tách thửa đất">Tách thửa đất</option>
                                    <option value="Phân chia QSDĐ">Phân chia QSDĐ</option>
                                    <option value="Cấp đổi Giấy chứng nhận QSDĐ">Cấp đổi Giấy chứng nhận QSDĐ</option>
                                    <option value="Hợp thửa đất">Hợp thửa đất</option>
                                    <option value="Tách, hợp thửa đất">Tách, hợp thửa đất</option>
                                    <option value="Nhập tài sản vợ chồng">Nhập tài sản vợ chồng</option>
                                    <option value="Phân chia QSDĐ theo toà án">Phân chia QSDĐ theo toà án</option>
                                    <option value="Cấp lại GCN QSDĐ">Cấp lại GCN QSDĐ</option>
                                    <option value="Giao đất">Giao đất</option>
                                    <option value="Đính chính GCNQSD đất">Đính chính GCNQSD đất</option>
                                    <option value="Chuyển nhượng 1/2 QSDĐ( m²)">Chuyển nhượng 1/2 QSDĐ( m²)</option>
                                    <option value="Chuyển mục đích sử dụng đất">Chuyển mục đích sử dụng đất</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-4 pt-3 border-t border-slate-100">
                    <div className="text-xs text-slate-500 font-semibold">
                        Kết quả lọc: <strong className="text-indigo-600">{totalRecords}</strong> hồ sơ tìm thấy
                    </div>
                    <div className="flex justify-end gap-2">
                        <button
                            onClick={handleExecuteAdvancedSearch}
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md shadow-indigo-600/10 active:scale-95"
                        >
                            <Search size={14} /> Tìm kiếm ngay
                        </button>
                        {(advLoaiHoSo || advChuSuDung || advCccd || advToBando || advSoThua || advSoPhatHanh || advSoVaoSo || advXaPhuong) && (
                            <button
                                onClick={handleResetFilters}
                                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-650 rounded-xl text-xs font-bold transition-all active:scale-95"
                            >
                                Xóa bộ lọc
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* DANH SÁCH HỒ SƠ KHO */}
            <div className="flex-1 bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col overflow-hidden min-h-0">
                <div className="overflow-auto flex-1">
                    <table className="w-full border-collapse text-left">
                        <thead className="bg-slate-50 border-b border-slate-100 sticky top-0 z-10 text-xs font-bold text-slate-600 uppercase tracking-wider">
                            <tr>
                                <th className="p-3.5 w-14 text-center">STT</th>
                                <th className="p-3.5 w-[280px]">Thông tin chủ sử dụng</th>
                                <th className="p-3.5 w-[190px]">Tờ / Thửa / Diện tích / Xã</th>
                                <th className="p-3.5 w-[180px]">Thông tin GCN</th>
                                <th className="p-3.5 w-[210px]">Loại hồ sơ</th>
                                <th className="p-3.5 w-[200px]">Vị trí lưu kho</th>
                                <th className="p-3.5 w-[130px]">Người nhập</th>
                                <th className="p-3.5 w-28 text-center">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-sm font-medium text-slate-705">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={8} className="p-12 text-center">
                                        <div className="flex flex-col items-center justify-center gap-2">
                                            <Loader2 size={32} className="animate-spin text-indigo-600" />
                                            <span className="text-sm text-slate-500 font-bold">Đang tải danh sách kho hồ sơ...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : records.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="p-12 text-center text-slate-400 italic">
                                        {hasActiveFilter ? (
                                            "Không tìm thấy hồ sơ nào đáp ứng điều kiện tìm kiếm."
                                        ) : (
                                            <div className="py-6 flex flex-col items-center justify-center gap-2 text-slate-500 font-semibold not-italic">
                                                <Search size={24} className="text-indigo-500 animate-pulse" />
                                                <span>Vui lòng nhập thông tin tìm kiếm ở trên và bấm "Tìm kiếm ngay"</span>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ) : (
                                records.map((r, index) => {
                                    const d = r.data || {};
                                    return (
                                        <tr key={r.id} className="hover:bg-indigo-50/20 group transition-all">
                                            <td className="p-3.5 text-center text-slate-400 font-mono">
                                                {(currentPage - 1) * itemsPerPage + index + 1}
                                            </td>

                                            <td className="p-3.5">
                                                <div className="font-bold text-slate-800">{d.hoten1 || <span className="text-slate-400 italic">-</span>}</div>
                                                {d.socccd && <div className="text-xs text-slate-500 font-mono mt-0.5">CMND/CCCD: {d.socccd}</div>}
                                                {d.hoten2 && (
                                                    <div className="mt-1 pt-1 border-t border-dashed border-slate-150">
                                                        <div className="text-xs font-semibold text-slate-650">Chung: {d.hoten2}</div>
                                                        {d.socccd2 && <div className="text-[10px] text-slate-500 font-mono">CMND: {d.socccd2}</div>}
                                                    </div>
                                                )}
                                            </td>

                                            <td className="p-3.5">
                                                <div>Tờ: <strong className="text-slate-800">{d.tobando || '-'}</strong> / Thửa: <strong className="text-slate-800">{d.sothua || '-'}</strong></div>
                                                {d.dientich !== undefined && <div className="text-xs text-slate-500 mt-0.5">Diện tích: <strong className="text-indigo-600">{d.dientich} m²</strong></div>}
                                                {d.maxa && <div className="text-xs text-indigo-700 mt-0.5 font-semibold">Xã: {getWardName(d.maxa)}</div>}
                                            </td>

                                            <td className="p-3.5">
                                                <div className="text-xs space-y-0.5">
                                                    <div>Số phát hành: <strong className="text-slate-800">{d.sophathanhgcnmoi || '-'}</strong></div>
                                                    <div>Số vào sổ: <strong className="text-slate-700">{d.sovaosomoi || '-'}</strong></div>
                                                    {d.ngaycapgcnmoi && <div>Ngày cấp: <span className="text-indigo-600 font-semibold">{d.ngaycapgcnmoi}</span></div>}
                                                </div>
                                            </td>

                                            <td className="p-3.5">
                                                <div className="truncate max-w-[140px] text-slate-600 text-xs bg-slate-100 px-2 py-1 rounded border border-slate-200 font-semibold w-fit" title={d.loaihoso || ''}>
                                                    {d.loaihoso || 'Chưa phân loại'}
                                                </div>
                                            </td>

                                            <td className="p-3.5">
                                                <div className="text-xs space-y-0.5">
                                                     <div>Kệ: <strong className="text-slate-800">{d.soke_tang || '-'}</strong> - Tầng: <strong className="text-slate-800">{d.so_o || '-'}</strong></div>
                                                     <div>Hộp: <strong className="text-slate-800">{d.So_tep || d.so_tep || '-'}</strong> {d.sott_tep && <>- STT: <strong className="text-slate-800">{d.sott_tep}</strong></>}</div>
                                                 </div>
                                            </td>

                                            <td className="p-3.5">
                                                <div className="text-xs text-indigo-700 font-semibold">{d.nguoinhap || 'Cán bộ kho'}</div>
                                                <div className="text-[10px] text-slate-400 font-mono mt-0.5">{r.ngay_thang || r.created_at?.split('T')[0]}</div>
                                            </td>

                                            <td className="p-3.5 align-middle">
                                                <div className="flex items-center justify-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={() => {
                                                            setSelectedRecord(r);
                                                            setIsDetailOpen(true);
                                                        }}
                                                        className="p-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white rounded-lg transition-all"
                                                        title="Xem chi tiết"
                                                    >
                                                        <Eye size={14} />
                                                    </button>
                                                    {currentUser.role === UserRole.ADMIN && (
                                                        <button
                                                            onClick={() => openEditModal(r)}
                                                            className="p-1.5 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded-lg transition-all"
                                                            title="Sửa hồ sơ"
                                                        >
                                                            <Edit size={14} />
                                                        </button>
                                                    )}
                                                    {currentUser.role === UserRole.ADMIN && (
                                                        <button
                                                            disabled={isSubmitting}
                                                            onClick={() => handleDelete(r.id, r.so_hieu)} hidden={currentUser.role !== 'ADMIN'}
                                                            className="p-1.5 bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white rounded-lg transition-all"
                                                            title="Xóa hồ sơ"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* PHÂN TRANG */}
                {!isLoading && totalRecords > 0 && (
                    <div className="p-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-50/50 shrink-0">
                        <span className="text-xs text-slate-500 font-medium">
                            Hiển thị <strong>{Math.min(totalRecords, (currentPage - 1) * itemsPerPage + 1)}</strong> - <strong>{Math.min(totalRecords, currentPage * itemsPerPage)}</strong> / <strong>{totalRecords}</strong> kho hồ sơ
                        </span>

                        <div className="flex items-center gap-1.5">
                            <button
                                onClick={() => setCurrentPage(1)}
                                disabled={currentPage === 1}
                                className="p-1.5 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 transition-all active:scale-95 text-slate-600"
                            >
                                <ChevronsLeft size={14} />
                            </button>
                            <button
                                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                disabled={currentPage === 1}
                                className="p-1.5 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 transition-all active:scale-95 text-slate-600"
                            >
                                <ChevronLeft size={14} />
                            </button>

                            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                let pageNum = i + 1;
                                if (totalPages > 5 && currentPage > 3) {
                                    pageNum = currentPage - 2 + i;
                                    if (pageNum + (4 - i) > totalPages) {
                                        pageNum = totalPages - 4 + i;
                                    }
                                }
                                return (
                                    <button
                                        key={pageNum}
                                        onClick={() => setCurrentPage(pageNum)}
                                        className={`w-8 h-8 rounded-lg text-xs font-bold transition-all border ${
                                            currentPage === pageNum
                                                ? 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-600/10'
                                                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                        }`}
                                    >
                                        {pageNum}
                                    </button>
                                );
                            })}

                            <button
                                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                disabled={currentPage === totalPages}
                                className="p-1.5 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 transition-all active:scale-95 text-slate-600"
                            >
                                <ChevronRight size={14} />
                            </button>
                            <button
                                onClick={() => setCurrentPage(totalPages)}
                                disabled={currentPage === totalPages}
                                className="p-1.5 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 transition-all active:scale-95 text-slate-600"
                            >
                                <ChevronsRight size={14} />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* MODAL CHI TIẾT HỒ SƠ KHO */}
            {isDetailOpen && selectedRecord && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[100] p-3 md:p-6 animate-fade-in">
                    <div ref={detailModalRef} className="bg-white rounded-3xl shadow-2xl max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-scale-up border border-slate-200">
                        {/* Header */}
                        <div className="flex justify-between items-center bg-gradient-to-r from-indigo-700 via-indigo-600 to-blue-600 text-white p-5 md:px-7 shrink-0 shadow-md">
                            <div className="flex items-center gap-3.5">
                                <div className="p-2.5 bg-white/20 rounded-2xl backdrop-blur-md shadow-inner">
                                    <BookOpen size={22} className="text-white" />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-lg md:text-xl font-black tracking-wide">Chi Tiết Hồ Sơ Kho Lưu Trữ</h3>
                                        {selectedRecord.so_hieu && (
                                            <span className="bg-white/20 text-white font-mono font-bold text-xs px-2.5 py-0.5 rounded-full border border-white/20">
                                                {selectedRecord.so_hieu}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs text-indigo-100 font-medium mt-0.5">
                                        Số GCN phát hành: <strong className="text-yellow-300 font-bold">{selectedRecord.data?.sophathanhgcnmoi || 'Chưa cập nhật'}</strong>
                                    </p>
                                </div>
                            </div>
                            <button 
                                onClick={() => setIsDetailOpen(false)}
                                className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-all active:scale-95"
                                title="Đóng modal"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Content Scrollable */}
                        <div className="p-5 md:p-7 overflow-y-auto space-y-6 flex-1 text-sm bg-slate-50/50">
                            
                            {/* 1. Thanh vị trí lưu trữ kho & Loại hồ sơ (Highlight Bar) */}
                            <div className="bg-white p-4 md:p-5 rounded-2xl border border-indigo-100 shadow-xs space-y-3">
                                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-indigo-50 pb-2.5">
                                    <h4 className="text-xs font-black text-indigo-800 uppercase tracking-wider flex items-center gap-2">
                                        <Archive size={16} className="text-indigo-600" /> Vị trí lưu trữ trong kho
                                    </h4>
                                    <span className="text-xs font-extrabold text-slate-700 bg-slate-100 px-3 py-1 rounded-full border border-slate-200 flex items-center gap-1.5">
                                        <FileText size={13} className="text-indigo-600" />
                                        Loại hồ sơ: <strong className="text-indigo-700">{selectedRecord.data?.loaihoso || 'Chưa phân loại'}</strong>
                                    </span>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 pt-1">
                                    <div className="bg-indigo-50/70 p-3 rounded-xl border border-indigo-100/80">
                                        <div className="text-[11px] font-bold text-indigo-500 uppercase tracking-wider">Kệ lưu trữ</div>
                                        <div className="font-extrabold text-slate-800 text-base md:text-lg mt-0.5">{selectedRecord.data?.soke_tang || '-'}</div>
                                    </div>
                                    <div className="bg-indigo-50/70 p-3 rounded-xl border border-indigo-100/80">
                                        <div className="text-[11px] font-bold text-indigo-500 uppercase tracking-wider">Tầng / Ô / Ngăn</div>
                                        <div className="font-extrabold text-slate-800 text-base md:text-lg mt-0.5">{selectedRecord.data?.so_o || '-'}</div>
                                    </div>
                                    <div className="bg-indigo-50/70 p-3 rounded-xl border border-indigo-100/80">
                                        <div className="text-[11px] font-bold text-indigo-500 uppercase tracking-wider">Hộp số / Số tệp</div>
                                        <div className="font-extrabold text-slate-800 text-base md:text-lg mt-0.5">{selectedRecord.data?.So_tep || '-'}</div>
                                    </div>
                                    <div className="bg-indigo-50/70 p-3 rounded-xl border border-indigo-100/80">
                                        <div className="text-[11px] font-bold text-indigo-500 uppercase tracking-wider">STT Tệp</div>
                                        <div className="font-extrabold text-indigo-700 text-base md:text-lg mt-0.5">{selectedRecord.data?.sott_tep || '-'}</div>
                                    </div>
                                </div>
                            </div>

                            {/* 2. Grid Bố cục 2 Cột Rộng Rãi */}
                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                                
                                {/* Cột Trái (6/12): Thửa đất & Giấy chứng nhận */}
                                <div className="lg:col-span-6 space-y-5">
                                    
                                    {/* Khối Thửa Đất */}
                                    <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
                                        <h4 className="text-xs font-black text-indigo-700 uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 pb-2.5">
                                            <Layers size={16} className="text-indigo-600" /> Thông tin thửa đất & Địa chỉ
                                        </h4>

                                        {/* Metrics Grid */}
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 bg-slate-50 p-3 rounded-xl border border-slate-100 text-center">
                                            <div className="p-1">
                                                <div className="text-[10px] font-bold text-slate-400 uppercase">Tờ bản đồ</div>
                                                <div className="font-extrabold text-slate-800 text-sm mt-0.5">{selectedRecord.data?.tobando || '-'}</div>
                                            </div>
                                            <div className="p-1 border-l border-slate-200">
                                                <div className="text-[10px] font-bold text-slate-400 uppercase">Số thửa</div>
                                                <div className="font-extrabold text-slate-800 text-sm mt-0.5">{selectedRecord.data?.sothua || '-'}</div>
                                            </div>
                                            <div className="p-1 border-l border-slate-200">
                                                <div className="text-[10px] font-bold text-slate-400 uppercase">Diện tích</div>
                                                <div className="font-extrabold text-indigo-600 text-sm mt-0.5">{selectedRecord.data?.dientich ? `${selectedRecord.data.dientich} m²` : '-'}</div>
                                            </div>
                                            <div className="p-1 border-l border-slate-200">
                                                <div className="text-[10px] font-bold text-slate-400 uppercase">Hình thức SD</div>
                                                <div className="font-bold text-slate-700 text-xs mt-0.5 truncate">{selectedRecord.data?.hinhthucsd || '-'}</div>
                                            </div>
                                        </div>

                                        {/* Chi tiết vị trí */}
                                        <div className="space-y-2.5 text-xs pt-1">
                                            <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
                                                <span className="text-slate-500 font-medium">Xã / Phường:</span>
                                                <span className="font-bold text-indigo-800 bg-indigo-50 px-2.5 py-0.5 rounded-md">{getWardName(selectedRecord.data?.maxa)}</span>
                                            </div>
                                            <div className="flex justify-between items-start py-1.5 border-b border-slate-100">
                                                <span className="text-slate-500 font-medium shrink-0 mr-2">Địa chỉ thửa đất:</span>
                                                <span className="font-semibold text-slate-800 text-right">{selectedRecord.data?.diachiap || '-'}</span>
                                            </div>
                                            <div className="flex justify-between items-center py-1.5">
                                                <span className="text-slate-500 font-medium">Loại đất ở / Diện tích:</span>
                                                <span className="font-bold text-slate-800">
                                                    {selectedRecord.data?.loaidato || '-'} {selectedRecord.data?.dientichdato ? `(${selectedRecord.data.dientichdato} m²)` : ''}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Khối Giấy chứng nhận */}
                                    <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-3.5">
                                        <h4 className="text-xs font-black text-teal-700 uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 pb-2.5">
                                            <BookOpen size={16} className="text-teal-600" /> Thông tin Giấy chứng nhận
                                        </h4>
                                        <div className="grid grid-cols-3 gap-3 text-center">
                                            <div className="bg-teal-50/60 p-3 rounded-xl border border-teal-100">
                                                <div className="text-[10px] font-bold text-teal-600 uppercase">Số phát hành</div>
                                                <div className="font-extrabold text-indigo-800 text-xs md:text-sm mt-1">{selectedRecord.data?.sophathanhgcnmoi || '-'}</div>
                                            </div>
                                            <div className="bg-teal-50/60 p-3 rounded-xl border border-teal-100">
                                                <div className="text-[10px] font-bold text-teal-600 uppercase">Số vào sổ</div>
                                                <div className="font-bold text-slate-800 text-xs md:text-sm mt-1">{selectedRecord.data?.sovaosomoi || '-'}</div>
                                            </div>
                                            <div className="bg-teal-50/60 p-3 rounded-xl border border-teal-100">
                                                <div className="text-[10px] font-bold text-teal-600 uppercase">Ngày cấp GCN</div>
                                                <div className="font-bold text-slate-800 text-xs md:text-sm mt-1">{selectedRecord.data?.ngaycapgcnmoi || '-'}</div>
                                            </div>
                                        </div>
                                    </div>

                                </div>

                                {/* Cột Phải (6/12): Chủ sử dụng đất */}
                                <div className="lg:col-span-6 space-y-5">
                                    <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4 h-full flex flex-col">
                                        <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 pb-2.5 shrink-0">
                                            <UserIcon size={16} className="text-indigo-600" /> Thông tin chủ sử dụng đất
                                        </h4>

                                        <div className="space-y-4 flex-1">
                                            {/* Chủ sử dụng 1 */}
                                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/70 space-y-2">
                                                <div className="flex items-center justify-between pb-1 border-b border-slate-200">
                                                    <span className="text-xs font-extrabold text-indigo-800 uppercase tracking-wide">Chủ sử dụng chính (1)</span>
                                                    <span className="text-[10px] font-bold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">Đại diện</span>
                                                </div>
                                                <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                                                    <div>
                                                        <div className="text-[10px] text-slate-400 font-medium">Họ và tên</div>
                                                        <div className="font-extrabold text-slate-800 text-sm">{selectedRecord.data?.hoten1 || '-'}</div>
                                                    </div>
                                                    <div>
                                                        <div className="text-[10px] text-slate-400 font-medium">Năm sinh</div>
                                                        <div className="font-bold text-slate-700">{selectedRecord.data?.namsinh1 || '-'}</div>
                                                    </div>
                                                </div>
                                                <div className="text-xs">
                                                    <div className="text-[10px] text-slate-400 font-medium">Số CCCD / CMND ({selectedRecord.data?.loaicccd1 || 'CCCD'})</div>
                                                    <div className="font-mono font-bold text-slate-800">{selectedRecord.data?.socccd || '-'}</div>
                                                </div>
                                                <div className="text-xs">
                                                    <div className="text-[10px] text-slate-400 font-medium">Địa chỉ thường trú</div>
                                                    <div className="font-medium text-slate-700">{selectedRecord.data?.diachitt1 || '-'}</div>
                                                </div>
                                            </div>

                                            {/* Chủ sử dụng 2 */}
                                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/70 space-y-2">
                                                <div className="flex items-center justify-between pb-1 border-b border-slate-200">
                                                    <span className="text-xs font-extrabold text-indigo-800 uppercase tracking-wide">Chủ sử dụng 2</span>
                                                    <span className="text-[10px] font-bold bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full">Đồng sở hữu</span>
                                                </div>
                                                <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                                                    <div>
                                                        <div className="text-[10px] text-slate-400 font-medium">Họ và tên</div>
                                                        <div className="font-extrabold text-slate-800 text-sm">{selectedRecord.data?.hoten2 || '-'}</div>
                                                    </div>
                                                    <div>
                                                        <div className="text-[10px] text-slate-400 font-medium">Năm sinh</div>
                                                        <div className="font-bold text-slate-700">{selectedRecord.data?.namsinh2 || '-'}</div>
                                                    </div>
                                                </div>
                                                <div className="text-xs">
                                                    <div className="text-[10px] text-slate-400 font-medium">Số CCCD / CMND</div>
                                                    <div className="font-mono font-bold text-slate-800">{selectedRecord.data?.socccd2 || '-'}</div>
                                                </div>
                                                <div className="text-xs">
                                                    <div className="text-[10px] text-slate-400 font-medium">Địa chỉ thường trú</div>
                                                    <div className="font-medium text-slate-700">{selectedRecord.data?.diachitt2 || '-'}</div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                            </div>

                            {/* 3. Footer Metadata Banner */}
                            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
                                <div className="flex flex-wrap items-center gap-4 text-slate-500">
                                    <div>
                                        Cán bộ nhập: <strong className="text-slate-800 font-bold">{selectedRecord.data?.nguoinhap || '-'}</strong>
                                    </div>
                                    <div className="h-3 w-px bg-slate-200 hidden md:block"></div>
                                    <div>
                                        Ngày nhập: <strong className="text-slate-800 font-semibold">{selectedRecord.data?.ngaynhap || '-'}</strong>
                                    </div>
                                </div>
                                {selectedRecord.data?.ghichu && (
                                    <div className="bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-200 text-amber-800 font-medium text-xs">
                                        <strong>Ghi chú:</strong> {selectedRecord.data.ghichu}
                                    </div>
                                )}
                            </div>

                        </div>

                        {/* Footer Buttons */}
                        <div className="p-4 md:px-7 border-t border-slate-200 bg-white flex flex-wrap items-center justify-between gap-3 shrink-0">
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={handleCaptureScreenshot}
                                    disabled={isCapturing}
                                    className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-95 flex items-center gap-2 shadow-sm ${
                                        captureSuccess 
                                            ? 'bg-emerald-600 text-white' 
                                            : 'bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white'
                                    }`}
                                    title="Chụp ảnh toàn bộ chi tiết hồ sơ kho để gửi cho người khác"
                                >
                                    {isCapturing ? (
                                        <>
                                            <Loader2 size={15} className="animate-spin" />
                                            <span>Đang chụp ảnh...</span>
                                        </>
                                    ) : captureSuccess ? (
                                        <>
                                            <Check size={15} />
                                            <span>Đã tải ảnh chi tiết!</span>
                                        </>
                                    ) : (
                                        <>
                                            <Camera size={15} />
                                            <span>Chụp hình nhanh</span>
                                        </>
                                    )}
                                </button>
                            </div>

                            <div className="flex items-center gap-3">
                                {currentUser.role === UserRole.ADMIN && (
                                    <button
                                        onClick={() => openEditModal(selectedRecord)}
                                        className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all active:scale-95 flex items-center gap-1.5 shadow-md shadow-indigo-600/20"
                                    >
                                        <Edit size={14} /> Chỉnh sửa hồ sơ
                                    </button>
                                )}
                                <button
                                    onClick={() => setIsDetailOpen(false)}
                                    className="px-5 py-2.5 border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold transition-all active:scale-95"
                                >
                                    Đóng lại
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL CHỈNH SỬA HỒ SƠ */}
            {isEditOpen && editFormData && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-[100] p-4">
                    <form 
                        onSubmit={handleSaveEdit}
                        className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-scale-up border border-slate-100"
                    >
                        {/* Header */}
                        <div className="flex justify-between items-center bg-blue-600 text-white p-5 shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-white/20 rounded-lg">
                                    <Edit size={18} />
                                </div>
                                <div>
                                    <h3 className="text-md font-bold">Chỉnh Sửa Hồ Sơ Lưu Trữ</h3>
                                    <p className="text-[11px] opacity-80">Cập nhật vị trí kệ và hồ sơ trong kho</p>
                                </div>
                            </div>
                            <button 
                                type="button"
                                onClick={() => setIsEditOpen(false)}
                                className="p-1.5 bg-white/10 hover:bg-white/20 rounded-full transition-all"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        {/* Form scrollable */}
                        <div className="p-6 overflow-y-auto space-y-5 flex-1 text-xs">
                            <input type="hidden" value={editFormData.so_hieu || ''} />
                            <div className="grid grid-cols-1 gap-4">
                                <div className="space-y-1.5">
                                    <label className="font-bold text-slate-700">Loại hồ sơ</label>
                                    <input
                                        type="text"
                                        className="w-full px-3.5 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                                        value={editFormData.data?.loaihoso || ''}
                                        onChange={(e) => handleDataFieldChange('loaihoso', e.target.value)}
                                    />
                                </div>
                            </div>

                            {/* Khối Chủ sử dụng 1 */}
                            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-4">
                                <h5 className="font-bold text-slate-700 text-blue-700 pb-1 border-b border-slate-150">Chủ sử dụng đất chính (1)</h5>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    <div className="space-y-1.5">
                                        <label className="font-medium text-slate-600">Họ và tên</label>
                                        <input
                                            type="text"
                                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                                            value={editFormData.data?.hoten1 || ''}
                                            onChange={(e) => {
                                                handleDataFieldChange('hoten1', e.target.value);
                                                handleFormChange('noi_nhan_gui', e.target.value);
                                            }}
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="font-medium text-slate-600">Năm sinh</label>
                                        <input
                                            type="number"
                                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                                            value={editFormData.data?.namsinh1 || ''}
                                            onChange={(e) => handleDataFieldChange('namsinh1', e.target.value)}
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="font-medium text-slate-600">Số CCCD/CMND</label>
                                        <input
                                            type="text"
                                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                                            value={editFormData.data?.socccd || ''}
                                            onChange={(e) => handleDataFieldChange('socccd', e.target.value)}
                                        />
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="font-medium text-slate-600">Địa chỉ thường trú</label>
                                    <input
                                        type="text"
                                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                                        value={editFormData.data?.diachitt1 || ''}
                                        onChange={(e) => handleDataFieldChange('diachitt1', e.target.value)}
                                    />
                                </div>
                            </div>

                            {/* Khối Chủ sử dụng 2 */}
                            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-4">
                                <h5 className="font-bold text-slate-700 text-blue-700 pb-1 border-b border-slate-150">Chồng / Vợ / Người đông sở hữu (2)</h5>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    <div className="space-y-1.5">
                                        <label className="font-medium text-slate-600">Họ và tên</label>
                                        <input
                                            type="text"
                                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                                            value={editFormData.data?.hoten2 || ''}
                                            onChange={(e) => handleDataFieldChange('hoten2', e.target.value)}
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="font-medium text-slate-600">Năm sinh</label>
                                        <input
                                            type="number"
                                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                                            value={editFormData.data?.namsinh2 || ''}
                                            onChange={(e) => handleDataFieldChange('namsinh2', e.target.value)}
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="font-medium text-slate-600">Số CCCD/CMND 2</label>
                                        <input
                                            type="text"
                                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                                            value={editFormData.data?.socccd2 || ''}
                                            onChange={(e) => handleDataFieldChange('socccd2', e.target.value)}
                                        />
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="font-medium text-slate-600">Địa chỉ thường trú 2</label>
                                    <input
                                        type="text"
                                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                                        value={editFormData.data?.diachitt2 || ''}
                                        onChange={(e) => handleDataFieldChange('diachitt2', e.target.value)}
                                    />
                                </div>
                            </div>

                            {/* Thông tin thửa */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                <div className="space-y-1.5">
                                    <label className="font-bold text-slate-700 font-medium">Tờ bản đồ</label>
                                    <input
                                        type="text"
                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none"
                                        value={editFormData.data?.tobando || ''}
                                        onChange={(e) => handleDataFieldChange('tobando', e.target.value)}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="font-bold text-slate-700 font-medium">Số thửa</label>
                                    <input
                                        type="text"
                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none"
                                        value={editFormData.data?.sothua || ''}
                                        onChange={(e) => handleDataFieldChange('sothua', e.target.value)}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="font-bold text-slate-700 font-medium">Diện tích (m²)</label>
                                    <input
                                        type="number"
                                        step="any"
                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none"
                                        value={editFormData.data?.dientich || ''}
                                        onChange={(e) => handleDataFieldChange('dientich', parseFloat(e.target.value) || 0)}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="font-bold text-slate-700 font-medium">Hình thức SD</label>
                                    <input
                                        type="text"
                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                                        value={editFormData.data?.hinhthucsd || ''}
                                        onChange={(e) => handleDataFieldChange('hinhthucsd', e.target.value)}
                                    />
                                </div>
                            </div>

                            {/* Vị trí lưu kho */}
                            <div className="p-4 bg-indigo-50 border border-indigo-155 rounded-xl space-y-4">
                                <h5 className="font-bold text-indigo-850 flex items-center gap-1">Vị trí trong kho</h5>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    <div className="space-y-1.5">
                                        <label className="font-semibold text-slate-650">Kệ</label>
                                        <input
                                            type="text"
                                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                                            value={editFormData.data?.soke_tang || ''}
                                            onChange={(e) => handleDataFieldChange('soke_tang', e.target.value)}
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="font-semibold text-slate-650">Tầng (Hộp số/Phòng)</label>
                                        <input
                                            type="text"
                                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                                            value={editFormData.data?.so_o || ''}
                                            onChange={(e) => handleDataFieldChange('so_o', e.target.value)}
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="font-semibold text-slate-650">Số tệp</label>
                                        <input
                                            type="text"
                                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                                            value={editFormData.data?.So_tep || ''}
                                            onChange={(e) => handleDataFieldChange('So_tep', e.target.value)}
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="font-semibold text-slate-650">Số thứ tự tệp</label>
                                        <input
                                            type="text"
                                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                                            value={editFormData.data?.sott_tep || ''}
                                            onChange={(e) => handleDataFieldChange('sott_tep', e.target.value)}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="font-bold text-slate-700">Người nhập</label>
                                    <input
                                        type="text"
                                        className="w-full px-3.5 py-2 border border-slate-200 rounded-lg"
                                        value={editFormData.data?.nguoinhap || ''}
                                        onChange={(e) => handleDataFieldChange('nguoinhap', e.target.value)}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="font-bold text-slate-700">Ghi chú</label>
                                    <input
                                        type="text"
                                        className="w-full px-3.5 py-2 border border-slate-200 rounded-lg"
                                        value={editFormData.data?.ghichu || ''}
                                        onChange={(e) => handleDataFieldChange('ghichu', e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 shrink-0">
                            <button
                                type="button"
                                onClick={() => setIsEditOpen(false)}
                                className="px-4 py-2 border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl font-bold transition-all"
                            >
                                Hủy bỏ
                            </button>
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl font-bold flex items-center gap-1 shadow-md shadow-blue-500/10"
                            >
                                {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                                Lưu Thay Đổi
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* MODAL TIẾN TRÌNH IMPORT EXCEL BÁO CÁO REALTIME VIP CHIA LÔ */}
            {isImporting && (
                <div id="import-excel-modal" className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-[9999] animate-fade-in animate-duration-200">
                    <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-lg w-full overflow-hidden flex flex-col p-6 space-y-6 md:p-8 animate-scale-up">
                        <div className="flex items-center gap-3">
                            <div className="p-3 bg-emerald-100 text-emerald-700 rounded-2xl">
                                <FileSpreadsheet size={24} />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-slate-800">Tiến trình nhập tài liệu Excel</h3>
                                <p className="text-xs text-slate-500">Đang thực hiện phân rã dữ liệu và lưu trữ vào đám mây</p>
                            </div>
                        </div>

                        {/* Thanh tiến trình */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between text-xs">
                                <span className="font-bold text-slate-700">{importStatusText}</span>
                                <span className="font-mono text-emerald-600 font-extrabold">{importProgress}%</span>
                            </div>
                            <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden p-0.5 border border-slate-200/50">
                                <div 
                                    className="bg-gradient-to-r from-emerald-500 to-teal-500 h-full rounded-full transition-all duration-300"
                                    style={{ width: `${importProgress}%` }}
                                ></div>
                            </div>
                        </div>

                        {/* Thống kê tiến trình */}
                        <div className="grid grid-cols-3 gap-2 bg-slate-50 p-4 rounded-2xl text-center border border-slate-100">
                            <div className="space-y-0.5">
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tổng số dòng</div>
                                <div className="text-base font-extrabold text-slate-700 font-mono">{importTotal.toLocaleString()}</div>
                            </div>
                            <div className="space-y-0.5 border-x border-slate-200">
                                <div className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider">Đã lưu</div>
                                <div className="text-base font-extrabold text-emerald-600 font-mono">{importSuccess.toLocaleString()}</div>
                            </div>
                            <div className="space-y-0.5">
                                <div className="text-[10px] font-bold text-red-400 uppercase tracking-wider">Bản ghi lỗi</div>
                                <div className="text-base font-extrabold text-red-500 font-mono">{importErrors.toLocaleString()}</div>
                            </div>
                        </div>

                        {/* Chi tiết theo lô */}
                        <div className="flex flex-col gap-2 text-xs font-semibold text-slate-500">
                            <div className="flex items-center justify-between">
                                <span>Lô xử lý: <strong>{importCurrentBatch}</strong> / <strong>{importTotalBatches}</strong></span>
                                {importErrors > 0 && <span className="text-amber-600 flex items-center gap-1"><AlertCircle size={12} /> Bản ghi lỗi hoặc trùng: <strong>{importErrors.toLocaleString()}</strong></span>}
                            </div>
                            
                            {/* KHU VỰC HIỂN THỊ LỖI THỰC TẾ & NÚT CHI TIẾT */}
                            {failedImports.length > 0 && (
                                <div className="mt-2 space-y-2 border border-slate-200 rounded-2xl p-3 bg-slate-50 select-none">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
                                            <AlertCircle size={14} className="text-rose-500" />
                                            Chi tiết lỗi ({failedImports.length.toLocaleString()} dòng):
                                        </span>
                                        <button
                                            type="button"
                                            onClick={exportFailedToExcel}
                                            className="px-2.5 py-1.5 bg-amber-500 hover:bg-amber-600 active:scale-95 text-white rounded-lg text-[10px] font-extrabold flex items-center gap-1 transition-all shadow-sm shadow-amber-500/10 cursor-pointer"
                                        >
                                            <Download size={11} /> Xuất Excel Lỗi
                                        </button>
                                    </div>
                                    <div className="max-h-[140px] overflow-y-auto border border-slate-200 rounded-xl bg-white text-[10px] divide-y divide-slate-100 font-mono">
                                        {failedImports.slice(0, 100).map((errItem, idx) => (
                                            <div key={idx} className="p-2 flex items-start gap-2 hover:bg-slate-50 transition-colors">
                                                <span className="px-1.5 py-0.5 bg-rose-50 text-rose-600 border border-rose-100 rounded font-bold shrink-0">Dòng {errItem.rowNumber}</span>
                                                <div className="flex flex-col text-left">
                                                    <span className="text-slate-800 font-bold">
                                                        {errItem.data?.hoten1 ? String(errItem.data.hoten1).trim() : 'Không rõ tên'} 
                                                        {errItem.data?.sophathanhgcnmoi ? ` (${errItem.data.sophathanhgcnmoi})` : ''}
                                                    </span>
                                                    <span className="text-rose-500 text-[9px] font-medium mt-0.5">{errItem.errorReason}</span>
                                                </div>
                                            </div>
                                        ))}
                                        {failedImports.length > 100 && (
                                            <div className="p-2 text-center text-slate-500 text-[10px] font-bold italic bg-slate-50 border-t border-slate-150">
                                                ... và {failedImports.length - 100} dòng lỗi nữa. Vui lòng bấm "Xuất Excel Lỗi" để tải về sửa đổi toàn bộ!
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Action buttons */}
                        <div className="pt-2 flex flex-col sm:flex-row gap-3">
                            {!showImportSummary ? (
                                <button
                                    type="button"
                                    onClick={() => {
                                        importCancelRef.current = true;
                                        setImportStatusText("Đang dừng quá trình...");
                                    }}
                                    className="w-full py-3 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl font-bold border border-rose-100 text-sm transition-all flex items-center justify-center gap-1.5 active:scale-95"
                                >
                                    <X size={16} /> Dừng/Hủy Nhập Excel
                                </button>
                            ) : (
                                <>
                                    {failedImports.length > 0 && (
                                        <button
                                            type="button"
                                            onClick={exportFailedToExcel}
                                            className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white shadow-lg shadow-amber-500/10 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-1.5 active:scale-95"
                                        >
                                            <Download size={16} /> Tải file Excel sửa ngay ({failedImports.length})
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsImporting(false);
                                            setShowImportSummary(false);
                                            setFailedImports([]);
                                            loadData(1);
                                        }}
                                        className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/10 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-1.5 active:scale-95"
                                    >
                                        <CheckCircle2 size={16} /> Hoàn tất & Đóng
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL TÌM KIẾM THEO FILE EXCEL */}
            {isExcelSearchOpen && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-[100] p-4">
                    <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-scale-up border border-slate-100">
                        {/* Header */}
                        <div className="flex justify-between items-center bg-indigo-600 text-white p-5 shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-white/20 rounded-lg">
                                    <Search size={18} />
                                </div>
                                <div>
                                    <h3 className="text-md font-bold">Tìm Kiếm Kho Hồ Sơ Bằng File Excel</h3>
                                    <p className="text-[11px] opacity-80">Tra cứu nhanh hàng loạt thửa đất, CCCD hoặc chủ sử dụng từ tệp danh sách Excel</p>
                                </div>
                            </div>
                            <button 
                                type="button"
                                onClick={() => {
                                    if (isSearching) {
                                        if (confirm("Đang trong quá trình tra cứu. Bạn có muốn dừng lại không?")) {
                                            searchCancelRef.current = true;
                                            setIsExcelSearchOpen(false);
                                            resetExcelSearch();
                                        }
                                    } else {
                                        setIsExcelSearchOpen(false);
                                        resetExcelSearch();
                                    }
                                }}
                                className="p-1.5 bg-white/10 hover:bg-white/20 rounded-full transition-all"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 overflow-y-auto flex-1 space-y-6 text-xs font-medium text-slate-700">
                            
                            {/* BƯỚC 1: TẢI FILE EXCEL */}
                            {!excelSearchFile ? (
                                <div className="space-y-3">
                                    <div className="text-sm font-bold text-slate-700">Bước 1: Chọn Tệp Tin Excel Chứa Danh Sách Cần Tra Cứu</div>
                                    <div 
                                        onClick={() => searchFileInputRef.current?.click()}
                                        className="border-2 border-dashed border-slate-300 hover:border-indigo-500 rounded-2xl p-10 flex flex-col items-center justify-center gap-3 bg-slate-50/50 hover:bg-indigo-50/10 cursor-pointer transition-all select-none group"
                                    >
                                        <div className="p-4 bg-indigo-50 rounded-full text-indigo-600 group-hover:scale-110 transition-transform">
                                            <Upload size={28} />
                                        </div>
                                        <div className="text-center">
                                            <p className="text-xs font-bold text-slate-700">Kéo thả tệp Excel vào đây hoặc nhấp để chọn tệp</p>
                                            <p className="text-[10px] text-slate-400 mt-1">Hỗ trợ định dạng .xlsx, .xls</p>
                                        </div>
                                        <input 
                                            type="file" 
                                            ref={searchFileInputRef}
                                            onChange={handleExcelSearchUpload}
                                            accept=".xlsx, .xls"
                                            className="hidden"
                                        />
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {/* THÔNG TIN TỆP VÀ RESET */}
                                    <div className="flex items-center justify-between bg-indigo-50/45 border border-indigo-100 p-4 rounded-2xl">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2.5 bg-indigo-600 text-white rounded-xl">
                                                <FileSpreadsheet size={20} />
                                            </div>
                                            <div>
                                                <div className="font-bold text-slate-800 text-xs">{excelSearchFile.name}</div>
                                                <div className="text-[10px] text-slate-500 font-semibold mt-0.5">
                                                    Phát hiện <strong className="text-indigo-600 font-bold">{excelRows.length}</strong> dòng dữ liệu tra cứu
                                                </div>
                                            </div>
                                        </div>
                                        {!isSearching && (
                                            <button
                                                type="button"
                                                onClick={resetExcelSearch}
                                                className="px-3 py-1.5 border border-slate-200 hover:bg-slate-100 rounded-lg font-bold text-[11px] text-slate-600 transition-all"
                                            >
                                                Chọn tệp khác
                                            </button>
                                        )}
                                    </div>

                                    {/* BƯỚC 2: CẤU HÌNH ÁNH XẠ CỘT & ĐIỀU KIỆN */}
                                    {!showSearchSummary && !isSearching && (
                                        <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl space-y-4">
                                            <div>
                                                <div className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Bước 2: Cấu Hình Ánh Xạ Cột & Thiết Lập Điều Kiện</div>
                                                <div className="text-[10px] text-slate-500">Ánh xạ các cột trong tệp Excel của bạn với các trường dữ liệu tương ứng để tìm kiếm chính xác nhất</div>
                                            </div>

                                            {/* Grid Mapping */}
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div className="space-y-3">
                                                    <div className="font-semibold text-slate-600 border-b pb-1">Chủ Sử Dụng, CCCD & Giấy Tờ</div>
                                                    
                                                    {/* Họ tên chủ */}
                                                    <div className="flex items-center justify-between gap-4">
                                                        <span className="font-medium text-slate-700">Họ tên chủ sử dụng:</span>
                                                        <select
                                                            className="px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs w-[180px] focus:outline-none"
                                                            value={columnMappings['hoten1']}
                                                            onChange={(e) => setColumnMappings(p => ({ ...p, hoten1: e.target.value }))}
                                                        >
                                                            <option value="">-- Không tìm kiếm --</option>
                                                            {excelHeaders.map(h => (
                                                                <option key={h} value={h}>{h}</option>
                                                            ))}
                                                        </select>
                                                    </div>

                                                    {/* Số CCCD */}
                                                    <div className="flex items-center justify-between gap-4">
                                                        <span className="font-medium text-slate-700">Số CCCD / CMND:</span>
                                                        <select
                                                            className="px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs w-[180px] focus:outline-none"
                                                            value={columnMappings['socccd']}
                                                            onChange={(e) => setColumnMappings(p => ({ ...p, socccd: e.target.value }))}
                                                        >
                                                            <option value="">-- Không tìm kiếm --</option>
                                                            {excelHeaders.map(h => (
                                                                <option key={h} value={h}>{h}</option>
                                                            ))}
                                                        </select>
                                                    </div>

                                                    {/* Số phát hành GCN */}
                                                    <div className="flex items-center justify-between gap-4">
                                                        <span className="font-medium text-slate-700">Số phát hành GCN:</span>
                                                        <select
                                                            className="px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs w-[180px] focus:outline-none"
                                                            value={columnMappings['sophathanhgcnmoi']}
                                                            onChange={(e) => setColumnMappings(p => ({ ...p, sophathanhgcnmoi: e.target.value }))}
                                                        >
                                                            <option value="">-- Không tìm kiếm --</option>
                                                            {excelHeaders.map(h => (
                                                                <option key={h} value={h}>{h}</option>
                                                            ))}
                                                        </select>
                                                    </div>

                                                    {/* Số vào sổ mới */}
                                                    <div className="flex items-center justify-between gap-4">
                                                        <span className="font-medium text-slate-700">Số vào sổ mới:</span>
                                                        <select
                                                            className="px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs w-[180px] focus:outline-none"
                                                            value={columnMappings['sovaosomoi']}
                                                            onChange={(e) => setColumnMappings(p => ({ ...p, sovaosomoi: e.target.value }))}
                                                        >
                                                            <option value="">-- Không tìm kiếm --</option>
                                                            {excelHeaders.map(h => (
                                                                <option key={h} value={h}>{h}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                </div>

                                                <div className="space-y-3">
                                                    <div className="font-semibold text-slate-600 border-b pb-1">Vị Trí Đất, Bản Đồ & Hồ Sơ</div>

                                                    {/* Tờ bản đồ */}
                                                    <div className="flex items-center justify-between gap-4">
                                                        <span className="font-medium text-slate-700">Tờ bản đồ:</span>
                                                        <select
                                                            className="px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs w-[180px] focus:outline-none"
                                                            value={columnMappings['tobando']}
                                                            onChange={(e) => setColumnMappings(p => ({ ...p, tobando: e.target.value }))}
                                                        >
                                                            <option value="">-- Không tìm kiếm --</option>
                                                            {excelHeaders.map(h => (
                                                                <option key={h} value={h}>{h}</option>
                                                            ))}
                                                        </select>
                                                    </div>

                                                    {/* Số thửa */}
                                                    <div className="flex items-center justify-between gap-4">
                                                        <span className="font-medium text-slate-700">Số thửa đất:</span>
                                                        <select
                                                            className="px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs w-[180px] focus:outline-none"
                                                            value={columnMappings['sothua']}
                                                            onChange={(e) => setColumnMappings(p => ({ ...p, sothua: e.target.value }))}
                                                        >
                                                            <option value="">-- Không tìm kiếm --</option>
                                                            {excelHeaders.map(h => (
                                                                <option key={h} value={h}>{h}</option>
                                                            ))}
                                                        </select>
                                                    </div>

                                                    {/* Mã biên nhận */}
                                                    <div className="flex items-center justify-between gap-4">
                                                        <span className="font-medium text-slate-700">Mã biên nhận (Số hiệu):</span>
                                                        <select
                                                            className="px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs w-[180px] focus:outline-none"
                                                            value={columnMappings['so_hieu']}
                                                            onChange={(e) => setColumnMappings(p => ({ ...p, so_hieu: e.target.value }))}
                                                        >
                                                            <option value="">-- Không tìm kiếm --</option>
                                                            {excelHeaders.map(h => (
                                                                <option key={h} value={h}>{h}</option>
                                                            ))}
                                                        </select>
                                                    </div>

                                                    {/* Loại hồ sơ */}
                                                    <div className="flex items-center justify-between gap-4">
                                                        <span className="font-medium text-slate-700">Loại hồ sơ:</span>
                                                        <select
                                                            className="px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs w-[180px] focus:outline-none"
                                                            value={columnMappings['loaihoso']}
                                                            onChange={(e) => setColumnMappings(p => ({ ...p, loaihoso: e.target.value }))}
                                                        >
                                                            <option value="">-- Không tìm kiếm --</option>
                                                            {excelHeaders.map(h => (
                                                                <option key={h} value={h}>{h}</option>
                                                            ))}
                                                        </select>
                                                    </div>

                                                    {/* Xã phường */}
                                                    <div className="flex items-center justify-between gap-4">
                                                        <span className="font-medium text-slate-700">Xã phường:</span>
                                                        <select
                                                            className="px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs w-[180px] focus:outline-none"
                                                            value={columnMappings['maxa']}
                                                            onChange={(e) => setColumnMappings(p => ({ ...p, maxa: e.target.value }))}
                                                        >
                                                            <option value="">-- Không tìm kiếm --</option>
                                                            {excelHeaders.map(h => (
                                                                <option key={h} value={h}>{h}</option>
                                                            ))}
                                                        </select>
                                                    </div>

                                                    {/* Chế độ đối chiếu */}
                                                    <div className="flex items-center justify-between gap-4 pt-2 border-t border-dashed">
                                                        <span className="font-bold text-slate-800">Phương thức đối chiếu:</span>
                                                        <div className="flex gap-2">
                                                            <button
                                                                type="button"
                                                                onClick={() => setMatchingMode('AND')}
                                                                className={`px-2.5 py-1.5 rounded-lg font-bold text-[10px] transition-all ${matchingMode === 'AND' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                                                            >
                                                                Trùng TOÀN BỘ (AND)
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => setMatchingMode('OR')}
                                                                className={`px-2.5 py-1.5 rounded-lg font-bold text-[10px] transition-all ${matchingMode === 'OR' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                                                            >
                                                                Trùng 1 TRONG CÁC (OR)
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Tips */}
                                            <div className="p-3 bg-amber-50 text-amber-800 rounded-xl border border-amber-150 text-[10px] leading-relaxed flex items-start gap-2">
                                                <AlertCircle size={14} className="shrink-0 text-amber-600 mt-0.5" />
                                                <div>
                                                    <strong>Mẹo Tra Cứu Hiệu Năng Cao:</strong> Hãy ưu tiên ánh xạ các trường có tính chất định danh cao như <strong>Số thửa đất & Số tờ bản đồ</strong>, hoặc <strong>Số CCCD</strong>, hoặc <strong>Số phát hành GCN</strong>. Việc này giúp hệ thống truy vấn thẳng vào tập chỉ mục (Index) hiệu năng cao, cho tốc độ xử lý nhanh gấp hàng trăm lần so với tìm theo họ tên.
                                                </div>
                                            </div>

                                            {/* Nút bấm Tìm kiếm */}
                                            <div className="pt-2 flex justify-end">
                                                <button
                                                    type="button"
                                                    onClick={handleExcelSearch}
                                                    className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold rounded-xl transition-all shadow-md shadow-indigo-600/10 hover:shadow-indigo-600/20 active:scale-95 flex items-center gap-1.5 cursor-pointer"
                                                >
                                                    <Search size={14} />
                                                    Bắt đầu tra cứu đối chiếu
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {/* TIẾN TRÌNH TÌM KIẾM DỮ LIỆU */}
                                    {isSearching && (
                                        <div className="bg-slate-50 border border-slate-200 p-6 rounded-2xl flex flex-col gap-4 text-center">
                                            <div className="flex flex-col items-center justify-center gap-2">
                                                <Loader2 size={36} className="animate-spin text-indigo-600" />
                                                <div className="text-xs font-bold text-slate-700 uppercase tracking-wide">Hệ thống đang đối chiếu dữ liệu kho lớn...</div>
                                                <div className="text-[11px] text-slate-500 font-semibold">
                                                    Đang quét dòng <strong>{searchCurrentRow}</strong> / <strong>{excelRows.length}</strong> trong tệp Excel
                                                </div>
                                            </div>

                                            {/* Progress Bar */}
                                            <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
                                                <div 
                                                    className="bg-indigo-600 h-full rounded-full transition-all duration-300"
                                                    style={{ width: `${searchProgress}%` }}
                                                ></div>
                                            </div>
                                            
                                            <div className="flex items-center justify-between text-[11px] text-slate-500 font-bold px-1">
                                                <span>Tiến trình: {searchProgress}%</span>
                                                <span className="text-emerald-600">Đã phát hiện: {searchFoundCount} bản ghi trùng khớp</span>
                                            </div>

                                            <button
                                                type="button"
                                                onClick={() => {
                                                    searchCancelRef.current = true;
                                                    setIsSearching(false);
                                                }}
                                                className="mt-2 py-2 px-4 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl font-bold border border-rose-100 transition-all self-center text-[11px] active:scale-95 cursor-pointer"
                                            >
                                                Hủy / Dừng Tra Cứu
                                            </button>
                                        </div>
                                    )}

                                    {/* BÁO CÁO KẾT QUẢ TÌM KIẾM & BẢNG KẾT QUẢ */}
                                    {showSearchSummary && (
                                        <div className="space-y-4 text-left">
                                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-emerald-50 border border-emerald-100 p-4 rounded-2xl">
                                                <div className="flex items-center gap-2 text-left">
                                                    <div className="p-1.5 bg-emerald-600 text-white rounded-lg shrink-0">
                                                        <CheckCircle2 size={16} />
                                                    </div>
                                                    <div>
                                                        <span className="text-xs font-extrabold text-slate-800">Hoàn tất tra cứu đối chiếu kho dữ liệu lớn!</span>
                                                        <p className="text-[10px] text-slate-500 font-medium mt-0.5">
                                                            Đã tìm thấy <strong className="text-emerald-600 font-bold">{searchResults.length}</strong> kết quả trùng khớp cho <strong className="text-indigo-600 font-bold">{excelRows.length}</strong> yêu cầu.
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex gap-2 shrink-0">
                                                    <button
                                                        type="button"
                                                        onClick={exportSearchResultsToExcel}
                                                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-[11px] shadow-md shadow-emerald-600/10 active:scale-95 flex items-center gap-1 transition-all cursor-pointer"
                                                    >
                                                        <Download size={12} /> Xuất Báo Cáo Đối Chiếu
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={resetExcelSearch}
                                                        className="px-3 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl font-semibold text-[11px] transition-all cursor-pointer"
                                                    >
                                                        Tìm kiếm tệp mới
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Results table */}
                                            {searchResults.length === 0 ? (
                                                <div className="text-center p-10 border border-dashed rounded-2xl text-slate-400 italic">
                                                    Không tìm thấy bất kỳ hồ sơ nào trong kho trùng khớp với danh sách các tiêu chí đã ánh xạ.
                                                </div>
                                            ) : (
                                                <div className="space-y-3 text-left">
                                                    <div className="text-xs font-bold text-slate-700">Chi Tiết Danh Sách Hồ Sơ Trùng Khớp Phát Hiện Được:</div>
                                                    <div className="border border-slate-150 rounded-2xl overflow-hidden bg-white">
                                                        <table className="w-full border-collapse text-left text-[11px]">
                                                            <thead className="bg-slate-50 border-b border-slate-150 text-slate-600 font-bold uppercase tracking-wider">
                                                                <tr>
                                                                    <th className="p-3 w-[80px] text-center">STT / Dòng</th>
                                                                    <th className="p-3 w-[250px]">Dữ liệu tra cứu gốc (Excel)</th>
                                                                    <th className="p-3">Hồ sơ phát hiện trong kho hệ thống (Supabase)</th>
                                                                    <th className="p-3 w-[120px] text-center">Thao tác</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-slate-100 font-medium text-slate-705">
                                                                {searchResults
                                                                    .slice((searchResultPage - 1) * searchResultItemsPerPage, searchResultPage * searchResultItemsPerPage)
                                                                    .map((item, idx) => {
                                                                        const orig = item.originalRow;
                                                                        const rec = item.matchedRecord;
                                                                        const d = rec.data || {};
                                                                        const realIndex = (searchResultPage - 1) * searchResultItemsPerPage + idx + 1;

                                                                        // Tạo chuỗi tóm tắt dữ liệu Excel gốc để đối chiếu trực quan
                                                                        const mappedKeys = Object.entries(columnMappings).filter(([_, exCol]) => !!exCol);
                                                                        
                                                                        return (
                                                                            <tr key={idx} className="hover:bg-indigo-50/10">
                                                                                <td className="p-3 text-center text-slate-400 font-mono">
                                                                                    <span className="font-bold text-slate-700">{realIndex}</span>
                                                                                    <div className="text-[9px] text-slate-400">Dòng {item.excelRowIndex}</div>
                                                                                </td>
                                                                                <td className="p-3 text-left">
                                                                                    <div className="space-y-1">
                                                                                        {mappedKeys.map(([dbKey, exCol]) => {
                                                                                            const val = orig[exCol];
                                                                                            if (val === undefined || val === '') return null;
                                                                                            let label = '';
                                                                                            if (dbKey === 'hoten1') label = 'Họ tên';
                                                                                            if (dbKey === 'socccd') label = 'CCCD';
                                                                                            if (dbKey === 'tobando') label = 'Tờ bđ';
                                                                                            if (dbKey === 'sothua') label = 'Thửa';
                                                                                            if (dbKey === 'sophathanhgcnmoi') label = 'GCN';
                                                                                            if (dbKey === 'so_hieu') label = 'Mã BN';
                                                                                            if (dbKey === 'loaihoso') label = 'Loại HS';
                                                                                            if (dbKey === 'sovaosomoi') label = 'Vào sổ';
                                                                                            if (dbKey === 'maxa') label = 'Xã phường';
                                                                                            return (
                                                                                                <div key={dbKey} className="text-[10px]">
                                                                                                    <span className="text-slate-400 font-medium">{label}:</span> <strong className="text-slate-700">{String(val)}</strong>
                                                                                                </div>
                                                                                            );
                                                                                        })}
                                                                                    </div>
                                                                                </td>
                                                                                <td className="p-3 text-xs text-left">
                                                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-left">
                                                                                        <div>
                                                                                            <div className="font-bold text-indigo-700 text-[11px]">{d.hoten1 || '-'}</div>
                                                                                            {d.socccd && <div className="text-[10px] text-slate-500 font-mono mt-0.5">CCCD: {d.socccd}</div>}
                                                                                            <div className="text-[10px] text-slate-600 mt-0.5">
                                                                                                Tờ: <strong className="text-slate-800">{d.tobando || '-'}</strong> / Thửa: <strong className="text-slate-800">{d.sothua || '-'}</strong>
                                                                                            </div>
                                                                                        </div>
                                                                                        <div className="border-l border-dashed border-slate-200 md:pl-3 text-[10px] text-slate-500 space-y-0.5 text-left">
                                                                                            <div>Mã hồ sơ: <strong className="text-slate-700 font-mono">{rec.so_hieu}</strong></div>
                                                                                            <div>Kệ/Tầng: <strong className="text-indigo-650 font-bold">{d.soke_tang || '-'}</strong></div>
                                                                                            <div>Hộp/Số ô: <strong className="text-indigo-600">{d.So_tep || d.so_tep || '-'}</strong> / ô <strong className="text-slate-700">{d.so_o || '-'}</strong></div>
                                                                                            {d.sott_tep && <div>STT trong hộp: <strong className="text-slate-700 font-mono">{d.sott_tep}</strong></div>}
                                                                                        </div>
                                                                                    </div>
                                                                                </td>
                                                                                <td className="p-3 text-center">
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={() => {
                                                                                            setSelectedRecord(rec);
                                                                                            setIsDetailOpen(true);
                                                                                        }}
                                                                                        className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 active:scale-95 text-indigo-700 rounded-lg text-[10px] font-bold transition-all shadow-sm cursor-pointer"
                                                                                    >
                                                                                        Xem chi tiết
                                                                                    </button>
                                                                                </td>
                                                                            </tr>
                                                                        );
                                                                    })}
                                                            </tbody>
                                                        </table>
                                                    </div>

                                                    {/* Phân trang kết quả tìm kiếm */}
                                                    {searchResults.length > searchResultItemsPerPage && (
                                                        <div className="flex items-center justify-between pt-2">
                                                            <div className="text-[10px] text-slate-500 font-semibold">
                                                                Hiển thị <strong>{(searchResultPage - 1) * searchResultItemsPerPage + 1}</strong> - <strong>{Math.min(searchResults.length, searchResultPage * searchResultItemsPerPage)}</strong> trong tổng số <strong>{searchResults.length}</strong> kết quả trùng khớp
                                                            </div>
                                                            <div className="flex items-center gap-1">
                                                                <button
                                                                    disabled={searchResultPage === 1}
                                                                    onClick={() => setSearchResultPage(1)}
                                                                    className="p-1.5 border rounded-lg bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-all cursor-pointer"
                                                                >
                                                                    <ChevronsLeft size={12} />
                                                                </button>
                                                                <button
                                                                    disabled={searchResultPage === 1}
                                                                    onClick={() => setSearchResultPage(p => Math.max(1, p - 1))}
                                                                    className="p-1.5 border rounded-lg bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-all cursor-pointer"
                                                                >
                                                                    <ChevronLeft size={12} />
                                                                </button>
                                                                <span className="px-3 py-1 bg-indigo-50 text-indigo-700 font-bold border border-indigo-100 rounded-lg">
                                                                    {searchResultPage} / {Math.ceil(searchResults.length / searchResultItemsPerPage)}
                                                                </span>
                                                                <button
                                                                    disabled={searchResultPage === Math.ceil(searchResults.length / searchResultItemsPerPage)}
                                                                    onClick={() => setSearchResultPage(p => Math.min(Math.ceil(searchResults.length / searchResultItemsPerPage), p + 1))}
                                                                    className="p-1.5 border rounded-lg bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-all cursor-pointer"
                                                                >
                                                                    <ChevronRight size={12} />
                                                                </button>
                                                                <button
                                                                    disabled={searchResultPage === Math.ceil(searchResults.length / searchResultItemsPerPage)}
                                                                    onClick={() => setSearchResultPage(Math.ceil(searchResults.length / searchResultItemsPerPage))}
                                                                    className="p-1.5 border rounded-lg bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-all cursor-pointer"
                                                                >
                                                                    <ChevronsRight size={12} />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 shrink-0">
                            <button
                                type="button"
                                onClick={() => {
                                    if (isSearching) {
                                        if (confirm("Đang trong quá trình tra cứu. Bạn có muốn dừng lại không?")) {
                                            searchCancelRef.current = true;
                                            setIsExcelSearchOpen(false);
                                            resetExcelSearch();
                                        }
                                    } else {
                                        setIsExcelSearchOpen(false);
                                        resetExcelSearch();
                                    }
                                }}
                                className="px-4 py-2 border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer"
                            >
                                Đóng lại
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default WarehouseView;
