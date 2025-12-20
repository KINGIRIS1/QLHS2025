
import React from 'react';
import { RecordFile, RecordStatus, Employee } from '../types';
import { getNormalizedWard, getShortRecordType } from '../constants';
import { isRecordOverdue, isRecordApproaching, toTitleCase } from '../utils/appHelpers';
import StatusBadge from './StatusBadge';
import { CheckSquare, Square, AlertCircle, Clock, Eye, ArrowRight, Pencil, Trash2, Bell } from 'lucide-react';

interface RecordRowProps {
  record: RecordFile;
  employees: Employee[];
  visibleColumns: Record<string, boolean>;
  isSelected: boolean;
  canPerformAction: boolean;
  onToggleSelect: (id: string) => void;
  onView: (record: RecordFile) => void;
  onEdit: (record: RecordFile) => void;
  onDelete: (record: RecordFile) => void;
  onAdvanceStatus: (record: RecordFile) => void;
  onQuickUpdate: (id: string, field: keyof RecordFile, value: string) => void;
}

const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? '' : `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getFullYear()).slice(-2)}`;
};

const RecordRow: React.FC<RecordRowProps> = ({
  record,
  employees,
  visibleColumns,
  isSelected,
  canPerformAction,
  onToggleSelect,
  onView,
  onEdit,
  onDelete,
  onAdvanceStatus,
  onQuickUpdate
}) => {
  const employee = employees.find(e => e.id === record.assignedTo);
  const isOverdue = isRecordOverdue(record);
  const isApproaching = isRecordApproaching(record);
  
  // Check if reminder is set and active (not finished)
  const hasActiveReminder = record.reminderDate && 
                            record.status !== RecordStatus.HANDOVER && 
                            record.status !== RecordStatus.WITHDRAWN;

  return (
    <tr className={`transition-all duration-200 group border-l-4 ${isOverdue ? 'bg-red-50 border-l-red-500 hover:bg-red-100' : isApproaching ? 'bg-orange-50 border-l-orange-500 hover:bg-orange-100' : isSelected ? 'bg-blue-50 border-l-blue-500 hover:bg-blue-100' : 'border-l-transparent hover:bg-blue-50/60 hover:shadow-sm'}`} onDoubleClick={() => onView(record)}>
      <td className="p-3 text-center align-middle">
        {canPerformAction ? (
          <button onClick={() => onToggleSelect(record.id)} className={`${isSelected ? 'text-blue-600' : 'text-gray-400'}`}>
            {isSelected ? <CheckSquare size={16} /> : <Square size={16} />}
          </button>
        ) : (
          <div className="w-4 h-4" />
        )}
      </td>
      
      {visibleColumns.code && (
        <td className="p-3 font-medium text-blue-600 cursor-pointer align-middle" onClick={() => { if(canPerformAction) onEdit(record); else onView(record); }}>
          <div className="flex items-center gap-1">
              <div className="truncate" title={record.code}>{record.code}</div>
              {hasActiveReminder && <Bell size={12} className="text-pink-500 fill-pink-500 shrink-0" />}
          </div>
          {isOverdue && <span className="inline-block px-1.5 py-0.5 bg-red-100 text-red-600 text-[10px] rounded border border-red-200 font-bold mt-1">Quá hạn</span>}
        </td>
      )}
      
      {visibleColumns.customer && <td className="p-3 font-medium text-gray-900 align-middle"><div className="truncate" title={record.customerName}>{toTitleCase(record.customerName)}</div></td>}
      {visibleColumns.phone && <td className="p-3 text-gray-500 align-middle">{record.phoneNumber || '--'}</td>}
      {visibleColumns.received && <td className="p-3 text-gray-600 align-middle">{formatDate(record.receivedDate)}</td>}
      
      {visibleColumns.deadline && (
        <td className="p-3 align-middle">
          <div className="flex items-center gap-1">
            <span className={`font-medium ${isOverdue ? 'text-red-700' : isApproaching ? 'text-orange-700' : 'text-gray-600'}`}>{formatDate(record.deadline)}</span>
            {isOverdue && <AlertCircle size={14} className="text-red-500 animate-pulse" />}
            {isApproaching && <Clock size={14} className="text-orange-500 animate-pulse" />}
          </div>
        </td>
      )}
      
      {visibleColumns.ward && <td className="p-3 text-gray-600 align-middle"><div className="truncate" title={getNormalizedWard(record.ward)}>{getNormalizedWard(record.ward) || '--'}</div></td>}
      {visibleColumns.group && <td className="p-3 align-middle"><div className="truncate" title={record.group}><span className="inline-block px-2 py-0.5 bg-gray-100 rounded text-xs text-gray-600">{record.group}</span></div></td>}
      
      {/* Tách cột Tờ/Thửa */}
      {visibleColumns.mapSheet && <td className="p-3 text-center align-middle font-mono text-sm">{record.mapSheet || '-'}</td>}
      {visibleColumns.landPlot && <td className="p-3 text-center align-middle font-mono text-sm">{record.landPlot || '-'}</td>}

      {visibleColumns.assigned && <td className="p-3 text-center align-middle">{record.assignedDate ? <div className="flex flex-col items-center"><span className="text-xs">{formatDate(record.assignedDate)}</span>{employee && <span className="text-[10px] text-indigo-600 font-medium truncate max-w-full" title={employee.name}>({employee.name})</span>}</div> : '--'}</td>}
      
      {visibleColumns.completed && (
        <td className="p-3 text-center text-gray-600 align-middle">
          {record.status === RecordStatus.WITHDRAWN ? (
            <div className="flex flex-col items-center">
              <span className="text-xs font-bold text-slate-600">{formatDate(record.completedDate)}</span>
              <span className="text-[10px] text-slate-400 italic">(Ngày rút)</span>
            </div>
          ) : (
            formatDate(record.completedDate) || '--'
          )}
        </td>
      )}

      {visibleColumns.type && <td className="p-3 text-gray-600 align-middle"><div className="truncate" title={record.recordType}>{getShortRecordType(record.recordType)}</div></td>}
      
      {visibleColumns.tech && (
        <td className="p-3 align-middle">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-1">
              <span className="text-[10px] font-bold text-gray-500 w-6 shrink-0">TĐ:</span>
              {canPerformAction ? (
                <input type="text" className="w-full text-xs border border-gray-200 rounded px-1 py-1 focus:border-blue-500 outline-none bg-white/50" value={record.measurementNumber || ''} onChange={(e) => onQuickUpdate(record.id, 'measurementNumber', e.target.value)} onClick={(e) => e.stopPropagation()} placeholder="Số TĐ" />
              ) : (
                <span className="text-xs text-gray-800 font-mono truncate">{record.measurementNumber || '---'}</span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[10px] font-bold text-gray-500 w-6 shrink-0">TL:</span>
              {canPerformAction ? (
                <input type="text" className="w-full text-xs border border-gray-200 rounded px-1 py-1 focus:border-blue-500 outline-none bg-white/50" value={record.excerptNumber || ''} onChange={(e) => onQuickUpdate(record.id, 'excerptNumber', e.target.value)} onClick={(e) => e.stopPropagation()} placeholder="Số TL" />
              ) : (
                <span className="text-xs text-gray-800 font-mono truncate">{record.excerptNumber || '---'}</span>
              )}
            </div>
          </div>
        </td>
      )}

      {visibleColumns.batch && (
        <td className="p-3 text-center align-middle">
          {record.status === RecordStatus.WITHDRAWN && !record.exportBatch ? (
            <span className="inline-flex flex-col items-center px-2 py-1 rounded text-xs font-medium bg-slate-100 text-slate-700 border border-slate-300">
              <span className="font-bold">CSD rút hồ sơ</span>
              <span className="text-[10px] text-slate-500 italic whitespace-nowrap">(Chờ giao trả)</span>
            </span>
          ) : (
            record.exportBatch ? (
              <span className={`inline-flex flex-col items-center px-2 py-1 rounded text-xs font-medium border ${record.status === RecordStatus.WITHDRAWN ? 'bg-slate-100 text-slate-700 border-slate-300' : 'bg-green-50 text-green-800 border-green-200'}`}>
                <span className="font-bold">Đợt {record.exportBatch}</span>
                <span className="text-[10px] whitespace-nowrap">({formatDate(record.exportDate)})</span>
              </span>
            ) : '-'
          )}
        </td>
      )}

      {visibleColumns.status && <td className="p-3 text-center align-middle"><StatusBadge status={record.status} /></td>}
      
      {canPerformAction && (
        <td className={`p-3 sticky right-0 shadow-l text-center align-middle ${isOverdue ? 'bg-red-50 group-hover:bg-red-100' : isApproaching ? 'bg-orange-50 group-hover:bg-orange-100' : 'bg-white group-hover:bg-blue-50/60'}`}>
          <div className="flex items-center justify-center gap-1">
            <button onClick={(e) => { e.stopPropagation(); onView(record); }} className="p-1.5 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded transition-colors" title="Xem chi tiết"><Eye size={16} /></button>
            {record.status !== RecordStatus.HANDOVER && record.status !== RecordStatus.WITHDRAWN && (
              <button onClick={() => onAdvanceStatus(record)} className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors" title="Chuyển bước"><ArrowRight size={16} /></button>
            )}
            <button onClick={() => onEdit(record)} className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Sửa"><Pencil size={16} /></button>
            <button onClick={() => onDelete(record)} className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Xóa"><Trash2 size={16} /></button>
          </div>
        </td>
      )}
    </tr>
  );
};

export default React.memo(RecordRow, (prevProps, nextProps) => {
  return (
    prevProps.record === nextProps.record &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.visibleColumns === nextProps.visibleColumns &&
    prevProps.employees.length === nextProps.employees.length
  );
});
