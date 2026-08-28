create database vivishoes character set utf8mb4 collate utf8mb4_unicode_ci;
use vivishoes;

create table Clientes (
    id_cliente  int auto_increment primary key,
    nome        varchar(200) not null,
    cpf         varchar(18)  not null unique,
    email       varchar(150),
    telefone    varchar(20),
    -- endereco preenchido pelo ViaCEP
    cep         varchar(9),
    logradouro  varchar(200),
    numero      varchar(15),
    complemento varchar(100),
    bairro      varchar(100),
    cidade      varchar(100),
    uf          char(2)
);

create table Produto (
    id_produto int auto_increment primary key,
    nome       varchar(100) not null,
    descricao  varchar(200),
    cor        varchar(50),
    cor_hex    varchar(7) default '#C7A175',   -- cor usada quando nao ha foto
    imagem     varchar(255),                  
    valor      decimal(8,2) not null
);

create table Estoque (
    id_estoque int auto_increment primary key,
    id_produto int        not null,
    tamanho    varchar(5) not null,
    quantidade int        not null default 0,
    unique key grade (id_produto, tamanho),
    foreign key (id_produto) references Produto (id_produto)
);

create table Pedido (
    id_pedido     int auto_increment primary key,
    id_cliente    int not null,
    status_pedido enum('Pendente', 'Aprovado', 'Enviado', 'Cancelado')
                  not null default 'Pendente',
    valor_frete   decimal(8,2) not null default 0,
    valor_total   decimal(8,2) not null,
    data_pedido   datetime default current_timestamp,
    foreign key (id_cliente) references Clientes (id_cliente)
);

create table ItensPedido (
    id_item        int auto_increment primary key,
    id_pedido      int not null,
    id_produto     int not null,
    tamanho        varchar(5)   not null,
    quantidade     int          not null default 1,
    valor_unitario decimal(8,2) not null,
    foreign key (id_pedido)  references Pedido  (id_pedido),
    foreign key (id_produto) references Produto (id_produto)
);

create table Pagamento (
    id_pagamento     int auto_increment primary key,
    id_pedido        int not null,
    forma_pagamento  enum('Pix', 'Cartao de credito', 'Cartao de debito', 'Boleto') not null,
    status_pagamento enum('Aguardando', 'Pago') not null default 'Aguardando',
    valor            decimal(8,2) not null,
    data_pagamento   datetime default current_timestamp,
    foreign key (id_pedido) references Pedido (id_pedido)
);


-- Catalogo


insert into Produto (nome, descricao, cor, cor_hex, valor) values
-- sapatos
('Mocassim Ravena',     'Couro legitimo, solado costurado.',              'Conhaque',        '#8A4B2A', 289.90),
('Scarpin Alfazema',    'Salto 7 cm, bico fino, verniz.',                 'Preto',           '#1B1620', 349.00),
('Sandalia Marilia',    'Tiras trancadas e palmilha macia.',              'Caramelo',        '#B4703A', 179.50),
('Bota Serrana',        'Cano curto, couro graxo, ziper.',                'Cafe',            '#4A342A', 459.00),
('Rasteira Bem-te-vi',  'Napa leve para o dia inteiro.',                  'Fucsia',          '#D31E63',  99.90),
('Mule Iracema',        'Salto bloco 5 cm em camurca.',                   'Musgo',           '#2C6B52', 269.00),
('Oxford Tereza',       'Bico redondo, cadarco encerado.',                'Azul noite',      '#23304F', 319.90),
-- tenis
('Nike Dunk Low Panda', 'Couro branco com sobreposicoes pretas.',         'Preto e branco',  '#EDEDED', 749.90),
('Adidas Samba OG',     'Camurca no bico e as tres listras classicas.',   'Preto',           '#14120F', 799.99),
('Asics Gel-1130',      'Amortecimento GEL, visual retro dos anos 2000.', 'Branco e prata',  '#C9CDD4', 799.90),
('Converse All Star',   'Chuck Taylor de cano alto, lona resistente.',    'Vermelho',        '#B3242C', 299.99),
('Olympikus Corre 3',   'Nacional, leve, para caminhada e corrida.',      'Lilas',           '#9B8ACB', 299.99),
('Vans Old Skool',      'Lona com camurca e a faixa lateral.',            'Preto e branco',  '#2A2A2A', 549.99),
('New Balance 530',     'Malha respiravel com detalhes prateados.',       'Cinza claro',     '#DDDCD8', 699.90);

