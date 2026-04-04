/**
 * seed-users.js
 * Popula o Firestore com os usuários iniciais do Nexus.
 * 
 * Como rodar (UMA única vez):
 *   node src/seed-users.js
 * 
 * Adicione quantos usuários precisar no array USERS abaixo.
 * Login = Nome+Sobrenome (sem acento, sem espaço, minúsculo)
 * Senha = CPF (só dígitos)
 */

import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyC_JIRYdrCemlxYAi7BFIy2lN6QLFfem2k",
  authDomain: "dodocoxnexus.firebaseapp.com",
  projectId: "dodocoxnexus",
  storageBucket: "dodocoxnexus.firebasestorage.app",
  messagingSenderId: "247896209945",
  appId: "1:247896209945:web:540d779cf2d71fe3f10888",
};

const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);

// ─── Adicione os usuários aqui ────────────────────────────────────────────────
const USERS = [
  {
    id: "user_joao",
    name: "João Silva",
    handle: "joaosilva",
    loginKey: "joaosilva",   // nome+sobrenome sem acento, minúsculo, sem espaço
    cpf: "12345678900",      // só dígitos
    bio: "Desenvolvedor apaixonado por tech e café ☕",
    avatarColor: "#5B21B6",
    avatarUrl: "",
    bannerUrl: "",
    following: 0,
    followers: 0,
    createdAt: new Date().toISOString(),
  },
  {
    id: "user_maria",
    name: "Maria Santos",
    handle: "mariasantos",
    loginKey: "mariasantos",
    cpf: "98765432100",
    bio: "Designer UX/UI | Explorando o futuro digital ✨",
    avatarColor: "#7C3AED",
    avatarUrl: "",
    bannerUrl: "",
    following: 0,
    followers: 0,
    createdAt: new Date().toISOString(),
  },
  // { id: "user_ana", name: "Ana Lima", handle: "analima", loginKey: "analima", cpf: "11122233300", bio: "...", avatarColor: "#4C1D95", avatarUrl: "", bannerUrl: "", following: 0, followers: 0, createdAt: new Date().toISOString() },
];

async function seed() {
  console.log("🌱 Criando usuários no Firestore...");
  for (const user of USERS) {
    const { id, ...data } = user;
    await setDoc(doc(db, "users", id), data);
    console.log(`✅ ${user.name} criado`);
  }
  console.log("✨ Pronto! Todos os usuários foram criados.");
  process.exit(0);
}

seed().catch((err) => {
  console.error("❌ Erro:", err);
  process.exit(1);
});
