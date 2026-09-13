/**
 * アドレスで宛先を表していた頃のデータを読むための変換。
 *
 * 保存済みの data/*.json には `agent@llmailer.local` のようなアドレスが残っている。
 * 読み込み時にエージェント ID へ読み替えることで、
 * アドレスを撤廃しても過去のやり取りが「誰とのスレッドか」を保てる。
 */

/** 旧データで利用者自身を指していたアドレス */
export const LEGACY_ME_ADDRESS = 'me@llmailer.local';

/**
 * 旧アドレスをエージェント ID として読む（@ より前を使う）。
 *
 * デフォルトのエージェントの ID はこの規則で一致するように付けてある。
 * 別ドメインで同じローカル部を使っていた場合だけ 1 つに潰れるが、
 * アドレスはローカル運用の見た目上のものだったため許容する。
 */
export const legacyAddressToAgentId = (address: string): string =>
  address.split('@')[0] || address;
