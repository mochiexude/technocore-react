/**
 * Browser-friendly Ed25519 `did:key` identities using @noble/ed25519.
 *
 *   did = "did:key:z" + base58btc(0xED01 || rawPublicKey32)
 *
 * Signing is async (it uses the platform SHA-512), which suits React data flows.
 */
import * as ed from "@noble/ed25519";
import { base58Encode, base58Decode } from "./base58.js";

const MULTICODEC_ED25519 = Uint8Array.from([0xed, 0x01]);
const enc = new TextEncoder();

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}
function bytesToHex(b: Uint8Array): string {
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}
function b64url(b: Uint8Array): string {
  let s = "";
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlDecode(s: string): Uint8Array {
  const b = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
}

export function encodeDid(publicKey: Uint8Array): string {
  const buf = new Uint8Array(2 + publicKey.length);
  buf.set(MULTICODEC_ED25519);
  buf.set(publicKey, 2);
  return "did:key:z" + base58Encode(buf);
}

export function decodeDid(did: string): Uint8Array {
  if (!did.startsWith("did:key:z")) throw new Error("not a did:key identifier");
  const decoded = base58Decode(did.slice("did:key:z".length));
  if (decoded[0] !== 0xed || decoded[1] !== 0x01) throw new Error("did:key is not Ed25519");
  return decoded.slice(2);
}

let nonceCounter = 0;
export function freshNonce(): string {
  return (BigInt(Date.now()) * 1_000_000n + BigInt(nonceCounter++ % 1_000_000)).toString();
}

export interface Identity {
  did: string;
  seedHex: string;
  sign(room: string, nonce: string, text: string): Promise<string>;
}

async function fromSeed(seed: Uint8Array): Promise<Identity> {
  const pub = await ed.getPublicKeyAsync(seed);
  return {
    did: encodeDid(pub),
    seedHex: bytesToHex(seed),
    async sign(room, nonce, text) {
      return b64url(await ed.signAsync(enc.encode(`${room}|${nonce}|${text}`), seed));
    },
  };
}

export async function generateIdentity(): Promise<Identity> {
  return fromSeed(ed.utils.randomPrivateKey());
}

export async function identityFromSeed(seedHex: string): Promise<Identity> {
  return fromSeed(hexToBytes(seedHex));
}

export async function verify(did: string, room: string, nonce: string, text: string, sig: string): Promise<boolean> {
  try {
    return await ed.verifyAsync(b64urlDecode(sig), enc.encode(`${room}|${nonce}|${text}`), decodeDid(did));
  } catch {
    return false;
  }
}
