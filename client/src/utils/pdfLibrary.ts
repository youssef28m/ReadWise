export type StoredPdf = {
  id: string;
  name: string;
  size: number;
  blob: Blob;
  lastPage: number;
  openedAt: number;
};

const DATABASE_NAME = 'tapword';
const STORE_NAME = 'pdf-library';
const DATABASE_VERSION = 1;

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onerror = () => reject(request.error ?? new Error('Could not open the PDF library.'));
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
  });
}

async function withStore<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const database = await openDatabase();
  return new Promise<T>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, mode);
    const request = action(transaction.objectStore(STORE_NAME));
    request.onerror = () => reject(request.error ?? new Error('Could not update the PDF library.'));
    request.onsuccess = () => resolve(request.result);
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => database.close();
  });
}

export async function listPdfs(): Promise<StoredPdf[]> {
  const books = await withStore<StoredPdf[]>('readonly', (store) => store.getAll());
  return books.sort((a, b) => b.openedAt - a.openedAt);
}

export function addPdf(file: File): StoredPdf {
  return {
    id: crypto.randomUUID(),
    name: file.name,
    size: file.size,
    blob: file.slice(0, file.size, 'application/pdf'),
    lastPage: 1,
    openedAt: Date.now()
  };
}

export async function savePdf(book: StoredPdf): Promise<void> {
  await withStore('readwrite', (store) => store.put(book));
}

export async function updatePdfProgress(id: string, lastPage: number): Promise<void> {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(id);
    request.onerror = () => reject(request.error ?? new Error('Could not save reading progress.'));
    request.onsuccess = () => {
      const book = request.result as StoredPdf | undefined;
      if (book) store.put({ ...book, lastPage, openedAt: Date.now() });
    };
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => reject(transaction.error ?? new Error('Could not save reading progress.'));
  });
}
