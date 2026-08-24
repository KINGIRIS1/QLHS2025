import React, { useState, useMemo, useEffect } from 'react';
import { Employee, RecordFile, User } from '../types';
import { 
    X, Check, MapPin, User as UserIcon, Users, Search, 
    Briefcase, Printer, FileText, Calendar, Clock, 
    CheckCircle2, Trash2, Building, ShieldCheck, Tag, 
    Sparkles, AlertCircle, ArrowRight
} from 'lucide-react';
import { removeVietnameseTones, showToast } from '../utils/appHelpers';

interface AssignModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (employeeId: string, assignedRecordIds?: string[]) => void;
  employees: Employee[];
  selectedRecords: RecordFile[];
  filterDepartment?: string;
  forceAllRecommended?: boolean;
  currentView?: string;
  currentUser?: User | null;
}

interface EmployeeItemProps {
    emp: Employee;
    isRecommended?: boolean;
    isSelected: boolean;
    onSelect: (id: string) => void;
    isSurveyTeam?: boolean;
}

// Component hiển thị thẻ một nhân viên gọn gàng trong danh sách 20%
const EmployeeItem: React.FC<EmployeeItemProps> = ({ emp, isRecommended, isSelected, onSelect, isSurveyTeam }) => (
    <div 
        onClick={() => onSelect(emp.id)}
        className={`relative flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-all text-left ${
            isSelected 
                ? 'bg-blue-600 text-white border-blue-600 shadow-md ring-2 ring-blue-300' 
                : isRecommended 
                    ? 'bg-white border-blue-200 hover:border-blue-400 hover:bg-blue-50/60 shadow-xs' 
                    : 'bg-white border-gray-200 hover:border-gray-300 hover:bg-gray-50 shadow-2xs'
        }`}
    >
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${
            isSelected 
                ? 'bg-white/20 text-white' 
                : isRecommended 
                    ? 'bg-blue-100 text-blue-700' 
                    : 'bg-gray-100 text-gray-700'
        }`}>
            {emp.name ? emp.name.charAt(emp.name.lastIndexOf(' ') + 1 || 0).toUpperCase() : 'NV'}
        </div>
        
        <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-1">
                <span className={`font-bold text-xs truncate ${isSelected ? 'text-white' : 'text-gray-900'}`}>
                    {emp.name}
                </span>
                {isSelected && <Check size={14} className="text-white shrink-0" />}
            </div>
            
            <div className={`text-[11px] truncate mt-0.5 ${isSelected ? 'text-blue-100' : 'text-gray-500'}`}>
                {emp.position || emp.department || 'Nhân viên'}
            </div>

            {/* Chi tiết tổ/phòng ban nếu có chức vụ */}
            {emp.position && emp.department && (
                <div className={`text-[10px] truncate ${isSelected ? 'text-blue-200' : 'text-gray-400'}`}>
                    {emp.department}
                </div>
            )}

            {/* Hiển thị địa bàn phụ trách */}
            {Array.isArray(emp.managedWards) && emp.managedWards.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1.5">
                    {emp.managedWards.slice(0, 2).map((w, idx) => (
                        <span 
                            key={idx} 
                            className={`text-[9px] px-1.5 py-0.5 rounded font-medium truncate max-w-[80px] ${
                                isSelected 
                                    ? 'bg-blue-700 text-white border border-blue-500' 
                                    : 'bg-gray-100 text-gray-600 border border-gray-200'
                            }`}
                        >
                            {w}
                        </span>
                    ))}
                    {emp.managedWards.length > 2 && (
                        <span className={`text-[9px] ${isSelected ? 'text-blue-200' : 'text-gray-400'}`}>
                            +{emp.managedWards.length - 2}
                        </span>
                    )}
                </div>
            )}
        </div>

        {isRecommended && !isSelected && (
            <div className="absolute top-2 right-2">
                <span className="flex h-2 w-2 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
            </div>
        )}
    </div>
);

const AssignModal: React.FC<AssignModalProps> = ({ 
    isOpen, 
    onClose, 
    onConfirm, 
    employees, 
    selectedRecords, 
    filterDepartment, 
    forceAllRecommended, 
    currentView,
    currentUser: propCurrentUser 
}) => {
  const [selectedEmpId, setSelectedEmpId] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [localRecords, setLocalRecords] = useState<RecordFile[]>([]);

  // Lấy currentUser từ prop hoặc localStorage
  const activeUser = useMemo(() => {
      let u: any = propCurrentUser;
      if (!u) {
          try {
              const stored = localStorage.getItem('currentUser') || localStorage.getItem('user');
              if (stored) u = JSON.parse(stored);
          } catch (e) {
              // ignore
          }
      }
      if (u) {
          const emp = u.employeeId ? employees.find(e => e.id === u.employeeId) : null;
          const roleDisplay = 
              u.role === 'ADMIN' ? 'Quản trị viên' :
              u.role === 'SUBADMIN' ? 'Phó quản trị' :
              u.role === 'TEAM_LEADER' ? 'Nhóm trưởng' :
              u.role === 'ONEDOOR' ? 'Bộ phận một cửa' :
              u.role === 'RECEPTION_HANDOVER' ? 'Tiếp nhận & Bàn giao' :
              u.role === 'EMPLOYEE' ? 'Cán bộ thụ lý' :
              u.role || 'Cán bộ giao việc';
          return {
              name: u.name || emp?.name || u.username || 'Người giao hồ sơ',
              role: roleDisplay,
              department: emp?.department || '',
              position: emp?.position || '',
              username: u.username || ''
          };
      }
      return { name: 'Người giao hồ sơ', role: 'Quản lý', department: '', position: '', username: '' };
  }, [propCurrentUser, employees]);

  // Khởi tạo danh sách hồ sơ nội bộ khi mở popup
  useEffect(() => {
      if (isOpen) {
          setLocalRecords([...selectedRecords]);
          setSelectedEmpId('');
          setSearchTerm('');
      }
  }, [isOpen, selectedRecords]);

  // Thông tin nhân viên được chọn
  const selectedEmployee = useMemo(() => {
      return employees.find(e => e.id === selectedEmpId) || null;
  }, [employees, selectedEmpId]);

  // Thống kê phân loại hồ sơ theo loại
  const recordTypeStats = useMemo(() => {
      const stats: Record<string, number> = {};
      localRecords.forEach(r => {
          const typeName = r.recordType || r.content || (r as any).loai_ho_so || (r as any).type || 'Hồ sơ chuyên môn';
          const cleanName = typeName.length > 28 ? typeName.substring(0, 25) + '...' : typeName;
          stats[cleanName] = (stats[cleanName] || 0) + 1;
      });
      return stats;
  }, [localRecords]);

  // Tự động xác định địa bàn mục tiêu từ các hồ sơ được chọn
  const targetWardName = useMemo(() => {
      if (localRecords.length === 0) return null;
      
      const firstWard = localRecords[0].ward || (localRecords[0] as any).xa_phuong;
      if (!firstWard) return null;

      const normFirst = removeVietnameseTones(firstWard);
      const isUniform = localRecords.every(r => {
          const w = r.ward || (r as any).xa_phuong;
          return w && removeVietnameseTones(w) === normFirst;
      });

      return isUniform ? firstWard : null;
  }, [localRecords]);

  // Phân chia nhân viên thành 2 nhóm: Đúng tuyến (20%) & Khác (20%)
  const { recommended, others } = useMemo(() => {
    let filteredEmployees = employees.filter(e => 
        e.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (e.department || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (e.position || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    const isMeasurementTab = currentView && ['all_records', 'assign_tasks', 'check_list', 'handover_list', 'completed_work_list'].includes(currentView);

    if (isMeasurementTab) {
        filteredEmployees = filteredEmployees.filter(emp => {
            const dept = (emp.department || '').toLowerCase();
            const pos = (emp.position || '').toLowerCase();
            const surveyKeywords = ['đo đạc', 'tổ đo', 'nội nghiệp', 'ngoại nghiệp'];
            const excludeKeywords = ['văn thư', 'kế toán', 'một cửa', 'tiếp nhận', 'hành chính', 'bảo vệ', 'tạp vụ'];
            if (excludeKeywords.some(k => dept.includes(k) || pos.includes(k))) return false;
            return surveyKeywords.some(k => dept.includes(k) || pos.includes(k));
        });
    }

    if (filterDepartment && !forceAllRecommended) {
        const deptKeyword = removeVietnameseTones(filterDepartment).toLowerCase();
        const rec = filteredEmployees.filter(e => 
            removeVietnameseTones(e.department || '').toLowerCase().includes(deptKeyword)
        );
        const oth = filteredEmployees.filter(e => 
            !removeVietnameseTones(e.department || '').toLowerCase().includes(deptKeyword)
        );
        return { recommended: rec, others: oth };
    }

    if (forceAllRecommended) {
        return { recommended: filteredEmployees, others: [] };
    }

    const rec: Employee[] = [];
    const oth: Employee[] = [];

    const checkIsSurveyTeam = (emp: Employee) => {
        const dept = (emp.department || '').toLowerCase();
        const pos = (emp.position || '').toLowerCase();
        
        if (isMeasurementTab) {
            const surveyKeywords = ['đo đạc', 'tổ đo', 'nội nghiệp', 'ngoại nghiệp'];
            const excludeKeywords = ['văn thư', 'kế toán', 'một cửa', 'tiếp nhận', 'hành chính', 'bảo vệ', 'tạp vụ'];
            if (excludeKeywords.some(k => dept.includes(k) || pos.includes(k))) return false;
            return surveyKeywords.some(k => dept.includes(k) || pos.includes(k));
        }

        const keywords = [
            'kỹ thuật', 'đo đạc', 'tổ đo', 'địa chính', 
            'nội nghiệp', 'ngoại nghiệp', 'biên tập', 'bản đồ',
            'tổ 1', 'tổ 2', 'tổ 3'
        ];
        
        const excludeKeywords = ['văn thư', 'kế toán', 'một cửa', 'tiếp nhận', 'hành chính', 'bảo vệ', 'tạp vụ'];
        if (excludeKeywords.some(k => dept.includes(k) || pos.includes(k))) return false;

        return keywords.some(k => dept.includes(k) || pos.includes(k));
    };

    filteredEmployees.forEach(emp => {
        let isManaged = false;
        if (targetWardName) {
            const targetNorm = removeVietnameseTones(targetWardName);
            isManaged = Boolean(emp.managedWards && emp.managedWards.some(w => removeVietnameseTones(w) === targetNorm));
        }

        const isSurvey = checkIsSurveyTeam(emp);

        if (isManaged && isSurvey) {
            rec.push(emp);
        } else {
            oth.push(emp);
        }
    });

    oth.sort((a, b) => {
        const aSurvey = checkIsSurveyTeam(a) ? 1 : 0;
        const bSurvey = checkIsSurveyTeam(b) ? 1 : 0;
        if (aSurvey !== bSurvey) return bSurvey - aSurvey;
        return a.name.localeCompare(b.name);
    });

    return { recommended: rec, others: oth };
  }, [employees, targetWardName, searchTerm, filterDepartment, currentView, forceAllRecommended]);

  // Xóa bớt hồ sơ khỏi đợt giao này
  const handleRemoveRecord = (id: string) => {
      setLocalRecords(prev => prev.filter(r => r.id !== id));
  };

  // Xác nhận bàn giao
  const handleConfirmAssignment = () => {
      if (!selectedEmpId) {
          showToast('Vui lòng chọn nhân viên tiếp nhận hồ sơ', 'error');
          return;
      }
      if (localRecords.length === 0) {
          showToast('Danh sách hồ sơ cần giao trống', 'error');
          return;
      }
      onConfirm(selectedEmpId, localRecords.map(r => r.id));
  };

  // In Phiếu Bàn Giao (PDF) chuẩn đẹp A3 dọc, KHÔNG CÓ Tiêu ngữ/Quốc hiệu & Tên Đơn vị
  const handlePrintPDF = () => {
      if (!selectedEmployee) {
          showToast('Vui lòng chọn nhân viên tiếp nhận trước khi in phiếu', 'error');
          return;
      }
      if (localRecords.length === 0) {
          showToast('Không có hồ sơ nào để in phiếu', 'error');
          return;
      }

      const printWindow = window.open('', '_blank');
      if (!printWindow) {
          showToast('Trình duyệt đã chặn cửa sổ in. Vui lòng cho phép popup.', 'error');
          return;
      }

      const now = new Date();
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const year = now.getFullYear();

      // Thống kê chi tiết dạng chuỗi
      const statsSummaryText = Object.entries(recordTypeStats)
          .map(([type, count]) => `${type}: ${count}`)
          .join(', ');

      const rowsHtml = localRecords.map((r, idx) => {
          const code = r.code || (r as any).so_hieu || (r as any).so_vao_so || '-';
          const customer = r.customerName || (r as any).chu_su_dung || (r as any).noi_nhan_gui || (r as any).trich_yeu || '-';
          const ward = r.ward || (r as any).xa_phuong || '-';
          const plotMap = (r.landPlot || r.mapSheet) ? `Thửa ${r.landPlot || '-'}/Tờ ${r.mapSheet || '-'}` : (r.address || '-');
          const type = r.recordType || r.content || (r as any).loai_ho_so || 'Hồ sơ chuyên môn';
          const deadline = r.deadline || (r as any).ngay_hen_tra || (r as any).ngay_thang || '-';

          return `
            <tr>
                <td style="text-align: center;">${idx + 1}</td>
                <td style="font-weight: bold; text-align: center;">${code}</td>
                <td>${customer}</td>
                <td>${ward} ${plotMap !== '-' ? `(${plotMap})` : ''}</td>
                <td>${type}</td>
                <td style="text-align: center;">${deadline}</td>
                <td></td>
            </tr>
          `;
      }).join('');

      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>Phiếu Bàn Giao & Phân Công Hồ Sơ</title>
            <style>
                @page {
                    size: A3 portrait;
                    margin: 20mm 15mm 20mm 15mm;
                }
                body {
                    font-family: 'Times New Roman', Times, serif, sans-serif;
                    font-size: 14pt;
                    line-height: 1.5;
                    color: #000;
                    margin: 0;
                    padding: 0;
                }
                .header-container {
                    text-align: center;
                    margin-bottom: 25px;
                }
                .header-title {
                    font-size: 20pt;
                    font-weight: bold;
                    text-transform: uppercase;
                    margin: 0;
                    letter-spacing: 0.5px;
                }
                .header-subtitle {
                    font-style: italic;
                    font-size: 13pt;
                    margin-top: 6px;
                    color: #333;
                }
                .info-box {
                    margin-bottom: 20px;
                    border: 1.5px solid #333;
                    padding: 14px 18px;
                    background-color: #fafafa;
                    border-radius: 6px;
                }
                .info-grid {
                    display: table;
                    width: 100%;
                }
                .info-row {
                    display: table-row;
                }
                .info-cell {
                    display: table-cell;
                    padding: 4px 8px;
                    font-size: 13.5pt;
                }
                .info-label {
                    font-weight: bold;
                    width: 180px;
                }
                .table-records {
                    width: 100%;
                    border-collapse: collapse;
                    margin-top: 14px;
                    margin-bottom: 25px;
                }
                .table-records th, .table-records td {
                    border: 1px solid #000;
                    padding: 9px 10px;
                    font-size: 13pt;
                }
                .table-records th {
                    background-color: #ebebeb;
                    font-weight: bold;
                    text-align: center;
                }
                .signature-section {
                    display: table;
                    width: 100%;
                    margin-top: 40px;
                    page-break-inside: avoid;
                }
                .signature-cell {
                    display: table-cell;
                    width: 50%;
                    text-align: center;
                    vertical-align: top;
                }
                .sign-title {
                    font-weight: bold;
                    font-size: 14pt;
                    text-transform: uppercase;
                }
                .sign-note {
                    font-style: italic;
                    font-size: 12pt;
                    margin-top: 3px;
                    color: #555;
                }
                .sign-space {
                    height: 90px;
                }
                .sign-name {
                    font-weight: bold;
                    font-size: 14pt;
                }
            </style>
        </head>
        <body>
            <div class="header-container">
                <div class="header-title">PHIẾU BÀN GIAO & PHÂN CÔNG HỒ SƠ</div>
                <div class="header-subtitle">(Thời gian bàn giao: ${hours} giờ ${minutes} phút, ngày ${day} tháng ${month} năm ${year})</div>
            </div>

            <div class="info-box">
                <div class="info-grid">
                    <div class="info-row">
                        <div class="info-cell info-label">Người bàn giao:</div>
                        <div class="info-cell"><strong>${activeUser.name}</strong> ${activeUser.role ? `— ${activeUser.role}` : ''} ${activeUser.department ? `(${activeUser.department})` : ''}</div>
                    </div>
                    <div class="info-row">
                        <div class="info-cell info-label">Người tiếp nhận:</div>
                        <div class="info-cell"><strong>${selectedEmployee.name}</strong> — ${selectedEmployee.position || 'Cán bộ'} (${selectedEmployee.department || 'Tổ chuyên môn'})</div>
                    </div>
                    <div class="info-row">
                        <div class="info-cell info-label">Tổng số hồ sơ:</div>
                        <div class="info-cell"><strong>${localRecords.length} hồ sơ</strong> ${statsSummaryText ? `(${statsSummaryText})` : ''}</div>
                    </div>
                </div>
            </div>

            <table class="table-records">
                <thead>
                    <tr>
                        <th style="width: 45px;">STT</th>
                        <th style="width: 140px;">Mã Hồ Sơ</th>
                        <th>Chủ Sử Dụng / Trích Yếu</th>
                        <th style="width: 180px;">Địa Bàn / Thửa-Tờ</th>
                        <th style="width: 180px;">Loại Hồ Sơ</th>
                        <th style="width: 120px;">Hạn Xử Lý</th>
                        <th style="width: 100px;">Ghi Chú</th>
                    </tr>
                </thead>
                <tbody>
                    ${rowsHtml}
                </tbody>
            </table>

            <div class="signature-section">
                <div class="signature-cell">
                    <div class="sign-title">NGƯỜI BÀN GIAO</div>
                    <div class="sign-note">(Ký và ghi rõ họ tên)</div>
                    <div class="sign-space"></div>
                    <div class="sign-name">${activeUser.name || ''}</div>
                </div>
                <div class="signature-cell">
                    <div class="sign-title">NGƯỜI TIẾP NHẬN</div>
                    <div class="sign-note">(Ký và ghi rõ họ tên)</div>
                    <div class="sign-space"></div>
                    <div class="sign-name">${selectedEmployee.name}</div>
                </div>
            </div>

            <script>
                window.onload = function() {
                    window.print();
                };
            </script>
        </body>
        </html>
      `;

      printWindow.document.open();
      printWindow.document.write(htmlContent);
      printWindow.document.close();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[1440px] xl:max-w-7xl flex flex-col h-[90vh] animate-fade-in overflow-hidden border border-gray-200">
        
        {/* TOP BAR / HEADER */}
        <div className="flex justify-between items-center px-5 py-3.5 border-b border-gray-200 bg-slate-50/80 shrink-0">
            <div className="flex items-center gap-3">
                <div className="bg-blue-600 text-white p-2 rounded-xl shadow-xs">
                    <FileText size={20} />
                </div>
                <div>
                    <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                        Phân công & Lập phiếu bàn giao hồ sơ
                    </h3>
                    <p className="text-xs text-gray-500">
                        Đang chuẩn bị bàn giao <span className="font-bold text-blue-600">{localRecords.length} hồ sơ</span> cho cán bộ tiếp nhận
                    </p>
                </div>
            </div>
            
            <div className="flex items-center gap-3">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                    <input 
                        type="text" 
                        placeholder="Tìm nhân viên theo tên, tổ..." 
                        className="pl-8.5 pr-3 py-1.5 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 w-56 sm:w-64 bg-white shadow-2xs"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    {searchTerm && (
                        <button onClick={() => setSearchTerm('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                            <X size={12} />
                        </button>
                    )}
                </div>
                <button 
                    onClick={onClose} 
                    className="text-gray-400 hover:text-gray-700 hover:bg-gray-100 p-1.5 rounded-xl transition-colors"
                >
                    <X size={18} />
                </button>
            </div>
        </div>

        {/* 3-COLUMN MAIN BODY (Tỷ lệ 60% - 20% - 20%) */}
        <div className="flex-1 flex overflow-hidden divide-x divide-gray-200">
             
             {/* CỘT 1: 60% - PHIẾU BÀN GIAO & DANH SÁCH HỒ SƠ */}
             <div className="w-[60%] flex flex-col bg-white overflow-hidden">
                 
                 {/* Khối Thông tin Bên giao - Bên nhận & Thống kê */}
                 <div className="p-4 border-b border-gray-200 bg-slate-50/50 space-y-3 shrink-0">
                     
                     {/* Grid 2 Card: Bên giao hồ sơ (User đang đăng nhập) & Bên nhận hồ sơ (Cán bộ tiếp nhận) */}
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                         {/* Card Bên giao hồ sơ (User đang đăng nhập) */}
                         <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
                             <div className="flex items-center gap-3 min-w-0">
                                 <div className="w-10 h-10 rounded-xl bg-slate-800 text-white flex items-center justify-center font-bold text-sm shadow-xs shrink-0">
                                     {activeUser.name.charAt(activeUser.name.lastIndexOf(' ') + 1 || 0).toUpperCase()}
                                 </div>
                                 <div className="min-w-0">
                                     <div className="flex items-center gap-1.5 flex-wrap">
                                         <span className="font-bold text-sm text-gray-900 truncate">{activeUser.name}</span>
                                         <span className="bg-slate-100 text-slate-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-slate-200 shrink-0">
                                             Người giao hồ sơ
                                         </span>
                                     </div>
                                     <div className="text-xs text-gray-600 flex items-center gap-1.5 mt-0.5 truncate">
                                         <span><strong>Vai trò:</strong> {activeUser.role}</span>
                                         {activeUser.department && (
                                             <>
                                                 <span>•</span>
                                                 <span>{activeUser.department}</span>
                                             </>
                                         )}
                                     </div>
                                 </div>
                             </div>
                         </div>

                         {/* Card Bên nhận hồ sơ (Cán bộ được chọn) */}
                         {selectedEmployee ? (
                             <div className="flex items-center justify-between p-3 bg-blue-50/90 rounded-xl border border-blue-200 shadow-2xs">
                                 <div className="flex items-center gap-3 min-w-0">
                                     <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-sm shadow-xs shrink-0">
                                         {selectedEmployee.name.charAt(selectedEmployee.name.lastIndexOf(' ') + 1 || 0).toUpperCase()}
                                     </div>
                                     <div className="min-w-0">
                                         <div className="flex items-center gap-1.5 flex-wrap">
                                             <span className="font-bold text-sm text-gray-900 truncate">{selectedEmployee.name}</span>
                                             <span className="bg-blue-100 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-blue-200 shrink-0">
                                                 Người tiếp nhận
                                             </span>
                                         </div>
                                         <div className="text-xs text-gray-600 flex items-center gap-1.5 mt-0.5 truncate">
                                             <span><strong>Chức vụ:</strong> {selectedEmployee.position || 'Cán bộ'}</span>
                                             <span>•</span>
                                             <span>{selectedEmployee.department || 'Chuyên môn'}</span>
                                         </div>
                                     </div>
                                 </div>

                                 <button 
                                     onClick={() => setSelectedEmpId('')}
                                     className="text-xs text-gray-500 hover:text-red-600 px-2 py-1 hover:bg-red-50 rounded-lg transition-colors shrink-0 ml-2"
                                     title="Chọn lại nhân viên khác"
                                 >
                                     Đổi người
                                 </button>
                             </div>
                         ) : (
                             <div className="p-3 bg-amber-50/90 rounded-xl border border-amber-200 flex items-center gap-2.5 text-amber-800">
                                 <AlertCircle size={20} className="text-amber-600 shrink-0" />
                                 <div className="text-xs">
                                     <span className="font-bold">Chưa chọn người nhận:</span> Click chọn nhân viên từ danh sách bên phải.
                                 </div>
                             </div>
                         )}
                     </div>

                     {/* Thống kê Tổng số & Phân loại từng loại hồ sơ */}
                     <div className="flex flex-wrap items-center gap-2 text-xs">
                         <span className="font-bold text-gray-700 flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-lg border border-gray-200 shadow-2xs">
                             <Tag size={13} className="text-blue-600" />
                             Tổng số: <strong className="text-blue-700">{localRecords.length}</strong> hồ sơ
                         </span>

                         <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto max-w-full">
                             {Object.entries(recordTypeStats).map(([type, count]) => (
                                 <span 
                                     key={type} 
                                     className="bg-white text-gray-700 px-2 py-0.5 rounded-md border border-gray-200 text-[11px] font-medium shadow-2xs"
                                 >
                                     {type}: <strong className="text-indigo-600">{count}</strong>
                                 </span>
                             ))}
                         </div>
                     </div>
                 </div>

                 {/* Bảng Danh Sách Chi Tiết Hồ Sơ (Scrollable Table) */}
                 <div className="flex-1 overflow-auto custom-scrollbar p-4 bg-white">
                     {localRecords.length > 0 ? (
                         <div className="border border-gray-200 rounded-xl overflow-hidden shadow-2xs">
                             <table className="w-full text-left border-collapse text-xs">
                                 <thead>
                                     <tr className="bg-gray-50 border-b border-gray-200 text-gray-700 uppercase text-[11px] font-bold">
                                         <th className="py-2 px-2.5 text-center w-10">STT</th>
                                         <th className="py-2 px-3">Mã hồ sơ</th>
                                         <th className="py-2 px-3">Chủ sử dụng / Trích yếu</th>
                                         <th className="py-2 px-3">Địa bàn / Thửa-Tờ</th>
                                         <th className="py-2 px-3">Loại hồ sơ</th>
                                         <th className="py-2 px-2.5 text-center">Hạn xử lý</th>
                                         <th className="py-2 px-2 text-center w-10">Bỏ</th>
                                     </tr>
                                 </thead>
                                 <tbody className="divide-y divide-gray-100">
                                     {localRecords.map((r, idx) => {
                                         const code = r.code || (r as any).so_hieu || (r as any).so_vao_so || '-';
                                         const customer = r.customerName || (r as any).chu_su_dung || (r as any).noi_nhan_gui || (r as any).trich_yeu || '-';
                                         const ward = r.ward || (r as any).xa_phuong || '-';
                                         const plotInfo = (r.landPlot || r.mapSheet) ? `Thửa ${r.landPlot || '-'}/Tờ ${r.mapSheet || '-'}` : (r.address || '');
                                         const type = r.recordType || r.content || (r as any).loai_ho_so || 'Hồ sơ chuyên môn';
                                         const deadline = r.deadline || (r as any).ngay_hen_tra || (r as any).ngay_thang || '-';

                                         return (
                                             <tr key={r.id || idx} className="hover:bg-blue-50/40 transition-colors">
                                                 <td className="py-2 px-2.5 text-center text-gray-500 font-medium">{idx + 1}</td>
                                                 <td className="py-2 px-3 font-bold text-blue-700">{code}</td>
                                                 <td className="py-2 px-3 font-medium text-gray-900 max-w-[200px] truncate" title={customer}>
                                                     {customer}
                                                 </td>
                                                 <td className="py-2 px-3 text-gray-600">
                                                     <div>{ward}</div>
                                                     {plotInfo && <div className="text-[10px] text-gray-400">{plotInfo}</div>}
                                                 </td>
                                                 <td className="py-2 px-3 text-gray-700">
                                                     <span className="bg-gray-100 text-gray-800 px-1.5 py-0.5 rounded text-[10px] font-medium border border-gray-200">
                                                         {type}
                                                     </span>
                                                 </td>
                                                 <td className="py-2 px-2.5 text-center text-gray-600 font-medium">{deadline}</td>
                                                 <td className="py-2 px-2 text-center">
                                                     <button 
                                                         onClick={() => handleRemoveRecord(r.id)}
                                                         className="text-gray-400 hover:text-red-600 p-1 hover:bg-red-50 rounded transition-colors"
                                                         title="Bỏ hồ sơ này ra khỏi đợt giao"
                                                     >
                                                         <Trash2 size={13} />
                                                     </button>
                                                 </td>
                                             </tr>
                                         );
                                     })}
                                 </tbody>
                             </table>
                         </div>
                     ) : (
                         <div className="h-48 flex flex-col items-center justify-center text-gray-400">
                             <FileText size={32} className="mb-2 opacity-40" />
                             <p>Danh sách hồ sơ trống.</p>
                         </div>
                     )}
                 </div>

                 {/* Phần Ký Giao - Nhận & Thanh tác vụ */}
                 <div className="p-4 border-t border-gray-200 bg-slate-50/80 space-y-3 shrink-0">
                     
                     {/* Hai ô ký xác nhận */}
                     <div className="grid grid-cols-2 gap-3 bg-white p-2.5 rounded-xl border border-gray-200 text-xs">
                         <div className="p-2 bg-gray-50/60 rounded-lg border border-gray-100 text-center">
                             <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Bên giao hồ sơ</span>
                             <div className="font-bold text-gray-800 text-xs mt-0.5">{activeUser.name || 'Người giao việc'}</div>
                             <div className="text-[10px] text-gray-400">{activeUser.role || 'Bộ phận phân công'}</div>
                         </div>
                         <div className="p-2 bg-gray-50/60 rounded-lg border border-gray-100 text-center">
                             <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Bên tiếp nhận hồ sơ</span>
                             <div className="font-bold text-blue-700 text-xs mt-0.5">
                                 {selectedEmployee ? selectedEmployee.name : '(Chưa chọn nhân viên)'}
                             </div>
                             <div className="text-[10px] text-gray-400">
                                 {selectedEmployee ? (selectedEmployee.position || selectedEmployee.department || 'Cán bộ tiếp nhận') : 'Chờ phân công'}
                             </div>
                         </div>
                     </div>

                     {/* Action Buttons */}
                     <div className="flex justify-end items-center gap-2 pt-1">
                         <button 
                             onClick={onClose} 
                             className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-xl text-xs font-bold transition-colors"
                         >
                             Hủy bỏ
                         </button>
                         <button 
                             onClick={handlePrintPDF}
                             disabled={!selectedEmployee || localRecords.length === 0}
                             className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-xs transition-all active:scale-95"
                             title="In phiếu bàn giao khổ A3 dọc chuẩn đẹp mắt"
                         >
                             <Printer size={15} />
                             <span>In Phiếu Bàn Giao (A3)</span>
                         </button>
                         <button 
                             onClick={handleConfirmAssignment}
                             disabled={!selectedEmployee || localRecords.length === 0}
                             className="flex items-center gap-1.5 px-5 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-blue-500/20 transition-all active:scale-95"
                         >
                             <Check size={16} />
                             <span>Xác nhận giao việc</span>
                         </button>
                     </div>
                 </div>
             </div>

             {/* CỘT 2: 20% - NHÂN VIÊN ĐÚNG TUYẾN */}
             <div className="w-[20%] bg-blue-50/30 flex flex-col overflow-hidden">
                 <div className="p-3 border-b border-blue-100 bg-blue-50/70 sticky top-0 z-10 shrink-0">
                     <div className="flex items-center justify-between">
                         <div className="flex items-center gap-1.5 text-xs font-bold text-blue-900 uppercase tracking-wide">
                             <ShieldCheck size={15} className="text-blue-600" />
                             <span>Đúng tuyến ({recommended.length})</span>
                         </div>
                     </div>

                     {targetWardName ? (
                         <div className="text-[11px] text-blue-700 mt-1 font-semibold bg-white/90 px-2 py-0.5 rounded-md border border-blue-200 truncate" title={`Địa bàn: ${targetWardName}`}>
                             Địa bàn: {targetWardName}
                         </div>
                     ) : (
                         <div className="text-[10px] text-gray-500 mt-0.5 italic">
                             {filterDepartment ? filterDepartment : '(Ưu tiên chuyên môn)'}
                         </div>
                     )}
                 </div>

                 <div className="p-2.5 overflow-y-auto flex-1 custom-scrollbar space-y-2">
                     {recommended.length > 0 ? (
                         recommended.map(emp => (
                             <EmployeeItem 
                                 key={emp.id} 
                                 emp={emp} 
                                 isRecommended={true} 
                                 isSelected={selectedEmpId === emp.id}
                                 onSelect={setSelectedEmpId}
                                 isSurveyTeam={true}
                             />
                         ))
                     ) : (
                         <div className="h-44 flex flex-col items-center justify-center text-center p-3 text-gray-400 border border-dashed border-blue-200 rounded-xl m-1">
                             <MapPin size={24} className="mb-1.5 opacity-40 text-blue-500" />
                             <p className="text-xs">
                                 Không có nhân viên đúng tuyến phù hợp.
                             </p>
                         </div>
                     )}
                 </div>
             </div>

             {/* CỘT 3: 20% - NHÂN VIÊN KHÁC */}
             <div className="w-[20%] bg-slate-50/60 flex flex-col overflow-hidden">
                 <div className="p-3 border-b border-gray-200 bg-slate-50 sticky top-0 z-10 shrink-0">
                     <div className="flex items-center justify-between">
                         <div className="flex items-center gap-1.5 text-xs font-bold text-gray-700 uppercase tracking-wide">
                             <Users size={15} className="text-gray-500" />
                             <span>Nhân viên khác ({others.length})</span>
                         </div>
                     </div>
                     <p className="text-[10px] text-gray-400 mt-0.5">Khác tuyến / Tổ chuyên môn khác</p>
                 </div>

                 <div className="p-2.5 overflow-y-auto flex-1 custom-scrollbar space-y-2">
                     {others.length > 0 ? (
                         others.map(emp => (
                             <EmployeeItem 
                                 key={emp.id} 
                                 emp={emp} 
                                 isSelected={selectedEmpId === emp.id}
                                 onSelect={setSelectedEmpId}
                                 isSurveyTeam={false}
                             />
                         ))
                     ) : (
                         <div className="h-44 flex flex-col items-center justify-center text-center p-3 text-gray-400">
                             <p className="text-xs">Không có nhân viên khác.</p>
                         </div>
                     )}
                 </div>
             </div>

        </div>
      </div>
    </div>
  );
};

export default AssignModal;
