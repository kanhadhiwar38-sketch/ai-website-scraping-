/**
 * Client-side Firebase init. Safe to bundle into the browser: Firebase's
 * client "config" is a public app identifier, not a secret. Do NOT add the
 * admin SDK or any server-only secret to this file — see admin.ts, which is
 * import-guarded against browser bundling.
 */
import { type FirebaseApp, getApps, initializeApp } from "firebase/app";
import { type Auth, getAuth } from "firebase/auth";
import { type Firestore, getFirestore } from "firebase/firestore";
import { type FirebaseStorage, getStorage } from "firebase/storage";

export interface FirebaseClientConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

export function loadFirebaseClientConfigFromEnv(): FirebaseClientConfig {
  const config: FirebaseClientConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "",
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "",
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "",
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "",
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "",
  };

  const missing = Object.entries(config).filter(([, value]) => !value);
  if (missing.length > 0) {
    // eslint-disable-next-line no-console
    console.warn(
      `[firebase/client] Missing config values: ${missing.map(([key]) => key).join(", ")}. ` +
        "Set NEXT_PUBLIC_FIREBASE_* env vars — see .env.example.",
    );
  }

  return config;
}

let app: FirebaseApp | undefined;

export function getFirebaseClientApp(config?: FirebaseClientConfig): FirebaseApp {
  if (getApps().length > 0) {
    app = getApps()[0];
    return app as FirebaseApp;
  }
  app = initializeApp(config ?? loadFirebaseClientConfigFromEnv());
  return app;
}

export function getFirebaseAuth(config?: FirebaseClientConfig): Auth {
  return getAuth(getFirebaseClientApp(config));
}

export function getFirebaseFirestore(config?: FirebaseClientConfig): Firestore {
  return getFirestore(getFirebaseClientApp(config));
}

export function getFirebaseStorageClient(config?: FirebaseClientConfig): FirebaseStorage {
  return getStorage(getFirebaseClientApp(config));
}
