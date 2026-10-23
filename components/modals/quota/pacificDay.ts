// Gemini's daily quota (RPD) resets at midnight Pacific time, so "today" is counted on that clock
const DAY_MS = 86400000;
const pacificFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Los_Angeles', hourCycle: 'h23',
  year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
});

// Pacific wall-clock time minus UTC at the given instant (e.g. -7 h in summer, -8 h in winter)
export const pacificOffsetMs = (time: number) => {
  const parts = Object.fromEntries(pacificFormat.formatToParts(new Date(time)).map(p => [p.type, Number(p.value)]));
  const wallClockAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return wallClockAsUtc - Math.floor(time / 1000) * 1000;
};

// Day number on the Pacific calendar (for grouping requests per quota day)
export const pacificDayIndex = (time: number) => Math.floor((time + pacificOffsetMs(time)) / DAY_MS);

// The instant the current quota day started (last midnight Pacific time)
export const pacificDayStart = (time: number) => {
  const offset = pacificOffsetMs(time);
  return Math.floor((time + offset) / DAY_MS) * DAY_MS - offset;
};
