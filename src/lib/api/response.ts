import { NextResponse } from 'next/server';

/** エラーレスポンスの共通形式 */
export const errorResponse = (
  message: string,
  status: number
): NextResponse =>
  NextResponse.json({ error: { message } }, { status });

/** 想定外の例外をログに残しつつ 500 を返す */
export const unexpectedErrorResponse = (
  context: string,
  error: unknown
): NextResponse => {
  console.error(`[llmailer] ${context}`, error);
  const message = error instanceof Error ? error.message : String(error);
  return errorResponse(`サーバー側でエラーが発生しました: ${message}`, 500);
};
