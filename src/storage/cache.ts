import { CACHE_DB_NAME, CACHE_DB_VERSION, CACHE_STORE_NAME, MAX_CACHE_ENTRIES } from '../shared/constants';

interface CacheRecord {
  key: string;
  text: string;
  createdAt: number;
  accessedAt: number;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(CACHE_DB_NAME, CACHE_DB_VERSION);
    request.onerror = () => reject(request.error ?? new Error('Unable to open translation cache'));
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(CACHE_STORE_NAME)) {
        const store = database.createObjectStore(CACHE_STORE_NAME, { keyPath: 'key' });
        store.createIndex('accessedAt', 'accessedAt');
      }
    };
    request.onsuccess = () => resolve(request.result);
  });
}

async function cacheKey(providerId: string, source: string, target: string, text: string): Promise<string> {
  const value = new TextEncoder().encode(`${providerId}\u0000${source}\u0000${target}\u0000${text}`);
  const digest = await crypto.subtle.digest('SHA-256', value);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export class TranslationCache {
  async get(providerId: string, source: string, target: string, text: string): Promise<string | undefined> {
    const key = await cacheKey(providerId, source, target, text);
    const database = await openDatabase();
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(CACHE_STORE_NAME, 'readwrite');
      const store = transaction.objectStore(CACHE_STORE_NAME);
      const request = store.get(key);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const record = request.result as CacheRecord | undefined;
        if (!record) {
          resolve(undefined);
          return;
        }
        record.accessedAt = Date.now();
        store.put(record);
        resolve(record.text);
      };
      transaction.oncomplete = () => database.close();
    });
  }

  async set(providerId: string, source: string, target: string, original: string, translated: string): Promise<void> {
    const key = await cacheKey(providerId, source, target, original);
    const database = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(CACHE_STORE_NAME, 'readwrite');
      transaction.objectStore(CACHE_STORE_NAME).put({
        key,
        text: translated,
        createdAt: Date.now(),
        accessedAt: Date.now()
      } satisfies CacheRecord);
      transaction.onerror = () => reject(transaction.error);
      transaction.oncomplete = () => resolve();
    });
    database.close();
    void this.prune();
  }

  private async prune(): Promise<void> {
    const database = await openDatabase();
    const count = await new Promise<number>((resolve, reject) => {
      const request = database.transaction(CACHE_STORE_NAME).objectStore(CACHE_STORE_NAME).count();
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });

    if (count <= MAX_CACHE_ENTRIES) {
      database.close();
      return;
    }

    const removeCount = count - MAX_CACHE_ENTRIES;
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(CACHE_STORE_NAME, 'readwrite');
      const index = transaction.objectStore(CACHE_STORE_NAME).index('accessedAt');
      let removed = 0;
      const request = index.openCursor();
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor || removed >= removeCount) return;
        cursor.delete();
        removed += 1;
        cursor.continue();
      };
      transaction.onerror = () => reject(transaction.error);
      transaction.oncomplete = () => resolve();
    });
    database.close();
  }
}
