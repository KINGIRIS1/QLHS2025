
import React, { useState, useMemo, useEffect } from 'react';
import { RecordFile, RecordStatus, User, Employee } from '../types';
import StatusBadge from './StatusBadge';
import { Briefcase, ArrowRight, CheckCircle, Clock, Send, AlertTriangle, UserCog, ChevronLeft, ChevronRight, AlertCircle, Search, ArrowUp, ArrowDown, ArrowUpDown, Bell, CalendarClock, FileCheck, Map, CheckSquare, FileText, Eye, ShieldAlert, RefreshCw } from 'lucide-react';
import { getShortRecordType } from '../constants';
import { confirmAction, getReceivingWard } from '../utils/appHelpers';
import { updateRecordApi } from '../services/api';
import { fetchArchiveRecords, ArchiveRecord, saveArchiveRecord } from '../services/apiArchive';
import PhieuXinLoiModal from './PhieuXinLoiModal';
import { PlotCountModal } from './PlotCountModal';
import BlockingWarningModal from './BlockingWarningModal';
import { supabase, isConfigured } from '../services/supabaseClient';
import { offlineDb } from '../utils/offlineDb';
import { PaginationControls } from './PaginationControls';

import PersonalReportView from './PersonalReportView';

interface PersonalProfileProps {
  user: User;
  employees?: Employee[];
  records: RecordFile[];
  onUpdateStatus: (record: RecordFile, newStatus: RecordStatus, additionalUpdates?: Partial<RecordFile>) => void;
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

function normalizeDept(dept: string | undefined): string {
  if (!dept) return '';
  const clean = removeVietnameseTones(dept).toLowerCase().trim();
  if (clean.includes('do dac')) return 'to do dac';
  if (clean.includes('dang ky') || clean.includes('vao so')) return 'to dang ky';
  return clean;
}

const PersonalProfile: React.FC<PersonalProfileProps> = ({ user, employees, records, onUpdateStatus, onViewRecord, onCreateLiquidation, onMapCorrection }) => {
  // Thêm tab 'completed_work' và 'pending_sign'
  const [activeTab, setActiveTab] = useState<'pending' | 'completed_work' | 'pending_sign' | 'finished' | 'reminder' | 'report' | 'approaching' | 'overdue' | 'extended'>('pending');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: keyof RecordFile; direction: 'asc' | 'desc' }>({
    key: 'deadline',
    direction: 'desc' 
  });

  const [archiveRecords, setArchiveRecords] = useState<ArchiveRecord[]>([]);

  const [showPhieuXinLoi, setShowPhieuXinLoi] = useState(false);
  const [selectedRecordForPhieu, setSelectedRecordForPhieu] = useState<RecordFile | null>(null);

  const [isPlotCountModalOpen, setIsPlotCountModalOpen] = useState(false);
  const [selectedRecordForPlotCount, setSelectedRecordForPlotCount] = useState<RecordFile | null>(null);

  // Trạng thái cho cảnh báo ngăn chặn
  const [isBlockingWarningOpen, setIsBlockingWarningOpen] = useState(false);
  const [blockingMatches, setBlockingMatches] = useState<{ record: any; source: 'active' | 'archive' }[]>([]);
  const [pendingRecord, setPendingRecord] = useState<RecordFile | null>(null);
  const [pendingAction, setPendingAction] = useState<'mark_as_done' | 'forward_to_sign' | null>(null);

  // Trạng thái hiển thị popup "Đang kiểm tra ngăn chặn"
  const [isCheckingBlocking, setIsCheckingBlocking] = useState(false);
  const [checkingRecord, setCheckingRecord] = useState<RecordFile | null>(null);
  const [checkingStatus, setCheckingStatus] = useState<'checking' | 'passed' | 'found'>('checking');

  // Trạng thái cho Chuyển tiếp hồ sơ
  const [isForwardModalOpen, setIsForwardModalOpen] = useState(false);
  const [selectedRecordForForward, setSelectedRecordForForward] = useState<RecordFile | null>(null);
  const [selectedRecipientId, setSelectedRecipientId] = useState('');
  const [forwardNotes, setForwardNotes] = useState('');
  const [showOnlySameDept, setShowOnlySameDept] = useState(true);

  // Hàm xác định tổ xử lý của hồ sơ
  const getRecordDepartment = (record: RecordFile | null): string => {
    if (!record) return '';
    // 1. Kiểm tra tổ của người đang được giao việc
    if (record.assignedTo) {
      const assignedEmp = employees?.find(e => e.id === record.assignedTo);
      if (assignedEmp?.department) {
        return assignedEmp.department;
      }
    }
    // 2. Dự phòng: Tổ của người dùng hiện tại đang đăng nhập
    const currentEmp = employees?.find(e => e.id === user.employeeId);
    if (currentEmp?.department) {
      return currentEmp.department;
    }
    // 3. Dự phòng theo loại hồ sơ hoặc loại lưu trữ
    if (record._archiveType === 'dangky' || record._archiveType === 'vaoso') {
      return 'Tổ Đăng ký';
    }
    if (record.recordType?.toLowerCase().includes('dang ky') || record.recordType?.toLowerCase().includes('gcn') || record.recordType?.toLowerCase().includes('vao so')) {
      return 'Tổ Đăng ký';
    }
    if (record.recordType?.toLowerCase().includes('do dac') || record.recordType?.toLowerCase().includes('trich do') || record.recordType?.toLowerCase().includes('ban do')) {
      return 'Tổ Đo đạc';
    }
    return '';
  };

  const recordDept = useMemo(() => {
    return getRecordDepartment(selectedRecordForForward);
  }, [selectedRecordForForward, employees, user.employeeId]);

  const visibleEmployeesForForward = useMemo(() => {
    const otherEmployees = employees?.filter(e => e.id !== user.employeeId) || [];
    if (showOnlySameDept && recordDept) {
      const targetNorm = normalizeDept(recordDept);
      return otherEmployees.filter(e => normalizeDept(e.department) === targetNorm);
    }
    return otherEmployees;
  }, [employees, user.employeeId, showOnlySameDept, recordDept]);

  const incomingForwards = useMemo(() => {
    return records.filter(r => r.forwardPendingTo === user.employeeId);
  }, [records, user.employeeId]);

  useEffect(() => {
    const loadArchive = async () => {
        const saoluc = await fetchArchiveRecords('saoluc');
        const congvan = await fetchArchiveRecords('congvan');
        setArchiveRecords([...saoluc, ...congvan]);
    };
    loadArchive();
  }, []);

