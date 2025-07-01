import type { ValidationResult } from '../types/validation-types.js';

export class ResponseValidator {
  validate(_expected: unknown, _actual: unknown): ValidationResult {
    throw new Error('Implementation coming in Task 6');
  }
}
