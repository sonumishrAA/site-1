'use server'

import { createAdminClient, createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'

export async function setActiveLibrary(libraryId: string) {
  const cookieStore = await cookies()
  cookieStore.set('active_library_id', libraryId, {
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 days
    httpOnly: false,
    sameSite: 'lax',
  })
  revalidatePath('/', 'layout')
}


// ─── Financial Event Helper (Append-Only Ledger) ───
async function insertFinancialEvent(client: any, data: {
  library_id: string
  student_id?: string | null
  student_name: string
  event_type: string
  amount: number
  pending_amount: number
  payment_mode: string
  actor_role: string
  actor_name: string
  note?: string
}) {
  await client.from('financial_events').insert({
    library_id: data.library_id,
    student_id: data.student_id || null,
    student_name: data.student_name,
    event_type: data.event_type,
    amount: data.amount,
    pending_amount: data.pending_amount,
    payment_mode: data.payment_mode,
    actor_role: data.actor_role,
    actor_name: data.actor_name,
    note: data.note || null,
  })
}

export async function submitNewAdmission(data: any) {
  const adminClient = createAdminClient()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: staffDetails } = await supabase.from('staff').select('role, name').eq('user_id', user?.id).single()

  try {
    // 1. Calculate end date
    const endDate = new Date(data.admission_date)
    endDate.setMonth(endDate.getMonth() + data.plan_months)
    const endDateStr = endDate.toISOString().split('T')[0]
    
    // 1.5 Check if seat-shifts are already taken by someone else
    const { data: existingShifts } = await adminClient
      .from('student_seat_shifts')
      .select('id')
      .eq('seat_id', data.seat_id)
      .in('shift_code', data.selected_shifts)
      .gte('end_date', new Date().toISOString().split('T')[0])

    if (existingShifts && existingShifts.length > 0) {
      throw new Error('This seat or some of its shifts are already occupied.')
    }

    // 2. Insert Student
    const { data: newStudent, error: studentError } = await adminClient
      .from('students')
      .insert({
        library_id: data.library_id,
        name: data.name,
        father_name: data.father_name || null,
        address: data.address || null,
        phone: data.phone || null,
        gender: data.gender,
        admission_date: data.admission_date,
        end_date: endDateStr,
        plan_months: data.plan_months,
        payment_status: data.payment_status,
        total_fee: data.total_fee,
        amount_paid: data.amount_paid || 0,
        discount_amount: data.discount_amount || 0,
        monthly_rate: data.monthly_rate,
        seat_id: data.seat_id,
        locker_id: data.locker_id || null,
        combination_key: data.shift_display,
        shift_display: data.shift_display,
        selected_shifts: data.selected_shifts
      })
      .select()
      .single()

    if (studentError) throw new Error(`Student insert failed: ${studentError.message}`)

    // 3. Insert Shift Records
    const shiftInserts = data.selected_shifts.map((s: string) => ({
      student_id: newStudent.id,
      seat_id: data.seat_id,
      shift_code: s,
      end_date: endDateStr
    }))

    const { error: shiftError } = await adminClient.from('student_seat_shifts').insert(shiftInserts)
    if (shiftError) {
      // Rollback student insert if shifts fail
      await adminClient.from('students').delete().eq('id', newStudent.id)
      throw new Error(`Shift insert failed: ${shiftError.message}`)
    }

    // 4. Update Locker Status if assigned
    if (data.locker_id) {
      await adminClient.from('lockers').update({ status: 'occupied' }).eq('id', data.locker_id)
    }

    // 5. Insert Financial Event
    const staffName = staffDetails?.name || 'Staff'
    const staffRole = staffDetails?.role || 'staff'
    const totalFee = Number(data.total_fee || 0)
    const amountPaid = Number(data.amount_paid || 0)
    const discountAmt = Number(data.discount_amount || 0)

    let eventType = 'ADMISSION_FULL'
    let eventAmount = totalFee
    let eventPending = 0

    if (data.payment_status === 'partial') {
      eventType = 'ADMISSION_PARTIAL'
      eventAmount = amountPaid
      eventPending = totalFee - amountPaid
    } else if (data.payment_status === 'pending') {
      eventType = 'ADMISSION_PENDING'
      eventAmount = 0
      eventPending = totalFee
    } else if (data.payment_status === 'discounted') {
      eventType = 'ADMISSION_FULL' // Discounted is treated as full payment of the net amount
      eventAmount = totalFee - discountAmt
      eventPending = 0
    }

    await insertFinancialEvent(adminClient, {
      library_id: data.library_id, 
      student_id: newStudent.id, 
      student_name: data.name,
      event_type: eventType, 
      amount: eventAmount, 
      pending_amount: eventPending,
      payment_mode: 'cash', 
      actor_role: staffRole, 
      actor_name: staffName,
      note: `${data.payment_status.toUpperCase()} admission. Seat: ${data.shift_display}${discountAmt > 0 ? `. Discount: ₹${discountAmt}` : ''}`
    })

    // 6. Insert Notification
    await adminClient.from('notifications').insert({
      library_id: data.library_id,
      type: 'new_admission',
      title: 'New Admission',
      message: `${data.name} admitted to seat ${data.shift_display}. Fee: ₹${data.total_fee} (${data.payment_status}). By ${staffName}.`,
      is_read: false
    })

    revalidatePath('/')
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

export async function updateStudent(studentId: string, data: any) {
  const adminClient = createAdminClient()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: staffDetails } = await supabase.from('staff').select('role, name').eq('user_id', user?.id).single()
  
  try {
    // 1.5 Check if seat-shifts are already taken by SOMEONE ELSE
    const { data: existingShifts } = await adminClient
      .from('student_seat_shifts')
      .select('id')
      .eq('seat_id', data.seat_id)
      .in('shift_code', data.shifts)
      .neq('student_id', studentId)
      .gte('end_date', new Date().toISOString().split('T')[0])

    if (existingShifts && existingShifts.length > 0) {
      throw new Error('This seat or some of its shifts are already occupied by another student.')
    }

    // 0. Get current student details for comparison
    const { data: currentStudent } = await adminClient
      .from('students')
      .select('amount_paid, total_fee, library_id, discount_amount, payment_status')
      .eq('id', studentId)
      .single()

    if (!currentStudent) throw new Error('Student not found')

    // 1. Update Student
    const { error: studentError } = await adminClient
      .from('students')
      .update({
        name: data.name,
        father_name: data.father_name || null,
        address: data.address || null,
        phone: data.phone || null,
        gender: data.gender,
        payment_status: data.payment_status,
        amount_paid: data.amount_paid || 0,
        discount_amount: data.discount_amount || 0,
        seat_id: data.seat_id,
        locker_id: data.has_locker ? data.locker_id : null,
        shift_display: data.shifts.sort().join('+'),
        selected_shifts: data.shifts
      })
      .eq('id', studentId)

    if (studentError) throw new Error(`Student update failed: ${studentError.message}`)

    // 1.5 RECORD FINANCIAL EVENT IF PAYMENT UPDATED
    const oldPaid = Number(currentStudent.amount_paid || 0)
    const newPaid = Number(data.amount_paid || 0)
    const extraPaid = newPaid - oldPaid

    if (extraPaid > 0) {
      const staffName = staffDetails?.name || 'Staff'
      const staffRole = staffDetails?.role || 'staff'
      
      await insertFinancialEvent(adminClient, {
        library_id: currentStudent.library_id,
        student_id: studentId,
        student_name: data.name,
        event_type: 'PAYMENT_RECEIVED',
        amount: extraPaid,
        pending_amount: Number(currentStudent.total_fee || 0) - newPaid,
        payment_mode: 'cash',
        actor_role: staffRole,
        actor_name: staffName,
        note: `Additional payment received. Old Paid: ₹${oldPaid}, New Paid: ₹${newPaid}. Status: ${data.payment_status.toUpperCase()}`
      })
    }

    // 2. Update Shifts (Delete old, insert new)
    const { error: deleteShiftsError } = await adminClient
      .from('student_seat_shifts')
      .delete()
      .eq('student_id', studentId)

    if (deleteShiftsError) throw new Error(`Old shifts deletion failed: ${deleteShiftsError.message}`)
    
    const shiftInserts = data.shifts.map((s: string) => ({
      student_id: studentId,
      seat_id: data.seat_id,
      shift_code: s,
      end_date: data.end_date
    }))
    
    const { error: insertShiftsError } = await adminClient
      .from('student_seat_shifts')
      .insert(shiftInserts)

    if (insertShiftsError) throw new Error(`New shifts insertion failed: ${insertShiftsError.message}`)

    // 3. Update Locker Status
    if (data.old_locker_id && data.old_locker_id !== data.locker_id) {
      await adminClient.from('lockers').update({ status: 'free' }).eq('id', data.old_locker_id)
    }
    if (data.has_locker && data.locker_id) {
      await adminClient.from('lockers').update({ status: 'occupied' }).eq('id', data.locker_id)
    }

    // 4. Insert Notification
    const staffName = staffDetails?.name || 'Staff'
    const { data: studentData } = await adminClient.from('students').select('library_id').eq('id', studentId).single()
    if (studentData) {
      await adminClient.from('notifications').insert({
        library_id: studentData.library_id,
        type: 'seat_changed',
        title: 'Student Updated',
        message: `${data.name}'s profile updated. Shifts: ${data.shifts.sort().join('+')}. By ${staffName}.`,
        is_read: false
      })
    }

    revalidatePath('/')
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

export async function renewStudent(data: any) {
  const adminClient = createAdminClient()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: staffDetails } = await supabase.from('staff').select('role, name').eq('user_id', user?.id).single()

  try {
    // 1. Calculate new end date from renewal_date
    const endDate = new Date(data.renewal_date)
    endDate.setMonth(endDate.getMonth() + data.plan_months)
    const endDateStr = endDate.toISOString().split('T')[0]

    // 2. Check if the new seat-shifts are already taken by SOMEONE ELSE
    const { data: existingShifts } = await adminClient
      .from('student_seat_shifts')
      .select('id')
      .eq('seat_id', data.seat_id)
      .in('shift_code', data.selected_shifts)
      .neq('student_id', data.student_id)
      .gte('end_date', new Date().toISOString().split('T')[0])

    if (existingShifts && existingShifts.length > 0) {
      throw new Error('This seat or some of its shifts are already occupied by another student.')
    }

    // 3. Update Student record
    const { error: studentError } = await adminClient
      .from('students')
      .update({
        end_date: endDateStr,
        plan_months: data.plan_months,
        payment_status: data.payment_status,
        total_fee: data.total_fee,
        amount_paid: data.amount_paid || 0,
        discount_amount: data.discount_amount || 0,
        monthly_rate: data.monthly_rate,
        seat_id: data.seat_id,
        locker_id: data.locker_id || null,
        combination_key: data.shift_display,
        shift_display: data.shift_display,
        selected_shifts: data.selected_shifts,
        admission_date: data.renewal_date,
      })
      .eq('id', data.student_id)

    if (studentError) throw new Error(`Student update failed: ${studentError.message}`)

    // 4. Update Shifts (Delete old, insert new)
    await adminClient.from('student_seat_shifts').delete().eq('student_id', data.student_id)

    const shiftInserts = data.selected_shifts.map((s: string) => ({
      student_id: data.student_id,
      seat_id: data.seat_id,
      shift_code: s,
      end_date: endDateStr,
    }))

    const { error: shiftError } = await adminClient.from('student_seat_shifts').insert(shiftInserts)
    if (shiftError) throw new Error(`Shift insert failed: ${shiftError.message}`)

    // 5. Update Locker Status
    if (data.old_locker_id && data.old_locker_id !== data.locker_id) {
      await adminClient.from('lockers').update({ status: 'free' }).eq('id', data.old_locker_id)
    }
    if (data.locker_id) {
      await adminClient.from('lockers').update({ status: 'occupied' }).eq('id', data.locker_id)
    }

    // 6. Insert Financial Event for Renewal
    const staffName = staffDetails?.name || 'Staff'
    const staffRole = staffDetails?.role || 'staff'
    const totalFee = Number(data.total_fee || 0)
    const amountPaid = Number(data.amount_paid || 0)
    const discountAmt = Number(data.discount_amount || 0)

    const { data: renewedStudent } = await adminClient.from('students').select('library_id, name').eq('id', data.student_id).single()
    
    if (renewedStudent) {
      const staffName = staffDetails?.name || 'Staff'
      const staffRole = staffDetails?.role || 'staff'
      const totalFee = Number(data.total_fee || 0)
      const amountPaid = Number(data.amount_paid || 0)
      const discountAmt = Number(data.discount_amount || 0)

      let eventType = 'RENEWAL'
      let eventAmount = totalFee
      let eventPending = 0

      if (data.payment_status === 'partial') {
        eventAmount = amountPaid
        eventPending = totalFee - amountPaid
      } else if (data.payment_status === 'pending') {
        eventAmount = 0
        eventPending = totalFee
      } else if (data.payment_status === 'discounted') {
        eventAmount = totalFee - discountAmt
        eventPending = 0
      }

      await insertFinancialEvent(adminClient, {
        library_id: renewedStudent.library_id, 
        student_id: data.student_id, 
        student_name: renewedStudent.name,
        event_type: eventType, 
        amount: eventAmount, 
        pending_amount: eventPending,
        payment_mode: 'cash', 
        actor_role: staffRole, 
        actor_name: staffName,
        note: `Renewed for ${data.plan_months} month(s). Fee: ₹${totalFee} (${data.payment_status.toUpperCase()}). Seat: ${data.shift_display}${discountAmt > 0 ? `. Discount: ₹${discountAmt}` : ''}`
      })

      // 7. Insert Notification
      await adminClient.from('notifications').insert({
        library_id: renewedStudent.library_id,
        type: 'student_renewed',
        title: 'Plan Renewed',
        message: `${renewedStudent.name} renewed for ${data.plan_months} month(s). Fee: ₹${data.total_fee} (${data.payment_status}). By ${staffName}.`,
        is_read: false
      })
    }

    revalidatePath('/')
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

export async function deleteStudent(
  studentId: string, 
  studentName: string,
  refundData?: { refundAmount: number; note?: string }
) {
  const adminClient = createAdminClient()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: staffDetails } = await supabase.from('staff').select('role, name').eq('user_id', user?.id).single()

  try {
    // Get student details before deleting
    const { data: student } = await adminClient
      .from('students')
      .select('library_id, locker_id, shift_display, payment_status, total_fee, amount_paid, discount_amount')
      .eq('id', studentId)
      .single()

    if (!student) throw new Error('Student not found')

    const staffName = staffDetails?.name || 'Staff'
    const staffRole = staffDetails?.role || 'staff'

    // INSERT FINANCIAL EVENT **BEFORE** DELETE (diary entry first!)
    const refundAmount = refundData?.refundAmount || 0
    if (refundAmount > 0) {
      await insertFinancialEvent(adminClient, {
        library_id: student.library_id, student_id: studentId, student_name: studentName,
        event_type: 'REFUND_ON_DELETE', amount: -refundAmount, pending_amount: 0,
        payment_mode: 'cash', actor_role: staffRole, actor_name: staffName,
        note: refundData?.note || `Refund of ₹${refundAmount} on delete. Shifts: ${student.shift_display}`
      })
    } else {
      await insertFinancialEvent(adminClient, {
        library_id: student.library_id, student_id: studentId, student_name: studentName,
        event_type: 'NO_REFUND_ON_DELETE', amount: 0, pending_amount: 0,
        payment_mode: 'cash', actor_role: staffRole, actor_name: staffName,
        note: refundData?.note || `No refund. Student deleted. Shifts: ${student.shift_display}`
      })
    }

    // Free locker if assigned
    if (student.locker_id) {
      await adminClient.from('lockers').update({ status: 'free' }).eq('id', student.locker_id)
    }

    // Delete student (shifts cascade) — AFTER financial event saved
    const { error } = await adminClient
      .from('students')
      .delete()
      .eq('id', studentId)

    if (error) throw new Error(`Delete failed: ${error.message}`)

    // Insert Notification  
    await adminClient.from('notifications').insert({
      library_id: student.library_id,
      type: 'data_cleanup_warning',
      title: 'Student Removed',
      message: `${studentName} (${student.shift_display}) removed.${refundAmount > 0 ? ` Refund: ₹${refundAmount}.` : ' No refund.'} By ${staffName}.`,
      is_read: false
    })

    revalidatePath('/')
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}
