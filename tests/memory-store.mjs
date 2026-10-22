export class MemoryStore {
  entries = new Map();
  async set(key, data, options = {}) {
    if(options.onlyIfNew && this.entries.has(key)) return {modified:false};
    this.entries.set(key,{data,metadata:options.metadata || {}}); return {modified:true};
  }
  async setJSON(key,data,options) { return this.set(key,structuredClone(data),options); }
  async get(key) { return this.entries.get(key)?.data ?? null; }
  async list({prefix=''}={}) { return {blobs:[...this.entries.keys()].filter(key=>key.startsWith(prefix)).map(key=>({key}))}; }
  async getMetadata(key) { const entry=this.entries.get(key); return entry ? {metadata:entry.metadata} : null; }
  async getWithMetadata(key) { return this.entries.get(key) ?? null; }
}
