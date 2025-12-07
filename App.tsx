  // --- HÀM TẠO EXCEL PREVIEW CHO DANH SÁCH ---
  const handlePreviewList = () => {
      if (filteredRecords.length === 0) {
          alert("Danh sách trống, không có dữ liệu để xem.");
          return;
      }

      // 1. Chuẩn bị tiêu đề & dữ liệu
      let title = "DANH SÁCH HỒ SƠ";
      if (currentView === 'check_list') title = "DANH SÁCH HỒ SƠ TRÌNH KÝ";
      else if (currentView === 'handover_list') title = "DANH SÁCH TRẢ KẾT QUẢ";

      // CẬP NHẬT: Thêm thông tin Xã/Phường vào tiêu đề
      const wardTitle = filterWard !== 'all' ? `KHU VỰC: ${filterWard.toUpperCase()}` : "TOÀN BỘ ĐỊA BÀN";

      const dateParts = new Date().toLocaleDateString('vi-VN').split('/');
      const dateStr = `Ngày ${dateParts[0]} tháng ${dateParts[1]} năm ${dateParts[2]}`;

      // Header bảng
      const tableHeader = ["STT", "Mã Hồ Sơ", "Chủ Sử Dụng", "Địa Chỉ", "Loại Hồ Sơ", "Hẹn Trả", "Ghi Chú"];
      
      // Dữ liệu dòng
      const dataRows = filteredRecords.map((r, i) => [
          i + 1,
          r.code,
          r.customerName,
          r.address || r.ward,
          r.recordType,
          r.deadline ? new Date(r.deadline).toLocaleDateString('vi-VN') : '',
          r.content
      ]);

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([]);

      // 2. Định nghĩa Style (Chuẩn văn bản)
      const styles = {
          // Quốc hiệu
          nationalTitle: { font: { name: "Times New Roman", sz: 12, bold: true }, alignment: { horizontal: "center" } },
          nationalSlogan: { font: { name: "Times New Roman", sz: 12, bold: true, underline: true }, alignment: { horizontal: "center" } },
          // Tiêu đề báo cáo
          reportTitle: { font: { name: "Times New Roman", sz: 14, bold: true }, alignment: { horizontal: "center" } },
          reportSubTitle: { font: { name: "Times New Roman", sz: 12, italic: true }, alignment: { horizontal: "center" } },
          // Header bảng
          header: { 
              font: { name: "Times New Roman", sz: 11, bold: true }, 
              border: { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } }, 
              fill: { fgColor: { rgb: "E0E0E0" } }, 
              alignment: { horizontal: "center", vertical: "center", wrapText: true } 
          },
          // Cell dữ liệu bình thường
          cell: { 
              font: { name: "Times New Roman", sz: 11 }, 
              border: { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } },
              alignment: { vertical: "center", wrapText: true }
          },
          // Cell căn giữa (STT, Hẹn trả)
          cellCenter: {
              font: { name: "Times New Roman", sz: 11 }, 
              border: { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } },
              alignment: { horizontal: "center", vertical: "center", wrapText: true }
          },
          // Footer
          footerTitle: { font: { name: "Times New Roman", sz: 11, bold: true }, alignment: { horizontal: "center" } },
          footerNote: { font: { name: "Times New Roman", sz: 11, italic: true }, alignment: { horizontal: "center" } }
      };

      // 3. Xây dựng nội dung
      XLSX.utils.sheet_add_aoa(ws, [
          ["CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM"], // A1
          ["Độc lập - Tự do - Hạnh phúc"],         // A2
          [""],                                    // A3
          [title],                                 // A4
          [wardTitle],                             // A5 (Thêm dòng Xã/Phường)
          [dateStr],                               // A6
          [""],                                    // A7
          tableHeader                              // A8 (Header)
      ], { origin: "A1" });

      // Thêm dữ liệu từ A9 (Thay vì A8 như trước)
      XLSX.utils.sheet_add_aoa(ws, dataRows, { origin: "A9" });

      const lastRow = 8 + dataRows.length; // Index dòng cuối dữ liệu (0-based)
      const footerStart = lastRow + 2;

      // Thêm Footer (Chữ ký)
      XLSX.utils.sheet_add_aoa(ws, [
          ["BÊN GIAO", "", "", "", "BÊN NHẬN"],
          ["(Ký ghi rõ họ tên)", "", "", "", "(Ký ghi rõ họ tên)"]
      ], { origin: `A${footerStart + 1}` });

      // 4. Áp dụng Style & Merge
      // Merge tiêu đề
      ws['!merges'] = [
          { s: { r: 0, c: 0 }, e: { r: 0, c: 6 } }, // Quốc hiệu
          { s: { r: 1, c: 0 }, e: { r: 1, c: 6 } }, // Tiêu ngữ
          { s: { r: 3, c: 0 }, e: { r: 3, c: 6 } }, // Tên DS
          { s: { r: 4, c: 0 }, e: { r: 4, c: 6 } }, // Tên Xã (A5)
          { s: { r: 5, c: 0 }, e: { r: 5, c: 6 } }, // Ngày (A6)
          // Footer Merge
          { s: { r: footerStart, c: 0 }, e: { r: footerStart, c: 2 } },     // Bên trái
          { s: { r: footerStart + 1, c: 0 }, e: { r: footerStart + 1, c: 2 } },
          { s: { r: footerStart, c: 4 }, e: { r: footerStart, c: 6 } },     // Bên phải
          { s: { r: footerStart + 1, c: 4 }, e: { r: footerStart + 1, c: 6 } },
      ];

      // Độ rộng cột
      ws['!cols'] = [
          { wch: 5 }, { wch: 15 }, { wch: 22 }, { wch: 25 }, { wch: 20 }, { wch: 12 }, { wch: 15 }
      ];

      // Gán Style Header
      if(ws['A1']) ws['A1'].s = styles.nationalTitle;
      if(ws['A2']) ws['A2'].s = styles.nationalSlogan;
      if(ws['A4']) ws['A4'].s = styles.reportTitle;
      if(ws['A5']) ws['A5'].s = styles.reportSubTitle;
      if(ws['A6']) ws['A6'].s = styles.reportSubTitle;

      // Gán Style Bảng
      for(let c=0; c<=6; c++) { 
          // Header Row (A8 - Index 7)
          const ref = XLSX.utils.encode_cell({r: 7, c: c}); 
          if(!ws[ref]) ws[ref] = { v: "", t: "s"}; 
          ws[ref].s = styles.header; 
      }
      for(let r=8; r < 8 + dataRows.length; r++) { 
          for(let c=0; c<=6; c++) { 
              const ref = XLSX.utils.encode_cell({r: r, c: c}); 
              if(!ws[ref]) ws[ref] = { v: "", t: "s"}; 
              
              if(c === 0 || c === 5) ws[ref].s = styles.cellCenter; // Căn giữa STT, Hẹn trả
              else ws[ref].s = styles.cell; 
          } 
      }

      // Gán Style Footer
      const leftTitle = XLSX.utils.encode_cell({r: footerStart, c: 0});
      const leftNote = XLSX.utils.encode_cell({r: footerStart + 1, c: 0});
      const rightTitle = XLSX.utils.encode_cell({r: footerStart, c: 4});
      const rightNote = XLSX.utils.encode_cell({r: footerStart + 1, c: 4});

      if(ws[leftTitle]) ws[leftTitle].s = styles.footerTitle;
      if(ws[leftNote]) ws[leftNote].s = styles.footerNote;
      if(ws[rightTitle]) ws[rightTitle].s = styles.footerTitle;
      if(ws[rightNote]) ws[rightNote].s = styles.footerNote;

      XLSX.utils.book_append_sheet(wb, ws, "Danh Sach");
      
      setPreviewWorkbook(wb);
      setPreviewExcelName(`${title.replace(/\s/g, '_')}_${new Date().getTime()}`);
      setIsExcelPreviewOpen(true);
  };