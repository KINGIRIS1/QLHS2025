
import { supabase, isConfigured } from './supabaseClient';
import { logError, getFromCache, saveToCache, CACHE_KEYS } from './apiCore';

/**
 * Chuẩn hóa payload ghi nhận lịch sử Trích đo / Trích lục.
 * Tự động làm sạch các trường rỗng ("" -> null), kiểm tra định dạng số/ngày tháng,
 * và chuẩn bị sẵn cả dạng camelCase lẫn snake_case để tương thích hoàn toàn với CSDL.
 */
const sanitizeRecordPayload = (record: any) => {
    if (!record || typeof record !== 'object') {
        return { camelPayload: {}, snakePayload: {} };
    }

    const cleanField = (val: any) => {
        if (val === undefined || val === null) return null;
        if (typeof val === 'string') {
            const trimmed = val.trim();
            if (trimmed === '' || trimmed === 'null' || trimmed === 'undefined') return null;
            return trimmed;
        }
        return val;
    };

    const cleanNumber = (val: any): number | null => {
        if (val === undefined || val === null || val === '') return null;
        if (typeof val === 'number') return isNaN(val) ? null : val;
        if (typeof val === 'string') {
            const parsed = parseInt(val.trim(), 10);
            return isNaN(parsed) ? null : parsed;
        }
        return null;
    };

    const cleanDate = (val: any): string => {
        if (!val) return new Date().toISOString();
        const d = new Date(val);
        return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
    };

    const id = cleanField(record.id) || Math.random().toString(36).substr(2, 9);
    const ward = cleanField(record.ward);
    const mapSheet = cleanField(record.mapSheet ?? record.map_sheet);
    const landPlot = cleanField(record.landPlot ?? record.land_plot);
    const excerptNumber = cleanNumber(record.excerptNumber ?? record.excerpt_number);
    const createdAt = cleanDate(record.createdAt ?? record.created_at);
    const createdBy = cleanField(record.createdBy ?? record.created_by) || 'Hệ thống';
    const linkedRecordCode = cleanField(record.linkedRecordCode ?? record.linked_record_code);

    const camelPayload: Record<string, any> = {
        id,
        ward,
        mapSheet,
        landPlot,
        excerptNumber,
        createdAt,
        createdBy,
        linkedRecordCode
    };

    const snakePayload: Record<string, any> = {
        id,
        ward,
        map_sheet: mapSheet,
        land_plot: landPlot,
        excerpt_number: excerptNumber,
        created_at: createdAt,
        created_by: createdBy,
        linked_record_code: linkedRecordCode
    };

    return { camelPayload, snakePayload };
};

export const fetchExcerptHistory = async (): Promise<any[]> => {
    if (!isConfigured) return getFromCache(CACHE_KEYS.EXCERPT_HISTORY, []);
    try {
        const { data, error } = await supabase.from('excerpt_history').select('*').order('createdAt', { ascending: false }).limit(200);
        if (error) throw error;
        saveToCache(CACHE_KEYS.EXCERPT_HISTORY, data);
        return data;
    } catch (error) {
        logError("fetchExcerptHistory", error);
        return getFromCache(CACHE_KEYS.EXCERPT_HISTORY, []);
    }
};

export const saveExcerptRecord = async (record: any): Promise<boolean> => {
    if (!isConfigured) return true;
    try {
        const { camelPayload, snakePayload } = sanitizeRecordPayload(record);

        // Thử insert camelCase trước
        let { error } = await supabase.from('excerpt_history').insert([camelPayload]);

        // Nếu bị lỗi cột không tồn tại, thử lại với snake_case
        if (error && (error.code === '42703' || error.message?.includes('column'))) {
            const fallbackRes = await supabase.from('excerpt_history').insert([snakePayload]);
            error = fallbackRes.error;
        }

        if (error) throw error;
        return true;
    } catch (error) {
        logError("saveExcerptRecord", error);
        return false;
    }
};

export const fetchExcerptCounters = async (): Promise<Record<string, number>> => {
    if (!isConfigured) return getFromCache(CACHE_KEYS.EXCERPT_COUNTERS, {});
    try {
        const { data, error } = await supabase.from('excerpt_counters').select('*');
        if (error) throw error;
        const counters: Record<string, number> = {};
        data.forEach((item: any) => {
            counters[item.ward] = item.count;
        });
        saveToCache(CACHE_KEYS.EXCERPT_COUNTERS, counters);
        return counters;
    } catch (error) {
        logError("fetchExcerptCounters", error);
        return getFromCache(CACHE_KEYS.EXCERPT_COUNTERS, {});
    }
};

export const saveExcerptCounters = async (counters: Record<string, number>): Promise<boolean> => {
    if (!isConfigured) return true;
    try {
        const upsertData = Object.entries(counters).map(([ward, count]) => ({ ward, count }));
        const { error } = await supabase.from('excerpt_counters').upsert(upsertData);
        if (error) throw error;
        return true;
    } catch (error) {
        logError("saveExcerptCounters", error);
        return false;
    }
};

export const fetchTrichDoHistory = async (): Promise<any[]> => {
    if (!isConfigured) return getFromCache(CACHE_KEYS.TRICHDO_HISTORY, []);
    try {
        const { data, error } = await supabase.from('trichdo_history').select('*').order('createdAt', { ascending: false }).limit(200);
        if (error) throw error;
        saveToCache(CACHE_KEYS.TRICHDO_HISTORY, data);
        return data;
    } catch (error) {
        logError("fetchTrichDoHistory", error);
        return getFromCache(CACHE_KEYS.TRICHDO_HISTORY, []);
    }
};

export const saveTrichDoRecord = async (record: any): Promise<boolean> => {
    if (!isConfigured) return true;
    try {
        const { camelPayload, snakePayload } = sanitizeRecordPayload(record);

        // Thử insert camelCase trước
        let { error } = await supabase.from('trichdo_history').insert([camelPayload]);

        // Nếu bị lỗi cột không tồn tại, thử lại với snake_case
        if (error && (error.code === '42703' || error.message?.includes('column'))) {
            const fallbackRes = await supabase.from('trichdo_history').insert([snakePayload]);
            error = fallbackRes.error;
        }

        if (error) throw error;
        return true;
    } catch (error) {
        logError("saveTrichDoRecord", error);
        return false;
    }
};

export const fetchTrichDoCounters = async (): Promise<Record<string, number>> => {
    if (!isConfigured) return getFromCache(CACHE_KEYS.TRICHDO_COUNTERS, {});
    try {
        const { data, error } = await supabase.from('trichdo_counters').select('*');
        if (error) throw error;
        const counters: Record<string, number> = {};
        data.forEach((item: any) => {
            counters[item.ward] = item.count;
        });
        saveToCache(CACHE_KEYS.TRICHDO_COUNTERS, counters);
        return counters;
    } catch (error) {
        logError("fetchTrichDoCounters", error);
        return getFromCache(CACHE_KEYS.TRICHDO_COUNTERS, {});
    }
};

export const saveTrichDoCounters = async (counters: Record<string, number>): Promise<boolean> => {
    if (!isConfigured) return true;
    try {
        const upsertData = Object.entries(counters).map(([ward, count]) => ({ ward, count }));
        const { error } = await supabase.from('trichdo_counters').upsert(upsertData);
        if (error) throw error;
        return true;
    } catch (error) {
        logError("saveTrichDoCounters", error);
        return false;
    }
};
