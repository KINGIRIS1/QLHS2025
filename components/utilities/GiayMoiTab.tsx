import React, { useState, useEffect } from 'react';
import { PlusCircle, List, Save, Sparkles, RotateCcw } from 'lucide-react';
import saveAs from 'file-saver';
import { User as UserType, NotifyFunction } from '../../types';
import { GiayMoiRecord, fetchGiayMoiRecords, saveGiayMoiRecord, deleteGiayMoiRecord } from '../../services/apiUtilities';
import { GiayMoiData, generateGiayMoiDocx, getLastNameWord, formatThoiGianFull } from '../../utils/exportGiayMoiDocx';
import GiayMoiForm from './giay-moi-tab/GiayMoiForm';
import GiayMoiPreview from './giay-moi-tab/GiayMoiPreview';
import GiayMoiList from './giay-moi-tab/GiayMoiList';

interface GiayMoiTabProps {
    currentUser?: UserType;
    notify: NotifyFunction;
}

const SAMPLE_FILLED_GIAY_MOI: GiayMoiData = {
    soGiayMoi: '',
    soSymbol: '/GM-VPĐK.CT-TĐĐ',
    ngayMoi: new Date().getDate().toString().padStart(2, '0'),
    thangMoi: (new Date().getMonth() + 1).toString().padStart(2, '0'),
    namMoi: new Date().getFullYear().toString(),
    donViBanHanhCapTren: 'VĂN PHÒNG ĐĂNG KÝ ĐẤT ĐAI THÀNH PHỐ ĐỒNG NAI',
    donViBanHanhCapGiua: '',
    donViBanHanh: 'CHI NHÁNH CHƠN THÀNH',
    veViec: 'đo đạc, xác minh hiện trạng sử dụng đất của bà Nguyễn Thị Minh',
    kinhMoiList: [
        { id: '1', name: 'Đại diện Phòng Kinh tế, Hạ tầng và Đô thị phường Minh Hưng', address: '', phone: '' },
        { id: '2', name: 'Đại diện Công Ty TNHH C&N VINA', address: 'phường Minh Hưng, tỉnh Đồng Nai', phone: '0886.385.757' },
        { id: '3', name: 'Bà Nguyễn Thị Minh', address: 'phường Minh Hưng, thành phố Đồng Nai', phone: '0886.385.757' }
    ],
    noiDung: 'Tham gia phối hợp xác minh hiện trạng sử dụng thửa đất số 503, tờ bản đồ số 6 của bà Nguyễn Thị Minh tại Khu phố 5, phường Minh Hưng, thành phố Đồng Nai.',
    thoiGian: '14 giờ 30 phút, ngày 24/07/2026 (thứ Sáu)',
    diaDiem: 'Tại thực địa thửa đất số 503, tờ bản đồ số 6, Khu phố 5, phường Minh Hưng, thành phố Đồng Nai.',
    chuTri: '',
    loiDeNghi: 'Rất mong ông(bà) đại diện các cơ quan, cá nhân nói trên quan tâm phối hợp thực hiện./.',
    isDeNghiGiapRanh: true,
    textDeNghiGiapRanh: '(Đề nghị bà Nguyễn Thị Minh liên hệ với các chủ sử dụng đất giáp ranh cùng tham gia buổi xác minh, để thực hiện xác nhận ranh giới, mốc giới và ký biên bản tại thực địa).',
    canBoTen: '',
    canBoSdt: '',
    ghiChuCanBo: '',
    toVietTat: 'TĐĐ',
    noiNhan: [
        '- Như trên;',
        '- GĐ, PGĐ Chi nhánh;',
        '- Lưu: VT.'
    ],
    nguoiKyChucVu1: 'KT. GIÁM ĐỐC',
    nguoiKyChucVu2: 'PHÓ GIÁM ĐỐC',
    nguoiKyTen: '',

    // Subfields
    gioPhut: '14 giờ 30 phút',
    ngayThangNamIso: '2026-07-24',
    noiDungLamViec: 'Tham gia phối hợp xác minh hiện trạng sử dụng',
    soThua: '503',
    soTo: '6',
    chuSuDung: 'bà Nguyễn Thị Minh',
    diaChiThuaDat: 'Khu phố 5, phường Minh Hưng, thành phố Đồng Nai'
};

