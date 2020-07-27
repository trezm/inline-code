const fancyCode = require("../src/index.js");
const markdown = require("./example.md");
const el = document.getElementById("content");

const page = new fancyCode.FC(el);
page.parse(markdown);
