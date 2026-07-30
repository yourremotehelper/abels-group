<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<title>Abel's | Tus obras</title>
<link rel="manifest" href="manifest.json">
<link rel="stylesheet" href="css/styles.css">
</head>
<body>
<div class="screen">
  <div class="topbar">
    <div class="logo-badge">A</div>
    <div class="topbar-info">
      <p class="topbar-obra" id="userName">Cargando...</p>
      <p class="topbar-title">Tus obras</p>
    </div>
    <button class="icon-btn" id="logoutBtn" title="Salir" aria-label="Cerrar sesión" style="width:auto;padding:0 12px;gap:6px;">Salir</button>
  </div>

  <div class="card" id="obrasCard">
    <div class="loading">Cargando obras...</div>
  </div>
</div>

<script type="module">
  import { requireAuth, logout } from "./js/auth.js";
  import { db } from "./js/firebase-config.js";
  import {
    collection, getDocs, query, where, documentId
  } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

  const obrasCard = document.getElementById("obrasCard");
  const userName = document.getElementById("userName");

  document.getElementById("logoutBtn").addEventListener("click", async () => {
    await logout();
    window.location.href = "index.html";
  });

  requireAuth(async (user, perfil) => {
    userName.textContent = perfil.nombre || user.email;

    const linkDirectorio = document.createElement("button");
    linkDirectorio.className = "secondary";
    linkDirectorio.style.marginBottom = "10px";
    linkDirectorio.textContent = "Directorio de empleados";
    linkDirectorio.addEventListener("click", () => window.location.href = "empleados.html");
    obrasCard.parentElement.insertBefore(linkDirectorio, obrasCard);

    if (perfil.rol === "admin") {
      const linkObras = document.createElement("button");
      linkObras.className = "secondary";
      linkObras.style.marginBottom = "10px";
      linkObras.textContent = "Gestionar obras";
      linkObras.addEventListener("click", () => window.location.href = "obras.html");
      obrasCard.parentElement.insertBefore(linkObras, obrasCard);

      const link = document.createElement("button");
      link.className = "secondary";
      link.style.marginBottom = "14px";
      link.textContent = "Gestionar usuarios";
      link.addEventListener("click", () => window.location.href = "usuarios.html");
      obrasCard.parentElement.insertBefore(link, obrasCard);
    }

    try {
      let obras = [];
      const obrasRef = collection(db, "obras");

      if (perfil.rol === "admin") {
        const snap = await getDocs(obrasRef);
        obras = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      } else {
        const asignadas = perfil.obrasAsignadas || [];
        if (asignadas.length > 0) {
          const q = query(obrasRef, where(documentId(), "in", asignadas.slice(0, 10)));
          const snap = await getDocs(q);
          obras = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        }
      }

      if (obras.length === 0) {
        obrasCard.innerHTML = '<div class="placeholder">No tienes obras asignadas todavía.</div>';
        return;
      }

      obrasCard.innerHTML = "";
      obras.forEach(obra => {
        const item = document.createElement("div");
        item.className = "obra-item";
        item.innerHTML = `
          <div>
            <p class="obra-name">${obra.nombre || "Sin nombre"}</p>
            <p class="obra-meta">${obra.direccion || ""}</p>
          </div>
          <span style="color:var(--text-muted);">&#8250;</span>
        `;
        item.addEventListener("click", () => {
          sessionStorage.setItem("obraActual", JSON.stringify({ id: obra.id, nombre: obra.nombre }));
          window.location.href = "obra.html";
        });
        obrasCard.appendChild(item);
      });
    } catch (err) {
      obrasCard.innerHTML = '<div class="placeholder">Error al cargar las obras.</div>';
      console.error(err);
    }
  });
</script>
</body>
</html>
