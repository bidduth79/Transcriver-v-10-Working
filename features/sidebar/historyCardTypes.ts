import type { HistoryItem } from '../../types';
import type { ActiveColors } from '../../hooks/useAppTheme';

// Opens a saved transcript; `searchKeyword` jumps to that word once it is shown
export type LoadHistoryItem = (item: HistoryItem, searchKeyword?: string) => void;
export type DeleteHistoryItem = (id: string) => void | Promise<void>;
export type ToggleFavorite = (id: string) => void | Promise<void>;
// Sensitive keywords found in a transcript text
export type GetSensitiveMatches = (text: string) => string[];

// The props every history card in the sidebar list gets
export interface HistoryCardProps {
  item: HistoryItem;
  activeHistoryId: string | null;
  loadHistoryItem: LoadHistoryItem;
  onDeleteHistoryItem: DeleteHistoryItem;
  isDark: boolean;
  activeColors: ActiveColors;
  appLang: string;
  getSensitiveMatches?: GetSensitiveMatches;
  isDuplicate: boolean;
  toggleFavorite?: ToggleFavorite;
}
