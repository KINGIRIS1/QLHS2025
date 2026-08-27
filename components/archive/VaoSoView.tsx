import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ArchiveRecord, fetchArchiveRecords, saveArchiveRecord, deleteArchiveRecord, importArchiveRecords, updateArchiveRecordsBatch, deleteAllArchiveRecordsByType, initRealtimeArchive } from '../../services/apiArchive';
import { supabase } from '../../services/supabaseClient';
import { User } from '../../types';
import { Loader2, Plus, Search, Trash2, Upload, FileSpreadsheet, Send, CheckCircle2, X, History, Calendar, FileOutput, Settings, Hash, Edit, FileText, Download, AlertTriangle } from 'lucide-react';
import * as XLSX from 'xlsx-js-style';
import { confirmAction, showToast } from '../../utils/appHelpers';
import { saveAs } from 'file-saver';
import { exportSoDiaChinh, generateSoDiaChinhBlob } from '../../utils/exportSoDiaChinh';
import { exportSoMucKe } from '../../utils/exportSoMucKe';
import { getSystemSetting, saveSystemSetting } from '../../services/apiSystem';
import MortgageModal from './MortgageModal';
import DeleteAllModal from './DeleteAllModal';

// Định nghĩa các cột
const COLUMNS = [
    // Nhóm thông tin hồ sơ (Read-only by default)
    { key: 'ma_ho_so', label: 'Mã hồ sơ', width: '120px', readOnly: true },
    { key: 'group_chu_su_dung', label: 'Thông tin chủ sử dụng', width: '250px', readOnly: true },
    { key: 'group_thong_tin_ho_so', label: 'Thông tin hồ sơ', width: '200px', readOnly: true },
    { key: 'group_thua_dat', label: 'Thông tin thửa đất', width: '180px', readOnly: true },
    { key: 'dia_danh', label: 'Địa danh', width: '100px', readOnly: true },
    
    // Nhóm kết quả (Always editable or specific logic)
    { key: 'loai_gcn', label: 'Loại GCN', width: '120px' },
    { key: 'so_vao_so', label: 'Số vào sổ', width: '120px' }, // Thay vì 50px
    { key: 'so_phat_hanh', label: 'Số phát hành', width: '130px' }, // Thay vì 80px
    { key: 'ngay_ky_gcn', label: 'Ngày ký GCN', width: '120px', type: 'date' },
    { key: 'ngay_ky_phieu_tk', label: 'Chuyển Scan/1 Cửa', width: '120px', type: 'date' },
    { key: 'ghi_chu', label: 'GHI CHÚ', width: '200px' }
];

interface VaoSoViewProps {
    currentUser: User;
    wards: string[];
}

