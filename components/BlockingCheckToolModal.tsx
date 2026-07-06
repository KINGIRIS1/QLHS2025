import React, { useState, useEffect, useMemo } from 'react';
import { X, ShieldAlert, AlertTriangle, CheckCircle, FileText, Download, Loader2, Play, Filter, ArrowUpRight, RefreshCw, FileSpreadsheet, Search } from 'lucide-react';
import { RecordFile, LandRecord } from '../types';
import { fetchRecords } from '../services/apiRecords';
import { offlineDb } from '../utils/offlineDb';
import { showToast } from '../utils/appHelpers';
import * as XLSX from 'xlsx-js-style';

interface BlockingCheckToolModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface MatchedResult {
  recordFile: RecordFile;
  blockingRecord: LandRecord;
  source: 'active' | 'archive';
  matchType: 'plot' | 'owner' | 'both';
  matchedPlots: string[];
}

const BlockingCheckToolModal: React.FC<BlockingCheckToolModalProps> = ({ isOpen, onClose }) => {
  const [step, setStep] = useState<'idle' | 'running' | 'results'>('idle');
  const [loadingText, setLoadingText] = useState('');
  const [recordsCount, setRecordsCount] = useState({ received: 0, activeBlocking: 0, archiveBlocking: 0 });
  const [allMatches, setAllMatches] = useState<MatchedResult[]>([]);
  const [filterType, setFilterType] = useState<'all' | 'active' | 'plot' | 'owner' | 'both'>('all');
  const [searchText, setSearchText] = useState('');
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  const normalizeStr = (str: any) => {
    if (str === null || str === undefined) return '';
    return String(str)
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd');
  };

  const cleanCommuneName = (c: string) => {
    return c.replace(/^(xa|phuong|thi tran)\s+/gi, '').trim();
  };

  const matchTokensList = (str1: string, str2: string) => {
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

  const runCrossCheck = async () => {
    setStep('running');
    setProgress({ current: 0, total: 0 });
    try {
      // 1. Tải hồ sơ đo đạc
      setLoadingText('Đang tải danh sách hồ sơ đo đạc từ máy chủ...');
      const landRecords = await fetchRecords(true);

      // 2. Tải cơ sở dữ liệu ngăn chặn
      setLoadingText('Đang đọc dữ liệu ngăn chặn ngoại tuyến (IndexedDB)...');
      let activeBlockingList = await offlineDb.getRecords('blocking_records');
      let archiveBlockingList = await offlineDb.getRecords('archive_blocking_records');

      setRecordsCount({
        received: landRecords.length,
        activeBlocking: activeBlockingList.length,
        archiveBlocking: archiveBlockingList.length
      });

      const totalRecords = landRecords.length;
      setProgress({ current: 0, total: totalRecords });

      // 3. Tiến hành đối soát theo lô (Batching)
      const matches: MatchedResult[] = [];
      const BATCH_SIZE = 100;

      for (let i = 0; i < totalRecords; i += BATCH_SIZE) {
        const chunk = landRecords.slice(i, i + BATCH_SIZE);
        setLoadingText(`Đang đối soát: xử lý hồ sơ ${i.toLocaleString()} đến ${Math.min(i + BATCH_SIZE, totalRecords).toLocaleString()}...`);

        chunk.forEach(rec => {
          const wardNorm = normalizeStr(rec.ward);
          const plotNorm = normalizeStr(rec.landPlot);
          const sheetNorm = normalizeStr(rec.mapSheet);
          const fileCustomer = normalizeStr(rec.customerName);

          if (!wardNorm && !plotNorm && !fileCustomer) return;

          const cleanWard = cleanCommuneName(wardNorm);

          const performCheck = (blockingList: LandRecord[], source: 'active' | 'archive') => {
            blockingList.forEach(blocking => {
              const blockOldNorm = normalizeStr(blocking.oldCommune);
              const blockNewNorm = normalizeStr(blocking.newCommune);
              const cleanBlockOld = cleanCommuneName(blockOldNorm);
              const cleanBlockNew = cleanCommuneName(blockNewNorm);

              // Khớp xã/phường thông minh
              const isCommuneMatch = 
                (!cleanWard) || 
                (!cleanBlockOld && !cleanBlockNew) ||
                (cleanBlockOld && (cleanBlockOld === cleanWard || cleanBlockOld.includes(cleanWard) || cleanWard.includes(cleanBlockOld))) ||
                (cleanBlockNew && (cleanBlockNew === cleanWard || cleanBlockNew.includes(cleanWard) || cleanWard.includes(cleanBlockNew)));

              // 1. Đối soát Tờ/Thửa
              let isPlotMatch = false;
              const matchedPlotsArr: string[] = [];

              if (isCommuneMatch && plotNorm && blocking.plots && blocking.plots.length > 0) {
                isPlotMatch = blocking.plots.some(p => {
                  const oldPlotNorm = normalizeStr(p.oldPlotNumber);
                  const newPlotNorm = normalizeStr(p.newPlotNumber);
                  const oldSheetNorm = normalizeStr(p.oldMapSheetNumber);
                  const newSheetNorm = normalizeStr(p.newMapSheetNumber);

                  const plotMatches = matchTokensList(plotNorm, oldPlotNorm) || matchTokensList(plotNorm, newPlotNorm);

                  let sheetMatches = !sheetNorm;
                  if (!sheetMatches) {
                    const hasOldSheet = !!oldSheetNorm;
                    const hasNewSheet = !!newSheetNorm;
                    if (!hasOldSheet && !hasNewSheet) {
                      sheetMatches = true;
                    } else {
                      const oldMatch = hasOldSheet && matchTokensList(sheetNorm, oldSheetNorm);
                      const newMatch = hasNewSheet && matchTokensList(sheetNorm, newSheetNorm);
                      sheetMatches = oldMatch || newMatch;
                    }
                  }

                  if (plotMatches && sheetMatches) {
                    const plotDesc = `Tờ ${p.oldMapSheetNumber || p.newMapSheetNumber || '---'} / Thửa ${p.oldPlotNumber || p.newPlotNumber || '---'}`;
                    matchedPlotsArr.push(plotDesc);
                    return true;
                  }
                  return false;
                });
              }

              // 2. Đối soát Tên chủ sử dụng
              let isOwnerMatch = false;
              if (isCommuneMatch && fileCustomer && blocking.owners && blocking.owners.length > 0) {
                isOwnerMatch = blocking.owners.some(bo => {
                  const boNorm = normalizeStr(bo);
                  return boNorm && (fileCustomer === boNorm || fileCustomer.includes(boNorm) || boNorm.includes(fileCustomer));
                });
              }

              if (isPlotMatch || isOwnerMatch) {
                let matchType: 'plot' | 'owner' | 'both' = 'plot';
                if (isPlotMatch && isOwnerMatch) matchType = 'both';
                else if (isOwnerMatch) matchType = 'owner';

                matches.push({
                  recordFile: rec,
                  blockingRecord: blocking,
                  source,
                  matchType,
                  matchedPlots: matchedPlotsArr
                });
              }
            });
          };

          performCheck(activeBlockingList, 'active');
          performCheck(archiveBlockingList, 'archive');
        });

        const currentProcessed = Math.min(i + BATCH_SIZE, totalRecords);
        setProgress({ current: currentProcessed, total: totalRecords });
        
        // Yield to browser rendering loop
        await new Promise(resolve => setTimeout(resolve, 5));
      }

      setAllMatches(matches);
      setStep('results');
      showToast(`Đối soát hoàn tất! Phát hiện ${matches.length} trường hợp trùng khớp.`, 'success');
    } catch (e) {
      console.error(e);
      showToast('Lỗi khi thực hiện đối soát dữ liệu!', 'error');
      setStep('idle');
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'received': return 'Đã tiếp nhận';
      case 'assigned': return 'Đã phân công';
      case 'in_progress': return 'Đang thực hiện';
      case 'completed_work': return 'Đã thực hiện xong';
      case 'pending_sign': return 'Đang trình ký';
      case 'signed': return 'Đã ký duyệt';
      case 'handover': return 'Đã trả kết quả';
      default: return status;
    }
  };

  const filteredMatches = useMemo(() => {
    return allMatches.filter(m => {
      // 1. Loại lọc theo kiểu trùng hoặc tình trạng chặn
      if (filterType === 'active' && m.blockingRecord.isUnblocked) return false;
      if (filterType === 'plot' && m.matchType !== 'plot' && m.matchType !== 'both') return false;
      if (filterType === 'owner' && m.matchType !== 'owner' && m.matchType !== 'both') return false;
      if (filterType === 'both' && m.matchType !== 'both') return false;

      // 2. Lọc theo ô tìm kiếm
      if (searchText.trim()) {
        const search = normalizeStr(searchText);
        const code = normalizeStr(m.recordFile.code);
        const name = normalizeStr(m.recordFile.customerName);
        const ward = normalizeStr(m.recordFile.ward);
        const plot = normalizeStr(m.recordFile.landPlot);
        const sheet = normalizeStr(m.recordFile.mapSheet);
        const blockOwner = m.blockingRecord.owners.map(o => normalizeStr(o)).join(' ');

        return code.includes(search) || name.includes(search) || ward.includes(search) || plot.includes(search) || sheet.includes(search) || blockOwner.includes(search);
      }

      return true;
    });
  }, [allMatches, filterType, searchText]);

  const activeBlockedCount = useMemo(() => {
    return allMatches.filter(m => !m.blockingRecord.isUnblocked).length;
  }, [allMatches]);

  const resolvedBlockedCount = useMemo(() => {
    return allMatches.filter(m => m.blockingRecord.isUnblocked).length;
  }, [allMatches]);

  const exportToExcel = () => {
    if (filteredMatches.length === 0) {
      showToast('Không có dữ liệu trùng khớp để xuất!');
      return;
    }

    try {
      const exportData = filteredMatches.map((m, idx) => {
        const blockingDocStr = m.blockingRecord.blockingDocuments
          ?.map(doc => `Số ${doc.docNumber || '---'} (${doc.date || '---'}) [Cơ quan: ${doc.agency || '---'}]: ${doc.note || '---'}`)
          .join('\n') || 'Không có chi tiết';

        return {
          'STT': idx + 1,
          'Mã hồ sơ đo đạc': m.recordFile.code,
          'Chủ sử dụng (Hồ sơ)': m.recordFile.customerName,
          'Số tờ bản đồ': m.recordFile.mapSheet || '---',
          'Số thửa đất': m.recordFile.landPlot || '---',
          'Xã / Phường': m.recordFile.ward || '---',
          'Trạng thái hồ sơ': getStatusLabel(m.recordFile.status),
          'Kiểu trùng khớp': m.matchType === 'both' ? 'Trùng cả Tờ/Thửa và Tên Chủ' : m.matchType === 'plot' ? 'Trùng Tờ/Thửa đất' : 'Trùng Tên Chủ',
          'Chủ đất (Bản ghi ngăn chặn)': m.blockingRecord.owners.join(', '),
          'Tình trạng ngăn chặn': m.blockingRecord.isUnblocked ? 'ĐÃ GIẢI TỎA' : 'ĐANG NGĂN CHẶN',
          'Văn bản ngăn chặn gốc': blockingDocStr,
          'Văn bản giải tỏa (nếu có)': m.blockingRecord.isUnblocked ? `Số ${m.blockingRecord.unblockDoc || '---'} (${m.blockingRecord.unblockDate || '---'}): ${m.blockingRecord.unblockContent || '---'}` : '---',
          'Ghi chú ngăn chặn': m.blockingRecord.notes || '---'
        };
      });

      const ws = XLSX.utils.json_to_sheet(exportData);
      
      // Auto-fit columns
      const maxColWidths = [{ wch: 6 }];
      const keys = Object.keys(exportData[0]);
      keys.forEach((key, colIdx) => {
        if (colIdx === 0) return;
        let maxLen = key.length;
        exportData.forEach(row => {
          const val = row[key as keyof typeof row]?.toString() || '';
          if (val.length > maxLen) maxLen = val.length;
        });
        maxColWidths.push({ wch: Math.min(Math.max(maxLen + 3, 12), 40) });
      });
      ws['!cols'] = maxColWidths;

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Ket_Qua_Doi_Soat_Ngan_Chan');
      XLSX.writeFile(wb, `Bao_Cao_Doi_Soat_Ngan_Chan_${new Date().toISOString().slice(0, 10)}.xlsx`);
      showToast('Xuất báo cáo Excel đối soát thành công!', 'success');
    } catch (e) {
      console.error(e);
      showToast('Lỗi khi xuất tệp Excel!', 'error');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-65 flex items-center justify-center z-50 p-4 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden border border-gray-100 animate-scale-up">
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100 bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-100 p-2 rounded-lg text-indigo-600">
              <ShieldAlert size={24} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-800">CÔNG CỤ ĐỐI SOÁT HỒ SƠ ĐO ĐẠC & NGĂN CHẶN</h3>
              <p className="text-xs text-gray-500 font-medium">Đối soát tự động toàn bộ hồ sơ đo đạc trong hệ thống với cơ sở dữ liệu ngăn chặn</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 rounded-full p-1.5 hover:bg-gray-100 transition-all">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
          {step === 'idle' && (
            <div className="max-w-2xl mx-auto my-8 bg-white border border-gray-200 rounded-xl p-8 shadow-sm space-y-6">
              <div className="text-center space-y-2">
                <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4 border border-indigo-100">
                  <Play size={32} className="ml-1 animate-pulse" />
                </div>
                <h4 className="text-xl font-bold text-gray-800">Sẵn sàng chạy đối soát dữ liệu</h4>
                <p className="text-sm text-gray-500 leading-relaxed">
                  Hệ thống sẽ tải toàn bộ danh sách hồ sơ đo đạc đang thực hiện trực tuyến, đồng thời đối chiếu với các bản ghi ngăn chặn hiện hành & lịch sử lưu trữ dựa trên thông tin:
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-semibold text-gray-700">
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 flex flex-col items-center gap-2 text-center">
                  <span className="p-2 bg-indigo-50 text-indigo-600 rounded-md">🗺️</span>
                  <span>Tờ bản đồ / Thửa đất</span>
                  <span className="text-[10px] font-normal text-gray-500 leading-snug">Khớp thông minh số tờ mới/cũ, số thửa mới/cũ</span>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 flex flex-col items-center gap-2 text-center">
                  <span className="p-2 bg-indigo-50 text-indigo-600 rounded-md">👤</span>
                  <span>Tên chủ sử dụng</span>
                  <span className="text-[10px] font-normal text-gray-500 leading-snug">Đối soát từ đồng âm, đảo chữ và viết tắt</span>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 flex flex-col items-center gap-2 text-center">
                  <span className="p-2 bg-indigo-50 text-indigo-600 rounded-md">🏡</span>
                  <span>Địa bàn Xã / Phường</span>
                  <span className="text-[10px] font-normal text-gray-500 leading-snug">Phân loại khu vực xã phường để loại bỏ báo giả</span>
                </div>
              </div>

              <div className="border-t border-gray-100 pt-6 flex justify-center">
                <button
                  onClick={runCrossCheck}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-8 py-3 rounded-xl shadow-lg shadow-indigo-100 flex items-center gap-2 transition-all hover:scale-[1.02]"
                >
                  <Play size={18} fill="currentColor" /> Bắt đầu chạy đối soát
                </button>
              </div>
            </div>
          )}

          {step === 'running' && (
            <div className="max-w-md mx-auto my-16 text-center space-y-6 bg-white border border-slate-100 p-8 rounded-2xl shadow-sm">
              <div className="relative inline-flex items-center justify-center">
                <Loader2 size={56} className="animate-spin text-indigo-600 mx-auto" />
                {progress.total > 0 && (
                  <span className="absolute text-[11px] font-extrabold text-indigo-600">
                    {Math.round((progress.current / progress.total) * 100)}%
                  </span>
                )}
              </div>
              <div className="space-y-2">
                <h4 className="text-base font-extrabold text-gray-800">Đang phân tích đối soát dữ liệu...</h4>
                <p className="text-xs text-slate-500 font-mono font-medium min-h-[44px] bg-slate-50/50 p-2 rounded-lg border border-slate-100 flex items-center justify-center leading-relaxed">
                  {loadingText}
                </p>
                {progress.total > 0 && (
                  <div className="text-[11px] text-slate-500 flex justify-between px-1 mt-3">
                    <span>Đã quét: <span className="text-gray-800 font-bold">{progress.current.toLocaleString()}</span></span>
                    <span>Tổng số: <span className="text-gray-800 font-bold">{progress.total.toLocaleString()}</span></span>
                  </div>
                )}
              </div>
              <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden border border-slate-200/50 p-[1px]">
                <div 
                  className="bg-gradient-to-r from-indigo-500 to-indigo-600 h-full rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 15}%` }}
                ></div>
              </div>
            </div>
          )}

          {step === 'results' && (
            <div className="space-y-5">
              {/* Thống kê nhanh */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-xs">
                  <span className="text-xs font-bold text-gray-400 block uppercase tracking-wider mb-1">Hồ sơ đã phân tích</span>
                  <span className="text-2xl font-black text-gray-800">{recordsCount.received.toLocaleString()}</span>
                  <span className="text-[10px] text-gray-500 block mt-1">Tổng hồ sơ đo đạc & khác</span>
                </div>
                <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-xs">
                  <span className="text-xs font-bold text-red-500 block uppercase tracking-wider mb-1">Đang bị ngăn chặn</span>
                  <span className="text-2xl font-black text-red-600">{activeBlockedCount.toLocaleString()}</span>
                  <span className="text-[10px] text-red-500 block mt-1 font-semibold">CỰC KỲ NGUY HIỂM</span>
                </div>
                <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-xs">
                  <span className="text-xs font-bold text-amber-500 block uppercase tracking-wider mb-1">Trùng lịch sử giải tỏa</span>
                  <span className="text-2xl font-black text-amber-600">{resolvedBlockedCount.toLocaleString()}</span>
                  <span className="text-[10px] text-gray-500 block mt-1">Đã có quyết định giải tỏa</span>
                </div>
                <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-xs">
                  <span className="text-xs font-bold text-indigo-500 block uppercase tracking-wider mb-1">Tổng phát hiện</span>
                  <span className="text-2xl font-black text-indigo-600">{allMatches.length.toLocaleString()}</span>
                  <span className="text-[10px] text-gray-500 block mt-1">Có thể trùng tờ thửa hoặc chủ</span>
                </div>
              </div>

              {/* Bộ lọc kết quả */}
              <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-xs flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                  <button
                    onClick={() => setFilterType('all')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${filterType === 'all' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 text-gray-600 hover:bg-slate-200'}`}
                  >
                    Tất cả ({allMatches.length})
                  </button>
                  <button
                    onClick={() => setFilterType('active')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${filterType === 'active' ? 'bg-red-600 text-white shadow-sm' : 'bg-red-50 text-red-700 hover:bg-red-100'}`}
                  >
                    <ShieldAlert size={14} /> Chưa giải tỏa ({activeBlockedCount})
                  </button>
                  <button
                    onClick={() => setFilterType('plot')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${filterType === 'plot' ? 'bg-amber-600 text-white shadow-sm' : 'bg-amber-50 text-amber-700 hover:bg-amber-100'}`}
                  >
                    Trùng Tờ/Thửa
                  </button>
                  <button
                    onClick={() => setFilterType('owner')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${filterType === 'owner' ? 'bg-teal-600 text-white shadow-sm' : 'bg-teal-50 text-teal-700 hover:bg-teal-100'}`}
                  >
                    Trùng Chủ đất
                  </button>
                  <button
                    onClick={() => setFilterType('both')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${filterType === 'both' ? 'bg-blue-600 text-white shadow-sm' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'}`}
                  >
                    Trùng cả hai
                  </button>
                </div>

                <div className="flex gap-2 items-center w-full md:w-auto">
                  <div className="relative flex-1 md:w-64">
                    <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
                    <input
                      type="text"
                      placeholder="Tìm mã HS, tên chủ, tờ/thửa..."
                      value={searchText}
                      onChange={e => setSearchText(e.target.value)}
                      className="pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-xs w-full focus:ring-1 focus:ring-indigo-500 outline-none font-medium"
                    />
                  </div>
                  <button
                    onClick={exportToExcel}
                    className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-lg text-xs font-bold shadow-sm transition-all whitespace-nowrap"
                    title="Xuất báo cáo đối soát ra tệp Excel"
                  >
                    <FileSpreadsheet size={16} /> Xuất Excel
                  </button>
                </div>
              </div>

              {/* Danh sách kết quả */}
              {filteredMatches.length === 0 ? (
                <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
                  <div className="p-4 bg-green-50 text-green-600 rounded-full w-14 h-14 flex items-center justify-center mx-auto mb-3 border border-green-100">
                    <CheckCircle size={28} />
                  </div>
                  <h4 className="text-base font-bold text-gray-800">Tuyệt vời! Không phát hiện rủi ro</h4>
                  <p className="text-xs text-gray-400 max-w-sm mx-auto mt-1 leading-relaxed">
                    Không tìm thấy hồ sơ đo đạc nào trùng thông tin hoặc trùng chủ đất với cơ sở dữ liệu ngăn chặn đang hiển thị.
                  </p>
                </div>
              ) : (
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-xs">
                  <div className="overflow-x-auto max-h-[50vh]">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead className="bg-slate-50 sticky top-0 z-10 text-gray-600 uppercase tracking-wider font-bold border-b border-gray-100">
                        <tr>
                          <th className="p-3 w-10">STT</th>
                          <th className="p-3 w-36">Hồ sơ đo đạc</th>
                          <th className="p-3 w-44">Chủ SD / Tờ thửa (Hồ sơ)</th>
                          <th className="p-3 w-32">Kiểu trùng khớp</th>
                          <th className="p-3 w-48">Ngăn chặn phát hiện</th>
                          <th className="p-3">Chi tiết văn bản ngăn chặn</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 font-medium text-gray-700">
                        {filteredMatches.map((m, idx) => {
                          const isUnblocked = m.blockingRecord.isUnblocked;
                          return (
                            <tr key={idx} className={`hover:bg-slate-50/50 transition-colors ${!isUnblocked ? 'bg-red-50/15' : ''}`}>
                              <td className="p-3 text-center font-mono font-bold text-gray-400">{idx + 1}</td>
                              <td className="p-3 space-y-1">
                                <span className="font-mono font-bold text-blue-600 block bg-blue-50/50 px-2 py-0.5 rounded border border-blue-100/50 w-fit">{m.recordFile.code}</span>
                                <span className="text-[10px] text-gray-400 block font-normal">Ngày nhận: {m.recordFile.receivedDate || '---'}</span>
                                <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-bold w-fit block">{getStatusLabel(m.recordFile.status)}</span>
                              </td>
                              <td className="p-3 space-y-1">
                                <span className="font-bold text-gray-800 block">{m.recordFile.customerName}</span>
                                <span className="text-slate-500 font-normal text-[11px] block">
                                  📍 Tờ {m.recordFile.mapSheet || '---'} / Thửa {m.recordFile.landPlot || '---'}
                                </span>
                                <span className="text-slate-400 text-[10px] block font-normal">{m.recordFile.ward || '---'}</span>
                              </td>
                              <td className="p-3">
                                {m.matchType === 'both' && (
                                  <span className="bg-red-100 text-red-800 font-bold px-2 py-1 rounded-md text-[10px] border border-red-200 shadow-xs block w-fit">🔥 Trùng cả 2</span>
                                )}
                                {m.matchType === 'plot' && (
                                  <span className="bg-amber-100 text-amber-800 font-bold px-2 py-1 rounded-md text-[10px] border border-amber-200 block w-fit">🗺️ Trùng tờ/thửa</span>
                                )}
                                {m.matchType === 'owner' && (
                                  <span className="bg-teal-100 text-teal-800 font-bold px-2 py-1 rounded-md text-[10px] border border-teal-200 block w-fit">👤 Trùng tên chủ</span>
                                )}
                              </td>
                              <td className="p-3 space-y-1.5">
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border block w-fit ${!isUnblocked ? 'bg-red-100 text-red-800 border-red-200 animate-pulse' : 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                                  {!isUnblocked ? '🚫 ĐANG KHÓA' : '✅ ĐÃ GIẢI TỎA'}
                                </span>
                                <div className="text-slate-700 font-semibold text-[11px]">
                                  Chủ ngăn chặn: <span className="text-gray-800 font-bold block">{m.blockingRecord.owners.join(', ')}</span>
                                </div>
                                {m.matchedPlots.length > 0 && (
                                  <div className="text-[10px] text-indigo-600 bg-indigo-50/50 border border-indigo-100 rounded px-1.5 py-0.5 w-fit">
                                    Khớp: {m.matchedPlots.join(', ')}
                                  </div>
                                )}
                              </td>
                              <td className="p-3 space-y-1 font-normal text-[11px]">
                                {m.blockingRecord.blockingDocuments && m.blockingRecord.blockingDocuments.length > 0 ? (
                                  m.blockingRecord.blockingDocuments.map((doc, dIdx) => (
                                    <div key={dIdx} className="bg-slate-50 border border-slate-200/50 p-2 rounded text-slate-800">
                                      <p className="font-bold text-gray-800">📄 QĐ/Văn bản số: {doc.docNumber || '---'} ({doc.date || '---'})</p>
                                      <p className="text-slate-500 text-[10px] mt-0.5">Cơ quan: {doc.agency || '---'}</p>
                                      <p className="italic text-gray-700 mt-1 bg-white p-1 rounded border border-slate-100 text-[10px]">Nội dung: {doc.note || 'Không có chi tiết'}</p>
                                    </div>
                                  ))
                                ) : (
                                  <span className="text-slate-400 italic">Không có tài liệu chính thức</span>
                                )}

                                {isUnblocked && (
                                  <div className="bg-green-50 border border-green-200 text-green-800 p-2 rounded mt-1.5">
                                    <p className="font-bold">🔓 VB Giải tỏa: {m.blockingRecord.unblockDoc}</p>
                                    {m.blockingRecord.unblockContent && <p className="text-[10px] mt-0.5 italic text-slate-600 font-medium">Nội dung giải tỏa: {m.blockingRecord.unblockContent}</p>}
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 bg-slate-50 flex justify-between items-center">
          <div>
            {step === 'results' && (
              <button
                onClick={runCrossCheck}
                className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-bold transition-colors"
              >
                <RefreshCw size={14} /> Chạy lại đối soát
              </button>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-5 py-2 border border-gray-300 rounded-lg text-xs font-bold text-gray-700 hover:bg-white transition-colors"
            >
              {step === 'results' ? 'Đóng' : 'Hủy bỏ'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BlockingCheckToolModal;
