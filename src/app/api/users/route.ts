import { requireAdmin } from "@/lib/require-user";
import { apiError } from "@/lib/api-response";
import { realtimeDatabase } from "@/lib/firebase-admin";

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    const role = new URL(request.url).searchParams.get("role");
    const snapshot = await realtimeDatabase.ref("users").get();
    const values = snapshot.val() as Record<string, Record<string, unknown>> | null;
    const items = Object.entries(values ?? {})
      .map(([uid, user]) => ({ uid, ...user }))
      .filter((user) => !role || user.role === role)
      .sort((a, b) => Number(b.createdAt ?? 0) - Number(a.createdAt ?? 0));
    return Response.json({ items });
  } catch (error) {
    return apiError(error);
  }
}
