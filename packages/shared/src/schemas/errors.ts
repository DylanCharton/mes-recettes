export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'DUPLICATE_RECIPE'
  | 'TAG_EXISTS'
  | 'PAYLOAD_TOO_LARGE'
  | 'UNSUPPORTED_MEDIA_TYPE'
  | 'UNSUPPORTED_URL'
  | 'PARSE_FAILED'
  | 'RATE_LIMITED'
  | 'SOURCE_UNREACHABLE'
  | 'SOURCE_TIMEOUT'
  | 'INTERNAL_ERROR';

export type ApiErrorBody = {
  error: { code: ErrorCode; message: string; details?: unknown };
};
