import React from 'react';
import type { ServerStatus, CloudStatus } from './useSystemStatus';

interface Props {
  proModeLabel: string;
  primaryColor: string;
  serverStatus: ServerStatus;
  cloudStatus: CloudStatus;
}

const getCloudStatusColor = (status: CloudStatus['status']) => {
  switch(status) {
    case 'online': return 'text-green-500';
    case 'auth-error': return 'text-amber-500'; // Auth off
    default: return 'text-red-500';
  }
};

const getCloudStatusBg = (status: CloudStatus['status']) => {
  switch(status) {
    case 'online': return 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.8)]';
    case 'auth-error': return 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.8)]';
    default: return 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)]';
  }
};

export const SystemStatusBar = ({ proModeLabel, primaryColor, serverStatus, cloudStatus }: Props) => (
  <>
        <div className="flex items-center gap-2">
           <div className={`w-1.5 h-1.5 ${primaryColor} rounded-full animate-pulse shadow-[0_0_8px_rgba(255,255,255,0.4)]`}></div>
           <span className="text-white/80">{proModeLabel}</span>
        </div>

        <span className="opacity-20 text-white">|</span>

        {/* XAMPP SERVER STATUS */}
        <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${serverStatus === 'online' ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.8)]' : 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)]'}`}></div>
            <span className={`${serverStatus === 'online' ? 'text-green-500' : 'text-red-500'}`}>
                {serverStatus === 'online' ? 'LOCAL DB: ONLINE' : 'LOCAL DB: OFFLINE'}
            </span>
        </div>

        <span className="opacity-20 text-white">|</span>

        {/* CLOUD STATUS */}
        <div className="flex items-center gap-2" title={cloudStatus.message}>
            <div className={`w-2 h-2 rounded-full ${getCloudStatusBg(cloudStatus.status)}`}></div>
            <span className={getCloudStatusColor(cloudStatus.status)}>
                {cloudStatus.status === 'online' ? 'CLOUD SYNC: ON' : cloudStatus.status === 'auth-error' ? 'CLOUD: AUTH ERROR' : 'CLOUD: OFF'}
            </span>
        </div>
  </>
);
