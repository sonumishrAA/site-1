const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL

export async function callEdgeFunction(
  name: string,
  options: {
    method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
    body?: any
    headers?: Record<string, string>
    useAdminToken?: boolean
    queryParams?: Record<string, string>
  } = {}
) {
  const { method = 'POST', body, headers = {}, useAdminToken = false, queryParams } = options

  let url = `${SUPABASE_URL}/functions/v1/${name}`
  
  if (queryParams) {
    const searchParams = new URLSearchParams(queryParams)
    url += `?${searchParams.toString()}`
  }
  
  const isFormData = body instanceof FormData
  
  const allHeaders: Record<string, string> = {
    'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
    ...headers,
  }

  if (!isFormData) {
    allHeaders['Content-Type'] = 'application/json'
  }

  if (useAdminToken) {
    const token = localStorage.getItem('admin_token')
    if (token) {
      allHeaders['Authorization'] = `Bearer ${token}`
    }
  }

  // Fallback Authorization if not set (for public protected functions)
  if (!allHeaders['Authorization'] && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    allHeaders['Authorization'] = `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`
  }

  const res = await fetch(url, {
    method,
    headers: allHeaders,
    body: isFormData ? body : (body ? JSON.stringify(body) : undefined),
  })

  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || 'Request failed')
  }

  return res.json()
}
