export function sortByCreatedAt(a: any, b: any, desc = false) {
  return (new Date(a.createdAt).valueOf() - new Date(b.createdAt).valueOf()) * (desc ? -1 : 1);
}

export function sortByCreatedAtDesc(a: any, b: any) {
  return sortByCreatedAt(a, b, true);
}

export function sortBy<T>(array: T[], valueFunc: (a: T) => number, desc = false) {
  return array.sort((a, b) => {
    return (valueFunc(a) - valueFunc(b)) * (desc ? -1 : 1);
  });
}

export function sortByStringProp<T>(array: T[], prop: keyof T, desc = false) {
  const descVal = desc ? -1 : 1;
  return array.sort((a, b) => {
    return (a[prop] || '') > (b[prop] || '') ? 1 * descVal : -1 * descVal;
  });
}

export function sortByStringFunc<T>(array: T[], stringFunc: (a: T) => string, desc = false) {
  const descVal = desc ? -1 : 1;
  return array.sort((a, b) => {
    return stringFunc(a) > stringFunc(b) ? 1 * descVal : -1 * descVal;
  });
}
