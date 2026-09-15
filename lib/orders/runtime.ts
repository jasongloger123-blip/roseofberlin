import { AsyncLocalStorage } from "node:async_hooks";

export interface Statement {
  bind(...values: unknown[]): Statement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[]; meta: { changes: number } }>;
  run(): Promise<{ meta: { changes: number } }>;
}
export interface Database {
  prepare(sql: string): Statement;
  batch(statements: Statement[]): Promise<unknown[]>;
}
export interface OrderEnvironment {
  DB?: Database;
  RESEND_API_KEY?: string;
  ORDER_FROM_EMAIL?: string;
  ORDER_NOTIFICATION_EMAIL?: string;
  PUBLIC_BASE_URL?: string;
  BANK_ACCOUNT_NAME?: string;
  BANK_IBAN?: string;
  BANK_BIC?: string;
  PAYPAL_ADDRESS?: string;
  ORDER_ADMIN_EMAILS?: string;
}
const context = new AsyncLocalStorage<{ env: OrderEnvironment; trustedSites: boolean }>();
export function withOrderEnvironment<T>(env: OrderEnvironment, trustedSites: boolean, run: () => T): T {
  return context.run({ env, trustedSites }, run);
}
export function orderEnvironment(): OrderEnvironment {
  return context.getStore()?.env ?? process.env as OrderEnvironment;
}
export function hasTrustedSitesIdentity(): boolean {
  return context.getStore()?.trustedSites === true;
}
export function orderDatabase(): Database {
  const db = orderEnvironment().DB;
  if (!db) throw new Error("ORDER_DATABASE_UNAVAILABLE");
  return db;
}
export function publicBaseUrl(): string {
  const value = orderEnvironment().PUBLIC_BASE_URL;
  if (!value) throw new Error("PUBLIC_BASE_URL_MISSING");
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash || url.pathname !== "/") {
    throw new Error("PUBLIC_BASE_URL_INVALID");
  }
  return url.origin;
}
