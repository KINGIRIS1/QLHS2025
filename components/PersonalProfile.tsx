
import React, { useState, useMemo } from 'react';
import { RecordFile, RecordStatus, User } from '../types';
import StatusBadge from './StatusBadge';
import { Briefcase, ArrowRight, CheckCircle, Clock, Send, AlertTriangle, UserCog, ChevronLeft, ChevronRight, AlertCircle, Search, ArrowUp, ArrowDown, ArrowUpDown, Bell, CalendarClock, FileCheck, Map, CheckSquare } from 'lucide-react';
import { getShortRecordType } from '../constants';
import { confirmAction } from '../utils/appHelpers';
import { updateRecordApi } from '../services/api';

interface PersonalProfileProps {
  user: User;
  records: RecordFile[];
  onUpdateStatus: (record: RecordFile, newStatus: RecordStatus) => void;
  onViewRecord: (record: RecordFile) => void;
  onCreateLiquidation?: (record: RecordFile) => void; 
  onMapCorrection?: (record: RecordFile) => void; // New Handler Prop
}

function removeVietnameseTones(str: string): string {
    if (!str) return '';
    str = str.toLowerCase();
    str = str.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, "a");
    str = str.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, "e");
    str = str.replace(/ì|í|ị|ỉ|ĩ/g, "i");
    str = str.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, "o");
    str = str.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, "u");
    str = str.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, "y");
    str = str.replace(/đ/g, "d");
    str = str.replace(/\u0300|\u0301|\u0303|\u0309|\u0323/g, "");
    str = str.replace(/\u02C6|\u0306|\u031B/g, "");
    str = str.replace(/ + /g, " ");
    str = str.trim();
    return str;
}

