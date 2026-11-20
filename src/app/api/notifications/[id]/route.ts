import { requireUser } from "@/lib/require-user";
import { apiError } from "@/lib/api-response";
import { realtimeDatabase } from "@/lib/firebase-admin";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  try {
    const user = await requireUser(request);
    const { id } = await context.params;
    const ref = realtimeDatabase.ref(`users/${user.uid}/notifications/${id}`);
    const existing = await ref.get();
    if (!existing.exists()) return Response.json({ error: "Notificação não encontrada." }, { status: 404 });
    await ref.update({ read: true });
    return Response.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: Request, context: Context) {
  try {
    const user = await requireUser(request);
    const { id } = await context.params;
    const ref = realtimeDatabase.ref(`users/${user.uid}/notifications/${id}`);
    const existing = await ref.get();
    if (!existing.exists()) return Response.json({ error: "Notificação não encontrada." }, { status: 404 });
    await ref.remove();
    return Response.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
