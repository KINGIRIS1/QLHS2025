import React, { useState, useEffect, useMemo } from 'react';
import { User, LandRecord } from '../types';
import RecordForm from './RecordForm';
import BlockingCheckToolModal from './BlockingCheckToolModal';
import { Search, Plus, User as UserIcon, Calendar, MapPin, Loader2, ShieldAlert, FileText, CheckCircle, Trash2, Edit, Eye, Paperclip, Download, Upload, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import * as XLSX from 'xlsx-js-style';
import { supabase, isConfigured } from '../services/supabaseClient';
import { showToast } from '../utils/appHelpers';
import { offlineDb } from '../utils/offlineDb';

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
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');
};

interface Props {
  currentUser: User;
}

const BlockingRecordsView: React.FC<Props> = ({ currentUser }) => {
  const isReadOnly = currentUser.role !== 'ADMIN' && currentUser.role !== 'SUBADMIN';
  const [records, setRecords] = useState<LandRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCheckToolModal, setShowCheckToolModal] = useState(false);


  
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

  const oldCommunes = useMemo(() => {
    return Array.from(new Set(records.map(r => r.oldCommune).filter(Boolean))).sort();
  }, [records]);

  const newCommunes = useMemo(() => {
    return Array.from(new Set(records.map(r => r.newCommune).filter(Boolean))).sort();
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
          showToast('File Excel rỗng!', 'error');
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
          showToast('Không đọc được dữ liệu hợp lệ nào từ file!', 'error');
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
            const { data, error } = await supabase.from('blocking_records').insert(chunk).select();
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
        showToast(`Đã nhập thành công ${successCount} hồ sơ ngăn chặn!`, 'success');
        
        const allNewRecords = [...importedRecords, ...records];
        await offlineDb.saveRecords('blocking_records', allNewRecords);
        localStorage.removeItem('last_blocking_records_sync_time');
      } catch (error) {
        console.error('Lỗi khi import Excel:', error);
        showToast('Có lỗi xảy ra khi nhập file Excel. Hãy kiểm tra lại định dạng file.', 'error');
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
        'Ghi chú': 'Hồ sơ mẫu minh họa'
      }
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    const cols = Object.keys(templateData[0]).map(key => ({
      wch: Math.max(key.length * 1.5, 15)
    }));
    ws['!cols'] = cols;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Mau_Nhap");
    XLSX.writeFile(wb, "Mau_Nhap_Ho_So_Ngan_Chan.xlsx");
  };

  const fetchBlockingRecords = async (filters = appliedFilters) => {
    if (!isConfigured) return;
    setLoading(true);
    try {
      const hasFilter = Object.values(filters).some(v => v !== '');
      
      if (!hasFilter) {
        setRecords([]);
        setLoading(false);
        return;
      }
      
      const buildQuery = () => {
        let q = supabase.from('blocking_records').select('*');
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
        if (filters.oldPlotNumber) {
          q = q.or(`plots.cs.[{"oldPlotNumber":"${filters.oldPlotNumber}"}]`);
        }
        if (filters.newPlotNumber) {
          q = q.or(`plots.cs.[{"newPlotNumber":"${filters.newPlotNumber}"}]`);
        }
        
        // Bổ sung lọc trực tiếp ở DB
        if (filters.owner) {
          const term = filters.owner.trim();
          const variations = [
            term,
            term.toLowerCase(),
            term.toUpperCase(),
            stripAccents(term),
            stripAccents(term).toLowerCase(),
            stripAccents(term).toUpperCase()
          ];
          const uniqueVariations = Array.from(new Set(variations));
          const orConditions = uniqueVariations.map(v => `owners.cs.["${v}"]`).join(',');
          q = q.or(orConditions);
        }
        if (filters.docNumber) {
          const term = filters.docNumber.trim();
          const variations = [term, term.toUpperCase(), term.toLowerCase()];
          const uniqueVariations = Array.from(new Set(variations));
          const orConditions = uniqueVariations.map(v => `blockingDocuments.cs.[{"docNumber":"${v}"}]`).join(',');
          q = q.or(orConditions);
        }
        if (filters.oldMapSheetNumber) {
          q = q.or(`plots.cs.[{"oldMapSheetNumber":"${filters.oldMapSheetNumber}"}]`);
        }
        if (filters.newMapSheetNumber) {
          q = q.or(`plots.cs.[{"newMapSheetNumber":"${filters.newMapSheetNumber}"}]`);
        }
        return q;
      };

      let allRecords: LandRecord[] = [];
      let from = 0;
      let limit = 1000;
      let hasMore = true;
      // Tránh việc tải 30k+ bản ghi cùng lúc nếu không lọc để tối ưu hiệu năng và tránh bị giới hạn 10k
      const maxRows = hasFilter ? 10000 : 3000; 
      
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
      
      setRecords(allRecords);
      // Lưu toàn bộ dữ liệu tải được vào IndexedDB
      await offlineDb.saveRecords('blocking_records', allRecords);
    } catch (error) {
      console.error('Lỗi khi tải danh sách ngăn chặn:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (formData: any) => {
    try {
      let updated: LandRecord[] = [];
      if (formData.id) {
        if (isConfigured) {
          const { error } = await supabase.from('blocking_records').update(formData).eq('id', formData.id);
          if (error) throw error;
        }
        updated = records.map(p => p.id === formData.id ? formData : p);
        setRecords(updated);
        showToast('Cập nhật thành công!', 'success');
      } else {
        if (isConfigured) {
          const { data, error } = await supabase.from('blocking_records').insert([formData]).select();
          if (error) throw error;
          const inserted = data && data[0] ? data[0] : formData;
          updated = [inserted, ...records];
          setRecords(updated);
        } else {
          formData.id = 'temp_' + Date.now();
          updated = [formData, ...records];
          setRecords(updated);
        }
        showToast('Thêm mới thành công!', 'success');
      }
      await offlineDb.saveRecords('blocking_records', updated);
      localStorage.removeItem('last_blocking_records_sync_time');
      setShowForm(false);
      setEditingRecord(undefined);
    } catch (error) {
      console.error('Lỗi khi lưu:', error);
      showToast('Đã có lỗi xảy ra. Hãy thử lại.', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa hồ sơ ngăn chặn này và tất cả các tệp đính kèm liên quan?')) return;
    try {
      const record = records.find(r => r.id === id);
      if (isConfigured && record) {
         // Thu thập tất cả file đính kèm để xóa vật lý trên Supabase Storage
         const filesToDelete: any[] = [];
         if (record.attached_files && Array.isArray(record.attached_files)) {
            filesToDelete.push(...record.attached_files);
         }
         if (record.unblock_attached_files && Array.isArray(record.unblock_attached_files)) {
            filesToDelete.push(...record.unblock_attached_files);
         }

         const filePaths = filesToDelete
            .filter(f => f && f.id && !f.id.startsWith('mock-'))
            .map(f => f.id);

         if (filePaths.length > 0) {
            try {
               const { error: storageError } = await supabase.storage.from('chat-files').remove(filePaths);
               if (storageError) {
                  console.error('Lỗi khi xóa các file đính kèm của hồ sơ ngăn chặn khỏi Storage:', storageError);
               } else {
                  console.log('Đã xóa thành công các file đính kèm khỏi Storage:', filePaths);
               }
            } catch (storageErr) {
               console.error('Lỗi ngoại lệ khi xóa file khỏi Storage:', storageErr);
            }
         }

         const { error } = await supabase.from('blocking_records').delete().eq('id', id);
         if (error) throw error;
      }
      const newRecs = records.filter(r => r.id !== id);
      setRecords(newRecs);
      if (!isConfigured) await offlineDb.saveRecords('blocking_records', newRecs);
      localStorage.removeItem('last_blocking_records_sync_time');
      showToast('Xóa thành công!', 'success');
    } catch (error) {
      console.error('Lỗi khi xóa:', error);
      showToast('Đã có lỗi xảy ra khi xóa.', 'error');
    }
  };

  const handleDeleteAll = async () => {
    if (currentUser.role !== 'ADMIN') {
      showToast('Chỉ quản trị viên mới có quyền thực hiện chức năng này!', 'error');
      return;
    }
    const confirm1 = window.confirm('CẢNH BÁO: Bạn có chắc chắn muốn xóa TOÀN BỘ hồ sơ ngăn chặn? Tất cả dữ liệu và các tệp đính kèm sẽ bị xóa vĩnh viễn và không thể khôi phục!');
    if (!confirm1) return;

    const confirm2 = window.prompt('Nhập chữ "DELETE" (viết hoa, không dấu nháy) để xác nhận việc xóa toàn bộ dữ liệu ngăn chặn:');
    if (confirm2 !== 'DELETE') {
      showToast('Xác nhận không khớp. Hủy thao tác xóa!', 'error');
      return;
    }

    setLoading(true);
    try {
      if (isConfigured) {
        const { error } = await supabase.from('blocking_records').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        if (error) throw error;
      }
      setRecords([]);
      await offlineDb.saveRecords('blocking_records', []);
      localStorage.removeItem('last_blocking_records_sync_time');
      showToast('Đã xóa toàn bộ dữ liệu ngăn chặn thành công!', 'success');
    } catch (error) {
      console.error('Lỗi khi xóa toàn bộ dữ liệu:', error);
      showToast('Đã xảy ra lỗi khi xóa toàn bộ dữ liệu.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const filteredRecords = records.filter(r => {
    const matchIssueNum = !appliedFilters.issueNumber || r.issueNumber?.toLowerCase().includes(appliedFilters.issueNumber.toLowerCase());
    const matchCertNum = !appliedFilters.certNumber || r.certNumber?.toLowerCase().includes(appliedFilters.certNumber.toLowerCase());
    const matchOldCommune = !appliedFilters.oldCommune || r.oldCommune?.toLowerCase().includes(appliedFilters.oldCommune.toLowerCase());
    const matchNewCommune = !appliedFilters.newCommune || r.newCommune?.toLowerCase().includes(appliedFilters.newCommune.toLowerCase());
    const matchOwner = !appliedFilters.owner || r.owners?.some(o => o.toLowerCase().includes(appliedFilters.owner.toLowerCase()));
    const matchUnblockDoc = !appliedFilters.unblockDoc || r.unblockDoc?.toLowerCase().includes(appliedFilters.unblockDoc.toLowerCase());
    
    // Plot match logic
    const plotMatch = r.plots?.some(p => {
         const mOThua = !appliedFilters.oldPlotNumber || p.oldPlotNumber?.toLowerCase().includes(appliedFilters.oldPlotNumber.toLowerCase());
         const mOTo = !appliedFilters.oldMapSheetNumber || p.oldMapSheetNumber?.toLowerCase().includes(appliedFilters.oldMapSheetNumber.toLowerCase());
         const mNThua = !appliedFilters.newPlotNumber || p.newPlotNumber?.toLowerCase().includes(appliedFilters.newPlotNumber.toLowerCase());
         const mNTo = !appliedFilters.newMapSheetNumber || p.newMapSheetNumber?.toLowerCase().includes(appliedFilters.newMapSheetNumber.toLowerCase());
         return mOThua && mOTo && mNThua && mNTo;
    }) ?? false;

    const docMatch = !appliedFilters.docNumber || r.blockingDocuments?.some(d => d.docNumber?.toLowerCase().includes(appliedFilters.docNumber.toLowerCase()));

    return matchIssueNum && matchCertNum && matchOldCommune && matchNewCommune && matchOwner && matchUnblockDoc && (!r.plots || r.plots.length === 0 || plotMatch) && docMatch;
  });

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
                 <div className="flex items-center gap-2">
                      <h2 className="text-xl font-bold text-gray-800 tracking-tight">Hồ Sơ Ngăn Chặn</h2>
                      {loading && records.length > 0 && (
                           <span className="flex items-center gap-1 text-[11px] text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100 font-bold animate-pulse">
                                <Loader2 size={12} className="animate-spin" /> Đang cập nhật...
                           </span>
                      )}
                 </div>
                 <p className="text-sm text-gray-500 font-medium">Quản lý các hồ sơ bị ngăn chặn, tranh chấp.</p>
            </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap w-full md:w-auto justify-end">
          {!isReadOnly && (
            <>
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
                <>
                  <button
                    onClick={() => setShowCheckToolModal(true)}
                    className="flex items-center justify-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm font-medium whitespace-nowrap text-sm"
                    title="Đối soát nhanh dữ liệu hồ sơ đo đạc với dữ liệu ngăn chặn"
                  >
                    <ShieldAlert size={18} /> Đối soát ngăn chặn
                  </button>
                  <button
                    onClick={handleDeleteAll}
                    className="flex items-center justify-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors shadow-sm font-medium whitespace-nowrap text-sm"
                    title="Xóa tất cả dữ liệu ngăn chặn"
                  >
                    <Trash2 size={18} /> Xóa tất cả
                  </button>
                </>
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
            </>
          )}
        </div>
      </div>

      {/* TÌM KIẾM NÂNG CAO THƯỜNG TRỰC */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 mb-4">
         <div className="flex justify-between items-center mb-3 border-b pb-2">
             <h3 className="font-bold text-[#003b5c] text-sm flex items-center gap-2">
                 <Search size={16} /> Tìm kiếm hồ sơ ngăn chặn nâng cao
             </h3>
             {Object.values(appliedFilters).some(val => val !== '') && (
                 <span className="text-xs bg-red-50 text-red-600 border border-red-100 px-2.5 py-0.5 rounded-full font-bold animate-pulse">
                     Đang áp dụng bộ lọc
                 </span>
             )}
         </div>
         
         <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 text-sm">
             {/* PHẦN 1: THÔNG TIN GCN */}
             <div className="bg-blue-50/20 p-3 rounded-lg border border-blue-100/50 space-y-2.5">
                 <h4 className="font-bold text-[#003b5c] text-xs uppercase tracking-wider border-b border-blue-100 pb-1 flex items-center gap-1.5">
                     <span className="w-1.5 h-3 bg-blue-600 rounded-sm"></span>
                     Thông tin GCN
                 </h4>
                 <div className="flex flex-col gap-1">
                     <label className="text-xs font-bold text-gray-600">Chủ sử dụng</label>
                     <input type="text" placeholder="Tên chủ sử dụng..." value={searchFilters.owner} onChange={e => setSearchFilters({...searchFilters, owner: e.target.value})} className="border border-gray-200 rounded p-2 focus:ring-1 focus:ring-blue-500 outline-none text-xs font-medium bg-white" />
                 </div>
                 <div className="flex flex-col gap-1">
                     <label className="text-xs font-bold text-gray-600">Số phát hành GCN</label>
                     <input type="text" placeholder="Số phát hành GCN..." value={searchFilters.issueNumber} onChange={e => setSearchFilters({...searchFilters, issueNumber: e.target.value})} className="border border-gray-200 rounded p-2 focus:ring-1 focus:ring-blue-500 outline-none text-xs font-medium bg-white" />
                 </div>
                 <div className="flex flex-col gap-1">
                     <label className="text-xs font-bold text-gray-600">Số vào sổ GCN</label>
                     <input type="text" placeholder="Số vào sổ GCN..." value={searchFilters.certNumber} onChange={e => setSearchFilters({...searchFilters, certNumber: e.target.value})} className="border border-gray-200 rounded p-2 focus:ring-1 focus:ring-blue-500 outline-none text-xs font-medium bg-white" />
                 </div>
             </div>

             {/* PHẦN 2: THÔNG TIN THỬA ĐẤT */}
             <div className="bg-emerald-50/10 p-3 rounded-lg border border-emerald-100/50 space-y-2.5">
                 <h4 className="font-bold text-emerald-800 text-xs uppercase tracking-wider border-b border-emerald-100 pb-1 flex items-center gap-1.5">
                     <span className="w-1.5 h-3 bg-emerald-600 rounded-sm"></span>
                     Thông tin thửa đất
                 </h4>
                 <div className="grid grid-cols-2 gap-2">
                     <div className="flex flex-col gap-1">
                         <label className="text-xs font-bold text-gray-600">Tờ bản đồ (cũ)</label>
                         <input type="text" placeholder="Tờ cũ..." value={searchFilters.oldMapSheetNumber} onChange={e => setSearchFilters({...searchFilters, oldMapSheetNumber: e.target.value})} className="border border-gray-200 rounded p-2 focus:ring-1 focus:ring-blue-500 outline-none text-xs font-medium bg-white" />
                     </div>
                     <div className="flex flex-col gap-1">
                         <label className="text-xs font-bold text-gray-600">Thửa đất (cũ)</label>
                         <input type="text" placeholder="Thửa cũ..." value={searchFilters.oldPlotNumber} onChange={e => setSearchFilters({...searchFilters, oldPlotNumber: e.target.value})} className="border border-gray-200 rounded p-2 focus:ring-1 focus:ring-blue-500 outline-none text-xs font-medium bg-white" />
                     </div>
                 </div>
                 <div className="grid grid-cols-2 gap-2">
                     <div className="flex flex-col gap-1">
                         <label className="text-xs font-bold text-gray-600">Tờ bản đồ (mới)</label>
                         <input type="text" placeholder="Tờ mới..." value={searchFilters.newMapSheetNumber} onChange={e => setSearchFilters({...searchFilters, newMapSheetNumber: e.target.value})} className="border border-gray-200 rounded p-2 focus:ring-1 focus:ring-blue-500 outline-none text-xs font-medium bg-white" />
                     </div>
                     <div className="flex flex-col gap-1">
                         <label className="text-xs font-bold text-gray-600">Thửa đất (mới)</label>
                         <input type="text" placeholder="Thửa mới..." value={searchFilters.newPlotNumber} onChange={e => setSearchFilters({...searchFilters, newPlotNumber: e.target.value})} className="border border-gray-200 rounded p-2 focus:ring-1 focus:ring-blue-500 outline-none text-xs font-medium bg-white" />
                     </div>
                 </div>
                 <div className="grid grid-cols-2 gap-2">
                     <div className="flex flex-col gap-1">
                         <label className="text-xs font-bold text-gray-600">Phường/Xã (cũ)</label>
                         <select value={searchFilters.oldCommune} onChange={e => setSearchFilters({...searchFilters, oldCommune: e.target.value})} className="border border-gray-200 rounded p-2 focus:ring-1 focus:ring-blue-500 outline-none text-xs font-medium bg-white h-[34px]">
                             <option value="">Tất cả cũ...</option>
                             {oldCommunes.map(c => (
                                 <option key={c} value={c}>{c}</option>
                             ))}
                         </select>
                     </div>
                     <div className="flex flex-col gap-1">
                         <label className="text-xs font-bold text-gray-600">Phường/Xã (mới)</label>
                         <select value={searchFilters.newCommune} onChange={e => setSearchFilters({...searchFilters, newCommune: e.target.value})} className="border border-gray-200 rounded p-2 focus:ring-1 focus:ring-blue-500 outline-none text-xs font-medium bg-white h-[34px]">
                             <option value="">Tất cả mới...</option>
                             {newCommunes.map(c => (
                                 <option key={c} value={c}>{c}</option>
                             ))}
                         </select>
                     </div>
                 </div>
             </div>

             {/* PHẦN 3: THÔNG TIN NGĂN CHẶN */}
             <div className="bg-red-50/10 p-3 rounded-lg border border-red-100/50 space-y-2.5 flex flex-col justify-between">
                 <div className="space-y-2.5">
                     <h4 className="font-bold text-red-800 text-xs uppercase tracking-wider border-b border-red-100 pb-1 flex items-center gap-1.5">
                         <span className="w-1.5 h-3 bg-red-600 rounded-sm"></span>
                         Thông tin ngăn chặn
                     </h4>
                     <div className="flex flex-col gap-1">
                         <label className="text-xs font-bold text-gray-600">Số VB ngăn chặn</label>
                         <input type="text" placeholder="Số văn bản ngăn chặn..." value={searchFilters.docNumber} onChange={e => setSearchFilters({...searchFilters, docNumber: e.target.value})} className="border border-gray-200 rounded p-2 focus:ring-1 focus:ring-blue-500 outline-none text-xs font-medium bg-white" />
                     </div>
                     <div className="flex flex-col gap-1">
                         <label className="text-xs font-bold text-gray-600">VB giải ngăn chặn</label>
                         <input type="text" placeholder="Văn bản giải ngăn chặn..." value={searchFilters.unblockDoc} onChange={e => setSearchFilters({...searchFilters, unblockDoc: e.target.value})} className="border border-gray-200 rounded p-2 focus:ring-1 focus:ring-blue-500 outline-none text-xs font-medium bg-white" />
                     </div>
                 </div>
                 
                 <div className="flex gap-2 pt-2 border-t border-gray-100 mt-2">
                     <button
                       onClick={handleSearchSubmit}
                       className="flex-1 flex items-center justify-center gap-1.5 bg-[#003b5c] text-white px-3 py-2 rounded hover:bg-[#002b44] transition-colors shadow-sm font-bold text-xs h-[38px]"
                       title="Bắt đầu tìm kiếm với các thông tin đã nhập"
                     >
                       <Search size={14} /> Tìm kiếm
                     </button>
                     <button
                       onClick={handleClearSearch}
                       className="flex-1 flex items-center justify-center gap-1.5 bg-gray-100 text-gray-600 px-3 py-2 rounded hover:bg-gray-200 transition-colors shadow-sm font-bold text-xs h-[38px]"
                       title="Xóa toàn bộ bộ lọc và nhập lại"
                     >
                       Xóa bộ lọc
                     </button>
                 </div>
             </div>
         </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col min-h-0 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading && records.length === 0 ? (
           <div className="flex flex-col justify-center items-center flex-1 py-12">
             <Loader2 size={36} className="animate-spin text-blue-600 mb-3" />
             <p className="text-sm text-gray-500 font-medium">Đang tải dữ liệu hồ sơ ngăn chặn...</p>
           </div>
        ) : filteredRecords.length === 0 ? (
           <div className="flex flex-col justify-center items-center flex-1 text-gray-500 py-12">
              <ShieldAlert size={48} className="text-gray-300 mb-4" />
              <p className="text-lg font-medium text-gray-600">Vui lòng nhập thông tin tìm kiếm ở trên và bấm "Tìm kiếm"</p>
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
                            title={isReadOnly ? "Xem chi tiết" : "Sửa"}
                          >
                            {isReadOnly ? <Eye size={16} /> : <Edit size={16} />}
                          </button>
                          {!isReadOnly && (
                            <button 
                              onClick={() => handleDelete(record.id)} 
                              className="text-gray-400 hover:text-red-500 hover:bg-red-50 p-1.5 border border-transparent hover:border-red-100 rounded-sm transition-all"
                              title="Xóa"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
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

      {/* Form Modal */}
      {showForm && (
        <RecordForm
          initialData={editingRecord}
          currentUser={currentUser}
          onSubmit={handleSave}
          onCancel={() => setShowForm(false)}
          isReadOnly={isReadOnly}
        />
      )}

      {/* Progress Modal overlay */}
      {importProgress.active && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[110] p-4 backdrop-blur-sm">
          <div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-md text-center space-y-6 border border-gray-150 animate-fade-in">
            <div className="flex flex-col items-center">
              <Loader2 className="w-12 h-12 animate-spin text-blue-600 mb-2" />
              <h3 className="text-lg font-bold text-gray-800">Đang nhập dữ liệu ngăn chặn...</h3>
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

      {/* Cross check modal for admin */}
      <BlockingCheckToolModal
        isOpen={showCheckToolModal}
        onClose={() => setShowCheckToolModal(false)}
      />
    </div>
  );
};

export default BlockingRecordsView;
