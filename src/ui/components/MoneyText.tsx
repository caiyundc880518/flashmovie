import { fmtWan } from '../format'

/** 金额显示（万/亿） */
export function MoneyText({ value, className }: { value: number; className?: string }) {
  const cls = value < 0 ? 'money money-neg' : 'money'
  return <span className={className ? `${cls} ${className}` : cls}>{fmtWan(value)}</span>
}
