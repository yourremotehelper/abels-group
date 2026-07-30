import { db } from "./firebase-config.js";
import {
  collection, getDocs, addDoc, doc, updateDoc, deleteDoc, query, orderBy
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

function hoy() {
  return new Date().toISOString().slice(0, 10);
}

export async function renderIncidencias(container, obraId) {
  container.innerHTML = '<div class="loading">Cargando incidencias...</div>';

  const ref = collection(db, "obras", obraId, "incidencias");
  const snap = await getDocs(query(ref, orderBy("fecha", "desc")));
  const incidencias = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  function pintar() {
    let html = '<div class="card">';

    if (incidencias.length === 0) {
      html += '<div class="placeholder">Sin incidencias registradas.</div>';
    }

    incidencias.forEach(inc => {
      const resuelta = inc.estado === "resuelta";
      html += `
        <div class="obra-item" style="align-items:flex-start;">
          <div style="cursor:pointer;flex:1;" data-id="${inc.id}" class="incidencia-toggle">
            <div style="display:flex;align-items:center;gap:8px;">
              <span style="font-size:11px;color:${resuelta ? 'var(--success-dark)' : 'var(--danger)'};background:${resuelta ? 'var(--success-bg)' : 'var(--danger-bg)'};padding:2px 8px;border-radius:20px;">${resuelta ? 'resuelta' : 'abierta'}</span>
              <span style="font-size:11px;color:var(--text-muted);">${inc.fecha}</span>
            </div>
            <p style="font-size:14px;margin:4px 0 0;color:${resuelta ? 'var(--text-muted)' : 'var(--text)'};text-decoration:${resuelta ? 'line-through' : 'none'};">${inc.descripcion}</p>
          </div>
          <button class="btn-borrar-inc" data-id="${inc.id}" title="Borrar" aria-label="Borrar" style="border:none;background:none;color:var(--text-muted);font-size:16px;padding:2px 6px;cursor:pointer;">&#128465;</button>
        </div>
      `;
    });

    html += `
      <div style="margin-top:14px;">
        <textarea id="nuevaDescripcion" placeholder="¿Qué ha pasado?" rows="2" style="width:100%;padding:10px 12px;border:1px solid var(--border);border-radius:8px;font-size:15px;background:var(--bg);color:var(--text);margin-bottom:10px;resize:vertical;font-family:inherit;"></textarea>
        <button id="addIncBtn" class="primary">Registrar incidencia</button>
      </div>
    </div>`;

    container.innerHTML = html;

    container.querySelectorAll(".incidencia-toggle").forEach(el => {
      el.addEventListener("click", async () => {
        const id = el.dataset.id;
        const inc = incidencias.find(i => i.id === id);
        const nuevoEstado = inc.estado === "resuelta" ? "abierta" : "resuelta";
        inc.estado = nuevoEstado;
        pintar();
        await updateDoc(doc(db, "obras", obraId, "incidencias", id), { estado: nuevoEstado });
      });
    });

    container.querySelectorAll(".btn-borrar-inc").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        if (!confirm("¿Borrar esta incidencia? No se puede deshacer.")) return;
        const id = btn.dataset.id;
        await deleteDoc(doc(db, "obras", obraId, "incidencias", id));
        const idx = incidencias.findIndex(i => i.id === id);
        if (idx > -1) incidencias.splice(idx, 1);
        pintar();
      });
    });

    document.getElementById("addIncBtn").addEventListener("click", async () => {
      const descripcion = document.getElementById("nuevaDescripcion").value.trim();
      if (!descripcion) return;
      const nueva = { descripcion, estado: "abierta", fecha: hoy() };
      const ref2 = await addDoc(collection(db, "obras", obraId, "incidencias"), nueva);
      incidencias.unshift({ id: ref2.id, ...nueva });
      pintar();
    });
  }

  pintar();
}
