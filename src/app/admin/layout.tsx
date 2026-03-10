import { redirect } from 'next/navigation'
import { getUserRole, hasRole } from '@/lib/auth'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const role = await getUserRole()

  if (!hasRole(role, 'admin')) {
    redirect('/')
  }

  return <>{children}</>
}
