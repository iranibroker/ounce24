export function groupBy<T>(array: T[], keyFunc: (val: T) => string) {
  return array.reduce((result: { [key: string]: T[] }, v: T) => {
    const key = keyFunc(v);
    if (!result[key]) result[key] = [];
    result[key].push(v);
    return result;
  }, {});
}

export function groupBySum<T>(array: T[], keyFunc: (val: T) => string, valFunc: (val: T) => number, defaultRes = {}) {
  return array.reduce((result: { [key: string]: { count: number; sum: number } }, v: T) => {
    const key = keyFunc(v);
    if (!result[key]) result[key] = { count: 0, sum: 0 };
    result[key].sum += valFunc(v);
    result[key].count++;
    return result;
  }, defaultRes);
}
