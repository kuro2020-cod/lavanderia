import db from '../database/db.js';

const ESTADOS = ['recibido', 'en_lavado', 'listo', 'entregado'];

const round2 = (n) => Math.round(Number(n) * 100) / 100;

export class PedidoLavanderia {
  static async listar(filtros = {}) {
    const where = [];
    const params = [];
    const desde = String(filtros.desde || '').trim();
    const hasta = String(filtros.hasta || '').trim();
    const clienteId = filtros.clienteId ? Number(filtros.clienteId) : null;

    if (desde) {
      where.push('p.created_at::date >= ?::date');
      params.push(desde);
    }
    if (hasta) {
      where.push('p.created_at::date <= ?::date');
      params.push(hasta);
    }
    if (clienteId) {
      where.push('p.cliente_id = ?');
      params.push(clienteId);
    }

    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    return db.all(
      `
      SELECT p.*,
        c.telefono AS cliente_telefono,
        c.direccion AS cliente_direccion,
        COALESCE(
          json_agg(
            json_build_object(
              'id', i.id,
              'prenda', i.prenda,
              'cantidad', i.cantidad,
              'precio', i.precio
            )
            ORDER BY i.orden, i.id
          ) FILTER (WHERE i.id IS NOT NULL),
          '[]'
        ) AS items
      FROM pedidos_lavanderia p
      LEFT JOIN clientes c ON c.id = p.cliente_id
      LEFT JOIN pedido_lavanderia_items i ON i.pedido_id = p.id
      ${clause}
      GROUP BY p.id, c.telefono, c.direccion
      ORDER BY p.created_at DESC, p.id DESC
    `,
      params
    );
  }

  static async getById(id) {
    const pedido = await db.get('SELECT * FROM pedidos_lavanderia WHERE id = ?', [id]);
    if (!pedido) return null;
    const items = await db.all(
      `SELECT id, prenda, cantidad, precio, orden
       FROM pedido_lavanderia_items
       WHERE pedido_id = ?
       ORDER BY orden, id`,
      [id]
    );
    return { ...pedido, items };
  }

  static async create(data) {
    const clienteId = data?.cliente_id ? Number(data.cliente_id) : null;
    let clienteNombre = String(data?.cliente_nombre || '').trim();
    if (clienteId) {
      const cliente = await db.get('SELECT id, nombre FROM clientes WHERE id = ?', [clienteId]);
      if (!cliente) throw new Error('Elegí un cliente cargado');
      clienteNombre = cliente.nombre;
    }
    if (!clienteNombre) throw new Error('Elegí un cliente');

    const crudosServicios = Array.isArray(data?.servicios)
      ? data.servicios
      : String(data?.servicio || '').split(',');
    const servicios = [...new Set(crudosServicios.map((item) => String(item || '').trim()).filter(Boolean))];
    if (!servicios.length) throw new Error('Elegí un servicio');
    const servicio = servicios.join(', ');

    const fechaEntrega = String(data?.fecha_entrega || '').trim() || null;
    const observaciones = String(data?.observaciones || '').trim() || null;
    const crudos = Array.isArray(data?.items) ? data.items : [];
    const items = crudos
      .map((item, index) => {
        const prenda = String(item?.prenda || '').trim();
        const cantidad = round2(item?.cantidad);
        const precio = round2(item?.precio);
        if (!prenda || !Number.isFinite(cantidad) || cantidad <= 0) return null;
        if (!Number.isFinite(precio) || precio < 0) return null;
        return { prenda, cantidad, precio, orden: index };
      })
      .filter(Boolean);
    if (!items.length) throw new Error('Agregá al menos una prenda');

    const total = round2(items.reduce((sum, item) => sum + item.cantidad * item.precio, 0));

    const id = await db.transaction(async (tx) => {
      const result = await tx.run(
        `INSERT INTO pedidos_lavanderia
          (cliente_id, cliente_nombre, servicio, fecha_entrega, observaciones, total)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [clienteId, clienteNombre, servicio, fechaEntrega, observaciones, total]
      );
      for (const item of items) {
        await tx.run(
          `INSERT INTO pedido_lavanderia_items (pedido_id, prenda, cantidad, precio, orden)
           VALUES (?, ?, ?, ?, ?)`,
          [result.lastID, item.prenda, item.cantidad, item.precio, item.orden]
        );
      }
      return result.lastID;
    });

    return this.getById(id);
  }

  static async cambiarEstado(id, estado) {
    if (!ESTADOS.includes(estado)) throw new Error('Estado no válido');
    const existente = await db.get('SELECT id FROM pedidos_lavanderia WHERE id = ?', [id]);
    if (!existente) throw new Error('Pedido no encontrado');
    await db.run('UPDATE pedidos_lavanderia SET estado = ? WHERE id = ?', [estado, id]);
    return this.getById(id);
  }
}
