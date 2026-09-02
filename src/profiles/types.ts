export interface Profile {
  id: string;
  name: string;
  providerId: string;
  modelId: string;
  reviewModelId?: string;
  reasoningEffort?: 'low' | 'medium' | 'high' | 'xhigh' | 'max' | 'ultra';
  description?: string;
  isDefault?: boolean;
}
