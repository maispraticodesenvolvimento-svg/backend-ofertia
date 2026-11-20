export function apiError(error: unknown) {
  if (error instanceof Error && error.message === "UNAUTHORIZED") {
    return Response.json({ error: "Token ausente ou inválido." }, { status: 401 });
  }
  if (error instanceof Error && error.message === "FORBIDDEN") {
    return Response.json({ error: "Acesso restrito a administradores." }, { status: 403 });
  }
  if (error instanceof SyntaxError) {
    return Response.json({ error: "JSON inválido." }, { status: 400 });
  }
  console.error("Erro na API:", error);
  const message = error instanceof Error ? error.message : "Não foi possível concluir a operação.";
  return Response.json({ error: message }, { status: 500 });
}

export function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

export function validProduct(value: Record<string, unknown>) {
  const oldPrice = value.oldPrice;
  const price = value.price;
  return typeof value.name === "string" && value.name.trim().length > 0 &&
    typeof value.category === "string" && value.category.trim().length > 0 &&
    typeof value.description === "string" &&
    (price == null || price === "" || (Number.isFinite(Number(price)) && Number(price) >= 0)) &&
    (value.stock == null || Number.isInteger(Number(value.stock))) &&
    (oldPrice == null || oldPrice === "" || (Number.isFinite(Number(oldPrice)) && Number(oldPrice) >= 0)) &&
    (value.status === "active" || value.status === "inactive" || value.status == null);
}
