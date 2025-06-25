// config.js - Configuration Firebase
// ⚠️ IMPORTANT: Ajoutez ce fichier à votre .gitignore pour ne pas exposer vos clés !

const firebaseConfig = {
    apiKey: "AIzaSyDVVTPm80W3K0ebutcPlh-OAR28kJiaMjE",
    authDomain: "etheria-manager.firebaseapp.com",
    projectId: "etheria-manager",
    storageBucket: "etheria-manager.appspot.com",
    messagingSenderId: "247321381553",
    appId: "1:247321381553:web:517f4fb1989ad14a8e3090"
};

// Fonction pour récupérer la configuration
window.getFirebaseConfig = () => firebaseConfig;