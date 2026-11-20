# Studio Tatiane Carrara

Aplicação de consulta de disponibilidade e solicitação de atendimento pelo WhatsApp. HTML5 semântico, CSS3, Bootstrap 5.3.9 e JavaScript (ES Modules), conforme as tecnologias do anexo. API em JavaScript e banco SQLite local / Cloudflare D1 na publicação. Não depende de React nem de ferramentas de compilação de interface.

## Executar localmente

1. Instale Node.js 22.13 ou superior (recomendado Node.js 24).
2. Abra um terminal nesta pasta.
3. Copie `.env.example` para `.env` e preencha `ADMIN_KEY` com uma chave longa e aleatória. No ambiente entregue, a chave já foi gerada; consulte o arquivo privado `ACESSO-ADMINISTRATIVO.txt` na pasta superior.
4. Execute `npm start`.
5. Abra `http://127.0.0.1:4173`. A administração fica em `http://127.0.0.1:4173/admin`.

Não é necessário instalar pacotes. Bootstrap está incluído em `public/vendor/bootstrap.min.css`, com os avisos de licença originais. O servidor escuta apenas em loopback. O banco é criado em `data/agenda.sqlite`; não publique a pasta de dados ou o arquivo `.env`.

## Preparar o Studio para uso

1. Acesse `/admin` e entre com sua chave.
2. Em **Serviços e WhatsApp**, informe `55 + DDD + número` e salve. Nenhum número fictício foi configurado na entrega.
3. Confira preços e durações. Os seis serviços iniciais reproduzem os valores do PDF.
4. Registre todos os atendimentos que já estavam na agenda antes de liberar o site às clientes. A agenda inicia vazia, sem dados de demonstração.
5. Use **Bloquear horário** para intervalos, pausas e compromissos. O expediente padrão é terça a sábado, das 9h às 18h.
6. Após fechar um atendimento no WhatsApp, use **Registrar atendimento**. Para remarcar, use **Alterar**; para cancelar ou liberar um bloqueio, use **Cancelar/Liberar**.

O acesso administrativo usa uma chave secreta configurada somente no servidor. Em hospedagem, use HTTPS. A chave é mantida na memória de sessão do navegador e removida ao sair. O site publicado inicialmente é privado pelo controle de acesso da plataforma; sua liberação às clientes exige uma decisão posterior de compartilhamento. Nunca compartilhe a chave administrativa com clientes.

## Funcionamento

- Cliente escolhe serviço, data e horário e vê a mensagem antes de abrir o WhatsApp.
- A API revalida a disponibilidade antes de fornecer o link `wa.me`.
- Abrir o WhatsApp não envia a mensagem automaticamente e não reserva horário.
- Confirmação, remarcação e cancelamento são acertados com a profissional. O painel registra a decisão e atualiza o calendário compartilhado.
- Inícios são oferecidos em intervalos de 15 minutos, com todo o procedimento dentro do expediente. Datas passadas e domingos/segundas não podem ser escolhidos.
- O banco impede intervalos sobrepostos, inclusive em operações concorrentes. Pedidos simultâneos no WhatsApp ainda dependem da escolha e confirmação de Tatiane.
- A consulta pública só expõe horários disponíveis. Nomes e telefones são acessíveis apenas pela API administrativa autenticada.
- O painel oferece agenda diária, semanal e de 31 dias, valores previstos, gestão do catálogo, bloqueios e lista de clientes derivada dos registros confirmados.
- Datas e horários seguem `America/Sao_Paulo` (Brasília).

## Validação e build

```sh
npm test
npm run build
```

Testes cobrem expediente, duração, dias fechados, datas inválidas, fuso, sobreposições, acesso administrativo, origem das requisições, concorrência no registro, bloqueio, remarcação, cancelamento, configuração e composição do link WhatsApp. Os testes usam banco em memória e não alteram a agenda de uso.

O build gera um Worker ES module em `dist/server/index.js`, incorporando os arquivos HTML/CSS/JS. A configuração de hospedagem fica em `.openai/hosting.json` (`d1: "DB"`). O schema e as migrações ficam em `drizzle/`. A publicação precisa fornecer o binding `DB` e o segredo `ADMIN_KEY`. Dados locais e publicados são independentes.

## Estrutura

| Caminho | Conteúdo |
| --- | --- |
| `public/index.html` | Telas da cliente e da profissional |
| `public/styles.css` | Identidade visual e responsividade |
| `public/app.js` | Interações e consumo da API |
| `src/domain.js` | Catálogo, regras de disponibilidade e mensagens |
| `src/api.js` | API, validação e autorização |
| `server.mjs` | Servidor local e adaptador SQLite |
| `drizzle/0000_agenda.sql` | Tabelas, índice e gatilhos contra sobreposição |
| `docs/PROJETO-REVISADO.md` | Escopo acadêmico ajustado |

## Limites e evolução

Lembretes automáticos de 24 horas ficaram fora desta versão, conforme o ajuste de escopo: exigem um serviço de envio e execução agendada. Não há envio automático de mensagens, pagamento, reserva temporária nem confirmação automática pelo site. Figma foi citado no anexo como opção de prototipagem; esta entrega implementa diretamente as telas funcionais, sem alegar um protótipo Figma inexistente. O PDF original foi preservado; a redação revisada está no documento do projeto.

## Referências técnicas

- [Bootstrap: distribuição e licença](https://getbootstrap.com/docs/5.3/getting-started/download/)
- [Cloudflare D1: acesso ao banco e transações em lote](https://developers.cloudflare.com/d1/worker-api/d1-database/)
- [Node.js: SQLite](https://nodejs.org/api/sqlite.html)
