const marked = require("marked");
const diff = require("diff");

/**
 * Creates a page and layout that will render and control the
 * presentation of a markdown file. If possible, it will attempt
 * to parse the markdown to shift code to the left and make new pieces
 * appear in the code.
 *
 * @member {HTMLDivElement} code
 * @member {HTMLDivElement} markdown
 * @member {HTMLElement} root
 * @member {Object<string,string[]]>} codeBlockMap A map from __bid_<filename>_<index>
 * to the lines of code in that code block
 * @member {Object<string,HTMLElement[]]>} codeBlockElMap A map from __bid_<filename>_<index>
 * to the actual "pre" dom elements displayed in the code section of the page.
 */
class IC {
  /**
   *
   * @param {HTMLElement} domElement
   */
  constructor(domElement) {
    this.code = document.createElement("div");
    this.code.className = "__ic_code";
    this.markdown = document.createElement("div");
    this.markdown.className = "__ic_markdown";
    domElement.appendChild(this.code);
    domElement.appendChild(this.markdown);
    domElement.classList.add("__ic_container");
    this.root = domElement;
    this.root.style.marginBottom = window.innerHeight / 2;

    document.addEventListener("scroll", this._scroll.bind(this));
  }

  /**
   *
   * @param {String} markdownString
   */
  parse(markdownString) {
    this.markdown.innerHTML = marked(markdownString);
    const preBlocks = Array.from(this.markdown.getElementsByTagName("pre"));

    this.codeBlockMap = {};
    preBlocks.forEach((preBlock) => {
      const marker = document.createElement("div");
      const codeBlock = preBlock.getElementsByTagName("code")[0];
      const blockIdentifier = codeBlock.className.replace("language-", "");

      this.markdown.replaceChild(marker, preBlock);
      const existingCodeBlocksForIdentifier =
        this.codeBlockMap[blockIdentifier] || [];
      marker.className = `marker __bid_${blockIdentifier}_${existingCodeBlocksForIdentifier.length}`;

      const styledCodeBlock = this._addLinesToCodeBlock(codeBlock);
      this.codeBlockMap[
        blockIdentifier
      ] = existingCodeBlocksForIdentifier.concat([styledCodeBlock]);
    });

    this._generateDomForCode();
    this._updateVerticalPositionsForCodeBlocks();
  }

  _addLinesToCodeBlock(codeBlock) {
    const content = codeBlock.innerHTML;

    return content.split("\n").map((line, i) => {
      return `${i + 1}: ${line}`;
    });
  }

  /**
   * Generates DOM elements for the code blocks stored in
   * this.codeBlockMap. Also stores the output in
   * this.codeBlockElMap.
   */
  _generateDomForCode() {
    this.codeBlockElMap = {};
    for (blockName in this.codeBlockMap) {
      const blocks = this.codeBlockMap[blockName];
      const blockElements = [];
      blockElements.push(this._generateSingleForCode(blocks[0]));

      for (let i = 1; i < blocks.length; i++) {
        const block = blocks[i];
        const lastBlock = blocks[i - 1];

        blockElements.push(this._generateDiffsForCode(lastBlock, block));
      }

      // Wrap each set of code block lines in a pre tag and add them
      // to the preBlockElements array
      const preBlockElements = blockElements.map((els) => {
        const pre = document.createElement("pre");
        pre.setAttribute("data-before", blockName);

        els.forEach((el) => {
          pre.appendChild(el);
        });

        // Append the new pre tag to the code section of the DOM
        this.code.appendChild(pre);
        return pre;
      });

      this.codeBlockElMap[blockName] = preBlockElements;
    }
  }

  /**
   * Generates the DOM for elements in a code block without
   * considering the block that came before it. Generally
   * useful for the first code block for a file.
   *
   * @param {string[]} block
   */
  _generateSingleForCode(block) {
    const elements = [];
    block.forEach((line) => {
      const el = document.createElement("div");
      el.className = "__ic_line __ic_added";
      el.innerHTML = line;
      elements.push(el);
    });

    return elements;
  }

