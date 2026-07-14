'use strict';

var xmldom = require('@xmldom/xmldom');
var JSZip = require('jszip');
var getProp = require('lodash.get');
var JSON5 = require('json5');

class InternalError extends Error {
  constructor(message) {
    super(`Internal error: ${message}`);
  }
}

class InternalArgumentMissingError extends InternalError {
  constructor(argName) {
    super(`Argument '${argName}' is missing.`);
    this.argName = argName;
  }
}

class MalformedFileError extends Error {
  constructor(message) {
    super(message);
  }
}

class MaxXmlDepthError extends Error {
  constructor(maxDepth) {
    super(`XML maximum depth reached (max depth: ${maxDepth}).`);
    this.maxDepth = maxDepth;
  }
}

class TemplateSyntaxError extends Error {
  constructor(message) {
    super(message);
  }
}

class MissingCloseDelimiterError extends TemplateSyntaxError {
  constructor(openDelimiterText) {
    super(`Close delimiter is missing from '${openDelimiterText}'.`);
    this.openDelimiterText = openDelimiterText;
  }
}

class MissingStartDelimiterError extends TemplateSyntaxError {
  constructor(closeDelimiterText) {
    super(`Open delimiter is missing from '${closeDelimiterText}'.`);
    this.closeDelimiterText = closeDelimiterText;
  }
}

class TagOptionsParseError extends TemplateSyntaxError {
  constructor(tagRawText, parseError) {
    super(`Failed to parse tag options of '${tagRawText}': ${parseError.message}.`);
    this.tagRawText = tagRawText;
    this.parseError = parseError;
  }
}

class TemplateDataError extends Error {
  constructor(message) {
    super(message);
  }
}

class UnclosedTagError extends TemplateSyntaxError {
  constructor(tagName) {
    super(`Tag '${tagName}' is never closed.`);
    this.tagName = tagName;
  }
}

class UnidentifiedFileTypeError extends Error {
  constructor() {
    super(`The filetype for this file could not be identified, is this file corrupted?`);
  }
}

class UnknownContentTypeError extends TemplateDataError {
  constructor(contentType, tagRawText, path) {
    super(`Content type '${contentType}' does not have a registered plugin to handle it.`);
    this.contentType = contentType;
    this.tagRawText = tagRawText;
    this.path = path;
  }
}

class UnopenedTagError extends TemplateSyntaxError {
  constructor(tagName) {
    super(`Tag '${tagName}' is closed but was never opened.`);
    this.tagName = tagName;
  }
}

class UnsupportedFileTypeError extends Error {
  constructor(fileType) {
    super(`Filetype "${fileType}" is not supported.`);
    this.fileType = fileType;
  }
}

function pushMany(destArray, items) {
  Array.prototype.push.apply(destArray, items);
}
function first(array) {
  if (!array.length) return undefined;
  return array[0];
}
function last(array) {
  if (!array.length) return undefined;
  return array[array.length - 1];
}
function toDictionary(array, keySelector, valueSelector) {
  if (!array.length) return {};
  const res = {};
  array.forEach((item, index) => {
    const key = keySelector(item, index);
    const value = valueSelector ? valueSelector(item, index) : item;
    if (res[key]) throw new Error(`Key '${key}' already exists in the dictionary.`);
    res[key] = value;
  });
  return res;
}

class Base64 {
  static encode(str) {
    // browser
    if (typeof btoa !== 'undefined') return btoa(str);

    // node
    // https://stackoverflow.com/questions/23097928/node-js-btoa-is-not-defined-error#38446960
    return new Buffer(str, 'binary').toString('base64');
  }
}

function inheritsFrom(derived, base) {
  // https://stackoverflow.com/questions/14486110/how-to-check-if-a-javascript-class-inherits-another-without-creating-an-obj
  return derived === base || derived.prototype instanceof base;
}
function isPromiseLike(candidate) {
  return !!candidate && typeof candidate === 'object' && typeof candidate.then === 'function';
}

const Binary = {
  //
  // type detection
  //

  isBlob(binary) {
    return this.isBlobConstructor(binary.constructor);
  },
  isArrayBuffer(binary) {
    return this.isArrayBufferConstructor(binary.constructor);
  },
  isBuffer(binary) {
    return this.isBufferConstructor(binary.constructor);
  },
  isBlobConstructor(binaryType) {
    return typeof Blob !== 'undefined' && inheritsFrom(binaryType, Blob);
  },
  isArrayBufferConstructor(binaryType) {
    return typeof ArrayBuffer !== 'undefined' && inheritsFrom(binaryType, ArrayBuffer);
  },
  isBufferConstructor(binaryType) {
    return typeof Buffer !== 'undefined' && inheritsFrom(binaryType, Buffer);
  },
  //
  // utilities
  //

  toBase64(binary) {
    if (this.isBlob(binary)) {
      return new Promise(resolve => {
        const fileReader = new FileReader();
        fileReader.onload = function () {
          const base64 = Base64.encode(this.result);
          resolve(base64);
        };
        fileReader.readAsBinaryString(binary);
      });
    }
    if (this.isBuffer(binary)) {
      return Promise.resolve(binary.toString('base64'));
    }
    if (this.isArrayBuffer(binary)) {
      // https://stackoverflow.com/questions/9267899/arraybuffer-to-base64-encoded-string#42334410
      const binaryStr = new Uint8Array(binary).reduce((str, byte) => str + String.fromCharCode(byte), '');
      const base64 = Base64.encode(binaryStr);
      return Promise.resolve(base64);
    }
    throw new Error(`Binary type '${binary.constructor.name}' is not supported.`);
  }
};

function isNumber(value) {
  return Number.isFinite(value);
}

class Path {
  static getFilename(path) {
    const lastSlashIndex = path.lastIndexOf('/');
    return path.substring(lastSlashIndex + 1);
  }

  /**
   * Get the directory of a path. 
   * Exclude the last slash.
   * 
   * Example:
   * /folder/subfolder/file.txt -> /folder/subfolder
   */
  static getDirectory(path) {
    const lastSlashIndex = path.lastIndexOf('/');
    return path.substring(0, lastSlashIndex);
  }
  static combine(...parts) {
    const normalizedParts = parts.flatMap(part => part?.split('/')?.map(p => p.trim()).filter(Boolean));

    // Handle . and .. parts
    const resolvedParts = [];
    for (const part of normalizedParts) {
      if (part === '.') {
        continue; // Ignore . parts
      }
      if (part === '..') {
        resolvedParts.pop(); // Go up one directory
        continue;
      }
      resolvedParts.push(part);
    }
    return resolvedParts.join('/');
  }
}

class Regex {
  static escape(str) {
    // https://stackoverflow.com/questions/1144783/how-to-replace-all-occurrences-of-a-string-in-javascript
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); // $& means the whole matched string
  }
}

/**
 * Secure Hash Algorithm (SHA1)
 *
 * Taken from here: http://www.webtoolkit.info/javascript-sha1.html
 *
 * Recommended here: https://stackoverflow.com/questions/6122571/simple-non-secure-hash-function-for-javascript#6122732
 */
function sha1(msg) {
  msg = utf8Encode(msg);
  const msgLength = msg.length;
  let i, j;
  const wordArray = [];
  for (i = 0; i < msgLength - 3; i += 4) {
    j = msg.charCodeAt(i) << 24 | msg.charCodeAt(i + 1) << 16 | msg.charCodeAt(i + 2) << 8 | msg.charCodeAt(i + 3);
    wordArray.push(j);
  }
  switch (msgLength % 4) {
    case 0:
      i = 0x080000000;
      break;
    case 1:
      i = msg.charCodeAt(msgLength - 1) << 24 | 0x0800000;
      break;
    case 2:
      i = msg.charCodeAt(msgLength - 2) << 24 | msg.charCodeAt(msgLength - 1) << 16 | 0x08000;
      break;
    case 3:
      i = msg.charCodeAt(msgLength - 3) << 24 | msg.charCodeAt(msgLength - 2) << 16 | msg.charCodeAt(msgLength - 1) << 8 | 0x80;
      break;
  }
  wordArray.push(i);
  while (wordArray.length % 16 != 14) {
    wordArray.push(0);
  }
  wordArray.push(msgLength >>> 29);
  wordArray.push(msgLength << 3 & 0x0ffffffff);
  const w = new Array(80);
  let H0 = 0x67452301;
  let H1 = 0xEFCDAB89;
  let H2 = 0x98BADCFE;
  let H3 = 0x10325476;
  let H4 = 0xC3D2E1F0;
  let A, B, C, D, E;
  let temp;
  for (let blockStart = 0; blockStart < wordArray.length; blockStart += 16) {
    for (i = 0; i < 16; i++) {
      w[i] = wordArray[blockStart + i];
    }
    for (i = 16; i <= 79; i++) {
      w[i] = rotateLeft(w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16], 1);
    }
    A = H0;
    B = H1;
    C = H2;
    D = H3;
    E = H4;
    for (i = 0; i <= 19; i++) {
      temp = rotateLeft(A, 5) + (B & C | ~B & D) + E + w[i] + 0x5A827999 & 0x0ffffffff;
      E = D;
      D = C;
      C = rotateLeft(B, 30);
      B = A;
      A = temp;
    }
    for (i = 20; i <= 39; i++) {
      temp = rotateLeft(A, 5) + (B ^ C ^ D) + E + w[i] + 0x6ED9EBA1 & 0x0ffffffff;
      E = D;
      D = C;
      C = rotateLeft(B, 30);
      B = A;
      A = temp;
    }
    for (i = 40; i <= 59; i++) {
      temp = rotateLeft(A, 5) + (B & C | B & D | C & D) + E + w[i] + 0x8F1BBCDC & 0x0ffffffff;
      E = D;
      D = C;
      C = rotateLeft(B, 30);
      B = A;
      A = temp;
    }
    for (i = 60; i <= 79; i++) {
      temp = rotateLeft(A, 5) + (B ^ C ^ D) + E + w[i] + 0xCA62C1D6 & 0x0ffffffff;
      E = D;
      D = C;
      C = rotateLeft(B, 30);
      B = A;
      A = temp;
    }
    H0 = H0 + A & 0x0ffffffff;
    H1 = H1 + B & 0x0ffffffff;
    H2 = H2 + C & 0x0ffffffff;
    H3 = H3 + D & 0x0ffffffff;
    H4 = H4 + E & 0x0ffffffff;
  }
  temp = cvtHex(H0) + cvtHex(H1) + cvtHex(H2) + cvtHex(H3) + cvtHex(H4);
  return temp.toLowerCase();
}
function rotateLeft(n, s) {
  const t4 = n << s | n >>> 32 - s;
  return t4;
}
function cvtHex(val) {
  let str = "";
  for (let i = 7; i >= 0; i--) {
    const v = val >>> i * 4 & 0x0f;
    str += v.toString(16);
  }
  return str;
}
function utf8Encode(str) {
  str = str.replace(/\r\n/g, "\n");
  let utfStr = "";
  for (let n = 0; n < str.length; n++) {
    const c = str.charCodeAt(n);
    if (c < 128) {
      utfStr += String.fromCharCode(c);
    } else if (c > 127 && c < 2048) {
      utfStr += String.fromCharCode(c >> 6 | 192);
      utfStr += String.fromCharCode(c & 63 | 128);
    } else {
      utfStr += String.fromCharCode(c >> 12 | 224);
      utfStr += String.fromCharCode(c >> 6 & 63 | 128);
      utfStr += String.fromCharCode(c & 63 | 128);
    }
  }
  return utfStr;
}

// Copied from: https://gist.github.com/thanpolas/244d9a13151caf5a12e42208b6111aa6
// And see: https://unicode-table.com/en/sets/quotation-marks/
const nonStandardDoubleQuotes = ['“',
// U+201c
'”',
// U+201d
'«',
// U+00AB
'»',
// U+00BB
'„',
// U+201E
'“',
// U+201C
'‟',
// U+201F
'”',
// U+201D
'❝',
// U+275D
'❞',
// U+275E
'〝',
// U+301D
'〞',
// U+301E
'〟',
// U+301F
'＂' // U+FF02
];
const standardDoubleQuotes = '"'; // U+0022

const nonStandardDoubleQuotesRegex = new RegExp(nonStandardDoubleQuotes.join('|'), 'g');
function stringValue(val) {
  if (val === null || val === undefined) {
    return '';
  }
  return val.toString();
}
function normalizeDoubleQuotes(text) {
  return text.replace(nonStandardDoubleQuotesRegex, standardDoubleQuotes);
}
function countOccurrences(text, substring) {
  // https://stackoverflow.com/questions/4009756/how-to-count-string-occurrence-in-string
  return (text.match(new RegExp(substring, 'g')) || []).length;
}

const XmlNodeType = Object.freeze({
  Text: "Text",
  General: "General",
  Comment: "Comment"
});
const TEXT_NODE_NAME = '#text'; // see: https://developer.mozilla.org/en-US/docs/Web/API/Node/nodeName
const COMMENT_NODE_NAME = '#comment';

class XmlDepthTracker {
  depth = 0;
  constructor(maxDepth) {
    this.maxDepth = maxDepth;
  }
  increment() {
    this.depth++;
    if (this.depth > this.maxDepth) {
      throw new MaxXmlDepthError(this.maxDepth);
    }
  }
  decrement() {
    this.depth--;
  }
}

class XmlTreeIterator {
  get node() {
    return this._current;
  }
  constructor(initial, maxDepth) {
    if (!initial) {
      throw new InternalError("Initial node is required");
    }
    if (!maxDepth) {
      throw new InternalError("Max depth is required");
    }
    this._current = initial;
    this.depthTracker = new XmlDepthTracker(maxDepth);
  }
  next() {
    if (!this._current) {
      return null;
    }
    this._current = this.findNextNode(this._current);
    return this._current;
  }
  setCurrent(node) {
    this._current = node;
  }
  findNextNode(node) {
    // Children
    if (node.childNodes && node.childNodes.length) {
      this.depthTracker.increment();
      return node.childNodes[0];
    }

    // Siblings
    if (node.nextSibling) return node.nextSibling;

    // Parent sibling
    while (node.parentNode) {
      if (node.parentNode.nextSibling) {
        this.depthTracker.decrement();
        return node.parentNode.nextSibling;
      }

      // Go up
      this.depthTracker.decrement();
      node = node.parentNode;
    }
    return null;
  }
}

class XmlUtils {
  parser = new Parser();
  create = new Create();
  query = new Query$1();
  modify = new Modify$1();
}
class Parser {
  static xmlFileHeader = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';

  /**
   * We always use the DOMParser from 'xmldom', even in the browser since it
   * handles xml namespaces more forgivingly (required mainly by the
   * RawXmlPlugin).
   */
  static parser = new xmldom.DOMParser({
    errorHandler: {
      // Ignore xmldom warnings. They are often incorrect since we are
      // parsing OOXML, not HTML.
      warning: () => {}
    }
  });
  parse(str) {
    const doc = this.domParse(str);
    return xml.create.fromDomNode(doc.documentElement);
  }
  domParse(str) {
    if (str === null || str === undefined) throw new InternalArgumentMissingError("str");
    return Parser.parser.parseFromString(str, "text/xml");
  }

  /**
   * Encode string to make it safe to use inside xml tags.
   *
   * https://stackoverflow.com/questions/7918868/how-to-escape-xml-entities-in-javascript
   */
  encodeValue(str) {
    if (str === null || str === undefined) throw new InternalArgumentMissingError("str");
    if (typeof str !== 'string') throw new TypeError(`Expected a string, got '${str.constructor.name}'.`);
    return str.replace(/[<>&'"]/g, c => {
      switch (c) {
        case '<':
          return '&lt;';
        case '>':
          return '&gt;';
        case '&':
          return '&amp;';
        case '\'':
          return '&apos;';
        case '"':
          return '&quot;';
      }
      return '';
    });
  }
  serializeNode(node, options) {
    return this._serializeNode(node, 0, options);
  }
  serializeFile(xmlNode) {
    return Parser.xmlFileHeader + xml.parser.serializeNode(xmlNode);
  }
  _serializeNode(node, depth, options) {
    if (!node) return '';
    if (xml.query.isTextNode(node)) return xml.parser.encodeValue(node.textContent || '');
    if (xml.query.isCommentNode(node)) {
      return `<!-- ${xml.parser.encodeValue(node.commentContent || '')} -->`;
    }

    // attributes
    let attributes = '';
    if (node.attributes) {
      const attributeNames = Object.keys(node.attributes);
      if (attributeNames.length) {
        attributes = ' ' + attributeNames.map(name => `${name}="${xml.parser.encodeValue(node.attributes[name] || '')}"`).join(' ');
      }
    }

    // open tag
    const hasChildren = (node.childNodes || []).length > 0;
    const suffix = hasChildren ? '' : '/';
    const openTag = `<${node.nodeName}${attributes}${suffix}>`;

    // No children
    if (!hasChildren) {
      return openTag;
    }

    // Close tag
    const closeTag = `</${node.nodeName}>`;

    // Children without indentation
    const indentSize = options?.indent ?? 0;
    if (!indentSize || node.childNodes.every(xml.query.isTextNode)) {
      const childrenXml = node.childNodes.map(child => this._serializeNode(child, depth + 1, options)).join('');
      return openTag + childrenXml + closeTag;
    }

    // Children with indentation
    const childIndent = "\n" + " ".repeat((depth + 1) * indentSize);
    const childrenXml = node.childNodes.map(child => `${childIndent}${this._serializeNode(child, depth + 1, options)}`).join("");
    const closeIndent = "\n" + " ".repeat(depth * indentSize);
    return openTag + childrenXml + closeIndent + closeTag;
  }
}
class Create {
  textNode(text) {
    return {
      nodeType: XmlNodeType.Text,
      nodeName: TEXT_NODE_NAME,
      textContent: text
    };
  }
  generalNode(name, init) {
    const node = {
      nodeType: XmlNodeType.General,
      nodeName: name
    };
    if (init?.attributes) {
      node.attributes = init.attributes;
    }
    if (init?.childNodes) {
      for (const child of init.childNodes) {
        xml.modify.appendChild(node, child);
      }
    }
    return node;
  }
  commentNode(text) {
    return {
      nodeType: XmlNodeType.Comment,
      nodeName: COMMENT_NODE_NAME,
      commentContent: text
    };
  }
  cloneNode(node, deep) {
    if (!node) throw new InternalArgumentMissingError("node");
    if (!deep) {
      const clone = Object.assign({}, node);
      clone.parentNode = null;
      clone.childNodes = node.childNodes ? [] : null;
      clone.nextSibling = null;
      return clone;
    } else {
      const clone = cloneNodeDeep(node);
      clone.parentNode = null;
      return clone;
    }
  }

