import { requireUser } from "@/lib/require-user";
import { apiError, asRecord } from "@/lib/api-response";
import { realtimeDatabase } from "@/lib/firebase-admin";

export async function GET(request: Request) {
  try {
    const user = await requireUser(request);

    // Carrega ofertas vendidas e pedidos do usuário
    const offersSnap = await realtimeDatabase.ref(`userOffers/${user.uid}`).get();
    const offers = Object.values(offersSnap.val() ?? {}) as Array<Record<string, unknown>>;

    const withdrawalsSnap = await realtimeDatabase.ref(`userWithdrawals/${user.uid}`).get();
    const withdrawals = Object.entries(withdrawalsSnap.val() ?? {}).map(([id, w]) => ({
      id,
      ...(asRecord(w) ?? {}),
    }));
    withdrawals.sort((a: any, b: any) => Number(b.createdAt ?? 0) - Number(a.createdAt ?? 0));

    // Cálculos de faturamento e saldo
    const totalSold = offers
      .filter((o) => o.type === "sell" && o.status === "sold")
      .reduce((acc, curr) => acc + Number(curr.price ?? 0), 0);

    const totalActiveSell = offers
      .filter((o) => o.type === "sell" && (o.status === "active" || o.status == null))
      .reduce((acc, curr) => acc + Number(curr.price ?? 0), 0);

    const totalWithdrawn = withdrawals
      .filter((w: any) => w.status === "approved" || w.status === "pending")
      .reduce((acc, curr: any) => acc + Number(curr.amount ?? 0), 0);

    // Saldo disponível = faturado - retirado
    const availableBalance = Math.max(0, totalSold - totalWithdrawn);

    return Response.json({
      finance: {
        availableBalance,
        totalSold,
        totalActiveSell,
        totalWithdrawn,
        salesCount: offers.filter((o) => o.type === "sell" && o.status === "sold").length,
        activeOffersCount: offers.filter((o) => o.status === "active" || o.status == null).length,
      },
      withdrawals,
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    const body = asRecord(await request.json());
    if (!body) return Response.json({ error: "Informe os dados do saque." }, { status: 400 });

    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return Response.json({ error: "Informe um valor de saque válido." }, { status: 400 });
    }

    const pixKey = String(body.pixKey ?? "").trim();
    const pixType = String(body.pixType ?? "CPF").trim();
    if (!pixKey) {
      return Response.json({ error: "Informe a chave Pix para recebimento." }, { status: 400 });
    }

    const ref = realtimeDatabase.ref(`userWithdrawals/${user.uid}`).push();
    const withdrawal = {
      userId: user.uid,
      userEmail: user.email ?? null,
      amount,
      pixKey,
      pixType,
      status: "pending", // pending | approved | rejected
      createdAt: Date.now(),
    };
    await ref.set(withdrawal);

    return Response.json({ item: { id: ref.key, ...withdrawal } }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}

