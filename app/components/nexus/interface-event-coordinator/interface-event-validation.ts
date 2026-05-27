/**
 * File: interface-event-validation.ts
 * Description: Local UI-owned validation helpers for interface events.
 */

import type {
  InterfaceEventValidationIssue,
  InterfaceEventValidationResult,
  InterfaceEventValidator,
} from './interface-event-types';

function isBlank(value: unknown): boolean {
  return typeof value === 'string' ? value.trim().length === 0 : value == null;
}

export function createInterfaceValidationIssue(input: {
  field: string;
  code: string;
  message: string;
}): InterfaceEventValidationIssue {
  return input;
}

export function requiredInterfaceValue(
  field: string,
  value: unknown,
  message = `${field} is required.`
): InterfaceEventValidator {
  return () =>
    isBlank(value)
      ? createInterfaceValidationIssue({ field, code: 'required', message })
      : null;
}

export function interfaceStringLength(input: {
  field: string;
  value: string;
  min?: number;
  max?: number;
  message?: string;
}): InterfaceEventValidator {
  return () => {
    const length = input.value.trim().length;

    if (typeof input.min === 'number' && length < input.min) {
      return createInterfaceValidationIssue({
        field: input.field,
        code: 'too_short',
        message: input.message ?? `${input.field} is too short.`,
      });
    }

    if (typeof input.max === 'number' && length > input.max) {
      return createInterfaceValidationIssue({
        field: input.field,
        code: 'too_long',
        message: input.message ?? `${input.field} is too long.`,
      });
    }

    return null;
  };
}

export function interfaceRegex(input: {
  field: string;
  value: string;
  pattern: RegExp;
  message: string;
}): InterfaceEventValidator {
  return () =>
    input.pattern.test(input.value)
      ? null
      : createInterfaceValidationIssue({
          field: input.field,
          code: 'pattern_mismatch',
          message: input.message,
        });
}

export function interfacePredicate(input: {
  field: string;
  code?: string;
  message: string;
  predicate: () => boolean;
}): InterfaceEventValidator {
  return () =>
    input.predicate()
      ? null
      : createInterfaceValidationIssue({
          field: input.field,
          code: input.code ?? 'predicate_failed',
          message: input.message,
        });
}

export function validateInterfaceEvent(
  validators: readonly InterfaceEventValidator[] = []
): InterfaceEventValidationResult {
  const issues = validators
    .map((validator) => validator())
    .filter((issue): issue is InterfaceEventValidationIssue => issue !== null);

  return {
    status: issues.length === 0 ? 'valid' : 'invalid',
    issues,
  };
}
