import { exec } from 'child_process';
import fs from 'fs';
import { customAlphabet } from 'nanoid';
import path from 'path';
import { DATA_DIR } from './repos';

export const randomName = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 10);

export const execAsync = async (command: string): Promise<number> => {
    return new Promise((resolve, reject) => {
        exec(command, (error, stdout, stderr) => {
            if (error) reject(new Error(`command exited with code ${error.code}`));
            else resolve(0);
        })
    });
}

export const getClocData = async (repo: string, codePath: string, slice: string): Promise<any> => {
    if (!codePath)
        return null;

    if (!fs.existsSync(path.join(DATA_DIR, 'cloc'))) {
        fs.mkdirSync(path.join(DATA_DIR, 'cloc'), { recursive: true });
    }

    const fileName = path.join(DATA_DIR, 'cloc', `${repo.split('/').join('-')}-${slice}.json`);

    if (fs.existsSync(fileName)) {
        fs.unlinkSync(fileName);
    }

    const r = await execAsync(`cloc --json --report-file=${fileName} --quiet ${codePath}`);

    if (r !== 0) {
        throw new Error(`cloc didn't finish successfully ${codePath}`);
    }

    const data = JSON.parse(fs.readFileSync(fileName, { encoding: "utf8" }));
    delete data.header;

    return data;
}