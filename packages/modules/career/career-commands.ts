import { type CommandInteraction, SlashCommandBuilder } from 'discord.js';
import {
  deleteCareerExperience,
  deleteCareerSkill,
  getCareerProfile,
  listCareerCertifications,
  listCareerEducations,
  listCareerExperiences,
  listCareerSkills,
  upsertCareerCertification,
  upsertCareerEducation,
  upsertCareerExperience,
  upsertCareerProfile,
  upsertCareerSkill,
} from './career-queries';

const perfilCommand = new SlashCommandBuilder()
  .setName('perfil')
  .setDescription('Ver ou atualizar perfil de carreira')
  .addStringOption((opt) =>
    opt
      .setName('headline')
      .setDescription('Título profissional (ex: Médico & Co-founder)')
      .setRequired(false),
  )
  .addStringOption((opt) =>
    opt.setName('resumo').setDescription('Resumo profissional').setRequired(false),
  )
  .addStringOption((opt) =>
    opt.setName('linkedin').setDescription('URL do LinkedIn').setRequired(false),
  )
  .addStringOption((opt) =>
    opt.setName('github').setDescription('URL do GitHub').setRequired(false),
  )
  .addStringOption((opt) =>
    opt
      .setName('open_to_work')
      .setDescription('Estou aberto a oportunidades')
      .setRequired(false)
      .addChoices({ name: 'Sim', value: 'true' }, { name: 'Não', value: 'false' }),
  );

const experienciaCommand = new SlashCommandBuilder()
  .setName('experiencia')
  .setDescription('Gerenciar experiências profissionais')
  .addSubcommand((sub) =>
    sub
      .setName('add')
      .setDescription('Adicionar experiência')
      .addStringOption((opt) =>
        opt.setName('empresa').setDescription('Nome da empresa').setRequired(true),
      )
      .addStringOption((opt) =>
        opt.setName('inicio').setDescription('Data início (YYYY-MM)').setRequired(true),
      )
      .addStringOption((opt) => opt.setName('cargo').setDescription('Cargo').setRequired(false))
      .addStringOption((opt) =>
        opt.setName('fim').setDescription('Data fim (YYYY-MM) ou "atual"').setRequired(false),
      )
      .addStringOption((opt) =>
        opt.setName('descricao').setDescription('Descrição').setRequired(false),
      ),
  )
  .addSubcommand((sub) => sub.setName('list').setDescription('Listar experiências'))
  .addSubcommand((sub) =>
    sub
      .setName('del')
      .setDescription('Remover experiência')
      .addStringOption((opt) =>
        opt.setName('id').setDescription('ID da experiência').setRequired(true),
      ),
  );

const formacaoCommand = new SlashCommandBuilder()
  .setName('formacao')
  .setDescription('Gerenciar formação acadêmica')
  .addSubcommand((sub) =>
    sub
      .setName('add')
      .setDescription('Adicionar formação')
      .addStringOption((opt) =>
        opt.setName('instituicao').setDescription('Instituição').setRequired(true),
      )
      .addStringOption((opt) => opt.setName('curso').setDescription('Curso/Grau').setRequired(true))
      .addStringOption((opt) =>
        opt.setName('area').setDescription('Área de estudo').setRequired(false),
      )
      .addStringOption((opt) =>
        opt.setName('inicio').setDescription('Data início (YYYY)').setRequired(false),
      )
      .addStringOption((opt) =>
        opt.setName('fim').setDescription('Data fim (YYYY)').setRequired(false),
      ),
  )
  .addSubcommand((sub) => sub.setName('list').setDescription('Listar formação'));

