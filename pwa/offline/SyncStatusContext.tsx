import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { OFFLINE_SUPPORTED } from './db';
import { getAllQueueItems, markQueueItemPending, onQueueChanged, removeQueueItem } from './queue';
import { findItemsReferencingTempId, removeQueueItems } from './queue';
import { cache } from './cache';
import { scheduleSync } from './sync';
import type { QueueItem } from './types';

interface SyncStatusValue {
  pendingCount: number;
  failedItems: QueueItem[];
  retry: (id: string) => Promise<void>;
  discard: (id: string) => Promise<void>;
}

const SyncStatusContext = createContext<SyncStatusValue | null>(null);

export function SyncStatusProvider({ children }: { children: React.ReactNode }) {
  const [pendingCount, setPendingCount] = useState(0);
  const [failedItems, setFailedItems] = useState<QueueItem[]>([]);

  const refresh = useCallback(async () => {
    if (!OFFLINE_SUPPORTED) return;
    const all = await getAllQueueItems();
    setPendingCount(all.filter((i) => i.status === 'pending').length);
    setFailedItems(all.filter((i) => i.status === 'failed'));
  }, []);

  useEffect(() => {
    refresh();
    return onQueueChanged(refresh);
  }, [refresh]);

  const retry = useCallback(async (id: string) => {
    await markQueueItemPending(id);
    scheduleSync(0);
  }, []);

  const discard = useCallback(async (id: string) => {
    const all = await getAllQueueItems();
    const item = all.find((i) => i.id === id);
    if (!item) return;
    if (item.op === 'create' && item.createdTempId) {
      const dependents = await findItemsReferencingTempId(item.createdTempId);
      await removeQueueItems(dependents.map((d) => d.id));
      await cache.remove(item.entity, item.createdTempId);
    } else {
      await removeQueueItem(id);
    }
  }, []);

  return (
    <SyncStatusContext.Provider value={{ pendingCount, failedItems, retry, discard }}>
      {children}
    </SyncStatusContext.Provider>
  );
}

export function useSyncStatus(): SyncStatusValue {
  const ctx = useContext(SyncStatusContext);
  if (!ctx) throw new Error('useSyncStatus must be used within <SyncStatusProvider>');
  return ctx;
}
