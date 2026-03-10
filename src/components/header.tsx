import Link from 'next/link'
import { getUser, getUserRole, hasRole } from '@/lib/auth'
import { MobileNav } from './mobile-nav'

export async function Header() {
  const user = await getUser()
  const role = await getUserRole()
  const isAdmin = hasRole(role, 'admin')

  return (
    <header className="relative border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-6">
          <Link
            href="/"
            className="text-lg font-bold text-zinc-900 dark:text-zinc-50"
          >
            AFL Survivor Pool
          </Link>
          <nav className="hidden items-center gap-4 text-sm sm:flex">
            <Link
              href="/rules"
              className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
            >
              Rules
            </Link>
            {user && (
              <Link
                href="/me"
                className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
              >
                My History
              </Link>
            )}
            {isAdmin && (
              <Link
                href="/admin"
                className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
              >
                Admin
              </Link>
            )}
          </nav>
        </div>
        <div className="flex items-center gap-3 text-sm">
          {user ? (
            <>
              <span className="hidden text-zinc-500 dark:text-zinc-400 sm:inline">
                {user.email}
              </span>
              <form action="/auth/signout" method="POST" className="hidden sm:block">
                <button
                  type="submit"
                  className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
                >
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <Link
              href="/login"
              className="hidden rounded-lg bg-blue-600 px-3 py-1.5 text-white hover:bg-blue-700 sm:inline-block"
            >
              Sign in
            </Link>
          )}
          <MobileNav
            isLoggedIn={!!user}
            isAdmin={isAdmin}
            email={user?.email}
          />
        </div>
      </div>
    </header>
  )
}
