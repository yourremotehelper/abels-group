// Presupuestos: cálculos y PDF para el cliente (sin costes ni márgenes).
import { euros, fechaBonita } from "./registro.js";
import { EMPRESA, nuevoPDF, cabeceraPDF, parrafoPDF } from "./documentos.js";

export const UNIDADES = ["m²", "ml", "m³", "ud", "h", "kg", "pa"];
export const IVAS = [
  { v: 21, t: "IVA 21 %" },
  { v: 10, t: "IVA 10 %" },
  { v: 0, t: "Sin IVA" }
];
export const ESTADOS = { borrador: "Borrador", enviado: "Enviado", aceptado: "Aceptado", rechazado: "Rechazado" };

const r2 = n => Math.round((Number(n) || 0) * 100) / 100;
const num = n => {
  const v = Math.round((Number(n) || 0) * 100) / 100;
  return v.toLocaleString("es-ES", { maximumFractionDigits: 2, useGrouping: false }).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
};

export function calcularPresupuesto(p) {
  const porCapitulo = (p.capitulos || []).map(c => {
    let total = 0, coste = 0;
    (c.partidas || []).forEach(pa => {
      const cant = Number(pa.cant) || 0;
      total += cant * (Number(pa.precio) || 0);
      coste += cant * (Number(pa.coste) || 0);
    });
    return { nombre: c.nombre, total: r2(total), coste: r2(coste) };
  });
  const suma = r2(porCapitulo.reduce((s, c) => s + c.total, 0));
  const descuento = r2(suma * (Number(p.descuento) || 0) / 100);
  const base = r2(suma - descuento);
  const iva = r2(base * (Number(p.iva) || 0) / 100);
  const coste = r2(porCapitulo.reduce((s, c) => s + c.coste, 0));
  const beneficio = r2(base - coste);
  const sinCoste = (p.capitulos || []).reduce((s, c) => s + (c.partidas || []).filter(pa => Number(pa.precio) > 0 && !(Number(pa.coste) > 0)).length, 0);
  return { porCapitulo, suma, descuento, base, iva, total: r2(base + iva), coste, beneficio, margenPct: base ? beneficio / base * 100 : 0, sinCoste };
}

