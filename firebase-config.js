// firebase-config.js - Configuração do Banco de Dados Firebase (Google Cloud)
// Para ativar a sincronização na nuvem, cole suas chaves gratuitas do Firebase abaixo.
// O app funciona com múltiplas contas isoladas mesmo antes de colar as chaves!

const firebaseConfig = {
  apiKey: "SUA_API_KEY_AQUI",
  authDomain: "SEU_PROJETO.firebaseapp.com",
  projectId: "SEU_PROJETO_ID",
  storageBucket: "SEU_PROJETO.appspot.com",
  messagingSenderId: "SEU_SENDER_ID",
  appId: "SEU_APP_ID"
};

// Verificar se o Firebase foi preenchido pelo usuário
function isFirebaseConfigured() {
  return firebaseConfig.apiKey && 
         !firebaseConfig.apiKey.includes('SUA_API_KEY') && 
         firebaseConfig.projectId && 
         !firebaseConfig.projectId.includes('SEU_PROJETO');
}
