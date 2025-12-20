
import { supabase, isConfigured } from './supabaseClient';
import { logError, getFromCache, saveToCache, CACHE_KEYS } from './apiCore';

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
        const { error } = await supabase.from('excerpt_history').insert([record]);
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
