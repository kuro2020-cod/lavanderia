import db from '../database/db.js';

const normalizar = (item) => {
  const nombre = String(item?.nombre || '').trim();
  const precio = Number(String(item?.precio ?? '').replace(',', '.'));
  if (!nombre) return null;
  return { nombre, precio: Number.isFinite(precio) && precio >= 0 ? Math.round(precio * 100) / 100 : 0 };
};

export class PrendaLavanderia {
  static async listar() {
    return db.all('SELECT * FROM prendas_lavanderia ORDER BY orden, nombre');
  }

  static async create(data) {
    const prenda = normalizar(data);
    if (!prenda) throw new Error('Escribí el nombre de la prenda');
    const existente = await db.get(
      'SELECT id FROM prendas_lavanderia WHERE LOWER(nombre) = LOWER(?)',
      [prenda.nombre]
    );
    if (existente) throw new Error('Esa prenda ya está en el listado');
    const orden = await db.get('SELECT COALESCE(MAX(orden), -1) + 1 AS orden FROM prendas_lavanderia');
    const result = await db.run(
      'INSERT INTO prendas_lavanderia (nombre, precio, orden) VALUES (?, ?, ?)',
      [prenda.nombre, prenda.precio, orden?.orden ?? 0]
    );
    return db.get('SELECT * FROM prendas_lavanderia WHERE id = ?', [result.lastID]);
  }

  static async update(id, data) {
    const actual = await db.get('SELECT * FROM prendas_lavanderia WHERE id = ?', [id]);
    if (!actual) throw new Error('Prenda no encontrada');
    const prenda = normalizar({ nombre: data?.nombre ?? actual.nombre, precio: data?.precio ?? actual.precio });
    if (!prenda) throw new Error('Escribí el nombre de la prenda');
    const duplicada = await db.get(
      'SELECT id FROM prendas_lavanderia WHERE LOWER(nombre) = LOWER(?) AND id <> ?',
      [prenda.nombre, id]
    );
    if (duplicada) throw new Error('Esa prenda ya está en el listado');
    await db.run('UPDATE prendas_lavanderia SET nombre = ?, precio = ? WHERE id = ?', [
      prenda.nombre,
      prenda.precio,
      id
    ]);
    return db.get('SELECT * FROM prendas_lavanderia WHERE id = ?', [id]);
  }

  static async delete(id) {
    await db.run('DELETE FROM prendas_lavanderia WHERE id = ?', [id]);
    return { success: true };
  }
}
