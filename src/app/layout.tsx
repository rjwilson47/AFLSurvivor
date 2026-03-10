import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AFL Survivor Pool",
  description: "AFL Survivor Pool — tip the loser, last one standing wins.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
