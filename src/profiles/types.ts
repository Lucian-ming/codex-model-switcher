export interface Profile {
  id: string;
  name: string;
  providerId: string;
  modelId: string;
  reviewModelId?: string;
  reasoningEffort?: 'none' | 'low' | 'medium' | 'high' | 'xhigh' | 'max' | 'ultra' | string;
  contextWindow?: number;
  description?: string;
  isDefault?: boolean;
}

export type CodexProfile = Profile;
