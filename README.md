# FindU MVP

Sistema universitario de achados e perdidos feito com Node.js + React.

## Como rodar

```bash
npm.cmd install
npm.cmd run install:all
npm.cmd run dev
```

Aplicacao completa: http://localhost:3333
API: http://localhost:3333/api/health

Se quiser tentar hot reload do React separadamente:

```bash
npm.cmd run dev:client
```

## Login demo

- E-mail: `ana.souza@unifacs.edu.br`
- CPF: `39053344705`
- Senha: `FindU@123`

Tambem e possivel cadastrar um usuario usando um dos vinculos institucionais mockados:

- Ana Souza / CPF `39053344705` / Vinculo `2024001`
- Bruno Lima / CPF `52998224725` / Vinculo `FUNC100`
- Carla Mendes / CPF `15350946056` / Vinculo `2024002`

## Funcionalidades

- Cadastro e login com e-mail ou CPF.
- Senha com hash BCrypt e token JWT.
- Cadastro/listagem de universidades, campi e blocos.
- Registro de itens perdidos e encontrados.
- Upload de imagem JPG, JPEG ou PNG ate 5MB.
- Busca por termo, categoria, tipo e status.
- Match automatico basico por instituicao, categoria, local, data e texto.
- Atualizacao de status do item.
