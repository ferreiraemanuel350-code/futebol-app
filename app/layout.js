import "./globals.css";

export const metadata = {
  title: "Boletim de Resultados",
  description: "Resultados, tabela e estimativas de futebol",
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
