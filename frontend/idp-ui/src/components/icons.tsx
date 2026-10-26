import type { SVGProps } from 'react'

// Small 20px outline icons for navigation. Decorative only: always paired with a text label.
function Icon({ d, ...props }: SVGProps<SVGSVGElement> & { d: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden className="size-[18px] shrink-0" {...props}>
      <path d={d} />
    </svg>
  )
}

export const HomeIcon = () => <Icon d="M3 9.5 10 3.5l7 6V16a1 1 0 0 1-1 1h-3.5v-4.5h-5V17H4a1 1 0 0 1-1-1V9.5Z" />
export const AppsIcon = () => <Icon d="M3.5 3.5h5v5h-5zM11.5 3.5h5v5h-5zM3.5 11.5h5v5h-5zM11.5 11.5h5v5h-5z" />
export const UsersIcon = () => <Icon d="M7.5 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM2 17c0-3 2.5-5 5.5-5s5.5 2 5.5 5M13.5 3.2a3 3 0 0 1 0 5.6M15 12.2c1.8.6 3 2.4 3 4.8" />
export const RolesIcon = () => <Icon d="M10 2.5 16.5 5v4.5c0 4-2.8 7-6.5 8.5-3.7-1.5-6.5-4.5-6.5-8.5V5L10 2.5ZM7.5 10l2 2 3.5-4" />
export const ScopesIcon = () => <Icon d="M11 3H4a1 1 0 0 0-1 1v7l7 7 8-8-7-7ZM7 7h.01" />
export const PlusIcon = () => <Icon d="M10 4.5v11M4.5 10h11" />
export const MenuIcon = () => <Icon d="M3 5.5h14M3 10h14M3 14.5h14" />
export const SignOutIcon = () => <Icon d="M8 17H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h4M13 14l4-4-4-4M17 10H8" />
