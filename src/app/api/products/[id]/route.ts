import { requireAdmin, requireUser } from "@/lib/require-user";
import { apiError, asRecord, validProduct } from "@/lib/api-response";
import { realtimeDatabase } from "@/lib/firebase-admin";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Context) {
  try {
    const { id } = await context.params;
    const snapshot = await realtimeDatabase.ref(`products/${id}`).get();
    const product = snapshot.val();
    if (!product) return Response.json({ error: "Produto não encontrado." }, { status: 404 });
    if (product.status !== "active") {
      await requireAdmin(request);
    }
    const imageIds = Array.isArray(product.imageIds) ? (product.imageIds as unknown[]).map(String) : [];
    if (imageIds.length === 0 && typeof product.imageId === "string" && product.imageId) {
      imageIds.push(product.imageId);
    }

    const imagesDataUrls: string[] = [];
    for (const imgId of imageIds.slice(0, 6)) {
      const imageSnap = await realtimeDatabase.ref(`media/products/${imgId}/dataUrl`).get();
      const val = imageSnap.val();
      if (typeof val === "string") imagesDataUrls.push(val);
    }

    product.imageIds = imageIds;
    product.imageId = imageIds[0] ?? null;
    product.imageDataUrl = imagesDataUrls[0] ?? null;
    product.imagesDataUrls = imagesDataUrls;

    return Response.json({ item: { id, ...product } });
  } catch (error) {
    return apiError(error);
  }
}

export async function PUT(request: Request, context: Context) {
  try {
    const user = await requireAdmin(request);
    const { id } = await context.params;
    const body = asRecord(await request.json());
    if (!body || !validProduct(body)) {
      return Response.json({ error: "Informe nome, categoria, descrição, preço, estoque e status válidos." }, { status: 400 });
    }
    const ref = realtimeDatabase.ref(`products/${id}`);
    const existing = await ref.get();
    if (!existing.exists()) return Response.json({ error: "Produto não encontrado." }, { status: 404 });
    const current = existing.val();

    const imageIds = Array.isArray(body.imageIds)
      ? (body.imageIds as unknown[]).map(String).filter(Boolean).slice(0, 6)
      : typeof body.imageId === "string" && body.imageId
      ? [body.imageId]
      : Array.isArray(current.imageIds)
      ? current.imageIds
      : current.imageId
      ? [current.imageId]
      : [];

    const specs = body.specs && typeof body.specs === "object" && !Array.isArray(body.specs)
      ? (body.specs as Record<string, unknown>)
      : current.specs ?? {};

    const product = {
      name: String(body.name).trim(),
      category: String(body.category).trim(),
      description: String(body.description).trim(),
      price: Number(body.price),
      oldPrice: body.oldPrice == null || body.oldPrice === "" ? null : Number(body.oldPrice),
      stock: Number(body.stock),
      status: body.status,
      featured: body.featured === true,
      imageId: imageIds[0] ?? null,
      imageIds: imageIds,
      brand: typeof body.brand === "string" ? body.brand.trim() : current.brand ?? null,
      condition: typeof body.condition === "string" ? body.condition.trim() : current.condition ?? "Novo",
      specs: specs,
      createdBy: current.createdBy ?? user.uid,
      createdAt: current.createdAt ?? Date.now(),
      updatedAt: Date.now(),
    };
    await ref.set(product);
    return Response.json({ item: { id, ...product } });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: Request, context: Context) {
  try {
    await requireAdmin(request);
    const { id } = await context.params;
    const ref = realtimeDatabase.ref(`products/${id}`);
    const existing = await ref.get();
    if (!existing.exists()) return Response.json({ error: "Produto não encontrado." }, { status: 404 });
    await ref.remove();
    return Response.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
