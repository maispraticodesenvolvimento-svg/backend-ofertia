import { asRecord } from "@/lib/api-response";

export async function POST(request: Request) {
  try {
    const body = asRecord(await request.json());
    const email = typeof body?.email === "string" ? body.email.trim() : "";
    const apiKey = process.env.FIREBASE_API_KEY;
    if (!email.includes("@")) return Response.json({ error: "Informe um e-mail válido." }, { status: 400 });
    if (!apiKey) return Response.json({ error: "Recuperação de senha não configurada no servidor." }, { status: 503 });
    const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${apiKey}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestType: "PASSWORD_RESET", email }), cache: "no-store",
    });
    if (!response.ok) return Response.json({ error: "Não foi possível enviar o e-mail de recuperação." }, { status: 400 });
    return Response.json({ message: "Se houver uma conta para esse e-mail, enviaremos o link de recuperação." });
  } catch {
    return Response.json({ error: "Não foi possível enviar o e-mail de recuperação." }, { status: 500 });
  }
}
