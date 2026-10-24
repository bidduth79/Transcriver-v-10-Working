import en from '../locales/ui/en.json';
import bn from '../locales/ui/bn.json';

export type UiTextKey = keyof typeof en;

// Interface text kept in locales/ui: Bengali for 'bn', English for anything else.
// `{name}` placeholders are filled from `vars`, the same way a template literal would print them.
export const uiText = (lang: string, key: UiTextKey, vars?: Record<string, unknown>): string => {
  const text: string = (lang === 'bn' ? bn : en)[key];
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (match, name: string) => (name in vars ? String(vars[name]) : match));
};
