import type { ExtensionDefinition, ExtensionId } from './types';

class ExtensionRegistry {
  private extensions = new Map<ExtensionId, ExtensionDefinition>();

  register(ext: ExtensionDefinition): void {
    this.extensions.set(ext.id, ext);
  }

  get(id: ExtensionId): ExtensionDefinition | undefined {
    return this.extensions.get(id);
  }

  getAll(): ExtensionDefinition[] {
    return Array.from(this.extensions.values());
  }

  getByModule(moduleId: string): ExtensionDefinition[] {
    return this.getAll().filter((ext) => ext.relatedModules.includes(moduleId));
  }

  has(id: ExtensionId): boolean {
    return this.extensions.has(id);
  }
}

export const extensionRegistry = new ExtensionRegistry();
