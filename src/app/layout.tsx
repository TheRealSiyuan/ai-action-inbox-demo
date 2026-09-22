import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
    title: "Action Inbox · Public demo",
    description: "Explore synthetic messages, review suggestions and simulate approved actions.",
};
export default function RootLayout({ children }: {
    children: React.ReactNode;
}) {
    return <html lang="en" className="h-full antialiased"><body className="bg-canvas min-h-full">{children}</body></html>;
}