  /**
   *
   * @param {string[]} lastBlock
   * @param {string[]} block
   */
  _generateDiffsForCode(lastBlock, block) {
    const lastBlockLines = lastBlock
      .map((line) => line.replace(/^\d:\s/, ""))
      .join("\n");
    const currentBlockLines = block
      .map((line) => line.replace(/^\d:\s/, ""))
      .join("\n");

    const diffResults = diff.diffLines(lastBlockLines, currentBlockLines, {
      newlineIsToken: false,
    });

    let i = 0;
    let lineNumber = 1;
    let elements = [];
    diffResults.forEach((result) => {
      let value = result.value;
      value = value.replace(/\n$/, "");

      split = value.split("\n");

      if (result.added) {
        split.forEach((line) => {
          const el = document.createElement("div");
          el.className = "__ic_line __ic_added";
          el.innerHTML = `${lineNumber}: ${line}`;
          elements.push(el);
          lineNumber++;
          i++;
        });
      } else if (result.removed) {
        split.forEach((line) => {
          const el = document.createElement("div");
          el.className = "__ic_line __ic_removed";
          el.innerHTML = `${lineNumber}: ${line}`;
          elements.push(el);
          i++;
        });
      } else {
        split.forEach((line) => {
          const el = document.createElement("div");
          el.className = "__ic_line __ic_same";
          el.innerHTML = `${lineNumber}: ${line}`;
          elements.push(el);
          lineNumber++;
          i++;
        });
      }
    });

    return elements;
  }

  _updateVerticalPositionsForCodeBlocks() {
    for (blockName in this.codeBlockElMap) {
      const blocks = this.codeBlockElMap[blockName];

      for (let i = 0; i < blocks.length; i++) {
        const block = blocks[i];
        const marker = this.markdown.getElementsByClassName(
          `__bid_${blockName}_${i}`
        )[0];

        block.style.position = "absolute";
        block.style.top = marker.offsetTop;
        // Set an extra prop on the block so that we can check if
        // it is currently visible or not.
        block.isVisible = false;
      }
    }
  }

  _scroll(e) {
    const midPoint = window.scrollY + window.innerHeight / 2;

    for (blockName in this.codeBlockElMap) {
      const blocks = this.codeBlockElMap[blockName];

      for (let i = 0; i < blocks.length; i++) {
        const block = blocks[i];

        this._setOpacityLineByLine(
          block,
          null,
          1,
          0,
          block.offsetTop,
          midPoint
        );
      }
    }
  }

  /**
   *
   * @param {HTMLPreElement} block
   * @param {string} property The property to scroll in/out
   * @param {number} propStart The starting point of the property
   * @param {number} propEnd The end point of the property
   * @param {number} scrollCurrent The current scroll position
   * @param {number} scrollStart At what point should the property start changing (vertical scroll)
   * @param {number} [transitionLength=100] How long should it take for the property to change
   */
  _setOpacityLineByLine(
    block,
    property,
    propStart,
    propEnd,
    scrollCurrent,
    scrollStart,
    transitionLength = 1
  ) {
    let val;
    let percentage = Math.max(
      Math.min((scrollCurrent - scrollStart) / transitionLength, 1),
      0
    );
    if (scrollCurrent < scrollStart) {
      val = propStart;
    } else {
      val = propStart + (propEnd - propStart) * percentage;
    }

    // Consider switching these to CSS transitions rather than incrementally
    // done via javascript.
    if (property) {
      for (line of block.getElementsByTagName("div")) {
        line.style[property] = val;
      }
    } else {
      for (line of block.getElementsByTagName("div")) {
        if (line.classList.contains("__ic_added")) {
          if (percentage === 0) {
            // line.style.height = 16;
            line.style.marginLeft = 0;
            line.style.opacity = 1;
          } else {
            // line.style.height = 0;
            line.style.marginLeft = this.code.clientWidth;
            line.style.opacity = 0;
          }
        } else if (line.classList.contains("__ic_removed")) {
          if (percentage === 1) {
            // line.style.height = 16;
            line.style.marginLeft = 0;
            line.style.opacity = 1;
          } else {
            // line.style.height = 0;
            line.style.marginLeft = -1 * this.code.clientWidth;
            line.style.opacity = 0;
          }
        } else if (line.classList.contains("__ic_same")) {
          line.style.opacity = 0.7;
        }
      }
    }
  }
}

module.exports = {
  IC,
};
