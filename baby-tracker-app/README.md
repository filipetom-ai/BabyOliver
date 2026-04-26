# Ninho Playroom

App web estático para acompanhar:

- mamadas
- sono
- fraldas
- bomba
- remédios
- anotações

## Como abrir localmente

Abra [index.html](./index.html) no navegador.

## Como publicar no GitHub Pages

1. Crie um repositório no GitHub.
2. Envie os arquivos desta pasta para esse repositório.
3. No GitHub, abra `Settings` > `Pages`.
4. Em `Build and deployment`, escolha `Deploy from a branch`.
5. Selecione a branch principal e a pasta `/ (root)`.
6. Salve e aguarde o link público ser gerado.

## Importante sobre acesso compartilhado

Este MVP salva os dados no `localStorage` do navegador. Isso significa:

- funciona bem para testar e validar a experiência
- pode ser aberto por vocês dois no GitHub Pages
- os dados ainda não sincronizam automaticamente entre aparelhos

Enquanto isso, o app já oferece:

- `Exportar backup`
- `Importar backup`

Na próxima etapa, o ideal é conectar um backend simples como `Supabase` para:

- sincronizar eventos entre você e sua esposa
- manter histórico único do bebê
- permitir acesso no celular de ambos sem troca manual de backup
