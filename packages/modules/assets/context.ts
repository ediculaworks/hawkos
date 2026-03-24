// Context Engine: Assets / Bens e Documentos
import { getTotalAssetValue, listAssets, listExpiringDocuments } from './queries';

export async function loadL0(): Promise<string> {
  try {
    const expiring = await listExpiringDocuments(30);
    if (expiring.length === 0) return 'Patrimônio: sem documentos a vencer em 30 dias.';
    return `⚠️ ${expiring.length} documento(s) vencendo em 30 dias.`;
  } catch (_error) {
    return 'Patrimônio: indisponível';
  }
}

export async function loadL1(): Promise<string> {
  try {
    const [assets, expiring, total] = await Promise.all([
      listAssets(),
      listExpiringDocuments(60),
      getTotalAssetValue(),
    ]);

    const parts: string[] = ['Patrimônio:'];
    if (assets.length > 0) parts.push(`${assets.length} bens registrados`);
    if (total > 0)
      parts.push(
        `Valor estimado: R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`,
      );
    if (expiring.length > 0) parts.push(`⚠️ ${expiring.length} doc(s) vencendo em 60 dias`);
    return parts.join('\n');
  } catch (_error) {
    return 'Patrimônio (detalhes): indisponível';
  }
}

export async function loadL2(): Promise<string> {
  try {
    const [assets, expiring, total] = await Promise.all([
      listAssets(),
      listExpiringDocuments(90),
      getTotalAssetValue(),
    ]);

    const sections: string[] = [];

    if (assets.length > 0) {
      const typeEmoji: Record<string, string> = {
        imovel: '🏠',
        veiculo: '🚗',
        eletronico: '💻',
        investimento: '📈',
        outros: '📦',
      };
      const lines = assets.map((a) => {
        const emoji = typeEmoji[a.type] ?? '📦';
        const valor =
          a.value != null
            ? ` — R$ ${a.value.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`
            : '';
        return `${emoji} ${a.name}${valor}`;
      });
      const totalStr =
        total > 0
          ? `\n💰 Total: R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`
          : '';
      sections.push(`**Bens (${assets.length}):**\n${lines.join('\n')}${totalStr}`);
    }

    if (expiring.length > 0) {
      const lines = expiring
        .map((d) => {
          if (!d.expires_at) return '';
          const venc = new Date(d.expires_at);
          const diff = Math.ceil((venc.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
          return `⚠️ ${d.name} — ${diff}d`;
        })
        .filter(Boolean);
      sections.push(`**Documentos a vencer:**\n${lines.join('\n')}`);
    }

    return sections.length > 0 ? sections.join('\n\n') : 'Patrimônio: sem dados registrados.';
  } catch (_error) {
    return 'Patrimônio (histórico): indisponível';
  }
}
