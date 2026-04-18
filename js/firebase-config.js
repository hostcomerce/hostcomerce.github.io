// Tus credenciales de Firebase (Copiá y pegá lo que te dio la consola de Firebase)
const firebaseConfig = {
  apiKey: "AIzaSyCXUmyqr0lvg6q-rZOgD7UMoemFhwUbtfs",
    authDomain: "send-mas-tienda.firebaseapp.com",
    projectId: "send-mas-tienda",
    storageBucket: "send-mas-tienda.firebasestorage.app",
    messagingSenderId: "259268267281",
    appId: "1:259268267281:web:0513c261b0fd64170810b0"

};

// Inicializamos Firebase
firebase.initializeApp(firebaseConfig);

// Creamos estas variables globales para que main.js y carrito.js las puedan usar
window.auth = firebase.auth();
window.provider = new firebase.auth.GoogleAuthProvider();