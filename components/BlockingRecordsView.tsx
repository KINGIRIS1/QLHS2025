import React, { useState, useEffect } from 'react';
import { User, LandRecord } from '../types';
import RecordForm from './RecordForm';
import { Search, Plus, User as UserIcon, Calendar, MapPin, Loader2, ShieldAlert, FileText, CheckCircle, Trash2, Edit } from 'lucide-react';
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
    if (!window.confirm('Bạn có chắc chắn muốn xóa hồ sơ ngăn chặn này?')) return;
    try {
      if (isConfigured) {
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
    const term = search.toLowerCase();
    const ownersMatch = r.owners?.join(', ').toLowerCase().includes(term);
    const plotMatch = r.plots?.some(p => 
        p.oldMapSheetNumber?.toLowerCase().includes(term) ||
        p.newMapSheetNumber?.toLowerCase().includes(term) ||
        p.oldPlotNumber?.toLowerCase().includes(term) ||
        p.newPlotNumber?.toLowerCase().includes(term)
    );
    const docMatch = r.blockingDocuments?.some(d => d.docNumber?.toLowerCase().includes(term));
    const certMatch = r.certNumber?.toLowerCase().includes(term) || r.issueNumber?.toLowerCase().includes(term);
    
    return ownersMatch || plotMatch || docMatch || certMatch;
  });

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
                 <p className="text-sm text-gray-500 font-medium">Quản lý các hồ sơ bị ngăn chặn, tranh chấp hoặc giải tỏa.</p>
            </div>
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Tìm kiếm..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-sm"
            />
          </div>
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
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 p-4">
            {filteredRecords.map(record => (
              <div key={record.id} className={`bg-white border rounded-xl overflow-hidden shadow-sm hover:shadow transition-shadow relative ${record.isUnblocked ? 'border-green-300' : 'border-red-200'}`}>
                {/* Header Card */}
                <div className={`px-4 py-3 border-b flex justify-between items-center ${record.isUnblocked ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
                  <div className="font-bold flex items-center gap-2 truncate text-sm">
                    {record.isUnblocked ? <CheckCircle size={16} /> : <ShieldAlert size={16} />}
                    {record.isUnblocked ? 'Đã giải tỏa' : 'Đang ngăn chặn'}
                  </div>
                  <div className="flex items-center gap-1">
                      <button onClick={() => { setEditingRecord(record); setShowForm(true); }} className="p-1.5 bg-white rounded shadow-sm text-gray-600 hover:text-blue-600 hover:bg-blue-50 transition-colors">
                          <Edit size={14} />
                      </button>
                      <button onClick={() => handleDelete(record.id)} className="p-1.5 bg-white rounded shadow-sm text-gray-600 hover:text-red-600 hover:bg-red-50 transition-colors">
                          <Trash2 size={14} />
                      </button>
                  </div>
                </div>
                
                {/* Body Card */}
                <div className="p-4 space-y-3">
                  {/* Owners */}
                  <div className="flex items-start gap-2">
                    <UserIcon size={16} className="text-gray-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs text-gray-500">Chủ sử dụng:</p>
                      <p className="font-bold text-gray-800 text-sm">{record.owners?.join(', ')}</p>
                    </div>
                  </div>

                  {/* Cert */}
                  <div className="flex items-start gap-2">
                    <FileText size={16} className="text-gray-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs text-gray-500">Giấy CNQSDĐ:</p>
                      <p className="font-medium text-gray-800 text-sm">
                        Số phát hành: {record.issueNumber || '(Trống)'} <br/>
                        Số vào sổ: {record.certNumber || '(Trống)'}
                      </p>
                    </div>
                  </div>

                   {/* Plots summary */}
                   <div className="flex items-start gap-2">
                    <MapPin size={16} className="text-gray-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs text-gray-500">Thông tin thửa đất:</p>
                      <p className="font-medium text-gray-800 text-sm">
                         {record.plots?.length || 0} thửa (Tại: {record.hamlet}, {record.oldCommune})
                      </p>
                    </div>
                  </div>

                  {/* Document summary */}
                  <div className="flex items-start gap-2">
                    <Calendar size={16} className="text-gray-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs text-gray-500">Văn bản ngăn chặn / Giải quyết:</p>
                      <ul className="list-disc pl-4 text-xs text-gray-800 mt-0.5 space-y-0.5">
                         {record.blockingDocuments?.map((d, idx) => (
                             <li key={idx}><span className="font-semibold">{d.docNumber}</span> ({d.agency})</li>
                         ))}
                      </ul>
                      {record.isUnblocked && record.unblockDoc && (
                          <div className="mt-1 text-xs text-green-700 font-medium">Giải tỏa bằng: {record.unblockDoc}</div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Footer Card */}
                <div className="bg-gray-50 px-4 py-2 border-t border-gray-100 text-[10px] text-gray-500 flex justify-between">
                    <span>Người nhập: <span className="font-medium">{record.createdBy}</span></span>
                    <span>{new Date(record.created_at || new Date()).toLocaleDateString('vi-VN')}</span>
                </div>
              </div>
            ))}
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