const PersonalProfile: React.FC<PersonalProfileProps> = ({ user, records, onUpdateStatus, onViewRecord, onCreateLiquidation, onMapCorrection }) => {
  // Thêm tab 'completed_work' và 'pending_sign'
  const [activeTab, setActiveTab] = useState<'pending' | 'completed_work' | 'pending_sign' | 'reminder'>('pending');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: keyof RecordFile; direction: 'asc' | 'desc' }>({
    key: 'deadline',
    direction: 'desc' 
  });

  const myRecords = useMemo(() => {
    return records.filter(r => user.employeeId && r.assignedTo === user.employeeId);
  }, [records, user.employeeId]);
  
  // 1. Hồ sơ Đang thực hiện (ASSIGNED, IN_PROGRESS)
  const pendingRecords = useMemo(() => {
      let list = myRecords.filter(r => r.status === RecordStatus.ASSIGNED || r.status === RecordStatus.IN_PROGRESS);
      return filterAndSort(list, searchTerm, sortConfig);
  }, [myRecords, searchTerm, sortConfig]);

  // 2. Hồ sơ Đã thực hiện (COMPLETED_WORK)
  const completedWorkRecords = useMemo(() => {
      let list = myRecords.filter(r => r.status === RecordStatus.COMPLETED_WORK);
      return filterAndSort(list, searchTerm, sortConfig);
  }, [myRecords, searchTerm, sortConfig]);

  // 3. Hồ sơ Chờ ký (PENDING_SIGN) - Chuyển thành Tab chính
  const reviewRecords = useMemo(() => {
      let list = myRecords.filter(r => r.status === RecordStatus.PENDING_SIGN);
      return filterAndSort(list, searchTerm, sortConfig);
  }, [myRecords, searchTerm, sortConfig]);

  // 4. Hồ sơ Có hẹn nhắc việc
  const reminderRecords = useMemo(() => {
      let list = myRecords.filter(r => 
          r.reminderDate && 
          r.status !== RecordStatus.HANDOVER && 
          r.status !== RecordStatus.WITHDRAWN
      );
      // Logic search & sort riêng cho reminder
      if (searchTerm) {
          const lowerSearch = removeVietnameseTones(searchTerm);
          const rawSearch = searchTerm.toLowerCase();
          list = list.filter(r => {
             const nameNorm = removeVietnameseTones(r.customerName || '');
             const codeRaw = (r.code || '').toLowerCase();
             return nameNorm.includes(lowerSearch) || codeRaw.includes(rawSearch);
          });
      }
      return list.sort((a, b) => {
          const timeA = new Date(a.reminderDate!).getTime();
          const timeB = new Date(b.reminderDate!).getTime();
          return timeA - timeB;
      });
  }, [myRecords, searchTerm]);

  // Helper filter & sort chung
  function filterAndSort(list: RecordFile[], term: string, sort: any) {
      if (term) {
          const lowerSearch = removeVietnameseTones(term);
          const rawSearch = term.toLowerCase();
          list = list.filter(r => {
             const nameNorm = removeVietnameseTones(r.customerName || '');
             const codeRaw = (r.code || '').toLowerCase();
             const wardNorm = removeVietnameseTones(r.ward || '');
             return nameNorm.includes(lowerSearch) || codeRaw.includes(rawSearch) || wardNorm.includes(lowerSearch);
          });
      }
      return list.sort((a, b) => {
          const aValue = a[sort.key as keyof RecordFile];
          const bValue = b[sort.key as keyof RecordFile];
          if (!aValue) return 1;
          if (!bValue) return -1;
          if (aValue < bValue) return sort.direction === 'asc' ? -1 : 1;
          if (aValue > bValue) return sort.direction === 'asc' ? 1 : -1;
          return 0;
      });
  }

  // Tổng hợp các chỉ số
  const completedTotal = myRecords.filter(r => r.status === RecordStatus.SIGNED || r.status === RecordStatus.HANDOVER).length;

  // Xác định danh sách hiển thị dựa trên Tab đang chọn
  const displayRecords = 
      activeTab === 'pending' ? pendingRecords : 
      activeTab === 'completed_work' ? completedWorkRecords :
      activeTab === 'pending_sign' ? reviewRecords :
      reminderRecords;

  const totalPages = Math.ceil(displayRecords.length / itemsPerPage);
  
  const paginatedDisplayRecords = useMemo(() => {
      const startIndex = (currentPage - 1) * itemsPerPage;
      return displayRecords.slice(startIndex, startIndex + itemsPerPage);
  }, [displayRecords, currentPage, itemsPerPage]);

  const handleSort = (key: keyof RecordFile) => {
      let direction: 'asc' | 'desc' = 'asc';
      if (sortConfig.key === key && sortConfig.direction === 'asc') {
          direction = 'desc';
      }
      setSortConfig({ key, direction });
  };

  // --- ACTIONS ---
  
  // 1. Chuyển sang ĐÃ THỰC HIỆN (Từ tab Đang thực hiện)
  const handleMarkAsDone = async (record: RecordFile) => {
    if (await confirmAction(`Xác nhận đã hoàn thành công việc cho hồ sơ ${record.code}?\nHồ sơ sẽ chuyển sang trạng thái "Đã thực hiện".`)) {
      onUpdateStatus(record, RecordStatus.COMPLETED_WORK);
    }
  };

  // 2. Chuyển sang CHỜ KÝ (Từ tab Đã thực hiện)
  const handleForwardToSign = async (record: RecordFile) => {
    if (await confirmAction(`Bạn muốn chuyển hồ sơ ${record.code} sang trạng thái "Chờ ký kiểm tra"?`)) {
      onUpdateStatus(record, RecordStatus.PENDING_SIGN);
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '---';
    const date = new Date(dateStr);
    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const y = date.getFullYear();
    return `${d}/${m}/${y}`;
  };

  const formatDateTime = (dateStr?: string) => {
    if (!dateStr) return '---';
    const date = new Date(dateStr);
    const time = date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    return `${time} ${d}/${m}`;
  };

  const getDeadlineStatus = (record: RecordFile) => {
      // 1. Kiểm tra nếu đã hoàn thành/xuất hồ sơ thì KHÔNG tính trễ hạn
      // Nếu có exportBatch hoặc exportDate hoặc status là HANDOVER/RETURNED/SIGNED -> Coi như xong
      if (
          record.status === RecordStatus.HANDOVER || 
          record.status === RecordStatus.RETURNED || 
          record.status === RecordStatus.WITHDRAWN ||
          record.status === RecordStatus.SIGNED ||
          record.exportBatch || 
          record.exportDate ||
          record.resultReturnedDate
      ) {
           return { color: 'text-gray-600', icon: null, text: '' };
      }

      // 2. Nếu chưa xong, kiểm tra deadline
      const deadlineStr = record.deadline;
      if (!deadlineStr) return { color: 'text-gray-600', icon: null, text: '' };
      
      const today = new Date();
      today.setHours(0,0,0,0);
      const deadline = new Date(deadlineStr);
      deadline.setHours(0,0,0,0);

      const diffTime = deadline.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays < 0) return { color: 'text-red-600 font-bold', icon: <AlertCircle size={14} />, text: '(Quá hạn)' };
      if (diffDays <= 2) return { color: 'text-orange-600 font-bold', icon: <Clock size={14} />, text: '(Gấp)' };
      return { color: 'text-gray-600', icon: null, text: '' };
  };

  const renderSortHeader = (label: string, key: keyof RecordFile) => {
      const isSorted = sortConfig.key === key;
      return (
          <div className="flex items-center gap-1 cursor-pointer select-none" onClick={() => handleSort(key)}>
              {label}
              <span className="text-gray-400">
                {isSorted ? (
                    sortConfig.direction === 'asc' ? <ArrowUp size={12} className="text-blue-600"/> : <ArrowDown size={12} className="text-blue-600"/>
                ) : <ArrowUpDown size={12} />}
              </span>
          </div>
      );
  };

  // Helper để lấy tên Tab hiện tại cho placeholder
  const getTabLabel = () => {
      switch(activeTab) {
          case 'pending': return 'Đang thực hiện';
          case 'completed_work': return 'Đã thực hiện';
          case 'pending_sign': return 'Chờ ký';
          case 'reminder': return 'Nhắc việc';
          default: return 'danh sách';
      }
  };

  if (!user.employeeId) {
    return (
        <div className="flex flex-col items-center justify-center h-96 bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
            <div className="bg-orange-100 p-4 rounded-full mb-4">
                <UserCog size={48} className="text-orange-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">Tài khoản chưa liên kết nhân sự</h2>
            <p className="text-gray-600 max-w-md mb-6">
                Tài khoản <strong>{user.username}</strong> hiện là quản trị viên hệ thống nhưng chưa được liên kết với hồ sơ nhân viên cụ thể.
            </p>
        </div>
    );
  }

  return (
    <div className="flex flex-col h-full space-y-4 animate-fade-in-up overflow-hidden">
      {/* Header thống kê */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row items-center justify-between gap-4 shrink-0">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
             <Briefcase className="text-blue-600" />
             Xin chào, {user.name}
          </h2>
          <p className="text-gray-500 mt-1">Danh sách hồ sơ bạn đang phụ trách.</p>
        </div>
        <div className="flex gap-4 w-full md:w-auto justify-center">
             <div className="flex-1 md:flex-none text-center px-4 py-2 bg-blue-50 rounded-lg border border-blue-100 min-w-[100px]">
                <div className="text-2xl font-bold text-blue-700">{pendingRecords.length}</div>
                <div className="text-xs text-blue-600 uppercase font-semibold">Đang xử lý</div>
             </div>
             <div className="flex-1 md:flex-none text-center px-4 py-2 bg-cyan-50 rounded-lg border border-cyan-100 min-w-[100px]">
                <div className="text-2xl font-bold text-cyan-700">{completedWorkRecords.length}</div>
                <div className="text-xs text-cyan-600 uppercase font-semibold">Đã thực hiện</div>
             </div>
             <div className="flex-1 md:flex-none text-center px-4 py-2 bg-purple-50 rounded-lg border border-purple-100 min-w-[100px]">
                <div className="text-2xl font-bold text-purple-700">{reviewRecords.length}</div>
                <div className="text-xs text-purple-600 uppercase font-semibold">Chờ ký</div>
             </div>
             <div className="flex-1 md:flex-none text-center px-4 py-2 bg-green-50 rounded-lg border border-green-100 min-w-[100px]">
                <div className="text-2xl font-bold text-green-700">{completedTotal}</div>
                <div className="text-xs text-green-600 uppercase font-semibold">Hoàn thành</div>
             </div>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col min-h-0">
        
        {/* TABS & SEARCH */}
        <div className="p-4 border-b border-gray-100 bg-gray-50 flex flex-col md:flex-row justify-between items-center gap-4 shrink-0">
            <div className="flex bg-white rounded-lg p-1 border border-gray-200 shadow-sm overflow-x-auto max-w-full">
                <button 
                    onClick={() => { setActiveTab('pending'); setCurrentPage(1); setSearchTerm(''); }}
                    className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-bold transition-all whitespace-nowrap ${
                        activeTab === 'pending' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'
                    }`}
                >
                    <Clock size={16} /> Đang thực hiện ({pendingRecords.length})
                </button>
                <button 
                    onClick={() => { setActiveTab('completed_work'); setCurrentPage(1); setSearchTerm(''); }}
                    className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-bold transition-all whitespace-nowrap ${
                        activeTab === 'completed_work' ? 'bg-cyan-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'
                    }`}
                >
                    <CheckSquare size={16} /> Đã thực hiện ({completedWorkRecords.length})
                </button>
                <button 
                    onClick={() => { setActiveTab('pending_sign'); setCurrentPage(1); setSearchTerm(''); }}
                    className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-bold transition-all whitespace-nowrap ${
                        activeTab === 'pending_sign' ? 'bg-purple-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'
                    }`}
                >
                    <Send size={16} /> Chờ ký ({reviewRecords.length})
                </button>
                <button 
                    onClick={() => { setActiveTab('reminder'); setCurrentPage(1); setSearchTerm(''); }}
                    className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-bold transition-all whitespace-nowrap ${
                        activeTab === 'reminder' ? 'bg-pink-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'
                    }`}
                >
                    <Bell size={16} /> Nhắc việc ({reminderRecords.length})
                </button>
            </div>
            
            <div className="relative w-full md:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input 
                    type="text" 
                    placeholder={`Tìm trong ${getTabLabel()}...`}
                    className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                    value={searchTerm}
                    onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                />
            </div>
        </div>
        
        <div className="flex-1 overflow-y-auto">
            {displayRecords.length > 0 ? (
                <table className="w-full text-left table-fixed min-w-[900px]">
                    <thead className="bg-white border-b border-gray-200 text-xs text-gray-500 uppercase sticky top-0 shadow-sm z-10">
                        <tr>
                            <th className="p-3 w-10 text-center">#</th>
                            <th className="p-3 w-[120px]">{renderSortHeader('Mã HS', 'code')}</th>
                            <th className="p-3 w-[180px]">{renderSortHeader('Chủ sử dụng', 'customerName')}</th>
                            <th className="p-3 w-[130px]">{renderSortHeader('Loại hồ sơ', 'recordType')}</th>
                            
                            <th className="p-3 w-[150px]">
                                {activeTab === 'reminder' 
                                    ? <div className="flex items-center gap-1 text-pink-600"><CalendarClock size={14}/> Thời gian nhắc</div>
                                    : renderSortHeader('Hẹn trả', 'deadline')
                                }
                            </th>
                            
                            <th className="p-3 text-center w-[120px]">Trạng thái</th>
                            <th className="p-3 text-center w-[100px]">Chỉnh lý</th>
                            <th className="p-3 text-center w-[180px]">Thao tác chính</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-sm">
                        {paginatedDisplayRecords.map((r, index) => {
                            const deadlineStatus = getDeadlineStatus(r);
                            const rowClass = activeTab === 'reminder' ? 'hover:bg-pink-50/50 bg-pink-50/10' : 'hover:bg-blue-50/50';
                            
                            return (
                                <tr key={r.id} className={`${rowClass} transition-colors`}>
                                    <td className="p-3 text-center text-gray-400 text-xs align-middle">{(currentPage - 1) * itemsPerPage + index + 1}</td>
                                    <td className="p-3 font-medium text-blue-600 align-middle"><div className="truncate" title={r.code || ''}>{r.code}</div></td>
                                    <td className="p-3 font-medium text-gray-800 align-middle"><div className="truncate" title={r.customerName || ''}>{r.customerName}</div></td>
                                    <td className="p-3 text-gray-600 align-middle"><div className="truncate" title={r.recordType || ''}>{getShortRecordType(r.recordType || undefined)}</div></td>
                                    
                                    <td className="p-3 align-middle">
                                        {activeTab === 'reminder' ? (
                                            <div className="flex items-center gap-1.5 text-pink-700 font-bold bg-pink-100 px-2 py-1 rounded w-fit text-xs">
                                                <Bell size={12} className="fill-pink-700"/>
                                                {formatDateTime(r.reminderDate || undefined)}
                                            </div>
                                        ) : (
                                            <div className={`flex items-center gap-1.5 ${deadlineStatus.color}`}>
                                                {deadlineStatus.icon}
                                                <span>{formatDate(r.deadline || undefined)}</span>
                                                <span className="text-[10px] uppercase ml-1">{deadlineStatus.text}</span>
                                            </div>
                                        )}
                                    </td>

                                    <td className="p-3 text-center align-middle"><StatusBadge status={r.status} /></td>
                                    
                                    <td className="p-3 text-center align-middle">
                                        {onMapCorrection && (
                                            <button 
                                                onClick={() => onMapCorrection(r)}
                                                className={`flex items-center justify-center gap-1 px-2 py-1 rounded border transition-all text-[10px] font-bold shadow-sm mx-auto ${
                                                    r.needsMapCorrection 
                                                    ? 'bg-orange-50 text-orange-600 border-orange-200 hover:bg-orange-100 w-full' 
                                                    : 'bg-white text-gray-400 border-gray-200 hover:text-gray-600 hover:bg-gray-50'
                                                }`}
                                                title={r.needsMapCorrection ? "Đang có yêu cầu. Bấm để HỦY." : "Yêu cầu chỉnh lý bản đồ"}
                                            >
                                                <Map size={14} className={r.needsMapCorrection ? "fill-orange-100" : ""} />
                                                {r.needsMapCorrection && <span>CHỈNH LÝ</span>}
                                            </button>
                                        )}
                                    </td>

                                    <td className="p-3 align-middle">
                                        <div className="flex justify-center gap-2">
                                            <button onClick={() => onViewRecord(r)} className="px-2 py-1.5 border border-gray-200 rounded-md text-gray-600 hover:bg-white hover:border-blue-300 hover:text-blue-600 text-xs font-medium transition-all shadow-sm">
                                                Chi tiết
                                            </button>
                                            
                                            {/* Nút Thanh lý */}
                                            {onCreateLiquidation && (
                                                <button onClick={() => onCreateLiquidation(r)} className="px-2 py-1.5 bg-green-50 text-green-700 border border-green-200 rounded-md hover:bg-green-100 text-xs font-bold flex items-center gap-1 shadow-sm transition-all" title="Thanh lý hợp đồng">
                                                    <FileCheck size={14} /> Thanh lý
                                                </button>
                                            )}

                                            {/* Logic nút chuyển trạng thái theo từng Tab */}
                                            {activeTab === 'pending' && (
                                                <button onClick={() => handleMarkAsDone(r)} title="Đánh dấu đã xong việc" className="px-3 py-1.5 bg-cyan-600 text-white rounded-md hover:bg-cyan-700 text-xs font-bold flex items-center gap-2 shadow-sm transition-all">
                                                    Đã thực hiện <CheckSquare size={14} />
                                                </button>
                                            )}

                                            {activeTab === 'completed_work' && (
                                                <button onClick={() => handleForwardToSign(r)} title="Chuyển sang bước Ký kiểm tra" className="px-3 py-1.5 bg-purple-600 text-white rounded-md hover:bg-purple-700 text-xs font-bold flex items-center gap-2 shadow-sm transition-all">
                                                    Trình ký <Send size={14} />
                                                </button>
                                            )}
                                            
                                            {/* Tab Chờ ký không có nút hành động (chỉ xem) */}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            ) : (
                <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                    <CheckCircle size={48} className="text-gray-200 mb-2" />
                    <p>{searchTerm ? 'Không tìm thấy hồ sơ phù hợp.' : 'Không có hồ sơ nào trong danh sách này.'}</p>
                </div>
            )}
        </div>

        {/* PAGINATION FOOTER */}
        {displayRecords.length > 0 && (
            <div className="border-t border-gray-100 p-3 bg-gray-50 flex justify-between items-center shrink-0">
                <span className="text-xs text-gray-500">
                    Hiển thị <strong>{(currentPage - 1) * itemsPerPage + 1}</strong> - <strong>{Math.min(currentPage * itemsPerPage, displayRecords.length)}</strong> trên tổng <strong>{displayRecords.length}</strong>
                </span>
                <div className="flex items-center gap-1">
                    <button onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} disabled={currentPage === 1} className="p-1 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"><ChevronLeft size={18} /></button>
                    <span className="text-xs font-medium mx-2">Trang {currentPage} / {totalPages}</span>
                    <button onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} disabled={currentPage === totalPages} className="p-1 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"><ChevronRight size={18} /></button>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};

export default PersonalProfile;
