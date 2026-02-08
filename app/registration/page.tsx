'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { toast } from 'sonner'
import { StudentGrade } from '@prisma/client'
import { getGradeDisplayName } from '@/lib/registration-utils'
import { Upload, CheckCircle2, Loader2 } from 'lucide-react'

type RegistrationStep = 'CODE' | 'FORM' | 'CONFIRMATION'

interface FormData {
  email: string
  fullName: string
  dateOfBirth: string
  phone: string
  fatherOfConfessionName: string
  previouslyServed: string
  currentlyServing: string
  previouslyAttendedPrep: string
  previousPrepLocation: string
  grade: string
  approvalFormUrl: string
  approvalFormFilename: string
  mentorName: string
  mentorPhone: string
  mentorEmail: string
}

export default function RegistrationPage() {
  const [step, setStep] = useState<RegistrationStep>('CODE')
  const [inviteCode, setInviteCode] = useState('')
  const [codeLabel, setCodeLabel] = useState<string | null>(null)
  const [isValidating, setIsValidating] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isUploading, setIsUploading] = useState(false)

  const [formData, setFormData] = useState<FormData>({
    email: '',
    fullName: '',
    dateOfBirth: '',
    phone: '',
    fatherOfConfessionName: '',
    previouslyServed: '',
    currentlyServing: '',
    previouslyAttendedPrep: '',
    previousPrepLocation: '',
    grade: '',
    approvalFormUrl: '',
    approvalFormFilename: '',
    mentorName: '',
    mentorPhone: '',
    mentorEmail: '',
  })

  const handleValidateCode = async () => {
    if (!inviteCode.trim()) {
      toast.error('Please enter an invite code')
      return
    }

    setIsValidating(true)
    try {
      const res = await fetch('/api/registration/validate-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: inviteCode.trim().toUpperCase() }),
      })

      const data = await res.json()

      if (data.valid) {
        setCodeLabel(data.label)
        setStep('FORM')
        toast.success('Invite code verified!')
      } else {
        toast.error(data.message || 'Invalid invite code')
      }
    } catch (error) {
      toast.error('Failed to validate invite code')
    } finally {
      setIsValidating(false)
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'application/pdf']
    if (!allowedTypes.includes(file.type)) {
      toast.error('Invalid file type. Please upload PNG, JPG, GIF, or PDF')
      return
    }

    // Validate file size (4.5 MB)
    if (file.size > 4.5 * 1024 * 1024) {
      toast.error('File size exceeds 4.5 MB limit')
      return
    }

    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/registration/upload', {
        method: 'POST',
        headers: {
          'x-invite-code': inviteCode.trim().toUpperCase(),
        },
        body: formData,
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Upload failed')
      }

      const data = await res.json()
      setFormData((prev) => ({
        ...prev,
        approvalFormUrl: data.url,
        approvalFormFilename: data.filename,
      }))
      toast.success('File uploaded successfully!')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to upload file')
    } finally {
      setIsUploading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validation
    if (!formData.approvalFormUrl) {
      toast.error('Please upload your signed approval form')
      return
    }

    if (formData.previouslyAttendedPrep === 'true' && !formData.previousPrepLocation) {
      toast.error('Please specify where you previously attended Servants Prep')
      return
    }

    setIsSubmitting(true)
    try {
      const res = await fetch('/api/registration/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inviteCode: inviteCode.trim().toUpperCase(),
          ...formData,
          previouslyServed: formData.previouslyServed === 'true',
          currentlyServing: formData.currentlyServing === 'true',
          previouslyAttendedPrep: formData.previouslyAttendedPrep === 'true',
        }),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Submission failed')
      }

      setStep('CONFIRMATION')
      toast.success('Registration submitted successfully!')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to submit registration')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Calculate form progress
  const calculateProgress = () => {
    const fields = Object.entries(formData)
    const filledFields = fields.filter(([key, value]) => {
      if (key === 'previousPrepLocation' && formData.previouslyAttendedPrep !== 'true') {
        return true // Not required
      }
      return value !== ''
    })
    return (filledFields.length / fields.length) * 100
  }

  if (step === 'CODE') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
        <Card className="w-full max-w-md border-2 border-maroon-600 shadow-lg">
          <CardHeader className="text-center space-y-4 pt-8 pb-6">
            <div className="flex justify-center">
              <div className="w-24 h-24 bg-maroon-600 rounded-full flex items-center justify-center text-white font-bold text-4xl">
                SP
              </div>
            </div>
            <CardTitle className="text-2xl sm:text-3xl">St. Paul&apos;s Servants Prep</CardTitle>
            <CardDescription className="text-base mt-2">
              Application for Servants Prep 2025-26
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 px-6 pb-8">
            <div>
              <Label htmlFor="inviteCode">Invite Code</Label>
              <Input
                id="inviteCode"
                placeholder="Enter your invite code"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                className="mt-1 uppercase"
                onKeyDown={(e) => e.key === 'Enter' && handleValidateCode()}
              />
              <p className="text-sm text-gray-500 mt-2">
                An invite code is required to apply. Contact your mentor or church leader if you don&apos;t have one.
              </p>
            </div>
            <Button
              onClick={handleValidateCode}
              disabled={isValidating || !inviteCode.trim()}
              className="w-full bg-maroon-600 hover:bg-maroon-700"
            >
              {isValidating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                'Continue'
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (step === 'CONFIRMATION') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
        <Card className="w-full max-w-md border-2 border-green-600 shadow-lg">
          <CardHeader className="text-center space-y-4 pt-8 pb-6">
            <div className="flex justify-center">
              <CheckCircle2 className="w-24 h-24 text-green-600" />
            </div>
            <CardTitle className="text-2xl sm:text-3xl text-green-600">Application Submitted!</CardTitle>
            <CardDescription className="text-base mt-2">
              Your application has been received and is under review.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 px-6 pb-8">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm">
              <p className="font-semibold text-green-900 mb-2">What happens next?</p>
              <ul className="list-disc list-inside space-y-1 text-green-800">
                <li>Our admins will review your application</li>
                <li>You&apos;ll be notified once a decision is made</li>
                <li>If approved, you&apos;ll receive login credentials via your mentor</li>
              </ul>
            </div>
            <p className="text-center text-sm text-gray-600">
              Questions? Contact us at the Coptic Orthodox Church of Saint Mark, Jersey City, NJ.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <Card className="border-2 border-maroon-600 shadow-lg">
          <CardHeader className="space-y-4 pb-6">
            <div className="flex items-center justify-between mb-2">
              <CardTitle className="text-2xl sm:text-3xl">Servants Prep Application</CardTitle>
              {codeLabel && (
                <Badge variant="outline" className="text-xs">
                  {codeLabel}
                </Badge>
              )}
            </div>
            <CardDescription>
              St. Paul&apos;s Servants Prep - 2025-26 Academic Year
            </CardDescription>
            <Progress value={calculateProgress()} className="mt-4" />
            <p className="text-xs text-gray-500 mt-1">
              {Math.round(calculateProgress())}% complete
            </p>
          </CardHeader>
          <CardContent className="px-6 sm:px-8 pb-8">
            <form onSubmit={handleSubmit} className="space-y-10">
              {/* Personal Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold border-b pb-2 text-maroon-600">Personal Information</h3>
                <div className="grid gap-4 sm:grid-cols-2">
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
                    <Label htmlFor="dateOfBirth">Date of Birth *</Label>
                    <Input
                      id="dateOfBirth"
                      type="date"
                      required
                      value={formData.dateOfBirth}
                      onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
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
                </div>
              </div>

              {/* Church Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold border-b pb-2 text-maroon-600">Church Information</h3>
                <div className="space-y-2">
                  <Label htmlFor="fatherOfConfession">Your Father of Confession *</Label>
                  <Input
                    id="fatherOfConfession"
                    required
                    value={formData.fatherOfConfessionName}
                    onChange={(e) =>
                      setFormData({ ...formData, fatherOfConfessionName: e.target.value })
                    }
                  />
                </div>
              </div>

              {/* Service History */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold border-b pb-2 text-maroon-600">Service History</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="previouslyServed">Have you previously served? *</Label>
                    <Select
                      required
                      value={formData.previouslyServed}
                      onValueChange={(value) => setFormData({ ...formData, previouslyServed: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="true">Yes</SelectItem>
                        <SelectItem value="false">No</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="currentlyServing">Are you currently serving? *</Label>
                    <Select
                      required
                      value={formData.currentlyServing}
                      onValueChange={(value) => setFormData({ ...formData, currentlyServing: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="true">Yes</SelectItem>
                        <SelectItem value="false">No</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="previouslyAttendedPrep">
                    Have you previously attended Servants Prep? *
                  </Label>
                  <Select
                    required
                    value={formData.previouslyAttendedPrep}
                    onValueChange={(value) =>
                      setFormData({ ...formData, previouslyAttendedPrep: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">Yes</SelectItem>
                      <SelectItem value="false">No</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {formData.previouslyAttendedPrep === 'true' && (
                  <div className="space-y-2">
                    <Label htmlFor="previousPrepLocation">Where did you attend? *</Label>
                    <Input
                      id="previousPrepLocation"
                      required
                      value={formData.previousPrepLocation}
                      onChange={(e) =>
                        setFormData({ ...formData, previousPrepLocation: e.target.value })
                      }
                    />
                  </div>
                )}
              </div>

              {/* Academic Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold border-b pb-2 text-maroon-600">Academic Information</h3>
                <div className="space-y-2">
                  <Label htmlFor="grade">Which Grade are you in? *</Label>
                  <Select
                    required
                    value={formData.grade}
                    onValueChange={(value) => setFormData({ ...formData, grade: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select your grade..." />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.values(StudentGrade).map((grade) => (
                        <SelectItem key={grade} value={grade}>
                          {getGradeDisplayName(grade)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Approval Form Upload */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold border-b pb-2 text-maroon-600">Approval Form *</h3>
                <div className="space-y-2">
                  <Label htmlFor="approvalForm">
                    Upload your signed form documenting approval of your mentor servant and father
                    of confession
                  </Label>
                  <div className="border-2 border-dashed rounded-lg p-6 text-center">
                    {formData.approvalFormUrl ? (
                      <div className="space-y-2">
                        <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto" />
                        <p className="text-sm font-medium">{formData.approvalFormFilename}</p>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setFormData({ ...formData, approvalFormUrl: '', approvalFormFilename: '' })
                          }
                        >
                          Change File
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Upload className="w-12 h-12 text-gray-400 mx-auto" />
                        <div>
                          <Label
                            htmlFor="approvalForm"
                            className="cursor-pointer text-maroon-600 hover:underline"
                          >
                            Click to upload
                          </Label>
                          <Input
                            id="approvalForm"
                            type="file"
                            accept="image/*,application/pdf"
                            className="hidden"
                            onChange={handleFileUpload}
                            disabled={isUploading}
                          />
                        </div>
                        <p className="text-xs text-gray-500">
                          PNG, JPG, GIF, or PDF (Max 4.5 MB)
                        </p>
                        {isUploading && (
                          <p className="text-sm text-maroon-600 font-medium">Uploading...</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Mentor Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold border-b pb-2 text-maroon-600">Mentor Servant Information</h3>
                <div className="grid gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="mentorName">Mentor Servant&apos;s Name *</Label>
                    <Input
                      id="mentorName"
                      required
                      value={formData.mentorName}
                      onChange={(e) => setFormData({ ...formData, mentorName: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="mentorPhone">Mentor Servant&apos;s Phone Number *</Label>
                      <Input
                        id="mentorPhone"
                        type="tel"
                        required
                        value={formData.mentorPhone}
                        onChange={(e) => setFormData({ ...formData, mentorPhone: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="mentorEmail">Mentor Servant&apos;s Email *</Label>
                      <Input
                        id="mentorEmail"
                        type="email"
                        required
                        value={formData.mentorEmail}
                        onChange={(e) => setFormData({ ...formData, mentorEmail: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-4">
                <Button
                  type="submit"
                  disabled={isSubmitting || !formData.approvalFormUrl}
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
                <p className="text-xs text-center text-gray-500 mt-2">
                  By submitting, you confirm that all information provided is accurate.
                </p>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
