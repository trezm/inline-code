require("./index.scss");

const marked = require("marked");
const diff = require("diff");
const hltr = require("highlight.js");

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
class FC {
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

    const nodeIterator = document.createNodeIterator(
      this.markdown,
      NodeFilter.SHOW_COMMENT
    );

    let commentNode = nodeIterator.nextNode();
    const fileIds = [];
    while (commentNode) {
      const split = commentNode.textContent.split(":");

      if (split[0].trim() === "- file") {
        const id = split[1].trim();
        fileIds.push(id);
      }

      commentNode = nodeIterator.nextNode();
    }


    const preBlocks = Array.from(this.markdown.getElementsByTagName("pre"));

    this.codeBlockMap = {};
    preBlocks.forEach((preBlock, index) => {
      const marker = document.createElement("div");
      const codeBlock = preBlock.getElementsByTagName("code")[0];
      console.log('index:', index);
      console.log('fileIds[index]', fileIds[index]);
      const blockIdentifier = fileIds[index];
      // const blockIdentifier = codeBlock.className.replace("language-", "");

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

    return content.split("\n");
  }

  /**
   * Generates DOM elements for the code blocks stored in
   * this.codeBlockMap. Also stores the output in
   * this.codeBlockElMap.
   */
  _generateDomForCode() {
    this.codeBlockElMap = {};
    for (const blockName in this.codeBlockMap) {
      const blocks = this.codeBlockMap[blockName];
      const blockElements = [];
      blockElements.push(this._generateSingleForCode(blocks[0]));

      for (let i = 1; i < blocks.length; i++) {
        const block = blocks[i];
        const lastBlock = blocks[i - 1];

        blockElements.push(this._generateDiffsForCode(lastBlock, block));
      }

      // TODO(trezm): Figure out what to do with overlapping code changes

      // Wrap each set of code block lines in a pre tag and add them
      // to the preBlockElements array
      const preBlockElements = blockElements.map((els) => {
        const pre = document.createElement("pre");
        pre.setAttribute("data-before", blockName);
        const code = document.createElement("code");
        const lineNumbersContainer = document.createElement("div");
        lineNumbersContainer.classList.add("__ic_line_numbers");
        const lineNumbers = [];
        let i = 1;
        els.forEach((el) => {
          code.appendChild(el);

          const lineNumber = document.createElement("div");
          lineNumber.className = "__ic_line_number";
          if (el.classList.contains("__ic_removed")) {
            lineNumber.classList.add("__ic_removed");
          } else if (el.classList.contains("__ic_added")) {
            lineNumber.innerHTML = `${i}: `;
            i++;
          } else {
            lineNumber.innerHTML = `${i}: `;
            i++;
          }
          lineNumbers.push(lineNumber);

          lineNumbersContainer.appendChild(lineNumber);
        });

        let shouldBeCollapsed = (index) => {
          const beforeLine = els[index - 1];
          const afterLine = els[index + 1];

          return (
            els[index].classList.contains("__ic_same") &&
            (!beforeLine ||
              !(
                beforeLine.classList.contains("__ic_removed") ||
                beforeLine.classList.contains("__ic_added")
              )) &&
            (!afterLine ||
              !(
                afterLine.classList.contains("__ic_removed") ||
                afterLine.classList.contains("__ic_added")
              ))
          );
        };
        for (let i = 0; i < els.length; i++) {
          if (shouldBeCollapsed(i)) {
            els[i].classList.add("__ic_collapsed");
            lineNumbers[i].classList.add("__ic_collapsed");
          }
        }

        pre.appendChild(lineNumbersContainer);
        pre.appendChild(code);
        pre.addEventListener("click", (e) => {
          pre.classList.toggle("__ic_uncollapsed");
        });

        pre.classList.add(blockName.split(".").pop());
        hltr.highlightBlock(code);

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

      let split = value.split("\n");

      if (result.added) {
        split.forEach((line) => {
          const el = document.createElement("div");
          el.className = "__ic_line __ic_added";
          el.innerHTML = line;
          elements.push(el);
          lineNumber++;
          i++;
        });
      } else if (result.removed) {
        split.forEach((line) => {
          const el = document.createElement("div");
          el.className = "__ic_line __ic_removed";
          el.innerHTML = line;
          elements.push(el);
          i++;
        });
      } else {
        split.forEach((line) => {
          const el = document.createElement("div");
          el.className = "__ic_line __ic_same";
          el.innerHTML = line;
          elements.push(el);
          lineNumber++;
          i++;
        });
      }
    });

    return elements;
  }

  _updateVerticalPositionsForCodeBlocks() {
    for (const blockName in this.codeBlockElMap) {
      const blocks = this.codeBlockElMap[blockName];

      for (let i = 0; i < blocks.length; i++) {
        const block = blocks[i];
        const marker = this.markdown.getElementsByClassName(
          `__bid_${blockName}_${i}`
        )[0];

        block.style.position = "absolute";
        block.style.top = marker.offsetTop - block.clientHeight / 2;
        // Set an extra prop on the block so that we can check if
        // it is currently visible or not.
        block.isVisible = false;
      }
    }
  }

  _scroll(e) {
    const midPoint = window.scrollY + window.innerHeight / 2;

    for (const blockName in this.codeBlockElMap) {
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
      for (const line of block.getElementsByTagName("div")) {
        line.style[property] = val;
      }
    } else {
      for (const line of block.getElementsByTagName("div")) {
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
          // line.style.opacity = 0.5;
        }
      }
    }
  }
}

module.exports = {
  FC,
};
