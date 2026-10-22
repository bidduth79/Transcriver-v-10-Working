import { useState, useEffect } from 'react';
import { getApiUrl, checkCloudConnection } from '../../../services/api.ts';
import { isLocalServerEnabled } from '../../../utils/config';

export type ServerStatus = 'checking' | 'online' | 'offline';
export interface CloudStatus { status: 'checking' | 'online' | 'offline' | 'auth-error'; message: string }

// Polls local XAMPP server and cloud sync status every 60 seconds
export const useSystemStatus = () => {
  const [serverStatus, setServerStatus] = useState<ServerStatus>('checking');
  const [cloudStatus, setCloudStatus] = useState<CloudStatus>({ status: 'checking', message: 'Connecting...' });

  useEffect(() => {
    const checkSystems = async () => {
      // 1. Check Local (Only if enabled in settings)
      if (isLocalServerEnabled()) {
        try {
          const response = await fetch(getApiUrl('get_personnel.php'));
          if (response.ok) {
            const data = await response.json();
            if (data && data.status === 'online') {
              setServerStatus('online');
            } else {
              setServerStatus('offline');
            }
          } else {
            setServerStatus('offline');
          }
        } catch (e) {
          setServerStatus('offline');
        }
      } else {
        setServerStatus('offline');
      }

      // 2. Check Cloud
      const cloud = await checkCloudConnection();
      setCloudStatus(cloud);
    };

    checkSystems();
    const interval = setInterval(checkSystems, 60000); // Check every 60 seconds
    return () => clearInterval(interval);
  }, []);

  return { serverStatus, cloudStatus };
};