const VaoSoView: React.FC<VaoSoViewProps> = ({ currentUser, wards }) => {
    const [records, setRecords] = useState<ArchiveRecord[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'scanned' | 'cong-cu-vao-so' | 'priority'>('all');

    const priorityCount = useMemo(() => {
        return records.filter(r => Boolean(r.data?.isPriority) || Boolean(r.isPriority)).length;
    }, [records]);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [savingId, setSavingId] = useState<string | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const tempFileInputRef = useRef<HTMLInputElement>(null);

    // States cho công cụ Vào số GCN (Nhận diện mã HS từ Excel)
    const [tempRecords, setTempRecords] = useState<any[]>([]);
    const [tempRecordsLoading, setTempRecordsLoading] = useState(false);
    const [selectedTempIds, setSelectedTempIds] = useState<Set<string>>(new Set());
    const [tempExcelFileName, setTempExcelFileName] = useState('');
    
    // Modal xác nhận bàn giao 1 cửa
    const [showConfirmHandoverModal, setShowConfirmHandoverModal] = useState(false);
    const [handoverBatchMode, setHandoverBatchMode] = useState<'new' | 'existing'>('new');
    const [selectedExistingHandoverBatch, setSelectedExistingHandoverBatch] = useState<string>('');
    const [isSubmittingHandover, setIsSubmittingHandover] = useState(false);
    const suggestedHandoverBatch = "1";
    const existingHandoverBatches: string[] = [];

    // Modal xuất danh sách bàn giao 1 cửa
    const [showExportHandover1CuaModal, setShowExportHandover1CuaModal] = useState(false);
    const [exportHandover1CuaParams, setExportHandover1CuaParams] = useState({
        date: new Date().toISOString().split('T')[0],
        batch: '',
        ward: 'all'
    });
    
    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 50;

    // Batch Modal State
    const [showBatchModal, setShowBatchModal] = useState(false);

    // Export Handover Modal State
    const [showExportHandoverModal, setShowExportHandoverModal] = useState(false);

    // Export So Dia Chinh Modal State
    const [showExportSoDiaChinhModal, setShowExportSoDiaChinhModal] = useState(false);
    const [exportSoDiaChinhRange, setExportSoDiaChinhRange] = useState({ from: '', to: '' });
    const [exportSoDiaChinhCriteria, setExportSoDiaChinhCriteria] = useState({ ward: '', month: '', splitByLetter: false, exportTocOnly: false });

    // Mortgage Modal State
    const [showMortgageModal, setShowMortgageModal] = useState(false);
    const [selectedMortgageRecord, setSelectedMortgageRecord] = useState<ArchiveRecord | null>(null);

    // Export So Muc Ke State
    const [showExportSoMucKeModal, setShowExportSoMucKeModal] = useState(false);
    const [exportSoMucKeParams, setExportSoMucKeParams] = useState<{ ward: string; fromDate: string; toDate: string; targetType: 'new_owner' | 'old_owner' }>({ 
        ward: '', 
        fromDate: '', 
        toDate: '',
        targetType: 'new_owner'
    });

    // Settings Modal State
    const [showSettingsModal, setShowSettingsModal] = useState(false);
    const [currentBookNumber, setCurrentBookNumber] = useState<string>('000000');

    // Delete All Modal State
    const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);

    // Filters
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');
    const [filterWard, setFilterWard] = useState('');
    const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'scanned'>('all');

    useEffect(() => {
        loadData();
        
        initRealtimeArchive();
        
        const handleArchiveUpdate = (e: any) => {
            if (e.detail?.type === 'vaoso') {
                loadData();
            }
        };
        
        window.addEventListener('archive_realtime_update', handleArchiveUpdate);
        return () => window.removeEventListener('archive_realtime_update', handleArchiveUpdate);
    }, []);

    const loadData = async () => {
        setLoading(true);
        const data = await fetchArchiveRecords('vaoso');
        const deduplicated = Array.from(new Map(data.map(r => [r.id, r])).values());
        setRecords(deduplicated);
        
        // Calculate max book number from existing records
        let maxNum = 0;
        deduplicated.forEach(r => {
            const val = r.data?.so_vao_so || '';
            if (val.startsWith('CN ')) {
                const numPart = val.replace('CN ', '');
                const num = parseInt(numPart);
                if (!isNaN(num) && num > maxNum) {
                    maxNum = num;
                }
            } else {
                 // Fallback for old format if just number
                 const num = parseInt(val);
                 if (!isNaN(num) && num > maxNum) {
                    maxNum = num;
                }
            }
        });
        
        // If local storage has a higher number, use it
        const stored = await getSystemSetting('vaoso_current_book_number');
        if (stored) {
            setCurrentBookNumber(stored);
        } else {
            setCurrentBookNumber(maxNum.toString().padStart(6, '0'));
        }
        
        setLoading(false);
    };

    const filteredRecords = useMemo(() => {
        let baseList = records.filter(r => !r.is_cancelled && !r.isCancelled && !r.data?.is_cancelled && !r.data?.isCancelled);
        let filtered = baseList;

        // Filter by Tab (Status)
        // If user selects status from dropdown, it overrides the tab logic or syncs with it.
        // Let's make the dropdown control the activeTab state for consistency.
        // But here we use activeTab directly.
        
        if (activeTab === 'all') {
            // Danh sách tổng: Hiển thị tất cả
            filtered = baseList;
        } else if (activeTab === 'pending') {
            // Chờ chuyển Scan: Đã được đánh dấu chuyển scan NHƯNG chưa có đợt scan (chưa scan xong)
            filtered = baseList.filter(r => r.data?.is_pending_scan && !r.data?.is_scanned);
        } else if (activeTab === 'scanned') {
            // Đã chuyển Scan: Đã có đợt scan
            filtered = baseList.filter(r => r.data?.is_scanned);
        } else if (activeTab === 'priority') {
            filtered = baseList.filter(r => Boolean(r.data?.isPriority) || Boolean(r.isPriority));
        }

        // Filter by Date (Ngày nhận)
        if (fromDate) filtered = filtered.filter(r => r.data?.ngay_nhan >= fromDate);
        if (toDate) filtered = filtered.filter(r => r.data?.ngay_nhan <= toDate);

        // Filter by Ward (Địa danh)
        if (filterWard) filtered = filtered.filter(r => r.data?.dia_danh === filterWard);

        // Filter by Search
        if (searchTerm) {
            const lower = searchTerm.toLowerCase();
            filtered = filtered.filter(r => 
                r.so_hieu?.toLowerCase().includes(lower) ||
                r.trich_yeu?.toLowerCase().includes(lower) ||
                JSON.stringify(r.data).toLowerCase().includes(lower)
            );
        }

        return filtered;
    }, [records, searchTerm, activeTab, fromDate, toDate, filterWard]);

    // Pagination
    const totalPages = Math.ceil(filteredRecords.length / itemsPerPage);
    const paginatedRecords = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return filteredRecords.slice(start, start + itemsPerPage);
    }, [filteredRecords, currentPage]);

    // Reset page when tab or search changes
    useEffect(() => {
        setCurrentPage(1);
        setSelectedIds(new Set()); // Clear selection on tab change
    }, [activeTab, searchTerm]);

    const handleAddNew = async () => {
        const newRecord: Partial<ArchiveRecord> = {
            type: 'vaoso',
            status: 'completed',
            so_hieu: '',
            trich_yeu: '',
            ngay_thang: new Date().toISOString().split('T')[0],
            noi_nhan_gui: '',
            created_by: currentUser.username,
            data: {
                so_vao_so: '',
                ma_ho_so: '',
                ten_chuyen_quyen: '',
                ten_chu_su_dung: '',
                loai_bien_dong: '',
                loai_gcn: 'GCN mới',
                ngay_nhan: new Date().toISOString().split('T')[0],
                so_to: '',
                so_thua: '',
                tong_dien_tich: '',
                dien_tich_tho_cu: '',
                dia_danh: '',
                so_phat_hanh: '',
                ngay_ky_gcn: '',
                ngay_ky_phieu_tk: '',
                ghi_chu: ''
            }
        };
        
        const saved = await saveArchiveRecord(newRecord);
        if (saved) {
            setEditingId(saved.id);
            loadData();
        }
    };

    const handleDelete = async (id: string) => {
        if (currentUser.role !== 'ADMIN') { showToast('Chỉ Quản trị viên (Admin) mới có quyền xóa hồ sơ!', 'error'); return; }
        if (await confirmAction("Bạn có chắc chắn muốn xóa hồ sơ này?")) {
            await deleteArchiveRecord(id);
            loadData();
        }
    };

    const handleDeleteAll = async () => {
        if (currentUser.role !== 'ADMIN') { showToast('Chỉ Quản trị viên (Admin) mới có quyền xóa tất cả!', 'error'); return; }
        await deleteAllArchiveRecordsByType('vaoso');
        loadData();
    };

    const handleCellChange = (id: string, key: string, value: string) => {
        setRecords(prev => prev.map(r => {
            if (r.id === id) {
                return { ...r, data: { ...r.data, [key]: value } };
            }
            return r;
        }));
    };

    const handleBlur = async (record: ArchiveRecord) => {
        setSavingId(record.id);
        await saveArchiveRecord(record);
        setSavingId(null);
    };

    const toggleEdit = (id: string) => {
        if (editingId === id) {
            setEditingId(null);
        } else {
            setEditingId(id);
        }
    };

    const incrementString = (str: string): string => {
        const num = parseInt(str);
        if (isNaN(num)) return str;
        const nextNum = num + 1;
        // Preserve length if original had leading zeros
        if (str.length > nextNum.toString().length) {
            return nextNum.toString().padStart(str.length, '0');
        }
        return nextNum.toString();
    };

    const handleGetBookNumber = async (record: ArchiveRecord) => {
        // Fetch latest to avoid conflicts if possible
        const latestStored = await getSystemSetting('vaoso_current_book_number');
        const baseNum = latestStored || currentBookNumber;
        const nextNumStr = incrementString(baseNum);
        const formattedNum = `CN ${nextNumStr}`;
        
        const updatedRecord = {
            ...record,
            data: { ...record.data, so_vao_so: formattedNum }
        };
        
        // Optimistic update
        setRecords(prev => prev.map(r => r.id === record.id ? updatedRecord : r));
        setCurrentBookNumber(nextNumStr);
        await saveSystemSetting('vaoso_current_book_number', nextNumStr);

        setSavingId(record.id);
        await saveArchiveRecord(updatedRecord);
        setSavingId(null);
    };

    // --- CÁC HÀM XỬ LÝ CHO CÔNG CỤ VÀO SỐ GCN MỚI ---
    const handleTempImportClick = () => {
        tempFileInputRef.current?.click();
    };

    const handleTempCellChange = (index: number, key: string, value: any) => {
        setTempRecords(prev => prev.map((r, i) => {
            if (i === index) {
                return { ...r, [key]: value };
            }
            return r;
        }));
    };

    const handleDeleteTempRow = (index: number) => {
        setTempRecords(prev => prev.filter((_, i) => i !== index));
        const updatedSelected = new Set(selectedTempIds);
        updatedSelected.delete(String(index));
        setSelectedTempIds(updatedSelected);
    };

    const handleSelectTempRow = (index: number) => {
        const newSet = new Set(selectedTempIds);
        const strIdx = String(index);
        if (newSet.has(strIdx)) newSet.delete(strIdx);
        else newSet.add(strIdx);
        setSelectedTempIds(newSet);
    };

    const handleSelectAllTempRows = () => {
        if (selectedTempIds.size === tempRecords.length) {
            setSelectedTempIds(new Set());
        } else {
            setSelectedTempIds(new Set(tempRecords.map((_, i) => String(i))));
        }
    };

    const handleGetTempBookNumber = async (index: number) => {
        const latestStored = await getSystemSetting('vaoso_current_book_number');
        const baseNum = latestStored || currentBookNumber;
        const nextNumStr = incrementString(baseNum);
        const formattedNum = `CN ${nextNumStr}`;

        setTempRecords(prev => prev.map((r, i) => {
            if (i === index) {
                return { ...r, soVaoSo: formattedNum };
            }
            return r;
        }));

        setCurrentBookNumber(nextNumStr);
        await saveSystemSetting('vaoso_current_book_number', nextNumStr);
    };

    const handleAutoAssignAllTempBookNumbers = async () => {
        const latestStored = await getSystemSetting('vaoso_current_book_number');
        let currentNumStr = latestStored || currentBookNumber;
        
        const updated = tempRecords.map(r => {
            if (!r.soVaoSo) {
                currentNumStr = incrementString(currentNumStr);
                return { ...r, soVaoSo: `CN ${currentNumStr}` };
            }
            return r;
        });

        setTempRecords(updated);
        setCurrentBookNumber(currentNumStr);
        await saveSystemSetting('vaoso_current_book_number', currentNumStr);
    };

    const handleTempExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setTempExcelFileName(file.name);
        setTempRecordsLoading(true);

        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

                // Tìm dòng tiêu đề
                let headerRowIdx = -1;
                for (let i = 0; i < Math.min(data.length, 15); i++) {
                    const rowStr = JSON.stringify(data[i]).toLowerCase();
                    if (rowStr.includes('mã hồ sơ') || rowStr.includes('mã hs') || rowStr.includes('số hồ sơ') || rowStr.includes('mã nhận diện') || rowStr.includes('code')) {
                        headerRowIdx = i;
                        break;
                    }
                }

                if (headerRowIdx === -1) {
                    headerRowIdx = 0;
                }

                const rawHeaderRow = data[headerRowIdx] || [];
                const headers = Array.from(rawHeaderRow).map((h: any) => String(h || '').trim().toLowerCase());
                const rows = data.slice(headerRowIdx + 1);

                const findCol = (keywords: string[], excludes: string[] = []) => 
                    headers.findIndex(h => h && keywords.some(k => h.includes(k)) && !excludes.some(e => h.includes(e)));

                const colMap = {
                    ma_ho_so: findCol(['mã hồ sơ', 'mã hs', 'số hồ sơ', 'mã nhận diện', 'code']),
                    so_to: findCol(['tờ', 'số tờ', 'bản đồ', 'tờ bản đồ']),
                    so_thua: findCol(['thửa', 'số thửa', 'thửa đất']),
                    tong_dien_tich: findCol(['tổng diện tích', 'diện tích', 'dt', 'area']),
                    dat_o: findCol(['đất ở', 'thổ cư', 'ont', 'odt', 'đất ở đô thị', 'đất ở nông thôn']),
                    dat_nn: findCol(['đất nông nghiệp', 'đất nn', 'nông nghiệp', 'cln', 'hnc', 'đất trồng cây']),
                    so_phat_hanh: findCol(['phát hành', 'seri', 'seri gcn', 'số phát hành', 'số seri']),
                    so_vao_so: findCol(['số vào sổ', 'svs', 'số vào']),
                    ngay_ky_gcn: findCol(['ngày ký', 'ngày ký gcn', 'ngày cấp', 'ngày cấp gcn']),
                    ten_chu_su_dung: findCol(['chủ sử dụng', 'tên chủ', 'họ tên', 'bên nhận', 'người sử dụng', 'khách hàng', 'customer'])
                };

                if (colMap.ma_ho_so === -1) {
                    alert("Không tìm thấy cột chứa Mã hồ sơ trong file Excel. Vui lòng kiểm tra lại cấu trúc file.");
                    setTempRecordsLoading(false);
                    return;
                }

                const getValue = (row: any[], idx: number) => {
                    if (idx === -1 || !row) return '';
                    let val = row[idx];
                    if (val === undefined || val === null) return '';
                    
                    if (typeof val === 'number' && val > 20000 && val < 60000) {
                         const date = new Date(Math.round((val - 25569) * 86400 * 1000));
                         return date.toISOString().split('T')[0];
                    }
                    
                    const str = String(val).trim();
                    if (/^\d{1,2}[-/]\d{1,2}[-/]\d{2,4}$/.test(str)) {
                        const parts = str.split(/[-/]/);
                        if (parts.length === 3) {
                            if (parts[0].length === 4) {
                                return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
                            } else {
                                const day = parts[0].padStart(2, '0');
                                const month = parts[1].padStart(2, '0');
                                const year = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
                                return `${year}-${month}-${day}`;
                            }
                        }
                    }
                    return str;
                };

                const excelRowsData: any[] = [];
                const codesToQuery: string[] = [];

                rows.forEach(row => {
                    if (!row || row.length === 0) return;
                    const code = getValue(row, colMap.ma_ho_so);
                    if (!code) return;

                    codesToQuery.push(code);

                    excelRowsData.push({
                        code: code,
                        so_to: getValue(row, colMap.so_to),
                        so_thua: getValue(row, colMap.so_thua),
                        tong_dien_tich: getValue(row, colMap.tong_dien_tich),
                        dat_o: getValue(row, colMap.dat_o),
                        dat_nn: getValue(row, colMap.dat_nn),
                        so_phat_hanh: getValue(row, colMap.so_phat_hanh),
                        so_vao_so: getValue(row, colMap.so_vao_so),
                        ngay_ky_gcn: getValue(row, colMap.ngay_ky_gcn) || new Date().toISOString().split('T')[0],
                        ten_chu_su_dung: getValue(row, colMap.ten_chu_su_dung)
                    });
                });

                if (codesToQuery.length === 0) {
                    alert("Không tìm thấy mã hồ sơ nào trong tệp Excel.");
                    setTempRecordsLoading(false);
                    return;
                }

                // Chuẩn hóa và mở rộng mã để tăng tỷ lệ khớp (chữ hoa, chữ thường, loại bỏ khoảng trắng)
                const expandedCodes = new Set<string>();
                codesToQuery.forEach(c => {
                    expandedCodes.add(c);
                    expandedCodes.add(c.toLowerCase());
                    expandedCodes.add(c.toUpperCase());
                    const normalized = c.trim().toLowerCase().replace(/[\u200B-\u200D\uFEFF]/g, '').replace(/\s+/g, '');
                    expandedCodes.add(normalized);
                    expandedCodes.add(normalized.toUpperCase());
                });
                const expandedCodesArray = Array.from(expandedCodes);

                // Truy vấn bảng igate_records (hồ sơ iGate gốc)
                const { data: dbRecords, error: dbError } = await supabase
                    .from('igate_records')
                    .select('*')
                    .in('so_hieu', expandedCodesArray);

                if (dbError) {
                    console.error("Lỗi truy vấn hồ sơ hệ thống: ", dbError);
                }

                const finalTempRecords = excelRowsData.map(excelRow => {
                    // So sánh không phân biệt chữ hoa/thường và khoảng trắng thừa/ký tự ẩn
                    const matchedDb = dbRecords?.find(dbRec => {
                        const dbCodeNorm = String(dbRec.so_hieu || '').trim().toLowerCase().replace(/[\u200B-\u200D\uFEFF]/g, '').replace(/\s+/g, '');
                        const excelCodeNorm = String(excelRow.code || '').trim().toLowerCase().replace(/[\u200B-\u200D\uFEFF]/g, '').replace(/\s+/g, '');
                        return dbCodeNorm === excelCodeNorm;
                    });
                    
                    return {
                       id: matchedDb?.id,
                       code: excelRow.code,
                       customerName: excelRow.ten_chu_su_dung || matchedDb?.chu_ho_so || '',
                       mapSheet: excelRow.so_to || matchedDb?.so_to || '',
                       landPlot: excelRow.so_thua || matchedDb?.so_thua || '',
                       area: excelRow.tong_dien_tich || matchedDb?.tong_dien_tich || '',
                       datO: excelRow.dat_o || matchedDb?.dien_tich_dat_o || '',
                       datNongNghiep: excelRow.dat_nn || '',
                       soPhatHanh: excelRow.so_phat_hanh || matchedDb?.so_phat_hanh || '',
                       soVaoSo: excelRow.so_vao_so || '',
                       ngayKyGcn: excelRow.ngay_ky_gcn || new Date().toISOString().split('T')[0],
                       diaDanh: matchedDb?.dia_danh || '',
                       existsInSystem: !!matchedDb,
                       db_customerName: matchedDb?.chu_ho_so || '',
                       db_mapSheet: matchedDb?.so_to || '',
                       db_landPlot: matchedDb?.so_thua || '',
                       db_area: matchedDb?.tong_dien_tich || ''
                    };
                });

                setTempRecords(finalTempRecords);

            } catch (error) {
                console.error("Lỗi xử lý Excel:", error);
                alert("Đã xảy ra lỗi khi xử lý tệp Excel.");
            } finally {
                setTempRecordsLoading(false);
                if (e.target) e.target.value = '';
            }
        };

        reader.readAsBinaryString(file);
    };

    const handleConfirmHandover = async (batchNum: string, dateStr: string) => {
        if (tempRecords.length === 0) return;
        setIsSubmittingHandover(true);

        try {
            const todayStr = dateStr || new Date().toISOString().split('T')[0];
            const batchId = batchNum || '1';

            const archivePromises = tempRecords.map(async (r) => {
                if (r.existsInSystem && r.id) {
                    const hasChanged = r.customerName !== r.db_customerName ||
                                      String(r.mapSheet) !== String(r.db_mapSheet) ||
                                      String(r.landPlot) !== String(r.db_landPlot) ||
                                      String(r.area) !== String(r.db_area);
                    
                    if (hasChanged) {
                        const { error: updateError } = await supabase
                            .from('igate_records')
                            .update({
                                chu_ho_so: r.customerName,
                                so_to: r.mapSheet,
                                so_thua: r.landPlot,
                                tong_dien_tich: parseFloat(r.area) || null,
                                dien_tich_dat_o: parseFloat(r.datO) || null
                            })
                            .eq('id', r.id);
                        
                        if (updateError) {
                            console.error(`Lỗi cập nhật hồ sơ gốc ${r.code}:`, updateError);
                        }
                    }

                    // Đồng thời, cập nhật trạng thái hồ sơ iGate thành "Đã ký Giấy chứng nhận", lưu Số vào sổ và Ngày ký GCN vào iGate (igate_records)
                    const { error: statusError } = await supabase
                        .from('igate_records')
                        .update({
                            trang_thai: 'Đã ký Giấy chứng nhận',
                            so_vao_so: r.soVaoSo,
                            so_phat_hanh: r.soPhatHanh,
                            ngay_ket_thuc: r.ngayKyGcn // Ngày ký GCN chính là ngày đạt trạng thái này
                        })
                        .eq('id', r.id);
                    
                    if (statusError) {
                        console.error(`Lỗi cập nhật trạng thái hồ sơ iGate ${r.code}:`, statusError);
                    }
                } else {
                    // Nếu hồ sơ chưa tồn tại trên hệ thống iGate (r.existsInSystem === false)
                    // Ta sẽ tự động insert mới một hồ sơ iGate vào bảng 'igate_records'
                    const { error: insertError } = await supabase
                        .from('igate_records')
                        .insert([{
                            so_hieu: r.code,
                            chu_ho_so: r.customerName,
                            so_to: r.mapSheet,
                            so_thua: r.landPlot,
                            tong_dien_tich: parseFloat(r.area) || null,
                            dien_tich_dat_o: parseFloat(r.datO) || null,
                            dia_danh: r.diaDanh || '',
                            so_phat_hanh: r.soPhatHanh || '',
                            so_vao_so: r.soVaoSo || '',
                            ngay_ket_thuc: r.ngayKyGcn || todayStr,
                            trang_thai: 'Đã ký Giấy chứng nhận',
                            don_vi: 'Chi nhánh VPĐKĐĐ',
                            ten_linh_vuc: 'Đất đai',
                            ten_thu_tuc: 'Đăng ký đất đai lần đầu',
                            ngay_tiep_nhan: todayStr
                        }]);
                    
                    if (insertError) {
                        console.error(`Lỗi tự động thêm mới hồ sơ iGate ${r.code}:`, insertError);
                    }
                }

                const archiveData = {
                    so_vao_so: r.soVaoSo,
                    ma_ho_so: r.code,
                    ten_chuyen_quyen: '',
                    ten_chu_su_dung: r.customerName,
                    loai_bien_dong: 'Vào số GCN',
                    loai_gcn: 'GCN mới',
                    ngay_nhan: todayStr,
                    so_to: r.mapSheet,
                    so_thua: r.landPlot,
                    tong_dien_tich: r.area,
                    dien_tich_tho_cu: r.datO,
                    dien_tich_nong_nghiep: r.datNongNghiep,
                    dia_danh: r.diaDanh,
                    so_phat_hanh: r.soPhatHanh,
                    ngay_ky_gcn: r.ngayKyGcn,
                    ngay_ky_phieu_tk: '',
                    ghi_chu: r.existsInSystem ? '' : 'Mã hồ sơ không tồn tại trên iGate',
                    is_pending_scan: false,
                    is_scanned: true,
                    scan_batch_id: String(batchId),
                    scan_date: todayStr
                };

                const newArchiveRecord: Partial<ArchiveRecord> = {
                    type: 'vaoso',
                    status: 'completed',
                    so_hieu: r.code,
                    trich_yeu: `Vào số GCN - ${r.customerName}`,
                    ngay_thang: r.ngayKyGcn,
                    noi_nhan_gui: r.diaDanh,
                    created_by: currentUser.username,
                    data: archiveData
                };

                return saveArchiveRecord(newArchiveRecord);
            });

            await Promise.all(archivePromises);

            alert(`Đã hoàn thành cập nhật hệ thống và bàn giao ${tempRecords.length} hồ sơ vào Danh sách số ${batchId}!`);
            
            await loadData();
            
            setTempRecords([]);
            setTempExcelFileName('');
            setSelectedTempIds(new Set());
            setShowConfirmHandoverModal(false);

        } catch (error) {
            console.error("Lỗi xác nhận bàn giao:", error);
            alert("Đã xảy ra lỗi khi thực hiện bàn giao hồ sơ.");
        } finally {
            setIsSubmittingHandover(false);
        }
    };

    const exportHandover1CuaExcel = (recordsToExport: ArchiveRecord[], dateVal: string, batchVal: string, wardVal: string) => {
        if (recordsToExport.length === 0) {
            alert('Không tìm thấy hồ sơ bàn giao nào thỏa mãn điều kiện lọc.');
            return;
        }

        const wb = XLSX.utils.book_new();
        const wsData: any[] = [];

        wsData.push(['ỦY BAN NHÂN DÂN HUYỆN']);
        wsData.push(['BỘ PHẬN TIẾP NHẬN & TRẢ KẾT QUẢ']);
        wsData.push(['']); 

        const title = `DANH SÁCH BÀN GIAO GIẤY CHỨNG NHẬN QUYỀN SỬ DỤNG ĐẤT SANG MỘT CỬA`;
        wsData.push([title]);
        
        const dateParts = dateVal.split('-');
        const formattedDate = dateParts.length === 3 ? `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}` : dateVal;
        wsData.push([`Ngày bàn giao: ${formattedDate} - Đợt giao: Danh sách số ${batchVal}`]);
        
        let subTitle = `Tổng số hồ sơ: ${recordsToExport.length}`;
        if (wardVal !== 'all') {
            subTitle = `Xã/Phường: ${wardVal} - ${subTitle}`;
        }
        wsData.push([subTitle]);
        wsData.push(['']); 

        const headers = [
            'STT', 
            'Số vào sổ', 
            'Mã hồ sơ', 
            'Chủ sử dụng đất', 
            'Số tờ', 
            'Số thửa', 
            'Tổng diện tích (m2)', 
            'Đất ở (m2)', 
            'Đất nông nghiệp (m2)', 
            'Số phát hành GCN', 
            'Ngày ký GCN', 
            'Địa danh (Xã)', 
            'Ký nhận',
            'Ghi chú'
        ];
        wsData.push(headers);

        recordsToExport.forEach((r, idx) => {
            wsData.push([
                idx + 1,
                r.data?.so_vao_so || '',
                r.data?.ma_ho_so || '',
                r.data?.ten_chu_su_dung || '',
                r.data?.so_to || '',
                r.data?.so_thua || '',
                r.data?.tong_dien_tich || '',
                r.data?.dien_tich_tho_cu || '',
                r.data?.dien_tich_nong_nghiep || '',
                r.data?.so_phat_hanh || '',
                r.data?.ngay_ky_gcn ? new Date(r.data.ngay_ky_gcn).toLocaleDateString('vi-VN') : '',
                r.data?.dia_danh || '',
                '', 
                r.data?.ghi_chu || ''
            ]);
        });

        wsData.push(['']);
        wsData.push(['']);
        wsData.push(['BÊN GIAO (VPĐKĐĐ)', '', '', '', '', '', '', 'BÊN NHẬN (MỘT CỬA)']);

        const ws = XLSX.utils.aoa_to_sheet(wsData);

        const lastCol = headers.length - 1;
        const merges = [
            { s: { r: 0, c: 0 }, e: { r: 0, c: 4 } },
            { s: { r: 1, c: 0 }, e: { r: 1, c: 4 } },
            { s: { r: 3, c: 0 }, e: { r: 3, c: lastCol } },
            { s: { r: 4, c: 0 }, e: { r: 4, c: lastCol } },
            { s: { r: 5, c: 0 }, e: { r: 5, c: lastCol } },
            { s: { r: wsData.length - 1, c: 0 }, e: { r: wsData.length - 1, c: 3 } },
            { s: { r: wsData.length - 1, c: 7 }, e: { r: wsData.length - 1, c: lastCol } },
        ];
        ws['!merges'] = merges;

        ws['!cols'] = [
            { wch: 5 },  
            { wch: 15 }, 
            { wch: 15 }, 
            { wch: 25 }, 
            { wch: 8 },  
            { wch: 8 },  
            { wch: 18 }, 
            { wch: 12 }, 
            { wch: 18 }, 
            { wch: 18 }, 
            { wch: 15 }, 
            { wch: 15 }, 
            { wch: 12 }, 
            { wch: 15 }  
        ];

        const styleTitle = { font: { bold: true, sz: 14 }, alignment: { horizontal: 'center', vertical: 'center' } };
        const styleSub = { font: { italic: true, sz: 11 }, alignment: { horizontal: 'center', vertical: 'center' } };
        const styleLeftBold = { font: { bold: true, sz: 11 }, alignment: { horizontal: 'center' } };
        const styleHeader = { 
            font: { bold: true }, 
            alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
            border: { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } },
            fill: { fgColor: { rgb: "E8F5E9" } } 
        };
        const styleCell = { 
            border: { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } },
            alignment: { vertical: 'center' }
        };
        const styleCellCenter = { ...styleCell, alignment: { horizontal: 'center', vertical: 'center' } };

        ws['A1'].s = styleLeftBold;
        ws['A2'].s = { font: { bold: true, sz: 10, underline: true }, alignment: { horizontal: 'center' } };
        ws[XLSX.utils.encode_cell({ r: 3, c: 0 })].s = styleTitle;
        ws[XLSX.utils.encode_cell({ r: 4, c: 0 })].s = styleSub;
        ws[XLSX.utils.encode_cell({ r: 5, c: 0 })].s = { font: { bold: true }, alignment: { horizontal: 'center' } };

        const headerRowIdx = 7;
        for (let c = 0; c <= lastCol; c++) {
            const cellRef = XLSX.utils.encode_cell({ r: headerRowIdx, c: c });
            if (ws[cellRef]) ws[cellRef].s = styleHeader;
        }

        for (let r = headerRowIdx + 1; r < wsData.length - 3; r++) {
            for (let c = 0; c <= lastCol; c++) {
                const cellRef = XLSX.utils.encode_cell({ r: r, c: c });
                if (!ws[cellRef]) ws[cellRef] = { v: '', t: 's' };
                ws[cellRef].s = styleCell;
                if ([0, 1, 2, 4, 5, 10, 11].includes(c)) {
                    ws[cellRef].s = styleCellCenter;
                }
            }
        }

        const sigIdx = wsData.length - 1;
        ws[XLSX.utils.encode_cell({ r: sigIdx, c: 0 })].s = { font: { bold: true }, alignment: { horizontal: 'center' } };
        ws[XLSX.utils.encode_cell({ r: sigIdx, c: 7 })].s = { font: { bold: true }, alignment: { horizontal: 'center' } };

        XLSX.utils.book_append_sheet(wb, ws, "DanhSach1Cua");
        XLSX.writeFile(wb, `DanhSachBanGiao_1Cua_Dot${batchVal}_Ngay${dateVal}.xlsx`);
        setShowExportHandover1CuaModal(false);
    };

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleDownloadTemplate = () => {
        const templateData = [
            {
                'Số vào sổ': 'CN 00001',
                'Mã hồ sơ': 'HS001',
                'Tên chuyển quyền': 'Nguyễn Văn A',
                'Tên chủ sử dụng': 'Trần Thị B',
                'Loại biến động': 'Chuyển nhượng',
                'Loại GCN': 'GCN mới',
                'Ngày nhận': '2023-10-25',
                'Số tờ': '12',
                'Số thửa': '34',
                'Tổng diện tích': '150.5',
                'Diện tích thổ cư': '100',
                'Địa danh': 'Phường 1',
                'Số phát hành': 'CQ123456',
                'Ngày ký GCN': '2023-11-01',
                'Ngày ký phiếu TK': '2023-11-02',
                'Ghi chú': 'Ghi chú mẫu'
            }
        ];
        const ws = XLSX.utils.json_to_sheet(templateData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "MauNhapLieu");
        XLSX.writeFile(wb, "Mau_Nhap_Lieu_Vao_So_GCN.xlsx");
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setLoading(true);
        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

                // Tìm dòng tiêu đề
                let headerRowIdx = -1;
                for (let i = 0; i < Math.min(data.length, 10); i++) {
                    const rowStr = JSON.stringify(data[i]).toLowerCase();
                    if (rowStr.includes('mã hồ sơ') || rowStr.includes('chủ sử dụng')) {
                        headerRowIdx = i;
                        break;
                    }
                }

                if (headerRowIdx === -1) {
                    alert("Không tìm thấy dòng tiêu đề hợp lệ trong file Excel.");
                    return;
                }

                const rawHeaderRow = data[headerRowIdx] || [];
                const headers = Array.from(rawHeaderRow).map((h: any) => String(h || '').trim().toLowerCase());
                
                const rows = data.slice(headerRowIdx + 1);
                
                const newRecords: Partial<ArchiveRecord>[] = [];

                // Helper tìm index cột với loại trừ
                const findCol = (keywords: string[], excludes: string[] = []) => 
                    headers.findIndex(h => h && keywords.some(k => h.includes(k)) && !excludes.some(e => h.includes(e)));

                // Logic tìm cột Tên chủ sử dụng (Ưu tiên các từ khóa rõ ràng trước)
                let tenChuSuDungIdx = findCol(['bên nhận', 'người nhận', 'bên b', 'người được cấp', 'chủ mới']);
                if (tenChuSuDungIdx === -1) {
                    // Nếu không thấy, tìm các từ khóa chung nhưng loại trừ từ khóa chuyển nhượng
                    tenChuSuDungIdx = findCol(
                        ['tên chủ', 'người sử dụng', 'chủ sử dụng', 'họ tên', 'tên nsd', 'chủ hộ', 'được cấp', 'tên người'], 
                        ['chuyển quyền', 'chuyển nhượng', 'bên a', 'bên chuyển', 'người chuyển', 'chủ cũ']
                    );
                }

                const colMap = {
                    so_vao_so: findCol(['số vào sổ', 'svs', 'số vào']),
                    ma_ho_so: findCol(['mã hồ sơ', 'mã hs', 'số hồ sơ']),
                    ten_chuyen_quyen: findCol(['chuyển quyền', 'chuyển nhượng', 'bên a', 'bên chuyển', 'người chuyển', 'chủ cũ']),
                    ten_chu_su_dung: tenChuSuDungIdx,
                    loai_bien_dong: findCol(['biến động', 'loại hồ sơ', 'nội dung']),
                    loai_gcn: findCol(['loại gcn', 'gcn']),
                    ngay_nhan: findCol(['ngày nhận', 'ngày nộp']),
                    so_to: findCol(['tờ', 'số tờ']),
                    so_thua: findCol(['thửa', 'số thửa']),
                    tong_dien_tich: findCol(['tổng diện tích', 'dt', 'diện tích']),
                    dien_tich_tho_cu: findCol(['thổ cư', 'ont', 'odt']),
                    dia_danh: findCol(['địa danh', 'địa chỉ', 'vị trí']),
                    so_phat_hanh: findCol(['số phát hành', 'số seri', 'seri']),
                    ngay_ky_gcn: findCol(['ký gcn', 'ngày ký giấy', 'ngày cấp']),
                    ngay_ky_phieu_tk: findCol(['phiếu tk', 'chuyển scan']),
                    ghi_chu: findCol(['ghi chú'])
                };

                rows.forEach(row => {
                    if (!row || row.length === 0) return;
                    if (!row[colMap.ma_ho_so] && !row[colMap.ten_chu_su_dung]) return;

                    const getValue = (idx: number) => {
                        if (idx === -1) return '';
                        let val = row[idx];
                        if (val === undefined || val === null) return '';
                        
                        // Xử lý ngày tháng Excel (serial number)
                        if (typeof val === 'number' && val > 20000 && val < 60000) {
                             const date = new Date(Math.round((val - 25569) * 86400 * 1000));
                             return date.toISOString().split('T')[0];
                        }
                        
                        const str = String(val).trim();
                        
                        // Check if it looks like a date (DD/MM/YYYY or DD-MM-YYYY)
                        if (/^\d{1,2}[-/]\d{1,2}[-/]\d{2,4}$/.test(str)) {
                            const parts = str.split(/[-/]/);
                            if (parts.length === 3) {
                                if (parts[0].length === 4) {
                                    return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
                                } else {
                                    const day = parts[0].padStart(2, '0');
                                    const month = parts[1].padStart(2, '0');
                                    const year = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
                                    return `${year}-${month}-${day}`;
                                }
                            }
                        }
                        
                        return str;
                    };

                    const recordData = {
                        so_vao_so: getValue(colMap.so_vao_so),
                        ma_ho_so: getValue(colMap.ma_ho_so),
                        ten_chuyen_quyen: getValue(colMap.ten_chuyen_quyen),
                        ten_chu_su_dung: getValue(colMap.ten_chu_su_dung),
                        loai_bien_dong: getValue(colMap.loai_bien_dong),
                        loai_gcn: getValue(colMap.loai_gcn) || 'GCN mới',
                        ngay_nhan: getValue(colMap.ngay_nhan),
                        so_to: getValue(colMap.so_to),
                        so_thua: getValue(colMap.so_thua),
                        tong_dien_tich: getValue(colMap.tong_dien_tich),
                        dien_tich_tho_cu: getValue(colMap.dien_tich_tho_cu),
                        dia_danh: getValue(colMap.dia_danh),
                        so_phat_hanh: getValue(colMap.so_phat_hanh),
                        ngay_ky_gcn: getValue(colMap.ngay_ky_gcn),
                        ngay_ky_phieu_tk: getValue(colMap.ngay_ky_phieu_tk),
                        ghi_chu: getValue(colMap.ghi_chu),
                        is_pending_scan: false, // Mặc định chưa chuyển scan
                        is_scanned: false
                    };

                    newRecords.push({
                        type: 'vaoso',
                        status: 'completed',
                        so_hieu: recordData.ma_ho_so,
                        trich_yeu: `${recordData.loai_bien_dong} - ${recordData.ten_chu_su_dung}`,
                        ngay_thang: recordData.ngay_nhan || new Date().toISOString().split('T')[0],
                        created_by: currentUser.username,
                        data: recordData
                    });
                });

                if (newRecords.length > 0) {
                    await importArchiveRecords(newRecords);
                    alert(`Đã import thành công ${newRecords.length} hồ sơ.`);
                    loadData();
                } else {
                    alert("Không đọc được dữ liệu nào từ file.");
                }

            } catch (error) {
                console.error(error);
                alert("Lỗi khi đọc file Excel.");
            } finally {
                setLoading(false);
                if (fileInputRef.current) fileInputRef.current.value = '';
            }
        };
        reader.readAsBinaryString(file);
    };

    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            setSelectedIds(new Set(filteredRecords.map(r => r.id)));
        } else {
            setSelectedIds(new Set());
        }
    };

    const handleSelectRow = (id: string) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedIds(newSet);
    };

    // Chuyển sang tab "Chờ chuyển Scan"
    const handleMoveToPending = async () => {
        if (selectedIds.size === 0) return;
        if (!await confirmAction(`Bạn có chắc muốn chuyển ${selectedIds.size} hồ sơ sang danh sách Chờ Scan?`)) return;

        setLoading(true);
        const updates = {
            data: { is_pending_scan: true }
        };
        await updateArchiveRecordsBatch(Array.from(selectedIds), updates);
        setLoading(false);
        setSelectedIds(new Set());
        loadData();
    };

    const handleMoveToPendingSingle = async (id: string) => {
        setLoading(true);
        const updates = {
            data: { is_pending_scan: true }
        };
        await updateArchiveRecordsBatch([id], updates);
        setLoading(false);
        loadData();
    };

    // Mở modal tạo đợt (từ tab Pending)
    const handleOpenBatchModal = () => {
        if (selectedIds.size === 0) return;
        setShowBatchModal(true);
    };

    // Xác nhận tạo đợt scan
    const handleConfirmBatch = async (batch: number, date: string) => {
        setLoading(true);
        const updates = {
            data: { 
                is_scanned: true,
                scan_batch_id: batch.toString(),
                scan_date: date,
                is_pending_scan: false // Đã scan xong thì bỏ cờ pending (hoặc giữ tùy logic, ở đây bỏ để biến mất khỏi tab pending)
            }
        };
        await updateArchiveRecordsBatch(Array.from(selectedIds), updates);
        setLoading(false);
        setSelectedIds(new Set());
        loadData();
    };

    const handleExportExcel = () => {
        const dataToExport = filteredRecords.map((r, idx) => {
            const row: any = {
                'STT': idx + 1,
                'Số vào sổ': r.data?.so_vao_so,
                'Mã hồ sơ': r.data?.ma_ho_so,
                'Tên chuyển quyền': r.data?.ten_chuyen_quyen,
                'Tên chủ sử dụng': r.data?.ten_chu_su_dung,
                'Loại biến động': r.data?.loai_bien_dong,
                'Loại GCN': r.data?.loai_gcn,
                'Ngày nhận': r.data?.ngay_nhan,
                'Số tờ': r.data?.so_to,
                'Số thửa': r.data?.so_thua,
                'Tổng diện tích': r.data?.tong_dien_tich,
                'Diện tích thổ cư': r.data?.dien_tich_tho_cu,
                'Địa danh': r.data?.dia_danh,
                'Số phát hành': r.data?.so_phat_hanh,
                'Ngày ký GCN': r.data?.ngay_ky_gcn,
                'Ngày ký phiếu TK': r.data?.ngay_ky_phieu_tk,
                'Ghi chú': r.data?.ghi_chu
            };
            if (activeTab === 'scanned') {
                row['Ngày Scan'] = r.data?.scan_date;
                row['Đợt Scan'] = r.data?.scan_batch_id;
            }
            return row;
        });

        const ws = XLSX.utils.json_to_sheet(dataToExport);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "DanhSach");
        XLSX.writeFile(wb, `VaoSo_${activeTab}_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    const renderVaoSoToolUI = () => {
        if (tempRecords.length === 0) {
            return (
                <div className="flex-1 flex flex-col items-center justify-center p-8 bg-gray-50/50">
                    <div className="bg-white border-2 border-dashed border-gray-300 rounded-2xl p-10 max-w-lg w-full text-center shadow-md flex flex-col items-center gap-4 hover:border-purple-500 transition-colors">
                        <div className="p-4 bg-purple-50 text-purple-600 rounded-full">
                            <FileSpreadsheet size={48} />
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-lg font-bold text-gray-800">Nhập dữ liệu từ Excel</h3>
                            <p className="text-sm text-gray-500">
                                Kéo thả file Excel chứa danh sách Mã hồ sơ cần vào số hoặc click nút bên dưới để tải lên. Hệ thống sẽ tự động đối chiếu thông tin với cơ sở dữ liệu iGate chính thức.
                            </p>
                        </div>
                        <input 
                            type="file" 
                            ref={tempFileInputRef} 
                            onChange={handleTempExcelUpload} 
                            accept=".xlsx, .xls" 
                            className="hidden" 
                        />
                        <div className="flex gap-3 mt-2">
                            <button 
                                onClick={handleTempImportClick} 
                                className="flex items-center gap-2 bg-purple-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-purple-700 shadow transition-all hover:scale-105"
                            >
                                <Upload size={16}/> Chọn tệp Excel
                            </button>
                            <button 
                                onClick={handleDownloadTemplate} 
                                className="flex items-center gap-2 bg-gray-100 text-gray-700 border border-gray-300 px-4 py-2.5 rounded-xl font-bold text-sm hover:bg-gray-200 shadow-sm"
                            >
                                <Download size={16}/> Mẫu nhập liệu
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        return (
            <div className="flex-1 flex flex-col overflow-hidden bg-white">
                {/* Temp Table Tool bar */}
                <div className="p-3 bg-purple-50/50 border-b border-purple-100 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold bg-purple-100 text-purple-700 px-2.5 py-1 rounded-full flex items-center gap-1.5">
                            <FileSpreadsheet size={14} /> Tệp: {tempExcelFileName}
                        </span>
                        <span className="text-xs text-gray-500">
                            Nhận diện: <strong className="text-gray-800">{tempRecords.length}</strong> hồ sơ | Đã chọn: <strong className="text-purple-700">{selectedTempIds.size}</strong>
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <input 
                            type="file" 
                            ref={tempFileInputRef} 
                            onChange={handleTempExcelUpload} 
                            accept=".xlsx, .xls" 
                            className="hidden" 
                        />
                        <button 
                            onClick={handleTempImportClick}
                            className="flex items-center gap-1.5 text-xs bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 px-3 py-1.5 rounded-lg shadow-sm font-semibold transition-colors"
                        >
                            Chọn tệp khác
                        </button>
                        <button 
                            onClick={handleAutoAssignAllTempBookNumbers}
                            className="flex items-center gap-1.5 text-xs bg-blue-600 text-white hover:bg-blue-700 px-3 py-1.5 rounded-lg shadow-sm font-bold transition-colors"
                            title="Tự động điền Số vào sổ tiếp theo từ hệ thống cho các dòng còn trống"
                        >
                            <Hash size={14}/> Tự động đánh số vào sổ
                        </button>
                        <button 
                            onClick={() => setShowConfirmHandoverModal(true)}
                            className="flex items-center gap-1.5 text-xs bg-purple-600 text-white hover:bg-purple-700 px-4 py-1.5 rounded-lg shadow-md font-bold transition-colors animate-pulse"
                            title="Xác nhận dữ liệu và bàn giao sang 1 cửa"
                        >
                            <CheckCircle2 size={14}/> Xác nhận cập nhật & Bàn giao
                        </button>
                    </div>
                </div>

                {/* Temp Table */}
                <div className="flex-1 overflow-auto">
                    <table className="min-w-full table-fixed border-collapse">
                        <thead className="bg-gray-50 sticky top-0 z-10 shadow-sm border-b">
                            <tr>
                                <th className="p-2 border-b border-r border-gray-200 w-10 text-center bg-gray-50 sticky left-0 z-20">
                                    <input 
                                        type="checkbox" 
                                        onChange={handleSelectAllTempRows} 
                                        checked={tempRecords.length > 0 && selectedTempIds.size === tempRecords.length} 
                                    />
                                </th>
                                <th className="p-2 border-b border-r border-gray-200 w-12 text-center bg-gray-50 sticky left-10 z-20">#</th>
                                <th className="p-2 border-b border-r border-gray-200 w-40 text-xs font-bold text-gray-600 uppercase text-center whitespace-nowrap">Mã hồ sơ</th>
                                <th className="p-2 border-b border-r border-gray-200 w-40 text-xs font-bold text-gray-600 uppercase text-center whitespace-nowrap">Địa danh (Xã)</th>
                                <th className="p-2 border-b border-r border-gray-200 w-56 text-xs font-bold text-gray-600 uppercase text-center whitespace-nowrap">Chủ sử dụng đất</th>
                                <th className="p-2 border-b border-r border-gray-200 w-24 text-xs font-bold text-gray-600 uppercase text-center whitespace-nowrap">Số tờ</th>
                                <th className="p-2 border-b border-r border-gray-200 w-24 text-xs font-bold text-gray-600 uppercase text-center whitespace-nowrap">Số thửa</th>
                                <th className="p-2 border-b border-r border-gray-200 w-32 text-xs font-bold text-gray-600 uppercase text-center whitespace-nowrap">Tổng DT (m2)</th>
                                <th className="p-2 border-b border-r border-gray-200 w-32 text-xs font-bold text-gray-600 uppercase text-center whitespace-nowrap">Đất ở (m2)</th>
                                <th className="p-2 border-b border-r border-gray-200 w-32 text-xs font-bold text-gray-600 uppercase text-center whitespace-nowrap">Đất NN (m2)</th>
                                <th className="p-2 border-b border-r border-gray-200 w-40 text-xs font-bold text-gray-600 uppercase text-center whitespace-nowrap">Số phát hành GCN</th>
                                <th className="p-2 border-b border-r border-gray-200 w-48 text-xs font-bold text-gray-600 uppercase text-center whitespace-nowrap">Số vào sổ</th>
                                <th className="p-2 border-b border-r border-gray-200 w-40 text-xs font-bold text-gray-600 uppercase text-center whitespace-nowrap">Ngày ký GCN</th>
                                <th className="p-2 border-b border-gray-200 w-20 text-center bg-gray-50 sticky right-0 z-20">Xóa</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {tempRecords.map((r, idx) => (
                                <tr key={idx} className={`hover:bg-purple-50/20 group ${selectedTempIds.has(String(idx)) ? 'bg-purple-50/40' : ''}`}>
                                    <td className="p-2 border-r border-gray-200 text-center bg-white sticky left-0 z-10 group-hover:bg-purple-50/20">
                                        <input 
                                            type="checkbox" 
                                            checked={selectedTempIds.has(String(idx))} 
                                            onChange={() => handleSelectTempRow(idx)} 
                                        />
                                    </td>
                                    <td className="p-2 border-r border-gray-200 text-center text-gray-500 text-xs bg-white sticky left-10 z-10 group-hover:bg-purple-50/20">
                                        {idx + 1}
                                    </td>
                                    <td className="p-2 border-r border-gray-100 text-xs">
                                        <div className="flex items-center gap-1.5 font-mono font-medium">
                                            {r.existsInSystem ? (
                                                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" title="Tìm thấy trong hệ thống" />
                                            ) : (
                                                <span title="Không tìm thấy mã hồ sơ trong hệ thống iGate">
                                                    <AlertTriangle size={14} className="text-amber-500 shrink-0" />
                                                </span>
                                            )}
                                            {r.code}
                                        </div>
                                    </td>
                                    <td className="p-2 border-r border-gray-100 text-xs">
                                        <input 
                                            type="text"
                                            className="w-full text-xs px-1.5 py-1 border border-transparent rounded hover:border-gray-200 focus:border-purple-500 focus:bg-white outline-none bg-transparent"
                                            value={r.diaDanh || ''}
                                            onChange={(e) => handleTempCellChange(idx, 'diaDanh', e.target.value)}
                                            placeholder="Địa danh..."
                                        />
                                    </td>
                                    <td className="p-2 border-r border-gray-100 text-xs font-semibold">
                                        <input 
                                            type="text"
                                            className="w-full font-bold text-xs px-1.5 py-1 border border-transparent rounded hover:border-gray-200 focus:border-purple-500 focus:bg-white outline-none bg-transparent text-gray-800"
                                            value={r.customerName || ''}
                                            onChange={(e) => handleTempCellChange(idx, 'customerName', e.target.value)}
                                        />
                                    </td>
                                    <td className="p-2 border-r border-gray-100 text-xs text-center">
                                        <input 
                                            type="text"
                                            className="w-full text-center text-xs px-1.5 py-1 border border-transparent rounded hover:border-gray-200 focus:border-purple-500 focus:bg-white outline-none bg-transparent"
                                            value={r.mapSheet || ''}
                                            onChange={(e) => handleTempCellChange(idx, 'mapSheet', e.target.value)}
                                        />
                                    </td>
                                    <td className="p-2 border-r border-gray-100 text-xs text-center">
                                        <input 
                                            type="text"
                                            className="w-full text-center text-xs px-1.5 py-1 border border-transparent rounded hover:border-gray-200 focus:border-purple-500 focus:bg-white outline-none bg-transparent"
                                            value={r.landPlot || ''}
                                            onChange={(e) => handleTempCellChange(idx, 'landPlot', e.target.value)}
                                        />
                                    </td>
                                    <td className="p-2 border-r border-gray-100 text-xs text-center">
                                        <input 
                                            type="text"
                                            className="w-full text-center text-xs px-1.5 py-1 border border-transparent rounded hover:border-gray-200 focus:border-purple-500 focus:bg-white outline-none bg-transparent"
                                            value={r.area || ''}
                                            onChange={(e) => handleTempCellChange(idx, 'area', e.target.value)}
                                        />
                                    </td>
                                    <td className="p-2 border-r border-gray-100 text-xs text-center bg-orange-50/10">
                                        <input 
                                            type="text"
                                            className="w-full text-center text-xs px-1.5 py-1 border border-transparent rounded hover:border-gray-200 focus:border-purple-500 focus:bg-white outline-none bg-transparent text-orange-700 font-semibold"
                                            value={r.datO || ''}
                                            onChange={(e) => handleTempCellChange(idx, 'datO', e.target.value)}
                                            placeholder="0"
                                        />
                                    </td>
                                    <td className="p-2 border-r border-gray-100 text-xs text-center bg-green-50/10">
                                        <input 
                                            type="text"
                                            className="w-full text-center text-xs px-1.5 py-1 border border-transparent rounded hover:border-gray-200 focus:border-purple-500 focus:bg-white outline-none bg-transparent text-green-700 font-semibold"
                                            value={r.datNongNghiep || ''}
                                            onChange={(e) => handleTempCellChange(idx, 'datNongNghiep', e.target.value)}
                                            placeholder="0"
                                        />
                                    </td>
                                    <td className="p-2 border-r border-gray-100 text-xs">
                                        <input 
                                            type="text"
                                            className="w-full text-xs px-1.5 py-1 border border-transparent rounded hover:border-gray-200 focus:border-purple-500 focus:bg-white outline-none bg-transparent font-mono"
                                            value={r.soPhatHanh || ''}
                                            onChange={(e) => handleTempCellChange(idx, 'soPhatHanh', e.target.value)}
                                            placeholder="CQ..."
                                        />
                                    </td>
                                    <td className="p-1 border-r border-gray-100 text-xs">
                                        <div className="flex items-center gap-1">
                                            <input 
                                                type="text"
                                                className="flex-1 min-w-0 text-xs px-1.5 py-1 border border-transparent rounded hover:border-gray-200 focus:border-purple-500 focus:bg-white outline-none bg-transparent font-mono font-bold text-blue-700 animate-pulse"
                                                value={r.soVaoSo || ''}
                                                onChange={(e) => handleTempCellChange(idx, 'soVaoSo', e.target.value)}
                                                placeholder="CN..."
                                            />
                                            <button 
                                                onClick={() => handleGetTempBookNumber(idx)}
                                                className="p-1 bg-purple-50 hover:bg-purple-100 rounded text-purple-600 transition-colors"
                                                title="Lấy số tự động từ hệ thống"
                                                tabIndex={-1}
                                            >
                                                <Hash size={13} />
                                            </button>
                                        </div>
                                    </td>
                                    <td className="p-2 border-r border-gray-100 text-xs">
                                        <input 
                                            type="date"
                                            className="w-full text-xs px-1.5 py-1 border border-transparent rounded hover:border-gray-200 focus:border-purple-500 focus:bg-white outline-none bg-transparent text-gray-700"
                                            value={r.ngayKyGcn || ''}
                                            onChange={(e) => handleTempCellChange(idx, 'ngayKyGcn', e.target.value)}
                                        />
                                    </td>
                                    <td className="p-2 text-center bg-white sticky right-0 group-hover:bg-purple-50/20 z-10 border-l">
                                        <button 
                                            onClick={() => handleDeleteTempRow(idx)}
                                            className="text-gray-400 hover:text-red-500 p-1"
                                            title="Xóa dòng này"
                                        >
                                            <X size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };

    return (
        <div className="flex flex-col h-full bg-white">
            {/* Header */}
            <div className="p-4 border-b border-gray-100 flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                    <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                        Vào số GCN
                    </h2>
                    <div className="relative flex-1 sm:w-64 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input 
                            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" 
                            placeholder="Tìm kiếm..." 
                            value={searchTerm} 
                            onChange={e => setSearchTerm(e.target.value)} 
                        />
                    </div>
                </div>

                {/* Filters and Tabs */}
                <div className="flex flex-wrap gap-3 items-center bg-gray-50 p-2 rounded-lg border border-gray-100">
                    <div className="flex bg-white rounded-md border border-gray-200 p-1 shadow-sm">
                        <button 
                            onClick={() => {
                                setActiveTab('all');
                                setSelectedIds(new Set());
                            }}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm font-medium transition-colors ${activeTab === 'all' ? 'bg-blue-100 text-blue-700 shadow-sm' : 'text-gray-600 hover:bg-gray-100'}`}
                        >
                            Danh sách
                        </button>
                        <button 
                            onClick={() => {
                                setActiveTab('pending');
                                setSelectedIds(new Set());
                            }}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm font-medium transition-colors ${activeTab === 'pending' ? 'bg-orange-100 text-orange-700 shadow-sm' : 'text-gray-600 hover:bg-gray-100'}`}
                        >
                            Chờ chuyển Scan/1 Cửa
                        </button>
                        <button 
                            onClick={() => {
                                setActiveTab('scanned');
                                setSelectedIds(new Set());
                            }}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm font-medium transition-colors ${activeTab === 'scanned' ? 'bg-green-100 text-green-700 shadow-sm' : 'text-gray-600 hover:bg-gray-100'}`}
                        >
                            Đã chuyển Scan/1 Cửa
                        </button>
                        <button 
                            onClick={() => {
                                setActiveTab('cong-cu-vao-so');
                                setSelectedIds(new Set());
                            }}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm font-medium transition-colors ${activeTab === 'cong-cu-vao-so' ? 'bg-purple-100 text-purple-700 shadow-sm' : 'text-gray-600 hover:bg-gray-100'}`}
                        >
                            Công cụ Vào số GCN
                        </button>
                        <button 
                            onClick={() => {
                                setActiveTab('priority');
                                setSelectedIds(new Set());
                            }}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm font-bold transition-colors ${activeTab === 'priority' ? 'bg-amber-100 text-amber-900 shadow-sm' : 'text-gray-600 hover:bg-gray-100'}`}
                        >
                            <AlertTriangle size={16} className="text-amber-500 fill-yellow-400 shrink-0"/> 
                            <span>Hồ sơ chú ý</span>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-black ${priorityCount > 0 ? 'bg-red-600 text-white animate-pulse' : 'bg-gray-100 text-gray-600'}`}>
                                {priorityCount}
                            </span>
                        </button>
                    </div>

                    <div className="flex items-center gap-2 bg-white px-2 py-1.5 rounded-md border border-gray-200 shadow-sm">
                        <Calendar size={16} className="text-gray-500"/>
                        <input type="date" className="text-sm outline-none bg-transparent text-gray-700 w-28" value={fromDate} onChange={e => setFromDate(e.target.value)} placeholder="Từ ngày" />
                        <span className="text-gray-400">-</span>
                        <input type="date" className="text-sm outline-none bg-transparent text-gray-700 w-28" value={toDate} onChange={e => setToDate(e.target.value)} placeholder="Đến ngày" />
                    </div>

                    <div className="flex items-center gap-2 bg-white px-2 py-1.5 rounded-md border border-gray-200 shadow-sm">
                        <Settings size={16} className="text-gray-500"/>
                        <select className="text-sm outline-none bg-transparent text-gray-700 font-medium cursor-pointer border-none focus:ring-0 min-w-[120px]" value={filterWard} onChange={e => setFilterWard(e.target.value)}>
                            <option value="">Tất cả Địa danh</option>
                            {wards.map(w => <option key={w} value={w}>{w}</option>)}
                        </select>
                    </div>

                    <div className="flex items-center gap-2 ml-auto">
                        {activeTab === 'all' && (
                            <>
                                <button 
                                    onClick={() => setShowSettingsModal(true)} 
                                    className="flex items-center gap-2 bg-gray-600 text-white px-3 py-1.5 rounded-md font-bold text-sm hover:bg-gray-700 shadow-sm"
                                    title="Cài đặt số vào sổ"
                                >
                                    <Settings size={16}/>
                                </button>
                                <button onClick={handleDownloadTemplate} className="flex items-center gap-2 bg-gray-100 text-gray-700 border border-gray-300 px-3 py-1.5 rounded-md font-bold text-sm hover:bg-gray-200 shadow-sm">
                                    <Download size={16}/> Tải mẫu
                                </button>
                                <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".xlsx, .xls" className="hidden" />
                                <button onClick={handleImportClick} className="flex items-center gap-2 bg-blue-600 text-white px-3 py-1.5 rounded-md font-bold text-sm hover:bg-blue-700 shadow-sm">
                                    <Upload size={16}/> Import Excel
                                </button>
                                <button onClick={handleAddNew} className="flex items-center gap-2 bg-teal-600 text-white px-3 py-1.5 rounded-md font-bold text-sm hover:bg-teal-700 shadow-sm">
                                    <Plus size={16}/> Thêm mới
                                </button>
                                {currentUser.role === 'ADMIN' && (
                                    <button onClick={() => setShowDeleteAllModal(true)} className="flex items-center gap-2 bg-red-600 text-white px-3 py-1.5 rounded-md font-bold text-sm hover:bg-red-700 shadow-sm">
                                        <Trash2 size={16}/> Xóa dữ liệu
                                    </button>
                                )}
                                {selectedIds.size > 0 && (
                                    <button onClick={handleMoveToPending} className="flex items-center gap-2 bg-indigo-600 text-white px-3 py-1.5 rounded-md font-bold text-sm hover:bg-indigo-700 shadow-sm animate-pulse">
                                        <Send size={16}/> Chuyển Scan ({selectedIds.size})
                                    </button>
                                )}
                            </>
                        )}

                        {activeTab === 'pending' && selectedIds.size > 0 && (
                            <button onClick={handleOpenBatchModal} className="flex items-center gap-2 bg-orange-600 text-white px-3 py-1.5 rounded-md font-bold text-sm hover:bg-orange-700 shadow-sm animate-pulse">
                                <CheckCircle2 size={16}/> Tạo đợt ({selectedIds.size})
                            </button>
                        )}

                        {activeTab === 'scanned' && (
                            <button onClick={() => setShowExportHandoverModal(true)} className="flex items-center gap-2 bg-purple-600 text-white px-3 py-1.5 rounded-md font-bold text-sm hover:bg-purple-700 shadow-sm">
                                <FileOutput size={16}/> Xuất danh sách
                            </button>
                        )}

                        {activeTab !== 'pending' && (
                            <button onClick={() => setShowExportHandover1CuaModal(true)} className="flex items-center gap-2 bg-pink-600 text-white px-3 py-1.5 rounded-md font-bold text-sm hover:bg-pink-700 shadow-sm" title="Xuất danh sách bàn giao 1 cửa chọn theo Ngày, Đợt và Xã">
                                <FileOutput size={16}/> Xuất DS bàn giao 1 cửa
                            </button>
                        )}

                        <button onClick={handleExportExcel} className="flex items-center gap-2 bg-green-600 text-white px-3 py-1.5 rounded-md font-bold text-sm hover:bg-green-700 shadow-sm">
                            <FileSpreadsheet size={16}/> Xuất Excel
                        </button>
                        {activeTab === 'all' && (
                            <>
                                <button 
                                    onClick={() => {
                                        if (selectedIds.size === 1) {
                                            const rec = records.find(r => selectedIds.has(r.id));
                                            if (rec) {
                                                setSelectedMortgageRecord(rec);
                                                setShowMortgageModal(true);
                                            }
                                        } else {
                                            alert("Vui lòng chọn 1 hồ sơ để quản lý giao dịch bảo đảm.");
                                        }
                                    }} 
                                    disabled={selectedIds.size !== 1}
                                    className="flex items-center gap-2 bg-yellow-600 text-white px-3 py-1.5 rounded-md font-bold text-sm hover:bg-yellow-700 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <span className="font-bold text-lg leading-none">$</span> Giao dịch bảo đảm
                                </button>
                                <button onClick={() => {
                                    if (selectedIds.size > 0) {
                                        const selectedRecords = records.filter(r => selectedIds.has(r.id));
                                        exportSoDiaChinh(selectedRecords);
                                    } else {
                                        setShowExportSoDiaChinhModal(true);
                                    }
                                }} className="flex items-center gap-2 bg-blue-600 text-white px-3 py-1.5 rounded-md font-bold text-sm hover:bg-blue-700 shadow-sm">
                                    <FileText size={16}/> Xuất Sổ địa chính
                                </button>
                                <button onClick={() => setShowExportSoMucKeModal(true)} className="flex items-center gap-2 bg-indigo-600 text-white px-3 py-1.5 rounded-md font-bold text-sm hover:bg-indigo-700 shadow-sm">
                                    <FileText size={16}/> Xuất Sổ mục kê
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Table Container */}
            <div className="flex-1 overflow-auto relative flex flex-col">
                {loading || tempRecordsLoading ? (
                    <div className="flex items-center justify-center h-full text-gray-500 gap-2">
                        <Loader2 className="animate-spin" /> Đang xử lý...
                    </div>
                ) : activeTab === 'cong-cu-vao-so' ? (
                    renderVaoSoToolUI()
                ) : (
                    <>
                    <div className="inline-block min-w-full align-middle flex-1 overflow-auto">
                        <table className="min-w-full table-fixed border-collapse">
                            <thead className="bg-gray-100 sticky top-0 z-10 shadow-sm">
                                <tr>
                                    <th className="p-2 border-b border-r border-gray-200 w-10 text-center bg-gray-100 sticky left-0 z-20">
                                        <input type="checkbox" onChange={handleSelectAll} checked={filteredRecords.length > 0 && selectedIds.size === filteredRecords.length} />
                                    </th>
                                    <th className="p-2 border-b border-r border-gray-200 w-12 text-center bg-gray-100 sticky left-10 z-20">#</th>
                                    {COLUMNS.map(col => (
                                        <th key={col.key} className="p-2 border-b border-r border-gray-200 text-xs font-bold text-gray-600 uppercase text-center whitespace-nowrap" style={{ width: col.width, minWidth: col.width }}>
                                            {col.label}
                                        </th>
                                    ))}
                                    {activeTab === 'scanned' && (
                                        <>
                                            <th className="p-2 border-b border-r border-gray-200 w-32 text-xs font-bold text-gray-600 uppercase">Đợt Scan</th>
                                        </>
                                    )}
                                    <th className="p-2 border-b border-gray-200 w-24 text-center bg-gray-100 sticky right-0 z-20">Thao tác</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {paginatedRecords.length > 0 ? paginatedRecords.map((r, idx) => (
                                    <tr key={r.id} className={`hover:bg-teal-50/30 group ${selectedIds.has(r.id) ? 'bg-blue-50' : ''}`}>
                                        <td className="p-2 border-r border-gray-200 text-center bg-white sticky left-0 z-10 group-hover:bg-teal-50/30">
                                            <input type="checkbox" checked={selectedIds.has(r.id)} onChange={() => handleSelectRow(r.id)} />
                                        </td>
                                        <td className="p-2 border-r border-gray-200 text-center text-gray-500 text-xs bg-white sticky left-10 z-10 group-hover:bg-teal-50/30">
                                            {(currentPage - 1) * itemsPerPage + idx + 1}
                                            {savingId === r.id && <span className="block text-[9px] text-teal-600 animate-pulse">Lưu...</span>}
                                        </td>
                                        {COLUMNS.map(col => {
                                            const isEditing = editingId === r.id;
                                            const isReadOnly = col.readOnly && !isEditing;

                                            if (col.key === 'group_chu_su_dung') {
                                                return (
                                                    <td key={`${r.id}-${col.key}`} className="p-2 border-r border-gray-200 align-top">
                                                        <div className="flex flex-col gap-1">
                                                            <div className="text-xs text-gray-500">Chuyển quyền:</div>
                                                            <div className="text-sm font-medium text-gray-800 mb-2 whitespace-pre-wrap">{r.data?.ten_chuyen_quyen}</div>
                                                            <div className="text-xs text-teal-600 font-bold border-t border-gray-100 pt-1">Chủ sử dụng:</div>
                                                            <div className="text-sm font-bold text-teal-800 whitespace-pre-wrap">{r.data?.ten_chu_su_dung}</div>
                                                        </div>
                                                    </td>
                                                );
                                            }
                                            if (col.key === 'group_thong_tin_ho_so') {
                                                return (
                                                    <td key={`${r.id}-${col.key}`} className="p-2 border-r border-gray-200 align-top">
                                                        <div className="text-xs text-gray-500 mb-0.5">Loại hồ sơ:</div>
                                                        <div className="text-sm font-medium text-blue-700 mb-2 whitespace-pre-wrap leading-tight">{r.data?.loai_bien_dong}</div>
                                                        <div className="text-xs text-gray-500 mb-0.5">Ngày nhận:</div>
                                                        <div className="text-sm font-bold text-gray-800 flex items-center gap-1">
                                                            <Calendar size={14} className="text-gray-400" />
                                                            {r.data?.ngay_nhan ? new Date(r.data.ngay_nhan).toLocaleDateString('vi-VN') : ''}
                                                        </div>
                                                    </td>
                                                );
                                            }
                                            if (col.key === 'group_thua_dat') {
                                                return (
                                                    <td key={`${r.id}-${col.key}`} className="p-2 border-r border-gray-200 align-top">
                                                        <div className="flex items-center gap-2 mb-2">
                                                            <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded text-xs border border-gray-200 whitespace-nowrap">Tờ: <b>{r.data?.so_to}</b></span>
                                                            <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded text-xs border border-gray-200 whitespace-nowrap">Thửa: <b>{r.data?.so_thua}</b></span>
                                                        </div>
                                                        <div className="text-xs text-gray-600 mb-1">
                                                            DT: <b>{r.data?.tong_dien_tich ? `${r.data.tong_dien_tich} m²` : ''}</b>
                                                        </div>
                                                        <div className="text-xs text-gray-600">
                                                            Đất ở: <b>{r.data?.dien_tich_tho_cu ? `${r.data.dien_tich_tho_cu} m²` : ''}</b>
                                                        </div>
                                                    </td>
                                                );
                                            }

                                            return (
                                                <td key={`${r.id}-${col.key}`} className="p-0 border-r border-gray-200 relative">
                                                    {isReadOnly ? (
                                                        <div className="w-full h-full px-2 py-2 text-sm text-gray-700 whitespace-pre-wrap min-h-[40px] flex items-center">
                                                            {r.data?.[col.key] || ''}
                                                        </div>
                                                    ) : col.key === 'so_vao_so' ? (
                                                        <div className="flex h-full">
                                                            <input 
                                                                type="text"
                                                                className="flex-1 min-w-0 px-2 py-2 text-sm bg-transparent border-none focus:ring-2 focus:ring-inset focus:ring-teal-500 outline-none"
                                                                value={r.data?.[col.key] || ''}
                                                                onChange={(e) => handleCellChange(r.id, col.key, e.target.value)}
                                                                onBlur={() => handleBlur(r)}
                                                                readOnly={activeTab === 'scanned'} 
                                                            />
                                                            {activeTab === 'all' && (
                                                                <button 
                                                                    onClick={() => handleGetBookNumber(r)}
                                                                    className="px-2 bg-gray-100 hover:bg-blue-100 text-blue-600 border-l border-gray-200 transition-colors"
                                                                    title="Lấy số vào sổ tiếp theo"
                                                                >
                                                                    <Hash size={14} />
                                                                </button>
                                                            )}
                                                        </div>
                                                    ) : (col.key === 'ten_chuyen_quyen' || col.key === 'ten_chu_su_dung') ? (
                                                        <textarea
                                                            className="w-full h-full px-2 py-2 text-sm bg-transparent border-none focus:ring-2 focus:ring-inset focus:ring-teal-500 outline-none resize-none whitespace-pre-wrap"
                                                            value={r.data?.[col.key] || ''}
                                                            onChange={(e) => handleCellChange(r.id, col.key, e.target.value)}
                                                            onBlur={() => handleBlur(r)}
                                                            readOnly={activeTab === 'scanned'}
                                                            rows={2}
                                                            style={{ minHeight: '40px' }}
                                                        />
                                                    ) : col.key === 'loai_gcn' ? (
                                                        <select
                                                            className="w-full h-full px-2 py-2 text-sm bg-transparent border-none focus:ring-2 focus:ring-inset focus:ring-teal-500 outline-none"
                                                            value={r.data?.[col.key] || 'GCN mới'}
                                                            onChange={(e) => {
                                                                handleCellChange(r.id, col.key, e.target.value);
                                                                handleBlur({ ...r, data: { ...r.data, [col.key]: e.target.value } });
                                                            }}
                                                            disabled={activeTab === 'scanned'}
                                                        >
                                                            <option value="GCN mới">GCN mới</option>
                                                            <option value="GCN trang 4">GCN trang 4</option>
                                                        </select>
                                                    ) : col.key === 'so_phat_hanh' ? (
                                                        <div className="flex flex-col p-1 gap-1 min-w-[80px]">
                                                            {(r.data?.[col.key] || '').split('\n').map((val: string, idx: number, arr: string[]) => (
                                                                <div key={idx} className="flex items-center gap-1 group/input">
                                                                    <input 
                                                                        type="text"
                                                                        className="flex-1 min-w-0 px-2 py-1 text-sm bg-transparent border-b border-gray-200 focus:border-teal-500 outline-none"
                                                                        value={val}
                                                                        onChange={(e) => {
                                                                            const newArr = [...arr];
                                                                            newArr[idx] = e.target.value;
                                                                            handleCellChange(r.id, col.key, newArr.join('\n'));
                                                                        }}
                                                                        onBlur={() => handleBlur(r)}
                                                                        placeholder="Số phát hành..."
                                                                    />
                                                                    {arr.length > 1 && (
                                                                        <button 
                                                                            onClick={() => {
                                                                                const newArr = arr.filter((_, i) => i !== idx);
                                                                                const newVal = newArr.join('\n');
                                                                                handleCellChange(r.id, col.key, newVal);
                                                                                handleBlur({ ...r, data: { ...r.data, [col.key]: newVal } });
                                                                            }}
                                                                            className="text-gray-300 hover:text-red-500 p-1 opacity-0 group-hover/input:opacity-100 transition-opacity"
                                                                            tabIndex={-1}
                                                                            title="Xóa dòng này"
                                                                        >
                                                                            <X size={12} />
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            ))}
                                                            <button 
                                                                onClick={() => {
                                                                    const current = r.data?.[col.key] || '';
                                                                    const newVal = current === '' ? '\n' : current + '\n';
                                                                    handleCellChange(r.id, col.key, newVal);
                                                                }}
                                                                className="flex items-center justify-center gap-1 text-[10px] bg-blue-50 text-blue-600 py-1.5 rounded hover:bg-blue-100 mt-1 font-bold transition-colors w-full"
                                                            >
                                                                <Plus size={12} /> Thêm số
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <input 
                                                            type={col.type || 'text'}
                                                            className="w-full h-full px-2 py-2 text-sm bg-transparent border-none focus:ring-2 focus:ring-inset focus:ring-teal-500 outline-none"
                                                            value={r.data?.[col.key] || ''}
                                                            onChange={(e) => handleCellChange(r.id, col.key, e.target.value)}
                                                            onBlur={() => handleBlur(r)}
                                                            readOnly={activeTab === 'scanned'} 
                                                        />
                                                    )}
                                                </td>
                                            );
                                        })}
                                        {activeTab === 'scanned' && (
                                            <>
                                                <td className="p-2 border-r border-gray-200 text-xs text-gray-600">
                                                    {r.data?.scan_batch_id}
                                                </td>
                                            </>
                                        )}
                                        <td className="p-2 text-center bg-white sticky right-0 group-hover:bg-teal-50/30 z-10 border-l border-gray-200">
                                            <div className="flex flex-col gap-2 items-center justify-center h-full w-full">
                                                {activeTab === 'all' && (
                                                    <>
                                                        <button 
                                                            onClick={() => toggleEdit(r.id)} 
                                                            className={`p-2 rounded-lg transition-colors shadow-sm border ${editingId === r.id ? 'text-green-600 bg-green-50 border-green-200 hover:bg-green-100' : 'text-gray-500 bg-white border-gray-200 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50'}`}
                                                            title={editingId === r.id ? "Xong" : "Sửa"}
                                                        >
                                                            {editingId === r.id ? <CheckCircle2 size={18}/> : <Edit size={18}/>}
                                                        </button>
                                                        <button 
                                                            onClick={() => handleMoveToPendingSingle(r.id)} 
                                                            className="p-2 text-indigo-600 bg-white border border-gray-200 hover:bg-indigo-50 hover:border-indigo-300 rounded-lg transition-colors shadow-sm" 
                                                            title="Chuyển Scan"
                                                        >
                                                            <Send size={18}/>
                                                        </button>
                                                    </>
                                                )}
                                                {currentUser.role === 'ADMIN' && (
                                                <button 
                                                    onClick={() => handleDelete(r.id)} 
                                                    className="p-2 text-gray-500 bg-white border border-gray-200 hover:text-red-600 hover:bg-red-50 hover:border-red-300 rounded-lg transition-colors shadow-sm" 
                                                    title="Xóa dòng này"
                                                >
                                                    <Trash2 size={18}/>
                                                </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan={COLUMNS.length + 5} className="p-8 text-center text-gray-400 italic">
                                            {activeTab === 'all' ? 'Chưa có dữ liệu. Nhấn "Import Excel" hoặc "Thêm mới".' : 
                                             activeTab === 'pending' ? 'Chưa có hồ sơ chờ chuyển scan.' :
                                             'Chưa có hồ sơ nào được chuyển Scan.'}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                    {/* Pagination Controls */}
                    {totalPages > 1 && (
                        <div className="p-2 border-t border-gray-200 bg-gray-50 flex justify-between items-center sticky bottom-0 z-20">
                            <div className="text-xs text-gray-500">
                                Hiển thị {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, filteredRecords.length)} trong tổng số {filteredRecords.length} dòng
                            </div>
                            <div className="flex gap-1">
                                <button 
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                    className="px-2 py-1 bg-white border border-gray-300 rounded text-xs disabled:opacity-50 hover:bg-gray-100"
                                >
                                    Trước
                                </button>
                                <span className="px-2 py-1 text-xs font-medium">Trang {currentPage} / {totalPages}</span>
                                <button 
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                    disabled={currentPage === totalPages}
                                    className="px-2 py-1 bg-white border border-gray-300 rounded text-xs disabled:opacity-50 hover:bg-gray-100"
                                >
                                    Sau
                                </button>
                            </div>
                        </div>
                    )}
                    </>
                )}
            </div>

            {/* Batch Modal */}
            <BatchModal 
                isOpen={showBatchModal}
                onClose={() => setShowBatchModal(false)}
                onConfirm={handleConfirmBatch}
                records={records}
                selectedCount={selectedIds.size}
            />

            {/* Export Handover Modal */}
            <ExportHandoverModal
                isOpen={showExportHandoverModal}
                onClose={() => setShowExportHandoverModal(false)}
                records={records}
                wards={wards}
            />

            {/* Export So Muc Ke Modal */}
            {showExportSoMucKeModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md animate-fade-in-up">
                        <div className="p-4 border-b bg-gray-50 flex justify-between items-center rounded-t-xl">
                            <h3 className="font-bold text-gray-800 text-lg">Xuất Sổ mục kê</h3>
                            <button onClick={() => setShowExportSoMucKeModal(false)} className="text-gray-500 hover:text-red-500 transition-colors">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Đối tượng xuất Sổ mục kê</label>
                                <div className="grid grid-cols-1 gap-2">
                                    <label className={`flex items-start p-3 border rounded-lg cursor-pointer transition-all ${exportSoMucKeParams.targetType === 'new_owner' ? 'bg-indigo-50 border-indigo-500 ring-1 ring-indigo-500' : 'bg-white border-gray-200 hover:bg-gray-50'}`}>
                                        <input 
                                            type="radio" 
                                            name="soMucKeTargetType" 
                                            value="new_owner" 
                                            checked={exportSoMucKeParams.targetType === 'new_owner'}
                                            onChange={() => setExportSoMucKeParams(prev => ({ ...prev, targetType: 'new_owner' }))}
                                            className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
                                        />
                                        <div className="ml-3">
                                            <span className="block text-sm font-medium text-gray-900">1. Xuất cho chủ mới (Chủ sử dụng)</span>
                                            <span className="block text-xs text-gray-500 mt-0.5">Tên người sử dụng là Chủ mới; Cột ghi chú để trống</span>
                                        </div>
                                    </label>

                                    <label className={`flex items-start p-3 border rounded-lg cursor-pointer transition-all ${exportSoMucKeParams.targetType === 'old_owner' ? 'bg-indigo-50 border-indigo-500 ring-1 ring-indigo-500' : 'bg-white border-gray-200 hover:bg-gray-50'}`}>
                                        <input 
                                            type="radio" 
                                            name="soMucKeTargetType" 
                                            value="old_owner" 
                                            checked={exportSoMucKeParams.targetType === 'old_owner'}
                                            onChange={() => setExportSoMucKeParams(prev => ({ ...prev, targetType: 'old_owner' }))}
                                            className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
                                        />
                                        <div className="ml-3">
                                            <span className="block text-sm font-medium text-gray-900">2. Xuất cho chủ cũ (Chủ chuyển quyền)</span>
                                            <span className="block text-xs text-indigo-600 font-medium mt-0.5">Ghi chú tự động: "Đã [Loại hồ sơ] ngày [Ngày ký GCN]"</span>
                                        </div>
                                    </label>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-600 mb-1">Xã/Phường</label>
                                <select 
                                    className="w-full border rounded-md p-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                                    value={exportSoMucKeParams.ward}
                                    onChange={(e) => setExportSoMucKeParams(prev => ({ ...prev, ward: e.target.value }))}
                                >
                                    <option value="">Tất cả</option>
                                    {wards.map(w => (
                                        <option key={w} value={w}>{w}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex gap-4">
                                <div className="flex-1">
                                    <label className="block text-sm font-semibold text-gray-600 mb-1">Từ ngày (Ký GCN)</label>
                                    <input 
                                        type="date" 
                                        value={exportSoMucKeParams.fromDate}
                                        onChange={(e) => setExportSoMucKeParams(prev => ({ ...prev, fromDate: e.target.value }))}
                                        className="w-full border rounded-md p-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                                    />
                                </div>
                                <div className="flex-1">
                                    <label className="block text-sm font-semibold text-gray-600 mb-1">Đến ngày</label>
                                    <input 
                                        type="date" 
                                        value={exportSoMucKeParams.toDate}
                                        onChange={(e) => setExportSoMucKeParams(prev => ({ ...prev, toDate: e.target.value }))}
                                        className="w-full border rounded-md p-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="p-4 border-t bg-gray-50 flex justify-end gap-2 rounded-b-xl">
                            <button 
                                onClick={() => setShowExportSoMucKeModal(false)}
                                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                            >
                                Hủy
                            </button>
                            <button 
                                onClick={() => {
                                    let recordsToExport = [...records];
                                    
                                    // Filter by ward
                                    if (exportSoMucKeParams.ward) {
                                        recordsToExport = recordsToExport.filter(r => r.data?.dia_danh === exportSoMucKeParams.ward);
                                    }
                                    
                                    // Filter by date
                                    if (exportSoMucKeParams.fromDate) {
                                        const fromTime = new Date(exportSoMucKeParams.fromDate).getTime();
                                        recordsToExport = recordsToExport.filter(r => {
                                            if (!r.data?.ngay_ky_gcn) return false;
                                            return new Date(r.data.ngay_ky_gcn).getTime() >= fromTime;
                                        });
                                    }
                                    
                                    if (exportSoMucKeParams.toDate) {
                                        const toTime = new Date(exportSoMucKeParams.toDate).getTime();
                                        recordsToExport = recordsToExport.filter(r => {
                                            if (!r.data?.ngay_ky_gcn) return false;
                                            return new Date(r.data.ngay_ky_gcn).getTime() <= toTime;
                                        });
                                    }

                                    if (recordsToExport.length === 0) {
                                        alert("Không có hồ sơ nào thỏa mãn điều kiện.");
                                        return;
                                    }

                                    exportSoMucKe(recordsToExport, exportSoMucKeParams.ward, exportSoMucKeParams.fromDate, exportSoMucKeParams.toDate, exportSoMucKeParams.targetType);
                                    setShowExportSoMucKeModal(false);
                                }}
                                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
                            >
                                Xuất file
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Export So Dia Chinh Modal */}
            {showExportSoDiaChinhModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl animate-fade-in-up">
                        <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
                            <h3 className="font-bold text-gray-800 text-lg">Xuất Sổ địa chính</h3>
                            <button onClick={() => setShowExportSoDiaChinhModal(false)} className="text-gray-500 hover:text-red-500 transition-colors">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <p className="text-sm text-gray-600 mb-2 font-medium">Xuất theo khoảng số (Ưu tiên):</p>
                                <div className="flex gap-4 items-center">
                                    <div className="flex-1">
                                        <label className="block text-xs font-semibold text-gray-600 mb-1">Từ số</label>
                                        <input 
                                            type="number" 
                                            value={exportSoDiaChinhRange.from}
                                            onChange={(e) => setExportSoDiaChinhRange(prev => ({ ...prev, from: e.target.value }))}
                                            className="w-full border rounded-md p-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                            placeholder="Ví dụ: 1"
                                        />
                                    </div>
                                    <span className="text-gray-400 font-bold mt-5">-</span>
                                    <div className="flex-1">
                                        <label className="block text-xs font-semibold text-gray-600 mb-1">Đến số</label>
                                        <input 
                                            type="number" 
                                            value={exportSoDiaChinhRange.to}
                                            onChange={(e) => setExportSoDiaChinhRange(prev => ({ ...prev, to: e.target.value }))}
                                            className="w-full border rounded-md p-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                            placeholder="Ví dụ: 100"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="border-t pt-4">
                                <p className="text-sm text-gray-600 mb-2 font-medium">Hoặc xuất theo tiêu chí:</p>
                                <div className="space-y-4">
                                    <div className="flex gap-4">
                                        <div className="flex-1">
                                            <label className="block text-xs font-semibold text-gray-600 mb-1">Xã/Phường</label>
                                            <select 
                                                value={exportSoDiaChinhCriteria.ward}
                                                onChange={(e) => setExportSoDiaChinhCriteria(prev => ({ ...prev, ward: e.target.value }))}
                                                className="w-full border rounded-md p-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                            >
                                                <option value="">Tất cả</option>
                                                {wards.map(w => <option key={w} value={w}>{w}</option>)}
                                            </select>
                                        </div>
                                        <div className="flex-1">
                                            <label className="block text-xs font-semibold text-gray-600 mb-1">Tháng / Năm</label>
                                            <div className="flex gap-2">
                                                <select
                                                    value={exportSoDiaChinhCriteria.month ? exportSoDiaChinhCriteria.month.split('-')[1] : ''}
                                                    onChange={(e) => {
                                                        const m = e.target.value;
                                                        const y = exportSoDiaChinhCriteria.month ? exportSoDiaChinhCriteria.month.split('-')[0] : new Date().getFullYear().toString();
                                                        setExportSoDiaChinhCriteria(prev => ({ ...prev, month: m ? `${y}-${m}` : '' }));
                                                    }}
                                                    className="w-1/2 border rounded-md p-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                                >
                                                    <option value="">Chọn tháng</option>
                                                    {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                                                        <option key={m} value={m.toString().padStart(2, '0')}>Tháng {m}</option>
                                                    ))}
                                                </select>
                                                <input
                                                    type="number"
                                                    value={exportSoDiaChinhCriteria.month ? exportSoDiaChinhCriteria.month.split('-')[0] : new Date().getFullYear().toString()}
                                                    onChange={(e) => {
                                                        const y = e.target.value;
                                                        const m = exportSoDiaChinhCriteria.month ? exportSoDiaChinhCriteria.month.split('-')[1] : '';
                                                        if (m) {
                                                            setExportSoDiaChinhCriteria(prev => ({ ...prev, month: `${y}-${m}` }));
                                                        }
                                                    }}
                                                    placeholder="Năm"
                                                    className="w-1/2 border rounded-md p-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 mt-2">
                                        <input 
                                            type="checkbox" 
                                            id="splitByLetter"
                                            checked={exportSoDiaChinhCriteria.splitByLetter}
                                            onChange={(e) => setExportSoDiaChinhCriteria(prev => ({ ...prev, splitByLetter: e.target.checked }))}
                                            className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                                        />
                                        <label htmlFor="splitByLetter" className="text-sm font-medium text-gray-700 cursor-pointer">
                                            Xuất chia theo từng chữ cái đầu của tên chủ (A, B, C...)
                                        </label>
                                    </div>
                                    <div className="flex items-center gap-2 mt-2">
                                        <input 
                                            type="checkbox" 
                                            id="exportTocOnly"
                                            checked={exportSoDiaChinhCriteria.exportTocOnly || false}
                                            onChange={(e) => setExportSoDiaChinhCriteria(prev => ({ ...prev, exportTocOnly: e.target.checked }))}
                                            className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                                        />
                                        <label htmlFor="exportTocOnly" className="text-sm font-medium text-gray-700 cursor-pointer">
                                            Chỉ xuất mục lục
                                        </label>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="p-4 border-t bg-gray-50 flex justify-end gap-2 rounded-b-xl">
                            <button 
                                onClick={() => setShowExportSoDiaChinhModal(false)}
                                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                            >
                                Hủy
                            </button>
                            <button 
                                onClick={() => {
                                    const fromNum = parseInt(exportSoDiaChinhRange.from);
                                    const toNum = parseInt(exportSoDiaChinhRange.to);
                                    
                                    let recordsToExport = [];

                                    if (!isNaN(fromNum) && !isNaN(toNum) && fromNum <= toNum) {
                                        // Export by number range
                                        recordsToExport = records.filter(r => {
                                            const val = r.data?.so_vao_so || '';
                                            let num = NaN;
                                            if (val.startsWith('CN ')) {
                                                num = parseInt(val.replace('CN ', ''));
                                            } else {
                                                num = parseInt(val);
                                            }
                                            return !isNaN(num) && num >= fromNum && num <= toNum;
                                        });

                                        // Sort by number
                                        recordsToExport.sort((a, b) => {
                                            const numA = parseInt((a.data?.so_vao_so || '').replace('CN ', '')) || 0;
                                            const numB = parseInt((b.data?.so_vao_so || '').replace('CN ', '')) || 0;
                                            return numA - numB;
                                        });
                                    } else {
                                        // Export by criteria
                                        const { ward, month, splitByLetter } = exportSoDiaChinhCriteria;
                                        if (!ward && !month && !splitByLetter) {
                                            alert("Vui lòng nhập khoảng số hoặc chọn ít nhất một tiêu chí xuất.");
                                            return;
                                        }

                                        recordsToExport = records.filter(r => {
                                            let matchWard = true;
                                            let matchMonth = true;

                                            if (ward) {
                                                matchWard = r.data?.dia_danh?.toLowerCase().includes(ward.toLowerCase());
                                            }

                                            if (month) {
                                                const recordDate = r.data?.ngay_nhan || r.ngay_thang;
                                                if (recordDate) {
                                                    matchMonth = recordDate.startsWith(month);
                                                } else {
                                                    matchMonth = false;
                                                }
                                            }

                                            return matchWard && matchMonth;
                                        });
                                    }

                                    if (recordsToExport.length === 0) {
                                        alert("Không tìm thấy hồ sơ nào thỏa mãn điều kiện.");
                                        return;
                                    }

                                    if (exportSoDiaChinhCriteria.splitByLetter && !exportSoDiaChinhRange.from && !exportSoDiaChinhRange.to) {
                                        // Group by letter
                                        const groups: Record<string, typeof recordsToExport> = {};
                                        recordsToExport.forEach(r => {
                                            const ownerName = r.data?.ten_chu_su_dung || '';
                                            const parts = ownerName.trim().split(' ');
                                            const firstName = parts[parts.length - 1] || '';
                                            let firstLetter = firstName.charAt(0).toUpperCase();
                                            
                                            const charMap: Record<string, string> = {
                                                'À':'A', 'Á':'A', 'Ạ':'A', 'Ả':'A', 'Ã':'A',
                                                'Ầ':'Â', 'Ấ':'Â', 'Ậ':'Â', 'Ẩ':'Â', 'Ẫ':'Â',
                                                'Ằ':'Ă', 'Ắ':'Ă', 'Ặ':'Ă', 'Ẳ':'Ă', 'Ẵ':'Ă',
                                                'È':'E', 'É':'E', 'Ẹ':'E', 'Ẻ':'E', 'Ẽ':'E',
                                                'Ề':'Ê', 'Ế':'Ê', 'Ệ':'Ê', 'Ể':'Ê', 'Ễ':'Ê',
                                                'Ì':'I', 'Í':'I', 'Ị':'I', 'Ỉ':'I', 'Ĩ':'I',
                                                'Ò':'O', 'Ó':'O', 'Ọ':'O', 'Ỏ':'O', 'Õ':'O',
                                                'Ồ':'Ô', 'Ố':'Ô', 'Ộ':'Ô', 'Ổ':'Ô', 'Ỗ':'Ô',
                                                'Ờ':'Ơ', 'Ớ':'Ơ', 'Ợ':'Ơ', 'Ở':'Ơ', 'Ỡ':'Ơ',
                                                'Ù':'U', 'Ú':'U', 'Ụ':'U', 'Ủ':'U', 'Ũ':'U',
                                                'Ừ':'Ư', 'Ứ':'Ư', 'Ự':'Ư', 'Ử':'Ư', 'Ữ':'Ư',
                                                'Ỳ':'Y', 'Ý':'Y', 'Ỵ':'Y', 'Ỷ':'Y', 'Ỹ':'Y',
                                            };
                                            firstLetter = charMap[firstLetter] || firstLetter;
                                            
                                            // Normalize to base letter if needed, but keeping original uppercase is fine
                                            if (!firstLetter || !/[A-ZĂÂĐÊÔƠƯ]/.test(firstLetter)) {
                                                firstLetter = 'Khac';
                                            }
                                            
                                            if (!groups[firstLetter]) groups[firstLetter] = [];
                                            groups[firstLetter].push(r);
                                        });

                                        import('jszip').then(async ({ default: JSZip }) => {
                                            const zip = new JSZip();
                                            const monthStr = exportSoDiaChinhCriteria.month ? exportSoDiaChinhCriteria.month.split('-')[1] : 'All';
                                            const yearStr = exportSoDiaChinhCriteria.month ? exportSoDiaChinhCriteria.month.split('-')[0] : 'All';

                                            for (const [letter, groupRecords] of Object.entries(groups)) {
                                                // Sort groupRecords by number
                                                groupRecords.sort((a, b) => {
                                                    const numA = parseInt((a.data?.so_vao_so || '').replace('CN ', '')) || 0;
                                                    const numB = parseInt((b.data?.so_vao_so || '').replace('CN ', '')) || 0;
                                                    return numA - numB;
                                                });

                                                const quyenSo = `${letter}${monthStr}`;
                                                const blob = await generateSoDiaChinhBlob(groupRecords, quyenSo, exportSoDiaChinhCriteria.exportTocOnly);
                                                const fileName = `SDC-${monthStr}-${yearStr}-${letter}.docx`;
                                                zip.file(fileName, blob);
                                            }

                                            const zipBlob = await zip.generateAsync({ type: 'blob' });
                                            saveAs(zipBlob, `SoDiaChinh_${monthStr}_${yearStr}.zip`);
                                            setShowExportSoDiaChinhModal(false);
                                        });
                                    } else {
                                        // Sort by number
                                        recordsToExport.sort((a, b) => {
                                            const numA = parseInt((a.data?.so_vao_so || '').replace('CN ', '')) || 0;
                                            const numB = parseInt((b.data?.so_vao_so || '').replace('CN ', '')) || 0;
                                            return numA - numB;
                                        });
                                        exportSoDiaChinh(recordsToExport, "", exportSoDiaChinhCriteria.exportTocOnly);
                                        setShowExportSoDiaChinhModal(false);
                                    }
                                }}
                                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                            >
                                Xuất file
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Settings Modal */}
            {showSettingsModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-sm animate-fade-in-up">
                        <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
                            <h3 className="font-bold text-gray-800 text-lg">Cài đặt số vào sổ</h3>
                            <button onClick={() => setShowSettingsModal(false)} className="text-gray-400 hover:text-red-500"><X size={20}/></button>
                        </div>
                        <div className="p-6">
                            <label className="block text-sm font-medium text-gray-700 mb-2">Số vào sổ hiện tại (phần số)</label>
                            <input 
                                type="text" 
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                                value={currentBookNumber}
                                onChange={(e) => setCurrentBookNumber(e.target.value)}
                            />
                            <p className="text-xs text-gray-500 mt-2">
                                Hệ thống sẽ tự động tăng số này và thêm tiền tố "CN".<br/>
                                Ví dụ: Nếu nhập <strong>{currentBookNumber}</strong>, số tiếp theo sẽ là <strong>CN {incrementString(currentBookNumber)}</strong>.
                            </p>
                        </div>
                        <div className="p-4 border-t bg-gray-50 flex justify-end gap-3">
                            <button 
                                onClick={async () => {
                                    await saveSystemSetting('vaoso_current_book_number', currentBookNumber);
                                    setShowSettingsModal(false);
                                }} 
                                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-bold text-sm shadow-sm"
                            >
                                Lưu cài đặt
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <MortgageModal 
                isOpen={showMortgageModal} 
                onClose={() => {
                    setShowMortgageModal(false);
                    setSelectedMortgageRecord(null);
                }} 
                record={selectedMortgageRecord}
                onSave={async (recordId, mortgages) => {
                    const rec = records.find(r => r.id === recordId);
                    if (rec) {
                        const updatedData = { ...rec.data, mortgages };
                        const saved = await saveArchiveRecord({ ...rec, data: updatedData });
                        if (saved) {
                            setRecords(prev => prev.map(r => r.id === saved.id ? saved : r));
                            setSelectedMortgageRecord(saved);
                        }
                    }
                }}
            />

            {/* Modal Xác nhận cập nhật và bàn giao sang 1 cửa */}
            {showConfirmHandoverModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md animate-fade-in-up flex flex-col overflow-hidden">
                        <div className="p-4 border-b bg-purple-50 flex justify-between items-center text-purple-800">
                            <h3 className="font-bold text-lg flex items-center gap-2">
                                <CheckCircle2 size={20} /> Xác nhận & Bàn giao 1 cửa
                            </h3>
                            <button onClick={() => setShowConfirmHandoverModal(false)} className="text-gray-400 hover:text-red-500">
                                <X size={20}/>
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            <p className="text-sm text-gray-600">
                                Bạn chuẩn bị thực hiện cập nhật Số vào sổ & Ngày ký GCN cho <strong className="text-purple-700">{selectedTempIds.size > 0 ? selectedTempIds.size : tempRecords.length}</strong> hồ sơ được chọn, đồng thời đưa thông tin này vào cơ sở dữ liệu lưu trữ để lập danh sách bàn giao 1 cửa.
                            </p>

                            {/* Batch Options */}
                            <div className="space-y-3">
                                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500">Đợt bàn giao của ngày</label>
                                
                                <div className="flex gap-4">
                                    <label className="flex items-center gap-2 cursor-pointer text-sm font-medium">
                                        <input 
                                            type="radio" 
                                            name="handoverBatchMode" 
                                            value="new" 
                                            checked={handoverBatchMode === 'new'} 
                                            onChange={() => setHandoverBatchMode('new')}
                                            className="text-purple-600 focus:ring-purple-500"
                                        />
                                        <span>Tạo đợt mới (Đợt {suggestedHandoverBatch})</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer text-sm font-medium">
                                        <input 
                                            type="radio" 
                                            name="handoverBatchMode" 
                                            value="existing" 
                                            checked={handoverBatchMode === 'existing'} 
                                            onChange={() => setHandoverBatchMode('existing')}
                                            className="text-purple-600 focus:ring-purple-500"
                                        />
                                        <span>Bổ sung vào đợt cũ</span>
                                    </label>
                                </div>

                                {handoverBatchMode === 'existing' && (
                                    <div className="mt-2">
                                        <select 
                                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                                            value={selectedExistingHandoverBatch}
                                            onChange={(e) => setSelectedExistingHandoverBatch(e.target.value)}
                                        >
                                            {existingHandoverBatches.length > 0 ? (
                                                existingHandoverBatches.map(b => (
                                                    <option key={b} value={b}>Đợt {b} (Đã có hồ sơ bàn giao)</option>
                                                ))
                                            ) : (
                                                <option value="">Chưa có đợt bàn giao cũ trong ngày</option>
                                            )}
                                        </select>
                                    </div>
                                )}
                            </div>

                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 flex gap-2">
                                <AlertTriangle size={16} className="shrink-0 text-amber-600 mt-0.5" />
                                <div>
                                    Nếu có thay đổi so với thông tin GCN gốc đang lưu hành trên hệ thống iGate (như Số tờ, Số thửa, Diện tích, Chủ sử dụng), hệ thống sẽ tự động điều chỉnh dữ liệu iGate của các hồ sơ tương ứng theo dữ liệu mới này.
                                </div>
                            </div>
                        </div>

                        <div className="p-4 border-t bg-gray-50 flex justify-end gap-3">
                            <button 
                                onClick={() => setShowConfirmHandoverModal(false)} 
                                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100 font-medium text-sm"
                                disabled={isSubmittingHandover}
                            >
                                Hủy bỏ
                            </button>
                            <button 
                                onClick={() => handleConfirmHandover('', '')} 
                                className="flex items-center gap-2 px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-md font-bold text-sm shadow transition-colors disabled:opacity-50"
                                disabled={isSubmittingHandover}
                            >
                                {isSubmittingHandover ? (
                                    <>
                                        <Loader2 className="animate-spin" size={16} /> Đang xử lý...
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle2 size={16} /> Đồng ý & Cập nhật
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Xuất danh sách bàn giao 1 cửa theo yêu cầu chọn ngày, đợt, xã */}
            {showExportHandover1CuaModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md animate-fade-in-up flex flex-col overflow-hidden">
                        <div className="p-4 border-b bg-pink-50 text-pink-800 flex justify-between items-center">
                            <h3 className="font-bold text-lg flex items-center gap-2">
                                <FileOutput size={20} /> Xuất DS bàn giao 1 cửa
                            </h3>
                            <button onClick={() => setShowExportHandover1CuaModal(false)} className="text-gray-400 hover:text-red-500">
                                <X size={20}/>
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            <p className="text-xs text-gray-500 mb-2">
                                Lọc và xuất file Excel bàn giao 1 cửa từ cơ sở dữ liệu đã lưu trữ.
                            </p>

                            {/* Ngày bàn giao */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Ngày bàn giao</label>
                                <input 
                                    type="date"
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-pink-500"
                                    value={exportHandover1CuaParams.date}
                                    onChange={(e) => setExportHandover1CuaParams(p => ({ ...p, date: e.target.value }))}
                                />
                            </div>

                            {/* Đợt bàn giao */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Đợt bàn giao</label>
                                <input 
                                    type="text"
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-pink-500"
                                    value={exportHandover1CuaParams.batch}
                                    onChange={(e) => setExportHandover1CuaParams(p => ({ ...p, batch: e.target.value }))}
                                    placeholder="Ví dụ: 1, 2, 3..."
                                />
                            </div>

                            {/* Xã/Phường */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Xã / Phường địa danh</label>
                                <select 
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-pink-500"
                                    value={exportHandover1CuaParams.ward}
                                    onChange={(e) => setExportHandover1CuaParams(p => ({ ...p, ward: e.target.value }))}
                                >
                                    <option value="all">Tất cả</option>
                                    {wards.map(w => (
                                        <option key={w} value={w}>{w}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="p-4 border-t bg-gray-50 flex justify-end gap-3">
                            <button onClick={() => setShowExportHandover1CuaModal(false)} className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100 font-medium text-sm">
                                Hủy bỏ
                            </button>
                            <button 
                                onClick={() => exportHandover1CuaExcel(records.filter(r => r.type === 'vaoso' && r.data?.scan_date === exportHandover1CuaParams.date && String(r.data?.scan_batch_id) === exportHandover1CuaParams.batch), exportHandover1CuaParams.date, exportHandover1CuaParams.batch, exportHandover1CuaParams.ward)} 
                                className="flex items-center gap-2 px-6 py-2 bg-pink-600 hover:bg-pink-700 text-white rounded-md font-bold text-sm shadow-sm transition-transform active:scale-95"
                            >
                                <FileOutput size={16} /> Xuất Excel bàn giao
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <DeleteAllModal
                isOpen={showDeleteAllModal}
                onClose={() => setShowDeleteAllModal(false)}
                onConfirm={handleDeleteAll}
                currentUser={currentUser}
                title="Vào số GCN"
            />
        </div>
    );
};

// Batch Modal Component
interface BatchModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (batch: number, date: string) => void;
    records: ArchiveRecord[];
    selectedCount: number;
}

const BatchModal: React.FC<BatchModalProps> = ({ isOpen, onClose, onConfirm, records, selectedCount }) => {
    const [mode, setMode] = useState<'new' | 'existing'>('new');
    const [selectedExistingBatch, setSelectedExistingBatch] = useState<string>('');
    const todayStr = new Date().toISOString().split('T')[0];

    const nextBatchInfo = useMemo(() => {
        let maxBatch = 0;
        records.forEach(r => {
            if (r.data?.scan_batch_id && r.data?.scan_date?.startsWith(todayStr)) {
                const b = parseInt(r.data.scan_batch_id);
                if (!isNaN(b) && b > maxBatch) maxBatch = b;
            }
        });
        return { batch: maxBatch + 1, date: todayStr };
    }, [records, todayStr]);

    const historyBatches = useMemo(() => {
        const batches: Record<string, any> = {};
        records.forEach(r => {
            if (r.data?.is_scanned && r.data?.scan_batch_id && r.data?.scan_date) {
                const datePart = r.data.scan_date.split('T')[0];
                const key = `${datePart}_${r.data.scan_batch_id}`;
                if (!batches[key]) {
                    batches[key] = { date: datePart, batch: parseInt(r.data.scan_batch_id), count: 0, fullDate: r.data.scan_date };
                }
                batches[key].count++;
            }
        });
        return Object.values(batches).sort((a: any, b: any) => b.date.localeCompare(a.date) || b.batch - a.batch);
    }, [records]);

    useEffect(() => {
        if (mode === 'existing' && historyBatches.length > 0 && !selectedExistingBatch) {
            const first = historyBatches[0];
            setSelectedExistingBatch(`${first.date}_${first.batch}`);
        }
    }, [mode, historyBatches]);

    if (!isOpen) return null;

    const handleConfirm = () => {
        if (mode === 'new') {
            onConfirm(nextBatchInfo.batch, nextBatchInfo.date);
        } else {
            if (!selectedExistingBatch) {
                alert('Vui lòng chọn một đợt cũ.');
                return;
            }
            const [datePart, batchNumStr] = selectedExistingBatch.split('_');
            const batchNum = parseInt(batchNumStr);
            const found = historyBatches.find((h: any) => h.date === datePart && h.batch === batchNum);
            
            if (found) {
                onConfirm(found.batch, found.fullDate);
            }
        }
        onClose();
    };

    const formatDate = (d: string) => {
        const parts = d.split('-');
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md animate-fade-in-up flex flex-col overflow-hidden">
                <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
                    <h3 className="font-bold text-gray-800 text-lg">Tạo Đợt Chuyển Scan</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-red-500"><X size={20}/></button>
                </div>

                <div className="p-6 space-y-4">
                    <p className="text-sm text-gray-600 mb-2">
                        Bạn đang tạo đợt cho <strong>{selectedCount}</strong> hồ sơ.
                    </p>

                    {/* Option 1: New Batch */}
                    <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${mode === 'new' ? 'bg-blue-50 border-blue-500 shadow-sm' : 'bg-white border-gray-200 hover:border-blue-300'}`}>
                        <input 
                            type="radio" 
                            name="batchMode" 
                            checked={mode === 'new'} 
                            onChange={() => setMode('new')}
                            className="mt-1 w-4 h-4 text-blue-600 focus:ring-blue-500"
                        />
                        <div className="flex-1">
                            <div className="flex items-center gap-2 font-bold text-gray-800">
                                <Plus size={16} className="text-blue-600" /> Tạo đợt mới (Hôm nay)
                            </div>
                            <div className="text-sm text-gray-600 mt-1 pl-6">
                                Đợt tiếp theo: <span className="font-bold text-blue-700">Đợt {nextBatchInfo.batch}</span>
                                <br/>
                                <span className="text-xs text-gray-500">Ngày: {formatDate(todayStr)}</span>
                            </div>
                        </div>
                    </label>

                    {/* Option 2: Existing Batch */}
                    <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${mode === 'existing' ? 'bg-green-50 border-green-500 shadow-sm' : 'bg-white border-gray-200 hover:border-green-300'}`}>
                        <input 
                            type="radio" 
                            name="batchMode" 
                            checked={mode === 'existing'} 
                            onChange={() => setMode('existing')}
                            className="mt-1 w-4 h-4 text-green-600 focus:ring-green-500"
                        />
                        <div className="flex-1">
                            <div className="flex items-center gap-2 font-bold text-gray-800">
                                <History size={16} className="text-green-600" /> Thêm vào đợt cũ
                            </div>
                            
                            <div className="mt-2 pl-6">
                                <select 
                                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-green-500 outline-none disabled:bg-gray-100 disabled:text-gray-400"
                                    disabled={mode !== 'existing'}
                                    value={selectedExistingBatch}
                                    onChange={(e) => setSelectedExistingBatch(e.target.value)}
                                >
                                    {historyBatches.length > 0 ? (
                                        historyBatches.map((h: any) => (
                                            <option key={`${h.date}_${h.batch}`} value={`${h.date}_${h.batch}`}>
                                                Đợt {h.batch} - Ngày {formatDate(h.date)} (Đã có {h.count} HS)
                                            </option>
                                        ))
                                    ) : (
                                        <option value="">Chưa có đợt nào</option>
                                    )}
                                </select>
                            </div>
                        </div>
                    </label>
                </div>

                <div className="p-4 border-t bg-gray-50 flex justify-end gap-3">
                    <button onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100 font-medium text-sm">
                        Hủy bỏ
                    </button>
                    <button 
                        onClick={handleConfirm} 
                        className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-bold text-sm shadow-sm transition-transform active:scale-95"
                    >
                        <CheckCircle2 size={16} /> Xác nhận
                    </button>
                </div>
            </div>
        </div>
    );
};

// Export Handover Modal Component
interface ExportHandoverModalProps {
    isOpen: boolean;
    onClose: () => void;
    records: ArchiveRecord[];
    wards: string[];
}

const ExportHandoverModal: React.FC<ExportHandoverModalProps> = ({ isOpen, onClose, records, wards }) => {
    const [selectedBatch, setSelectedBatch] = useState<string>('');
    const [selectedGcnType, setSelectedGcnType] = useState<string>('GCN mới');
    const [selectedWard, setSelectedWard] = useState<string>('all');

    const historyBatches = useMemo(() => {
        const batches: Record<string, any> = {};
        records.forEach(r => {
            if (r.data?.is_scanned && r.data?.scan_batch_id && r.data?.scan_date) {
                const datePart = r.data.scan_date.split('T')[0];
                const key = `${datePart}_${r.data.scan_batch_id}`;
                if (!batches[key]) {
                    batches[key] = { date: datePart, batch: parseInt(r.data.scan_batch_id), count: 0, fullDate: r.data.scan_date };
                }
                batches[key].count++;
            }
        });
        return Object.values(batches).sort((a: any, b: any) => b.date.localeCompare(a.date) || b.batch - a.batch);
    }, [records]);

    useEffect(() => {
        if (isOpen && historyBatches.length > 0 && !selectedBatch) {
            const first = historyBatches[0];
            setSelectedBatch(`${first.date}_${first.batch}`);
        }
    }, [isOpen, historyBatches]);

    if (!isOpen) return null;

    const formatDate = (d: string) => {
        const parts = d.split('-');
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
    };

    const handleExport = () => {
        if (!selectedBatch) {
            alert('Vui lòng chọn đợt xuất.');
            return;
        }

        const [datePart, batchNumStr] = selectedBatch.split('_');
        const batchNum = parseInt(batchNumStr);
        const batchInfo = historyBatches.find((h: any) => h.date === datePart && h.batch === batchNum);
        
        if (!batchInfo) return;

        // Filter records
        const filtered = records.filter(r => {
            const rBatchId = String(r.data?.scan_batch_id || '');
            const isBatchMatch = r.data?.is_scanned && 
                                 rBatchId === batchNumStr && 
                                 r.data?.scan_date?.startsWith(datePart);
            
            // Default to 'GCN mới' if undefined
            const rType = r.data?.loai_gcn || 'GCN mới';
            const isTypeMatch = rType === selectedGcnType;
            
            const isWardMatch = selectedWard === 'all' || r.data?.dia_danh?.toLowerCase().includes(selectedWard.toLowerCase());
            
            return isBatchMatch && isTypeMatch && isWardMatch;
        });

        if (filtered.length === 0) {
            alert('Không có hồ sơ nào thỏa mãn điều kiện lọc.');
            return;
        }

        // Generate Excel
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet([]);

        // Styles
        const styleTitle = { font: { bold: true, sz: 14 }, alignment: { horizontal: 'center', vertical: 'center', wrapText: true } };
        const styleItalicCenter = { font: { italic: true, sz: 11 }, alignment: { horizontal: 'center', vertical: 'center' } };
        const styleHeader = { font: { bold: true }, border: { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } }, alignment: { horizontal: 'center', vertical: 'center', wrapText: true }, fill: { fgColor: { rgb: "E0E0E0" } } };
        const styleCell = { border: { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } }, alignment: { vertical: 'center', wrapText: true } };
        const styleCellCenter = { ...styleCell, alignment: { ...styleCell.alignment, horizontal: 'center' } };

        const exportDate = formatDate(datePart);

        // Define Headers and Data Mapping based on GCN Type
        let headers: string[] = [];
        let dataRows: any[][] = [];
        let colWidths: any[] = [];

        if (selectedGcnType === 'GCN trang 4') {
            headers = [
                "STT", "Tên Chủ sử dụng", "Địa danh", "Số phát hành", "Ngày ký GCN", 
                "Mã hồ sơ giao dịch", "Loại hồ sơ", "Ngày chủ SD nhận GCN", 
                "Người nhận GCN ký, ghi họ tên", "Ghi chú"
            ];
            colWidths = [
                { wch: 5 }, { wch: 30 }, { wch: 20 }, { wch: 15 }, { wch: 12 }, 
                { wch: 15 }, { wch: 20 }, { wch: 15 }, { wch: 20 }, { wch: 20 }
            ];
            dataRows = filtered.map((r, idx) => [
                idx + 1,
                r.data?.ten_chu_su_dung || '',
                r.data?.dia_danh || '',
                r.data?.so_phat_hanh || '',
                r.data?.ngay_ky_gcn ? new Date(r.data.ngay_ky_gcn).toLocaleDateString('vi-VN') : '',
                r.data?.ma_ho_so || '',
                r.data?.loai_bien_dong || '',
                '', // Ngày chủ SD nhận GCN
                '', // Người nhận GCN ký
                r.data?.ghi_chu || ''
            ]);
        } else {
            // GCN mới
            headers = [
                "STT", "Số vào sổ", "Tên chủ sử dụng đất", "Số phát hành", "Ngày ký GCN",
                "Mã hồ sơ giao dịch", "Địa danh", "Ngày nhận GCN", 
                "Người nhận GCN ký, ghi rõ họ tên", "Ghi chú"
            ];
            colWidths = [
                { wch: 5 }, { wch: 15 }, { wch: 30 }, { wch: 15 }, { wch: 12 },
                { wch: 15 }, { wch: 20 }, { wch: 15 }, { wch: 20 }, { wch: 20 }
            ];
            dataRows = filtered.map((r, idx) => [
                idx + 1,
                r.data?.so_vao_so || '',
                r.data?.ten_chu_su_dung || '',
                r.data?.so_phat_hanh || '',
                r.data?.ngay_ky_gcn ? new Date(r.data.ngay_ky_gcn).toLocaleDateString('vi-VN') : '',
                r.data?.ma_ho_so || '',
                r.data?.dia_danh || '',
                '', // Ngày nhận GCN
                '', // Người nhận GCN ký
                r.data?.ghi_chu || ''
            ]);
        }

        // Row 1: Title
        XLSX.utils.sheet_add_aoa(ws, [[
            "DANH SÁCH BÀN GIAO GCNQSD ĐẤT TỪ VPĐKĐĐ SANG\nBỘ PHẬN TIẾP NHẬN VÀ TRẢ KẾT QUẢ"
        ]], { origin: "A1" });
        
        // Merge Title
        if(!ws['!merges']) ws['!merges'] = [];
        ws['!merges'].push({ s: { r: 0, c: 0 }, e: { r: 0, c: headers.length - 1 } });
        ws['A1'].s = styleTitle;

        // Row 2: GCN Type
        const typeCellRef = XLSX.utils.encode_cell({ r: 1, c: headers.length - 1 });
        XLSX.utils.sheet_add_aoa(ws, [[selectedGcnType]], { origin: typeCellRef });
        ws[typeCellRef].s = { font: { bold: true, sz: 12 }, alignment: { horizontal: 'right' } };

        // Row 3: Date - Batch
        XLSX.utils.sheet_add_aoa(ws, [[`Ngày ${exportDate} - Danh sách số ${batchNum}`]], { origin: "A3" });
        ws['!merges'].push({ s: { r: 2, c: 0 }, e: { r: 2, c: headers.length - 1 } });
        ws['A3'].s = styleItalicCenter;

        // Table Header (Row 5)
        XLSX.utils.sheet_add_aoa(ws, [headers], { origin: "A5" });
        headers.forEach((_, i) => {
            const cellRef = XLSX.utils.encode_cell({ r: 4, c: i });
            ws[cellRef].s = styleHeader;
        });

        // Data Rows
        XLSX.utils.sheet_add_aoa(ws, dataRows, { origin: "A6" });

        // Apply styles to data
        dataRows.forEach((row, rIdx) => {
            row.forEach((_, cIdx) => {
                const cellRef = XLSX.utils.encode_cell({ r: 5 + rIdx, c: cIdx });
                if (cIdx === 0) { // STT centered
                    ws[cellRef].s = styleCellCenter;
                } else {
                    ws[cellRef].s = styleCell;
                }
            });
        });

        // Signature Section
        const lastRowIdx = 5 + dataRows.length;
        const sigRowIdx = lastRowIdx + 2; // Leave 1 empty row

        // Người giao (Left)
        XLSX.utils.sheet_add_aoa(ws, [["Người giao"]], { origin: { r: sigRowIdx, c: 0 } });
        ws['!merges'].push({ s: { r: sigRowIdx, c: 0 }, e: { r: sigRowIdx, c: 2 } }); // Merge A-C
        const sigLeftRef = XLSX.utils.encode_cell({ r: sigRowIdx, c: 0 });
        ws[sigLeftRef].s = { font: { bold: true }, alignment: { horizontal: 'center' } };

        // Người nhận (Center)
        XLSX.utils.sheet_add_aoa(ws, [["Người nhận"]], { origin: { r: sigRowIdx, c: 3 } });
        ws['!merges'].push({ s: { r: sigRowIdx, c: 3 }, e: { r: sigRowIdx, c: 5 } }); // Merge D-F
        const sigCenterRef = XLSX.utils.encode_cell({ r: sigRowIdx, c: 3 });
        ws[sigCenterRef].s = { font: { bold: true }, alignment: { horizontal: 'center' } };

        // Giao nhận 1 cửa (Right)
        XLSX.utils.sheet_add_aoa(ws, [["Giao nhận 1 cửa"]], { origin: { r: sigRowIdx, c: 6 } });
        ws['!merges'].push({ s: { r: sigRowIdx, c: 6 }, e: { r: sigRowIdx, c: headers.length - 1 } }); // Merge G-End
        const sigRightRef = XLSX.utils.encode_cell({ r: sigRowIdx, c: 6 });
        ws[sigRightRef].s = { font: { bold: true }, alignment: { horizontal: 'center' } };

        // Column Widths
        ws['!cols'] = colWidths;

        // Row Heights
        ws['!rows'] = [
            { hpt: 40 }, // Title
            { hpt: 20 }, // Subtitle
            { hpt: 20 }, // Date
            { hpt: 10 }, // Spacer
            { hpt: 25 }  // Header
        ];

        XLSX.utils.book_append_sheet(wb, ws, "DanhSachBanGiao");
        XLSX.writeFile(wb, `DanhSachBanGiao_${selectedGcnType.replace(/ /g, '')}_${datePart}_Dot${batchNum}.xlsx`);
        
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md animate-fade-in-up flex flex-col overflow-hidden">
                <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
                    <h3 className="font-bold text-gray-800 text-lg">Xuất Danh Sách Bàn Giao</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-red-500"><X size={20}/></button>
                </div>

                <div className="p-6 space-y-4">
                    {/* Batch Selection */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Chọn Đợt Xuất</label>
                        <select 
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-purple-500"
                            value={selectedBatch}
                            onChange={(e) => setSelectedBatch(e.target.value)}
                        >
                            {historyBatches.map((h: any) => (
                                <option key={`${h.date}_${h.batch}`} value={`${h.date}_${h.batch}`}>
                                    Đợt {h.batch} - Ngày {formatDate(h.date)} ({h.count} HS)
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* GCN Type Selection */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Loại GCN</label>
                        <div className="flex gap-4">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input 
                                    type="radio" 
                                    name="gcnType" 
                                    value="GCN mới" 
                                    checked={selectedGcnType === 'GCN mới'} 
                                    onChange={(e) => setSelectedGcnType(e.target.value)}
                                    className="text-purple-600 focus:ring-purple-500"
                                />
                                <span>GCN mới</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input 
                                    type="radio" 
                                    name="gcnType" 
                                    value="GCN trang 4" 
                                    checked={selectedGcnType === 'GCN trang 4'} 
                                    onChange={(e) => setSelectedGcnType(e.target.value)}
                                    className="text-purple-600 focus:ring-purple-500"
                                />
                                <span>GCN trang 4</span>
                            </label>
                        </div>
                    </div>

                    {/* Ward Selection */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Xã/Phường</label>
                        <select 
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-purple-500"
                            value={selectedWard}
                            onChange={(e) => setSelectedWard(e.target.value)}
                        >
                            <option value="all">Tất cả</option>
                            {wards.map(w => (
                                <option key={w} value={w}>{w}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="p-4 border-t bg-gray-50 flex justify-end gap-3">
                    <button onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100 font-medium text-sm">
                        Hủy bỏ
                    </button>
                    <button 
                        onClick={handleExport} 
                        className="flex items-center gap-2 px-6 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 font-bold text-sm shadow-sm transition-transform active:scale-95"
                    >
                        <FileOutput size={16} /> Xuất Excel
                    </button>
                </div>
            </div>
        </div>
    );
};

export default VaoSoView;
