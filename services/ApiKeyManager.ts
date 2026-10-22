// Public entry point for API key, model and usage-stat helpers.
// Implementation lives in services/apiKeys/ and constants/aiModels*.
export { DEFAULT_MODEL, MODEL_CATEGORY_GROUPS } from '../constants/aiModels';
export type { AIModelDefinition } from '../constants/aiModels';
export { AVAILABLE_MODELS } from '../constants/aiModelList';
export {
  getModelDefinition,
  isSpeedOptimizationEnabled,
  setSpeedOptimizationEnabled,
  resetModelToClassicDefault,
  setActiveModel,
  getActiveModel,
} from './apiKeys/modelSettings';
export { getActiveProvider, getFallbackProviders } from './apiKeys/keyProviders';
export { addUserApiKey, getAllApiKeys, setActiveApiKey, deleteApiKey, getActiveKeyId } from './apiKeys/keyStore';
export type { UserApiKey } from './apiKeys/keyStore';
export { incrementTotalCalls, getTotalCalls, getApiCallLogs } from './apiKeys/apiCallStats';
export type { ApiCallLog } from './apiKeys/apiCallStats';
