import { describe, expect, it } from 'vitest';
import { needsCompression } from '../history-compressor';

describe('History Compressor', () => {
  describe('needsCompression', () => {
    it('should not compress under threshold', () => {
      expect(needsCompression(10_000)).toBe(false);
      expect(needsCompression(59_999)).toBe(false);
    });

    it('should compress at threshold', () => {
      expect(needsCompression(60_001)).toBe(true);
      expect(needsCompression(80_000)).toBe(true);
    });

    it('should handle zero', () => {
      expect(needsCompression(0)).toBe(false);
    });
  });
});
