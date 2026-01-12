import type { FunctionalComponent } from 'preact'
import { useEffect, useRef, useState } from 'preact/hooks'
import './ReviewMoreMenu.css'

interface ReviewMoreMenuProps {
	onEdit: () => void
	onSkip: () => void
	onUndo: () => void
	onSuspend: () => void
	onCardInfo: () => void
	onDelete: () => void
	canUndo: boolean
}

export const ReviewMoreMenu: FunctionalComponent<ReviewMoreMenuProps> = ({
	onEdit,
	onSkip,
	onUndo,
	onSuspend,
	onCardInfo,
	onDelete,
	canUndo,
}) => {
	const [isOpen, setIsOpen] = useState(false)
	const menuRef = useRef<HTMLDivElement>(null)

	useEffect(() => {
		if (!isOpen) return

		/* eslint-disable ts/prefer-readonly-parameter-types -- DOM types */
		const handleClickOutside = (event: Event): void => {
			if (menuRef.current !== null && !menuRef.current.contains(event.target as Node)) {
				setIsOpen(false)
			}
		}

		const handleEscape = (event: Event): void => {
			if ((event as KeyboardEvent).key === 'Escape') {
				setIsOpen(false)
			}
		}
		/* eslint-enable ts/prefer-readonly-parameter-types */

		document.addEventListener('mousedown', handleClickOutside)
		document.addEventListener('keydown', handleEscape)

		return () => {
			document.removeEventListener('mousedown', handleClickOutside)
			document.removeEventListener('keydown', handleEscape)
		}
	}, [isOpen])

	const handleAction = (action: () => void): void => {
		setIsOpen(false)
		action()
	}

	return (
		<div className="ir-more-menu" ref={menuRef}>
			<button
				className="ir-more-button"
				onClick={() => setIsOpen(!isOpen)}
				aria-label="More options"
				aria-expanded={isOpen}
			>
				More
			</button>

			{isOpen && (
				<div className="ir-more-dropdown">
					<button className="ir-more-item" onClick={() => handleAction(onEdit)}>
						<span>Edit</span>
						<span className="ir-more-shortcut">e</span>
					</button>
					<button className="ir-more-item" onClick={() => handleAction(onSkip)}>
						<span>Skip</span>
						<span className="ir-more-shortcut">s</span>
					</button>
					<button
						className="ir-more-item"
						onClick={() => handleAction(onUndo)}
						disabled={!canUndo}
					>
						<span>Undo</span>
						<span className="ir-more-shortcut">z</span>
					</button>

					<div className="ir-more-separator" />

					<button className="ir-more-item" onClick={() => handleAction(onSuspend)}>
						<span>Suspend</span>
					</button>
					<button className="ir-more-item" onClick={() => handleAction(onCardInfo)}>
						<span>Card Info</span>
						<span className="ir-more-shortcut">i</span>
					</button>

					<div className="ir-more-separator" />

					<button
						className="ir-more-item ir-more-item-danger"
						onClick={() => handleAction(onDelete)}
					>
						<span>Delete</span>
					</button>
				</div>
			)}
		</div>
	)
}
