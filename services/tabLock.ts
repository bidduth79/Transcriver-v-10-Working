// A lock shared by the app's tabs in this browser (Web Locks). With two tabs open, each ran its own batch and its
// own look into the watched folder: files were transcribed side by side, and one twice at the same moment.

type Release = () => void;

/**
 * Takes the named lock when no tab holds it, and gives the function that lets it go (the browser also frees it
 * when the tab closes). Gives null when another tab holds it. A browser without Web Locks works as before:
 * every tab on its own.
 */
export const claimTabLock = (name: string): Promise<Release | null> => {
  const locks = typeof navigator === 'undefined' ? undefined : navigator.locks;
  if (!locks) return Promise.resolve(() => {});
  return new Promise(resolve => {
    locks
      .request(name, { ifAvailable: true }, lock => {
        if (!lock) return resolve(null);
        // Held until the release function is called
        return new Promise<void>(release => resolve(release));
      })
      .catch(() => resolve(() => {}));
  });
};
