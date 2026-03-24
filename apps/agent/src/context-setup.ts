// Context Engine Registration — all modules
// L0 is synchronous per the ContextModule interface, so we cache async results
// and refresh every 5 minutes in the background.

import { registerModule } from '@hawk/context-engine';
import * as assets from '@hawk/module-assets';
import * as calendar from '@hawk/module-calendar';
import * as career from '@hawk/module-career';
// Phase 6
import * as entertainment from '@hawk/module-entertainment';
// Phase 1
import * as finances from '@hawk/module-finances';
// Phase 3
import * as health from '@hawk/module-health';
import * as housing from '@hawk/module-housing';
import * as journal from '@hawk/module-journal';
// Phase 5
import * as knowledge from '@hawk/module-knowledge';
import * as legal from '@hawk/module-legal';
// Memory
import * as memory from '@hawk/module-memory';
import * as objectives from '@hawk/module-objectives';
// Phase 4
import * as people from '@hawk/module-people';
// Phase 2
import * as routine from '@hawk/module-routine';
import * as security from '@hawk/module-security';
import * as social from '@hawk/module-social';
import * as spirituality from '@hawk/module-spirituality';

type AsyncLoader = () => Promise<string>;

function makeModule(
  id: Parameters<typeof registerModule>[0]['id'],
  l0Fn: AsyncLoader,
  l1Fn: AsyncLoader,
  l2Fn: AsyncLoader,
) {
  let cachedL0 = '';

  const refresh = () =>
    l0Fn()
      .then((v) => {
        cachedL0 = v;
      })
      .catch(() => {});

  // Warm up immediately
  refresh();
  // Refresh every 5 minutes
  setInterval(refresh, 5 * 60 * 1000);

  registerModule({
    id,
    getL0: () => cachedL0,
    getL1: l1Fn,
    getL2: l2Fn,
  });
}

export function setupContextModules(): void {
  makeModule('health', health.loadL0, health.loadL1, health.loadL2);
  makeModule('finances', finances.loadL0, finances.loadL1, finances.loadL2);
  makeModule('calendar', calendar.loadL0, calendar.loadL1, calendar.loadL2);
  makeModule('routine', routine.loadL0, routine.loadL1, routine.loadL2);
  makeModule('journal', journal.loadL0, journal.loadL1, journal.loadL2);
  makeModule('objectives', objectives.loadL0, objectives.loadL1, objectives.loadL2);
  makeModule('people', people.loadL0, people.loadL1, people.loadL2);
  makeModule('career', career.loadL0, career.loadL1, career.loadL2);
  makeModule('legal', legal.loadL0, legal.loadL1, legal.loadL2);
  makeModule('knowledge', knowledge.loadL0, knowledge.loadL1, knowledge.loadL2);
  makeModule('assets', assets.loadL0, assets.loadL1, assets.loadL2);
  makeModule('housing', housing.loadL0, housing.loadL1, housing.loadL2);
  makeModule('security', security.loadL0, security.loadL1, security.loadL2);
  makeModule('entertainment', entertainment.loadL0, entertainment.loadL1, entertainment.loadL2);
  makeModule('social', social.loadL0, social.loadL1, social.loadL2);
  makeModule('spirituality', spirituality.loadL0, spirituality.loadL1, spirituality.loadL2);

  // System modules
  makeModule(
    'memory' as Parameters<typeof registerModule>[0]['id'],
    memory.loadL0,
    memory.loadL1,
    memory.loadL2,
  );
}
