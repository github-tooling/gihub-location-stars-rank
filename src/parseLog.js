const fs = require('fs');
const path = require("path");

const table = require('markdown-table');

const log = fs.readFileSync('log.txt', 'utf-8');
const result = log.split('\n').reduce((parsed, line) => {
  const [user, stars] = line.split(' ');
  parsed.push({user, stars});
  return parsed;
}, []);


const searchResult = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'data', 'CherkasyCherkassy.json')));
const organisations = searchResult.filter(res => res.type === 'Organization');
const onlyUsers = result.filter(res => !organisations.some(org => org.login === res.user));

const preparedResult = onlyUsers.filter(res => res.stars >= 1).sort((a, b) => b.stars - a.stars);
const tableResult = preparedResult.reduce((arrayRes, res, index) => {
  arrayRes.push([index + 1, `https://github.com/${res.user}`, res.stars])
  return arrayRes;
}, [])

const header = [['index', 'user', 'stars']];
const markdownTable = table(header.concat(tableResult));
console.log(markdownTable);
console.log(onlyUsers.length);
