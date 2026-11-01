// Google sign-in and cloud saves (Firebase Auth + Firestore). The Firebase SDK is loaded on demand,
// so guests and the first paint don't pay for it.

import type { FirebaseApp } from 'firebase/app';
import type { Auth, User } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';

/** Firestore collection for saves (named per game, so several games can share one Firebase project). */
const SAVES = 'pokegacha_saves';

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
};

export const firebaseEnabled = !!(config.apiKey && config.authDomain && config.projectId);

interface Sdk {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
  authLib: typeof import('firebase/auth');
  storeLib: typeof import('firebase/firestore');
}

let sdk: Promise<Sdk | null> | null = null;

function init(): Promise<Sdk | null> {
  if (!firebaseEnabled) return Promise.resolve(null);
  sdk ??= (async () => {
    const [{ initializeApp }, authLib, storeLib] = await Promise.all([
      import('firebase/app'),
      import('firebase/auth'),
      import('firebase/firestore'),
    ]);
    const app = initializeApp(config);
    return { app, auth: authLib.getAuth(app), db: storeLib.getFirestore(app), authLib, storeLib };
  })();
  return sdk;
}

export function watchAuth(cb: (user: User | null) => void) {
  void init().then(s => {
    if (!s) cb(null);
    else s.authLib.onAuthStateChanged(s.auth, cb);
  }, error => {
    console.error('Firebase failed to load', error);
    cb(null);
  });
}

export async function signInWithGoogle() {
  const s = await init();
  if (!s) throw new Error('Google sign-in is not configured.');
  const { GoogleAuthProvider, signInWithPopup, signInWithRedirect } = s.authLib;
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  try {
    await signInWithPopup(s.auth, provider);
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
      await signInWithRedirect(s.auth, provider);
    } else if (code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request') {
      throw e;
    }
  }
}

export async function signOutUser() {
  const s = await init();
  if (s) await s.authLib.signOut(s.auth);
}

/** How long sign-in waits for the cloud save before giving up (a blocked connection would hang much longer). */
const LOAD_TIMEOUT_MS = 12_000;

/** Saves are stored as a JSON string: avoids Firestore limits on nested maps and undefined values. */
export async function loadCloudSave(uid: string): Promise<unknown | null> {
  const s = await init();
  if (!s) return null;
  const { doc, getDoc } = s.storeLib;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(Object.assign(new Error('Cloud save load timed out'), { code: 'deadline-exceeded' })), LOAD_TIMEOUT_MS);
  });
  const snap = await Promise.race([getDoc(doc(s.db, SAVES, uid)), timeout]).finally(() => clearTimeout(timer));
  if (!snap.exists()) return null;
  const data = snap.data() as { json?: string };
  return data.json ? JSON.parse(data.json) : null;
}

export async function writeCloudSave(uid: string, save: { updatedAt: number }) {
  const s = await init();
  if (!s) return;
  const { doc, setDoc, serverTimestamp } = s.storeLib;
  await setDoc(doc(s.db, SAVES, uid), { json: JSON.stringify(save), updatedAt: save.updatedAt, serverTime: serverTimestamp() });
}