  /**
   * The conversion is always deep.
   */
  fromDomNode(domNode) {
    let xmlNode;

    // basic properties
    switch (domNode.nodeType) {
      case domNode.TEXT_NODE:
        {
          xmlNode = xml.create.textNode(domNode.textContent);
          break;
        }
      case domNode.COMMENT_NODE:
        {
          xmlNode = xml.create.commentNode(domNode.textContent?.trim());
          break;
        }
      case domNode.ELEMENT_NODE:
        {
          const generalNode = xmlNode = xml.create.generalNode(domNode.nodeName);
          const attributes = domNode.attributes;
          if (attributes) {
            generalNode.attributes = {};
            for (let i = 0; i < attributes.length; i++) {
              const curAttribute = attributes.item(i);
              generalNode.attributes[curAttribute.name] = curAttribute.value;
            }
          }
          break;
        }
      default:
        {
          xmlNode = xml.create.generalNode(domNode.nodeName);
          break;
        }
    }

    // children
    if (domNode.childNodes) {
      xmlNode.childNodes = [];
      let prevChild;
      for (let i = 0; i < domNode.childNodes.length; i++) {
        // clone child
        const domChild = domNode.childNodes.item(i);
        const curChild = xml.create.fromDomNode(domChild);

        // set references
        xmlNode.childNodes.push(curChild);
        curChild.parentNode = xmlNode;
        if (prevChild) {
          prevChild.nextSibling = curChild;
        }
        prevChild = curChild;
      }
    }
    return xmlNode;
  }
}
let Query$1 = class Query {
  isTextNode(node) {
    if (node.nodeType === XmlNodeType.Text || node.nodeName === TEXT_NODE_NAME) {
      if (!(node.nodeType === XmlNodeType.Text && node.nodeName === TEXT_NODE_NAME)) {
        throw new InternalError(`Invalid text node. Type: '${node.nodeType}', Name: '${node.nodeName}'.`);
      }
      return true;
    }
    return false;
  }
  isGeneralNode(node) {
    return node.nodeType === XmlNodeType.General;
  }
  isCommentNode(node) {
    if (node.nodeType === XmlNodeType.Comment || node.nodeName === COMMENT_NODE_NAME) {
      if (!(node.nodeType === XmlNodeType.Comment && node.nodeName === COMMENT_NODE_NAME)) {
        throw new InternalError(`Invalid comment node. Type: '${node.nodeType}', Name: '${node.nodeName}'.`);
      }
      return true;
    }
    return false;
  }

  /**
   * Gets the last direct child text node if it exists. Otherwise creates a
   * new text node, appends it to 'node' and return the newly created text
   * node.
   *
   * The function also makes sure the returned text node has a valid string
   * value.
   */
  lastTextChild(node, createIfMissing = true) {
    if (!node) {
      return null;
    }
    if (xml.query.isTextNode(node)) {
      return node;
    }

    // Existing text nodes
    if (node.childNodes) {
      const allTextNodes = node.childNodes.filter(child => xml.query.isTextNode(child));
      if (allTextNodes.length) {
        const lastTextNode = last(allTextNodes);
        if (!lastTextNode.textContent) lastTextNode.textContent = '';
        return lastTextNode;
      }
    }
    if (!createIfMissing) {
      return null;
    }

    // Create new text node
    const newTextNode = {
      nodeType: XmlNodeType.Text,
      nodeName: TEXT_NODE_NAME,
      textContent: ''
    };
    xml.modify.appendChild(node, newTextNode);
    return newTextNode;
  }
  findParent(node, predicate) {
    while (node) {
      if (predicate(node)) return node;
      node = node.parentNode;
    }
    return null;
  }
  findParentByName(node, nodeName) {
    return xml.query.findParent(node, n => n.nodeName === nodeName);
  }
  findChild(node, predicate) {
    if (!node) return null;
    return (node.childNodes || []).find(child => predicate(child));
  }
  findByPath(root, nodeType, ...path) {
    if (!root) {
      return null;
    }
    let curNode = root;
    for (let i = 0; i < path.length; i++) {
      const curIndex = path[i];
      if (typeof curIndex === 'string') {
        curNode = xml.query.findChild(curNode, n => n.nodeName === curIndex);
      }
      if (typeof curIndex === 'number') {
        const curNodeType = i == path.length - 1 ? nodeType : XmlNodeType.General;
        curNode = curNode.childNodes.filter(c => c.nodeType === curNodeType)[curIndex];
      }
      if (!curNode) {
        return null;
      }
    }
    if (curNode.nodeType !== nodeType) {
      return null;
    }
    return curNode;
  }

  /**
   * Returns all siblings between 'firstNode' and 'lastNode' inclusive.
   */
  siblingsInRange(firstNode, lastNode) {
    if (!firstNode) throw new InternalArgumentMissingError("firstNode");
    if (!lastNode) throw new InternalArgumentMissingError("lastNode");
    const range = [];
    let curNode = firstNode;
    while (curNode && curNode !== lastNode) {
      range.push(curNode);
      curNode = curNode.nextSibling;
    }
    if (!curNode) throw new Error('Nodes are not siblings.');
    range.push(lastNode);
    return range;
  }
  descendants(node, maxDepth, predicate) {
    const result = [];
    const it = new XmlTreeIterator(node, maxDepth);
    while (it.node) {
      if (predicate(it.node)) {
        result.push(it.node);
      }
      it.next();
    }
    return result;
  }
};
let Modify$1 = class Modify {
  /**
   * Insert the node as a new sibling, before the original node.
   *
   * * **Note**: It is more efficient to use the insertChild function if you
   *   already know the relevant index.
   */
  insertBefore(newNode, referenceNode) {
    if (!newNode) throw new InternalArgumentMissingError("newNode");
    if (!referenceNode) throw new InternalArgumentMissingError("referenceNode");
    if (!referenceNode.parentNode) throw new Error(`'referenceNode' has no parent`);
    const childNodes = referenceNode.parentNode.childNodes;
    const beforeNodeIndex = childNodes.indexOf(referenceNode);
    xml.modify.insertChild(referenceNode.parentNode, newNode, beforeNodeIndex);
  }

  /**
   * Insert the node as a new sibling, after the original node.
   *
   * * **Note**: It is more efficient to use the insertChild function if you
   *   already know the relevant index.
   */
  insertAfter(newNode, referenceNode) {
    if (!newNode) throw new InternalArgumentMissingError("newNode");
    if (!referenceNode) throw new InternalArgumentMissingError("referenceNode");
    if (!referenceNode.parentNode) throw new Error(`'referenceNode' has no parent`);
    const childNodes = referenceNode.parentNode.childNodes;
    const referenceNodeIndex = childNodes.indexOf(referenceNode);
    xml.modify.insertChild(referenceNode.parentNode, newNode, referenceNodeIndex + 1);
  }
  insertChild(parent, child, childIndex) {
    if (!parent) throw new InternalArgumentMissingError("parent");
    if (xml.query.isTextNode(parent)) throw new Error('Appending children to text nodes is forbidden');
    if (!child) throw new InternalArgumentMissingError("child");
    if (!parent.childNodes) parent.childNodes = [];

    // revert to append
    if (childIndex === parent.childNodes.length) {
      xml.modify.appendChild(parent, child);
      return;
    }
    if (childIndex > parent.childNodes.length) throw new RangeError(`Child index ${childIndex} is out of range. Parent has only ${parent.childNodes.length} child nodes.`);

    // update references
    child.parentNode = parent;
    const childAfter = parent.childNodes[childIndex];
    child.nextSibling = childAfter;
    if (childIndex > 0) {
      const childBefore = parent.childNodes[childIndex - 1];
      childBefore.nextSibling = child;
    }

    // append
    parent.childNodes.splice(childIndex, 0, child);
  }
  appendChild(parent, child) {
    if (!parent) throw new InternalArgumentMissingError("parent");
    if (xml.query.isTextNode(parent)) throw new Error('Appending children to text nodes is forbidden');
    if (!child) throw new InternalArgumentMissingError("child");
    if (!parent.childNodes) parent.childNodes = [];

    // update references
    if (parent.childNodes.length) {
      const currentLastChild = parent.childNodes[parent.childNodes.length - 1];
      currentLastChild.nextSibling = child;
    }
    child.nextSibling = null;
    child.parentNode = parent;

    // append
    parent.childNodes.push(child);
  }

  /**
   * Removes the node from it's parent.
   *
   * * **Note**: It is more efficient to call removeChild(parent, childIndex).
   */
  remove(node) {
    if (!node) throw new InternalArgumentMissingError("node");
    if (!node.parentNode) throw new Error('Node has no parent');
    xml.modify.removeChild(node.parentNode, node);
  }

  /**
   * Remove a child node from it's parent. Returns the removed child.
   *
   * * **Note:** Prefer calling with explicit index.
   */

  /**
   * Remove a child node from it's parent. Returns the removed child.
   */

  removeChild(parent, childOrIndex) {
    if (!parent) throw new InternalArgumentMissingError("parent");
    if (childOrIndex === null || childOrIndex === undefined) throw new InternalArgumentMissingError("childOrIndex");
    if (!parent.childNodes || !parent.childNodes.length) throw new Error('Parent node has no children');

    // Get child index
    let childIndex;
    if (typeof childOrIndex === 'number') {
      childIndex = childOrIndex;
    } else {
      childIndex = parent.childNodes.indexOf(childOrIndex);
      if (childIndex === -1) throw new Error('Selected child node is not a child of the specified parent');
    }
    if (childIndex >= parent.childNodes.length) throw new RangeError(`Child index ${childIndex} is out of range. Parent has only ${parent.childNodes.length} child nodes.`);

    // Update references
    const child = parent.childNodes[childIndex];
    if (childIndex > 0) {
      const beforeChild = parent.childNodes[childIndex - 1];
      beforeChild.nextSibling = child.nextSibling;
    }
    child.parentNode = null;
    child.nextSibling = null;

    // Remove and return
    return parent.childNodes.splice(childIndex, 1)[0];
  }
  removeChildren(parent, predicate) {
    while (parent.childNodes?.length) {
      const index = parent.childNodes.findIndex(predicate);
      if (index === -1) {
        break;
      }
      xml.modify.removeChild(parent, index);
    }
  }

  /**
   * Remove sibling nodes between 'from' and 'to' excluding both.
   * Return the removed nodes.
   */
  removeSiblings(from, to) {
    if (from === to) return [];
    const removed = [];
    let lastRemoved;
    from = from.nextSibling;
    while (from !== to) {
      const removeMe = from;
      from = from.nextSibling;
      xml.modify.remove(removeMe);
      removed.push(removeMe);
      if (lastRemoved) lastRemoved.nextSibling = removeMe;
      lastRemoved = removeMe;
    }
    return removed;
  }

  /**
   * Split the original node into two sibling nodes. Returns both nodes.
   *
   * @param parent The node to split
   * @param child The node that marks the split position.
   * @param removeChild Should this method remove the child while splitting.
   *
   * @returns Two nodes - `left` and `right`. If the `removeChild` argument is
   * `false` then the original child node is the first child of `right`.
   */
  splitByChild(parent, child, removeChild) {
    if (child.parentNode != parent) throw new Error(`Node 'child' is not a direct child of 'parent'.`);

    // create childless clone 'left'
    const left = xml.create.cloneNode(parent, false);
    if (parent.parentNode) {
      xml.modify.insertBefore(left, parent);
    }
    const right = parent;

    // move nodes from 'right' to 'left'
    let curChild = right.childNodes[0];
    while (curChild != child) {
      xml.modify.remove(curChild);
      xml.modify.appendChild(left, curChild);
      curChild = right.childNodes[0];
    }

    // remove child
    if (removeChild) {
      xml.modify.removeChild(right, 0);
    }
    return [left, right];
  }

  /**
   * Recursively removes text nodes leaving only "general nodes".
   */
  removeEmptyTextNodes(node) {
    recursiveRemoveEmptyTextNodes(node);
  }
};

//
// private functions
//

function cloneNodeDeep(original) {
  const clone = {};

  // basic properties
  clone.nodeType = original.nodeType;
  clone.nodeName = original.nodeName;
  if (xml.query.isTextNode(original)) {
    clone.textContent = original.textContent;
  } else {
    const attributes = original.attributes;
    if (attributes) {
      clone.attributes = Object.assign({}, attributes);
    }
  }

  // children
  if (original.childNodes) {
    clone.childNodes = [];
    let prevChildClone;
    for (const child of original.childNodes) {
      // clone child
      const childClone = cloneNodeDeep(child);

      // set references
      clone.childNodes.push(childClone);
      childClone.parentNode = clone;
      if (prevChildClone) {
        prevChildClone.nextSibling = childClone;
      }
      prevChildClone = childClone;
    }
  }
  return clone;
}
function recursiveRemoveEmptyTextNodes(node) {
  if (!node.childNodes) return node;
  const oldChildren = node.childNodes;
  node.childNodes = [];
  for (const child of oldChildren) {
    if (xml.query.isTextNode(child)) {
      // https://stackoverflow.com/questions/1921688/filtering-whitespace-only-strings-in-javascript#1921694
      if (child.textContent && child.textContent.match(/\S/)) {
        node.childNodes.push(child);
      }
      continue;
    }
    const strippedChild = recursiveRemoveEmptyTextNodes(child);
    node.childNodes.push(strippedChild);
  }
  return node;
}
const xml = new XmlUtils();

const TagDisposition = Object.freeze({
  Open: "Open",
  Close: "Close",
  SelfClosed: "SelfClosed"
});
const TagPlacement = Object.freeze({
  TextNode: "TextNode",
  Attribute: "Attribute"
});

function tagRegex(delimiters, global = false) {
  const tagOptionsPattern = `${Regex.escape(delimiters.tagOptionsStart)}(?<tagOptions>.*?)${Regex.escape(delimiters.tagOptionsEnd)}`;
  const tagPattern = `${Regex.escape(delimiters.tagStart)}(?<tagName>.*?)(?:\\s*${tagOptionsPattern})?\\s*${Regex.escape(delimiters.tagEnd)}`;
  const flags = global ? 'gm' : 'm';
  return new RegExp(tagPattern, flags);
}

class JsZipHelper {
  static toJsZipOutputType(binaryOrType) {
    if (!binaryOrType) throw new InternalArgumentMissingError("binaryOrType");
    let binaryType;
    if (typeof binaryOrType === 'function') {
      binaryType = binaryOrType;
    } else {
      binaryType = binaryOrType.constructor;
    }
    if (Binary.isBlobConstructor(binaryType)) return 'blob';
    if (Binary.isArrayBufferConstructor(binaryType)) return 'arraybuffer';
    if (Binary.isBufferConstructor(binaryType)) return 'nodebuffer';
    throw new Error(`Binary type '${binaryType.name}' is not supported.`);
  }
}

class ZipObject {
  get name() {
    return this.zipObject.name;
  }
  set name(value) {
    this.zipObject.name = value;
  }
  get isDirectory() {
    return this.zipObject.dir;
  }
  constructor(zipObject, binaryFormat) {
    this.zipObject = zipObject;
    this.binaryFormat = binaryFormat;
  }
  getContentText() {
    return this.zipObject.async('text');
  }
  getContentBase64() {
    return this.zipObject.async('binarystring');
  }
  getContentBinary(outputType) {
    const zipOutputType = JsZipHelper.toJsZipOutputType(outputType ?? this.binaryFormat);
    return this.zipObject.async(zipOutputType);
  }
}

class Zip {
  static async load(file) {
    const zip = await JSZip.loadAsync(file);
    return new Zip(zip, file.constructor);
  }
  constructor(zip, binaryFormat) {
    this.zip = zip;
    this.binaryFormat = binaryFormat;
  }
  getFile(path) {
    if (path && path.startsWith('/')) {
      path = path.substring(1);
    }
    const internalZipObject = this.zip.files[path];
    if (!internalZipObject) return null;
    return new ZipObject(internalZipObject, this.binaryFormat);
  }
  setFile(path, content) {
    this.zip.file(path, content);
  }
  isFileExist(path) {
    return !!this.zip.files[path];
  }
  listFiles() {
    return Object.keys(this.zip.files);
  }
  async export(outputType) {
    const zipOutputType = JsZipHelper.toJsZipOutputType(outputType ?? this.binaryFormat);
    const output = await this.zip.generateAsync({
      type: zipOutputType,
      compression: "DEFLATE",
      compressionOptions: {
        level: 6 // between 1 (best speed) and 9 (best compression)
      }
    });
    return output;
  }
}

/**
 * The types of relationships that can be created in a docx file.
 * A non-comprehensive list.
 */
const RelType = Object.freeze({
  Package: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/package',
  MainDocument: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument',
  Header: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/header',
  Footer: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer',
  Styles: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles',
  SharedStrings: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings',
  Link: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink',
  Image: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image',
  Chart: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart',
  ChartColors: 'http://schemas.microsoft.com/office/2011/relationships/chartColorStyle',
  Worksheet: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet',
  Table: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/table'
});
class Relationship {
  static fromXml(partDir, xml) {
    return new Relationship({
      id: xml.attributes?.['Id'],
      type: xml.attributes?.['Type'],
      target: Relationship.normalizeRelTarget(partDir, xml.attributes?.['Target']),
      targetMode: xml.attributes?.['TargetMode']
    });
  }
  static normalizeRelTarget(partDir, target) {
    if (!target) {
      return target;
    }

    // Remove leading slashes from input
    if (partDir.startsWith('/')) {
      partDir = partDir.substring(1);
    }
    if (target.startsWith('/')) {
      target = target.substring(1);
    }

    // Convert target to relative path
    if (target.startsWith(partDir)) {
      target = target.substring(partDir.length);
    }

    // Remove leading slashes from output
    if (target.startsWith('/')) {
      target = target.substring(1);
    }
    return target;
  }
  constructor(initial) {
    Object.assign(this, initial);
  }
  toXml() {
    const node = xml.create.generalNode('Relationship');
    node.attributes = {};

    // Set only non-empty attributes
    for (const propKey of Object.keys(this)) {
      const value = this[propKey];
      if (value && typeof value === 'string') {
        const attrName = propKey[0].toUpperCase() + propKey.substring(1);
        node.attributes[attrName] = value;
      }
    }
    return node;
  }
}

const MimeType = Object.freeze({
  Png: 'image/png',
  Jpeg: 'image/jpeg',
  Gif: 'image/gif',
  Bmp: 'image/bmp',
  Svg: 'image/svg+xml'
});
class MimeTypeHelper {
  static getDefaultExtension(mime) {
    switch (mime) {
      case MimeType.Png:
        return 'png';
      case MimeType.Jpeg:
        return 'jpg';
      case MimeType.Gif:
        return 'gif';
      case MimeType.Bmp:
        return 'bmp';
      case MimeType.Svg:
        return 'svg';
      default:
        throw new UnsupportedFileTypeError(mime);
    }
  }
  static getOfficeRelType(mime) {
    switch (mime) {
      case MimeType.Png:
      case MimeType.Jpeg:
      case MimeType.Gif:
      case MimeType.Bmp:
      case MimeType.Svg:
        return RelType.Image;
      default:
        throw new UnsupportedFileTypeError(mime);
    }
  }
}

/**
 * http://officeopenxml.com/anatomyofOOXML.php
 */
class ContentTypesFile {
  static contentTypesFilePath = '[Content_Types].xml';
  addedNew = false;
  constructor(zip) {
    this.zip = zip;
  }
  async ensureContentType(mime) {
    // Parse the content types file
    await this.parseContentTypesFile();

    // Extension already exists
    //
    // Multiple extensions may map to the same mime type, but a single
    // extension must only map to one mime type.
    const extension = MimeTypeHelper.getDefaultExtension(mime);
    if (this.contentTypes[extension]) return;

    // Add new node
    const typeNode = xml.create.generalNode('Default');
    typeNode.attributes = {
      "Extension": extension,
      "ContentType": mime
    };
    this.root.childNodes.push(typeNode);

    // Update state
    this.addedNew = true;
    this.contentTypes[extension] = mime;
  }
  async xmlString() {
    await this.parseContentTypesFile();
    return xml.parser.serializeFile(this.root);
  }

  /**
   * Save the Content Types file back to the zip.
   * Called automatically by the holding `Docx` before exporting.
   */
  async save() {
    // Not change - no need to save
    if (!this.addedNew) return;
    const xmlContent = xml.parser.serializeFile(this.root);
    this.zip.setFile(ContentTypesFile.contentTypesFilePath, xmlContent);
  }
  async parseContentTypesFile() {
    if (this.root) return;

    // parse the xml file
    const contentTypesXml = await this.zip.getFile(ContentTypesFile.contentTypesFilePath).getContentText();
    this.root = xml.parser.parse(contentTypesXml);

    // build the content types lookup
    this.contentTypes = {};
    for (const node of this.root.childNodes) {
      if (node.nodeName !== 'Default') continue;
      const genNode = node;
      const contentTypeAttribute = genNode.attributes['ContentType'];
      if (!contentTypeAttribute) continue;
      const extensionAttribute = genNode.attributes['Extension'];
      if (!extensionAttribute) continue;
      this.contentTypes[extensionAttribute] = contentTypeAttribute;
    }
  }
}

/**
 * Handles media files of the main document.
 */
class MediaFiles {
  static mediaDir = 'word/media';
  files = new Map();
  nextFileId = 0;
  constructor(zip) {
    this.zip = zip;
  }

  /**
   * Returns the media file path.
   */
  async add(mediaFile, mime) {
    // Check if already added
    if (this.files.has(mediaFile)) return this.files.get(mediaFile);

    // Hash existing media files
    await this.hashMediaFiles();

    // Hash the new file
    // Note: Even though hashing the base64 string may seem inefficient
    // (requires extra step in some cases) in practice it is significantly
    // faster than hashing a 'binarystring'.
    const base64 = await Binary.toBase64(mediaFile);
    const hash = sha1(base64);

    // Check if file already exists
    // Note: this can be optimized by keeping both mapping by filename as well as by hash
    let path = Object.keys(this.hashes).find(p => this.hashes[p] === hash);
    if (path) return path;

    // Generate unique media file name
    const baseFilename = this.baseFilename(mime);
    const extension = MimeTypeHelper.getDefaultExtension(mime);
    do {
      this.nextFileId++;
      path = `${MediaFiles.mediaDir}/${baseFilename}${this.nextFileId}.${extension}`;
    } while (this.hashes[path]);

    // Add media to zip
    this.zip.setFile(path, mediaFile);

    // Add media to our lookups
    this.hashes[path] = hash;
    this.files.set(mediaFile, path);
    return path;
  }
  async count() {
    await this.hashMediaFiles();
    return Object.keys(this.hashes).length;
  }
  async hashMediaFiles() {
    if (this.hashes) return;
    this.hashes = {};
    for (const path of this.zip.listFiles()) {
      if (!path.startsWith(MediaFiles.mediaDir)) continue;
      const filename = Path.getFilename(path);
      if (!filename) continue;
      const fileData = await this.zip.getFile(path).getContentBase64();
      const fileHash = sha1(fileData);
      this.hashes[path] = fileHash;
    }
  }
  baseFilename(mime) {
    // Naive heuristic.
    // May need to be modified if we're going to support more mime types.
    const parts = mime.split('/');
    return parts[0];
  }
}

/**
 * A rels file is an xml file that contains the relationship information of a single docx "part".
 *
 * See: http://officeopenxml.com/anatomyofOOXML.php
 */
class RelsFile {
  nextRelId = 0;
  constructor(partPath, zip) {
    this.zip = zip;
    this.partDir = partPath && Path.getDirectory(partPath);
    const partFilename = partPath && Path.getFilename(partPath);
    this.relsFilePath = Path.combine(this.partDir, '_rels', `${partFilename ?? ''}.rels`);
  }

  /**
   * Returns the rel ID.
   */
  async add(relTarget, relType, relTargetMode) {
    // If relTarget is an internal file it should be relative to the part dir
    if (this.partDir && relTarget.startsWith(this.partDir)) {
      relTarget = relTarget.substring(this.partDir.length + 1);
    }

    // Parse rels file
    await this.parseRelsFile();

    // Already exists?
    const relTargetKey = this.getRelTargetKey(relType, relTarget);
    let relId = this.relTargets[relTargetKey];
    if (relId) return relId;

    // Create rel node
    relId = this.getNextRelId();
    const rel = new Relationship({
      id: relId,
      type: relType,
      target: relTarget,
      targetMode: relTargetMode
    });

    // Update lookups
    this.rels[relId] = rel;
    this.relTargets[relTargetKey] = relId;

    // Return
    return relId;
  }
  async list() {
    await this.parseRelsFile();
    return Object.values(this.rels);
  }
  absoluteTargetPath(relTarget) {
    if (this.partDir && relTarget.startsWith(this.partDir)) {
      return relTarget;
    }
    return Path.combine(this.partDir, relTarget);
  }

  /**
   * Save the rels file back to the zip.
   * Called automatically by the holding `Docx` before exporting.
   */
  async save() {
    // Not change - no need to save
    if (!this.rels) return;

    // Create rels xml
    const root = this.createRootNode();
    root.childNodes = Object.values(this.rels).map(rel => rel.toXml());

    // Serialize and save
    const xmlContent = xml.parser.serializeFile(root);
    this.zip.setFile(this.relsFilePath, xmlContent);
  }

  //
  // Private methods
  //

  getNextRelId() {
    let relId;
    do {
      this.nextRelId++;
      relId = 'rId' + this.nextRelId;
    } while (this.rels[relId]);
    return relId;
  }
  async parseRelsFile() {
    // Already parsed
    if (this.rels) return;

    // Parse xml
    let root;
    const relsFile = this.zip.getFile(this.relsFilePath);
    if (relsFile) {
      const xmlString = await relsFile.getContentText();
      root = xml.parser.parse(xmlString);
    } else {
      root = this.createRootNode();
    }

    // Parse relationship nodes
    this.rels = {};
    this.relTargets = {};
    for (const relNode of root.childNodes) {
      const genRelNode = relNode;
      const attributes = genRelNode.attributes;
      if (!attributes) continue;
      const idAttr = attributes['Id'];
      if (!idAttr) continue;

      // Store rel
      const rel = Relationship.fromXml(this.partDir, genRelNode);
      this.rels[idAttr] = rel;

      // Create rel target lookup
      if (rel.type && rel.target) {
        const relTargetKey = this.getRelTargetKey(rel.type, rel.target);
        this.relTargets[relTargetKey] = idAttr;
      }
    }
  }
  getRelTargetKey(type, target) {
    return `${type} - ${target}`;
  }
  createRootNode() {
    const root = xml.create.generalNode('Relationships');
    root.attributes = {
      'xmlns': 'http://schemas.openxmlformats.org/package/2006/relationships'
    };
    root.childNodes = [];
    return root;
  }
}

/**
 * Represents an OpenXml package part.
 *
 * Most common parts are xml files, but it can also be any other arbitrary file.
 *
 * See: https://en.wikipedia.org/wiki/Open_Packaging_Conventions
 */
class OpenXmlPart {
  openedParts = {};
  constructor(path, zip) {
    this.path = path;
    this.zip = zip;
    this.rels = new RelsFile(this.path, zip);
  }

