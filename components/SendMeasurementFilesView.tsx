import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Upload, 
  FileText, 
  CheckCircle, 
  Loader2, 
  Search, 
  Trash2, 
  Paperclip, 
  Download, 
  Info, 
  X, 
  ChevronRight, 
  User, 
  Calendar, 
  MapPin, 
  Activity,
  Check,
  AlertCircle
} from 'lucide-react';
import { User as UserType, RecordFile, RecordStatus, UserRole } from '../types';
import { supabase, isConfigured } from '../services/supabaseClient';
import { saveArchiveRecord } from '../services/apiArchive';
import { updateRecordApi } from '../services/apiRecords';

interface SendMeasurementFilesViewProps {
  currentUser: UserType;
  records: RecordFile[];
  onUpdateRecord?: (updated: RecordFile) => void;
}

export const SendMeasurementFilesView: React.FC<SendMeasurementFilesViewProps> = ({ 
  currentUser, 
  records,
  onUpdateRecord
}) => {
  // States
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRecord, setSelectedRecord] = useState<RecordFile | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [notes, setNotes] = useState('');
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [historyFiles, setHistoryFiles] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [autoCompleteStatus, setAutoCompleteStatus] = useState(false); // Tu dong chuyen trang thai ho so sang Da thuc hien

  const dropzoneRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Filter records available for measurement upload
  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return [];
    const term = searchTerm.toLowerCase().trim();
    return records.filter(r => 
      r.code.toLowerCase().includes(term) || 
      r.customerName.toLowerCase().includes(term) ||
      (r.landPlot || '').toLowerCase().includes(term) ||
      (r.mapSheet || '').toLowerCase().includes(term)
    ).slice(0, 8); // Limit to 8 suggestions for responsive mobile UI
  }, [records, searchTerm]);

  // Toast helper
  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Load upload history for selected record or general history
  const fetchUploadHistory = async (recordCode?: string) => {
    setIsLoadingHistory(true);
    try {
      if (!isConfigured) {
        // Fallback mock history for Demo
        const localData = localStorage.getItem('mock_measurement_uploads');
        let uploads = localData ? JSON.parse(localData) : [];
        if (recordCode) {
          uploads = uploads.filter((u: any) => u.so_hieu === recordCode);
        }
        setHistoryFiles(uploads);
        return;
      }

      let query = supabase
        .from('archive_records')
        .select('*')
        .eq('type', 'file_dodac')
        .order('created_at', { ascending: false });

      if (recordCode) {
        query = query.eq('so_hieu', recordCode);
      }

      const { data, error } = await query;
      if (error) throw error;
      setHistoryFiles(data || []);
    } catch (e: any) {
      console.error('Error loading file upload history:', e);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // Load general history on mount
  useEffect(() => {
    fetchUploadHistory();
  }, []);

  // Fetch history when selected record changes
  useEffect(() => {
    fetchUploadHistory(selectedRecord?.code);
    if (selectedRecord) {
      // Defer state update if needed, but it's safe here
      setAutoCompleteStatus(selectedRecord.status === RecordStatus.ASSIGNED || selectedRecord.status === RecordStatus.IN_PROGRESS);
    }
  }, [selectedRecord]);

  // File selection handlers
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArr = Array.from(e.target.files);
      setPendingFiles(prev => [...prev, ...filesArr]);
    }
  };

  const removePendingFile = (index: number) => {
    setPendingFiles(prev => prev.filter((_, idx) => idx !== index));
  };

  // Drag & Drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (dropzoneRef.current) {
      dropzoneRef.current.classList.add('border-blue-500', 'bg-blue-50/50');
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    if (dropzoneRef.current) {
      dropzoneRef.current.classList.remove('border-blue-500', 'bg-blue-50/50');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (dropzoneRef.current) {
      dropzoneRef.current.classList.remove('border-blue-500', 'bg-blue-50/50');
    }
    if (e.dataTransfer.files) {
      const filesArr = Array.from(e.dataTransfer.files);
      setPendingFiles(prev => [...prev, ...filesArr]);
    }
  };

  // Upload handler
  const handleUploadSubmit = async () => {
    if (!selectedRecord) {
      showToast('Vui lòng chọn một hồ sơ đo đạc để gửi file!', 'error');
      return;
    }
    if (pendingFiles.length === 0) {
      showToast('Vui lòng kéo thả hoặc chọn ít nhất 1 file đo đạc!', 'error');
      return;
    }

    setIsUploading(true);
    setUploadProgress(10);

    try {
      const uploadedFilesList = [];
      let stepProgress = Math.round(80 / pendingFiles.length);

      for (let i = 0; i < pendingFiles.length; i++) {
        const file = pendingFiles[i];
        
        if (!isConfigured) {
          // Mock Upload for Demo Mode
          await new Promise(resolve => setTimeout(resolve, 600));
          uploadedFilesList.push({
            id: `mock-dodac-${Date.now()}-${i}`,
            url: URL.createObjectURL(file),
            name: file.name,
            size: file.size
          });
          setUploadProgress(prev => (prev || 0) + stepProgress);
          continue;
        }

        const fileExt = file.name.split('.').pop();
        const fileNameNormalized = file.name.replace(/[^a-zA-Z0-9.]/g, '_');
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}_${fileNameNormalized}`;
        const filePath = `measurement_files/${selectedRecord.code}/${fileName}`;

        const { data, error } = await supabase.storage
          .from('chat-files')
          .upload(filePath, file);

        if (error) {
          throw new Error(`Lỗi tải lên file ${file.name}: ${error.message}`);
        }

        const { data: { publicUrl } } = supabase.storage
          .from('chat-files')
          .getPublicUrl(filePath);

        uploadedFilesList.push({
          id: data.path,
          url: publicUrl,
          name: file.name,
          size: file.size
        });

        setUploadProgress(prev => (prev || 0) + stepProgress);
      }

      setUploadProgress(90);

      // Save to archive_records with type 'file_dodac'
      const archivePayload: any = {
        type: 'file_dodac' as any,
        status: 'completed' as any,
        so_hieu: selectedRecord.code,
        trich_yeu: notes.trim() || `Gửi file đo đạc cho hồ sơ: ${selectedRecord.code}`,
        ngay_thang: new Date().toISOString().split('T')[0],
        noi_nhan_gui: selectedRecord.customerName,
        attached_files: uploadedFilesList,
        created_by: currentUser.name,
        data: {
          record_id: selectedRecord.id,
          uploaded_by_username: currentUser.username,
          device_info: 'Mobile/Web Application',
          uploaded_at: new Date().toISOString()
        }
      };

      if (!isConfigured) {
        // Save to LocalStorage mock database
        const localData = localStorage.getItem('mock_measurement_uploads');
        const uploads = localData ? JSON.parse(localData) : [];
        const newMockRow = {
          id: `mock-row-${Date.now()}`,
          created_at: new Date().toISOString(),
          ...archivePayload
        };
        uploads.unshift(newMockRow);
        localStorage.setItem('mock_measurement_uploads', JSON.stringify(uploads));
      } else {
        const saved = await saveArchiveRecord(archivePayload);
        if (!saved) throw new Error("Không thể lưu thông tin file đo đạc vào cơ sở dữ liệu.");
      }

      // If user wants to automatically move record status to COMPLETED_WORK (Đã thực hiện)
      if (autoCompleteStatus && (selectedRecord.status === RecordStatus.ASSIGNED || selectedRecord.status === RecordStatus.IN_PROGRESS)) {
        const updatedRecord: RecordFile = {
          ...selectedRecord,
          status: RecordStatus.COMPLETED_WORK,
          workCompletedDate: new Date().toISOString().split('T')[0]
        };

        // Call update API
        const success = await updateRecordApi(updatedRecord);
        if (success && onUpdateRecord) {
          onUpdateRecord(success);
        }
      }

      showToast('Gửi file đo đạc thành công!', 'success');
      setPendingFiles([]);
      setNotes('');
      // Refresh upload history
      fetchUploadHistory(selectedRecord.code);

    } catch (e: any) {
      console.error(e);
      showToast(e.message || 'Đã xảy ra lỗi khi gửi file!', 'error');
    } finally {
      setIsUploading(false);
      setUploadProgress(null);
    }
  };

  // Delete uploaded file package (only owner or admin/subadmin can delete)
  const handleDeleteHistoryItem = async (item: any) => {
    const isOwner = item.created_by === currentUser.name || item.data?.uploaded_by_username === currentUser.username;
    const canDelete = isOwner || currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.SUBADMIN;

    if (!canDelete) {
      showToast('Bạn không có quyền xóa file đo đạc này!', 'error');
      return;
    }

    if (!window.confirm('Bạn có chắc chắn muốn xóa bản ghi gửi file này? Các file lưu trữ sẽ bị xóa khỏi hệ thống.')) {
      return;
    }

    try {
      if (!isConfigured) {
        const localData = localStorage.getItem('mock_measurement_uploads');
        let uploads = localData ? JSON.parse(localData) : [];
        uploads = uploads.filter((u: any) => u.id !== item.id);
        localStorage.setItem('mock_measurement_uploads', JSON.stringify(uploads));
        showToast('Xóa bản ghi thành công (chế độ Demo)!', 'success');
        fetchUploadHistory(selectedRecord?.code);
        return;
      }

      // Try deleting physical files in Storage first
      if (Array.isArray(item.attached_files)) {
        const filePaths = item.attached_files.map((f: any) => f.id).filter(Boolean);
        if (filePaths.length > 0) {
          const { error: storageErr } = await supabase.storage
            .from('chat-files')
            .remove(filePaths);
          if (storageErr) {
            console.warn('Lỗi khi xóa file vật lý trên Storage (bỏ qua):', storageErr);
          }
        }
      }

      // Delete from archive_records table
      const { error } = await supabase
        .from('archive_records')
        .delete()
        .eq('id', item.id);

      if (error) throw error;

      showToast('Xóa bản ghi và file thành công!', 'success');
      fetchUploadHistory(selectedRecord?.code);

    } catch (e: any) {
      console.error('Lỗi khi xóa bản ghi:', e);
      showToast('Không thể xóa bản ghi: ' + e.message, 'error');
    }
  };

  // Format file size helper
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="max-w-4xl mx-auto space-y-5 px-3 py-4 sm:py-6" id="send-measurement-files-container">
      {/* Toast Alert */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 p-4 rounded-xl shadow-lg flex items-center gap-3 animate-slide-in-right ${
          toast.type === 'success' ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' : 'bg-rose-50 border border-rose-200 text-rose-800'
        }`}>
          {toast.type === 'success' ? <CheckCircle className="text-emerald-600 shrink-0" size={20} /> : <AlertCircle className="text-rose-600 shrink-0" size={20} />}
          <span className="text-sm font-bold">{toast.message}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white rounded-2xl p-5 sm:p-6 shadow-md flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold flex items-center gap-2">
            <Upload className="animate-bounce" size={24} /> Gửi File Đo Đạc Thực Địa
          </h2>
          <p className="text-blue-100 text-xs sm:text-sm mt-1.5 font-medium">
            Kênh tải bản vẽ, tài liệu đo đạc trực tiếp từ thực địa (hỗ trợ chụp ảnh, đính kèm từ điện thoại di động)
          </p>
        </div>
        <div className="bg-white/15 px-3 py-1.5 rounded-full text-xs font-bold border border-white/10 self-start md:self-auto">
          Tổ Đo Đạc • {currentUser.name}
        </div>
      </div>

      {/* Main Grid: Upload Form + History */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* Left Side: Upload Form */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5 space-y-4">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
            <Paperclip size={16} className="text-blue-600" /> Tạo yêu cầu gửi file
          </h3>

          {/* Record Selector Search */}
          <div className="relative">
            <label className="block text-xs font-bold text-slate-500 mb-1">HỒ SƠ ĐO ĐẠC LIÊN QUAN <span className="text-rose-500">*</span></label>
            <div className="relative">
              <input
                type="text"
                className="w-full pl-9 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium text-slate-800"
                placeholder="Tìm mã hồ sơ, tên khách hàng..."
                value={selectedRecord ? `${selectedRecord.code} - ${selectedRecord.customerName}` : searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  if (selectedRecord) {
                    setSelectedRecord(null);
                  }
                  setIsDropdownOpen(true);
                }}
                onFocus={() => setIsDropdownOpen(true)}
              />
              <Search className="absolute left-3 top-3.5 text-slate-400" size={16} />
              {selectedRecord && (
                <button 
                  onClick={() => {
                    setSelectedRecord(null);
                    setSearchTerm('');
                    setIsDropdownOpen(true);
                  }}
                  className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 p-0.5 rounded-full hover:bg-slate-200 transition-colors"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Suggestions Dropdown */}
            {isDropdownOpen && searchTerm.trim() && !selectedRecord && (
              <div className="absolute z-30 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                {filteredRecords.length > 0 ? (
                  filteredRecords.map((r) => (
                    <button
                      key={r.id}
                      className="w-full text-left px-4 py-2.5 hover:bg-slate-50 transition-colors flex flex-col border-b border-slate-100 last:border-0"
                      onClick={() => {
                        setSelectedRecord(r);
                        setIsDropdownOpen(false);
                      }}
                    >
                      <div className="flex justify-between items-center w-full">
                        <span className="font-bold text-sm text-blue-600">{r.code}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 font-bold text-slate-500">{r.status}</span>
                      </div>
                      <span className="text-xs text-slate-800 font-bold mt-0.5">{r.customerName}</span>
                      <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-1 font-medium">
                        <span className="flex items-center gap-0.5"><MapPin size={10} /> Thửa {r.landPlot || '?'}, Tờ {r.mapSheet || '?'}</span>
                        <span>•</span>
                        <span>{r.recordType || 'Đo đạc'}</span>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="p-4 text-center text-xs text-slate-400 italic">
                    Không tìm thấy hồ sơ đo đạc phù hợp
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Selected Record Info Card */}
          {selectedRecord && (
            <div className="bg-blue-50/40 border border-blue-100/70 rounded-xl p-3 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-blue-800 text-sm">Chi tiết hồ sơ</span>
                <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-bold text-[10px] uppercase">
                  {selectedRecord.status}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-slate-600 font-medium">
                <div>Khách hàng: <strong className="text-slate-800">{selectedRecord.customerName}</strong></div>
                <div>Điện thoại: <strong className="text-slate-800">{selectedRecord.phoneNumber || 'Không có'}</strong></div>
                <div>Địa danh: <strong className="text-slate-800">{selectedRecord.ward || 'Chưa ghi nhận'}</strong></div>
                <div>Thửa/Tờ: <strong className="text-slate-800">{selectedRecord.landPlot || '?'}/{selectedRecord.mapSheet || '?'}</strong></div>
                <div className="col-span-2 border-t border-blue-100/30 pt-1.5 mt-0.5">
                  Nội dung yêu cầu: <span className="text-slate-700 italic">{selectedRecord.content || 'Không có nội dung chi tiết'}</span>
                </div>
              </div>

              {/* Status transition auto-complete option */}
              {(selectedRecord.status === RecordStatus.ASSIGNED || selectedRecord.status === RecordStatus.IN_PROGRESS) && (
                <div className="pt-2 border-t border-blue-100/40 flex items-center gap-2">
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700 select-none">
                    <input
                      type="checkbox"
                      checked={autoCompleteStatus}
                      onChange={(e) => setAutoCompleteStatus(e.target.checked)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500/20 w-4 h-4"
                    />
                    <span>Tự động chuyển hồ sơ sang "Đã thực hiện"</span>
                  </label>
                  <span title="Nếu bật, trạng thái hồ sơ sẽ tự động chuyển sang Đã thực hiện và cập nhật ngày hoàn thành công tác sau khi gửi file thành công.">
                    <Info size={12} className="text-blue-500 shrink-0" />
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Notes Input */}
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">GHI CHÚ / NỘI DUNG TẢI LÊN</label>
            <textarea
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium text-slate-800 h-16 resize-none"
              placeholder="Nhập nội dung ghi chú cho bản vẽ, file đo đạc gửi lên..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {/* Dropzone area */}
          <div 
            ref={dropzoneRef}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            className="border-2 border-dashed border-slate-200 hover:border-blue-400 bg-slate-50 hover:bg-blue-50/10 rounded-xl p-6 text-center cursor-pointer transition-all duration-200 flex flex-col items-center justify-center gap-2 group"
          >
            <input 
              type="file" 
              ref={inputRef} 
              className="hidden" 
              multiple 
              onChange={handleFileChange}
              accept=".dwg,.dxf,.pdf,.zip,.rar,.png,.jpg,.jpeg"
            />
            <div className="bg-blue-100/60 text-blue-600 p-3 rounded-full group-hover:scale-110 transition-transform">
              <Upload size={24} />
            </div>
            <div>
              <span className="text-sm font-bold text-slate-700 block">Kéo thả file vào đây hoặc click để chọn</span>
              <span className="text-[11px] text-slate-400 mt-1 block font-medium">Hỗ trợ bản vẽ CAD (.dwg, .dxf), tài liệu PDF, tệp nén (.zip, .rar) hoặc hình ảnh</span>
            </div>
          </div>

          {/* Pending files list */}
          {pendingFiles.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex justify-between items-center px-1 text-xs font-bold text-slate-500">
                <span>DANH SÁCH FILE ĐÃ CHỌN ({pendingFiles.length})</span>
                <button onClick={() => setPendingFiles([])} className="text-rose-500 hover:underline">Xóa tất cả</button>
              </div>
              <div className="max-h-40 overflow-y-auto space-y-1 pr-1 border border-slate-100 rounded-lg p-1 bg-slate-50/50">
                {pendingFiles.map((file, idx) => (
                  <div key={idx} className="flex justify-between items-center bg-white border border-slate-200/60 p-2 rounded-lg text-xs font-medium text-slate-700">
                    <div className="flex items-center gap-2 truncate max-w-[80%]">
                      <FileText size={14} className="text-blue-500 shrink-0" />
                      <span className="truncate font-bold" title={file.name}>{file.name}</span>
                      <span className="text-[10px] text-slate-400 font-mono shrink-0">({formatFileSize(file.size)})</span>
                    </div>
                    <button 
                      onClick={() => removePendingFile(idx)}
                      className="text-slate-400 hover:text-rose-600 p-1 hover:bg-slate-50 rounded transition-colors"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Submit Button */}
          <button
            onClick={handleUploadSubmit}
            disabled={isUploading || !selectedRecord || pendingFiles.length === 0}
            className={`w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-extrabold flex items-center justify-center gap-2 shadow-sm transition-all active:scale-[0.98] ${
              (isUploading || !selectedRecord || pendingFiles.length === 0) ? 'opacity-50 cursor-not-allowed bg-slate-400' : ''
            }`}
          >
            {isUploading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                <span>ĐANG TẢI LÊN VÀ LƯU ({uploadProgress ? `${uploadProgress}%` : 'Đang xử lý'}...)</span>
              </>
            ) : (
              <>
                <Check size={18} />
                <span>GỬI FILE ĐO ĐẠC NGAY</span>
              </>
            )}
          </button>
        </div>

        {/* Right Side: Upload History (Real-time logs) */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5 flex flex-col">
          <div className="flex justify-between items-center mb-3 shrink-0">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <Activity size={16} className="text-emerald-500" /> Nhật ký đã gửi
            </h3>
            {selectedRecord && (
              <button 
                onClick={() => setSelectedRecord(null)}
                className="text-[10px] font-bold text-blue-600 hover:underline bg-blue-50 px-2 py-1 rounded"
              >
                Xem tất cả
              </button>
            )}
          </div>

          <p className="text-[11px] text-slate-400 font-medium mb-3 shrink-0">
            {selectedRecord 
              ? `Hiển thị các đợt gửi file cho hồ sơ mã: ${selectedRecord.code}` 
              : 'Hiển thị danh sách tất cả các đợt tải lên file đo đạc của bộ phận'
            }
          </p>

          {/* History List */}
          <div className="flex-1 overflow-y-auto max-h-[460px] lg:max-h-[500px] space-y-3 pr-1">
            {isLoadingHistory ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-2">
                <Loader2 size={24} className="animate-spin text-slate-300" />
                <span className="text-xs font-medium">Đang tải nhật ký file gửi...</span>
              </div>
            ) : historyFiles.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-slate-100 rounded-xl bg-slate-50/50">
                <Info size={28} className="text-slate-300 mx-auto mb-2" />
                <span className="text-xs font-bold text-slate-400 block">Chưa có file đo đạc nào được gửi</span>
                <span className="text-[10px] text-slate-400 mt-1 block font-medium">Chọn hồ sơ ở khung bên trái để tải lên file đầu tiên</span>
              </div>
            ) : (
              historyFiles.map((item) => (
                <div key={item.id} className="border border-slate-100 bg-slate-50/30 hover:bg-slate-50/60 p-3 rounded-xl space-y-2.5 transition-colors">
                  {/* Top line */}
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-extrabold text-[10px] uppercase">
                        {item.so_hieu}
                      </span>
                      <span className="text-xs font-bold text-slate-700 ml-2 block sm:inline-block mt-1 sm:mt-0">
                        {item.noi_nhan_gui}
                      </span>
                    </div>
                    {/* Delete button */}
                    {(item.created_by === currentUser.name || item.data?.uploaded_by_username === currentUser.username || currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.SUBADMIN) && (
                      <button 
                        onClick={() => handleDeleteHistoryItem(item)}
                        className="text-slate-300 hover:text-rose-600 hover:bg-rose-50 p-1.5 rounded-lg transition-colors shrink-0"
                        title="Xóa đợt gửi file này"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>

                  {/* Note */}
                  <p className="text-xs text-slate-500 font-medium italic pl-1 border-l-2 border-slate-200">
                    {item.trich_yeu || 'Không ghi chú.'}
                  </p>

                  {/* Attached Files List */}
                  {Array.isArray(item.attached_files) && item.attached_files.length > 0 && (
                    <div className="bg-white border border-slate-100 rounded-lg overflow-hidden divide-y divide-slate-100">
                      {item.attached_files.map((file: any, fIdx: number) => (
                        <div key={fIdx} className="p-2 flex items-center justify-between gap-3 text-xs">
                          <div className="flex items-center gap-1.5 truncate flex-1 font-bold text-slate-700">
                            <FileText size={12} className="text-blue-500 shrink-0" />
                            <span className="truncate" title={file.name}>{file.name}</span>
                            {file.size && (
                              <span className="text-[9px] text-slate-400 font-mono shrink-0">({formatFileSize(file.size)})</span>
                            )}
                          </div>
                          <a 
                            href={file.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:bg-blue-50 px-2 py-1 rounded font-bold flex items-center gap-0.5 shrink-0 transition-colors"
                            title="Tải về file này"
                          >
                            <Download size={11} /> Tải về
                          </a>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Footer metadata */}
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[9px] text-slate-400 font-bold uppercase mt-1">
                    <span className="flex items-center gap-1"><User size={10} /> {item.created_by}</span>
                    <span className="flex items-center gap-1"><Calendar size={10} /> {new Date(item.created_at || item.data?.uploaded_at || Date.now()).toLocaleString('vi-VN')}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
