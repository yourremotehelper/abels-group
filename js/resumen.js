import { db } from "./firebase-config.js";
import {
  collection, getDocs, query, where
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

function fechaHace7Dias() {
  const d = new Date();
  d.setDate(d.getDate() - 6); // hoy incluido = últimos 7 días
  const pad = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function minutos(horaTexto) {
  const [h, m] = horaTexto.split(":").map(Number);
  return h * 60 + m;
}

export async function renderResumen(container, obraId) {
  container.innerHTML = '<div class="loading">Calculando resumen...</div>';

  try {
    const limite = fechaHace7Dias();

    const [fichajesSnap, necesidadesSnap] = await Promise.all([
      getDocs(query(collection(db, "obras", obraId, "fichajes"), where("fecha", ">=", limite))),
      getDocs(collection(db, "obras", obraId, "necesidades"))
    ]);

    // Asistencia y horas de los últimos 7 días
    const diasConGente = new Set();
    let minutosTotales = 0;
    fichajesSnap.forEach(d => {
      const f = d.data();
      diasConGente.add(f.fecha);
      if (f.horaEntrada && f.horaSalida) {
        const diff = minutos(f.horaSalida) - minutos(f.horaEntrada);
        if (diff > 0) minutosTotales += diff;
      }
    });
    const horasTotales = (minutosTotales / 60).toFixed(1);

    // Tareas y materiales (estado general de la obra, no solo la semana)
    let tareasTotal = 0, tareasHechas = 0, materialesPendientes = 0;
    necesidadesSnap.forEach(d => {
      const it = d.data();
      if (it.tipo === "tarea") {
        tareasTotal++;
        if (it.estado === "hecho") tareasHechas++;
      } else if (it.tipo === "material" && it.estado !== "hecho") {
        materialesPendientes++;
      }
    });

    container.innerHTML = `
      <div class="card">
        <p style="font-size:13px;color:var(--text-secondary);margin:0 0 12px;">Resumen de los últimos 7 días</p>
        <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;">
          <div style="background:var(--bg);border-radius:8px;padding:10px;">
            <p style="font-size:12px;color:var(--text-muted);margin:0 0 4px;">Asistencia</p>
            <p style="font-size:20px;font-weight:500;margin:0;">${diasConGente.size} día${diasConGente.size === 1 ? "" : "s"}</p>
          </div>
          <div style="background:var(--bg);border-radius:8px;padding:10px;">
            <p style="font-size:12px;color:var(--text-muted);margin:0 0 4px;">Horas fichadas</p>
            <p style="font-size:20px;font-weight:500;margin:0;">${horasTotales} h</p>
          </div>
          <div style="background:var(--bg);border-radius:8px;padding:10px;">
            <p style="font-size:12px;color:var(--text-muted);margin:0 0 4px;">Tareas</p>
            <p style="font-size:20px;font-weight:500;margin:0;">${tareasHechas}/${tareasTotal}</p>
          </div>
          <div style="background:var(--bg);border-radius:8px;padding:10px;">
            <p style="font-size:12px;color:var(--text-muted);margin:0 0 4px;">Por comprar</p>
            <p style="font-size:20px;font-weight:500;margin:0;">${materialesPendientes}</p>
          </div>
        </div>
      </div>
    `;
  } catch (err) {
    console.error(err);
    container.innerHTML = `<div class="card"><div class="placeholder">No se ha podido cargar el resumen.<br><span style="font-size:11px;">${err.message || err}</span></div></div>`;
  }
}
