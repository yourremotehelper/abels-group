// Parte diario de obra: lo rellena el encargado desde el móvil al acabar el día.
// Se guarda en obras/{obraId}/partes/{fecha} y las fotos en obras/{obraId}/partes/{fecha}/fotos/{id}.
import { db, auth } from "./firebase-config.js";
import {
  collection, getDocs, getDoc, addDoc, setDoc, deleteDoc, updateDoc, doc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { fechaLocal, horaLocal, fechaBonita, esc, puedeGestionarFichajes } from "./registro.js";
import { nuevoPDF, cabeceraPDF, parrafoPDF } from "./documentos.js";
import { vistaPrevia } from "./vista-previa.js";

export const MAX_FOTOS = 8;
// Tamaño aproximado de una foto guardada (en KB)
export const kbDe = data => Math.round(String(data || "").length * 3 / 4 / 1024);

// ---------- Datos ----------
export async function cargarParte(obraId, fecha) {
  const [snap, fotosSnap] = await Promise.all([
    getDoc(doc(db, "obras", obraId, "partes", fecha)),
    getDocs(collection(db, "obras", obraId, "partes", fecha, "fotos"))
  ]);
  const fotos = fotosSnap.docs.map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.orden || 0) - (b.orden || 0));
  // Un parte cuenta como enviado cuando se ha guardado con el botón (antes puede tener solo fotos subidas)
  const d = snap.exists() ? snap.data() : null;
  return { parte: d && d.enviado ? d : null, info: d, fotos };
}

// Foto de obra: se reduce a 1000 px por el lado largo (unos 80-150 KB) para guardarla en la base de datos
export function comprimirFotoObra(file, lado = 1000, calidad = 0.6) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, lado / Math.max(img.width, img.height));
      const w = Math.round(img.width * k), h = Math.round(img.height * k);
      const c = document.createElement("canvas");
      c.width = w; c.height = h;
      c.getContext("2d").drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      resolve({ data: c.toDataURL("image/jpeg", calidad), ancho: w, alto: h });
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("No se ha podido leer la imagen")); };
    img.src = url;
  });
}

const lineas = t => String(t || "").split("\n").map(s => s.trim()).filter(Boolean);

// ---------- PDF del parte ----------
export function pdfParte(parte, fotos, obraNombre) {
  const pdf = nuevoPDF(), W = 210, M = 16, AN = W - 2 * M;
  cabeceraPDF(pdf, "PARTE DIARIO", W, M);
  let y = 44;
  pdf.setFont("helvetica", "bold"); pdf.setFontSize(13);
  pdf.text(obraNombre || "Obra", M, y);
  pdf.setFont("helvetica", "normal"); pdf.setFontSize(10);
  y += 6;
  pdf.text(`${fechaBonita(parte.fecha)}  ·  Parte de ${parte.autorNombre || "—"}`, M, y);
  y += 8;

  const seccion = (titulo, texto) => {
    if (!texto) return;
    if (y > 260) { pdf.addPage(); y = 20; }
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(11);
    pdf.text(titulo, M, y);
    y = parrafoPDF(pdf, texto, M, y + 6, AN, 10) + 4;
  };
  seccion("Trabajo realizado", parte.trabajo || "—");

  if ((parte.avance || []).length) {
    if (y > 240) { pdf.addPage(); y = 20; }
    pdf.autoTable({
      startY: y, margin: { left: M, right: M },
      head: [["Avance", "Antes", "Ahora"]],
      body: parte.avance.map(a => [a.nombre, `${a.antes ?? 0} %`, `${a.ahora} %`]),
      styles: { fontSize: 9, cellPadding: 1.6 }, headStyles: { fillColor: [216, 90, 48] },
      columnStyles: { 1: { halign: "right", cellWidth: 25 }, 2: { halign: "right", cellWidth: 25 } }
    });
    y = pdf.lastAutoTable.finalY + 7;
  }
  seccion("Falta / hay que pedir", lineas(parte.falta).map(l => "• " + l).join("\n"));
  seccion("Incidencias", lineas(parte.incidencias).map(l => "• " + l).join("\n"));
  seccion("Otras notas", parte.notas);

  // Fotos: dos por fila
  if (fotos.length) {
    if (y > 200) { pdf.addPage(); y = 20; }
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(11);
    pdf.text(`Fotos (${fotos.length})`, M, y);
    y += 4;
    const anchoCol = (AN - 6) / 2, altoMax = 80;
    let col = 0, altoFila = 0;
    fotos.forEach(f => {
      const k = Math.min(anchoCol / (f.ancho || 4), altoMax / (f.alto || 3));
      const w = (f.ancho || 4) * k, h = (f.alto || 3) * k;
      if (col === 0 && y + h > 285) { pdf.addPage(); y = 20; }
      try { pdf.addImage(f.data, "JPEG", M + col * (anchoCol + 6), y, w, h); } catch (e) { console.error(e); }
      altoFila = Math.max(altoFila, h);
      col++;
      if (col === 2) { col = 0; y += altoFila + 5; altoFila = 0; }
    });
  }
  const n = pdf.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    pdf.setPage(i); pdf.setFontSize(8); pdf.setTextColor(140);
    pdf.text(`Parte diario · ${obraNombre || ""} · ${fechaBonita(parte.fecha)} · página ${i} de ${n}`, W / 2, 290, { align: "center" });
    pdf.setTextColor(0);
  }
  return pdf;
}

