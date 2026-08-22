import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import ReferralTracker from "@/components/ReferralTracker";

export const metadata: Metadata = {
  title: "EvaluLabs | AI Interview Practice",
  description: "Practice real interviews with an AI interviewer.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body>
        <AuthProvider><ReferralTracker />{children}</AuthProvider>
      </body>
    </html>
  );
}
