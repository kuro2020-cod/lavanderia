import db from '../database/db.js';
import { fechaLocalISO, normalizarFechaISO } from '../utils/fechaCaja.js';

const DIAS_ALERTA_VENCIMIENTO = 7;

function addDaysISO(iso, days) {
  const [y, m, d] = String(iso)
    .split('-')
    .map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

function diasHasta(hoyISO, fechaISO) {
  const [y1, m1, d1] = hoyISO.split('-').map(Number);
  const [y2, m2, d2] = fechaISO.split('-').map(Number);
  const a = Date.UTC(y1, m1 - 1, d1);
  const b = Date.UTC(y2, m2 - 1, d2);
  return Math.round((b - a) / 86400000);
}

const round4 = (n) => Math.round(Number(n) * 10000) / 10000;

function etiquetaUsuario(authUser) {
  if (!authUser) return 'Sistema';
  const label = [authUser.apellido, authUser.nombre].filter(Boolean).join(', ').trim();
  return label || authUser.usuario || 'Sistema';
}

function codigosEquivalentes(a, b) {
  const x = String(a || '').trim().toLowerCase();
  const y = String(b || '').trim().toLowerCase();
  if (!x || !y) return false;
  if (x === y) return true;
  if (/^\d+$/.test(x) && /^\d+$/.test(y)) {
    const nx = x.replace(/^0+/, '');
    const ny = y.replace(/^0+/, '');
    return nx !== '' && nx === ny;
  }
  return false;
}

function esFlagActivo(v) {
  if (v === true || v === 1) return true;
  if (v === false || v === 0 || v == null || v === '') return false;
  const s = String(v).trim().toLowerCase();
  return s === 'true' || s === '1' || s === 't' || s === 'on' || s === 'yes' || s === 'si' || s === 'sí';
}

function resolverFechaVencimiento(productoData, noControla, noVerifica) {
  const omitirFecha =
    esFlagActivo(noControla) ||
    esFlagActivo(noVerifica) ||
    esFlagActivo(productoData?.no_controla_stock) ||
    esFlagActivo(productoData?.no_verifica_vencimiento);
  if (omitirFecha) return null;
  const fecha = normalizarFechaISO(productoData?.fecha_vencimiento);
  if (!fecha) {
    throw new Error('La fecha de vencimiento es obligatoria para productos que controlan stock');
  }
  return fecha;
}

/**
 * Si stock_minimo queda en 0 (sin configurar), el stock se considera "bajo" cuando
 * stock_actual <= este valor. Unidades: 2; kg/l: 0.5.
 */
export const UMBRAL_STOCK_SIN_MINIMO_CONFIGURADO = 2;
/** Sin mínimo y unidad kg o litro: considerar stock bajo por debajo de esto */
export const UMBRAL_STOCK_KG_SIN_MINIMO = 0.5;

export class Producto {
  /**
   * Condición SQL unificada para listados y conteos de stock bajo.
   * @param {string} alias Prefijo de tabla (ej. 'p') o '' sin alias
   */
  static condicionStockBajo(alias = '') {
    const c = alias ? `${alias}.` : '';
    const um = `LOWER(TRIM(COALESCE(${c}unidad_medida, '')))`;
    const esMedidaDecimal = `(${um} IN ('kg', 'kilogramo', 'kilogramos', 'kilo', 'kilos', 'l', 'lt', 'litro', 'litros'))`;
    return `(
      COALESCE(${c}no_controla_stock, FALSE) = FALSE
      AND (
        (${c}stock_minimo > 0 AND ${c}stock_actual <= ${c}stock_minimo)
        OR (
          COALESCE(${c}stock_minimo, 0) = 0
          AND (
            (${esMedidaDecimal} AND ${c}stock_actual <= ${UMBRAL_STOCK_KG_SIN_MINIMO})
            OR (NOT (${esMedidaDecimal}) AND ${c}stock_actual <= ${UMBRAL_STOCK_SIN_MINIMO_CONFIGURADO})
          )
        )
      )
    )`;
  }

  static noControlaStock(producto) {
    return Boolean(producto?.no_controla_stock);
  }

  static async getAll() {
    const productos = await db.all(`
      SELECT p.*, c.nombre as categoria_nombre
      FROM productos p
      LEFT JOIN categorias c ON p.categoria_id = c.id
      ORDER BY p.created_at DESC
    `);
    return productos;
  }

  static async getById(id) {
    const producto = await db.get(`
      SELECT p.*, c.nombre as categoria_nombre
      FROM productos p
      LEFT JOIN categorias c ON p.categoria_id = c.id
      WHERE p.id = ?
    `, [id]);
    return producto;
  }

  static async getByCodigo(codigo) {
    const codigoNorm = String(codigo || '').trim();
    if (!codigoNorm) return null;
    const producto = await db.get(
      `
      SELECT * FROM productos
      WHERE LOWER(TRIM(codigo)) = LOWER(TRIM(?))
         OR (
           TRIM(?) ~ '^[0-9]+$'
           AND TRIM(codigo) ~ '^[0-9]+$'
           AND LTRIM(TRIM(codigo), '0') <> ''
           AND LTRIM(TRIM(codigo), '0') = LTRIM(TRIM(?), '0')
         )
      ORDER BY
        CASE WHEN LOWER(TRIM(codigo)) = LOWER(TRIM(?)) THEN 0 ELSE 1 END,
        id ASC
      LIMIT 1
    `,
      [codigoNorm, codigoNorm, codigoNorm, codigoNorm]
    );
    return producto;
  }

  /** Mismo nombre, ignorando reinicios de contador y el envase de sistema. */
  static async getHomonimosNombre(nombre) {
    const n = String(nombre || '').trim();
    if (!n) return [];
    const rows = await db.all(
      `
      SELECT * FROM productos
      WHERE LOWER(TRIM(nombre)) = LOWER(TRIM(?))
        AND UPPER(TRIM(COALESCE(codigo, ''))) NOT LIKE 'REINICIO-%'
        AND UPPER(TRIM(COALESCE(codigo, ''))) <> 'ENVASE'
      ORDER BY
        CASE WHEN TRIM(COALESCE(codigo, '')) = '' THEN 0 ELSE 1 END,
        id ASC
    `,
      [n]
    );
    return rows || [];
  }

  /**
   * Siguiente código numérico sugerido (max de códigos solo dígitos + 1).
   * Si no hay códigos numéricos, devuelve "1".
   */
  static async sugerirSiguienteCodigo() {
    const row = await db.get(`
      SELECT COALESCE(MAX(codigo::bigint), 0) AS max_num
      FROM productos
      WHERE codigo IS NOT NULL
        AND TRIM(codigo::text) <> ''
        AND codigo::text ~ '^[0-9]+$'
    `);
    const max = row?.max_num != null ? BigInt(row.max_num) : 0n;
    return String(max + 1n);
  }

  static async create(productoData, authUser = null) {
    const { codigo, nombre, descripcion, categoria_id, precio_compra, precio_venta, stock_actual, stock_minimo, unidad_medida, no_controla_stock, no_verifica_vencimiento } = productoData;
    const noControla = esFlagActivo(no_controla_stock);
    const noVerifica = esFlagActivo(no_verifica_vencimiento);

    // Validar nombre requerido
    if (!nombre || nombre.trim() === '') {
      throw new Error('El nombre del producto es requerido');
    }

    // Código único antes de la fecha: en carga, un producto existente
    // (papel, cigarrillos) debe poder actualizarse sin chocar por vencimiento.
    if (codigo) {
      const existente = await this.getByCodigo(codigo);
      if (existente) {
        throw new Error('Ya existe un producto con este código');
      }
    }

    const homonimos = await this.getHomonimosNombre(nombre);
    const destino = homonimos.find((p) => {
      const c = String(p.codigo || '').trim();
      const nuevo = String(codigo || '').trim();
      if (!c) return true;
      if (!nuevo) return false;
      return codigosEquivalentes(c, nuevo);
    });
    if (destino) {
      const err = new Error(
        `Ya existe "${destino.nombre}"${destino.codigo ? ` (código ${destino.codigo})` : ''}. La carga se suma a ese producto para no crear otro.`
      );
      err.code = 'PRODUCTO_NOMBRE_DUPLICADO';
      err.productoId = destino.id;
      throw err;
    }

    const fechaVenc = resolverFechaVencimiento(productoData, noControla, noVerifica);

    // Validar precios no negativos
    if (precio_compra < 0 || precio_venta < 0) {
      throw new Error('Los precios no pueden ser negativos');
    }

    const sa = noControla ? 0 : Number(stock_actual);
    const sm = noControla ? 0 : Number(stock_minimo);
    if (Number.isNaN(sa) || Number.isNaN(sm) || sa < 0 || sm < 0) {
      throw new Error('El stock no puede ser negativo');
    }

    const id = await db.transaction(async ({ run }) => {
      const result = await run(
        `
        INSERT INTO productos (codigo, nombre, descripcion, categoria_id, precio_compra, precio_venta, stock_actual, stock_minimo, unidad_medida, no_controla_stock, no_verifica_vencimiento, fecha_vencimiento)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
        [codigo || null, nombre.trim(), descripcion?.trim() || null, categoria_id || null, precio_compra || 0, precio_venta || 0, sa, sm, unidad_medida || 'unidad', noControla, noVerifica, fechaVenc]
      );
      if (!noControla && sa > 0) {
        await run(
          `
          INSERT INTO movimientos (producto_id, tipo, cantidad, motivo, usuario, precio_unitario, metodo_pago)
          VALUES (?, 'entrada', ?, 'Carga manual', ?, NULL, NULL)
        `,
          [result.lastID, round4(sa), etiquetaUsuario(authUser)]
        );
      }
      return result.lastID;
    });

    return this.getById(id);
  }

  static async update(id, productoData, authUser = null) {
    const { codigo, nombre, descripcion, categoria_id, precio_compra, precio_venta, stock_actual, stock_minimo, unidad_medida, no_controla_stock, no_verifica_vencimiento } = productoData;
    let noControla = esFlagActivo(no_controla_stock);
    const confirmarQuitarStock = esFlagActivo(productoData.confirmar_quitar_stock);
    const noVerifica = esFlagActivo(no_verifica_vencimiento);
    const fechaVenc = resolverFechaVencimiento(productoData, noControla, noVerifica);
    
    // Validar que el producto existe
    const productoExistente = await this.getById(id);
    if (!productoExistente) {
      throw new Error('Producto no encontrado');
    }

    // Validar nombre requerido
    if (!nombre || nombre.trim() === '') {
      throw new Error('El nombre del producto es requerido');
    }

    // Validar código único si se proporciona y es diferente al actual
    if (codigo && !codigosEquivalentes(codigo, productoExistente.codigo)) {
      const existente = await this.getByCodigo(codigo);
      if (existente && Number(existente.id) !== Number(id)) {
        throw new Error('Ya existe un producto con este código');
      }
    }

    // Validar precios no negativos
    if (precio_compra < 0 || precio_venta < 0) {
      throw new Error('Los precios no pueden ser negativos');
    }

    const tocarStock =
      Object.prototype.hasOwnProperty.call(productoData, 'stock_actual') &&
      stock_actual !== undefined;
    const tieneBase =
      Object.prototype.hasOwnProperty.call(productoData, 'stock_base') &&
      productoData.stock_base !== undefined &&
      productoData.stock_base !== null &&
      productoData.stock_base !== '';
    const tocarMinimo = Object.prototype.hasOwnProperty.call(productoData, 'stock_minimo');
    // Sin stock_base no se pisa el stock: un formulario abierto a la mañana
    // no puede borrar la mercadería que cargó otro usuario a la tarde.
    let delta = null;
    if (!noControla && tocarStock && tieneBase) {
      const nuevo = Number(stock_actual);
      const base = Number(productoData.stock_base);
      if (Number.isNaN(nuevo) || Number.isNaN(base)) {
        throw new Error('El stock no puede ser negativo');
      }
      delta = round4(nuevo - base);
    }
    const qtyIngresoRaw = productoData.cantidad_ingreso;
    const qtyIngreso =
      qtyIngresoRaw == null || qtyIngresoRaw === '' ? 0 : Number(String(qtyIngresoRaw).replace(',', '.'));
    let sumarIngreso = Number.isFinite(qtyIngreso) && qtyIngreso > 0;
    if (sumarIngreso && qtyIngreso > 1000000) {
      throw new Error('La cantidad a ingresar no es válida');
    }
    const sm = noControla
      ? 0
      : tocarMinimo
        ? Number(stock_minimo)
        : Number(productoExistente.stock_minimo);
    if (Number.isNaN(sm) || sm < 0) {
      throw new Error('El stock no puede ser negativo');
    }

    const tocarCategoria = Object.prototype.hasOwnProperty.call(productoData, 'categoria_id');
    const catId = tocarCategoria
      ? (categoria_id === '' || categoria_id == null ? null : categoria_id)
      : productoExistente.categoria_id;

    await db.transaction(async ({ get, run }) => {
      const locked = await get(
        `SELECT * FROM productos WHERE id = ? FOR UPDATE`,
        [id]
      );
      if (!locked) {
        throw new Error('Producto no encontrado');
      }
      const antes = Number(locked.stock_actual);
      const yaSinStock = esFlagActivo(locked.no_controla_stock);
      if (sumarIngreso && yaSinStock) {
        throw new Error('Este producto no controla stock. La carga no se registró y el stock no cambió.');
      }
      if (noControla && !yaSinStock && !confirmarQuitarStock) {
        noControla = false;
      }
      let sa = antes;
      if (noControla) {
        sa = 0;
        sumarIngreso = false;
      } else if (delta != null) {
        sa = round4(sa + delta);
      }
      if (sumarIngreso) {
        sa = round4(sa + qtyIngreso);
      }
      if (Number.isNaN(sa) || sa < 0) {
        throw new Error('El stock no puede ser negativo');
      }
      const diff = round4(sa - antes);
      if (Math.abs(diff) > 0.00005) {
        const sube = diff > 0;
        const soloCarga = sube && sumarIngreso && (delta == null || Math.abs(delta) < 0.00005);
        await run(
          `
          INSERT INTO movimientos (producto_id, tipo, cantidad, motivo, usuario, precio_unitario, metodo_pago)
          VALUES (?, ?, ?, ?, ?, NULL, NULL)
        `,
          [
            id,
            sube ? 'entrada' : 'ajuste',
            round4(Math.abs(diff)),
            soloCarga ? 'Carga manual' : 'Ajuste de stock',
            etiquetaUsuario(authUser)
          ]
        );
      }
      const smFinal = noControla
        ? 0
        : tocarMinimo && !esFlagActivo(productoData.no_controla_stock)
          ? Number(stock_minimo)
          : Number(productoExistente.stock_minimo);
      let fechaGuardar = fechaVenc;
      if (!noControla && !noVerifica && !fechaGuardar) {
        fechaGuardar = normalizarFechaISO(locked.fecha_vencimiento);
      }
      await run(
        `
        UPDATE productos
        SET codigo = ?, nombre = ?, descripcion = ?, categoria_id = ?,
            precio_compra = ?, precio_venta = ?, stock_actual = stock_actual + ?,
            stock_minimo = ?, unidad_medida = ?, no_controla_stock = ?,
            no_verifica_vencimiento = ?, fecha_vencimiento = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
        [
          codigo || null,
          nombre.trim(),
          descripcion?.trim() || null,
          catId,
          precio_compra || 0,
          precio_venta || 0,
          diff,
          Number.isNaN(smFinal) ? 0 : smFinal,
          unidad_medida || 'unidad',
          noControla,
          noVerifica,
          fechaGuardar,
          id
        ]
      );
    });

    return this.getById(id);
  }

  static async delete(id) {
    await db.run('DELETE FROM productos WHERE id = ?', [id]);
    return { success: true };
  }

  static async updateCategoria(id, categoriaId) {
    const existente = await this.getById(id);
    if (!existente) {
      throw new Error('Producto no encontrado');
    }
    let cat = categoriaId == null || categoriaId === '' ? null : Number(categoriaId);
    if (cat != null && !Number.isFinite(cat)) {
      throw new Error('Categoría inválida');
    }
    if (cat != null) {
      const row = await db.get('SELECT id FROM categorias WHERE id = ?', [cat]);
      if (!row) throw new Error('Categoría no encontrada');
    }
    await db.run(
      `
      UPDATE productos
      SET categoria_id = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `,
      [cat, id]
    );
    return this.getById(id);
  }

  static async asignarCategoria(ids, categoriaId) {
    const list = [...new Set((ids || []).map((n) => Number(n)).filter((n) => Number.isFinite(n) && n > 0))];
    if (!list.length) return { actualizados: 0 };
    const placeholders = list.map(() => '?').join(',');
    const result = await db.run(
      `
      UPDATE productos
      SET categoria_id = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id IN (${placeholders})
    `,
      [categoriaId, ...list]
    );
    return { actualizados: result.changes || 0 };
  }

  /**
   * Suma stock y deja la entrada en la misma transacción.
   * No pisa el stock con un número absoluto ni cambia el nombre.
   */
  static async ingresarStock(id, data, authUser = null) {
    const qtyRaw = data?.cantidad ?? data?.cantidad_ingreso;
    const hayCantidad = qtyRaw != null && String(qtyRaw).trim() !== '';
    const qty = hayCantidad ? Number(String(qtyRaw).replace(',', '.')) : 0;
    if (hayCantidad && (!Number.isFinite(qty) || qty < 0)) {
      throw new Error('La cantidad a ingresar no es válida');
    }
    if (qty > 1000000) {
      throw new Error('La cantidad a ingresar no es válida');
    }
    const sumar = qty > 0;
    const qtyOk = round4(qty);

    await db.transaction(async ({ get, run }) => {
      const locked = await get(`SELECT * FROM productos WHERE id = ? FOR UPDATE`, [id]);
      if (!locked) throw new Error('Producto no encontrado');
      if (sumar && esFlagActivo(locked.no_controla_stock)) {
        throw new Error('Este producto no controla stock. La carga no se registró y el stock no cambió.');
      }

      const sets = ['updated_at = CURRENT_TIMESTAMP'];
      const params = [];
      if (sumar) {
        sets.push('stock_actual = stock_actual + ?');
        params.push(qtyOk);
      }

      const setPrecio = (col, val) => {
        const n = Number(val);
        if (!Number.isFinite(n) || n < 0) throw new Error('Precio inválido');
        sets.push(`${col} = ?`);
        params.push(n);
      };
      if (Object.prototype.hasOwnProperty.call(data, 'precio_compra')) setPrecio('precio_compra', data.precio_compra);
      if (Object.prototype.hasOwnProperty.call(data, 'precio_venta')) setPrecio('precio_venta', data.precio_venta);
      if (Object.prototype.hasOwnProperty.call(data, 'descripcion')) {
        sets.push('descripcion = ?');
        params.push(String(data.descripcion || '').trim() || null);
      }
      if (Object.prototype.hasOwnProperty.call(data, 'unidad_medida') && String(data.unidad_medida || '').trim()) {
        sets.push('unidad_medida = ?');
        params.push(String(data.unidad_medida).trim());
      }
      if (Object.prototype.hasOwnProperty.call(data, 'categoria_id')) {
        const cat = data.categoria_id === '' || data.categoria_id == null ? null : Number(data.categoria_id);
        sets.push('categoria_id = ?');
        params.push(Number.isFinite(cat) ? cat : null);
      }
      if (esFlagActivo(data.no_verifica_vencimiento)) {
        sets.push('no_verifica_vencimiento = TRUE');
        sets.push('fecha_vencimiento = NULL');
      } else if (data.fecha_vencimiento) {
        const fecha = normalizarFechaISO(data.fecha_vencimiento);
        if (fecha) {
          sets.push('fecha_vencimiento = ?');
          params.push(fecha);
          sets.push('no_verifica_vencimiento = FALSE');
        }
      }

      const codigoNuevo = String(data.codigo_si_vacio || '').trim();
      if (codigoNuevo && !String(locked.codigo || '').trim()) {
        const ocupado = await get(
          `
          SELECT id FROM productos
          WHERE id <> ?
            AND (
              LOWER(TRIM(codigo)) = LOWER(TRIM(?))
              OR (
                TRIM(?) ~ '^[0-9]+$'
                AND TRIM(codigo) ~ '^[0-9]+$'
                AND LTRIM(TRIM(codigo), '0') <> ''
                AND LTRIM(TRIM(codigo), '0') = LTRIM(TRIM(?), '0')
              )
            )
          LIMIT 1
        `,
          [id, codigoNuevo, codigoNuevo, codigoNuevo]
        );
        if (!ocupado) {
          sets.push('codigo = ?');
          params.push(codigoNuevo);
        }
      }

      params.push(id);
      await run(`UPDATE productos SET ${sets.join(', ')} WHERE id = ?`, params);
      if (sumar) {
        await run(
          `
          INSERT INTO movimientos (producto_id, tipo, cantidad, motivo, usuario, precio_unitario, metodo_pago)
          VALUES (?, 'entrada', ?, 'Carga manual', ?, NULL, NULL)
        `,
          [id, qtyOk, etiquetaUsuario(authUser)]
        );
      }
    });

    return this.getById(id);
  }

  static async updateStock(id, cantidad) {
    await db.run(`
      UPDATE productos
      SET stock_actual = stock_actual + ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [cantidad, id]);
    return this.getById(id);
  }

  static async getLowStock() {
    const productos = await db.all(`
      SELECT p.*, c.nombre as categoria_nombre
      FROM productos p
      LEFT JOIN categorias c ON p.categoria_id = c.id
      WHERE ${this.condicionStockBajo('p')}
      ORDER BY p.stock_actual ASC
    `);
    return productos;
  }

  /** Productos con stock que vencen en 7 días o ya vencieron. */
  static async getProximosVencer() {
    const hoy = fechaLocalISO();
    const hasta = addDaysISO(hoy, DIAS_ALERTA_VENCIMIENTO);
    const rows = await db.all(
      `
      SELECT p.*, c.nombre as categoria_nombre
      FROM productos p
      LEFT JOIN categorias c ON p.categoria_id = c.id
      WHERE COALESCE(p.no_controla_stock, FALSE) = FALSE
        AND COALESCE(p.no_verifica_vencimiento, FALSE) = FALSE
        AND p.fecha_vencimiento IS NOT NULL
        AND p.fecha_vencimiento::date <= ?::date
        AND COALESCE(p.stock_actual, 0) > 0
      ORDER BY p.fecha_vencimiento ASC, p.nombre ASC
    `,
      [hasta]
    );
    return (rows || []).map((p) => {
      const fecha = normalizarFechaISO(p.fecha_vencimiento);
      const dias = fecha ? diasHasta(hoy, fecha) : null;
      return {
        ...p,
        fecha_vencimiento: fecha,
        dias,
        vencido: dias != null && dias < 0,
        vence_hoy: dias === 0
      };
    });
  }
}
