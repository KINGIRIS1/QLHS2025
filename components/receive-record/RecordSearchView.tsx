import React, { useState, useMemo, useEffect } from 'react';
import { RecordFile, Employee } from '../../types';
import { RecordStatus } from '../../types';
import { Search, MapPin, CheckCircle, ShieldCheck, HelpCircle, Info, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Clock, CalendarClock } from 'lucide-react';
import { getShortRecordType } from '../../constants';

interface RecordSearchViewProps {
  records: RecordFile[];
  wards: string[];
  currentUser: any;
  employees: Employee[];
  onReturnResult: (record: RecordFile) => void;
  onExtendRecord?: (record: RecordFile, extDate: string) => Promise<boolean>;
}

const SEARCHABLE_RECORD_TYPES = [
  'Trích đo chỉnh lý bản đồ địa chính',
  'Trích đo bản đồ địa chính',
  'Trích lục bản đồ địa chính',
  'Trích đo',
  'Trích lục',
  'Đo đạc theo yêu cầu',
  'Cắm mốc',
  'Cung cấp thông tin quy hoạch',
  'Sao lục hồ sơ',
  'Thuế chính quy',
  'Cung cấp thông tin',
  'Thi hành án',
  'Tòa án'
];

export const RecordSearchView: React.FC<RecordSearchViewProps> = ({
  records,
  wards,
  currentUser,
  employees,
  onReturnResult,
  onExtendRecord
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterWard, setFilterWard] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterReturnStatus, setFilterReturnStatus] = useState<'all' | 'pending' | 'handover' | 'returned'>('all');

  // Trạng thái modal gia hạn
  const [showExtendModal, setShowExtendModal] = useState(false);
  const [selectedRecordForExtend, setSelectedRecordForExtend] = useState<RecordFile | null>(null);
  const [extendDateInput, setExtendDateInput] = useState('');
  const [isSubmittingExtend, setIsSubmittingExtend] = useState(false);

  const handleConfirmExtend = async () => {
    if (!selectedRecordForExtend || !extendDateInput) return;
    setIsSubmittingExtend(true);
    try {
      if (onExtendRecord) {
        const success = await onExtendRecord(selectedRecordForExtend, extendDateInput);
        if (success) {
          setShowExtendModal(false);
          setSelectedRecordForExtend(null);
          alert("Gia hạn thời gian nhận kết quả thành công!");
        } else {
          alert("Xảy ra lỗi trong quá trình gia hạn hồ sơ. Vui lòng thử lại!");
        }
      } else {
         alert("Hệ thống chưa hỗ trợ chức năng gia hạn tại view này!");
      }
    } catch (e) {
      console.error(e);
      alert("Đã xảy ra lỗi hệ thống khi gia hạn!");
    } finally {
      setIsSubmittingExtend(false);
    }
  };

  // Các trạng thái phân trang
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(15);

  // Đặt lại trang hiện tại về 1 khi bất kỳ tiêu chí lọc nào thay đổi
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterWard, filterType, filterReturnStatus, itemsPerPage]);

  // Lấy tên đầy đủ của trạng thái hành chính
  const getStatusBadge = (status: RecordStatus) => {
    switch (status) {
      case RecordStatus.RECEIVED:
        return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">Tiếp nhận</span>;
      case RecordStatus.ASSIGNED:
        return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-indigo-100 text-indigo-800">Đã phân công</span>;
      case RecordStatus.IN_PROGRESS:
        return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-amber-100 text-amber-800">Đang thực hiện</span>;
      case RecordStatus.COMPLETED_WORK:
        return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-800">Đã hoàn thành kỹ thuật</span>;
      case RecordStatus.PENDING_SIGN:
        return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-orange-100 text-orange-850">Chờ ký duyệt</span>;
      case RecordStatus.SIGNED:
        return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-teal-100 text-teal-800">Đã ký duyệt</span>;
      case RecordStatus.HANDOVER:
        return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-sky-100 text-sky-800">Đã chuyển 1 cửa</span>;
      case RecordStatus.RETURNED:
        return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800">Đã trả kết quả</span>;
      case RecordStatus.WITHDRAWN:
        return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-rose-100 text-rose-800">Đã rút hồ sơ</span>;
      default:
        return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">{status}</span>;
    }
  };

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return '-';
    try {
      const onlyDate = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr.split(' ')[0];
      const parts = onlyDate.split('-');
      if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('vi-VN');
    } catch {
      return dateStr;
    }
  };

  // Tiến hành lọc danh sách hồ sơ
  const filteredRecords = useMemo(() => {
    if (!records) return [];

    let result = records.filter(r => {
      // 1. Chỉ hiển thị các loại hồ sơ được chỉ định trong yêu cầu
      const rType = r.recordType || '';
      const matchedType = SEARCHABLE_RECORD_TYPES.some(t => {
        const normR = rType.toLowerCase().trim();
        const normT = t.toLowerCase().trim();
        return normR === normT || 
               (t === 'Sao lục hồ sơ' && normR.includes('sao lục')) ||
               (t === 'Thuế chính quy' && (normR.includes('thuế') || normR === 'tcq')) ||
               (t === 'Trích đo' && normR.includes('trích đo')) ||
               (t === 'Trích lục' && normR.includes('trích lục'));
      });
      if (!matchedType) return false;

      // 2. Lọc theo Loại hồ sơ cụ thể
      if (filterType !== 'all') {
        const fTypeLower = filterType.toLowerCase().trim();
        const normR = rType.toLowerCase().trim();
        if (fTypeLower === 'sao lục hồ sơ') {
          if (!normR.includes('sao lục')) return false;
        } else if (fTypeLower === 'thuế chính quy') {
          if (!normR.includes('thuế') && normR !== 'tcq') return false;
        } else if (fTypeLower === 'trích đo') {
          if (!normR.includes('trích đo')) return false;
        } else if (fTypeLower === 'trích lục') {
          if (!normR.includes('trích lục')) return false;
        } else {
          if (normR !== fTypeLower) return false;
        }
      }

      // 3. Lọc theo Xã/Phường
      if (filterWard !== 'all') {
        const normW1 = (r.ward || '').toLowerCase().trim();
        const normW2 = filterWard.toLowerCase().trim();
        if (!normW1.includes(normW2) && !normW2.includes(normW1)) return false;
      }

      // 4. Lọc theo trạng thái hồ sơ
      if (filterReturnStatus === 'pending') {
        // Chưa có kết quả: Tránh hiển thị hồ sơ đã giao 1 cửa, đã trả kết quả, đã rút hồ sơ
        const notPendingStatuses = [RecordStatus.HANDOVER, RecordStatus.RETURNED, RecordStatus.WITHDRAWN];
        if (notPendingStatuses.includes(r.status)) return false;
      } else if (filterReturnStatus === 'handover') {
        // Đã giao 1 cửa
        if (r.status !== RecordStatus.HANDOVER) return false;
      } else if (filterReturnStatus === 'returned') {
        // Đã trả kết quả
        if (r.status !== RecordStatus.RETURNED) return false;
      }

      // 5. Lọc theo từ khóa tìm kiếm (Mã HS, Tên, SĐT, CCCD, Tờ/Thửa)
      if (searchTerm.trim() !== '') {
        const query = searchTerm.toLowerCase().trim();
        const code = (r.code || '').toLowerCase();
        const name = (r.customerName || '').toLowerCase();
        const phone = (r.phoneNumber || '').toLowerCase();
        const cccd = (r.cccd || '').toLowerCase();
        const plot = (r.landPlot || '').toLowerCase();
        const sheet = (r.mapSheet || '').toLowerCase();

        const match = code.includes(query) ||
                      name.includes(query) ||
                      phone.includes(query) ||
                      cccd.includes(query) ||
                      plot.includes(query) ||
                      sheet.includes(query);

        if (!match) return false;
      }

      return true;
    });

    // Sắp xếp hồ sơ: Chưa trả ở trước, hồ sơ mới nhận ở trước
    return result.sort((a, b) => {
      if (a.status === RecordStatus.RETURNED && b.status !== RecordStatus.RETURNED) return 1;
      if (a.status !== RecordStatus.RETURNED && b.status === RecordStatus.RETURNED) return -1;
      
      const dateA = a.receivedDate || '';
      const dateB = b.receivedDate || '';
      return dateB.localeCompare(dateA);
    });
  }, [records, filterType, filterWard, filterReturnStatus, searchTerm]);

  // Phân trang dữ liệu
  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / itemsPerPage));
  const currentRecords = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredRecords.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredRecords, currentPage, itemsPerPage]);

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  // Tạo một dải số trang hiển thị thông minh
  const paginationRange = useMemo(() => {
    const range: number[] = [];
    const maxVisiblePages = 5;
    
    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    
    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }
    
    for (let i = startPage; i <= endPage; i++) {
      range.push(i);
    }
    return range;
  }, [currentPage, totalPages]);

  return (
    <div className="flex flex-col h-full space-y-4" id="record-search-view-container">
      {/* Khung tìm kiếm và bộ lọc */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-gray-50 p-4 rounded-xl border border-gray-100" id="search-filter-mesh">
        <div className="relative">
          <label className="block text-xs font-semibold text-gray-500 mb-1">Mã HS, chủ đất, SĐT...</label>
          <div className="relative">
            <input
              type="text"
              placeholder="Nhập thông tin tìm kiếm..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white border border-gray-300 rounded-lg pl-10 pr-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-medium"
              id="search-input-field"
            />
            <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">Chọn Xã / Phường</label>
          <select
            value={filterWard}
            onChange={(e) => setFilterWard(e.target.value)}
            className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-medium"
            id="filter-ward-select"
          >
            <option value="all">Tất cả địa bàn</option>
            {wards.map((w, idx) => (
              <option key={idx} value={w}>
                {w}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">Loại hồ sơ</label>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-medium"
            id="filter-type-select"
          >
            <option value="all">Tất cả loại hồ sơ hỗ trợ</option>
            {SEARCHABLE_RECORD_TYPES.map((t, idx) => (
              <option key={idx} value={t}>
                {getShortRecordType(t)} - {t}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1" id="filter-status-label-heading">Trạng thái hồ sơ</label>
          <select
            value={filterReturnStatus}
            onChange={(e) => setFilterReturnStatus(e.target.value as any)}
            className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-medium"
            id="filter-return-status-select"
          >
            <option value="all">Tất cả hồ sơ</option>
            <option value="pending">Chưa có kết quả</option>
            <option value="handover">Đã giao 1 cửa</option>
            <option value="returned">Đã trả kết quả</option>
          </select>
        </div>
      </div>

      {/* Thống kê nhanh số lượng lọc */}
      <div className="flex items-center justify-between px-1" id="stats-search-badge">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Info size={14} className="text-blue-500" />
          <span>Tìm thấy <strong>{filteredRecords.length}</strong> hồ sơ phù hợp.</span>
        </div>
        
        {/* Chọn số dòng hiển thị trên trang */}
        <div className="flex items-center gap-2 text-xs text-gray-500 select-none">
          <span>Hiển thị:</span>
          <select
            value={itemsPerPage}
            onChange={(e) => setItemsPerPage(Number(e.target.value))}
            className="bg-white border border-gray-300 rounded px-2 py-1 text-xs text-gray-700 focus:ring-2 focus:ring-blue-500 font-medium"
          >
            <option value={10}>10 dòng / trang</option>
            <option value={15}>15 dòng / trang</option>
            <option value={25}>25 dòng / trang</option>
            <option value={50}>50 dòng / trang</option>
            <option value={100}>100 dòng / trang</option>
          </select>
        </div>
      </div>

      {/* Bảng danh sách kết quả */}
      <div className="flex-1 overflow-x-auto border border-gray-100 rounded-xl bg-white shadow-inner" id="search-result-table-wrapper">
        <table className="w-full text-left border-collapse" id="search-records-dtable">
          <thead>
            <tr className="bg-gray-100/70 border-b border-gray-100 text-gray-700 text-xs font-bold uppercase tracking-wider">
              <th className="p-3 text-center w-[50px]">STT</th>
              <th className="p-3 w-[140px]">Mã hồ sơ</th>
              <th className="p-3 w-[180px]">Chủ sử dụng</th>
              <th className="p-3 w-[200px]">Loại hồ sơ</th>
              <th className="p-3 w-[140px]">Địa bàn & Thửa</th>
              <th className="p-3 w-[130px] text-center">Ngày nhận</th>
              <th className="p-3 w-[140px] text-center">Hẹn trả</th>
              <th className="p-3 w-[160px]">Người thực hiện</th>
              <th className="p-3 w-[140px] text-center">Chuyển 1 cửa</th>
              <th className="p-3 w-[130px] text-center">Trạng thái</th>
              <th className="p-3 text-center w-[180px]">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-sm">
            {currentRecords.length === 0 ? (
              <tr id="empty-search-row">
                <td colSpan={11} className="p-8 text-center text-gray-400">
                  <div className="flex flex-col items-center justify-center space-y-2">
                    <HelpCircle size={36} className="text-gray-300 animate-pulse" />
                    <span className="font-medium text-gray-500">Không tìm thấy hồ sơ nào phù hợp với bộ lọc.</span>
                    <span className="text-xs text-gray-450">Hãy thử thay đổi từ khóa hoặc trạng thái lọc ở thanh trên.</span>
                  </div>
                </td>
              </tr>
            ) : (
              currentRecords.map((r, index) => {
                const isReturned = r.status === RecordStatus.RETURNED;
                const isWithdrawn = r.status === RecordStatus.WITHDRAWN;
                const globalIndex = (currentPage - 1) * itemsPerPage + index + 1;
                const assignedEmployee = r.assignedTo ? employees.find(e => e.id === r.assignedTo) : null;

                return (
                  <tr key={r.id} className="hover:bg-blue-50/25 transition-all group" id={`search-row-${r.id}`}>
                    <td className="p-3 text-center text-gray-400 align-middle font-mono font-medium">{globalIndex}</td>
                    
                    <td className="p-3 align-middle font-mono font-bold text-blue-600 group-hover:text-blue-700">
                      {r.code}
                    </td>

                    <td className="p-3 align-middle">
                      <div className="font-bold text-gray-800">{r.customerName}</div>
                      {r.phoneNumber && (
                        <div className="text-xs text-gray-500 mt-0.5 select-all font-medium">SĐT: {r.phoneNumber}</div>
                      )}
                    </td>

                    <td className="p-3 align-middle">
                      <div className="text-xs font-semibold bg-gray-100 text-gray-700 px-2 py-1 rounded inline-block">
                        {getShortRecordType(r.recordType || undefined)}
                      </div>
                      <div className="text-xs text-gray-500 mt-1 truncate max-w-[190px]" title={r.recordType || ''}>{r.recordType}</div>
                    </td>

                    <td className="p-3 align-middle text-xs">
                      {r.ward && (
                        <div className="flex items-center text-gray-600 font-semibold mb-0.5">
                          <MapPin size={12} className="mr-0.5 text-gray-400 flex-shrink-0" />
                          {r.ward}
                        </div>
                      )}
                      {(r.landPlot || r.mapSheet) && (
                        <div className="text-gray-500">
                          Thửa <strong className="text-gray-700">{r.landPlot || '-'}</strong> / Tờ <strong className="text-gray-700">{r.mapSheet || '-'}</strong>
                          {r.area ? ` (${r.area} m²)` : ''}
                        </div>
                      )}
                    </td>

                    <td className="p-3 align-middle text-center text-gray-605 font-medium">
                      <div>{formatDate(r.receivedDate)}</div>
                    </td>

                    <td className="p-3 align-middle text-center text-gray-605 font-medium">
                      <div>{formatDate(r.deadline)}</div>
                      {r.extendedDeadline && (
                        <div className="text-[10px] text-amber-600 font-bold mt-1 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100 inline-block">
                          Gia hạn: {formatDate(r.extendedDeadline)}
                        </div>
                      )}
                    </td>

                    <td className="p-3 align-middle">
                      {assignedEmployee ? (
                        <div className="flex flex-col">
                          <span className="font-bold text-gray-800 text-xs">
                            {assignedEmployee.name}
                          </span>
                          {assignedEmployee.department && (
                            <span className="text-[10px] text-gray-500 font-semibold">
                              {assignedEmployee.department}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400 italic">Chưa giao việc</span>
                      )}
                    </td>

                    <td className="p-3 align-middle text-center text-xs">
                      {r.exportBatch || r.exportDate ? (
                        <div className="flex flex-col items-center justify-center space-y-0.5">
                          {r.exportDate && (
                            <span className="font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-100">
                              {formatDate(r.exportDate)}
                            </span>
                          )}
                          {r.exportBatch && (
                            <span className="text-[10px] text-gray-500 font-medium whitespace-nowrap">
                              Đợt: <strong>{r.exportBatch}</strong>
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-400 italic text-xs">-</span>
                      )}
                    </td>

                    <td className="p-3 align-middle text-center animate-fade-in">
                      {getStatusBadge(r.status)}
                    </td>

                    <td className="p-3 align-middle text-center">
                      {isReturned ? (
                        <div className="flex flex-col items-center justify-center space-y-0.5 text-emerald-600" id={`returned-label-${r.id}`}>
                          <ShieldCheck size={18} className="text-emerald-500" />
                          <span className="text-[10px] font-bold text-emerald-650">Người nhận:</span>
                          <span className="text-[10px] font-medium bg-emerald-50 px-1.5 py-0.5 rounded truncate max-w-[125px] text-emerald-700" title={r.receiverName || ''}>
                            {r.receiverName || 'Chủ hồ sơ'}
                          </span>
                          <span className="text-[9px] text-gray-450 font-mono">{formatDate(r.resultReturnedDate)}</span>
                        </div>
                      ) : isWithdrawn ? (
                        <span className="text-xs text-rose-500 font-bold bg-rose-50 px-2 py-1 rounded border border-rose-100" id={`withdrawn-label-${r.id}`}>
                          Đã rút hồ sơ
                        </span>
                      ) : (
                        <div className="flex flex-col gap-1.5 items-center justify-center">
                          <button
                            onClick={() => onReturnResult(r)}
                            className="w-full px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold inline-flex items-center justify-center gap-1 shadow-sm hover:shadow transition-all hover:scale-[1.03] active:scale-[0.98]"
                            title="Click để bấm trả kết quả cho dân"
                            id={`btn-return-action-${r.id}`}
                          >
                            <CheckCircle size={14} /> Trả kết quả
                          </button>
                          
                          <button
                            onClick={() => {
                              setSelectedRecordForExtend(r);
                              setExtendDateInput(r.extendedDeadline || r.deadline || '');
                              setShowExtendModal(true);
                            }}
                            className="w-full px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-bold inline-flex items-center justify-center gap-1 shadow-sm hover:shadow transition-all hover:scale-[1.03] active:scale-[0.98]"
                            title="Gia hạn thời gian người dân đến nhận kết quả"
                            id={`btn-extend-action-${r.id}`}
                          >
                            <Clock size={14} /> Gia hạn hồ sơ
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Bộ điều hướng phân trang (Pagination Footer) */}
      {filteredRecords.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-gray-50 p-4 rounded-xl border border-gray-100 mt-2 select-none" id="pagination-controls-bar">
          <div className="text-xs text-gray-500 font-medium font-sans" id="pagination-text-stats">
            Hiển thị từ <strong>{Math.min(filteredRecords.length, (currentPage - 1) * itemsPerPage + 1)}</strong> đến{' '}
            <strong>{Math.min(filteredRecords.length, currentPage * itemsPerPage)}</strong> trong tổng số{' '}
            <strong>{filteredRecords.length}</strong> hồ sơ.
          </div>

          <div className="flex items-center gap-1" id="pagination-buttons-cluster">
            {/* Về trang đầu */}
            <button
              onClick={() => handlePageChange(1)}
              disabled={currentPage === 1}
              className="p-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-white hover:text-blue-600 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-gray-600 transition-colors bg-white shadow-sm"
              title="Về Trang đầu"
              id="pagination-btn-first"
            >
              <ChevronsLeft size={16} />
            </button>

            {/* Trang trước */}
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="p-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-white hover:text-blue-600 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-gray-600 transition-colors bg-white shadow-sm"
              title="Trang trước"
              id="pagination-btn-prev"
            >
              <ChevronLeft size={16} />
            </button>

            {/* Các số trang cụ thể */}
            {paginationRange[0] > 1 && (
              <>
                <button
                  onClick={() => handlePageChange(1)}
                  className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-all ${
                    currentPage === 1
                      ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                      : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  1
                </button>
                {paginationRange[0] > 2 && <span className="text-gray-400 px-2 text-xs">...</span>}
              </>
            )}

            {paginationRange.map((page) => (
              <button
                key={page}
                onClick={() => handlePageChange(page)}
                className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-all ${
                  currentPage === page
                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm font-bold scale-[1.03]'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50 shadow-sm'
                }`}
              >
                {page}
              </button>
            ))}

            {paginationRange[paginationRange.length - 1] < totalPages && (
              <>
                {paginationRange[paginationRange.length - 1] < totalPages - 1 && (
                  <span className="text-gray-400 px-2 text-xs">...</span>
                )}
                <button
                  onClick={() => handlePageChange(totalPages)}
                  className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-all ${
                    currentPage === totalPages
                      ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                      : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50 shadow-sm'
                  }`}
                >
                  {totalPages}
                </button>
              </>
            )}

            {/* Trang sau */}
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="p-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-white hover:text-blue-600 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-gray-600 transition-colors bg-white shadow-sm"
              title="Trang tiếp"
              id="pagination-btn-next"
            >
              <ChevronRight size={16} />
            </button>

            {/* Về trang cuối */}
            <button
              onClick={() => handlePageChange(totalPages)}
              disabled={currentPage === totalPages}
              className="p-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-white hover:text-blue-600 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-gray-600 transition-colors bg-white shadow-sm"
              title="Về Trang cuối"
              id="pagination-btn-last"
            >
              <ChevronsRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* MODAL GIA HẠN HỒ SƠ */}
      {showExtendModal && selectedRecordForExtend && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 animate-fade-in p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl animate-scale-up border border-gray-100 flex flex-col gap-4">
            <div className="flex items-center gap-3 border-b border-gray-100 pb-3">
              <div className="p-2.5 bg-amber-50 rounded-xl text-amber-600">
                <Clock size={22} className="animate-pulse" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-800">Gia hạn thời gian nhận kết quả</h3>
                <p className="text-xs text-gray-500">Đặt thêm ngày hẹn mới trả kết quả cho người dân</p>
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-xs text-slate-650 space-y-2">
              <div className="flex justify-between">
                <span>Mã hồ sơ:</span>
                <strong className="text-gray-800">{selectedRecordForExtend.code}</strong>
              </div>
              <div className="flex justify-between">
                <span>Khách hàng:</span>
                <strong className="text-gray-800">{selectedRecordForExtend.customerName}</strong>
              </div>
              <div className="flex justify-between">
                <span>Loại hồ sơ:</span>
                <strong className="text-gray-800">{selectedRecordForExtend.recordType}</strong>
              </div>
              <div className="flex justify-between">
                <span>Hẹn trả gốc:</span>
                <strong className="text-blue-600 font-bold">{formatDate(selectedRecordForExtend.deadline)}</strong>
              </div>
              {selectedRecordForExtend.extendedDeadline && (
                <div className="flex justify-between">
                  <span>Hạn gia hạn hiện tại:</span>
                  <strong className="text-amber-600 font-bold">{formatDate(selectedRecordForExtend.extendedDeadline)}</strong>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">Ngày gia hạn mới</label>
              <input
                type="date"
                required
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white font-medium shadow-inner"
                value={extendDateInput}
                onChange={(e) => setExtendDateInput(e.target.value)}
              />
            </div>

            <div className="flex gap-3 mt-2">
              <button
                type="button"
                onClick={() => {
                  setShowExtendModal(false);
                  setSelectedRecordForExtend(null);
                }}
                className="flex-1 py-3 border border-gray-200 rounded-xl text-gray-700 hover:bg-gray-50 text-sm font-bold transition-all"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleConfirmExtend}
                disabled={isSubmittingExtend}
                className="flex-1 py-3 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white rounded-xl text-sm font-bold transition-all shadow-md shadow-amber-500/20 active:scale-95"
              >
                {isSubmittingExtend ? 'Đang cập nhật...' : 'Xác nhận'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
