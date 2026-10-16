// Cálculos del panel de obras: avance, plazos, costes, cobros y avisos.
// Sin dependencias (se puede probar fuera del navegador).
// Todos los importes son SIN IVA.

export const ESTADOS = {
  presupuesto: "Presupuestada",
  porEmpezar: "Por empezar",
  enCurso: "En curso",
  parada: "Parada",
  terminada: "Terminada"
};

export const FASES_TIPICAS = [
  "Demoliciones",
  "Instalaciones (fontanería y electricidad)",
  "Albañilería y tabiquería",
  "Alicatados y solados",
  "Carpintería y cristalería",
  "Pintura",
  "Limpieza y entrega"
];

const DIA = 86400000;
const num = (v) => (v === "" || v === null || v === undefined || isNaN(Number(v)) ? 0 : Number(v));
const fecha = (t) => (t ? new Date(t + "T12:00:00") : null);
const dias = (a, b) => Math.round((b - a) / DIA);

// Horas de un fichaje: se usa la función de la app (descuenta la pausa) si se pasa; si no, salida - entrada
function horasFichaje(f, horasTrabajadas) {
  if (!f.horaEntrada || !f.horaSalida) return 0;
  if (horasTrabajadas) return Math.max(0, Number(horasTrabajadas(f.horaEntrada, f.horaSalida)) || 0);
  const [a, b] = f.horaEntrada.split(":").map(Number);
  const [c, d] = f.horaSalida.split(":").map(Number);
  return Math.max(0, (c * 60 + d - a * 60 - b) / 60);
}

export function gestionPorDefecto(g = {}) {
  return {
    estado: "enCurso", cliente: "", telefono: "", fechaInicio: "", fechaFinPrevista: "", fechaFinReal: "",
    venta: "", costePrevisto: "", avanceManual: "", fases: [], cobros: [], notas: "",
    ...g,
    fases: Array.isArray(g.fases) ? g.fases : [],
    cobros: Array.isArray(g.cobros) ? g.cobros : []
  };
}

/**
 * obra: { id, nombre, direccion, gestion }
 * d: { fichajes, gastos, necesidades, incidencias }
 * op: { hoy: "2026-10-16", costeHora: (empleadoId) => €/h, horasTrabajadas?: fn }
 */
