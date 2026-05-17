export type SettingsProfile = {
  adultContexts: string[];
  executionDifficulties: string[];
  preferredSupportCategories: string[];
  llmProviderSetupState: string;
};

export type SettingsSectionStatus = 'needs_setup' | 'ready' | 'always_on';

export type SettingsSection = {
  id: 'agent-provider' | 'local-profile' | 'safety-boundary' | 'interface';
  title: string;
  description: string;
  status: SettingsSectionStatus;
};

export function hasLocalProfile(profile: SettingsProfile): boolean {
  return profile.adultContexts.length > 0 && profile.executionDifficulties.length > 0;
}

export function isLlmProviderConfigured(profile: SettingsProfile): boolean {
  return profile.llmProviderSetupState === 'configured';
}

export function isFirstRunSetupComplete(profile: SettingsProfile): boolean {
  return isLlmProviderConfigured(profile) && hasLocalProfile(profile);
}

export function buildSettingsSections(profile: SettingsProfile): SettingsSection[] {
  return [
    {
      id: 'agent-provider',
      title: 'Agent Provider',
      description: 'Required LLM provider used by the conversational execution agent.',
      status: isLlmProviderConfigured(profile) ? 'ready' : 'needs_setup',
    },
    {
      id: 'local-profile',
      title: 'Local Profile',
      description: 'Adult contexts and execution preferences used for local support matching.',
      status: hasLocalProfile(profile) ? 'ready' : 'needs_setup',
    },
    {
      id: 'safety-boundary',
      title: 'Safety Boundary',
      description: 'Low-risk wellness boundary: no diagnosis, treatment, medication, or symptom scoring.',
      status: 'always_on',
    },
    {
      id: 'interface',
      title: 'Interface',
      description: 'Theme and low-stimulus canvas controls for local desktop use.',
      status: 'ready',
    },
  ];
}
