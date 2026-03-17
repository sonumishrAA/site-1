'use client'

import StatusBadge from '../ui/StatusBadge'
import { formatPhone, whatsappLink } from '@/lib/utils'
import { Phone, ArrowRight } from 'lucide-react'
import Link from 'next/link'

export type Student = {
  id: string
  name: string
  seat_number: string
  shift_display: string
  end_date: string
  status: 'active' | 'expiring' | 'expired'
  payment_status: 'paid' | 'pending'
  phone: string
}

export default function StudentCard({ student }: { student: Student }) {
  return (
    <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm space-y-4">
      <div className="flex justify-between items-start">
        <div className="flex gap-3">
          <div className="w-10 h-10 rounded-full bg-brand-50 flex items-center justify-center text-brand-700 font-bold">
            {student.name.charAt(0)}
          </div>
          <div>
            <h3 className="font-bold text-gray-900 leading-tight">{student.name}</h3>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[10px] font-mono text-gray-500">{student.seat_number} · {student.shift_display}</span>
            </div>
          </div>
        </div>
        <StatusBadge status={student.status} />
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-gray-50">
        <div className="space-y-1">
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Expires</p>
          <p className="text-xs font-bold text-gray-700">{student.end_date}</p>
        </div>
        <div className="text-right space-y-1">
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Payment</p>
          <p className={cn(
            "text-xs font-bold",
            student.payment_status === 'paid' ? 'text-green-600' : 'text-amber-600'
          )}>
            {student.payment_status === 'paid' ? 'Paid ✓' : 'Pending ₹'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 pt-2">
        <a
          href={whatsappLink(student.phone)}
          target="_blank"
          className="flex items-center justify-center gap-2 border border-gray-100 bg-gray-50 text-gray-600 p-2 rounded-xl font-bold text-[10px] uppercase transition-colors hover:bg-green-50 hover:text-green-600 hover:border-green-100"
        >
          <Phone className="w-3 h-3 fill-current" />
          WhatsApp
        </a>
        <Link
          href={`/students/profile/?id=${student.id}`}
          className="flex items-center justify-center gap-2 bg-brand-500 text-white p-2 rounded-xl font-bold text-[10px] uppercase shadow-sm shadow-brand-100"
        >
          Details
          <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
    </div>
  )
}

import { cn } from '@/lib/utils'
