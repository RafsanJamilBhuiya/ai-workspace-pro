/* AI Workspace Pro — model response guardrails */
export const AI_GUARDRAILS = Object.freeze({
  maxInputChars: 12000,
  maxOutputChars: 20000,
  disallowedPatterns: [
    /<script\b/i,
    /javascript:/i,
    /\bdata:text\/html/i
  ],
  fallbackMessages: Object.freeze({
    rate_limit: 'The AI service is temporarily busy. Please wait a moment and try again.',
    network: 'The AI service could not be reached. Check your connection and retry.',
    auth: 'Your AI session needs to be re-authenticated before continuing.',
    unknown: 'The AI service returned an unexpected result. Please retry.'
  })
});

export function sanitizePrompt(input) {
  const text = String(input ?? '').replace(/\u0000/g, '').trim();
  if (text.length > AI_GUARDRAILS.maxInputChars) throw new Error(`Prompt exceeds ${AI_GUARDRAILS.maxInputChars} characters.`);
  if (AI_GUARDRAILS.disallowedPatterns.some(pattern => pattern.test(text))) throw new Error('Prompt contains blocked markup or executable content.');
  return text;
}

export function normalizeModelResponse(value) {
  const text = typeof value === 'string' ? value : value?.text ?? value?.content ?? '';
  return String(text).slice(0, AI_GUARDRAILS.maxOutputChars);
}

export function classifyModelError(error) {
  const status = Number(error?.status || error?.response?.status || 0);
  if (status === 401 || status === 403) return 'auth';
  if (status === 429) return 'rate_limit';
  if (!status || status >= 500) return 'network';
  return 'unknown';
}

export function fallbackForModelError(error) {
  const kind = classifyModelError(error);
  return { kind, message: AI_GUARDRAILS.fallbackMessages[kind] || AI_GUARDRAILS.fallbackMessages.unknown, retryable: kind === 'rate_limit' || kind === 'network' };
}

export const SYSTEM_PROMPTS = Object.freeze({
  default: 'You are the AI Workspace Pro assistant. Be accurate, concise, transparent about uncertainty, and never claim to have performed an action you did not perform.',
  safeFailure: 'If a requested operation cannot be completed, explain the limitation briefly and provide the safest next step. Never fabricate tool results, credentials, or external actions.'
});
