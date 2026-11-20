import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Ofertia API",
  description: "Backend da Ofertia",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
