'use client'

import { useState, useEffect } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { phoneSchema } from '@/lib/validators'
import { RegistrationData } from './RegistrationForm'

const schema = z.object({
  owner: z.object({
    name: z.string().min(2, 'Name is required'),
    email: z.string().email('Valid email required'),
    phone: phoneSchema,
    password: z.string().optional(), // optional because existing owners don't create one
    isExisting: z.boolean().optional(),
    isVerified: z.boolean().optional(),
  }).refine((data) => data.isExisting || (data.password && data.password.length >= 8), {
    message: "Password must be at least 8 characters",
    path: ["password"]
  }),
  staff_list: z.array(z.object({
    name: z.string().min(2, 'Name is required'),
    email: z.string().email('Valid email required'),
    password: z.string().min(8, 'Staff password must be at least 8 characters'),
    staff_type: z.enum(['specific', 'combined']),
  })).max(2, 'Maximum 2 staff allowed during registration'),
})

type FormData = z.infer<typeof schema>

export default function Step6Accounts({
  data,
  onNext,
  onBack,
}: {
  data: RegistrationData
  onNext: (owner: RegistrationData['owner'], staff_list: RegistrationData['staff_list']) => void
  onBack: () => void
}) {
  const libraryName = data.library.name || 'this library'

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      owner: {
        ...data.owner,
        password: '',
      },
      staff_list: data.staff_list.map(s => ({ ...s, password: '', staff_type: 'specific' })),
    },
  })

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'staff_list',
  })

  const [checkingEmail, setCheckingEmail] = useState(false)
  const [existingUser, setExistingUser] = useState<{name: string} | null>(null)
  const [verifyPassword, setVerifyPassword] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [verifyError, setVerifyError] = useState('')
  const [isVerified, setIsVerified] = useState(false)

  const emailValue = control._formValues.owner?.email

  // Check email on blur or mount for existing users
  const checkEmailExists = async (email: string) => {
    if (!email || !email.includes('@')) return

    setCheckingEmail(true)
    try {
      const res = await fetch('/api/check-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      })
      const respData = await res.json()
      
      if (respData.exists) {
        setExistingUser({ name: respData.owner_name })
        setIsVerified(false)
      } else {
        setExistingUser(null)
        setIsVerified(false)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setCheckingEmail(false)
    }
  }

  // Handle email onBlur for manual typing
  const handleEmailBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    checkEmailExists(e.target.value)
  }

  useEffect(() => {
    if (data.owner?.isExisting && data.owner?.email) {
      checkEmailExists(data.owner.email)
    }
  }, [data.owner?.isExisting, data.owner?.email])

  const handleVerify = async () => {
    if (!verifyPassword) return
    setVerifying(true)
    setVerifyError('')

    try {
      const res = await fetch('/api/verify-owner-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailValue, password: verifyPassword })
      })
      const respData = await res.json()

      if (respData.verified) {
        setIsVerified(true)
        setVerifyError('')
      } else {
        setVerifyError(respData.error || 'Invalid password')
      }
    } catch (err: any) {
      setVerifyError('Verification failed. Try again.')
    } finally {
      setVerifying(false)
    }
  }

  const onSubmit = (values: FormData) => {
    if (existingUser && !isVerified) {
      setVerifyError('Please verify your password first')
      return
    }
    
    // Pass the flag so webhook knows it's an existing user
    if (existingUser) {
      values.owner.isExisting = true
      values.owner.isVerified = true
    }
    
    onNext(values.owner as any, values.staff_list)
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
      <div className="space-y-1">
        <h2 className="text-xl font-serif text-brand-900">Create your accounts</h2>
        <p className="text-sm text-gray-600">
          Set up credentials for yourself and your staff.
        </p>
      </div>

      {/* Owner Section */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-600">Owner Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700">Full Name*</label>
            <input
              {...register('owner.name')}
              className="mt-1 block w-full rounded-md border border-gray-200 px-3 py-2 shadow-sm focus:border-brand-500 focus:ring-brand-500"
            />
            {errors.owner?.name && <p className="text-xs text-red-500 mt-1">{errors.owner.name.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Email Address*</label>
            <div className="relative">
              <input
                {...register('owner.email')}
                onBlur={(e) => {
                  register('owner.email').onBlur(e)
                  handleEmailBlur(e)
                }}
                disabled={isVerified}
                className="mt-1 block w-full rounded-md border border-gray-200 px-3 py-2 shadow-sm focus:border-brand-500 focus:ring-brand-500 disabled:bg-gray-50 disabled:text-gray-500"
              />
              {checkingEmail && <span className="absolute right-3 top-3 w-4 h-4 border-2 border-brand-500 border-t-transparent rounded-full animate-spin"></span>}
            </div>
            {errors.owner?.email && <p className="text-xs text-red-500 mt-1">{errors.owner.email.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Owner Phone*</label>
            <input
              {...register('owner.phone')}
              maxLength={10}
              className="mt-1 block w-full rounded-md border border-gray-200 px-3 py-2 shadow-sm focus:border-brand-500 focus:ring-brand-500 font-mono"
              placeholder="9876543210"
            />
            {errors.owner?.phone && <p className="text-xs text-red-500 mt-1">{errors.owner.phone.message}</p>}
          </div>

          <div className="md:col-span-2">
            {existingUser ? (
              <div className="bg-brand-50 border border-brand-100 rounded-lg p-4 mb-2">
                <p className="text-sm text-brand-900 font-medium mb-3">
                  <span className="font-bold">Welcome back, {existingUser.name}!</span> We found an existing account with this email. Please enter your password to add this new library to your account.
                </p>
                {!isVerified ? (
                  <div>
                    <div className="relative flex items-center">
                      <input
                        type="password"
                        name="verify_existing_pwd"
                        autoComplete="new-password"
                        placeholder="Enter your current password"
                        value={verifyPassword}
                        onChange={e => setVerifyPassword(e.target.value)}
                        className="block w-full rounded-xl border border-brand-200 pl-4 pr-24 py-3 shadow-sm focus:border-brand-500 focus:ring-brand-500 text-sm transition-all bg-white"
                      />
                      <button
                        type="button"
                        onClick={handleVerify}
                        disabled={!verifyPassword || verifying}
                        className="absolute right-1.5 top-1.5 bottom-1.5 bg-brand-600 text-white px-4 rounded-lg text-sm font-bold hover:bg-brand-700 disabled:opacity-50 disabled:bg-gray-400 transition-colors shadow-sm"
                      >
                        {verifying ? 'Verifying' : 'Verify'}
                      </button>
                    </div>
                    {verifyError && <p className="text-xs text-red-500 mt-2 font-medium pl-1">{verifyError}</p>}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-green-600 font-bold bg-green-50 p-2 rounded border border-green-100">
                    <span>✓ Account Verified</span>
                    <span className="text-xs font-normal text-green-700">You can proceed to payment. No new password needed.</span>
                  </div>
                )}
              </div>
            ) : (
              <>
                <label className="block text-sm font-medium text-gray-700">Create Owner Password*</label>
                <input
                  type="password"
                  {...register('owner.password')}
                  className="mt-1 block w-full rounded-md border border-gray-200 px-3 py-2 shadow-sm focus:border-brand-500 focus:ring-brand-500"
                  placeholder="Minimum 8 characters"
                />
                {errors.owner?.password && <p className="text-xs text-red-500 mt-1">{errors.owner.password.message}</p>}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Staff Section */}
      <div className="space-y-4 pt-6 border-t border-gray-100">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-600">Staff Accounts (Optional)</h3>
          {fields.length < 2 && (
            <button
              type="button"
              onClick={() => append({ name: '', email: '', password: '', staff_type: 'specific' })}
              className="text-xs font-bold text-brand-500 hover:text-brand-700"
            >
              + ADD STAFF
            </button>
          )}
        </div>

        {fields.map((field, index) => (
          <div key={field.id} className="p-4 bg-gray-50 rounded-lg border border-gray-200 relative">
            <button
              type="button"
              onClick={() => remove(index)}
              className="absolute top-2 right-2 text-gray-600 hover:text-red-500"
            >
              ✕
            </button>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase">Staff Name</label>
                <input
                  {...register(`staff_list.${index}.name` as const)}
                  className="mt-1 block w-full rounded-md border border-gray-200 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:ring-brand-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase">Staff Email</label>
                <input
                  {...register(`staff_list.${index}.email` as const)}
                  className="mt-1 block w-full rounded-md border border-gray-200 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:ring-brand-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase">Staff Password</label>
                <input
                  type="password"
                  {...register(`staff_list.${index}.password` as const)}
                  className="mt-1 block w-full rounded-md border border-gray-200 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:ring-brand-500"
                  placeholder="Min 8 chars"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase">Branch Access</label>
                <div className="mt-1 flex items-center gap-2 bg-brand-50 border border-brand-100 px-3 py-2 rounded-md">
                  <span className="text-sm font-bold text-brand-700 truncate">
                    {libraryName}
                  </span>
                  <span className="text-[8px] bg-brand-500 text-white px-1.5 py-0.5 rounded font-bold">ONLY</span>
                </div>
                <input type="hidden" {...register(`staff_list.${index}.staff_type` as const)} value="specific" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-between pt-4">
        <button
          type="button"
          onClick={onBack}
          className="text-gray-600 font-medium hover:text-gray-600 transition-colors"
        >
          ← Back
        </button>
        <button
          type="submit"
          className="bg-brand-500 text-white px-8 py-2 rounded-lg font-medium hover:bg-brand-700 transition-colors shadow-sm"
        >
          Final Step: Payment →
        </button>
      </div>
    </form>
  )
}
