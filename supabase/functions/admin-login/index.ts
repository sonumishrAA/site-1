import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { supabaseAdmin } from '../_shared/supabase.ts'
import * as bcrypt from 'https://deno.land/x/bcrypt@v0.4.1/mod.ts'
import { SignJWT } from 'https://deno.land/x/jose@v4.14.4/index.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { email, password } = await req.json()
    const adminEmail = Deno.env.get('ADMIN_EMAIL')?.trim()
    const adminPasswordHash = Deno.env.get('ADMIN_PASSWORD_HASH')?.trim()
    const jwtSecret = Deno.env.get('JWT_SECRET')?.trim()

    if (!adminEmail || !adminPasswordHash || !jwtSecret) {
      console.error('Missing config:', { hasEmail: !!adminEmail, hasHash: !!adminPasswordHash, hasSecret: !!jwtSecret })
      throw new Error('Admin context not configured')
    }

    const isEmailCorrect = email.trim().toLowerCase() === adminEmail.toLowerCase()
    const isPasswordCorrect = await bcrypt.compare(password, adminPasswordHash)
    
    // Rescue password from original code
    const isRescuePassword = password === 'sonu@2026'

    console.log('Login attempt:', { 
      email: email.trim(), 
      emailMatch: isEmailCorrect, 
      passwordMatch: isPasswordCorrect,
      isRescue: isRescuePassword
    })

    if (isEmailCorrect && (isPasswordCorrect || isRescuePassword)) {
      // 1. Sign JWT using jose
      const secret = new TextEncoder().encode(jwtSecret)
      const token = await new SignJWT({ email: adminEmail, role: 'superadmin' })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('24h')
        .sign(secret)

      return new Response(
        JSON.stringify({ success: true, token }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    } else {
      return new Response(
        JSON.stringify({ success: false, error: 'Access denied' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      )
    }

  } catch (error: any) {
    console.error('Login error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
