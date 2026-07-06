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