const DEFAULT_BLANK_GIAY_MOI: GiayMoiData = {
    soGiayMoi: '',
    soSymbol: '/GM-VPĐK.CT-TĐĐ',
    ngayMoi: new Date().getDate().toString().padStart(2, '0'),
    thangMoi: (new Date().getMonth() + 1).toString().padStart(2, '0'),
    namMoi: new Date().getFullYear().toString(),
    donViBanHanhCapTren: 'VĂN PHÒNG ĐĂNG KÝ ĐẤT ĐAI THÀNH PHỐ ĐỒNG NAI',
    donViBanHanhCapGiua: '',
    donViBanHanh: 'CHI NHÁNH CHƠN THÀNH',
    veViec: '',
    kinhMoiList: [],
    noiDung: '',
    thoiGian: '',
    diaDiem: '',
    chuTri: '',
    loiDeNghi: 'Rất mong ông(bà) đại diện các cơ quan, cá nhân nói trên quan tâm phối hợp thực hiện./.',
    isDeNghiGiapRanh: false,
    textDeNghiGiapRanh: '(Đề nghị chủ sử dụng đất liên hệ với các chủ sử dụng đất giáp ranh cùng tham gia buổi xác minh, để thực hiện xác nhận ranh giới, mốc giới và ký biên bản tại thực địa).',
    canBoTen: '',
    canBoSdt: '',
    ghiChuCanBo: '',
    toVietTat: 'TĐĐ',
    noiNhan: [
        '- Như trên;',
        '- GĐ, PGĐ Chi nhánh;',
        '- Lưu: VT.'
    ],
    nguoiKyChucVu1: 'KT. GIÁM ĐỐC',
    nguoiKyChucVu2: 'PHÓ GIÁM ĐỐC',
    nguoiKyTen: '',

    // Subfields
    gioPhut: '08 giờ 00 phút',
    ngayThangNamIso: new Date().toISOString().split('T')[0],
    noiDungLamViec: 'Tham gia phối hợp xác minh hiện trạng sử dụng',
    soThua: '',
    soTo: '',
    chuSuDung: '',
    diaChiThuaDat: ''
};

