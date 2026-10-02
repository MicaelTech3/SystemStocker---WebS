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
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDSG7bfNh1oG1NNKS0Bgzjen4AdgF2APss",
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "systemstocker.firebaseapp.com",
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID || "systemstocker",
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "systemstocker.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "934422043959",
  appId:             import.meta.env.VITE_FIREBASE_APP_ID || "1:934422043959:web:7b8dd513e85834dc598eb2",
  measurementId:     import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-BQ5H5ZS815",
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
