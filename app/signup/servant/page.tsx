'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { CheckCircle2, Loader2 } from 'lucide-react'

interface FormData {
  fullName: string
  email: string
  phone: string
  availability: string
  motivation: string
}

export default function ServantSignupPage() {
  const [submitted, setSubmitted] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState<FormData>({
    fullName: '',
    email: '',
    phone: '',
    availability: '',
    motivation: '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    setIsSubmitting(true)
    try {
      const res = await fetch('/api/servant-applications/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: formData.fullName,
          email: formData.email,
          phone: formData.phone,
          availability: formData.availability || undefined,
          motivation: formData.motivation || undefined,
        }),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Submission failed')
      }

      setSubmitted(true)
      toast.success('Application submitted successfully!')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to submit application')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
        <Card className="w-full max-w-md border-2 border-green-600 shadow-lg">
          <CardHeader className="text-center space-y-4 pt-8 pb-6">
            <div className="flex justify-center">
              <CheckCircle2 className="w-24 h-24 text-green-600" />
            </div>
            <CardTitle className="text-2xl sm:text-3xl text-green-600">Application Submitted!</CardTitle>
            <CardDescription className="text-base mt-2">
              Your application to serve in Sunday School has been received and is under review.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 px-6 pb-8">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm">
              <p className="font-semibold text-green-900 mb-2">What happens next?</p>
              <ul className="list-disc list-inside space-y-1 text-green-800">
                <li>An administrator will review your application</li>
                <li>If approved, you&apos;ll receive login credentials by email</li>
                <li>You&apos;ll then be assigned to a class once staffing is finalized</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
      <Card className="w-full max-w-lg border-2 border-maroon-600 shadow-lg">
        <CardHeader className="text-center space-y-4 pt-8 pb-6">
          <CardTitle className="text-2xl sm:text-3xl">Serve in Sunday School</CardTitle>
          <CardDescription className="text-base mt-2">
            Apply to become a Sunday School servant
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
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number *</Label>
              <Input
                id="phone"
                type="tel"
                required
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="availability">Availability</Label>
              <Input
                id="availability"
                placeholder="e.g. Sundays only, flexible"
                value={formData.availability}
                onChange={(e) => setFormData({ ...formData, availability: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="motivation">Why do you want to serve?</Label>
              <Textarea
                id="motivation"
                rows={4}
                value={formData.motivation}
                onChange={(e) => setFormData({ ...formData, motivation: e.target.value })}
              />
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
                  Submitting...
                </>
              ) : (
                'Submit Application'
              )}
            </Button>
          </form>
          <p className="text-center text-sm text-gray-600">
            Registering a child instead?{' '}
            <Link href="/signup/parent" className="text-maroon-600 hover:underline">
              Sign up as a parent
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
