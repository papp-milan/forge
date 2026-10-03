const API = import.meta.env.VITE_API_URL ?? ''

const DEFAULT_TIMEOUT_MS = 15_000

export class ApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS)
  const signal = options.signal ?? controller.signal

  try {
    const response = await fetch(`${API}${path}`, {
      ...options,
      signal,
      headers: { 'Content-Type': 'application/json', ...(options.headers ?? {}) },
    })

    if (!response.ok) {
      const message = await response.text()
      throw new ApiError(message || `Request failed: ${response.status}`, response.status)
    }

    if (response.status === 204) return undefined as T
    return response.json() as Promise<T>
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('Request timed out or was cancelled.')
    }
    throw error
  } finally {
    window.clearTimeout(timeout)
  }
}
