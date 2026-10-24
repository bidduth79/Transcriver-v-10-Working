// Runs BEFORE react-dom/client is imported so React 19 Dev Mode does not
// run recursive O(N^2) prop diffing (addObjectDiffToProperties + JSON.stringify)
// or structuredClone (performance.measure) on large history/transcript arrays.
if (typeof window !== 'undefined') {
  try {
    if (typeof console !== 'undefined' && 'timeStamp' in console) {
      // Setting console.timeStamp to undefined before react-dom initializes
      // sets supportsUserTiming = false inside react-dom-client.development.js,
      // preventing multi-second main-thread freezes when large arrays update.
      (console as { timeStamp?: unknown }).timeStamp = undefined;
    }
  } catch {
    // Ignore if read-only
  }

  if (window.performance && typeof window.performance.measure === 'function') {
    const originalMeasure = window.performance.measure.bind(window.performance);
    window.performance.measure = function (name: string, startOrMeasureOptions?: string | PerformanceMeasureOptions, endMark?: string) {
      try {
        // Strip heavy devtools detail payloads to prevent structuredClone OOM/freezes
        if (startOrMeasureOptions && typeof startOrMeasureOptions === 'object' && 'detail' in startOrMeasureOptions) {
          return originalMeasure(name, {
            start: startOrMeasureOptions.start,
            end: startOrMeasureOptions.end,
          });
        }
        return originalMeasure(name, startOrMeasureOptions, endMark);
      } catch {
        // e.g. DataCloneError: the measure only feeds devtools, so dropping it is harmless
        return undefined as unknown as PerformanceMeasure;
      }
    };
  }
}
export {};
