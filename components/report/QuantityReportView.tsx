import React, { useState, useMemo } from "react";
import { RecordFile, Employee, WorkSchedule, RecordStatus } from "../../types";
import { exportTeamWeeklyReportToWord } from "../../utils/exportTeamWeeklyReport";
import { 
  Download, Printer, Calendar, Users, MapPin, 
  BarChart3, CheckCircle2, Clock, ListFilter, ClipboardCheck, 
  CalendarDays, Eye, FileText, ChevronRight, FileSpreadsheet
} from "lucide-react";
import { getShortRecordType, getNormalizedWard } from "../../constants";

interface QuantityReportViewProps {
  records: RecordFile[];
  employees: Employee[];
  schedules: WorkSchedule[];
  fromDate: string;
  toDate: string;
}

function removeVietnameseTones(str: string): string {
  if (!str) return "";
  str = str.toLowerCase();
  str = str.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, "a");
  str = str.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, "e");
  str = str.replace(/ì|í|ị|ỉ|ĩ/g, "i");
  str = str.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ợ|ở|ỡ/g, "o");
  str = str.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, "u");
  str = str.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, "y");
  str = str.replace(/đ/g, "d");
  str = str.replace(/ + /g, " ");
  str = str.trim();
  return str;
}

function groupSchedulesByLocation(schedulesList: WorkSchedule[]): [string, WorkSchedule[]][] {
  const groups: Record<string, WorkSchedule[]> = {};

  schedulesList.forEach(s => {
    let rawLoc = (s.location || '').trim();
    let locName = 'Địa bàn khác / Chưa chọn';

    if (rawLoc) {
      const lower = rawLoc.toLowerCase();
      if (lower.includes('minh hưng')) {
        locName = 'Phường Minh Hưng';
      } else if (lower.includes('chơn thành')) {
        locName = 'Phường Chơn Thành';
      } else if (lower.includes('nha bích')) {
        locName = 'Xã Nha Bích';
      } else {
        locName = rawLoc;
      }
    }

    if (!groups[locName]) {
      groups[locName] = [];
    }
    groups[locName].push(s);
  });

  const priorityOrder = ['Phường Minh Hưng', 'Phường Chơn Thành', 'Xã Nha Bích'];

  return Object.entries(groups).sort(([aKey], [bKey]) => {
    const idxA = priorityOrder.indexOf(aKey);
    const idxB = priorityOrder.indexOf(bKey);
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return aKey.localeCompare(bKey, 'vi');
  });
}

