
import React, { useState, useMemo } from 'react';
import { RecordFile, RecordStatus, User } from '../types';
import StatusBadge from './StatusBadge';
import { Briefcase, ArrowRight, CheckCircle, Clock, Send, AlertTriangle, UserCog, ChevronLeft, ChevronRight, AlertCircle, Search, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { getShortRecordType } from '../constants';

interface PersonalProfileProps {
  user: User;
  records: RecordFile[];
  onUpdateStatus: (record: RecordFile, newStatus: RecordStatus) => void;
  onViewRecord: (record: RecordFile) => void;
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

const PersonalProfile: React.FC<PersonalProfileProps> = ({ user, records, onUpdateStatus, onViewRecord }) => {
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
  
  const pendingRecords = useMemo(() => {
      let list = myRecords.filter(r => r.status === RecordStatus.ASSIGNED || r.status === RecordStatus.IN_PROGRESS);

      if (searchTerm) {
          const lowerSearch = removeVietnameseTones(searchTerm);
          const rawSearch = searchTerm.toLowerCase();
          list = list.filter(r => {
             const nameNorm = removeVietnameseTones(r.customerName || '');
             const codeRaw = (r.code || '').toLowerCase();
             const wardNorm = removeVietnameseTones(r.ward || '');
             
             return nameNorm.includes(lowerSearch) || codeRaw.includes(rawSearch) || wardNorm.includes(lowerSearch);
          });
      }

      return list.sort((a, b) => {
          const aValue = a[sortConfig.key];
          const bValue = b[sortConfig.key];

          if (!aValue) return 1;
          if (!bValue) return -1;

          if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
          if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
          return 0;
      });
  }, [myRecords, searchTerm, sortConfig]);

  const reviewRecords = myRecords.filter(r => r.status === RecordStatus.PENDING_SIGN);
  const completedRecords = myRecords.filter(r => r.status === RecordStatus.SIGNED || r.status === RecordStatus.HANDOVER);

  const totalPages = Math.ceil(pendingRecords.length / itemsPerPage);
  const paginatedPendingRecords = useMemo(() => {
      const startIndex = (currentPage - 1) * itemsPerPage;
      return pendingRecords.slice(startIndex, startIndex + itemsPerPage);
  }, [pendingRecords, currentPage, itemsPerPage]);

  const handleSort = (key: keyof RecordFile) => {
      let direction: 'asc' | 'desc' = 'asc';
      if (sortConfig.key === key && sortConfig.direction === 'asc') {
          direction = 'desc';
      }
      setSortConfig({ key, direction });
  };

  const handleForwardToSign = (record: RecordFile) => {
    if (confirm(`Bạn muốn chuyển hồ sơ ${record.code} sang trạng thái "Chờ ký kiểm tra"?\nHãy chắc chắn bạn đã hoàn thành công việc.`)) {
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

  const getDeadlineStatus = (deadlineStr?: string) => {
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

  if (!user.employeeId) {
    return (
        <div className="flex flex-col items-center justify-center h-96 bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
            <div className="bg-orange-100 p-4 rounded-full mb-4">
                <UserCog size={48} className="text-orange-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">Tài khoản chưa liên kết nhân sự</h2>
            <p className="text-gray-600 max-w-md mb-6">
                Tài khoản <strong>{user.username}</strong> hiện là quản trị viên hệ thống nhưng chưa được liên kết với hồ sơ nhân viên cụ thể.
                <br/><br/>
                Để xem danh sách công việc cá nhân, vui lòng vào menu <strong>Quản lý tài khoản</strong> và cập nhật thông tin "Liên kết hồ sơ nhân viên".
            </p>
            <div className="flex items-center gap-2 text-sm text-blue-600 bg-blue-50 px-4 py-2 rounded-lg">
                <AlertTriangle size={16} />
                <span>Gợi ý: Nếu bạn muốn xem tất cả hồ sơ, hãy dùng menu <strong>"Tất cả hồ sơ"</strong>.</span>
            </div>
        </div>
    );
  }

  return (
    <div className="flex flex-col h-full space-y-4 animate-fade-in-up overflow-hidden">
      {/* Header thống kê - FIXED (SHRINK-0) */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row items-center justify-between gap-4 shrink-0">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
             <Briefcase className="text-blue-600" />
             Xin chào, {user.name}
          </h2>
          <p className="text-gray-500 mt-1">Dưới đây là danh sách hồ sơ bạn đang phụ trách.</p>
        </div>
        <div className="flex gap-4 w-full md:w-auto justify-center">
             <div className="flex-1 md:flex-none text-center px-4 py-2 bg-blue-50 rounded-lg border border-blue-100 min-w-[100px]">
                <div className="text-2xl font-bold text-blue-700">{pendingRecords.length}</div>
                <div className="text-xs text-blue-600 uppercase font-semibold">Đang xử lý</div>
             </div>
             <div className="flex-1 md:flex-none text-center px-4 py-2 bg-purple-50 rounded-lg border border-purple-100 min-w-[100px]">
                <div className="text-2xl font-bold text-purple-700">{reviewRecords.length}</div>
                <div className="text-xs text-purple-600 uppercase font-semibold">Chờ ký</div>
             </div>
             <div className="flex-1 md:flex-none text-center px-4 py-2 bg-green-50 rounded-lg border border-green-100 min-w-[100px]">
                <div className="text-2xl font-bold text-green-700">{completedRecords.length}</div>
                <div className="text-xs text-green-600 uppercase font-semibold">Hoàn thành</div>
             </div>
        </div>
      </div>

      {/* DANH SÁCH ĐANG XỬ LÝ (SCROLLABLE CONTENT) */}
      <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col min-h-0">
        <div className="p-4 border-b border-gray-100 bg-gray-50 flex flex-col md:flex-row justify-between items-center gap-4 shrink-0">
            <div className="flex items-center gap-2">
                <Clock size={18} className="text-orange-500" />
                <h3 className="font-bold text-gray-700">Hồ sơ đang thực hiện ({pendingRecords.length})</h3>
            </div>
            
            <div className="relative w-full md:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input 
                    type="text" 
                    placeholder="Tìm mã, tên, địa chỉ..." 
                    className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                    value={searchTerm}
                    onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                />
            </div>
        </div>
        
        <div className="flex-1 overflow-y-auto">
            {pendingRecords.length > 0 ? (
                <table className="w-full text-left table-fixed min-w-[900px]">
                    <thead className="bg-white border-b border-gray-200 text-xs text-gray-500 uppercase sticky top-0 shadow-sm z-10">
                        <tr>
                            <th className="p-3 w-10 text-center">#</th>
                            <th className="p-3 w-[120px]">{renderSortHeader('Mã HS', 'code')}</th>
                            <th className="p-3 w-[180px]">{renderSortHeader('Chủ sử dụng', 'customerName')}</th>
                            {/* THU HẸP CỘT LOẠI HỒ SƠ */}
                            <th className="p-3 w-[130px]">{renderSortHeader('Loại hồ sơ', 'recordType')}</th>
                            <th className="p-3 w-[150px]">{renderSortHeader('Hẹn trả', 'deadline')}</th>
                            <th className="p-3 text-center w-[120px]">Trạng thái</th>
                            <th className="p-3 text-center w-[120px]">Thao tác chính</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-sm">
                        {paginatedPendingRecords.map((r, index) => {
                            const deadlineStatus = getDeadlineStatus(r.deadline);
                            return (
                                <tr key={r.id} className="hover:bg-blue-50/50 transition-colors">
                                    <td className="p-3 text-center text-gray-400 text-xs align-middle">{(currentPage - 1) * itemsPerPage + index + 1}</td>
                                    <td className="p-3 font-medium text-blue-600 align-middle"><div className="truncate" title={r.code}>{r.code}</div></td>
                                    <td className="p-3 font-medium text-gray-800 align-middle"><div className="truncate" title={r.customerName}>{r.customerName}</div></td>
                                    <td className="p-3 text-gray-600 align-middle"><div className="truncate" title={r.recordType}>{getShortRecordType(r.recordType)}</div></td>
                                    <td className="p-3 align-middle">
                                        <div className={`flex items-center gap-1.5 ${deadlineStatus.color}`}>
                                            {deadlineStatus.icon}
                                            <span>{formatDate(r.deadline)}</span>
                                            <span className="text-[10px] uppercase ml-1">{deadlineStatus.text}</span>
                                        </div>
                                    </td>
                                    <td className="p-3 text-center align-middle"><StatusBadge status={r.status} /></td>
                                    <td className="p-3 align-middle">
                                        <div className="flex justify-center gap-2">
                                            <button 
                                                onClick={() => onViewRecord(r)}
                                                className="px-3 py-1.5 border border-gray-200 rounded-md text-gray-600 hover:bg-white hover:border-blue-300 hover:text-blue-600 text-xs font-medium transition-all shadow-sm"
                                            >
                                                Chi tiết
                                            </button>
                                            <button 
                                                onClick={() => handleForwardToSign(r)}
                                                title="Chuyển sang bước Ký kiểm tra"
                                                className="px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-xs font-bold flex items-center gap-2 shadow-sm transition-all"
                                            >
                                                Trình ký <Send size={14} />
                                            </button>
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
                    <p>{searchTerm ? 'Không tìm thấy hồ sơ phù hợp.' : 'Tuyệt vời! Bạn không còn hồ sơ tồn đọng.'}</p>
                </div>
            )}
        </div>

        {/* PAGINATION FOOTER */}
        {pendingRecords.length > 0 && (
            <div className="border-t border-gray-100 p-3 bg-gray-50 flex justify-between items-center shrink-0">
                <span className="text-xs text-gray-500">
                    Hiển thị <strong>{(currentPage - 1) * itemsPerPage + 1}</strong> - <strong>{Math.min(currentPage * itemsPerPage, pendingRecords.length)}</strong> trên tổng <strong>{pendingRecords.length}</strong>
                </span>
                <div className="flex items-center gap-1">
                    <button 
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                        className="p-1 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                        <ChevronLeft size={18} />
                    </button>
                    {Array.from({ length: totalPages }).map((_, idx) => (
                         <button
                            key={idx}
                            onClick={() => setCurrentPage(idx + 1)}
                            className={`w-7 h-7 flex items-center justify-center rounded text-xs font-medium transition-all ${
                                currentPage === idx + 1 
                                ? 'bg-blue-600 text-white shadow-sm' 
                                : 'hover:bg-gray-200 text-gray-600'
                            }`}
                        >
                            {idx + 1}
                        </button>
                    ))}
                    <button 
                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                        disabled={currentPage === totalPages}
                        className="p-1 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                        <ChevronRight size={18} />
                    </button>
                </div>
            </div>
        )}
      </div>

       {/* DANH SÁCH CHỜ KÝ (Scrollable within limits) */}
       <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden opacity-90 shrink-0 max-h-64 flex flex-col">
        <div className="p-4 border-b border-gray-100 bg-purple-50 flex items-center gap-2 shrink-0">
            <CheckCircle size={18} className="text-purple-600" />
            <h3 className="font-bold text-gray-800">Đã trình ký / Chờ kết quả ({reviewRecords.length})</h3>
        </div>
        {reviewRecords.length > 0 ? (
            <div className="overflow-y-auto">
                <table className="w-full text-left table-fixed">
                    <thead className="bg-gray-50 text-xs text-gray-500 uppercase sticky top-0 shadow-sm">
                        <tr>
                            <th className="p-3 w-[120px]">Mã HS</th>
                            <th className="p-3 w-[200px]">Chủ sử dụng</th>
                            <th className="p-3 w-[120px]">Ngày nộp</th>
                            <th className="p-3 text-center w-[120px]">Trạng thái</th>
                            <th className="p-3 text-right w-[80px]">Chi tiết</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-sm">
                        {reviewRecords.map(r => (
                            <tr key={r.id} className="hover:bg-gray-50">
                                <td className="p-3 font-medium text-gray-700 truncate" title={r.code}>{r.code}</td>
                                <td className="p-3 truncate" title={r.customerName}>{r.customerName}</td>
                                <td className="p-3 text-gray-500">{formatDate(r.receivedDate)}</td>
                                <td className="p-3 text-center"><StatusBadge status={r.status} /></td>
                                <td className="p-3 text-right">
                                    <button 
                                        onClick={() => onViewRecord(r)}
                                        className="text-blue-600 hover:underline text-xs"
                                    >
                                        Xem
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        ) : (
            <div className="p-4 text-center text-sm text-gray-400 italic">Chưa có hồ sơ nào đang chờ ký.</div>
        )}
      </div>
    </div>
  );
};

export default PersonalProfile;