export function calcularObra(obra, d, op) {
  const g = gestionPorDefecto(obra.gestion);
  const hoy = fecha(op.hoy);
  const hace7 = new Date(hoy.getTime() - 6 * DIA);
  const r = { id: obra.id, nombre: obra.nombre || "Sin nombre", direccion: obra.direccion || "", g, estado: g.estado };

  // --- Personal y horas ---
  let horas = 0, horas7 = 0, costeMO = 0, ultima = null;
  const personas7 = new Set();
  const porTrabajador = {};
  for (const f of d.fichajes || []) {
    const h = horasFichaje(f, op.horasTrabajadas);
    horas += h;
    costeMO += h * num(op.costeHora(f.empleadoId));
    const fd = fecha(f.fecha);
    if (fd && fd >= hace7 && fd <= hoy) { horas7 += h; personas7.add(f.empleadoId || f.empleadoNombre); }
    if (f.fecha && (!ultima || f.fecha > ultima)) ultima = f.fecha;
    const k = f.empleadoId || f.empleadoNombre || "?";
    porTrabajador[k] = porTrabajador[k] || { nombre: f.empleadoNombre || "Sin nombre", horas: 0, dias: 0, coste: 0 };
    porTrabajador[k].horas += h;
    porTrabajador[k].dias += 1;
    porTrabajador[k].coste += h * num(op.costeHora(f.empleadoId));
  }
  r.horas = horas; r.horas7 = horas7; r.personas7 = personas7.size; r.costeMO = costeMO;
  r.trabajadores = Object.values(porTrabajador).sort((a, b) => b.horas - a.horas);

  // --- Gastos ---
  r.gastos = (d.gastos || []).reduce((s, x) => s + num(x.importe), 0);
  for (const x of d.gastos || []) if (x.fecha && (!ultima || x.fecha > ultima)) ultima = x.fecha;
  r.ultimosGastos = [...(d.gastos || [])].sort((a, b) => String(b.fecha).localeCompare(String(a.fecha))).slice(0, 5);
  r.ultimaActividad = ultima;
  r.costeReal = r.costeMO + r.gastos;

  // --- Avance ---
  if (g.fases.length) r.avance = g.fases.reduce((s, f) => s + Math.min(100, Math.max(0, num(f.avance))), 0) / g.fases.length;
  else r.avance = Math.min(100, Math.max(0, num(g.avanceManual)));
  if (g.estado === "terminada") r.avance = 100;

  // --- Plazo ---
  const ini = fecha(g.fechaInicio), fin = fecha(g.fechaFinPrevista);
  r.tiempo = null; r.diasRestantes = null;
  if (ini && fin && fin > ini) {
    r.tiempo = Math.min(100, Math.max(0, ((hoy - ini) / (fin - ini)) * 100));
    r.diasRestantes = dias(hoy, fin);
  } else if (fin) r.diasRestantes = dias(hoy, fin);

  // --- Dinero ---
  r.venta = num(g.venta);
  r.costePrevisto = num(g.costePrevisto);
  r.margenPrevisto = r.venta && r.costePrevisto ? r.venta - r.costePrevisto : null;
  r.consumo = r.costePrevisto ? (r.costeReal / r.costePrevisto) * 100 : null;
  // Coste al terminar: con suficiente avance se proyecta lo gastado; si no, se toma el previsto
  r.costeEstimado = r.avance >= 15 ? r.costeReal / (r.avance / 100) : Math.max(r.costePrevisto, r.costeReal);
  r.margenEstimado = r.venta ? r.venta - r.costeEstimado : null;

  // --- Cobros ---
  r.cobrado = 0; r.vencido = 0; r.cobrosVencidos = []; r.proximoCobro = null;
  for (const c of g.cobros) {
    if (c.cobrado) r.cobrado += num(c.importe);
    else if (c.fechaPrevista && fecha(c.fechaPrevista) < hoy) { r.vencido += num(c.importe); r.cobrosVencidos.push(c); }
    else if (c.fechaPrevista && (!r.proximoCobro || c.fechaPrevista < r.proximoCobro.fechaPrevista)) r.proximoCobro = c;
  }
  r.pendienteCobro = Math.max(0, r.venta - r.cobrado);
  r.cobradoPct = r.venta ? (r.cobrado / r.venta) * 100 : null;

  // --- Pendientes ---
  const nec = d.necesidades || [];
  r.urgentes = nec.filter((n) => n.prioridad === "urgente" && n.estado !== "hecho");
  r.tareas = nec.filter((n) => n.tipo !== "material");
  r.tareasHechas = r.tareas.filter((n) => n.estado === "hecho").length;
  r.materiales = nec.filter((n) => n.tipo === "material" && n.estado !== "hecho");
  r.vencidas = nec.filter((n) => n.estado !== "hecho" && n.fechaNecesaria && fecha(n.fechaNecesaria) < hoy);
  r.incidencias = (d.incidencias || []).filter((i) => i.estado !== "resuelta");
  r.incidenciasViejas = r.incidencias.filter((i) => i.fecha && dias(fecha(i.fecha), hoy) > 3);

  r.alertas = avisos(r, hoy);
  r.nivel = r.alertas.some((a) => a.nivel === "alta") ? "alta" : r.alertas.some((a) => a.nivel === "media") ? "media" : "ok";
  return r;
}

