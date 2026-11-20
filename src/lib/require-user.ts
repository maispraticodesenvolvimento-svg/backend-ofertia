import { firebaseAuth } from "@/lib/firebase-admin";
import { realtimeDatabase } from "@/lib/firebase-admin";

export async function requireUser(request: Request) {
  const cookie = request.headers.get("cookie") ?? "";
  const session = cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith("ofertia_session="))?.slice("ofertia_session=".length);
  if (!session) throw new Error("UNAUTHORIZED");

  try {
    return await firebaseAuth.verifySessionCookie(session, true);
  } catch {
    throw new Error("UNAUTHORIZED");
  }
}

export async function requireAdmin(request: Request) {
  const user = await requireUser(request);
  if ((user as unknown as { admin?: boolean }).admin === true) return user;

  // Lista de e-mails de superadministradores garantidos
  const adminEmails = new Set([
    "maispraticodesenvolvimento@gmail.com",
  ]);

  if (user.email && adminEmails.has(user.email.toLowerCase())) {
    return user;
  }

  const role = await realtimeDatabase.ref(`users/${user.uid}/role`).get();
  if (role.val() !== "admin") throw new Error("FORBIDDEN");
  return user;
}
