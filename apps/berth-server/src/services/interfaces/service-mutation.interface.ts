export type ServiceMutationResult<T> =
  | { status: 'saved'; value: T }
  | { status: 'capacity' }
  | { status: 'storage' }
  | { status: 'not-found' };
