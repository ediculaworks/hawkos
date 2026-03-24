import { clickupExtension } from './clickup/index';
import { extensionRegistry } from './core/registry';
import { githubExtension } from './github/index';

export function registerAllExtensions(): void {
  extensionRegistry.register(githubExtension);
  extensionRegistry.register(clickupExtension);
}

// Auto-register on import
registerAllExtensions();
