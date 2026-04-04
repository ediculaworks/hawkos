import { describe, expect, it } from 'vitest';
import { AuthorizationError, HawkError, NotFoundError, ValidationError } from '../errors';

describe('Error Hierarchy', () => {
  describe('HawkError', () => {
    it('should have code and message', () => {
      const err = new HawkError('test message', 'TEST_CODE');
      expect(err.message).toBe('test message');
      expect(err.code).toBe('TEST_CODE');
      expect(err.name).toBe('HawkError');
      expect(err).toBeInstanceOf(Error);
      expect(err).toBeInstanceOf(HawkError);
    });
  });

  describe('ValidationError', () => {
    it('should have VALIDATION_ERROR code', () => {
      const err = new ValidationError('invalid input');
      expect(err.code).toBe('VALIDATION_FAILED');
      expect(err.name).toBe('ValidationError');
      expect(err).toBeInstanceOf(HawkError);
    });
  });

  describe('NotFoundError', () => {
    it('should format resource name', () => {
      const err = new NotFoundError('transaction');
      expect(err.message).toBe('transaction not found');
      expect(err.code).toBe('NOT_FOUND');
      expect(err).toBeInstanceOf(HawkError);
    });
  });

  describe('AuthorizationError', () => {
    it('should have fixed message and code', () => {
      const err = new AuthorizationError();
      expect(err.message).toBe('Unauthorized');
      expect(err.code).toBe('UNAUTHORIZED');
      expect(err).toBeInstanceOf(HawkError);
    });
  });

  describe('instanceof checks', () => {
    it('should support catch-by-type', () => {
      try {
        throw new NotFoundError('user');
      } catch (err) {
        expect(err).toBeInstanceOf(HawkError);
        expect(err).toBeInstanceOf(NotFoundError);
        expect(err).not.toBeInstanceOf(ValidationError);
      }
    });
  });
});
