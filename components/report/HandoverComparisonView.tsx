import React, { useMemo, useState } from 'react';
import { RecordFile, RecordStatus, Employee } from '../../types';
import { getNormalizedWard, STATUS_LABELS } from '../../constants';
import * as XLSX from 'xlsx-js-style';
import { 
  FileSpreadsheet, 
  ListFilter, 
  Calendar, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  ArrowUpRight, 
  ArrowDownRight, 
  Search, 
  UserCheck, 
  MapPin, 
  ChevronLeft, 
  ChevronRight, 
  RotateCcw,
  Sparkles,
  TrendingUp,
  FileCheck2,
  CalendarDays
} from 'lucide-react';

interface HandoverComparisonViewProps {
  records: RecordFile[];
  employees: Employee[];
  wards: string[];
  fromDate: string;
  toDate: string;
}

export interface HandoverComparisonItem {
  record: RecordFile;
  employeeName: string;
  normalizedWard: string;
  handoverDateStr: string;
  deadlineStr: string;
  receivedDateStr: string;
  comparisonType: 'EARLY' | 'ON_TIME' | 'LATE' | 'NO_DEADLINE';
  daysDiff: number; // diff = handoverDate - deadlineDate
  daysEarly: number; // positive if early, 0 otherwise
  daysLate: number;  // positive if late, 0 otherwise
}

