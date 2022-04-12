import CancellationToken from 'cancellationtoken'
import { useCallback, useEffect, useRef, useState } from 'preact/hooks'
import { Dropdown, InputGroup, Octicon, TreeView } from './components'
import { Button } from './components/Button'
import { getMcmetas, useMcmeta } from './hooks'
import { collectStructures, decodeStructure, generateDatapack, generateLayout } from './util'

export function App() {
	const [version, setVersion] = useState<string | undefined>(undefined)
	const [selected, setSelected] = useState<string[]>([])
	const [status, setStatus] = useState<string | undefined>(undefined)
	const [pack, setPack] = useState<string | undefined>(undefined)
	const cancelToken = useRef<() => void>(() => {})

	const versions = useMcmeta<{ id: string }[]>('summary', 'versions/data.min.json', { refresh: true })

	const pools = useMcmeta<string[]>('registries', 'worldgen/template_pool/data.min.json', { version })

	useEffect(() => {
		if (versions) {
			setVersion(versions[0].id)
		}
	}, [versions])

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
		setPack(undefined)
		if (selected.length > 0) {
			const run = async (token: CancellationToken) => {
				setStatus('Computing layout...')
				const selectedPools = await getMcmetas(selected.map(s => ['data', `data/minecraft/worldgen/template_pool/${s}.json`]), { version })
				if (token.isCancelled) return
				const poolStructures = collectStructures(selectedPools)
				const structureIds = [...new Set(Object.values(poolStructures).flat())]
				const structures = await getMcmetas(structureIds.map(s => ['data', `data/minecraft/structures/${s}.nbt`]), { version, decode: decodeStructure })
				const layout = generateLayout(poolStructures, structures)
				if (token.isCancelled) return
				setStatus('Generating data pack...')
				const pack = await generateDatapack(10, layout)
				if (token.isCancelled) return
				setStatus(undefined)
				setPack(pack)
			}
			const { cancel, token } = CancellationToken.create()
			cancelToken.current()
			cancelToken.current = cancel
			run(token)
		}
	}, [version, selected])

	return <main class='flex flex-col items-start gap-4 p-4 accent-teal-600'>
		<InputGroup label='Version'>
			<Dropdown value={version} onChange={setVersion} options={versions?.map(v => v.id)} />
		</InputGroup>
		<div>
			<h3 class='text-xl' >Template pools</h3>
			<TreeView entries={pools ?? []} selected={selected} onSelect={select} />
		</div>
		{(status && !pack) && <p class='text-zinc-500'>{status}</p>}
		{pack && <Button href={pack} download='StructurePlacer.zip'>{Octicon.download} Download data pack</Button>}
	</main>
}
