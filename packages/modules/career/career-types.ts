export type SkillCategory = 'technical' | 'soft' | 'language' | 'tool' | 'domain';

export type CareerProfile = {
  id: string;
  profile_id: string;
  headline: string | null;
  summary: string | null;
  linkedin_url: string | null;
  github_url: string | null;
  portfolio_url: string | null;
  location: string | null;
  phone: string | null;
  email: string | null;
  open_to_work: boolean;
  preferred_job_types: string[];
  salary_expectation: number | null;
  target_industry: string | null;
  target_role: string | null;
  created_at: string;
  updated_at: string;
};

export type CareerExperience = {
  id: string;
  profile_id: string;
  workspace_id: string | null;
  title: string | null;
  company_name: string;
  company_url: string | null;
  location: string | null;
  start_date: string;
  end_date: string | null;
  is_current: boolean;
  description: string | null;
  achievements: string[];
  industry: string | null;
  employment_type: string | null;
  created_at: string;
  updated_at: string;
};

export type CareerEducation = {
  id: string;
  profile_id: string;
  institution: string;
  degree: string;
  field_of_study: string | null;
  start_date: string | null;
  end_date: string | null;
  is_current: boolean;
  grade: string | null;
  activities: string[];
  description: string | null;
  created_at: string;
  updated_at: string;
};

export type CareerSkill = {
  id: string;
  profile_id: string;
  name: string;
  level: number | null;
  category: SkillCategory | null;
  years_experience: number | null;
  created_at: string;
  updated_at: string;
};

export type CareerCertification = {
  id: string;
  profile_id: string;
  name: string;
  issuer: string;
  issue_date: string | null;
  expiry_date: string | null;
  credential_id: string | null;
  credential_url: string | null;
  created_at: string;
  updated_at: string;
};

export type CreateProfileInput = {
  headline?: string;
  summary?: string;
  linkedin_url?: string;
  github_url?: string;
  portfolio_url?: string;
  location?: string;
  phone?: string;
  email?: string;
  open_to_work?: boolean;
  preferred_job_types?: string[];
  salary_expectation?: number;
  target_industry?: string;
  target_role?: string;
};

export type CreateExperienceInput = {
  workspace_id?: string;
  title?: string;
  company_name: string;
  company_url?: string;
  location?: string;
  start_date: string;
  end_date?: string;
  is_current?: boolean;
  description?: string;
  achievements?: string[];
  industry?: string;
  employment_type?: string;
};

export type CreateEducationInput = {
  institution: string;
  degree: string;
  field_of_study?: string;
  start_date?: string;
  end_date?: string;
  is_current?: boolean;
  grade?: string;
  activities?: string[];
  description?: string;
};

export type CreateSkillInput = {
  name: string;
  level?: number;
  category?: SkillCategory;
  years_experience?: number;
};

export type CreateCertificationInput = {
  name: string;
  issuer: string;
  issue_date?: string;
  expiry_date?: string;
  credential_id?: string;
  credential_url?: string;
};