const HandoverComparisonView: React.FC<HandoverComparisonViewProps> = ({
  records,
  employees,
  wards,
  fromDate,
  toDate
}) => {
  // --- FILTER STATES ---
  const [localFromDate, setLocalFromDate] = useState<string>(fromDate);
  const [localToDate, setLocalToDate] = useState<string>(toDate);
  const [dateField, setDateField] = useState<'exportDate' | 'receivedDate' | 'deadline'>('exportDate');
  const [filterWard, setFilterWard] = useState<string>('all');
  const [filterEmployeeId, setFilterEmployeeId] = useState<string>('all');
  const [comparisonFilter, setComparisonFilter] = useState<'all' | 'early' | 'on_time' | 'late' | 'no_deadline'>('all');
  const [filterBatch, setFilterBatch] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // --- PAGINATION STATES ---
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(20);

  // Sync dates when parent props change
  React.useEffect(() => {
    setLocalFromDate(fromDate);
    setLocalToDate(toDate);
  }, [fromDate, toDate]);

  // Reset page when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [localFromDate, localToDate, dateField, filterWard, filterEmployeeId, comparisonFilter, filterBatch, searchQuery, itemsPerPage]);

  // Helper date parse
  const parseLocalDate = (dateStr?: string | null): Date | null => {
    if (!dateStr) return null;
    const clean = dateStr.split('T')[0];
    const parts = clean.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      return new Date(year, month, day, 0, 0, 0, 0);
    }
    return null;
  };

  const formatDateDisplay = (dateStr?: string | null): string => {
    if (!dateStr) return '-';
    const clean = dateStr.split('T')[0];
    const parts = clean.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  };

  // Extract all available export batches for filter dropdown
  const availableBatches = useMemo(() => {
    const batches = new Set<number>();
    records.forEach(r => {
      if (r.exportBatch) batches.add(r.exportBatch);
    });
    return Array.from(batches).sort((a, b) => a - b);
  }, [records]);

  // --- PROCESSED COMPARISON DATASET ---
  const comparisonList = useMemo<HandoverComparisonItem[]>(() => {
    const startDate = parseLocalDate(localFromDate);
    const endDate = parseLocalDate(localToDate);
    if (endDate) endDate.setHours(23, 59, 59, 999);

    const result: HandoverComparisonItem[] = [];

    records.forEach(r => {
      // Qualifying condition for Handed Over records
      const isHandover = r.status === RecordStatus.HANDOVER || 
                         r.status === RecordStatus.RETURNED || 
                         !!r.exportBatch || 
                         !!r.exportDate;

      if (!isHandover) return;

      // Determine date to check against time filter
      let checkDateStr: string | null | undefined = null;
      if (dateField === 'exportDate') {
        checkDateStr = r.exportDate || r.completedDate || r.approvalDate || r.workCompletedDate;
      } else if (dateField === 'receivedDate') {
        checkDateStr = r.receivedDate;
      } else {
        checkDateStr = r.deadline;
      }

      if (startDate || endDate) {
        if (!checkDateStr) return;
        const cDate = parseLocalDate(checkDateStr);
        if (!cDate) return;
        if (startDate && cDate < startDate) return;
        if (endDate && cDate > endDate) return;
      }

      // Ward filter
      if (filterWard !== 'all' && r.ward !== filterWard) return;

      // Employee filter
      if (filterEmployeeId !== 'all') {
        if (filterEmployeeId === 'unassigned') {
          if (r.assignedTo) return;
        } else {
          if (r.assignedTo !== filterEmployeeId) return;
        }
      }

      // Batch filter
      if (filterBatch !== 'all') {
        if (filterBatch === 'none') {
          if (r.exportBatch) return;
        } else {
          if (String(r.exportBatch) !== filterBatch) return;
        }
      }

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchCode = (r.code || '').toLowerCase().includes(q);
        const matchName = (r.customerName || '').toLowerCase().includes(q);
        const matchPlot = (r.landPlot || '').toLowerCase().includes(q);
        const matchSheet = (r.mapSheet || '').toLowerCase().includes(q);
        if (!matchCode && !matchName && !matchPlot && !matchSheet) return;
      }

      // Handover Date and Deadline Date for Comparison
      const handoverDateVal = r.exportDate || r.completedDate || r.approvalDate || r.workCompletedDate || r.assignedDate;
      const handoverDate = parseLocalDate(handoverDateVal);
      const deadlineDate = parseLocalDate(r.deadline);

      let compType: 'EARLY' | 'ON_TIME' | 'LATE' | 'NO_DEADLINE' = 'NO_DEADLINE';
      let daysDiff = 0;
      let daysEarly = 0;
      let daysLate = 0;

      if (handoverDate && deadlineDate) {
        const diffMs = handoverDate.getTime() - deadlineDate.getTime();
        daysDiff = Math.round(diffMs / (1000 * 60 * 60 * 24));

        if (daysDiff < 0) {
          compType = 'EARLY';
          daysEarly = Math.abs(daysDiff);
        } else if (daysDiff === 0) {
          compType = 'ON_TIME';
        } else {
          compType = 'LATE';
          daysLate = daysDiff;
        }
      }

      // Filter by comparison type
      if (comparisonFilter === 'early' && compType !== 'EARLY') return;
      if (comparisonFilter === 'on_time' && compType !== 'ON_TIME') return;
      if (comparisonFilter === 'late' && compType !== 'LATE') return;
      if (comparisonFilter === 'no_deadline' && compType !== 'NO_DEADLINE') return;

      const emp = employees.find(e => e.id === r.assignedTo);

      result.push({
        record: r,
        employeeName: emp ? emp.name : 'Chưa phân công',
        normalizedWard: getNormalizedWard(r.ward),
        handoverDateStr: formatDateDisplay(handoverDateVal),
        deadlineStr: formatDateDisplay(r.deadline),
        receivedDateStr: formatDateDisplay(r.receivedDate),
        comparisonType: compType,
        daysDiff,
        daysEarly,
        daysLate
      });
    });

    return result;
  }, [records, localFromDate, localToDate, dateField, filterWard, filterEmployeeId, comparisonFilter, filterBatch, searchQuery, employees]);

  // --- STATISTICAL METRICS ---
  const metrics = useMemo(() => {
    const total = comparisonList.length;
    let earlyCount = 0;
    let onTimeCount = 0;
    let lateCount = 0;
    let noDeadlineCount = 0;

    let totalDaysEarly = 0;
    let maxDaysEarly = 0;

    let totalDaysLate = 0;
    let maxDaysLate = 0;

    comparisonList.forEach(item => {
      if (item.comparisonType === 'EARLY') {
        earlyCount++;
        totalDaysEarly += item.daysEarly;
        if (item.daysEarly > maxDaysEarly) maxDaysEarly = item.daysEarly;
      } else if (item.comparisonType === 'ON_TIME') {
        onTimeCount++;
      } else if (item.comparisonType === 'LATE') {
        lateCount++;
        totalDaysLate += item.daysLate;
        if (item.daysLate > maxDaysLate) maxDaysLate = item.daysLate;
      } else {
        noDeadlineCount++;
      }
    });

    const earlyPct = total > 0 ? Math.round((earlyCount / total) * 100) : 0;
    const onTimePct = total > 0 ? Math.round((onTimeCount / total) * 100) : 0;
    const latePct = total > 0 ? Math.round((lateCount / total) * 100) : 0;

    const avgDaysEarly = earlyCount > 0 ? (totalDaysEarly / earlyCount).toFixed(1) : '0';
    const avgDaysLate = lateCount > 0 ? (totalDaysLate / lateCount).toFixed(1) : '0';

    const onTimeOrEarlyPct = total > 0 ? Math.round(((earlyCount + onTimeCount) / total) * 100) : 0;

    return {
      total,
      earlyCount,
      earlyPct,
      avgDaysEarly,
      maxDaysEarly,
      onTimeCount,
      onTimePct,
      lateCount,
      latePct,
      avgDaysLate,
      maxDaysLate,
      noDeadlineCount,
      onTimeOrEarlyPct
    };
  }, [comparisonList]);

  // --- PAGINATED LIST ---
  const totalPages = Math.ceil(comparisonList.length / itemsPerPage) || 1;
  const paginatedList = useMemo(() => {
    const startIdx = (currentPage - 1) * itemsPerPage;
    return comparisonList.slice(startIdx, startIdx + itemsPerPage);
  }, [comparisonList, currentPage, itemsPerPage]);

  // Quick Date Presets
  const applyQuickDate = (preset: 'all' | 'this_month' | 'last_month' | 'quarter' | 'year') => {
    const now = new Date();
    if (preset === 'all') {
      setLocalFromDate('');
      setLocalToDate('');
    } else if (preset === 'this_month') {
      const first = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const last = new Date().toISOString().split('T')[0];
      setLocalFromDate(first);
      setLocalToDate(last);
    } else if (preset === 'last_month') {
      const first = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
      const last = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];
      setLocalFromDate(first);
      setLocalToDate(last);
    } else if (preset === 'quarter') {
      const currentQuarter = Math.floor(now.getMonth() / 3);
      const first = new Date(now.getFullYear(), currentQuarter * 3, 1).toISOString().split('T')[0];
      const last = new Date().toISOString().split('T')[0];
      setLocalFromDate(first);
      setLocalToDate(last);
    } else if (preset === 'year') {
      const first = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
      const last = new Date().toISOString().split('T')[0];
      setLocalFromDate(first);
      setLocalToDate(last);
    }
  };

  // --- EXCEL EXPORT FUNCTION ---
  const exportToExcel = () => {
    const title = 'BÁO CÁO KIỂM SOÁT SO SÁNH HỒ SƠ ĐÃ GIAO 1 CỬA VỚI NGÀY HẸN TRẢ';
    const dateRangeStr = localFromDate || localToDate 
      ? `(Thời gian: Từ ${localFromDate ? formatDateDisplay(localFromDate) : 'tất cả'} Đến ${localToDate ? formatDateDisplay(localToDate) : 'hiện tại'})` 
      : '(Tất cả thời gian)';

    const wardText = filterWard === 'all' ? 'Tất cả xã/phường' : filterWard;
    const empText = filterEmployeeId === 'all' 
      ? 'Tất cả nhân viên' 
      : (employees.find(e => e.id === filterEmployeeId)?.name || 'Chưa phân công');

    const wb = XLSX.utils.book_new();

    const wsData: any[][] = [
      [title],
      [dateRangeStr],
      [`Đơn vị / Địa bàn: ${wardText} | Nhân viên phụ trách: ${empText}`],
      [],
      ['--- THỐNG KÊ TỔNG HỢP ---'],
      ['Tổng số hồ sơ đã giao 1 cửa:', metrics.total],
      ['Bàn giao trước hạn (Sớm hạn):', `${metrics.earlyCount} hồ sơ (${metrics.earlyPct}%) - Sớm TB: ${metrics.avgDaysEarly} ngày (Sớm nhất: ${metrics.maxDaysEarly} ngày)`],
      ['Bàn giao đúng ngày hẹn:', `${metrics.onTimeCount} hồ sơ (${metrics.onTimePct}%)`],
      ['Bàn giao sau hạn (Trễ hạn):', `${metrics.lateCount} hồ sơ (${metrics.latePct}%) - Trễ TB: ${metrics.avgDaysLate} ngày (Trễ nhất: ${metrics.maxDaysLate} ngày)`],
      ['Tỷ lệ đạt đúng & trước hạn:', `${metrics.onTimeOrEarlyPct}%`],
      [],
      [
        'STT', 
        'Mã hồ sơ', 
        'Chủ sử dụng đất', 
        'Xã / Phường', 
        'Tờ', 
        'Thửa', 
        'Ngày tiếp nhận', 
        'Ngày hẹn trả', 
        'Ngày bàn giao 1 cửa', 
        'Đợt xuất', 
        'Cán bộ phụ trách', 
        'Kết quả so sánh', 
        'Số ngày trước hạn (Sớm)', 
        'Số ngày sau hạn (Trễ)', 
        'Trạng thái hiện tại'
      ]
    ];

    comparisonList.forEach((item, idx) => {
      let compText = 'Chưa có ngày hẹn';
      if (item.comparisonType === 'EARLY') compText = `Sớm hạn (${item.daysEarly} ngày)`;
      else if (item.comparisonType === 'ON_TIME') compText = 'Đúng hạn (0 ngày)';
      else if (item.comparisonType === 'LATE') compText = `Trễ hạn (${item.daysLate} ngày)`;

      wsData.push([
        idx + 1,
        item.record.code || '',
        item.record.customerName || '',
        item.normalizedWard,
        item.record.mapSheet || '-',
        item.record.landPlot || '-',
        item.receivedDateStr,
        item.deadlineStr,
        item.handoverDateStr,
        item.record.exportBatch ? `Đợt ${item.record.exportBatch}` : '-',
        item.employeeName,
        compText,
        item.daysEarly > 0 ? item.daysEarly : '-',
        item.daysLate > 0 ? item.daysLate : '-',
        STATUS_LABELS[item.record.status] || item.record.status
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Apply basic widths
    const colWidths = [
      { wch: 6 },  // STT
      { wch: 18 }, // Mã HS
      { wch: 25 }, // Chủ SD
      { wch: 18 }, // Xã
      { wch: 8 },  // Tờ
      { wch: 8 },  // Thửa
      { wch: 14 }, // Ngày nhận
      { wch: 14 }, // Ngày hẹn
      { wch: 16 }, // Ngày giao
      { wch: 10 }, // Đợt
      { wch: 22 }, // Cán bộ
      { wch: 20 }, // Kết quả so sánh
      { wch: 22 }, // Số ngày trước hạn
      { wch: 20 }, // Số ngày sau hạn
      { wch: 18 }  // Trạng thái
    ];
    ws['!cols'] = colWidths;

    XLSX.utils.book_append_sheet(wb, ws, 'SoSanhHanTra1Cua');
    XLSX.writeFile(wb, `BaoCao_SoSanhHanTra_Giao1Cua_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="flex flex-col h-full bg-slate-100 overflow-hidden text-slate-800">
      
      {/* TOOLBAR & FILTERS */}
      <div className="bg-white p-4 border-b border-slate-200 shadow-sm shrink-0 space-y-3">
        
        {/* ROW 1: Title & Preset buttons & Export */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-indigo-100 text-indigo-700 rounded-xl">
              <FileCheck2 size={22} />
            </div>
            <div>
              <h2 className="font-bold text-slate-900 text-base flex items-center gap-2">
                Kiểm Soát & So Sánh Hạn Trả Hồ Sơ Giao 1 Cửa
                <span className="text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-full font-semibold">
                  {metrics.total} hồ sơ
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                Đối chiếu ngày bàn giao 1 cửa thực tế với ngày hẹn trả quy định
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 ml-auto">
            {/* Quick date presets */}
            <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs font-medium">
              <button 
                onClick={() => applyQuickDate('this_month')} 
                className="px-2.5 py-1 rounded hover:bg-white hover:text-indigo-600 transition-colors"
              >
                Tháng này
              </button>
              <button 
                onClick={() => applyQuickDate('last_month')} 
                className="px-2.5 py-1 rounded hover:bg-white hover:text-indigo-600 transition-colors"
              >
                Tháng trước
              </button>
              <button 
                onClick={() => applyQuickDate('quarter')} 
                className="px-2.5 py-1 rounded hover:bg-white hover:text-indigo-600 transition-colors"
              >
                Quý này
              </button>
              <button 
                onClick={() => applyQuickDate('all')} 
                className="px-2.5 py-1 rounded hover:bg-white hover:text-indigo-600 transition-colors"
              >
                Tất cả
              </button>
            </div>

            {/* Excel Export */}
            <button
              onClick={exportToExcel}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-1.5 rounded-lg font-bold text-xs shadow-sm transition-colors"
              title="Xuất báo cáo chi tiết ra tệp Excel"
            >
              <FileSpreadsheet size={16} /> Xuất Excel
            </button>
          </div>
        </div>

        {/* ROW 2: Filter Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-2.5 pt-1">
          
          {/* 1. Target Date Field */}
          <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs">
            <Calendar size={14} className="text-slate-400 mr-1 shrink-0" />
            <select
              value={dateField}
              onChange={(e) => setDateField(e.target.value as any)}
              className="bg-transparent font-medium outline-none text-slate-700 w-full cursor-pointer"
            >
              <option value="exportDate">Lọc theo: Ngày giao 1 cửa</option>
              <option value="receivedDate">Lọc theo: Ngày tiếp nhận</option>
              <option value="deadline">Lọc theo: Ngày hẹn trả</option>
            </select>
          </div>

          {/* 2. Date Range Picker */}
          <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs">
            <input 
              type="date" 
              value={localFromDate} 
              onChange={(e) => setLocalFromDate(e.target.value)}
              className="bg-transparent outline-none font-mono text-slate-700 w-full" 
            />
            <span className="text-slate-400 mx-1">➔</span>
            <input 
              type="date" 
              value={localToDate} 
              onChange={(e) => setLocalToDate(e.target.value)}
              className="bg-transparent outline-none font-mono text-slate-700 w-full" 
            />
          </div>

          {/* 3. Ward Filter */}
          <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs">
            <MapPin size={14} className="text-slate-400 mr-1 shrink-0" />
            <select
              value={filterWard}
              onChange={(e) => setFilterWard(e.target.value)}
              className="bg-transparent font-medium outline-none text-slate-700 w-full cursor-pointer"
            >
              <option value="all">Tất cả Xã / Phường</option>
              {wards.map(w => (
                <option key={w} value={w}>{w}</option>
              ))}
            </select>
          </div>

          {/* 4. Employee Filter */}
          <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs">
            <UserCheck size={14} className="text-slate-400 mr-1 shrink-0" />
            <select
              value={filterEmployeeId}
              onChange={(e) => setFilterEmployeeId(e.target.value)}
              className="bg-transparent font-medium outline-none text-slate-700 w-full cursor-pointer"
            >
              <option value="all">Tất cả Cán bộ</option>
              <option value="unassigned">Chưa phân công</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>{emp.name}</option>
              ))}
            </select>
          </div>

          {/* 5. Comparison Status Filter */}
          <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs">
            <ListFilter size={14} className="text-slate-400 mr-1 shrink-0" />
            <select
              value={comparisonFilter}
              onChange={(e) => setComparisonFilter(e.target.value as any)}
              className="bg-transparent font-semibold outline-none text-slate-700 w-full cursor-pointer"
            >
              <option value="all">Tất cả kết quả hạn</option>
              <option value="early">Sớm hạn (Trước ngày hẹn)</option>
              <option value="on_time">Đúng hạn (Đúng ngày hẹn)</option>
              <option value="late">Trễ hạn (Sau ngày hẹn)</option>
              <option value="no_deadline">Chưa có ngày hẹn</option>
            </select>
          </div>

          {/* 6. Batch Filter */}
          <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs">
            <select
              value={filterBatch}
              onChange={(e) => setFilterBatch(e.target.value)}
              className="bg-transparent font-medium outline-none text-slate-700 w-full cursor-pointer"
            >
              <option value="all">Tất cả đợt giao</option>
              {availableBatches.map(b => (
                <option key={b} value={String(b)}>Đợt {b}</option>
              ))}
            </select>
          </div>

        </div>

        {/* ROW 3: Search box */}
        <div className="relative pt-1">
          <Search size={14} className="absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm kiếm nhanh theo mã hồ sơ, tên chủ sử dụng đất, số tờ, số thửa..."
            className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-1.5 text-xs outline-none focus:border-indigo-500 focus:bg-white transition-all placeholder:text-slate-400"
          />
        </div>

      </div>

      {/* SUMMARY STAT CARDS */}
      <div className="p-4 grid grid-cols-2 md:grid-cols-5 gap-3 shrink-0">
        
        {/* CARD 1: TOTAL */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg shrink-0">
            <ListFilter size={20} />
          </div>
          <div>
            <div className="text-xl font-bold text-slate-900">{metrics.total}</div>
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-tight">
              Đã giao 1 cửa
            </div>
          </div>
        </div>

        {/* CARD 2: EARLY (SỚM HẠN) */}
        <div className="bg-white p-3.5 rounded-xl border border-emerald-200 shadow-xs flex items-center gap-3">
          <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-lg shrink-0">
            <ArrowDownRight size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline justify-between">
              <span className="text-xl font-bold text-emerald-700">{metrics.earlyCount}</span>
              <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                {metrics.earlyPct}%
              </span>
            </div>
            <div className="text-[11px] font-bold text-emerald-800 uppercase tracking-tight">
              Bàn giao Sớm hạn
            </div>
            <div className="text-[10px] text-emerald-600 font-medium truncate mt-0.5">
              Sớm TB: <strong>{metrics.avgDaysEarly}</strong> ngày (Max: {metrics.maxDaysEarly})
            </div>
          </div>
        </div>

        {/* CARD 3: ON TIME (ĐÚNG HẠN) */}
        <div className="bg-white p-3.5 rounded-xl border border-teal-200 shadow-xs flex items-center gap-3">
          <div className="p-2.5 bg-teal-50 text-teal-600 rounded-lg shrink-0">
            <CheckCircle2 size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline justify-between">
              <span className="text-xl font-bold text-teal-700">{metrics.onTimeCount}</span>
              <span className="text-xs font-bold text-teal-600 bg-teal-50 px-1.5 py-0.5 rounded">
                {metrics.onTimePct}%
              </span>
            </div>
            <div className="text-[11px] font-bold text-teal-800 uppercase tracking-tight">
              Đúng ngày hẹn trả
            </div>
            <div className="text-[10px] text-teal-600 font-medium truncate mt-0.5">
              Bàn giao đúng hạn 100%
            </div>
          </div>
        </div>

        {/* CARD 4: LATE (TRỄ HẠN) */}
        <div className="bg-white p-3.5 rounded-xl border border-rose-200 shadow-xs flex items-center gap-3">
          <div className="p-2.5 bg-rose-50 text-rose-600 rounded-lg shrink-0">
            <ArrowUpRight size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline justify-between">
              <span className="text-xl font-bold text-rose-700">{metrics.lateCount}</span>
              <span className="text-xs font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded">
                {metrics.latePct}%
              </span>
            </div>
            <div className="text-[11px] font-bold text-rose-800 uppercase tracking-tight">
              Bàn giao Trễ hạn
            </div>
            <div className="text-[10px] text-rose-600 font-medium truncate mt-0.5">
              Trễ TB: <strong>{metrics.avgDaysLate}</strong> ngày (Max: {metrics.maxDaysLate})
            </div>
          </div>
        </div>

        {/* CARD 5: COMPLIANCE METER */}
        <div className="bg-white p-3.5 rounded-xl border border-indigo-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs font-bold text-indigo-950 mb-1">
              <span>Đạt Đúng/Trước Hạn</span>
              <span className="text-indigo-700">{metrics.onTimeOrEarlyPct}%</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden flex">
              <div 
                className="bg-emerald-500 h-full transition-all duration-500" 
                style={{ width: `${metrics.earlyPct}%` }}
                title={`Sớm: ${metrics.earlyPct}%`}
              />
              <div 
                className="bg-teal-500 h-full transition-all duration-500" 
                style={{ width: `${metrics.onTimePct}%` }}
                title={`Đúng hạn: ${metrics.onTimePct}%`}
              />
              <div 
                className="bg-rose-500 h-full transition-all duration-500" 
                style={{ width: `${metrics.latePct}%` }}
                title={`Trễ: ${metrics.latePct}%`}
              />
            </div>
          </div>
          <div className="text-[10px] text-slate-500 mt-1 flex justify-between">
            <span className="text-emerald-600 font-semibold">Sớm: {metrics.earlyCount}</span>
            <span className="text-teal-600 font-semibold">Đúng: {metrics.onTimeCount}</span>
            <span className="text-rose-600 font-semibold">Trễ: {metrics.lateCount}</span>
          </div>
        </div>

      </div>

      {/* TABLE DATA AREA */}
      <div className="flex-1 px-4 pb-4 overflow-hidden flex flex-col min-h-0">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex-1 flex flex-col overflow-hidden">
          
          <div className="flex-1 overflow-auto custom-scrollbar">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 text-slate-600 uppercase font-bold sticky top-0 shadow-xs z-10 border-b border-slate-200">
                <tr>
                  <th className="p-2.5 w-10 text-center">STT</th>
                  <th className="p-2.5 w-28">Mã HS</th>
                  <th className="p-2.5 min-w-[160px]">Chủ sử dụng đất</th>
                  <th className="p-2.5 w-32">Xã / Phường</th>
                  <th className="p-2.5 w-20 text-center">Tờ / Thửa</th>
                  <th className="p-2.5 w-24">Ngày nhận</th>
                  <th className="p-2.5 w-24">Hẹn trả 1 cửa</th>
                  <th className="p-2.5 w-28">Ngày bàn giao</th>
                  <th className="p-2.5 w-36">Cán bộ phụ trách</th>
                  <th className="p-2.5 w-36 text-center">Kết quả so sánh</th>
                  <th className="p-2.5 w-24 text-center">Trước hạn</th>
                  <th className="p-2.5 w-24 text-center">Sau hạn</th>
                  <th className="p-2.5 w-28 text-center">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {paginatedList.length > 0 ? (
                  paginatedList.map((item, idx) => {
                    const rowNum = (currentPage - 1) * itemsPerPage + idx + 1;
                    
                    return (
                      <tr 
                        key={item.record.id} 
                        className={`hover:bg-indigo-50/40 transition-colors ${
                          item.comparisonType === 'LATE' ? 'bg-rose-50/20' : ''
                        }`}
                      >
                        <td className="p-2.5 text-center text-slate-400 font-mono">{rowNum}</td>
                        <td className="p-2.5 font-bold font-mono text-indigo-700">{item.record.code}</td>
                        <td className="p-2.5 font-semibold text-slate-800">{item.record.customerName}</td>
                        <td className="p-2.5 text-slate-600">{item.normalizedWard}</td>
                        <td className="p-2.5 text-center text-slate-600 font-mono">
                          {item.record.mapSheet || '-'}/{item.record.landPlot || '-'}
                        </td>
                        <td className="p-2.5 font-mono text-slate-600">{item.receivedDateStr}</td>
                        <td className="p-2.5 font-mono font-semibold text-slate-700">{item.deadlineStr}</td>
                        <td className="p-2.5 font-mono font-semibold text-indigo-900">
                          {item.handoverDateStr}
                          {item.record.exportBatch ? (
                            <span className="ml-1 text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1 py-0.2 rounded border border-indigo-100">
                              Đợt {item.record.exportBatch}
                            </span>
                          ) : null}
                        </td>
                        <td className="p-2.5 text-slate-700">{item.employeeName}</td>
                        
                        {/* Comparison Result Badge */}
                        <td className="p-2.5 text-center">
                          {item.comparisonType === 'EARLY' && (
                            <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded-full text-[11px] font-bold">
                              <ArrowDownRight size={12} /> Sớm {item.daysEarly} ngày
                            </span>
                          )}
                          {item.comparisonType === 'ON_TIME' && (
                            <span className="inline-flex items-center gap-1 bg-teal-100 text-teal-800 border border-teal-300 px-2 py-0.5 rounded-full text-[11px] font-bold">
                              <CheckCircle2 size={12} /> Đúng ngày hẹn
                            </span>
                          )}
                          {item.comparisonType === 'LATE' && (
                            <span className="inline-flex items-center gap-1 bg-rose-100 text-rose-800 border border-rose-300 px-2 py-0.5 rounded-full text-[11px] font-bold">
                              <ArrowUpRight size={12} /> Trễ {item.daysLate} ngày
                            </span>
                          )}
                          {item.comparisonType === 'NO_DEADLINE' && (
                            <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-500 border border-slate-200 px-2 py-0.5 rounded-full text-[11px]">
                              Chưa có hẹn
                            </span>
                          )}
                        </td>

                        {/* Days Early Column */}
                        <td className="p-2.5 text-center font-mono font-bold text-emerald-600">
                          {item.daysEarly > 0 ? `${item.daysEarly} ngày` : '-'}
                        </td>

                        {/* Days Late Column */}
                        <td className="p-2.5 text-center font-mono font-bold text-rose-600">
                          {item.daysLate > 0 ? `${item.daysLate} ngày` : '-'}
                        </td>

                        {/* Current Status */}
                        <td className="p-2.5 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            item.record.status === RecordStatus.RETURNED 
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                              : 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                          }`}>
                            {STATUS_LABELS[item.record.status] || item.record.status}
                          </span>
                        </td>

                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={13} className="p-8 text-center text-slate-400">
                      Không tìm thấy hồ sơ nào khớp với bộ lọc kiểm soát.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* PAGINATION BAR */}
          <div className="bg-slate-50 p-2.5 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
            
            {/* Page Size & Counter */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-slate-600">
                <span>Hiển thị</span>
                <select
                  value={itemsPerPage}
                  onChange={(e) => setItemsPerPage(Number(e.target.value))}
                  className="bg-white border border-slate-300 rounded px-2 py-1 text-xs font-bold text-slate-700 outline-none"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
                <span>dòng / trang</span>
              </div>

              <div className="text-slate-500 font-medium">
                {comparisonList.length > 0 ? (
                  <>
                    Từ <strong>{(currentPage - 1) * itemsPerPage + 1}</strong> - <strong>{Math.min(currentPage * itemsPerPage, comparisonList.length)}</strong> trên tổng số <strong>{comparisonList.length}</strong> hồ sơ
                  </>
                ) : (
                  '0 hồ sơ'
                )}
              </div>
            </div>

            {/* Page Controls */}
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="px-2 py-1 rounded bg-white border border-slate-300 text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white font-medium"
                  title="Trang đầu"
                >
                  «
                </button>
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="px-2.5 py-1 rounded bg-white border border-slate-300 text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white font-medium flex items-center gap-1"
                >
                  <ChevronLeft size={14} /> Trước
                </button>

                <div className="px-3 py-1 font-bold text-slate-700 bg-indigo-50 border border-indigo-200 rounded">
                  Trang {currentPage} / {totalPages}
                </div>

                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="px-2.5 py-1 rounded bg-white border border-slate-300 text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white font-medium flex items-center gap-1"
                >
                  Sau <ChevronRight size={14} />
                </button>
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className="px-2 py-1 rounded bg-white border border-slate-300 text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white font-medium"
                  title="Trang cuối"
                >
                  »
                </button>
              </div>
            )}

          </div>

        </div>
      </div>

    </div>
  );
};

export default HandoverComparisonView;
