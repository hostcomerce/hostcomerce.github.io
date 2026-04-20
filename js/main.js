//** --- CONFIGURACIÓN --- **/
const urlAPI = "https://script.google.com/macros/s/AKfycbwWlok6GXkx2jbY4NdDE0EKOicVHumBJXBNXfjcWX8vuWdszhFal0fL3YB_M2YDaPwByw/exec"; // REEMPLAZA ESTO

let productos = [];
const contenedorProductos = document.querySelector("#contenedor-productos");
const botonesCategorias = document.querySelectorAll(".boton-categoria");
const tituloPrincipal = document.querySelector("#titulo-principal");
const numerito = document.querySelector("#numerito");
 
// Sesión
const loginBtn = document.querySelector("#login-btn");
const logoutBtn = document.querySelector("#logout-btn");
const userInfo = document.querySelector("#user-info");
const userName = document.querySelector("#user-name");
const userImg = document.querySelector("#user-img");

/** --- AUTENTICACIÓN --- **/
firebase.auth().onAuthStateChanged((user) => {
    if (user) {
        loginBtn.classList.add("disabled");
        userInfo.classList.remove("disabled");
        userName.innerText = user.displayName;
        userImg.src = user.photoURL;
    } else {
        loginBtn.classList.remove("disabled");
        userInfo.classList.add("disabled");
    }
});

loginBtn.addEventListener("click", () => {
    const provider = new firebase.auth.GoogleAuthProvider();
    firebase.auth().signInWithPopup(provider).catch(err => console.error(err));
});

logoutBtn.addEventListener("click", () => firebase.auth().signOut());

/** --- CARGA Y RENDER --- **/
async function cargarProductosDesdeAPI() {
    // 1. Intentar cargar desde el LocalStorage (Cache) primero
    const cacheProductos = localStorage.getItem("cache-productos");
    
    if (cacheProductos) {
        // Si hay algo guardado, lo mostramos YA
        productos = JSON.parse(cacheProductos);
        renderizarProductos(productos);
    } else {
        // Si no hay cache, podés poner un mensaje o los "esqueletos" de carga
        contenedorProductos.innerHTML = "<p>Cargando productos...</p>";
    }

    // 2. Pedir los datos frescos al Sheet (de fondo)
    try {
        const response = await fetch(urlAPI, { 
            method: 'GET', 
            mode: 'cors',
            redirect: 'follow' 
        });
        
        const nuevosProductos = await response.json();

        // 3. Comparar: si lo que vino del Sheet es distinto al cache, actualizamos
        if (JSON.stringify(nuevosProductos) !== cacheProductos) {
            productos = nuevosProductos;
            // Guardamos la nueva "verdad" en el cache
            localStorage.setItem("cache-productos", JSON.stringify(productos));
            // Refrescamos la pantalla con los datos (y stock) reales
            renderizarProductos(productos);
        }
        
    } catch (error) {
        console.error("Error al sincronizar con el Sheet:", error);
        // Solo mostramos error si ni siquiera había cache
        if (!cacheProductos) {
            contenedorProductos.innerHTML = "<p>Error al cargar productos.</p>";
        }
    }
}

function renderizarProductos(productosElegidos) {
    contenedorProductos.innerHTML = "";
if (!Array.isArray(productosElegidos)) {
        console.error("Los productos no llegaron como lista:", productosElegidos);
        return; 
    }
    productosElegidos.forEach(producto => {
        const div = document.createElement("div");
        div.classList.add("producto");

        const carritoActual = JSON.parse(localStorage.getItem("productos-en-carrito")) || [];
        const enCarrito = carritoActual.find(p => p.id === producto.id);
        const cantidadEnCarrito = enCarrito ? enCarrito.cantidad : 0;
        const stockDisponible = producto.stock - cantidadEnCarrito;

        div.innerHTML = `
            <img class="producto-imagen" src="${producto.imagen}" alt="${producto.nombre}">
            <div class="producto-detalles">
                <h3 class="producto-titulo">${producto.nombre}</h3>
                <p class="producto-precio">$${producto.precio}</p>
                <p class="stock-info" id="stock-${producto.id}">
                    ${stockDisponible <= 0 ? 'Agotado' : `Disponibles: ${stockDisponible}`}
                </p>
                <button class="producto-agregar" id="${producto.id}" ${stockDisponible <= 0 ? 'disabled' : ''}>
                    ${stockDisponible <= 0 ? 'Sin Stock' : 'Agregar'}
                </button>
            </div>
        `;
        contenedorProductos.append(div);
    });
    actualizarBotonesAgregar();
}

