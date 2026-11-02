import { AppError } from './errors.ts';

type FieldIssue = { field: string; message: string };

export function validationError(details: FieldIssue[]): AppError {
    return new AppError(400, {
        message: 'Input values are invalid',
        code: 'VALIDATION_ERROR',
        context: { public: details },
    });
}

export function fieldError(field: string, message: string): AppError {
    return validationError([{ field, message }]);
}
