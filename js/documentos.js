// Piezas comunes de los documentos en PDF (recibís, vacaciones): datos de la empresa, cabecera con logo y firmas.
import { db } from "./firebase-config.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { LOGO } from "./logo.js";

export const EMPRESA = {
  nombre: "Reformas Abel Group S.L.",
  cif: "B07887375"
};

// Lugar de firma guardado por la oficina (p. ej. "Palma"). Si no se puede leer, queda en blanco para rellenar a mano.
export async function cargarLugar() {
  try {
    const snap = await getDoc(doc(db, "tarifas", "_empresa"));
    return (snap.exists() && snap.data().lugar) || "";
  } catch {
    return "";
  }
}

export async function guardarLugar(lugar) {
  await setDoc(doc(db, "tarifas", "_empresa"), { lugar }, { merge: true });
}

export function nuevoPDF() {
  const { jsPDF } = window.jspdf;
  return new jsPDF({ unit: "mm", format: "a4" });
}

// Logo a la izquierda; título, empresa y CIF a la derecha
export function cabeceraPDF(pdf, titulo, W = 210, M = 18) {
  const alto = 24, ancho = alto * LOGO.ancho / LOGO.alto;
  try { pdf.addImage(LOGO.data, "JPEG", M, 10, ancho, alto); } catch (e) { console.error(e); }
  pdf.setFont("helvetica", "bold"); pdf.setFontSize(18);
  pdf.text(titulo, W - M, 22, { align: "right" });
  pdf.setFont("helvetica", "normal"); pdf.setFontSize(9);
  pdf.text(`${EMPRESA.nombre} · CIF ${EMPRESA.cif}`, W - M, 28, { align: "right" });
}

// Lugar y fecha, y las dos firmas (trabajador y empresa)
export function firmasPDF(pdf, y, nombreTrabajador, lugar, fechaTxt, W = 210, M = 18) {
  if (y > 240) { pdf.addPage(); y = 30; }
  pdf.setFontSize(11);
  pdf.text(`En ${lugar || "________________"}, a ${fechaTxt}`, M, y);
  y += 28;
  pdf.line(M, y, M + 70, y);
  pdf.line(W - M - 70, y, W - M, y);
  pdf.setFontSize(9);
  pdf.text("Firma del trabajador", M, y + 5);
  pdf.text(nombreTrabajador, M, y + 10);
  pdf.text(`Por ${EMPRESA.nombre}`, W - M - 70, y + 5);
  return y + 14;
}

// Texto corrido con saltos de línea automáticos; devuelve la altura final
export function parrafoPDF(pdf, texto, x, y, ancho, tam = 11) {
  pdf.setFont("helvetica", "normal"); pdf.setFontSize(tam);
  const lineas = pdf.splitTextToSize(texto, ancho);
  pdf.text(lineas, x, y, { lineHeightFactor: 1.5 });
  return y + lineas.length * tam * 0.3528 * 1.5;
}
