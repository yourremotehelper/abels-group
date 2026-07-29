import { auth, db } from "./firebase-config.js";
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export function login(email, password) {
  return signInWithEmailAndPassword(auth, email, password);
}

export function logout() {
  sessionStorage.removeItem("obraActual");
  return signOut(auth);
}

// Perfil guardado en Firestore: usuarios/{uid} -> { nombre, rol: "admin"|"encargado", obrasAsignadas: [obraId,...] }
export async function getPerfil(uid) {
  const ref = doc(db, "usuarios", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return snap.data();
}

// Protege una página: si no hay sesión, redirige a index.html.
// Si la hay, ejecuta callback(user, perfil).
export function requireAuth(callback) {
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.href = "index.html";
      return;
    }
    const perfil = await getPerfil(user.uid);
    if (!perfil) {
      alert("Tu usuario no tiene perfil configurado. Contacta con el administrador.");
      await logout();
      window.location.href = "index.html";
      return;
    }
    callback(user, perfil);
  });
}
