// Configuration du projet Firebase (console Firebase → Paramètres du projet → Vos applications → Web).
// Ces valeurs sont publiques par nature : la protection des données est assurée par
// les règles Firestore (firestore.rules) et la connexion Google.
// Tant que apiKey est vide, l'app fonctionne en mode local (données dans le navigateur uniquement).
export const firebaseConfig = {
  apiKey: "",
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: "",
};
