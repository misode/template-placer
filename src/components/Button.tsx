import { ComponentChildren } from 'preact'

interface Props extends JSX.HTMLAttributes<HTMLAnchorElement> {
	children: ComponentChildren
}
export function Button(props: Props) {
	return <a {...props} class='flex items-center gap-1 px-3 py-1 rounded-md bg-teal-700 text-white text-md cursor-pointer'>
		{props.children}
	</a>
}
