export interface CaDownloadResponse {
  status: number;
  contentType: string;
  body: string;
}

export class CaDownloadValidator {
  static respond(
    method: string | undefined,
    url: string | undefined,
    caPem: string,
  ): CaDownloadResponse {
    const path = (url ?? '').split('?')[0];
    if (path !== '/ca.pem') {
      return { status: 404, contentType: 'text/plain', body: 'not found' };
    }
    if (method !== 'GET' && method !== 'HEAD') {
      return { status: 405, contentType: 'text/plain', body: 'method not allowed' };
    }
    return { status: 200, contentType: 'application/x-pem-file', body: caPem };
  }
}
