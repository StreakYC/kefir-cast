import KefirDefault from 'kefir';
import * as Kefir from 'kefir';

export default function kefirCast<T = any, U = any>(_Kefir: typeof Kefir | typeof KefirDefault, input: T): Kefir.Observable<T, U>;
