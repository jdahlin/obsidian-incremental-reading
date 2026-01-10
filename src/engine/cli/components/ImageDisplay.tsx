import React from 'react';
import { Box, Text } from 'ink';
import Image, { TerminalInfoContext } from 'ink-picture';

interface ImageDisplayProps {
	imagePaths: string[];
	maxWidth: number;
}

export function ImageDisplay({ imagePaths, maxWidth }: ImageDisplayProps) {
	const terminalInfo = React.useContext(TerminalInfoContext);

	if (imagePaths.length === 0) {
		return null;
	}

	// If no terminal info (snapshot mode), show placeholder text
	if (!terminalInfo) {
		return (
			<Box flexDirection="column" marginBottom={1}>
				<Text color="gray">
					[{imagePaths.length} image{imagePaths.length > 1 ? 's' : ''}]
				</Text>
			</Box>
		);
	}

	// Use 80% of available width, responsive to terminal size
	const imageWidth = Math.floor(maxWidth * 0.8);
	const imageHeight = 24; // Height in terminal rows

	return (
		<Box
			flexDirection="column"
			marginBottom={1}
			marginTop={1}
			width={maxWidth}
			alignItems="center"
		>
			{imagePaths.map((imgPath, idx) => (
				<Box
					key={idx}
					width={imageWidth}
					height={imageHeight}
					marginBottom={idx < imagePaths.length - 1 ? 1 : 0}
					justifyContent="center"
				>
					<Image src={imgPath} alt={`Image ${idx + 1}`} />
				</Box>
			))}
			{imagePaths.length > 0 && (
				<Box marginTop={1}>
					<Text color="gray" dimColor>
						{imagePaths.length} image{imagePaths.length > 1 ? 's' : ''}
					</Text>
				</Box>
			)}
		</Box>
	);
}
