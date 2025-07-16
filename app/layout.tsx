import type React from "react"
import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "ScoreSync",
  description: "ScoreSync is a centralized platform to view detailed judgment sheets and scores for event participants in real-time.",
  generator: "JUDGEMENT",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
