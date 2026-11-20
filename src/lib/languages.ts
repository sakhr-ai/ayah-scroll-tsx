import type { Language } from '../types';

export const LANGUAGES: { value: Language; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'ur', label: 'اردو' },
  { value: 'tr', label: 'Türkçe' },
  { value: 'fr', label: 'Français' },
  { value: 'id', label: 'Indonesia' },
  { value: 'es', label: 'Español' },
  { value: 'bn', label: 'বাংলা' },
];

// Only Urdu is written right to left; Bengali is left to right.
export const RTL_LANGUAGES: Language[] = ['ur'];

export const isRtl = (language: Language) => RTL_LANGUAGES.includes(language);