export function pdfPresupuesto(p, empresa = {}) {
  const pdf = nuevoPDF(), W = 210, M = 15, AN = W - 2 * M;
  const c = calcularPresupuesto(p);
  cabeceraPDF(pdf, "PRESUPUESTO", W, M);
  pdf.setFontSize(8.5); pdf.setTextColor(90);
  const contacto = [empresa.direccion, empresa.telefono, empresa.email].filter(Boolean).join(" · ");
  if (contacto) pdf.text(contacto, W - M, 32, { align: "right", maxWidth: 120 });
  pdf.setTextColor(0);

  // Número, fecha y validez
  let y = 44;
  pdf.setFont("helvetica", "bold"); pdf.setFontSize(10);
  pdf.text(`Nº ${p.numero}`, M, y);
  pdf.setFont("helvetica", "normal");
  pdf.text(`Fecha: ${fechaBonita(p.fecha)}${Number(p.validez) ? `   ·   Válido ${p.validez} días` : ""}`, M + 32, y);
  y += 5;

  // Cliente y obra
  const caja = (x, titulo, lineas) => {
    pdf.setDrawColor(220); pdf.setFillColor(250, 248, 245);
    pdf.roundedRect(x, y, AN / 2 - 3, 30, 2, 2, "FD");
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(8); pdf.setTextColor(150, 60, 29);
    pdf.text(titulo, x + 4, y + 6);
    pdf.setTextColor(0); pdf.setFontSize(9.5);
    let yy = y + 11.5;
    lineas.filter(Boolean).slice(0, 4).forEach((l, i) => {
      pdf.setFont("helvetica", i === 0 ? "bold" : "normal");
      pdf.text(pdf.splitTextToSize(String(l), AN / 2 - 11)[0], x + 4, yy);
      yy += 4.6;
    });
  };
  const cl = p.cliente || {}, ob = p.obra || {};
  caja(M, "CLIENTE", [cl.nombre || "—", cl.nif ? "NIF/CIF: " + cl.nif : "", cl.direccion, [cl.telefono, cl.email].filter(Boolean).join(" · ")]);
  caja(M + AN / 2 + 3, "OBRA", [ob.nombre || "—", ob.direccion]);
  y += 37;

  // Partidas por capítulo
  const body = [];
  (p.capitulos || []).forEach((cap, ci) => {
    body.push([{ content: `${ci + 1}. ${(cap.nombre || "Capítulo " + (ci + 1)).toUpperCase()}`, colSpan: 6,
      styles: { fontStyle: "bold", fillColor: [250, 236, 231], textColor: [120, 45, 20] } }]);
    (cap.partidas || []).forEach((pa, pi) => body.push([
      `${ci + 1}.${pi + 1}`, pa.desc || "", pa.ud || "", num(pa.cant), euros(pa.precio), euros((Number(pa.cant) || 0) * (Number(pa.precio) || 0))
    ]));
    body.push([{ content: `Total capítulo ${ci + 1}`, colSpan: 5, styles: { halign: "right", fontStyle: "bold" } },
      { content: euros(c.porCapitulo[ci].total), styles: { fontStyle: "bold" } }]);
  });
  pdf.autoTable({
    startY: y, margin: { left: M, right: M, top: 18, bottom: 16 },
    head: [["Nº", "Descripción", "Ud", "Cantidad", "Precio", "Importe"]],
    body,
    styles: { fontSize: 8.8, cellPadding: 1.8, valign: "top", lineColor: [230, 226, 220], lineWidth: 0.1 },
    headStyles: { fillColor: [216, 90, 48], textColor: 255 },
    columnStyles: { 0: { cellWidth: 11, textColor: 120 }, 2: { cellWidth: 11, halign: "center" }, 3: { cellWidth: 19, halign: "right" }, 4: { cellWidth: 23, halign: "right" }, 5: { cellWidth: 26, halign: "right" } },
    theme: "grid"
  });
  y = pdf.lastAutoTable.finalY + 6;

  // Resumen y totales
  const filasTot = [];
  if (c.porCapitulo.length > 1) c.porCapitulo.forEach((x, i) => filasTot.push([`${i + 1}. ${x.nombre || "Capítulo " + (i + 1)}`, euros(x.total)]));
  if (c.descuento) {
    filasTot.push([{ content: "Suma", styles: { fontStyle: "bold" } }, { content: euros(c.suma), styles: { fontStyle: "bold" } }]);
    filasTot.push([`Descuento ${num(p.descuento)} %`, "-" + euros(c.descuento)]);
  }
  filasTot.push([{ content: "Base imponible", styles: { fontStyle: "bold" } }, { content: euros(c.base), styles: { fontStyle: "bold" } }]);
  filasTot.push([Number(p.iva) ? `IVA ${num(p.iva)} %` : "IVA (no incluido / exento)", euros(c.iva)]);
  filasTot.push([{ content: "TOTAL", styles: { fontStyle: "bold", fontSize: 12, fillColor: [216, 90, 48], textColor: 255 } },
    { content: euros(c.total), styles: { fontStyle: "bold", fontSize: 12, fillColor: [216, 90, 48], textColor: 255 } }]);
  if (y > 230) { pdf.addPage(); y = 20; }
  pdf.autoTable({
    startY: y, margin: { left: W - M - 95, right: M },
    body: filasTot, theme: "plain",
    styles: { fontSize: 9.5, cellPadding: 1.8 },
    columnStyles: { 1: { halign: "right", cellWidth: 32 } }
  });
  y = pdf.lastAutoTable.finalY + 8;

  // Condiciones
  if ((p.condiciones || "").trim()) {
    if (y > 245) { pdf.addPage(); y = 20; }
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(10);
    pdf.text("Condiciones", M, y);
    y = parrafoPDF(pdf, p.condiciones.trim(), M, y + 5, AN, 8.8) + 4;
  }

  // Aceptación
  if (y > 240) { pdf.addPage(); y = 25; }
  pdf.setFontSize(9); pdf.setFont("helvetica", "normal");
  pdf.text("Aceptación del presupuesto: firma, nombre y fecha.", M, y + 4);
  y += 26;
  pdf.setDrawColor(120);
  pdf.line(M, y, M + 75, y);
  pdf.line(W - M - 75, y, W - M, y);
  pdf.setFontSize(8.5);
  pdf.text("Conforme, el cliente", M, y + 5);
  pdf.text(cl.nombre || "", M, y + 9.5);
  pdf.text(`Por ${EMPRESA.nombre}`, W - M - 75, y + 5);

  const n = pdf.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    pdf.setPage(i); pdf.setFontSize(7.5); pdf.setTextColor(140);
    pdf.text(`${EMPRESA.nombre} · CIF ${EMPRESA.cif} · Presupuesto nº ${p.numero} · página ${i} de ${n}`, W / 2, 290, { align: "center" });
    pdf.setTextColor(0);
  }
  return pdf;
}
