import { constants as fsConstants } from 'node:fs';
import { lstat, mkdir, open, unlink } from 'node:fs/promises';
import path from 'node:path';

export type EquipmentRepositoryPathState = 'absent' | 'file' | 'directory';

interface FileIdentity {
	readonly device: number;
	readonly inode: number;
}

function repositoryPathComponents(repositoryPath: string): readonly string[] {
	if (
		path.posix.isAbsolute(repositoryPath) ||
		repositoryPath.includes('\\') ||
		repositoryPath
			.split('/')
			.some((component) => component === '' || component === '.' || component === '..')
	) {
		throw new Error(`Invalid repository-relative POSIX path: ${repositoryPath}`);
	}
	return repositoryPath.split('/');
}

export function equipmentRepositoryAbsolute(workspaceRoot: string, repositoryPath: string): string {
	const components = repositoryPathComponents(repositoryPath);
	const root = path.resolve(workspaceRoot);
	const absolute = path.resolve(root, ...components);
	if (absolute === root || !absolute.startsWith(`${root}${path.sep}`)) {
		throw new Error(`Repository path escapes the workspace root: ${repositoryPath}`);
	}
	return absolute;
}

async function assertRealWorkspaceRoot(workspaceRoot: string): Promise<string> {
	const root = path.resolve(workspaceRoot);
	const metadata = await lstat(root);
	if (metadata.isSymbolicLink() || !metadata.isDirectory()) {
		throw new Error('Workspace root must be a real directory, not a symbolic link');
	}
	return root;
}

function symbolicLinkError(repositoryPath: string): Error {
	return new Error(`Equipment repository path refuses symbolic links: ${repositoryPath}`);
}

export async function equipmentRepositoryPathState(
	workspaceRoot: string,
	repositoryPath: string
): Promise<EquipmentRepositoryPathState> {
	const components = repositoryPathComponents(repositoryPath);
	let cursor = await assertRealWorkspaceRoot(workspaceRoot);
	for (const [index, component] of components.entries()) {
		cursor = path.join(cursor, component);
		const metadata = await lstat(cursor).catch((error: NodeJS.ErrnoException) => {
			if (error.code === 'ENOENT') return null;
			throw error;
		});
		if (metadata === null) return 'absent';
		if (metadata.isSymbolicLink()) throw symbolicLinkError(repositoryPath);
		const final = index === components.length - 1;
		if (!final) {
			if (!metadata.isDirectory()) {
				throw new Error(`Equipment repository ancestor is not a directory: ${repositoryPath}`);
			}
			continue;
		}
		if (metadata.isFile()) return 'file';
		if (metadata.isDirectory()) return 'directory';
		throw new Error(`Equipment repository path has an unsupported file type: ${repositoryPath}`);
	}
	throw new Error(`Invalid repository-relative POSIX path: ${repositoryPath}`);
}

async function assertRegularRepositoryFile(
	workspaceRoot: string,
	repositoryPath: string
): Promise<string> {
	const state = await equipmentRepositoryPathState(workspaceRoot, repositoryPath);
	if (state !== 'file') {
		throw new Error(`Equipment repository read requires a regular file: ${repositoryPath}`);
	}
	return equipmentRepositoryAbsolute(workspaceRoot, repositoryPath);
}

export async function readEquipmentRepositoryFile(
	workspaceRoot: string,
	repositoryPath: string
): Promise<Buffer> {
	const absolute = await assertRegularRepositoryFile(workspaceRoot, repositoryPath);
	const handle = await open(absolute, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW);
	try {
		const metadata = await handle.stat();
		if (!metadata.isFile()) {
			throw new Error(`Equipment repository read requires a regular file: ${repositoryPath}`);
		}
		return await handle.readFile();
	} finally {
		await handle.close();
	}
}

export async function readEquipmentRepositoryJson(
	workspaceRoot: string,
	repositoryPath: string
): Promise<unknown> {
	const bytes = await readEquipmentRepositoryFile(workspaceRoot, repositoryPath);
	try {
		return JSON.parse(bytes.toString('utf8')) as unknown;
	} catch (error) {
		throw new Error(`Invalid JSON in Equipment repository file: ${repositoryPath}`, {
			cause: error
		});
	}
}

export async function ensureEquipmentRepositoryParentDirectories(
	workspaceRoot: string,
	repositoryPath: string
): Promise<void> {
	const components = repositoryPathComponents(repositoryPath).slice(0, -1);
	let cursor = await assertRealWorkspaceRoot(workspaceRoot);
	for (const component of components) {
		cursor = path.join(cursor, component);
		let metadata = await lstat(cursor).catch((error: NodeJS.ErrnoException) => {
			if (error.code === 'ENOENT') return null;
			throw error;
		});
		if (metadata === null) {
			try {
				await mkdir(cursor);
			} catch (error) {
				if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
			}
			metadata = await lstat(cursor);
		}
		if (metadata.isSymbolicLink()) throw symbolicLinkError(repositoryPath);
		if (!metadata.isDirectory()) {
			throw new Error(`Equipment repository ancestor is not a directory: ${repositoryPath}`);
		}
	}
}

async function pathMatchesIdentity(absolutePath: string, identity: FileIdentity): Promise<boolean> {
	try {
		const metadata = await lstat(absolutePath);
		return metadata.dev === identity.device && metadata.ino === identity.inode;
	} catch {
		return false;
	}
}

export async function exclusiveCreateEquipmentRepositoryFile(
	workspaceRoot: string,
	repositoryPath: string,
	contents: string | Uint8Array
): Promise<void> {
	await ensureEquipmentRepositoryParentDirectories(workspaceRoot, repositoryPath);
	const absolute = equipmentRepositoryAbsolute(workspaceRoot, repositoryPath);
	let handle;
	let identity: FileIdentity | undefined;
	try {
		handle = await open(
			absolute,
			fsConstants.O_WRONLY | fsConstants.O_CREAT | fsConstants.O_EXCL | fsConstants.O_NOFOLLOW
		);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
			throw new Error(`Exclusive-create collision: ${repositoryPath}`, { cause: error });
		}
		throw error;
	}
	try {
		const metadata = await handle.stat();
		if (!metadata.isFile()) {
			throw new Error(`Exclusive Equipment output is not a regular file: ${repositoryPath}`);
		}
		identity = { device: metadata.dev, inode: metadata.ino };
		await handle.writeFile(contents);
		await handle.sync();
		await handle.close();
		handle = undefined;
	} catch (error) {
		await handle?.close().catch(() => undefined);
		if (identity !== undefined && (await pathMatchesIdentity(absolute, identity))) {
			await unlink(absolute).catch(() => undefined);
		}
		throw error;
	}
}
