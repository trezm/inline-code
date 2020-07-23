# inline-code

Some nice animations for your next coding article.

## Installation

```bash
npm install --save fancy-code
```

## Usage

**NOTE:** This package is not yet published to npm, sorry!

Simply require fancy-code, and then parse some markdown. fancy-code works by looking at the markdown output, taking any pre blocks, and then parsing the associated "language" as a file name. Then it uses these file names to create diffs and animations for different code blocks. It's a little hard to include here, but check out the example for more details.

```js
const fancyCode = require("fancy-code");

const el = document.getElementById("content");

const page = new fancyCode.FC(el);
page.parse(`


`);
```
