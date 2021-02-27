const fs = require('fs');
const path = require("path");

const {Octokit} = require("@octokit/rest");
const {throttling} = require("@octokit/plugin-throttling");
const MyOctokit = Octokit.plugin(throttling);

const octokit = new MyOctokit({
  auth: process.env.TOKEN,
  throttle: {
    onRateLimit: (retryAfter, options) => {
      octokit.log.warn(
        `Request quota exhausted for request ${options.method} ${options.url}`
      );

      // Retry twice after hitting a rate limit error, then give up
      if (options.request.retryCount <= 2) {
        console.log(`Retrying after ${retryAfter} seconds!`);
        return true;
      }
    },
    onAbuseLimit: (retryAfter, options) => {
      // does not retry, only logs a warning
      octokit.log.warn(
        `Abuse detected for request ${options.method} ${options.url}`
      );
    },
  },
});


const countStars = (repos) => repos.reduce((stargazersSum, repo) => repo.stargazers_count + stargazersSum, 0);

const sleep = (ms) => {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

const getUniqueListBy = (arr, key) => {
  return [...new Map(arr.map(item => [item[key], item])).values()]
}

const getUserRepos = async (username) => {
  const repos = await octokit.paginate(octokit.repos.listForUser, {username});
  const orgs = await octokit.paginate(octokit.orgs.listForUser, {username});
  const orgsRepos = await Promise.all(orgs.map(async (org) => await octokit.paginate(octokit.repos.listForOrg, {org: org.login})));
  const orgsReposNotForks = orgsRepos.flat().filter(repo => !repo.fork);
  const orgRepoContribResult = await Promise.all(orgsReposNotForks.map(async (repo) => {
    //https://github.com/octokit/plugin-paginate-rest.js/issues/158
    const repoContributors = await octokit.repos.listContributors({
      owner: repo.owner.login,
      repo: repo.name,
      per_page: 100
    });
    if (repoContributors.data) {
      return await repoContributors.data.some(user => user.login === username);
    }
  }));
  const orgRepoContrib = orgsRepos.flat().filter((_v, index) => orgRepoContribResult[index]);
  const allRepos = [...repos, ...orgRepoContrib.flat()];
  return allRepos.sort((a, b) => b.stargazers_count - a.stargazers_count);
}


(async () => {
  const cherkasy = await octokit.paginate(octokit.search.users, {q: 'location:Cherkasy'});
  const cherkassy = await octokit.paginate(octokit.search.users, {q: 'location:Cherkassy'});
  const totalUsers = [...cherkasy, ...cherkassy];
  const unique = getUniqueListBy(totalUsers, 'login')
  fs.writeFileSync('CherkasyCherkassy.json', JSON.stringify(unique, null, 2));
})();


(async () => {
  const logger = fs.createWriteStream('log.txt', {flags: 'a'})
  const users = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'data', 'CherkasyCherkassy.json')));

  const offsetUsers = users.slice(0);
  for (let i = 0; i < offsetUsers.length; i++) {
    const repos = await getUserRepos(offsetUsers[i].login);
    const stars = countStars(repos);
    const repoSorted = repos.sort((a, b) => b.stargazers_count - a.stargazers_count);
    console.log(i);
    fs.writeFileSync(path.resolve(__dirname, 'data', 'users', `${offsetUsers[i].login}.json`), JSON.stringify(repoSorted, null, 2));
    console.log(`${offsetUsers[i].login} ${stars}`);
    logger.write(`${offsetUsers[i].login} ${stars}\n`);
    await sleep(5000);
  }
})();