const skillCommand = new SlashCommandBuilder()
  .setName('skill')
  .setDescription('Gerenciar habilidades')
  .addSubcommand((sub) =>
    sub
      .setName('add')
      .setDescription('Adicionar habilidade')
      .addStringOption((opt) =>
        opt.setName('nome').setDescription('Nome da habilidade').setRequired(true),
      )
      .addIntegerOption((opt) =>
        opt
          .setName('nivel')
          .setDescription('Nível 1-5')
          .setMinValue(1)
          .setMaxValue(5)
          .setRequired(false),
      )
      .addStringOption((opt) =>
        opt
          .setName('categoria')
          .setDescription('Categoria')
          .setRequired(false)
          .addChoices(
            { name: 'Técnica', value: 'technical' },
            { name: 'Comportamental', value: 'soft' },
            { name: 'Idioma', value: 'language' },
            { name: 'Ferramenta', value: 'tool' },
            { name: 'Domínio', value: 'domain' },
          ),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName('list')
      .setDescription('Listar habilidades')
      .addStringOption((opt) =>
        opt
          .setName('categoria')
          .setDescription('Filtrar por categoria')
          .setRequired(false)
          .addChoices(
            { name: 'Técnica', value: 'technical' },
            { name: 'Comportamental', value: 'soft' },
            { name: 'Idioma', value: 'language' },
            { name: 'Ferramenta', value: 'tool' },
            { name: 'Domínio', value: 'domain' },
          ),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName('del')
      .setDescription('Remover habilidade')
      .addStringOption((opt) =>
        opt.setName('nome').setDescription('Nome da habilidade').setRequired(true),
      ),
  );

const certificadoCommand = new SlashCommandBuilder()
  .setName('certificado')
  .setDescription('Gerenciar certificações')
  .addSubcommand((sub) =>
    sub
      .setName('add')
      .setDescription('Adicionar certificação')
      .addStringOption((opt) =>
        opt.setName('nome').setDescription('Nome da certificação').setRequired(true),
      )
      .addStringOption((opt) => opt.setName('emissor').setDescription('Emissor').setRequired(true))
      .addStringOption((opt) =>
        opt.setName('data').setDescription('Data (YYYY-MM)').setRequired(false),
      ),
  )
  .addSubcommand((sub) => sub.setName('list').setDescription('Listar certificações'));

// ─── Handlers ────────────────────────────────────────────────────────────────

export async function handlePerfil(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  await interaction.deferReply();

  const headline = interaction.options.getString('headline');
  const resumo = interaction.options.getString('resumo');
  const linkedin = interaction.options.getString('linkedin');
  const github = interaction.options.getString('github');
  const openToWork = interaction.options.getString('open_to_work');

  if (!headline && !resumo && !linkedin && !github && !openToWork) {
    const profile = await getCareerProfile();
    if (!profile) {
      await interaction.editReply(
        '📋 Nenhum perfil de carreira encontrado. Use `/perfil` com参数 para criar.',
      );
      return;
    }
    const lines: string[] = [];
    if (profile.headline) lines.push(`**${profile.headline}**`);
    if (profile.summary) lines.push(profile.summary);
    if (profile.linkedin_url) lines.push(`LinkedIn: ${profile.linkedin_url}`);
    if (profile.github_url) lines.push(`GitHub: ${profile.github_url}`);
    lines.push(`Open to Work: ${profile.open_to_work ? '✅' : '❌'}`);
    await interaction.editReply(lines.join('\n'));
    return;
  }

  try {
    const updated = await upsertCareerProfile({
      headline: headline ?? undefined,
      summary: resumo ?? undefined,
      linkedin_url: linkedin ?? undefined,
      github_url: github ?? undefined,
      open_to_work: openToWork === 'true' ? true : openToWork === 'false' ? false : undefined,
    });
    await interaction.editReply(
      `✅ Perfil atualizado: **${updated.headline ?? 'Perfil de carreira'}**`,
    );
  } catch (err) {
    await interaction.editReply(
      `❌ Erro: ${err instanceof Error ? err.message : 'Erro desconhecido'}`,
    );
  }
}

export async function handleExperiencia(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  await interaction.deferReply();

  const subcommand = interaction.options.getSubcommand();

  if (subcommand === 'list') {
    const exps = await listCareerExperiences();
    if (exps.length === 0) {
      await interaction.editReply('Nenhuma experiência cadastrada.');
      return;
    }
    // biome-ignore lint/suspicious/noExplicitAny: types resolved after bun db:types
    const lines = (exps as any[]).map(
      // biome-ignore lint/suspicious/noExplicitAny: types resolved after bun db:types
      (e: any) => {
        const period = `${e.start_date.slice(0, 7)} – ${e.is_current ? 'atual' : (e.end_date?.slice(0, 7) ?? '')}`;
        return `• **${e.title ?? '—'}** @ ${e.company_name} (${period})`;
      },
    );
    await interaction.editReply(`**Experiências (${exps.length}):**\n${lines.join('\n')}`);
    return;
  }

  if (subcommand === 'add') {
    const empresa = interaction.options.getString('empresa', true);
    const cargo = interaction.options.getString('cargo');
    const inicio = interaction.options.getString('inicio', true);
    const fim = interaction.options.getString('fim');
    const descricao = interaction.options.getString('descricao');

    try {
      const exp = await upsertCareerExperience({
        company_name: empresa,
        title: cargo ?? undefined,
        start_date: inicio,
        end_date: fim === 'atual' ? undefined : (fim ?? undefined),
        is_current: fim === 'atual',
        description: descricao ?? undefined,
      });
      await interaction.editReply(
        `✅ Experiência adicionada: **${exp.title ?? cargo ?? empresa}** @ ${exp.company_name}`,
      );
    } catch (err) {
      await interaction.editReply(
        `❌ Erro: ${err instanceof Error ? err.message : 'Erro desconhecido'}`,
      );
    }
    return;
  }

  if (subcommand === 'del') {
    const id = interaction.options.getString('id', true);
    try {
      await deleteCareerExperience(id);
      await interaction.editReply('✅ Experiência removida.');
    } catch (err) {
      await interaction.editReply(
        `❌ Erro: ${err instanceof Error ? err.message : 'Erro desconhecido'}`,
      );
    }
  }
}

export async function handleFormacao(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  await interaction.deferReply();

  const subcommand = interaction.options.getSubcommand();

  if (subcommand === 'list') {
    const edus = await listCareerEducations();
    if (edus.length === 0) {
      await interaction.editReply('Nenhuma formação cadastrada.');
      return;
    }
    // biome-ignore lint/suspicious/noExplicitAny: types resolved after bun db:types
    const lines = edus.map((e: any) => {
      const period = `${e.start_date?.slice(0, 4) ?? ''} – ${e.is_current ? 'atual' : (e.end_date?.slice(0, 4) ?? '')}`;
      return `• **${e.degree}** @ ${e.institution} (${period})`;
    });
    await interaction.editReply(`**Formação (${edus.length}):**\n${lines.join('\n')}`);
    return;
  }

  if (subcommand === 'add') {
    const instituicao = interaction.options.getString('instituicao', true);
    const curso = interaction.options.getString('curso', true);
    const area = interaction.options.getString('area');
    const inicio = interaction.options.getString('inicio');
    const fim = interaction.options.getString('fim');

    try {
      const edu = await upsertCareerEducation({
        institution: instituicao,
        degree: curso,
        field_of_study: area ?? undefined,
        start_date: inicio ?? undefined,
        end_date: fim ?? undefined,
      });
      await interaction.editReply(`✅ Formação adicionada: **${edu.degree}** @ ${edu.institution}`);
    } catch (err) {
      await interaction.editReply(
        `❌ Erro: ${err instanceof Error ? err.message : 'Erro desconhecido'}`,
      );
    }
  }
}

export async function handleSkill(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  await interaction.deferReply();

  const subcommand = interaction.options.getSubcommand();

  if (subcommand === 'list') {
    const cat = interaction.options.getString('categoria') as
      | 'technical'
      | 'soft'
      | 'language'
      | 'tool'
      | 'domain'
      | null;
    const skills = await listCareerSkills(cat ?? undefined);
    if (skills.length === 0) {
      await interaction.editReply('Nenhuma habilidade cadastrada.');
      return;
    }
    const levelBars = (l: number | null) => {
      if (!l) return '?';
      return '🟩'.repeat(l) + '⬜'.repeat(5 - l);
    };
    // biome-ignore lint/suspicious/noExplicitAny: types resolved after bun db:types
    const lines = (skills as any[]).map(
      // biome-ignore lint/suspicious/noExplicitAny: types resolved after bun db:types
      (s: any) => `• **${s.name}** ${levelBars(s.level)} [${s.category ?? '—'}]`,
    );
    await interaction.editReply(`**Habilidades (${skills.length}):**\n${lines.join('\n')}`);
    return;
  }

  if (subcommand === 'add') {
    const nome = interaction.options.getString('nome', true);
    const nivel = interaction.options.getInteger('nivel');
    const categoria = interaction.options.getString('categoria') as
      | 'technical'
      | 'soft'
      | 'language'
      | 'tool'
      | 'domain'
      | null;

    try {
      const skill = await upsertCareerSkill({
        name: nome,
        level: nivel ?? undefined,
        category: categoria ?? undefined,
      });
      await interaction.editReply(
        `✅ Skill adicionada: **${skill.name}** (nível ${skill.level ?? '?'})`,
      );
    } catch (err) {
      await interaction.editReply(
        `❌ Erro: ${err instanceof Error ? err.message : 'Erro desconhecido'}`,
      );
    }
  }

  if (subcommand === 'del') {
    const nome = interaction.options.getString('nome', true);
    const skills = await listCareerSkills();
    // biome-ignore lint/suspicious/noExplicitAny: types resolved after bun db:types
    const skill = skills.find((s: any) => s.name.toLowerCase() === nome.toLowerCase());
    if (!skill) {
      await interaction.editReply(`❌ Habilidade "${nome}" não encontrada.`);
      return;
    }
    try {
      await deleteCareerSkill(skill.id);
      await interaction.editReply(`✅ **${skill.name}** removida.`);
    } catch (err) {
      await interaction.editReply(
        `❌ Erro: ${err instanceof Error ? err.message : 'Erro desconhecido'}`,
      );
    }
  }
}

export async function handleCertificado(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  await interaction.deferReply();

  const subcommand = interaction.options.getSubcommand();

  if (subcommand === 'list') {
    const certs = await listCareerCertifications();
    if (certs.length === 0) {
      await interaction.editReply('Nenhuma certificação cadastrada.');
      return;
    }
    // biome-ignore lint/suspicious/noExplicitAny: types resolved after bun db:types
    const lines = certs.map((c: any) => {
      const expiry = c.expiry_date ? ` · Vence: ${c.expiry_date.slice(0, 7)}` : '';
      return `• **${c.name}** @ ${c.issuer}${expiry}`;
    });
    await interaction.editReply(`**Certificações (${certs.length}):**\n${lines.join('\n')}`);
    return;
  }

  if (subcommand === 'add') {
    const nome = interaction.options.getString('nome', true);
    const emissor = interaction.options.getString('emissor', true);
    const data = interaction.options.getString('data');

    try {
      const cert = await upsertCareerCertification({
        name: nome,
        issuer: emissor,
        issue_date: data ?? undefined,
      });
      await interaction.editReply(`✅ Certificação adicionada: **${cert.name}** (${cert.issuer})`);
    } catch (err) {
      await interaction.editReply(
        `❌ Erro: ${err instanceof Error ? err.message : 'Erro desconhecido'}`,
      );
    }
  }
}

export { perfilCommand, experienciaCommand, formacaoCommand, skillCommand, certificadoCommand };
