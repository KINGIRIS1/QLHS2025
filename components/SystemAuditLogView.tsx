import React, { useState, useEffect, useCallback } from 'react';
import { AuditLog, AuditActionType, AuditTargetType, User, UserRole } from '../types';
import { fetchAuditLogs, clearAuditLogs, exportAuditLogsToExcel, getActionText, getTargetText, computeFieldDifferences, FIELD_LABEL_MAP } from '../services/apiLogs';
import { 
  History, Search, Filter, Download, Trash2, RefreshCw, Eye, Calendar, User as UserIcon, 
  Shield, CheckCircle2, AlertCircle, X, ChevronRight, Clock, FileText, Activity, Layers, Tag,
  ChevronLeft, ChevronsLeft, ChevronsRight, ArrowRight, Code
} from 'lucide-react';

interface SystemAuditLogViewProps {
  currentUser: User;
}

const ACTION_OPTIONS: { value: string; label: string }[] = [
  { value: 'ALL', label: 'Tất cả hành động' },
  { value: 'CREATE', label: 'Thêm mới (CREATE)' },
  { value: 'UPDATE', label: 'Cập nhật (UPDATE)' },
  { value: 'DELETE', label: 'Xóa (DELETE)' },
  { value: 'LOGIN', label: 'Đăng nhập (LOGIN)' },
  { value: 'ASSIGN', label: 'Phân công (ASSIGN)' },
  { value: 'RETURN', label: 'Trả kết quả (RETURN)' },
  { value: 'EXPORT', label: 'Xuất Excel (EXPORT)' },
  { value: 'SYSTEM', label: 'Cấu hình (SYSTEM)' },
];

const TARGET_OPTIONS: { value: string; label: string }[] = [
  { value: 'ALL', label: 'Tất cả đối tượng' },
  { value: 'RECORD', label: 'Hồ sơ' },
  { value: 'CONTRACT', label: 'Hợp đồng' },
  { value: 'USER', label: 'Tài khoản' },
  { value: 'EMPLOYEE', label: 'Nhân sự' },
  { value: 'SETTINGS', label: 'Cấu hình' },
  { value: 'EXCERPT', label: 'Trích lục/Đo' },
  { value: 'ARCHIVE', label: 'Kho lưu trữ' },
  { value: 'BLOCKING', label: 'Văn bản ngăn chặn' },
];

