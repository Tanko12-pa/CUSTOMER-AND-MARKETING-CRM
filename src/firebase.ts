import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  sendPasswordResetEmail,
  updateProfile
} from "firebase/auth";
import { 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager, 
  doc, 
  setDoc, 
  getDoc 
} from "firebase/firestore";
import firebaseConfig from "../firebase-applet-config.json";

const app = initializeApp(firebaseConfig);
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
}, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth();

export enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  GET = "get",
  WRITE = "write",
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error("Firestore Error: ", JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

/**
 * 1. SIGN UP: "Start 7-Day Free Trial"
 */
export async function registerWithTrial(name: string, email: string, password: string) {
  try {
    // Create user in Firebase Auth
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Set display name
    await updateProfile(user, { displayName: name });

    // Calculate 7 days from now
    const trialDuration = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
    const trialExpiresAt = Date.now() + trialDuration;

    // Write metadata to Firestore under the user's explicit UID
    await setDoc(doc(db, "users", user.uid), {
      uid: user.uid,
      name: name,
      email: email,
      trialExpiresAt: trialExpiresAt,
      hasActiveSubscription: false
    });

    return { user, expired: false };
  } catch (error: any) {
    throw new Error(error.message.replace("Firebase: ", ""));
  }
}

/**
 * 2. SIGN IN: Verify credentials and check trial validity
 */
export async function signInAndCheckTrial(email: string, password: string) {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Fetch trial status from Firestore
    const userDoc = await getDoc(doc(db, "users", user.uid));
    
    if (!userDoc.exists()) {
      throw new Error("User profile records missing.");
    }

    const userData = userDoc.data();
    const isExpired = Date.now() > userData.trialExpiresAt;

    return {
      user,
      isExpired: isExpired && !userData.hasActiveSubscription
    };
  } catch (error: any) {
    throw new Error(error.message.replace("Firebase: ", ""));
  }
}

/**
 * 3. EASY PASSWORD CHANGE: Sends a localized recovery email link
 */
export async function resetUserPassword(email: string) {
  try {
    await sendPasswordResetEmail(auth, email);
    return "Password reset link dispatched to your email.";
  } catch (error: any) {
    throw new Error(error.message.replace("Firebase: ", ""));
  }
}
