// Vista previa de cualquier documento antes de descargarlo.
// Uso:
//   const ok = await vistaPrevia({ titulo, documentos: [{ nombre, pdf }], botonDescargar, onDescargar });
//   const ok = await vistaPrevia({ titulo, tablas: [{ nombre, filas: [[...], ...] }], onDescargar });
// Devuelve true si se ha descargado y false si se ha cerrado para corregir.
// Los PDF se dibujan página a página (pdf.js), así se ven igual en el ordenador y en el móvil.

const PDFJS = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
const PDFJS_WORKER = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

let cargandoPdfjs = null;
function cargarPdfjs() {
  if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  cargandoPdfjs ||= new Promise((ok, mal) => {
    const s = document.createElement("script");
    s.src = PDFJS;
    s.onload = () => { window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER; ok(window.pdfjsLib); };
    s.onerror = () => { cargandoPdfjs = null; mal(new Error("pdf.js")); };
    document.head.appendChild(s);
  });
  return cargandoPdfjs;
}

function estilos() {
  if (document.getElementById("vp-estilos")) return;
  const st = document.createElement("style");
  st.id = "vp-estilos";
  st.textContent = `
    .vp-fondo { position: fixed; inset: 0; z-index: 1000; background: rgba(30,28,26,.55); display: flex; align-items: center; justify-content: center; padding: 16px; }
    .vp-caja { background: var(--surface, #fff); color: var(--text, #222); border-radius: 14px; width: min(980px, 100%); height: min(92vh, 100%); display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,.25); }
    .vp-cab { display: flex; align-items: center; gap: 10px; padding: 12px 16px; border-bottom: 1px solid var(--border, #e4e1da); flex-wrap: wrap; }
    .vp-cab h2 { font-size: 16px; margin: 0; flex: 1; min-width: 160px; }
    .vp-cab select { width: auto; max-width: 100%; margin: 0; height: 38px; }
    .vp-cuerpo { flex: 1; overflow: auto; background: #E9E6E1; padding: 16px; }
    .vp-cuerpo canvas { display: block; margin: 0 auto 14px; max-width: 100%; height: auto !important; background: #fff; box-shadow: 0 1px 6px rgba(0,0,0,.18); }
    .vp-cuerpo iframe { width: 100%; height: 100%; border: 0; background: #fff; }
    .vp-tabla { background: #fff; border-radius: 6px; overflow: auto; display: inline-block; max-width: 100%; vertical-align: top; }
    .vp-tabla table { border-collapse: collapse; font-size: 12px; }
    .vp-tabla td { border: 1px solid #E4E1DA; padding: 4px 8px; white-space: nowrap; font-variant-numeric: tabular-nums; }
    .vp-tabla tr.vp-cabecera td { background: #D85A30; color: #fff; font-weight: 600; }
    .vp-tabla tr.vp-negrita td { font-weight: 700; }
    .vp-tabla tr.vp-titulo td { white-space: normal; }
    .vp-pestanas { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 10px; }
    .vp-pestanas button { font: inherit; font-size: 13px; padding: 6px 12px; border-radius: 16px; border: 1px solid var(--border, #ddd); background: #fff; cursor: pointer; }
    .vp-pestanas button.activa { background: #D85A30; color: #fff; border-color: #D85A30; }
    .vp-pie { display: flex; gap: 10px; justify-content: flex-end; align-items: center; padding: 12px 16px; border-top: 1px solid var(--border, #e4e1da); flex-wrap: wrap; }
    .vp-pie .vp-nota { flex: 1; font-size: 12px; color: var(--text-muted, #888); min-width: 180px; }
    .vp-pie button { width: auto; height: 42px; padding: 0 18px; margin: 0; }
    .vp-cargando { text-align: center; color: #6b6a66; padding: 40px 0; font-size: 14px; }
    @media (max-width: 600px) {
      .vp-fondo { padding: 0; }
      .vp-caja { border-radius: 0; height: 100%; }
      .vp-cuerpo { padding: 8px; }
      .vp-pie button { flex: 1; }
    }`;
  document.head.appendChild(st);
}

