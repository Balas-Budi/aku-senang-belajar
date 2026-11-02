type AppErrorContext = { public?: unknown; private?: unknown };

type AppErrorInfo = {
    message: string;
    code: string;
    context?: AppErrorContext;
    catastrophic?: boolean;
};

export class AppError extends Error {
    readonly statusCode: number;
    readonly code: string;
    readonly context?: AppErrorContext;
    readonly catastrophic: boolean;

    constructor(statusCode: number, info: AppErrorInfo) {
        super(info.message);

        this.name = this.constructor.name;
        this.statusCode = statusCode;
        this.code = info.code;
        this.context = info.context;
        this.catastrophic = info.catastrophic ?? false;
    }
}

export class AssertionError extends AppError {
    constructor(detail: string) {
        super(500, {
            message: 'Invariant violated',
            code: 'ASSERTION_ERROR',
            context: { private: detail },
            catastrophic: true,
        });
    }
}
