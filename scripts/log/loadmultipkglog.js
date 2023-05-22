const gitToken = 'f07c4b105fd0eaa548ea72b9ef84c079a5162fb5';
const owner = 'lcap';
const repo = 'FishX';
const changeMainBranch = 'v5'

// const getRemoteCommits = async () => {
//     try {
//         const packageJson = require('../package.json');
//         const curVersion = packageJson.version;
//         if (!curVersion) {
//             console.error('获取当前版本号失败！');
//             return;
//         }
//         const fetch = await import('node-fetch');
//         const { default: moment } = await import('moment');
//         const semver = await import('semver');

//         const tags = await fetch.default(`https://git-nj.iwhalecloud.com/api/v1/repos/${owner}/${repo}/tags?limit=100000`, {
//             method: 'get',
//             headers: { Authorization: `token ${gitToken}` },
//         });
//         let previousTag;
//         const tagsRes = (await tags.json()) || [];
//         // 返回值已经排序过这里暂时不用排序
//         // 找一条最新的并且跟当前分支的 版本号大版本是一致的
//         // 获取当前
//         for (let i = 0; i < tagsRes.length; i++) {
//             const tag = tagsRes[i];
//             if (tag.name) {
//                 const tagVersion = semver.clean(tag.name); // '  =v1.2.3   ' =>  '1.2.3';
//                 if (tagVersion && semver.gt(curVersion, tagVersion) && semver.major(curVersion) === semver.major(tagVersion)) {
//                     previousTag = tag;
//                     break;
//                 }
//             }
//         }
//         if (!previousTag) {
//             // 未获取到上一次tag的情况 即视为第一次发布, 不做commits信息收集；
//             console.warn('未获取到上一次tag，视为初始版本');
//             return;
//         }
//         // 获取上一个版本的发布时间 ，并且获取这段时间所有commit的内容
//         const startMoment = moment(previousTag.commit.created);
//         const data = await fetch.default(`https://git-nj.iwhalecloud.com/api/v1/repos/${owner}/${repo}/commits?limit=100000&sha=${changeMainBranch}`, {
//             method: 'get',
//             headers: { Authorization: `token ${gitToken}` },
//         });
//         const commitsRes = (await data.json()) || [];
//         // 删选符合时间范围的commits（查询到的commits 数据都是已经排过序的）
//         const filterCommits = [];
//         for (let i = 0, k = commitsRes.length; i < k; i++) {
//             if (startMoment.isBefore(new moment(commitsRes[i].created))) {
//                 filterCommits.push(commitsRes[i]);
//             } else {
//                 // 数据本来就是排过序的 ，如果出现一个不符合条件的数据，那么后面的数据都不需要考虑
//                 break;
//             }
//         }
//         return filterCommits;
//     } catch (e) {
//         console.warn('checkTokenIsValid error: ', e);
//         return [];
//     }
// }
const updateRootVersion = async (newVersion) => {
    const fs = await import('fs');
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    packageJson.version = newVersion; // 替换为你想要设置的版本号
    fs.writeFileSync('package.json', JSON.stringify(packageJson, null, 2));
    return newVersion;
}
const getLastestTagDate = async () => {
    try {
        const fs = await import('fs');
        const packageJson = require('../../package.json');
        // 判断当前是否是预发布模式
        let preJson;
        const preJsonDir = '../../.changeset/pre.json';
        if (fs.existsSync('.changeset/pre.json')) {
            console.log(preJsonDir);
            preJson = require(preJsonDir);
        }

        let curVersion = packageJson.version;
        if (!curVersion) {
            console.error('获取当前版本号失败！');
            return;
        }
        const fetch = await import('node-fetch');
        const semver = await import('semver');

        const tags = await fetch.default(`https://git-nj.iwhalecloud.com/api/v1/repos/${owner}/${repo}/tags?limit=100000`, {
            method: 'get',
            headers: { Authorization: `token ${gitToken}` },
        });
        let previousTag;
        const tagsRes = (await tags.json()) || [];
        // 返回值已经排序过这里暂时不用排序
        // 找一条最新的并且跟当前分支的 版本号大版本是一致的
        // 获取当前
        for (let i = 0; i < tagsRes.length; i++) {
            const tag = tagsRes[i];
            if (tag.name) {
                const tagVersion = semver.clean(tag.name); // '  =v1.2.3   ' =>  '1.2.3';

                // 更新更目录的 version
                if (semver.eq(curVersion, tagVersion)) {
                    // 如果当前版本和 最新的tag 版本一致 则需要更新当前根目录下的 package json 版本号：默认 patch 级别
                    // 判断此时是否是预发布版本模式 直接判断当前 pre.json 配置文件
                    if (!preJson || preJson.mode == 'exit') {
                        curVersion = await updateRootVersion(semver.inc(curVersion, 'patch'));
                    } else {
                        // pre 模式下  默认走 prerelease 而不是 prepatch
                        curVersion = await updateRootVersion(semver.inc(curVersion, 'prerelease', preJson.tag));
                    }
                }

                if (semver.major(curVersion) === semver.major(tagVersion)) {
                    if (semver.prerelease(tagVersion) && semver.prerelease(tagVersion).length > 0) {
                        // 当前版本也是预发布版本 则取两个预发布版本之间的commits
                        // 当前版本是正式版本 上一版本如果是预发布版本则跳过继续向下搜索
                        if (!semver.prerelease(curVersion) || semver.prerelease(curVersion).length === 0) {
                            continue;
                        }
                    }
                    if (tagVersion && semver.gt(curVersion, tagVersion)) {
                        previousTag = tag;
                    }
                    break;
                }

            }
        }
        if (!previousTag) {
            return null;
        }
        return previousTag.commit.created;
    } catch (e) {
        console.warn('checkTokenIsValid error: ', e);
        return null;
    }
}

