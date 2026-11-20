import { requireUser } from "@/lib/require-user";
import { apiError, asRecord } from "@/lib/api-response";
import { FreightError, quoteOfferFreight } from "@/lib/melhor-envio";

export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    const body = asRecord(await request.json());
    const productId = body?.productId;
    const offerId = body?.offerId;
    const destinationPostalCode = body?.destinationPostalCode;
    const quantity = Number(body?.quantity ?? 1);

    if (typeof productId !== "string" || !productId ||
        typeof offerId !== "string" || !offerId ||
        !Number.isInteger(quantity) || quantity < 1 || quantity > 20) {
      return Response.json({ error: "Produto, oferta e quantidade válida são obrigatórios." }, { status: 400 });
    }

    const quote = await quoteOfferFreight({
      buyerUid: user.uid,
      productId,
      offerId,
      destinationPostalCode: typeof destinationPostalCode === "string" ? destinationPostalCode : undefined,
      quantity,
    });
    return Response.json({ items: quote.options, fromPostalCode: quote.fromPostalCode, toPostalCode: quote.toPostalCode });
  } catch (error) {
    if (error instanceof FreightError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    return apiError(error);
  }
}
