/**
 * The Firebase SDK, in one place, behind a dynamic import.
 *
 * Firestore alone is a few hundred kilobytes, and a board that is never
 * shared or collaborated on never touches it. Keeping the SDK in its own
 * module is what lets `./firebase` fetch it on first use instead of pulling
 * it into the editor's entry chunk, where every visitor pays for it.
 *
 * Nothing here does any work at import time — it only re-exports the SDK
 * entry points the app uses, so the chunk is pure code.
 */

export { initializeApp } from "firebase/app";

export {
  getFirestore,
  doc,
  getDoc,
  runTransaction,
  Bytes,
} from "firebase/firestore";

export { getStorage, ref, uploadBytes } from "firebase/storage";
