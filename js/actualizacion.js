// Aviso de versión nueva de la app.
// Cada vez que se sube un cambio, version.json lleva una marca nueva. Si el navegador tiene guardada una versión
// anterior, sale un aviso ⚠️ arriba; al tocarlo se descargan de nuevo todos los archivos y se recarga la página.
// Las pantallas con cosas a medio escribir ponen window.hayCambiosSinGuardar = () => true/false para pedir confirmación.

const CLAVE = "abels_version";
const CADA = 5 * 60 * 1000;   // se vuelve a comprobar cada 5 minutos y al volver a la app
let versionNueva = null;

async function versionPublicada() {
  try {
    const r = await fetch("version.json?t=" + Date.now(), { cache: "no-store" });
    if (!r.ok) return null;
    return (await r.json()).v || null;
  } catch { return null; }
}

const leer = () => { try { return localStorage.getItem(CLAVE); } catch { return null; } };
const guardar = v => { try { localStorage.setItem(CLAVE, v); } catch {} };

function estilos() {
  if (document.getElementById("act-estilos")) return;
  const s = document.createElement("style");
  s.id = "act-estilos";
  s.textContent = `
    .act-aviso { position: fixed; left: 50%; transform: translateX(-50%); top: calc(10px + env(safe-area-inset-top)); z-index: 2000;
      width: min(560px, calc(100% - 24px)); display: flex; align-items: center; gap: 10px; padding: 12px 14px;
      background: #FFF4CE; color: #5C4400; border: 1px solid #E8C252; border-radius: 12px; box-shadow: 0 6px 24px rgba(0,0,0,.18);
      font: 600 14px/1.35 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; cursor: pointer; }
    .act-aviso .ico { font-size: 22px; flex-shrink: 0; }
    .act-aviso .txt { flex: 1; }
    .act-aviso .txt small { display: block; font-weight: 400; font-size: 12px; opacity: .85; }
    .act-aviso .cerrar { border: none; background: none; color: inherit; font-size: 18px; padding: 4px 6px; cursor: pointer; opacity: .7; }
  `;
  document.head.appendChild(s);
}

function mostrarAviso() {
  if (document.getElementById("actAviso")) return;
  estilos();
  const a = document.createElement("div");
  a.id = "actAviso";
  a.className = "act-aviso";
  a.setAttribute("role", "button");
  a.setAttribute("tabindex", "0");
  a.innerHTML = `<span class="ico" aria-hidden="true">⚠️</span>
    <span class="txt">Hay una versión nueva de la app<small>Toca aquí para actualizar</small></span>
    <button class="cerrar" aria-label="Ahora no" title="Ahora no">✕</button>`;
  a.addEventListener("click", e => {
    if (e.target.closest(".cerrar")) { a.remove(); return; }
    actualizar();
  });
  a.addEventListener("keydown", e => { if (e.key === "Enter") actualizar(); });
  document.body.appendChild(a);
}

export async function actualizar() {
  let cambios = false;
  try { cambios = typeof window.hayCambiosSinGuardar === "function" && !!window.hayCambiosSinGuardar(); } catch {}
  if (cambios && !confirm("Tienes cambios sin guardar en esta pantalla.\n\nSi actualizas ahora, se perderán. ¿Actualizar igualmente?\n\n(Pulsa Cancelar, guarda, y vuelve a tocar el aviso.)")) return;
  const aviso = document.getElementById("actAviso");
  if (aviso) aviso.querySelector(".txt").innerHTML = "Actualizando...<small>Un momento</small>";
  // Vuelve a descargar la página y todos sus archivos (para que el navegador no use los guardados)
  const propios = new Set([location.href.split("#")[0]]);
  try {
    performance.getEntriesByType("resource").forEach(r => {
      if (r.name.startsWith(location.origin) && /\.(js|css|html|json)(\?|$)/.test(r.name)) propios.add(r.name);
    });
  } catch {}
  await Promise.all([...propios].map(u => fetch(u, { cache: "reload" }).catch(() => null)));
  if (versionNueva) guardar(versionNueva);
  window.hayCambiosSinGuardar = null;
  window.__actualizando = true;   // las pantallas no vuelven a preguntar al recargar
  location.reload();
}

async function comprobar() {
  const v = await versionPublicada();
  if (!v) return;
  const local = leer();
  if (!local) { guardar(v); return; }      // primera vez en este dispositivo: ya tiene lo último
  if (v !== local) { versionNueva = v; mostrarAviso(); }
}

comprobar();
setInterval(comprobar, CADA);
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") comprobar(); });
