import { requireAdmin } from "@/lib/require-user";
import { apiError } from "@/lib/api-response";
import { realtimeDatabase } from "@/lib/firebase-admin";

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    const [productsSnap, ordersSnap, usersSnap, negotiationsSnap] = await Promise.all([
      realtimeDatabase.ref("products").get(),
      realtimeDatabase.ref("orders").get(),
      realtimeDatabase.ref("users").get(),
      realtimeDatabase.ref("negotiations").get(),
    ]);
    const products = Object.values(productsSnap.val() ?? {}) as Record<string, unknown>[];
    const orders = Object.values(ordersSnap.val() ?? {}) as Record<string, unknown>[];
    const users = Object.values(usersSnap.val() ?? {}) as Record<string, unknown>[];
    const negotiations = Object.values(negotiationsSnap.val() ?? {}) as Record<string, unknown>[];
    const paidOrders = orders.filter((order) => ["paid", "processing", "shipped", "delivered"].includes(String(order.status)));
    const revenue = paidOrders.reduce((total, order) => total + Number(order.total ?? 0), 0);
    return Response.json({
      products: products.length,
      activeProducts: products.filter((product) => product.status === "active").length,
      orders: orders.length,
      paidOrders: paidOrders.length,
      customers: users.filter((user) => user.role === "buyer").length,
      vendors: users.filter((user) => user.role === "vendor").length,
      negotiations: negotiations.length,
      revenue,
      averageOrder: paidOrders.length ? revenue / paidOrders.length : 0,
    });
  } catch (error) {
    return apiError(error);
  }
}
