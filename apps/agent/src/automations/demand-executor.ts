// Demand Executor: processa a fila de demands a cada 2 minutos
import { processDemandQueue, setDemandNotifier } from '@hawk/module-demands/engine';
import cron from 'node-cron';

let isProcessing = false;
export function setDemandBroadcast(
  fn: (type: string, data: Record<string, unknown>) => void,
): void {
  setDemandNotifier(fn);
}

export function startDemandExecutorCron(): void {
  // Run every 2 minutes
  cron.schedule('*/2 * * * *', async () => {
    if (isProcessing) return;
    isProcessing = true;
    try {
      await processDemandQueue();
    } catch (err) {
      console.error('[demand-executor] Queue processing failed:', err);
    } finally {
      isProcessing = false;
    }
  });

  console.log('[demand-executor] Cron started (every 2 minutes)');
}
