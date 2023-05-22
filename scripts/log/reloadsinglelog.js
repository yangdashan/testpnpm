const gitToken = 'f07c4b105fd0eaa548ea72b9ef84c079a5162fb5';
const owner = 'lcap';
const repo = 'change-sets';
const changeMainBranch = 'v5'

const concatCommitsLogs = async () => {
    try {
        const packageJson = require('../package.json');
        const curVersion = packageJson.version;
        if (!curVersion) {
            console.error('获取当前版本号失败！');
            return;
        }
        const fetch = await import('node-fetch');
        const { default: moment } = await import('moment');
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
                if (tagVersion && semver.gt(curVersion, tagVersion) && semver.major(curVersion) === semver.major(tagVersion)) {
                    previousTag = tag;
                    break;
                }
            }
        }
        if (!previousTag) {
            // 未获取到上一次tag的情况 即视为第一次发布, 不做commits信息收集；
            console.warn('未获取到上一次tag，视为初始版本');
            return;
        }
        // 获取上一个版本的发布时间 ，并且获取这段时间所有commit的内容
        const startMoment = moment(previousTag.commit.created);
        const data = await fetch.default(`https://git-nj.iwhalecloud.com/api/v1/repos/${owner}/${repo}/commits?limit=100000&sha=${changeMainBranch}`, {
            method: 'get',
            headers: { Authorization: `token ${gitToken}` },
        });
        const commitsRes = (await data.json()) || [];
        // 删选符合时间范围的commits（查询到的commits 数据都是已经排过序的）
        const filterCommits = [];
        for (let i = 0, k = commitsRes.length; i < k; i++) {
            if (startMoment.isBefore(new moment(commitsRes[i].created))) {
                filterCommits.push(commitsRes[i]);
            } else {
                // 数据本来就是排过序的 ，如果出现一个不符合条件的数据，那么后面的数据都不需要考虑
                break;
            }
        }
        const commits = [];
        filterCommits.forEach(commitInfo => {
            if (commitInfo && commitInfo.commit.message) {
                commits.push(`- ${commitInfo.commit.message}`)
            }
        });
        return commits.join('');
    } catch (e) {
        console.warn('checkTokenIsValid error: ', e);
    }
};

const updateChangelog = async () => {
    // commit2
    // commit3
    try {
        // 读取CHANGELOG.md文件的
        const fs = await import('fs');

        const changelog = fs.readFileSync('CHANGELOG.md', 'utf-8');

        const regex = /## [\d.]+\n\n([\s\S]*?)(?=\n\n## [\d.]+|\n*$)/g;
        const changelogCount = (changelog.match(regex) || []).length;

        if (changelogCount === 0) {
            console.warn('CHANGELOG.md 中未找到有效条目');
            return;
        }
        let description;
        if (changelogCount > 1) {
            // 使用正则表达式找到第一条记录的描述
            const regex1 = /## [\d.]+\n\n### [\w ]+\n\n- ([\s\S]*?)\n\n## /;
            const match = changelog.match(regex1);
            description = match[1];
        } else {
            const regex2 = /## [\d.]+\n\n### [\w ]+\n\n- (.*)/;
            const match = changelog.match(regex2);
            description = match ? match[1] : null;
        }

        // 将描述从原始内容中替换为新描述
        const newDescription = await concatCommitsLogs();
        if (newDescription) {
            const newChangelog = changelog.replace(description, `${description}\n${newDescription}`);
            // 将更改写回CHANGELOG.md文件
            await fs.promises.writeFile('CHANGELOG.md', newChangelog);
            console.log('Changelog updated successfully!');
        }
    } catch (error) {
        console.error('Error updating changelog:', error);
    }
};

// 在异步函数中调用updateChangelog函数
(async () => {
    await updateChangelog();
})();
