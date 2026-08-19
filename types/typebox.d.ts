export const Type: {
  Object(properties: Record<string, unknown>, options?: Record<string, unknown>): unknown;
  String(options?: Record<string, unknown>): unknown;
  Integer(options?: Record<string, unknown>): unknown;
  Boolean(options?: Record<string, unknown>): unknown;
  Optional<T>(schema: T): T;
};
