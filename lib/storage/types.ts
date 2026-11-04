/** Any file storage backend. Code only ever talks to this interface. */
export interface Storage {
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  delete(key: string): Promise<void>;
}
