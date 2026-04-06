// Automation: Net Worth Snapshot (Actual Budget pattern)
// Tira um snapshot mensal do patrimônio líquido (ativos - passivos)
// Roda no dia 1 de cada mês às 09:30

import { getTotalAssetValue } from '@hawk/module-assets';
import { getAccounts, getNetWorthHistory, snapshotNetWorth } from '@hawk/module-finances';
import cron from 'node-cron';
import { sendToChannel } from '../channels/discord.js';
import { resolveChannel } from './resolve-channel.js';

export async function runNetWorthSnapshot(slug?: string): Promise<void> {
  const [accounts, totalAssets] = await Promise.all([getAccounts(), getTotalAssetValue()]);

  // Saldo total das contas (caixa + investimentos)
  const totalAccounts = accounts.reduce((sum, a) => sum + (a.balance ?? 0), 0);

  // Patrimônio físico (imóveis, veículos, equipamentos, etc.)
  const totalPhysicalAssets = totalAssets;

  const totalAssetValue = totalAccounts + totalPhysicalAssets;
  const totalLiabilities = 0; // TODO: integrar tabela de dívidas quando implementada

  await snapshotNetWorth(totalAssetValue, totalLiabilities, {
    accounts_balance: totalAccounts,
    physical_assets: totalPhysicalAssets,
  });

  const channelId = resolveChannel(slug);
  if (!channelId) return;

  // Comparar com snapshot anterior
  const history = await getNetWorthHistory(2);
  const netWorth = totalAssetValue - totalLiabilities;
  let deltaMsg = '';

  if (history.length >= 2) {
    const prev = history[history.length - 2];
    const delta = netWorth - (prev?.net_worth ?? 0);
    const sign = delta >= 0 ? '+' : '';
    deltaMsg = ` (${sign}R$ ${delta.toFixed(2)} vs mês anterior)`;
  }

  await sendToChannel(
    channelId,
    [
      '📊 **Snapshot mensal de patrimônio**',
      '',
      `💰 Patrimônio líquido: **R$ ${netWorth.toFixed(2)}**${deltaMsg}`,
      `  • Contas: R$ ${totalAccounts.toFixed(2)}`,
      `  • Bens físicos: R$ ${totalPhysicalAssets.toFixed(2)}`,
      `  • Passivos: R$ ${totalLiabilities.toFixed(2)}`,
    ].join('\n'),
    slug,
  );
}

export function startNetWorthSnapshotCron(): void {
  // Dia 1 de cada mês às 09:30
  cron.schedule('30 9 1 * *', () => {
    runNetWorthSnapshot().catch(console.error);
  });
}
