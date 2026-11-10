declare module '*.css' {
  const source: string;
  export default source;
}

declare module '*.png' {
  const bytes: ArrayBuffer;
  export default bytes;
}

declare module '*.ttf' {
  const bytes: ArrayBuffer;
  export default bytes;
}
