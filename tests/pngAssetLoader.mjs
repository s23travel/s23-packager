// Hook de módulos só para os testes em Node: o Vite trata imports de .png como URL,
// mas o runner `tsx` não. Devolve uma string vazia no lugar do asset binário.
export async function load(url, context, nextLoad) {
  if (url.endsWith('.png')) {
    return { format: 'module', shortCircuit: true, source: 'export default "";' };
  }
  return nextLoad(url, context);
}
