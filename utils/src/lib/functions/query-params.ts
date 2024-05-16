export function getQueryParams(query: string) {
  query = query.substring(1);
  const vars = query.split('&');
  const result: { [key: string]: string } = {};
  for (let i = 0; i < vars.length; i++) {
    const pair = vars[i].split('=');
    result[pair[0]] = pair[1];
  }

  return result;
}