  //
  // public methods
  //

  /**
   * Get the xml root node of the part.
   * Changes to the xml will be persisted to the underlying zip file.
   */
  async xmlRoot() {
    if (!this.root) {
      const file = this.zip.getFile(this.path);
      const xmlString = await file.getContentText();
      this.root = xml.parser.parse(xmlString);
    }
    return this.root;
  }

  /**
   * Get the text content of the part.
   */
  async getText() {
    const xmlDocument = await this.xmlRoot();

    // Ugly but good enough...
    const xmlString = xml.parser.serializeFile(xmlDocument);
    const domDocument = xml.parser.domParse(xmlString);
    return domDocument.documentElement.textContent;
  }

  /**
   * Get the binary content of the part.
   */
  async getContentBinary(outputType) {
    const file = this.zip.getFile(this.path);
    return await file.getContentBinary(outputType);
  }

  /**
   * Get a related OpenXmlPart by the relationship ID.
   */
  async getPartById(relId) {
    const rels = await this.rels.list();
    const rel = rels.find(r => r.id === relId);
    if (!rel) {
      return null;
    }
    return this.openPart(rel);
  }

  /**
   * Get all related OpenXmlParts by the relationship type.
   */
  async getFirstPartByType(type) {
    const rels = await this.rels.list();
    const rel = rels.find(r => r.type === type);
    if (!rel) {
      return null;
    }
    return this.openPart(rel);
  }

  /**
   * Get all related OpenXmlParts by the relationship type.
   */
  async getPartsByType(type) {
    const rels = await this.rels.list();
    const relsByType = rels.filter(r => r.type === type);
    if (!relsByType?.length) {
      return [];
    }
    const parts = [];
    for (const rel of relsByType) {
      const part = this.openPart(rel);
      parts.push(part);
    }
    return parts;
  }

  /**
   * Save the part and all related parts.
   *
   * **Notice:**
   * - Saving binary changes requires binary content to be explicitly provided.
   * - Binary changes of related parts are not automatically saved.
   */
  async save(binaryContent) {
    // Save self - binary
    if (binaryContent) {
      this.zip.setFile(this.path, binaryContent);
    }

    // Save self - xml
    else if (this.root) {
      const xmlRoot = await this.xmlRoot();
      const xmlContent = xml.parser.serializeFile(xmlRoot);
      this.zip.setFile(this.path, xmlContent);
    }

    // Save opened parts
    for (const part of Object.values(this.openedParts)) {
      await part.save();
    }

    // Save rels
    await this.rels.save();
  }
  openPart(rel) {
    const relTargetPath = this.rels.absoluteTargetPath(rel.target);
    const part = new OpenXmlPart(relTargetPath, this.zip);
    this.openedParts[relTargetPath] = part;
    return part;
  }
}

/**
 * Represents a single docx file.
 */
class Docx {
  /**
   * Load a docx file from a binary zip file.
   */
  static async load(file) {
    // Load the zip file
    let zip;
    try {
      zip = await Zip.load(file);
    } catch {
      throw new MalformedFileError("Failed to load zip file.");
    }

    // Load the docx file
    const docx = await Docx.open(zip);
    return docx;
  }

  /**
   * Open a docx file from an instantiated zip file.
   */
  static async open(zip) {
    const mainDocumentPath = await Docx.getMainDocumentPath(zip);
    if (!mainDocumentPath) throw new MalformedFileError("Cannot find main document path.");
    return new Docx(mainDocumentPath, zip);
  }
  static async getMainDocumentPath(zip) {
    const rootPart = '';
    const rootRels = new RelsFile(rootPart, zip);
    const relations = await rootRels.list();
    return relations.find(rel => rel.type == RelType.MainDocument)?.target;
  }

  //
  // fields
  //

  /**
   * **Notice:** You should only use this property if there is no other way to
   * do what you need. Use with caution.
   */
  get rawZipFile() {
    return this.zip;
  }

  //
  // constructor
  //

  constructor(mainDocumentPath, zip) {
    this.zip = zip;
    this.mainDocument = new OpenXmlPart(mainDocumentPath, zip);
    this.mediaFiles = new MediaFiles(zip);
    this.contentTypes = new ContentTypesFile(zip);
  }

  //
  // public methods
  //

  async getContentParts() {
    const parts = [this.mainDocument];
    const relTypes = [RelType.Header, RelType.Footer, RelType.Chart];
    for (const relType of relTypes) {
      const typeParts = await this.mainDocument.getPartsByType(relType);
      if (typeParts?.length) {
        parts.push(...typeParts);
      }
    }
    return parts;
  }
  async export(outputType) {
    await this.mainDocument.save();
    await this.contentTypes.save();
    return await this.zip.export(outputType);
  }
}

/**
 * Wordprocessing Markup Language node names.
 */
class W {
  Paragraph = 'w:p';
  ParagraphProperties = 'w:pPr';
  Run = 'w:r';
  RunProperties = 'w:rPr';
  Text = 'w:t';
  Table = 'w:tbl';
  TableRow = 'w:tr';
  TableCell = 'w:tc';
  Drawing = 'w:drawing';
  NumberProperties = 'w:numPr';
  /**
   * Structured document tag (content control).
   * 
   * See: ECMA-376, Part 1, sections 17.5 and 17.5.2
   */
  StructuredTag = 'w:sdt';
  /**
   * Structured document tag properties.
   */
  StructuredTagProperties = 'w:sdtPr';
  /**
   * Structured document tag content.
   */
  StructuredTagContent = 'w:sdtContent';
  /**
   * Complex field character (legacy form field).
   * 
   * see: http://officeopenxml.com/WPfields.php
   */
  FieldChar = 'w:fldChar';
}

/**
 * Drawing Markup Language main namespace node names.
 *
 * These elements are part of the main drawingML namespace:
 * xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main".
 */
class A {
  Paragraph = 'a:p';
  ParagraphProperties = 'a:pPr';
  Run = 'a:r';
  RunProperties = 'a:rPr';
  Text = 'a:t';
  Graphic = 'a:graphic';
  GraphicData = 'a:graphicData';
  /**
   * Binary large image (or) picture.
   */
  Blip = 'a:blip';
  AlphaModFix = 'a:alphaModFix';
}

/**
 * Drawing Markup Language "wordprocessing drawing" namespace node names.
 * 
 * These elements are part of the wordprocessingDrawing namespace:
 * xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing".
 */
class Wp {
  /**
   * docPr stands for "Drawing Object Non-Visual Properties", which isn't
   * exactly a good acronym but that's how it's called nevertheless.
   */
  DocPr = 'wp:docPr';
  /**
   * Inline DrawingML Object.
   *
   * see: http://officeopenxml.com/drwPicInline.php
   */
  Inline = 'wp:inline';
  /**
   * Anchor for Floating DrawingML Object.
   * 
   * see: http://officeopenxml.com/drwPicFloating.php
   */
  FloatingAnchor = 'wp:anchor';
  /**
   * Drawing extent.
   */
  Extent = 'wp:extent';
}

/**
 * Drawing Markup Language "picture" namespace node names.
 * 
 * These elements are part of the picture namespace:
 * xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture".
 */
class Pic {
  Pic = 'pic:pic';
  /**
   * Non-visual picture properties.
   */
  NvPicPr = 'pic:nvPicPr';
  CnVPr = 'pic:cNvPr';
  /**
   * Binary large image (or) picture fill.
   */
  BlipFill = 'pic:blipFill';
  /**
   * Shape properties.
   */
  SpPr = 'pic:spPr';
  Xfrm = 'a:xfrm';
  Ext = 'a:ext';
}

/**
 * Office Markup Language (OML) node names.
 *
 * Office Markup Language is my generic term for the markup languages that are
 * used in Office Open XML documents. Including but not limited to
 * Wordprocessing Markup Language, Drawing Markup Language and Spreadsheet
 * Markup Language.
 * 
 * - For an easy introduction, see: http://officeopenxml.com/WPcontentOverview.php
 * - For the complete specification, see: https://ecma-international.org/publications-and-standards/standards/ecma-376/
 */
class OmlNode {
  /**
   * Wordprocessing Markup Language node names.
   */
  static W = new W();

  /**
   * Drawing Markup Language main namespace node names.
   */
  static A = new A();

  /**
   * Drawing Markup Language "wordprocessing drawing" namespace node names.
   */
  static Wp = new Wp();

  /**
   * Drawing Markup Language "picture" namespace node names.
   */
  static Pic = new Pic();
}
class OmlAttribute {
  static SpacePreserve = 'xml:space';
  /**
   * Complex field character type.
   * 
   * see: http://officeopenxml.com/WPfields.php
   */
  static FieldCharType = 'w:fldCharType';
}

//
// Wordprocessing Markup Language (WML) intro:
//
// In Word text nodes are contained in "run" nodes (which specifies text
// properties such as font and color). The "run" nodes in turn are
// contained in paragraph nodes which is the core unit of content.
//
// Example:
//
// <w:p>    <-- paragraph
//   <w:r>      <-- run
//     <w:rPr>      <-- run properties
//       <w:b/>     <-- bold
//     </w:rPr>
//     <w:t>This is text.</w:t>     <-- actual text
//   </w:r>
// </w:p>
//
// - For an easy introduction, see: http://officeopenxml.com/WPcontentOverview.php
// - For the complete specification, see: https://ecma-international.org/publications-and-standards/standards/ecma-376/
//

/**
 * Office Markup Language (OML) utilities.
 *
 * Office Markup Language is my generic term for the markup languages that are
 * used in Office Open XML documents. Including but not limited to
 * Wordprocessing Markup Language, Drawing Markup Language and Spreadsheet
 * Markup Language.
 */
class OfficeMarkup {
  /**
   * Office Markup query utilities.
   */
  query = new Query();

  /**
   * Office Markup modify utilities.
   */
  modify = new Modify();
}

/**
 * Wordprocessing Markup Language (WML) query utilities.
 */
class Query {
  isTextNode(node) {
    return node.nodeName === OmlNode.W.Text || node.nodeName === OmlNode.A.Text;
  }
  isRunNode(node) {
    return node.nodeName === OmlNode.W.Run || node.nodeName === OmlNode.A.Run;
  }
  isRunPropertiesNode(node) {
    return node.nodeName === OmlNode.W.RunProperties || node.nodeName === OmlNode.A.RunProperties;
  }
  isTableNode(node) {
    return node.nodeName === OmlNode.W.Table;
  }
  isTableCellNode(node) {
    return node.nodeName === OmlNode.W.TableCell;
  }
  isParagraphNode(node) {
    return node.nodeName === OmlNode.W.Paragraph || node.nodeName === OmlNode.A.Paragraph;
  }
  isParagraphPropertiesNode(node) {
    return node.nodeName === OmlNode.W.ParagraphProperties || node.nodeName === OmlNode.A.ParagraphProperties;
  }
  isListParagraph(paragraphNode) {
    const paragraphProperties = officeMarkup.query.findParagraphPropertiesNode(paragraphNode);
    const listNumberProperties = xml.query.findByPath(paragraphProperties, XmlNodeType.General, OmlNode.W.NumberProperties);
    return !!listNumberProperties;
  }
  isInlineDrawingNode(node) {
    return node.nodeName === OmlNode.Wp.Inline && node.parentNode?.nodeName === OmlNode.W.Drawing;
  }
  findParagraphPropertiesNode(paragraphNode) {
    if (!officeMarkup.query.isParagraphNode(paragraphNode)) throw new Error(`Expected paragraph node but received a '${paragraphNode.nodeName}' node.`);
    return xml.query.findChild(paragraphNode, officeMarkup.query.isParagraphPropertiesNode);
  }

  /**
   * Search for the first direct child **Word** text node (i.e. a <w:t> node).
   */
  firstTextNodeChild(node) {
    if (!node) return null;
    if (!officeMarkup.query.isRunNode(node)) return null;
    if (!node.childNodes) return null;
    for (const child of node.childNodes) {
      if (officeMarkup.query.isTextNode(child)) return child;
    }
    return null;
  }

  /**
   * Search **upwards** for the first **Office** text node (i.e. a <w:t> or <a:t> node).
   */
  containingTextNode(node) {
    if (!node) return null;
    if (!xml.query.isTextNode(node)) throw new Error(`'Invalid argument node. Expected a XmlTextNode.`);
    return xml.query.findParent(node, officeMarkup.query.isTextNode);
  }

  /**
   * Search **upwards** for the first run node.
   */
  containingRunNode(node) {
    return xml.query.findParent(node, officeMarkup.query.isRunNode);
  }

  /**
   * Search **upwards** for the first paragraph node.
   */
  containingParagraphNode(node) {
    return xml.query.findParent(node, officeMarkup.query.isParagraphNode);
  }

  /**
   * Search **upwards** for the first "table row" node.
   */
  containingTableRowNode(node) {
    return xml.query.findParentByName(node, OmlNode.W.TableRow);
  }

  /**
   * Search **upwards** for the first "table cell" node.
   */
  containingTableCellNode(node) {
    return xml.query.findParent(node, officeMarkup.query.isTableCellNode);
  }

  /**
   * Search **upwards** for the first "table" node.
   */
  containingTableNode(node) {
    return xml.query.findParentByName(node, OmlNode.W.Table);
  }

  /**
   * Search **upwards** for the first `w:sdtContent` node.
   */
  containingStructuredTagContentNode(node) {
    return xml.query.findParentByName(node, OmlNode.W.StructuredTagContent);
  }

  //
  // Advanced queries
  //

  isEmptyTextNode(node) {
    if (!officeMarkup.query.isTextNode(node)) throw new Error(`Text node expected but '${node.nodeName}' received.`);
    if (!node.childNodes?.length) return true;
    const xmlTextNode = node.childNodes[0];
    if (!xml.query.isTextNode(xmlTextNode)) throw new Error("Invalid XML structure. 'w:t' node should contain a single text node only.");
    if (!xmlTextNode.textContent) return true;
    return false;
  }
  isEmptyRun(node) {
    if (!officeMarkup.query.isRunNode(node)) throw new Error(`Run node expected but '${node.nodeName}' received.`);
    for (const child of node.childNodes ?? []) {
      if (officeMarkup.query.isRunPropertiesNode(child)) continue;
      if (officeMarkup.query.isTextNode(child) && officeMarkup.query.isEmptyTextNode(child)) continue;
      return false;
    }
    return true;
  }
}

/**
 * Office Markup Language (OML) modify utilities.
 */
class Modify {
  /**
   * Split the text node into two text nodes, each with it's own wrapping <w:t> node.
   * Returns the newly created text node.
   *
   * @param textNode
   * @param splitIndex
   * @param addBefore Should the new node be added before or after the original node.
   */
  splitTextNode(textNode, splitIndex, addBefore) {
    let firstXmlTextNode;
    let secondXmlTextNode;

    // Split nodes
    const wordTextNode = officeMarkup.query.containingTextNode(textNode);
    const newWordTextNode = xml.create.cloneNode(wordTextNode, true);

    // Set space preserve to prevent display differences after splitting
    // (otherwise if there was a space in the middle of the text node and it
    // is now at the beginning or end of the text node it will be ignored)
    officeMarkup.modify.setSpacePreserveAttribute(wordTextNode);
    officeMarkup.modify.setSpacePreserveAttribute(newWordTextNode);
    if (addBefore) {
      // Insert new node before existing one
      xml.modify.insertBefore(newWordTextNode, wordTextNode);
      firstXmlTextNode = xml.query.lastTextChild(newWordTextNode);
      secondXmlTextNode = textNode;
    } else {
      // Insert new node after existing one
      const curIndex = wordTextNode.parentNode.childNodes.indexOf(wordTextNode);
      xml.modify.insertChild(wordTextNode.parentNode, newWordTextNode, curIndex + 1);
      firstXmlTextNode = textNode;
      secondXmlTextNode = xml.query.lastTextChild(newWordTextNode);
    }

    // Edit text
    const firstText = firstXmlTextNode.textContent;
    const secondText = secondXmlTextNode.textContent;
    firstXmlTextNode.textContent = firstText.substring(0, splitIndex);
    secondXmlTextNode.textContent = secondText.substring(splitIndex);
    return addBefore ? firstXmlTextNode : secondXmlTextNode;
  }

  /**
   * Split the paragraph around the specified text node.
   *
   * @returns Two paragraphs - `left` and `right`. If the `removeTextNode` argument is
   * `false` then the original text node is the first text node of `right`.
   */
  splitParagraphByTextNode(paragraph, textNode, removeTextNode) {
    // Input validation
    const containingParagraph = officeMarkup.query.containingParagraphNode(textNode);
    if (containingParagraph != paragraph) throw new Error(`Node 'textNode' is not contained in the specified paragraph.`);
    const runNode = officeMarkup.query.containingRunNode(textNode);
    const wordTextNode = officeMarkup.query.containingTextNode(textNode);

    // 1. Split the run

    // Create run clone (left) and keep the original run (right).
    const leftRun = xml.create.cloneNode(runNode, false);
    const rightRun = runNode;
    xml.modify.insertBefore(leftRun, rightRun);

    // Copy props from original run node (preserve style)
    const runProps = rightRun.childNodes.find(node => officeMarkup.query.isRunPropertiesNode(node));
    if (runProps) {
      const leftRunProps = xml.create.cloneNode(runProps, true);
      xml.modify.appendChild(leftRun, leftRunProps);
    }

    // Move all text nodes up to the specified text node, to the new run.
    const firstRunChildIndex = runProps ? 1 : 0;
    let curChild = rightRun.childNodes[firstRunChildIndex];
    while (curChild != wordTextNode) {
      xml.modify.remove(curChild);
      xml.modify.appendChild(leftRun, curChild);
      curChild = rightRun.childNodes[firstRunChildIndex];
    }

    // Remove text node
    if (removeTextNode) {
      xml.modify.removeChild(rightRun, firstRunChildIndex);
    }

    // 2. Split the paragraph

    // Create paragraph clone (left) and keep the original paragraph (right).
    const leftPara = xml.create.cloneNode(containingParagraph, false);
    const rightPara = containingParagraph;
    xml.modify.insertBefore(leftPara, rightPara);

    // Copy props from original paragraph (preserve style)
    const paragraphProps = rightPara.childNodes.find(node => officeMarkup.query.isParagraphPropertiesNode(node));
    if (paragraphProps) {
      const leftParagraphProps = xml.create.cloneNode(paragraphProps, true);
      xml.modify.appendChild(leftPara, leftParagraphProps);
    }

    // Move all run nodes up to the original run (right), to the new paragraph (left).
    const firstParaChildIndex = paragraphProps ? 1 : 0;
    curChild = rightPara.childNodes[firstParaChildIndex];
    while (curChild != rightRun) {
      xml.modify.remove(curChild);
      xml.modify.appendChild(leftPara, curChild);
      curChild = rightPara.childNodes[firstParaChildIndex];
    }

    // Clean paragraphs - remove empty runs
    if (officeMarkup.query.isEmptyRun(leftRun)) xml.modify.remove(leftRun);
    if (officeMarkup.query.isEmptyRun(rightRun)) xml.modify.remove(rightRun);
    return [leftPara, rightPara];
  }

  /**
   * Move all text between the 'from' and 'to' nodes to the 'from' node.
   */
  joinTextNodesRange(from, to) {
    // Find run nodes
    const firstRunNode = officeMarkup.query.containingRunNode(from);
    const secondRunNode = officeMarkup.query.containingRunNode(to);
    const paragraphNode = firstRunNode.parentNode;
    if (secondRunNode.parentNode !== paragraphNode) throw new Error('Can not join text nodes from separate paragraphs.');

    // Find "word text nodes"
    const firstWordTextNode = officeMarkup.query.containingTextNode(from);
    const secondWordTextNode = officeMarkup.query.containingTextNode(to);
    const totalText = [];

    // Iterate runs
    let curRunNode = firstRunNode;
    while (curRunNode) {
      // Iterate text nodes
      let curWordTextNode;
      if (curRunNode === firstRunNode) {
        curWordTextNode = firstWordTextNode;
      } else {
        curWordTextNode = officeMarkup.query.firstTextNodeChild(curRunNode);
      }
      while (curWordTextNode) {
        if (!officeMarkup.query.isTextNode(curWordTextNode)) {
          curWordTextNode = curWordTextNode.nextSibling;
          continue;
        }

        // Move text to first node
        const curXmlTextNode = xml.query.lastTextChild(curWordTextNode);
        totalText.push(curXmlTextNode.textContent);

        // Next text node
        const textToRemove = curWordTextNode;
        if (curWordTextNode === secondWordTextNode) {
          curWordTextNode = null;
        } else {
          curWordTextNode = curWordTextNode.nextSibling;
        }

        // Remove current text node
        if (textToRemove !== firstWordTextNode) {
          xml.modify.remove(textToRemove);
        }
      }

      // Next run
      const runToRemove = curRunNode;
      if (curRunNode === secondRunNode) {
        curRunNode = null;
      } else {
        curRunNode = curRunNode.nextSibling;
      }

      // Remove current run
      if (!runToRemove.childNodes || !runToRemove.childNodes.length) {
        xml.modify.remove(runToRemove);
      }
    }

    // Set the text content
    const firstXmlTextNode = xml.query.lastTextChild(firstWordTextNode);
    firstXmlTextNode.textContent = totalText.join('');
  }

  /**
   * Take all runs from 'second' and move them to 'first'.
   */
  joinParagraphs(first, second) {
    if (first === second) return;
    let childIndex = 0;
    while (second.childNodes && childIndex < second.childNodes.length) {
      const curChild = second.childNodes[childIndex];
      if (officeMarkup.query.isRunNode(curChild)) {
        xml.modify.removeChild(second, childIndex);
        xml.modify.appendChild(first, curChild);
      } else {
        childIndex++;
      }
    }
  }
  setSpacePreserveAttribute(node) {
    if (!node.attributes) {
      node.attributes = {};
    }
    if (!node.attributes[OmlAttribute.SpacePreserve]) {
      node.attributes[OmlAttribute.SpacePreserve] = 'preserve';
    }
  }
  removeTag(tag) {
    if (tag.placement === TagPlacement.TextNode) {
      const wordTextNode = officeMarkup.query.containingTextNode(tag.xmlTextNode);
      const runNode = officeMarkup.query.containingRunNode(tag.xmlTextNode);

      // Remove the word text node
      xml.modify.remove(wordTextNode);

      // Remove the run node if it's empty
      if (officeMarkup.query.isEmptyRun(runNode)) {
        xml.modify.remove(runNode);
      }
      return;
    }
    if (tag.placement === TagPlacement.Attribute) {
      if (!tag.xmlNode.attributes || !(tag.attributeName in tag.xmlNode.attributes)) {
        return;
      }

      // Remove the tag from the attribute value
      tag.xmlNode.attributes[tag.attributeName] = tag.xmlNode.attributes[tag.attributeName].replace(tag.rawText, "");

      // Remove the attribute if it's empty
      if (tag.xmlNode.attributes[tag.attributeName] === "") {
        delete tag.xmlNode.attributes[tag.attributeName];
      }
      return;
    }
    const anyTag = tag;
    throw new Error(`Unexpected tag placement "${anyTag.placement}" for tag "${anyTag.rawText}".`);
  }
}

