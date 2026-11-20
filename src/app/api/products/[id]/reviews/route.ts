import { requireUser } from "@/lib/require-user";
import { apiError, asRecord } from "@/lib/api-response";
import { realtimeDatabase } from "@/lib/firebase-admin";

type Context = { params: Promise<{ id: string }> };

async function resolveProductId(request: Request, context?: Context): Promise<string> {
  try {
    if (context?.params) {
      const resolved = await context.params;
      if (resolved?.id) return decodeURIComponent(resolved.id);
    }
  } catch (_) {}

  // Fallback seguro via URL
  const segments = new URL(request.url).pathname.split("/").filter(Boolean);
  const prodIdx = segments.indexOf("products");
  if (prodIdx !== -1 && segments[prodIdx + 1] && segments[prodIdx + 1] !== "reviews") {
    return decodeURIComponent(segments[prodIdx + 1]);
  }
  return "";
}

export async function GET(request: Request, context: Context) {
  try {
    const id = await resolveProductId(request, context);
    if (!id) return Response.json({ error: "ID do produto inválido." }, { status: 400 });

    const snapshot = await realtimeDatabase.ref(`productReviews/${id}`).get();
    const values = snapshot.val() as Record<string, unknown> | null;
    const items = Object.entries(values ?? {}).map(([rid, review]) => ({
      id: rid,
      ...(asRecord(review) ?? {}),
    }));

    // Ordena do mais recente para o mais antigo
    items.sort((a: any, b: any) => Number(b.createdAt ?? 0) - Number(a.createdAt ?? 0));
    return Response.json({ items });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request, context: Context) {
  try {
    const user = await requireUser(request);
    const id = await resolveProductId(request, context);
    if (!id) return Response.json({ error: "ID do produto inválido." }, { status: 400 });

    const body = asRecord(await request.json());
    if (!body) return Response.json({ error: "Informe os dados da avaliação." }, { status: 400 });

    const stars = Number(body.stars);
    if (isNaN(stars) || stars < 1 || stars > 5) {
      return Response.json({ error: "A nota deve ser entre 1 e 5 estrelas." }, { status: 400 });
    }

    const comment = String(body.comment ?? "").trim();
    if (!comment) {
      return Response.json({ error: "O comentário não pode estar vazio." }, { status: 400 });
    }

    // Busca avaliações existentes do produto sem depender de índice no Firebase
    const existingSnap = await realtimeDatabase.ref(`productReviews/${id}`).get();
    const existingReviews = existingSnap.val() as Record<string, Record<string, unknown>> | null;
    if (existingReviews) {
      const alreadyReviewed = Object.values(existingReviews).some(
        (rev) => rev && typeof rev === "object" && rev.userId === user.uid
      );
      if (alreadyReviewed) {
        return Response.json({ error: "Você já avaliou este produto." }, { status: 409 });
      }
    }

    // Tenta obter o nome cadastrado do usuário, senão usa parte do e-mail
    let userName = user.email?.split("@")[0] ?? "Usuário";
    try {
      const userProfileSnap = await realtimeDatabase.ref(`users/${user.uid}/name`).get();
      const profileName = userProfileSnap.val();
      if (typeof profileName === "string" && profileName.trim().length > 0) {
        userName = profileName.trim();
      }
    } catch (_) {}

    const ref = realtimeDatabase.ref(`productReviews/${id}`).push();
    const review = {
      userId: user.uid,
      userName,
      stars: Math.round(stars),
      comment,
      createdAt: Date.now(),
    };
    await ref.set(review);

    return Response.json({ item: { id: ref.key, ...review } }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: Request, context: Context) {
  try {
    const user = await requireUser(request);
    const id = await resolveProductId(request, context);
    if (!id) return Response.json({ error: "ID do produto inválido." }, { status: 400 });

    const url = new URL(request.url);
    const reviewId = url.searchParams.get("reviewId");
    if (!reviewId) return Response.json({ error: "Informe o reviewId." }, { status: 400 });

    const snapshot = await realtimeDatabase.ref(`productReviews/${id}/${reviewId}`).get();
    if (!snapshot.exists()) return Response.json({ error: "Avaliação não encontrada." }, { status: 404 });

    const review = asRecord(snapshot.val());
    if (review?.userId !== user.uid) {
      return Response.json({ error: "Você não tem permissão para remover esta avaliação." }, { status: 403 });
    }

    await realtimeDatabase.ref(`productReviews/${id}/${reviewId}`).remove();
    return Response.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
