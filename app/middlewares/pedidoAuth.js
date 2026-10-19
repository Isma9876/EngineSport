const db = require("../models");

const Pedido = db.pedidos;
const Cliente = db.clientes;

// Helpers para authJwt.isEmpleadoODueno: cada uno recibe req y devuelve el
// id_usuario dueño del recurso (o null si el recurso no existe).

// Dueño de un pedido. Toma el id de req.params.id, req.params.idPedido o req.body.id_pedido.
const obtenerIdUsuarioDePedido = async (req) => {
  const idPedido = req.params.id ?? req.params.idPedido ?? req.body?.id_pedido;
  if (!idPedido) return null;

  const pedido = await Pedido.findByPk(idPedido);
  if (!pedido) return null;

  const cliente = await Cliente.findByPk(pedido.id_cliente);
  return cliente ? cliente.id_usuario : null;
};

// Dueño de un cliente indicado en la ruta: /cliente/:idCliente
const obtenerIdUsuarioDeClientePorParam = async (req) => {
  const cliente = await Cliente.findByPk(req.params.idCliente);
  return cliente ? cliente.id_usuario : null;
};

// Dueño de un cliente indicado en el body: { id_cliente }
const obtenerIdUsuarioDeClienteEnBody = async (req) => {
  const idCliente = req.body?.id_cliente;
  if (!idCliente) return null;

  const cliente = await Cliente.findByPk(idCliente);
  return cliente ? cliente.id_usuario : null;
};

module.exports = {
  obtenerIdUsuarioDePedido,
  obtenerIdUsuarioDeClientePorParam,
  obtenerIdUsuarioDeClienteEnBody,
};