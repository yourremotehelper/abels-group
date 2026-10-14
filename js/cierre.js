// Cierre de jornada del encargado: confirma quién ha estado en la obra,
// pone la hora de salida y apunta las horas extra (separadas de las normales).
import { db, auth } from "./firebase-config.js";
import {
  collection, getDocs, query, where, doc, setDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  fechaLocal, horaLocal, fechaBonita, esc, avatar, cargarConfig, extraSugerida, horasTrabajadas,
  horasDelDia, textoHoras, cargarAusenciasDelDia, TIPOS_AUSENCIA, registrarHistorial
} from "./registro.js";

export async function renderCierre(container, obraId, perfil = {}) {
  container.innerHTML = '<div class="loading">Cargando cierre...</div>';
  const cfg = await cargarConfig();
  let fecha = fechaLocal();
  let filas = [];
  let sinFichar = [];

  async function cargar() {
    const [fichSnap, empSnap, ausencias] = await Promise.all([
      getDocs(query(collection(db, "obras", obraId, "fichajes"), where("fecha", "==", fecha))),
      getDocs(query(collection(db, "empleados"), where("obraAsignada", "==", obraId))),
      cargarAusenciasDelDia(fecha)
    ]);
    const empleados = {};
    empSnap.forEach(d => { empleados[d.id] = { id: d.id, ...d.data() }; });

    filas = fichSnap.docs.map(d => {
      const f = { docId: d.id, ...d.data() };
      const salida = f.horaSalida || cfg.horaSalida;
      return {
        f,
        emp: empleados[f.empleadoId] || { nombre: f.empleadoNombre },
        presente: f.presenciaConfirmada !== false,
        salida,
        extra: f.horasExtra !== undefined && f.horasExtra !== null ? Number(f.horasExtra) : extraSugerida(fecha, f.horaEntrada, salida, cfg),
        extraTocada: f.horasExtra !== undefined && f.horasExtra !== null
      };
    }).sort((a, b) => (a.f.empleadoNombre || "").localeCompare(b.f.empleadoNombre || ""));

    const fichados = new Set(filas.map(x => x.f.empleadoId));
    sinFichar = Object.values(empleados)
      .filter(e => e.activo !== false && !fichados.has(e.id))
      .map(e => ({ emp: e, ausencia: ausencias[e.id] || null }))
      .sort((a, b) => (a.emp.nombre || "").localeCompare(b.emp.nombre || ""));
  }

  function pintar() {
    const cerradas = filas.filter(x => x.f.cerradoPorNombre).length;
    let html = `
      <div class="card">
        <div style="display:flex;gap:10px;align-items:center;margin-bottom:6px;">
          <label for="cierreFecha" style="margin:0;">Día</label>
          <input type="date" id="cierreFecha" value="${fecha}" max="${fechaLocal()}" style="margin:0;">
        </div>
        <p style="font-size:12px;color:var(--text-muted);margin:0;">
          Jornada de ese día: ${textoHoras(horasDelDia(fecha, cfg))}${cfg.configurada ? "" : " (provisional)"}.
          Desmarca a quien no haya estado en la obra. Las horas extra se proponen solas; corrígelas si hace falta.
        </p>
      </div>`;

    if (filas.length === 0) {
      html += '<div class="card"><div class="placeholder">Nadie ha fichado entrada en esta obra ese día.</div></div>';
    } else {
      html += '<div class="card" id="cierreLista">' + filas.map((x, i) => `
        <div class="cierre-fila" data-i="${i}" style="padding:12px 0;border-bottom:1px solid var(--border);${x.presente ? "" : "opacity:0.6;"}">
          <div style="display:flex;align-items:center;gap:10px;">
            ${avatar(x.emp, 40)}
            <div style="flex:1;min-width:0;">
              <p class="obra-name" style="font-size:15px;">${esc(x.f.empleadoNombre)}</p>
              <p class="obra-meta">Entrada ${esc(x.f.horaEntrada || "--:--")}${x.f.vehiculoNombre ? " · conduce " + esc(x.f.vehiculoNombre) : ""}${x.f.cerradoPorNombre ? " · cerrado por " + esc(x.f.cerradoPorNombre) : ""}</p>
            </div>
            <label style="display:flex;align-items:center;gap:6px;margin:0;font-size:13px;color:var(--text);white-space:nowrap;">
              <input type="checkbox" class="c-presente" ${x.presente ? "checked" : ""} style="width:20px;height:20px;margin:0;"> Ha estado
            </label>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px;${x.presente ? "" : "display:none;"}" class="c-campos">
            <div><label style="font-size:12px;margin-bottom:4px;">Salida</label>
              <input type="time" class="c-salida" value="${esc(x.salida)}" style="margin:0;height:40px;"></div>
            <div><label style="font-size:12px;margin-bottom:4px;">Horas extra</label>
              <input type="number" class="c-extra" value="${x.extra}" min="0" max="12" step="0.5" inputmode="decimal" style="margin:0;height:40px;"></div>
          </div>
          <p class="obra-meta c-resumen" style="margin-top:6px;">${x.presente ? resumen(x) : "No ha estado en la obra: se avisará a la oficina."}</p>
        </div>`).join("") + "</div>";
      html += `<button class="primary" id="cerrarBtn">${cerradas ? "Guardar cambios del cierre" : "Cerrar jornada"}</button>`;
      html += '<p id="cierreMsg" style="font-size:13px;color:var(--success-dark);text-align:center;margin:10px 0 0;"></p>';
    }

    if (sinFichar.length) {
      html += `<div class="card" style="margin-top:14px;">
        <h1 style="font-size:15px;margin-bottom:6px;">De esta obra y sin fichar</h1>
        <p style="font-size:12px;color:var(--text-muted);margin:0 0 6px;">Si alguno ha venido, toca "Ha venido" y se apunta con la entrada habitual (${esc(cfg.horaEntrada)}).</p>
        ${sinFichar.map(s => `
          <div style="display:flex;align-items:center;gap:10px;padding:8px 0;">
            ${avatar(s.emp, 32)}
            <span style="flex:1;font-size:14px;">${esc(s.emp.nombre)}</span>
            ${s.ausencia
              ? `<span class="chip">${esc(TIPOS_AUSENCIA[s.ausencia.tipo] || "Ausente")}</span>`
              : `<button class="link-btn b-havenido" data-emp="${s.emp.id}">Ha venido</button>`}
          </div>`).join("")}
      </div>`;
    }

    container.innerHTML = html;
    conectar();
  }

  function resumen(x) {
    const t = horasTrabajadas(x.f.horaEntrada, x.salida, cfg);
    const extra = Number(x.extra) || 0;
    return `${textoHoras(t)} trabajadas · ${textoHoras(Math.max(0, t - extra))} normales · ${textoHoras(extra)} extra`;
  }

  function conectar() {
    container.querySelector("#cierreFecha").addEventListener("change", async e => {
      if (!e.target.value) return;
      fecha = e.target.value;
      container.innerHTML = '<div class="loading">Cargando cierre...</div>';
      await cargar();
      pintar();
    });

    container.querySelectorAll(".cierre-fila").forEach(div => {
      const x = filas[Number(div.dataset.i)];
      const res = div.querySelector(".c-resumen");
      const extraIn = div.querySelector(".c-extra");
      div.querySelector(".c-presente").addEventListener("change", e => {
        x.presente = e.target.checked;
        div.style.opacity = x.presente ? "" : "0.6";
        div.querySelector(".c-campos").style.display = x.presente ? "grid" : "none";
        res.textContent = x.presente ? resumen(x) : "No ha estado en la obra: se avisará a la oficina.";
      });
      div.querySelector(".c-salida").addEventListener("change", e => {
        x.salida = e.target.value;
        if (!x.extraTocada) {
          x.extra = extraSugerida(fecha, x.f.horaEntrada, x.salida, cfg);
          extraIn.value = x.extra;
        }
        res.textContent = resumen(x);
      });
      extraIn.addEventListener("input", e => {
        x.extra = Math.max(0, Number(e.target.value) || 0);
        x.extraTocada = true;
        res.textContent = resumen(x);
      });
    });

    container.querySelectorAll(".b-havenido").forEach(b => b.addEventListener("click", async () => {
      const s = sinFichar.find(z => z.emp.id === b.dataset.emp);
      b.disabled = true;
      try {
        await setDoc(doc(db, "obras", obraId, "fichajes", `${fecha}_${s.emp.id}`), {
          empleadoId: s.emp.id,
          empleadoNombre: s.emp.nombre,
          fecha,
          horaEntrada: cfg.horaEntrada,
          origen: "encargado",
          fichadoPorUid: auth.currentUser ? auth.currentUser.uid : "",
          fichadoPorNombre: perfil.nombre || "",
          vehiculoId: "", vehiculoNombre: ""
        }, { merge: true });
        await cargar();
        pintar();
      } catch (err) {
        console.error(err);
        alert("No se ha podido apuntar. Inténtalo otra vez.");
        b.disabled = false;
      }
    }));

    const btn = container.querySelector("#cerrarBtn");
    if (btn) btn.addEventListener("click", async () => {
      for (const x of filas) {
        if (x.presente && (!x.salida || x.salida <= (x.f.horaEntrada || ""))) {
          alert(`Revisa la hora de salida de ${x.f.empleadoNombre}.`);
          return;
        }
      }
      btn.disabled = true;
      btn.textContent = "Guardando...";
      const momento = `${fechaLocal()} ${horaLocal()}`;
      try {
        for (const x of filas) {
          const datos = x.presente
            ? { horaSalida: x.salida, horasExtra: Number(x.extra) || 0, presenciaConfirmada: true }
            : { horaSalida: "", horasExtra: 0, presenciaConfirmada: false };
          Object.assign(datos, {
            cerradoPorUid: auth.currentUser ? auth.currentUser.uid : "",
            cerradoPorNombre: perfil.nombre || "",
            cerradoEn: momento
          });
          const yaCerrado = !!x.f.cerradoPorNombre;
          const cambia = x.f.horaSalida !== datos.horaSalida || Number(x.f.horasExtra || 0) !== datos.horasExtra
            || (x.f.presenciaConfirmada !== false) !== datos.presenciaConfirmada;
          if (yaCerrado && !cambia) continue;
          await setDoc(doc(db, "obras", obraId, "fichajes", x.f.docId), datos, { merge: true });
          if (yaCerrado) {
            await registrarHistorial({
              accion: "corrección", obraId, empleadoId: x.f.empleadoId, empleadoNombre: x.f.empleadoNombre, fecha,
              antes: { ...x.f, obraId }, despues: { ...x.f, ...datos, obraId },
              motivo: "Cierre de jornada modificado por el encargado", perfil
            });
          }
        }
        await cargar();
        pintar();
        const msg = container.querySelector("#cierreMsg");
        if (msg) msg.textContent = `Jornada del ${fechaBonita(fecha)} guardada.`;
      } catch (err) {
        console.error(err);
        alert("No se ha podido guardar todo. Revisa la conexión y vuelve a pulsar.");
        btn.disabled = false;
        btn.textContent = "Cerrar jornada";
      }
    });
  }

  await cargar();
  pintar();
}
