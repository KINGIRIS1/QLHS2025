import React, { useState, useEffect, useMemo } from 'react';
import { User, LandRecord } from '../../types';
import RecordForm from '../RecordForm';
import { Search, Plus, User as UserIcon, Calendar, MapPin, Loader2, ShieldAlert, FileText, CheckCircle, Trash2, Edit, Paperclip, Download, Upload, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import * as XLSX from 'xlsx-js-style';
import { supabase, isConfigured } from '../../services/supabaseClient';
import { offlineDb } from '../../utils/offlineDb';

const safeSaveOfflineRecords = (key: string, data: any[]) => {
  try {
    // Limit to maximum 500 records to prevent localStorage QuotaExceededError (5MB limit)
    const truncatedData = data.length > 500 ? data.slice(0, 500) : data;
    localStorage.setItem(key, JSON.stringify(truncatedData));
  } catch (e) {
    console.warn(`Warning: Could not save records to localStorage for key ${key}:`, e);
    try {
      localStorage.setItem(key, JSON.stringify(data.slice(0, 50)));
    } catch (innerError) {
      console.error('Failed to save even a smaller slice to localStorage:', innerError);
    }
  }
};

const stripAccents = (str: string) => {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'd');
};

const normalizeSearchText = (str: any): string => {
  if (str === null || str === undefined) return '';
  return String(str)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd');
};

const extractOwnersList = (owners: any): string[] => {
  if (!owners) return [];
  if (Array.isArray(owners)) {
    return owners.flatMap(o => {
      if (typeof o === 'string') {
        return o.split(/[,;\n\r]+/).map(s => s.trim()).filter(Boolean);
      }
      return o ? [String(o)] : [];
    });
  }
  if (typeof owners === 'string') {
    return owners.split(/[,;\n\r]+/).map(s => s.trim()).filter(Boolean);
  }
  return [String(owners)];
};

const checkOwnerMatch = (recordOwners: any, searchOwner: string): boolean => {
  if (!searchOwner || !searchOwner.trim()) return true;
  const searchRaw = searchOwner.trim().toLowerCase();
  const searchNorm = normalizeSearchText(searchOwner);
  const ownersList = extractOwnersList(recordOwners);
  
  if (ownersList.length === 0) return false;

  const combinedRaw = ownersList.join(' ').toLowerCase();
  const combinedNorm = normalizeSearchText(combinedRaw);

  // 1. Khớp chuỗi trực tiếp (không phân biệt hoa thường)
  if (combinedRaw.includes(searchRaw)) return true;

  // 2. Khớp chuỗi không dấu (accent-insensitive)
  if (combinedNorm.includes(searchNorm)) return true;

  // 3. Khớp trên từng chủ riêng lẻ trong danh sách
  for (const owner of ownersList) {
    const ownerRaw = owner.toLowerCase();
    const ownerNorm = normalizeSearchText(owner);
    if (ownerRaw.includes(searchRaw) || ownerNorm.includes(searchNorm)) {
      return true;
    }
  }

  // 4. Khớp theo từng từ khóa (token)
  const searchTokens = searchNorm.split(/\s+/).filter(Boolean);
  if (searchTokens.length > 0 && searchTokens.every(token => combinedNorm.includes(token))) {
    return true;
  }

  return false;
};

const checkPlotMatch = (plots: any[], filters: { oldPlotNumber?: string; oldMapSheetNumber?: string; newPlotNumber?: string; newMapSheetNumber?: string }): boolean => {
  if (!filters.oldPlotNumber && !filters.oldMapSheetNumber && !filters.newPlotNumber && !filters.newMapSheetNumber) {
    return true;
  }
  if (!plots || !Array.isArray(plots) || plots.length === 0) return false;

  const targetOldPlot = normalizeSearchText(filters.oldPlotNumber);
  const targetOldMap = normalizeSearchText(filters.oldMapSheetNumber);
  const targetNewPlot = normalizeSearchText(filters.newPlotNumber);
  const targetNewMap = normalizeSearchText(filters.newMapSheetNumber);

  return plots.some(p => {
    const pOldPlot = normalizeSearchText(p.oldPlotNumber || (p as any).plotNumber);
    const pOldMap = normalizeSearchText(p.oldMapSheetNumber);
    const pNewPlot = normalizeSearchText(p.newPlotNumber);
    const pNewMap = normalizeSearchText(p.newMapSheetNumber);

    const mOThua = !targetOldPlot || pOldPlot.includes(targetOldPlot);
    const mOTo = !targetOldMap || pOldMap.includes(targetOldMap);
    const mNThua = !targetNewPlot || pNewPlot.includes(targetNewPlot);
    const mNTo = !targetNewMap || pNewMap.includes(targetNewMap);

    return mOThua && mOTo && mNThua && mNTo;
  });
};

const checkDocMatch = (blockingDocuments: any[], searchDoc: string): boolean => {
  if (!searchDoc || !searchDoc.trim()) return true;
  if (!blockingDocuments || !Array.isArray(blockingDocuments) || blockingDocuments.length === 0) return false;

  const searchNorm = normalizeSearchText(searchDoc);
  return blockingDocuments.some(d => {
    const docNumNorm = normalizeSearchText(d.docNumber);
    const docNoteNorm = normalizeSearchText(d.note);
    const docAgencyNorm = normalizeSearchText(d.agency);
    return docNumNorm.includes(searchNorm) || docNoteNorm.includes(searchNorm) || docAgencyNorm.includes(searchNorm);
  });
};

const PREDEFINED_OLD_COMMUNES = [
  'Hưng Long',
  'Minh Thành',
  'Thành Tâm',
  'Nha Bích',
  'Minh Lập',
  'Minh Thắng',
  'Minh Hưng',
  'Minh Long'
];

const PREDEFINED_NEW_COMMUNES = [
  'Hưng Long',
  'Minh Thành',
  'Thành Tâm',
  'Nha Bích',
  'Minh Lập',
  'Minh Thắng',
  'Minh Hưng',
  'Minh Long'
];

interface Props {
  currentUser: User;
}