  const myRecords = useMemo(() => {
    const mainRecords = records.filter(r => user.employeeId && r.assignedTo === user.employeeId);
    
    const mappedArchives = archiveRecords
        .filter(r => r.data?.assigned_to === user.employeeId)
        .map(r => {
            // Map status
            let status = RecordStatus.RECEIVED;
            if (r.status === 'assigned') status = RecordStatus.ASSIGNED;
            else if (r.status === 'executed') status = RecordStatus.COMPLETED_WORK;
            else if (r.status === 'pending_sign') status = RecordStatus.PENDING_SIGN;
            else if (r.status === 'signed') status = RecordStatus.SIGNED;
            else if (r.status === 'completed') status = RecordStatus.RETURNED;

            return {
                id: r.id,
                code: r.so_hieu,
                customerName: r.noi_nhan_gui, // Sao lục: Chủ sử dụng, Công văn: Cơ quan phát hành
                recordType: r.type === 'saoluc' ? 'Sao lục' : 'Công văn',
                content: r.trich_yeu,
                receivedDate: r.ngay_thang,
                deadline: r.data?.hen_tra,
                status: status,
                assignedTo: r.data?.assigned_to,
                ward: r.data?.xa_phuong,
                submissionDate: r.type === 'congvan' ? r.ngay_thang : undefined, // Example mapping
                // Fill other required fields with defaults or null
                phoneNumber: null,
                cccd: null,
                landPlot: r.data?.thua_dat,
                mapSheet: r.data?.to_ban_do,
                area: null,
                address: null,
                group: null,
                assignedDate: r.data?.assigned_date,
                approvalDate: null,
                completedDate: null,
                notes: null,
                privateNotes: null,
                personalNotes: null,
                authorizedBy: null,
                authDocType: null,
                otherDocs: null,
                exportBatch: null,
                exportDate: null,
                measurementNumber: null,
                excerptNumber: null,
                reminderDate: null,
                lastRemindedAt: null,
                receiptNumber: null,
                receiverName: null,
                resultReturnedDate: null,
                needsMapCorrection: false
            } as RecordFile;
        });

    return [...mainRecords, ...mappedArchives];
  }, [records, archiveRecords, user.employeeId]);
  
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

  // 4. Hồ sơ Hoàn thành (SIGNED, HANDOVER, RETURNED, WITHDRAWN)
  const finishedRecords = useMemo(() => {
      let list = myRecords.filter(r => 
          r.status === RecordStatus.SIGNED || 
          r.status === RecordStatus.HANDOVER || 
          r.status === RecordStatus.RETURNED ||
          r.status === RecordStatus.WITHDRAWN
      );
      return filterAndSort(list, searchTerm, sortConfig);
  }, [myRecords, searchTerm, sortConfig]);

