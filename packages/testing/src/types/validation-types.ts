export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

export interface ValidationError {
  path: string;
  expected: unknown;
  actual: unknown;
  message: string;
}

export interface ResponseValidatorOptions {
  strictMode?: boolean;
  allowPartialMatch?: boolean;
  ignoreFields?: string[];
}
