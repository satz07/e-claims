import type React from "react"
import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { ClientWeb3Provider } from "@/components/providers/client-web3-provider"
import "./globals.css"

const _geist = Geist({ subsets: ["latin"] })
const _geistMono = Geist_Mono({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Fortiquo - Web3 Records",
  description: "Fetch and view blockchain records",
  generator: "Fortiquo",
  icons: {
    icon: [
      {
        url: "/Fortiquo_FavIcon.svg",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/Fortiquo_FavIcon.svg",
        media: "(prefers-color-scheme: dark)",
      },
      {
        url: "/Fortiquo_FavIcon.svg",
        type: "image/svg+xml",
      },
    ],
    apple: "/Fortiquo_FavIcon.svg",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`font-sans antialiased`} suppressHydrationWarning={true}>
        <ClientWeb3Provider>{children}</ClientWeb3Provider>
        <Analytics />
      </body>
    </html>
  )
}
