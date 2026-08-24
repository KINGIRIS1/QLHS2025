import { Document, Packer, Paragraph, TextRun, AlignmentType, HeadingLevel } from "docx";
import { saveAs } from "file-saver";

export const exportTeamWeeklyReportToWord = async (
  reportData: any,
  fromDate: string,
  toDate: string
) => {
  const children: any[] = [];

  const addHeader = (text: string, level: any) => {
    children.push(
      new Paragraph({
        text: text,
        heading: level,
        alignment: AlignmentType.CENTER,
      })
    );
  };

  const addText = (text: string, bold: boolean = false, indent: number = 0) => {
    children.push(
      new Paragraph({
        children: [new TextRun({ text, bold, font: "Times New Roman", size: 28 })],
        indent: { left: indent },
      })
    );
  };

  const addTitle = (text: string) => {
    children.push(
      new Paragraph({
        children: [new TextRun({ text, bold: true, font: "Times New Roman", size: 36 })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
      })
    );
  };

  addTitle("BÁO CÁO CHI TIẾT");
  
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `(Từ ngày ${new Date(fromDate).toLocaleDateString("vi-VN")} đến ngày ${new Date(toDate).toLocaleDateString("vi-VN")})`,
          italics: true,
          font: "Times New Roman",
          size: 28,
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
    })
  );

  addText("I. BÁO CÁO TỔNG QUAN", true);
  addText(`1. Tổng hồ sơ nhận: ${reportData.totalReceivedCount} hồ sơ`, true, 360);
  Object.entries(reportData.receivedTypes).forEach(([type, count]) => {
    addText(`- ${type}: ${count} hồ sơ`, false, 720);
  });
  if (Object.keys(reportData.receivedByWard).length > 0) {
    addText("* Chi tiết theo xã phường:", true, 720);
    Object.entries(reportData.receivedByWard).forEach(([ward, wardData]: any) => {
      addText(`- Xã/Phường ${ward}: ${wardData.total} hồ sơ`, true, 1080);
      Object.entries(wardData.types).forEach(([type, count]) => {
        addText(`+ ${type}: ${count} hồ sơ`, false, 1440);
      });
    });
  }

  addText(`2. Tổng hồ sơ hoàn thành: ${reportData.totalCompletedCount} hồ sơ`, true, 360);
  Object.entries(reportData.completedTypes).forEach(([type, count]) => {
    addText(`- ${type}: ${count} hồ sơ`, false, 720);
  });
  if (Object.keys(reportData.completedByWard).length > 0) {
    addText("* Chi tiết theo xã phường:", true, 720);
    Object.entries(reportData.completedByWard).forEach(([ward, wardData]: any) => {
      addText(`- Xã/Phường ${ward}: ${wardData.total} hồ sơ`, true, 1080);
      Object.entries(wardData.types).forEach(([type, count]) => {
        addText(`+ ${type}: ${count} hồ sơ`, false, 1440);
      });
    });
  }
  addText(`- Tổng số lượng thửa đất thuộc hồ sơ hoàn thành: ${reportData.totalPlotCountCompleted} thửa`, true, 720);

  const totalExecuted = reportData.totalCompletedWorkCount + reportData.totalPendingSignCount;
  addText(`3. Tổng số hồ sơ đã thực hiện: ${totalExecuted} hồ sơ`, true, 360);
  if (totalExecuted > 0) {
    addText("Trong đó:", false, 720);
    addText(`- Đã thực hiện (đang chờ kiểm tra): ${reportData.totalCompletedWorkCount} hồ sơ`, false, 1080);
    addText(`- Đã thực hiện (chờ ký duyệt): ${reportData.totalPendingSignCount} hồ sơ`, false, 1080);
    addText(`- Tổng số lượng thửa đất thuộc hồ sơ đã thực hiện: ${reportData.totalPlotCountExecuted} thửa`, true, 1080);
  }

  addText(`4. Tổng lịch công tác: ${reportData.totalScheduleCount} lịch`, true, 360);

  children.push(new Paragraph({ spacing: { before: 400 } }));
  addText("II. BÁO CÁO THEO NHÂN VIÊN", true);
  
  const getRecordPlotCount = (r: any) => ['Sao lục', 'Công văn'].includes(r.recordType || '') ? 0 : (r.plotCount || 1);

  reportData.employeesData.forEach((data: any, index: number) => {
    addText(`${index + 1}. ${data.employee.name} ${data.employee.department ? `(${data.employee.department})` : ""}`, true, 360);
    
    // Received
    const receivedTypes: Record<string, number> = {};
    data.received.forEach((r: any) => {
      const t = r.recordType || "Khác";
      receivedTypes[t] = (receivedTypes[t] || 0) + 1;
    });
    addText(`a) Số lượng hồ sơ nhận: ${data.received.length} hồ sơ`, true, 720);
    Object.entries(receivedTypes).forEach(([type, count]) => {
      addText(`- ${type}: ${count} hồ sơ`, false, 1080);
    });

    // Completed
    const completedTypes: Record<string, number> = {};
    data.completed.forEach((r: any) => {
      const t = r.recordType || "Khác";
      completedTypes[t] = (completedTypes[t] || 0) + 1;
    });
    addText(`b) Số hồ sơ hoàn thành: ${data.completed.length} hồ sơ`, true, 720);
    Object.entries(completedTypes).forEach(([type, count]) => {
      addText(`- ${type}: ${count} hồ sơ`, false, 1080);
    });
    const plotCountCompleted = data.completed.reduce((sum: number, r: any) => sum + getRecordPlotCount(r), 0);
    addText(`- Tổng số lượng thửa đất đã hoàn thành: ${plotCountCompleted} thửa`, true, 1080);
    
    const execCount = data.completedWork.length + data.pendingSign.length;
    addText(`c) Số hồ sơ đã thực hiện: ${execCount} hồ sơ`, true, 720);
    if (execCount > 0) {
      addText("Trong đó:", false, 1080);
      if (data.completedWork.length > 0) addText(`- Đã thực hiện (đang chờ kiểm tra): ${data.completedWork.length} hồ sơ`, false, 1440);
      if (data.pendingSign.length > 0) addText(`- Đã thực hiện (chờ ký duyệt): ${data.pendingSign.length} hồ sơ`, false, 1440);
      const plotCountExecuted = [...data.completedWork, ...data.pendingSign].reduce((sum: number, r: any) => sum + getRecordPlotCount(r), 0);
      addText(`- Tổng số lượng thửa đất đã thực hiện: ${plotCountExecuted} thửa`, true, 1440);
    }
    
    addText(`d) Lịch công tác theo địa bàn: ${data.schedules.length} lịch`, true, 720);
    const groups: Record<string, any[]> = {};
    data.schedules.forEach((s: any) => {
      let rawLoc = (s.location || '').trim();
      let locName = 'Địa bàn khác / Chưa chọn';
      if (rawLoc) {
        const lower = rawLoc.toLowerCase();
        if (lower.includes('minh hưng')) locName = 'Phường Minh Hưng';
        else if (lower.includes('chơn thành')) locName = 'Phường Chơn Thành';
        else if (lower.includes('nha bích')) locName = 'Xã Nha Bích';
        else locName = rawLoc;
      }
      if (!groups[locName]) groups[locName] = [];
      groups[locName].push(s);
    });

    const priorityOrder = ['Phường Minh Hưng', 'Phường Chơn Thành', 'Xã Nha Bích'];
    const sortedGroups = Object.entries(groups).sort(([aKey], [bKey]) => {
      const idxA = priorityOrder.indexOf(aKey);
      const idxB = priorityOrder.indexOf(bKey);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return aKey.localeCompare(bKey, 'vi');
    });

    sortedGroups.forEach(([locName, items]) => {
      addText(`* ${locName}:`, true, 1080);
      items.forEach((s: any) => {
        const partnerStr = s.partner ? ` (${s.partner})` : '';
        addText(`- Ngày ${new Date(s.date).toLocaleDateString("vi-VN")}: ${s.executors || ''} - Nội dung: ${s.content}${partnerStr}`, false, 1440);
      });
    });
    
    children.push(new Paragraph({ spacing: { before: 200 } }));
  });

  const doc = new Document({
    sections: [{
      properties: {},
      children: children,
    }],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `Bao_Cao_So_Luong_${new Date().toISOString().split("T")[0]}.docx`);
};