export function verPDFParte(parte, fotos, obraNombre) {
  const pdf = pdfParte(parte, fotos, obraNombre);
  const archivo = `parte_${obraNombre || "obra"}_${parte.fecha}.pdf`.replace(/[\s/]+/g, "_");
  return vistaPrevia({ titulo: `Parte de ${obraNombre} · ${fechaBonita(parte.fecha)}`, documentos: [{ nombre: obraNombre, pdf }], onDescargar: () => pdf.save(archivo) });
}

// ---------- Pantalla del encargado ----------
const CSS = `
  .pt-sec { font-size: 15px; font-weight: 600; margin: 0 0 8px; display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
  .pt-sec small { font-size: 12px; font-weight: 400; color: var(--text-muted); }
  .pt-area { width: 100%; padding: 10px 12px; border: 1px solid var(--border); border-radius: 8px; font-size: 15px; background: var(--bg); color: var(--text); resize: vertical; font-family: inherit; box-sizing: border-box; }
  .pt-dictar { font: inherit; font-size: 13px; border: 1px solid var(--border); background: var(--surface); border-radius: 18px; padding: 5px 12px; cursor: pointer; color: var(--text); }
  .pt-dictar.oyendo { background: var(--danger-bg); border-color: var(--danger); color: var(--danger); }
  .pt-fase { display: grid; grid-template-columns: 1fr 120px; gap: 10px; align-items: center; padding: 6px 0; border-bottom: 1px solid var(--border); }
  .pt-fase:last-child { border-bottom: none; }
  .pt-fase input[type=range] { width: 100%; accent-color: var(--accent); }
  .pt-fase .pct { font-variant-numeric: tabular-nums; font-weight: 600; text-align: right; }
  .pt-fase .ant { font-size: 11px; color: var(--text-muted); font-weight: 400; }
  .pt-fotos { display: grid; grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); gap: 8px; }
  .pt-foto { position: relative; aspect-ratio: 1; border-radius: 8px; overflow: hidden; background: var(--border); }
  .pt-foto img { width: 100%; height: 100%; object-fit: cover; display: block; cursor: zoom-in; }
  .pt-foto button { position: absolute; top: 4px; right: 4px; width: 28px; height: 28px; border-radius: 50%; border: none; background: rgba(0,0,0,.6); color: #fff; font-size: 14px; cursor: pointer; }
  .pt-anadir { aspect-ratio: 1; border: 2px dashed var(--border); border-radius: 8px; display: flex; flex-direction: column; align-items: center; justify-content: center; font-size: 13px; color: var(--text-secondary); cursor: pointer; text-align: center; gap: 4px; margin: 0; }
  .pt-anadir span { font-size: 26px; }
  .pt-estado { font-size: 13px; padding: 10px 12px; border-radius: 8px; margin-bottom: 12px; }
  .pt-estado.ok { background: var(--success-bg); color: var(--success-dark); }
  .pt-estado.pend { background: var(--accent-bg); color: var(--accent-dark); }
  .pt-guardar { position: sticky; bottom: 0; padding: 10px 0 calc(10px + env(safe-area-inset-bottom)); background: var(--bg); z-index: 5; }
  .pt-ver { position: fixed; inset: 0; z-index: 900; background: rgba(0,0,0,.9); display: flex; align-items: center; justify-content: center; }
  .pt-ver img { max-width: 100%; max-height: 100%; }
`;

