export class ApiError extends Error {
  status: number
  details: string[]

  constructor(status: number, message: string, details: string[] = []) {
    super(message)
    this.status = status
    this.details = details
  }
}

/** Normalises both `{ error, details }` and ASP.NET ProblemDetails validation responses. */
export async function toApiError(res: Response): Promise<ApiError> {
  let body: unknown = null
  try {
    body = await res.json()
  } catch {
    /* empty or non-JSON body */
  }

  if (body && typeof body === 'object') {
    const b = body as { error?: string; details?: string[]; title?: string; errors?: Record<string, string[]> }
    if (b.error) return new ApiError(res.status, b.error, b.details ?? [])
    if (b.errors) return new ApiError(res.status, b.title ?? 'Validation failed.', Object.values(b.errors).flat())
    if (b.title) return new ApiError(res.status, b.title)
  }

  const fallback: Record<number, string> = {
    401: 'You are not signed in.',
    403: 'You do not have permission to do that.',
    404: 'Not found.',
  }
  return new ApiError(res.status, fallback[res.status] ?? `Request failed (${res.status}).`)
}

export async function readJson<T>(res: Response): Promise<T> {
  if (!res.ok) throw await toApiError(res)
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return [err.message, ...err.details].join(' ')
  if (err instanceof Error) return err.message
  return 'Something went wrong.'
}
