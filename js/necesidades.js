import { db } from "./firebase-config.js";
import {
  collection, getDocs, addDoc, doc, updateDoc, deleteDoc, query, orderBy
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

function hoy() {
  return new Date().toISOString().slice(0, 10);
}

export async function renderNecesidades(container, obraId) {
  container.innerHTML = '<div class="loading">Cargando...</div>';

  const ref = collection(db, "obras", obraId, "necesidades");
  const snap = await getDocs(query(ref, orderBy("fechaCreacion", "desc")));
  const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  function pintar() {
    let html = '<div class="card">';

    if (items.length === 0) {
      html += '<div class="placeholder">Nada pendiente todavía. Añade algo abajo.</div>';
    }

    items.forEach(it => {
      const hecho = it.estado === "hecho";
      const tipoLabel = it.tipo === "material" ? "comprar" : "tarea";
      const tipoColor = it.tipo === "material" ? "var(--accent-dark)" : "var(--text-secondary)";
      const tipoBg = it.tipo === "material" ? "var(--accent-bg)" : "var(--border)";
      const urgenteBadge = (!hecho && it.prioridad === "urgente")
        ? '<span style="font-size:11px;color:var(--danger);background:var(--danger-bg);padding:2px 8px;border-radius:20px;margin-left:6px;">urgente</span>'
        : "";
      const fechaTxt = it.fechaNecesaria
        ? `<span style="font-size:11px;color:var(--text-muted);margin-left:6px;">para ${it.fechaNecesaria}</span>`
        : "";

      html += `
        <div class="obra-item" style="cursor:pointer;align-items:flex-start;" data-id="${it.id}">
          <div style="display:flex;align-items:flex-start;gap:10px;">
            <i class="ti ${hecho ? 'ti-square-check' : 'ti-square'}" style="font-size:20px;color:${hecho ? 'var(--success-dark)' : 'var(--text-muted)'};margin-top:1px;"></i>
            <div>
              <span style="font-size:14px;color:${hecho ? 'var(--text-muted)' : 'var(--text)'};text-decoration:${hecho ? 'line-through' : 'none'};">${it.descripcion}</span>
              <div style="margin-top:3px;">
                <span style="font-size:11px;color:${tipoColor};background:${tipoBg};padding:2px 8px;border-radius:20px;">${tipoLabel}</span>
                ${fechaTxt}${urgenteBadge}
              </div>
            </div>
          </div>
          <button class="btn-borrar-item" data-id="${it.id}" title="Borrar" aria-label="Borrar" style="border:none;background:none;color:var(--text-muted);font-size:16px;padding:2px 6px;cursor:pointer;">&#128465;</button>
        </div>
      `;
    });

    html += `
      <div style="margin-top:14px;">
        <input type="text" id="nuevaDescripcion" placeholder="¿Qué hace falta?" style="margin-bottom:10px;">
        <div style="display:flex;gap:8px;margin-bottom:10px;">
          <select id="tipoSelect" style="flex:1;height:44px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);padding:0 10px;">
            <option value="tarea">Tarea</option>
            <option value="material">Comprar / traer</option>
          </select>
          <input type="date" id="fechaNecesaria" style="flex:1;margin-bottom:0;height:44px;">
        </div>
        <label style="display:flex;align-items:center;gap:8px;font-size:13px;color:var(--text-secondary);margin-bottom:10px;">
          <input type="checkbox" id="urgenteCheck" style="width:auto;margin:0;"> marcar como urgente
        </label>
        <button id="addBtn" class="primary">Añadir</button>
      </div>
    </div>`;

    container.innerHTML = html;

    container.querySelectorAll(".obra-item[data-id]").forEach(el => {
      el.addEventListener("click", async (e) => {
        if (e.target.closest(".btn-borrar-item")) return;
        const id = el.dataset.id;
        const item = items.find(i => i.id === id);
        const nuevoEstado = item.estado === "hecho" ? "pendiente" : "hecho";
        item.estado = nuevoEstado;
        pintar();
        await updateDoc(doc(db, "obras", obraId, "necesidades", id), { estado: nuevoEstado });
      });
    });

    container.querySelectorAll(".btn-borrar-item").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        if (!confirm("¿Borrar esto de la lista? No se puede deshacer.")) return;
        const id = btn.dataset.id;
        await deleteDoc(doc(db, "obras", obraId, "necesidades", id));
        const idx = items.findIndex(i => i.id === id);
        if (idx > -1) items.splice(idx, 1);
        pintar();
      });
    });

    document.getElementById("addBtn").addEventListener("click", async () => {
      const descripcion = document.getElementById("nuevaDescripcion").value.trim();
      if (!descripcion) return;
      const tipo = document.getElementById("tipoSelect").value;
      const fechaNecesaria = document.getElementById("fechaNecesaria").value || null;
      const urgente = document.getElementById("urgenteCheck").checked;

      const nuevo = {
        descripcion,
        tipo,
        estado: "pendiente",
        prioridad: urgente ? "urgente" : "normal",
        fechaNecesaria,
        fechaCreacion: hoy()
      };
      const ref2 = await addDoc(collection(db, "obras", obraId, "necesidades"), nuevo);
      items.unshift({ id: ref2.id, ...nuevo });
      pintar();
    });
  }

  pintar();
}
