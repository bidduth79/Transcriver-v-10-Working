import { useAppStore } from '../../hooks/useAppStore';
import { DEFAULT_MODEL, type AIModelDefinition } from '../../constants/aiModels';
import { AVAILABLE_MODELS } from '../../constants/aiModelList';
import { ACTIVE_MODEL_STORAGE, SPEED_OPT_STORAGE } from './storageKeys';

export const getModelDefinition = (modelId: string): AIModelDefinition => {
  return (
    AVAILABLE_MODELS.find(m => m.id === modelId) ||
    AVAILABLE_MODELS.find(m => m.id === DEFAULT_MODEL)!
  );
};

export const isSpeedOptimizationEnabled = (): boolean => {
  return localStorage.getItem(SPEED_OPT_STORAGE) !== 'classic';
};

export const setSpeedOptimizationEnabled = (enabled: boolean) => {
  localStorage.setItem(SPEED_OPT_STORAGE, enabled ? 'optimized' : 'classic');
  useAppStore.getState().triggerActiveApiKeyChanged();
};

export const resetModelToClassicDefault = () => {
  localStorage.setItem(ACTIVE_MODEL_STORAGE, DEFAULT_MODEL);
  localStorage.setItem(SPEED_OPT_STORAGE, 'classic');
  useAppStore.getState().triggerActiveApiKeyChanged();
};

export const setActiveModel = (modelId: string) => {
  localStorage.setItem(ACTIVE_MODEL_STORAGE, modelId);
  useAppStore.getState().triggerActiveApiKeyChanged();
};

// A saved choice of a model that is no longer offered (retired by Google) falls back to the default
export const getActiveModel = () => {
  const saved = localStorage.getItem(ACTIVE_MODEL_STORAGE);
  return saved && AVAILABLE_MODELS.some(m => m.id === saved) ? saved : DEFAULT_MODEL;
};
