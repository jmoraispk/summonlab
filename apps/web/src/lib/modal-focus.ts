const focusableSelector = [
	'a[href]',
	'button:not([disabled])',
	'input:not([disabled])',
	'select:not([disabled])',
	'textarea:not([disabled])',
	'[tabindex]:not([tabindex="-1"])'
].join(',');

export function focusDialog(dialog: HTMLElement): void {
	dialog.focus();
}

export function handleModalKeydown(
	event: KeyboardEvent,
	dialog: HTMLElement,
	onClose: () => void
): void {
	if (event.key === 'Escape') {
		event.preventDefault();
		event.stopPropagation();
		onClose();
		return;
	}
	if (event.key !== 'Tab') return;

	const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(focusableSelector)).filter(
		(element) => !element.hasAttribute('hidden') && element.getAttribute('aria-hidden') !== 'true'
	);
	if (focusable.length === 0) {
		event.preventDefault();
		dialog.focus();
		return;
	}
	const first = focusable[0]!;
	const last = focusable.at(-1)!;
	if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
		event.preventDefault();
		last.focus();
	} else if (
		!event.shiftKey &&
		(document.activeElement === last || document.activeElement === dialog)
	) {
		event.preventDefault();
		first.focus();
	}
}
