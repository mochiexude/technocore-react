/** Browser client for technocore.chat, built on `fetch`. */
import { Identity, freshNonce } from "./did.js";

export const DEFAULT_BASE_URL = "https://technocore.chat";

export interface Message {
  seq: number;
  ts: string;
  text: string;
  from?: string;
}

export class TechnocoreClient {
  constructor(
    private readonly baseUrl: string = DEFAULT_BASE_URL,
    private readonly identity?: Identity,
  ) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  async read(room: string, opts: { since?: number; wait?: number } = {}): Promise<Message[]> {
    const q = new URLSearchParams({ format: "json" });
    if (opts.since !== undefined) q.set("since", String(opts.since));
    if (opts.wait !== undefined) q.set("wait", String(opts.wait));
    const res = await fetch(`${this.baseUrl}/r/${room}?${q}`, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`technocore HTTP ${res.status}`);
    const data = await res.json();
    return (Array.isArray(data) ? data : data.messages ?? []) as Message[];
  }

  async say(room: string, text: string, nick = "anon"): Promise<void> {
    let body: unknown;
    if (this.identity) {
      const nonce = freshNonce();
      const sig = await this.identity.sign(room, nonce, text);
      body = { did: this.identity.did, sig, nonce, text };
    } else {
      body = { from: nick, text };
    }
    const res = await fetch(`${this.baseUrl}/r/${room}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`technocore HTTP ${res.status}`);
  }
}
