// Utilidades compartidas para el registro de jornada:
// fechas y horas en hora local, roles y el historial de cambios.
import { db, auth } from "./firebase-config.js";
import {
  collection, addDoc, serverTimestamp, doc as _doc, getDoc as _getDoc,
  getDocs as _getDocs, query as _query, where as _where
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
  ["obraId", "empleadoId", "empleadoNombre", "fecha", "horaEntrada", "horaSalida", "origen", "fichadoPorNombre", "vehiculoNombre", "horasExtra"]
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

// ---------- Jornada, horas extra y ausencias ----------
// Valores provisionales hasta que se configure la jornada en "Jornada y horas extra"
export const CONFIG_POR_DEFECTO = {
  horaEntrada: "08:00",
  horaSalida: "17:00",
  descansoMin: 0,          // minutos de comida/descanso que no cuentan como trabajo
  horasLunesJueves: 8,
  horasViernes: 8,
  topeAnualExtras: 80,
  avisoExtras: 70,
  configurada: false
};

export async function cargarConfig() {
  try {
    const snap = await _getDoc(_doc(db, "config", "jornada"));
    return { ...CONFIG_POR_DEFECTO, ...(snap.exists() ? snap.data() : {}) };
  } catch {
    return { ...CONFIG_POR_DEFECTO };
  }
}

const aMin = h => { if (!h) return null; const [a, b] = h.split(":").map(Number); return a * 60 + b; };

// Horas de jornada que tocan ese día (0 sábados y domingos)
export function horasDelDia(fecha, cfg) {
  const dia = new Date(fecha + "T12:00:00").getDay();
  if (dia === 0 || dia === 6) return 0;
  return dia === 5 ? Number(cfg.horasViernes) : Number(cfg.horasLunesJueves);
}

// Horas trabajadas = de entrada a salida, menos el descanso si la jornada pasa de 6 horas
export function horasTrabajadas(entrada, salida, cfg) {
  const e = aMin(entrada), s = aMin(salida);
  if (e === null || s === null || s <= e) return 0;
  let min = s - e;
  if (min > 360) min -= Number(cfg.descansoMin) || 0;
  return Math.max(0, Math.round(min / 6) / 10);   // redondeo a 0,1 h
}

// Propuesta de horas extra: lo que pasa de la jornada del día (editable siempre)
export function extraSugerida(fecha, entrada, salida, cfg) {
  const t = horasTrabajadas(entrada, salida, cfg);
  return Math.max(0, Math.round((t - horasDelDia(fecha, cfg)) * 10) / 10);
}

export const TIPOS_AUSENCIA = {
  vacaciones: "Vacaciones",
  baja: "Baja",
  asuntos: "Asuntos propios",
  permiso: "Permiso (médico, familiar...)",
  injustificada: "Falta sin justificar"
};
export const AUSENCIA_JUSTIFICADA = t => t !== "injustificada";

export async function cargarAusenciasDelDia(fecha) {
  // Ausencias que empiezan antes o el mismo día; se filtran las que ya terminaron
  const snap = await _getDocs(_query(collection(db, "ausencias"), _where("desde", "<=", fecha)));
  const mapa = {};
  snap.forEach(d => {
    const a = { id: d.id, ...d.data() };
    if ((a.hasta || a.desde) >= fecha) mapa[a.empleadoId] = a;
  });
  return mapa;
}

export function textoHoras(n) {
  return (Math.round((Number(n) || 0) * 10) / 10).toLocaleString("es-ES") + " h";
}

// ---------- Nombre real, día vencido e importes ----------
// Nombre para documentos (recibís, exportaciones): el real si está puesto; si no, el habitual
export function nombreDocumento(emp) {
  return ((emp && (emp.nombreReal || emp.nombre)) || "").trim();
}

// Último día laborable antes de hoy (el lunes devuelve el viernes)
export function diaLaborableAnterior(d = new Date()) {
  const x = new Date(d);
  do { x.setDate(x.getDate() - 1); } while (x.getDay() === 0 || x.getDay() === 6);
  return fechaLocal(x);
}

// 1234.5 -> "1.234,50 €" (con punto de miles también en cifras de 4 dígitos)
export function euros(n) {
  const v = Math.round((Number(n) || 0) * 100) / 100;
  const [ent, dec] = Math.abs(v).toFixed(2).split(".");
  return (v < 0 ? "-" : "") + ent.replace(/\B(?=(\d{3})+(?!\d))/g, ".") + "," + dec + " €";
}

// Importe en letras para el recibí: 1234.5 -> "mil doscientos treinta y cuatro euros con cincuenta céntimos"
export function importeEnLetras(n) {
  const U = ["cero", "un", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve", "diez", "once", "doce", "trece",
    "catorce", "quince", "dieciséis", "diecisiete", "dieciocho", "diecinueve", "veinte", "veintiún", "veintidós", "veintitrés",
    "veinticuatro", "veinticinco", "veintiséis", "veintisiete", "veintiocho", "veintinueve"];
  const D = ["", "", "", "treinta", "cuarenta", "cincuenta", "sesenta", "setenta", "ochenta", "noventa"];
  const C = ["", "ciento", "doscientos", "trescientos", "cuatrocientos", "quinientos", "seiscientos", "setecientos", "ochocientos", "novecientos"];
  const menosDeMil = x => {
    if (x === 100) return "cien";
    const c = Math.floor(x / 100), r = x % 100;
    let t = c ? C[c] : "";
    if (r) {
      const s = r < 30 ? U[r] : D[Math.floor(r / 10)] + (r % 10 ? " y " + U[r % 10] : "");
      t = t ? t + " " + s : s;
    }
    return t;
  };
  const enteros = x => {
    if (x === 0) return "cero";
    const millones = Math.floor(x / 1e6), miles = Math.floor((x % 1e6) / 1000), resto = x % 1000;
    const partes = [];
    if (millones) partes.push(millones === 1 ? "un millón" : menosDeMil(millones) + " millones");
    if (miles) partes.push(miles === 1 ? "mil" : menosDeMil(miles) + " mil");
    if (resto) partes.push(menosDeMil(resto));
    return partes.join(" ");
  };
  const total = Math.round((Number(n) || 0) * 100);
  const e = Math.floor(total / 100), c = total % 100;
  let txt = enteros(e) + (e === 1 ? " euro" : (e >= 1e6 && e % 1e6 === 0 ? " de euros" : " euros"));
  if (c) txt += " con " + enteros(c) + (c === 1 ? " céntimo" : " céntimos");
  return txt;
}
