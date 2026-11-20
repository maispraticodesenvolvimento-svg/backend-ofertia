import { firebaseAuth, realtimeDatabase } from "@/lib/firebase-admin";
import { asRecord } from "@/lib/api-response";

const sessionDurationMs = 5 * 24 * 60 * 60 * 1000;

export async function POST(request: Request) {
  try {
    const body = asRecord(await request.json());
    const email = typeof body?.email === "string" ? body.email.trim() : "";
    const password = typeof body?.password === "string" ? body.password : "";
    const apiKey = process.env.FIREBASE_API_KEY;
    if (!email || password.length < 6) return Response.json({ error: "Informe um e-mail válido e uma senha com ao menos 6 caracteres." }, { status: 400 });
    if (!apiKey) return Response.json({ error: "Autenticação não configurada no servidor." }, { status: 503 });

    const authResponse = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, returnSecureToken: true }), cache: "no-store",
    });
    const authBody = await authResponse.json();
    if (!authResponse.ok || typeof authBody.idToken !== "string") {
      const code = String(authBody?.error?.message ?? "");
      const message = code.includes("EMAIL_EXISTS") ? "Este e-mail já possui uma conta."
        : code.includes("WEAK_PASSWORD") ? "Escolha uma senha mais segura, com ao menos 6 caracteres."
        : code.includes("INVALID_EMAIL") ? "Confira o formato do e-mail informado."
        : "Não foi possível criar a conta.";
      return Response.json({ error: message }, { status: 400 });
    }

    const session = await firebaseAuth.createSessionCookie(authBody.idToken, { expiresIn: sessionDurationMs });
    const now = Date.now();
    await realtimeDatabase.ref(`users/${authBody.localId}`).update({
      email: authBody.email ?? email, role: "buyer", createdAt: now, updatedAt: now,
    });
    const secure = new URL(request.url).protocol === "https:";
    const sameSite = secure ? "None; Secure" : "Lax";
    const response = Response.json({ uid: authBody.localId, email: authBody.email ?? email });
    response.headers.append("Set-Cookie", `ofertia_session=${session}; Path=/; HttpOnly; SameSite=${sameSite}; Max-Age=${Math.floor(sessionDurationMs / 1000)}`);
    return response;
  } catch {
    return Response.json({ error: "Não foi possível concluir o cadastro." }, { status: 500 });
  }
}
