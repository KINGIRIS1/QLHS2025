
import React from 'react';
import { RecordFile, Employee, User, RecordStatus } from '../types';
import RecordModal from './RecordModal';
import ImportModal from './ImportModal';
import SystemSettingsModal from './SystemSettingsModal';
import AssignModal from './AssignModal';
import DetailModal from './DetailModal';
import DeleteConfirmModal from './DeleteConfirmModal';
import ExportModal from './ExportModal';
import AddToBatchModal from './AddToBatchModal';
import ExcelPreviewModal from './ExcelPreviewModal';
import BulkUpdateModal from './BulkUpdateModal';
import ReturnResultModal from './ReturnResultModal';
import * as XLSX from 'xlsx-js-style';

interface AppModalsProps {
    // States
    isModalOpen: boolean;
    isImportModalOpen: boolean;
    isSettingsOpen: boolean; // Kept for prop compatibility but unused
    isSystemSettingsOpen: boolean;
    isAssignModalOpen: boolean;
    isDeleteModalOpen: boolean;
    isExportModalOpen: boolean;
    isAddToBatchModalOpen: boolean;
    isExcelPreviewOpen: boolean;
    isBulkUpdateModalOpen: boolean;
    isReturnModalOpen: boolean;
    
    // Data States
    editingRecord: RecordFile | null;
    viewingRecord: RecordFile | null;
    deletingRecord: RecordFile | null;
    returnRecord: RecordFile | null;
    assignTargetRecords: RecordFile[];
    exportModalType: 'handover' | 'check_list';
    
    // Preview Data
    previewWorkbook: XLSX.WorkBook | null;
    previewExcelName: string;

    // Setters
    setIsModalOpen: (v: boolean) => void;
    setIsImportModalOpen: (v: boolean) => void;
    setIsSettingsOpen: (v: boolean) => void;
    setIsSystemSettingsOpen: (v: boolean) => void;
    setIsAssignModalOpen: (v: boolean) => void;
    setIsDeleteModalOpen: (v: boolean) => void;
    setIsExportModalOpen: (v: boolean) => void;
    setIsAddToBatchModalOpen: (v: boolean) => void;
    setIsExcelPreviewOpen: (v: boolean) => void;
    setIsBulkUpdateModalOpen: (v: boolean) => void;
    setIsReturnModalOpen: (v: boolean) => void;
    
    setEditingRecord: (r: RecordFile | null) => void;
    setViewingRecord: (r: RecordFile | null) => void;
    setDeletingRecord: (r: RecordFile | null) => void;
    setReturnRecord: (r: RecordFile | null) => void;

    // Handlers
    handleAddOrUpdate: (data: any) => Promise<boolean>;
    handleImportRecords: (data: RecordFile[], mode: 'create' | 'update') => Promise<boolean>;
    handleSaveEmployee: (emp: Employee) => void;
    handleDeleteEmployee: (id: string) => void;
    handleDeleteAllData: () => void;
    confirmAssign: (empId: string) => void;
    handleDeleteRecord: () => void;
    confirmDelete: (r: RecordFile) => void;
    handleExcelPreview: (wb: XLSX.WorkBook, name: string) => void;
    executeBatchExport: (batch: number, date: string) => void;
    onCreateLiquidation: (record: RecordFile) => void;
    handleBulkUpdate: (field: keyof RecordFile, value: any) => Promise<void>;
    confirmReturnResult: (receiptNumber: string, receiverName: string) => void;

    // Shared Data
    employees: Employee[];
    currentUser: User;
    wards: string[];
    filteredRecords: RecordFile[];
    records: RecordFile[];
    selectedCount: number;
    canPerformAction: boolean;
    selectedRecordsForBulk: RecordFile[];
}

const AppModals: React.FC<AppModalsProps> = (props) => {
    // Xác định danh sách hồ sơ cần chốt để truyền vào modal (cho tính năng cảnh báo)
    const targetRecordsForBatch = props.selectedRecordsForBulk.length > 0 ? props.selectedRecordsForBulk : props.filteredRecords;

    return (
        <>
            <RecordModal 
                isOpen={props.isModalOpen}
                onClose={() => { props.setIsModalOpen(false); props.setEditingRecord(null); }}
                onSubmit={props.handleAddOrUpdate}
                initialData={props.editingRecord}
                employees={props.employees}
                currentUser={props.currentUser}
                wards={props.wards}
            />
            
            <ImportModal 
                isOpen={props.isImportModalOpen} 
                onClose={() => props.setIsImportModalOpen(false)} 
                onImport={props.handleImportRecords} 
                employees={props.employees} 
            />
            
            <SystemSettingsModal 
                isOpen={props.isSystemSettingsOpen} 
                onClose={() => props.setIsSystemSettingsOpen(false)} 
                onDeleteAllData={props.handleDeleteAllData}
            />

            <AssignModal 
                isOpen={props.isAssignModalOpen} 
                onClose={() => props.setIsAssignModalOpen(false)} 
                onConfirm={props.confirmAssign} 
                employees={props.employees} 
                selectedRecords={props.assignTargetRecords} 
            />
            
            <DetailModal 
                isOpen={!!props.viewingRecord} 
                onClose={() => props.setViewingRecord(null)} 
                record={props.viewingRecord} 
                employees={props.employees} 
                currentUser={props.currentUser} 
                onEdit={props.canPerformAction ? (r) => { props.setEditingRecord(r); props.setIsModalOpen(true); } : undefined}
                onDelete={props.canPerformAction ? props.confirmDelete : undefined}
                onCreateLiquidation={props.onCreateLiquidation}
            />
            
            <DeleteConfirmModal 
                isOpen={props.isDeleteModalOpen} 
                onClose={() => props.setIsDeleteModalOpen(false)} 
                onConfirm={props.handleDeleteRecord} 
                message={`Bạn có chắc chắn muốn xóa hồ sơ ${props.deletingRecord?.code}?`} 
            />
            
            <ExportModal 
                isOpen={props.isExportModalOpen} 
                onClose={() => props.setIsExportModalOpen(false)} 
                records={props.filteredRecords} 
                wards={props.wards} 
                type={props.exportModalType}
                onPreview={props.handleExcelPreview}
            />
            
            <AddToBatchModal
                isOpen={props.isAddToBatchModalOpen}
                onClose={() => props.setIsAddToBatchModalOpen(false)}
                onConfirm={props.executeBatchExport}
                records={props.records}
                selectedCount={props.selectedCount}
                targetRecords={targetRecordsForBatch} 
            />

            <ExcelPreviewModal 
                isOpen={props.isExcelPreviewOpen} 
                onClose={() => props.setIsExcelPreviewOpen(false)} 
                workbook={props.previewWorkbook} 
                fileName={props.previewExcelName} 
            />

            <BulkUpdateModal 
                isOpen={props.isBulkUpdateModalOpen}
                onClose={() => props.setIsBulkUpdateModalOpen(false)}
                selectedRecords={props.selectedRecordsForBulk}
                employees={props.employees}
                wards={props.wards}
                onConfirm={props.handleBulkUpdate}
            />

            <ReturnResultModal
                isOpen={props.isReturnModalOpen}
                onClose={() => { props.setIsReturnModalOpen(false); props.setReturnRecord(null); }}
                record={props.returnRecord}
                onConfirm={props.confirmReturnResult}
            />
        </>
    );
};

export default AppModals;