/** --- FILTROS --- **/
botonesCategorias.forEach(boton => {
    boton.addEventListener("click", (e) => {
        botonesCategorias.forEach(b => b.classList.remove("active"));
        e.currentTarget.classList.add("active");

        const categoriaId = e.currentTarget.id;

        if (categoriaId !== "todos") {
            const productosFiltrados = productos.filter(p => p.categoria.id === categoriaId);
            const catNombre = productosFiltrados.length > 0 ? productosFiltrados[0].categoria.nombre : e.currentTarget.innerText;
            tituloPrincipal.innerText = catNombre;
            renderizarProductos(productosFiltrados);
        } else {
            tituloPrincipal.innerText = "Todos los productos";
            renderizarProductos(productos);
        }
    });
});

/** --- CARRITO (LA CORRECCIÓN ESTÁ AQUÍ) --- **/
function actualizarBotonesAgregar() {
    const botonesAgregar = document.querySelectorAll(".producto-agregar");
    botonesAgregar.forEach(boton => {
        boton.addEventListener("click", agregarAlCarrito);
    });
}

function agregarAlCarrito(e) {
    const idBoton = e.currentTarget.id;
    const productoAgregado = productos.find(p => p.id === idBoton);
    let productosEnCarrito = JSON.parse(localStorage.getItem("productos-en-carrito")) || [];

    // Verificamos stock antes de agregar
    const cantidadEnCarrito = (productosEnCarrito.find(p => p.id === idBoton)?.cantidad) || 0;
    if (cantidadEnCarrito >= productoAgregado.stock) {
        Toastify({ text: "No hay más stock disponible", style: { background: "red" } }).showToast();
        return;
    }

    if (productosEnCarrito.some(p => p.id === idBoton)) {
        const index = productosEnCarrito.findIndex(p => p.id === idBoton);
        productosEnCarrito[index].cantidad++;
    } else {
        productoAgregado.cantidad = 1;
        productosEnCarrito.push({ ...productoAgregado });
    }

    // Guardar y actualizar UI sin re-renderizar todo
    localStorage.setItem("productos-en-carrito", JSON.stringify(productosEnCarrito));
    actualizarNumerito(productosEnCarrito);

    // Actualizamos solo el texto de stock del producto clickeado
    const nuevoStockDisp = productoAgregado.stock - (cantidadEnCarrito + 1);
    const pStock = document.querySelector(`#stock-${idBoton}`);
    if (pStock) {
        pStock.innerText = nuevoStockDisp <= 0 ? 'Agotado' : `Disponibles: ${nuevoStockDisp}`;
        if (nuevoStockDisp <= 0) e.currentTarget.disabled = true;
    }

    Toastify({
        text: "Producto agregado",
        duration: 2000,
        style: { background: "linear-gradient(to right, #e61e1e, #b31414)", borderRadius: "2rem" }
    }).showToast();
}

function actualizarNumerito(carrito) {
    numerito.innerText = carrito.reduce((acc, p) => acc + p.cantidad, 0);
}

// Inicio
cargarProductosDesdeAPI();
actualizarNumerito(JSON.parse(localStorage.getItem("productos-en-carrito")) || []);
