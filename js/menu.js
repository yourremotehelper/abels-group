// Menús agrupados con iconos: Obras y RRHH (pantalla de ordenador) y Ajustes (cómodo en el móvil).
// Cada página pone <nav class="secciones" id="secciones"></nav> y llama a pintarSecciones().
import { esAdmin, puedeGestionarFichajes } from "./registro.js";

export const GRUPOS = {
  obras: {
    titulo: "🏗️ Obras",
    secciones: [
      { id: "panel", icono: "📊", nombre: "Panel de obras", url: "panel.html", soloAdmin: true },
      { id: "presupuestos", icono: "📄", nombre: "Presupuestos", url: "presupuestos.html", soloAdmin: true },
      { id: "partes", icono: "📋", nombre: "Partes diarios", url: "partes.html" }
    ]
  },
  rrhh: {
    titulo: "👥 RRHH",
    secciones: [
      { id: "directorio", icono: "📇", nombre: "Directorio", url: "empleados.html" },
      { id: "ausencias", icono: "🗓️", nombre: "Ausencias y vacaciones", url: "ausencias.html" },
      { id: "extras", icono: "⏱️", nombre: "Horas extra", url: "horas-extra.html" },
      { id: "pagos", icono: "💶", nombre: "Pagos y recibís", url: "pagos.html", soloAdmin: true },
      { id: "exportar", icono: "📤", nombre: "Exportar asistencia", url: "exportar.html" }
    ]
  },
  ajustes: {
    titulo: "⚙️ Ajustes",
    secciones: [
      { id: "jornada", icono: "🕒", nombre: "Jornada", url: "ajustes.html" },
      { id: "festivos", icono: "📅", nombre: "Festivos", url: "festivos.html" },
      { id: "obras", icono: "🏗️", nombre: "Obras", url: "obras.html", soloAdmin: true },
      { id: "usuarios", icono: "🔑", nombre: "Usuarios", url: "usuarios.html", soloAdmin: true }
    ]
  }
};

// Pinta las pestañas del grupo y marca la actual. Con perfil, oculta lo que es solo de administración.
export function pintarSecciones(grupo, actual, perfil = null) {
  const nav = document.getElementById("secciones");
  if (!nav) return;
  // Los encargados solo entran al directorio: sin pestañas de oficina
  if (perfil && !puedeGestionarFichajes(perfil)) { nav.style.display = "none"; return; }
  const g = GRUPOS[grupo];
  nav.setAttribute("aria-label", g.titulo.replace(/^\S+\s/, ""));
  nav.innerHTML = g.secciones
    .filter(s => !s.soloAdmin || !perfil || esAdmin(perfil))
    .map(s => `<a href="${s.url}" class="${s.id === actual ? "activa" : ""}" ${s.id === actual ? 'aria-current="page"' : ""}><span aria-hidden="true">${s.icono}</span> ${s.nombre}</a>`)
    .join("");
}
