import type React from "react"
import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "ScoreSync",
  description: "ScoreSync is a website that's made it easier for both judges and OC to keep a record of the marks",
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
