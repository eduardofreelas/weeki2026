import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Weeki — Minha Semana",
  description: "Organize demandas, prazos e clientes em uma semana mais clara.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
