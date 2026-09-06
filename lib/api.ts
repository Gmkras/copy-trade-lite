import "server-only";

import { ZodError, type ZodType, type ZodTypeDef } from "zod";

import { TradeError } from "@/lib/decibel";
import type { ApiFail, ApiOk } from "@/lib/schemas";

/**
 * Route Handler wrapper: one envelope, readable errors, nothing leaks.
 *
 *  - ZodError        → 422 INVALID_INPUT (first issue, plain language)
 *  - TradeError      → 422 <code> with its message
 *  - malformed JSON  → 400 BAD_JSON
 *  - anything else   → 502 UPSTREAM with a safe message; the cause is logged server-side
 */

/** Thrown by handlers when the requested resource does not exist → 404. */
export class NotFoundError extends Error {
  readonly code = "NOT_FOUND";

  constructor(message = "Not found.") {
    super(message);
    this.name = "NotFoundError";
  }
}

type RouteContext = { params?: Promise<Record<string, string>> | Record<string, string> };

export type HandlerArgs<TBody> = {
  body: TBody;
  params: Record<string, string>;
  request: Request;
};

export type ApiHandlerOptions<TBody, TOut> = {
  /** When set, the JSON body is parsed with it before `run` is called. Input may differ from output (coercions). */
  schema?: ZodType<TBody, ZodTypeDef, unknown>;
  run: (args: HandlerArgs<TBody>) => Promise<TOut>;
};

export function apiHandler<TOut, TBody = undefined>(options: ApiHandlerOptions<TBody, TOut>) {
  return async (request: Request, context?: RouteContext): Promise<Response> => {
    try {
      const params = (await context?.params) ?? {};
      let body = undefined as TBody;
      if (options.schema) {
        let raw: unknown;
        try {
          raw = await request.json();
        } catch {
          return fail(400, "BAD_JSON", "The request body must be valid JSON.");
        }
        body = options.schema.parse(raw);
      }
      const data = await options.run({ body, params, request });
      return ok(data);
    } catch (error) {
      return errorResponse(error);
    }
  };
}

export function ok<T>(data: T): Response {
  const payload: ApiOk<T> = { ok: true, data };
  return Response.json(payload);
}

export function fail(status: number, code: string, message: string): Response {
  const payload: ApiFail = { ok: false, code, message };
  return Response.json(payload, { status });
}

export function errorResponse(error: unknown): Response {
  if (error instanceof ZodError) {
    return fail(422, "INVALID_INPUT", zodMessage(error));
  }
  if (error instanceof TradeError) {
    return fail(422, error.code, error.message);
  }
  if (error instanceof NotFoundError) {
    return fail(404, error.code, error.message);
  }
  // Unknown: never echo internals (URLs, keys, stacks) to the client.
  console.error("[api] unexpected error:", error);
  return fail(502, "UPSTREAM", "Could not reach the exchange. Try again in a moment.");
}

function zodMessage(error: ZodError): string {
  const issue = error.issues[0];
  if (!issue) return "Invalid input.";
  if (issue.code === "unrecognized_keys") {
    return `Unexpected field: ${issue.keys.join(", ")}.`;
  }
  const field = issue.path.join(".");
  if (issue.code === "invalid_enum_value" && field === "side") {
    return 'Side must be "up" or "down".';
  }
  if (issue.code === "invalid_type" && issue.received === "undefined") {
    return `Missing field: ${field || "body"}.`;
  }
  return field ? `${field}: ${issue.message}` : issue.message;
}