const getLocalCommitsByStartDate = async (startDate) => {
    const { default: moment } = await import('moment');
    const formatString = 'ddd MMM DD HH:mm:ss YYYY ZZ';

    const sDate = moment(startDate);
    // const sDate = moment('Tue May 16 01:42:50 2023 +0800', formatString);
    const { execSync } = await import('child_process');
    const commitList = execSync('git log --pretty=format:"%H,%an,%ad,%s"').toString().split('\n');
    const commitObjectList = [];

    for (let i = 0; i < commitList.length; i++) {
        const commit = commitList[i];
        if (commit) {
            const commitInfo = commit.split(',');
            const date = commitInfo[2];
            if (sDate.isBefore(moment(date, formatString))) {
                const commitId = commitInfo[0];
                const author = commitInfo[1];
                const commitMessage = commitInfo[3];
                commitObjectList.push({
                    commitId,
                    author,
                    date,
                    commitMessage,
                });
            } else {
                break;
            }

        }
    }
    commitObjectList.forEach(short => {
        const { commitId } = short;
        const files = execSync(`git diff-tree --no-commit-id --name-only -r ${commitId}`).toString().split('\n').filter(file => file !== '');
        short.changedFiles = files;
    });
    console.log(commitObjectList);
    return commitObjectList;
}

// 检索所有等待发包的（有 changelog变动 的子包）
const { execSync } = require('child_process');

const getWillPublishPkgs = () => {
    const allChangeFiles = [];
    // 所有改动的文件
    const changes1 = execSync('git diff --name-status --diff-filter=AM').toString().split('\n').filter(Boolean).map(line => {
        const [type, path] = line.split('\t');
        const fileName = path.split('/').pop();
        if (fileName === 'CHANGELOG.md') {
            const dir = path.split('/').slice(0, -1).join('/');
            return { dir, type, filename: fileName };
        }
    }).filter(Boolean);
    allChangeFiles.push(...(changes1 || []));
    console.log(allChangeFiles);

    // 所有未追踪（新增）的文件
    const changes2 = execSync('git ls-files --others --exclude-standard').toString().split('\n').filter(Boolean).map(path => {
        const fileName = path.split('/').pop();
        if (fileName === 'CHANGELOG.md') {
            const dir = path.split('/').slice(0, -1).join('/');
            return { dir, type: 'A', filename: fileName };
        }
    }).filter(Boolean);
    allChangeFiles.push(...(changes2 || []));
    console.log(allChangeFiles);

    return allChangeFiles;
}


const changelogCollectCommit = async (dir, commits) => {
    if (!commits) {
        return;
    }
    try {
        const fs = await import('fs');

        const changelog = fs.readFileSync(`${dir}/CHANGELOG.md`, 'utf-8');

        const regex = /## ([\d.]+(-[\w.]+)?)\n\n### [\w ]+\n\n- ([\s\S]*?)(?=\n\n## [\d.]+|\n*$)/g;
        const match = regex.exec(changelog);

        if (!match) {
            console.warn('CHANGELOG.md 中未找到有效条目');
            return;
        }

        const version = match[1];
        const description = match[3];

        const lines = description.trim().split('\n');
        lines.push(commits);
        const updatedDescription = lines.join('\n');

        const newChangelog = changelog.replace(description, updatedDescription);

        await fs.promises.writeFile(`${dir}/CHANGELOG.md`, newChangelog);
        console.log('Changelog updated successfully!');
    } catch (error) {
        console.error('Error updating changelog:', error);
    }
};

function extractFeatureFromMessage(commitMessage) {
    // 根据实际需求，提取 commit message 中的 feature 信息
    // 这里假设 feature 信息位于方括号中，如 "[feature-123]"
    const regex = /(\w+):\s*#?\d*\s*(.*)/i;
    const match = commitMessage.match(regex);
    if (match) {
        return match[1];
    }

    return 'Other'; // 如果未提取到 feature 信息，则归类为 "Other" 分类
}


