import { Constructor } from '../types';
export declare function inheritsFrom(derived: Constructor<any>, base: Constructor<any>): boolean;
export declare function isPromiseLike<T>(candidate: unknown): candidate is PromiseLike<T>;
