// Models the user added from Google's list ("Find new models" in Settings), kept in this browser and offered
// next to the built-in ones, so a new Gemini model can be used without changing the code.
import { useAppStore } from '../../hooks/useAppStore';
import { AVAILABLE_MODELS } from '../../constants/aiModelList';
import type { AIModelDefinition, ModelCategory } from '../../constants/aiModels';
import { uiText } from '../../utils/uiText';

const CUSTOM_MODELS_STORAGE = 'custom_models';

export interface CustomModel {
  id: string;
  label: string;
}

// From the name, as Google names its models: "pro" thinks long, "lite" and transcribe models are the fast ones
const categoryOf = (id: string): ModelCategory =>
  /pro/.test(id) ? 'thinking' : /lite|transcribe/.test(id) ? 'fast' : 'balanced';

export const readCustomModels = (): CustomModel[] => {
  try {
    const list = JSON.parse(localStorage.getItem(CUSTOM_MODELS_STORAGE) || '[]');
    return Array.isArray(list) ? list.filter(m => m && typeof m.id === 'string') : [];
  } catch {
    return [];
  }
};

const save = (list: CustomModel[]) => {
  try {
    localStorage.setItem(CUSTOM_MODELS_STORAGE, JSON.stringify(list));
  } catch {
    // Storage blocked: the model is offered until the page is closed
  }
  // The model lists in the footer and in Settings read the list again
  useAppStore.getState().triggerActiveApiKeyChanged();
};

const definitionOf = ({ id, label }: CustomModel): AIModelDefinition => {
  const category = categoryOf(id);
  // The category's own labels and quota note, taken from a built-in model of the same category
  const sample = AVAILABLE_MODELS.find(m => m.category === category) ?? AVAILABLE_MODELS[0];
  return {
    id,
    label: label || id,
    badge: 'Added',
    category,
    categoryLabelBn: sample.categoryLabelBn,
    categoryLabelEn: sample.categoryLabelEn,
    speedBadgeBn: uiText('bn', 'customModelBadge'),
    thinkingBehavior: category === 'thinking' ? 'deep' : 'minimal',
    infoBn: {
      howItWorks: uiText('bn', 'customModelHowItWorks'),
      speedAndTime: uiText('bn', 'customModelSpeed'),
      bestFor: uiText('bn', 'customModelBestFor'),
      quotaInfo: sample.infoBn.quotaInfo,
    },
  };
};

// The built-in models, then the ones the user added
export const allModels = (): AIModelDefinition[] => [
  ...AVAILABLE_MODELS,
  ...readCustomModels().filter(m => !AVAILABLE_MODELS.some(a => a.id === m.id)).map(definitionOf),
];

export const addCustomModel = (model: CustomModel) => {
  if (allModels().some(m => m.id === model.id)) return;
  save([...readCustomModels(), model]);
};

// A removed model that was chosen gives way to the default model (getActiveModel only takes offered models)
export const removeCustomModel = (id: string) => save(readCustomModels().filter(m => m.id !== id));