const classifyCommitByFeature = (commitMessageArr) => {
    // to
    const featureMap = {
        feat: '增加新功能',
        fix: '修复 bug',
        docs: '只改动了文档相关的内容',
        style: '不影响代码含义的改动，例如去掉空格、改变缩进、增删分号',
        refactor: '代码重构时使用，既不是新增功能也不是代码的bud修复',
        perf: '提高性能的修改',
        test: '添加或修改测试代码',
        build: '构建工具或者外部依赖包的修改，比如更新依赖包的版本',
        ci: '持续集成的配置文件或者脚本的修改',
        chore: '杂项，其他不需要修改源代码或不需要修改测试代码的修改',
        revert: '撤销某次提交'
    }
    const [featArr, fixArr, docsArr, styleArr, refactorArr, perfArr, testArr, buildArr, ciArr, choreArr, revertArr, otherArr] = [[], [], [], [], [], [], [], [], [], [], [], []];
    (commitMessageArr || []).forEach(commitMessage => {
        const feature = extractFeatureFromMessage(commitMessage);
        switch (feature) {
            case 'feat':
                featArr.push(commitMessage);
                break;
            case 'fix':
                fixArr.push(commitMessage);
                break;
            case 'docs':
                docsArr.push(commitMessage);
                break;
            case 'style':
                styleArr.push(commitMessage);
                break;
            case 'refactor':
                refactorArr.push(commitMessage);
                break;
            case 'perf':
                perfArr.push(commitMessage);
                break;
            case 'test':
                testArr.push(commitMessage);
                break;
            case 'build':
                buildArr.push(commitMessage);
                break;
            case 'ci':
                ciArr.push(commitMessage);
                break;
            case 'chore':
                choreArr.push(commitMessage);
                break;
            case 'revert':
                revertArr.push(commitMessage);
                break;
            case 'other':
                otherArr.push(commitMessage);
                break;
            default:
                break;

        }
    })
    let classityCommits = '';
    classityCommits += featArr.length > 0 ? `feat:\n -${featArr.join(' -')}\n` : '';
    classityCommits += fixArr.length > 0 ? `fix:\n -${fixArr.join(' -')}\n` : '';
    classityCommits += docsArr.length > 0 ? `docs:\n -${docsArr.join(' -')}\n` : '';
    classityCommits += styleArr.length > 0 ? `style:\n -${styleArr.join(' -')}\n` : '';
    classityCommits += refactorArr.length > 0 ? `refactor:\n -${refactorArr.join(' -')}\n` : '';
    classityCommits += perfArr.length > 0 ? `perf:\n -${perfArr.join(' -')}\n` : '';
    classityCommits += testArr.length > 0 ? `test:\n -${testArr.join(' -')}\n` : '';
    classityCommits += buildArr.length > 0 ? `build:\n -${buildArr.join(' -')}\n` : '';
    classityCommits += ciArr.length > 0 ? `ci:\n -${ciArr.join(' -')}\n` : '';
    classityCommits += choreArr.length > 0 ? `chore:\n -${choreArr.join(' -')}\n` : '';
    classityCommits += revertArr.length > 0 ? `revert:\n -${revertArr.join(' -')}\n` : '';
    classityCommits += otherArr.length > 0 ? `other:\n -${otherArr.join(' -')}\n` : '';


    return classityCommits;
}

const loadAllChangeLog = (changedPkgs, commits) => {
    (changedPkgs || []).forEach(changedPkgItem => {
        const { dir } = changedPkgItem;
        const commitMesgArr = [];
        commits.forEach(commit => {
            if (commit.changedFiles && commit.changedFiles.some(changeFile => changeFile.startsWith(dir))) {
                // 本次提交包含了CHANGELOG 的文件夹 收下这次commit
                commitMesgArr.push(`${commit.commitMessage}\n`);
            }
        });
        if (commitMesgArr.length > 0) {
            // changelogCollectCommit(dir, commitMesgArr.join(''));
            changelogCollectCommit(dir, classifyCommitByFeature(commitMesgArr));

        }
    })
}


/*
*步骤1：根据最新的tag 获取上一次大版本相同的tag 发布时间
*步骤2：查询所有 变更|新增 的CHANGELOG.LOG
*步骤3：根据最新的tag发布时间来收集该段时间内的所有commits 信息
*步骤4：对步骤一的数据进行轮询，该段时间内 该子包内文件夹 名称出现在某次commit信息中 那么该子包下的CHANGELOG就将此次commit收集
*/
const updateAllPackChangeLog = async () => {
    // 步骤1
    const lastestTagDate = await getLastestTagDate();
    if (!lastestTagDate) {
        console.warn('未获取最新的tag，自动退出！')
        console.warn('若本次是初始tag，则不需要抓取版本间隙commits 信息。')
        return;
    }
    // 步骤2 { dir, type: 'A', filename: fileName }[]
    const willPublishPkgs = await getWillPublishPkgs();
    if (!willPublishPkgs || willPublishPkgs.length === 0) {
        console.warn('未抓取到有效 CHANGELOG.md，自动退出')
        return;
    }
    // 步骤3：commits：{  commitId, author, date, commitMessage, changedFiles }[]
    const commits = await getLocalCommitsByStartDate(lastestTagDate);
    if (!commits || commits.length === 0) {
        console.warn('未抓取到有效 commit 信息，自动退出')
        return;
    }
    // 步骤4
    loadAllChangeLog(willPublishPkgs, commits);
};

// 在异步函数中调用updateChangelog函数
(async () => {
    await updateAllPackChangeLog();
})();
