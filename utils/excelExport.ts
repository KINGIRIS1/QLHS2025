
import * as XLSX from 'xlsx-js-style';
import { RecordFile, RecordStatus } from '../types';
import { getNormalizedWard, getShortRecordType, STATUS_LABELS } from '../constants';
import { isRecordOverdue } from './appHelpers';
import { fetchContracts } from '../services/api';

export const exportReportToExcel = async (records: RecordFile[], fromDateStr: string, toDateStr: string) => {
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

    // Lấy dữ liệu hợp đồng để map giá tiền
    let contracts: any[] = [];
    try {
        contracts = await fetchContracts();
    } catch (e) {
        console.warn("Không tải được dữ liệu hợp đồng cho báo cáo.");
    }

    // Helper find price
    const getContractAmount = (recordCode: string) => {
        if (!recordCode) return '';
        const match = contracts.find(c => c.code && c.code.toLowerCase().trim() === recordCode.toLowerCase().trim());
        return match && match.totalAmount ? match.totalAmount.toLocaleString('vi-VN') : '';
    };

    // Prepare Data
    const formatDate = (d: string | undefined | null) => {
        if (!d) return '';
        const date = new Date(d);
        if (isNaN(date.getTime())) return '';
        return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;
    };

    // Summary Stats
    let total = filtered.length;
    let completed = filtered.filter(r => r.status === RecordStatus.HANDOVER || r.status === RecordStatus.RETURNED).length;
    let processing = total - completed;
    let overdue = filtered.filter(r => isRecordOverdue(r)).length;

    // Table Header
    const tableHeader = [
        "STT", 
        "Mã Hồ Sơ", 
        "Chủ Sử Dụng", 
        "Địa Chỉ (Xã)", 
        "Loại Hồ Sơ", 
        "Số Biên Lai", 
        "Thành Tiền", 
        "Ngày Nhận", 
        "Hẹn Trả", 
        "Ngày hoàn thành",
        "Ngày trả kết quả",
        "Trạng Thái", 
        "Ghi Chú"
    ];
    
    const dataRows = filtered.map((r, i) => [
        i + 1,
        r.code,
        r.customerName,
        getNormalizedWard(r.ward),
        getShortRecordType(r.recordType),
        r.receiptNumber || '',
        getContractAmount(r.code),
        formatDate(r.receivedDate),
        formatDate(r.deadline),
        formatDate(r.completedDate),      
        formatDate(r.resultReturnedDate),
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
    const rightStyle = { ...cellStyle, alignment: { horizontal: "right", vertical: "center" } };

    // Content Injection
    XLSX.utils.sheet_add_aoa(ws, [
        ["CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM"], // 0
        ["Độc lập - Tự do - Hạnh phúc"],         // 1
        [""],                                    // 2
        ["BÁO CÁO TÌNH HÌNH TIẾP NHẬN VÀ GIẢI QUYẾT HỒ SƠ"], // 3
        [`Từ ngày ${formatDate(fromDateStr)} đến ngày ${formatDate(toDateStr)}`], // 4
        [""],                                    // 5
        [`Tổng số: ${total} | Đã xong: ${completed} | Đang giải quyết: ${processing} | Trễ hạn: ${overdue}`], // 6
        [""],                                    // 7
        tableHeader                              // 8 (A9)
    ], { origin: "A1" });

    // Dữ liệu bắt đầu từ dòng 9 (A10)
    XLSX.utils.sheet_add_aoa(ws, dataRows, { origin: "A10" });

    // Formatting Merges
    const totalCols = tableHeader.length - 1; 
    ws['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: totalCols } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: totalCols } },
        { s: { r: 3, c: 0 }, e: { r: 3, c: totalCols } },
        { s: { r: 4, c: 0 }, e: { r: 4, c: totalCols } },
        { s: { r: 6, c: 0 }, e: { r: 6, c: totalCols } }
    ];
    
    // Column Widths
    ws['!cols'] = [
        { wch: 5 },  // STT
        { wch: 15 }, // Mã HS
        { wch: 25 }, // Chủ SD
        { wch: 18 }, // Địa Chỉ
        { wch: 18 }, // Loại HS
        { wch: 12 }, // Số BL
        { wch: 15 }, // Thành tiền
        { wch: 12 }, // Ngày Nhận
        { wch: 12 }, // Hẹn Trả
        { wch: 14 }, // Ngày hoàn thành
        { wch: 14 }, // Ngày trả kết quả
        { wch: 15 }, // Trạng thái
        { wch: 20 }  // Ghi chú
    ];

    // Apply Styles
    if(ws['A1']) ws['A1'].s = titleStyle;
    if(ws['A2']) ws['A2'].s = { font: { name: "Times New Roman", sz: 12, bold: true, underline: true }, alignment: { horizontal: "center" } };
    if(ws['A4']) ws['A4'].s = { font: { name: "Times New Roman", sz: 16, bold: true, color: { rgb: "0000FF" } }, alignment: { horizontal: "center" } };
    if(ws['A5']) ws['A5'].s = subTitleStyle;
    if(ws['A7']) ws['A7'].s = { font: { name: "Times New Roman", sz: 12, bold: true }, alignment: { horizontal: "center", fill: { fgColor: { rgb: "FFFACD" } } } };

    const headerRowIdx = 8;
    const dataStartIdx = 9;
    const totalDataRows = dataRows.length;

    for (let c = 0; c <= totalCols; c++) {
        const headerRef = XLSX.utils.encode_cell({ r: headerRowIdx, c });
        if (!ws[headerRef]) ws[headerRef] = { v: "", t: "s" };
        ws[headerRef].s = headerStyle;

        for (let r = dataStartIdx; r < dataStartIdx + totalDataRows; r++) {
            const cellRef = XLSX.utils.encode_cell({ r, c });
            if (!ws[cellRef]) ws[cellRef] = { v: "", t: "s" };
            
            if ([0, 5, 7, 8, 9, 10].includes(c)) ws[cellRef].s = centerStyle;
            else if (c === 6) ws[cellRef].s = rightStyle;
            else ws[cellRef].s = cellStyle;
        }
    }

    const lastRow = dataStartIdx + totalDataRows + 2;
    XLSX.utils.sheet_add_aoa(ws, [
        ["NGƯỜI LẬP BIỂU", "", "", "", "", "", "", "", "", "", "THỦ TRƯỞNG ĐƠN VỊ", "", ""],
        ["(Ký, họ tên)", "", "", "", "", "", "", "", "", "", "(Ký, họ tên, đóng dấu)", "", ""]
    ], { origin: `A${lastRow}` });
    
    ws['!merges'].push(
        { s: { r: lastRow - 1, c: 0 }, e: { r: lastRow - 1, c: 2 } },
        { s: { r: lastRow, c: 0 }, e: { r: lastRow, c: 2 } },
        { s: { r: lastRow - 1, c: 10 }, e: { r: lastRow - 1, c: 12 } },
        { s: { r: lastRow, c: 10 }, e: { r: lastRow, c: 12 } }
    );
    
    const footerStyle = { font: { name: "Times New Roman", sz: 12, bold: true }, alignment: { horizontal: "center" } };
    
    const leftTitle = XLSX.utils.encode_cell({r: lastRow - 1, c: 0});
    const rightTitle = XLSX.utils.encode_cell({r: lastRow - 1, c: 10});
    if(ws[leftTitle]) ws[leftTitle].s = footerStyle;
    if(ws[rightTitle]) ws[rightTitle].s = footerStyle;

    XLSX.utils.book_append_sheet(wb, ws, "Bao Cao");
    const fileName = `Bao_Cao_${fromDateStr}_${toDateStr}.xlsx`;
    XLSX.writeFile(wb, fileName);
};

// --- NEW FUNCTION: Export Returned List ---
export const exportReturnedListToExcel = (records: RecordFile[], dateStr?: string) => {
    if (records.length === 0) {
        alert("Không có hồ sơ nào để xuất.");
        return;
    }

    const formatDate = (d: string | undefined | null) => {
        if (!d) return '';
        const date = new Date(d);
        if (isNaN(date.getTime())) return '';
        return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;
    };

    const tableHeader = [
        "STT", "Mã Hồ Sơ", "Chủ Sử Dụng", "Địa Chỉ", "Loại Hồ Sơ", "Số Biên Lai", "Ngày Hẹn", "Ngày Trả Kết Quả", "Người Nhận / Ghi Chú"
    ];

    const dataRows = records.map((r, i) => [
        i + 1,
        r.code,
        r.customerName,
        getNormalizedWard(r.ward),
        getShortRecordType(r.recordType),
        r.receiptNumber || '',
        formatDate(r.deadline),
        formatDate(r.resultReturnedDate),
        r.notes || ''
    ]);

    const displayDate = dateStr 
        ? `Ngày ${dateStr.split('-')[2]} tháng ${dateStr.split('-')[1]} năm ${dateStr.split('-')[0]}` 
        : `Tính đến ngày ${new Date().toLocaleDateString('vi-VN')}`;

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([]);

    // Styles
    const border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
    const titleStyle = { font: { name: "Times New Roman", sz: 14, bold: true }, alignment: { horizontal: "center" } };
    const headerStyle = { 
        font: { name: "Times New Roman", sz: 11, bold: true }, 
        border, fill: { fgColor: { rgb: "E0E0E0" } }, 
        alignment: { horizontal: "center", vertical: "center", wrapText: true } 
    };
    const cellStyle = { font: { name: "Times New Roman", sz: 11 }, border, alignment: { vertical: "center", wrapText: true } };
    const centerStyle = { ...cellStyle, alignment: { horizontal: "center", vertical: "center" } };

    // Content
    XLSX.utils.sheet_add_aoa(ws, [
        ["CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM"],
        ["Độc lập - Tự do - Hạnh phúc"],
        [""],
        ["DANH SÁCH HỒ SƠ ĐÃ TRẢ KẾT QUẢ"],
        [displayDate.toUpperCase()],
        [""],
        tableHeader
    ], { origin: "A1" });

    XLSX.utils.sheet_add_aoa(ws, dataRows, { origin: "A8" });

    // Merges
    const lastColIdx = 8;
    if(!ws['!merges']) ws['!merges'] = [];
    ws['!merges'].push(
        { s: { r: 0, c: 0 }, e: { r: 0, c: lastColIdx } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: lastColIdx } },
        { s: { r: 3, c: 0 }, e: { r: 3, c: lastColIdx } },
        { s: { r: 4, c: 0 }, e: { r: 4, c: lastColIdx } }
    );

    // Column Widths
    ws['!cols'] = [
        { wch: 5 }, { wch: 15 }, { wch: 25 }, { wch: 20 }, { wch: 20 }, { wch: 12 }, { wch: 12 }, { wch: 15 }, { wch: 25 }
    ];

    // Apply Styles
    if(ws['A1']) ws['A1'].s = titleStyle;
    if(ws['A2']) ws['A2'].s = { font: { name: "Times New Roman", sz: 12, bold: true, underline: true }, alignment: { horizontal: "center" } };
    if(ws['A4']) ws['A4'].s = { font: { name: "Times New Roman", sz: 14, bold: true }, alignment: { horizontal: "center" } };
    if(ws['A5']) ws['A5'].s = { font: { name: "Times New Roman", sz: 12, italic: true }, alignment: { horizontal: "center" } };

    const headerRow = 7;
    const dataStart = 8;
    
    for (let c = 0; c <= lastColIdx; c++) {
        const headerRef = XLSX.utils.encode_cell({ r: headerRow, c });
        if (!ws[headerRef]) ws[headerRef] = { v: "", t: "s" };
        ws[headerRef].s = headerStyle;

        for (let r = dataStart; r < dataStart + dataRows.length; r++) {
            const cellRef = XLSX.utils.encode_cell({ r, c });
            if (!ws[cellRef]) ws[cellRef] = { v: "", t: "s" };
            if ([0, 5, 6, 7].includes(c)) ws[cellRef].s = centerStyle;
            else ws[cellRef].s = cellStyle;
        }
    }

    // Footer
    const footerStart = dataStart + dataRows.length + 2;
    XLSX.utils.sheet_add_aoa(ws, [
        ["NGƯỜI LẬP BIỂU", "", "", "", "", "THỦ TRƯỞNG ĐƠN VỊ", "", "", ""],
        ["(Ký, họ tên)", "", "", "", "", "(Ký, họ tên)", "", "", ""]
    ], { origin: { r: footerStart, c: 0 } });

    ws['!merges'].push(
        { s: { r: footerStart, c: 0 }, e: { r: footerStart, c: 2 } },
        { s: { r: footerStart + 1, c: 0 }, e: { r: footerStart + 1, c: 2 } },
        { s: { r: footerStart, c: 5 }, e: { r: footerStart, c: 8 } },
        { s: { r: footerStart + 1, c: 5 }, e: { r: footerStart + 1, c: 8 } }
    );

    const footerTitleStyle = { font: { name: "Times New Roman", sz: 12, bold: true }, alignment: { horizontal: "center" } };
    const leftTitle = XLSX.utils.encode_cell({r: footerStart, c: 0});
    const rightTitle = XLSX.utils.encode_cell({r: footerStart, c: 5});
    if(ws[leftTitle]) ws[leftTitle].s = footerTitleStyle;
    if(ws[rightTitle]) ws[rightTitle].s = footerTitleStyle;

    XLSX.utils.book_append_sheet(wb, ws, "DS_Tra_KQ");
    const fileName = `DS_Tra_KQ_${dateStr || 'Tat_Ca'}.xlsx`;
    XLSX.writeFile(wb, fileName);
};
