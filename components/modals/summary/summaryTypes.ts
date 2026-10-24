export interface AiAnalysis { sentiment: 'positive' | 'negative' | 'neutral'; remark: string }

// Where and how often the search term occurs in the open transcript
export interface SummaryStats {
  searchTerm: string;
  fileName: string;
  duration: string;
  matchCount: number;
  matchTimestamps: string[];
  matchSentences: string[];
}
