import { type CommandInteraction, SlashCommandBuilder } from 'discord.js';
import {
  createAsset,
  createDocument,
  getTotalAssetValue,
  listAssets,
  listDocuments,
  listExpiringDocuments,
} from './queries';
import type { AssetType, DocumentType } from './types';

const DISCORD_TO_DB_ASSET_TYPE: Record<string, AssetType> = {
  imovel: 'real_estate',
  veiculo: 'vehicle',
  eletronico: 'electronics',
  investimento: 'investment',
  outros: 'other',
};

const DISCORD_TO_DB_DOCUMENT_TYPE: Record<string, DocumentType> = {
  identidade: 'identity',
  cnh: 'vehicle',
  passaporte: 'identity',
  contrato: 'contract',
  certificado: 'identity',
  seguro: 'health',
  outros: 'other',
};

export const bemCommand = new SlashCommandBuilder()
  .setName('bem')
  .setDescription('Gerenciar bens e patrimônio')
  .addSubcommand((sub) =>
    sub
      .setName('add')
      .setDescription('Registrar novo bem')
      .addStringOption((opt) => opt.setName('nome').setDescription('Nome do bem').setRequired(true))
      .addStringOption((opt) =>
        opt
          .setName('tipo')
          .setDescription('Tipo de bem')
          .setRequired(true)
          .addChoices(
            { name: 'Imóvel', value: 'imovel' },
            { name: 'Veículo', value: 'veiculo' },
            { name: 'Eletrônico', value: 'eletronico' },
            { name: 'Investimento', value: 'investimento' },
            { name: 'Outros', value: 'outros' },
          ),
      )
      .addNumberOption((opt) =>
        opt.setName('valor').setDescription('Valor estimado (R$)').setRequired(false),
      )
      .addStringOption((opt) =>
        opt.setName('descricao').setDescription('Descrição').setRequired(false),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName('list')
      .setDescription('Listar bens')
      .addStringOption((opt) =>
        opt
          .setName('tipo')
          .setDescription('Filtrar por tipo')
          .setRequired(false)
          .addChoices(
            { name: 'Imóvel', value: 'imovel' },
            { name: 'Veículo', value: 'veiculo' },
            { name: 'Eletrônico', value: 'eletronico' },
            { name: 'Investimento', value: 'investimento' },
            { name: 'Outros', value: 'outros' },
          ),
      ),
  );

export const documentoCommand = new SlashCommandBuilder()
  .setName('documento')
  .setDescription('Gerenciar documentos pessoais')
  .addSubcommand((sub) =>
    sub
      .setName('add')
      .setDescription('Registrar novo documento')
      .addStringOption((opt) =>
        opt.setName('nome').setDescription('Nome do documento').setRequired(true),
      )
      .addStringOption((opt) =>
        opt
          .setName('tipo')
          .setDescription('Tipo de documento')
          .setRequired(true)
          .addChoices(
            { name: 'Identidade (RG/CPF)', value: 'identidade' },
            { name: 'CNH', value: 'cnh' },
            { name: 'Passaporte', value: 'passaporte' },
            { name: 'Contrato', value: 'contrato' },
            { name: 'Certificado', value: 'certificado' },
            { name: 'Seguro', value: 'seguro' },
            { name: 'Outros', value: 'outros' },
          ),
      )
      .addStringOption((opt) =>
        opt
          .setName('vencimento')
          .setDescription('Data de vencimento (YYYY-MM-DD)')
          .setRequired(false),
      )
      .addStringOption((opt) =>
        opt.setName('descricao').setDescription('Descrição').setRequired(false),
      ),
  )
  .addSubcommand((sub) => sub.setName('list').setDescription('Listar todos os documentos'))
  .addSubcommand((sub) =>
    sub
      .setName('vencendo')
      .setDescription('Ver documentos a vencer em breve')
      .addIntegerOption((opt) =>
        opt.setName('dias').setDescription('Prazo em dias (padrão: 60)').setRequired(false),
      ),
  );

// ─── Handlers /bem ────────────────────────────────────────────────────────────

export async function handleBem(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  const sub = interaction.options.getSubcommand();
  if (sub === 'add') return handleBemAdd(interaction);
  if (sub === 'list') return handleBemList(interaction);
}

async function handleBemAdd(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  await interaction.deferReply();

  const nome = interaction.options.getString('nome', true);
  const tipoDiscord = interaction.options.getString('tipo', true);
  const tipo = DISCORD_TO_DB_ASSET_TYPE[tipoDiscord] ?? 'other';
  const valor = interaction.options.getNumber('valor') ?? undefined;
  const descricao = interaction.options.getString('descricao') ?? undefined;

  const asset = await createAsset({ name: nome, type: tipo, value: valor, notes: descricao });

  const typeEmoji: Record<string, string> = {
    real_estate: '🏠',
    vehicle: '🚗',
    electronics: '💻',
    investment: '📈',
    furniture: '🪑',
    other: '📦',
  };

  const valorStr =
    asset.value != null
      ? `\n💰 Valor: R$ ${asset.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
      : '';
  const descStr = asset.notes ? `\n📝 ${asset.notes}` : '';

  await interaction.editReply(
    `${typeEmoji[asset.type] ?? '📦'} **${asset.name}** registrado!${valorStr}${descStr}`,
  );
}

async function handleBemList(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  await interaction.deferReply();

  const tipoFiltroDiscord = interaction.options.getString('tipo');
  const tipoFiltro = tipoFiltroDiscord ? DISCORD_TO_DB_ASSET_TYPE[tipoFiltroDiscord] : undefined;
  const [assets, total] = await Promise.all([listAssets(tipoFiltro), getTotalAssetValue()]);

  if (assets.length === 0) {
    await interaction.editReply('📦 Nenhum bem registrado. Use `/bem add` para adicionar.');
    return;
  }

  const typeEmoji: Record<string, string> = {
    real_estate: '🏠',
    vehicle: '🚗',
    electronics: '💻',
    investment: '📈',
    furniture: '🪑',
    other: '📦',
  };

  const lines = assets.map((a) => {
    const emoji = typeEmoji[a.type] ?? '📦';
    const valor =
      a.value != null
        ? ` · R$ ${a.value.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`
        : '';
    return `${emoji} **${a.name}**${valor}`;
  });

  const totalStr =
    total > 0
      ? `\n\n💰 **Total estimado:** R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
      : '';
  const titulo = tipoFiltroDiscord
    ? `Bens — ${DB_TO_DISCORD_ASSET_DISPLAY[tipoFiltroDiscord] ?? tipoFiltroDiscord}`
    : 'Todos os bens';

  await interaction.editReply(
    `📦 **${titulo} (${assets.length}):**\n\n${lines.join('\n')}${totalStr}`,
  );
}

const DB_TO_DISCORD_ASSET_DISPLAY: Record<string, string> = {
  real_estate: 'Imóvel',
  vehicle: 'Veículo',
  electronics: 'Eletrônico',
  investment: 'Investimento',
  furniture: 'Móvel',
  other: 'Outros',
};

// ─── Handlers /documento ──────────────────────────────────────────────────────

export async function handleDocumento(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  const sub = interaction.options.getSubcommand();
  if (sub === 'add') return handleDocumentoAdd(interaction);
  if (sub === 'list') return handleDocumentoList(interaction);
  if (sub === 'vencendo') return handleDocumentoVencendo(interaction);
}

async function handleDocumentoAdd(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  await interaction.deferReply();

  const nome = interaction.options.getString('nome', true);
  const tipoDiscord = interaction.options.getString('tipo', true);
  const tipo = DISCORD_TO_DB_DOCUMENT_TYPE[tipoDiscord] ?? 'other';
  const vencimento = interaction.options.getString('vencimento') ?? undefined;
  const descricao = interaction.options.getString('descricao') ?? undefined;

  const doc = await createDocument({
    name: nome,
    type: tipo,
    expiry_date: vencimento,
    notes: descricao,
  });

  const typeEmoji: Record<string, string> = {
    identity: '🪪',
    contract: '📜',
    tax: '📋',
    health: '🏥',
    property: '🏠',
    vehicle: '🚗',
    other: '📄',
  };

  const vencStr = doc.expires_at
    ? `\n⏰ Vence em: ${new Date(doc.expires_at).toLocaleDateString('pt-BR')}`
    : '';

  await interaction.editReply(`${typeEmoji[doc.type] ?? '📄'} **${doc.name}** salvo!${vencStr}`);
}

async function handleDocumentoList(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  await interaction.deferReply();

  const docs = await listDocuments();
  if (docs.length === 0) {
    await interaction.editReply('📄 Nenhum documento registrado. Use `/documento add`.');
    return;
  }

  const typeEmoji: Record<string, string> = {
    identity: '🪪',
    contract: '📜',
    tax: '📋',
    health: '🏥',
    property: '🏠',
    vehicle: '🚗',
    other: '📄',
  };

  const lines = docs.map((d) => {
    const emoji = typeEmoji[d.type] ?? '📄';
    const venc = d.expires_at
      ? ` · vence ${new Date(d.expires_at).toLocaleDateString('pt-BR')}`
      : '';
    return `${emoji} **${d.name}**${venc}`;
  });

  await interaction.editReply(`📄 **Documentos (${docs.length}):**\n\n${lines.join('\n')}`);
}

async function handleDocumentoVencendo(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  await interaction.deferReply();

  const dias = interaction.options.getInteger('dias') ?? 60;
  const docs = await listExpiringDocuments(dias);

  if (docs.length === 0) {
    await interaction.editReply(`✅ Nenhum documento vencendo nos próximos ${dias} dias.`);
    return;
  }

  const lines = docs
    .map((d) => {
      if (!d.expires_at) return null;
      const venc = new Date(d.expires_at);
      const hoje = new Date();
      const diff = Math.ceil((venc.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
      const urgencia = diff <= 7 ? '🔴' : diff <= 30 ? '🟠' : '🟡';
      return `${urgencia} **${d.name}** — vence em ${diff}d (${venc.toLocaleDateString('pt-BR')})`;
    })
    .filter(Boolean);

  await interaction.editReply(`⚠️ **Documentos a vencer (${docs.length}):**\n\n${lines.join('\n')}`);
}
