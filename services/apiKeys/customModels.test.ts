import { describe, it, expect, beforeEach } from 'vitest';
import { allModels, addCustomModel, removeCustomModel, readCustomModels } from './customModels';
import { getActiveModel, setActiveModel, getModelDefinition } from './modelSettings';
import { AVAILABLE_MODELS } from '../../constants/aiModelList';
import { DEFAULT_MODEL } from '../../constants/aiModels';

beforeEach(() => localStorage.clear());

describe('custom models', () => {
  it('adds a model after the built-in ones, in a category guessed from its name', () => {
    addCustomModel({ id: 'gemini-4-carbon', label: 'Gemini 4 Carbon' });
    addCustomModel({ id: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash Lite' });
    addCustomModel({ id: 'gemini-4-pro', label: '' });
    const added = allModels().slice(AVAILABLE_MODELS.length);
    expect(added.map(m => [m.id, m.label, m.category])).toEqual([
      ['gemini-4-carbon', 'Gemini 4 Carbon', 'balanced'],
      ['gemini-3.1-flash-lite', 'Gemini 3.1 Flash Lite', 'fast'],
      ['gemini-4-pro', 'gemini-4-pro', 'thinking'],
    ]);
    // The category labels come from the built-in models, as they are
    expect(added[0].categoryLabelBn).toBe(AVAILABLE_MODELS.find(m => m.category === 'balanced')!.categoryLabelBn);
  });

  it('never adds a model twice or one the app already has', () => {
    addCustomModel({ id: 'gemini-4-carbon', label: 'A' });
    addCustomModel({ id: 'gemini-4-carbon', label: 'B' });
    addCustomModel({ id: AVAILABLE_MODELS[0].id, label: 'copy' });
    expect(readCustomModels()).toEqual([{ id: 'gemini-4-carbon', label: 'A' }]);
  });

  it('can be chosen, and when removed the default model is used again', () => {
    addCustomModel({ id: 'gemini-4-carbon', label: 'Gemini 4 Carbon' });
    setActiveModel('gemini-4-carbon');
    expect(getActiveModel()).toBe('gemini-4-carbon');
    expect(getModelDefinition('gemini-4-carbon').label).toBe('Gemini 4 Carbon');
    removeCustomModel('gemini-4-carbon');
    expect(getActiveModel()).toBe(DEFAULT_MODEL);
  });
});
