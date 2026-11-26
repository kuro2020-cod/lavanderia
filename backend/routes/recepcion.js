import express from 'express';
import { PedidoLavanderia } from '../models/PedidoLavanderia.js';

const router = express.Router();

const mensajes = [
  'Elegí un cliente cargado',
  'Elegí un cliente',
  'Elegí un servicio',
  'Agregá al menos una prenda',
  'Estado no válido',
  'Pedido no encontrado'
];

router.get('/', async (req, res) => {
  try {
    const pedidos = await PedidoLavanderia.listar({
      desde: req.query.desde,
      hasta: req.query.hasta,
      clienteId: req.query.cliente_id
    });
    res.json(pedidos);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const pedido = await PedidoLavanderia.create(req.body);
    res.status(201).json(pedido);
  } catch (error) {
    const status = mensajes.includes(error.message) ? 400 : 500;
    res.status(status).json({ error: error.message });
  }
});

router.put('/:id/estado', async (req, res) => {
  try {
    const pedido = await PedidoLavanderia.cambiarEstado(req.params.id, req.body?.estado);
    res.json(pedido);
  } catch (error) {
    const status = error.message === 'Pedido no encontrado' ? 404 : mensajes.includes(error.message) ? 400 : 500;
    res.status(status).json({ error: error.message });
  }
});

export default router;