export const exportExecutionReportToWord = async (
  reportData: any,
  fromDate: string,
  toDate: string
) => {
  const children: any[] = [];

  const addText = (text: string, bold: boolean = false, indent: number = 0) => {
    children.push(
      new Paragraph({
        children: [new TextRun({ text, bold, font: "Times New Roman", size: 28 })],
        indent: { left: indent },
      })
    );
  };

  const addTitle = (text: string) => {
    children.push(
      new Paragraph({
        children: [new TextRun({ text, bold: true, font: "Times New Roman", size: 36 })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
      })
    );
  };

  addTitle("THỐNG KÊ SỐ LƯỢNG HỒ SƠ ĐÃ THỰC HIỆN TẠI TỔ ĐO ĐẠC");

  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `(Từ ngày ${new Date(fromDate).toLocaleDateString("vi-VN")} đến ngày ${new Date(toDate).toLocaleDateString("vi-VN")})`,
          italics: true,
          font: "Times New Roman",
          size: 28,
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
    })
  );

  addText("I. TỔNG HỢP TIẾN TRÌNH THỰC HIỆN", true);
  addText(`- Đã thực hiện: ${reportData.completedWork} hồ sơ`, false, 360);
  addText(`- Đang trình ký: ${reportData.pendingSign} hồ sơ`, false, 360);
  addText(`- Đã ký duyệt (chờ Một Cửa): ${reportData.signed} hồ sơ`, false, 360);
  addText(`- Đã chuyển 1 cửa: ${reportData.handover} hồ sơ`, false, 360);
  addText(`- Tổng số thửa đất: ${reportData.plots} thửa`, true, 360);
  addText(`- Tổng lượt lịch công tác: ${reportData.schedulesCount} lượt`, true, 360);

  children.push(new Paragraph({ spacing: { before: 300 } }));
  addText("II. PHÂN BỔ THEO ĐỊA BÀN XÃ / PHƯỜNG", true);
  reportData.wardStats.forEach((w: any) => {
    addText(
      `• ${w.ward}: Đã thực hiện: ${w.completedWork} | Trình ký: ${w.pendingSign} | Đã ký duyệt: ${w.signed} | Chuyển 1 cửa: ${w.handover} | Số thửa: ${w.plots}`,
      false,
      360
    );
  });

  children.push(new Paragraph({ spacing: { before: 300 } }));
  addText("III. ĐÓNG GÓP NGHIỆP VỤ CỦA NHÂN VIÊN", true);
  reportData.employeeStats.forEach((e: any, index: number) => {
    addText(
      `${index + 1}. ${e.employee.name} (${e.employee.department}): Đã thực hiện: ${e.completedWork} | Trình ký: ${e.pendingSign} | Đã ký: ${e.signed} | Chuyển 1 cửa: ${e.handover} | Thửa: ${e.plots} | Lịch CT: ${e.schedules}`,
      false,
      360
    );
  });

  if (reportData.schedulesList && reportData.schedulesList.length > 0) {
    children.push(new Paragraph({ spacing: { before: 300 } }));
    addText("IV. CHI TIẾT LỊCH TRÌNH CÔNG TÁC", true);
    reportData.schedulesList.forEach((s: any) => {
      const partnerStr = s.partner ? ` (${s.partner})` : '';
      addText(
        `- Ngày ${new Date(s.date).toLocaleDateString("vi-VN")}: ${s.executors || ''} - Địa bàn: ${s.location || 'Khác'} - Nội dung: ${s.content}${partnerStr}`,
        false,
        360
      );
    });
  }

  const doc = new Document({
    sections: [{
      properties: {},
      children: children,
    }],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `Bao_Cao_HS_Thuc_Hien_${new Date().toISOString().split("T")[0]}.docx`);
};

