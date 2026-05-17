export type LlmProviderId =
  | 'openai'
  | 'anthropic_claude'
  | 'google_gemini'
  | 'ollama_local'
  | 'custom';

export type LlmApiMode =
  | 'openai_chat_completions'
  | 'openai_responses'
  | 'claude_messages'
  | 'gemini_generate_content';

export type LlmProviderPreset = {
  id: LlmProviderId;
  label: string;
  defaultApiMode: LlmApiMode;
  defaultBaseUrl: string;
  recommendedModel: string;
  description: string;
};

export type LlmApiModeOption = {
  id: LlmApiMode;
  label: string;
  defaultPath: string;
  description: string;
};

export type LlmProviderSettingsDraft = {
  providerId: LlmProviderId;
  apiMode: LlmApiMode;
  baseUrl: string;
  apiKey: string;
  model: string;
  timeoutSeconds: number;
};

type ExistingLlmProviderFields = Partial<Omit<LlmProviderSettingsDraft, 'providerId'>> & {
  apiMode?: LlmApiMode | string;
};

export const apiModeOptions: LlmApiModeOption[] = [
  {
    id: 'openai_chat_completions',
    label: 'OpenAI Chat Completions compatible',
    defaultPath: '/chat/completions',
    description: 'For OpenAI-compatible chat completion endpoints.',
  },
  {
    id: 'openai_responses',
    label: 'OpenAI Responses API compatible',
    defaultPath: '/responses',
    description: 'For providers that implement the OpenAI Responses API.',
  },
  {
    id: 'claude_messages',
    label: 'Claude Messages API compatible',
    defaultPath: '/messages',
    description: 'For Anthropic Claude Messages compatible endpoints.',
  },
  {
    id: 'gemini_generate_content',
    label: 'Google Gemini API compatible',
    defaultPath: '/models/{model}:generateContent',
    description: 'For Gemini native generateContent endpoints.',
  },
];

export const llmProviderPresets: LlmProviderPreset[] = [
  {
    id: 'openai',
    label: 'OpenAI',
    defaultApiMode: 'openai_chat_completions',
    defaultBaseUrl: 'https://api.openai.com/v1',
    recommendedModel: 'gpt-4.1-mini',
    description: 'OpenAI hosted API using Chat Completions by default.',
  },
  {
    id: 'anthropic_claude',
    label: 'Anthropic Claude',
    defaultApiMode: 'claude_messages',
    defaultBaseUrl: 'https://api.anthropic.com/v1',
    recommendedModel: 'claude-3-5-haiku-latest',
    description: 'Claude Messages API. The adapter supplies the default anthropic-version header.',
  },
  {
    id: 'google_gemini',
    label: 'Google Gemini',
    defaultApiMode: 'gemini_generate_content',
    defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    recommendedModel: 'gemini-1.5-flash',
    description: 'Gemini native generateContent API.',
  },
  {
    id: 'ollama_local',
    label: 'Ollama / Local OpenAI Compatible',
    defaultApiMode: 'openai_chat_completions',
    defaultBaseUrl: 'http://localhost:11434/v1',
    recommendedModel: 'llama3.2',
    description: 'Local OpenAI-compatible runtime for first-release testing.',
  },
  {
    id: 'custom',
    label: 'Custom',
    defaultApiMode: 'openai_chat_completions',
    defaultBaseUrl: '',
    recommendedModel: '',
    description: 'Manual Base URL with an explicit API mode.',
  },
];

export function applyLlmProviderPreset(
  providerId: LlmProviderId,
  current: ExistingLlmProviderFields = {},
): LlmProviderSettingsDraft {
  const preset = findProviderPreset(providerId);
  if (providerId === 'custom') {
    return {
      providerId,
      apiMode: normalizeApiMode(current.apiMode, preset.defaultApiMode),
      baseUrl: current.baseUrl ?? '',
      apiKey: current.apiKey ?? '',
      model: current.model ?? '',
      timeoutSeconds: current.timeoutSeconds ?? 30,
    };
  }

  return {
    providerId,
    apiMode: preset.defaultApiMode,
    baseUrl: preset.defaultBaseUrl,
    apiKey: current.apiKey ?? '',
    model: preset.recommendedModel,
    timeoutSeconds: current.timeoutSeconds ?? 30,
  };
}

export function findProviderPreset(providerId: string): LlmProviderPreset {
  return llmProviderPresets.find((preset) => preset.id === providerId) ?? llmProviderPresets[0];
}

export function normalizeProviderId(providerId: string | null | undefined): LlmProviderId {
  return llmProviderPresets.some((preset) => preset.id === providerId)
    ? (providerId as LlmProviderId)
    : 'ollama_local';
}

export function normalizeApiMode(
  apiMode: string | null | undefined,
  fallback: LlmApiMode = 'openai_chat_completions',
): LlmApiMode {
  return apiModeOptions.some((option) => option.id === apiMode) ? (apiMode as LlmApiMode) : fallback;
}
