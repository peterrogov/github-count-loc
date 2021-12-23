import fs from 'fs';
import path from "path";

export const DATA_DIR = path.join(process.cwd(), "data");
export const REPO_DIR = path.join(DATA_DIR, 'code');
export const EXTRACT_DIR = path.join(DATA_DIR, 'extract');

export type SliceSettings = {
    include: string[];
    exclude: string[];
}

export interface RepoListItem {
    repo: string;
    tags: string[];
    slices: Record<string, SliceSettings | undefined>;
}

const repos: RepoListItem[] = JSON
    .parse(fs.readFileSync('./repos.json', { encoding: "utf8" }))
    .sort((a: RepoListItem, b: RepoListItem) =>
        a.repo.localeCompare(b.repo)
    );

export default repos;