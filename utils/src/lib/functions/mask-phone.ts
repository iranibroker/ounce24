export function maskPhone(phone: string, maskChar = '*', from = 4, fromLast = 3) {
  const start = phone.slice(0, from);
  const middle = phone.slice(from, -fromLast).replace(/\d/g, maskChar);
  const last = phone.slice(-fromLast);
  return `${start}${middle}${last}`;
}
