`github-count-loc` A simple tool to pull various public repos and get stats such as the total number of contributors and count lines of code (LoC) using [clock](https://github.com/AlDanial/cloc) tool

# Quickstart
1. Clone this repository
2. Run `npm i` or `yarn` to install dependencies
3. Copy `repos-sample.json` to `repos.json` and edit as required (see below)
4. Create a `.env` file and place yor Github API key there (see below)
5. Run `npm run dev` or `yarn dev` to launch the tool

# Dependencies
The tool uses `git` and [`clock`](https://github.com/AlDanial/cloc). Make sure that both tools are installed on your machine and are invokable from command line. 

# Making `.env` file
The app will read github API key from `.env` file placed in the repository root folder. To obtain the key follow [this guide](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token).

Once the key is ready add the following line to your `.env` file:
```
GITHUB_API_KEY=XXXXXXXXXXX
```
Note: Replace `XXXXXXXXXXX` with your actual API key.

# Editing `repos.json`
`repos.json` is the main job list for the tool. It contains the list of github repositories the tool will download and extact stats from. 

The contents of the file is a JSON array of objects where each object has the following structure:
```json
    {
        "repo": "microsoft/typescript",
        "tags": [
            "typescript",
            "javascript",
            "build-tools",
            "microsoft",
            "cross-platform"
        ],
        "slices": {
            "main": {
                "include": [
                    "src/**/*.*"
                ],
                "exclude": []
            },
            "tools": {
                "include": [
                    "tests/**/*.*"
                ],
                "exclude": []
            }
        }
    }
```
# Output
All program output is stored in `data` directory that will be created automatically in the current working directory.

The `data` directory has the following structure (after program has finished successfully):

```
data/
├── cloc/
│   ├── <repo-owner>-<repo-name>.json
│   ├── ...
├── code/
│   ├── <repo-owner>/
│   │   ├── <repo-name>/
│   │   │   ├── <...>
├── extract/
│   ├── <repo-owner>/
│   │   ├── <repo-name>/
│   │   │   ├── <slice-name>/
│   │   │   │   ├── <random-folder-1>
│   │   │   │   │   ├── <...>
│   │   │   │   ├── <random-folder-N>
│   │   │   │   │   ├── <...>
├── app.log
├── stats.json
```

The contents of the `data` directory has the following purpose
1. `cloc` directory has all raw `cloc` output for each slice of each repository. All output is stored as separate json files for each slice.
2. `code` directory has all original repositories. The repos are pulled using `git` and stored in subfulders arranged by repository owners and repository names. 
3. `extract` folder is where files for each slice are stored. If you are `cloc`ing the whole repo this will effectivey include the complete copy of the repo. Not very efficient storage and performance wise but reliable :)
4. `app.log` application log that is being appended every time. May have some useful information especially for troubleshooting.
5. `stats.json` the ultimate final output. A single JSON file that has all stats for all repos arranged in one place.

**Notes:**
1. The tool will use `git clone` if there's no repository folder yet in `data/code/`. It will use `git pull` otherwise to fetch the fresh code and save time/bandwidth. There may be issues with `git pull` if a repo folder broken for some reason. If you run in a problem like this, delete the repository folder completely from `data/code/` and start over.
2. `extract` folders are large and are only required during `cloc`ing. They are temporary but are not deleted automatically in case you might want to examine their content. A directory with files for each slice will be purged **before** every run in case it exists so double `cloc`ing is not possible.
3. `stats.json` is purged every time the tool starts and is being updated as long as there is any new data. Even if he program will crash along the way, `stats.json` will have everything that was done until it has crashed.
4. Apart from `cloc` data for lines of code the `stats.json` will also include basic repo stats from github such as repository creation date, number of stars, total number of contributors, etc.

## Example output 
The final `stats.json` output for a single repo looks somewhat similar to this

```json
{
  "microsoft/typescript": {
    "tags": [
      "typescript",
      "javascript",
      "build-tools",
      "microsoft",
      "cross-platform"
    ],
    "created_at": "2014-06-17T15:28:39Z",
    "updated_at": "2021-12-23T08:29:54Z",
    "pushed_at": "2021-12-23T06:57:16Z",
    "stargazers_count": 76796,
    "language": "TypeScript",
    "topics": [
      "javascript",
      "language",
      "typechecker",
      "typescript"
    ],
    "contributors": 678,
    "cloc": {
      "main": {
        "TypeScript": {
          "nFiles": 511,
          "blank": 33004,
          "comment": 43251,
          "code": 257294
        },
        "XML": {
          "nFiles": 13,
          "blank": 0,
          "comment": 0,
          "code": 213742
        },
        "JSON": {
          "nFiles": 32,
          "blank": 44,
          "comment": 0,
          "code": 8716
        },
        "Markdown": {
          "nFiles": 2,
          "blank": 22,
          "comment": 0,
          "code": 37
        },
        "SUM": {
          "blank": 33070,
          "comment": 43251,
          "code": 479789,
          "nFiles": 558
        }
      },
      "tools": {
        "JavaScript": {
          "nFiles": 11648,
          "blank": 85513,
          "comment": 73123,
          "code": 822974
        },
        "TypeScript": {
          "nFiles": 16297,
          "blank": 57528,
          "comment": 691498,
          "code": 317975
        },
        "JSON": {
          "nFiles": 1142,
          "blank": 68,
          "comment": 0,
          "code": 21919
        },
        "Markdown": {
          "nFiles": 1,
          "blank": 5,
          "comment": 0,
          "code": 16
        },
        "SUM": {
          "blank": 143114,
          "comment": 764621,
          "code": 1162884,
          "nFiles": 29088
        }
      }
    }
  }
}
```

## Major parameters
1. `repo` is the name of the repository in the `{owner}/{repo}` format.
2. `tags` is an array of tags assigned to each repo. These tags will be transferred to the resulting `stats.json` to assist in further data analysis.
3. `slices` is an object that defines settings for splitting a repo into one or several slices and analyse them separately. Slices are discussed in more detail below.

## Slices
Code repositories are very different. Sometimes you want to `cloc` all code files in a repo. Other times you might want to only select a part of it. There are cases of large monorepos where different project share a single repository. In such cases you might want to `cloc` them separately. 

This is what slices are for. Each slice is a set of [glob](https://github.com/isaacs/node-glob) patterns that define which repository files to include and which to exclude. 

The `slices` property in repository configuration is an object where each key is a name of this slice (this name will be taken to the result stats file and cloc stats will be attached to this slice name). Each slice data follows the pattern:

```json
"<slice-name>": {
    "include": ["<glob-1>", "<glob-2>", "..."],
    "exclude": ["<glob-1>", "<glob-2>", "..."]
}
```

- `include` specifies which files to include from the whole repository for this slice. It may contain one to many valid glob patterns.
- `exclude` specifies which files to exclude. It may contain 0 to many valid glob patterns.

**IMPORTANT**: the tool will only pick _**files**_ that match the specified glob patterns and will skip folders. Make sure that all glob patterns you provide are for files. If a patter you entered effectivily works for folders only then it won't make any effect on the final selection of files to cloc.

### Slice examples

**Use the complete repository**

The simplest example where you don't need to select specific files but rather cloc the complete repo
```json
"<main>": {
    "include": ["**/*.*"],
    "exclude": []
}
```
The pattern `"**/*.*"` is used here instead of `"**"` to slighly reduce a final total number of files. `cloc` will only deal with files that have extension so any other file is not relevant anyway.

**Count `src` and `tests` separately**

```json
"<main>": {
    "include": ["src/**/*.*"],
    "exclude": []
},
"<tests>": {
    "include": ["test/**/*.*"],
    "exclude": []
}
```

**Count the whole repo but exclude `docs` folder**
```json
"<main>": {
    "include": ["**/*.*"],
    "exclude": ["docs/**"]
}
```

## Slicing workflow
For each slice of each repository the tool will follow this workflow to select files that will be `cloc`'ed.

1. Make a union of all files (no duplicates) in the repo that match all glob patterns given in the `include` clause.
2. Make a union of all files (no duplicates) in the repo that match all glob patterns given in the `exclude` clause.
3. Remove all excluded files from the list of files that are included.
4. Copy all files from the target selection to a separate directory under `./data/extract/`. If there are more than 1000 files then files will be arranged in separate folders each having 1000 files.

It is important to remeber that the tool will physically copy all matching files to a separate directory before running `cloc`. In large repositories this may be long and I/O intensive operation (priovided that we're dealing with code which normally has lots of small files). It will also require sufficient free storage space.

# LICENSE

MIT License.

Copyright 2021 Peter Rogov 

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.