  // 5. Hồ sơ Có hẹn nhắc việc
  const reminderRecords = useMemo(() => {
      let list = myRecords.filter(r => 
          r.reminderDate && 
          r.status !== RecordStatus.HANDOVER && 
          r.status !== RecordStatus.WITHDRAWN &&
          r.status !== RecordStatus.RETURNED
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

  // Helper check hoan thanh
  const isRecordFinished = (record: RecordFile) => {
      return (
          record.status === RecordStatus.HANDOVER || 
          record.status === RecordStatus.RETURNED || 
          record.status === RecordStatus.WITHDRAWN ||
          record.status === RecordStatus.SIGNED ||
          !!record.exportBatch || 
          !!record.exportDate ||
          !!record.resultReturnedDate
      );
  };

  // 6. Hồ sơ Sắp tới hạn (Chưa hoàn thành, hạn <= 2 ngày nhưng >= 0 ngày)
  const approachingRecords = useMemo(() => {
      let list = myRecords.filter(r => {
          if (isRecordFinished(r)) return false;
          if (!r.deadline) return false;
          const today = new Date();
          today.setHours(0,0,0,0);
          const deadline = new Date(r.deadline);
          deadline.setHours(0,0,0,0);
          const diffTime = deadline.getTime() - today.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          return diffDays >= 0 && diffDays <= 2;
      });
      return filterAndSort(list, searchTerm, sortConfig);
  }, [myRecords, searchTerm, sortConfig]);

  // 7. Hồ sơ Trễ hạn (Chưa hoàn thành, hạn < 0 ngày, tức là ngày kết thúc trước hôm nay)
  const overdueRecords = useMemo(() => {
      let list = myRecords.filter(r => {
          if (isRecordFinished(r)) return false;
          if (!r.deadline) return false;
          const today = new Date();
          today.setHours(0,0,0,0);
          const deadline = new Date(r.deadline);
          deadline.setHours(0,0,0,0);
          const diffTime = deadline.getTime() - today.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          return diffDays < 0;
      });
      return filterAndSort(list, searchTerm, sortConfig);
  }, [myRecords, searchTerm, sortConfig]);

  // 8. Hồ sơ Gia hạn (Nhân viên tự theo dõi hồ sơ hẹn thêm ngày)
  const extendedRecords = useMemo(() => {
      let list = myRecords.filter(r => 
          r.extendedDeadline !== null && 
          r.extendedDeadline !== undefined && 
          r.extendedDeadline !== '' &&
          !isRecordFinished(r)
      );
      return filterAndSort(list, searchTerm, sortConfig);
  }, [myRecords, searchTerm, sortConfig, isRecordFinished]);

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
  const completedTotal = finishedRecords.length;

  // Xác định danh sách hiển thị dựa trên Tab đang chọn
  const displayRecords = 
      activeTab === 'pending' ? pendingRecords : 
      activeTab === 'completed_work' ? completedWorkRecords :
      activeTab === 'pending_sign' ? reviewRecords :
      activeTab === 'finished' ? finishedRecords :
      activeTab === 'approaching' ? approachingRecords :
      activeTab === 'overdue' ? overdueRecords :
      activeTab === 'extended' ? extendedRecords :
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

  const checkBlocking = async (record: RecordFile) => {
      const normalize = (str: any) => {
          if (str === null || str === undefined) return '';
          return String(str)
              .trim()
              .toLowerCase()
              .normalize('NFD')
              .replace(/[\u0300-\u036f]/g, '')
              .replace(/đ/g, 'd');
      };

      const cleanCommune = (c: string) => {
          return c.replace(/^(xa|phuong|thi tran)\s+/gi, '').trim();
      };

      const cleanCommuneAccents = (c: string) => {
          if (!c) return '';
          return c.replace(/^(xã|phường|thị trấn|xa|phuong|thi tran)\s+/gi, '').trim();
      };

      const matchTokens = (str1: string, str2: string) => {
          if (!str1 || !str2) return false;
          const tokens1 = str1.split(/[,;\s+vvn&]+/i).map(t => t.trim()).filter(Boolean);
          const tokens2 = str2.split(/[,;\s+vvn&]+/i).map(t => t.trim()).filter(Boolean);
          
          return tokens1.some(t1 => {
              return tokens2.some(t2 => {
                  if (t1 === t2) return true;
                  if (t1.includes('/') || t2.includes('/')) {
                      const base1 = t1.split('/')[0];
                      const base2 = t2.split('/')[0];
                      return base1 === base2;
                  }
                  return false;
              });
          });
      };

      const wardNorm = normalize(record.ward);
      const plotNorm = normalize(record.landPlot);
      const sheetNorm = normalize(record.mapSheet);

      if (!wardNorm && !plotNorm) return [];

      const cleanWard = cleanCommune(wardNorm);

      let activeList: any[] = [];
      let archiveList: any[] = [];
      let loadedFromSupabase = false;

      try {
              // Ưu tiên dữ liệu trực tuyến từ Supabase khi có kết nối mạng và đã cấu hình
              if (isConfigured && navigator.onLine) {
                  const orParts: string[] = [];

                  // Ưu tiên truy vấn theo thửa đất hoặc tờ bản đồ để tối đa hóa hiệu năng và độ chính xác, tránh tải thừa dữ liệu xã
                  if (plotNorm) {
                      const plotTokens = plotNorm.split(/[,;\s+vvn&]+/i).map(t => t.trim()).filter(Boolean);
                      const searchTerms = new Set<string>();
                      plotTokens.forEach(token => {
                          searchTerms.add(token);
                          if (token.includes('/')) {
                              const base = token.split('/')[0];
                              if (base) searchTerms.add(base);
                          }
                      });
                      searchTerms.forEach(term => {
                          orParts.push(`plots.cs.[{"oldPlotNumber":"${term}"}]`);
                          orParts.push(`plots.cs.[{"newPlotNumber":"${term}"}]`);
                      });
                  } else if (sheetNorm) {
                      const sheetTokens = sheetNorm.split(/[,;\s+vvn&]+/i).map(t => t.trim()).filter(Boolean);
                      const searchTerms = new Set<string>();
                      sheetTokens.forEach(token => {
                          searchTerms.add(token);
                          if (token.includes('/')) {
                              const base = token.split('/')[0];
                              if (base) searchTerms.add(base);
                          }
                      });
                      searchTerms.forEach(term => {
                          orParts.push(`plots.cs.[{"oldMapSheetNumber":"${term}"}]`);
                          orParts.push(`plots.cs.[{"newMapSheetNumber":"${term}"}]`);
                      });
                  } else if (cleanWard) {
                      const rawWard = record.ward || '';
                      const rawCleanWard = cleanCommuneAccents(rawWard);
                      if (rawCleanWard) {
                          orParts.push(`oldCommune.ilike.%${rawCleanWard}%`);
                          orParts.push(`newCommune.ilike.%${rawCleanWard}%`);
                      }
                      if (cleanWard && cleanWard !== normalize(rawCleanWard)) {
                          orParts.push(`oldCommune.ilike.%${cleanWard}%`);
                          orParts.push(`newCommune.ilike.%${cleanWard}%`);
                      }
                  }

                  if (orParts.length > 0) {
                      const orQuery = orParts.join(',');
                      const [activeRes, archiveRes] = await Promise.all([
                          supabase.from('blocking_records').select('*').or(orQuery),
                          supabase.from('archive_blocking_records').select('*').or(orQuery)
                      ]);
                      if (activeRes.error) throw activeRes.error;
                      if (archiveRes.error) throw archiveRes.error;
                      activeList = activeRes.data || [];
                      archiveList = archiveRes.data || [];
                      loadedFromSupabase = true;
                  }
              }
      } catch (e) {
          console.warn('Lỗi khi truy vấn dữ liệu trực tuyến từ Supabase, chuyển sang sử dụng dữ liệu ngoại tuyến:', e);
          loadedFromSupabase = false;
      }

      // Chỉ sử dụng dữ liệu ngoại tuyến khi không có mạng, chưa cấu hình, hoặc truy vấn trực tuyến thất bại
      if (!loadedFromSupabase) {
          try {
              activeList = await offlineDb.getRecords('blocking_records');
              archiveList = await offlineDb.getRecords('archive_blocking_records');
          } catch (e) {
              console.error('Lỗi khi truy xuất dữ liệu ngăn chặn ngoại tuyến:', e);
          }
      }

      const matches: { record: any; source: 'active' | 'archive' }[] = [];

      const checkList = (list: any[], source: 'active' | 'archive') => {
          list.forEach(blocking => {
              const blockOldNorm = normalize(blocking.oldCommune);
              const blockNewNorm = normalize(blocking.newCommune);
              
              const cleanBlockOld = cleanCommune(blockOldNorm);
              const cleanBlockNew = cleanCommune(blockNewNorm);

              // Xử lý khớp xã/phường thông minh:
              // Nếu hồ sơ hoặc dữ liệu chặn thiếu xã/phường -> bỏ qua kiểm tra xã và xem như khớp (để đối soát Tờ/Thửa/Tên chủ toàn hệ thống)
              const isCommuneMatch = 
                  (!cleanWard) || 
                  (!cleanBlockOld && !cleanBlockNew) ||
                  (cleanBlockOld && (cleanBlockOld === cleanWard || cleanBlockOld.includes(cleanWard) || cleanWard.includes(cleanBlockOld))) ||
                  (cleanBlockNew && (cleanBlockNew === cleanWard || cleanBlockNew.includes(cleanWard) || cleanWard.includes(cleanBlockNew)));

              // 1. Đối soát Tờ/Thửa đất
              const isPlotMatch = isCommuneMatch && plotNorm && (blocking.plots?.some((p: any) => {
                  const oldPlotNorm = normalize(p.oldPlotNumber);
                  const newPlotNorm = normalize(p.newPlotNumber);
                  const oldSheetNorm = normalize(p.oldMapSheetNumber);
                  const newSheetNorm = normalize(p.newMapSheetNumber);

                  const plotMatches = matchTokens(plotNorm, oldPlotNorm) || matchTokens(plotNorm, newPlotNorm);

                  let sheetMatches = !sheetNorm;
                  if (!sheetMatches) {
                      const hasOldSheet = !!oldSheetNorm;
                      const hasNewSheet = !!newSheetNorm;
                      if (!hasOldSheet && !hasNewSheet) {
                          sheetMatches = true;
                      } else {
                          const oldMatch = hasOldSheet && matchTokens(sheetNorm, oldSheetNorm);
                          const newMatch = hasNewSheet && matchTokens(sheetNorm, newSheetNorm);
                          sheetMatches = oldMatch || newMatch;
                      }
                  }

                  return plotMatches && sheetMatches;
              }) ?? false);

              // 2. Đối soát Tên chủ sử dụng
              let isOwnerMatch = false;
              const fileCustomer = normalize(record.customerName);
              if (isCommuneMatch && fileCustomer && blocking.owners && blocking.owners.length > 0) {
                  isOwnerMatch = blocking.owners.some((bo: string) => {
                      const boNorm = normalize(bo);
                      return boNorm && (fileCustomer === boNorm || fileCustomer.includes(boNorm) || boNorm.includes(fileCustomer));
                  });
              }

              // Loại bỏ việc cảnh báo khi chỉ trùng tên chủ sử dụng (Yêu cầu phải trùng thửa đất/isPlotMatch)
              if (isPlotMatch) {
                  matches.push({ record: blocking, source });
              }
          });
      };

      checkList(activeList, 'active');
      checkList(archiveList, 'archive');

      return matches;
  };

  // --- ACTIONS ---

  const handleMarkAsDone = async (record: RecordFile) => {
    setCheckingRecord(record);
    setPendingAction('mark_as_done');
    setCheckingStatus('checking');
    setIsCheckingBlocking(true);

    try {
      const matches = await checkBlocking(record);
      if (matches.length > 0) {
        setCheckingStatus('found');
        setIsCheckingBlocking(false);
        setBlockingMatches(matches);
        setPendingRecord(record);
        setIsBlockingWarningOpen(true);
        return;
      }

      setCheckingStatus('passed');
    } catch (e) {
      console.error('Lỗi kiểm tra ngăn chặn:', e);
      setIsCheckingBlocking(false);
      setCheckingRecord(null);
      await proceedMarkAsDone(record);
    }
  };

  const proceedMarkAsDone = async (record: RecordFile, skipConfirm = false) => {
    if (skipConfirm || await confirmAction(`Xác nhận đã hoàn thành công việc cho hồ sơ ${record.code}?\nHồ sơ sẽ chuyển sang trạng thái "Đã thực hiện".`)) {
        if (record.recordType === 'Sao lục' || record.recordType === 'Công văn') {
            // Handle Archive Record
            const archiveType = record.recordType === 'Sao lục' ? 'saoluc' : 'congvan';
            // Find original record to get full data if needed, or just update status
            // We need to append history as well.
            
            const historyEntry = {
                action: 'Thực hiện xong',
                status: 'executed',
                timestamp: new Date().toISOString(),
                user: user.name
            };

            // We need to fetch the current record to get its data.history
            // Or we can just use the one from archiveRecords state
            const currentArchive = archiveRecords.find(r => r.id === record.id);
            if (currentArchive) {
                 const oldHistory = Array.isArray(currentArchive.data?.history) ? currentArchive.data.history : [];
                 const newHistory = [...oldHistory, historyEntry];
                 
                 await saveArchiveRecord({
                     ...currentArchive,
                     status: 'executed',
                     data: { ...currentArchive.data, history: newHistory }
                 });
                 
                 // Refresh data
                 const saoluc = await fetchArchiveRecords('saoluc');
                 const congvan = await fetchArchiveRecords('congvan');
                 setArchiveRecords([...saoluc, ...congvan]);
            }
        } else {
            // Normal Record
            onUpdateStatus(record, RecordStatus.COMPLETED_WORK);
        }
    }
  };

  const handleForwardToSign = async (record: RecordFile) => {
    setCheckingRecord(record);
    setPendingAction('forward_to_sign');
    setCheckingStatus('checking');
    setIsCheckingBlocking(true);

    try {
      const matches = await checkBlocking(record);
      if (matches.length > 0) {
        setCheckingStatus('found');
        setIsCheckingBlocking(false);
        setBlockingMatches(matches);
        setPendingRecord(record);
        setIsBlockingWarningOpen(true);
        return;
      }

      setCheckingStatus('passed');
    } catch (e) {
      console.error('Lỗi kiểm tra ngăn chặn:', e);
      setIsCheckingBlocking(false);
      setCheckingRecord(null);
      await proceedForwardToSign(record);
    }
  };

  const proceedForwardToSign = async (record: RecordFile, skipConfirm = false) => {
    if (record.recordType === 'Sao lục' || record.recordType === 'Công văn') {
        if (skipConfirm || await confirmAction(`Bạn muốn chuyển hồ sơ ${record.code} sang trạng thái "Chờ ký duyệt"?`)) {
             // Handle Archive Record
            const historyEntry = {
                action: 'Trình ký',
                status: 'pending_sign',
                timestamp: new Date().toISOString(),
                user: user.name
            };

            const currentArchive = archiveRecords.find(r => r.id === record.id);
            if (currentArchive) {
                 const oldHistory = Array.isArray(currentArchive.data?.history) ? currentArchive.data.history : [];
                 const newHistory = [...oldHistory, historyEntry];
                 
                 await saveArchiveRecord({
                     ...currentArchive,
                     status: 'pending_sign',
                     data: { ...currentArchive.data, history: newHistory }
                 });
                 
                 // Refresh data
                 const saoluc = await fetchArchiveRecords('saoluc');
                 const congvan = await fetchArchiveRecords('congvan');
                 setArchiveRecords([...saoluc, ...congvan]);
            }
        }
    } else {
         // Normal Record => Mở modal yêu cầu nhập số lượng thửa đất (Áp dụng cho Đo đạc và Khác)
         setSelectedRecordForPlotCount(record);
         setIsPlotCountModalOpen(true);
    }
  };

  const handleConfirmPlotCount = (plotCount: number) => {
    if (selectedRecordForPlotCount) {
      onUpdateStatus(selectedRecordForPlotCount, RecordStatus.PENDING_SIGN, { plotCount });
      setIsPlotCountModalOpen(false);
      setSelectedRecordForPlotCount(null);
    }
  };

  const handleOpenForwardModal = (record: RecordFile) => {
    setSelectedRecordForForward(record);
    setSelectedRecipientId('');
    setForwardNotes('');
    setShowOnlySameDept(true);
    setIsForwardModalOpen(true);
  };

  const handleConfirmForward = () => {
    if (!selectedRecordForForward || !selectedRecipientId) return;
    onUpdateStatus(selectedRecordForForward, selectedRecordForForward.status, {
      forwardPendingTo: selectedRecipientId,
      forwardFrom: user.employeeId,
      forwardDate: new Date().toISOString(),
      forwardNotes: forwardNotes || null
    });
    setIsForwardModalOpen(false);
    setSelectedRecordForForward(null);
    setSelectedRecipientId('');
    setForwardNotes('');
  };

  const handleAcceptForward = (record: RecordFile) => {
    const sender = employees?.find(e => e.id === record.forwardFrom);
    const senderName = sender?.name || 'Nhân viên khác';
    const todayFormatted = new Date().toLocaleDateString('vi-VN');
    
    const newHistoryLine = `Chuyển tiếp từ ${senderName} ngày ${todayFormatted}`;
    const updatedHistory = record.forwardHistory ? `${record.forwardHistory}\n\n${newHistoryLine}` : newHistoryLine;

    onUpdateStatus(record, record.status, {
      assignedTo: user.employeeId,
      forwardPendingTo: null,
      forwardFrom: null,
      forwardDate: null,
      forwardNotes: null,
      forwardHistory: updatedHistory
    });
  };

  const handleDeclineForward = async (record: RecordFile) => {
    if (await confirmAction(`Từ chối nhận hồ sơ chuyển tiếp ${record.code}?`)) {
      onUpdateStatus(record, record.status, {
        forwardPendingTo: null,
        forwardFrom: null,
        forwardDate: null,
        forwardNotes: null
      });
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
          case 'finished': return 'Hoàn thành';
          case 'reminder': return 'Nhắc việc';
          case 'approaching': return 'Sắp tới hạn';
          case 'overdue': return 'Trễ hạn';
          case 'extended': return 'Hồ sơ gia hạn';
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
        <div className="flex flex-wrap gap-2 lg:gap-3 w-full md:w-auto justify-center md:justify-end">
             <div className="flex-1 md:flex-none text-center px-3 py-1.5 bg-blue-50 rounded-lg border border-blue-100 min-w-[90px]">
                <div className="text-xl font-bold text-blue-700">{pendingRecords.length}</div>
                <div className="text-[10px] text-blue-600 uppercase font-semibold">Đang xử lý</div>
             </div>
             <div className="flex-1 md:flex-none text-center px-3 py-1.5 bg-cyan-50 rounded-lg border border-cyan-100 min-w-[90px]">
                <div className="text-xl font-bold text-cyan-700">{completedWorkRecords.length}</div>
                <div className="text-[10px] text-cyan-600 uppercase font-semibold">Đã thực hiện</div>
             </div>
             <div className="flex-1 md:flex-none text-center px-3 py-1.5 bg-purple-50 rounded-lg border border-purple-100 min-w-[90px]">
                <div className="text-xl font-bold text-purple-700">{reviewRecords.length}</div>
                <div className="text-[10px] text-purple-600 uppercase font-semibold">Chờ ký</div>
             </div>
             <div className="flex-1 md:flex-none text-center px-3 py-1.5 bg-green-50 rounded-lg border border-green-100 min-w-[90px]">
                <div className="text-xl font-bold text-green-700">{finishedRecords.length}</div>
                <div className="text-[10px] text-green-600 uppercase font-semibold">Hoàn thành</div>
             </div>
             <div className="flex-1 md:flex-none text-center px-3 py-1.5 bg-orange-50 rounded-lg border border-orange-100 min-w-[90px]">
                <div className="text-xl font-bold text-orange-700">{approachingRecords.length}</div>
                <div className="text-[10px] text-orange-600 uppercase font-semibold">Sắp tới hạn</div>
             </div>
             <div className="flex-1 md:flex-none text-center px-3 py-1.5 bg-red-50 rounded-lg border border-red-100 min-w-[90px]">
                <div className="text-xl font-bold text-red-700">{overdueRecords.length}</div>
                <div className="text-[10px] text-red-600 uppercase font-semibold">Trễ hạn</div>
             </div>
        </div>
      </div>

      {/* Thông báo tiếp nhận hồ sơ chuyển tiếp */}
      {incomingForwards.length > 0 && (
         <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 shadow-sm space-y-3 shrink-0 animate-fade-in">
             <div className="flex items-center gap-2 text-indigo-800 font-bold">
                 <Bell size={18} className="text-indigo-600 animate-bounce" />
                 <span>Yêu cầu chuyển tiếp hồ sơ cần xử lý ({incomingForwards.length})</span>
             </div>
             <div className="divide-y divide-indigo-100 max-h-48 overflow-y-auto pr-1">
                 {incomingForwards.map(r => {
                     const sender = employees?.find(e => e.id === r.forwardFrom);
                     return (
                         <div key={r.id} className="py-2.5 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm">
                             <div>
                                 <div className="font-semibold text-gray-800">
                                     Hồ sơ <span className="text-indigo-700 font-bold">{r.code}</span> - {r.customerName}
                                 </div>
                                 <div className="text-xs text-gray-500 mt-1">
                                     Chuyển tiếp từ <span className="font-bold text-gray-700">{sender?.name || r.forwardFrom}</span> ngày <span className="font-bold text-gray-700">{formatDate(r.forwardDate || undefined)}</span>
                                     {r.forwardNotes && (
                                         <span className="italic text-gray-600"> — "{r.forwardNotes}"</span>
                                     )}
                                 </div>
                             </div>
                             <div className="flex items-center gap-2 shrink-0">
                                 <button 
                                     onClick={() => handleAcceptForward(r)}
                                     className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md font-bold text-xs transition-colors shadow-sm flex items-center gap-1"
                                 >
                                     <CheckCircle size={14} /> Đồng ý nhận
                                 </button>
                                 <button 
                                     onClick={() => handleDeclineForward(r)}
                                     className="px-3 py-1.5 bg-white hover:bg-gray-50 text-gray-600 border border-gray-200 rounded-md font-bold text-xs transition-colors shadow-sm"
                                 >
                                     Từ chối
                                 </button>
                             </div>
                         </div>
                     );
                 })}
             </div>
         </div>
      )}

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
                    onClick={() => { setActiveTab('extended'); setCurrentPage(1); setSearchTerm(''); }}
                    className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-bold transition-all whitespace-nowrap ${
                        activeTab === 'extended' ? 'bg-amber-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'
                    }`}
                >
                    <CalendarClock size={16} /> Hồ sơ gia hạn ({extendedRecords.length})
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
                    onClick={() => { setActiveTab('finished'); setCurrentPage(1); setSearchTerm(''); }}
                    className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-bold transition-all whitespace-nowrap ${
                        activeTab === 'finished' ? 'bg-green-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'
                    }`}
                >
                    <FileCheck size={16} /> Hoàn thành ({finishedRecords.length})
                </button>
                <button 
                    onClick={() => { setActiveTab('approaching'); setCurrentPage(1); setSearchTerm(''); }}
                    className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-bold transition-all whitespace-nowrap ${
                        activeTab === 'approaching' ? 'bg-orange-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'
                    }`}
                >
                    <Clock size={16} /> Sắp tới hạn ({approachingRecords.length})
                </button>
                <button 
                    onClick={() => { setActiveTab('overdue'); setCurrentPage(1); setSearchTerm(''); }}
                    className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-bold transition-all whitespace-nowrap ${
                        activeTab === 'overdue' ? 'bg-red-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'
                    }`}
                >
                    <AlertTriangle size={16} /> Trễ hạn ({overdueRecords.length})
                </button>
                <button 
                    onClick={() => { setActiveTab('reminder'); setCurrentPage(1); setSearchTerm(''); }}
                    className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-bold transition-all whitespace-nowrap ${
                        activeTab === 'reminder' ? 'bg-pink-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'
                    }`}
                >
                    <Bell size={16} /> Nhắc việc ({reminderRecords.length})
                </button>
                <button 
                    onClick={() => { setActiveTab('report'); }}
                    className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-bold transition-all whitespace-nowrap ${
                        activeTab === 'report' ? 'bg-orange-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'
                    }`}
                >
                    Báo cáo cá nhân
                </button>
            </div>
            
            {activeTab !== 'report' && (
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
            )}
        </div>
        
        {activeTab === 'report' ? (
            <PersonalReportView myRecords={myRecords} user={user} />
        ) : (
            <>
                <div className="flex-1 overflow-y-auto">
            {displayRecords.length > 0 ? (
                <table className={`w-full text-left table-fixed ${activeTab === 'extended' ? 'min-w-[1250px]' : 'min-w-[1050px]'}`}>
                    <thead className="bg-white border-b border-gray-200 text-xs text-gray-500 uppercase sticky top-0 shadow-sm z-10">
                        <tr>
                            <th className="p-3 w-10 text-center">#</th>
                            <th className="p-3 w-[120px]">{renderSortHeader('Mã HS', 'code')}</th>
                            <th className="p-3 w-[180px]">{renderSortHeader('Chủ sử dụng', 'customerName')}</th>
                            <th className="p-3 w-[130px]">{renderSortHeader('Loại hồ sơ', 'recordType')}</th>
                            {activeTab === 'completed_work' ? (
                                <th className="p-3 w-[110px]">{renderSortHeader('Ngày thực hiện', 'workCompletedDate')}</th>
                            ) : activeTab === 'extended' ? (
                                <>
                                    <th className="p-3 w-[110px]">{renderSortHeader('Hạn gốc', 'deadline')}</th>
                                    <th className="p-3 w-[110px]">{renderSortHeader('Ngày trình ký', 'submissionDate')}</th>
                                    <th className="p-3 w-[110px]">{renderSortHeader('Ngày thực hiện', 'workCompletedDate')}</th>
                                </>
                            ) : (
                                <th className="p-3 w-[110px]">{renderSortHeader('Ngày trình', 'submissionDate')}</th>
                            )}
                            
                            <th className="p-3 w-[150px]">
                                {activeTab === 'reminder' 
                                    ? <div className="flex items-center gap-1 text-pink-600"><CalendarClock size={14}/> Thời gian nhắc</div>
                                    : activeTab === 'extended'
                                    ? <div className="flex items-center gap-1 text-amber-600"><CalendarClock size={14}/> Ngày hẹn mới</div>
                                    : renderSortHeader('Hẹn trả', 'deadline')
                                }
                            </th>
                            
                            <th className="p-3 text-center w-[120px]">Trạng thái</th>
                            <th className="p-3 text-center w-[100px]">Chỉnh lý</th>
                            <th className="p-3 text-center min-w-[280px] whitespace-nowrap">Thao tác chính</th>
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
                                    {activeTab === 'completed_work' ? (
                                        <td className="p-3 text-gray-600 align-middle text-center">{formatDate(r.workCompletedDate || undefined)}</td>
                                    ) : activeTab === 'extended' ? (
                                        <>
                                            <td className="p-3 text-gray-600 align-middle text-center">{formatDate(r.deadline || undefined)}</td>
                                            <td className="p-3 text-gray-600 align-middle text-center">{formatDate(r.submissionDate || undefined)}</td>
                                            <td className="p-3 text-gray-600 align-middle text-center">{formatDate(r.workCompletedDate || undefined)}</td>
                                        </>
                                    ) : (
                                        <td className="p-3 text-gray-600 align-middle text-center">{formatDate(r.submissionDate || undefined)}</td>
                                    )}
                                    
                                    <td className="p-3 align-middle">
                                        {activeTab === 'reminder' ? (
                                            <div className="flex items-center gap-1.5 text-pink-700 font-bold bg-pink-100 px-2 py-1 rounded w-fit text-xs">
                                                <Bell size={12} className="fill-pink-700"/>
                                                {formatDateTime(r.reminderDate || undefined)}
                                            </div>
                                        ) : activeTab === 'extended' ? (
                                            <div className="flex items-center gap-1.5 text-amber-700 font-bold bg-amber-100 px-2 py-1 rounded w-fit text-xs">
                                                <CalendarClock size={12} className="text-amber-700"/>
                                                {formatDate(r.extendedDeadline || undefined)}
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
                                                className={`inline-flex items-center justify-center gap-1 px-2 py-1 rounded-md border transition-all text-xs font-semibold shadow-2xs whitespace-nowrap cursor-pointer ${
                                                    r.needsMapCorrection 
                                                    ? 'bg-orange-500 text-white border-orange-500 hover:bg-orange-600' 
                                                    : 'bg-white text-slate-500 border-slate-200 hover:text-slate-700 hover:bg-slate-50'
                                                }`}
                                                title={r.needsMapCorrection ? "Đang có yêu cầu. Bấm để HỦY." : "Yêu cầu chỉnh lý bản đồ"}
                                            >
                                                <Map size={13} />
                                                <span>{r.needsMapCorrection ? "Đang chỉnh lý" : "Yêu cầu"}</span>
                                            </button>
                                        )}
                                    </td>

                                    <td className="p-3 align-middle">
                                        <div className="flex items-center justify-center gap-1.5 whitespace-nowrap">
                                            {/* Nút Xem chi tiết */}
                                            <button 
                                                onClick={() => onViewRecord(r)} 
                                                className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 hover:text-blue-600 hover:border-blue-300 text-xs font-semibold transition-all shadow-2xs cursor-pointer"
                                                title="Xem chi tiết hồ sơ"
                                            >
                                                <Eye size={13} className="text-slate-500" />
                                                <span>Chi tiết</span>
                                            </button>
                                            
                                            {/* Nút Thanh lý */}
                                            {onCreateLiquidation && (
                                                <button 
                                                    onClick={() => onCreateLiquidation(r)} 
                                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200/80 rounded-lg hover:bg-emerald-100 hover:border-emerald-300 text-xs font-semibold shadow-2xs transition-all cursor-pointer" 
                                                    title="Thanh lý hợp đồng"
                                                >
                                                    <FileCheck size={13} />
                                                    <span>Thanh lý</span>
                                                </button>
                                            )}

                                            {/* Nút Phiếu xin lỗi */}
                                            <button 
                                                onClick={() => { setSelectedRecordForPhieu(r); setShowPhieuXinLoi(true); }}
                                                className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-amber-50 text-amber-700 border border-amber-200/80 rounded-lg hover:bg-amber-100 hover:border-amber-300 text-xs font-semibold shadow-2xs transition-all cursor-pointer" 
                                                title="Lập phiếu xin lỗi do trễ hạn"
                                            >
                                                <FileText size={13} />
                                                <span>Phiếu XL</span>
                                            </button>

                                            {/* Nút Chuyển tiếp */}
                                            {(activeTab === 'pending' || activeTab === 'extended') && r.status !== RecordStatus.COMPLETED_WORK && (
                                                <button 
                                                    onClick={() => handleOpenForwardModal(r)}
                                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-indigo-50 text-indigo-700 border border-indigo-200/80 rounded-lg hover:bg-indigo-100 hover:border-indigo-300 text-xs font-semibold shadow-2xs transition-all cursor-pointer" 
                                                    title="Chuyển tiếp hồ sơ cho nhân viên khác"
                                                >
                                                    <ArrowRight size={13} />
                                                    <span>Chuyển tiếp</span>
                                                </button>
                                            )}

                                            {/* Nút Đã thực hiện */}
                                            {(activeTab === 'pending' || activeTab === 'extended') && r.status !== RecordStatus.COMPLETED_WORK && (
                                                <button 
                                                    onClick={() => handleMarkAsDone(r)} 
                                                    title="Đánh dấu đã thực hiện" 
                                                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-teal-600 text-white border border-teal-600 rounded-lg hover:bg-teal-700 text-xs font-bold shadow-2xs transition-all cursor-pointer"
                                                >
                                                    <CheckSquare size={13} />
                                                    <span>Đã thực hiện</span>
                                                </button>
                                            )}

                                            {/* Nút Trình ký */}
                                            {(activeTab === 'completed_work' || (activeTab === 'extended' && r.status === RecordStatus.COMPLETED_WORK)) && (
                                                <button 
                                                    onClick={() => handleForwardToSign(r)} 
                                                    title="Chuyển sang bước Ký kiểm tra" 
                                                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-purple-600 text-white border border-purple-600 rounded-lg hover:bg-purple-700 text-xs font-bold shadow-2xs transition-all cursor-pointer"
                                                >
                                                    <Send size={13} />
                                                    <span>Trình ký</span>
                                                </button>
                                            )}
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
            <PaginationControls
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={displayRecords.length}
                itemsPerPage={itemsPerPage}
                onPageChange={setCurrentPage}
                onItemsPerPageChange={setItemsPerPage}
                unitName="hồ sơ"
            />
        )}
        </>
        )}
      </div>
      
      {showPhieuXinLoi && selectedRecordForPhieu && (
        <PhieuXinLoiModal
            data={selectedRecordForPhieu}
            receivingWard={selectedRecordForPhieu.receivingWard || getReceivingWard(selectedRecordForPhieu) || employees?.find(e => e.id === user.employeeId)?.managedWards?.[0] || 'chơn thành'}
            onClose={() => {
                setShowPhieuXinLoi(false);
                setSelectedRecordForPhieu(null);
            }}
        />
      )}

      <PlotCountModal
        isOpen={isPlotCountModalOpen}
        onClose={() => {
          setIsPlotCountModalOpen(false);
          setSelectedRecordForPlotCount(null);
        }}
        onConfirm={handleConfirmPlotCount}
        record={selectedRecordForPlotCount}
      />

      {/* POPUP THÔNG BÁO ĐANG KIỂM TRA NGĂN CHẶN */}
      {isCheckingBlocking && checkingRecord && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 max-w-md w-full p-6 text-center animate-scale-up space-y-4">
            {checkingStatus === 'checking' ? (
              <>
                <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto shadow-inner relative">
                  <ShieldAlert size={34} className="animate-pulse" />
                  <span className="absolute inset-0 rounded-full border-2 border-amber-500 border-t-transparent animate-spin"></span>
                </div>
                <div className="space-y-1.5">
                  <h3 className="font-bold text-gray-900 text-lg flex items-center justify-center gap-2">
                    <span>Đang kiểm tra ngăn chặn...</span>
                  </h3>
                  <p className="text-xs text-gray-500 font-medium leading-relaxed">
                    Hệ thống đang đối soát dữ liệu thửa đất, tờ bản đồ và chủ sử dụng của hồ sơ <span className="font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 font-mono">{checkingRecord.code}</span> với CSDL ngăn chặn.
                  </p>
                </div>
                
                {/* Chi tiết thông tin đối soát */}
                <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 text-left text-xs space-y-1.5">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Thông tin đối soát ngăn chặn</div>
                  <div className="flex justify-between items-center text-slate-700">
                    <span className="text-slate-500">Mã hồ sơ:</span>
                    <span className="font-bold font-mono text-slate-900">{checkingRecord.code}</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-700">
                    <span className="text-slate-500">Chủ sử dụng:</span>
                    <span className="font-bold text-slate-900 truncate max-w-[200px]" title={checkingRecord.customerName}>{checkingRecord.customerName || '---'}</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-700">
                    <span className="text-slate-500">Thửa đất / Tờ BD:</span>
                    <span className="font-bold font-mono text-slate-900">{checkingRecord.landPlot || '---'} / {checkingRecord.mapSheet || '---'}</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-700">
                    <span className="text-slate-500">Xã / Phường:</span>
                    <span className="font-bold text-slate-900">{checkingRecord.ward || '---'}</span>
                  </div>
                </div>

                <div className="flex items-center justify-center gap-2 text-[11px] font-bold text-amber-700 bg-amber-50 py-1.5 px-3 rounded-lg border border-amber-200/80">
                  <RefreshCw size={12} className="animate-spin shrink-0" />
                  <span>Đang thực hiện đối soát tự động...</span>
                </div>
              </>
            ) : checkingStatus === 'passed' ? (
              <>
                <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner animate-scale-up">
                  <CheckCircle size={38} />
                </div>
                <div className="space-y-1.5">
                  <h3 className="font-bold text-emerald-800 text-lg">Kiểm tra ngăn chặn hoàn tất</h3>
                  <div className="inline-flex items-center gap-1.5 text-xs text-emerald-700 font-bold bg-emerald-50 py-1 px-3 rounded-full border border-emerald-200 shadow-2xs">
                    <CheckCircle size={14} className="text-emerald-600" />
                    <span>Không phát hiện thông tin ngăn chặn</span>
                  </div>
                  <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                    Hồ sơ <span className="font-bold text-gray-900 font-mono">{checkingRecord.code}</span> hoàn toàn an toàn, đủ điều kiện để thực hiện chuyển bước tiếp theo.
                  </p>
                </div>

                {/* Chi tiết thông tin đối soát an toàn */}
                <div className="bg-emerald-50/60 border border-emerald-200/80 rounded-xl p-3 text-left text-xs space-y-1.5">
                  <div className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider flex items-center justify-between">
                    <span>Thông tin đối soát</span>
                    <span className="text-emerald-600 font-normal">An toàn (0 trùng khớp)</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-700">
                    <span className="text-slate-500">Mã hồ sơ:</span>
                    <span className="font-bold font-mono text-slate-900">{checkingRecord.code}</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-700">
                    <span className="text-slate-500">Chủ sử dụng:</span>
                    <span className="font-bold text-slate-900 truncate max-w-[200px]" title={checkingRecord.customerName}>{checkingRecord.customerName || '---'}</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-700">
                    <span className="text-slate-500">Thửa đất / Tờ BD:</span>
                    <span className="font-bold font-mono text-slate-900">{checkingRecord.landPlot || '---'} / {checkingRecord.mapSheet || '---'}</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-700">
                    <span className="text-slate-500">Xã / Phường:</span>
                    <span className="font-bold text-slate-900">{checkingRecord.ward || '---'}</span>
                  </div>
                </div>

                {/* Nút thao tác xác nhận chuyển bước ngay trên popup */}
                <div className="pt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsCheckingBlocking(false);
                      setCheckingRecord(null);
                      setPendingAction(null);
                    }}
                    className="w-1/3 py-2.5 px-3 text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 active:bg-gray-300 rounded-xl transition-colors"
                  >
                    Đóng / Hủy
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      const rec = checkingRecord;
                      const act = pendingAction;
                      setIsCheckingBlocking(false);
                      setCheckingRecord(null);
                      setPendingAction(null);
                      if (rec) {
                        if (act === 'mark_as_done') {
                          await proceedMarkAsDone(rec, true);
                        } else if (act === 'forward_to_sign') {
                          await proceedForwardToSign(rec, true);
                        }
                      }
                    }}
                    className={`w-2/3 py-2.5 px-4 text-xs font-bold text-white rounded-xl shadow-md transition-all flex items-center justify-center gap-2 ${
                      pendingAction === 'forward_to_sign'
                        ? 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 shadow-purple-500/20'
                        : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'
                    }`}
                  >
                    <CheckSquare size={16} />
                    <span>
                      {pendingAction === 'forward_to_sign' ? 'Xác nhận chuyển "Trình ký"' : 'Xác nhận "Đã thực hiện"'}
                    </span>
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                  <ShieldAlert size={38} />
                </div>
                <div className="space-y-1.5">
                  <h3 className="font-bold text-red-700 text-lg">Phát hiện thông tin ngăn chặn!</h3>
                  <p className="text-xs text-red-600 font-medium">
                    Đang hiển thị chi tiết văn bản ngăn chặn liên quan...
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <BlockingWarningModal
        isOpen={isBlockingWarningOpen}
        onClose={() => {
          setIsBlockingWarningOpen(false);
          setPendingRecord(null);
          setBlockingMatches([]);
          setPendingAction(null);
        }}
        onConfirm={() => {
          if (pendingRecord) {
            if (pendingAction === 'mark_as_done') {
              proceedMarkAsDone(pendingRecord);
            } else if (pendingAction === 'forward_to_sign') {
              proceedForwardToSign(pendingRecord);
            }
          }
          setIsBlockingWarningOpen(false);
          setPendingRecord(null);
          setBlockingMatches([]);
          setPendingAction(null);
        }}
        matches={blockingMatches}
        recordFile={pendingRecord}
      />

      {isForwardModalOpen && selectedRecordForForward && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-xl shadow-xl border border-gray-100 max-w-3xl w-full overflow-hidden animate-scale-up flex flex-col max-h-[95vh]">
            <div className="bg-indigo-600 text-white p-4 font-bold text-lg flex items-center gap-2 shrink-0">
              <ArrowRight size={20} />
              Chuyển tiếp hồ sơ {selectedRecordForForward.code}
            </div>
            
            {/* THÔNG TIN CƠ BẢN HỒ SƠ - TRÁNH BẤM LỘN */}
            <div className="bg-indigo-50/50 border border-indigo-100/80 p-4 text-xs text-gray-700 space-y-2 shrink-0">
              <div className="font-bold text-gray-400 uppercase tracking-wider text-[10px]">Thông tin hồ sơ chuyển tiếp</div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1.5 font-medium">
                <div>
                  <span className="text-gray-400">Mã hồ sơ:</span>{' '}
                  <span className="font-bold text-indigo-900">{selectedRecordForForward.code}</span>
                </div>
                <div>
                  <span className="text-gray-400">Loại hồ sơ:</span>{' '}
                  <span className="font-bold text-gray-800">{selectedRecordForForward.recordType || 'Chưa rõ'}</span>
                </div>
                <div>
                  <span className="text-gray-400">Chủ hồ sơ:</span>{' '}
                  <span className="font-bold text-gray-800">{selectedRecordForForward.customerName}</span>
                </div>
                <div>
                  <span className="text-gray-400">Xã/Phường:</span>{' '}
                  <span className="font-bold text-gray-800">{selectedRecordForForward.ward || '---'}</span>
                </div>
                <div>
                  <span className="text-gray-400">Thửa / Tờ:</span>{' '}
                  <span className="font-bold text-gray-800">
                    {selectedRecordForForward.landPlot || '---'} / {selectedRecordForForward.mapSheet || '---'}
                  </span>
                </div>
                {recordDept && (
                  <div>
                    <span className="text-indigo-600 font-bold bg-indigo-100/60 px-2 py-0.5 rounded text-[10px]">
                      {recordDept}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              {/* CHỌN NHÂN VIÊN TIẾP NHẬN - BẤM CHỌN TRỰC TIẾP */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-xs font-bold uppercase tracking-wider text-gray-500 block">
                    Danh sách nhân viên đề xuất *
                  </label>
                  {recordDept && (
                    <label className="flex items-center gap-1.5 text-xs text-indigo-700 font-semibold cursor-pointer select-none">
                      <input 
                        type="checkbox"
                        checked={showOnlySameDept}
                        onChange={(e) => {
                          setShowOnlySameDept(e.target.checked);
                          if (e.target.checked && selectedRecipientId) {
                            const stillVisible = employees?.find(emp => emp.id === selectedRecipientId)?.department === recordDept;
                            if (!stillVisible) setSelectedRecipientId('');
                          }
                        }}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5"
                      />
                      <span>Chỉ đề xuất cùng {recordDept}</span>
                    </label>
                  )}
                </div>
                
                <div className="max-h-[360px] overflow-y-auto p-4 bg-gray-50/50 border border-gray-250 rounded-xl">
                  {visibleEmployeesForForward.length === 0 ? (
                    <div className="p-8 text-center text-gray-400 text-xs bg-white rounded-lg border border-gray-150">
                      Không tìm thấy nhân viên nào cùng tổ phù hợp.
                      {recordDept && showOnlySameDept && (
                        <button
                          type="button"
                          onClick={() => setShowOnlySameDept(false)}
                          className="mt-2 block mx-auto text-indigo-600 hover:text-indigo-800 font-bold hover:underline"
                        >
                          Hiển thị tất cả nhân viên các tổ khác
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 animate-fade-in">
                      {visibleEmployeesForForward.map(e => {
                        const isSelected = selectedRecipientId === e.id;
                        return (
                          <div
                            key={e.id}
                            onClick={() => setSelectedRecipientId(e.id)}
                            className={`p-4 rounded-xl border bg-white cursor-pointer transition-all flex items-center justify-between gap-3 select-none hover:shadow-sm ${
                              isSelected 
                                ? 'border-indigo-500 ring-2 ring-indigo-100 bg-indigo-50/10' 
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            <div className="flex items-center min-w-0">
                              {/* Chi tiết */}
                              <div className="min-w-0">
                                <div className="font-bold text-gray-900 text-[14px] leading-tight truncate">
                                  {e.name}
                                </div>
                              </div>
                            </div>

                            {/* Chỉ báo đã chọn */}
                            {isSelected ? (
                              <div className="w-5 h-5 bg-indigo-600 rounded-full flex items-center justify-center text-white shadow-sm shrink-0">
                                <CheckCircle size={12} />
                              </div>
                            ) : (
                              <div className="w-5 h-5 border border-gray-200 rounded-full shrink-0 transition-colors hover:border-indigo-300 bg-white" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* GHI CHÚ CHUYỂN TIẾP */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-gray-500 block mb-2">Ghi chú chuyển tiếp (Không bắt buộc)</label>
                <textarea 
                  rows={2}
                  className="w-full border border-gray-200 rounded-lg p-2.5 text-sm bg-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all placeholder:text-gray-400 font-medium text-gray-700"
                  placeholder="Nhập ghi chú hoặc yêu cầu chuyển tiếp..."
                  value={forwardNotes}
                  onChange={(e) => setForwardNotes(e.target.value)}
                />
              </div>
            </div>
            
            <div className="bg-gray-50 p-4 border-t border-gray-100 flex justify-end gap-2.5 shrink-0">
              <button 
                onClick={() => {
                  setIsForwardModalOpen(false);
                  setSelectedRecordForForward(null);
                  setSelectedRecipientId('');
                  setForwardNotes('');
                }}
                className="px-4 py-2 text-sm font-bold text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Hủy
              </button>
              <button 
                onClick={handleConfirmForward}
                disabled={!selectedRecipientId}
                className="px-4 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:hover:bg-indigo-600 rounded-lg shadow-md transition-all flex items-center gap-1"
              >
                <ArrowRight size={16} /> Xác nhận chuyển tiếp
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PersonalProfile;
