import React, { useState, useEffect, useMemo, useRef } from 'react';
import { User, UserRole } from '../../types';
import { 
    Search, Plus, Trash2, Edit, Save, X, Calendar, Phone, FileSpreadsheet, 
    Download, LayoutGrid, FileText, ClipboardList, BookOpen, User as UserIcon, 
    Building, CheckCircle2, AlertTriangle, FilePieChart, TrendingUp, BarChart3,
    ArrowUpRight, AlertCircle, RefreshCw, Printer, Filter, Upload, Tag, Info,
    FileOutput, Hash, Loader2, Settings
} from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import * as XLSX from 'xlsx-js-style';
import { fetchEmployees, fetchUsers } from '../../services/apiPeople';
import { 
    fetchIGateRecords, 
    saveIGateRecordApi, 
    saveIGateRecordsBatchApi, 
    deleteIGateRecordApi, 
    deleteAllIGateRecordsApi, 
    resetIGateRecordsToDefaultApi 
} from '../../services/apiIGate';
import { supabase } from '../../services/supabaseClient';
import { ArchiveRecord, saveArchiveRecord } from '../../services/apiArchive';
import { getSystemSetting, saveSystemSetting } from '../../services/apiSystem';

interface IGateRecord {
    id: string;
    soHieu: string;        // Mã hồ sơ (thay Số hồ sơ)
    tenThuTuc: string;      // Loại biến động (thay Tên thủ tục)
    tenLinhVuc: string;     // Tên lĩnh vực
    ngayTiepNhan: string;   // Ngày nhận hồ sơ (thay Ngày tiếp nhận)
    ngayHenTra: string;     // Ngày trả kết quả (thay Ngày hẹn trả)
    ngayKetThuc: string;    // Ngày kết thúc xử lý
    donVi: string;          // Cơ quan/đơn vị
    chuHoSo: string;        // CHỦ SỬ DỤNG (thay Chủ hồ sơ)
    soDienThoai: string;    // Số điện thoại
    canBoXuLy: string;      // Cán bộ xử lý hiện tại
    trangThai: string;      // Trạng thái hồ sơ
    chuyenQuyen?: string;   // CHUYỂN QUYỀN
    soTo?: string;          // Số tờ
    soThua?: string;        // Số thửa
    tongDienTich?: number | null; // Tổng diện tích
    dienTichDatO?: number | null; // Diện tích Đất ở
    dienTichDatNongNghiep?: number | null; // Diện tích đất nông nghiệp
    diaDanh?: string;       // Địa danh
    soPhatHanh?: string;    // Số phát hành
    thoiHanSuDung?: string; // Thời hạn sử dụng
    cccd?: string;          // CCCD
    ghiChu?: string;        // GHI CHÚ
    ngayTra?: string;       // Ngày trả hồ sơ
    lyDoTra?: string;       // Lý do trả hồ sơ
    daThucHienNvtc?: boolean; // Đã thực hiện nghĩa vụ tài chính
    ngayThucHienNvtc?: string; // Ngày thực hiện nghĩa vụ tài chính
    soVaoSo?: string;
    ngayGiao1Cua?: string;
    dotGiao1Cua?: string;
    excelRowIndex?: number; // Dòng trong file excel
}

interface IGateViewProps {
    currentUser: User;
    wards: string[];
}

// Seed data mặc định để người dùng nhận diện ngay Dashboard khi mới khởi chạy
const DEFAULT_IGATE_RECORDS: IGateRecord[] = [];

const DEFAULT_CAN_BO_LIST = [
    "Nguyễn Văn Nam",
    "Lê Thị Thu",
    "Lê Tiến Anh",
    "Nguyễn Hoàng Minh",
    "Võ Văn Kiệt",
    "Trần Quốc Toản"
];

const TRANG_THAI_LIST = [
    "Mới tiếp nhận",
    "Đã chuyển thông tin thuế",
    "Đã phát hành thông báo thuế",
    "Đã thực hiện nghĩa vụ tài chính",
    "Chờ thực hiện nghĩa vụ tài chính",
    "Đã ký Giấy chứng nhận",
    "Chưa trả kết quả",
    "Đã trả kết quả",
    "Hồ sơ trả"
];

const LINH_VUC_LIST = [
    "Đất đai",
    "Giao dịch bảo đảm",
    "Cấp phép xây dựng"
];

// Helper chuyển chuỗi ngày tháng đủ kiểu thành đối tượng JS Date
const parseToDateObject = (dateStr: string | null | undefined): Date | null => {
    if (!dateStr) return null;
    const trimmed = dateStr.trim();
    if (!trimmed || trimmed === '' || trimmed.toLowerCase() === 'null') return null;
    
    // Tách bộ ngày và giờ
    const parts = trimmed.split(/\s+/);
    const datePart = parts[0];
    const timePart = parts[1] || '';
    
    // Định dạng YYYY-MM-DD
    const yyyymmddMatch = datePart.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
    if (yyyymmddMatch) {
         const year = parseInt(yyyymmddMatch[1], 10);
         const month = parseInt(yyyymmddMatch[2], 10) - 1;
         const day = parseInt(yyyymmddMatch[3], 10);
         if (timePart) {
             const tParts = timePart.split(':');
             const h = parseInt(tParts[0] || '0', 10);
             const m = parseInt(tParts[1] || '0', 10);
             const s = parseInt(tParts[2] || '0', 10);
             return new Date(year, month, day, h, m, s);
         }
         return new Date(year, month, day);
    }
    
    // Định dạng DD/MM/YYYY
    const ddmmyyyyMatch = datePart.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
    if (ddmmyyyyMatch) {
         const day = parseInt(ddmmyyyyMatch[1], 10);
         const month = parseInt(ddmmyyyyMatch[2], 10) - 1;
         const year = parseInt(ddmmyyyyMatch[3], 10);
         if (timePart) {
             const tParts = timePart.split(':');
             const h = parseInt(tParts[0] || '0', 10);
             const m = parseInt(tParts[1] || '0', 10);
             const s = parseInt(tParts[2] || '0', 10);
             return new Date(year, month, day, h, m, s);
         }
         return new Date(year, month, day);
    }
    
    const parsed = new Date(trimmed);
    if (!isNaN(parsed.getTime())) {
        return parsed;
    }
    return null;
};

// Helper hiển thị ngày tháng năm + giờ phút giây một cách an toàn và đẹp đẽ
const formatDisplayDateInClient = (dateStr: string | null | undefined): string => {
    if (!dateStr) return '-';
    const parsed = parseToDateObject(dateStr);
    if (!parsed) return dateStr || '-';
    
    const day = parsed.getDate().toString().padStart(2, '0');
    const month = (parsed.getMonth() + 1).toString().padStart(2, '0');
    const year = parsed.getFullYear();
    
    const h = parsed.getHours();
    const m = parsed.getMinutes();
    const s = parsed.getSeconds();
    
    if (h === 0 && m === 0 && s === 0) {
        return `${day}/${month}/${year}`;
    } else {
        const hh = h.toString().padStart(2, '0');
        const mm = m.toString().padStart(2, '0');
        const ss = s.toString().padStart(2, '0');
        return `${day}/${month}/${year} ${hh}:${mm}:${ss}`;
    }
};

// Helper lấy chuỗi ngày giờ hiện tại định dạng Việt Nam đầy đủ
const getNowVietnameseString = (): string => {
    const parsed = new Date();
    const day = parsed.getDate().toString().padStart(2, '0');
    const month = (parsed.getMonth() + 1).toString().padStart(2, '0');
    const year = parsed.getFullYear();
    const hh = parsed.getHours().toString().padStart(2, '0');
    const mm = parsed.getMinutes().toString().padStart(2, '0');
    const ss = parsed.getSeconds().toString().padStart(2, '0');
    return `${day}/${month}/${year} ${hh}:${mm}:${ss}`;
};

const getTodayString = (): string => {
    const today = new Date();
    const d = today.getDate().toString().padStart(2, '0');
    const m = (today.getMonth() + 1).toString().padStart(2, '0');
    const y = today.getFullYear();
    return `${d}/${m}/${y}`;
};

const getImportUniqueKey = (soHieu: string, soTo: string, soThua: string): string => {
    const code = (soHieu || '').trim().toUpperCase();
    const to = (soTo || '').trim().toUpperCase();
    const thua = (soThua || '').trim().toUpperCase();
    return `${code}|${to}|${thua}`;
};

const cleanThoiHanSuDung = (val: string | null | undefined): string => {
    if (!val) return '';
    const trimmed = val.trim();
    const parsed = parseToDateObject(trimmed);
    if (!parsed) return trimmed; // Nếu không phải ngày tháng hợp lệ (ví dụ: "Lâu dài", "50 năm"), giữ nguyên bản
    
    // Nếu là ngày tháng hợp lệ, ta chỉ trả về chuỗi ngày dạng DD/MM/YYYY
    const day = parsed.getDate().toString().padStart(2, '0');
    const month = (parsed.getMonth() + 1).toString().padStart(2, '0');
    const year = parsed.getFullYear();
    return `${day}/${month}/${year}`;
};

const formatThoiHanSuDung = (dateStr: string | null | undefined): string => {
    if (!dateStr) return '-';
    const parsed = parseToDateObject(dateStr);
    if (!parsed) return dateStr || '-';
    
    const day = parsed.getDate().toString().padStart(2, '0');
    const month = (parsed.getMonth() + 1).toString().padStart(2, '0');
    const year = parsed.getFullYear();
    return `${day}/${month}/${year}`;
};

