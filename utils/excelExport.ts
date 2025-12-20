
import * as XLSX from 'xlsx-js-style';
import { RecordFile, RecordStatus } from '../types';
import { getNormalizedWard, getShortRecordType, STATUS_LABELS } from '../constants';
import { isRecordOverdue } from './appHelpers';

export const exportReportToExcel = (records: RecordFile[], fromDateStr: string, toDateStr: string) => {
    const from = new Date(fromDateStr);
    from.setHours(0, 0, 0, 0);
    const to = new Date(toDateStr);
    to.setHours(23, 59, 59, 999);

    // Filter records
    const filtered = records.filter(r => {
        if (!r.receivedDate) return false;
        const rDate = new Date(r.receivedDate);
        return rDate >= from && rDate <= to;
    });

    if (filtered.length === 0) {
        alert("Không có hồ sơ nào trong khoảng thời gian này.");
        return;
    }

    // Prepare Data
    const formatDate = (d: string) => {
        if (!d) return '';
        const date = new Date(d);
        return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;
    };

    // Summary Stats
    let total = filtered.length;
    let completed = filtered.filter(r => r.status === RecordStatus.HANDOVER).length;
    let processing = total - completed;
    let overdue = filtered.filter(r => isRecordOverdue(r)).length;

    // Table Header
    const tableHeader = ["STT", "Mã Hồ Sơ", "Chủ Sử Dụng", "Địa Chỉ (Xã)", "Loại Hồ Sơ", "Ngày Nhận", "Hẹn Trả", "Ngày Xong", "Trạng Thái", "Ghi Chú"];
    
    const dataRows = filtered.map((r, i) => [
        i + 1,
        r.code,
        r.customerName,
        getNormalizedWard(r.ward),
        getShortRecordType(r.recordType),
        formatDate(r.receivedDate),
        formatDate(r.deadline),
        formatDate(r.completedDate || ''),
        STATUS_LABELS[r.status],
        r.notes || ''
    ]);

    // Generate Workbook
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([]);

    // Styles
    const titleStyle = { font: { name: "Times New Roman", sz: 14, bold: true }, alignment: { horizontal: "center" } };
    const subTitleStyle = { font: { name: "Times New Roman", sz: 12, italic: true }, alignment: { horizontal: "center" } };
    const headerStyle = { 
        font: { name: "Times New Roman", sz: 11, bold: true }, 
        border: { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } }, 
        fill: { fgColor: { rgb: "E0E0E0" } }, 
        alignment: { horizontal: "center", vertical: "center", wrapText: true } 
    };
    const cellStyle = { 
        font: { name: "Times New Roman", sz: 11 }, 
        border: { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } },
        alignment: { vertical: "center", wrapText: true }
    };
    const centerStyle = { ...cellStyle, alignment: { horizontal: "center", vertical: "center" } };

    // Content Injection
    XLSX.utils.sheet_add_aoa(ws, [
        ["CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM"],
        ["Độc lập - Tự do - Hạnh phúc"],
        [""],
        ["BÁO CÁO TÌNH HÌNH TIẾP NHẬN VÀ GIẢI QUYẾT HỒ SƠ"],
        [`Từ ngày ${formatDate(fromDateStr)} đến ngày ${formatDate(toDateStr)}`],
        [""],
        [`Tổng số: ${total} | Đã xong: ${completed} | Đang giải quyết: ${processing} | Trễ hạn: ${overdue}`],
        [""],
        tableHeader
    ], { origin: "A1" });

    XLSX.utils.sheet_add_aoa(ws, dataRows, { origin: "A10" });

    // Formatting
    ws['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 9 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: 9 } },
        { s: { r: 3, c: 0 }, e: { r: 3, c: 9 } },
        { s: { r: 4, c: 0 }, e: { r: 4, c: 9 } },
        { s: { r: 6, c: 0 }, e: { r: 6, c: 9 } }
    ];
    ws['!cols'] = [{ wch: 5 }, { wch: 15 }, { wch: 25 }, { wch: 20 }, { wch: 20 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 15 }, { wch: 20 }];

    // Apply Styles
    if(ws['A1']) ws['A1'].s = titleStyle;
    if(ws['A2']) ws['A2'].s = { font: { name: "Times New Roman", sz: 12, bold: true, underline: true }, alignment: { horizontal: "center" } };
    if(ws['A4']) ws['A4'].s = { font: { name: "Times New Roman", sz: 16, bold: true, color: { rgb: "0000FF" } }, alignment: { horizontal: "center" } };
    if(ws['A5']) ws['A5'].s = subTitleStyle;
    if(ws['A7']) ws['A7'].s = { font: { name: "Times New Roman", sz: 12, bold: true }, alignment: { horizontal: "center" }, fill: { fgColor: { rgb: "FFFACD" } } };

    // Table Styles
    for (let c = 0; c < 10; c++) {
        const headerRef = XLSX.utils.encode_cell({ r: 9, c });
        if (!ws[headerRef]) ws[headerRef] = { v: "", t: "s" };
        ws[headerRef].s = headerStyle;

        for (let r = 10; r < 10 + dataRows.length; r++) {
            const cellRef = XLSX.utils.encode_cell({ r, c });
            if (!ws[cellRef]) ws[cellRef] = { v: "", t: "s" };
            if ([0, 5, 6, 7, 8].includes(c)) ws[cellRef].s = centerStyle;
            else ws[cellRef].s = cellStyle;
        }
    }

    // Footer
    const lastRow = 9 + dataRows.length + 2;
    XLSX.utils.sheet_add_aoa(ws, [
        ["NGƯỜI LẬP BIỂU", "", "", "", "", "", "", "THỦ TRƯỞNG ĐƠN VỊ"],
        ["(Ký, họ tên)", "", "", "", "", "", "", "(Ký, họ tên, đóng dấu)"]
    ], { origin: `A${lastRow}` });
    
    ws['!merges'].push(
        { s: { r: lastRow - 1, c: 0 }, e: { r: lastRow - 1, c: 2 } },
        { s: { r: lastRow, c: 0 }, e: { r: lastRow, c: 2 } },
        { s: { r: lastRow - 1, c: 7 }, e: { r: lastRow - 1, c: 9 } },
        { s: { r: lastRow, c: 7 }, e: { r: lastRow, c: 9 } }
    );
    
    const footerStyle = { font: { name: "Times New Roman", sz: 12, bold: true }, alignment: { horizontal: "center" } };
    
    const leftTitle = XLSX.utils.encode_cell({r: lastRow - 1, c: 0});
    const rightTitle = XLSX.utils.encode_cell({r: lastRow - 1, c: 7});
    if(ws[leftTitle]) ws[leftTitle].s = footerStyle;
    if(ws[rightTitle]) ws[rightTitle].s = footerStyle;

    XLSX.utils.book_append_sheet(wb, ws, "Bao Cao");
    const fileName = `Bao_Cao_${fromDateStr}_${toDateStr}.xlsx`;
    XLSX.writeFile(wb, fileName);
};
