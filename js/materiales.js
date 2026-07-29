import { db } from "./firebase-config.js";
import {
  collection, getDocs, addDoc, doc, updateDoc, query, orderBy
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export async function renderMateriales(container, obraId) {
  container.innerHTML = '<div class="loading">Cargando materiales...</div>';

  const ref = collection(db, "obras", obraId, "materiales");
  const snap = await getDocs(query(ref, orderBy("fechaCreacion", "desc")));
  const materiales = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  function pintar() {
    let html = '<div class="card">';

    if (materiales.length === 0) {
      html += '<div class="placeholder">No hay materiales pendientes. Añade uno abajo.</div>';
    }

    materiales.forEach(m => {
      const comprado = m.estado === "comprado";
      const badge = m.prioridad === "urgente"
        ? '<span style="font-size:11px;color:var(--danger);background:var(--danger-bg);padding:2px 8px;border-radius:20px;">urgente</span>'
        : '';
      html += `
        <div class="obra-item" style="cursor:pointer;" data-id="${m.id}">
          <div style="display:flex;align-items:center;gap:10px;">
            <i class="ti ${comprado ? 'ti-square-check' : 'ti-square'}" style="font-size:20px;color:${comprado ? 'var(--success-dark)' : 'var(--text-muted)'};"></i>
            <span style="font-size:14px;color:${comprado ? 'var(--text-muted)' : 'var(--text)'};text-decoration:${comprado ? 'line-through' : 'none'};">${m.descripcion}</span>
          </div>
          ${comprado ? '' : badge}
        </div>
      `;
    });

    html += `
      <div style="display:flex;gap:8px;margin-top:14px;">
        <input type="text" id="nuevoMaterial" placeholder="Qué hace falta comprar" style="margin-bottom:0;">
      </div>
      <label style="display:flex;align-items:center;gap:8px;font-size:13px;color:var(--text-secondary);margin:8px 0 0;">
        <input type="checkbox" id="urgenteCheck" style="width:auto;margin:0;"> marcar como urgente
      </label>
      <button id="addMaterialBtn" class="primary" style="margin-top:10px;">Añadir a la lista</button>
    </div>`;

    container.innerHTML = html;

    container.querySelectorAll(".obra-item[data-id]").forEach(item => {
      item.addEventListener("click", async () => {
        const id = item.dataset.id;
        const material = materiales.find(m => m.id === id);
        const nuevoEstado = material.estado === "comprado" ? "pendiente" : "comprado";
        material.estado = nuevoEstado;
        pintar();
        await updateDoc(doc(db, "obras", obraId, "materiales", id), { estado: nuevoEstado });
      });
    });

    document.getElementById("addMaterialBtn").addEventListener("click", async () => {
      const input = document.getElementById("nuevoMaterial");
      const descripcion = input.value.trim();
      if (!descripcion) return;
      const urgente = document.getElementById("urgenteCheck").checked;
      const nuevo = {
        descripcion,
        estado: "pendiente",
        prioridad: urgente ? "urgente" : "normal",
        fechaCreacion: new Date().toISOString().slice(0, 10)
      };
      const ref2 = await addDoc(collection(db, "obras", obraId, "materiales"), nuevo);
      materiales.unshift({ id: ref2.id, ...nuevo });
      pintar();
    });
  }

  pintar();
}