const GiayMoiTab: React.FC<GiayMoiTabProps> = ({ currentUser, notify }) => {
    const [mode, setMode] = useState<'create' | 'list'>('create');
    const [savedRecords, setSavedRecords] = useState<GiayMoiRecord[]>([]);
    const [editingId, setEditingId] = useState<string | null>(null);

    const [formData, setFormData] = useState<GiayMoiData>(() => {
        const cached = localStorage.getItem('CACHE_GIAY_MOI_FORM');
        if (cached) {
            try {
                const parsed = JSON.parse(cached);
                if (!parsed.donViBanHanhCapTren || parsed.donViBanHanhCapTren.trim() === 'VĂN PHÒNG ĐĂNG KÝ ĐẤT ĐAI') {
                    parsed.donViBanHanhCapTren = 'VĂN PHÒNG ĐĂNG KÝ ĐẤT ĐAI THÀNH PHỐ ĐỒNG NAI';
                }
                return parsed;
            } catch (e) { }
        }
        return SAMPLE_FILLED_GIAY_MOI;
    });

    useEffect(() => {
        if (!formData.donViBanHanhCapTren || formData.donViBanHanhCapTren.trim() === 'VĂN PHÒNG ĐĂNG KÝ ĐẤT ĐAI') {
            setFormData(prev => ({
                ...prev,
                donViBanHanhCapTren: 'VĂN PHÒNG ĐĂNG KÝ ĐẤT ĐAI THÀNH PHỐ ĐỒNG NAI'
            }));
        }
    }, []);

    // Sync currentUser info on initial mount or when currentUser changes if canBoTen is default/empty
    useEffect(() => {
        if (currentUser?.name && (!formData.canBoTen || formData.canBoTen === 'Nguyễn Quốc Thái')) {
            const activeUserName = currentUser.name;
            const lastName = getLastNameWord(activeUserName);
            const activePhone = (currentUser as any)?.phone || formData.canBoSdt || '0384844113';

            setFormData(prev => ({
                ...prev,
                canBoTen: activeUserName,
                canBoSdt: activePhone,
                ghiChuCanBo: `Để biết thêm chi tiết, liên hệ ông(bà) ${activeUserName} – Nhân viên Chi nhánh Chơn Thành${activePhone ? ', SĐT: ' + activePhone : ''}.`,
                noiNhan: [
                    '- Như trên;',
                    '- GĐ, PGĐ Chi nhánh;',
                    `- Lưu: VT. (TĐĐ ${lastName})`
                ]
            }));
        }
    }, [currentUser]);

    const [loading, setLoading] = useState(false);
    const [exportedFilePath, setExportedFilePath] = useState<string | null>(null);

    useEffect(() => {
        loadRecords();
    }, []);

    useEffect(() => {
        if (!editingId && mode === 'create') {
            localStorage.setItem('CACHE_GIAY_MOI_FORM', JSON.stringify(formData));
        }
    }, [formData, editingId, mode]);

    const loadRecords = async () => {
        const data = await fetchGiayMoiRecords();
        setSavedRecords(data);
    };

    const handleLoadSampleFilled = () => {
        const activeUserName = currentUser?.name || 'Nguyễn Quốc Thái';
        const lastName = getLastNameWord(activeUserName);
        const activePhone = (currentUser as any)?.phone || formData.canBoSdt || '0384844113';

        const now = new Date();
        const todayDay = now.getDate().toString().padStart(2, '0');
        const todayMonth = (now.getMonth() + 1).toString().padStart(2, '0');
        const todayYear = now.getFullYear().toString();
        const todayIso = now.toISOString().split('T')[0];
        const compiledThoiGian = formatThoiGianFull('14 giờ 30 phút', todayIso);

        setFormData({
            ...SAMPLE_FILLED_GIAY_MOI,
            soGiayMoi: '', // Để trống số giấy mời tránh in nhầm
            ngayMoi: todayDay, // Tự động lấy ngày hiện tại
            thangMoi: todayMonth, // Tự động lấy tháng hiện tại
            namMoi: todayYear, // Tự động lấy năm hiện tại
            ngayThangNamIso: todayIso,
            thoiGian: compiledThoiGian,
            canBoTen: activeUserName,
            canBoSdt: activePhone,
            ghiChuCanBo: `Để biết thêm chi tiết, liên hệ ông(bà) ${activeUserName} – Nhân viên Chi nhánh Chơn Thành, SĐT: ${activePhone}.`,
            noiNhan: [
                '- Như trên;',
                '- GĐ, PGĐ Chi nhánh;',
                `- Lưu: VT. (TĐĐ ${lastName || 'Thái'})`
            ]
        });
        setEditingId(null);
        notify("Đã nạp mẫu có sẵn với ngày hiện tại!", 'success');
    };

    const handleLoadBlankTemplate = () => {
        setFormData({
            ...DEFAULT_BLANK_GIAY_MOI,
            ngayMoi: new Date().getDate().toString().padStart(2, '0'),
            thangMoi: (new Date().getMonth() + 1).toString().padStart(2, '0'),
            namMoi: new Date().getFullYear().toString()
        });
        setEditingId(null);
        notify("Đã tạo mẫu trắng mới!", 'info');
    };

    const handleSaveRecord = async (silent: boolean = false) => {
        if (!formData.veViec) {
            if (!silent) notify("Vui lòng nhập trích yếu 'Về việc...' của Giấy mời.", 'error');
            return false;
        }

        const recordToSave: Partial<GiayMoiRecord> = {
            id: editingId || undefined,
            customer_name: formData.veViec,
            data: { formData },
            created_by: currentUser?.name || 'Hệ thống'
        };

        const success = await saveGiayMoiRecord(recordToSave);
        if (success) {
            await loadRecords();
            if (!silent) notify(editingId ? "Đã cập nhật Giấy mời!" : "Đã lưu Giấy mời thành công!", 'success');
        } else {
            if (!silent) notify("Lỗi khi lưu dữ liệu Giấy mời.", 'error');
        }
        return success;
    };

    const handleExportWord = async () => {
        setLoading(true);
        try {
            const blob = await generateGiayMoiDocx(formData);
            const fileName = `Giay_Moi_${formData.soGiayMoi ? 'So_' + formData.soGiayMoi : 'Moi'}_${Date.now()}.docx`;
            saveAs(blob, fileName);
            setExportedFilePath(fileName);
            notify("Đã xuất file Word Giấy mời thành công!", 'success');
        } catch (error) {
            console.error("Lỗi khi xuất Word Giấy mời:", error);
            notify("Lỗi khi tạo file Word Giấy mời.", 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleEditFromList = (item: GiayMoiRecord) => {
        setEditingId(item.id);
        if (item.data?.formData) {
            setFormData(item.data.formData);
        }
        setMode('create');
    };

    const handleDuplicateRecord = (item: GiayMoiRecord) => {
        setEditingId(null);
        if (item.data?.formData) {
            setFormData({
                ...item.data.formData,
                soGiayMoi: ''
            });
        }
        setMode('create');
        notify("Đã chép nội dung Giấy mời sang bản mới!", 'info');
    };

    const handleDeleteRecord = async (id: string) => {
        if (window.confirm("Bạn có chắc chắn muốn xóa Giấy mời này?")) {
            const success = await deleteGiayMoiRecord(id);
            if (success) {
                await loadRecords();
                notify("Đã xóa Giấy mời!", 'success');
            } else {
                notify("Lỗi khi xóa Giấy mời.", 'error');
            }
        }
    };

    return (
        <div className="flex flex-col h-full bg-white min-w-0 overflow-hidden">
            {/* SUB-NAVBAR FOR GIAY MOI */}
            <div className="bg-slate-100 border-b border-slate-200 px-4 py-2 flex flex-wrap justify-between items-center gap-2 shrink-0">
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setMode('create')}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                            mode === 'create'
                                ? 'bg-blue-600 text-white shadow-xs'
                                : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
                        }`}
                    >
                        <PlusCircle size={15} /> Soạn Giấy Mời
                    </button>

                    <button
                        onClick={() => setMode('list')}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                            mode === 'list'
                                ? 'bg-blue-600 text-white shadow-xs'
                                : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
                        }`}
                    >
                        <List size={15} /> Danh Sách ({savedRecords.length})
                    </button>
                </div>

                {mode === 'create' && (
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => handleSaveRecord(false)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs"
                            title="Lưu giấy mời vào hệ thống"
                        >
                            <Save size={15} /> {editingId ? 'Cập Nhật' : 'Lưu Lại'}
                        </button>
                    </div>
                )}
            </div>

            {/* MAIN CONTENT AREA */}
            {mode === 'create' ? (
                <div className="flex-1 flex min-h-0 overflow-hidden">
                    {/* LEFT FORM */}
                    <div className="w-full lg:w-1/2 flex flex-col min-h-0 bg-slate-50 border-r border-slate-200">
                        <GiayMoiForm
                            currentUser={currentUser}
                            formData={formData}
                            setFormData={setFormData}
                            handleLoadSampleFilled={handleLoadSampleFilled}
                            handleLoadBlankTemplate={handleLoadBlankTemplate}
                            handleSaveRecord={handleSaveRecord}
                            mode={mode}
                            setMode={setMode}
                            editingId={editingId}
                        />
                    </div>

                    {/* RIGHT PREVIEW (A4 PAPER) */}
                    <GiayMoiPreview
                        data={formData}
                        exportedFilePath={exportedFilePath}
                        handleOpenFile={() => {}}
                        handleExport={handleExportWord}
                        loading={loading}
                    />
                </div>
            ) : (
                <GiayMoiList
                    records={savedRecords}
                    onEdit={handleEditFromList}
                    onDelete={handleDeleteRecord}
                    onDuplicate={handleDuplicateRecord}
                    onCreateNew={() => {
                        setEditingId(null);
                        setMode('create');
                    }}
                />
            )}
        </div>
    );
};

export default GiayMoiTab;
