import { requireAdmin } from "@/lib/require-user";
import { apiError } from "@/lib/api-response";
import { realtimeDatabase } from "@/lib/firebase-admin";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin(request);
    const { id } = await params;
    if (!id) {
      return Response.json({ error: "ID inválido." }, { status: 400 });
    }
    await realtimeDatabase.ref(`categories/${id}`).remove();
    return Response.json({ success: true });
  } catch (error) {
    return apiError(error);
  }
}

