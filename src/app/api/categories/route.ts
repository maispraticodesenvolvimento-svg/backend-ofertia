import { requireAdmin } from "@/lib/require-user";
import { apiError } from "@/lib/api-response";
import { realtimeDatabase } from "@/lib/firebase-admin";

export async function GET() {
  try {
    const snapshot = await realtimeDatabase.ref("categories").get();
    const values = snapshot.val() as Record<string, Record<string, unknown>> | null;
    const items = Object.entries(values ?? {})
      .map(([id, cat]) => ({ id, ...cat }))
      .sort((a, b) => String(a.name ?? "").localeCompare(String(b.name ?? ""), "pt-BR"));
    return Response.json({ items });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAdmin(request);
    const body = (await request.json()) as {
      name?: unknown;
      description?: unknown;
      icon?: unknown;
    };

    if (typeof body.name !== "string" || !body.name.trim()) {
      return Response.json({ error: "O nome/título da categoria é obrigatório." }, { status: 400 });
    }

    const ref = realtimeDatabase.ref("categories").push();
    const item = {
      name: body.name.trim(),
      description: typeof body.description === "string" ? body.description.trim() : "",
      icon: typeof body.icon === "string" ? body.icon.trim() : "category",
      createdBy: user.uid,
      createdAt: Date.now(),
    };
    await ref.set(item);

    return Response.json({ item: { id: ref.key, ...item } }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}

