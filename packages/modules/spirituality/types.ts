// Types: Spirituality / Espiritualidade e Propósito

export type ReflectionType = 'reflection' | 'gratitude' | 'intention' | 'values' | 'mantra';

export type Reflection = {
  id: string;
  type: ReflectionType;
  content: string;
  mood: number | null; // 1-5
  tags: string[];
  logged_at: string;
  created_at: string;
};

export type PersonalValue = {
  id: string;
  name: string;
  description: string | null;
  priority: number; // 1-10
  created_at: string;
};

export type CreateReflectionInput = {
  type?: ReflectionType;
  content: string;
  mood?: number;
  tags?: string[];
  logged_at?: string;
};
