import { randomUUID } from 'node:crypto';
import type {
  CreateTemplateRequest,
  ListedTemplate,
  Template,
  UpdateTemplateRequest,
} from '@/types/mail';
import { readJsonFileIfExists, updateJsonFile } from './jsonFile';

/**
 * 同梱するテンプレート。リポジトリに入れて読むだけで書き換えない。
 * どの宛先でも使える下地として常に居てほしいので、画面からは変更・削除させない。
 */
const DEFAULT_FILE = 'templates/default.json';

/** 画面から追加したテンプレート。CRUD の対象で、git には含めない */
const CUSTOM_FILE = 'templates/custom.json';

/**
 * 追加・変更・削除が行えなかった理由。
 * 'protected' はデフォルトのテンプレートを触ろうとした場合、
 * 'duplicateName' は同じ名前のテンプレートが既にある場合。
 */
export type TemplateMutationError = 'notFound' | 'protected' | 'duplicateName';

export type TemplateMutation<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: TemplateMutationError };

const readTemplateFile = async (
  fileName: string
): Promise<readonly Template[]> =>
  readJsonFileIfExists<readonly Template[]>(fileName, []);

/**
 * 利用者が追加したテンプレートを読む。
 *
 * デフォルトのぶんは default.json 側が持つので、ここでは常に取り除く。
 */
const readCustomTemplates = async (
  defaults: readonly Template[]
): Promise<readonly Template[]> => {
  const customs = await readTemplateFile(CUSTOM_FILE);
  const defaultIds = new Set(defaults.map((template) => template.id));
  return customs.filter((template) => !defaultIds.has(template.id));
};

/**
 * custom.json を読み込み → 更新 → 書き込みする。
 *
 * デフォルトは別ファイルなので、ここで書き換えるのは利用者ぶんだけ。
 * 同名の判定などに要るため、デフォルトの一覧も updater へ渡す。
 */
const updateCustomTemplates = async <R>(
  updater: (
    current: readonly Template[],
    defaults: readonly Template[]
  ) => { readonly next: readonly Template[]; readonly result: R }
): Promise<R> => {
  const defaults = await readTemplateFile(DEFAULT_FILE);
  return updateJsonFile<readonly Template[], R>(CUSTOM_FILE, [], (current) =>
    updater(
      current.filter(
        (template) => !defaults.some((item) => item.id === template.id)
      ),
      defaults
    )
  );
};

/**
 * 同じ名前のテンプレートが既にあるか。
 *
 * 一覧では名前だけを手がかりに選ぶため、同名を許すとどちらが差し込まれるのか
 * 分からなくなる。エージェントと同じくここで弾く。
 */
const hasSameName = (
  templates: readonly Template[],
  name: string,
  exceptId?: string
): boolean =>
  templates.some(
    (template) => template.id !== exceptId && template.name === name
  );

/** デフォルトを先、利用者が追加したぶんを後に並べる */
export const listTemplates = async (): Promise<readonly ListedTemplate[]> => {
  const defaults = await readTemplateFile(DEFAULT_FILE);
  const customs = await readCustomTemplates(defaults);
  return [
    ...defaults.map((template) => ({ ...template, isDefault: true })),
    ...customs.map((template) => ({ ...template, isDefault: false })),
  ];
};

/** テンプレートを追加する（ID はサーバーで採番する） */
export const createTemplate = async (
  fields: CreateTemplateRequest
): Promise<TemplateMutation<Template>> =>
  updateCustomTemplates<TemplateMutation<Template>>((current, defaults) => {
    if (hasSameName([...defaults, ...current], fields.name)) {
      return { next: current, result: { ok: false, error: 'duplicateName' } };
    }
    // JSON をそのまま読んだときに分かりやすいよう、ID は先頭に置く
    const template: Template = { id: randomUUID(), ...fields };
    return {
      next: [...current, template],
      result: { ok: true, value: template },
    };
  });

/** テンプレートの内容を書き換える（ID は変更しない） */
export const updateTemplate = async (
  id: string,
  patch: UpdateTemplateRequest
): Promise<TemplateMutation<Template>> =>
  updateCustomTemplates<TemplateMutation<Template>>((current, defaults) => {
    if (defaults.some((template) => template.id === id)) {
      return { next: current, result: { ok: false, error: 'protected' } };
    }
    if (!current.some((template) => template.id === id)) {
      return { next: current, result: { ok: false, error: 'notFound' } };
    }
    if (hasSameName([...defaults, ...current], patch.name, id)) {
      return { next: current, result: { ok: false, error: 'duplicateName' } };
    }
    const updated: Template = { id, ...patch };
    return {
      next: current.map((template) =>
        template.id === id ? updated : template
      ),
      result: { ok: true, value: updated },
    };
  });

/** テンプレートを削除する（差し込み済みの本文は変わらない） */
export const deleteTemplate = async (
  id: string
): Promise<TemplateMutation<null>> =>
  updateCustomTemplates<TemplateMutation<null>>((current, defaults) => {
    if (defaults.some((template) => template.id === id)) {
      return { next: current, result: { ok: false, error: 'protected' } };
    }
    if (!current.some((template) => template.id === id)) {
      return { next: current, result: { ok: false, error: 'notFound' } };
    }
    return {
      next: current.filter((template) => template.id !== id),
      result: { ok: true, value: null },
    };
  });
