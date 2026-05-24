import React, { useMemo } from "react";
import { RecordFile, Employee, WorkSchedule, RecordStatus } from "../../types";
import { exportTeamWeeklyReportToWord } from "../../utils/exportTeamWeeklyReport";
import { Download } from "lucide-react";
import { getShortRecordType, getNormalizedWard } from "../../constants";

interface TeamWeeklyDetailsViewProps {
  records: RecordFile[];
  employees: Employee[];
  schedules: WorkSchedule[];
  fromDate: string;
  toDate: string;
}

const TeamWeeklyDetailsView: React.FC<TeamWeeklyDetailsViewProps> = ({
  records,
  employees,
  schedules,
  fromDate,
  toDate,
}) => {
  // 1. Calculate General stats and Employee stats
  const reportData = useMemo(() => {
    const start = new Date(fromDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(toDate);
    end.setHours(23, 59, 59, 999);

    const allReceived: RecordFile[] = [];
    const allCompleted: RecordFile[] = [];
    const allCompletedWork: RecordFile[] = [];
    const allPendingSign: RecordFile[] = [];
    const allSchedules: WorkSchedule[] = [];

    // Map employee name to employee data
    const empMap = new Map<
      string,
      {
        employee: Employee;
        received: RecordFile[];
        completed: RecordFile[];
        completedWork: RecordFile[];
        pendingSign: RecordFile[];
        schedules: WorkSchedule[];
      }
    >();

    employees.forEach((emp) => {
      empMap.set(emp.id, {
        employee: emp,
        received: [],
        completed: [],
        completedWork: [],
        pendingSign: [],
        schedules: [],
      });
    });

    const finishedStatuses = [
      RecordStatus.COMPLETED_WORK,
      RecordStatus.PENDING_SIGN,
      RecordStatus.SIGNED,
      RecordStatus.HANDOVER,
      RecordStatus.RETURNED,
    ];

    // Process records
    records.forEach((r) => {
      // OVERALL STATS & EMPLOYEE STATS

      // 1. Hồ sơ nhận: Nhập vào hệ thống trong tuần này
      if (r.receivedDate) {
        const rDate = new Date(r.receivedDate);
        if (rDate >= start && rDate <= end) {
          allReceived.push(r);
          if (r.assignedTo && empMap.has(r.assignedTo)) {
            empMap.get(r.assignedTo)!.received.push(r);
          }
        }
      }

      // 2. Hồ sơ hoàn thành: Đã ký duyệt trở đi
      const isCompletedStatus = [
        RecordStatus.SIGNED,
        RecordStatus.HANDOVER,
        RecordStatus.RETURNED,
      ].includes(r.status);

      if (isCompletedStatus) {
        const cDateStr =
          r.approvalDate ||
          r.completedDate ||
          r.resultReturnedDate ||
          r.exportDate;
        if (cDateStr) {
          const cDate = new Date(cDateStr);
          if (cDate >= start && cDate <= end) {
            allCompleted.push(r);
            if (r.assignedTo && empMap.has(r.assignedTo)) {
              empMap.get(r.assignedTo)!.completed.push(r);
            }
          }
        }
      }

      // 3. Hồ sơ Đã thực hiện
      if (r.status === RecordStatus.COMPLETED_WORK) {
        if (r.workCompletedDate) {
          const wDate = new Date(r.workCompletedDate);
          if (wDate >= start && wDate <= end) {
            allCompletedWork.push(r);
            if (r.assignedTo && empMap.has(r.assignedTo)) {
              empMap.get(r.assignedTo)!.completedWork.push(r);
            }
          }
        }
      } else if (r.status === RecordStatus.PENDING_SIGN) {
        if (r.submissionDate) {
          const sDate = new Date(r.submissionDate);
          if (sDate >= start && sDate <= end) {
            allPendingSign.push(r);
            if (r.assignedTo && empMap.has(r.assignedTo)) {
              empMap.get(r.assignedTo)!.pendingSign.push(r);
            }
          }
        }
      }
    });

    // Function to remove Vietnamese tones for schedule matching by name
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

    // Process schedules
    schedules.forEach((s) => {
      const sd = new Date(s.date);
      if (sd >= start && sd <= end) {
        let isScheduleCounted = false;
        if (s.executors) {
          const execStr = removeVietnameseTones(s.executors);
          employees.forEach((emp) => {
            const nameTones = removeVietnameseTones(emp.name);
            if (execStr.includes(nameTones)) {
              empMap.get(emp.id)!.schedules.push(s);
              isScheduleCounted = true;
            }
          });
        }
        if (isScheduleCounted) {
          allSchedules.push(s);
        }
      }
    });

    const getGroupedTypes = (arr: RecordFile[]) => {
      const groups: Record<string, number> = {};
      arr.forEach((r) => {
        const t = getShortRecordType(r.recordType || "") || "Khác";
        groups[t] = (groups[t] || 0) + 1;
      });
      return groups;
    };

    const getGroupedByWard = (arr: RecordFile[]) => {
      const wards: Record<string, { total: number; types: Record<string, number> }> = {};
      arr.forEach((r) => {
        const w = getNormalizedWard(r.ward) || "Khác";
        if (!wards[w]) {
          wards[w] = { total: 0, types: {} };
        }
        wards[w].total += 1;
        
        const t = getShortRecordType(r.recordType || "") || "Khác";
        wards[w].types[t] = (wards[w].types[t] || 0) + 1;
      });
      return wards;
    };

    return {
      totalReceivedCount: allReceived.length,
      totalCompletedCount: allCompleted.length,
      totalCompletedWorkCount: allCompletedWork.length,
      totalPendingSignCount: allPendingSign.length,
      totalScheduleCount: allSchedules.length,
      receivedTypes: getGroupedTypes(allReceived),
      completedTypes: getGroupedTypes(allCompleted),
      completedWorkTypes: getGroupedTypes(allCompletedWork),
      pendingSignTypes: getGroupedTypes(allPendingSign),
      receivedByWard: getGroupedByWard(allReceived),
      completedByWard: getGroupedByWard(allCompleted),
      employeesData: Array.from(empMap.values()),
      allSchedules,
    };
  }, [records, employees, schedules, fromDate, toDate]);

  const handleExport = () => {
    exportTeamWeeklyReportToWord(reportData, fromDate, toDate);
  };

  return (
    <div className="h-full bg-white overflow-y-auto w-full p-6 animate-fade-in relative block">
      <div className="flex justify-between items-center mb-6 bg-gray-50 p-3 rounded-lg border border-gray-200">
        <h3 className="font-bold text-gray-800 uppercase text-base">
          Báo cáo chi tiết
        </h3>
        <button
          onClick={handleExport}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Download size={16} /> Xuất Báo Cáo Word
        </button>
      </div>

      <div
        className="bg-white border rounded-lg p-10 max-w-4xl mx-auto shadow-sm print:shadow-none print:border-none leading-relaxed text-base text-black"
        style={{
          fontFamily: '"Times New Roman", Times, serif',
          fontSize: "14pt",
        }}
      >
        {/* Header Hành chính */}
        <div className="flex justify-between mb-8 items-start">
          <div className="text-center w-5/12">
            <div className="font-bold uppercase">CƠ QUAN / ĐƠN VỊ CẤP TRÊN</div>
            <div className="font-bold uppercase">ĐƠN VỊ THỰC HIỆN</div>
            <div className="border-t-[1.5px] border-black w-24 mx-auto mt-1"></div>
          </div>
          <div className="text-center w-7/12">
            <div className="font-bold uppercase text-[14pt]">
              CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
            </div>
            <div className="font-bold">Độc lập - Tự do - Hạnh phúc</div>
            <div className="border-t-[1.5px] border-black w-40 mx-auto mt-1"></div>
          </div>
        </div>

        <div className="text-right italic mb-8">
          ........, ngày {new Date().getDate()} tháng{" "}
          {new Date().getMonth() + 1} năm {new Date().getFullYear()}
        </div>

        {/* Tiêu đề */}
        <h2 className="font-bold uppercase text-center mb-2">
          BÁO CÁO CÔNG TÁC
        </h2>
        <div className="text-center mb-8 italic">
          (Từ ngày {new Date(fromDate).toLocaleDateString("vi-VN")} đến ngày{" "}
          {new Date(toDate).toLocaleDateString("vi-VN")})
        </div>

        <h3 className="font-bold mb-3">I. BÁO CÁO TỔNG QUAN</h3>
        <ul className="list-none mb-6 space-y-2 text-justify pl-4">
          <li>
            <span className="font-bold">1. Tổng hồ sơ nhận:</span>{" "}
            {reportData.totalReceivedCount} hồ sơ
            {Object.keys(reportData.receivedTypes).length > 0 && (
              <div className="pl-6 mt-1 space-y-3">
                <ul className="list-none space-y-1">
                  {Object.entries(reportData.receivedTypes).map(
                    ([type, count]) => (
                      <li key={type}>
                        - {type}: {count} hồ sơ;
                      </li>
                    ),
                  )}
                </ul>
                
                {Object.keys(reportData.receivedByWard).length > 0 && (
                  <div>
                    <div className="font-bold mb-1 italic">* Chi tiết theo xã phường:</div>
                    <ul className="list-none space-y-2">
                      {Object.entries(reportData.receivedByWard).map(([ward, wardData]) => (
                        <li key={ward}>
                          <span className="font-semibold">- Xã/Phường {ward}: {wardData.total} hồ sơ</span>
                          <ul className="list-none pl-6 mt-1 space-y-1 text-gray-700">
                            {Object.entries(wardData.types).map(([type, count]) => (
                              <li key={type}>+ {type}: {count} hồ sơ</li>
                            ))}
                          </ul>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </li>
          <li>
            <span className="font-bold">2. Tổng hồ sơ hoàn thành:</span>{" "}
            {reportData.totalCompletedCount} hồ sơ
            {Object.keys(reportData.completedTypes).length > 0 && (
              <div className="pl-6 mt-1 space-y-3">
                <ul className="list-none space-y-1">
                  {Object.entries(reportData.completedTypes).map(
                    ([type, count]) => (
                      <li key={type}>
                        - {type}: {count} hồ sơ;
                      </li>
                    ),
                  )}
                </ul>

                {Object.keys(reportData.completedByWard).length > 0 && (
                  <div>
                    <div className="font-bold mb-1 italic">* Chi tiết theo xã phường:</div>
                    <ul className="list-none space-y-2">
                      {Object.entries(reportData.completedByWard).map(([ward, wardData]) => (
                        <li key={ward}>
                          <span className="font-semibold">- Xã/Phường {ward}: {wardData.total} hồ sơ</span>
                          <ul className="list-none pl-6 mt-1 space-y-1 text-gray-700">
                            {Object.entries(wardData.types).map(([type, count]) => (
                              <li key={type}>+ {type}: {count} hồ sơ</li>
                            ))}
                          </ul>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

              </div>
            )}
          </li>
          <li>
            <span className="font-bold">3. Tổng số hồ sơ đã thực hiện: </span>
            {reportData.totalCompletedWorkCount + reportData.totalPendingSignCount} hồ sơ
            {(reportData.totalCompletedWorkCount > 0 || reportData.totalPendingSignCount > 0) && (
              <div className="pl-6 mt-1 space-y-1">
                <div className="italic text-gray-700 mb-1">Trong đó:</div>
                <ul className="list-none space-y-1">
                  <li className="italic text-gray-700">
                    - Đã thực hiện (đang chờ kiểm tra):{" "}
                    {reportData.totalCompletedWorkCount} hồ sơ
                  </li>
                  <li className="italic text-gray-700">
                    - Đã thực hiện (chờ ký duyệt): {reportData.totalPendingSignCount} hồ
                    sơ
                  </li>
                </ul>
              </div>
            )}
          </li>
          <li>
            <span className="font-bold">4. Tổng lịch công tác:</span>{" "}
            {reportData.totalScheduleCount} lịch
          </li>
        </ul>

        <h3 className="font-bold mb-3 mt-8">
          II. BÁO CÁO THEO NHÂN VIÊN
        </h3>
        <div className="space-y-6 text-justify pl-4">
          {reportData.employeesData.map((data, index) => {
            // Received
            const receivedTypes: Record<string, number> = {};
            data.received.forEach((r) => {
              const t = getShortRecordType(r.recordType || "") || "Khác";
              receivedTypes[t] = (receivedTypes[t] || 0) + 1;
            });

            // Completed
            const completedTypes: Record<string, number> = {};
            data.completed.forEach((r) => {
              const t = getShortRecordType(r.recordType || "") || "Khác";
              completedTypes[t] = (completedTypes[t] || 0) + 1;
            });

            return (
              <div key={data.employee.id} className="mb-4">
                <p className="font-bold mb-2">
                  {index + 1}. {data.employee.name}{" "}
                  {data.employee.department
                    ? `(${data.employee.department})`
                    : ""}
                </p>
                <ul className="list-none pl-6 space-y-2">
                  <li>
                    <span className="font-bold">a) Số lượng hồ sơ nhận:</span>{" "}
                    {data.received.length} hồ sơ
                    {Object.keys(receivedTypes).length > 0 && (
                      <ul className="list-none pl-6 mt-1 space-y-1">
                        {Object.entries(receivedTypes).map(([type, count]) => (
                          <li key={type}>
                            - {type}: {count} hồ sơ;
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                  <li>
                    <span className="font-bold">b) Số hồ sơ hoàn thành:</span>{" "}
                    {data.completed.length} hồ sơ
                    {Object.keys(completedTypes).length > 0 && (
                      <ul className="list-none pl-6 mt-1 space-y-1">
                        {Object.entries(completedTypes).map(([type, count]) => (
                          <li key={type}>
                            - {type}: {count} hồ sơ;
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                  <li>
                    <span className="font-bold">c) Số hồ sơ đã thực hiện:</span>{" "}
                    {data.completedWork.length + data.pendingSign.length} hồ sơ
                    {(data.completedWork.length > 0 ||
                      data.pendingSign.length > 0) && (
                      <ul className="list-none pl-6 mt-1 space-y-1">
                        <li className="italic text-gray-700 mt-2">
                          Trong đó:
                        </li>
                        {data.completedWork.length > 0 && (
                          <li className="italic text-gray-700">
                            - Đã thực hiện (đang chờ kiểm tra):{" "}
                            {data.completedWork.length} hồ sơ
                          </li>
                        )}
                        {data.pendingSign.length > 0 && (
                          <li className="italic text-gray-700">
                            - Đã thực hiện (chờ ký duyệt): {data.pendingSign.length}{" "}
                            hồ sơ
                          </li>
                        )}
                      </ul>
                    )}
                  </li>
                  <li>
                    <span className="font-bold">d) Lịch công tác:</span>{" "}
                    {data.schedules.length} lịch
                    {data.schedules.length > 0 && (
                      <ul className="list-none pl-6 mt-1 space-y-1">
                        {data.schedules.map((s) => (
                          <li key={s.id}>
                            - Ngày{" "}
                            {new Date(s.date).toLocaleDateString("vi-VN")} (
                            {s.partner}): {s.content};
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                </ul>
              </div>
            );
          })}
        </div>

        {/* Chữ ký */}
        <div className="flex justify-end mt-16 pb-8">
          <div className="text-center w-1/3">
            <div className="font-bold">NGƯỜI LẬP BIỂU</div>
            <div
              className="italic mb-24 cursor-pointer text-gray-500 hover:text-black transition-colors"
              title="Bấm để chỉnh sửa người lập biểu"
            >
              (Ký, ghi rõ họ tên)
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TeamWeeklyDetailsView;
