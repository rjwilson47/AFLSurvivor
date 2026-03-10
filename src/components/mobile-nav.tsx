'use client'

import { useState } from 'react'
import Link from 'next/link'

export function MobileNav({
  isLoggedIn,
  isAdmin,
  email,
}: {
  isLoggedIn: boolean
  isAdmin: boolean
  email?: string
}) {
  const [open, setOpen] = useState(false)

  return (
    <div className="sm:hidden">
      <button
        onClick={() => setOpen(!open)}
        className="p-1 text-zinc-600 dark:text-zinc-400"
        aria-label="Toggle menu"
      >
        <svg
          className="h-6 w-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          {open ? (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          ) : (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 12h16M4 18h16"
            />
          )}
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-50 border-b border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950">
          <nav className="flex flex-col gap-3 text-sm">
            <Link
              href="/rules"
              onClick={() => setOpen(false)}
              className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
            >
              Rules
            </Link>
            {isLoggedIn && (
              <Link
                href="/me"
                onClick={() => setOpen(false)}
                className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
              >
                My History
              </Link>
            )}
            {isAdmin && (
              <Link
                href="/admin"
                onClick={() => setOpen(false)}
                className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
              >
                Admin
              </Link>
            )}
            {isLoggedIn && (
              <>
                <span className="text-xs text-zinc-400 dark:text-zinc-500">
                  {email}
                </span>
                <form action="/auth/signout" method="POST">
                  <button
                    type="submit"
                    className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
                  >
                    Sign out
                  </button>
                </form>
              </>
            )}
            {!isLoggedIn && (
              <Link
                href="/login"
                onClick={() => setOpen(false)}
                className="rounded-lg bg-blue-600 px-3 py-1.5 text-center text-white hover:bg-blue-700"
              >
                Sign in
              </Link>
            )}
          </nav>
        </div>
      )}
    </div>
  )
}
