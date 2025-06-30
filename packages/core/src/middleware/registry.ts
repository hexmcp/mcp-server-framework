import type { Middleware, MiddlewareRegistry } from './types.js';

export class McpMiddlewareRegistry implements MiddlewareRegistry {
  private readonly _middleware: Middleware[] = [];

  registerMiddleware(middleware: Middleware): void {
    if (typeof middleware !== 'function') {
      throw new TypeError('Middleware must be a function');
    }

    this._middleware.push(middleware);
  }

  getMiddlewareStack(): Middleware[] {
    return [...this._middleware];
  }

  clear(): void {
    this._middleware.length = 0;
  }

  size(): number {
    return this._middleware.length;
  }

  isEmpty(): boolean {
    return this._middleware.length === 0;
  }

  getMiddlewareAt(index: number): Middleware | undefined {
    return this._middleware[index];
  }

  removeMiddleware(middleware: Middleware): boolean {
    const index = this._middleware.indexOf(middleware);
    if (index === -1) {
      return false;
    }

    this._middleware.splice(index, 1);
    return true;
  }

  removeMiddlewareAt(index: number): Middleware | undefined {
    if (index < 0 || index >= this._middleware.length) {
      return undefined;
    }

    return this._middleware.splice(index, 1)[0];
  }

  insertMiddleware(middleware: Middleware, index: number): void {
    if (typeof middleware !== 'function') {
      throw new TypeError('Middleware must be a function');
    }

    if (index < 0 || index > this._middleware.length) {
      throw new RangeError(`Index ${index} is out of bounds for middleware stack of size ${this._middleware.length}`);
    }

    this._middleware.splice(index, 0, middleware);
  }

  replaceMiddleware(oldMiddleware: Middleware, newMiddleware: Middleware): boolean {
    const index = this._middleware.indexOf(oldMiddleware);
    if (index === -1) {
      return false;
    }

    if (typeof newMiddleware !== 'function') {
      throw new TypeError('New middleware must be a function');
    }

    this._middleware[index] = newMiddleware;
    return true;
  }

  hasMiddleware(middleware: Middleware): boolean {
    return this._middleware.includes(middleware);
  }

  getMiddlewareNames(): string[] {
    return this._middleware.map((mw, index) => mw.name || `middleware-${index}`);
  }

  clone(): McpMiddlewareRegistry {
    const cloned = new McpMiddlewareRegistry();
    cloned._middleware.push(...this._middleware);
    return cloned;
  }

  toArray(): Middleware[] {
    return this.getMiddlewareStack();
  }

  [Symbol.iterator](): Iterator<Middleware> {
    return this._middleware[Symbol.iterator]();
  }
}
