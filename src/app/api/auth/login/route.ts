import { firebaseAuth } from "@/lib/firebase-admin";
import { asRecord } from "@/lib/api-response";

const cookieName = "ofertia_session";
const sessionDurationMs = 5 * 24 * 60 * 60 * 1000;

export async function POST(request: Request) {
  try {
    const body = asRecord(await request.json());
    const email = typeof body?.email === "string" ? body.email.trim() : "";
    const password = typeof body?.password === "string" ? body.password : "";
    const apiKey = process.env.FIREBASE_API_KEY;
    if (!email || !password) return Response.json({ error: "Informe e-mail e senha." }, { status: 400 });
    if (!apiKey) return Response.json({ error: "Autenticação não configurada no servidor." }, { status: 503 });

    const authResponse = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
      cache: "no-store",
    });
    const authBody = await authResponse.json();
    if (!authResponse.ok || typeof authBody.idToken !== "string") {
      const code = String(authBody?.error?.message ?? "");
      const message = code.includes("INVALID_LOGIN_CREDENTIALS") || code.includes("EMAIL_NOT_FOUND") || code.includes("INVALID_PASSWORD")
        ? "E-mail ou senha não conferem."
        : code.includes("USER_DISABLED") ? "Esta conta está desativada."
        : code.includes("TOO_MANY_ATTEMPTS") ? "Muitas tentativas. Aguarde um pouco e tente novamente."
        : "Não foi possível entrar. Confira os dados e tente novamente.";
      return Response.json({ error: message }, { status: 401 });
    }

    const session = await firebaseAuth.createSessionCookie(authBody.idToken, { expiresIn: sessionDurationMs });
    const secure = new URL(request.url).protocol === "https:";
    const sameSite = secure ? "None; Secure" : "Lax";
    const response = Response.json({ uid: authBody.localId, email: authBody.email });
    response.headers.append("Set-Cookie", `${cookieName}=${session}; Path=/; HttpOnly; SameSite=${sameSite}; Max-Age=${Math.floor(sessionDurationMs / 1000)}`);
    return response;
  } catch {
    return Response.json({ error: "Não foi possível concluir o login." }, { status: 500 });
  }
}
