# Vivi Shoes

Loja de calçados online desenvolvida como trabalho acadêmico. O cliente filtra
os modelos pela numeração, monta a sacola, finaliza a compra com o endereço
preenchido automaticamente pelo CEP e depois acompanha seus pedidos.

O projeto tem três camadas separadas: front-end em HTML, CSS e JavaScript puro,
uma API REST em C# e o banco de dados MySQL.

```
Navegador  ──fetch──>  API em C# (.NET 8)  ──Dapper──>  MySQL
    │
    └──fetch──>  ViaCEP (API externa)
```

---

## Tecnologias

| Camada | O que foi usado |
|---|---|
| Front-end | HTML5, CSS3 e JavaScript (sem framework nem biblioteca) |
| Back-end | C# / ASP.NET Core 8 (Minimal API) com Dapper |
| Banco | MySQL 8 |
| API externa | [ViaCEP](https://viacep.com.br) para o endereço do cliente |

---

## Funcionalidades

- **Vitrine** lida do banco, com filtro por numeração — só aparece o modelo que
  tem estoque naquele número.
- **Ficha do produto** com a grade de numeração e a quantidade de pares
  disponíveis em cada uma.
- **Sacola** com vários itens, ajuste de quantidade e validação contra o estoque.
- **Frete** calculado na hora, grátis acima de R$ 299,90.
- **Checkout** com preenchimento automático de rua, bairro, cidade e UF a partir
  do CEP, via ViaCEP.
- **Pagamento** por Pix (aprovação imediata), cartão ou boleto.
- **Consulta de pedidos** pelo CPF, com os itens e a situação de cada um.
- Máscaras de CPF, telefone e CEP; layout responsivo.

---

## Como rodar

**Pré-requisitos:** MySQL 8, .NET SDK 8 e Python 3 (só para servir os arquivos
do front — qualquer servidor local resolve).

### 1. Banco de dados

```bash
mysql -u root -p < banco/vivishoes.sql
```

O script cria o banco `vivishoes`, as seis tabelas e já popula o catálogo.

### 2. API

Abra `api/appsettings.json` e troque `SUA_SENHA_AQUI` pela senha do seu MySQL.
Depois:

```bash
cd api
dotnet restore
dotnet run
```

A API sobe em `http://localhost:5000`. Deixe esse terminal aberto.

### 3. Front-end

Em outro terminal, na raiz do projeto:

```bash
python -m http.server 5500
```

Acesse **http://localhost:5500**

> **Não abra o `index.html` com duplo clique.** No protocolo `file://` o
> navegador bloqueia as requisições às APIs e a vitrine fica vazia. Se usa VS
> Code, a extensão Live Server faz o mesmo papel do comando acima.

---

## Estrutura

```
Vivi_Shoes/
├─ index.html              estrutura da página
├─ css/estilo.css          estilo
├─ js/app.js               vitrine, sacola, checkout e ViaCEP
├─ img/                    fotos dos produtos
├─ banco/vivishoes.sql     criação do banco + dados de exemplo
└─ api/
   ├─ Program.cs           as três rotas da API
   ├─ VivishoesApi.csproj
   └─ appsettings.json     string de conexão
```

---

## Banco de dados

```
Clientes ──< Pedido ──< ItensPedido >── Produto ──< Estoque
                └──< Pagamento
```

| Tabela | Papel |
|---|---|
| `Clientes` | dados do comprador, com o endereço separado em colunas (o que o ViaCEP devolve) |
| `Produto` | catálogo: nome, descrição, cor, preço e caminho da foto |
| `Estoque` | grade de numeração — uma linha por produto + tamanho |
| `Pedido` | cabeçalho da compra: cliente, frete, total e situação |
| `ItensPedido` | os pares daquela compra |
| `Pagamento` | forma, valor e situação do pagamento |

O `Pedido` é o cabeçalho e os produtos ficam em `ItensPedido` porque a loja tem
sacola: uma compra pode levar vários pares. E o estoque é por produto **e**
tamanho, já que o mesmo modelo pode ter 2 pares no 35 e 8 no 38 — é isso que
permite o filtro por numeração.

---

## Rotas da API

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/api/produtos` | catálogo com a grade de numeração de cada modelo |
| `POST` | `/api/checkout` | grava cliente, pedido, itens e pagamento; baixa o estoque |
| `GET` | `/api/pedidos?cpf=` | pedidos de um cliente |

### Exemplo de requisição

```http
POST /api/checkout
Content-Type: application/json

{
  "cliente": {
    "nome": "Marina Alvarenga",
    "cpf": "104.552.336-71",
    "cep": "30720-540",
    "logradouro": "Rua Padre Eustáquio",
    "numero": "812",
    "bairro": "Carlos Prates",
    "cidade": "Belo Horizonte",
    "uf": "MG"
  },
  "forma_pagamento": "Pix",
  "itens": [
    { "id_produto": 8, "tamanho": "37", "quantidade": 1 }
  ]
}
```

---

## Integração com o ViaCEP

No arquivo `js/app.js`, função `buscarCep()`. Assim que o cliente completa os
oito dígitos do CEP, o JavaScript consulta:

```
https://viacep.com.br/ws/30720540/json/
```

A resposta traz `logradouro`, `bairro`, `localidade` e `uf`, que preenchem os
campos do formulário — deixados como somente-leitura para não divergirem do CEP.
Quando o CEP não existe, o ViaCEP responde `{ "erro": true }`, caso tratado no
código com uma mensagem na tela em vez de um formulário quebrado.

---

## Fotos dos produtos

O banco já vem com o caminho de cada foto na coluna `Produto.imagem`. Para
adicionar uma imagem, salve o arquivo dentro de `img/` com o nome listado em
`img/COLOQUE-AS-FOTOS-AQUI.txt` e atualize a página. Nenhum código precisa ser
alterado.

Para usar outro nome ou outra extensão:

```sql
update Produto set imagem = 'img/meu-arquivo.png' where id_produto = 8;
```

Enquanto a foto não existir, a vitrine exibe a cor da caixa (coluna `cor_hex`)
no lugar — o site continua apresentável.

---

## Decisões técnicas

- **Por que existe uma API em C#.** O navegador não abre conexão TCP com o
  MySQL. O JavaScript pede os dados à API, e só a API conversa com o banco.
- **O preço vem do banco, nunca do formulário.** O front envia apenas o id do
  produto, o tamanho e a quantidade. Se o preço viesse do navegador, qualquer
  pessoa o alteraria pelo console do F12.
- **O checkout é uma transação.** Cliente, pedido, itens, baixa de estoque e
  pagamento são gravados juntos; se um passo falhar, nada é gravado. Sem isso
  seria possível vender um par que não existe.
- **Estoque validado no servidor.** A checagem no JavaScript é só para dar
  retorno rápido ao usuário; a que vale é a do C#.

---

## Testando

- Filtre pelo número **37** e veja a vitrine mudar.
- Adicione dois modelos à sacola e observe o frete zerar acima de R$ 299,90.
- No checkout, digite o CEP `30720-540` — o endereço se completa sozinho.
- Pague com **Pix**: o pedido já sai como Aprovado.
- Consulte o CPF `104.552.336-71` em *Meus pedidos* — há um pedido de exemplo
  no banco.

---

## Observações

Os tênis do catálogo usam nomes de modelos reais, entre os mais procurados no
Brasil, e os sapatos têm nomes fictícios. Os preços são aproximados do varejo e
servem apenas como dado de exemplo. É um projeto acadêmico, sem qualquer vínculo
com as marcas citadas e sem fim comercial.

---

## Autor

Vinicius Costa e Vitoria Costa — Técnico em Desenvolvimento de Sistemas, SENAI CTTI, Belo Horizonte/MG.
