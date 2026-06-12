'use client';

import { ArrowUp, ArrowDown, Minus } from 'lucide-react';
import styles from './StatTile.module.css';

const severityClassMap = {
  default: styles.severityDefault,
  success: styles.severitySuccess,
  warning: styles.severityWarning,
  critical: styles.severityCritical,
};

const iconSeverityMap = {
  default: styles.icon,
  success: styles.iconSuccess,
  warning: styles.iconWarning,
  critical: styles.iconCritical,
};

const changeDirectionMap = {
  up: { className: styles.changeUp, Icon: ArrowUp },
  down: { className: styles.changeDown, Icon: ArrowDown },
  neutral: { className: styles.changeNeutral, Icon: Minus },
};

export default function StatTile({
  title,
  value,
  change,
  changeDirection = 'neutral',
  icon: IconComponent,
  severity = 'default',
}) {
  const severityClass = severityClassMap[severity] || severityClassMap.default;
  const iconClass = iconSeverityMap[severity] || iconSeverityMap.default;
  const changeConfig = changeDirectionMap[changeDirection] || changeDirectionMap.neutral;

  return (
    <div className={`${styles.tile} ${severityClass}`}>
      <div className={styles.header}>
        <span className={styles.title}>{title}</span>
        {IconComponent && (
          <span className={iconClass}>
            <IconComponent size={18} />
          </span>
        )}
      </div>
      <span className={styles.value}>{value}</span>
      {change !== undefined && change !== null && (
        <span className={`${styles.change} ${changeConfig.className}`}>
          <changeConfig.Icon size={14} />
          {change}%
        </span>
      )}
    </div>
  );
}