const escapar = t => String(t ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

async function pintarPDF(cont, pdf) {
  cont.innerHTML = '<div class="vp-cargando">Preparando la vista previa...</div>';
  try {
    const lib = await cargarPdfjs();
    const datos = pdf.output("arraybuffer");
    const docu = await lib.getDocument({ data: new Uint8Array(datos) }).promise;
    cont.innerHTML = "";
    const ancho = Math.min(cont.clientWidth - 16, 820);
    for (let n = 1; n <= docu.numPages; n++) {
      const pag = await docu.getPage(n);
      const base = pag.getViewport({ scale: 1 });
      const escala = (ancho / base.width) * (window.devicePixelRatio || 1);
      const vp = pag.getViewport({ scale: escala });
      const c = document.createElement("canvas");
      c.width = vp.width; c.height = vp.height;
      c.style.width = ancho + "px";
      cont.appendChild(c);
      await pag.render({ canvasContext: c.getContext("2d"), viewport: vp }).promise;
    }
  } catch (err) {
    // Si no se puede cargar el visor, se usa el del navegador
    console.error(err);
    const url = URL.createObjectURL(pdf.output("blob"));
    cont.innerHTML = "";
    const f = document.createElement("iframe");
    f.src = url;
    f.title = "Vista previa";
    cont.appendChild(f);
  }
}

function pintarTabla(cont, tabla) {
  const filas = tabla ? tabla.filas : [];
  const cab = new Set(tabla && tabla.cabeceras ? tabla.cabeceras : [0]);
  const ancho = Math.max(1, ...filas.map(f => (f || []).length));
  const html = filas.map((fila, i) => {
    fila = fila || [];
    const clase = `${cab.has(i) ? "vp-cabecera" : ""}${tabla && tabla.negritas && tabla.negritas.includes(i) ? " vp-negrita" : ""}`;
    // Filas de título (solo la primera celda con texto): ocupan todo el ancho
    if (!cab.has(i) && fila.slice(1).every(v => v === "" || v === undefined)) {
      return `<tr class="${clase} vp-titulo"><td colspan="${ancho}">${escapar(fila[0] ?? "")}</td></tr>`;
    }
    return `<tr class="${clase}">${fila.map(v => `<td>${escapar(v)}</td>`).join("")}</tr>`;
  }).join("");
  cont.innerHTML = `<div class="vp-tabla"><table>${html}</table></div>`;
}

export function vistaPrevia({ titulo = "Vista previa", documentos = [], tablas = [], botonDescargar, nota, onDescargar }) {
  estilos();
  return new Promise(resolve => {
    const fondo = document.createElement("div");
    fondo.className = "vp-fondo";
    const variosDocs = documentos.length > 1;
    const textoBoton = botonDescargar || (variosDocs ? `Descargar los ${documentos.length}` : "Descargar");
    fondo.innerHTML = `
      <div class="vp-caja" role="dialog" aria-modal="true" aria-label="${escapar(titulo)}">
        <div class="vp-cab">
          <h2>👁️ ${escapar(titulo)}</h2>
          ${variosDocs ? `<select class="campo vp-sel" aria-label="Documento">${documentos.map((d, i) => `<option value="${i}">${i + 1}. ${escapar(d.nombre)}</option>`).join("")}</select>` : ""}
        </div>
        <div class="vp-cuerpo"></div>
        <div class="vp-pie">
          <span class="vp-nota">${escapar(nota || "Revísalo. Si hay que corregir algo, cierra, cámbialo y vuelve a generarlo.")}</span>
          <button class="secondary vp-cerrar">Cerrar y corregir</button>
          <button class="primary vp-descargar">${escapar(textoBoton)}</button>
        </div>
      </div>`;
    document.body.appendChild(fondo);
    const cuerpo = fondo.querySelector(".vp-cuerpo");
    const anteriorOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const cerrar = valor => {
      document.removeEventListener("keydown", tecla);
      document.body.style.overflow = anteriorOverflow;
      fondo.remove();
      resolve(valor);
    };
    const tecla = e => { if (e.key === "Escape") cerrar(false); };
    document.addEventListener("keydown", tecla);
    fondo.addEventListener("click", e => { if (e.target === fondo) cerrar(false); });
    fondo.querySelector(".vp-cerrar").addEventListener("click", () => cerrar(false));
    fondo.querySelector(".vp-descargar").addEventListener("click", async e => {
      const b = e.currentTarget;
      b.disabled = true;
      b.textContent = "Descargando...";
      try { await onDescargar(); cerrar(true); }
      catch (err) { console.error(err); b.disabled = false; b.textContent = textoBoton; alert("No se ha podido descargar. Inténtalo otra vez."); }
    });

    if (documentos.length) {
      const sel = fondo.querySelector(".vp-sel");
      const ver = i => pintarPDF(cuerpo, documentos[i].pdf);
      if (sel) sel.addEventListener("change", () => ver(Number(sel.value)));
      ver(0);
    } else {
      const pest = tablas.length > 1
        ? `<div class="vp-pestanas">${tablas.map((t, i) => `<button data-i="${i}" class="${i === 0 ? "activa" : ""}">${escapar(t.nombre)}</button>`).join("")}</div>` : "";
      cuerpo.innerHTML = pest + '<div class="vp-hoja"></div>';
      const hoja = cuerpo.querySelector(".vp-hoja");
      pintarTabla(hoja, tablas[0]);
      cuerpo.querySelectorAll(".vp-pestanas button").forEach(b => b.addEventListener("click", () => {
        cuerpo.querySelectorAll(".vp-pestanas button").forEach(x => x.classList.toggle("activa", x === b));
        pintarTabla(hoja, tablas[Number(b.dataset.i)]);
      }));
    }
  });
}

// Convierte un libro de ExcelJS en tablas para la vista previa (muestra los resultados, no las fórmulas)
export function tablasDeExcelJS(wb) {
  const texto = (v, fmt) => {
    if (v === null || v === undefined) return "";
    if (v instanceof Date) return v.toISOString().slice(0, 10).split("-").reverse().join("/");
    if (typeof v === "object") {
      if ("result" in v) return texto(v.result, fmt);
      if (v.richText) return v.richText.map(r => r.text).join("");
      if ("text" in v) return v.text;
      return "";
    }
    if (typeof v === "number") {
      const eur = fmt && fmt.includes("€");
      const n = v.toLocaleString("es-ES", { minimumFractionDigits: eur ? 2 : 0, maximumFractionDigits: 2, useGrouping: true });
      return eur ? n + " €" : n;
    }
    return String(v);
  };
  const tablas = [];
  wb.eachSheet(ws => {
    const filas = [], cabeceras = [], negritas = [];
    let columnas = 0;
    ws.eachRow({ includeEmpty: true }, row => { columnas = Math.max(columnas, row.cellCount); });
    ws.eachRow({ includeEmpty: true }, (row, n) => {
      const f = [];
      let relleno = false, negrita = false;
      for (let c = 1; c <= columnas; c++) {
        const cell = row.getCell(c);
        // En celdas combinadas solo se muestra el valor una vez
        f.push(cell.isMerged && cell.master && cell.master !== cell ? "" : texto(cell.value, cell.numFmt));
        if (cell.fill && cell.fill.fgColor && cell.fill.fgColor.argb === "FFD85A30") relleno = true;
        if (cell.font && cell.font.bold) negrita = true;
      }
      filas[n - 1] = f;
      if (relleno) cabeceras.push(n - 1); else if (negrita) negritas.push(n - 1);
    });
    tablas.push({ nombre: ws.name, filas: Array.from(filas, f => f || []), cabeceras, negritas });
  });
  return tablas;
}
