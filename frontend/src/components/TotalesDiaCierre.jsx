import { fmtMoney } from '../utils/cierreCajaDisplay'

const fmtU = (n) =>
  Number(n || 0).toLocaleString('es-ES', { maximumFractionDigits: 3 })

/** Total del día de milanesas y cigarrillos. Solo llega en el último cierre. */
export default function TotalesDiaCierre({ totales, compact = false }) {
  if (!totales?.milanesas && !totales?.cigarrillos) return null
  const filas = [
    ['Milanesas', totales.milanesas],
    ['Cigarrillos', totales.cigarrillos]
  ]
  return (
    <div
      className={
        compact
          ? 'rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sky-950 dark:border-sky-500/40 dark:bg-sky-950/40 dark:text-sky-100'
          : 'rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sky-950 dark:border-sky-500/40 dark:bg-sky-950/40 dark:text-sky-100'
      }
    >
      <p className="text-xs font-bold uppercase tracking-wide text-sky-800 dark:text-sky-200">
        Total del día
      </p>
      {!compact && (
        <p className="text-[11px] text-sky-800/80 dark:text-sky-200/80 mb-2">
          Milanesas y cigarrillos desde las 06:00. Solo en el último cierre.
        </p>
      )}
      <div className={compact ? 'mt-1 space-y-1' : 'space-y-1'}>
        {filas.map(([label, r]) => (
          <div key={label} className="flex items-baseline justify-between gap-3 text-sm">
            <span>{label}</span>
            <span className="text-right">
              <strong className="tabular-nums">{fmtMoney(r?.monto)}</strong>
              <span className="block text-[11px] text-sky-800/70 dark:text-sky-200/70">
                {fmtU(r?.unidades)} u.
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
