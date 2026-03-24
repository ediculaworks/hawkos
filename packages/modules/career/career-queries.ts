import { db } from '@hawk/db';
import type {
  CareerCertification,
  CareerEducation,
  CareerExperience,
  CareerProfile,
  CareerSkill,
  CreateCertificationInput,
  CreateEducationInput,
  CreateExperienceInput,
  CreateProfileInput,
  CreateSkillInput,
  SkillCategory,
} from './career-types';

let _cachedProfileId: string | null = null;

async function getCareerProfileId(): Promise<string | null> {
  if (_cachedProfileId) return _cachedProfileId;
  const { data } = await db.from('profile').select('id').limit(1).single();
  _cachedProfileId = (data as { id: string } | null)?.id ?? null;
  return _cachedProfileId;
}

export async function getCareerProfile(): Promise<CareerProfile | null> {
  const profileId = await getCareerProfileId();
  if (!profileId) return null;

  const { data, error } = await db
    .from('career_profiles')
    .select('*')
    .eq('profile_id', profileId)
    .maybeSingle();

  if (error) throw new Error(`Failed to get career profile: ${error.message}`);
  return data as CareerProfile | null;
}

export async function upsertCareerProfile(input: CreateProfileInput): Promise<CareerProfile> {
  const profileId = await getCareerProfileId();
  if (!profileId) throw new Error('No authenticated user');

  const { data, error } = await db
    .from('career_profiles')
    .upsert(
      {
        profile_id: profileId,
        headline: input.headline ?? null,
        summary: input.summary ?? null,
        linkedin_url: input.linkedin_url ?? null,
        github_url: input.github_url ?? null,
        portfolio_url: input.portfolio_url ?? null,
        location: input.location ?? null,
        phone: input.phone ?? null,
        email: input.email ?? null,
        open_to_work: input.open_to_work ?? false,
        preferred_job_types: input.preferred_job_types ?? [],
        salary_expectation: input.salary_expectation ?? null,
        target_industry: input.target_industry ?? null,
        target_role: input.target_role ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'profile_id' },
    )
    .select()
    .single();

  if (error) throw new Error(`Failed to upsert career profile: ${error.message}`);
  return data as CareerProfile;
}

export async function listCareerExperiences(): Promise<CareerExperience[]> {
  const profileId = await getCareerProfileId();
  if (!profileId) return [];

  const { data, error } = await db
    .from('career_experiences')
    .select('*')
    .eq('profile_id', profileId)
    .order('start_date', { ascending: false });

  if (error) throw new Error(`Failed to list experiences: ${error.message}`);
  return (data ?? []) as CareerExperience[];
}

export async function upsertCareerExperience(
  input: CreateExperienceInput,
  id?: string,
): Promise<CareerExperience> {
  const profileId = await getCareerProfileId();
  if (!profileId) throw new Error('No authenticated user');

  const payload = {
    profile_id: profileId,
    workspace_id: input.workspace_id ?? null,
    title: input.title ?? null,
    company_name: input.company_name,
    company_url: input.company_url ?? null,
    location: input.location ?? null,
    start_date: input.start_date,
    end_date: input.end_date ?? null,
    is_current: input.is_current ?? false,
    description: input.description ?? null,
    achievements: input.achievements ?? [],
    industry: input.industry ?? null,
    employment_type: input.employment_type ?? null,
    updated_at: new Date().toISOString(),
  };

  if (id) {
    const { data, error } = await db
      .from('career_experiences')
      .update(payload as Record<string, unknown>)
      .eq('id', id)
      .eq('profile_id', profileId)
      .select()
      .single();

    if (error) throw new Error(`Failed to update experience: ${error.message}`);
    return data as CareerExperience;
  }

  const { data, error } = await db
    .from('career_experiences')
    // biome-ignore lint/suspicious/noExplicitAny: payload shape matches DB but TS can't verify
    .insert(payload as any)
    .select()
    .single();

  if (error) throw new Error(`Failed to insert experience: ${error.message}`);
  return data as CareerExperience;
}

export async function deleteCareerExperience(id: string): Promise<void> {
  const profileId = await getCareerProfileId();
  if (!profileId) throw new Error('No authenticated user');

  const { error } = await db
    .from('career_experiences')
    .delete()
    .eq('id', id)
    .eq('profile_id', profileId);

  if (error) throw new Error(`Failed to delete experience: ${error.message}`);
}

export async function listCareerEducations(): Promise<CareerEducation[]> {
  const profileId = await getCareerProfileId();
  if (!profileId) return [];

  const { data, error } = await db
    .from('career_educations')
    .select('*')
    .eq('profile_id', profileId)
    .order('start_date', { ascending: false });

  if (error) throw new Error(`Failed to list educations: ${error.message}`);
  return (data ?? []) as CareerEducation[];
}

