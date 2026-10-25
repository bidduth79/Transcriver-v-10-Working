export const useProcessingView = (estimatedSeconds: number, elapsedSeconds: number) => {
  const formatTime = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const remainingSeconds = Math.max(0, estimatedSeconds - elapsedSeconds);
  // Past the estimate the countdown would sit at 00:00, so a message is shown instead
  const isOvertime = elapsedSeconds > estimatedSeconds;
  const BACKGROUND_IMAGE_URL = "/background.jpg";

  return { formatTime, remainingSeconds, isOvertime, BACKGROUND_IMAGE_URL };
};
