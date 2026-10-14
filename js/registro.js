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
  ["obraId", "empleadoId", "empleadoNombre", "fecha", "horaEntrada", "horaSalida", "origen", "fichadoPorNombre", "vehiculoNombre"]
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

// Foto del trabajador (o sus iniciales si no tiene) en un círculo
export function avatar(emp, size = 40) {
  const st = `width:${size}px;height:${size}px;border-radius:50%;flex-shrink:0;`;
  if (emp && emp.foto) {
    return `<img src="${emp.foto}" alt="" style="${st}object-fit:cover;background:var(--border);">`;
  }
  const ini = String((emp && emp.nombre) || "?").trim().split(/\s+/).slice(0, 2).map(p => p[0] || "").join("").toUpperCase();
  return `<span style="${st}display:inline-flex;align-items:center;justify-content:center;background:var(--accent-bg);color:var(--accent-dark);font-weight:600;font-size:${Math.round(size * 0.38)}px;">${esc(ini)}</span>`;
}

// Reduce una foto del móvil a un cuadrado pequeño (unos 15-30 KB) para guardarla
// directamente en la ficha del empleado, sin necesidad de Firebase Storage.
export function comprimirFoto(file, lado = 240, calidad = 0.75) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const m = Math.min(img.width, img.height);
      const canvas = document.createElement("canvas");
      canvas.width = lado; canvas.height = lado;
      canvas.getContext("2d").drawImage(img, (img.width - m) / 2, (img.height - m) / 2, m, m, 0, 0, lado, lado);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", calidad));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("No se ha podido leer la imagen")); };
    img.src = url;
  });
}

// Texto corto del carnet: "B", "B, C" o ""
export function textoCarnet(emp) {
  if (!emp || !emp.carnet) return "";
  return emp.carnetTipo ? emp.carnetTipo : "Sí";
}