/**
 * Office Markup Language utilities.
 */
const officeMarkup = new OfficeMarkup();

/**
 * Represents a single xlsx file.
 */
class Xlsx {
  /**
   * Load an xlsx file from a binary zip file.
   */
  static async load(file) {
    // Load the zip file
    let zip;
    try {
      zip = await Zip.load(file);
    } catch {
      throw new MalformedFileError("Failed to load zip file.");
    }

    // Load the xlsx file
    const xlsx = await Xlsx.open(zip);
    return xlsx;
  }

  /**
   * Open an xlsx file from an instantiated zip file.
   */
  static async open(zip) {
    const mainDocumentPath = await Xlsx.getMainDocumentPath(zip);
    if (!mainDocumentPath) throw new MalformedFileError("Cannot find main document path.");
    return new Xlsx(mainDocumentPath, zip);
  }
  static async getMainDocumentPath(zip) {
    const rootPart = '';
    const rootRels = new RelsFile(rootPart, zip);
    const relations = await rootRels.list();
    return relations.find(rel => rel.type == RelType.MainDocument)?.target;
  }

  //
  // fields
  //

  _parts = {};
  /**
   * **Notice:** You should only use this property if there is no other way to
   * do what you need. Use with caution.
   */
  get rawZipFile() {
    return this.zip;
  }

  //
  // constructor
  //

  constructor(mainDocumentPath, zip) {
    this.zip = zip;
    this.mainDocument = new OpenXmlPart(mainDocumentPath, zip);
  }

  //
  // public methods
  //

  async export(outputType) {
    await this.saveXmlChanges();
    return await this.zip.export(outputType);
  }

  //
  // private methods
  //

  async saveXmlChanges() {
    const parts = [this.mainDocument, ...Object.values(this._parts)];
    for (const part of parts) {
      await part.save();
    }
  }
}

const drawingDescriptionAttributeName = "descr";
class AttributesDelimiterSearcher {
  visitedNodes = new Set();
  constructor(delimiters) {
    if (!delimiters) throw new InternalArgumentMissingError("delimiters");
    this.delimiters = delimiters;
    this.tagRegex = tagRegex(delimiters, true);
  }
  processNode(it, delimiters) {
    // Ignore irrelevant nodes
    if (!this.shouldSearchNode(it)) {
      return;
    }

    // Search delimiters in attributes
    this.findDelimiters(it, delimiters);
  }
  shouldSearchNode(it) {
    if (this.visitedNodes.has(it.node)) {
      return false;
    }
    this.visitedNodes.add(it.node);
    if (!xml.query.isGeneralNode(it.node)) return false;
    if (Object.keys(it.node.attributes || {}).length === 0) return false;

    // Currently we only support description attributes of drawing objects
    if (!this.isDrawingPropertiesNode(it.node)) {
      return false;
    }
    if (!it.node.attributes[drawingDescriptionAttributeName]) {
      return false;
    }
    return true;
  }
  isDrawingPropertiesNode(node) {
    // Node is drawing properties
    if (node.nodeName !== OmlNode.Wp.DocPr) {
      return false;
    }

    // Parent is drawing
    if (!node.parentNode) {
      return false;
    }
    const parent = xml.query.findParentByName(node, OmlNode.W.Drawing);
    return !!parent;
  }
  findDelimiters(it, delimiters) {
    // Currently we only support description attributes of drawing objects
    this.findDelimitersInAttribute(it.node, drawingDescriptionAttributeName, delimiters);
  }
  findDelimitersInAttribute(node, attributeName, delimiters) {
    const attrValue = node.attributes?.[attributeName];
    if (!attrValue) {
      return;
    }
    const matches = attrValue.matchAll(this.tagRegex);
    for (const match of matches) {
      const tag = match[0];
      const openDelimiterIndex = match.index;
      const closeDelimiterIndex = openDelimiterIndex + tag.length - this.delimiters.tagEnd.length;
      const openDelimiter = this.createCurrentDelimiterMark(openDelimiterIndex, true, node, attributeName);
      const closeDelimiter = this.createCurrentDelimiterMark(closeDelimiterIndex, false, node, attributeName);
      delimiters.push(openDelimiter);
      delimiters.push(closeDelimiter);
    }
  }
  createCurrentDelimiterMark(index, isOpen, xmlNode, attributeName) {
    return {
      placement: TagPlacement.Attribute,
      isOpen: isOpen,
      index: index,
      attributeName: attributeName,
      xmlNode: xmlNode
    };
  }
}

class TextNodesDelimiterSearcher {
  lookForOpenDelimiter = true;
  /**
   * The index of the current delimiter character being matched.
   *
   * Example: If the delimiter is `{!` and delimiterIndex is 0, it means we
   * are now looking for the character `{`. If it is 1, then we are looking
   * for `!`.
   */
  lookForDelimiterIndex = 0;
  /**
   * The list of text nodes containing the delimiter characters of the current match.
   */
  matchOpenNodes = [];
  /**
   * The index of the first character of the current delimiter match, in the text node it
   * was found at.
   *
   * Example: If the delimiter is `{!`, and the text node content is `abc{!xyz`,
   * then the firstMatchIndex is 3.
   */
  firstMatchIndex = -1;
  constructor(startDelimiter, endDelimiter) {
    this.startDelimiter = startDelimiter;
    this.endDelimiter = endDelimiter;
  }
  processNode(it, delimiters) {
    // Reset match state on paragraph transition
    if (officeMarkup.query.isParagraphNode(it.node)) {
      this.resetMatch();
    }

    // Reset match state on inline drawing
    if (officeMarkup.query.isInlineDrawingNode(it.node)) {
      this.resetMatch();
    }

    // Ignore non-text nodes
    if (!this.shouldSearchNode(it)) {
      return;
    }

    // Search delimiters in text nodes
    this.findDelimiters(it, delimiters);
  }
  resetMatch() {
    this.lookForDelimiterIndex = 0;
    this.matchOpenNodes = [];
    this.firstMatchIndex = -1;
  }
  shouldSearchNode(it) {
    if (!xml.query.isTextNode(it.node)) return false;
    if (!it.node.textContent) return false;
    if (!it.node.parentNode) return false;
    if (!officeMarkup.query.isTextNode(it.node.parentNode)) return false;
    return true;
  }
  findDelimiters(it, delimiters) {
    //
    // Performance note:
    //
    // The search efficiency is o(m*n) where n is the text size and m is the
    // delimiter length. We could use a variation of the KMP algorithm here
    // to reduce it to o(m+n) but since our m is expected to be small
    // (delimiters defaults to a single characters and even on custom inputs
    // are not expected to be much longer) it does not worth the extra
    // complexity and effort.
    //

    // Search delimiters in text nodes
    this.matchOpenNodes.push(it.node);
    let textIndex = 0;
    while (textIndex < it.node.textContent.length) {
      const delimiterPattern = this.lookForOpenDelimiter ? this.startDelimiter : this.endDelimiter;
      const char = it.node.textContent[textIndex];

      // No match
      if (char !== delimiterPattern[this.lookForDelimiterIndex]) {
        textIndex = this.noMatch(it, textIndex);
        textIndex++;
        continue;
      }

      // First match
      if (this.firstMatchIndex === -1) {
        this.firstMatchIndex = textIndex;
      }

      // Partial match
      if (this.lookForDelimiterIndex !== delimiterPattern.length - 1) {
        this.lookForDelimiterIndex++;
        textIndex++;
        continue;
      }

      // Full delimiter match
      textIndex = this.fullMatch(it, textIndex, delimiters);
      textIndex++;
    }
  }
  noMatch(it, textIndex) {
    //
    // Go back to first open node
    //
    // Required for cases where the text has repeating
    // characters that are the same as a delimiter prefix.
    // For instance:
    // Delimiter is '{!' and template text contains the string '{{!'
    //
    if (this.firstMatchIndex !== -1) {
      const node = first(this.matchOpenNodes);
      it.setCurrent(node);
      textIndex = this.firstMatchIndex;
    }

    // Update state
    this.resetMatch();
    if (textIndex < it.node.textContent.length - 1) {
      this.matchOpenNodes.push(it.node);
    }
    return textIndex;
  }
  fullMatch(it, textIndex, delimiters) {
    // Move all delimiters characters to the same text node
    if (this.matchOpenNodes.length > 1) {
      const firstNode = first(this.matchOpenNodes);
      const lastNode = last(this.matchOpenNodes);
      officeMarkup.modify.joinTextNodesRange(firstNode, lastNode);
      textIndex += firstNode.textContent.length - it.node.textContent.length;
      it.setCurrent(firstNode);
    }

    // Store delimiter
    const delimiterMark = this.createCurrentDelimiterMark();
    delimiters.push(delimiterMark);

    // Update state
    this.lookForOpenDelimiter = !this.lookForOpenDelimiter;
    this.resetMatch();
    if (textIndex < it.node.textContent.length - 1) {
      this.matchOpenNodes.push(it.node);
    }
    return textIndex;
  }
  createCurrentDelimiterMark() {
    return {
      placement: TagPlacement.TextNode,
      isOpen: this.lookForOpenDelimiter,
      index: this.firstMatchIndex,
      xmlTextNode: this.matchOpenNodes[0]
    };
  }
}

class DelimiterSearcher {
  constructor(delimiters, maxXmlDepth) {
    if (!delimiters) {
      throw new InternalArgumentMissingError("delimiters");
    }
    if (!maxXmlDepth) {
      throw new InternalArgumentMissingError("maxXmlDepth");
    }
    this.delimiters = delimiters;
    this.maxXmlDepth = maxXmlDepth;
  }
  findDelimiters(node) {
    const delimiters = [];
    const it = new XmlTreeIterator(node, this.maxXmlDepth);
    const attributeSearcher = new AttributesDelimiterSearcher(this.delimiters);
    const textSearcher = new TextNodesDelimiterSearcher(this.delimiters.tagStart, this.delimiters.tagEnd);
    while (it.node) {
      attributeSearcher.processNode(it, delimiters);
      textSearcher.processNode(it, delimiters);
      it.next();
    }
    return delimiters;
  }
}

class ScopeData {
  static defaultResolver(args) {
    let result;
    const lastKey = last(args.strPath);
    const curPath = args.strPath.slice();
    while (result === undefined && curPath.length) {
      curPath.pop();
      result = getProp(args.data, curPath.concat(lastKey));
    }
    return result;
  }
  path = [];
  strPath = [];
  constructor(data) {
    this.allData = data;
  }
  pathPush(pathPart) {
    this.path.push(pathPart);
    const strItem = isNumber(pathPart) ? pathPart.toString() : pathPart.name;
    this.strPath.push(strItem);
  }
  pathPop() {
    this.strPath.pop();
    return this.path.pop();
  }
  pathString() {
    return this.strPath.join(".");
  }
  getScopeData() {
    const args = {
      path: this.path,
      strPath: this.strPath,
      data: this.allData
    };
    if (this.scopeDataResolver) {
      return this.scopeDataResolver(args);
    }
    return ScopeData.defaultResolver(args);
  }
}

class TagParser {
  constructor(delimiters) {
    if (!delimiters) throw new InternalArgumentMissingError("delimiters");
    this.delimiters = delimiters;
    this.tagRegex = tagRegex(delimiters);
  }
  parse(delimiters) {
    const tags = [];
    let openedTextDelimiter;
    let openedAttributeDelimiter;
    for (let i = 0; i < delimiters.length; i++) {
      if (delimiters[i].placement === TagPlacement.TextNode) {
        openedTextDelimiter = this.processDelimiter(delimiters, i, openedTextDelimiter, tags);
        continue;
      }
      if (delimiters[i].placement === TagPlacement.Attribute) {
        openedAttributeDelimiter = this.processDelimiter(delimiters, i, openedAttributeDelimiter, tags);
        continue;
      }
      throw new Error(`Unexpected delimiter placement value "${delimiters[i].placement}"`);
    }
    return tags;
  }
  processDelimiter(delimiters, i, openedDelimiter, tags) {
    const delimiter = delimiters[i];

    // Close before open
    if (!openedDelimiter && !delimiter.isOpen) {
      const closeTagText = this.getPartialTagText(delimiter);
      throw new MissingStartDelimiterError(closeTagText);
    }

    // Open before close
    if (openedDelimiter && delimiter.isOpen) {
      const openTagText = this.getPartialTagText(openedDelimiter);
      throw new MissingCloseDelimiterError(openTagText);
    }

    // Valid open
    if (!openedDelimiter && delimiter.isOpen) {
      openedDelimiter = delimiter;
    }

    // Valid close
    if (openedDelimiter && !delimiter.isOpen) {
      // Create the tag
      const partialTag = this.processDelimiterPair(openedDelimiter, delimiter, i, delimiters);
      const tag = this.populateTagFields(partialTag);
      tags.push(tag);
      openedDelimiter = null;
    }
    return openedDelimiter;
  }
  getPartialTagText(delimiter) {
    if (delimiter.placement === TagPlacement.TextNode) {
      return delimiter.xmlTextNode.textContent;
    }
    if (delimiter.placement === TagPlacement.Attribute) {
      return delimiter.xmlNode.attributes[delimiter.attributeName];
    }
    throw new Error(`Unexpected delimiter placement value "${delimiter.placement}"`);
  }
  processDelimiterPair(openDelimiter, closeDelimiter, closeDelimiterIndex, allDelimiters) {
    if (openDelimiter.placement === TagPlacement.TextNode && closeDelimiter.placement === TagPlacement.TextNode) {
      return this.processTextNodeDelimiterPair(openDelimiter, closeDelimiter, closeDelimiterIndex, allDelimiters);
    }
    if (openDelimiter.placement === TagPlacement.Attribute && closeDelimiter.placement === TagPlacement.Attribute) {
      return this.processAttributeDelimiterPair(openDelimiter, closeDelimiter);
    }
    throw new Error(`Unexpected delimiter placement values. Open delimiter: "${openDelimiter.placement}", Close delimiter: "${closeDelimiter.placement}"`);
  }
  processTextNodeDelimiterPair(openDelimiter, closeDelimiter, closeDelimiterIndex, allDelimiters) {
    // Verify tag delimiters are in the same paragraph
    const openTextNode = openDelimiter.xmlTextNode;
    const closeTextNode = closeDelimiter.xmlTextNode;
    const sameNode = openTextNode === closeTextNode;
    if (!sameNode) {
      const startParagraph = officeMarkup.query.containingParagraphNode(openTextNode);
      const endParagraph = officeMarkup.query.containingParagraphNode(closeTextNode);
      if (startParagraph !== endParagraph) {
        throw new MissingCloseDelimiterError(openTextNode.textContent);
      }
    }

    // Verify no inline drawing in the middle
    const startRun = officeMarkup.query.containingRunNode(openTextNode);
    const endRun = officeMarkup.query.containingRunNode(closeTextNode);
    let currentRun = startRun;
    while (currentRun && currentRun !== endRun) {
      const drawing = currentRun.childNodes?.find(child => child.nodeName === OmlNode.W.Drawing);
      if (!drawing) {
        currentRun = currentRun.nextSibling;
        continue;
      }
      const inline = drawing.childNodes?.find(child => child.nodeName === OmlNode.Wp.Inline);
      if (!inline) {
        currentRun = currentRun.nextSibling;
        continue;
      }
      throw new MissingCloseDelimiterError(openTextNode.textContent);
    }

    // Normalize the underlying xml structure
    // (make sure the tag's node only includes the tag's text)
    this.normalizeTextTagNodes(openDelimiter, closeDelimiter, closeDelimiterIndex, allDelimiters);

    // Create the tag
    const tag = {
      placement: TagPlacement.TextNode,
      xmlTextNode: openDelimiter.xmlTextNode,
      rawText: openDelimiter.xmlTextNode.textContent
    };
    return tag;
  }
  processAttributeDelimiterPair(openDelimiter, closeDelimiter) {
    // Verify tag delimiters are in the same attribute
    const openNode = openDelimiter.xmlNode;
    const closeNode = closeDelimiter.xmlNode;
    if (openNode !== closeNode) {
      throw new MissingCloseDelimiterError(openNode.attributes[openDelimiter.attributeName]);
    }
    if (openDelimiter.attributeName !== closeDelimiter.attributeName) {
      throw new MissingCloseDelimiterError(openNode.attributes[openDelimiter.attributeName]);
    }

    // Create the tag
    const attrValue = openNode.attributes[openDelimiter.attributeName];
    const tagText = attrValue.substring(openDelimiter.index, closeDelimiter.index + this.delimiters.tagEnd.length);
    const tag = {
      placement: TagPlacement.Attribute,
      xmlNode: openNode,
      attributeName: openDelimiter.attributeName,
      rawText: tagText
    };
    return tag;
  }

  /**
   * Consolidate all tag's text into a single text node.
   *
   * Example:
   *
   * Text node before: "some text {some tag} some more text"
   * Text nodes after: [ "some text ", "{some tag}", " some more text" ]
   */
  normalizeTextTagNodes(openDelimiter, closeDelimiter, closeDelimiterIndex, allDelimiters) {
    let startTextNode = openDelimiter.xmlTextNode;
    let endTextNode = closeDelimiter.xmlTextNode;
    const sameNode = startTextNode === endTextNode;

    // Trim start
    if (openDelimiter.index > 0) {
      officeMarkup.modify.splitTextNode(startTextNode, openDelimiter.index, true);
      if (sameNode) {
        closeDelimiter.index -= openDelimiter.index;
      }
    }

    // Trim end
    if (closeDelimiter.index < endTextNode.textContent.length - 1) {
      endTextNode = officeMarkup.modify.splitTextNode(endTextNode, closeDelimiter.index + this.delimiters.tagEnd.length, true);
      if (sameNode) {
        startTextNode = endTextNode;
      }
    }

    // Join nodes
    if (!sameNode) {
      officeMarkup.modify.joinTextNodesRange(startTextNode, endTextNode);
      endTextNode = startTextNode;
    }

    // Update offsets of next delimiters
    for (let i = closeDelimiterIndex + 1; i < allDelimiters.length; i++) {
      let updated = false;
      const curDelimiter = allDelimiters[i];
      if (curDelimiter.placement === TagPlacement.TextNode && curDelimiter.xmlTextNode === openDelimiter.xmlTextNode) {
        curDelimiter.index -= openDelimiter.index;
        updated = true;
      }
      if (curDelimiter.placement === TagPlacement.TextNode && curDelimiter.xmlTextNode === closeDelimiter.xmlTextNode) {
        curDelimiter.index -= closeDelimiter.index + this.delimiters.tagEnd.length;
        updated = true;
      }
      if (!updated) break;
    }

    // Update references
    openDelimiter.xmlTextNode = startTextNode;
    closeDelimiter.xmlTextNode = endTextNode;
  }
  populateTagFields(partialTag) {
    if (!partialTag.rawText) {
      throw new InternalError("tag.rawText is required");
    }
    const tag = partialTag;
    const tagParts = tag.rawText.match(this.tagRegex);
    const tagName = (tagParts.groups?.["tagName"] || '').trim();

    // Ignoring empty tags
    if (!tagName?.length) {
      tag.disposition = TagDisposition.SelfClosed;
      return tag;
    }

    // Tag options
    const tagOptionsText = (tagParts.groups?.["tagOptions"] || '').trim();
    if (tagOptionsText) {
      try {
        tag.options = JSON5.parse("{" + normalizeDoubleQuotes(tagOptionsText) + "}");
      } catch (e) {
        throw new TagOptionsParseError(tag.rawText, e);
      }
    }

    // Container open tag
    if (tagName.startsWith(this.delimiters.containerTagOpen)) {
      tag.disposition = TagDisposition.Open;
      tag.name = tagName.slice(this.delimiters.containerTagOpen.length).trim();
      return tag;
    }

    // Container close tag
    if (tagName.startsWith(this.delimiters.containerTagClose)) {
      tag.disposition = TagDisposition.Close;
      tag.name = tagName.slice(this.delimiters.containerTagClose.length).trim();
      return tag;
    }

    // Self-closed tag
    tag.disposition = TagDisposition.SelfClosed;
    tag.name = tagName;
    return tag;
  }
}

class TemplatePlugin {
  /**
   * The content type this plugin handles.
   */

  /**
   * Called by the TemplateHandler at runtime.
   */
  setUtilities(utilities) {
    this.utilities = utilities;
  }

  /**
   * This method is called for each self-closing tag.
   * It should implement the specific document manipulation required by the tag.
   */
  simpleTagReplacements(tag, data, context) {
    // noop
  }

  /**
   * This method is called for each container tag. It should implement the
   * specific document manipulation required by the tag.
   *
   * @param tags All tags between the opening tag and closing tag (inclusive,
   * i.e. tags[0] is the opening tag and the last item in the tags array is
   * the closing tag).
   */
  containerTagReplacements(tags, data, context) {
    // noop
  }
}

function nameFromId(imageId) {
  return `Picture ${imageId}`;
}
function pixelsToEmu(pixels) {
  // https://stackoverflow.com/questions/20194403/openxml-distance-size-units
  // https://docs.microsoft.com/en-us/windows/win32/vml/msdn-online-vml-units#other-units-of-measurement
  // https://en.wikipedia.org/wiki/Office_Open_XML_file_formats#DrawingML
  // http://www.java2s.com/Code/CSharp/2D-Graphics/ConvertpixelstoEMUEMUtopixels.htm

  return Math.round(pixels * 9525);
}
function transparencyPercentToAlpha(transparencyPercent) {
  if (transparencyPercent < 0 || transparencyPercent > 100) {
    throw new TemplateDataError(`Transparency percent must be between 0 and 100, but was ${transparencyPercent}.`);
  }
  return Math.round((100 - transparencyPercent) * 1000);
}

