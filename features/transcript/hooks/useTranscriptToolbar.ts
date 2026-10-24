export const useTranscriptToolbar = (
  setTranscript: (text: string) => void,
  setStatus: (status: 'idle') => void,
  setActiveHistoryId?: (id: string | null) => void
) => {
  const handleDelete = () => {
    setTranscript('');
    setStatus('idle');
    if (setActiveHistoryId) setActiveHistoryId(null);
  };

  return { handleDelete };
};
