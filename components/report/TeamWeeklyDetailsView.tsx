import React, { useState, useMemo } from "react";
import { RecordFile, Employee, WorkSchedule, RecordStatus } from "../../types";
import { exportTeamWeeklyReportToWord } from "../../utils/exportTeamWeeklyReport";
import { 
  Download, Printer, X, Calendar, Users, MapPin, 
  BarChart3, CheckCircle2, Clock, ListFilter, ClipboardCheck, 
  CalendarDays, Eye, FileText, ChevronRight 
} from "lucide-react";
import { getShortRecordType, getNormalizedWard } from "../../constants";

interface TeamWeeklyDetailsViewProps {
  records: RecordFile[];
  employees: Employee[];
  schedules: WorkSchedule[];
  fromDate: string;
  toDate: string;
}

// Hàm phụ trợ loại bỏ dấu tiếng Việt để so khớp tên lịch công tác
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

const TeamWeeklyDetailsView: React.FC<TeamWeeklyDetailsViewProps> = ({
  records,
  employees,
  schedules,
  fromDate,
  toDate,
}) => {
  // State quản lý Popup hiển thị
  const [showReport1Modal, setShowReport1Modal] = useState(false);
  const [showReport2Modal, setShowReport2Modal] = useState(false);

  // Bộ lọc độc lập trong Báo cáo 1
  const [dateMode1, setDateMode1] = useState<'week' | 'month' | 'custom'>('custom');
  const [customFromDate1, setCustomFromDate1] = useState(fromDate);
  const [customToDate1, setCustomToDate1] = useState(toDate);

  // Bộ lọc độc lập trong Báo cáo 2
  const [dateMode2, setDateMode2] = useState<'week' | 'month' | 'custom'>('custom');
  const [customFromDate2, setCustomFromDate2] = useState(fromDate);
  const [customToDate2, setCustomToDate2] = useState(toDate);

  // Mở Popup báo cáo và đồng bộ mốc thời gian ngoài mặc định
  const handleOpenReport1 = () => {
    setCustomFromDate1(fromDate);
    setCustomToDate1(toDate);
    setDateMode1('custom');
    setShowReport1Modal(true);
  };

  const handleOpenReport2 = () => {
    setCustomFromDate2(fromDate);
    setCustomToDate2(toDate);
    setDateMode2('custom');
    setShowReport2Modal(true);
  };

  // --- TÍNH TOÁN KỲ THỜI GIAN ĐỘC LẬP BÁO CÁO 1 ---
  const effectiveDates1 = useMemo(() => {
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

    if (dateMode1 === 'week') {
      const currentDay = now.getDay();
      const diffToMon = now.getDate() - currentDay + (currentDay === 0 ? -6 : 1);
      start = new Date(now.getFullYear(), now.getMonth(), diffToMon, 0, 0, 0, 0);
      end = new Date(start);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
    } else if (dateMode1 === 'month') {
      start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    } else {
      start = parseWithFallback(customFromDate1, fromDate);
      start.setHours(0, 0, 0, 0);
      end = parseWithFallback(customToDate1, toDate);
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
  }, [dateMode1, customFromDate1, customToDate1, fromDate, toDate]);

  // --- TÍNH TOÁN KỲ THỜI GIAN ĐỘC LẬP BÁO CÁO 2 ---
  const effectiveDates2 = useMemo(() => {
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

    if (dateMode2 === 'week') {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Điều chỉnh nếu Chủ Nhật (0)
      start = new Date(now.getFullYear(), now.getMonth(), diff, 0, 0, 0, 0);
      end = new Date(start.getTime());
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
    } else if (dateMode2 === 'month') {
      start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    } else {
      start = parseWithFallback(customFromDate2, fromDate);
      start.setHours(0, 0, 0, 0);
      end = parseWithFallback(customToDate2, toDate);
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
  }, [dateMode2, customFromDate2, customToDate2, fromDate, toDate]);


  // --- PROCESSING BÁO CÁO 1 ---
  const report1Data = useMemo(() => {
    const { start, end, fromDateStr, toDateStr } = effectiveDates1;

    // Lọc hồ sơ tiếp nhận trong kỳ
    const receivedRecords = records.filter(r => {
      if (!r.receivedDate) return false;
      const d = new Date(r.receivedDate);
      return d >= start && d <= end;
    });

    // Hồ sơ hoàn thành trong kỳ (là hồ sơ đã Đóng status hoàn thành và ĐƯỢC TIẾP NHẬN trong kỳ)
    const isCompletedStatus = (status: RecordStatus) => 
      [RecordStatus.SIGNED, RecordStatus.HANDOVER, RecordStatus.RETURNED].includes(status);
    
    const completedRecords = receivedRecords.filter(r => isCompletedStatus(r.status));

    // Thống kê số thửa đất hồ sơ nhận & hoàn thành
    const getPlotCount = (r: RecordFile) => ['Sao lục', 'Công văn'].includes(r.recordType || '') ? 0 : (r.plotCount || 1);
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
    const dbEmployees = employees.map(emp => {
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
      employeesStats: dbEmployees,
      periodSchedules
    };
  }, [records, employees, schedules, effectiveDates1]);


  // --- PROCESSING BÁO CÁO 2 (TIẾN TRÌNH HOÀN THÀNH - LỌC THEO KỲ CHỌN) ---
  const report2Data = useMemo(() => {
    const { start, end, fromDateStr, toDateStr } = effectiveDates2;

    const isDateInRange = (dateStr: string | null | undefined, s: Date, e: Date) => {
      if (!dateStr) return false;
      const d = new Date(dateStr);
      return d >= s && d <= e;
    };

    // Đếm theo ngày hệ thống ghi nhận bấm nút Đã thực hiện (workCompletedDate) nằm trong khoảng ngày lọc và TRẠNG THÁI HIỆN TẠI là COMPLETED_WORK
    const listCompletedWork = records.filter(r => {
      if (r.status !== RecordStatus.COMPLETED_WORK) return false;
      const d = r.workCompletedDate || r.assignedDate || r.receivedDate;
      return isDateInRange(d, start, end);
    });
    
    // Đếm theo ngày hệ thống ghi nhận bấm nút Đang trình ký (submissionDate) nằm trong khoảng ngày lọc và TRẠNG THÁI HIỆN TẠI là PENDING_SIGN
    const listPendingSign = records.filter(r => {
      if (r.status !== RecordStatus.PENDING_SIGN) return false;
      const d = r.submissionDate || r.workCompletedDate || r.assignedDate || r.receivedDate;
      return isDateInRange(d, start, end);
    });
    
    // Đếm theo ngày hệ thống ghi nhận bấm nút Đã ký duyệt (approvalDate) nằm trong khoảng ngày lọc và TRẠNG THÁI HIỆN TẠI là SIGNED
    const listApproved = records.filter(r => {
      if (r.status !== RecordStatus.SIGNED) return false;
      const d = r.approvalDate || r.submissionDate || r.workCompletedDate || r.assignedDate || r.receivedDate;
      return isDateInRange(d, start, end);
    });
    
    // Đếm theo ngày hệ thống ghi nhận bấm nút Đã chuyển 1 cửa hoặc Trả kết quả (completedDate hoặc resultReturnedDate) nằm trong khoảng ngày lọc và TRẠNG THÁI HIỆN TẠI là HANDOVER hoặc RETURNED
    const listHandover = records.filter(r => {
      if (r.status !== RecordStatus.HANDOVER && r.status !== RecordStatus.RETURNED) return false;
      const d = r.completedDate || r.resultReturnedDate || r.exportDate || r.approvalDate || r.submissionDate || r.workCompletedDate || r.assignedDate || r.receivedDate;
      return isDateInRange(d, start, end);
    });

    // Lịch công tác
    const listSchedules = schedules.filter(s => {
      if (!s.date) return false;
      const d = new Date(s.date);
      return d >= start && d <= end;
    });

    const getPlotCount = (r: RecordFile) => ['Sao lục', 'Công văn'].includes(r.recordType || '') ? 0 : (r.plotCount || 1);
    const totalPlots = [...listCompletedWork, ...listPendingSign, ...listApproved, ...listHandover]
      .reduce((sum, r) => sum + getPlotCount(r), 0);

    // Nhóm theo địa bàn
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

    // Nhóm theo nhân viên 
    const employeeMap: Record<string, { employee: Employee; completedWork: number; pendingSign: number; signed: number; handover: number; plots: number; schedules: number }> = {};
    employees.forEach(emp => {
      employeeMap[emp.id] = { employee: emp, completedWork: 0, pendingSign: 0, signed: 0, handover: 0, plots: 0, schedules: 0 };
    });

    listCompletedWork.forEach(r => {
      if (r.assignedTo && employeeMap[r.assignedTo]) {
        employeeMap[r.assignedTo].completedWork++;
        employeeMap[r.assignedTo].plots += getPlotCount(r);
      }
    });
    listPendingSign.forEach(r => {
      if (r.assignedTo && employeeMap[r.assignedTo]) {
        employeeMap[r.assignedTo].pendingSign++;
        employeeMap[r.assignedTo].plots += getPlotCount(r);
      }
    });
    listApproved.forEach(r => {
      if (r.assignedTo && employeeMap[r.assignedTo]) {
        employeeMap[r.assignedTo].signed++;
        employeeMap[r.assignedTo].plots += getPlotCount(r);
      }
    });
    listHandover.forEach(r => {
      if (r.assignedTo && employeeMap[r.assignedTo]) {
        employeeMap[r.assignedTo].handover++;
        employeeMap[r.assignedTo].plots += getPlotCount(r);
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

    const labelPeriod = dateMode2 === 'week' ? 'Trong tuần này' : (dateMode2 === 'month' ? 'Trong tháng này' : 'Trong kỳ tự chọn');
    const rangeStr = `Từ ngày ${start.toLocaleDateString("vi-VN")} đến ngày ${end.toLocaleDateString("vi-VN")}`;

    return {
      active: activeStats,
      range: { start, end },
      rangeStr,
      labelPeriod
    };
  }, [records, employees, schedules, effectiveDates2, dateMode2]);


  // --- IN BÁO CÁO CHUYÊN NGHIỆP QUA IFRAME ẨN (Sử dụng trực tiếp hộp thoại in) ---
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
          <script>
            window.tailwind.config = {
              theme: {
                extend: {
                  colors: {
                    indigo: {
                      650: '#4f46e5',
                      750: '#4338ca',
                      850: '#312e81',
                    },
                    pink: {
                      650: '#db2777',
                    },
                    emerald: {
                      150: '#a7f3d0',
                    },
                    slate: {
                      55: '#f1f5f9',
                      150: '#e2e8f0',
                      250: '#cbd5e1',
                    }
                  }
                }
              }
            }
          </script>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Space+Grotesk:wght@500;700&display=swap');
            
            * {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            @page { 
              size: A4 portrait; 
              margin: 1.2cm 1cm; 
            }
            body { 
              font-family: 'Inter', system-ui, -apple-system, sans-serif; 
              color: #1e293b; 
              background: white !important; 
              margin: 0; 
              padding: 0; 
            }
            .grid {
              display: grid !important;
            }
            table {
              border-collapse: collapse !important;
              width: 100% !important;
            }
            th, td {
              border-width: 1px !important;
              border-style: solid !important;
              border-color: #e2e8f0 !important;
              padding: 8px 12px !important;
            }
            th {
              background-color: #f8fafc !important;
            }
            tr, .bg-white, li, .rounded-2xl {
              page-break-inside: avoid;
              break-inside: avoid;
            }
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
      
      // Chờ Tailwind CDN hoàn thành biên dịch và nạp đầy đủ font trước khi in
      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        document.body.removeChild(iframe);
      }, 1000);
    }
  };

  // --- TẢI FILE BÁO CÁO PDF CHẤT LƯỢNG CAO QUA IFRAME TRUNG GIAN (Tránh lỗi trắng trang & giữ nguyên vẹn định dạng) ---
  const downloadPDFReport = (title: string, innerHtml: string) => {
    // Tạo iframe ẩn để render nội dung độc lập, giúp cô lập CSS và đảm bảo Tailwind biên dịch đúng
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
          <script>
            window.tailwind.config = {
              theme: {
                extend: {
                  colors: {
                    indigo: {
                      650: '#4f46e5',
                      750: '#4338ca',
                      850: '#312e81',
                    },
                    pink: {
                      650: '#db2777',
                    },
                    emerald: {
                      150: '#a7f3d0',
                    },
                    slate: {
                      55: '#f1f5f9',
                      150: '#e2e8f0',
                      250: '#cbd5e1',
                    }
                  }
                }
              }
            }
          </script>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Space+Grotesk:wght@500;700&display=swap');
            
            * {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              color-adjust: exact !important;
            }
            body { 
              font-family: 'Inter', system-ui, -apple-system, sans-serif; 
              color: #1e293b; 
              background: white !important; 
              margin: 0; 
              padding: 24px; 
            }
            .grid {
              display: grid !important;
            }
            table {
              border-collapse: collapse !important;
              width: 100% !important;
              margin: 15px 0 !important;
            }
            th, td {
              border-width: 1px !important;
              border-style: solid !important;
              border-color: #cbd5e1 !important;
              padding: 8px 12px !important;
              text-align: left;
            }
            th {
              background-color: #f1f5f9 !important;
              color: #1e293b !important;
              font-weight: bold !important;
            }
            tr, .bg-white, li, .rounded-2xl {
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }
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
          html2canvas:  { 
            scale: 2, 
            useCORS: true, 
            letterRendering: true,
            logging: false,
            scrollY: 0,
            scrollX: 0
          },
          jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        // Chờ 1.5 giây để đảm bảo Tailwind CDN bên trong iframe tải và biên dịch hoàn thành CSS
        setTimeout(() => {
          const contentElement = iframe.contentWindow?.document.body;
          if (contentElement) {
            html2pdf().set(opt).from(contentElement).save().then(() => {
              document.body.removeChild(iframe);
            }).catch((err: any) => {
              console.error("Lỗi xuất PDF qua iframe: ", err);
              document.body.removeChild(iframe);
              // Fallback khi gặp lỗi bảo mật: dùng hộp thoại in ấn chuẩn của thiết bị
              alert("Việc tải file trực tiếp gặp lỗi do bảo mật trình duyệt. Hệ thống sẽ mở hộp thoại in. Vui lòng chọn 'Lưu dưới dạng PDF' tại phần máy in.");
              printReportContent(title, innerHtml);
            });
          } else {
            document.body.removeChild(iframe);
            printReportContent(title, innerHtml);
          }
        }, 1500);
      };

      // Nạp thư viện html2pdf.js vào trang cha để thực hiện tiến trình export
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
    exportTeamWeeklyReportToWord(report1Data, effectiveDates1.fromDateStr, effectiveDates1.toDateStr);
  };

  return (
    <div className="h-full bg-slate-50 w-full p-6 animate-fade-in flex flex-col">
      
      {/* HEADER TAB BÁO CÁO */}
      <div className="bg-gradient-to-r from-violet-600/10 via-indigo-600/10 to-blue-600/10 border border-slate-200/80 p-5 rounded-3xl mb-6 flex flex-col md:flex-row items-center justify-between gap-4 shrink-0 shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-indigo-700">
            <BarChart3 size={20} className="stroke-[2.5]" />
            <span className="text-xs uppercase font-extrabold tracking-wider">Hệ thống phân tích báo cáo</span>
          </div>
          <h2 className="text-xl font-extrabold text-slate-800">Báo cáo & Thống kê điều hành</h2>
          <p className="text-xs text-slate-500 font-medium">
            Quản trị thời gian thực, tự động thu thố dữ liệu thụ lý nghiệp vụ của toàn tổ kỹ thuật.
          </p>
        </div>
        <div className="bg-white/90 backdrop-blur-xs px-4 py-2 border border-slate-250/70 rounded-2xl shadow-sm text-xs font-semibold text-slate-600 flex items-center gap-2">
          <Calendar size={15} className="text-indigo-600" /> 
          Mốc hiện tại: <span className="font-extrabold text-indigo-750">{new Date(fromDate).toLocaleDateString("vi-VN")} ➜ {new Date(toDate).toLocaleDateString("vi-VN")}</span>
        </div>
      </div>

      {/* GRID HAI LOẠI BÁO CÁO - Thiết kế bám sát, trực quan */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-6xl w-full mx-auto pb-10 flex-1">
        
        {/* CARD BÁO CÁO 1 */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs hover:shadow-md hover:border-violet-200 transition-all duration-350 flex flex-col group h-full">
          <div className="flex items-start justify-between">
            <div className="bg-violet-50 rounded-2xl p-4 text-violet-600 group-hover:scale-105 transition-transform">
              <ListFilter size={24} className="stroke-[2.5]" />
            </div>
            <span className="bg-violet-100/60 border border-violet-205 text-violet-850 text-[10px] px-2.5 py-1 rounded-md font-bold uppercase tracking-wider">
              Theo Ngày Nhận
            </span>
          </div>
          
          <h3 className="text-base font-extrabold text-slate-800 mt-5 group-hover:text-violet-700 transition-colors">
            1. Báo cáo số lượng hồ sơ
          </h3>
          <p className="text-xs text-slate-500 mt-2.5 leading-relaxed">
            Thống kê định lượng toàn diện về số lượng hồ sơ được <b>tiếp nhận mới</b> và số lượng được hoàn thành dựa vào ngày bàn giao tiếp nhận hệ thống.
          </p>
          
          {/* Quick Stats Grid Preview */}
          <div className="grid grid-cols-3 gap-3 my-6 py-4 border-y border-slate-100 bg-slate-50/50 px-4 rounded-2xl text-xs">
            <div>
              <div className="text-slate-400 font-bold text-[9px] uppercase tracking-wider">Hồ sơ nhận</div>
              <div className="text-sm font-extrabold text-slate-700 mt-0.5">{report1Data.totalReceived} hồ sơ</div>
            </div>
            <div>
              <div className="text-slate-400 font-bold text-[9px] uppercase tracking-wider">Đã hoàn thành</div>
              <div className="text-sm font-extrabold text-emerald-600 mt-0.5">{report1Data.totalCompleted} hồ sơ</div>
            </div>
            <div>
              <div className="text-slate-400 font-bold text-[9px] uppercase tracking-wider">Thửa đất / Lịch</div>
              <div className="text-sm font-extrabold text-indigo-700 mt-0.5">{report1Data.totalReceivedPlots} / {report1Data.totalSchedules}</div>
            </div>
          </div>

          <div className="mt-auto pt-2">
            <button
              onClick={handleOpenReport1}
              className="w-full flex items-center justify-center gap-2 py-3 px-5 bg-violet-600 hover:bg-violet-700 active:scale-[0.98] text-white rounded-2xl text-xs font-bold shadow-xs hover:shadow-md hover:shadow-violet-600/10 transition-all duration-200"
            >
              <Eye size={15} /> Mở xem Báo cáo & In
            </button>
          </div>
        </div>

        {/* CARD BÁO CÁO 2 (Báo cáo hồ sơ hoàn thành) */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs hover:shadow-md hover:border-indigo-200 transition-all duration-355 flex flex-col group h-full">
          <div className="flex items-start justify-between">
            <div className="bg-indigo-50 rounded-2xl p-4 text-indigo-600 group-hover:scale-105 transition-transform">
              <ClipboardCheck size={24} className="stroke-[2.5]" />
            </div>
            <span className="bg-indigo-100/60 border border-indigo-205 text-indigo-850 text-[10px] px-2.5 py-1 rounded-md font-bold uppercase tracking-wider">
              Mốc Tiến Trình
            </span>
          </div>
          
          <h3 className="text-base font-extrabold text-slate-800 mt-5 group-hover:text-indigo-700 transition-colors">
            2. Báo cáo hồ sơ hoàn thành (Tiến trình)
          </h3>
          <p className="text-xs text-slate-500 mt-2.5 leading-relaxed">
            Phân tích số liệu và tác vụ chuyển trạng thái lũy tiến của nhân viên như: <b>Đã thực hiện, Đang trình ký, Đã ký duyệt, Chuyển Một cửa</b>.
          </p>
          
          {/* Quick Stats Grid Preview */}
          <div className="grid grid-cols-4 gap-2 my-6 py-4 border-y border-slate-100 bg-slate-50/50 px-2.5 rounded-2xl text-center text-xs">
            <div>
              <div className="text-slate-400 font-bold text-[9px] uppercase tracking-wider">Đã làm</div>
              <div className="text-sm font-extrabold text-blue-600 mt-0.5">{report2Data.active.completedWork}</div>
            </div>
            <div>
              <div className="text-slate-400 font-bold text-[9px] uppercase tracking-wider">Trình ký</div>
              <div className="text-sm font-extrabold text-pink-650 mt-0.5">{report2Data.active.pendingSign}</div>
            </div>
            <div>
              <div className="text-slate-400 font-bold text-[9px] uppercase tracking-wider">Ký duyệt</div>
              <div className="text-sm font-extrabold text-emerald-600 mt-0.5">{report2Data.active.signed}</div>
            </div>
            <div>
              <div className="text-slate-400 font-bold text-[9px] uppercase tracking-wider">Một cửa</div>
              <div className="text-sm font-extrabold text-indigo-650 mt-0.5">{report2Data.active.handover}</div>
            </div>
          </div>

          <div className="mt-auto pt-2">
            <button
              onClick={handleOpenReport2}
              className="w-full flex items-center justify-center gap-2 py-3 px-5 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white rounded-2xl text-xs font-bold shadow-xs hover:shadow-md hover:shadow-indigo-600/10 transition-all duration-200"
            >
              <Eye size={15} /> Mở xem Báo cáo & In
            </button>
          </div>
        </div>

      </div>


      {/* =======================================================
          POPUP 1: BÁO CÁO SỐ LƯỢNG HỒ SƠ (GIAO DIỆN HIỆN ĐẠI ĐẸP MẮT)
          ======================================================= */}
      {showReport1Modal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex justify-center items-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl h-[92vh] flex flex-col overflow-hidden animate-zoom-in border border-slate-100">
            
            {/* Header Popup */}
            <div className="bg-gradient-to-r from-violet-600 to-indigo-600 text-white px-6 py-4 flex items-center justify-between shrink-0 shadow-md">
              <div className="flex items-center gap-3">
                <div className="bg-white/15 p-2 rounded-xl"><ListFilter size={20} /></div>
                <div>
                  <h3 className="font-extrabold text-base leading-tight">Mẫu Báo cáo Số lượng Hồ sơ</h3>
                  <p className="text-[11px] text-violet-100 font-medium opacity-90">
                    Bản phân tách trực quan hồ sơ phát sinh trong kỳ theo mốc tiếp nhận mới và hoàn thành
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const printArea = document.getElementById("report_1_visual_area")?.innerHTML;
                    if (printArea) printReportContent("Báo cáo Số lượng Hồ sơ tiếp nhận và hoàn thành", printArea);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white/15 hover:bg-white/25 active:scale-95 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
                >
                  <Printer size={14} /> In Báo cáo
                </button>
                <button
                  onClick={() => {
                    const printArea = document.getElementById("report_1_visual_area")?.innerHTML;
                    if (printArea) downloadPDFReport("Báo cáo Số lượng Hồ sơ tiếp nhận và hoàn thành", printArea);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 active:scale-95 text-white rounded-xl text-xs font-bold transition-all shadow-md"
                >
                  <Download size={14} /> Tải file PDF
                </button>
                <button 
                  onClick={() => setShowReport1Modal(false)}
                  className="text-white hover:bg-white/15 p-1.5 rounded-xl transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* BỘ LỌC THỜI GIAN ĐỘC LẬP TẠI POPUP */}
            <div className="bg-slate-50 border-b border-slate-200/60 px-6 py-4 flex flex-wrap items-center justify-between gap-4 shrink-0">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                <CalendarDays size={16} className="text-indigo-600" />
                <span>Chọn kỳ thống kê:</span>
                <div className="flex bg-slate-200/70 p-1 rounded-xl ml-2">
                  <button
                    onClick={() => setDateMode1('week')}
                    className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all ${dateMode1 === 'week' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-800'}`}
                  >
                    Tuần này
                  </button>
                  <button
                    onClick={() => setDateMode1('month')}
                    className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all ${dateMode1 === 'month' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-800'}`}
                  >
                    Tháng này
                  </button>
                  <button
                    onClick={() => setDateMode1('custom')}
                    className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all ${dateMode1 === 'custom' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-800'}`}
                  >
                    Tùy chọn
                  </button>
                </div>
              </div>

              {dateMode1 === 'custom' && (
                <div className="flex items-center gap-2 animate-fade-in">
                  <span className="text-xs text-slate-500 font-medium">Từ ngày</span>
                  <input
                    type="date"
                    value={customFromDate1}
                    onChange={(e) => setCustomFromDate1(e.target.value)}
                    className="border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-700 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white shadow-xs"
                  />
                  <span className="text-xs text-slate-500 font-medium">Đến ngày</span>
                  <input
                    type="date"
                    value={customToDate1}
                    onChange={(e) => setCustomToDate1(e.target.value)}
                    className="border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-700 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white shadow-xs"
                  />
                </div>
              )}
            </div>

            {/* Nội dung Review */}
            <div className="flex-1 overflow-y-auto bg-slate-50 p-6 md:p-8">
              
              {/* PHẦN XEM TRƯỚC HÌNH THỨC HIỆN ĐẠI TRÊN PHẦN MỀM */}
              <div className="max-w-4xl mx-auto space-y-8 bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-100">
                
                {/* ID dùng để render ra bản in chuẩn */}
                <div id="report_1_print_area" className="hidden">
                  <div className="title-section">
                    <div className="title">Báo cáo số lượng hồ sơ tiếp nhận và hoàn thành</div>
                    <div className="subtitle">Lọc theo ngày tiếp nhận từ ngày {new Date(effectiveDates1.fromDateStr).toLocaleDateString("vi-VN")} đến ngày {new Date(effectiveDates1.toDateStr).toLocaleDateString("vi-VN")}</div>
                  </div>

                  <div className="section-title">I. BÁO CÁO TỔNG QUAN</div>
                  <p className="normal-text">- Thống kê ngày nhận từ ngày <span className="bold">{new Date(effectiveDates1.fromDateStr).toLocaleDateString("vi-VN")}</span> đến ngày <span className="bold">{new Date(effectiveDates1.toDateStr).toLocaleDateString("vi-VN")}</span>.</p>
                  <p className="normal-text">- Tổng số hồ sơ tiếp nhận mới trong kỳ: <span className="bold">{report1Data.totalReceived} hồ sơ</span>.</p>
                  <p className="normal-text">- Tổng số lượng thửa đất ghi nhận theo hồ sơ mới: <span className="bold">{report1Data.totalReceivedPlots} thửa</span>.</p>
                  <p className="normal-text">- Tổng số hồ sơ hoàn thành thực tế trong số tiếp nhận mới này: <span className="bold">{report1Data.totalCompleted} hồ sơ</span>.</p>
                  <p className="normal-text">- Tổng số thửa đất hoàn thành từ danh sách trên: <span className="bold">{report1Data.totalCompletedPlots} thửa</span>.</p>
                  <p className="normal-text">- Tổng số lịch công tác thực tế liên quan: <span className="bold">{report1Data.totalSchedules}</span>.</p>

                  <div className="section-title">II. TÌNH HÌNH TIẾP NHẬN CHI TIẾT</div>
                  <p className="normal-text"><span className="bold">1. Phân bổ hồ sơ tiếp nhận theo loại:</span></p>
                  <ul>
                    {Object.entries(report1Data.receivedTypes).map(([type, count]) => (
                      <li key={type}>- Hồ sơ <span className="bold">{type}</span>: {count} hồ sơ.</li>
                    ))}
                    {Object.keys(report1Data.receivedTypes).length === 0 && (
                      <li style={{ fontStyle: 'italic', color: '#64748b' }}>Không ghi nhận hồ sơ mới nào trong kỳ.</li>
                    )}
                  </ul>

                  <p className="normal-text"><span className="bold">2. Phân bổ hồ sơ tiếp nhận theo địa bàn Xã/Phường:</span></p>
                  <table>
                    <thead>
                      <tr>
                        <th style={{ width: '10%' }}>STT</th>
                        <th>Địa bàn Xã/Phường</th>
                        <th style={{ width: '25%' }}>Số hồ sơ nhận</th>
                        <th style={{ width: '25%' }}>Số thửa đất</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(report1Data.receivedByWard).map(([ward, d], i) => (
                        <tr key={ward}>
                          <td className="text-center">{i + 1}</td>
                          <td className="bold">{ward}</td>
                          <td className="text-center">{d.total}</td>
                          <td className="text-center">{d.plots}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div className="section-title">III. CHI TIẾT TÌNH HÌNH HOÀN THÀNH HỒ SƠ (Công việc tiếp nhận trong kỳ)</div>
                  <p className="normal-text"><span className="bold">1. Phân bổ theo phân loại hồ sơ:</span></p>
                  <ul>
                    {Object.entries(report1Data.completedTypes).map(([type, count]) => (
                      <li key={type}>- Hồ sơ <span className="bold">{type}</span> đã hoàn thành: {count} hồ sơ.</li>
                    ))}
                    {Object.keys(report1Data.completedTypes).length === 0 && (
                      <li style={{ fontStyle: 'italic', color: '#64748b' }}>Không ghi nhận hồ sơ hoàn thành nào.</li>
                    )}
                  </ul>

                  <p className="normal-text"><span className="bold">2. Phân bổ hồ sơ hoàn thành theo Xã/Phường:</span></p>
                  <table>
                    <thead>
                      <tr>
                        <th style={{ width: '10%' }}>STT</th>
                        <th>Địa bàn Xã/Phường</th>
                        <th style={{ width: '25%' }}>Số hồ sơ xong</th>
                        <th style={{ width: '25%' }}>Số thửa đã xong</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(report1Data.completedByWard).map(([ward, d], i) => (
                        <tr key={ward}>
                          <td className="text-center">{i + 1}</td>
                          <td className="bold">{ward}</td>
                          <td className="text-center">{d.total}</td>
                          <td className="text-center">{d.plots}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div className="section-title">IV. SỐ LIỆU PHÂN BỔ THEO NHÂN VIÊN ĐƯỢC GIAO TÁC VỤ</div>
                  <table>
                    <thead>
                      <tr>
                        <th style={{ width: '10%' }}>STT</th>
                        <th>Họ tên Nhân Viên</th>
                        <th style={{ width: '18%' }}>Mới nhận</th>
                        <th style={{ width: '18%' }}>Số thửa</th>
                        <th style={{ width: '18%' }}>Đã xong</th>
                        <th style={{ width: '18%' }}>Lịch công tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report1Data.employeesStats.map((item, i) => (
                        <tr key={item.employee.id}>
                          <td className="text-center">{i + 1}</td>
                          <td className="bold">{item.employee.name} ({item.employee.department})</td>
                          <td className="text-center">{item.receivedCount}</td>
                          <td className="text-center">{item.receivedPlots}</td>
                          <td className="text-center">{item.completedCount}</td>
                          <td className="text-center">{item.schedulesCount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {report1Data.periodSchedules.length > 0 && (
                    <>
                      <div className="section-title">V. CHI TIẾT LỊCH TRÌNH CÔNG TÁC TRONG KỲ</div>
                      <ul>
                        {report1Data.periodSchedules.map((s) => (
                          <li key={s.id}>
                            - Ngày {new Date(s.date).toLocaleDateString("vi-VN")}: {s.executors} - Nội dung: {s.content} ({s.partner || '-'})
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>

                {/* GIAO DIỆN TRÊN PHẦN MỀM - TRỰC QUAN HIỆN ĐẠI SẠCH ĐẸP */}
                <div id="report_1_visual_area" className="space-y-8">
                  <div className="text-center border-b pb-6">
                    <h1 className="text-xl font-black text-slate-800 uppercase tracking-tight">Chi tiết số lượng hồ sơ tiếp nhận &amp; hoàn thành</h1>
                  <p className="text-xs text-indigo-650 font-bold mt-1">
                    Thời kỳ: {new Date(effectiveDates1.fromDateStr).toLocaleDateString("vi-VN")} ➜ {new Date(effectiveDates1.toDateStr).toLocaleDateString("vi-VN")}
                  </p>
                </div>

                {/* KPI SỐ LIỆU */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-slate-55/60 p-4 rounded-2xl border border-slate-100 flex flex-col justify-between">
                    <span className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">Hồ sơ tiếp nhận</span>
                    <span className="text-2xl font-black text-slate-800 block mt-2">{report1Data.totalReceived} <sub className="text-xs font-normal text-slate-500">hồ sơ</sub></span>
                  </div>
                  <div className="bg-emerald-50/40 p-4 rounded-2xl border border-emerald-100 flex flex-col justify-between">
                    <span className="text-emerald-600 text-[10px] uppercase font-bold tracking-wider">Lãnh đạo đã xong</span>
                    <span className="text-2xl font-black text-emerald-600 block mt-2">{report1Data.totalCompleted} <sub className="text-xs font-normal text-emerald-500">hồ sơ</sub></span>
                  </div>
                  <div className="bg-violet-50/40 p-4 rounded-2xl border border-violet-100 flex flex-col justify-between">
                    <span className="text-violet-600 text-[10px] uppercase font-bold tracking-wider">Số thửa phát sinh</span>
                    <span className="text-2xl font-black text-violet-600 block mt-2">{report1Data.totalReceivedPlots} <sub className="text-xs font-normal text-slate-500">thửa</sub></span>
                  </div>
                  <div className="bg-amber-50/40 p-4 rounded-2xl border border-amber-100 flex flex-col justify-between">
                    <span className="text-amber-700 text-[10px] uppercase font-bold tracking-wider">Lịch ngoại nghiệp</span>
                    <span className="text-2xl font-black text-amber-700 block mt-2">{report1Data.totalSchedules}</span>
                  </div>
                </div>

                {/* PHÂN BỔ LOẠI HỒ SƠ */}
                <div>
                  <h3 className="text-sm font-extrabold text-slate-800 mb-3 flex items-center gap-1.5"><ChevronRight size={16} className="text-indigo-600" /> Phân loại nghiệp vụ hồ sơ</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Tiếp nhận */}
                    <div className="border border-slate-150 rounded-2xl p-4 bg-slate-50/30">
                      <h4 className="text-xs font-extrabold text-slate-600 mb-3 uppercase tracking-wider">Hồ sơ tiếp nhận mới</h4>
                      <ul className="space-y-1.5 text-xs">
                        {Object.entries(report1Data.receivedTypes).map(([type, count]) => (
                          <li key={type} className="flex justify-between items-center py-1.5 border-b border-dashed border-slate-200">
                            <span className="text-slate-600">Hồ sơ <strong className="text-slate-800">{type}</strong>:</span>
                            <span className="font-extrabold text-slate-800">{count} hồ sơ</span>
                          </li>
                        ))}
                        {Object.keys(report1Data.receivedTypes).length === 0 && (
                          <li className="text-slate-400 italic">Không nhận hồ sơ nào.</li>
                        )}
                      </ul>
                    </div>

                    {/* Hoàn thành */}
                    <div className="border border-emerald-150 rounded-2xl p-4 bg-emerald-50/10">
                      <h4 className="text-xs font-extrabold text-emerald-700 mb-3 uppercase tracking-wider">Hồ sơ đã hoàn thành</h4>
                      <ul className="space-y-1.5 text-xs">
                        {Object.entries(report1Data.completedTypes).map(([type, count]) => (
                          <li key={type} className="flex justify-between items-center py-1.5 border-b border-dashed border-emerald-150">
                            <span className="text-slate-600">Hồ sơ <strong className="text-slate-850">{type}</strong> đã hoàn thành:</span>
                            <span className="font-extrabold text-emerald-600">{count} hồ sơ</span>
                          </li>
                        ))}
                        {Object.keys(report1Data.completedTypes).length === 0 && (
                          <li className="text-emerald-600/60 italic">Chưa hoàn thành hồ sơ nào trong kỳ.</li>
                        )}
                      </ul>
                    </div>
                  </div>
                </div>

                {/* BẢNG ĐỊA BÀN PHÂN BỔ */}
                <div>
                  <h3 className="text-sm font-extrabold text-slate-800 mb-3 flex items-center gap-1.5"><ChevronRight size={16} className="text-indigo-600" /> Thống kê phân bổ theo địa bàn Xã/Phường</h3>
                  <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                    <table className="w-full text-xs text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 text-slate-700 uppercase font-black text-[10px] tracking-wider border-b border-slate-200/80">
                          <th className="p-3 text-center w-12">STT</th>
                          <th className="p-3">Xã / Phường / Thị trấn</th>
                          <th className="p-3 text-center">Hồ sơ nhận</th>
                          <th className="p-3 text-center">Số thửa đất</th>
                          <th className="p-3 text-center">Hoàn thành</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                        {Object.entries(report1Data.receivedByWard).map(([ward, wardD], index) => {
                          const comp = report1Data.completedByWard[ward] || { total: 0 };
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
                        {Object.keys(report1Data.receivedByWard).length === 0 && (
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
                  <h3 className="text-sm font-extrabold text-slate-800 mb-3 flex items-center gap-1.5"><ChevronRight size={16} className="text-indigo-600" /> Giao nhận và phụ trách tác vụ của nhân viên</h3>
                  <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                    <table className="w-full text-xs text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 text-slate-700 uppercase font-black text-[10px] tracking-wider border-b border-slate-200/80">
                          <th className="p-3 text-center w-12">STT</th>
                          <th className="p-3">Họ tên Nhân Viên</th>
                          <th className="p-3 text-center">Mới nhận</th>
                          <th className="p-3 text-center">Thửa đất giao</th>
                          <th className="p-3 text-center">Hoàn thành</th>
                          <th className="p-3 text-center">Lịch công tác</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                        {report1Data.employeesStats.map((empS, index) => (
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
                        {report1Data.employeesStats.length === 0 && (
                          <tr>
                            <td colSpan={6} className="p-4 text-center text-slate-400 italic">Không có phân bổ công vụ nào.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* SƯ SỬ LỊCH CÔNG TÁC THEO FORMAT CHUẨN */}
                {report1Data.periodSchedules.length > 0 && (
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-800 mb-3 flex items-center gap-1.5"><ChevronRight size={16} className="text-indigo-600" /> Lịch trình công tác trong kỳ tuyển chọn</h3>
                    <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/60 font-medium">
                      <ul className="space-y-2 text-xs text-slate-700">
                        {report1Data.periodSchedules.map((s) => (
                          <li key={s.id} className="flex items-start gap-1 pb-1.5 border-b border-slate-100/75 last:border-0 last:pb-0">
                            <span className="text-indigo-600 mr-2 font-bold">•</span>
                            <span>
                              <strong>Ngày {new Date(s.date).toLocaleDateString("vi-VN")}</strong>: {s.executors} - Nội dung: {s.content} ({s.partner || '-'})
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
                </div>

              </div>

            </div>

            {/* Footer Modal */}
            <div className="bg-slate-50 px-6 py-4 border-t border-slate-250 flex justify-end shrink-0">
              <button
                onClick={() => setShowReport1Modal(false)}
                className="px-5 py-2.5 bg-slate-200 hover:bg-slate-300 active:scale-95 text-slate-700 rounded-xl font-extrabold text-xs transition-colors"
              >
                Đóng lại
              </button>
            </div>
            
          </div>
        </div>
      )}


      {/* =======================================================
          POPUP 2: BÁO CÁO HỒ SƠ HOÀN THÀNH / TIẾN TRÌNH (HIỆN ĐẠI ĐẸP MẮT)
          ======================================================= */}
      {showReport2Modal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex justify-center items-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl h-[92vh] flex flex-col overflow-hidden animate-zoom-in border border-slate-100">
            
            {/* Header Popup */}
            <div className="bg-gradient-to-r from-indigo-700 to-indigo-900 text-white px-6 py-4 flex items-center justify-between shrink-0 shadow-md">
              <div className="flex items-center gap-3">
                <div className="bg-white/15 p-2 rounded-xl"><ClipboardCheck size={20} /></div>
                <div>
                  <h3 className="font-extrabold text-base leading-tight">Mẫu Báo cáo Tiến độ Hoàn thành</h3>
                  <p className="text-[11px] text-indigo-150 font-medium opacity-90">
                    Báo cáo số liệu ghi nhận tình hình hồ sơ đã thực hiện, đang trình ký, đã ký duyệt và đã chuyển 1 cửa.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const printArea = document.getElementById("report_2_visual_area")?.innerHTML;
                    if (printArea) printReportContent("Báo cáo Tiến độ Hoàn thành hồ sơ kỹ thuật", printArea);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white/15 hover:bg-white/25 active:scale-95 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
                >
                  <Printer size={14} /> In Báo cáo
                </button>
                <button
                  onClick={() => {
                    const printArea = document.getElementById("report_2_visual_area")?.innerHTML;
                    if (printArea) downloadPDFReport("Báo cáo Tiến độ Hoàn thành hồ sơ kỹ thuật", printArea);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 active:scale-95 text-white rounded-xl text-xs font-bold transition-all shadow-md"
                >
                  <Download size={14} /> Tải file PDF
                </button>
                <button 
                  onClick={() => setShowReport2Modal(false)}
                  className="text-white hover:bg-white/15 p-1.5 rounded-xl transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* BỘ LỌC THỜI GIAN ĐỘC LẬP TẠI POPUP 2 */}
            <div className="bg-slate-50 border-b border-slate-200/60 px-6 py-4 flex flex-wrap items-center justify-between gap-4 shrink-0 font-sans">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                <CalendarDays size={16} className="text-indigo-600" />
                <span>Khoảng thời gian kỳ báo cáo số III:</span>
                <div className="flex bg-slate-200/70 p-1 rounded-xl ml-2">
                  <button
                    onClick={() => setDateMode2('week')}
                    className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all ${dateMode2 === 'week' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-800'}`}
                  >
                    Tuần này
                  </button>
                  <button
                    onClick={() => setDateMode2('month')}
                    className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all ${dateMode2 === 'month' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-800'}`}
                  >
                    Tháng này
                  </button>
                  <button
                    onClick={() => setDateMode2('custom')}
                    className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all ${dateMode2 === 'custom' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-800'}`}
                  >
                    Tự chọn
                  </button>
                </div>
              </div>

              {dateMode2 === 'custom' && (
                <div className="flex items-center gap-2 animate-fade-in">
                  <span className="text-xs text-slate-500 font-medium">Từ ngày</span>
                  <input
                    type="date"
                    value={customFromDate2}
                    onChange={(e) => setCustomFromDate2(e.target.value)}
                    className="border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-700 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white shadow-xs"
                  />
                  <span className="text-xs text-slate-500 font-medium">Đến ngày</span>
                  <input
                    type="date"
                    value={customToDate2}
                    onChange={(e) => setCustomToDate2(e.target.value)}
                    className="border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-700 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white shadow-xs"
                  />
                </div>
              )}
            </div>

            {/* Content Preview */}
            <div className="flex-1 overflow-y-auto bg-slate-50 p-6 md:p-8">
              
              <div className="max-w-4xl mx-auto space-y-8 bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-100">
                
                {/* ID dùng để kết nối sang thiết kế in ấn thuần khi in báo cáo A4 */}
                <div id="report_2_print_area" className="hidden">
                  <div className="title-section">
                    <div className="title">Báo cáo tiến độ và tình hình giải quyết hồ sơ</div>
                    <div className="subtitle">Hệ thống thống kê tình trạng hồ sơ ghi nhận hiện hành</div>
                  </div>

                  <div className="section-title">CHỈ TIÊU BÁO CÁO: {report2Data.labelPeriod.toUpperCase()}</div>
                  <p className="normal-text">{report2Data.rangeStr}</p>
                  <p className="normal-text">Hiện tại trong hệ thống ghi nhận:</p>
                  <p className="normal-text">-<span className="bold">{report2Data.active.completedWork} hồ sơ</span> đã thực hiện.</p>
                  <p className="normal-text">-<span className="bold">{report2Data.active.pendingSign} hồ sơ</span> đang trình ký.</p>
                  <p className="normal-text">-<span className="bold">{report2Data.active.signed} hồ sơ</span> đã ký duyệt (chưa chuyển 1 cửa).</p>
                  <p className="normal-text">-<span className="bold">{report2Data.active.handover} hồ sơ</span> đã chuyển 1 cửa.</p>

                  <p className="normal-text"><span className="bold">* Phân bổ theo địa bàn Phường / Xã:</span></p>
                  <table>
                    <thead>
                      <tr>
                        <th>Địa bàn Phường/Xã</th>
                        <th style={{ width: '15%' }}>Đã làm</th>
                        <th style={{ width: '15%' }}>Trình ký</th>
                        <th style={{ width: '15%' }}>Đã duyệt</th>
                        <th style={{ width: '15%' }}>Một cửa</th>
                        <th style={{ width: '15%' }}>Số thửa</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report2Data.active.wardStats.map((item) => (
                        <tr key={item.ward}>
                          <td className="bold">{item.ward}</td>
                          <td className="text-center">{item.completedWork}</td>
                          <td className="text-center">{item.pendingSign}</td>
                          <td className="text-center">{item.signed}</td>
                          <td className="text-center">{item.handover}</td>
                          <td className="text-center">{item.plots}</td>
                        </tr>
                      ))}
                      {report2Data.active.wardStats.length === 0 && (
                        <tr>
                          <td colSpan={6} style={{ textAlign: 'center', color: '#64748b', fontStyle: 'italic' }}>Không ghi nhận số liệu Phường / Xã phát sinh trong dải thời gian này.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>

                  <p className="normal-text"><span className="bold">* Khối lượng nghiệp vụ và đóng góp của Nhân viên:</span></p>
                  <table>
                    <thead>
                      <tr>
                        <th>Tên kỹ sư, nhân viên</th>
                        <th style={{ width: '15%' }}>Đã làm</th>
                        <th style={{ width: '15%' }}>Trình ký</th>
                        <th style={{ width: '15%' }}>Ký duyệt</th>
                        <th style={{ width: '15%' }}>Một cửa</th>
                        <th style={{ width: '15%' }}>Văn phòng (Thửa)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report2Data.active.employeeStats.map((item) => (
                        <tr key={item.employee.id}>
                          <td className="bold">{item.employee.name}</td>
                          <td className="text-center">{item.completedWork}</td>
                          <td className="text-center">{item.pendingSign}</td>
                          <td className="text-center">{item.signed}</td>
                          <td className="text-center">{item.handover}</td>
                          <td className="text-center">{item.plots}</td>
                        </tr>
                      ))}
                      {report2Data.active.employeeStats.length === 0 && (
                        <tr>
                          <td colSpan={6} style={{ textAlign: 'center', color: '#64748b', fontStyle: 'italic' }}>Không ghi nhận nhân viên làm việc dại dã phát sinh.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>

                  {report2Data.active.schedulesList.length > 0 && (
                    <>
                      <p className="normal-text"><span className="bold">* Chi tiết lịch trình công tác phục vụ nghiệp vụ dã ngoại:</span></p>
                      <ul>
                        {report2Data.active.schedulesList.map((s) => (
                          <li key={s.id}>
                            - Ngày {new Date(s.date).toLocaleDateString("vi-VN")}: {s.executors} - Nội dung: {s.content} ({s.partner || '-'})
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>

                {/* VISUAL TRÊN CHƯƠNG TRÌNH */}
                <div id="report_2_visual_area" className="space-y-6">
                  <div className="text-center border-b pb-6">
                    <h1 className="text-xl font-black text-slate-800 uppercase tracking-tight">Thống kê tiến trình hoàn thành nội bộ</h1>
                  <p className="text-xs text-indigo-700 font-bold mt-1">Hệ thống ghi nhận tình trạng hồ sơ hiện hành</p>
                </div>

                {/* SỐ LIỆU TỔNG QUAN THEO KỲ CHỌN */}
                <div className="bg-slate-50/50 border border-slate-200 rounded-3xl p-6 space-y-6">
                  <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-2">
                    <h3 className="text-sm font-black uppercase text-indigo-800 flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-indigo-650 block animate-pulse"></span>
                      Quy mô ghi nhận ({report2Data.labelPeriod})
                    </h3>
                    <span className="text-indigo-600 text-xs font-black">
                      ({report2Data.rangeStr})
                    </span>
                  </div>

                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-center">
                    <div className="bg-white p-4 rounded-2xl border border-slate-150 shadow-3xs hover:shadow-2xs transition-all">
                      <div className="text-indigo-600 font-extrabold text-2xl">{report2Data.active.completedWork}</div>
                      <div className="text-slate-500 text-[10px] uppercase font-black tracking-wider mt-1.5 leading-tight">đã thực hiện</div>
                    </div>
                    <div className="bg-white p-4 rounded-2xl border border-slate-150 shadow-3xs hover:shadow-2xs transition-all">
                      <div className="text-pink-600 font-extrabold text-2xl">{report2Data.active.pendingSign}</div>
                      <div className="text-slate-500 text-[10px] uppercase font-black tracking-wider mt-1.5 leading-tight">đang trình ký</div>
                    </div>
                    <div className="bg-white p-4 rounded-2xl border border-slate-150 shadow-3xs hover:shadow-2xs transition-all">
                      <div className="text-emerald-600 font-extrabold text-2xl">{report2Data.active.signed}</div>
                      <div className="text-slate-500 text-[10px] uppercase font-black tracking-wider mt-1.5 leading-tight">đã ký duyệt (chờ Một Cửa)</div>
                    </div>
                    <div className="bg-white p-4 rounded-2xl border border-slate-150 shadow-3xs hover:shadow-2xs transition-all">
                      <div className="text-blue-600 font-extrabold text-2xl">{report2Data.active.handover}</div>
                      <div className="text-slate-500 text-[10px] uppercase font-black tracking-wider mt-1.5 leading-tight">đã chuyển 1 cửa</div>
                    </div>
                  </div>

                  {/* THỐNG KÊ XÃ PHƯỜNG */}
                  <div>
                    <h4 className="text-[11px] font-extrabold text-slate-500 uppercase tracking-widest mb-3.5 flex items-center gap-1.5">
                      <span className="w-1.5 h-3 bg-indigo-500 rounded-sm"></span>
                      1. Phân bổ theo địa bàn Xã / Phường:
                    </h4>
                    <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-3xs">
                      <table className="w-full text-xs text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50/75 text-slate-700 uppercase font-bold text-[9px] tracking-wider border-b border-slate-200">
                            <th className="p-3.5">Địa bàn Xã / Phường</th>
                            <th className="p-3.5 text-center">Đã thực hiện</th>
                            <th className="p-3.5 text-center">Đang trình ký</th>
                            <th className="p-3.5 text-center">Đã ký duyệt</th>
                            <th className="p-3.5 text-center">Đã chuyển 1 cửa</th>
                            <th className="p-3.5 text-center">Số thửa đất</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {report2Data.active.wardStats.map((item) => (
                            <tr key={item.ward} className="hover:bg-slate-50/50 transition-colors">
                              <td className="p-3.5 font-extrabold text-slate-800">{item.ward}</td>
                              <td className="p-3.5 text-center font-extrabold text-indigo-650 bg-indigo-50/5">{item.completedWork}</td>
                              <td className="p-3.5 text-center font-bold text-orange-500">{item.pendingSign}</td>
                              <td className="p-3.5 text-center font-extrabold text-emerald-600 bg-emerald-50/5">{item.signed}</td>
                              <td className="p-3.5 text-center font-bold text-blue-600">{item.handover}</td>
                              <td className="p-3.5 text-center font-bold text-slate-500 bg-slate-50/10">{item.plots}</td>
                            </tr>
                          ))}
                          {report2Data.active.wardStats.length === 0 && (
                            <tr>
                              <td colSpan={6} className="p-6 text-center text-slate-400 italic font-semibold">
                                Không ghi nhận tác vụ nào địa bàn Xã / Phường trong dải kỳ chọn.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* THỐNG KÊ NHÂN VIÊN */}
                  <div>
                    <h4 className="text-[11px] font-extrabold text-slate-500 uppercase tracking-widest mb-3.5 flex items-center gap-1.5">
                      <span className="w-1.5 h-3 bg-violet-500 rounded-sm"></span>
                      2. Đóng góp nghiệp vụ của Nhân viên:
                    </h4>
                    <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-3xs">
                      <table className="w-full text-xs text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50/75 text-slate-700 uppercase font-bold text-[9px] tracking-wider border-b border-slate-200">
                            <th className="p-3.5">Họ tên kỹ sư, nhân viên</th>
                            <th className="p-3.5 text-center">Đã thực hiện</th>
                            <th className="p-3.5 text-center">Đang trình ký</th>
                            <th className="p-3.5 text-center">Đã ký duyệt</th>
                            <th className="p-3.5 text-center">Đã chuyển 1 cửa</th>
                            <th className="p-3.5 text-center">Thửa đất đo đạc</th>
                            <th className="p-3.5 text-center">Lịch công tác</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {report2Data.active.employeeStats.map((item) => (
                            <tr key={item.employee.id} className="hover:bg-slate-50/50 transition-colors">
                              <td className="p-3.5 font-extrabold text-slate-800">{item.employee.name}</td>
                              <td className="p-3.5 text-center font-bold text-indigo-650">{item.completedWork}</td>
                              <td className="p-3.5 text-center font-bold text-orange-500">{item.pendingSign}</td>
                              <td className="p-3.5 text-center font-extrabold text-emerald-600 bg-emerald-50/5">{item.signed}</td>
                              <td className="p-3.5 text-center font-bold text-blue-600">{item.handover}</td>
                              <td className="p-3.5 text-center font-bold text-slate-500 bg-slate-50/10">{item.plots}</td>
                              <td className="p-3.5 text-center font-extrabold text-violet-600 bg-violet-50/20">{item.schedules}</td>
                            </tr>
                          ))}
                          {report2Data.active.employeeStats.length === 0 && (
                            <tr>
                              <td colSpan={7} className="p-6 text-center text-slate-400 italic font-semibold">
                                Không có nhân viên phát sinh tác vụ trong dải kỳ chọn.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* LỊCH TRÌNH CÔNG TÁC */}
                  <div>
                    <h4 className="text-[11px] font-extrabold text-slate-500 uppercase tracking-widest mb-3.5 flex items-center gap-1.5">
                      <span className="w-1.5 h-3 bg-emerald-500 rounded-sm"></span>
                      3. Biểu lịch trình công tác cụ thể:
                    </h4>
                    <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/60 font-medium">
                      <ul className="space-y-2.5 text-xs text-slate-700">
                        {report2Data.active.schedulesList.map((s) => (
                          <li key={s.id} className="flex items-start gap-1 pb-2 border-b border-slate-100 last:border-0 last:pb-0">
                            <span className="text-indigo-500 mr-2 font-bold select-none">•</span>
                            <span>
                              <strong>Ngày {new Date(s.date).toLocaleDateString("vi-VN")}</strong>: {s.executors} - Nội dung: <span className="text-slate-900 font-semibold">{s.content}</span> ({s.partner || '-'})
                            </span>
                          </li>
                        ))}
                        {report2Data.active.schedulesList.length === 0 && (
                          <li className="text-slate-400 italic py-2 text-center font-semibold">
                            Chưa ghi nhận kế hoạch phục vụ dã ngoại hay thực địa nào cho kỳ này.
                          </li>
                        )}
                      </ul>
                    </div>
                  </div>
                </div>
                </div>

              </div>

            </div>

            {/* Footer Modal */}
            <div className="bg-slate-50 px-6 py-4 border-t border-slate-250 flex justify-end shrink-0">
              <button
                onClick={() => setShowReport2Modal(false)}
                className="px-5 py-2.5 bg-slate-250 hover:bg-slate-300 text-slate-700 rounded-xl font-extrabold text-xs transition-colors"
              >
                Đóng lại
              </button>
            </div>
            
          </div>
        </div>
      )}

    </div>
  );
};

export default TeamWeeklyDetailsView;