function createImage(imageId, relId, content) {
  // http://officeopenxml.com/drwPicInline.php

  //
  // Performance note:
  //
  // I've tried to improve the markup generation performance by parsing
  // the string once and caching the result (and of course customizing it
  // per image) but it made no change whatsoever (in both cases 1000 items
  // loop takes around 8 seconds on my machine) so I'm sticking with this
  // approach which I find to be more readable.
  //

  const name = nameFromId(imageId);
  const markupText = `
        <w:drawing>
            <wp:inline distT="0" distB="0" distL="0" distR="0">
                <wp:extent cx="${pixelsToEmu(content.width)}" cy="${pixelsToEmu(content.height)}"/>
                <wp:effectExtent l="0" t="0" r="0" b="0"/>
                ${docProperties(imageId, name, content)}
                <wp:cNvGraphicFramePr>
                    <a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/>
                </wp:cNvGraphicFramePr>
                <a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
                    <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
                        ${pictureMarkup(imageId, relId, name, content)}
                    </a:graphicData>
                </a:graphic>
            </wp:inline>
        </w:drawing>
    `;
  const markupXml = xml.parser.parse(markupText);
  xml.modify.removeEmptyTextNodes(markupXml); // remove whitespace

  return markupXml;
}
function docProperties(imageId, name, content) {
  if (content.altText) {
    return `<wp:docPr id="${imageId}" name="${name}" descr="${content.altText}"/>`;
  }
  return `
        <wp:docPr id="${imageId}" name="${name}">
            <a:extLst xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
                <a:ext uri="{C183D7F6-B498-43B3-948B-1728B52AA6E4}">
                    <adec:decorative xmlns:adec="http://schemas.microsoft.com/office/drawing/2017/decorative" val="1"/>
                </a:ext>
            </a:extLst>
        </wp:docPr>
    `;
}
function pictureMarkup(imageId, relId, name, content) {
  // http://officeopenxml.com/drwPic.php

  // Legend:
  // nvPicPr - non-visual picture properties - id, name, etc.
  // blipFill - binary large image (or) picture fill - image size, image fill, etc.
  // spPr - shape properties - frame size, frame fill, etc.

  return `
        <pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
            <pic:nvPicPr>
                <pic:cNvPr id="${imageId}" name="${name}"/>
                <pic:cNvPicPr>
                    <a:picLocks noChangeAspect="1" noChangeArrowheads="1"/>
                </pic:cNvPicPr>
            </pic:nvPicPr>
            <pic:blipFill>
                <a:blip r:embed="${relId}">
                    ${transparencyMarkup(content.transparencyPercent)}
                    <a:extLst>
                        <a:ext uri="{28A0092B-C50C-407E-A947-70E740481C1C}">
                            <a14:useLocalDpi xmlns:a14="http://schemas.microsoft.com/office/drawing/2010/main" val="0"/>
                        </a:ext>
                    </a:extLst>
                </a:blip>
                <a:srcRect/>
                <a:stretch>
                    <a:fillRect/>
                </a:stretch>
            </pic:blipFill>
            <pic:spPr bwMode="auto">
                <a:xfrm>
                    <a:off x="0" y="0"/>
                    <a:ext cx="${pixelsToEmu(content.width)}" cy="${pixelsToEmu(content.height)}"/>
                </a:xfrm>
                <a:prstGeom prst="rect">
                    <a:avLst/>
                </a:prstGeom>
                <a:noFill/>
                <a:ln>
                    <a:noFill/>
                </a:ln>
            </pic:spPr>
        </pic:pic>
    `;
}
function transparencyMarkup(transparencyPercent) {
  if (transparencyPercent === null || transparencyPercent === undefined) {
    return '';
  }
  const alpha = transparencyPercentToAlpha(transparencyPercent);
  return `<a:alphaModFix amt="${alpha}" />`;
}

function updateImage(tag, drawingContainerNode, imageId, relId, content) {
  const inlineNode = xml.query.findByPath(drawingContainerNode, XmlNodeType.General, OmlNode.Wp.Inline);
  const floatingNode = xml.query.findByPath(drawingContainerNode, XmlNodeType.General, OmlNode.Wp.FloatingAnchor);
  const drawingNode = inlineNode || floatingNode;
  if (!inlineNode && !floatingNode) {
    throw new MalformedFileError("Invalid drawing container node. Expected inline or floating anchor node.");
  }
  const pictureNode = xml.query.findByPath(drawingNode, XmlNodeType.General, OmlNode.A.Graphic, OmlNode.A.GraphicData, OmlNode.Pic.Pic);
  if (!pictureNode) {
    throw new TemplateSyntaxError(`Invalid template syntax for image tag "${tag.rawText}". ` + `Please make sure the tag is placed in the alt text of an image placeholder.`);
  }

  // Set rel ID
  setRelId(pictureNode, relId);

  // Update non-visual properties
  updateNonVisualProps(drawingNode, pictureNode, imageId, content);

  // Update size
  updateSize(drawingNode, pictureNode, content);

  // Update transparency
  updateTransparency(pictureNode, content);
}
function setRelId(pictureNode, relId) {
  const blipNode = xml.query.findByPath(pictureNode, XmlNodeType.General, OmlNode.Pic.BlipFill, OmlNode.A.Blip);
  pictureNode.attributes["r:embed"] = relId;
  blipNode.attributes["r:embed"] = relId;
}
function updateNonVisualProps(drawingNode, pictureNode, imageId, content) {
  const docPrNode = xml.query.findByPath(drawingNode, XmlNodeType.General, OmlNode.Wp.DocPr);
  if (!docPrNode) {
    throw new MalformedFileError("Cannot find doc properties node.");
  }
  const nvPicPrNode = xml.query.findByPath(pictureNode, XmlNodeType.General, OmlNode.Pic.NvPicPr, OmlNode.Pic.CnVPr);
  if (!nvPicPrNode) {
    throw new MalformedFileError("Cannot find non-visual picture properties node.");
  }
  docPrNode.attributes["id"] = imageId.toString();
  nvPicPrNode.attributes["id"] = imageId.toString();
  const imageName = nameFromId(imageId);
  docPrNode.attributes["name"] = imageName;
  nvPicPrNode.attributes["name"] = imageName;
  if (content.altText) {
    docPrNode.attributes["descr"] = content.altText;
    nvPicPrNode.attributes["descr"] = content.altText;
  }
}
function updateSize(drawingNode, pictureNode, content) {
  if (typeof content.width !== 'number' && typeof content.height !== 'number') {
    return;
  }
  const drawingExtentNode = xml.query.findByPath(drawingNode, XmlNodeType.General, OmlNode.Wp.Extent);
  if (!drawingExtentNode) {
    throw new MalformedFileError("Cannot find drawing extent node.");
  }
  const pictureExtentNode = xml.query.findByPath(pictureNode, XmlNodeType.General, OmlNode.Pic.SpPr, OmlNode.Pic.Xfrm, OmlNode.Pic.Ext);
  if (!pictureExtentNode) {
    throw new MalformedFileError("Cannot find picture extent node.");
  }
  if (typeof content.width === 'number') {
    const widthEmu = pixelsToEmu(content.width);
    drawingExtentNode.attributes["cx"] = widthEmu.toString();
    pictureExtentNode.attributes["cx"] = widthEmu.toString();
  }
  if (typeof content.height === 'number') {
    const heightEmu = pixelsToEmu(content.height);
    drawingExtentNode.attributes["cy"] = heightEmu.toString();
    pictureExtentNode.attributes["cy"] = heightEmu.toString();
  }
}
function updateTransparency(pictureNode, content) {
  if (content.transparencyPercent === null || content.transparencyPercent === undefined) {
    return;
  }
  const blipNode = xml.query.findByPath(pictureNode, XmlNodeType.General, OmlNode.Pic.BlipFill, OmlNode.A.Blip);
  if (!blipNode) {
    throw new MalformedFileError("Cannot find blip node.");
  }
  let alphaNode = xml.query.findByPath(blipNode, XmlNodeType.General, OmlNode.A.AlphaModFix);

  // If the alpha node is not present, create it
  if (!alphaNode) {
    alphaNode = xml.create.generalNode(OmlNode.A.AlphaModFix, {
      attributes: {}
    });
    xml.modify.insertChild(blipNode, alphaNode, 0);
  }

  // Set the alpha value
  const alpha = transparencyPercentToAlpha(content.transparencyPercent);
  alphaNode.attributes["amt"] = alpha.toString();
}

const imageRe = new RegExp('^data:(image/.+);base64,(.+)$');
class ImagePlugin extends TemplatePlugin {
  contentType = 'image';
  async simpleTagReplacements(tag, data, context) {
    const content = data.getScopeData();
    if (!content || !content.source) {
      officeMarkup.modify.removeTag(tag);
      return;
    }
    if (typeof content.source === 'string') {
      const image = imageRe.exec(content.source);
      if (image) {
        content.source = Buffer.from(image[2], 'base64');
      }
    }

    // Add the image file into the archive
    const mediaFilePath = await context.docx.mediaFiles.add(content.source, content.format);
    const relType = MimeTypeHelper.getOfficeRelType(content.format);
    const relId = await context.currentPart.rels.add(mediaFilePath, relType);
    await context.docx.contentTypes.ensureContentType(content.format);

    // Generate a unique image ID
    const imageId = await this.getNextImageId(context);

    // For text tags, create xml markup from scratch
    if (tag.placement === TagPlacement.TextNode) {
      const imageXml = createImage(imageId, relId, content);
      const wordTextNode = officeMarkup.query.containingTextNode(tag.xmlTextNode);
      xml.modify.insertAfter(imageXml, wordTextNode);
    }

    // For attribute tags, modify the existing markup
    if (tag.placement === TagPlacement.Attribute) {
      const drawingNode = xml.query.findParentByName(tag.xmlNode, OmlNode.W.Drawing);
      if (!drawingNode) {
        throw new TemplateSyntaxError(`Cannot find placeholder image for tag "${tag.rawText}".`);
      }
      updateImage(tag, drawingNode, imageId, relId, content);
    }
    officeMarkup.modify.removeTag(tag);
  }
  async getNextImageId(context) {
    // Init plugin context.
    if (!context.pluginContext[this.contentType]) {
      context.pluginContext[this.contentType] = {};
    }
    const pluginContext = context.pluginContext[this.contentType];
    if (!pluginContext.lastDrawingObjectId) {
      pluginContext.lastDrawingObjectId = {};
    }
    const lastIdMap = pluginContext.lastDrawingObjectId;
    const lastIdKey = context.currentPart.path;

    // Get next image ID if already initialized.
    if (lastIdMap[lastIdKey]) {
      lastIdMap[lastIdKey]++;
      return lastIdMap[lastIdKey];
    }

    // Init next image ID.
    const partRoot = await context.currentPart.xmlRoot();
    const maxDepth = context.options.maxXmlDepth;

    // Get all existing doc props IDs
    const docProps = xml.query.descendants(partRoot, maxDepth, node => {
      return xml.query.isGeneralNode(node) && node.nodeName === OmlNode.Wp.DocPr;
    });

    // Start counting from the current max
    const ids = docProps.map(prop => parseInt(prop.attributes.id)).filter(isNumber);
    const maxId = Math.max(...ids, 0);
    lastIdMap[lastIdKey] = maxId + 1;
    return lastIdMap[lastIdKey];
  }
}

class LinkPlugin extends TemplatePlugin {
  contentType = 'link';
  async simpleTagReplacements(tag, data, context) {
    if (tag.placement !== TagPlacement.TextNode) {
      throw new TemplateSyntaxError(`Link tag "${tag.rawText}" must be placed in a text node but was placed in ${tag.placement}`);
    }
    const content = data.getScopeData();
    if (!content || !content.target) {
      officeMarkup.modify.removeTag(tag);
      return;
    }

    // Add rel
    const relId = await context.currentPart.rels.add(content.target, RelType.Link, 'External');

    // Generate markup
    const wordTextNode = officeMarkup.query.containingTextNode(tag.xmlTextNode);
    const wordRunNode = officeMarkup.query.containingRunNode(wordTextNode);
    const linkMarkup = this.generateMarkup(content, relId, wordRunNode);

    // Add to document
    this.insertHyperlinkNode(linkMarkup, wordRunNode, wordTextNode);
  }
  generateMarkup(content, relId, wordRunNode) {
    // http://officeopenxml.com/WPhyperlink.php

    let tooltip = '';
    if (content.tooltip) {
      tooltip += `w:tooltip="${content.tooltip}" `;
    }
    const markupText = `
            <w:hyperlink r:id="${relId}" ${tooltip}w:history="1">
                <w:r>
                    <w:rPr>
                        <w:rStyle w:val="Hyperlink"/>
                    </w:rPr>
                    <w:t>${content.text || content.target}</w:t>
                </w:r>
            </w:hyperlink>
        `;
    const markupXml = xml.parser.parse(markupText);
    xml.modify.removeEmptyTextNodes(markupXml); // remove whitespace

    // Copy props from original run node (preserve style)
    const runProps = xml.query.findChild(wordRunNode, officeMarkup.query.isRunPropertiesNode);
    if (runProps) {
      const linkRunProps = xml.create.cloneNode(runProps, true);
      markupXml.childNodes[0].childNodes.unshift(linkRunProps);
    }
    return markupXml;
  }
  insertHyperlinkNode(linkMarkup, tagRunNode, tagTextNode) {
    // Links are inserted at the 'run' level.
    // Therefor we isolate the link tag to it's own run (it is already
    // isolated to it's own text node), insert the link markup and remove
    // the run.
    let textNodesInRun = tagRunNode.childNodes.filter(node => officeMarkup.query.isTextNode(node));
    if (textNodesInRun.length > 1) {
      const [runBeforeTag] = xml.modify.splitByChild(tagRunNode, tagTextNode, true);
      textNodesInRun = runBeforeTag.childNodes.filter(node => officeMarkup.query.isTextNode(node));
      xml.modify.insertAfter(linkMarkup, runBeforeTag);
      if (textNodesInRun.length === 0) {
        xml.modify.remove(runBeforeTag);
      }
    }

    // Already isolated
    else {
      xml.modify.insertAfter(linkMarkup, tagRunNode);
      xml.modify.remove(tagRunNode);
    }
  }
}

class LoopListStrategy {
  isApplicable(openTag, closeTag, isCondition) {
    if (isCondition) {
      return false;
    }
    const containingParagraph = officeMarkup.query.containingParagraphNode(openTag.xmlTextNode);
    return officeMarkup.query.isListParagraph(containingParagraph);
  }
  splitBefore(openTag, closeTag) {
    const firstParagraph = officeMarkup.query.containingParagraphNode(openTag.xmlTextNode);
    const lastParagraph = officeMarkup.query.containingParagraphNode(closeTag.xmlTextNode);
    const paragraphsToRepeat = xml.query.siblingsInRange(firstParagraph, lastParagraph);

    // remove the loop tags
    xml.modify.remove(openTag.xmlTextNode);
    xml.modify.remove(closeTag.xmlTextNode);
    return {
      firstNode: firstParagraph,
      nodesToRepeat: paragraphsToRepeat,
      lastNode: lastParagraph
    };
  }
  mergeBack(paragraphGroups, firstParagraph, lastParagraphs) {
    for (const curParagraphsGroup of paragraphGroups) {
      for (const paragraph of curParagraphsGroup) {
        xml.modify.insertBefore(paragraph, lastParagraphs);
      }
    }

    // remove the old paragraphs
    xml.modify.remove(firstParagraph);
    if (firstParagraph !== lastParagraphs) {
      xml.modify.remove(lastParagraphs);
    }
  }
}

const LoopOver = Object.freeze({
  /**
   * Loop over the entire table row.
   */
  Row: 'row',
  /**
   * Loop over the entire table column.
   */
  Column: 'column',
  /**
   * Loop over the entire paragraph.
   */
  Paragraph: 'paragraph',
  /**
   * Loop over the content enclosed between the opening and closing tag.
   */
  Content: 'content'
});

class LoopParagraphStrategy {
  isApplicable(openTag, closeTag, isCondition) {
    const options = openTag.options;
    return options?.loopOver === LoopOver.Paragraph;
  }
  splitBefore(openTag, closeTag) {
    const firstParagraph = officeMarkup.query.containingParagraphNode(openTag.xmlTextNode);
    const lastParagraph = officeMarkup.query.containingParagraphNode(closeTag.xmlTextNode);
    const paragraphsToRepeat = xml.query.siblingsInRange(firstParagraph, lastParagraph);

    // Remove the loop tags.
    xml.modify.remove(openTag.xmlTextNode);
    xml.modify.remove(closeTag.xmlTextNode);
    return {
      firstNode: firstParagraph,
      nodesToRepeat: paragraphsToRepeat,
      lastNode: lastParagraph
    };
  }
  mergeBack(newParagraphs, firstParagraph, lastParagraph) {
    // Add new paragraphs to the document.
    let insertAfter = lastParagraph;
    for (const curParagraphsGroup of newParagraphs) {
      for (const paragraph of curParagraphsGroup) {
        xml.modify.insertAfter(paragraph, insertAfter);
        insertAfter = paragraph;
      }
    }

    // We cannot leave table cells completely empty, so we track them.
    // See: http://officeopenxml.com/WPtableCell.php
    const firstTableCell = officeMarkup.query.containingTableCellNode(firstParagraph);
    const lastTableCell = officeMarkup.query.containingTableCellNode(lastParagraph);

    // Remove old paragraphs - between first and last paragraph.
    xml.modify.removeSiblings(firstParagraph, lastParagraph);

    // Remove old paragraphs - first and last.
    xml.modify.remove(firstParagraph);
    if (firstParagraph !== lastParagraph) {
      xml.modify.remove(lastParagraph);
    }

    // Make sure the table cells are not empty (if they exist).
    if (newParagraphs.length === 0) {
      this.fillTableCell(firstTableCell);
      this.fillTableCell(lastTableCell);
    }
  }
  fillTableCell(tableCell) {
    if (tableCell && !tableCell.childNodes?.find(node => officeMarkup.query.isParagraphNode(node)) && !tableCell.childNodes?.find(node => officeMarkup.query.isTableNode(node))) {
      xml.modify.appendChild(tableCell, xml.create.generalNode(OmlNode.W.Paragraph));
    }
  }
}

class LoopContentStrategy {
  isApplicable(openTag, closeTag, isCondition) {
    return true;
  }
  splitBefore(openTag, closeTag) {
    // Gather some info
    let firstParagraph = officeMarkup.query.containingParagraphNode(openTag.xmlTextNode);
    let lastParagraph = officeMarkup.query.containingParagraphNode(closeTag.xmlTextNode);
    const areSame = firstParagraph === lastParagraph;

    // Split first paragraph
    const removeTextNode = true;
    let splitResult = officeMarkup.modify.splitParagraphByTextNode(firstParagraph, openTag.xmlTextNode, removeTextNode);
    firstParagraph = splitResult[0];
    let afterFirstParagraph = splitResult[1];
    if (areSame) lastParagraph = afterFirstParagraph;

    // Split last paragraph
    splitResult = officeMarkup.modify.splitParagraphByTextNode(lastParagraph, closeTag.xmlTextNode, removeTextNode);
    const beforeLastParagraph = splitResult[0];
    lastParagraph = splitResult[1];
    if (areSame) afterFirstParagraph = beforeLastParagraph;

    // Disconnect splitted paragraph from their parents
    xml.modify.remove(afterFirstParagraph);
    if (!areSame) xml.modify.remove(beforeLastParagraph);

    // Extract all paragraphs in between
    let middleParagraphs;
    if (areSame) {
      middleParagraphs = [afterFirstParagraph];
    } else {
      const inBetween = xml.modify.removeSiblings(firstParagraph, lastParagraph);
      middleParagraphs = [afterFirstParagraph].concat(inBetween).concat(beforeLastParagraph);
    }
    return {
      firstNode: firstParagraph,
      nodesToRepeat: middleParagraphs,
      lastNode: lastParagraph
    };
  }
  mergeBack(middleParagraphs, firstParagraph, lastParagraph) {
    let mergeTo = firstParagraph;
    for (const curParagraphsGroup of middleParagraphs) {
      // Merge first paragraphs
      officeMarkup.modify.joinParagraphs(mergeTo, curParagraphsGroup[0]);

      // Add middle and last paragraphs to the original document
      for (let i = 1; i < curParagraphsGroup.length; i++) {
        xml.modify.insertBefore(curParagraphsGroup[i], lastParagraph);
        mergeTo = curParagraphsGroup[i];
      }
    }

    // Merge last paragraph
    officeMarkup.modify.joinParagraphs(mergeTo, lastParagraph);

    // Remove the old last paragraph (was merged into the new one)
    xml.modify.remove(lastParagraph);
  }
}

class LoopTableColumnsStrategy {
  isApplicable(openTag, closeTag, isCondition) {
    const openCell = officeMarkup.query.containingTableCellNode(openTag.xmlTextNode);
    if (!openCell) return false;
    const closeCell = officeMarkup.query.containingTableCellNode(closeTag.xmlTextNode);
    if (!closeCell) return false;
    const options = openTag.options;
    const forceColumnLoop = options?.loopOver === LoopOver.Column;

    // If both tags are in the same cell, assume it's a paragraph loop (iterate content, not columns).
    if (!forceColumnLoop && openCell === closeCell) return false;
    const openTable = officeMarkup.query.containingTableNode(openCell);
    if (!openTable) return false;
    const closeTable = officeMarkup.query.containingTableNode(closeCell);
    if (!closeTable) return false;

    // If the tags are in different tables, don't apply this strategy.
    if (openTable !== closeTable) return false;
    const openRow = officeMarkup.query.containingTableRowNode(openCell);
    if (!openRow) return false;
    const closeRow = officeMarkup.query.containingTableRowNode(closeCell);
    if (!closeRow) return false;
    const openColumnIndex = this.getColumnIndex(openRow, openCell);
    if (openColumnIndex === -1) return false;
    const closeColumnIndex = this.getColumnIndex(closeRow, closeCell);
    if (closeColumnIndex === -1) return false;

    // If the tags are in different columns, assume it's a table rows loop (iterate rows, not columns).
    if (!forceColumnLoop && openColumnIndex !== closeColumnIndex) return false;
    return true;
  }
  splitBefore(openTag, closeTag) {
    const firstCell = officeMarkup.query.containingTableCellNode(openTag.xmlTextNode);
    const lastCell = officeMarkup.query.containingTableCellNode(closeTag.xmlTextNode);
    const firstRow = officeMarkup.query.containingTableRowNode(firstCell);
    const lastRow = officeMarkup.query.containingTableRowNode(lastCell);
    const firstColumnIndex = this.getColumnIndex(firstRow, firstCell);
    const lastColumnIndex = this.getColumnIndex(lastRow, lastCell);
    const table = officeMarkup.query.containingTableNode(firstCell);

    // Remove the loop tags
    xml.modify.remove(openTag.xmlTextNode);
    xml.modify.remove(closeTag.xmlTextNode);

    // Extract the columns to repeat.
    // This is a single synthetic table with the columns to repeat.
    const columnsWrapper = this.extractColumns(table, firstColumnIndex, lastColumnIndex);
    return {
      firstNode: firstCell,
      nodesToRepeat: [columnsWrapper],
      lastNode: lastCell
    };
  }
  mergeBack(columnsWrapperGroups, firstCell, lastCell) {
    const table = officeMarkup.query.containingTableNode(firstCell);
    const firstRow = officeMarkup.query.containingTableRowNode(firstCell);
    const firstColumnIndex = this.getColumnIndex(firstRow, firstCell);
    const lastRow = officeMarkup.query.containingTableRowNode(lastCell);
    const lastColumnIndex = this.getColumnIndex(lastRow, lastCell);
    let index = firstColumnIndex;
    for (const colWrapperGroup of columnsWrapperGroups) {
      if (colWrapperGroup.length !== 1) {
        throw new Error('Expected a single synthetic table as the columns wrapper.');
      }
      const colWrapper = colWrapperGroup[0];
      this.insertColumnAfterIndex(table, colWrapper, index);
      index++;
    }

    // Remove the old columns
    this.removeColumn(table, firstColumnIndex);
    if (firstColumnIndex !== lastColumnIndex) {
      this.removeColumn(table, lastColumnIndex + index);
    }
  }
  extractColumns(table, firstColumnIndex, lastColumnIndex) {
    // Create a synthetic table to hold the columns
    const syntheticTable = xml.create.generalNode('w:tbl');

    // For each row in the original table
    const rows = table.childNodes?.filter(node => node.nodeName === 'w:tr') || [];
    for (const row of rows) {
      const syntheticRow = xml.create.cloneNode(row, false);
      const cells = row.childNodes?.filter(node => node.nodeName === 'w:tc') || [];

      // Copy only the cells within our column range
      for (let i = firstColumnIndex; i <= lastColumnIndex; i++) {
        if (cells[i]) {
          xml.modify.appendChild(syntheticRow, xml.create.cloneNode(cells[i], true));
        }
      }
      xml.modify.appendChild(syntheticTable, syntheticRow);
    }
    return syntheticTable;
  }
  insertColumnAfterIndex(table, column, index) {
    // Get all rows from both tables
    const sourceRows = column.childNodes?.filter(node => node.nodeName === 'w:tr') || [];
    const targetRows = table.childNodes?.filter(node => node.nodeName === 'w:tr') || [];

    // Insert columns in the target table
    for (let i = 0; i < targetRows.length; i++) {
      const targetRow = targetRows[i];
      const sourceRow = sourceRows[i];
      if (!sourceRow || !targetRow) {
        continue;
      }

      // We expect exactly one cell per row in the synthetic source table
      const sourceCell = sourceRow.childNodes?.[0];
      if (!sourceCell) {
        throw new Error(`Cell not found in synthetic source table row ${i}.`);
      }
      const targetCell = this.getColumnByIndex(targetRow, index);
      const newCell = xml.create.cloneNode(sourceCell, true);
      if (targetCell) {
        xml.modify.insertAfter(newCell, targetCell);
      } else {
        xml.modify.appendChild(targetRow, newCell);
      }
    }
  }
  removeColumn(table, index) {
    const rows = table.childNodes?.filter(node => node.nodeName === 'w:tr') || [];
    for (const row of rows) {
      const cell = this.getColumnByIndex(row, index);
      if (!cell) {
        continue;
      }
      xml.modify.remove(cell);
    }
  }
  getColumnIndex(row, cell) {
    return row.childNodes?.filter(child => child.nodeName === 'w:tc')?.findIndex(child => child === cell);
  }
  getColumnByIndex(row, index) {
    return row.childNodes?.filter(child => child.nodeName === 'w:tc')?.[index];
  }
}

