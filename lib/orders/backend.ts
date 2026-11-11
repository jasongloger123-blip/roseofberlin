// Administration is hosted alongside D1 and dispatcher-owned authentication.
export function orderBackendUrl(path: string) {
  const url=new URL(process.env.ORDER_BACKEND_URL||"https://selesitina-rosenparfum.jasooon-san.chatgpt.site");
  if(url.protocol!=="https:"||url.username||url.password||url.search||url.hash||url.pathname!=="/")throw new Error("INVALID_ORDER_BACKEND");
  return new URL(path,url.origin).href;
}