const IGateView: React.FC<IGateViewProps> = ({ currentUser, wards }) => {
    const [records, setRecords] = useState<IGateRecord[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedTrangThaiFilter, setSelectedTrangThaiFilter] = useState<string>('Tất cả');
    const [selectedLinhVucFilter, setSelectedLinhVucFilter] = useState<string>('Tất cả');
    const [selectedLoaiHoSoFilter, setSelectedLoaiHoSoFilter] = useState<string>('Tất cả');
    const [showOnlyTon90Days, setShowOnlyTon90Days] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    
    // States cho Tab Công cụ Vào số GCN (di chuyển từ VaoSoView sang)
    const [showVaoSoModal, setShowVaoSoModal] = useState(false);
    const [tempRecords, setTempRecords] = useState<any[]>([]);
    const [tempRecordsLoading, setTempRecordsLoading] = useState(false);
    const [selectedTempIds, setSelectedTempIds] = useState<Set<string>>(new Set());
    const [tempExcelFileName, setTempExcelFileName] = useState('');
    const [showConfirmHandoverModal, setShowConfirmHandoverModal] = useState(false);
    const [handoverBatchMode, setHandoverBatchMode] = useState<'new' | 'existing'>('new');
    const [selectedExistingHandoverBatch, setSelectedExistingHandoverBatch] = useState<string>('');
    const [isSubmittingHandover, setIsSubmittingHandover] = useState(false);
    const [currentBookNumber, setCurrentBookNumber] = useState<string>('000000');
    const [showSettingsModal, setShowSettingsModal] = useState(false);
    const [showExportReportModal, setShowExportReportModal] = useState(false);
    const [exportFromDate, setExportFromDate] = useState(() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
    });
    const [exportToDate, setExportToDate] = useState(() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    });
    const [exportWard, setExportWard] = useState('Tất cả');
    const tempFileInputRef = useRef<HTMLInputElement>(null);
    const [showExportHandover1CuaModal, setShowExportHandover1CuaModal] = useState(false);
    const [exportHandover1CuaParams, setExportHandover1CuaParams] = useState({
        filterType: 'by_date' as 'by_date' | 'by_batch',
        dateStr: new Date().toISOString().split('T')[0],
        batchName: '',
        deliverer: '',
        receiver: ''
    });
    
    // State phân trang cho phần hiển thị dữ liệu
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(15);
    
    // State danh sách cán bộ lọc động
    const [canBoList, setCanBoList] = useState<string[]>(DEFAULT_CAN_BO_LIST);
    const [dangKyCanBo, setDangKyCanBo] = useState<string[]>([]);
    const [oneDoorCanBo, setOneDoorCanBo] = useState<string[]>([]);
    
    // Popup phân loại hàng loạt
    const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
    const [batchStatus, setBatchStatus] = useState<string>('');
    const [batchCanBo, setBatchCanBo] = useState<string>('');
    const [batchDate, setBatchDate] = useState<string>('');
    const [batchLyDoTra, setBatchLyDoTra] = useState<string>('');

    // Định nghĩa cấu trúc hồ sơ khớp từ Excel
    interface MatchedExcelRecord {
        id: string;
        soHieu: string;
        chuHoSo: string;
        trangThaiGoc: string;
        canBoXuLyGoc: string;
        excelDate: string;
    }

    // State cho công cụ phân loại hồ sơ bằng Excel
    const [showExcelClassifyModal, setShowExcelClassifyModal] = useState(false);
    const [excelMatchedRecords, setExcelMatchedRecords] = useState<MatchedExcelRecord[]>([]);
    const [excelSelectedIds, setExcelSelectedIds] = useState<Set<string>>(new Set());
    const [excelActiveToolStatus, setExcelActiveToolStatus] = useState<string>('Đã chuyển thông tin thuế');
    const [excelCanBoUpdate, setExcelCanBoUpdate] = useState<string>('');
    const [excelLyDoTraUpdate, setExcelLyDoTraUpdate] = useState<string>('');
    const [excelTotalScanned, setExcelTotalScanned] = useState<number>(0);
    const [excelFileName, setExcelFileName] = useState<string>('');
    const [excelDuplicateCodes, setExcelDuplicateCodes] = useState<{ code: string; count: number; rows: number[]; chuHoSo: string }[]>([]);
    const [excelMatchedRowsCount, setExcelMatchedRowsCount] = useState<number>(0);
    const excelFileInputRef = useRef<HTMLInputElement>(null);

    // State cho việc hiển thị báo cáo & kiểm tra trùng tệp Excel iGate trước khi lưu
    const [showImportConfirmModal, setShowImportConfirmModal] = useState(false);
    const [tempImportedRecords, setTempImportedRecords] = useState<IGateRecord[]>([]);
    const [importReport, setImportReport] = useState<{
        totalCount: number;
        validCount: number;
        duplicateInFileCount: number;
        duplicateWithDbCount: number;
        duplicateInFileCodes: string[];
        duplicateWithDbCodes: string[];
        dupCodeDiffCount: number;
        dupCodeDiffInFileCount: number;
        dupCodeDiffWithDbCount: number;
        dupCodeDiffInFileCodes: string[];
        dupCodeDiffWithDbCodes: string[];
        skippedRecords: IGateRecord[];
        skippedReasons: string[];
    }>({
        totalCount: 0,
        validCount: 0,
        duplicateInFileCount: 0,
        duplicateWithDbCount: 0,
        duplicateInFileCodes: [],
        duplicateWithDbCodes: [],
        dupCodeDiffCount: 0,
        dupCodeDiffInFileCount: 0,
        dupCodeDiffWithDbCount: 0,
        dupCodeDiffInFileCodes: [],
        dupCodeDiffWithDbCodes: [],
        skippedRecords: [],
        skippedReasons: []
    });

    // Modal Form States
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingRecord, setEditingRecord] = useState<IGateRecord | null>(null);
    const [formData, setFormData] = useState<Omit<IGateRecord, 'id'>>({
        soHieu: '',
        tenThuTuc: '',
        tenLinhVuc: 'Đất đai',
        ngayTiepNhan: new Date().toISOString().split('T')[0],
        ngayHenTra: '',
        ngayKetThuc: '',
        donVi: 'Chi nhánh Văn phòng Đăng ký Đất đai',
        chuHoSo: '',
        soDienThoai: '',
        canBoXuLy: '',
        trangThai: 'Mới tiếp nhận',
        chuyenQuyen: '',
        soTo: '',
        soThua: '',
        tongDienTich: null,
        dienTichDatO: null,
        dienTichDatNongNghiep: null,
        diaDanh: '',
        soPhatHanh: '',
        thoiHanSuDung: '',
        cccd: '',
        ghiChu: '',
        ngayTra: '',
        lyDoTra: ''
    });

    const fileInputRef = useRef<HTMLInputElement>(null);

    const [viewingRecord, setViewingRecord] = useState<IGateRecord | null>(null);
    const [isColumnDropdownOpen, setIsColumnDropdownOpen] = useState(false);
    const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(() => {
        try {
            const saved = localStorage.getItem('igate_visible_columns_v4');
            if (saved) {
                const parsed = JSON.parse(saved);
                return {
                    stt: parsed.stt !== undefined ? parsed.stt : true,
                    thongTinHoSo: parsed.thongTinHoSo !== undefined ? parsed.thongTinHoSo : true,
                    cccd: parsed.cccd !== undefined ? parsed.cccd : true,
                    tenThuTuc: parsed.tenThuTuc !== undefined ? parsed.tenThuTuc : true,
                    tenLinhVuc: parsed.tenLinhVuc !== undefined ? parsed.tenLinhVuc : false,
                    thoiHanXuLy: parsed.thoiHanXuLy !== undefined ? parsed.thoiHanXuLy : true,
                    ngayKetThuc: parsed.ngayKetThuc !== undefined ? parsed.ngayKetThuc : false,
                    donVi: parsed.donVi !== undefined ? parsed.donVi : false,
                    canBoXuLy: parsed.canBoXuLy !== undefined ? parsed.canBoXuLy : true,
                    trangThai: parsed.trangThai !== undefined ? parsed.trangThai : true,
                    chuyenQuyen: parsed.chuyenQuyen !== undefined ? parsed.chuyenQuyen : true,
                    soTo: parsed.soTo !== undefined ? parsed.soTo : true,
                    soThua: parsed.soThua !== undefined ? parsed.soThua : true,
                    tongDienTich: parsed.tongDienTich !== undefined ? parsed.tongDienTich : false,
                    dienTichDatO: parsed.dienTichDatO !== undefined ? parsed.dienTichDatO : false,
                    dienTichDatNongNghiep: parsed.dienTichDatNongNghiep !== undefined ? parsed.dienTichDatNongNghiep : false,
                    diaDanh: parsed.diaDanh !== undefined ? parsed.diaDanh : true,
                    soPhatHanh: parsed.soPhatHanh !== undefined ? parsed.soPhatHanh : false,
                    thoiHanSuDung: parsed.thoiHanSuDung !== undefined ? parsed.thoiHanSuDung : false,
                    ghiChu: parsed.ghiChu !== undefined ? parsed.ghiChu : true,
                };
            }
        } catch (e) {
            console.error('Lỗi khi đọc visibleColumns từ localStorage v4', e);
        }
        return {
            stt: true,
            thongTinHoSo: true,
            cccd: true,
            tenThuTuc: true,
            tenLinhVuc: false,
            thoiHanXuLy: true,
            ngayKetThuc: false,
            donVi: false,
            canBoXuLy: true,
            trangThai: true,
            chuyenQuyen: true,
            soTo: true,
            soThua: true,
            tongDienTich: false,
            dienTichDatO: false,
            dienTichDatNongNghiep: false,
            diaDanh: true,
            soPhatHanh: false,
            thoiHanSuDung: false,
            ghiChu: true,
        };
    });

    useEffect(() => {
        try {
            localStorage.setItem('igate_visible_columns_v4', JSON.stringify(visibleColumns));
        } catch (e) {
            console.error('Lỗi khi lưu visibleColumns vào localStorage v4', e);
        }
    }, [visibleColumns]);
    const columnDropdownRef = useRef<HTMLDivElement>(null);

    const columnsList = [
        { key: 'stt', label: 'STT' },
        { key: 'thongTinHoSo', label: 'Thông tin hồ sơ (Mã HS, Chủ sử dụng...)' },
        { key: 'cccd', label: 'CCCD' },
        { key: 'tenThuTuc', label: 'Loại biến động' },
        { key: 'chuyenQuyen', label: 'CHUYỂN QUYỀN' },
        { key: 'soTo', label: 'Số tờ' },
        { key: 'soThua', label: 'Số thửa' },
        { key: 'tongDienTich', label: 'Tổng diện tích' },
        { key: 'dienTichDatO', label: 'Diện tích Đất ở' },
        { key: 'dienTichDatNongNghiep', label: 'Diện tích Đất nông nghiệp' },
        { key: 'diaDanh', label: 'Địa danh' },
        { key: 'soPhatHanh', label: 'Số phát hành' },
        { key: 'thoiHanSuDung', label: 'Thời hạn sử dụng' },
        { key: 'tenLinhVuc', label: 'Tên lĩnh vực' },
        { key: 'thoiHanXuLy', label: 'Thời hạn nhận & trả' },
        { key: 'ngayKetThuc', label: 'Ngày kết thúc' },
        { key: 'donVi', label: 'Cơ quan/đơn vị' },
        { key: 'canBoXuLy', label: 'Cán bộ xử lý' },
        { key: 'trangThai', label: 'Trạng thái' },
        { key: 'ghiChu', label: 'GHI CHÚ' },
    ];

    const toggleColumn = (key: string) => {
        setVisibleColumns(prev => ({
            ...prev,
            [key]: !prev[key]
        }));
    };

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (columnDropdownRef.current && !columnDropdownRef.current.contains(event.target as Node)) {
                setIsColumnDropdownOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    // Tải dữ liệu từ database / API
    const loadData = async () => {
        const data = await fetchIGateRecords(DEFAULT_IGATE_RECORDS);
        
        try {
            const { data: archives, error } = await supabase
                .from('archive_records')
                .select('*')
                .eq('type', 'vaoso');
                
            if (!error && archives) {
                const archiveMap = new Map<string, any>();
                archives.forEach(ar => {
                    if (ar.so_hieu) {
                        archiveMap.set(ar.so_hieu.trim().toLowerCase(), ar);
                    }
                });
                
                const updatedData = data.map(record => {
                    const match = archiveMap.get(record.soHieu.trim().toLowerCase());
                    if (match) {
                        return {
                            ...record,
                            soVaoSo: record.soVaoSo || match.data?.so_vao_so || '',
                            ngayGiao1Cua: match.data?.scan_date || match.data?.ngay_nhan || match.ngay_thang || '',
                            dotGiao1Cua: match.data?.scan_batch_id || match.data?.batch_id || ''
                        };
                    }
                    return record;
                });
                setRecords(updatedData);
                return;
            }
        } catch (e) {
            console.error("Lỗi ghép dữ liệu bàn giao 1 cửa:", e);
        }
        
        setRecords(data);
    };

    useEffect(() => {
        loadData();
    }, []);

    const incrementString = (str: string): string => {
        const num = parseInt(str);
        if (isNaN(num)) return str;
        const nextNum = num + 1;
        if (str.length > nextNum.toString().length) {
            return nextNum.toString().padStart(str.length, '0');
        }
        return nextNum.toString();
    };

    // Tải thông tin Số vào sổ lớn nhất khi khởi chạy
    useEffect(() => {
        const loadBookNumber = async () => {
            const stored = await getSystemSetting('vaoso_current_book_number');
            if (stored) {
                setCurrentBookNumber(stored);
            } else {
                try {
                    const { data, error } = await supabase
                        .from('archive_records')
                        .select('data')
                        .eq('type', 'vaoso');
                    if (!error && data) {
                        let maxNum = 0;
                        data.forEach(r => {
                            const val = r.data?.so_vao_so || '';
                            if (val.startsWith('CN ')) {
                                const numPart = val.replace('CN ', '');
                                const num = parseInt(numPart);
                                if (!isNaN(num) && num > maxNum) {
                                    maxNum = num;
                                }
                            } else {
                                 const num = parseInt(val);
                                 if (!isNaN(num) && num > maxNum) {
                                    maxNum = num;
                                }
                            }
                        });
                        setCurrentBookNumber(maxNum.toString().padStart(6, '0'));
                    }
                } catch (e) {
                    console.error("Lỗi lấy số vào sổ lớn nhất:", e);
                }
            }
        };
        if (showVaoSoModal) {
            loadBookNumber();
        }
    }, [showVaoSoModal]);

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

    const handleDownloadTemplateVaoSo = () => {
        const templateData = [
            {
                'Số vào sổ': 'CN 00001',
                'Mã hồ sơ': 'HS001',
                'Tên chủ sử dụng': 'Trần Thị B',
                'Số tờ': '12',
                'Số thửa': '34',
                'Tổng diện tích': '150.5',
                'Đất ở': '100',
                'Đất nông nghiệp': '50.5',
                'Số phát hành': 'CQ123456',
                'Ngày ký GCN': '2023-11-01',
            }
        ];
        const ws = XLSX.utils.json_to_sheet(templateData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "MauNhapLieuVaoSo");
        XLSX.writeFile(wb, "Mau_Nhap_Lieu_Vao_So_GCN.xlsx");
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

                const getValue = (rowArr: any[], idx: number) => {
                    if (idx === -1 || !rowArr) return '';
                    let val = rowArr[idx];
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

                rows.forEach(rowArr => {
                    if (!rowArr || rowArr.length === 0) return;
                    const code = getValue(rowArr, colMap.ma_ho_so);
                    if (!code) return;

                    codesToQuery.push(code);

                    excelRowsData.push({
                        code: code,
                        so_to: getValue(rowArr, colMap.so_to),
                        so_thua: getValue(rowArr, colMap.so_thua),
                        tong_dien_tich: getValue(rowArr, colMap.tong_dien_tich),
                        dat_o: getValue(rowArr, colMap.dat_o),
                        dat_nn: getValue(rowArr, colMap.dat_nn),
                        so_phat_hanh: getValue(rowArr, colMap.so_phat_hanh),
                        so_vao_so: getValue(rowArr, colMap.so_vao_so),
                        ngay_ky_gcn: getValue(rowArr, colMap.ngay_ky_gcn) || new Date().toISOString().split('T')[0],
                        ten_chu_su_dung: getValue(rowArr, colMap.ten_chu_su_dung)
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

    const handleConfirmHandover = async () => {
        if (tempRecords.length === 0) return;
        setIsSubmittingHandover(true);

        try {
            const todayStr = new Date().toISOString().split('T')[0];
            const batchId = handoverBatchMode === 'new' ? currentBookNumber : (selectedExistingHandoverBatch || 'Đợt 1');

            const archivePromises = tempRecords.map(async (r) => {
                if (r.existsInSystem && r.id) {
                    // Kiểm tra xem dữ liệu Tờ, Thửa, v.v. có bị thay đổi so với dữ liệu hệ thống (IGate) không
                    const hasChanged = r.customerName !== r.db_customerName ||
                                      String(r.mapSheet) !== String(r.db_mapSheet) ||
                                      String(r.landPlot) !== String(r.db_landPlot) ||
                                      String(r.area) !== String(r.db_area);
                    
                    if (hasChanged) {
                        // Cập nhật thông tin mới vào bảng iGate records (igate_records)
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

                // Lưu biên bản lưu trữ loại 'vaoso' để bàn giao 1 cửa
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
                    ghi_chu: r.existsInSystem ? '' : 'Tự động tạo mới trên iGate (Mã hồ sơ chưa có sẵn)',
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
                    created_by: currentUser?.username || 'user',
                    data: archiveData
                };

                return saveArchiveRecord(newArchiveRecord);
            });

            await Promise.all(archivePromises);

            alert(`Đã hoàn thành cập nhật thông tin Số vào sổ, Ngày ký GCN lên hệ thống iGate và tạo danh sách bàn giao 1 cửa gồm ${tempRecords.length} hồ sơ thành công!`);
            
            // Tải lại danh sách iGate records chính thức để cập nhật UI
            if (typeof loadData === 'function') {
                await loadData();
            } else {
                // Nếu loadData không được truyền từ props, ta có thể tự tải
                const { data: refreshed, error: err } = await supabase.from('igate_records').select('*').order('created_at', { ascending: false });
                if (!err && refreshed) setRecords(refreshed);
            }
            
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

    const handleTriggerExport = async () => {
        try {
            // Tải danh sách lưu trữ loại 'vaoso' từ Supabase
            const { data, error } = await supabase
                .from('archive_records')
                .select('*')
                .eq('type', 'vaoso');
            
            if (error) {
                console.error("Lỗi fetch dữ liệu bàn giao:", error);
                alert("Không thể tải danh sách bàn giao.");
                return;
            }

            const allArchiveRecords: ArchiveRecord[] = data || [];
            
            // Lọc theo điều kiện cấu hình
            let filtered = allArchiveRecords;
            if (exportHandover1CuaParams.filterType === 'by_date') {
                const searchDate = exportHandover1CuaParams.dateStr;
                filtered = allArchiveRecords.filter(r => {
                    const scanDate = r.data?.scan_date || '';
                    const ngayNhan = r.data?.ngay_nhan || '';
                    return scanDate.includes(searchDate) || ngayNhan.includes(searchDate);
                });
            } else {
                const searchBatch = exportHandover1CuaParams.batchName.toLowerCase().trim();
                filtered = allArchiveRecords.filter(r => {
                    const batchId = String(r.data?.scan_batch_id || '').toLowerCase().trim();
                    return batchId.includes(searchBatch);
                });
            }

            // Gọi hàm xuất Excel
            exportHandover1CuaExcel(
                filtered,
                exportHandover1CuaParams.dateStr,
                exportHandover1CuaParams.batchName || 'Mặc định',
                'all'
            );
        } catch (err) {
            console.error("Lỗi xuất bàn giao:", err);
            alert("Đã xảy ra lỗi khi xuất file Excel bàn giao.");
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

    // Tự động chuyển về trang 1 khi thay đổi trạng thái tìm kiếm hoặc bộ lọc
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, selectedTrangThaiFilter, selectedLinhVucFilter, selectedLoaiHoSoFilter]);

    // Tải danh sách cán bộ xử lý động (gồm tổ trưởng, tổ phó, nhân viên thuộc tổ đăng ký và cán bộ Một cửa)
    useEffect(() => {
        const loadCanBoList = async () => {
            try {
                const emps = await fetchEmployees();
                const uss = await fetchUsers();
                
                // Cán bộ thuộc tổ đăng ký (department chứa "đăng ký")
                const dangKyEmps = emps.filter(e => {
                    const dept = (e.department || '').toLowerCase();
                    return dept.includes('đăng ký') || dept.includes('dang ky') || dept.includes('đăng ký đất đai');
                });
                
                // Nhân viên Một cửa (role = 'ONEDOOR' hoặc department chứa 'một cửa')
                const oneDoorUsers = uss.filter(u => u.role === UserRole.ONEDOOR);
                const oneDoorEmps = emps.filter(e => {
                    const dept = (e.department || '').toLowerCase();
                    return dept.includes('một cửa') || dept.includes('mot cua') || dept.includes('1 cửa');
                });
                
                const dkNamesSet = new Set<string>();
                dangKyEmps.forEach(e => { if (e.name) dkNamesSet.add(e.name.trim()); });
                
                const odNamesSet = new Set<string>();
                oneDoorUsers.forEach(u => { if (u.name) odNamesSet.add(u.name.trim()); });
                oneDoorEmps.forEach(e => { if (e.name) odNamesSet.add(e.name.trim()); });
                
                // Fallbacks/Mocks if empty
                if (dkNamesSet.size === 0) {
                    dkNamesSet.add("Nguyễn Văn Nam");
                    dkNamesSet.add("Lê Thị Thu");
                    dkNamesSet.add("Lê Tiến Anh");
                    dkNamesSet.add("Nguyễn Hoàng Minh");
                }
                if (odNamesSet.size === 0) {
                    odNamesSet.add("Võ Văn Kiệt");
                    odNamesSet.add("Trần Quốc Toản");
                }
                
                const dkList = Array.from(dkNamesSet);
                const odList = Array.from(odNamesSet);
                
                setDangKyCanBo(dkList);
                setOneDoorCanBo(odList);
                
                const combined = new Set<string>([...dkList, ...odList]);
                setCanBoList(Array.from(combined));
            } catch (e) {
                console.error("Lỗi tải danh sách cán bộ xử lý:", e);
                setDangKyCanBo(["Nguyễn Văn Nam", "Lê Thị Thu", "Lê Tiến Anh", "Nguyễn Hoàng Minh"]);
                setOneDoorCanBo(["Võ Văn Kiệt", "Trần Quốc Toản"]);
                setCanBoList(DEFAULT_CAN_BO_LIST);
            }
        };
        
        loadCanBoList();
    }, []);

    // Lưu dữ liệu vào database / API (dùng cho các thao tác mảng trực tiếp)
    const saveRecords = async (newRecords: IGateRecord[]) => {
        setRecords(newRecords);
        await saveIGateRecordsBatchApi(newRecords, DEFAULT_IGATE_RECORDS);
    };

    // Hàm cập nhật hoặc thêm mới hồ sơ
    const handleFormSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!formData.soHieu || !formData.tenThuTuc || !formData.chuHoSo) {
            alert('Vui lòng điền đầy đủ các thông tin bắt buộc (*)');
            return;
        }

        const tot = Number(formData.tongDienTich || 0);
        const o = Number(formData.dienTichDatO || 0);
        const calculatedNongNghiep = tot > 0 ? (tot - o) : null;

        const dataToSave = {
            ...formData,
            thoiHanSuDung: cleanThoiHanSuDung(formData.thoiHanSuDung),
            dienTichDatNongNghiep: calculatedNongNghiep,
            ngayTra: formData.trangThai === 'Hồ sơ trả' ? (formData.ngayKetThuc || getNowVietnameseString()) : formData.ngayTra,
            lyDoTra: formData.trangThai === 'Hồ sơ trả' ? (formData.ghiChu || '') : formData.lyDoTra,
            daThucHienNvtc: formData.trangThai === 'Đã thực hiện nghĩa vụ tài chính' ? true : formData.daThucHienNvtc,
            ngayThucHienNvtc: formData.trangThai === 'Đã thực hiện nghĩa vụ tài chính' ? (formData.ngayKetThuc || getNowVietnameseString()) : formData.ngayThucHienNvtc,
        };

        let isSuccess = false;
        if (editingRecord) {
            // Chỉnh sửa
            const updatedRecord = { ...editingRecord, ...dataToSave };
            const updated = records.map(r => r.id === editingRecord.id ? updatedRecord : r);
            setRecords(updated);
            isSuccess = await saveIGateRecordApi(updatedRecord, true, DEFAULT_IGATE_RECORDS);
        } else {
            // Thêm mới
            const newRecord: IGateRecord = {
                id: 'ig-' + Math.random().toString(36).substr(2, 9),
                ...dataToSave
            };
            setRecords([newRecord, ...records]);
            isSuccess = await saveIGateRecordApi(newRecord, false, DEFAULT_IGATE_RECORDS);
        }

        if (isSuccess) {
            loadData();
        }

        setIsFormOpen(false);
        setEditingRecord(null);
    };

    // Hàm xử lý phân loại hàng loạt từ popup
    const handleBatchClassifySubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!batchStatus && !batchCanBo) {
            alert("Vui lòng chọn Trạng thái hoặc Cán bộ xử lý để thực hiện phân loại!");
            return;
        }

        const statesWithDate = [
            "Đã chuyển thông tin thuế",
            "Đã phát hành thông báo thuế",
            "Đã thực hiện nghĩa vụ tài chính",
            "Chờ thực hiện nghĩa vụ tài chính",
            "Đã ký Giấy chứng nhận",
            "Chưa trả kết quả",
            "Đã trả kết quả",
            "Hồ sơ trả"
        ];

        let confirmMsg = `Bạn có chắc chắn muốn cập nhật hàng loạt cho ${selectedIds.size} hồ sơ đã chọn không?`;
        if (batchStatus) confirmMsg += `\n- Cập nhật trạng thái mới: ${batchStatus}`;
        if (batchStatus && statesWithDate.includes(batchStatus) && batchDate) {
            confirmMsg += `\n- Gán ngày của trạng thái: ${batchDate}`;
        }
        if (batchStatus === 'Hồ sơ trả' && batchLyDoTra) {
            confirmMsg += `\n- Lý do trả: ${batchLyDoTra}`;
        }
        if (batchCanBo) confirmMsg += `\n- Phân công cán bộ xử lý: ${batchCanBo}`;

        if (window.confirm(confirmMsg)) {
            const updated = records.map(r => {
                if (selectedIds.has(r.id)) {
                    const updatedRecord = { ...r };
                    if (batchStatus) {
                        updatedRecord.trangThai = batchStatus;
                        if (statesWithDate.includes(batchStatus)) {
                            updatedRecord.ngayKetThuc = batchDate || r.ngayKetThuc || getTodayString();
                        }
                        if (batchStatus === 'Hồ sơ trả') {
                            updatedRecord.ngayTra = batchDate || getNowVietnameseString();
                            updatedRecord.lyDoTra = batchLyDoTra;
                            updatedRecord.ghiChu = batchLyDoTra || r.ghiChu;
                        }
                        if (batchStatus === 'Đã thực hiện nghĩa vụ tài chính') {
                            updatedRecord.daThucHienNvtc = true;
                            updatedRecord.ngayThucHienNvtc = batchDate || getNowVietnameseString();
                        }
                    }
                    if (batchCanBo) {
                        updatedRecord.canBoXuLy = batchCanBo;
                    }
                    return updatedRecord;
                }
                return r;
            });

            await saveRecords(updated);
            setSelectedIds(new Set());
            setIsBatchModalOpen(false);
            alert(`Đã cập nhật phân loại thành công cho ${selectedIds.size} hồ sơ!`);
        }
    };

    // Hàm xử lý tải file Excel trong Công cụ phân loại bằng Excel
    const handleExcelClassifySelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setExcelFileName(file.name);
        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const bstr = evt.target?.result;
                const workbook = XLSX.read(bstr, { type: 'binary' });
                const wsname = workbook.SheetNames[0];
                const ws = workbook.Sheets[wsname];
                
                // Đọc dưới dạng mảng 2 chiều (header: 1) để duyệt dễ dàng
                const data = XLSX.utils.sheet_to_json<any>(ws, { header: 1 });

                if (data.length === 0) {
                    alert('File Excel rỗng!');
                    return;
                }

                const parsedRows: { code: string; date: string }[] = [];
                
                data.forEach((row: any, idx: number) => {
                    if (idx === 0) {
                        const cell0 = String(row[0] || '').toLowerCase();
                        const cell1 = String(row[1] || '').toLowerCase();
                        if (cell0.includes('mã') || cell0.includes('số hiệu') || cell0.includes('hồ sơ') || cell1.includes('ngày')) {
                            return; // bỏ qua hàng tiêu đề
                        }
                    }
                    if (Array.isArray(row) && row.length >= 1) {
                        const codeVal = String(row[0] || '').trim();
                        let dateVal = '';
                        if (row.length >= 2 && row[1] !== undefined && row[1] !== null) {
                            const rawDate = row[1];
                            if (typeof rawDate === 'number') {
                                try {
                                    const dateObj = XLSX.SSF.parse_date_code(rawDate);
                                    const d = String(dateObj.d).padStart(2, '0');
                                    const m = String(dateObj.m).padStart(2, '0');
                                    const y = dateObj.y;
                                    dateVal = `${d}/${m}/${y}`;
                                } catch (e) {
                                    dateVal = String(rawDate).trim();
                                }
                            } else {
                                dateVal = String(rawDate).trim();
                            }
                        }
                        
                        // Nếu trống ngày, mặc định là ngày hôm nay dạng dd/mm/yyyy
                        if (!dateVal) {
                            const dObj = new Date();
                            const dd = String(dObj.getDate()).padStart(2, '0');
                            const mm = String(dObj.getMonth() + 1).padStart(2, '0');
                            const yyyy = dObj.getFullYear();
                            dateVal = `${dd}/${mm}/${yyyy}`;
                        }

                        if (codeVal.length >= 4) {
                            parsedRows.push({ code: codeVal, date: dateVal });
                        }
                    }
                });

                setExcelTotalScanned(parsedRows.length);

                if (parsedRows.length === 0) {
                    alert('Không tìm thấy mã hồ sơ khả dụng nào trong file Excel!');
                    setExcelMatchedRecords([]);
                    setExcelSelectedIds(new Set());
                    return;
                }

                // Thống kê trùng mã trong file excel và lưu dòng xuất hiện
                const codeOccurrences: { [key: string]: { count: number; rows: number[] } } = {};
                parsedRows.forEach((row, idx) => {
                    const key = row.code.trim().toUpperCase();
                    if (!codeOccurrences[key]) {
                        codeOccurrences[key] = { count: 0, rows: [] };
                    }
                    codeOccurrences[key].count += 1;
                    codeOccurrences[key].rows.push(idx + 2); // Dòng trong excel (idx + 2 vì dòng đầu tiên là tiêu đề)
                });

                const duplicates = Object.keys(codeOccurrences)
                    .filter(k => codeOccurrences[k].count > 1)
                    .map(k => {
                        const matchedRec = records.find(r => r.soHieu.toUpperCase() === k);
                        return {
                            code: k,
                            count: codeOccurrences[k].count,
                            rows: codeOccurrences[k].rows,
                            chuHoSo: matchedRec ? matchedRec.chuHoSo : 'Không tìm thấy trong hệ thống'
                        };
                    });
                setExcelDuplicateCodes(duplicates);

                // Thực hiện quét trong danh sách hồ sơ hiện tại (records) và loại bỏ trùng lặp bằng Map (giữ dòng cuối cùng trong tệp Excel)
                let matchedRawCount = 0;
                const matchedMap = new Map<string, MatchedExcelRecord>();

                parsedRows.forEach(row => {
                    const found = records.find(r => r.soHieu.toLowerCase() === row.code.toLowerCase());
                    if (found) {
                        matchedRawCount++;
                        matchedMap.set(found.id, {
                            id: found.id,
                            soHieu: found.soHieu,
                            chuHoSo: found.chuHoSo,
                            trangThaiGoc: found.trangThai,
                            canBoXuLyGoc: found.canBoXuLy || '',
                            excelDate: row.date
                        });
                    }
                });

                const matchedList = Array.from(matchedMap.values());
                setExcelMatchedRowsCount(matchedRawCount);
                setExcelMatchedRecords(matchedList);
                
                // Mặc định chọn tất cả các hồ sơ khớp tìm thấy độc nhất
                setExcelSelectedIds(new Set(matchedList.map(m => m.id)));
                
                if (matchedRawCount === 0) {
                    alert(`Đã quét được ${parsedRows.length} dòng từ tệp Excel, nhưng không có hồ sơ nào trùng khớp mã với hệ thống.`);
                }

            } catch (err) {
                console.error(err);
                alert('Có lỗi xảy ra khi đọc file Excel này!');
            }
        };

        reader.readAsBinaryString(file);
        e.target.value = ''; // Reset input
    };

    // Áp dụng cập nhật phân loại theo Excel hàng loạt
    const handleExcelClassifyApply = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (excelSelectedIds.size === 0) {
            alert('Vui lòng chọn ít nhất một hồ sơ trong danh sách khớp để phân loại!');
            return;
        }

        let confirmMsg = `Bạn có chắc muốn áp dụng cập nhật trạng thái "${excelActiveToolStatus}" cho ${excelSelectedIds.size} hồ sơ được tích chọn không?`;
        if (excelCanBoUpdate) confirmMsg += `\n- Cán bộ thụ lý mới: ${excelCanBoUpdate}`;
        confirmMsg += `\n- Ngày của trạng thái sẽ được cập nhật tự động theo file Excel cho từng hồ sơ.`;

        if (window.confirm(confirmMsg)) {
            const updated = records.map(r => {
                if (excelSelectedIds.has(r.id)) {
                    const matchedItem = excelMatchedRecords.find(m => m.id === r.id);
                    const clone = { ...r };
                    clone.trangThai = excelActiveToolStatus;
                    if (matchedItem) {
                        clone.ngayKetThuc = matchedItem.excelDate;
                    }
                    if (excelActiveToolStatus === 'Hồ sơ trả') {
                        clone.ngayTra = (matchedItem && matchedItem.excelDate) || getNowVietnameseString();
                        clone.lyDoTra = excelLyDoTraUpdate || 'Trả lại theo phân loại Excel';
                        clone.ghiChu = excelLyDoTraUpdate || 'Trả lại theo phân loại Excel';
                    }
                    if (excelActiveToolStatus === 'Đã thực hiện nghĩa vụ tài chính') {
                        clone.daThucHienNvtc = true;
                        clone.ngayThucHienNvtc = (matchedItem && matchedItem.excelDate) || getNowVietnameseString();
                    }
                    if (excelCanBoUpdate) {
                        clone.canBoXuLy = excelCanBoUpdate;
                    }
                    return clone;
                }
                return r;
            });

            await saveRecords(updated);
            
            alert(`Đã phân loại trạng thái "${excelActiveToolStatus}" thành công cho ${excelSelectedIds.size} hồ sơ iGate!`);
            setShowExcelClassifyModal(false);
            setExcelMatchedRecords([]);
            setExcelSelectedIds(new Set());
            setExcelCanBoUpdate('');
            setExcelFileName('');
            setExcelTotalScanned(0);
            setExcelDuplicateCodes([]);
            setExcelMatchedRowsCount(0);
        }
    };

    // Hàm mở form thêm mới
    const handleAddNew = () => {
        setEditingRecord(null);
        setFormData({
            soHieu: '',
            tenThuTuc: '',
            tenLinhVuc: 'Đất đai',
            ngayTiepNhan: getNowVietnameseString(),
            ngayHenTra: '',
            ngayKetThuc: '',
            donVi: 'Chi nhánh Văn phòng Đăng ký Đất đai',
            chuHoSo: '',
            soDienThoai: '',
            canBoXuLy: canBoList[0] || '',
            trangThai: 'Mới tiếp nhận',
            chuyenQuyen: '',
            soTo: '',
            soThua: '',
            tongDienTich: null,
            dienTichDatO: null,
            dienTichDatNongNghiep: null,
            diaDanh: '',
            soPhatHanh: '',
            thoiHanSuDung: '',
            cccd: '',
            ghiChu: '',
            ngayTra: getNowVietnameseString(),
            lyDoTra: ''
        });
        setIsFormOpen(true);
    };

    // Hàm mở form chỉnh sửa
    const handleEdit = (record: IGateRecord) => {
        setEditingRecord(record);
        setFormData({
            soHieu: record.soHieu,
            tenThuTuc: record.tenThuTuc,
            tenLinhVuc: record.tenLinhVuc,
            ngayTiepNhan: record.ngayTiepNhan ? formatDisplayDateInClient(record.ngayTiepNhan) : '',
            ngayHenTra: record.ngayHenTra ? formatDisplayDateInClient(record.ngayHenTra) : '',
            ngayKetThuc: record.ngayKetThuc ? formatDisplayDateInClient(record.ngayKetThuc) : '',
            donVi: record.donVi,
            chuHoSo: record.chuHoSo,
            soDienThoai: record.soDienThoai || '',
            canBoXuLy: record.canBoXuLy || '',
            trangThai: record.trangThai,
            chuyenQuyen: record.chuyenQuyen || '',
            soTo: record.soTo || '',
            soThua: record.soThua || '',
            tongDienTich: record.tongDienTich !== undefined ? record.tongDienTich : null,
            dienTichDatO: record.dienTichDatO !== undefined ? record.dienTichDatO : null,
            dienTichDatNongNghiep: record.dienTichDatNongNghiep !== undefined ? record.dienTichDatNongNghiep : null,
            diaDanh: record.diaDanh || '',
            soPhatHanh: record.soPhatHanh || '',
            thoiHanSuDung: record.thoiHanSuDung || '',
            cccd: record.cccd || '',
            ghiChu: record.ghiChu || '',
            ngayTra: record.ngayTra || '',
            lyDoTra: record.lyDoTra || ''
        });
        setIsFormOpen(true);
    };

    // Hàm xóa hồ sơ
    const handleDelete = async (id: string, code: string) => {
        if (window.confirm(`Bạn có chắc chắn muốn xóa hồ sơ iGate số ${code}?`)) {
            const updated = records.filter(r => r.id !== id);
            setRecords(updated);
            const success = await deleteIGateRecordApi(id, DEFAULT_IGATE_RECORDS);
            if (success) {
                loadData();
            }
        }
    };

    // Khôi phục dữ liệu mẫu
    const handleResetToDefault = async () => {
        if (window.confirm('Bạn có muốn khôi phục danh sách Hồ sơ iGate về dữ liệu mẫu chuẩn hóa trên máy chủ không?')) {
            setRecords(DEFAULT_IGATE_RECORDS);
            const success = await resetIGateRecordsToDefaultApi(DEFAULT_IGATE_RECORDS);
            if (success) {
                loadData();
                alert('Khôi phục dữ liệu mẫu thành công!');
            }
        }
    };

    // Xóa toàn bộ dữ liệu vĩnh viễn (Chỉ Admin thực hiện)
    const handleDeleteAllRecords = async () => {
        if (window.confirm('CẢNH BÁO: Bạn có thực sự chắc chắn muốn xóa TOÀN BỘ dữ liệu Hồ sơ iGate không?\nHành động này không thể khôi phục lại!')) {
            setRecords([]);
            const success = await deleteAllIGateRecordsApi();
            if (success) {
                loadData();
                alert('Đã xóa sạch toàn bộ dữ liệu hồ sơ iGate!');
            }
        }
    };

    // --- LOGIC THỐNG KÊ & DASHBOARD ---
    const stats = useMemo(() => {
        const total = records.length;
        const newReceipt = records.filter(r => r.trangThai === 'Mới tiếp nhận').length;
        
        // Hồ sơ chờ thuế (Đã chuyển thông tin thuế + Đã phát hành thông báo thuế + Đã thực hiện nghĩa vụ tài chính + Chờ thực hiện nghĩa vụ tài chính)
        const daChuyenThongTinThue = records.filter(r => r.trangThai === 'Đã chuyển thông tin thuế').length;
        const daPhatHanhThongBaoThue = records.filter(r => r.trangThai === 'Đã phát hành thông báo thuế').length;
        const daThucHienNghiaVuTaiChinh = records.filter(r => r.trangThai === 'Đã thực hiện nghĩa vụ tài chính').length;
        const choThucHienNghiaVuTaiChinh = Math.max(0, daPhatHanhThongBaoThue - daThucHienNghiaVuTaiChinh);
        const countChoThue = daChuyenThongTinThue + daPhatHanhThongBaoThue;

        // Hồ sơ chờ trả kết quả
        const daKyGCN = records.filter(r => r.trangThai === 'Đã ký Giấy chứng nhận').length;
        const chuaTraKQ = records.filter(r => r.trangThai === 'Chưa trả kết quả').length;
        const countChoTraKQ = daKyGCN + chuaTraKQ;

        // Hồ sơ tồn trên 90 ngày (Chưa hoàn thành 'Đã trả kết quả' và thời gian tiếp nhận > 90 ngày)
        const today = new Date();
        const countTon90Ngay = records.filter(r => {
            if (r.trangThai === 'Đã trả kết quả' || r.ngayKetThuc) return false;
            if (!r.ngayTiepNhan) return false;
            const tiepNhanDate = parseToDateObject(r.ngayTiepNhan);
            if (!tiepNhanDate) return false;
            const diffTime = Math.abs(today.getTime() - tiepNhanDate.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            return diffDays > 90;
        }).length;

        // Hồ sơ đã trả kết quả
        const daTraKQ = records.filter(r => r.trangThai === 'Đã trả kết quả').length;

        // Hồ sơ bị trả (bị cơ quan chuyên môn trả lại)
        const hoSoTra = records.filter(r => r.trangThai === 'Hồ sơ trả').length;

        return {
            total,
            newReceipt,
            choThue: {
                total: countChoThue,
                daChuyenThongTinThue,
                daPhatHanhThongBaoThue,
                daThucHienNghiaVuTaiChinh,
                choThucHienNghiaVuTaiChinh
            },
            choTraKQ: {
                total: countChoTraKQ,
                daKyGCN,
                chuaTraKQ
            },
            ton90Ngay: countTon90Ngay,
            daTraKQ,
            hoSoTra
        };
    }, [records]);

    // Dữ liệu biểu đồ tăng giảm hồ sơ tồn theo tháng trong năm nay
    const chartData = useMemo(() => {
        const months = [
            { month: 'T1', count: 0 },
            { month: 'T2', count: 0 },
            { month: 'T3', count: 0 },
            { month: 'T4', count: 0 },
            { month: 'T5', count: 0 },
            { month: 'T6', count: 0 },
            { month: 'T7', count: 0 },
            { month: 'T8', count: 0 },
            { month: 'T9', count: 0 },
            { month: 'T10', count: 0 },
            { month: 'T11', count: 0 },
            { month: 'T12', count: 0 },
        ];

        // Lọc những hồ sơ TỒN (Chưa hoàn thành và tiếp nhận trong năm 2026)
        records.forEach(r => {
            if (r.trangThai !== 'Đã trả kết quả' && !r.ngayKetThuc && r.ngayTiepNhan) {
                const date = parseToDateObject(r.ngayTiepNhan);
                if (date && date.getFullYear() === 2026) {
                    const monthIdx = date.getMonth(); // 0-11
                    if (monthIdx >= 0 && monthIdx < 12) {
                        months[monthIdx].count += 1;
                    }
                }
            }
        });

        return months;
    }, [records]);

    const loaiHoSoList = useMemo(() => {
        const list = records.map(r => r.tenThuTuc).filter(Boolean);
        return Array.from(new Set(list)).sort();
    }, [records]);

    // --- BỘ LỌC DANH SÁCH ---
    const filteredRecords = useMemo(() => {
        const today = new Date();
        return records.filter(r => {
            // Lọc theo từ khóa tìm kiếm (chủ hồ sơ, số hồ sơ, số điện thoại, cán bộ xử lý)
            const keyword = searchTerm.toLowerCase();
            const matchSearch = searchTerm === '' || 
                r.chuHoSo.toLowerCase().includes(keyword) ||
                r.soHieu.toLowerCase().includes(keyword) ||
                (r.soDienThoai && r.soDienThoai.includes(keyword)) ||
                (r.canBoXuLy && r.canBoXuLy.toLowerCase().includes(keyword)) ||
                r.tenThuTuc.toLowerCase().includes(keyword);

            // Lọc theo trạng thái
            let matchTrangThai = true;
            if (selectedTrangThaiFilter !== 'Tất cả') {
                if (selectedTrangThaiFilter === 'Hồ sơ chờ thuế') {
                    matchTrangThai = r.trangThai === 'Đã chuyển thông tin thuế' || 
                                     r.trangThai === 'Đã phát hành thông báo thuế' || 
                                     r.trangThai === 'Đã thực hiện nghĩa vụ tài chính' ||
                                     r.trangThai === 'Chờ thực hiện nghĩa vụ tài chính';
                } else if (selectedTrangThaiFilter === 'Chờ trả kết quả') {
                    matchTrangThai = r.trangThai === 'Đã ký Giấy chứng nhận' || 
                                     r.trangThai === 'Chưa trả kết quả';
                } else if (selectedTrangThaiFilter === 'Đã phát hành thông báo thuế') {
                    matchTrangThai = r.trangThai === 'Đã phát hành thông báo thuế';
                } else if (selectedTrangThaiFilter === 'Chờ thực hiện nghĩa vụ tài chính') {
                    matchTrangThai = r.trangThai === 'Chờ thực hiện nghĩa vụ tài chính';
                } else if (selectedTrangThaiFilter === 'Đã ký Giấy chứng nhận') {
                    matchTrangThai = r.trangThai === 'Đã ký Giấy chứng nhận';
                } else if (selectedTrangThaiFilter === 'Chưa trả kết quả') {
                    matchTrangThai = r.trangThai === 'Chưa trả kết quả';
                } else {
                    matchTrangThai = r.trangThai === selectedTrangThaiFilter;
                }
            }

            // Lọc theo lĩnh vực
            const matchLinhVuc = selectedLinhVucFilter === 'Tất cả' || r.tenLinhVuc === selectedLinhVucFilter;

            // Lọc theo Loại hồ sơ (Thủ tục)
            const matchLoaiHoSo = selectedLoaiHoSoFilter === 'Tất cả' || r.tenThuTuc === selectedLoaiHoSoFilter;

            // Lọc theo tồn trên 90 ngày
            let matchTon90Days = true;
            if (showOnlyTon90Days) {
                if (r.trangThai === 'Đã trả kết quả' || r.ngayKetThuc) {
                    matchTon90Days = false;
                } else if (!r.ngayTiepNhan) {
                    matchTon90Days = false;
                } else {
                    const tiepNhanDate = parseToDateObject(r.ngayTiepNhan);
                    if (!tiepNhanDate) {
                        matchTon90Days = false;
                    } else {
                        const diffTime = Math.abs(today.getTime() - tiepNhanDate.getTime());
                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                        matchTon90Days = diffDays > 90;
                    }
                }
            }

            return matchSearch && matchTrangThai && matchLinhVuc && matchLoaiHoSo && matchTon90Days;
        });
    }, [records, searchTerm, selectedTrangThaiFilter, selectedLinhVucFilter, selectedLoaiHoSoFilter, showOnlyTon90Days]);

    // Các bản ghi iGate sau khi phân trang
    const paginatedRecords = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return filteredRecords.slice(start, start + itemsPerPage);
    }, [filteredRecords, currentPage, itemsPerPage]);

    // Tổng số lượng trang
    const totalPages = useMemo(() => {
        return Math.ceil(filteredRecords.length / itemsPerPage) || 1;
    }, [filteredRecords, itemsPerPage]);

    // --- CHỨC NĂNG IMPORT SỐ LIỆU EXCEL ---
    const handleExcelImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const bstr = evt.target?.result;
                const workbook = XLSX.read(bstr, { type: 'binary' });
                const wsname = workbook.SheetNames[0];
                const ws = workbook.Sheets[wsname];
                const data = XLSX.utils.sheet_to_json<any>(ws, { header: 1 });

                if (data.length < 2) {
                    alert('File Excel rỗng hoặc không đúng định dạng!');
                    return;
                }

                const headers: string[] = data[0].map((h: any) => String(h || '').trim().toLowerCase());
                
                // Ánh xạ cột
                const findColIndex = (keywords: string[]) => {
                    return headers.findIndex(h => keywords.some(k => h.includes(k)));
                };

                const idxSoHieu = findColIndex(['số hồ sơ', 'mã hồ sơ', 'số biên nhận', 'so ksh', 'so hieu', 'shs']);
                const idxTenThuTuc = findColIndex(['tên thủ tục', 'thuật tục', 'thủ tục hành chính', 'ten thu tuc', 'tên tthc', 'loại biến động', 'loai bien dong']);
                const idxTenLinhVuc = findColIndex(['tên lĩnh vực', 'lĩnh vực', 'linh vuc']);
                const idxNgayTiepNhan = findColIndex(['ngày tiếp nhận', 'tiếp nhận', 'ngay tiep nhan', 'ngày nhận', 'ngay nhan']);
                const idxNgayHenTra = findColIndex(['ngày hẹn trả', 'hẹn trả', 'ngay hen tra', 'ngày trả', 'ngay tra']);
                let idxNgayKetThuc = findColIndex(['kết thúc xử lý', 'ngày kết thúc', 'hoàn thành', 'ngay ket thuc', 'ngày trả kết quả', 'ngay tra ket qua']);
                
                // Nếu cột ngày kết thúc/ ngày trả thực tế trùng khớp với ngày hẹn trả hoặc ngày tiếp nhận, nghĩa là không thực sự có cột ngày trả thực tế riêng biệt
                if (idxNgayKetThuc !== -1 && (idxNgayKetThuc === idxNgayHenTra || idxNgayKetThuc === idxNgayTiepNhan)) {
                    idxNgayKetThuc = -1;
                }
                const idxDonVi = findColIndex(['cơ quan', 'đơn vị', 'co quan', 'don vi']);
                const idxChuHoSo = findColIndex(['chủ hồ sơ', 'chủ sử dụng', 'khách hàng', 'chu ho so', 'chu su dung', 'tên chủ']);
                const idxSoDienThoai = findColIndex(['số điện thoại', 'sđt', 'điện thoại', 'so dien thoai', 'sdt']);
                const idxCanBo = findColIndex(['cán bộ xử lý', 'cán bộ', 'can bo xu ly', 'can bo']);
                const idxTrangThai = findColIndex(['trạng thái', 'trang thai', 'tình trạng']);
                
                // 10 Cột bổ sung
                const idxChuyenQuyen = findColIndex(['chuyển quyền', 'chuyen quyen']);
                const idxSoTo = findColIndex(['số tờ', 'so to', 'số tơ', 'sờ tờ']);
                const idxSoThua = findColIndex(['số thửa', 'so thua', 'thửa']);
                const idxTongDienTich = findColIndex(['tổng diện tích', 'tong dien tich', 'tổng dt', 'tong dt', 'dien tich', 'diện tích', 'tong dtich']);
                const idxDienTichDatO = findColIndex(['đất ở', 'dat o', 'đất thổ cư', 'dat tho cu', 'thổ cư', 'tho cu', 'dt dat o']);
                const idxDiaDanh = findColIndex(['địa danh', 'dia danh', 'vị trí', 'vi tri', 'địa chỉ thửa đất', 'dia chi', 'dia ban', 'địa bàn']);
                const idxSoPhatHanh = findColIndex(['số phát hành', 'so phat hanh', 'phát hành', 'phat hanh']);
                const idxThoiHanSuDung = findColIndex(['thời hạn sử dụng', 'thoi han su dung', 'thời hạn', 'thoi han']);
                const idxCCCD = findColIndex(['cccd', 'số cccd', 'cmnd', 'số cmnd', 'chứng minh']);
                const idxGhiChu = findColIndex(['ghi chú', 'ghi chu', 'nhận xét', 'ghi chu', 'notes']);

                const newRecords: IGateRecord[] = [];
                
                // Helper đổi ngày Excel
                const parseExcelDate = (val: any) => {
                    if (!val) return '';
                    if (typeof val === 'number') {
                        // Tính chính xác ngày giờ từ số thực của Excel
                        const date = new Date(Math.round((val - 25569) * 86400000));
                        // Điều chỉnh múi giờ địa phương để không bị lệch ngày
                        const tzOffset = date.getTimezoneOffset() * 60000;
                        const localDate = new Date(date.getTime() + tzOffset);
                        const isoStr = localDate.toISOString(); // "YYYY-MM-DDTHH:mm:ss.sssZ"
                        const datePart = isoStr.split('T')[0];
                        const timePart = isoStr.split('T')[1].split('.')[0];
                        return timePart === '00:00:00' ? datePart : `${datePart} ${timePart}`;
                    }
                    const str = String(val).trim();
                    const partsSpace = str.split(/\s+/);
                    const datePart = partsSpace[0];
                    const timePart = partsSpace[1] || '';
                    
                    const parts = datePart.split(/[-/._]/);
                    if (parts.length === 3) {
                        let parsedDate = '';
                        // Nếu dạng DD/MM/YYYY
                        if (parts[0].length <= 2 && parts[2].length === 4) {
                            parsedDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
                        }
                        // Nếu dạng YYYY-MM-DD
                        else if (parts[0].length === 4) {
                            parsedDate = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
                        }
                        
                        if (parsedDate) {
                            return timePart ? `${parsedDate} ${timePart}` : parsedDate;
                        }
                    }
                    return str;
                };

                for (let i = 1; i < data.length; i++) {
                    const row = data[i];
                    if (!row || row.length === 0) continue;

                    const soHieu = idxSoHieu !== -1 ? String(row[idxSoHieu] || '').trim() : '';
                    const chuHoSo = idxChuHoSo !== -1 ? String(row[idxChuHoSo] || '').trim() : '';
                    
                    // Bỏ qua dòng trống không thỏa mãn thông tin cốt lõi
                    if (!soHieu && !chuHoSo) continue;

                    let rawTrangThai = idxTrangThai !== -1 ? String(row[idxTrangThai] || '').trim() : 'Mới tiếp nhận';
                    // Chuẩn hóa trạng thái phù hợp mảng TRANG_THAI_LIST
                    let normalizedTrangThai = 'Mới tiếp nhận';
                    if (rawTrangThai) {
                        const lowerTT = rawTrangThai.toLowerCase();
                        if (lowerTT.includes('mới') || lowerTT.includes('tiếp nhận')) normalizedTrangThai = 'Mới tiếp nhận';
                        else if (lowerTT.includes('chuyển thông tin thuế') || lowerTT.includes('đã chuyển thuế')) normalizedTrangThai = 'Đã chuyển thông tin thuế';
                        else if (lowerTT.includes('thực hiện nghĩa vụ tài chính') || lowerTT.includes('đã thực hiện nghĩa vụ') || lowerTT.includes('đã đóng thuế') || lowerTT.includes('đã nộp tiền')) normalizedTrangThai = 'Đã thực hiện nghĩa vụ tài chính';
                        else if (lowerTT.includes('phát hành thông báo thuế') || lowerTT.includes('đã phát hành')) normalizedTrangThai = 'Đã phát hành thông báo thuế';
                        else if (lowerTT.includes('chờ thực hiện nghĩa vụ') || lowerTT.includes('chuẩn bị đóng') || lowerTT.includes('chờ thuế')) normalizedTrangThai = 'Chờ thực hiện nghĩa vụ tài chính';
                        else if (lowerTT.includes('đã ký') || lowerTT.includes('ký gcn')) normalizedTrangThai = 'Đã ký Giấy chứng nhận';
                        else if (lowerTT.includes('chưa trả') || lowerTT.includes('chưa nhận')) normalizedTrangThai = 'Chưa trả kết quả';
                        else if (lowerTT.includes('đã trả') || lowerTT.includes('hoàn thành')) normalizedTrangThai = 'Đã trả kết quả';
                    }

                    // Đọc & chuyển đổi dạng diện tích số
                    let tongDienTich = null;
                    if (idxTongDienTich !== -1 && row[idxTongDienTich] !== undefined && row[idxTongDienTich] !== null) {
                        const valNum = Number(String(row[idxTongDienTich]).replace(/[^0-9.]/g, ''));
                        if (!isNaN(valNum)) tongDienTich = valNum;
                    }

                    let dienTichDatO = null;
                    if (idxDienTichDatO !== -1 && row[idxDienTichDatO] !== undefined && row[idxDienTichDatO] !== null) {
                        const valNum = Number(String(row[idxDienTichDatO]).replace(/[^0-9.]/g, ''));
                        if (!isNaN(valNum)) dienTichDatO = valNum;
                    }

                    // Tự động tính diện tích đất nông nghiệp
                    let dienTichDatNongNghiep = null;
                    if (tongDienTich !== null) {
                        const areaO = Number(dienTichDatO || 0);
                        dienTichDatNongNghiep = tongDienTich > areaO ? (tongDienTich - areaO) : 0;
                    }

                    // Tự động gán thời hạn sử dụng theo yêu cầu đề bài
                    let thoiHanSuDung = '';
                    if (idxThoiHanSuDung !== -1 && row[idxThoiHanSuDung] !== undefined && row[idxThoiHanSuDung] !== null) {
                        const rawVal = row[idxThoiHanSuDung];
                        if (typeof rawVal === 'number') {
                            thoiHanSuDung = parseExcelDate(rawVal);
                        } else {
                            const strVal = String(rawVal).trim();
                            if (/^\d{5,6}$/.test(strVal)) {
                                thoiHanSuDung = parseExcelDate(Number(strVal));
                            } else {
                                thoiHanSuDung = strVal;
                            }
                        }
                    }

                    newRecords.push({
                        id: 'ig-' + Math.random().toString(36).substr(2, 9),
                        soHieu: soHieu || `IGATE-${100000 + i}`,
                        excelRowIndex: i + 1,
                        tenThuTuc: idxTenThuTuc !== -1 && row[idxTenThuTuc] ? String(row[idxTenThuTuc]).trim() : 'Đăng ký đất đai biến động trực tuyến',
                        tenLinhVuc: idxTenLinhVuc !== -1 && row[idxTenLinhVuc] ? String(row[idxTenLinhVuc]).trim() : 'Đất đai',
                        ngayTiepNhan: idxNgayTiepNhan !== -1 ? parseExcelDate(row[idxNgayTiepNhan]) : new Date().toISOString().split('T')[0],
                        ngayHenTra: idxNgayHenTra !== -1 ? parseExcelDate(row[idxNgayHenTra]) : '',
                        ngayKetThuc: (idxNgayKetThuc !== -1 && row[idxNgayKetThuc]) ? parseExcelDate(row[idxNgayKetThuc]) : '',
                        donVi: idxDonVi !== -1 && row[idxDonVi] ? String(row[idxDonVi]).trim() : 'Chi nhánh Văn phòng Đăng ký Đất đai',
                        chuHoSo: chuHoSo || 'Chưa xác định',
                        soDienThoai: (() => {
                            if (idxSoDienThoai === -1 || row[idxSoDienThoai] === undefined || row[idxSoDienThoai] === null) return '';
                            let valStr = String(row[idxSoDienThoai]).trim();
                            const digits = valStr.replace(/[^\d]/g, '');
                            if (digits.length > 0 && !valStr.startsWith('0') && !valStr.startsWith('+')) {
                                return '0' + valStr;
                            }
                            return valStr;
                        })(),
                        canBoXuLy: idxCanBo !== -1 && row[idxCanBo] ? String(row[idxCanBo]).trim() : '',
                        trangThai: normalizedTrangThai,
                        
                        // Ánh xạ các trường mới
                        chuyenQuyen: idxChuyenQuyen !== -1 && row[idxChuyenQuyen] ? String(row[idxChuyenQuyen]).trim() : '',
                        soTo: idxSoTo !== -1 && row[idxSoTo] ? String(row[idxSoTo]).trim() : '',
                        soThua: idxSoThua !== -1 && row[idxSoThua] ? String(row[idxSoThua]).trim() : '',
                        tongDienTich: tongDienTich,
                        dienTichDatO: dienTichDatO,
                        dienTichDatNongNghiep: dienTichDatNongNghiep,
                        diaDanh: idxDiaDanh !== -1 && row[idxDiaDanh] ? String(row[idxDiaDanh]).trim() : '',
                        soPhatHanh: idxSoPhatHanh !== -1 && row[idxSoPhatHanh] ? String(row[idxSoPhatHanh]).trim() : '',
                        thoiHanSuDung: cleanThoiHanSuDung(thoiHanSuDung),
                        cccd: (() => {
                            if (idxCCCD === -1 || row[idxCCCD] === undefined || row[idxCCCD] === null) return '';
                            let valStr = String(row[idxCCCD]).trim().replace(/\s+/g, '');
                            if (/^\d{11}$/.test(valStr)) {
                                return '0' + valStr;
                            }
                            return valStr;
                        })(),
                        ghiChu: idxGhiChu !== -1 && row[idxGhiChu] ? String(row[idxGhiChu]).trim() : ''
                    });
                }

                if (newRecords.length > 0) {
                    const dbRecordsByCode = new Map<string, IGateRecord[]>();
                    const dbRecordsByKey3 = new Map<string, IGateRecord[]>();
                    records.forEach(dbRec => {
                        const code = (dbRec.soHieu || '').trim().toUpperCase();
                        const to = (dbRec.soTo || '').trim().toUpperCase();
                        const thua = (dbRec.soThua || '').trim().toUpperCase();
                        const key3 = getImportUniqueKey(dbRec.soHieu, dbRec.soTo || '', dbRec.soThua || '');

                        if (!dbRecordsByCode.has(code)) {
                            dbRecordsByCode.set(code, []);
                        }
                        dbRecordsByCode.get(code)!.push(dbRec);

                        if (!dbRecordsByKey3.has(key3)) {
                            dbRecordsByKey3.set(key3, []);
                        }
                        dbRecordsByKey3.get(key3)!.push(dbRec);
                    });

                    const fileRecordsByCode = new Map<string, IGateRecord[]>();
                    const fileRecordsByKey3 = new Map<string, IGateRecord[]>();
                    newRecords.forEach(r => {
                        const code = (r.soHieu || '').trim().toUpperCase();
                        const to = (r.soTo || '').trim().toUpperCase();
                        const thua = (r.soThua || '').trim().toUpperCase();
                        const key3 = getImportUniqueKey(r.soHieu, r.soTo || '', r.soThua || '');

                        if (!fileRecordsByCode.has(code)) {
                            fileRecordsByCode.set(code, []);
                        }
                        fileRecordsByCode.get(code)!.push(r);

                        if (!fileRecordsByKey3.has(key3)) {
                            fileRecordsByKey3.set(key3, []);
                        }
                        fileRecordsByKey3.get(key3)!.push(r);
                    });

                    const dup3InFileKeysSet = new Set<string>();
                    const dup3WithDbKeysSet = new Set<string>();
                    const dupCodeDiffInFileKeysSet = new Set<string>();
                    const dupCodeDiffWithDbKeysSet = new Set<string>();

                    const skippedRecords: IGateRecord[] = [];
                    const skippedReasons: string[] = [];
                    const validRecords: IGateRecord[] = [];

                    newRecords.forEach(r => {
                        const code = (r.soHieu || '').trim().toUpperCase();
                        const to = (r.soTo || '').trim().toUpperCase();
                        const thua = (r.soThua || '').trim().toUpperCase();
                        const key = getImportUniqueKey(r.soHieu, r.soTo || '', r.soThua || '');

                        let isDup3InFile = false;
                        let isDup3WithDb = false;
                        let isDupCodeDiffInFile = false;
                        let isDupCodeDiffWithDb = false;

                        // 1. Trùng tuyệt đối 3 cột nội bộ tệp (xem có từ 2 dòng trở lên cùng key trong tệp không)
                        if (fileRecordsByKey3.has(key) && fileRecordsByKey3.get(key)!.length > 1) {
                            isDup3InFile = true;
                        }

                        // 2. Trùng tuyệt đối 3 cột với DB
                        if (dbRecordsByKey3.has(key)) {
                            isDup3WithDb = true;
                        }

                        // 3. Trùng mã khác Tờ/Thửa nội bộ tệp
                        if (fileRecordsByCode.has(code)) {
                            const fileMatches = fileRecordsByCode.get(code)!;
                            const hasDiffLand = fileMatches.some(f => 
                                (f.soTo || '').trim().toUpperCase() !== to || 
                                (f.soThua || '').trim().toUpperCase() !== thua
                            );
                            if (hasDiffLand) {
                                isDupCodeDiffInFile = true;
                            }
                        }

                        // 4. Trùng mã khác Tờ/Thửa so với hệ thống
                        if (dbRecordsByCode.has(code)) {
                            const dbMatches = dbRecordsByCode.get(code)!;
                            const hasDiffLand = dbMatches.some(db => 
                                (db.soTo || '').trim().toUpperCase() !== to || 
                                (db.soThua || '').trim().toUpperCase() !== thua
                            );
                            if (hasDiffLand) {
                                isDupCodeDiffWithDb = true;
                            }
                        }

                        // Classify
                        if (isDup3InFile) {
                            dup3InFileKeysSet.add(key);
                        }
                        if (isDup3WithDb) {
                            dup3WithDbKeysSet.add(key);
                        }
                        if (isDupCodeDiffInFile) {
                            dupCodeDiffInFileKeysSet.add(key);
                        }
                        if (isDupCodeDiffWithDb) {
                            dupCodeDiffWithDbKeysSet.add(key);
                        }

                        // Kiểm tra xem có thuộc diện trùng lặp/cảnh báo hay không
                        if (isDup3InFile || isDup3WithDb || isDupCodeDiffInFile || isDupCodeDiffWithDb) {
                            skippedRecords.push(r);
                            
                            // Xác định lý do trùng chi tiết nhất để báo cáo người dùng
                            let reason = '';
                            if (isDup3InFile && isDup3WithDb) {
                                reason = 'Trùng tuyệt đối 3 cột cả nội bộ tệp và trên hệ thống';
                            } else if (isDup3InFile) {
                                reason = 'Trùng tuyệt đối 3 cột với dòng khác trong tệp (trùng nội bộ)';
                            } else if (isDup3WithDb) {
                                reason = 'Trùng tuyệt đối 3 cột với hồ sơ đã lưu trên hệ thống';
                            } else if (isDupCodeDiffInFile && isDupCodeDiffWithDb) {
                                reason = 'Trùng mã hồ sơ với tệp & hệ thống nhưng khác Tờ/Thửa';
                            } else if (isDupCodeDiffInFile) {
                                reason = 'Trùng mã hồ sơ với dòng khác trong tệp nhưng khác Tờ/Thửa';
                            } else if (isDupCodeDiffWithDb) {
                                reason = 'Trùng mã hồ sơ với hệ thống nhưng khác Tờ/Thửa (Cảnh báo)';
                            } else {
                                reason = 'Bị trùng lặp hoặc cảnh báo dữ liệu';
                            }
                            skippedReasons.push(reason);
                        } else {
                            validRecords.push(r);
                        }
                    });

                    const totalCount = newRecords.length;
                    const validCount = validRecords.length;

                    setTempImportedRecords(newRecords);
                    setImportReport({
                        totalCount,
                        validCount,
                        duplicateInFileCount: dup3InFileKeysSet.size,
                        duplicateWithDbCount: dup3WithDbKeysSet.size,
                        duplicateInFileCodes: Array.from(dup3InFileKeysSet),
                        duplicateWithDbCodes: Array.from(dup3WithDbKeysSet),
                        
                        dupCodeDiffCount: dupCodeDiffInFileKeysSet.size + dupCodeDiffWithDbKeysSet.size,
                        dupCodeDiffInFileCount: dupCodeDiffInFileKeysSet.size,
                        dupCodeDiffWithDbCount: dupCodeDiffWithDbKeysSet.size,
                        dupCodeDiffInFileCodes: Array.from(dupCodeDiffInFileKeysSet),
                        dupCodeDiffWithDbCodes: Array.from(dupCodeDiffWithDbKeysSet),
                        
                        skippedRecords,
                        skippedReasons
                    });
                    setShowImportConfirmModal(true);
                } else {
                    alert('Không tìm thấy dòng hợp lệ để nhập vào!');
                }

            } catch (err) {
                console.error(err);
                alert('Đã xảy ra lỗi khi đọc file Excel. Vui lòng kiểm tra cấu trúc cột.');
            }
        };
        reader.readAsBinaryString(file);
        e.target.value = ''; // Reset input
    };

    const handleExportSkippedDuplicatesExcel = (skippedList: IGateRecord[], reasonsList: string[]) => {
        if (skippedList.length === 0) return;

        const headerRow = [
            'STT',
            'Dòng trong file Excel',
            'Mã hồ sơ (Số hiệu)',
            'Chủ sử dụng',
            'Số tờ',
            'Số thửa',
            'Lý do trùng / Cảnh báo',
            'Loại biến động',
            'Ngày tiếp nhận',
            'Cơ quan/đơn vị',
            'Trạng thái hiện tại'
        ];

        const bodyRows = skippedList.map((r, idx) => {
            return [
                idx + 1,
                r.excelRowIndex ? `Dòng ${r.excelRowIndex}` : '-',
                r.soHieu,
                r.chuHoSo || 'Chưa xác định',
                r.soTo || '-',
                r.soThua || '-',
                reasonsList[idx] || 'Trùng lặp dữ liệu',
                r.tenThuTuc || '-',
                r.ngayTiepNhan || '-',
                r.donVi || '-',
                r.trangThai || '-'
            ];
        });

        const worksheet = XLSX.utils.aoa_to_sheet([
            ['DANH SÁCH HỒ SƠ BỊ TRÙNG LẶP / BỎ QUA KHI NHẬP EXCEL'],
            [`Ngày xuất báo cáo: ${new Date().toLocaleDateString('vi-VN')} - Vui lòng kiểm tra lại trước khi nhập`],
            [''],
            headerRow,
            ...bodyRows
        ]);

        worksheet['!merges'] = [
            { s: { r: 0, c: 0 }, e: { r: 0, c: 10 } },
            { s: { r: 1, c: 0 }, e: { r: 1, c: 10 } }
        ];

        worksheet['!cols'] = [
            { wch: 6 },   // STT
            { wch: 20 },  // Dòng trong file Excel
            { wch: 18 },  // Mã hồ sơ
            { wch: 22 },  // Chủ sử dụng
            { wch: 10 },  // Số tờ
            { wch: 10 },  // Số thửa
            { wch: 45 },  // Lý do trùng
            { wch: 30 },  // Loại biến động
            { wch: 15 },  // Ngày tiếp nhận
            { wch: 25 },  // Cơ quan
            { wch: 20 }   // Trạng thái
        ];

        // Apply styles
        const cellStyleHeader = {
            font: { name: 'Arial', size: 10, bold: true, color: { rgb: 'FFFFFF' } },
            fill: { fgColor: { rgb: '991B1B' } }, // Dark Red
            alignment: { vertical: 'center', horizontal: 'center', wrapText: true },
            border: {
                top: { style: 'thin', color: { rgb: 'CCCCCC' } },
                bottom: { style: 'medium', color: { rgb: '991B1B' } },
                left: { style: 'thin', color: { rgb: 'CCCCCC' } },
                right: { style: 'thin', color: { rgb: 'CCCCCC' } }
            }
        };

        const cellStyleTitle = {
            font: { name: 'Arial', size: 14, bold: true, color: { rgb: '991B1B' } },
            alignment: { vertical: 'center', horizontal: 'left' }
        };

        const cellStyleSubTitle = {
            font: { name: 'Arial', size: 10, italic: true, color: { rgb: '555555' } },
            alignment: { vertical: 'center', horizontal: 'left' }
        };

        const cellStyleDataNormal = {
            font: { name: 'Arial', size: 10 },
            alignment: { vertical: 'center', horizontal: 'left' },
            border: {
                top: { style: 'thin', color: { rgb: 'E5E7EB' } },
                bottom: { style: 'thin', color: { rgb: 'E5E7EB' } },
                left: { style: 'thin', color: { rgb: 'E5E7EB' } },
                right: { style: 'thin', color: { rgb: 'E5E7EB' } }
            }
        };

        for (const cellAddress in worksheet) {
            if (cellAddress.startsWith('!')) continue;
            const cell = worksheet[cellAddress];
            const parsedCell = XLSX.utils.decode_cell(cellAddress);
            const r = parsedCell.r;

            if (r === 0) {
                cell.s = cellStyleTitle;
            } else if (r === 1) {
                cell.s = cellStyleSubTitle;
            } else if (r === 3) {
                cell.s = cellStyleHeader;
            } else if (r > 3) {
                cell.s = cellStyleDataNormal;
            }
        }

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Hồ sơ trùng bị bỏ qua');
        XLSX.writeFile(workbook, `Danh_Sach_Ho_So_Trung_Bi_Bo_Qua_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    const handleConfirmImportWithSkip = async () => {
        const dupInFileSet = new Set(importReport.duplicateInFileCodes);
        const dupWithDbSet = new Set(importReport.duplicateWithDbCodes);
        const dupCodeDiffInFileSet = new Set(importReport.dupCodeDiffInFileCodes);
        const dupCodeDiffWithDbSet = new Set(importReport.dupCodeDiffWithDbCodes);
        
        const recordsToInsert = tempImportedRecords.filter(r => {
            const key = getImportUniqueKey(r.soHieu, r.soTo || '', r.soThua || '');
            return !dupInFileSet.has(key) && 
                   !dupWithDbSet.has(key) &&
                   !dupCodeDiffInFileSet.has(key) &&
                   !dupCodeDiffWithDbSet.has(key);
        });
        
        if (recordsToInsert.length === 0) {
            alert("Không có hồ sơ hợp lệ nào để nhập!");
            setShowImportConfirmModal(false);
            return;
        }

        await saveRecords([...recordsToInsert, ...records]);

        if (importReport.skippedRecords.length > 0) {
            try {
                handleExportSkippedDuplicatesExcel(importReport.skippedRecords, importReport.skippedReasons);
                alert(`Đã nhập thành công ${recordsToInsert.length} hồ sơ iGate hợp lệ. Hệ thống đã tự động xuất tải file Excel chứa ${importReport.skippedRecords.length} hồ sơ bị trùng lặp để bạn kiểm tra!`);
            } catch (err) {
                console.error(err);
                alert(`Đã nhập thành công ${recordsToInsert.length} hồ sơ iGate hợp lệ, nhưng không xuất được danh sách trùng.`);
            }
        } else {
            alert(`Đã nhập thành công ${recordsToInsert.length} hồ sơ iGate hợp lệ!`);
        }

        setShowImportConfirmModal(false);
        setTempImportedRecords([]);
    };

    const handleConfirmImportWithOverwrite = async () => {
        const uniqueFileRecordsMap = new Map<string, IGateRecord>();
        tempImportedRecords.forEach(r => {
            const key = getImportUniqueKey(r.soHieu, r.soTo || '', r.soThua || '');
            uniqueFileRecordsMap.set(key, r);
        });
        const fileRecordsToImport = Array.from(uniqueFileRecordsMap.values());

        const fileKeysSet = new Set(fileRecordsToImport.map(r => getImportUniqueKey(r.soHieu, r.soTo || '', r.soThua || '')));
        const keptDbRecords = records.filter(r => {
            const dbKey = getImportUniqueKey(r.soHieu, r.soTo || '', r.soThua || '');
            return !fileKeysSet.has(dbKey);
        });

        await saveRecords([...fileRecordsToImport, ...keptDbRecords]);
        alert(`Đã ghi đè/cập nhật và nhập thành công tổng cộng ${fileRecordsToImport.length} hồ sơ iGate vào Supabase!`);
        setShowImportConfirmModal(false);
        setTempImportedRecords([]);
    };

    // --- CHỨC NĂNG LẬP BÁO CÁO EXCEL CHUYÊN NGHIỆP ---
    const handleExportReportExcel = () => {
        // Lọc dữ liệu theo các tiêu chí của Popup
        const fromDateStr = exportFromDate;
        const toDateStr = exportToDate;
        const wardStr = exportWard;

        const filtered = records.filter(r => {
            // Lọc theo ngày tiếp nhận
            const ngayTiepNhan = r.ngayTiepNhan ? r.ngayTiepNhan.split(' ')[0] : '';
            const matchFrom = fromDateStr ? ngayTiepNhan >= fromDateStr : true;
            const matchTo = toDateStr ? ngayTiepNhan <= toDateStr : true;

            // Lọc theo xã phường
            let matchWard = true;
            if (wardStr !== 'Tất cả') {
                matchWard = r.diaDanh ? r.diaDanh.toLowerCase().includes(wardStr.toLowerCase()) : false;
            }

            return matchFrom && matchTo && matchWard;
        });

        if (filtered.length === 0) {
            alert('Không có dữ liệu phù hợp với khoảng thời gian và xã phường đã chọn!');
            return;
        }

        const headerRow = [
            'STT',
            'Mã hồ sơ',
            'Loại biến động',
            'CHUYỂN QUYỀN',
            'Số tờ',
            'Số thửa',
            'Tổng diện tích (m²)',
            'Đất ở (m²)',
            'Đất nông nghiệp (m²)',
            'Địa danh thửa đất',
            'Số phát hành',
            'Số vào sổ GCN',
            'Ngày ký GCN',
            'Ngày giao 1 cửa',
            'Đợt giao 1 cửa',
            'Thời hạn sử dụng',
            'CCCD',
            'Tên lĩnh vực',
            'Ngày tiếp nhận',
            'Ngày trả kết quả',
            'Ngày hoàn thành thực tế',
            'Cơ quan/đơn vị',
            'Chủ sử dụng',
            'Số điện thoại',
            'Cán bộ xử lý',
            'Trạng thái hồ sơ',
            'GHI CHÚ'
        ];

        const bodyRows = filtered.map((r, idx) => {
            const tot = Number(r.tongDienTich || 0);
            const o = Number(r.dienTichDatO || 0);
            const nong = tot > 0 ? (tot - o) : 0;
            
            let thoiHanShow = '';
            if (o > 0) {
                thoiHanShow = `Đất ở: Lâu dài. Đất NN: ${formatThoiHanSuDung(r.thoiHanSuDung)}`;
            } else {
                thoiHanShow = r.thoiHanSuDung ? `Đất NN: ${formatThoiHanSuDung(r.thoiHanSuDung)}` : '-';
            }

            return [
                idx + 1,
                r.soHieu,
                r.tenThuTuc,
                r.chuyenQuyen || '-',
                r.soTo || '-',
                r.soThua || '-',
                r.tongDienTich !== null && r.tongDienTich !== undefined ? r.tongDienTich : '-',
                r.dienTichDatO !== null && r.dienTichDatO !== undefined ? r.dienTichDatO : '-',
                tot > 0 ? nong : '-',
                r.diaDanh || '-',
                r.soPhatHanh || '-',
                r.soVaoSo || '-',
                (r.trangThai === 'Đã ký Giấy chứng nhận' || r.soVaoSo) ? (r.ngayKetThuc || '-') : '-',
                r.ngayGiao1Cua ? formatDisplayDateInClient(r.ngayGiao1Cua) : '-',
                r.dotGiao1Cua || '-',
                thoiHanShow,
                r.cccd || '-',
                r.tenLinhVuc || '-',
                r.ngayTiepNhan,
                r.ngayHenTra,
                r.ngayKetThuc || 'Đang thụ lý',
                r.donVi,
                r.chuHoSo,
                r.soDienThoai || '-',
                r.canBoXuLy || '-',
                r.trangThai,
                r.ghiChu || '-'
            ];
        });

        const worksheet = XLSX.utils.aoa_to_sheet([
            ['BÁO CÁO THỐNG KÊ QUẢN LÝ HỒ SƠ IGATE CHI TIẾT'],
            [`Khoảng thời gian: Từ ${exportFromDate ? formatDisplayDateInClient(exportFromDate) : 'đầu'} đến ${exportToDate ? formatDisplayDateInClient(exportToDate) : 'hiện tại'} - Xã/phường: ${exportWard}`],
            [`Ngày lập báo cáo: ${new Date().toLocaleDateString('vi-VN')} - Người lập: ${currentUser.name}`],
            [''],
            headerRow,
            ...bodyRows
        ]);

        // Merge cells tiêu đề
        worksheet['!merges'] = [
            { s: { r: 0, c: 0 }, e: { r: 0, c: 26 } },
            { s: { r: 1, c: 0 }, e: { r: 1, c: 26 } },
            { s: { r: 2, c: 0 }, e: { r: 2, c: 26 } }
        ];

        // Format Width cho các cột
        worksheet['!cols'] = [
            { wch: 6 },   // STT
            { wch: 18 },  // Mã hồ sơ
            { wch: 35 },  // Loại biến động
            { wch: 20 },  // CHUYỂN QUYỀN
            { wch: 10 },  // Số tờ
            { wch: 10 },  // Số thửa
            { wch: 18 },  // Tổng diện tích
            { wch: 14 },  // Đất ở
            { wch: 18 },  // Đất nông nghiệp
            { wch: 24 },  // Địa danh thửa đất
            { wch: 18 },  // Số phát hành
            { wch: 18 },  // Số vào sổ GCN
            { wch: 18 },  // Ngày ký GCN
            { wch: 18 },  // Ngày giao 1 cửa
            { wch: 18 },  // Đợt giao 1 cửa
            { wch: 26 },  // Thời hạn sử dụng
            { wch: 16 },  // CCCD
            { wch: 18 },  // Tên lĩnh vực
            { wch: 14 },  // Ngày tiếp nhận
            { wch: 14 },  // Ngày hẹn trả
            { wch: 18 },  // Ngày kết thúc
            { wch: 25 },  // Cơ quan/đơn vị
            { wch: 22 },  // Chủ sử dụng
            { wch: 14 },  // Số điện thoại
            { wch: 20 },  // Cán bộ xử lý
            { wch: 22 },  // Trạng thái hồ sơ
            { wch: 25 }   // GHI CHÚ
        ];

        // Áp dụng Style nâng cao cho workbook
        const cellStyleHeader = {
            font: { name: 'Arial', size: 10, bold: true, color: { rgb: 'FFFFFF' } },
            fill: { fgColor: { rgb: '1E3A8A' } }, // Blue-900
            alignment: { vertical: 'center', horizontal: 'center', wrapText: true },
            border: {
                top: { style: 'thin', color: { rgb: 'CCCCCC' } },
                bottom: { style: 'medium', color: { rgb: '1E3A8A' } },
                left: { style: 'thin', color: { rgb: 'CCCCCC' } },
                right: { style: 'thin', color: { rgb: 'CCCCCC' } }
            }
        };

        const cellStyleTitle = {
            font: { name: 'Arial', size: 16, bold: true, color: { rgb: '1E3A8A' } },
            alignment: { vertical: 'center', horizontal: 'left' }
        };

        const cellStyleSubTitle = {
            font: { name: 'Arial', size: 10, italic: true, color: { rgb: '555555' } },
            alignment: { vertical: 'center', horizontal: 'left' }
        };

        const cellStyleDataNormal = {
            font: { name: 'Arial', size: 10 },
            alignment: { vertical: 'center', horizontal: 'left' },
            border: {
                top: { style: 'thin', color: { rgb: 'E5E7EB' } },
                bottom: { style: 'thin', color: { rgb: 'E5E7EB' } },
                left: { style: 'thin', color: { rgb: 'E5E7EB' } },
                right: { style: 'thin', color: { rgb: 'E5E7EB' } }
            }
        };

        const cellStyleDataCenter = {
            font: { name: 'Arial', size: 10 },
            alignment: { vertical: 'center', horizontal: 'center' },
            border: {
                top: { style: 'thin', color: { rgb: 'E5E7EB' } },
                bottom: { style: 'thin', color: { rgb: 'E5E7EB' } },
                left: { style: 'thin', color: { rgb: 'E5E7EB' } },
                right: { style: 'thin', color: { rgb: 'E5E7EB' } }
            }
        };

        const cellStyleDataStatus = {
            font: { name: 'Arial', size: 10, bold: true, color: { rgb: '0F172A' } },
            fill: { fgColor: { rgb: 'F1F5F9' } },
            alignment: { vertical: 'center', horizontal: 'center' },
            border: {
                top: { style: 'thin', color: { rgb: 'E5E7EB' } },
                bottom: { style: 'thin', color: { rgb: 'E5E7EB' } },
                left: { style: 'thin', color: { rgb: 'E5E7EB' } },
                right: { style: 'thin', color: { rgb: 'E5E7EB' } }
            }
        };

        // Gán Style
        for (const cellAddress in worksheet) {
            if (cellAddress.startsWith('!')) continue;
            const cell = worksheet[cellAddress];
            const parsedCell = XLSX.utils.decode_cell(cellAddress);
            const rIdx = parsedCell.r;
            const cIdx = parsedCell.c;

            if (rIdx === 0) {
                cell.s = cellStyleTitle;
            } else if (rIdx === 1 || rIdx === 2) {
                cell.s = cellStyleSubTitle;
            } else if (rIdx === 4) {
                cell.s = cellStyleHeader;
            } else if (rIdx > 4) {
                if ([0, 1, 4, 5, 6, 7, 8, 10, 11, 12, 13, 14, 16, 18, 19, 20].includes(cIdx)) {
                    cell.s = cellStyleDataCenter;
                } else if (cIdx === 25) {
                    cell.s = cellStyleDataStatus;
                    // Đổi màu nền trạng thái dựa trên giá trị
                    const val = String(cell.v || '');
                    if (val === 'Mới tiếp nhận') cell.s.fill = { fgColor: { rgb: 'E0F2FE' } }; // Blue-100
                    else if (val.includes('thuế')) cell.s.fill = { fgColor: { rgb: 'FFEDD5' } }; // Orange-100
                    else if (val.includes('Giấy chứng nhận')) cell.s.fill = { fgColor: { rgb: 'CCFBF1' } }; // Teal-100
                    else if (val === 'Đã trả kết quả') cell.s.fill = { fgColor: { rgb: 'DCFCE7' } }; // Green-100
                } else {
                    cell.s = cellStyleDataNormal;
                }
            }
        }

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'IGate Report');
        XLSX.writeFile(workbook, `Bao_Cao_IGate_${new Date().toISOString().split('T')[0]}.xlsx`);
        setShowExportReportModal(false);
    };

    return (
        <div className="space-y-6">
            {/* Giao diện chính của iGate */}
            <>
                    {/* --- DASHBOARD METRICS CONTROLS --- */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7 gap-4">
                {/* 1. Tổng số hồ sơ */}
                <div 
                    onClick={() => { setSelectedTrangThaiFilter('Tất cả'); setSelectedLinhVucFilter('Tất cả'); setSelectedLoaiHoSoFilter('Tất cả'); setSelectedIds(new Set()); setCurrentPage(1); setShowOnlyTon90Days(false); }}
                    className={`cursor-pointer bg-gradient-to-br from-indigo-50 to-white hover:from-indigo-100 rounded-2xl border p-5 shadow-sm transition-all duration-300 transform hover:-translate-y-1 relative overflow-hidden group ${
                        selectedTrangThaiFilter === 'Tất cả' && !showOnlyTon90Days ? 'ring-4 ring-indigo-500/30 border-indigo-300' : 'border-indigo-100'
                    }`}
                >
                    <div className="absolute right-0 bottom-0 text-indigo-500/10 translate-x-2 translate-y-2 group-hover:scale-110 transition-transform">
                        <Building size={110} />
                    </div>
                    <div className="flex items-center justify-between mb-4">
                        <span className="p-2.5 bg-indigo-500 text-white rounded-xl shadow-md shadow-indigo-500/20"><Building size={20} /></span>
                        <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full flex items-center gap-0.5">IGate <ArrowUpRight size={12}/></span>
                    </div>
                    <h3 className="text-xs font-bold text-indigo-900/60 uppercase tracking-widest">Tổng số hồ sơ</h3>
                    <p className="text-3xl font-bold text-indigo-950 mt-1">{stats.total}</p>
                </div>

                {/* 2. Mới tiếp nhận */}
                <div 
                    onClick={() => { setSelectedTrangThaiFilter('Mới tiếp nhận'); setSelectedLinhVucFilter('Tất cả'); setSelectedLoaiHoSoFilter('Tất cả'); setSelectedIds(new Set()); setCurrentPage(1); setShowOnlyTon90Days(false); }}
                    className={`cursor-pointer bg-gradient-to-br from-sky-50 to-white hover:from-sky-100 rounded-2xl border p-5 shadow-sm transition-all duration-300 transform hover:-translate-y-1 relative overflow-hidden group ${
                        selectedTrangThaiFilter === 'Mới tiếp nhận' && !showOnlyTon90Days ? 'ring-4 ring-sky-500/30 border-sky-300' : 'border-sky-100'
                    }`}
                >
                    <div className="absolute right-0 bottom-0 text-sky-500/10 translate-x-2 translate-y-2 group-hover:scale-110 transition-transform">
                        <ClipboardList size={110} />
                    </div>
                    <div className="flex items-center justify-between mb-4">
                        <span className="p-2.5 bg-sky-500 text-white rounded-xl shadow-md shadow-sky-500/20"><ClipboardList size={20} /></span>
                        <span className="text-xs font-semibold text-sky-600 bg-sky-50 px-2.5 py-1 rounded-full">Hồ sơ mới</span>
                    </div>
                    <h3 className="text-xs font-bold text-sky-900/60 uppercase tracking-widest">Mới tiếp nhận</h3>
                    <p className="text-3xl font-bold text-sky-950 mt-1">{stats.newReceipt}</p>
                </div>

                {/* 3. Chờ thuế */}
                <div 
                    onClick={() => { setSelectedTrangThaiFilter('Hồ sơ chờ thuế'); setSelectedLinhVucFilter('Tất cả'); setSelectedLoaiHoSoFilter('Tất cả'); setSelectedIds(new Set()); setCurrentPage(1); setShowOnlyTon90Days(false); }}
                    className={`cursor-pointer bg-gradient-to-br from-orange-50 to-white hover:from-orange-100 rounded-2xl border p-5 shadow-sm transition-all duration-300 transform hover:-translate-y-1 relative overflow-hidden group ${
                        (selectedTrangThaiFilter === 'Hồ sơ chờ thuế' || selectedTrangThaiFilter === 'Đã chuyển thông tin thuế' || selectedTrangThaiFilter === 'Đã phát hành thông báo thuế' || selectedTrangThaiFilter === 'Đã thực hiện nghĩa vụ tài chính' || selectedTrangThaiFilter === 'Chờ thực hiện nghĩa vụ tài chính') && !showOnlyTon90Days ? 'ring-4 ring-orange-500/30 border-orange-300 bg-orange-50/40' : 'border-orange-100'
                    }`}
                >
                    <div className="absolute right-0 bottom-0 text-orange-500/10 translate-x-2 translate-y-2 group-hover:scale-110 transition-transform">
                        <FileText size={110} />
                    </div>
                    <div className="flex items-center justify-between mb-3">
                        <span className="p-2.5 bg-orange-500 text-white rounded-xl shadow-md shadow-orange-500/20"><FileText size={20} /></span>
                        <div className="text-right">
                            <span className="text-[10px] block font-semibold text-orange-850 px-2 bg-orange-100/60 rounded-full mb-0.5">Xử lý Thuế</span>
                            <span className="text-[11px] text-orange-600 font-bold block">{stats.choThue.total} hồ sơ</span>
                        </div>
                    </div>
                    <h3 className="text-xs font-bold text-orange-900/60 uppercase tracking-widest mb-1.5">Hồ sơ chờ thuế</h3>
                    <div className="space-y-0.5 text-xs text-orange-900/80 font-medium z-10 relative">
                        <div 
                            className={`flex justify-between p-0.5 px-1.5 rounded-lg transition-colors hover:bg-orange-100/40 cursor-pointer ${selectedTrangThaiFilter === 'Đã chuyển thông tin thuế' ? 'bg-orange-100/60 font-bold text-orange-950' : ''}`}
                            onClick={(e) => {
                                e.stopPropagation();
                                setSelectedTrangThaiFilter('Đã chuyển thông tin thuế');
                                setSelectedLinhVucFilter('Tất cả');
                                setSelectedLoaiHoSoFilter('Tất cả');
                                setSelectedIds(new Set());
                                setCurrentPage(1);
                                setShowOnlyTon90Days(false);
                            }}
                        >
                            <span>• Đã chuyển thông tin:</span> 
                            <span className="font-bold">{stats.choThue.daChuyenThongTinThue}</span>
                        </div>
                        <div 
                            className={`flex justify-between p-0.5 px-1.5 rounded-lg transition-colors hover:bg-orange-100/40 cursor-pointer ${selectedTrangThaiFilter === 'Đã phát hành thông báo thuế' ? 'bg-orange-100/60 font-bold text-orange-950' : ''}`}
                            onClick={(e) => {
                                e.stopPropagation();
                                setSelectedTrangThaiFilter('Đã phát hành thông báo thuế');
                                setSelectedLinhVucFilter('Tất cả');
                                setSelectedLoaiHoSoFilter('Tất cả');
                                setSelectedIds(new Set());
                                setCurrentPage(1);
                                setShowOnlyTon90Days(false);
                            }}
                        >
                            <span>• Đã phát hành TB thuế:</span> 
                            <span className="font-bold">{stats.choThue.daPhatHanhThongBaoThue}</span>
                        </div>
                        <div 
                            className={`flex justify-between p-0.5 px-1.5 rounded-lg transition-colors hover:bg-orange-100/40 cursor-pointer ${selectedTrangThaiFilter === 'Đã thực hiện nghĩa vụ tài chính' ? 'bg-orange-100/60 font-bold text-orange-950' : ''}`}
                            onClick={(e) => {
                                e.stopPropagation();
                                setSelectedTrangThaiFilter('Đã thực hiện nghĩa vụ tài chính');
                                setSelectedLinhVucFilter('Tất cả');
                                setSelectedLoaiHoSoFilter('Tất cả');
                                setSelectedIds(new Set());
                                setCurrentPage(1);
                                setShowOnlyTon90Days(false);
                            }}
                        >
                            <span>• Đã thực hiện NVTC:</span> 
                            <span className="font-bold">{stats.choThue.daThucHienNghiaVuTaiChinh}</span>
                        </div>
                        <div 
                            className={`flex justify-between p-0.5 px-1.5 rounded-lg transition-colors hover:bg-orange-100/40 cursor-pointer ${selectedTrangThaiFilter === 'Hồ sơ chờ thực hiện nghĩa vụ tài chính' ? 'bg-orange-100/60 font-bold text-orange-950' : ''}`}
                            onClick={(e) => {
                                e.stopPropagation();
                                setSelectedTrangThaiFilter('Hồ sơ chờ thực hiện nghĩa vụ tài chính');
                                setSelectedLinhVucFilter('Tất cả');
                                setSelectedLoaiHoSoFilter('Tất cả');
                                setSelectedIds(new Set());
                                setCurrentPage(1);
                                setShowOnlyTon90Days(false);
                            }}
                        >
                            <span>• Chờ thực hiện NVTC:</span> 
                            <span className="font-bold">{stats.choThue.choThucHienNghiaVuTaiChinh}</span>
                        </div>
                    </div>
                </div>

                {/* 4. Chờ trả kết quả */}
                <div 
                    onClick={() => { setSelectedTrangThaiFilter('Chờ trả kết quả'); setSelectedLinhVucFilter('Tất cả'); setSelectedLoaiHoSoFilter('Tất cả'); setSelectedIds(new Set()); setCurrentPage(1); setShowOnlyTon90Days(false); }}
                    className={`cursor-pointer bg-gradient-to-br from-teal-50 to-white hover:from-teal-100 rounded-2xl border p-5 shadow-sm transition-all duration-300 transform hover:-translate-y-1 relative overflow-hidden group ${
                        (selectedTrangThaiFilter === 'Chờ trả kết quả' || selectedTrangThaiFilter === 'Đã ký Giấy chứng nhận' || selectedTrangThaiFilter === 'Chưa trả kết quả') && !showOnlyTon90Days ? 'ring-4 ring-teal-500/30 border-teal-300 bg-teal-50/40' : 'border-teal-100'
                    }`}
                >
                    <div className="absolute right-0 bottom-0 text-teal-500/10 translate-x-3 translate-y-3 group-hover:scale-110 transition-transform">
                        <CheckCircle2 size={110} />
                    </div>
                    <div className="flex items-center justify-between mb-3">
                        <span className="p-2.5 bg-teal-600 text-white rounded-xl shadow-md shadow-teal-600/20"><CheckCircle2 size={20} /></span>
                        <div className="text-right">
                            <span className="text-[10px] block font-semibold text-teal-850 px-2 bg-teal-100/60 rounded-full mb-0.5 font-sans">Chờ Trả KQ</span>
                            <span className="text-[11px] text-teal-700 font-bold block">{stats.choTraKQ.total} hồ sơ</span>
                        </div>
                    </div>
                    <h3 className="text-xs font-bold text-teal-900/60 uppercase tracking-widest mb-1.5">Chờ trả kết quả</h3>
                    <div className="space-y-0.5 text-xs text-teal-900/80 font-medium z-10 relative">
                        <div 
                            className={`flex justify-between p-0.5 px-1.5 rounded-lg transition-colors hover:bg-teal-100/40 cursor-pointer ${selectedTrangThaiFilter === 'Đã ký Giấy chứng nhận' ? 'bg-teal-100/60 font-bold text-teal-950' : ''}`}
                            onClick={(e) => {
                                e.stopPropagation();
                                setSelectedTrangThaiFilter('Đã ký Giấy chứng nhận');
                                setSelectedLinhVucFilter('Tất cả');
                                setSelectedLoaiHoSoFilter('Tất cả');
                                setSelectedIds(new Set());
                                setCurrentPage(1);
                                setShowOnlyTon90Days(false);
                            }}
                        >
                            <span>• Đã ký GCN:</span> 
                            <span className="font-bold">{stats.choTraKQ.daKyGCN}</span>
                        </div>
                        <div 
                            className={`flex justify-between p-0.5 px-1.5 rounded-lg transition-colors hover:bg-teal-100/40 cursor-pointer ${selectedTrangThaiFilter === 'Hồ sơ chưa trả kết quả' ? 'bg-teal-100/60 font-bold text-teal-950' : ''}`}
                            onClick={(e) => {
                                e.stopPropagation();
                                setSelectedTrangThaiFilter('Hồ sơ chưa trả kết quả');
                                setSelectedLinhVucFilter('Tất cả');
                                setSelectedLoaiHoSoFilter('Tất cả');
                                setSelectedIds(new Set());
                                setCurrentPage(1);
                                setShowOnlyTon90Days(false);
                            }}
                        >
                            <span>• Chưa nhận kết quả:</span> 
                            <span className="font-bold">{stats.choTraKQ.chuaTraKQ}</span>
                        </div>
                    </div>
                </div>

                {/* 5. Đã trả kết quả */}
                <div 
                    onClick={() => { setSelectedTrangThaiFilter('Đã trả kết quả'); setSelectedLinhVucFilter('Tất cả'); setSelectedLoaiHoSoFilter('Tất cả'); setSelectedIds(new Set()); setCurrentPage(1); setShowOnlyTon90Days(false); }}
                    className={`cursor-pointer bg-gradient-to-br from-emerald-50 to-white hover:from-emerald-100 rounded-2xl border p-5 shadow-sm transition-all duration-300 transform hover:-translate-y-1 relative overflow-hidden group ${
                        selectedTrangThaiFilter === 'Đã trả kết quả' && !showOnlyTon90Days ? 'ring-4 ring-emerald-500/30 border-emerald-300' : 'border-emerald-100'
                    }`}
                >
                    <div className="absolute right-0 bottom-0 text-emerald-500/10 translate-x-2 translate-y-2 group-hover:scale-110 transition-transform">
                        <CheckCircle2 size={110} />
                    </div>
                    <div className="flex items-center justify-between mb-4">
                        <span className="p-2.5 bg-emerald-500 text-white rounded-xl shadow-md shadow-emerald-500/20"><CheckCircle2 size={20} /></span>
                        <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">Hoàn tất</span>
                    </div>
                    <h3 className="text-xs font-bold text-emerald-900/60 uppercase tracking-widest">Đã trả kết quả</h3>
                    <p className="text-3xl font-bold text-emerald-950 mt-1">{stats.daTraKQ}</p>
                </div>

                {/* 6. Hồ sơ bị trả */}
                <div 
                    onClick={() => { setSelectedTrangThaiFilter('Hồ sơ trả'); setSelectedLinhVucFilter('Tất cả'); setSelectedLoaiHoSoFilter('Tất cả'); setSelectedIds(new Set()); setCurrentPage(1); setShowOnlyTon90Days(false); }}
                    className={`cursor-pointer bg-gradient-to-br from-rose-50 to-white hover:from-rose-100 rounded-2xl border p-5 shadow-sm transition-all duration-300 transform hover:-translate-y-1 relative overflow-hidden group ${
                        selectedTrangThaiFilter === 'Hồ sơ trả' && !showOnlyTon90Days ? 'ring-4 ring-rose-500/30 border-rose-300' : 'border-rose-100'
                    }`}
                >
                    <div className="absolute right-0 bottom-0 text-rose-500/10 translate-x-2 translate-y-2 group-hover:scale-110 transition-transform">
                        <AlertCircle size={110} />
                    </div>
                    <div className="flex items-center justify-between mb-4">
                        <span className="p-2.5 bg-rose-500 text-white rounded-xl shadow-md shadow-rose-500/20"><AlertCircle size={20} /></span>
                        <span className="text-xs font-semibold text-rose-600 bg-rose-50 px-2.5 py-1 rounded-full">Bị trả lại</span>
                    </div>
                    <h3 className="text-xs font-bold text-rose-900/60 uppercase tracking-widest">Hồ sơ bị trả</h3>
                    <p className="text-3xl font-bold text-rose-950 mt-1">{stats.hoSoTra}</p>
                </div>

                {/* 7. Tồn trên 90 ngày */}
                <div 
                    onClick={() => {
                        setShowOnlyTon90Days(!showOnlyTon90Days);
                        setSelectedLoaiHoSoFilter('Tất cả');
                        setSelectedIds(new Set());
                        setCurrentPage(1);
                    }}
                    className={`rounded-2xl border p-5 shadow-sm transition-all duration-300 transform hover:-translate-y-1 relative overflow-hidden group cursor-pointer ${
                        showOnlyTon90Days 
                            ? 'ring-4 ring-red-500/30 border-red-300 bg-red-100/50' 
                            : stats.ton90Ngay > 0 
                                ? 'bg-gradient-to-br from-red-50 to-white border-red-100 hover:from-red-100/80 shadow-red-100/50' 
                                : 'bg-gradient-to-br from-slate-50 to-white border-slate-200 hover:bg-slate-100/50'
                    }`}
                >
                    <div className={`absolute right-0 bottom-0 translate-x-2 translate-y-2 group-hover:scale-110 transition-transform ${showOnlyTon90Days || stats.ton90Ngay > 0 ? 'text-red-500/10' : 'text-slate-500/5'}`}>
                        <AlertTriangle size={110} />
                    </div>
                    <div className="flex items-center justify-between mb-4">
                        <span className={`p-2.5 rounded-xl shadow-md ${showOnlyTon90Days || stats.ton90Ngay > 0 ? 'bg-red-500 text-white shadow-red-500/20' : 'bg-slate-500 text-white'}`}>
                            <AlertTriangle size={20} />
                        </span>
                        {stats.ton90Ngay > 0 && (
                            <span className="animate-pulse text-[10px] font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded-full">
                                CẢNH BÁO TỒN ĐỌNG
                            </span>
                        )}
                    </div>
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Tồn trên 90 ngày</h3>
                    <p className={`text-3xl font-bold mt-1 ${showOnlyTon90Days || stats.ton90Ngay > 0 ? 'text-red-600' : 'text-slate-700'}`}>{stats.ton90Ngay}</p>
                </div>
            </div>

            {/* --- LINE CHART & EXCEL MANUAL PANEL --- */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Vẽ Biểu đồ tăng giảm hồ sơ tồn */}
                <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm lg:col-span-2 flex flex-col">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h3 className="font-bold text-slate-800 flex items-center gap-1.5">
                                <TrendingUp size={18} className="text-indigo-600" />
                                Biểu đồ hồ sơ tồn đọng theo tháng (Năm 2026)
                            </h3>
                            <p className="text-xs text-gray-500 mt-0.5">Biểu diễn số lượng hồ sơ hiện tại đang tồn đọng chi tiết theo tháng tiếp nhận</p>
                        </div>
                        <div className="text-xs text-indigo-600 bg-indigo-50 font-bold px-2.5 py-1 rounded-lg">
                            Tổng các tháng: {chartData.reduce((acc, m) => acc + m.count, 0)} hồ sơ
                        </div>
                    </div>
                    
                    <div className="h-[185px] w-full flex-1">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.2}/>
                                        <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                                <XAxis dataKey="month" tickLine={false} axisLine={false} style={{ fontSize: 11, fill: '#64748B', fontWeight: 600 }} />
                                <YAxis tickLine={false} axisLine={false} style={{ fontSize: 11, fill: '#64748B' }} />
                                <Tooltip 
                                    contentStyle={{ background: '#0F172A', border: 'none', borderRadius: '12px', color: '#fff' }}
                                    labelStyle={{ fontWeight: 'bold', color: '#818CF8', fontSize: 12 }}
                                    formatter={(value: any) => [`${value} hồ sơ`, 'Hồ sơ tồn đọng']}
                                />
                                <Area type="monotone" dataKey="count" stroke="#4f46e5" strokeWidth={3} fillOpacity={1} fill="url(#colorCount)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Các nút Tính năng nhanh & Cấu hình dữ liệu */}
                <div className="bg-gradient-to-br from-slate-900 to-slate-950 text-white rounded-2xl p-6 shadow-xl flex flex-col justify-between relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl -mr-10 -mt-10"></div>
                    
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <span className="p-1 px-2.5 bg-indigo-500/30 text-indigo-300 font-bold text-[10px] uppercase tracking-wider rounded-md border border-indigo-500/20">Công cụ</span>
                                <h3 className="font-bold text-slate-100 flex items-center gap-1.5">
                                    <FileSpreadsheet size={18} className="text-indigo-400" />
                                    Quản lý dữ liệu hệ thống
                                </h3>
                            </div>
                            <button
                                onClick={async () => {
                                    const latestStored = await getSystemSetting('vaoso_current_book_number');
                                    if (latestStored) {
                                        setCurrentBookNumber(latestStored);
                                    }
                                    setShowSettingsModal(true);
                                }}
                                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition-colors cursor-pointer animate-pulse"
                                title="Cài đặt số vào sổ"
                            >
                                <Settings size={14} />
                            </button>
                        </div>
                        <p className="text-xs text-slate-400 leading-relaxed mb-4">
                            Hệ thống tự động hỗ trợ bạn nhập dữ liệu gốc từ phần mềm một cửa iGate tập trung qua tệp Excel để phân loại, theo dõi nghĩa vụ tài chính và lập báo cáo nhanh chóng.
                        </p>
                    </div>

                    <div className="space-y-3">
                        {/* 1. Nút Thêm mới & Vào số GCN */}
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                onClick={handleAddNew}
                                className="flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-500 to-blue-600 hover:from-indigo-600 hover:to-blue-700 text-white font-bold py-2.5 px-3 rounded-xl shadow-lg shadow-indigo-600/30 transition-all font-sans text-xs active:scale-[0.98]"
                                title="Thêm Hồ sơ iGate thủ công"
                            >
                                <Plus size={14} /> Thêm thủ công
                            </button>
                            <button
                                onClick={() => setShowVaoSoModal(true)}
                                className="flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold py-2.5 px-3 rounded-xl shadow-lg shadow-purple-600/30 transition-all font-sans text-xs active:scale-[0.98]"
                                title="Mở Công cụ Vào số GCN bằng file Excel và bàn giao 1 cửa"
                            >
                                <FileSpreadsheet size={14} /> Vào số GCN
                            </button>
                        </div>

                        {/* 2. Nhập từ Excel & Công cụ phân loại từ Excel */}
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-white font-bold py-2.5 px-3 rounded-xl border border-slate-700 text-xs transition-all active:scale-[0.98]"
                                title="Thêm hồ sơ mới từ file Excel"
                            >
                                <Upload size={14} className="text-slate-400 font-bold" /> Nhập Excel
                            </button>
                            <input 
                                type="file" 
                                ref={fileInputRef} 
                                className="hidden" 
                                accept=".xlsx, .xls" 
                                onChange={handleExcelImport} 
                            />

                            <button
                                onClick={() => {
                                    setExcelMatchedRecords([]);
                                    setExcelSelectedIds(new Set());
                                    setExcelActiveToolStatus('Đã chuyển thông tin thuế');
                                    setExcelCanBoUpdate('');
                                    setExcelFileName('');
                                    setExcelTotalScanned(0);
                                    setShowExcelClassifyModal(true);
                                }}
                                className="flex items-center justify-center gap-2 bg-indigo-900 border border-indigo-800 hover:bg-indigo-800 text-white font-bold py-2.5 px-3 rounded-xl text-xs transition-all active:scale-[0.98]"
                                title="Phân loại hàng loạt hồ sơ iGate bằng file Excel"
                            >
                                <Tag size={14} className="text-indigo-300" /> Phân loại (Excel)
                            </button>
                        </div>

                        {/* 3. Lập báo cáo */}
                        <button
                            onClick={() => setShowExportReportModal(true)}
                            className="w-full flex items-center justify-center gap-2 bg-indigo-950 text-indigo-200 border border-indigo-800 hover:bg-indigo-900 font-bold py-2.5 px-3 rounded-xl text-xs transition-all active:scale-[0.98]"
                        >
                            <Printer size={14} /> Xuất Báo Cáo Thống Kê
                        </button>

                        {/* 4. Khôi phục dữ liệu mẫu & Xóa dữ liệu (chỉ hiển thị cho admin) */}
                        <div className="flex flex-col gap-2 pt-2 border-t border-slate-800 text-[11px] text-slate-400">
                            <div className="flex items-center justify-between">
                                <span>Đã tải: <b className="text-slate-200">{records.length} hồ sơ</b></span>
                                {currentUser?.role === 'ADMIN' && (
                                    <div className="flex items-center gap-2.5">
                                        <button 
                                            onClick={handleDeleteAllRecords}
                                            className="text-red-400 hover:text-red-300 flex items-center gap-1 font-semibold transition-colors"
                                        >
                                            <Trash2 size={10} /> Xóa toàn bộ dữ liệu
                                        </button>
                                        <button 
                                            onClick={handleResetToDefault}
                                            className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-semibold transition-colors"
                                        >
                                            <RefreshCw size={10} /> Khôi phục dữ liệu mẫu
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* --- CONTROLS + FILTER BAR --- */}
            <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm space-y-4">
                <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                    <div className="flex-1 w-full relative">
                        <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Tìm kiếm theo Mã hồ sơ, Chủ sở hữu, SĐT, Cán bộ xử lý hoặc Tên thủ tục..."
                            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all text-slate-750 font-medium"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                        {/* Chọn lĩnh vực */}
                        <div className="w-full sm:w-auto md:w-auto flex items-center gap-2 border border-slate-200 rounded-xl px-3 py-1.5 bg-slate-50 min-w-[200px]">
                            <Filter size={16} className="text-slate-500" />
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Lĩnh vực:</span>
                            <select 
                                className="text-xs outline-none bg-transparent text-slate-700 font-semibold cursor-pointer border-none flex-1 focus:ring-0"
                                value={selectedLinhVucFilter}
                                onChange={(e) => {
                                    setSelectedLinhVucFilter(e.target.value);
                                    setSelectedIds(new Set());
                                }}
                            >
                                <option value="Tất cả">Tất cả lĩnh vực</option>
                                {LINH_VUC_LIST.map(v => <option key={v} value={v}>{v}</option>)}
                            </select>
                        </div>

                        {/* Chọn Loại hồ sơ */}
                        <div className="w-full sm:w-auto md:w-auto flex items-center gap-2 border border-slate-200 rounded-xl px-3 py-1.5 bg-slate-50 min-w-[200px] max-w-xs">
                            <Filter size={16} className="text-slate-500" />
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wide whitespace-nowrap">Loại hồ sơ:</span>
                            <select 
                                className="text-xs outline-none bg-transparent text-slate-700 font-semibold cursor-pointer border-none flex-1 focus:ring-0 truncate"
                                value={selectedLoaiHoSoFilter}
                                onChange={(e) => {
                                    setSelectedLoaiHoSoFilter(e.target.value);
                                    setSelectedIds(new Set());
                                }}
                            >
                                <option value="Tất cả">Tất cả loại hồ sơ</option>
                                {loaiHoSoList.map(v => <option key={v} value={v} title={v}>{v}</option>)}
                            </select>
                        </div>

                        {/* Cột hiển thị */}
                        <div className="relative" ref={columnDropdownRef}>
                            <button 
                                onClick={() => setIsColumnDropdownOpen(!isColumnDropdownOpen)}
                                className="flex items-center gap-1.5 px-3 py-2 bg-slate-50 border border-slate-200 text-slate-700 hover:bg-slate-100 rounded-xl text-xs font-bold transition-all cursor-pointer w-full sm:w-auto justify-center"
                                title="Tùy chọn cột hiển thị"
                            >
                                <LayoutGrid size={15} className="text-indigo-650" />
                                <span>Cột hiển thị</span>
                            </button>
                            {isColumnDropdownOpen && (
                                <div className="absolute right-0 mt-2 w-56 rounded-xl bg-white border border-slate-150 shadow-lg z-30 p-3.5 space-y-2 text-xs text-slate-700 font-medium">
                                    <p className="font-bold text-indigo-950 mb-1.5 pb-1 border-b border-slate-100 flex items-center justify-between">
                                        <span>Chọn cột hiển thị</span>
                                    </p>
                                    <div className="max-h-60 overflow-y-auto space-y-2">
                                        {columnsList.map(col => (
                                            <label key={col.key} className="flex items-center gap-2 cursor-pointer hover:text-indigo-600 font-semibold text-slate-600 transition-colors select-none">
                                                <input 
                                                    type="checkbox"
                                                    checked={visibleColumns[col.key]}
                                                    onChange={() => toggleColumn(col.key)}
                                                    className="rounded border-slate-300 text-indigo-600 h-3.5 w-3.5 focus:ring-0"
                                                />
                                                <span>{col.label}</span>
                                            </label>
                                        ))}
                                    </div>
                                    <div className="pt-2 border-t border-slate-100 flex justify-between gap-2">
                                        <button 
                                            type="button"
                                            onClick={() => {
                                                const allOn = { ...visibleColumns };
                                                Object.keys(allOn).forEach(k => allOn[k] = true);
                                                setVisibleColumns(allOn);
                                            }}
                                            className="text-[10px] text-indigo-650 hover:underline font-bold cursor-pointer"
                                        >
                                            Hiện tất cả
                                        </button>
                                        <button 
                                            type="button"
                                            onClick={() => {
                                                const defaultOn = {
                                                    stt: true, thongTinHoSo: true,
                                                    tenThuTuc: true, tenLinhVuc: true, thoiHanXuLy: true,
                                                    ngayKetThuc: true, donVi: true, canBoXuLy: true, trangThai: true
                                                };
                                                setVisibleColumns(defaultOn);
                                            }}
                                            className="text-[10px] text-slate-500 hover:underline font-bold cursor-pointer"
                                        >
                                            Mặc định
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Phân loại nhanh / Trạng thái hồ sơ iGate */}
                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-50">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mr-2">Phân loại hồ sơ:</span>
                    {[
                        'Tất cả',
                        'Mới tiếp nhận',
                        'Đã phát hành thông báo thuế',
                        'Đã thực hiện nghĩa vụ tài chính',
                        'Chờ thực hiện nghĩa vụ tài chính',
                        'Đã ký Giấy chứng nhận',
                        'Chưa trả kết quả',
                        'Đã trả kết quả',
                        'Hồ sơ trả'
                    ].map(tab => {
                        const isSelected = selectedTrangThaiFilter === tab;
                        let count = 0;
                        if (tab === 'Tất cả') count = records.length;
                        else if (tab === 'Mới tiếp nhận') count = records.filter(r => r.trangThai === 'Mới tiếp nhận').length;
                        else if (tab === 'Đã phát hành thông báo thuế') count = records.filter(r => r.trangThai === 'Đã phát hành thông báo thuế').length;
                        else if (tab === 'Đã thực hiện nghĩa vụ tài chính') count = records.filter(r => r.trangThai === 'Đã thực hiện nghĩa vụ tài chính').length;
                        else if (tab === 'Chờ thực hiện nghĩa vụ tài chính') count = Math.max(0, records.filter(r => r.trangThai === 'Đã phát hành thông báo thuế').length - records.filter(r => r.trangThai === 'Đã thực hiện nghĩa vụ tài chính').length);
                        else if (tab === 'Đã ký Giấy chứng nhận') count = records.filter(r => r.trangThai === 'Đã ký Giấy chứng nhận').length;
                        else if (tab === 'Chưa trả kết quả') count = records.filter(r => r.trangThai === 'Chưa trả kết quả').length;
                        else count = records.filter(r => r.trangThai === tab).length;

                        // Định dạng màu sắc các tab phân loại
                        let activeStyle = "bg-indigo-600 text-white shadow-md shadow-indigo-600/10";
                        let inactiveStyle = "bg-slate-50 text-slate-600 hover:bg-slate-100";
                        if (isSelected) {
                            if (tab.includes('thuế') || tab === 'Đã thực hiện nghĩa vụ tài chính') activeStyle = "bg-orange-500 text-white shadow-md shadow-orange-500/10";
                            else if (tab.includes('Giấy chứng nhận')) activeStyle = "bg-teal-600 text-white shadow-md shadow-teal-600/10";
                            else if (tab.includes('trả kết quả')) activeStyle = "bg-green-600 text-white shadow-md shadow-green-600/10";
                            else if (tab === 'Hồ sơ trả') activeStyle = "bg-rose-650 text-white shadow-md shadow-rose-600/10";
                        }

                        return (
                            <button
                                key={tab}
                                onClick={() => {
                                    setSelectedTrangThaiFilter(tab);
                                    setSelectedIds(new Set());
                                }}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shadow-sm ${isSelected ? activeStyle : inactiveStyle}`}
                            >
                                {tab}
                                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${isSelected ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'}`}>
                                    {count}
                                </span>
                            </button>
                        );
                    })}
                </div>
                
                {showOnlyTon90Days && (
                    <div className="flex items-center gap-2 bg-red-50 border border-red-150 text-red-800 px-3 py-2 rounded-xl text-xs font-semibold animate-fade-in mt-2">
                        <AlertTriangle size={14} className="text-red-500 shrink-0" />
                        <span>Đang lọc: <b>Hồ sơ tồn đọng trên 90 ngày</b> ({filteredRecords.length} hồ sơ)</span>
                        <button 
                            onClick={() => setShowOnlyTon90Days(false)} 
                            className="ml-auto font-bold text-red-600 hover:text-red-800 bg-red-100/50 hover:bg-red-200/50 px-2 py-0.5 rounded-lg transition-colors cursor-pointer"
                        >
                            Tắt lọc
                        </button>
                    </div>
                )}
            </div>

            {/* --- BULK ACTION BAR --- */}
            {selectedIds.size > 0 && (
                <div className="bg-indigo-50 border border-indigo-150 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 animate-fade-in shadow-xs">
                    <div className="flex items-center gap-3">
                        <span className="h-7 w-7 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-bold shadow-md shadow-indigo-600/20">
                            {selectedIds.size}
                        </span>
                        <div>
                            <span className="text-sm font-bold text-indigo-900 block">hồ sơ được tích chọn</span>
                            <span className="text-xs text-indigo-600 font-medium">Bấm phân loại trạng thái hoặc chuyển giao cán bộ xử lý hàng loạt</span>
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                        {/* Nút Phân loại hàng loạt mở Modal */}
                        <button
                            onClick={() => {
                                setBatchStatus('');
                                setBatchCanBo('');
                                setBatchDate(getTodayString());
                                setBatchLyDoTra('');
                                setIsBatchModalOpen(true);
                            }}
                            className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-600/10 cursor-pointer"
                        >
                            <Tag size={14} /> Phân loại hay chuyển cán bộ
                        </button>

                        {/* Xóa hàng loạt - Chỉ Admin mới có nút này */}
                        {currentUser?.role === UserRole.ADMIN && (
                            <button
                                onClick={() => {
                                    if (window.confirm(`CẢNH BÁO: Bạn có chắc chắn muốn xóa vĩnh viễn ${selectedIds.size} hồ sơ iGate đã chọn không?`)) {
                                        const updated = records.filter(r => !selectedIds.has(r.id));
                                        saveRecords(updated);
                                        setSelectedIds(new Set());
                                        alert(`Đã xóa thành công ${selectedIds.size} hồ sơ!`);
                                    }
                                }}
                                className="flex items-center justify-center gap-2 px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                            >
                                <Trash2 size={14} /> Xóa đã chọn
                            </button>
                        )}
                        
                        {/* Hủy chọn */}
                        <button
                            onClick={() => setSelectedIds(new Set())}
                            className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
                            title="Bỏ chọn tất cả"
                        >
                            <X size={16} />
                        </button>
                    </div>
                </div>
            )}

            {/* --- PRIMARY DATA TABLE --- */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
                <div className="overflow-x-auto">
                    <table className="w-full text-left table-fixed min-w-[1850px]">
                        <thead className="bg-[#1E293B] text-slate-300 text-xs font-semibold uppercase sticky top-0 z-10">
                            <tr>
                                <th className="px-3 py-3.5 w-11 text-center">
                                    <input 
                                        type="checkbox"
                                        checked={filteredRecords.length > 0 && filteredRecords.every(r => selectedIds.has(r.id))}
                                        onChange={(e) => {
                                            const newSelected = new Set<string>();
                                            if (e.target.checked) {
                                                filteredRecords.forEach(r => newSelected.add(r.id));
                                            }
                                            setSelectedIds(newSelected);
                                        }}
                                        className="rounded border-slate-600 bg-slate-800 text-indigo-500 focus:ring-indigo-500 cursor-pointer h-4 w-4"
                                    />
                                </th>
                                {visibleColumns.stt && <th className="px-3 py-3.5 w-12 text-center text-slate-400">STT</th>}
                                {visibleColumns.thongTinHoSo && <th className="px-3 py-3.5 w-[230px]">Thông tin hồ sơ</th>}
                                {visibleColumns.cccd && <th className="px-3 py-3.5 w-[110px] text-center font-mono">CCCD</th>}
                                {visibleColumns.tenThuTuc && <th className="px-3 py-3.5 w-[240px]">Loại biến động</th>}
                                {visibleColumns.chuyenQuyen && <th className="px-3 py-3.5 w-[130px]">CHUYỂN QUYỀN</th>}
                                {visibleColumns.soTo && <th className="px-3 py-3.5 w-[65px] text-center">Số tờ</th>}
                                {visibleColumns.soThua && <th className="px-3 py-3.5 w-[65px] text-center">Số thửa</th>}
                                {visibleColumns.tongDienTich && <th className="px-3 py-3.5 w-[120px] text-center">Tổng diện tích</th>}
                                {visibleColumns.dienTichDatO && <th className="px-3 py-3.5 w-[100px] text-center">Đất ở</th>}
                                {visibleColumns.dienTichDatNongNghiep && <th className="px-3 py-3.5 w-[130px] text-center">Đất nông nghiệp</th>}
                                {visibleColumns.diaDanh && <th className="px-3 py-3.5 w-[150px]">Địa danh</th>}
                                {visibleColumns.soPhatHanh && <th className="px-3 py-3.5 w-[130px]">Số phát hành</th>}
                                {visibleColumns.thoiHanSuDung && <th className="px-3 py-3.5 w-[140px]">Thời hạn sử dụng</th>}
                                {visibleColumns.tenLinhVuc && <th className="px-3 py-3.5 w-[150px]">Tên lĩnh vực</th>}
                                {visibleColumns.thoiHanXuLy && <th className="px-3 py-3.5 w-[170px] text-center">Thời hạn nhận & trả</th>}
                                {visibleColumns.ngayKetThuc && <th className="px-3 py-3.5 w-[100px] text-center">Kết thúc</th>}
                                {visibleColumns.donVi && <th className="px-3 py-3.5 w-[160px]">Cơ quan/đơn vị</th>}
                                {visibleColumns.canBoXuLy && <th className="px-3 py-3.5 w-[140px]">Cán bộ xử lý</th>}
                                {visibleColumns.trangThai && <th className="px-3 py-3.5 w-[155px] text-center">Trạng thái hồ sơ</th>}
                                {visibleColumns.ghiChu && <th className="px-3 py-3.5 w-[160px]">GHI CHÚ</th>}
                                <th className="px-3 py-3.5 w-[125px] text-center sticky right-0 bg-[#1E293B] shadow-[-4px_0_10px_rgba(0,0,0,0.2)]">Hành động</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                            {paginatedRecords.length > 0 ? paginatedRecords.map((r, idx) => {
                                // Kiểm tra quá hạn dùng parseToDateObject
                                const henTraDate = parseToDateObject(r.ngayHenTra);
                                const isOverdue = r.trangThai !== 'Đã trả kết quả' && henTraDate && new Date() > henTraDate;
 
                                // Style Trạng thái
                                let statusBadge = "bg-slate-100 text-slate-700 border-slate-200";
                                if (r.trangThai === 'Mới tiếp nhận') statusBadge = "bg-sky-50 text-sky-700 border-sky-100";
                                else if (r.trangThai === 'Đã chuyển thông tin thuế') statusBadge = "bg-orange-50 text-orange-600 border-orange-100";
                                else if (r.trangThai === 'Đã phát hành thông báo thuế') statusBadge = "bg-amber-100 text-amber-800 border-amber-200";
                                else if (r.trangThai === 'Đã thực hiện nghĩa vụ tài chính') statusBadge = "bg-emerald-100 text-emerald-800 border-emerald-200 font-bold";
                                else if (r.trangThai === 'Chờ thực hiện nghĩa vụ tài chính') statusBadge = "bg-orange-150 text-orange-850 border-orange-200";
                                else if (r.trangThai === 'Đã ký Giấy chứng nhận') statusBadge = "bg-teal-50 text-teal-700 border-teal-150";
                                else if (r.trangThai === 'Chưa trả kết quả') statusBadge = "bg-yellow-50 text-yellow-800 border-yellow-200 font-medium";
                                else if (r.trangThai === 'Đã trả kết quả') statusBadge = "bg-emerald-50 text-emerald-700 border-emerald-100 font-bold";
                                else if (r.trangThai === 'Hồ sơ trả') statusBadge = "bg-rose-50 text-rose-700 border-rose-200 font-bold";
 
                                return (
                                    <tr 
                                        key={r.id} 
                                        className={`hover:bg-slate-50/70 transition-all font-medium ${
                                            selectedIds.has(r.id) 
                                                ? 'bg-indigo-50/45 text-indigo-950' 
                                                : isOverdue 
                                                    ? 'bg-red-50/20' 
                                                    : r.trangThai === 'Đã trả kết quả' 
                                                        ? 'bg-emerald-50/5' 
                                                        : r.trangThai === 'Hồ sơ trả'
                                                            ? 'bg-rose-50/10'
                                                            : ''
                                        }`}
                                    >
                                        <td className="px-3 py-3 text-center text-xs align-middle">
                                            <input 
                                                type="checkbox"
                                                checked={selectedIds.has(r.id)}
                                                onChange={(e) => {
                                                    const newSelected = new Set(selectedIds);
                                                    if (e.target.checked) {
                                                        newSelected.add(r.id);
                                                    } else {
                                                        newSelected.delete(r.id);
                                                    }
                                                    setSelectedIds(newSelected);
                                                }}
                                                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer h-4 w-4"
                                            />
                                        </td>
                                        {visibleColumns.stt && <td className="px-3 py-3 text-center text-slate-400 font-bold text-xs align-middle">{(currentPage - 1) * itemsPerPage + idx + 1}</td>}
                                        {visibleColumns.thongTinHoSo && (
                                            /* test comment */
                                            <td className="px-3 py-3 text-xs align-middle">
                                                <div className="flex flex-col gap-1">
                                                    {/* Số hồ sơ */}
                                                    <div className="flex items-center gap-1.5 mb-0.5 bg-indigo-50/60 border border-indigo-100 px-2 py-0.5 rounded-lg w-fit">
                                                        <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider block">Mã số:</span>
                                                        <span className="font-mono font-extrabold text-[#1E293B] text-[13px]">{r.soHieu}</span>
                                                    </div>
                                                    {/* Chủ hồ sơ */}
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 text-slate-700 flex items-center justify-center font-bold text-sm shrink-0 shadow-xs">
                                                            {r.chuHoSo ? r.chuHoSo.charAt(0).toUpperCase() : '?'}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <span className="font-bold text-slate-800 block truncate max-w-[200px] text-[13px]" title={r.chuHoSo}>{r.chuHoSo}</span>
                                                        </div>
                                                    </div>
                                                    {/* Số điện thoại */}
                                                    {r.soDienThoai ? (
                                                        <div className="flex items-center gap-1 mt-0.5 text-xs text-slate-500 font-mono">
                                                            <Phone size={12} className="text-slate-400 shrink-0" />
                                                            <span>{r.soDienThoai}</span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-slate-400 italic text-[11px] mt-0.5">- Không SĐT -</span>
                                                    )}
                                                </div>
                                            </td>
                                        )}
                                        {visibleColumns.cccd && (
                                            <td className="px-3 py-3 text-center text-xs align-middle font-mono text-slate-700 font-medium">
                                                {r.cccd || '-'}
                                            </td>
                                        )}
                                        {visibleColumns.tenThuTuc && (
                                            <td className="px-3 py-3 text-slate-600 leading-tight text-xs align-middle" title={r.tenThuTuc}>
                                                <div className="line-clamp-2 text-xs font-semibold text-slate-700 leading-snug max-w-[250px]" title={r.tenThuTuc}>
                                                    {r.tenThuTuc || '-'}
                                                </div>
                                            </td>
                                        )}
                                        {visibleColumns.chuyenQuyen && (
                                            <td className="px-3 py-3 text-xs align-middle text-slate-600 font-semibold" title={r.chuyenQuyen}>
                                                <span className="truncate max-w-[130px] block">{r.chuyenQuyen || '-'}</span>
                                            </td>
                                        )}
                                        {visibleColumns.soTo && (
                                            <td className="px-3 py-3 text-center text-xs font-bold align-middle text-slate-750 bg-[#F8FAFC]">
                                                {r.soTo || '-'}
                                            </td>
                                        )}
                                        {visibleColumns.soThua && (
                                            <td className="px-3 py-3 text-center text-xs font-bold align-middle text-slate-755 bg-[#F8FAFC]">
                                                {r.soThua || '-'}
                                            </td>
                                        )}
                                        {visibleColumns.tongDienTich && (
                                            <td className="px-3 py-3 text-center text-xs font-extrabold align-middle text-slate-900">
                                                {r.tongDienTich !== null && r.tongDienTich !== undefined ? `${r.tongDienTich.toLocaleString('vi-VN')} m²` : '-'}
                                            </td>
                                        )}
                                        {visibleColumns.dienTichDatO && (
                                            <td className="px-3 py-3 text-center text-xs font-bold align-middle text-orange-900 bg-orange-50/5">
                                                {r.dienTichDatO !== null && r.dienTichDatO !== undefined ? `${r.dienTichDatO.toLocaleString('vi-VN')} m²` : '-'}
                                            </td>
                                        )}
                                        {visibleColumns.dienTichDatNongNghiep && (
                                            <td className="px-3 py-3 text-center text-xs font-bold align-middle text-emerald-800 bg-emerald-50/5">
                                                {(() => {
                                                    const tot = Number(r.tongDienTich || 0);
                                                    const o = Number(r.dienTichDatO || 0);
                                                    const nong = tot > 0 ? (tot - o) : 0;
                                                    return tot > 0 ? `${nong.toLocaleString('vi-VN')} m²` : '-';
                                                })()}
                                            </td>
                                        )}
                                        {visibleColumns.diaDanh && (
                                            <td className="px-3 py-3 text-xs align-middle text-slate-600" title={r.diaDanh}>
                                                <div className="truncate max-w-[170px]" title={r.diaDanh}>{r.diaDanh || '-'}</div>
                                            </td>
                                        )}
                                        {visibleColumns.soPhatHanh && (
                                            <td className="px-3 py-3 text-xs align-middle font-mono text-slate-700 font-bold" title={r.soPhatHanh}>
                                                <div className="truncate max-w-[130px]" title={r.soPhatHanh}>{r.soPhatHanh || '-'}</div>
                                            </td>
                                        )}
                                        {visibleColumns.thoiHanSuDung && (
                                            <td className="px-3 py-3 text-xs align-middle">
                                                <div className="flex flex-col gap-0.5 text-[10px] leading-tight">
                                                    {Number(r.dienTichDatO || 0) > 0 && (
                                                        <span className="text-indigo-700 font-bold">Đất ở: Lâu dài</span>
                                                    )}
                                                    <span className="text-slate-500 font-semibold" title={r.thoiHanSuDung}>Đất NN: {formatThoiHanSuDung(r.thoiHanSuDung)}</span>
                                                </div>
                                            </td>
                                        )}
                                        {visibleColumns.tenLinhVuc && (
                                            <td className="px-3 py-3 text-xs align-middle">
                                                <span className="text-xs bg-slate-100/80 text-slate-600 border border-slate-200 px-2 py-0.5 rounded-md font-bold inline-block max-w-[140px] truncate" title={r.tenLinhVuc}>
                                                    {r.tenLinhVuc || '-'}
                                                </span>
                                            </td>
                                        )}
                                        {visibleColumns.thoiHanXuLy && (
                                            <td className="px-3 py-3 text-center text-xs align-middle">
                                                <div className="flex flex-col gap-1.5 items-center justify-center animate-fade-in">
                                                    <div className="flex items-center gap-1.5 text-xs">
                                                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider w-[64px] text-right">Nhận:</span>
                                                        <span className="font-mono text-slate-700 font-semibold bg-slate-100 border border-slate-150 px-1.5 py-0.5 rounded-md">{formatDisplayDateInClient(r.ngayTiepNhan)}</span>
                                                    </div>
                                                    <div className="flex items-center gap-1.5 text-xs mt-0.5">
                                                        <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider w-[64px] text-right whitespace-nowrap">Trả KQ:</span>
                                                        <span className="font-mono text-indigo-900 font-bold bg-indigo-50/50 border border-indigo-150 px-1.5 py-0.5 rounded-md">{formatDisplayDateInClient(r.ngayHenTra)}</span>
                                                    </div>
                                                    {isOverdue && (
                                                        <span className="text-[9px] text-red-650 font-bold bg-red-100 border border-red-150 px-2 py-0.5 rounded-md mt-1 animate-pulse uppercase tracking-wider">Trễ hẹn</span>
                                                    )}
                                                </div>
                                            </td>
                                        )}
                                        {visibleColumns.ngayKetThuc && (
                                            <td className="px-3 py-3 text-center font-mono text-emerald-650 font-bold bg-emerald-50/10 text-xs align-middle">
                                                {formatDisplayDateInClient(r.ngayKetThuc) || '-'}
                                            </td>
                                        )}
                                        {visibleColumns.donVi && (
                                            <td className="px-3 py-3 text-slate-550 text-xs align-middle" title={r.donVi}>
                                                <div className="truncate max-w-[150px] text-xs font-semibold text-slate-600" title={r.donVi}>
                                                    {r.donVi}
                                                </div>
                                            </td>
                                        )}
                                        {visibleColumns.canBoXuLy && (
                                            <td className="px-3 py-3 text-slate-700 text-xs align-middle">
                                                <div className="flex items-center gap-1.5 max-w-[140px] truncate" title={r.canBoXuLy || '-'}>
                                                    <UserIcon size={14} className="text-slate-400 shrink-0" />
                                                    <span className="truncate text-xs font-semibold text-slate-700">{r.canBoXuLy || '-'}</span>
                                                </div>
                                            </td>
                                        )}
                                        {visibleColumns.trangThai && (
                                            <td className="px-3 py-3 text-center text-xs align-middle">
                                                <div className="flex flex-col items-center gap-1">
                                                    <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-bold border ${statusBadge}`}>
                                                        {r.trangThai}
                                                    </span>
                                                    {(() => {
                                                        const stateDate = r.trangThai === 'Mới tiếp nhận' ? r.ngayTiepNhan : (r.trangThai === 'Hồ sơ trả' ? r.ngayTra : r.ngayKetThuc);
                                                        if (stateDate) {
                                                            return (
                                                                <span className="text-[10px] text-slate-500 font-semibold font-mono whitespace-nowrap block mt-0.5">
                                                                    {formatDisplayDateInClient(stateDate)}
                                                                </span>
                                                            );
                                                        }
                                                        return null;
                                                    })()}
                                                </div>
                                            </td>
                                        )}
                                        {visibleColumns.ghiChu && (
                                            <td className="px-3 py-3 text-xs text-slate-500 italic max-w-[170px] truncate align-middle" title={r.ghiChu}>
                                                {r.ghiChu || '-'}
                                            </td>
                                        )}
                                        <td className="px-3 py-3 text-center sticky right-0 bg-white shadow-[-4px_0_10px_rgba(0,0,0,0.04)] text-xs align-middle">
                                            <div className="flex justify-center gap-1 shadow-[-8px_0_10px_-4px_rgba(0,0,0,0.04)]">
                                                <button 
                                                    onClick={() => setViewingRecord(r)} 
                                                    className="p-1 px-2 text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700 rounded text-xs font-bold transition-all cursor-pointer"
                                                    title="Xem chi tiết đầy đủ hồ sơ"
                                                >
                                                    Xem
                                                </button>
                                                <button 
                                                    onClick={() => handleEdit(r)} 
                                                    className="p-1 px-2 text-blue-600 hover:bg-blue-50 hover:text-blue-700 rounded text-xs font-bold transition-all cursor-pointer"
                                                    title="Chỉnh sửa chi tiết"
                                                >
                                                    Sửa
                                                </button>
                                                {currentUser?.role === UserRole.ADMIN && (
                                                    <button 
                                                        onClick={() => handleDelete(r.id, r.soHieu)} 
                                                        className="p-1 px-2 text-red-500 hover:bg-red-50 hover:text-red-700 rounded text-xs font-bold transition-all cursor-pointer"
                                                        title="Xóa hồ sơ"
                                                    >
                                                        Xóa
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            }) : (
                                <tr>
                                    <td colSpan={Object.values(visibleColumns).filter(v => v).length + 2} className="p-16 text-center text-slate-400">
                                        <AlertCircle size={32} className="mx-auto text-slate-300 mb-2" />
                                        <p className="font-bold">Không tìm thấy hồ sơ iGate nào phù hợp</p>
                                        <p className="text-xs text-slate-400 mt-1">Vui lòng thay đổi từ khóa tìm kiếm hoặc lọc phân loại khác</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
                <div className="bg-slate-50/75 p-4 border-t border-slate-100 flex flex-col sm:flex-row gap-4 justify-between items-center text-xs text-slate-500">
                    <div className="flex items-center gap-2">
                        <span>Hiển thị <b>{filteredRecords.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0}</b> - <b>{Math.min(currentPage * itemsPerPage, filteredRecords.length)}</b> trong số <b>{filteredRecords.length}</b> hồ sơ iGate</span>
                    </div>

                    {totalPages > 1 && (
                        <div className="flex items-center gap-1.5">
                            <button
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 text-slate-600 font-bold transition-all disabled:cursor-not-allowed cursor-pointer"
                            >
                                Trước
                            </button>
                            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                let p = i + 1;
                                if (totalPages > 5) {
                                    if (currentPage > 3) p = currentPage - 2 + i;
                                    if (p > totalPages) p = totalPages - (4 - i);
                                    if (p < 1) p = i + 1;
                                }
                                return (
                                    <button
                                        key={p}
                                        onClick={() => setCurrentPage(p)}
                                        className={`w-8 h-8 rounded-lg border text-xs font-bold transition-all cursor-pointer ${
                                            currentPage === p 
                                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/10' 
                                            : 'border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-350 text-slate-600'
                                        }`}
                                    >
                                        {p}
                                    </button>
                                );
                            })}
                            <button
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                                className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 text-slate-600 font-bold transition-all disabled:cursor-not-allowed cursor-pointer"
                            >
                                Sau
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </>

        {showVaoSoModal && (
            <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in text-left">
                <div className="bg-white rounded-2xl shadow-2xl max-w-7xl w-full max-h-[90vh] overflow-hidden flex flex-col animate-scale-up border border-slate-100">
                    {/* Header của Modal */}
                    <div className="bg-gradient-to-r from-purple-800 to-indigo-950 p-5 text-white flex justify-between items-center shrink-0">
                        <div>
                            <h3 className="font-bold flex items-center gap-2 text-base text-left">
                                <FileSpreadsheet size={18} className="text-purple-400" />
                                Công cụ Vào số GCN (Bàn giao 1 cửa)
                            </h3>
                            <p className="text-xs text-purple-200 mt-1 font-medium text-left">
                                Công cụ đối chiếu thông tin GCN từ tệp Excel và thực hiện cập nhật Số vào sổ, Ngày ký GCN đồng thời bàn giao 1 cửa
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <button 
                                onClick={() => setShowExportHandover1CuaModal(true)} 
                                className="flex items-center gap-1.5 bg-pink-600 hover:bg-pink-700 text-white px-3 py-1.5 rounded-lg font-bold text-xs shadow-sm transition-all cursor-pointer"
                            >
                                <FileOutput size={14}/> Xuất DS bàn giao 1 cửa
                            </button>
                            <button 
                                onClick={() => setShowVaoSoModal(false)}
                                className="rounded-lg p-1.5 hover:bg-white/10 text-white transition-all cursor-pointer border border-white/10"
                            >
                                <X size={18} />
                            </button>
                        </div>
                    </div>

                    {/* Nội dung chính của Modal */}
                    <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
                        {tempRecords.length === 0 ? (
                            <div className="flex flex-col items-center justify-center p-12 min-h-[350px]">
                                <div className="bg-white border-2 border-dashed border-slate-300 rounded-2xl p-10 max-w-lg w-full text-center shadow-md flex flex-col items-center gap-4 hover:border-purple-500 transition-colors mx-auto">
                                    <div className="p-4 bg-purple-50 text-purple-600 rounded-full">
                                        <FileSpreadsheet size={48} />
                                    </div>
                                    <div className="space-y-2">
                                        <h3 className="text-sm font-bold text-slate-850">Nhập dữ liệu GCN từ Excel</h3>
                                        <p className="text-xs text-slate-500 leading-relaxed">
                                            Chọn file Excel chứa danh sách Mã hồ sơ cần vào số. Hệ thống sẽ tự động đối chiếu thông tin với cơ sở dữ liệu iGate chính thức.
                                        </p>
                                    </div>
                                    <input 
                                        type="file" 
                                        ref={tempFileInputRef} 
                                        onChange={handleTempExcelUpload} 
                                        accept=".xlsx, .xls" 
                                        className="hidden" 
                                    />
                                    <div className="flex gap-3 mt-2 justify-center">
                                        <button 
                                            onClick={handleTempImportClick} 
                                            className="flex items-center gap-2 bg-purple-600 text-white px-5 py-2.5 rounded-xl font-bold text-xs hover:bg-purple-700 shadow-md transition-all hover:scale-105 cursor-pointer"
                                        >
                                            <Upload size={14}/> Chọn tệp Excel
                                        </button>
                                        <button 
                                            onClick={handleDownloadTemplateVaoSo} 
                                            className="flex items-center gap-2 bg-slate-100 text-slate-700 border border-slate-300 px-4 py-2.5 rounded-xl font-bold text-xs hover:bg-slate-200 shadow-sm cursor-pointer"
                                        >
                                            <Download size={14}/> Mẫu nhập liệu
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col overflow-hidden bg-white rounded-xl border border-slate-200 shadow-sm">
                                {/* Toolbar */}
                                <div className="p-3 bg-purple-50/50 border-b border-purple-100 flex flex-wrap items-center justify-between gap-3">
                                    <div className="flex items-center gap-2">
                                        <span className="text-[11px] font-semibold bg-purple-100 text-purple-700 px-2.5 py-1 rounded-full flex items-center gap-1.5">
                                            <FileSpreadsheet size={12} /> Tệp: {tempExcelFileName}
                                        </span>
                                        <span className="text-xs text-slate-500">
                                            Hệ thống nhận diện: <strong className="text-slate-800">{tempRecords.length}</strong> hồ sơ | Đã chọn: <strong className="text-purple-700">{selectedTempIds.size}</strong>
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
                                            className="flex items-center gap-1.5 text-xs bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 px-3 py-1.5 rounded-lg shadow-xs font-semibold transition-colors cursor-pointer"
                                        >
                                            Chọn tệp khác
                                        </button>
                                        <button 
                                            onClick={handleAutoAssignAllTempBookNumbers}
                                            className="flex items-center gap-1.5 text-xs bg-blue-600 text-white hover:bg-blue-700 px-3 py-1.5 rounded-lg shadow-xs font-bold transition-colors cursor-pointer"
                                            title="Tự động điền Số vào sổ tiếp theo từ hệ thống cho các dòng còn trống"
                                        >
                                            <Hash size={12}/> Tự động đánh số vào sổ
                                        </button>
                                        <button 
                                            onClick={() => setShowConfirmHandoverModal(true)}
                                            className="flex items-center gap-1.5 text-xs bg-purple-600 text-white hover:bg-purple-700 px-4 py-1.5 rounded-lg shadow-md font-bold transition-colors animate-pulse cursor-pointer"
                                            title="Xác nhận dữ liệu và bàn giao sang 1 cửa"
                                        >
                                            <CheckCircle2 size={12}/> Xác nhận cập nhật & Bàn giao
                                        </button>
                                    </div>
                                </div>

                                {/* Bảng hồ sơ nhận diện */}
                                <div className="flex-1 overflow-auto max-h-[50vh]">
                                    <table className="min-w-full table-fixed border-collapse text-left">
                                        <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm border-b">
                                            <tr className="text-slate-600 text-xs">
                                                <th className="p-2 border-b border-r border-slate-200 w-10 text-center bg-slate-50 sticky left-0 z-20">
                                                    <input 
                                                        type="checkbox" 
                                                        onChange={handleSelectAllTempRows} 
                                                        checked={tempRecords.length > 0 && selectedTempIds.size === tempRecords.length} 
                                                        className="w-3.5 h-3.5 rounded text-purple-600 cursor-pointer"
                                                    />
                                                </th>
                                                <th className="p-2 border-b border-r border-slate-200 w-12 text-center bg-slate-50 sticky left-10 z-20">#</th>
                                                <th className="p-2 border-b border-r border-slate-200 w-40 text-[11px] font-bold text-slate-500 uppercase text-center whitespace-nowrap">Mã hồ sơ</th>
                                                <th className="p-2 border-b border-r border-slate-200 w-40 text-[11px] font-bold text-slate-500 uppercase text-center whitespace-nowrap">Địa danh (Xã)</th>
                                                <th className="p-2 border-b border-r border-slate-200 w-56 text-[11px] font-bold text-slate-500 uppercase text-center whitespace-nowrap">Chủ sử dụng đất</th>
                                                <th className="p-2 border-b border-r border-slate-200 w-24 text-[11px] font-bold text-slate-500 uppercase text-center whitespace-nowrap">Số tờ</th>
                                                <th className="p-2 border-b border-r border-slate-200 w-24 text-[11px] font-bold text-slate-500 uppercase text-center whitespace-nowrap">Số thửa</th>
                                                <th className="p-2 border-b border-r border-slate-200 w-32 text-[11px] font-bold text-slate-500 uppercase text-center whitespace-nowrap">Tổng DT (m2)</th>
                                                <th className="p-2 border-b border-r border-slate-200 w-32 text-[11px] font-bold text-slate-500 uppercase text-center whitespace-nowrap">Đất ở (m2)</th>
                                                <th className="p-2 border-b border-r border-slate-200 w-32 text-[11px] font-bold text-slate-500 uppercase text-center whitespace-nowrap">Đất NN (m2)</th>
                                                <th className="p-2 border-b border-r border-slate-200 w-40 text-[11px] font-bold text-slate-500 uppercase text-center whitespace-nowrap">Số phát hành GCN</th>
                                                <th className="p-2 border-b border-r border-slate-200 w-48 text-[11px] font-bold text-slate-500 uppercase text-center whitespace-nowrap">Số vào sổ</th>
                                                <th className="p-2 border-b border-r border-slate-200 w-40 text-[11px] font-bold text-slate-500 uppercase text-center whitespace-nowrap">Ngày ký GCN</th>
                                                <th className="p-2 border-b border-slate-200 w-20 text-center bg-slate-50 sticky right-0 z-20">Xóa</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 text-xs bg-white text-left">
                                            {tempRecords.map((r, idx) => (
                                                <tr key={idx} className={`hover:bg-purple-50/20 group ${selectedTempIds.has(String(idx)) ? 'bg-purple-50/40' : ''}`}>
                                                    <td className="p-2 border-r border-slate-200 text-center bg-white sticky left-0 z-10 group-hover:bg-purple-50/20">
                                                        <input 
                                                            type="checkbox" 
                                                            checked={selectedTempIds.has(String(idx))} 
                                                            onChange={() => handleSelectTempRow(idx)} 
                                                            className="w-3.5 h-3.5 rounded text-purple-600 cursor-pointer"
                                                        />
                                                    </td>
                                                    <td className="p-2 border-r border-slate-200 text-center text-slate-400 text-xs bg-white sticky left-10 z-10 group-hover:bg-purple-50/20 font-mono">
                                                        {idx + 1}
                                                    </td>
                                                    <td className="p-2 border-r border-slate-100 text-xs text-left">
                                                        <div className="flex items-center gap-1.5 font-mono font-bold text-slate-800">
                                                            {r.existsInSystem ? (
                                                                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" title="Tìm thấy hồ sơ trên hệ thống iGate" />
                                                            ) : (
                                                                <span title="Mã hồ sơ chưa tồn tại trên iGate">
                                                                    <AlertTriangle size={14} className="text-amber-500 shrink-0 animate-bounce" />
                                                                </span>
                                                            )}
                                                            {r.code}
                                                        </div>
                                                    </td>
                                                    <td className="p-2 border-r border-slate-100 text-xs text-left">
                                                        <input 
                                                            type="text"
                                                            className="w-full text-xs px-2 py-1.5 border border-transparent rounded-lg hover:border-slate-200 focus:border-purple-500 focus:bg-white outline-none bg-transparent"
                                                            value={r.diaDanh || ''}
                                                            onChange={(e) => handleTempCellChange(idx, 'diaDanh', e.target.value)}
                                                            placeholder="Xã..."
                                                        />
                                                    </td>
                                                    <td className="p-2 border-r border-slate-100 text-xs text-left">
                                                        <input 
                                                            type="text"
                                                            className="w-full font-bold text-xs px-2 py-1.5 border border-transparent rounded-lg hover:border-slate-200 focus:border-purple-500 focus:bg-white outline-none bg-transparent text-slate-800"
                                                            value={r.customerName || ''}
                                                            onChange={(e) => handleTempCellChange(idx, 'customerName', e.target.value)}
                                                        />
                                                    </td>
                                                    <td className="p-2 border-r border-slate-100 text-xs text-center">
                                                        <input 
                                                            type="text"
                                                            className="w-full text-center text-xs px-2 py-1.5 border border-transparent rounded-lg hover:border-slate-200 focus:border-purple-500 focus:bg-white outline-none bg-transparent font-mono font-semibold"
                                                            value={r.mapSheet || ''}
                                                            onChange={(e) => handleTempCellChange(idx, 'mapSheet', e.target.value)}
                                                        />
                                                    </td>
                                                    <td className="p-2 border-r border-slate-100 text-xs text-center">
                                                        <input 
                                                            type="text"
                                                            className="w-full text-center text-xs px-2 py-1.5 border border-transparent rounded-lg hover:border-slate-200 focus:border-purple-500 focus:bg-white outline-none bg-transparent font-mono font-semibold"
                                                            value={r.landPlot || ''}
                                                            onChange={(e) => handleTempCellChange(idx, 'landPlot', e.target.value)}
                                                        />
                                                    </td>
                                                    <td className="p-2 border-r border-slate-100 text-xs text-center">
                                                        <input 
                                                            type="text"
                                                            className="w-full text-center text-xs px-2 py-1.5 border border-transparent rounded-lg hover:border-slate-200 focus:border-purple-500 focus:bg-white outline-none bg-transparent font-mono"
                                                            value={r.area || ''}
                                                            onChange={(e) => handleTempCellChange(idx, 'area', e.target.value)}
                                                        />
                                                    </td>
                                                    <td className="p-2 border-r border-slate-100 text-xs text-center bg-orange-50/10">
                                                        <input 
                                                            type="text"
                                                            className="w-full text-center text-xs px-2 py-1.5 border border-transparent rounded-lg hover:border-slate-200 focus:border-purple-500 focus:bg-white outline-none bg-transparent text-orange-700 font-bold"
                                                            value={r.datO || ''}
                                                            onChange={(e) => handleTempCellChange(idx, 'datO', e.target.value)}
                                                            placeholder="0"
                                                        />
                                                    </td>
                                                    <td className="p-2 border-r border-slate-100 text-xs text-center bg-green-50/10">
                                                        <input 
                                                            type="text"
                                                            className="w-full text-center text-xs px-2 py-1.5 border border-transparent rounded-lg hover:border-slate-200 focus:border-purple-500 focus:bg-white outline-none bg-transparent text-green-700 font-bold"
                                                            value={r.datNongNghiep || ''}
                                                            onChange={(e) => handleTempCellChange(idx, 'datNongNghiep', e.target.value)}
                                                            placeholder="0"
                                                        />
                                                    </td>
                                                    <td className="p-2 border-r border-slate-100 text-xs text-left">
                                                        <input 
                                                            type="text"
                                                            className="w-full text-xs px-2 py-1.5 border border-transparent rounded-lg hover:border-slate-200 focus:border-purple-500 focus:bg-white outline-none bg-transparent font-mono"
                                                            value={r.soPhatHanh || ''}
                                                            onChange={(e) => handleTempCellChange(idx, 'soPhatHanh', e.target.value)}
                                                            placeholder="CQ..."
                                                        />
                                                    </td>
                                                    <td className="p-1 border-r border-slate-100 text-xs">
                                                        <div className="flex items-center gap-1">
                                                            <input 
                                                                type="text"
                                                                className="flex-1 min-w-0 text-xs px-1.5 py-1.5 border border-transparent rounded-lg hover:border-slate-200 focus:border-purple-500 focus:bg-white outline-none bg-transparent font-mono font-bold text-blue-700 animate-pulse"
                                                                value={r.soVaoSo || ''}
                                                                onChange={(e) => handleTempCellChange(idx, 'soVaoSo', e.target.value)}
                                                                placeholder="CN..."
                                                            />
                                                            <button 
                                                                onClick={() => handleGetTempBookNumber(idx)}
                                                                className="p-1.5 bg-purple-50 hover:bg-purple-100 rounded-lg text-purple-600 transition-colors cursor-pointer"
                                                                title="Lấy số tự động từ hệ thống"
                                                                tabIndex={-1}
                                                            >
                                                                <Hash size={13} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                    <td className="p-2 border-r border-slate-100 text-xs font-mono">
                                                        <input 
                                                            type="date"
                                                            className="w-full text-xs px-1.5 py-1.5 border border-slate-200 rounded-lg focus:border-purple-500 focus:bg-white outline-none text-slate-700 cursor-pointer"
                                                            value={r.ngayKyGcn || ''}
                                                            onChange={(e) => handleTempCellChange(idx, 'ngayKyGcn', e.target.value)}
                                                        />
                                                    </td>
                                                    <td className="p-2 text-center bg-white sticky right-0 group-hover:bg-purple-50/20 z-10 border-l">
                                                        <button 
                                                            onClick={() => handleDeleteTempRow(idx)}
                                                            className="text-slate-400 hover:text-red-500 p-1 cursor-pointer transition-colors"
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
                        )}
                    </div>
                </div>
            </div>
        )}

            {/* --- MODAL KIỂM SOÁT TRÙNG & BÁO CÁO NHẬP EXCEL IGATE --- */}
            {showImportConfirmModal && (
                <div id="igate-import-confirm-modal" className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col animate-scale-up border border-slate-100">
                        <div className="bg-gradient-to-r from-blue-950 to-[#1E293B] p-5 text-white flex justify-between items-center">
                            <h3 className="font-bold flex items-center gap-2 text-base text-left">
                                <FileSpreadsheet size={18} className="text-blue-400" />
                                Kiểm soát Trùng & Báo cáo Số lượng Nhập Excel
                            </h3>
                            <button 
                                onClick={() => {
                                    setShowImportConfirmModal(false);
                                    setTempImportedRecords([]);
                                }} 
                                className="rounded-lg p-1 hover:bg-white/10 text-white transition-all cursor-pointer"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto space-y-4 flex-1 text-left">
                            <p className="text-xs text-slate-500 font-medium leading-relaxed">
                                Hệ thống đã kiểm tra mã hồ sơ (<strong className="text-slate-700">Số hiệu</strong>) của tệp Excel so với dữ liệu hiện có trên Supabase và nội bộ tệp. Vui lòng xem báo cáo số lượng dưới đây:
                            </p>

                            {/* BẢNG BÁO CÁO SỐ LƯỢNG */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-blue-50 p-3 rounded-xl border border-blue-100 flex flex-col justify-between">
                                    <span className="text-[11px] font-bold text-blue-700 uppercase tracking-wider">Tổng số hồ sơ trong file</span>
                                    <span className="text-2xl font-black text-blue-900 mt-1">{importReport.totalCount}</span>
                                </div>
                                <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-100 flex flex-col justify-between">
                                    <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">Hợp lệ (Sẵn sàng nhập)</span>
                                    <span className="text-2xl font-black text-emerald-900 mt-1">{importReport.validCount}</span>
                                </div>
                                <div className="bg-amber-50 p-3 rounded-xl border border-amber-100 flex flex-col justify-between col-span-2">
                                    <div className="text-[11px] font-bold text-amber-700 uppercase tracking-wider mb-2">Trùng tuyệt đối cả 3 cột (Mã + Tờ + Thửa)</div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="bg-white/60 p-2 rounded-lg border border-amber-150">
                                            <span className="text-[10px] text-slate-500 block">Nội bộ tệp:</span>
                                            <span className="text-lg font-bold text-amber-950">{importReport.duplicateInFileCount}</span>
                                        </div>
                                        <div className="bg-white/60 p-2 rounded-lg border border-amber-150">
                                            <span className="text-[10px] text-slate-500 block">Trên hệ thống:</span>
                                            <span className="text-lg font-bold text-amber-950">{importReport.duplicateWithDbCount}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-orange-50 p-3 rounded-xl border border-orange-100 flex flex-col justify-between col-span-2">
                                    <div className="text-[11px] font-bold text-orange-700 uppercase tracking-wider mb-2">Trùng mã nhưng khác số Tờ / Thửa (Hệ thống cảnh báo)</div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="bg-white/60 p-2 rounded-lg border border-orange-150">
                                            <span className="text-[10px] text-slate-500 block">Nội bộ tệp:</span>
                                            <span className="text-lg font-bold text-orange-950">{importReport.dupCodeDiffInFileCount}</span>
                                        </div>
                                        <div className="bg-white/60 p-2 rounded-lg border border-orange-150">
                                            <span className="text-[10px] text-slate-500 block">Trên hệ thống:</span>
                                            <span className="text-lg font-bold text-orange-950">{importReport.dupCodeDiffWithDbCount}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* CHI TIẾT CÁC MÃ TRÙNG LẶP / CẢNH BÁO */}
                            {importReport.skippedRecords && importReport.skippedRecords.length > 0 && (
                                <div className="space-y-2.5">
                                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wide block flex items-center gap-1.5">
                                        <AlertTriangle size={14} className="text-red-500" />
                                        Danh sách dòng trùng lặp / cảnh báo chi tiết ({importReport.skippedRecords.length} dòng):
                                    </span>
                                    <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-xs">
                                        <div className="max-h-[220px] overflow-y-auto">
                                            <table className="w-full text-left border-collapse">
                                                <thead className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wider sticky top-0 z-10 border-b border-slate-100">
                                                    <tr>
                                                        <th className="py-2 px-3 text-center w-20">Dòng Excel</th>
                                                        <th className="py-2 px-3 w-36">Mã hồ sơ</th>
                                                        <th className="py-2 px-3 w-16 text-center">Tờ</th>
                                                        <th className="py-2 px-3 w-16 text-center">Thửa</th>
                                                        <th className="py-2 px-3 text-rose-800">Lý do trùng lặp / Cảnh báo</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100 text-xs text-slate-750">
                                                    {importReport.skippedRecords.map((r, idx) => (
                                                        <tr key={r.id || idx} className="hover:bg-slate-50/80 transition-colors">
                                                            <td className="py-2.5 px-3 text-center font-mono font-semibold text-slate-500 bg-slate-50/30">
                                                                Dòng {r.excelRowIndex || '-'}
                                                            </td>
                                                            <td className="py-2.5 px-3 font-mono font-bold text-slate-900 select-all">
                                                                {r.soHieu}
                                                            </td>
                                                            <td className="py-2.5 px-3 text-center font-mono text-slate-600">
                                                                {r.soTo || '-'}
                                                            </td>
                                                            <td className="py-2.5 px-3 text-center font-mono text-slate-600">
                                                                {r.soThua || '-'}
                                                            </td>
                                                            <td className="py-2.5 px-3 text-[11px] text-red-700 font-medium leading-normal">
                                                                {importReport.skippedReasons[idx]}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* KHUYẾN NGHỊ */}
                            <div className="flex gap-2.5 bg-blue-50/50 p-3 rounded-xl border border-blue-100/50 text-slate-600">
                                <Info size={16} className="text-blue-600 flex-shrink-0 mt-0.5" />
                                <div className="text-xs space-y-1 leading-relaxed">
                                    <p className="font-semibold text-blue-900">Vui lòng chọn phương án nhập dữ liệu:</p>
                                    <ul className="list-disc list-inside space-y-1 pl-1">
                                        <li><strong>Bỏ qua hồ sơ trùng</strong>: Hệ thống sẽ loại bỏ các hồ sơ bị trùng/cảnh báo, chỉ nhập các hồ sơ hợp lệ hoàn toàn (<strong className="text-emerald-700">{importReport.validCount}</strong> hồ sơ) và <span className="text-rose-600 font-bold">tự động tải xuống file Excel chứa các hồ sơ bị bỏ qua</span> để bạn kiểm tra lại.</li>
                                        <li><strong>Ghi đè & Nhập tất cả</strong>: Cho phép nhập toàn bộ. Các hồ sơ trùng tuyệt đối (3 cột) sẽ được ghi đè, còn các hồ sơ trùng mã khác Tờ/Thửa vẫn được thêm mới bình thường.</li>
                                    </ul>
                                </div>
                            </div>
                        </div>

                        <div className="p-5 border-t border-slate-100 bg-slate-50 flex flex-col sm:flex-row gap-2.5">
                            <button
                                type="button"
                                onClick={() => {
                                    setShowImportConfirmModal(false);
                                    setTempImportedRecords([]);
                                }}
                                className="flex-1 py-2.5 border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-100 font-bold text-sm transition-all text-center cursor-pointer"
                            >
                                Hủy bỏ
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmImportWithSkip}
                                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                                Bỏ qua hồ sơ trùng
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmImportWithOverwrite}
                                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                                Ghi đè & Nhập tất cả
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Cài đặt số vào sổ - Modal */}
            {showSettingsModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[60] p-4 animate-fade-in">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm animate-scale-up text-slate-800 overflow-hidden border border-slate-100">
                        <div className="p-5 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                            <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                                <Settings size={18} className="text-indigo-500 animate-spin-slow" />
                                Cài đặt số vào sổ
                            </h3>
                            <button onClick={() => setShowSettingsModal(false)} className="text-slate-400 hover:text-red-500 hover:bg-slate-100 rounded-lg p-1 transition-all cursor-pointer"><X size={18}/></button>
                        </div>
                        <div className="p-6 space-y-4 text-left">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Số vào sổ hiện tại (phần số)</label>
                                <input 
                                    type="text" 
                                    className="w-full border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 font-bold text-slate-800 text-sm transition-all"
                                    value={currentBookNumber}
                                    onChange={(e) => setCurrentBookNumber(e.target.value)}
                                />
                            </div>
                            <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                                <p className="text-xs text-slate-500 leading-relaxed">
                                    Hệ thống sẽ tự động tăng số này và thêm tiền tố "CN" khi thực hiện vào số cho hồ sơ iGate.<br/>
                                    Ví dụ: Nếu nhập <strong className="text-slate-800">{currentBookNumber}</strong>, số tiếp theo sẽ là <strong className="text-indigo-600 font-bold">CN {incrementString(currentBookNumber)}</strong>.
                                </p>
                            </div>
                        </div>
                        <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-2.5">
                            <button 
                                onClick={() => setShowSettingsModal(false)}
                                className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-100 font-bold text-xs transition-all cursor-pointer"
                            >
                                Hủy bỏ
                            </button>
                            <button 
                                onClick={async () => {
                                    await saveSystemSetting('vaoso_current_book_number', currentBookNumber);
                                    setShowSettingsModal(false);
                                }} 
                                className="px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-bold text-xs shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
                            >
                                Lưu cài đặt
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* --- MODAL CÔNG CỤ PHÂN LOẠI HỒ SƠ QUA EXCEL --- */}
            {showExcelClassifyModal && (
                <div id="igate-excel-classify-modal" className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col animate-scale-up">
                        <div className="bg-gradient-to-r from-indigo-900 to-[#1E293B] p-5 text-white flex justify-between items-center">
                            <h3 className="font-bold flex items-center gap-2 text-base col-span-2">
                                <Tag size={18} className="text-indigo-400" />
                                Công cụ phân loại hồ sơ bằng Excel (8 loại trạng thái)
                            </h3>
                            <button 
                                onClick={() => {
                                    setShowExcelClassifyModal(false);
                                    setExcelMatchedRecords([]);
                                    setExcelSelectedIds(new Set());
                                    setExcelDuplicateCodes([]);
                                    setExcelMatchedRowsCount(0);
                                    setExcelFileName('');
                                    setExcelTotalScanned(0);
                                }} 
                                className="rounded-lg p-1 hover:bg-white/10 text-white transition-all cursor-pointer"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto space-y-5 flex-1">
                            {/* KHỐI CHỌN CÔNG CỤ (8 TRẠNG THÁI) */}
                            <div className="space-y-2 text-left">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Chọn công cụ cập nhật (1 trong 8 loại trạng thái phục vụ):</label>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                    {[
                                        "Đã chuyển thông tin thuế",
                                        "Đã phát hành thông báo thuế",
                                        "Đã thực hiện nghĩa vụ tài chính",
                                        "Chờ thực hiện nghĩa vụ tài chính",
                                        "Đã ký Giấy chứng nhận",
                                        "Chưa trả kết quả",
                                        "Đã trả kết quả",
                                        "Hồ sơ trả"
                                    ].map((status) => {
                                        const isActive = excelActiveToolStatus === status;
                                        return (
                                            <button
                                                key={status}
                                                type="button"
                                                onClick={() => setExcelActiveToolStatus(status)}
                                                className={`px-3 py-2.5 rounded-xl border text-xs font-bold transition-all text-center flex flex-col justify-center items-center gap-1 cursor-pointer ${
                                                    isActive 
                                                    ? "bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/15 scale-[1.02]" 
                                                    : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-350"
                                                }`}
                                            >
                                                <span className="truncate w-full">{status}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* KHỐI TẢI FILE EXCEL */}
                            <div className="border-2 border-dashed border-slate-200 hover:border-indigo-400 rounded-2xl p-5 text-center transition-all bg-slate-50 relative group">
                                <input 
                                    type="file" 
                                    ref={excelFileInputRef}
                                    onChange={handleExcelClassifySelect}
                                    accept=".xlsx, .xls"
                                    className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                                />
                                <div className="flex flex-col items-center justify-center space-y-2">
                                    <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl group-hover:scale-110 group-hover:bg-indigo-100 transition-all">
                                        <FileSpreadsheet size={24} />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-slate-700">Tải tệp danh sách mã hồ sơ cho công cụ "{excelActiveToolStatus}"</p>
                                        <p className="text-[11px] text-slate-400 mt-1">Yêu cầu tệp có 2 cột (Cột 1: Mã hồ sơ | Cột 2: Ngày trạng thái). Hệ thống sẽ tự động đối chiếu và cập nhật ngày trạng thái.</p>
                                    </div>
                                    {excelFileName && (
                                        <div className="mt-2.5 px-3 py-1.5 bg-emerald-50 text-emerald-800 rounded-xl text-xs font-bold border border-emerald-100 inline-flex items-center gap-1.5 max-w-full">
                                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                            <span className="truncate max-w-[250px]">{excelFileName}</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {excelTotalScanned > 0 && (
                                <div className="bg-indigo-50/50 border border-indigo-100/60 rounded-2xl p-4 flex items-center justify-between text-xs">
                                    <div className="space-y-0.5 text-left">
                                        <div className="text-slate-600">Đã quét thấy: <b className="text-slate-800 text-sm font-extrabold">{excelTotalScanned}</b> hàng trong Excel.</div>
                                        <div className="text-indigo-950 font-bold">
                                            Số lượng hồ sơ trùng khớp hệ thống: <span className="text-indigo-600 text-sm font-extrabold">{excelMatchedRecords.length}</span> / {records.length} hồ sơ độc nhất.
                                        </div>
                                        {excelMatchedRowsCount > excelMatchedRecords.length && (
                                            <div className="text-amber-700 font-bold mt-1 flex items-center gap-1 text-[11px]">
                                                <AlertTriangle size={13} className="shrink-0 text-amber-500 animate-pulse" />
                                                Có {excelMatchedRowsCount} dòng khớp thô ({excelMatchedRowsCount - excelMatchedRecords.length} dòng chứa mã bị trùng được gộp lại).
                                            </div>
                                        )}
                                    </div>
                                    {excelMatchedRecords.length > 0 && (
                                        <button 
                                            type="button"
                                            onClick={() => {
                                                if (excelSelectedIds.size === excelMatchedRecords.length) {
                                                    setExcelSelectedIds(new Set());
                                                } else {
                                                    setExcelSelectedIds(new Set(excelMatchedRecords.map(m => m.id)));
                                                }
                                            }}
                                            className="px-3 py-1.5 bg-white border border-slate-200 font-bold hover:bg-slate-100 text-slate-700 rounded-xl text-[11px] transition-all cursor-pointer shadow-xs"
                                        >
                                            {excelSelectedIds.size === excelMatchedRecords.length ? "Bỏ chọn tất cả" : "Chọn tất cả khớp"}
                                        </button>
                                    )}
                                </div>
                            )}

                            {/* Báo cáo hồ sơ bị trùng mã trong tệp Excel */}
                            {excelTotalScanned > 0 && excelDuplicateCodes.length > 0 && (
                                <div className="bg-amber-50/80 border border-amber-200/80 rounded-2xl p-4 space-y-2.5 text-xs text-left shadow-xs">
                                    <div className="flex items-center justify-between text-amber-900 font-extrabold border-b border-amber-200 pb-1.5 uppercase tracking-wide">
                                        <span className="flex items-center gap-1.5 text-[11px]">
                                            <AlertTriangle size={15} className="text-amber-600 shrink-0" />
                                            Báo cáo hồ sơ trùng mã trong tệp Excel ({excelDuplicateCodes.length} hồ sơ)
                                        </span>
                                        <span className="bg-amber-100/90 text-amber-800 px-2 py-0.5 rounded-md font-mono text-[10px]">
                                            Trùng lặp: {excelMatchedRowsCount - excelMatchedRecords.length} dòng
                                        </span>
                                    </div>
                                    <p className="text-slate-650 leading-relaxed font-semibold text-[11px]">
                                        Các mã hồ sơ dưới đây xuất hiện từ 2 lần trở lên trong tệp Excel. Để tránh lỗi nạp dữ liệu và đảm bảo tính nhất quán của cơ sở dữ liệu, hệ thống đã **tích hợp gộp** các thông tin và **giữ lại dòng cuối cùng** chứa thông tin mới nhất làm mốc chuẩn.
                                    </p>
                                    <div className="border border-amber-200/55 rounded-xl overflow-hidden max-h-[140px] overflow-y-auto bg-white/60">
                                        <table className="w-full text-left text-xs bg-white/20">
                                            <thead className="bg-amber-100/40 text-amber-900 font-bold text-[10px] uppercase border-b border-amber-200 sticky top-0">
                                                <tr>
                                                    <th className="p-2 w-1/3">Số hiệu / Mã</th>
                                                    <th className="p-2 w-1/3">Chủ hồ sơ</th>
                                                    <th className="p-2 text-center w-20">Số lần lặp</th>
                                                    <th className="p-2">Các dòng trong file Excel</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-amber-100/80 text-slate-700 font-medium">
                                                {excelDuplicateCodes.map((dup, i) => (
                                                    <tr key={i} className="hover:bg-amber-100/40 transition-colors">
                                                        <td className="p-2 font-mono font-bold text-amber-950 text-[11px]">{dup.code}</td>
                                                        <td className="p-2 text-slate-800 text-[11px]">{dup.chuHoSo}</td>
                                                        <td className="p-2 text-center text-amber-800 font-extrabold text-[11px] bg-amber-100/20">{dup.count} lần</td>
                                                        <td className="p-2 text-amber-900/80 font-mono text-[10px] italic">Dòng: {dup.rows.join(', ')}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                    <p className="text-[10px] text-amber-600/90 font-semibold italic">
                                        * LƯU Ý: Vui lòng kiểm tra lại tính nhất quán trong file Excel để chắc chắn bạn không áp dụng sai ngày trạng thái (ngày đã áp dụng sẽ được lấy theo dòng sau cùng).
                                    </p>
                                </div>
                            )}

                            {/* KHỐI 2: DANH SÁCH KHỚP ĐƯỢC */}
                            {excelMatchedRecords.length > 0 ? (
                                <div className="space-y-2 text-left">
                                    <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider block">Danh sách hồ sơ khớp ({excelSelectedIds.size}/{excelMatchedRecords.length})</h4>
                                    <div className="border border-slate-150 rounded-2xl overflow-hidden max-h-[180px] overflow-y-auto w-full">
                                        <table className="w-full text-left text-xs bg-white">
                                            <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-150 sticky top-0">
                                                <tr>
                                                    <th className="p-2.5 text-center w-10">Chọn</th>
                                                    <th className="p-2.5 font-sans">Số hiệu / Mã iGate</th>
                                                    <th className="p-2.5 font-sans">Chủ hồ sơ</th>
                                                    <th className="p-2.5 text-center font-sans">Trạng thái gốc</th>
                                                    <th className="p-2.5 text-center font-sans text-indigo-700">Ngày áp dụng (từ Excel)</th>
                                                    <th className="p-2.5 font-sans">Cán bộ phụ trách gốc</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                                                {excelMatchedRecords.map((r) => {
                                                    const isChecked = excelSelectedIds.has(r.id);
                                                    return (
                                                        <tr 
                                                            key={r.id} 
                                                            onClick={() => {
                                                                const nextChecked = new Set(excelSelectedIds);
                                                                if (isChecked) {
                                                                    nextChecked.delete(r.id);
                                                                } else {
                                                                    nextChecked.add(r.id);
                                                                }
                                                                setExcelSelectedIds(nextChecked);
                                                            }}
                                                            className={`hover:bg-slate-50 transition-colors cursor-pointer ${isChecked ? "bg-indigo-50/20" : ""}`}
                                                        >
                                                            <td className="p-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                                                                <input 
                                                                    type="checkbox" 
                                                                    checked={isChecked}
                                                                    className="w-3.5 h-3.5 rounded accent-indigo-600 cursor-pointer"
                                                                    onChange={() => {
                                                                        const nextChecked = new Set(excelSelectedIds);
                                                                        if (isChecked) {
                                                                            nextChecked.delete(r.id);
                                                                        } else {
                                                                            nextChecked.add(r.id);
                                                                        }
                                                                        setExcelSelectedIds(nextChecked);
                                                                    }}
                                                                />
                                                            </td>
                                                            <td className="p-2.5 font-mono font-bold text-slate-900">{r.soHieu}</td>
                                                            <td className="p-2.5 text-slate-800 font-semibold">{r.chuHoSo}</td>
                                                            <td className="p-2.5 text-center">
                                                                <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-150">{r.trangThaiGoc}</span>
                                                            </td>
                                                            <td className="p-2.5 font-semibold text-indigo-600 font-mono text-center bg-indigo-50/10">
                                                                {r.excelDate}
                                                            </td>
                                                            <td className="p-2.5 text-slate-500">{r.canBoXuLyGoc || "-"}</td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            ) : excelFileName ? (
                                <div className="p-8 text-center bg-amber-50 text-amber-800 border border-amber-150 rounded-2xl flex flex-col items-center">
                                    <AlertCircle size={32} className="text-amber-500 mb-2" />
                                    <p className="font-bold text-sm">Không tìm thấy bất kỳ hồ sơ trùng khớp nào!</p>
                                    <p className="text-[11px] text-slate-500 mt-1">Vui lòng kiểm tra lại cấu trúc mã hồ sơ trong file Excel xem có trùng khớp với số hồ sơ nào của hệ thống không.</p>
                                </div>
                            ) : null}

                            {/* KHỐI 3: THIẾT LẬP THAY ĐỔI */}
                            <form onSubmit={handleExcelClassifyApply} className="bg-indigo-50/20 p-4 border border-indigo-100/40 rounded-2xl space-y-4 text-left">
                                <h4 className="text-xs font-extrabold text-indigo-950 block border-b border-indigo-150 pb-1.5 uppercase tracking-wider">Cấu hình cập nhật cho hồ sơ được chọn</h4>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-bold text-slate-600 block">Trạng thái sẽ áp dụng</label>
                                        <div className="px-3.5 py-2.5 bg-indigo-600 text-white font-extrabold text-xs rounded-xl shadow-xs flex items-center gap-1.5 h-10">
                                            <CheckCircle2 size={14} />
                                            {excelActiveToolStatus}
                                        </div>
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-xs font-bold text-slate-600 block">Chọn nhân viên để áp dụng (Tùy chọn)</label>
                                        <select 
                                            className="w-full text-xs font-bold p-2.5 bg-white border border-slate-200 rounded-xl outline-none focus:border-indigo-500 transition-all text-slate-800 cursor-pointer h-10"
                                            value={excelCanBoUpdate}
                                            onChange={(e) => setExcelCanBoUpdate(e.target.value)}
                                        >
                                            <option value="">-- Giữ nguyên cán bộ cũ --</option>
                                            {dangKyCanBo.length > 0 && (
                                                <optgroup label="✨ Tổ Đăng ký">
                                                    {dangKyCanBo.map(cb => <option key={cb} value={cb}>{cb}</option>)}
                                                </optgroup>
                                            )}
                                            {oneDoorCanBo.length > 0 && (
                                                <optgroup label="🚪 Bộ phận Một cửa">
                                                    {oneDoorCanBo.map(cb => <option key={cb} value={cb}>{cb}</option>)}
                                                </optgroup>
                                            )}
                                        </select>
                                    </div>
                                </div>

                                {excelActiveToolStatus === 'Hồ sơ trả' && (
                                    <div className="space-y-1.5 bg-rose-50/50 p-3 rounded-xl border border-rose-100 animate-fade-in text-left">
                                        <label className="text-xs font-bold text-rose-900 block">
                                            Lý do trả hồ sơ <span className="text-red-500">*</span>
                                        </label>
                                        <textarea 
                                            rows={2}
                                            className="w-full text-xs font-semibold p-2.5 bg-white border border-rose-200 rounded-xl outline-none focus:border-rose-500 transition-all text-slate-850"
                                            placeholder="Ghi rõ lý do trả hồ sơ (thông tin này sẽ tự động ghi vào Ghi chú và Lý do trả của từng hồ sơ)..."
                                            value={excelLyDoTraUpdate || ''}
                                            onChange={(e) => setExcelLyDoTraUpdate(e.target.value)}
                                            required
                                        />
                                    </div>
                                )}

                                <div className="pt-3 border-t border-slate-150/60 flex items-center justify-end gap-3 text-sm">
                                    <button 
                                        type="button"
                                        onClick={() => {
                                            setShowExcelClassifyModal(false);
                                            setExcelMatchedRecords([]);
                                            setExcelSelectedIds(new Set());
                                            setExcelDuplicateCodes([]);
                                            setExcelMatchedRowsCount(0);
                                            setExcelFileName('');
                                            setExcelTotalScanned(0);
                                        }}
                                        className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
                                    >
                                        Hủy bỏ
                                    </button>
                                    <button 
                                        type="submit"
                                        disabled={excelSelectedIds.size === 0 || (excelActiveToolStatus === 'Hồ sơ trả' && !excelLyDoTraUpdate?.trim())}
                                        className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl text-xs transition-colors shadow-md shadow-indigo-600/10 cursor-pointer"
                                    >
                                        Áp dụng thay đổi ({excelSelectedIds.size} hồ sơ)
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}


            {/* --- MODAL PHÂN LOẠI HÀNG LOẠT --- */}
            {isBatchModalOpen && (
                <div id="igate-batch-modal" className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden flex flex-col animate-scale-up">
                        <div className="bg-gradient-to-r from-indigo-900 to-[#1E293B] p-5 text-white flex justify-between items-center">
                            <h3 className="font-bold flex items-center gap-2 text-base">
                                <Tag size={18} />
                                Phân loại {selectedIds.size} hồ sơ đã chọn
                            </h3>
                            <button onClick={() => setIsBatchModalOpen(false)} className="rounded-lg p-1 hover:bg-white/10 text-white transition-all"><X size={18} /></button>
                        </div>
                        
                        <form onSubmit={handleBatchClassifySubmit} className="p-6 space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-slate-600 block">Trạng thái hồ sơ mới</label>
                                <select 
                                    className="w-full text-sm font-semibold p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-indigo-500 transition-all text-slate-800 cursor-pointer"
                                    value={batchStatus}
                                    onChange={(e) => setBatchStatus(e.target.value)}
                                >
                                    <option value="">-- Giữ nguyên trạng thái cũ --</option>
                                    {TRANG_THAI_LIST.map(st => <option key={st} value={st}>{st}</option>)}
                                </select>
                            </div>

                            {/* Trường chọn ngày gán cho trạng thái mới từ Đã chuyển thông tin thuế trở đi */}
                            {batchStatus && [
                                "Đã chuyển thông tin thuế",
                                "Đã phát hành thông báo thuế",
                                "Chờ thực hiện nghĩa vụ tài chính",
                                "Đã ký Giấy chứng nhận",
                                "Chưa trả kết quả",
                                "Đã trả kết quả"
                            ].includes(batchStatus) && (
                                <div className="space-y-1.5 animate-fade-in bg-slate-50 border border-slate-150 p-3 rounded-xl">
                                    <label className="text-xs font-bold text-indigo-900 block">Ngày áp dụng cho [{batchStatus}]</label>
                                    <div className="flex gap-1 items-center mt-1">
                                        <input 
                                            type="text" 
                                            placeholder="Ví dụ: 28/11/2025"
                                            className="w-full text-xs p-2 bg-white border border-slate-200 rounded-lg outline-none text-slate-800 font-semibold focus:border-indigo-500 transition-all"
                                            value={batchDate}
                                            onChange={(e) => setBatchDate(e.target.value)}
                                        />
                                        <div className="relative shrink-0 w-8 h-8 flex items-center justify-center">
                                            <input 
                                                type="date"
                                                className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-10"
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    if (val) {
                                                        const parts = val.split('-');
                                                        const formatted = `${parts[2]}/${parts[1]}/${parts[0]}`;
                                                        setBatchDate(formatted);
                                                    }
                                                }}
                                            />
                                            <button type="button" className="w-full h-full p-2 bg-slate-100 border border-slate-200 hover:bg-slate-200 text-slate-600 rounded-lg flex items-center justify-center transition-all" title="Chọn ngày">
                                                <Calendar size={14} />
                                            </button>
                                        </div>
                                    </div>
                                    <p className="text-[10px] text-slate-400 mt-1">Bỏ trống nếu muốn giữ nguyên ngày hiện tại của hồ sơ.</p>
                                </div>
                            )}

                            {batchStatus === 'Hồ sơ trả' && (
                                <div className="space-y-3 bg-rose-50/50 border border-rose-200/60 rounded-xl p-3.5 animate-fade-in text-left">
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-rose-900 block flex items-center gap-1.5">
                                            <Calendar size={13} className="text-rose-600" />
                                            <span>Ngày trả hồ sơ <span className="text-red-500">*</span></span>
                                        </label>
                                        <div className="flex gap-2 items-center">
                                            <input 
                                                type="text" 
                                                placeholder="Ví dụ: 26/11/2025"
                                                className="w-full text-xs p-2 bg-white border border-rose-200 rounded-lg outline-none text-rose-900 font-bold focus:border-rose-500 transition-all"
                                                value={batchDate}
                                                onChange={(e) => setBatchDate(e.target.value)}
                                                required
                                            />
                                            <div className="relative shrink-0 w-8 h-8 flex items-center justify-center">
                                                <input 
                                                    type="date"
                                                    className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-10"
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        if (val) {
                                                            const parts = val.split('-');
                                                            const formatted = `${parts[2]}/${parts[1]}/${parts[0]}`;
                                                            setBatchDate(formatted);
                                                        }
                                                    }}
                                                />
                                                <button type="button" className="w-full h-full p-1.5 bg-rose-100 hover:bg-rose-200 text-rose-700 border border-rose-200 rounded-lg flex items-center justify-center transition-all" title="Chọn ngày">
                                                    <Calendar size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-rose-900 block">Lý do trả hồ sơ <span className="text-red-500">*</span></label>
                                        <textarea 
                                            rows={2}
                                            className="w-full text-xs font-semibold p-2.5 bg-white border border-rose-200 rounded-lg outline-none focus:border-rose-500 transition-all text-slate-850"
                                            placeholder="Ghi rõ lý do trả hồ sơ (thông tin này sẽ tự động ghi vào Ghi chú)..."
                                            value={batchLyDoTra}
                                            onChange={(e) => setBatchLyDoTra(e.target.value)}
                                            required
                                        />
                                    </div>
                                </div>
                            )}

                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-slate-600 block">Cán bộ xử lý mới</label>
                                <select 
                                    className="w-full text-sm font-semibold p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-indigo-500 transition-all text-slate-800 cursor-pointer"
                                    value={batchCanBo}
                                    onChange={(e) => setBatchCanBo(e.target.value)}
                                >
                                    <option value="">-- Giữ nguyên cán bộ cũ --</option>
                                    
                                    {dangKyCanBo.length > 0 && (
                                        <optgroup label="✨ Tổ Đăng ký">
                                            {dangKyCanBo.map(cb => <option key={cb} value={cb}>{cb}</option>)}
                                        </optgroup>
                                    )}
                                    
                                    {oneDoorCanBo.length > 0 && (
                                        <optgroup label="🚪 Bộ phận Một cửa">
                                            {oneDoorCanBo.map(cb => <option key={cb} value={cb}>{cb}</option>)}
                                        </optgroup>
                                    )}
                                </select>
                            </div>

                            <div className="bg-amber-50 border border-amber-200/60 rounded-xl p-3 flex gap-2.5 text-xs text-amber-800 leading-relaxed">
                                <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                                <div>
                                    <p className="font-bold mb-0.5">Lưu ý thao tác hàng loạt:</p>
                                    <p>Các trường chọn <b>"Giữ nguyên..."</b> sẽ không làm thay đổi giá trị hiện tại của các hồ sơ tương ứng.</p>
                                </div>
                            </div>

                            <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100">
                                <button 
                                    type="button"
                                    onClick={() => setIsBatchModalOpen(false)}
                                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-all"
                                >
                                    Hủy bỏ
                                </button>
                                <button 
                                    type="submit"
                                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition-all shadow-md shadow-indigo-600/10"
                                >
                                    Áp dụng phân loại
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* --- MODAL FORM THÊM MỚI / CHỈNH SỬA --- */}
            {isFormOpen && (
                <div id="igate-form-modal" className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col animate-scale-up">
                        <div className="bg-gradient-to-r from-indigo-900 to-[#1E293B] p-5 text-white flex justify-between items-center">
                            <h3 className="font-bold flex items-center gap-2">
                                <Building size={20} />
                                {editingRecord ? `Chỉnh sửa hồ sơ iGate: ${editingRecord.soHieu}` : 'Thêm mới Hồ sơ iGate'}
                            </h3>
                            <button onClick={() => setIsFormOpen(false)} className="rounded-lg p-1 hover:bg-white/10 text-white transition-all"><X size={18} /></button>
                        </div>
                        
                        <form onSubmit={handleFormSubmit} className="p-6 overflow-y-auto space-y-5 flex-1">
                            {/* KHỐI 1: THÔNG TIN HỒ SƠ & CHỦ SỬ DỤNG */}
                            <div className="bg-slate-50/50 p-4 border border-slate-200/60 rounded-2xl space-y-4">
                                <h4 className="text-[11px] uppercase tracking-wider font-extrabold text-slate-500">I. Thông tin hồ sơ & Chủ sử dụng</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-600 block">Mã hồ sơ <span className="text-red-500">*</span></label>
                                        <input 
                                            type="text" 
                                            className="w-full text-sm font-semibold p-2.5 bg-white border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 transition-all text-slate-800"
                                            placeholder="Ví dụ: HSPT-2026-00104"
                                            value={formData.soHieu}
                                            onChange={(e) => setFormData(prev => ({ ...prev, soHieu: e.target.value }))}
                                            required
                                        />
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-600 block">CHỦ SỬ DỤNG <span className="text-red-500">*</span></label>
                                        <input 
                                            type="text" 
                                            className="w-full text-sm font-semibold p-2.5 bg-white border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 transition-all text-slate-800"
                                            placeholder="Ví dụ: Nguyễn Văn Hải"
                                            value={formData.chuHoSo}
                                            onChange={(e) => setFormData(prev => ({ ...prev, chuHoSo: e.target.value }))}
                                            required
                                        />
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-600 block">Số điện thoại liên lạc</label>
                                        <input 
                                            type="text" 
                                            className="w-full text-sm font-semibold p-2.5 bg-white border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 transition-all text-slate-800"
                                            placeholder="SĐT di động..."
                                            value={formData.soDienThoai}
                                            onChange={(e) => setFormData(prev => ({ ...prev, soDienThoai: e.target.value }))}
                                        />
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-600 block">CCCD chủ sử dụng</label>
                                        <input 
                                            type="text" 
                                            className="w-full text-sm font-semibold p-2.5 bg-white border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 transition-all text-slate-800"
                                            placeholder="Số CCCD..."
                                            value={formData.cccd || ''}
                                            onChange={(e) => setFormData(prev => ({ ...prev, cccd: e.target.value }))}
                                        />
                                    </div>

                                    <div className="space-y-1 md:col-span-2">
                                        <label className="text-xs font-bold text-slate-600 block">Loại biến động <span className="text-red-500">*</span></label>
                                        <textarea 
                                            rows={2}
                                            className="w-full text-sm font-semibold p-2.5 bg-white border border-slate-200 rounded-xl outline-none focus:border-indigo-500 transition-all text-slate-850"
                                            placeholder="Ví dụ: Chuyển nhượng quyền sử dụng đất..."
                                            value={formData.tenThuTuc}
                                            onChange={(e) => setFormData(prev => ({ ...prev, tenThuTuc: e.target.value }))}
                                            required
                                        />
                                    </div>

                                    <div className="space-y-1 md:col-span-2">
                                        <label className="text-xs font-bold text-slate-600 block">CHUYỂN QUYỀN</label>
                                        <input 
                                            type="text" 
                                            className="w-full text-sm font-semibold p-2.5 bg-white border border-slate-200 rounded-xl outline-none focus:border-indigo-500 transition-all text-slate-800"
                                            placeholder="Ví dụ: Chuyển quyền sử dụng đất, tặng cho, thừa kế..."
                                            value={formData.chuyenQuyen || ''}
                                            onChange={(e) => setFormData(prev => ({ ...prev, chuyenQuyen: e.target.value }))}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* KHỐI 2: THÔNG TIN THỬA ĐẤT (BỔ SUNG) */}
                            <div className="bg-slate-50/50 p-4 border border-slate-200/60 rounded-2xl space-y-4">
                                <h4 className="text-[11px] uppercase tracking-wider font-extrabold text-slate-500">II. Chi tiết thửa đất & Diện tích</h4>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-600 block">Số tờ bản đồ</label>
                                        <input 
                                            type="text" 
                                            className="w-full text-sm font-semibold p-2.5 bg-white border border-slate-200 rounded-xl outline-none text-slate-800"
                                            placeholder="Tờ số..."
                                            value={formData.soTo || ''}
                                            onChange={(e) => setFormData(prev => ({ ...prev, soTo: e.target.value }))}
                                        />
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-600 block">Số thửa đất</label>
                                        <input 
                                            type="text" 
                                            className="w-full text-sm font-semibold p-2.5 bg-white border border-slate-200 rounded-xl outline-none text-slate-800"
                                            placeholder="Thửa số..."
                                            value={formData.soThua || ''}
                                            onChange={(e) => setFormData(prev => ({ ...prev, soThua: e.target.value }))}
                                        />
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-600 block">Số phát hành GCN</label>
                                        <input 
                                            type="text" 
                                            className="w-full text-sm font-semibold p-2.5 bg-white border border-slate-200 rounded-xl outline-none text-slate-800"
                                            placeholder="Số phát hành..."
                                            value={formData.soPhatHanh || ''}
                                            onChange={(e) => setFormData(prev => ({ ...prev, soPhatHanh: e.target.value }))}
                                        />
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-600 block">Tổng diện tích (m²)</label>
                                        <input 
                                            type="number" 
                                            step="any"
                                            className="w-full text-sm font-semibold p-2.5 bg-white border border-slate-200 rounded-xl outline-none text-slate-850"
                                            placeholder="Ví dụ: 300"
                                            value={formData.tongDienTich !== null ? formData.tongDienTich : ''}
                                            onChange={(e) => {
                                                const val = e.target.value === '' ? null : Number(e.target.value);
                                                setFormData(prev => ({ ...prev, tongDienTich: val }));
                                            }}
                                        />
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-600 block">Diện tích Đất ở (m²)</label>
                                        <input 
                                            type="number" 
                                            step="any"
                                            className="w-full text-sm font-semibold p-2.5 bg-white border border-slate-200 rounded-xl outline-none text-slate-850"
                                            placeholder="Ví dụ: 100"
                                            value={formData.dienTichDatO !== null ? formData.dienTichDatO : ''}
                                            onChange={(e) => {
                                                const val = e.target.value === '' ? null : Number(e.target.value);
                                                setFormData(prev => ({ ...prev, dienTichDatO: val }));
                                            }}
                                        />
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-600 block">Đất nông nghiệp (Tự động)</label>
                                        <div className="w-full text-sm font-bold p-2.5 bg-slate-100 border border-slate-200 rounded-xl text-slate-600">
                                            {(() => {
                                                const tot = Number(formData.tongDienTich || 0);
                                                const o = Number(formData.dienTichDatO || 0);
                                                const nông = tot > 0 ? (tot - o) : 0;
                                                return tot > 0 ? `${nông.toLocaleString('vi-VN')} m²` : '- m²';
                                            })()}
                                        </div>
                                    </div>

                                    <div className="space-y-1 md:col-span-3">
                                        <label className="text-xs font-bold text-slate-600 block">Địa danh thửa đất</label>
                                        <input 
                                            type="text" 
                                            className="w-full text-sm font-semibold p-2.5 bg-white border border-slate-200 rounded-xl outline-none text-slate-800"
                                            placeholder="Địa danh, địa chỉ thửa vị trí thửa đất..."
                                            value={formData.diaDanh || ''}
                                            onChange={(e) => setFormData(prev => ({ ...prev, diaDanh: e.target.value }))}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* KHỐI 3: QUẢN LÝ THỜI HẠN, TIẾN ĐỘ & CÁN BỘ */}
                            <div className="bg-slate-50/50 p-4 border border-slate-200/60 rounded-2xl space-y-4">
                                <h4 className="text-[11px] uppercase tracking-wider font-extrabold text-slate-500">III. Quản lý thời hạn & Quy trình xử lý</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-1 md:col-span-2">
                                        <label className="text-xs font-bold text-slate-600 block">Thời hạn sử dụng đất nông nghiệp</label>
                                        <input 
                                            type="text" 
                                            className="w-full text-sm font-semibold p-2.5 bg-white border border-slate-200 rounded-xl outline-none text-slate-800"
                                            placeholder="Ví dụ: 50 năm, Hoặc điền mốc ngày cụ thể... "
                                            value={formData.thoiHanSuDung || ''}
                                            onChange={(e) => setFormData(prev => ({ ...prev, thoiHanSuDung: e.target.value }))}
                                        />
                                        {Number(formData.dienTichDatO || 0) > 0 && (
                                            <div className="text-[10px] text-indigo-700 font-bold bg-indigo-50 p-2 rounded-lg mt-1.5 border border-indigo-100">
                                                💡 Có diện tích đất thổ cư (&gt;0 m²): Thời hạn sử dụng của <b>đất ở</b> tự động là <b>Lâu dài</b>. Thời hạn sử dụng ở trên được áp dụng riêng cho <b>đất nông nghiệp</b>.
                                            </div>
                                        )}
                                    </div>
                                    
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-600 block">Tên lĩnh vực</label>
                                        <select 
                                            className="w-full text-sm font-semibold p-2.5 bg-white border border-slate-200 rounded-xl outline-none text-slate-800"
                                            value={formData.tenLinhVuc}
                                            onChange={(e) => setFormData(prev => ({ ...prev, tenLinhVuc: e.target.value }))}
                                        >
                                            {LINH_VUC_LIST.map(v => <option key={v} value={v}>{v}</option>)}
                                        </select>
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-600 block">Trạng thái hồ sơ iGate</label>
                                        <select 
                                            className="w-full text-sm font-semibold p-2.5 bg-white border border-slate-200 rounded-xl outline-none text-indigo-900 bg-indigo-50 font-bold"
                                            value={formData.trangThai}
                                            onChange={(e) => {
                                                const newStatus = e.target.value;
                                                setFormData(prev => ({ 
                                                    ...prev, 
                                                    trangThai: newStatus,
                                                    ngayKetThuc: newStatus !== 'Mới tiếp nhận' && !prev.ngayKetThuc ? getTodayString() : prev.ngayKetThuc
                                                }));
                                            }}
                                        >
                                            {TRANG_THAI_LIST.map(t => <option key={t} value={t}>{t}</option>)}
                                        </select>
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-600 block">Ngày nhận hồ sơ</label>
                                        <div className="flex gap-1 items-center">
                                            <input 
                                                type="text" 
                                                placeholder="Ví dụ: 21/06/2026"
                                                className="w-full text-sm p-2 bg-white border border-slate-200 rounded-xl outline-none text-slate-850 font-semibold"
                                                value={formData.ngayTiepNhan}
                                                onChange={(e) => setFormData(prev => ({ ...prev, ngayTiepNhan: e.target.value }))}
                                            />
                                            <div className="relative shrink-0 w-9 h-9 flex items-center justify-center">
                                                <input 
                                                    type="date"
                                                    className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-10"
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        if (val) {
                                                            const parts = val.split('-');
                                                            const formatted = `${parts[2]}/${parts[1]}/${parts[0]}`;
                                                            setFormData(prev => ({ ...prev, ngayTiepNhan: formatted }));
                                                        }
                                                    }}
                                                />
                                                <button type="button" className="w-full h-full p-2 bg-slate-100 border border-slate-200 hover:bg-slate-200 text-slate-600 rounded-xl flex items-center justify-center transition-all" title="Chọn ngày">
                                                    <Calendar size={15} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-600 block">Ngày trả kết quả</label>
                                        <div className="flex gap-1 items-center">
                                            <input 
                                                type="text" 
                                                placeholder="Ví dụ: 28/06/2026"
                                                className="w-full text-sm p-2 bg-white border border-slate-200 rounded-xl outline-none text-slate-850 font-semibold"
                                                value={formData.ngayHenTra}
                                                onChange={(e) => setFormData(prev => ({ ...prev, ngayHenTra: e.target.value }))}
                                            />
                                            <div className="relative shrink-0 w-9 h-9 flex items-center justify-center">
                                                <input 
                                                    type="date"
                                                    className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-10"
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        if (val) {
                                                            const parts = val.split('-');
                                                            const formatted = `${parts[2]}/${parts[1]}/${parts[0]}`;
                                                            setFormData(prev => ({ ...prev, ngayHenTra: formatted }));
                                                        }
                                                    }}
                                                />
                                                <button type="button" className="w-full h-full p-2 bg-slate-100 border border-slate-200 hover:bg-slate-200 text-slate-600 rounded-xl flex items-center justify-center transition-all" title="Chọn ngày">
                                                    <Calendar size={15} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {formData.trangThai !== 'Mới tiếp nhận' && (
                                    <div className="bg-indigo-50/40 border border-indigo-100 rounded-2xl p-4 space-y-2 animate-fade-in text-left">
                                        <label className="text-xs font-extrabold text-indigo-950 block flex items-center gap-1.5">
                                            <Calendar size={14} className="text-indigo-600" />
                                            <span>Ngày áp dụng cho trạng thái [{formData.trangThai}] <span className="text-red-500">*</span></span>
                                        </label>
                                        <div className="flex gap-2 items-center">
                                            <input 
                                                type="text" 
                                                placeholder="Ví dụ: 26/11/2025"
                                                className="w-full text-sm p-3 bg-white border border-slate-200 rounded-xl outline-none text-slate-800 font-bold focus:border-indigo-500 transition-all"
                                                value={formData.ngayKetThuc}
                                                onChange={(e) => setFormData(prev => ({ ...prev, ngayKetThuc: e.target.value }))}
                                                required
                                            />
                                            <div className="relative shrink-0 w-11 h-11 flex items-center justify-center">
                                                <input 
                                                    type="date"
                                                    className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-10"
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        if (val) {
                                                            const parts = val.split('-');
                                                            const formatted = `${parts[2]}/${parts[1]}/${parts[0]}`;
                                                            setFormData(prev => ({ ...prev, ngayKetThuc: formatted }));
                                                        }
                                                    }}
                                                />
                                                <button type="button" className="w-full h-full p-2 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 border border-indigo-200 rounded-xl flex items-center justify-center transition-all" title="Chọn ngày">
                                                    <Calendar size={16} />
                                                </button>
                                            </div>
                                        </div>
                                        <p className="text-[10px] text-indigo-600 font-semibold italic">
                                            * Phục vụ cho mục đích thống kê tiến độ từng trạng thái hồ sơ iGate.
                                        </p>
                                    </div>
                                )}



                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-600 block">Cơ quan/đơn vị xử lý</label>
                                        <input 
                                            type="text" 
                                            className="w-full text-sm font-semibold p-2.5 bg-white border border-slate-200 rounded-xl outline-none text-slate-800"
                                            value={formData.donVi}
                                            onChange={(e) => setFormData(prev => ({ ...prev, donVi: e.target.value }))}
                                        />
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-600 block">Cán bộ thụ lý hiện tại</label>
                                        <select 
                                            className="w-full text-sm font-semibold p-2.5 bg-white border border-slate-200 rounded-xl outline-none text-slate-800"
                                            value={formData.canBoXuLy}
                                            onChange={(e) => setFormData(prev => ({ ...prev, canBoXuLy: e.target.value }))}
                                        >
                                            <option value="">Chưa giao cán bộ xử lý</option>
                                            {canBoList.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                    </div>

                                    <div className="space-y-1 md:col-span-2">
                                        <label className="text-xs font-bold text-slate-600 block">GHI CHÚ</label>
                                        <textarea 
                                            rows={2}
                                            className="w-full text-sm font-semibold p-2.5 bg-white border border-slate-200 rounded-xl outline-none focus:border-indigo-500 transition-all text-slate-850"
                                            placeholder="Ghi chú thêm về thửa đất hoặc quy trình..."
                                            value={formData.ghiChu || ''}
                                            onChange={(e) => setFormData(prev => ({ ...prev, ghiChu: e.target.value }))}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="pt-4 border-t border-slate-150 flex justify-end gap-2.5">
                                <button 
                                    type="button" 
                                    onClick={() => setIsFormOpen(false)}
                                    className="px-4 py-2 text-slate-550 hover:bg-slate-100 rounded-xl text-sm font-bold transition-all"
                                >
                                    Đóng
                                </button>
                                <button 
                                    type="submit"
                                    className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold transition-all shadow-md shadow-indigo-600/10"
                                >
                                    Lưu hồ sơ
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* --- MODAL XEM CHI TIẾT HỒ SƠ --- */}
            {viewingRecord && (
                <div id="igate-view-detail-modal" className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full overflow-hidden flex flex-col animate-scale-up">
                        <div className="bg-gradient-to-r from-slate-900 via-[#1E293B] to-slate-800 p-5 text-white flex justify-between items-center">
                            <h3 className="font-bold flex items-center gap-2 text-base">
                                <BookOpen size={18} className="text-indigo-400" />
                                Chi tiết hồ sơ: <span className="font-mono text-indigo-300 font-extrabold">{viewingRecord.soHieu}</span>
                            </h3>
                            <button onClick={() => setViewingRecord(null)} className="rounded-lg p-1 hover:bg-white/10 text-white transition-all cursor-pointer"><X size={18} /></button>
                        </div>
                        
                        <div className="p-6 overflow-y-auto max-h-[75vh] space-y-5 text-left">
                            {/* Khối Trạng thái to làm điểm nhấn */}
                            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div>
                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Trạng thái hồ sơ</span>
                                    <span className={`inline-flex px-3.5 py-1.5 rounded-full text-xs font-bold border ${(() => {
                                        let b = "bg-slate-100 text-slate-700 border-slate-200";
                                        if (viewingRecord.trangThai === 'Mới tiếp nhận') b = "bg-sky-50 text-sky-700 border-sky-100";
                                        else if (viewingRecord.trangThai === 'Đã chuyển thông tin thuế') b = "bg-orange-50 text-orange-600 border-orange-100";
                                        else if (viewingRecord.trangThai === 'Đã phát hành thông báo thuế') b = "bg-amber-100 text-amber-800 border-amber-200";
                                        else if (viewingRecord.trangThai === 'Đã thực hiện nghĩa vụ tài chính') b = "bg-emerald-100 text-emerald-800 border-emerald-200";
                                        else if (viewingRecord.trangThai === 'Chờ thực hiện nghĩa vụ tài chính') b = "bg-orange-150 text-orange-850 border-orange-200";
                                        else if (viewingRecord.trangThai === 'Đã ký Giấy chứng nhận') b = "bg-teal-50 text-teal-700 border-teal-150";
                                        else if (viewingRecord.trangThai === 'Chưa trả kết quả') b = "bg-yellow-50 text-yellow-800 border-yellow-200";
                                        else if (viewingRecord.trangThai === 'Đã trả kết quả') b = "bg-emerald-50 text-emerald-700 border-emerald-100";
                                        return b;
                                    })()}`}>
                                        {viewingRecord.trangThai}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Cán bộ phụ trách</span>
                                    <span className="text-sm font-bold text-slate-800 flex items-center gap-1.5 font-sans">
                                        <UserIcon size={14} className="text-slate-400" />
                                        {viewingRecord.canBoXuLy || 'Chưa giao cán bộ xử lý'}
                                    </span>
                                </div>
                                {(() => {
                                    const henTraDate = parseToDateObject(viewingRecord.ngayHenTra);
                                    const isOverdue = viewingRecord.trangThai !== 'Đã trả kết quả' && henTraDate && new Date() > henTraDate;
                                    if (isOverdue) {
                                        return (
                                            <div className="bg-red-50 border border-red-200 text-red-800 px-3 py-1.5 rounded-xl text-xs font-bold animate-pulse flex items-center gap-1.5">
                                                <AlertTriangle size={14} className="text-red-500 shrink-0" />
                                                <span>Trễ hẹn xử lý</span>
                                            </div>
                                        );
                                    }
                                    return null;
                                })()}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
                                {/* Cột Trái: Thông tin hành chính */}
                                <div className="space-y-4">
                                    <h4 className="text-xs font-extrabold text-blue-900 border-b border-slate-100 pb-1.5 uppercase tracking-wider">Thông tin hành chính</h4>
                                    
                                    <div>
                                        <span className="text-[10px] font-bold text-slate-400 block">CHỦ SỬ DỤNG</span>
                                        <span className="text-sm font-bold text-slate-850 uppercase">{viewingRecord.chuHoSo}</span>
                                    </div>
                                    <div>
                                        <span className="text-[10px] font-bold text-slate-400 block">SỐ CCCD</span>
                                        <span className="text-sm font-mono font-bold text-slate-800">{viewingRecord.cccd || 'Không cung cấp'}</span>
                                    </div>
                                    <div>
                                        <span className="text-[10px] font-bold text-slate-400 block">SỐ ĐIỆN THOẠI</span>
                                        <span className="text-sm font-mono font-bold text-slate-800">{viewingRecord.soDienThoai || 'Không cung cấp'}</span>
                                    </div>
                                    <div>
                                        <span className="text-[10px] font-bold text-slate-400 block">LĨNH VỰC HỒ SƠ</span>
                                        <span className="text-sm font-semibold text-slate-800">{viewingRecord.tenLinhVuc || 'Quản lý đất đai'}</span>
                                    </div>
                                    <div>
                                        <span className="text-[10px] font-bold text-slate-400 block">LOẠI BIẾN ĐỘNG</span>
                                        <span className="text-xs font-semibold text-slate-700 leading-snug block">{viewingRecord.tenThuTuc}</span>
                                    </div>
                                </div>

                                {/* Cột Giữa: Thửa đất & Địa chính */}
                                <div className="space-y-4 bg-slate-50/50 p-4 rounded-2xl border border-slate-150">
                                    <h4 className="text-xs font-extrabold text-emerald-950 border-b border-emerald-200 pb-1.5 uppercase tracking-wider">Thửa đất & Địa chính</h4>
                                    
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <span className="text-[10px] font-bold text-slate-400 block">SỐ TỜ</span>
                                            <span className="text-sm font-extrabold text-indigo-900">{viewingRecord.soTo || '-'}</span>
                                        </div>
                                        <div>
                                            <span className="text-[10px] font-bold text-slate-400 block">SỐ THỬA</span>
                                            <span className="text-sm font-extrabold text-indigo-900">{viewingRecord.soThua || '-'}</span>
                                        </div>
                                    </div>
                                    <div>
                                        <span className="text-[10px] font-bold text-slate-400 block">TỔNG DIỆN TÍCH</span>
                                        <span className="text-sm font-extrabold text-slate-800">{viewingRecord.tongDienTich !== null && viewingRecord.tongDienTich !== undefined ? `${viewingRecord.tongDienTich.toLocaleString('vi-VN')} m²` : 'Không xác định'}</span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <span className="text-[10px] font-bold text-slate-400 block">ĐẤT Ở</span>
                                            <span className="text-xs font-bold text-orange-700">{viewingRecord.dienTichDatO !== null && viewingRecord.dienTichDatO !== undefined ? `${viewingRecord.dienTichDatO.toLocaleString('vi-VN')} m²` : '-'}</span>
                                        </div>
                                        <div>
                                            <span className="text-[10px] font-bold text-slate-400 block">ĐẤT NÔNG NGHIỆP</span>
                                            <span className="text-xs font-bold text-emerald-700 font-mono">
                                                {(() => {
                                                    const tot = Number(viewingRecord.tongDienTich || 0);
                                                    const o = Number(viewingRecord.dienTichDatO || 0);
                                                    const nong = tot > 0 ? (tot - o) : 0;
                                                    return tot > 0 ? `${nong.toLocaleString('vi-VN')} m²` : '-';
                                                })()}
                                            </span>
                                        </div>
                                    </div>
                                    <div>
                                        <span className="text-[10px] font-bold text-slate-400 block">ĐỊA DANH THỬA ĐẤT</span>
                                        <span className="text-xs font-bold text-slate-700 block max-h-[44px] overflow-y-auto" title={viewingRecord.diaDanh}>{viewingRecord.diaDanh || '-'}</span>
                                    </div>
                                    <div>
                                        <span className="text-[10px] font-bold text-slate-400 block">CHUYỂN QUYỀN</span>
                                        <span className="text-xs font-semibold text-slate-600 block">{viewingRecord.chuyenQuyen || '-'}</span>
                                    </div>
                                    <div>
                                        <span className="text-[10px] font-bold text-slate-400 block">SỐ PHÁT HÀNH</span>
                                        <span className="text-xs font-mono font-bold text-slate-700 block">{viewingRecord.soPhatHanh || '-'}</span>
                                    </div>
                                    <div>
                                        <span className="text-[10px] font-bold text-slate-400 block">THỜI HẠN SỬ DỤNG</span>
                                        <div className="text-[11px] leading-tight flex flex-col mt-0.5">
                                            {Number(viewingRecord.dienTichDatO || 0) > 0 && (
                                                <span className="text-indigo-800 font-bold">Đất ở: Lâu dài</span>
                                            )}
                                            <span className="text-slate-500 font-semibold">Đất NN: {formatThoiHanSuDung(viewingRecord.thoiHanSuDung)}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Cột Phải: Lịch trình & Tiến độ */}
                                <div className="space-y-4">
                                    <h4 className="text-xs font-extrabold text-indigo-900 border-b border-slate-100 pb-1.5 uppercase tracking-wider">Lịch trình & Tiến độ</h4>
                                    
                                    <div>
                                        <span className="text-[10px] font-bold text-slate-400 block">CƠ QUAN THỰC HIỆN</span>
                                        <span className="text-sm font-semibold text-slate-800">{viewingRecord.donVi}</span>
                                    </div>
                                    <div>
                                        <span className="text-[10px] font-bold text-indigo-600 block">NGÀY TIẾP NHẬN BẢN GỐC</span>
                                        <span className="text-sm font-mono font-bold text-indigo-950 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-lg w-fit block mt-0.5">{formatDisplayDateInClient(viewingRecord.ngayTiepNhan) || '-'}</span>
                                    </div>
                                    <div>
                                        <span className="text-[10px] font-bold text-orange-600 block">NGÀY HẸN TRẢ DỰ KIẾN</span>
                                        <span className="text-sm font-mono font-bold text-orange-950 bg-orange-50 border border-orange-100 px-2 py-0.5 rounded-lg w-fit block mt-0.5">{formatDisplayDateInClient(viewingRecord.ngayHenTra) || 'Chưa lập giấy hẹn'}</span>
                                    </div>
                                    <div>
                                        <span className="text-[10px] font-bold text-emerald-600 block">NGÀY HOÀN THÀNH (ĐÃ TRẢ KẾT QUẢ)</span>
                                        <span className="text-sm font-mono font-bold text-emerald-950 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-lg w-fit block mt-0.5">
                                            {viewingRecord.trangThai === 'Đã trả kết quả' ? (formatDisplayDateInClient(viewingRecord.ngayKetThuc) || '-') : 'Chưa hoàn tất trả kết quả'}
                                        </span>
                                    </div>
                                    {viewingRecord.trangThai !== 'Mới tiếp nhận' && viewingRecord.trangThai !== 'Đã trả kết quả' && viewingRecord.trangThai !== 'Hồ sơ trả' && (
                                        <div>
                                            <span className="text-[10px] font-bold text-indigo-600 block uppercase">NGÀY ĐẠT TRẠNG THÁI: {viewingRecord.trangThai}</span>
                                            <span className="text-sm font-mono font-bold text-indigo-950 bg-indigo-50 border border-indigo-150 px-2 py-0.5 rounded-lg w-fit block mt-0.5">
                                                {formatDisplayDateInClient(viewingRecord.ngayKetThuc) || 'Chưa cập nhật ngày'}
                                            </span>
                                        </div>
                                    )}
                                    {viewingRecord.trangThai === 'Hồ sơ trả' && (
                                        <>
                                            <div>
                                                <span className="text-[10px] font-bold text-rose-600 block">NGÀY TRẢ HỒ SƠ</span>
                                                <span className="text-sm font-mono font-bold text-rose-950 bg-rose-50 border border-rose-100 px-2 py-0.5 rounded-lg w-fit block mt-0.5">{formatDisplayDateInClient(viewingRecord.ngayTra) || '-'}</span>
                                            </div>
                                            <div className="md:col-span-1">
                                                <span className="text-[10px] font-bold text-rose-600 block">LÝ DO TRẢ</span>
                                                <span className="text-xs font-semibold text-rose-950 bg-rose-50/50 border border-rose-100 px-2.5 py-1.5 rounded-lg block mt-0.5 whitespace-pre-wrap">{viewingRecord.lyDoTra || 'Không ghi'}</span>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                            
                            {/* Thông tin Vào sổ & Bàn giao 1 cửa */}
                            <div className="bg-indigo-50/40 rounded-2xl p-4 border border-indigo-100 grid grid-cols-1 sm:grid-cols-4 gap-4 text-left">
                                <div>
                                    <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-widest block mb-1">Số vào sổ GCN</span>
                                    <span className="text-sm font-extrabold text-indigo-900 bg-indigo-100/60 px-2 py-0.5 rounded-lg w-fit block">{viewingRecord.soVaoSo || 'Chưa vào sổ'}</span>
                                </div>
                                <div>
                                    <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-widest block mb-1">Ngày ký GCN</span>
                                    <span className="text-sm font-mono font-bold text-indigo-950 bg-indigo-100/60 px-2 py-0.5 rounded-lg w-fit block">
                                        {viewingRecord.trangThai === 'Đã ký Giấy chứng nhận' || viewingRecord.soVaoSo ? (formatDisplayDateInClient(viewingRecord.ngayKetThuc) || '-') : '-'}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-widest block mb-1">Đợt giao 1 cửa</span>
                                    <span className="text-sm font-bold text-indigo-900 bg-indigo-100/60 px-2 py-0.5 rounded-lg w-fit block">{viewingRecord.dotGiao1Cua || 'Chưa bàn giao'}</span>
                                </div>
                                <div>
                                    <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-widest block mb-1">Ngày giao 1 cửa</span>
                                    <span className="text-sm font-mono font-bold text-indigo-950 bg-indigo-100/60 px-2 py-0.5 rounded-lg w-fit block">{formatDisplayDateInClient(viewingRecord.ngayGiao1Cua) || 'Chưa bàn giao'}</span>
                                </div>
                            </div>

                            {/* Ghi chú full-width */}
                            {viewingRecord.ghiChu && (
                                <div className="bg-amber-50/50 rounded-xl p-3.5 border border-amber-150 text-xs">
                                    <span className="text-[10px] font-bold text-amber-800 uppercase tracking-widest block mb-1">Ghi chú & Hồ sơ đính kèm</span>
                                    <p className="text-slate-700 italic leading-relaxed whitespace-pre-wrap">{viewingRecord.ghiChu}</p>
                                </div>
                            )}
                        </div>

                        <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2 text-sm">
                            <button 
                                onClick={() => {
                                    setViewingRecord(null);
                                }}
                                className="px-4 py-2 hover:bg-slate-200 text-slate-600 rounded-xl font-bold transition-all cursor-pointer"
                            >
                                Đóng
                            </button>
                            <button 
                                onClick={() => {
                                    const item = viewingRecord;
                                    setViewingRecord(null);
                                    handleEdit(item);
                                }}
                                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-all shadow-md shadow-indigo-600/10 cursor-pointer"
                            >
                                Chỉnh sửa hồ sơ này
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* --- MODAL XÁC NHẬN BÀN GIAO & CẬP NHẬT --- */}
            {showConfirmHandoverModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in text-left">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col animate-scale-up border border-slate-100">
                        <div className="bg-gradient-to-r from-purple-900 to-indigo-950 p-5 text-white flex justify-between items-center">
                            <h3 className="font-bold flex items-center gap-2 text-base">
                                <CheckCircle2 size={18} className="text-purple-400" />
                                Xác nhận cập nhật số vào sổ & Bàn giao 1 cửa
                            </h3>
                            <button 
                                onClick={() => setShowConfirmHandoverModal(false)}
                                className="rounded-lg p-1 hover:bg-white/10 text-white transition-all cursor-pointer"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="p-6 space-y-4 text-xs text-slate-750">
                            <div className="p-4 bg-purple-50 border border-purple-100 rounded-xl space-y-1.5">
                                <p className="font-bold text-purple-900 text-sm">Tóm tắt dữ liệu chuẩn bị cập nhật:</p>
                                <ul className="list-disc list-inside space-y-1 text-slate-600 pl-1">
                                    <li>Tổng số hồ sơ xử lý: <strong>{tempRecords.length}</strong> hồ sơ</li>
                                    <li>Hồ sơ có thay đổi Tờ/Thửa/Diện tích: <strong>{tempRecords.filter(r => r.existsInSystem).length}</strong> hồ sơ</li>
                                    <li>Hồ sơ chưa có sẵn (sẽ tự động tạo mới trên iGate): <strong>{tempRecords.filter(r => !r.existsInSystem).length}</strong> hồ sơ</li>
                                </ul>
                            </div>

                            <div className="space-y-3">
                                <label className="text-xs font-bold text-slate-600 block">Cấu hình Đợt bàn giao:</label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setHandoverBatchMode('new')}
                                        className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1 font-bold ${
                                            handoverBatchMode === 'new'
                                                ? 'border-purple-600 bg-purple-50 text-purple-700 ring-2 ring-purple-600/20'
                                                : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-600'
                                        }`}
                                    >
                                        <Plus size={16} />
                                        <span>Tạo đợt bàn giao mới</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setHandoverBatchMode('existing')}
                                        className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1 font-bold ${
                                            handoverBatchMode === 'existing'
                                                ? 'border-purple-600 bg-purple-50 text-purple-700 ring-2 ring-purple-600/20'
                                                : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-600'
                                        }`}
                                    >
                                        <ClipboardList size={16} />
                                        <span>Gộp vào đợt có sẵn</span>
                                    </button>
                                </div>

                                {handoverBatchMode === 'new' ? (
                                    <div className="space-y-1 animate-fade-in">
                                        <label className="text-[11px] font-bold text-slate-500 block">Tên đợt bàn giao mới:</label>
                                        <input 
                                            type="text"
                                            className="w-full text-xs font-semibold p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-purple-500 transition-all text-slate-800"
                                            placeholder="Ví dụ: Đợt bàn giao ngày 21/06/2026..."
                                            value={currentBookNumber}
                                            onChange={(e) => setCurrentBookNumber(e.target.value)}
                                        />
                                    </div>
                                ) : (
                                    <div className="space-y-1 animate-fade-in">
                                        <label className="text-[11px] font-bold text-slate-500 block">Chọn đợt bàn giao hiện có trong hôm nay:</label>
                                        <select 
                                            className="w-full text-xs font-semibold p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-purple-500 transition-all text-slate-800 cursor-pointer"
                                            value={selectedExistingHandoverBatch}
                                            onChange={(e) => setSelectedExistingHandoverBatch(e.target.value)}
                                        >
                                            <option value="">-- Chọn đợt bàn giao có sẵn --</option>
                                            <option value="Đợt 1">Đợt 1</option>
                                            <option value="Đợt 2">Đợt 2</option>
                                            <option value="Đợt 3">Đợt 3</option>
                                        </select>
                                    </div>
                                )}
                            </div>

                            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex gap-2.5 text-xs text-amber-800 leading-relaxed">
                                <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                                <div>
                                    <p className="font-bold mb-0.5">Xác nhận cập nhật dữ liệu:</p>
                                    <p>Hệ thống sẽ cập nhật thông tin <b>Số vào sổ</b>, <b>Ngày ký GCN</b> và gán trạng thái hồ sơ thành <b>"Đã ký Giấy chứng nhận"</b>, đồng thời ghi lại nhật ký bàn giao 1 cửa.</p>
                                </div>
                            </div>
                        </div>

                        <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2 text-sm">
                            <button 
                                onClick={() => setShowConfirmHandoverModal(false)}
                                disabled={isSubmittingHandover}
                                className="px-4 py-2 hover:bg-slate-200 text-slate-600 rounded-xl font-bold transition-all cursor-pointer disabled:opacity-50"
                            >
                                Hủy bỏ
                            </button>
                            <button 
                                onClick={handleConfirmHandover}
                                disabled={isSubmittingHandover}
                                className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold transition-all shadow-md shadow-purple-600/10 cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                            >
                                {isSubmittingHandover ? (
                                    <>
                                        <Loader2 size={14} className="animate-spin" />
                                        Đang cập nhật...
                                    </>
                                ) : (
                                    'Xác nhận cập nhật'
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* --- MODAL XUẤT PHIẾU BÀN GIAO 1 CỬA --- */}
            {showExportHandover1CuaModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in text-left">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col animate-scale-up border border-slate-100">
                        <div className="bg-gradient-to-r from-pink-800 to-rose-950 p-5 text-white flex justify-between items-center">
                            <h3 className="font-bold flex items-center gap-2 text-base">
                                <FileOutput size={18} className="text-pink-400" />
                                Xuất danh sách bàn giao Một cửa
                            </h3>
                            <button 
                                onClick={() => setShowExportHandover1CuaModal(false)}
                                className="rounded-lg p-1 hover:bg-white/10 text-white transition-all cursor-pointer"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="p-6 space-y-4 text-xs text-slate-750">
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-600 block">Phương thức lọc dữ liệu bàn giao:</label>
                                <select 
                                    className="w-full text-xs font-semibold p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-pink-500 transition-all text-slate-800 cursor-pointer"
                                    value={exportHandover1CuaParams.filterType}
                                    onChange={(e) => setExportHandover1CuaParams(prev => ({ ...prev, filterType: e.target.value as 'by_date' | 'by_batch' }))}
                                >
                                    <option value="by_date">Lọc theo ngày bàn giao (Mặc định hôm nay)</option>
                                    <option value="by_batch">Lọc theo đợt bàn giao cụ thể</option>
                                </select>
                            </div>

                            {exportHandover1CuaParams.filterType === 'by_date' ? (
                                <div className="space-y-1 animate-fade-in">
                                    <label className="text-xs font-bold text-slate-600 block">Ngày bàn giao (dd/mm/yyyy):</label>
                                    <input 
                                        type="text"
                                        className="w-full text-xs font-semibold p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-pink-500 transition-all text-slate-800 font-mono"
                                        value={exportHandover1CuaParams.dateStr}
                                        onChange={(e) => setExportHandover1CuaParams(prev => ({ ...prev, dateStr: e.target.value }))}
                                        placeholder="Ví dụ: 21/06/2026..."
                                    />
                                </div>
                            ) : (
                                <div className="space-y-1 animate-fade-in">
                                    <label className="text-xs font-bold text-slate-600 block">Tên đợt bàn giao / Số đợt:</label>
                                    <input 
                                        type="text"
                                        className="w-full text-xs font-semibold p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-pink-500 transition-all text-slate-800"
                                        value={exportHandover1CuaParams.batchName}
                                        onChange={(e) => setExportHandover1CuaParams(prev => ({ ...prev, batchName: e.target.value }))}
                                        placeholder="Ví dụ: Đợt bàn giao ngày 21/06/2026..."
                                    />
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-600 block">Cán bộ bàn giao (Chi nhánh VPĐK):</label>
                                    <input 
                                        type="text"
                                        className="w-full text-xs font-semibold p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-pink-500 transition-all text-slate-800"
                                        value={exportHandover1CuaParams.deliverer}
                                        onChange={(e) => setExportHandover1CuaParams(prev => ({ ...prev, deliverer: e.target.value }))}
                                        placeholder="Tên cán bộ bàn giao..."
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-600 block">Cán bộ tiếp nhận (Bộ phận 1 cửa):</label>
                                    <input 
                                        type="text"
                                        className="w-full text-xs font-semibold p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-pink-500 transition-all text-slate-800"
                                        value={exportHandover1CuaParams.receiver}
                                        onChange={(e) => setExportHandover1CuaParams(prev => ({ ...prev, receiver: e.target.value }))}
                                        placeholder="Tên cán bộ tiếp nhận..."
                                    />
                                </div>
                            </div>

                            <p className="text-[10px] text-slate-400 italic">
                                * Lưu ý: Hệ thống sẽ truy vấn các bản ghi có trạng thái hoặc lịch sử thuộc đợt bàn giao tương ứng để xuất file Excel danh sách giao nhận chính thức có định dạng mẫu biên bản ký nhận đầy đủ.
                            </p>
                        </div>

                        <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2 text-sm">
                            <button 
                                onClick={() => setShowExportHandover1CuaModal(false)}
                                className="px-4 py-2 hover:bg-slate-200 text-slate-600 rounded-xl font-bold transition-all cursor-pointer"
                            >
                                Hủy bỏ
                            </button>
                            <button 
                                onClick={handleTriggerExport}
                                className="px-5 py-2 bg-pink-600 hover:bg-pink-700 text-white rounded-xl font-bold transition-all shadow-md shadow-pink-600/10 cursor-pointer flex items-center gap-1.5"
                            >
                                <Download size={14}/> Xuất biên bản Excel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* --- MODAL XUẤT BÁO CÁO THỐNG KÊ POPUP --- */}
            {showExportReportModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in text-left">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden flex flex-col animate-scale-up border border-slate-100">
                        <div className="bg-gradient-to-r from-indigo-900 to-slate-900 p-5 text-white flex justify-between items-center">
                            <h3 className="font-bold flex items-center gap-2 text-base">
                                <Printer size={18} className="text-indigo-300" />
                                Xuất báo cáo thống kê iGate
                            </h3>
                            <button 
                                onClick={() => setShowExportReportModal(false)}
                                className="rounded-lg p-1 hover:bg-white/10 text-white transition-all cursor-pointer"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="p-6 space-y-4 text-xs text-slate-750">
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-600 block">Từ ngày tiếp nhận:</label>
                                    <input 
                                        type="date"
                                        className="w-full text-xs font-semibold p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-indigo-600 transition-all text-slate-800 font-mono"
                                        value={exportFromDate}
                                        onChange={(e) => setExportFromDate(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-600 block">Đến ngày tiếp nhận:</label>
                                    <input 
                                        type="date"
                                        className="w-full text-xs font-semibold p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-indigo-600 transition-all text-slate-800 font-mono"
                                        value={exportToDate}
                                        onChange={(e) => setExportToDate(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-600 block">Lọc theo Xã / Phường:</label>
                                <select 
                                    className="w-full text-xs font-semibold p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-indigo-600 transition-all text-slate-800 cursor-pointer"
                                    value={exportWard}
                                    onChange={(e) => setExportWard(e.target.value)}
                                >
                                    <option value="Tất cả">Tất cả Xã / Phường</option>
                                    {wards && wards.map((w, idx) => (
                                        <option key={idx} value={w}>{w}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="bg-slate-50 border border-slate-150 rounded-xl p-3 text-[11px] leading-relaxed text-slate-500">
                                <p className="font-semibold text-slate-700 mb-0.5">💡 Thông tin báo cáo bao gồm:</p>
                                <ul className="list-disc pl-4 space-y-0.5">
                                    <li>Thông tin chi tiết hồ sơ iGate (Mã HS, loại biến động, diện tích,...)</li>
                                    <li>Thông tin vào số GCN &amp; Ngày ký GCN chính thức</li>
                                    <li>Thông tin ngày giao 1 cửa &amp; đợt giao 1 cửa</li>
                                </ul>
                            </div>
                        </div>

                        <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2 text-sm">
                            <button 
                                onClick={() => setShowExportReportModal(false)}
                                className="px-4 py-2 hover:bg-slate-200 text-slate-600 rounded-xl font-bold transition-all cursor-pointer"
                            >
                                Hủy bỏ
                            </button>
                            <button 
                                onClick={handleExportReportExcel}
                                className="px-5 py-2 bg-indigo-900 hover:bg-indigo-950 text-white rounded-xl font-bold transition-all shadow-md shadow-indigo-900/10 cursor-pointer flex items-center gap-1.5"
                            >
                                <Download size={14}/> Xuất báo cáo Excel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default IGateView;
