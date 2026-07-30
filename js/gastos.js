import { db } from "./firebase-config.js";
import {
  collection, getDocs, addDoc, doc, deleteDoc, query, orderBy
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

function hoy() {
  return new Date().toISOString().slice(0, 10);
}

export async function renderGastos(container, obraId) {
  container.innerHTML = '<div class="loading">Cargando gastos...</div>';

  const ref = collection(db, "obras", obraId, "gastos");
  const snap = await getDocs(query(ref, orderBy("fecha", "desc")));
  const gastos = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  function pintar() {
    const total = gastos.reduce((sum, g) => sum + (Number(g.importe) || 0), 0);

    let html = `
      <div class="card">
        <p style="font-size:13px;color:var(--text-secondary);margin:0 0 4px;">Total gastado en esta obra</p>
        <p style="font-size:26px;font-weight:600;margin:0;">${total.toFixed(2)} €</p>
      </div>
      <div class="card">
    `;

    if (gastos.length === 0) {
      html += '<div class="placeholder">Todavía no hay gastos registrados.</div>';
    }

    gastos.forEach(g => {
      html += `
        <div class="obra-item">
          <div>
            <p class="obra-name">${g.concepto}</p>
            <p class="obra-meta">${g.fecha}</p>
          </div>
          <div style="display:flex;align-items:center;gap:10px;">
            <span style="font-size:14px;font-weight:500;">${Number(g.importe).toFixed(2)} €</span>
            <button class="btn-borrar-gasto" data-id="${g.id}" title="Borrar" aria-label="Borrar" style="border:none;background:none;color:var(--text-muted);font-size:15px;cursor:pointer;">&#128465;</button>
          </div>
        </div>
      `;
    });

    html += `
      <div style="margin-top:14px;">
        <input type="text" id="nuevoConcepto" placeholder="Concepto (ej. cemento, alquiler andamio...)" style="margin-bottom:8px;">
        <div style="display:flex;gap:8px;">
          <input type="number" id="nuevoImporte" placeholder="Importe €" step="0.01" style="flex:1;margin-bottom:0;">
          <button id="addGastoBtn" class="primary" style="width:auto;padding:0 18px;white-space:nowrap;">Añadir</button>
        </div>
      </div>
    </div>`;

    container.innerHTML = html;

    container.querySelectorAll(".btn-borrar-gasto").forEach(btn => {
      btn.addEventListener("click", async () => {
        if (!confirm("¿Borrar este gasto? No se puede deshacer.")) return;
        const id = btn.dataset.id;
        await deleteDoc(doc(db, "obras", obraId, "gastos", id));
        const idx = gastos.findIndex(g => g.id === id);
        if (idx > -1) gastos.splice(idx, 1);
        pintar();
      });
    });

    document.getElementById("addGastoBtn").addEventListener("click", async () => {
      const concepto = document.getElementById("nuevoConcepto").value.trim();
      const importe = parseFloat(document.getElementById("nuevoImporte").value);
      if (!concepto || isNaN(importe)) return;

      const nuevo = { concepto, importe, fecha: hoy() };
      const ref2 = await addDoc(collection(db, "obras", obraId, "gastos"), nuevo);
      gastos.unshift({ id: ref2.id, ...nuevo });
      pintar();
    });
  }

  pintar();
}
