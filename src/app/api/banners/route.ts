import { requireAdmin } from "@/lib/require-user";
import { apiError } from "@/lib/api-response";
import { realtimeDatabase } from "@/lib/firebase-admin";

export async function GET(request: Request) {
  try {
    const variant = new URL(request.url).searchParams.get("variant");
    const collection = variant === "mobile" ? "mobileBanners" : "banners";
    const snapshot = await realtimeDatabase.ref(`media/${collection}`).get();
    const values = snapshot.val() as Record<string, Record<string, unknown>> | null;
    const items = Object.entries(values ?? {})
      .map(([id, banner]) => ({ id, ...banner }))
      .sort((a, b) => Number(b.createdAt ?? 0) - Number(a.createdAt ?? 0));
    return Response.json({ items });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAdmin(request);
    const body = (await request.json()) as {
      dataUrl?: unknown;
      title?: unknown;
      category?: unknown;
    };
    if (typeof body.dataUrl !== "string" || !/^data:image\/(jpeg|png|webp|gif);base64,/.test(body.dataUrl)) {
      return Response.json({ error: "Envie uma imagem Base64 válida para o banner." }, { status: 400 });
    }
    const ref = realtimeDatabase.ref("media/banners").push();
    await ref.set({
      dataUrl: body.dataUrl,
      title: typeof body.title === "string" ? body.title : "",
      category: typeof body.category === "string" ? body.category.trim() : "",
      uploadedBy: user.uid,
      createdAt: Date.now(),
    });
    return Response.json({ item: { id: ref.key } }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
