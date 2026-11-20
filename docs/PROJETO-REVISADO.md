# Atividade Prática - Estágio: projeto revisado

## 1. Apresentação da empresa

O Studio Tatiane Carrara atua com estética e cuidados pessoais, especialmente design de sobrancelhas e extensão de cílios, no bairro Normília da Cunha, Vila Velha, Espírito Santo. A profissional realiza atendimento personalizado e administra a agenda. O expediente considerado na aplicação é de terça-feira a sábado, das 9h às 18h.

## 2. Definição e objetivo do projeto

Desenvolver uma aplicação web que apresente os serviços do Studio Tatiane Carrara e permita consultar dias e horários disponíveis. Após selecionar o serviço, a data e o horário desejados, a cliente poderá abrir uma conversa no WhatsApp com uma mensagem previamente preenchida, solicitando a confirmação do atendimento. A profissional terá uma área administrativa para atualizar a disponibilidade e registrar os agendamentos confirmados.

O fluxo reduz as mensagens necessárias para consultar disponibilidade e preserva a decisão final da profissional. O site informa de forma explícita que selecionar um horário ou abrir uma conversa não constitui reserva ou agendamento confirmado.

## 3. Descrição da aplicação e requisitos de negócio

### Catálogo inicial

| Serviço | Duração | Valor |
| --- | --- | --- |
| Design com henna | 60 minutos | R$ 50,00 |
| Design com tintura | 60 minutos | R$ 55,00 |
| Brow lamination | 90 minutos | R$ 125,00 |
| Extensão de cílios (todos os modelos) | 120 minutos | R$ 140,00 |
| Spa labial | 30 minutos | R$ 25,00 |
| Epilação de buço | 15 minutos | R$ 15,00 |

O anexo registra o termo “Brown lamination”; a interface utiliza a grafia “Brow lamination”. Preços, durações e descrições podem ser atualizados pela profissional.

### Fluxo da cliente

1. Consultar o catálogo e escolher o serviço.
2. Visualizar o calendário com dias que tenham intervalos suficientes para o procedimento.
3. Selecionar a data e um horário livre.
4. Informar o nome opcionalmente e visualizar a mensagem com serviço, data, horário, duração e valor.
5. Clicar em “Solicitar pelo WhatsApp”. O sistema revalida o intervalo antes de abrir a conversa.
6. Enviar a mensagem no aplicativo e aguardar a confirmação da profissional.

### Gestão da agenda

A profissional acessa uma área protegida para consultar a agenda diária ou semanal, registrar atendimentos confirmados, bloquear intervalos e atualizar o catálogo e o WhatsApp. Remarcações e cancelamentos são solicitados via WhatsApp e só alteram a agenda quando registrados pela profissional. A lista de clientes é derivada dos atendimentos registrados.

### Regras de disponibilidade

- Uma única profissional atende por vez.
- Expediente: terça a sábado, 9h às 18h, no horário de Brasília.
- Inícios em intervalos de 15 minutos; todo o serviço precisa caber no período livre.
- Datas e horários passados são desabilitados.
- Atendimentos confirmados e bloqueios impedem novos registros sobrepostos.
- O banco verifica conflitos também na inclusão ou remarcação, inclusive quando há operações concorrentes.
- A agenda pública não apresenta nomes, telefones ou detalhes dos atendimentos existentes.
- A ausência de reserva temporária significa que mais de uma cliente pode solicitar o mesmo intervalo no WhatsApp. A profissional define a confirmação e a registra no painel.

## 4. Tecnologias utilizadas

**HTML5:** estrutura semântica, formulários, telas de catálogo, calendário e gestão.

**CSS3 e Bootstrap 5.3.9:** estilos, grade responsiva, botões e formulários para computadores e celulares. O CSS do Bootstrap é distribuído junto ao projeto.

**JavaScript:** módulos da interface, navegação do calendário, composição da mensagem e validações. A API de servidor também é escrita em JavaScript. Foi escolhida a alternativa JavaScript entre JavaScript/TypeScript citadas no documento.

**Banco de dados:** SQLite no ambiente local e D1 na hospedagem, com tabelas, índice e gatilhos contra sobreposição. O armazenamento compartilhado permite atualizar a agenda para todos os dispositivos.

**Prototipagem:** o anexo apresenta Figma como uma possibilidade de demonstração. Nesta entrega, o fluxo é demonstrado na aplicação funcional; não foi criado um arquivo Figma.

## 5. Proposta de valor

A cliente consulta serviços e horários antes de conversar com a profissional, reduzindo as trocas de mensagens para escolher um atendimento. A profissional conserva o controle da confirmação, das remarcações e dos cancelamentos e passa a contar com uma visão centralizada da agenda. O banco impede registros confirmados sobrepostos, desde que os atendimentos acertados fora do site também sejam registrados no painel.

Lembretes automáticos de 24 horas são uma melhoria futura. A versão implementada não afirma reduzir faltas por meio de lembretes que ainda não envia.

## 6. Apresentação da aplicação desenvolvida

**Página inicial e catálogo:** apresentação do Studio, seis serviços com preços e durações e acesso à consulta da agenda.

**Calendário e solicitação:** seleção de serviço, mês, dia e horário; mensagem pronta e abertura do WhatsApp para envio pela cliente.

**Painel administrativo:** entrada por chave de acesso; agenda diária e semanal; registro, alteração, cancelamento e bloqueio; edição de serviços e contato; consulta de clientes.

### Instruções de operação

Configurar o WhatsApp, revisar o catálogo e cadastrar os atendimentos já existentes antes de disponibilizar a agenda. Registrar a confirmação imediatamente após o acordo pelo WhatsApp. Utilizar bloqueios para pausas e compromissos e manter a chave administrativa restrita à profissional. O README contém instruções de execução, testes e publicação.

### Estrutura da base de dados

| Tabela | Campos principais | Finalidade |
| --- | --- | --- |
| `settings` | `key` (chave primária), `value` (JSON) | WhatsApp e catálogo configurado; o catálogo inicial é definido no código |
| `appointments` | `id`, `date`, `start`, `end`, `kind`, `service_id`, `service_name`, `price`, `client_name`, `client_phone`, `status`, `created_at` | Atendimentos e bloqueios, com histórico de cancelamento |

Horários são armazenados em minutos desde meia-noite e valores em centavos. Nome do serviço e preço ficam registrados no atendimento para preservar o histórico após mudanças no catálogo. Clientes são agrupadas por nome e telefone a partir dos registros confirmados. Como existe apenas uma profissional, não há tabela separada de profissionais nesta versão. O schema executável está em `drizzle/0000_agenda.sql`; o código completo acompanha este documento no repositório.

### Critérios de aceite e validação

Os testes automatizados verificam expediente, duração integral, finais de semana, passado, fuso de Brasília, composição da mensagem, proteção administrativa, bloqueios, conflitos concorrentes, remarcação e cancelamento. A solicitação de mensagem é testada para garantir que não cria uma reserva. A interface foi conferida no navegador; o número real do WhatsApp precisa ser configurado para uso operacional.

## 7. Referências

- Documento de origem: “Atividade Prática - Estágio.pdf”, fornecido pelo solicitante. O original foi preservado.
- Bootstrap. Documentação oficial. https://getbootstrap.com/docs/5.3/getting-started/download/
- Cloudflare. D1 Database. https://developers.cloudflare.com/d1/worker-api/d1-database/
- Node.js. SQLite. https://nodejs.org/api/sqlite.html

Este documento adapta o escopo ao fluxo solicitado pelo usuário e descreve o que foi efetivamente implementado.
