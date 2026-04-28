abstract class BaseAIError extends Error {
  abstract readonly type: AIErrorType;
}

export enum AIErrorType {
  GeneralNetworkError = 'GeneralNetworkError',
  UsageLimit = 'UsageLimit',
  Unauthorized = 'Unauthorized',
  RequestTimeout = 'RequestTimeout',
}

export class UnauthorizedError extends BaseAIError {
  readonly type = AIErrorType.Unauthorized;

  constructor() {
    super('Unauthorized');
  }
}

// user has used up the quota
export class UsageLimitError extends BaseAIError {
  readonly type = AIErrorType.UsageLimit;

  constructor() {
    super('Usage limit reached');
  }
}

// general 500x error
export class GeneralNetworkError extends BaseAIError {
  readonly type = AIErrorType.GeneralNetworkError;

  constructor(message: string = 'Network error') {
    super(message);
  }
}

// request timeout
export class RequestTimeoutError extends BaseAIError {
  readonly type = AIErrorType.RequestTimeout;

  constructor(message: string = 'Request timeout') {
    super(message);
  }
}

export type AIError =
  | UnauthorizedError
  | UsageLimitError
  | GeneralNetworkError
  | RequestTimeoutError;
