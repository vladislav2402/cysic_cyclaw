const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'content-length',
  'content-encoding',
  'host',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
])

function apiProxyBase() {
  return process.env.API_PROXY_URL || process.env.API_BASE_URL || ''
}

function buildUpstreamUrl(path: string[], request: Request) {
  const requestUrl = new URL(request.url)
  const upstream = new URL(`/api/${path.join('/')}`, apiProxyBase())
  upstream.search = requestUrl.search
  return upstream
}

async function proxy(request: Request, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params
  const requestUrl = new URL(request.url)
  const proxyBase = apiProxyBase()

  if (!proxyBase) {
    return Response.json(
      {
        detail: 'API proxy is not configured. Set API_PROXY_URL or API_BASE_URL on the frontend deployment.',
      },
      { status: 500 },
    )
  }

  const upstreamUrl = buildUpstreamUrl(path, request)

  if (upstreamUrl.host === requestUrl.host) {
    return Response.json(
      {
        detail: 'API proxy is misconfigured. API_PROXY_URL must point to the backend origin, not the frontend origin.',
      },
      { status: 500 },
    )
  }

  const headers = new Headers(request.headers)

  for (const header of HOP_BY_HOP_HEADERS) {
    headers.delete(header)
  }

  let response: Response
  try {
    response = await fetch(upstreamUrl, {
      method: request.method,
      headers,
      body: request.method === 'GET' || request.method === 'HEAD' ? undefined : await request.arrayBuffer(),
      redirect: 'manual',
      cache: 'no-store',
    })
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Unknown upstream fetch error.'
    return Response.json(
      {
        detail: 'API proxy upstream request failed.',
        upstream: upstreamUrl.toString(),
        error: detail,
      },
      { status: 502 },
    )
  }

  const responseHeaders = new Headers(response.headers)
  for (const header of HOP_BY_HOP_HEADERS) {
    responseHeaders.delete(header)
  }

  const body =
    request.method === 'HEAD' || response.status === 204 || response.status === 304 ? null : await response.arrayBuffer()

  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  })
}

export const dynamic = 'force-dynamic'

export { proxy as GET, proxy as POST, proxy as PUT, proxy as PATCH, proxy as DELETE, proxy as OPTIONS, proxy as HEAD }
