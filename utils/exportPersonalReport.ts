import { Document, Packer, Paragraph, TextRun, AlignmentType } from "docx";
import { saveAs } from "file-saver";

export const exportPersonalReportToWord = async (
  filteredRecords: any,
  mySchedules: any[],
  user: any,
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

  addTitle(`BÁO CÁO CÁ NHÂN: ${user.name.toUpperCase()}`);
  
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

  addText("I. THỐNG KÊ HỒ SƠ", true);
  
  addText(`1. Số lượng hồ sơ nhận: ${filteredRecords.received.length} hồ sơ`, true, 360);
  Object.entries(filteredRecords.receivedTypes).forEach(([type, count]) => {
    addText(`- ${type}: ${count} hồ sơ`, false, 720);
  });

  const getRecordPlotCount = (r: any) => ['Sao lục', 'Công văn'].includes(r.recordType || '') ? 0 : (r.plotCount || 1);

  addText(`2. Số hồ sơ hoàn thành: ${filteredRecords.completed.length} hồ sơ`, true, 360);
  Object.entries(filteredRecords.completedTypes).forEach(([type, count]) => {
    addText(`- ${type}: ${count} hồ sơ`, false, 720);
  });
  const plotCountCompleted = filteredRecords.completed.reduce((sum: number, r: any) => sum + getRecordPlotCount(r), 0);
  addText(`- Tổng số lượng thửa đất đã hoàn thành: ${plotCountCompleted} thửa`, true, 720);

  const execCount = filteredRecords.completedWork.length + filteredRecords.pendingSign.length;
  addText(`3. Số hồ sơ đã thực hiện: ${execCount} hồ sơ`, true, 360);
  if (execCount > 0) {
    addText("Trong đó:", false, 720);
    if (filteredRecords.completedWork.length > 0) {
      addText(`- Đã thực hiện (đang chờ kiểm tra): ${filteredRecords.completedWork.length} hồ sơ`, false, 1080);
    }
    if (filteredRecords.pendingSign.length > 0) {
      addText(`- Đã thực hiện (chờ ký duyệt): ${filteredRecords.pendingSign.length} hồ sơ`, false, 1080);
    }
    const plotCountExecuted = [...filteredRecords.completedWork, ...filteredRecords.pendingSign].reduce((sum: number, r: any) => sum + getRecordPlotCount(r), 0);
    addText(`- Tổng số lượng thửa đất đã thực hiện: ${plotCountExecuted} thửa`, true, 1080);
  }

  addText(`4. Lịch công tác: ${mySchedules.length} lịch`, true, 360);

  children.push(new Paragraph({ spacing: { before: 400 } }));

  addText("II. CHI TIẾT LỊCH CÔNG TÁC", true);
  mySchedules.forEach((s: any, index: number) => {
    addText(`${index + 1}. Ngày ${new Date(s.date).toLocaleDateString("vi-VN")} (${s.partner}): ${s.content}`, false, 360);
  });

  const doc = new Document({
    sections: [{
      properties: {},
      children: children,
    }],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `Bao_Cao_Ca_Nhan_${user.name.replace(/\s/g, '')}_${new Date().toISOString().split("T")[0]}.docx`);
};
