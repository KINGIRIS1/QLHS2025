import React, { useState, useMemo } from "react";
import { RecordFile, Employee, WorkSchedule, RecordStatus } from "../../types";
import { exportExecutionReportToWord } from "../../utils/exportTeamWeeklyReport";
import { 
  Download, Printer, Calendar, Users, MapPin, 
  BarChart3, CheckCircle2, Clock, ClipboardCheck, 
  CalendarDays, Eye, FileText, ChevronRight, FileSpreadsheet
} from "lucide-react";
import { getShortRecordType, getNormalizedWard } from "../../constants";

interface ExecutionReportViewProps {
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

const ExecutionReportView: React.FC<ExecutionReportViewProps> = ({
  records,
  employees,
  schedules,
  fromDate,
  toDate,
}) => {
  // Bộ lọc độc lập
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
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      start = new Date(now.getFullYear(), now.getMonth(), diff, 0, 0, 0, 0);
      end = new Date(start.getTime());
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

  // Xử lý dữ liệu hồ sơ thực hiện
  const reportData = useMemo(() => {
    const { start, end } = effectiveDates;

    const isDateInRange = (dateStr: string | null | undefined, s: Date, e: Date) => {
      if (!dateStr) return false;
      const clean = String(dateStr).split('T')[0].split(' ')[0];
      const parts = clean.split('-');
      if (parts.length === 3) {
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10) - 1;
        const d = parseInt(parts[2], 10);
        const target = new Date(y, m, d, 12, 0, 0);
        return target >= s && target <= e;
      }
      const dt = new Date(dateStr);
      return !isNaN(dt.getTime()) && dt >= s && dt <= e;
    };

    const getPlotCount = (r: RecordFile): number => {
      const typeLower = (r.recordType || '').toLowerCase();
      if (typeLower.includes('sao lục') || typeLower.includes('công văn')) return 0;
      if (r.plotCount !== undefined && r.plotCount !== null) {
        const num = Number(r.plotCount);
        if (!isNaN(num) && num > 0) return num;
      }
      if (r.landPlot) {
        const plots = String(r.landPlot)
          .split(/[,;\s/]+/)
          .map(s => s.trim())
          .filter(Boolean);
        if (plots.length > 0) return plots.length;
      }
      return 1;
    };

    // 1. Đã thực hiện (COMPLETED_WORK)
    const listCompletedWork = records.filter(r => {
      if (r.status !== RecordStatus.COMPLETED_WORK) return false;
      const d = r.workCompletedDate || r.assignedDate || r.receivedDate;
      return isDateInRange(d, start, end);
    });

    // 2. Đang trình ký (PENDING_SIGN)
    const listPendingSign = records.filter(r => {
      if (r.status !== RecordStatus.PENDING_SIGN) return false;
      const d = r.submissionDate || r.workCompletedDate || r.assignedDate || r.receivedDate;
      return isDateInRange(d, start, end);
    });

    // 3. Đã ký duyệt (SIGNED)
    const listApproved = records.filter(r => {
      if (r.status !== RecordStatus.SIGNED) return false;
      const d = r.approvalDate || r.submissionDate || r.workCompletedDate || r.assignedDate || r.receivedDate;
      return isDateInRange(d, start, end);
    });

    // 4. Đã chuyển 1 cửa / Đã trả kết quả (HANDOVER hoặc RETURNED)
    const listHandover = records.filter(r => {
      if (r.status !== RecordStatus.HANDOVER && r.status !== RecordStatus.RETURNED) return false;
      const d = r.completedDate || r.resultReturnedDate || r.exportDate || r.approvalDate || r.submissionDate || r.workCompletedDate || r.assignedDate || r.receivedDate;
      return isDateInRange(d, start, end);
    });

    const listSchedules = schedules.filter(s => isDateInRange(s.date, start, end));

    // Thống kê theo xã
    const wardMap: Record<string, { completedWork: number; pendingSign: number; signed: number; handover: number; plots: number }> = {};
    const getObjW = () => ({ completedWork: 0, pendingSign: 0, signed: 0, handover: 0, plots: 0 });

    listCompletedWork.forEach(r => {
      const w = getNormalizedWard(r.ward) || "Khác";
      if (!wardMap[w]) wardMap[w] = getObjW();
      wardMap[w].completedWork++;
      wardMap[w].plots += getPlotCount(r);
    });
    listPendingSign.forEach(r => {
      const w = getNormalizedWard(r.ward) || "Khác";
      if (!wardMap[w]) wardMap[w] = getObjW();
      wardMap[w].pendingSign++;
      wardMap[w].plots += getPlotCount(r);
    });
    listApproved.forEach(r => {
      const w = getNormalizedWard(r.ward) || "Khác";
      if (!wardMap[w]) wardMap[w] = getObjW();
      wardMap[w].signed++;
      wardMap[w].plots += getPlotCount(r);
    });
    listHandover.forEach(r => {
      const w = getNormalizedWard(r.ward) || "Khác";
      if (!wardMap[w]) wardMap[w] = getObjW();
      wardMap[w].handover++;
      wardMap[w].plots += getPlotCount(r);
    });

    const totalPlots = [...listCompletedWork, ...listPendingSign, ...listApproved, ...listHandover]
      .reduce((sum, r) => sum + getPlotCount(r), 0);

    // Thống kê nhân viên
    const employeeMap: Record<string, { employee: Employee; completedWork: number; pendingSign: number; signed: number; handover: number; plots: number; schedules: number }> = {};
    employees.forEach(emp => {
      employeeMap[emp.id] = { employee: emp, completedWork: 0, pendingSign: 0, signed: 0, handover: 0, plots: 0, schedules: 0 };
    });

    const findEmpId = (assignedTo?: string | null): string | null => {
      if (!assignedTo) return null;
      const target = assignedTo.trim().toLowerCase();
      if (employeeMap[assignedTo]) return assignedTo;
      const found = Object.keys(employeeMap).find(id => {
        const emp = employeeMap[id].employee;
        return emp.id.toLowerCase() === target || emp.name.trim().toLowerCase() === target;
      });
      return found || null;
    };

    listCompletedWork.forEach(r => {
      const empId = findEmpId(r.assignedTo);
      if (empId && employeeMap[empId]) {
        employeeMap[empId].completedWork++;
        employeeMap[empId].plots += getPlotCount(r);
      }
    });
    listPendingSign.forEach(r => {
      const empId = findEmpId(r.assignedTo);
      if (empId && employeeMap[empId]) {
        employeeMap[empId].pendingSign++;
        employeeMap[empId].plots += getPlotCount(r);
      }
    });
    listApproved.forEach(r => {
      const empId = findEmpId(r.assignedTo);
      if (empId && employeeMap[empId]) {
        employeeMap[empId].signed++;
        employeeMap[empId].plots += getPlotCount(r);
      }
    });
    listHandover.forEach(r => {
      const empId = findEmpId(r.assignedTo);
      if (empId && employeeMap[empId]) {
        employeeMap[empId].handover++;
        employeeMap[empId].plots += getPlotCount(r);
      }
    });

    listSchedules.forEach(s => {
      if (s.executors) {
        const execStr = removeVietnameseTones(s.executors);
        employees.forEach(emp => {
          const nameTones = removeVietnameseTones(emp.name);
          if (execStr.includes(nameTones)) {
            employeeMap[emp.id].schedules++;
          }
        });
      }
    });

    const activeStats = {
      completedWork: listCompletedWork.length,
      pendingSign: listPendingSign.length,
      signed: listApproved.length,
      handover: listHandover.length,
      plots: totalPlots,
      schedulesCount: listSchedules.length,
      wardStats: Object.entries(wardMap).map(([ward, stats]) => ({ ward, ...stats })),
      employeeStats: Object.values(employeeMap).filter(v => v.completedWork > 0 || v.pendingSign > 0 || v.signed > 0 || v.handover > 0 || v.schedules > 0),
      schedulesList: listSchedules
    };

    const labelPeriod = dateMode === 'week' ? 'Trong tuần này' : (dateMode === 'month' ? 'Trong tháng này' : 'Trong kỳ tự chọn');
    const rangeStr = `Từ ngày ${start.toLocaleDateString("vi-VN")} đến ngày ${end.toLocaleDateString("vi-VN")}`;

    return {
      active: activeStats,
      range: { start, end },
      rangeStr,
      labelPeriod
    };
  }, [records, employees, schedules, effectiveDates, dateMode]);

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
    exportExecutionReportToWord(
      {
        ...reportData.active,
        wardStats: reportData.active.wardStats,
        employeeStats: reportData.active.employeeStats,
        schedulesList: reportData.active.schedulesList
      },
      effectiveDates.fromDateStr,
      effectiveDates.toDateStr
    );
  };

  return (
    <div className="h-full bg-slate-50 w-full overflow-y-auto custom-scrollbar p-6 animate-fade-in flex flex-col space-y-6">
      
      {/* HEADER & ACTIONS */}
      <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shrink-0">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-indigo-700">
            <ClipboardCheck size={20} className="stroke-[2.5]" />
            <span className="text-xs uppercase font-extrabold tracking-wider">Tiến độ &amp; Trạng thái</span>
          </div>
          <h2 className="text-xl font-black text-slate-800">Báo cáo hồ sơ thực hiện</h2>
          <p className="text-xs text-slate-500 font-medium">
            Phân tích số liệu và tác vụ chuyển trạng thái: Đã thực hiện, Đang trình ký, Đã ký duyệt, Chuyển Một cửa
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleExportWord}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-xl text-xs font-bold transition-all shadow-xs"
          >
            <FileSpreadsheet size={15} /> Xuất Word
          </button>
          <button
            onClick={() => {
              const printArea = document.getElementById("execution_report_visual_area")?.innerHTML;
              if (printArea) printReportContent("Báo cáo Tiến độ Hoàn thành hồ sơ kỹ thuật", printArea);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 rounded-xl text-xs font-bold transition-all shadow-xs border border-slate-250"
          >
            <Printer size={15} /> In Báo cáo
          </button>
          <button
            onClick={() => {
              const printArea = document.getElementById("execution_report_visual_area")?.innerHTML;
              if (printArea) downloadPDFReport("Báo cáo Tiến độ Hoàn thành hồ sơ kỹ thuật", printArea);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-red-600 hover:bg-red-700 active:scale-95 text-white rounded-xl text-xs font-bold transition-all shadow-xs"
          >
            <Download size={15} /> Tải PDF
          </button>
        </div>
      </div>

      {/* FILTER CONTROLS */}
      <div className="bg-white border border-slate-200 rounded-2xl px-5 py-3.5 flex flex-wrap items-center justify-between gap-4 shrink-0 shadow-xs">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
          <CalendarDays size={16} className="text-indigo-600" />
          <span>Kỳ thống kê:</span>
          <div className="flex bg-slate-100 p-1 rounded-xl ml-2 border border-slate-200">
            <button
              onClick={() => setDateMode('week')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${dateMode === 'week' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-800'}`}
            >
              Tuần này
            </button>
            <button
              onClick={() => setDateMode('month')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${dateMode === 'month' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-800'}`}
            >
              Tháng này
            </button>
            <button
              onClick={() => setDateMode('custom')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${dateMode === 'custom' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-800'}`}
            >
              Tự chọn
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
              className="border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-700 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white shadow-xs"
            />
            <span className="text-xs text-slate-500 font-medium">Đến ngày</span>
            <input
              type="date"
              value={customToDate}
              onChange={(e) => setCustomToDate(e.target.value)}
              className="border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-700 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white shadow-xs"
            />
          </div>
        ) : (
          <div className="text-xs font-bold text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-xl border border-indigo-200">
            {reportData.rangeStr}
          </div>
        )}
      </div>

      {/* REPORT CONTENT VIEW */}
      <div className="bg-white rounded-3xl p-6 md:p-8 shadow-xs border border-slate-200">
        <div id="execution_report_visual_area" className="space-y-6 max-w-5xl mx-auto">
          
          <div className="text-center border-b pb-6">
            <h1 className="text-xl font-black text-slate-800 uppercase tracking-tight">Thống kê số lượng hồ sơ đã thực hiện tại Tổ đo đạc</h1>
            <p className="text-xs text-indigo-700 font-bold mt-1">Hệ thống ghi nhận tình trạng hồ sơ hiện hành</p>
          </div>

          {/* SỐ LIỆU TỔNG QUAN */}
          <div className="bg-slate-50/50 border border-slate-200 rounded-3xl p-6 space-y-6">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-2">
              <h3 className="text-sm font-black uppercase text-indigo-800 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 block animate-pulse"></span>
                Quy mô ghi nhận ({reportData.labelPeriod})
              </h3>
              <span className="text-indigo-600 text-xs font-black">
                ({reportData.rangeStr})
              </span>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 text-center">
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs hover:shadow-sm transition-all">
                <div className="text-indigo-600 font-black text-2xl">{reportData.active.completedWork}</div>
                <div className="text-slate-500 text-[10px] uppercase font-black tracking-wider mt-1.5 leading-tight">Đã thực hiện</div>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs hover:shadow-sm transition-all">
                <div className="text-pink-600 font-black text-2xl">{reportData.active.pendingSign}</div>
                <div className="text-slate-500 text-[10px] uppercase font-black tracking-wider mt-1.5 leading-tight">Đang trình ký</div>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs hover:shadow-sm transition-all">
                <div className="text-emerald-600 font-black text-2xl">{reportData.active.signed}</div>
                <div className="text-slate-500 text-[10px] uppercase font-black tracking-wider mt-1.5 leading-tight">Đã ký duyệt (chờ Một Cửa)</div>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs hover:shadow-sm transition-all">
                <div className="text-blue-600 font-black text-2xl">{reportData.active.handover}</div>
                <div className="text-slate-500 text-[10px] uppercase font-black tracking-wider mt-1.5 leading-tight">Đã chuyển 1 cửa</div>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-amber-300 bg-amber-50/40 shadow-xs hover:shadow-sm transition-all col-span-2 lg:col-span-1">
                <div className="text-amber-700 font-black text-2xl">{reportData.active.plots}</div>
                <div className="text-amber-900 text-[10px] uppercase font-black tracking-wider mt-1.5 leading-tight">Tổng số thửa đất</div>
              </div>
            </div>

            {/* THỐNG KÊ XÃ PHƯỜNG */}
            <div>
              <h4 className="text-xs font-extrabold text-slate-600 uppercase tracking-wider mb-3.5 flex items-center gap-1.5">
                <ChevronRight size={16} className="text-indigo-600" />
                1. Phân bổ theo địa bàn Xã / Phường:
              </h4>
              <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-xs">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-700 uppercase font-bold text-[9px] tracking-wider border-b border-slate-200">
                      <th className="p-3.5">Địa bàn Xã / Phường</th>
                      <th className="p-3.5 text-center">Đã thực hiện</th>
                      <th className="p-3.5 text-center">Đang trình ký</th>
                      <th className="p-3.5 text-center">Đã ký duyệt</th>
                      <th className="p-3.5 text-center">Đã chuyển 1 cửa</th>
                      <th className="p-3.5 text-center font-black text-amber-900 bg-amber-50/60">Số thửa đất</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {reportData.active.wardStats.map((item) => (
                      <tr key={item.ward} className="hover:bg-slate-50/50 transition-colors">
                        <td className="p-3.5 font-extrabold text-slate-800">{item.ward}</td>
                        <td className="p-3.5 text-center font-extrabold text-indigo-600 bg-indigo-50/20">{item.completedWork}</td>
                        <td className="p-3.5 text-center font-bold text-orange-500">{item.pendingSign}</td>
                        <td className="p-3.5 text-center font-extrabold text-emerald-600 bg-emerald-50/20">{item.signed}</td>
                        <td className="p-3.5 text-center font-bold text-blue-600">{item.handover}</td>
                        <td className="p-3.5 text-center font-black text-amber-700 bg-amber-50/30">{item.plots}</td>
                      </tr>
                    ))}
                    {reportData.active.wardStats.length === 0 && (
                      <tr>
                        <td colSpan={6} className="p-6 text-center text-slate-400 italic font-semibold">
                          Không ghi nhận tác vụ nào địa bàn Xã / Phường trong dải kỳ chọn.
                        </td>
                      </tr>
                    )}
                  </tbody>
                  {reportData.active.wardStats.length > 0 && (
                    <tfoot className="bg-slate-100/80 font-black text-slate-900 border-t-2 border-slate-300">
                      <tr>
                        <td className="p-3.5 uppercase tracking-wider">Tổng cộng ({reportData.active.wardStats.length} địa bàn)</td>
                        <td className="p-3.5 text-center text-indigo-700 bg-indigo-100/40">
                          {reportData.active.wardStats.reduce((s, i) => s + i.completedWork, 0)}
                        </td>
                        <td className="p-3.5 text-center text-orange-600">
                          {reportData.active.wardStats.reduce((s, i) => s + i.pendingSign, 0)}
                        </td>
                        <td className="p-3.5 text-center text-emerald-700 bg-emerald-100/40">
                          {reportData.active.wardStats.reduce((s, i) => s + i.signed, 0)}
                        </td>
                        <td className="p-3.5 text-center text-blue-700">
                          {reportData.active.wardStats.reduce((s, i) => s + i.handover, 0)}
                        </td>
                        <td className="p-3.5 text-center text-amber-800 bg-amber-100/60 font-black">
                          {reportData.active.wardStats.reduce((s, i) => s + i.plots, 0)}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>

            {/* THỐNG KÊ NHÂN VIÊN */}
            <div>
              <h4 className="text-xs font-extrabold text-slate-600 uppercase tracking-wider mb-3.5 flex items-center gap-1.5">
                <ChevronRight size={16} className="text-indigo-600" />
                2. Đóng góp nghiệp vụ của Nhân viên:
              </h4>
              <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-xs">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-700 uppercase font-bold text-[9px] tracking-wider border-b border-slate-200">
                      <th className="p-3.5">Họ tên kỹ sư, nhân viên</th>
                      <th className="p-3.5 text-center">Đã thực hiện</th>
                      <th className="p-3.5 text-center">Đang trình ký</th>
                      <th className="p-3.5 text-center">Đã ký duyệt</th>
                      <th className="p-3.5 text-center">Đã chuyển 1 cửa</th>
                      <th className="p-3.5 text-center font-black text-amber-900 bg-amber-50/60">Thửa đất đo đạc</th>
                      <th className="p-3.5 text-center">Lịch công tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {reportData.active.employeeStats.map((item) => (
                      <tr key={item.employee.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="p-3.5 font-extrabold text-slate-800">{item.employee.name}</td>
                        <td className="p-3.5 text-center font-bold text-indigo-600">{item.completedWork}</td>
                        <td className="p-3.5 text-center font-bold text-orange-500">{item.pendingSign}</td>
                        <td className="p-3.5 text-center font-extrabold text-emerald-600 bg-emerald-50/20">{item.signed}</td>
                        <td className="p-3.5 text-center font-bold text-blue-600">{item.handover}</td>
                        <td className="p-3.5 text-center font-black text-amber-700 bg-amber-50/30">{item.plots}</td>
                        <td className="p-3.5 text-center font-extrabold text-violet-600 bg-violet-50/20">{item.schedules}</td>
                      </tr>
                    ))}
                    {reportData.active.employeeStats.length === 0 && (
                      <tr>
                        <td colSpan={7} className="p-6 text-center text-slate-400 italic font-semibold">
                          Không có nhân viên phát sinh tác vụ trong dải kỳ chọn.
                        </td>
                      </tr>
                    )}
                  </tbody>
                  {reportData.active.employeeStats.length > 0 && (
                    <tfoot className="bg-slate-100/80 font-black text-slate-900 border-t-2 border-slate-300">
                      <tr>
                        <td className="p-3.5 uppercase tracking-wider">Tổng cộng ({reportData.active.employeeStats.length} nhân sự)</td>
                        <td className="p-3.5 text-center text-indigo-700 bg-indigo-100/40">
                          {reportData.active.employeeStats.reduce((s, i) => s + i.completedWork, 0)}
                        </td>
                        <td className="p-3.5 text-center text-orange-600">
                          {reportData.active.employeeStats.reduce((s, i) => s + i.pendingSign, 0)}
                        </td>
                        <td className="p-3.5 text-center text-emerald-700 bg-emerald-100/40">
                          {reportData.active.employeeStats.reduce((s, i) => s + i.signed, 0)}
                        </td>
                        <td className="p-3.5 text-center text-blue-700">
                          {reportData.active.employeeStats.reduce((s, i) => s + i.handover, 0)}
                        </td>
                        <td className="p-3.5 text-center text-amber-800 bg-amber-100/60 font-black">
                          {reportData.active.employeeStats.reduce((s, i) => s + i.plots, 0)}
                        </td>
                        <td className="p-3.5 text-center text-violet-700 bg-violet-100/40">
                          {reportData.active.employeeStats.reduce((s, i) => s + i.schedules, 0)}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>

            {/* LỊCH TRÌNH CÔNG TÁC */}
            <div>
              <h4 className="text-xs font-extrabold text-slate-600 uppercase tracking-wider mb-3.5 flex items-center gap-1.5">
                <ChevronRight size={16} className="text-indigo-600" />
                3. Biểu lịch trình công tác cụ thể theo địa bàn Xã / Phường:
              </h4>
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 font-medium space-y-4">
                {reportData.active.schedulesList.length > 0 ? (
                  groupSchedulesByLocation(reportData.active.schedulesList).map(([locName, items]) => (
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
                  ))
                ) : (
                  <div className="text-slate-400 italic py-2 text-center font-semibold text-xs">
                    Chưa ghi nhận kế hoạch phục vụ dã ngoại hay thực địa nào cho kỳ này.
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default ExecutionReportView;
