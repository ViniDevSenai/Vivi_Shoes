// =====================================================================
// Vivi Shoes - API da loja (ASP.NET Core + Dapper + MySQL)
//
//     cd api
//     dotnet run        ->  http://localhost:5000
//
// Rotas:
//     GET  /api/produtos       catalogo com a grade de numeracao
//     POST /api/checkout       grava cliente, pedido, itens e pagamento
//     GET  /api/pedidos?cpf=   pedidos daquele cliente
// =====================================================================

using System.Text.Json.Serialization;
using Dapper;
using MySqlConnector;

var builder = WebApplication.CreateBuilder(args);


builder.Services.ConfigureHttpJsonOptions(o =>
    o.SerializerOptions.NumberHandling = JsonNumberHandling.AllowReadingFromString);

// libera o site (que roda em outra porta) a chamar esta API
builder.Services.AddCors(o => o.AddDefaultPolicy(p =>
    p.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod()));

var app = builder.Build();
app.UseCors();

var textoConexao = builder.Configuration.GetConnectionString("Vivishoes")!;
MySqlConnection Abrir() => new(textoConexao);

IResult Erro(string mensagem) => Results.BadRequest(new { erro = mensagem });

// regra do frete
const decimal Frete = 24.90m;
const decimal FreteGratisAcimaDe = 299.90m;


//  vitrine: produtos + a grade de numeracao de cada um

app.MapGet("/api/produtos", async () =>
{
    using var con = Abrir();

    var produtos = (await con.QueryAsync<Produto>(
        "select * from Produto order by nome")).ToList();

    var grade = (await con.QueryAsync<GradeItem>(
        "select id_produto, tamanho, quantidade from Estoque order by tamanho")).ToList();

    var vitrine = produtos.Select(p => new
    {
        p.id_produto, p.nome, p.descricao, p.cor, p.cor_hex, p.imagem, p.valor,
        grade = grade.Where(g => g.id_produto == p.id_produto)
    });

    return Results.Ok(vitrine);
});


app.MapPost("/api/checkout", async (Compra compra) =>
{
    var cliente = compra.cliente;

    if (cliente is null ||
        string.IsNullOrWhiteSpace(cliente.nome) ||
        string.IsNullOrWhiteSpace(cliente.cpf) ||
        string.IsNullOrWhiteSpace(cliente.cep))
        return Erro("Preencha nome, CPF e CEP.");

    if (compra.itens is null || compra.itens.Count == 0)
        return Erro("Sua sacola esta vazia.");

    using var con = Abrir();
    await con.OpenAsync();
    using var transacao = await con.BeginTransactionAsync();

    // o cliente e reconhecido pelo CPF: se ja comprou, atualiza os dados
    var idCliente = await con.ExecuteScalarAsync<int?>(
        "select id_cliente from Clientes where cpf = @cpf", new { cliente.cpf }, transacao);

    if (idCliente is null)
    {
        idCliente = await con.ExecuteScalarAsync<int>(
            """
            insert into Clientes (nome, cpf, email, telefone, cep, logradouro,
                                  numero, complemento, bairro, cidade, uf)
            values (@nome, @cpf, @email, @telefone, @cep, @logradouro,
                    @numero, @complemento, @bairro, @cidade, @uf);
            select last_insert_id();
            """, cliente, transacao);
    }
    else
    {
        await con.ExecuteAsync(
            """
            update Clientes set nome = @nome, email = @email, telefone = @telefone,
                   cep = @cep, logradouro = @logradouro, numero = @numero,
                   complemento = @complemento, bairro = @bairro,
                   cidade = @cidade, uf = @uf
             where cpf = @cpf
            """, cliente, transacao);
    }

    // confere o estoque e soma o total usando o preco do BANCO,
    // nunca o preco que veio do navegador
    decimal subtotal = 0;
    var conferidos = new List<Conferido>();

    foreach (var item in compra.itens)
    {
        var pares = item.quantidade < 1 ? 1 : item.quantidade;

        var linha = await con.QuerySingleOrDefaultAsync<LinhaEstoque>(
            """
            select p.nome, p.valor, e.quantidade
              from Produto p
              join Estoque e on e.id_produto = p.id_produto
             where p.id_produto = @id_produto and e.tamanho = @tamanho
            """, new { item.id_produto, item.tamanho }, transacao);

        if (linha is null)
            return Erro("Um dos modelos saiu do catalogo. Revise a sacola.");

        if (linha.quantidade < pares)
            return Erro($"{linha.nome} no numero {item.tamanho}: restam {linha.quantidade}.");

        subtotal += linha.valor * pares;
        conferidos.Add(new Conferido(item.id_produto, item.tamanho, pares, linha.valor));
    }

    var frete = subtotal >= FreteGratisAcimaDe ? 0m : Frete;
    var total = subtotal + frete;

    // Pix ja entra aprovado; as outras formas ficam aguardando
    var pago = compra.forma_pagamento == "Pix";

    var idPedido = await con.ExecuteScalarAsync<int>(
        """
        insert into Pedido (id_cliente, status_pedido, valor_frete, valor_total)
        values (@idCliente, @status, @frete, @total);
        select last_insert_id();
        """,
        new { idCliente, status = pago ? "Aprovado" : "Pendente", frete, total }, transacao);

    foreach (var item in conferidos)
    {
        await con.ExecuteAsync(
            """
            insert into ItensPedido (id_pedido, id_produto, tamanho, quantidade, valor_unitario)
            values (@idPedido, @id_produto, @tamanho, @quantidade, @valor_unitario)
            """,
            new { idPedido, item.id_produto, item.tamanho, item.quantidade, item.valor_unitario },
            transacao);

        await con.ExecuteAsync(
            """
            update Estoque set quantidade = quantidade - @quantidade
             where id_produto = @id_produto and tamanho = @tamanho
            """,
            new { item.quantidade, item.id_produto, item.tamanho }, transacao);
    }

    await con.ExecuteAsync(
        """
        insert into Pagamento (id_pedido, forma_pagamento, status_pagamento, valor)
        values (@idPedido, @forma, @status, @total)
        """,
        new
        {
            idPedido,
            forma = compra.forma_pagamento,
            status = pago ? "Pago" : "Aguardando",
            total
        }, transacao);

    await transacao.CommitAsync();

    return Results.Ok(new
    {
        id_pedido = idPedido,
        subtotal,
        frete,
        valor_total = total,
        pago
    });
});


