import express from 'express';
import { Cliente } from '../models/Cliente.js';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const clientes = await Cliente.getAll();
    res.json(clientes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const cliente = await Cliente.getById(req.params.id);
    if (!cliente) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }
    res.json(cliente);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const cliente = await Cliente.create(req.body);
    res.status(201).json(cliente);
  } catch (error) {
    const status = error.message === 'El nombre del cliente es requerido' ? 400 : 500;
    res.status(status).json({ error: error.message });
  }
});

router.put('/:id/ficha', async (req, res) => {
  try {
    const cliente = await Cliente.updateFicha(req.params.id, req.body?.items);
    res.json(cliente);
  } catch (error) {
    const conocidos = ['Cliente no encontrado', 'La ficha es requerida', 'Hay un detalle que no pertenece a este cliente'];
    const status = error.message === 'Cliente no encontrado' ? 404 : conocidos.includes(error.message) ? 400 : 500;
    res.status(status).json({ error: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const cliente = await Cliente.update(req.params.id, req.body);
    res.json(cliente);
  } catch (error) {
    const status = error.message === 'Cliente no encontrado'
      ? 404
      : error.message === 'El nombre del cliente es requerido'
        ? 400
        : 500;
    res.status(status).json({ error: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const cliente = await Cliente.getById(req.params.id);
    if (!cliente) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }
    await Cliente.delete(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
