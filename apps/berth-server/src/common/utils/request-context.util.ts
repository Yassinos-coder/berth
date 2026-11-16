import { AsyncLocalStorage } from 'node:async_hooks';

interface RequestContextStore {
  requestId: string;
}

const storage = new AsyncLocalStorage<RequestContextStore>();

export class RequestContext {
  static run<T>(requestId: string, callback: () => T): T {
    return storage.run({ requestId }, callback);
  }

  static requestId(): string | undefined {
    return storage.getStore()?.requestId;
  }
}
