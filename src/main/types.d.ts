// Vite-specific raw imports.
declare module '*.sql?raw' {
  const content: string;
  export default content;
}
