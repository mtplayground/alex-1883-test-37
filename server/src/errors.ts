import type { ErrorRequestHandler, RequestHandler } from 'express';

type ErrorWithStatus = Error & {
  status?: number;
  statusCode?: number;
};

function readErrorStatus(error: unknown): number | undefined {
  if (!(error instanceof Error)) {
    return undefined;
  }

  const { status, statusCode } = error as ErrorWithStatus;
  const candidate = status ?? statusCode;

  return Number.isInteger(candidate) ? candidate : undefined;
}

function isJsonParseError(error: unknown): boolean {
  return error instanceof SyntaxError && readErrorStatus(error) === 400;
}

export function logError(context: string, error: unknown): void {
  if (error instanceof Error) {
    console.error(context, {
      code: 'code' in error ? error.code : undefined,
      message: error.message,
      name: error.name,
      stack: error.stack,
    });
    return;
  }

  console.error(context, error);
}

export const notFoundHandler: RequestHandler = (request, response) => {
  response.status(404).json({
    error: 'route_not_found',
    message: `No route found for ${request.method} ${request.path}.`,
  });
};

export const errorHandler: ErrorRequestHandler = (error, request, response, next) => {
  logError('Unhandled request error', error);
  console.error('Unhandled request context', {
    method: request.method,
    path: request.path,
  });

  if (response.headersSent) {
    next(error);
    return;
  }

  if (isJsonParseError(error)) {
    response.status(400).json({
      error: 'invalid_json',
      message: 'Request body must be valid JSON.',
    });
    return;
  }

  response.status(500).json({
    error: 'internal_server_error',
    message: 'Unexpected server error.',
  });
};
