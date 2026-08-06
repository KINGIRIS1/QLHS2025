
import { useState, useEffect, useCallback, useRef } from 'react';
import { RecordFile, Employee, User, RecordStatus, Holiday } from '../types';
import { 
    fetchRecords, fetchEmployees, fetchUsers, fetchUpdateInfo, fetchHolidays,
    createRecordApi, updateRecordApi, deleteRecordApi, createRecordsBatchApi,
    saveEmployeeApi, deleteEmployeeApi, saveUserApi, deleteUserApi, deleteAllDataApi,
    initRealtimeRecords
} from '../services/api';
import { saveArchiveRecord, findArchiveRecordBySoHieu, deleteArchiveRecord } from '../services/apiArchive';
import { logUserActivity } from '../services/apiLogs';
import { DEFAULT_WARDS as STATIC_WARDS, APP_VERSION } from '../constants';
import { triggerPrioritySignedAlert } from '../utils/appHelpers';

export const useAppData = (currentUser: User | null) => {
    const [records, setRecords] = useState<RecordFile[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [holidays, setHolidays] = useState<Holiday[]>([]); // State mới cho ngày nghỉ
    const [connectionStatus, setConnectionStatus] = useState<'connected' | 'offline'>('connected');
    
    // Wards State
    const [wards, setWards] = useState<string[]>(() => {
        const saved = localStorage.getItem('wards_list');
        return saved ? JSON.parse(saved) : STATIC_WARDS;
    });

    // Update Info State
    const [isUpdateAvailable, setIsUpdateAvailable] = useState(false);
    const [latestVersion, setLatestVersion] = useState('');
    const [updateUrl, setUpdateUrl] = useState<string | null>(null);

    const loadData = useCallback(async () => {
        try {
            // Tạo timeout promise để tránh việc fetch bị treo mãi mãi
            // Tăng timeout lên 30s để xử lý trường hợp mạng chậm hoặc DB bị sleep
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error("Timeout")), 30000)
            );

            const dataPromise = Promise.all([
                fetchRecords(),
                fetchEmployees(),
                fetchUsers(),
                fetchUpdateInfo(),
                fetchHolidays() // Tải thêm danh sách ngày nghỉ
            ]);

            // Race giữa fetch data và timeout
            const [recData, empData, userData, updateInfo, holidayData] = await Promise.race([dataPromise, timeoutPromise]) as any;

            setRecords(recData);
            setEmployees(empData);
            setUsers(userData);
            setHolidays(holidayData); // Cập nhật state holidays
            setConnectionStatus('connected');

            if (updateInfo && updateInfo.version && updateInfo.version !== APP_VERSION) {
                setIsUpdateAvailable(true);
                setLatestVersion(updateInfo.version);
                setUpdateUrl(updateInfo.url);
            }
        } catch (error) {
            console.error("Lỗi tải dữ liệu hoặc Timeout:", error);
            // Quan trọng: Khi lỗi, chuyển sang OFFLINE nhưng vẫn cho phép App hoạt động
            // Dữ liệu sẽ được lấy từ Cache (đã xử lý trong apiCore)
            setConnectionStatus('offline');
            
            // Nếu cache cũng rỗng (lần đầu chạy), khởi tạo mảng rỗng để không crash UI
            setRecords((prev) => prev.length > 0 ? prev : []);
            setEmployees((prev) => prev.length > 0 ? prev : []);
            setUsers((prev) => prev.length > 0 ? prev : []);
            // Holidays sẽ tự lấy từ cache trong apiSystem nếu lỗi
        }
    }, []);

    const currentUserRef = useRef(currentUser);
    useEffect(() => {
        currentUserRef.current = currentUser;
    }, [currentUser]);

    // Initial Load
    useEffect(() => {
        loadData();
        // Removed setInterval to reduce PostgREST egress
        
        // Bật realtime và lắng nghe thay đổi
        initRealtimeRecords();
        
        const handleRecordsUpdate = async () => {
            // Lấy trực tiếp từ cache (đã được update bởi Realtime) và gán luôn để UI phản hồi tức thì
            const freshRecords = await fetchRecords();
            setRecords(freshRecords);
        };
        
        const handleSystemUpdate = async () => {
            const updateInfo = await fetchUpdateInfo();
            console.log("[DEBUG] handleSystemUpdate:", updateInfo, "APP_VERSION:", APP_VERSION);
            if (updateInfo && updateInfo.version && updateInfo.version !== APP_VERSION) {
                console.log("[DEBUG] Triggering setIsUpdateAvailable");
                setIsUpdateAvailable(true);
                setLatestVersion(updateInfo.version);
                setUpdateUrl(updateInfo.url);
            }
        };
        
        // Initial check on mount
        handleSystemUpdate();
        
        // Check periodically
        const updateInterval = setInterval(handleSystemUpdate, 5 * 60 * 1000);
        
        const handleBroadcast = (e: any) => {
            const rawPayload = e.detail;
            const payload = rawPayload && rawPayload.payload ? rawPayload.payload : rawPayload;
            
            if (payload && (payload.target === 'all' || (currentUserRef.current && payload.target === currentUserRef.current.username))) {
                console.log(`[DEBUG] Update request received for target: ${payload.target}`);
                if (payload.version) {
                    if (payload.version !== APP_VERSION) {
                        setIsUpdateAvailable(true);
                        setLatestVersion(payload.version);
                        if (payload.url) setUpdateUrl(payload.url);
                    }
                } else {
                    // Fallback to fetch if payload doesn't contain version info
                    fetchUpdateInfo().then(info => {
                        if (info && info.version && info.version !== APP_VERSION) {
                            setIsUpdateAvailable(true);
                            setLatestVersion(info.version);
                            if (info.url) setUpdateUrl(info.url);
                        }
                    });
                }
            }
        };
        
        window.addEventListener('system_update_available_broadcast', handleBroadcast);
        window.addEventListener('records_realtime_update', handleRecordsUpdate);
        window.addEventListener('system_update_available', handleSystemUpdate);
        
        return () => {
            clearInterval(updateInterval);
            window.removeEventListener('system_update_available_broadcast', handleBroadcast);
            window.removeEventListener('records_realtime_update', handleRecordsUpdate);
            window.removeEventListener('system_update_available', handleSystemUpdate);
        };
    }, [loadData]);

    // --- Record Handlers ---
    const handleAddOrUpdateRecord = async (recordData: any) => {
        const isSaoLuc = recordData.recordType === 'Sao lục hồ sơ' || recordData.recordType === 'Sao lục' || recordData._archiveType === 'saoluc';
        const isEdit = recordData.id && (records.some(r => r.id === recordData.id) || recordData._isArchive);

        if (isSaoLuc) {
            const saoLucData = {
                so_hieu: recordData.code || '',
                chu_su_dung: recordData.customerName || '',
                ten_chu_su_dung: recordData.customerName || '',
                xa_phuong: recordData.ward || '',
                dia_danh: recordData.ward || '',
                to_ban_do: recordData.mapSheet || '',
                so_to: recordData.mapSheet || '',
                thua_dat: recordData.landPlot || '',
                so_thua: recordData.landPlot || '',
                dien_tich: recordData.area || 0,
                tong_dien_tich: recordData.area || 0,
                area: recordData.area || 0,
                ngay_nhan: recordData.receivedDate || '',
                hen_tra: recordData.deadline || '',
                noi_dung: recordData.content || '',
                trich_yeu: recordData.content || '',
                
                // Bổ sung đầy đủ các trường nhập từ Tiếp Nhận
                so_dien_thoai: recordData.phoneNumber || '',
                so_dt: recordData.phoneNumber || '',
                phoneNumber: recordData.phoneNumber || '',
                cccd: recordData.cccd || '',
                nguoi_uy_quyen: recordData.authorizedBy || '',
                authorizedBy: recordData.authorizedBy || '',
                loai_uy_quyen: recordData.authDocType || '',
                authDocType: recordData.authDocType || '',
                giay_to_kem_theo: recordData.otherDocs || '',
                otherDocs: recordData.otherDocs || '',
                dia_chi: recordData.address || '',
                address: recordData.address || '',
                notes: recordData.notes || '',
                privateNotes: recordData.privateNotes || '',
                loai_ho_so: recordData.recordType || 'Sao lục hồ sơ',
                nguoi_tiep_nhan: recordData.createdBy || (currentUser?.name || ''),
                createdBy: recordData.createdBy || (currentUser?.name || ''),
                
                status: 'draft',
                ngay_hoan_thanh: recordData.exportDate || recordData.workCompletedDate || '',
                danh_sach: recordData.exportBatch || ''
            };

            if (!isEdit) {
                const arToSave = {
                    type: 'saoluc' as 'saoluc',
                    status: 'draft' as any,
                    so_hieu: recordData.code,
                    trich_yeu: recordData.content || '',
                    ngay_thang: recordData.receivedDate || new Date().toISOString().split('T')[0],
                    noi_nhan_gui: recordData.customerName || '',
                    data: saoLucData,
                    created_by: recordData.createdBy || (currentUser?.name || ''),
                    created_at: new Date().toISOString()
                };
                const archiveSuccess = await saveArchiveRecord(arToSave);
                if (!archiveSuccess) {
                    return false;
                }
            } else {
                try {
                    let existingArchive = await findArchiveRecordBySoHieu('saoluc', recordData.code);
                    if (existingArchive) {
                        const archId = existingArchive.id;
                        const archData = existingArchive.data || {};
                        await saveArchiveRecord({
                            id: archId,
                            type: 'saoluc' as 'saoluc',
                            status: existingArchive.status || 'draft',
                            so_hieu: recordData.code,
                            trich_yeu: recordData.content || existingArchive.trich_yeu || '',
                            ngay_thang: recordData.receivedDate || existingArchive.ngay_thang || '',
                            noi_nhan_gui: recordData.customerName || existingArchive.noi_nhan_gui || '',
                            data: { ...archData, ...saoLucData },
                        });
                    } else if (recordData._isArchive && recordData.id) {
                        await saveArchiveRecord({
                            id: recordData.id,
                            type: 'saoluc' as 'saoluc',
                            status: recordData.status || 'draft',
                            so_hieu: recordData.code,
                            trich_yeu: recordData.content || '',
                            ngay_thang: recordData.receivedDate || '',
                            noi_nhan_gui: recordData.customerName || '',
                            data: saoLucData,
                        });
                    } else {
                        const arToSave = {
                            type: 'saoluc' as 'saoluc',
                            status: 'draft' as any,
                            so_hieu: recordData.code,
                            trich_yeu: recordData.content || '',
                            ngay_thang: recordData.receivedDate || new Date().toISOString().split('T')[0],
                            noi_nhan_gui: recordData.customerName || '',
                            data: saoLucData,
                            created_by: recordData.createdBy || (currentUser?.name || ''),
                            created_at: new Date().toISOString()
                        };
                        await saveArchiveRecord(arToSave);
                    }
                } catch (e) {
                    console.error("Lỗi cập nhật archive_record khi edit:", e);
                }
            }
            // Chỉ lưu vào archive_records, KHÔNG thêm vào bảng tiếp nhận chung (records)
            return true;
        }

        if (isEdit) {
            const oldRecord = records.find(r => r.id === recordData.id);
            const updated = await updateRecordApi(recordData);
            if (updated) {
                setRecords(prev => prev.map(r => r.id === updated.id ? updated : r));
                triggerPrioritySignedAlert(updated, updated.status);
                logUserActivity({
                    action: 'UPDATE',
                    targetType: 'RECORD',
                    targetId: updated.id,
                    targetCode: updated.code,
                    details: `Cập nhật thông tin hồ sơ ${updated.code} (${updated.customerName || 'N/A'})`,
                    user: currentUser,
                    oldData: oldRecord,
                    newData: updated
                });
                return true;
            }
        } else {
            const newRecord = await createRecordApi({ ...recordData, id: Math.random().toString(36).substr(2, 9) });
            if (newRecord) {
                setRecords(prev => [newRecord, ...prev]);
                triggerPrioritySignedAlert(newRecord, newRecord.status);
                logUserActivity({
                    action: 'CREATE',
                    targetType: 'RECORD',
                    targetId: newRecord.id,
                    targetCode: newRecord.code,
                    details: `Tạo mới hồ sơ ${newRecord.code} - ${newRecord.customerName || 'N/A'} (Loại: ${newRecord.recordType || 'N/A'})`,
                    user: currentUser,
                    newData: newRecord
                });
                return true;
            }
        }
        return false;
    };

    const handleDeleteRecord = async (id: string) => {
        const deletedRecord = records.find(r => r.id === id);
        const hasInRecords = records.some(r => r.id === id);
        if (hasInRecords) {
            const success = await deleteRecordApi(id);
            if (success) {
                setRecords(prev => prev.filter(r => r.id !== id));
                logUserActivity({
                    action: 'DELETE',
                    targetType: 'RECORD',
                    targetId: id,
                    targetCode: deletedRecord?.code || id,
                    details: `Xóa hồ sơ ${deletedRecord?.code || id} (${deletedRecord?.customerName || 'N/A'})`,
                    user: currentUser,
                    oldData: deletedRecord
                });
            }
            return success;
        } else {
            // Nếu không có trong records (hoặc là hồ sơ chỉ nằm trong archive_records), thực hiện xóa ở archive_records
            const success = await deleteArchiveRecord(id);
            if (success) {
                window.dispatchEvent(new CustomEvent('archive_realtime_update', { detail: { type: 'saoluc' } }));
                logUserActivity({
                    action: 'DELETE',
                    targetType: 'ARCHIVE',
                    targetId: id,
                    details: `Xóa hồ sơ lưu trữ sao lục (ID: ${id})`,
                    user: currentUser
                });
            }
            return success;
        }
    };

    const handleImportRecords = async (newRecords: RecordFile[]) => {
        const success = await createRecordsBatchApi(newRecords);
        if (success) {
            await loadData();
            logUserActivity({
                action: 'CREATE',
                targetType: 'RECORD',
                details: `Nhập khẩu ${newRecords.length} hồ sơ từ tệp Excel`,
                user: currentUser
            });
            return true;
        }
        return false;
    };

    const handleBatchUpdate = async (updatedRecords: RecordFile[]) => {
        // Optimistic update
        const updatedIds = updatedRecords.map(r => r.id);
        setRecords(prev => prev.map(r => {
            const found = updatedRecords.find(u => u.id === r.id);
            return found ? found : r;
        }));
    };

    // --- Employee Handlers ---
    const handleSaveEmployee = async (emp: Employee) => {
        const exists = employees.find(e => e.id === emp.id);
        const savedEmp = await saveEmployeeApi(emp, !!exists);
        if (savedEmp) {
            if (exists) setEmployees(prev => prev.map(e => e.id === savedEmp.id ? savedEmp : e));
            else setEmployees(prev => [...prev, savedEmp]);

            logUserActivity({
                action: exists ? 'UPDATE' : 'CREATE',
                targetType: 'EMPLOYEE',
                targetId: savedEmp.id,
                targetCode: savedEmp.id,
                details: exists ? `Cập nhật nhân sự ${savedEmp.name} (${savedEmp.department || 'N/A'})` : `Thêm mới nhân sự ${savedEmp.name} (${savedEmp.department || 'N/A'})`,
                user: currentUser,
                oldData: exists,
                newData: savedEmp
            });
        }
    };

    const handleDeleteEmployee = async (id: string) => {
        const empToDelete = employees.find(e => e.id === id);
        const success = await deleteEmployeeApi(id);
        if (success) {
            setEmployees(prev => prev.filter(e => e.id !== id));
            logUserActivity({
                action: 'DELETE',
                targetType: 'EMPLOYEE',
                targetId: id,
                details: `Xóa nhân sự ${empToDelete?.name || id}`,
                user: currentUser,
                oldData: empToDelete
            });
        }
    };

    // --- User Handlers ---
    const handleUpdateUser = async (u: User, isUpdate: boolean) => {
        const oldUser = users.find(x => x.username === u.username);
        const res = await saveUserApi(u, isUpdate);
        if (res) {
            if (isUpdate) setUsers(prev => prev.map(x => x.username === u.username ? res : x));
            else setUsers(prev => [...prev, res]);

            logUserActivity({
                action: isUpdate ? 'UPDATE' : 'CREATE',
                targetType: 'USER',
                targetId: res.username,
                targetCode: res.username,
                details: isUpdate ? `Cập nhật tài khoản ${res.username} (${res.name})` : `Tạo tài khoản mới ${res.username} (${res.name})`,
                user: currentUser,
                oldData: oldUser,
                newData: res
            });
        }
        return res;
    };

    const handleDeleteUser = async (username: string) => {
        const userToDelete = users.find(u => u.username === username);
        const success = await deleteUserApi(username);
        if (success) {
            setUsers(prev => prev.filter(u => u.username !== username));
            logUserActivity({
                action: 'DELETE',
                targetType: 'USER',
                targetId: username,
                details: `Xóa tài khoản ${username} (${userToDelete?.name || ''})`,
                user: currentUser,
                oldData: userToDelete
            });
        }
    };

    // --- System Handlers ---
    const handleDeleteAllData = async () => {
        const success = await deleteAllDataApi();
        if (success) {
            setRecords([]);
            logUserActivity({
                action: 'DELETE',
                targetType: 'SYSTEM',
                details: `Thực hiện XÓA TOÀN BỘ DỮ LIỆU HỆ THỐNG`,
                user: currentUser
            });
            return true;
        }
        return false;
    };

    return {
        records, employees, users, wards, holidays, connectionStatus,
        isUpdateAvailable, latestVersion, updateUrl,
        setWards, setEmployees, setUsers, setRecords,
        loadData,
        handleAddOrUpdateRecord, handleDeleteRecord, handleImportRecords, handleBatchUpdate,
        handleSaveEmployee, handleDeleteEmployee,
        handleUpdateUser, handleDeleteUser,
        handleDeleteAllData
    };
};
