"use client"

import { Search, Menu, X } from "lucide-react"
import Image from "next/image"
import { useState } from "react"
import { Button } from "./ui/button"
import { useRouter, usePathname } from "next/navigation"

export function Sidebar() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const router = useRouter()
  const pathname = usePathname()

  const navigate = (path: string) => {
    router.push(path)
    setIsMobileMenuOpen(false)
  }

  const navItemClass = (path: string) =>
    `hover:cursor-pointer w-full px-6 py-3 flex items-center gap-3 text-white mb-2
     ${pathname === path ? "bg-sidebar-border" : ""}`

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-4 left-4 z-50 lg:hidden bg-sidebar text-white hover:bg-sidebar-accent"
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
      >
        {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </Button>

      <aside
        className={`
          fixed lg:static inset-y-0 left-0 z-40
          w-[275px] bg-sidebar text-sidebar-foreground flex flex-col
          transform transition-transform duration-200 ease-in-out
          ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        `}
      >
        <div className="bg-sidebar-accent px-6 py-5 flex items-center gap-3">
          <div className="w-full h-12 relative flex-shrink-0">
            <Image
              src="/SHA-logo.svg"
              alt="SHA Logo"
              fill
              className="object-contain"
            />
          </div>
          {/* <div className="flex flex-col">
            <div className="text-2xl font-bold tracking-tight">SHA</div>
            <div className="text-xs text-green-300 font-medium">
              Social Health Authority
            </div>
          </div> */}
        </div>

        <nav className="flex-1 py-4">
          <button
            className={navItemClass("/")}
            onClick={() => navigate("/")}
          >
            <span className="font-medium">Claims</span>
          </button>

          <button
            className={navItemClass("/submit")}
            onClick={() => navigate("/submit")}
          >
            <span className="font-medium">Submit FHIR</span>
          </button>

          <button
            className={navItemClass("/browse")}
            onClick={() => navigate("/browse")}
          >
            <span className="font-medium">Browse claims</span>
          </button>

          <button
            className={navItemClass("/citizen-registry")}
            onClick={() => navigate("/citizen-registry")}
          >
            <span className="font-medium">Citizen registry</span>
          </button>

          <button
            className={navItemClass("/clinician-registry")}
            onClick={() => navigate("/clinician-registry")}
          >
            <span className="font-medium">Clinician registry</span>
          </button>

          <button
            className={navItemClass("/insurer-registry")}
            onClick={() => navigate("/insurer-registry")}
          >
            <span className="font-medium">Insurer registry</span>
          </button>

          <button
            className={navItemClass("/provider-registry")}
            onClick={() => navigate("/provider-registry")}
          >
            <span className="font-medium">Provider registry</span>
          </button>

          <button
            className={navItemClass("/issue-claim")}
            onClick={() => navigate("/issue-claim")}
          >
            <span className="font-medium">Issue Claim (demo)</span>
          </button>

          <button
            className={navItemClass("/search")}
            onClick={() => navigate("/search")}
          >
            <span className="font-medium">Search Claim</span>
            <Search className="w-5 h-5" />
          </button>
        </nav>
      </aside>

      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
    </>
  )
}
