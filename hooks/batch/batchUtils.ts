export const getFileMetadata = (file: File): Promise<any> => {
  return new Promise((resolve) => {
    let resolved = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let audio: HTMLAudioElement | null = null;
    let objectUrl: string | null = null;

    const cleanupAudio = () => {
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      if (audio) {
        try {
          audio.onloadedmetadata = null;
          audio.onerror = null;
          audio.pause();
          audio.removeAttribute('src');
          audio.load(); // Force browser media pipeline to release C++ audio buffers immediately
        } catch (e) {
          // Ignore teardown errors
        }
        audio = null;
      }
      if (objectUrl) {
        try {
          URL.revokeObjectURL(objectUrl);
        } catch (e) {
          // Ignore revoke errors
        }
        objectUrl = null;
      }
    };
    
    const finish = (result: any) => {
      if (resolved) return;
      resolved = true;
      cleanupAudio();
      resolve(result);
    };

    const isOpus = file.name.toLowerCase().endsWith('.opus') || file.name.toLowerCase().endsWith('.ogg') || file.type.includes('opus') || file.type.includes('ogg');

    if (isOpus) {
      // Only parse up to 1MB for small files; for larger files estimate or read header slice to avoid loading entire multi-MB file into JS heap
      const blobToParse = file.size <= 1.5 * 1024 * 1024 ? file : file.slice(0, 512 * 1024, file.type);
      // Loaded on demand so the ~340 KB parser is not part of app startup
      import('music-metadata').then(musicMetadata => musicMetadata.parseBlob(blobToParse)).then((metadata) => {
          let durationStr = "Unknown";
          if (metadata && metadata.format && metadata.format.duration && file.size <= 1.5 * 1024 * 1024) {
              const duration = metadata.format.duration;
              const mins = Math.floor(duration / 60);
              const secs = Math.floor(duration % 60);
              durationStr = `${mins}:${secs.toString().padStart(2, '0')}`;
          } else {
              const estimatedSecs = Math.max(10, Math.round(file.size / 4000));
              const mins = Math.floor(estimatedSecs / 60);
              const secs = Math.floor(estimatedSecs % 60);
              durationStr = `${mins}:${secs.toString().padStart(2, '0')}`;
          }
          finish({
            name: file.name,
            size: (file.size / 1024 / 1024).toFixed(2) + ' MB',
            duration: durationStr,
            type: file.type,
            date: new Date().toISOString()
          });
      }).catch(() => {
          finish({
            name: file.name,
            size: (file.size / 1024 / 1024).toFixed(2) + ' MB',
            duration: "Unknown",
            type: file.type,
            date: new Date().toISOString()
          });
      });
      return;
    }

    objectUrl = URL.createObjectURL(file);
    audio = new Audio();
    audio.preload = 'metadata';
    audio.src = objectUrl;
    
    audio.onloadedmetadata = () => {
      const duration = audio ? audio.duration : NaN;
      let durationStr = "Unknown";
      if (isFinite(duration) && !isNaN(duration)) {
        const mins = Math.floor(duration / 60);
        const secs = Math.floor(duration % 60);
        durationStr = `${mins}:${secs.toString().padStart(2, '0')}`;
      }
      finish({
        name: file.name,
        size: (file.size / 1024 / 1024).toFixed(2) + ' MB',
        duration: durationStr,
        type: file.type,
        date: new Date().toISOString()
      });
    };
    
    audio.onerror = () => {
      finish({
        name: file.name,
        size: (file.size / 1024 / 1024).toFixed(2) + ' MB',
        duration: "Unknown",
        type: file.type,
        date: new Date().toISOString()
      });
    };

    timeoutId = setTimeout(() => {
      finish({
        name: file.name,
        size: (file.size / 1024 / 1024).toFixed(2) + ' MB',
        duration: "Unknown",
        type: file.type,
        date: new Date().toISOString()
      });
    }, 3000);
  });
};