function estilos() {
  if (document.getElementById("pt-estilos")) return;
  const s = document.createElement("style");
  s.id = "pt-estilos"; s.textContent = CSS;
  document.head.appendChild(s);
}

export function verFotoGrande(src) {
  const v = document.createElement("div");
  v.className = "pt-ver";
  v.innerHTML = `<img alt="Foto del parte">`;
  v.querySelector("img").src = src;
  v.addEventListener("click", () => v.remove());
  document.body.appendChild(v);
}

// Dictado por voz (Chrome en Android y en el ordenador). Si el móvil no lo permite, el botón no aparece.
function prepararDictado(boton, area) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { boton.remove(); return; }
  let rec = null;
  boton.addEventListener("click", () => {
    if (rec) { rec.stop(); return; }
    rec = new SR();
    rec.lang = "es-ES"; rec.continuous = true; rec.interimResults = false;
    rec.onresult = e => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (!e.results[i].isFinal) continue;
        const t = e.results[i][0].transcript.trim();
        if (!t) continue;
        const antes = area.value.replace(/\s+$/, "");
        area.value = antes + (antes ? (/[.!?]$/.test(antes) ? " " : ". ") : "") + t.charAt(0).toUpperCase() + t.slice(1);
        area.dispatchEvent(new Event("input"));
      }
    };
    rec.onend = () => { rec = null; boton.classList.remove("oyendo"); boton.textContent = "🎤 Dictar"; };
    rec.onerror = () => { rec && rec.stop(); };
    rec.start();
    boton.classList.add("oyendo"); boton.textContent = "⏹ Parar";
  });
}