class LoopTableRowsStrategy {
  isApplicable(openTag, closeTag, isCondition) {
    const openCell = officeMarkup.query.containingTableCellNode(openTag.xmlTextNode);
    if (!openCell) return false;
    const closeCell = officeMarkup.query.containingTableCellNode(closeTag.xmlTextNode);
    if (!closeCell) return false;
    const options = openTag.options;
    const forceRowLoop = options?.loopOver === LoopOver.Row;

    // If both tags are in the same cell, assume it's a paragraph loop (iterate content, not rows).
    if (!forceRowLoop && openCell === closeCell) return false;
    return true;
  }
  splitBefore(openTag, closeTag) {
    const firstRow = officeMarkup.query.containingTableRowNode(openTag.xmlTextNode);
    const lastRow = officeMarkup.query.containingTableRowNode(closeTag.xmlTextNode);
    const firstTable = officeMarkup.query.containingTableNode(firstRow);
    const lastTable = officeMarkup.query.containingTableNode(lastRow);
    if (firstTable !== lastTable) {
      throw new TemplateSyntaxError(`Open and close tags are not in the same table: ${openTag.rawText} and ${closeTag.rawText}. Are you trying to repeat rows across adjacent or nested tables?`);
    }
    const rowsToRepeat = xml.query.siblingsInRange(firstRow, lastRow);

    // remove the loop tags
    xml.modify.remove(openTag.xmlTextNode);
    xml.modify.remove(closeTag.xmlTextNode);
    return {
      firstNode: firstRow,
      nodesToRepeat: rowsToRepeat,
      lastNode: lastRow
    };
  }
  mergeBack(rowGroups, firstRow, lastRow) {
    let insertAfter = lastRow;
    for (const curRowsGroup of rowGroups) {
      for (const row of curRowsGroup) {
        xml.modify.insertAfter(row, insertAfter);
        insertAfter = row;
      }
    }

    // Remove old rows - between first and last row
    xml.modify.removeSiblings(firstRow, lastRow);

    // Remove old rows - first and last rows
    xml.modify.remove(firstRow);
    if (firstRow !== lastRow) {
      xml.modify.remove(lastRow);
    }
  }
}

const LOOP_CONTENT_TYPE = 'loop';
class LoopPlugin extends TemplatePlugin {
  contentType = LOOP_CONTENT_TYPE;
  loopStrategies = [new LoopParagraphStrategy(), new LoopTableColumnsStrategy(), new LoopTableRowsStrategy(), new LoopListStrategy(), new LoopContentStrategy() // the default strategy
  ];
  setUtilities(utilities) {
    this.utilities = utilities;
  }
  async containerTagReplacements(tags, data, context) {
    let value = data.getScopeData();

    // Non array value - treat as a boolean condition.
    const isCondition = !Array.isArray(value);
    if (isCondition) {
      if (value) {
        value = [{}];
      } else {
        value = [];
      }
    }

    // Vars
    const openTag = tags[0];
    const closeTag = last(tags);
    if (openTag.placement !== TagPlacement.TextNode) {
      throw new TemplateSyntaxError(`Loop opening tag "${openTag.rawText}" must be placed in a text node but was placed in ${openTag.placement}`);
    }
    if (closeTag.placement !== TagPlacement.TextNode) {
      throw new TemplateSyntaxError(`Loop closing tag "${closeTag.rawText}" must be placed in a text node but was placed in ${closeTag.placement}`);
    }
    if (officeMarkup.query.containingStructuredTagContentNode(openTag.xmlTextNode)) {
      throw new TemplateSyntaxError(`Loop tag "${openTag.rawText}" cannot be placed inside a content control`);
    }
    if (officeMarkup.query.containingStructuredTagContentNode(closeTag.xmlTextNode)) {
      throw new TemplateSyntaxError(`Loop tag "${closeTag.rawText}" cannot be placed inside a content control`);
    }

    // Select the suitable strategy
    const loopStrategy = this.loopStrategies.find(strategy => strategy.isApplicable(openTag, closeTag, isCondition));
    if (!loopStrategy) throw new Error(`No loop strategy found for tag '${openTag.rawText}'.`);

    // Prepare to loop
    const {
      firstNode,
      nodesToRepeat,
      lastNode
    } = loopStrategy.splitBefore(openTag, closeTag);

    // Repeat (loop) the content
    const repeatedNodes = this.repeat(nodesToRepeat, value.length);

    // Recursive compilation
    // (this step can be optimized in the future if we'll keep track of the
    // path to each token and use that to create new tokens instead of
    // search through the text again)
    const compiledNodes = await this.compile(isCondition, repeatedNodes, data, context);

    // Merge back to the document
    loopStrategy.mergeBack(compiledNodes, firstNode, lastNode);
  }
  repeat(nodes, times) {
    if (!nodes.length || !times) return [];
    const allResults = [];
    for (let i = 0; i < times; i++) {
      const curResult = nodes.map(node => xml.create.cloneNode(node, true));
      allResults.push(curResult);
    }
    return allResults;
  }
  async compile(isCondition, nodeGroups, data, context) {
    const compiledNodeGroups = [];

    // Compile each node group with it's relevant data
    for (let i = 0; i < nodeGroups.length; i++) {
      // Create dummy root node
      const curNodes = nodeGroups[i];
      const dummyRootNode = xml.create.generalNode('dummyRootNode');
      curNodes.forEach(node => xml.modify.appendChild(dummyRootNode, node));

      // Compile the new root
      const conditionTag = this.updatePathBefore(isCondition, data, i);
      await this.utilities.compiler.compile(dummyRootNode, data, context);
      this.updatePathAfter(isCondition, data, conditionTag);

      // Disconnect from dummy root
      const curResult = [];
      while (dummyRootNode.childNodes && dummyRootNode.childNodes.length) {
        const child = xml.modify.removeChild(dummyRootNode, 0);
        curResult.push(child);
      }
      compiledNodeGroups.push(curResult);
    }
    return compiledNodeGroups;
  }
  updatePathBefore(isCondition, data, groupIndex) {
    // If it's a condition - don't go deeper in the path
    // (so we need to extract the already pushed condition tag)
    if (isCondition) {
      if (groupIndex > 0) {
        // should never happen - conditions should have at most one (synthetic) child...
        throw new Error(`Internal error: Unexpected group index ${groupIndex} for boolean condition at path "${data.pathString()}".`);
      }
      return data.pathPop();
    }

    // Else, it's an array - push the current index
    data.pathPush(groupIndex);
    return null;
  }
  updatePathAfter(isCondition, data, conditionTag) {
    // Reverse the "before" path operation
    if (isCondition) {
      data.pathPush(conditionTag);
    } else {
      data.pathPop();
    }
  }
}

class RawXmlPlugin extends TemplatePlugin {
  contentType = 'rawXml';
  simpleTagReplacements(tag, data) {
    if (tag.placement !== TagPlacement.TextNode) {
      throw new TemplateSyntaxError(`RawXml tag "${tag.rawText}" must be placed in a text node but was placed in ${tag.placement}`);
    }
    const value = data.getScopeData();
    const replaceNode = value?.replaceParagraph ? officeMarkup.query.containingParagraphNode(tag.xmlTextNode) : officeMarkup.query.containingTextNode(tag.xmlTextNode);
    if (typeof value?.xml === 'string' || Array.isArray(value?.xml) && value.xml.every(item => typeof item === "string")) {
      // Parse the xml content
      const xmlContent = Array.isArray(value.xml) ? value.xml.join('') : value.xml;
      const wrappedXml = `<root>${xmlContent}</root>`;
      const parsedRoot = xml.parser.parse(wrappedXml);

      // Insert the xml content
      const children = [...(parsedRoot.childNodes || [])];
      for (const child of children) {
        xml.modify.insertBefore(child, replaceNode);
      }
    }
    if (value?.replaceParagraph) {
      xml.modify.remove(replaceNode);
    } else {
      officeMarkup.modify.removeTag(tag);
    }
  }
}

const TEXT_CONTENT_TYPE = 'text';
class TextPlugin extends TemplatePlugin {
  contentType = TEXT_CONTENT_TYPE;

  /**
   * Replace the node text content with the specified value.
   */
  simpleTagReplacements(tag, data) {
    const value = data.getScopeData();
    const strValue = stringValue(value);
    if (tag.placement === TagPlacement.TextNode) {
      this.replaceInTextNode(tag, strValue);
      return;
    }
    if (tag.placement === TagPlacement.Attribute) {
      this.replaceInAttribute(tag, strValue);
      return;
    }
    const anyTag = tag;
    throw new TemplateSyntaxError(`Unexpected tag placement "${anyTag.placement}" for tag "${anyTag.rawText}".`);
  }
  replaceInTextNode(tag, text) {
    const lines = text.split('\n');
    if (lines.length < 2) {
      this.replaceSingleLine(tag, lines.length ? lines[0] : '');
    } else {
      this.replaceMultiLine(tag, lines);
    }
  }
  replaceInAttribute(tag, text) {
    // Set text
    tag.xmlNode.attributes[tag.attributeName] = tag.xmlNode.attributes[tag.attributeName].replace(tag.rawText, text);

    // Remove the attribute if it's empty
    if (!text) {
      officeMarkup.modify.removeTag(tag);
      return;
    }
  }
  replaceSingleLine(tag, text) {
    // Set text
    const textNode = tag.xmlTextNode;
    textNode.textContent = text;

    // Clean up if the text node is now empty
    if (!text) {
      officeMarkup.modify.removeTag(tag);
      return;
    }

    // Make sure leading and trailing whitespace are preserved
    const wordTextNode = officeMarkup.query.containingTextNode(textNode);
    officeMarkup.modify.setSpacePreserveAttribute(wordTextNode);
  }
  replaceMultiLine(tag, lines) {
    const textNode = tag.xmlTextNode;
    const runNode = officeMarkup.query.containingRunNode(textNode);
    const namespace = runNode.nodeName.split(':')[0];

    // First line
    const firstLine = lines[0];
    textNode.textContent = firstLine;

    // Other lines
    for (let i = 1; i < lines.length; i++) {
      // Add line break
      const lineBreak = this.getLineBreak(namespace);
      xml.modify.appendChild(runNode, lineBreak);

      // Add text
      if (lines[i]) {
        const lineNode = this.createOfficeTextNode(namespace, lines[i]);
        xml.modify.appendChild(runNode, lineNode);
      }
    }

    // Clean up if the original text node is now empty
    if (!firstLine) {
      officeMarkup.modify.removeTag(tag);
    }
  }
  getLineBreak(namespace) {
    return xml.create.generalNode(namespace + ':br');
  }
  createOfficeTextNode(namespace, text) {
    const wordTextNode = xml.create.generalNode(namespace + ':t');
    wordTextNode.attributes = {};
    officeMarkup.modify.setSpacePreserveAttribute(wordTextNode);
    wordTextNode.childNodes = [xml.create.textNode(text)];
    return wordTextNode;
  }
}

const chartTypes = Object.freeze({
  area3DChart: "c:area3DChart",
  areaChart: "c:areaChart",
  bar3DChart: "c:bar3DChart",
  barChart: "c:barChart",
  line3DChart: "c:line3DChart",
  lineChart: "c:lineChart",
  doughnutChart: "c:doughnutChart",
  ofPieChart: "c:ofPieChart",
  pie3DChart: "c:pie3DChart",
  pieChart: "c:pieChart",
  scatterChart: "c:scatterChart",
  bubbleChart: "c:bubbleChart"
});
// Section 18.8.30 of the ECMA-376 standard
// https://learn.microsoft.com/en-us/dotnet/api/documentformat.openxml.spreadsheet.numberingformat
// https://support.microsoft.com/en-us/office/number-format-codes-in-excel-for-mac-5026bbd6-04bc-48cd-bf33-80f18b4eae68
const formatIds = Object.freeze({
  "General": 0,
  "0": 1,
  "0.00": 2,
  "#,##0": 3,
  "#,##0.00": 4,
  "0%": 9,
  "0.00%": 10,
  "0.00E+00": 11,
  "# ?/?": 12,
  "# ??/?": 13,
  "mm-dd-yy": 14,
  "d-mmm-yy": 15,
  "d-mmm": 16,
  "mmm-yy": 17,
  "h:mm AM/PM": 18,
  "h:mm:ss AM/PM": 19,
  "h:mm": 20,
  "h:mm:ss": 21,
  "m/d/yy h:mm": 22,
  "#,##0 ;(#,##0)": 37,
  "#,##0 ;[Red](#,##0)": 38,
  "#,##0.00;(#,##0.00)": 39,
  "#,##0.00;[Red](#,##0.00)": 40,
  "mm:ss": 45,
  "[h]:mm:ss": 46,
  "mmss.0": 47,
  "##0.0E+0": 48,
  "@": 49
});
//
// Functions
//

function chartFriendlyName(chartType) {
  const name = chartType.replace("c:", "").replace("Chart", "");
  return name.charAt(0).toUpperCase() + name.slice(1);
}
function isStandardChartType(chartType) {
  return chartType === chartTypes.area3DChart || chartType === chartTypes.areaChart || chartType === chartTypes.bar3DChart || chartType === chartTypes.barChart || chartType === chartTypes.line3DChart || chartType === chartTypes.lineChart || chartType === chartTypes.doughnutChart || chartType === chartTypes.ofPieChart || chartType === chartTypes.pie3DChart || chartType === chartTypes.pieChart;
}
function isScatterChartType(chartType) {
  return chartType === chartTypes.scatterChart;
}
function isBubbleChartType(chartType) {
  return chartType === chartTypes.bubbleChart;
}
function isStandardChartData(chartData) {
  return "categories" in chartData;
}
function isScatterChartData(chartData) {
  // Simple, but until we have additional ChartData types, it's enough
  return !isStandardChartData(chartData) && "series" in chartData;
}
function isBubbleChartData(chartData) {
  if (!isScatterChartData(chartData)) {
    return false;
  }
  return chartData.series.some(ser => ser.values.some(val => "size" in val));
}
function isStringCategories(categories) {
  const first = categories.names[0];
  return typeof first === "string";
}
function isDateCategories(categories) {
  const first = categories.names[0];
  return first instanceof Date;
}
function formatCode(categories) {
  if (isStringCategories(categories)) {
    return "General";
  }
  if (isDateCategories(categories)) {
    return categories.formatCode ?? "mm-dd-yy";
  }
  return categories.formatCode ?? "General";
}
function scatterXValues(series) {
  const uniqueXValues = new Set();
  for (const ser of series) {
    for (const val of ser.values) {
      uniqueXValues.add(val.x);
    }
  }
  return Array.from(uniqueXValues).sort((a, b) => a - b);
}
function scatterYValues(xValues, series) {
  const yValuesMap = {};
  for (const val of series.values) {
    yValuesMap[val.x] = val.y;
  }
  return xValues.map(x => yValuesMap[x]);
}
function bubbleSizeValues(xValues, series) {
  const sizeValuesMap = {};
  for (const val of series.values) {
    sizeValuesMap[val.x] = val.size;
  }
  return xValues.map(x => sizeValuesMap[x]);
}

class ChartColors {
  static async load(chartPart) {
    const colors = new ChartColors(chartPart);
    await colors.init();
    return colors;
  }
  initialized = false;
  constructor(chartPart) {
    this.chartPart = chartPart;
  }
  setSeriesColor(chartType, seriesNode, isNewSeries, color) {
    if (!this.initialized) {
      throw new Error("Chart colors not initialized");
    }
    if (!seriesNode) {
      return;
    }
    let colorRoot;
    if (chartType === chartTypes.scatterChart) {
      // Controls the color of the marker - the dot in the scatter chart
      colorRoot = seriesNode.childNodes?.find(child => child.nodeName === "c:marker");
    } else {
      // Controls the color of the shape - line, bar, bubble, etc.
      colorRoot = seriesNode.childNodes?.find(child => child.nodeName === "c:spPr");
    }
    if (!colorRoot) {
      return;
    }
    this.recurseSetColor(colorRoot, isNewSeries, color);
  }
  recurseSetColor(node, isNewSeries, color) {
    if (!node) {
      return;
    }

    // Was accent color (auto-selected color)
    if (node.nodeName == "a:schemeClr" && /accent\d+/.test(node.attributes?.["val"] ?? "")) {
      // New color is a number (auto-select color by accent index)
      // Only auto-select the color if it's a new series, otherwise keep the existing color
      if (typeof color === "number" && isNewSeries) {
        this.setAccentColor(node, color);
        return;
      }

      // New color is a string (apply the user-selected hex color)
      if (typeof color === "string") {
        node.nodeName = "a:srgbClr";
        node.attributes["val"] = color;
        node.childNodes = [];
        return;
      }
      return;
    }

    // Was srgb color (user-defined color)
    if (node.nodeName == "a:srgbClr") {
      if (typeof color === "string") {
        node.attributes["val"] = color;
      }
      return;
    }
    for (const child of node.childNodes ?? []) {
      this.recurseSetColor(child, isNewSeries, color);
    }
  }
  setAccentColor(currentNode, seriesIndex) {
    const colorConfig = this.getAccentColorConfig(seriesIndex);
    currentNode.attributes["val"] = colorConfig.name;
    if (colorConfig.lumMod) {
      let lumModeNode = currentNode.childNodes?.find(child => child.nodeName === "a:lumMod");
      if (!lumModeNode) {
        lumModeNode = xml.create.generalNode("a:lumMod", {
          attributes: {}
        });
        xml.modify.appendChild(currentNode, lumModeNode);
      }
      lumModeNode.attributes["val"] = colorConfig.lumMod;
    } else {
      const lumModeNode = currentNode.childNodes?.find(child => child.nodeName === "a:lumMod");
      if (lumModeNode) {
        xml.modify.removeChild(currentNode, lumModeNode);
      }
    }
    if (colorConfig.lumOff) {
      let lumOffNode = currentNode.childNodes?.find(child => child.nodeName === "a:lumOff");
      if (!lumOffNode) {
        lumOffNode = xml.create.generalNode("a:lumOff", {
          attributes: {}
        });
        xml.modify.appendChild(currentNode, lumOffNode);
      }
      lumOffNode.attributes["val"] = colorConfig.lumOff;
    } else {
      const lumOffNode = currentNode.childNodes?.find(child => child.nodeName === "a:lumOff");
      if (lumOffNode) {
        xml.modify.removeChild(currentNode, lumOffNode);
      }
    }
  }
  getAccentColorConfig(seriesIndex) {
    const accent = this.accents[seriesIndex % this.accents.length];
    let variation;
    if (seriesIndex < this.accents.length) {
      variation = null;
    } else {
      const variationIndex = Math.floor(seriesIndex / this.accents.length) % this.variations.length;
      variation = this.variations[variationIndex];
    }
    return {
      name: accent,
      lumMod: variation?.lumMod,
      lumOff: variation?.lumOff
    };
  }
  async init() {
    if (this.initialized) {
      return;
    }
    const colorsPart = await this.chartPart.getFirstPartByType(RelType.ChartColors);
    if (!colorsPart) {
      this.initialized = true;
      return;
    }
    const root = await colorsPart.xmlRoot();
    const accents = root.childNodes?.filter(child => child.nodeName === "a:schemeClr")?.map(node => node.attributes["val"]);
    const variations = root.childNodes?.filter(child => child.nodeName === "cs:variation")?.map(node => {
      if (!node.childNodes?.length) {
        return null;
      }
      const lumModNode = node.childNodes.find(n => n.nodeName === "a:lumMod");
      const lumOffNode = node.childNodes.find(n => n.nodeName === "a:lumOff");
      return {
        lumMod: lumModNode?.attributes["val"],
        lumOff: lumOffNode?.attributes["val"]
      };
    }).filter(Boolean);
    this.accents = accents;
    this.variations = variations;
    this.initialized = true;
  }
}

