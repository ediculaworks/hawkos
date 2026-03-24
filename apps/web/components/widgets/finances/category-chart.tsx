'use client';

import { fetchRecentTransactions } from '@/lib/actions/finances';
import { CHART_COLORS } from '@/lib/utils/chart-colors';
import { formatCurrency } from '@/lib/utils/format';
import { useQuery } from '@tanstack/react-query';
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export default function CategoryChartWidget() {
  const { data: transactions } = useQuery({
    queryKey: ['finances', 'transactions-recent'],
    queryFn: () => fetchRecentTransactions(100),
  });

  if (!transactions || transactions.length === 0) {
    return <p className="text-sm text-[var(--color-text-muted)]">Sem dados de despesas</p>;
  }

  // Aggregate by description (approximation — ideally by category name)
  const expenses = transactions.filter((t) => t.type === 'expense');
  const grouped: Record<string, number> = {};
  for (const t of expenses) {
    const key = t.description || 'Outros';
    grouped[key] = (grouped[key] ?? 0) + t.amount;
  }

  const data = Object.entries(grouped)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, value]) => ({ name: name.length > 12 ? `${name.slice(0, 12)}…` : name, value }));

  if (data.length === 0) {
    return <p className="text-sm text-[var(--color-text-muted)]">Sem despesas este mês</p>;
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="name"
          width={80}
          tick={{ fontSize: 11, fill: 'oklch(0.65 0.01 260)' }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          formatter={(value) => formatCurrency(Number(value))}
          contentStyle={{
            background: 'oklch(0.16 0.012 260)',
            border: '1px solid oklch(0.25 0.015 260)',
            borderRadius: '10px',
            fontSize: '12px',
            color: 'oklch(0.93 0.01 260)',
          }}
        />
        <Bar dataKey="value" radius={[0, 4, 4, 0]}>
          {data.map((entry, idx) => (
            <Cell key={entry.name} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
