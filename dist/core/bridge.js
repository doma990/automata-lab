export class ModelBridge {
  constructor() {
    this.worker = new Worker(new URL('./model-worker.js', import.meta.url));
    this.pending = new Map();
    this.sequence = 0;
    this.worker.addEventListener('message', ({data}) => {
      const pending = this.pending.get(data.id);
      if (!pending) return;
      this.pending.delete(data.id);
      clearTimeout(pending.timer);
      if (data.ok) pending.resolve(data.result);
      else pending.reject(new Error(data.error));
    });
    this.worker.addEventListener('error', () => {
      for (const pending of this.pending.values()) {
        clearTimeout(pending.timer);
        pending.reject(new Error('The model worker could not start. Open this project through a local web server in a modern browser.'));
      }
      this.pending.clear();
    });
  }
  call(action, payload = {}) {
    const id = ++this.sequence;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error('The model took too long to respond. Try a smaller machine.')); }, 10000);
      this.pending.set(id, {resolve, reject, timer});
      this.worker.postMessage({id, action, payload});
    });
  }
}
