'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getRoleDisplayName } from '@/lib/roles'
import { toast } from 'sonner'

export default function SettingsPage() {
  const { data: session, status, update } = useSession()
  const router = useRouter()

  // Name change
  const [name, setName] = useState('')
  const [nameLoading, setNameLoading] = useState(false)

  // Password change
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordLoading, setPasswordLoading] = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    } else if (session?.user) {
      setName(session.user.name || '')
    }
  }, [status, session, router])

  const handleNameUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    setNameLoading(true)

    try {
      const res = await fetch(`/api/users/${session?.user?.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      })

      if (res.ok) {
        await update({ name })
        toast.success('Name updated successfully!')
      } else {
        const error = await res.json()
        toast.error(`Failed to update name: ${error.error}`)
      }
    } catch (error) {
      console.error('Failed to update name:', error)
      toast.error('Failed to update name')
    } finally {
      setNameLoading(false)
    }
  }

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault()

    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match')
      return
    }

    if (newPassword.length < 6) {
      toast.error('New password must be at least 6 characters')
      return
    }

    setPasswordLoading(true)

    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword,
          newPassword
        })
      })

      if (res.ok) {
        toast.success('Password updated successfully!')
        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')
      } else {
        const error = await res.json()
        toast.error(`Failed to update password: ${error.error}`)
      }
    } catch (error) {
      console.error('Failed to update password:', error)
      toast.error('Failed to update password')
    } finally {
      setPasswordLoading(false)
    }
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-sm text-gray-600">Manage your account settings</p>
        </div>

        {/* Account Info */}
        <Card>
          <CardHeader>
            <CardTitle>Account Information</CardTitle>
            <CardDescription>Your current account details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Email:</span>
              <span className="text-sm font-medium">{session?.user?.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Role:</span>
              <span className="text-sm font-medium">
                {session?.user?.role && getRoleDisplayName(session.user.role)}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Update Name */}
        <Card>
          <CardHeader>
            <CardTitle>Update Name</CardTitle>
            <CardDescription>Change your display name</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleNameUpdate} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  disabled={nameLoading}
                />
              </div>
              <Button type="submit" disabled={nameLoading || name === session?.user?.name}>
                {nameLoading ? 'Updating...' : 'Update Name'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Change Password */}
        <Card>
          <CardHeader>
            <CardTitle>Change Password</CardTitle>
            <CardDescription>Update your account password</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePasswordUpdate} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="currentPassword">Current Password</Label>
                <Input
                  id="currentPassword"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                  disabled={passwordLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="newPassword">New Password</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  disabled={passwordLoading}
                  minLength={6}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm New Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={passwordLoading}
                  minLength={6}
                />
              </div>
              <Button type="submit" disabled={passwordLoading}>
                {passwordLoading ? 'Updating...' : 'Change Password'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
