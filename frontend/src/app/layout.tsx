import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { fontVariables } from "@/lib/fonts";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pinprint — fine art maps of the places that matter",
  description:
    "Turn the places you're tied to into a custom fine art print — an arrow to each one in its true compass direction from home, with the real distance beside it. Designed by you, made to order.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${fontVariables} h-full antialiased`}>
      <body className="min-h-full bg-canvas text-body">
        <Providers>{children}</Providers>
        <Analytics />
      </body>
    </html>
  );
}
