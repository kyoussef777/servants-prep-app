'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { canManageUsers, getRoleDisplayName } from '@/lib/roles'
import { UserRole } from '@prisma/client'
import { toast } from 'sonner'
import { Camera, Trash2 } from 'lucide-react'

interface User {
  id: string
  name: string
  email: string
  phone?: string
  profileImageUrl?: string | null
  role: UserRole
  isDisabled?: boolean
  _count?: {
    mentoredStudents: number
  }
}

export default function UsersPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [isFiltering, setIsFiltering] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)

  // Bulk selection state (SUPER_ADMIN only)
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set())
  const [isBulkProcessing, setIsBulkProcessing] = useState(false)

  // Confirmation dialog state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null)
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false)
  const [bulkAction, setBulkAction] = useState<'enable' | 'disable' | null>(null)

  // Password reset dialog state
  const [passwordResetOpen, setPasswordResetOpen] = useState(false)
  const [newPassword, setNewPassword] = useState('')

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<UserRole | ''>('')

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
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

  const fetchUsers = useCallback(async (search?: string, role?: string, isInitialLoad = false) => {
    try {
      if (isInitialLoad) {
        setLoading(true)
      } else {
        setIsFiltering(true)
      }
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (role) params.set('role', role)

      const url = `/api/users${params.toString() ? `?${params.toString()}` : ''}`
      const res = await fetch(url)
      if (!res.ok) throw new Error('Failed to fetch users')
      const data = await res.json()
      setUsers(data)
    } catch (error) {
      console.error('Failed to fetch users:', error)
    } finally {
      setLoading(false)
      setIsFiltering(false)
    }
  }, [])

  // Track if this is the initial load
  const [hasInitiallyLoaded, setHasInitiallyLoaded] = useState(false)

  useEffect(() => {
    if (session?.user) {
      const isInitial = !hasInitiallyLoaded
      fetchUsers(debouncedSearch, roleFilter, isInitial)
      if (!hasInitiallyLoaded) {
        setHasInitiallyLoaded(true)
      }
    }
  }, [session, debouncedSearch, roleFilter, fetchUsers, hasInitiallyLoaded])

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

      await fetchUsers(debouncedSearch, roleFilter)
      setShowCreateForm(false)
      setFormData({ name: '', email: '', phone: '', password: '', role: 'STUDENT' })
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to create user')
    }
  }

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingUser) return
    setFormError('')

    try {
      const updatePayload: Record<string, unknown> = {
        name: formData.name,
        email: formData.email,
        phone: formData.phone || null,
        role: formData.role
      }

      // Include password only if provided (SUPER_ADMIN only)
      if (formData.password) {
        updatePayload.password = formData.password
      }

      const res = await fetch(`/api/users/${editingUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatePayload)
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to update user')
      }

      await fetchUsers(debouncedSearch, roleFilter)

      // Show appropriate success message
      if (formData.password) {
        toast.success('User updated with new password', {
          description: 'User will be prompted to change password on next login'
        })
      } else {
        toast.success('User updated successfully')
      }

      setEditingUser(null)
      setFormData({ name: '', email: '', phone: '', password: '', role: 'STUDENT' })
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to update user')
    }
  }

  const handleDeleteUser = (userId: string) => {
    setDeleteUserId(userId)
    setDeleteConfirmOpen(true)
  }

  const confirmDeleteUser = async () => {
    if (!deleteUserId) return

    try {
      const res = await fetch(`/api/users/${deleteUserId}`, {
        method: 'DELETE'
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to delete user')
      }

      await fetchUsers(debouncedSearch, roleFilter)
      toast.success('User deleted successfully!')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete user')
    } finally {
      setDeleteConfirmOpen(false)
      setDeleteUserId(null)
    }
  }

  const startEdit = (user: User) => {
    setEditingUser(user)
    setFormData({
      name: user.name,
      email: user.email,
      phone: user.phone || '',
      password: '',
      role: user.role
    })
    setShowCreateForm(false)
    setFormError('')
  }

  const cancelForm = () => {
    setShowCreateForm(false)
    setEditingUser(null)
    setFormData({ name: '', email: '', phone: '', password: '', role: 'STUDENT' })
    setFormError('')
  }

  const [uploadingPhoto, setUploadingPhoto] = useState(false)

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !editingUser) return

    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif']
    if (!allowedTypes.includes(file.type)) {
      toast.error('Please upload PNG, JPG, or GIF')
      return
    }
    if (file.size > 4.5 * 1024 * 1024) {
      toast.error('File size exceeds 4.5 MB limit')
      return
    }

    setUploadingPhoto(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('userId', editingUser.id)

      const res = await fetch('/api/profile-picture/upload', {
        method: 'POST',
        body: fd,
      })

      if (res.ok) {
        const data = await res.json()
        setEditingUser({ ...editingUser, profileImageUrl: data.url })
        setUsers(prev => prev.map(u => u.id === editingUser.id ? { ...u, profileImageUrl: data.url } : u))
        toast.success('Profile picture updated!')
      } else {
        const data = await res.json()
        toast.error(data.error || 'Failed to upload photo')
      }
    } catch (error) {
      console.error('Failed to upload photo:', error)
      toast.error('Failed to upload photo')
    } finally {
      setUploadingPhoto(false)
      e.target.value = ''
    }
  }

  const handleRemovePhoto = async () => {
    if (!editingUser) return
    setUploadingPhoto(true)
    try {
      const res = await fetch(`/api/users/${editingUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileImageUrl: null }),
      })
      if (res.ok) {
        setEditingUser({ ...editingUser, profileImageUrl: null })
        setUsers(prev => prev.map(u => u.id === editingUser.id ? { ...u, profileImageUrl: null } : u))
        toast.success('Profile picture removed!')
      } else {
        const data = await res.json()
        toast.error(data.error || 'Failed to remove photo')
      }
    } catch (error) {
      console.error('Failed to remove photo:', error)
      toast.error('Failed to remove photo')
    } finally {
      setUploadingPhoto(false)
    }
  }

  // Bulk selection handlers (SUPER_ADMIN only)
  const toggleUserSelection = (userId: string) => {
    const newSelected = new Set(selectedUsers)
    if (newSelected.has(userId)) {
      newSelected.delete(userId)
    } else {
      newSelected.add(userId)
    }
    setSelectedUsers(newSelected)
  }

  const toggleSelectAll = () => {
    if (selectedUsers.size === selectableUsers.length) {
      setSelectedUsers(new Set())
    } else {
      setSelectedUsers(new Set(selectableUsers.map(u => u.id)))
    }
  }

  const handleBulkDisable = (disable: boolean) => {
    if (selectedUsers.size === 0) return
    setBulkAction(disable ? 'disable' : 'enable')
    setBulkConfirmOpen(true)
  }

  const confirmBulkAction = async () => {
    if (!bulkAction || selectedUsers.size === 0) return

    const disable = bulkAction === 'disable'
    const action = bulkAction

    setIsBulkProcessing(true)
    try {
      const res = await fetch('/api/users/bulk-disable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userIds: Array.from(selectedUsers),
          isDisabled: disable
        })
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || `Failed to ${action} users`)
      }

      toast.success(`Successfully ${action}d ${data.updatedCount} user(s)`)
      setSelectedUsers(new Set())
      await fetchUsers(debouncedSearch, roleFilter)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Failed to ${action} users`)
    } finally {
      setIsBulkProcessing(false)
      setBulkConfirmOpen(false)
      setBulkAction(null)
    }
  }

  const handleBulkPasswordReset = () => {
    if (selectedUsers.size === 0) return
    setNewPassword('')
    setPasswordResetOpen(true)
  }

  const confirmPasswordReset = async () => {
    if (selectedUsers.size === 0 || !newPassword) return

    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters')
      return
    }

    setIsBulkProcessing(true)
    try {
      const res = await fetch('/api/users/bulk-reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userIds: Array.from(selectedUsers),
          newPassword
        })
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to reset passwords')
      }

      toast.success(`Password reset for ${data.updatedCount} user(s)`, {
        description: 'Users will be prompted to change password on next login'
      })
      setSelectedUsers(new Set())
      setNewPassword('')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to reset passwords')
    } finally {
      setIsBulkProcessing(false)
      setPasswordResetOpen(false)
    }
  }

  // Users that can be selected for bulk operations (not SUPER_ADMIN, not current user)
  const selectableUsers = users.filter(u => u.role !== 'SUPER_ADMIN' && u.id !== session?.user?.id)
  const isSuperAdmin = session?.user?.role === 'SUPER_ADMIN'

  if (loading || status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    )
  }

  // SERVANT_PREP can only create STUDENT and MENTOR users, SUPER_ADMIN can create all
  const roleOptions: UserRole[] = session?.user?.role === 'SERVANT_PREP'
    ? ['STUDENT', 'MENTOR']
    : ['SUPER_ADMIN', 'PRIEST', 'SERVANT_PREP', 'MENTOR', 'STUDENT']

  // Filter options based on role permissions
  // SERVANT_PREP can only filter by STUDENT, MENTOR, or SERVANT_PREP
  // SUPER_ADMIN/PRIEST can filter by all roles
  const filterRoleOptions: UserRole[] = session?.user?.role === 'SERVANT_PREP'
    ? ['STUDENT', 'MENTOR', 'SERVANT_PREP']
    : ['SUPER_ADMIN', 'PRIEST', 'SERVANT_PREP', 'MENTOR', 'STUDENT']

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold">User Management</h1>
            <p className="text-gray-600 mt-1">Create and manage all users</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {/* Bulk Actions (SUPER_ADMIN only) */}
            {isSuperAdmin && (
              <>
                {/* Select All / Clear All button */}
                <Button
                  variant="outline"
                  onClick={toggleSelectAll}
                  disabled={isBulkProcessing || selectableUsers.length === 0}
                  className="text-xs md:text-sm"
                >
                  {selectedUsers.size === selectableUsers.length && selectableUsers.length > 0
                    ? `Deselect All`
                    : `Select All (${selectableUsers.length})`}
                </Button>
                {selectedUsers.size > 0 && (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => handleBulkDisable(true)}
                      disabled={isBulkProcessing}
                      className="text-red-600 border-red-300 hover:bg-red-50 text-xs md:text-sm"
                    >
                      {isBulkProcessing ? 'Processing...' : `Disable (${selectedUsers.size})`}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleBulkDisable(false)}
                      disabled={isBulkProcessing}
                      className="text-green-600 border-green-300 hover:bg-green-50 text-xs md:text-sm"
                    >
                      {isBulkProcessing ? 'Processing...' : `Enable (${selectedUsers.size})`}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleBulkPasswordReset}
                      disabled={isBulkProcessing}
                      className="text-blue-600 border-blue-300 hover:bg-blue-50 text-xs md:text-sm"
                    >
                      {isBulkProcessing ? 'Processing...' : `Reset Password (${selectedUsers.size})`}
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => setSelectedUsers(new Set())}
                      disabled={isBulkProcessing}
                      className="text-xs md:text-sm"
                    >
                      Clear
                    </Button>
                  </>
                )}
              </>
            )}
            <Button
              onClick={() => {
                setShowCreateForm(true)
                setEditingUser(null)
                setFormData({ name: '', email: '', phone: '', password: '', role: 'STUDENT' })
              }}
              disabled={showCreateForm || editingUser !== null}
            >
              + Create User
            </Button>
          </div>
        </div>

        {/* Search and Filter */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4 items-center">
              <div className="flex-1 relative w-full">
                <Label htmlFor="search" className="sr-only">Search users</Label>
                <Input
                  id="search"
                  type="text"
                  placeholder="Search by name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full"
                />
                {isFiltering && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <div className="h-4 w-4 border-2 border-maroon-600 border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
              </div>
              <div className="w-full md:w-48">
                <Label htmlFor="roleFilter" className="sr-only">Filter by role</Label>
                <select
                  id="roleFilter"
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value as UserRole | '')}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">All Roles</option>
                  {filterRoleOptions.map(role => (
                    <option key={role} value={role}>
                      {getRoleDisplayName(role)}
                    </option>
                  ))}
                </select>
              </div>
              {(searchQuery || roleFilter) && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearchQuery('')
                    setRoleFilter('')
                  }}
                >
                  Clear Filters
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

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

                {editingUser && (
                  <div className="flex items-center gap-4 pb-2">
                    <Avatar className="h-16 w-16">
                      {editingUser.profileImageUrl && (
                        <AvatarImage src={editingUser.profileImageUrl} alt={editingUser.name} />
                      )}
                      <AvatarFallback className="bg-maroon-600 text-white text-lg">
                        {editingUser.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col gap-1.5">
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={uploadingPhoto}
                          onClick={() => document.getElementById(`edit-user-photo-${editingUser.id}`)?.click()}
                          className="gap-1"
                        >
                          <Camera className="h-4 w-4" />
                          {uploadingPhoto ? 'Uploading...' : 'Change Photo'}
                        </Button>
                        {editingUser.profileImageUrl && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={uploadingPhoto}
                            onClick={handleRemovePhoto}
                            className="gap-1 text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                            Remove
                          </Button>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">PNG, JPG, or GIF. Max 4.5 MB.</p>
                      <input
                        id={`edit-user-photo-${editingUser.id}`}
                        type="file"
                        accept="image/png,image/jpeg,image/jpg,image/gif"
                        className="hidden"
                        onChange={handlePhotoUpload}
                        disabled={uploadingPhoto}
                      />
                    </div>
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

                  <div>
                    <Label htmlFor="phone">Phone (optional)</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="(555) 123-4567"
                    />
                  </div>

                  {!editingUser ? (
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
                  ) : session?.user?.role === 'SUPER_ADMIN' && (
                    <div>
                      <Label htmlFor="password">New Password (optional)</Label>
                      <Input
                        id="password"
                        type="password"
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        placeholder="Leave blank to keep current"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        User will be prompted to change password on next login
                      </p>
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
            <CardTitle>
              {roleFilter ? `${getRoleDisplayName(roleFilter)}s` : 'All Users'} ({users.length})
              {searchQuery && <span className="font-normal text-gray-500 ml-2">matching &quot;{searchQuery}&quot;</span>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Desktop View */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    {isSuperAdmin && (
                      <th className="text-center p-2 w-10">
                        <input
                          type="checkbox"
                          checked={selectableUsers.length > 0 && selectedUsers.size === selectableUsers.length}
                          onChange={toggleSelectAll}
                          className="h-4 w-4 rounded border-gray-300"
                          title="Select all"
                        />
                      </th>
                    )}
                    <th className="text-left p-2 w-8">#</th>
                    <th className="text-left p-2">Name</th>
                    <th className="text-left p-2">Email</th>
                    <th className="text-left p-2">Phone</th>
                    <th className="text-center p-2 w-40">Role</th>
                    <th className="text-center p-2 w-24">Status</th>
                    <th className="text-center p-2 w-24">Mentees</th>
                    <th className="text-center p-2 w-40">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user, index) => {
                    const isCurrentUser = user.id === session?.user?.id
                    const canSelect = user.role !== 'SUPER_ADMIN' && !isCurrentUser

                    return (
                      <tr key={user.id} className={`border-b hover:bg-gray-50 ${user.isDisabled ? 'bg-red-50' : ''}`}>
                        {isSuperAdmin && (
                          <td className="p-2 text-center">
                            {canSelect ? (
                              <input
                                type="checkbox"
                                checked={selectedUsers.has(user.id)}
                                onChange={() => toggleUserSelection(user.id)}
                                className="h-4 w-4 rounded border-gray-300"
                              />
                            ) : (
                              <span className="text-gray-300">-</span>
                            )}
                          </td>
                        )}
                        <td className="p-2 text-gray-500">{index + 1}</td>
                        <td className="p-2 font-medium">
                          <div className="flex items-center gap-2">
                            <Avatar className="h-7 w-7 shrink-0">
                              {user.profileImageUrl && (
                                <AvatarImage src={user.profileImageUrl} alt={user.name} />
                              )}
                              <AvatarFallback className="bg-maroon-600 text-white text-xs">
                                {user.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                              </AvatarFallback>
                            </Avatar>
                            <span>
                              {user.role === 'STUDENT' ? (
                                <Link href={`/dashboard/admin/students?student=${user.id}`} className="hover:text-blue-600 hover:underline">
                                  {user.name}
                                </Link>
                              ) : (
                                user.name
                              )}
                              {isCurrentUser && (
                                <Badge variant="outline" className="ml-2 text-xs">You</Badge>
                              )}
                            </span>
                          </div>
                        </td>
                        <td className="p-2 text-gray-600">{user.email}</td>
                        <td className="p-2 text-gray-600">{user.phone || '-'}</td>
                        <td className="p-2 text-center">
                          <Badge
                            className={
                              user.role === 'SUPER_ADMIN' ? 'bg-purple-600' :
                              user.role === 'PRIEST' ? 'bg-maroon-600' :
                              user.role === 'SERVANT_PREP' ? 'bg-green-600' :
                              user.role === 'MENTOR' ? 'bg-yellow-600' :
                              'bg-gray-600'
                            }
                          >
                            {getRoleDisplayName(user.role)}
                          </Badge>
                        </td>
                        <td className="p-2 text-center">
                          {user.isDisabled ? (
                            <Badge className="bg-red-500">Disabled</Badge>
                          ) : (
                            <Badge variant="outline" className="text-green-600 border-green-300">Active</Badge>
                          )}
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
                  {searchQuery || roleFilter
                    ? 'No users match your search criteria'
                    : 'No users found'}
                </div>
              )}
            </div>

            {/* Mobile View - Compact */}
            <div className="lg:hidden space-y-1">
              {users.map((user) => {
                const isCurrentUser = user.id === session?.user?.id
                const canSelect = user.role !== 'SUPER_ADMIN' && !isCurrentUser

                return (
                  <div key={user.id} className={`flex items-center gap-2 p-2 border rounded-md ${user.isDisabled ? 'bg-red-50' : 'bg-white'}`}>
                    {/* Checkbox for SUPER_ADMIN */}
                    {isSuperAdmin && (
                      <div className="shrink-0">
                        {canSelect ? (
                          <input
                            type="checkbox"
                            checked={selectedUsers.has(user.id)}
                            onChange={() => toggleUserSelection(user.id)}
                            className="h-4 w-4 rounded border-gray-300"
                          />
                        ) : (
                          <div className="w-4" />
                        )}
                      </div>
                    )}
                    {/* Avatar + Name & Role */}
                    <Avatar className="h-7 w-7 shrink-0">
                      {user.profileImageUrl && (
                        <AvatarImage src={user.profileImageUrl} alt={user.name} />
                      )}
                      <AvatarFallback className="bg-maroon-600 text-white text-[10px]">
                        {user.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {user.role === 'STUDENT' ? (
                          <Link href={`/dashboard/admin/students?student=${user.id}`} className="font-medium text-sm truncate hover:text-blue-600 hover:underline">
                            {user.name}
                          </Link>
                        ) : (
                          <span className="font-medium text-sm truncate">{user.name}</span>
                        )}
                        {isCurrentUser && (
                          <Badge variant="outline" className="text-[10px] px-1 py-0">You</Badge>
                        )}
                        {user.isDisabled && (
                          <Badge className="bg-red-500 text-[10px] px-1 py-0">Disabled</Badge>
                        )}
                        <Badge
                          className={`text-[10px] px-1.5 py-0 ${
                            user.role === 'SUPER_ADMIN' ? 'bg-purple-600' :
                            user.role === 'PRIEST' ? 'bg-maroon-600' :
                            user.role === 'SERVANT_PREP' ? 'bg-green-600' :
                            user.role === 'MENTOR' ? 'bg-yellow-600' :
                            'bg-gray-600'
                          }`}
                        >
                          {user.role === 'SUPER_ADMIN' ? 'Admin' :
                           user.role === 'PRIEST' ? 'Priest' :
                           user.role === 'SERVANT_PREP' ? 'Prep' :
                           user.role === 'MENTOR' ? 'Mentor' : 'Student'}
                        </Badge>
                        {(user.role === 'MENTOR' || user.role === 'SERVANT_PREP') && user._count?.mentoredStudents ? (
                          <span className="text-[10px] text-gray-500">({user._count.mentoredStudents})</span>
                        ) : null}
                      </div>
                      <div className="text-xs text-gray-500 truncate">{user.email}</div>
                    </div>
                    {/* Actions */}
                    <div className="flex gap-1 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => startEdit(user)}
                        className="h-7 px-2 text-xs"
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDeleteUser(user.id)}
                        disabled={isCurrentUser}
                        className="h-7 px-2 text-xs"
                      >
                        Del
                      </Button>
                    </div>
                  </div>
                )
              })}

              {users.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  {searchQuery || roleFilter
                    ? 'No users match your search criteria'
                    : 'No users found'}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this user? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteUserId(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteUser}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Enable/Disable Confirmation Dialog */}
      <AlertDialog open={bulkConfirmOpen} onOpenChange={setBulkConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {bulkAction === 'disable' ? 'Disable Users' : 'Enable Users'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {bulkAction === 'disable'
                ? `Are you sure you want to disable ${selectedUsers.size} user(s)? They will not be able to log in.`
                : `Are you sure you want to enable ${selectedUsers.size} user(s)? They will be able to log in again.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setBulkAction(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmBulkAction}
              className={bulkAction === 'disable' ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}
            >
              {bulkAction === 'disable' ? 'Disable' : 'Enable'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Password Reset Dialog */}
      <AlertDialog open={passwordResetOpen} onOpenChange={setPasswordResetOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset Password for {selectedUsers.size} User(s)</AlertDialogTitle>
            <AlertDialogDescription>
              Enter a new password that will be set for all selected users. They will be prompted to change it on their next login.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label htmlFor="newPassword">New Password</Label>
            <Input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter new password (min 6 characters)"
              className="mt-2"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setNewPassword('')}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmPasswordReset}
              disabled={!newPassword || newPassword.length < 6}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Reset Password
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
