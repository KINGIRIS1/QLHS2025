
import { useState, useMemo, useEffect } from 'react';
import { RecordFile, User, UserRole, RecordStatus, Employee } from '../types';
import { removeVietnameseTones, isRecordOverdue, isRecordApproaching } from '../utils/appHelpers';

export const useRecordFilter = (
    records: RecordFile[],
    currentUser: User | null,
    currentView: string,
    employees: Employee[]
) => {
    // Filter States
    const [searchTerm, setSearchTerm] = useState('');
    const [filterDate, setFilterDate] = useState(''); 
    const [filterSpecificDate, setFilterSpecificDate] = useState('');
    const [filterFromDate, setFilterFromDate] = useState('');
    const [filterToDate, setFilterToDate] = useState('');
    const [showAdvancedDateFilter, setShowAdvancedDateFilter] = useState(false);
    
    const [filterWard, setFilterWard] = useState('all');
    const [filterStatus, setFilterStatus] = useState('all');
    const [filterEmployee, setFilterEmployee] = useState('all');
    const [warningFilter, setWarningFilter] = useState<'none' | 'overdue' | 'approaching'>('none');
    
    // Cập nhật type cho handoverTab để hỗ trợ 'returned'
    const [handoverTab, setHandoverTab] = useState<'today' | 'history' | 'returned'>('today');

    // Sorting & Pagination
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({
        key: 'receivedDate',
        direction: 'desc'
    });
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(20);

    // Reset pagination when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [currentView, sortConfig, warningFilter, filterWard, filterStatus, filterEmployee, filterSpecificDate, filterFromDate, filterToDate, handoverTab, searchTerm]);

    // --- WARNING CHECK LOGIC ---
    const checkWarningPermission = (r: RecordFile) => {
        if (!currentUser) return false;
        if (currentUser.role === UserRole.ONEDOOR) return false;
        if (currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.SUBADMIN) return true;
        if (currentUser.role === UserRole.EMPLOYEE) {
            return r.assignedTo === currentUser.employeeId;
        }
        if (currentUser.role === UserRole.TEAM_LEADER) {
            const leaderEmp = employees.find(e => e.id === currentUser.employeeId);
            if (!leaderEmp) return false; 
            const isMyTask = r.assignedTo === currentUser.employeeId;
            const isMyWard = leaderEmp.managedWards.some((w: string) => r.ward && r.ward.includes(w));
            return isMyTask || isMyWard;
        }
        return false; 
    };

    // --- FILTER LOGIC ---
    const filteredRecords = useMemo(() => {
        const uniqueMap = new Map();
        records.forEach(r => { if(r.id) uniqueMap.set(r.id, r); });
        
        let result = Array.from(uniqueMap.values()) as RecordFile[];

        // View-based filtering
        if (currentView === 'check_list') {
            result = result.filter(r => r.status === RecordStatus.PENDING_SIGN);
        } else if (currentView === 'handover_list') {
            if (handoverTab === 'today') {
                // Tab chờ giao: Bao gồm Đã ký HOẶC (Đã rút VÀ chưa có đợt xuất)
                result = result.filter(r => 
                    r.status === RecordStatus.SIGNED || 
                    (r.status === RecordStatus.WITHDRAWN && !r.exportBatch)
                );
            } else if (handoverTab === 'returned') {
                // Tab Đã trả kết quả: Status = RETURNED
                result = result.filter(r => r.status === RecordStatus.RETURNED);
                
                // CẬP NHẬT: Lọc theo khoảng thời gian (Từ ngày - Đến ngày) thay vì 1 ngày
                if (filterFromDate || filterToDate) {
                    result = result.filter(r => {
                        if (!r.resultReturnedDate) return false;
                        const returnDate = r.resultReturnedDate;
                        if (filterFromDate && returnDate < filterFromDate) return false;
                        if (filterToDate && returnDate > filterToDate) return false;
                        return true;
                    });
                }
            } else {
                // Tab Lịch sử giao: Bao gồm Đã giao HOẶC (Đã rút VÀ đã có đợt xuất)
                result = result.filter(r => 
                    r.status === RecordStatus.HANDOVER || 
                    (r.status === RecordStatus.WITHDRAWN && r.exportBatch)
                );
                // Giữ nguyên logic lọc ngày đơn cho Lịch sử giao (theo đợt)
                if (filterDate) {
                    result = result.filter(r => {
                        const dateToCheck = r.exportDate || r.completedDate;
                        return dateToCheck?.startsWith(filterDate);
                    });
                }
            }
        } else if (currentView === 'assign_tasks') {
            result = result.filter(r => r.status === RecordStatus.RECEIVED);
        }

        // Search Term
        if (searchTerm) {
            const lowerSearch = removeVietnameseTones(searchTerm);
            result = result.filter(r => {
                if (removeVietnameseTones(r.code).includes(lowerSearch)) return true;
                if (removeVietnameseTones(r.customerName).includes(lowerSearch)) return true;
                if (r.phoneNumber && r.phoneNumber.includes(searchTerm)) return true;
                if (removeVietnameseTones(r.ward || '').includes(lowerSearch)) return true;
                return false;
            });
        }

        // Ward, Status, Employee Filters
        if (filterWard !== 'all') {
            const wardSearch = removeVietnameseTones(filterWard);
            result = result.filter(r => removeVietnameseTones(r.ward || '').includes(wardSearch));
        }
        if (filterStatus !== 'all' && currentView !== 'handover_list') {
            result = result.filter(r => r.status === filterStatus);
        }
        if (filterEmployee !== 'all' && currentView !== 'assign_tasks') {
            if (filterEmployee === 'unassigned') result = result.filter(r => !r.assignedTo);
            else result = result.filter(r => r.assignedTo === filterEmployee);
        }

        // Date Filters (General for other views)
        if (currentView !== 'handover_list') {
            if (filterSpecificDate) {
                result = result.filter(r => r.receivedDate === filterSpecificDate);
            } else if (showAdvancedDateFilter) {
                if (filterFromDate || filterToDate) {
                    result = result.filter(r => {
                        if (!r.receivedDate) return false;
                        const rDate = r.receivedDate;
                        if (filterFromDate && rDate < filterFromDate) return false;
                        if (filterToDate && rDate > filterToDate) return false;
                        return true;
                    });
                }
            }
        }

        // Warning Filters
        if (warningFilter !== 'none' && currentUser) {
            if (warningFilter === 'overdue') {
                result = result.filter(r => isRecordOverdue(r) && checkWarningPermission(r));
            } else if (warningFilter === 'approaching') {
                result = result.filter(r => isRecordApproaching(r) && checkWarningPermission(r));
            }
        }

        // Sorting
        result.sort((a, b) => {
            let aVal: any = a[sortConfig.key as keyof RecordFile];
            let bVal: any = b[sortConfig.key as keyof RecordFile];
            if (!aVal) return 1; if (!bVal) return -1;
            if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });

        return result;
    }, [records, searchTerm, filterWard, filterStatus, filterEmployee, filterDate, filterSpecificDate, filterFromDate, filterToDate, showAdvancedDateFilter, warningFilter, currentView, sortConfig, handoverTab, currentUser, employees]);

    const paginatedRecords = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return filteredRecords.slice(start, start + itemsPerPage);
    }, [filteredRecords, currentPage, itemsPerPage]);

    const totalPages = Math.ceil(filteredRecords.length / itemsPerPage);

    // Warning Counts
    const warningCount = useMemo(() => {
        let overdue = 0;
        let approaching = 0;
        if (records.length > 0 && currentUser) {
            records.forEach(r => {
                if (r.status === RecordStatus.HANDOVER || r.status === RecordStatus.WITHDRAWN) return; 
                if (!checkWarningPermission(r)) return; 
                if (isRecordOverdue(r)) overdue++;
                else if (isRecordApproaching(r)) approaching++;
            });
        }
        return { overdue, approaching };
    }, [records, currentUser, employees]);

    return {
        filteredRecords, paginatedRecords, totalPages, warningCount,
        searchTerm, setSearchTerm,
        filterDate, setFilterDate,
        filterSpecificDate, setFilterSpecificDate,
        filterFromDate, setFilterFromDate,
        filterToDate, setFilterToDate,
        showAdvancedDateFilter, setShowAdvancedDateFilter,
        filterWard, setFilterWard,
        filterStatus, setFilterStatus,
        filterEmployee, setFilterEmployee,
        warningFilter, setWarningFilter,
        handoverTab, setHandoverTab,
        sortConfig, setSortConfig,
        currentPage, setCurrentPage,
        itemsPerPage, setItemsPerPage
    };
};
