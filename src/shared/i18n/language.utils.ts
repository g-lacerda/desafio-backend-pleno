import { Language } from '@prisma/client';

const LANGUAGE_DB_TO_TAG: Record<Language, string> = {
  PT_BR: 'pt-BR',
  EN: 'en',
  ES: 'es',
};

/**
 * Converte o enum Prisma `Language` (ex.: `PT_BR`) para a tag IETF
 * usada pelo nestjs-i18n (ex.: `pt-BR`). Mantido como utilitário
 * compartilhado entre o resolver e os pontos que precisam injetar
 * o idioma do usuário fora do contexto do resolver.
 */
export function languageDbToTag(lang: Language | null | undefined): string | undefined {
  if (!lang) return undefined;
  return LANGUAGE_DB_TO_TAG[lang];
}
