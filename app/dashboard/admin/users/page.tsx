'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { canManageUsers, getRoleDisplayName } from '@/lib/roles'
import { UserRole } from '@prisma/client'
import { toast } from 'sonner'

interface User {
  id: string
  name: string
  email: string
  role: UserRole
  _count?: {
    mentoredStudents: number
  }
}

export default function UsersPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'STUDENT' as UserRole
  })
  const [formError, setFormError] = useState('')

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    } else if (status === 'authenticated' && session?.user?.role && !canManageUsers(session.user.role)) {
      router.push('/dashboard')
    }
  }, [status, session, router])

  useEffect(() => {
    if (session?.user) {
      fetchUsers()
    }
  }, [session])

  const fetchUsers = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/users')
      if (!res.ok) throw new Error('Failed to fetch users')
      const data = await res.json()
      setUsers(data)
    } catch (error) {
      console.error('Failed to fetch users:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')

    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create user')
      }

      await fetchUsers()
      setShowCreateForm(false)
      setFormData({ name: '', email: '', password: '', role: 'STUDENT' })
    } catch (err: any) {
      setFormError(err.message || 'Failed to create user')
    }
  }

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingUser) return
    setFormError('')

    try {
      const res = await fetch(`/api/users/${editingUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          role: formData.role
        })
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to update user')
      }

      await fetchUsers()
      setEditingUser(null)
      setFormData({ name: '', email: '', password: '', role: 'STUDENT' })
    } catch (err: any) {
      setFormError(err.message || 'Failed to update user')
    }
  }

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      return
    }

    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: 'DELETE'
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to delete user')
      }

      await fetchUsers()
      toast.success('User deleted successfully!')
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete user')
    }
  }

  const startEdit = (user: User) => {
    setEditingUser(user)
    setFormData({
      name: user.name,
      email: user.email,
      password: '',
      role: user.role
    })
    setShowCreateForm(false)
    setFormError('')
  }

  const cancelForm = () => {
    setShowCreateForm(false)
    setEditingUser(null)
    setFormData({ name: '', email: '', password: '', role: 'STUDENT' })
    setFormError('')
  }

  if (loading || status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    )
  }

  // SERVANT_PREP can only create STUDENT users, SUPER_ADMIN can create all
  const roleOptions: UserRole[] = session?.user?.role === 'SERVANT_PREP'
    ? ['STUDENT']
    : ['SUPER_ADMIN', 'PRIEST', 'SERVANT_PREP', 'MENTOR', 'STUDENT']

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">User Management</h1>
            <p className="text-gray-600 mt-1">Create and manage all users</p>
          </div>
          <Button
            onClick={() => {
              setShowCreateForm(true)
              setEditingUser(null)
              setFormData({ name: '', email: '', password: '', role: 'STUDENT' })
            }}
            disabled={showCreateForm || editingUser !== null}
          >
            + Create User
          </Button>
        </div>

        {/* Create/Edit Form */}
        {(showCreateForm || editingUser) && (
          <Card>
            <CardHeader>
              <CardTitle>{editingUser ? 'Edit User' : 'Create New User'}</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={editingUser ? handleUpdateUser : handleCreateUser} className="space-y-4">
                {formError && (
                  <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
                    {formError}
                  </div>
                )}

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="name">Full Name</Label>
                    <Input
                      id="name"
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      required
                    />
                  </div>

                  {!editingUser && (
                    <div>
                      <Label htmlFor="password">Password</Label>
                      <Input
                        id="password"
                        type="password"
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        required
                      />
                    </div>
                  )}

                  <div>
                    <Label htmlFor="role">Role</Label>
                    <select
                      id="role"
                      value={formData.role}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      required
                    >
                      {roleOptions.map(role => (
                        <option key={role} value={role}>
                          {getRoleDisplayName(role)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button type="submit">
                    {editingUser ? 'Update User' : 'Create User'}
                  </Button>
                  <Button type="button" variant="outline" onClick={cancelForm}>
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Users List */}
        <Card>
          <CardHeader>
            <CardTitle>All Users ({users.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left p-2 w-8">#</th>
                    <th className="text-left p-2">Name</th>
                    <th className="text-left p-2">Email</th>
                    <th className="text-center p-2 w-40">Role</th>
                    <th className="text-center p-2 w-24">Mentees</th>
                    <th className="text-center p-2 w-40">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user, index) => {
                    const isCurrentUser = user.id === session?.user?.id

                    return (
                      <tr key={user.id} className="border-b hover:bg-gray-50">
                        <td className="p-2 text-gray-500">{index + 1}</td>
                        <td className="p-2 font-medium">
                          {user.name}
                          {isCurrentUser && (
                            <Badge variant="outline" className="ml-2 text-xs">You</Badge>
                          )}
                        </td>
                        <td className="p-2 text-gray-600">{user.email}</td>
                        <td className="p-2 text-center">
                          <Badge
                            className={
                              user.role === 'SUPER_ADMIN' ? 'bg-purple-600' :
                              user.role === 'PRIEST' ? 'bg-blue-600' :
                              user.role === 'SERVANT_PREP' ? 'bg-green-600' :
                              user.role === 'MENTOR' ? 'bg-yellow-600' :
                              'bg-gray-600'
                            }
                          >
                            {getRoleDisplayName(user.role)}
                          </Badge>
                        </td>
                        <td className="p-2 text-center">
                          {user.role === 'MENTOR' || user.role === 'SERVANT_PREP' ? (
                            <span className="font-medium">{user._count?.mentoredStudents || 0}</span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="p-2">
                          <div className="flex justify-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => startEdit(user)}
                            >
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleDeleteUser(user.id)}
                              disabled={isCurrentUser}
                            >
                              Delete
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>

              {users.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No users found
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
