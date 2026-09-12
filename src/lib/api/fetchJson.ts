interface ErrorPayload {
  readonly error?: { readonly message?: string };
}

/** API レスポンスを JSON として受け取る。エラー時は message 付きで throw する */
export const fetchJson = async <T>(
  input: string,
  init?: RequestInit
): Promise<T> => {
  const response = await fetch(input, {
    cache: 'no-store',
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as ErrorPayload;
    throw new Error(
      payload.error?.message ?? `リクエストが失敗しました（${response.status}）`
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
};
