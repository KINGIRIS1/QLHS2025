import React, { useState, useMemo } from 'react';
import { RecordFile, Employee } from '../../types';
import { getNormalizedWard, STATUS_LABELS, STATUS_COLORS } from '../../constants';
import { Search, Printer, Calendar, Clock, MapPin, User, ChevronRight, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface ExtendedListProps {
  records: RecordFile[];
  archiveSaoLucRecords: RecordFile[];
  archiveVaoSoRecords: RecordFile[];
  archiveDangKyRecords: RecordFile[];
  archiveCongVanRecords: RecordFile[];
  wards: string[];
  currentUser: any;
  employees: Employee[];
  onPrint: (record: RecordFile) => void;
}

const normalizeWardName = (w: string) => {
    if (!w) return '';
    return w.toLowerCase()
        .replace(/^(xã|phường|thị trấn|tt\.|p\.|x\.)\s+/g, '')
        .replace(/\s+(xã|phường|thị trấn)\s+/g, ' ')
        .trim();
};

export const ExtendedList: React.FC<ExtendedListProps> = ({
  records,
  archiveSaoLucRecords = [],
  archiveVaoSoRecords = [],
  archiveDangKyRecords = [],
  archiveCongVanRecords = [],
  wards,
  currentUser,
  employees = [],
  onPrint
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [wardFilter, setWardFilter] = useState('all');

  // Lấy địa bàn phụ trách
  const linkedEmp = useMemo(() => {
    return employees.find(e => e.id === currentUser?.employeeId);
  }, [employees, currentUser]);

  const myManagedWards = useMemo(() => {
    return linkedEmp?.managedWards || [];
  }, [linkedEmp]);

  // Chuẩn hoá kiểm tra địa bàn được phân quyền
  const isManagedWard = (wardName: string) => {
    if (!wardName) return false;
    // Nếu cán bộ không cấu hình địa bàn phụ trách nào, cho hiển thị tất cả (đảm bảo quyền quản trị/trực ban)
    if (myManagedWards.length === 0) return true;
    
    const rWardNorm = normalizeWardName(wardName);
    return myManagedWards.some(w => {
      const wNorm = normalizeWardName(w);
      return rWardNorm.includes(wNorm) || wNorm.includes(rWardNorm);
    });
  };

  // Tổng hợp tất cả các hồ sơ có gia hạn (extendedDeadline từ tất cả các danh sách)
  const allExtendedRecords = useMemo(() => {
    const combined = [
      ...records,
      ...archiveSaoLucRecords,
      ...archiveVaoSoRecords,
      ...archiveDangKyRecords,
      ...archiveCongVanRecords
    ];

    // Lọc hồ sơ thực tế có gia hạn (extendedDeadline không rỗng) và thuộc địa bàn được phân quyền phụ trách
    return combined.filter(r => {
      const hasExtension = !!(r.extendedDeadline && r.extendedDeadline.trim() !== '');
      if (!hasExtension) return false;
      return isManagedWard(r.ward || '');
    });
  }, [records, archiveSaoLucRecords, archiveVaoSoRecords, archiveDangKyRecords, archiveCongVanRecords, myManagedWards]);

  // Thực hiện tìm kiếm và chọn lọc theo bộ lọc địa bàn
  const filteredRecords = useMemo(() => {
    const searchLower = searchTerm.toLowerCase().trim();
    return allExtendedRecords.filter(r => {
      if (wardFilter !== 'all') {
        const rWardNorm = normalizeWardName(r.ward || '');
        const filterWardNorm = normalizeWardName(wardFilter);
        if (rWardNorm !== filterWardNorm) return false;
      }

      if (searchLower) {
        const nameMatch = (r.customerName || '').toLowerCase().includes(searchLower);
        const codeMatch = (r.code || '').toLowerCase().includes(searchLower);
        const contentMatch = (r.content || '').toLowerCase().includes(searchLower);
        const cccdMatch = (r.cccd || '').toLowerCase().includes(searchLower);
        
        if (!nameMatch && !codeMatch && !contentMatch && !cccdMatch) return false;
      }

      return true;
    }).sort((a, b) => {
      // Sắp xếp theo hạn trả gia hạn mới nhất lên trên
      const dateA = a.extendedDeadline || '';
      const dateB = b.extendedDeadline || '';
      return dateB.localeCompare(dateA);
    });
  }, [allExtendedRecords, searchTerm, wardFilter]);

  // Format dạng ngày DD/MM/YYYY
  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '-';
    try {
      const [year, month, day] = dateStr.split('-');
      if (year && month && day) return `${day}/${month}/${year}`;
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('vi-VN');
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="flex flex-col h-full space-y-4 animate-fade-in">
      {/* Khung thông tin địa bàn cán bộ phụ trách */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg text-blue-700">
            <User size={20} />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-blue-900">Thông tin Cán bộ Tiếp nhận</h4>
            <div className="text-xs text-blue-700 font-medium">
              Địa bàn quản lý: {myManagedWards.length > 0 ? (
                <span className="bg-blue-600 text-white px-2 py-0.5 rounded ml-1 text-[11px] font-bold">
                  {myManagedWards.join(', ')}
                </span>
              ) : (
                <span className="text-gray-500 italic ml-1">Toàn bộ địa bàn (Quản trị viên)</span>
              )}
            </div>
          </div>
        </div>
        <div className="text-right text-xs text-gray-500 font-medium">
          Tổng số hồ sơ gia hạn của bạn: <span className="font-bold text-blue-600 text-sm">{allExtendedRecords.length}</span> hồ sơ
        </div>
      </div>

      {/* Thanh Search và Bộ lọc địa bàn */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-gray-50 p-3 rounded-xl border border-gray-100 shadow-sm">
        <div className="relative md:col-span-2">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-400">
            <Search size={16} />
          </span>
          <input
            type="text"
            placeholder="Tìm theo mã hồ sơ, tên khách hàng, nội dung..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm outline-none transition"
          />
        </div>

        <div>
          <select
            value={wardFilter}
            onChange={(e) => setWardFilter(e.target.value)}
            className="w-full border border-gray-200 rounded-lg py-2 px-3 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm outline-none transition"
          >
            <option value="all">Tất cả địa bàn phụ trách</option>
            {wards.map(w => (
              <option key={w} value={w}>{w}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Bảng danh sách hồ sơ gia hạn */}
      <div className="flex-1 overflow-x-auto border border-gray-100 rounded-xl shadow-sm bg-white min-h-[300px]">
        {filteredRecords.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center p-6">
            <AlertTriangle className="text-yellow-500 mb-2" size={36} />
            <p className="text-gray-500 font-medium text-sm">Không tìm thấy hồ sơ gia hạn nào phù hợp</p>
            <p className="text-xs text-gray-400 mt-1">Vui lòng kiểm tra lại điều kiện lọc hoặc từ khóa tìm kiếm</p>
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-xs font-semibold uppercase text-gray-600 tracking-wider">
                <th className="px-4 py-3 text-center w-12">STT</th>
                <th className="px-4 py-3">Mã hồ sơ</th>
                <th className="px-4 py-3">Tên khách hàng</th>
                <th className="px-4 py-3">Thể loại</th>
                <th className="px-4 py-3">Địa bàn</th>
                <th className="px-4 py-3 text-center">Hạn gốc</th>
                <th className="px-4 py-3 text-center">Hạn gia hạn mới</th>
                <th className="px-4 py-3">Người thực hiện</th>
                <th className="px-4 py-3 text-center">Trạng thái</th>
                <th className="px-4 py-3 text-center w-24">In phiếu</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 text-sm text-gray-700">
              {filteredRecords.map((r, index) => {
                const getRowTypeColor = (typeStr: string) => {
                  const t = (typeStr || '').toLowerCase();
                  if (t.includes('sao lục') || t.includes('lưu trữ')) return 'bg-cyan-50 text-cyan-700 border-cyan-100';
                  if (t.includes('vào sổ')) return 'bg-purple-50 text-purple-700 border-purple-100';
                  if (t.includes('đăng ký')) return 'bg-amber-50 text-amber-700 border-amber-100';
                  if (t.includes('công văn')) return 'bg-rose-50 text-rose-700 border-rose-100';
                  return 'bg-blue-50 text-blue-700 border-blue-100';
                };

                const assignedEmp = employees.find(e => e.id === r.assignedTo);
                const performerName = assignedEmp ? assignedEmp.name : 'Chưa phân công';
                const statusLabel = STATUS_LABELS[r.status] || r.status;
                const statusColor = STATUS_COLORS[r.status] || 'bg-gray-100 text-gray-800';

                return (
                  <tr key={r.id || index} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3 text-center font-mono text-xs text-gray-400">
                      {index + 1}
                    </td>
                    <td className="px-4 py-3 font-semibold text-blue-600 font-mono">
                      {r.code}
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <span className="font-semibold text-gray-900">{r.customerName}</span>
                        {r.cccd && <span className="block text-[11px] text-gray-400 font-medium">CCCD: {r.cccd}</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block text-[11px] px-2 py-0.5 rounded-full font-semibold border-2 ${getRowTypeColor(r.recordType || '')}`}>
                        {r.recordType || 'Đo đạc'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 text-xs text-gray-600">
                        <MapPin size={12} className="text-gray-400" />
                        <span>{r.ward}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center text-xs">
                      <div className="inline-flex items-center gap-1 text-gray-500 font-medium line-through">
                        <Calendar size={12} />
                        <span>{formatDate(r.deadline)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="inline-flex items-center gap-1 text-xs px-2.5 py-1 bg-amber-50 text-amber-700 font-bold rounded-lg border border-amber-200">
                        <Clock size={12} />
                        <span>{formatDate(r.extendedDeadline)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 text-xs">
                        <User size={13} className="text-gray-400" />
                        <span className={assignedEmp ? "font-semibold text-gray-800" : "text-gray-400 italic"}>
                          {performerName}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${statusColor}`}>
                        {statusLabel}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => onPrint(r)}
                        title="In phiếu tiếp nhận / Đơn gia hạn"
                        className="p-1 px-2.5 bg-gray-50 text-gray-600 border border-gray-200 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-300 rounded-lg transition-all text-xs font-semibold inline-flex items-center gap-1"
                      >
                        <Printer size={13} />
                        <span>In</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