const ArchiveBlockingView: React.FC<Props> = ({ currentUser }) => {
  const [records, setRecords] = useState<LandRecord[]>([]);
  const [loading, setLoading] = useState(false);

  const [searchFilters, setSearchFilters] = useState({
    issueNumber: '',
    certNumber: '',
    oldMapSheetNumber: '',
    oldPlotNumber: '',
    newMapSheetNumber: '',
    newPlotNumber: '',
    oldCommune: '',
    newCommune: '',
    docNumber: '',
    owner: '',
    unblockDoc: ''
  });

  const [appliedFilters, setAppliedFilters] = useState({
    issueNumber: '',
    certNumber: '',
    oldMapSheetNumber: '',
    oldPlotNumber: '',
    newMapSheetNumber: '',
    newPlotNumber: '',
    oldCommune: '',
    newCommune: '',
    docNumber: '',
    owner: '',
    unblockDoc: ''
  });

  const [showForm, setShowForm] = useState(false);
  const [editingRecord, setEditingRecord] = useState<LandRecord | undefined>();

  // Trích xuất danh sách Phường/Xã cũ và mới duy nhất từ tất cả các records để làm bộ lọc dropdown
  const oldCommunes = useMemo(() => {
    const list = records
      .map(r => r.oldCommune?.trim())
      .filter((v): v is string => typeof v === 'string' && v.length > 0);
    const combined = Array.from(new Set([...PREDEFINED_OLD_COMMUNES, ...list]));
    return combined.sort((a, b) => a.localeCompare(b, 'vi'));
  }, [records]);

  const newCommunes = useMemo(() => {
    const list = records
      .map(r => r.newCommune?.trim())
      .filter((v): v is string => typeof v === 'string' && v.length > 0);
    const combined = Array.from(new Set([...PREDEFINED_NEW_COMMUNES, ...list]));
    return combined.sort((a, b) => a.localeCompare(b, 'vi'));
  }, [records]);

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // State cho tiến trình import Excel chia lô (batch)
  const [importProgress, setImportProgress] = useState<{ active: boolean; current: number; total: number; status: string }>({ active: false, current: 0, total: 0, status: '' });

  // Phân trang
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  useEffect(() => {
    setCurrentPage(1);
  }, [appliedFilters]);

  const parseExcelDate = (val: any) => {
    if (!val) return '';
    if (typeof val === 'number') {
      const date = new Date(Math.round((val - 25569) * 86400 * 1000));
      return date.toISOString().split('T')[0];
    }
    if (typeof val === 'string') {
      const str = val.trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
      const parts = str.split(/[-/]/);
      if (parts.length === 3) {
        if (parts[0].length === 4) {
          return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
        } else {
          const day = parts[0].padStart(2, '0');
          const month = parts[1].padStart(2, '0');
          const year = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
          return `${year}-${month}-${day}`;
        }
      }
    }
    return val.toString();
  };

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data: any[] = XLSX.utils.sheet_to_json(ws);

        if (data.length === 0) {
          alert('File Excel rỗng!');
          return;
        }

        const newRecords: any[] = [];
        for (const row of data) {
          const hasAnyData = Object.values(row).some(val => val !== null && val !== undefined && val.toString().trim() !== '');
          if (!hasAnyData) continue;

          const ownersStr = row['Chủ sử dụng']?.toString() || '';
          const owners = ownersStr ? ownersStr.split(/[,;]/).map((s: string) => s.trim()).filter(Boolean) : [];

          const plots: any[] = [];
          if (row['Tờ bản đồ cũ'] || row['Thửa đất cũ'] || row['Tờ bản đồ mới'] || row['Thửa đất mới'] || row['Diện tích cũ'] || row['Diện tích mới']) {
            plots.push({
              oldMapSheetNumber: row['Tờ bản đồ cũ']?.toString() || '',
              oldPlotNumber: row['Thửa đất cũ']?.toString() || '',
              newMapSheetNumber: row['Tờ bản đồ mới']?.toString() || '',
              newPlotNumber: row['Thửa đất mới']?.toString() || '',
              oldArea: parseFloat(row['Diện tích cũ']) || 0,
              newArea: parseFloat(row['Diện tích mới']) || 0,
            });
          }

          const blockingDocuments: any[] = [];
          if (row['Số văn bản ngăn chặn'] || row['Nội dung ngăn chặn'] || row['Cơ quan ngăn chặn'] || row['Ngày văn bản ngăn chặn']) {
            blockingDocuments.push({
              docNumber: row['Số văn bản ngăn chặn']?.toString() || '',
              date: parseExcelDate(row['Ngày văn bản ngăn chặn']),
              agency: row['Cơ quan ngăn chặn']?.toString() || '',
              note: row['Nội dung ngăn chặn']?.toString() || '',
            });
          }

          const isUnblockedStr = row['Đã giải ngăn chặn']?.toString()?.toLowerCase() || '';
          const isUnblocked = isUnblockedStr.includes('có') || isUnblockedStr.includes('yes') || isUnblockedStr.includes('đã giải') || isUnblockedStr.includes('rồi');

          newRecords.push({
            owners,
            issueNumber: row['Số phát hành GCN']?.toString() || '',
            certNumber: row['Số vào sổ GCN']?.toString() || '',
            issueDate: parseExcelDate(row['Ngày cấp GCN']),
            plots,
            hamlet: row['Khu phố - Ấp']?.toString() || '',
            oldCommune: row['Phường - Xã cũ']?.toString() || '',
            newCommune: row['Phường - Xã mới']?.toString() || '',
            blockingDocuments,
            unblockDoc: row['Văn bản giải ngăn chặn']?.toString() || '',
            unblockDate: parseExcelDate(row['Ngày văn bản giải ngăn chặn']) || parseExcelDate(row['Ngày giải ngăn chặn']) || '',
            unblockContent: row['Nội dung giải ngăn chặn']?.toString() || '',
            notes: row['Ghi chú']?.toString() || '',
            isUnblocked,
            createdBy: row['Người tạo']?.toString() || currentUser?.name || currentUser?.username || 'Hệ thống',
          });
        }

        if (newRecords.length === 0) {
          alert('Không đọc được dữ liệu hợp lệ nào từ file!');
          return;
        }

        setImportProgress({ active: true, current: 0, total: newRecords.length, status: 'Chuẩn bị dữ liệu...' });

        const CHUNK_SIZE = 500;
        let successCount = 0;
        const importedRecords: any[] = [];

        for (let i = 0; i < newRecords.length; i += CHUNK_SIZE) {
          const chunk = newRecords.slice(i, i + CHUNK_SIZE);
          const currentBatch = Math.floor(i / CHUNK_SIZE) + 1;
          const totalBatches = Math.ceil(newRecords.length / CHUNK_SIZE);

          setImportProgress(prev => ({
            ...prev,
            current: i,
            status: `Đang tải lên gói ${currentBatch}/${totalBatches} (dòng ${i + 1} - ${Math.min(i + CHUNK_SIZE, newRecords.length)})...`
          }));

          if (isConfigured) {
            const { data, error } = await supabase.from('archive_blocking_records').insert(chunk).select();
            if (error) throw error;
            const recordsWithIds = data || chunk;
            importedRecords.push(...recordsWithIds);
            setRecords(prev => [...recordsWithIds, ...prev]);
            successCount += chunk.length;
          } else {
            const withIds = chunk.map((r, index) => ({
              ...r,
              id: 'temp_import_' + Date.now() + '_' + (i + index)
            }));
            importedRecords.push(...withIds);
            setRecords(prev => [...withIds, ...prev]);
            successCount += chunk.length;
          }

          // Tránh chặn UI thread và tạo hiệu ứng mượt
          await new Promise(resolve => setTimeout(resolve, 50));
        }

        setImportProgress({ active: false, current: newRecords.length, total: newRecords.length, status: '' });
        alert(`Đã nhập thành công ${successCount} hồ sơ ngăn chặn lưu trữ!`);
        
        const allNewRecords = [...importedRecords, ...records];
        await offlineDb.saveRecords('archive_blocking_records', allNewRecords);
        localStorage.removeItem('last_blocking_records_sync_time');
      } catch (error) {
        console.error('Lỗi khi import Excel:', error);
        alert('Có lỗi xảy ra khi nhập file Excel. Hãy kiểm tra lại định dạng file.');
      } finally {
        e.target.value = ''; // Reset input
      }
    };
    reader.readAsBinaryString(file);
  };

  useEffect(() => {
    fetchBlockingRecords(appliedFilters);
  }, [appliedFilters]);

  const handleExportTemplate = () => {
    const templateData = [
      {
        'Chủ sử dụng': 'Nguyễn Văn A, Trần Thị B',
        'Số phát hành GCN': 'CQ 123456',
        'Số vào sổ GCN': 'CH 09876',
        'Ngày cấp GCN': '2023-10-20',
        'Tờ bản đồ cũ': '10',
        'Thửa đất cũ': '250',
        'Diện tích cũ': '120.5',
        'Tờ bản đồ mới': '12',
        'Thửa đất mới': '88',
        'Diện tích mới': '120.5',
        'Khu phố - Ấp': 'Khu phố 1',
        'Phường - Xã cũ': 'Xã Tiến Hưng',
        'Phường - Xã mới': 'Phường Tiến Hưng',
        'Số văn bản ngăn chặn': '123/QĐ-TA',
        'Ngày văn bản ngăn chặn': '2023-10-25',
        'Cơ quan ngăn chặn': 'Tòa án nhân dân tỉnh Bình Phước',
        'Nội dung ngăn chặn': 'Ngăn chặn giao dịch để phục vụ giải quyết tranh chấp hợp đồng đặt cọc',
        'Đã giải ngăn chặn': 'Không',
        'Văn bản giải ngăn chặn': '',
        'Ngày giải ngăn chặn': '',
        'Ngày văn bản giải ngăn chặn': '',
        'Nội dung giải ngăn chặn': '',
        'Người tạo': 'Hệ thống',
        'Ghi chú': 'Hồ sơ lưu trữ mẫu minh họa'
      }
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    const cols = Object.keys(templateData[0]).map(key => ({
      wch: Math.max(key.length * 1.5, 15)
    }));
    ws['!cols'] = cols;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Mau_Nhap");
    XLSX.writeFile(wb, "Mau_Nhap_Ho_So_Ngan_Chan_Luu_Tru.xlsx");
  };

  const fetchBlockingRecords = async (filters = appliedFilters) => {
    setLoading(true);
    try {
      const hasFilter = Object.values(filters).some(v => v !== '');
      
      if (!hasFilter) {
        setRecords([]);
        setLoading(false);
        return;
      }
      
      let allRecords: LandRecord[] = [];

      if (isConfigured) {
        const buildQuery = () => {
          let q = supabase.from('archive_blocking_records').select('*');
          if (filters.issueNumber) {
            q = q.ilike('issueNumber', `%${filters.issueNumber}%`);
          }
          if (filters.certNumber) {
            q = q.ilike('certNumber', `%${filters.certNumber}%`);
          }
          if (filters.oldCommune) {
            q = q.ilike('oldCommune', `%${filters.oldCommune}%`);
          }
          if (filters.newCommune) {
            q = q.ilike('newCommune', `%${filters.newCommune}%`);
          }
          if (filters.unblockDoc) {
            q = q.ilike('unblockDoc', `%${filters.unblockDoc}%`);
          }
          return q;
        };

        let from = 0;
        let limit = 1000;
        let hasMore = true;
        const maxRows = 10000;
        
        while (hasMore && from < maxRows) {
          const { data, error } = await buildQuery()
            .range(from, from + limit - 1)
            .order('created_at', { ascending: false });
          
          if (error) throw error;
          if (data && data.length > 0) {
            allRecords = [...allRecords, ...(data as LandRecord[])];
            if (data.length < limit) {
              hasMore = false;
            } else {
              from += limit;
            }
          } else {
            hasMore = false;
          }
        }
      }

      // Nếu không có mạng hoặc truy vấn server rỗng, lấy từ offlineDb
      if (allRecords.length === 0) {
        const cached = await offlineDb.getRecords('archive_blocking_records');
        if (cached && cached.length > 0) {
          allRecords = cached as LandRecord[];
        }
      }
      
      setRecords(allRecords);
      // Lưu toàn bộ dữ liệu tải được vào IndexedDB
      if (allRecords.length > 0) {
        await offlineDb.saveRecords('archive_blocking_records', allRecords);
      }
    } catch (error) {
      console.error('Lỗi khi tải danh sách ngăn chặn lưu trữ:', error);
      // Fallback offlineDb khi có lỗi mạng
      try {
        const cached = await offlineDb.getRecords('archive_blocking_records');
        if (cached && cached.length > 0) {
          setRecords(cached as LandRecord[]);
        }
      } catch (e) {
        console.error('Lỗi đọc offline cache:', e);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (formData: any) => {
    try {
      let updatedRecs = [...records];
      if (formData.id) {
        if (isConfigured) {
          const { error } = await supabase.from('archive_blocking_records').update(formData).eq('id', formData.id);
          if (error) throw error;
        }
        updatedRecs = records.map(p => p.id === formData.id ? formData : p);
        setRecords(updatedRecs);
        alert('Cập nhật thành công!');
      } else {
        if (isConfigured) {
          const { data, error } = await supabase.from('archive_blocking_records').insert([formData]).select();
          if (error) throw error;
          const inserted = data && data[0] ? data[0] : formData;
          updatedRecs = [inserted, ...records];
          setRecords(updatedRecs);
        } else {
          formData.id = 'temp_' + Date.now();
          updatedRecs = [formData, ...records];
          setRecords(updatedRecs);
        }
        alert('Thêm mới thành công!');
      }
      await offlineDb.saveRecords('archive_blocking_records', updatedRecs);
      localStorage.removeItem('last_blocking_records_sync_time');
      setShowForm(false);
      setEditingRecord(undefined);
    } catch (error) {
      console.error('Lỗi khi lưu:', error);
      alert('Đã có lỗi xảy ra. Hãy thử lại.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa hồ sơ ngăn chặn này?')) return;
    try {
      if (isConfigured) {
         const { error } = await supabase.from('archive_blocking_records').delete().eq('id', id);
         if (error) throw error;
      }
      const newRecs = records.filter(r => r.id !== id);
      setRecords(newRecs);
      if (!isConfigured) await offlineDb.saveRecords('archive_blocking_records', newRecs);
      localStorage.removeItem('last_blocking_records_sync_time');
      alert('Xóa thành công!');
    } catch (error) {
      console.error('Lỗi khi xóa:', error);
      alert('Đã có lỗi xảy ra khi xóa.');
    }
  };

  const handleDeleteAll = async () => {
    if (currentUser.role !== 'ADMIN') {
      alert('Chỉ quản trị viên mới có quyền thực hiện chức năng này!');
      return;
    }
    const confirm1 = window.confirm('CẢNH BÁO: Bạn có chắc chắn muốn xóa TOÀN BỘ hồ sơ ngăn chặn lưu trữ? Tất cả dữ liệu sẽ bị xóa vĩnh viễn và không thể khôi phục!');
    if (!confirm1) return;

    const confirm2 = window.prompt('Nhập chữ "DELETE" (viết hoa, không dấu nháy) để xác nhận việc xóa toàn bộ dữ liệu ngăn chặn lưu trữ:');
    if (confirm2 !== 'DELETE') {
      alert('Xác nhận không khớp. Hủy thao tác xóa!');
      return;
    }

    setLoading(true);
    try {
      if (isConfigured) {
        const { error } = await supabase.from('archive_blocking_records').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        if (error) throw error;
      }
      setRecords([]);
      await offlineDb.saveRecords('archive_blocking_records', []);
      localStorage.removeItem('last_blocking_records_sync_time');
      alert('Đã xóa toàn bộ dữ liệu ngăn chặn lưu trữ thành công!');
    } catch (error) {
      console.error('Lỗi khi xóa toàn bộ dữ liệu:', error);
      alert('Đã xảy ra lỗi khi xóa toàn bộ dữ liệu.');
    } finally {
      setLoading(false);
    }
  };

  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      // 1. Kiểm tra số phát hành GCN
      const matchIssueNum = !appliedFilters.issueNumber || normalizeSearchText(r.issueNumber).includes(normalizeSearchText(appliedFilters.issueNumber));
      
      // 2. Kiểm tra số vào sổ GCN
      const matchCertNum = !appliedFilters.certNumber || normalizeSearchText(r.certNumber).includes(normalizeSearchText(appliedFilters.certNumber));
      
      // 3. Kiểm tra xã cũ / xã mới
      const matchOldCommune = !appliedFilters.oldCommune || normalizeSearchText(r.oldCommune).includes(normalizeSearchText(appliedFilters.oldCommune));
      const matchNewCommune = !appliedFilters.newCommune || normalizeSearchText(r.newCommune).includes(normalizeSearchText(appliedFilters.newCommune));
      
      // 4. Kiểm tra tên chủ sử dụng (hỗ trợ nhiều chủ, có dấu / không dấu, tìm một phần)
      const matchOwner = checkOwnerMatch(r.owners, appliedFilters.owner);
      
      // 5. Kiểm tra VB giải ngăn chặn
      const matchUnblockDoc = !appliedFilters.unblockDoc || normalizeSearchText(r.unblockDoc).includes(normalizeSearchText(appliedFilters.unblockDoc));
      
      // 6. Kiểm tra thông tin thửa đất (tờ/thửa cũ & mới)
      const plotMatch = checkPlotMatch(r.plots || [], {
        oldPlotNumber: appliedFilters.oldPlotNumber,
        oldMapSheetNumber: appliedFilters.oldMapSheetNumber,
        newPlotNumber: appliedFilters.newPlotNumber,
        newMapSheetNumber: appliedFilters.newMapSheetNumber,
      });

      // 7. Kiểm tra văn bản ngăn chặn
      const docMatch = checkDocMatch(r.blockingDocuments || [], appliedFilters.docNumber);

      return matchIssueNum && matchCertNum && matchOldCommune && matchNewCommune && matchOwner && matchUnblockDoc && plotMatch && docMatch;
    });
  }, [records, appliedFilters]);

  const totalPages = Math.ceil(filteredRecords.length / itemsPerPage);
  const paginatedRecords = filteredRecords.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleSearchSubmit = () => {
    setAppliedFilters({ ...searchFilters });
  };

  const handleClearSearch = () => {
    const emptyFilters = {
      issueNumber: '',
      certNumber: '',
      oldMapSheetNumber: '',
      oldPlotNumber: '',
      newMapSheetNumber: '',
      newPlotNumber: '',
      oldCommune: '',
      newCommune: '',
      docNumber: '',
      owner: '',
      unblockDoc: ''
    };
    setSearchFilters(emptyFilters);
    setAppliedFilters(emptyFilters);
  };

  return (
    <div className="h-full flex flex-col bg-gray-50 rounded-lg p-2 md:p-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <div className="flex items-center gap-3">
            <div className="bg-red-100 p-2.5 rounded-lg text-red-600">
                <ShieldAlert size={28} />
            </div>
            <div>
                 <h2 className="text-xl font-bold text-gray-800 tracking-tight flex items-center gap-2">
                    Quản lý ngăn chặn (Lưu trữ)
                    {loading && records.length > 0 && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-normal bg-blue-50 text-blue-600 px-2 py-0.5 rounded border border-blue-100 animate-pulse">
                        <Loader2 size={12} className="animate-spin" /> Đang cập nhật...
                      </span>
                    )}
                  </h2>
                 <p className="text-sm text-gray-500 font-medium">Tìm kiếm nâng cao và lưu trữ hồ sơ ngăn chặn, tranh chấp.</p>
            </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
          <button
            onClick={handleExportTemplate}
            className="flex items-center justify-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors shadow-sm font-medium whitespace-nowrap text-sm"
            title="Tải tệp Excel cấu trúc mẫu"
          >
            <Download size={18} /> Mẫu nhập Excel
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center justify-center gap-2 bg-teal-600 text-white px-4 py-2 rounded-lg hover:bg-teal-700 transition-colors shadow-sm font-medium whitespace-nowrap text-sm"
            title="Nhập dữ liệu từ tệp Excel"
          >
            <Upload size={18} /> Nhập Excel
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImportExcel}
            accept=".xlsx, .xls"
            className="hidden"
          />
          {currentUser.role === 'ADMIN' && (
            <button
              onClick={handleDeleteAll}
              className="flex items-center justify-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors shadow-sm font-medium whitespace-nowrap text-sm"
              title="Xóa tất cả dữ liệu ngăn chặn lưu trữ"
            >
              <Trash2 size={18} /> Xóa tất cả
            </button>
          )}
          <button
            onClick={() => {
              setEditingRecord(undefined);
              setShowForm(true);
            }}
            className="flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors shadow-sm font-medium whitespace-nowrap text-sm"
          >
            <Plus size={18} /> Thêm mới
          </button>
        </div>
      </div>

      {/* Bộ lọc Tìm kiếm Nâng cao Cố định */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-4 overflow-hidden animate-in fade-in duration-200">
         <div className="bg-gray-50/70 px-4 py-3 border-b border-gray-150 flex justify-between items-center">
             <h3 className="font-bold text-gray-800 text-xs flex items-center gap-1.5 uppercase tracking-wider">
               <Search size={14} className="text-blue-600" />
               Bộ lọc Tìm kiếm Nâng cao (Lưu trữ)
             </h3>
         </div>
         <div className="p-4 space-y-4 text-sm">
             <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                 
                 {/* PHẦN 1: THÔNG TIN GCN */}
                 <div className="bg-gray-50/50 p-3.5 rounded-lg border border-gray-100 space-y-3">
                     <h4 className="font-bold text-xs text-[#003b5c] uppercase tracking-wider border-b border-gray-200/60 pb-1.5 mb-2">
                       1. Thông tin GCN
                     </h4>
                     <div className="space-y-2.5">
                         <div>
                           <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1">Chủ sử dụng</label>
                           <input 
                             type="text" 
                             placeholder="Nhập họ tên chủ sử dụng..." 
                             value={searchFilters.owner} 
                             onChange={e => setSearchFilters({...searchFilters, owner: e.target.value})} 
                             className="w-full text-xs border border-gray-200 rounded p-2 focus:ring-1 focus:ring-blue-500 outline-none h-[38px]" 
                           />
                         </div>
                         <div>
                           <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1">Số phát hành GCN</label>
                           <input 
                             type="text" 
                             placeholder="Nhập số phát hành..." 
                             value={searchFilters.issueNumber} 
                             onChange={e => setSearchFilters({...searchFilters, issueNumber: e.target.value})} 
                             className="w-full text-xs border border-gray-200 rounded p-2 focus:ring-1 focus:ring-blue-500 outline-none h-[38px]" 
                           />
                         </div>
                         <div>
                           <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1">Số vào sổ GCN</label>
                           <input 
                             type="text" 
                             placeholder="Nhập số vào sổ..." 
                             value={searchFilters.certNumber} 
                             onChange={e => setSearchFilters({...searchFilters, certNumber: e.target.value})} 
                             className="w-full text-xs border border-gray-200 rounded p-2 focus:ring-1 focus:ring-blue-500 outline-none h-[38px]" 
                           />
                         </div>
                     </div>
                 </div>

                 {/* PHẦN 2: THÔNG TIN THỬA ĐẤT */}
                 <div className="bg-gray-50/50 p-3.5 rounded-lg border border-gray-100 space-y-3">
                     <h4 className="font-bold text-xs text-[#003b5c] uppercase tracking-wider border-b border-gray-200/60 pb-1.5 mb-2">
                       2. Thông tin thửa đất
                     </h4>
                     <div className="grid grid-cols-2 gap-2">
                         <div>
                           <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1">Tờ bản đồ (cũ)</label>
                           <input 
                             type="text" 
                             placeholder="Số tờ cũ" 
                             value={searchFilters.oldMapSheetNumber} 
                             onChange={e => setSearchFilters({...searchFilters, oldMapSheetNumber: e.target.value})} 
                             className="w-full text-xs border border-gray-200 rounded p-2 focus:ring-1 focus:ring-blue-500 outline-none h-[38px]" 
                           />
                         </div>
                         <div>
                           <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1">Thửa đất (cũ)</label>
                           <input 
                             type="text" 
                             placeholder="Số thửa cũ" 
                             value={searchFilters.oldPlotNumber} 
                             onChange={e => setSearchFilters({...searchFilters, oldPlotNumber: e.target.value})} 
                             className="w-full text-xs border border-gray-200 rounded p-2 focus:ring-1 focus:ring-blue-500 outline-none h-[38px]" 
                           />
                         </div>
                         <div>
                           <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1">Tờ bản đồ (mới)</label>
                           <input 
                             type="text" 
                             placeholder="Số tờ mới" 
                             value={searchFilters.newMapSheetNumber} 
                             onChange={e => setSearchFilters({...searchFilters, newMapSheetNumber: e.target.value})} 
                             className="w-full text-xs border border-gray-200 rounded p-2 focus:ring-1 focus:ring-blue-500 outline-none h-[38px]" 
                           />
                         </div>
                         <div>
                           <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1">Thửa đất (mới)</label>
                           <input 
                             type="text" 
                             placeholder="Số thửa mới" 
                             value={searchFilters.newPlotNumber} 
                             onChange={e => setSearchFilters({...searchFilters, newPlotNumber: e.target.value})} 
                             className="w-full text-xs border border-gray-200 rounded p-2 focus:ring-1 focus:ring-blue-500 outline-none h-[38px]" 
                           />
                         </div>
                     </div>
                     <div className="grid grid-cols-2 gap-2 mt-2">
                         <div>
                           <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1">Phường/Xã (cũ)</label>
                           <select 
                             value={searchFilters.oldCommune} 
                             onChange={e => setSearchFilters({...searchFilters, oldCommune: e.target.value})}
                             className="w-full text-xs border border-gray-200 rounded p-2 focus:ring-1 focus:ring-blue-500 outline-none h-[38px] bg-white font-medium"
                           >
                             <option value="">-- Tất cả --</option>
                             {oldCommunes.map((commune, idx) => (
                               <option key={idx} value={commune}>{commune}</option>
                             ))}
                           </select>
                         </div>
                         <div>
                           <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1">Phường/Xã (mới)</label>
                           <select 
                             value={searchFilters.newCommune} 
                             onChange={e => setSearchFilters({...searchFilters, newCommune: e.target.value})}
                             className="w-full text-xs border border-gray-200 rounded p-2 focus:ring-1 focus:ring-blue-500 outline-none h-[38px] bg-white font-medium"
                           >
                             <option value="">-- Tất cả --</option>
                             {newCommunes.map((commune, idx) => (
                               <option key={idx} value={commune}>{commune}</option>
                             ))}
                           </select>
                         </div>
                     </div>
                 </div>

                 {/* PHẦN 3: THÔNG TIN NGĂN CHẶN */}
                 <div className="bg-gray-50/50 p-3.5 rounded-lg border border-gray-100 space-y-3">
                     <h4 className="font-bold text-xs text-[#003b5c] uppercase tracking-wider border-b border-gray-200/60 pb-1.5 mb-2">
                       3. Thông tin ngăn chặn
                     </h4>
                     <div className="space-y-2.5">
                         <div>
                           <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1">Số VB ngăn chặn</label>
                           <input 
                             type="text" 
                             placeholder="Nhập số văn bản ngăn chặn..." 
                             value={searchFilters.docNumber} 
                             onChange={e => setSearchFilters({...searchFilters, docNumber: e.target.value})} 
                             className="w-full text-xs border border-gray-200 rounded p-2 focus:ring-1 focus:ring-blue-500 outline-none h-[38px]" 
                           />
                         </div>
                         <div>
                           <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1">Số VB giải ngăn chặn</label>
                           <input 
                             type="text" 
                             placeholder="Nhập số văn bản giải tỏa..." 
                             value={searchFilters.unblockDoc} 
                             onChange={e => setSearchFilters({...searchFilters, unblockDoc: e.target.value})} 
                             className="w-full text-xs border border-gray-200 rounded p-2 focus:ring-1 focus:ring-blue-500 outline-none h-[38px]" 
                           />
                         </div>
                     </div>
                 </div>

             </div>

             {/* NÚT TÌM KIẾM VÀ XÓA BỘ LỌC */}
             <div className="flex gap-2 pt-2 border-t border-gray-150 justify-end">
                  <button
                    onClick={handleSearchSubmit}
                    className="flex-1 max-w-[200px] flex items-center justify-center gap-1.5 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors shadow-sm font-bold text-xs h-[38px]"
                    title="Tìm kiếm hồ sơ theo bộ lọc đã chọn"
                  >
                    <Search size={14} /> Tìm kiếm
                  </button>
                  <button
                    onClick={handleClearSearch}
                    className="flex-1 max-w-[150px] flex items-center justify-center gap-1.5 bg-gray-100 text-gray-600 px-3 py-2 rounded hover:bg-gray-200 transition-colors shadow-sm font-bold text-xs h-[38px]"
                    title="Xóa toàn bộ bộ lọc và nhập lại"
                  >
                    Xóa bộ lọc
                  </button>
             </div>
         </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col min-h-0 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading && records.length === 0 ? (
           <div className="flex flex-col justify-center items-center flex-1 py-12">
             <div className="relative w-16 h-16 flex items-center justify-center mb-3">
               <img src="./logo.png" alt="Logo" className="w-10 h-10 object-contain animate-pulse" />
               <Loader2 size={60} className="animate-spin text-blue-600 absolute inset-0" />
             </div>
             <p className="text-sm text-gray-500 font-medium">Đang tải dữ liệu hồ sơ ngăn chặn...</p>
           </div>
        ) : filteredRecords.length === 0 ? (
           <div className="flex flex-col justify-center items-center flex-1 text-gray-500 py-12">
              <ShieldAlert size={48} className="text-gray-300 mb-4" />
              <p className="text-lg font-medium text-gray-600">Không có hồ sơ ngăn chặn nào</p>
              <p className="text-sm mt-1 text-gray-400">Hoặc không tìm thấy kết quả phù hợp.</p>
           </div>
        ) : (
          <>
            <div className="flex-1 overflow-auto">
              <table className="w-full text-sm text-left text-gray-700 border-collapse">
                <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b-2 border-blue-800 sticky top-0 z-10 shadow-sm">
                  <tr>
                    <th scope="col" className="px-2 py-3 text-center border bg-gray-50 font-bold whitespace-nowrap">STT</th>
                    <th scope="col" className="px-4 py-3 border bg-gray-50 font-bold min-w-[200px]">
                      CHỦ SỬ DỤNG & GCN<br/>
                      <span className="text-[10px] text-gray-500 font-normal normal-case pt-1 block">sắp xếp: ngày cấp ↓</span>
                    </th>
                    <th scope="col" className="px-4 py-3 border bg-gray-50 font-bold min-w-[250px]">
                      ĐẶC ĐIỂM & VỊ TRÍ<br/>
                      <span className="text-[10px] text-gray-400 font-normal normal-case flex items-center gap-3 mt-1">
                        <span>tờ cũ ↓</span><span>tờ mới ↓</span><span>thửa cũ ↓</span><span>thửa mới ↓</span>
                      </span>
                    </th>
                    <th scope="col" className="px-4 py-3 border bg-gray-50 font-bold min-w-[300px]">NỘI DUNG NGĂN CHẶN</th>
                    <th scope="col" className="px-4 py-3 border bg-gray-50 font-bold text-center">TRẠNG THÁI</th>
                    <th scope="col" className="px-4 py-3 border bg-gray-50 font-bold text-center">
                      <div className="flex items-center justify-center gap-1"><UserIcon size={14}/> NGƯỜI NHẬP</div>
                    </th>
                    <th scope="col" className="px-4 py-3 border bg-gray-50 font-bold text-center">
                      <div className="flex items-center justify-center gap-1"><Calendar size={14}/> NGÀY NHẬP</div>
                    </th>
                    <th scope="col" className="px-4 py-3 border bg-gray-50 font-bold text-center">TÁC VỤ</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedRecords.map((record, index) => (
                    <tr key={record.id} className="bg-white border-b hover:bg-gray-50/50 transition-colors">
                      <td className="px-2 py-4 text-center border font-semibold text-[#003b5c]">{(currentPage - 1) * itemsPerPage + index + 1}</td>
                      
                      <td className="px-4 py-4 border align-top">
                        <div className="font-bold text-[#003b5c] uppercase text-sm mb-2">
                          {record.owners?.join(', ')}
                        </div>
                        <div className="text-[13px] text-gray-600 space-y-1">
                          <div>Số PH: <span className="font-medium text-gray-800">{record.issueNumber}</span></div>
                          <div>Số vào sổ: <span className="font-medium text-gray-800">{record.certNumber}</span></div>
                          <div>Ngày cấp: <span className="font-medium text-gray-800">{record.issueDate ? new Date(record.issueDate).toLocaleDateString('vi-VN') : ''}</span></div>
                        </div>
                      </td>
  
                      <td className="px-4 py-4 border align-top">
                        <div className="space-y-4">
                          {record.plots?.map((plot, pIdx) => (
                            <div key={pIdx} className="space-y-2">
                              <div className="grid grid-cols-2 gap-2 text-center text-xs">
                                <div className="border border-gray-200 rounded-sm bg-gray-50/50 pb-1 w-20 mx-auto">
                                  <div className="text-gray-500 mb-0.5 border-b border-gray-200 py-1 text-[10px] uppercase">Tờ Cũ</div>
                                  <div className="font-bold text-gray-800 text-sm">{plot.oldMapSheetNumber || '-'}</div>
                                </div>
                                <div className="border border-gray-200 rounded-sm bg-gray-50/50 pb-1 w-20 mx-auto">
                                  <div className="text-gray-500 mb-0.5 border-b border-gray-200 py-1 text-[10px] uppercase">Tờ Mới</div>
                                  <div className="font-bold text-gray-800 text-sm">{plot.newMapSheetNumber || '-'}</div>
                                </div>
                                <div className="border border-gray-200 rounded-sm bg-gray-50/50 pb-1 w-20 mx-auto">
                                  <div className="text-gray-500 mb-0.5 border-b border-gray-200 py-1 text-[10px] uppercase">Thửa Cũ</div>
                                  <div className="font-bold text-gray-800 text-sm">{plot.oldPlotNumber || '-'}</div>
                                </div>
                                <div className="border border-gray-200 rounded-sm bg-gray-50/50 pb-1 w-20 mx-auto">
                                  <div className="text-gray-500 mb-0.5 border-b border-gray-200 py-1 text-[10px] uppercase">Thửa Mới</div>
                                  <div className="font-bold text-gray-800 text-sm">{plot.newPlotNumber || '-'}</div>
                                </div>
                              </div>
                              <div className="flex justify-between text-xs text-gray-600 px-2 mt-1">
                                <div>DT cũ: <span className="font-bold text-gray-800">{plot.oldArea || 0} m²</span></div>
                                <div>DT mới: <span className="font-bold text-gray-800">{plot.newArea || 0} m²</span></div>
                              </div>
                            </div>
                          ))}
                          
                          <div className="text-xs pt-2 border-t border-dotted border-gray-300">
                            <div className="flex items-center gap-1 text-red-600 font-medium mb-1.5"><MapPin size={12}/> {record.hamlet}</div>
                            <div className="border border-gray-200 rounded-sm overflow-hidden text-[11px]">
                              <div className="flex justify-between items-center bg-gray-50 px-2 py-1.5 border-b border-gray-200 text-gray-600">
                                <span>cũ</span>
                                <span className="text-gray-500 text-right w-full ml-4" style={{borderBottom: '1px solid #e5e7eb'}}>&nbsp;</span>
                                <span className="italic whitespace-nowrap pl-2">{record.oldCommune}</span>
                              </div>
                              <div className="flex justify-between items-center bg-blue-50 px-2 py-1.5 text-blue-700 font-medium relative">
                                <span>MỚI</span>
                                <span className="italic whitespace-nowrap pl-2 text-right w-full">{record.newCommune}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </td>
  
                      <td className="px-4 py-4 border align-top">
                        <div className="space-y-3">
                          {record.blockingDocuments?.map((doc, dIdx) => (
                            <div key={dIdx} className="bg-red-50 border border-red-100 p-2.5 rounded-sm text-xs">
                              <div className="font-bold text-red-700 mb-1.5 uppercase flex items-center gap-1 border-b border-red-100 pb-1">
                                <FileText size={14} className="shrink-0"/> VĂN BẢN NGĂN CHẶN: {doc.docNumber}
                              </div>
                              <div className="text-gray-700 flex flex-wrap items-center gap-x-3 gap-y-1 mb-1">
                                <span className="flex items-center gap-1"><Calendar size={12} className="text-gray-400"/> {doc.date ? new Date(doc.date).toLocaleDateString('vi-VN') : ''}</span>
                                <span className="flex items-center gap-1"><UserIcon size={12} className="text-gray-400"/> {doc.agency}</span>
                              </div>
                              <div className="italic text-red-600 flex items-start gap-1">
                                <ShieldAlert size={12} className="mt-0.5 shrink-0"/> {doc.note}
                              </div>
                            </div>
                          ))}
                          
                          {record.notes && (
                            <div className="bg-yellow-50/80 p-2 mt-2 border border-yellow-200/60 text-xs italic text-blue-800">
                              Lưu ý: {record.notes}
                            </div>
                          )}
  
                          {(record.attached_files && record.attached_files.length > 0) && (
                            <div className="text-xs mt-3 pt-2 border-t border-dashed border-gray-200">
                              <div className="text-gray-500 mb-1.5 flex items-center gap-1"><Paperclip size={12}/> Tài liệu đính kèm:</div>
                              <div className="flex flex-col gap-1.5">
                                {record.attached_files.map((file, idx) => (
                                  <a key={idx} href={file.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 w-fit bg-white text-blue-600 px-2.5 py-1.5 rounded-sm border border-blue-100 hover:bg-blue-50 transition-colors shadow-sm" title={file.name}>
                                    <div className="p-1 rounded bg-blue-100 shrink-0"><Paperclip size={10} className="text-blue-600"/></div> 
                                    <span className="truncate max-w-[180px] font-medium">{file.name}</span>
                                  </a>
                                ))}
                              </div>
                            </div>
                          )}
  
                          {record.isUnblocked && (
                            <div className="mt-4 border-t pt-4 border-dashed border-gray-300">
                              <div className="bg-green-50 p-2.5 rounded-sm border border-green-200 text-xs">
                                <div className="font-bold text-green-700 mb-1 uppercase flex items-center gap-1">
                                  <CheckCircle size={14} className="shrink-0"/> VĂN BẢN GIẢI NGĂN CHẶN
                                </div>
                                <div className="text-gray-800 pl-5 space-y-1">
                                  <div><span className="font-semibold text-gray-600">Số văn bản:</span> {record.unblockDoc}</div>
                                  {record.unblockDate && (
                                    <div><span className="font-semibold text-gray-600">Ngày văn bản:</span> {record.unblockDate.includes('-') ? record.unblockDate.split('-').reverse().join('/') : record.unblockDate}</div>
                                  )}
                                  {record.unblockContent && (
                                    <div><span className="font-semibold text-gray-600">Nội dung giải tỏa:</span> {record.unblockContent}</div>
                                  )}
                                </div>
                              </div>
                              {(record.unblock_attached_files && record.unblock_attached_files.length > 0) && (
                                <div className="text-xs mt-2">
                                  <div className="flex flex-col gap-1.5">
                                    {record.unblock_attached_files.map((file, idx) => (
                                      <a key={idx} href={file.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 w-fit bg-white text-green-700 px-2.5 py-1.5 rounded-sm border border-green-100 hover:bg-green-50 transition-colors shadow-sm" title={file.name}>
                                        <div className="p-1 rounded bg-green-100 shrink-0"><Paperclip size={10} className="text-green-700"/></div> 
                                        <span className="truncate max-w-[180px] font-medium">{file.name}</span>
                                      </a>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
  
                      <td className="px-4 py-4 text-center border align-middle">
                        <div className="flex justify-center">
                          <div className={`inline-flex flex-col items-center justify-center py-2 px-3 rounded text-center border font-bold text-xs shadow-sm ${record.isUnblocked ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-600 border-red-200'}`}>
                            <div className="uppercase tracking-wide">{record.isUnblocked ? 'ĐÃ GIẢI NGĂN CHẶN' : 'NGĂN CHẶN'}</div>
                          </div>
                        </div>
                      </td>
  
                      <td className="px-2 py-4 text-center border align-middle text-xs text-gray-800 whitespace-nowrap">
                         {record.createdBy}
                      </td>
  
                      <td className="px-2 py-4 border align-middle text-xs text-gray-600 whitespace-nowrap text-center">
                         {record.created_at ? (
                           <div className="flex items-center justify-center gap-1">
                             <span>{new Date(record.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</span>
                             <span>{new Date(record.created_at).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric'})}</span>
                           </div>
                         ) : ''}
                      </td>
  
                      <td className="px-2 py-4 text-center border align-middle">
                        <div className="flex items-center justify-center gap-2">
                          <button 
                            onClick={() => { setEditingRecord(record); setShowForm(true); }} 
                            className="text-blue-500 hover:bg-blue-50 p-1.5 border border-transparent hover:border-blue-100 rounded-sm transition-all"
                            title="Sửa"
                          >
                            <Edit size={16} />
                          </button>
                          <button 
                            onClick={() => handleDelete(record.id)} 
                            className="text-gray-400 hover:text-red-500 hover:bg-red-50 p-1.5 border border-transparent hover:border-red-100 rounded-sm transition-all"
                            title="Xóa"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* PHÂN TRANG */}
            {totalPages > 1 && (
              <div className="shrink-0 flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-4 border-t bg-gray-50/50">
                <div className="text-xs text-gray-500 font-semibold uppercase tracking-wider">
                  Hiển thị <span className="font-bold text-[#003b5c]">{paginatedRecords.length}</span> / <span className="font-bold text-gray-700">{filteredRecords.length}</span> hồ sơ
                  {totalPages > 1 && ` (Trang ${currentPage}/${totalPages})`}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                    className="p-1.5 rounded-md border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 disabled:opacity-40 disabled:hover:bg-white transition-all shadow-sm"
                    title="Trang đầu"
                  >
                    <ChevronsLeft size={16} />
                  </button>
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="p-1.5 rounded-md border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 disabled:opacity-40 disabled:hover:bg-white transition-all shadow-sm"
                    title="Trang trước"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  
                  {/* Số trang xung quanh trang hiện tại */}
                  {(() => {
                    let startPage = Math.max(1, currentPage - 2);
                    let endPage = Math.min(totalPages, startPage + 4);
                    if (endPage - startPage < 4) {
                      startPage = Math.max(1, endPage - 4);
                    }
                    const pages = [];
                    for (let p = startPage; p <= endPage; p++) {
                      pages.push(p);
                    }
                    return pages.map(pageNum => (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`px-3 py-1 text-sm font-bold rounded-md transition-all shadow-sm ${
                          currentPage === pageNum
                            ? 'bg-[#003b5c] text-white'
                            : 'border border-gray-200 bg-white hover:bg-gray-50 text-gray-600'
                        }`}
                      >
                        {pageNum}
                      </button>
                    ));
                  })()}
  
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="p-1.5 rounded-md border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 disabled:opacity-40 disabled:hover:bg-white transition-all shadow-sm"
                    title="Trang sau"
                  >
                    <ChevronRight size={16} />
                  </button>
                  <button
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={currentPage === totalPages}
                    className="p-1.5 rounded-md border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 disabled:opacity-40 disabled:hover:bg-white transition-all shadow-sm"
                    title="Trang cuối"
                  >
                    <ChevronsRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {showForm && (
        <RecordForm
          initialData={editingRecord}
          currentUser={currentUser}
          onSubmit={handleSave}
          onCancel={() => setShowForm(false)}
          filePrefix="archive"
        />
      )}

      {/* Progress Modal overlay */}
      {importProgress.active && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[110] p-4 backdrop-blur-sm">
          <div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-md text-center space-y-6 border border-gray-150 animate-fade-in">
            <div className="flex flex-col items-center">
              <Loader2 className="w-12 h-12 animate-spin text-blue-600 mb-2" />
              <h3 className="text-lg font-bold text-gray-800">Đang nhập dữ liệu ngăn chặn lưu trữ...</h3>
            </div>
            
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide leading-relaxed min-h-[2.5rem] flex items-center justify-center bg-gray-50 p-3 rounded-lg border border-gray-100">{importProgress.status}</p>
            
            <div className="space-y-2">
              <div className="w-full bg-gray-150 h-3 rounded-full overflow-hidden shadow-inner">
                <div 
                  className="bg-blue-600 h-full transition-all duration-300" 
                  style={{ width: `${importProgress.total > 0 ? Math.round((importProgress.current / importProgress.total) * 100) : 0}%` }}
                />
              </div>
              <div className="text-xs text-gray-500 font-bold flex justify-between px-1">
                <span>Tiến trình: {importProgress.total > 0 ? Math.round((importProgress.current / importProgress.total) * 100) : 0}%</span>
                <span>{importProgress.current} / {importProgress.total} dòng</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ArchiveBlockingView;
