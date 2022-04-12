import { useEffect, useState } from 'preact/hooks'

const CACHE_NAME = 'misode-structure-placer-v1'
const MCMETA = 'https://raw.githubusercontent.com/misode/mcmeta'

type Types = 'summary' | 'registries' | 'data' | 'assets' | 'atlas'

export const McmetaDelete = Symbol()

interface FetchOptions<D> {
	decode?: (r: Response) => Promise<D>
	refresh?: boolean
}

interface McmetaOptions<D> extends FetchOptions<D> {
	version?: string
}

export function useMcmeta<D>(type: Types, path: string, options: McmetaOptions<D> = {}) {
	const [data, setData] = useState<D | undefined>(undefined)
	useEffect(() => {
		getMcmetas([[type, path]], options).then(d => setData(d[0]))
	}, [type, path, options.version])
	return data
}

export function useMcmetas<D>(requests: [Types, string][], options: McmetaOptions<D> = {}) {
	const [data, setData] = useState<D[] | undefined>(undefined)
	useEffect(() => {
		setData(undefined)
		getMcmetas(requests, options).then(setData)
	}, [...requests.flat(), options.version])
	return data
}

export async function getMcmetas<D>(requests: [Types, string][], options: McmetaOptions<D> = {}) {
	const urls = requests.map(([type, path]) => {
		const ref = options.version ? `${options.version}-${type}` : type
		return `${MCMETA}/${ref}/${path}`
	})
	const results = await Promise.allSettled(urls.map(url => cachedFetch(url, options)))
	const data = results.flatMap(r => r.status === 'fulfilled' ? [r.value] : [])
	return data
}

async function cachedFetch<D = unknown>(url: string, { decode = (r => r.json()), refresh }: FetchOptions<D> = {}): Promise<D> {
	try {
		const cache = await caches.open(CACHE_NAME)
		console.debug(`[cachedFetch] Opened cache ${CACHE_NAME} ${url}`)
		const cacheResponse = await cache.match(url)

		if (refresh) {
			try {
				return await fetchAndCache(cache, url, decode)
			} catch (e) {
				if (cacheResponse && cacheResponse.ok) {
					console.debug(`[cachedFetch] Cannot refresh, using cache ${url}`)
					return await decode(cacheResponse)
				}
				throw new Error('Failed to fetch')
			}
		} else {
			if (cacheResponse && cacheResponse.ok) {
				console.debug(`[cachedFetch] Retrieving cached data ${url}`)
				return await decode(cacheResponse)
			}
			return await fetchAndCache(cache, url, decode)
		}
	} catch (e: any) {
		console.warn(`[cachedFetch] Failed to open cache ${CACHE_NAME}: ${e.message}`)

		console.debug(`[cachedFetch] Fetching data ${url}`)
		const fetchResponse = await fetch(url)
		const fetchData = await decode(fetchResponse)
		return fetchData
	}
}

async function fetchAndCache<D>(cache: Cache, url: string, decode: (r: Response) => Promise<D>) {
	console.debug(`[cachedFetch] Fetching data ${url}`)
	const fetchResponse = await fetch(url)
	const fetchClone = fetchResponse.clone()
	const fetchData = await decode(fetchResponse)
	await cache.put(url, fetchClone)
	return fetchData
}
