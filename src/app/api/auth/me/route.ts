import { requireUser } from "@/lib/require-user";
import { realtimeDatabase } from "@/lib/firebase-admin";

export async function GET(request: Request) {
  try {
    const user = await requireUser(request);
    const profile = (await realtimeDatabase.ref(`users/${user.uid}`).get()).val() ?? {};
    const isAdminEmail = user.email?.toLowerCase() === "maispraticodesenvolvimento@gmail.com";
    const role = isAdminEmail ? "admin" : (profile.role ?? "buyer");

    // Garante que no banco o role esteja sincronizado como admin
    if (isAdminEmail && profile.role !== "admin") {
      await realtimeDatabase.ref(`users/${user.uid}`).update({ role: "admin", updatedAt: Date.now() });
    }

    return Response.json({
      uid: user.uid,
      email: user.email ?? null,
      role,
      name: profile.name ?? null,
      phone: profile.phone ?? null,
      document: profile.document ?? null,
      address: profile.address ?? null,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return Response.json({ error: "Token ausente ou inválido." }, { status: 401 });
    }

    return Response.json({ error: "Não foi possível validar o usuário." }, { status: 500 });
  }
}
