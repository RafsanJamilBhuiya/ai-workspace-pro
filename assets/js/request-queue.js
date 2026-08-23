/* AI Workspace Pro — bounded client request queue / rate limiter */
const DEFAULTS = Object.freeze({ concurrency: 3, minIntervalMs: 150, maxRetries: 3, baseDelayMs: 400, maxDelayMs: 8000 });

export class RequestQueue {
  constructor(options = {}) {
    this.options = { ...DEFAULTS, ...options };
    this.pending = [];
    this.active = 0;
    this.lastStartedAt = 0;
  }

  add(task, options = {}) {
    if (typeof task !== 'function') return Promise.reject(new TypeError('task must be a function'));
    return new Promise((resolve, reject) => {
      this.pending.push({ task, resolve, reject, retries: options.retries ?? this.options.maxRetries, retryable: options.retryable ?? true });
      this.#drain();
    });
  }

  async #drain() {
    while (this.active < this.options.concurrency && this.pending.length) {
      const item = this.pending.shift();
      this.active += 1;
      const wait = Math.max(0, this.options.minIntervalMs - (Date.now() - this.lastStartedAt));
      if (wait) await new Promise(r => setTimeout(r, wait));
      this.lastStartedAt = Date.now();
      this.#run(item).finally(() => { this.active -= 1; this.#drain(); });
    }
  }

  async #run(item) {
    try {
      item.resolve(await item.task());
    } catch (error) {
      const status = Number(error?.status || error?.response?.status || 0);
      const retryableStatus = status === 408 || status === 425 || status === 429 || status >= 500;
      if (item.retryable && item.retries > 0 && (retryableStatus || !status)) {
        item.retries -= 1;
        const attempt = this.options.maxRetries - item.retries;
        const delay = Math.min(this.options.maxDelayMs, this.options.baseDelayMs * 2 ** (attempt - 1)) + Math.floor(Math.random() * 250);
        await new Promise(r => setTimeout(r, delay));
        this.pending.unshift(item);
        return;
      }
      item.reject(error);
    }
  }
}

export const apiRequestQueue = new RequestQueue();

export async function queuedFetch(input, init = {}, options = {}) {
  return apiRequestQueue.add(async () => {
    const response = await fetch(input, { ...init, credentials: init.credentials ?? 'omit' });
    if (!response.ok) {
      const error = new Error(`Request failed (${response.status})`);
      error.status = response.status;
      throw error;
    }
    return response;
  }, options);
}
