/** --- VARIABLES Y ESTADO --- **/
let productosEnCarrito = JSON.parse(localStorage.getItem("productos-en-carrito")) || [];
// URL de tu ÚLTIMA implementación (asegurate de que termine en /exec)
const urlAPI = "https://script.google.com/macros/s/AKfycbyuInk6yWTycbJqiEUlf9Mbm2JUbLpYDXPXRjnfhmoUQBI7yfYrSzXijEr4ES_NLvKarg/exec";

// Referencias al DOM
const contenedorCarritoVacio = document.querySelector("#carrito-vacio");
const contenedorCarritoProductos = document.querySelector("#carrito-productos");
const contenedorCarritoAcciones = document.querySelector("#carrito-acciones");
const contenedorCarritoComprado = document.querySelector("#carrito-comprado");
const botonVaciar = document.querySelector("#carrito-acciones-vaciar");
const botonComprar = document.querySelector("#carrito-acciones-comprar");
const contenedorTotal = document.querySelector("#total");

// Sesión
const loginBtn = document.querySelector("#login-btn");
const userInfo = document.querySelector("#user-info");
const userName = document.querySelector("#user-name");
const userImg = document.querySelector("#user-img");

/** --- AUTENTICACIÓN --- **/
firebase.auth().onAuthStateChanged((user) => {
    if (user) {
        if(loginBtn) loginBtn.classList.add("disabled");
        if(userInfo) userInfo.classList.remove("disabled");
        if(userName) userName.innerText = user.displayName;
        if(userImg) userImg.src = user.photoURL;
    } else {
        if(loginBtn) loginBtn.classList.remove("disabled");
        if(userInfo) userInfo.classList.add("disabled");
    }
});

/** --- RENDERIZADO DEL CARRITO --- **/
function cargarProductosCarrito() {
    if (productosEnCarrito.length > 0) {
        contenedorCarritoVacio?.classList.add("disabled");
        contenedorCarritoProductos?.classList.remove("disabled");
        contenedorCarritoAcciones?.classList.remove("disabled");
        contenedorCarritoComprado?.classList.add("disabled");

        contenedorCarritoProductos.innerHTML = "";

        productosEnCarrito.forEach(producto => {
            const div = document.createElement("div");
            div.classList.add("carrito-producto");
            div.innerHTML = `
                <img class="carrito-producto-imagen" src="${producto.imagen}" alt="${producto.nombre}">
                <div class="carrito-producto-titulo"><small>Título</small><h3>${producto.nombre}</h3></div>
                <div class="carrito-producto-cantidad"><small>Cantidad</small><p>${producto.cantidad}</p></div>
                <div class="carrito-producto-precio"><small>Precio</small><p>$${producto.precio}</p></div>
                <div class="carrito-producto-subtotal"><small>Subtotal</small><p>$${producto.precio * producto.cantidad}</p></div>
                <button class="carrito-producto-eliminar" id="${producto.id}"><i class="bi bi-trash-fill"></i></button>
            `;
            contenedorCarritoProductos.append(div);
        });

        actualizarBotonesEliminar();
        actualizarTotal();
    } else {
        mostrarCarritoVacio();
    }
}

function mostrarCarritoVacio() {
    contenedorCarritoVacio?.classList.remove("disabled");
    contenedorCarritoProductos?.classList.add("disabled");
    contenedorCarritoAcciones?.classList.add("disabled");
}

function eliminarDelCarrito(e) {
    const idBoton = e.currentTarget.id;
    productosEnCarrito = productosEnCarrito.filter(p => p.id !== idBoton);
    localStorage.setItem("productos-en-carrito", JSON.stringify(productosEnCarrito));
    cargarProductosCarrito();
}

function actualizarBotonesEliminar() {
    document.querySelectorAll(".carrito-producto-eliminar").forEach(b => b.addEventListener("click", eliminarDelCarrito));
}

function actualizarTotal() {
    const total = productosEnCarrito.reduce((acc, p) => acc + (p.precio * p.cantidad), 0);
    if(contenedorTotal) contenedorTotal.innerText = `$${total}`;
}

/** --- PROCESO DE COMPRA --- **/
botonComprar?.addEventListener("click", comprarCarrito);

async function comprarCarrito() {
    const user = firebase.auth().currentUser;
    if (!user) return Swal.fire("Inicia sesión", "Debes estar logueado para comprar", "warning");

    const { value: formValues } = await Swal.fire({
        title: 'Datos de Envío',
        html: `
            <div style="display: flex; flex-direction: column; text-align: left; gap: 8px;">
                <label style="font-weight: bold; font-size: 0.8rem;">DNI del titular</label>
                <input id="swal-dni" class="swal2-input" style="margin:0" placeholder="Ej: 40123456">
                <label style="font-weight: bold; font-size: 0.8rem;">Dirección y Localidad</label>
                <input id="swal-dir" class="swal2-input" style="margin:0" placeholder="Calle, número y ciudad">
                <label style="font-weight: bold; font-size: 0.8rem;">Teléfono de contacto</label>
                <input id="swal-tel" class="swal2-input" style="margin:0" placeholder="Ej: 11 1234 5678">
            </div>
        `,
        focusConfirm: false,
        confirmButtonText: 'Ir a Pagar',
        confirmButtonColor: '#e61e1e',
        showCancelButton: true,
        preConfirm: () => {
            const dni = document.getElementById('swal-dni').value;
            const dir = document.getElementById('swal-dir').value;
            if (!dni || !dir) return Swal.showValidationMessage('DNI y Dirección son obligatorios');
            return { dni, direccion: dir, telefono: document.getElementById('swal-tel').value };
        }
    });

    if (formValues) {
        await procesarEnvioFinal(formValues, user);
    }
}

async function procesarEnvioFinal(formValues, user) {
    Swal.fire({ 
        title: 'Generando orden...', 
        text: 'Te estamos redirigiendo a Mercado Pago',
        allowOutsideClick: false, 
        didOpen: () => Swal.showLoading() 
    });

    // Mapeamos los items exactamente como los pide la API de Mercado Pago
    const pedidoCompleto = {
        items: productosEnCarrito.map(p => ({ 
            id: p.id.toString(), 
            nombre: p.nombre, 
            cantidad: parseInt(p.cantidad),
            precio: parseFloat(p.precio) 
        })),
        cliente: {
            nombre: user.displayName,
            email: user.email,
            dni: formValues.dni,
            direccion: formValues.direccion,
            telefono: formValues.telefono
        }
    };

    try {
        const response = await fetch(urlAPI, {
            method: 'POST',
            body: JSON.stringify(pedidoCompleto)
        });

        if (!response.ok) throw new Error("Error en la respuesta del servidor");

        const resultado = await response.json();

        if (resultado.init_point) {
            // Vaciamos el carrito local
            localStorage.removeItem("productos-en-carrito");
            // Redirección
            window.location.href = resultado.init_point;
        } else if (resultado.error) {
            Swal.fire("Problema con el pedido", resultado.detalles || resultado.error, "warning");
        }

    } catch (error) {
        console.error("Error al conectar:", error);
        Swal.fire("Error", "No pudimos conectar con el servidor. Revisá tu conexión.", "error");
    }
}

// Inicialización
cargarProductosCarrito();
