// firebase-config.js - Configuração oficial do Firebase (Google Cloud) para HarTv Gestor

const firebaseConfig = {
  apiKey: "AIzaSyDCw8jFf1kLmoOrfiJ2cvYqt3YTIx6rDe8",
  authDomain: "hartv-gestor.firebaseapp.com",
  projectId: "hartv-gestor",
  storageBucket: "hartv-gestor.firebasestorage.app",
  messagingSenderId: "141988470343",
  appId: "1:141988470343:web:04a21057c4a2f3d08edb62",
  measurementId: "G-2LGHB93YWN"
};

// Verificar se o Firebase foi preenchido pelo usuário
function isFirebaseConfigured() {
  return firebaseConfig.apiKey && 
         !firebaseConfig.apiKey.includes('SUA_API_KEY') && 
         firebaseConfig.projectId && 
         !firebaseConfig.projectId.includes('SEU_PROJETO');
}
