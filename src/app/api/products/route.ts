import { requireAdmin } from "@/lib/require-user";
import { apiError, asRecord, validProduct } from "@/lib/api-response";
import { realtimeDatabase } from "@/lib/firebase-admin";

function toList(value: unknown) {
  if (!value || typeof value !== "object") return [];
  return Object.entries(value as Record<string, Record<string, unknown>>)
    .map(([id, product]) => ({ id, ...product }))
    .sort((a, b) => Number(b.updatedAt ?? b.createdAt ?? 0) - Number(a.updatedAt ?? a.createdAt ?? 0));
}

async function withImage(product: Record<string, unknown>) {
  const imageIds = Array.isArray(product.imageIds) ? (product.imageIds as unknown[]).map(String) : [];
  if (imageIds.length === 0 && typeof product.imageId === "string" && product.imageId) {
    imageIds.push(product.imageId);
  }

  if (imageIds.length === 0) return product;

  const imagesDataUrls: string[] = [];
  for (const imgId of imageIds.slice(0, 6)) {
    const snap = await realtimeDatabase.ref(`media/products/${imgId}/dataUrl`).get();
    const val = snap.val();
    if (typeof val === "string") imagesDataUrls.push(val);
  }

  return {
    ...product,
    imageIds,
    imageId: imageIds[0] ?? null,
    imageDataUrl: imagesDataUrls[0] ?? null,
    imagesDataUrls,
  };
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const includeInactive = url.searchParams.get("all") === "true";
    if (includeInactive) await requireAdmin(request);

    const snapshot = await realtimeDatabase.ref("products").get();
    let products = toList(snapshot.val());
    if (!includeInactive) products = products.filter((product) => product.status === "active");
    const category = url.searchParams.get("category");
    if (category) products = products.filter((product) => product.category === category);
    if (url.searchParams.get("offers") === "true") {
      products = products.filter((product) => Number(product.oldPrice) > Number(product.price));
    }
    if (url.searchParams.get("featured") === "true") {
      products = products.filter((product) => product.featured === true);
    }
    const query = url.searchParams.get("q")?.trim().toLowerCase();
    if (query) products = products.filter((product) =>
      `${product.name ?? ""} ${product.category ?? ""} ${product.description ?? ""}`.toLowerCase().includes(query),
    );
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 100), 1), 200);
    products = await Promise.all(products.slice(0, limit).map(withImage));
    return Response.json({ items: products });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAdmin(request);
    const body = asRecord(await request.json());
    if (!body || !validProduct(body)) {
      return Response.json({ error: "Informe nome, categoria, descrição, preço, estoque e status válidos." }, { status: 400 });
    }

    const ref = realtimeDatabase.ref("products").push();
    const now = Date.now();
    const imageIds = Array.isArray(body.imageIds)
      ? (body.imageIds as unknown[]).map(String).filter(Boolean).slice(0, 6)
      : typeof body.imageId === "string" && body.imageId
      ? [body.imageId]
      : [];

    const specs = body.specs && typeof body.specs === "object" && !Array.isArray(body.specs)
      ? (body.specs as Record<string, unknown>)
      : {};

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
      brand: typeof body.brand === "string" ? body.brand.trim() : null,
      condition: typeof body.condition === "string" ? body.condition.trim() : "Novo",
      specs: specs,
      createdBy: user.uid,
      createdAt: now,
      updatedAt: now,
    };
    await ref.set(product);
    return Response.json({ item: { id: ref.key, ...product } }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
