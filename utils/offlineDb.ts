import { LandRecord } from '../types';

class OfflineDB {
  private dbName = 'QLHS_Offline_DB';
  private version = 3;

  private getDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);
      
      request.onupgradeneeded = (event) => {
        const db = request.result;
        if (!db.objectStoreNames.contains('blocking_records')) {
          db.createObjectStore('blocking_records', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('archive_blocking_records')) {
          db.createObjectStore('archive_blocking_records', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('system_backups')) {
          db.createObjectStore('system_backups', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('backup_handles')) {
          db.createObjectStore('backup_handles');
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

  async saveBackupPoint(id: string, backupData: any): Promise<void> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction('system_backups', 'readwrite');
        const store = transaction.objectStore('system_backups');
        store.put({ id, data: backupData });
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      });
    } catch (e) {
      console.error('Error saving backup point to IndexedDB:', e);
      throw e;
    }
  }

  async getBackupPoint(id: string): Promise<any | null> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction('system_backups', 'readonly');
        const store = transaction.objectStore('system_backups');
        const request = store.get(id);
        request.onsuccess = () => resolve(request.result ? request.result.data : null);
        request.onerror = () => reject(request.error);
      });
    } catch (e) {
      console.error('Error getting backup point from IndexedDB:', e);
      return null;
    }
  }

  async deleteBackupPoint(id: string): Promise<void> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction('system_backups', 'readwrite');
        const store = transaction.objectStore('system_backups');
        store.delete(id);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      });
    } catch (e) {
      console.error('Error deleting backup point from IndexedDB:', e);
    }
  }

  async saveDirectoryHandle(handle: any): Promise<void> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction('backup_handles', 'readwrite');
        const store = transaction.objectStore('backup_handles');
        store.put(handle, 'auto_backup_folder');
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      });
    } catch (e) {
      console.error('Error saving directory handle:', e);
    }
  }

  async getDirectoryHandle(): Promise<any | null> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction('backup_handles', 'readonly');
        const store = transaction.objectStore('backup_handles');
        const request = store.get('auto_backup_folder');
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
      });
    } catch (e) {
      console.error('Error getting directory handle:', e);
      return null;
    }
  }

  async clearDirectoryHandle(): Promise<void> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction('backup_handles', 'readwrite');
        const store = transaction.objectStore('backup_handles');
        store.delete('auto_backup_folder');
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      });
    } catch (e) {
      console.error('Error clearing directory handle:', e);
    }
  }
}

export const offlineDb = new OfflineDB();
