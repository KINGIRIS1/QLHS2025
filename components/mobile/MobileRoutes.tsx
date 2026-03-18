import React from 'react';
import { RecordFile, Employee, User, UserRole, Holiday } from '../../types';
import MobileDashboard from './MobileDashboard';
import MobileRecordList from './MobileRecordList';
import InternalChat from '../InternalChat';
import AccountSettingsView from '../AccountSettingsView';

interface MobileRoutesProps {
  currentView: string;
  setCurrentView: (view: string) => void;
  currentUser: User;
  records: RecordFile[];
  employees: Employee[];
  users: User[];
  wards: string[];
  holidays: Holiday[];
  
  // Handlers
  handleViewRecord: (r: RecordFile) => void;
  setEditingRecord: (r: RecordFile | null) => void;
  setIsModalOpen: (b: boolean) => void;
  setDeletingRecord: (r: RecordFile | null) => void;
  setIsDeleteModalOpen: (b: boolean) => void;
  handleUpdateCurrentAccount: (data: any) => Promise<boolean>;
  notificationEnabled: boolean;
  setNotificationEnabled: (enabled: boolean) => void;
  setUnreadMessages: (n: number) => void;
}

const MobileRoutes: React.FC<MobileRoutesProps> = (props) => {
  const { currentView, records, employees, currentUser, wards, users } = props;

  switch (currentView) {
    case 'dashboard':
      return <MobileDashboard records={records} />;
    
    case 'all_records':
    case 'received_list':
    case 'assigned_list':
    case 'in_progress_list':
    case 'completed_list':
    case 'pending_sign_list':
    case 'signed_list':
    case 'handover_list':
    case 'returned_list':
      return (
        <MobileRecordList 
          records={records} 
          employees={employees}
          onViewRecord={props.handleViewRecord}
          onEditRecord={(r) => { props.setEditingRecord(r); props.setIsModalOpen(true); }}
          onDeleteRecord={(r) => { props.setDeletingRecord(r); props.setIsDeleteModalOpen(true); }}
          onAddRecord={() => { props.setEditingRecord(null); props.setIsModalOpen(true); }}
        />
      );

    case 'internal_chat':
      return (
        <div className="h-full flex flex-col bg-white">
          <InternalChat
            currentUser={currentUser}
            wards={wards}
            employees={employees}
            users={users}
            onResetUnread={() => props.setUnreadMessages(0)}
            notificationEnabled={props.notificationEnabled}
          />
        </div>
      );

    case 'account_settings':
      return (
        <div className="p-4 bg-white h-full overflow-y-auto">
          <AccountSettingsView
            currentUser={currentUser}
            linkedEmployee={employees.find(e => e.id === currentUser.employeeId)}
            onUpdate={props.handleUpdateCurrentAccount}
            notificationEnabled={props.notificationEnabled}
            setNotificationEnabled={props.setNotificationEnabled}
          />
        </div>
      );

    default:
      return (
        <div className="p-10 text-center text-slate-400">
          <p className="text-sm font-medium">Tính năng này đang được tối ưu cho mobile...</p>
          <button 
            onClick={() => props.setCurrentView('dashboard')}
            className="mt-4 text-blue-600 font-bold"
          >
            Quay lại Tổng quan
          </button>
        </div>
      );
  }
};

export default MobileRoutes;