function validateChartData(chartType, chartData) {
  if (isStandardChartType(chartType)) {
    validateStandardChartData(chartData, chartType);
    return;
  }
  if (isScatterChartType(chartType)) {
    validateScatterChartData(chartData, chartType);
    return;
  }
  if (isBubbleChartType(chartType)) {
    validateScatterChartData(chartData, chartType);
    validateBubbleChartData(chartData, chartType);
    return;
  }
  throw new TemplateDataError("Invalid chart data: " + JSON.stringify(chartData));
}
function validateStandardChartData(chartData, chartType) {
  if (!chartData.categories) {
    throw new TemplateDataError(`${chartFriendlyName(chartType)} chart must have categories.`);
  }
  if (!chartData.categories.names) {
    throw new TemplateDataError(`${chartFriendlyName(chartType)} chart categories must have a "names" field.`);
  }
  for (const ser of chartData.series) {
    if (!ser.values) {
      throw new TemplateDataError(`${chartFriendlyName(chartType)} chart series must have a "values" field.`);
    }

    // Check if the series values and category names have the same length (same number of x and y values)
    if (ser.values.length != chartData.categories.names.length) {
      throw new TemplateDataError(`${chartFriendlyName(chartType)} chart series values and category names must have the same length.`);
    }

    // Verify series values are numbers
    for (const val of ser.values) {
      if (val === null || val === undefined) {
        continue;
      }
      if (typeof val === "number") {
        continue;
      }
      throw new TemplateDataError(`${chartFriendlyName(chartType)} chart series values must be numbers.`);
    }
  }
}
function validateScatterChartData(chartData, chartType) {
  if (!chartData.series) {
    throw new TemplateDataError(`${chartFriendlyName(chartType)} chart must have series.`);
  }
  for (const ser of chartData.series) {
    if (!ser.values) {
      throw new TemplateDataError(`${chartFriendlyName(chartType)} chart series must have a "values" field.`);
    }
    for (const val of ser.values) {
      // Verify series values are valid point objects
      if (typeof val === "object" && "x" in val && "y" in val) {
        continue;
      }
      throw new TemplateDataError(`${chartFriendlyName(chartType)} chart series values must have x and y properties.`);
    }
  }
}
function validateBubbleChartData(chartData, chartType) {
  for (const ser of chartData.series) {
    for (const val of ser.values) {
      // Verify series points have a "size" property (x and y are checked in validateScatterChartData)
      if (typeof val === "object" && "size" in val) {
        continue;
      }
      throw new TemplateDataError(`${chartFriendlyName(chartType)} chart series values must have a "size" property.`);
    }
  }
}

// Based on: https://github.com/OpenXmlDev/Open-Xml-PowerTools/blob/vNext/OpenXmlPowerTools/ChartUpdater.cs

const space = " ";
const xValuesTitle = "X-Values";
async function updateChart(chartPart, chartData) {
  // Normalize the chart data:
  // Shallow clone and make sure series names are set.
  chartData = Object.assign({}, chartData);
  for (let i = 0; i < chartData.series.length; i++) {
    const ser = chartData.series[i];
    chartData.series[i] = Object.assign({}, ser);
    chartData.series[i].name = seriesName(ser.name, i);
  }

  // Get the chart node
  const root = await chartPart.xmlRoot();
  if (root.nodeName !== "c:chartSpace") {
    throw new MalformedFileError(`Unexpected chart root node "${root.nodeName}"`);
  }
  const chartWrapperNode = root.childNodes?.find(child => child.nodeName === "c:chart");
  if (!chartWrapperNode) {
    throw new MalformedFileError("Chart node not found");
  }
  const plotAreaNode = chartWrapperNode.childNodes?.find(child => child.nodeName === "c:plotArea");
  if (!plotAreaNode) {
    throw new MalformedFileError("Plot area node not found");
  }
  const chartNode = plotAreaNode.childNodes?.find(child => Object.values(chartTypes).includes(child.nodeName));
  if (!chartNode) {
    const plotAreaChildren = plotAreaNode.childNodes?.map(child => `<${child.nodeName}>`);
    const supportedChartTypes = Object.values(chartTypes).join(", ");
    throw new TemplateSyntaxError(`Unsupported chart type. Plot area children: ${plotAreaChildren?.join(", ")}. Supported chart types: ${supportedChartTypes}`);
  }
  const chartType = chartNode.nodeName;

  // Input validation
  validateChartData(chartType, chartData);

  // Assemble the existing chart information
  const existingSeries = readExistingSeries(chartNode, chartData);
  const sheetName = existingSeries.map(ser => ser.sheetName).filter(Boolean)?.[0];
  const colors = await ChartColors.load(chartPart);
  const existingChart = {
    chartPart,
    chartNode,
    chartType,
    sheetName,
    colors,
    series: existingSeries
  };

  // Update embedded worksheet
  await updateEmbeddedExcelFile(existingChart, chartData);

  // Update inline series
  updateInlineSeries(existingChart, chartData);
}

//
// Read the first series
//

function readExistingSeries(chartNode, chartData) {
  const series = chartNode.childNodes?.filter(child => child.nodeName === "c:ser");
  return series.map(ser => readSingleSeries(ser, chartData));
}
function readSingleSeries(seriesNode, chartData) {
  const sheetName = getSheetName(seriesNode);
  const shapeProperties = seriesNode?.childNodes?.find(child => child.nodeName === "c:spPr");
  const chartExtensibility = seriesNode?.childNodes?.find(child => child.nodeName === "c:extLst");
  const formatCode = seriesNode?.childNodes?.find(child => child.nodeName === "c:cat")?.childNodes?.find(child => child.nodeName === "c:numRef")?.childNodes?.find(child => child.nodeName === "c:numCache")?.childNodes?.find(child => child.nodeName === "c:formatCode")?.childNodes?.find(child => xml.query.isTextNode(child))?.textContent;
  return {
    sheetName,
    shapePropertiesMarkup: xml.parser.serializeNode(shapeProperties),
    chartSpecificMarkup: chartSpecificMarkup(seriesNode),
    categoriesMarkup: categoriesMarkup(chartData, sheetName, formatCode),
    chartExtensibilityMarkup: xml.parser.serializeNode(chartExtensibility)
  };
}
function getSheetName(firstSeries) {
  if (!firstSeries) {
    return null;
  }
  const formulaNode = firstSeries?.childNodes?.find(child => child.nodeName === "c:tx")?.childNodes?.find(child => child.nodeName === "c:strRef")?.childNodes?.find(child => child.nodeName === "c:f");
  const formula = xml.query.lastTextChild(formulaNode, false);
  if (!formula) {
    return null;
  }
  return formula.textContent?.split('!')[0];
}
function categoriesMarkup(chartData, sheetName, firstSeriesFormatCode) {
  if (isScatterChartData(chartData)) {
    return scatterXValuesMarkup(chartData, sheetName);
  }
  return standardCategoriesMarkup(chartData, sheetName, firstSeriesFormatCode);
}
function standardCategoriesMarkup(chartData, sheetName, firstSeriesFormatCode) {
  function getCategoryName(name) {
    if (name instanceof Date) {
      return excelDateValue(name);
    }
    return name;
  }
  const ptNodes = `
        <c:ptCount val="${chartData.categories.names.length}"/>
        ${chartData.categories.names.map((name, index) => `
            <c:pt idx="${index}">
                <c:v>${getCategoryName(name)}</c:v>
            </c:pt>
        `).join("\n")}
    `;
  if (!sheetName) {
    // String literal
    if (isStringCategories(chartData.categories)) {
      return `
                <c:cat>
                    <c:strLit>
                        ${ptNodes}
                    </c:strLit>
                </c:cat>
            `;
    }

    // Number literal
    return `
            <c:cat>
                <c:numLit>
                    ${ptNodes}
                </c:numLit>
            </c:cat>
        `;
  }
  const formula = `${sheetName}!$A$2:$A$${chartData.categories.names.length + 1}`;

  // String reference
  if (isStringCategories(chartData.categories)) {
    return `
            <c:cat>
                <c:strRef>
                    <c:f>${formula}</c:f>
                    <c:strCache>
                        ${ptNodes}
                    </c:strCache>
                </c:strRef>
            </c:cat>
        `;
  }

  // Number reference
  const formatCodeValue = chartData.categories.formatCode ? formatCode(chartData.categories) : firstSeriesFormatCode ?? formatCode(chartData.categories);
  return `
        <c:cat>
            <c:numRef>
                <c:f>${formula}</c:f>
                <c:numCache>
                    <c:formatCode>${formatCodeValue}</c:formatCode>
                    ${ptNodes}
                </c:numCache>
            </c:numRef>
        </c:cat>
    `;
}
function scatterXValuesMarkup(chartData, sheetName) {
  const xValues = scatterXValues(chartData.series);
  const ptNodes = `
        <c:ptCount val="${xValues.length}"/>
        ${xValues.map((x, index) => `
            <c:pt idx="${index}">
                <c:v>${x}</c:v>
            </c:pt>
        `).join("\n")}
    `;

  // Number literal
  if (!sheetName) {
    return `
            <c:xVal>
                <c:numLit>
                    ${ptNodes}
                </c:numLit>
            </c:xVal>
        `;
  }
  const formula = `${sheetName}!$A$2:$A$${xValues.length + 1}`;

  // Number reference
  return `
        <c:xVal>
            <c:numRef>
                <c:f>${formula}</c:f>
                <c:numCache>
                    <c:formatCode>General</c:formatCode>
                    ${ptNodes}
                </c:numCache>
            </c:numRef>
        </c:xVal>
    `;
}
function chartSpecificMarkup(firstSeries) {
  if (!firstSeries) {
    return "";
  }
  const pictureOptions = firstSeries.childNodes?.find(child => child.nodeName === "c:pictureOptions");
  const dLbls = firstSeries.childNodes?.find(child => child.nodeName === "c:dLbls");
  const trendline = firstSeries.childNodes?.find(child => child.nodeName === "c:trendline");
  const errBars = firstSeries.childNodes?.find(child => child.nodeName === "c:errBars");
  const invertIfNegative = firstSeries.childNodes?.find(child => child.nodeName === "c:invertIfNegative");
  const marker = firstSeries.childNodes?.find(child => child.nodeName === "c:marker");
  const smooth = firstSeries.childNodes?.find(child => child.nodeName === "c:smooth");
  const explosion = firstSeries.childNodes?.find(child => child.nodeName === "c:explosion");
  const dPt = firstSeries.childNodes?.filter(child => child.nodeName === "c:dPt");
  const firstSliceAngle = firstSeries.childNodes?.find(child => child.nodeName === "c:firstSliceAngle");
  const holeSize = firstSeries.childNodes?.find(child => child.nodeName === "c:holeSize");
  const serTx = firstSeries.childNodes?.find(child => child.nodeName === "c:serTx");
  return `
        ${xml.parser.serializeNode(pictureOptions)}
        ${xml.parser.serializeNode(dLbls)}
        ${xml.parser.serializeNode(trendline)}
        ${xml.parser.serializeNode(errBars)}
        ${xml.parser.serializeNode(invertIfNegative)}
        ${xml.parser.serializeNode(marker)}
        ${xml.parser.serializeNode(smooth)}
        ${xml.parser.serializeNode(explosion)}
        ${dPt.map(dPt => xml.parser.serializeNode(dPt)).join("\n")}
        ${xml.parser.serializeNode(firstSliceAngle)}
        ${xml.parser.serializeNode(holeSize)}
        ${xml.parser.serializeNode(serTx)}
    `;
}

//
// Update inline series
//

function updateInlineSeries(existingChart, chartData) {
  // Remove all old series
  xml.modify.removeChildren(existingChart.chartNode, child => child.nodeName === "c:ser");

  // Create new series
  const newSeries = chartData.series.map((s, index) => createSeries(existingChart, s.name, index, chartData));
  for (const series of newSeries) {
    xml.modify.appendChild(existingChart.chartNode, series);
  }
}
function createSeries(existingChart, seriesName, seriesIndex, chartData) {
  const firstSeries = existingChart.series[0];
  const isNewSeries = !existingChart.series[seriesIndex];
  const existingSeries = existingChart.series[seriesIndex] ?? firstSeries;
  const title = titleMarkup(seriesName, seriesIndex, existingSeries?.sheetName);
  const values = valuesMarkup(seriesIndex, chartData, existingSeries?.sheetName);
  const series = parseXmlNode(`
        <c:ser>
            <c:idx val="${seriesIndex}"/>
            <c:order val="${seriesIndex}"/>
            ${title}
            ${existingSeries?.shapePropertiesMarkup ?? ""}
            ${existingSeries?.chartSpecificMarkup ?? ""}
            ${existingSeries?.categoriesMarkup ?? ""}
            ${values}
            ${existingSeries?.chartExtensibilityMarkup ?? ""}
        </c:ser>
    `);
  const color = selectSeriesColor(seriesIndex, chartData);
  existingChart.colors.setSeriesColor(existingChart.chartType, series, isNewSeries, color);
  return series;
}
function titleMarkup(seriesName, seriesIndex, sheetName) {
  if (!sheetName) {
    return `
            <c:tx>
                <c:v>${seriesName}</c:v>
            </c:tx>
        `;
  }
  const formula = `${sheetName}!$${excelColumnId(seriesIndex + 1)}$1`;
  return `
        <c:tx>
            <c:strRef>
                <c:f>${formula}</c:f>
                <c:strCache>
                    <c:ptCount val="1"/>
                    <c:pt idx="0">
                        <c:v>${seriesName}</c:v>
                    </c:pt>
                </c:strCache>
            </c:strRef>
        </c:tx>
    `;
}
function valuesMarkup(seriesIndex, chartData, sheetName) {
  if (isScatterChartData(chartData)) {
    return scatterValuesMarkup(seriesIndex, chartData, sheetName);
  }
  return standardValuesMarkup(seriesIndex, chartData, sheetName);
}
function standardValuesMarkup(seriesIndex, chartData, sheetName) {
  if (!sheetName) {
    // Number literal
    return `
            <c:val>
                <c:numLit>
                    <c:ptCount val="${chartData.categories.names.length}" />
                    ${chartData.categories.names.map((name, catIndex) => `
                        <c:pt idx="${catIndex}">
                            <c:v>${chartData.series[seriesIndex].values[catIndex]}</c:v>
                        </c:pt>
                    `).join("\n")}
                </c:numLit>
            </c:val>
        `;
  }

  // Number reference
  const columnId = excelColumnId(seriesIndex + 1);
  const formula = `${sheetName}!$${columnId}$2:$${columnId}$${chartData.categories.names.length + 1}`;
  return `
        <c:val>
            <c:numRef>
                <c:f>${formula}</c:f>
                <c:numCache>
                    <c:formatCode>General</c:formatCode>
                    <c:ptCount val="${chartData.categories.names.length}" />
                        ${chartData.categories.names.map((name, catIndex) => `
                            <c:pt idx="${catIndex}">
                                <c:v>${chartData.series[seriesIndex].values[catIndex]}</c:v>
                        </c:pt>
                    `).join("\n")}
                </c:numCache>
            </c:numRef>
        </c:val>
    `;
}
function scatterValuesMarkup(seriesIndex, chartData, sheetName) {
  const xValues = scatterXValues(chartData.series);
  const yValues = scatterYValues(xValues, chartData.series[seriesIndex]);
  const ptCountNode = `
        <c:ptCount val="${yValues.length}"/>
    `;

  // Y values
  const yValueNodes = yValues.map((y, index) => {
    if (y === null || y === undefined) {
      return "";
    }
    return `
            <c:pt idx="${index}">
                <c:v>${y}</c:v>
            </c:pt>
        `;
  });

  // Bubble size values
  const bubbleSizeNodes = isBubbleChartData(chartData) ? chartData.series[seriesIndex].values.map((v, index) => {
    if (v.size === null || v.size === undefined) {
      return "";
    }
    return `
            <c:pt idx="${index}">
                <c:v>${v.size}</c:v>
            </c:pt>
        `;
  }) : [];

  // Number literal
  if (!sheetName) {
    const yVal = `
            <c:yVal>
                <c:numLit>
                    ${ptCountNode}
                    ${yValueNodes.join("\n")}
                </c:numLit>
            </c:yVal>
        `;
    if (!isBubbleChartData(chartData)) {
      return yVal;
    }
    const bubbleSize = `
            <c:bubbleSize>
                <c:numLit>
                    ${ptCountNode}
                    ${bubbleSizeNodes.join("\n")}
                </c:numLit>
            </c:bubbleSize>
        `;
    return `
            ${yVal}
            ${bubbleSize}
        `;
  }

  // Number reference

  const yValColumnId = excelColumnId(seriesIndex + 1);
  const yValFormula = `${sheetName}!$${yValColumnId}$2:$${yValColumnId}$${yValues.length + 1}`;
  const yVal = `
        <c:yVal>
            <c:numRef>
                <c:f>${yValFormula}</c:f>
                <c:numCache>
                    <c:formatCode>General</c:formatCode>
                    ${ptCountNode}
                    ${yValueNodes.join("\n")}
                </c:numCache>
            </c:numRef>
        </c:yVal>
    `;
  if (!isBubbleChartData(chartData)) {
    return yVal;
  }
  const bubbleSizeColumnId = excelColumnId(seriesIndex + 2);
  const bubbleSizeFormula = `${sheetName}!$${bubbleSizeColumnId}$2:$${bubbleSizeColumnId}$${yValues.length + 1}`;
  const bubbleSize = `
        <c:bubbleSize>
            <c:numRef>
                <c:f>${bubbleSizeFormula}</c:f>
                <c:numCache>
                    <c:formatCode>General</c:formatCode>
                    ${ptCountNode}
                    ${bubbleSizeNodes.join("\n")}
                </c:numCache>
            </c:numRef>
        </c:bubbleSize>
    `;
  return `
        ${yVal}
        ${bubbleSize}
    `;
}
function selectSeriesColor(seriesIndex, chartData) {
  // Use manual hex color
  const color = chartData.series[seriesIndex].color?.trim();
  if (color) {
    const hex = color.startsWith("#") ? color.slice(1) : color;
    return hex.toUpperCase();
  }

  // Auto-select accent color
  return seriesIndex;
}

//
// Update the embedded Excel workbook file
//

