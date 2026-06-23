import { normalizeMojibakeText } from "@/lib/utils/text";

export const redicomFields = [
  { key: "encomendaId", csvHeader: "EncomendaID", label: "Encomenda ID" },
  { key: "encomendaRef", csvHeader: "EncomendaRef", label: "Ref." },
  { key: "encomendaEstado", csvHeader: "EncomendaEstado", label: "Estado" },
  { key: "tipo", csvHeader: "Tipo", label: "Tipo" },
  { key: "canal", csvHeader: "Canal", label: "Canal" },
  { key: "isaLoja", csvHeader: "ISALoja", label: "Loja", hidden: true },
  { key: "faturaData", csvHeader: "FaturaData", label: "Data fatura" },
  { key: "fatura", csvHeader: "Fatura", label: "Fatura" },
  { key: "productSku", csvHeader: "ProductSKU", label: "SKU" },
  { key: "productId", csvHeader: "ProductID", label: "Produto ID" },
  { key: "quantidadeUni", csvHeader: "QuantidadeUni", label: "Qtd. uni." },
  { key: "produtoValor", csvHeader: "ProdutoValor", label: "Valor produto" },
  {
    key: "produtoValorRiscado",
    csvHeader: "ProdutoValorRiscado",
    label: "Valor riscado",
  },
  { key: "familiaNome", csvHeader: "FamiliaNome", label: "Família" },
  { key: "subFamiliaNome", csvHeader: "SubFamiliaNome", label: "Subfamília" },
  { key: "marca", csvHeader: "Marca", label: "Marca" },
  { key: "estacao", csvHeader: "Estacao", label: "Estação" },
  { key: "genero", csvHeader: "Genero", label: "Género" },
  { key: "categoria", csvHeader: "Categoria", label: "Categoria" },
  { key: "subCategoria", csvHeader: "SubCategoria", label: "Subcategoria" },
  { key: "faixaEtaria", csvHeader: "FaixaEtaria", label: "Faixa etária" },
  { key: "encomendaData", csvHeader: "EncomendaData", label: "Data encomenda" },
  {
    key: "encomendaDataHora",
    csvHeader: "EncomendaDataHora",
    label: "Data/hora encomenda",
  },
  { key: "encomendaMoeda", csvHeader: "EncomendaMoeda", label: "Moeda" },
  { key: "encomendaCambio", csvHeader: "EncomendaCambio", label: "Câmbio" },
  {
    key: "encomendaQuantidade",
    csvHeader: "EncomendaQuantidade",
    label: "Qtd. encomenda",
  },
  {
    key: "encomendaValorTotal",
    csvHeader: "EncomendaValorTotal",
    label: "Total",
  },
  {
    key: "encomendaPortesValor",
    csvHeader: "EncomendaPortesValor",
    label: "Portes",
  },
  { key: "metodoEntrega", csvHeader: "MetodoEntrega", label: "Entrega" },
  { key: "metodoEntregaId", csvHeader: "MetodoEntregaID", label: "Entrega ID" },
  {
    key: "servicoTransportadora",
    csvHeader: "ServicoTransportadora",
    label: "Transportadora",
  },
  { key: "metodoPagamento", csvHeader: "MetodoPagamento", label: "Pagamento" },
  { key: "encomendaPaga", csvHeader: "EncomendaPaga", label: "Paga" },
  { key: "cupaoId", csvHeader: "CupaoID", label: "Cupão ID" },
  { key: "cupao", csvHeader: "Cupao", label: "Cupão" },
  { key: "desconto", csvHeader: "Desconto", label: "Desconto" },
  {
    key: "servicoPagamento",
    csvHeader: "ServicoPagamento",
    label: "Serviço pagamento",
  },
  { key: "clienteId", csvHeader: "ClienteID", label: "Cliente ID" },
  { key: "clienteNome", csvHeader: "ClienteNome", label: "Cliente" },
  { key: "clienteEmail", csvHeader: "ClienteEmail", label: "Email" },
  {
    key: "clienteCodigoErp",
    csvHeader: "ClienteCodigoERP",
    label: "Código ERP",
  },
  {
    key: "clienteDataRegisto",
    csvHeader: "ClienteDataRegisto",
    label: "Data registo",
  },
  { key: "clienteRegistado", csvHeader: "ClienteRegistado", label: "Registado" },
  { key: "codigoPostal", csvHeader: "CodigoPostal", label: "Código postal" },
  { key: "clientePais", csvHeader: "ClientePais", label: "País cliente" },
  { key: "pickupNome", csvHeader: "PickupNome", label: "Pickup" },
  {
    key: "encomendaArmazemId",
    csvHeader: "EncomendaArmazemID",
    label: "Armazém ID",
  },
  { key: "encomendaArmazem", csvHeader: "EncomendaArmazem", label: "Armazém" },
  { key: "encomendaPais", csvHeader: "EncomendaPais", label: "País encomenda" },
  { key: "encomendaMercado", csvHeader: "EncomendaMercado", label: "Mercado" },
  {
    key: "paraOferecer",
    csvHeader: "ParaOferecer",
    label: "Para oferecer",
    hidden: true,
  },
  {
    key: "mensagemOferta",
    csvHeader: "MensagemOferta",
    label: "Mensagem oferta",
    hidden: true,
  },
] as const;

export const redicomHeaders = redicomFields.map((field) => field.csvHeader);

export type RedicomField = (typeof redicomFields)[number];
export type RedicomFieldKey = RedicomField["key"];
export type RedicomCsvHeader = RedicomField["csvHeader"];
export type RedicomCsvRow = Record<RedicomCsvHeader, string>;
export type RedicomSaleRow = Record<RedicomFieldKey, string>;

export function normalizeRedicomText(value: unknown) {
  return normalizeMojibakeText(value);
}
