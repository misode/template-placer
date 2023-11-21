import { BlobWriter, TextReader, ZipWriter } from '@zip.js/zip.js'
import { getListTag, read as readNbt } from 'deepslate'

export async function computeIfAbsent<K, V>(map: Map<K, V>, key: K, getter: (key: K) => Promise<V>): Promise<V> {
	const existing = map.get(key)
	if (existing) {
		return existing
	}
	const value = await getter(key)
	map.set(key, value)
	return value
}

export function collectStructures(keys: string[], pools: any[]): Record<string, string[]> {
	if (!pools) return {}
	const getStructures = (element: any) => {
		const type = element?.element_type?.replace(/^minecraft:/, '')
		switch (type) {
			case 'single_pool_element':
			case 'legacy_single_pool_element':
				return [element.location.replace(/^minecraft:/, '')]
			case 'list_pool_element':
				return element.elements?.flatMap(getStructures)
		}
		return []
	}
	return Object.fromEntries(pools.flatMap((pool, i) => {
		const structures = pool.elements.flatMap((e: any) => getStructures(e.element))
		if (structures.length === 0) return []
		return [[keys[i], [...new Set<string>(structures)]]]
	}))
}

export interface Structure {
	name: string
	size: [number, number, number]
}

const StructureCache = new Map<string, Structure>()

export function decodeStructure(response: Response): Promise<Structure> {
	return computeIfAbsent(StructureCache, response.url, async () => {
		const urlMatch = response.url.match(/minecraft\/structures\/([a-z0-9/_]+).nbt$/)
		if (urlMatch === null) {
			throw new Error(`Cannot find structure name in url ${response.url}`)
		}
		const name = urlMatch[1]
		if (!response.ok) {
			return { name, size: [0, 0, 0] }
		}
		try {
			const buffer = await response.arrayBuffer()
			const root = readNbt(new Uint8Array(buffer)).result
			const size = getListTag(root.value, 'size', 'int', 3) as [number, number, number]
			return { name, size }
		} catch (e: any) {
			throw new Error(`Failed to decode structure ${name}: ${e.message}`)
		}
	})
}

export type Layout = { pool: string, name: string, pos: [number, number], size: [number, number, number] }[]

export function generateLayout(pools: Record<string, string[]>, structures: Structure[]) {
	const structureSizes = new Map(structures.map(s => [s.name, s.size]))
	const layout: Layout = []
	let currentZ = 0
	for (const [pool, structuresInPool] of Object.entries(pools)) {
		let maxZ = 0
		let currentX = 0
		for (const name of structuresInPool) {
			const size = structureSizes.get(name)
			if (!size) {
				console.warn(`Skipping structure ${name}`)
				continue
			}
			maxZ = Math.max(maxZ, size[2])
			layout.push({ pool, name, pos: [currentX, currentZ], size })
			currentX += size[0] + 4
		}
		currentZ += maxZ + 8
	}
	return layout
}

export async function generateDatapack(packFormat: number, layout: Layout) {
	const zip = new ZipWriter(new BlobWriter('application/zip'))
	const addFile = async (name: string, content: string[] | object) => {
		const reader = Array.isArray(content)
			? new TextReader(content.map(line => `${line  }\n`).join(''))
			: new TextReader(JSON.stringify(content, null, 2))
		await zip.add(name, reader)
	}
	await addFile('pack.mcmeta', { pack: { pack_format: packFormat, description: '' } })
	await addFile('data/minecraft/tags/functions/load.json', { values: ['structure_placer:load'] })
	await addFile('data/structure_placer/functions/load.mcfunction', [
		'scoreboard objectives add structure_placer dummy',
		'execute unless score $bounding_boxes structure_placer matches 0.. run scoreboard players set $bounding_boxes structure_placer 1',
		'',
		'function structure_placer:load_wait',
	])
	await addFile('data/structure_placer/functions/load_wait.mcfunction', [
		'execute if entity @a[limit=1] run function structure_placer:load_finish',
		'execute unless entity @a[limit=1] run schedule function structure_placer:load 1t',
	])
	await addFile('data/structure_placer/functions/load_finish.mcfunction', [
		'function structure_placer:show_menu',
	])
	await addFile('data/structure_placer/functions/show_menu.mcfunction', [
		'tellraw @a [{"text": "[Place Structures] ", "color": "aqua", "clickEvent": {"action": "run_command", "value": "/function structure_placer:place"} }, {"text": "[Toggle bounding boxes]", "color": "gold", "clickEvent": {"action": "run_command", "value": "/function structure_placer:toggle_bounding_boxes"} }]',
	])
	await addFile('data/structure_placer/functions/toggle_bounding_boxes.mcfunction', [
		'execute store success score $bounding_boxes structure_placer if score $bounding_boxes structure_placer matches 0',
		'execute at @e[type=area_effect_cloud,tag=structure_placer] store result block ~ ~-1 ~ showboundingbox byte 1 run scoreboard players get $bounding_boxes structure_placer',
	])
	await addFile('data/structure_placer/functions/forceload_add.mcfunction', [
		...layout.flatMap(({ pos }) => [
			`execute at @e[type=marker,tag=structure_placer_origin] run forceload add ~${pos[0]} ~${pos[1]}`,
		]),
	])
	await addFile('data/structure_placer/functions/forceload_remove.mcfunction', [
		...layout.flatMap(({ pos }) => [
			`execute at @e[type=marker,tag=structure_placer_origin] run forceload remove ~${pos[0]} ~${pos[1]}`,
		]),
	])
	await addFile('data/structure_placer/functions/place.mcfunction', [
		'tellraw @a [{"text": "Placing structures... (this can take a while)", "color": "dark_aqua"}]',
		'summon marker ~ ~ ~ {Tags:["structure_placer_origin"]}',
		'function structure_placer:forceload_add',
		'schedule function structure_placer:check_loaded 1t',
	])
	await addFile('data/structure_placer/functions/check_loaded.mcfunction', [
		'scoreboard players set $loaded structure_placer 1',
		...layout.flatMap(({ pos }) => [
			`execute at @e[type=marker,tag=structure_placer_origin] unless loaded ~${pos[0]} 0 ~${pos[1]} run scoreboard players set $loaded structure_placer 0`,
		]),
		'execute if score $loaded structure_placer matches 0 run schedule function structure_placer:check_loaded 5t',
		'execute if score $loaded structure_placer matches 1 run function structure_placer:place_prepare',
	])
	await addFile('data/structure_placer/functions/place_prepare.mcfunction', [
		'schedule function structure_placer:place_finish 1t',
		...layout.flatMap(({ name, pos }) => [
			`setblock ~${pos[0]} ~ ~${pos[1]} structure_block[mode=load]{mode:"LOAD",name:"minecraft:${name}",showboundingbox:1b,posX:1}`,
			`summon area_effect_cloud ~${pos[0]} ~1 ~${pos[1]} {Duration:2000000000,CustomName:'"${name}"',CustomNameVisible:1b,Tags:["structure_placer"]}`,
		]),
		'execute at @e[type=area_effect_cloud,tag=structure_placer] store result block ~ ~-1 ~ showboundingbox byte 1 run scoreboard players get $bounding_boxes structure_placer',
	])
	await addFile('data/structure_placer/functions/place_finish.mcfunction', [
		'execute at @e[type=area_effect_cloud,tag=structure_placer] run setblock ~ ~-2 ~ redstone_block',
		'schedule function structure_placer:forceload_remove 1t',
	])
	const blob = await zip.close() as Blob
	return URL.createObjectURL(blob)
}
