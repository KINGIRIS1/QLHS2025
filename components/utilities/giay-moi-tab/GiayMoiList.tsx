import React, { useState } from 'react';
import { Search, Edit, Trash2, Copy, FileText, Calendar, Plus, RefreshCw } from 'lucide-react';
import { GiayMoiRecord } from '../../../services/apiUtilities';

interface GiayMoiListProps {
    records: GiayMoiRecord[];
    onEdit: (record: GiayMoiRecord) => void;
    onDelete: (id: string) => void;
    onDuplicate: (record: GiayMoiRecord) => void;
    onCreateNew: () => void;
}

const GiayMoiList: React.FC<GiayMoiListProps> = ({
    records,
    onEdit,
    onDelete,
    onDuplicate,
    onCreateNew
}) => {
    const [searchTerm, setSearchTerm] = useState('');

    const filteredRecords = records.filter(r => {
        const formData = r.data?.formData || {};
        const customer = r.customer_name || '';
        const veViec = formData.veViec || '';
        const soGM = formData.soGiayMoi || '';
        const noiDung = formData.noiDung || '';
        const term = searchTerm.toLowerCase();

        return (
            customer.toLowerCase().includes(term) ||
            veViec.toLowerCase().includes(term) ||
            soGM.toLowerCase().includes(term) ||
            noiDung.toLowerCase().includes(term)
        );
    });

    return (
        <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-slate-50 custom-scrollbar space-y-4">
            {/* SEARCH BAR & HEADER */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
                <div className="relative flex-1 min-w-[240px]">
                    <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Tìm kiếm theo trích yếu, người yêu cầu, số giấy mời..."
                        className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>

                <button
                    onClick={onCreateNew}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs"
                >
                    <Plus size={16} /> Soạn Giấy mời mới
                </button>
            </div>

            {/* LIST OF SAVED INVITATION LETTERS */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredRecords.map((item) => {
                    const fd = item.data?.formData || {};
                    const createdDate = item.created_at ? new Date(item.created_at).toLocaleDateString('vi-VN') : '';

                    return (
                        <div
                            key={item.id}
                            className="bg-white rounded-2xl border border-slate-200 hover:border-blue-300 hover:shadow-md transition-all p-4 flex flex-col justify-between space-y-3 group"
                        >
                            <div className="space-y-2">
                                <div className="flex items-start justify-between gap-2">
                                    <span className="px-2.5 py-1 bg-purple-50 text-purple-700 rounded-lg text-[11px] font-extrabold border border-purple-100">
                                        GM Số: {fd.soGiayMoi ? `${fd.soGiayMoi}${fd.soSymbol || ''}` : 'Chưa đánh số'}
                                    </span>
                                    <span className="text-[10px] font-medium text-slate-400 flex items-center gap-1">
                                        <Calendar size={12} /> {createdDate}
                                    </span>
                                </div>

                                <h3 className="font-bold text-slate-800 text-xs line-clamp-2 leading-relaxed">
                                    {fd.veViec ? `Về việc ${fd.veViec}` : 'Giấy mời (không tiêu đề)'}
                                </h3>

                                <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed bg-slate-50 p-2 rounded-lg border border-slate-100">
                                    {fd.noiDung || 'Chưa có nội dung chi tiết'}
                                </p>

                                <div className="text-[11px] text-slate-600 font-medium">
                                    <span className="font-bold text-slate-700">Thời gian: </span>
                                    {fd.thoiGian || 'Chưa hẹn'}
                                </div>
                            </div>

                            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                                <span className="text-[10px] text-slate-400">
                                    Tạo bởi: {item.created_by || 'Hệ thống'}
                                </span>

                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={() => onDuplicate(item)}
                                        className="p-1.5 text-slate-500 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                                        title="Sao chép tạo bản mới"
                                    >
                                        <Copy size={15} />
                                    </button>
                                    <button
                                        onClick={() => onEdit(item)}
                                        className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors font-bold flex items-center gap-1"
                                        title="Chỉnh sửa giấy mời"
                                    >
                                        <Edit size={15} />
                                    </button>
                                    <button
                                        onClick={() => onDelete(item.id)}
                                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                        title="Xóa bản ghi này"
                                    >
                                        <Trash2 size={15} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })}

                {filteredRecords.length === 0 && (
                    <div className="col-span-full py-12 text-center bg-white rounded-2xl border border-dashed border-slate-300 space-y-2">
                        <FileText size={36} className="mx-auto text-slate-300" />
                        <p className="text-xs font-bold text-slate-500">
                            {searchTerm ? 'Không tìm thấy Giấy mời phù hợp với từ khóa' : 'Chưa có Giấy mời nào được lưu trong danh sách'}
                        </p>
                        <p className="text-[11px] text-slate-400">
                            Nhấn nút "Soạn Giấy mời mới" hoặc "Nạp Mẫu Đã Có Thông Tin" để bắt đầu
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default GiayMoiList;
