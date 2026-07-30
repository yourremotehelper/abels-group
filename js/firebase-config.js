// Rellena esto con la config de TU proyecto Firebase.
// Firebase Console > Configuración del proyecto > Tus apps > Config del SDK
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, setPersistence, browserSessionPersistence } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentSingleTabManager
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDzthbZfAc5P6UQPpqqoYjnq_HYN4Vqimw",
  authDomain: "abels-group.firebaseapp.com",
  projectId: "abels-group",
  storageBucket: "abels-group.firebasestorage.app",
  messagingSenderId: "385336229235",
  appId: "1:385336229235:web:8b8846de205630b5efd906"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Persistencia offline: si no hay cobertura en la obra, los fichajes y
// demás cambios se guardan en el móvil y se sincronizan solos al volver la conexión.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentSingleTabManager() })
});

export { firebaseConfig };
