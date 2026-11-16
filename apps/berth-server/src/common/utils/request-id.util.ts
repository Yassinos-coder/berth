const SAFE_REQUEST_ID = /^[A-Za-z0-9._-]{8,64}$/;

export class RequestIdUtil {
  static resolve(
    incoming: string | string[] | undefined,
    generate: () => string,
  ): string {
    const candidate = Array.isArray(incoming) ? incoming[0] : incoming;
    if (candidate && SAFE_REQUEST_ID.test(candidate)) return candidate;
    return generate();
  }
}
