'use client'

import { useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import StatusBadge from '@/components/ui/StatusBadge'
import RenewalSheet from '@/components/Students/RenewalSheet'
import { whatsappLink, formatPhone } from '@/lib/utils'
import { ChevronLeft, Phone, RefreshCcw, CreditCard, MoveHorizontal, Trash2, MapPin, Calendar, Hash } from 'lucide-react'

// Mock Data
const MOCK_STUDENT = {
  id: 's1',
  name: 'Rahul Kumar',
  father_name: 'Suresh Kumar',
  address: 'Street 4, Rajendra Nagar, Patna',
  phone: '9876543210',
  gender: 'male',
  seat_number: 'M1',
  shift_display: 'Morning + Afternoon',
  admission_date: '15 Jun 2025',
  end_date: '15 Sep 2026',
  status: 'active',
  payment_status: 'paid',
  locker_number: 'ML3',
  plan_months: 3,
  monthly_rate: 900,
  total_fee: 2700,
}

export default function StudentDetailPage() {
  const searchParams = useSearchParams()
  const id = searchParams.get('id')
  const router = useRouter()
  const [isRenewalOpen, setIsRenewalOpen] = useState(false)

  const student = MOCK_STUDENT // In real app, fetch by ID

  return (
    <div className="flex flex-col min-h-full bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-white px-4 py-4 border-b border-gray-100 flex items-center gap-4 sticky top-0 z-20">
        <button onClick={() => router.back()} className="p-2 -ml-2 text-gray-400 hover:text-brand-500">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h1 className="text-xl font-bold text-gray-900 truncate">Student Profile</h1>
      </div>

      <div className="p-4 space-y-6">
        {/* Profile Card */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 text-center space-y-4">
          <div className="w-20 h-20 rounded-full bg-brand-50 flex items-center justify-center text-brand-700 text-3xl font-bold mx-auto border-4 border-white shadow-md">
            {student.name.charAt(0)}
          </div>
          <div>
            <h2 className="text-2xl font-serif text-brand-900 leading-tight">{student.name}</h2>
            <div className="flex items-center justify-center gap-2 mt-2">
              <StatusBadge status={student.status as any} />
              <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">{student.seat_number}</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 pt-2">
            <a
              href={whatsappLink(student.phone)}
              target="_blank"
              className="flex items-center justify-center gap-2 bg-green-500 text-white p-3 rounded-2xl font-bold text-xs shadow-sm shadow-green-100"
            >
              <Phone className="w-4 h-4 fill-white" />
              WhatsApp
            </a>
            <button 
              onClick={() => setIsRenewalOpen(true)}
              className="flex items-center justify-center gap-2 bg-brand-500 text-white p-3 rounded-2xl font-bold text-xs shadow-sm shadow-brand-100"
            >
              <RefreshCcw className="w-4 h-4" />
              Renew
            </button>
          </div>
        </div>

        {/* Info Grid */}
        <div className="bg-white rounded-3xl overflow-hidden border border-gray-100 shadow-sm">
          <div className="px-6 py-4 bg-gray-50 border-b border-gray-100">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Personal Details</h3>
          </div>
          <div className="p-6 space-y-6">
            <div className="flex gap-4">
              <div className="bg-blue-50 p-2.5 rounded-xl text-blue-500 shrink-0">
                <Hash className="w-5 h-5" />
              </div>
              <div className="space-y-0.5">
                <p className="text-[10px] font-bold text-gray-400 uppercase">Phone Number</p>
                <p className="text-sm font-bold text-gray-800 font-mono">{formatPhone(student.phone)}</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="bg-purple-50 p-2.5 rounded-xl text-purple-500 shrink-0">
                <MapPin className="w-5 h-5" />
              </div>
              <div className="space-y-0.5">
                <p className="text-[10px] font-bold text-gray-400 uppercase">Full Address</p>
                <p className="text-sm font-medium text-gray-700 leading-snug">{student.address}</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="bg-amber-50 p-2.5 rounded-xl text-amber-500 shrink-0">
                <Calendar className="w-5 h-5" />
              </div>
              <div className="space-y-0.5">
                <p className="text-[10px] font-bold text-gray-400 uppercase">Admission Date</p>
                <p className="text-sm font-bold text-gray-800">{student.admission_date}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Subscription & Fee */}
        <div className="bg-white rounded-3xl overflow-hidden border border-gray-100 shadow-sm">
          <div className="px-6 py-4 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Subscription</h3>
            <span className={student.payment_status === 'paid' ? 'text-[10px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded' : 'text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded'}>
              {student.payment_status === 'paid' ? 'PAID ✓' : 'PENDING'}
            </span>
          </div>
          <div className="p-6 space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">Plan Duration</span>
              <span className="text-sm font-bold text-gray-800">{student.plan_months} Months</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">Monthly Rate</span>
              <span className="text-sm font-bold text-gray-800 font-mono">₹{student.monthly_rate}</span>
            </div>
            <div className="pt-4 border-t border-gray-50 flex justify-between items-center">
              <span className="text-sm font-bold text-brand-900">Total Fee Paid</span>
              <span className="text-lg font-bold text-brand-500 font-mono">₹{student.total_fee}</span>
            </div>
          </div>
        </div>

        {/* Danger Zone Actions */}
        <div className="grid grid-cols-3 gap-2">
          <button className="flex flex-col items-center gap-1.5 p-4 rounded-2xl border border-gray-100 bg-white text-gray-400 hover:text-brand-500 hover:border-brand-100 transition-colors">
            <CreditCard className="w-5 h-5" />
            <span className="text-[10px] font-bold uppercase">Fee</span>
          </button>
          <button className="flex flex-col items-center gap-1.5 p-4 rounded-2xl border border-gray-100 bg-white text-gray-400 hover:text-brand-500 hover:border-brand-100 transition-colors">
            <MoveHorizontal className="w-5 h-5" />
            <span className="text-[10px] font-bold uppercase tracking-tighter leading-none text-center">Change<br/>Seat</span>
          </button>
          <button className="flex flex-col items-center gap-1.5 p-4 rounded-2xl border border-red-50 bg-red-50/30 text-red-400 hover:text-red-500 hover:border-red-100 transition-colors">
            <Trash2 className="w-5 h-5" />
            <span className="text-[10px] font-bold uppercase">Delete</span>
          </button>
        </div>
      </div>

      <RenewalSheet
        isOpen={isRenewalOpen}
        onClose={() => setIsRenewalOpen(false)}
        student={student}
      />
    </div>
  )
}
