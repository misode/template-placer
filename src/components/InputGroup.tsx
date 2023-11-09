import { ComponentChildren } from 'preact'

interface Props {
	label: string
	children: ComponentChildren
}
export function InputGroup({ label, children }: Props) {
	return <div class='flex items-center gap-2'>
		<label class='text-xl'>{label}</label>
		{children}
	</div>
}