// meus pedidos (consulta pelo CPF)

app.MapGet("/api/pedidos", async (string? cpf) =>
{
    if (string.IsNullOrWhiteSpace(cpf))
        return Erro("Informe o CPF.");

    using var con = Abrir();

    var pedidos = (await con.QueryAsync<PedidoResumo>(
        """
        select ped.id_pedido,
               date_format(ped.data_pedido, '%d/%m/%Y') as data_pedido,
               ped.status_pedido,
               ped.valor_frete,
               ped.valor_total,
               pag.forma_pagamento,
               pag.status_pagamento
          from Pedido ped
          join Clientes cli on cli.id_cliente = ped.id_cliente
          left join Pagamento pag on pag.id_pedido = ped.id_pedido
         where cli.cpf = @cpf
         order by ped.id_pedido desc
        """, new { cpf })).ToList();

    if (pedidos.Count == 0)
        return Results.Ok(Array.Empty<object>());

    var itens = (await con.QueryAsync<ItemResumo>(
        """
        select i.id_pedido, p.nome as produto, i.tamanho, i.quantidade, i.valor_unitario
          from ItensPedido i
          join Produto p on p.id_produto = i.id_produto
         where i.id_pedido in @ids
        """, new { ids = pedidos.Select(p => p.id_pedido).ToArray() })).ToList();

    return Results.Ok(pedidos.Select(p => new
    {
        p.id_pedido, p.data_pedido, p.status_pedido, p.valor_frete, p.valor_total,
        p.forma_pagamento, p.status_pagamento,
        itens = itens.Where(i => i.id_pedido == p.id_pedido)
    }));
});

app.Run("http://localhost:5000");

// ---------------------------------------------------------------------
record Produto(int id_produto, string nome, string? descricao, string? cor,
               string? cor_hex, string? imagem, decimal valor);

record GradeItem(int id_produto, string tamanho, int quantidade);

record ClienteCompra(string? nome, string? cpf, string? email, string? telefone,
                     string? cep, string? logradouro, string? numero,
                     string? complemento, string? bairro, string? cidade, string? uf);

record ItemCompra(int id_produto, string tamanho, int quantidade);

record Compra(ClienteCompra? cliente, List<ItemCompra>? itens, string? forma_pagamento);

record Conferido(int id_produto, string tamanho, int quantidade, decimal valor_unitario);

record LinhaEstoque(string nome, decimal valor, int quantidade);

record PedidoResumo(int id_pedido, string data_pedido, string status_pedido,
                    decimal valor_frete, decimal valor_total,
                    string? forma_pagamento, string? status_pagamento);

record ItemResumo(int id_pedido, string produto, string tamanho,
                  int quantidade, decimal valor_unitario);
