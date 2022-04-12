interface Props {
	value?: string
	onChange?: (value: string) => unknown
	options?: string[]
}
export function Dropdown({ value, onChange, options }: Props) {
	return <select value={value} onChange={(e) => onChange?.((e.target as HTMLSelectElement).value)} class='px-2 py-1 rounded-md border border-zinc-500 bg-zinc-700 text-white'>
		{options?.map(o => <option key={o}>{o}</option>)}
	</select>
}
