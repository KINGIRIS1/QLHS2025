import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx-js-style';
import { RecordFile, Employee, User, UserRole } from '../../types';
import { getNormalizedWard, getShortRecordType } from '../../constants';
import { getWardShortCode } from '../../utils/codeGenerator';
import { Search, RotateCcw, FileSpreadsheet, Trash2, Ban, Filter, Calendar, MapPin, User as UserIcon, Clock, AlertCircle } from 'lucide-react';
import { PaginationControls } from '../PaginationControls';
import { confirmAction } from '../../utils/appHelpers';

interface CancelledRecordsViewProps {
  records: RecordFile[];
  wards: string[];
  currentUser: User;
  employees?: Employee[];
  onRestoreRecord: (record: RecordFile) => Promise<boolean>;
  onDeleteRecord?: (record: RecordFile) => Promise<boolean>;
  onPreviewExcel: (wb: XLSX.WorkBook, name: string) => void;
}

const formatDateTimeDisplay = (isoStr?: string | null) => {
  if (!isoStr) return '-';
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return isoStr;
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return isoStr;
  }
};

const CancelledRecordsView: React.FC<CancelledRecordsViewProps> = ({
  records = [],
  wards,
  currentUser,
  onRestoreRecord,
  onDeleteRecord,
  onPreviewExcel
}) => {
  const isAdmin = currentUser?.role === UserRole.ADMIN;
  
  // Filters
  const [filterWard, setFilterWard] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterDate, setFilterDate] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(15);

  // Lọc tất cả các hồ sơ đã hủy
  const cancelledList = useMemo(() => {
    const map = new Map<string, RecordFile>();
    records.forEach(r => {
      if (r.id && r.isCancelled) {
        map.set(r.id, r);
      }
    });
    return Array.from(map.values());
  }, [records]);

  // Áp dụng bộ lọc
  const filteredRecords = useMemo(() => {
    const searchLower = searchTerm.toLowerCase().trim();

    return cancelledList.filter(r => {
      // 1. Lọc theo Xã / Phường
      if (filterWard !== 'all') {
        const normWard = (r.ward || '').toLowerCase().trim();
        const normTarget = filterWard.toLowerCase().trim();
        const wardSuffix = getWardShortCode(filterWard);
        const codeSuffix = (r.code || '').split('-').pop()?.toUpperCase() || '';
        
        if (!normWard.includes(normTarget) && !normTarget.includes(normWard) && codeSuffix !== wardSuffix) {
          return false;
        }
      }

      // 2. Lọc theo Loại hồ sơ
      if (filterType !== 'all') {
        const rType = (r.recordType || '').toLowerCase();
        if (filterType === 'measure') {
          if (r._isArchive || rType.includes('sao lục') || rType.includes('thuế') || rType.includes('cung cấp thông tin') || rType.includes('thu hồi')) {
            return false;
          }
        } else if (filterType === 'saoluc' && !rType.includes('sao lục')) {
          return false;
        } else if (filterType === 'vaoso' && !rType.includes('vào sổ')) {
          return false;
        } else if (filterType === 'dangky' && !rType.includes('đăng ký')) {
          return false;
        } else if (filterType === 'congvan' && !rType.includes('công văn')) {
          return false;
        } else if (filterType === 'tax' && !rType.includes('thuế')) {
          return false;
        } else if (filterType === 'info' && !rType.includes('cung cấp thông tin')) {
          return false;
        } else if (filterType === 'withdraw' && !rType.includes('thu hồi')) {
          return false;
        }
      }

      // 3. Lọc theo ngày tiếp nhận hoặc ngày hủy
      if (filterDate) {
        const recDate = r.receivedDate || '';
        const cancelDate = r.cancelledAt ? r.cancelledAt.split('T')[0] : '';
        if (recDate !== filterDate && cancelDate !== filterDate) {
          return false;
        }
      }

      // 4. Tìm kiếm từ khóa
      if (searchLower) {
        const matchCode = (r.code || '').toLowerCase().includes(searchLower);
        const matchName = (r.customerName || '').toLowerCase().includes(searchLower);
        const matchReason = (r.cancelReason || '').toLowerCase().includes(searchLower);
        const matchBy = (r.cancelledBy || '').toLowerCase().includes(searchLower);
        const matchAddress = (r.address || '').toLowerCase().includes(searchLower);
        if (!matchCode && !matchName && !matchReason && !matchBy && !matchAddress) {
          return false;
        }
      }

      return true;
    }).sort((a, b) => {
      const timeA = a.cancelledAt || a.receivedDate || '';
      const timeB = b.cancelledAt || b.receivedDate || '';
      return timeB.localeCompare(timeA);
    });
  }, [cancelledList, filterWard, filterType, filterDate, searchTerm]);

  const totalPages = Math.ceil(filteredRecords.length / itemsPerPage) || 1;
  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredRecords.slice(start, start + itemsPerPage);
  }, [filteredRecords, currentPage, itemsPerPage]);

  // Xử lý khôi phục
  const handleRestore = async (record: RecordFile) => {
    const ok = await confirmAction(`Bạn có chắc muốn KHÔI PHỤC hồ sơ ${record.code} về trạng thái hoạt động bình thường?`);
    if (ok) {
      await onRestoreRecord(record);
    }
  };

  // Xuất Excel hồ sơ đã hủy
  const handleExportExcel = () => {
    if (filteredRecords.length === 0) return;

    const tableHeader = [
      "STT", "Mã Hồ Sơ", "Chủ Sử Dụng", "Xã / Phường", "Tờ", "Thửa", 
      "Loại Hồ Sơ", "Ngày Nhận", "Lý Do Hủy", "Người Thực Hiện Hủy", "Thời Gian Hủy"
    ];

    const dataRows = filteredRecords.map((r, i) => [
      i + 1,
      r.code || '',
      r.customerName || '',
      getNormalizedWard(r.ward),
      r.mapSheet || '-',
      r.landPlot || '-',
      getShortRecordType(r.recordType),
      r.receivedDate ? new Date(r.receivedDate).toLocaleDateString('vi-VN') : '',
      r.cancelReason || 'Không có lý do',
      r.cancelledBy || '-',
      formatDateTimeDisplay(r.cancelledAt)
    ]);

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([]);

    const border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
    const center = { alignment: { horizontal: "center", vertical: "center", wrapText: true } };
    const headerStyle = { font: { name: "Times New Roman", sz: 11, bold: true }, border, fill: { fgColor: { rgb: "FEE2E2" } }, ...center };
    const cellStyle = { font: { name: "Times New Roman", sz: 11 }, border, alignment: { vertical: "center", wrapText: true } };
    const centerCellStyle = { font: { name: "Times New Roman", sz: 11 }, border, alignment: { horizontal: "center", vertical: "center", wrapText: true } };
    const reasonStyle = { font: { name: "Times New Roman", sz: 11, color: { rgb: "991B1B" }, bold: true }, border, alignment: { vertical: "center", wrapText: true } };

    const titleStr = "DANH SÁCH HỒ SƠ ĐÃ HỦY TIẾP NHẬN";
    const exportDateStr = `Xuất ngày: ${new Date().toLocaleDateString('vi-VN')} ${new Date().toLocaleTimeString('vi-VN')}`;

    XLSX.utils.sheet_add_aoa(ws, [
      ["CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM"],
      ["Độc lập - Tự do - Hạnh phúc"],
      [""],
      [titleStr],
      [exportDateStr],
      [""],
      tableHeader
    ], { origin: "A1" });

    XLSX.utils.sheet_add_aoa(ws, dataRows, { origin: "A8" });

    const lastDataRowIndex = 7 + dataRows.length;

    if (!ws['!merges']) ws['!merges'] = [];
    ws['!merges'].push(
      { s: { r: 0, c: 0 }, e: { r: 0, c: 10 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 10 } },
      { s: { r: 3, c: 0 }, e: { r: 3, c: 10 } },
      { s: { r: 4, c: 0 }, e: { r: 4, c: 10 } }
    );

    ws['!cols'] = [
      { wch: 5 }, { wch: 16 }, { wch: 22 }, { wch: 15 }, { wch: 6 }, { wch: 6 },
      { wch: 18 }, { wch: 12 }, { wch: 28 }, { wch: 18 }, { wch: 18 }
    ];

    for (let c = 0; c <= 10; c++) {
      const ref = XLSX.utils.encode_cell({ r: 6, c });
      if (!ws[ref]) ws[ref] = { v: "", t: "s" };
      ws[ref].s = headerStyle;
    }

    for (let r = 7; r < lastDataRowIndex; r++) {
      for (let c = 0; c <= 10; c++) {
        const ref = XLSX.utils.encode_cell({ r, c });
        if (!ws[ref]) ws[ref] = { v: "", t: "s" };
        if (c === 0 || c === 4 || c === 5 || c === 7 || c === 10) ws[ref].s = centerCellStyle;
        else if (c === 8) ws[ref].s = reasonStyle;
        else ws[ref].s = cellStyle;
      }
    }

    onPreviewExcel(wb, `DanhSach_HoSo_DaHuy_${new Date().toISOString().split('T')[0]}`);
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 rounded-xl overflow-hidden animate-fade-in">
      {/* Top Banner / Filters */}
      <div className="bg-white p-4 border-b border-slate-200 shadow-xs space-y-3 shrink-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-red-100 text-red-600 rounded-xl shadow-xs">
              <Ban size={22} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                Danh sách Hồ sơ đã hủy
                <span className="bg-red-100 text-red-700 text-xs px-2.5 py-0.5 rounded-full font-extrabold">
                  {cancelledList.length} hồ sơ
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                Toàn bộ hồ sơ bị hủy/rút trong tiếp nhận (Đo đạc, Lưu trữ, Sao lục, Đăng ký, Công văn...)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportExcel}
              disabled={filteredRecords.length === 0}
              className="flex items-center gap-2 px-3.5 py-2 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-xl shadow-xs transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FileSpreadsheet size={15} />
              <span>Xuất Excel hồ sơ đã hủy</span>
            </button>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-2 border-t border-slate-100 text-xs">
          {/* Tìm kiếm */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
            <input
              type="text"
              placeholder="Tìm mã, chủ, lý do, người hủy..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-all bg-slate-50 focus:bg-white"
            />
          </div>

          {/* Lọc loại hồ sơ */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none bg-slate-50 focus:bg-white font-medium text-slate-700"
          >
            <option value="all">Tất cả loại hồ sơ</option>
            <option value="measure">Hồ sơ Đo đạc</option>
            <option value="saoluc">Sao lục hồ sơ</option>
            <option value="vaoso">Vào sổ</option>
            <option value="dangky">Đăng ký biến động</option>
            <option value="congvan">Công văn</option>
            <option value="tax">Thuế chính quy</option>
            <option value="info">Cung cấp thông tin</option>
            <option value="withdraw">Thu hồi GCN</option>
          </select>

          {/* Lọc xã / phường */}
          <select
            value={filterWard}
            onChange={(e) => setFilterWard(e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none bg-slate-50 focus:bg-white font-medium text-slate-700"
          >
            <option value="all">Tất cả Xã / Phường</option>
            {wards.map((w) => (
              <option key={w} value={w}>{getNormalizedWard(w)}</option>
            ))}
          </select>

          {/* Lọc ngày */}
          <div className="flex items-center gap-1.5">
            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none bg-slate-50 focus:bg-white font-medium text-slate-700"
            />
            {filterDate && (
              <button
                onClick={() => setFilterDate('')}
                className="px-2 py-2 text-slate-500 hover:text-slate-700 hover:bg-slate-200 rounded-lg shrink-0"
                title="Xóa lọc ngày"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Table Data */}
      <div className="flex-1 bg-white border-x border-b border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-0">
        <div className="overflow-auto flex-1">
          <table className="w-full text-left table-fixed min-w-[1400px]">
            <thead className="bg-slate-100 text-xs text-slate-600 uppercase font-bold sticky top-0 shadow-xs z-10 border-b border-slate-200">
              <tr>
                <th className="p-3.5 w-12 text-center">STT</th>
                <th className="p-3.5 w-[140px]">Mã Hồ Sơ</th>
                <th className="p-3.5 w-[190px]">Chủ Sử Dụng</th>
                <th className="p-3.5 w-[150px]">Xã / Phường</th>
                <th className="p-3.5 w-[140px]">Loại Hồ Sơ</th>
                <th className="p-3.5 w-[110px] text-center">Ngày Nhận</th>
                <th className="p-3.5 w-[260px] bg-red-50/70 text-red-900 border-x border-red-100">
                  Lý Do Hủy
                </th>
                <th className="p-3.5 w-[160px]">Người Hủy</th>
                <th className="p-3.5 w-[140px] text-center">Thời Gian Hủy</th>
                <th className="p-3.5 w-[130px] text-center sticky right-0 bg-slate-100 shadow-l">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {paginatedRecords.length > 0 ? (
                paginatedRecords.map((r, index) => (
                  <tr key={r.id || `canc-${index}`} className="hover:bg-red-50/20 group transition-colors">
                    <td className="p-3.5 text-center text-slate-400 font-mono text-xs font-semibold align-middle">
                      {(currentPage - 1) * itemsPerPage + index + 1}
                    </td>

                    {/* Mã hồ sơ */}
                    <td className="p-3.5 font-bold font-mono text-blue-600 truncate align-middle" title={r.code}>
                      <span className="line-through text-slate-400 mr-1.5 opacity-60">✕</span>
                      <span>{r.code}</span>
                    </td>

                    {/* Tên chủ */}
                    <td className="p-3.5 font-semibold text-slate-800 truncate align-middle" title={r.customerName}>
                      {r.customerName}
                    </td>

                    {/* Xã phường */}
                    <td className="p-3.5 text-slate-600 truncate align-middle font-medium" title={getNormalizedWard(r.ward)}>
                      {getNormalizedWard(r.ward)}
                    </td>

                    {/* Loại hồ sơ */}
                    <td className="p-3.5 truncate align-middle" title={r.recordType || ''}>
                      <span className="px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-700">
                        {getShortRecordType(r.recordType)}
                      </span>
                    </td>

                    {/* Ngày nhận */}
                    <td className="p-3.5 text-center text-slate-500 text-xs font-mono align-middle">
                      {r.receivedDate ? new Date(r.receivedDate).toLocaleDateString('vi-VN') : '-'}
                    </td>

                    {/* Lý do hủy */}
                    <td className="p-3.5 bg-red-50/30 border-x border-red-100 align-middle">
                      <div className="text-xs font-bold text-red-700 bg-red-100/80 px-2.5 py-1.5 rounded-lg border border-red-200 flex items-start gap-1.5 shadow-xs">
                        <AlertCircle size={14} className="text-red-500 shrink-0 mt-0.5" />
                        <span className="break-words line-clamp-2" title={r.cancelReason || 'Không có lý do'}>
                          {r.cancelReason || 'Không có lý do cụ thể'}
                        </span>
                      </div>
                    </td>

                    {/* Người hủy */}
                    <td className="p-3.5 text-slate-700 font-medium text-xs truncate align-middle" title={r.cancelledBy || '-'}>
                      <div className="flex items-center gap-1.5">
                        <UserIcon size={14} className="text-slate-400 shrink-0" />
                        <span className="font-semibold text-slate-800">{r.cancelledBy || 'Cán bộ'}</span>
                      </div>
                    </td>

                    {/* Thời gian hủy */}
                    <td className="p-3.5 text-center text-slate-600 text-xs font-mono align-middle">
                      <div className="flex items-center justify-center gap-1">
                        <Clock size={13} className="text-slate-400 shrink-0" />
                        <span>{formatDateTimeDisplay(r.cancelledAt)}</span>
                      </div>
                    </td>

                    {/* Thao tác */}
                    <td className="p-3 align-middle text-center sticky right-0 bg-white group-hover:bg-red-50/20 shadow-l transition-colors">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handleRestore(r)}
                          className="px-2.5 py-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-lg transition-all flex items-center gap-1 shadow-xs active:scale-95"
                          title="Khôi phục hồ sơ này về danh sách hoạt động"
                        >
                          <RotateCcw size={13} />
                          <span>Khôi phục</span>
                        </button>
                        {isAdmin && onDeleteRecord && (
                          <button
                            onClick={() => onDeleteRecord(r)}
                            className="p-1.5 text-red-500 hover:bg-red-100 rounded-lg transition-colors"
                            title="Xóa vĩnh viễn khỏi hệ thống"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={10} className="p-12 text-center text-slate-400 italic">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Ban size={36} className="text-slate-300 stroke-[1.5]" />
                      <span>Không có hồ sơ nào đã hủy khớp với bộ lọc hiện tại.</span>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <PaginationControls
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={filteredRecords.length}
          itemsPerPage={itemsPerPage}
          onPageChange={setCurrentPage}
          onItemsPerPageChange={setItemsPerPage}
          unitName="hồ sơ đã hủy"
        />
      </div>
    </div>
  );
};

export default CancelledRecordsView;