export async function upsertCareerEducation(
  input: CreateEducationInput,
  id?: string,
): Promise<CareerEducation> {
  const profileId = await getCareerProfileId();
  if (!profileId) throw new Error('No authenticated user');

  const payload = {
    profile_id: profileId,
    institution: input.institution,
    degree: input.degree,
    field_of_study: input.field_of_study ?? null,
    start_date: input.start_date ?? null,
    end_date: input.end_date ?? null,
    is_current: input.is_current ?? false,
    grade: input.grade ?? null,
    activities: input.activities ?? [],
    description: input.description ?? null,
    updated_at: new Date().toISOString(),
  };

  if (id) {
    const { data, error } = await db
      .from('career_educations')
      .update(payload)
      .eq('id', id)
      .eq('profile_id', profileId)
      .select()
      .single();

    if (error) throw new Error(`Failed to update education: ${error.message}`);
    return data as CareerEducation;
  }

  const { data, error } = await db.from('career_educations').insert(payload).select().single();

  if (error) throw new Error(`Failed to insert education: ${error.message}`);
  return data as CareerEducation;
}

export async function deleteCareerEducation(id: string): Promise<void> {
  const profileId = await getCareerProfileId();
  if (!profileId) throw new Error('No authenticated user');

  const { error } = await db
    .from('career_educations')
    .delete()
    .eq('id', id)
    .eq('profile_id', profileId);

  if (error) throw new Error(`Failed to delete education: ${error.message}`);
}

export async function listCareerSkills(category?: SkillCategory): Promise<CareerSkill[]> {
  const profileId = await getCareerProfileId();
  if (!profileId) return [];

  let q = db.from('career_skills').select('*').eq('profile_id', profileId);
  if (category) {
    q = q.eq('category', category);
  }
  const { data, error } = await q.order('level', { ascending: false });

  if (error) throw new Error(`Failed to list skills: ${error.message}`);
  return (data ?? []) as CareerSkill[];
}

export async function upsertCareerSkill(
  input: CreateSkillInput,
  id?: string,
): Promise<CareerSkill> {
  const profileId = await getCareerProfileId();
  if (!profileId) throw new Error('No authenticated user');

  const payload = {
    profile_id: profileId,
    name: input.name,
    level: input.level ?? null,
    category: input.category ?? null,
    years_experience: input.years_experience ?? null,
    updated_at: new Date().toISOString(),
  };

  if (id) {
    const { data, error } = await db
      .from('career_skills')
      .update(payload)
      .eq('id', id)
      .eq('profile_id', profileId)
      .select()
      .single();

    if (error) throw new Error(`Failed to update skill: ${error.message}`);
    return data as CareerSkill;
  }

  const { data, error } = await db
    .from('career_skills')
    .upsert(payload, { onConflict: 'profile_id,name' })
    .select()
    .single();

  if (error) throw new Error(`Failed to upsert skill: ${error.message}`);
  return data as CareerSkill;
}

export async function deleteCareerSkill(id: string): Promise<void> {
  const profileId = await getCareerProfileId();
  if (!profileId) throw new Error('No authenticated user');

  const { error } = await db
    .from('career_skills')
    .delete()
    .eq('id', id)
    .eq('profile_id', profileId);

  if (error) throw new Error(`Failed to delete skill: ${error.message}`);
}

export async function listCareerCertifications(): Promise<CareerCertification[]> {
  const profileId = await getCareerProfileId();
  if (!profileId) return [];

  const { data, error } = await db
    .from('career_certifications')
    .select('*')
    .eq('profile_id', profileId)
    .order('issue_date', { ascending: false });

  if (error) throw new Error(`Failed to list certifications: ${error.message}`);
  return (data ?? []) as CareerCertification[];
}

export async function upsertCareerCertification(
  input: CreateCertificationInput,
  id?: string,
): Promise<CareerCertification> {
  const profileId = await getCareerProfileId();
  if (!profileId) throw new Error('No authenticated user');

  const payload = {
    profile_id: profileId,
    name: input.name,
    issuer: input.issuer,
    issue_date: input.issue_date ?? null,
    expiry_date: input.expiry_date ?? null,
    credential_id: input.credential_id ?? null,
    credential_url: input.credential_url ?? null,
    updated_at: new Date().toISOString(),
  };

  if (id) {
    const { data, error } = await db
      .from('career_certifications')
      .update(payload)
      .eq('id', id)
      .eq('profile_id', profileId)
      .select()
      .single();

    if (error) throw new Error(`Failed to update certification: ${error.message}`);
    return data as CareerCertification;
  }

  const { data, error } = await db.from('career_certifications').insert(payload).select().single();

  if (error) throw new Error(`Failed to insert certification: ${error.message}`);
  return data as CareerCertification;
}

export async function deleteCareerCertification(id: string): Promise<void> {
  const profileId = await getCareerProfileId();
  if (!profileId) throw new Error('No authenticated user');

  const { error } = await db
    .from('career_certifications')
    .delete()
    .eq('id', id)
    .eq('profile_id', profileId);

  if (error) throw new Error(`Failed to delete certification: ${error.message}`);
}
