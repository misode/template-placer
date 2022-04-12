import { useEffect, useMemo, useRef, useState } from 'preact/hooks'
import { Octicon } from './Octicon'

interface Props {
	entries: string[]
	selected: string[]
	onSelect: (entry: string) => unknown
	indent?: number
	separator?: string
}
export function TreeView({ entries, selected, onSelect, indent, separator = '/' }: Props) {
	const roots = useMemo(() => {
		const groups: Record<string, string[]> = {}
		for (const entry of entries) {
			const i = entry.indexOf(separator)
			if (i >= 0) {
				const root = entry.slice(0, i)
				;(groups[root] ??= []).push(entry.slice(i + 1))
			}
		}
		return Object.entries(groups)
	}, entries)

	const leaves = useMemo(() => {
		return entries.filter(e => !e.includes(separator))
	}, entries)

	const [shown, setHidden] = useState(new Set<string>())
	const toggle = (root: string) => {
		if (shown.has(root)) {
			shown.delete(root)
		} else {
			shown.add(root)
		}
		setHidden(new Set(shown))
	}

	return <div style={`--indent: ${indent ?? 0};`}>
		{roots.map(([r, entries]) => {
			const selectedEntries = selected.filter(e => e.startsWith(r + separator)).map(e => e.slice(r.length + 1))
			return <div key={r}>
				<TreeViewEntry icon={!shown.has(r) ? 'chevron_right' : 'chevron_down'} key={r} label={r} checked={selectedEntries.length > 0} indeterminate={selectedEntries.length > 0 && selectedEntries.length < entries.length} onOpen={() => toggle(r)} onSelect={() => onSelect(r + separator)} />
				{shown.has(r) &&
				<TreeView entries={entries} selected={selectedEntries} onSelect={e => onSelect(r + separator + e)} indent={(indent ?? 0) + 1} />}
			</div>
		})}
		{leaves.map(e => <TreeViewEntry icon='file' key={e} label={e} checked={selected.includes(e)} onSelect={() => onSelect(e)} onOpen={() => onSelect(e)} />)}
	</div>
}

interface TreeViewEntryProps {
	icon: keyof typeof Octicon
	label: string
	checked?: boolean
	indeterminate?: boolean
	onOpen?: () => unknown
	onSelect?: () => unknown
}
function TreeViewEntry({ icon, label, checked, indeterminate, onOpen, onSelect }: TreeViewEntryProps) {
	const checkbox = useRef<HTMLInputElement>(null)
	useEffect(() => {
		if (checkbox.current && indeterminate !== undefined) {
			checkbox.current.indeterminate = indeterminate
		}
	}, [indeterminate])

	const open = (e: MouseEvent) => {
		e.stopPropagation()
		onOpen?.()
	}
	return <div class='flex items-center py-1 px-0.5 select-none' style='padding-left: calc(var(--indent, 0) * 24px);'>
		<div onClick={open} class='mr-2 cursor-pointer'>
			{Octicon[icon]}
		</div>
		<div onClick={onSelect}>
			<input ref={checkbox} type='checkbox' checked={checked} class='mr-2' />
			{label}
		</div>
	</div>
}
