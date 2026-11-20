import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getDatabase } from "firebase-admin/database";

const projectId = process.env.FIREBASE_PROJECT_ID;
const databaseURL = process.env.FIREBASE_DATABASE_URL;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

if (!projectId || !databaseURL || !clientEmail || !privateKey) {
  throw new Error(
    "Configure FIREBASE_PROJECT_ID, FIREBASE_DATABASE_URL, FIREBASE_CLIENT_EMAIL e FIREBASE_PRIVATE_KEY no .env.",
  );
}

if (clientEmail.includes("xxxxx") || clientEmail.includes("seu-project-id")) {
  throw new Error("Substitua FIREBASE_CLIENT_EMAIL pelo client_email do JSON da conta de serviço.");
}

if (
  !privateKey.startsWith("-----BEGIN PRIVATE KEY-----") ||
  !privateKey.trimEnd().endsWith("-----END PRIVATE KEY-----")
) {
  throw new Error(
    "FIREBASE_PRIVATE_KEY inválida: use o campo private_key do JSON da conta de serviço, preservando as quebras de linha como \\n.",
  );
}

const firebaseApp =
  getApps()[0] ??
  initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
    databaseURL,
  });

export const firebaseAuth = getAuth(firebaseApp);
export const realtimeDatabase = getDatabase(firebaseApp);