const QuantityReportView: React.FC<QuantityReportViewProps> = ({
  records,
  employees,
  schedules,
  fromDate,
  toDate,
}) => {
  // Bộ lọc thời gian độc lập
  const [dateMode, setDateMode] = useState<'week' | 'month' | 'custom'>('custom');
  const [customFromDate, setCustomFromDate] = useState(fromDate);
  const [customToDate, setCustomToDate] = useState(toDate);

  // Tính toán dải ngày hiệu lực
  const effectiveDates = useMemo(() => {
    const now = new Date();
    let start: Date;
    let end: Date;

    const parseWithFallback = (val: string, fallbackVal: string): Date => {
      if (!val) {
        const fb = new Date(fallbackVal);
        return isNaN(fb.getTime()) ? new Date() : fb;
      }
      const parsed = new Date(val);
      if (isNaN(parsed.getTime())) {
        const fb = new Date(fallbackVal);
        return isNaN(fb.getTime()) ? new Date() : fb;
      }
      return parsed;
    };

    if (dateMode === 'week') {
      const currentDay = now.getDay();
      const diffToMon = now.getDate() - currentDay + (currentDay === 0 ? -6 : 1);
      start = new Date(now.getFullYear(), now.getMonth(), diffToMon, 0, 0, 0, 0);
      end = new Date(start);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
    } else if (dateMode === 'month') {
      start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    } else {
      start = parseWithFallback(customFromDate, fromDate);
      start.setHours(0, 0, 0, 0);
      end = parseWithFallback(customToDate, toDate);
      end.setHours(23, 59, 59, 999);
    }

    if (isNaN(start.getTime())) start = new Date();
    if (isNaN(end.getTime())) end = new Date();

    return {
      start,
      end,
      fromDateStr: start.toISOString().split('T')[0],
      toDateStr: end.toISOString().split('T')[0],
    };
  }, [dateMode, customFromDate, customToDate, fromDate, toDate]);

  // Xử lý dữ liệu báo cáo số lượng
  const reportData = useMemo(() => {
    const { start, end, fromDateStr, toDateStr } = effectiveDates;

    // Lọc hồ sơ tiếp nhận trong kỳ
    const receivedRecords = records.filter(r => {
      if (!r.receivedDate) return false;
      const d = new Date(r.receivedDate);
      return d >= start && d <= end;
    });

    // Hồ sơ hoàn thành trong kỳ
    const isCompletedStatus = (status: RecordStatus) => 
      [RecordStatus.SIGNED, RecordStatus.HANDOVER, RecordStatus.RETURNED].includes(status);
    
    const completedRecords = receivedRecords.filter(r => isCompletedStatus(r.status));

    // Thống kê số thửa đất
    const getPlotCount = (r: RecordFile): number => {
      const isNonPlot = ['Sao lục', 'Công văn'].includes(r.recordType || '');
      const defaultVal = isNonPlot ? 0 : 1;
      const parsed = r.plotCount !== undefined && r.plotCount !== null && String(r.plotCount).trim() !== ''
        ? Number(r.plotCount)
        : defaultVal;
      return isNaN(parsed) ? defaultVal : parsed;
    };
    const totalReceivedPlots = receivedRecords.reduce((sum, r) => sum + getPlotCount(r), 0);
    const totalCompletedPlots = completedRecords.reduce((sum, r) => sum + getPlotCount(r), 0);

    // Lịch trình công tác trong kỳ
    const periodSchedules = schedules.filter(s => {
      const sd = new Date(s.date);
      return sd >= start && sd <= end;
    });

    // Phân loại hồ sơ nhận
    const receivedTypes: Record<string, number> = {};
    receivedRecords.forEach(r => {
      const t = getShortRecordType(r.recordType || "") || "Khác";
      receivedTypes[t] = (receivedTypes[t] || 0) + 1;
    });

    // Phân loại hồ sơ hoàn thành
    const completedTypes: Record<string, number> = {};
    completedRecords.forEach(r => {
      const t = getShortRecordType(r.recordType || "") || "Khác";
      completedTypes[t] = (completedTypes[t] || 0) + 1;
    });

    // Phân bổ hồ sơ nhận theo phường xã
    const receivedByWard: Record<string, { total: number; plots: number; types: Record<string, number> }> = {};
    receivedRecords.forEach(r => {
      const w = getNormalizedWard(r.ward) || "Khác";
      if (!receivedByWard[w]) receivedByWard[w] = { total: 0, plots: 0, types: {} };
      receivedByWard[w].total += 1;
      receivedByWard[w].plots += getPlotCount(r);
      const t = getShortRecordType(r.recordType || "") || "Khác";
      receivedByWard[w].types[t] = (receivedByWard[w].types[t] || 0) + 1;
    });

    // Phân bổ hồ sơ hoàn thành theo phường xã
    const completedByWard: Record<string, { total: number; plots: number; types: Record<string, number> }> = {};
    completedRecords.forEach(r => {
      const w = getNormalizedWard(r.ward) || "Khác";
      if (!completedByWard[w]) completedByWard[w] = { total: 0, plots: 0, types: {} };
      completedByWard[w].total += 1;
      completedByWard[w].plots += getPlotCount(r);
      const t = getShortRecordType(r.recordType || "") || "Khác";
      completedByWard[w].types[t] = (completedByWard[w].types[t] || 0) + 1;
    });

    // Phân bổ hồ sơ giao cho nhân viên
    const employeesStats = employees.map(emp => {
      const empReceived = receivedRecords.filter(r => r.assignedTo === emp.id);
      const empCompleted = completedRecords.filter(r => r.assignedTo === emp.id);
      const empSchedules = periodSchedules.filter(s => {
        if (!s.executors) return false;
        const execStr = removeVietnameseTones(s.executors);
        const nameTones = removeVietnameseTones(emp.name);
        return execStr.includes(nameTones);
      });

      return {
        employee: emp,
        receivedCount: empReceived.length,
        receivedPlots: empReceived.reduce((sum, r) => sum + getPlotCount(r), 0),
        completedCount: empCompleted.length,
        completedPlots: empCompleted.reduce((sum, r) => sum + getPlotCount(r), 0),
        schedulesCount: empSchedules.length,
        schedulesList: empSchedules,
      };
    }).filter(e => e.receivedCount > 0 || e.completedCount > 0 || e.schedulesCount > 0);

    return {
      fromDateStr,
      toDateStr,
      totalReceived: receivedRecords.length,
      totalReceivedPlots,
      totalCompleted: completedRecords.length,
      totalCompletedPlots,
      totalSchedules: periodSchedules.length,
      receivedTypes,
      completedTypes,
      receivedByWard,
      completedByWard,
      employeesStats,
      periodSchedules
    };
  }, [records, employees, schedules, effectiveDates]);

  // In báo cáo qua iframe ẩn
  const printReportContent = (title: string, innerHtml: string) => {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.left = '-9999px';
    iframe.style.top = '-9999px';
    iframe.style.width = '1024px';
    iframe.style.height = '1420px';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(`
        <html>
        <head>
          <title>${title}</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
            * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            @page { size: A4 portrait; margin: 1.2cm 1cm; }
            body { font-family: 'Inter', system-ui, sans-serif; color: #1e293b; background: white !important; margin: 0; padding: 0; }
            table { border-collapse: collapse !important; width: 100% !important; }
            th, td { border: 1px solid #e2e8f0 !important; padding: 8px 12px !important; }
            th { background-color: #f8fafc !important; }
            tr, .bg-white, li, .rounded-2xl { page-break-inside: avoid; break-inside: avoid; }
          </style>
        </head>
        <body class="bg-white p-4">
          <div class="w-full max-w-4xl mx-auto space-y-6">
            ${innerHtml}
          </div>
        </body>
        </html>
      `);
      doc.close();
      
      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        document.body.removeChild(iframe);
      }, 1000);
    }
  };

  // Tải file PDF
  const downloadPDFReport = (title: string, innerHtml: string) => {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.left = '-9999px';
    iframe.style.top = '-9999px';
    iframe.style.width = '1024px';
    iframe.style.height = '1420px';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(`
        <html>
        <head>
          <title>${title}</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
            * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            body { font-family: 'Inter', system-ui, sans-serif; color: #1e293b; background: white !important; margin: 0; padding: 24px; }
            table { border-collapse: collapse !important; width: 100% !important; margin: 15px 0 !important; }
            th, td { border: 1px solid #cbd5e1 !important; padding: 8px 12px !important; text-align: left; }
            th { background-color: #f1f5f9 !important; color: #1e293b !important; font-weight: bold !important; }
            tr, .bg-white, li, .rounded-2xl { page-break-inside: avoid !important; break-inside: avoid !important; }
          </style>
        </head>
        <body class="bg-white p-4">
          <div class="w-full max-w-4xl mx-auto space-y-6">
            ${innerHtml}
          </div>
        </body>
        </html>
      `);
      doc.close();

      const runExport = () => {
        const html2pdf = (window as any).html2pdf;
        if (!html2pdf) {
          setTimeout(runExport, 300);
          return;
        }

        const opt = {
          margin:       [10, 10, 10, 10], 
          filename:     `${title}.pdf`,
          image:        { type: 'jpeg', quality: 0.98 },
          html2canvas:  { scale: 2, useCORS: true, letterRendering: true, scrollY: 0, scrollX: 0 },
          jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        setTimeout(() => {
          const contentElement = iframe.contentWindow?.document.body;
          if (contentElement) {
            html2pdf().set(opt).from(contentElement).save().then(() => {
              document.body.removeChild(iframe);
            }).catch((err: any) => {
              console.error("Lỗi xuất PDF: ", err);
              document.body.removeChild(iframe);
              printReportContent(title, innerHtml);
            });
          } else {
            document.body.removeChild(iframe);
            printReportContent(title, innerHtml);
          }
        }, 1500);
      };

      if (!(window as any).html2pdf) {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
        script.async = true;
        script.onload = runExport;
        document.head.appendChild(script);
      } else {
        runExport();
      }
    }
  };

  const handleExportWord = () => {
    exportTeamWeeklyReportToWord(reportData, effectiveDates.fromDateStr, effectiveDates.toDateStr);
  };

  return (
    <div className="h-full bg-slate-50 w-full overflow-y-auto custom-scrollbar p-6 animate-fade-in flex flex-col space-y-6">
      
      {/* HEADER & FILTER BAR */}
      <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shrink-0">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-violet-700">
            <ListFilter size={20} className="stroke-[2.5]" />
            <span className="text-xs uppercase font-extrabold tracking-wider">Báo cáo nghiệp vụ</span>
          </div>
          <h2 className="text-xl font-black text-slate-800">Báo cáo số lượng hồ sơ</h2>
          <p className="text-xs text-slate-500 font-medium">
            Thống kê định lượng hồ sơ tiếp nhận mới và hồ sơ hoàn thành theo mốc thời gian tiếp nhận
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => {
              const printArea = document.getElementById("quantity_report_visual_area")?.innerHTML;
              if (printArea) printReportContent("Báo cáo Số lượng Hồ sơ tiếp nhận và hoàn thành", printArea);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 rounded-xl text-xs font-bold transition-all shadow-xs border border-slate-250"
          >
            <Printer size={15} /> In Báo cáo
          </button>
          <button
            onClick={() => {
              const printArea = document.getElementById("quantity_report_visual_area")?.innerHTML;
              if (printArea) downloadPDFReport("Báo cáo Số lượng Hồ sơ tiếp nhận và hoàn thành", printArea);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-red-600 hover:bg-red-700 active:scale-95 text-white rounded-xl text-xs font-bold transition-all shadow-xs"
          >
            <Download size={15} /> Tải PDF
          </button>
          <button
            onClick={handleExportWord}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-xl text-xs font-bold transition-all shadow-xs"
          >
            <FileSpreadsheet size={15} /> Xuất Word
          </button>
        </div>
      </div>

      {/* FILTER CONTROLS */}
      <div className="bg-white border border-slate-200 rounded-2xl px-5 py-3.5 flex flex-wrap items-center justify-between gap-4 shrink-0 shadow-xs">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
          <CalendarDays size={16} className="text-violet-600" />
          <span>Kỳ thống kê:</span>
          <div className="flex bg-slate-100 p-1 rounded-xl ml-2 border border-slate-200">
            <button
              onClick={() => setDateMode('week')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${dateMode === 'week' ? 'bg-white text-violet-700 shadow-xs' : 'text-slate-600 hover:text-slate-800'}`}
            >
              Tuần này
            </button>
            <button
              onClick={() => setDateMode('month')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${dateMode === 'month' ? 'bg-white text-violet-700 shadow-xs' : 'text-slate-600 hover:text-slate-800'}`}
            >
              Tháng này
            </button>
            <button
              onClick={() => setDateMode('custom')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${dateMode === 'custom' ? 'bg-white text-violet-700 shadow-xs' : 'text-slate-600 hover:text-slate-800'}`}
            >
              Tùy chọn
            </button>
          </div>
        </div>

        {dateMode === 'custom' ? (
          <div className="flex items-center gap-2 animate-fade-in">
            <span className="text-xs text-slate-500 font-medium">Từ ngày</span>
            <input
              type="date"
              value={customFromDate}
              onChange={(e) => setCustomFromDate(e.target.value)}
              className="border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-700 font-semibold focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white shadow-xs"
            />
            <span className="text-xs text-slate-500 font-medium">Đến ngày</span>
            <input
              type="date"
              value={customToDate}
              onChange={(e) => setCustomToDate(e.target.value)}
              className="border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-700 font-semibold focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white shadow-xs"
            />
          </div>
        ) : (
          <div className="text-xs font-bold text-violet-700 bg-violet-50 px-3 py-1.5 rounded-xl border border-violet-200">
            Từ {new Date(effectiveDates.fromDateStr).toLocaleDateString("vi-VN")} đến {new Date(effectiveDates.toDateStr).toLocaleDateString("vi-VN")}
          </div>
        )}
      </div>

      {/* REPORT CONTENT VIEW */}
      <div className="bg-white rounded-3xl p-6 md:p-8 shadow-xs border border-slate-200">
        <div id="quantity_report_visual_area" className="space-y-8 max-w-5xl mx-auto">
          
          <div className="text-center border-b pb-6">
            <h1 className="text-xl font-black text-slate-800 uppercase tracking-tight">Chi tiết số lượng hồ sơ tiếp nhận &amp; hoàn thành</h1>
            <p className="text-xs text-violet-650 font-bold mt-1">
              Thời kỳ: {new Date(effectiveDates.fromDateStr).toLocaleDateString("vi-VN")} ➜ {new Date(effectiveDates.toDateStr).toLocaleDateString("vi-VN")}
            </p>
          </div>

          {/* KPI SỐ LIỆU */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-150 flex flex-col justify-between">
              <span className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">Hồ sơ tiếp nhận</span>
              <span className="text-2xl font-black text-slate-800 block mt-2">{reportData.totalReceived} <sub className="text-xs font-normal text-slate-500">hồ sơ</sub></span>
            </div>
            <div className="bg-emerald-50/50 p-4 rounded-2xl border border-emerald-100 flex flex-col justify-between">
              <span className="text-emerald-600 text-[10px] uppercase font-bold tracking-wider">Đã hoàn thành</span>
              <span className="text-2xl font-black text-emerald-600 block mt-2">{reportData.totalCompleted} <sub className="text-xs font-normal text-emerald-500">hồ sơ</sub></span>
            </div>
            <div className="bg-violet-50/50 p-4 rounded-2xl border border-violet-100 flex flex-col justify-between">
              <span className="text-violet-600 text-[10px] uppercase font-bold tracking-wider">Số thửa phát sinh</span>
              <span className="text-2xl font-black text-violet-600 block mt-2">{reportData.totalReceivedPlots} <sub className="text-xs font-normal text-slate-500">thửa</sub></span>
            </div>
            <div className="bg-amber-50/50 p-4 rounded-2xl border border-amber-100 flex flex-col justify-between">
              <span className="text-amber-700 text-[10px] uppercase font-bold tracking-wider">Lịch ngoại nghiệp</span>
              <span className="text-2xl font-black text-amber-700 block mt-2">{reportData.totalSchedules}</span>
            </div>
          </div>

          {/* PHÂN BỔ LOẠI HỒ SƠ */}
          <div>
            <h3 className="text-sm font-extrabold text-slate-800 mb-3 flex items-center gap-1.5">
              <ChevronRight size={16} className="text-violet-600" /> Phân loại nghiệp vụ hồ sơ
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Tiếp nhận */}
              <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/40">
                <h4 className="text-xs font-extrabold text-slate-600 mb-3 uppercase tracking-wider">Hồ sơ tiếp nhận mới</h4>
                <ul className="space-y-1.5 text-xs">
                  {Object.entries(reportData.receivedTypes).map(([type, count]) => (
                    <li key={type} className="flex justify-between items-center py-1.5 border-b border-dashed border-slate-200">
                      <span className="text-slate-600">Hồ sơ <strong className="text-slate-800">{type}</strong>:</span>
                      <span className="font-extrabold text-slate-800">{count} hồ sơ</span>
                    </li>
                  ))}
                  {Object.keys(reportData.receivedTypes).length === 0 && (
                    <li className="text-slate-400 italic">Không nhận hồ sơ nào.</li>
                  )}
                </ul>
              </div>

              {/* Hoàn thành */}
              <div className="border border-emerald-200 rounded-2xl p-4 bg-emerald-50/20">
                <h4 className="text-xs font-extrabold text-emerald-700 mb-3 uppercase tracking-wider">Hồ sơ đã hoàn thành</h4>
                <ul className="space-y-1.5 text-xs">
                  {Object.entries(reportData.completedTypes).map(([type, count]) => (
                    <li key={type} className="flex justify-between items-center py-1.5 border-b border-dashed border-emerald-150">
                      <span className="text-slate-600">Hồ sơ <strong className="text-slate-850">{type}</strong> đã hoàn thành:</span>
                      <span className="font-extrabold text-emerald-600">{count} hồ sơ</span>
                    </li>
                  ))}
                  {Object.keys(reportData.completedTypes).length === 0 && (
                    <li className="text-emerald-600/60 italic">Chưa hoàn thành hồ sơ nào trong kỳ.</li>
                  )}
                </ul>
              </div>
            </div>
          </div>

          {/* BẢNG ĐỊA BÀN PHÂN BỔ */}
          <div>
            <h3 className="text-sm font-extrabold text-slate-800 mb-3 flex items-center gap-1.5">
              <ChevronRight size={16} className="text-violet-600" /> Thống kê phân bổ theo địa bàn Xã/Phường
            </h3>
            <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-700 uppercase font-black text-[10px] tracking-wider border-b border-slate-200">
                    <th className="p-3 text-center w-12">STT</th>
                    <th className="p-3">Xã / Phường / Thị trấn</th>
                    <th className="p-3 text-center">Hồ sơ nhận</th>
                    <th className="p-3 text-center">Số thửa đất</th>
                    <th className="p-3 text-center">Hoàn thành</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {Object.entries(reportData.receivedByWard).map(([ward, wardD], index) => {
                    const comp = reportData.completedByWard[ward] || { total: 0 };
                    return (
                      <tr key={ward} className="hover:bg-slate-50/50 transition-colors">
                        <td className="p-3 text-center font-bold text-slate-400">{index + 1}</td>
                        <td className="p-3 font-extrabold text-slate-800">{ward}</td>
                        <td className="p-3 text-center font-bold">{wardD.total}</td>
                        <td className="p-3 text-center font-bold text-violet-650">{wardD.plots}</td>
                        <td className="p-3 text-center font-extrabold text-emerald-600">{comp.total > 0 ? `✓ ${comp.total}` : '-'}</td>
                      </tr>
                    );
                  })}
                  {Object.keys(reportData.receivedByWard).length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-4 text-center text-slate-400 italic">Không có địa bàn nào phát sinh hồ sơ.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* BẢNG CHỈ SỐ NHÂN VIÊN */}
          <div>
            <h3 className="text-sm font-extrabold text-slate-800 mb-3 flex items-center gap-1.5">
              <ChevronRight size={16} className="text-violet-600" /> Giao nhận và phụ trách tác vụ của nhân viên
            </h3>
            <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-700 uppercase font-black text-[10px] tracking-wider border-b border-slate-200">
                    <th className="p-3 text-center w-12">STT</th>
                    <th className="p-3">Họ tên Nhân Viên</th>
                    <th className="p-3 text-center">Mới nhận</th>
                    <th className="p-3 text-center">Thửa đất giao</th>
                    <th className="p-3 text-center">Hoàn thành</th>
                    <th className="p-3 text-center">Lịch công tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {reportData.employeesStats.map((empS, index) => (
                    <tr key={empS.employee.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="p-3 text-center font-bold text-slate-400">{index + 1}</td>
                      <td className="p-3">
                        <span className="font-extrabold text-slate-800 block">{empS.employee.name}</span>
                        <span className="text-[10px] text-slate-400">{empS.employee.department}</span>
                      </td>
                      <td className="p-3 text-center font-bold">{empS.receivedCount}</td>
                      <td className="p-3 text-center font-bold text-violet-650">{empS.receivedPlots}</td>
                      <td className="p-3 text-center font-black text-emerald-600">{empS.completedCount > 0 ? `${empS.completedCount} hồ sơ` : '-'}</td>
                      <td className="p-3 text-center font-bold">{empS.schedulesCount}</td>
                    </tr>
                  ))}
                  {reportData.employeesStats.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-4 text-center text-slate-400 italic">Không có phân bổ công vụ nào.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* LỊCH CÔNG TÁC */}
          {reportData.periodSchedules.length > 0 && (
            <div>
              <h3 className="text-sm font-extrabold text-slate-800 mb-3 flex items-center gap-1.5">
                <ChevronRight size={16} className="text-violet-600" /> Lịch trình công tác theo địa bàn Xã / Phường
              </h3>
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 font-medium space-y-4">
                {groupSchedulesByLocation(reportData.periodSchedules).map(([locName, items]) => (
                  <div key={locName} className="space-y-2 bg-white p-3.5 rounded-xl border border-slate-200 shadow-3xs">
                    <div className="font-extrabold text-xs text-purple-900 bg-purple-100/80 px-3 py-1.5 rounded-lg border border-purple-200 inline-flex items-center gap-1.5 uppercase tracking-wide">
                      <MapPin size={13} className="text-purple-600 shrink-0" />
                      {locName} ({items.length} lượt công tác)
                    </div>
                    <ul className="space-y-2 text-xs text-slate-700 pt-1">
                      {items.map((s) => (
                        <li key={s.id} className="flex items-start gap-1.5 pb-2 border-b border-slate-100 last:border-0 last:pb-0">
                          <span className="text-purple-600 font-bold select-none">•</span>
                          <span className="flex-1 leading-relaxed">
                            <strong className="text-slate-900">Ngày {new Date(s.date).toLocaleDateString("vi-VN")}</strong>: <span className="font-bold text-blue-700">{s.executors}</span> - Nội dung: <span className="text-slate-900 font-semibold">{s.content}</span> {s.partner ? <span className="text-slate-500 font-normal">({s.partner})</span> : ''}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default QuantityReportView;
