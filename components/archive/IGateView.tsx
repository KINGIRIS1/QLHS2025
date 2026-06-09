import React, { useState, useEffect, useMemo, useRef } from 'react';
import { User, UserRole } from '../../types';
import { 
    Search, Plus, Trash2, Edit, Save, X, Calendar, Phone, FileSpreadsheet, 
    Download, LayoutGrid, FileText, ClipboardList, BookOpen, User as UserIcon, 
    Building, CheckCircle2, AlertTriangle, FilePieChart, TrendingUp, BarChart3,
    ArrowUpRight, AlertCircle, RefreshCw, Printer, Filter, Upload, Tag
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

interface IGateRecord {
    id: string;
    soHieu: string;        // Số hồ sơ
    tenThuTuc: string;      // Tên thủ tục hành chính
    tenLinhVuc: string;     // Tên lĩnh vực
    ngayTiepNhan: string;   // Ngày tiếp nhận
    ngayHenTra: string;     // Ngày hẹn trả
    ngayKetThuc: string;    // Ngày kết thúc xử lý
    donVi: string;          // Cơ quan/đơn vị
    chuHoSo: string;        // Chủ hồ sơ
    soDienThoai: string;    // Số điện thoại
    canBoXuLy: string;      // Cán bộ xử lý hiện tại
    trangThai: string;      // Trạng thái hồ sơ
}

interface IGateViewProps {
    currentUser: User;
    wards: string[];
}

// Seed data mặc định để người dùng nhận diện ngay Dashboard khi mới khởi chạy
const DEFAULT_IGATE_RECORDS: IGateRecord[] = [
    {
        id: "ig-1",
        soHieu: "HSPT-2026-00342",
        tenThuTuc: "Đăng ký biến động quyền sử dụng đất, quyền sở hữu tài sản gắn liền với đất do thay đổi thông tin về chủ sở hữu",
        tenLinhVuc: "Đất đai",
        ngayTiepNhan: "2026-05-15",
        ngayHenTra: "2026-05-25",
        ngayKetThuc: "",
        donVi: "Chi nhánh Văn phòng Đăng ký Đất đai",
        chuHoSo: "Nguyễn Văn Hùng",
        soDienThoai: "0912345678",
        canBoXuLy: "Lê Thị Thu",
        trangThai: "Mới tiếp nhận"
    },
    {
        id: "ig-2",
        soHieu: "HSPT-2026-00215",
        tenThuTuc: "Chuyển nhượng quyền sử dụng đất và tài sản gắn liền với đất",
        tenLinhVuc: "Đất đai",
        ngayTiepNhan: "2026-04-10",
        ngayHenTra: "2026-04-24",
        ngayKetThuc: "",
        donVi: "Chi nhánh Văn phòng Đăng ký Đất đai",
        chuHoSo: "Trần Thị Lan",
        soDienThoai: "0987654321",
        canBoXuLy: "Nguyễn Văn Nam",
        trangThai: "Đã phát hành thông báo thuế"
    },
    {
        id: "ig-3",
        soHieu: "HSPT-2026-00104",
        tenThuTuc: "Cấp đổi Giấy chứng nhận quyền sử dụng đất, quyền sở hữu nhà ở và tài sản khác gắn liền với đất",
        tenLinhVuc: "Đất đai",
        ngayTiepNhan: "2026-02-05", // Tồn trên 90 ngày cốc tích
        ngayHenTra: "2026-02-20",
        ngayKetThuc: "",
        donVi: "Chi nhánh Văn phòng Đăng ký Đất đai",
        chuHoSo: "Phạm Minh Đức",
        soDienThoai: "0905112233",
        canBoXuLy: "Lê Tiến Anh",
        trangThai: "Chờ thực hiện nghĩa vụ tài chính"
    },
    {
        id: "ig-4",
        soHieu: "HSPT-2026-00561",
        tenThuTuc: "Tặng cho quyền sử dụng đất và tài sản gắn liền với đất",
        tenLinhVuc: "Đất đai",
        ngayTiepNhan: "2026-05-22",
        ngayHenTra: "2026-06-05",
        ngayKetThuc: "",
        donVi: "Chi nhánh Văn phòng Đăng ký Đất đai",
        chuHoSo: "Hoàng Minh Tuấn",
        soDienThoai: "0977889900",
        canBoXuLy: "Võ Văn Kiệt",
        trangThai: "Đã chuyển thông tin thuế"
    },
    {
        id: "ig-5",
        soHieu: "HSPT-2026-00412",
        tenThuTuc: "Thế chấp quyền sử dụng đất hoặc tài sản gắn liền với đất",
        tenLinhVuc: "Giao dịch bảo đảm",
        ngayTiepNhan: "2026-05-18",
        ngayHenTra: "2026-05-20",
        ngayKetThuc: "2026-05-20",
        donVi: "Chi nhánh Văn phòng Đăng ký Đất đai",
        chuHoSo: "Vũ Quỳnh Chi",
        soDienThoai: "0345678901",
        canBoXuLy: "Nguyễn Hoàng Minh",
        trangThai: "Đã trả kết quả"
    },
    {
        id: "ig-6",
        soHieu: "HSPT-2026-00120",
        tenThuTuc: "Cấp Giấy chứng nhận quyền sử dụng đất lần đầu",
        tenLinhVuc: "Đất đai",
        ngayTiepNhan: "2026-01-10", // Tồn trên 90 ngày
        ngayHenTra: "2026-02-05",
        ngayKetThuc: "",
        donVi: "Chi nhánh Văn phòng Đăng ký Đất đai",
        chuHoSo: "Đoàn Văn Hậu",
        soDienThoai: "0963221144",
        canBoXuLy: "Trần Quốc Toản",
        trangThai: "Đã ký Giấy chứng nhận"
    },
    {
        id: "ig-7",
        soHieu: "HSPT-2026-00620",
        tenThuTuc: "Xóa đăng ký thế chấp quyền sử dụng đất",
        tenLinhVuc: "Giao dịch bảo đảm",
        ngayTiepNhan: "2026-06-01",
        ngayHenTra: "2026-06-03",
        ngayKetThuc: "",
        donVi: "Chi nhánh Văn phòng Đăng ký Đất đai",
        chuHoSo: "Bùi Tiến Dũng",
        soDienThoai: "0981234789",
        canBoXuLy: "Lê Thị Thu",
        trangThai: "Chưa trả kết quả"
    }
];

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
    "Chờ thực hiện nghĩa vụ tài chính",
    "Đã ký Giấy chứng nhận",
    "Chưa trả kết quả",
    "Đã trả kết quả"
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

const IGateView: React.FC<IGateViewProps> = ({ currentUser, wards }) => {
    const [records, setRecords] = useState<IGateRecord[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedTrangThaiFilter, setSelectedTrangThaiFilter] = useState<string>('Tất cả');
    const [selectedLinhVucFilter, setSelectedLinhVucFilter] = useState<string>('Tất cả');
    const [showOnlyTon90Days, setShowOnlyTon90Days] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    
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
        trangThai: 'Mới tiếp nhận'
    });

    const fileInputRef = useRef<HTMLInputElement>(null);

    // Tải dữ liệu từ database / API
    const loadData = async () => {
        const data = await fetchIGateRecords(DEFAULT_IGATE_RECORDS);
        setRecords(data);
    };

    useEffect(() => {
        loadData();
    }, []);

    // Tự động chuyển về trang 1 khi thay đổi trạng thái tìm kiếm hoặc bộ lọc
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, selectedTrangThaiFilter, selectedLinhVucFilter]);

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

        let isSuccess = false;
        if (editingRecord) {
            // Chỉnh sửa
            const updatedRecord = { ...editingRecord, ...formData };
            const updated = records.map(r => r.id === editingRecord.id ? updatedRecord : r);
            setRecords(updated);
            isSuccess = await saveIGateRecordApi(updatedRecord, true, DEFAULT_IGATE_RECORDS);
        } else {
            // Thêm mới
            const newRecord: IGateRecord = {
                id: 'ig-' + Math.random().toString(36).substr(2, 9),
                ...formData
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

        let confirmMsg = `Bạn có chắc chắn muốn cập nhật hàng loạt cho ${selectedIds.size} hồ sơ đã chọn không?`;
        if (batchStatus) confirmMsg += `\n- Cập nhật trạng thái mới: ${batchStatus}`;
        if (batchCanBo) confirmMsg += `\n- Phân công cán bộ xử lý: ${batchCanBo}`;

        if (window.confirm(confirmMsg)) {
            const updated = records.map(r => {
                if (selectedIds.has(r.id)) {
                    const updatedRecord = { ...r };
                    if (batchStatus) {
                        updatedRecord.trangThai = batchStatus;
                        if (batchStatus === 'Đã trả kết quả') {
                            updatedRecord.ngayKetThuc = r.ngayKetThuc || new Date().toISOString().split('T')[1] 
                                ? new Date().toISOString().split('T')[0] 
                                : getNowVietnameseString().split(' ')[0];
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
            trangThai: 'Mới tiếp nhận'
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
            soDienThoai: record.soDienThoai,
            canBoXuLy: record.canBoXuLy,
            trangThai: record.trangThai
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
        
        // Hồ sơ chờ thuế
        const daChuyenThongTinThue = records.filter(r => r.trangThai === 'Đã chuyển thông tin thuế').length;
        const choThucHienNghiaVuTaiChinh = records.filter(r => r.trangThai === 'Chờ thực hiện nghĩa vụ tài chính').length;
        const countChoThue = daChuyenThongTinThue + choThucHienNghiaVuTaiChinh;

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

        return {
            total,
            newReceipt,
            choThue: {
                total: countChoThue,
                daChuyenThongTinThue,
                choThucHienNghiaVuTaiChinh
            },
            choTraKQ: {
                total: countChoTraKQ,
                daKyGCN,
                chuaTraKQ
            },
            ton90Ngay: countTon90Ngay
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
                if (selectedTrangThaiFilter === 'Hồ sơ đã phát hành thông báo thuế') {
                    matchTrangThai = r.trangThai === 'Đã phát hành thông báo thuế';
                } else if (selectedTrangThaiFilter === 'Hồ sơ chờ thực hiện nghĩa vụ tài chính') {
                    matchTrangThai = r.trangThai === 'Chờ thực hiện nghĩa vụ tài chính';
                } else if (selectedTrangThaiFilter === 'Hồ sơ đã ký Giấy chứng nhận') {
                    matchTrangThai = r.trangThai === 'Đã ký Giấy chứng nhận';
                } else if (selectedTrangThaiFilter === 'Hồ sơ chưa trả kết quả') {
                    matchTrangThai = r.trangThai === 'Chưa trả kết quả';
                } else {
                    matchTrangThai = r.trangThai === selectedTrangThaiFilter;
                }
            }

            // Lọc theo lĩnh vực
            const matchLinhVuc = selectedLinhVucFilter === 'Tất cả' || r.tenLinhVuc === selectedLinhVucFilter;

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

            return matchSearch && matchTrangThai && matchLinhVuc && matchTon90Days;
        });
    }, [records, searchTerm, selectedTrangThaiFilter, selectedLinhVucFilter, showOnlyTon90Days]);

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
                const idxTenThuTuc = findColIndex(['tên thủ tục', 'thuật tục', 'thủ tục hành chính', 'ten thu tuc', 'tên tthc']);
                const idxTenLinhVuc = findColIndex(['tên lĩnh vực', 'lĩnh vực', 'linh vuc']);
                const idxNgayTiepNhan = findColIndex(['ngày tiếp nhận', 'tiếp nhận', 'ngay tiep nhan', 'ngày nhận', 'ngay nhan']);
                const idxNgayHenTra = findColIndex(['ngày hẹn trả', 'hẹn trả', 'ngay hen tra', 'ngày trả', 'ngay tra']);
                const idxNgayKetThuc = findColIndex(['kết thúc xử lý', 'ngày kết thúc', 'hoàn thành', 'ngay ket thuc']);
                const idxDonVi = findColIndex(['cơ quan', 'đơn vị', 'co quan', 'don vi']);
                const idxChuHoSo = findColIndex(['chủ hồ sơ', 'chủ sử dụng', 'khách hàng', 'chu ho so', 'chu su dung', 'tên chủ']);
                const idxSoDienThoai = findColIndex(['số điện thoại', 'sđt', 'điện thoại', 'so dien thoai', 'sdt']);
                const idxCanBo = findColIndex(['cán bộ xử lý', 'cán bộ', 'can bo xu ly', 'can bo']);
                const idxTrangThai = findColIndex(['trạng thái', 'trang thai', 'tình trạng']);

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
                        else if (lowerTT.includes('phát hành thông báo thuế') || lowerTT.includes('đã phát hành')) normalizedTrangThai = 'Đã phát hành thông báo thuế';
                        else if (lowerTT.includes('chờ thực hiện nghĩa vụ') || lowerTT.includes('chuẩn bị đóng') || lowerTT.includes('chờ thuế')) normalizedTrangThai = 'Chờ thực hiện nghĩa vụ tài chính';
                        else if (lowerTT.includes('đã ký') || lowerTT.includes('ký gcn')) normalizedTrangThai = 'Đã ký Giấy chứng nhận';
                        else if (lowerTT.includes('chưa trả') || lowerTT.includes('chưa nhận')) normalizedTrangThai = 'Chưa trả kết quả';
                        else if (lowerTT.includes('đã trả') || lowerTT.includes('hoàn thành')) normalizedTrangThai = 'Đã trả kết quả';
                    }

                    newRecords.push({
                        id: 'ig-' + Math.random().toString(36).substr(2, 9),
                        soHieu: soHieu || `IGATE-${100000 + i}`,
                        tenThuTuc: idxTenThuTuc !== -1 && row[idxTenThuTuc] ? String(row[idxTenThuTuc]).trim() : 'Đăng ký đất đai biến động trực tuyến',
                        tenLinhVuc: idxTenLinhVuc !== -1 && row[idxTenLinhVuc] ? String(row[idxTenLinhVuc]).trim() : 'Đất đai',
                        ngayTiepNhan: idxNgayTiepNhan !== -1 ? parseExcelDate(row[idxNgayTiepNhan]) : new Date().toISOString().split('T')[0],
                        ngayHenTra: idxNgayHenTra !== -1 ? parseExcelDate(row[idxNgayHenTra]) : '',
                        ngayKetThuc: idxNgayKetThuc !== -1 ? parseExcelDate(row[idxNgayKetThuc]) : '',
                        donVi: idxDonVi !== -1 && row[idxDonVi] ? String(row[idxDonVi]).trim() : 'Chi nhánh Văn phòng Đăng ký Đất đai',
                        chuHoSo: chuHoSo || 'Chưa xác định',
                        soDienThoai: idxSoDienThoai !== -1 ? String(row[idxSoDienThoai] || '').trim() : '',
                        canBoXuLy: idxCanBo !== -1 && row[idxCanBo] ? String(row[idxCanBo]).trim() : (canBoList[0] || 'Chưa phân công'),
                        trangThai: normalizedTrangThai
                    });
                }

                if (newRecords.length > 0) {
                    saveRecords([...newRecords, ...records]);
                    alert(`Đã nhập thành công ${newRecords.length} hồ sơ iGate từ tệp Excel!`);
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

    // --- CHỨC NĂNG LẬP BÁO CÁO EXCEL CHUYÊN NGHIỆP ---
    const handleExportReportExcel = () => {
        if (filteredRecords.length === 0) {
            alert('Không có dữ liệu phù hợp bộ lọc để xuất báo cáo!');
            return;
        }

        const headerRow = [
            'STT',
            'Số hồ sơ',
            'Tên thủ tục hành chính',
            'Tên lĩnh vực',
            'Ngày tiếp nhận',
            'Ngày hẹn trả',
            'Ngày kết thúc xử lý',
            'Cơ quan/đơn vị',
            'Chủ hồ sơ',
            'Số điện thoại',
            'Cán bộ xử lý hiện tại',
            'Trạng thái hồ sơ'
        ];

        const bodyRows = filteredRecords.map((r, idx) => [
            idx + 1,
            r.soHieu,
            r.tenThuTuc,
            r.tenLinhVuc,
            r.ngayTiepNhan,
            r.ngayHenTra,
            r.ngayKetThuc || 'Chưa kết thúc',
            r.donVi,
            r.chuHoSo,
            r.soDienThoai || '-',
            r.canBoXuLy || '-',
            r.trangThai
        ]);

        const worksheet = XLSX.utils.aoa_to_sheet([
            ['BÁO CÁO THỐNG KÊ QUẢN LÝ HỒ SƠ IGATE'],
            [`Ngày lập báo cáo: ${new Date().toLocaleDateString('vi-VN')} - Người lập: ${currentUser.name}`],
            [''],
            headerRow,
            ...bodyRows
        ]);

        // Merge cells tiêu đề
        worksheet['!merges'] = [
            { s: { r: 0, c: 0 }, e: { r: 0, c: 11 } },
            { s: { r: 1, c: 0 }, e: { r: 1, c: 11 } }
        ];

        // Format Width cho các cột
        worksheet['!cols'] = [
            { wch: 6 },   // STT
            { wch: 20 },  // Số hồ sơ
            { wch: 45 },  // Tên thủ tục hành chính
            { wch: 18 },  // Tên lĩnh vực
            { wch: 15 },  // Ngày tiếp nhận
            { wch: 15 },  // Ngày hẹn trả
            { wch: 18 },  // Ngày kết thúc
            { wch: 25 },  // Đơn vị
            { wch: 22 },  // Chủ hồ sơ
            { wch: 14 },  // Số điện thoại
            { wch: 20 },  // Cán bộ xử lý
            { wch: 22 }   // Trạng thái hồ sơ
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
            const r = parsedCell.r;
            const c = parsedCell.c;

            if (r === 0) {
                cell.s = cellStyleTitle;
            } else if (r === 1) {
                cell.s = cellStyleSubTitle;
            } else if (r === 3) {
                cell.s = cellStyleHeader;
            } else if (r > 3) {
                if (c === 0 || c === 1 || c === 4 || c === 5 || c === 6 || c === 9) {
                    cell.s = cellStyleDataCenter;
                } else if (c === 11) {
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
    };

    return (
        <div className="space-y-6">
            {/* --- DASHBOARD METRICS CONTROLS --- */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                {/* 1. Tổng số hồ sơ */}
                <div 
                    onClick={() => { setSelectedTrangThaiFilter('Tất cả'); setSelectedLinhVucFilter('Tất cả'); }}
                    className="cursor-pointer bg-gradient-to-br from-indigo-50 to-white hover:from-indigo-100 rounded-2xl border border-indigo-100 p-5 shadow-sm transition-all duration-300 transform hover:-translate-y-1 relative overflow-hidden group"
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
                    onClick={() => { setSelectedTrangThaiFilter('Mới tiếp nhận'); setSelectedLinhVucFilter('Tất cả'); }}
                    className="cursor-pointer bg-gradient-to-br from-sky-50 to-white hover:from-sky-100 rounded-2xl border border-sky-100 p-5 shadow-sm transition-all duration-300 transform hover:-translate-y-1 relative overflow-hidden group"
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
                    onClick={() => { setSelectedTrangThaiFilter('Đã chuyển thông tin thuế'); setSelectedLinhVucFilter('Tất cả'); }}
                    className="cursor-pointer bg-gradient-to-br from-orange-50 to-white hover:from-orange-100 rounded-2xl border border-orange-100 p-5 shadow-sm transition-all duration-300 transform hover:-translate-y-1 relative overflow-hidden group"
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
                        <div className="flex justify-between hover:text-orange-950">
                            <span>• Đã chuyển thông tin:</span> 
                            <span className="font-bold">{stats.choThue.daChuyenThongTinThue}</span>
                        </div>
                        <div className="flex justify-between hover:text-orange-950">
                            <span>• Chờ thực hiện NVTC:</span> 
                            <span className="font-bold">{stats.choThue.choThucHienNghiaVuTaiChinh}</span>
                        </div>
                    </div>
                </div>

                {/* 4. Chờ trả kết quả */}
                <div 
                    onClick={() => { setSelectedTrangThaiFilter('Đã ký Giấy chứng nhận'); setSelectedLinhVucFilter('Tất cả'); }}
                    className="cursor-pointer bg-gradient-to-br from-teal-50 to-white hover:from-teal-100 rounded-2xl border border-teal-100 p-5 shadow-sm transition-all duration-300 transform hover:-translate-y-1 relative overflow-hidden group"
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
                        <div className="flex justify-between hover:text-teal-950">
                            <span>• Đã ký GCN:</span> 
                            <span className="font-bold">{stats.choTraKQ.daKyGCN}</span>
                        </div>
                        <div className="flex justify-between hover:text-teal-950">
                            <span>• Chưa nhận kết quả:</span> 
                            <span className="font-bold">{stats.choTraKQ.chuaTraKQ}</span>
                        </div>
                    </div>
                </div>

                {/* 5. Tồn trên 90 ngày */}
                <div 
                    onClick={() => {
                        setShowOnlyTon90Days(!showOnlyTon90Days);
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
                        <div className="flex items-center gap-2 mb-3">
                            <span className="p-1 px-2.5 bg-indigo-500/30 text-indigo-300 font-bold text-[10px] uppercase tracking-wider rounded-md border border-indigo-500/20">Công cụ</span>
                            <h3 className="font-bold text-slate-100 flex items-center gap-1.5">
                                <FileSpreadsheet size={18} className="text-indigo-400" />
                                Quản lý dữ liệu hệ thống
                            </h3>
                        </div>
                        <p className="text-xs text-slate-400 leading-relaxed mb-4">
                            Hệ thống tự động hỗ trợ bạn nhập dữ liệu gốc từ phần mềm một cửa iGate tập trung qua tệp Excel để phân loại, theo dõi nghĩa vụ tài chính và lập báo cáo nhanh chóng.
                        </p>
                    </div>

                    <div className="space-y-3">
                        {/* 1. Nút Thêm mới */}
                        <button
                            onClick={handleAddNew}
                            className="w-full flex items-center justify-center gap-2.5 bg-gradient-to-r from-indigo-500 to-blue-600 hover:from-indigo-600 hover:to-blue-700 text-white font-bold py-2.5 px-4 rounded-xl shadow-lg shadow-indigo-600/30 transition-all font-sans text-sm active:scale-[0.98]"
                        >
                            <Plus size={16} /> Thêm Hồ sơ iGate thủ công
                        </button>

                        {/* 2. Nhập từ Excel */}
                        <div className="flex gap-2">
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="flex-1 flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-white font-bold py-2 px-3 rounded-xl border border-slate-700 text-xs transition-all active:scale-[0.98]"
                            >
                                <Upload size={14} className="text-slate-400" /> Nhập Excel đầu vào
                            </button>
                            <input 
                                type="file" 
                                ref={fileInputRef} 
                                className="hidden" 
                                accept=".xlsx, .xls" 
                                onChange={handleExcelImport} 
                            />

                            {/* 3. Lập báo cáo */}
                            <button
                                onClick={handleExportReportExcel}
                                className="flex-1 flex items-center justify-center gap-2 bg-indigo-950 text-indigo-200 border border-indigo-800 hover:bg-indigo-900 font-bold py-2 px-3 rounded-xl text-xs transition-all active:scale-[0.98]"
                            >
                                <Printer size={14} /> Xuất Báo Cáo
                            </button>
                        </div>

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
                    
                    {/* Chọn lĩnh vực */}
                    <div className="w-full md:w-auto flex items-center gap-2 border border-slate-200 rounded-xl px-3 py-1.5 bg-slate-50 min-w-[200px]">
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
                </div>

                {/* Phân loại nhanh / Trạng thái hồ sơ iGate */}
                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-50">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mr-2">Phân loại hồ sơ:</span>
                    {[
                        'Tất cả',
                        'Mới tiếp nhận',
                        'Hồ sơ đã phát hành thông báo thuế',
                        'Hồ sơ chờ thực hiện nghĩa vụ tài chính',
                        'Hồ sơ đã ký Giấy chứng nhận',
                        'Hồ sơ chưa trả kết quả',
                        'Đã trả kết quả'
                    ].map(tab => {
                        const isSelected = selectedTrangThaiFilter === tab;
                        let count = 0;
                        if (tab === 'Tất cả') count = records.length;
                        else if (tab === 'Mới tiếp nhận') count = records.filter(r => r.trangThai === 'Mới tiếp nhận').length;
                        else if (tab === 'Hồ sơ đã phát hành thông báo thuế') count = records.filter(r => r.trangThai === 'Đã phát hành thông báo thuế').length;
                        else if (tab === 'Hồ sơ chờ thực hiện nghĩa vụ tài chính') count = records.filter(r => r.trangThai === 'Chờ thực hiện nghĩa vụ tài chính').length;
                        else if (tab === 'Hồ sơ đã ký Giấy chứng nhận') count = records.filter(r => r.trangThai === 'Đã ký Giấy chứng nhận').length;
                        else if (tab === 'Hồ sơ chưa trả kết quả') count = records.filter(r => r.trangThai === 'Chưa trả kết quả').length;
                        else count = records.filter(r => r.trangThai === tab).length;

                        // Định dạng màu sắc các tab phân loại
                        let activeStyle = "bg-indigo-600 text-white shadow-md shadow-indigo-600/10";
                        let inactiveStyle = "bg-slate-50 text-slate-600 hover:bg-slate-100";
                        if (isSelected) {
                            if (tab.includes('thuế')) activeStyle = "bg-orange-500 text-white shadow-md shadow-orange-500/10";
                            else if (tab.includes('Giấy chứng nhận')) activeStyle = "bg-teal-600 text-white shadow-md shadow-teal-600/10";
                            else if (tab.includes('trả kết quả')) activeStyle = "bg-green-600 text-white shadow-md shadow-green-600/10";
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
                                setIsBatchModalOpen(true);
                            }}
                            className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-600/10 cursor-pointer"
                        >
                            <Tag size={14} /> Phân loại
                        </button>

                        {/* Xóa hàng loạt */}
                        <button
                            onClick={() => {
                                if (window.confirm(`CẢNH BÁO: Bạn có chắc chắn muốn xóa vĩnh viễn ${selectedIds.size} hồ sơ iGate đã chọn không?`)) {
                                    const updated = records.filter(r => !selectedIds.has(r.id));
                                    saveRecords(updated);
                                    setSelectedIds(new Set());
                                    alert(`Đã xóa thành công ${selectedIds.size} hồ sơ!`);
                                }
                            }}
                            className="flex items-center justify-center gap-2 px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-xl text-xs font-bold transition-all shadow-xs"
                        >
                            <Trash2 size={14} /> Xóa đã chọn
                        </button>
                        
                        {/* Hủy chọn */}
                        <button
                            onClick={() => setSelectedIds(new Set())}
                            className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors"
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
                    <table className="w-full text-left table-fixed min-w-[2000px]">
                        <thead className="bg-[#1E293B] text-slate-300 text-xs font-bold uppercase sticky top-0 z-10">
                            <tr>
                                <th className="p-4 w-12 text-center">
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
                                <th className="p-4 w-12 text-center text-slate-400">STT</th>
                                <th className="p-4 w-[180px]">Số hồ sơ</th>
                                <th className="p-4 w-[220px]">Chủ hồ sơ</th>
                                <th className="p-4 w-[130px]">Số điện thoại</th>
                                <th className="p-4 w-[420px]">Tên thủ tục hành chính</th>
                                <th className="p-4 w-[160px]">Tên lĩnh vực</th>
                                <th className="p-4 w-[130px] text-center">Tiếp nhận</th>
                                <th className="p-4 w-[130px] text-center">Hẹn trả</th>
                                <th className="p-4 w-[130px] text-center">Kết thúc</th>
                                <th className="p-4 w-[240px]">Cơ quan/đơn vị</th>
                                <th className="p-4 w-[180px]">Cán bộ xử lý</th>
                                <th className="p-4 w-[200px] text-center">Trạng thái hồ sơ</th>
                                <th className="p-4 w-[120px] text-center sticky right-0 bg-[#1E293B] shadow-[-4px_0_10px_rgba(0,0,0,0.2)]">Hành động</th>
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
                                else if (r.trangThai === 'Chờ thực hiện nghĩa vụ tài chính') statusBadge = "bg-orange-150 text-orange-800 border-orange-200";
                                else if (r.trangThai === 'Đã ký Giấy chứng nhận') statusBadge = "bg-teal-50 text-teal-700 border-teal-150";
                                else if (r.trangThai === 'Chưa trả kết quả') statusBadge = "bg-yellow-50 text-yellow-800 border-yellow-200 font-medium";
                                else if (r.trangThai === 'Đã trả kết quả') statusBadge = "bg-emerald-50 text-emerald-700 border-emerald-100 font-bold";

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
                                                        : ''
                                        }`}
                                    >
                                        <td className="p-4 text-center">
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
                                        <td className="p-4 text-center text-slate-400 font-bold">{(currentPage - 1) * itemsPerPage + idx + 1}</td>
                                        <td className="p-4 font-mono font-bold text-slate-900">{r.soHieu}</td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-2">
                                                <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-xs">
                                                    {r.chuHoSo.charAt(0).toUpperCase()}
                                                </div>
                                                <div>
                                                    <span className="font-semibold text-slate-800 block">{r.chuHoSo}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4 font-mono text-slate-550">{r.soDienThoai || '-'}</td>
                                        <td className="p-4 text-slate-600 leading-tight pr-6">{r.tenThuTuc}</td>
                                        <td className="p-4">
                                            <span className="text-xs bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.8 rounded-md font-bold">
                                                {r.tenLinhVuc}
                                            </span>
                                        </td>
                                        <td className="p-4 text-center font-mono">{formatDisplayDateInClient(r.ngayTiepNhan)}</td>
                                        <td className="p-4 text-center font-mono">
                                            <div className="flex flex-col items-center justify-center font-medium">
                                                <span>{formatDisplayDateInClient(r.ngayHenTra)}</span>
                                                {isOverdue && (
                                                    <span className="text-[10px] text-red-600 font-bold bg-red-100 px-1.5 rounded mt-0.5 animate-pulse">Trễ hẹn</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="p-4 text-center font-mono text-emerald-600 font-bold">
                                            {formatDisplayDateInClient(r.ngayKetThuc)}
                                        </td>
                                        <td className="p-4 text-slate-550">{r.donVi}</td>
                                        <td className="p-4 text-slate-700">
                                            <div className="flex items-center gap-1.5">
                                                <UserIcon size={14} className="text-slate-400" />
                                                <span>{r.canBoXuLy || '-'}</span>
                                            </div>
                                        </td>
                                        <td className="p-4 text-center">
                                            <span className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold border ${statusBadge}`}>
                                                {r.trangThai}
                                            </span>
                                        </td>
                                        <td className="p-4 text-center sticky right-0 bg-white shadow-[-4px_0_10px_rgba(0,0,0,0.04)]">
                                            <div className="flex justify-center gap-1">
                                                <button 
                                                    onClick={() => handleEdit(r)} 
                                                    className="p-1 px-2.5 text-blue-600 hover:bg-blue-50 hover:text-blue-700 rounded-lg text-xs font-bold transition-all"
                                                    title="Chỉnh sửa chi tiết"
                                                >
                                                    Sửa
                                                </button>
                                                <button 
                                                    onClick={() => handleDelete(r.id, r.soHieu)} 
                                                    className="p-1 px-2.5 text-red-500 hover:bg-red-50 hover:text-red-700 rounded-lg text-xs font-bold transition-all"
                                                    title="Xóa hồ sơ"
                                                >
                                                    Xóa
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            }) : (
                                <tr>
                                    <td colSpan={13} className="p-16 text-center text-slate-400">
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
                        <span>Hiển thị <b>{filteredRecords.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0}-{Math.min(filteredRecords.length, currentPage * itemsPerPage)}</b> trên tổng số <b>{filteredRecords.length}</b> hồ sơ iGate theo bộ lọc</span>
                        <span className="text-slate-300">|</span>
                        <div className="flex items-center gap-1">
                            <span>Mỗi trang:</span>
                            <select 
                                value={itemsPerPage} 
                                onChange={(e) => {
                                    setItemsPerPage(Number(e.target.value));
                                    setCurrentPage(1);
                                }}
                                className="bg-white border border-slate-200 rounded px-1.5 py-0.5 text-xs text-slate-700 outline-none focus:ring-1 focus:ring-indigo-500"
                            >
                                <option value={10}>10</option>
                                <option value={15}>15</option>
                                <option value={25}>25</option>
                                <option value={50}>50</option>
                                <option value={100}>100</option>
                            </select>
                        </div>
                    </div>
                    
                    {/* Pagination Controls */}
                    <div className="flex items-center gap-1.5 font-medium">
                        <button
                            onClick={() => setCurrentPage(1)}
                            disabled={currentPage === 1}
                            className="px-2 py-1 rounded border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed text-xs text-slate-700 transition font-semibold"
                        >
                            Đầu
                        </button>
                        <button
                            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                            disabled={currentPage === 1}
                            className="px-2.5 py-1 rounded border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed text-xs text-slate-700 transition font-semibold"
                        >
                            Trước
                        </button>
                        
                        <div className="flex items-center gap-1 px-1">
                            <span className="text-slate-600">Trang <b>{currentPage}</b> / {totalPages}</span>
                        </div>
                        
                        <button
                            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                            disabled={currentPage === totalPages}
                            className="px-2.5 py-1 rounded border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed text-xs text-slate-700 transition font-semibold"
                        >
                            Sau
                        </button>
                        <button
                            onClick={() => setCurrentPage(totalPages)}
                            disabled={currentPage === totalPages}
                            className="px-2 py-1 rounded border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed text-xs text-slate-700 transition font-semibold"
                        >
                            Cuối
                        </button>
                    </div>
                    <span>Năm hiện tại: 2026</span>
                </div>
            </div>

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
                        
                        <form onSubmit={handleFormSubmit} className="p-6 overflow-y-auto space-y-4 flex-1">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-600 block">Số hồ sơ / Mã iGate <span className="text-red-500">*</span></label>
                                    <input 
                                        type="text" 
                                        className="w-full text-sm font-semibold p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 transition-all text-slate-800"
                                        placeholder="Ví dụ: HSPT-2026-00104"
                                        value={formData.soHieu}
                                        onChange={(e) => setFormData(prev => ({ ...prev, soHieu: e.target.value }))}
                                        required
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-600 block">Chủ hồ sơ (Tên đầy đủ) <span className="text-red-500">*</span></label>
                                    <input 
                                        type="text" 
                                        className="w-full text-sm font-semibold p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 transition-all text-slate-800"
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
                                        className="w-full text-sm font-semibold p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 transition-all text-slate-800"
                                        placeholder="SĐT di động..."
                                        value={formData.soDienThoai}
                                        onChange={(e) => setFormData(prev => ({ ...prev, soDienThoai: e.target.value }))}
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-600 block">Tên lĩnh vực</label>
                                    <select 
                                        className="w-full text-sm font-semibold p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-indigo-500 transition-all text-slate-800"
                                        value={formData.tenLinhVuc}
                                        onChange={(e) => setFormData(prev => ({ ...prev, tenLinhVuc: e.target.value }))}
                                    >
                                        {LINH_VUC_LIST.map(v => <option key={v} value={v}>{v}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-600 block">Tên thủ tục hành chính <span className="text-red-500">*</span></label>
                                <textarea 
                                    rows={2}
                                    className="w-full text-sm font-semibold p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-indigo-500 transition-all text-slate-850"
                                    placeholder="Ví dụ: Chuyển nhượng quyền sử dụng đất..."
                                    value={formData.tenThuTuc}
                                    onChange={(e) => setFormData(prev => ({ ...prev, tenThuTuc: e.target.value }))}
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-600 block">Ngày tiếp nhận</label>
                                    <div className="flex gap-1 items-center">
                                        <input 
                                            type="text" 
                                            placeholder="Ví dụ: 21/11/2025 14:41:12"
                                            className="w-full text-sm p-2 bg-slate-50 border border-slate-200 rounded-xl outline-none text-slate-800 font-semibold"
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
                                    <label className="text-xs font-bold text-slate-600 block">Ngày hẹn trả</label>
                                    <div className="flex gap-1 items-center">
                                        <input 
                                            type="text" 
                                            placeholder="Ví dụ: 28/11/2025"
                                            className="w-full text-sm p-2 bg-slate-50 border border-slate-200 rounded-xl outline-none text-slate-800 font-semibold"
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

                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-600 block">Ngày kết thúc xử lý</label>
                                    <div className="flex gap-1 items-center">
                                        <input 
                                            type="text" 
                                            placeholder="Ví dụ: 26/11/2025"
                                            className="w-full text-sm p-2 bg-slate-50 border border-slate-200 rounded-xl outline-none text-slate-800 font-semibold"
                                            value={formData.ngayKetThuc}
                                            onChange={(e) => setFormData(prev => ({ ...prev, ngayKetThuc: e.target.value }))}
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
                                                        setFormData(prev => ({ ...prev, ngayKetThuc: formatted }));
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

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-600 block">Cơ quan/đơn vị xử lý</label>
                                    <input 
                                        type="text" 
                                        className="w-full text-sm font-semibold p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none text-slate-800"
                                        value={formData.donVi}
                                        onChange={(e) => setFormData(prev => ({ ...prev, donVi: e.target.value }))}
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-600 block">Trạng thái hồ sơ iGate</label>
                                    <select 
                                        className="w-full text-sm font-semibold p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none text-indigo-900 bg-indigo-50"
                                        value={formData.trangThai}
                                        onChange={(e) => setFormData(prev => ({ ...prev, trangThai: e.target.value }))}
                                    >
                                        {TRANG_THAI_LIST.map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-600 block">Cán bộ thụ lý hiện tại</label>
                                <select 
                                    className="w-full text-sm font-semibold p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none text-slate-800"
                                    value={formData.canBoXuLy}
                                    onChange={(e) => setFormData(prev => ({ ...prev, canBoXuLy: e.target.value }))}
                                >
                                    {canBoList.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>

                            <div className="pt-4 border-t border-slate-100 flex justify-end gap-2.5">
                                <button 
                                    type="button" 
                                    onClick={() => setIsFormOpen(false)}
                                    className="px-4 py-2 text-slate-500 hover:bg-slate-100 rounded-xl text-sm font-bold transition-all"
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
        </div>
    );
};

export default IGateView;
