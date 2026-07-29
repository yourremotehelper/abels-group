// Rellena esto con la config de TU proyecto Firebase.
// Firebase Console > Configuración del proyecto > Tus apps > Config del SDK
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

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
export const db = getFirestore(app);
export { firebaseConfig };
