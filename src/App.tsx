import CancellationToken from 'cancellationtoken'
import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks'
import { Dropdown, InputGroup, Octicon, TreeView } from './components'
import { Button } from './components/Button'
import { getMcmetas, useMcmeta, useMcmetas } from './hooks'
import { collectStructures, decodeStructure, generateDatapack, generateLayout, Layout } from './util'

export function App() {
	const [version, setVersion] = useState<string | undefined>(undefined)
	const [experimental, setExperimental] = useState<boolean>(true)
	const [selected, setSelected] = useState<string[]>([])
	const [status, setStatus] = useState<string | undefined>(undefined)
	const [layout, setLayout] = useState<Layout | undefined>(undefined)
	const [pack, setPack] = useState<string | undefined>(undefined)
	const cancelToken = useRef<() => void>(() => {})

	const versions = useMcmeta<{ id: string, data_pack_version: number }[]>('summary', 'versions/data.min.json', { refresh: true })
	const experiments = useMcmeta<string[]>('registries', 'datapack/data.min.json', { version })

	const vanillaPools = useMcmeta<string[]>('registries', 'worldgen/template_pool/data.min.json', { version })
	const experimentPools = useMcmetas<string[] | null>(experiments?.map(e => ['registries', `experiment/${e}/worldgen/template_pool/data.min.json`]) ?? [], { version, fallback: null })

	const pools = useMemo(() => {
		let pools = vanillaPools?.slice() ?? []
		if (experimental) {
			pools.push(...experimentPools?.flatMap(e => e === null ? [] : e) ?? [])
			pools = [...new Set(pools)]
		}
		pools.sort()
		return pools
	}, [experimental, vanillaPools, experimentPools])

	useEffect(() => {
		if (versions) {
			setVersion(versions[0].id)
		}
	}, [versions])

	const packFormat = useMemo(() => {
		return versions?.find(v => v.id === version)?.data_pack_version
	}, [versions, version])

	const select = useCallback((entry: string) => {
		if (pools?.includes(entry)) {
			setSelected(s => selected.includes(entry) ? s.filter(e => e !== entry) : [...s, entry])
		} else {
			const children = pools?.filter(p => p.startsWith(entry)) ?? []
			setSelected([
				...selected.filter(e => !children.includes(e)),
				...children?.every(p => selected.includes(p)) ? [] : children,
			])
		}
	}, [pools, selected])

	useEffect(() => {
		if (selected.some(e => !pools?.includes(e))) {
			setSelected(selected.filter(e => pools?.includes(e)))
			cancelToken.current()
		}
	}, [pools, selected])

	useEffect(() => {
		setStatus(undefined)
		setLayout(undefined)
		setPack(undefined)
		if (selected.length > 0) {
			const run = async (token: CancellationToken) => {
				setStatus('Computing layout...')
				const selectedPools = await getMcmetas(selected.map(s => {
					const expIndex = experimentPools?.findIndex(p => p?.includes(s))
					const experiment = expIndex === undefined ? '' : `datapacks/${experiments?.[expIndex]}/data/minecraft/`
					return ['data', `data/minecraft/${experiment}worldgen/template_pool/${s}.json`]
				}), { version })
				if (token.isCancelled) return
				const poolStructures = collectStructures(selected, selectedPools)
				const structureIds = [...new Set(Object.values(poolStructures).flat())]
				const structures = await getMcmetas(structureIds.map(s => ['data', `data/minecraft/structures/${s}.nbt`]), { version, decode: decodeStructure })
				const layout = generateLayout(poolStructures, structures)
				if (token.isCancelled) return
				setLayout(layout)
				setStatus('Generating data pack...')
				const pack = await generateDatapack(packFormat ?? 10, layout)
				if (token.isCancelled) return
				setStatus(undefined)
				setPack(pack)
			}
			const { cancel, token } = CancellationToken.create()
			cancelToken.current()
			cancelToken.current = cancel
			run(token)
		}
	}, [version, packFormat, selected, experimentPools, experiments])

	return <main class='flex flex-col items-start gap-4 p-4 accent-teal-600'>
		<div class="flex gap-5">
			<InputGroup label='Version'>
				<Dropdown value={version} onChange={setVersion} options={versions?.map(v => v.id)} />
			</InputGroup>
			<label class="flex items-center gap-2" >
				<input type="checkbox" checked={experimental} onClick={() => setExperimental(!experimental)} />
				Include experimental
			</label>
		</div>
		<div>
			<h3 class='text-xl' >Template pools</h3>
			<TreeView entries={pools} selected={selected} onSelect={select} />
		</div>
		{(status && !pack) && <p class='text-zinc-500'>{status}</p>}
		{pack && <Button href={pack} download='StructurePlacer.zip'>{Octicon.download} Download data pack</Button>}
		{layout && <div class='max-w-full'>
			<h3 class='text-xl' >Layout</h3>
			<div class='flex flex-col items-start gap-2 max-w-full'>
				{[...new Set(layout.map(s => s.pool))].map(pool =>
					<div key={pool} class='border border-zinc-600 px-2 pb-1 max-w-full'>
						<h4>{pool}</h4>
						<div class='flex items-start gap-1 mt-1 overflow-x-auto max-w-full'>
							{layout.filter(s => s.pool === pool).sort((a, b) => a.pos[0] - b.pos[0]).map(s =>
								<div key={s.name} class='flex border border-zinc-400' title={s.name}
									style={{ width: `${s.size[0] * 2}px`, height: `${s.size[2] * 2}px` }} />)}
						</div>
					</div>)}
			</div>
		</div>}
	</main>
}
