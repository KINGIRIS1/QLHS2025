import React, { useState, useEffect } from 'react';
import { User, LandRecord } from '../types';
import RecordForm from './RecordForm';
import { Search, Plus, User as UserIcon, Calendar, MapPin, Loader2, ShieldAlert, FileText, CheckCircle, Trash2, Edit, Paperclip } from 'lucide-react';
import { supabase, isConfigured } from '../services/supabaseClient';

interface Props {
  currentUser: User;
}

const BlockingRecordsView: React.FC<Props> = ({ currentUser }) => {
  const [records, setRecords] = useState<LandRecord[]>(() => {
      const cached = localStorage.getItem('offline_blocking_records');
      return cached ? JSON.parse(cached) : [];
  });
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState({
    issueNumber: '',
    certNumber: '',
    oldMapSheetNumber: '',
    oldPlotNumber: '',
    newMapSheetNumber: '',
    newPlotNumber: '',
    oldCommune: '',
    newCommune: '',
    docNumber: ''
  });
  const [showForm, setShowForm] = useState(false);
  const [editingRecord, setEditingRecord] = useState<LandRecord | undefined>();

  useEffect(() => {
    fetchBlockingRecords();
  }, []);

  const fetchBlockingRecords = async () => {
    if (!isConfigured) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.from('blocking_records').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      setRecords(data as LandRecord[]);
      localStorage.setItem('offline_blocking_records', JSON.stringify(data));
    } catch (error) {
      console.error('Lỗi khi tải danh sách ngăn chặn:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (formData: any) => {
    try {
      if (formData.id) {
        if (isConfigured) {
          const { error } = await supabase.from('blocking_records').update(formData).eq('id', formData.id);
          if (error) throw error;
        } else {
           setRecords(prev => prev.map(p => p.id === formData.id ? formData : p));
        }
        alert('Cập nhật thành công!');
      } else {
        if (isConfigured) {
          const { error } = await supabase.from('blocking_records').insert([formData]);
          if (error) throw error;
        } else {
          formData.id = 'temp_' + Date.now();
          setRecords(prev => [formData, ...prev]);
        }
        alert('Thêm mới thành công!');
      }
      setShowForm(false);
      setEditingRecord(undefined);
      if (isConfigured) fetchBlockingRecords();
      else localStorage.setItem('offline_blocking_records', JSON.stringify(records));
    } catch (error) {
      console.error('Lỗi khi lưu:', error);
      alert('Đã có lỗi xảy ra. Hãy thử lại.');
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
      if (!isConfigured) localStorage.setItem('offline_blocking_records', JSON.stringify(newRecs));
      alert('Xóa thành công!');
    } catch (error) {
      console.error('Lỗi khi xóa:', error);
      alert('Đã có lỗi xảy ra khi xóa.');
    }
  };

  const filteredRecords = records.filter(r => {
    if (showAdvancedSearch) {
        // Advanced search matching
        const matchIssueNum = !advancedFilters.issueNumber || r.issueNumber?.toLowerCase().includes(advancedFilters.issueNumber.toLowerCase());
        const matchCertNum = !advancedFilters.certNumber || r.certNumber?.toLowerCase().includes(advancedFilters.certNumber.toLowerCase());
        const matchOldCommune = !advancedFilters.oldCommune || r.oldCommune?.toLowerCase().includes(advancedFilters.oldCommune.toLowerCase());
        const matchNewCommune = !advancedFilters.newCommune || r.newCommune?.toLowerCase().includes(advancedFilters.newCommune.toLowerCase());
        
        // Plot match logic
        const plotMatch = r.plots?.some(p => {
             const mOThua = !advancedFilters.oldPlotNumber || p.oldPlotNumber?.toLowerCase().includes(advancedFilters.oldPlotNumber.toLowerCase());
             const mOTo = !advancedFilters.oldMapSheetNumber || p.oldMapSheetNumber?.toLowerCase().includes(advancedFilters.oldMapSheetNumber.toLowerCase());
             const mNThua = !advancedFilters.newPlotNumber || p.newPlotNumber?.toLowerCase().includes(advancedFilters.newPlotNumber.toLowerCase());
             const mNTo = !advancedFilters.newMapSheetNumber || p.newMapSheetNumber?.toLowerCase().includes(advancedFilters.newMapSheetNumber.toLowerCase());
             return mOThua && mOTo && mNThua && mNTo;
        }) ?? false;

        const docMatch = !advancedFilters.docNumber || r.blockingDocuments?.some(d => d.docNumber?.toLowerCase().includes(advancedFilters.docNumber.toLowerCase()));

        return matchIssueNum && matchCertNum && matchOldCommune && matchNewCommune && (r.plots ? plotMatch : true) && docMatch;
    } else {
        // Basic search: blocking doc number, unblock doc, and maybe owners
        const term = search.toLowerCase();
        if (!term) return true;
        const docMatch = r.blockingDocuments?.some(d => d.docNumber?.toLowerCase().includes(term));
        const unblockMatch = r.isUnblocked && r.unblockDoc?.toLowerCase().includes(term);
        const ownersMatch = r.owners?.join(', ').toLowerCase().includes(term);
        return docMatch || unblockMatch || ownersMatch;
    }
  });

  const clearFilters = () => {
      setAdvancedFilters({
        issueNumber: '', certNumber: '', oldMapSheetNumber: '', oldPlotNumber: '', 
        newMapSheetNumber: '', newPlotNumber: '', oldCommune: '', newCommune: '', docNumber: ''
      });
      setSearch('');
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
                 <h2 className="text-xl font-bold text-gray-800 tracking-tight">Hồ Sơ Ngăn Chặn</h2>
                 <p className="text-sm text-gray-500 font-medium">Quản lý các hồ sơ bị ngăn chặn, tranh chấp.</p>
            </div>
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Tìm cơ bản (Số VB, Chủ, ...)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              disabled={showAdvancedSearch}
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-sm disabled:opacity-50"
            />
          </div>
          <button
            onClick={() => setShowAdvancedSearch(!showAdvancedSearch)}
            className={`p-2 border rounded-lg transition-colors text-sm font-medium ${showAdvancedSearch ? 'bg-blue-50 border-blue-500 text-blue-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
            title="Tìm kiếm nâng cao"
          >
            Nâng cao
          </button>
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

      {showAdvancedSearch && (
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 mb-4 animate-in fade-in slide-in-from-top-4 duration-200">
           <div className="flex justify-between items-center mb-3">
               <h3 className="font-semibold text-gray-700 text-sm">Tìm kiếm nâng cao</h3>
               <button onClick={clearFilters} className="text-xs text-blue-600 hover:text-blue-800 font-medium">Bỏ lọc/Tìm kiếm cơ bản</button>
           </div>
           <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
              <input type="text" placeholder="Số Phát Hành" value={advancedFilters.issueNumber} onChange={e => setAdvancedFilters({...advancedFilters, issueNumber: e.target.value})} className="border border-gray-200 rounded p-2 focus:ring-1 focus:ring-blue-500 outline-none" />
              <input type="text" placeholder="Số Vào Sổ" value={advancedFilters.certNumber} onChange={e => setAdvancedFilters({...advancedFilters, certNumber: e.target.value})} className="border border-gray-200 rounded p-2 focus:ring-1 focus:ring-blue-500 outline-none" />
              <input type="text" placeholder="Số VB Ngăn Chặn" value={advancedFilters.docNumber} onChange={e => setAdvancedFilters({...advancedFilters, docNumber: e.target.value})} className="border border-gray-200 rounded p-2 focus:ring-1 focus:ring-blue-500 outline-none" />
              <div className="hidden lg:block"></div>
              
              <input type="text" placeholder="Tờ bản đồ (cũ)" value={advancedFilters.oldMapSheetNumber} onChange={e => setAdvancedFilters({...advancedFilters, oldMapSheetNumber: e.target.value})} className="border border-gray-200 rounded p-2 focus:ring-1 focus:ring-blue-500 outline-none" />
              <input type="text" placeholder="Thửa đất (cũ)" value={advancedFilters.oldPlotNumber} onChange={e => setAdvancedFilters({...advancedFilters, oldPlotNumber: e.target.value})} className="border border-gray-200 rounded p-2 focus:ring-1 focus:ring-blue-500 outline-none" />
              <input type="text" placeholder="Tờ bản đồ (mới)" value={advancedFilters.newMapSheetNumber} onChange={e => setAdvancedFilters({...advancedFilters, newMapSheetNumber: e.target.value})} className="border border-gray-200 rounded p-2 focus:ring-1 focus:ring-blue-500 outline-none" />
              <input type="text" placeholder="Thửa đất (mới)" value={advancedFilters.newPlotNumber} onChange={e => setAdvancedFilters({...advancedFilters, newPlotNumber: e.target.value})} className="border border-gray-200 rounded p-2 focus:ring-1 focus:ring-blue-500 outline-none" />
              
              <input type="text" placeholder="Phường/Xã (cũ)" value={advancedFilters.oldCommune} onChange={e => setAdvancedFilters({...advancedFilters, oldCommune: e.target.value})} className="border border-gray-200 rounded p-2 focus:ring-1 focus:ring-blue-500 outline-none" />
              <input type="text" placeholder="Phường/Xã (mới)" value={advancedFilters.newCommune} onChange={e => setAdvancedFilters({...advancedFilters, newCommune: e.target.value})} className="border border-gray-200 rounded p-2 focus:ring-1 focus:ring-blue-500 outline-none" />
           </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto bg-white rounded-xl shadow-sm border border-gray-100">
        {loading ? (
           <div className="flex justify-center items-center h-full">
             <Loader2 size={32} className="animate-spin text-blue-500" />
           </div>
        ) : filteredRecords.length === 0 ? (
           <div className="flex flex-col justify-center items-center h-full text-gray-500">
              <ShieldAlert size={48} className="text-gray-300 mb-4" />
              <p className="text-lg font-medium text-gray-600">Không có hồ sơ ngăn chặn nào</p>
              <p className="text-sm mt-1 text-gray-400">Hoặc không tìm thấy kết quả phù hợp.</p>
           </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-gray-700 border-collapse">
              <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b-2 border-blue-800">
                <tr>
                  <th scope="col" className="px-2 py-3 text-center border font-bold whitespace-nowrap">STT</th>
                  <th scope="col" className="px-4 py-3 border font-bold min-w-[200px]">
                    CHỦ SỬ DỤNG & GCN<br/>
                    <span className="text-[10px] text-gray-500 font-normal normal-case pt-1 block">sắp xếp: ngày cấp ↓</span>
                  </th>
                  <th scope="col" className="px-4 py-3 border font-bold min-w-[250px]">
                    ĐẶC ĐIỂM & VỊ TRÍ<br/>
                    <span className="text-[10px] text-gray-400 font-normal normal-case flex items-center gap-3 mt-1">
                      <span>tờ cũ ↓</span><span>tờ mới ↓</span><span>thửa cũ ↓</span><span>thửa mới ↓</span>
                    </span>
                  </th>
                  <th scope="col" className="px-4 py-3 border font-bold min-w-[300px]">NỘI DUNG NGĂN CHẶN</th>
                  <th scope="col" className="px-4 py-3 border font-bold text-center">TRẠNG THÁI</th>
                  <th scope="col" className="px-4 py-3 border font-bold text-center">
                    <div className="flex items-center justify-center gap-1"><UserIcon size={14}/> NGƯỜI NHẬP</div>
                  </th>
                  <th scope="col" className="px-4 py-3 border font-bold text-center">
                    <div className="flex items-center justify-center gap-1"><Calendar size={14}/> NGÀY NHẬP</div>
                  </th>
                  <th scope="col" className="px-4 py-3 border font-bold text-center">TÁC VỤ</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map((record, index) => (
                  <tr key={record.id} className="bg-white border-b hover:bg-gray-50/50 transition-colors">
                    <td className="px-2 py-4 text-center border font-semibold text-[#003b5c]">{index + 1}</td>
                    
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
                              <div className="text-gray-800 pl-5">
                                 {record.unblockDoc}
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
        )}
      </div>

      {/* Form Modal */}
      {showForm && (
        <RecordForm
          initialData={editingRecord}
          currentUser={currentUser}
          onSubmit={handleSave}
          onCancel={() => setShowForm(false)}
        />
      )}
    </div>
  );
};

export default BlockingRecordsView;
