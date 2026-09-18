"use client";

export type OfflineItem = {
  id: string;
  name: string;
  quantity: string;
  categoryId: string | null;
  unitPrice: number | null;
  completed: boolean;
  addedBy: string;
  completedBy: string | null;
  createdAt: string;
  completedAt: string | null;
  updatedAt: string;
};

export type OfflineCategory = {
  id: string;
  name: string;
  sortOrder: number;
  updatedAt: string;
};

export type OfflineSnapshot = {
  familyId: string;
  items: OfflineItem[];
  categories: OfflineCategory[];
  syncedAt: string | null;
};

export type PendingMutation = {
  mutationId: string;
  familyId: string;
  endpoint: "/api/items" | "/api/categories";
  method: "POST" | "PATCH" | "DELETE";
  body: Record<string, unknown>;
  createdAt: string;
};

const DB_NAME = "lista-de-casa-offline";
const DB_VERSION = 1;
const SNAPSHOTS = "snapshots";
const MUTATIONS = "mutations";
let snapshotWriteQueue: Promise<void> = Promise.resolve();

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(SNAPSHOTS)) {
        database.createObjectStore(SNAPSHOTS, { keyPath: "familyId" });
      }
      if (!database.objectStoreNames.contains(MUTATIONS)) {
        const store = database.createObjectStore(MUTATIONS, { keyPath: "mutationId" });
        store.createIndex("familyId", "familyId", { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Banco local indisponível."));
  });
}

async function runStore<T>(
  storeName: string,
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore, resolve: (value: T) => void, reject: (reason?: unknown) => void) => void,
) {
  const database = await openDatabase();
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = database.transaction(storeName, mode);
      const store = transaction.objectStore(storeName);
      action(store, resolve, reject);
      transaction.onerror = () => reject(transaction.error ?? new Error("Falha no armazenamento local."));
    });
  } finally {
    database.close();
  }
}

export async function getOfflineSnapshot(familyId: string) {
  return runStore<OfflineSnapshot | null>(SNAPSHOTS, "readonly", (store, resolve, reject) => {
    const request = store.get(familyId);
    request.onsuccess = () => resolve((request.result as OfflineSnapshot | undefined) ?? null);
    request.onerror = () => reject(request.error);
  });
}

export function saveOfflineSnapshot(snapshot: OfflineSnapshot) {
  snapshotWriteQueue = snapshotWriteQueue
    .catch(() => undefined)
    .then(() => runStore<void>(SNAPSHOTS, "readwrite", (store, resolve, reject) => {
      const request = store.put(snapshot);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    }));
  return snapshotWriteQueue;
}

export async function enqueueMutation(mutation: PendingMutation) {
  return runStore<void>(MUTATIONS, "readwrite", (store, resolve, reject) => {
    const request = store.put(mutation);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getPendingMutations(familyId: string) {
  return runStore<PendingMutation[]>(MUTATIONS, "readonly", (store, resolve, reject) => {
    const request = store.index("familyId").getAll(IDBKeyRange.only(familyId));
    request.onsuccess = () => {
      const mutations = (request.result as PendingMutation[]).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      resolve(mutations);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function removePendingMutation(mutationId: string) {
  return runStore<void>(MUTATIONS, "readwrite", (store, resolve, reject) => {
    const request = store.delete(mutationId);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function clearOfflineData() {
  await snapshotWriteQueue.catch(() => undefined);
  const database = await openDatabase();
  try {
    await Promise.all([SNAPSHOTS, MUTATIONS].map((storeName) => new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(storeName, "readwrite");
      const request = transaction.objectStore(storeName).clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    })));
  } finally {
    database.close();
  }
}