const SystemAuditLogView: React.FC<SystemAuditLogViewProps> = ({ currentUser }) => {
  const isAdmin = currentUser.role === UserRole.ADMIN;
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedAction, setSelectedAction] = useState<string>('ALL');
  const [selectedTarget, setSelectedTarget] = useState<string>('ALL');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  
  // Pagination
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(15);

  // Modal Chi tiết Log
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [showRawJson, setShowRawJson] = useState<boolean>(false);

  const loadLogs = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await fetchAuditLogs({
        searchTerm,
        action: selectedAction,
        targetType: selectedTarget,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
        limit: 500
      });
      setLogs(data);
      setCurrentPage(1); // Reset vế trang 1 khi nạp lại hoặc đổi bộ lọc
    } catch (err) {
      console.error("Lỗi nạp nhật ký thao tác:", err);
    } finally {
      setIsLoading(false);
    }
  }, [searchTerm, selectedAction, selectedTarget, fromDate, toDate]);

  useEffect(() => {
    loadLogs();

    const handleLogAdded = () => {
      loadLogs();
    };

    window.addEventListener('audit_log_added', handleLogAdded);
    return () => {
      window.removeEventListener('audit_log_added', handleLogAdded);
    };
  }, [loadLogs]);

  const handleClearLogs = async () => {
    if (!isAdmin) return;
    if (window.confirm("Bạn có chắc chắn muốn XÓA TOÀN BỘ nhật ký thao tác? Hành động này không thể hoàn tác.")) {
      const ok = await clearAuditLogs();
      if (ok) {
        setLogs([]);
        alert("Đã xóa sạch nhật ký thao tác!");
      }
    }
  };

  const handleExport = () => {
    if (logs.length === 0) {
      alert("Không có dữ liệu log để xuất!");
      return;
    }
    exportAuditLogsToExcel(logs);
  };

  // Pagination calculations
  const totalRecords = logs.length;
  const totalPages = Math.ceil(totalRecords / pageSize) || 1;
  const validCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const startIndex = (validCurrentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalRecords);
  const paginatedLogs = logs.slice(startIndex, endIndex);

  // Generate page numbers to display
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (validCurrentPage > 3) pages.push('...');
      
      const start = Math.max(2, validCurrentPage - 1);
      const end = Math.min(totalPages - 1, validCurrentPage + 1);
      
      for (let i = start; i <= end; i++) pages.push(i);
      
      if (validCurrentPage < totalPages - 2) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  };

  const getActionBadge = (action: AuditActionType) => {
    switch (action) {
      case 'CREATE':
        return <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 inline-flex items-center gap-1"><CheckCircle2 size={12}/> Thêm mới</span>;
      case 'UPDATE':
        return <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-200 inline-flex items-center gap-1"><Activity size={12}/> Cập nhật</span>;
      case 'DELETE':
        return <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-200 inline-flex items-center gap-1"><AlertCircle size={12}/> Xóa</span>;
      case 'LOGIN':
        return <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-purple-100 text-purple-800 border border-purple-200 inline-flex items-center gap-1"><Shield size={12}/> Đăng nhập</span>;
      case 'ASSIGN':
        return <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200 inline-flex items-center gap-1"><UserIcon size={12}/> Phân công</span>;
      case 'RETURN':
        return <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-teal-100 text-teal-800 border border-teal-200 inline-flex items-center gap-1"><CheckCircle2 size={12}/> Trả kết quả</span>;
      case 'EXPORT':
        return <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200 inline-flex items-center gap-1"><Download size={12}/> Xuất dữ liệu</span>;
      default:
        return <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 text-slate-800 border border-slate-200">{action}</span>;
    }
  };

  const formatLogTime = (isoString: string) => {
    if (!isoString) return '---';
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return d.toLocaleString('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  return (
    <div className="flex flex-col h-full bg-slate-50/50 rounded-xl overflow-hidden p-3 md:p-5 gap-4">
      {/* HEADER & CONTROLS */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-md shadow-indigo-200">
            <History size={22} />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-slate-800 flex items-center gap-2">
              Lịch sử thao tác & Nhật ký hệ thống
              <span className="text-xs bg-indigo-50 text-indigo-700 px-2.5 py-0.5 rounded-full font-bold border border-indigo-200">
                {logs.length} thao tác
              </span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Ghi lại chi tiết mọi hành động thêm mới, sửa, xóa, phân công và xuất dữ liệu của từng cán bộ.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={loadLogs}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-all"
            title="Làm mới danh sách"
          >
            <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} />
            Làm mới
          </button>

          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-all shadow-sm"
          >
            <Download size={14} />
            Xuất Excel
          </button>

          {isAdmin && (
            <button
              onClick={handleClearLogs}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-all"
              title="Xóa toàn bộ nhật ký (Chỉ Admin)"
            >
              <Trash2 size={14} />
              Xóa log
            </button>
          )}
        </div>
      </div>

      {/* FILTER BAR */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {/* Search */}
        <div className="relative lg:col-span-2">
          <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm theo nội dung, người dùng, mã hồ sơ..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm('')} className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600">
              <X size={14} />
            </button>
          )}
        </div>

        {/* Action filter */}
        <div>
          <select
            value={selectedAction}
            onChange={(e) => setSelectedAction(e.target.value)}
            className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white font-medium text-slate-700"
          >
            {ACTION_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        {/* Target filter */}
        <div>
          <select
            value={selectedTarget}
            onChange={(e) => setSelectedTarget(e.target.value)}
            className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white font-medium text-slate-700"
          >
            {TARGET_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        {/* Date Filter */}
        <div className="flex items-center gap-1.5">
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
            title="Từ ngày"
          />
          <span className="text-slate-400 text-xs">-</span>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
            title="Đến ngày"
          />
        </div>
      </div>

      {/* TABLE DATA */}
      <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="flex-1 overflow-auto custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10 text-[11px] font-extrabold uppercase text-slate-600 tracking-wider">
              <tr>
                <th className="py-3 px-3.5 w-12 text-center">STT</th>
                <th className="py-3 px-3.5 w-40">Thời gian</th>
                <th className="py-3 px-3.5 w-48">Người thực hiện</th>
                <th className="py-3 px-3.5 w-32">Hành động</th>
                <th className="py-3 px-3.5 w-32">Đối tượng</th>
                <th className="py-3 px-3.5 w-36">Mã tham chiếu</th>
                <th className="py-3 px-3.5">Chi tiết thao tác</th>
                <th className="py-3 px-3.5 w-16 text-center">Xem</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 font-medium">
                    <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-indigo-500" />
                    Đang nạp dữ liệu lịch sử thao tác...
                  </td>
                </tr>
              ) : paginatedLogs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 font-medium">
                    <History size={32} className="mx-auto mb-2 opacity-30 text-slate-400" />
                    Chưa có lịch sử thao tác nào khớp với bộ lọc.
                  </td>
                </tr>
              ) : (
                paginatedLogs.map((log, idx) => (
                  <tr key={log.id} className="hover:bg-indigo-50/40 transition-colors group">
                    <td className="py-2.5 px-3.5 text-center font-semibold text-slate-400 text-[11px]">
                      {startIndex + idx + 1}
                    </td>

                    <td className="py-2.5 px-3.5 font-medium text-slate-600 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <Clock size={12} className="text-slate-400" />
                        {formatLogTime(log.createdAt)}
                      </div>
                    </td>

                    <td className="py-2.5 px-3.5 font-bold text-slate-800">
                      <div className="flex items-center gap-1.5">
                        <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-700 font-extrabold text-[10px] flex items-center justify-center border border-slate-200">
                          {(log.userName || 'H')[0]?.toUpperCase()}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-800">{log.userName || 'Hệ thống'}</div>
                          <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-tight">{log.userRole || 'SYSTEM'}</div>
                        </div>
                      </div>
                    </td>

                    <td className="py-2.5 px-3.5 whitespace-nowrap">
                      {getActionBadge(log.action)}
                    </td>

                    <td className="py-2.5 px-3.5 font-semibold text-slate-600 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 text-[11px]">
                        {getTargetText(log.targetType)}
                      </span>
                    </td>

                    <td className="py-2.5 px-3.5 font-mono text-xs font-bold text-indigo-700 whitespace-nowrap">
                      {log.targetCode || log.targetId || '---'}
                    </td>

                    <td className="py-2.5 px-3.5 text-slate-700 font-medium">
                      <div className="line-clamp-2">{log.details}</div>
                    </td>

                    <td className="py-2.5 px-3.5 text-center whitespace-nowrap">
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                        title="Xem chi tiết log"
                      >
                        <Eye size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* PAGINATION FOOTER */}
        <div className="bg-slate-50 border-t border-slate-200 px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600 font-medium shrink-0">
          <div className="flex flex-wrap items-center gap-3">
            <span>
              Hiển thị <strong className="text-slate-800">{totalRecords === 0 ? 0 : startIndex + 1}</strong> - <strong className="text-slate-800">{endIndex}</strong> trên tổng số <strong className="text-indigo-700">{totalRecords}</strong> thao tác
            </span>

            <div className="flex items-center gap-1.5 ml-2">
              <span className="text-slate-500 hidden sm:inline">Hiển thị:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="px-2 py-1 text-xs border border-slate-200 rounded-lg bg-white font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm cursor-pointer"
              >
                <option value={10}>10 dòng/trang</option>
                <option value={15}>15 dòng/trang</option>
                <option value={25}>25 dòng/trang</option>
                <option value={50}>50 dòng/trang</option>
                <option value={100}>100 dòng/trang</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage(1)}
              disabled={validCurrentPage === 1 || isLoading}
              className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              title="Trang đầu"
            >
              <ChevronsLeft size={16} />
            </button>
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={validCurrentPage === 1 || isLoading}
              className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              title="Trang trước"
            >
              <ChevronLeft size={16} />
            </button>

            <div className="flex items-center gap-1 px-1">
              {getPageNumbers().map((p, pIdx) => (
                typeof p === 'number' ? (
                  <button
                    key={pIdx}
                    onClick={() => setCurrentPage(p)}
                    className={`min-w-[28px] h-7 px-2 rounded-lg text-xs font-bold transition-all ${
                      validCurrentPage === p 
                        ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-200' 
                        : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {p}
                  </button>
                ) : (
                  <span key={pIdx} className="px-1 text-slate-400 font-bold">...</span>
                )
              ))}
            </div>

            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={validCurrentPage === totalPages || isLoading}
              className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              title="Trang sau"
            >
              <ChevronRight size={16} />
            </button>
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={validCurrentPage === totalPages || isLoading}
              className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              title="Trang cuối"
            >
              <ChevronsRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* MODAL CHI TIẾT LOG */}
      {selectedLog && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh]">
            {/* Modal Header */}
            <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-lg border border-indigo-500/30">
                  <Activity size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold uppercase tracking-wide">Chi tiết nhật ký thao tác</h3>
                  <p className="text-[11px] text-slate-400 font-mono">ID: {selectedLog.id}</p>
                </div>
              </div>

              <button
                onClick={() => setSelectedLog(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-5 overflow-y-auto space-y-4 text-xs custom-scrollbar">
              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Cán bộ thực hiện</span>
                  <span className="font-extrabold text-slate-800 text-sm block">{selectedLog.userName}</span>
                  <span className="text-[11px] font-semibold text-indigo-600 uppercase">{selectedLog.userRole}</span>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Thời gian ghi nhận</span>
                  <span className="font-bold text-slate-700 block">{formatLogTime(selectedLog.createdAt)}</span>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Hành động</span>
                  <div>{getActionBadge(selectedLog.action)}</div>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Đối tượng tác động</span>
                  <span className="font-bold text-slate-800">{getTargetText(selectedLog.targetType)} {selectedLog.targetCode ? `(${selectedLog.targetCode})` : ''}</span>
                </div>
              </div>

              <div>
                <h4 className="font-extrabold text-slate-800 text-xs mb-1.5 uppercase tracking-wide">Mô tả chi tiết</h4>
                <div className="bg-indigo-50/50 p-3 rounded-xl border border-indigo-100 text-slate-800 font-medium leading-relaxed">
                  {selectedLog.details}
                </div>
              </div>

              {/* Data Diff (old vs new) if available */}
              {(selectedLog.oldData || selectedLog.newData) && (() => {
                const diffs = computeFieldDifferences(selectedLog.oldData, selectedLog.newData);
                return (
                  <div className="space-y-3 pt-2 border-t border-slate-200">
                    <div className="flex items-center justify-between">
                      <h4 className="font-extrabold text-slate-800 text-xs uppercase tracking-wide flex items-center gap-1.5">
                        <Layers size={14} className="text-indigo-600" />
                        Chi tiết nội dung thay đổi
                        {diffs.length > 0 && (
                          <span className="bg-indigo-100 text-indigo-700 font-bold px-2 py-0.5 rounded-full text-[10px]">
                            {diffs.length} trường
                          </span>
                        )}
                      </h4>

                      <button
                        onClick={() => setShowRawJson(!showRawJson)}
                        className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-indigo-600 transition-colors"
                      >
                        <Code size={13} />
                        {showRawJson ? 'Xem dạng bảng' : 'Xem JSON gốc'}
                      </button>
                    </div>

                    {showRawJson ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {selectedLog.oldData && (
                          <div>
                            <span className="text-[11px] font-bold text-rose-600 block mb-1">Dữ liệu trước thay đổi (Gốc)</span>
                            <pre className="bg-slate-900 text-rose-300 p-3 rounded-xl font-mono text-[11px] overflow-x-auto max-h-48 custom-scrollbar">
                              {JSON.stringify(selectedLog.oldData, null, 2)}
                            </pre>
                          </div>
                        )}

                        {selectedLog.newData && (
                          <div>
                            <span className="text-[11px] font-bold text-emerald-600 block mb-1">Dữ liệu sau thay đổi (Mới)</span>
                            <pre className="bg-slate-900 text-emerald-300 p-3 rounded-xl font-mono text-[11px] overflow-x-auto max-h-48 custom-scrollbar">
                              {JSON.stringify(selectedLog.newData, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    ) : diffs.length > 0 ? (
                      <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px]">
                              <th className="py-2 px-3 w-1/3">Trường thông tin</th>
                              <th className="py-2 px-3 w-1/3 text-rose-700 bg-rose-50/50">Giá trị trước thay đổi</th>
                              <th className="py-2 px-3 w-1/3 text-emerald-700 bg-emerald-50/50">Giá trị sau thay đổi</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 bg-white">
                            {diffs.map((d, idx) => (
                              <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                <td className="py-2 px-3 font-bold text-slate-700">
                                  <div>{d.fieldLabel}</div>
                                  <div className="text-[10px] font-mono text-slate-400 font-normal">{d.fieldKey}</div>
                                </td>
                                <td className="py-2 px-3 text-rose-700 font-medium bg-rose-50/30 break-words">
                                  <span className="line-through decoration-rose-400 opacity-80">{d.oldValue}</span>
                                </td>
                                <td className="py-2 px-3 text-emerald-800 font-extrabold bg-emerald-50/30 break-words">
                                  {d.newValue}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                        <div className="text-[11px] font-bold text-slate-500 uppercase mb-2">
                          {selectedLog.action === 'CREATE' ? 'Thông tin ghi nhận tạo mới:' : selectedLog.action === 'DELETE' ? 'Thông tin dữ liệu bị xóa:' : 'Chi tiết các thuộc tính:'}
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          {Object.entries(selectedLog.newData || selectedLog.oldData || {})
                            .filter(([k]) => !['id', 'created_at', 'updated_at', 'history', 'attached_files', 'unblock_attached_files', 'files'].includes(k))
                            .slice(0, 12)
                            .map(([k, v], idx) => (
                              <div key={idx} className="flex flex-col bg-white p-2 rounded border border-slate-200/80">
                                <span className="text-[10px] text-slate-400 font-semibold">{FIELD_LABEL_MAP[k] || k}:</span>
                                <span className="font-bold text-slate-800 truncate">{String(v ?? '---')}</span>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Modal Footer */}
            <div className="bg-slate-50 px-5 py-3 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold rounded-lg transition-colors"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SystemAuditLogView;
