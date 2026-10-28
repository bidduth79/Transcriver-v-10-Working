export type HarmCategory =
  | 'HARM_CATEGORY_HARASSMENT'
  | 'HARM_CATEGORY_HATE_SPEECH'
  | 'HARM_CATEGORY_SEXUALLY_EXPLICIT'
  | 'HARM_CATEGORY_DANGEROUS_CONTENT';

export type HarmBlockThreshold = 'BLOCK_NONE' | 'BLOCK_LOW_AND_ABOVE' | 'BLOCK_MEDIUM_AND_ABOVE' | 'BLOCK_ONLY_HIGH';

export type ThinkingLevel = 'MINIMAL' | 'LOW' | 'MEDIUM' | 'HIGH';

export type Type = 'TYPE_UNSPECIFIED' | 'STRING' | 'NUMBER' | 'INTEGER' | 'BOOLEAN' | 'ARRAY' | 'OBJECT' | 'NULL';

export type FileState = 'STATE_UNSPECIFIED' | 'PROCESSING' | 'ACTIVE' | 'FAILED';

export interface ThinkingConfig {
  thinkingLevel?: ThinkingLevel;
  thinkingBudget?: number;
  includeThoughts?: boolean;
}

export interface Part {
  text?: string;
  thought?: boolean;
  inlineData?: {
    mimeType: string;
    data: string;
  } | null;
  fileData?: {
    fileUri: string;
    mimeType: string;
  };
  audioTranscription?: {
    text?: string;
    speakerLabel?: string;
    words?: { startOffset?: string }[];
  };
}

export interface GenerateContentConfig {
  systemInstruction?: unknown;
  temperature?: number;
  topP?: number;
  topK?: number;
  maxOutputTokens?: number;
  responseMimeType?: string;
  responseSchema?: unknown;
  safetySettings?: { category: HarmCategory; threshold: HarmBlockThreshold }[];
  thinkingConfig?: ThinkingConfig;
  tools?: unknown[];
  httpOptions?: unknown;
  abortSignal?: AbortSignal;
}

export interface GenerateContentParameters {
  model: string;
  contents: unknown;
  config?: GenerateContentConfig;
}

export interface GenerateContentResponse {
  text?: string;
  candidates?: {
    content?: {
      role?: string;
      parts?: Part[];
    };
    finishReason?: string;
  }[];
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
  promptFeedback?: {
    blockReason?: string;
  };
}

export interface GeminiFileMetadata {
  name?: string;
  uri?: string;
  state?: FileState;
}

export interface GeminiClient {
  models: {
    generateContent: (params: GenerateContentParameters) => Promise<GenerateContentResponse>;
    generateContentStream?: (params: GenerateContentParameters) => AsyncGenerator<GenerateContentResponse, void, unknown>;
  };
  files: {
    upload: (params: { file: Blob; config?: { mimeType?: string } }) => Promise<GeminiFileMetadata>;
    get: (params: { name: string }) => Promise<GeminiFileMetadata>;
    delete: (params: { name: string }) => Promise<unknown>;
  };
}

export type GoogleGenAI = GeminiClient;
