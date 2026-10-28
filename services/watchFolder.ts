// A folder on this computer that the app looks into for new audio (desktop Chrome and Edge only)

// Parts of the File System Access API that TypeScript's DOM types do not have yet
type ReadPermission = { mode: 'read' };
export type WatchFolderHandle = FileSystemDirectoryHandle & {
  queryPermission(descriptor: ReadPermission): Promise<PermissionState>;
  requestPermission(descriptor: ReadPermission): Promise<PermissionState>;
  values(): AsyncIterableIterator<FileSystemHandle>;
};
type DirectoryPicker = (options: { id: string; mode: 'read' }) => Promise<WatchFolderHandle>;

const pickerOf = () => (window as Window & { showDirectoryPicker?: DirectoryPicker }).showDirectoryPicker;

export const isFolderWatchSupported = () => typeof window !== 'undefined' && typeof pickerOf() === 'function';

// Opens the browser's folder picker; rejects with an AbortError when the user closes it
export const pickWatchFolder = () => {
  const picker = pickerOf();
  if (!picker) return Promise.reject(new Error('Folder access is not supported in this browser'));
  return picker({ id: 'transcriver-watch', mode: 'read' });
};

// After a reload the browser asks once more; asking needs a click, so `ask` is only true from a button
export const canReadFolder = async (handle: WatchFolderHandle, ask: boolean) => {
  if ((await handle.queryPermission({ mode: 'read' })) === 'granted') return true;
  return ask && (await handle.requestPermission({ mode: 'read' })) === 'granted';
};

// Files directly inside the folder (not in its subfolders)
export const listFolderFiles = async (handle: WatchFolderHandle) => {
  const files: File[] = [];
  for await (const entry of handle.values()) {
    if (entry.kind === 'file') files.push(await (entry as FileSystemFileHandle).getFile());
  }
  return files;
};

// The chosen folder is kept in a small database of its own, so the app's main database is not touched
const DB_NAME = 'TranscriverWatchFolder';
const STORE = 'kv';
const HANDLE_KEY = 'folder';

const openDb = () => new Promise<IDBDatabase>((resolve, reject) => {
  const request = indexedDB.open(DB_NAME, 1);
  request.onupgradeneeded = () => request.result.createObjectStore(STORE);
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});

const run = async <T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>) => {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const request = action(db.transaction(STORE, mode).objectStore(STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
};

export const saveWatchFolder = (handle: WatchFolderHandle) => run('readwrite', store => store.put(handle, HANDLE_KEY));
export const loadWatchFolder = () => run<WatchFolderHandle | undefined>('readonly', store => store.get(HANDLE_KEY));
export const forgetWatchFolder = () => run('readwrite', store => store.delete(HANDLE_KEY));
