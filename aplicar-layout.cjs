const fs = require('node:fs');
const path = require('node:path');
try {
  const target = path.join(__dirname, 'app', 'globals.css');
  const patch = fs.readFileSync(path.join(__dirname, 'layout-formulario.css'), 'utf8');
  if (!fs.existsSync(target)) throw new Error('Coloque os arquivos deste pacote na pasta principal do projeto, ao lado da pasta app.');
  const original = fs.readFileSync(target, 'utf8');
  if (!original.includes('.category-add-form')) throw new Error('O CSS encontrado não corresponde ao formulário esperado. Nenhum arquivo foi alterado.');
  const start = '/* LISTA-CASA-FORMULARIO-COMPACTO:INICIO */';
  const end = '/* LISTA-CASA-FORMULARIO-COMPACTO:FIM */';
  const a = original.indexOf(start), b = original.indexOf(end);
  if ((a === -1) !== (b === -1) || (a !== -1 && b < a)) throw new Error('Bloco de atualização incompleto. Nenhum arquivo foi alterado.');
  const updated = a === -1 ? original.trimEnd()+'\n\n'+patch : original.slice(0,a)+patch+original.slice(b+end.length);
  fs.writeFileSync(target, updated, 'utf8');
  console.log('Pronto! Layout aplicado em app/globals.css. Confira no GitHub Desktop, faça Commit e Push origin.');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
