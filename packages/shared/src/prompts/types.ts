/**
 * Prompt Pattern types — Fabric-inspired pattern library for Hawk OS.
 */

export interface PatternDefinition {
  /** Unique ID: module/name (e.g., "finances/analyze-spending") */
  id: string;
  /** Human-readable name */
  name: string;
  /** Short description of what this pattern does */
  description: string;
  /** Target module (or "universal" for cross-module patterns) */
  module: string;
  /** The prompt template with {{variable}} placeholders */
  template: string;
  /** Required variables that must be provided */
  requiredVars: string[];
  /** Optional variables with defaults */
  optionalVars?: Record<string, string>;
}

export interface PatternInput {
  patternId: string;
  variables: Record<string, string>;
}
