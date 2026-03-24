// Types: Social / Presença Digital v2

export type SocialPlatform = 'instagram' | 'linkedin' | 'twitter' | 'youtube' | 'tiktok' | 'outros';
export type PostStatus = 'idea' | 'draft' | 'scheduled' | 'published';

export type SocialPost = {
  id: string;
  platform: SocialPlatform;
  content: string | null;
  status: PostStatus;
  published_at: string | null;
  url: string | null;
  tags: string[];
  notes: string | null;
  created_at: string;
  updated_at: string;
  // v2 fields
  objective_id: string | null;
  task_id: string | null;
  project_id: string | null;
  person_id: string | null;
  scheduled_at: string | null;
  engagement_likes: number | null;
  engagement_comments: number | null;
  engagement_shares: number | null;
};

export type SocialPostWithContext = SocialPost & {
  objective_title: string | null;
  task_title: string | null;
  project_name: string | null;
  person_name: string | null;
};

export type SocialGoal = {
  id: string;
  platform: string;
  metric: string;
  target: number;
  current: number;
  period: 'weekly' | 'monthly' | 'yearly';
  notes: string | null;
  created_at: string;
};

export type CreatePostInput = {
  platform: SocialPlatform;
  content?: string;
  status?: PostStatus;
  tags?: string[];
  notes?: string;
  objective_id?: string;
  task_id?: string;
  project_id?: string;
  person_id?: string;
  scheduled_at?: string;
  url?: string;
};

export type LinkPostInput = {
  post_id: string;
  objective_id?: string;
  task_id?: string;
  project_id?: string;
  person_id?: string;
};

export type UpdatePostStatusInput = {
  id: string;
  status: PostStatus;
  url?: string;
  scheduled_at?: string;
};
