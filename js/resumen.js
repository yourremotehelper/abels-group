import { db } from "./firebase-config.js";
import {
  collection, getDocs, query, where
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

function inicioSemana(offsetSemanas) {
  const d = new Date();
  const diaSemana = (d.getDay() + 6) % 7; // lunes = 0
  d.setDate(d.getDate() - diaSemana + offsetSemanas * 7);
  d.setHours(0, 0, 0, 0);
  return d;
}

function aTexto(d) {
  const pad = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function aTextoCorto(d) {
  const pad = n => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
}

function minutos(horaTexto) {
  const [h, m] = horaTexto.split(":").map(Number);
  return h * 60 + m;
}

export async function renderResumen(container, obraId, offsetSemanas = 0) {
  container.innerHTML = '<div class="loading">Calculando resumen...</div>';

  try {
    const inicio = inicioSemana(offsetSemanas);
    const fin = new Date(inicio);
    fin.setDate(fin.getDate() + 6);
    const limite = aTexto(inicio);
    const limiteFin = aTexto(fin);

    const [fichajesSnap, necesidadesSnap, gastosSnap] = await Promise.all([
      getDocs(query(
        collection(db, "obras", obraId, "fichajes"),
        where("fecha", ">=", limite),
        where("fecha", "<=", limiteFin)
      )),
      getDocs(collection(db, "obras", obraId, "necesidades")),
      getDocs(collection(db, "obras", obraId, "gastos"))
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

    let totalGastos = 0;
    gastosSnap.forEach(d => { totalGastos += Number(d.data().importe) || 0; });

    container.innerHTML = `
      <div class="card">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
          <button id="semanaAnterior" class="icon-btn" style="width:32px;height:32px;" title="Semana anterior" aria-label="Semana anterior">&#8249;</button>
          <p style="font-size:13px;color:var(--text-secondary);margin:0;text-align:center;">${offsetSemanas === 0 ? "Esta semana" : "Semana"} · ${aTextoCorto(inicio)} - ${aTextoCorto(fin)}</p>
          <button id="semanaSiguiente" class="icon-btn" style="width:32px;height:32px;${offsetSemanas >= 0 ? "opacity:0.3;pointer-events:none;" : ""}" title="Semana siguiente" aria-label="Semana siguiente">&#8250;</button>
        </div>
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
          <div style="background:var(--bg);border-radius:8px;padding:10px;grid-column:span 2;">
            <p style="font-size:12px;color:var(--text-muted);margin:0 0 4px;">Gastado en total en esta obra</p>
            <p style="font-size:20px;font-weight:500;margin:0;">${totalGastos.toFixed(2)} €</p>
          </div>
        </div>
      </div>
    `;

    document.getElementById("semanaAnterior").addEventListener("click", () => {
      renderResumen(container, obraId, offsetSemanas - 1);
    });
    document.getElementById("semanaSiguiente").addEventListener("click", () => {
      if (offsetSemanas < 0) renderResumen(container, obraId, offsetSemanas + 1);
    });
  } catch (err) {
    console.error(err);
    container.innerHTML = `<div class="card"><div class="placeholder">No se ha podido cargar el resumen.<br><span style="font-size:11px;">${err.message || err}</span></div></div>`;
  }
}
