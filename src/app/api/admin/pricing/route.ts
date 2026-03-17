import { NextRequest, NextResponse } from 'next/server'
import { supabaseService } from '@/lib/supabase/service'
import { getAdminFromRequest } from '@/lib/admin-auth'

export async function GET(req: NextRequest) {
  try {
    await getAdminFromRequest(req)
    
    const { data, error } = await supabaseService
      .from('pricing_config')
      .select('*')
      .order('plan', { ascending: true })

    if (error) throw error

    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await getAdminFromRequest(req)
    
    const { plan, amount, duration_minutes } = await req.json()

    if (!plan) {
      return NextResponse.json({ error: 'Plan is required' }, { status: 400 })
    }

    const updateData: any = {
      updated_at: new Date().toISOString()
    }
    if (amount !== undefined) updateData.amount = amount
    if (duration_minutes !== undefined) updateData.duration_minutes = duration_minutes

    const { data, error } = await supabaseService
      .from('pricing_config')
      .update(updateData)
      .eq('plan', plan)
      .select()

    if (error) {
      console.error('Supabase update error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data[0])
  } catch (error: any) {
    console.error('Failed to update pricing:', error);
    return NextResponse.json({ error: error.message || 'Failed to update pricing' }, { status: 500 })
  }
}
