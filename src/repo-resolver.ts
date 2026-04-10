import { findGitNexusRoot } from "./repo-discovery";

type RepoContext = { cwd: string };

export function resolveRepoRoot(ctx: RepoContext, override?: string): string | null {
	if (override !== undefined && override.length > 0) return override;
	return findGitNexusRoot(ctx.cwd);
}
