import React from 'react';
import { RecordStatus } from '../types';
import { STATUS_LABELS, STATUS_COLORS } from '../constants';

interface StatusBadgeProps {
  status: RecordStatus;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
};

export default StatusBadge;