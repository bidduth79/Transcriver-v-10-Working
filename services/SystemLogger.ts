import { addToStore, getAllFromStore, deleteFromStore } from './db.ts';
import { STORES } from '../constants/storeNames.ts';

export interface SystemLogItem {
  id: string;
  timestamp: string;
  category: string;
  status: string;
  message: string;
  details?: string;
}

const MAX_SYSTEM_LOGS = 300;
let writesSinceLastPrune = 0;
let isPruning = false;

const pruneOldSystemLogs = async () => {
  if (isPruning) return;
  isPruning = true;
  try {
    const allLogs = (await getAllFromStore(STORES.SYSTEM_ACTIVITY_LOGS, false)) as SystemLogItem[];
    if (Array.isArray(allLogs) && allLogs.length > MAX_SYSTEM_LOGS) {
      allLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      const logsToDelete = allLogs.slice(MAX_SYSTEM_LOGS);
      for (const oldLog of logsToDelete) {
        if (oldLog?.id) {
          await deleteFromStore(STORES.SYSTEM_ACTIVITY_LOGS, oldLog.id);
        }
      }
    }
  } catch (e) {
    // Ignore background prune errors
  } finally {
    isPruning = false;
  }
};

export const logSystemActivity = async (
  category: string,
  status: string,
  message: string,
  details = ''
) => {
  const logEntry: SystemLogItem = {
    id: Date.now().toString() + Math.random().toString(36).substring(2, 7),
    timestamp: new Date().toISOString(),
    category,
    status,
    message,
    details
  };

  try {
    await addToStore(STORES.SYSTEM_ACTIVITY_LOGS, logEntry);
    console.log(`[SystemLog] ${category}: ${message}`);
    writesSinceLastPrune++;
    if (writesSinceLastPrune >= 15) {
      writesSinceLastPrune = 0;
      setTimeout(() => {
        pruneOldSystemLogs();
      }, 2000);
    }
  } catch (error) {
    console.error("Failed to save system log:", error);
  }
};

