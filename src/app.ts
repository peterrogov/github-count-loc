import { throttling } from '@octokit/plugin-throttling';
import { Octokit } from '@octokit/rest';
import copyFile from 'cp-file';
import dotenv from 'dotenv';
import fs from 'fs';
import glob from 'glob';
import _ from 'lodash';
import path from 'path';
import repos, { DATA_DIR, EXTRACT_DIR, REPO_DIR } from './repos';
import { execAsync, getClocData, randomName } from './util';

dotenv.config();

const STATS_FILE = path.join(DATA_DIR, "stats.json");
const LOG_FILE = path.join(DATA_DIR, "app.log");

const Client = Octokit.plugin(throttling);

const octokit = new Client({
    auth: process.env.GITHUB_API_KEY,
    log: {
        debug: (message) => {/*fs.appendFileSync('app.log', `[${new Date().toISOString()}] [DEBUG] ${message}\n`)*/ },
        info: (message) => { fs.appendFileSync(LOG_FILE, `[${new Date().toISOString()}] [INFO ] ${message}\n`) },
        warn: (message) => { fs.appendFileSync(LOG_FILE, `[${new Date().toISOString()}] [WARN ] ${message}\n`) },
        error: (message) => { fs.appendFileSync(LOG_FILE, `[${new Date().toISOString()}] [ERROR] ${message}\n`) },

    },
    throttle: {
        onRateLimit: (retryAfter: number, options: any) => {
            octokit.log.warn(`Request quota exhausted for request ${options.method} ${options.url}. Retrying after ${retryAfter} seconds!`);
            return true;
        },
        onAbuseLimit: (retryAfter: number, options: any) => {
            octokit.log.warn(`Abuse detected for request ${options.method} ${options.url}. Retrying after ${retryAfter} seconds!`);
            return true;
        }
    }
});

const getAllContributors = async (owner: string, repo: string): Promise<any[]> => {
    let page = 1;
    const data: any[] = [];
    while (true) {
        const response = await octokit.rest.repos.listContributors({ owner, repo, page, anon: "true", per_page: 100 });
        if (response.status !== 200) {
            throw new Error("Failed to fetch contributors");
        }

        if (response.data.length === 0) {
            return data;
        }

        data.push(...response.data);
        page++;
    }
}

const clearStats = () => {
    if (fs.existsSync(STATS_FILE)) {
        fs.unlinkSync(STATS_FILE);
    }
}

const updateRepoStat = (repo: string, stat: string, value: any) => {
    let stats: any = {};

    if (fs.existsSync(STATS_FILE)) {
        stats = JSON.parse(fs.readFileSync(STATS_FILE, { encoding: "utf-8" }));
    }

    _.set(stats, `${repo}.${stat}`, value);
    fs.writeFileSync(STATS_FILE, JSON.stringify(stats, null, 2), { encoding: "utf-8" });
}

const getRepoPath = (repo: string) => path.join(REPO_DIR, repo);

const pullRepository = async (repo: string): Promise<boolean> => {
    const repoPath = getRepoPath(repo);
    if (!fs.existsSync(repoPath)) {
        fs.mkdirSync(repoPath, { recursive: true });
        octokit.log.info(`Create repository directory ${repoPath}`);
        const command = `git clone https://github.com/${repo}.git ${repoPath}`;
        const result = await execAsync(command);
        if (result === 0) {
            octokit.log.info(`Cloned a repository ${repo} to ${repoPath}`);
        } else {
            octokit.log.error(`Failed to clone repo ${repo} to ${repoPath}`);
            return false;
        }
    } else {
        const command = `git -C ${repoPath} pull`;
        const result = await execAsync(command);
        if (result === 0) {
            octokit.log.info(`Pulled repository contents ${repo} to ${repoPath}`);
        } else {
            octokit.log.error(`Failed to pull repository contents ${repo} to ${repoPath}`);
            return false;
        }
    }

    return true;
}

async function main() {
    clearStats();

    if (!fs.existsSync(REPO_DIR)) {
        fs.mkdirSync(REPO_DIR, { recursive: true });
    }

    for (const entry of repos) {
        console.log(`${entry.repo}:`);

        updateRepoStat(entry.repo, "tags", entry.tags);

        const [owner, repo] = entry.repo.split('/');

        const repository = await octokit.request('GET /repos/{owner}/{repo}', {
            owner, repo
        });

        const infoKeys = ['created_at', 'updated_at', 'pushed_at', 'stargazers_count', 'language', 'topics'];
        const repoInfo: any = _.pick(repository.data, infoKeys);

        console.log(`  stars: ${repoInfo.stargazers_count > 1000 ? (repoInfo.stargazers_count / 1000).toFixed(1) + "k" : repoInfo.stargazers_count}`);

        for (const infoKey of infoKeys) {
            if (infoKey in repoInfo) {
                updateRepoStat(entry.repo, infoKey, repoInfo[infoKey]);
            }
        }

        const contribs = await getAllContributors(owner, repo);
        console.log(`  contributors: ${contribs.length}`);
        updateRepoStat(entry.repo, "contributors", contribs.length);

        const pullResult = await pullRepository(entry.repo);
        console.log(`  git clone/pull: ${pullResult ? "OK" : "FAIL"}`);

        const repoPath = getRepoPath(entry.repo);

        try {
            const slices = Object.keys(entry.slices);

            for (const slice of slices) {
                const sliceItems = entry.slices[slice];
                if (!sliceItems) {
                    continue;
                }

                const extractRoot = path.join(EXTRACT_DIR, owner, repo, slice);
                await execAsync(`rm -rf ${extractRoot}`);

                const includeFiles: string[] = [];
                const excludeFiles: string[] = [];

                for (const repoFolder of sliceItems.include) {
                    const matches = glob.sync(repoFolder, {
                        cwd: repoPath,
                        absolute: true
                    });

                    includeFiles.push(...matches.filter(x => !includeFiles.includes(x)));
                }

                for (const repoFolder of sliceItems.exclude) {
                    const matches = glob.sync(repoFolder, {
                        cwd: repoPath,
                        absolute: true
                    });

                    excludeFiles.push(...matches.filter(x => !excludeFiles.includes(x)));
                }

                const targetFiles = _.difference(includeFiles, excludeFiles).filter(x => !fs.statSync(x).isDirectory());

                console.log(`  copy files: ${targetFiles.length}`);

                if (targetFiles.length) {
                    fs.mkdirSync(extractRoot, { recursive: true });

                    let _chunkName = randomName();
                    fs.mkdirSync(path.join(extractRoot, _chunkName), { recursive: true });
                    let _chunkFiles = 0;
                    for (const file of targetFiles) {
                        if (_chunkFiles >= 1000) {
                            _chunkName = randomName();
                            fs.mkdirSync(path.join(extractRoot, _chunkName), { recursive: true });
                            _chunkFiles = 0;
                        }

                        await copyFile(file, path.join(extractRoot, _chunkName, `${randomName()}_${path.basename(file)}`), {
                            overwrite: true
                        });

                        _chunkFiles++;
                    }
                }
                //continue;
                console.log(`  extract ${slice}: OK`);

                const clocResults = await getClocData(entry.repo, extractRoot, slice);
                if (!clocResults) {
                    continue;
                }

                updateRepoStat(entry.repo, `cloc.${slice}`, clocResults);
                console.log(`  count ${slice}: OK`);
            }
        } catch (err: any) {
            octokit.log.error(err.message ?? "Unrecognized error");
            console.log(`  FAIL: ${err.message ?? "Unrecognized error"}`);
            continue;
        } finally {
            console.log();
        }
    }
}

main();