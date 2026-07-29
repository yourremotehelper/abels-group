import { db } from "./firebase-config.js";
import {
  collection, getDocs, addDoc, doc, updateDoc, query, orderBy
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

function fechaHoy() {
  const d = new Date();
  const pad = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export async function renderTareas(container, obraId) {
  container.innerHTML = '<div class="loading">Cargando tareas...</div>';

  const ref = collection(db, "obras", obraId, "tareas");
  const snap = await getDocs(query(ref, orderBy("fechaCreacion", "desc")));
  const tareas = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  function pintar() {
    let html = '<div class="card">';

    if (tareas.length === 0) {
      html += '<div class="placeholder">Todavía no hay tareas. Añade la primera abajo.</div>';
    }

    tareas.forEach(t => {
      const hecho = t.estado === "hecho";
      html += `
        <div class="obra-item" style="cursor:pointer;" data-id="${t.id}" data-estado="${t.estado}">
          <div style="display:flex;align-items:center;gap:10px;">
            <i class="ti ${hecho ? 'ti-square-check' : 'ti-square'}" style="font-size:20px;color:${hecho ? 'var(--success-dark)' : 'var(--text-muted)'};"></i>
            <span style="font-size:14px;color:${hecho ? 'var(--text-muted)' : 'var(--text)'};text-decoration:${hecho ? 'line-through' : 'none'};">${t.descripcion}</span>
          </div>
        </div>
      `;
    });

    html += `
      <div style="display:flex;gap:8px;margin-top:14px;">
        <input type="text" id="nuevaTarea" placeholder="Descripción de la tarea" style="margin-bottom:0;">
        <button id="addTareaBtn" class="secondary" style="width:auto;padding:0 14px;white-space:nowrap;">Añadir</button>
      </div>
    </div>`;

    container.innerHTML = html;

    container.querySelectorAll(".obra-item[data-id]").forEach(item => {
      item.addEventListener("click", async () => {
        const id = item.dataset.id;
        const tarea = tareas.find(t => t.id === id);
        const nuevoEstado = tarea.estado === "hecho" ? "pendiente" : "hecho";
        tarea.estado = nuevoEstado;
        pintar();
        await updateDoc(doc(db, "obras", obraId, "tareas", id), {
          estado: nuevoEstado,
          fechaCompletado: nuevoEstado === "hecho" ? fechaHoy() : null
        });
      });
    });

    document.getElementById("addTareaBtn").addEventListener("click", async () => {
      const input = document.getElementById("nuevaTarea");
      const descripcion = input.value.trim();
      if (!descripcion) return;
      const nueva = { descripcion, estado: "pendiente", fechaCreacion: fechaHoy(), fechaCompletado: null };
      const ref2 = await addDoc(collection(db, "obras", obraId, "tareas"), nueva);
      tareas.unshift({ id: ref2.id, ...nueva });
      pintar();
    });
  }

  pintar();
}
