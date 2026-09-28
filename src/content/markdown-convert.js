import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';
import logger from '@utils/logger';
import {
  preprocessAuthorsAndMetadata,
  preprocessMathElements,
  preprocessLists,
  preprocessAr5ivElements,
  preprocessTables,
  removeMathMLArtifacts,
  restoreMathPlaceholders,
  postProcessMarkdown,
} from './ar5iv-preprocess';
import { addAr5ivTurndownRules } from './ar5iv-turndown-rules';

/**
 * 把已经解析好的 ar5iv 文档转成 Markdown。
 * 内容脚本和夹具测试走同一条预处理与 Turndown 规则。
 */
export function convertAr5ivDocument(doc) {
  preprocessAuthorsAndMetadata(doc);
  const { doc: cleanedDoc, mathMap } = preprocessMathElements(doc);
  preprocessLists(cleanedDoc);
  preprocessAr5ivElements(cleanedDoc);
  preprocessTables(cleanedDoc);
  removeMathMLArtifacts(cleanedDoc);

  // Turndown 转换
  const turndownService = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    bulletListMarker: '-',
    emDelimiter: '*',
    strongDelimiter: '**',
  });

  // 启用 GFM 插件（表格、删除线等）
  turndownService.use(gfm);

  addAr5ivTurndownRules(turndownService);

  // 执行 Turndown 转换
  let markdown = turndownService.turndown(cleanedDoc.body);

  // 后处理
  markdown = restoreMathPlaceholders(markdown, mathMap);
  markdown = postProcessMarkdown(markdown);

  logger.debug(
    `Markdown conversion complete: ${markdown.length} bytes, ${mathMap.size} formulas`,
  );
  return markdown;
}

/**
 * 处理 HTML → Markdown 转换（在真实浏览器环境中）
 */
export function handleHtmlToMarkdown(data, sendResponse) {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(data.html, 'text/html');
    const markdown = convertAr5ivDocument(doc);
    sendResponse({ success: true, markdown });
  } catch (error) {
    logger.error('Markdown conversion failed:', error);
    sendResponse({ success: false, error: error.message });
  }
}