function avisos(r, hoy) {
  const a = [];
  const activa = r.estado === "enCurso" || r.estado === "parada";
  const eur = (n) => { const v = Math.round(n); return (v < 0 ? "-" : "") + String(Math.abs(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ".") + " €"; };
  if (activa && r.diasRestantes !== null && r.diasRestantes < 0)
    a.push({ nivel: "alta", tipo: "plazo", texto: `Fuera de plazo: ${-r.diasRestantes} día${r.diasRestantes === -1 ? "" : "s"} de retraso (avance ${Math.round(r.avance)} %)` });
  else if (activa && r.tiempo !== null && r.avance < r.tiempo - 15)
    a.push({ nivel: "media", tipo: "plazo", texto: `Va lenta: ${Math.round(r.avance)} % hecho con el ${Math.round(r.tiempo)} % del plazo consumido` });
  if (r.consumo !== null && r.consumo > 100)
    a.push({ nivel: "alta", tipo: "coste", texto: `Coste superado: ${eur(r.costeReal)} de ${eur(r.costePrevisto)} previstos (${Math.round(r.consumo)} %)` });
  else if (activa && r.consumo !== null && r.consumo > r.avance + 10)
    a.push({ nivel: "media", tipo: "coste", texto: `Gasta más rápido de lo que avanza: ${Math.round(r.consumo)} % del coste para un ${Math.round(r.avance)} % de avance` });
  if (r.margenEstimado !== null && r.margenPrevisto !== null && r.margenEstimado < 0)
    a.push({ nivel: "alta", tipo: "coste", texto: `Al ritmo actual acabaría en pérdidas (${eur(r.margenEstimado)})` });
  if (r.vencido > 0)
    a.push({ nivel: "alta", tipo: "cobro", texto: `Cobro vencido: ${eur(r.vencido)} (${r.cobrosVencidos.map((c) => c.concepto || "sin concepto").join(", ")})` });
  if (r.estado === "terminada" && r.pendienteCobro > 0.5)
    a.push({ nivel: "alta", tipo: "cobro", texto: `Terminada con ${eur(r.pendienteCobro)} sin cobrar` });
  if (r.incidenciasViejas.length)
    a.push({ nivel: "alta", tipo: "incidencia", texto: `${r.incidenciasViejas.length} incidencia${r.incidenciasViejas.length > 1 ? "s" : ""} abierta${r.incidenciasViejas.length > 1 ? "s" : ""} hace más de 3 días` });
  else if (r.incidencias.length)
    a.push({ nivel: "media", tipo: "incidencia", texto: `${r.incidencias.length} incidencia${r.incidencias.length > 1 ? "s" : ""} abierta${r.incidencias.length > 1 ? "s" : ""}` });
  if (r.urgentes.length)
    a.push({ nivel: "alta", tipo: "pendiente", texto: `${r.urgentes.length} pendiente${r.urgentes.length > 1 ? "s" : ""} urgente${r.urgentes.length > 1 ? "s" : ""}: ${r.urgentes.slice(0, 2).map((n) => n.descripcion).join(", ")}${r.urgentes.length > 2 ? "…" : ""}` });
  if (r.vencidas.length)
    a.push({ nivel: "media", tipo: "pendiente", texto: `${r.vencidas.length} tarea${r.vencidas.length > 1 ? "s" : ""} o material${r.vencidas.length > 1 ? "es" : ""} con la fecha pasada` });
  if (r.estado === "enCurso" && r.ultimaActividad) {
    const sin = dias(new Date(r.ultimaActividad + "T12:00:00"), hoy);
    if (sin >= 5) a.push({ nivel: "media", tipo: "actividad", texto: `Sin actividad registrada desde hace ${sin} días` });
  }
  if (r.estado === "enCurso" && (!r.venta || !r.g.fechaFinPrevista))
    a.push({ nivel: "info", tipo: "datos", texto: "Faltan datos de gestión (presupuesto o fecha de fin)" });
  return a;
}

// Totales de un conjunto de obras ya calculadas
export function totales(lista) {
  const t = { obras: lista.length, enCurso: 0, venta: 0, costeReal: 0, costePrevisto: 0, cobrado: 0, pendienteCobro: 0, vencido: 0,
    margenPrevisto: 0, margenEstimado: 0, incidencias: 0, urgentes: 0, horas7: 0, alertasAltas: 0 };
  for (const r of lista) {
    if (r.estado === "enCurso") t.enCurso++;
    t.venta += r.venta; t.costeReal += r.costeReal; t.costePrevisto += r.costePrevisto;
    t.cobrado += r.cobrado; t.pendienteCobro += r.pendienteCobro; t.vencido += r.vencido;
    t.margenPrevisto += r.margenPrevisto || 0; t.margenEstimado += r.margenEstimado || 0;
    t.incidencias += r.incidencias.length; t.urgentes += r.urgentes.length; t.horas7 += r.horas7;
    t.alertasAltas += r.alertas.filter((a) => a.nivel === "alta").length;
  }
  return t;
}
