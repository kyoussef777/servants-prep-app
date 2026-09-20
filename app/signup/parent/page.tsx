'use client'

import { useState } from 'react'
import Link from 'next/link'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

interface FormData {
  fullName: string
  email: string
  phone: string
  password: string
  confirmPassword: string
}

export default function ParentSignupPage() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formData, setFormData] = useState<FormData>({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  })

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters'
    }
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    setIsSubmitting(true)
    try {
      const res = await fetch('/api/auth/signup/parent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: formData.fullName,
          email: formData.email,
          phone: formData.phone || undefined,
          password: formData.password,
          confirmPassword: formData.confirmPassword,
        }),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Signup failed')
      }

      const result = await signIn('credentials', {
        email: formData.email,
        password: formData.password,
        redirect: false,
      })

      if (result?.error) {
        toast.success('Account created! Please log in.')
        router.push('/login')
        return
      }

      toast.success('Account created!')
      router.push('/dashboard')
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create account')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md border-2 border-maroon-600 shadow-lg">
        <CardHeader className="text-center space-y-4 pt-8 pb-6">
          <CardTitle className="text-2xl sm:text-3xl">Parent Sign Up</CardTitle>
          <CardDescription className="text-base mt-2">
            Create an account to register your child for Sunday School
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 px-6 pb-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name *</Label>
              <Input
                id="fullName"
                required
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                disabled={isSubmitting}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email Address *</Label>
              <Input
                id="email"
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                disabled={isSubmitting}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                disabled={isSubmitting}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password *</Label>
              <Input
                id="password"
                type="password"
                required
                placeholder="Minimum 8 characters"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                disabled={isSubmitting}
                className={errors.password ? 'border-red-500' : ''}
              />
              {errors.password && <p className="text-sm text-red-500">{errors.password}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password *</Label>
              <Input
                id="confirmPassword"
                type="password"
                required
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                disabled={isSubmitting}
                className={errors.confirmPassword ? 'border-red-500' : ''}
              />
              {errors.confirmPassword && (
                <p className="text-sm text-red-500">{errors.confirmPassword}</p>
              )}
            </div>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-maroon-600 hover:bg-maroon-700"
              size="lg"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating account...
                </>
              ) : (
                'Create Account'
              )}
            </Button>
          </form>
          <p className="text-center text-sm text-gray-600">
            Want to serve instead?{' '}
            <Link href="/signup/servant" className="text-maroon-600 hover:underline">
              Sign up as a servant
            </Link>
          </p>
          <p className="text-center text-sm text-gray-600">
            Already have an account?{' '}
            <Link href="/login" className="text-maroon-600 hover:underline">
              Log in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
