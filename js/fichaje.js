import { db } from "./firebase-config.js";
import {
  collection, getDocs, addDoc, doc, setDoc, deleteDoc, query, where, orderBy
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

function fechaHoy() {
  const d = new Date();
  const pad = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function horaAhora() {
  const d = new Date();
  const pad = n => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function capturarGPS() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) { resolve(null); return; }
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { timeout: 8000 }
    );
  });
}

async function cargarEmpleados() {
  const snap = await getDocs(query(collection(db, "empleados"), orderBy("nombre")));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function cargarFichajesHoy(obraId, fecha) {
  const ref = collection(db, "obras", obraId, "fichajes");
  const snap = await getDocs(query(ref, where("fecha", "==", fecha)));
  const map = {};
  snap.forEach(d => { map[d.data().empleadoId] = { id: d.id, ...d.data() }; });
  return map;
}

function mapsLink(gps) {
  if (!gps) return "";
  return `https://www.google.com/maps?q=${gps.lat},${gps.lng}`;
}

function gpsLinks(f) {
  const links = [];
  if (f.gpsEntrada) links.push(`<a href="${mapsLink(f.gpsEntrada)}" target="_blank" style="font-size:11px;color:var(--text-accent, var(--accent));">ver entrada</a>`);
  if (f.gpsSalida) links.push(`<a href="${mapsLink(f.gpsSalida)}" target="_blank" style="font-size:11px;color:var(--text-accent, var(--accent));margin-left:8px;">ver salida</a>`);
  return links.join("");
}

export async function renderFichaje(container, obraId) {
  container.innerHTML = '<div class="loading">Cargando fichaje...</div>';

  const fecha = fechaHoy();
  const [empleados, fichajes] = await Promise.all([
    cargarEmpleados(),
    cargarFichajesHoy(obraId, fecha)
  ]);

  function pintar() {
    let html = '<div class="card">';

    if (empleados.length === 0) {
      html += '<div class="placeholder">Todavía no hay empleados. Añade uno abajo.</div>';
    }

    empleados.forEach(emp => {
      const f = fichajes[emp.id];
      let estado;
      if (f && f.horaEntrada && f.horaSalida) {
        estado = `<div style="text-align:right;">
          <span style="font-size:12px;color:var(--success-dark);background:var(--success-bg);padding:3px 8px;border-radius:20px;">${f.horaEntrada} - ${f.horaSalida}</span>
          <div style="margin-top:4px;">${gpsLinks(f)} <button class="btn-borrar-fichaje" data-emp="${emp.id}" title="Borrar fichaje" style="border:none;background:none;color:var(--text-muted);font-size:13px;cursor:pointer;margin-left:6px;">&#128465;</button></div>
        </div>`;
      } else if (f && f.horaEntrada) {
        estado = `<div style="text-align:right;">
          <div style="display:flex;align-items:center;gap:8px;justify-content:flex-end;">
            <span style="font-size:12px;color:var(--success-dark);background:var(--success-bg);padding:3px 8px;border-radius:20px;">entrada ${f.horaEntrada}</span>
            <button class="btn-salida" data-emp="${emp.id}" data-nombre="${emp.nombre}" style="font-size:12px;padding:4px 10px;background:var(--accent);color:#fff;border:none;border-radius:6px;">marcar salida</button>
          </div>
          <div style="margin-top:4px;">${gpsLinks(f)} <button class="btn-borrar-fichaje" data-emp="${emp.id}" title="Borrar fichaje" style="border:none;background:none;color:var(--text-muted);font-size:13px;cursor:pointer;margin-left:6px;">&#128465;</button></div>
        </div>`;
      } else {
        estado = `<button class="btn-entrada" data-emp="${emp.id}" data-nombre="${emp.nombre}" style="font-size:12px;padding:4px 10px;background:var(--accent);color:#fff;border:none;border-radius:6px;">marcar entrada</button>`;
      }

      html += `
        <div class="obra-item">
          <span style="font-size:14px;">${emp.nombre} <button class="btn-borrar-empleado" data-emp="${emp.id}" title="Quitar empleado de la lista" style="border:none;background:none;color:var(--text-muted);font-size:12px;cursor:pointer;">&#10005;</button></span>
          ${estado}
        </div>
      `;
    });

    html += `
      <div style="display:flex;gap:8px;margin-top:14px;">
        <input type="text" id="nuevoEmpleado" placeholder="Nombre del empleado" style="margin-bottom:0;">
        <button id="addEmpleadoBtn" class="secondary" style="width:auto;padding:0 14px;white-space:nowrap;">Añadir</button>
      </div>
    </div>`;

    container.innerHTML = html;

    container.querySelectorAll(".btn-entrada").forEach(btn => {
      btn.addEventListener("click", async () => {
        btn.disabled = true;
        btn.textContent = "Ubicando...";
        const gps = await capturarGPS();
        const empId = btn.dataset.emp;
        const docId = `${fecha}_${empId}`;
        await setDoc(doc(db, "obras", obraId, "fichajes", docId), {
          empleadoId: empId,
          empleadoNombre: btn.dataset.nombre,
          fecha,
          horaEntrada: horaAhora(),
          gpsEntrada: gps
        }, { merge: true });
        fichajes[empId] = { horaEntrada: horaAhora(), fecha };
        pintar();
      });
    });

    container.querySelectorAll(".btn-salida").forEach(btn => {
      btn.addEventListener("click", async () => {
        btn.disabled = true;
        btn.textContent = "Ubicando...";
        const gps = await capturarGPS();
        const empId = btn.dataset.emp;
        const docId = `${fecha}_${empId}`;
        await setDoc(doc(db, "obras", obraId, "fichajes", docId), {
          horaSalida: horaAhora(),
          gpsSalida: gps
        }, { merge: true });
        fichajes[empId].horaSalida = horaAhora();
        pintar();
      });
    });

    document.getElementById("addEmpleadoBtn").addEventListener("click", async () => {
      const input = document.getElementById("nuevoEmpleado");
      const nombre = input.value.trim();
      if (!nombre) return;
      const ref = await addDoc(collection(db, "empleados"), { nombre, activo: true });
      empleados.push({ id: ref.id, nombre });
      empleados.sort((a, b) => a.nombre.localeCompare(b.nombre));
      pintar();
    });

    container.querySelectorAll(".btn-borrar-fichaje").forEach(btn => {
      btn.addEventListener("click", async () => {
        if (!confirm("¿Borrar el fichaje de hoy de esta persona? Volverá a aparecer como no fichada.")) return;
        const empId = btn.dataset.emp;
        const docId = `${fecha}_${empId}`;
        await deleteDoc(doc(db, "obras", obraId, "fichajes", docId));
        delete fichajes[empId];
        pintar();
      });
    });

    container.querySelectorAll(".btn-borrar-empleado").forEach(btn => {
      btn.addEventListener("click", async () => {
        const empId = btn.dataset.emp;
        const emp = empleados.find(e => e.id === empId);
        if (!confirm(`¿Quitar a ${emp.nombre} de la lista de empleados? No borra su historial de fichajes ya guardados.`)) return;
        await deleteDoc(doc(db, "empleados", empId));
        const idx = empleados.findIndex(e => e.id === empId);
        if (idx > -1) empleados.splice(idx, 1);
        pintar();
      });
    });
  }

  pintar();
}
