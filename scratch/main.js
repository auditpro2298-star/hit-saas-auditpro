document.addEventListener("DOMContentLoaded", () => {
    let productos = [];
    let categoriaActual = "Todos";

    const list = document.getElementById("product-list");
    const cats = document.getElementById("category-buttons");
    const searchInput = document.getElementById("search-input");
    const btnMic = document.getElementById("btn-mic");

    // 1. Cargar productos desde productos.json
    async function cargarProductos() {
        try {
            const res = await fetch(`productos.json?t=${Date.now()}`);
            if (!res.ok) throw new Error("No se pudo cargar productos.json");
            productos = await res.json();
            if (!Array.isArray(productos)) productos = [];
        } catch (e) {
            console.warn("Fallo carga de productos.json:", e);
            productos = [];
        }

        renderizarCategorias();
        renderizarProductos();
    }

    // 2. Generar botones de categorías
    function renderizarCategorias() {
        if (!cats) return;
        cats.innerHTML = "";

        const categoriasUnicas = ["Todos", ...new Set(productos.map(p => p.categoria || "General").filter(Boolean))];

        categoriasUnicas.forEach(cat => {
            const btn = document.createElement("button");
            btn.textContent = cat;
            if (cat === categoriaActual) btn.classList.add("active-cat");
            btn.onclick = () => {
                categoriaActual = cat;
                document.querySelectorAll("#category-buttons button").forEach(b => b.classList.remove("active-cat"));
                btn.classList.add("active-cat");
                renderizarProductos();
            };
            cats.appendChild(btn);
        });
    }

    // 3. Renderizar cuadrícula de electrodomésticos
    function renderizarProductos() {
        if (!list) return;
        list.innerHTML = "";

        const query = searchInput ? searchInput.value.toLowerCase().trim() : "";

        const filtrados = productos.filter(p => {
            const nombre = (p.nombre || "").toLowerCase();
            const desc = (p.descripcion || "").toLowerCase();
            const cat = p.categoria || "General";

            const coincideCategoria = (categoriaActual === "Todos" || cat === categoriaActual);
            const coincideBusqueda = !query || nombre.includes(query) || desc.includes(query);

            return coincideCategoria && coincideBusqueda;
        });

        if (filtrados.length === 0) {
            list.innerHTML = `<div style="grid-column: 1/-1; padding: 50px; color: #94a3b8; font-size: 16px;">No se encontraron electrodomésticos que coincidan con la búsqueda.</div>`;
            return;
        }

        filtrados.forEach(p => {
            const item = document.createElement("div");
            item.className = "item";

            const nombre = p.nombre || "Electrodoméstico";
            const desc = p.descripcion || "";
            const precio = p.precio || "0";
            const img = p.imagen || "https://via.placeholder.com/300x200?text=G%C3%A9nesis+Electro";

            item.innerHTML = `
                <img src="${img}" alt="${nombre}" onerror="this.src='https://via.placeholder.com/300x200?text=G%C3%A9nesis+Electro'">
                <div class="item-info">
                    <div>
                        <h3 class="item-title">${nombre}</h3>
                        <p class="item-desc">${desc}</p>
                    </div>
                    <div class="item-price">${precio.toString().includes('$') ? precio : '$' + precio}</div>
                </div>
            `;
            list.appendChild(item);
        });
    }

    // 4. BUSCADOR POR VOZ (SpeechRecognition Web API)
    function iniciarBuscadorPorVoz() {
        if (!btnMic || !searchInput) return;

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

        if (!SpeechRecognition) {
            console.warn("Reconocimiento de voz no disponible en este navegador");
            btnMic.style.display = "none";
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.lang = "es-AR";
        recognition.continuous = false;
        recognition.interimResults = false;

        btnMic.onclick = () => {
            try {
                recognition.start();
                btnMic.classList.add("escuchando");
                btnMic.title = "Escuchando... hablá ahora 🎙️";
            } catch (e) {
                console.warn("Reconocimiento de voz ya en ejecución", e);
            }
        };

        recognition.onresult = (event) => {
            const texto = event.results[0][0].transcript;
            searchInput.value = texto;
            btnMic.classList.remove("escuchando");
            btnMic.title = "Hacé clic para buscar por voz 🎙️";
            renderizarProductos();
        };

        recognition.onerror = (e) => {
            console.warn("Error en voz:", e.error);
            btnMic.classList.remove("escuchando");
            btnMic.title = "Hacé clic para buscar por voz 🎙️";
        };

        recognition.onend = () => {
            btnMic.classList.remove("escuchando");
            btnMic.title = "Hacé clic para buscar por voz 🎙️";
        };
    }

    // Evento de escritura manual en buscador
    if (searchInput) {
        searchInput.addEventListener("input", renderizarProductos);
    }

    iniciarBuscadorPorVoz();
    cargarProductos();
});