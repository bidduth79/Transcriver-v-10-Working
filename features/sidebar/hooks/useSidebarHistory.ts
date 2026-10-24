import { useCallback } from 'react';

export const useSidebarHistory = (_history: unknown[], _historyLimit: number, _setHistoryLimit: (val: number) => void) => {
  // SidebarHistory is fully virtualized via @tanstack/react-virtual,
  // so no IntersectionObserver pagination or skeleton loading state is needed.
  const bottomRef = useCallback((_node: HTMLDivElement | null) => {}, []);

  return { isHistoryLoading: false, bottomRef };
};

