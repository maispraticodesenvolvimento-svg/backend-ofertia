import { requireAdmin } from "@/lib/require-user";
import { apiError } from "@/lib/api-response";
import { realtimeDatabase } from "@/lib/firebase-admin";

type Context = { params: Promise<{ id: string }> };

export async function DELETE(request: Request, context: Context) {
  try {
    await requireAdmin(request);
    const { id } = await context.params;
    const ref = realtimeDatabase.ref(`media/banners/${id}`);
    const existing = await ref.get();
    if (!existing.exists()) return Response.json({ error: "Banner não encontrado." }, { status: 404 });
    await ref.remove();
    return Response.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
