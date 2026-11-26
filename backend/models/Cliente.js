import db from '../database/db.js';

/** Ficha de muestra. Después se reemplaza por los datos reales de cada pedido. */
export const FICHA_MUESTRA = [
  { concepto: 'Prendas recibidas', detalle: 'Camisa, pantalón, sábana, toalla' },
  { concepto: 'Servicio', detalle: 'Lavado, secado y planchado' },
  { concepto: 'Cantidad de prendas', detalle: '8' },
  { concepto: 'Peso', detalle: '3,5 kg' },
  { concepto: 'Tipo de tela', detalle: 'Algodón y prendas delicadas' },
  { concepto: 'Separación por color', detalle: 'Claros y oscuros por separado' },
  { concepto: 'Manchas o daños previos', detalle: 'Anotar al recibir (ejemplo: mancha en el cuello)' },
  { concepto: 'Tratamiento especial', detalle: 'Sin blanqueador, agua fría' },
  { concepto: 'Fecha de ingreso', detalle: 'Día en que se recibe la ropa' },
  { concepto: 'Fecha prometida de entrega', detalle: 'Según el servicio elegido' },
  { concepto: 'Estado del pedido', detalle: 'Recibido, en lavado, listo o entregado' },
  { concepto: 'Precio', detalle: 'A definir según prendas y servicio' },
  { concepto: 'Forma de pago', detalle: 'Efectivo, transferencia o cuenta corriente' },
  { concepto: 'Retiro', detalle: 'En el local o envío a domicilio' }
];

export class Cliente {
  static async getAll() {
    return db.all(`
      SELECT c.*, COUNT(f.id)::int AS total_items
      FROM clientes c
      LEFT JOIN cliente_ficha f ON f.cliente_id = c.id
      GROUP BY c.id
      ORDER BY c.nombre
    `);
  }

  static async getById(id) {
    const cliente = await db.get('SELECT * FROM clientes WHERE id = ?', [id]);
    if (!cliente) return null;
    const ficha = await db.all(
      `SELECT id, concepto, detalle, orden
       FROM cliente_ficha
       WHERE cliente_id = ?
       ORDER BY orden, id`,
      [id]
    );
    return { ...cliente, ficha };
  }

  static async create(data) {
    const nombre = String(data?.nombre || '').trim();
    if (!nombre) {
      throw new Error('El nombre del cliente es requerido');
    }
    const telefono = String(data?.telefono || '').trim() || null;
    const direccion = String(data?.direccion || '').trim() || null;
    const notas = String(data?.notas || '').trim() || null;

    const id = await db.transaction(async (tx) => {
      const result = await tx.run(
        'INSERT INTO clientes (nombre, telefono, direccion, notas) VALUES (?, ?, ?, ?)',
        [nombre, telefono, direccion, notas]
      );
      for (let i = 0; i < FICHA_MUESTRA.length; i += 1) {
        const item = FICHA_MUESTRA[i];
        await tx.run(
          'INSERT INTO cliente_ficha (cliente_id, concepto, detalle, orden) VALUES (?, ?, ?, ?)',
          [result.lastID, item.concepto, item.detalle, i]
        );
      }
      return result.lastID;
    });

    return this.getById(id);
  }

  static async update(id, data) {
    const existente = await db.get('SELECT id FROM clientes WHERE id = ?', [id]);
    if (!existente) {
      throw new Error('Cliente no encontrado');
    }
    const nombre = String(data?.nombre || '').trim();
    if (!nombre) {
      throw new Error('El nombre del cliente es requerido');
    }
    const telefono = String(data?.telefono || '').trim() || null;
    const direccion = String(data?.direccion || '').trim() || null;
    const notas = String(data?.notas || '').trim() || null;

    await db.run(
      'UPDATE clientes SET nombre = ?, telefono = ?, direccion = ?, notas = ? WHERE id = ?',
      [nombre, telefono, direccion, notas, id]
    );
    return this.getById(id);
  }

  static async updateFicha(clienteId, items) {
    const existente = await db.get('SELECT id FROM clientes WHERE id = ?', [clienteId]);
    if (!existente) {
      throw new Error('Cliente no encontrado');
    }
    if (!Array.isArray(items)) {
      throw new Error('La ficha es requerida');
    }

    await db.transaction(async (tx) => {
      for (const item of items) {
        const detalle = String(item?.detalle ?? '').trim();
        const result = await tx.run(
          'UPDATE cliente_ficha SET detalle = ? WHERE id = ? AND cliente_id = ?',
          [detalle, item.id, clienteId]
        );
        if (!result.changes) {
          throw new Error('Hay un detalle que no pertenece a este cliente');
        }
      }
    });

    return this.getById(clienteId);
  }

  static async delete(id) {
    await db.run('DELETE FROM clientes WHERE id = ?', [id]);
    return { success: true };
  }
}
