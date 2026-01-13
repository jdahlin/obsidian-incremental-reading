import type { ContentItem } from '@/data/mockData'
import {
	ChevronLeft,
	ChevronRight,
	Download,
	Highlighter,
	MessageSquare,
	Share2,
	X,
	ZoomIn,
	ZoomOut,
} from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface ContentViewerProps {
	item: ContentItem
	onClose: () => void
	isSelectionMode?: boolean
}

export const ContentViewer = ({
	item,
	onClose,
	isSelectionMode = false,
}: Readonly<ContentViewerProps>) => {
	const [currentPage, setCurrentPage] = useState(1)
	const [zoom, setZoom] = useState(100)
	const [_selectedText, _setSelectedText] = useState('')
	const totalPages = item.pageCount || 1

	// Mock PDF content - in real app this would be actual PDF rendering
	const mockContent = {
		'content-4-1': {
			title: 'Chapter 4: The Three-Dimensional Structure of Proteins',
			sections: [
				{
					heading: '4.1 Overview of Protein Structure',
					content: `Proteins are the most versatile macromolecules in living systems. They serve crucial functions in virtually all biological processes: as enzymes, structural components, transport molecules, and signaling agents.

The function of a protein depends on its three-dimensional structure, which is determined by its amino acid sequence. This chapter explores the different levels of protein structure and the forces that stabilize them.`,
					isHighlighted: true,
				},
				{
					heading: '4.2 Primary Structure',
					content: `The primary structure of a protein refers to the linear sequence of amino acids in its polypeptide chain. This sequence is encoded by the gene for that protein and determines all higher levels of structure.

The peptide bond connecting amino acids has partial double-bond character, restricting rotation and keeping the peptide group planar. This planarity has important consequences for protein folding.`,
					hasAnnotation: true,
					annotation:
						'Key concept: Primary structure determines all other structural levels!',
				},
				{
					heading: '4.3 Secondary Structure: α-Helix',
					content: `The α-helix is one of the most common secondary structure elements. It is a right-handed coil stabilized by hydrogen bonds between the carbonyl oxygen of residue n and the amide hydrogen of residue n+4.

Key features of the α-helix:
• 3.6 residues per turn
• Rise of 1.5 Å per residue  
• Hydrogen bonds parallel to helix axis
• Side chains point outward from helix

Certain amino acids are helix-breakers (Proline, Glycine) while others are helix-formers (Alanine, Leucine, Methionine).`,
				},
			],
		},
	}

	const content = mockContent[item.id as keyof typeof mockContent] || {
		title: item.title,
		sections: [
			{
				heading: 'Content Preview',
				content: `${item.description}\n\nFull content would be rendered here with PDF.js or similar library for actual PDF files.`,
			},
		],
	}

	return (
		<div
			className={cn(
				'fixed inset-0 bg-background/95 backdrop-blur-sm z-50 flex flex-col animate-fade-in',
				isSelectionMode && 'cursor-text',
			)}
		>
			{/* Header */}
			<header className="flex items-center justify-between px-6 py-4 border-b border-border bg-card">
				<div className="flex items-center gap-4">
					<Button variant="ghost" size="icon" onClick={onClose}>
						<X className="w-5 h-5" />
					</Button>
					<div>
						<h1 className="font-serif font-medium text-lg text-foreground">
							{item.title}
						</h1>
						{item.author && (
							<p className="text-sm text-muted-foreground">{item.author}</p>
						)}
					</div>
				</div>

				<div className="flex items-center gap-2">
					{/* Zoom Controls */}
					<div className="flex items-center gap-1 mr-4">
						<Button
							variant="ghost"
							size="icon"
							onClick={() => setZoom(Math.max(50, zoom - 10))}
						>
							<ZoomOut className="w-4 h-4" />
						</Button>
						<span className="text-sm text-muted-foreground w-12 text-center">
							{zoom}%
						</span>
						<Button
							variant="ghost"
							size="icon"
							onClick={() => setZoom(Math.min(200, zoom + 10))}
						>
							<ZoomIn className="w-4 h-4" />
						</Button>
					</div>

					<Button variant="ghost" size="icon">
						<Highlighter className="w-4 h-4" />
					</Button>
					<Button variant="ghost" size="icon">
						<MessageSquare className="w-4 h-4" />
					</Button>
					<Button variant="ghost" size="icon">
						<Download className="w-4 h-4" />
					</Button>
					<Button variant="ghost" size="icon">
						<Share2 className="w-4 h-4" />
					</Button>
				</div>
			</header>

			{/* Content Area */}
			<main className="flex-1 overflow-auto p-8">
				<div
					className="max-w-3xl mx-auto bg-card rounded-xl border border-border shadow-soft p-8 md:p-12"
					style={{ fontSize: `${zoom}%` }}
				>
					<h1 className="font-serif text-2xl md:text-3xl font-bold text-foreground mb-8">
						{content.title}
					</h1>

					{content.sections.map((section, index) => (
						<div key={index} className="mb-8">
							<h2 className="font-serif text-xl font-semibold text-foreground mb-4">
								{section.heading}
							</h2>
							<div
								className={cn(
									'prose prose-lg max-w-none text-foreground/90 whitespace-pre-wrap',
									section.isHighlighted &&
										'bg-highlight-soft -mx-4 px-4 py-2 rounded-lg',
								)}
							>
								{section.content}
							</div>
							{section.hasAnnotation && section.annotation && (
								<div className="mt-4 flex items-start gap-3 p-4 bg-primary/10 rounded-lg border-l-4 border-primary">
									<MessageSquare className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
									<p className="text-sm text-foreground">{section.annotation}</p>
								</div>
							)}
						</div>
					))}
				</div>
			</main>

			{/* Page Navigation */}
			{totalPages > 1 && (
				<footer className="flex items-center justify-center gap-4 py-4 border-t border-border bg-card">
					<Button
						variant="ghost"
						size="icon"
						disabled={currentPage <= 1}
						onClick={() => setCurrentPage((p) => p - 1)}
					>
						<ChevronLeft className="w-5 h-5" />
					</Button>
					<span className="text-sm text-muted-foreground">
						Page {currentPage} of {totalPages}
					</span>
					<Button
						variant="ghost"
						size="icon"
						disabled={currentPage >= totalPages}
						onClick={() => setCurrentPage((p) => p + 1)}
					>
						<ChevronRight className="w-5 h-5" />
					</Button>
				</footer>
			)}
		</div>
	)
}
