import { ComponentChildren } from 'preact'

interface Props {
	label: string
	children: ComponentChildren
}
export function InputGroup({ label, children }: Props) {
	return <div class='flex items-center'>
		<label class='mr-3 text-xl'>{label}</label>
		{children}
	</div>
}
