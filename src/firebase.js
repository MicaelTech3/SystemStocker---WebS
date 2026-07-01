/**
 * firebase.js — Instância centralizada do Firebase
 * Todas as credenciais vêm do arquivo .env (variáveis VITE_*)
 */

import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import {
  getFirestore,
  enableIndexedDbPersistence
} from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId:     import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

// Inicializa uma única instância do app
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db   = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

// Habilita cache local offline (IndexedDB) para respostas instantâneas
// enquanto a sincronização com o servidor acontece em background
enableIndexedDbPersistence(db).catch((err) => {
  if (err.code === "failed-precondition") {
    // Múltiplas abas abertas — persistence só funciona em uma por vez
    console.warn("Firebase persistence desativada: múltiplas abas abertas.");
  } else if (err.code === "unimplemented") {
    // Navegador não suporta
    console.warn("Firebase persistence não suportada neste navegador.");
  }
});

// Analytics (opcional — não bloqueia nada)
try {
  getAnalytics(app);
} catch (e) {
  // Ignora se analytics não estiver disponível
}

export default app;
