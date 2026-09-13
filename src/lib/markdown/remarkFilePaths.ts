import type { Root } from 'mdast';
import { isViewablePath } from '@/lib/files/types';

/** リンク化したファイルパスを持たせる属性名 */
export const FILE_PATH_ATTRIBUTE = 'data-file-path';

/**
 * mdast のノードのうち、この変換で見る分だけを表した形。
 *
 * 対象はテキストとインラインコードだけで、それ以外は種類を見ずに素通りさせるため、
 * mdast の細かい型を持ち込まずに扱う。
 */
interface MarkdownNode {
  type: string;
  value?: string;
  children?: MarkdownNode[];
  url?: string;
  data?: { hProperties?: Record<string, string> };
}

/**
 * 本文に出てくるファイルパスらしき並び。
 *
 * 空白で区切られた 1 語のうち、拡張子を持つものを拾い、
 * 閲覧できる拡張子かどうかは isViewablePath で判定する。
 * 全角文字や括弧は含めない（「〜を .../plan.md に出力しました。」のような
 * 文の中から、パスの部分だけを取り出すため）。
 */
const FILE_PATH_PATTERN = /(?:~|\.{1,2})?[\w./@+-]*[\w@+-]\.[A-Za-z]+/g;

/** URL の一部（https://example.com/a.md など）を拾わないための判定 */
const isUrlContext = (text: string, index: number): boolean =>
  index > 0 && text[index - 1] === ':';

const toFileLink = (
  filePath: string,
  children: MarkdownNode[]
): MarkdownNode => ({
  type: 'link',
  // href にカスタムスキームは使えない（react-markdown の urlTransform に落とされる）。
  // クリックの受け口は、MarkdownBody が data 属性から組み立てる。
  url: '',
  children,
  data: { hProperties: { [FILE_PATH_ATTRIBUTE]: filePath } },
});

/** テキストを「素のテキスト」と「ファイルパスのリンク」に切り分ける */
const splitText = (value: string): MarkdownNode[] | null => {
  const nodes: MarkdownNode[] = [];
  let last = 0;

  for (const match of value.matchAll(FILE_PATH_PATTERN)) {
    const [found] = match;
    const index = match.index;
    if (!isViewablePath(found) || isUrlContext(value, index)) {
      continue;
    }

    if (index > last) {
      nodes.push({ type: 'text', value: value.slice(last, index) });
    }
    nodes.push(toFileLink(found, [{ type: 'text', value: found }]));
    last = index + found.length;
  }

  if (nodes.length === 0) {
    return null;
  }
  if (last < value.length) {
    nodes.push({ type: 'text', value: value.slice(last) });
  }
  return nodes;
};

const visit = (node: MarkdownNode): void => {
  // コードブロックのような葉ノードと、リンクの中身（入れ子になる）は触らない
  if (!node.children || node.type === 'link' || node.type === 'linkReference') {
    return;
  }

  const children: MarkdownNode[] = [];
  let changed = false;

  for (const child of node.children) {
    if (child.type === 'text' && child.value !== undefined) {
      const split = splitText(child.value);
      if (split) {
        children.push(...split);
        changed = true;
        continue;
      }
    } else if (
      child.type === 'inlineCode' &&
      child.value !== undefined &&
      isViewablePath(child.value)
    ) {
      // `path/to/plan.md` のようにコードで書かれたパスも、そのまま開けるようにする
      children.push(toFileLink(child.value, [child]));
      changed = true;
      continue;
    } else {
      visit(child);
    }
    children.push(child);
  }

  if (changed) {
    node.children = children;
  }
};

/**
 * 本文中のファイルパスを、ビューアで開けるリンクに変える remark プラグイン。
 *
 * 正規表現で本文をそのまま置換するとコードブロックの中まで書き換えてしまうため、
 * mdast を歩いて、テキストとインラインコードのノードだけを対象にする。
 */
export const remarkFilePaths = () => (tree: Root): void => {
  visit(tree as unknown as MarkdownNode);
};
