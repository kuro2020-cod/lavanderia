import express from 'express';
import { PrendaLavanderia } from '../models/PrendaLavanderia.js';

const router = express.Router();

const mensajes = ['Escribí el nombre de la prenda', 'Esa prenda ya está en el listado', 'Prenda no encontrada'];

const estado = (error) => {
  if (error.message === 'Prenda no encontrada') return 404;
  return mensajes.includes(error.message) ? 400 : 500;
};

router.get('/', async (req, res) => {
  try {
    res.json(await PrendaLavanderia.listar());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    res.status(201).json(await PrendaLavanderia.create(req.body));
  } catch (error) {
    res.status(estado(error)).json({ error: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    res.json(await PrendaLavanderia.update(req.params.id, req.body));
  } catch (error) {
    res.status(estado(error)).json({ error: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const actual = await PrendaLavanderia.listar();
    if (!actual.some((item) => Number(item.id) === Number(req.params.id))) {
      return res.status(404).json({ error: 'Prenda no encontrada' });
    }
    res.json(await PrendaLavanderia.delete(req.params.id));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
