// Utilidades compartidas para el registro de jornada:
// fechas y horas en hora local, roles y el historial de cambios.
import { db, auth } from "./firebase-config.js";
import {
  collection, addDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const pad = n => String(n).padStart(2, "0");

// "2026-10-15" en hora local (no UTC, para que no cambie de día de madrugada)
export function fechaLocal(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function horaLocal(d = new Date()) {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ayer() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return fechaLocal(d);
}

export function fechaBonita(fecha) {
  if (!fecha) return "";
  const [y, m, d] = fecha.split("-");
  return `${d}/${m}/${y}`;
}

// Roles: admin (todo), oficina (fichajes, correcciones, exportar, directorio), encargado (sus obras)
export function esAdmin(perfil) { return perfil && perfil.rol === "admin"; }
export function esOficina(perfil) { return perfil && perfil.rol === "oficina"; }
export function puedeGestionarFichajes(perfil) { return esAdmin(perfil) || esOficina(perfil); }
export function veTodasLasObras(perfil) { return esAdmin(perfil) || esOficina(perfil); }

export function nombreRol(rol) {
  return { admin: "Administrador", oficina: "Oficina", encargado: "Encargado" }[rol] || rol;
}

// Copia limpia de un fichaje para guardarla en el historial (sin undefined ni id)
export function copiaFichaje(f) {
  if (!f) return null;
  const copia = {};
  ["obraId", "empleadoId", "empleadoNombre", "fecha", "horaEntrada", "horaSalida", "origen", "fichadoPorNombre"]
    .forEach(k => { if (f[k] !== undefined && f[k] !== null) copia[k] = f[k]; });
  return copia;
}

// Deja constancia de cada alta manual, corrección o borrado de un fichaje.
// La colección historialFichajes no se puede editar ni borrar (ver firestore.rules).
export async function registrarHistorial({ accion, obraId, empleadoId, empleadoNombre, fecha, antes, despues, motivo, perfil }) {
  try {
    await addDoc(collection(db, "historialFichajes"), {
      accion,                       // "alta manual" | "corrección" | "borrado" | "cambio de obra"
      obraId: obraId || "",
      empleadoId: empleadoId || "",
      empleadoNombre: empleadoNombre || "",
      fecha: fecha || "",
      antes: copiaFichaje(antes),
      despues: copiaFichaje(despues),
      motivo: motivo || "",
      usuarioUid: auth.currentUser ? auth.currentUser.uid : "",
      usuarioNombre: (perfil && perfil.nombre) || "",
      momento: serverTimestamp(),
      momentoLocal: `${fechaLocal()} ${horaLocal()}`
    });
  } catch (err) {
    console.error("No se pudo guardar el historial", err);
  }
}

// Evita que un nombre con comillas o < > rompa el HTML
export function esc(txt) {
  return String(txt ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
