/**
 * Server-only Firebase Admin init. Used by apps/api and apps/browser-worker.
 * NEVER import this from apps/web client components — it requires the
 * service-account private key, which must never reach the browser.
 *
 * The guard below is a deliberate belt-and-suspenders check: Next.js's own
 * bundler already prevents server-only modules from being imported into
 * client components when used correctly, but this throws loudly at runtime
 * too in case that boundary is ever crossed by mistake (e.g. a shared
 * "index.ts" barrel file that re-exports both client and admin).
 */
import { type App, cert, getApps, initializeApp } from "firebase-admin/app";
import { type Auth, getAuth } from "firebase-admin/auth";
import { type Firestore, getFirestore } from "firebase-admin/firestore";
import { type Storage, getStorage } from "firebase-admin/storage";

if (typeof (globalThis as { window?: unknown }).window !== "undefined") {
  throw new Error(
    "@webrecon/firebase/admin was imported into a browser bundle. " +
      "This module requires server-only credentials and must never run in the browser.",
  );
}

export interface FirebaseAdminConfig {
  projectId: string;
  clientEmail: string;
  privateKey: string;
  storageBucket: string;
}

export function loadFirebaseAdminConfigFromEnv(): FirebaseAdminConfig {
  const projectId = process.env.FIREBASE_PROJECT_ID ?? "";
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL ?? "";
  // Service-account keys are stored in env with literal \n sequences; unescape them.
  const privateKey = (process.env.FIREBASE_PRIVATE_KEY ?? "").replace(/\\n/g, "\n");
  const storageBucket = process.env.FIREBASE_STORAGE_BUCKET ?? "";

  const missing = [
    ["FIREBASE_PROJECT_ID", projectId],
    ["FIREBASE_CLIENT_EMAIL", clientEmail],
    ["FIREBASE_PRIVATE_KEY", privateKey],
    ["FIREBASE_STORAGE_BUCKET", storageBucket],
  ].filter(([, value]) => !value);

  if (missing.length > 0) {
    throw new Error(
      `Missing Firebase Admin env vars: ${missing.map(([key]) => key).join(", ")}. ` +
        "See .env.example.",
    );
  }

  return { projectId, clientEmail, privateKey, storageBucket };
}

let adminApp: App | undefined;

export function getFirebaseAdminApp(config?: FirebaseAdminConfig): App {
  if (getApps().length > 0) {
    adminApp = getApps()[0];
    return adminApp as App;
  }
  const resolved = config ?? loadFirebaseAdminConfigFromEnv();
  adminApp = initializeApp({
    credential: cert({
      projectId: resolved.projectId,
      clientEmail: resolved.clientEmail,
      privateKey: resolved.privateKey,
    }),
    storageBucket: resolved.storageBucket,
  });
  return adminApp;
}

export function getFirebaseAdminAuth(config?: FirebaseAdminConfig): Auth {
  return getAuth(getFirebaseAdminApp(config));
}

export function getFirebaseAdminFirestore(config?: FirebaseAdminConfig): Firestore {
  return getFirestore(getFirebaseAdminApp(config));
}

export function getFirebaseAdminStorage(config?: FirebaseAdminConfig): Storage {
  return getStorage(getFirebaseAdminApp(config));
}

/** Verifies a client ID token and returns the decoded token (uid, claims, etc.). */
export async function verifyIdToken(idToken: string, config?: FirebaseAdminConfig) {
  return getFirebaseAdminAuth(config).verifyIdToken(idToken);
}
