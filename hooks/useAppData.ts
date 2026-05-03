
import { useState, useEffect, useCallback, useRef } from 'react';
import { RecordFile, Employee, User, RecordStatus, Holiday } from '../types';
import { 
    fetchRecords, fetchEmployees, fetchUsers, fetchUpdateInfo, fetchHolidays,
    createRecordApi, updateRecordApi, deleteRecordApi, createRecordsBatchApi,
    saveEmployeeApi, deleteEmployeeApi, saveUserApi, deleteUserApi, deleteAllDataApi,
    initRealtimeRecords
} from '../services/api';
import { DEFAULT_WARDS as STATIC_WARDS, APP_VERSION } from '../constants';

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
        const isEdit = recordData.id && records.find(r => r.id === recordData.id);
        if (isEdit) {
            const updated = await updateRecordApi(recordData);
            if (updated) {
                setRecords(prev => prev.map(r => r.id === updated.id ? updated : r));
                return true;
            }
        } else {
            const newRecord = await createRecordApi({ ...recordData, id: Math.random().toString(36).substr(2, 9) });
            if (newRecord) {
                setRecords(prev => [newRecord, ...prev]);
                return true;
            }
        }
        return false;
    };

    const handleDeleteRecord = async (id: string) => {
        const success = await deleteRecordApi(id);
        if (success) {
            setRecords(prev => prev.filter(r => r.id !== id));
        }
        return success;
    };

    const handleImportRecords = async (newRecords: RecordFile[]) => {
        const success = await createRecordsBatchApi(newRecords);
        if (success) {
            await loadData();
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
        }
    };

    const handleDeleteEmployee = async (id: string) => {
        const success = await deleteEmployeeApi(id);
        if (success) setEmployees(prev => prev.filter(e => e.id !== id));
    };

    // --- User Handlers ---
    const handleUpdateUser = async (u: User, isUpdate: boolean) => {
        const res = await saveUserApi(u, isUpdate);
        if (res) {
            if (isUpdate) setUsers(prev => prev.map(x => x.username === u.username ? res : x));
            else setUsers(prev => [...prev, res]);
        }
        return res;
    };

    const handleDeleteUser = async (username: string) => {
        const success = await deleteUserApi(username);
        if (success) setUsers(prev => prev.filter(u => u.username !== username));
    };

    // --- System Handlers ---
    const handleDeleteAllData = async () => {
        const success = await deleteAllDataApi();
        if (success) {
            setRecords([]);
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