export async function renderParte(container, obra, perfil) {
  estilos();
  container.innerHTML = '<div class="loading">Cargando parte...</div>';
  const hoy = fechaLocal();
  let fecha = hoy;
  let obraDoc = {}, parte = null, fotos = [], estado = null, sinGuardar = false;

  try {
    const oSnap = await getDoc(doc(db, "obras", obra.id));
    obraDoc = oSnap.exists() ? oSnap.data() : {};
  } catch (err) {
    console.error(err);
    container.innerHTML = '<div class="card"><div class="placeholder">No se ha podido cargar. Revisa la conexión.</div></div>';
    return;
  }

  async function cargar() {
    container.innerHTML = '<div class="loading">Cargando parte...</div>';
    const r = await cargarParte(obra.id, fecha);
    parte = r.parte; fotos = r.fotos;
    const g = obraDoc.gestion || {};
    const fases = Array.isArray(g.fases) ? g.fases : [];
    // Estado de trabajo: lo guardado, o vacío (el avance parte del valor actual de la obra)
    estado = {
      trabajo: parte ? parte.trabajo || "" : "",
      falta: parte ? parte.falta || "" : "",
      incidencias: parte ? parte.incidencias || "" : "",
      notas: parte ? parte.notas || "" : "",
      urgente: false,
      fases: fases.map(f => ({ nombre: f.nombre || "", antes: Number(f.avance) || 0, ahora: Number(f.avance) || 0 })),
      avanceGeneral: fases.length ? null : { antes: Number(g.avanceManual) || 0, ahora: Number(g.avanceManual) || 0 }
    };
    sinGuardar = false;
    pintar();
  }

  function pintar() {
    const hecho = !!parte;
    const fasesHtml = estado.fases.length
      ? estado.fases.map((f, i) => `
          <div class="pt-fase">
            <div><div style="font-size:14px;">${esc(f.nombre || "Fase " + (i + 1))}</div>
              <input type="range" min="0" max="100" step="5" value="${f.ahora}" data-fase="${i}" aria-label="Avance de ${esc(f.nombre)}"></div>
            <div class="pct"><span data-pct="${i}">${f.ahora} %</span><br><span class="ant">antes ${f.antes} %</span></div>
          </div>`).join("")
      : `<div class="pt-fase">
          <div><div style="font-size:14px;">Avance general de la obra</div>
            <input type="range" min="0" max="100" step="5" value="${estado.avanceGeneral.ahora}" data-general="1" aria-label="Avance general"></div>
          <div class="pct"><span data-pct="g">${estado.avanceGeneral.ahora} %</span><br><span class="ant">antes ${estado.avanceGeneral.antes} %</span></div>
        </div>`;

    container.innerHTML = `
      <div class="card">
        <div style="display:flex;gap:10px;align-items:center;margin-bottom:12px;">
          <label for="ptFecha" style="margin:0;white-space:nowrap;">📋 Parte del</label>
          <input type="date" id="ptFecha" value="${fecha}" max="${hoy}" style="margin:0;">
        </div>
        <div class="pt-estado ${hecho ? "ok" : "pend"}">${hecho
          ? `✓ Parte enviado por ${esc(parte.autorNombre || "—")}${parte.actualizadoEn ? " · " + esc(parte.actualizadoEn.slice(11, 16)) : ""}. Puedes cambiarlo y volver a guardar.`
          : (fecha === hoy ? "Falta el parte de hoy." : "Este día no tiene parte.")}</div>

        <p class="pt-sec">🔨 Qué se ha hecho hoy <button type="button" class="pt-dictar" id="ptDictar">🎤 Dictar</button></p>
        <textarea class="pt-area" id="ptTrabajo" rows="5" placeholder="Ej.: Alicatado del baño terminado. Empezamos la regata de la cocina.">${esc(estado.trabajo)}</textarea>
      </div>

      <div class="card">
        <p class="pt-sec">📈 Avance <small>${estado.fases.length ? "por fases (se ve en el Panel de obras)" : "mueve la barra"}</small></p>
        ${fasesHtml}
      </div>

      <div class="card">
        <p class="pt-sec">📦 Falta o hay que pedir <small>una cosa por línea</small></p>
        <textarea class="pt-area" id="ptFalta" rows="3" placeholder="Ej.: 20 sacos de cemento cola&#10;Silicona blanca">${esc(estado.falta)}</textarea>
        <label class="check-row" style="margin-top:8px;"><input type="checkbox" id="ptUrgente"> Lo nuevo es urgente</label>
        <p style="font-size:12px;color:var(--text-muted);margin:4px 0 14px;">Cada línea se añade sola a "Se necesita".</p>

        <p class="pt-sec">⚠️ Incidencias <small>una por línea</small></p>
        <textarea class="pt-area" id="ptIncid" rows="2" placeholder="Ej.: El cliente quiere cambiar los azulejos de la cocina">${esc(estado.incidencias)}</textarea>
        <p style="font-size:12px;color:var(--text-muted);margin:4px 0 14px;">Cada línea se añade a "Incidencias" como abierta.</p>

        <p class="pt-sec">📝 Otras notas <small>visitas, entregas, cliente…</small></p>
        <textarea class="pt-area" id="ptNotas" rows="2">${esc(estado.notas)}</textarea>
      </div>

      <div class="card">
        <p class="pt-sec">📷 Fotos <small>${fotos.length} de ${MAX_FOTOS} · se guardan al momento</small></p>
        <div class="pt-fotos" id="ptFotos">
          ${fotos.map(f => `<div class="pt-foto"><img src="${f.data}" alt="Foto" data-id="${f.id}"><button type="button" data-borrar="${f.id}" aria-label="Quitar foto">✕</button></div>`).join("")}
          ${fotos.length < MAX_FOTOS ? `<label class="pt-anadir" for="ptFotoIn"><span>＋</span>Añadir fotos</label>` : ""}
        </div>
        ${parte && parte.fotosBorradas ? `<p style="font-size:12px;color:var(--text-muted);margin:8px 0 0;">${parte.fotosBorradas} foto(s) de este parte se borraron el ${fechaBonita(parte.fotosBorradasEn)} para liberar espacio.</p>` : ""}
        <input type="file" id="ptFotoIn" accept="image/*" multiple hidden>
        <p id="ptFotoMsg" style="font-size:12px;color:var(--text-muted);margin:8px 0 0;"></p>
      </div>

      <div class="error-msg" id="ptError"></div>
      <div class="pt-guardar">
        <button class="primary" id="ptGuardar">${hecho ? "Guardar cambios del parte" : "Enviar parte"}</button>
        ${hecho ? `<div style="display:flex;gap:16px;justify-content:center;margin-top:10px;">
          <button class="link-btn" id="ptPdf">ver PDF del parte</button>
          ${puedeGestionarFichajes(perfil) ? '<button class="link-btn" id="ptBorrar" style="color:var(--danger);">borrar parte</button>' : ""}
        </div>` : ""}
      </div>`;

    const $ = id => container.querySelector("#" + id);
    const marcar = () => { sinGuardar = true; };

    $("ptFecha").addEventListener("change", e => {
      if (!e.target.value) return;
      if (sinGuardar && !confirm("Hay cambios sin guardar en este parte. ¿Cambiar de día igualmente?")) { e.target.value = fecha; return; }
      fecha = e.target.value > hoy ? hoy : e.target.value;
      cargar();
    });
    [["ptTrabajo", "trabajo"], ["ptFalta", "falta"], ["ptIncid", "incidencias"], ["ptNotas", "notas"]].forEach(([id, k]) =>
      $(id).addEventListener("input", e => { estado[k] = e.target.value; marcar(); }));
    $("ptUrgente").addEventListener("change", e => { estado.urgente = e.target.checked; });
    prepararDictado($("ptDictar"), $("ptTrabajo"));
    container.querySelectorAll("[data-fase]").forEach(r => r.addEventListener("input", () => {
      const i = Number(r.dataset.fase);
      estado.fases[i].ahora = Number(r.value);
      container.querySelector(`[data-pct="${i}"]`).textContent = r.value + " %";
      marcar();
    }));
    const rg = container.querySelector("[data-general]");
    if (rg) rg.addEventListener("input", () => {
      estado.avanceGeneral.ahora = Number(rg.value);
      container.querySelector('[data-pct="g"]').textContent = rg.value + " %";
      marcar();
    });

    // Fotos: se suben al elegirlas para no perderlas si se cierra la app
    $("ptFotoIn").addEventListener("change", async e => {
      const files = [...e.target.files].slice(0, MAX_FOTOS - fotos.length);
      e.target.value = "";
      if (!files.length) return;
      const msg = $("ptFotoMsg");
      let orden = fotos.reduce((m, f) => Math.max(m, f.orden || 0), 0);
      for (let i = 0; i < files.length; i++) {
        msg.textContent = `Guardando foto ${i + 1} de ${files.length}...`;
        try {
          const f = await comprimirFotoObra(files[i]);
          const datos = { ...f, kb: kbDe(f.data), orden: ++orden, creadoEn: `${fechaLocal()} ${horaLocal()}`, autorNombre: perfil.nombre || "" };
          const ref = await addDoc(collection(db, "obras", obra.id, "partes", fecha, "fotos"), datos);
          fotos.push({ id: ref.id, ...datos });
        } catch (err) {
          console.error(err);
          msg.textContent = "Una foto no se ha podido guardar. Inténtalo otra vez.";
          await new Promise(r => setTimeout(r, 1500));
        }
      }
      await apuntarFotos();
      guardarTextosEnPantalla();
      pintar();
    });
    container.querySelectorAll("[data-borrar]").forEach(b => b.addEventListener("click", async () => {
      if (!confirm("¿Quitar esta foto del parte?")) return;
      try {
        await deleteDoc(doc(db, "obras", obra.id, "partes", fecha, "fotos", b.dataset.borrar));
        fotos = fotos.filter(f => f.id !== b.dataset.borrar);
        await apuntarFotos();
        guardarTextosEnPantalla();
        pintar();
      } catch (err) { console.error(err); alert("No se ha podido quitar. Inténtalo otra vez."); }
    }));
    container.querySelectorAll(".pt-foto img").forEach(img => img.addEventListener("click", () => verFotoGrande(img.src)));

    $("ptGuardar").addEventListener("click", guardar);
    if ($("ptPdf")) $("ptPdf").addEventListener("click", () => verPDFParte(parte, fotos, obra.nombre));
    if ($("ptBorrar")) $("ptBorrar").addEventListener("click", borrarParte);
  }

  // Lleva la cuenta de fotos y espacio en el parte (para poder limpiar fotos antiguas sin descargarlas todas)
  const resumenFotos = () => ({ numFotos: fotos.length, fotosKB: fotos.reduce((s, f) => s + (f.kb || kbDe(f.data)), 0) });
  async function apuntarFotos() {
    try {
      await setDoc(doc(db, "obras", obra.id, "partes", fecha), { fecha, obraId: obra.id, obraNombre: obra.nombre || "", ...resumenFotos() }, { merge: true });
    } catch (e) { console.error(e); }
  }

  // Mantiene lo escrito al repintar (p. ej. tras añadir fotos)
  function guardarTextosEnPantalla() {
    const q = id => container.querySelector("#" + id);
    if (q("ptTrabajo")) estado.trabajo = q("ptTrabajo").value;
    if (q("ptFalta")) estado.falta = q("ptFalta").value;
    if (q("ptIncid")) estado.incidencias = q("ptIncid").value;
    if (q("ptNotas")) estado.notas = q("ptNotas").value;
  }

  async function guardar() {
    guardarTextosEnPantalla();
    const err = container.querySelector("#ptError");
    err.style.display = "none";
    if (!estado.trabajo.trim()) {
      err.textContent = "Escribe qué se ha hecho hoy (aunque sea una línea).";
      err.style.display = "block";
      container.querySelector("#ptTrabajo").focus();
      return;
    }
    const btn = container.querySelector("#ptGuardar");
    btn.disabled = true; btn.textContent = "Guardando...";
    try {
      const ahora = `${fechaLocal()} ${horaLocal()}`;
      // Tareas e incidencias nuevas: solo las líneas que no se habían pasado antes
      const yaFalta = new Set(parte && parte.faltaCreadas || []);
      const yaInc = new Set(parte && parte.incidenciasCreadas || []);
      const nuevasFalta = lineas(estado.falta).filter(l => !yaFalta.has(l));
      const nuevasInc = lineas(estado.incidencias).filter(l => !yaInc.has(l));
      for (const l of nuevasFalta) {
        await addDoc(collection(db, "obras", obra.id, "necesidades"), {
          descripcion: l, tipo: "material", estado: "pendiente", prioridad: estado.urgente ? "urgente" : "normal",
          fechaNecesaria: null, fechaCreacion: fecha, origen: "parte"
        });
        yaFalta.add(l);
      }
      for (const l of nuevasInc) {
        await addDoc(collection(db, "obras", obra.id, "incidencias"), { descripcion: l, estado: "abierta", fecha, origen: "parte" });
        yaInc.add(l);
      }

      // Avance: se actualiza la ficha de la obra (Panel de obras) con lo que haya cambiado
      const cambios = estado.fases.filter(f => f.ahora !== f.antes);
      // Lo que ha avanzado en este parte: se guarda el valor de antes del primer guardado del día
      const previo = new Map((parte && parte.avance || []).map(a => [a.nombre, a.antes]));
      const lista = estado.fases.length
        ? estado.fases.map(f => ({ nombre: f.nombre, antes: f.antes, ahora: f.ahora }))
        : [{ nombre: "Avance general", antes: estado.avanceGeneral.antes, ahora: estado.avanceGeneral.ahora }];
      const avance = lista
        .map(a => ({ nombre: a.nombre, antes: previo.has(a.nombre) ? previo.get(a.nombre) : a.antes, ahora: a.ahora }))
        .filter(a => a.ahora !== a.antes);
      if (cambios.length || (estado.avanceGeneral && estado.avanceGeneral.ahora !== estado.avanceGeneral.antes)) {
        const fresco = await getDoc(doc(db, "obras", obra.id));
        const g = { ...((fresco.exists() && fresco.data().gestion) || {}) };
        if (estado.fases.length) {
          const fases = Array.isArray(g.fases) ? g.fases.map(f => ({ ...f })) : [];
          estado.fases.forEach(f => { const x = fases.find(y => y.nombre === f.nombre); if (x && f.ahora !== f.antes) x.avance = f.ahora; });
          g.fases = fases;
        } else g.avanceManual = estado.avanceGeneral.ahora;
        g.actualizado = fechaLocal();
        await updateDoc(doc(db, "obras", obra.id), { gestion: g });
        obraDoc.gestion = g;
      }

      const datos = {
        enviado: true,
        fecha, obraId: obra.id, obraNombre: obra.nombre || "",
        trabajo: estado.trabajo.trim(),
        falta: estado.falta.trim(), incidencias: estado.incidencias.trim(), notas: estado.notas.trim(),
        faltaCreadas: [...yaFalta], incidenciasCreadas: [...yaInc],
        avance,
        ...resumenFotos(),
        actualizadoEn: ahora, actualizadoPorNombre: perfil.nombre || ""
      };
      if (!parte) Object.assign(datos, {
        autorUid: auth.currentUser ? auth.currentUser.uid : "", autorNombre: perfil.nombre || "", creadoEn: ahora, registradoEn: serverTimestamp()
      });
      await setDoc(doc(db, "obras", obra.id, "partes", fecha), datos, { merge: true });
      parte = { ...(parte || {}), ...datos };
      // El nuevo punto de partida del avance es lo que se acaba de guardar
      estado.fases.forEach(f => { f.antes = f.ahora; });
      if (estado.avanceGeneral) estado.avanceGeneral.antes = estado.avanceGeneral.ahora;
      sinGuardar = false;
      pintar();
      const ok = container.querySelector(".pt-estado");
      ok.textContent = `✓ Parte guardado${nuevasFalta.length ? ` · ${nuevasFalta.length} cosa(s) añadida(s) a "Se necesita"` : ""}${nuevasInc.length ? ` · ${nuevasInc.length} incidencia(s) abierta(s)` : ""}.`;
      ok.scrollIntoView({ behavior: "smooth", block: "center" });
    } catch (e) {
      console.error(e);
      err.textContent = "No se ha podido guardar el parte. Revisa la conexión e inténtalo otra vez.";
      err.style.display = "block";
      btn.disabled = false; btn.textContent = parte ? "Guardar cambios del parte" : "Enviar parte";
    }
  }

  async function borrarParte() {
    if (!confirm(`¿Borrar el parte del ${fechaBonita(fecha)} con sus ${fotos.length} foto(s)? Lo que pasó a "Se necesita" e "Incidencias" se queda. No se puede deshacer.`)) return;
    try {
      for (const f of fotos) await deleteDoc(doc(db, "obras", obra.id, "partes", fecha, "fotos", f.id));
      await deleteDoc(doc(db, "obras", obra.id, "partes", fecha));
      cargar();
    } catch (e) { console.error(e); alert("No se ha podido borrar. Inténtalo otra vez."); }
  }

  window.addEventListener("beforeunload", e => { if (sinGuardar && container.querySelector("#ptGuardar")) { e.preventDefault(); e.returnValue = ""; } });
  await cargar();
}
