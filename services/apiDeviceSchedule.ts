import { supabase, isConfigured } from './supabaseClient';
import { DeviceSchedule } from '../types';
import { logError, getFromCache, saveToCache } from './apiCore';

// Cache key cho lịch máy đo
const DEVICE_SCHEDULE_CACHE_KEY = 'offline_device_schedules';

// Mock data store cho offline
let MOCK_DEVICE_SCHEDULES: DeviceSchedule[] = [];

export const fetchDeviceSchedules = async (): Promise<DeviceSchedule[]> => {
    if (!isConfigured) return getFromCache(DEVICE_SCHEDULE_CACHE_KEY, MOCK_DEVICE_SCHEDULES);
    try {
        const { data, error } = await supabase
            .from('device_schedules')
            .select('*')
            .order('date', { ascending: false });
        if (error) throw error;
        saveToCache(DEVICE_SCHEDULE_CACHE_KEY, data);
        return data as DeviceSchedule[];
    } catch (error) {
        logError("fetchDeviceSchedules", error);
        return getFromCache(DEVICE_SCHEDULE_CACHE_KEY, []);
    }
};

export const saveDeviceSchedule = async (schedule: Partial<DeviceSchedule>): Promise<boolean> => {
    if (!isConfigured) {
        if (schedule.id) {
            const idx = MOCK_DEVICE_SCHEDULES.findIndex(s => s.id === schedule.id);
            if (idx !== -1) MOCK_DEVICE_SCHEDULES[idx] = { ...MOCK_DEVICE_SCHEDULES[idx], ...schedule } as DeviceSchedule;
        } else {
            const newSchedule = { 
                ...schedule, 
                id: Math.random().toString(36).substr(2, 9),
                created_at: new Date().toISOString() 
            } as DeviceSchedule;
            MOCK_DEVICE_SCHEDULES.unshift(newSchedule);
        }
        saveToCache(DEVICE_SCHEDULE_CACHE_KEY, MOCK_DEVICE_SCHEDULES);
        return true;
    }

    try {
        if (schedule.id) {
            const { error } = await supabase
                .from('device_schedules')
                .update(schedule)
                .eq('id', schedule.id);
            if (error) throw error;
        } else {
            const newSchedule = {
                ...schedule,
                id: Math.random().toString(36).substr(2, 9),
                created_at: new Date().toISOString()
            };
            const { error } = await supabase
                .from('device_schedules')
                .insert([newSchedule]);
            if (error) throw error;
        }
        return true;
    } catch (error) {
        logError("saveDeviceSchedule", error);
        return false;
    }
};

export const deleteDeviceSchedule = async (id: string): Promise<boolean> => {
    if (!isConfigured) {
        MOCK_DEVICE_SCHEDULES = MOCK_DEVICE_SCHEDULES.filter(s => s.id !== id);
        saveToCache(DEVICE_SCHEDULE_CACHE_KEY, MOCK_DEVICE_SCHEDULES);
        return true;
    }
    try {
        const { error } = await supabase.from('device_schedules').delete().eq('id', id);
        if (error) throw error;
        return true;
    } catch (error) {
        logError("deleteDeviceSchedule", error);
        return false;
    }
};
