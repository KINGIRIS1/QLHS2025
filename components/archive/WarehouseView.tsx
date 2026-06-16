import React, { useState, useEffect, useMemo, useRef } from 'react';
import { User } from '../../types';
import { ArchiveRecord, fetchWarehouseRecordsPaginated, saveArchiveRecord, deleteArchiveRecord, importArchiveRecords, initRealtimeArchive } from '../../services/apiArchive';
import { Search, Plus, Trash2, Edit, Save, X, Eye, Calendar, FileSpreadsheet, Loader2, Download, AlertCircle, RefreshCw, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, SlidersHorizontal, BookOpen, Layers, Archive, HardDrive, CheckCircle2 } from 'lucide-react';
import { confirmAction } from '../../utils/appHelpers';
import * as XLSX from 'xlsx-js-style';

interface WarehouseViewProps {
    currentUser: User;
}

const WarehouseView: React.FC<WarehouseViewProps> = ({ currentUser }) => {
    const [records, setRecords] = useState<ArchiveRecord[]>([]);
    const [totalRecords, setTotalRecords] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 15;

    // Bộ lọc tìm kiếm nâng cao (Advanced Search)
    const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
    const [advMaBienNhan, setAdvMaBienNhan] = useState('');
    const [advLoaiHoSo, setAdvLoaiHoSo] = useState('');
    const [advChuSuDung, setAdvChuSuDung] = useState('');
    const [advCccd, setAdvCccd] = useState('');
    const [advToThua, setAdvToThua] = useState('');
    const [advKeTang, setAdvKeTang] = useState('');
    const [advHopSo, setAdvHopSo] = useState('');
    const [advSoPhatHanh, setAdvSoPhatHanh] = useState('');
    const [advNguoiNhap, setAdvNguoiNhap] = useState('');

    // State chi tiết & Chỉnh sửa hồ sơ
    const [selectedRecord, setSelectedRecord] = useState<ArchiveRecord | null>(null);
    const [isDetailOpen, setIsDetailOpen] = useState(false);
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [editFormData, setEditFormData] = useState<Partial<ArchiveRecord>>({});

    const fileInputRef = useRef<HTMLInputElement>(null);

    // Dynamic load với cơ chế debounce 300ms tránh spam API
    useEffect(() => {
        const timer = setTimeout(() => {
            loadData(currentPage);
        }, 300);

        return () => clearTimeout(timer);
    }, [currentPage, searchTerm, advMaBienNhan, advLoaiHoSo, advChuSuDung, advCccd, advToThua, advKeTang, advHopSo, advSoPhatHanh, advNguoiNhap]);

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

    const loadData = async (pageToLoad: number = currentPage) => {
        setIsLoading(true);
        try {
            const data = await fetchWarehouseRecordsPaginated(pageToLoad, itemsPerPage, {
                searchTerm,
                advMaBienNhan,
                advLoaiHoSo,
                advChuSuDung,
                advCccd,
                advToThua,
                advKeTang,
                advHopSo,
                advSoPhatHanh,
                advNguoiNhap
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
        setSearchTerm('');
        setAdvMaBienNhan('');
        setAdvLoaiHoSo('');
        setAdvChuSuDung('');
        setAdvCccd('');
        setAdvToThua('');
        setAdvKeTang('');
        setAdvHopSo('');
        setAdvSoPhatHanh('');
        setAdvNguoiNhap('');
        setCurrentPage(1);
    };

    const totalPages = Math.ceil(totalRecords / itemsPerPage) || 1;

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, advMaBienNhan, advLoaiHoSo, advChuSuDung, advCccd, advToThua, advKeTang, advHopSo, advSoPhatHanh, advNguoiNhap]);

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

    // Nhập dữ liệu Excel
    const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (evt) => {
            setIsLoading(true);
            try {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                
                // Read as JSON with headers
                const rows = XLSX.utils.sheet_to_json<any>(ws);
                if (rows.length === 0) {
                    alert("Tệp Excel trống hoặc không đúng định dạng!");
                    setIsLoading(false);
                    return;
                }

                // Chuyển đổi dữ liệu và chuẩn hóa các cột
                // Ánh xạ từ các trường Excel sang dạng data lưu trữ
                const parsedRecords: Partial<ArchiveRecord>[] = rows.map((row: any) => {
                    // Lấy ra mã biên nhận làm so_hieu chính
                    // Có thể dùng matd, nếu trống dùng mạvach, nếu vẫn trống dùng ngẫu nhiên mã tự sinh
                    const maBienNhan = (row.matd || row.mavach || `KB-${Math.floor(100000 + Math.random() * 900000)}`).toString().trim();
                    const loaiHoSo = (row.loaihoso || 'Chưa phân loại').toString().trim();
                    const trichYeuValue = `Hồ sơ kho: ${row.hoten1 || ''} - Sổ thửa: ${row.sothua || ''} / Tờ bđ: ${row.tobando || ''}`;

                    // Toàn bộ dữ liệu của hàng được đưa vào object config data
                    const rowData: any = {};
                    const excelFields = [
                        'sott', 'loaihoso', 'hoten1', 'namsinh1', 'loaicccd1', 'socccd', 'diachitt1',
                        'hoten2', 'namsinh2', 'loaicccd2', 'socccd2', 'diachitt2', 'matd', 'tobando',
                        'sothua', 'dientich', 'hinhthucsd', 'loaidato', 'dientichdato', 'mavach', 'maxa',
                        'manam', 'sophathanhgcnmoi', 'sovaosomoi', 'ngaycapgcnmoi', 'diachiap', 'soke_tang',
                        'so_o', 'So_tep', 'sott_tep', 'nguoinhap', 'ngaynhap', 'ghichu'
                    ];

                    excelFields.forEach(field => {
                        rowData[field] = row[field] !== undefined ? row[field] : null;
                    });

                    // Định dạng lại ngày nhập cho đúng chuẩn
                    let rawNgayNhap = rowData.ngaynhap;
                    let formattedNgayNhap = new Date().toISOString().split('T')[0];
                    if (rawNgayNhap) {
                        try {
                            if (typeof rawNgayNhap === 'number') {
                                // Excel Date serial format
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
                        status: 'completed', // Bặc định là lưu trữ xong
                        so_hieu: maBienNhan,
                        trich_yeu: trichYeuValue,
                        ngay_thang: formattedNgayNhap,
                        noi_nhan_gui: rowData.hoten1 || '',
                        created_by: currentUser.username || 'Hệ thống',
                        data: rowData
                    };
                });

                // Thực hiện lưu dữ liệu hàng loạt
                let successCount = 0;
                let failureCount = 0;

                // Để an toàn chống lỗi trùng lặp mã hồ sơ, ta import từng bản ghi hoặc kiểm tra trùng lặp
                // Chúng ta dùng hàm importArchiveRecords
                const success = await importArchiveRecords(parsedRecords);
                if (success) {
                    alert(`Nhập tập tin Excel thành công! Đã thêm ${parsedRecords.length} hồ sơ vào Kho lưu trữ.`);
                    loadData();
                } else {
                    // Nếu lỗi hàng loạt, ta thử chèn từng bản ghi (không kén trùng lắp)
                    alert("Nhập hàng loạt bị từ chối do có mã hồ sơ trùng lặp trong tệp Excel hoặc hệ thống. Vui lòng kiểm tra lại cột 'matd'.");
                }
            } catch (err: any) {
                console.error("Lỗi Import Excel:", err);
                alert("Đã xảy ra lỗi khi phân tích dữ liệu Excel!");
            } finally {
                setIsLoading(false);
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
            ['sott', 'loaihoso', 'hoten1', 'namsinh1', 'loaicccd1', 'socccd', 'diachitt1', 'hoten2', 'namsinh2', 'loaicccd2', 'socccd2', 'diachitt2', 'matd', 'tobando', 'sothua', 'dientich', 'hinhthucsd', 'loaidato', 'dientichdato', 'mavach', 'maxa', 'manam', 'sophathanhgcnmoi', 'sovaosomoi', 'ngaycapgcnmoi', 'diachiap', 'soke_tang', 'so_o', 'So_tep', 'sott_tep', 'nguoinhap', 'ngaynhap', 'ghichu']
        ];
        const sampleData = [
            [
                1, 'Đo đạc theo yêu cầu', 'Nguyễn Văn A', 1985, 'CCCD', '012345678912', 'Hà Nội', 
                'Trần Thị B', 1988, 'CCCD', '098765432109', 'Hà Nội', 'BN123456', '05', '124', 150.5, 
                'Sử dụng riêng', 'Đất ở', 100, 'MV999888', 'MX12', '2026', 'GCN-123456', 'VS-555666', 
                '2026-05-12', 'Ấp 1', 'Kệ 01A', 'Tầng 3', 'Hộp 12', 'STT 124', 'Trần Văn C', '2026-06-16', 'Hồ sơ đã lưu kho hoàn thiện'
            ]
        ];

        const worksheet = XLSX.utils.aoa_to_sheet([...headers, ...sampleData]);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Mau_Nhap_Kho');
        XLSX.writeFile(workbook, 'Mau_Nhap_Lieu_Kho.xlsx');
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
                        onClick={() => loadData(currentPage)}
                        title="Tải lại dữ liệu"
                        className="p-2 bg-white border border-slate-200 hover:border-slate-300 text-slate-600 rounded-xl transition-all shadow-sm active:rotate-180"
                    >
                        <RefreshCw size={14} />
                    </button>
                </div>
            </div>

            {/* BỘ LỌC TÌM KIẾM */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 mb-4 shrink-0 transition-all">
                <div className="flex flex-col md:flex-row gap-3">
                    <div className="flex-1 relative">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input
                            type="text"
                            placeholder="Nhập Mã biên nhận, Chủ sử dụng, CMND, Số GCN để tìm nhanh hồ sơ..."
                            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium transition-all"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        {searchTerm && (
                            <button 
                                onClick={() => setSearchTerm('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full"
                            >
                                <X size={12} />
                            </button>
                        )}
                    </div>

                    <div className="flex gap-2">
                        <button
                            onClick={() => setShowAdvancedSearch(!showAdvancedSearch)}
                            className={`px-4 py-2.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 ${
                                showAdvancedSearch 
                                ? 'bg-indigo-650 border-indigo-650 text-white shadow-md shadow-indigo-650/10' 
                                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                            }`}
                        >
                            <SlidersHorizontal size={14} /> Tìm kiếm nâng cao
                        </button>

                        {(searchTerm || advMaBienNhan || advLoaiHoSo || advChuSuDung || advCccd || advToThua || advKeTang || advHopSo || advSoPhatHanh || advNguoiNhap) && (
                            <button
                                onClick={handleResetFilters}
                                className="px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold transition-all active:scale-95"
                            >
                                Xóa bộ lọc
                            </button>
                        )}
                    </div>
                </div>

                {/* KHU VỰC TÌM KIẾM NÂNG CAO */}
                {showAdvancedSearch && (
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-4 pt-4 border-t border-slate-100 animate-slide-down">
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Mã biên nhận</label>
                            <input
                                type="text"
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-550"
                                placeholder="Ví dụ: BN123..."
                                value={advMaBienNhan}
                                onChange={(e) => setAdvMaBienNhan(e.target.value)}
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Loại hồ sơ</label>
                            <input
                                type="text"
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-550"
                                placeholder="Loại hồ sơ..."
                                value={advLoaiHoSo}
                                onChange={(e) => setAdvLoaiHoSo(e.target.value)}
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Chủ sử dụng</label>
                            <input
                                type="text"
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-550"
                                placeholder="Họ tên 1, 2..."
                                value={advChuSuDung}
                                onChange={(e) => setAdvChuSuDung(e.target.value)}
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">CCCD/CMND</label>
                            <input
                                type="text"
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-550"
                                placeholder="Mã số CCCD..."
                                value={advCccd}
                                onChange={(e) => setAdvCccd(e.target.value)}
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Tờ bản đồ / Số thửa</label>
                            <input
                                type="text"
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-550"
                                placeholder="Tờ, thửa..."
                                value={advToThua}
                                onChange={(e) => setAdvToThua(e.target.value)}
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Kệ / Tầng</label>
                            <input
                                type="text"
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-550"
                                placeholder="Vị trí kệ tầng..."
                                value={advKeTang}
                                onChange={(e) => setAdvKeTang(e.target.value)}
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Hộp số / Số tệp</label>
                            <input
                                type="text"
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-550"
                                placeholder="Hộp số, tệp..."
                                value={advHopSo}
                                onChange={(e) => setAdvHopSo(e.target.value)}
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Số Phát hành GCN</label>
                            <input
                                type="text"
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-550"
                                placeholder="Số mới phát hành..."
                                value={advSoPhatHanh}
                                onChange={(e) => setAdvSoPhatHanh(e.target.value)}
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Người nhập liệu</label>
                            <input
                                type="text"
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-550"
                                placeholder="Tên cán bộ nhập..."
                                value={advNguoiNhap}
                                onChange={(e) => setAdvNguoiNhap(e.target.value)}
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* DANH SÁCH HỒ SƠ KHO */}
            <div className="flex-1 bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col overflow-hidden min-h-0">
                <div className="overflow-auto flex-1">
                    <table className="w-full border-collapse text-left">
                        <thead className="bg-slate-50 border-b border-slate-100 sticky top-0 z-10 text-xs font-bold text-slate-600 uppercase tracking-wider">
                            <tr>
                                <th className="p-3.5 w-12 text-center">STT</th>
                                <th className="p-3.5 w-[140px]">Mã biên nhận</th>
                                <th className="p-3.5 min-w-[200px]">Thông tin chủ sử dụng</th>
                                <th className="p-3.5 w-[150px]">Tờ / Thửa / Diện tích</th>
                                <th className="p-3.5 w-[160px]">Loại hồ sơ</th>
                                <th className="p-3.5 w-[180px]">Vị trí lưu kho</th>
                                <th className="p-3.5 w-[140px]">Người nhập</th>
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
                                        Không tìm thấy hồ sơ nào đáp ứng điều kiện tìm kiếm.
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
                                            
                                            <td className="p-3.5 text-indigo-700 font-bold tracking-tight">
                                                {r.so_hieu}
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
                                            </td>

                                            <td className="p-3.5">
                                                <div className="truncate max-w-[160px] text-slate-600 text-xs bg-slate-100 px-2 py-1 rounded border border-slate-200 font-semibold w-fit" title={d.loaihoso || ''}>
                                                    {d.loaihoso || 'Chưa phân loại'}
                                                </div>
                                            </td>

                                            <td className="p-3.5">
                                                <div className="text-xs space-y-0.5">
                                                    <div>Kệ: <strong className="text-slate-800">{d.soke_tang || '-'}</strong></div>
                                                    <div>Hộp: <strong className="text-slate-800">{d.so_o || d.So_tep || '-'}</strong> {d.sott_tep && <>- STT: <strong className="text-slate-800">{d.sott_tep}</strong></>}</div>
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
                                                    <button
                                                        onClick={() => openEditModal(r)}
                                                        className="p-1.5 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded-lg transition-all"
                                                        title="Sửa hồ sơ"
                                                    >
                                                        <Edit size={14} />
                                                    </button>
                                                    <button
                                                        disabled={isSubmitting}
                                                        onClick={() => handleDelete(r.id, r.so_hieu)}
                                                        className="p-1.5 bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white rounded-lg transition-all"
                                                        title="Xóa hồ sơ"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
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

            {/* MODAL CHI TIẾT HỒ SƠ */}
            {isDetailOpen && selectedRecord && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-[100] p-4">
                    <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-scale-up border border-slate-100">
                        {/* Header */}
                        <div className="flex justify-between items-center bg-indigo-600 text-white p-5 shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-white/20 rounded-lg">
                                    <BookOpen size={18} />
                                </div>
                                <div>
                                    <h3 className="text-md font-bold">Chi Tiết Hồ Sơ Kho</h3>
                                    <p className="text-[11px] opacity-80">Mã biên nhận: {selectedRecord.so_hieu}</p>
                                </div>
                            </div>
                            <button 
                                onClick={() => setIsDetailOpen(false)}
                                className="p-1.5 bg-white/10 hover:bg-white/20 rounded-full transition-all"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-sm">
                            {/* Khối Thông tin chung */}
                            <div className="space-y-3.5">
                                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-100 pb-1.5">
                                    <SlidersHorizontal size={12} /> Thông tin hồ sơ cơ bản
                                </h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <div className="text-[11px] text-slate-400">Mã biên nhận:</div>
                                        <div className="font-bold text-slate-800 text-indigo-750">{selectedRecord.so_hieu}</div>
                                    </div>
                                    <div>
                                        <div className="text-[11px] text-slate-400">Loại hồ sơ:</div>
                                        <div className="font-semibold text-slate-800">{selectedRecord.data?.loaihoso || 'Chưa cập nhật'}</div>
                                    </div>
                                </div>
                            </div>

                            {/* Khối Chủ sử dụng */}
                            <div className="space-y-3.5 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                                    Thông tin chủ sử dụng đất
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 divide-y md:divide-y-0 md:divide-x divide-slate-150">
                                    {/* Chủ sử dụng 1 */}
                                    <div className="space-y-2">
                                        <div className="text-xs font-bold text-indigo-750">Chủ sử dụng 1 (Đại diện)</div>
                                        <div>
                                            <div className="text-[11px] text-slate-400">Họ tên:</div>
                                            <div className="font-bold text-slate-800">{selectedRecord.data?.hoten1 || '-'}</div>
                                        </div>
                                        {selectedRecord.data?.namsinh1 && (
                                            <div>
                                                <div className="text-[11px] text-slate-400">Năm sinh:</div>
                                                <div className="font-semibold text-slate-700">{selectedRecord.data.namsinh1}</div>
                                            </div>
                                        )}
                                        {selectedRecord.data?.socccd && (
                                            <div>
                                                <div className="text-[11px] text-slate-400">CMND/CCCD ({selectedRecord.data.loaicccd1 || 'CCCD'}):</div>
                                                <div className="font-mono text-slate-800">{selectedRecord.data.socccd}</div>
                                            </div>
                                        )}
                                        {selectedRecord.data?.diachitt1 && (
                                            <div>
                                                <div className="text-[11px] text-slate-400">Địa chỉ thường trú:</div>
                                                <div className="text-slate-700">{selectedRecord.data.diachitt1}</div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Chủ sử dụng 2 */}
                                    <div className="space-y-2 md:pl-4 pt-3 md:pt-0">
                                        <div className="text-xs font-bold text-indigo-750">Chủ sử dụng 2 (Đông sở hữu)</div>
                                        <div>
                                            <div className="text-[11px] text-slate-400">Họ tên:</div>
                                            <div className="font-bold text-slate-800">{selectedRecord.data?.hoten2 || '-'}</div>
                                        </div>
                                        {selectedRecord.data?.namsinh2 && (
                                            <div>
                                                <div className="text-[11px] text-slate-400">Năm sinh:</div>
                                                <div className="font-semibold text-slate-700">{selectedRecord.data.namsinh2}</div>
                                            </div>
                                        )}
                                        {selectedRecord.data?.socccd2 && (
                                            <div>
                                                <div className="text-[11px] text-slate-400">CMND / Số CCCD:</div>
                                                <div className="font-mono text-slate-800">{selectedRecord.data.socccd2}</div>
                                            </div>
                                        )}
                                        {selectedRecord.data?.diachitt2 && (
                                            <div>
                                                <div className="text-[11px] text-slate-400">Địa chỉ thường trú:</div>
                                                <div className="text-slate-700">{selectedRecord.data.diachitt2}</div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Khối Thửa đất */}
                            <div className="space-y-3.5">
                                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-100 pb-1.5">
                                    <Layers size={12} /> Thông tin thửa đất
                                </h4>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div>
                                        <div className="text-[11px] text-slate-400">Tờ bản đồ:</div>
                                        <div className="font-bold text-slate-800">{selectedRecord.data?.tobando || '-'}</div>
                                    </div>
                                    <div>
                                        <div className="text-[11px] text-slate-400">Số thửa:</div>
                                        <div className="font-bold text-slate-800">{selectedRecord.data?.sothua || '-'}</div>
                                    </div>
                                    <div>
                                        <div className="text-[11px] text-slate-400">Diện tích:</div>
                                        <div className="font-bold text-indigo-650">{selectedRecord.data?.dientich || '-'} m²</div>
                                    </div>
                                    <div>
                                        <div className="text-[11px] text-slate-400">Hình thức sử dụng:</div>
                                        <div className="font-semibold text-slate-800">{selectedRecord.data?.hinhthucsd || '-'}</div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                                    <div>
                                        <div className="text-[11px] text-slate-400">Địa chỉ thửa đất:</div>
                                        <div className="font-semibold text-slate-800">{selectedRecord.data?.diachiap || '-'}</div>
                                    </div>
                                    <div>
                                        <div className="text-[11px] text-slate-400">Loại đất ở (ODT/ONT) / Diện tích:</div>
                                        <div className="font-semibold text-slate-800">
                                            {selectedRecord.data?.loaidato || '-'} {selectedRecord.data?.dientichdato ? `/ ${selectedRecord.data.dientichdato} m²` : ''}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Khối Giấy chứng nhận mới */}
                            <div className="space-y-3.5">
                                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-100 pb-1.5">
                                    <Layers size={12} /> Giấy chứng nhận mới phát hành
                                </h4>
                                <div className="grid grid-cols-3 gap-4">
                                    <div>
                                        <div className="text-[11px] text-slate-400">Số phát hành:</div>
                                        <div className="font-semibold text-slate-850 text-indigo-700">{selectedRecord.data?.sophathanhgcnmoi || '-'}</div>
                                    </div>
                                    <div>
                                        <div className="text-[11px] text-slate-400">Số vào sổ:</div>
                                        <div className="font-semibold text-slate-850">{selectedRecord.data?.sovaosomoi || '-'}</div>
                                    </div>
                                    <div>
                                        <div className="text-[11px] text-slate-400">Ngày cấp GCN:</div>
                                        <div className="font-semibold text-slate-850">
                                            {selectedRecord.data?.ngaycapgcnmoi || '-'}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Khối Vị trí lưu kho */}
                            <div className="space-y-3.5 bg-indigo-50/40 p-4 rounded-2xl border border-indigo-100/50">
                                <h4 className="text-xs font-bold text-indigo-700 uppercase tracking-wider flex items-center gap-1">
                                    <Archive size={12} /> Thông tin vị trí lưu trữ trong kho
                                </h4>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div>
                                        <div className="text-[11px] text-slate-500">Kệ:</div>
                                        <div className="font-extrabold text-indigo-850">{selectedRecord.data?.soke_tang || '-'}</div>
                                    </div>
                                    <div>
                                        <div className="text-[11px] text-slate-500">Tầng:</div>
                                        <div className="font-extrabold text-indigo-850">{selectedRecord.data?.so_o || '-'}</div>
                                    </div>
                                    <div>
                                        <div className="text-[11px] text-slate-500">Hộp số (Số tệp):</div>
                                        <div className="font-extrabold text-indigo-850">{selectedRecord.data?.So_tep || '-'}</div>
                                    </div>
                                    <div>
                                        <div className="text-[11px] text-slate-500">Số thứ tự tệp:</div>
                                        <div className="font-extrabold text-indigo-850">{selectedRecord.data?.sott_tep || '-'}</div>
                                    </div>
                                </div>
                            </div>

                            {/* Khối Metadata */}
                            <div className="grid grid-cols-2 gap-4 text-xs text-slate-400 pt-2 border-t border-slate-100">
                                <div>
                                    Cán bộ nhập: <strong className="text-slate-650 font-bold">{selectedRecord.data?.nguoinhap || '-'}</strong>
                                </div>
                                <div className="text-right">
                                    Ngày nhập: <strong className="text-slate-650 font-semibold">{selectedRecord.data?.ngaynhap || '-'}</strong>
                                </div>
                            </div>

                            {selectedRecord.data?.ghichu && (
                                <div className="bg-amber-50 p-3 rounded-lg border border-amber-100 text-xs text-amber-800">
                                    <strong>Ghi chú:</strong> {selectedRecord.data.ghichu}
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 shrink-0">
                            <button
                                onClick={() => openEditModal(selectedRecord)}
                                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all active:scale-95 flex items-center gap-1 shadow-sm"
                            >
                                <Edit size={14} /> Chỉnh sửa hồ sơ
                            </button>
                            <button
                                onClick={() => setIsDetailOpen(false)}
                                className="px-4 py-2 border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold transition-all active:scale-95"
                            >
                                Đóng lại
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL CHỈNH SỬA HỒ SƠ */}
            {isEditOpen && editFormData && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-[100] p-4">
                    <form 
                        onSubmit={handleSaveEdit}
                        className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-scale-up border border-slate-100"
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
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="font-bold text-slate-700">Mã biên nhận (BN/MBN) <span className="text-rose-500">*</span></label>
                                    <input
                                        type="text"
                                        required
                                        className="w-full px-3.5 py-2 md:py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 font-bold text-slate-800"
                                        value={editFormData.so_hieu || ''}
                                        onChange={(e) => handleFormChange('so_hieu', e.target.value)}
                                    />
                                </div>

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
        </div>
    );
};

export default WarehouseView;