-- grade de numeracao de cada modelo
insert into Estoque (id_produto, tamanho, quantidade) values
-- sapatos
(1,'34',3),(1,'35',5),(1,'36',8),(1,'37',6),(1,'38',4),(1,'39',2),
(2,'35',2),(2,'36',4),(2,'37',5),(2,'38',3),(2,'39',1),
(3,'35',4),(3,'36',6),(3,'37',5),(3,'38',2),(3,'39',0),
(4,'36',3),(4,'37',4),(4,'38',4),(4,'39',2),(4,'40',1),
(5,'33',5),(5,'34',7),(5,'35',8),(5,'36',9),(5,'37',6),(5,'38',4),
(6,'35',3),(6,'36',5),(6,'37',4),(6,'38',3),(6,'39',1),
(7,'36',2),(7,'37',3),(7,'38',5),(7,'39',4),(7,'40',2),(7,'41',1),
-- tenis
(8,'34',4),(8,'35',7),(8,'36',9),(8,'37',8),(8,'38',6),(8,'39',3),(8,'40',2),
(9,'34',3),(9,'35',6),(9,'36',8),(9,'37',7),(9,'38',5),(9,'39',2),
(10,'35',4),(10,'36',6),(10,'37',6),(10,'38',5),(10,'39',3),(10,'40',2),
(11,'34',6),(11,'35',8),(11,'36',10),(11,'37',9),(11,'38',7),(11,'39',4),(11,'40',3),
(12,'34',5),(12,'35',9),(12,'36',11),(12,'37',10),(12,'38',8),(12,'39',5),(12,'40',3),
(13,'35',3),(13,'36',5),(13,'37',6),(13,'38',4),(13,'39',2),(13,'40',1),
(14,'35',2),(14,'36',4),(14,'37',5),(14,'38',4),(14,'39',3),(14,'40',1);


-- Um pedido de exemplo, para testar a tela "Meus pedidos"
-- consultando o CPF 104.552.336-71

insert into Clientes (nome, cpf, email, telefone, cep, logradouro, numero, bairro, cidade, uf)
values ('Marina Alvarenga', '104.552.336-71', 'marina@exemplo.com', '(31) 98812-4407',
        '30720-540', 'Rua Padre Eustaquio', '812', 'Carlos Prates', 'Belo Horizonte', 'MG');

insert into Pedido (id_cliente, status_pedido, valor_frete, valor_total) values
(1, 'Enviado', 0, 1098.90);

insert into ItensPedido (id_pedido, id_produto, tamanho, quantidade, valor_unitario) values
(1, 2, '36', 1, 349.00),   -- Scarpin Alfazema
(1, 8, '36', 1, 749.90);   -- Nike Dunk Low Panda

insert into Pagamento (id_pedido, forma_pagamento, status_pagamento, valor) values
(1, 'Pix', 'Pago', 1098.90);


-- Fotos dos produtos


update Produto set imagem = 'img/mocassim-ravena.jpg'      where id_produto =  1;
update Produto set imagem = 'img/scarpin-alfazema.jpg'     where id_produto =  2;
update Produto set imagem = 'img/sandalia-marilia.jpg'     where id_produto =  3;
update Produto set imagem = 'img/bota-serrana.jpg'         where id_produto =  4;
update Produto set imagem = 'img/rasteira-bem-te-vi.jpg'   where id_produto =  5;
update Produto set imagem = 'img/mule-iracema.jpg'         where id_produto =  6;
update Produto set imagem = 'img/oxford-tereza.jpg'        where id_produto =  7;
update Produto set imagem = 'img/nike-dunk-low-panda.jpg'  where id_produto =  8;
update Produto set imagem = 'img/adidas-samba-og.jpg'      where id_produto =  9;
update Produto set imagem = 'img/asics-gel-1130.jpg'       where id_produto = 10;
update Produto set imagem = 'img/converse-all-star.jpg'    where id_produto = 11;
update Produto set imagem = 'img/olympikus-corre-3.jpg'    where id_produto = 12;
update Produto set imagem = 'img/vans-old-skool.jpg'       where id_produto = 13;
update Produto set imagem = 'img/new-balance-530.jpg'      where id_produto = 14;
