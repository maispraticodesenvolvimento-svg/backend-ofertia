import { realtimeDatabase } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/require-user";

const allowedCollections = new Set(["banners", "mobileBanners", "products"]);
const allowedImageTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export async function POST(request: Request) {
  try {
    const user = await requireAdmin(request);
    const body: unknown = await request.json();

    if (!body || typeof body !== "object") {
      return Response.json({ error: "O corpo da requisição deve ser um objeto JSON." }, { status: 400 });
    }

    const { collection, dataUrl, title, category } = body as {
      collection?: unknown;
      dataUrl?: unknown;
      title?: unknown;
      category?: unknown;
    };
    if (typeof collection !== "string" || !allowedCollections.has(collection)) {
      return Response.json({ error: "collection deve ser 'banners', 'mobileBanners' ou 'products'." }, { status: 400 });
    }
    if (typeof dataUrl !== "string") {
      return Response.json({ error: "dataUrl é obrigatório." }, { status: 400 });
    }

    const match = dataUrl.match(/^data:(image\/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/]+={0,2})$/);
    if (!match || !allowedImageTypes.has(match[1])) {
      return Response.json({ error: "Envie uma imagem JPEG, PNG, WebP ou GIF em formato data URL Base64." }, { status: 400 });
    }

    const maxBytes = Number(process.env.MEDIA_MAX_SIZE_MB ?? 8) * 1024 * 1024;
    if (Math.floor((match[2].length * 3) / 4) > maxBytes) {
      return Response.json({ error: `A imagem excede o limite de ${process.env.MEDIA_MAX_SIZE_MB ?? 8} MB.` }, { status: 413 });
    }
    const imageBytes = Buffer.from(match[2], "base64");

    const imageRef = realtimeDatabase.ref(`media/${collection}`).push();
    await imageRef.set({
      dataUrl,
      title: typeof title === "string" ? title.trim() : "",
      category: typeof category === "string" ? category.trim() : "",
      contentType: match[1],
      sizeBytes: imageBytes.byteLength,
      uploadedBy: user.uid,
      createdAt: Date.now(),
    });

    return Response.json({ id: imageRef.key, collection }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return Response.json({ error: "Token ausente ou inválido." }, { status: 401 });
    }
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return Response.json({ error: "Acesso restrito a administradores." }, { status: 403 });
    }
    if (error instanceof SyntaxError) {
      return Response.json({ error: "JSON inválido." }, { status: 400 });
    }

    console.error("Falha ao salvar imagem no Realtime Database:", error);
    return Response.json({ error: "Não foi possível salvar a imagem." }, { status: 500 });
  }
}
