import { LandRecord } from '../types';

class OfflineDB {
  private dbName = 'QLHS_Offline_DB';
  private version = 1;

  private getDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);
      
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('blocking_records')) {
          db.createObjectStore('blocking_records', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('archive_blocking_records')) {
          db.createObjectStore('archive_blocking_records', { keyPath: 'id' });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async saveRecords(storeName: 'blocking_records' | 'archive_blocking_records', records: any[]): Promise<void> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        store.clear();
        
        records.forEach(r => {
          if (r && r.id) {
            store.put(r);
          }
        });

        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      });
    } catch (e) {
      console.error(`Error saving records to IndexedDB store ${storeName}:`, e);
    }
  }

  async getRecords(storeName: 'blocking_records' | 'archive_blocking_records'): Promise<any[]> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.getAll();
        
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
      });
    } catch (e) {
      console.error(`Error getting records from IndexedDB store ${storeName}:`, e);
      return [];
    }
  }

  async countRecords(storeName: 'blocking_records' | 'archive_blocking_records'): Promise<number> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.count();
        
        request.onsuccess = () => resolve(request.result || 0);
        request.onerror = () => reject(request.error);
      });
    } catch (e) {
      console.error(`Error counting records in IndexedDB store ${storeName}:`, e);
      return 0;
    }
  }

  async getAllKeys(storeName: 'blocking_records' | 'archive_blocking_records'): Promise<any[]> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.getAllKeys();
        
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
      });
    } catch (e) {
      console.error(`Error getting all keys from IndexedDB store ${storeName}:`, e);
      return [];
    }
  }

  async getRecordsByKeys(storeName: 'blocking_records' | 'archive_blocking_records', keys: any[]): Promise<any[]> {
    try {
      if (keys.length === 0) return [];
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);
        const records: any[] = [];
        let count = 0;

        keys.forEach(key => {
          const request = store.get(key);
          request.onsuccess = () => {
            if (request.result) {
              records.push(request.result);
            }
            count++;
            if (count === keys.length) {
              resolve(records);
            }
          };
          request.onerror = () => {
            count++;
            if (count === keys.length) {
              resolve(records);
            }
          };
        });
      });
    } catch (e) {
      console.error(`Error getting records by keys:`, e);
      return [];
    }
  }

  async streamRecords(
    storeName: 'blocking_records' | 'archive_blocking_records',
    onBatch: (batch: any[]) => Promise<void> | void,
    batchSize: number = 1000
  ): Promise<void> {
    try {
      const keys = await this.getAllKeys(storeName);
      for (let i = 0; i < keys.length; i += batchSize) {
        const batchKeys = keys.slice(i, i + batchSize);
        const batchRecords = await this.getRecordsByKeys(storeName, batchKeys);
        await onBatch(batchRecords);
      }
    } catch (e) {
      console.error(`Error streaming records from IndexedDB store ${storeName}:`, e);
      throw e;
    }
  }

  async clearStore(storeName: 'blocking_records' | 'archive_blocking_records'): Promise<void> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        store.clear();
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      });
    } catch (e) {
      console.error(`Error clearing IndexedDB store ${storeName}:`, e);
    }
  }
}

export const offlineDb = new OfflineDB();
