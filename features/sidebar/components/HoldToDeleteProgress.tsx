import React from 'react';

// Smooth GPU-accelerated 3-second hold-to-delete progress bar
export const HoldToDeleteProgress = () => (
        <>
          <style>{`
            @keyframes holdDeleteProgress {
              0% { transform: scaleX(0); }
              100% { transform: scaleX(1); }
            }
          `}</style>
          <div
            className="absolute inset-0 bg-red-500/10 pointer-events-none origin-left"
            style={{ animation: 'holdDeleteProgress 2.88s linear forwards' }}
          />
          <div
            className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-red-500 to-rose-600 pointer-events-none origin-left z-20"
            style={{ animation: 'holdDeleteProgress 2.88s linear forwards' }}
          />
        </>
);