async function updateEmbeddedExcelFile(existingChart, chartData) {
  // Get the relation ID of the embedded Excel file
  const rootNode = await existingChart.chartPart.xmlRoot();
  const externalDataNode = rootNode.childNodes?.find(child => child.nodeName === "c:externalData");
  const workbookRelId = externalDataNode?.attributes["r:id"];
  if (!workbookRelId) {
    return;
  }

  // Open the embedded Excel file
  const xlsxPart = await existingChart.chartPart.getPartById(workbookRelId);
  if (!xlsxPart) {
    return;
  }
  const xlsxBinary = await xlsxPart.getContentBinary();
  const xlsx = await Xlsx.load(xlsxBinary);

  // Update the workbook
  const workbookPart = xlsx.mainDocument;
  const sharedStrings = await updateSharedStringsPart(workbookPart, chartData);
  const sheetPart = await updateSheetPart(workbookPart, existingChart.sheetName, sharedStrings, chartData);
  if (sheetPart) {
    await updateTablePart(sheetPart, chartData);
  }
  await workbookPart.save();

  // Save the Excel file
  const newXlsxBinary = await xlsx.export();
  await xlsxPart.save(newXlsxBinary);
}
async function updateSharedStringsPart(workbookPart, chartData) {
  // Get the shared strings part
  const sharedStringsPart = await workbookPart.getFirstPartByType(RelType.SharedStrings);
  if (!sharedStringsPart) {
    return {};
  }

  // Get the shared strings part root
  const root = await sharedStringsPart.xmlRoot();

  // Remove all existing strings
  root.childNodes = [];
  let count = 0;
  const sharedStrings = {};
  function addString(str) {
    xml.modify.appendChild(root, xml.create.generalNode("si", {
      childNodes: [xml.create.generalNode("t", {
        attributes: {
          [OmlAttribute.SpacePreserve]: "preserve"
        },
        childNodes: [xml.create.textNode(str)]
      })]
    }));
    sharedStrings[str] = count;
    count++;
  }

  // Default strings
  if (isStandardChartData(chartData)) {
    addString(space);
  }
  if (isScatterChartData(chartData)) {
    addString(xValuesTitle);
  }

  // Category strings
  if (isStandardChartData(chartData) && isStringCategories(chartData.categories)) {
    for (const name of chartData.categories.names) {
      addString(name);
    }
  }

  // Series strings
  for (const name of chartData.series.map(s => s.name)) {
    addString(name);
    if (isBubbleChartData(chartData)) {
      addString(name + " Size");
    }
  }

  // Update attributes
  root.attributes["count"] = count.toString();
  root.attributes["uniqueCount"] = count.toString();
  return sharedStrings;
}
async function updateSheetPart(workbookPart, sheetName, sharedStrings, chartData) {
  // Get the sheet rel ID
  const root = await workbookPart.xmlRoot();
  const sheetNode = root.childNodes?.find(child => child.nodeName === "sheets")?.childNodes?.find(child => child.nodeName === "sheet" && child.attributes["name"] == sheetName);
  const sheetRelId = sheetNode?.attributes["r:id"];
  if (!sheetRelId) {
    return null;
  }

  // Get the sheet part
  const sheetPart = await workbookPart.getPartById(sheetRelId);
  if (!sheetPart) {
    return null;
  }
  const sheetRoot = await sheetPart.xmlRoot();
  let newRows = [];
  if (isStandardChartData(chartData)) {
    newRows = await updateSheetRootStandard(workbookPart, sheetRoot, chartData, sharedStrings);
  } else if (isScatterChartData(chartData)) {
    newRows = await updateSheetRootScatter(workbookPart, sheetRoot, chartData, sharedStrings);
  }

  // Replace sheet data
  const sheetDataNode = sheetRoot.childNodes?.find(child => child.nodeName === "sheetData");
  sheetDataNode.childNodes = [];
  for (const row of newRows) {
    xml.modify.appendChild(sheetDataNode, row);
  }
  return sheetPart;
}
async function updateSheetRootStandard(workbookPart, sheetRoot, chartData, sharedStrings) {
  // Create first row
  const firstRow = `
        <row r="1" spans="1:${chartData.series.length + 1}">
            <c r="A1" t="s">
                <v>${sharedStrings[space]}</v>
            </c>
            ${chartData.series.map((s, index) => `
                <c r="${excelRowAndColumnId(0, index + 1)}" t="s">
                    <v>${sharedStrings[s.name]}</v>
                </c>
            `).join("\n")}
        </row>
    `;

  // Create other rows
  const categoryDataTypeAttribute = isStringCategories(chartData.categories) ? ` t="s"` : "";
  const categoryStyleIdAttribute = await updateStylesPart(workbookPart, sheetRoot, chartData.categories);
  function getCategoryName(name) {
    if (name instanceof Date) {
      return excelDateValue(name);
    }
    if (typeof name === "string") {
      return sharedStrings[name];
    }
    return name;
  }
  const otherRows = chartData.categories.names.map((name, rowIndex) => `
        <row r="${rowIndex + 2}" spans="1:${chartData.series.length + 1}">
            <c r="${excelRowAndColumnId(rowIndex + 1, 0)}"${categoryDataTypeAttribute}${categoryStyleIdAttribute}>
                <v>${getCategoryName(name)}</v>
            </c>
            ${chartData.series.map((s, columnIndex) => `
                <c r="${excelRowAndColumnId(rowIndex + 1, columnIndex + 1)}">
                    <v>${s.values[rowIndex]}</v>
                </c>
            `).join("\n")}
        </row>
    `);
  return [parseXmlNode(firstRow), ...otherRows.map(row => parseXmlNode(row))];
}
async function updateSheetRootScatter(workbookPart, sheetRoot, chartData, sharedStrings) {
  const isBubbleChart = isBubbleChartData(chartData);

  // Create first row
  const firstRowColumns = chartData.series.map((s, index) => {
    const baseIndex = isBubbleChart ? index * 2 : index;
    const seriesNameColumn = `
            <c r="${excelRowAndColumnId(0, baseIndex + 1)}" t="s">
                <v>${sharedStrings[s.name]}</v>
            </c>
        `;
    if (!isBubbleChart) {
      return seriesNameColumn;
    }
    const bubbleSizeColumn = `
            <c r="${excelRowAndColumnId(0, baseIndex + 2)}" t="s">
                <v>${sharedStrings[s.name + " Size"]}</v>
            </c>
        `;
    return `
            ${seriesNameColumn}
            ${bubbleSizeColumn}
        `;
  });
  const firstRow = `
        <row r="1" spans="1:${chartData.series.length + 1}">
            <c r="A1" t="s">
                <v>${sharedStrings[xValuesTitle]}</v>
            </c>
            ${firstRowColumns.join("\n")}
        </row>
    `;
  const xValues = scatterXValues(chartData.series);

  // Create other rows
  const yValues = chartData.series.map(s => scatterYValues(xValues, s));
  const bubbleSizes = isBubbleChart ? chartData.series.map(s => bubbleSizeValues(xValues, s)) : [];
  function otherRowColumns(rowIndex) {
    return chartData.series.map((s, seriesIndex) => {
      const baseIndex = isBubbleChart ? seriesIndex * 2 : seriesIndex;
      const yValueColumn = `
                <c r="${excelRowAndColumnId(rowIndex + 1, baseIndex + 1)}">
                    <v>${yValues[seriesIndex][rowIndex]}</v>
                </c>
            `;
      if (!isBubbleChart) {
        return yValueColumn;
      }
      const bubbleSizeColumn = `
                <c r="${excelRowAndColumnId(rowIndex + 1, baseIndex + 2)}" t="s">
                    <v>${bubbleSizes[seriesIndex][rowIndex]}</v>
                </c>
            `;
      return `
                ${yValueColumn}
                ${bubbleSizeColumn}
            `;
    });
  }
  const otherRows = xValues.map((x, rowIndex) => `
        <row r="${rowIndex + 2}" spans="1:${chartData.series.length + 1}">
            <c r="${excelRowAndColumnId(rowIndex + 1, 0)}">
                <v>${x}</v>
            </c>
            ${otherRowColumns(rowIndex).join("\n")}
        </row>
    `);
  return [parseXmlNode(firstRow), ...otherRows.map(row => parseXmlNode(row))];
}
async function updateTablePart(sheetPart, chartData) {
  const tablePart = await sheetPart.getFirstPartByType(RelType.Table);
  if (!tablePart) {
    return;
  }

  // Update ref attribute
  const tablePartRoot = await tablePart.xmlRoot();
  tablePartRoot.attributes["ref"] = `A1:${excelRowAndColumnId(tableRowsCount(chartData), chartData.series.length)}`;

  // Find old table columns
  const tableColumnsNode = tablePartRoot.childNodes?.find(child => child.nodeName === "tableColumns");

  // Add new table columns
  const firstColumnName = isScatterChartData(chartData) ? xValuesTitle : space;
  const otherColumns = chartData.series.map((s, index) => {
    const baseIndex = isBubbleChartData(chartData) ? index * 2 : index;
    return `
            <tableColumn id="${baseIndex + 2}" name="${s.name}"/>
            ${isBubbleChartData(chartData) ? `
                <tableColumn id="${baseIndex + 3}" name="${s.name} Size"/>
            ` : ""}
        `;
  });
  const tableColumns = `
        <tableColumns count="${chartData.series.length + 1}">
            <tableColumn id="1" name="${firstColumnName}"/>
            ${otherColumns.join("\n")}
        </tableColumns>
    `;
  xml.modify.insertAfter(parseXmlNode(tableColumns), tableColumnsNode);

  // Remove old table columns
  xml.modify.removeChild(tablePartRoot, tableColumnsNode);
}
function tableRowsCount(chartData) {
  if (isScatterChartData(chartData)) {
    return scatterXValues(chartData.series).length;
  }
  return chartData.categories.names.length;
}
async function updateStylesPart(workbookPart, sheetRoot, categories) {
  // https://github.com/OpenXmlDev/Open-Xml-PowerTools/blob/vNext/OpenXmlPowerTools/ChartUpdater.cs#L507

  if (isStringCategories(categories)) {
    return "";
  }
  const stylesPart = await workbookPart.getFirstPartByType(RelType.Styles);
  const stylesRoot = await stylesPart.xmlRoot();

  // Find or create cellXfs
  let cellXfs = stylesRoot.childNodes?.find(child => child.nodeName === "cellXfs");
  if (!cellXfs) {
    const cellStyleXfs = stylesRoot.childNodes?.find(child => child.nodeName === "cellStyleXfs");
    const borders = stylesRoot.childNodes?.find(child => child.nodeName === "borders");
    if (!cellStyleXfs && !borders) {
      throw new Error("Internal error. CellXfs, CellStyleXfs and Borders not found.");
    }
    const stylesCellXfs = xml.create.generalNode("cellXfs", {
      attributes: {
        count: "0"
      }
    });
    xml.modify.insertAfter(stylesCellXfs, cellStyleXfs ?? borders);

    // Use the cellXfs node from the sheet part
    cellXfs = sheetRoot.childNodes?.find(child => child.nodeName === "cellXfs");
  }

  // Add xf to cellXfs
  const count = parseInt(cellXfs.attributes["count"]);
  cellXfs.attributes["count"] = (count + 1).toString();
  xml.modify.appendChild(cellXfs, parseXmlNode(`
        <xf numFmtId="${formatIds[formatCode(categories)]}" fontId="0" fillId="0" borderId="0" applyNumberFormat="1"/>
    `));
  return `s="${count}"`;
}

//
// Helper functions
//

function seriesName(name, index) {
  return name ?? `Series ${index + 1}`;
}
function excelColumnId(i) {
  // From: https://github.com/OpenXmlDev/Open-Xml-PowerTools/blob/vNext/OpenXmlPowerTools/PtOpenXmlUtil.cs#L1559

  const A = 65;
  if (i >= 0 && i <= 25) {
    return String.fromCharCode(A + i);
  }
  if (i >= 26 && i <= 701) {
    const v = i - 26;
    const h = Math.floor(v / 26);
    const l = v % 26;
    return String.fromCharCode(A + h) + String.fromCharCode(A + l);
  }
  // 17576
  if (i >= 702 && i <= 18277) {
    const v = i - 702;
    const h = Math.floor(v / 676);
    const r = v % 676;
    const m = Math.floor(r / 26);
    const l = r % 26;
    return String.fromCharCode(A + h) + String.fromCharCode(A + m) + String.fromCharCode(A + l);
  }
  throw new Error(`Column reference out of range: ${i}`);
}
function excelRowAndColumnId(row, col) {
  return excelColumnId(col) + (row + 1).toString();
}
function excelDateValue(date) {
  const millisPerDay = 86400000;
  const excelEpoch = new Date("1899-12-30");
  return (date.getTime() - excelEpoch.getTime()) / millisPerDay;
}
function parseXmlNode(xmlString) {
  const xmlNode = xml.parser.parse(xmlString);
  xml.modify.removeEmptyTextNodes(xmlNode);
  return xmlNode;
}

class ChartPlugin extends TemplatePlugin {
  contentType = 'chart';
  async simpleTagReplacements(tag, data, context) {
    if (tag.placement !== TagPlacement.TextNode) {
      throw new TemplateSyntaxError(`Chart tag "${tag.rawText}" must be placed in a text node but was placed in ${tag.placement}`);
    }
    const chartNode = xml.query.findParentByName(tag.xmlTextNode, "c:chart");
    if (!chartNode) {
      throw new TemplateSyntaxError(`Chart tag "${tag.rawText}" must be placed in chart title`);
    }
    const content = data.getScopeData();
    if (!content) {
      officeMarkup.modify.removeTag(tag);
      return;
    }

    // Replace or remove the tag
    if (content.title) {
      updateTitle(tag, content.title);
    } else {
      officeMarkup.modify.removeTag(tag);
    }
    if (!chartHasData(content)) {
      return;
    }

    // Update the chart
    await updateChart(context.currentPart, content);
  }
}
function updateTitle(tag, newTitle) {
  const wordTextNode = officeMarkup.query.containingTextNode(tag.xmlTextNode);

  // Create the new title node
  const newXmlTextNode = xml.create.textNode(newTitle);
  const newWordTextNode = xml.create.generalNode(OmlNode.A.Text, {
    childNodes: [newXmlTextNode]
  });
  xml.modify.insertAfter(newWordTextNode, wordTextNode);

  // Remove the tag node
  xml.modify.remove(wordTextNode);

  // Split the run if needed.
  // Chart title run node can only have one text node
  const curRun = officeMarkup.query.containingRunNode(newWordTextNode);
  const runTextNodes = curRun.childNodes.filter(node => officeMarkup.query.isTextNode(node));
  if (runTextNodes.length > 1) {
    // Remove the last text node
    const lastTextNode = runTextNodes[runTextNodes.length - 1];
    xml.modify.remove(lastTextNode);

    // Create a new run
    const newRun = xml.create.cloneNode(curRun, true);
    for (const node of newRun.childNodes) {
      if (officeMarkup.query.isTextNode(node)) {
        xml.modify.remove(node);
      }
    }
    xml.modify.insertAfter(newRun, curRun);

    // Add the text node to the new run
    xml.modify.appendChild(newRun, lastTextNode);
  }
}
function chartHasData(content) {
  return !!content?.series?.length;
}

function createDefaultPlugins() {
  return [new LoopPlugin(), new RawXmlPlugin(), new ChartPlugin(), new ImagePlugin(), new LinkPlugin(), new TextPlugin()];
}

const PluginContent = {
  isPluginContent(content) {
    return !!content && typeof content._type === 'string';
  }
};

/**
 * The TemplateCompiler works roughly the same way as a source code compiler.
 * It's main steps are:
 *
 * 1. find delimiters (lexical analysis) :: (Document) => DelimiterMark[]
 * 2. extract tags (syntax analysis) :: (DelimiterMark[]) => Tag[]
 * 3. perform document replace (code generation) :: (Tag[], data) => Document*
 *
 * see: https://en.wikipedia.org/wiki/Compiler
 */
class TemplateCompiler {
  constructor(delimiterSearcher, tagParser, plugins, options) {
    this.delimiterSearcher = delimiterSearcher;
    this.tagParser = tagParser;
    this.pluginsLookup = toDictionary(plugins, p => p.contentType);
    this.options = options;
  }

  /**
   * Compiles the template and performs the required replacements using the
   * specified data.
   */
  async compile(node, data, context) {
    const tags = this.parseTags(node);
    await this.doTagReplacements(tags, data, context);
  }
  parseTags(node) {
    const delimiters = this.delimiterSearcher.findDelimiters(node);
    const tags = this.tagParser.parse(delimiters);
    return tags;
  }

  //
  // private methods
  //

  async doTagReplacements(tags, data, context) {
    for (let tagIndex = 0; tagIndex < tags.length; tagIndex++) {
      const tag = tags[tagIndex];
      data.pathPush(tag);
      const contentType = this.detectContentType(tag, data);
      const plugin = this.pluginsLookup[contentType];
      if (!plugin) {
        throw new UnknownContentTypeError(contentType, tag.rawText, data.pathString());
      }
      if (tag.disposition === TagDisposition.SelfClosed) {
        await this.simpleTagReplacements(plugin, tag, data, context);
      } else if (tag.disposition === TagDisposition.Open) {
        // get all tags between the open and close tags
        const closingTagIndex = this.findCloseTagIndex(tagIndex, tag, tags);
        const scopeTags = tags.slice(tagIndex, closingTagIndex + 1);
        tagIndex = closingTagIndex;

        // replace container tag
        const job = plugin.containerTagReplacements(scopeTags, data, context);
        if (isPromiseLike(job)) {
          await job;
        }
      }
      data.pathPop();
    }
  }
  detectContentType(tag, data) {
    // explicit content type
    const scopeData = data.getScopeData();
    if (PluginContent.isPluginContent(scopeData)) return scopeData._type;

    // implicit - loop
    if (tag.disposition === TagDisposition.Open || tag.disposition === TagDisposition.Close) return this.options.containerContentType;

    // implicit - text
    return this.options.defaultContentType;
  }
  async simpleTagReplacements(plugin, tag, data, context) {
    if (this.options.skipEmptyTags && stringValue(data.getScopeData()) === '') {
      return;
    }
    const job = plugin.simpleTagReplacements(tag, data, context);
    if (isPromiseLike(job)) {
      await job;
    }
  }
  findCloseTagIndex(fromIndex, openTag, tags) {
    let openTags = 0;
    let i = fromIndex;
    for (; i < tags.length; i++) {
      const tag = tags[i];
      if (tag.disposition === TagDisposition.Open) {
        openTags++;
        continue;
      }
      if (tag.disposition == TagDisposition.Close) {
        openTags--;
        if (openTags === 0) {
          return i;
        }
        if (openTags < 0) {
          // As long as we don't change the input to
          // this method (fromIndex in particular) this
          // should never happen.
          throw new UnopenedTagError(tag.name);
        }
        continue;
      }
    }
    if (i === tags.length) {
      throw new UnclosedTagError(openTag.name);
    }
    return i;
  }
}

class TemplateExtension {
  /**
   * Called by the TemplateHandler at runtime.
   */
  setUtilities(utilities) {
    this.utilities = utilities;
  }
}

class Delimiters {
  tagStart = "{";
  tagEnd = "}";
  containerTagOpen = "#";
  containerTagClose = "/";
  tagOptionsStart = "[";
  tagOptionsEnd = "]";
  constructor(initial) {
    Object.assign(this, initial);
    this.encodeAndValidate();
    if (this.containerTagOpen === this.containerTagClose) throw new Error(`containerTagOpen can not be equal to containerTagClose`);
  }
  encodeAndValidate() {
    const keys = ['tagStart', 'tagEnd', 'containerTagOpen', 'containerTagClose'];
    for (const key of keys) {
      const value = this[key];
      if (!value) throw new Error(`${key} can not be empty.`);
      if (value !== value.trim()) throw new Error(`${key} can not contain leading or trailing whitespace.`);
    }
  }
}

class TemplateHandlerOptions {
  plugins = createDefaultPlugins();

  /**
   * Determines the behavior in case of an empty input data. If set to true
   * the tag will be left untouched, if set to false the tag will be replaced
   * by an empty string.
   *
   * Default: false
   */
  skipEmptyTags = false;
  defaultContentType = TEXT_CONTENT_TYPE;
  containerContentType = LOOP_CONTENT_TYPE;
  delimiters = new Delimiters();
  maxXmlDepth = 20;
  extensions = {};
  constructor(initial) {
    Object.assign(this, initial);
    if (initial) {
      this.delimiters = new Delimiters(initial.delimiters);
    }
    if (!this.plugins.length) {
      throw new Error('Plugins list can not be empty');
    }
  }
}

class TemplateHandler {
  /**
   * Version number of the `easy-template-x` library.
   */
  version = "7.2.5" ;
  constructor(options) {
    this.options = new TemplateHandlerOptions(options);
    const delimiters = this.options.delimiters;

    //
    // This is the library's composition root
    //

    const delimiterSearcher = new DelimiterSearcher(delimiters, this.options.maxXmlDepth);
    const tagParser = new TagParser(delimiters);
    this.compiler = new TemplateCompiler(delimiterSearcher, tagParser, this.options.plugins, {
      skipEmptyTags: this.options.skipEmptyTags,
      defaultContentType: this.options.defaultContentType,
      containerContentType: this.options.containerContentType
    });
    this.options.plugins.forEach(plugin => {
      plugin.setUtilities({
        compiler: this.compiler
      });
    });
    const extensionUtilities = {
      tagParser,
      compiler: this.compiler
    };
    this.options.extensions?.beforeCompilation?.forEach(extension => {
      extension.setUtilities(extensionUtilities);
    });
    this.options.extensions?.afterCompilation?.forEach(extension => {
      extension.setUtilities(extensionUtilities);
    });
  }

  //
  // Public methods
  //

  async process(templateFile, data) {
    // Load the docx file
    const docx = await Docx.load(templateFile);

    // Prepare context
    const scopeData = new ScopeData(data);
    scopeData.scopeDataResolver = this.options.scopeDataResolver;
    const context = {
      docx,
      currentPart: null,
      pluginContext: {},
      options: {
        maxXmlDepth: this.options.maxXmlDepth
      }
    };
    const contentParts = await docx.getContentParts();
    for (const part of contentParts) {
      context.currentPart = part;

      // Extensions - before compilation
      await this.callExtensions(this.options.extensions?.beforeCompilation, scopeData, context);

      // Compilation (do replacements)
      const xmlRoot = await part.xmlRoot();
      await this.compiler.compile(xmlRoot, scopeData, context);

      // Extensions - after compilation
      await this.callExtensions(this.options.extensions?.afterCompilation, scopeData, context);
    }

    // Export the result
    return docx.export();
  }
  async parseTags(templateFile) {
    const docx = await Docx.load(templateFile);
    const tags = [];
    const parts = await docx.getContentParts();
    for (const part of parts) {
      const xmlRoot = await part.xmlRoot();
      const partTags = this.compiler.parseTags(xmlRoot);
      if (partTags?.length) {
        tags.push(...partTags);
      }
    }
    return tags;
  }

  /**
   * Get the text content of one or more parts of the document.
   * If more than one part exists, the concatenated text content of all parts is returned.
   * If no matching parts are found, returns an empty string.
   *
   * @param relType
   * The relationship type of the parts whose text content you want to retrieve.
   * Defaults to `RelType.MainDocument`.
   */
  async getText(docxFile, relType = RelType.MainDocument) {
    const parts = await this.getParts(docxFile, relType);
    const partsText = await Promise.all(parts.map(p => p.getText()));
    return partsText.join('\n\n');
  }

  /**
   * Get the xml root of a single part of the document.
   * If no matching part is found, returns null.
   *
   * @param relType
   * The relationship type of the parts whose xml root you want to retrieve.
   * If more than one part exists, the first one is returned.
   * Defaults to `RelType.MainDocument`.
   */
  async getXml(docxFile, relType = RelType.MainDocument) {
    const docx = await Docx.load(docxFile);
    if (relType === RelType.MainDocument) {
      return await docx.mainDocument.xmlRoot();
    }
    const part = await docx.mainDocument.getFirstPartByType(relType);
    if (!part) {
      return null;
    }
    return await part.xmlRoot();
  }
  async getParts(docxFile, relType) {
    const docx = await Docx.load(docxFile);
    if (relType === RelType.MainDocument) {
      return [docx.mainDocument];
    }
    const parts = await docx.mainDocument.getPartsByType(relType);
    return parts;
  }

  //
  // Private methods
  //

  async callExtensions(extensions, scopeData, context) {
    if (!extensions) return;
    for (const extension of extensions) {
      await extension.execute(scopeData, context);
    }
  }
}

exports.Base64 = Base64;
exports.Binary = Binary;
exports.COMMENT_NODE_NAME = COMMENT_NODE_NAME;
exports.ChartPlugin = ChartPlugin;
exports.DelimiterSearcher = DelimiterSearcher;
exports.Delimiters = Delimiters;
exports.Docx = Docx;
exports.ImagePlugin = ImagePlugin;
exports.InternalArgumentMissingError = InternalArgumentMissingError;
exports.InternalError = InternalError;
exports.LOOP_CONTENT_TYPE = LOOP_CONTENT_TYPE;
exports.LinkPlugin = LinkPlugin;
exports.LoopPlugin = LoopPlugin;
exports.MalformedFileError = MalformedFileError;
exports.MaxXmlDepthError = MaxXmlDepthError;
exports.MimeType = MimeType;
exports.MimeTypeHelper = MimeTypeHelper;
exports.MissingCloseDelimiterError = MissingCloseDelimiterError;
exports.MissingStartDelimiterError = MissingStartDelimiterError;
exports.OfficeMarkup = OfficeMarkup;
exports.OmlAttribute = OmlAttribute;
exports.OmlNode = OmlNode;
exports.OpenXmlPart = OpenXmlPart;
exports.Path = Path;
exports.PluginContent = PluginContent;
exports.RawXmlPlugin = RawXmlPlugin;
exports.Regex = Regex;
exports.RelType = RelType;
exports.Relationship = Relationship;
exports.ScopeData = ScopeData;
exports.TEXT_CONTENT_TYPE = TEXT_CONTENT_TYPE;
exports.TEXT_NODE_NAME = TEXT_NODE_NAME;
exports.TagDisposition = TagDisposition;
exports.TagOptionsParseError = TagOptionsParseError;
exports.TagParser = TagParser;
exports.TagPlacement = TagPlacement;
exports.TemplateCompiler = TemplateCompiler;
exports.TemplateDataError = TemplateDataError;
exports.TemplateExtension = TemplateExtension;
exports.TemplateHandler = TemplateHandler;
exports.TemplateHandlerOptions = TemplateHandlerOptions;
exports.TemplatePlugin = TemplatePlugin;
exports.TemplateSyntaxError = TemplateSyntaxError;
exports.TextPlugin = TextPlugin;
exports.UnclosedTagError = UnclosedTagError;
exports.UnidentifiedFileTypeError = UnidentifiedFileTypeError;
exports.UnknownContentTypeError = UnknownContentTypeError;
exports.UnopenedTagError = UnopenedTagError;
exports.UnsupportedFileTypeError = UnsupportedFileTypeError;
exports.Xlsx = Xlsx;
exports.XmlDepthTracker = XmlDepthTracker;
exports.XmlNodeType = XmlNodeType;
exports.XmlTreeIterator = XmlTreeIterator;
exports.XmlUtils = XmlUtils;
exports.Zip = Zip;
exports.ZipObject = ZipObject;
exports.countOccurrences = countOccurrences;
exports.createDefaultPlugins = createDefaultPlugins;
exports.first = first;
exports.inheritsFrom = inheritsFrom;
exports.isNumber = isNumber;
exports.isPromiseLike = isPromiseLike;
exports.last = last;
exports.normalizeDoubleQuotes = normalizeDoubleQuotes;
exports.officeMarkup = officeMarkup;
exports.pushMany = pushMany;
exports.sha1 = sha1;
exports.stringValue = stringValue;
exports.toDictionary = toDictionary;
exports.xml = xml;
