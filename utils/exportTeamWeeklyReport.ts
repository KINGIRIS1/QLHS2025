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

  const totalExecuted = reportData.totalCompletedWorkCount + reportData.totalPendingSignCount;
  addText(`3. Tổng số hồ sơ đã thực hiện: ${totalExecuted} hồ sơ`, true, 360);
  if (totalExecuted > 0) {
    addText("Trong đó:", false, 720);
    addText(`- Đã thực hiện (đang chờ kiểm tra): ${reportData.totalCompletedWorkCount} hồ sơ`, false, 1080);
    addText(`- Đã thực hiện (chờ ký duyệt): ${reportData.totalPendingSignCount} hồ sơ`, false, 1080);
  }

  addText(`4. Tổng lịch công tác: ${reportData.totalScheduleCount} lịch`, true, 360);

  children.push(new Paragraph({ spacing: { before: 400 } }));
  addText("II. BÁO CÁO THEO NHÂN VIÊN", true);
  
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
    
    const execCount = data.completedWork.length + data.pendingSign.length;
    addText(`c) Số hồ sơ đã thực hiện: ${execCount} hồ sơ`, true, 720);
    if (execCount > 0) {
      addText("Trong đó:", false, 1080);
      if (data.completedWork.length > 0) addText(`- Đã thực hiện (đang chờ kiểm tra): ${data.completedWork.length} hồ sơ`, false, 1440);
      if (data.pendingSign.length > 0) addText(`- Đã thực hiện (chờ ký duyệt): ${data.pendingSign.length} hồ sơ`, false, 1440);
    }
    
    addText(`d) Lịch công tác: ${data.schedules.length} lịch`, true, 720);
    data.schedules.forEach((s: any) => {
      addText(`- Ngày ${new Date(s.date).toLocaleDateString("vi-VN")} (${s.partner}): ${s.content}`, false, 1080);
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
  saveAs(blob, `Bao_Cao_Chi_Tiet_${new Date().toISOString().split("T")[0]}.docx`);
};
