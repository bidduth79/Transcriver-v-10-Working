import { useEffect, useRef } from 'react';

const BROADCAST_CHANNEL_NAME = 'transcriver_sync_channel';
const CLIENT_ID = Math.random().toString(36).substring(2, 9);

let sharedSenderChannel: BroadcastChannel | null = null;

export const useBroadcastSync = (onHistoryUpdate: () => void) => {
  const callbackRef = useRef(onHistoryUpdate);
  useEffect(() => {
    callbackRef.current = onHistoryUpdate;
  }, [onHistoryUpdate]);

  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;
    const channel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
    
    channel.onmessage = (event) => {
      // Only process updates from OTHER browser tabs/windows
      if (event.data?.type === 'HISTORY_UPDATED' && event.data?.clientId !== CLIENT_ID) {
        callbackRef.current();
      }
    };

    return () => {
      channel.onmessage = null;
      channel.close();
    };
  }, []);
};

export const broadcastHistoryUpdate = () => {
  try {
    if (typeof BroadcastChannel === 'undefined') return;
    if (!sharedSenderChannel) {
      sharedSenderChannel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
    }
    sharedSenderChannel.postMessage({ type: 'HISTORY_UPDATED', clientId: CLIENT_ID, timestamp: Date.now() });
  } catch (e) {
    // Reset if channel was closed unexpectedly
    sharedSenderChannel = null;
  }
};

