
import { useState, useEffect, useMemo } from 'react';
import { RecordFile, RecordStatus } from '../types';
import { updateRecordApi } from '../services/api';

const REMINDER_INTERVAL = 60000; // Kiểm tra mỗi 1 phút
const REPEAT_HOURS = 2; // Nhắc lại mỗi 2 giờ

export const useReminderSystem = (records: RecordFile[], onUpdateRecord: (r: RecordFile) => void) => {
    const [activeRemindersCount, setActiveRemindersCount] = useState(0);

    // Tính toán số lượng nhắc nhở active (đã đến giờ và chưa hoàn thành)
    useEffect(() => {
        const count = records.filter(r => {
            if (!r.reminderDate) return false;
            // Nếu hồ sơ đã xong hoặc rút thì không tính là active reminder
            if (r.status === RecordStatus.HANDOVER || r.status === RecordStatus.WITHDRAWN) return false;
            
            const reminderTime = new Date(r.reminderDate).getTime();
            const now = Date.now();
            return reminderTime <= now;
        }).length;
        setActiveRemindersCount(count);
    }, [records]);

    // Logic Polling để bắn thông báo
    useEffect(() => {
        const checkReminders = async () => {
            const now = Date.now();
            
            for (const r of records) {
                if (!r.reminderDate) continue;
                
                // Bỏ qua nếu hồ sơ đã xong
                if (r.status === RecordStatus.HANDOVER || r.status === RecordStatus.WITHDRAWN) continue;

                const reminderTime = new Date(r.reminderDate).getTime();
                
                // Nếu chưa đến giờ thì bỏ qua
                if (reminderTime > now) continue;

                // Kiểm tra điều kiện nhắc lại (2 tiếng)
                let shouldNotify = false;
                if (!r.lastRemindedAt) {
                    shouldNotify = true;
                } else {
                    const lastRemindedTime = new Date(r.lastRemindedAt).getTime();
                    const hoursDiff = (now - lastRemindedTime) / (1000 * 60 * 60);
                    if (hoursDiff >= REPEAT_HOURS) {
                        shouldNotify = true;
                    }
                }

                if (shouldNotify) {
                    // Trigger Notification
                    if (window.electronAPI && window.electronAPI.showNotification) {
                        window.electronAPI.showNotification(
                            `Nhắc nhở hồ sơ: ${r.code}`,
                            `Đã đến hạn xử lý cho khách hàng: ${r.customerName}. Vui lòng kiểm tra!`
                        );
                    } else if (Notification.permission === 'granted') {
                        new Notification(`Nhắc nhở hồ sơ: ${r.code}`, {
                            body: `Đã đến hạn xử lý cho khách hàng: ${r.customerName}.`
                        });
                    }

                    // Cập nhật lastRemindedAt để không spam
                    const updatedRecord = { ...r, lastRemindedAt: new Date().toISOString() };
                    // Gọi update local trước
                    onUpdateRecord(updatedRecord);
                    // Gọi API update DB
                    await updateRecordApi(updatedRecord);
                }
            }
        };

        const intervalId = setInterval(checkReminders, REMINDER_INTERVAL);
        
        // Chạy ngay lần đầu
        checkReminders();

        return () => clearInterval(intervalId);
    }, [records, onUpdateRecord]);

    return { activeRemindersCount };
};
