'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'

function LoginForm() {
  const searchParams = useSearchParams()
  const urlError = searchParams.get('error')
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'sent' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('loading')
    setErrorMessage('')

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (error) {
      setStatus('error')
      setErrorMessage(error.message)
    } else {
      setStatus('sent')
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 dark:bg-zinc-950">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            AFL Survivor Pool
          </h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Sign in with your email to continue
          </p>
        </div>

        {urlError === 'link_expired' && status === 'idle' && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-center dark:border-amber-800 dark:bg-amber-950">
            <p className="font-medium text-amber-800 dark:text-amber-200">
              Magic link expired
            </p>
            <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">
              That link has already been used or has expired. Enter your email below to get a new one.
            </p>
          </div>
        )}

        {urlError === 'auth_failed' && status === 'idle' && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-center dark:border-red-800 dark:bg-red-950">
            <p className="font-medium text-red-800 dark:text-red-200">
              Sign in failed
            </p>
            <p className="mt-1 text-sm text-red-700 dark:text-red-300">
              Something went wrong. Please try signing in again.
            </p>
          </div>
        )}

        {status === 'sent' ? (
          <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-center dark:border-green-800 dark:bg-green-950">
            <p className="font-medium text-green-800 dark:text-green-200">
              Check your email
            </p>
            <p className="mt-1 text-sm text-green-700 dark:text-green-300">
              We sent a magic link to <strong>{email}</strong>. Click it to sign in.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                Email address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 placeholder-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50 dark:placeholder-zinc-500"
              />
            </div>

            {status === 'error' && (
              <p className="text-sm text-red-600 dark:text-red-400">
                {errorMessage}
              </p>
            )}

            <button
              type="submit"
              disabled={status === 'loading'}
              className="w-full rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 dark:focus:ring-offset-zinc-900"
            >
              {status === 'loading' ? 'Sending...' : 'Send Magic Link'}
            </button>
          </form>
        )}

        <div className="mt-6 text-center">
          <a
            href="/"
            className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            Back to Homepage
          </a>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
